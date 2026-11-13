import type {SessionContext,SessionCompletion} from '../../types/session-lifecycle.ts';
import type {SessionLifecycleViewInput} from '../../types/session-actions.ts';
import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {ActiveSession,SessionSnapshot,TimerPayload} from '../../types/record-models.ts';
import type {SessionHostController} from '../../types/session-host.ts';
import type {SessionHandoffTransferOptions} from '../../types/session-handoff.ts';
import type {SessionResult} from '../../types/repositories.ts';
import type {SessionActionState,SessionActionInput,SessionApplyOptions} from '../../types/session-actions.ts';
const sdSessionActionsFactory=(()=>{
'use strict';
const registry=(globalThis as unknown as Record<symbol,unknown>)[Symbol.for('studyDirector.internalModules.v1')] as ModuleRegistration<'session-actions','study-director.session-actions-module'>|undefined;
if(!registry||registry.version!==1)throw new Error('Study Director internal module registry is unavailable.');
function errorMessage(error:unknown){return error&&typeof error==='object'&&'message' in error&&error.message?String(error.message):String(error??'');}
function createController(ports:Readonly<SessionActionInput>){
  const {state}=ports;
  const {TASKS,TimerState,TIMER_MODES,TaskIdentity,TaskSessionState,PracticePacer,TimerEngine,setTimerMode,isTaskResolved,focusCompletionForTask,storeResolvedCompletion,resetBreakState}=ports.runtime;
  const {resolveActivePauseBeforeTimerSwitch,recordCurrentActiveToTask,actualTimeSnapshot}=TimerEngine;
  const COMPLETION_SOURCES=ports.completionSources;
  const {markStorageHealthError,markStorageHealthOk,refreshStorageFallbackWarning,setPlanStatus,prettyDate,notifyBackupChange,updateExecuteSessionStatus,refreshExecuteIdleDisplay,updateSessionControls,scheduleSyncStatus,goTab,appCanMutate,getReviewDate,resetCountdownRuntime,restoreTimerRuntimeIfAny,showEmpty,renderSched,updateBadges,updateHeaderInfo,updateRealTimeAwareness,renderRecoveryReview,updateExecutePanels,storageHealthTime,deviceName,refreshCoreUi,clearCanonicalSessionAfterSavedDay,scheduleFingerprint,parseScheduleDraftText,scheduleFingerprintForRows,isTrackableBlock,makeTaskId,shortTaskLabel,isValidIsoDate,todayISO,DecisionClock,SLEEP_GAP_THRESHOLD_MS,HANDOFF_RETRY_MESSAGE,navigator}=ports;
function hasBlockingActiveSession(){
  const active=TASKS.some(isTrackableBlock);
  if(state.sessionPanelMode==='suspended'&&!active)return false;
  if(TimerState.mode===TIMER_MODES.SUSPENDED&&!active)return false;
  return state.sessionPanelMode==='active'||active;
}
function resumeTimerLoopAfterPrimaryRestore(){
  try{
    if(ports.SessionHandoffRuntime?.frozen())return false;
    const resumed=TimerEngine.resumeAfterPrimaryRestore();
    if(ports.StartupLifecycle.status().fullyInitialized)ports.SessionLifecycle.reconcile('ownership-primary',{date:getReviewDate()});
    return resumed;
  }catch(e){ports.AppDiagnostics.capture('ownership.resume-timer',e,'error');return false;}
}
async function loadActiveSessionForRestore(){
  const loaded=await ports.AppData.activeSession.load();
  if(loaded&&!loaded.ok&&loaded.error)markStorageHealthError('activeSession',`Live-session recovery could not be loaded: ${errorMessage(loaded.error)||'active session load failed'}`);
  return loaded&&loaded.value||null;
}
function activeSessionScheduleFingerprint(session:ActiveSession|null){
  const draft=parseScheduleDraftText(String(session&&session.scheduleText||''));
  return draft.ok?scheduleFingerprintForRows(draft.parsed):'';
}
function applyStoredSessionSnapshot(session:ActiveSession|null,snapshot:SessionSnapshot|null,{source,reviewOnly=false,lifecycleManaged=false}:SessionApplyOptions={}){
  if(!ports.ActiveSessionRuntime||!session||!snapshot)return false;
  return ports.ActiveSessionRuntime.applyStoredSession(session,snapshot,{...(source?{source}:{}),reviewOnly,lifecycleManaged});
}
async function hydratePrimaryStateFromStorage(options:{sameTabReload?:boolean}={}){
  const sameTabReload=!!options.sameTabReload;
  const notesReloaded=await ports.AppData.notes.reloadFresh();
  if(!notesReloaded)throw new Error('The latest notes could not be reloaded before ownership transfer.');
  const session=await loadActiveSessionForRestore();
  // Historical sessions must never be offered today's Continue Here path,
  // including suspended copies and those last owned on another device.
  if(isPreviousActiveSessionRecord(session)&&!TASKS.length)return attemptAutoRestoreActiveSession();
  if(sessionRunsElsewhere(session)&&!TASKS.length){setSessionPanelMode('elsewhere',session);return false;}
  if(isRestorableActiveSession(session)){
    const snapshot=activeSessionSnapshot(session);
    if(snapshot){
      const restored=applyStoredSessionSnapshot(session,snapshot,{source:sameTabReload?'active-session-restore':'ownership-takeover'});
      if(restored!==false){
        if(sameTabReload)setPlanStatus('✓ Restored today’s active session.');
        await goTab('execute',{source:'ownership-restore',history:'replace'});return true;
      }
    }
  }
  if(TASKS.length){
    ports.SessionLifecycle.reconcile('ownership-takeover-no-session',{date:getReviewDate()});
    resetCountdownRuntime();
    const restored=restoreLiveDraftIfAny();
    if(restored&&restoreTimerRuntimeIfAny())return true;
    showEmpty('No canonical running timer was found after ownership transfer. Start a block deliberately from the loaded plan.','Control Transferred');
  }
  return false;
}
function handleActiveSessionRepositoryResult(result:SessionResult|null,action:'save'|'clear'='save'){
  if(result&&result.ok){
    if(action==='save'&&result.storage&&result.storage.idb===true)markStorageHealthOk('activeSession');
    else if(action==='save')markStorageHealthOk('activeSession');
    else if(action==='clear')markStorageHealthOk('activeSession');
    if(action==='save')ports.ReviewEditor?.persistenceCommitted?.();
    return true;
  }
  const reason=result&&result.error?(errorMessage(result.error)):`active session ${action} failed`;
  if(action==='save'){
    markStorageHealthError('activeSession',`Active-session recovery save failed: ${reason}. Export a backup if this persists.`);
    ports.ReviewEditor?.persistenceFailed?.(result&&result.error||new Error(reason));
  }
  return false;
}
function restoreLiveDraftIfAny(){
  TimerState.pendingRestore=null;
  try{return ports.ActiveSessionRuntime?.restoreLocalRecovery()||false;}catch(e){return false;}
}
function activeSessionSnapshot(session:ActiveSession|null){
  const current=ports.ActiveSessionCodec.sanitizeCurrent(session);
  return current&&ports.ActiveSessionRuntime?ports.ActiveSessionRuntime.sessionSnapshot(current):null;
}
function sessionRunsElsewhere(session:ActiveSession|null){return ports.SessionHandoffRuntime?ports.SessionHandoffRuntime.runsElsewhere(session):!!session&&typeof session==='object'&&session.status!=='suspended'&&String(session.runningOn||'')!==ports.InstallationIdentity.getId();}
function sessionFromElsewhere(session:ActiveSession|null){return ports.SessionHandoffRuntime?ports.SessionHandoffRuntime.fromElsewhere(session):!!session&&typeof session==='object'&&String(session.runningOn||'')!==ports.InstallationIdentity.getId();}
function isRestorableActiveSession(session:ActiveSession|null){
  return !sessionRunsElsewhere(session)&&ports.ActiveSessionRuntime?.classify(session)==='today-active';
}
function isSuspendedActiveSession(session:ActiveSession|null){return ports.ActiveSessionRuntime?.classify(session)==='today-suspended';}
function isPreviousActiveSessionRecord(session:ActiveSession|null){return ports.ActiveSessionRuntime?.classify(session)==='previous';}
async function savedDayCoversActiveSession(session:ActiveSession|null){
  if(!session||!isPreviousActiveSessionRecord(session))return false;
  const snapshot=activeSessionSnapshot(session),contentRevision=Number(snapshot?.contentRevision),savedRevision=Number(snapshot?.savedRevision);
  if(!Number.isSafeInteger(contentRevision)||contentRevision<0||
      !Number.isSafeInteger(savedRevision)||savedRevision<contentRevision)return false;
  try{
    const rows=await ports.AppData.dailyRecords.documents([session.date],{requireCanonical:true}),record=rows.find(item=>item.date===session.date);
    if(!ports.DailyRecordCodec.savedDayCoversSessionEvidence(record,session,{allowAdvances:true}))return false;
    await ports.AppData.dailyRecords.verifyCanonical(record);
    return true;
  }catch(error){
    ports.AppDiagnostics.capture('session.previous-day-saved-check',error,'warn');
    return false;
  }
}
async function retireCoveredPreviousActiveSession(session:ActiveSession|null){
  if(!session||!await savedDayCoversActiveSession(session))return false;
  const loaded=await ports.AppData.activeSession.load(),current=loaded&&loaded.value?ports.ActiveSessionCodec.sanitizeCurrent(loaded.value):null;
  if(!current||!ports.CanonicalModule.same(current,ports.ActiveSessionCodec.sanitizeCurrent(session)))return false;
  try{
    await clearCanonicalSessionAfterSavedDay();
  }catch(error){
    const reason=errorMessage(error);
    state.sessionSafetyMessage=`${prettyDate(session.date)} is saved in Library, but its redundant recovery copy could not be verified as cleared: ${reason}`;
    setSessionPanelMode('previous',session);
    refreshStorageFallbackWarning();
    setPlanStatus(state.sessionSafetyMessage,false);
    return true;
  }
  if(state.saveReminderDate===session.date){state.saveReminderDate='';state.saveReminderEvidence=null;state.saveReminderGeneration+=1;}
  if(state.sessionSafetyMessage.includes('unsaved')||state.sessionSafetyMessage.includes('Review reminder'))state.sessionSafetyMessage='';
  setSessionPanelMode('none');
  refreshStorageFallbackWarning();
  setPlanStatus(`✓ ${prettyDate(session.date)} is already saved in Library.`);
  notifyBackupChange({urgent:true,reason:'saved-session-retired'});
  return true;
}
function setSessionPanelMode(mode:SessionActionState['sessionPanelMode'],session:ActiveSession|null=null){
  state.sessionPanelMode=mode||'none';
  state.sessionPanelSession=['suspended','elsewhere','previous'].includes(state.sessionPanelMode)?session:null;
  if(!state.sessionPanelSession&&state.sessionHandoff.error)state.sessionHandoff={...state.sessionHandoff,error:''};
  // The Execute header names the device running the session, or stops doing
  // so. Before the panel's own controls, which the idle display disables.
  try{updateExecuteSessionStatus();refreshExecuteIdleDisplay(new Date(),{force:true});}catch(error){ports.AppDiagnostics.capture('execute.session-elsewhere-header',error,'warn');}
  updateSessionControls();scheduleSyncStatus();
}
async function recoverPreviousSessionForReview(session:ActiveSession|null){
  const snapshot=activeSessionSnapshot(session);
  if(!session||!snapshot)return false;
  const reviewSnapshot={...snapshot,timerRuntime:null};
  const restored=applyStoredSessionSnapshot(session,reviewSnapshot,{source:'previous-session-review',reviewOnly:true});
  if(restored===false)return false;
  state.sessionSafetyMessage=`Recovered unsaved ${prettyDate(session.date)} into Review. Its timer was not restarted. Save or discard it before applying a new study day.`;
  refreshStorageFallbackWarning();
  setSessionPanelMode('previous',session);
  setPlanStatus('✓ Recovered the previous study day into Review without restarting its timer.');
  await goTab('review',{source:'session-recovery',history:'none'});
  return true;
}
async function handlePreviousActiveSession(session:ActiveSession|null){
  if(!session||!isPreviousActiveSessionRecord(session))return false;
  const remote=sessionFromElsewhere(session);
  const choice=await ports.Interactions.choose({
    title:'Previous study day needs review',
    message:`Study Director found study evidence from ${prettyDate(session.date)}. It will not restart yesterday’s timer or transfer ownership.`,
    details:[
      'Recover opens the previous day in Review without restarting its timer.',
      remote?'This copy was last owned on another device. Review it here without using Continue Here.':'Keep stored preserves the recovery copy for later.',
      'A different or unproven Saved Day will never silently replace this evidence.'
    ],
    cancelLabel:'Keep stored',
    choices:[
      {value:'recover',label:'Recover in Review',kind:'primary',description:'Review and save the previous study day.'},
      ...(!remote?[{value:'discard',label:'Discard session',kind:'danger',description:'Remove this unsaved local recovery copy after an explicit decision.'}]:[])
    ]
  });
  // A dialog is not a storage lock. Reject choices against a session that
  // changed while the person was deciding, and verify durable retirement.
  let loaded=null;
  try{loaded=await ports.AppData.activeSession.load(0,{strict:true});}
  catch(error){
    setSessionPanelMode('previous',session);
    setPlanStatus('Could not verify previous-day recovery: '+(errorMessage(error)),false);
    return false;
  }
  const current=loaded?.ok&&!loaded.error?ports.ActiveSessionCodec.sanitizeCurrent(loaded.value):null;
  if(!current||!ports.CanonicalModule.same(current,ports.ActiveSessionCodec.sanitizeCurrent(session))){
    setPlanStatus('Previous-day recovery changed while you were deciding. Review the latest saved state before proceeding.',false);
    setSessionPanelMode(isPreviousActiveSessionRecord(current)?'previous':'none',current);
    return false;
  }
  if(await retireCoveredPreviousActiveSession(current))return false;
  if(choice==='recover')return recoverPreviousSessionForReview(current);
  if(choice==='discard'&&!remote){
    try{
      // The repository's existing exclusive mutation owner serializes this
      // deliberate deletion against backup/restore. Reread after acquiring
      // that owner; the earlier dialog check is not a storage lock.
      await ports.AppMutationCoordinator.runExclusive('discard-previous-session',async()=>{
        const latest=await ports.AppData.activeSession.load(0,{strict:true});
        if(!latest?.ok||latest.error||
            !ports.CanonicalModule.same(ports.ActiveSessionCodec.sanitizeCurrent(latest.value),current))
          throw new Error('The previous-day session changed while discard was starting.');
        await ports.ActiveSessionRuntime.clearCanonical('discarding the previous-day recovery session');
      });
    }catch(error){
      setSessionPanelMode('previous',current);
      setPlanStatus('Could not verify deletion of the previous-day recovery copy: '+(errorMessage(error)),false);
      return false;
    }
    setSessionPanelMode('none');
    setPlanStatus(`Discarded the unsaved ${prettyDate(current.date)} session.`);
    ports.Interactions.notify({source:'session',kind:'success',key:'previous-session',title:'Unsaved session discarded',message:prettyDate(current.date)});
    return false;
  }
  setSessionPanelMode('previous',current);
  state.sessionSafetyMessage=`Unsaved ${prettyDate(current.date)} remains stored. Choose Review Previous Day in Execute or Plan to recover it, or export a backup.`;
  refreshStorageFallbackWarning();
  setPlanStatus(state.sessionSafetyMessage,false);
  return false;
}
async function revisitPreviousStoredSession(){
  if(!appCanMutate())return false;
  try{
    const loaded=await ports.AppData.activeSession.load(0,{strict:true}),session=loaded?.value||null;
    if(!isPreviousActiveSessionRecord(session)){
      setSessionPanelMode('none');
      setPlanStatus('No previous-day recovery session remains. Open Library to review saved days.');
      return false;
    }
    if(await retireCoveredPreviousActiveSession(session))return false;
    return handlePreviousActiveSession(session);
  }catch(error){
    setPlanStatus('Could not read previous-day recovery safely: '+(errorMessage(error)),false);
    return false;
  }
}
async function attemptAutoRestoreActiveSession(){
  try{
    if(TASKS.length||ports.PlanScheduleGateway.hasLiveState())return false;
    const session=await loadActiveSessionForRestore();
    if(TASKS.length||ports.PlanScheduleGateway.hasLiveState())return false;
    // A previous-day recovery row is not evidence of an unsaved day by
    // itself. If the canonical Saved Day covers its latest content revision,
    // retire the redundant recovery copy before considering ownership/UI.
    if(isPreviousActiveSessionRecord(session)&&await retireCoveredPreviousActiveSession(session))return false;
    if(isPreviousActiveSessionRecord(session))return handlePreviousActiveSession(session);
    if(sessionRunsElsewhere(session)){setSessionPanelMode('elsewhere',session);return false;}
    if(isSuspendedActiveSession(session)){setSessionPanelMode('suspended',session);return false;}
    if(!isRestorableActiveSession(session)){setSessionPanelMode('none');return false;}
    const snapshot=activeSessionSnapshot(session);
    const restored=applyStoredSessionSnapshot(session,snapshot,{source:'active-session-restore'});
    if(restored!==false){
      setSessionPanelMode('active');
      setPlanStatus('✓ Restored today’s active session.');
      await goTab('execute',{source:'session-auto-restore',history:'none'});
      return true;
    }
  }catch(e){ports.AppDiagnostics.capture('session.auto-restore',e,'error');}
  return false;
}
function resetRuntimeSessionState(options:Parameters<SessionHostController['resetRuntime']>[0]={}){
  if(!ports.ActiveSessionRuntime)return false;
  return ports.ActiveSessionRuntime.resetRuntime(options);
}
function refreshPlanAfterSessionReset(emptyMessage='',emptyTitle=''){
  // A session reset, suspension or remote handoff is not an edit action.
  ports.PlanDraftEditor.preview({silent:true,enterDraft:false});
  renderSched();
  updateBadges();
  updateHeaderInfo();
  updateRealTimeAwareness();
  renderRecoveryReview();
  showEmpty(emptyMessage,emptyTitle);
  void goTab('plan',{source:'session-reset'});
}
async function suspendTodaySession(){
  const ok=await ports.Interactions.confirm({
    title:'Suspend today’s session?',
    message:'The live timer will stop and today’s session will no longer restore automatically.',
    details:['The live draft is kept; Restore Session can continue it without re-applying the schedule.','You can also open Review and save the suspended progress to Library. Saved Library Study Days and notes are unchanged.'],
    confirmLabel:'Suspend session',cancelLabel:'Keep session active'
  });
  if(!ok||!appCanMutate())return false;
  try{
    const session=await ports.ActiveSessionRuntime.suspendLocal();
    setSessionPanelMode('suspended',session);
    refreshPlanAfterSessionReset();
    setTimerMode(TIMER_MODES.SUSPENDED,'session-suspend');
    updateExecutePanels();
    setPlanStatus('Today’s session is suspended. Restore it to continue, save it from Review to preserve the suspended progress in Library, or Reset Today to start fresh.');
    const synced=ports.BackupProviderRuntime.connected('google-drive');
    ports.Interactions.notify({source:'session',kind:'success',key:'session-suspend',title:'Session suspended',message:synced?'Saving it to Google Drive now. Continue it here with Restore Session, or on another device once it syncs.':'Restore Session continues it; Review can save the suspended progress to Library.'});
    notifyBackupChange({urgent:true,reason:'session-suspend'});
    return true;
  }catch(e){
    setPlanStatus('Could not suspend today’s session: '+(errorMessage(e)),false);
    return false;
  }
}
function sessionUpdateTime(session:ActiveSession|null){return storageHealthTime(String(session&&session.updatedAt||''));}
function sessionDevice(session:ActiveSession|null){const name=deviceName(session&&session.runningOn);return name&&name!=='This device'?`on ${name}`:'on another device';}
async function confirmSessionTakeover(session:ActiveSession,{replace=false}:{replace?:boolean}={}){
  const time=sessionUpdateTime(session);
  return ports.Interactions.confirm({
    title:replace?'Start a new plan here?':'Continue here?',
    message:`Today’s session is still running ${sessionDevice(session)} (last update ${time}).`,
    details:[replace?'Applying this plan replaces that session on every device.':'The session moves to this device and its timer runs here.','The other device stops its timer at its next sync.',`Anything it recorded after ${time} is kept there for you to review.`],
    confirmLabel:replace?'Apply here':'Continue here',cancelLabel:'Not now'
  });
}
async function transferSessionOwnershipHere(session:ActiveSession,{onStep,preread=null}:SessionHandoffTransferOptions={}){
  if(!ports.SessionHandoffRuntime)throw new Error('Session handoff runtime is unavailable.');
  return ports.SessionHandoffRuntime.transferHere(session,{...(onStep?{onStep}:{}),preread});
}
function setSessionHandoff(step='',error=''){
  state.sessionHandoff={step:String(step||''),error:String(error||'')};
  updateSessionControls();
  try{refreshExecuteIdleDisplay(new Date(),{force:true});}catch(error){ports.AppDiagnostics.capture('execute.session-moving',error,'warn');}
}
function sessionProgressSummary(session:ActiveSession|null){
  const snapshot=activeSessionSnapshot(session),draft=parseScheduleDraftText(String(session&&session.scheduleText||''));
  if(!snapshot||!draft.ok)return null;
  const taskState=snapshot.taskState&&typeof snapshot.taskState==='object'?snapshot.taskState:{},finished=(row:{id:string})=>['done','skipped'].includes(taskState[row.id]?.resolvedState||'');
  const rows=draft.parsed.map((task,index)=>({task,id:String(makeTaskId(task,index))})).filter(row=>isTrackableBlock(row.task));
  const current=rows.find(row=>row.id===String(snapshot.currentTaskId||''))||rows.find(row=>!finished(row));
  return {block:current?shortTaskLabel({...current.task,id:current.id}):'',done:rows.filter(finished).length,total:rows.length};
}
function sessionHandoffProblem(error:unknown){
  const code=String(error&&typeof error==='object'&&'code' in error?error.code:'');
  if(navigator.onLine===false)return 'You’re offline. Connect to the internet, then try again.';
  if(code==='SESSION_CONTINUE_BUSY')return 'Google Drive is busy with another backup or restore. Try again in a moment.';
  if(code==='SESSION_CONTINUE_NOT_CONNECTED')return 'Google Drive isn’t connected. Sign in from your profile, then try again.';
  if(code==='SESSION_CONTINUE_SYNC_REQUIRED')return 'Today’s shared session advanced. This device is syncing it first; retry Continue Here after sync.';
  if(code==='SESSION_CONTINUE_INCOMPLETE')return HANDOFF_RETRY_MESSAGE;
  if(code==='SESSION_CONTINUE_CHANGED')return 'Today’s session changed on this device while Continue Here was starting. Nothing moved; try again.';
  if(code==='REPOSITORY_SYNC_NEEDS_UPDATE')return errorMessage(error)||'Update the app to continue here.';
  if(code==='REPOSITORY_SESSION_CLAIM_STALE')return 'Today’s session changed on another device. Wait for this device to catch up, then try again.';
  if(code==='REPOSITORY_SYNC_TURN')return 'Another device is saving to Google Drive. Try again in a moment.';
  return errorMessage(error)||'Something went wrong.';
}
async function continueSessionHere():Promise<boolean>{
  if(!appCanMutate()||state.sessionHandoff.step)return false;
  // The "Today’s session is ready" pop-up has done its job.
  ports.NoticeCoordinator.resolveEvent('session','session-handoff');
  setSessionHandoff('Checking today’s session…');
  try{
    const loaded=await ports.ActiveSessionRuntime.load(),session=loaded&&loaded.value||null;
    if(!session){setSessionPanelMode('none');return false;}
    // Classify the date before any today-only continuation, restoration or
    // ownership operation.
    if(isPreviousActiveSessionRecord(session)){
      setSessionPanelMode('previous',session);
      setPlanStatus('This session belongs to a previous study day. Review it without transferring or restarting its timer.',false);
      return false;
    }
    if(!sessionFromElsewhere(session))return session.status==='suspended'?restoreSuspendedTodaySession():attemptAutoRestoreActiveSession();
    // Drive is read while the person confirms, so pressing Continue here
    // waits only on the claim when Drive has not moved on. Nothing is written.
    const preread=ports.SessionHandoffRuntime?.prefetchSource()||Promise.resolve(null);
    if(sessionRunsElsewhere(session)&&!await confirmSessionTakeover(session))return false;
    if(!appCanMutate())return false;
    // From here Execute shows the session moving here; its timer starts only
    // once Google Drive confirms the claim.
    state.sessionMovingHere=session;setSessionHandoff('Moving the session here…');
    const moved=await transferSessionOwnershipHere(session,{onStep:text=>setSessionHandoff(text),preread});
    setSessionHandoff('Starting here…');
    if(moved.previous.status==='suspended')return restoreSuspendedTodaySession();
    // The timer runs here now: Resume, as Restore Session plays.
    const restored=await attemptAutoRestoreActiveSession();
    if(restored)ports.NoticeCoordinator.emit({source:'session',id:'session-continued',surface:'quiet',foreground:false,cue:'resume',occurrence:String(Date.now())});
    return restored;
  }catch(error){
    const problem=sessionHandoffProblem(error);
    setPlanStatus('Could not continue today’s session here: '+problem,false);
    // Catch-up may legitimately have advanced or ended the session before a
    // later claim fence rejected the takeover. Re-project from canonical
    // storage; never redraw the stale object captured before Continue Here.
    try{
      const loaded=await ports.ActiveSessionRuntime.load(),current=loaded&&loaded.value||null;
      if(!current)setSessionPanelMode('none');
      else if(isPreviousActiveSessionRecord(current))setSessionPanelMode('previous',current);
      else if(sessionRunsElsewhere(current))setSessionPanelMode('elsewhere',current);
      else if(isSuspendedActiveSession(current))setSessionPanelMode('suspended',current);
      else setSessionPanelMode('active',current);
    }catch(renderError){ports.AppDiagnostics.capture('session.continue-failure-refresh',renderError,'warn');}
    setSessionHandoff('','Couldn’t continue here. '+problem);
    ports.Interactions.notify({source:'session',kind:'error',key:'session-continue',title:'Couldn’t continue here',message:problem});
    return false;
  }finally{state.sessionMovingHere=null;if(state.sessionHandoff.step)setSessionHandoff('',state.sessionHandoff.error);}
}
async function continueSessionOnExecute(source:string){
  if(state.sessionHandoff.step)return false;
  await goTab('execute',{source});
  return continueSessionHere();
}
async function yieldSessionToOtherDevice(options:{deferReview?:boolean}={}){
  if(!ports.SessionHandoffRuntime)return false;
  const deferReview=options&&options.deferReview===true,session=await ports.SessionHandoffRuntime.yieldLocal();
  if(!session)return false;
  setSessionPanelMode('suspended',session);
  refreshPlanAfterSessionReset();
  setTimerMode(TIMER_MODES.SUSPENDED,'session-yield');
  updateExecutePanels();
  state.sessionYieldedAt=DecisionClock.nowMs();
  if(deferReview)ports.Interactions.notify({source:'session',key:'session-yield',tier:'news',cue:'session-moved',system:true,title:'Session continued on another device',message:'The timer here stopped. Any late progress on this device will be compared when the new owner’s session arrives.'});
  else ports.Interactions.notify({source:'session',key:'session-yield',tier:'news',cue:'session-moved',system:true,title:'Session continued on another device',message:'The timer here stopped. What this device recorded is kept for you under Needs review.',
    action:{label:'Review',opens:true,run:()=>void ports.KeptVersions.review()}});
  return true;
}
async function restoreSuspendedTodaySession():Promise<boolean>{
  if(!appCanMutate())return false;
  try{
    const loaded=await ports.AppData.activeSession.load(),session=loaded&&loaded.value||null;
    if(isPreviousActiveSessionRecord(session)){
      setSessionPanelMode('previous',session);
      setPlanStatus('This session belongs to a previous study day. Review it without restarting its timer.',false);
      return false;
    }
    if(!session||!isSuspendedActiveSession(session)){setPlanStatus('No suspended session is available to restore.',false);setSessionPanelMode('none');return false;}
    if(sessionFromElsewhere(session))return continueSessionHere();
    const restored=await ports.ActiveSessionRuntime.restoreSuspendedLocal(session);
    setSessionPanelMode('active',restored);
    setPlanStatus('✓ Suspended session restored.');
    ports.Interactions.notify({source:'session',kind:'success',key:'session-restore',cue:'resume',title:'Session restored',message:'Today’s suspended session is active again.'});
    await goTab('execute',{source:'session-restore'});
    return true;
  }catch(error){
    setPlanStatus('Could not restore today’s suspended session: '+(errorMessage(error)),false);
    return false;
  }
}
async function finishTodaySession(){
  if(!appCanMutate())return false;
  if(!TASKS.some(isTrackableBlock)){setPlanStatus('No active study plan is available to finish.',false);return false;}
  const accepted=await ports.Interactions.confirm({
    title:'Finish today and open Review?',
    message:'The live timer will stop and your current progress will be kept for Review.',
    details:['The current block is recorded as partial if it is still running.','Untouched future blocks remain unattempted; they are not marked skipped.','Nothing is added to Library until you choose Save Today to Library in Review.'],
    confirmLabel:'Finish today',cancelLabel:'Keep studying'
  });
  if(!accepted||!appCanMutate())return false;
  const rollbackSnapshot=ports.ActiveSessionRuntime.captureSnapshot();
  let completionNotice=null;
  try{
    const hadActiveTimer=TimerState.runtime&&TimerState.runtime.startMs!==null&&TimerState.currentIndex<TASKS.length&&isTrackableBlock(TASKS[TimerState.currentIndex]);
    if(hadActiveTimer)resolveActivePauseBeforeTimerSwitch();
    if(hadActiveTimer&&!isTaskResolved(TimerState.currentIndex)){
      const active=recordCurrentActiveToTask(TimerState.currentIndex,'partial');
      if(active>0&&TaskSessionState.getField(TimerState.currentIndex,'completion')===undefined){
        const pct=focusCompletionForTask(TimerState.currentIndex,actualTimeSnapshot(),{cap:99});
        if(pct!==null)storeResolvedCompletion(TimerState.currentIndex,{pct,source:COMPLETION_SOURCES.TIME});
      }
    }
    PracticePacer.pauseForSessionEnd({persist:false});
    TimerEngine.stopExecution();
    completionNotice=ports.NoticeCoordinator.begin({source:'timer',id:'execution',surface:'quiet',foreground:false});
    TimerState.runtime=TimerState.emptyRuntime();
    setTimerMode(TIMER_MODES.DONE,'manual-finish-day');
    resetBreakState();
    refreshCoreUi();
    await ports.ActiveSessionRuntime.writeCanonicalNow('finishing today’s session',{markChanged:true});
    setPlanStatus('Today is finished for this plan. Review the day and save it to Library when ready.');
    await goTab('review',{source:'finish-today'});
    ports.ReviewView.refresh({force:true});
    completionNotice.update({lifecycle:'succeeded',cue:'day-complete',occurrence:completionNotice.operationId});
    notifyBackupChange({urgent:true,reason:'finish-today'});
    return true;
  }catch(error){
    let rollbackError=null;
    if(rollbackSnapshot){
      try{await ports.ActiveSessionRuntime.rollbackLocalTransition(rollbackSnapshot,'finish-today-rollback');}
      catch(recoveryError){rollbackError=recoveryError;}
    }
    if(rollbackError&&TimerState.mode===TIMER_MODES.DONE)setTimerMode(TIMER_MODES.READY,'manual-finish-save-failed');
    refreshCoreUi();
    completionNotice?.update({lifecycle:'cancelled'});
    const base='Could not finish today safely: '+(errorMessage(error));
    setPlanStatus(rollbackError?base+' Rollback also failed: '+(errorMessage(rollbackError)):base+' The active runtime and recovery snapshot were restored.',false);
    return false;
  }
}
async function resetTodaySession(){
  const ok=await ports.Interactions.confirm({
    title:'Reset today’s active session?',danger:true,
    message:'This clears today’s loaded Plan progress and live recovery state.',
    details:['Timer audit, skips, completion marks and the live draft will be removed.','Saved Library Study Days and notes are unchanged.'],
    confirmLabel:'Reset today',cancelLabel:'Keep current session'
  });
  if(!ok||!appCanMutate())return false;
  try{
    await ports.ActiveSessionRuntime.resetLocal();
    setSessionPanelMode('none');
    refreshPlanAfterSessionReset();
    setPlanStatus('Today’s active session was reset. Paste, edit, or apply a schedule when ready.');
    ports.Interactions.notify({source:'session',kind:'success',key:'session-reset',title:'Today reset',message:'The active session was cleared; saved days and notes were kept.'});
    return true;
  }catch(e){
    setPlanStatus('Could not reset today’s session: '+(errorMessage(e)),false);
    return false;
  }
}
async function restoreSessionStateThroughLifecycle(importedSession:unknown,options:{keepRunning?:boolean}={}){
  const session=importedSession?ports.ActiveSessionCodec.sanitizeCurrent(importedSession):null;
  // A sync merge into the session running here keeps the timer running: when
  // the merged session has no timer (the other device had stopped), the
  // current block runs on here. A pause the other device made stays paused.
  const keepRunning=options.keepRunning===true&&TimerState.mode===TIMER_MODES.RUNNING&&!TimerState.paused;let runOn=false;
  const date=session&&isValidIsoDate(session.date)?session.date:todayISO();
  const snapshot=session?activeSessionSnapshot(session):null;
  if(session&&!snapshot)throw new Error('The rollback active-session snapshot is incompatible.');
  const result=await ports.SessionLifecycle.run('restore-journal-rollback',{
    scheduleIdentity:true,date,autoDate:date===todayISO(),sessionRevision:session&&session.revision||0,
    snapshotReview:snapshot&&snapshot.review
  },async()=>{
    if(session&&snapshot){
      const saved=await ports.ActiveSessionRuntime.saveCanonicalSession(session,'restoring an Active Session');
      if(isPreviousActiveSessionRecord(session)){
        resetRuntimeSessionState({lifecycleManaged:true,source:'restore-journal-rollback',date:todayISO()});
        ports.PlanDraftEditor.preview({silent:true,enterDraft:false});
        setSessionPanelMode('previous',session);
      }else if(session.status==='suspended'){
        resetRuntimeSessionState({lifecycleManaged:true,source:'restore-journal-rollback',date});
        ports.PlanDraftEditor.preview({silent:true,enterDraft:false});setSessionPanelMode('suspended',session);
        if(sessionFromElsewhere(session)&&isSuspendedActiveSession(session))ports.Interactions.notify({source:'session',key:'session-handoff',tier:'news',title:'Today’s session is ready',message:'It was suspended on another device. Continue it here when you are ready.',action:{label:'Continue here',run:()=>void continueSessionOnExecute('session-handoff')}});
      }else if(sessionRunsElsewhere(session)){
        resetRuntimeSessionState({lifecycleManaged:true,source:'restore-journal-rollback',date});
        ports.PlanDraftEditor.preview({silent:true,enterDraft:false});setSessionPanelMode('elsewhere',session);
      }else{
        const restored=applyStoredSessionSnapshot(session,snapshot,{source:'restore-journal-rollback',lifecycleManaged:true});
        if(restored===false)throw new Error('Rollback active-session runtime could not be applied.');
        setSessionPanelMode('active');
        runOn=keepRunning&&!snapshot.timerRuntime;
      }
      return saved;
    }
    const cleared=await ports.ActiveSessionRuntime.clearCanonical('restoring an empty Active Session');
    resetRuntimeSessionState({lifecycleManaged:true,source:'restore-journal-rollback',date});
    ports.PlanDraftEditor.preview({silent:true,enterDraft:false});setSessionPanelMode('none');
    return cleared;
  });
  const idx=TimerState.currentIndex;
  if(runOn&&!TimerState.runtime?.startMs&&idx<TASKS.length&&isTrackableBlock(TASKS[idx])&&!isTaskResolved(idx))TimerEngine.startCur();
  return result;
}
function verifyRestoredTimerRuntimeSemantics(expectedRuntime:TimerPayload|null){
  if(!expectedRuntime)return true;
  const expectedTaskId=String(expectedRuntime.taskId||''),expectedState=expectedRuntime.timerState&&typeof expectedRuntime.timerState==='object'?expectedRuntime.timerState:null;
  if(!expectedTaskId||!expectedState)throw new Error('Post-restore verification found an invalid backed-up timer runtime.');
  if(!TimerState.runtime||TimerState.runtime.startMs===null)throw new Error('Post-restore verification found that the backed-up timer is not active.');
  const actualTaskId=TaskIdentity.idAt(TimerState.currentIndex);
  if(actualTaskId!==expectedTaskId||TimerState.runtime.taskIdx!==TimerState.currentIndex)throw new Error('Post-restore verification found the timer on the wrong applied-plan task.');
  const expectedPaused=!!expectedRuntime.paused||expectedRuntime.mode===TIMER_MODES.PAUSED;
  if(expectedPaused){
    if(TimerState.mode!==TIMER_MODES.PAUSED||!TimerState.paused)throw new Error('Post-restore verification failed to preserve the paused timer state.');
  }else if(TimerState.mode!==TIMER_MODES.RUNNING||TimerState.paused){
    throw new Error('Post-restore verification failed to resume the backed-up running timer.');
  }
  if(Math.round(Number(TimerState.runtime.durationSec)||0)!==Math.round(Number(expectedState.durationSec)||0))throw new Error('Post-restore verification found a different timer duration.');
  if(Math.max(0,Math.round(Number(TimerState.runtime.recordedSec)||0))<Math.max(0,Math.round(Number(expectedState.recordedSec)||0)))throw new Error('Post-restore verification found regressed timer evidence.');
  if(expectedRuntime.pendingInactiveGap&&!TimerState.inactiveGap)throw new Error('Post-restore verification lost the backed-up inactive-gap state.');
  if(!expectedPaused&&!expectedRuntime.pendingInactiveGap&&expectedState.lastTickMs&&DecisionClock.nowMs()-Number(expectedState.lastTickMs)>SLEEP_GAP_THRESHOLD_MS&&!TimerState.inactiveGap){
    throw new Error('Post-restore verification failed to protect the cross-device inactive interval.');
  }
  if(expectedPaused&&expectedRuntime.activeBreak&&!TimerState.activeBreak)throw new Error('Post-restore verification lost the active break state.');
  return true;
}
async function verifyRestoredSessionRuntime(expected:unknown,scheduleText=''){
  const session=expected?ports.ActiveSessionCodec.sanitizeCurrent(expected):null;
  if(session&&session.status!=='suspended'&&!sessionRunsElsewhere(session)&&!isPreviousActiveSessionRecord(session)){
    const expectedFingerprint=activeSessionScheduleFingerprint(session);
    if(!TASKS.length||scheduleFingerprint()!==expectedFingerprint)throw new Error('Post-restore verification failed to apply the Active Session plan.');
    const expectedSnapshot=activeSessionSnapshot(session);
    if(!expectedSnapshot)throw new Error('Post-restore verification could not read the Active Session snapshot.');
    verifyRestoredTimerRuntimeSemantics(expectedSnapshot.timerRuntime);
  }else{
    // The working draft is independently verified through portable Plan data.
    if(TASKS.length||TimerState.mode!==TIMER_MODES.EMPTY)throw new Error('Post-restore verification found an unexpected live timer.');
  }
  return true;
}
function clearSessionSafetyMessage(match=''){
  if(!match||state.sessionSafetyMessage.includes(match)){state.sessionSafetyMessage='';refreshStorageFallbackWarning();}
}
function warnStorage(message:string){markStorageHealthError('activeSession',message);state.sessionSafetyMessage=message;refreshStorageFallbackWarning();}
function clearStorageWarning(message:string){if(state.sessionSafetyMessage===message)clearSessionSafetyMessage(message);}
function notifyNewerClaim(){
  const message='Another device runs a newer version of Study Director and may be running today’s session. The timer here stopped and your progress is saved. Update the app to continue here.';
  setPlanStatus(message,false);
  ports.Interactions.notify({source:'session',kind:'warning',key:'session-newer-claim',title:'Update the app to continue',message,action:{label:'Update app',opens:true,run:()=>void ports.checkUnsupportedUpdate()}});
}
function restoreSessionAction(){
  return state.sessionPanelMode==='previous'
    ? (TASKS.some(isTrackableBlock)?goTab('review',{source:'previous-day-review'}):revisitPreviousStoredSession())
    : state.sessionPanelMode==='elsewhere'?continueSessionHere():restoreSuspendedTodaySession();
}
function uploadSoonAfterPlanApply(result:boolean|PromiseLike<boolean>){
  const done=(applied:boolean)=>{if(applied)void Promise.resolve(ports.ActiveSessionRuntime.flushLiveDraft()).catch(error=>ports.AppDiagnostics.capture('backup.plan-apply-flush',error,'warn')).then(()=>notifyBackupChange({urgent:true,reason:'plan-apply'}));return applied;};
  return typeof result==='boolean'?done(result):Promise.resolve(result).then(done);
}
async function applyScheduleAction(){
  let takeover=null;
  if(state.sessionPanelMode==='elsewhere'&&!TASKS.length){
    const session=state.sessionPanelSession;
    if(!session||!await confirmSessionTakeover(session,{replace:true}))return false;
    try{takeover=await transferSessionOwnershipHere(session);}
    catch(error){setPlanStatus('Could not move today’s session here: '+errorMessage(error),false);return false;}
  }
  try{
    const result=await uploadSoonAfterPlanApply(ports.applySchedule(takeover?{source:'ownership-takeover'}:{}));
    if(result===false&&takeover)await attemptAutoRestoreActiveSession();
    return result;
  }finally{ports.schedulePwaUpdateEvaluation(250);}
}
return Object.freeze({clearSessionSafetyMessage,warnStorage,clearStorageWarning,notifyNewerClaim,restoreSessionAction,uploadSoonAfterPlanApply,applyScheduleAction,hasBlockingActiveSession,resumeTimerLoopAfterPrimaryRestore,loadActiveSessionForRestore,activeSessionScheduleFingerprint,applyStoredSessionSnapshot,hydratePrimaryStateFromStorage,handleActiveSessionRepositoryResult,restoreLiveDraftIfAny,activeSessionSnapshot,sessionRunsElsewhere,sessionFromElsewhere,isRestorableActiveSession,isSuspendedActiveSession,isPreviousActiveSessionRecord,savedDayCoversActiveSession,retireCoveredPreviousActiveSession,setSessionPanelMode,recoverPreviousSessionForReview,handlePreviousActiveSession,revisitPreviousStoredSession,attemptAutoRestoreActiveSession,resetRuntimeSessionState,refreshPlanAfterSessionReset,suspendTodaySession,sessionUpdateTime,sessionDevice,confirmSessionTakeover,transferSessionOwnershipHere,setSessionHandoff,sessionProgressSummary,sessionHandoffProblem,continueSessionHere,continueSessionOnExecute,yieldSessionToOtherDevice,restoreSuspendedTodaySession,finishTodaySession,resetTodaySession,restoreSessionStateThroughLifecycle,verifyRestoredTimerRuntimeSemantics,verifyRestoredSessionRuntime});
}
function createLifecycleViews(ports:Readonly<SessionLifecycleViewInput>){
const {document,NOTE_EDITOR_BINDING_VERSION,setTimeout,richTextClose,cancelPendingLiveDraftSave,advanceTaskNoteScheduleRevision,clearTaskNoteEditorBinding,isValidIsoDate,getReviewDate,refreshAllSubjectNoteFieldsFromRepository,refreshPnote,hydrateReviewState,refreshLibraryNotes,requestRender,appCanMutate,schedulePwaUpdateEvaluation}=ports;
function lifecycleEditorElements(){
  return [...document.querySelectorAll<HTMLInputElement|HTMLTextAreaElement|HTMLButtonElement>('.task-note-field,#daily-reflection,.quality-btn,#review-list input,#review-list textarea')];
}
function setLifecycleEditorsBlocked(blocked:boolean){
  lifecycleEditorElements().forEach(field=>{
    if(blocked){
      if(field.dataset['lifecycleWasDisabled']===undefined)field.dataset['lifecycleWasDisabled']=field.disabled?'1':'0';
      field.disabled=true;
      field.dataset['lifecycleBlocked']='1';
      return;
    }
    const wasDisabled=field.dataset['lifecycleWasDisabled']==='1';
    delete field.dataset['lifecycleWasDisabled'];delete field.dataset['lifecycleBlocked'];
    if(field.matches('.task-note-field'))field.disabled=field.dataset['noteBinding']!==NOTE_EDITOR_BINDING_VERSION;
    else if(field.id==='daily-reflection'||field.matches('.quality-btn'))field.disabled=false;
    else field.disabled=wasDisabled;
  });
}
function invalidateLifecycleEditors(context:SessionContext){
  void richTextClose();
  cancelPendingLiveDraftSave();
  if(context.options['scheduleIdentity'])advanceTaskNoteScheduleRevision();
  document.documentElement.dataset['studyDirectorLifecycle']='transitioning';
  document.documentElement.dataset['studyDirectorLifecycleRevision']=String(context.revision);
  setLifecycleEditorsBlocked(true);
  document.querySelectorAll<HTMLTextAreaElement>('.task-note-field').forEach(clearTaskNoteEditorBinding);
  const executeNote=document.querySelector<HTMLTextAreaElement>('#pn-extra');
  if(executeNote){clearTaskNoteEditorBinding(executeNote);executeNote.value='';}
  ports.invalidateProgressPanel();
  ports.ReviewEditor.invalidateBindings();
  ports.ReviewView.invalidate();
  const reviewList=document.getElementById('review-list');
  if(reviewList)reviewList.replaceChildren();
}
function reconcileLifecycleEditors(context:SessionContext){
  const options=context.options||{};
  const targetDate=typeof options['date']==='string'&&isValidIsoDate(options['date'])?options['date']:getReviewDate();
  const dd=document.querySelector<HTMLInputElement>('#day-date');
  if(dd&&isValidIsoDate(targetDate)){
    dd.value=targetDate;
    if(options['autoDate']!==undefined)dd.dataset['autoDate']=options['autoDate']?'1':'0';
  }
  refreshAllSubjectNoteFieldsFromRepository();
  refreshPnote({force:true});
  hydrateReviewState({date:targetDate,snapshotReview:options['snapshotReview'],source:context.kind});
  refreshLibraryNotes();
  ports.ReviewView.invalidate();
  if(document.getElementById('pane-review')?.classList.contains('on'))ports.ReviewView.refresh({force:true});
  requestRender('schedule','badges','header','realtime','recovery');
  return true;
}
function completeLifecycleTransition(context:SessionCompletion){
  const writable=!context.failed&&!!context.reconciled&&appCanMutate();
  setLifecycleEditorsBlocked(!writable);
  ports.ReviewView.syncMode();
  if(writable&&document.getElementById('pane-review')?.classList.contains('on'))ports.ReviewView.activate({restoreScroll:false});
  document.documentElement.dataset['studyDirectorLifecycle']=writable?'ready':(!context.failed&&context.reconciled?'read-only':'blocked');
  document.documentElement.dataset['studyDirectorLifecycleRevision']=String(context.revision);
  // A waiting update blocked by the transition retries now, not at the safety retry.
  // Deferred: start-up transitions finish before the update state is declared.
  setTimeout(()=>schedulePwaUpdateEvaluation(250),0);
}
return Object.freeze({lifecycleEditorElements,setLifecycleEditorsBlocked,invalidateLifecycleEditors,reconcileLifecycleEditors,completeLifecycleTransition});
}
const createModule=()=>Object.freeze({format:'study-director.session-actions-module' as const,contractVersion:1 as const,createController,createLifecycleViews});
registry.define('session-actions',1,createModule);return createModule;
})();
export type SessionActionsModule=ReturnType<typeof sdSessionActionsFactory>;
