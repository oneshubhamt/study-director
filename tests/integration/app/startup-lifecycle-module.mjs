import {readRuntimeSource} from '../../helpers/runtime-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'../../..');
const read=relative=>readRuntimeSource(path.join(ROOT,relative));
for(const file of ['source/core/internal.ts','source/core/startup.ts','source/core/startup-host.ts'])vm.runInThisContext(read(file),{filename:file});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const Startup=registry.require('startup-lifecycle',1);
const StartupHost=registry.require('startup-host',1);

const docListeners=new Map(),winListeners=new Map();
const document={
  readyState:'complete',hidden:false,
  addEventListener:(name,handler)=>docListeners.set(name,handler)
};
const window={addEventListener:(name,handler)=>winListeners.set(name,handler)};
const sequence=[];
const drain=async(turns=32)=>{for(let i=0;i<turns;i++)await Promise.resolve();};
const guard=(scope,operation)=>{try{return operation();}catch(error){sequence.push(`guard:${scope}:${error.message}`);return false;}};
const fn=name=>()=>{sequence.push(name);return true;};
const asyncFn=name=>async()=>{sequence.push(`${name}:begin`);await Promise.resolve();sequence.push(`${name}:end`);return true;};
let primary=true,rejectPlanFlush=false;
const activation=StartupHost.createActivation(Object.freeze({capture:(scope,error)=>sequence.push(`capture:${scope}:${error?.message||error}`)}));
activation.subscribe(event=>sequence.push(`activation:${event.kind}:${event.source}:${event.destructive?'destructive':'non-destructive'}`));
const coordinator=StartupHost.createCoordinator(Object.freeze({
  module:Startup,
  environment:Object.freeze({document,window}),
  diagnostics:Object.freeze({guard}),
  activation,
  ownership:Object.freeze({
    install:fn('ownership-install'),evaluate:asyncFn('ownership-evaluate',2),
    canMutate:()=>primary,hasControl:()=>primary,writeLease:fn('write-lease'),
    flushAndRelease:asyncFn('flush-release'),transitionReleasing:fn('transition-releasing'),
    release:fn('release'),setPrimary:value=>{primary=!!value;sequence.push(`set-primary:${primary}`);}
  }),
  timer:Object.freeze({stopPresentation:fn('timer-stop'),syncAfterWake:()=>{sequence.push('wake-reconcile');return false;}}),
  flushers:Object.freeze({
    planDraft:()=>{sequence.push('flush-plan');return rejectPlanFlush?Promise.reject(new Error('plan flush rejected')):true;},preferences:fn('flush-preferences'),activeSession:fn('flush-session'),
    notes:fn('flush-notes'),deletionRecovery:fn('flush-deletion-recovery')
  }),
  startup:Object.freeze({
    prepareCanonicalData:asyncFn('canonical-data-validation',1),restoreAppearance:fn('appearance'),bindDom:fn('bind-dom'),
    recoverInterruptedLibraryClear:asyncFn('library-clear-recovery',2),
    recoverInterruptedRestore:asyncFn('restore-recovery',2),
    loadNotes:asyncFn('notes-load',4),hydrateDrafts:fn('drafts'),previewPlan:fn('preview'),
    startClock:fn('clock'),startHeaderClock:fn('header-clock'),refreshCoreUi:fn('core-ui'),
    renderRecovery:fn('recovery'),checkBackup:fn('backup-check'),showEmptyIfNeeded:fn('empty'),
    openInitialTab:fn('initial-tab'),restoreActiveSession:asyncFn('session-restore',2),
    showNameSetup:fn('name'),inspectStorage:asyncFn('storage-inspect',1),
    reconcileLifecycle:fn('lifecycle-reconcile'),applyLaunchRoute:fn('launch-route'),verifyReady:asyncFn('canonical-verification',1),markReady:fn('startup-ready'),
    reportFailure:fn('startup-failure'),clearFailure:fn('startup-failure-clear')
  })
}));
coordinator.start();
await drain(96);
const status=coordinator.status();
assert.equal(status.fullyInitialized,true);
assert.equal(status.initializing,false);
assert.equal(status.state,'ready');
assert.equal(status.failed,false);
assert.equal(status.failedStage,'');
assert.equal(status.lastFailure,null);
const index=name=>sequence.indexOf(name);
assert.ok(index('ownership-evaluate:end')<index('canonical-data-validation:begin'));
assert.ok(index('canonical-data-validation:end')<index('library-clear-recovery:begin'));
assert.ok(index('library-clear-recovery:end')<index('restore-recovery:begin'));
assert.ok(index('restore-recovery:end')<index('notes-load:begin'));
assert.ok(index('notes-load:end')<index('session-restore:begin'));
assert.ok(index('session-restore:end')<index('lifecycle-reconcile'));
assert.ok(index('lifecycle-reconcile')<index('launch-route'));
assert.ok(index('launch-route')<index('name'));
assert.deepEqual(status.completedStages.slice(-7),['active-session-restore','lifecycle-reconcile','launch-route','name-setup','storage-inspection','canonical-verification','startup-ready']);
assert.ok(index('canonical-verification:end')<index('startup-ready'));

