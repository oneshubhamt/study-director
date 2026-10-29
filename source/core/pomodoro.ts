import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {PomodoroInput,PomodoroConfiguration,PomodoroCue,CycleOptions,StopOptions,PomodoroPayloads,PomodoroResults,PomodoroArguments} from '../../types/pomodoro.ts';
import type {CueDelivery} from '../../types/practice-pacer.ts';
const sdPomodoroFactory=(()=>{
'use strict';
const registry=(globalThis as unknown as Record<symbol,unknown>)[Symbol.for('studyDirector.internalModules.v1')] as ModuleRegistration<'pomodoro','study-director.pomodoro-module'>|undefined;
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject}=registry.contracts;
const createModule=()=>{
  const freeze=Object.freeze;
  const PORT_FIELDS=freeze({
    state:freeze(['TASKS','TIMER_MODES','TimerState']),
    schedule:freeze(['isPomodoroEligibleBlock']),
    persistence:freeze(['canMutate','readConfiguration','writeConfiguration','writeSession']),
    view:freeze(['document','notifications','updateExecutePanels']),
    environment:freeze(['nowIso'])
  });
  function createController(input:PomodoroInput){
    exactObject(input,['ports'],'Pomodoro input');
    const ports=exactObject(input.ports,Object.keys(PORT_FIELDS),'Pomodoro ports');
    for(const [name,fields] of Object.entries(PORT_FIELDS) as [keyof typeof PORT_FIELDS,readonly string[]][])exactObject(ports[name],fields,'Pomodoro '+name+' port');
    const {TASKS,TIMER_MODES,TimerState}=ports.state;
    const {isPomodoroEligibleBlock}=ports.schedule;
    const {canMutate,readConfiguration,writeConfiguration,writeSession}=ports.persistence;
    const {document,notifications,updateExecutePanels}=ports.view;
    const {nowIso}=ports.environment;
  const DEFAULT=Object.freeze({
    enabled:true,
    nudgeAfter:50,      // minutes of continuous work focus before a Pomodoro cue
    breakMinutes:10    // planned Pomodoro break once the user accepts the cue
  });
  let nudgeConfigurationState:PomodoroConfiguration|null=null;
  let lastNudgeSec=0;
  let cycleStartSec=0;
  let pomodoroCue:PomodoroCue|null=null;
  let reminderDelivery:CueDelivery|null=null;
  let lastActiveSec=0;

  function sanitizeConfig(raw:unknown=null){
    const src=raw&&typeof raw==='object'?raw as Partial<Record<keyof PomodoroConfiguration,unknown>>:{};
    const nudgeAfter=Number(src.nudgeAfter??DEFAULT.nudgeAfter);
    const breakMinutes=Number(src.breakMinutes??DEFAULT.breakMinutes);
    return {
      enabled:src.enabled===undefined?DEFAULT.enabled:!!src.enabled,
      nudgeAfter:Number.isFinite(nudgeAfter)&&nudgeAfter>0?Math.max(1,Math.min(240,Math.round(nudgeAfter))):DEFAULT.nudgeAfter,
      breakMinutes:Number.isFinite(breakMinutes)&&breakMinutes>0?Math.max(1,Math.min(60,Math.round(breakMinutes))):DEFAULT.breakMinutes
    };
  }
  function currentConfig(){
    if(!nudgeConfigurationState)nudgeConfigurationState=sanitizeConfig();
    return nudgeConfigurationState;
  }
  function renderConfiguration(){
    const current=currentConfig();
    const toggleBtn=document.getElementById('ns-toggle-btn');
    if(toggleBtn){toggleBtn.textContent=current.enabled?'On':'Off';toggleBtn.setAttribute('aria-checked',String(current.enabled));}
    const nf=document.getElementById('ns-nudge-after') as HTMLInputElement|null;if(nf)nf.value=String(current.nudgeAfter);
    const nb=document.getElementById('ns-break') as HTMLInputElement|null;if(nb)nb.value=String(current.breakMinutes);
    updateExecutePanels();
  }
  function persistConfiguration(){
    if(!canMutate()||!nudgeConfigurationState)return;
    writeConfiguration(nudgeConfigurationState);
  }
  function loadConfiguration(){
    try{nudgeConfigurationState=sanitizeConfig(readConfiguration());}
    catch(e){nudgeConfigurationState=sanitizeConfig();}
    const nf=document.getElementById('ns-nudge-after') as HTMLInputElement|null;if(nf)nf.value=String(nudgeConfigurationState.nudgeAfter);
    const nb=document.getElementById('ns-break') as HTMLInputElement|null;if(nb)nb.value=String(nudgeConfigurationState.breakMinutes);
    renderConfiguration();
    return Object.freeze({...nudgeConfigurationState});
  }
  function toggleNudges(){
    if(!canMutate())return currentConfig().enabled;
    const current=currentConfig();
    current.enabled=!current.enabled;
    if(!current.enabled)stop({dismiss:true,audio:false});
    renderConfiguration();
    persistConfiguration();
    return current.enabled;
  }
  function updateFromUi(){
    if(!canMutate())return Object.freeze({...currentConfig()});
    const current=currentConfig();
    const prior=JSON.stringify(current);
    for(const [key,id,max] of [['nudgeAfter','ns-nudge-after',240],['breakMinutes','ns-break',60]] as const){
      const field=document.getElementById(id) as HTMLInputElement|null,value=Number(field?.value);
      if(field&&field.value.trim()&&Number.isFinite(value))current[key]=Math.max(1,Math.min(max,Math.round(value)));
    }
    nudgeConfigurationState=sanitizeConfig(current);
    if(prior===JSON.stringify(current)){renderConfiguration();return Object.freeze({...current});}
    renderConfiguration();
    persistConfiguration();
    return Object.freeze({...nudgeConfigurationState});
  }
  function isEnabled(){return !!currentConfig().enabled;}
  function breakSeconds(){return Math.max(60,Math.round((Number(currentConfig().breakMinutes)||DEFAULT.breakMinutes)*60));}

  function readActiveSeconds(value:unknown){
    const active=Number(value);
    if(Number.isFinite(active))lastActiveSec=Math.max(0,Math.floor(active));
    else if(!TimerState.runtime||TimerState.runtime.startMs===null)lastActiveSec=0;
    return lastActiveSec;
  }
  function normalizeCycle(activeSec?:number){
    if(!TimerState.runtime||TimerState.runtime.startMs===null){
      cycleStartSec=0;
      lastNudgeSec=0;
      lastActiveSec=0;
      return 0;
    }
    const active=readActiveSeconds(activeSec);
    const startSec=Math.max(0,Math.floor(Number(cycleStartSec)||0));
    cycleStartSec=startSec>active?0:startSec;
    const cycle=Math.max(0,active-cycleStartSec);
    // lastNudgeSec is only the user's explicit skip/dismiss anchor. It must never
    // suppress the first due cue in a fresh continuous-work cycle.
    if(!Number.isFinite(lastNudgeSec)||lastNudgeSec<0||lastNudgeSec>cycle)lastNudgeSec=0;
    return cycle;
  }
  function currentCycleSeconds(activeSec?:number){
    if(!TimerState.runtime||TimerState.runtime.startMs===null)return 0;
    return normalizeCycle(activeSec);
  }
  function resetCycle(anchorSec:number|null=null,options:CycleOptions={}){
    const active=Number.isFinite(anchorSec)?anchorSec:(TimerState.runtime&&TimerState.runtime.startMs!==null?readActiveSeconds(options.activeSec):0);
    cycleStartSec=Math.max(0,Math.floor(active||0));
    lastNudgeSec=0;
    pomodoroCue=null;
    if(reminderDelivery){reminderDelivery.resolve();reminderDelivery=null;}
    if(options.hide!==false)hideOverlay();
  }
  function restoreCycle(cycle:{startSec:number}|null|undefined,options:CycleOptions={}){
    if(cycle&&typeof cycle==='object'){
      cycleStartSec=Math.max(0,Math.floor(Number(cycle.startSec)||0));
      lastNudgeSec=0;
      normalizeCycle(options.activeSec);
    }else resetCycle(0);
  }
  function cycleSnapshot(){return Object.freeze({startSec:Math.max(0,Math.round(Number(cycleStartSec)||0))});}
  function hideOverlay(){const overlay=document.getElementById('nudge-overlay');if(overlay)overlay.classList.remove('on');}
  function overlayVisible(){return !!document.getElementById('nudge-overlay')?.classList.contains('on');}
  function eligible(){
    return !!(
      currentConfig().enabled&&TimerState.mode===TIMER_MODES.RUNNING&&!TimerState.paused&&
      TimerState.currentIndex<TASKS.length&&isPomodoroEligibleBlock(TASKS[TimerState.currentIndex])&&
      !TimerState.inactiveGap&&!document.getElementById('gap-overlay')?.classList.contains('on')
    );
  }
  function clearCue(options:CycleOptions={}){
    pomodoroCue=null;
    if(reminderDelivery){reminderDelivery.resolve();reminderDelivery=null;}
    if(options.hide!==false)hideOverlay();
  }
  function visibleCue(){return eligible()&&overlayVisible()&&pomodoroCue&&pomodoroCue.taskIdx===TimerState.currentIndex?pomodoroCue:null;}
  function reconcileCue(){
    const cue=visibleCue();
    if(cue)return cue;
    if(pomodoroCue||overlayVisible())clearCue();
    return null;
  }
  function cueDue(cycleSec:number,dueSec:number){
    if(cycleSec<dueSec)return false;
    return lastNudgeSec<=0||(cycleSec-lastNudgeSec)>=dueSec;
  }
  function showNudge(cycleSec=currentCycleSeconds()){
    if(!eligible())return false;
    const overlay=document.getElementById('nudge-overlay');if(!overlay)return false;
    const msg=document.getElementById('nudge-msg');
    const btn=document.getElementById('nudge-break');
    const nudgeSec=Math.max(0,Math.floor(Number(cycleSec)||0));
    const mins=Math.max(1,Math.floor(nudgeSec/60));
    const breakMins=Math.round(breakSeconds()/60);
    const text=`You’ve studied continuously for ${mins} minutes. Take a ${breakMins}-minute Pomodoro break when you are ready.`;
    pomodoroCue={taskIdx:TimerState.currentIndex,issuedAt:nowIso()};
    if(msg)msg.textContent=text;
    if(btn)btn.textContent=`Take ${breakMins}m break`;
    overlay.classList.add('on');
    reminderDelivery=notifications.begin({source:'pomodoro',id:'reminder',surface:'quiet',foreground:false,cue:'pomodoro',occurrence:pomodoroCue.issuedAt,title:'Pomodoro cue',message:text,system:true});
    return true;
  }
  function handleTick(payload:PomodoroPayloads['tick']={}){
    if(!eligible()){
      reconcileCue();
      return false;
    }
    if(visibleCue())return true;
    if(pomodoroCue||overlayVisible())clearCue();
    const cycleSec=normalizeCycle(payload.activeSec);
    const due=Math.max(1,Number(currentConfig().nudgeAfter)||DEFAULT.nudgeAfter)*60;
    if(!cueDue(cycleSec,due))return false;
    return showNudge(cycleSec);
  }
  function dismissCue(options:CycleOptions={}){
    lastNudgeSec=Math.max(lastNudgeSec,currentCycleSeconds(options.activeSec));
    clearCue();
    if(TimerState.runtime&&TimerState.runtime.startMs!==null)writeSession();
    return true;
  }
  function stop(options:StopOptions={}){
    if(options.dismiss)return dismissCue(options);
    if(options.clear)clearCue({hide:options.hide});
    return true;
  }
  function acceptedBreak(options:CycleOptions&{dismissIfMissing?:boolean}={}){
    const cue=visibleCue();
    if(!cue){
      reconcileCue();
      if(options.dismissIfMissing)dismissCue();
      return false;
    }
    const cueIssuedAt=cue.issuedAt;
    lastNudgeSec=Math.max(lastNudgeSec,currentCycleSeconds(options.activeSec));
    clearCue();
    return freeze({plannedSeconds:breakSeconds(),cueIssuedAt});
  }
  function timerEvent<K extends keyof PomodoroPayloads>(type:K,payload?:PomodoroPayloads[NoInfer<K>]):PomodoroResults[K];
  function timerEvent(...[type,payload]:PomodoroArguments):PomodoroResults[keyof PomodoroResults]{
    if(type==='tick')return handleTick(payload);
    if(type==='reset-cycle'){resetCycle(payload?.anchorSec,payload);return true;}
    if(type==='restore-cycle'){restoreCycle(payload?.cycle,payload);return true;}
    if(type==='cycle-snapshot')return cycleSnapshot();
    if(type==='clear-cue'){clearCue(payload);return true;}
    if(type==='dismiss-cue')return dismissCue(payload);
    return false;
  }

  const configuration=Object.freeze({
    load:loadConfiguration,
    toggleNudges,
    updateFromUi,
    enabled:isEnabled,
    breakSeconds
  });
  return Object.freeze({configuration,stop,timerEvent,acceptedBreak});

  }
  return freeze({format:'study-director.pomodoro-module',contractVersion:1,createController});
};
registry.define('pomodoro',1,createModule);
return createModule;
})();
export type PomodoroModule=ReturnType<typeof sdPomodoroFactory>;
