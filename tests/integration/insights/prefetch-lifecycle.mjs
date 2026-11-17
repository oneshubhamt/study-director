import assert from 'node:assert/strict';
import {readRuntimeSource} from '../../helpers/runtime-source.mjs';

const source=readRuntimeSource('source/external/insights-runtime.ts');

const prefetchStart=source.indexOf('    const PREFETCH_IDLE_TIMEOUT_MS=10000;');
const prefetchEnd=source.indexOf('    const publishProfile=',prefetchStart);
assert.ok(prefetchStart>0&&prefetchEnd>prefetchStart,'checked prefetch owner must be extractable');

function prefetchHarness({rejectBuild=false}={}){
  let revision='r1',sourceRevision='saved:1',windowKey='all',released=0,buildStartedResolve,buildReleaseResolve;
  const buildStarted=new Promise(resolve=>{buildStartedResolve=resolve;});
  const buildRelease=new Promise(resolve=>{buildReleaseResolve=resolve;});
  const state={
    rendered:false,renderedBaseKey:'',renderedWindowKey:'',prefetched:null,session:null,
    prefetching:null,prefetchWorking:false
  };
  const runtimeWindow={};
  const document={visibilityState:'visible',getElementById:()=>null};
  const dataSource={
    getRecordSource:()=>({type:'real',revision:sourceRevision}),
    getCurrentStudyDate:()=> '2026-11-17',
    getDatasetRevision:async()=>revision
  };
  const api={insights:{dataSource}};
  const computation={
    minimumRecords:1,
    supported:()=>true,
    build:async()=>{
      buildStartedResolve();
      await buildRelease;
      if(rejectBuild)throw new Error('stale prefetch failure');
      return {mode:'worker',model:{},computeMs:2,roundTripMs:3,sentRecords:2};
    },
    release:()=>{released+=1;return true;}
  };
  const prepared={records:[{date:'2026-11-16'},{date:'2026-11-17'}],revision:'prepared-r1'};
  const session={
    baseKey:'real||||saved:1|2026-11-17|r1',
    source:{type:'real',revision:'saved:1'},
    currentStudyDate:'2026-11-17',datasetRevision:'r1',summaries:[],summaryRevision:'s1',prepared
  };
  const values={
    performance:{now:()=>100},window:runtimeWindow,document,
    requestIdleCallback:callback=>{callback();return 1;},setTimeout:callback=>{callback();return 1;},
    computation,api,localIsoDate:()=> '2026-11-17',readInsightWindowKey:()=>windowKey,
    readDatasetRevision:async source=>source.getDatasetRevision(),sourceIdentity:source=>[
      source?.type||'real',source?.mode||'',source?.target||'',source?.label||'',source?.revision||''
    ].map(String).join('|'),
    state,prefetchGeneration:0,
    loadSession:async()=>session,
    planModel:()=>({
      windowInfo:{key:'all',records:prepared.records},
      fullKey:session.baseKey+'|all|s1|prepared-r1',
      modelOptions:{}
    }),
    errorName:error=>error?.name||''
  };
  const runtime=new Function(...Object.keys(values),`${source.slice(prefetchStart,prefetchEnd)};return {prefetch};`)(...Object.values(values));
  return {
    run:()=>runtime.prefetch(),
    waitForBuild:()=>buildStarted,
    mutateSource:()=>{revision='r2';sourceRevision='saved:2';},
    mutateWindow:()=>{windowKey='28';},
    releaseBuild:()=>buildReleaseResolve(),
    state,runtimeWindow,released:()=>released
  };
}

for(const rejectBuild of [false,true]){
  const h=prefetchHarness({rejectBuild});
  const pending=h.run();
  await h.waitForBuild();
  h.mutateSource();
  h.releaseBuild();
  const result=await pending;
  assert.equal(result.state,'skipped');
  assert.ok(['revision-changed','superseded'].includes(result.reason),JSON.stringify(result));
  assert.equal(h.state.prefetched,null,'a stale prefetch must not populate the reusable model cache');
  assert.equal(h.state.session,null,'a stale prefetch must not replace the retained session cache');
  assert.notEqual(h.runtimeWindow.__StudyDirectorInsightsPrefetch?.state,'ready','a stale prefetch/result/error must not publish ready status');
  assert.notEqual(h.runtimeWindow.__StudyDirectorInsightsPrefetch?.state,'failed','a stale prefetch error must not publish failure over newer source state');
}


