(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,functionPort:functions}=registry.contracts;
registry.define('timer-state',1,()=>{
  const freeze=Object.freeze;
  const TIMER_MODES=freeze({
    EMPTY:'empty',READY:'ready',RUNNING:'running',PAUSED:'paused',DONE:'done',SUSPENDED:'suspended'
  });
  const TIMER_MODE_TRANSITIONS=freeze({
    empty:freeze(['ready','running','paused','suspended']),
    ready:freeze(['running','paused','done','empty','suspended']),
    running:freeze(['paused','done','ready','empty','suspended']),
    paused:freeze(['running','done','ready','empty','suspended']),
    done:freeze(['ready','running','empty']),
    suspended:freeze(['empty','ready','running'])
  });
  function cloneFrozen(value,seen=new WeakMap()){
    if(value===null||value===undefined||typeof value!=='object')return value;
    if(seen.has(value))return seen.get(value);
    if(Array.isArray(value)){
      const out=[];seen.set(value,out);
      value.forEach(item=>out.push(cloneFrozen(item,seen)));
      return freeze(out);
    }
    const out={};seen.set(value,out);
    Object.entries(value).forEach(([key,item])=>{out[key]=cloneFrozen(item,seen);});
    return freeze(out);
  }
  function cleanRuntime(value){
    const raw=value&&typeof value==='object'?value:{};
    return cloneFrozen({
      taskIdx:Number.isInteger(raw.taskIdx)&&raw.taskIdx>=0?raw.taskIdx:null,
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
  function liveReadView(read){
    const target=freeze({});
    return freeze(new Proxy(target,{
      get(_target,property){
        const source=read();
        const value=source[property];
        return typeof value==='function'?value.bind(source):value;
      },
      has(_target,property){return property in read();},
      set(){throw new TypeError('Timer state views are read-only.');},
      defineProperty(){throw new TypeError('Timer state views are read-only.');},
      deleteProperty(){throw new TypeError('Timer state views are read-only.');}
    }));
  }

  function createStateController(input){
    if(!input||!Object.isFrozen(input))throw new TypeError('Timer state input must be frozen.');
    exactObject(input,['helpers','diagnostics','effects'],'Timer state input');
    functions(input.helpers,['makeTaskId'],'Timer state helpers');
    functions(input.diagnostics,['capture'],'Timer state diagnostics');
    functions(input.effects,['modeChanged'],'Timer state effects');
    const makeTaskId=input.helpers.makeTaskId;
    const capture=input.diagnostics.capture;
    const modeChanged=input.effects.modeChanged;

    let tasks=freeze([]);
    let session=freeze({studyDate:null,currentTaskId:null,contentRevision:0,savedRevision:0});
    let mode=TIMER_MODES.EMPTY;
    let currentIndex=0;
    let paused=false;
    let runtime=emptyRuntime();
    let inactiveGap=null;
    let activeBreak=null;
    let breakStartMs=null;
    let currentBreakSec=0;
    let pendingRestore=null;
    let originalSchedule=freeze([]);
    let adjustedSchedule=freeze({});
    let scheduleAnchorMin=0;

    const tasksView=liveReadView(()=>tasks);
    const sessionView=liveReadView(()=>session);
    function taskIdAt(index){
      const idx=Number(index);
      return Number.isInteger(idx)&&idx>=0&&idx<tasks.length?String(tasks[idx].id||'')||null:null;
    }
    const taskIdentity=freeze({
      validIndex(value){
        const idx=Number(value);
        return Number.isInteger(idx)&&idx>=0&&idx<tasks.length?idx:null;
      },
      idAt:taskIdAt,
      indexMap(){
        const map=new Map();
        tasks.forEach((task,index)=>{if(task&&task.id)map.set(String(task.id),index);});
        return map;
      },
      indexForId(taskId,indexMap=null){
        const id=String(taskId||'').trim();
        if(!id)return null;
        const idx=(indexMap||this.indexMap()).get(id);
        return Number.isInteger(idx)?idx:null;
      }
    });
    function normalizeTasks(values){
      const seen=new Set();
      return freeze((Array.isArray(values)?values:[]).map((value,index)=>{
        const task=value&&typeof value==='object'?{...value}:{};
        let id=String(task.id||'').trim();
        if(!id||seen.has(id))id=String(makeTaskId(task,index));
        while(seen.has(id))id+=`_${index+1}`;
        task.id=id;seen.add(id);
        return cloneFrozen(task);
      }));
    }
    function replaceSession(patch){
      session=cloneFrozen({...session,...patch});
      return sessionView;
    }
    function setCurrentIndex(value){
      const next=Math.max(0,Math.min(tasks.length,Number.isFinite(Number(value))?Math.round(Number(value)):0));
      currentIndex=next;
      replaceSession({currentTaskId:taskIdAt(next)});
      return currentIndex;
    }
    function loadSchedule(values,options={}){
      tasks=normalizeTasks(values);
      const studyDate=options&&typeof options.studyDate==='string'?options.studyDate:session.studyDate;
      replaceSession({studyDate:studyDate||null,currentTaskId:null});
      setCurrentIndex(0);
      return tasksView;
    }
    function clearSession(){
      tasks=freeze([]);
      session=freeze({studyDate:null,currentTaskId:null,contentRevision:0,savedRevision:0});
      currentIndex=0;mode=TIMER_MODES.EMPTY;paused=false;runtime=emptyRuntime();
      inactiveGap=null;activeBreak=null;breakStartMs=null;currentBreakSec=0;pendingRestore=null;
      originalSchedule=freeze([]);adjustedSchedule=freeze({});scheduleAnchorMin=0;
      return true;
    }
    function setMode(next,reason='runtime'){
      if(!Object.values(TIMER_MODES).includes(next))return false;
      if(mode===next)return true;
      const previous=mode;
      if(!(TIMER_MODE_TRANSITIONS[previous]||[]).includes(next)){
        capture('timer.unexpected-transition',new Error(`${previous} -> ${next} (${reason})`),'warn');
      }
      mode=next;
      try{modeChanged(previous,next,reason);}catch(error){capture('timer.panel-update',error,'error');}
      return true;
    }
    function patchRuntime(patch){
      runtime=cleanRuntime({...runtime,...(patch&&typeof patch==='object'?patch:{})});
      return runtime;
    }
    function patchInactiveGap(patch){
      inactiveGap=cloneFrozen({...((inactiveGap&&typeof inactiveGap==='object')?inactiveGap:{}),...(patch||{})});
      return inactiveGap;
    }
    function patchActiveBreak(patch){
      activeBreak=cloneFrozen({...((activeBreak&&typeof activeBreak==='object')?activeBreak:{}),...(patch||{})});
      return activeBreak;
    }
    function replaceAdjustedSchedule(value){
      const out={};
      Object.entries(value&&typeof value==='object'?value:{}).forEach(([key,entry])=>{
        if(entry&&typeof entry==='object')out[key]=cloneFrozen(entry);
      });
      adjustedSchedule=freeze(out);
      return adjustedSchedule;
    }
    function setAdjustment(index,value){
      const key=String(index);
      const next={...adjustedSchedule};
      if(value&&typeof value==='object')next[key]=cloneFrozen(value);else delete next[key];
      return replaceAdjustedSchedule(next);
    }
    function captureAdjustmentsByTaskId(){
      const out={};
      Object.entries(adjustedSchedule).forEach(([index,entry])=>{
        const id=taskIdAt(Number(index));
        if(id)out[id]=cloneFrozen(entry);
      });
      return freeze(out);
    }
    function projectSessionSnapshot(input){
      if(!input||typeof input!=='object')return null;
      const snapshot={
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
    function createEvidenceGateway(projector){
      if(typeof projector!=='function')throw new TypeError('Session evidence projector must be a function.');
      function evidence(options={}){
        const projected=projector(options,snapshot());
        const base=projected&&typeof projected==='object'?projected:{};
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
        taskEvidence:(taskId,options={})=>evidence(options).taskEvidence?.[String(taskId||'')]||null,
        practiceRuns:(options={})=>evidence(options).practiceRuns||freeze([]),
        scheduleAdjustments:captureAdjustmentsByTaskId,
        contentRevision:()=>Math.max(0,Math.round(Number(session.contentRevision)||0)),
        savedRevision:()=>Math.max(0,Math.round(Number(session.savedRevision)||0)),
        isLive:()=>runtime.startMs!==null&&[TIMER_MODES.RUNNING,TIMER_MODES.PAUSED].includes(mode)
      });
    }

    const controller={};
    Object.defineProperties(controller,{
      format:{value:'study-director.timer-state-controller',enumerable:true},
      contractVersion:{value:1,enumerable:true},
      modes:{value:TIMER_MODES,enumerable:true},
      tasks:{get:()=>tasksView,enumerable:true},
      session:{get:()=>sessionView,enumerable:true},
      taskIdentity:{value:taskIdentity,enumerable:true},
      mode:{get:()=>mode,set:value=>{setMode(value);},enumerable:true},
      currentIndex:{get:()=>currentIndex,set:value=>{setCurrentIndex(value);},enumerable:true},
      paused:{get:()=>paused,set:value=>{paused=!!value;},enumerable:true},
      runtime:{get:()=>runtime,set:value=>{runtime=cleanRuntime(value);},enumerable:true},
      inactiveGap:{get:()=>inactiveGap,set:value=>{inactiveGap=value?cloneFrozen(value):null;},enumerable:true},
      activeBreak:{get:()=>activeBreak,set:value=>{activeBreak=value?cloneFrozen(value):null;},enumerable:true},
      breakStartMs:{get:()=>breakStartMs,set:value=>{breakStartMs=value===null?null:Number(value);},enumerable:true},
      currentBreakSec:{get:()=>currentBreakSec,set:value=>{currentBreakSec=Math.max(0,Math.round(Number(value)||0));},enumerable:true},
      pendingRestore:{get:()=>pendingRestore,set:value=>{pendingRestore=value?cloneFrozen(value):null;},enumerable:true},
      originalSchedule:{get:()=>originalSchedule,set:value=>{originalSchedule=cloneFrozen(Array.isArray(value)?value:[]);},enumerable:true},
      adjustedSchedule:{get:()=>adjustedSchedule,set:value=>{replaceAdjustedSchedule(value);},enumerable:true},
      scheduleAnchorMin:{get:()=>scheduleAnchorMin,set:value=>{scheduleAnchorMin=Number(value)||0;},enumerable:true},
      studyDate:{get:()=>session.studyDate,set:value=>{replaceSession({studyDate:value||null});},enumerable:true},
      currentTaskId:{get:()=>session.currentTaskId,enumerable:true},
      contentRevision:{get:()=>session.contentRevision,set:value=>{replaceSession({contentRevision:Math.max(0,Math.round(Number(value)||0))});},enumerable:true},
      savedRevision:{get:()=>session.savedRevision,set:value=>{replaceSession({savedRevision:Math.max(0,Math.round(Number(value)||0))});},enumerable:true},
      emptyRuntime:{value:emptyRuntime,enumerable:true},
      loadSchedule:{value:loadSchedule,enumerable:true},
      clearSession:{value:clearSession,enumerable:true},
      ensureTaskIds:{value:()=>true,enumerable:true},
      setMode:{value:setMode,enumerable:true},
      patchRuntime:{value:patchRuntime,enumerable:true},
      patchInactiveGap:{value:patchInactiveGap,enumerable:true},
      patchActiveBreak:{value:patchActiveBreak,enumerable:true},
      replaceAdjustedSchedule:{value:replaceAdjustedSchedule,enumerable:true},
      setAdjustment:{value:setAdjustment,enumerable:true},
      removeAdjustment:{value:index=>setAdjustment(index,null),enumerable:true},
      captureAdjustmentsByTaskId:{value:captureAdjustmentsByTaskId,enumerable:true},
      projectSessionSnapshot:{value:projectSessionSnapshot,enumerable:true},
      createEvidenceGateway:{value:createEvidenceGateway,enumerable:true},
      snapshot:{value:snapshot,enumerable:true}
    });
    return freeze(controller);
  }


  return freeze({
    format:'study-director.timer-state',contractVersion:1,
    TIMER_MODES,createStateController
  });
});
})();
