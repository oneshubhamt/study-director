import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {ActiveSession,ActualRecord,SessionSnapshot,SessionTaskState} from '../../types/record-models.ts';
import type {LiveActualRecord,RuntimeEvidence} from '../../types/timer-engine.ts';
import type {ActiveSessionPayloadOptions,LiveDraftWriteOptions,SessionHostController,SessionHostInput,SessionHostModule as SessionHostContract,SessionClassification} from '../../types/session-host.ts';
import type {SessionResult} from '../../types/repositories.ts';

const sdSessionHostFactory=(()=>{
'use strict';
const registry=(globalThis as unknown as Record<symbol,unknown>)[Symbol.for('studyDirector.internalModules.v1')] as ModuleRegistration<'session-host','study-director.session-host-module'>|undefined;
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
function cloneActualRecord(value:LiveActualRecord):ActualRecord{
  const clone=JSON.parse(JSON.stringify(value)) as Record<string,unknown>;
  delete clone['idx'];delete clone['taskId'];
  return clone as ActualRecord;
}

function createController(input:Readonly<SessionHostInput>):Readonly<SessionHostController>{
  exactObject(input,['configuration','codec','repository','canonical','snapshot','domain','persistence','lifecycle','apply','reset','installation','clock','environment'],'Session host input');
  const {configuration,codec,repository,canonical,snapshot,domain,persistence,lifecycle,apply,reset,installation,clock,environment}=input;
  exactObject(configuration,['activeSessionId','activeSessionVersion','sessionSnapshotVersion','maxCarryForwardChars','maxScheduleChars','maxTasksPerDay','debounceMs','timerSnapshotIntervalMs','completionNone','practicePauseCauses'],'Session host configuration');
  functions(codec,['canonicalize','sanitizeCurrent','sanitizeSessionSnapshot'],'Session codec port');
  functions(repository,['save','load','clear','readLocal','nextRevision','settled'],'Session repository port');
  functions(canonical,['same'],'Session canonical comparison port');
  functions(snapshot,['tasks','ensureTaskIds','captureEvidence','timerPayload','reviewSnapshot','practiceSnapshot','practiceRestore','getReviewDate','scheduleFingerprint','sessionFingerprint','appliedScheduleText','getCarryForward','setCarryForward','clearProgress','sanitizeAdjustedSchedule','invalidateScheduleDerived','setCurrentTask','timerRestoreValid'],'Session snapshot port');
  if(!snapshot.taskIdentity||!snapshot.taskState||!snapshot.timerState)throw new TypeError('Session runtime state ports are incomplete.');
  functions(domain,['normalizeCompletionSource','clampCompletion','cleanDayRevision','clampText','isCanonicalScheduleText','isValidIsoDate','todayISO'],'Session domain port');
  functions(persistence,['canMutate','ownsSession','canProject','ownershipRevision','recoveryQuiesced','persistenceBlocked','recoveryWorkActive','timerSnapshotEligible','markContentChanged','snapshotForWrite','reportResult','warn'],'Session persistence port');
  functions(lifecycle,['revision','run'],'Session lifecycle port');
  functions(apply,['readPlanDraft','writePlanDraft','previewPlanDraft','setStudyDate','applySessionSchedule'],'Session apply port');
  functions(reset,['stopTimerPresentation','invalidatePresentation','resetCountdown','setCurrentTask','resetBreak','setEmptyTimerMode','clearTimerSession','hydrateReview','invalidateSchedule','resetPlanSession','clearProgress','clearCarryForward','resetPractice','pausePracticeForSessionEnd'],'Session reset port');
  functions(installation,['id'],'Session installation port');
  functions(clock,['nowMs','nowIso'],'Session clock port');
  functions(environment,['clearTimeout','setTimeout'],'Session environment port');

  let liveDraftSaveTimer:number|null=null,liveDraftSaveDueAt=0,lastTimerSnapshotMs=0,pendingOptions:LiveDraftWriteOptions|null=null,suppressionDepth=0;
  let localTransitionDepth=0,runtimeConflicted=false;
  const mergeOptions=(base:Readonly<LiveDraftWriteOptions>|null,next:Readonly<LiveDraftWriteOptions>|null):LiveDraftWriteOptions=>({
    markChanged:(base?base.markChanged!==false:false)||(next?next.markChanged!==false:false),
    backupCapture:!!(base?.backupCapture||next?.backupCapture),
    allowDuringRecoveryQuiescence:!!(base?.allowDuringRecoveryQuiescence||next?.allowDuringRecoveryQuiescence),
    strictDurability:!!(base?.strictDurability||next?.strictDurability),
    emergency:!!(base?.emergency||next?.emergency),
    ...(Number.isFinite(Number(next?.delayMs))?{delayMs:Number(next?.delayMs)}:Number.isFinite(Number(base?.delayMs))?{delayMs:Number(base?.delayMs)}:{})
  });
  const persistenceSuppressed=()=>suppressionDepth>0;
  function blocked(options:Readonly<LiveDraftWriteOptions>={}){
    const recoveryCheckpoint=options.allowDuringRecoveryQuiescence===true&&persistence.recoveryWorkActive();
    if(localTransitionDepth||runtimeConflicted)return true;
    return (persistenceSuppressed()||persistence.recoveryQuiesced())&&options.allowDuringRecoveryQuiescence!==true||!persistence.canMutate()&&!recoveryCheckpoint||persistence.persistenceBlocked();
  }
  function captureSnapshot(evidence:RuntimeEvidence|null=null):SessionSnapshot|null{
    const tasks=snapshot.tasks();if(!tasks.length)return null;
    snapshot.ensureTaskIds();
    const runtimeEvidence=evidence||snapshot.captureEvidence(),taskState:Record<string,SessionTaskState>=Object.create(null) as Record<string,SessionTaskState>;
    for(let idx=0;idx<Math.min(tasks.length,configuration.maxTasksPerDay);idx++){
      const taskId=snapshot.taskIdentity.idAt(idx);if(!taskId)continue;
      const state:SessionTaskState={};
      const resolved=snapshot.taskState.resolvedState(idx);if(resolved)state.resolvedState=resolved;
      const completion=snapshot.taskState.getField(idx,'completion');if(Number.isFinite(Number(completion)))state.completion=domain.clampCompletion(completion);
      const source=domain.normalizeCompletionSource(snapshot.taskState.getField(idx,'completionSource'));if(source!==configuration.completionNone)state.completionSource=source;
      const progress=snapshot.taskState.getField(idx,'notes');
      if(progress&&(progress.done!==undefined||progress.total!==undefined))state.progress={...progress};
      const actualValue=runtimeEvidence.actualTime[String(idx)],actualSeconds=Number(actualValue);
      const actualClock=snapshot.taskState.getField(idx,'actualClock'),record=runtimeEvidence.actualRecords[String(idx)];
      if(actualValue!==undefined||actualClock||record){
        state.actual={};
        if(actualValue!==undefined)state.actual.seconds=Math.max(0,Math.round(Number.isFinite(actualSeconds)?actualSeconds:0));
        if(actualClock)state.actual.clock={...actualClock};
        if(record)state.actual.record=cloneActualRecord(record);
      }
      if(Object.keys(state).length)taskState[taskId]=state;
    }
    const practice=snapshot.practiceSnapshot(),reviewDate=snapshot.getReviewDate(),date=snapshot.timerState.studyDate||reviewDate;
    // A schedule is loaded before its Review editor is reconciled. Never
    // publish the new Active Session under another day's date or reflection.
    const review=reviewDate===date?snapshot.reviewSnapshot():{reflection:'',studyQuality:null};
    return snapshot.timerState.projectSessionSnapshot({
      version:configuration.sessionSnapshotVersion,date,fingerprint:snapshot.scheduleFingerprint(),taskState,
      timerRuntime:snapshot.timerPayload(),latestCarryForward:domain.clampText(snapshot.getCarryForward(),configuration.maxCarryForwardChars),
      review,...(practice?{practice}:{}),updatedAt:clock.nowIso()
    }) as SessionSnapshot|null;
  }
  function applySnapshot(value:SessionSnapshot|null):boolean{
    if(!value||!snapshot.tasks().length)return false;
    const timerState=snapshot.timerState;
    timerState.contentRevision=domain.cleanDayRevision(value.contentRevision);timerState.savedRevision=Math.min(timerState.contentRevision,domain.cleanDayRevision(value.savedRevision));
    snapshot.clearProgress();snapshot.setCarryForward('');timerState.adjustedSchedule={};
    const indexMap=snapshot.taskIdentity.indexMap(),adjustments:Record<string,unknown>={};
    for(const [taskId,entry] of Object.entries(value.scheduleAdjustments||{})){
      const idx=snapshot.taskIdentity.indexForId(taskId,indexMap);if(idx!==null)adjustments[String(idx)]=entry;
    }
    timerState.adjustedSchedule=snapshot.sanitizeAdjustedSchedule(adjustments);snapshot.invalidateScheduleDerived({adjustments:true,render:true});
    for(const [taskId,state] of Object.entries(value.taskState||{})){
      const idx=snapshot.taskIdentity.indexForId(taskId,indexMap);if(idx===null)continue;
      if(state.resolvedState==='done'||state.resolvedState==='skipped')snapshot.taskState.setResolved(idx,state.resolvedState);
      if(Number.isFinite(Number(state.completion)))snapshot.taskState.setField(idx,'completion',domain.clampCompletion(state.completion));
      const source=domain.normalizeCompletionSource(state.completionSource);if(source!==configuration.completionNone)snapshot.taskState.setField(idx,'completionSource',source);
      if(state.progress)snapshot.taskState.setField(idx,'notes',{...state.progress});
      if(state.actual&&typeof state.actual==='object'){
        if(Number.isFinite(Number(state.actual.seconds)))snapshot.taskState.setField(idx,'actualTime',Math.max(0,Math.round(Number(state.actual.seconds))));
        if(state.actual.clock)snapshot.taskState.setField(idx,'actualClock',{...state.actual.clock});
        if(state.actual.record)snapshot.taskState.setField(idx,'actualRecords',{...state.actual.record,idx,taskId});
      }
    }
    timerState.pendingRestore=value.timerRuntime||null;snapshot.setCarryForward(domain.clampText(value.latestCarryForward||'',configuration.maxCarryForwardChars));
    const currentIndex=snapshot.taskIdentity.indexForId(value.currentTaskId,indexMap);snapshot.setCurrentTask(currentIndex===null?0:currentIndex);
    const runtime=value.timerRuntime,valid=snapshot.timerRestoreValid(runtime);
    const forcedPauseCause=!valid?configuration.practicePauseCauses.session:runtime?.pendingInactiveGap?configuration.practicePauseCauses.gap:runtime?.paused?configuration.practicePauseCauses.main:null;
    const savedAtMs=forcedPauseCause===configuration.practicePauseCauses.gap?(runtime?.pendingInactiveGap?.lastMs||Date.parse(String(value.updatedAt||''))||clock.nowMs()):(Date.parse(String(value.updatedAt||''))||clock.nowMs());
    snapshot.practiceRestore(value.practice,{forcePaused:!!forcedPauseCause,pauseCause:forcedPauseCause||configuration.practicePauseCauses.session,savedAtMs});
    // Review is part of the stored session snapshot. Restore it before timer
    // restoration can checkpoint adjusted runtime state, or that checkpoint
    // could supersede the canonical session with an unhydrated empty Review.
    reset.hydrateReview(value.date,value.review);
    return true;
  }
  function sessionSnapshot(session:ActiveSession|null):SessionSnapshot|null{
    if(!session)return null;
    return codec.sanitizeSessionSnapshot(session.snapshot,session.date,snapshot.sessionFingerprint(session),session.revision);
  }
  function classify(session:ActiveSession|null):SessionClassification{
    if(!session||session.id!==configuration.activeSessionId||Number(session.version)!==configuration.activeSessionVersion||!Number(session.revision)||!domain.isValidIsoDate(session.date)||!domain.isCanonicalScheduleText(session.scheduleText)||!sessionSnapshot(session))return 'invalid';
    const today=domain.todayISO();
    if(session.date<today)return 'previous';if(session.date>today)return 'future';
    return session.status==='suspended'?'today-suspended':'today-active';
  }
  function payload(value:SessionSnapshot|null=captureSnapshot(),options:Readonly<ActiveSessionPayloadOptions>={}):ActiveSession|null{
    const tasks=snapshot.tasks(),scheduleText=domain.clampText(snapshot.appliedScheduleText(),configuration.maxScheduleChars);if(!tasks.length||!scheduleText||!value)return null;
    const status=options.status==='suspended'?'suspended':'active',now=clock.nowIso();
    const raw:ActiveSession={id:configuration.activeSessionId,type:'activeSession',version:configuration.activeSessionVersion,revision:repository.nextRevision(Number(options.revision)||0),date:value.date,status,runningOn:installation.id(),scheduleText,snapshot:value,suspendedAt:status==='suspended'?(options.suspendedAt||now):null,updatedAt:now};
    // Captured live evidence is a producer value, not an already stored record.
    // Normalize it once; imported/read-back records still require exact validation.
    return codec.canonicalize(raw);
  }
  async function load(options:Readonly<{strict?:boolean}>={}):Promise<SessionResult>{
    return repository.load(0,{strict:options.strict===true});
  }
  function restoreLocalRecovery():boolean{
    const session=repository.readLocal();
    const date=snapshot.timerState.studyDate||snapshot.getReviewDate();
    if(!session||session.date!==date||snapshot.sessionFingerprint(session)!==snapshot.scheduleFingerprint())return false;
    const value=sessionSnapshot(session);
    const restored=!!value&&applySnapshot(value);
    if(restored)runtimeConflicted=false;
    return restored;
  }
  function report(result:SessionResult,action:'save'|'clear'){persistence.reportResult(result,action);return result;}
  async function writeSnapshot(value:SessionSnapshot|null,options:Readonly<LiveDraftWriteOptions>={}):Promise<SessionResult|null>{
    if(blocked(options))return null;
    const session=payload(value);if(!session)return null;
    try{options.assertOrigin?.();const saved=await repository.save(session,{emergency:options.emergency===true,backupCapture:options.backupCapture===true,strictDurability:options.strictDurability===true,...(options.assertOrigin?{assertOrigin:options.assertOrigin}:{})});options.assertOrigin?.();return report(saved,'save');}
    catch(error){options.assertOrigin?.();const failed:SessionResult={ok:false,value:session,error,storage:{local:false,idb:false}};report(failed,'save');return failed;}
  }
  type TransitionAuthority={owner:number;life:number};
  type LocalTransition={authority:TransitionAuthority;before:ActiveSession|null;rollback:ActiveSession|null;attempted:ActiveSession|null|undefined;runtimeChanged:boolean};
  const authorityCurrent=(authority:TransitionAuthority)=>persistence.ownsSession()&&persistence.ownershipRevision()===authority.owner&&lifecycle.revision()===authority.life;
  function assertTransition(authority:TransitionAuthority){
    if(!authorityCurrent(authority))throw new Error('The Active Session transition was superseded; newer progress was preserved.');
  }
  function blockConflictedRuntime(authority:TransitionAuthority){
    if(authorityCurrent(authority)){
      runtimeConflicted=true;
      cancelPendingLiveDraftSave();
      reset.stopTimerPresentation();
    }
  }
  async function transitionRead(authority:TransitionAuthority):Promise<ActiveSession|null>{
    assertTransition(authority);
    const read=await repository.load(0,{strict:true});
    assertTransition(authority);
    if(!read.ok||read.error)throw read.error||new Error('The canonical Active Session could not be read safely.');
    return read.value;
  }
  async function rollbackLocalTransition(transition:LocalTransition,source:string){
    const {authority,before,rollback,attempted,runtimeChanged}=transition;
    assertTransition(authority);
    // No operation may adopt a successor as its own rollback precondition.
    const latest=await transitionRead(authority);
    if(!canonical.same(latest,before)&&(attempted===undefined||!canonical.same(latest,attempted))){
      blockConflictedRuntime(authority);
      throw new Error('The canonical session advanced; its successor was preserved.');
    }
    if(!rollback)return;
    const intended=codec.sanitizeCurrent({...rollback,revision:repository.nextRevision(Math.max(before?.revision||0,attempted?.revision||0,rollback.revision)),updatedAt:clock.nowIso()});
    if(!intended)throw new Error('The pre-transition Active Session snapshot is invalid.');
    const saved=await repository.save(intended,{strictDurability:true,expectedCanonical:latest,recoveryFallback:true});
    assertTransition(authority);
    report(saved,'save');
    const recovered=saved.value?sessionSnapshot(saved.value):null;
    if(!saved.ok||!recovered||!canonical.same(recovered,intended.snapshot))throw saved.error||new Error('The pre-transition recovery snapshot was not preserved.');
    if(saved.storage.idb)await requireCanonicalWrite(saved,intended,source);
    else if(!saved.storage.local||!canonical.same(repository.readLocal(),intended))throw saved.error||new Error('The emergency recovery snapshot could not be verified.');
    assertTransition(authority);
    if(runtimeChanged){
      const restored=await withPersistenceSuppressed(()=>applyStoredSession(intended,intended.snapshot,{source,lifecycleManaged:true}));
      assertTransition(authority);
      if(restored===false)throw new Error('The pre-transition Active Session runtime could not be restored.');
    }
  }
  async function runLocalTransition<T>(kind:string,date:string,operation:(transition:LocalTransition)=>Promise<T>):Promise<T>{
    const owner=persistence.ownershipRevision();
    if(!persistence.ownsSession())throw new Error('Use the primary tab to change the Active Session.');
    if(runtimeConflicted)throw new Error('The Active Session advanced; reload the current session before making changes.');
    let authority:TransitionAuthority|undefined;
    const result=await lifecycle.run(kind,{scheduleIdentity:true,date,autoDate:date===domain.todayISO()},async()=>{
      authority={owner,life:lifecycle.revision()};assertTransition(authority);
      localTransitionDepth++;cancelPendingLiveDraftSave();
      try{
        const before=await transitionRead(authority);
        const rollback=persistence.snapshotForWrite();
        if(rollback&&before&&(before.date!==rollback.date||before.runningOn!==installation.id()||snapshot.sessionFingerprint(before)!==rollback.fingerprint)){
          blockConflictedRuntime(authority);
          throw new Error('The canonical session differs from this runtime; its successor was preserved.');
        }
        const recovery=rollback?payload(rollback):null;
        if(rollback&&!recovery)throw new Error('The pre-transition Active Session snapshot is invalid.');
        const transition:LocalTransition={authority,before,rollback:recovery,attempted:undefined,runtimeChanged:false};
        try{
          const value=await operation(transition);assertTransition(authority);return value;
        }catch(error){
          if(!authorityCurrent(authority))throw error;
          try{await rollbackLocalTransition(transition,kind+'-rollback');}
          catch(rollbackError){
            blockConflictedRuntime(authority);
            throw new Error(`${String((error as {message?:unknown})?.message||error)} Rollback also failed: ${String((rollbackError as {message?:unknown})?.message||rollbackError)}`);
          }
          throw error;
        }
      }finally{localTransitionDepth--;}
    });
    if(!authority)throw new Error('The Active Session transition did not start.');
    assertTransition(authority);return result;
  }
  async function writeNow(options:Readonly<LiveDraftWriteOptions>={}):Promise<SessionResult|null>{
    if(blocked(options))return null;
    options.assertOrigin?.();if(options.markChanged!==false)persistence.markContentChanged();
    const value=persistence.snapshotForWrite();lastTimerSnapshotMs=clock.nowMs();
    try{
      const saved=await writeSnapshot(value,options);
      if(saved&&saved.ok===false)persistence.warn(`Live session could not be saved (${String((saved.error as {message?:unknown}|null)?.message||saved.error||'browser storage unavailable')}). Keep this tab open.`);
      return saved;
    }catch(error){options.assertOrigin?.();persistence.warn(`Live session could not be saved (${String((error as {message?:unknown}|null)?.message||error)}). Keep this tab open.`);throw error;}
  }
  function cancelPendingLiveDraftSave(){
    const pending=liveDraftSaveTimer!==null;
    if(liveDraftSaveTimer!==null){environment.clearTimeout(liveDraftSaveTimer);liveDraftSaveTimer=null;}
    liveDraftSaveDueAt=0;pendingOptions=null;return pending;
  }
  function saveLiveDraft(options:Readonly<LiveDraftWriteOptions>={}){
    if(blocked(options))return false;
    const delay=Math.max(0,Number.isFinite(Number(options.delayMs))?Number(options.delayMs):Math.round(configuration.debounceMs)),due=clock.nowMs()+delay;
    pendingOptions=mergeOptions(pendingOptions,options);
    if(liveDraftSaveTimer!==null&&liveDraftSaveDueAt<=due)return true;
    if(liveDraftSaveTimer!==null)environment.clearTimeout(liveDraftSaveTimer);
    liveDraftSaveDueAt=due;
    liveDraftSaveTimer=environment.setTimeout(()=>{
      const pending=pendingOptions||{};liveDraftSaveTimer=null;liveDraftSaveDueAt=0;pendingOptions=null;void writeNow(pending);
    },delay);return true;
  }
  async function flushLiveDraft(options:Readonly<LiveDraftWriteOptions>={}):Promise<SessionResult|null>{
    if(blocked(options))return null;
    const pending=mergeOptions(pendingOptions,options);cancelPendingLiveDraftSave();
    return writeNow({...pending,emergency:true});
  }
  function maybeSnapshotRunningTimer(){
    if(persistenceSuppressed()||persistence.recoveryQuiesced()||persistence.recoveryWorkActive()||!persistence.timerSnapshotEligible())return false;
    const now=clock.nowMs();if(now-lastTimerSnapshotMs<configuration.timerSnapshotIntervalMs)return false;
    void writeNow();return true;
  }
  async function requireCanonicalWrite(saved:SessionResult|null|undefined,expected:ActiveSession|null|undefined,operation:string):Promise<SessionResult>{
    const intended=expected?codec.sanitizeCurrent(expected):null;
    if(!intended||!saved||saved.ok!==true||saved.storage.idb!==true||saved.error||!saved.value||!canonical.same(saved.value,intended))throw saved?.error||new Error(`The Active Session was not durably committed while ${operation}.`);
    const readBack=await repository.load(0,{strict:true});
    if(!readBack||readBack.ok!==true||readBack.error||readBack.storage.idb!==true||!readBack.value||!canonical.same(readBack.value,intended))throw readBack?.error||new Error(`The Active Session could not be verified after ${operation}.`);
    return saved;
  }
  async function saveCanonicalSession(session:ActiveSession,operation:string,options:Readonly<{backupCapture?:boolean;expectedCanonical?:ActiveSession|null;assertOrigin?:()=>void}>={},authority?:TransitionAuthority):Promise<SessionResult>{
    const intended=codec.sanitizeCurrent(session);if(!intended)throw new Error(`The Active Session is invalid while ${operation}.`);
    const assertOrigin=()=>{options.assertOrigin?.();if(authority)assertTransition(authority);};
    const repositoryOptions={strictDurability:true,backupCapture:options.backupCapture===true,...(Object.prototype.hasOwnProperty.call(options,'expectedCanonical')?{expectedCanonical:options.expectedCanonical??null}:{}),...(options.assertOrigin||authority?{assertOrigin}:{})};
    assertOrigin();const saved=await repository.save(intended,repositoryOptions);
    assertOrigin();const verified=await requireCanonicalWrite(saved,intended,operation);
    assertOrigin();
    return report(verified,'save');
  }
  async function writeCanonicalNow(operation:string,options:Readonly<Omit<LiveDraftWriteOptions,'strictDurability'>>={}):Promise<SessionResult>{
    if(blocked(options))throw new Error(`The Active Session cannot be saved while ${operation}.`);
    options.assertOrigin?.();
    if(options.markChanged!==false)persistence.markContentChanged();
    const value=persistence.snapshotForWrite(),session=payload(value);if(!session)throw new Error(`No canonical Active Session is available while ${operation}.`);
    cancelPendingLiveDraftSave();lastTimerSnapshotMs=clock.nowMs();
    return saveCanonicalSession(session,operation,{backupCapture:options.backupCapture===true,...(options.assertOrigin?{assertOrigin:options.assertOrigin}:{})});
  }
  async function clearCanonical(operation:string,options:Readonly<{expectedCanonical?:ActiveSession|null;assertOrigin?:()=>void}>={},authority?:TransitionAuthority,committed?:()=>void):Promise<SessionResult>{
    const assertOrigin=()=>{options.assertOrigin?.();if(authority)assertTransition(authority);};
    assertOrigin();
    cancelPendingLiveDraftSave();
    const cleared=await repository.clear({...options,...(options.assertOrigin||authority?{assertOrigin}:{})});
    assertOrigin();
    if(!cleared||cleared.ok!==true||cleared.error||cleared.storage.idb!==true)throw cleared?.error||new Error(`The Active Session was not durably cleared while ${operation}.`);
    committed?.();
    const readBack=await repository.load(0,{strict:true});
    if(!readBack||readBack.ok!==true||readBack.error||readBack.value)throw readBack?.error||new Error(`The Active Session clear could not be verified after ${operation}.`);
    assertOrigin();
    return report(cleared,'clear');
  }
  async function withPersistenceSuppressed<T>(operation:()=>T|PromiseLike<T>):Promise<T>{
    if(typeof operation!=='function')throw new TypeError('Restore persistence operation is required.');
    suppressionDepth++;cancelPendingLiveDraftSave();try{return await operation();}finally{suppressionDepth=Math.max(0,suppressionDepth-1);}
  }
  function resetCore(date:string,source:string){
    reset.stopTimerPresentation();reset.invalidatePresentation();reset.resetCountdown();reset.setCurrentTask(0);reset.resetBreak(false);reset.setEmptyTimerMode(source);reset.clearTimerSession();reset.hydrateReview(date);reset.invalidateSchedule();reset.resetPlanSession();reset.clearProgress();reset.clearCarryForward();reset.resetPractice();
    runtimeConflicted=false;
    return true;
  }
  function resetRuntime(options:Readonly<{source?:string;date?:string;lifecycleManaged?:boolean}>={}){
    const date=domain.isValidIsoDate(options.date)?String(options.date):domain.todayISO(),source=String(options.source||'session-reset');
    if(options.lifecycleManaged===true)return resetCore(date,source);
    return lifecycle.run(source,{scheduleIdentity:true,date,autoDate:date===domain.todayISO()},()=>resetCore(date,source));
  }
  async function resetLocal():Promise<SessionResult>{
    const date=domain.todayISO();
    return runLocalTransition('session-reset',date,async transition=>{
      const cleared=await clearCanonical('resetting today’s session',{expectedCanonical:transition.before},transition.authority,()=>{transition.attempted=null;});
      assertTransition(transition.authority);
      transition.runtimeChanged=true;resetCore(date,'session-reset');
      return cleared;
    });
  }
  function applyStoredSession(session:ActiveSession,value:SessionSnapshot,options:Readonly<{source?:string;reviewOnly?:boolean;lifecycleManaged?:boolean}>={}){
    const owner=persistence.ownershipRevision();
    if(!session||!value)return false;
    const source=String(options.source||'stored-session-apply');
    const perform=async()=>{
      const life=lifecycle.revision(),current=()=>persistence.canProject()&&persistence.ownershipRevision()===owner&&lifecycle.revision()===life;
      if(!current())return false;
      const pendingDraft=apply.readPlanDraft();
      resetCore(session.date,source);apply.setStudyDate(session.date,session.date===domain.todayISO());
      // Restore synchronously cleared draft only before any asynchronous
      // application work, never overwrite later independent Plan edits.
      if(apply.readPlanDraft()!==pendingDraft)apply.writePlanDraft(pendingDraft);
      let restored:unknown=false;
      try{
        restored=await apply.applySessionSchedule({source,studyDate:session.date,reviewOnly:options.reviewOnly===true,snapshot:value,scheduleText:session.scheduleText,current});
        return current()?restored:false;
      }finally{
        if(current()){
          if(restored===false)runtimeConflicted=true;
          else apply.previewPlanDraft();
        }
      }
    };
    if(options.lifecycleManaged===true)return perform();
    return lifecycle.run(source,{scheduleIdentity:true,date:session.date,autoDate:session.date===domain.todayISO(),snapshotReview:value.review},perform);
  }
  async function suspendLocal(options:Readonly<{source?:string}>={}):Promise<ActiveSession>{
    const source=options.source||'session-suspend';
    return runLocalTransition(source,snapshot.getReviewDate(),async transition=>{
      if(!transition.rollback)throw new Error('No active study session is available to suspend.');
      transition.runtimeChanged=true;
      reset.pausePracticeForSessionEnd();cancelPendingLiveDraftSave();
      const session=payload(persistence.snapshotForWrite(),{status:'suspended'});
      if(!session)throw new Error('No active study session is available to suspend.');
      transition.attempted=session;
      await saveCanonicalSession(session,'suspending today’s session',{expectedCanonical:transition.before},transition.authority);
      assertTransition(transition.authority);
      resetCore(session.date,source);
      return session;
    });
  }
  async function finishLocal(prepare:()=>void):Promise<SessionResult>{
    return runLocalTransition('session-finish',snapshot.getReviewDate(),async transition=>{
      if(!transition.rollback)throw new Error('No active study session is available to finish.');
      transition.runtimeChanged=true;prepare();persistence.markContentChanged();
      const session=payload(persistence.snapshotForWrite());if(!session)throw new Error('No canonical Active Session is available while finishing today.');
      transition.attempted=session;
      lastTimerSnapshotMs=clock.nowMs();
      const saved=await saveCanonicalSession(session,'finishing today’s session',{expectedCanonical:transition.before},transition.authority);
      assertTransition(transition.authority);return saved;
    });
  }
  async function restoreSuspendedLocal(session:ActiveSession):Promise<ActiveSession>{
    const current=codec.sanitizeCurrent(session);if(!current||classify(current)!=='today-suspended')throw new Error('No suspended session is available for today.');
    const owner=persistence.ownershipRevision();
    if(!persistence.ownsSession())throw new Error('Use the primary tab to restore the Active Session.');
    let authority:TransitionAuthority|undefined;
    const result=await lifecycle.run('session-restore',{scheduleIdentity:true,date:current.date,autoDate:true,snapshotReview:current.snapshot.review},async()=>{
      authority={owner,life:lifecycle.revision()};assertTransition(authority);
      const loaded=await repository.load(0,{strict:true});assertTransition(authority);
      if(!loaded?.ok||loaded.error||!loaded.storage.idb||!loaded.value||!canonical.same(loaded.value,current))throw new Error('The suspended Active Session changed before it could be restored.');
      const active=codec.sanitizeCurrent({...current,status:'active',runningOn:installation.id(),revision:repository.nextRevision(current.revision),suspendedAt:null,updatedAt:clock.nowIso()});
      if(!active)throw new Error('The suspended Active Session could not be activated.');
      let applying=false;
      try{
        await saveCanonicalSession(active,'restoring today’s suspended session',{expectedCanonical:current},authority);
        assertTransition(authority);
        const value=sessionSnapshot(active);if(!value)throw new Error('The restored Active Session snapshot is incompatible.');
        applying=true;
        const restored=await applyStoredSession(active,value,{source:'session-restore',lifecycleManaged:true});
        assertTransition(authority);
        if(restored===false)throw new Error('The suspended Active Session could not be applied to the runtime.');
        return active;
      }catch(error){
        if(!authorityCurrent(authority))throw error;
        try{
          const latest=await repository.load(0,{strict:true});assertTransition(authority);
          if(!latest.ok||latest.error||!latest.storage.idb)throw latest.error||new Error('The canonical session could not be verified for rollback.');
          if(canonical.same(latest.value,active))await saveCanonicalSession({...current,revision:repository.nextRevision(active.revision),updatedAt:clock.nowIso()},'rolling back a failed suspended-session restore',{expectedCanonical:active},authority);
          else if(!canonical.same(latest.value,current))throw new Error('The canonical session advanced during restore; its successor was preserved.');
          assertTransition(authority);
          if(applying)resetCore(current.date,'session-restore-rollback');
        }
        catch(rollbackError){blockConflictedRuntime(authority);throw new Error(`${String((error as {message?:unknown})?.message||error)} Automatic session rollback also failed: ${String((rollbackError as {message?:unknown})?.message||rollbackError)}`);}
        throw error;
      }
    });
    if(!authority)throw new Error('The Active Session restoration did not start.');
    assertTransition(authority);return result;
  }
  const controller:SessionHostController=freeze({
    format:'study-director.session-host',contractVersion:1,captureSnapshot,applySnapshot,sessionSnapshot,classify,payload,load,readLocal:()=>repository.readLocal(),restoreLocalRecovery,
    writeSnapshot,writeNow,writeCanonicalNow,saveLiveDraft,flushLiveDraft,cancelPendingLiveDraftSave,maybeSnapshotRunningTimer,requireCanonicalWrite,saveCanonicalSession,clearCanonical,settled:()=>repository.settled(),
    persistenceSuppressed,withPersistenceSuppressed,finishLocal,applyStoredSession,resetRuntime,resetLocal,suspendLocal,restoreSuspendedLocal
  });
  return controller;
}

const createModule=():SessionHostContract=>freeze({format:'study-director.session-host-module',contractVersion:1,createController});
registry.define('session-host',1,createModule);
return createModule;
})();
export type SessionHostModule=ReturnType<typeof sdSessionHostFactory>;
