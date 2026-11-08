import type {PracticeRun} from '../../types/record-models.ts';
import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {TaskKind,TaskInput,TaskOutcome} from '../../types/domain.ts';
import type {DailyTaskView,DailyInput,ActiveInput,PendingReviewInput,Limits,PauseEvent,RealTimeSnapshot,TimerPayload,Adjustment,DailyResult,StoredSchedule,DailyRecord,NoteRecord,NoteFields,AreaSummary,ClockRecord,ActualRecord,SessionTaskState,SessionSnapshot,ActiveSession,PersonalPreferences,SavedPlans,PersonalData,PendingReview,ReviewSubject} from '../../types/record-models.ts';
// Raw property inspection carries unknown values until existing validators narrow them.
type RawFields=Partial<Record<'keptFrom'|'keptChangedAt'|'practiceCueMode'|'presentation'|'studentName'|'theme'|'fontScale'|'practiceTargetMs'|'ActiveSession'|'COMPLETION_SOURCES'|'CompletionModel'|'DailyRecord'|'DailySummary'|'FINISHED_UNVERIFIED'|'FULL'|'MAX_SAFE_INTEGER'|'NONE'|'Note'|'PARTIAL'|'PAUSED'|'PendingReview'|'RUNNING'|'SKIPPED'|'SessionSnapshot'|'ZERO_OUTPUT'|'abs'|'active'|'activeBreak'|'activeSeconds'|'activeSessionCodec'|'activeSessionId'|'activityBlocks'|'actual'|'actualEnd'|'actualFocusMinutes'|'actualSeconds'|'actualStart'|'actualStartLocalMinute'|'actualStartTimeZone'|'actualStartUtcOffsetMinutes'|'actualTrackedMinutes'|'add'|'adjustedStart'|'area'|'areaSummary'|'areaValue'|'averageBlockCompletion'|'base'|'breakMinutes'|'byId'|'call'|'capturedAt'|'carryForwardDraft'|'changedAt'|'clampPercent'|'classify'|'clean'|'clock'|'clockMinuteToStudyMinute'|'clockToMinute'|'commonExpected'|'compactPauseEvents'|'completed'|'completedEquivalentMinutes'|'completedMinutes'|'completion'|'completionPercent'|'completionSource'|'contentRevision'|'contracts'|'count'|'create'|'createdAt'|'cueIssuedAt'|'currentIdx'|'currentName'|'currentTaskId'|'daily'|'dailyRecordCodec'|'dataContract'|'date'|'dayName'|'dayOfWeek'|'defaultBreakSeconds'|'defaultId'|'define'|'delete'|'derivedMetrics'|'detectedAtMs'|'displayArea'|'doc'|'domain'|'done'|'doneFlag'|'doneNotified'|'draft'|'driftKind'|'driftLabel'|'driftMinutes'|'dur'|'duration'|'durationSec'|'enabled'|'encode'|'endMin'|'endedAt'|'enteredTotal'|'entries'|'entry'|'every'|'filter'|'find'|'fingerprint'|'firstStartedAt'|'for'|'forEach'|'format'|'freeze'|'gapMs'|'get'|'has'|'hasAdjustment'|'hasOwn'|'hasOwnProperty'|'hasReflection'|'helpers'|'id'|'includes'|'internal'|'internalModules'|'isArray'|'isFinite'|'isFrozen'|'isId'|'isInteger'|'isKey'|'isSafeInteger'|'isTrackable'|'isTrash'|'isValidHHMM'|'isValidIsoDate'|'isWork'|'join'|'js'|'kept'|'keptAt'|'key'|'keyedRecord'|'keys'|'kind'|'label'|'lastEndedAt'|'lastMs'|'lastStartedAt'|'lastTickMs'|'latestCarryForward'|'length'|'limits'|'links'|'localeCompare'|'map'|'match'|'max'|'maxAreaNameChars'|'maxCarryForwardChars'|'maxDurationMinutes'|'maxLiveSessionsPerTask'|'maxNoteChars'|'maxNoteLinks'|'maxNotes'|'maxPauseEventsPerTask'|'maxPracticeRunsPerDay'|'maxPracticeUnitsPerRun'|'maxQuoteChars'|'maxReflectionChars'|'maxScheduleChars'|'maxStudentNameChars'|'maxTaskNameChars'|'maxTasksPerDay'|'maxUnitChars'|'measure'|'min'|'minSupportedSavedDate'|'mode'|'modes'|'name'|'next'|'normalize'|'normalizeArea'|'normalizeHHMM'|'normalizeKind'|'normalizeSource'|'noteKeys'|'nudge'|'nudgeAfter'|'nudgeCycle'|'open'|'originalPlannedStudyMinutes'|'outcomeCounts'|'overtimeNotified'|'padStart'|'parse'|'parseProgressNumber'|'pauseCount'|'pauseEvents'|'paused'|'pausedSeconds'|'pausedStartedMs'|'pending'|'pendingInactiveGap'|'personalDataCodec'|'planned'|'plannedMinutes'|'plannedSeconds'|'plans'|'practice'|'practiceRuns'|'preferences'|'progress'|'promptMs'|'prototype'|'push'|'quote'|'randomBytes'|'realTimeSnapshot'|'reason'|'record'|'recordKind'|'recordedSec'|'reduce'|'ref'|'reflection'|'resolvedAt'|'resolvedState'|'result'|'results'|'review'|'revision'|'round'|'row'|'runningOn'|'runs'|'sanitizeCounts'|'sanitizeCurrent'|'sanitizeCurrentDailyRecord'|'sanitizeNoteFields'|'sanitizeTimerRuntimePayload'|'savedAt'|'savedPlans'|'savedRevision'|'schedule'|'scheduleAdjustments'|'scheduleShifts'|'scheduleText'|'scheduledIdx'|'scheduledKind'|'scheduledName'|'schemas'|'seconds'|'sessionCount'|'sessions'|'set'|'shiftedStudyBlocks'|'size'|'skipped'|'sleepPausedMs'|'slice'|'snapshot'|'some'|'sort'|'sound'|'soundMode'|'source'|'sourceRevision'|'start'|'startMin'|'startMs'|'startSec'|'startedAt'|'startedAtLocalMinute'|'startedAtMs'|'startedAtTimeZone'|'startedAtUtcOffsetMinutes'|'startsWith'|'status'|'stringify'|'studyMinuteToHHMM'|'studyQuality'|'subject'|'summaryVersion'|'suspendedAt'|'target'|'taskId'|'taskState'|'tasks'|'test'|'text'|'textFromRows'|'timer'|'timerRuntime'|'timerState'|'timestamps'|'toISOString'|'toLowerCase'|'toString'|'total'|'totalPausedMs'|'trashKeyPrefix'|'trim'|'type'|'updatedAt'|'v1'|'value'|'values'|'version'|'weightedCompletion',unknown>>;
const sdRecordCodecsFactory=(()=>{
'use strict';
const registry=(globalThis as typeof globalThis & {[key:symbol]:ModuleRegistration<'record-codecs','study-director.record-codecs'>|undefined})[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,functionPort:functions}=registry.contracts;
const createModule=()=>{
  const freeze=Object.freeze;
  function createDailyRecordCodec(input:DailyInput){
    exactObject(input,['limits','dataContract','domain','keyedRecord','helpers','timestamps','timer'],'Daily-record codec input');
    if(!Object.isFrozen(input.limits)||!Object.isFrozen(input.dataContract)||!Object.isFrozen(input.domain)||!Object.isFrozen(input.keyedRecord)){
      throw new TypeError('Daily-record codec contracts must be frozen.');
    }
    functions(input.helpers,[
      'boundedInt','boundedNumber','clampText','clampEditorContent','editorContentWithinLimits','optionalBoundedNumber','optionalText',
      'safeBoolean','sameDataValue','normalizeStudyQuality','todayISO','dateInsightsMeta',
      'sanitizePracticeRun'
    ],'Daily-record codec helpers');
    functions(input.timestamps,['normalizeTimestamp','normalizeImportedTimestamp','normalizeImportedEpochMillis'],'Daily-record timestamp contract');
    exactObject(input.timer,['modes','defaultBreakSeconds'],'Daily-record timer contract');
    exactObject(input.timer.modes,['PAUSED','RUNNING'],'Daily-record timer modes');
    if(typeof input.timer.defaultBreakSeconds!=='function')throw new TypeError('Daily-record default break provider is invalid.');
    const APP_LIMITS=input.limits;
    const DATA_CONTRACT=input.dataContract;
    const KeyedRecord=input.keyedRecord;
    const {
      TimeModel,ScheduleModel,CompletionModel,OutcomeModel,COMPLETION_SOURCES,TASK_OUTCOMES
    }=input.domain;
    const {
      boundedInt,boundedNumber,clampText,clampEditorContent,editorContentWithinLimits,optionalBoundedNumber,optionalText,safeBoolean,
      sameDataValue,normalizeStudyQuality,todayISO,dateInsightsMeta,sanitizePracticeRun
    }=input.helpers;
    const {normalizeTimestamp,normalizeImportedTimestamp,normalizeImportedEpochMillis}=input.timestamps;
    const TIMER_MODES=input.timer.modes;
    const defaultBreakSeconds=input.timer.defaultBreakSeconds;
    const t2m=TimeModel.clockToMinute;
    const clockMinuteToStudyMinute=TimeModel.clockMinuteToStudyMinute;
    const studyMinuteToHHMM=TimeModel.studyMinuteToHHMM;
    const isValidHHMM=TimeModel.isValidHHMM;
    const normalizeHHMM=TimeModel.normalizeHHMM;
    const isValidIsoDate=TimeModel.isValidIsoDate;
    const isWorkBlock=ScheduleModel.isWork;
    const isTrackableBlock=ScheduleModel.isTrackable;
    const normalizeAreaName=ScheduleModel.normalizeArea;
    function optionalEditorContent(value:unknown,plainMax:number){
      if(typeof value!=='string'||!editorContentWithinLimits(value))return null;
      const clean=clampEditorContent(value,plainMax);
      return clean===value?clean:null;
    }
    const displayAreaName=ScheduleModel.displayArea;
    const taskAreaValue=ScheduleModel.areaValue;
    const normalizeScheduleKind=ScheduleModel.normalizeKind;
    const scheduleTextFromRows=ScheduleModel.textFromRows;
    const scheduleFingerprintForRows=ScheduleModel.fingerprint;
    const normalizeCompletionSource=CompletionModel.normalizeSource;
    const parseProgressNumber=CompletionModel.parseProgressNumber;
    const classifyTaskOutcome=OutcomeModel.classify;
    const countTaskOutcomes=OutcomeModel.count;
    const sanitizeTaskOutcomeCounts=OutcomeModel.sanitizeCounts;
function isSupportedSavedDate(value:unknown){
  return isValidIsoDate(value)&&String(value)>=APP_LIMITS.minSupportedSavedDate&&String(value)<=todayISO();
}
function summarizeAreasFromTasks(tasks:readonly TaskInput[]){
  const byArea=KeyedRecord.create<AreaSummary[string]>();
  (tasks||[]).forEach(t=>{
    if(!isWorkBlock(t))return;
    const key=(taskAreaValue(t)||'Other').trim()||'Other';
    if(!byArea[key])byArea[key]={planned:0,completed:0,actual:0,activityBlocks:0};
    byArea[key].planned+=(Number(t.dur)||0);
    byArea[key].completed+=(Number(t.dur)||0)*(Number(t.completion)||0)/100;
    byArea[key].actual+=Math.max(0,Number(t.actualSeconds)||0)/60;
    const outcome=classifyTaskOutcome(t);
    if(([TASK_OUTCOMES.FULL,TASK_OUTCOMES.PARTIAL,TASK_OUTCOMES.ZERO_OUTPUT,TASK_OUTCOMES.FINISHED_UNVERIFIED] as readonly TaskOutcome[]).includes(outcome))byArea[key].activityBlocks+=1;
  });
  return byArea;
}
function sanitizeAreaSummary(areaSummary:unknown){
  const clean=KeyedRecord.create<AreaSummary[string]>();
  const maxMinutes=APP_LIMITS.maxDurationMinutes*APP_LIMITS.maxTasksPerDay;
  Object.entries((areaSummary&&typeof areaSummary==='object')?areaSummary:{}).slice(0,APP_LIMITS.maxTasksPerDay).forEach(([label,row])=>{
    const safeLabel=clampText(displayAreaName(label)||'Other',APP_LIMITS.maxAreaNameChars);
    const source=(row&&typeof row==='object')?row as RawFields:{};
    clean[safeLabel||'Other']={
      planned:boundedNumber(source.planned,{min:0,max:maxMinutes,fallback:0}),
      completed:boundedNumber(source.completed,{min:0,max:maxMinutes,fallback:0}),
      actual:boundedNumber(source.actual,{min:0,max:maxMinutes,fallback:0}),
      activityBlocks:boundedInt(source.activityBlocks,{min:0,max:APP_LIMITS.maxTasksPerDay,fallback:0})
    };
  });
  return clean;
}
function buildDailyRecordSummary(r:unknown){
  const source:Partial<Omit<Extract<NonNullable<ReturnType<typeof materializeDailyRecordView>>,{recordKind:'study'}>,'recordKind'>>&{recordKind?:'diary'|'study'}=materializeDailyRecordView(r)||{};
  const recordKind=source.recordKind==='diary'?'diary':'study';
  const date=isValidIsoDate(source.date)?String(source.date):todayISO();
  if(recordKind==='diary')return {
    summaryVersion:DATA_CONTRACT.schemas.DailySummary.version,
    recordKind,
    date,
    savedAt:normalizeTimestamp(source.savedAt,null),
    plannedMinutes:null,
    completedMinutes:null,
    weightedCompletion:null,
    studyQuality:null,
    hasReflection:!!String(source.reflection||'').trim(),
    actualTrackedMinutes:null,
    outcomeCounts:sanitizeTaskOutcomeCounts(null),
    averageBlockCompletion:null,
    shiftedStudyBlocks:null,
    areaSummary:KeyedRecord.create()
  };
  const maxMinutes=APP_LIMITS.maxDurationMinutes*APP_LIMITS.maxTasksPerDay;
  const planned=optionalBoundedNumber(source.originalPlannedStudyMinutes,{min:0,max:maxMinutes});
  const completed=optionalBoundedNumber(source.completedEquivalentMinutes,{min:0,max:maxMinutes});
  const weighted=optionalBoundedNumber(source.completionPercent,{min:0,max:100});
  const tasks:DailyTaskView[]=Array.isArray(source.tasks)?source.tasks:[];
  const outcomeEligible=tasks.filter(task=>task&&(
    task.completion!==null&&task.completion!==undefined||task.skipped||task.doneFlag||
    normalizeCompletionSource(task.completionSource)!==COMPLETION_SOURCES.NONE
  ));
  const areaSummary=sanitizeAreaSummary(summarizeAreasFromTasks(tasks));
  return {
    summaryVersion:DATA_CONTRACT.schemas.DailySummary.version,
    recordKind,
    date,
    savedAt:normalizeTimestamp(source.savedAt,null),
    plannedMinutes:planned,
    completedMinutes:completed,
    weightedCompletion:weighted,
    studyQuality:normalizeStudyQuality(source.studyQuality),
    hasReflection:source.reflection===null?null:!!String(source.reflection||'').trim(),
    actualTrackedMinutes:optionalBoundedNumber(source.actualFocusMinutes,{min:0,max:maxMinutes}),
    outcomeCounts:countTaskOutcomes(outcomeEligible),
    averageBlockCompletion:optionalBoundedNumber(source.averageBlockCompletion,{min:0,max:100}),
    shiftedStudyBlocks:optionalBoundedNumber(source.shiftedStudyBlocks,{min:0,max:APP_LIMITS.maxTasksPerDay,integer:true}),
    areaSummary
  };
}
function compactPauseEvent(rawInput:unknown):PauseEvent|null{
  const ev=rawInput as RawFields|null|undefined;
  const row=(ev&&typeof ev==='object')?ev:null;
  if(!row)return null;
  const rawType=clampText(row.type||row.reason||'manual',32).trim().toLowerCase();
  const type=['pomodoro','manual','inactive-gap'].includes(rawType)?rawType:'manual';
  const seconds=boundedNumber(row.seconds,{min:0,max:APP_LIMITS.maxDurationMinutes*60,fallback:0});
  if(seconds<=0)return null;
  const event:PauseEvent={
    startedAt:normalizeImportedTimestamp(row.startedAt,null),
    endedAt:normalizeImportedTimestamp(row.endedAt,null),
    seconds,
    type
  };
  const planned=boundedNumber(row.plannedSeconds,{min:0,max:APP_LIMITS.maxDurationMinutes*60,fallback:0});
  if(type==='pomodoro'&&planned>0)event.plannedSeconds=planned;
  if(type==='pomodoro'&&row.cueIssuedAt)event.cueIssuedAt=normalizeImportedTimestamp(row.cueIssuedAt,null);
  return event;
}
function compactPauseEvents(events:unknown,extraEvent:unknown=null){
  const out=[];
  (Array.isArray(events)?events:[]).slice(-APP_LIMITS.maxPauseEventsPerTask).forEach(ev=>{
    const clean=compactPauseEvent(ev);
    if(clean)out.push(clean);
  });
  const extra=compactPauseEvent(extraEvent);
  if(extra)out.push(extra);
  return out.slice(-APP_LIMITS.maxPauseEventsPerTask);
}
function compactRealTimeSnapshot(rawInput:unknown):RealTimeSnapshot|null{
  const snapshot=rawInput as RawFields|null|undefined;
  if(!snapshot||typeof snapshot!=='object')return null;
  const clean={
    capturedAt:normalizeImportedTimestamp(snapshot.capturedAt,null),
    scheduledIdx:snapshot.scheduledIdx===null||snapshot.scheduledIdx===undefined?null:boundedInt(snapshot.scheduledIdx,{min:0,max:APP_LIMITS.maxTasksPerDay-1,fallback:null}),
    scheduledName:clampText(snapshot.scheduledName||'',APP_LIMITS.maxTaskNameChars)||null,
    scheduledKind:snapshot.scheduledKind?normalizeScheduleKind(snapshot.scheduledKind,'',''):null,
    currentIdx:snapshot.currentIdx===null||snapshot.currentIdx===undefined?null:boundedInt(snapshot.currentIdx,{min:0,max:APP_LIMITS.maxTasksPerDay-1,fallback:null}),
    currentName:clampText(snapshot.currentName||'',APP_LIMITS.maxTaskNameChars)||null,
    match:!!snapshot.match,
    driftKind:['match','behind','ahead','mismatch','none'].includes(String(snapshot.driftKind||''))?String(snapshot.driftKind):'none',
    driftMinutes:snapshot.driftMinutes===null||snapshot.driftMinutes===undefined?null:boundedNumber(snapshot.driftMinutes,{min:-APP_LIMITS.maxDurationMinutes,max:APP_LIMITS.maxDurationMinutes,fallback:null}),
    driftLabel:clampText(snapshot.driftLabel||'',160)
  };
  return clean.capturedAt||clean.scheduledIdx!==null||clean.currentIdx!==null?clean:null;
}
function sanitizeTimerRuntimePayload(rawInput:unknown):TimerPayload|null{
  const runtime=rawInput as RawFields|null|undefined;
  if(!runtime||typeof runtime!=='object'||runtime.version!==2)return null;
  const taskId=clampText(runtime.taskId||'',80),rawState=runtime.timerState&&typeof runtime.timerState==='object'?runtime.timerState as RawFields:null;
  if(!taskId||taskId.startsWith('@index:')||!rawState)return null;
  const startMs=normalizeImportedEpochMillis(rawState.startMs,0);
  const durationSec=boundedNumber(rawState.durationSec,{min:1,max:APP_LIMITS.maxDurationMinutes*60,fallback:0});
  if(!startMs||!durationSec)return null;
  const clean:TimerPayload={
    version:2,taskId,mode:runtime.paused||runtime.mode===TIMER_MODES.PAUSED?TIMER_MODES.PAUSED:TIMER_MODES.RUNNING,
    paused:!!runtime.paused||runtime.mode===TIMER_MODES.PAUSED,
    timerState:{
      startMs:Math.round(startMs),durationSec:Math.round(durationSec),
      totalPausedMs:boundedNumber(rawState.totalPausedMs,{min:0,max:APP_LIMITS.maxDurationMinutes*60*1000,fallback:0}),
      pausedStartedMs:rawState.pausedStartedMs?normalizeImportedEpochMillis(rawState.pausedStartedMs,null):null,
      recordedSec:boundedNumber(rawState.recordedSec,{min:0,max:APP_LIMITS.maxDurationMinutes*60,fallback:0}),
      overtimeNotified:!!rawState.overtimeNotified,lastTickMs:rawState.lastTickMs?normalizeImportedEpochMillis(rawState.lastTickMs,null):null,
      sleepPausedMs:boundedNumber(rawState.sleepPausedMs,{min:0,max:APP_LIMITS.maxDurationMinutes*60*1000,fallback:0})
    },updatedAt:normalizeImportedTimestamp(runtime.updatedAt,new Date().toISOString())
  };
  const rawNudge=runtime.nudgeCycle&&typeof runtime.nudgeCycle==='object'?runtime.nudgeCycle as RawFields:null;
  if(rawNudge)clean.nudgeCycle={startSec:boundedNumber(rawNudge.startSec,{min:0,max:APP_LIMITS.maxDurationMinutes*60,fallback:0})};
  const rawGap=runtime.pendingInactiveGap&&typeof runtime.pendingInactiveGap==='object'?runtime.pendingInactiveGap as RawFields:null;
  if(rawGap){
    const gapMs=boundedNumber(rawGap.gapMs,{min:0,max:APP_LIMITS.maxDurationMinutes*60*1000,fallback:0});
    const detectedAtMs=normalizeImportedEpochMillis(rawGap.detectedAtMs,0);
    if(gapMs>0&&detectedAtMs>0)clean.pendingInactiveGap={
      gapMs:Math.round(gapMs),promptMs:Math.round(boundedNumber(rawGap.promptMs,{min:0,max:APP_LIMITS.maxDurationMinutes*60*1000,fallback:0})),
      detectedAtMs:Math.round(detectedAtMs),lastMs:Math.round(normalizeImportedEpochMillis(rawGap.lastMs,0)),source:clampText(rawGap.source||'restore',40)
    };
  }
  const rawBreak=runtime.activeBreak&&typeof runtime.activeBreak==='object'?runtime.activeBreak as RawFields:null;
  if(clean.paused&&rawBreak){
    const type=rawBreak.type==='pomodoro'?'pomodoro':'manual',startedAtMs=normalizeImportedEpochMillis(rawBreak.startedAtMs,0);
    if(startedAtMs)clean.activeBreak={
      type,startedAtMs:Math.round(startedAtMs),plannedSeconds:type==='pomodoro'?boundedNumber(rawBreak.plannedSeconds,{min:60,max:3600,fallback:defaultBreakSeconds()}):0,
      cueIssuedAt:type==='pomodoro'&&rawBreak.cueIssuedAt?normalizeImportedTimestamp(rawBreak.cueIssuedAt,null):null,doneNotified:!!rawBreak.doneNotified
    };
  }
  return clean;
}
function compactAdjustedSchedule(adjustments:unknown){
  if(!adjustments||typeof adjustments!=='object')return {};
  const clean:Record<string,Adjustment>={};
  Object.entries(adjustments as Record<string,unknown>).slice(0,APP_LIMITS.maxTasksPerDay).forEach(([idx,rawEntry])=>{
    if(!rawEntry||typeof rawEntry!=='object')return;const entry=rawEntry as RawFields;
    const idxNum=Number(idx);
    if(!Number.isInteger(idxNum)||idxNum<0||idxNum>=APP_LIMITS.maxTasksPerDay)return;
    const safeIdx=String(idxNum);
    clean[safeIdx]={
      startMin:boundedInt(entry.startMin,{min:0,max:APP_LIMITS.maxDurationMinutes*2,fallback:0}),
      endMin:boundedInt(entry.endMin,{min:0,max:APP_LIMITS.maxDurationMinutes*2,fallback:0}),
      reason:clampText(entry.reason||'',80),
      changedAt:normalizeImportedTimestamp(entry.changedAt,null)
    };
  });
  return clean;
}
function normalizeDailyResultEntry(rawInput:unknown,scheduleEntry:StoredSchedule|null|undefined=null):DailyResult|null{
  const value=rawInput as RawFields|null|undefined;
  if(!value||typeof value!=='object')return null;
  const clean:DailyResult={};
  const adjusted=value.adjustedStart||((value.hasAdjustment&&value.start)?value.start:'');
  if(isValidHHMM(adjusted)&&(!scheduleEntry||normalizeHHMM(adjusted)!==scheduleEntry.start))clean.adjustedStart=normalizeHHMM(adjusted);
  const completion=parseProgressNumber(value.completion);
  if(completion!==null)clean.completion=CompletionModel.clampPercent(completion);
  const source=normalizeCompletionSource(value.completionSource);
  if(source!==COMPLETION_SOURCES.NONE)clean.completionSource=source;
  const done=parseProgressNumber(value.done);
  if(done!==null)clean.done=Math.max(0,Math.min(1000000,done));
  const total=parseProgressNumber(value.total!==undefined?value.total:value.enteredTotal);
  if(total!==null&&total>0)clean.total=Math.max(0,Math.min(1000000,total));
  const actual=parseProgressNumber(value.actualSeconds);
  if(actual!==null)clean.actualSeconds=Math.round(Math.max(0,Math.min(APP_LIMITS.maxDurationMinutes*60,actual)));
  const actualStart=normalizeImportedTimestamp(value.actualStart,null);
  const actualEnd=normalizeImportedTimestamp(value.actualEnd,null);
  if(actualStart)clean.actualStart=actualStart;
  if(actualEnd)clean.actualEnd=actualEnd;
  if(value.actualStartLocalMinute!==null&&value.actualStartLocalMinute!==undefined)clean.actualStartLocalMinute=boundedInt(value.actualStartLocalMinute,{min:0,max:1439,fallback:null});
  if(value.actualStartUtcOffsetMinutes!==null&&value.actualStartUtcOffsetMinutes!==undefined)clean.actualStartUtcOffsetMinutes=boundedInt(value.actualStartUtcOffsetMinutes,{min:-840,max:840,fallback:null});
  const zone=clampText(value.actualStartTimeZone||'',80);if(zone)clean.actualStartTimeZone=zone;
  const pauses=compactPauseEvents(value.pauseEvents);if(pauses.length)clean.pauseEvents=pauses;
  const sessionCount=boundedInt(value.sessionCount,{min:0,max:1000000,fallback:0});if(sessionCount)clean.sessionCount=sessionCount;
  if(safeBoolean(value.skipped))clean.skipped=true;
  if(safeBoolean(value.doneFlag))clean.doneFlag=true;
  if(clean.skipped){clean.completion=0;clean.completionSource=COMPLETION_SOURCES.SKIPPED;}
  return Object.keys(clean).length?clean:null;
}
function dailyRecordMetricsFromEvidence(schedule:StoredSchedule[],results:Record<string,DailyResult>|null,{preserveMissing=false}={}){
  const workEntries=(Array.isArray(schedule)?schedule:[]).filter(isWorkBlock);
  const rows=workEntries.map(entry=>({entry,result:results&&results[entry.id]||null}));
  const plannedKnown=!preserveMissing||rows.length>0;
  const completionKnown=!preserveMissing||rows.length>0&&rows.every(row=>typeof row.result?.completion==='number');
  const actualKnown=!preserveMissing||rows.length>0&&rows.every(row=>typeof row.result?.actualSeconds==='number');
  const resultKnown=!preserveMissing||rows.length>0&&rows.every(row=>!!row.result);
  const originalPlannedStudyMinutes=plannedKnown?rows.reduce((sum,row)=>sum+row.entry.duration,0):null;
  const completedEquivalentMinutes=plannedKnown&&completionKnown?rows.reduce((sum,row)=>{
    const pct=row.result&&row.result.completion!==undefined?CompletionModel.clampPercent(row.result.completion):0;
    return sum+(Number(row.entry.duration)||0)*pct/100;
  },0):null;
  const actualFocusMinutes=actualKnown?rows.reduce((sum,row)=>sum+(Number(row.result&&row.result.actualSeconds)||0)/60,0):null;
  const completionPercent=originalPlannedStudyMinutes&&completedEquivalentMinutes!==null?completedEquivalentMinutes/originalPlannedStudyMinutes*100:(preserveMissing?null:0);
  const averageBlockCompletion=completionKnown&&rows.length?rows.reduce((sum,row)=>sum+(row.result&&row.result.completion!==undefined?CompletionModel.clampPercent(row.result.completion):0),0)/rows.length:(preserveMissing?null:0);
  const scheduleShifts=resultKnown?rows.map(row=>{
    if(!row.result||!row.result.adjustedStart)return 0;
    return clockMinuteToStudyMinute(t2m(row.result.adjustedStart))-clockMinuteToStudyMinute(t2m(row.entry.start));
  }).filter(delta=>delta!==0):null;
  const shiftedStudyBlocks=scheduleShifts?scheduleShifts.length:null;
  const totalScheduleShiftMinutes=scheduleShifts?(shiftedStudyBlocks?Math.max(...scheduleShifts.map(Math.abs)):0):null;
  const netScheduleShiftMinutes=scheduleShifts?(shiftedStudyBlocks?scheduleShifts.reduce((sum,value)=>sum+value,0)/shiftedStudyBlocks:0):null;
  return {
    originalPlannedStudyMinutes,completedEquivalentMinutes,actualFocusMinutes,completionPercent,averageBlockCompletion,
    actualVsPlannedMinutes:actualFocusMinutes!==null&&originalPlannedStudyMinutes!==null?actualFocusMinutes-originalPlannedStudyMinutes:null,
    actualVsCompletedMinutes:actualFocusMinutes!==null&&completedEquivalentMinutes!==null?actualFocusMinutes-completedEquivalentMinutes:null,
    shiftedStudyBlocks,totalScheduleShiftMinutes,netScheduleShiftMinutes
  };
}
function sanitizeCurrentScheduleEntry(rawInput:unknown):StoredSchedule|null{
  const row=rawInput as RawFields|null|undefined;
  if(!row||typeof row!=='object'||Array.isArray(row))return null;
  const expected=['id','start','duration','name','kind','area','measure','target'];
  if(Object.keys(row).sort().join('|')!==expected.sort().join('|'))return null;
  const id=optionalText(row.id,80),start=typeof row.start==='string'&&isValidHHMM(row.start)&&normalizeHHMM(row.start)===row.start?row.start:null;
  const duration=optionalBoundedNumber(row.duration,{min:0,max:APP_LIMITS.maxDurationMinutes,integer:true});
  const name=optionalText(row.name,APP_LIMITS.maxTaskNameChars),kind=(['work','support','fixed'] as readonly unknown[]).includes(row.kind)?row.kind as TaskKind:null;
  const area=optionalText(row.area,APP_LIMITS.maxAreaNameChars),measure=optionalText(row.measure,APP_LIMITS.maxUnitChars);
  const target=row.target===null?null:optionalBoundedNumber(row.target,{min:0,max:1000000});
  if(!id||id.startsWith('@index:')||start===null||duration===null||name===null||!kind||area===null||measure===null||(row.target!==null&&target===null))return null;
  const clean={id,start,duration,name,kind,area,measure,target};
  return sameDataValue(row,clean)?clean:null;
}
// The stored fields of a Saved Day, in the order sanitizeCurrentDailyRecord writes them.
const DIARY_RECORD_FIELDS=freeze(['version','recordKind','date','savedAt','updatedAt','sourceRevision','reflection']);
const STUDY_RECORD_FIELDS=freeze(['version','recordKind','date','savedAt','updatedAt','sourceRevision','quote','reflection','studyQuality','realTimeSnapshot','schedule','results','practiceRuns','carryForwardDraft']);
function sanitizeCurrentDailyRecord(rawInput:unknown):DailyRecord|null{
  const record=rawInput as RawFields|null|undefined;
  if(!record||typeof record!=='object'||Array.isArray(record)||Number(record.version)!==DATA_CONTRACT.schemas.DailyRecord.version||!isSupportedSavedDate(record.date))return null;
  const recordKind=record.recordKind==='diary'?'diary':record.recordKind==='study'?'study':null;if(!recordKind)return null;
  const expected=recordKind==='diary'?DIARY_RECORD_FIELDS:STUDY_RECORD_FIELDS;
  if(Object.keys(record).sort().join('|')!==[...expected].sort().join('|'))return null;
  const date=String(record.date),savedAt=normalizeImportedTimestamp(record.savedAt,null),updatedAt=normalizeImportedTimestamp(record.updatedAt,null),sourceRevision=optionalBoundedNumber(record.sourceRevision,{min:0,max:Number.MAX_SAFE_INTEGER,integer:true});
  const reflection=optionalEditorContent(record.reflection,APP_LIMITS.maxReflectionChars);
  if(savedAt===null||updatedAt===null||sourceRevision===null||reflection===null)return null;
  if(recordKind==='diary'){
    if(!String(reflection||'').trim())return null;
    const clean:DailyRecord={version:DATA_CONTRACT.schemas.DailyRecord.version,recordKind,date,savedAt,updatedAt,sourceRevision,reflection};
    return sameDataValue(record,clean)?clean:null;
  }
  const quote=optionalText(record.quote,APP_LIMITS.maxQuoteChars),carryForwardDraft=optionalText(record.carryForwardDraft,APP_LIMITS.maxCarryForwardChars);
  const studyQuality=record.studyQuality===null?null:optionalBoundedNumber(record.studyQuality,{min:1,max:5,integer:true});
  if(quote===null||carryForwardDraft===null||(record.studyQuality!==null&&studyQuality===null)||!Array.isArray(record.schedule)||!record.results||typeof record.results!=='object'||Array.isArray(record.results)||!Array.isArray(record.practiceRuns))return null;
  if(record.schedule.length>APP_LIMITS.maxTasksPerDay||record.practiceRuns.length>APP_LIMITS.maxPracticeRunsPerDay)return null;
  const schedule:StoredSchedule[]=[],ids=new Set<string>();
  for(const row of record.schedule){const clean=sanitizeCurrentScheduleEntry(row);if(!clean||ids.has(clean.id))return null;schedule.push(clean);ids.add(clean.id);}
  const results=KeyedRecord.create<DailyResult>();
  for(const [id,value] of Object.entries(record.results)){
    if(!ids.has(id))return null;
    const clean=normalizeDailyResultEntry(value,schedule.find(row=>row.id===id));
    if(!clean||!sameDataValue(value,clean))return null;results[id]=clean;
  }
  const practiceRuns=[];
  for(const raw of record.practiceRuns){
    const clean=sanitizePracticeRun(raw,{unitLimit:APP_LIMITS.maxPracticeUnitsPerRun,allowedTaskIds:ids});
    if(!clean||!sameDataValue(raw,clean))return null;practiceRuns.push(clean);
  }
  let realTimeSnapshot=null;
  if(record.realTimeSnapshot!==null){realTimeSnapshot=compactRealTimeSnapshot(record.realTimeSnapshot);if(!realTimeSnapshot||!sameDataValue(record.realTimeSnapshot,realTimeSnapshot))return null;}
  const clean:DailyRecord={version:DATA_CONTRACT.schemas.DailyRecord.version,recordKind,date,savedAt,updatedAt,sourceRevision,quote,reflection,studyQuality,realTimeSnapshot,schedule,results,practiceRuns,carryForwardDraft};
  return sameDataValue(record,clean)?clean:null;
}
// Compare actual Saved Day evidence with recorded session work. Exact mode
// requires equality of observed values; coverage mode permits demonstrable
// later progress. The caller separately verifies a durable save acknowledgement
// when required. Device-local source revisions are not ancestry identifiers.
function savedDayCoversSessionEvidence(record:DailyRecord|null|undefined,session:ActiveSession|null|undefined,{allowAdvances=false}={}){
  const snapshot=session?.snapshot;
  if(record?.recordKind!=='study'||!snapshot||record.date!==session.date||
      !Array.isArray(record.schedule)||!Array.isArray(record.practiceRuns)||!record.results)return false;
  const parsed=ScheduleModel.parseText(String(session.scheduleText||''));
  if(!parsed.ok)return false;
  const rows=record.schedule.map(row=>({
    start:row.start,dur:row.duration,name:row.name,kind:row.kind,
    area:row.area,measure:row.measure,target:row.target
  }));
  if(ScheduleModel.fingerprint(parsed.parsed)!==ScheduleModel.fingerprint(rows))return false;
  const review=snapshot.review||{};
  if((!allowAdvances||String(review.reflection||''))&&
      String(record.reflection||'')!==String(review.reflection||''))return false;
  if((!allowAdvances||review.studyQuality!=null)&&
      (record.studyQuality??null)!==(review.studyQuality??null))return false;
  if((!allowAdvances||String(snapshot.latestCarryForward||''))&&
      String(record.carryForwardDraft||'')!==String(snapshot.latestCarryForward||''))return false;
  const runs=Array.isArray(snapshot.practice?.runs)?snapshot.practice.runs:[];
  // A partial Practice Pacer run may grow into a completed run. Its units
  // already observed must remain an exact prefix; settings and task identity
  // cannot change. Match records one-to-one so duplicates cannot prove work
  // that the Saved Day contains only once.
  const practiceRunCovered=(saved:PracticeRun,prior:PracticeRun)=>{
    if(sameDataValue(saved,prior))return true;
    if(!allowAdvances||prior?.partial!==true||!Array.isArray(prior.unitMs)||
        !Array.isArray(saved?.unitMs)||saved.unitMs.length<prior.unitMs.length)return false;
    const {unitMs:_savedUnits,partial:_savedPartial,...savedRest}=saved;
    const {unitMs:_priorUnits,partial:_priorPartial,...priorRest}=prior;
    return sameDataValue(savedRest,priorRest)&&
      prior.unitMs.every((ms,index)=>saved.unitMs[index]===ms);
  };
  const consumedRuns=new Set(),unmatchedRuns=[];
  // Exact finished runs are more specific than prefixes. Reserve them first
  // so an earlier partial run cannot consume the only exact match of a
  // separately completed run merely because the records are ordered apart.
  for(const run of runs){
    const index=record.practiceRuns.findIndex((saved,i)=>!consumedRuns.has(i)&&sameDataValue(saved,run));
    if(index<0)unmatchedRuns.push(run);
    else consumedRuns.add(index);
  }
  // Longer prefixes constrain the assignment more strongly than shorter ones.
  unmatchedRuns.sort((a,b)=>(b?.unitMs?.length||0)-(a?.unitMs?.length||0));
  for(const run of unmatchedRuns){
    const index=record.practiceRuns.findIndex((saved,i)=>!consumedRuns.has(i)&&practiceRunCovered(saved,run));
    if(index<0)return false;
    consumedRuns.add(index);
  }
  // Practice Pacer also records an unfinished active attempt. Save Today
  // finalizes that attempt as a partial run, so a Saved Day must contain
  // its already-observed units and elapsed current unit as a distinct run.
  // The ongoing clock is bounded by the snapshot's own persisted timestamp;
  // a missing/inconsistent clock observation is not positive save evidence.
  const active=snapshot.practice?.active;
  if(active){
    const finished=Array.isArray(active.unitMs)?active.unitMs:[],
      anchored=Number(active.anchorMs)>0;
    let current=Math.max(0,Number(active.currentMs)||0);
    if(anchored){
      const at=Date.parse(String(snapshot.updatedAt||'')),since=Number(active.anchorMs);
      if(!Number.isFinite(at)||at<since)return false;
      current+=Math.max(0,at-since);
    }
    // The live pacer clamps the ongoing unit to maxPracticeTargetMs before
    // finalization. A covered Saved Day must not require impossible overtime.
    current=Math.round(Math.min(APP_LIMITS.maxPracticeTargetMs,current));
    if(finished.length||current>0){
      const fields=['targetMs','taskId','sessionTargetMs','unitPlan','totalUnits'] as const,
        expected=finished.length+(current>0?1:0);
      const index=record.practiceRuns.findIndex((saved,i)=>{
        if(consumedRuns.has(i)||!Array.isArray(saved?.unitMs)||
          fields.some(key=>!sameDataValue(saved[key],active[key]))||
          (allowAdvances?saved.unitMs.length<expected:saved.unitMs.length!==expected)||
          !finished.every((ms,pos)=>saved.unitMs[pos]===ms))return false;
        return current===0||
          (allowAdvances?saved.unitMs[finished.length]!>=current:
            saved.unitMs[finished.length]===current);
      });
      if(index<0)return false;
      consumedRuns.add(index);
    }
  }
  const observed=(value:unknown,prior:unknown)=>{
    if(prior===undefined)return true;
    if(value===undefined||!Number.isFinite(Number(value))||!Number.isFinite(Number(prior)))return false;
    return allowAdvances?Number(value)>=Number(prior):Number(value)===Number(prior);
  };
  for(const [id,state] of Object.entries(snapshot.taskState||{})){
    const result=record.results[id]||null;
    if(!result){if(Object.keys(state||{}).length)return false;continue;}
    if(!observed(result.completion,state.completion))return false;
    if(state.completionSource&&result.completionSource!==state.completionSource)return false;
    if(state.resolvedState==='done'&&result.doneFlag!==true||
        state.resolvedState==='skipped'&&result.skipped!==true)return false;
    if(!observed(result.done,state.progress?.done)||
        !observed(result.actualSeconds,state.actual?.seconds))return false;
    if(state.progress?.total!==undefined&&
        Number(result.total)!==Number(state.progress.total))return false;
    const clock=state.actual?.clock||{},actual=state.actual?.record||{};
    const start=clock.startedAt||actual.firstStartedAt,end=clock.endedAt||actual.lastEndedAt;
    if(start&&result.actualStart!==start)return false;
    // A block started but stopped within its first second recorded no time:
    // the Saved Day keeps no end for it, and there is nothing to lose.
    const noTime=!(Number(state.actual?.seconds)>0)&&!(Number(actual.activeSeconds)>0)&&
      result.actualEnd===undefined&&!(Number(result.actualSeconds)>0);
    if(end&&result.actualEnd!==end&&!noTime){
      // An end moving forward can be legitimate continued focus, but only
      // with a stable start and strictly increased recorded focus duration.
      // A missing/replaced start or a merely edited timestamp proves nothing.
      const previousSeconds=Number(state.actual?.seconds);
      if(!allowAdvances||!start||!Number.isFinite(previousSeconds)||
          !(Number(result.actualSeconds)>previousSeconds)||
          !Number.isFinite(Date.parse(end))||
          !(Date.parse(String(result.actualEnd))>Date.parse(end)))return false;
    }
    if(clock.startedAtLocalMinute!==undefined&&
        Number(result.actualStartLocalMinute)!==Number(clock.startedAtLocalMinute))return false;
    if(clock.startedAtUtcOffsetMinutes!==undefined&&
        Number(result.actualStartUtcOffsetMinutes)!==Number(clock.startedAtUtcOffsetMinutes))return false;
    if(clock.startedAtTimeZone&&result.actualStartTimeZone!==clock.startedAtTimeZone)return false;
    const count=Number(actual.sessionCount)||actual.sessions?.length||0;
    if(count&&!observed(result.sessionCount,count))return false;
    const pauses=actual.pauseEvents||[];
    if(pauses.length&&(!Array.isArray(result.pauseEvents)||
        !sameDataValue(pauses,allowAdvances?result.pauseEvents.slice(0,pauses.length):result.pauseEvents)))return false;
  }
  for(const [id,adjustment] of Object.entries(snapshot.scheduleAdjustments||{})){
    if(!record.results[id]||
        record.results[id].adjustedStart!==TimeModel.studyMinuteToHHMM(adjustment.startMin))return false;
  }
  return true;
}
function createDiaryRecord(date:unknown,reflection:unknown,options:{updatedAt?:unknown;savedAt?:unknown;sourceRevision?:unknown}={}){
  if(!isSupportedSavedDate(date))return null;
  const text=clampEditorContent(reflection,APP_LIMITS.maxReflectionChars);if(!String(text||'').trim()||!editorContentWithinLimits(text))return null;
  const now=normalizeImportedTimestamp(options.updatedAt||options.savedAt,new Date().toISOString());if(!now)return null;
  const savedAt=normalizeImportedTimestamp(options.savedAt,now),updatedAt=normalizeImportedTimestamp(options.updatedAt,now);
  const candidate={version:DATA_CONTRACT.schemas.DailyRecord.version,recordKind:'diary',date:String(date),savedAt,updatedAt,sourceRevision:boundedInt(options.sourceRevision,{min:0,max:Number.MAX_SAFE_INTEGER,fallback:0}),reflection:text};
  return sanitizeCurrentDailyRecord(candidate);
}
// A note's key is its permanent id, given when it is created and never
// changed by a rename or move; its title is the label. A deleted note keeps
// its id behind the trash prefix until it is restored or its retention ends.
const NOTE_ID_PATTERN=/^n_[0-9a-f]{16}$/u,NOTE_TRASH_PREFIX=String(DATA_CONTRACT.schemas.Note.trashKeyPrefix||'');
const noteKeys=freeze({
  isId:(value:unknown)=>NOTE_ID_PATTERN.test(String(value||'')),
  isTrash:(value:unknown)=>String(value||'').startsWith(NOTE_TRASH_PREFIX)&&NOTE_ID_PATTERN.test(String(value).slice(NOTE_TRASH_PREFIX.length)),
  isKey:(value:unknown):boolean=>noteKeys.isId(value)||noteKeys.isTrash(value),
  trash:(id:unknown)=>noteKeys.isId(id)?NOTE_TRASH_PREFIX+id:'',
  id:(key:unknown)=>noteKeys.isTrash(key)?String(key).slice(NOTE_TRASH_PREFIX.length):noteKeys.isId(key)?String(key):''
});
// links, when present, lists the other notes on the note's bar by id: never
// empty, never the note itself, no repeats.
function noteLinks(value:unknown,key:string){
  if(!Array.isArray(value)||!value.length||value.length>APP_LIMITS.maxNoteLinks)return null;
  const self=noteKeys.id(key),seen=new Set();
  for(const id of value as unknown[]){if(typeof id!=='string'||!noteKeys.isId(id)||id===self||seen.has(id))return null;seen.add(id);}
  // Each retained link passed the string and note-id checks above.
  return [...value as string[]];
}
// A note's text is checked once: the text last found sound for each note is
// kept, so reading the same notes again (at start-up, for backups and upkeep)
// compares rather than parses. Those copies are the ones handed on, so the
// texts are held once.
const soundNoteText=new Map<string,string>();
function noteText(key:string,value:unknown){
  const known=soundNoteText.get(key);if(known!==undefined&&known===value){soundNoteText.delete(key);soundNoteText.set(key,known);return known;}
  const text=optionalEditorContent(value,APP_LIMITS.maxNoteChars);if(text===null)return null;
  soundNoteText.delete(key);soundNoteText.set(key,text);
  if(soundNoteText.size>APP_LIMITS.maxNotes)soundNoteText.delete(soundNoteText.keys().next().value!);
  return text;
}
function sanitizeCurrentNote(rawInput:unknown,keyHint:unknown=''):NoteRecord|null{
  const value=rawInput as RawFields|null|undefined;
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:null;if(!source||Number(source.version)!==DATA_CONTRACT.schemas.Note.version)return null;
  const expected=['version','key','label','text','updatedAt',...('links' in source?['links']:[])];
  if(Object.keys(source).sort().join('|')!==expected.sort().join('|'))return null;
  const key=String(source.key||keyHint||''),label=optionalText(source.label,APP_LIMITS.maxAreaNameChars),text=noteText(key,source.text);
  if(!noteKeys.isKey(key)||label===null||!normalizeAreaName(label)||text===null)return null;
  const updatedAt=normalizeImportedTimestamp(source.updatedAt,null);if(!updatedAt)return null;
  const links='links' in source?noteLinks(source.links,key):undefined;if(links===null)return null;
  const clean={version:DATA_CONTRACT.schemas.Note.version,key,label,text,updatedAt,...(links?{links}:{})};
  return sameDataValue(source,clean)?clean:null;
}
// A note's title or text on its own (either or both), checked as the note
// checks them: for a version kept for review. null when unsound.
function sanitizeNoteFields(rawInput:unknown):NoteFields|null{
  const value=rawInput as RawFields|null|undefined;
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:null,keys=source?Object.keys(source):[];
  if(!source||!keys.length||keys.some(key=>key!=='label'&&key!=='text'))return null;
  const clean:NoteFields={};
  if('label' in source){const label=optionalText(source.label,APP_LIMITS.maxAreaNameChars);if(label===null||label!==source.label||!normalizeAreaName(label))return null;clean.label=label;}
  if('text' in source){const text=optionalEditorContent(source.text,APP_LIMITS.maxNoteChars);if(text===null||text!==source.text)return null;clean.text=text;}
  return clean;
}
function dailyResultAdjustedEnd(entry:StoredSchedule,result:DailyResult|null){
  const start=result&&result.adjustedStart||entry.start;
  return studyMinuteToHHMM(clockMinuteToStudyMinute(t2m(start))+entry.duration);
}
// A Saved Day read from the repository is its view: the stored fields plus
// fields worked out from them (materializeDailyRecordView). Handed back to be
// saved, with a stored field changed such as the reflection, it is saved as
// its stored fields; the worked-out ones are rebuilt on every read. Anything
// else is returned unchanged, so a field the view does not have is refused.
function storedDailyRecordFields(value:object):object;
function storedDailyRecordFields(value:unknown):unknown;
function storedDailyRecordFields(value:unknown){
  if(!value||typeof value!=='object'||Array.isArray(value))return value;
  const record=value as RawFields;
  const fields=record.recordKind==='diary'?DIARY_RECORD_FIELDS:record.recordKind==='study'?STUDY_RECORD_FIELDS:null;
  if(!fields||Object.keys(value).every(key=>fields.includes(key)))return value;
  const stored:Record<string,unknown>={};for(const key of fields)if(Object.prototype.hasOwnProperty.call(value,key))stored[key]=(value as Record<string,unknown>)[key];
  const view=materializeDailyRecordView(stored);
  return view&&Object.keys(value).every(key=>Object.prototype.hasOwnProperty.call(view,key))?stored:value;
}
function materializeDailyRecordView(record:unknown){
  const doc=sanitizeCurrentDailyRecord(record);
  if(!doc)return null;
  const dayMeta=dateInsightsMeta(doc.date);
  if(doc.recordKind==='diary')return {...doc,dayOfWeek:dayMeta.dayOfWeek,dayName:dayMeta.dayName};
  const displaySchedule:StoredSchedule[]=Array.isArray(doc.schedule)?doc.schedule:[],displayResults=doc.results&&typeof doc.results==='object'?doc.results:KeyedRecord.create<DailyResult>();
  const workEntries=displaySchedule.filter(isWorkBlock),workCount=workEntries.length;
  let workOrdinal=0;
  const tasks:DailyTaskView[]=[];const adjustedSchedule:Record<string,Adjustment>={};
  displaySchedule.forEach((entry,idx)=>{
    const result=displayResults[entry.id]||null;
    if(result&&result.adjustedStart){
      const startMin=clockMinuteToStudyMinute(t2m(result.adjustedStart));
      adjustedSchedule[idx]={startMin,endMin:startMin+entry.duration,reason:'saved-adjustment',changedAt:doc.updatedAt||doc.savedAt};
    }
    if(!isTrackableBlock(entry))return;
    if(isWorkBlock(entry))workOrdinal++;
    const adjustedStart=result&&result.adjustedStart||entry.start;
    const actualSeconds=result&&result.actualSeconds!==undefined?result.actualSeconds:null;
    const areaKey=normalizeAreaName(entry.area||'');
    tasks.push({
      idx,id:entry.id,name:entry.name,kind:entry.kind,area:entry.area,areaKey,areaLabel:displayAreaName(entry.area||areaKey),dur:entry.duration,measure:entry.measure,target:entry.target,
      studyOrdinal:isWorkBlock(entry)?workOrdinal:0,studyBlockCount:workCount,isFirstStudyBlock:isWorkBlock(entry)&&workOrdinal===1,isLastStudyBlock:isWorkBlock(entry)&&workOrdinal===workCount,
      originalStart:entry.start,originalEnd:studyMinuteToHHMM(clockMinuteToStudyMinute(t2m(entry.start))+entry.duration),
      adjustedStart,adjustedEnd:dailyResultAdjustedEnd(entry,result),hasAdjustment:!!(result&&result.adjustedStart),
      completion:result&&result.completion!==undefined?result.completion:null,completionSource:normalizeCompletionSource(result&&result.completionSource),
      done:result&&result.done!==undefined?result.done:null,enteredTotal:result&&result.total!==undefined?result.total:null,
      actualSeconds,actualDeltaSeconds:actualSeconds===null?null:actualSeconds-entry.duration*60,
      actualStart:result&&result.actualStart||null,actualEnd:result&&result.actualEnd||null,
      actualStartLocalMinute:result&&result.actualStartLocalMinute!==undefined?result.actualStartLocalMinute:null,
      actualStartUtcOffsetMinutes:result&&result.actualStartUtcOffsetMinutes!==undefined?result.actualStartUtcOffsetMinutes:null,
      actualStartTimeZone:result&&result.actualStartTimeZone||null,
      pauseEvents:result&&result.pauseEvents||[],sessionCount:result&&result.sessionCount||0,
      skipped:!!(result&&result.skipped),doneFlag:!!(result&&result.doneFlag)
    });
  });
  const rows=displaySchedule.map(entry=>({id:entry.id,start:entry.start,dur:entry.duration,name:entry.name,kind:entry.kind,area:entry.area,measure:entry.measure,target:entry.target}));
  const derivedMetrics=dailyRecordMetricsFromEvidence(displaySchedule,displayResults,{preserveMissing:false});
  return {
    ...doc,
    dayOfWeek:dayMeta.dayOfWeek,
    dayName:dayMeta.dayName,
    ...derivedMetrics,
    tasks,
    originalSchedule:rows.map((row,idx)=>({...row,idx,plannedStartMin:clockMinuteToStudyMinute(t2m(row.start)),plannedEndMin:clockMinuteToStudyMinute(t2m(row.start))+row.dur})),
    adjustedSchedule,
    scheduleText:scheduleTextFromRows(rows),
    fingerprint:scheduleFingerprintForRows(rows)
  };
}
function sanitizeDailyRecordSummary(rawInput:unknown){
  const summary=rawInput as RawFields|null|undefined;
  if(!summary||typeof summary!=='object'||Array.isArray(summary)||Number(summary.summaryVersion)!==DATA_CONTRACT.schemas.DailySummary.version||!isSupportedSavedDate(summary.date))return null;
  const expected=['summaryVersion','recordKind','date','savedAt','plannedMinutes','completedMinutes','weightedCompletion','studyQuality','hasReflection','actualTrackedMinutes','outcomeCounts','averageBlockCompletion','shiftedStudyBlocks','areaSummary'];
  if(Object.keys(summary).sort().join('|')!==expected.sort().join('|'))return null;
  const recordKind=summary.recordKind==='diary'?'diary':summary.recordKind==='study'?'study':null;if(!recordKind)return null;
  const maxMinutes=APP_LIMITS.maxDurationMinutes*APP_LIMITS.maxTasksPerDay;
  const clean={
    summaryVersion:DATA_CONTRACT.schemas.DailySummary.version,recordKind,date:String(summary.date),savedAt:normalizeImportedTimestamp(summary.savedAt,null),
    plannedMinutes:optionalBoundedNumber(summary.plannedMinutes,{min:0,max:maxMinutes}),completedMinutes:optionalBoundedNumber(summary.completedMinutes,{min:0,max:maxMinutes}),weightedCompletion:optionalBoundedNumber(summary.weightedCompletion,{min:0,max:100}),
    studyQuality:normalizeStudyQuality(summary.studyQuality),hasReflection:summary.hasReflection===null?null:!!summary.hasReflection,
    actualTrackedMinutes:optionalBoundedNumber(summary.actualTrackedMinutes,{min:0,max:maxMinutes}),outcomeCounts:sanitizeTaskOutcomeCounts(summary.outcomeCounts),
    averageBlockCompletion:optionalBoundedNumber(summary.averageBlockCompletion,{min:0,max:100}),shiftedStudyBlocks:optionalBoundedNumber(summary.shiftedStudyBlocks,{min:0,max:APP_LIMITS.maxTasksPerDay,integer:true}),areaSummary:sanitizeAreaSummary(summary.areaSummary)
  };
  if(recordKind==='diary'&&(clean.plannedMinutes!==null||clean.completedMinutes!==null||clean.weightedCompletion!==null||clean.studyQuality!==null||clean.actualTrackedMinutes!==null||clean.averageBlockCompletion!==null||clean.shiftedStudyBlocks!==null||clean.hasReflection!==true||!sameDataValue(clean.outcomeCounts,sanitizeTaskOutcomeCounts(null))||Object.keys(clean.areaSummary).length))return null;
  return clean.savedAt&&sameDataValue(summary,clean)?clean:null;
}
function materializeDailyRecordSummary(summary:unknown){
  const clean=sanitizeDailyRecordSummary(summary);if(!clean)return null;const meta=dateInsightsMeta(clean.date);return {...clean,dayOfWeek:meta.dayOfWeek,dayName:meta.dayName};
}
    return freeze({
      format:'study-director.daily-record-codec',
      contractVersion:1,
      buildDailyRecordSummary,compactPauseEvents,compactRealTimeSnapshot,
      sanitizeTimerRuntimePayload,compactAdjustedSchedule,normalizeDailyResultEntry,
      dailyRecordMetricsFromEvidence,sanitizeCurrentDailyRecord,savedDayCoversSessionEvidence,createDiaryRecord,
      sanitizeCurrentNote,sanitizeNoteFields,noteKeys,materializeDailyRecordView,storedDailyRecordFields,sanitizeDailyRecordSummary,materializeDailyRecordSummary,isSupportedSavedDate
    });
  }
  function createActiveSessionCodec(input:ActiveInput){
    exactObject(input,['limits','dataContract','activeSessionId','domain','keyedRecord','helpers','timestamps','dailyRecordCodec'],'Active-session codec input');
    if(!Object.isFrozen(input.limits)||!Object.isFrozen(input.dataContract)||!Object.isFrozen(input.domain)||!Object.isFrozen(input.keyedRecord)||!Object.isFrozen(input.dailyRecordCodec)){
      throw new TypeError('Active-session codec contracts must be frozen.');
    }
    functions(input.helpers,[
      'boundedInt','boundedNumber','clampText','clampEditorContent','editorContentWithinLimits','cleanDayRevision','sameDataValue',
      'activeSessionScheduleFingerprint','isCanonicalScheduleText','isValidIsoDate','normalizeStudyQuality',
      'parseProgressNumber','sanitizePracticeState'
    ],'Active-session codec helpers');
    functions(input.timestamps,['normalizeTimestamp','normalizeImportedTimestamp','normalizeImportedEpochMillis'],'Active-session timestamp contract');
    const APP_LIMITS=input.limits;
    const DATA_CONTRACT=input.dataContract;
    const ACTIVE_SESSION_ID=input.activeSessionId;
    // The installation running the session (persistence.js installation identity).
    const INSTALLATION_ID=/^inst_[a-z0-9_]{8,128}$/iu;
    const KeyedRecord=input.keyedRecord;
    const CompletionModel=input.domain.CompletionModel;
    const COMPLETION_SOURCES=input.domain.COMPLETION_SOURCES;
    const normalizeCompletionSource=CompletionModel.normalizeSource;
    const {
      boundedInt,boundedNumber,clampText,clampEditorContent,editorContentWithinLimits,cleanDayRevision,sameDataValue,
      activeSessionScheduleFingerprint,isCanonicalScheduleText,isValidIsoDate,normalizeStudyQuality,
      parseProgressNumber,sanitizePracticeState
    }=input.helpers;
    const {normalizeTimestamp,normalizeImportedTimestamp,normalizeImportedEpochMillis}=input.timestamps;
    const compactPauseEvents=input.dailyRecordCodec.compactPauseEvents;
    const sanitizeTimerRuntimePayload=input.dailyRecordCodec.sanitizeTimerRuntimePayload;
  function sanitizeSnapshotProgress(rawInput:unknown):{done?:number;total?:number}|null{
  const value=rawInput as RawFields|null|undefined;
    if(!value||typeof value!=='object')return null;
    const row:{done?:number;total?:number}={};
    const done=parseProgressNumber(value.done);
    const total=parseProgressNumber(value.total);
    if(done!==null)row.done=Math.max(0,Math.min(1000000,done));
    if(total!==null&&total>0)row.total=Math.max(0,Math.min(1000000,total));
    return Object.keys(row).length?row:null;
  }
  function sanitizeSnapshotClock(rawInput:unknown):ClockRecord|null{
  const value=rawInput as RawFields|null|undefined;
    if(!value||typeof value!=='object')return null;
    const row:ClockRecord={};
    const startedAt=normalizeImportedTimestamp(value.startedAt,null);
    const endedAt=normalizeImportedTimestamp(value.endedAt,null);
    if(startedAt)row.startedAt=startedAt;
    if(endedAt)row.endedAt=endedAt;
    const localMinute=value.startedAtLocalMinute===null||value.startedAtLocalMinute===undefined
      ? null
      : boundedInt(value.startedAtLocalMinute,{min:0,max:1439,fallback:null});
    const offset=value.startedAtUtcOffsetMinutes===null||value.startedAtUtcOffsetMinutes===undefined
      ? null
      : boundedInt(value.startedAtUtcOffsetMinutes,{min:-840,max:840,fallback:null});
    const timeZone=clampText(value.startedAtTimeZone||'',80);
    if(localMinute!==null)row.startedAtLocalMinute=localMinute;
    if(offset!==null)row.startedAtUtcOffsetMinutes=offset;
    if(timeZone)row.startedAtTimeZone=timeZone;
    return Object.keys(row).length?row:null;
  }
  function sanitizeSnapshotActualRecord(rawInput:unknown):ActualRecord|null{
  const value=rawInput as RawFields|null|undefined;
    if(!value||typeof value!=='object')return null;
    const row:ActualRecord={};
    const firstStartedAt=normalizeImportedTimestamp(value.firstStartedAt,null);
    const lastStartedAt=normalizeImportedTimestamp(value.lastStartedAt,null);
    const lastEndedAt=normalizeImportedTimestamp(value.lastEndedAt,null);
    if(firstStartedAt)row.firstStartedAt=firstStartedAt;
    if(lastStartedAt)row.lastStartedAt=lastStartedAt;
    if(lastEndedAt)row.lastEndedAt=lastEndedAt;
    if(value.activeSeconds!==undefined)row.activeSeconds=boundedNumber(value.activeSeconds,{min:0,max:APP_LIMITS.maxDurationMinutes*60,fallback:0});
    if(value.pausedSeconds!==undefined)row.pausedSeconds=boundedNumber(value.pausedSeconds,{min:0,max:APP_LIMITS.maxDurationMinutes*60,fallback:0});
    if(value.pauseCount!==undefined)row.pauseCount=boundedInt(value.pauseCount,{min:0,max:1000000,fallback:0});
    if(value.sessionCount!==undefined)row.sessionCount=boundedInt(value.sessionCount,{min:0,max:1000000,fallback:0});
    if(value.status!==undefined)row.status=clampText(value.status||'not_started',32);
    if(Array.isArray(value.sessions))row.sessions=(value.sessions as unknown[]).slice(-APP_LIMITS.maxLiveSessionsPerTask).map(rawSession=>{const session=rawSession as RawFields|null|undefined;return ({
      startedAt:normalizeImportedTimestamp(session&&session.startedAt,null),
      durationSec:boundedNumber(session&&session.durationSec,{min:0,max:APP_LIMITS.maxDurationMinutes*60,fallback:0}),
      endedAt:normalizeImportedTimestamp(session&&session.endedAt,null),
      activeSeconds:boundedNumber(session&&session.activeSeconds,{min:0,max:APP_LIMITS.maxDurationMinutes*60,fallback:0}),
      pausedSeconds:boundedNumber(session&&session.pausedSeconds,{min:0,max:APP_LIMITS.maxDurationMinutes*60,fallback:0}),
      pauseCount:boundedInt(session&&session.pauseCount,{min:0,max:1000,fallback:0})
    });});
    if(Array.isArray(value.pauseEvents))row.pauseEvents=compactPauseEvents(value.pauseEvents);
    return Object.keys(row).length?row:null;
  }
  function sanitizeSnapshotTaskState(rawInput:unknown):Record<string,SessionTaskState>{
  const taskState=rawInput as RawFields|null|undefined;
    const out=KeyedRecord.create<SessionTaskState>();
    Object.entries((taskState&&typeof taskState==='object'&&!Array.isArray(taskState))?taskState:{})
      .slice(0,APP_LIMITS.maxTasksPerDay)
      .forEach(([rawTaskId,rawValue])=>{
        if(!rawValue||typeof rawValue!=='object')return;const value=rawValue as RawFields;
        const taskId=clampText(rawTaskId||'',80);
        if(!taskId||taskId.startsWith('@index:')||Object.prototype.hasOwnProperty.call(out,taskId))return;
        const row:SessionTaskState={};
        if(value.resolvedState==='done'||value.resolvedState==='skipped')row.resolvedState=value.resolvedState;
        const completion=parseProgressNumber(value.completion);
        if(completion!==null)row.completion=CompletionModel.clampPercent(completion);
        const source=normalizeCompletionSource(value.completionSource);
        if(source!==COMPLETION_SOURCES.NONE)row.completionSource=source;
        const progress=sanitizeSnapshotProgress(value.progress);
        if(progress)row.progress=progress;
        const actual=value.actual&&typeof value.actual==='object'?value.actual as RawFields:null;
        if(actual){
          const actualRow:NonNullable<SessionTaskState["actual"]>={};
          const seconds=parseProgressNumber(actual.seconds);
          if(seconds!==null)actualRow.seconds=Math.round(Math.max(0,Math.min(APP_LIMITS.maxDurationMinutes*60,seconds)));
          const clock=sanitizeSnapshotClock(actual.clock);
          if(clock)actualRow.clock=clock;
          const record=sanitizeSnapshotActualRecord(actual.record);
          if(record)actualRow.record=record;
          if(Object.keys(actualRow).length)row.actual=actualRow;
        }
        if(Object.keys(row).length)out[taskId]=row;
      });
    return out;
  }
  function sanitizeSnapshotScheduleAdjustments(rawInput:unknown):Record<string,Adjustment>{
  const adjustments=rawInput as RawFields|null|undefined;
    const out=KeyedRecord.create<Adjustment>();
    Object.entries((adjustments&&typeof adjustments==='object'&&!Array.isArray(adjustments))?adjustments:{})
      .slice(0,APP_LIMITS.maxTasksPerDay)
      .forEach(([rawTaskId,rawEntry])=>{
        if(!rawEntry||typeof rawEntry!=='object')return;const entry=rawEntry as RawFields;
        const taskId=clampText(rawTaskId||'',80);
        if(!taskId||taskId.startsWith('@index:')||Object.prototype.hasOwnProperty.call(out,taskId))return;
        const startMin=boundedInt(entry.startMin,{min:0,max:APP_LIMITS.maxDurationMinutes*2,fallback:null});
        const endMin=boundedInt(entry.endMin,{min:0,max:APP_LIMITS.maxDurationMinutes*2,fallback:null});
        if(startMin===null||endMin===null||endMin<=startMin)return;
        out[taskId]={startMin,endMin,reason:clampText(entry.reason||'',80),changedAt:normalizeImportedTimestamp(entry.changedAt,null)};
      });
    return out;
  }
  function sanitizeSnapshotReview(rawInput:unknown){
  const value=rawInput as RawFields|null|undefined;
    if(!value||typeof value!=='object'||Array.isArray(value))return null;
    const expected=['reflection','studyQuality'];
    if(Object.keys(value).sort().join('|')!==expected.sort().join('|'))return null;
    const reflection=String(value.reflection||'');
    if(!editorContentWithinLimits(reflection))return null;
    return {
      reflection:clampEditorContent(reflection,APP_LIMITS.maxReflectionChars),
      studyQuality:normalizeStudyQuality(value.studyQuality)
    };
  }
  function normalizeCurrentSessionSnapshot(rawInput:unknown,expectedDate:string,expectedFingerprint:string='',expectedSessionRevision:number|null=null):SessionSnapshot|null{
  const snapshot=rawInput as RawFields|null|undefined;
    if(!snapshot||typeof snapshot!=='object'||Number(snapshot.version)!==DATA_CONTRACT.schemas.SessionSnapshot.version||snapshot.date!==expectedDate)return null;
    const fingerprint=clampText(snapshot.fingerprint||'',APP_LIMITS.maxScheduleChars);
    if(!fingerprint||(expectedFingerprint&&fingerprint!==expectedFingerprint))return null;
    const rawCurrentTaskId=clampText(snapshot.currentTaskId||'',80);
    const currentTaskId=rawCurrentTaskId&&!rawCurrentTaskId.startsWith('@index:')?rawCurrentTaskId:null;
    const clean:Omit<SessionSnapshot,'review'>&{review?:SessionSnapshot['review']}={
      version:DATA_CONTRACT.schemas.SessionSnapshot.version,
      date:expectedDate,
      fingerprint,
      contentRevision:cleanDayRevision(snapshot.contentRevision),
      savedRevision:cleanDayRevision(snapshot.savedRevision),
      currentTaskId,
      taskState:sanitizeSnapshotTaskState(snapshot.taskState),
      scheduleAdjustments:sanitizeSnapshotScheduleAdjustments(snapshot.scheduleAdjustments),
      timerRuntime:sanitizeTimerRuntimePayload(snapshot.timerRuntime),
      latestCarryForward:clampText(snapshot.latestCarryForward||'',APP_LIMITS.maxCarryForwardChars),
      updatedAt:normalizeImportedTimestamp(snapshot.updatedAt,new Date().toISOString())
    };
    const review=sanitizeSnapshotReview(snapshot.review);
    if(!review)return null;
    clean.review=review;
    clean.savedRevision=Math.min(clean.contentRevision,clean.savedRevision);
    const practice=sanitizePracticeState(snapshot.practice);
    if(practice.active||practice.runs.length)clean.practice=practice;
    return {...clean,review};
  }
  function sanitizeSessionSnapshot(rawInput:unknown,expectedDate:string,expectedFingerprint='',expectedSessionRevision:number|null=null){
  const snapshot=rawInput as RawFields|null|undefined;
    const clean=normalizeCurrentSessionSnapshot(snapshot,expectedDate,expectedFingerprint,expectedSessionRevision);
    return clean&&sameDataValue(snapshot,clean)?clean:null;
  }
  function normalizeCurrentActiveSession(rawInput:unknown):ActiveSession|null{
  const session=rawInput as RawFields|null|undefined;
    if(!session||typeof session!=='object'||Number(session.version)!==DATA_CONTRACT.schemas.ActiveSession.version)return null;
    const revision=boundedNumber(session.revision,{min:1,max:Number.MAX_SAFE_INTEGER,fallback:0});
    if(!Number.isSafeInteger(revision))return null;
    const scheduleText=clampText(String(session.scheduleText||'').trim(),APP_LIMITS.maxScheduleChars);
    const clean:Omit<ActiveSession,'snapshot'>&{snapshot:SessionSnapshot|null}={
      id:ACTIVE_SESSION_ID,
      type:'activeSession',
      version:DATA_CONTRACT.schemas.ActiveSession.version,
      revision,
      date:String(session.date||''),
      status:session.status==='suspended'?'suspended':'active',
      runningOn:String(session.runningOn||''),
      scheduleText,
      snapshot:null,
      suspendedAt:session.suspendedAt?normalizeImportedTimestamp(session.suspendedAt,null):null,
      updatedAt:normalizeImportedTimestamp(session.updatedAt,new Date().toISOString())
    };
    if(!isValidIsoDate(clean.date)||!isCanonicalScheduleText(clean.scheduleText)||!INSTALLATION_ID.test(clean.runningOn))return null;
    clean.snapshot=normalizeCurrentSessionSnapshot(session.snapshot,clean.date,activeSessionScheduleFingerprint(clean),revision);
    if(!clean.snapshot)return null;
    return {...clean,snapshot:clean.snapshot};
  }
  function sanitizeCurrentActiveSession(rawInput:unknown){
  const session=rawInput as RawFields|null|undefined;
    if(!session||typeof session!=='object'||Array.isArray(session))return null;
    const expected=['id','type','version','revision','date','status','runningOn','scheduleText','snapshot','suspendedAt','updatedAt'];
    if(Object.keys(session).sort().join('|')!==expected.sort().join('|'))return null;
    const clean=normalizeCurrentActiveSession(session);
    return clean&&sameDataValue(session,clean)?clean:null;
  }
  // Study content is distinct from ownership/control metadata. Revisions and
  // timestamps establish persistence/order; runningOn/status establish control.
  // Neither may make two otherwise identical study sessions conflict.
  function contentValue(session:unknown){
    const clean=sanitizeCurrentActiveSession(session);if(!clean)return null;
    const {contentRevision:_contentRevision,savedRevision:_savedRevision,updatedAt:_snapshotUpdatedAt,...snapshot}=clean.snapshot;
    return Object.freeze({date:clean.date,scheduleText:clean.scheduleText,snapshot:Object.freeze(snapshot)});
  }
  return Object.freeze({sanitizeSessionSnapshot,sanitizeCurrent:sanitizeCurrentActiveSession,normalize:normalizeCurrentActiveSession,canonicalize:normalizeCurrentActiveSession,contentValue});
  }
  // Portable user data is an explicit allowlist, independent of sync destinations.
  function createPersonalDataCodec(limits:Pick<Limits,'maxScheduleChars'|'maxStudentNameChars'>){
    const maxDraft=limits.maxScheduleChars||100000,maxBytes=1024*1024;
    const object=(v:unknown):v is RawFields=>!!v&&typeof v==='object'&&!Array.isArray(v);
    const text=(v:unknown,max:number,label:string)=>{if(typeof v!=='string'||v.length>max)throw new Error(`Invalid ${label}.`);return v;};
    function plans(raw:unknown){
      if(!object(raw)||!Array.isArray(raw.savedPlans)||raw.savedPlans.length>100)throw new Error('Invalid saved-plan collection (100 maximum).');
      const ids=new Set();
      const savedPlans=raw.savedPlans.map(p=>{
        if(!object(p)||typeof p.id!=='string'||!/^plan-[a-z0-9-]{8,64}$/.test(p.id)||ids.has(p.id))throw new Error('Invalid or duplicate saved-plan identity.');ids.add(p.id);
        if(!Number.isFinite(Date.parse(String(p.createdAt)))||!Number.isFinite(Date.parse(String(p.updatedAt))))throw new Error('Invalid saved-plan dates.');
        const label=text(p.label,80,'plan name').trim();if(!label)throw new Error('Give the saved plan a name.');
        return {id:p.id,label,scheduleText:text(p.scheduleText,maxDraft,'saved plan'),createdAt:text(p.createdAt,40,'creation date'),updatedAt:text(p.updatedAt,40,'update date')};
      });
      const defaultId=raw.defaultId===null?null:text(raw.defaultId,70,'default plan');
      if(defaultId&&!ids.has(defaultId))throw new Error('Default plan is missing from saved plans.');
      const result={draft:raw.draft===null?null:text(raw.draft,maxDraft,'plan draft'),savedPlans,defaultId};
      if(new TextEncoder().encode(JSON.stringify(result)).length>maxBytes)throw new Error('Saved plans and draft exceed the 1 MiB allowance. Remove an unused plan or shorten it.');
      return result;
    }
    function preferences(raw:unknown):PersonalPreferences{
      if(!object(raw))throw new Error('Invalid portable preferences.');
      const result:Partial<PersonalPreferences>={};
      for(const key of ['studentName','theme','presentation','quote','practiceCueMode'] as const){
        const v=raw[key];if(v===undefined||v===null){result[key]=null;continue}
        result[key]=text(v,key==='quote'?1000:key==='studentName'?(limits.maxStudentNameChars||100):41,key);
        if(key==='practiceCueMode'&&!['quiet','strict'].includes(v as string))throw new Error('Invalid practice cue.');
        if(['theme','presentation'].includes(key)&&! /^[a-z][a-z0-9-]{0,40}$/.test(v as string))throw new Error('Invalid display setting.');
      }
      for(const key of ['fontScale','practiceTargetMs'] as const){
        const v=raw[key];if(v===undefined||v===null){result[key]=null;continue}
        if(typeof v!=='number'||!Number.isFinite(v)||(key==='fontScale'?![.95,1,1.08,1.16].includes(v):v<1000||v>86400000))throw new Error(`Invalid ${key}.`);result[key]=v;
      }
      if(raw.nudge==null)result.nudge=null;
      else{const v=raw.nudge;if(!object(v)||typeof v.enabled!=='boolean'||(v.sound!==undefined&&typeof v.sound!=='boolean')||typeof v.nudgeAfter!=='number'||!Number.isInteger(v.nudgeAfter)||v.nudgeAfter<1||v.nudgeAfter>240||typeof v.breakMinutes!=='number'||!Number.isInteger(v.breakMinutes)||v.breakMinutes<1||v.breakMinutes>60)throw new Error('Invalid reminder preferences.');result.nudge={enabled:v.enabled,...(v.sound===undefined?{}:{sound:v.sound}),nudgeAfter:v.nudgeAfter,breakMinutes:v.breakMinutes};}
      if(Object.hasOwn(raw,'soundMode')){if(!(['full','minimal','off'] as readonly unknown[]).includes(raw.soundMode))throw new Error('Invalid sound mode.');result.soundMode=raw.soundMode as NonNullable<PersonalPreferences["soundMode"]>;}
      // Both fixed-key loops assigned every required field; nudge is assigned on both branches.
      return result as PersonalPreferences;
    }
    function portablePreferences(raw:unknown){
      if(!object(raw))throw new Error('Invalid canonical portable preferences.');
      const clean=preferences(raw),updatedAt=raw.updatedAt==null?null:text(raw.updatedAt,40,'updatedAt');
      if(updatedAt!==null&&!Number.isFinite(Date.parse(updatedAt)))throw new Error('Invalid portable preferences update date.');
      return {version:2 as const,...clean,updatedAt};
    }
    function currentPortablePreferences(raw:unknown){
      if(!object(raw)||raw.version!==2)return null;
      try{const clean=portablePreferences(raw);return JSON.stringify(clean)===JSON.stringify(raw)?clean:null;}catch{return null;}
    }
    function normalize(raw:unknown){
      if(!object(raw)||raw.version!==2)throw new Error('Unsupported current personal-data version.');
      const expected=['studentName','theme','presentation','quote','practiceCueMode','fontScale','practiceTargetMs','nudge'];
      if(object(raw.preferences)&&Object.hasOwn(raw.preferences,'soundMode'))expected.push('soundMode');
      if(!object(raw.preferences)||Object.keys(raw.preferences).sort().join('|')!==expected.slice().sort().join('|'))throw new Error('Current personal-data Preferences contain unexpected fields.');
      return {version:2 as const,plans:plans(raw.plans),preferences:preferences(raw.preferences)};
    }
    return freeze({plans,preferences,portablePreferences,currentPortablePreferences,normalize,maxBytes});
  }

  // A version kept for review (PendingReview): when both sides changed the
  // same thing, the newer one shows and the other is kept here until the
  // person reviews it. subject says what it belongs to and ref which one: a
  // note (its id), a Saved Day (its date), plans and settings, or the
  // session. kept is the other side's version, or null where that side had
  // deleted it (or had no session); for a note it holds only the title or
  // text that differed, and base what both last shared of them, for Smart
  // merge. A resolved review keeps only its identity and resolvedAt, so
  // every device learns it is done.
  function createPendingReviewCodec(input:PendingReviewInput){
    exactObject(input,['dataContract','dailyRecordCodec','activeSessionCodec','personalDataCodec','helpers'],'Pending-review codec input');
    functions(input.helpers,['sameDataValue','randomBytes'],'Pending-review codec helpers');
    const VERSION=Number(input.dataContract.schemas.PendingReview.version),DailyRecordCodec=input.dailyRecordCodec,ActiveSessionCodec=input.activeSessionCodec,PersonalDataCodec=input.personalDataCodec;
    const {sameDataValue,randomBytes}=input.helpers,NoteKeys=DailyRecordCodec.noteKeys;
    const ID=/^pr_[a-f0-9]{32}$/u,DATE=/^\d{4}-\d{2}-\d{2}$/u,DEVICE=/^inst_[a-z0-9_]{8,128}$/iu,KEYS=['base','id','kept','keptAt','keptChangedAt','keptFrom','ref','resolvedAt','subject','version'].join('|');
    const iso=(value:unknown)=>{if(typeof value!=='string')return null;const ms=Date.parse(value);return Number.isFinite(ms)&&new Date(ms).toISOString()===value?value:null;};
    const refValid=(subject:unknown,ref:string)=>subject==='note'?NoteKeys.isId(ref):subject==='savedDay'?DATE.test(ref):subject==='personal'?ref==='personal':subject==='session'?ref==='session':false;
    // The other side's version; undefined when unsound.
    function keptValue(subject:ReviewSubject,ref:string,value:unknown){
      if(value===null)return subject==='personal'?undefined:null;
      try{
        const clean=subject==='note'?DailyRecordCodec.sanitizeNoteFields(value):subject==='savedDay'?DailyRecordCodec.sanitizeCurrentDailyRecord(value):subject==='personal'?PersonalDataCodec.normalize(value):ActiveSessionCodec.sanitizeCurrent(value);
        return clean&&(subject!=='savedDay'||'date' in clean&&clean.date===ref)&&sameDataValue(clean,value)?clean:undefined;
      }catch{return undefined;}
    }
    function normalize(rawInput:unknown):PendingReview|null{
      const value=rawInput as RawFields|null|undefined;
      // Only a canonical record passes: every field exactly as stored.
      if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join('|')!==KEYS||value.version!==VERSION||[value.id,value.subject,value.ref].some(field=>typeof field!=='string'))return null;
      const id=value.id as string,subject=value.subject as ReviewSubject,ref=value.ref as string,keptAt=iso(value.keptAt),keptFrom=value.keptFrom,keptChangedAt=value.keptChangedAt;
      if(!ID.test(id)||!keptAt||!refValid(subject,ref))return null;
      if(typeof keptFrom!=='string'||keptFrom!==''&&!DEVICE.test(keptFrom)||typeof keptChangedAt!=='string'||keptChangedAt!==''&&!iso(keptChangedAt))return null;
      if(value.resolvedAt!==''){const resolvedAt=iso(value.resolvedAt);return resolvedAt&&value.kept===null&&value.base===null&&keptFrom===''&&keptChangedAt===''?{version:VERSION,id,subject,ref,keptAt,keptFrom:'',keptChangedAt:'',kept:null,base:null,resolvedAt}:null;}
      const kept=keptValue(subject,ref,value.kept);if(kept===undefined)return null;
      let base=null;
      if(value.base!==null){base=subject==='note'&&kept?DailyRecordCodec.sanitizeNoteFields(value.base):null;if(!base||Object.keys(base).some(key=>!(key in kept!)))return null;}
      // keptValue validates the payload against this exact subject.
      return {version:VERSION,id,subject,ref,keptAt,keptFrom,keptChangedAt,kept,base,resolvedAt:''} as PendingReview;
    }
    function create({subject,ref,kept,base=null,keptAt=new Date().toISOString(),origin=null}:{subject:ReviewSubject;ref:string;kept:PendingReview['kept'];base?:NoteFields|null;keptAt?:string;origin?:{device?:string;changedAt?:unknown}|null}){
      const id='pr_'+[...randomBytes(16)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
      const device=String(origin&&origin.device||''),changed=Date.parse(String(origin&&origin.changedAt||''));
      const clean=normalize({version:VERSION,id,subject,ref,keptAt:new Date(keptAt).toISOString(),keptFrom:DEVICE.test(device)?device:'',keptChangedAt:Number.isFinite(changed)?new Date(changed).toISOString():'',kept,base,resolvedAt:''});
      if(!clean)throw new TypeError('A version kept for review is invalid.');
      return clean;
    }
    function resolved(review:unknown,resolvedAt=new Date().toISOString()){
      const clean=normalize(review);if(!clean)throw new TypeError('The review to resolve is invalid.');
      return clean.resolvedAt?clean:normalize({...clean,keptFrom:'',keptChangedAt:'',kept:null,base:null,resolvedAt:new Date(resolvedAt).toISOString()});
    }
    // The PendingReview codec is the single authority for the meaning of
    // kept alternatives. Saving metadata is not Saved Day evidence; Saved
    // Plan timestamps are not authored plan content. Do not discard a note's
    // retained field mask or a session's study evidence.
    function savedPlanMeaning(plan:PersonalData['plans']['savedPlans'][number]|null|undefined){
      return plan?{id:plan.id,label:plan.label,scheduleText:plan.scheduleText}:null;
    }
    function meaningfulValue(subject:ReviewSubject,value:PendingReview['kept']){
      if(!value||typeof value!=='object')return null;
      if(subject==='savedDay'){
        const {savedAt:_savedAt,updatedAt:_updatedAt,sourceRevision:_sourceRevision,...content}=value as DailyRecord;
        return content;
      }
      if(subject==='personal'){
        const personal=value as PersonalData;
        return {preferences:personal.preferences,draft:personal.plans.draft,defaultId:personal.plans.defaultId,savedPlans:personal.plans.savedPlans.map(savedPlanMeaning)};
      }
      if(subject==='session')return ActiveSessionCodec.contentValue(value);
      if(subject==='note')return value; // Retained title/text fields only.
      return null;
    }
    function sameMeaning(subject:ReviewSubject,a:PendingReview['kept'],b:PendingReview['kept']){
      if(a===null||b===null)return a===null&&b===null;
      const left=meaningfulValue(subject,a),right=meaningfulValue(subject,b);
      return !!left&&!!right&&sameDataValue(left,right);
    }
    function matchesCurrent(subject:ReviewSubject,current:PendingReview['kept']|undefined,kept:PendingReview['kept']){
      if(!current||!kept)return false;
      if(subject==='note'){
        // A retained Note may hold only the title or text which differed.
        return Object.entries(kept).every(([field,value])=>sameDataValue((current as NoteFields)[field as keyof NoteFields],value));
      }
      if(subject==='session'){
        // Study-content equality may deduplicate redundant retained versions,
        // but only a suspended, same-owner canonical session proves that a
        // kept Active Session has actually been applied.
        return (current as ActiveSession).status==='suspended'&&(current as ActiveSession).runningOn===(kept as ActiveSession).runningOn&&
          sameMeaning(subject,current,kept);
      }
      return sameMeaning(subject,current,kept);
    }
    // Equivalent open conflicts belong to one review, even if two devices
    // independently minted different ids for that same kept value and base.
    // Resolved reviews deliberately lack the kept content, so they cannot
    // suppress a separate future conflict that happens to look similar.
    function sameOpen(a:PendingReview|null|undefined,b:PendingReview|null|undefined){
      if(!a||!b||a.resolvedAt||b.resolvedAt||a.subject!==b.subject||a.ref!==b.ref||
          !sameDataValue(a.base,b.base))return false;
      return sameMeaning(a.subject,a.kept,b.kept);
    }
    // Reviews merge by id: a resolved one wins, so a review resolved on any
    // device ends everywhere. Only the newest resolved ones are kept, as many
    // as may wait at once.
    function merge(lists:readonly (readonly unknown[]|null|undefined)[],limit:number){
      const byId=new Map<string,PendingReview>();
      for(const list of lists)for(const raw of list||[]){
        const review=normalize(raw);if(!review)throw new TypeError('A version kept for review is invalid.');
        const held=byId.get(review.id);
        if(!held||review.resolvedAt&&(!held.resolvedAt||review.resolvedAt>held.resolvedAt))byId.set(review.id,review);
      }
      const open=[...byId.values()].filter(review=>!review.resolvedAt).sort((a,b)=>a.keptAt.localeCompare(b.keptAt)||a.id.localeCompare(b.id)),bySubject=new Map<string,PendingReview[]>();
      for(const review of open){
        const key=review.subject+':'+review.ref,peers=bySubject.get(key)||[];
        if(peers.some((previous:PendingReview)=>sameOpen(previous,review)))byId.set(review.id,resolved(review)!);
        else{peers.push(review);bySubject.set(key,peers);}
      }
      const all=[...byId.values()],remaining=all.filter(review=>!review.resolvedAt),done=all.filter(review=>review.resolvedAt).sort((a,b)=>b.resolvedAt.localeCompare(a.resolvedAt)||a.id.localeCompare(b.id)).slice(0,Math.max(0,Number(limit)||0));
      return [...remaining,...done].sort((a,b)=>a.id.localeCompare(b.id));
    }
    // The rich texts a stored review holds, which may use attachments.
    function richTexts(review:PendingReview|null|undefined){
      const kept=review&&!review.resolvedAt?review.kept:null;if(!kept||!review)return [];
      const values=review.subject==='note'?[(kept as NoteFields).text,review.base&&review.base.text]:review.subject==='savedDay'?[(kept as DailyRecord).reflection]:review.subject==='session'?[(kept as ActiveSession).snapshot&&(kept as ActiveSession).snapshot.review&&(kept as ActiveSession).snapshot.review.reflection]:[];
      return values.filter(value=>typeof value==='string'&&value);
    }
    return freeze({format:'study-director.pending-review-codec',contractVersion:1,version:VERSION,normalize,create,resolved,merge,sameOpen,sameMeaning,matchesCurrent,meaningfulValue,savedPlanMeaning,richTexts});
  }

  return freeze({
    format:'study-director.record-codecs',
    contractVersion:1,
    createDailyRecordCodec,
    createActiveSessionCodec,
    createPersonalDataCodec,
    createPendingReviewCodec
  });
};
registry.define('record-codecs',1,createModule);
return createModule;
})();
export type RecordCodecsModule=ReturnType<typeof sdRecordCodecsFactory>;
