(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject}=registry.contracts;
registry.define('timer-engine',2,()=>{
  const freeze=Object.freeze;
  const PORT_FIELDS=freeze({
    configuration:freeze(['APP_LIMITS','SLEEP_GAP_THRESHOLD_MS']),
    state:freeze(['TASKS','TIMER_MODES','TaskIdentity','TaskSessionState','TimerState','resetBreakState','setCurrentTask','setTimerMode']),
    domain:freeze(['KeyedRecord','boundedInt','clampText','cleanDayRevision','fmtOver','fmtS','makeTaskId','positiveMinutes','shortTaskLabel','studyMinuteToHHMM','taskAreaValue','taskMeasureValue','taskTargetValue']),
    schedule:freeze(['adjustedEndMin','adjustedStartMin','beginActualTask','effectiveNowMin','findNextIncompleteTrackableAfter','getLatestCarryForward','getScheduleDerivedState','handleStudyDayRollover','hasAdjustedTiming','isFixedBlock','isLiveTrackableTimer','isTaskResolved','isTrackableBlock','isWorkBlock','originalEndMin','originalStartMin','plannedRows','scheduleFingerprint','studyDayRolledOver']),
    persistence:freeze(['activePauseEventSnapshot','addPauseToActual','compactPauseEvents','compactRealTimeSnapshot','flushLiveDraft','maybeSnapshotRunningTimer','recoveryCaptureActiveBeforeSwitch','recoverySetStatus','reopenActualSessionForTimer','saveLiveDraft','saveNote','writeLiveDraftNow']),
    view:freeze(['cachedElements','clearExecuteStateOverlay','invalidateExecuteIdleDisplay','refreshPnote','refreshExecuteIdleDisplay','requestRender','setElementStyle','setElementText','setTextSafe','setExecuteControlsEnabled','setExecuteShellVisible','showDone','showEmpty','textEl','toggleDoneMarker']),
    reviewEvidence:freeze(['applicableNotesForTask','buildRealTimeSnapshot','exactTaskCompletionPercent','getReviewDate','liveTaskOutcome','recordCurrentActiveToTask','resolveTaskCompletion','setTaskDoneState','setTaskSkippedState','updateRealTimeAwareness','updateTimerFocusMetrics']),
    clock:freeze(['nowMs']),
    clockEnvironment:freeze(['cancelAnimationFrame','clearInterval','document','getComputedStyle','requestAnimationFrame','setInterval','setTimeout','window']),
    userPreferences:freeze(['Pomodoro','notifications']),
    ownership:freeze(['appCanMutate']),
    practice:freeze(['controller','model'])
  });
  function createEngine(input){
    exactObject(input,['ports'],'Timer engine input');
    const ports=exactObject(input.ports,Object.keys(PORT_FIELDS),'Timer engine ports');
    for(const [name,fields] of Object.entries(PORT_FIELDS))exactObject(ports[name],fields,'Timer engine '+name+' port');
    const {APP_LIMITS,SLEEP_GAP_THRESHOLD_MS}=ports.configuration;
    const {TASKS,TIMER_MODES,TaskIdentity,TaskSessionState,TimerState,resetBreakState,setCurrentTask,setTimerMode}=ports.state;
    const {KeyedRecord,boundedInt,clampText,cleanDayRevision,fmtOver,fmtS,makeTaskId,positiveMinutes,shortTaskLabel,studyMinuteToHHMM,taskAreaValue,taskMeasureValue,taskTargetValue}=ports.domain;
    const {adjustedEndMin,adjustedStartMin,beginActualTask,effectiveNowMin,findNextIncompleteTrackableAfter,getLatestCarryForward,getScheduleDerivedState,handleStudyDayRollover,hasAdjustedTiming,isFixedBlock,isLiveTrackableTimer,isTaskResolved,isTrackableBlock,isWorkBlock,originalEndMin,originalStartMin,plannedRows,scheduleFingerprint,studyDayRolledOver}=ports.schedule;
    const {activePauseEventSnapshot,addPauseToActual,compactPauseEvents,compactRealTimeSnapshot,flushLiveDraft,maybeSnapshotRunningTimer,recoveryCaptureActiveBeforeSwitch,recoverySetStatus,reopenActualSessionForTimer,saveLiveDraft,saveNote,writeLiveDraftNow}=ports.persistence;
    const {cachedElements,clearExecuteStateOverlay,invalidateExecuteIdleDisplay,refreshPnote,refreshExecuteIdleDisplay,requestRender,setElementStyle,setElementText,setTextSafe,setExecuteControlsEnabled,setExecuteShellVisible,showDone,showEmpty,textEl,toggleDoneMarker}=ports.view;
    const {applicableNotesForTask,buildRealTimeSnapshot,exactTaskCompletionPercent,getReviewDate,liveTaskOutcome,recordCurrentActiveToTask,resolveTaskCompletion,setTaskDoneState,setTaskSkippedState,updateRealTimeAwareness,updateTimerFocusMetrics}=ports.reviewEvidence;
    const {nowMs}=ports.clock;
    const {cancelAnimationFrame,clearInterval,document,getComputedStyle,requestAnimationFrame,setInterval,setTimeout,window}=ports.clockEnvironment;
    const {Pomodoro,notifications}=ports.userPreferences;
    let soundOperation=null,soundOccurrence=0;
    function clearSoundOperation(){if(soundOperation)soundOperation.resolve();soundOperation=null;}
    function soundEvent(cue,metadata={},fresh=false){
      if(fresh)clearSoundOperation();
      if(!soundOperation)soundOperation=notifications.begin({source:'timer',id:'execution',surface:'quiet',foreground:false});
      soundOperation.update({cue,occurrence:String(++soundOccurrence),system:false,title:'Study Director',message:'',...metadata});
    }

    const {appCanMutate}=ports.ownership;
    let tInt=null,remS=0,totS=0,overflowS=0,isOverflow=false;
const {controller:PracticePacer,model:PracticePacerModel}=ports.practice;
    if(!Object.isFrozen(PracticePacer)||!Object.isFrozen(PracticePacerModel)||PracticePacerModel.format!=='study-director.practice-pacer-model')throw new TypeError('Timer engine Practice Pacer port is unavailable or incompatible.');
    const {
      PRACTICE_CUE_DEFAULT,PRACTICE_PAUSE_CAUSES,formatPracticeMs,practicePaceBand,practicePaceBandLabel,
      sanitizePracticeCueMode,sanitizePracticeRun,sanitizePracticeRuns,sanitizePracticeState,
      summarizeCleanPracticeRuns,summarizePracticeRunsForInsights,validPracticeMs
    }=PracticePacerModel;
/* TIMER CLOCK, GAP RECOVERY, AND ACTUAL-TIME ACCOUNTING */
function currentTimerSnapshotDelta(){
  if(!TimerState.runtime||TimerState.runtime.startMs===null)return null;
  const idx=TimerState.runtime.taskIdx;
  if(idx===null||idx===undefined||!isTrackableBlock(TASKS[idx]))return null;
  const active=currentTimerActiveSeconds();
  return {idx,active,delta:Math.max(0,active-(TimerState.runtime.recordedSec||0))};
}
function actualTimeSnapshot(){
  const out=TaskSessionState.indexSnapshot('actualTime');
  const snap=currentTimerSnapshotDelta();
  if(snap&&snap.delta>0)out[snap.idx]=(Number(out[snap.idx])||0)+snap.delta;
  return out;
}
function pruneActualRecordAudit(record){
  if(!record||typeof record!=='object')return record;
  record.sessions=Array.isArray(record.sessions)?record.sessions.slice(-APP_LIMITS.maxLiveSessionsPerTask):[];
  record.sessions.forEach(session=>{session.pauseEvents=compactPauseEvents(session&&session.pauseEvents);});
  record.pauseEvents=compactPauseEvents(record.pauseEvents);
  record.sessionCount=Math.max(boundedInt(record.sessionCount,{min:0,max:1000000,fallback:0}),record.sessions.length);
  return record;
}
function actualRecordsSnapshot(options={}){
  const includeActivePause=options.includeActivePause!==false;
  const out={};
  const records=TaskSessionState.indexSnapshot('actualRecords');
  Object.keys(records).forEach(k=>{
    const r=records[k]||{};
    out[k]={
      idx:Number.isFinite(Number(r.idx))?Number(r.idx):Number(k),
      taskId:r.taskId||'',
      firstStartedAt:r.firstStartedAt||null,
      lastStartedAt:r.lastStartedAt||null,
      lastEndedAt:r.lastEndedAt||null,
      activeSeconds:Math.max(0,Math.round(Number(r.activeSeconds)||0)),
      pausedSeconds:Math.max(0,Math.round(Number(r.pausedSeconds)||0)),
      pauseCount:boundedInt(r.pauseCount,{min:0,max:1000,fallback:0}),
      status:r.status||'not_started',
      sessionCount:Math.max(boundedInt(r.sessionCount,{min:0,max:1000000,fallback:0}),(r.sessions||[]).length),
      sessions:(r.sessions||[]).slice(-APP_LIMITS.maxLiveSessionsPerTask).map(s=>({
        startedAt:s.startedAt||null,
        durationSec:Math.max(0,Math.round(Number(s.durationSec)||0)),
        endedAt:s.endedAt||null,
        activeSeconds:Math.max(0,Math.round(Number(s.activeSeconds)||0)),
        pausedSeconds:Math.max(0,Math.round(Number(s.pausedSeconds)||0)),
        pauseCount:boundedInt(s.pauseCount,{min:0,max:1000,fallback:0})
      })),
      pauseEvents:compactPauseEvents(r.pauseEvents)
    };
  });
  const snap=currentTimerSnapshotDelta();
  if(snap){
    const idx=String(snap.idx);
    const rec=out[idx]||(out[idx]={idx:snap.idx,taskId:TASKS[snap.idx]?.id||makeTaskId(TASKS[snap.idx]||{},snap.idx),firstStartedAt:null,lastStartedAt:null,lastEndedAt:null,activeSeconds:0,pausedSeconds:0,pauseCount:0,status:'in_progress',sessions:[],pauseEvents:[]});
    rec.activeSeconds=(Number(rec.activeSeconds)||0)+snap.delta;
    rec.status=TimerState.paused?'paused':'in_progress';
    rec.lastEndedAt=nowIso();
    const s=rec.sessions&&rec.sessions.length?rec.sessions[rec.sessions.length-1]:null;
    if(s&&!s.endedAt){s.endedAt=rec.lastEndedAt;s.activeSeconds=Math.max(0,snap.active);}
    const activePause=includeActivePause?activePauseEventSnapshot(snap.idx):null;
    if(activePause)rec.pauseEvents=compactPauseEvents(rec.pauseEvents,activePause);
  }
  return out;
}
function captureRuntimeEvidence({includeActivePause=true,withCompletion=true,includeRecords=false}={}){
  const actualTime=actualTimeSnapshot(),actualRecords=includeRecords?actualRecordsSnapshot({includeActivePause}):{},taskEvidence=KeyedRecord.create();
  if(withCompletion){
    TASKS.forEach((task,idx)=>{
      if(!isTrackableBlock(task))return;
      const taskId=TaskIdentity.idAt(idx);if(!taskId)return;
      const resolved=resolveTaskCompletion(idx,{actualSnapshot:actualTime});
      const pct=exactTaskCompletionPercent(idx,{actualSnapshot:actualTime,resolved});
      taskEvidence[taskId]={idx,task,resolved,pct,outcome:liveTaskOutcome(idx,{actualSnapshot:actualTime,resolved,exactPct:pct}),actualSeconds:Number(actualTime[idx])||0,clock:TaskSessionState.getField(idx,'actualClock')||{},record:actualRecords[idx]||{}};
    });
  }
  return {actualTime,actualRecords,taskEvidence};
}
function nowIso(){return new Date().toISOString();}
function initTimerState(idx,durationSec){
  const now=nowMs();
  TimerState.runtime={...TimerState.emptyRuntime(),taskIdx:idx,startMs:now,durationSec:Math.max(1,Math.round(durationSec||0)),lastTickMs:now};
  TimerState.inactiveGap=null;
}
function rebaseTimerAfterBackwardClockJump(now=nowMs()){
  if(!TimerState.runtime||TimerState.runtime.startMs===null)return 0;
  const last=Number(TimerState.runtime.lastTickMs);
  if(!Number.isFinite(last)||now>=last)return 0;
  const delta=now-last;
  TimerState.patchRuntime({startMs:Number(TimerState.runtime.startMs)+delta});
  if(TimerState.runtime.pausedStartedMs!==null&&TimerState.runtime.pausedStartedMs!==undefined&&Number.isFinite(Number(TimerState.runtime.pausedStartedMs)))TimerState.patchRuntime({pausedStartedMs:Number(TimerState.runtime.pausedStartedMs)+delta});
  if(TimerState.breakStartMs!==null&&TimerState.breakStartMs!==undefined&&Number.isFinite(Number(TimerState.breakStartMs)))TimerState.breakStartMs=Number(TimerState.breakStartMs)+delta;
  if(TimerState.activeBreak&&TimerState.activeBreak.startedAtMs!==null&&TimerState.activeBreak.startedAtMs!==undefined&&Number.isFinite(Number(TimerState.activeBreak.startedAtMs)))TimerState.patchActiveBreak({startedAtMs:Number(TimerState.activeBreak.startedAtMs)+delta});
  if(TimerState.inactiveGap){
    TimerState.patchInactiveGap({
      lastMs:Number.isFinite(Number(TimerState.inactiveGap.lastMs))?TimerState.inactiveGap.lastMs+delta:TimerState.inactiveGap.lastMs,
      detectedAtMs:Number.isFinite(Number(TimerState.inactiveGap.detectedAtMs))?TimerState.inactiveGap.detectedAtMs+delta:TimerState.inactiveGap.detectedAtMs
    });
  }
  PracticePacer.rebaseClock(delta);
  TimerState.patchRuntime({lastTickMs:now});
  return -delta;
}
function absorbInactiveTimerGap(source='tick'){
  if(!TimerState.runtime||TimerState.runtime.startMs===null)return 0;
  const now=nowMs();
  rebaseTimerAfterBackwardClockJump(now);
  const last=TimerState.runtime.lastTickMs;
  if(TimerState.paused||!last){TimerState.patchRuntime({lastTickMs:now});return 0;}
  const gapMs=now-last;
  if(TimerState.inactiveGap){
    if(gapMs>SLEEP_GAP_THRESHOLD_MS){
      const promptBeforeGap=Math.max(0,last-(TimerState.inactiveGap.detectedAtMs||last));
      TimerState.patchInactiveGap({
        promptMs:Math.max(0,TimerState.inactiveGap.promptMs||0)+promptBeforeGap,
        gapMs:Math.max(0,TimerState.inactiveGap.gapMs||0)+gapMs,
        detectedAtMs:now,
        secondaryGaps:(TimerState.inactiveGap.secondaryGaps||0)+1
      });
      saveLiveDraft();
    }
    TimerState.patchRuntime({lastTickMs:now});
    return 0;
  }
  TimerState.patchRuntime({lastTickMs:now});
  if(gapMs<=SLEEP_GAP_THRESHOLD_MS)return 0;
  openInactiveGapPrompt(TimerState.runtime.taskIdx,gapMs,last,now,source);
  saveLiveDraft();
  return gapMs;
}
function pendingInactiveGapMs(now=nowMs()){
  if(!TimerState.inactiveGap)return 0;
  return Math.max(0,TimerState.inactiveGap.gapMs||0)+Math.max(0,TimerState.inactiveGap.promptMs||0)+Math.max(0,now-(TimerState.inactiveGap.detectedAtMs||now));
}
function focusableOverlayElements(root){
  if(!root)return [];
  return Array.from(root.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')).filter(el=>{
    if(el.disabled||el.getAttribute('aria-hidden')==='true')return false;
    const style=getComputedStyle(el);
    return style.visibility!=='hidden'&&style.display!=='none'&&el.getClientRects().length>0;
  });
}
function activeModalOverlay(){
  return document.querySelector('#gap-overlay.on');
}
function focusFirstInOverlay(overlay){
  const first=focusableOverlayElements(overlay)[0];
  if(first)first.focus();
}
function handleOverlayFocusTrap(ev){
  if(ev.key!=='Tab')return;
  const overlay=activeModalOverlay();
  if(!overlay)return;
  const focusable=focusableOverlayElements(overlay);
  if(!focusable.length){ev.preventDefault();return;}
  const first=focusable[0];
  const last=focusable[focusable.length-1];
  if(!overlay.contains(document.activeElement)){
    ev.preventDefault();
    first.focus();
    return;
  }
  if(ev.shiftKey&&document.activeElement===first){
    ev.preventDefault();
    last.focus();
  } else if(!ev.shiftKey&&document.activeElement===last){
    ev.preventDefault();
    first.focus();
  }
}
// Away time can only count toward the running block while that block's study
// time lasted. A fixed block (or, for a work block, a support block) that began
// during the away time ends the countable part; time from there on is never
// added to the running block. The fixed block also stops the timer, as it would
// have with the app open.
function inactiveGapWindow(gap,now=nowMs()){
  const gapMs=Math.max(0,Number(gap&&gap.gapMs)||0),last=Number(gap&&gap.lastMs);
  const whole=Object.freeze({gapMs,countableMs:gapMs,limit:null,fixed:null});
  if(!Number.isFinite(last)||last<=0||last>now||!TimerState.runtime)return whole;
  const runningIdx=TimerState.runtime.taskIdx,running=TASKS[runningIdx],from=effectiveNowMin(new Date(last)),to=effectiveNowMin(new Date(now));
  if(to<from)return whole;
  const ends=row=>row.idx!==runningIdx&&(isFixedBlock(row.t)||isWorkBlock(running)&&isTrackableBlock(row.t)&&!isWorkBlock(row.t));
  const rows=plannedRows().filter(row=>ends(row)&&row.start<=to&&row.end>from).sort((a,b)=>a.start-b.start);
  if(!rows.length)return whole;
  const limit=rows[0],lastDate=new Date(last),intoMinute=lastDate.getSeconds()*1000+lastDate.getMilliseconds();
  const countableMs=Math.max(0,Math.min(gapMs,(limit.start-from)*60000-intoMinute));
  const fixed=rows.find(row=>isFixedBlock(row.t))||null;
  return Object.freeze({gapMs,countableMs,limit:{idx:limit.idx,task:limit.t,start:limit.start,end:limit.end},fixed:fixed?{idx:fixed.idx,task:fixed.t,start:fixed.start,end:fixed.end}:null});
}
function renderInactiveGapPrompt(){
  if(!TimerState.inactiveGap)return;
  clearSoundOperation();
  try{Pomodoro.stop({dismiss:true});}catch(e){}
  const task=TASKS[TimerState.inactiveGap.taskIdx]||{};
  const span=inactiveGapWindow(TimerState.inactiveGap),gapMs=span.gapMs;
  const ov=document.getElementById('gap-overlay');
  const msg=document.getElementById('gap-msg');
  const meta=document.getElementById('gap-meta');
  const split=document.getElementById('gap-split');
  const focusInput=document.getElementById('gap-focus-min');
  const limited=span.limit&&span.countableMs<gapMs,limitLabel=limited?shortTaskLabel(span.limit.task):'';
  if(msg)msg.textContent=limited
    ?`The timer was inactive. ${limitLabel} began while you were away, so only the ${fmtS(Math.round(span.countableMs/1000))} before it can count. How should that time be counted?`
    :'The timer was inactive. How should this gap be counted?';
  if(meta)meta.textContent=`Gap: ${fmtS(Math.round(gapMs/1000))}${task.name?' · '+task.name:''}${limited?` · countable: ${fmtS(Math.round(span.countableMs/1000))}`:''}`;
  if(split)split.classList.remove('on');
  if(focusInput){const countableMin=Math.max(0,Math.round(span.countableMs/60000));focusInput.value=countableMin;focusInput.max=String(countableMin);}
  if(ov){
    ov.classList.add('on');
    setTimeout(()=>focusFirstInOverlay(ov),0);
  }
  try{recoverySetStatus(`Timer paused for classification after ${fmtS(Math.round(gapMs/1000))} inactive gap.`,true);}catch(e){}
}
function openInactiveGapPrompt(taskIdx,gapMs,lastMs,detectedAtMs,source){
  if(TimerState.inactiveGap)return;
  TimerState.inactiveGap={id:`gap_${detectedAtMs}`,taskIdx,gapMs,lastMs,detectedAtMs,source};
  PracticePacer.onInactiveGapOpened(TimerState.inactiveGap);
  renderInactiveGapPrompt();
}
function closeInactiveGapPrompt(){
  const ov=document.getElementById('gap-overlay');
  if(ov)ov.classList.remove('on');
}
// A gap belongs to the running timer. When that timer stops for another reason
// (the day finished, the schedule was reset), its counted focus was already
// saved and the gap has nothing left to classify.
function discardInactiveGap(){
  if(!TimerState.inactiveGap)return false;
  TimerState.inactiveGap=null;closeInactiveGapPrompt();return true;
}
function showInactiveGapSplit(){
  const split=document.getElementById('gap-split');
  if(split)split.classList.add('on');
  const focusInput=document.getElementById('gap-focus-min');
  if(focusInput)focusInput.focus();
}
function applyInactiveGapSplit(){
  if(!TimerState.inactiveGap)return;
  const input=document.getElementById('gap-focus-min');
  const focusMin=Math.max(0,Number(input&&input.value)||0);
  classifyInactiveGap('split',focusMin*60000);
}
function handleInactiveGapSplitKey(e){
  if(e&&e.key==='Enter'){
    e.preventDefault();
    applyInactiveGapSplit();
  }
}
function classifyInactiveGap(mode,focusMs=null){
  const gap=TimerState.inactiveGap;
  if(!gap)return;
  // Every choice closes the dialog first, so an accounting problem can never
  // leave the app behind an unresponsive modal.
  discardInactiveGap();
  if(!TimerState.runtime||TimerState.runtime.startMs===null){
    saveLiveDraft();
    try{recoverySetStatus('The timer had already stopped; the inactive gap was not added to any block.',true);}catch(e){}
    return;
  }
  const now=nowMs(),span=inactiveGapWindow(gap,now);
  const countable=span.countableMs,excluded=Math.max(0,span.gapMs-countable);
  const promptMs=Math.max(0,gap.promptMs||0)+Math.max(0,now-(gap.detectedAtMs||now));
  let focusPart=0,breakPart=0,ignoredPart=0,label='Ignored';
  if(mode==='focus'){
    focusPart=countable; label='Focus';
  }else if(mode==='break'){
    breakPart=countable; label='Break';
  }else if(mode==='split'){
    focusPart=Math.min(countable,Math.max(0,Math.round(focusMs||0)));
    breakPart=Math.max(0,countable-focusPart);
    label=`Split: ${fmtS(Math.round(focusPart/1000))} focus, ${fmtS(Math.round(breakPart/1000))} break`;
  }else{
    ignoredPart=countable; label='Ignored';
  }
  TimerState.patchRuntime({
    totalPausedMs:(TimerState.runtime.totalPausedMs||0)+breakPart+ignoredPart+excluded+promptMs,
    sleepPausedMs:(TimerState.runtime.sleepPausedMs||0)+breakPart+ignoredPart+excluded,
    lastTickMs:now
  });
  if(breakPart>0){
    const countableEndMs=Number(gap.lastMs)>0?Number(gap.lastMs)+countable:(gap.detectedAtMs||now);
    addPauseToActual(gap.taskIdx,Math.round(breakPart/1000),{
      startedAt:new Date(Math.max(0,countableEndMs-breakPart)).toISOString(),
      endedAt:new Date(countableEndMs).toISOString(),
      type:'inactive-gap'
    });
  }
  const shouldResetNudgeCycle=mode==='break'||mode==='ignore'||breakPart>0;
  syncTimerFromClock();
  if(shouldResetNudgeCycle)Pomodoro.timerEvent('reset-cycle',{activeSec:currentTimerActiveSeconds()});
  const boundary=span.fixed||fixedBoundaryForRunningTimer();
  PracticePacer.resolveInactiveGap(focusPart,{resume:!boundary,now});
  if(boundary){stopTimerForFixedBoundary(boundary,{away:excluded>0});return;}
  updateCD();
  requestRender('schedule','realtime');
  saveLiveDraft();
  try{recoverySetStatus(`Classified inactive gap as ${label.toLowerCase()}${excluded>0?`; ${fmtS(Math.round(excluded/1000))} after ${shortTaskLabel(span.limit.task)} began was not counted`:''}.`,true);}catch(e){}
}
// A session stopped because another device claimed it holds its time at the
// moment it stopped: the handover takes that time, so neither the screen nor
// a record made meanwhile counts on past it. The hold belongs to the timer
// that was running, so a session taken in from the other device is not held.
let heldClock=null;
function holdClockAt(ms){
  const at=Number(ms);
  heldClock=Number.isFinite(at)&&TimerState.runtime&&TimerState.runtime.startMs!==null?{startMs:TimerState.runtime.startMs,atMs:at}:null;
  return !!heldClock;
}
function releaseHeldClock(){heldClock=null;return true;}
function activeEndMs(){
  if(TimerState.paused&&TimerState.runtime&&TimerState.runtime.pausedStartedMs)return TimerState.runtime.pausedStartedMs;
  if(heldClock&&TimerState.runtime&&TimerState.runtime.startMs===heldClock.startMs)return Math.min(nowMs(),heldClock.atMs);
  return nowMs();
}
function currentTimerActiveSeconds(){
  return currentTimerActiveSecondsAt(activeEndMs());
}
function currentTimerActiveMs(endMs=activeEndMs()){
  if(!TimerState.runtime||TimerState.runtime.startMs===null)return Math.max(0,(totS-remS+overflowS)*1000);
  return Math.max(0,endMs-TimerState.runtime.startMs-(TimerState.runtime.totalPausedMs||0)-pendingInactiveGapMs(endMs));
}
function currentTimerActiveSecondsAt(endMs){
  return Math.max(0,Math.floor(currentTimerActiveMs(endMs)/1000));
}
function activeSecondsForTimerStateAt(state,endMs){
  if(!state||state.startMs===null||state.startMs===undefined)return 0;
  const end=Number(endMs);
  const start=Number(state.startMs);
  if(!Number.isFinite(end)||!Number.isFinite(start)||end<=0||start<=0)return 0;
  const pausedTotal=Math.max(0,Number(state.totalPausedMs)||0);
  return Math.max(0,Math.floor((end-start-pausedTotal)/1000));
}
function restoredRuntimeRecordedSec(runtime,state){
  const saved=Math.max(0,Math.round(Number(state&&state.recordedSec)||0));
  if(!runtime||!state)return saved;
  const pausedRuntime=!!runtime.paused||runtime.mode===TIMER_MODES.PAUSED;
  const rawBreak=runtime.activeBreak&&typeof runtime.activeBreak==='object'?runtime.activeBreak:null;
  let endMs=Date.parse(runtime.updatedAt||'');
  if(pausedRuntime){
    const pauseAt=Number(state.pausedStartedMs)||Number(rawBreak&&rawBreak.startedAtMs)||endMs;
    if(Number.isFinite(pauseAt)&&pauseAt>0)endMs=pauseAt;
  }else if(Number.isFinite(endMs)){
    endMs=Math.min(endMs,nowMs());
  }
  if(!Number.isFinite(endMs)||endMs<=0)return saved;
  const activeAtSave=activeSecondsForTimerStateAt(state,endMs);
  const maxSec=APP_LIMITS.maxDurationMinutes*60;
  return Math.max(0,Math.min(maxSec,Math.max(saved,activeAtSave)));
}
function syncTimerFromClock(){
  if(!TimerState.runtime||TimerState.runtime.startMs===null||!TimerState.runtime.durationSec)return;
  const active=currentTimerActiveSeconds();
  totS=TimerState.runtime.durationSec;
  remS=Math.max(0,totS-active);
  overflowS=Math.max(0,active-totS);
  isOverflow=active>=totS;
}
function fixedBoundaryForRunningTimer(){
  if(TimerState.paused||!TimerState.runtime||TimerState.runtime.startMs===null||!(TimerState.currentIndex<TASKS.length)||!isTrackableBlock(TASKS[TimerState.currentIndex]))return null;
  const nowEff=effectiveNowMin();
  const row=plannedRows().find(r=>isFixedBlock(r.t)&&nowEff>=r.start&&nowEff<r.end);
  return row?{idx:row.idx,task:row.t,start:row.start,end:row.end}:null;
}
function stopTimerForFixedBoundary(boundary,options={}){
  clearSoundOperation();
  discardInactiveGap();
  const activeIdx=TimerState.currentIndex;
  recordCurrentActiveToTask(activeIdx,'partial');
  saveNote();
  if(tInt)clearInterval(tInt);
  TimerPresentation.stop();
  tInt=null;TimerState.paused=false;resetBreakState();Pomodoro.timerEvent('reset-cycle',{anchorSec:0,activeSec:0});TimerState.runtime=TimerState.emptyRuntime();
  setTimerMode(TIMER_MODES.READY,'fixed-boundary');
  const label=boundary&&boundary.task?shortTaskLabel(boundary.task):'fixed block';
  const away=options&&options.away===true;
  // Settle, or a device notification while the app is in the background. Not
  // when the person was away: they find the choice waiting when they return.
  if(!away)soundEvent('fixed-start',{system:true,title:'Fixed block started',message:`${label} has started. The timer stopped and counted focus was saved.`},true);
  showEmpty(away
    ?`Fixed block started while you were away: ${label}. Your choice was applied to the study time before it; time from the fixed block on was not counted.`
    :`Fixed block started: ${label}. Counted focus was saved; resume or shift the remaining study blocks when ready.`);
  refreshPnote({force:true});
  try{recoverySetStatus(away?`Timer stopped at fixed block ${label}, which began while you were away. Time from the fixed block on was not counted.`:`Timer paused because fixed block started: ${label}. Counted focus was saved.`,true);}catch(e){}
  flushLiveDraft();
}

/* TIMER COUNTDOWN EXECUTION */
function toggleDone(i){
  toggleDoneMarker(i);
  saveLiveDraft();requestRender('schedule','badges');
}
function jumpTo(i){
  if(!isTrackableBlock(TASKS[i])||isTaskResolved(i)){
    recoverySetStatus('Reopen the completed/skipped block before starting it again.',false);
    return false;
  }
  if(tInt)clearInterval(tInt);
  recoveryCaptureActiveBeforeSwitch();
  setCurrentTask(i);
  startCur();
  return true;
}
function nextTrackableIndexAfter(idx){return findNextIncompleteTrackableAfter(idx);}
function updateTimerNextLabels(idx=TimerState.currentIndex){
  const ni=nextTrackableIndexAfter(idx);
  const label=ni<TASKS.length?TASKS[ni].name:'';
  const unresolved=ni>=TASKS.length&&TASKS.some((t,i)=>isTrackableBlock(t)&&!isTaskResolved(i));
  setTextSafe('next-name',ni<TASKS.length?label:(unresolved?'No later unfinished block':'All done!'));
  setTextSafe('status-next','NEXT: '+(ni<TASKS.length?label.substring(0,20):'REVIEW'));
}
function setTimerIdentity(t,idx=TimerState.currentIndex){setTextSafe('task-name',t&&t.name||'—');setTextSafe('task-area-badge',t?taskAreaValue(t):'—');updateTimerNextLabels(idx);}
function preferredScrollBehavior(){
  return window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth';
}
function timerClockEls(){
  return cachedElements(timerClockEls,{cd:'cd',overflow:'cd-overflow',prog:'prog',pct:'prog-pct'});
}
function startCur(durationOverrideSec,options={}){
  if(!appCanMutate())return false;
  if(!TASKS.length){showEmpty();return;}
  let nextIdx=TimerState.currentIndex;
  while(nextIdx<TASKS.length&&!isTrackableBlock(TASKS[nextIdx]))nextIdx++;
  setCurrentTask(nextIdx);
  if(TimerState.currentIndex>=TASKS.length){
    const complete=TASKS.every((task,index)=>!isTrackableBlock(task)||isTaskResolved(index));
    showDone();if(options.cue)soundEvent(options.cue==='skip'?'skip':complete?'day-complete':'block-complete',{},true);return;
  }
  const continuing=TimerState.runtime?.startMs!=null||TASKS.some((task,index)=>isTrackableBlock(task)&&(isTaskResolved(index)||Number(TaskSessionState.getField(index,'actualTime'))>0));
  const startingCue=options.cue||(continuing?'next-block':'study-start');
  invalidateExecuteIdleDisplay();
  const t=TASKS[TimerState.currentIndex];
  const hasDurationOverride=durationOverrideSec!==undefined&&durationOverrideSec!==null;
  const durationSec=hasDurationOverride?Math.max(1,Math.round(Number(durationOverrideSec)||1)):Math.max(60,Math.round(t.dur*60));
  totS=durationSec;remS=durationSec;overflowS=0;isOverflow=false;TimerState.paused=false;
  initTimerState(TimerState.currentIndex,durationSec);
  setTimerMode(TIMER_MODES.RUNNING,'timer-start');
  beginActualTask(TimerState.currentIndex,durationSec);
  document.getElementById('overflow-wrap').style.display='none';
  setPausedUI(false);
  setTimerIdentity(t,TimerState.currentIndex);
  setExecuteShellVisible(true);
  setExecuteControlsEnabled(true);
  clearExecuteStateOverlay();
  refreshPnote();updateCD();
  requestRender('schedule','badges','realtime');
  TimerPresentation.start();
  if(tInt)clearInterval(tInt);
  tInt=setInterval(tick,1000);
  setTimeout(()=>{const a=document.querySelector('.si.active');if(a)a.scrollIntoView({behavior:preferredScrollBehavior(),block:'nearest'});},120);
  Pomodoro.timerEvent('reset-cycle',{activeSec:currentTimerActiveSeconds()});
  resetBreakState();
  writeLiveDraftNow();
  soundEvent(startingCue,{},true);
}
function tick(){
  const timerVisible=isExecutePaneVisible();
  if(TimerState.paused){
    const now=nowMs();
    rebaseTimerAfterBackwardClockJump(now);
    if(TimerState.runtime)TimerState.patchRuntime({lastTickMs:now});
    if(timerVisible)updateBreakMeter();else notifyPomodoroBreakDone(getCurrentBreakSeconds());
    return;
  }
  absorbInactiveTimerGap('tick');
  if(TimerState.inactiveGap||!TimerState.runtime||TimerState.runtime.startMs===null)return;
  const boundary=fixedBoundaryForRunningTimer();
  if(boundary){stopTimerForFixedBoundary(boundary);return;}
  const wasOverflow=isOverflow;
  syncTimerFromClock();
  if(isOverflow&&!wasOverflow&&!TimerState.runtime.overtimeNotified){
    TimerState.patchRuntime({overtimeNotified:true});
    if(timerVisible)setElementStyle(document.getElementById('overflow-wrap'),'display','block');
    soundEvent('overtime',{system:true,title:'Study block time is up',message:'Running overtime now. Open Study Director for details.'});
  }
  if(timerVisible){updateCD({sync:false});PracticePacer.paint();}
  else PracticePacer.pulse();
  Pomodoro.timerEvent('tick',{activeSec:currentTimerActiveSeconds()});
  maybeSnapshotRunningTimer();
}
function syncTimerAfterWake(){
  try{
    rebaseTimerAfterBackwardClockJump(nowMs());
    if(studyDayRolledOver()){handleStudyDayRollover();return true;}
    if(TimerState.runtime&&TimerState.runtime.startMs!==null&&!TimerState.paused){tick();TimerPresentation.start();return false;}
    if(TimerState.runtime)TimerState.patchRuntime({lastTickMs:nowMs()});
    if(TimerState.paused)updateBreakMeter();
    updateCD();
    updateRealTimeAwareness();
    refreshExecuteIdleDisplay();
    return false;
  }catch(e){return false;}
}
function updateCD(options={}){
  if(options.sync!==false)syncTimerFromClock();
  paintTimerCountdown();
  if(options.metrics!==false)updateTimerFocusMetrics();
}
function timerCountdownClass(){
  const classes=[];
  if(isOverflow)classes.push('urg');
  else if(totS){
    const r=remS/totS;
    if(r<0.1)classes.push('urg');else if(r<0.25)classes.push('warn');
  }
  if(TimerState.paused)classes.push('paused');
  return classes.join(' ');
}
function timerVisualPercent(){
  const activeMs=(TimerState.runtime&&TimerState.runtime.startMs!==null&&TimerState.runtime.durationSec)?currentTimerActiveMs():Math.max(0,totS-remS+overflowS)*1000;
  return totS?Math.min(100,Math.max(0,(activeMs/(totS*1000))*100)):0;
}
function paintTimerText(visualPct=timerVisualPercent()){
  const els=timerClockEls(),el=els.cd;if(!el)return;
  setElementText(el,fmtS(remS));
  const className=timerCountdownClass();if(el.className!==className)el.className=className;
  if(isOverflow)setElementText(els.overflow,fmtOver(overflowS));
  setElementText(els.pct,isOverflow?'OVERTIME':Math.round(visualPct)+'%');
}
function paintTimerProgress(visualPct=timerVisualPercent()){
  const prog=timerClockEls().prog,width=visualPct.toFixed(3)+'%';
  if(prog&&prog.style.width!==width)prog.style.width=width;
}
function paintTimerCountdown(){
  const visualPct=timerVisualPercent();paintTimerText(visualPct);paintTimerProgress(visualPct);
  setElementStyle(document.getElementById('overflow-wrap'),'display',isOverflow?'block':'none');
}
function isExecutePaneVisible(){return !document.hidden&&!!document.getElementById('pane-execute')?.classList.contains('on');}
const TimerPresentation=(()=>{
  let frame=0;
  function continuousMotionAllowed(){
    return !(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function canAnimate(){
    return continuousMotionAllowed()&&isLiveTrackableTimer()&&!TimerState.paused&&isExecutePaneVisible();
  }
  function step(){
    frame=0;
    if(!canAnimate())return;
    paintTimerProgress();
    PracticePacer.paintProgress(nowMs());
  }
  function start(){
    if(frame||!canAnimate())return false;
    // The one-second timer tick already advances progress and CSS interpolates
    // between ticks. A permanent display-rate RAF loop wastes CPU/GPU energy.
    frame=requestAnimationFrame(step);
    return true;
  }
  function stop(){
    if(frame)cancelAnimationFrame(frame);
    frame=0;
  }
  return Object.freeze({start,stop,status:()=>Object.freeze({active:frame!==0})});
})();
function beginTimerPause(type='manual',meta={}){
  if(TimerState.mode!==TIMER_MODES.RUNNING||TimerState.paused)return false;
  const now=nowMs();
  const breakType=type==='pomodoro'?'pomodoro':'manual';
  Pomodoro.timerEvent('clear-cue');
  TimerState.paused=true;
  PracticePacer.pauseFromMain(PRACTICE_PAUSE_CAUSES.MAIN,now);
  TimerPresentation.stop();
  TimerState.breakStartMs=now;
  TimerState.currentBreakSec=0;
  TimerState.activeBreak={
    type:breakType,
    taskIdx:TimerState.currentIndex,
    startedAtMs:now,
    plannedSeconds:breakType==='pomodoro'?Math.max(60,Math.round(Number(meta.plannedSeconds)||Pomodoro.configuration.breakSeconds())):0,
    cueIssuedAt:meta.cueIssuedAt||null,
    doneNotified:false
  };
  if(TimerState.runtime)TimerState.patchRuntime({pausedStartedMs:now,lastTickMs:now});
  Pomodoro.timerEvent('reset-cycle',{anchorSec:null,activeSec:currentTimerActiveSeconds(),hide:false});
  setTimerMode(TIMER_MODES.PAUSED,'timer-pause');
  setPausedUI(true);
  updateBreakMeter();
  updateCD();
  writeLiveDraftNow();
  soundEvent('pause');
  return true;
}
function finalizePauseEvent(){
  if(!TimerState.paused)return 0;
  const pauseEndedMs=nowMs();
  rebaseTimerAfterBackwardClockJump(pauseEndedMs);
  const pausedSec=getCurrentBreakSeconds();
  const pauseStartedMs=TimerState.runtime&&TimerState.runtime.pausedStartedMs?TimerState.runtime.pausedStartedMs:(TimerState.activeBreak&&TimerState.activeBreak.startedAtMs)||pauseEndedMs-(pausedSec*1000);
  if(TimerState.runtime&&TimerState.runtime.pausedStartedMs){
    TimerState.patchRuntime({totalPausedMs:TimerState.runtime.totalPausedMs+(pauseEndedMs-TimerState.runtime.pausedStartedMs),pausedStartedMs:null});
  }
  if(TimerState.runtime)TimerState.patchRuntime({lastTickMs:pauseEndedMs});
  const meta={
    startedAt:new Date(pauseStartedMs).toISOString(),
    endedAt:new Date(pauseEndedMs).toISOString(),
    type:TimerState.activeBreak&&TimerState.activeBreak.type==='pomodoro'?'pomodoro':'manual'
  };
  if(TimerState.activeBreak&&TimerState.activeBreak.type==='pomodoro'){
    meta.plannedSeconds=TimerState.activeBreak.plannedSeconds;
    if(TimerState.activeBreak.cueIssuedAt)meta.cueIssuedAt=TimerState.activeBreak.cueIssuedAt;
  }
  addPauseToActual(TimerState.currentIndex,pausedSec,meta);
  resetBreakState(false);
  return pausedSec;
}
function resumeTimerFromPause(){
  if(!appCanMutate())return false;
  if(TimerState.mode!==TIMER_MODES.PAUSED||!TimerState.paused)return false;
  finalizePauseEvent();
  TimerState.paused=false;
  setTimerMode(TIMER_MODES.RUNNING,'timer-resume');
  PracticePacer.resumeFromMain(nowMs());
  reopenActualSessionForTimer(TimerState.currentIndex,TimerState.runtime&&TimerState.runtime.durationSec?TimerState.runtime.durationSec:totS,'in_progress');
  Pomodoro.timerEvent('reset-cycle',{activeSec:currentTimerActiveSeconds()});
  setPausedUI(false);
  updateBreakMeter();
  updateCD();
  TimerPresentation.start();
  writeLiveDraftNow();
  soundEvent('resume');
  return true;
}
function togglePause(){
  if(TimerState.mode===TIMER_MODES.RUNNING){
    const request=Pomodoro.acceptedBreak({activeSec:currentTimerActiveSeconds()});
    if(request){beginTimerPause('pomodoro',request);return;}
    beginTimerPause('manual');
    return;
  }
  if(TimerState.mode===TIMER_MODES.PAUSED){resumeTimerFromPause();}
}
function getCurrentBreakSeconds(){
  if(TimerState.paused&&TimerState.breakStartMs){
    return TimerState.currentBreakSec+Math.max(0,Math.floor((nowMs()-TimerState.breakStartMs)/1000));
  }
  return TimerState.currentBreakSec;
}
function notifyPomodoroBreakDone(elapsed){
  if(!TimerState.activeBreak||TimerState.activeBreak.type!=='pomodoro'||!TimerState.activeBreak.plannedSeconds||TimerState.activeBreak.doneNotified||elapsed<TimerState.activeBreak.plannedSeconds)return;
  TimerState.patchActiveBreak({doneNotified:true});
  soundEvent('break-complete',{system:true,title:'Pomodoro break complete',message:'Resume focus when ready.'});
  saveLiveDraft();
}
function breakMeterElements(){return cachedElements(breakMeterElements,{box:'break-meter',value:'break-elapsed',label:'break-label',note:'break-note'});}
function updateBreakMeter(){
  const els=breakMeterElements();
  if(!els.box||!els.value)return;
  const elapsed=getCurrentBreakSeconds();
  setElementText(els.value,fmtS(elapsed));
  els.box.classList.toggle('on',!!TimerState.paused);
  const label=els.label;
  const note=els.note;
  if(TimerState.activeBreak&&TimerState.activeBreak.type==='pomodoro'){
    const planned=Math.max(1,TimerState.activeBreak.plannedSeconds||0);
    const remaining=Math.max(0,planned-elapsed);
    const over=Math.max(0,elapsed-planned);
    setElementText(label,'Pomodoro break');
    setElementText(note,over?`Break complete · over by ${fmtS(over)}`:remaining?`resume in ${fmtS(remaining)}`:'Break complete. Resume when ready.');
    notifyPomodoroBreakDone(elapsed);
  }else{
    setElementText(label,'Break elapsed');
    setElementText(note,'not counted as focus time');
  }
}
function setPausedUI(p){
  const cd=document.getElementById('cd');
  const card=document.getElementById('cd-card');
  const hint=document.getElementById('cd-hint');
  const mode=document.getElementById('cd-mode');
  if(p){
    if(cd)cd.classList.add('paused');
    if(card)card.classList.add('paused');
    if(hint){hint.textContent='paused';hint.classList.add('ph');}
    const dot=textEl('div','dot');
    if(mode){mode.className='cd-mode ui-label paused-mode';mode.replaceChildren(dot,document.createTextNode('PAUSED'));}
  } else {
    if(cd)cd.classList.remove('paused');
    if(card)card.classList.remove('paused');
    if(hint){hint.textContent='tap timer to pause or resume';hint.classList.remove('ph');}
    if(mode){mode.className='cd-mode ui-label';mode.replaceChildren(textEl('div','dot'),document.createTextNode('RUNNING'));}
  }
}
function finishTrackableBlock(skipped){
  if(!isTrackableBlock(TASKS[TimerState.currentIndex])){return;}
  if(TimerState.paused){finalizePauseEvent();TimerState.paused=false;setPausedUI(false);}
  const finishedIdx=TimerState.currentIndex;
  recordCurrentActiveToTask(finishedIdx,skipped?'skipped':'completed');
  if(skipped){
    setTaskSkippedState(finishedIdx);
  }else{
    setTaskDoneState(finishedIdx);
  }
  PracticePacer.onBlockResolved(TaskIdentity.idAt(finishedIdx));
  saveNote();saveLiveDraft();
  const nextIdx=findNextIncompleteTrackableAfter(finishedIdx);
  setCurrentTask(nextIdx);
  startCur(undefined,{cue:skipped?'skip':'block-complete'});
}
function markDone(){finishTrackableBlock(false);}
function skipTask(){finishTrackableBlock(true);}

const SessionEvidenceProjector=(()=>{
  function cloneFrozen(value){
    if(value===null||value===undefined||typeof value!=='object')return value;
    if(Array.isArray(value))return Object.freeze(value.map(cloneFrozen));
    const out={};
    Object.entries(value).forEach(([key,item])=>{out[key]=cloneFrozen(item);});
    return Object.freeze(out);
  }
  function snapshot(options={}){
    const includeRecords=options.includeRecords!==false;
    const evidence=options.evidence||captureRuntimeEvidence({includeRecords});
    const sourceRows=TimerState.originalSchedule.length===TASKS.length?TimerState.originalSchedule:TASKS.map((task,idx)=>({...task,idx}));
    const reviewTasks=TASKS.map((task,idx)=>{
      const id=String(task.id||TaskIdentity.idAt(idx));
      const row=evidence.taskEvidence[id]||{};
      const resolved=row.resolved||resolveTaskCompletion(idx,{actualSnapshot:evidence.actualTime});
      const completion=row.pct??exactTaskCompletionPercent(idx,{actualSnapshot:evidence.actualTime,resolved});
      const progress=TaskSessionState.getField(idx,'notes')||{};
      const clock=row.clock||TaskSessionState.getField(idx,'actualClock')||{};
      const actualRecord=TaskSessionState.getField(idx,'actualRecords')||{};
      const original=sourceRows[idx]||task;
      return cloneFrozen({
        idx,i:idx,id,name:String(original.name||task.name||''),kind:String(original.kind||task.kind||'work'),
        area:taskAreaValue(task),measure:taskMeasureValue(task,''),target:taskTargetValue(task),
        duration:positiveMinutes(original.duration??original.dur??task.dur),
        dur:positiveMinutes(original.duration??original.dur??task.dur),
        originalStart:String(original.start||studyMinuteToHHMM(originalStartMin(idx))),
        originalStartMin:originalStartMin(idx),originalEndMin:originalEndMin(idx),
        adjustedStart:studyMinuteToHHMM(adjustedStartMin(idx)),
        adjustedStartMin:adjustedStartMin(idx),adjustedEndMin:adjustedEndMin(idx),
        shifted:hasAdjustedTiming(idx),trackable:isTrackableBlock(task),work:isWorkBlock(task),
        completion,completionSource:resolved.source,
        outcome:row.outcome||liveTaskOutcome(idx,{actualSnapshot:evidence.actualTime,resolved,exactPct:completion}),
        resolvedState:TaskSessionState.resolvedState(idx)||'',
        progress,actualSeconds:evidence.actualTime[idx]??null,clock,actualRecord,
        note:applicableNotesForTask(task)
      });
    });
    const practice=PracticePacer.snapshot();
    const localDate=getReviewDate();
  return cloneFrozen({
      format:'study-director.review-evidence',version:1,date:localDate,
      schedule:scheduleFingerprint(),adjustmentsRevision:getScheduleDerivedState().adjustmentsRevision,
      contentRevision:cleanDayRevision(TimerState.contentRevision),savedRevision:cleanDayRevision(TimerState.savedRevision),
      currentTaskIndex:TimerState.currentIndex,currentTaskId:TaskIdentity.idAt(TimerState.currentIndex),timerMode:TimerState.mode,paused:!!TimerState.paused,pendingGap:!!TimerState.inactiveGap,
      actualTime:evidence.actualTime,taskEvidence:evidence.taskEvidence,reviewTasks,
      practice,practiceRuns:PracticePacer.completedRuns(),practiceActive:!!PracticePacer.status().active,
      quote:clampText((document.getElementById('quote-input')?.value||'').trim(),APP_LIMITS.maxQuoteChars),
      realTimeSnapshot:includeRecords?compactRealTimeSnapshot(buildRealTimeSnapshot()):null,
      carryForward:clampText(getLatestCarryForward()||'',APP_LIMITS.maxCarryForwardChars)
    });
  }
  return Object.freeze({
    format:'study-director.session-evidence-projector',contractVersion:1,snapshot
  });
})();

    const SessionEvidenceGateway=TimerState.createEvidenceGateway(SessionEvidenceProjector.snapshot);
    function stopExecution(){
  clearSoundOperation();
      if(tInt){clearInterval(tInt);tInt=null;}
      TimerPresentation.stop();
      return true;
    }
    function resetCountdownRuntime(){
      stopExecution();discardInactiveGap();
      TimerState.paused=false;remS=0;totS=0;overflowS=0;isOverflow=false;
      TimerState.runtime=TimerState.emptyRuntime();
      resetBreakState(false);
      return true;
    }
    function setCountdownDuration(seconds){
      totS=Math.max(0,Math.round(Number(seconds)||0));
      remS=Math.min(Math.max(0,remS),totS);
      return status();
    }
    function resetToReady(reason='runtime-reset'){
      stopExecution();discardInactiveGap();
      TimerState.paused=false;remS=0;totS=0;overflowS=0;isOverflow=false;
      TimerState.runtime=TimerState.emptyRuntime();
      setTimerMode(TIMER_MODES.READY,reason);
      return true;
    }
    function resumeAfterPrimaryRestore({frozenSinceMs=null}={}){
      if(!appCanMutate())return false;
      // Ownership stayed here: the time since the stop was study time.
      releaseHeldClock();
      if(TimerState.runtime&&TimerState.runtime.startMs!==null&&TimerState.currentIndex<TASKS.length&&isTrackableBlock(TASKS[TimerState.currentIndex])&&[TIMER_MODES.RUNNING,TIMER_MODES.PAUSED].includes(TimerState.mode)){
        // A restore that kept the session running paused only the display. If
        // the timer was ticking when it froze, that time is study time, not an
        // away gap; an older gap (the page was closed) is still asked about.
        const lastTickMs=Number(TimerState.runtime.lastTickMs);
        if(typeof frozenSinceMs==='number'&&Number.isFinite(frozenSinceMs)&&Number.isFinite(lastTickMs)&&lastTickMs>0&&frozenSinceMs-lastTickMs<=SLEEP_GAP_THRESHOLD_MS)TimerState.patchRuntime({lastTickMs:nowMs()});
        if(!tInt)tInt=setInterval(tick,1000);
        syncTimerAfterWake();
        if(TimerState.mode===TIMER_MODES.RUNNING&&!TimerState.paused)TimerPresentation.start();
        if(TimerState.paused&&isExecutePaneVisible())updateBreakMeter();
        return true;
      }
      return false;
    }
    function resumeRestoredPaused(restoredBreak){
      TimerState.paused=true;
      TimerState.breakStartMs=restoredBreak.startedAtMs;
      TimerState.currentBreakSec=0;
      TimerState.activeBreak=restoredBreak.activeBreak;
      TimerState.patchRuntime({pausedStartedMs:restoredBreak.startedAtMs,lastTickMs:restoredBreak.now});
      if(restoredBreak.overrunCapped){
        try{recoverySetStatus('Restored Pomodoro break with stale overrun capped after browser/system interruption.',true);}catch(e){}
      }
      setTimerMode(TIMER_MODES.PAUSED,'restore-paused');
      setPausedUI(true);updateBreakMeter();updateCD();
      if(tInt)clearInterval(tInt);
      tInt=setInterval(tick,1000);
      return true;
    }
    function resumeRestoredRunning(){
      TimerState.paused=false;resetBreakState(false);
      if(TimerState.runtime)TimerState.patchRuntime({pausedStartedMs:null});
      setTimerMode(TIMER_MODES.RUNNING,'restore-running');
      setPausedUI(false);syncTimerFromClock();updateCD();TimerPresentation.start();
      if(tInt)clearInterval(tInt);
      tInt=setInterval(tick,1000);tick();
      if(TimerState.inactiveGap)renderInactiveGapPrompt();
      return true;
    }
    function status(){
      return freeze({
        format:'study-director.timer-engine-status',contractVersion:2,
        loopActive:tInt!==null,totalSec:totS,remainingSec:remS,overflowSec:overflowS,
        overflow:isOverflow,presentationActive:TimerPresentation.status().active
      });
    }
    const presentation=freeze({start:TimerPresentation.start,stop:TimerPresentation.stop,status:TimerPresentation.status});
    return freeze({
      format:'study-director.timer-engine',contractVersion:2,
      practice:PracticePacer,evidenceGateway:SessionEvidenceGateway,presentation,status,
      stopExecution,holdClockAt,releaseHeldClock,resetCountdownRuntime,setCountdownDuration,resetToReady,resumeAfterPrimaryRestore,
      resumeRestoredPaused,resumeRestoredRunning,
      PRACTICE_CUE_DEFAULT,PRACTICE_PAUSE_CAUSES,formatPracticeMs,practicePaceBandLabel,
      sanitizePracticeCueMode,sanitizePracticeRun,sanitizePracticeRuns,sanitizePracticeState,
      summarizeCleanPracticeRuns,summarizePracticeRunsForInsights,validPracticeMs,
      absorbInactiveTimerGap,actualRecordsSnapshot,actualTimeSnapshot,applyInactiveGapSplit,
      captureRuntimeEvidence,classifyInactiveGap,currentTimerActiveMs,currentTimerActiveSeconds,
      fixedBoundaryForRunningTimer,handleInactiveGapSplitKey,handleOverlayFocusTrap,initTimerState,
      nowIso,pruneActualRecordAudit,rebaseTimerAfterBackwardClockJump,renderInactiveGapPrompt,
      restoredRuntimeRecordedSec,showInactiveGapSplit,stopTimerForFixedBoundary,syncTimerFromClock,
      beginTimerPause,finalizePauseEvent,getCurrentBreakSeconds,isExecutePaneVisible,jumpTo,markDone,
      setPausedUI,setTimerIdentity,skipTask,startCur,syncTimerAfterWake,tick,toggleDone,togglePause,
      updateBreakMeter,updateCD
    });
  }
  return freeze({format:'study-director.timer-engine-module',contractVersion:2,createEngine});
});
})();
