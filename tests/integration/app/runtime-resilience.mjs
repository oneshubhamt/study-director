import {readRuntimeSource} from '../../helpers/runtime-source.mjs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createHarness} from '../../helpers/repository-harness.mjs';
const context=vm.createContext({console,DOMException,globalThis:null});context.globalThis=context;
for(const file of ['internal','native-capabilities'])vm.runInContext(readRuntimeSource(`source/core/${file}.ts`),context);
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
const session=revision=>({id:'active',type:'activeSession',version:1,revision,date:'2026-09-06',status:'active',runningOn:'inst_test',scheduleText:'08:00 | 30 | Study | work | General | block | 1',snapshot:{date:'2026-09-06',contentRevision:revision,review:{reflection:'x'.repeat(512*1024),studyQuality:null}},suspendedAt:null,updatedAt:'2026-09-06T12:00:00.000Z'});
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

await import('../insights/insights-transport-lifecycle.mjs');
console.log(JSON.stringify({status:'PASS',suite:'runtime-resilience',routineSessionWrites:8,routineLocalSnapshotBytes:0,emergencyFallback:true,recoveryPromotion:true,ownership:true,schedulerAndFallback:true,insightsTransportLifecycle:true,emptyActiveSessionRead:true},null,2));
