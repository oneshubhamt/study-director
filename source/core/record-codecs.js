(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,functionPort:functions}=registry.contracts;
registry.define('record-codecs',1,()=>{
  const freeze=Object.freeze;
  function createDailyRecordCodec(input){
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
    function optionalEditorContent(value,plainMax){
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
function isSupportedSavedDate(value){
  return isValidIsoDate(value)&&String(value)>=APP_LIMITS.minSupportedSavedDate&&String(value)<=todayISO();
}
function summarizeAreasFromTasks(tasks){
  const byArea=KeyedRecord.create();
  (tasks||[]).forEach(t=>{
    if(!isWorkBlock(t))return;
    const key=(taskAreaValue(t)||'Other').trim()||'Other';
    if(!byArea[key])byArea[key]={planned:0,completed:0,actual:0,activityBlocks:0};
    byArea[key].planned+=(Number(t.dur)||0);
    byArea[key].completed+=(Number(t.dur)||0)*(Number(t.completion)||0)/100;
    byArea[key].actual+=Math.max(0,Number(t.actualSeconds)||0)/60;
    const outcome=classifyTaskOutcome(t);
    if([TASK_OUTCOMES.FULL,TASK_OUTCOMES.PARTIAL,TASK_OUTCOMES.ZERO_OUTPUT,TASK_OUTCOMES.FINISHED_UNVERIFIED].includes(outcome))byArea[key].activityBlocks+=1;
  });
  return byArea;
}
function sanitizeAreaSummary(areaSummary){
  const clean=KeyedRecord.create();
  const maxMinutes=APP_LIMITS.maxDurationMinutes*APP_LIMITS.maxTasksPerDay;
  Object.entries((areaSummary&&typeof areaSummary==='object')?areaSummary:{}).slice(0,APP_LIMITS.maxTasksPerDay).forEach(([label,row])=>{
    const safeLabel=clampText(displayAreaName(label)||'Other',APP_LIMITS.maxAreaNameChars);
    const source=(row&&typeof row==='object')?row:{};
    clean[safeLabel||'Other']={
      planned:boundedNumber(source.planned,{min:0,max:maxMinutes,fallback:0}),
      completed:boundedNumber(source.completed,{min:0,max:maxMinutes,fallback:0}),
      actual:boundedNumber(source.actual,{min:0,max:maxMinutes,fallback:0}),
      activityBlocks:boundedInt(source.activityBlocks,{min:0,max:APP_LIMITS.maxTasksPerDay,fallback:0})
    };
  });
  return clean;
}
function buildDailyRecordSummary(r){
  const source=materializeDailyRecordView(r)||{};
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
  const tasks=Array.isArray(source.tasks)?source.tasks:[];
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
function compactPauseEvent(ev){
  const row=(ev&&typeof ev==='object')?ev:null;
  if(!row)return null;
  const rawType=clampText(row.type||row.reason||'manual',32).trim().toLowerCase();
  const type=['pomodoro','manual','inactive-gap'].includes(rawType)?rawType:'manual';
  const seconds=boundedNumber(row.seconds,{min:0,max:APP_LIMITS.maxDurationMinutes*60,fallback:0});
  if(seconds<=0)return null;
  const event={
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
function compactPauseEvents(events,extraEvent=null){
  const out=[];
  (Array.isArray(events)?events:[]).slice(-APP_LIMITS.maxPauseEventsPerTask).forEach(ev=>{
    const clean=compactPauseEvent(ev);
    if(clean)out.push(clean);
  });
  const extra=compactPauseEvent(extraEvent);
  if(extra)out.push(extra);
  return out.slice(-APP_LIMITS.maxPauseEventsPerTask);
}
function compactRealTimeSnapshot(snapshot){
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
function sanitizeTimerRuntimePayload(runtime){
  if(!runtime||typeof runtime!=='object'||runtime.version!==2)return null;
  const taskId=clampText(runtime.taskId||'',80),rawState=runtime.timerState&&typeof runtime.timerState==='object'?runtime.timerState:null;
  if(!taskId||taskId.startsWith('@index:')||!rawState)return null;
  const startMs=normalizeImportedEpochMillis(rawState.startMs,0);
  const durationSec=boundedNumber(rawState.durationSec,{min:1,max:APP_LIMITS.maxDurationMinutes*60,fallback:0});
  if(!startMs||!durationSec)return null;
  const clean={
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
  const rawNudge=runtime.nudgeCycle&&typeof runtime.nudgeCycle==='object'?runtime.nudgeCycle:null;
  if(rawNudge)clean.nudgeCycle={startSec:boundedNumber(rawNudge.startSec,{min:0,max:APP_LIMITS.maxDurationMinutes*60,fallback:0})};
  const rawGap=runtime.pendingInactiveGap&&typeof runtime.pendingInactiveGap==='object'?runtime.pendingInactiveGap:null;
  if(rawGap){
    const gapMs=boundedNumber(rawGap.gapMs,{min:0,max:APP_LIMITS.maxDurationMinutes*60*1000,fallback:0});
    const detectedAtMs=normalizeImportedEpochMillis(rawGap.detectedAtMs,0);
    if(gapMs>0&&detectedAtMs>0)clean.pendingInactiveGap={
      gapMs:Math.round(gapMs),promptMs:Math.round(boundedNumber(rawGap.promptMs,{min:0,max:APP_LIMITS.maxDurationMinutes*60*1000,fallback:0})),
      detectedAtMs:Math.round(detectedAtMs),lastMs:Math.round(normalizeImportedEpochMillis(rawGap.lastMs,0)),source:clampText(rawGap.source||'restore',40)
    };
  }
  const rawBreak=runtime.activeBreak&&typeof runtime.activeBreak==='object'?runtime.activeBreak:null;
  if(clean.paused&&rawBreak){
    const type=rawBreak.type==='pomodoro'?'pomodoro':'manual',startedAtMs=normalizeImportedEpochMillis(rawBreak.startedAtMs,0);
    if(startedAtMs)clean.activeBreak={
      type,startedAtMs:Math.round(startedAtMs),plannedSeconds:type==='pomodoro'?boundedNumber(rawBreak.plannedSeconds,{min:60,max:3600,fallback:defaultBreakSeconds()}):0,
      cueIssuedAt:type==='pomodoro'&&rawBreak.cueIssuedAt?normalizeImportedTimestamp(rawBreak.cueIssuedAt,null):null,doneNotified:!!rawBreak.doneNotified
    };
  }
  return clean;
}
function compactAdjustedSchedule(adjustments){
  if(!adjustments||typeof adjustments!=='object')return {};
  const clean={};
  Object.entries(adjustments).slice(0,APP_LIMITS.maxTasksPerDay).forEach(([idx,entry])=>{
    if(!entry||typeof entry!=='object')return;
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
function normalizeDailyResultEntry(value,scheduleEntry=null){
  if(!value||typeof value!=='object')return null;
  const clean={};
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
function dailyRecordMetricsFromEvidence(schedule,results,{preserveMissing=false}={}){
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
function sanitizeCurrentScheduleEntry(row){
  if(!row||typeof row!=='object'||Array.isArray(row))return null;
  const expected=['id','start','duration','name','kind','area','measure','target'];
  if(Object.keys(row).sort().join('|')!==expected.sort().join('|'))return null;
  const id=optionalText(row.id,80),start=typeof row.start==='string'&&isValidHHMM(row.start)&&normalizeHHMM(row.start)===row.start?row.start:null;
  const duration=optionalBoundedNumber(row.duration,{min:0,max:APP_LIMITS.maxDurationMinutes,integer:true});
  const name=optionalText(row.name,APP_LIMITS.maxTaskNameChars),kind=['work','support','fixed'].includes(row.kind)?row.kind:null;
  const area=optionalText(row.area,APP_LIMITS.maxAreaNameChars),measure=optionalText(row.measure,APP_LIMITS.maxUnitChars);
  const target=row.target===null?null:optionalBoundedNumber(row.target,{min:0,max:1000000});
  if(!id||id.startsWith('@index:')||start===null||duration===null||name===null||!kind||area===null||measure===null||(row.target!==null&&target===null))return null;
  const clean={id,start,duration,name,kind,area,measure,target};
  return sameDataValue(row,clean)?clean:null;
}
function sanitizeCurrentDailyRecord(record){
  if(!record||typeof record!=='object'||Array.isArray(record)||Number(record.version)!==DATA_CONTRACT.schemas.DailyRecord.version||!isSupportedSavedDate(record.date))return null;
  const recordKind=record.recordKind==='diary'?'diary':record.recordKind==='study'?'study':null;if(!recordKind)return null;
  const commonExpected=['version','recordKind','date','savedAt','updatedAt','sourceRevision','reflection'];
  const expected=recordKind==='diary'?commonExpected:[...commonExpected,'quote','studyQuality','realTimeSnapshot','schedule','results','practiceRuns','carryForwardDraft'];
  if(Object.keys(record).sort().join('|')!==expected.sort().join('|'))return null;
  const date=String(record.date),savedAt=normalizeImportedTimestamp(record.savedAt,null),updatedAt=normalizeImportedTimestamp(record.updatedAt,null),sourceRevision=optionalBoundedNumber(record.sourceRevision,{min:0,max:Number.MAX_SAFE_INTEGER,integer:true});
  const reflection=optionalEditorContent(record.reflection,APP_LIMITS.maxReflectionChars);
  if(savedAt===null||updatedAt===null||sourceRevision===null||reflection===null)return null;
  if(recordKind==='diary'){
    if(!String(reflection||'').trim())return null;
    const clean={version:DATA_CONTRACT.schemas.DailyRecord.version,recordKind,date,savedAt,updatedAt,sourceRevision,reflection};
    return sameDataValue(record,clean)?clean:null;
  }
  const quote=optionalText(record.quote,APP_LIMITS.maxQuoteChars),carryForwardDraft=optionalText(record.carryForwardDraft,APP_LIMITS.maxCarryForwardChars);
  const studyQuality=record.studyQuality===null?null:optionalBoundedNumber(record.studyQuality,{min:1,max:5,integer:true});
  if(quote===null||carryForwardDraft===null||(record.studyQuality!==null&&studyQuality===null)||!Array.isArray(record.schedule)||!record.results||typeof record.results!=='object'||Array.isArray(record.results)||!Array.isArray(record.practiceRuns))return null;
  if(record.schedule.length>APP_LIMITS.maxTasksPerDay||record.practiceRuns.length>APP_LIMITS.maxPracticeRunsPerDay)return null;
  const schedule=[],ids=new Set();
  for(const row of record.schedule){const clean=sanitizeCurrentScheduleEntry(row);if(!clean||ids.has(clean.id))return null;schedule.push(clean);ids.add(clean.id);}
  const results=KeyedRecord.create();
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
  const clean={version:DATA_CONTRACT.schemas.DailyRecord.version,recordKind,date,savedAt,updatedAt,sourceRevision,quote,reflection,studyQuality,realTimeSnapshot,schedule,results,practiceRuns,carryForwardDraft};
  return sameDataValue(record,clean)?clean:null;
}
function createDiaryRecord(date,reflection,options={}){
  if(!isSupportedSavedDate(date))return null;
  const text=clampEditorContent(reflection,APP_LIMITS.maxReflectionChars);if(!String(text||'').trim()||!editorContentWithinLimits(text))return null;
  const now=normalizeImportedTimestamp(options.updatedAt||options.savedAt,new Date().toISOString());if(!now)return null;
  const savedAt=normalizeImportedTimestamp(options.savedAt,now),updatedAt=normalizeImportedTimestamp(options.updatedAt,now);
  const candidate={version:DATA_CONTRACT.schemas.DailyRecord.version,recordKind:'diary',date:String(date),savedAt,updatedAt,sourceRevision:boundedInt(options.sourceRevision,{min:0,max:Number.MAX_SAFE_INTEGER,fallback:0}),reflection:text};
  return sanitizeCurrentDailyRecord(candidate);
}
function sanitizeCurrentAreaNote(value,keyHint=''){
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:null;if(!source||Number(source.version)!==DATA_CONTRACT.schemas.AreaNote.version)return null;
  const expected=['version','key','label','text','updatedAt'];
  if(Object.keys(source).sort().join('|')!==expected.sort().join('|'))return null;
  const key=normalizeAreaName(source.key||keyHint),label=optionalText(source.label,APP_LIMITS.maxAreaNameChars),text=optionalEditorContent(source.text,APP_LIMITS.maxNoteChars);
  if(!key||label===null||text===null)return null;
  const updatedAt=normalizeImportedTimestamp(source.updatedAt,null);if(!updatedAt)return null;
  const clean={version:DATA_CONTRACT.schemas.AreaNote.version,key,label,text,updatedAt};
  return sameDataValue(source,clean)?clean:null;
}
function dailyResultAdjustedEnd(entry,result){
  const start=result&&result.adjustedStart||entry.start;
  return studyMinuteToHHMM(clockMinuteToStudyMinute(t2m(start))+entry.duration);
}
function materializeDailyRecordView(record){
  const doc=sanitizeCurrentDailyRecord(record);
  if(!doc)return null;
  const dayMeta=dateInsightsMeta(doc.date);
  if(doc.recordKind==='diary')return {...doc,dayOfWeek:dayMeta.dayOfWeek,dayName:dayMeta.dayName};
  const displaySchedule=Array.isArray(doc.schedule)?doc.schedule:[],displayResults=doc.results&&typeof doc.results==='object'?doc.results:KeyedRecord.create();
  const workEntries=displaySchedule.filter(isWorkBlock),workCount=workEntries.length;
  let workOrdinal=0;
  const tasks=[];const adjustedSchedule={};
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
function sanitizeDailyRecordSummary(summary){
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
function materializeDailyRecordSummary(summary){
  const clean=sanitizeDailyRecordSummary(summary);if(!clean)return null;const meta=dateInsightsMeta(clean.date);return {...clean,dayOfWeek:meta.dayOfWeek,dayName:meta.dayName};
}
    return freeze({
      format:'study-director.daily-record-codec',
      contractVersion:1,
      buildDailyRecordSummary,compactPauseEvents,compactRealTimeSnapshot,
      sanitizeTimerRuntimePayload,compactAdjustedSchedule,normalizeDailyResultEntry,
      dailyRecordMetricsFromEvidence,sanitizeCurrentDailyRecord,createDiaryRecord,
      sanitizeCurrentAreaNote,materializeDailyRecordView,sanitizeDailyRecordSummary,materializeDailyRecordSummary,isSupportedSavedDate
    });
  }
  function createActiveSessionCodec(input){
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
  function sanitizeSnapshotProgress(value){
    if(!value||typeof value!=='object')return null;
    const row={};
    const done=parseProgressNumber(value.done);
    const total=parseProgressNumber(value.total);
    if(done!==null)row.done=Math.max(0,Math.min(1000000,done));
    if(total!==null&&total>0)row.total=Math.max(0,Math.min(1000000,total));
    return Object.keys(row).length?row:null;
  }
  function sanitizeSnapshotClock(value){
    if(!value||typeof value!=='object')return null;
    const row={};
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
  function sanitizeSnapshotActualRecord(value){
    if(!value||typeof value!=='object')return null;
    const row={};
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
    if(Array.isArray(value.sessions))row.sessions=value.sessions.slice(-APP_LIMITS.maxLiveSessionsPerTask).map(session=>({
      startedAt:normalizeImportedTimestamp(session&&session.startedAt,null),
      durationSec:boundedNumber(session&&session.durationSec,{min:0,max:APP_LIMITS.maxDurationMinutes*60,fallback:0}),
      endedAt:normalizeImportedTimestamp(session&&session.endedAt,null),
      activeSeconds:boundedNumber(session&&session.activeSeconds,{min:0,max:APP_LIMITS.maxDurationMinutes*60,fallback:0}),
      pausedSeconds:boundedNumber(session&&session.pausedSeconds,{min:0,max:APP_LIMITS.maxDurationMinutes*60,fallback:0}),
      pauseCount:boundedInt(session&&session.pauseCount,{min:0,max:1000,fallback:0})
    }));
    if(Array.isArray(value.pauseEvents))row.pauseEvents=compactPauseEvents(value.pauseEvents);
    return Object.keys(row).length?row:null;
  }
  function sanitizeSnapshotTaskState(taskState){
    const out=KeyedRecord.create();
    Object.entries((taskState&&typeof taskState==='object'&&!Array.isArray(taskState))?taskState:{})
      .slice(0,APP_LIMITS.maxTasksPerDay)
      .forEach(([rawTaskId,value])=>{
        if(!value||typeof value!=='object')return;
        const taskId=clampText(rawTaskId||'',80);
        if(!taskId||taskId.startsWith('@index:')||Object.prototype.hasOwnProperty.call(out,taskId))return;
        const row={};
        if(value.resolvedState==='done'||value.resolvedState==='skipped')row.resolvedState=value.resolvedState;
        const completion=parseProgressNumber(value.completion);
        if(completion!==null)row.completion=CompletionModel.clampPercent(completion);
        const source=normalizeCompletionSource(value.completionSource);
        if(source!==COMPLETION_SOURCES.NONE)row.completionSource=source;
        const progress=sanitizeSnapshotProgress(value.progress);
        if(progress)row.progress=progress;
        const actual=value.actual&&typeof value.actual==='object'?value.actual:null;
        if(actual){
          const actualRow={};
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
  function sanitizeSnapshotScheduleAdjustments(adjustments){
    const out=KeyedRecord.create();
    Object.entries((adjustments&&typeof adjustments==='object'&&!Array.isArray(adjustments))?adjustments:{})
      .slice(0,APP_LIMITS.maxTasksPerDay)
      .forEach(([rawTaskId,entry])=>{
        if(!entry||typeof entry!=='object')return;
        const taskId=clampText(rawTaskId||'',80);
        if(!taskId||taskId.startsWith('@index:')||Object.prototype.hasOwnProperty.call(out,taskId))return;
        const startMin=boundedInt(entry.startMin,{min:0,max:APP_LIMITS.maxDurationMinutes*2,fallback:null});
        const endMin=boundedInt(entry.endMin,{min:0,max:APP_LIMITS.maxDurationMinutes*2,fallback:null});
        if(startMin===null||endMin===null||endMin<=startMin)return;
        out[taskId]={startMin,endMin,reason:clampText(entry.reason||'',80),changedAt:normalizeImportedTimestamp(entry.changedAt,null)};
      });
    return out;
  }
  function sanitizeSnapshotReview(value){
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
  function normalizeCurrentSessionSnapshot(snapshot,expectedDate,expectedFingerprint='',expectedSessionRevision=null){
    if(!snapshot||typeof snapshot!=='object'||Number(snapshot.version)!==DATA_CONTRACT.schemas.SessionSnapshot.version||snapshot.date!==expectedDate)return null;
    const fingerprint=clampText(snapshot.fingerprint||'',APP_LIMITS.maxScheduleChars);
    if(!fingerprint||(expectedFingerprint&&fingerprint!==expectedFingerprint))return null;
    const rawCurrentTaskId=clampText(snapshot.currentTaskId||'',80);
    const currentTaskId=rawCurrentTaskId&&!rawCurrentTaskId.startsWith('@index:')?rawCurrentTaskId:null;
    const clean={
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
    return clean;
  }
  function sanitizeSessionSnapshot(snapshot,expectedDate,expectedFingerprint='',expectedSessionRevision=null){
    const clean=normalizeCurrentSessionSnapshot(snapshot,expectedDate,expectedFingerprint,expectedSessionRevision);
    return clean&&sameDataValue(snapshot,clean)?clean:null;
  }
  function normalizeCurrentActiveSession(session){
    if(!session||typeof session!=='object'||Number(session.version)!==DATA_CONTRACT.schemas.ActiveSession.version)return null;
    const revision=boundedNumber(session.revision,{min:1,max:Number.MAX_SAFE_INTEGER,fallback:0});
    if(!Number.isSafeInteger(revision))return null;
    const scheduleText=clampText(String(session.scheduleText||'').trim(),APP_LIMITS.maxScheduleChars);
    const clean={
      id:ACTIVE_SESSION_ID,
      type:'activeSession',
      version:DATA_CONTRACT.schemas.ActiveSession.version,
      revision,
      date:String(session.date||''),
      status:session.status==='suspended'?'suspended':'active',
      scheduleText,
      snapshot:null,
      suspendedAt:session.suspendedAt?normalizeImportedTimestamp(session.suspendedAt,null):null,
      updatedAt:normalizeImportedTimestamp(session.updatedAt,new Date().toISOString())
    };
    if(!isValidIsoDate(clean.date)||!isCanonicalScheduleText(clean.scheduleText))return null;
    clean.snapshot=normalizeCurrentSessionSnapshot(session.snapshot,clean.date,activeSessionScheduleFingerprint(clean),revision);
    if(!clean.snapshot)return null;
    return clean;
  }
  function sanitizeCurrentActiveSession(session){
    if(!session||typeof session!=='object'||Array.isArray(session))return null;
    const expected=['id','type','version','revision','date','status','scheduleText','snapshot','suspendedAt','updatedAt'];
    if(Object.keys(session).sort().join('|')!==expected.sort().join('|'))return null;
    const clean=normalizeCurrentActiveSession(session);
    return clean&&sameDataValue(session,clean)?clean:null;
  }
  return Object.freeze({sanitizeSessionSnapshot,sanitizeCurrent:sanitizeCurrentActiveSession,normalize:normalizeCurrentActiveSession,canonicalize:normalizeCurrentActiveSession});
  }
  // Portable user data is an explicit allowlist, independent of sync destinations.
  function createPersonalDataCodec(limits){
    const maxDraft=limits.maxScheduleChars||100000,maxBytes=1024*1024;
    const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
    const text=(v,max,label)=>{if(typeof v!=='string'||v.length>max)throw new Error(`Invalid ${label}.`);return v;};
    function plans(raw){
      if(!object(raw)||!Array.isArray(raw.savedPlans)||raw.savedPlans.length>100)throw new Error('Invalid saved-plan collection (100 maximum).');
      const ids=new Set();
      const savedPlans=raw.savedPlans.map(p=>{
        if(!object(p)||typeof p.id!=='string'||!/^plan-[a-z0-9-]{8,64}$/.test(p.id)||ids.has(p.id))throw new Error('Invalid or duplicate saved-plan identity.');ids.add(p.id);
        if(!Number.isFinite(Date.parse(p.createdAt))||!Number.isFinite(Date.parse(p.updatedAt)))throw new Error('Invalid saved-plan dates.');
        const label=text(p.label,80,'plan name').trim();if(!label)throw new Error('Give the saved plan a name.');
        return {id:p.id,label,scheduleText:text(p.scheduleText,maxDraft,'saved plan'),createdAt:text(p.createdAt,40,'creation date'),updatedAt:text(p.updatedAt,40,'update date')};
      });
      const defaultId=raw.defaultId===null?null:text(raw.defaultId,70,'default plan');
      if(defaultId&&!ids.has(defaultId))throw new Error('Default plan is missing from saved plans.');
      const result={draft:raw.draft===null?null:text(raw.draft,maxDraft,'plan draft'),savedPlans,defaultId};
      if(new TextEncoder().encode(JSON.stringify(result)).length>maxBytes)throw new Error('Saved plans and draft exceed the 1 MiB allowance. Remove an unused plan or shorten it.');
      return result;
    }
    function preferences(raw){
      if(!object(raw))throw new Error('Invalid portable preferences.');
      const result={};
      for(const key of ['studentName','theme','presentation','quote','practiceCueMode']){
        const v=raw[key];if(v===undefined||v===null){result[key]=null;continue}
        result[key]=text(v,key==='quote'?1000:key==='studentName'?(limits.maxStudentNameChars||100):41,key);
        if(key==='practiceCueMode'&&!['quiet','strict'].includes(v))throw new Error('Invalid practice cue.');
        if(['theme','presentation'].includes(key)&&! /^[a-z][a-z0-9-]{0,40}$/.test(v))throw new Error('Invalid display setting.');
      }
      for(const key of ['fontScale','practiceTargetMs']){
        const v=raw[key];if(v===undefined||v===null){result[key]=null;continue}
        if(typeof v!=='number'||!Number.isFinite(v)||(key==='fontScale'?![.95,1,1.08,1.16].includes(v):v<1000||v>86400000))throw new Error(`Invalid ${key}.`);result[key]=v;
      }
      if(raw.nudge==null)result.nudge=null;
      else{const v=raw.nudge;if(!object(v)||typeof v.enabled!=='boolean'||(v.sound!==undefined&&typeof v.sound!=='boolean')||!Number.isInteger(v.nudgeAfter)||v.nudgeAfter<1||v.nudgeAfter>240||!Number.isInteger(v.breakMinutes)||v.breakMinutes<1||v.breakMinutes>60)throw new Error('Invalid reminder preferences.');result.nudge={enabled:v.enabled,...(v.sound===undefined?{}:{sound:v.sound}),nudgeAfter:v.nudgeAfter,breakMinutes:v.breakMinutes};}
      if(Object.hasOwn(raw,'soundMode')){if(!['full','minimal','off'].includes(raw.soundMode))throw new Error('Invalid sound mode.');result.soundMode=raw.soundMode;}
      return result;
    }
    function portablePreferences(raw){
      if(!object(raw))throw new Error('Invalid canonical portable preferences.');
      const clean=preferences(raw),updatedAt=raw.updatedAt==null?null:text(raw.updatedAt,40,'updatedAt');
      if(updatedAt!==null&&!Number.isFinite(Date.parse(updatedAt)))throw new Error('Invalid portable preferences update date.');
      return {version:2,...clean,updatedAt};
    }
    function currentPortablePreferences(raw){
      if(!object(raw)||raw.version!==2)return null;
      try{const clean=portablePreferences(raw);return JSON.stringify(clean)===JSON.stringify(raw)?clean:null;}catch{return null;}
    }
    function normalize(raw){
      if(!object(raw)||raw.version!==2)throw new Error('Unsupported current personal-data version.');
      const expected=['studentName','theme','presentation','quote','practiceCueMode','fontScale','practiceTargetMs','nudge'];
      if(object(raw.preferences)&&Object.hasOwn(raw.preferences,'soundMode'))expected.push('soundMode');
      if(!object(raw.preferences)||Object.keys(raw.preferences).sort().join('|')!==expected.slice().sort().join('|'))throw new Error('Current personal-data Preferences contain unexpected fields.');
      return {version:2,plans:plans(raw.plans),preferences:preferences(raw.preferences)};
    }
    return freeze({plans,preferences,portablePreferences,currentPortablePreferences,normalize,maxBytes});
  }

  return freeze({
    format:'study-director.record-codecs',
    contractVersion:1,
    createDailyRecordCodec,
    createActiveSessionCodec,
    createPersonalDataCodec
  });
});
})();
