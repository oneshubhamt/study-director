import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {PwaEnvironment,PwaLifecycleController,PwaLifecycleInput,PwaLifecycleStatus,PwaPreparationResult,PwaUpdateContext,PwaUpdateGuard} from '../../types/pwa-lifecycle.ts';
import type {PwaLifecycleModule} from './pwa-lifecycle.ts';

interface OwnershipStatus{readonly state:string;readonly revision:number;readonly hydrating?:boolean;readonly takeoverPending?:boolean;readonly resolving?:boolean}
interface SessionLifecycleStatus{readonly ready?:boolean;readonly transitioning?:boolean;readonly revision:number}
interface MutationStatus{readonly active?:string;readonly foreign?:boolean;readonly recoveryFault?:string}
interface ReviewSaveStatus{readonly rolloverSaveInProgress?:boolean;readonly saveDayInProgress?:boolean;readonly activeSessionPersistenceBlocked?:boolean}
interface NoteFailure{readonly failed?:boolean;readonly message?:string}
interface LiveSaveResult{readonly ok?:boolean;readonly value?:Readonly<{revision?:unknown}>|null;readonly storage?:Readonly<{idb?:unknown}>}
interface LoadedSession{readonly value?:Readonly<{revision?:unknown}>|null;readonly storage?:Readonly<{idb?:unknown}>;readonly error?:unknown}
interface UpdateAuthority{assert():void}
interface ProviderHold{readonly settled:PromiseLike<unknown>;release():void}
interface UpdateNotice{readonly visible:boolean;readonly kind:'update';readonly title:string;readonly message:string;readonly actionLabel:string}
interface NavigatorPort{readonly onLine?:boolean;readonly locks?:Readonly<{request<T>(name:string,options:Readonly<{mode:'exclusive'}>,callback:()=>Promise<T>):Promise<T>}>}
interface UpdateStatePorts{
 startupReady():boolean;ownership():OwnershipStatus;sessionLifecycle():SessionLifecycleStatus;mutation():MutationStatus;reviewSave():ReviewSaveStatus;
 imagePreparationCount():number;attachmentLibraryBusy():boolean;attachmentIngestBusy():boolean;exportsBusy():boolean;backupBusy():boolean;
 providerBusy():boolean;providerDriveBackingUp():boolean;liveTimer():boolean;timerPaused():boolean;timerMode():string;pacerRunning():boolean;
 canMutate():boolean;blockingUiOpen():boolean;workRevision():number;tasks():readonly unknown[];isTrackableTask(task:unknown,index:number):boolean;
 isTaskResolved(index:number):boolean;currentTaskIndex():number;
}
interface ReservationPorts{
 settleMutation():PromiseLike<unknown>;suspendProvider():ProviderHold;settleRichTextAssets():PromiseLike<unknown>;settleMaintenance():PromiseLike<unknown>;settleAttachmentIntegrity():PromiseLike<unknown>;
 quiesceRichText<T>(run:()=>Promise<T>):Promise<T>;runExclusive<T>(name:string,run:(authority:UpdateAuthority)=>Promise<T>):Promise<T>;
 runManagedRecovery<T>(run:()=>Promise<T>):Promise<T>;projectOwnership():void;foregroundChanged():void;
}
interface PersistencePorts{
 settleDiary():PromiseLike<boolean>;flushPlanDraft():PromiseLike<boolean>;planAuthoredText():string|null;planReadDraft():string|null;
 savePlanDraft():PromiseLike<boolean>;settlePlanData():PromiseLike<unknown>;readStoredPlan():PromiseLike<Readonly<{draft?:unknown}>>;
 flushPendingReview():PromiseLike<boolean>;settleReviewEditor():PromiseLike<unknown>;writeLiveDraft(allowDuringRecoveryQuiescence:boolean):PromiseLike<LiveSaveResult|null>;
 flushNotes():PromiseLike<unknown>;noteFailure():NoteFailure|null;flushDeletionRecovery():PromiseLike<boolean>;settleActiveSession():PromiseLike<unknown>;
 loadActiveSession():PromiseLike<LoadedSession>;activeSessionIssue(loaded:LoadedSession):string;
}
interface EffectPorts{
 automaticBackupsWaiting():boolean;backupBeforeUpdate():PromiseLike<unknown>;pauseTimer():unknown;togglePacer():unknown;scheduleSyncStatus():unknown;
 publishNotice(value:UpdateNotice):unknown;capture(scope:string,error:unknown,level:'warn'|'error'):unknown;
 localGet(key:string,fallback:string):string;localSet(key:string,value:string):boolean;
}
interface PwaUpdateHostInput{
 readonly configuration:Readonly<{assetId:string;buildId:string;reloadSessionKey:string;scope:string;workerUrl:unknown;updateCheckStorageKey:string;primaryState:string;secondaryState:string;runningTimerMode:string}>;
 readonly lifecycle:Readonly<{module:PwaLifecycleModule;environment:PwaEnvironment}>;
 readonly environment:Readonly<{document:Document;window:Window;navigator:NavigatorPort;setTimeout(callback:()=>void,delay:number):number;clearTimeout(handle:number):void;now():number}>;
 readonly state:Readonly<UpdateStatePorts>;readonly reservation:Readonly<ReservationPorts>;readonly persistence:Readonly<PersistencePorts>;readonly effects:Readonly<EffectPorts>;
}
interface UpdateDiagnostics{readonly nextCheckAt:number;readonly lastSuccessfulCheckAt:number;readonly failureCount:number}
export interface PwaUpdateHostController{
 readonly format:'study-director.pwa-update-host';readonly contractVersion:1;readonly lifecycle:PwaLifecycleController;
 install():Promise<void>;scheduleEvaluation(delay?:number):boolean;scheduleCheck(minimumDelay?:number):boolean;clearCheckTimer():void;
 applyFromUi():Promise<boolean>;evaluateAutomatic():Promise<boolean>;reservationActive():boolean;updateReady():boolean;diagnostics():UpdateDiagnostics;
 blockReason(options?:Readonly<Record<string,unknown>>):string;reserve(context:PwaUpdateContext):PwaUpdateGuard;prepare(context?:Partial<PwaUpdateContext>):Promise<PwaPreparationResult>;
 retryDelay():number;checkIfDue(options?:Readonly<{force?:boolean}>):Promise<boolean>;renderStatus(state:PwaLifecycleStatus):void;
}

