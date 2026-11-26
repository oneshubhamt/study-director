import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readScript} from '../../../build/source-script.mts';
for(const file of ['internal','domain','timer-state','execution-host','execution-views','session-lifecycle'])vm.runInThisContext(readScript(`source/core/${file}.ts`),{filename:file});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const domain=registry.require('domain',1,Object.freeze({maxAreaNameChars:100,maxDurationMinutes:1440,maxScheduleChars:10000,maxScheduleRows:100,maxTaskNameChars:100,maxTasksPerDay:100,maxUnitChars:50}));
const {ScheduleModel:model,TimeModel:time}=domain,owner=registry.require('execution-host',1);
const state=registry.require('timer-state',1).createStateController(Object.freeze({helpers:Object.freeze({makeTaskId:domain.makeTaskId}),diagnostics:Object.freeze({capture(){}}),effects:Object.freeze({modeChanged(){}})}));
const tasks=state.tasks,fields=owner.createTaskSessionState(state.taskIdentity);
const schedule=owner.createExecutionSchedule({tasks,timerState:state,taskSessionState:fields,model,time,compactAdjustedSchedule:value=>value,invalidateDerived(){}});
let carry='Keep unfinished evidence',links=new Map(),pauseCalls=0,starts=0,liveTimer=false,recordCalls=0,checkpoints=0;
const runtime={...schedule,TASKS:tasks,TimerState:state,TaskSessionState:fields,TaskIdentity:state.taskIdentity,TIMER_MODES:state.modes,
  setCurrentTask:index=>{state.currentIndex=index;},setTimerMode:state.setMode,resetCountdownRuntime(){},clearProgressRuntime:fields.clear,isTaskResolved:fields.isResolved,
  PracticePacerModel:{PRACTICE_PAUSE_CAUSES:{MAIN:'main'}},PracticePacer:{status:()=>({active:null,runs:[]}),pauseFromMain(){pauseCalls++;},snapshot:()=>({active:null,runs:[{taskId:state.taskIdentity.idAt(0)}]}),remapTaskLinks:map=>{links=map;return map.size;}},
  TimerEngine:{currentTimerActiveSeconds:()=>0,recordCurrentActiveToTask(idx){recordCalls++;fields.setField(idx,'actualTime',(fields.getField(idx,'actualTime')||0)+60);},startCur(){starts++;},toggleDone(){},jumpTo(){},resolveActivePauseBeforeTimerSwitch:()=>true}
};
const date='2026-11-13',row=(name,area,target)=>({start:'08:00',dur:40,name,kind:'work',area,measure:'pages',target});
const original=[row('Read A','Area A',10),{...row('Read B','Area B',5),start:'08:40'}];
state.loadSchedule(model.buildTasks(original),{studyDate:date});schedule.resetScheduleLayers();
fields.setField(0,'notes',{done:4,total:10});fields.setField(0,'completion',40);fields.setField(0,'completionSource','units');fields.setField(0,'actualTime',300);fields.setField(0,'actualClock',{startedAt:'2026-11-13T08:00:00Z'});fields.setResolved(1,'skipped');
const oldId=state.taskIdentity.idAt(0);
let reviewGate=null;const lifecycleEvents=[];
const lifecycle=registry.require('session-lifecycle',1).createCoordinator(Object.freeze({hooks:Object.freeze({canMutate:()=>true,flushPending:()=>reviewGate,prepare:()=>lifecycleEvents.push('prepare'),reconcile:()=>lifecycleEvents.push('reconcile'),complete:()=>lifecycleEvents.push('complete'),capture:()=>{}})}));
const gateway=owner.createScheduleGateway({runtime,document:{getElementById:()=>null},ScheduleDerivedState:{renderDirty:true},APP_LIMITS:{maxCarryForwardChars:5000},completionSources:domain.COMPLETION_SOURCES,
  getCarryForward:()=>carry,setCarryForward:value=>{carry=value;},taskAreaKey:model.areaKey,taskMeasureValue:model.measureValue,taskTargetValue:model.targetValue,isTrackableBlock:model.isTrackable,clampText:value=>String(value),normalizeCompletionSource:domain.CompletionModel.normalizeSource,makeTaskId:domain.makeTaskId,
  isLiveTrackableTimer:()=>liveTimer,saveNote(){checkpoints++;},captureReviewInputs(){},syncUnfinishedNoteDraft(){},getReviewDate:()=>date,showEmpty(){},refreshCoreUi(){},showDone(){},isValidIsoDate:time.isValidIsoDate,todayISO:()=>date,buildTasks:model.buildTasks,isValidHHMM:time.isValidHHMM,clockMinuteToStudyMinute:time.clockMinuteToStudyMinute,t2m:time.clockToMinute,
  invalidateScheduleDerived(){},applySessionSnapshot(){throw new Error('progress replacement must not restore a stale session');},restoreLiveDraftIfAny(){throw new Error('progress replacement must not restore local rescue');},restoreTimerRuntimeIfAny:()=>false,clearFutureUntouchedProgress(){},flushLiveDraft(){},scheduleFingerprint:()=>'',writeLiveDraftNow(){},advanceTaskNoteScheduleRevision(){},markDayContentChanged(){},clearSessionSafetyMessage(){},SessionLifecycle:lifecycle
});
const replacement=[{...original[1],start:'08:00'},{...original[0],name:'Read A revised',target:20,start:'08:40'}];
liveTimer=true;
const captured=gateway.captureMigration(replacement);assert.equal(captured.preview.matched,2);
assert.equal(pauseCalls,0,'preview does not pause the Pacer');
assert.equal(recordCalls,0,'preview does not close the active timer record');
assert.equal(checkpoints,0,'preview does not mutate editor input state');
let releaseReview,current=true,entered=0;
reviewGate=new Promise(resolve=>{releaseReview=resolve;});
const beforeTasks=JSON.stringify(tasks),beforeFields=fields.getField(0,'completion'),beforeEvents=[...lifecycleEvents];
const cancelled=gateway.apply(replacement,{progressMigration:captured,reviewOnly:true,current:()=>current,beforeApply:()=>entered++});
current=false;releaseReview();reviewGate=null;
assert.equal(await cancelled,false);assert.equal(entered,0);
assert.equal(JSON.stringify(tasks),beforeTasks);assert.equal(fields.getField(0,'completion'),beforeFields);
assert.deepEqual(lifecycleEvents,beforeEvents,'obsolete intent never starts the lifecycle');
assert.equal(pauseCalls,0);assert.equal(recordCalls,0);assert.equal(checkpoints,0);
reviewGate=new Promise(resolve=>{releaseReview=resolve;});
const applying=gateway.apply(replacement,{progressMigration:captured,reviewOnly:true,current:()=>true,beforeApply:()=>entered++});
// New work arrives while the actual strict Review flush is still pending.
fields.setField(0,'notes',{done:6,total:10});fields.setField(0,'completion',60);
fields.setField(0,'actualTime',480);carry='Later carry-forward evidence';
releaseReview();reviewGate=null;
const applied=await applying;liveTimer=false;
assert.equal(entered,1);assert.equal(pauseCalls,1);assert.equal(recordCalls,1);assert.equal(checkpoints,1);
assert.equal(applied.migrationSummary.matched,2);assert.equal(applied.migrationSummary.areaMatched,1);
assert.equal(fields.getField(1,'completion'),30,'new target recalculates the latest preserved unit progress');assert.deepEqual(fields.getField(1,'notes'),{done:6});
assert.equal(fields.getField(1,'actualTime'),540,'timer checkpoint and progress during flush are carried forward');assert.equal(fields.getField(1,'actualClock').startedAt,'2026-11-13T08:00:00Z');
assert.equal(fields.isSkipped(0),true);assert.equal(carry,'Later carry-forward evidence');assert.equal(links.get(oldId),state.taskIdentity.idAt(1));assert.equal(starts,0,'review-only recovery never starts a timer');
const ambiguous=gateway.captureMigration([row('Unrelated','Area A',20),row('Other','Area A',20)]);
assert.equal(ambiguous.preview.matched,0,'duplicate fallback areas must not guess where evidence belongs');

