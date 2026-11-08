import {readRuntimeSource} from '../../helpers/runtime-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHarness} from '../../helpers/repository-harness.mjs';
const context=vm.createContext({console,DOMException,globalThis:null});context.globalThis=context;
for(const file of ['internal','native-capabilities'])vm.runInContext(readRuntimeSource(`source/core/${file}.js`),context);
const native=context[Symbol.for('studyDirector.internalModules.v1')].require('native-capabilities',1);
let calls=[],clock=0;
const environment={performance:{now:()=>clock},setTimeout:fn=>{calls.push('fallback');fn();},scheduler:{yield:async()=>calls.push('yield'),postTask:async(fn,options)=>{calls.push(options.priority);fn();}}};
const tasks=native.createTaskScheduler(environment);
await tasks.yieldTask();await tasks.yieldTask({priority:'background'});assert.deepEqual(calls,['yield','background']);
delete environment.scheduler;await tasks.yieldTask();assert.equal(calls.at(-1),'fallback');
const abort=new AbortController();abort.abort(new Error('cancelled'));await assert.rejects(tasks.yieldTask({signal:abort.signal}),/cancelled/);
const budget=tasks.budget();clock=7;assert.equal(budget(),false);clock=8;assert.equal(budget(),true);clock=9;assert.equal(budget(),false);

const controls={},h=createHarness(new Map(),null,controls);
const emptySession=await h.app.activeSession.load();assert.equal(emptySession.ok,true,'an empty canonical Active Session store is a successful read, not a storage failure');assert.equal(emptySession.value,null);assert.equal(emptySession.error,null);
const session=revision=>({id:'active',revision,date:'2026-09-06',status:'active',scheduleText:'08:00 30 Study',snapshot:{date:'2026-09-06',contentRevision:revision,review:{reflection:'x'.repeat(512*1024),studyQuality:null}},updatedAt:'2026-09-06T12:00:00.000Z'});
for(let i=1;i<=8;i++){const result=await h.app.activeSession.save(session(i));assert.equal(result.storage.idb,true);}
assert.equal(h.localWrites.sessionBytes,0,'routine successful commits must not serialize a duplicate local snapshot');
const saved=await h.app.activeSession.load();assert.equal(saved.value.revision,8);assert.equal(h.localWrites.sessionBytes,0,'loading canonical IndexedDB state must not recreate local duplication');
controls.failSessionWrite=true;
const emergency=h.app.activeSession.save(session(9),{emergency:true});
assert.equal(h.sharedLocal.get('recovery').revision,9,'emergency checkpoint is synchronous before async IDB work');
assert.equal((await emergency).storage.local,true);assert.equal((await h.app.activeSession.load()).value.revision,9,'failed database write remains recoverable');
assert.equal((await h.app.activeSession.save(session(10))).storage.local,true,'routine database failure receives a fallback snapshot');
controls.failSessionWrite=false;
assert.equal((await h.app.activeSession.load()).value.revision,10);assert.equal(h.sharedLocal.has('recovery'),false,'verified recovery promotion cleans up its duplicate');
const older=h.app.activeSession.save(session(11));const newer=h.app.activeSession.save(session(12),{emergency:true});
await older;assert.equal(h.sharedLocal.get('recovery').revision,12,'older commit cannot clear a newer emergency checkpoint');await newer;assert.equal(h.sharedLocal.has('recovery'),false);
controls.owned=false;assert.equal((await h.app.activeSession.save(session(13),{emergency:true})).ok,false);assert.equal(h.sharedLocal.has('recovery'),false);
controls.owned=true;controls.failSessionWrite=true;controls.failLocal=true;assert.equal((await h.app.activeSession.save(session(14))).ok,false,'dual storage failure cannot report success');

controls.failLocal=false;controls.failSessionWrite=false;let nextRevision=20,concurrentReads=0;
controls.onSessionRead=async()=>{if(concurrentReads++<3)await h.app.activeSession.save(session(++nextRevision));};
assert.equal((await h.app.activeSession.load()).value.revision,23,'repeatedly superseded reads use the settled canonical write, not an absent local duplicate');
controls.onSessionRead=null;

