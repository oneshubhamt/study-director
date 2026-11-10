import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {CompletionEvidenceController,CompletionEvidenceInput,ExecutionHostInput,ExecutionScheduleController,ExecutionScheduleInput,ExecutionScheduleRow,RealTimeScheduleState,RuntimeTaskSessionFields,TaskIdentityPort,TaskResolvedState,TaskSessionField,TaskSessionStore} from '../../types/execution-host.ts';
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
    const rows:ExecutionScheduleRow[]=[];
    for(let index=Math.max(0,startIndex||0);index<tasks.length;index++){
      const task=tasks[index]!;
      if(model.isFixed(task))rows.push({idx:index,t:task,start:originalStartMin(index),end:originalEndMin(index),plannedStart:originalStartMin(index),plannedEnd:originalEndMin(index),adjusted:false});
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
    taskSessionState.setField(index,'notes',next);
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
    exactTaskCompletionPercent,storeResolvedCompletion,setTaskDoneState,setTaskSkippedState
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
    setTaskDoneState:CompletionEvidence.setTaskDoneState,setTaskSkippedState:CompletionEvidence.setTaskSkippedState,
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
  createTaskSessionState,createExecutionSchedule,createCompletionEvidence,createRuntime
});
registry.define('execution-host',1,createModule);
return createModule;
})();
export type ExecutionHostModule=ReturnType<typeof sdExecutionHostFactory>;
