import type {InactiveGapPatch} from '../../types/timer-state.ts';
import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {Task,TaskInput} from '../../types/domain.ts';
import type {TimerPayload} from '../../types/record-models.ts';
import type {FrozenController,TimerMode,DeepReadonly,TimerTask,RuntimeInput,TimerSession,InactiveGap,ActiveBreak,ScheduleAdjustment,OriginalScheduleRow,TimerStateInput,SnapshotInput,EvidenceBase} from '../../types/timer-state.ts';
const sdTimerStateFactory=(()=>{
'use strict';
const registry=(globalThis as typeof globalThis & {[key:symbol]:ModuleRegistration<'timer-state','study-director.timer-state'>|undefined})[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,functionPort:functions}=registry.contracts;
const createModule=()=>{
  const freeze=Object.freeze;
  const TIMER_MODES=freeze({
    EMPTY:'empty',READY:'ready',RUNNING:'running',PAUSED:'paused',DONE:'done',SUSPENDED:'suspended'
  });
  const TIMER_MODE_TRANSITIONS:Readonly<Record<TimerMode,readonly string[]>>=freeze({
    empty:freeze(['ready','running','paused','suspended']),
    ready:freeze(['running','paused','done','empty','suspended']),
    running:freeze(['paused','done','ready','empty','suspended']),
    paused:freeze(['running','done','ready','empty','suspended']),
    done:freeze(['ready','running','empty']),
    suspended:freeze(['empty','ready','running'])
  });
  // The recursive copier preserves JSON-shaped field types; the assertion is
  // confined to this clone boundary, never used to validate incoming data.
  function cloneFrozen<T>(value:T):DeepReadonly<T>{return cloneValue(value) as DeepReadonly<T>;}
  function cloneValue(value:unknown,seen=new WeakMap<object,unknown>()):unknown{
    if(value===null||value===undefined||typeof value!=='object')return value;
    if(seen.has(value))return seen.get(value);
    if(Array.isArray(value)){
      const out:unknown[]=[];seen.set(value,out);
      (value as unknown[]).forEach(item=>out.push(cloneValue(item,seen)));
      return freeze(out);
    }
    const out:Record<string,unknown>={};seen.set(value,out);
    Object.entries(value).forEach(([key,item])=>{out[key]=cloneValue(item,seen);});
    return freeze(out);
  }
  function cleanRuntime(value:unknown){
    const raw:RuntimeInput=value&&typeof value==='object'?value:{};
    return cloneFrozen({
      taskIdx:typeof raw.taskIdx==='number'&&Number.isInteger(raw.taskIdx)&&raw.taskIdx>=0?raw.taskIdx:null,
      startMs:raw.startMs===null||raw.startMs===undefined?null:Number(raw.startMs),
      durationSec:Math.max(0,Math.round(Number(raw.durationSec)||0)),
      totalPausedMs:Math.max(0,Math.round(Number(raw.totalPausedMs)||0)),
      pausedStartedMs:raw.pausedStartedMs===null||raw.pausedStartedMs===undefined?null:Number(raw.pausedStartedMs),
      recordedSec:Math.max(0,Math.round(Number(raw.recordedSec)||0)),
      overtimeNotified:!!raw.overtimeNotified,
      lastTickMs:raw.lastTickMs===null||raw.lastTickMs===undefined?null:Number(raw.lastTickMs),
      sleepPausedMs:Math.max(0,Math.round(Number(raw.sleepPausedMs)||0))
    });
  }
  function emptyRuntime(){
    return cleanRuntime({
      taskIdx:null,startMs:null,durationSec:0,totalPausedMs:0,pausedStartedMs:null,
      recordedSec:0,overtimeNotified:false,lastTickMs:null,sleepPausedMs:0
    });
  }
  function liveReadView<T extends object>(read:()=>T):Readonly<T>{
    const target=freeze({});
    return freeze(new Proxy(target,{
      get(_target,property){
        const source=read();
        const value:unknown=Reflect.get(source,property);
        return typeof value==='function'?value.bind(source) as unknown:value;
      },
      has(_target,property){return property in read();},
      set(){throw new TypeError('Timer state views are read-only.');},
      defineProperty(){throw new TypeError('Timer state views are read-only.');},
      deleteProperty(){throw new TypeError('Timer state views are read-only.');}
    })) as Readonly<T>;
  }

  function createStateController(input:TimerStateInput){
    if(!input||!Object.isFrozen(input))throw new TypeError('Timer state input must be frozen.');
    exactObject(input,['helpers','diagnostics','effects'],'Timer state input');
    functions(input.helpers,['makeTaskId'],'Timer state helpers');
    functions(input.diagnostics,['capture'],'Timer state diagnostics');
    functions(input.effects,['modeChanged'],'Timer state effects');
    const makeTaskId=input.helpers.makeTaskId;
    const capture=input.diagnostics.capture;
    const modeChanged=input.effects.modeChanged;

    let tasks:readonly DeepReadonly<TimerTask>[]=freeze([]);
    let session:Readonly<TimerSession>=freeze({studyDate:null,currentTaskId:null,contentRevision:0,savedRevision:0});
    let mode:TimerMode=TIMER_MODES.EMPTY;
    let currentIndex=0;
    let paused=false;
    let runtime=emptyRuntime();
    let inactiveGap:Readonly<InactiveGapPatch>|null=null;
    let activeBreak:Readonly<Partial<ActiveBreak>>|null=null;
    let breakStartMs:number|null=null;
    let currentBreakSec=0;
    let pendingRestore:DeepReadonly<TimerPayload>|null=null;
    let originalSchedule:readonly DeepReadonly<OriginalScheduleRow>[]=freeze([]);
    let adjustedSchedule:Readonly<Record<string,Readonly<ScheduleAdjustment>>>=freeze({});
    let scheduleAnchorMin=0;

    const tasksView=liveReadView(()=>tasks);
    const sessionView=liveReadView(()=>session);
    function taskIdAt(index:unknown){
      const idx=Number(index);
      return Number.isInteger(idx)&&idx>=0&&idx<tasks.length?String(tasks[idx]!.id||'')||null:null;
    }
    const taskIdentity=freeze({
      validIndex(value:unknown){
        const idx=Number(value);
        return Number.isInteger(idx)&&idx>=0&&idx<tasks.length?idx:null;
      },
      idAt:taskIdAt,
      indexMap(){
        const map=new Map<string,number>();
        tasks.forEach((task,index)=>{if(task&&task.id)map.set(String(task.id),index);});
        return map;
      },
      indexForId(taskId:unknown,indexMap:ReadonlyMap<string,number>|null=null){
        const id=String(taskId||'').trim();
        if(!id)return null;
        const idx=(indexMap||this.indexMap()).get(id);
        return typeof idx==='number'&&Number.isInteger(idx)?idx:null;
      }
    });
    function normalizeTasks(values:readonly Task[]){
      const seen=new Set<string>();
      return freeze((Array.isArray(values)?values as readonly Task[]:[]).map((value,index)=>{
        const task:Task={...value};
        let id=String(task.id||'').trim();
        if(!id||seen.has(id))id=String(makeTaskId(task,index));
        while(seen.has(id))id+=`_${index+1}`;
        task.id=id;seen.add(id);
        return cloneFrozen({...task,id});
      }));
    }
    function replaceSession(patch:Partial<TimerSession>){
      session=cloneFrozen({...session,...patch});
      return sessionView;
    }
    function setCurrentIndex(value:unknown){
      const next=Math.max(0,Math.min(tasks.length,Number.isFinite(Number(value))?Math.round(Number(value)):0));
      currentIndex=next;
      replaceSession({currentTaskId:taskIdAt(next)});
      return currentIndex;
    }
    function loadSchedule(values:readonly Task[],options:{studyDate?:string}={}){
      tasks=normalizeTasks(values);
      const studyDate=options&&typeof options.studyDate==='string'?options.studyDate:session.studyDate;
      replaceSession({studyDate:studyDate||null,currentTaskId:null});
      setCurrentIndex(0);
      return tasksView;
    }
    // Changes only the Area of today's blocks, when a note is renamed together
    // with its Area: ids, order, the current block and progress stay as they
    // are. rename(row) returns the new Area, or undefined to leave the row.
    function renameTaskAreas(rename:(row:Readonly<TaskInput>)=>unknown){
      const relabel=<T extends Readonly<TaskInput>>(rows:readonly T[])=>rows.map(row=>{const area=row&&typeof row==='object'?rename(row):undefined;return area===undefined?row:{...row,area:String(area)};});
      const next=relabel(tasks),changed=next.filter((task,index)=>task!==tasks[index]).length;
      if(!changed)return 0;
      tasks=normalizeTasks(next);originalSchedule=cloneFrozen(relabel(originalSchedule));
      return changed;
    }
    function clearSession(){
      tasks=freeze([]);
      session=freeze({studyDate:null,currentTaskId:null,contentRevision:0,savedRevision:0});
      currentIndex=0;mode=TIMER_MODES.EMPTY;paused=false;runtime=emptyRuntime();
      inactiveGap=null;activeBreak=null;breakStartMs=null;currentBreakSec=0;pendingRestore=null;
      originalSchedule=freeze([]);adjustedSchedule=freeze({});scheduleAnchorMin=0;
      return true;
    }
    function setMode(next:unknown,reason='runtime'){
      if(typeof next!=='string'||!(Object.values(TIMER_MODES) as readonly string[]).includes(next))return false;
      const nextMode=next as TimerMode;
      if(mode===next)return true;
      const previous=mode;
      if(!(TIMER_MODE_TRANSITIONS[previous]||[]).includes(next)){
        capture('timer.unexpected-transition',new Error(`${previous} -> ${next} (${reason})`),'warn');
      }
      mode=nextMode;
      try{modeChanged(previous,nextMode,reason);}catch(error){capture('timer.panel-update',error,'error');}
      return true;
    }
    function patchRuntime(patch:RuntimeInput){
      runtime=cleanRuntime({...runtime,...(patch&&typeof patch==='object'?patch:{})});
      return runtime;
    }
    function patchInactiveGap(patch:InactiveGapPatch){
      inactiveGap=cloneFrozen({...((inactiveGap&&typeof inactiveGap==='object')?inactiveGap:{}),...(patch||{})});
      return inactiveGap;
    }
    function patchActiveBreak(patch:Partial<ActiveBreak>){
      activeBreak=cloneFrozen({...((activeBreak&&typeof activeBreak==='object')?activeBreak:{}),...(patch||{})});
      return activeBreak;
    }
    function replaceAdjustedSchedule(value:Readonly<Record<string,Readonly<ScheduleAdjustment>>>){
      const out:Record<string,Readonly<ScheduleAdjustment>>={};
      Object.entries(value&&typeof value==='object'?value:{}).forEach(([key,entry])=>{
        if(entry&&typeof entry==='object')out[key]=cloneFrozen(entry);
      });
      adjustedSchedule=freeze(out);
      return adjustedSchedule;
    }
    function setAdjustment(index:unknown,value:Readonly<ScheduleAdjustment>|null){
      const key=String(index);
      const next={...adjustedSchedule};
      if(value&&typeof value==='object')next[key]=cloneFrozen(value);else delete next[key];
      return replaceAdjustedSchedule(next);
    }
    function captureAdjustmentsByTaskId(){
      const out:Record<string,Readonly<ScheduleAdjustment>>={};
      Object.entries(adjustedSchedule).forEach(([index,entry])=>{
        const id=taskIdAt(Number(index));
        if(id)out[id]=cloneFrozen(entry);
      });
      return freeze(out);
    }
    function projectSessionSnapshot(input:SnapshotInput|null){
      if(!input||typeof input!=='object')return null;
      const snapshot:SnapshotInput&{currentTaskId:string|null;contentRevision:number;savedRevision:number;scheduleAdjustments:Readonly<Record<string,Readonly<ScheduleAdjustment>>>}={
        version:Number(input.version)||6,
        date:String(input.date||session.studyDate||''),
        fingerprint:String(input.fingerprint||''),
        contentRevision:Math.max(0,Math.round(Number(session.contentRevision)||0)),
        savedRevision:Math.max(0,Math.min(
          Math.round(Number(session.contentRevision)||0),Math.round(Number(session.savedRevision)||0)
        )),
        currentTaskId:session.currentTaskId||taskIdAt(currentIndex),
        taskState:input.taskState&&typeof input.taskState==='object'?input.taskState:{},
        scheduleAdjustments:captureAdjustmentsByTaskId(),
        timerRuntime:input.timerRuntime||null,
        latestCarryForward:String(input.latestCarryForward||''),
        updatedAt:String(input.updatedAt||new Date().toISOString())
      };
      if(input.review&&typeof input.review==='object')snapshot.review=input.review;
      if(input.practice)snapshot.practice=input.practice;
      return cloneFrozen(snapshot);
    }
    function snapshot(){
      return cloneFrozen({
        format:'study-director.timer-state-snapshot',contractVersion:1,
        tasks,session,mode,currentIndex,paused,runtime,inactiveGap,activeBreak,
        breakStartMs,currentBreakSec,pendingRestore,originalSchedule,adjustedSchedule,
        scheduleAnchorMin
      });
    }
    function createEvidenceGateway<O extends object,E extends EvidenceBase>(projector:(options:Partial<O>,state:ReturnType<typeof snapshot>)=>E){
      if(typeof projector!=='function')throw new TypeError('Session evidence projector must be a function.');
      function evidence(options:Partial<O>={}){
        const projected=projector(options,snapshot());
        const base=projected&&typeof projected==='object'?projected:{} as Partial<E>;
        return cloneFrozen({
          ...base,
          format:'study-director.review-evidence',version:1,
          date:session.studyDate||base.date||'',
          currentTaskIndex:currentIndex,currentTaskId:taskIdAt(currentIndex),
          timerMode:mode,paused,inactiveGap:inactiveGap||null,pendingGap:!!inactiveGap,
          contentRevision:Math.max(0,Math.round(Number(session.contentRevision)||0)),
          savedRevision:Math.max(0,Math.round(Number(session.savedRevision)||0))
        });
      }
      return freeze({
        format:'study-director.session-evidence-gateway',contractVersion:1,
        snapshot:evidence,
        currentTask:()=>tasks[currentIndex]||null,
        taskEvidence:(taskId:unknown,options:Partial<O>={})=>evidence(options).taskEvidence?.[String(taskId||'')]||null,
        practiceRuns:(options:Partial<O>={})=>evidence(options).practiceRuns||freeze([]),
        scheduleAdjustments:captureAdjustmentsByTaskId,
        contentRevision:()=>Math.max(0,Math.round(Number(session.contentRevision)||0)),
        savedRevision:()=>Math.max(0,Math.round(Number(session.savedRevision)||0)),
        isLive:()=>runtime.startMs!==null&&(mode===TIMER_MODES.RUNNING||mode===TIMER_MODES.PAUSED)
      });
    }

    const controller={
      format:'study-director.timer-state-controller' as const,
      contractVersion:1 as const,
      modes:TIMER_MODES,
      get tasks(){return tasksView;},
      get session(){return sessionView;},
      taskIdentity:taskIdentity,
      get mode(){return mode;},
      set mode(value:TimerMode){setMode(value);},
      get currentIndex(){return currentIndex;},
      set currentIndex(value:number){setCurrentIndex(value);},
      get paused(){return paused;},
      set paused(value:boolean){paused=!!value;},
      get runtime(){return runtime;},
      set runtime(value:RuntimeInput){runtime=cleanRuntime(value);},
      get inactiveGap(){return inactiveGap;},
      set inactiveGap(value:InactiveGapPatch|null){inactiveGap=value?cloneFrozen(value):null;},
      get activeBreak(){return activeBreak;},
      set activeBreak(value:Partial<ActiveBreak>|null){activeBreak=value?cloneFrozen(value):null;},
      get breakStartMs(){return breakStartMs;},
      set breakStartMs(value:number|null){breakStartMs=value===null?null:Number(value);},
      get currentBreakSec(){return currentBreakSec;},
      set currentBreakSec(value:number){currentBreakSec=Math.max(0,Math.round(Number(value)||0));},
      get pendingRestore(){return pendingRestore;},
      set pendingRestore(value:TimerPayload|null){pendingRestore=value?cloneFrozen(value):null;},
      get originalSchedule(){return originalSchedule;},
      set originalSchedule(value:readonly OriginalScheduleRow[]){originalSchedule=cloneFrozen(Array.isArray(value)?value as readonly OriginalScheduleRow[]:[]);},
      get adjustedSchedule(){return adjustedSchedule;},
      set adjustedSchedule(value:Readonly<Record<string,Readonly<ScheduleAdjustment>>>){replaceAdjustedSchedule(value);},
      get scheduleAnchorMin(){return scheduleAnchorMin;},
      set scheduleAnchorMin(value:number){scheduleAnchorMin=Number(value)||0;},
      get studyDate(){return session.studyDate;},
      set studyDate(value:string|null){replaceSession({studyDate:value||null});},
      get currentTaskId(){return session.currentTaskId;},
      get contentRevision(){return session.contentRevision;},
      set contentRevision(value:number){replaceSession({contentRevision:Math.max(0,Math.round(Number(value)||0))});},
      get savedRevision(){return session.savedRevision;},
      set savedRevision(value:number){replaceSession({savedRevision:Math.max(0,Math.round(Number(value)||0))});},
      emptyRuntime:emptyRuntime,
      loadSchedule:loadSchedule,
      renameTaskAreas:renameTaskAreas,
      clearSession:clearSession,
      ensureTaskIds:()=>true,
      setMode:setMode,
      patchRuntime:patchRuntime,
      patchInactiveGap:patchInactiveGap,
      patchActiveBreak:patchActiveBreak,
      replaceAdjustedSchedule:replaceAdjustedSchedule,
      setAdjustment:setAdjustment,
      removeAdjustment:(index:unknown)=>setAdjustment(index,null),
      captureAdjustmentsByTaskId:captureAdjustmentsByTaskId,
      projectSessionSnapshot:projectSessionSnapshot,
      createEvidenceGateway:createEvidenceGateway,
      snapshot:snapshot,
    };
    return freeze(controller) as FrozenController<typeof controller>;
  }


  return freeze({
    format:'study-director.timer-state',contractVersion:1,
    TIMER_MODES,createStateController
  });
};
registry.define('timer-state',1,createModule);
return createModule;
})();
export type TimerStateModule=ReturnType<typeof sdTimerStateFactory>;
