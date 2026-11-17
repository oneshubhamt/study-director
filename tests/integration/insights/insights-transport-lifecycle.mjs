import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readScript} from '../../../build/source-script.mts';

const protocolSource=readScript('source/external/insights-protocol.ts');
const workerSource=readScript('source/external/insights-worker.ts');
const computeSource=readScript('source/external/insights-compute.ts');
const hostSource=readScript('source/core/insights-host.ts');

function modelRuntime(){
  return {
    ModelEngine:{
      createInsightsEngine(){
        return {
          reusePrepared(records,revision){return {records,revision};},
          buildPrepared(records,prepared,options){
            const model={count:records.length,tag:options?.windowKey||'',prepared:prepared.records.length};
            Object.defineProperty(model,'getLabEvidence',{enumerable:false,value:()=>({private:true})});
            return model;
          }
        };
      }
    }
  };
}
function protocolContext(extra={}){
  const context=vm.createContext({console,Object,Reflect,Map,Set,Date,Number,String,Array,Error,TypeError,URL,...extra});
  vm.runInContext(protocolSource,context,{filename:'insights-protocol.ts'});
  return context;
}
{
  const outbound=[],listeners={};
  const context=protocolContext({
    performance:{now:()=>10},
    postMessage:value=>outbound.push(value),
    addEventListener:(type,handler)=>{listeners[type]=handler;}
  });
  context.StudyDirectorInsightsModel=modelRuntime();
  vm.runInContext(workerSource,context,{filename:'insights-worker.ts'});
  const send=data=>listeners.message({data});
  send({type:'SD_INSIGHTS_RECORDS',requestId:1,revision:'r1',part:1,parts:2,records:[]});
  assert.equal(outbound.at(-1)?.type,'SD_INSIGHTS_ERROR','out-of-order transfer must fail closed');
  send({type:'SD_INSIGHTS_RECORDS',requestId:2,revision:'r2',part:0,parts:1,records:[{date:'2026-01-01'}]});
  send({type:'SD_INSIGHTS_BUILD',id:2,revision:'r2',window:{indices:[9]},options:{}});
  assert.equal(outbound.at(-1)?.type,'SD_INSIGHTS_ERROR','invalid window index must fail closed');
  send({type:'SD_INSIGHTS_BUILD',id:3,revision:'r2',window:{all:true},options:{windowKey:'all'}});
  assert.equal(outbound.at(-1)?.type,'SD_INSIGHTS_RESULT');
  assert.equal(Object.hasOwn(outbound.at(-1).model,'getLabEvidence'),false,'Lab evidence must stay off the worker wire');
}
{
  let serial=0,releaseYield=()=>{};
  class FakeWorker{
    constructor(){this.serial=++serial;FakeWorker.instances.push(this);}
    static instances=[];
    postMessage(message){this.messages=(this.messages||[]).concat([message]);}
    terminate(){this.terminated=true;}
  }
  function HTMLScriptElement(){}
  const script=Object.create(HTMLScriptElement.prototype);script.src='https://example.test/sd.insights.js';
  const document={currentScript:script};
  const context=protocolContext({
    document,HTMLScriptElement,Worker:FakeWorker,
    location:{origin:'https://example.test',href:'https://example.test/'},
    performance:{now:()=>20},
    setTimeout:()=>1,clearTimeout:()=>{}
  });
  vm.runInContext(computeSource,context,{filename:'insights-compute.ts'});
  const bridge=context.StudyDirectorInsightsComputeBridge;
  const engine={buildPrepared(records){return {count:records.length};},getLabEvidence(){return {ok:true};}};
  const api=Object.freeze({logic:Object.freeze({classifyTaskOutcome:()=> 'untouched',summarizePracticeRuns:()=>Object.freeze({runSummaries:[]})})});
  const prepared={records:Array.from({length:320},(_,index)=>({date:`2026-01-${String(index%28+1).padStart(2,'0')}`})),revision:'r1'};
  const gate=new Promise(resolve=>{releaseYield=resolve;});
  const computation=bridge.create(api,engine,{yieldTask:()=>gate});
  const first=computation.build(prepared.records,prepared,{});
  await Promise.resolve();
  const old=FakeWorker.instances[0];
  assert.equal(old.messages.filter(message=>message.type==='SD_INSIGHTS_RECORDS').length,1,'transfer should yield after the first bounded chunk');
  computation.cancel();
  releaseYield();
  const successor=FakeWorker.instances.at(-1);
  old.onerror?.({message:'late old failure',preventDefault(){}});
  old.onmessage?.({data:{type:'SD_INSIGHTS_RESULT',id:1,revision:'r1',model:{count:999},computeMs:1}});
  assert.equal(successor.terminated,undefined,'late old worker events must not terminate the successor');
  await assert.rejects(first,error=>error?.name==='AbortError');
}
{
  class FailingWorker{constructor(){throw new Error('worker startup failed');}}
  function HTMLScriptElement(){}
  const script=Object.create(HTMLScriptElement.prototype);script.src='https://example.test/sd.insights.js';
  const context=protocolContext({
    document:{currentScript:script},HTMLScriptElement,Worker:FailingWorker,
    location:{origin:'https://example.test',href:'https://example.test/'},
    performance:{now:()=>30},setTimeout:()=>1,clearTimeout:()=>{}
  });
  vm.runInContext(computeSource,context,{filename:'insights-compute.ts'});
  const engine={
    buildPrepared(records){return {count:records.length,parity:'same-model-engine'};},
    getLabEvidence(){return {ok:true};}
  };
  const api=Object.freeze({logic:Object.freeze({classifyTaskOutcome:()=> 'untouched',summarizePracticeRuns:()=>Object.freeze({runSummaries:[]})})});
  const records=Array.from({length:160},(_,index)=>({date:`2026-02-${String(index%28+1).padStart(2,'0')}`}));
  const result=await context.StudyDirectorInsightsComputeBridge.create(api,engine).build(records,{records,revision:'fallback-r1'},{});
  assert.equal(result.mode,'main-thread-worker-failure');
  assert.deepEqual(result.model,{count:160,parity:'same-model-engine'},'worker startup failure must fall back through the same model engine');
}
{
  const workers=[],timers=new Map();let nextTimer=0;
  class ReuseWorker{
    constructor(){this.messages=[];this.terminated=false;workers.push(this);}
    postMessage(message){
      this.messages.push(message);
      if(message.type==='SD_INSIGHTS_BUILD')queueMicrotask(()=>this.onmessage?.({data:{type:'SD_INSIGHTS_RESULT',id:message.id,revision:message.revision,model:{count:message.window.all?320:message.window.indices.length},computeMs:2}}));
    }
    terminate(){this.terminated=true;}
  }
  function HTMLScriptElement(){}
  const script=Object.create(HTMLScriptElement.prototype);script.src='https://example.test/sd.insights.js';
  const context=protocolContext({
    document:{currentScript:script},HTMLScriptElement,Worker:ReuseWorker,
    location:{origin:'https://example.test',href:'https://example.test/'},performance:{now:()=>40},
    setTimeout:(fn,ms)=>{const id=++nextTimer;timers.set(id,{fn,ms});return id;},
    clearTimeout:id=>timers.delete(id),queueMicrotask
  });
  vm.runInContext(computeSource,context,{filename:'insights-compute.ts'});
  const engine={buildPrepared(records){return {count:records.length};},getLabEvidence(){return {audit:true};}};
  const api=Object.freeze({logic:Object.freeze({classifyTaskOutcome:()=> 'untouched',summarizePracticeRuns:()=>Object.freeze({runSummaries:[]})})});
  const records=Array.from({length:320},(_,index)=>({date:`2026-07-${String(index%28+1).padStart(2,'0')}`}));
  const prepared={records,revision:'reuse-r1'};
  const computation=context.StudyDirectorInsightsComputeBridge.create(api,engine,{yieldTask:()=>Promise.resolve()});
  const first=await computation.build(records,prepared,{});
  assert.equal(first.sentRecords,320);
  const retained=workers[0];
  const firstParts=retained.messages.filter(message=>message.type==='SD_INSIGHTS_RECORDS');
  assert.deepEqual(firstParts.map(message=>message.records.length),[150,150,20]);
  const second=await computation.build(records.slice(-7),prepared,{});
  assert.equal(second.sentRecords,0,'same revision window change must reuse worker-held records');
  assert.equal(workers.length,1,'same revision builds must reuse the retained worker');
  assert.equal(retained.messages.filter(message=>message.type==='SD_INSIGHTS_RECORDS').length,3,'same revision must not resend records');
  assert.equal(computation.release(),true);
  const retire=[...timers.values()].find(timer=>timer.ms===120000);
  assert.ok(retire,'idle worker retirement must remain armed');
  retire.fn();
  assert.equal(retained.terminated,true,'idle worker must retire after the grace period');
}
{
  let hostModule,releaseGuide=()=>{};
  const registry=Object.freeze({
    format:'study-director.internal-module-registry',version:1,
    contracts:Object.freeze({exactFrozenObject(){},functionPort(){}}),
    define(name,version,factory){assert.equal(name,'insights-host');assert.equal(version,1);hostModule=factory();return true;}
  });
  const context=vm.createContext({console,Object,Reflect,Map,Set,Date,Number,String,Array,Error,TypeError,Symbol});
  context[Symbol.for('studyDirector.internalModules.v1')]=registry;
  vm.runInContext(hostSource,context,{filename:'insights-host.ts'});
  const study=(date,label='Study')=>Object.freeze({recordKind:'study',date,label});
  const diary=date=>Object.freeze({recordKind:'diary',date});
  const canonical=[study('2026-03-01'),diary('2026-03-02')];
  const dailyRecords=Object.freeze({
    normalizeWindow:(_options,summaries)=>Object.freeze({dates:Object.freeze(summaries.map(row=>row.date))}),
    insightsSnapshot:async()=>Object.freeze({records:Object.freeze(canonical),summaries:Object.freeze(canonical)}),
    sortedSummaries:async()=>Object.freeze(canonical),
    window:async()=>Object.freeze(canonical),
    datasetRevision:async()=> 'canonical-r1'
  });
  const dailyRecordCodec=Object.freeze({
    materializeDailyRecordView:value=>value&&typeof value==='object'?value:null,
    buildDailyRecordSummary:value=>value,
    sanitizeDailyRecordSummary:value=>value&&typeof value==='object'?value:null
  });
  const guideGate=new Promise(resolve=>{releaseGuide=resolve;});
  const boundary=hostModule.createBoundary(Object.freeze({
    dailyRecords,dailyRecordCodec,notifications:Object.freeze({}),
    logic:Object.freeze({classifyTaskOutcome:()=> 'untouched',summarizePracticeRuns:()=>Object.freeze({runSummaries:[]})}),
    requestProviderTab:()=>guideGate,capture:()=>null,todayISO:()=> '2026-03-28',
    clampText:(value,max)=>String(value??'').slice(0,max)
  }));
  const delayed=boundary.preview.useSample('insights');
  const newer=Array.from({length:28},(_,index)=>study(`2026-04-${String(index+1).padStart(2,'0')}`,'Newer'));
  boundary.preview.setRecords(newer,{label:'Newer source'});
  boundary.preview.registerProvider('insights',()=>Array.from({length:28},(_,index)=>study(`2026-05-${String(index+1).padStart(2,'0')}`,'Older request')));
  releaseGuide();
  const delayedResult=await delayed;
  assert.equal(delayedResult.ok,false);
  assert.equal(delayedResult.reason,'superseded');
  assert.equal(boundary.preview.status('insights').label,'Newer source','late Guide sample load must not replace a newer preview/source choice');
  const previewRevision=await boundary.appInsights.dataSource.getDatasetRevision();
  assert.match(previewRevision,/^preview:/,'preview source must carry explicit revision provenance');
  boundary.preview.setRecords([study('2026-06-01'),diary('2026-06-02')],{label:'Mixed'});
  const previewSnapshot=await boundary.appInsights.dataSource.getDailySnapshot();
  assert.deepEqual(previewSnapshot.records.map(row=>row.recordKind),['study'],'Diary entries must stay out of preview Insights data');
  boundary.preview.clear();
  const savedSnapshot=await boundary.appInsights.dataSource.getDailySnapshot();
  assert.deepEqual(savedSnapshot.records.map(row=>row.recordKind),['study'],'Diary entries must stay out of saved Insights data');
}
}
console.log(JSON.stringify({status:'PASS',suite:'insights-transport-lifecycle'}));