coordinator.flush();
assert.ok(index('flush-plan')<index('flush-preferences'));
assert.ok(index('flush-preferences')<index('flush-session'));
assert.ok(index('flush-session')<index('flush-deletion-recovery'));
assert.equal(sequence.includes('capture-notes'),false);
rejectPlanFlush=true;coordinator.flush();await drain();rejectPlanFlush=false;
assert.ok(sequence.includes('guard:lifecycle.flush-schedule:plan flush rejected'),'promise-returning lifecycle flush failures are observed instead of becoming unhandled rejections');

const focus=winListeners.get('focus');
assert.equal(typeof focus,'function');
focus();
await drain();
assert.ok(sequence.includes('wake-reconcile'));
assert.ok(sequence.includes('activation:ordinary-focus:focus:non-destructive'));
const visibility=docListeners.get('visibilitychange');
document.hidden=true;visibility();
assert.ok(sequence.includes('activation:background:visibilitychange:non-destructive'));
document.hidden=false;visibility();
await drain();
assert.ok(sequence.includes('activation:visibility-return:visibilitychange:non-destructive'));
const exit=winListeners.get('pagehide');assert.equal(typeof exit,'function');exit();
assert.ok(sequence.includes('activation:exit:page-exit:destructive'));
assert.equal(activation.kinds.OWNERSHIP_TAKEOVER,'ownership-takeover');
assert.ok(activation.status().sequence>=4,'activation contract must publish a monotone sequence');
const lastEvaluateEnd=sequence.lastIndexOf('ownership-evaluate:end');
assert.ok(lastEvaluateEnd<sequence.lastIndexOf('wake-reconcile'));


