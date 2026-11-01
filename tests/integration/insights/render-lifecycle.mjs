import {createNotifications} from '../../helpers/notifications.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('source/external/insights.js','utf8');
const start=source.indexOf('    const render=async context=>{'),end=source.indexOf('    return Object.freeze({render,prefetch,ready:',start);
assert.ok(start>0&&end>start);
function harness({failSource=false,supersede=false,retained=false}={}){
  let generation=0,disconnects=0,observers=0;
  const {coordinator,port}=createNotifications('insights');
  const element=()=>({children:[],textContent:'',attributes:{},classList:{contains:()=>true},setAttribute(key,value){this.attributes[key]=value;},appendChild(node){this.children.push(node);},replaceChildren(...nodes){this.children=nodes;},addEventListener(){}});
  const pane=element(),state={rendered:retained,errorTimer:null,renderedBaseKey:'source|2026-09-28|revision',renderedWindowKey:'all'};
  const values={
    observePane:()=>{},state,restoreScroll:()=>{},clearTimeout,performance:{now:()=>0},
    InsightsRenderCoordinator:{begin:()=>++generation,isCurrent:token=>token===generation},computation:{cancel:()=>{},warm:()=>true},
    PerformanceObserver:class{static supportedEntryTypes=['longtask'];constructor(){observers++;}observe(){}disconnect(){disconnects++;}},
    renderInitialInsightsLoading:()=>pane.setAttribute('aria-busy','true'),requestAnimationFrame:callback=>callback(),
    api:{insights:{notifications:port,dataSource:{getRecordSource:()=>{if(failSource)throw new Error('Source unavailable');return null;}}}},
    localIsoDate:()=> '2026-09-28',readInsightWindowKey:()=> 'all',
    readDatasetRevision:async()=>{if(supersede)generation++;return 'revision';},sourceIdentity:()=> 'source',
    clearInsightsUpdateStatus:()=>{},publishProfile:()=>{},showInsightsUpdateStatus:()=>element(),
    loadSession:async()=>null,el:(_tag,_class,text)=>Object.assign(element(),{textContent:text})
  };
  const render=new Function(...Object.keys(values),`${source.slice(start,end)};return render;`)(...Object.values(values));
  return {coordinator,run:()=>render({pane}),pane,state,counts:()=>({observers,disconnects})};
}
for(const options of [{},{supersede:true},{retained:true},{failSource:true}]){
  const h=harness(options);await h.run();
  assert.deepEqual(h.counts(),{observers:1,disconnects:1},'every successful, superseded or failed render must disconnect its own observer exactly once');
  if(options.failSource){assert.equal(h.pane.attributes['aria-busy'],'false');assert.equal(h.pane.children[0].children[0].textContent,'Retry','early source failures must offer retry instead of leaving a loading shell');}
  assert.equal(h.coordinator.readEvent('insights','report').lifecycle,options.failSource?'failed':options.supersede?'cancelled':'succeeded');
  assert.equal(h.coordinator.eventStatus().toasts.length,0,'report status stays inside Insights without navigation jingles or duplicate toasts');
  if(options.supersede)assert.equal(h.pane.children.length,0,'a superseded render must not replace the newer view');
}
console.log(JSON.stringify({status:'PASS',suite:'insights-render-lifecycle',earlyFailureRetry:true,supersededCleanup:true,retainedCleanup:true}));
