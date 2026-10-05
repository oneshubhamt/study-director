import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createFakeClock} from '../../helpers/fake-clock.mjs';

// The one save engine behind Ongoing Notes, Diary reflections and the Review
// reflection: a write follows a pause in typing, one at a time, always with
// the latest value; a failure keeps the value and retries on its own.
const clock=createFakeClock('2026-10-05T10:00:00.000Z');
const context=vm.createContext({console,Promise,Object,Symbol,Error,TypeError,String,Number,Math,Array,Set,Map,WeakMap,JSON,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,queueMicrotask});
vm.runInContext(fs.readFileSync('source/core/internal.js','utf8'),context,{filename:'internal.js'});
vm.runInContext(fs.readFileSync('source/core/save-lane.js','utf8'),context,{filename:'save-lane.js'});
const SaveLane=context[Symbol.for('studyDirector.internalModules.v1')].require('save-lane',1);
const settle=()=>clock.drainMicrotasks(32);
function lane(write){
  const states=[];
  const api=SaveLane.createLane(Object.freeze({label:'Diary reflection',write,onState:(state,error)=>states.push(error?`${state}:${error.message}`:state),environment:Object.freeze({setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout})}));
  return {api,states};
}

{ // Typing is written once, after the pause, with the latest value.
  const writes=[],{api,states}=lane(async value=>{writes.push(value);});
  api.schedule('a');await clock.advance(100);api.schedule('ab');await clock.advance(100);api.schedule('abc');
  await clock.advance(SaveLane.DELAY_MS-1);await settle();assert.deepEqual(writes,[]);
  await clock.advance(1);await settle();assert.deepEqual(writes,['abc']);assert.equal(states.at(-1),'saved');
}
{ // A failed write keeps its value and retries without another edit.
  let fail=true;const writes=[],{api,states}=lane(async value=>{writes.push(value);if(fail)throw new Error('Storage unavailable');});
  api.schedule('keep this draft');await assert.rejects(api.flush(),/Storage unavailable/);
  assert.match(states.at(-1),/^error:Storage unavailable/);assert.match(api.failure().message,/Diary reflection could not be saved: Storage unavailable\. Study Director keeps retrying/);
  fail=false;await clock.advance(SaveLane.RETRY_DELAYS_MS[0]);await settle();
  assert.deepEqual(writes,['keep this draft','keep this draft']);assert.equal(api.failure(),null);assert.equal(states.at(-1),'saved');
}
{ // A failed older write never replaces a newer queued value.
  let rejectFirst;const writes=[],{api}=lane(value=>{writes.push(value);return value==='old'?new Promise((_,reject)=>{rejectFirst=reject;}):Promise.resolve();});
  api.schedule('old');const first=api.flush();const failed=assert.rejects(first,/old failed/);await settle();
  api.schedule('new');const newer=api.flush();rejectFirst(new Error('old failed'));await failed;await newer;await api.flush();
  assert.deepEqual(writes,['old','new']);
}
{ // Retries back off, and cancel drops what is pending.
  const attempts=[],{api}=lane(async()=>{attempts.push(clock.now());throw new Error('down');});
  api.schedule('x');await api.flush().catch(()=>{});
  for(const delay of SaveLane.RETRY_DELAYS_MS.slice(0,3)){await clock.advance(delay);await settle();}
  assert.equal(attempts.length,4,'each retry waits longer');
  api.cancel();await clock.advance(120000);await settle();assert.equal(attempts.length,4,'a cancelled lane stops retrying');
}
{ // Editors that group keystrokes publish before any lane writes.
  const order=[],{api}=lane(async value=>{order.push(`write:${value}`);});
  SaveLane.onBeforeFlush(()=>{order.push('publish');api.schedule('published');});
  api.schedule('typed');await api.flush();
  assert.deepEqual(order,['publish','write:published'],'the published value is written');
}
console.log(JSON.stringify({status:'PASS',suite:'save-lane',debouncedLatestValue:true,retryRetainsValue:true,newerValueWins:true,backoffAndCancel:true,editorsPublishFirst:true}));
