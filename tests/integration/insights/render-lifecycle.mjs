import {readRuntimeSource} from '../../helpers/runtime-source.mjs';
import {createNotifications} from '../../helpers/notifications.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=readRuntimeSource('source/external/insights-runtime.ts');
const start=source.indexOf('    const render=async('),end=source.indexOf('    return Object.freeze({render,prefetch,ready:',start);
assert.ok(start>0&&end>start);
function harness({failSource=false,supersede=false,retained=false,staleFailure=false}={}){
  let generation=0,disconnects=0,observers=0;
  const {coordinator,port}=createNotifications('insights');
  const element=()=>({children:[],textContent:'',attributes:{},classList:{contains:()=>true},setAttribute(key,value){this.attributes[key]=value;},appendChild(node){this.children.push(node);},replaceChildren(...nodes){this.children=nodes;},addEventListener(){}});
  const pane=element(),previous={id:'previous-view'};if(retained)pane.children.push(previous);
  const state={rendered:retained,errorTimer:null,renderedBaseKey:'source|2026-09-28|revision',renderedWindowKey:'all'};
  const values={
    observePane:()=>{},state,restoreScroll:()=>{},clearTimeout,performance:{now:()=>0},
    InsightsRenderCoordinator:{begin:()=>++generation,isCurrent:token=>token===generation},computation:{cancel:()=>{},warm:()=>true},
    PerformanceObserver:class{static supportedEntryTypes=['longtask'];constructor(){observers++;}observe(){}disconnect(){disconnects++;}},
    renderInitialInsightsLoading:()=>pane.setAttribute('aria-busy','true'),requestAnimationFrame:callback=>callback(),
    api:{insights:{notifications:port,dataSource:{getRecordSource:()=>{if(staleFailure){generation++;throw new Error('Stale source failure');}if(failSource)throw new Error('Source unavailable');return null;}}}},
    localIsoDate:()=> '2026-09-28',readInsightWindowKey:()=> 'all',
    readDatasetRevision:async()=>{if(supersede)generation++;return 'revision';},sourceIdentity:()=> 'source',
    clearInsightsUpdateStatus:()=>{},publishProfile:()=>{},showInsightsUpdateStatus:()=>{const node=element();pane.appendChild(node);return node;},
    loadSession:async()=>null,el:(_tag,_class,text)=>Object.assign(element(),{textContent:text})
  };
  const render=new Function(...Object.keys(values),`${source.slice(start,end)};return render;`)(...Object.values(values));
  return {coordinator,run:()=>render({pane}),pane,previous,state,counts:()=>({observers,disconnects})};
}
for(const options of [{},{supersede:true},{retained:true},{failSource:true},{retained:true,failSource:true},{retained:true,staleFailure:true}]){
  const h=harness(options);await h.run();
  assert.deepEqual(h.counts(),{observers:1,disconnects:1},'every successful, superseded or failed render must disconnect its own observer exactly once');
  if(options.failSource&&!options.retained){assert.equal(h.pane.attributes['aria-busy'],'false');assert.equal(h.pane.children[0].children[0].textContent,'Retry','early source failures must offer retry instead of leaving a loading shell');}
  if(options.failSource&&options.retained){assert.equal(h.pane.children[0],h.previous,'failed refresh must retain the previous usable report');assert.equal(h.pane.children.at(-1).children[0].textContent,'Retry','retained refresh failure must expose an in-place retry');}
  if(options.staleFailure){assert.deepEqual(h.pane.children,[h.previous],'stale failure must not alter the successor/retained DOM');}
  assert.equal(h.coordinator.readEvent('insights','report').lifecycle,options.staleFailure?'cancelled':options.failSource?'failed':options.supersede?'cancelled':'succeeded');
  assert.equal(h.coordinator.eventStatus().toasts.length,0,'report status stays inside Insights without navigation jingles or duplicate toasts');
  if(options.supersede)assert.equal(h.pane.children.length,0,'a superseded render must not replace the newer view');
}
console.log(JSON.stringify({status:'PASS',suite:'insights-render-lifecycle',earlyFailureRetry:true,retainedFailurePreservesView:true,staleFailureFenced:true,supersededCleanup:true,retainedCleanup:true}));