const insights=readRuntimeSource('source/external/insights.js');
const controller=insights.match(/  const InsightsWorkerModel=\(\(\)=>\{[\s\S]*?\n  \}\)\(\);/)[0];
let lastWorker,timer,terminated=0,builds=0,constructed=0;
class Worker{constructor(url){assert.equal(url,'https://test/sd.insights.js');constructed++;lastWorker=this;}postMessage(data){this.request=data;}terminate(){terminated++;}}
const workerContext=vm.createContext({performance,Worker,INSIGHTS_RUNTIME_URL:'https://test/sd.insights.js',trustedWorkerURL:()=> 'https://test/sd.insights.js',setTimeout:fn=>{timer=fn;return 1;},clearTimeout:()=>{},console});
vm.runInContext(controller+'\nglobalThis.factory=InsightsWorkerModel;',workerContext);
const modelEngine={buildPrepared:()=>{builds++;return {};},getLabEvidence:()=>({audit:true})};
const api={logic:{classifyTaskOutcome:()=> 'done',summarizePracticeRuns:()=>({})}};
const processor=workerContext.factory.create(api,modelEngine),records=Array.from({length:120},()=>({})),prepared={records,revision:'r1'};
let job=processor.build(records,prepared,{}),retained=lastWorker;retained.onmessage({data:{type:'SD_INSIGHTS_RESULT',id:retained.request.id,model:{value:1},computeMs:3}});let result=await job;assert.equal(result.model.value,1);assert.equal(result.model.getLabEvidence().audit,true);assert.equal(builds,0);
job=processor.build(records,prepared,{});assert.equal(lastWorker,retained,'successful retained Insights builds must reuse one worker');lastWorker.onmessage({data:{type:'SD_INSIGHTS_RESULT',id:lastWorker.request.id,model:{value:11},computeMs:2}});assert.equal((await job).model.value,11);assert.equal(terminated,0,'successful retained builds must not churn the worker');
job=processor.build(records,prepared,{});lastWorker.onmessageerror();await assert.rejects(job,e=>e.cause?.message.includes('unreadable'));assert.equal(builds,0,'failed heavy computation must not rerun synchronously');assert.equal(terminated,1);
job=processor.build(records,prepared,{});timer();await assert.rejects(job,e=>e.cause?.message.includes('timed out'));assert.equal(terminated,2);
job=processor.build(records,prepared,{});processor.cancel();await assert.rejects(job,{name:'AbortError'});assert.equal(terminated,3,'cancellation retires only the superseded worker');const prewarmed=lastWorker;
job=processor.build(records,prepared,{});assert.equal(lastWorker,prewarmed,'retry after cancellation must reuse the prewarmed replacement');lastWorker.onmessage({data:{type:'SD_INSIGHTS_RESULT',id:lastWorker.request.id,model:{value:2}}});assert.equal((await job).model.value,2,'retry uses the clean retained worker');
assert.equal(processor.dispose(),true);assert.equal(terminated,4,'view disposal must retire the final retained worker');assert.equal(constructed,4,'worker lifecycle must avoid per-render constructor churn');

// A revision's records reach the worker once, in parts small enough to keep
// each clone off the long-task list; a window names positions in them.
{
  const workers=[],timers=new Map();let nextTimer=0,yields=0;
  class PartWorker{constructor(){this.messages=[];this.terminated=false;workers.push(this);}postMessage(data){this.messages.push(data);}terminate(){this.terminated=true;}}
  const context=vm.createContext({performance,Worker:PartWorker,INSIGHTS_RUNTIME_URL:'https://test/sd.insights.js',trustedWorkerURL:()=> 'https://test/sd.insights.js',setTimeout:(fn,ms)=>{timers.set(++nextTimer,{fn,ms});return nextTimer;},clearTimeout:id=>timers.delete(id),console});
  vm.runInContext(controller+'\nglobalThis.factory=InsightsWorkerModel;',context);
  const parts=context.factory.create(api,modelEngine,{yieldTask:async()=>{yields++;}});
  const history=Array.from({length:320},(_,index)=>({index})),preparedHistory={records:history,revision:'r2'};
  const answer=async job=>{for(let turn=0;turn<10&&!workers.at(-1).messages.some(m=>m.type==='SD_INSIGHTS_BUILD'&&!m.answered);turn++)await null;const worker=workers.at(-1),request=worker.messages.findLast(m=>m.type==='SD_INSIGHTS_BUILD');request.answered=true;worker.onmessage({data:{type:'SD_INSIGHTS_RESULT',id:request.id,model:{},computeMs:1}});return job;};
  let built=await answer(parts.build(history,preparedHistory,{}));
  const sentParts=workers[0].messages.filter(m=>m.type==='SD_INSIGHTS_RECORDS');
  assert.deepEqual(sentParts.map(m=>m.records.length),[150,150,20],'records travel in parts of at most 150');
  assert.equal(yields,2,'the page yields between parts');
  assert.equal(JSON.stringify(workers[0].messages.at(-1).window),'{"all":true}');assert.equal(built.sentRecords,320);
  const windowRecords=history.slice(-7);
  built=await answer(parts.build(windowRecords,preparedHistory,{}));
  assert.equal(workers[0].messages.filter(m=>m.type==='SD_INSIGHTS_RECORDS').length,3,'a window change resends no records');
  assert.equal(JSON.stringify(workers[0].messages.at(-1).window),'{"indices":[313,314,315,316,317,318,319]}');assert.equal(built.sentRecords,0);
  await assert.rejects(parts.build([{index:'stranger'}],preparedHistory,{}),e=>e.code==='INSIGHTS_PROCESSING_FAILED','records outside the prepared history are refused');
  // Hiding the tab keeps an idle worker for a while, then frees it.
  built=await answer(parts.build(history,preparedHistory,{}));
  const idle=workers.at(-1);assert.equal(parts.release(),true);assert.equal(idle.terminated,false,'an idle worker survives hiding the tab');
  const retire=[...timers.values()].find(timer=>timer.ms===120000);assert.ok(retire,'hiding the tab arms the idle retirement');
  retire.fn();assert.equal(idle.terminated,true,'the idle worker is freed after its grace period');
  // Hiding the tab during a build stops that build at once.
  const running=parts.build(history,preparedHistory,{});
  assert.equal(parts.release(),true);await assert.rejects(running,{name:'AbortError'});assert.equal(workers.at(-1).terminated,true);
}
console.log(JSON.stringify({status:'PASS',suite:'runtime-resilience',routineSessionWrites:8,routineLocalSnapshotBytes:0,emergencyFallback:true,recoveryPromotion:true,ownership:true,schedulerAndFallback:true,workerTimeoutCancellationRetry:true,emptyActiveSessionRead:true},null,2));
