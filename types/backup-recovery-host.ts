import type {ManagedRecoveryModule} from '../source/core/managed-recovery.ts';
import type {ManagedRecoveryInput,RecoverySpec} from './managed-recovery.ts';
import type {SessionResult} from './repositories.ts';
import type {AttachmentWriterSettlementOptions} from './document-host.ts';
import type {PendingReview} from './record-models.ts';
import type {BackupPresentationModule} from '../source/core/backup-presentation.ts';
import type {NotificationEvent} from '../source/core/notice-coordinator.ts';
import type {NotificationInput} from './notifications.ts';
export type PendingEntry=Readonly<{providerId:string;requestedAt:string;sourceRevision:string}>;
export type PendingRecord=Readonly<{format:'study-director.managed-provider-backup-pending';version:1;entries:readonly PendingEntry[]}>;
export type PendingStoreInput={storage:{read():Promise<unknown>;write(value:PendingRecord):Promise<unknown>;remove():Promise<unknown>};diagnostics:{capture(scope:string,error:unknown,level:'error'|'warn'):void};sourceRevision():unknown};
export type Progress={active?:number;waitedMs?:number;maxWaitMs?:number;stage?:string;message?:string;ok?:boolean;current?:number;total?:number;totalBytes?:number;completedBytes?:number;activeBytes?:number;loadedBytes?:number};
export type PresentationLifecycle='running'|'succeeded'|'failed'|'cancelled';
export type PresentationEvent=NotificationEvent;
export type PresentationPatch=Pick<NotificationInput,'outcome'|'message'|'severity'|'lifecycle'|'progress'>;
export type PresentationScope=ReturnType<RecoveryPresentation['begin']>;
export type Choice={value:string;label:string;kind?:string;description:string};
export type ConvergenceState={status:string;shared?:boolean;label?:string};
export type Convergence=ConvergenceState|{source?:ConvergenceState;others?:readonly (ConvergenceState&{label:string})[]};
export type RecoveryPresentation=ReturnType<BackupPresentationModule['createPresentation']>;
export type HistoryLocation={attachmentsMissing?:number;sourceId:string;sourceLabel:string;checkpointId:string;exportedAt:string;tier?:string;safetyPurpose?:string;safetyCheckpointId?:string;encrypted?:boolean;health?:string;warning?:string};
export type HistoryEntry={exportedAt:string;location:HistoryLocation;logicalId?:string;origin?:string;locked?:boolean;unreadable?:boolean;counts?:{dailyRecord?:number;note?:number}|null;held?:readonly string[];copies?:readonly HistoryLocation[]};
export type HistorySource={id:string;label:string;shared:boolean};
export type HistoryBatch={source:HistorySource;entries:readonly HistoryEntry[]};
export type MergedHistory={entry:HistoryEntry;held:string[];tiers:(string|undefined)[];copies:HistoryLocation[]};
export type NoteVersion={text:string;exportedAt:string;origin?:string;sourceId:string;sourceLabel:string;checkpointId:string};
export type CoveredNotes={checkpointIds:readonly string[];contents:readonly string[]};
export type NoteTarget={id:string;label:string;text:string;onRestored(result:{exportedAt:string;sourceLabel:string}):void};
export type HistoryOptions={interactive:boolean;signal:AbortSignal;presentation:PresentationScope|null};
export type RecoveryOptions={presentation:PresentationScope|null;checkpointId:string;confirmed:boolean;note:string;missingOnly:boolean;signal:AbortSignal;onProgress(value:Progress):void};
export type RecoveryResult={reason?:string;cancelled?:boolean;ok?:boolean;error?:unknown;convergence?:Convergence;summary?:string};
export type RecoveryRun=<R extends object,P extends object>(spec:RecoverySpec<R,P>)=>Promise<object>;
export type Suspension={settled:Promise<unknown>;release():boolean};
export interface RecoveryHostInput extends PendingStoreInput{
 cancellation:{cancelImport(reason:string,options:{announce:boolean}):unknown};
 diagnostics:PendingStoreInput['diagnostics']&{mark(phase:string,details:Readonly<Record<string,unknown>>):void};
 document:Pick<Document,'getElementById'|'createElement'>;
 interactions:{choose(options:{title:string;message:string;details:string[];cancelLabel:string;choices:Choice[]}):Promise<string|null>};
 managedRecovery:Pick<ManagedRecoveryModule,'createCoordinator'>;mutation:ManagedRecoveryInput<Suspension>['mutation']&{captureOrigin(reason:string):()=>void};
 lifecycle:{activeSessionIssue(value:SessionResult):string;activeSessionLoad():Promise<SessionResult>;activeSessionSettled():Promise<unknown>;attachmentBusy():boolean;canonicalPlanDraft():Promise<string|null>;deletionRecoveryFlush():Promise<boolean>;flushNotes():Promise<unknown>;flushPlanDraft():Promise<unknown>;hasTasks():boolean;noteFailure():{failed?:boolean;message?:string}|null;planDraft():string|null;planInputValue():string|null;quiesce<T>(operation:()=>Promise<T>):Promise<T>;savePlanDraft(options?:{force:boolean}):Promise<unknown>;settleAttachmentWriters(options?:Readonly<AttachmentWriterSettlementOptions>):Promise<unknown>;settlePlan():Promise<unknown>;writeLiveDraft():Promise<SessionResult>};
 presentation:RecoveryPresentation;
 providers:{bringInRepositoryProvider(id:string,options:RecoveryOptions):Promise<RecoveryResult|null>;restoreRepositoryProviderVersion(id:string,options:RecoveryOptions):Promise<RecoveryResult|null>;removeRepositoryProviderVersion(id:string,checkpointId:string,assertOrigin:()=>void):Promise<{removed?:boolean;error?:unknown;warning?:unknown}|null>;cancelForeground(reason:string,id:string):unknown;configureManagedRecovery(port:{run:RecoveryRun}):void;configurePendingBackupRetry(port:{read(id:string):Promise<PendingEntry|null>;mark(id:string):Promise<boolean>;clear(id:string,expected?:PendingEntry|null):Promise<boolean>}):void;history(id:string,options:HistoryOptions):Promise<{cancelled?:boolean;reason?:string;available?:boolean;entries?:readonly HistoryEntry[]}|null>;list():readonly Readonly<{id:string;label:string;shared?:boolean;connected:boolean}>[];noteVersions(id:string,noteId:string,options:HistoryOptions&{skip?:CoveredNotes}):Promise<({available:true;entries:readonly NoteVersion[];covered?:Partial<CoveredNotes>;cancelled?:boolean}|{available?:false;cancelled?:boolean})|null>;suspendBackground(reason:string,options?:{preserveManagedSync:boolean}):Suspension};
 session:{hasBlocking():boolean};view:{deviceName(origin:string|undefined,others:(string|undefined)[]):string;invalidateAttachments():void;refreshCore():void;refreshNotes():void;refreshReview():void;renderLibrary():void;setStatus(message:string):void};
}
export type HistoryNotice=PresentationEvent&{sourceId:string;sourceLabel:string;active:boolean;ok:boolean;progress:(Progress&{message:string})|null};
export type KeptReviewOutcome=Readonly<{cancelled?:boolean;reviewed?:number;changed?:number;left?:number}>;
export type KeptNotification=Readonly<{
  source:string;key:string;title:string;message:string;kind?:'warning'|'error';tier?:'news';
  action?:Readonly<{label:string;opens:boolean;run():unknown}>;
}>;
export interface KeptVersionsInput{
  readonly controller:Readonly<{
    status():Readonly<{busy:boolean}>;
    resolveConvergedKeptVersions():Promise<number>;
    reviewKeptVersions(options:{ref:string}):Promise<KeptReviewOutcome>;
  }>;
  readonly reviews:Readonly<{list():Promise<readonly PendingReview[]>}>;
  readonly diagnostics:Readonly<{capture(scope:string,error:unknown,level:'warn'):void}>;
  readonly environment:Readonly<{canMutate():boolean;now():number;connectCardOpen():boolean;sessionYieldedAt():number}>;
  readonly notifications:Readonly<{notify(options:KeptNotification):unknown;resolveEvent(source:string,id:string):unknown}>;
  readonly view:Readonly<{render():void;renderLocation():void;scheduleStatus():void;refreshNotes():void}>;
}
export interface KeptVersionsController{
  readonly format:'study-director.kept-versions';
  readonly contractVersion:1;
  refresh():Promise<boolean>;
  review(ref?:string):Promise<KeptReviewOutcome|null>;
  count():number;
  note(id:string):boolean;
}
export type StorageResetLocation=Readonly<{id:string;label:string;connected:boolean;engineBusy?:boolean}>;
export type StorageResetHistoryEntry=Readonly<{exportedAt?:string;location:Readonly<{tier?:string;exportedAt:string;checkpointId:string}>}>;
export type StorageResetRecoveryResult=Readonly<{cancelled?:boolean;verified?:boolean;exportedAt?:string;added?:number;assetsRestored?:number}>;
export interface StorageResetInput{
  readonly authority:Readonly<{canMutate():boolean}>;
  readonly canonical:Readonly<{
    dailyRecordsList():Promise<readonly unknown[]>;notesReadFreshPayload():Promise<Readonly<Record<string,unknown>>>;
    activeSessionLoad():Promise<SessionResult>;planDataRead():Promise<Readonly<{draft?:unknown;savedPlans?:readonly unknown[]}>>;
    attachmentsList():Promise<readonly unknown[]>;pendingReviewsList():Promise<readonly PendingReview[]>;
    savedDayDeletions():Promise<readonly unknown[]>;noteDeletions():Promise<readonly unknown[]>;
  }>;
  readonly writeback:Readonly<{
    installationKeep():boolean|PromiseLike<boolean>;notesRecover():boolean|PromiseLike<boolean>;planRewrite():boolean|PromiseLike<boolean>;
    settingsFlush():boolean|PromiseLike<boolean>;hasTasks():boolean;writeLiveDraft():Promise<SessionResult>;
  }>;
  readonly provider:Readonly<{
    history(id:string,options:{interactive:boolean}):Promise<{available?:boolean;entries?:readonly StorageResetHistoryEntry[]}|null>;
    restoreRepositoryProviderVersion(id:string,options:{checkpointId:string;confirmed:boolean}):Promise<StorageResetRecoveryResult|null>;
    bringInRepositoryProvider(id:string,options:{missingOnly:boolean;quiet:boolean;before:string}):Promise<StorageResetRecoveryResult|null>;
    syncRepositoryProvider(id:string):Promise<StorageResetRecoveryResult|null>;
    list():readonly StorageResetLocation[];locationStatus(id:string):Readonly<{connected:boolean;engineBusy?:boolean}>|null;
    suspendBackground(reason:string):Suspension;connected(id:string):boolean;
  }>;
  readonly device:Readonly<{
    status():Readonly<{connected:boolean}>;connect():unknown|PromiseLike<unknown>;install():unknown|PromiseLike<unknown>;
    refreshPermission():unknown|PromiseLike<unknown>;rememberAfterStorageReset():unknown|PromiseLike<unknown>;
  }>;
  readonly storage:Readonly<{
    health():Readonly<{lastStudyDataSaveAt:string|null;browserDataClearedAt:string|null}>;
    updateHealth(patch:Readonly<{browserDataClearedAt:string|null}>):unknown;
    storedHealth():unknown;indexedDbLifecycle():Readonly<{resets:number;startedFresh:boolean}>;
  }>;
  readonly presentation:Readonly<{
    restoreChoices():string;openRestore():unknown|PromiseLike<unknown>;
    confirm(options:Readonly<Record<string,unknown>>):Promise<boolean>;notify(options:Readonly<Record<string,unknown>>):unknown;
    emit(event:Readonly<Record<string,unknown>>):unknown;resolve(source:string,id:string):unknown;
    subscribe(listener:(state:{events:readonly Readonly<{id?:string;lifecycle?:string;completedAt?:string}>[]})=>void):unknown;
  }>;
  readonly ownership:Readonly<{announceStorageReset(detectedAt?:unknown):unknown}>;
  readonly mutation:Readonly<{settled():PromiseLike<unknown>}>;
  readonly background:Readonly<{wake(reason:string):unknown}>;
  readonly session:Readonly<{hasBlocking():boolean;suspend():PromiseLike<unknown>}>;
  readonly view:Readonly<{refreshAfterWriteback():unknown}>;
  readonly readiness:Readonly<{reconcileStartupChangeClock():Promise<boolean>}>;
  readonly diagnostics:Readonly<{capture(scope:string,error:unknown,level:'warn'|'error'):unknown}>;
  readonly environment:Readonly<{now():number;nowIso():string;setTimeout(callback:()=>void,ms:number):number;clearTimeout(handle:number):void}>;
}
export interface StorageResetController{
  readonly format:'study-director.storage-reset-recovery';readonly contractVersion:1;
  canonicalEmpty():Promise<boolean|null>;
  offerDeviceRecovery(options?:Readonly<{reason?:string;latestBefore?:number}>):Promise<boolean>;
  connectDevice():Promise<unknown>;
  ensureDeviceInstalled():Promise<unknown>;
  unresolved():boolean;
  handle(event?:Readonly<{detectedAt?:unknown;peer?:boolean}>):Promise<void>;
  resume():boolean;
  settle():boolean;
  restore():Promise<unknown>;
  connectionsChanged():boolean;
}


