import type {LifecycleModule,Job,JobInput,JobResult,OutcomeDetails,Snapshot,WorkBudget,TimerEnvironment} from './lifecycle.ts';
import type {IntegrityState} from './integrity-continuation.ts';
import type {FolderManifest,StorageHistory} from './device-folder-storage.ts';
export type BackgroundModuleInput={lifecycle:LifecycleModule};
export type BackgroundKind='integrity'|'maintenance'|'automatic'|'convergence';
export type ScheduleMode='earliest'|'replace';
export type MaintenanceState=Readonly<{requestedAt:string;nextEligibleAt:string;reason:string;repositoryScope:string;requestId:string}>;
export type CleanupNumber='checkpointDeferred'|'checkpointFailures'|'gcBudgetDeferred'|'gcFailures'|'gcDeferred'|'deferredIncomplete'|'uncertainCount'|'contentionRetryMs'|'removedCheckpoints'|'gcRemoved';
export type CleanupBoolean='gcPending'|'maintenanceBlocked'|'objectGcBlocked'|'gcSkipped'|'overflow';
export type MaintenanceCleanup=Partial<Record<CleanupNumber,number>&Record<CleanupBoolean,boolean>>&{status?:string};
export type MaintenancePlan=Readonly<{reason:string;retryMs:number;actionable:boolean;state:string}>;
export type MaintenanceEvent={phase:string;cleanup?:MaintenanceCleanup;plan?:Partial<MaintenancePlan>;reason?:string;actionable?:boolean;nextEligibleAt?:string};
export type IntegrityResult=JobResult&{complete?:boolean;checked?:number;attempted?:number;checkedBytes?:number;total?:number;corruption?:boolean;repaired?:boolean};
export type RetentionManifest=Pick<FolderManifest,'version'|'exportedAt'|'retention'|'installationId'>;
export type RetentionCandidate={id:string;manifest:RetentionManifest};
export type RepositoryObservation={unreadable?:readonly unknown[];invalid?:readonly unknown[];ignored?:number;overflow?:boolean;uncommitted?:readonly unknown[];orphanCommits?:readonly unknown[];valid?:readonly ObservationRow[];rows?:readonly ObservationRow[]};
export type ObservationRow={id?:string;manifest?:RetentionManifest|null;item?:{id?:string;history?:StorageHistory}};
export type RetentionSelector=(rows:readonly RetentionCandidate[],options:{now:Date})=>{remove:readonly RetentionCandidate[]};
export type ScheduledJob={job:string;dueAt:number;callback:()=>unknown;timer:number|null};
export type ActiveJob={controller:AbortController;settlement:Promise<void>;preemptCode:string;preemptMessage:string};
export type RegisteredJobInput<R extends JobResult>=Omit<JobInput<R>,'environment'|'onBlocked'|'minDelayMs'>&{initialDelayMs?:number|null;discover?:boolean|(()=>boolean)};
export type BackgroundOptions={externalSignal?:AbortSignal|null;budgetMs?:number;budgetCode?:string;budgetMessage?:string;preemptCode?:string;preemptMessage?:string};
export type BackgroundScope=Readonly<{job:string;signal:AbortSignal;controller:AbortController;settlement:Promise<void>;workBudget:WorkBudget;release():void}>;
export type TransitionDetails={reason?:string;nextEligibleAt?:string|undefined;actionable?:boolean};
export type Transition=Readonly<{target:string;job:string;from:string;to:string;at:string;reason:string;nextEligibleAt:string;actionable:boolean}>;
export interface CoordinatorCore{
 readonly format:'study-director.repository-background-coordinator';readonly contractVersion:1;
 now():number;clearScheduled(job:string):boolean;registerJob<R extends JobResult>(name:string,ports:RegisteredJobInput<R>):Readonly<Job<R>>;
 beginBackground(job:string,options?:BackgroundOptions):Promise<BackgroundScope|null>;jobStatus(job:string,running?:boolean,lastResult?:OutcomeDetails|null):Snapshot;
 transition(job:string,from:string,to:string,details?:TransitionDetails):Transition;
}
export type CoordinatorInput={target:string;environment:TimerEnvironment&{AbortController:typeof AbortController}};
export type IntentInput={coordinator:CoordinatorCore;capture(stage:string,error:unknown):void;read():Promise<unknown>;mark(deadline:{reason:string;nextEligibleAt:string;newRequest?:boolean},expected?:MaintenanceState|null):Promise<boolean|'superseded'>;clear(expected?:MaintenanceState|null):Promise<boolean|'superseded'|void>;scope():string;selectRetention:RetentionSelector};
export type ObservationDecision=Readonly<{needed:boolean;pending:MaintenanceState|null;schedule:boolean;delay:number;reason:string;writeFailed:boolean}>;
export interface MaintenanceIntent{
 readonly format:'study-director.repository-maintenance-intent';readonly contractVersion:1;
 read(options?:{throwOnError?:boolean}):Promise<MaintenanceState|null>;
 mark(reason:string,delay:number,options?:{expected?:MaintenanceState|null|undefined;newRequest?:boolean}):Promise<boolean|'superseded'>;
 clear(expected?:MaintenanceState|null):Promise<boolean|'superseded'>;
 observe(observation:RepositoryObservation|null,options?:{delay?:number}):Promise<ObservationDecision>;
 scope():string;actionable(state:MaintenanceState|null):boolean;delay(state:MaintenanceState|null,fallback?:number):number;plan(cleanup:MaintenanceCleanup|null):MaintenancePlan;
}
export type DeferredRequest={generation:number;scope:string;reason:string;dueAt:number;expected:MaintenanceState|null|undefined;persisting:boolean;retryAt:number};
export type PersistedIntent={ok:boolean;superseded?:boolean;retryMs?:number;nextEligibleAt?:string};
export type SchedulerOptions={budgetCode:string;budgetMessage:string;budgetMs:number;preemptCode:string;preemptMessage:string;coordinator:CoordinatorCore;isAvailable():boolean|string};
export type MaintenanceSchedulerInput=SchedulerOptions&{capture(stage:string,error:unknown):void;intent:MaintenanceIntent;execute(context:{signal:AbortSignal;workBudget:WorkBudget;pending:MaintenanceState;trigger:string}):Promise<MaintenanceCleanup>;isBusy():boolean;report(event:Readonly<Record<string,unknown>>):void};
export type IntegrityTarget={partial?:IntegrityState|null;scanId?:string;cursor?:string;recheckCursor?:string;attempted?:number;cycleStartedAt?:string;failedAt?:string;completedAt?:string};
export type IntegritySchedulerInput=SchedulerOptions&{capture(error:unknown):void;execute(context:{target:IntegrityTarget|null;trigger:string;nextEligibleAt:string;signal:AbortSignal;checkpoint(progress?:IntegrityTarget|null):void}):Promise<IntegrityResult>;isUnsafe():boolean;readTarget():Promise<IntegrityTarget|null>;writeResult(result:IntegrityResult):Promise<unknown>;yieldTask():Promise<unknown>};

export type MaintenanceAttempt=JobResult&MaintenanceCleanup&{retryMs?:number|undefined;nextEligibleAt?:string|undefined;actionable?:boolean;error?:unknown};