// Fatal finalization failure is explicit, non-mutating, and retryable.
const failureSequence=[],failureDocListeners=new Map(),failureWinListeners=new Map();
let failVerification=true,primary2=true,failureEvaluations=0;
const failureDocument={readyState:'complete',hidden:false,addEventListener:(name,handler)=>failureDocListeners.set(name,handler)};
const failureWindow={addEventListener:(name,handler)=>failureWinListeners.set(name,handler)};
const failureActivation=StartupHost.createActivation(Object.freeze({capture:(scope,error)=>failureSequence.push(`capture:${scope}:${error?.message||error}`)}));
const failureCoordinator=StartupHost.createCoordinator(Object.freeze({
  module:Startup,
  environment:Object.freeze({document:failureDocument,window:failureWindow}),
  diagnostics:Object.freeze({guard:(scope,operation)=>{try{return operation();}catch(error){failureSequence.push(`guard:${scope}:${error.message}`);return false;}}}),
  activation:failureActivation,
  ownership:Object.freeze({
    install:()=>true,evaluate:async()=>{failureEvaluations++;primary2=true;return true;},canMutate:()=>primary2,hasControl:()=>primary2,writeLease:()=>true,
    flushAndRelease:async()=>true,transitionReleasing:()=>true,release:()=>{failureSequence.push('release');primary2=false;return true;},
    setPrimary:value=>{primary2=!!value;failureSequence.push(`primary:${primary2}`);return primary2;}
  }),
  timer:Object.freeze({stopPresentation:()=>true,syncAfterWake:()=>true}),
  flushers:Object.freeze({planDraft:()=>true,preferences:()=>true,activeSession:()=>true,notes:()=>true,deletionRecovery:()=>true}),
  startup:Object.freeze({
    prepareCanonicalData:async()=>true,restoreAppearance:()=>true,bindDom:()=>true,recoverInterruptedLibraryClear:async()=>true,recoverInterruptedRestore:async()=>true,
    loadNotes:async()=>true,hydrateDrafts:()=>true,previewPlan:()=>true,startClock:()=>true,startHeaderClock:()=>true,refreshCoreUi:()=>true,renderRecovery:()=>true,
    checkBackup:()=>true,showEmptyIfNeeded:()=>true,openInitialTab:()=>true,restoreActiveSession:async()=>true,showNameSetup:()=>true,inspectStorage:async()=>true,
    reconcileLifecycle:()=>true,applyLaunchRoute:()=>true,
    verifyReady:async()=>{if(failVerification)throw Object.assign(new Error('canonical proof failed'),{code:'QA_CANONICAL_FAIL'});return Object.freeze({canonical:true});},
    markReady:()=>{failureSequence.push('ready');return true;},reportFailure:failure=>{failureSequence.push(`failure:${failure.stage}`);return true;},
    clearFailure:()=>{failureSequence.push('clear');return true;}
  })
}));
failureCoordinator.start();await drain(96);
let failureStatus=failureCoordinator.status();
assert.equal(failureStatus.fullyInitialized,false);
assert.equal(failureStatus.state,'failed');
assert.equal(failureStatus.failed,true);
assert.equal(failureStatus.failedStage,'canonical-verification');
assert.equal(failureStatus.lastFailure.code,'STARTUP_INITIALIZATION_FAILED');
assert.equal(failureStatus.lastFailure.causeCode,'QA_CANONICAL_FAIL','startup failure keeps a bounded internal cause code for safe presentation routing');
assert.equal(primary2,false,'fatal startup failure must relinquish mutation ownership');
const evaluationsAtFailure=failureEvaluations;failureWinListeners.get('focus')?.();await drain();
assert.equal(failureEvaluations,evaluationsAtFailure,'focus/visibility wake reconciliation must not reacquire ownership while startup is failed');
assert.equal(primary2,false);
assert.ok(failureSequence.includes('failure:canonical-verification'));
assert.equal(failureSequence.includes('ready'),false);
failVerification=false;
failureCoordinator.start();await drain(96);
failureStatus=failureCoordinator.status();
assert.equal(failureStatus.state,'ready');
assert.equal(failureStatus.fullyInitialized,true);
assert.equal(failureStatus.failed,false);
assert.equal(failureStatus.failedStage,'');
assert.equal(failureStatus.lastFailure,null);
assert.ok(failureSequence.includes('ready'),'a later start() must retry and publish readiness after the fault clears');

console.log(JSON.stringify({
  status:'PASS',
  module:'source/core/startup.ts',
  completedStages:status.completedStages.length,
  startupOrdering:true,
  wakeOrdering:true,
  activationContract:true
},null,2));

// The checked hydration adapter isolates failures and keeps the successful
// half visible; fail-closed takeover must still reject either failure.
for(const failed of ['plan','preferences','none']){
 const calls=[],quote={value:''};
 const hydrate=StartupHost.createDraftHydration({document:{querySelector:()=>quote},
  hydratePlan:async()=>{calls.push('plan');if(failed==='plan')throw new Error('plan failed');},
  hydratePreferences:async options=>{assert.equal(options.force,true);calls.push('preferences');if(failed==='preferences')throw new Error('preferences failed');},
  capture:()=>{},markStorageError:()=>{},projectPlan:options=>calls.push(options?.fallback?'fallback':'project'),renderSavedPlans:()=>calls.push('library'),quote:()=> 'Quote',quoteChanged:()=>calls.push('quote')
 });
 const attempt=hydrate({forcePreferences:true,failClosed:true});
 if(failed==='none')assert.equal(await attempt,true);else await assert.rejects(attempt,new RegExp(failed+' failed'));
 assert.deepEqual(calls.slice(0,2),['plan','preferences']);
 assert.equal(calls.includes('fallback'),failed==='plan');assert.equal(calls.includes('library'),failed!=='plan');assert.equal(quote.value,failed==='preferences'?'':'Quote');
}
const wakeCalls=[];let quiesced=true;
const wake=StartupHost.createWake({quiesced:()=>quiesced,sync:()=>wakeCalls.push('sync')});
assert.equal(wake(),false);quiesced=false;wake();assert.deepEqual(wakeCalls,['sync']);
