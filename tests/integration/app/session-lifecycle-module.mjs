import {readScript} from '../../../build/source-script.mts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'../../..');
const read=relative=>readScript(path.join(ROOT,relative));
for(const file of ['source/core/internal.ts','source/core/session-lifecycle.ts','source/core/session-actions.ts','source/core/review-host.ts']){
  vm.runInThisContext(read(file),{filename:file});
}
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const LifecycleModule=registry.require('session-lifecycle',1);
const SessionActions=registry.require('session-actions',1);
const ReviewHost=registry.require('review-host',1);
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

// A guarded transition must stop before prepare if the user intent changes
// while Review is flushing. The existing Review binding/readiness is retained.
{
  const events=[];let release,valid=true;
  const gate=new Promise(resolve=>{release=resolve;});
  const subject=LifecycleModule.createCoordinator(Object.freeze({hooks:Object.freeze({
    canMutate:()=>true,flushPending:()=>{events.push('flush');return gate;},
    prepare:()=>events.push('prepare'),reconcile:()=>events.push('reconcile'),
    complete:()=>events.push('complete'),capture:()=>{}
  })}));
  subject.reconcile('initial');events.length=0;
  const prior=subject.status();
  const pending=subject.run('schedule-apply',{},()=>{events.push('mutate');return true;},{current:()=>valid,cancelled:false});
  valid=false;release();
  assert.equal(await pending,false);
  assert.deepEqual(events,['flush']);assert.deepEqual(subject.status(),prior);
}

// A final evidence checkpoint can refuse the replacement before old editor
// invalidation, just as an obsolete intent can.
{
  const events=[];
  const subject=LifecycleModule.createCoordinator(Object.freeze({hooks:Object.freeze({
    canMutate:()=>true,flushPending:()=>events.push('flush'),
    prepare:()=>events.push('prepare'),reconcile:()=>events.push('reconcile'),
    complete:()=>events.push('complete'),capture:()=>{}
  })}));
  subject.reconcile('initial');events.length=0;
  const prior=subject.status();
  const outcome=await subject.run('schedule-apply',{},()=>{events.push('mutate');return true;},{current:()=>true,beforeStart:()=>{events.push('checkpoint');return false;},cancelled:false});
  assert.equal(outcome,false);assert.deepEqual(events,['flush','checkpoint']);assert.deepEqual(subject.status(),prior);
}

// Recovery-owned note lifecycle transitions may checkpoint the pending Review
// through recovery quiescence; unrelated lifecycle transitions may not.
{
  const forwarded=[];
  const reviewHooks=ReviewHost.createLifecycleHooks(Object.freeze({
    canMutate:()=>true,
    reviewEditor:Object.freeze({flushPending:options=>{forwarded.push(options);return true;}}),
    lifecycleViews:Object.freeze({invalidateLifecycleEditors:()=>true,reconcileLifecycleEditors:()=>true,completeLifecycleTransition:()=>true}),
    diagnostics:Object.freeze({capture:()=>null})
  }));
  await reviewHooks.flushPending('reconciled-notes',Object.freeze({allowDuringRecoveryQuiescence:true}));
  await reviewHooks.flushPending('restored-notes-snapshot',Object.freeze({allowDuringRecoveryQuiescence:true}));
  await reviewHooks.flushPending('date-change',Object.freeze({allowDuringRecoveryQuiescence:true}));
  await reviewHooks.flushPending('restore-journal-rollback',Object.freeze({recoverySessionCheckpointed:true}));
  await reviewHooks.flushPending('restore-journal-rollback',Object.freeze({}));
  assert.deepEqual(forwarded,[
    {strict:true,allowDuringRecoveryQuiescence:true},
    {strict:true,allowDuringRecoveryQuiescence:true},
    {strict:true,allowDuringRecoveryQuiescence:false},
    {strict:true,allowDuringRecoveryQuiescence:false}
  ],'only recovery-owned note transitions may pierce quiescence, and only a proven recovery checkpoint may skip the redundant session write');
}

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

