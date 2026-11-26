import type {AssetStorageModule} from '../../source/core/asset-storage.ts';
import type {AttachmentsModule} from '../../source/core/attachments.ts';
import type {BackupModule} from '../../source/core/backup.ts';
import type {BackupRecoveryHostModule} from '../../source/core/backup-recovery-host.ts';
import type {DeviceBackupModule} from '../../source/core/device-backup.ts';
import type {BackupIntegrityHostModule} from '../../source/core/backup-integrity-host.ts';
import type {BackupMaintenanceHostModule} from '../../source/core/backup-maintenance-host.ts';
import type {BackupReadinessHostModule} from '../../source/core/backup-readiness-host.ts';
import type {RepositoriesModule} from '../../source/core/repositories.ts';
import type {RepositoriesInput} from '../repositories.ts';
import type {BackgroundMaintenanceInput,RepositoryMaintenanceController} from '../backup-maintenance-host.ts';
import type {StorageResetInput} from '../backup-recovery-host.ts';
import type {BackupIntegrityController,BackupIntegrityInput} from '../backup-integrity-host.ts';
import type {AutomaticBackupPolicyInput,BackupNudgeInput,CanonicalCommitController,VerifiedRecoveryInput} from '../backup-readiness-host.ts';
import type {MetadataOwners} from '../data-bootstrap-host.ts';

type BackupRuntime=ReturnType<BackupModule['createRuntime']>;
type AppData=ReturnType<RepositoriesModule['createAppData']>;
type AssetStore=ReturnType<AssetStorageModule['create']>;
type References=ReturnType<AttachmentsModule['createReferenceCoordinator']>;

declare const runtime:BackupRuntime;
declare const appData:AppData;
declare const repositoryMaintenance:RepositoryMaintenanceController;
declare const maintenanceModule:BackupMaintenanceHostModule;
declare const integrity:BackupIntegrityController;
declare const storage:AssetStore;
declare const references:References;
declare const canonical:CanonicalCommitController;
declare const readinessModule:BackupReadinessHostModule;
declare const recoveryModule:BackupRecoveryHostModule;
declare const deviceBackup:ReturnType<DeviceBackupModule['createController']>;
declare const metadataOwners:MetadataOwners;
declare const canonicalEvent:Parameters<RepositoriesInput['hooks']['onCanonicalCommit']>[0];

runtime.providers.configureRepositoryMaintenance(repositoryMaintenance.hooks);
runtime.providers.configureIntegrityScrub(integrity.repositoryHooks);

const backgroundData=Object.freeze({
  maintenance:appData.maintenance,
  notes:appData.notes
}) satisfies BackgroundMaintenanceInput['data'];
void backgroundData;

const providerForeground=runtime.providers satisfies BackgroundMaintenanceInput['foreground']['providers'];
const controllerForeground=runtime.controller satisfies BackgroundMaintenanceInput['foreground']['backupController'];
void providerForeground;void controllerForeground;

const integrityMetadata=Object.freeze({attachment:metadataOwners.HostAppMeta,repository:metadataOwners.BackupAppMeta}) satisfies BackupIntegrityInput['metadata'];
const integrityStorage=storage satisfies BackupIntegrityInput['storage'];
const integrityReferences=references satisfies BackupIntegrityInput['references'];
const integrityProvider=runtime.providers satisfies BackupIntegrityInput['provider'];
void integrityMetadata;void integrityStorage;void integrityReferences;void integrityProvider;

canonical.handle(canonicalEvent);


const verifiedRecoveryInput=Object.freeze({
  metadata:Object.freeze({read:async()=>null,write:async(_value:Parameters<VerifiedRecoveryInput['metadata']['write']>[0])=>true}),
  storageHealth:Object.freeze({snapshot:()=>({version:3 as const,lastLocalSaveAt:null,lastStudyDataSaveAt:null,browserDataClearedAt:null,issues:Object.freeze([]),hasIssues:false}),updateHistory:(_patch:Parameters<VerifiedRecoveryInput['storageHealth']['updateHistory']>[0])=>({version:3 as const,lastLocalSaveAt:null,lastStudyDataSaveAt:null,browserDataClearedAt:null,issues:Object.freeze([]),hasIssues:false})}),
  mutationEpoch:Object.freeze({latestChangeAt:(recorded:string)=>appData.mutationEpoch.latestChangeAt(recorded)}),
  backupVersion:24,sourceRevision:()=>'',refreshProviders:()=>runtime.providers.refresh(),
  capture:(_scope:string,_error:unknown,_level:'warn'|'error')=>{},nowIso:()=>new Date().toISOString()
}) satisfies Readonly<VerifiedRecoveryInput>;
readinessModule.createVerifiedRecovery(verifiedRecoveryInput);

