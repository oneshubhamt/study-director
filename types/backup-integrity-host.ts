import type {MetaOwner} from './app-meta.ts';
import type {AssetIssue,AuditProgress} from './asset-storage.ts';
import type {IntegrityHooks} from './backup-provider.ts';
import type {Job,LifecycleModule} from './lifecycle.ts';
import type {IntegrityState,VerificationResult,VerificationInput} from './integrity-continuation.ts';
import type {ObjectEntry} from './managed-repository.ts';
import type {AttachmentsModule} from '../source/core/attachments.ts';
import type {AssetStorageModule} from '../source/core/asset-storage.ts';
import type {BackupModule} from '../source/core/backup.ts';
import type {WriteToken} from './ownership.ts';

declare const makeAssetStore:AssetStorageModule['create'];
type AssetStore=ReturnType<typeof makeAssetStore<WriteToken>>;
type AttachmentReferences=ReturnType<AttachmentsModule['createReferenceCoordinator']>;
type BackupProviders=ReturnType<BackupModule['createRuntime']>['providers'];

export type AttachmentIntegrityState=Readonly<{
  version:2;checkedAt:string;attemptedAt:string;lastOutcome:string;progress:AuditProgress|null;issues:readonly AssetIssue[];
}>;
export type RepositoryIntegrityHistory=Readonly<{at:string;outcome:string;complete:boolean}>;
export type RepositoryIntegrityTarget=Readonly<{
  repositoryScope:string;scanId:string;partial:IntegrityState|null;recheck:boolean;recheckCursor:string;requestId:string;
  blockedReason:string;completedAt:string;cycleStartedAt:string;cursor:string;failedAt:string;attemptedAt:string;lastOutcome:string;
  history:readonly RepositoryIntegrityHistory[];quarantinedObjectIds:readonly string[];
}>;
export type RepositoryIntegrityState=Readonly<{version:7;locations:Readonly<Record<string,RepositoryIntegrityTarget>>}>;
export interface IntegrityContinuationPort{
 verify(input:Omit<VerificationInput,'entry'|'signal'>&{entry:ObjectEntry;signal:AbortSignal|null}):Promise<VerificationResult>;
}
export interface BackupIntegrityInput{
  readonly lifecycle:LifecycleModule;
  readonly metadata:Readonly<{
    attachment:Pick<MetaOwner,'owner'|'read'|'write'>;
    repository:Pick<MetaOwner,'owner'|'read'|'transaction'>;
  }>;
  readonly attachmentMetadataName:string;
  readonly repositoryMetadataName:string;
  readonly storage:Pick<AssetStore,'supported'|'shallowAudit'>;
  readonly references:Pick<AttachmentReferences,'sources'>;
  validAttachmentId(value:unknown):boolean;
  readonly data:Readonly<{datasetRevision():Promise<string|number|null>}>;
  referenceRevision():number;
  readonly authority:Readonly<{canMutate():boolean}>;
  readonly background:Readonly<{upkeepBlocker():string;backgroundBlocker():string;foregroundBusy():boolean}>;
  readonly backgroundTasks:Readonly<{budget():()=>boolean;yieldTask(options:{priority:'background'}):Promise<unknown>}>;
  readonly provider:Pick<BackupProviders,'backgroundStatus'|'locationStatus'|'repositoryScope'|'requestIntegrity'>;
  readonly continuation:IntegrityContinuationPort;
  normalizeContinuation(value:unknown):IntegrityState|null;
  readonly unsafe:Readonly<{mutation():boolean;attachmentIngest():boolean}>;
  readonly storageHealth:Readonly<{markError(source:string,message:string,options?:Readonly<{level?:'warn'}>):unknown;markOk(source:string):unknown}>;
  invalidateAttachmentLibrary():unknown;
  readonly diagnostics:Readonly<{
    capture(scope:string,error:unknown,level:'warn'):unknown;
    start(kind:string,label:string,details:Readonly<Record<string,unknown>>):string;
    mark(kind:string,details:Readonly<Record<string,unknown>>,traceId:string):unknown;
    finish(details:Readonly<Record<string,unknown>>,traceId:string):unknown;
    fail(error:unknown,details:Readonly<Record<string,unknown>>,traceId:string):unknown;
  }>;
  readonly document:Document;
  readonly environment:Readonly<{now():number;nowIso():string;uuid():string;setTimeout(callback:()=>void,delay:number):number;clearTimeout(handle:number):void}>;
  readonly limits:Readonly<{attachmentIntervalMs:number;attachmentRetryMs:number;repositoryBatchObjects:number;repositoryBatchBytes:number}>;
}
export interface BackupIntegrityController{
  readonly format:'study-director.backup-integrity-host';readonly contractVersion:1;
  readonly attachmentJob:Readonly<Job<{status:string;reason?:string;checked?:number;issues?:number}>>;
  readonly repositoryHooks:Readonly<IntegrityHooks>;
  attachmentIssue(id:string):AssetIssue|null;
  attachmentState():AttachmentIntegrityState|null;
  repositoryState():RepositoryIntegrityState|null;
  scheduleAttachment(delay?:number,trigger?:string):boolean;
  installAttachment():Promise<AttachmentIntegrityState|null>;
  installRepository():Promise<RepositoryIntegrityState|null>;
  requestRepositoryRecheck(target:string):Promise<boolean>;
  render():void;
  diagnosticRows():readonly Readonly<Record<string,unknown>>[];
}
export interface BackupIntegrityHostContract{
  readonly format:'study-director.backup-integrity-host-module';readonly contractVersion:1;
  normalizeAttachmentState(value:unknown,validId:(value:unknown)=>boolean):AttachmentIntegrityState;
  normalizeRepositoryTarget(value:unknown,normalizeContinuation:(value:unknown)=>IntegrityState|null):RepositoryIntegrityTarget;
  normalizeRepositoryState(value:unknown,normalizeContinuation:(value:unknown)=>IntegrityState|null):RepositoryIntegrityState;
  projectRepositoryResult(current:RepositoryIntegrityTarget,result:import('./repository-background.ts').IntegrityResult,now:string):unknown;
  createController(input:Readonly<BackupIntegrityInput>):Readonly<BackupIntegrityController>;
}
