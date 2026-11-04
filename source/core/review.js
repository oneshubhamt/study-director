(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,functionPort:functions}=registry.contracts;
registry.define('review',1,()=>{
  const freeze=Object.freeze;
  const PORT_FIELDS=freeze({
    notifications:freeze(['begin','feedback']),
    domain:freeze([
      'boundedInt','clampText','clampEditorContent','editorContentWithinLimits','plainTextContent','classifyTaskOutcome','cleanDayRevision','dailyRecordMetricsFromEvidence',
      'emptyTaskOutcomeCounts','finiteNumber','materializeDailyRecordView','normalizeCompletionSource',
      'normalizeDailyResultEntry','positiveMinutes','sanitizePracticeRuns','sanitizeTaskOutcomeCounts',
      'summarizeCleanPracticeRuns','taskAreaValue','taskMeasureValue','taskOutcomeInfo',
      'taskOutcomeSummaryText','taskOutcomeTotal','taskTargetValue'
    ]),
    presentation:freeze([
      'dateInsightsMeta','fmtS','formatPracticeMs','practicePaceBandLabel','prettyDate',
      'renderRichTextContent','setProgressSummary','studyMinuteToHHMM','textEl','timeLabelFromIso'
    ]),
    schedule:freeze([
      'adjustedEndMin','adjustedStartMin','effectiveNowMin','hasAdjustedTiming','isLiveTrackableTimer',
      'isTaskResolved','isTrackableBlock','isWorkBlock','latestTrackableEndMin','originalEndMin',
      'originalStartMin','scheduleFingerprint'
    ]),
    evidence:freeze([
      'actualRecordsSnapshot','applicableNotesForTask','clearManualCompletionOverride',
      'liveTaskOutcome','progressInputState','recordCurrentActiveToTask',
      'resolveTaskCompletion','storeResolvedCompletion','syncProgressInputsToState','updateTimerFocusMetrics'
    ]),
    session:freeze([
      'acknowledgeSavedStudyDay','clearCanonicalSessionAfterSavedDay',
      'cancelPendingLiveDraftSave','clearSaveReminder','flushLiveDraft','getLifecycleRevision','getOwnershipRevision','getReviewDate',
      'handleActiveSessionRepositoryResult','lifecycleCanWrite',
      'markDayContentChanged','markDayContentSaved','resetRuntimeSessionState','runLifecycle','runLifecycleSync','saveLiveDraft',
      'setReviewDateTitle','setSessionPanelMode','stopTimerExecution','appCanMutate',
      'writeLiveDraftNow'
    ]),
    notesDefaults:freeze([
      'noteStoredValueForKey','bindTaskNoteEditor','closeRichTextField','commitTaskNoteEditor','currentNoteEntriesForWorkTasks',
      'refreshPlanAfterSessionReset',
      'renderInheritedNotes','setPlanStatus','syncUnfinishedNoteDraft','unfinishedNoteDraftText'
    ]),
    view:freeze(['markStorageHealthTimestamp','notifyUser','on','refreshLibraryAfterSave','refreshStorageFallbackWarning','setStatus','updateBadges']),
    interactions:freeze(['confirm','notify']),
    environment:freeze(['cancelAnimationFrame','clearTimeout','requestAnimationFrame','setTimeout','todayISO'])
  });
  function createReviewSubsystem(input){
    if(!input||!Object.isFrozen(input))throw new TypeError('Review subsystem input must be frozen.');
    exactObject(input,['constants','services','runtime','ports'],'Review subsystem input');
    exactObject(input.constants,[
      'limits','dataContract','completionSources','taskOutcomes','timerModes'
    ],'Review constants');
    exactObject(input.services,[
      'appData','diagnostics','practicePacer','taskIdentity','taskSessionState','keyedRecord','evidenceGateway','dailyReflection','saveLane'
    ],'Review services');
    exactObject(input.runtime,[
      'tasks','sessionState','scheduleDerivedState','currentIndex','timerMode','isPaused','pendingGap',
      'carryForward','originalSchedule','setSafetyMessage'
    ],'Review runtime adapter');
    const ports=exactObject(input.ports,Object.keys(PORT_FIELDS),'Review ports');
    for(const [name,fields] of Object.entries(PORT_FIELDS))functions(ports[name],fields,'Review '+name+' port');
    const APP_LIMITS=input.constants.limits;
    const DATA_CONTRACT=input.constants.dataContract;
    const COMPLETION_SOURCES=input.constants.completionSources;
    const TASK_OUTCOMES=input.constants.taskOutcomes;
    const TIMER_MODES=input.constants.timerModes;
    const notifications=ports.notifications;
    const AppData=input.services.appData;
    const AppDiagnostics=input.services.diagnostics;
    const PracticePacer=input.services.practicePacer;
    const TaskIdentity=input.services.taskIdentity;
    const TaskSessionState=input.services.taskSessionState;
    const KeyedRecord=input.services.keyedRecord;
    const SessionEvidenceGateway=input.services.evidenceGateway;
    const DailyReflection=functions(input.services.dailyReflection,['commit','load'],'Review Daily Reflection service');
    const SaveLane=input.services.saveLane;
    if(!SaveLane||SaveLane.format!=='study-director.save-lane-module'||SaveLane.contractVersion!==1)throw new TypeError('Review save lane is unavailable or incompatible.');
    const Runtime=input.runtime;
    const TASKS=Runtime.tasks;
    const SessionState=Runtime.sessionState;
    const ScheduleDerivedState=Runtime.scheduleDerivedState;
    const {
      boundedInt,clampText,clampEditorContent,editorContentWithinLimits,plainTextContent,classifyTaskOutcome,cleanDayRevision,dailyRecordMetricsFromEvidence,
      emptyTaskOutcomeCounts,finiteNumber,materializeDailyRecordView,normalizeCompletionSource,
      normalizeDailyResultEntry,positiveMinutes,sanitizePracticeRuns,sanitizeTaskOutcomeCounts,
      summarizeCleanPracticeRuns,taskAreaValue,taskMeasureValue,taskOutcomeInfo,taskOutcomeSummaryText,
      taskOutcomeTotal,taskTargetValue
    }=ports.domain;
    const {
      dateInsightsMeta,fmtS,formatPracticeMs,practicePaceBandLabel,prettyDate,renderRichTextContent,
      setProgressSummary,studyMinuteToHHMM,textEl,timeLabelFromIso
    }=ports.presentation;
    const {
      adjustedEndMin,adjustedStartMin,effectiveNowMin,hasAdjustedTiming,isLiveTrackableTimer,
      isTaskResolved,isTrackableBlock,isWorkBlock,latestTrackableEndMin,originalEndMin,
      originalStartMin,scheduleFingerprint
    }=ports.schedule;
    const {
      actualRecordsSnapshot,applicableNotesForTask,clearManualCompletionOverride,
      liveTaskOutcome,progressInputState,recordCurrentActiveToTask,
      resolveTaskCompletion,storeResolvedCompletion,syncProgressInputsToState,updateTimerFocusMetrics
    }=ports.evidence;
    const {
      acknowledgeSavedStudyDay,clearCanonicalSessionAfterSavedDay,
      cancelPendingLiveDraftSave,clearSaveReminder,flushLiveDraft,getLifecycleRevision,getOwnershipRevision,getReviewDate,
      handleActiveSessionRepositoryResult,lifecycleCanWrite,
      markDayContentChanged,markDayContentSaved,resetRuntimeSessionState,runLifecycle,runLifecycleSync,saveLiveDraft,
      setReviewDateTitle,setSessionPanelMode,stopTimerExecution,appCanMutate,
      writeLiveDraftNow
    }=ports.session;
    const {
      noteStoredValueForKey,bindTaskNoteEditor,closeRichTextField,commitTaskNoteEditor,currentNoteEntriesForWorkTasks,
      refreshPlanAfterSessionReset,renderInheritedNotes,setPlanStatus,syncUnfinishedNoteDraft,unfinishedNoteDraftText
    }=ports.notesDefaults;
    const {markStorageHealthTimestamp,notifyUser,on,refreshLibraryAfterSave,refreshStorageFallbackWarning,setStatus,updateBadges}=ports.view;
    const {confirm,notify}=ports.interactions;
    const {cancelAnimationFrame,clearTimeout,requestAnimationFrame,setTimeout,todayISO}=ports.environment;
    let rolloverSaveInProgress=false;
    let saveDayInProgress=false;
    let activeSessionPersistenceBlocked=false;
    let currentReview=freeze({date:'',reflection:'',studyQuality:null,unfinished:''});
    let persistedReview=freeze({date:'',reflection:'',studyQuality:null});
    let reflectionOnlyState=freeze({date:'',canonical:'',recordKind:null});
    let reflectionOnlyHydration=0,reflectionOnlyLoading=false;
    const REVIEW_EDITOR_BINDING_VERSION='review-v2';
    const REVIEW_RICH_INPUT_META=Symbol.for('studyDirector.richValidatedInput.v1');

    function validReviewDate(value){
      const text=String(value||'');
      if(!/^\d{4}-\d{2}-\d{2}$/.test(text))return false;
      const parsed=new Date(text+'T00:00:00Z');
      return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===text;
    }
    function reviewDate(value){
      const requested=String(value||'');
      return validReviewDate(requested)?requested:getReviewDate();
    }
    function reflectionQuality(value){
      const parsed=Number(value);
      return Number.isInteger(parsed)&&parsed>=1&&parsed<=5?parsed:null;
    }
    function reviewRichInputMeta(event,value){
      const meta=event&&event[REVIEW_RICH_INPUT_META];
      return meta&&meta.format==='study-director.rich-validated-input'&&meta.version===1&&meta.canonical===String(value||'')&&typeof meta.plain==='string'?meta:null;
    }
    function normalizeReviewState(value,date=getReviewDate(),options={}){
      const target=reviewDate(date),source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
      const reflection=options.validatedRich===true?String(source.reflection||''):clampEditorContent(source.reflection||'',APP_LIMITS.maxReflectionChars);
      if(!editorContentWithinLimits(reflection))throw new RangeError(`Daily Reflection is limited to ${APP_LIMITS.maxRichTextWords.toLocaleString()} rich-text words.`);
      return freeze({date:target,reflection,studyQuality:reflectionQuality(source.studyQuality)});
    }
    function reviewBindingElements(){
      const box=document.getElementById('daily-reflection');
      return [box,...document.querySelectorAll('.quality-btn')].filter(Boolean);
    }
    function setReflectionRichSync(state,message){
      const box=document.getElementById('daily-reflection');if(!box)return false;
      const syncState=String(state||'saved'),syncStatus=String(message||'Saved'),indicator=document.getElementById('reflection-sync');
      box.dataset.richSyncState=syncState;box.dataset.richSyncStatus=syncStatus;
      if(indicator){
        const saving=syncState==='saving'||syncState==='busy',failed=syncState==='conflict'||syncState==='error',readOnly=syncState==='read-only';
        indicator.textContent=saving?'…':failed?'!':readOnly?'—':'✓';
        indicator.className=`note-sync ui-label${saving?' saving':failed?' err':readOnly?' idle':''}`;
        indicator.setAttribute('aria-label',syncStatus);
      }
      return true;
    }
    function bindReviewEditors(date=getReviewDate()){
      const target=reviewDate(date),owner=Number(getOwnershipRevision())||0,lifecycle=Number(getLifecycleRevision())||0;
      reviewBindingElements().forEach(field=>{
        field.dataset.reviewBinding=REVIEW_EDITOR_BINDING_VERSION;
        field.dataset.reviewDate=target;
        field.dataset.reviewOwnershipRevision=String(owner);
        field.dataset.reviewLifecycleRevision=String(lifecycle);
      });
      setReflectionRichSync(lifecycleCanWrite()?'saved':'read-only',lifecycleCanWrite()?'Saved':'Read-only');
      return true;
    }
    function invalidateReviewEditors(){
      reflectionOnlyHydration+=1;
      reviewBindingElements().forEach(field=>{
        ['reviewBinding','reviewDate','reviewOwnershipRevision','reviewLifecycleRevision','richSyncState','richSyncStatus'].forEach(key=>delete field.dataset[key]);
      });
      return true;
    }
    function reflectionEditorContent(date=getReviewDate()){
      const target=reviewDate(date),box=document.getElementById('daily-reflection');
      const current=String(box&&box.value||''),stored=persistedReview.date===target?String(persistedReview.reflection||''):'';
      return current===plainTextContent(stored)?stored:current;
    }
    function resolveReviewEditorBinding(date=getReviewDate(),event=null){
      if(!lifecycleCanWrite())return null;
      const target=reviewDate(date),box=document.getElementById('daily-reflection');
      if(!box||box.dataset.reviewBinding!==REVIEW_EDITOR_BINDING_VERSION||box.dataset.reviewDate!==target)return null;
      if(Number(box.dataset.reviewOwnershipRevision)!==Number(getOwnershipRevision())||Number(box.dataset.reviewLifecycleRevision)!==Number(getLifecycleRevision()))return null;
      const qualityFields=[...document.querySelectorAll('.quality-btn')];
      if(qualityFields.some(field=>field.dataset.reviewBinding!==REVIEW_EDITOR_BINDING_VERSION||field.dataset.reviewDate!==target||Number(field.dataset.reviewLifecycleRevision)!==Number(getLifecycleRevision())))return null;
      const trusted=reviewRichInputMeta(event,box.value);
      return normalizeReviewState({reflection:trusted?trusted.canonical:reflectionEditorContent(target),studyQuality:getStudyQuality()},target,{validatedRich:!!trusted});
    }
    function applyReviewState(value,date=getReviewDate()){
      const clean=normalizeReviewState(value,date);
      persistedReview=clean;
      const box=document.getElementById('daily-reflection');if(box)box.value=plainTextContent(clean.reflection);
      setStudyQuality(clean.studyQuality,{save:false});
      bindReviewEditors(clean.date);
      if(document.getElementById('pane-review')?.classList.contains('on'))ReviewView.sync();
      return clean;
    }
    function hydrateReviewState(options={}){
      const target=reviewDate(options.date||getReviewDate());
      const review=options.snapshotReview===undefined&&persistedReview.date===target?persistedReview:options.snapshotReview&&typeof options.snapshotReview==='object'?options.snapshotReview:{reflection:'',studyQuality:null};
      const dd=document.getElementById('day-date');if(dd&&dd.value!==target)dd.value=target;
      return applyReviewState(review,target);
    }
    function currentReviewState(){
      const date=getReviewDate(),bound=resolveReviewEditorBinding(date);
      const source=bound||normalizeReviewState(persistedReview.date===date?persistedReview:{reflection:'',studyQuality:null},date);
      if(bound)persistedReview=bound;
      currentReview=freeze({date,reflection:String(source.reflection||'').trim(),studyQuality:source.studyQuality,unfinished:clampText(unfinishedNoteDraftText(),APP_LIMITS.maxCarryForwardChars)});
      return currentReview;
    }
function reviewHasStudyDay(){return TASKS.some(isTrackableBlock);}
function getStudyQuality(){
  const active=document.querySelector('.quality-btn.on');
  if(!active)return null;
  const q=parseInt(active.dataset.q,10);
  return isNaN(q)?null:q;
}
function updateStudyQualitySummary(value=getStudyQuality()){
  const target=document.getElementById('review-study-quality-summary');
  if(target)target.textContent=Number.isInteger(value)&&value>=1&&value<=5?`${value}/5`:'Not rated';
}
function setStudyQuality(q,options={}){
  const val=reviewHasStudyDay()&&(q!==null&&q!==undefined&&q!=='')?Number(q):null;
  document.querySelectorAll('.quality-btn').forEach(btn=>{
    const selected=val!==null && Number(btn.dataset.q)===val;
    btn.classList.toggle('on',selected);
    if(btn.dataset.q!==''&&typeof btn.setAttribute==='function')btn.setAttribute('aria-pressed',selected?'true':'false');
  });
  updateStudyQualitySummary(val);
  if(options.save!==false&&reviewHasStudyDay())queueReviewSave();
}
function reflectionOnlyReady(date=getReviewDate()){return reflectionOnlyState.date===reviewDate(date);}
async function hydrateReflectionOnlyState(date=getReviewDate()){
  const target=reviewDate(date),token=++reflectionOnlyHydration;
  if(reviewHasStudyDay())return false;
  reflectionOnlyLoading=true;syncReviewSurfaceMode();setReflectionRichSync('busy','Loading reflection…');
  try{
    const loaded=await DailyReflection.load(target);
    if(token!==reflectionOnlyHydration)return false;
    if(reviewHasStudyDay()||reviewDate(getReviewDate())!==target){reflectionOnlyLoading=false;syncReviewSurfaceMode();return false;}
    reflectionOnlyState=freeze({date:target,canonical:String(loaded.canonical||''),recordKind:loaded.recordKind||null});
    reflectionOnlyLoading=false;
    applyReviewState({reflection:reflectionOnlyState.canonical,studyQuality:null},target);
    syncReviewSurfaceMode();return true;
  }catch(error){
    if(token===reflectionOnlyHydration){reflectionOnlyLoading=false;setReflectionRichSync('error','Reflection could not be loaded');syncReviewSurfaceMode();}
    AppDiagnostics.capture('review.reflection-only-load',error,'warn');return false;
  }
}
// Today's reflection saves through the shared save lane: into its Saved Day
// on a day without a study session, otherwise into the session. Each pending
// value names its date and store, so a date change mid-save still writes the
// right day.
async function writeReflection(pending,options={}){
  if(pending.mode==='session'){
    const result=await writeLiveDraftNow({markChanged:false,backupCapture:pending.backupCapture||options.backupCapture===true});
    if(!result||result.ok!==true)throw result&&result.error||new Error('the session could not be saved');
    return result;
  }
  const expected=reflectionOnlyState.date===pending.date?reflectionOnlyState.canonical:'';
  const saved=await DailyReflection.commit(pending.date,pending.reflection,{expectedCanonical:expected,backupCapture:pending.backupCapture||options.backupCapture===true});
  reflectionOnlyState=freeze({date:pending.date,canonical:String(saved.canonical||''),recordKind:saved.recordKind||null});
  if(reviewDate(getReviewDate())===pending.date){persistedReview=normalizeReviewState({reflection:reflectionOnlyState.canonical,studyQuality:null},pending.date,{validatedRich:true});syncReviewSurfaceMode();}
  markStorageHealthTimestamp('lastStudyDataSaveAt');await refreshLibraryAfterSave(pending.date);return saved;
}
function reflectionLaneState(state,error){
  if(state==='saving')setReflectionRichSync('saving','Saving…');
  else if(state==='saved')setReflectionRichSync('saved','Saved');
  else{setReflectionRichSync('error',SaveLane.failureMessage('Reflection',error));AppDiagnostics.capture('review.reflection-save',error,'warn');}
}
const reflectionLane=SaveLane.createLane(freeze({label:'Reflection',write:writeReflection,onState:reflectionLaneState,environment:freeze({setTimeout,clearTimeout})}));
function queueReflectionOnlySave(binding,options={}){
  if(!binding||!lifecycleCanWrite())return false;
  const clean=normalizeReviewState({reflection:binding.reflection,studyQuality:null},binding.date,{validatedRich:true});
  persistedReview=clean;reflectionLane.schedule(freeze({mode:'saved-day',date:clean.date,reflection:clean.reflection,backupCapture:options.backupCapture===true}));
  if(document.getElementById('pane-review')?.classList.contains('on'))ReviewView.sync();
  return true;
}
function flushReflectionOnlySave(options={}){
  const bound=resolveReviewEditorBinding(getReviewDate(),options.event||null);
  if(bound)reflectionLane.schedule(freeze({mode:'saved-day',date:bound.date,reflection:bound.reflection,backupCapture:options.backupCapture===true}));
  return reflectionLane.flush(options);
}
function persistReviewBinding(binding,options={}){
  if(!binding||!lifecycleCanWrite())return false;
  if(!reviewHasStudyDay())return queueReflectionOnlySave(binding,options);
  persistedReview=normalizeReviewState(binding,binding.date,{validatedRich:true});
  if(options.markChanged!==false)markDayContentChanged();
  if(document.getElementById('pane-review')?.classList.contains('on'))ReviewView.sync();
  reflectionLane.schedule(freeze({mode:'session',date:binding.date,backupCapture:options.backupCapture===true}));
  return true;
}
function saveReviewState(options={}){
  if(!lifecycleCanWrite())return false;
  const binding=resolveReviewEditorBinding(getReviewDate(),options.event||null);
  if(!binding){setReflectionRichSync('error','Save failed');if(options.strict)throw new Error('This Review editor is no longer bound to the current date.');return false;}
  return persistReviewBinding(binding,options);
}
function queueReviewSave(options={}){
  const binding=resolveReviewEditorBinding(getReviewDate(),options.event||options);
  if(!binding)return false;
  return persistReviewBinding(binding,options);
}
function flushPendingReviewSave(options={}){
  SaveLane.prepareFlush();
  if(!reviewHasStudyDay())return flushReflectionOnlySave(options);
  const binding=resolveReviewEditorBinding(getReviewDate(),options.event||null);
  if(binding)persistedReview=normalizeReviewState(binding,binding.date,{validatedRich:true});
  // The session is written at once, with its synchronous recovery copy; a
  // queued session save would only repeat it.
  if(reflectionLane.pending())reflectionLane.cancel();
  const result=flushLiveDraft({markChanged:false,backupCapture:options.backupCapture===true});
  return result===null?lifecycleCanWrite():true;
}
function reviewPersistenceCommitted(){setReflectionRichSync('saved','Saved');return true;}
function reviewPersistenceFailed(error){setReflectionRichSync('error','Save failed');if(error)AppDiagnostics.capture('review.active-session-save',error,'warn');return false;}
function selectReviewDate(){
  const dd=document.getElementById('day-date'),date=reviewDate(dd&&dd.value||getReviewDate());
  return runLifecycleSync('date-change',{date,review:true},()=>{if(dd){dd.value=date;dd.dataset.autoDate='0';}return true;});
}
function reviewSnapshot(){
  const state=currentReviewState();
  return freeze({reflection:state.reflection,studyQuality:state.studyQuality});
}
function reflectionContentForDate(date=getReviewDate()){
  const target=reviewDate(date);return target===getReviewDate()?String(currentReviewState().reflection||''):'';
}
function bindReviewSession(){return bindReviewEditors(getReviewDate());}

function syncReviewSurfaceMode(){
  const hasStudyDay=reviewHasStudyDay(),date=getReviewDate();
  const pane=document.getElementById('pane-review');
  if(pane)pane.dataset.reviewMode=hasStudyDay?'study':'reflection';
  [
    document.querySelector('#pane-review .review-stats'),
    document.getElementById('review-summary'),
    document.getElementById('practice-review'),
    document.querySelector('#pane-review .review-blocks-collapse')
  ].filter(Boolean).forEach(element=>{element.hidden=!hasStudyDay;});
  const quality=document.querySelector('#pane-review .quality-wrap');
  if(quality)quality.hidden=!hasStudyDay;
  document.querySelectorAll('.quality-btn').forEach(button=>{button.disabled=!hasStudyDay||!lifecycleCanWrite();});
  const copyControl=document.querySelector('#pane-review .copy-report-control');
  if(copyControl)copyControl.hidden=!hasStudyDay;
  const copyMain=document.querySelector('button[data-action="copy-review"]'),copyMenu=document.querySelector('button[data-action="toggle-copy-report-menu"]');
  if(copyMain)copyMain.disabled=!hasStudyDay;
  if(copyMenu)copyMenu.disabled=!hasStudyDay;
  if(!hasStudyDay)closeCopyReportMenu();
  const reflection=document.getElementById('daily-reflection'),ready=hasStudyDay||(reflectionOnlyReady(date)&&!reflectionOnlyLoading);
  if(reflection)reflection.disabled=!lifecycleCanWrite()||!ready;
  const saveBtn=document.querySelector('button[data-action="save-day"]');
  if(saveBtn)saveBtn.disabled=saveDayInProgress||!lifecycleCanWrite()||(!hasStudyDay&&!ready);
  return hasStudyDay;
}
function syncReviewDateMode(){
  const date=getReviewDate(),hasStudyDay=syncReviewSurfaceMode();
  const kicker=document.getElementById('review-kicker');
  const summaryTitle=document.getElementById('review-summary-title');
  const saveBtn=document.querySelector('button[data-action="save-day"]');
  const copyBtn=document.querySelector('button[data-action="copy-review"]');
  const isToday=date===todayISO();
  const label=isToday?'Today':prettyDate(date);
  const journalDateLabel=document.getElementById('journal-date-label');
  if(kicker)kicker.textContent=hasStudyDay?(isToday?'Today Review':`Review · ${label}`):(isToday?'Today Reflection':`Reflection · ${label}`);
  if(summaryTitle)summaryTitle.textContent=isToday?'Today Summary':`Summary · ${label}`;
  if(journalDateLabel)journalDateLabel.textContent=label;
  if(saveBtn)saveBtn.textContent=hasStudyDay?(isToday?'◆ Save Today to Library':'◆ Save This Date to Library'):'◆ Save Reflection';
  if(copyBtn)copyBtn.disabled=!hasStudyDay;
  if(hasStudyDay)syncCopyReportCustom();else closeCopyReportMenu();
  setReviewDateTitle(date);
}

function captureReviewInputs(){
  TASKS.forEach((t,i)=>{
    if(!isTrackableBlock(t))return;
    const di=document.getElementById(`rd-done-${i}`),ti=document.getElementById(`rd-total-${i}`);
    if(di||ti){
      const progress=TaskSessionState.getField(i,'notes');
    const state=progressInputState(i,di?di.value:progress?.done,ti?ti.value:progress?.total,taskTargetValue(t));
      syncProgressInputsToState(i,state,{updateUI:false,save:false});
    }
  });
}
function captureTodayState(){
  syncUnfinishedNoteDraft();
  clearFutureUntouchedProgress();
  saveReviewState({markChanged:false,strict:true});
  saveLiveDraft();
}
function projectDailyRecord(evidence,review){
  if(!evidence||!Object.isFrozen(evidence)||!Array.isArray(evidence.reviewTasks)){
    throw new TypeError('ReviewModel requires a frozen SessionEvidenceGateway snapshot.');
  }
  if(!review||!Object.isFrozen(review))throw new TypeError('ReviewModel requires a frozen ReviewEditor state.');
  const schedule=evidence.reviewTasks.map(row=>({
    id:row.id,start:row.originalStart,duration:row.duration,
    name:row.name,kind:row.kind,area:row.area,measure:row.measure,target:row.target
  }));
  const results=KeyedRecord.create();
  evidence.reviewTasks.forEach(row=>{
    if(!row.trackable||!schedule[row.idx])return;
    const raw={
      completion:row.completion,completionSource:row.completionSource,
      done:row.progress.done??null,total:row.progress.total??null,actualSeconds:row.actualSeconds,
      actualStart:row.clock.startedAt||row.actualRecord.firstStartedAt||null,
      actualEnd:row.clock.endedAt||row.actualRecord.lastEndedAt||null,
      actualStartLocalMinute:Number.isInteger(Number(row.clock.startedAtLocalMinute))?Number(row.clock.startedAtLocalMinute):null,
      actualStartUtcOffsetMinutes:Number.isInteger(Number(row.clock.startedAtUtcOffsetMinutes))?Number(row.clock.startedAtUtcOffsetMinutes):null,
      actualStartTimeZone:clampText(row.clock.startedAtTimeZone||'',80)||null,
      pauseEvents:Array.isArray(row.actualRecord.pauseEvents)?row.actualRecord.pauseEvents.slice(0,1000).map(ev=>({...ev})):[],
      sessionCount:Math.max(Number(row.actualRecord.sessionCount)||0,Array.isArray(row.actualRecord.sessions)?row.actualRecord.sessions.length:0),
      skipped:row.resolvedState==='skipped',doneFlag:row.resolvedState==='done'
    };
    if(row.shifted)raw.adjustedStart=row.adjustedStart;
    const clean=normalizeDailyResultEntry(raw,schedule[row.idx]);
    if(clean)results[row.id]=clean;
  });
  const savedAt=new Date().toISOString();
  return {
    version:DATA_CONTRACT.schemas.DailyRecord.version,recordKind:'study',date:evidence.date,
    savedAt,updatedAt:savedAt,quote:evidence.quote,reflection:review.reflection,studyQuality:review.studyQuality,
    realTimeSnapshot:evidence.realTimeSnapshot,sourceRevision:evidence.contentRevision,
    schedule,results,practiceRuns:evidence.practiceRuns,carryForwardDraft:review.unfinished
  };
}
function buildDailyRecord(evidence=SessionEvidenceGateway.snapshot({includeRecords:true}),review=currentReviewState()){
  return projectDailyRecord(evidence,review);
}
async function commitDailyRecord(evidence=SessionEvidenceGateway.snapshot({includeRecords:true}),label='canonical daily record'){
  const review=currentReviewState();
  let doc=projectDailyRecord(evidence,review);
  const existing=await AppData.dailyRecords.get(doc.date);
  if(existing?.recordKind==='diary'){
    const existingReflection=String(existing.reflection||''),reviewReflection=String(doc.reflection||'');
    if(existingReflection.trim()&&reviewReflection.trim()&&existingReflection!==reviewReflection)throw new Error('A different reflection already exists for this date. Open Diary and resolve it before saving the Study Day.');
    if(existingReflection.trim()&&!reviewReflection.trim())doc={...doc,reflection:existingReflection};
  }
  const rec=materializeDailyRecordView(doc);
  if(!rec)throw new Error('Could not materialize the '+label);
  const receipt=await AppData.dailyRecords.save(doc);
  if(receipt?.storage!=='indexeddb'){
    throw new Error('The Study Day reached only emergency recovery storage, not canonical IndexedDB. The recovery copy remains available; retry when storage recovers.');
  }
  await AppData.dailyRecords.verifyCanonical(doc);
  return freeze({doc,rec});
}
async function saveReflectionOnlyRecord(){
  if(saveDayInProgress)return false;
  if(!appCanMutate()){setStatus('save-status','Study control is in another tab. Take control here before saving.',false);return false;}
  if(!reflectionOnlyReady(getReviewDate())){setStatus('save-status','Reflection is still loading. Try again after it finishes.',false);return false;}
  const binding=resolveReviewEditorBinding(getReviewDate());
  if(!binding){setStatus('save-status','This Reflection editor is no longer bound to the current date.',false);return false;}
  const saveButton=document.querySelector('[data-action="save-day"]');
  saveDayInProgress=true;if(saveButton)saveButton.disabled=true;
  const notice=notifications.begin({id:'save-reflection',surfaceId:'save-status',title:'Save reflection',message:'Saving reflection…'});
  let committed=false;
  try{
    const saved=await flushReflectionOnlySave();
    const hasContent=!!String(saved?.canonical||'').trim();committed=true;
    ReviewView.sync();
    notice.finish('succeeded',hasContent?'✓ Reflection saved in Diary.':'No reflection saved. Empty reflections are not kept in Diary.',{announce:hasContent,title:'Reflection saved'});return true;
  }catch(error){
    notice.finish('failed',(committed?'Reflection saved locally; refreshing the view failed. ':'Could not save reflection. Keep this tab open and retry after storage recovers. ')+(error&&error.message||error),{title:committed?'Reflection saved; follow-up needs attention':'Reflection not saved',outcome:committed?'local-save-completed':'local-save-failed'});
    return false;
  }finally{
    saveDayInProgress=false;
    syncReviewSurfaceMode();
  }
}
async function saveDayRecord(){
  if(!reviewHasStudyDay())return saveReflectionOnlyRecord();
  if(saveDayInProgress)return false;
  if(!appCanMutate()){setStatus('save-status','Study control is in another tab. Take control here before saving.',false);return false;}
  const saveButton=document.querySelector('[data-action="save-day"]');
  saveDayInProgress=true;if(saveButton)saveButton.disabled=true;
  const notice=notifications.begin({id:'save-study-day',surfaceId:'save-status',title:'Save Study Day',message:'Saving this day…'});
  let committed=null;
  const closesPriorDay=SessionEvidenceGateway.snapshot({includeRecords:false}).date<todayISO();
  if(closesPriorDay){
    activeSessionPersistenceBlocked=true;
    stopTimerExecution();
    cancelPendingLiveDraftSave();
  }
  try{
    PracticePacer.finalizeForDayClose();
    captureTodayState();
    await flushLiveDraft();
    const metrics=ReviewView.refresh({includeRecords:true,force:true});
    const {doc,rec}=await commitDailyRecord(metrics.evidence,'canonical daily record');committed=rec;
    markStorageHealthTimestamp('lastStudyDataSaveAt');
    if(!closesPriorDay)await acknowledgeSavedStudyDay(rec.date,doc.sourceRevision);
    await refreshLibraryAfterSave(rec.date);
    ReviewView.sync();
    if(closesPriorDay){
      await clearCanonicalSessionAfterSavedDay();
      clearSaveReminder(rec.date,doc.sourceRevision);
      Runtime.setSafetyMessage(`Recovered ${prettyDate(rec.date)} was saved to Library. Apply the current study-day schedule when ready.`);
      resetRuntimeSessionState({source:'recovered-day-close',date:todayISO()});
      clearReviewForNewDay();
      setSessionPanelMode('none');
      refreshPlanAfterSessionReset('Recovered previous study day was saved. Apply the current study-day schedule when ready.','New Study Day');
      setPlanStatus('Recovered previous study day saved. Apply the current study-day schedule when ready.');
      refreshStorageFallbackWarning();
    }
    notice.finish('succeeded',`✓ Saved ${prettyDate(rec.date)} · completed equivalent ${durationLabel(rec.completedEquivalentMinutes)} · actual focus ${durationLabel(rec.actualFocusMinutes)} · ${displayPercent(rec.completionPercent)}`);
  }catch(e){
    notice.finish('failed',(committed?'Study Day saved locally in Library; follow-up did not complete. Keep this tab open and review the saved record. ':'Could not save this Study Day. Keep this tab open and retry after storage recovers. ')+(e&&e.message?e.message:e),{title:committed?'Study Day saved; follow-up needs attention':'Study Day not saved',outcome:committed?'local-save-completed':'local-save-failed'});
    return false;
  }finally{activeSessionPersistenceBlocked=false;saveDayInProgress=false;syncReviewSurfaceMode();}
  return true;
}
/* ROLLOVER SAVE ORCHESTRATION */
function hasSaveableStudyDay(){
  return TASKS.some(isTrackableBlock);
}
function clearReviewForNewDay(options={}){
  const date=todayISO();
  const apply=()=>{
    const dd=document.getElementById('day-date');
    if(dd){dd.value=date;dd.dataset.autoDate='1';}
    syncReviewDateMode();
    return true;
  };
  return options.lifecycleManaged?apply():runLifecycleSync('date-rollover',{date,review:true},apply);
}
function studyDayRolledOver(now=new Date()){
  return !!(SessionState.studyDate&&SessionState.studyDate!==todayISO(now));
}
async function handleStudyDayRollover(){
  if(rolloverSaveInProgress||!appCanMutate())return false;
  if(!studyDayRolledOver())return false;
  activeSessionPersistenceBlocked=true;
  stopTimerExecution();
  cancelPendingLiveDraftSave();
  rolloverSaveInProgress=true;
  const endedDate=SessionState.studyDate;
  let savedDay=null;
  try{
    if(hasSaveableStudyDay()){
      if(isLiveTrackableTimer())recordCurrentActiveToTask(Runtime.currentIndex(),'partial');
      PracticePacer.finalizeForDayClose();
      captureReviewInputs();
      syncUnfinishedNoteDraft();
      saveReviewState({markChanged:false,strict:true});
      await flushLiveDraft();
      const {doc,rec}=await commitDailyRecord(SessionEvidenceGateway.snapshot({includeRecords:true}),'canonical rollover record');
      savedDay={date:rec.date,revision:doc.sourceRevision};
      markStorageHealthTimestamp('lastStudyDataSaveAt');
    }else{
      Runtime.setSafetyMessage('New study day: no schedule was loaded, so no Study Day record was created. Apply today’s schedule when ready.');
    }
    await runLifecycle('study-day-rollover',{
      scheduleIdentity:true,date:todayISO(),autoDate:true,review:true
    },async()=>{
      await clearCanonicalSessionAfterSavedDay();
      resetRuntimeSessionState({lifecycleManaged:true,source:'study-day-rollover',date:todayISO()});
      clearReviewForNewDay({lifecycleManaged:true});
      setSessionPanelMode('none');
      refreshPlanAfterSessionReset('Previous study day is closed. Apply today’s schedule when ready.','New Study Day');
      setPlanStatus('New study day ready. Apply today’s schedule when ready.');
      refreshStorageFallbackWarning();
      return true;
    });
    if(savedDay){
      markDayContentSaved(savedDay.date,savedDay.revision);
      notifyUser('Study day auto-saved',`${prettyDate(endedDate)} was saved to Library. Apply today’s schedule when ready.`,`sdm-rollover-${endedDate}`);
      Runtime.setSafetyMessage(`New study day: ${prettyDate(endedDate)} was auto-saved to Library. Apply today’s schedule when ready.`);
    }
    return true;
  }catch(e){
    AppDiagnostics.capture('session.rollover-save',e,'error');
    Runtime.setSafetyMessage(savedDay
      ? `Saved ${prettyDate(endedDate)} to Library, but its old session could not be finalized: ${(e&&e.message)||e}. Keep the recovery data and retry after storage recovers.`
      : `New study day safety check could not auto-save ${prettyDate(endedDate)}: ${(e&&e.message)||e}. Open Review and save manually before starting a new day.`);
    refreshStorageFallbackWarning();
    return false;
  }finally{
    rolloverSaveInProgress=false;
    activeSessionPersistenceBlocked=false;
  }
}

function reviewRichInputPlain(event,value){
  const meta=reviewRichInputMeta(event,value);
  return meta?meta.plain:plainTextContent(value);
}
const REVIEW_PROGRESS_TONE_CLASSES=Object.freeze(['pct-tone-zero','pct-tone-low','pct-tone-mid','pct-tone-high','pct-tone-complete']);
function reviewProgressToneClass(p){
  if(p<=0)return'pct-tone-zero';
  if(p<=25)return'pct-tone-low';
  if(p<=50)return'pct-tone-mid';
  if(p<=75)return'pct-tone-high';
  return'pct-tone-complete';
}

function applyReviewProgressVisual(card,pct){
  if(!card)return;
  card.classList.remove(...REVIEW_PROGRESS_TONE_CLASSES);
  card.classList.add(reviewProgressToneClass(pct));
}
function applyReviewOutcomeVisual(card,outcome){
  if(!card)return;
  card.classList.remove(...Object.values(TASK_OUTCOMES));
  card.classList.add(outcome);
}
function setCompletionState(idx,pct,source=COMPLETION_SOURCES.MANUAL){
  storeResolvedCompletion(idx,{pct,source,preserveDone:TaskSessionState.isDone(idx)&&!TaskSessionState.isSkipped(idx)});
  if(Number(pct)>=100)TaskSessionState.setResolved(idx,'done');
  else if(TaskSessionState.isSkipped(idx)&&Number(pct)>0)TaskSessionState.setResolved(idx,null);
}
function renderCompletionChange(idx,pct,refreshStats=true,options={}){
  const card=document.getElementById(`rcard-${idx}`);
  applyReviewProgressVisual(card,pct);
  const outcome=liveTaskOutcome(idx,{exactPct:pct});
  applyReviewOutcomeVisual(card,outcome);
  const statusInfo=taskOutcomeInfo(outcome);
  const statusBadge=card?card.querySelector('[data-badge="status"]'):null;
  if(statusBadge){statusBadge.textContent=statusInfo.label;statusBadge.className='rcard-badge ui-mono '+statusInfo.status;}
  const source=resolveTaskCompletion(idx).source;
  const sourceBadge=card?card.querySelector('[data-badge="source"]'):null;
  if(sourceBadge)sourceBadge.textContent=completionSourceLabel(source);
  const rd=document.getElementById(`rpct-${idx}`);
  if(rd)rd.textContent=displayPercent(pct);
  const pctInput=document.getElementById(`rd-pct-${idx}`);
  if(pctInput)pctInput.value=source!==COMPLETION_SOURCES.NONE?Math.round(pct):'';
  const sourceLine=document.getElementById(`rsource-${idx}`);
  if(sourceLine)sourceLine.textContent=completionSourceDescription(source,pct);
  if(idx===Runtime.currentIndex()&&options.syncTimer!==false){
    const pbar=document.getElementById('pbar');
    if(pbar)pbar.style.width=pct+'%';
    const pns=document.getElementById('pn-sum');
    if(pns)pns.replaceChildren(textEl('span','hi',displayPercent(pct)),document.createTextNode(options.timerSummary||' set via review'));
  }
  if(refreshStats){recalcStats();updateBadges();}
}
function setCompletion(idx,pct,updateUI,source=COMPLETION_SOURCES.MANUAL){
  setCompletionState(idx,pct,source);
  saveLiveDraft();
  if(updateUI)renderCompletionChange(idx,pct,true);
}
/* REVIEW/TIMER UI BRIDGE */
function syncRptFromTimer(idx,pct,done,total){
  renderCompletionChange(idx,pct,false,{syncTimer:false});
  const rdi=document.getElementById(`rd-done-${idx}`);const rti=document.getElementById(`rd-total-${idx}`);
  if(rdi)rdi.value=done!==null&&done!==undefined?done:'';
  if(rti)rti.value=total!==null&&total!==undefined?total:'';
  refreshRsum(idx,taskMeasureValue(TASKS[idx],'units'),done,total);
}
function durationLabel(min){
  const n=Math.round(Math.abs(min||0));
  const h=Math.floor(n/60);
  const m=n%60;
  if(h&&m)return `${h}h ${m}m`;
  if(h)return `${h}h`;
  return `${m}m`;
}
function displayPercent(value){
  const bounded=Math.max(0,Math.min(100,Number(value)||0));
  return `${Math.round((bounded+Number.EPSILON)*100)/100}%`;
}
function optionalDurationLabel(value){
  return value===null||value===undefined||!Number.isFinite(Number(value))?'—':durationLabel(Number(value));
}
function optionalPercentLabel(value){
  return value===null||value===undefined||!Number.isFinite(Number(value))?'—':displayPercent(Number(value));
}
function signedHoursLabel(min){
  const n=Math.round(min||0);
  if(n===0)return '0m';
  return (n>0?'+':'-')+durationLabel(n);
}
function calculateReviewMetrics(evidence){
  if(!evidence||!Object.isFrozen(evidence)||!Array.isArray(evidence.reviewTasks)){
    throw new TypeError('ReviewModel requires a frozen SessionEvidenceGateway snapshot.');
  }
  const workBlocks=evidence.reviewTasks.filter(row=>row.work);
  const completions=workBlocks.map(row=>row.completion);
  const originalPlannedStudyMinutes=workBlocks.reduce((sum,row)=>sum+row.duration,0);
  const completedEquivalentMinutes=workBlocks.reduce((sum,row)=>sum+(row.duration*row.completion/100),0);
  const actualFocusMinutes=workBlocks.reduce((sum,row)=>sum+((row.actualSeconds||0)/60),0);
  const completionPercent=originalPlannedStudyMinutes?(completedEquivalentMinutes/originalPlannedStudyMinutes*100):0;
  const averageBlockCompletion=workBlocks.length?(completions.reduce((a,b)=>a+b,0)/workBlocks.length):0;
  const actualVsPlannedMinutes=actualFocusMinutes-originalPlannedStudyMinutes;
  const actualVsCompletedMinutes=actualFocusMinutes-completedEquivalentMinutes;
  const scheduleShifts=workBlocks.map(row=>row.adjustedStartMin-row.originalStartMin).filter(Boolean);
  const shiftedStudyBlocks=scheduleShifts.length;
  const totalScheduleShiftMinutes=shiftedStudyBlocks?Math.max(...scheduleShifts.map(Math.abs)):0;
  const netScheduleShiftMinutes=shiftedStudyBlocks?Math.round(scheduleShifts.reduce((a,b)=>a+b,0)/shiftedStudyBlocks):0;
  const outcomeCounts=emptyTaskOutcomeCounts();
  workBlocks.forEach(row=>{outcomeCounts[row.outcome]+=1;});
  return {
    evidence,workBlocks,completions,outcomeCounts,originalPlannedStudyMinutes,completedEquivalentMinutes,
    actualFocusMinutes,completionPercent,averageBlockCompletion,actualVsPlannedMinutes,actualVsCompletedMinutes,
    shiftedStudyBlocks,totalScheduleShiftMinutes,netScheduleShiftMinutes
  };
}
function calculateCurrentReviewMetrics(evidence=SessionEvidenceGateway.snapshot({includeRecords:false})){
  return calculateReviewMetrics(evidence);
}
function setMetricText(id,value){const el=document.getElementById(id);if(el)el.textContent=value;}
function setMetricCardState(id,state){
  const el=document.getElementById(id);if(!el)return;
  el.classList.remove('warn','ok','info','primary');
  if(state)el.classList.add(state);
}
function updateReviewMetrics(metrics=null){
  const m=metrics||calculateCurrentReviewMetrics();
  setMetricText('review-original-planned',durationLabel(m.originalPlannedStudyMinutes));
  setMetricText('review-completed-equivalent',durationLabel(m.completedEquivalentMinutes));
  setMetricText('review-actual-focus',durationLabel(m.actualFocusMinutes));
  setMetricText('review-completion-rate',displayPercent(m.completionPercent));
  setMetricText('review-time-delta',signedHoursLabel(m.actualVsPlannedMinutes));
  setMetricText('review-schedule-shift',m.shiftedStudyBlocks?`${m.shiftedStudyBlocks} ${m.shiftedStudyBlocks===1?'block':'blocks'}`:'No shifts');
  setMetricText('review-block-outcomes',taskOutcomeSummaryText(m.outcomeCounts));
  setMetricText('review-average-block',displayPercent(m.averageBlockCompletion));
  updateStudyQualitySummary();
  const td=document.getElementById('review-time-delta-sub');
  if(td)td.textContent=m.actualVsPlannedMinutes===0?'Actual focus exactly matches original planned work.':(m.actualVsPlannedMinutes>0?'Extra focus beyond original planned duration.':'Less actual focus than original planned duration.');
  const ss=document.getElementById('review-schedule-shift-sub');
  if(ss)ss.textContent=m.shiftedStudyBlocks?`${durationLabel(m.totalScheduleShiftMinutes)} largest movement · typical net ${signedHoursLabel(m.netScheduleShiftMinutes)}`:'No adjusted work-block movement from original schedule.';
  setMetricCardState('review-time-delta-card',m.actualVsPlannedMinutes<0?'warn':(m.actualVsPlannedMinutes>0?'ok':''));
  setMetricCardState('review-schedule-shift-card',m.shiftedStudyBlocks?'warn':'');
  updateReviewPomodoroLine();
  updateTimerFocusMetrics(m);
  return m;
}
const COMPLETION_SOURCE_INFO=Object.freeze({
  [COMPLETION_SOURCES.UNITS]:Object.freeze({label:'Units',description:'Completion source: Done/Total progress.'}),
  [COMPLETION_SOURCES.MANUAL]:Object.freeze({label:'Manual %',description:'Completion source: manually edited percentage.'}),
  [COMPLETION_SOURCES.TIME]:Object.freeze({label:'Auto from focus',description:pct=>`Completion source: actual focus time fallback (${displayPercent(pct)}). Edit if this overstates or understates progress.`}),
  [COMPLETION_SOURCES.FINISHED_TIME]:Object.freeze({label:'Finished · focus-based',description:pct=>`Completion source: finished block using actual focus time (${displayPercent(pct)}). Edit if academic progress differed.`}),
  [COMPLETION_SOURCES.FINISHED_UNVERIFIED]:Object.freeze({label:'Finished · unverified',description:'Completion source: finished status only. No focus/progress evidence yet, so it is not counted as completed work.'}),
  [COMPLETION_SOURCES.SKIPPED]:Object.freeze({label:'Skipped',description:'Completion source: skipped block, counted as 0%.'})
});
function completionSourceLabel(source){return COMPLETION_SOURCE_INFO[normalizeCompletionSource(source)]?.label||'No source';}
function completionSourceDescription(source,pct){
  const description=COMPLETION_SOURCE_INFO[normalizeCompletionSource(source)]?.description;
  return typeof description==='function'?description(pct):(description||'');
}
function appendReviewBadge(container,label,cls){
  const b=document.createElement('span');
  b.className='rcard-badge ui-mono '+(cls||'');
  b.textContent=label;
  container.appendChild(b);
  return b;
}
function createTimeChip(label,value,className='',muted=false){
  const chip=textEl('div','time-chip ui-card '+className+(muted?' muted':''));
  chip.append(textEl('span','tl ui-label',label),textEl('span','tv ui-mono',value));
  return chip;
}
function createTaskReviewHeader({name,area,pct,statusInfo,shifted=false,tracked=false,pctId='',source=''}) {
  const top=document.createElement('div');top.className='rcard-top';
  const nw=document.createElement('div');
  nw.append(textEl('div','rcard-name ui-label',name||'Task'),textEl('div','rcard-area ui-label',area||'—'));
  const badges=document.createElement('div');badges.className='rcard-badges';
  const statusBadge=appendReviewBadge(badges,statusInfo.label,statusInfo.status);
  statusBadge.dataset.badge='status';
  if(source&&normalizeCompletionSource(source)!==COMPLETION_SOURCES.NONE){
    const sourceBadge=appendReviewBadge(badges,completionSourceLabel(source),'muted');
    sourceBadge.dataset.badge='source';
  }
  if(shifted)appendReviewBadge(badges,'Shifted','shifted');
  appendReviewBadge(badges,tracked?'Tracked':'Not tracked',tracked?'tracked':'muted');
  nw.appendChild(badges);
  const pd=document.createElement('div');pd.className='rcard-pct ui-mono';
  if(pctId)pd.id=pctId;
  pd.textContent=optionalPercentLabel(pct);
  top.appendChild(nw);top.appendChild(pd);
  return top;
}
function createActualFocusChip(actualSec,deltaSec=null){
  const chip=textEl('div','time-chip ui-card actual');
  const actualValue=textEl('span','tv ui-mono',fmtS(finiteNumber(actualSec))+' ');
  if(deltaSec!==null&&deltaSec!==undefined){
    const delta=finiteNumber(deltaSec);
    const deltaCls=delta>0?'delta-plus':delta<0?'delta-minus':'delta-neutral';
    const sign=delta>0?'+':delta<0?'-':'±';
    actualValue.appendChild(textEl('span',deltaCls,`(${sign}${fmtS(Math.abs(delta))})`));
  }
  chip.append(textEl('span','tl ui-label','ACTUAL FOCUS'),actualValue);
  return chip;
}
function createTaskTimingRow({original,adjusted,shifted=false,actualSec=null,deltaSec=null,wallStart='',wallEnd=''}) {
  const timingRow=document.createElement('div');
  timingRow.className='rtiming ui-mono timing-grid';
  const tracked=actualSec!==null&&actualSec!==undefined;
  const actualChip=tracked?createActualFocusChip(actualSec,deltaSec):createTimeChip('ACTUAL FOCUS','Not tracked','actual',true);
  const wallChip=tracked?createTimeChip('WALL CLOCK',`${timeLabelFromIso(wallStart)||'—'}-${timeLabelFromIso(wallEnd)||'—'}`,'wall'):createTimeChip('WALL CLOCK','—','wall');
  timingRow.append(
    createTimeChip('ORIGINAL',original),
    createTimeChip(shifted?'ADJUSTED':'CURRENT PLAN',adjusted+(shifted?' · moved':''),'current '+(shifted?'shifted':'')),
    actualChip,
    wallChip
  );
  return timingRow;
}
function createStaticProgressLine({done,total,measure,suffixNoTotal=' done · no target'}) {
  const sm=document.createElement('div');sm.className='rsum ui-body';
  if(done!==undefined&&total)setProgressSummary(sm,done,total,measure||'units');
  else if(done!==undefined)setProgressSummary(sm,done,0,measure||'units',suffixNoTotal,true);
  else sm.textContent='No manual output recorded.';
  return sm;
}
function minutesFromSeconds(seconds){return Math.round(Math.max(0,Number(seconds)||0)/60);}
function pomodoroSummaryFromTasks(tasks){
  const summary={breaks:0,recoverySeconds:0,overrunSeconds:0,actualSeconds:0,excludedUnknown:0};
  (Array.isArray(tasks)?tasks:[]).forEach(task=>{
    if(!isWorkBlock(task))return;
    (Array.isArray(task&&task.pauseEvents)?task.pauseEvents:[]).forEach(ev=>{
      if(!ev||ev.type!=='pomodoro')return;
      const seconds=Math.max(0,Math.round(Number(ev.seconds)||0));
      if(!seconds)return;
      const planned=Math.max(0,Math.round(Number(ev.plannedSeconds)||0));
      if(!planned){summary.excludedUnknown+=1;return;}
      summary.breaks+=1;
      summary.actualSeconds+=seconds;
      summary.recoverySeconds+=Math.min(seconds,planned);
      summary.overrunSeconds+=Math.max(0,seconds-planned);
    });
  });
  return summary;
}
function pomodoroSummaryText(summary){
  const s=summary||{};
  const excluded=s.excludedUnknown?` · ${s.excludedUnknown} legacy break${s.excludedUnknown===1?'':'s'} without a saved allowance excluded`:'';
  if(!s.breaks)return `Pomodoro: no comparable accepted work-block breaks saved yet${excluded}.`;
  const breakLabel=s.breaks===1?'break':'breaks';
  const recovery=durationLabel(minutesFromSeconds(s.recoverySeconds));
  const overrun=minutesFromSeconds(s.overrunSeconds);
  return `Pomodoro: ${s.breaks} ${breakLabel} · ${recovery} recovery · ${overrun?durationLabel(overrun)+' overrun':'no overrun'}${excluded}`;
}
function currentPomodoroSummary(){
  const records=actualRecordsSnapshot();
  const tasks=TASKS.map((t,i)=>({...(t||{}),pauseEvents:(records[i]||records[String(i)]||{}).pauseEvents||[]}));
  return pomodoroSummaryFromTasks(tasks);
}
function updateReviewPomodoroLine(record=null){
  const el=document.getElementById('review-pomodoro-line');
  if(!el)return;
  el.textContent=pomodoroSummaryText(record?pomodoroSummaryFromTasks(record.tasks||[]):currentPomodoroSummary());
}
function createPomodoroSummaryLine(tasks){
  const line=document.createElement('div');
  line.className='review-flow-note ui-helper';
  line.textContent=pomodoroSummaryText(pomodoroSummaryFromTasks(tasks||[]));
  return line;
}
function createSavedDayTaskReviewCard(task){
  const pct=task&&task.completion!==null&&task.completion!==undefined&&Number.isFinite(Number(task.completion))
    ? Math.max(0,Math.min(100,Math.round(Number(task.completion)))):null;
  const measure=taskMeasureValue(task,'units');
  const shifted=!!(task&&task.hasAdjustment);
  const tracked=task&&task.actualSeconds!==null&&task.actualSeconds!==undefined;
  const statusInfo=pct===null&&!task?.skipped&&!task?.doneFlag
    ? {status:'untouched',label:'Evidence unavailable'}
    : taskOutcomeInfo(classifyTaskOutcome(task));
  const card=document.createElement('div');card.className=`rcard ui-card ${statusInfo.status}${shifted?' shifted':''}`;
  applyReviewProgressVisual(card,pct===null?0:pct);
  const done=task&&task.done!==null&&task.done!==undefined?task.done:undefined;
  const total=task&&task.enteredTotal!==null&&task.enteredTotal!==undefined?task.enteredTotal:taskTargetValue(task);
  card.append(
    createTaskReviewHeader({name:task&&task.name||'Task',area:taskAreaValue(task)||'—',pct,statusInfo,shifted,tracked,source:task&&task.completionSource}),
    createTaskTimingRow({
      original:`${task&&task.originalStart||'—'}-${task&&task.originalEnd||'—'}`,
      adjusted:`${task&&task.adjustedStart||'—'}-${task&&task.adjustedEnd||'—'}`,
      shifted,
      actualSec:tracked?task.actualSeconds:null,
      deltaSec:tracked?task.actualDeltaSeconds:null,
      wallStart:task&&task.actualStart,
      wallEnd:task&&task.actualEnd
    }),
    createStaticProgressLine({done,total,measure,suffixNoTotal:' done · no saved target'})
  );
  const sourceDescription=pct===null?'Completion evidence is missing in this degraded record.':completionSourceDescription(task&&task.completionSource,pct);
  if(sourceDescription)card.appendChild(textEl('div','review-flow-note ui-helper',sourceDescription));
  return card;
}
function taskHasActualWork(idx){
  const rec=TaskSessionState.getField(idx,'actualRecords')||{};
  const clk=TaskSessionState.getField(idx,'actualClock')||{};
  return Number(TaskSessionState.getField(idx,'actualTime'))>0 || !!clk.startedAt || !!clk.endedAt || !!rec.firstStartedAt || (Array.isArray(rec.sessions)&&rec.sessions.length>0);
}
function isFutureUntouchedBlock(idx){
  const t=TASKS[idx];
  if(!t||!isWorkBlock(t))return false;
  if(idx===Runtime.currentIndex()&&isLiveTrackableTimer())return false;
  if(taskHasActualWork(idx)||isTaskResolved(idx))return false;
  const startsLater=adjustedStartMin(idx)>effectiveNowMin();
  const afterActiveBlock=isLiveTrackableTimer()&&idx>Runtime.currentIndex();
  return startsLater||afterActiveBlock;
}
function clearFutureUntouchedProgress(){
  let changed=false;
  TASKS.forEach((t,i)=>{
    if(!isWorkBlock(t))return;
    if(!isFutureUntouchedBlock(i))return;
    if(TaskSessionState.deleteField(i,'completion'))changed=true;
    if(TaskSessionState.deleteField(i,'completionSource'))changed=true;
    const progress=TaskSessionState.getField(i,'notes');
    if(progress&&(progress.done!==undefined||progress.total!==undefined)){TaskSessionState.deleteField(i,'notes');changed=true;}
  });
  return changed;
}
function buildReviewCardModel(task,evidence=null){
  const idx=task.i,row=evidence?.taskEvidence[TaskIdentity.idAt(idx)];
  const resolved=row?.resolved||resolveTaskCompletion(idx,{actualSnapshot:evidence?.actualTime});
  const pct=row?.pct??resolved.pct;
  const progress=TaskSessionState.getField(idx,'notes')||{};
  const measure=taskMeasureValue(task,'units');
  const target=taskTargetValue(task);
  const hasPct=resolved.source!==COMPLETION_SOURCES.NONE;
  const shifted=hasAdjustedTiming(idx);
  const actualSeconds=evidence?evidence.actualTime[idx]:TaskSessionState.getField(idx,'actualTime');
  const tracked=actualSeconds!==undefined;
  const clock=row?.clock||TaskSessionState.getField(idx,'actualClock')||{};
  const noteInfo=applicableNotesForTask(task);
  return {
    task,idx,resolved,pct,progress,measure,target,hasPct,shifted,tracked,actualSeconds,clock,
    statusInfo:taskOutcomeInfo(row?.outcome||liveTaskOutcome(idx,{actualSnapshot:evidence?.actualTime,resolved,exactPct:pct})),
    sourceText:completionSourceDescription(resolved.source,pct),
    noteAreaKey:String(noteInfo.exactKey||''),
    noteAreaLabel:String(noteInfo.exactLabel||taskAreaValue(task)||''),
    noteText:String(noteInfo.exactText||'').trim(),
    originalTiming:`${studyMinuteToHHMM(originalStartMin(idx))}-${studyMinuteToHHMM(originalEndMin(idx))}`,
    adjustedTiming:`${studyMinuteToHHMM(adjustedStartMin(idx))}-${studyMinuteToHHMM(adjustedEndMin(idx))}`
  };
}
function refreshReviewCardStaticProgress(model,progressLine){
  const current=TaskSessionState.getField(model.idx,'notes')||{};
  const done=current.done;
  const total=current.total||model.target;
  if(done!==undefined&&total)setProgressSummary(progressLine,done,total,model.measure||'units');
  else if(done!==undefined)setProgressSummary(progressLine,done,0,model.measure||'units',' done · no target',true);
  else progressLine.textContent='No manual output recorded.';
}
function renderReviewCard(model){
  const card=document.createElement('div');
  card.className=`rcard ui-card ${model.statusInfo.status}${model.shifted?' shifted':''}`;
  card.id=`rcard-${model.idx}`;
  applyReviewProgressVisual(card,model.pct);
  const progressLine=createStaticProgressLine({done:model.progress.done,total:model.progress.total||model.target,measure:model.measure});
  const sourceLine=model.sourceText?textEl('div','review-flow-note ui-helper',model.sourceText):null;
  if(sourceLine)sourceLine.id=`rsource-${model.idx}`;
  const noteBox=document.createElement('div');
  noteBox.className='review-block-note ui-body';
  noteBox.dataset.areaKey=model.noteAreaKey;
  noteBox.dataset.noteSupport=model.task.kind==='support'?'true':'false';
  const emptyNoteText=model.task.kind==='support'?'No current shared support note.':'No current note for this area.';
  renderRichTextContent(noteBox,noteStoredValueForKey(model.noteAreaKey),emptyNoteText,`Note for ${model.noteAreaLabel}`);
  if(!model.noteText)noteBox.classList.add('review-block-empty');
  const noteShare=textEl('div','review-flow-note ui-helper',model.task.kind==='support'?'Shared by all support activities':`Shared by Area: ${model.noteAreaLabel}`);
  const actions=document.createElement('div');
  actions.className='review-block-actions';
  const editBtn=document.createElement('button');
  editBtn.type='button';editBtn.className='mini-action-btn ui-btn';editBtn.dataset.ownerMutation='review-edit';editBtn.textContent='Edit';
  actions.appendChild(editBtn);
  const editPanel=document.createElement('div');
  editPanel.className='review-edit-panel';
  const measureRow=document.createElement('div');measureRow.className='rmeasure-row';
  const doneField=document.createElement('div');doneField.className='rfield';
  const doneLabel=document.createElement('label');doneLabel.className='ui-label';doneLabel.textContent='Done';
  const doneInput=document.createElement('input');doneInput.type='number';doneInput.className='ui-field ui-mono';doneInput.id=`rd-done-${model.idx}`;doneInput.min=0;doneInput.placeholder='0';doneInput.value=model.progress.done!==undefined?model.progress.done:'';
  doneField.append(doneLabel,doneInput);
  const divider=document.createElement('div');divider.className='rdiv';divider.textContent='/';
  const totalField=document.createElement('div');totalField.className='rfield';
  const totalLabel=document.createElement('label');totalLabel.className='ui-label';totalLabel.textContent='Total';
  const totalInput=document.createElement('input');totalInput.type='number';totalInput.className='ui-field ui-mono';totalInput.id=`rd-total-${model.idx}`;totalInput.min=0;totalInput.placeholder='—';totalInput.value=model.progress.total!==undefined?model.progress.total:(model.target||'');
  totalField.append(totalLabel,totalInput);
  const unitTag=document.createElement('div');unitTag.className='rutag ui-label ui-chip';unitTag.textContent=model.measure||'—';
  measureRow.append(doneField,divider,totalField,unitTag);
  const summary=document.createElement('div');summary.className='rsum ui-body';summary.id=`rsum-${model.idx}`;
  if(model.progress.done!==undefined&&(model.progress.total||model.target))setProgressSummary(summary,model.progress.done,model.progress.total||model.target,model.measure||'units');
  else if(model.progress.done!==undefined)setProgressSummary(summary,model.progress.done,0,model.measure||'units',' done · enter target for %',true);
  const pctField=document.createElement('div');pctField.className='rfield';
  const pctLabel=document.createElement('label');pctLabel.className='ui-label';pctLabel.textContent='Completion %';
  const pctInput=document.createElement('input');pctInput.type='number';pctInput.className='ui-field ui-mono';pctInput.id=`rd-pct-${model.idx}`;pctInput.min=0;pctInput.max=100;pctInput.value=model.hasPct?Math.round(model.pct):'';
  pctField.append(pctLabel,pctInput);
  const noteEdit=document.createElement('textarea');
  noteEdit.className='review-edit-note ui-field task-note-field';
  bindTaskNoteEditor(noteEdit,model.idx,'review');
  noteEdit.value=model.noteText;noteEdit.placeholder=model.task.kind==='support'?'Edit the shared support note...':'Edit current notes for this subject/area...';
  editPanel.append(measureRow,pctField,summary,noteEdit);
  const inheritedNotes=document.createElement('div');
  renderInheritedNotes(inheritedNotes,model.noteAreaKey,true);
  card.append(
    createTaskReviewHeader({name:model.task.name,area:taskAreaValue(model.task),pct:model.hasPct?model.pct:0,statusInfo:model.statusInfo,shifted:model.shifted,tracked:model.tracked,pctId:`rpct-${model.idx}`,source:model.resolved.source}),
    createTaskTimingRow({
      original:model.originalTiming,adjusted:model.adjustedTiming,shifted:model.shifted,
      actualSec:model.tracked?model.actualSeconds:null,
      deltaSec:model.tracked?model.actualSeconds-(model.task.dur*60):null,
      wallStart:model.clock.startedAt,wallEnd:model.clock.endedAt
    }),
    progressLine,noteShare,noteBox,actions,editPanel,inheritedNotes
  );
  if(sourceLine)card.insertBefore(sourceLine,noteBox);
  return {card,progressLine,noteBox,editBtn,doneInput,totalInput,pctInput,noteEdit};
}
function bindReviewCardInputs(model,view){
  const refresh=()=>refreshReviewCardStaticProgress(model,view.progressLine);
  on(view.doneInput,'input',()=>{onReviewMeasure(model.idx,model.measure,model.target);refresh();ReviewView.sync();});
  on(view.totalInput,'input',()=>{onReviewMeasure(model.idx,model.measure,model.target);refresh();ReviewView.sync();});
  on(view.pctInput,'input',()=>{
    if(String(view.pctInput.value||'').trim()===''){
      const resolved=clearManualCompletionOverride(model.idx,{updateUI:true,save:true});
      view.progressLine.textContent=resolved.source===COMPLETION_SOURCES.NONE?'No manual output recorded.':'Completion override cleared; using available evidence.';
      ReviewView.sync();return;
    }
    const pct=boundedInt(view.pctInput.value,{min:0,max:100,fallback:0});
    setCompletion(model.idx,pct,true);
    view.progressLine.textContent='Completion adjusted manually.';ReviewView.sync();
  });
  on(view.noteEdit,'input',event=>{
    const noteText=reviewRichInputPlain(event,view.noteEdit.value).trim();
    if(!commitTaskNoteEditor(view.noteEdit,view.noteEdit.value,event)){ReviewView.invalidate();return;}
    view.noteBox.classList.toggle('review-block-empty',!noteText);ReviewView.sync();
  });
  view.editBtn.addEventListener('click',()=>{
    const editing=!view.card.classList.contains('editing');
    view.card.classList.toggle('editing',editing);
    view.editBtn.textContent=editing?'Done':'Edit';
    if(editing){requestAnimationFrame(()=>view.noteEdit.focus({preventScroll:true}));return;}
    if(!editing){
      onReviewMeasure(model.idx,model.measure,model.target);
      if(!commitTaskNoteEditor(view.noteEdit,view.noteEdit.value)){ReviewView.invalidate();return;}
      refresh();
      saveLiveDraft();ReviewView.sync();closeRichTextField(view.noteEdit);
    }
  });
}
function createReviewCard(task,evidence=null){
  const model=buildReviewCardModel(task,evidence);
  const view=renderReviewCard(model);
  bindReviewCardInputs(model,view);
  return view.card;
}
/* REVIEW UNFINISHED-NOTE PANEL */
function renderReviewUnfinishedNote(){
  const box=document.getElementById('review-unfinished-note');
  if(!box)return;
  const txt=unfinishedNoteDraftText();
  box.textContent=txt||'No unfinished note saved for today.';
  box.classList.toggle('has-note',!!txt);
}
function formatPracticeVariance(value,{partial=false}={}){
  const ms=Math.round(Number(value)||0);
  if(Math.abs(ms)<1000)return partial?'On pace so far':'On plan';
  return `${ms>0?'+':'−'}${formatPracticeMs(Math.abs(ms))}`;
}
function practiceVarianceClass(value){
  const ms=Math.round(Number(value)||0);
  return ms>999?'behind':ms<-999?'ahead':'';
}
function practiceTaskName(taskId,tasks=TASKS){
  const id=String(taskId||'');
  const task=(Array.isArray(tasks)?tasks:[]).find(row=>String(row&&row.id||'')===id);
  return clampText(task&&task.name||'',APP_LIMITS.maxTaskNameChars);
}
function practiceTableCell(className,text){return textEl('span',className,String(text??'—'));}
function practiceRunUnitsLabel(run){
  const count=run.plannedUnits?`${run.units}/${run.plannedUnits}`:String(run.units);
  return run.partial?`Partial run · ${count} units`:count;
}
function practicePaceBandCountsLabel(run){return `${run.fast} fast · ${run.controlled} controlled · ${run.overTarget} over`;}
function practiceRunTimeLabel(run){return `${formatPracticeMs(run.actualMs)} / ${formatPracticeMs(run.comparisonTargetMs)}`;}
function appendPracticeRunCells(row,{name,units,time,bands,variance,partial=false}){
  const varianceClass=practiceVarianceClass(variance);
  row.append(
    practiceTableCell('practice-run-name',name),
    practiceTableCell('practice-run-units',units),
    practiceTableCell('practice-run-time',time),
    practiceTableCell('practice-run-within',bands),
    practiceTableCell(`practice-run-variance${varianceClass?` ${varianceClass}`:''}`,formatPracticeVariance(variance,{partial}))
  );
  return row;
}
function practiceUnitBudgetLabel(unit){
  const target=formatPracticeMs(unit.targetMs);
  return unit.marks===null||unit.marks===undefined?target:`${unit.marks} marks · ${target}`;
}
function createPracticeSegmentRow(segment){
  const row=textEl('div','practice-segment-row');
  const varianceClass=practiceVarianceClass(segment.varianceMs);
  row.append(
    textEl('span','',`${segment.label} · ${segment.units}/${segment.plannedUnits} units`),
    textEl('span','segment-time',`${formatPracticeMs(segment.actualMs)} / ${formatPracticeMs(segment.targetMs)}`),
    textEl('span',`segment-variance${varianceClass?` ${varianceClass}`:''}`,formatPracticeVariance(segment.varianceMs))
  );
  return row;
}
function createPracticeRunDetail(run,{allowDelete=false}={}){
  const detail=textEl('div','practice-run-detail');
  const stats=[
    `Median ${formatPracticeMs(run.medianMs)}`,
    `Average ${formatPracticeMs(run.averageMs)}`,
    `Fastest ${formatPracticeMs(run.fastestMs)}`,
    `Slowest ${formatPracticeMs(run.slowestMs)}`
  ];
  if(run.secondHalfAverageMs)stats.push(`First half ${formatPracticeMs(run.firstHalfAverageMs)} · second half ${formatPracticeMs(run.secondHalfAverageMs)}`);
  detail.appendChild(textEl('div','practice-run-stats ui-mono',stats.join(' · ')));
  const list=textEl('div','practice-unit-list');
  const head=textEl('div','practice-unit-row head');
  ['Unit','Budget','Actual','Pace / difference'].forEach(label=>head.appendChild(textEl('span','',label)));
  list.appendChild(head);
  const segmentRows=new Map(run.segmentRows.map(segment=>[segment.index,segment]));let currentSegment=null;
  run.unitRows.forEach(unit=>{
    if(unit.segmentIndex!==null&&unit.segmentIndex!==currentSegment){
      currentSegment=unit.segmentIndex;const segment=segmentRows.get(currentSegment);if(segment)list.appendChild(createPracticeSegmentRow(segment));
    }
    const row=textEl('div','practice-unit-row');
    const deltaClass=unit.paceBand;
    row.append(
      textEl('span','',String(unit.segmentUnitIndex===null?unit.index+1:unit.segmentUnitIndex+1)),
      textEl('span','',practiceUnitBudgetLabel(unit)),
      textEl('span','actual',formatPracticeMs(unit.actualMs)),
      textEl('span',`delta ${deltaClass}`,`${practicePaceBandLabel(deltaClass)} · ${formatPracticeVariance(unit.deltaMs)}`)
    );
    list.appendChild(row);
  });
  detail.appendChild(list);
  if(allowDelete){
    const actions=textEl('div','practice-run-detail-actions');
    const remove=textEl('button','btn ui-btn practice-run-delete','Delete Run');
    remove.type='button';remove.dataset.action='practice-delete-run';remove.dataset.runIndex=String(run.index);
    actions.appendChild(remove);detail.appendChild(actions);
  }
  return detail;
}
function createPracticeRunEntry(run,tasks,options={}){
  const entry=textEl('details','practice-run-entry');
  const summary=textEl('summary','practice-run-summary');
  const taskName=practiceTaskName(run.run.taskId,tasks);
  appendPracticeRunCells(summary,{
    name:`Run ${run.index+1}${taskName?` · ${taskName}`:''}`,
    units:practiceRunUnitsLabel(run),time:practiceRunTimeLabel(run),bands:practicePaceBandCountsLabel(run),variance:run.varianceMs,partial:run.partial
  });
  let detail=null;
  const ensureDetail=()=>{
    if(detail)return detail;
    detail=createPracticeRunDetail(run,options);entry.appendChild(detail);return detail;
  };
  summary.addEventListener('click',ensureDetail);
  entry.appendChild(summary);
  entry.addEventListener('toggle',()=>{
    if(!entry.open)return;
    ensureDetail();
    entry.parentElement&&entry.parentElement.querySelectorAll('.practice-run-entry[open]').forEach(other=>{if(other!==entry)other.open=false;});
  });
  return entry;
}
function populatePracticeRunTable(root,runs,{tasks=TASKS,includeActiveNote=false,normalized=false,allowDelete=false}={}){
  if(!root)return null;
  const cleanRuns=normalized?runs:sanitizePracticeRuns(runs);
  const summary=summarizeCleanPracticeRuns(cleanRuns),table=root.querySelector('.practice-run-table')||root;
  table.replaceChildren();
  const head=textEl('div','practice-run-head ui-label');
  ['Run / linked block','Units','Actual / target','Pace bands','Difference'].forEach(label=>head.appendChild(textEl('span','',label)));
  table.appendChild(head);
  summary.runSummaries.forEach(run=>table.appendChild(createPracticeRunEntry(run,tasks,{allowDelete})));
  if(summary.runSummaries.length>1){
    const total=textEl('div','practice-run-total');
    appendPracticeRunCells(total,{
      name:'All runs',units:summary.plannedUnits?`${summary.units}/${summary.plannedUnits}`:summary.units,
      time:`${formatPracticeMs(summary.totalMs)} / ${formatPracticeMs(summary.comparisonTargetMs)}`,
      bands:practicePaceBandCountsLabel(summary),variance:summary.varianceMs
    });
    table.appendChild(total);
  }
  const note=root.querySelector('.practice-review-note');
  if(note){
    const parts=['Select a run to inspect its units.','Fast <80% · Controlled 80–100% · Over target >100%.'];
    if(includeActiveNote&&PracticePacer.status().active)parts.push('Practice Pacer run currently active in Execute.');
    note.textContent=parts.join(' ');
  }
  return summary;
}
function renderPracticeReview(){
  const panel=document.getElementById('practice-review');if(!panel)return;
  const runs=PracticePacer.completedRuns(),active=!!PracticePacer.status().active,show=!!runs.length||active;
  panel.hidden=!show;if(!show)return;
  const table=panel.querySelector('.practice-run-table'),note=panel.querySelector('.practice-review-note');
  if(runs.length){
    if(table)table.hidden=false;populatePracticeRunTable(panel,runs,{includeActiveNote:true,normalized:true,allowDelete:true});
  }else{
    if(table){table.replaceChildren();table.hidden=true;}
    if(note)note.textContent='Practice Pacer run currently active in Execute.';
  }
}
async function deletePracticeRun(event){
  const button=event&&event.target&&event.target.closest('[data-run-index]');
  const index=Number(button&&button.dataset.runIndex);
  if(!Number.isInteger(index))return false;
  const accepted=await confirm({
    title:`Delete Practice Run ${index+1}?`,danger:true,
    message:'This removes the run’s recorded timings from today’s Review.',
    details:['Your saved Study Day is not changed until you use Save Today.'],
    confirmLabel:'Delete run',cancelLabel:'Keep run'
  });
  if(!accepted||!appCanMutate()||index>=PracticePacer.completedRuns().length)return false;
  if(!PracticePacer.removeRun(index))return false;
  renderPracticeReview();ReviewView.sync();
  setStatus('save-status','Run deleted from today’s review. Save Today updates this date’s single saved Study Day.');
  notify({key:'practice-run-delete',title:'Practice run deleted',message:`Run ${index+1} was removed from today’s Review.`});
  return true;
}
function reviewViewLocalState(){
  return {
    reflection:plainTextContent(document.getElementById('daily-reflection')?.value||''),
    quality:getStudyQuality(),
    unfinished:unfinishedNoteDraftText()
  };
}
function reviewViewEvidenceKey(evidence){
  const rows=TASKS.map((task,idx)=>{
    if(!isTrackableBlock(task))return null;
    const taskId=TaskIdentity.idAt(idx),row=evidence.taskEvidence[taskId]||{};
    const progress=TaskSessionState.getField(idx,'notes')||{};
    const clock=row.clock||TaskSessionState.getField(idx,'actualClock')||{};
    const record=TaskSessionState.getField(idx,'actualRecords')||{};
    const noteInfo=applicableNotesForTask(task);
    const pauseEvents=Array.isArray(record.pauseEvents)?record.pauseEvents.map(event=>[
      String(event&&event.type||event&&event.reason||'').trim().toLowerCase(),
      Math.max(0,Math.round(Number(event&&event.seconds)||0)),
      Number.isFinite(Number(event&&event.plannedSeconds))?Math.max(0,Math.round(Number(event.plannedSeconds))):null
    ]):[];
    return [
      taskId,String(task.name||''),String(task.kind||''),taskAreaValue(task),String(task.start||''),positiveMinutes(task.dur),
      taskMeasureValue(task,''),taskTargetValue(task),originalStartMin(idx),adjustedStartMin(idx),adjustedEndMin(idx),
      TaskSessionState.resolvedState(idx)||'',row.resolved&&row.resolved.source||'',Math.round((Number(row.pct)||0)*1000)/1000,row.outcome||'',
      progress.done??null,progress.total??null,Math.max(0,Math.round(Number(row.actualSeconds)||0)),
      clock.startedAt||'',clock.endedAt||'',record.status||'',Math.max(0,Math.round(Number(record.sessionCount)||0)),
      Math.max(0,Math.round(Number(record.pauseCount)||0)),pauseEvents,
      String(noteInfo.exactText||''),noteInfo.inherited.map(entry=>[entry.key,String(entry.text||'')])
    ];
  }).filter(Boolean);
  const practice=PracticePacer.snapshot();
  return JSON.stringify({
    date:getReviewDate(),schedule:scheduleFingerprint(),adjustments:ScheduleDerivedState.adjustmentsRevision,
    contentRevision:cleanDayRevision(SessionState.contentRevision),savedRevision:cleanDayRevision(SessionState.savedRevision),
    currentTask:TaskIdentity.idAt(Runtime.currentIndex()),timerMode:Runtime.timerMode(),paused:!!Runtime.isPaused(),pendingGap:!!Runtime.pendingGap(),
    rows,practice,local:reviewViewLocalState()
  });
}
function prepareReviewRender(options={}){
  syncUnfinishedNoteDraft();
  const cleared=clearFutureUntouchedProgress();
  const evidence=options.evidence||SessionEvidenceGateway.snapshot({includeRecords:true});
  return {cleared,evidence,key:reviewViewEvidenceKey(evidence)};
}
function buildReview(options={}){
  const prepared=options.prepared||prepareReviewRender(options);
  const {cleared,evidence}=prepared;
  const metrics=calculateReviewMetrics(evidence),st=evidence.reviewTasks.filter(row=>row.work);
  recalcStats(metrics);
  const c=document.getElementById('review-list');c.replaceChildren();
  st.forEach(t=>c.appendChild(createReviewCard(t,evidence)));
  renderReviewUnfinishedNote();renderPracticeReview();setReviewDetailDisclosures(reviewDetailsShouldOpen());syncReviewDateMode();
  if(cleared)saveLiveDraft();
  return metrics;
}
const ReviewView=(()=>{
  let renderedKey='',hasRendered=false,restoreFrame=0;
  let scrollState={documentTop:0,mainTop:0};
  function captureScroll(){
    const root=document.scrollingElement||document.documentElement,main=document.querySelector('.main');
    scrollState={documentTop:Math.max(0,Number(root&&root.scrollTop)||Number(window.scrollY)||0),mainTop:Math.max(0,Number(main&&main.scrollTop)||0)};
    return {...scrollState};
  }
  function restoreScroll(state=scrollState,{immediate=false}={}){
    const apply=()=>{
      const root=document.scrollingElement||document.documentElement,main=document.querySelector('.main');
      if(root)root.scrollTop=Math.max(0,Number(state&&state.documentTop)||0);
      if(main)main.scrollTop=Math.max(0,Number(state&&state.mainTop)||0);
    };
    if(restoreFrame){cancelAnimationFrame(restoreFrame);restoreFrame=0;}
    if(immediate){apply();return;}
    restoreFrame=requestAnimationFrame(()=>{restoreFrame=0;apply();});
  }
  function focusState(){
    const pane=document.getElementById('pane-review'),active=document.activeElement;
    if(!pane||!active||!pane.contains(active))return null;
    let locator=null;
    if(active.id)locator={kind:'id',value:active.id};
    else if(active.dataset&&active.dataset.taskId)locator={kind:'task',value:String(active.dataset.taskId)};
    else if(active.dataset&&active.dataset.runIndex!==undefined)locator={kind:'practice-run',value:String(active.dataset.runIndex)};
    if(!locator)return null;
    return {locator,start:Number.isInteger(active.selectionStart)?active.selectionStart:null,end:Number.isInteger(active.selectionEnd)?active.selectionEnd:null};
  }
  function resolveFocusTarget(pane,locator){
    if(!pane||!locator)return null;
    if(locator.kind==='id'){
      const target=document.getElementById(locator.value);
      return target&&pane.contains(target)?target:null;
    }
    const selector=locator.kind==='task'?'[data-task-id][data-note-source="review"]':locator.kind==='practice-run'?'[data-run-index]':'';
    if(!selector)return null;
    const datasetKey=locator.kind==='task'?'taskId':'runIndex';
    return [...pane.querySelectorAll(selector)].find(element=>String(element.dataset[datasetKey]??'')===locator.value)||null;
  }
  function captureUi(){
    const pane=document.getElementById('pane-review');
    if(!pane)return null;
    return {
      scroll:captureScroll(),
      blocksOpen:!!pane.querySelector('.review-blocks-collapse')?.open,
      unfinishedOpen:!!pane.querySelector('.review-unfinished')?.open,
      executionOpen:!!pane.querySelector('.review-execution-details')?.open,
      editing:[...pane.querySelectorAll('#review-list .rcard.editing')].map(card=>card.id),
      practiceOpen:[...pane.querySelectorAll('.practice-run-entry')].findIndex(entry=>entry.open),
      focus:focusState()
    };
  }
  function restoreUi(state,{focus=true,immediateScroll=false}={}){
    if(!state)return;
    const pane=document.getElementById('pane-review');
    const blocks=pane&&pane.querySelector('.review-blocks-collapse');if(blocks)blocks.open=!!state.blocksOpen;
    const unfinished=pane&&pane.querySelector('.review-unfinished');if(unfinished)unfinished.open=!!state.unfinishedOpen;
    const execution=pane&&pane.querySelector('.review-execution-details');if(execution)execution.open=!!state.executionOpen;
    (state.editing||[]).forEach(id=>{
      const card=document.getElementById(id);if(!card)return;
      card.classList.add('editing');const button=card.querySelector('.review-block-actions button');if(button)button.textContent='Done';
    });
    if(Number.isInteger(state.practiceOpen)&&state.practiceOpen>=0){
      const entry=pane&&pane.querySelectorAll('.practice-run-entry')[state.practiceOpen];if(entry)entry.open=true;
    }
    restoreScroll(state.scroll,{immediate:immediateScroll});
    if(focus&&state.focus){
      requestAnimationFrame(()=>{
        const target=resolveFocusTarget(pane,state.focus.locator);if(!target)return;
        target.focus({preventScroll:true});
        if(state.focus.start!==null&&typeof target.setSelectionRange==='function')target.setSelectionRange(state.focus.start,state.focus.end??state.focus.start);
      });
    }
  }
  function refresh(options={}){
    const pane=document.getElementById('pane-review'),visible=!!pane&&pane.classList.contains('on');
    const ui=hasRendered?captureUi():null;
    const prepared=options.prepared||prepareReviewRender(options);
    const metrics=buildReview({...options,prepared});
    hasRendered=true;renderedKey=prepared.key;
    if(ui)restoreUi(ui,{focus:visible,immediateScroll:options.immediateScroll===true});
    else if(options.restoreScroll)restoreScroll(scrollState,{immediate:options.immediateScroll===true});
    return metrics;
  }
  function activate(options={}){
    const prepared=prepareReviewRender({includeRecords:true});
    let result=null;
    if(hasRendered&&prepared.key===renderedKey&&!prepared.cleared){
      if(options.restoreScroll!==false)restoreScroll(scrollState,{immediate:options.immediateScroll===true});
    }else result=refresh({...options,prepared,force:true});
    syncReviewSurfaceMode();
    if(!reviewHasStudyDay())void hydrateReflectionOnlyState(getReviewDate());
    return result;
  }
  function deactivate(){
    captureScroll();
    if(!hasRendered)return;
    syncUnfinishedNoteDraft();
  }
  function sync(){
    if(!hasRendered)return false;
    if(isLiveTrackableTimer()){renderedKey='';return false;}
    renderedKey=reviewViewEvidenceKey(SessionEvidenceGateway.snapshot({includeRecords:true}));
    return true;
  }
  function invalidate(){renderedKey='';}
  function status(){return Object.freeze({hasRendered,renderedKey});}
  return Object.freeze({activate,deactivate,refresh,sync,syncMode:syncReviewSurfaceMode,invalidate,status});
})();
function onReviewMeasure(idx,measure,defTotal){
  const di=document.getElementById(`rd-done-${idx}`);const ti=document.getElementById(`rd-total-${idx}`);
  if(!di||!ti)return;
  const state=progressInputState(idx,di.value,ti.value,defTotal);
  const resolved=syncProgressInputsToState(idx,state,{updateUI:true,save:true});
  refreshRsum(idx,measure,state.done,state.total);
  if(idx===Runtime.currentIndex()){
    const pd=document.getElementById('pn-done');const pt=document.getElementById('pn-total');
    if(pd)pd.value=state.hasDone?state.done:'';
    if(pt)pt.value=state.hasTotal?state.total:'';
    const pbar=document.getElementById('pbar');
    if(pbar)pbar.style.width=(state.pct!==null?state.pct:0)+'%';
    const sum=document.getElementById('pn-sum');
    setProgressSummary(sum,state.done,state.total,measure);
  }
  return resolved;
}
function refreshRsum(idx,measure,done,total){
  const el=document.getElementById(`rsum-${idx}`);if(!el)return;
  if(done!==undefined&&total)setProgressSummary(el,done,total,measure||'units');
  else if(done!==undefined)setProgressSummary(el,done,0,measure||'units',' done · enter target for %',true);
  else el.textContent='';
}
function reviewDetailsShouldOpen(d=new Date()){
  const trackable=TASKS.map((t,i)=>({t,i})).filter(x=>isTrackableBlock(x.t));
  if(!trackable.length)return false;
  if(Runtime.timerMode()===TIMER_MODES.DONE)return true;
  if(trackable.every(x=>isTaskResolved(x.i)))return true;
  const lastEnd=latestTrackableEndMin();
  return SessionState.studyDate===todayISO(d)&&lastEnd!==null&&effectiveNowMin(d)>=lastEnd;
}
function setReviewDetailDisclosures(open){
  document.querySelectorAll('#pane-review .review-collapse').forEach(el=>{el.open=!!open;});
}
function recalcStats(metrics=null){
  const m=metrics||calculateCurrentReviewMetrics();
  document.getElementById('review-avg').textContent=displayPercent(m.completionPercent);
  const outcomes=sanitizeTaskOutcomeCounts(m.outcomeCounts);
  document.getElementById('review-full').textContent=outcomes[TASK_OUTCOMES.FULL];
  document.getElementById('review-part').textContent=outcomes[TASK_OUTCOMES.PARTIAL];
  const attention=document.getElementById('review-other-outcomes');
  if(attention)attention.textContent=taskOutcomeTotal(outcomes)-outcomes[TASK_OUTCOMES.FULL]-outcomes[TASK_OUTCOMES.PARTIAL];
  updateReviewMetrics(m);
}
function copyTextToClipboard(txt){
  if(navigator.clipboard&&navigator.clipboard.writeText){
    return navigator.clipboard.writeText(txt);
  }
  return new Promise((resolve,reject)=>{
    try{
      const ta=document.createElement('textarea');
      ta.value=txt;
      ta.setAttribute('readonly','');
      ta.style.position='fixed';ta.style.left='-9999px';ta.style.top='0';
      document.body.appendChild(ta);
      ta.focus();ta.select();
      const ok=document.execCommand&&document.execCommand('copy');
      ta.remove();
      ok?resolve():reject(new Error('Clipboard unavailable'));
    }catch(e){reject(e);}
  });
}
function clipboardPlainText(value,{rich=false}={}){
  const text=rich?plainTextContent(value):String(value??'');
  return text.replace(/\r\n?/gu,'\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/gu,'');
}
const REVIEW_REPORT_OUTPUT_ORDER=freeze(['summary','subjects','ongoing','other','diary']);
const REVIEW_REPORT_CATALOG=freeze([
  freeze({id:'summary',label:'Summary / statistics',compose:composeReviewSummary}),
  freeze({id:'diary',label:'Diary reflection',compose:composeReviewDiary}),
  freeze({id:'subjects',label:'Subject details',children:reviewReportSubjectChildren,compose:composeReviewSubjects}),
  freeze({id:'ongoing',label:'Notes',children:reviewReportOngoingChildren,compose:composeReviewOngoing}),
  freeze({id:'other',label:'Other details',children:()=>[freeze({id:'other:unfinished',label:'Unfinished note'})],compose:composeReviewOther})
]);
const copyReportExcluded=new Set(),copyReportExpanded=new Set();
let copyReportMenuBound=false;
function reviewReportArea(task){return taskAreaValue(task)||'General';}
function reviewReportSubjectChildren(context){
  const seen=new Set(),children=[];
  (context.reportTasks||[]).forEach(task=>{
    const label=reviewReportArea(task),id=`subjects:${label}`;
    if(seen.has(id))return;seen.add(id);children.push(freeze({id,label,value:label}));
  });
  return children.sort((a,b)=>a.label.localeCompare(b.label));
}
function reviewReportOngoingChildren(context){
  return (context.subjectEntries||[]).map(entry=>freeze({id:`ongoing:${entry.key}`,label:String(entry.label||entry.key),value:entry.key})).sort((a,b)=>a.label.localeCompare(b.label));
}
function reviewReportSections(context){
  return REVIEW_REPORT_CATALOG.map(section=>freeze({...section,children:typeof section.children==='function'?section.children(context):[]}));
}
function reviewReportSelectorContext(){
  return freeze({reportTasks:TASKS.filter(isTrackableBlock),subjectEntries:currentNoteEntriesForWorkTasks(TASKS)});
}
function copyReportSectionState(section){
  if(!section.children.length)return freeze({checked:!copyReportExcluded.has(section.id),indeterminate:false});
  const selected=section.children.reduce((count,child)=>count+(!copyReportExcluded.has(child.id)?1:0),0);
  return freeze({checked:selected===section.children.length,indeterminate:selected>0&&selected<section.children.length});
}
function copyReportIsCustom(sections=reviewReportSections(reviewReportSelectorContext())){
  return sections.some(section=>{
    if(!section.children.length)return copyReportExcluded.has(section.id);
    return section.children.some(child=>copyReportExcluded.has(child.id));
  });
}
function syncCopyReportCustom(sections){
  const badge=document.getElementById('copy-report-custom');if(badge)badge.hidden=!copyReportIsCustom(sections);
}
function syncCopyReportChecks(sections){
  const root=document.getElementById('copy-report-sections');if(!root)return;
  const sectionMap=new Map(sections.map(section=>[section.id,section]));
  root.querySelectorAll('input[data-report-section]').forEach(input=>{
    const section=sectionMap.get(input.dataset.reportSection);if(!section)return;
    const state=copyReportSectionState(section);input.checked=state.checked;input.indeterminate=state.indeterminate;
  });
  root.querySelectorAll('input[data-report-component]').forEach(input=>{input.checked=!copyReportExcluded.has(input.dataset.reportComponent);});
  syncCopyReportCustom(sections);
}
function renderCopyReportMenu(){
  const root=document.getElementById('copy-report-sections');if(!root)return [];
  const sections=reviewReportSections(reviewReportSelectorContext());root.replaceChildren();
  sections.forEach(section=>{
    const group=textEl('div','copy-report-section'),row=textEl('div','copy-report-row');
    const check=document.createElement('input');check.type='checkbox';check.className='copy-report-check';check.dataset.reportSection=section.id;check.id=`copy-report-section-${section.id}`;
    const label=textEl('label','copy-report-row-label',section.label);label.htmlFor=check.id;row.append(check,label);
    if(section.children.length){
      const disclosure=textEl('button','copy-report-disclosure','⌄');disclosure.type='button';disclosure.dataset.copyReportDisclosure=section.id;
      disclosure.setAttribute('aria-label',`Show ${section.label.toLowerCase()}`);disclosure.setAttribute('aria-expanded',String(copyReportExpanded.has(section.id)));row.appendChild(disclosure);
    }
    group.appendChild(row);
    if(section.children.length){
      const children=textEl('div','copy-report-children');children.hidden=!copyReportExpanded.has(section.id);
      section.children.forEach(child=>{
        const childRow=textEl('label','copy-report-row'),childCheck=document.createElement('input');
        childCheck.type='checkbox';childCheck.className='copy-report-check';childCheck.dataset.reportComponent=child.id;
        childRow.append(childCheck,textEl('span','copy-report-row-label',child.label));children.appendChild(childRow);
      });
      group.appendChild(children);
    }
    root.appendChild(group);
  });
  syncCopyReportChecks(sections);return sections;
}
function closeCopyReportMenu(){
  const menu=document.getElementById('copy-report-menu'),button=document.querySelector('[data-action="toggle-copy-report-menu"]');
  if(menu)menu.hidden=true;if(button)button.setAttribute('aria-expanded','false');
}
function ensureCopyReportMenuEvents(){
  if(copyReportMenuBound)return;copyReportMenuBound=true;
  const menu=document.getElementById('copy-report-menu');if(!menu)return;
  on(menu,'change',event=>{
    const input=event.target;if(!(input instanceof HTMLInputElement)||input.type!=='checkbox')return;
    const sections=reviewReportSections(reviewReportSelectorContext());
    if(input.dataset.reportSection){
      const section=sections.find(item=>item.id===input.dataset.reportSection);if(!section)return;
      if(section.children.length)section.children.forEach(child=>input.checked?copyReportExcluded.delete(child.id):copyReportExcluded.add(child.id));
      else input.checked?copyReportExcluded.delete(section.id):copyReportExcluded.add(section.id);
    }else if(input.dataset.reportComponent)input.checked?copyReportExcluded.delete(input.dataset.reportComponent):copyReportExcluded.add(input.dataset.reportComponent);
    syncCopyReportChecks(sections);
  });
  on(menu,'click',event=>{
    const button=event.target.closest('[data-copy-report-disclosure]');if(!button)return;
    const id=button.dataset.copyReportDisclosure,expanded=!copyReportExpanded.has(id),section=button.closest('.copy-report-section');expanded?copyReportExpanded.add(id):copyReportExpanded.delete(id);button.setAttribute('aria-expanded',String(expanded));const label=section?.querySelector('.copy-report-row-label')?.textContent||'section';button.setAttribute('aria-label',`${expanded?'Hide':'Show'} ${label.toLowerCase()}`);const children=section?.querySelector('.copy-report-children');if(children)children.hidden=!expanded;
  });
  on(document,'click',event=>{const control=event.target.closest('.copy-report-control');if(!control)closeCopyReportMenu();});
  on(document,'keydown',event=>{if(event.key==='Escape')closeCopyReportMenu();});
}
function toggleCopyReportMenu(){
  ensureCopyReportMenuEvents();const menu=document.getElementById('copy-report-menu'),button=document.querySelector('[data-action="toggle-copy-report-menu"]');if(!menu)return false;
  if(menu.hidden){renderCopyReportMenu();menu.hidden=false;if(button)button.setAttribute('aria-expanded','true');}
  else closeCopyReportMenu();
  return !menu.hidden;
}
function resetCopyReportSelection(){copyReportExcluded.clear();renderCopyReportMenu();return true;}
function composeReviewSummary(context){
  const {m,rec,quality}=context;let txt='SUMMARY\n';
  txt+=`- Original planned work: ${durationLabel(m.originalPlannedStudyMinutes)}\n`;
  txt+=`- Completed equivalent: ${durationLabel(m.completedEquivalentMinutes)}\n`;
  txt+=`- Actual focus time: ${durationLabel(m.actualFocusMinutes)}\n`;
  txt+=`- Completion rate: ${displayPercent(m.completionPercent)}\n`;
  txt+=`- Average block completion: ${displayPercent(m.averageBlockCompletion)}\n`;
  txt+=`- Actual vs planned time: ${signedHoursLabel(m.actualVsPlannedMinutes)}\n`;
  txt+=`- Schedule shift: ${m.shiftedStudyBlocks?`${m.shiftedStudyBlocks} ${m.shiftedStudyBlocks===1?'work block':'work blocks'} · ${durationLabel(m.totalScheduleShiftMinutes)} largest movement · typical net ${signedHoursLabel(m.netScheduleShiftMinutes)}`:'No shifted work blocks'}\n`;
  txt+=`- Blocks: ${taskOutcomeSummaryText(m.outcomeCounts)} · ${taskOutcomeTotal(m.outcomeCounts)} total\n`;
  txt+=`- ${pomodoroSummaryText(pomodoroSummaryFromTasks(rec.tasks))}\n`;
  const practice=summarizeCleanPracticeRuns(rec.practiceRuns||[]);
  if(practice.units)txt+=`- Practice pacer: ${practice.runs} ${practice.runs===1?'run':'runs'} · ${practice.units} ${practice.units===1?'unit':'units'} · ${formatPracticeMs(practice.totalMs)} total · ${formatPracticeMs(practice.medianMs)} median · ${practice.fast} fast · ${practice.controlled} controlled · ${practice.overTarget} over target${practice.partialRuns?` · ${practice.partialRuns} partial ${practice.partialRuns===1?'run':'runs'}`:''}\n`;
  if(quality)txt+=`- Study quality: ${quality}/5\n`;
  return txt;
}
function composeReviewSubjects(context,selectedChildren){
  const selected=new Set(selectedChildren.map(child=>child.value)),tasks=context.rec.tasks.filter(task=>selected.has(reviewReportArea(task)));
  let txt="TODAY'S BLOCKS\n";
  if(!tasks.length)return txt;
  tasks.forEach((t,idx)=>{
    const n=TaskSessionState.getField(t.idx,'notes')||{},actual=t.actualSeconds!==null&&t.actualSeconds!==undefined?fmtS(t.actualSeconds):'not tracked';
    const delta=t.actualDeltaSeconds!==null&&t.actualDeltaSeconds!==undefined?` (${t.actualDeltaSeconds>=0?'+':'-'}${fmtS(Math.abs(t.actualDeltaSeconds))} vs planned)`:'';
    const timing=t.hasAdjustment?`Original ${t.originalStart}-${t.originalEnd}; Adjusted ${t.adjustedStart}-${t.adjustedEnd}`:`Original ${t.originalStart}-${t.originalEnd}`;
    let progress='';const measure=taskMeasureValue(t,'units');
    if(n.done!==undefined&&n.done!==null&&n.total)progress=` · ${n.done}/${n.total} ${measure}`;else if(n.done!==undefined&&n.done!==null)progress=` · ${n.done} ${measure}`;
    txt+=`${idx+1}. ${t.name} [${taskAreaValue(t)}]\n   ${timing}\n   Completion: ${displayPercent(t.completion)}${progress} · source: ${completionSourceLabel(t.completionSource)}\n   Actual focus: ${actual}${delta}\n`;
  });
  return txt;
}
function composeReviewOngoing(context,selectedChildren){
  const selected=new Set(selectedChildren.map(child=>child.value)),entries=context.subjectEntries.filter(entry=>selected.has(entry.key));
  if(!context.subjectEntries.length)return 'CURRENT ONGOING NOTES\n—\n';
  if(!entries.length)return '';
  let txt='CURRENT ONGOING NOTES\n';
  entries.sort((a,b)=>String(a.label||a.key).localeCompare(String(b.label||b.key))).forEach(entry=>{txt+=`${clipboardPlainText(entry.label||entry.key)}\n${clipboardPlainText(entry.text).trim()}\n\n`;});
  return txt.trimEnd()+'\n';
}
function composeReviewOther(context,selectedChildren){
  if(!selectedChildren.some(child=>child.id==='other:unfinished'))return '';
  return `UNFINISHED NOTE\n${context.unfinished?clipboardPlainText(context.unfinished):'—'}\n`;
}
function composeReviewDiary(context){return `DIARY / REFLECTION\n${context.refl||'—'}\n`;}
function composeReviewReport(context){
  const sections=reviewReportSections(context),byId=new Map(sections.map(section=>[section.id,section]));
  let txt=`STUDY REVIEW — ${context.dowFull} ${context.monFull} ${context.reviewDay.getDate()}\n\n`;
  REVIEW_REPORT_OUTPUT_ORDER.forEach(id=>{
    const section=byId.get(id);if(!section)return;
    let selected=[];
    if(section.children.length){selected=section.children.filter(child=>!copyReportExcluded.has(child.id));if(!selected.length)return;}
    else if(copyReportExcluded.has(section.id))return;
    const content=section.compose(context,selected);if(content)txt+=content+'\n';
  });
  return txt+'Use this review for next-day planning.';
}
function copyReview(){
  if(!reviewHasStudyDay()){closeCopyReportMenu();setStatus('save-status','Copy report is available when a Study Day is active.',false);return false;}
  captureTodayState();closeCopyReportMenu();
  const evidence=SessionEvidenceGateway.snapshot({includeRecords:true}),m=calculateReviewMetrics(evidence),rec=materializeDailyRecordView(buildDailyRecord(evidence));
  if(!rec){setStatus('save-status','Could not build the canonical review record.',false);return;}
  const reviewDay=new Date(`${rec.date}T00:00:00`),currentReview=currentReviewState(),quality=currentReview.studyQuality;
  const context=freeze({
    m,rec,reviewDay,quality,refl:clipboardPlainText(currentReview.reflection,{rich:true}),
    dowFull:['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][reviewDay.getDay()],
    monFull:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][reviewDay.getMonth()],
    reportTasks:rec.tasks,subjectEntries:currentNoteEntriesForWorkTasks(TASKS),unfinished:String(rec.carryForwardDraft||Runtime.carryForward()||'').trim()
  });
  const txt=composeReviewReport(context);
  const notice=notifications.begin({id:'copy-report',surfaceId:'save-status',title:'Copy report',message:'Copying report…'});
  const copyLabel=document.getElementById('copy-report-label');if(copyLabel)copyLabel.textContent='Copy report';
  return copyTextToClipboard(txt).then(()=>{
    if(!notice.finish('succeeded','✓ Copied structured text review to clipboard.'))return false;
    const label=document.getElementById('copy-report-label');if(label){label.textContent='✓ Copied';setTimeout(()=>{if(notice.read())label.textContent='Copy report';},2000);}
    syncCopyReportCustom(reviewReportSections(reviewReportSelectorContext()));
    return true;
  }).catch(()=>{notice.finish('failed','Clipboard is unavailable in this browser/session. Select the review text manually or use a browser with clipboard permission.');return false;});
}

    const ReviewModel=freeze({
      calculate:calculateReviewMetrics,
      projectDailyRecord:projectDailyRecord,
      evidenceFormat:'study-director.review-evidence'
    });
    const ReviewEditor=freeze({
      captureInputs:captureReviewInputs,
      captureToday:captureTodayState,
      getQuality:getStudyQuality,
      setQuality:setStudyQuality,
      saveReview:saveReviewState,
      queueReview:queueReviewSave,
      flushPending:flushPendingReviewSave,
      settled:()=>Promise.all([AppData.activeSession.settled(),reflectionLane.tail()]).then(()=>true),
      hydrate:hydrateReviewState,
      selectDate:selectReviewDate,
      state:currentReviewState,
      contentForDate:reflectionContentForDate,
      activeSessionReview:reviewSnapshot,
      bindSession:bindReviewSession,
      persistenceCommitted:reviewPersistenceCommitted,
      persistenceFailed:reviewPersistenceFailed,
      invalidateBindings:invalidateReviewEditors,
      clearForNewDay:clearReviewForNewDay,
      clearFutureUntouched:clearFutureUntouchedProgress,
      setCompletionState,
      editMeasure:onReviewMeasure,
      deletePracticeRun
    });
    const ReviewSaveService=freeze({
      saveToday:saveDayRecord,
      handleRollover:handleStudyDayRollover,
      hasSaveableDay:hasSaveableStudyDay,
      isRolledOver:studyDayRolledOver,
      status:()=>freeze({rolloverSaveInProgress,saveDayInProgress,activeSessionPersistenceBlocked})
    });
    const ReviewViewContract=freeze({
      ...ReviewView,
      copy:copyReview,
      toggleCopyMenu:toggleCopyReportMenu,
      resetCopySelection:resetCopyReportSelection,
      copyText:copyTextToClipboard,
      recalculateStats:recalcStats,
      renderCompletionChange,
      renderUnfinishedNote:renderReviewUnfinishedNote,
      setDisclosures:setReviewDetailDisclosures,
      syncFromTimer:syncRptFromTimer
    });
    const SharedReviewPresentation=freeze({
      createSavedDayTaskCard:createSavedDayTaskReviewCard,
      createPomodoroSummaryLine,
      populatePracticeRunTable,
      pomodoroSummaryFromTasks,
      pomodoroSummaryText,
      completionSourceLabel,
      durationLabel,
      optionalDurationLabel,
      optionalPercentLabel
    });
    return freeze({
      format:'study-director.review-subsystem',
      contractVersion:1,
      ReviewModel,ReviewEditor,ReviewSaveService,ReviewView:ReviewViewContract,
      SharedReviewPresentation
    });
  }
  return freeze({
    format:'study-director.review',
    contractVersion:1,
    createReviewSubsystem
  });
});
})();