const storageResetCanonical=Object.freeze({
  dailyRecordsList:()=>appData.dailyRecords.list({strict:true}),notesReadFreshPayload:()=>appData.notes.readFreshPayload(),activeSessionLoad:()=>appData.activeSession.load(0,{strict:true}),
  planDataRead:()=>appData.planData.read(),attachmentsList:()=>storage.list(),pendingReviewsList:()=>appData.pendingReviews.list(),
  savedDayDeletions:()=>appData.deletionRecovery.savedDays(),noteDeletions:()=>appData.deletionRecovery.notes()
}) satisfies StorageResetInput['canonical'];
const storageResetProvider=Object.freeze({
  history:(id:string,options:Parameters<StorageResetInput['provider']['history']>[1])=>runtime.providers.history(id,options),
  restoreRepositoryProviderVersion:(id:string,options:Parameters<StorageResetInput['provider']['restoreRepositoryProviderVersion']>[1])=>runtime.providers.restoreRepositoryProviderVersion(id,options),
  bringInRepositoryProvider:(id:string,options:Parameters<StorageResetInput['provider']['bringInRepositoryProvider']>[1])=>runtime.providers.bringInRepositoryProvider(id,options),
  syncRepositoryProvider:(id:string)=>runtime.providers.syncRepositoryProvider(id),
  list:()=>runtime.providers.list(),locationStatus:(id:string)=>runtime.providers.locationStatus(id),
  suspendBackground:(reason:string)=>runtime.providers.suspendBackground(reason),connected:(id:string)=>runtime.providers.connected(id)
}) satisfies StorageResetInput['provider'];
const storageResetDevice=Object.freeze({
  status:()=>deviceBackup.status(),connect:()=>deviceBackup.connect(),install:()=>deviceBackup.install(),refreshPermission:()=>deviceBackup.refreshPermission(),
  rememberAfterStorageReset:()=>deviceBackup.rememberAfterStorageReset()
}) satisfies StorageResetInput['device'];
void storageResetCanonical;void storageResetProvider;void storageResetDevice;

recoveryModule.createStorageReset(Object.freeze({
  authority:Object.freeze({canMutate:()=>true,captureOrigin:()=>()=>{}}),canonical:storageResetCanonical,
  writeback:Object.freeze({installationKeep:()=>true,notesRecover:()=>true,planRewrite:()=>true,settingsFlush:()=>true,hasTasks:()=>false,writeLiveDraft:()=>appData.activeSession.load(0,{strict:true})}),
  provider:storageResetProvider,device:storageResetDevice,
  storage:Object.freeze({health:()=>({lastStudyDataSaveAt:null,browserDataClearedAt:null}),updateHealth:()=>{},storedHealth:()=>null,indexedDbLifecycle:()=>({resets:0,startedFresh:false})}),
  presentation:Object.freeze({restoreChoices:()=>'',openRestore:()=>false,confirm:async()=>false,notify:()=>{},emit:()=>{},resolve:()=>{},subscribe:()=>()=>{}}),
  ownership:Object.freeze({announceStorageReset:()=>{}}),mutation:Object.freeze({settled:async()=>{}}),background:Object.freeze({wake:()=>{}}),
  session:Object.freeze({hasBlocking:()=>false,suspend:async()=>{}}),view:Object.freeze({refreshAfterWriteback:()=>{}}),
  readiness:Object.freeze({reconcileStartupChangeClock:async()=>true}),diagnostics:Object.freeze({capture:()=>{}}),
  environment:Object.freeze({now:()=>Date.now(),nowIso:()=>new Date().toISOString(),setTimeout:(callback:()=>void,ms:number)=>window.setTimeout(callback,ms),clearTimeout:(handle:number)=>window.clearTimeout(handle)})
}));

const backupNudgeInput=Object.freeze({
  verified:readinessModule.createVerifiedRecovery(verifiedRecoveryInput),storageHealth:verifiedRecoveryInput.storageHealth,dueMs:7,checkMs:1,
  canMutate:()=>true,now:()=>Date.now(),automaticActive:()=>runtime.providers.automaticActive(),dailySummaryCount:async()=>0,todayIso:()=> '2026-11-15',
  publishMessage:(_message:string)=>{},notify:(_title:string,_message:string,_tag:string)=>{},capture:(_scope:string,_error:unknown,_level:'warn')=>{}
}) satisfies Readonly<BackupNudgeInput>;
readinessModule.createBackupNudge(backupNudgeInput);

const automaticBackupPolicyInput=Object.freeze({
  verified:readinessModule.createVerifiedRecovery(verifiedRecoveryInput),currentRevision:()=>'',canonicalEmpty:async()=>false
}) satisfies Readonly<AutomaticBackupPolicyInput>;
const automaticBackupPolicy=readinessModule.createAutomaticBackupPolicy(automaticBackupPolicyInput);
runtime.providers.configureAutomaticBackup(automaticBackupPolicy);

const providerBackgroundBridge=maintenanceModule.createProviderBackgroundBridge(Object.freeze({
  provider:()=>runtime.providers,capture:(_scope:string,_error:unknown,_level:'warn')=>{}
}));
providerBackgroundBridge.noteChange(Object.freeze({urgent:true,reason:'canonical-commit'}));
void providerBackgroundBridge.waiting();
