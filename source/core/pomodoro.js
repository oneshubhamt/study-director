(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject}=registry.contracts;
registry.define('pomodoro',1,()=>{
  const freeze=Object.freeze;
  const PORT_FIELDS=freeze({
    state:freeze(['TASKS','TIMER_MODES','TimerState']),
    schedule:freeze(['isPomodoroEligibleBlock']),
    persistence:freeze(['canMutate','readConfiguration','writeConfiguration','writeSession']),
    view:freeze(['document','notifications','updateExecutePanels']),
    environment:freeze(['nowIso'])
  });
  function createController(input){
    exactObject(input,['ports'],'Pomodoro input');
    const ports=exactObject(input.ports,Object.keys(PORT_FIELDS),'Pomodoro ports');
    for(const [name,fields] of Object.entries(PORT_FIELDS))exactObject(ports[name],fields,'Pomodoro '+name+' port');
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
  let nudgeConfigurationState=null;
  let lastNudgeSec=0;
  let cycleStartSec=0;
  let pomodoroCue=null;
  let reminderDelivery=null;
  let lastActiveSec=0;

  function sanitizeConfig(raw=null){
    const src=raw&&typeof raw==='object'?raw:{};
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
    const nf=document.getElementById('ns-nudge-after');if(nf)nf.value=current.nudgeAfter;
    const nb=document.getElementById('ns-break');if(nb)nb.value=current.breakMinutes;
    updateExecutePanels();
  }
  function persistConfiguration(){
    if(!canMutate()||!nudgeConfigurationState)return;
    writeConfiguration(nudgeConfigurationState);
  }
  function loadConfiguration(){
    try{nudgeConfigurationState=sanitizeConfig(readConfiguration());}
    catch(e){nudgeConfigurationState=sanitizeConfig();}
    const nf=document.getElementById('ns-nudge-after');if(nf)nf.value=nudgeConfigurationState.nudgeAfter;
    const nb=document.getElementById('ns-break');if(nb)nb.value=nudgeConfigurationState.breakMinutes;
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
    for(const [key,id,max] of [['nudgeAfter','ns-nudge-after',240],['breakMinutes','ns-break',60]]){
      const field=document.getElementById(id),value=Number(field?.value);
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

  function readActiveSeconds(value){
    const active=Number(value);
    if(Number.isFinite(active))lastActiveSec=Math.max(0,Math.floor(active));
    else if(!TimerState.runtime||TimerState.runtime.startMs===null)lastActiveSec=0;
    return lastActiveSec;
  }
  function normalizeCycle(activeSec){
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
  function currentCycleSeconds(activeSec){
    if(!TimerState.runtime||TimerState.runtime.startMs===null)return 0;
    return normalizeCycle(activeSec);
  }
  function resetCycle(anchorSec=null,options={}){
    const active=Number.isFinite(anchorSec)?anchorSec:(TimerState.runtime&&TimerState.runtime.startMs!==null?readActiveSeconds(options.activeSec):0);
    cycleStartSec=Math.max(0,Math.floor(active||0));
    lastNudgeSec=0;
    pomodoroCue=null;
    if(reminderDelivery){reminderDelivery.resolve();reminderDelivery=null;}
    if(options.hide!==false)hideOverlay();
  }
  function restoreCycle(cycle,options={}){
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
  function clearCue(options={}){
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
  function cueDue(cycleSec,dueSec){
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
  function handleTick(payload={}){
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
  function dismissCue(options={}){
    lastNudgeSec=Math.max(lastNudgeSec,currentCycleSeconds(options.activeSec));
    clearCue();
    if(TimerState.runtime&&TimerState.runtime.startMs!==null)writeSession();
    return true;
  }
  function stop(options={}){
    if(options.dismiss)return dismissCue(options);
    if(options.clear)clearCue({hide:options.hide});
    return true;
  }
  function acceptedBreak(options={}){
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
  function timerEvent(type,payload={}){
    if(type==='tick')return handleTick(payload);
    if(type==='reset-cycle'){resetCycle(payload.anchorSec,payload);return true;}
    if(type==='restore-cycle'){restoreCycle(payload.cycle,payload);return true;}
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
});
})();
