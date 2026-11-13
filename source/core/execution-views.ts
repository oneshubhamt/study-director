import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {RealTimeScheduleState} from '../../types/execution-host.ts';
import type {ExecutionViewInput,ExecuteIdleOptions,TimerFocusMetrics,RecoveryShiftPlan,RecoveryCarryItem} from '../../types/execution-views.ts';
const sdExecutionViewsFactory=(()=>{
'use strict';
const registry=(globalThis as unknown as Record<symbol,unknown>)[Symbol.for('studyDirector.internalModules.v1')] as ModuleRegistration<'execution-views','study-director.execution-views-module'>|undefined;
if(!registry||registry.version!==1)throw new Error('Study Director internal module registry is unavailable.');
function createController(ports:Readonly<ExecutionViewInput>){
 const {state,cache,document,window,APP_LIMITS,STUDY_DAY_MINUTES,setInterval,SESSION_WATCH_MS,SESSION_CLAIM_WATCH_MS}=ports;
 const elementCaches={badges:{},realtime:{},metrics:{}};
 let sessionWatchTimer:number|null=null,sessionClaimWatchTimer:number|null=null;
 const {TASKS,TimerState,TIMER_MODES,TaskIdentity,TaskSessionState,PracticePacer,TimerEngine,SessionEvidenceGateway,setTimerMode,isTaskResolved,getRealTimeState,scheduleWindowLabel,effectiveNowMin,plannedRows,remainingWindowSeconds,setCurrentTask,latestTrackableEndMin,resetBreakState,nextIncompleteTrackableFrom,isInsideAdjustedWindow,fixedAnchorRowsFrom,avoidFixedAnchorOverlap,adjustedEndMin}=ports.runtime;
 const {PRACTICE_PAUSE_CAUSES,markDone:markDoneTimer,skipTask:skipTaskTimer,togglePause:togglePauseTimer,setPausedUI,startCur,recoveryCaptureActiveBeforeSwitch}=TimerEngine;
 const {sessionDevice,sessionUpdateTime,sessionFromElsewhere,sessionProgressSummary}=ports.actions;
 const {isTrackableBlock,isWorkBlock,isFixedBlock,isSupportBlock,shortTaskLabel,clockHMS,setElementText,textEl,requestRender,appCanMutate,fmtS,studyMinuteToHHMM,invalidateScheduleDerived,clearFutureUntouchedProgress,getTaskCompletion,taskTargetValue,applicableNotesForTask,taskMeasureValue,taskAreaValue,clampText,renderReviewUnfinishedNote,copyTextToClipboard,setTextSafe,studyDayRolledOver,todayISO,scheduleFingerprint,promptSaveToday,refreshCoreUi,saveLiveDraft,flushLiveDraft,refreshSessionSafetyUi,calculateReviewMetrics,durationLabel,cachedElements,notifyBackupChange,schedulePwaUpdateEvaluation,wakeSessionOwnershipClaim}=ports;
function updateExecutePanels(state:RealTimeScheduleState|null=null,options:{force?:boolean}={}){
  updateExecuteSessionStatus();
  let recoveryState='',key='';
  try{
    const s=state||getRealTimeState();
    if(TASKS.length){
      recoveryState=s.driftKind==='behind'||s.driftKind==='mismatch'?'warn':s.match?'ok':s.driftKind==='ahead'?'info':'';
      key=[TimerState.mode,recoveryState,TASKS.length,TimerState.currentIndex,TaskSessionState.resolvedIndices('done').length,TaskSessionState.resolvedIndices('skipped').length].join('|');
      if(!options.force&&key===cache.executePanelsRenderKey)return;
      cache.executePanelsRenderKey=key;
      const panel=document.getElementById('rt-actions');
      if(panel)panel.classList.toggle('recommended',recoveryState==='warn');
    }else{
      key=[TimerState.mode,'empty',0].join('|');
      if(!options.force&&key===cache.executePanelsRenderKey)return;
      cache.executePanelsRenderKey=key;
      const panel=document.getElementById('rt-actions');
      if(panel)panel.classList.remove('recommended');
    }
  }catch(e){}
}
function sessionShownElsewhere(){return state.sessionPanelMode==='elsewhere'&&!TASKS.length?state.sessionPanelSession:null;}
function sessionParkedHere(){return state.sessionPanelMode==='suspended'&&!TASKS.some(isTrackableBlock);}
function executeSessionStatusModel(){
  const elsewhere=sessionShownElsewhere();
  if(state.sessionPanelMode==='previous')return {state:'suspended',label:'PREVIOUS DAY'};
  if(elsewhere)return {state:'elsewhere',label:`RUNNING ${sessionDevice(elsewhere).toUpperCase()}`};
  if(sessionParkedHere())return {state:'suspended',label:'SUSPENDED'};
  if(!TASKS.length)return {state:'empty',label:'NO SESSION'};
  if(TimerState.mode===TIMER_MODES.SUSPENDED)return {state:'suspended',label:'SUSPENDED'};
  if(TimerState.mode===TIMER_MODES.DONE)return {state:'complete',label:'COMPLETE'};
  if(isLiveTrackableTimer()){
    if(TimerState.mode===TIMER_MODES.PAUSED||TimerState.paused)return {state:'paused',label:'SESSION PAUSED'};
    return {state:'live',label:'LIVE SESSION'};
  }
  return {state:'ready',label:'PLAN READY'};
}
function updateExecuteSessionStatus(){
  const model=executeSessionStatusModel();
  const segment=document.getElementById('status-session');
  const label=document.getElementById('status-session-label');
  const pane=document.getElementById('pane-execute');
  const bar=document.querySelector('#pane-execute .status-bar');
  const openPlan=document.getElementById('execute-open-plan');
  if(segment)segment.dataset['sessionState']=model.state;
  if(label)label.textContent=model.label;
  if(pane)pane.dataset['sessionState']=model.state;
  if(bar)bar.setAttribute('aria-label',`Execute session status: ${model.label.toLowerCase()}`);
  if(openPlan)openPlan.hidden=model.state!=='empty';
  return model;
}
function realTimeAwarenessKey(s:RealTimeScheduleState){
  const doneKey=TaskSessionState.resolvedIndices('done').sort((a,b)=>a-b).join(',');
  const skipKey=TaskSessionState.resolvedIndices('skipped').sort((a,b)=>a-b).join(',');
  const adjustmentKey=Object.keys(TimerState.adjustedSchedule||{}).sort().join(',');
  const drift=s.driftMin===null?'':Math.round(s.driftMin);
  return [TASKS.length,TimerState.currentIndex,TimerState.mode,s.nowEff,s.scheduledIdx,s.currentIdx,s.driftKind,drift,s.match?1:0,doneKey,skipKey,adjustmentKey,ports.PlanDraftEditor.active()?1:0].join('|');
}
function realTimeElements(){
  return cachedElements(elementCaches.realtime,{
    now:'rt-now',scheduled:'rt-scheduled',current:'rt-current',drift:'rt-drift',subline:'rt-subline',
    driftCard:'rt-drift-card',currentCard:'rt-current-card',planPane:'pane-plan'
  });
}
function updateRealTimeAwareness(state:RealTimeScheduleState|null=null,options:{force?:boolean}={}){
  const now=new Date();
  const s=state||getRealTimeState(now);
  const els=realTimeElements();
  setElementText(els['now'],clockHMS(now));
  const key=realTimeAwarenessKey(s);
  if(!options.force&&key===cache.realTimeAwarenessRenderKey)return s;
  cache.realTimeAwarenessRenderKey=key;
  setElementText(els['scheduled'],s.scheduledTask&&s.scheduledIdx!==null?`${shortTaskLabel(s.scheduledTask)} · ${scheduleWindowLabel(s.scheduledIdx,s.scheduledStart??undefined,s.scheduledEnd??undefined)}`:(TASKS.length?(s.nowEff<(s.first??0)?'Before first block':'After final block'):'No schedule loaded'));
  setElementText(els['current'],s.currentTask&&s.currentIdx!==null?`${shortTaskLabel(s.currentTask)} · ${scheduleWindowLabel(s.currentIdx,s.currentStart??undefined,s.currentEnd??undefined)}`:'No active timer block');
  setElementText(els['drift'],s.driftLabel);
  if(els['subline']){
    const cls=s.driftKind==='behind'?'warn':s.driftKind==='ahead'?'info':'hi';
    els['subline'].replaceChildren(textEl('span',cls,s.match?'MATCH':'REAL-TIME CHECK'),document.createTextNode(' · '+s.subline));
  }
  if(els['driftCard']){
    const className='rt-card ui-card '+(s.driftKind==='behind'?'behind':s.driftKind==='ahead'?'ahead':s.match?'ontrack':s.driftKind==='mismatch'?'mismatch':'');
    if(els['driftCard'].className!==className)els['driftCard'].className=className;
  }
  if(els['currentCard'])els['currentCard'].classList.toggle('mismatch',!!TASKS.length&&!s.match&&!!s.currentTask);
  renderRecoveryTarget(s);
  if(ports.PlanRuntime.needsRealtimeRefresh(s))requestRender('schedule');
  updateExecutePanels(s);
  return s;
}
function recoverySetStatus(msg:string,ok=true){
  if(!msg)return ports.NoticeCoordinator.resolveEvent('timer','recovery-status');
  return ports.NoticeCoordinator.emit({source:'timer',id:'recovery-status',surfaceId:'recovery-status',surface:'inline',foreground:false,cue:'none',severity:ok?'info':'error',lifecycle:ok?'succeeded':'failed',message:String(msg)});
}
function recoveryTargetTrackableIdx(opts:{allowNextAfterNonStudy?:boolean;allowCurrentFallback?:boolean}={}){
  const s=getRealTimeState();
  if(s.scheduledIdx!==null && isTrackableBlock(TASKS[s.scheduledIdx]) && !isTaskResolved(s.scheduledIdx))return s.scheduledIdx;
  if(opts.allowNextAfterNonStudy && s.scheduledIdx!==null){
    const next=nextIncompleteTrackableFrom(s.scheduledIdx+1);
    if(next!==null)return next;
  }
  if(opts.allowCurrentFallback && TimerState.currentIndex<TASKS.length && isTrackableBlock(TASKS[TimerState.currentIndex]) && !isTaskResolved(TimerState.currentIndex))return TimerState.currentIndex;
  return null;
}
function recoveryFallbackTrackableIdx(){
  if(TimerState.currentIndex<TASKS.length && isTrackableBlock(TASKS[TimerState.currentIndex]) && !isTaskResolved(TimerState.currentIndex))return TimerState.currentIndex;
  const s=getRealTimeState();
  if(s.scheduledIdx!==null){
    for(let i=s.scheduledIdx;i<TASKS.length;i++)if(isTrackableBlock(TASKS[i])&&!isTaskResolved(i))return i;
  }
  return null;
}
function renderRecoveryTarget(state:RealTimeScheduleState|null=null){
  const el=document.getElementById('recovery-target');if(!el)return;
  const s=state||getRealTimeState();
  if(!TASKS.length){el.textContent='TARGET: NO SCHEDULE';return;}
  if(s.scheduledTask)el.textContent='TARGET: '+shortTaskLabel(s.scheduledTask);
  else el.textContent=s.nowEff<(s.first??0)?'TARGET: BEFORE FIRST BLOCK':'TARGET: AFTER FINAL BLOCK';
}
function recoveryStartTimerAt(idx:number|null|undefined,seconds:number,actionLabel:string){
  if(!appCanMutate()){
    recoverySetStatus('Timer could not start because this tab no longer has execution control.',false);return false;
  }
  if(idx===null||idx===undefined||!isTrackableBlock(TASKS[idx])||isTaskResolved(idx)){
    recoverySetStatus('No unfinished trackable block is available for this action.',false);return false;
  }
  recoveryCaptureActiveBeforeSwitch();
  TimerEngine.stopExecution();
  setCurrentTask(idx);
  if(startCur(seconds||TASKS[idx]!.dur*60)!==true){
    recoverySetStatus('Timer could not start because this tab no longer has execution control.',false);
    return false;
  }
  const t=TASKS[idx]!;
  const label=seconds?`${actionLabel}: ${t.name} · ${fmtS(TimerEngine.status().totalSec)}`:`${actionLabel}: ${t.name}`;
  recoverySetStatus(label,true);
  requestRender('schedule','badges','header','realtime');saveLiveDraft();
  return true;
}
function recoveryJumpToScheduledNow(){
  const s=getRealTimeState();
  const idx=recoveryTargetTrackableIdx({allowNextAfterNonStudy:true,allowCurrentFallback:true});
  if(idx===null){recoverySetStatus('No incomplete trackable block is available from the current schedule position.',false);return;}
  const label=(s.scheduledIdx!==null&&isFixedBlock(TASKS[s.scheduledIdx]))
    ? 'Scheduled-now is fixed; jumped to next trackable block'
    : 'Jumped to scheduled-now block';
  recoveryStartTimerAt(idx,TASKS[idx]!.dur*60,label);
}
function recoveryStartScheduledFull(){
  let idx=recoveryTargetTrackableIdx({allowNextAfterNonStudy:true,allowCurrentFallback:true});
  if(idx===null)idx=recoveryFallbackTrackableIdx();
  if(idx===null){recoverySetStatus('No incomplete trackable block found.',false);return;}
  recoveryStartTimerAt(idx,TASKS[idx]!.dur*60,'Started full block');
}
function recoveryStartRemainingWindow(){
  let idx=recoveryTargetTrackableIdx({allowNextAfterNonStudy:true,allowCurrentFallback:true});
  if(idx===null)idx=recoveryFallbackTrackableIdx();
  if(idx===null){recoverySetStatus('No incomplete trackable block found for remaining-window start.',false);return;}
  const secs=remainingWindowSeconds(idx);
  const action=isInsideAdjustedWindow(idx)?'Started remaining scheduled window':'Started available trackable block window';
  recoveryStartTimerAt(idx,secs,action);
}
function recoveryShiftStartIndex(){
  let idx=(TimerState.currentIndex<TASKS.length&&isTrackableBlock(TASKS[TimerState.currentIndex])&&!isTaskResolved(TimerState.currentIndex))?TimerState.currentIndex:recoveryTargetTrackableIdx({allowNextAfterNonStudy:true,allowCurrentFallback:true});
  if(idx===null)idx=recoveryFallbackTrackableIdx();
  return idx;
}
function deriveRecoveryShiftPlan(idx:number,nowEff=effectiveNowMin()):RecoveryShiftPlan{
  const anchors=fixedAnchorRowsFrom(idx);
  const adjustments=[];
  const overflow=[];
  let minute=nowEff;
  for(let i=idx;i<TASKS.length;i++){
    const task=TASKS[i];
    if(!task||!isTrackableBlock(task)||isTaskResolved(i))continue;
    minute=avoidFixedAnchorOverlap(minute,task.dur,anchors);
    if(minute+task.dur>STUDY_DAY_MINUTES){
      for(let j=i;j<TASKS.length;j++)if(isTrackableBlock(TASKS[j])&&!isTaskResolved(j))overflow.push(j);
      break;
    }
    adjustments.push({idx:i,startMin:minute,endMin:minute+task.dur});
    minute+=task.dur;
  }
  return {idx,nowEff,adjustments,overflow,shifted:adjustments.length,firstStart:adjustments.length?adjustments[0]!.startMin:null};
}
function applyRecoveryShiftPlan(plan:RecoveryShiftPlan){
  const changedAt=new Date().toISOString();
  plan.adjustments.forEach(row=>{
    TimerState.setAdjustment(row.idx,{startMin:row.startMin,endMin:row.endMin,reason:'push_study_blocks_later_fixed_breaks',changedAt});
  });
  plan.overflow.forEach(idx=>TimerState.removeAdjustment(idx));
  invalidateScheduleDerived({adjustments:true,render:true});
  if(plan.overflow.length){
    const overflowDraft=buildCarryForwardText(new Set(plan.overflow));
    const existing=unfinishedNoteDraftText();
    setCarryForwardDraft(existing&&overflowDraft&&!existing.includes(overflowDraft)?existing+'\n\n'+overflowDraft:(existing||overflowDraft));
  }
}
function recoveryShiftOverflowText(plan:RecoveryShiftPlan){
  return plan.overflow.length?` ${plan.overflow.length} block${plan.overflow.length===1?'':'s'} did not fit before 04:00 and moved to the unfinished note.`:'';
}
function finishRecoveryShiftPlan(plan:RecoveryShiftPlan){
  if(!plan.shifted){
    recoverySetStatus(plan.overflow.length?`No unfinished block fits before 04:00. ${plan.overflow.length} block${plan.overflow.length===1?'':'s'} moved to the unfinished note.`:'No unfinished trackable blocks found to shift.',false);
    return;
  }
  const overflowText=recoveryShiftOverflowText(plan);
  if(plan.firstStart!==null&&plan.firstStart>plan.nowEff){
    recoveryCaptureActiveBeforeSwitch();
    setCurrentTask(plan.idx);
    TimerEngine.resetToReady('schedule-recovery');
    recoverySetStatus(`Pushed ${plan.shifted} trackable block${plan.shifted===1?'':'s'} later. Next starts at ${studyMinuteToHHMM(plan.firstStart??plan.nowEff)}; fixed timings stayed fixed.${overflowText}`,true);
    requestRender('schedule','badges','header','realtime');
    saveLiveDraft();
    return;
  }
  const startSecs=isInsideAdjustedWindow(plan.idx)?remainingWindowSeconds(plan.idx):TASKS[plan.idx]!.dur*60;
  recoveryStartTimerAt(plan.idx,startSecs,'Pushed trackable blocks later; fixed breaks preserved');
  recoverySetStatus(`Pushed ${plan.shifted} trackable block${plan.shifted===1?'':'s'} later from ${studyMinuteToHHMM(plan.firstStart??plan.nowEff)}. Fixed timings stayed fixed.${overflowText}`,true);
}
async function recoveryShiftRemainingDay(){
  if(!TASKS.length){recoverySetStatus('Load a schedule first.',false);return;}
  const idx=recoveryShiftStartIndex();
  if(idx===null){recoverySetStatus('No remaining trackable block found to shift.',false);return;}
  const accepted=await ports.Interactions.confirm({
    title:'Push remaining work later?',
    message:'Unfinished trackable blocks will move later while fixed meal and rest anchors stay in place.',
    details:['Anything that no longer fits before 04:00 will be added to the unfinished note.'],
    confirmLabel:'Push remaining Plan',cancelLabel:'Keep current timing'
  });
  if(!accepted||!appCanMutate())return;
  const plan=deriveRecoveryShiftPlan(idx);
  applyRecoveryShiftPlan(plan);
  finishRecoveryShiftPlan(plan);
}
function recoveryCarryForwardItems(forcedIndexes:ReadonlySet<number>|null=null){
  clearFutureUntouchedProgress();
  const nowEff=effectiveNowMin();
  const items:RecoveryCarryItem[]=[];
  TASKS.forEach((t,i)=>{
    if(!isTrackableBlock(t))return;
    const pct=getTaskCompletion(i);
    const plannedEnd=adjustedEndMin(i);
    const n=TaskSessionState.getField(i,'notes')||{};
    const forced=forcedIndexes instanceof Set&&forcedIndexes.has(i);
    const missed=nowEff>=plannedEnd && pct<100;
    const skipped=TaskSessionState.isSkipped(i);
    const partial=pct>0&&pct<100;
    if(!(forced||missed||skipped||partial))return;
    const remainingPct=Math.max(0,100-pct);
    const suggested=Math.max(20,Math.round(t.dur*remainingPct/100/5)*5||20);
    const fallbackTarget=taskTargetValue(t);
    const total=n.total!==undefined?n.total:fallbackTarget;
    const done=Number(n.done);
    let remainingUnits:string|number='—';
    if(total&& !isNaN(done))remainingUnits=Math.max(0,total-done);
    else if(total)remainingUnits=total;
    const subjectNotes=applicableNotesForTask(t);
    const note=[...subjectNotes.inherited.map(x=>x.text),subjectNotes.exactText].filter(Boolean).join('\n').trim();
    items.push({idx:i,t,pct,suggested,remainingUnits,note,reason:forced?'study-day boundary':skipped?'skipped':partial?'partial':'missed'});
  });
  return items;
}
function buildCarryForwardText(forcedIndexes:ReadonlySet<number>|null=null){
  const items=recoveryCarryForwardItems(forcedIndexes);
  if(!items.length)return '';
  let m=Number.isFinite(TimerState.scheduleAnchorMin)?TimerState.scheduleAnchorMin:5*60+30;
  const lines=[];
  lines.push('// Unfinished note generated from today’s Study Director');
  lines.push('// Edit times/durations before using tomorrow.');
  items.forEach(it=>{
    const t=it.t;
    const measure=taskMeasureValue(t,'block');
    const total=it.remainingUnits===0?0:(it.remainingUnits||'—');
    const carryKind=isSupportBlock(t)?'support':'work';
    lines.push(`${studyMinuteToHHMM(m)} | ${it.suggested} | Unfinished: ${t.name} | ${carryKind} | ${taskAreaValue(t)||'Revision'} | ${measure} | ${total}`);
    lines.push(`// Reason: ${it.reason}; today completion ${it.pct}%.`);
    if(it.note)lines.push(`// Note for ${t.name}: ${it.note.replace(/\n+/g,' / ')}`);
    m+=it.suggested;
  });
  return lines.join('\n');
}
function setCarryForwardDraft(text:string){
  ports.setCarryForward(clampText(String(text||'').trim(),APP_LIMITS.maxCarryForwardChars));
  const box=document.getElementById('recovery-carry-box'),ta=document.querySelector<HTMLTextAreaElement>('#recovery-carry-text');
  if(ta)ta.value=ports.getCarryForward();
  if(box)box.classList.toggle('on',!!ports.getCarryForward());
  renderRecoveryReview();
  renderReviewUnfinishedNote();
  saveLiveDraft();
}
function recoveryGenerateCarryForward(){
  const txt=buildCarryForwardText();
  setCarryForwardDraft(txt);
  recoverySetStatus(txt?'Unfinished note generated. It will appear separately in Review and Library.':'No unfinished trackable work detected.',true);
}
function syncUnfinishedNoteDraft(){
  const ta=document.querySelector<HTMLTextAreaElement>('#recovery-carry-text');
  const next=clampText((ta&&ta.value)||ports.getCarryForward()||'',APP_LIMITS.maxCarryForwardChars);
  if(next===ports.getCarryForward()){renderReviewUnfinishedNote();return false;}
  ports.setCarryForward(next);
  renderReviewUnfinishedNote();
  saveLiveDraft();
  return true;
}
function copyCarryForward(){
  const txt=unfinishedNoteDraftText();
  if(!txt){recoverySetStatus('No unfinished note to copy.',false);return;}
  ports.setCarryForward(txt);
  Promise.resolve(copyTextToClipboard(txt)).then(()=>recoverySetStatus('Unfinished note copied.',true)).catch(()=>recoverySetStatus('Clipboard unavailable. Select and copy the unfinished note manually.',false));
}
function unfinishedNoteDraftText(){
  return clampText((document.querySelector<HTMLTextAreaElement>('#recovery-carry-text')?.value||ports.getCarryForward()||'').trim(),APP_LIMITS.maxCarryForwardChars);
}
function closeUnfinishedNotePanel(){
  syncUnfinishedNoteDraft();
  const box=document.getElementById('recovery-carry-box');
  if(box)box.classList.remove('on');
  const details=document.getElementById('rt-actions');
  if(details)details.removeAttribute('open');
  recoverySetStatus('Unfinished note saved in today’s draft.',true);
}
function renderRecoveryReview(){
  renderRecoveryTarget();
  const ta=document.querySelector<HTMLTextAreaElement>('#recovery-carry-text');
  const box=document.getElementById('recovery-carry-box');
  if(ta&&ports.getCarryForward()&&ta.value!==ports.getCarryForward())ta.value=ports.getCarryForward();
  if(box)box.classList.toggle('on',!!ports.getCarryForward());
}
function isLiveTrackableTimer(){
  return !!(TimerState.runtime&&TimerState.runtime.startMs!==null&&TimerState.currentIndex<TASKS.length&&isTrackableBlock(TASKS[TimerState.currentIndex])&&(TimerState.mode===TIMER_MODES.RUNNING||TimerState.mode===TIMER_MODES.PAUSED));
}
function setExecuteControlsEnabled(active:boolean){
  const enabled=!!active;
  document.querySelectorAll<HTMLButtonElement>('button[data-action="toggle-pause"],button[data-action="mark-done"],button[data-action="skip-task"]').forEach(btn=>{btn.disabled=!enabled;});
  const rpt=document.querySelector<HTMLButtonElement>('button[data-tab="review"]');
  if(rpt)rpt.disabled=false;
}
function setExecuteShellVisible(visible=true){
  const show=visible?'':'none';
  const nameplate=document.querySelector<HTMLElement>('.nameplate');if(nameplate)nameplate.style.display=show;
  const status=document.querySelector<HTMLElement>('.status-bar');if(status)status.style.display=show;
  const grid=document.querySelector<HTMLElement>('.execute-grid');if(grid)grid.style.display=show;
}
function nextTrackableWindowLabel(d=new Date()){
  if(!TASKS.length)return '';
  const nowEff=effectiveNowMin(d);
  const rows=plannedRows().filter(r=>isTrackableBlock(r.t)&&!isTaskResolved(r.idx)&&r.end>nowEff);
  if(!rows.length)return 'No unfinished trackable block remains in today’s plan.';
  const row=rows[0]!;
  if(nowEff>=row.start&&nowEff<row.end)return `Scheduled now: ${row.t.name} · ${scheduleWindowLabel(row.idx,row.start,row.end)}.`;
  return `Next trackable block: ${row.t.name} · ${scheduleWindowLabel(row.idx,row.start,row.end)}.`;
}
function stripScheduleLead(label:string){
  return String(label||'')
    .replace(/^Next trackable block:\s*/,'')
    .replace(/^Scheduled now:\s*/,'')
    .replace(/\.$/,'');
}
function executeIdleView(name:string,badge:string,overlayTitle:string,overlayMessage:string,nextText:string){return {name,badge,overlayTitle,overlayMessage,kicker:'Execute Status',nextText};}
function executeIdlePresentation(d=new Date(),options:ExecuteIdleOptions={}){
  const explicitTitle=String(options.title||'').trim(),explicitMessage=String(options.message||'').trim();
  const hasRows=TASKS.length>0,hasTrackable=TASKS.some(isTrackableBlock),s=hasRows?getRealTimeState(d):null;
  const nextLabel=nextTrackableWindowLabel(d),nextShort=stripScheduleLead(nextLabel);
  const applyOverrides=(view:ReturnType<typeof executeIdleView>)=>{
    if(explicitTitle){view.name=explicitTitle;view.overlayTitle=explicitTitle;}
    if(explicitMessage)view.overlayMessage=explicitMessage;
    return view;
  };
  const elsewhere=sessionShownElsewhere();
  if(state.sessionPanelMode==='previous')return applyOverrides(executeIdleView('Previous Day Needs Review','PREVIOUS DAY','Previous Day Needs Review',
    'This study day is stored for review. Its timer will not restart. Choose Review Previous Day to recover it safely.','NEXT: REVIEW'));
  if(sessionParkedHere()){
    const handed=sessionFromElsewhere(state.sessionPanelSession);
    return applyOverrides(executeIdleView('Session Suspended','SUSPENDED','Today’s Session Suspended',handed?`Today’s session was suspended ${sessionDevice(state.sessionPanelSession)}. Continue Here picks it up on this device.`:'Restore Session continues it here. Review → Save Today can also save its progress without restarting the timer.','NEXT: —'));
  }
  if(elsewhere&&state.sessionMovingHere&&state.sessionHandoff.step){
    const summary=sessionProgressSummary(state.sessionMovingHere),done=summary&&summary.total?` (${summary.done} of ${summary.total} blocks done)`:'';
    return applyOverrides(executeIdleView(summary?.block||'Moving Here…','MOVING HERE','Moving Here…',`Today’s session is moving to this device${done}. Its timer starts here as soon as Google Drive confirms.`,'NEXT: STARTING HERE'));
  }
  if(elsewhere)return applyOverrides(executeIdleView('Running on Another Device',sessionDevice(elsewhere).replace(/^on /,'').toUpperCase(),'Running on Another Device',`Today’s session is running ${sessionDevice(elsewhere)} (last update ${sessionUpdateTime(elsewhere)}). Continue Here moves it to this device.`,'NEXT: —'));
  if(!hasRows)return applyOverrides(executeIdleView('No Schedule Loaded','—','No Schedule Loaded','Open Plan and apply today’s schedule to begin.','NEXT: —'));
  if(!hasTrackable)return applyOverrides(executeIdleView('Plan Has No Study Blocks','FIXED / NON-TRACKABLE ONLY','No Trackable Blocks','This plan has no work or support blocks for the timer to run. Edit it in Plan before starting.','NEXT: —'));
  if(TimerState.mode===TIMER_MODES.DONE){
    const unresolved=TASKS.some((t,i)=>isTrackableBlock(t)&&!isTaskResolved(i));
    return applyOverrides(executeIdleView(unresolved?'Forward Plan Complete':'Session Complete',unresolved?'NO LATER BLOCK':'SESSION COMPLETE',unresolved?'Forward Plan Complete':'Session Complete',unresolved?'No later unfinished block remains. Earlier untouched blocks remain available for deliberate selection or Review.':'Open Review for the end-of-day summary, or return to Plan to build another schedule.','NEXT: REVIEW'));
  }
  if(s?.scheduledTask&&s.scheduledIdx!==null&&isFixedBlock(s.scheduledTask)){
    const slotLabel=shortTaskLabel(s.scheduledTask);
    return applyOverrides(executeIdleView(slotLabel,`FIXED SLOT · ${scheduleWindowLabel(s.scheduledIdx,s.scheduledStart??undefined,s.scheduledEnd??undefined)}`,'Fixed Slot',`${slotLabel} is scheduled now. Fixed slots are not counted as focus time. ${nextLabel||'No unfinished trackable block remains in today’s plan.'}`,'NOW: '+slotLabel.slice(0,42)));
  }
  if(s?.scheduledTask&&s.scheduledIdx!==null&&isTrackableBlock(s.scheduledTask)){
    const slotLabel=shortTaskLabel(s.scheduledTask),finished=isTaskResolved(s.scheduledIdx);
    return applyOverrides(executeIdleView(slotLabel,`${finished?'COMPLETED SLOT':'TRACKABLE SLOT'} · ${scheduleWindowLabel(s.scheduledIdx,s.scheduledStart??undefined,s.scheduledEnd??undefined)}`,finished?'Trackable Slot Complete':'Trackable Slot Ready',finished?`${slotLabel} is scheduled now but is already marked done/skipped. ${nextLabel||'No unfinished trackable block remains in today’s plan.'}`:`${slotLabel} is scheduled now. The timer should auto-start; this ready state is kept as a defensive fallback.`,'NOW: '+slotLabel.slice(0,42)));
  }
  if(s&&s.first!==null&&s.nowEff<s.first)return applyOverrides(executeIdleView('Plan Ready','BEFORE FIRST BLOCK','Before First Block',nextLabel||'The timer will start when the first unfinished work/support block begins.',nextShort?'NEXT: '+nextShort.slice(0,42):'NEXT: —'));
  if(s&&s.last!==null&&s.nowEff>=s.last)return applyOverrides(executeIdleView('Day Window Ended','AFTER FINAL BLOCK','After Final Block',nextLabel||'No unfinished trackable block remains in today’s plan. Open Review when you are ready to save.','NEXT: REVIEW'));
  return applyOverrides(executeIdleView('Plan Waiting','BETWEEN TRACKABLE BLOCKS','Waiting',nextLabel||'The timer is waiting for the next unfinished work/support block.',nextShort?'NEXT: '+nextShort.slice(0,42):'NEXT: —'));
}
function setExecuteStateOverlay(title='',message='',kicker='Execute Status'){
  const overlay=document.getElementById('execute-state-overlay');
  const card=document.getElementById('cd-card');
  if(!overlay||!card)return;
  const show=!!(title||message);
  overlay.hidden=!show;
  card.classList.toggle('overlay-on',show);
  setTextSafe('execute-overlay-kicker',kicker||'Execute Status');
  setTextSafe('execute-overlay-title',title||'Execute Status');
  setTextSafe('execute-overlay-sub',message||'');
}
function clearExecuteStateOverlay(){setExecuteStateOverlay('','','');}
function refreshExecuteIdleDisplay(d=new Date(),options:ExecuteIdleOptions={}){
  if(isLiveTrackableTimer())return;
  const view=executeIdlePresentation(d,options);
  const key=JSON.stringify(view);
  if(!options.force&&key===cache.executeIdleDisplayKey)return;
  cache.executeIdleDisplayKey=key;
  setExecuteShellVisible(true);
  setExecuteControlsEnabled(false);
  setTextSafe('task-name',view.name||'—');
  setTextSafe('task-area-badge',view.badge||'—');
  setTextSafe('cd','00:00:00');
  const prog=document.getElementById('prog');if(prog)prog.style.width='0%';
  setTextSafe('prog-pct','0%');
  setTextSafe('next-name',stripScheduleLead(nextTrackableWindowLabel(d))||'—');
  setTextSafe('status-next',view.nextText||'NEXT: —');
  setPausedUI(false);
  setExecuteStateOverlay(view.overlayTitle,view.overlayMessage,view.kicker);
}
function showExecuteWaitingState(title:string,message:string){
  refreshExecuteIdleDisplay(new Date(),{title,message,force:true});
}
function maybeAutoStartScheduledBlock(d=new Date()){
  if(!appCanMutate()||!TASKS.some(isTrackableBlock))return false;
  if(studyDayRolledOver(d))return false;
  if(TimerState.mode===TIMER_MODES.SUSPENDED||TimerState.mode===TIMER_MODES.DONE)return false;
  if(isLiveTrackableTimer()||TimerState.paused)return false;
  const s=getRealTimeState(d);
  const idx=s.scheduledIdx;
  if(idx===null||!isTrackableBlock(TASKS[idx]))return false;
  if(isTaskResolved(idx))return false;
  setCurrentTask(idx);
  if(startCur(remainingWindowSeconds(idx,d))!==true)return false;
  recoverySetStatus('Auto-started the scheduled trackable block at its wall-clock window.');
  return true;
}
function maybePromptScheduleEndSave(d=new Date()){
  if(!appCanMutate()||!TASKS.some(isTrackableBlock)||!TimerState.studyDate)return;
  if(TimerState.studyDate!==todayISO(d))return;
  const lastEnd=latestTrackableEndMin();
  if(lastEnd===null)return;
  if(effectiveNowMin(d)<lastEnd)return;
  const key=`${TimerState.studyDate}:${scheduleFingerprint()}:${lastEnd}`;
  if(key===cache.scheduleEndPromptKey)return;
  cache.scheduleEndPromptKey=key;
  void promptSaveToday();
}
function showDone(){
  PracticePacer.pauseForSessionEnd({persist:false});
  TimerEngine.stopExecution();
  TimerState.runtime=TimerState.emptyRuntime();
  setTimerMode(TIMER_MODES.DONE,'schedule-complete');
  resetBreakState();
  const unresolved=TASKS.some((task,index)=>isTrackableBlock(task)&&!isTaskResolved(index));
  showExecuteWaitingState(
    unresolved?'Forward Plan Complete':'Session Complete',
    unresolved
      ? 'No later unfinished block remains. Earlier untouched blocks stay available for deliberate selection or Review.'
      : 'Open Review for the end-of-day summary, or return to Plan to build another schedule.'
  );
  refreshCoreUi();
  saveLiveDraft();
  if(!unresolved)void promptSaveToday();
  schedulePwaUpdateEvaluation(150);
}
function showEmpty(message='',title=''){
  PracticePacer.pauseFromMain(PRACTICE_PAUSE_CAUSES.MAIN);
  TimerEngine.stopExecution();
  TimerState.runtime=TimerState.emptyRuntime();
  const hasSchedule=TASKS.length>0;
  setTimerMode(hasSchedule?TIMER_MODES.READY:TIMER_MODES.EMPTY,'timer-empty');
  resetBreakState();
  refreshExecuteIdleDisplay(new Date(),{title,message,force:true});
  refreshCoreUi();
}
function badgeElements(){return cachedElements(elementCaches.badges,{done:'bdone-sb',left:'bleft-sb',bar:'done-bar'});}
function updateBadges(){
  const st=TASKS.filter(isTrackableBlock);
  const resolvedCount=TASKS.reduce((count,t,i)=>count+(isTrackableBlock(t)&&isTaskResolved(i)?1:0),0);
  const els=badgeElements();
  setElementText(els['done'],resolvedCount);
  setElementText(els['left'],st.length-resolvedCount);
  const width=(st.length?Math.round((resolvedCount/st.length)*100):0)+'%';
  if(els['bar']&&els['bar'].style.width!==width)els['bar'].style.width=width;
  updateTimerFocusMetrics();
  updateSessionControls();
}
function updateSessionControls(){
  const panel=document.getElementById('session-panel'),planControls=document.getElementById('plan-board-session-actions'),cardAction=document.getElementById('execute-session-action');
  const active=TASKS.some(isTrackableBlock);
  const running=TimerState.runtime&&TimerState.runtime.startMs!==null&&TimerState.currentIndex<TASKS.length&&isTrackableBlock(TASKS[TimerState.currentIndex]);
  const finished=active&&TimerState.mode===TIMER_MODES.DONE;
  const previous=state.sessionPanelMode==='previous',suspended=state.sessionPanelMode==='suspended'&&!active,elsewhere=state.sessionPanelMode==='elsewhere'&&!active,handedOff=suspended&&sessionFromElsewhere(state.sessionPanelSession);
  const visible=active||suspended||elsewhere||previous;
  if(panel){
    panel.hidden=!visible;
    panel.classList.toggle('suspended',suspended||elsewhere||previous);
    const title=document.getElementById('session-panel-title');
    const note=document.getElementById('session-panel-note');
    if(title)title.textContent=previous?'Previous Day Needs Review':elsewhere?'Running on Another Device':suspended?'Today’s Session Suspended':finished?'Today Finished':running?'Live Timer Active':'Applied Plan Available';
    if(note)note.textContent=previous
      ? 'This historical session is preserved for Review. Its timer will not restart or transfer ownership. Open Review and Save Today to Library when ready.'
      : elsewhere
      ? `Today’s session is running ${sessionDevice(state.sessionPanelSession)} (last update ${sessionUpdateTime(state.sessionPanelSession)}). Everything else works here as usual. Continue Here moves the session to this device.`
      : handedOff
      ? `Today’s session was suspended ${sessionDevice(state.sessionPanelSession)}. Continue Here picks it up on this device.`
      : suspended
      ? 'Restore Session continues the parked session. Review → Save Today can save the suspended progress to Library without restarting its timer. Reset Today discards the parked session.'
      : finished
      ? 'Today is closed for this plan. Open Review and Save Today to Library when ready.'
      : running
      ? 'The timer is actively tracking a block. Suspend or reset only if you intentionally want to stop this live session.'
      : 'A plan is loaded but no countdown is running. These controls affect today’s live session; saved Library records and notes are kept.';
  }
  const continuing=!!state.sessionHandoff.step,progress=document.getElementById('execute-session-progress'),progressText=continuing?state.sessionHandoff.step:state.sessionHandoff.error;
  if(progress){progress.hidden=!progressText;progress.classList.toggle('error',!continuing&&!!progressText);if(progress.textContent!==progressText)progress.textContent=progressText;}
  if(planControls){
    planControls.hidden=!visible;
    const stateLabel=document.getElementById('plan-session-state'),label=continuing?state.sessionHandoff.step:previous?'Previous day needs review':elsewhere?`Running ${sessionDevice(state.sessionPanelSession)}`:handedOff?`Suspended ${sessionDevice(state.sessionPanelSession)}`:suspended?'Today’s session is suspended':finished?'Today finished':running?'Live session':'Today’s session';
    if(stateLabel&&stateLabel.textContent!==label)stateLabel.textContent=label;
  }
  // The same controls in Execute's status card, its session panel and Plan's
  // strip: the next step first, then Suspend, Finish and Reset. A session
  // running elsewhere offers only Continue Here.
  [panel,planControls,cardAction?.parentElement].filter((container):container is HTMLElement=>!!container).forEach(container=>container.querySelectorAll<HTMLButtonElement>('button[data-action]').forEach(btn=>{
    const action=btn.dataset['action'];
    if(action==='restore-session'){btn.hidden=!suspended&&!elsewhere&&!previous;btn.disabled=continuing||!suspended&&!elsewhere&&!previous;const label=continuing?'Continuing…':previous?(active?'Open Review':'Review Previous Day'):elsewhere||handedOff?'Continue Here':'Restore Session';if(btn.textContent!==label)btn.textContent=label;btn.setAttribute('aria-busy',continuing?'true':'false');}
    else if(action==='suspend-session'){btn.hidden=previous||suspended||elsewhere;btn.disabled=!active||previous;}
    else if(action==='finish-session'){btn.hidden=previous||elsewhere||suspended;btn.disabled=!active||finished||previous;}
    else if(action==='reset-session'){btn.hidden=previous||elsewhere;btn.disabled=!visible||elsewhere||previous;}
  }));
  updateExecutePanels();
  refreshSessionSafetyUi();
}
function timerMetricElements(){return cachedElements(elementCaches.metrics,{actual:'timer-actual-focus',block:'timer-block-focus'});}
function updateTimerFocusMetrics(metrics:TimerFocusMetrics|null=null){
  const evidence=metrics?.evidence||SessionEvidenceGateway.snapshot({includeRecords:false});
  const summary=metrics||calculateReviewMetrics(evidence);
  const liveSnapshot=evidence.actualTime||{},els=timerMetricElements();
  setElementText(els['actual'],durationLabel(summary.actualFocusMinutes));
  const blockSec=(TimerState.currentIndex<TASKS.length&&isTrackableBlock(TASKS[TimerState.currentIndex]))?(Number(liveSnapshot[TimerState.currentIndex])||0):0;
  setElementText(els['block'],fmtS(Math.max(0,Math.round(blockSec))));
}
function syncStudyQuiet(){try{ports.NoticeCoordinator.setStudying(TimerState.mode===TIMER_MODES.RUNNING&&isWorkBlock(TASKS[TimerState.currentIndex]));}catch(error){ports.AppDiagnostics.capture('notifications.study-hold',error,'warn');}}
function sendSessionChangeSoon(reason:string){
  void Promise.resolve(flushLiveDraft()).catch(error=>ports.AppDiagnostics.capture('backup.session-change-flush',error,'warn')).then(()=>notifyBackupChange({urgent:true,reason}));
}
function togglePause(){const result=togglePauseTimer();if(result===true){sendSessionChangeSoon(TimerState.paused?'timer-pause':'timer-resume');schedulePwaUpdateEvaluation(150);}return result;}
function installSessionWatch(){
  if(sessionWatchTimer||sessionClaimWatchTimer)return false;
  sessionWatchTimer=setInterval(()=>{
    if(document.visibilityState!=='visible'||!ports.StartupLifecycle.status().fullyInitialized)return;
    if(!TASKS.length&&state.sessionPanelMode!=='elsewhere')return;
    try{if(ports.BackupProviderRuntime.syncing())ports.BackupProviderRuntime.wakeBackground('session-watch');}
    catch(error){ports.AppDiagnostics.capture('backup-provider.session-watch',error,'warn');}
  },SESSION_WATCH_MS);
  sessionClaimWatchTimer=setInterval(()=>{void wakeSessionOwnershipClaim(1000);},SESSION_CLAIM_WATCH_MS);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void wakeSessionOwnershipClaim();});
  window.addEventListener('online',()=>{void wakeSessionOwnershipClaim();});
  return true;
}
function notifyDeviceBackupIfStudyDayResolved(reason='study-day-completed'){
  const trackable=TASKS.map((task,index)=>({task,index})).filter(row=>isTrackableBlock(row.task));
  if(!trackable.length||!trackable.every(row=>isTaskResolved(row.index)))return false;
  return notifyBackupChange({urgent:true,reason});
}
function markDone(){
  const finishWasAvailable=isTrackableBlock(TASKS[TimerState.currentIndex]);
  const result=markDoneTimer();
  if(finishWasAvailable&&result===true){notifyDeviceBackupIfStudyDayResolved();sendSessionChangeSoon('block-finished');}
  if(result===true){schedulePwaUpdateEvaluation(150);void ports.NativeCapabilities?.syncWake({forceCycle:true});}
  return result;
}
function skipTask(){
  const result=skipTaskTimer();
  if(result===true){notifyDeviceBackupIfStudyDayResolved();sendSessionChangeSoon('block-skipped');schedulePwaUpdateEvaluation(150);void ports.NativeCapabilities?.syncWake({forceCycle:true});}
  return result;
}
function finishPracticePacer(){
  const result=PracticePacer.finish();
  schedulePwaUpdateEvaluation(150);return result;
}
function handlePracticeStartKey(event:KeyboardEvent|null){if(event&&event.key==='Enter'){PracticePacer.start();return false;}return true;}
return Object.freeze({updateExecutePanels,sessionShownElsewhere,sessionParkedHere,executeSessionStatusModel,updateExecuteSessionStatus,realTimeAwarenessKey,realTimeElements,updateRealTimeAwareness,recoverySetStatus,recoveryTargetTrackableIdx,recoveryFallbackTrackableIdx,renderRecoveryTarget,recoveryStartTimerAt,recoveryJumpToScheduledNow,recoveryStartScheduledFull,recoveryStartRemainingWindow,recoveryShiftStartIndex,deriveRecoveryShiftPlan,applyRecoveryShiftPlan,recoveryShiftOverflowText,finishRecoveryShiftPlan,recoveryShiftRemainingDay,recoveryCarryForwardItems,buildCarryForwardText,setCarryForwardDraft,recoveryGenerateCarryForward,syncUnfinishedNoteDraft,copyCarryForward,unfinishedNoteDraftText,closeUnfinishedNotePanel,renderRecoveryReview,isLiveTrackableTimer,setExecuteControlsEnabled,setExecuteShellVisible,nextTrackableWindowLabel,stripScheduleLead,executeIdleView,executeIdlePresentation,setExecuteStateOverlay,clearExecuteStateOverlay,refreshExecuteIdleDisplay,showExecuteWaitingState,maybeAutoStartScheduledBlock,maybePromptScheduleEndSave,showDone,showEmpty,badgeElements,updateBadges,updateSessionControls,timerMetricElements,updateTimerFocusMetrics,syncStudyQuiet,sendSessionChangeSoon,togglePause,installSessionWatch,notifyDeviceBackupIfStudyDayResolved,markDone,skipTask,finishPracticePacer,handlePracticeStartKey});
}
const createModule=()=>Object.freeze({format:'study-director.execution-views-module' as const,contractVersion:1 as const,createController});
registry.define('execution-views',1,createModule);return createModule;
})();
export type ExecutionViewsModule=ReturnType<typeof sdExecutionViewsFactory>;
