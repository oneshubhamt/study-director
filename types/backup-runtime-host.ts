import type {BackupModule} from '../source/core/backup.ts';
import type {AttachmentsModule} from '../source/core/attachments.ts';
import type {ExportsModule} from '../source/core/exports.ts';
import type {ReconciliationBaselineModule} from '../source/core/reconciliation-baseline.ts';
import type {BackupRuntimeInput,Completion,Signal} from './backup.ts';
import type {AssetMetadata,AssetRow} from './asset-storage.ts';
import type {ImportedAsset} from './backup-models.ts';
import type {AppData} from './data-bootstrap-host.ts';
import type {ScratchFiles} from './exports.ts';
import type {PlanDataController} from './plan-host.ts';
import type {PlanDraftController} from './plan.ts';
import type {ReconciliationUiController} from './reconciliation-ui.ts';
import type {StorageHealthController,VerifiedRecoveryController} from './backup-readiness-host.ts';

export type BackupRuntime=ReturnType<BackupModule['createRuntime']>;
export type ExportCoordinator=ReturnType<ExportsModule['createCoordinator']>;
export type BackupProtection=ReturnType<ExportsModule['createProtection']>;
export type ReconciliationBaseline=ReturnType<ReconciliationBaselineModule['createStore']>;

export interface BackupRuntimeAssetPort<Token>{
  during<T>(operation:()=>Promise<T>):Promise<T>;
  get(id:string):Promise<Blob|null>;put(id:string,blob:Blob):Promise<unknown>;keys():Promise<string[]>;list():Promise<AssetRow[]>;
  stage(id:string,blob:Blob,options:Readonly<{token:Token;signal?:AbortSignal;check():void}>):Promise<AssetMetadata>;
  publish(rows:readonly (readonly [string,AssetMetadata])[],token:Token,check:()=>void,options:Readonly<{restoreLabels:true;replaceAll:boolean}>):Promise<unknown>;
  discard(rows:readonly AssetMetadata[]):Promise<unknown>;
  identify(blob:Blob):Promise<Blob>;
  issueToken(reason:string):Token;assertToken(token:Token,reason:string):unknown;
  removeMany(ids:readonly string[]):Promise<unknown>;removeMetadata(ids:readonly string[]):Promise<{removed:number}>;
  invalidateLibrary():unknown;scheduleMaintenance(delay?:number):unknown;
}
export interface BackupRuntimeHostEvents{
  libraryChanged():unknown;
  reconcileNotes:BackupRuntimeInput['ports']['events']['reconcileNotes'];
  restoreNotesSnapshot:BackupRuntimeInput['ports']['events']['restoreNotesSnapshot'];
  restoreSessionState:BackupRuntimeInput['ports']['events']['restoreSessionState'];
  verifyActiveSessionRuntime:BackupRuntimeInput['ports']['events']['verifyActiveSessionRuntime'];
  notifyBackupChange(change:Readonly<{urgent:boolean;reason:string}>):unknown;
  settleStorageReset():unknown;resetBackupNudge():unknown;refreshStorageWarning():unknown;scheduleUpdate(delay:number):unknown;
}
export interface BackupRuntimeHostInput<Token>{
  readonly module:BackupModule;
  readonly configuration:BackupRuntimeInput['ports']['configuration'];
  readonly appData:AppData;
  readonly storageHealthKey:string;
  readonly storageHealth:Pick<StorageHealthController,'snapshot'|'markOk'>;
  readonly storageGeneration:()=>number;
  readonly personal:Readonly<{draft:Pick<PlanDraftController,'flush'>;data:Pick<PlanDataController,'settled'|'exportData'|'importData'|'verify'>;inputValue():string|null|undefined;canMutate():boolean}>;
  readonly files:ScratchFiles;readonly processing:ExportCoordinator;readonly protection:BackupProtection;
  readonly backgroundAvailable:()=>boolean|string;
  readonly assets:Readonly<BackupRuntimeAssetPort<Token>>;
  readonly referenceRevision:()=>number;readonly mutationGeneration:()=>number;
  readonly baseline:ReconciliationBaseline;
  readonly codecs:BackupRuntimeInput['ports']['codecs'];
  readonly reconciliation:BackupRuntimeInput['ports']['reconciliation'];
  readonly noteReconciliation:Readonly<{controller:ReconciliationUiController;withMaintenancePaused<T>(operation:()=>Promise<T>):Promise<T>;merge:BackupRuntimeInput['ports']['noteReconciliation']['merge']}>;
  readonly session:BackupRuntimeInput['ports']['session'];
  readonly domain:BackupRuntimeInput['ports']['domain'];
  readonly view:BackupRuntimeInput['ports']['view'];
  readonly events:Readonly<BackupRuntimeHostEvents>;
  readonly verifiedRecovery:Pick<VerifiedRecoveryController,'record'>;
  readonly interactions:BackupRuntimeInput['ports']['interactions'];
  readonly operations:BackupRuntimeInput['ports']['operations'];
  readonly environment:BackupRuntimeInput['ports']['environment'];
  readonly diagnostics:BackupRuntimeInput['ports']['diagnostics'];
}
export interface BackupRuntimeHostController{
  readonly format:'study-director.backup-runtime-host';readonly contractVersion:1;
  readonly runtime:BackupRuntime;
  setFastFenceReady(value:boolean):boolean;
  sourceRevision():string;
  snapshotRevision(options?:Readonly<{full?:boolean}>):Promise<string>;
}
export type {Completion,ImportedAsset,Signal};
