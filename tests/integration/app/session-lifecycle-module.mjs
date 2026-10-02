import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'../../..');
const read=relative=>fs.readFileSync(path.join(ROOT,relative),'utf8');
for(const file of ['source/core/internal.js','source/core/session-lifecycle.js']){
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
const asyncTransition=coordinator.run('imported-area-notes',{date:'2026-08-05'},async()=>{
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
assert.equal(events.some(event=>event==='reconcile:imported-area-notes:imported'),false,'superseded async transition must not reconcile');
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
assert.ok(events.includes('reconcile:failing-transition:null'));
assert.ok(events.includes('complete:failing-transition:failed'));

console.log(JSON.stringify({
  status:'PASS',
  module:'source/core/session-lifecycle.js',
  finalRevision:coordinator.revision,
  supersessionProtected:true,
  eventCount:events.length
},null,2));
