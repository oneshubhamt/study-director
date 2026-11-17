import {readRuntimeSource} from '../../helpers/runtime-source.mjs';
import {createNotifications} from '../../helpers/notifications.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=readRuntimeSource('source/external/insights-runtime.ts');
const start=source.indexOf('    const render=async('),end=source.indexOf('    return Object.freeze({render,prefetch,ready:',start);
assert.ok(start>0&&end>start);
function harness({failSource=false,supersede=false,retained=false,staleFailure=false,unstableSource=false,stalePaint=false,missingRevision=false,failRender=false}={}){
  let generation=0,disconnects=0,observers=0,published=0,frames=0,loads=0;
  const {coordinator,port}=createNotifications('insights');
  const element=()=>({children:[],textContent:'',attributes:{},classList:{contains:()=>true},setAttribute(key,value){this.attributes[key]=value;},appendChild(node){this.children.push(node);},replaceChildren(...nodes){this.children=nodes;},addEventListener(){},get childNodes(){return this.children;},querySelector(selector){return selector==='.insights-update-status'?this.children.find(node=>node.className==='insights-update-status')||null:null;}});
  const pane=element(),previous={id:'previous-view'};if(retained)pane.children.push(previous);
  const state={rendered:retained,errorTimer:null,renderedBaseKey:unstableSource||failRender?'previous-revision':`source|2026-09-28|${missingRevision?'saved:0':'revision'}`,renderedWindowKey:'all'};
  const values={
    observePane:()=>{},state,prefetchGeneration:0,restoreScroll:()=>{},clearTimeout,performance:{now:()=>0},
    errorName:error=>error?.name||'',errorCode:error=>error?.code||'',
    InsightsRenderCoordinator:{begin:()=>++generation,isCurrent:token=>token===generation},computation:{cancel:()=>{},warm:()=>true,build:async()=>({model:{},mode:'main-thread-small',computeMs:0,roundTripMs:0})},
    PerformanceObserver:class{static supportedEntryTypes=['longtask'];constructor(){observers++;}observe(){}disconnect(){disconnects++;}},
    renderInitialInsightsLoading:()=>pane.setAttribute('aria-busy','true'),requestAnimationFrame:callback=>{frames++;if(stalePaint&&frames===5)generation++;callback();},
    api:{insights:{notifications:port,dataSource:{getRecordSource:()=>{if(staleFailure){generation++;throw new Error('Stale source failure');}if(failSource)throw new Error('Source unavailable');return missingRevision?{type:'real',revision:'saved:0'}:null;}}}},
    localIsoDate:()=> '2026-09-28',readInsightWindowKey:()=> 'all',
    readDatasetRevision:async()=>{if(supersede)generation++;return missingRevision?null:'revision';},sourceIdentity:()=> 'source',
    clearInsightsUpdateStatus:()=>{},publishProfile:()=>{published++;},showInsightsUpdateStatus:()=>{const node=element();node.className='insights-update-status';pane.appendChild(node);return node;},
    loadSession:async()=>{loads++;return unstableSource?null:{baseKey:`source|2026-09-28|${missingRevision?'saved:0':'revision'}`,prepared:{records:[]}};},
    planModel:()=>({windowInfo:{key:'all',records:[]},fullKey:'model-key',modelOptions:{}}),
    renderModel:async()=>{if(failRender){pane.replaceChildren({id:'partial-dashboard'});throw new Error('A dashboard section failed to construct');}return {domMs:1,maxChunkMs:1,chunks:1};},
    Layout:{purge:()=>{}},
    main:null,window:{scrollTo(){}},
    el:(_tag,_class,text)=>Object.assign(element(),{textContent:text})
  };
  const render=new Function(...Object.keys(values),`${source.slice(start,end)};return render;`)(...Object.values(values));
  return {coordinator,run:()=>render({pane}),pane,previous,state,counts:()=>({observers,disconnects}),published:()=>published,loads:()=>loads};
}
for(const options of [{},{supersede:true},{retained:true},{failSource:true},{retained:true,failSource:true},{retained:true,staleFailure:true},{unstableSource:true},{retained:true,unstableSource:true},{stalePaint:true},{retained:true,missingRevision:true},{retained:true,failRender:true}]){
  const h=harness(options);await h.run();
  assert.deepEqual(h.counts(),{observers:1,disconnects:1},'every successful, superseded or failed render must disconnect its own observer exactly once');
  const failed=options.failSource||options.unstableSource||options.failRender;
  if(failed&&!options.retained){assert.equal(h.pane.attributes['aria-busy'],'false');assert.equal(h.pane.children[0].children[0].textContent,'Retry','failed source or inconsistent snapshots must offer retry instead of leaving a loading shell');}
  if(failed&&options.retained){assert.equal(h.pane.children[0],h.previous,'failed refresh must retain the previous usable report');assert.equal(h.pane.children.at(-1).children[0].textContent,'Retry','retained refresh failure must expose an in-place retry');}
  if(options.staleFailure){assert.deepEqual(h.pane.children,[h.previous],'stale failure must not alter the successor/retained DOM');}
  assert.equal(h.coordinator.readEvent('insights','report').lifecycle,options.staleFailure||options.supersede||options.stalePaint?'cancelled':failed?'failed':'succeeded');
  assert.equal(h.coordinator.eventStatus().toasts.length,0,'report status stays inside Insights without navigation jingles or duplicate toasts');
  if(options.supersede)assert.equal(h.pane.children.length,0,'a superseded render must not replace the newer view');
  if(options.missingRevision)assert.equal(h.loads(),1,'unknown repository revision must not reuse an allegedly current saved-data view');
  const shouldPublish=!failed&&!options.staleFailure&&!options.supersede&&!options.stalePaint;
  assert.equal(h.published(),Number(shouldPublish),'only a current, completed render may publish a profile');
}

