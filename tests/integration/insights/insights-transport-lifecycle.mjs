import assert from 'node:assert/strict';
import vm from 'node:vm';
import {realInsightsProviders} from '../../helpers/insights-providers.mjs';
import {readInsightsModelRuntimeSource} from '../../helpers/insights-model-runtime.mjs';
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
  for(const record of [{date:'2026-01-01',tasks:[{completion:40}]},{date:'2026-01-01',tasks:[{__sdOutcome:'unknown'}]}]){
    send({type:'SD_INSIGHTS_RECORDS',requestId:2,revision:'r2',part:0,parts:1,records:[record]});
    assert.equal(outbound.at(-1)?.type,'SD_INSIGHTS_ERROR','malformed outcome cannot be treated as untouched work');
  }
  send({type:'SD_INSIGHTS_RECORDS',requestId:2,revision:'r2',part:0,parts:1,records:[{date:'2026-01-01'}]});
  send({type:'SD_INSIGHTS_BUILD',id:2,revision:'r2',window:{indices:[9]},options:{}});
  assert.equal(outbound.at(-1)?.type,'SD_INSIGHTS_ERROR','invalid window index must fail closed');
  for(const indices of [[0,0],[1,0],new Array(1)]){
    send({type:'SD_INSIGHTS_BUILD',id:2,revision:'r2',window:{indices},options:{}});
    assert.equal(outbound.at(-1)?.type,'SD_INSIGHTS_ERROR');
  }
  send({type:'SD_INSIGHTS_BUILD',id:3,revision:'r2',window:{all:true},options:{windowKey:'all'}});
  assert.equal(outbound.at(-1)?.type,'SD_INSIGHTS_RESULT');
  assert.equal(Object.hasOwn(outbound.at(-1).model,'getLabEvidence'),false,'Lab evidence must stay off the worker wire');
  const start={type:'SD_INSIGHTS_RECORDS',requestId:4,revision:'r2',part:0,parts:2,records:[]};
  send(start);
  send({type:'SD_INSIGHTS_BUILD',id:4,revision:'r2',window:{all:true},options:{}});
  assert.equal(outbound.at(-1)?.type,'SD_INSIGHTS_ERROR','unfinished replacement must never expose the old history');
  send(start);
  assert.match(outbound.at(-1)?.message,/out of order/u,'duplicate opening chunk rejects the transfer');
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
  function HTMLScriptElement(){}
  const script=Object.assign(new HTMLScriptElement(),{src:'https://example.test/insights.js'});
  const context=protocolContext({document:{currentScript:script},HTMLScriptElement,performance:{now:()=>0}});
  vm.runInContext(computeSource,context);
  const logic=Object.freeze({classifyTaskOutcome:()=> 'untouched',summarizePracticeRuns:()=>({})});
  const compute=context.StudyDirectorInsightsComputeBridge.create({logic},{buildPrepared:()=>({recordCount:140})});
  const records=Array(140).fill({date:'2026-03-01'});
  assert.equal(compute.warm(),false);
  const result=await compute.build(records,{records,revision:'no-worker'},{});
  assert.equal(result.mode,'main-thread-unavailable');
  const cause=new Error('Model calculation failed.');
  const broken=context.StudyDirectorInsightsComputeBridge.create({logic},{buildPrepared(){throw cause;}});
  await assert.rejects(broken.build(records,{records,revision:'no-worker'},{}),
    error=>error.code==='INSIGHTS_PROCESSING_FAILED'&&error.cause===cause,
    'model failures on a device without a worker must reach the processing-error UI');
  assert.equal(result.model.recordCount,140);
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
for(const failure of ['unreadable','missing report fields']){
  class RuntimeFailWorker{
    postMessage(message){
      if(message.type==='SD_INSIGHTS_BUILD')queueMicrotask(()=>{
        if(failure==='unreadable')this.onmessageerror?.();
        else this.onmessage({data:{type:'SD_INSIGHTS_RESULT',id:message.id,revision:message.revision,model:{},computeMs:0}});
      });
    }
    terminate(){this.terminated=true;}
  }
  function HTMLScriptElement(){}
  const script=Object.create(HTMLScriptElement.prototype);script.src='https://example.test/sd.insights.js';
  const context=protocolContext({
    document:{currentScript:script},HTMLScriptElement,Worker:RuntimeFailWorker,
    location:{origin:'https://example.test',href:'https://example.test/'},
    performance:{now:()=>35},setTimeout:()=>1,clearTimeout:()=>{},queueMicrotask
  });
  vm.runInContext(computeSource,context,{filename:'insights-compute.ts'});
  const engine={
    buildPrepared(records){return {count:records.length,parity:'same-model-engine'};},
    getLabEvidence(){return {ok:true};}
  };
  const api=Object.freeze({logic:Object.freeze({classifyTaskOutcome:()=> 'untouched',summarizePracticeRuns:()=>Object.freeze({runSummaries:[]})})});
  const records=Array.from({length:160},(_,index)=>({date:`2026-02-${String(index%28+1).padStart(2,'0')}`}));
  const prepared={records,revision:'runtime-fallback-r1'};
  const expected=engine.buildPrepared(records,prepared,{});
  const result=await context.StudyDirectorInsightsComputeBridge.create(api,engine,{yieldTask:()=>Promise.resolve()}).build(records,prepared,{});
  assert.equal(result.mode,'main-thread-worker-failure');
  assert.deepEqual(result.model,expected,'worker runtime failure must fall back through the same model engine on the same fixture');
}
{
  const workers=[],timers=new Map();let nextTimer=0;
  class ReuseWorker{
    constructor(){
      this.messages=[];this.terminated=false;workers.push(this);
      const worker=protocolContext({
        performance:{now:()=>2},postMessage:data=>queueMicrotask(()=>this.onmessage?.({data:structuredClone(data)})),
        addEventListener:(_type,handler)=>{this.receive=handler;}
      });
      vm.runInContext(readInsightsModelRuntimeSource(),worker);
      vm.runInContext(workerSource,worker);
    }
    postMessage(message){
      this.messages.push(message);
      if(message.type==='SD_INSIGHTS_BUILD'&&message.id>1){
        queueMicrotask(()=>this.onmessage?.({data:{type:'SD_INSIGHTS_RESULT',id:message.id-1,revision:message.revision,model:null,computeMs:2}}));
      }
      this.receive({data:structuredClone(message)});
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
  const logic=realInsightsProviders(),api={logic};
  vm.runInContext(readInsightsModelRuntimeSource(),context);
  const engine=context.StudyDirectorInsightsModel.ModelEngine.createInsightsEngine(logic);
  const input=Array.from({length:320},(_,index)=>({
    date:new Date(Date.UTC(2025,0,index+1)).toISOString().slice(0,10),
    tasks:[{id:'a',name:'Study',kind:'work',dur:20,completion:index%3===0?80:40,completionSource:'manual'}],
    practiceRuns:index%5===0?[{taskId:'a',targetMs:60000,totalUnits:3,unitMs:[55000,60000,65000]}]:[]
  }));
  const computation=context.StudyDirectorInsightsComputeBridge.create(api,engine,{yieldTask:()=>Promise.resolve()});
  const prepared=engine.prepare(computation.enrichRecords(input),'reuse-r1'),records=prepared.records;
  const reference=context.StudyDirectorInsightsModel.ModelEngine.createInsightsEngine(logic);
  const raw=reference.prepare(input,'reference'),options={currentStudyDate:records.at(-1).date};
  const first=await computation.build(records,prepared,options);
  assert.equal(first.sentRecords,320);
  assert.deepEqual(JSON.parse(JSON.stringify(first.model)),JSON.parse(JSON.stringify(reference.buildPrepared(raw.records,raw,options))),'worker and main thread agree across the complete report');
  const retained=workers[0];
  const firstParts=retained.messages.filter(message=>message.type==='SD_INSIGHTS_RECORDS');
  assert.deepEqual(firstParts.map(message=>message.records.length),[150,150,20]);
  const week=records.slice(-7),second=await computation.build(week,prepared,options);
  assert.deepEqual(JSON.parse(JSON.stringify(second.model)),JSON.parse(JSON.stringify(reference.buildPrepared(raw.records.slice(-7),raw,options))),'retained window computes the same report as the main thread');
  assert.equal(second.mode,'worker','a malformed reply from a completed request must not disable the current worker');
  assert.equal(second.sentRecords,0,'same revision window change must reuse worker-held records');
  assert.equal(workers.length,1,'same revision builds must reuse the retained worker');
  assert.equal(retained.terminated,false,'stale malformed worker reply must not terminate its active successor');
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
  const materializedViews=new WeakSet();
  const dailyRecordCodec=Object.freeze({
    materializeDailyRecordView:value=>{
      if(!value||typeof value!=='object'||materializedViews.has(value))return null;
      const view=Object.freeze({...value});
      materializedViews.add(view);
      return view;
    },
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
  assert.equal(Array.from(previewSnapshot.records,row=>row.recordKind).join(','),'study','Diary entries must stay out of preview Insights data');
  let publicToday='';
  boundary.preview.registerProvider('insights',({today})=>{
    publicToday=today;
    return Array.from({length:28},(_,index)=>study(`2026-07-${String(index+1).padStart(2,'0')}`,'Public sample'));
  });
  const publicSample=await boundary.publicPreview.useSample({target:'insights',today:'2026-07-28',label:'Public sample'});
  assert.equal(publicSample.ok,true,'public preview adapter must activate the registered sample provider');
  assert.equal(publicToday,'2026-07-28','public preview adapter must preserve the caller study date');
  assert.equal(boundary.preview.status('insights').label,'Public sample','public preview adapter must preserve the caller label');
  const publicSnapshot=await boundary.appInsights.dataSource.getDailySnapshot();
  assert.equal(publicSnapshot.records.length,28,'sample records must be materialized exactly once and retained in preview state');
  boundary.publicPreview.clear('insights');
  const savedSnapshot=await boundary.appInsights.dataSource.getDailySnapshot();
  assert.equal(Array.from(savedSnapshot.records,row=>row.recordKind).join(','),'study','Diary entries must stay out of saved Insights data');

  let windowValue='all';
  const deviceState=hostModule.createDeviceState(Object.freeze({
    readWindow:fallback=>windowValue||fallback,
    writeWindow:value=>{windowValue=value;return true;}
  }));
  assert.equal(deviceState.readInsightsWindow('90'),'all');
  assert.equal(deviceState.writeInsightsWindow('28'),true);
  assert.equal(windowValue,'28','checked device-state adapter must own only the bounded Insights window preference');

  let timer=null,idle=null,visibilityListener=null,requests=0;
  const preloadDocument={
    visibilityState:'hidden',
    addEventListener:(type,listener,options)=>{assert.equal(type,'visibilitychange');assert.equal(options.once,true);visibilityListener=listener;}
  };
  const preload=hostModule.createPreloadScheduler(Object.freeze({
    document:preloadDocument,
    setTimer:(callback,delayMs)=>{timer={callback,delayMs};return 1;},
    scheduleIdle:(callback,timeoutMs)=>{idle={callback,timeoutMs};return 2;},
    requestTab:async()=>{requests+=1;return true;}
  }));
  preload.schedule();
  assert.equal(timer.delayMs,4000,'Insights preload must remain behind startup housekeeping');
  timer.callback();
  assert.equal(idle.timeoutMs,10000,'Insights preload keeps the bounded idle timeout');
  idle.callback();
  assert.equal(requests,0,'hidden pages must defer optional Insights loading');
  preloadDocument.visibilityState='visible';
  visibilityListener();
  assert.equal(requests,1,'visibility recovery must request the Insights tab exactly once');
}
console.log(JSON.stringify({status:'PASS',suite:'insights-transport-lifecycle'}));