{
  const restoreStart=source.indexOf('    const restoreInterruptedRender=');
  const restoreEnd=source.indexOf('    const observePane=',restoreStart);
  assert.ok(restoreStart>0&&restoreEnd>restoreStart,'checked retained rollback owner must be extractable');
  let focusedWith=null,purges=0;
  const focus={isConnected:true,focus:options=>{focusedWith=options;}};
  const prior={id:'complete-view'};
  const pane={children:[{id:'partial-view'}],replaceChildren(...nodes){this.children=nodes;}};
  const state={renderRollback:{pane,token:7,nodes:[prior],focus}};
  const Layout={purge:()=>{purges+=1;}};
  const restoreInterruptedRender=new Function('state','Layout',`${source.slice(restoreStart,restoreEnd)};return restoreInterruptedRender;`)(state,Layout);
  assert.equal(restoreInterruptedRender(),true);
  assert.deepEqual(pane.children,[prior],'rollback must restore the last complete retained DOM');
  assert.deepEqual(focusedWith,{preventScroll:true},'rollback must restore the retained keyboard focus without moving the viewport');
  assert.equal(purges,1,'rollback must purge only detached chart registrations after restoring retained nodes');
  assert.equal(state.renderRollback,null,'rollback ownership must be cleared after restoration');
}

{
  let observer=null,releaseCount=0,transientReleaseCount=0,invalidations=0,restores=0;
  const observeStart=source.indexOf('    const observePane=');
  const observeEnd=source.indexOf('    const captureScroll=',observeStart);
  assert.ok(observeStart>0&&observeEnd>observeStart,'checked inactivity owner must be extractable');
  class FakeMutationObserver{
    constructor(callback){this.callback=callback;observer=this;}
    observe(){}
    disconnect(){}
  }
  let on=true;
  const pane={hidden:false,classList:{contains:()=>on}};
  const state={pane:null,paneObserver:null};
  const values={
    state,MutationObserver:FakeMutationObserver,prefetchGeneration:0,
    InsightsRenderCoordinator:{begin:()=>{invalidations+=1;return invalidations;}},
    restoreInterruptedRender:()=>{restores+=1;return false;},
    computation:{release:()=>{releaseCount+=1;return true;}},
    engine:{releaseTransient:()=>{transientReleaseCount+=1;}}
  };
  const observePane=new Function(...Object.keys(values),`${source.slice(observeStart,observeEnd)};return observePane;`)(...Object.values(values));
  observePane(pane);
  on=false;
  observer.callback();
  assert.equal(invalidations,1,'leaving Insights must invalidate an in-flight retained render');
  assert.equal(releaseCount,1,'leaving Insights must release the retained worker for idle retirement');
  assert.equal(transientReleaseCount,1,'leaving Insights must release lazy/transient model evidence');
  assert.equal(restores,1,'leaving Insights must restore any interrupted progressive refresh');
}

{
  const loadStart=source.indexOf('    const loadSession=async(');
  const loadEnd=source.indexOf('    // One description of the model',loadStart);
  assert.ok(loadStart>0&&loadEnd>loadStart,'checked session preparation owner must be extractable');
  let current=true,preparedCommitted=false;
  const records=[{date:'2026-11-17',tasks:[]}];
  const dataSource={
    getDailySnapshot:async()=>({summaries:records,records}),
    getRecordSource:()=>({type:'real',revision:'saved:1'}),
    getDatasetRevision:async()=> 'r1'
  };
  const values={
    performance:{now:()=>0},globalThis:{},
    computation:{enrichRecords:value=>value},
    normalizeSummaries:value=>value,
    readDatasetRevision:source=>source.getDatasetRevision(),
    sourceIdentity:source=>[source?.type||'real',source?.mode||'',source?.target||'',source?.label||'',source?.revision||''].map(String).join('|'),
    engine:{prepareAsync:async(value,revision,yieldTask)=>{await yieldTask();preparedCommitted=true;return {records:value,revision};}},
    summariesRevisionKey:()=> 'summary-r1',
    supersededError:()=>{const error=new Error('superseded');error.name='AbortError';return error;},
    setTimeout:callback=>{current=false;callback();return 1;}
  };
  const loadSession=new Function(...Object.keys(values),`${source.slice(loadStart,loadEnd)};return loadSession;`)(...Object.values(values));
  await assert.rejects(
    loadSession({dataSource,source:dataSource.getRecordSource(),sourceKey:'real||||saved:1',currentStudyDate:'2026-11-17',datasetRevision:'r1',isCurrent:()=>current,profile:{recordLoadMs:0,evidencePreparationMs:0}}),
    error=>error?.name==='AbortError'
  );
  assert.equal(preparedCommitted,false,'superseded preparation must stop before it can publish into the model preparation cache');
}

console.log(JSON.stringify({
  status:'PASS',suite:'insights-prefetch-lifecycle',
  staleResultFenced:true,staleErrorFenced:true,inactivityRelease:true,inactivityInvalidation:true,preparationCancellation:true,retainedFocusRollback:true
}));
