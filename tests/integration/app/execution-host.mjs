import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readScript} from '../../../build/source-script.mts';
for(const file of ['internal','domain','timer-state','execution-host','execution-views'])vm.runInThisContext(readScript(`source/core/${file}.ts`),{filename:file});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const domain=registry.require('domain',1,Object.freeze({maxAreaNameChars:100,maxDurationMinutes:1440,maxScheduleChars:10000,maxScheduleRows:100,maxTaskNameChars:100,maxTasksPerDay:100,maxUnitChars:50}));
const {ScheduleModel:model,TimeModel:time}=domain,owner=registry.require('execution-host',1);
const state=registry.require('timer-state',1).createStateController(Object.freeze({helpers:Object.freeze({makeTaskId:domain.makeTaskId}),diagnostics:Object.freeze({capture(){}}),effects:Object.freeze({modeChanged(){}})}));
const tasks=state.tasks,fields=owner.createTaskSessionState(state.taskIdentity);
const schedule=owner.createExecutionSchedule({tasks,timerState:state,taskSessionState:fields,model,time,compactAdjustedSchedule:value=>value,invalidateDerived(){}});
let carry='Keep unfinished evidence',links=new Map(),pauseCalls=0,starts=0;
const runtime={...schedule,TASKS:tasks,TimerState:state,TaskSessionState:fields,TaskIdentity:state.taskIdentity,TIMER_MODES:state.modes,
  setCurrentTask:index=>{state.currentIndex=index;},setTimerMode:state.setMode,resetCountdownRuntime(){},clearProgressRuntime:fields.clear,isTaskResolved:fields.isResolved,
  PracticePacerModel:{PRACTICE_PAUSE_CAUSES:{MAIN:'main'}},PracticePacer:{status:()=>({active:null,runs:[]}),pauseFromMain(){pauseCalls++;},snapshot:()=>({active:null,runs:[{taskId:state.taskIdentity.idAt(0)}]}),remapTaskLinks:map=>{links=map;return map.size;}},
  TimerEngine:{currentTimerActiveSeconds:()=>0,recordCurrentActiveToTask(){},startCur(){starts++;},toggleDone(){},jumpTo(){},resolveActivePauseBeforeTimerSwitch:()=>true}
};
const date='2026-11-13',row=(name,area,target)=>({start:'08:00',dur:40,name,kind:'work',area,measure:'pages',target});
const original=[row('Read A','Area A',10),{...row('Read B','Area B',5),start:'08:40'}];
state.loadSchedule(model.buildTasks(original),{studyDate:date});schedule.resetScheduleLayers();
fields.setField(0,'notes',{done:4,total:10});fields.setField(0,'completion',40);fields.setField(0,'completionSource','units');fields.setField(0,'actualTime',300);fields.setField(0,'actualClock',{startedAt:'2026-11-13T08:00:00Z'});fields.setResolved(1,'skipped');
const oldId=state.taskIdentity.idAt(0);
const gateway=owner.createScheduleGateway({runtime,document:{getElementById:()=>null},ScheduleDerivedState:{renderDirty:true},APP_LIMITS:{maxCarryForwardChars:5000},completionSources:domain.COMPLETION_SOURCES,
  getCarryForward:()=>carry,setCarryForward:value=>{carry=value;},taskAreaKey:model.areaKey,taskMeasureValue:model.measureValue,taskTargetValue:model.targetValue,isTrackableBlock:model.isTrackable,clampText:value=>String(value),normalizeCompletionSource:domain.CompletionModel.normalizeSource,makeTaskId:domain.makeTaskId,
  isLiveTrackableTimer:()=>false,saveNote(){},captureReviewInputs(){},syncUnfinishedNoteDraft(){},getReviewDate:()=>date,showEmpty(){},refreshCoreUi(){},showDone(){},isValidIsoDate:time.isValidIsoDate,todayISO:()=>date,buildTasks:model.buildTasks,isValidHHMM:time.isValidHHMM,clockMinuteToStudyMinute:time.clockMinuteToStudyMinute,t2m:time.clockToMinute,
  invalidateScheduleDerived(){},applySessionSnapshot(){throw new Error('progress replacement must not restore a stale session');},restoreLiveDraftIfAny(){throw new Error('progress replacement must not restore local rescue');},restoreTimerRuntimeIfAny:()=>false,clearFutureUntouchedProgress(){},flushLiveDraft(){},scheduleFingerprint:()=>'',writeLiveDraftNow(){},advanceTaskNoteScheduleRevision(){},markDayContentChanged(){},clearSessionSafetyMessage(){},SessionLifecycle:{run:async(_source,_options,operation)=>operation(),runSync:(_source,_options,operation)=>operation(),reconcile:()=>true}
});
const replacement=[{...original[1],start:'08:00'},{...original[0],name:'Read A revised',target:20,start:'08:40'}];
const captured=gateway.captureMigration(replacement);assert.equal(captured.preview.matched,2);assert.equal(pauseCalls,1);
const applied=await gateway.apply(replacement,{progressMigration:captured,reviewOnly:true});
assert.equal(applied.migrationSummary.matched,2);assert.equal(applied.migrationSummary.areaMatched,1);
assert.equal(fields.getField(1,'completion'),20,'new target recalculates preserved unit progress');assert.deepEqual(fields.getField(1,'notes'),{done:4});
assert.equal(fields.getField(1,'actualTime'),300);assert.equal(fields.getField(1,'actualClock').startedAt,'2026-11-13T08:00:00Z');
assert.equal(fields.isSkipped(0),true);assert.equal(carry,'Keep unfinished evidence');assert.equal(links.get(oldId),state.taskIdentity.idAt(1));assert.equal(starts,0,'review-only recovery never starts a timer');
const ambiguous=gateway.captureMigration([row('Unrelated','Area A',20),row('Other','Area A',20)]);
assert.equal(ambiguous.preview.matched,0,'duplicate fallback areas must not guess where evidence belongs');

// Test actual recovery planning against the same typed schedule/state owner.
const recovery=registry.require('execution-views',1).createController({runtime,actions:{},state:{},cache:{},document:{getElementById:()=>null},STUDY_DAY_MINUTES:1440,APP_LIMITS:{maxCarryForwardChars:5000},isTrackableBlock:model.isTrackable});
const shift=recovery.deriveRecoveryShiftPlan(0,1390);
assert.equal(shift.adjustments.length,1);assert.equal(shift.adjustments[0].idx,1);assert.deepEqual(shift.overflow,[]);
fields.setResolved(0,null);
const bounded=recovery.deriveRecoveryShiftPlan(0,1390);assert.equal(bounded.adjustments.length,1);assert.deepEqual(bounded.overflow,[1]);
assert.ok(bounded.adjustments.every(item=>item.endMin<=1440),'recovery never schedules focus beyond the study-day boundary');
console.log(JSON.stringify({status:'PASS',suite:'execution-host',progressPreserved:true,ambiguousMatchRejected:true,practiceLinksRemapped:true,reviewOnlyNoTimer:true,recoveryBounded:true}));
