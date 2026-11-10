import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {ExecutionHostInput,RuntimeTaskSessionFields,TaskIdentityPort,TaskResolvedState,TaskSessionField,TaskSessionStore} from '../../types/execution-host.ts';
import type {TimerEngineInput} from '../../types/timer-engine.ts';

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
function createRuntime(input:Readonly<ExecutionHostInput>){
  exactObject(input,['modules','timerState','pomodoro','practiceModel','practice','timer','hooks'],'Execution host input');
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
  let TimerEngine:ReturnType<typeof timerEngineModule.createEngine>|null=null;

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
    schedule:freeze({...input.timer.schedule,isTaskResolved:TaskSessionState.isResolved}),
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
    setCurrentTask,resetBreakState,
    resetCountdownRuntime:()=>engine.resetCountdownRuntime(),
    clearProgressRuntime:()=>TaskSessionState.clear(),
    isTaskResolved:(index:number)=>TaskSessionState.isResolved(index)
  });
}
const createModule=()=>freeze({
  format:'study-director.execution-host-module' as const,contractVersion:1 as const,
  createTaskSessionState,createRuntime
});
registry.define('execution-host',1,createModule);
return createModule;
})();
export type ExecutionHostModule=ReturnType<typeof sdExecutionHostFactory>;
