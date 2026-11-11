import assert from 'node:assert/strict';
import {readScript} from '../../../build/source-script.mts';
import vm from 'node:vm';
for(const file of ['source/core/internal.ts','source/core/session-host.ts'])vm.runInThisContext(readScript(file),{filename:file});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const module=registry.require('session-host',1);
assert.equal(module.format,'study-director.session-host-module');
let now=1_800_000_000_000;
let timerId=0;const timers=new Map();
const runTimers=async()=>{const pending=[...timers.values()];timers.clear();for(const fn of pending)fn();await Promise.resolve();await Promise.resolve();};
const tasks=[{id:'a',start:'08:00',dur:60,name:'A',kind:'work',area:'X',measure:'pages',target:10},{id:'b',start:'09:00',dur:30,name:'B',kind:'support',area:'Y',measure:'block',target:1}];
const fields=new Map();const resolved=new Map();
const taskState={
  getField(i,k){return fields.get(`${i}:${k}`)},setField(i,k,v){fields.set(`${i}:${k}`,v);return true},deleteField(){return true},indexSnapshot(){return{}},resolvedState(i){return resolved.get(i)||null},setResolved(i,v){if(v)resolved.set(i,v);else resolved.delete(i);return true},isDone(i){return resolved.get(i)==='done'},isSkipped(i){return resolved.get(i)==='skipped'},isResolved(i){return resolved.has(i)},toggleDone(){return'done'},resolvedIndices(){return[]},indices(){return[]},clear(){fields.clear();resolved.clear()}
};
const timerState={contentRevision:3,savedRevision:1,adjustedSchedule:{},pendingRestore:null,currentIndex:0,projectSessionSnapshot(input){return structuredClone({...input,currentTaskId:tasks[this.currentIndex]?.id||null,contentRevision:this.contentRevision,savedRevision:this.savedRevision,scheduleAdjustments:{}})}};
let repoValue=null,revision=10,saveMode='idb',lastSaveOptions=null,clearMode='idb';
const result=value=>({ok:true,value,error:null,storage:{local:false,idb:true}});
const repo={
 async save(value,options={}){lastSaveOptions=options;repoValue=structuredClone(value);if(saveMode==='local')return {ok:true,value:structuredClone(value),error:new Error('idb unavailable'),storage:{local:true,idb:false}};return result(structuredClone(value));},
 async load(){return repoValue?result(structuredClone(repoValue)):{ok:true,value:null,error:null,storage:{local:false,idb:false}}},
 async clear(){repoValue=null;return clearMode==='idb'?{ok:true,value:null,error:null,storage:{local:false,idb:true}}:{ok:true,value:null,error:new Error('delete failed'),storage:{local:true,idb:false}}},
 readLocal(){return repoValue?structuredClone(repoValue):null},nextRevision(seed=0){return ++revision+Number(seed)*0},settled(){return Promise.resolve()}
};
let appliedText='08:00 | 60 | A | work | X | pages | 10\n09:00 | 30 | B | support | Y | block | 1';
let planDraft='independent draft';let studyDate='2026-11-10';let carry='carry';let practice={active:null,runs:[]};let review={reflection:'r',studyQuality:4};let resetCount=0,applyCount=0,marked=0,warnings=[],recovery=false,blocked=false,recoveryWork=false,timerEligible=true;
const input={
 configuration:{activeSessionId:'active',activeSessionVersion:6,sessionSnapshotVersion:6,maxCarryForwardChars:100,maxScheduleChars:5000,maxTasksPerDay:200,debounceMs:1000,timerSnapshotIntervalMs:60000,completionNone:'none',practicePauseCauses:{session:'session',gap:'gap',main:'main'}},
 codec:{sanitizeCurrent(v){return v&&v.id==='active'&&v.snapshot?structuredClone(v):null},sanitizeSessionSnapshot(v,date,fingerprint,rev){return v&&v.date===date&&v.fingerprint===fingerprint?structuredClone(v):null}},
 repository:repo,canonical:{same:(a,b)=>JSON.stringify(a)===JSON.stringify(b)},
 snapshot:{tasks:()=>tasks,ensureTaskIds(){},taskIdentity:{idAt:i=>tasks[i]?.id||null,indexMap:()=>new Map(tasks.map((t,i)=>[t.id,i])),indexForId:(id,map)=>map?.get(String(id))??null},taskState,timerState,captureEvidence:()=>({actualTime:{'0':42},actualRecords:{},taskEvidence:{}}),timerPayload:()=>null,reviewSnapshot:()=>review,practiceSnapshot:()=>practice,practiceRestore:v=>{practice=v||{active:null,runs:[]}},getReviewDate:()=>studyDate,scheduleFingerprint:()=>`fp:${appliedText}`,sessionFingerprint:s=>`fp:${s.scheduleText}`,appliedScheduleText:()=>appliedText,getCarryForward:()=>carry,setCarryForward:v=>{carry=v},clearProgress:()=>taskState.clear(),sanitizeAdjustedSchedule:v=>v,invalidateScheduleDerived(){},setCurrentTask:i=>{timerState.currentIndex=i},timerRestoreValid:()=>false},
 domain:{normalizeCompletionSource:v=>['manual','time','units','skipped'].includes(v)?v:'none',clampCompletion:v=>Math.max(0,Math.min(100,Number(v)||0)),cleanDayRevision:v=>Math.max(0,Math.round(Number(v)||0)),clampText:(v,max)=>String(v??'').slice(0,max),isCanonicalScheduleText:v=>String(v).trim().length>0,isValidIsoDate:v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v)),todayISO:()=>studyDate},
 persistence:{canMutate:()=>true,recoveryQuiesced:()=>recovery,persistenceBlocked:()=>blocked,recoveryWorkActive:()=>recoveryWork,timerSnapshotEligible:()=>timerEligible,markContentChanged:()=>{marked++},snapshotForWrite:()=>controller.captureSnapshot(),reportResult(){},warn:m=>warnings.push(m)},
 lifecycle:{async run(_k,_o,op){return op()},runSync(_k,_o,op){return op()}},
 apply:{readPlanDraft:()=>planDraft,writePlanDraft:v=>{planDraft=v},previewPlanDraft(){},setStudyDate:d=>{studyDate=d},applySessionSchedule({snapshot,scheduleText}){applyCount++;appliedText=scheduleText;controller.applySnapshot(snapshot);return true}},
 reset:{stopTimerPresentation(){},invalidatePresentation(){},resetCountdown(){},setCurrentTask:i=>{timerState.currentIndex=i},resetBreak(){},setEmptyTimerMode(){},clearTimerSession(){timerState.contentRevision=0;timerState.savedRevision=0},hydrateReview(){review={reflection:'',studyQuality:null}},invalidateSchedule(){},resetPlanSession(){resetCount++},clearProgress:()=>taskState.clear(),clearCarryForward:()=>{carry=''},resetPractice:()=>{practice={active:null,runs:[]}},pausePracticeForSessionEnd(){if(practice?.active)practice={...practice,active:{...practice.active,pauseCause:'session'}}}},
 installation:{id:()=> 'device-1'},clock:{nowMs:()=>now,nowIso:()=>new Date(now).toISOString()},environment:{clearTimeout:id=>timers.delete(id),setTimeout(fn){const id=++timerId;timers.set(id,fn);return id}}
};
const controller=module.createController(input);
fields.set('0:completion',75);fields.set('0:completionSource','manual');resolved.set(1,'skipped');
const snap=controller.captureSnapshot();assert.equal(snap.taskState.a.completion,75);assert.equal(snap.taskState.b.resolvedState,'skipped');assert.equal(snap.taskState.a.actual.seconds,42);
// Plan draft is independent of the canonical session schedule.
const canonical=controller.payload(snap);planDraft='different draft';controller.applyStoredSession(canonical,canonical.snapshot,{lifecycleManaged:true});assert.equal(planDraft,'different draft');assert.equal(appliedText,canonical.scheduleText);
// Reload-style local recovery must reconstruct task state without replacing the independently edited Plan draft.
fields.clear();resolved.clear();carry='';repoValue=structuredClone(canonical);planDraft='draft survives reload';
assert.equal(controller.restoreLocalRecovery(),true);assert.equal(fields.get('0:completion'),75);assert.equal(resolved.get(1),'skipped');assert.equal(carry,'carry');assert.equal(planDraft,'draft survives reload');
// Queued strict durability is not discarded by a later ordinary save request.
controller.saveLiveDraft({strictDurability:true,markChanged:false});controller.saveLiveDraft();await runTimers();assert.equal(lastSaveOptions.strictDurability,true);assert.ok(marked>0);
// Periodic checkpoints wait through managed recovery and run immediately after the interval is eligible.
now+=60000;recoveryWork=true;assert.equal(controller.maybeSnapshotRunningTimer(),false);recoveryWork=false;assert.equal(controller.maybeSnapshotRunningTimer(),true);await Promise.resolve();
// A local recovery envelope is not a canonical completion barrier.
saveMode='local';await assert.rejects(()=>controller.writeCanonicalNow('finishing today'),/idb unavailable|durably committed/);saveMode='idb';
// Failed suspension must restore both runtime Practice state and a recoverable active snapshot.
practice={active:{taskId:'a',pauseCause:null,currentMs:12000},runs:[]};
const preSuspend=structuredClone(practice),preSuspendSnapshot=controller.captureSnapshot();
saveMode='local';
await assert.rejects(()=>controller.suspendLocal(),/idb unavailable|durably committed/);
assert.deepEqual(practice,preSuspend);assert.equal(repoValue.status,'active');assert.deepEqual(repoValue.snapshot,preSuspendSnapshot);assert.equal(planDraft,'draft survives reload');
saveMode='idb';
// Suspension is canonical before runtime reset, and restore is canonical active before apply.
const suspended=await controller.suspendLocal();assert.equal(suspended.status,'suspended');assert.ok(resetCount>0);assert.equal(repoValue.status,'suspended');
const priorApply=applyCount;const restored=await controller.restoreSuspendedLocal(suspended);assert.equal(restored.status,'active');assert.equal(repoValue.status,'active');assert.ok(applyCount>priorApply);assert.equal(planDraft,'draft survives reload');
// Reset requires a physical canonical clear and verified null readback; a rejected clear must re-establish the pre-reset recovery session.
await controller.resetLocal();assert.equal(repoValue,null);
const preReset=controller.captureSnapshot();repoValue=controller.payload(preReset);clearMode='local';
await assert.rejects(()=>controller.resetLocal(),/delete failed|not durably cleared/);
assert.equal(repoValue.status,'active');assert.deepEqual(repoValue.snapshot,preReset);
console.log(JSON.stringify({status:'PASS',suite:'recovery-timer-snapshot',checks:['snapshot-roundtrip','reload-recovery','draft-independence','strict-option-merge','recovery-snapshot-gate','canonical-fail-closed','suspend-failure-rollback','suspend-restore','reset-clear','reset-failure-rollback']}));
