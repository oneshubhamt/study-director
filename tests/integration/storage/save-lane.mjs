import {readScript} from '../../../build/source-script.mts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createFakeClock} from '../../helpers/fake-clock.mjs';

// The one save engine behind notes, Diary reflections and the Review
// reflection: the first edit is written at once, continued typing at most
// DELAY_MS later, one write at a time, always with the latest value; a failure
// keeps the value and retries on its own.
const clock=createFakeClock('2026-10-05T10:00:00.000Z');
const context=vm.createContext({console,Promise,Object,Symbol,Error,TypeError,String,Number,Math,Array,Set,Map,WeakMap,JSON,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,queueMicrotask});
vm.runInContext(fs.readFileSync('source/core/internal.js','utf8'),context,{filename:'internal.js'});
vm.runInContext(readScript('source/core/save-lane.ts'),context,{filename:'source/core/save-lane.ts'});
const SaveLane=context[Symbol.for('studyDirector.internalModules.v1')].require('save-lane',1);
const settle=()=>clock.drainMicrotasks(32);
function lane(write){
  const states=[];
  const api=SaveLane.createLane(Object.freeze({label:'Diary reflection',write,onState:(state,error)=>states.push(error?`${state}:${error.message}`:state),environment:Object.freeze({setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout})}));
  return {api,states};
}

{ // The first edit is written at once; typing that follows waits for the pause.
  const writes=[],{api,states}=lane(async value=>{writes.push(value);});
  api.schedule('a');assert.equal(api.pending(),true);await clock.advance(0);await settle();assert.deepEqual(writes,['a'],'an edit after a quiet moment is written immediately');
  await clock.advance(100);api.schedule('ab');await clock.advance(100);api.schedule('abc');
  await clock.advance(SaveLane.DELAY_MS-201);await settle();assert.deepEqual(writes,['a'],'edits during the pause wait');
  await clock.advance(1);await settle();assert.deepEqual(writes,['a','abc'],'only the latest value is written');assert.equal(states.at(-1),'saved');assert.equal(api.pending(),false);assert.equal(api.writing(),false);await api.tail();assert.equal(await api.settled(),true);
}
{ // Continuous typing is never more than one pause behind.
  const writes=[],{api}=lane(async value=>{writes.push([clock.now(),value]);});
  const start=clock.now();let last=start;
  for(let index=1;index<=40;index+=1){api.schedule(index);await clock.advance(30);await settle();}
  await clock.advance(SaveLane.DELAY_MS);await settle();
  for(const [at] of writes){assert.ok(at-last<=SaveLane.DELAY_MS,`writes ${at-last} ms apart`);last=at;}
  assert.equal(writes.at(-1)[1],40,'the final value is written');assert.ok(writes.length<=Math.ceil(1200/SaveLane.DELAY_MS)+2,'writes are throttled');
}
{ // A failed write keeps its value and retries without another edit.
  let fail=true;const writes=[],{api,states}=lane(async value=>{writes.push(value);if(fail)throw new Error('Storage unavailable');});
  api.schedule('keep this draft');await assert.rejects(api.flush(),/Storage unavailable/);assert.equal(await api.settled(),false);assert.equal(api.pending(),true);assert.equal(api.writing(),false);
  assert.match(states.at(-1),/^error:Storage unavailable/);assert.match(api.failure().message,/Diary reflection could not be saved: Storage unavailable\. Study Director keeps retrying/);
  fail=false;await clock.advance(SaveLane.RETRY_DELAYS_MS[0]);await settle();
  assert.deepEqual(writes,['keep this draft','keep this draft']);assert.equal(api.failure(),null);assert.equal(states.at(-1),'saved');
}
{ // A failed older write never replaces a newer queued value.
  let rejectFirst;const writes=[],{api}=lane(value=>{writes.push(value);return value==='old'?new Promise((_,reject)=>{rejectFirst=reject;}):Promise.resolve();});
  api.schedule('old');const first=api.flush();assert.equal(api.writing(),true);const failed=assert.rejects(first,/old failed/);await settle();
  api.schedule('new');const newer=api.flush();rejectFirst(new Error('old failed'));await failed;await newer;await api.flush();
  assert.deepEqual(writes,['old','new']);
}
for(const failAfter of [100,SaveLane.DELAY_MS+50]){ // A superseded failure leaves the newer value's timing alone.
  let rejectOld;const writes=[],{api}=lane(value=>{writes.push([clock.now(),value]);return value==='old'?new Promise((_,reject)=>{rejectOld=reject;}):Promise.resolve();});
  const start=clock.now();api.schedule('old');await clock.advance(0);await settle();
  await clock.advance(50);api.schedule('new');
  await clock.advance(failAfter-50);rejectOld(new Error('old failed'));await settle();await clock.advance(0);await settle();
  await clock.advance(SaveLane.DELAY_MS);await settle();
  assert.deepEqual(writes.map(([,value])=>value),['old','new'],'the old value is not retried over the new one');
  assert.ok(writes[1][0]-start<=Math.max(failAfter,SaveLane.DELAY_MS),`the new value is written without a retry pause (${writes[1][0]-start} ms)`);
  await clock.advance(120000);await settle();assert.equal(writes.length,2,'nothing is retried after the new value saved');assert.equal(api.failure(),null);
}
{ // Retries back off, a newer value ends the pause, and cancel drops what is pending.
  const attempts=[],{api}=lane(async value=>{attempts.push([clock.now(),value]);throw new Error('down');});
  api.schedule('x');await api.flush().catch(()=>{});
  for(const delay of SaveLane.RETRY_DELAYS_MS.slice(0,3)){await clock.advance(delay);await settle();}
  assert.equal(attempts.length,4,'each retry waits longer');
  const before=clock.now();api.schedule('y');await clock.advance(SaveLane.DELAY_MS);await settle();
  assert.equal(attempts.length,5);assert.equal(attempts.at(-1)[1],'y');assert.ok(attempts.at(-1)[0]-before<=SaveLane.DELAY_MS,'a newer value is tried without the retry pause');
  api.cancel();await clock.advance(120000);await settle();assert.equal(attempts.length,5,'a cancelled lane stops retrying');
}
{ // A write running when the lane is cancelled is not retried.
  let rejectRunning;const writes=[],{api}=lane(value=>{writes.push(value);return new Promise((_,reject)=>{rejectRunning=reject;});});
  api.schedule('deleted entry');const running=api.flush().catch(()=>{});await settle();
  api.cancel();rejectRunning(new Error('late failure'));await running;
  await clock.advance(120000);await settle();assert.deepEqual(writes,['deleted entry']);
}
{ // Editors that group keystrokes publish before any lane writes.
  const order=[],{api}=lane(async value=>{order.push(`write:${value}`);});
  SaveLane.onBeforeFlush(()=>{order.push('publish');api.schedule('published');});
  api.schedule('typed');await api.flush();
  assert.deepEqual(order,['publish','write:published'],'the published value is written');
}
console.log(JSON.stringify({status:'PASS',suite:'save-lane',leadingEdgeThrottle:true,boundedStaleness:true,retryRetainsValue:true,newerValueWins:true,supersededFailureKeepsTiming:true,backoffAndCancel:true,cancelStopsRunningRetry:true,editorsPublishFirst:true}));