// The real empty-state renderer must allow recovery when lazy Guide loading
// rejects; the sample action cannot become permanently disabled.
{
  const renderer=readRuntimeSource('source/external/insights-rendering.ts');
  const start=renderer.indexOf('  function renderEmptyState('),end=renderer.indexOf('  function evidenceItem(',start);
  assert.ok(start>0&&end>start,'empty-state action owner must be extractable');
  const createNode=(className='',text='')=>({
    className,textContent:text,isConnected:true,disabled:false,children:[],handlers:{},
    appendChild(child){this.children.push(child);return child;},
    append(...children){this.children.push(...children);},
    addEventListener(type,handler){this.handlers[type]=handler;},
    get childNodes(){return this.children;},
    querySelector(classSelector){
      const target=classSelector.slice(1);
      const visit=node=>node.className?.split(' ').includes(target)?node:node.children?.map(visit).find(Boolean);
      return this.children.map(visit).find(Boolean)||null;
    }
  });
  const el=(_tag,className,text)=>createNode(className||'',String(text??''));
  const renderEmptyState=new Function('el','PREVIEW_SAMPLE_DAYS',`${renderer.slice(start,end)}return renderEmptyState;`)(el,28);
  let attempts=0,reloads=0;
  const box=renderEmptyState({preview:{useSample:async()=>{attempts++;if(attempts===1)throw new Error('Guide temporarily unavailable');return {ok:true};}}},()=>{reloads++;},'2026-11-17');
  const button=box.querySelector('.insights-empty-actions').children[0];
  button.handlers.click();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(attempts,1);
  assert.equal(button.disabled,false,'failed sample load must restore the action');
  assert.match(button.textContent,/Preview with 28-day sample/);
  assert.ok(box.querySelector('.insights-preview-unavailable'),'failed sample load must leave a visible explanation');
  button.handlers.click();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(attempts,2,'sample preview must remain retryable after a failed provider load');
  assert.equal(reloads,1,'successful retry must refresh Insights');
}
{
  const renderer=readRuntimeSource('source/external/insights-rendering.ts');
  const start=renderer.indexOf('  function lazyDisclosure('),end=renderer.indexOf('  function svgEl',start);
  assert.ok(start>0&&end>start,'lazy disclosure owner must be extractable');
  const el=(_tag,className,text)=>({
    className,textContent:text||'',children:[],attributes:{},handlers:{},open:false,
    appendChild(node){node.parent=this;this.children.push(node);return node;},
    addEventListener(type,callback){this.handlers[type]=callback;},
    setAttribute(key,value){this.attributes[key]=value;},
    removeAttribute(key){delete this.attributes[key];},
    remove(){this.parent.children=this.parent.children.filter(node=>node!==this);}
  });
  const lazyDisclosure=new Function('el',`${renderer.slice(start,end)}return lazyDisclosure;`)(el);
  let attempts=0,fail=true;
  const details=lazyDisclosure('insights-dynamics-lab','Analytics Lab',()=>{attempts++;if(fail)throw new Error('transient evidence fault');return el('div','lab-evidence','Valid evidence');},true);
  details.open=true;details.handlers.toggle();
  assert.equal(details.attributes['aria-busy'],undefined,'failed lazy evidence must clear its busy state');
  assert.ok(details.children.some(row=>row.attributes['role']==='alert'),'failed lazy evidence must explain the retry');
  details.open=false;details.handlers.toggle();fail=false;
  details.open=true;details.handlers.toggle();
  assert.equal(attempts,2,'reopening must retry failed lazy evidence');
  assert.equal(details.children.some(row=>row.attributes['role']==='alert'),false,'success must remove the transient error');
  assert.ok(details.children.some(row=>row.className==='lab-evidence'),'successful retry must show the evidence');
  details.handlers.toggle();assert.equal(attempts,2,'successful lazy evidence must not rebuild on every toggle');
}
console.log(JSON.stringify({status:'PASS',suite:'insights-render-lifecycle',earlyFailureRetry:true,inconsistentSnapshotRetry:true,missingRevisionReload:true,retainedFailurePreservesView:true,renderExceptionRollback:true,staleFailureFenced:true,stalePaintProfileFenced:true,sampleRetry:true,lazyLabRetry:true,supersededCleanup:true,retainedCleanup:true}));