const sdPwaUpdateHostFactory=(()=>{
 const registry=(globalThis as unknown as Record<symbol,unknown>)[Symbol.for('studyDirector.internalModules.v1')] as ModuleRegistration<'pwa-update-host','study-director.pwa-update-host-module'>|undefined;
 if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1)throw new Error('Study Director internal module registry is unavailable or incompatible.');
 const {exactFrozenObject:exactObject,functionPort:functions}=registry.contracts;
 const createModule=()=>{
  const createController=(input:Readonly<PwaUpdateHostInput>):Readonly<PwaUpdateHostController>=>{
   if(!input||!Object.isFrozen(input))throw new TypeError('PWA update host input must be frozen.');
   exactObject(input,['configuration','effects','environment','lifecycle','persistence','reservation','state'],'PWA update host input');
   functions(input.state,['startupReady','ownership','sessionLifecycle','mutation','reviewSave','imagePreparationCount','attachmentLibraryBusy','attachmentIngestBusy','exportsBusy','backupBusy','providerBusy','providerDriveBackingUp','liveTimer','timerPaused','timerMode','pacerRunning','canMutate','blockingUiOpen','workRevision','tasks','isTrackableTask','isTaskResolved','currentTaskIndex'],'PWA update state ports');
   functions(input.reservation,['settleMutation','suspendProvider','settleRichTextAssets','settleMaintenance','settleAttachmentIntegrity','quiesceRichText','runExclusive','runManagedRecovery','projectOwnership','foregroundChanged'],'PWA update reservation ports');
   functions(input.persistence,['settleDiary','flushPlanDraft','planAuthoredText','planReadDraft','savePlanDraft','settlePlanData','readStoredPlan','flushPendingReview','settleReviewEditor','writeLiveDraft','flushNotes','noteFailure','flushDeletionRecovery','settleActiveSession','loadActiveSession','activeSessionIssue'],'PWA update persistence ports');
   functions(input.effects,['automaticBackupsWaiting','backupBeforeUpdate','pauseTimer','togglePacer','scheduleSyncStatus','publishNotice','capture','localGet','localSet'],'PWA update effect ports');
   const {configuration,environment,state,reservation,persistence,effects}=input,doc=environment.document,win=environment.window;
   const READY_DELAY=650,SAFETY_RETRY=5*60*1000,EXTERNAL_RETRY=5000,CHECK_INTERVAL=24*60*60*1000,CHECK_RETRY_BASE=5*60*1000,CHECK_RETRY_MAX=60*60*1000,CHECK_LOCK='study-director-pwa-update-check-v1',EDIT_IDLE=1800;
   let latest:PwaLifecycleStatus|null=null,retryTimer:number|null=null,evaluationRunning=false,automaticBlock='',checkTimer:number|null=null,checkDueAt=0,checkRunning=false,lastEditableAt=0,lastSuccessMemory=0,failureCount=0,retryAt=0;
   type ReservationToken={requestId:string;ownerRevision:number;ownerState:string;workRevision:number|null;authority:UpdateAuthority|null};
   let activeReservation:ReservationToken|null=null;
   let lifecycle:PwaLifecycleController;

   const now=()=>environment.now();
   function recentEditable(){return lastEditableAt>0&&now()-lastEditableAt<EDIT_IDLE;}
   function appliedPlanEnded(){
    const tasks=state.tasks();if(!tasks.length)return false;
    const trackable=tasks.map((task,index)=>({task,index})).filter(row=>state.isTrackableTask(row.task,row.index));
    return trackable.length?trackable.every(row=>state.isTaskResolved(row.index)):state.currentTaskIndex()>=tasks.length;
   }
   function optionBoolean(options:Readonly<Record<string,unknown>>,key:string){return options[key]===true;}
   function blockReason(options:Readonly<Record<string,unknown>>={}){
    const automatic=optionBoolean(options,'automatic'),ignoreActiveTimers=optionBoolean(options,'ignoreActiveTimers'),requestId=typeof options['requestId']==='string'?options['requestId']:'';
    const ownReservation=activeReservation?.requestId===requestId&&!!requestId;
    if(activeReservation&&!ownReservation)return 'Another update is already preparing this window.';
    if(!state.startupReady())return 'Study Director is still starting. Try again in a moment.';
    const ownership=state.ownership();
    if(ownership.hydrating||ownership.takeoverPending||ownership.resolving||![configuration.primaryState,configuration.secondaryState].includes(ownership.state))return 'Study Director ownership is still changing. Wait for this tab to settle, then try again.';
    const follower=optionBoolean(options,'external')&&ownership.state===configuration.secondaryState;
    if(ownership.state!==configuration.primaryState&&!follower)return automatic?'The primary Study Director window will apply this update when saved state is safe.':'This is a read-only secondary window. Update from the Study Director window that currently has control.';
    const session=state.sessionLifecycle();if(session.transitioning||!session.ready&&!follower)return 'Study Director is still reconciling session state. Try again when it is ready.';
    const mutation=state.mutation();if(mutation.active&&!(ownReservation&&mutation.active==='pwa-update'))return 'A '+mutation.active+' operation is still active. The update will retry after it finishes.';
    if(mutation.foreign&&!follower)return 'Another Study Director window is changing stored data. The update will retry after it finishes.';
    if(mutation.recoveryFault)return 'Stored-data recovery must finish before updating: '+mutation.recoveryFault;
    const review=state.reviewSave();if(review.rolloverSaveInProgress||review.saveDayInProgress||review.activeSessionPersistenceBlocked)return 'A Review save is still finishing. Wait for it to complete.';
    if(state.imagePreparationCount()>0||state.attachmentLibraryBusy()||state.attachmentIngestBusy())return 'An attachment is still being prepared or saved.';
    if(state.exportsBusy()||state.backupBusy()||state.providerBusy())return 'A backup, import, or storage-provider operation is still active.';
    if(!follower&&!ignoreActiveTimers&&state.liveTimer()&&!state.timerPaused()&&state.timerMode()===configuration.runningTimerMode)return 'Pause or finish the live timer before updating.';
    if(!follower&&!ignoreActiveTimers&&state.pacerRunning())return 'Pause or finish the Practice Pacer before updating.';
    if(!state.canMutate()&&!follower)return 'This window cannot safely write saved state yet. Wait for storage and ownership to settle.';
    if(!ownReservation&&state.blockingUiOpen())return 'Finish the open dialog or file selection before updating.';
    if(automatic&&recentEditable())return 'Automatic update is waiting for the current edit to settle.';
    return '';
   }
   function reserve(context:PwaUpdateContext):PwaUpdateGuard{
    const reason=blockReason(context as unknown as Readonly<Record<string,unknown>>);if(reason)throw new Error(reason);
    const owner=state.ownership(),follower=context.external&&owner.state===configuration.secondaryState;
    const token:ReservationToken={requestId:context.requestId,ownerRevision:owner.revision,ownerState:owner.state,workRevision:null,authority:null};
    let released=false,resolveReady!:()=>void,rejectReady!:(error:unknown)=>void,unlock!:()=>void;
    const ready=new Promise<void>((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;}),held=new Promise<void>(resolve=>{unlock=resolve;});ready.catch(()=>undefined);activeReservation=token;
    const dialog=doc.createElement('dialog');dialog.id='pwa-update-progress';dialog.className='interaction-dialog';dialog.setAttribute('aria-labelledby','pwa-update-progress-title');dialog.setAttribute('aria-describedby','pwa-update-progress-message');
    const body=doc.createElement('div');body.className='interaction-body';const title=doc.createElement('h2');title.id='pwa-update-progress-title';title.textContent='Updating Study Director';const copy=doc.createElement('p');copy.id='pwa-update-progress-message';copy.setAttribute('role','status');copy.textContent='Saving your work. Editing will resume if the update cannot finish.';body.append(title,copy);dialog.append(body);dialog.addEventListener('cancel',event=>event.preventDefault());doc.body.append(dialog);
    const block=(event:Event)=>{if(!released&&!dialog.contains(event.target as Node)){event.preventDefault();event.stopImmediatePropagation();}},blockedEvents=['beforeinput','click','dblclick','keydown','paste','cut','drop','submit','change'];
    for(const type of blockedEvents)win.addEventListener(type,block,true);
    const validate=()=>{if(released||context.signal.aborted||activeReservation!==token)return false;const current=state.ownership();if(current.state!==token.ownerState||current.revision!==token.ownerRevision||current.hydrating||current.takeoverPending||current.resolving)return false;if(token.workRevision!==null&&token.workRevision!==state.workRevision())return false;token.authority?.assert();return !blockReason({...context,requestId:token.requestId} as unknown as Readonly<Record<string,unknown>>);};
    const releaseSignal=()=>{if(released)return;released=true;unlock();rejectReady(new Error('Update preparation was cancelled.'));};context.signal.addEventListener('abort',releaseSignal,{once:true});
    const task=(async()=>{try{dialog.showModal();reservation.projectOwnership();const run=async(authority:UpdateAuthority|null)=>{token.authority=authority;if(released||context.signal.aborted)return;const providerHold=reservation.suspendProvider();try{const settled=Promise.all([providerHold.settled,reservation.settleRichTextAssets(),reservation.settleMaintenance(),reservation.settleAttachmentIntegrity()]);await Promise.race([settled,held]);if(released||context.signal.aborted)return;if(!validate())throw new Error('Study Director control changed while preparing the update.');resolveReady();await held;}finally{providerHold.release();}};if(follower)await reservation.quiesceRichText(()=>run(null));else await reservation.runExclusive('pwa-update',authority=>reservation.runManagedRecovery(()=>run(authority)));}catch(error){rejectReady(error);}finally{context.signal.removeEventListener('abort',releaseSignal);for(const type of blockedEvents)win.removeEventListener(type,block,true);if(activeReservation===token){activeReservation=null;reservation.foregroundChanged();}dialog.close();dialog.remove();reservation.projectOwnership();}})();
    return Object.freeze({ready,validate,release:()=>{releaseSignal();return task;}});
   }
   async function prepare(context:Partial<PwaUpdateContext>={}):Promise<PwaPreparationResult>{
    const initial=blockReason(context as Readonly<Record<string,unknown>>);if(initial)return Object.freeze({ok:false,reason:initial});
    const reservationToken=activeReservation?.requestId===context.requestId?activeReservation:null;
    const check=()=>{context.signal?.throwIfAborted();if(reservationToken&&activeReservation!==reservationToken)throw new Error('Update preparation was cancelled.');};
    if(context.external===true&&state.ownership().state===configuration.secondaryState){if(reservationToken)reservationToken.workRevision=state.workRevision();return Object.freeze({ok:true,reason:''});}
    const workRevision=state.workRevision(),ownershipBefore=state.ownership(),lifecycleBefore=state.sessionLifecycle();
    try{
     if(!reservationToken)await input.reservation.settleMutation();
     if(!await persistence.settleDiary())return Object.freeze({ok:false,reason:'The Diary edit could not be saved. Keep this tab open and retry.'});check();
     if(await persistence.flushPlanDraft()===false)return Object.freeze({ok:false,reason:'The Plan draft could not be saved. Keep this tab open and retry after browser storage recovers.'});check();
     const planText=persistence.planAuthoredText();if(planText!==null&&(persistence.planReadDraft()??'')!==planText&&await persistence.savePlanDraft()===false)return Object.freeze({ok:false,reason:'The Plan draft could not be saved. Keep this tab open and retry after browser storage recovers.'});
     await persistence.settlePlanData();check();const storedPlan=planText!==null?await persistence.readStoredPlan():null;check();if(planText!==null&&storedPlan?.draft!==planText)return Object.freeze({ok:false,reason:'The Plan draft did not pass the update read-back check.'});
     if(await persistence.flushPendingReview()===false)return Object.freeze({ok:false,reason:'The pending reflection could not be saved. Keep this tab open and retry.'});await persistence.settleReviewEditor();check();
     const liveResult=state.tasks().length?await persistence.writeLiveDraft(!!reservationToken):null;check();await persistence.flushNotes();check();
     const noteFailure=persistence.noteFailure();if(noteFailure?.failed)return Object.freeze({ok:false,reason:noteFailure.message||'Notes are not safely stored yet.'});
     if(await persistence.flushDeletionRecovery()!==true)return Object.freeze({ok:false,reason:'Pending deletions could not be safely reconciled. Keep this tab open and retry after browser storage recovers.'});check();
     await persistence.settleActiveSession();const loaded=await persistence.loadActiveSession();await persistence.settleActiveSession();const recoveryIssue=persistence.activeSessionIssue(loaded);if(recoveryIssue)return Object.freeze({ok:false,reason:recoveryIssue});
     if(state.tasks().length){if(!liveResult?.ok||!liveResult.value||liveResult.storage?.idb!==true)return Object.freeze({ok:false,reason:'The active session could not be confirmed in canonical browser storage.'});if(!loaded.value||Number(loaded.value.revision)!==Number(liveResult.value.revision))return Object.freeze({ok:false,reason:'The saved active session did not pass the update read-back check.'});}
    }catch(error){effects.capture('pwa.prepare',error,'error');return Object.freeze({ok:false,reason:error instanceof Error&&error.message?error.message:'Current work could not be safely settled for the update.'});}
    if(workRevision!==state.workRevision())return Object.freeze({ok:false,reason:'New work started while the update was preparing. Retry after it is saved.'});check();
    const finalReason=blockReason(context as Readonly<Record<string,unknown>>);if(finalReason)return Object.freeze({ok:false,reason:finalReason});
    const ownershipAfter=state.ownership(),lifecycleAfter=state.sessionLifecycle();if(ownershipAfter.state!==configuration.primaryState||ownershipAfter.state!==ownershipBefore.state||ownershipAfter.revision!==ownershipBefore.revision||lifecycleAfter.revision!==lifecycleBefore.revision||lifecycleAfter.transitioning)return Object.freeze({ok:false,reason:'Session ownership changed while the update was preparing. Let this tab settle and try again.'});
    if(reservationToken)reservationToken.workRevision=state.workRevision();return Object.freeze({ok:true,reason:''});
   }
   function retryDelay(){return latest?.externalUpdate?EXTERNAL_RETRY:SAFETY_RETRY;}
   function scheduleEvaluation(delay=retryDelay()){if(retryTimer!==null){environment.clearTimeout(retryTimer);retryTimer=null;}if(!latest||!latest.updateReady&&!latest.applying)return false;const editDelay=lastEditableAt?Math.max(0,lastEditableAt+EDIT_IDLE+50-now()):0;retryTimer=environment.setTimeout(()=>{retryTimer=null;void evaluateAutomatic();},Math.max(0,Number(delay)||0,editDelay));return true;}
   async function evaluateAutomatic(){const current=latest;if(!current||!current.updateReady||current.applying||evaluationRunning)return false;const follower=current.externalUpdate&&state.ownership().state===configuration.secondaryState;if(current.bootState==='mismatch'&&!follower){automaticBlock='The loaded release needs confirmation. Use Update Now after saving current work.';return false;}evaluationRunning=true;try{const blocker=blockReason({automatic:true,external:current.externalUpdate});if(blocker){automaticBlock=blocker;return false;}if(state.tasks().length&&!appliedPlanEnded()&&!(current.externalUpdate&&state.ownership().state===configuration.secondaryState)){automaticBlock='Update queued. It will install when the applied Plan ends and saved state is verified.';return false;}if(effects.automaticBackupsWaiting()){automaticBlock='Backing up before the update…';renderStatus(current);}await effects.backupBeforeUpdate();automaticBlock='Updating Study Director…';return lifecycle.apply({automatic:true});}catch(error){effects.capture('pwa.auto-update',error,'warn');automaticBlock='Automatic update is waiting because saved state could not be verified'+(error instanceof Error&&error.message?': '+error.message:'.');return false;}finally{evaluationRunning=false;if(latest&&!latest.applying)renderStatus(latest);if(latest?.updateReady&&!latest.applying&&retryTimer===null)scheduleEvaluation(retryDelay());}}
   function actionLabel(){return state.ownership().state===configuration.primaryState&&(state.liveTimer()&&!state.timerPaused()&&state.timerMode()===configuration.runningTimerMode||state.pacerRunning())?'Pause & Update':'Update Now';}
   async function applyFromUi(){const current=lifecycle.status();if(current.applying)return false;if(!current.updateReady){clearCheckFailure();return checkIfDue({force:true});}const reason=blockReason({automatic:false,ignoreActiveTimers:true,external:current.externalUpdate});if(reason){automaticBlock=reason;renderStatus(current);return false;}if(state.ownership().state===configuration.primaryState){if(state.liveTimer()&&!state.timerPaused()&&state.timerMode()===configuration.runningTimerMode)effects.pauseTimer();if(state.pacerRunning())effects.togglePacer();}if(effects.automaticBackupsWaiting()){automaticBlock='Backing up before the update…';renderStatus(current);}await effects.backupBeforeUpdate();return lifecycle.apply();}
   function renderStatus(current:PwaLifecycleStatus){const control=doc.getElementById('pwa-update-control'),button=doc.getElementById('pwa-update-apply') as HTMLButtonElement|null,messageNode=doc.getElementById('pwa-update-message');if(!control||!button||!messageNode)return;const previous=latest;latest=current;effects.scheduleSyncStatus();button.disabled=!!current.applying||!!current.checking;button.textContent=current.applying?'Updating…':current.checking?'Checking…':!current.updateReady&&current.bootState==='pending'?'Retry confirmation':current.registrationError||current.checkError&&!current.updateReady?'Retry update check':actionLabel();const progress=doc.getElementById('pwa-update-progress-message');if(progress)progress.textContent=current.message||'Preparing the update…';const lifecycleMessage=String(current.message||''),lifecyclePriority=current.applying||['blocked','registering','checking','downloading','installation-failed','registration-failed','boot-failed','boot-pending'].includes(current.phase),messageText=lifecyclePriority?lifecycleMessage:automaticBlock||lifecycleMessage||'Saved state will be checked before reload.';messageNode.textContent=messageText;effects.publishNotice({visible:!!current.updateReady||!!current.applying||!!current.registrationError||!!current.checkError||current.bootState==='mismatch'||current.bootState==='pending'||current.phase==='checking'||current.phase==='downloading',kind:'update',title:current.applying?'Updating Study Director':current.registrationError?'Update checks unavailable':current.checkError?'Update installation needs attention':current.bootState==='pending'?'Update confirmation pending':current.bootState==='mismatch'?'Update not confirmed':current.checking?'Checking for an update':'Study Director update available',message:messageText,actionLabel:button.textContent||''});if(current.checkError&&!previous?.checkError&&!checkRunning){recordCheckFailure();scheduleCheck();}if(!current.updateReady||current.applying){if(retryTimer!==null){environment.clearTimeout(retryTimer);retryTimer=null;}return;}const newlyReady=!previous?.updateReady||previous.waitingReleaseId!==current.waitingReleaseId;if(newlyReady)scheduleEvaluation(READY_DELAY);else if(retryTimer===null)scheduleEvaluation(retryDelay());}
   function lastCheckAt(){let stored=0;try{const value=Number(effects.localGet(configuration.updateCheckStorageKey,'')||0);stored=Number.isFinite(value)&&value>0?value:0;}catch{}return Math.max(stored,lastSuccessMemory);}
   function markCheck(at=now()){const exact=Math.max(1,Math.floor(Number(at)||now()));lastSuccessMemory=Math.max(lastSuccessMemory,exact);try{return effects.localSet(configuration.updateCheckStorageKey,String(exact));}catch{return false;}}
   function checkDue(at=now()){const last=lastCheckAt();return !last||Math.max(0,Number(at)||now())-last>=CHECK_INTERVAL;}
   function checkBackoff(count=failureCount){const exponent=Math.max(0,Math.min(8,Math.floor(Number(count)||1)-1));return Math.min(CHECK_RETRY_MAX,CHECK_RETRY_BASE*(2**exponent));}
   function clearCheckFailure(){failureCount=0;retryAt=0;}function recordCheckFailure(at=now()){failureCount=Math.min(9,failureCount+1);retryAt=Math.max(1,Math.floor(Number(at)||now()))+checkBackoff();return retryAt;}
   function clearCheckTimer(){checkDueAt=0;if(checkTimer!==null){environment.clearTimeout(checkTimer);checkTimer=null;}}
   function scheduleCheck(minimumDelay=0){clearCheckTimer();const current=lifecycle.status();if(!current.supported||state.ownership().state!==configuration.primaryState)return false;if(current.registrationError&&!retryAt)recordCheckFailure();const currentTime=now(),last=lastCheckAt(),dueIn=current.registered&&!current.checkError&&last?Math.max(0,last+CHECK_INTERVAL-currentTime):0,retryIn=retryAt?Math.max(0,retryAt-currentTime):0,delay=Math.max(dueIn,retryIn,Math.max(0,Number(minimumDelay)||0));checkDueAt=currentTime+delay;checkTimer=environment.setTimeout(()=>{checkTimer=null;checkDueAt=0;void checkIfDue();},delay);return true;}
   async function checkIfDue({force=false}:Readonly<{force?:boolean}>={}){const current=lifecycle.status();if(!current.supported||checkRunning||!force&&(current.registered&&!current.checkError&&!checkDue()||retryAt>now()))return false;if(state.ownership().state!==configuration.primaryState||environment.navigator.onLine===false)return false;if(!force&&(state.providerBusy()||state.providerDriveBackingUp())){scheduleCheck(30000);return false;}checkRunning=true;let deferred=false;const perform=async()=>{const status=lifecycle.status();if(!force&&(status.registered&&!status.checkError&&!checkDue()||retryAt>now()))return false;if(!force&&(state.providerBusy()||state.providerDriveBackingUp())){deferred=true;return false;}const success=await lifecycle.checkForUpdate();if(success){markCheck();clearCheckFailure();return true;}recordCheckFailure();return false;};try{const locks=environment.navigator.locks;if(locks&&typeof locks.request==='function')return await locks.request(CHECK_LOCK,{mode:'exclusive'},perform);return await perform();}catch(error){recordCheckFailure();effects.capture('pwa.update-check-scheduler',error,'warn');return false;}finally{checkRunning=false;scheduleCheck(deferred?30000:0);}}
   lifecycle=input.lifecycle.module.createCoordinator(Object.freeze({configuration:Object.freeze({assetId:configuration.assetId,buildId:configuration.buildId,reloadSessionKey:configuration.reloadSessionKey,scope:configuration.scope,workerUrl:configuration.workerUrl}),environment:input.lifecycle.environment,hooks:Object.freeze({capture:(name:string,error:unknown)=>effects.capture(name,error,'warn'),prepare,reserve,render:renderStatus})} satisfies PwaLifecycleInput));
   if(!Object.isFrozen(lifecycle)||lifecycle.format!=='study-director.pwa-lifecycle'||lifecycle.contractVersion!==1)throw new Error('Study Director PWA lifecycle coordinator is unavailable or incompatible.');
   doc.addEventListener('input',event=>{const target=event.target;if(!target||typeof target!=='object'||!('matches' in target))return;const element=target as HTMLElement;if(!(element.isContentEditable||element.matches('input,textarea,select,[contenteditable]:not([contenteditable="false"])')))return;lastEditableAt=now();scheduleEvaluation(EDIT_IDLE+50);},true);
   doc.addEventListener('visibilitychange',()=>{if(!doc.hidden){scheduleCheck(250);scheduleEvaluation(250);}});
   win.addEventListener('focus',()=>{scheduleCheck(250);scheduleEvaluation(250);});win.addEventListener('online',()=>{scheduleCheck(250);scheduleEvaluation(250);});win.addEventListener('storage',event=>{if(event.key===configuration.updateCheckStorageKey)scheduleCheck();});
   const controller:Readonly<PwaUpdateHostController>=Object.freeze({format:'study-director.pwa-update-host',contractVersion:1,lifecycle,install:async()=>{await lifecycle.install();scheduleCheck(750);},scheduleEvaluation,scheduleCheck,clearCheckTimer,applyFromUi,evaluateAutomatic,reservationActive:()=>!!activeReservation,updateReady:()=>!!(latest?.updateReady&&!latest.applying),diagnostics:()=>Object.freeze({nextCheckAt:checkDueAt,lastSuccessfulCheckAt:lastCheckAt(),failureCount}),blockReason,reserve,prepare,retryDelay,checkIfDue,renderStatus});
   return controller;
  };
  return Object.freeze({format:'study-director.pwa-update-host-module' as const,contractVersion:1 as const,createController});
 };
 registry.define('pwa-update-host',1,createModule);return createModule;
})();
export type PwaUpdateHostModule=ReturnType<typeof sdPwaUpdateHostFactory>;
