import type {ActiveSession,SessionSnapshot} from './record-models.ts';
import type {ExecutionRuntime} from './execution-host.ts';
import type {SessionHostController} from './session-host.ts';
import type {SessionHandoffController} from './session-handoff.ts';
import type {DomainModule,ScheduleModel,TimeModel,Task} from './domain.ts';
import type {AppData} from './data-bootstrap-host.ts';
import type {RecordCodecsModule} from '../source/core/record-codecs.ts';
import type {NoticeCoordinator} from '../source/core/notice-coordinator.ts';
import type {InteractionsModule} from '../source/core/interactions.ts';
import type {SessionCoordinator} from './session-lifecycle.ts';
import type {PlanController,PlanTone} from './plan.ts';
export type SessionApplyOptions={source?:string;reviewOnly?:boolean;lifecycleManaged?:boolean};
export interface SessionActionState{
  sessionPanelMode:'none'|'active'|'suspended'|'elsewhere'|'previous';sessionPanelSession:ActiveSession|null;
  sessionSafetyMessage:string;sessionHandoff:{step:string;error:string};sessionMovingHere:ActiveSession|null;sessionYieldedAt:number;
  saveReminderDate:string;saveReminderEvidence:unknown;saveReminderGeneration:number;
}
export interface SessionActionInput{
  checkUnsupportedUpdate():unknown;applySchedule(options:import('./plan.ts').PlanApplyOptions):boolean|PromiseLike<boolean>;schedulePwaUpdateEvaluation(delay:number):unknown;
  state:SessionActionState;runtime:ExecutionRuntime;completionSources:DomainModule['COMPLETION_SOURCES'];
  ActiveSessionRuntime:SessionHostController;
  SessionHandoffRuntime:SessionHandoffController|null;
  AppData:Pick<AppData,'activeSession'|'dailyRecords'|'notes'>;
  ActiveSessionCodec:ReturnType<RecordCodecsModule['createActiveSessionCodec']>;
  DailyRecordCodec:ReturnType<RecordCodecsModule['createDailyRecordCodec']>;
  CanonicalModule:{same(a:unknown,b:unknown):boolean};
  AppDiagnostics:{capture(scope:string,error:unknown,severity:'warn'|'error'):unknown};
  AppMutationCoordinator:{runExclusive<T>(kind:string,operation:()=>T|PromiseLike<T>):PromiseLike<T>};
  Interactions:ReturnType<InteractionsModule['createController']>;NoticeCoordinator:NoticeCoordinator;
  PlanDraftEditor:PlanController['draft'];PlanScheduleGateway:{hasLiveState():boolean};
  ReviewEditor:{persistenceCommitted():unknown;persistenceFailed(error:unknown):unknown};
  ReviewView:{refresh(options:{force:boolean}):unknown};
  SessionLifecycle:SessionCoordinator;StartupLifecycle:{status():{fullyInitialized:boolean}};
  BackupProviderRuntime:{connected(providerId:string):boolean};InstallationIdentity:{getId():string};KeptVersions:{review():unknown};
  markStorageHealthError(source:string,message:string):unknown;markStorageHealthOk(source:string):unknown;
  refreshStorageFallbackWarning():unknown;setPlanStatus(message:string,tone?:PlanTone):unknown;prettyDate(date:string):string;
  notifyBackupChange(change:{urgent:boolean;reason:string}):unknown;
  updateExecuteSessionStatus():unknown;refreshExecuteIdleDisplay(now:Date,options:{force:boolean}):unknown;
  updateSessionControls():unknown;scheduleSyncStatus():unknown;
  goTab(tab:'plan'|'execute'|'review',options:{source:string;history?:'none'|'replace'}):unknown;
  appCanMutate():boolean;getReviewDate():string;resetCountdownRuntime():unknown;restoreTimerRuntimeIfAny():boolean;
  showEmpty(message:string,title?:string):unknown;renderSched():unknown;updateBadges():unknown;updateHeaderInfo():unknown;
  updateRealTimeAwareness():unknown;renderRecoveryReview():unknown;updateExecutePanels():unknown;
  storageHealthTime(value:string):string;deviceName(id:string|undefined|null):string;refreshCoreUi():unknown;
  parseScheduleDraftText:ScheduleModel['parseText'];scheduleFingerprintForRows:ScheduleModel['fingerprint'];
  isTrackableBlock:ScheduleModel['isTrackable'];makeTaskId:DomainModule['makeTaskId'];shortTaskLabel(task:Task):string;
  isValidIsoDate:TimeModel['isValidIsoDate'];todayISO():string;DecisionClock:{nowMs():number};SLEEP_GAP_THRESHOLD_MS:number;HANDOFF_RETRY_MESSAGE:string;
  navigator:Pick<Navigator,'onLine'>;
  clearCanonicalSessionAfterSavedDay():unknown;scheduleFingerprint():string;
}

export interface SessionLifecycleViewInput{
 document:Document;NOTE_EDITOR_BINDING_VERSION:string;setTimeout(callback:()=>void,delay:number):unknown;
 ReviewEditor:{invalidateBindings():unknown};ReviewView:{invalidate():unknown;refresh(options:{force:boolean}):unknown;syncMode():unknown;activate(options:{restoreScroll:boolean}):unknown};
 invalidateProgressPanel():void;richTextClose():PromiseLike<unknown>;cancelPendingLiveDraftSave():unknown;advanceTaskNoteScheduleRevision():unknown;
 clearTaskNoteEditorBinding(field:HTMLTextAreaElement):unknown;isValidIsoDate:TimeModel['isValidIsoDate'];getReviewDate():string;
 refreshAllSubjectNoteFieldsFromRepository():unknown;refreshPnote(options:{force:boolean}):unknown;
 hydrateReviewState(options:{date:string;snapshotReview:unknown;source:string}):unknown;refreshLibraryNotes():unknown;
 requestRender(...surfaces:string[]):unknown;appCanMutate():boolean;schedulePwaUpdateEvaluation(delay:number):unknown;
}
