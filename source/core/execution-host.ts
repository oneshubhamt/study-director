import type {TaskInput,ScheduleRow} from '../../types/domain.ts';
import type {ScheduleGatewayInput,ScheduleProgressMatch,ScheduleProgressFields,ScheduleProgressEntry,ScheduleProgressSnapshot,ScheduleStartupDecision,ScheduleGatewayOptions} from '../../types/execution-host.ts';
import type {TimerPayload} from '../../types/record-models.ts';
import type {Runtime,InactiveGap} from '../../types/timer-state.ts';
import type {RestoredBreak} from '../../types/timer-engine.ts';
import type {TimerRestorationInput,TimerRestoreCandidate} from '../../types/execution-host.ts';
import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {CompletionEvidenceController,CompletionEvidenceInput,ExecutionAnchorRow,ExecutionHostInput,ExecutionScheduleController,ExecutionScheduleInput,ExecutionScheduleRow,RealTimeScheduleState,RuntimeTaskSessionFields,TaskIdentityPort,TaskResolvedState,TaskSessionField,TaskSessionStore} from '../../types/execution-host.ts';
import type {TimerEngineInput} from '../../types/timer-engine.ts';
import type {CompletionSource} from '../../types/domain.ts';

const sdExecutionHostFactory=(()=>{
'use strict';
const registry=(globalThis as unknown as Record<symbol,unknown>)[Symbol.for('studyDirector.internalModules.v1')] as ModuleRegistration<'execution-host','study-director.execution-host-module'>|undefined;
if(!registry||registry.version!==1)throw new Error('Study Director internal module registry is unavailable.');
const freeze=Object.freeze;
const objectRecord=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
function exactObject(value:unknown,keys:readonly string[],label:string){
  if(!objectRecord(value))throw new TypeError(`${label} must be an object.`);
  const actual=Object.keys(value).sort(),expected=[...keys].sort();
  if(actual.length!==expected.length||actual.some((key,index)=>key!==expected[index]))throw new TypeError(`${label} is incomplete or contains unexpected fields.`);
}
function functions(value:unknown,keys:readonly string[],label:string){
  if(!objectRecord(value)||keys.some(key=>typeof value[key]!=='function'))throw new TypeError(`${label} is incomplete.`);
}
function createTaskSessionState(taskIdentity:TaskIdentityPort):Readonly<TaskSessionStore>{
  functions(taskIdentity,['idAt','indexMap','indexForId'],'Task session identity');
  type Entry={taskId:string;resolvedState:TaskResolvedState;fields:Partial<RuntimeTaskSessionFields>};
  const fieldNames:readonly TaskSessionField[]=freeze(['completion','completionSource','notes','actualTime','actualClock','actualRecords']);
  const validField=(field:unknown):field is TaskSessionField=>typeof field==='string'&&fieldNames.some(name=>name===field);
  const byTaskId=new Map<string,Entry>();
  function entry(index:number,create=false){
    const taskId=taskIdentity.idAt(index);
    if(!taskId)return null;
    let row=byTaskId.get(taskId)||null;
    if(!row&&create){row={taskId,resolvedState:null,fields:{}};byTaskId.set(taskId,row);}
    return row;
  }
  function getField<K extends TaskSessionField>(index:number,field:K):RuntimeTaskSessionFields[K]|undefined{
    if(!validField(field))return undefined;
    return entry(index,false)?.fields[field];
  }
  function prune(row:Entry|null){
    if(row&&row.resolvedState===null&&Object.keys(row.fields).length===0)byTaskId.delete(row.taskId);
  }
  function deleteField<K extends TaskSessionField>(index:number,field:K){
    if(!validField(field))return false;
    const row=entry(index,false);
    if(!row||row.fields[field]===undefined)return false;
    delete row.fields[field];
    prune(row);
    return true;
  }
  function setField<K extends TaskSessionField>(index:number,field:K,value:RuntimeTaskSessionFields[K]|undefined){
    if(!validField(field))return false;
    if(value===undefined)return deleteField(index,field);
    const row=entry(index,true);
    if(!row)return false;
    row.fields[field]=value;
    return true;
  }
  function resolvedState(index:number){return entry(index,false)?.resolvedState||null;}
  function setResolved(index:number,state:TaskResolvedState){
    const next=state==='done'||state==='skipped'?state:null,row=entry(index,next!==null);
    if(!row||row.resolvedState===next)return false;
    row.resolvedState=next;
    prune(row);
    return true;
  }
  function isDone(index:number){return resolvedState(index)==='done';}
  function isSkipped(index:number){return resolvedState(index)==='skipped';}
  function isResolved(index:number){return resolvedState(index)!==null;}
  function toggleDone(index:number){
    if(isSkipped(index)){setResolved(index,null);return 'reopened-skip' as const;}
    setResolved(index,isDone(index)?null:'done');
    return resolvedState(index);
  }
  function indices(){
    const out:number[]=[],indexMap=taskIdentity.indexMap();
    byTaskId.forEach(row=>{
      const index=taskIdentity.indexForId(row.taskId,indexMap);
      if(index!==null)out.push(index);
    });
    return [...new Set(out)].sort((a,b)=>a-b);
  }
  function indexSnapshot<K extends TaskSessionField>(field:K){
    const out:Record<string,RuntimeTaskSessionFields[K]>={};
    if(!validField(field))return out;
    indices().forEach(index=>{
      const value=getField(index,field);
      if(value!==undefined)out[String(index)]=value;
    });
    return out;
  }
  function resolvedIndices(state:'done'|'skipped'){return indices().filter(index=>resolvedState(index)===state);}
  function clear(){byTaskId.clear();}
  return freeze({
    format:'study-director.task-session-state' as const,contractVersion:1 as const,
    getField,setField,deleteField,indexSnapshot,resolvedState,setResolved,isDone,isSkipped,isResolved,toggleDone,resolvedIndices,indices,clear
  });
}
function createExecutionSchedule(input:Readonly<ExecutionScheduleInput>):Readonly<ExecutionScheduleController>{
  const {tasks,timerState,taskSessionState,model,time,compactAdjustedSchedule,invalidateDerived}=input;
  functions(model,['chronologicalRows','startMinutes','isFixed','isTrackable','areaValue','measureValue','targetValue'],'Execution schedule model');
  functions(time,['clockToMinute','clockMinuteToStudyMinute','studyMinuteToHHMM','currentStudySecond','formatDuration','minuteOfDay'],'Execution time model');
  functions(input,['compactAdjustedSchedule','invalidateDerived'],'Execution schedule input');
  function rebuildOriginalSchedule(){
    const absoluteStarts=model.startMinutes(tasks.map(task=>({...task})));
    const rows=tasks.map((task,index)=>({
      idx:index,id:task.id,name:task.name,kind:task.kind,area:model.areaValue(task),start:task.start,dur:task.dur,
      plannedStartMin:absoluteStarts[index]??0,plannedEndMin:(absoluteStarts[index]??0)+task.dur,
      measure:model.measureValue(task,''),target:model.targetValue(task)
    }));
    timerState.originalSchedule=rows;
    return rows;
  }
  function resetScheduleLayers(){
    rebuildOriginalSchedule();
    timerState.adjustedSchedule={};
    invalidateDerived({adjustments:true,render:true});
  }
  const originalRow=(index:number)=>timerState.originalSchedule[index]||null;
  function originalStartMin(index:number){
    const row=originalRow(index);
    return row?row.plannedStartMin:(tasks[index]?time.clockMinuteToStudyMinute(time.clockToMinute(tasks[index]!.start)):0);
  }
  function originalEndMin(index:number){
    const row=originalRow(index);
    return row?row.plannedEndMin:(tasks[index]?time.clockMinuteToStudyMinute(time.clockToMinute(tasks[index]!.start))+tasks[index]!.dur:0);
  }
  const adjustedEntry=(index:number)=>timerState.adjustedSchedule[String(index)]||null;
  function adjustedStartMin(index:number){const row=adjustedEntry(index);return row&&Number.isFinite(Number(row.startMin))?Number(row.startMin):originalStartMin(index);}
  function adjustedEndMin(index:number){const row=adjustedEntry(index);return row&&Number.isFinite(Number(row.endMin))?Number(row.endMin):originalEndMin(index);}
  function hasAdjustedTiming(index:number){return adjustedStartMin(index)!==originalStartMin(index)||adjustedEndMin(index)!==originalEndMin(index);}
  function scheduleWindowLabel(index:number,startMin=adjustedStartMin(index),endMin=adjustedEndMin(index)){
    const live=`${time.studyMinuteToHHMM(startMin)}-${time.studyMinuteToHHMM(endMin)}`;
    const original=`${time.studyMinuteToHHMM(originalStartMin(index))}-${time.studyMinuteToHHMM(originalEndMin(index))}`;
    return hasAdjustedTiming(index)?`${live} · orig ${original}`:live;
  }
  function sanitizeRuntimeAdjustedSchedule(value:unknown){
    const clean={...compactAdjustedSchedule(value)};
    Object.keys(clean).forEach(key=>{
      const index=Number(key),entry=clean[key];
      if(!entry||!tasks[index]||Number(entry.endMin)<=Number(entry.startMin)||(model.isTrackable(tasks[index])&&Number(entry.endMin)>time.dayMinutes))delete clean[key];
    });
    return clean;
  }
  function effectiveNowMin(date=new Date()){return time.clockMinuteToStudyMinute(time.minuteOfDay(date));}
  function plannedRows(){
    const rows=tasks.map((task,index)=>({idx:index,t:task,start:adjustedStartMin(index),end:adjustedEndMin(index),plannedStart:originalStartMin(index),plannedEnd:originalEndMin(index),adjusted:hasAdjustedTiming(index)}));
    return model.chronologicalRows(rows);
  }
  function isInsideAdjustedWindow(index:number|null|undefined,date=new Date()){
    if(index===null||index===undefined||!tasks[index])return false;
    const now=effectiveNowMin(date);
    return now>=adjustedStartMin(index)&&now<adjustedEndMin(index);
  }
  function remainingWindowSeconds(index:number|null|undefined,date=new Date()){
    if(index===null||index===undefined||!tasks[index])return 0;
    const now=effectiveNowMin(date),start=adjustedStartMin(index),end=adjustedEndMin(index);
    if(now>=start&&now<end)return Math.max(1,Math.ceil(end*60-time.currentStudySecond(date)));
    return Math.max(60,Math.round((tasks[index]!.dur||1)*60));
  }
  function fixedAnchorRowsFrom(startIndex:number){
    const rows:ExecutionAnchorRow[]=[];
    for(let index=Math.max(0,startIndex||0);index<tasks.length;index++){
      const task=tasks[index]!;
      if(model.isFixed(task))rows.push({idx:index,t:task,start:originalStartMin(index),end:originalEndMin(index)});
    }
    return rows;
  }
  function avoidFixedAnchorOverlap(startMin:number,durationMin:number,anchors:readonly Pick<ExecutionScheduleRow,'start'|'end'>[]){
    let start=startMin,guard=0;
    while(guard++<200){
      const hit=(anchors||[]).find(anchor=>start<anchor.end&&(start+durationMin)>anchor.start);
      if(!hit)break;
      start=hit.end;
    }
    return start;
  }
  function nextIncompleteTrackableFrom(fromIndex:number){
    for(let index=Math.max(0,fromIndex||0);index<tasks.length;index++)if(model.isTrackable(tasks[index])&&!taskSessionState.isResolved(index))return index;
    return null;
  }
  function findNextIncompleteTrackableAfter(index:number){
    const rows=model.chronologicalRows(tasks.map((task,idx)=>({idx,start:adjustedStartMin(idx),end:adjustedEndMin(idx),t:task})).filter(row=>model.isTrackable(row.t)));
    const current=rows.findIndex(row=>row.idx===index),next=rows.slice(Math.max(0,current+1)).find(row=>!taskSessionState.isResolved(row.idx));
    return next?next.idx:tasks.length;
  }
  function buildLiveTimeline(){
    return model.chronologicalRows(tasks.map((task,index)=>({
      kind:'task' as const,idx:index,t:task,plannedStart:originalStartMin(index),plannedEnd:originalEndMin(index),
      startMin:adjustedStartMin(index),endMin:adjustedEndMin(index),completed:taskSessionState.getField(index,'actualTime')!==undefined,
      active:index===timerState.currentIndex&&model.isTrackable(task),adjusted:hasAdjustedTiming(index),
      start:adjustedStartMin(index),end:adjustedEndMin(index)
    }))).map(({start:_start,end:_end,...row})=>row);
  }
  function getRealTimeState(date=new Date()):RealTimeScheduleState{
    const rows=plannedRows(),nowEff=effectiveNowMin(date),first=rows.length?Math.min(...rows.map(row=>row.start)):null,last=rows.length?Math.max(...rows.map(row=>row.end)):null;
    const scheduled=rows.find(row=>nowEff>=row.start&&nowEff<row.end)||null;
    const currentRow=timerState.currentIndex<tasks.length?rows.find(row=>row.idx===timerState.currentIndex)||null:null;
    let driftMin:number|null=null,driftKind:RealTimeScheduleState['driftKind']='none',driftLabel='—',match=false,subline='Load a schedule to compare planned time with real time.';
    if(rows.length&&currentRow){
      match=!!scheduled&&scheduled.idx===timerState.currentIndex;
      if(nowEff<currentRow.start){driftMin=currentRow.start-nowEff;driftKind='ahead';driftLabel='AHEAD '+time.formatDuration(Math.round(driftMin));}
      else if(nowEff>currentRow.end){driftMin=nowEff-currentRow.end;driftKind='behind';driftLabel='BEHIND '+time.formatDuration(Math.round(driftMin));}
      else{driftMin=0;driftKind=match?'ontrack':'mismatch';driftLabel=match?'ON WINDOW':'MISMATCH';}
      const scheduledName=scheduled?scheduled.t.name:(nowEff<(first??0)?'before first block':'after final block');
      subline=match?`Timer and wall-clock schedule agree: ${currentRow.t.name} is the active planned block.`:`Schedule says: ${scheduledName}. Timer is on: ${currentRow.t.name}. No automatic change has been made.`;
    }else if(rows.length){
      const scheduledName=scheduled?scheduled.t.name:(nowEff<(first??0)?'before first block':'after final block');
      driftLabel=scheduled?'SCHEDULE LIVE':'OUTSIDE DAY';driftKind=scheduled?'ontrack':'none';
      subline=`Wall-clock schedule position: ${scheduledName}. Timer is not on a trackable block.`;
    }
    return {
      nowEff,first,last,scheduledIdx:scheduled?.idx??null,scheduledTask:scheduled?.t??null,scheduledStart:scheduled?.start??null,scheduledEnd:scheduled?.end??null,
      scheduledPlannedStart:scheduled?.plannedStart??null,scheduledPlannedEnd:scheduled?.plannedEnd??null,currentIdx:currentRow?.idx??null,currentTask:currentRow?.t??null,
      currentStart:currentRow?.start??null,currentEnd:currentRow?.end??null,currentPlannedStart:currentRow?.plannedStart??null,currentPlannedEnd:currentRow?.plannedEnd??null,
      match,driftMin,driftKind,driftLabel,subline
    };
  }
  function buildRealTimeSnapshot(){
    const state=getRealTimeState();
    return freeze({
      capturedAt:new Date().toISOString(),scheduledIdx:state.scheduledIdx,scheduledName:state.scheduledTask?.name??null,scheduledKind:state.scheduledTask?.kind??null,
      currentIdx:state.currentIdx,currentName:state.currentTask?.name??null,match:state.match,driftKind:state.driftKind,
      driftMinutes:state.driftMin===null?null:Math.round(state.driftMin),driftLabel:state.driftLabel
    });
  }
  function latestTrackableEndMin(){
    const ends=tasks.map((task,index)=>model.isTrackable(task)?adjustedEndMin(index):null).filter((value):value is number=>Number.isFinite(value));
    return ends.length?Math.max(...ends):null;
  }
  return freeze({
    format:'study-director.execution-schedule' as const,contractVersion:1 as const,rebuildOriginalSchedule,resetScheduleLayers,
    originalStartMin,originalEndMin,adjustedStartMin,adjustedEndMin,hasAdjustedTiming,scheduleWindowLabel,sanitizeRuntimeAdjustedSchedule,
    effectiveNowMin,plannedRows,isInsideAdjustedWindow,remainingWindowSeconds,fixedAnchorRowsFrom,avoidFixedAnchorOverlap,nextIncompleteTrackableFrom,
    findNextIncompleteTrackableAfter,buildLiveTimeline,getRealTimeState,buildRealTimeSnapshot,latestTrackableEndMin
  });
}
function createCompletionEvidence(input:Readonly<CompletionEvidenceInput>):Readonly<CompletionEvidenceController>{
  const {tasks,taskSessionState,completionModel,sources,classifyTaskOutcome,taskTargetValue,actualTimeSnapshot,renderCompletionChange,saveLiveDraft}=input;
  functions(input,['taskTargetValue','actualTimeSnapshot','renderCompletionChange','saveLiveDraft'],'Completion evidence input');
  functions(completionModel,['normalizeSource','fromUnits','progressInput','fromFocus','needsFocus','resolve','clampPercent'],'Completion model');
  const validIndex=(index:number)=>Number.isInteger(index)&&index>=0&&index<tasks.length;
  function setCompletionSource(index:number,source:unknown){
    if(validIndex(index))taskSessionState.setField(index,'completionSource',completionModel.normalizeSource(source));
  }
  function explicitCompletionSource(index:number){
    const source=validIndex(index)?taskSessionState.getField(index,'completionSource'):undefined;
    return source!==undefined?completionModel.normalizeSource(source):sources.NONE;
  }
  function plannedSecondsForCompletion(index:number){return validIndex(index)?Math.max(0,Number(tasks[index]?.dur||0)*60):0;}
  function unitCompletionForTask(index:number){
    if(!validIndex(index))return null;
    const progress=taskSessionState.getField(index,'notes')||{};
    const total=progress.total!==undefined&&progress.total!==null?progress.total:taskTargetValue(tasks[index]!);
    return completionModel.fromUnits(progress.done,total);
  }
  function progressInputState(index:number,doneValue:unknown,totalValue:unknown,defaultTotal:unknown=validIndex(index)?taskTargetValue(tasks[index]!):null){
    return completionModel.progressInput(doneValue,totalValue,defaultTotal);
  }
  function focusCompletionForTask(index:number,snapshot:Record<string,number>|null=actualTimeSnapshot(),{cap=100}:{cap?:number}={}){
    const actual=snapshot||actualTimeSnapshot();
    return completionModel.fromFocus(actual[index],plannedSecondsForCompletion(index),{cap});
  }
  function resolveTaskCompletion(index:number,{actualSnapshot=null,preferStoredAuto=false}:{actualSnapshot?:Record<string,number>|null;preferStoredAuto?:boolean}={}){
    if(!validIndex(index))return completionModel.resolve();
    const savedPct=taskSessionState.getField(index,'completion');
    const state={
      skipped:taskSessionState.isSkipped(index),source:explicitCompletionSource(index),
      storedPct:savedPct===undefined?null:savedPct,
      unitPct:unitCompletionForTask(index),doneFlag:taskSessionState.isDone(index),preferStoredAuto
    };
    const focusPct=completionModel.needsFocus(state)?focusCompletionForTask(index,actualSnapshot):null;
    return completionModel.resolve({...state,focusPct});
  }
  function exactTaskCompletionPercent(index:number,{actualSnapshot=null,resolved=null}:{actualSnapshot?:Record<string,number>|null;resolved?:ReturnType<CompletionEvidenceController['resolveTaskCompletion']>|null}={}){
    const evidence=resolved||resolveTaskCompletion(index,{actualSnapshot});
    return completionModel.clampPercent(evidence.pct);
  }
  function liveTaskOutcome(index:number,{actualSnapshot=null,resolved=null,exactPct=null}:{actualSnapshot?:Record<string,number>|null;resolved?:ReturnType<CompletionEvidenceController['resolveTaskCompletion']>|null;exactPct?:number|null}={}){
    const evidence=resolved||resolveTaskCompletion(index,{actualSnapshot}),snapshot=actualSnapshot||actualTimeSnapshot();
    return classifyTaskOutcome({
      skipped:taskSessionState.isSkipped(index),doneFlag:taskSessionState.isDone(index),
      completion:exactPct===null||exactPct===undefined?evidence.pct:exactPct,
      completionSource:evidence.source,actualSeconds:Number(snapshot[index])||0
    });
  }
  function storeResolvedCompletion(index:number,{source=null,pct=null,actualSnapshot=null,preserveDone=false}:{source?:CompletionSource|null;pct?:number|null;actualSnapshot?:Record<string,number>|null;preserveDone?:boolean}={}){
    const resolved=pct===null||pct===undefined
      ?resolveTaskCompletion(index,{actualSnapshot})
      :{pct:completionModel.clampPercent(pct),source:source||sources.MANUAL};
    if(!validIndex(index))return resolved;
    taskSessionState.setField(index,'completion',resolved.pct);
    setCompletionSource(index,source||resolved.source);
    if(preserveDone)taskSessionState.setResolved(index,'done');
    if(resolved.pct>0&&taskSessionState.isSkipped(index))taskSessionState.setResolved(index,null);
    return resolved;
  }
  function setCompletionState(index:number,pct:number,source:CompletionSource=sources.MANUAL){
    storeResolvedCompletion(index,{pct,source,preserveDone:taskSessionState.isDone(index)&&!taskSessionState.isSkipped(index)});
    if(Number(pct)>=100)taskSessionState.setResolved(index,'done');
    else if(taskSessionState.isSkipped(index)&&Number(pct)>0)taskSessionState.setResolved(index,null);
  }
  function syncProgressInputsToState(index:number,state:ReturnType<typeof completionModel.progressInput>|null|undefined,{updateUI=false,save=false}={}){
    if(!validIndex(index))return {...resolveTaskCompletion(index),changed:false};
    const previous=taskSessionState.getField(index,'notes')||{},prevDone=previous.done,prevTotal=previous.total;
    const prevPct=taskSessionState.getField(index,'completion'),prevSource=explicitCompletionSource(index);
    const next:{done?:number;total?:number}={};
    if(state?.hasDone&&state.done!==null)next.done=state.done;
    if(state?.hasTotal&&state.total!==null)next.total=state.total;
    if(Object.keys(next).length)taskSessionState.setField(index,'notes',next);
    else taskSessionState.deleteField(index,'notes');
    const inputChanged=next.done!==prevDone||next.total!==prevTotal;
    if(state&&state.pct!==null){
      setCompletionState(index,state.pct,sources.UNITS);
      const changed=inputChanged||taskSessionState.getField(index,'completion')!==prevPct||explicitCompletionSource(index)!==prevSource;
      if(updateUI)renderCompletionChange(index,state.pct,true);
      if(save&&changed)saveLiveDraft();
      return {pct:state.pct,source:sources.UNITS,changed};
    }
    let changed=inputChanged;
    if(explicitCompletionSource(index)===sources.UNITS){
      taskSessionState.deleteField(index,'completion');taskSessionState.deleteField(index,'completionSource');changed=true;
    }
    const resolved=resolveTaskCompletion(index);
    if(updateUI)renderCompletionChange(index,resolved.pct,true);
    if(save&&changed)saveLiveDraft();
    return {...resolved,changed};
  }
  function clearManualCompletionOverride(index:number,{updateUI=false,save=false}={}){
    if(explicitCompletionSource(index)!==sources.MANUAL){
      const resolved=resolveTaskCompletion(index);
      if(updateUI)renderCompletionChange(index,resolved.pct,true);
      return resolved;
    }
    taskSessionState.deleteField(index,'completion');taskSessionState.deleteField(index,'completionSource');
    const resolved=resolveTaskCompletion(index);
    if(updateUI)renderCompletionChange(index,resolved.pct,true);
    if(save)saveLiveDraft();
    return resolved;
  }
  function toggleDoneState(index:number){
    if(!validIndex(index))return false;
    const prior=taskSessionState.resolvedState(index),next=taskSessionState.toggleDone(index);
    if(prior==='skipped'){
      if(explicitCompletionSource(index)===sources.SKIPPED)taskSessionState.deleteField(index,'completionSource');
      if(Number(taskSessionState.getField(index,'completion'))===0)taskSessionState.deleteField(index,'completion');
    }
    if(prior==='done'&&explicitCompletionSource(index)===sources.FINISHED_UNVERIFIED){
      taskSessionState.deleteField(index,'completionSource');
      if(Number(taskSessionState.getField(index,'completion'))===0)taskSessionState.deleteField(index,'completion');
    }
    return next;
  }
  function setTaskDoneState(index:number){
    if(!validIndex(index))return;
    taskSessionState.setResolved(index,'done');
    const resolved=resolveTaskCompletion(index,{actualSnapshot:actualTimeSnapshot()});
    storeResolvedCompletion(index,{pct:resolved.pct,source:resolved.source===sources.TIME?sources.FINISHED_TIME:resolved.source,preserveDone:true});
  }
  function setTaskSkippedState(index:number){
    if(!validIndex(index))return;
    taskSessionState.setResolved(index,'skipped');taskSessionState.setField(index,'completion',0);setCompletionSource(index,sources.SKIPPED);
  }
  return freeze({
    format:'study-director.completion-evidence' as const,contractVersion:1 as const,
    setCompletionSource,explicitCompletionSource,plannedSecondsForCompletion,unitCompletionForTask,progressInputState,
    syncProgressInputsToState,clearManualCompletionOverride,focusCompletionForTask,liveTaskOutcome,resolveTaskCompletion,
    exactTaskCompletionPercent,storeResolvedCompletion,setCompletionState,toggleDoneState,setTaskDoneState,setTaskSkippedState
  });
}
function createTimerRestoration(ports:Readonly<TimerRestorationInput>){
  const {TimerState,TaskIdentity,TASKS,TIMER_MODES,TimerEngine,Pomodoro}=ports.runtime;
  const {currentTimerActiveSeconds,restoredRuntimeRecordedSec,reopenActualSessionForTimer,setTimerIdentity}=TimerEngine;
  const {setCurrentTask,isTaskResolved}=ports.runtime;
  const {DecisionClock,isTrackableBlock,clampText,setExecuteShellVisible,setExecuteControlsEnabled,clearExecuteStateOverlay,refreshPnote,requestRender,updateBadges,flushLiveDraft}=ports;
  const POMODORO_RESTORE_OVERRUN_GRACE_SEC=30*60;
function timerRuntimePayload():TimerPayload|null{
  if(!TimerState.runtime||TimerState.runtime.startMs===null||!(TimerState.currentIndex<TASKS.length)||!isTrackableBlock(TASKS[TimerState.currentIndex]))return null;
  const taskId=TaskIdentity.idAt(TimerState.currentIndex);if(!taskId)return null;
  const cycle=Pomodoro.timerEvent('cycle-snapshot');
  const runtime:TimerPayload={
    version:2,taskId,mode:TimerState.paused?TIMER_MODES.PAUSED:TIMER_MODES.RUNNING,paused:!!TimerState.paused,updatedAt:new Date().toISOString(),
    timerState:{
      startMs:Math.max(0,Math.round(Number(TimerState.runtime.startMs)||0)),durationSec:Math.max(1,Math.round(Number(TimerState.runtime.durationSec)||0)),
      totalPausedMs:Math.max(0,Math.round(Number(TimerState.runtime.totalPausedMs)||0)),
      pausedStartedMs:TimerState.runtime.pausedStartedMs?Math.max(0,Math.round(Number(TimerState.runtime.pausedStartedMs)||0)):null,
      recordedSec:Math.max(0,Math.round(Number(currentTimerActiveSeconds())||0)),overtimeNotified:!!TimerState.runtime.overtimeNotified,
      lastTickMs:TimerState.runtime.lastTickMs?Math.max(0,Math.round(Number(TimerState.runtime.lastTickMs)||0)):null,
      sleepPausedMs:Math.max(0,Math.round(Number(TimerState.runtime.sleepPausedMs)||0))
    },
    ...(cycle?{nudgeCycle:cycle}:{})
  };
  if(TimerState.paused&&TimerState.activeBreak&&TimerState.activeBreak.taskIdx===TimerState.currentIndex){
    runtime.activeBreak={
      type:TimerState.activeBreak.type==='pomodoro'?'pomodoro':'manual',startedAtMs:Math.max(0,Math.round(Number(TimerState.activeBreak.startedAtMs)||DecisionClock.nowMs())),
      plannedSeconds:TimerState.activeBreak.type==='pomodoro'?Math.max(60,Math.round(Number(TimerState.activeBreak.plannedSeconds)||Pomodoro.configuration.breakSeconds())):0,
      cueIssuedAt:TimerState.activeBreak.type==='pomodoro'&&TimerState.activeBreak.cueIssuedAt?clampText(TimerState.activeBreak.cueIssuedAt,40):null,doneNotified:!!TimerState.activeBreak.doneNotified
    };
  }
  if(TimerState.inactiveGap&&TimerState.inactiveGap.taskIdx===TimerState.currentIndex){
    const capturedAt=DecisionClock.nowMs();
    runtime.pendingInactiveGap={
      gapMs:Math.max(0,Math.round(Number(TimerState.inactiveGap.gapMs)||0)),
      promptMs:Math.max(0,Math.round(Number(TimerState.inactiveGap.promptMs)||0))+Math.max(0,capturedAt-(Number(TimerState.inactiveGap.detectedAtMs)||capturedAt)),
      detectedAtMs:capturedAt,lastMs:Math.max(0,Math.round(Number(TimerState.inactiveGap.lastMs)||0)),source:clampText(TimerState.inactiveGap.source||'restore',40)
    };
  }
  return runtime;
}
function validateTimerRestoreCandidate(runtime:TimerPayload|null):TimerRestoreCandidate|null{
  if(!runtime||!TASKS.length)return null;
  const taskId=clampText(runtime.taskId||'',80),idx=TaskIdentity.indexForId(taskId);
  const task=idx===null?undefined:TASKS[idx];
  if(idx===null||!task||!isTrackableBlock(task)||isTaskResolved(idx))return null;
  const rawState=runtime.timerState||{};
  const durationSec=Math.max(1,Math.round(Number(rawState.durationSec)||task.dur*60));
  return {runtime,idx,task,rawState,durationSec};
}
function deriveRestoredTimerState(candidate:TimerRestoreCandidate):Runtime{
  const {runtime,idx,rawState,durationSec}=candidate,now=DecisionClock.nowMs();
  const restored={
    ...TimerState.emptyRuntime(),
    taskIdx:idx,
    startMs:Math.max(0,Math.round(Number(rawState.startMs)||now)),
    durationSec,
    totalPausedMs:Math.max(0,Math.round(Number(rawState.totalPausedMs)||0)),
    pausedStartedMs:rawState.pausedStartedMs?Math.max(0,Math.round(Number(rawState.pausedStartedMs)||0)):null,
    recordedSec:Math.max(0,Math.round(Number(rawState.recordedSec)||0)),
    overtimeNotified:!!rawState.overtimeNotified,
    lastTickMs:rawState.lastTickMs?Math.max(0,Math.round(Number(rawState.lastTickMs)||0)):now,
    sleepPausedMs:Math.max(0,Math.round(Number(rawState.sleepPausedMs)||0))
  };
  restored.recordedSec=restoredRuntimeRecordedSec(runtime,restored);
  return restored;
}
function applyRestoredTimerState(candidate:TimerRestoreCandidate,restoredState:Runtime){
  setCurrentTask(candidate.idx);
  ports.invalidateIdleDisplay();
  TimerEngine.setCountdownDuration(candidate.durationSec);
  TimerState.runtime=restoredState;
  reopenActualSessionForTimer(candidate.idx,candidate.durationSec,(candidate.runtime.paused&&candidate.runtime.activeBreak)?'paused':'in_progress');
}
function renderRestoredTimer(candidate:TimerRestoreCandidate){
  setTimerIdentity(candidate.task,candidate.idx);
  setExecuteShellVisible(true);
  setExecuteControlsEnabled(true);
  clearExecuteStateOverlay();
  refreshPnote();
  requestRender('schedule','realtime');
}
function deriveRestoredInactiveGap(runtime:TimerPayload,idx:number,now=DecisionClock.nowMs()):InactiveGap|null{
  if(!runtime.pendingInactiveGap)return null;
  const gap=runtime.pendingInactiveGap;
  const savedAt=Date.parse(runtime.updatedAt||'');
  return {
    id:`gap_${gap.detectedAtMs||now}`,
    taskIdx:idx,
    gapMs:Math.max(0,Math.round(Number(gap.gapMs)||0)),
    promptMs:Math.max(0,Math.round(Number(gap.promptMs)||0))+(Number.isFinite(savedAt)?Math.max(0,now-savedAt):0),
    lastMs:Math.max(0,Math.round(Number(gap.lastMs)||0)),
    detectedAtMs:now,
    source:gap.source||'restore'
  };
}
function deriveRestoredBreakState(runtime:TimerPayload,idx:number,now=DecisionClock.nowMs()):RestoredBreak|null{
  if(!(runtime.paused&&runtime.activeBreak))return null;
  const raw=runtime.activeBreak;
  const type=raw.type==='pomodoro'?'pomodoro':'manual';
  let startedAtMs=Math.max(0,Math.round(Number(raw.startedAtMs)||now));
  const plannedSeconds=type==='pomodoro'?Math.max(60,Math.round(Number(raw.plannedSeconds)||Pomodoro.configuration.breakSeconds())):0;
  let elapsedSeconds=Math.max(0,Math.floor((now-startedAtMs)/1000));
  let overrunCapped=false;
  if(type==='pomodoro'&&elapsedSeconds>plannedSeconds+POMODORO_RESTORE_OVERRUN_GRACE_SEC){
    elapsedSeconds=plannedSeconds+POMODORO_RESTORE_OVERRUN_GRACE_SEC;
    startedAtMs=now-elapsedSeconds*1000;
    overrunCapped=true;
  }
  return {
    now,startedAtMs,overrunCapped,
    activeBreak:{
      type,taskIdx:idx,startedAtMs,plannedSeconds,
      cueIssuedAt:type==='pomodoro'?raw.cueIssuedAt||null:null,
      doneNotified:!!raw.doneNotified&&elapsedSeconds>=plannedSeconds
    }
  };
}
function resumeRestoredPausedTimer(restoredBreak:RestoredBreak){return TimerEngine.resumeRestoredPaused(restoredBreak);}
function resumeRestoredRunningTimer(){return TimerEngine.resumeRestoredRunning();}
function finalizeRestoredTimerPersistence(){
  updateBadges();
  flushLiveDraft({markChanged:false});
}
function restoreTimerRuntimeIfAny(){
  const runtime=TimerState.pendingRestore;
  TimerState.pendingRestore=null;
  const candidate=validateTimerRestoreCandidate(runtime);
  if(!candidate||!runtime)return false;
  const restoredState=deriveRestoredTimerState(candidate);
  applyRestoredTimerState(candidate,restoredState);
  renderRestoredTimer(candidate);
  Pomodoro.timerEvent('restore-cycle',{cycle:runtime.nudgeCycle||null,activeSec:currentTimerActiveSeconds()});
  TimerState.inactiveGap=deriveRestoredInactiveGap(runtime,candidate.idx);
  const restoredBreak=deriveRestoredBreakState(runtime,candidate.idx);
  if(restoredBreak)resumeRestoredPausedTimer(restoredBreak);
  else resumeRestoredRunningTimer();
  finalizeRestoredTimerPersistence();
  return true;
}
return freeze({timerRuntimePayload,validateTimerRestoreCandidate,deriveRestoredTimerState,applyRestoredTimerState,renderRestoredTimer,deriveRestoredInactiveGap,deriveRestoredBreakState,resumeRestoredPausedTimer,resumeRestoredRunningTimer,finalizeRestoredTimerPersistence,restoreTimerRuntimeIfAny});
}
function createScheduleGateway(ports:Readonly<ScheduleGatewayInput>){

  const {TASKS,TimerState,TaskSessionState,PracticePacer,TaskIdentity,TIMER_MODES,
    plannedRows,getRealTimeState,isTaskResolved,remainingWindowSeconds,setCurrentTask,resetScheduleLayers,
    resetCountdownRuntime,setTimerMode,clearProgressRuntime,buildLiveTimeline,hasAdjustedTiming,
    adjustedStartMin,adjustedEndMin,originalStartMin,originalEndMin}=ports.runtime;
  const {currentTimerActiveSeconds,recordCurrentActiveToTask,startCur,toggleDone,jumpTo,resolveActivePauseBeforeTimerSwitch}=ports.runtime.TimerEngine;
  const {taskAreaKey,taskMeasureValue,taskTargetValue,isTrackableBlock,clampText,normalizeCompletionSource,makeTaskId,
    isLiveTrackableTimer,saveNote,captureReviewInputs,syncUnfinishedNoteDraft,getReviewDate,
    showEmpty,refreshCoreUi,showDone,isValidIsoDate,todayISO,buildTasks,isValidHHMM,clockMinuteToStudyMinute,t2m,
    invalidateScheduleDerived,applySessionSnapshot,restoreLiveDraftIfAny,restoreTimerRuntimeIfAny,
    clearFutureUntouchedProgress,flushLiveDraft,scheduleFingerprint,writeLiveDraftNow,advanceTaskNoteScheduleRevision,
    markDayContentChanged,clearSessionSafetyMessage,SessionLifecycle,document,ScheduleDerivedState,APP_LIMITS}=ports;
  const PRACTICE_PAUSE_CAUSES=ports.runtime.PracticePacerModel.PRACTICE_PAUSE_CAUSES;
  const COMPLETION_SOURCES=ports.completionSources;
function hasProtectedLiveProgress(){
  const hasTrackedTime=Object.values(TaskSessionState.indexSnapshot('actualTime')).some(value=>Number(value)>0);
  const activeSeconds=(TimerState.runtime&&TimerState.runtime.startMs!==null)?currentTimerActiveSeconds():0;
  const practice=PracticePacer.status();
  return hasTrackedTime || activeSeconds>5 || !!practice.active || practice.runs.length>0 || TaskSessionState.resolvedIndices('done').length>0 || TaskSessionState.resolvedIndices('skipped').length>0 ||
    Object.keys(TaskSessionState.indexSnapshot('completion')).length>0 || Object.keys(TaskSessionState.indexSnapshot('completionSource')).length>0 ||
    Object.keys(TaskSessionState.indexSnapshot('notes')).length>0 || Object.keys(TimerState.adjustedSchedule||{}).length>0 || !!String(ports.getCarryForward()||'').trim();
}
function cloneProgressData<T>(value:T):T{
  if(value===undefined)return value;
  if(value===null||typeof value!=='object')return value;
  try{return JSON.parse(JSON.stringify(value)) as T;}
  catch(e){return (Array.isArray(value)?value.slice():{...value}) as T;}
}
function progressIdentityText(value:unknown){
  return String(value||'').trim().replace(/\s+/g,' ').toLowerCase();
}
function taskProgressPrimaryKey(t:TaskInput){
  return [
    t&&t.kind||'work',
    taskAreaKey(t),
    progressIdentityText(t&&t.name),
    progressIdentityText(taskMeasureValue(t,'')),
    progressIdentityText(taskTargetValue(t)??'')
  ].join('|');
}
function taskProgressAreaKey(t:TaskInput){
  return [
    t&&t.kind||'work',
    taskAreaKey(t),
    progressIdentityText(taskMeasureValue(t,''))
  ].join('|');
}
function hasObjectData(value:unknown){
  return !!(value&&typeof value==='object'&&Object.keys(value).length);
}
function hasBlockProgressAtIndex(idx:number){
  const progress=TaskSessionState.getField(idx,'notes');
  return TaskSessionState.getField(idx,'completion')!==undefined || TaskSessionState.isResolved(idx) ||
    (progress&&(progress.done!==undefined||progress.total!==undefined)) ||
    TaskSessionState.getField(idx,'actualTime')!==undefined || hasObjectData(TaskSessionState.getField(idx,'actualClock')) || hasObjectData(TaskSessionState.getField(idx,'actualRecords'));
}
function captureProgressBeforeScheduleChange(){
  PracticePacer.pauseFromMain(PRACTICE_PAUSE_CAUSES.MAIN);
  try{
    if(isLiveTrackableTimer())recordCurrentActiveToTask(TimerState.currentIndex,'partial');
  }catch(e){}
  try{if(TASKS[TimerState.currentIndex]&&isTrackableBlock(TASKS[TimerState.currentIndex]))saveNote();}catch(e){}
  try{captureReviewInputs();}catch(e){}
  try{syncUnfinishedNoteDraft();}catch(e){}
}
function buildProgressMatchIndex(rows:readonly TaskInput[]){
  const primary=new Map<string,number[]>(),area=new Map<string,number[]>();
  (rows||[]).forEach((t,idx)=>{
    if(!isTrackableBlock(t))return;
    const pk=taskProgressPrimaryKey(t);
    const ak=taskProgressAreaKey(t);
    if(!primary.has(pk))primary.set(pk,[]);
    if(!area.has(ak))area.set(ak,[]);
    primary.get(pk)!.push(idx);
    area.get(ak)!.push(idx);
  });
  return {primary,area};
}
function uniqueIndex(map:ReadonlyMap<string,number[]>,key:string){
  const rows=map.get(key)||[];
  return rows.length===1?rows[0]!:null;
}
function matchProgressEntriesToRows<T extends ScheduleProgressMatch>(entries:readonly T[],rows:readonly TaskInput[]){
  const idx=buildProgressMatchIndex(rows);
  const oldAreaCounts=new Map<string,number>();
  (entries||[]).forEach(entry=>oldAreaCounts.set(entry.areaKey,(oldAreaCounts.get(entry.areaKey)||0)+1));
  const used=new Set();
  return (entries||[]).map(entry=>{
    let target=uniqueIndex(idx.primary,entry.primaryKey);
    let matchType:'exact'|'area'='exact';
    if(target===null&&oldAreaCounts.get(entry.areaKey)===1){
      target=uniqueIndex(idx.area,entry.areaKey);
      matchType='area';
    }
    if(target===null||used.has(target))return null;
    used.add(target);
    return {entry,target,matchType};
  }).filter((value):value is NonNullable<typeof value>=>value!==null);
}
function snapshotPracticeTaskLinksForMigration(){
  const practice=PracticePacer.snapshot();
  if(!practice)return [];
  const referenced=new Set();
  if(practice.active&&practice.active.taskId)referenced.add(practice.active.taskId);
  (practice.runs||[]).forEach(run=>{if(run.taskId)referenced.add(run.taskId);});
  return TASKS.map((task,idx)=>{
    const oldTaskId=TaskIdentity.idAt(idx);
    if(!oldTaskId||!referenced.has(oldTaskId)||!isTrackableBlock(task))return null;
    return {oldTaskId,primaryKey:taskProgressPrimaryKey(task),areaKey:taskProgressAreaKey(task)};
  }).filter((value):value is NonNullable<typeof value>=>value!==null);
}
function progressTargetsDiffer(oldTarget:unknown,newTarget:unknown){
  const oldEmpty=oldTarget===null||oldTarget===undefined||oldTarget==='';
  const newEmpty=newTarget===null||newTarget===undefined||newTarget==='';
  if(oldEmpty&&newEmpty)return false;
  return Number(oldTarget)!==Number(newTarget);
}
function recalcMigratedProgressForNewTarget(p:ScheduleProgressFields,targetIdx:number,matchType:'exact'|'area'){
  const out=cloneProgressData(p||{});
  if(matchType!=='area')return out;
  const oldTarget=out.target;
  const newTarget=taskTargetValue(TASKS[targetIdx]);
  if(!progressTargetsDiffer(oldTarget,newTarget))return out;
  if(out.notes&&typeof out.notes==='object')delete out.notes.total;
  const done=out.notes&&Number.isFinite(Number(out.notes.done))?Number(out.notes.done):null;
  const total=Number(newTarget);
  if(done!==null&&Number.isFinite(total)&&total>0){
    out.completion=Math.min(100,Math.max(0,Math.round((done/total)*100)));
    out.completionSource=COMPLETION_SOURCES.UNITS;
    out.done=!!out.done||out.completion>=100;
    if(out.done)out.skipped=false;
  }
  return out;
}
function snapshotScheduleProgressForMigration(newRows:readonly TaskInput[]){
  captureProgressBeforeScheduleChange();
  const entries:ScheduleProgressEntry[]=[];
  TASKS.forEach((t,idx)=>{
    if(!isTrackableBlock(t)||!hasBlockProgressAtIndex(idx))return;
    entries.push({
      idx,
      primaryKey:taskProgressPrimaryKey(t),
      areaKey:taskProgressAreaKey(t),
      progress:{
        completion:TaskSessionState.getField(idx,'completion'),
        completionSource:TaskSessionState.getField(idx,'completionSource'),
        notes:TaskSessionState.getField(idx,'notes')?cloneProgressData(TaskSessionState.getField(idx,'notes')):undefined,
        done:TaskSessionState.isDone(idx),
        skipped:TaskSessionState.isSkipped(idx),
        target:taskTargetValue(t),
        actualTime:TaskSessionState.getField(idx,'actualTime'),
        actualClock:TaskSessionState.getField(idx,'actualClock')?cloneProgressData(TaskSessionState.getField(idx,'actualClock')):undefined,
        actualRecords:TaskSessionState.getField(idx,'actualRecords')?cloneProgressData(TaskSessionState.getField(idx,'actualRecords')):undefined
      }
    });
  });
  const practiceLinks=snapshotPracticeTaskLinksForMigration();
  const matched=matchProgressEntriesToRows(entries,newRows).length;
  const practiceMatched=matchProgressEntriesToRows(practiceLinks,newRows).length;
  return {
    date:getReviewDate(),
    entries,
    practiceLinks,
    latestCarryForward:clampText(ports.getCarryForward(),APP_LIMITS.maxCarryForwardChars),
    preview:{total:entries.length,matched,practiceTotal:practiceLinks.length,practiceMatched}
  };
}
function restoreMigratedScheduleProgress(snapshot:ScheduleProgressSnapshot|null){
  const total=snapshot&&Array.isArray(snapshot.entries)?snapshot.entries.length:0;
  const practiceTotal=snapshot&&Array.isArray(snapshot.practiceLinks)?snapshot.practiceLinks.length:0;
  if(!snapshot||snapshot.date!==getReviewDate())return {total,matched:0,areaMatched:0,practiceTotal,practiceMatched:0,practiceRemapped:0};
  const matches=matchProgressEntriesToRows(snapshot.entries||[],TASKS);
  matches.forEach(({entry,target,matchType})=>{
    const p=recalcMigratedProgressForNewTarget(entry.progress,target,matchType);
    if(p.completion!==undefined)TaskSessionState.setField(target,'completion',Number(p.completion));
    if(p.completionSource!==undefined)TaskSessionState.setField(target,'completionSource',normalizeCompletionSource(p.completionSource));
    if(p.notes!==undefined)TaskSessionState.setField(target,'notes',cloneProgressData(p.notes));
    if(p.actualTime!==undefined)TaskSessionState.setField(target,'actualTime',Number(p.actualTime)||0);
    if(p.actualClock!==undefined)TaskSessionState.setField(target,'actualClock',cloneProgressData(p.actualClock));
    if(p.actualRecords!==undefined){
      const rec=cloneProgressData(p.actualRecords);
      rec.idx=target;
      rec.taskId=TASKS[target]?.id||makeTaskId(TASKS[target]||{},target);
      TaskSessionState.setField(target,'actualRecords',rec);
    }
    if(p.done)TaskSessionState.setResolved(target,'done');
    if(p.skipped)TaskSessionState.setResolved(target,'skipped');
  });
  const practiceMatches=matchProgressEntriesToRows(snapshot.practiceLinks||[],TASKS);
  const taskIdMap=new Map<string,string>();
  practiceMatches.forEach(({entry,target})=>{
    const nextTaskId=TaskIdentity.idAt(target);
    if(entry.oldTaskId&&nextTaskId)taskIdMap.set(entry.oldTaskId,nextTaskId);
  });
  const practiceRemapped=PracticePacer.remapTaskLinks(taskIdMap);
  if(String(snapshot.latestCarryForward||'').trim())ports.setCarryForward(snapshot.latestCarryForward);
  return {
    total,
    matched:matches.length,
    areaMatched:matches.filter(m=>m.matchType==='area').length,
    practiceTotal,
    practiceMatched:practiceMatches.length,
    practiceRemapped
  };
}
function enterRecoveredReviewMode(){
  const firstUnresolved=plannedRows().find(row=>isTrackableBlock(row.t)&&!isTaskResolved(row.idx));
  setCurrentTask(firstUnresolved?firstUnresolved.idx:TASKS.length);
  showEmpty('Recovered evidence is available in Review. The previous timer was intentionally not restarted.','Previous Study Day Recovered');
  refreshCoreUi({header:true});
}
function deriveScheduleStartupDecision():ScheduleStartupDecision{
  const unresolvedRows=plannedRows().filter(row=>isTrackableBlock(row.t)&&!isTaskResolved(row.idx));
  if(!unresolvedRows.length)return {kind:'done'};
  const state=getRealTimeState();
  const scheduledIdx=state.scheduledIdx;
  if(scheduledIdx!==null&&isTrackableBlock(TASKS[scheduledIdx])&&!isTaskResolved(scheduledIdx)){
    return {kind:'start',idx:scheduledIdx,seconds:remainingWindowSeconds(scheduledIdx)};
  }
  const nextRow=unresolvedRows.find(row=>row.start>=state.nowEff);
  if(nextRow)return {kind:'wait',idx:nextRow.idx};
  return {kind:'forward-complete'};
}
function applyScheduleStartupDecision(decision:ScheduleStartupDecision){
  if(decision.kind==='done'){
    setCurrentTask(TASKS.length);
    showDone();
    return;
  }
  if(decision.kind==='start'){
    setCurrentTask(decision.idx);
    startCur(decision.seconds);
    return;
  }
  if(decision.kind==='wait'){
    setCurrentTask(decision.idx);
    showEmpty('Waiting for a trackable schedule window. The timer will auto-start when the wall-clock enters the next unfinished work/support block.');
    refreshCoreUi({header:true});
    return;
  }
  setCurrentTask(TASKS.length);
  showEmpty('No later trackable block remains in today’s forward plan. Earlier untouched blocks stay available for deliberate selection or Review.','Forward Plan Complete');
  refreshCoreUi({header:true});
}
function applyRows(rows:readonly ScheduleRow[],options:ScheduleGatewayOptions={}){
  TimerState.loadSchedule(buildTasks(rows),{
    studyDate:options.studyDate&&isValidIsoDate(options.studyDate)?options.studyDate:todayISO()
  });
  TimerState.scheduleAnchorMin=rows.length&&isValidHHMM(rows[0]!.start)?clockMinuteToStudyMinute(t2m(rows[0]!.start)):0;
  invalidateScheduleDerived({identity:true,render:true});
  resetScheduleLayers();setCurrentTask(0);resetCountdownRuntime();setTimerMode(TIMER_MODES.READY,'schedule-apply');clearProgressRuntime();ports.setCarryForward('');
  const restoredLiveDraft=options.progressMigration?false:(options.sessionSnapshot?applySessionSnapshot(options.sessionSnapshot):restoreLiveDraftIfAny());
  const migrationSummary=options.progressMigration?restoreMigratedScheduleProgress(options.progressMigration):null;
  const restoredTimerRuntime=restoredLiveDraft&&!options.reviewOnly?restoreTimerRuntimeIfAny():false;
  if(restoredLiveDraft)clearFutureUntouchedProgress();
  const restored={restoredLiveDraft,migrationSummary,restoredTimerRuntime};
  if(options.reviewOnly){enterRecoveredReviewMode();return {...restored,restoredTimerRuntime:false};}
  if(!restoredTimerRuntime){applyScheduleStartupDecision(deriveScheduleStartupDecision());flushLiveDraft();}
  return restored;
}

  function apply(rows:readonly ScheduleRow[],options:ScheduleGatewayOptions={}){
    const opts=options&&typeof options==='object'?options:{};
    if(opts.lifecycleManaged)return applyRows(rows,opts);
    const date=isValidIsoDate(opts.studyDate)?opts.studyDate:todayISO();
    return SessionLifecycle.run(opts.source||'schedule-apply',{
      scheduleIdentity:true,date,autoDate:date===todayISO(),snapshotReview:null,
    },()=>applyRows(rows,{...opts,lifecycleManaged:true}));
  }
  function reconcile(source='schedule-reapply'){
    return SessionLifecycle.reconcile(source,{
      scheduleIdentity:true,date:getReviewDate(),
      autoDate:document.getElementById('day-date')?.dataset['autoDate']==='1',

    });
  }
  function read(){
    return Object.freeze({
      tasks:TASKS,
      currentIndex:TimerState.currentIndex,
      anchor:TimerState.scheduleAnchorMin,
      fingerprint:scheduleFingerprint(),
      renderDirty:!!ScheduleDerivedState.renderDirty
    });
  }
  function timeline(){return Object.freeze({rows:buildLiveTimeline(),realtime:getRealTimeState()});}
  function row(index:number){
    const i=Number(index);
    return Object.freeze({
      done:TaskSessionState.isDone(i),
      skipped:TaskSessionState.isSkipped(i),
      adjusted:hasAdjustedTiming(i),
      adjustedStartMin:adjustedStartMin(i),
      adjustedEndMin:adjustedEndMin(i),
      originalStartMin:originalStartMin(i),
      originalEndMin:originalEndMin(i),
      actualTime:TaskSessionState.getField(i,'actualTime'),
      actualClock:TaskSessionState.getField(i,'actualClock')||null
    });
  }
  function act(action:string,index:number){
    if(action==='toggle')return toggleDone(index);
    if(action==='jump')return jumpTo(index);
    throw new TypeError('Unknown Plan schedule action.');
  }
  function hasLiveState(){
    const hasTimer=!!(TimerState.runtime&&TimerState.runtime.startMs!==null&&TimerState.currentIndex<TASKS.length&&isTrackableBlock(TASKS[TimerState.currentIndex]));
    return hasTimer||TimerState.paused||!!TimerState.activeBreak||hasProtectedLiveProgress();
  }
  function breakState(action='status'){
    const active=!!(TimerState.paused&&TimerState.activeBreak&&TimerState.runtime&&TimerState.runtime.startMs!==null);
    if(action==='status')return active;
    if(action!=='end')throw new TypeError('Unknown Plan schedule break action.');
    if(!active||resolveActivePauseBeforeTimerSwitch()!==true)return false;
    writeLiveDraftNow();
    return true;
  }
  // A note renamed with its Area: today's blocks take the new Area in place,
  // keeping their times, progress and the running timer.
  function renameAreas(rename:(row:Readonly<TaskInput>)=>string|undefined){
    const changed=TimerState.renameTaskAreas(rename);
    if(!changed)return 0;
    advanceTaskNoteScheduleRevision();invalidateScheduleDerived({identity:true,render:true});markDayContentChanged();writeLiveDraftNow();
    return changed;
  }
  function markRender(state:string){
    if(state==='dirty'){invalidateScheduleDerived({render:true});return true;}
    if(state==='clean'){ScheduleDerivedState.renderDirty=false;return true;}
    throw new TypeError('Unknown Plan render state.');
  }
  return Object.freeze({
    read,timeline,row,act,hasLiveState,
    captureMigration:snapshotScheduleProgressForMigration,
    breakState,apply,reconcile,renameAreas,
    flush:flushLiveDraft,
    clearSafety:clearSessionSafetyMessage,
    markRender
  });
}
function createRuntime(input:Readonly<ExecutionHostInput>){
  exactObject(input,['modules','timerState','pomodoro','practiceModel','practice','timer','schedule','evidence','hooks'],'Execution host input');
  exactObject(input.modules,['timerState','pomodoro','practicePacer','timerEngine'],'Execution host modules');
  functions(input.hooks,['syncStudyQuiet'],'Execution host hooks');
  const {timerState:timerStateModule,pomodoro:pomodoroModule,practicePacer:practicePacerModule,timerEngine:timerEngineModule}=input.modules;
  if(timerStateModule.format!=='study-director.timer-state'||timerStateModule.contractVersion!==1||
    pomodoroModule.format!=='study-director.pomodoro-module'||pomodoroModule.contractVersion!==1||
    practicePacerModule.format!=='study-director.practice-pacer-module'||practicePacerModule.contractVersion!==1||
    timerEngineModule.format!=='study-director.timer-engine-module'||timerEngineModule.contractVersion!==2){
    throw new TypeError('Execution host modules are unavailable or incompatible.');
  }

  const TimerState=timerStateModule.createStateController(input.timerState);
  const SessionState=TimerState.session,TASKS=TimerState.tasks,TIMER_MODES=TimerState.modes,TaskIdentity=TimerState.taskIdentity;
  const setTimerMode=TimerState.setMode;
  const TaskSessionState=createTaskSessionState(TaskIdentity);
  const ExecutionSchedule=createExecutionSchedule(freeze({
    tasks:TASKS,timerState:TimerState,taskSessionState:TaskSessionState,model:input.schedule.model,time:input.schedule.time,
    compactAdjustedSchedule:input.schedule.compactAdjustedSchedule,invalidateDerived:input.schedule.invalidateDerived
  }));
  let TimerEngine:ReturnType<typeof timerEngineModule.createEngine>|null=null;
  const CompletionEvidence=createCompletionEvidence(freeze({
    tasks:TASKS,taskSessionState:TaskSessionState,
    completionModel:input.evidence.completionModel,sources:input.evidence.sources,
    classifyTaskOutcome:input.evidence.classifyTaskOutcome,taskTargetValue:input.evidence.taskTargetValue,
    actualTimeSnapshot:()=>TimerEngine?TimerEngine.actualTimeSnapshot():{},
    renderCompletionChange:input.evidence.renderCompletionChange,saveLiveDraft:input.evidence.saveLiveDraft
  }));

  const Pomodoro=pomodoroModule.createController(freeze({ports:freeze({
    ...input.pomodoro,
    state:freeze({TASKS,TIMER_MODES,TimerState})
  })}));
  const PracticePacerModel=practicePacerModule.createModel(freeze({ports:input.practiceModel}));
  const PracticePacer=practicePacerModule.createController(freeze({model:PracticePacerModel,ports:freeze({
    ...input.practice,
    state:freeze({TASKS,TIMER_MODES,TaskIdentity,TimerState}),
    schedule:freeze({...input.practice.schedule,isTaskResolved:TaskSessionState.isResolved})
  })}));

  function setCurrentTask(index:number,options:{notifyPractice?:boolean}={}){
    const next=input.timer.domain.boundedInt(index,{min:0,max:Math.max(0,TASKS.length),fallback:0});
    if(options.notifyPractice!==false)PracticePacer.onMainTaskChanging(next<TASKS.length?TaskIdentity.idAt(next):null);
    TimerState.currentIndex=next;
    input.hooks.syncStudyQuiet();
    return TimerState.currentIndex;
  }
  function resetBreakState(refreshMeter=true){
    TimerState.breakStartMs=null;
    TimerState.currentBreakSec=0;
    Pomodoro.timerEvent('clear-cue');
    TimerState.activeBreak=null;
    if(refreshMeter)TimerEngine?.updateBreakMeter();
  }

  const timerPorts:TimerEngineInput['ports']=freeze({
    ...input.timer,
    state:freeze({TASKS,TIMER_MODES,TaskIdentity,TaskSessionState,TimerState,resetBreakState,setCurrentTask,setTimerMode}),
    schedule:freeze({
      ...input.timer.schedule,
      adjustedEndMin:ExecutionSchedule.adjustedEndMin,adjustedStartMin:ExecutionSchedule.adjustedStartMin,
      effectiveNowMin:ExecutionSchedule.effectiveNowMin,findNextIncompleteTrackableAfter:ExecutionSchedule.findNextIncompleteTrackableAfter,
      hasAdjustedTiming:ExecutionSchedule.hasAdjustedTiming,isFixedBlock:input.schedule.model.isFixed,
      isTaskResolved:TaskSessionState.isResolved,isTrackableBlock:input.schedule.model.isTrackable,
      originalEndMin:ExecutionSchedule.originalEndMin,originalStartMin:ExecutionSchedule.originalStartMin,plannedRows:ExecutionSchedule.plannedRows
    }),
    reviewEvidence:freeze({
      ...input.timer.reviewEvidence,
      buildRealTimeSnapshot:ExecutionSchedule.buildRealTimeSnapshot,
      exactTaskCompletionPercent:CompletionEvidence.exactTaskCompletionPercent,
      focusCompletionForTask:CompletionEvidence.focusCompletionForTask,
      liveTaskOutcome:CompletionEvidence.liveTaskOutcome,
      resolveTaskCompletion:CompletionEvidence.resolveTaskCompletion,
      storeResolvedCompletion:CompletionEvidence.storeResolvedCompletion,
      toggleDoneState:CompletionEvidence.toggleDoneState,
      setTaskDoneState:CompletionEvidence.setTaskDoneState,
      setTaskSkippedState:CompletionEvidence.setTaskSkippedState
    }),
    userPreferences:freeze({...input.timer.userPreferences,Pomodoro}),
    practice:freeze({controller:PracticePacer,model:PracticePacerModel})
  });
  TimerEngine=timerEngineModule.createEngine(freeze({ports:timerPorts}));
  const engine=TimerEngine;
  return freeze({
    format:'study-director.execution-runtime' as const,contractVersion:1 as const,
    TimerState,SessionState,TASKS,TIMER_MODES,TaskIdentity,setTimerMode,TaskSessionState,
    Pomodoro,PracticePacerModel,PracticePacer,TimerEngine:engine,
    TimerPresentation:engine.presentation,SessionEvidenceGateway:engine.evidenceGateway,
    setCompletionSource:CompletionEvidence.setCompletionSource,explicitCompletionSource:CompletionEvidence.explicitCompletionSource,
    plannedSecondsForCompletion:CompletionEvidence.plannedSecondsForCompletion,unitCompletionForTask:CompletionEvidence.unitCompletionForTask,
    progressInputState:CompletionEvidence.progressInputState,syncProgressInputsToState:CompletionEvidence.syncProgressInputsToState,
    clearManualCompletionOverride:CompletionEvidence.clearManualCompletionOverride,focusCompletionForTask:CompletionEvidence.focusCompletionForTask,
    liveTaskOutcome:CompletionEvidence.liveTaskOutcome,resolveTaskCompletion:CompletionEvidence.resolveTaskCompletion,
    exactTaskCompletionPercent:CompletionEvidence.exactTaskCompletionPercent,storeResolvedCompletion:CompletionEvidence.storeResolvedCompletion,
    setCompletionState:CompletionEvidence.setCompletionState,setTaskDoneState:CompletionEvidence.setTaskDoneState,setTaskSkippedState:CompletionEvidence.setTaskSkippedState,
    rebuildOriginalSchedule:ExecutionSchedule.rebuildOriginalSchedule,resetScheduleLayers:ExecutionSchedule.resetScheduleLayers,
    originalStartMin:ExecutionSchedule.originalStartMin,originalEndMin:ExecutionSchedule.originalEndMin,
    adjustedStartMin:ExecutionSchedule.adjustedStartMin,adjustedEndMin:ExecutionSchedule.adjustedEndMin,
    hasAdjustedTiming:ExecutionSchedule.hasAdjustedTiming,scheduleWindowLabel:ExecutionSchedule.scheduleWindowLabel,
    sanitizeRuntimeAdjustedSchedule:ExecutionSchedule.sanitizeRuntimeAdjustedSchedule,effectiveNowMin:ExecutionSchedule.effectiveNowMin,
    plannedRows:ExecutionSchedule.plannedRows,isInsideAdjustedWindow:ExecutionSchedule.isInsideAdjustedWindow,
    remainingWindowSeconds:ExecutionSchedule.remainingWindowSeconds,fixedAnchorRowsFrom:ExecutionSchedule.fixedAnchorRowsFrom,
    avoidFixedAnchorOverlap:ExecutionSchedule.avoidFixedAnchorOverlap,nextIncompleteTrackableFrom:ExecutionSchedule.nextIncompleteTrackableFrom,
    findNextIncompleteTrackableAfter:ExecutionSchedule.findNextIncompleteTrackableAfter,buildLiveTimeline:ExecutionSchedule.buildLiveTimeline,
    getRealTimeState:ExecutionSchedule.getRealTimeState,buildRealTimeSnapshot:ExecutionSchedule.buildRealTimeSnapshot,
    latestTrackableEndMin:ExecutionSchedule.latestTrackableEndMin,
    setCurrentTask,resetBreakState,
    resetCountdownRuntime:()=>engine.resetCountdownRuntime(),
    clearProgressRuntime:()=>TaskSessionState.clear(),
    isTaskResolved:(index:number)=>TaskSessionState.isResolved(index)
  });
}
const createModule=()=>freeze({
  format:'study-director.execution-host-module' as const,contractVersion:1 as const,
  createTaskSessionState,createExecutionSchedule,createCompletionEvidence,createRuntime,createTimerRestoration,createScheduleGateway
});
registry.define('execution-host',1,createModule);
return createModule;
})();
export type ExecutionHostModule=ReturnType<typeof sdExecutionHostFactory>;