// Supersession can also occur while reconciliation is settling, after the
// operation itself succeeded. Its late completion cannot reopen the old session
// or replace the completion/readiness of a successor.
for(const successor of ['invalidated','active','completed']){
  let releaseReconcile,enteredReconcile,releaseSuccessor;
  const gate=new Promise(resolve=>{releaseReconcile=resolve;});
  const entered=new Promise(resolve=>{enteredReconcile=resolve;});
  const successorGate=new Promise(resolve=>{releaseSuccessor=resolve;});
  const completions=[];
  const subject=LifecycleModule.createCoordinator(Object.freeze({hooks:Object.freeze({
    canMutate:()=>true,flushPending:()=>{},prepare:()=>{},capture:()=>{},
    reconcile:ctx=>{if(ctx.kind==='old'){enteredReconcile();return gate;}},
    complete:ctx=>completions.push(ctx.kind)
  })}));
  const old=subject.run('old',{},()=> 'old result');await entered;
  subject.invalidate('ownership-loss');
  let next;
  if(successor==='active'){
    next=subject.run('successor',{},()=>successorGate);
    await Promise.resolve();await Promise.resolve();
    assert.equal(subject.status().active.kind,'successor');
  }else if(successor==='completed')subject.reconcile('successor');
  const expected=subject.status(),expectedCompletions=[...completions];
  releaseReconcile();assert.equal(await old,'old result');
  assert.deepEqual(subject.status(),expected,`late reconciliation must preserve ${successor} successor state`);
  assert.deepEqual(completions,expectedCompletions,'superseded reconciliation must not publish completion');
  if(next){releaseSuccessor();await next;assert.equal(subject.canWrite(),true);}
}

// Even a defensive failed completion that arrives with reconciled=true must
// never re-enable lifecycle-owned editors or advertise target-date readiness.
{
  const document={
    documentElement:{dataset:{}},
    querySelectorAll:()=>[],
    querySelector:()=>null,
    getElementById:()=>null
  };
  const hydrations=[];
  const views=SessionActions.createLifecycleViews(Object.freeze({
    document,NOTE_EDITOR_BINDING_VERSION:'v1',setTimeout:callback=>{callback();return 1;},
    ReviewEditor:Object.freeze({invalidateBindings:()=>true}),
    ReviewView:Object.freeze({invalidate:()=>true,refresh:()=>true,syncMode:()=>true,activate:()=>true}),
    invalidateProgressPanel:()=>true,richTextClose:async()=>true,cancelPendingLiveDraftSave:()=>true,advanceTaskNoteScheduleRevision:()=>1,
    clearTaskNoteEditorBinding:()=>true,isValidIsoDate:()=>true,getReviewDate:()=> '2026-08-04',
    refreshAllSubjectNoteFieldsFromRepository:()=>true,refreshPnote:()=>true,hydrateReviewState:options=>{hydrations.push(options);return true;},refreshLibraryNotes:()=>true,
    requestRender:()=>true,appCanMutate:()=>true,schedulePwaUpdateEvaluation:()=>true
  }));
  const reconcileContext=options=>Object.freeze({
    format:'study-director.session-lifecycle-context',contractVersion:1,id:'review-presence',kind:'app-restart-ready',revision:98,
    options:Object.freeze(options),startedAt:'2026-08-05T00:00:00.000Z'
  });
  views.reconcileLifecycleEditors(reconcileContext({date:'2026-08-05'}));
  assert.equal(Object.prototype.hasOwnProperty.call(hydrations.at(-1),'snapshotReview'),false,'a lifecycle reconcile without snapshotReview must preserve the already-hydrated Review');
  views.reconcileLifecycleEditors(reconcileContext({date:'2026-08-05',snapshotReview:null}));
  assert.equal(Object.prototype.hasOwnProperty.call(hydrations.at(-1),'snapshotReview'),true,'an explicit snapshotReview must remain authoritative');
  assert.equal(hydrations.at(-1).snapshotReview,null,'explicit null snapshotReview must still clear Review state');
  views.completeLifecycleTransition(Object.freeze({
    format:'study-director.session-lifecycle-context',contractVersion:1,id:'failed-ui',kind:'study-day-rollover',revision:99,
    options:Object.freeze({date:'2026-08-05'}),startedAt:'2026-08-05T00:00:00.000Z',
    reconciled:true,failed:true,finishedAt:'2026-08-05T00:00:01.000Z'
  }));
  assert.equal(document.documentElement.dataset.studyDirectorLifecycle,'blocked');
}

console.log(JSON.stringify({
  status:'PASS',
  module:'source/core/session-lifecycle.ts',
  finalRevision:coordinator.revision,
  supersessionProtected:true,asyncFlushFailureProtected:true,failedTransitionFailClosed:true,failedCompletionUiBlocked:true,
  eventCount:events.length
},null,2));
