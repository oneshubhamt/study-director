import {readScript} from '../../../build/source-script.mts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'../../..');
const read=relative=>readScript(path.join(ROOT,relative));
for(const file of ['source/core/internal.ts','source/core/session-lifecycle.ts']){
  vm.runInThisContext(read(file),{filename:file});
}
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const LifecycleModule=registry.require('session-lifecycle',1);
assert.equal(LifecycleModule.format,'study-director.session-lifecycle');

let mutable=true;
const events=[];
const hooks=Object.freeze({
  canMutate:()=>mutable,
  flushPending:(kind)=>events.push(`flush:${kind}`),
  prepare:ctx=>events.push(`prepare:${ctx.kind}:${ctx.revision}`),
  reconcile:(ctx,result)=>events.push(`reconcile:${ctx.kind}:${String(result)}`),
  complete:ctx=>events.push(`complete:${ctx.kind}:${ctx.failed?'failed':'ok'}`),
  capture:(scope,error,level)=>events.push(`capture:${scope}:${level}:${error?.message||error}`)
});
const coordinator=LifecycleModule.createCoordinator(Object.freeze({hooks}));
assert.equal(coordinator.revision,0);
assert.equal(coordinator.canWrite(),false);

// A mandatory pending-draft flush failure prevents the transition from starting.
const blockedEvents=[];
const blocked=LifecycleModule.createCoordinator(Object.freeze({hooks:Object.freeze({
  canMutate:()=>true,
  flushPending:()=>{blockedEvents.push('flush');throw new Error('pending reflection flush failed');},
  prepare:()=>blockedEvents.push('prepare'),reconcile:()=>true,complete:()=>true,capture:()=>false
})}));
assert.throws(()=>blocked.runSync('date-change',{},()=>true),/pending reflection flush failed/);
assert.equal(blocked.revision,0);
assert.deepEqual(blockedEvents,['flush']);

// The real Review provider is asynchronous. A rejected pending flush must
// prevent prepare/operation/reconcile exactly as a synchronous failure does.
const asyncBlockedEvents=[];
let asyncOperationCalled=false;
const asyncBlocked=LifecycleModule.createCoordinator(Object.freeze({hooks:Object.freeze({
  canMutate:()=>true,
  flushPending:async()=>{asyncBlockedEvents.push('flush');await Promise.resolve();throw new Error('pending async reflection flush failed');},
  prepare:()=>asyncBlockedEvents.push('prepare'),reconcile:()=>asyncBlockedEvents.push('reconcile'),complete:()=>asyncBlockedEvents.push('complete'),capture:()=>false
})}));
asyncBlocked.reconcile('initial-review',{date:'2026-08-04'});
const readyRevision=asyncBlocked.revision;asyncBlockedEvents.length=0;
assert.equal(asyncBlocked.canWrite(),true);
await assert.rejects(asyncBlocked.run('date-change',{},()=>{asyncOperationCalled=true;return true;}),/pending async reflection flush failed/);
assert.equal(asyncOperationCalled,false);
assert.equal(asyncBlocked.revision,readyRevision,'a rejected pre-transition flush never starts a new lifecycle revision');
assert.equal(asyncBlocked.transitioning,false);
assert.equal(asyncBlocked.canWrite(),true,'a rejected pre-transition flush preserves the valid prior lifecycle state');
assert.deepEqual(asyncBlockedEvents,['flush']);

const syncResult=coordinator.runSync('schedule-replacement',{scheduleIdentity:true},ctx=>{
  assert.equal(coordinator.transitioning,true);
  assert.equal(coordinator.canWrite(),false);
  return `revision-${ctx.revision}`;
});
assert.equal(syncResult,'revision-1');
assert.equal(coordinator.revision,1);
assert.equal(coordinator.canWrite(),true);
assert.deepEqual(events.slice(0,4),[
  'flush:schedule-replacement',
  'prepare:schedule-replacement:1',
  'reconcile:schedule-replacement:revision-1',
  'complete:schedule-replacement:ok'
]);

let releaseAsync;
const asyncGate=new Promise(resolve=>{releaseAsync=resolve;});
const asyncTransition=coordinator.run('imported-notes',{date:'2026-08-05'},async()=>{
  await asyncGate;
  return 'imported';
});
await Promise.resolve();
assert.equal(coordinator.transitioning,true);
assert.throws(()=>coordinator.runSync('competing-transition',{},()=>true),error=>error?.code==='STUDY_DIRECTOR_LIFECYCLE_BUSY');
mutable=false;
const loss=coordinator.invalidate('primary-tab-loss',{reason:'lease superseded'});
assert.equal(loss.kind,'primary-tab-loss');
assert.equal(coordinator.transitioning,false);
assert.equal(coordinator.canWrite(),false);
releaseAsync();
assert.equal(await asyncTransition,'imported');
assert.equal(events.some(event=>event==='reconcile:imported-notes:imported'),false,'superseded async transition must not reconcile');
assert.equal(coordinator.status().last.kind,'primary-tab-loss');

mutable=true;
coordinator.reconcile('ownership-primary',{date:'2026-08-05'});
assert.equal(coordinator.canWrite(),true);
assert.equal(coordinator.revision,4);

assert.throws(()=>coordinator.runSync('failing-transition',{},()=>{throw new Error('boom');}),/boom/);
const final=coordinator.status();
assert.equal(final.transitioning,false);
assert.equal(final.last.kind,'failing-transition');
assert.equal(final.last.failed,true);
assert.equal(final.last.reconciled,false);
assert.equal(coordinator.canWrite(),false,'a failed transition must not publish writable readiness');
assert.equal(events.includes('reconcile:failing-transition:null'),false,'failed transitions never reconcile target state');
assert.ok(events.includes('complete:failing-transition:failed'));

console.log(JSON.stringify({
  status:'PASS',
  module:'source/core/session-lifecycle.ts',
  finalRevision:coordinator.revision,
  supersessionProtected:true,asyncFlushFailureProtected:true,failedTransitionFailClosed:true,
  eventCount:events.length
},null,2));
