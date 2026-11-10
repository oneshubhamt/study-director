import type {MetaDefinition,MetaGateway,MetaOwner} from './app-meta.ts';
import type {IndexedDb,LocalStoragePort,PersistenceModule,StoreNames} from './persistence.ts';
import type {DataContract,Limits} from './record-models.ts';
import type {RepositoriesInput,ValidatorInput} from './repositories.ts';
import type {ProfilesController} from './profiles.ts';
import type {ProfileScopeValue} from './profile-scope.ts';
import type {RepositoryJournalsModule} from '../source/core/repository-journals.ts';
import type {RepositoriesModule} from '../source/core/repositories.ts';
import type {AppMetaModule} from './app-meta.ts';
import type {HostMetadataModule} from './host-metadata.ts';

export type ProfileScopePort=ProfileScopeValue;
export interface LocalStorageKeys{
  readonly recovery:string;readonly appOwner:string;readonly mutationLock:string;readonly storageHealth:string;readonly installationId:string;
  readonly deletionRecovery:string;readonly fallbackDailyRecords:string;readonly noteRescue:string;readonly fontScale:string;readonly keepScreenAwake:string;
  readonly installNoticeShown:string;readonly systemAlerts:string;readonly theme:string;readonly presentation:string;readonly pwaUpdateCheck:string;
  readonly insightsWindow:string;readonly libraryView:string;readonly driveSession:string;readonly profiles:string;
}
export interface SessionStorageKeys{readonly appTab:string;readonly pwaReload:string;readonly notifications:string}
export interface AppMetaKeys{
  readonly planDraft:string;readonly planLibrary:string;readonly personalPreferences:string;readonly canonicalMutationEpoch:string;
  readonly backupPreparationUnitPrefix:string;readonly insightsDatasetRevision:string;readonly dataMaintenance:string;
  readonly savedDayDeletionPrefix:string;readonly noteDeletionPrefix:string;readonly attachmentDeletionPrefix:string;readonly pendingReviewPrefix:string;
  readonly libraryClearJournalState:string;readonly libraryClearJournalPayloadPrefix:string;readonly restoreJournalState:string;readonly restoreJournalPayload:string;readonly mutationLease:string;
  readonly verifiedRecoveryBackups:string;readonly backupProtection:string;readonly attachmentIntegrityAudit:string;readonly deviceFolder:string;
  readonly repositoryIntegrityScrub:string;readonly managedProviderBackupPending:string;readonly repositoryMaintenancePending:string;
  readonly reconciliationBase:string;readonly reconciliationBaseNotePrefix:string;readonly reconciliationBaseDayPrefix:string;
}
export interface ExternalRepositoryIdentities{
  readonly deviceFolderPickerId:string;readonly backupFolderPrefix:string;readonly deviceFolderObjects:string;readonly deviceFolderCheckpoints:string;readonly deviceFolderCommits:string;
  readonly driveFolder:string;readonly driveFolderMarker:string;readonly driveFolderProfileMarker:string;readonly driveDeletedProfileMarker:string;
  readonly driveFileSecurityMarker:string;readonly driveFileDigestMarker:string;readonly driveRepositoryMarker:string;readonly driveRepositoryVersionMarker:string;
  readonly driveRepositoryKindMarker:string;readonly driveRepositoryIdMarker:string;readonly driveAppVersionMarker:string;readonly driveExportedAtMarker:string;
}
export interface RuntimeStoreDefinition{readonly key:string;readonly schema:string}
export interface RuntimeDataContract extends DataContract{
  readonly app:string;
  readonly storage:{readonly dbName:string;readonly dbVersion:number;readonly stores:Readonly<Record<keyof StoreNames,RuntimeStoreDefinition>>};
  readonly schemas:DataContract['schemas']&{
    readonly DailyRecord:{readonly version:16;readonly key:string};
    readonly DailySummary:{readonly version:5;readonly key:string};
    readonly ActiveSession:{readonly version:10;readonly key:string};
    readonly Note:{readonly version:3;readonly key:string;readonly trashKeyPrefix:string};
    readonly PendingReview:{readonly version:2;readonly key:string};
    readonly AppMeta:{readonly version:number;readonly key:string};
    readonly CheckpointMetadata:{readonly version:number;readonly format:string};
    readonly CheckpointProtectedManifest:{readonly version:number;readonly format:string};
    readonly Backup:{readonly version:24;readonly format:string};
  };
}
export interface EntityDefinition{readonly schema:number;readonly idField:string;readonly store:string;readonly backupLimit:number;readonly fixedId?:string}
export type EntityType='dailyRecord'|'note'|'activeSession';
export interface AppConfiguration{readonly appName:string;readonly attribution:string;readonly defaultName:string;readonly storagePrefix:string;readonly factorySchedule:string}
export interface BootstrapConfiguration{
  readonly APP_VERSION:string;readonly APP_CONFIG:Readonly<AppConfiguration>;readonly APP_LIMITS:Limits;readonly ProfileScope:Readonly<ProfileScopePort>;
  readonly DEVICE_WIDE_STORAGE_KEYS:readonly (keyof LocalStorageKeys)[];readonly STORAGE_KEYS:Readonly<LocalStorageKeys>;
  readonly SESSION_STORAGE_KEYS:Readonly<SessionStorageKeys>;readonly APP_META_KEYS:Readonly<AppMetaKeys>;
  readonly EXTERNAL_REPOSITORY_IDENTITIES:Readonly<ExternalRepositoryIdentities>;readonly APP_META_REGISTRY:Readonly<Record<string,MetaDefinition>>;
  readonly DATA_CONTRACT:Readonly<RuntimeDataContract>;readonly DB_STORES:Readonly<StoreNames>;readonly DB_NAME:string;readonly DB_VER:number;
  readonly DB_DAILY_RECORD_STORE:string;readonly DB_DAILY_SUMMARY_STORE:string;readonly DB_NOTES_STORE:string;readonly DB_ACTIVE_SESSION_STORE:string;readonly DB_APP_META_STORE:string;readonly DB_ASSET_STORE:string;
  readonly ACTIVE_SESSION_ID:string;readonly ENTITY_DEFINITIONS:Readonly<Record<EntityType,Readonly<EntityDefinition>>>;readonly BACKUP_ENTITY_TYPES:readonly EntityType[];
  readonly FACTORY_DEFAULTS:Readonly<{studentName:string;scheduleText:string}>;
  entityDefinition(type:unknown):Readonly<EntityDefinition>|null;entityIdentity(type:unknown,value:unknown):string;
}
export interface ConfigurationInput{
  readonly release:string;readonly profileScope:Readonly<ProfileScopePort>;
  readonly raw:Readonly<{
    productionLimits:unknown;deviceWideStorageKeys:unknown;localStorageKeys:unknown;sessionStorageKeys:unknown;appMetaKeys:unknown;
    externalRepositoryIdentities:unknown;appMetaRegistry:unknown;runtimeDataContract:unknown;indexedDbStoreNames:unknown;
  }>;
  readonly richText:Readonly<{assetPolicy:Readonly<{maxBytes:number;maxPerDocument:number;maxBytesPerDocument:number;maxDimensionPx:number;maxPixels:number}>}>;
  readonly attachments:Readonly<{limits?:Readonly<{maxImage?:number;maxPdfAudio?:number}>}>;
}
export interface InstallationInput{readonly module:PersistenceModule;readonly local:LocalStoragePort;readonly installationKey:string;readonly navigator:Parameters<PersistenceModule['describeDevice']>[0]}
export interface NamingInput{
  readonly module:PersistenceModule;readonly identity:ReturnType<PersistenceModule['createInstallationIdentity']>;
  readonly currentProfile:()=>Readonly<{name?:string}>|null;readonly repositories:ExternalRepositoryIdentities;
}
export interface IndexedDbInput{
  readonly module:PersistenceModule;readonly config:Readonly<{dbName:string;dbVersion:number;stores:StoreNames}>;
  readonly hooks:Parameters<PersistenceModule['createIndexedDb']>[0]['hooks'];
}
export interface MetadataInput{
  readonly gateway:MetaGateway;readonly repositoriesModule:RepositoriesModule;readonly repositoryValidatorInput:ValidatorInput;
  readonly journalsModule:RepositoryJournalsModule;readonly journalLimits:Limits;
  readonly hostMetadataModule:HostMetadataModule;readonly hostValidatorInput:Parameters<HostMetadataModule['createAppMetaValidators']>[0];
}
export interface MetadataOwners{
  readonly RepositoryAppMeta:Readonly<MetaOwner>;readonly JournalAppMeta:Readonly<MetaOwner>;readonly HostAppMeta:Readonly<MetaOwner>;
  readonly ExportsAppMeta:Readonly<MetaOwner>;readonly DeviceFolderAppMeta:Readonly<MetaOwner>;readonly BackupAppMeta:Readonly<MetaOwner>;
}
export interface RepositoryCompositionInput{
  readonly repositoriesModule:RepositoriesModule;readonly journalsModule:RepositoryJournalsModule;
  readonly journal:Readonly<{appMeta:MetaOwner;limits:Limits;helpers:{clampText(value:unknown,max:number):string};clock:{nowMs():number}}>;
  readonly appData:Omit<RepositoriesInput,'journals'>;
}
export type AppData=ReturnType<RepositoriesModule['createAppData']>;
export type RepositoryJournals=ReturnType<RepositoryJournalsModule['create']>;
export interface RepositoryComposition{readonly RepositoryJournals:Readonly<RepositoryJournals>;readonly AppData:Readonly<AppData>}

