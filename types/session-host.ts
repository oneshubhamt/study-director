import type {CompletionSource,Task} from './domain.ts';
import type {ActiveSession,PracticeState,SessionSnapshot,TimerPayload} from './record-models.ts';
import type {SessionResult} from './repositories.ts';
import type {RuntimeEvidence} from './timer-engine.ts';
import type {TaskIdentityPort,TaskSessionStore} from './execution-host.ts';
import type {TimerStateModule} from '../source/core/timer-state.ts';
import type {SessionOptions} from './session-lifecycle.ts';

type TimerStateController=ReturnType<TimerStateModule['createStateController']>;

export interface SessionCodecPort{
  sanitizeCurrent(value:unknown):ActiveSession|null;
  sanitizeSessionSnapshot(value:unknown,date:string,fingerprint:string,revision:number):SessionSnapshot|null;
}
export interface SessionRepositoryPort{
  save(value:ActiveSession,options?:Readonly<{emergency?:boolean;backupCapture?:boolean;strictDurability?:boolean;expectedCanonical?:ActiveSession|null}>):PromiseLike<SessionResult>;
  load(retry?:number,options?:Readonly<{strict?:boolean}>):PromiseLike<SessionResult>;
  clear():PromiseLike<SessionResult>;
  readLocal():ActiveSession|null;
  nextRevision(seed?:number):number;
  settled():PromiseLike<unknown>;
}
export interface SessionSnapshotPorts{
  tasks():readonly Task[];
  ensureTaskIds():unknown;
  taskIdentity:TaskIdentityPort;
  taskState:TaskSessionStore;
  timerState:TimerStateController;
  captureEvidence():RuntimeEvidence;
  timerPayload():TimerPayload|null;
  reviewSnapshot():SessionSnapshot['review'];
  practiceSnapshot():PracticeState;
  practiceRestore(value:PracticeState|undefined,options:Readonly<{forcePaused:boolean;pauseCause:string;savedAtMs:number}>):unknown;
  getReviewDate():string;
  scheduleFingerprint():string;
  sessionFingerprint(session:ActiveSession):string;
  appliedScheduleText():string;
  getCarryForward():string;
  setCarryForward(value:string):unknown;
  clearProgress():unknown;
  sanitizeAdjustedSchedule(value:unknown):SessionSnapshot['scheduleAdjustments'];
  invalidateScheduleDerived(options:Readonly<{adjustments?:boolean;render?:boolean;identity?:boolean}>):unknown;
  setCurrentTask(index:number):unknown;
  timerRestoreValid(runtime:TimerPayload|null):boolean;
}
export interface SessionSnapshotDomainPorts{
  normalizeCompletionSource(value:unknown):CompletionSource;
  clampCompletion(value:unknown):number;
  cleanDayRevision(value:unknown):number;
  clampText(value:unknown,max:number):string;
  isCanonicalScheduleText(value:unknown):boolean;
  isValidIsoDate(value:unknown):boolean;
  todayISO():string;
}
export interface SessionPersistencePorts{
  canMutate():boolean;
  recoveryQuiesced():boolean;
  persistenceBlocked():boolean;
  recoveryWorkActive():boolean;
  timerSnapshotEligible():boolean;
  markContentChanged():unknown;
  snapshotForWrite():SessionSnapshot|null;
  reportResult(result:SessionResult,action:'save'|'clear'):unknown;
  warn(message:string):unknown;
}
export interface SessionLifecyclePorts{
  run<T>(kind:string,options:Readonly<SessionOptions>,operation:()=>T|PromiseLike<T>):Promise<T>;
}
export interface SessionApplyPorts{
  readPlanDraft():string;
  writePlanDraft(value:string):unknown;
  previewPlanDraft():unknown;
  setStudyDate(date:string,automatic:boolean):unknown;
  applySessionSchedule(input:Readonly<{source:string;studyDate:string;reviewOnly:boolean;snapshot:SessionSnapshot;scheduleText:string}>):unknown;
}
export interface SessionResetPorts{
  stopTimerPresentation():unknown;
  invalidatePresentation():unknown;
  resetCountdown():unknown;
  setCurrentTask(index:number):unknown;
  resetBreak(clear?:boolean):unknown;
  setEmptyTimerMode(source:string):unknown;
  clearTimerSession():unknown;
  hydrateReview(date:string):unknown;
  invalidateSchedule():unknown;
  resetPlanSession():unknown;
  clearProgress():unknown;
  clearCarryForward():unknown;
  resetPractice():unknown;
  pausePracticeForSessionEnd():unknown;
}
export interface SessionHostInput{
  readonly configuration:Readonly<{
    activeSessionId:string;
    activeSessionVersion:number;
    sessionSnapshotVersion:number;
    maxCarryForwardChars:number;
    maxScheduleChars:number;
    maxTasksPerDay:number;
    debounceMs:number;
    timerSnapshotIntervalMs:number;
    completionNone:'none';
    practicePauseCauses:Readonly<{session:string;gap:string;main:string}>;
  }>;
  readonly codec:Readonly<SessionCodecPort>;
  readonly repository:Readonly<SessionRepositoryPort>;
  readonly canonical:Readonly<{same(a:unknown,b:unknown):boolean}>;
  readonly snapshot:Readonly<SessionSnapshotPorts>;
  readonly domain:Readonly<SessionSnapshotDomainPorts>;
  readonly persistence:Readonly<SessionPersistencePorts>;
  readonly lifecycle:Readonly<SessionLifecyclePorts>;
  readonly apply:Readonly<SessionApplyPorts>;
  readonly reset:Readonly<SessionResetPorts>;
  readonly installation:Readonly<{id():string}>;
  readonly clock:Readonly<{nowMs():number;nowIso():string}>;
  readonly environment:Readonly<{
    clearTimeout(handle:number):void;
    setTimeout(callback:()=>void,delay:number):number;
  }>;
}
export interface LiveDraftWriteOptions{
  readonly markChanged?:boolean;
  readonly backupCapture?:boolean;
  readonly allowDuringRecoveryQuiescence?:boolean;
  readonly strictDurability?:boolean;
  readonly emergency?:boolean;
  readonly delayMs?:number;
}
export interface ActiveSessionPayloadOptions{
  readonly revision?:number;
  readonly status?:'active'|'suspended';
  readonly suspendedAt?:string|null;
}
export type SessionClassification='invalid'|'today-active'|'today-suspended'|'previous'|'future';
export interface SessionHostController{
  readonly format:'study-director.session-host';
  readonly contractVersion:1;
  captureSnapshot(evidence?:RuntimeEvidence|null):SessionSnapshot|null;
  applySnapshot(snapshot:SessionSnapshot|null):boolean;
  sessionSnapshot(session:ActiveSession|null):SessionSnapshot|null;
  classify(session:ActiveSession|null):SessionClassification;
  payload(snapshot?:SessionSnapshot|null,options?:Readonly<ActiveSessionPayloadOptions>):ActiveSession|null;
  load(options?:Readonly<{strict?:boolean}>):Promise<SessionResult>;
  readLocal():ActiveSession|null;
  restoreLocalRecovery():boolean;
  writeSnapshot(snapshot:SessionSnapshot|null,options?:Readonly<LiveDraftWriteOptions>):Promise<SessionResult|null>;
  writeNow(options?:Readonly<LiveDraftWriteOptions>):Promise<SessionResult|null>;
  writeCanonicalNow(operation:string,options?:Readonly<Omit<LiveDraftWriteOptions,'strictDurability'>>):Promise<SessionResult>;
  saveLiveDraft(options?:Readonly<LiveDraftWriteOptions>):boolean;
  flushLiveDraft(options?:Readonly<LiveDraftWriteOptions>):Promise<SessionResult|null>;
  cancelPendingLiveDraftSave():boolean;
  maybeSnapshotRunningTimer():boolean;
  requireCanonicalWrite(saved:SessionResult|null|undefined,expected:ActiveSession|null|undefined,operation:string):Promise<SessionResult>;
  saveCanonicalSession(session:ActiveSession,operation:string,options?:Readonly<{backupCapture?:boolean;expectedCanonical?:ActiveSession|null}>):Promise<SessionResult>;
  clearCanonical(operation:string):Promise<SessionResult>;
  settled():PromiseLike<unknown>;
  persistenceSuppressed():boolean;
  withPersistenceSuppressed<T>(operation:()=>T|PromiseLike<T>):Promise<T>;
  rollbackLocalTransition(snapshot:SessionSnapshot,source:string,options?:Readonly<{restoreRuntime?:boolean}>):Promise<boolean>;
  applyStoredSession(session:ActiveSession,snapshot:SessionSnapshot,options?:Readonly<{source?:string;reviewOnly?:boolean;lifecycleManaged?:boolean}>):unknown|Promise<unknown>;
  resetRuntime(options?:Readonly<{source?:string;date?:string;lifecycleManaged?:boolean}>):boolean|Promise<boolean>;
  resetLocal():Promise<SessionResult>;
  suspendLocal(options?:Readonly<{source?:string}>):Promise<ActiveSession>;
  restoreSuspendedLocal(session:ActiveSession):Promise<ActiveSession>;
}
export interface SessionHostModule{
  readonly format:'study-director.session-host-module';
  readonly contractVersion:1;
  createController(input:Readonly<SessionHostInput>):Readonly<SessionHostController>;
}