// Test actual recovery planning against the same typed schedule/state owner.
const recovery=registry.require('execution-views',1).createController({runtime,actions:{},state:{},cache:{},document:{getElementById:()=>null},STUDY_DAY_MINUTES:1440,APP_LIMITS:{maxCarryForwardChars:5000},isTrackableBlock:model.isTrackable});
const shift=recovery.deriveRecoveryShiftPlan(0,1390);
assert.equal(shift.adjustments.length,1);assert.equal(shift.adjustments[0].idx,1);assert.deepEqual(shift.overflow,[]);
fields.setResolved(0,null);
const bounded=recovery.deriveRecoveryShiftPlan(0,1390);assert.equal(bounded.adjustments.length,1);assert.deepEqual(bounded.overflow,[1]);
assert.ok(bounded.adjustments.every(item=>item.endMin<=1440),'recovery never schedules focus beyond the study-day boundary');
// New unmatched progress after consent requires a fresh decision, without
// closing the timer or invalidating Review. Check the identity, not counts.
state.loadSchedule(model.buildTasks(original),{studyDate:date});schedule.resetScheduleLayers();fields.clear();
fields.setField(0,'actualTime',120);liveTimer=true;
const onlyA=[original[0]],confirmed=gateway.captureMigration(onlyA),beforeLossPause=pauseCalls,beforeLossRecord=recordCalls;
assert.equal(confirmed.preview.matched,1);assert.equal(confirmed.preview.total,1);
reviewGate=new Promise(resolve=>{releaseReview=resolve;});
const denied=gateway.apply(onlyA,{progressMigration:confirmed,reviewOnly:true,current:()=>true});
fields.setField(1,'actualTime',90);releaseReview();reviewGate=null;
assert.equal(await denied,false);assert.equal(tasks.length,2);assert.equal(fields.getField(1,'actualTime'),90);
assert.equal(pauseCalls,beforeLossPause);assert.equal(recordCalls,beforeLossRecord);liveTimer=false;