export interface RetainedBackupFilesInput{
  readonly restoreJournalPayload:()=>Promise<unknown>;
  readonly repositoryIntegrityState:()=>Promise<unknown>;
}
export interface RetainedBackupFilesController{
  readonly format:'study-director.retained-backup-files';readonly contractVersion:1;
  names():Promise<readonly string[]>;
}

export interface KeptVersionsViewInput{
  readonly document:Pick<Document,'getElementById'>;
  count():number;
}
export interface KeptVersionsViewController{
  readonly format:'study-director.kept-versions-view';readonly contractVersion:1;
  render():void;
}

export interface RecoveryQuiescenceInput{
  cancelPendingLiveDraftSave():unknown;
  readonly clock:Readonly<{nowMs():number}>;
  readonly timer:Readonly<{stopExecution():unknown;resumeAfterPrimaryRestore(options:Readonly<{frozenSinceMs:number|null}>):unknown}>;
  readonly richText:Readonly<{quiesce<T>(operation:()=>Promise<T>):Promise<T>}>;
  readonly mutation:Readonly<{settled():PromiseLike<unknown>;active():boolean}>;
  readonly handoff:Readonly<{frozen():boolean}>;
  readonly diagnostics:Readonly<{capture(scope:string,error:unknown,level:'warn'):unknown}>;
}
export interface RecoveryQuiescenceController{
  readonly format:'study-director.recovery-quiescence';readonly contractVersion:1;
  active():boolean;
  run<T>(operation:()=>Promise<T>):Promise<T>;
}