export interface UnsupportedDataInput{
  readonly dataContract:RuntimeDataContract;readonly stores:StoreNames;readonly indexedDb:IndexedDb;readonly appMeta:MetaGateway;
  readonly profiles:ProfilesController;readonly profileScope:Pick<ProfileScopePort,'scope'>;
  readonly notices:Readonly<{emit(event:Readonly<Record<string,unknown>>):unknown}>;
  checkUnsupportedUpdate():unknown;checkForUpdate():PromiseLike<unknown>;
  capture(scope:string,error:unknown):unknown;
}
export interface UnsupportedDataState{
  readonly total:number;readonly held:number;readonly protected:number;readonly stores:Readonly<Record<string,number>>;readonly reasons:Readonly<Record<string,number>>;
  readonly items:Readonly<{days:number;notes:number;attachments:number;sessions:number;settings:number}>;
  readonly blocked:Readonly<{version:number;missing:readonly string[];changed:readonly string[]}>|null;
}
export interface UnsupportedDataController{
  census():Promise<Readonly<UnsupportedDataState>>;summary():Readonly<UnsupportedDataState>;held():boolean;describe(state?:UnsupportedDataState):string;
  announce():boolean;reportBlocked():boolean;blocked():UnsupportedDataState['blocked'];
}

export interface DataBootstrapHostModule{
  readonly format:'study-director.data-bootstrap-host-module';readonly contractVersion:1;
  createConfiguration(input:Readonly<ConfigurationInput>):Readonly<BootstrapConfiguration>;
  createInstallationIdentity(input:Readonly<InstallationInput>):Readonly<ReturnType<PersistenceModule['createInstallationIdentity']>>;
  createNaming(input:Readonly<NamingInput>):Readonly<{deviceName(id:unknown,others?:Iterable<unknown>):string;backupFolderName(options?:Readonly<{device?:boolean}>):string}>;
  createIndexedDb(input:Readonly<IndexedDbInput>):Readonly<IndexedDb>;
  createAppMetaGateway(input:Readonly<{module:AppMetaModule;indexedDb:IndexedDb;store:string;registry:Readonly<Record<string,MetaDefinition>>}>):Readonly<MetaGateway>;
  createMetadataOwners(input:Readonly<MetadataInput>):Readonly<MetadataOwners>;
  createRepositoryComposition(input:Readonly<RepositoryCompositionInput>):Readonly<RepositoryComposition>;
  createUnsupportedData(input:Readonly<UnsupportedDataInput>):Readonly<UnsupportedDataController>;
}