// A duplicate source area cannot be inferred unique merely because the
// other block has no progress. Both progress and Pacer identity use all rows.
const duplicate=[row('Removed','Shared',10),{...row('Kept','Shared',10),start:'08:40'}];
state.loadSchedule(model.buildTasks(duplicate),{studyDate:date});schedule.resetScheduleLayers();fields.clear();
fields.setField(0,'actualTime',60);
const sparse=gateway.captureMigration([duplicate[1]]);
assert.equal(sparse.preview.total,1);assert.equal(sparse.preview.matched,0);
assert.equal(sparse.preview.practiceTotal,1);assert.equal(sparse.preview.practiceMatched,0);

// If the plan originally had no live evidence, a late new progress entry
// cannot turn its unconfirmed replacement into an authorized destructive one.
fields.clear();reviewGate=new Promise(resolve=>{releaseReview=resolve;});
const lateActivity=gateway.apply([duplicate[1]],{liveReplacement:{breakIdentity:null},current:()=>true,reviewOnly:true});
fields.setField(0,'actualTime',90);releaseReview();reviewGate=null;
assert.equal(await lateActivity,false);assert.equal(tasks.length,2);assert.equal(fields.getField(0,'actualTime'),90);

console.log(JSON.stringify({status:'PASS',suite:'execution-host',progressPreserved:true,ambiguousMatchRejected:true,practiceLinksRemapped:true,reviewOnlyNoTimer:true,recoveryBounded:true,guardedGatewayAdmission:true,pureMigrationPreview:true,latestProgressPreserved:true,newUnmatchedRefused:true,sourceAmbiguityRefused:true,lateActivityRefused:true}));
