import type {BrowserRegistry} from '../../types/browser-registry.ts';
import type {PresentationKernel} from '../../types/presentation.ts';
import type {ProfileScopeValue} from '../../types/profile-scope.ts';
import type {StudyDirectorPublicApi} from '../../types/public-api-host.ts';
import type {RichTextApi,AssetStore,WorkspaceOverlayPort,NotePort} from '../../rich-text/editor.ts';
import type {ActiveSession,PersonalPreferences} from '../../types/record-models.ts';
import type {SessionActionState} from '../../types/session-actions.ts';
import type {Task} from '../../types/domain.ts';
import type {NoteEditorBinding,NoteSyncState,NoteCatalogueInput} from '../../types/notes-host.ts';

type HostWindow=Window&{StudyDirector?:StudyDirectorPublicApi;StudyDirectorRichText?:RichTextApi};
const HOST_WINDOW=window as HostWindow;


(()=>{
'use strict';
// Study Director host composition map
// 1. Config/constants and durable data contract
// 2. Private module resolution and host-owned composition contracts
// 3. Shared DOM/scalar adapters and Timer/session runtime state
// 4. Storage health, active-session recovery, and repository composition
// 5. Schedule/runtime coordination, defaults, and ongoing subject-note bridges
// 6. Shell UI, presentation, navigation, plugins, and cross-feature orchestration
// 7. Timer recovery/presentation adapters and private module composition
// 8. Public capability boundary, DOM bindings, and startup/lifecycle composition
//
// Dependency spine:
// private registry -> host contracts/state -> repositories -> feature controllers ->
// shell/public plugins -> DOM/startup. Private modules never resolve one another.
/* CONFIG AND DATA CONTRACT */
const INTERNAL_MODULES=(window as unknown as Record<symbol,unknown>)[Symbol.for('studyDirector.internalModules.v1')] as BrowserRegistry|undefined;
if(!INTERNAL_MODULES||INTERNAL_MODULES.format!=='study-director.internal-module-registry'||INTERNAL_MODULES.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const AttachmentsModule=INTERNAL_MODULES.load('attachments',1,'study-director.attachments-module',1);
const AttachmentIngestModule=INTERNAL_MODULES.load('attachment-ingest',1,'study-director.attachment-ingest',1);
const AssetStorageModule=INTERNAL_MODULES.load('asset-storage',1,'study-director.asset-storage',3);
const OperationLifecycle=INTERNAL_MODULES.load('operation-lifecycle',1,'study-director.operation-lifecycle',1);
const AssetMaintenanceModule=INTERNAL_MODULES.load('asset-maintenance',1,'study-director.asset-maintenance-module',2,Object.freeze({lifecycle:OperationLifecycle}));
const PersistenceModule=INTERNAL_MODULES.load('persistence',1,'study-director.persistence-primitives',1);
const AppMetaModule=INTERNAL_MODULES.load('app-meta',1,'study-director.app-meta',1);
const HostMetadataModule=INTERNAL_MODULES.load('host-metadata',1,'study-director.host-metadata-module',1);
const ReconciliationBaselineModule=INTERNAL_MODULES.load('reconciliation-baseline',1,'study-director.reconciliation-baseline-module',1);
const RecordCodecsModule=INTERNAL_MODULES.load('record-codecs',1,'study-director.record-codecs',1);
const BackupCodecModule=INTERNAL_MODULES.load('backup-codec',1,'study-director.backup-codec',1);
const CanonicalModule=INTERNAL_MODULES.load('canonical',1,'study-director.canonical',1);
const ReconciliationModule=INTERNAL_MODULES.load('reconciliation',1,'study-director.reconciliation-module',1,Object.freeze({canonical:CanonicalModule}));
const ReconciliationUIModule=INTERNAL_MODULES.load('reconciliation-ui',1,'study-director.reconciliation-ui-module',1);
const InteractionsModule=INTERNAL_MODULES.load('interactions',1,'study-director.interactions-module',1);
const WorkspaceOverlayModule=INTERNAL_MODULES.load('workspace-overlay',1,'study-director.workspace-overlay-module',1);
const BackupPresentationModule=INTERNAL_MODULES.load('backup-presentation',1,'study-director.backup-presentation-module',1);
const PresentationHostModule=INTERNAL_MODULES.load('presentation-host',1,'study-director.presentation-host-module',1);
const AudioEngineModule=INTERNAL_MODULES.load('audio-engine',1,'study-director.audio-engine-module',1);
const NoticeCoordinatorModule=INTERNAL_MODULES.load('notice-coordinator',1,'study-director.notice-coordinator-module',1);
const NavigationModule=INTERNAL_MODULES.load('navigation',1,'study-director.navigation-module',1);
const FoundationHostModule=INTERNAL_MODULES.load('foundation-host',1,'study-director.foundation-host-module',1);
const PublicApiHostModule=INTERNAL_MODULES.load('public-api-host',1,'study-director.public-api-host-module',1);
const DataBootstrapHostModule=INTERNAL_MODULES.load('data-bootstrap-host',1,'study-director.data-bootstrap-host-module',1);

const RepositoryJournalModule=INTERNAL_MODULES.load('repository-journals',1,'study-director.repository-journals',1);
const SaveLaneModule=INTERNAL_MODULES.load('save-lane',1,'study-director.save-lane-module',1);
const NotesRepositoryModule=INTERNAL_MODULES.load('repositories-notes',1,'study-director.notes-repository-module',1);
const RepositoryModule=INTERNAL_MODULES.load('repositories',1,'study-director.repositories',1);
const ReviewPersistenceModule=INTERNAL_MODULES.load('review-persistence',1,'study-director.review-persistence-module',1);
const ReviewHostModule=INTERNAL_MODULES.load('review-host',1,'study-director.review-host-module',1);
const ReviewModule=INTERNAL_MODULES.load('review',1,'study-director.review',1);
const ExportsModule=INTERNAL_MODULES.load('exports',1,'study-director.exports-module',1,Object.freeze({lifecycle:OperationLifecycle}));
const IntegrityContinuationModule=INTERNAL_MODULES.load('integrity-continuation',1,'study-director.integrity-continuation-module',1);
const NoteExportModule=INTERNAL_MODULES.load('note-export',1,'study-director.note-export-module',2);
const LibraryClearModule=INTERNAL_MODULES.load('library-clear',1,'study-director.library-clear-module',2);
const RichTextHostModule=INTERNAL_MODULES.load('rich-text-host',1,'study-director.rich-text-host-module',1);
const DocumentHostModule=INTERNAL_MODULES.load('document-host',1,'study-director.document-host-module',1);
const NoteLinksModule=INTERNAL_MODULES.load('note-links',1,'study-director.note-links-module',1);
const NotesHostModule=INTERNAL_MODULES.load('notes-host',1,'study-director.notes-host-module',1);
const ProfilesModule=INTERNAL_MODULES.load('profiles',1,'study-director.profiles-module',1);
const ProfilesHostModule=INTERNAL_MODULES.load('profiles-host',1,'study-director.profiles-host-module',1);
const LibraryModule=INTERNAL_MODULES.load('library',1,'study-director.library-module',1);
const ManagedRepositoryModule=INTERNAL_MODULES.load('managed-repository',1,'study-director.managed-repository-module',1);
const RepositoryPolicyModule=INTERNAL_MODULES.load('repository-policy',1,'study-director.repository-policy-module',1);
const RepositoryBackgroundModule=INTERNAL_MODULES.load('repository-background',1,'study-director.repository-background-module',1,Object.freeze({lifecycle:OperationLifecycle}));
const MutationCoordinatorModule=INTERNAL_MODULES.load('mutation-coordinator',1,'study-director.mutation-coordinator-module',1);
const BackupOperationDiagnosticsModule=INTERNAL_MODULES.load('backup-operation-diagnostics',1,'study-director.backup-operation-diagnostics-module',1,Object.freeze({lifecycle:OperationLifecycle}));
const BackupProviderModule=INTERNAL_MODULES.load('backup-provider',1,'study-director.backup-provider-module',1,Object.freeze({repositoryPolicy:RepositoryPolicyModule}));
const BackupCaptureModule=INTERNAL_MODULES.load('backup-capture',1,'study-director.backup-capture-module',1);
const BackupModule=INTERNAL_MODULES.load('backup',1,'study-director.backup-module',1,Object.freeze({backupCapture:BackupCaptureModule,backupProvider:BackupProviderModule,canonical:CanonicalModule,managedRepository:ManagedRepositoryModule,repositoryBackground:RepositoryBackgroundModule}));
const ManagedRecoveryModule=INTERNAL_MODULES.load('managed-recovery',1,'study-director.managed-recovery-module',1);
const DeviceFolderStorageModule=INTERNAL_MODULES.load('device-folder-storage',1,'study-director.device-folder-storage-module',1);
const DeviceBackupModule=INTERNAL_MODULES.load('device-backup',1,'study-director.device-backup-module',1);
const BackupActionsHostModule=INTERNAL_MODULES.load('backup-actions-host',1,'study-director.backup-actions-host-module',1);
const SyncStatusHostModule=INTERNAL_MODULES.load('sync-status-host',1,'study-director.sync-status-host-module',1);
const BackupReadinessHostModule=INTERNAL_MODULES.load('backup-readiness-host',1,'study-director.backup-readiness-host-module',1);
const BackupMaintenanceHostModule=INTERNAL_MODULES.load('backup-maintenance-host',1,'study-director.backup-maintenance-host-module',1);
const BackupIntegrityHostModule=INTERNAL_MODULES.load('backup-integrity-host',1,'study-director.backup-integrity-host-module',1);
const BackupRecoveryHostModule=INTERNAL_MODULES.load('backup-recovery-host',1,'study-director.backup-recovery-host-module',1);
const PwaLifecycleModule=INTERNAL_MODULES.load('pwa-lifecycle',1,'study-director.pwa-lifecycle-module',1);
const PwaUpdateHostModule=INTERNAL_MODULES.load('pwa-update-host',1,'study-director.pwa-update-host-module',1);
const NativeCapabilitiesModule=INTERNAL_MODULES.load('native-capabilities',1,'study-director.native-capabilities-module',1);
const CapabilitiesHostModule=INTERNAL_MODULES.load('capabilities-host',1,'study-director.capabilities-host-module',1);
const PlanHostModule=INTERNAL_MODULES.load('plan-host',1,'study-director.plan-host-module',1);
const PlanModule=INTERNAL_MODULES.load('plan',1,'study-director.plan-module',1);
const StartupLifecycleModule=INTERNAL_MODULES.load('startup-lifecycle',1,'study-director.startup-lifecycle',1);
const StartupHostModule=INTERNAL_MODULES.load('startup-host',1,'study-director.startup-host-module',1);
const InsightsHostModule=INTERNAL_MODULES.load('insights-host',1,'study-director.insights-host-module',1);
const OwnershipModule=INTERNAL_MODULES.load('ownership',1,'study-director.ownership',1);
const TimerStateModule=INTERNAL_MODULES.load('timer-state',1,'study-director.timer-state',1);
const SessionLifecycleModule=INTERNAL_MODULES.load('session-lifecycle',1,'study-director.session-lifecycle',1);
const PomodoroModule=INTERNAL_MODULES.load('pomodoro',1,'study-director.pomodoro-module',1);
const PracticePacerModule=INTERNAL_MODULES.load('practice-pacer',1,'study-director.practice-pacer-module',1);
const TimerEngineModule=INTERNAL_MODULES.load('timer-engine',2,'study-director.timer-engine-module',2);
const SessionActionsModule=INTERNAL_MODULES.load('session-actions',1,'study-director.session-actions-module',1);
const ExecutionViewsModule=INTERNAL_MODULES.load('execution-views',1,'study-director.execution-views-module',1);
const ExecutionHostModule=INTERNAL_MODULES.load('execution-host',1,'study-director.execution-host-module',1);
const SessionHostModule=INTERNAL_MODULES.load('session-host',1,'study-director.session-host-module',1);
const SessionHandoffModule=INTERNAL_MODULES.load('session-handoff',1,'study-director.session-handoff-module',1);
const PRESENTATION_KERNEL=(window as unknown as Record<symbol,unknown>)[Symbol.for('studyDirector.presentationKernel.v1')] as PresentationKernel|undefined;
const PRESENTATION_MANIFEST=PRESENTATION_KERNEL&&PRESENTATION_KERNEL.manifest;
if(!PRESENTATION_KERNEL||PRESENTATION_KERNEL.format!=='study-director.presentation-kernel'||PRESENTATION_KERNEL.version!==1||!PRESENTATION_MANIFEST||PRESENTATION_MANIFEST.format!=='study-director.presentation-manifest'||PRESENTATION_MANIFEST.version!==1){
  throw new Error('Study Director presentation kernel is unavailable or incompatible.');
}
const DEFAULT_THEME_ID=PRESENTATION_MANIFEST.defaults.theme;
const DEFAULT_PRESENTATION_ID=PRESENTATION_MANIFEST.defaults.preferredPresentation;
const {themes:THEME_DEFINITIONS}=PRESENTATION_MANIFEST;
const THEME_IDS=Object.freeze(Object.keys(THEME_DEFINITIONS));
const PUBLIC_THEME_METADATA=Object.freeze(THEME_IDS.map(id=>THEME_DEFINITIONS[id]));
const {
  invariants:PRESENTATION_INVARIANTS, breakpoints:PRESENTATION_BREAKPOINTS, tokens:PRESENTATION_TOKEN_CONTRACT
}=PRESENTATION_MANIFEST;
const NOTES_SEARCH_WORKER_URL='@@SD_SEARCH_WORKER_FILENAME@@';
const RICH_TEXT_BOOT_API=HOST_WINDOW.StudyDirectorRichText;
if(!RICH_TEXT_BOOT_API||!RICH_TEXT_BOOT_API.assetPolicy||typeof RICH_TEXT_BOOT_API.isAssetId!=='function'||typeof RICH_TEXT_BOOT_API.isSupportedImageType!=='function'){throw new Error('Study Director rich text runtime is unavailable or incompatible.');}
const ProfileScopeBootstrap=(window as unknown as Record<symbol,unknown>)[Symbol.for('studyDirector.profileScope.v1')] as ProfileScopeValue|undefined;
if(!ProfileScopeBootstrap)throw new Error('Study Director profile scope is unavailable or incompatible.');
function decodeBuildJson(value:string,label:string):unknown{
  try{return JSON.parse(decodeURIComponent(value)) as unknown;}catch(error){throw new TypeError('Invalid '+label+' build input.',{cause:error});}
}
function decodeBuildStringRecord(value:string,label:string):Readonly<Record<string,string>>{
  const parsed=decodeBuildJson(value,label);
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new TypeError('Invalid '+label+' build input.');
  const entries=Object.entries(parsed as Record<string,unknown>);
  if(entries.some(([,item])=>typeof item!=='string'||!item))throw new TypeError('Invalid '+label+' build input.');
  return Object.freeze(Object.fromEntries(entries) as Record<string,string>);
}
function decodeBuildStringArray(value:string,label:string):readonly string[]{
  const parsed=decodeBuildJson(value,label);
  if(!Array.isArray(parsed))throw new TypeError('Invalid '+label+' build input.');
  const items:unknown[]=parsed;
  if(items.some(item=>typeof item!=='string'||!item))throw new TypeError('Invalid '+label+' build input.');
  return Object.freeze(items.map(item=>String(item)));
}
const RAW_LOCAL_STORAGE_KEYS=decodeBuildStringRecord('@@SD_LOCAL_STORAGE_KEYS_URI@@','local storage keys');
const DEVICE_WIDE_STORAGE_KEY_NAMES=new Set<string>(decodeBuildStringArray('@@SD_DEVICE_WIDE_LOCAL_STORAGE_KEYS_URI@@','device-wide storage keys'));
const {
  APP_VERSION,APP_CONFIG,APP_LIMITS,ProfileScope,DEVICE_WIDE_STORAGE_KEYS,STORAGE_KEYS,SESSION_STORAGE_KEYS,APP_META_KEYS,EXTERNAL_REPOSITORY_IDENTITIES,APP_META_REGISTRY,
  DATA_CONTRACT,DB_STORES,DB_NAME,DB_VER,DB_DAILY_RECORD_STORE,DB_DAILY_SUMMARY_STORE,DB_NOTES_STORE,DB_ACTIVE_SESSION_STORE,DB_APP_META_STORE,DB_ASSET_STORE,
  ACTIVE_SESSION_ID,ENTITY_DEFINITIONS,BACKUP_ENTITY_TYPES,FACTORY_DEFAULTS,entityDefinition,entityIdentity
}=DataBootstrapHostModule.createConfiguration(Object.freeze<Parameters<typeof DataBootstrapHostModule.createConfiguration>[0]>({
  release:'@@SD_RELEASE@@',
  profileScope:ProfileScopeBootstrap,
  raw:Object.freeze({
    productionLimits:decodeBuildJson('@@SD_PRODUCTION_LIMITS_URI@@','production limits'),
    deviceWideStorageKeys:[...DEVICE_WIDE_STORAGE_KEY_NAMES],
    localStorageKeys:RAW_LOCAL_STORAGE_KEYS,
    sessionStorageKeys:decodeBuildJson('@@SD_SESSION_STORAGE_KEYS_URI@@','session storage keys'),
    appMetaKeys:decodeBuildJson('@@SD_APP_META_KEYS_URI@@','AppMeta keys'),
    externalRepositoryIdentities:decodeBuildJson('@@SD_EXTERNAL_REPOSITORY_IDENTITIES_URI@@','external repository identities'),
    appMetaRegistry:decodeBuildJson('@@SD_APP_META_REGISTRY_URI@@','AppMeta registry'),
    runtimeDataContract:decodeBuildJson('@@SD_RUNTIME_DATA_CONTRACT_URI@@','runtime data contract'),
    indexedDbStoreNames:decodeBuildJson('@@SD_INDEXED_DB_STORE_NAMES_URI@@','IndexedDB store names')
  }),
  richText:RICH_TEXT_BOOT_API,
  attachments:AttachmentsModule
}));
const STUDY_DIRECTOR_CAPABILITIES=Object.freeze({
  pluginApi:1,
  tabRegistry:1,
  planDraft:1,
  previewRecords:1,
  insightsDataSource:1,
  insightsRecordView:1,
  outcomeClassifier:1,
  practicePacerEvidence:1,
  presentationEngine:1,
  presentationPacks:1,
  backupController:1,
  backupProviders:1,
  installation:1,
  workspaceHistory:1
});
// All externally keyed dictionary data flows through this helper. It prevents
// prototype-key collisions and keeps own-property access consistent.
const {KeyedRecord,textEl,on,emptyMsg,setProgressSummary,setElementText,setElementValue,setElementClass,setElementHidden,setElementDisabled,setElementAttribute,setElementStyle,setTextSafe,cachedElements,clampText,clampArray,wipeObject,boundedInt,boundedNumber,safeBoolean,finiteNumber,optionalBoundedNumber,optionalText,sameDataValue}=FoundationHostModule.createPrimitives({document,APP_LIMITS,CompletionModel:{fromUnits:(done,total)=>CompletionModel.fromUnits(done,total)}});
// Data access is instantiated after the codecs through the private repository module.
let StorageHealthController:ReturnType<typeof BackupReadinessHostModule.createStorageHealth>|null=null;
let StorageResetRecovery:ReturnType<typeof BackupRecoveryHostModule.createStorageReset>|null=null,BackupNudge:ReturnType<typeof BackupReadinessHostModule.createBackupNudge>|null=null;
let NativeCapabilities:ReturnType<typeof CapabilitiesHostModule.createController>|null=null,CapabilityBadge:ReturnType<typeof CapabilitiesHostModule.createBadge>|null=null;
let DeviceBackup:ReturnType<typeof BackupActionsHostModule.createDeviceBackup>|null=null,BackupRecoveryHost:ReturnType<typeof BackupRecoveryHostModule.createHost>|null=null,KeptVersions:ReturnType<typeof BackupRecoveryHostModule.createKeptVersions>|null=null,BackupActions:ReturnType<typeof BackupActionsHostModule.createControls>|null=null;
function requireDeviceBackup(){if(!DeviceBackup)throw new Error('Study Director Device Backup is unavailable.');return DeviceBackup;}
function requireBackupActions(){if(!BackupActions)throw new Error('Study Director backup controls are unavailable.');return BackupActions;}
function requireBackupProtectionHost(){if(!BackupProtectionHost)throw new Error('Study Director backup protection is unavailable.');return BackupProtectionHost;}
function requireNativeCapabilities(){if(!NativeCapabilities)throw new Error('Study Director native capabilities are unavailable.');return NativeCapabilities;}
function requireSyncStatusHost(){if(!SyncStatusHost)throw new Error('Study Director sync status host is unavailable.');return SyncStatusHost;}
function requireNavigationController(){if(!NavigationController)throw new Error('Study Director navigation controller is unavailable.');return NavigationController;}
function requireAttachmentLibrary(){if(!AttachmentLibrary)throw new Error('Study Director attachment library is unavailable.');return AttachmentLibrary;}
function requireBackupRecoveryHost(){if(!BackupRecoveryHost)throw new Error('Study Director backup recovery host is unavailable.');return BackupRecoveryHost;}

const BackgroundTasks=NativeCapabilitiesModule.createTaskScheduler(window);
const LocalStorageContract=PersistenceModule.createLocalStorage(Object.freeze<Parameters<typeof PersistenceModule.createLocalStorage>[0]>({
  onError:(operation,error)=>StorageHealthController?.observeLocalStorage(operation,error),
  onOk:operation=>StorageHealthController?.observeLocalStorage(operation,null)
}));
StorageHealthController=BackupReadinessHostModule.createStorageHealth(Object.freeze<Parameters<typeof BackupReadinessHostModule.createStorageHealth>[0]>({
  local:LocalStorageContract,key:STORAGE_KEYS.storageHealth,maxStatusMessageChars:APP_LIMITS.maxStatusMessageChars,clampText,
  refreshWarning:()=>refreshStorageFallbackWarning(),scheduleSyncStatus:()=>scheduleSyncStatus(),document,
  timeLabelFromIso:value=>timeLabelFromIso(value),
  renderCapabilities:()=>NativeCapabilities?renderNativeCapabilities(NativeCapabilities.status()):false
}));
function localISODate(dateLike:Date|string|number){
  const d=new Date(dateLike);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function storageHealthTime(iso:string|null|undefined){
  if(!iso)return 'never';
  const date=new Date(iso);if(!Number.isFinite(date.getTime()))return 'unknown';
  return localISODate(date)===localISODate(new Date())?timeLabelFromIso(iso)||'today':date.toLocaleDateString('en-IN',{day:'2-digit',month:'short'});
}
function publishSafetyNotice(message:unknown,title:string='Unsaved work needs attention',id:string='safety'){
  const text=String(message||'').trim();
  return NoticeCoordinator.publish(String(id||'safety'),{visible:!!text,kind:'safety',title,message:text||'Resolved.',compact:noticeCanCompact(text)});
}
function renderFileBackup(){return BackupActions?.renderFile();}
const AppDiagnostics=(()=>{
  function capture(scope:string,error:unknown,level:'warn'|'error'|'info'='warn'){
    // Contained faults remain observable to external QA without retaining a
    // second, private error database on the user's device.
    try{
      const method=level==='error'?'error':level==='info'?'info':'warn';
      console[method](`[Study Director] ${clampText(scope||'app',80)}`,error);
    }catch(reportingError){}
    return null;
  }
  function guard<T,F=null>(scope:string,fn:()=>T,fallback:F|null=null):T|F|null{try{return fn();}catch(error){capture(scope,error,'error');return fallback;}}
  return Object.freeze({capture,guard});
})();
type BackupRecorderInput=Parameters<typeof BackupOperationDiagnosticsModule.createRecorder>[0];
const BackupOperationDiagnostics=BackupOperationDiagnosticsModule.createRecorder(Object.freeze<BackupRecorderInput>({
  configuration:Object.freeze<BackupRecorderInput['configuration']>({release:APP_VERSION,limit:20}),
  environment:Object.freeze<BackupRecorderInput['environment']>({now:()=>Date.now()}),
  storage:Object.freeze<BackupRecorderInput['storage']>({
    read:()=>sessionStorage.getItem('study-director.backup-operation-diagnostics.v1')||'',
    write:value=>{try{sessionStorage.setItem('study-director.backup-operation-diagnostics.v1',String(value||''));return true;}catch{return false;}}
  })
}));
if(!Object.isFrozen(BackupOperationDiagnostics)||BackupOperationDiagnostics.format!=='study-director.backup-operation-diagnostics'||BackupOperationDiagnostics.contractVersion!==1){
  throw new Error('Study Director backup-operation diagnostics recorder is unavailable or incompatible.');
}
const DecisionClock=Object.freeze({nowMs:()=>Date.now()});
/* INSTALLATION IDENTITY + PERSISTENCE HELPERS · IMPORTED */
const {
  randomIdPart,normalizeTimestamp,normalizeImportedTimestamp,normalizeImportedEpochMillis,jsonByteLength
}=PersistenceModule;
const InstallationIdentity=DataBootstrapHostModule.createInstallationIdentity(Object.freeze<Parameters<typeof DataBootstrapHostModule.createInstallationIdentity>[0]>({
  module:PersistenceModule,local:LocalStorageContract,installationKey:STORAGE_KEYS.installationId,navigator
}));
// The people who use Study Director on this device (core/profiles.ts).
type ProfilesControllerInput=Parameters<typeof ProfilesHostModule.createController>[0];
const Profiles=ProfilesHostModule.createController(Object.freeze<ProfilesControllerInput>({module:ProfilesModule,ports:Object.freeze<ProfilesControllerInput['ports']>({
  scope:Object.freeze<ProfilesControllerInput['ports']['scope']>({pattern:ProfileScope.pattern,registryKey:ProfileScope.registryKey,scope:ProfileScope.scope,separator:ProfileScope.separator}),
  storage:Object.freeze<ProfilesControllerInput['ports']['storage']>({
    read:()=>LocalStorageContract.getText(ProfileScope.registryKey,null),
    write:text=>LocalStorageContract.setText(ProfileScope.registryKey,text),
    keys:()=>LocalStorageContract.keys(),
    remove:key=>LocalStorageContract.remove(key)
  }),
  names:Object.freeze<ProfilesControllerInput['ports']['names']>({database:DATA_CONTRACT.storage.dbName,directories:Object.freeze(['@@SD_ATTACHMENT_OPFS_DIRECTORY@@','@@SD_BACKUP_FILES_OPFS_DIRECTORY@@']),keys:Object.freeze(Object.entries(RAW_LOCAL_STORAGE_KEYS).filter(([name])=>!DEVICE_WIDE_STORAGE_KEY_NAMES.has(name)).map(([,key])=>key))}),
  platform:ProfilesHostModule.createPlatform({indexedDB,window,localStorage,storage:navigator.storage,now:()=>Date.now(),random:randomIdPart,reload:()=>location.reload()}),
  limits:Object.freeze<ProfilesControllerInput['ports']['limits']>({maxName:APP_LIMITS.maxStudentNameChars})
})}));
Profiles.watch();
const ProfileViews=ProfilesHostModule.createViews({document,Profiles,APP_LIMITS,FACTORY_DEFAULTS,clampText,appCanMutate:()=>appCanMutate(),scheduleSyncStatus,
 driveStatus:()=>BackupProviderRuntime.locationStatus('google-drive'),protectionStatus:()=>BackupProtection.status(),deviceName:()=>PersistenceModule.deviceName(InstallationIdentity.getId()),
 connectDrive:()=>connectDriveForProfile(),disconnectDrive:()=>BackupProviderRuntime.disconnect('google-drive'),AppDiagnostics,Interactions:{notify:input=>Interactions.notify(input)}
});
const {deviceName,backupFolderName}=DataBootstrapHostModule.createNaming(Object.freeze<Parameters<typeof DataBootstrapHostModule.createNaming>[0]>({
  module:PersistenceModule,identity:InstallationIdentity,currentProfile:()=>Profiles.current(),repositories:EXTERNAL_REPOSITORY_IDENTITIES
}));
/* SHARED PURE HELPERS */
/* Internal domain-module boundary. */
const DOMAIN_LIMITS=Object.freeze({
  maxAreaNameChars:APP_LIMITS.maxAreaNameChars,
  maxDurationMinutes:APP_LIMITS.maxDurationMinutes,
  maxScheduleChars:APP_LIMITS.maxScheduleChars,
  maxScheduleRows:APP_LIMITS.maxScheduleRows,
  maxTaskNameChars:APP_LIMITS.maxTaskNameChars,
  maxTasksPerDay:APP_LIMITS.maxTasksPerDay,
  maxUnitChars:APP_LIMITS.maxUnitChars
});
const DomainModule=INTERNAL_MODULES.load('domain',1,'study-director.domain',1,DOMAIN_LIMITS);
INTERNAL_MODULES.lock();
const {
  TimeModel, ScheduleModel, CompletionModel, OutcomeModel, COMPLETION_SOURCES, TASK_OUTCOMES, makeTaskId
}=DomainModule;
const {
  rolloverHour:STUDY_DAY_ROLLOVER_HOUR, dayMinutes:STUDY_DAY_MINUTES, clockToMinute:t2m,
  clockMinuteToStudyMinute, studyMinuteToHHMM, currentStudySecond, formatSeconds:fmtS, formatOvertime:fmtOver,
  formatDuration:fmtDur, isValidHHMM, normalizeHHMM, isValidIsoDate, isoDateDay, minuteOfDay:getMinuteOfDay,
  positiveMinutes
}=TimeModel;
/* DOM PRIMITIVES */

/* SHARED INTERACTION AND SYSTEM-ALERT SERVICES */
let NavigationController:ReturnType<typeof NavigationModule.createController>|null=null;
const {WorkspaceRouteCoordinator,WorkspaceHistoryBridge,WorkspaceHistoryPublic}=FoundationHostModule.createWorkspace({navigation:()=>NavigationController,interactions:()=>Interactions,overlay:()=>WorkspaceOverlay});


const {renderNotificationSurfaces,renderCoordinatedNotice,noticeCanCompact,setStatus}=FoundationHostModule.createNoticeViews({document,notifications:()=>NoticeCoordinator,clampText,maxStatusMessageChars:APP_LIMITS.maxStatusMessageChars});
const NoticeCoordinator=NoticeCoordinatorModule.createCoordinator(Object.freeze<Parameters<typeof NoticeCoordinatorModule.createCoordinator>[0]>({
  render:renderCoordinatedNotice,now:()=>Date.now(),
  setTimeout:(callback,delay)=>setTimeout(callback,delay),clearTimeout:timer=>clearTimeout(timer),
  installationCooldownMs:1200,capture:(scope,error)=>AppDiagnostics.capture(scope,error,'warn')
}));
if(!Object.isFrozen(NoticeCoordinator)||NoticeCoordinator.format!=='study-director.notice-coordinator'||NoticeCoordinator.contractVersion!==1){
  throw new Error('Study Director notice coordinator is unavailable or incompatible.');
}
const {renderNativeCapabilities}=CapabilitiesHostModule.createViews(Object.freeze<Parameters<typeof CapabilitiesHostModule.createViews>[0]>({document,window,notices:NoticeCoordinator}));
// Recent (docs/areas/notifications.md): today's pop-ups and banners in the profile
// panel. Kept for this window across a reload (sessionStorage), tied to the
// profile; never uploaded or backed up. Opening the panel marks news seen.
const {NotificationRecent}=FoundationHostModule.createRecent({document,sessionStorage,SESSION_STORAGE_KEYS,ProfileScope,NoticeCoordinator,AppDiagnostics,scheduleSyncStatus,closeProfilePanel});
const {showBackupPresentation,openBackupRestore,backupRestoreChoices}=FoundationHostModule.createBackupActions({document,AppDiagnostics,device:()=>{if(!DeviceBackup)throw new Error('Study Director Device Backup is unavailable.');return DeviceBackup;},providers:()=>BackupProviderRuntime,history:()=>BackupRecoveryHost?.history,checkForUpdate:()=>PwaLifecycle.checkForUpdate(),connectDeviceBackupWithRecovery,connectDriveForProfile,goTab:(...args)=>goTab(...args),showData:()=>LibraryView.showSection('data'),preferredScrollBehavior:()=>preferredScrollBehavior()});
NoticeCoordinator.subscribe(renderNotificationSurfaces);
const BackupPresentation=BackupPresentationModule.createPresentation(Object.freeze<Parameters<typeof BackupPresentationModule.createPresentation>[0]>({notifications:NoticeCoordinator,timeLabel:storageHealthTime,synced:()=>BackupProviderRuntime.syncing()===true,verified:source=>VerifiedRecovery.verified(source),action:(source,kind)=>Object.freeze({label:kind==='permission'?(source==='device-folder'?'Allow access':'Reconnect'):kind==='sync-review'?'Review':kind==='sync-password'?'Enter password':kind==='sync-newer'?'Check for update':'Show details',opens:true,run:()=>showBackupPresentation(source,kind)})}));
type InteractionsInput=Parameters<typeof InteractionsModule.createController>[0];
const Interactions=InteractionsModule.createController(Object.freeze<InteractionsInput>({ports:Object.freeze<InteractionsInput['ports']>({
  environment:Object.freeze<InteractionsInput['ports']['environment']>({
    clearTimeout:id=>clearTimeout(id),document,
    nativeConfirm:message=>window.confirm(message),
    nativePrompt:(message,defaultValue)=>window.prompt(message,defaultValue),
    requestAnimationFrame:callback=>requestAnimationFrame(callback),
    setTimeout:(callback,delay)=>setTimeout(callback,delay),window
  }),
  diagnostics:Object.freeze<InteractionsInput['ports']['diagnostics']>({capture:(scope,error)=>AppDiagnostics.capture(scope,error,'warn')}),
  history:WorkspaceHistoryBridge,
  notifications:Object.freeze<InteractionsInput['ports']['notifications']>({notify:NoticeCoordinator.notify,subscribe:NoticeCoordinator.subscribe,dismissEvent:NoticeCoordinator.dismissEvent,dismissAll:NoticeCoordinator.dismissAll,pauseEvent:NoticeCoordinator.pauseEvent,setPaused:NoticeCoordinator.setPaused,setHidden:NoticeCoordinator.setHidden})
})}));
if(!Object.isFrozen(Interactions)||Interactions.format!=='study-director.interactions'||Interactions.contractVersion!==1){
  throw new Error('Study Director interaction controller is unavailable or incompatible.');
}
function compactInteractionOptions(value:unknown):Parameters<typeof Interactions.configure>[0]{
  const source=value&&typeof value==='object'?value as Record<string,unknown>:{};
  const clean:Record<string,unknown>={};for(const [key,item] of Object.entries(source))if(item!==undefined)clean[key]=item;
  return clean as Parameters<typeof Interactions.configure>[0];
}
type WorkspaceOverlayInput=Parameters<typeof WorkspaceOverlayModule.createController>[0];
const WorkspaceOverlay=WorkspaceOverlayModule.createController(Object.freeze<WorkspaceOverlayInput>({ports:Object.freeze<WorkspaceOverlayInput['ports']>({
  environment:Object.freeze<WorkspaceOverlayInput['ports']['environment']>({document}),
  history:WorkspaceHistoryBridge,
})}));
if(!Object.isFrozen(WorkspaceOverlay)||WorkspaceOverlay.format!=='study-director.workspace-overlay'||WorkspaceOverlay.contractVersion!==1){
  throw new Error('Study Director workspace overlay controller is unavailable or incompatible.');
}
const RichTextWorkspaceOverlay=Object.freeze({open:(options:Parameters<typeof WorkspaceOverlay.open>[0])=>WorkspaceOverlay.open(options)});
const {SystemNotifications}=FoundationHostModule.createSystem({window,document,navigator,location,NoticeCoordinator,Interactions,AppDiagnostics,appCanMutate:()=>appCanMutate(),readPreference:()=>AppData.local.getJson(STORAGE_KEYS.systemAlerts,false),writePreference:value=>AppData.local.setJson(STORAGE_KEYS.systemAlerts,value)});
const notifyUser=SystemNotifications.notify;
/* SOUND DELIVERY */
const {renderSoundSettings,setAppSoundMode,handleSoundModeChange}=FoundationHostModule.createSound({document,NoticeCoordinator,appCanMutate:()=>appCanMutate(),persistProtectedPreferences});
const AppAudio=AudioEngineModule.createEngine({window,document,onStatus:()=>renderSoundSettings()});
NoticeCoordinator.configureDelivery({audio:AppAudio,system:(...args)=>SystemNotifications.deliver(...args),context:()=>({owner:appCanMutate(),foreground:!document.hidden})});


window.addEventListener('pagehide',()=>{NoticeCoordinator.stopSound();});
window.addEventListener('beforeunload',()=>AppAudio.dispose());

const RichTextApi=RICH_TEXT_BOOT_API;
const RICH_VALIDATED_INPUT_META=Symbol.for('studyDirector.richValidatedInput.v1');
type RichValidatedInputMeta=Readonly<{format:'study-director.rich-validated-input';version:1;canonical:string;plain:string}>;
function validatedRichInputMeta(event:unknown,field:{value:string}|null|undefined):RichValidatedInputMeta|null{
  if(!event||typeof event!=='object')return null;
  const meta=Reflect.get(event,RICH_VALIDATED_INPUT_META) as unknown;
  if(!meta||typeof meta!=='object')return null;
  const row=meta as Record<string,unknown>;
  if(row['format']!=='study-director.rich-validated-input'||row['version']!==1||typeof row['canonical']!=='string'||typeof row['plain']!=='string')return null;
  if(!field||String(field.value||'')!==row['canonical'])return null;
  return Object.freeze({format:'study-director.rich-validated-input',version:1,canonical:row['canonical'],plain:row['plain']});
}
if(typeof RichTextApi.mountRichTextEditor!=='function'||typeof RichTextApi.renderRichText!=='function'||typeof RichTextApi.toPlainText!=='function'||typeof RichTextApi.toMarkdown!=='function'||typeof RichTextApi.classifySerializedValue!=='function'||typeof RichTextApi.isRichTextValue!=='function'||typeof RichTextApi.measure!=='function'||typeof RichTextApi.assetIds!=='function'||typeof RichTextApi.scanAssetReferences!=='function'||typeof RichTextApi.scanAttachmentReferences!=='function'||typeof RichTextApi.insertAttachmentReference!=='function'||typeof RichTextApi.removeAttachmentReferences!=='function'||typeof RichTextApi.exportDocument!=='function'||typeof RichTextApi.compareRichText!=='function'||typeof RichTextApi.mergeIncomingAdditions!=='function'||typeof RichTextApi.appendIncomingAdditions!=='function'||typeof RichTextApi.mergeThreeWay!=='function'){
  throw new Error('Study Director rich text runtime is unavailable or incompatible.');
}
function clampEditorContent(value:unknown,plainLimit:number){
  const text=String(value??''),kind=RichTextApi.classifySerializedValue(text);
  if(kind==='rich')return text;
  return kind==='invalid-rich'?'':clampText(text,plainLimit);
}
function editorContentWithinLimits(value:unknown){
  const text=String(value??''),kind=RichTextApi.classifySerializedValue(text);
  if(kind==='invalid-rich')return false;
  if(kind!=='rich')return true;
  const size=RichTextApi.measure(text);return size.words<=APP_LIMITS.maxRichTextWords&&size.bytes<=APP_LIMITS.maxRichTextBytes;
}
function plainTextContent(value:unknown){return RichTextApi.toPlainText(String(value??''));}

function normalizeStudyQuality(value:unknown){
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  return Number.isInteger(n)&&n>=1&&n<=5?n:null;
}
/* SCHEDULE AND TASK DOMAIN MODELS · IMPORTED ALIASES */
const {
  token:scheduleToken, normalizeKind:normalizeScheduleKind, isWork:isWorkBlock, isSupport:isSupportBlock,
  isFixed:isFixedBlock, isTrackable:isTrackableBlock, isPomodoroEligible:isPomodoroEligibleBlock,
  hasNotes:hasOngoingTaskNotes, normalizeTarget:normalizeScheduleTarget, makeRow:makeScheduleRow,
  isCanonicalText:isCanonicalScheduleText, warningsMessage:scheduleWarningsMessage,
  parseText:parseScheduleDraftText, buildTasks, textFromRows:scheduleTextFromRows,
  fingerprint:scheduleFingerprintForRows, chronologicalRows, startMinutes:scheduleStartMinutes,
  normalizeArea:normalizeAreaName, displayArea:displayAreaName, areaValue:taskAreaValue,
  measureValue:taskMeasureValue, targetValue:taskTargetValue, areaLabel:taskAreaLabel, areaKey:taskAreaKey,
  parentAreaKeys:areaParentKeys
}=ScheduleModel;
const SUPPORT_NOTE=Object.freeze({
  key:'__study_director_support_activities__',
  label:'Support Activities'
});
function noteKeyForTask(task:Task){return isSupportBlock(task)?SUPPORT_NOTE.key:taskAreaKey(task);}
function noteLabelForTask(task:Task){return isSupportBlock(task)?SUPPORT_NOTE.label:taskAreaLabel(task);}
const {
  normalizeSource:normalizeCompletionSource, parseProgressNumber
}=CompletionModel;
const {
  classify:classifyTaskOutcome, emptyCounts:emptyTaskOutcomeCounts, count:countTaskOutcomes,
  sanitizeCounts:sanitizeTaskOutcomeCounts, total:taskOutcomeTotal, info:taskOutcomeInfo,
  summary:taskOutcomeSummaryText
}=OutcomeModel;
function updateExecutePanels(...args:Parameters<typeof ExecutionViews.updateExecutePanels>){return ExecutionViews.updateExecutePanels(...args);}
// Today's session as another device runs it, while this one shows it there.
function sessionShownElsewhere(...args:Parameters<typeof ExecutionViews.sessionShownElsewhere>){return ExecutionViews.sessionShownElsewhere(...args);}
// Today's session parked on this device (Suspend Today, or handed over by another).
function sessionParkedHere(...args:Parameters<typeof ExecutionViews.sessionParkedHere>){return ExecutionViews.sessionParkedHere(...args);}
function executeSessionStatusModel(...args:Parameters<typeof ExecutionViews.executeSessionStatusModel>){return ExecutionViews.executeSessionStatusModel(...args);}
function updateExecuteSessionStatus(...args:Parameters<typeof ExecutionViews.updateExecuteSessionStatus>){return ExecutionViews.updateExecuteSessionStatus(...args);}
/* RUNTIME STATE · CHECKED LIVE EXECUTION HOST */
const SLEEP_GAP_THRESHOLD_MS=120000;
// While the timer runs on a work block here, pop-ups that block nothing
// wait; support and fixed blocks, a pause or the end let them show
// (docs/areas/status-indicator.md, noise rules).
function syncStudyQuiet(...args:Parameters<typeof ExecutionViews.syncStudyQuiet>){return ExecutionViews.syncStudyQuiet(...args);}
type ExecutionHostPorts=Parameters<typeof ExecutionHostModule.createRuntime>[0];
const ExecutionRuntime=ExecutionHostModule.createRuntime(Object.freeze<Parameters<typeof ExecutionHostModule.createRuntime>[0]>({
  modules:Object.freeze<ExecutionHostPorts['modules']>({timerState:TimerStateModule,pomodoro:PomodoroModule,practicePacer:PracticePacerModule,timerEngine:TimerEngineModule}),
  timerState:Object.freeze<ExecutionHostPorts['timerState']>({
    helpers:Object.freeze<ExecutionHostPorts['timerState']['helpers']>({makeTaskId}),
    diagnostics:Object.freeze<ExecutionHostPorts['timerState']['diagnostics']>({capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level)}),
    effects:Object.freeze<ExecutionHostPorts['timerState']['effects']>({modeChanged:()=>{updateExecutePanels();void NativeCapabilities?.syncWake();syncStudyQuiet();}})
  }),
  pomodoro:Object.freeze<ExecutionHostPorts['pomodoro']>({
    schedule:Object.freeze<ExecutionHostPorts['pomodoro']['schedule']>({isPomodoroEligibleBlock}),
    persistence:Object.freeze<ExecutionHostPorts['pomodoro']['persistence']>({
      canMutate:()=>appCanMutate(),
      readConfiguration:()=>protectedPreferencesState.nudge,
      writeConfiguration:value=>persistProtectedPreferences({nudge:value,soundMode:NoticeCoordinator.soundStatus().mode}),
      writeSession:(...args)=>writeLiveDraftNow(...args)
    }),
    view:Object.freeze<ExecutionHostPorts['pomodoro']['view']>({document,notifications:NoticeCoordinator,updateExecutePanels}),
    environment:Object.freeze<ExecutionHostPorts['pomodoro']['environment']>({nowIso:()=>new Date().toISOString()})
  }),
  practiceModel:Object.freeze<ExecutionHostPorts['practiceModel']>({
    configuration:Object.freeze<ExecutionHostPorts['practiceModel']['configuration']>({APP_LIMITS}),
    domain:Object.freeze<ExecutionHostPorts['practiceModel']['domain']>({boundedInt,boundedNumber,clampArray,clampText,fmtS})
  }),
  practice:Object.freeze<ExecutionHostPorts['practice']>({
    configuration:Object.freeze<ExecutionHostPorts['practice']['configuration']>({APP_LIMITS}),
    schedule:Object.freeze<ExecutionHostPorts['practice']['schedule']>({isWorkBlock}),
    persistence:Object.freeze<ExecutionHostPorts['practice']['persistence']>({persistPracticeCueMode:mode=>{void persistPracticeCueMode(mode);},persistPracticeTarget:ms=>{void persistPracticeTarget(ms);},saveLiveDraft:options=>{void saveLiveDraft(options);},writeLiveDraftNow:()=>{void writeLiveDraftNow();}}),
    view:Object.freeze<ExecutionHostPorts['practice']['view']>({
      document,
      isExecutePaneVisible:()=>!document.hidden&&!!document.getElementById('pane-execute')?.classList.contains('on'),
      setElementAttribute,setElementClass,setElementDisabled,setElementHidden,setElementStyle,setElementText,setTextSafe
    }),
    userPreferences:Object.freeze<ExecutionHostPorts['practice']['userPreferences']>({notifications:NoticeCoordinator,readUserDefaults}),
    ownership:Object.freeze<ExecutionHostPorts['practice']['ownership']>({appCanMutate:()=>appCanMutate()}),
    clock:Object.freeze<ExecutionHostPorts['practice']['clock']>({nowMs:DecisionClock.nowMs})
  }),
  schedule:Object.freeze<ExecutionHostPorts['schedule']>({
    model:ScheduleModel,time:TimeModel,
    compactAdjustedSchedule:value=>compactAdjustedSchedule(value),
    invalidateDerived:options=>invalidateScheduleDerived(options)
  }),
  evidence:Object.freeze<ExecutionHostPorts['evidence']>({
    completionModel:CompletionModel,sources:COMPLETION_SOURCES,classifyTaskOutcome,
    taskTargetValue,
    renderCompletionChange:(...args)=>renderCompletionChange(...args),
    saveLiveDraft:()=>saveLiveDraft()
  }),
  timer:Object.freeze<ExecutionHostPorts['timer']>({
    configuration:Object.freeze<ExecutionHostPorts['timer']['configuration']>({APP_LIMITS,SLEEP_GAP_THRESHOLD_MS}),
    domain:Object.freeze<ExecutionHostPorts['timer']['domain']>({KeyedRecord,boundedInt,clampText,cleanDayRevision,fmtOver,fmtS,makeTaskId,positiveMinutes,shortTaskLabel,studyMinuteToHHMM,taskAreaValue,taskMeasureValue,taskTargetValue}),
    schedule:Object.freeze<ExecutionHostPorts['timer']['schedule']>({getLatestCarryForward:()=>latestCarryForward,getScheduleDerivedState:()=>ScheduleDerivedState,handleStudyDayRollover:(...args)=>{void handleStudyDayRollover(...args);},isLiveTrackableTimer,isWorkBlock,scheduleFingerprint,studyDayRolledOver:(...args)=>studyDayRolledOver(...args)}),
    persistence:Object.freeze<ExecutionHostPorts['timer']['persistence']>({compactPauseEvents:(...args)=>compactPauseEvents(...args),compactRealTimeSnapshot:(...args)=>compactRealTimeSnapshot(...args),flushLiveDraft:()=>{void flushLiveDraft();},maybeSnapshotRunningTimer:()=>{void maybeSnapshotRunningTimer();},recoverySetStatus,saveLiveDraft:()=>{void saveLiveDraft();},saveNote:()=>{void saveNote();},writeLiveDraftNow:()=>{void writeLiveDraftNow();}}),
    view:Object.freeze<ExecutionHostPorts['timer']['view']>({cachedElements,clearExecuteStateOverlay,invalidateExecuteIdleDisplay:()=>{executeIdleDisplayKey='';},refreshPnote,refreshExecuteIdleDisplay,requestRender,setElementStyle,setElementText,setTextSafe,setExecuteControlsEnabled,setExecuteShellVisible,showDone,showEmpty,textEl}),
    clock:Object.freeze<ExecutionHostPorts['timer']['clock']>({nowMs:DecisionClock.nowMs}),
    reviewEvidence:Object.freeze<ExecutionHostPorts['timer']['reviewEvidence']>({applicableNotesForTask,getReviewDate,updateRealTimeAwareness,updateTimerFocusMetrics}),
    clockEnvironment:Object.freeze<ExecutionHostPorts['timer']['clockEnvironment']>({cancelAnimationFrame:frame=>cancelAnimationFrame(frame),clearInterval:id=>clearInterval(id),document,getComputedStyle:element=>getComputedStyle(element),requestAnimationFrame:callback=>requestAnimationFrame(callback),setInterval:(callback,delay)=>setInterval(callback,delay),setTimeout:(callback,delay)=>setTimeout(callback,delay),window}),
    userPreferences:Object.freeze<ExecutionHostPorts['timer']['userPreferences']>({notifications:NoticeCoordinator}),
    ownership:Object.freeze<ExecutionHostPorts['timer']['ownership']>({appCanMutate:()=>appCanMutate()})
  }),
  hooks:Object.freeze<ExecutionHostPorts['hooks']>({syncStudyQuiet})
}));
const {
  TimerState,SessionState,TASKS,TIMER_MODES,TaskIdentity,setTimerMode,TaskSessionState,
  Pomodoro,PracticePacerModel,PracticePacer,TimerEngine,TimerPresentation,SessionEvidenceGateway,
  setCompletionSource,explicitCompletionSource,plannedSecondsForCompletion,unitCompletionForTask,progressInputState,
  syncProgressInputsToState,clearManualCompletionOverride,focusCompletionForTask,liveTaskOutcome,resolveTaskCompletion,
  exactTaskCompletionPercent,storeResolvedCompletion,setCompletionState,setTaskDoneState,setTaskSkippedState,
  rebuildOriginalSchedule,resetScheduleLayers,originalStartMin,originalEndMin,adjustedStartMin,adjustedEndMin,
  hasAdjustedTiming,scheduleWindowLabel,sanitizeRuntimeAdjustedSchedule,effectiveNowMin,plannedRows,isInsideAdjustedWindow,
  remainingWindowSeconds,fixedAnchorRowsFrom,avoidFixedAnchorOverlap,nextIncompleteTrackableFrom,findNextIncompleteTrackableAfter,
  buildLiveTimeline,getRealTimeState,buildRealTimeSnapshot,latestTrackableEndMin,
  setCurrentTask,resetBreakState,resetCountdownRuntime,clearProgressRuntime,isTaskResolved
}=ExecutionRuntime;
const FULL_WEEKDAY_NAMES=Object.freeze(['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']);
const ReviewDayState=ReviewHostModule.createDayState(Object.freeze<Parameters<typeof ReviewHostModule.createDayState>[0]>({
  document,timerState:TimerState,tasks:()=>TASKS,isTrackableBlock,isValidIsoDate,todayISO,fullWeekdayNames:FULL_WEEKDAY_NAMES
}));
function getReviewDate(){return ReviewDayState.getReviewDate();}
function cleanDayRevision(value:Parameters<typeof ReviewDayState['cleanRevision']>[0]){return ReviewDayState.cleanRevision(value);}
function daySaveDirty(date=getReviewDate()){return ReviewDayState.isDirty(date);}
function markDayContentChanged(){return ReviewDayState.markChanged();}
function markDayContentSaved(date:Parameters<typeof ReviewDayState['markSaved']>[0],revision:Parameters<typeof ReviewDayState['markSaved']>[1]){return ReviewDayState.markSaved(date,revision);}
function reviewDateTitle(iso:Parameters<typeof ReviewDayState['dateTitle']>[0]){return ReviewDayState.dateTitle(iso);}
function setReviewDateTitle(iso:Parameters<typeof ReviewDayState['setDateTitle']>[0]){return ReviewDayState.setDateTitle(iso);}
let ReviewSavedDayRuntime:ReturnType<typeof ReviewHostModule.createSavedDayCoordinator>|null=null;
function requireReviewSavedDayRuntime(){if(!ReviewSavedDayRuntime)throw new Error('Study Director Saved Day coordinator is unavailable.');return ReviewSavedDayRuntime;}
type ReviewSavedDayCoordinator=ReturnType<typeof ReviewHostModule.createSavedDayCoordinator>;
function promptSaveToday(...args:Parameters<ReviewSavedDayCoordinator['promptSaveToday']>){return requireReviewSavedDayRuntime().promptSaveToday(...args);}
function clearSaveReminder(...args:Parameters<ReviewSavedDayCoordinator['clearSaveReminder']>){return requireReviewSavedDayRuntime().clearSaveReminder(...args);}
function revalidateSaveReminderAfterCanonicalConvergence(...args:Parameters<ReviewSavedDayCoordinator['revalidateSaveReminder']>){return requireReviewSavedDayRuntime().revalidateSaveReminder(...args);}
function acknowledgeSavedStudyDay(...args:Parameters<ReviewSavedDayCoordinator['acknowledgeSavedStudyDay']>){return requireReviewSavedDayRuntime().acknowledgeSavedStudyDay(...args);}
function clearCanonicalSessionAfterSavedDay(...args:Parameters<ReviewSavedDayCoordinator['clearCanonicalSessionAfterSavedDay']>){return requireReviewSavedDayRuntime().clearCanonicalSessionAfterSavedDay(...args);}
function saveDayRecord(...args:Parameters<ReviewSavedDayCoordinator['saveDayRecord']>){return requireReviewSavedDayRuntime().saveDayRecord(...args);}
function handleStudyDayRollover(...args:Parameters<ReviewSavedDayCoordinator['handleStudyDayRollover']>){return requireReviewSavedDayRuntime().handleStudyDayRollover(...args);}
const {
  PRACTICE_CUE_DEFAULT,PRACTICE_PAUSE_CAUSES,formatPracticeMs,practicePaceBandLabel,sanitizePracticeCueMode,
  sanitizePracticeRun,sanitizePracticeRuns,sanitizePracticeState,summarizeCleanPracticeRuns,
  summarizePracticeRunsForInsights,validPracticeMs,actualRecordsSnapshot,actualTimeSnapshot,
  applyInactiveGapSplit,captureRuntimeEvidence,classifyInactiveGap,currentTimerActiveSeconds,
  handleInactiveGapSplitKey,handleOverlayFocusTrap,nowIso,pruneActualRecordAudit,restoredRuntimeRecordedSec,
  showInactiveGapSplit,syncTimerFromClock,beginTimerPause,getCurrentBreakSeconds,jumpTo,
  markDone:markDoneTimer,recordCurrentActiveToTask,recoveryCaptureActiveBeforeSwitch,reopenActualSessionForTimer,resolveActivePauseBeforeTimerSwitch,
  setPausedUI,setTimerIdentity,skipTask:skipTaskTimer,startCur,syncTimerAfterWake,
  toggleDone,togglePause:togglePauseTimer,updateBreakMeter,updateCD
}=TimerEngine;
const TimerRestoration=ExecutionHostModule.createTimerRestoration(Object.freeze<Parameters<typeof ExecutionHostModule.createTimerRestoration>[0]>({
  runtime:ExecutionRuntime,DecisionClock,isTrackableBlock,clampText,
  invalidateIdleDisplay:()=>{executeIdleDisplayKey='';},
  setExecuteShellVisible,setExecuteControlsEnabled,clearExecuteStateOverlay,refreshPnote,requestRender,updateBadges,flushLiveDraft
}));
function validateTimerRestoreCandidate(runtime:Parameters<typeof TimerRestoration['validateTimerRestoreCandidate']>[0]){return TimerRestoration.validateTimerRestoreCandidate(runtime);}
function restoreTimerRuntimeIfAny(){return TimerRestoration.restoreTimerRuntimeIfAny();}
/* TASK SESSION STATE · 3. LIVE DRAFT, NOTES, AND RECOVERY COORDINATION */
const LIVE_DRAFT_SAVE_DEBOUNCE_MS=1000;
const TIMER_SNAPSHOT_INTERVAL_MS=60*1000;
let ActiveSessionRuntime:ReturnType<typeof SessionHostModule.createController>|null=null,SessionHandoffRuntime:ReturnType<typeof SessionHandoffModule.createController>|null=null;
const SessionActionState={
 get sessionPanelMode(){return sessionPanelMode;},set sessionPanelMode(value){sessionPanelMode=value;},
 get sessionPanelSession(){return sessionPanelSession;},set sessionPanelSession(value){sessionPanelSession=value;},
 get sessionSafetyMessage(){return sessionSafetyMessage;},set sessionSafetyMessage(value){sessionSafetyMessage=value;},
 get sessionHandoff(){return sessionHandoff;},set sessionHandoff(value){sessionHandoff=value;},
 get sessionMovingHere(){return sessionMovingHere;},set sessionMovingHere(value){sessionMovingHere=value;},
 get sessionYieldedAt(){return sessionYieldedAt;},set sessionYieldedAt(value){sessionYieldedAt=value;},
 get saveReminderDate(){return ReviewDayState.reminder.date;},set saveReminderDate(value){ReviewDayState.reminder.date=value;},
 get saveReminderEvidence(){return ReviewDayState.reminder.evidence;},set saveReminderEvidence(value){ReviewDayState.reminder.evidence=value;},
 get saveReminderGeneration(){return ReviewDayState.reminder.generation;},set saveReminderGeneration(value){ReviewDayState.reminder.generation=value;}
};
function requireActiveSessionRuntime(){if(!ActiveSessionRuntime)throw new Error('Study Director Active Session runtime is unavailable.');return ActiveSessionRuntime;}
function requireMutationCoordinator(){if(!AppMutationCoordinator)throw new Error('Study Director mutation coordinator is unavailable.');return AppMutationCoordinator;}
function requireKeptVersions(){if(!KeptVersions)throw new Error('Study Director kept-version controller is unavailable.');return KeptVersions;}
const SessionActions=SessionActionsModule.createController(Object.freeze<Parameters<typeof SessionActionsModule.createController>[0]>({
  checkUnsupportedUpdate:(...args)=>checkUnsupportedUpdate(...args),applySchedule:(...args)=>applySchedule(...args),schedulePwaUpdateEvaluation:(...args)=>schedulePwaUpdateEvaluation(...args),
  state:SessionActionState,runtime:ExecutionRuntime,completionSources:COMPLETION_SOURCES,
  get AppData(){return AppData;},
  get ActiveSessionRuntime(){return requireActiveSessionRuntime();},
  get SessionHandoffRuntime(){return SessionHandoffRuntime;},
  get ActiveSessionCodec(){return ActiveSessionCodec;},
  get DailyRecordCodec(){return DailyRecordCodec;},
  get CanonicalModule(){return CanonicalModule;},
  get AppDiagnostics(){return AppDiagnostics;},
  get AppMutationCoordinator(){return requireMutationCoordinator();},
  get Interactions(){return Interactions;},
  get NoticeCoordinator(){return NoticeCoordinator;},
  get PlanDraftEditor(){return PlanDraftEditor;},
  get PlanScheduleGateway(){return PlanScheduleGateway;},
  get ReviewEditor(){return ReviewEditor;},
  get ReviewView(){return ReviewView;},
  get SessionLifecycle(){return SessionLifecycle;},
  get StartupLifecycle(){return StartupLifecycle;},
  get BackupProviderRuntime(){return BackupProviderRuntime;},
  get InstallationIdentity(){return InstallationIdentity;},
  get KeptVersions(){return requireKeptVersions();},
  markStorageHealthError:(...args)=>markStorageHealthError(...args),
  markStorageHealthOk:(...args)=>markStorageHealthOk(...args),
  refreshStorageFallbackWarning:(...args)=>refreshStorageFallbackWarning(...args),
  setPlanStatus:(...args)=>setPlanStatus(...args),
  prettyDate:(...args)=>prettyDate(...args),
  notifyBackupChange:(...args)=>notifyBackupChange(...args),
  updateExecuteSessionStatus:(...args)=>updateExecuteSessionStatus(...args),
  refreshExecuteIdleDisplay:(...args)=>refreshExecuteIdleDisplay(...args),
  updateSessionControls:(...args)=>updateSessionControls(...args),
  scheduleSyncStatus:(...args)=>scheduleSyncStatus(...args),
  goTab:(...args)=>goTab(...args),
  appCanMutate:(...args)=>appCanMutate(...args),
  ownershipRevision:()=>AppOwnership.revision,
  getReviewDate:(...args)=>getReviewDate(...args),
  resetCountdownRuntime:(...args)=>resetCountdownRuntime(...args),
  restoreTimerRuntimeIfAny:(...args)=>restoreTimerRuntimeIfAny(...args),
  showEmpty:(...args)=>showEmpty(...args),
  renderSched:(...args)=>renderSched(...args),
  updateBadges:(...args)=>updateBadges(...args),
  updateHeaderInfo:(...args)=>updateHeaderInfo(...args),
  updateRealTimeAwareness:(...args)=>updateRealTimeAwareness(...args),
  renderRecoveryReview:(...args)=>renderRecoveryReview(...args),
  updateExecutePanels:(...args)=>updateExecutePanels(...args),
  storageHealthTime:(...args)=>storageHealthTime(...args),
  deviceName:(...args)=>deviceName(...args),
  refreshCoreUi:(...args)=>refreshCoreUi(...args),
  clearCanonicalSessionAfterSavedDay:(...args)=>clearCanonicalSessionAfterSavedDay(...args),
  scheduleFingerprint:(...args)=>scheduleFingerprint(...args),
  parseScheduleDraftText:(...args)=>parseScheduleDraftText(...args),
  scheduleFingerprintForRows:(...args)=>scheduleFingerprintForRows(...args),
  isTrackableBlock:(...args)=>isTrackableBlock(...args),
  makeTaskId:(...args)=>makeTaskId(...args),
  shortTaskLabel:(...args)=>shortTaskLabel(...args),
  isValidIsoDate:(...args)=>isValidIsoDate(...args),
  todayISO:(...args)=>todayISO(...args),
  DecisionClock,SLEEP_GAP_THRESHOLD_MS,HANDOFF_RETRY_MESSAGE:SessionHandoffModule.retryMessage,navigator
}));

function clearSessionSafetyMessage(...args:Parameters<typeof SessionActions.clearSessionSafetyMessage>){return SessionActions.clearSessionSafetyMessage(...args);}
const ExecutionViewCache={get executePanelsRenderKey(){return executePanelsRenderKey;},set executePanelsRenderKey(value){executePanelsRenderKey=value;},get executeIdleDisplayKey(){return executeIdleDisplayKey;},set executeIdleDisplayKey(value){executeIdleDisplayKey=value;},get realTimeAwarenessRenderKey(){return realTimeAwarenessRenderKey;},set realTimeAwarenessRenderKey(value){realTimeAwarenessRenderKey=value;},get scheduleEndPromptKey(){return scheduleEndPromptKey;},set scheduleEndPromptKey(value){scheduleEndPromptKey=value;}};
const ExecutionViews=ExecutionViewsModule.createController(Object.freeze<Parameters<typeof ExecutionViewsModule.createController>[0]>({
 state:SessionActionState,cache:ExecutionViewCache,runtime:ExecutionRuntime,actions:SessionActions,document,window,APP_LIMITS,STUDY_DAY_MINUTES,
 SESSION_WATCH_MS:2*60*1000,SESSION_CLAIM_WATCH_MS:15*1000,setInterval:(fn,delay)=>setInterval(fn,delay),
 getCarryForward:()=>latestCarryForward,setCarryForward:value=>{latestCarryForward=value;},
get NoticeCoordinator(){return NoticeCoordinator;},
get AppDiagnostics(){return AppDiagnostics;},
get PlanDraftEditor(){return PlanDraftEditor;},
get PlanRuntime(){return PlanRuntime;},
get StartupLifecycle(){return StartupLifecycle;},
get BackupProviderRuntime(){return BackupProviderRuntime;},
get NativeCapabilities(){return NativeCapabilities;},
get Interactions(){return Interactions;},
isTrackableBlock:(...args)=>isTrackableBlock(...args),
isWorkBlock:(...args)=>isWorkBlock(...args),
isFixedBlock:(...args)=>isFixedBlock(...args),
isSupportBlock:(...args)=>isSupportBlock(...args),
shortTaskLabel:(...args)=>shortTaskLabel(...args),
clockHMS:(...args)=>clockHMS(...args),
setElementText:(element,value)=>setElementText(element??null,String(value??'')),
textEl:(...args)=>textEl(...args),
requestRender:(...args)=>requestRender(...args),
appCanMutate:(...args)=>appCanMutate(...args),
fmtS:(...args)=>fmtS(...args),
studyMinuteToHHMM:(...args)=>studyMinuteToHHMM(...args),
invalidateScheduleDerived:(...args)=>invalidateScheduleDerived(...args),
clearFutureUntouchedProgress:(...args)=>clearFutureUntouchedProgress(...args),
getTaskCompletion:(...args)=>getTaskCompletion(...args),
taskTargetValue:(...args)=>taskTargetValue(...args),
applicableNotesForTask:(...args)=>applicableNotesForTask(...args),
taskMeasureValue:(...args)=>taskMeasureValue(...args),
taskAreaValue:(...args)=>taskAreaValue(...args),
clampText:(...args)=>clampText(...args),
renderReviewUnfinishedNote:(...args)=>renderReviewUnfinishedNote(...args),
copyTextToClipboard:(...args)=>copyTextToClipboard(...args),
setTextSafe:(...args)=>setTextSafe(...args),
studyDayRolledOver:(...args)=>studyDayRolledOver(...args),
todayISO:(...args)=>todayISO(...args),
scheduleFingerprint:(...args)=>scheduleFingerprint(...args),
promptSaveToday:(...args)=>promptSaveToday(...args),
refreshCoreUi:(...args)=>refreshCoreUi(...args),
saveLiveDraft:(...args)=>saveLiveDraft(...args),
flushLiveDraft:(...args)=>flushLiveDraft(...args),
refreshSessionSafetyUi:(...args)=>refreshSessionSafetyUi(...args),
calculateReviewMetrics:(...args)=>calculateReviewMetrics(...args),
durationLabel:(...args)=>durationLabel(...args),
cachedElements:(...args)=>cachedElements(...args),
notifyBackupChange:(...args)=>notifyBackupChange(...args),
schedulePwaUpdateEvaluation:(...args)=>schedulePwaUpdateEvaluation(...args),
wakeSessionOwnershipClaim:(...args)=>wakeSessionOwnershipClaim(...args)
}));
let sessionPanelMode:SessionActionState['sessionPanelMode']='none',sessionPanelSession:ActiveSession|null=null;
let sessionSafetyMessage='';
// The checked sync/status host is declared early because storage health can
// request a profile-indicator redraw during start-up.
let SyncStatusHost:ReturnType<typeof SyncStatusHostModule.createController>|null=null,syncStatusPending=false,sessionHandoff={step:'',error:''},sessionMovingHere:ActiveSession|null=null,sessionYieldedAt=0;
let ManagedRecoveryQuiescence:ReturnType<typeof BackupRecoveryHostModule.createQuiescence>|null=null;
let refreshSessionSafetyUi=()=>{};
function restoreSessionPersistenceSuppressed(){return !!ActiveSessionRuntime?.persistenceSuppressed();}
function managedRecoverySessionQuiesced(){return ManagedRecoveryQuiescence?.active()||false;}
async function withRestoreSessionPersistenceSuppressed<T>(operation:()=>Promise<T>):Promise<T>{
  if(!ActiveSessionRuntime)throw new Error('Active Session runtime is unavailable.');
  return ActiveSessionRuntime.withPersistenceSuppressed(operation);
}
function hasBlockingActiveSession(...args:Parameters<typeof SessionActions.hasBlockingActiveSession>){return SessionActions.hasBlockingActiveSession(...args);}
type ReviewEditorAdapter=ReturnType<typeof ReviewModule.createReviewSubsystem>['ReviewEditor'];
type RichTextRuntimeAdapter=ReturnType<typeof RichTextHostModule.createRuntime>;
let hydrateReviewState:ReviewEditorAdapter['hydrate']=()=>{throw new Error('Study Director review editor is unavailable.');};
let currentReviewSnapshot:ReviewEditorAdapter['activeSessionReview']=()=>Object.freeze({reflection:'',studyQuality:null});
let bindReviewSession:ReviewEditorAdapter['bindSession']=()=>false;
let richTextClose:RichTextRuntimeAdapter['close']=()=>Promise.resolve(false);
let richTextCloseField:RichTextRuntimeAdapter['closeField']=()=>false;
let richTextSyncField:RichTextRuntimeAdapter['syncField']=()=>false;
let richTextSyncAll:RichTextRuntimeAdapter['syncAll']=()=>false;
let richTextReconcileExternal:RichTextRuntimeAdapter['reconcileExternal']=()=>Object.freeze({status:'unmounted'});
let NotesRuntime:ReturnType<typeof NotesHostModule.createController>|null=null,LibraryNoteWorkflows:ReturnType<typeof NotesHostModule.createLibraryWorkflows>|null=null;
let executeIdleDisplayKey='';
let realTimeAwarenessRenderKey='';
let executePanelsRenderKey='';
let executeProgressPanelRenderKey='';
let scheduleEndPromptKey='';
/* APPLICATION ACTIVATION CONTRACT */
const AppActivation=StartupHostModule.createActivation(Object.freeze<Parameters<typeof StartupHostModule.createActivation>[0]>({
  capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level)
}));
const APP_ACTIVATION_KINDS=AppActivation.kinds;
let StartupLifecycle!:ReturnType<typeof StartupHostModule.createCoordinator>;
/* APPLICATION WRITE AUTHORITY · 4. CROSS-TAB OWNERSHIP */
const OWNERSHIP_HEARTBEAT_MS=4000;
const OWNERSHIP_STALE_MS=15000;
const OWNERSHIP_PROBE_MS=700;
const OWNERSHIP_WEB_LOCK_NAME=ProfileScope.scoped('study-director-app-owner-v1');
const OWNERSHIP_STATES=OwnershipModule.OWNERSHIP_STATES;

let AppMutationCoordinator:ReturnType<typeof MutationCoordinatorModule.createCoordinator>|null=null;
let mutationUiOperationActive=false;
type OwnershipControllerInput=Parameters<typeof StartupHostModule.createOwnershipController>[0];
const AppOwnership=StartupHostModule.createOwnershipController(Object.freeze<OwnershipControllerInput>({
  module:OwnershipModule,
  config:Object.freeze<OwnershipControllerInput['config']>({
    storageKey:STORAGE_KEYS.appOwner,sessionTabKey:SESSION_STORAGE_KEYS.appTab,
    channelName:ProfileScope.scoped('study-director-app-owner'),heartbeatMs:OWNERSHIP_HEARTBEAT_MS,
    staleMs:OWNERSHIP_STALE_MS,probeMs:OWNERSHIP_PROBE_MS,webLockName:OWNERSHIP_WEB_LOCK_NAME
  }),
  environment:Object.freeze<OwnershipControllerInput['environment']>({
    document,window,now:DecisionClock.nowMs,randomIdPart,
    setInterval:(fn,delay)=>setInterval(fn,delay),clearInterval:id=>clearInterval(id),
    setTimeout:(fn,delay)=>setTimeout(fn,delay),clearTimeout:id=>clearTimeout(id)
  }),
  local:Object.freeze<OwnershipControllerInput['local']>({
    getJson:(key,fallback)=>AppData.local.getJson(key,fallback),
    setJson:(key,value)=>AppData.local.setJson(key,value),
    remove:key=>AppData.local.remove(key),
    lastError:()=>AppData.lastStorageError
  }),
  diagnostics:Object.freeze<OwnershipControllerInput['diagnostics']>({
    capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level),
    guard:(scope,operation)=>AppDiagnostics.guard(scope,operation)
  }),
  activation:AppActivation,
  reloadHint:()=>performance.getEntriesByType('navigation').some(entry=>'type' in entry&&entry.type==='reload')||performance.navigation?.type===1,
  lifecycle:Object.freeze<OwnershipControllerInput['lifecycle']>({
    isReady:()=>StartupLifecycle.status().fullyInitialized,
    resumeStorageReset:()=>resumeUnresolvedStorageReset()
  }),
  hydration:Object.freeze<OwnershipControllerInput['hydration']>({
    hydratePlanData:()=>PlanData.hydrate(),
    hydratePlanRuntime:()=>PlanRuntime.hydrate(),
    renderSavedPlans:()=>PlanRuntime.savedPlans.render(),
    hydratePrimary:options=>hydratePrimaryStateFromStorage(options),
    censusUnsupported:()=>UnsupportedData.census(),
    hydrateSavedDrafts:options=>hydrateSavedDrafts(options)
  }),
  hooks:Object.freeze<OwnershipControllerInput['hooks']>({
    render:()=>renderOwnershipUi(),
    refreshStorage:()=>refreshStorageFallbackWarning(),
    stopExecution:()=>TimerEngine.stopExecution(),
    resume:()=>resumeTimerLoopAfterPrimaryRestore(),
    refreshCore:()=>refreshCoreUi(),
    scheduleMaintenance:()=>scheduleDataMaintenance(),
    practiceRender:()=>PracticePacer.render(),
    blocked:(status,reason)=>renderPrimaryTabBlock(status,reason),
    peerStorageReset:detectedAt=>handleBrowserStorageReset({detectedAt,peer:true}),
    invalidate:context=>SessionLifecycle.invalidate('primary-tab-loss',{...context,reconcile:false}),
    flush:()=>StartupLifecycle.flush(),
    settled:()=>settleCurrentProfileWriters()
  })
}));
const appCanMutate=()=>AppOwnership.canMutate()&&!(AppMutationCoordinator&&AppMutationCoordinator.writesBlocked());
const transitionAppOwnership=(next:typeof AppOwnership.state)=>next===OWNERSHIP_STATES.RELEASING
  ?AppOwnership.transitionReleasing():AppOwnership.state;
type MutationCoordinatorInput=Parameters<typeof MutationCoordinatorModule.createCoordinator>[0];
AppMutationCoordinator=MutationCoordinatorModule.createCoordinator(Object.freeze<MutationCoordinatorInput>({
  configuration:Object.freeze<MutationCoordinatorInput['configuration']>({lockName:ProfileScope.scoped('study-director-data-mutation-v1'),storageKey:STORAGE_KEYS.mutationLock,leaseMs:20000,heartbeatMs:5000}),
  environment:Object.freeze<MutationCoordinatorInput['environment']>({
    AbortController,locks:navigator.locks||null,now:DecisionClock.nowMs,randomIdPart,
    setInterval:(callback,delay)=>setInterval(callback,delay),clearInterval:id=>clearInterval(id),setTimeout:(callback,delay)=>setTimeout(callback,delay),
    addStorageListener:listener=>window.addEventListener('storage',listener)
  }),
  identity:Object.freeze<MutationCoordinatorInput['identity']>({status:()=>AppOwnership.status(),canMutate:()=>AppOwnership.canMutate()}),
  local:Object.freeze<MutationCoordinatorInput['local']>({getJson:(key,fallback)=>AppData.local.getJson(key,fallback),setJson:(key,value)=>AppData.local.setJson(key,value),remove:key=>AppData.local.remove(key)}),
  durable:Object.freeze<MutationCoordinatorInput['durable']>({
    acquire:async request=>{const result=await AppData.mutationLease.acquire(request);return result.acquired?Object.freeze({acquired:true}):Object.freeze({acquired:false,holder:Object.freeze({expiresAt:result.holder['expiresAt']})});},
    release:id=>AppData.mutationLease.release(id)
  }),
  hooks:Object.freeze<MutationCoordinatorInput['hooks']>({refreshUi:()=>{
    const active=!!AppMutationCoordinator?.status?.().active;
    try{OwnershipUiProjection.apply();}catch{}
    try{renderOwnershipBanner();}catch{}
    if(mutationUiOperationActive&&!active&&!requireMutationCoordinator().blocksUi())queueProtectedMutationUiReconcile();
    mutationUiOperationActive=active;
  },scheduleUpdate:delay=>schedulePwaUpdateEvaluation(delay),
  // Another tab's lease ran out without being released (it was closed in the
  // middle of a change): background work that waited for it goes now.
  foreignReleased:()=>wakeBackgroundOperations('mutation-lease-ended')})
}));
if(!Object.isFrozen(AppMutationCoordinator)||AppMutationCoordinator.format!=='study-director.mutation-coordinator'||AppMutationCoordinator.contractVersion!==1)throw new Error('Study Director mutation coordinator is unavailable or incompatible.');
// A pause, resume, finished or skipped block goes to the other devices// A pause, resume, finished or skipped block goes to the other devices
// within seconds (an urgent change), not at the next quiet-period upload:
// Continue Here elsewhere takes the timer from Drive's newest version, so a
// pause still waiting here would count the paused time there as study.
function sendSessionChangeSoon(...args:Parameters<typeof ExecutionViews.sendSessionChangeSoon>){return ExecutionViews.sendSessionChangeSoon(...args);}
function togglePause(...args:Parameters<typeof ExecutionViews.togglePause>){return ExecutionViews.togglePause(...args);}
// Every backup location that backs up on its own (the Device Folder, and
// Google Drive once this device has backed up to it) hears about each change.
// With no such location nothing happens.
const BackupProviderBackground=BackupMaintenanceHostModule.createProviderBackgroundBridge(Object.freeze<Parameters<typeof BackupMaintenanceHostModule.createProviderBackgroundBridge>[0]>({
  provider:()=>BackupProviderRuntime,capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level)
}));
function notifyBackupChange(change:Parameters<typeof BackupProviderBackground['noteChange']>[0]){return BackupProviderBackground.noteChange(change);}
function flushAutomaticBackups(reason:Parameters<typeof BackupProviderBackground['flush']>[0]){return BackupProviderBackground.flush(reason);}
function automaticBackupsWaiting(){return BackupProviderBackground.waiting();}
// Hidden: back up waiting changes. Visible again: redraw the locations, since a
// sign-in may have ended while timers were throttled.
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(appCanMutate())void flushAutomaticBackups('app-hidden');}else BackupProviderRuntime.refresh();});
// A plan applied by hand goes to Drive within seconds, like Suspend and
// Continue Here, so the other device sees today's session at its next check.
function uploadSoonAfterPlanApply(...args:Parameters<typeof SessionActions.uploadSoonAfterPlanApply>){return SessionActions.uploadSoonAfterPlanApply(...args);}
// During a live session, the checked P5.4C controller owns remote-claim
// observation, timer preemption, frozen evidence and retry cadence. The host
// keeps only scheduling and browser lifecycle adapters.
const SESSION_WATCH_MS=2*60*1000,SESSION_CLAIM_WATCH_MS=15*1000,SESSION_CLAIM_SYNC_RETRY_MS=30*1000;

async function checkSessionOwnershipClaim(){return SessionHandoffRuntime?SessionHandoffRuntime.checkClaim():false;}
function wakeSessionOwnershipClaim(slackMs=0){return SessionHandoffRuntime?SessionHandoffRuntime.wakeClaim(slackMs):false;}
function installSessionWatch(...args:Parameters<typeof ExecutionViews.installSessionWatch>){return ExecutionViews.installSessionWatch(...args);}
function notifyDeviceBackupIfStudyDayResolved(...args:Parameters<typeof ExecutionViews.notifyDeviceBackupIfStudyDayResolved>){return ExecutionViews.notifyDeviceBackupIfStudyDayResolved(...args);}
function markDone(...args:Parameters<typeof ExecutionViews.markDone>){return ExecutionViews.markDone(...args);}
function skipTask(...args:Parameters<typeof ExecutionViews.skipTask>){return ExecutionViews.skipTask(...args);}
function finishPracticePacer(...args:Parameters<typeof ExecutionViews.finishPracticePacer>){return ExecutionViews.finishPracticePacer(...args);}
function handlePracticeStartKey(...args:Parameters<typeof ExecutionViews.handlePracticeStartKey>){return ExecutionViews.handlePracticeStartKey(...args);}
/* STORAGE HEALTH AND SINGLE-TAB GUARD */

function requireStorageHealthController(){if(!StorageHealthController)throw new Error('Study Director storage-health controller is unavailable.');return StorageHealthController;}
function readStorageHealth(){return requireStorageHealthController().snapshot();}
function writeStorageHealth(patch:Parameters<NonNullable<typeof StorageHealthController>['updateHistory']>[0]){return requireStorageHealthController().updateHistory(patch);}
function renderStorageHealth(health=readStorageHealth()){return requireStorageHealthController().render(health);}
function markStorageHealthOk(source:Parameters<NonNullable<typeof StorageHealthController>['markOk']>[0],key:Parameters<NonNullable<typeof StorageHealthController>['markOk']>[1]=''){return requireStorageHealthController().markOk(source,key);}
function markStorageHealthTimestamp(key:Parameters<NonNullable<typeof StorageHealthController>['markTimestamp']>[0]){return requireStorageHealthController().markTimestamp(key);}
function markStorageHealthError(source:Parameters<NonNullable<typeof StorageHealthController>['markError']>[0],reason:Parameters<NonNullable<typeof StorageHealthController>['markError']>[1],options:Parameters<NonNullable<typeof StorageHealthController>['markError']>[2]={}){return requireStorageHealthController().markError(source,reason,options);}
function storageSizeLabel(bytes:unknown){
  const value=Math.max(0,Number(bytes)||0);
  if(value<1024*1024)return `${Math.round(value/1024)} KB`;
  if(value<1024**3)return `${Math.round(value/(1024*1024)*10)/10} MB`;
  return `${Math.round(value/1024**3*10)/10} GB`;
}
// The browser's storage estimate is measured at launch, and again when the app
// is returned to at most once an hour, so a tab left open for days still warns
// before storage fills. It is kept in memory for diagnostics.
const STORAGE_ESTIMATE_REFRESH_MS=60*60*1000;
type CapabilityStorageInput=Parameters<typeof CapabilitiesHostModule.createStorage>[0];
const CapabilityStorage=CapabilitiesHostModule.createStorage(Object.freeze<CapabilityStorageInput>({
  document,navigator,
  limits:Object.freeze<CapabilityStorageInput['limits']>({storageCriticalRatio:APP_LIMITS.storageCriticalRatio,storageWarningRatio:APP_LIMITS.storageWarningRatio}),
  controller:()=>NativeCapabilities,
  storageSizeLabel,markStorageHealthError,markStorageHealthOk,renderStorageHealth
}));
const inspectStorageCapability=CapabilityStorage.inspectStorageCapability;
const protectLocalData=CapabilityStorage.protectLocalData;
const CapabilityInstallation=CapabilitiesHostModule.createInstallation(Object.freeze<Parameters<typeof CapabilitiesHostModule.createInstallation>[0]>({
  document,window,controller:()=>NativeCapabilities,
  goTab:(name,options)=>goTab(name,options),
  preferredScrollBehavior:()=>preferredScrollBehavior()
}));
const runInstallationAction=CapabilityInstallation.runInstallationAction;
function showLiveDraftSaveWarning(reason:unknown){
  const message=`Live draft could not be saved${reason?`: ${reason}`:''}. Save today in Review or export a backup before closing this tab.`;
  markStorageHealthError('activeSession',message);
  setPlanStatus('CRITICAL: Local storage is full or unavailable. Live draft is not saving.',false);
}
function refreshStorageFallbackWarning(){
  const safetyMessage=String(sessionSafetyMessage||'').trim();
  const issues=requireStorageHealthController().snapshot().issues,localFailures=issues.filter(issue=>issue.level==='error'&&['indexedDB','localStorage.write','planDraft.write','activeSession','notes','dailyRecords','deletionRecovery'].includes(issue.source));
  const failedSources=new Set(localFailures.map(issue=>issue.source));
  for(const event of NoticeCoordinator.eventStatus().events)if(event.source==='local-saving'&&!failedSources.has(event.id))NoticeCoordinator.resolveEvent(event.source,event.id);
  for(const issue of localFailures)NoticeCoordinator.emit({source:'local-saving',id:issue.source,severity:'error',lifecycle:'failed',foreground:false,surface:'quiet',title:'Local saving failed',message:issue.message});
  const criticalMessage=localFailures.length?localFailures.map(issue=>issue.message).join('\n')+'\nKeep this tab open. Save in Review or export a backup before closing; retry after browser storage recovers.':'';
  NoticeCoordinator.publish('local-saving',{visible:!!criticalMessage,kind:'critical',title:'Local saving failed',message:criticalMessage||'Resolved.',compact:false});
  const storageMessages=[BackupNudge?.message()||'',...issues.filter(issue=>!failedSources.has(issue.source)).map(issue=>issue.message)].map(value=>String(value||'').trim()).filter(Boolean);
  const storageMessage=storageMessages.join('\n');
  NoticeCoordinator.publish('safety',{visible:!!safetyMessage,kind:'safety',title:'Unsaved work needs attention',message:safetyMessage||'Resolved.',compact:noticeCanCompact(safetyMessage)});
  NoticeCoordinator.publish('storage',{visible:!!storageMessage,kind:'storage',title:'Storage or recovery notice',message:storageMessage||'Resolved.',compact:noticeCanCompact(storageMessage)});
  renderStorageHealth();
}
function dismissStorageWarning(){
  const active=NoticeCoordinator.status().active;
  if(active&&['critical','safety','storage'].includes(active.kind)){
    NoticeCoordinator.acknowledge(active.id);
  }
}
function resumeTimerLoopAfterPrimaryRestore(...args:Parameters<typeof SessionActions.resumeTimerLoopAfterPrimaryRestore>){return SessionActions.resumeTimerLoopAfterPrimaryRestore(...args);}
const StartupOwnershipViews=StartupHostModule.createOwnershipViews({document,OWNERSHIP_STATES,AppOwnership,NoticeCoordinator,appCanMutate,
 claimAppControl:(...args)=>claimAppControl(...args),setPlanStatus:(...args)=>setPlanStatus(...args),mutationStatus:()=>AppMutationCoordinator?.status()||null,ready:()=>StartupLifecycle.status().fullyInitialized,
 syncPlanAccess:()=>PlanRuntime.savedPlans.syncAccess(),projectOwnership:()=>OwnershipUiProjection.apply(),wakeBackground:wakeBackgroundOperations,syncWake:()=>NativeCapabilities?.syncWake()});
function renderOwnershipBanner(...args:Parameters<typeof StartupOwnershipViews.renderOwnershipBanner>){return StartupOwnershipViews.renderOwnershipBanner(...args);}
function renderOwnershipUi(...args:Parameters<typeof StartupOwnershipViews.renderOwnershipUi>){return StartupOwnershipViews.renderOwnershipUi(...args);}
function loadActiveSessionForRestore(...args:Parameters<typeof SessionActions.loadActiveSessionForRestore>){return SessionActions.loadActiveSessionForRestore(...args);}
function activeSessionScheduleFingerprint(...args:Parameters<typeof SessionActions.activeSessionScheduleFingerprint>){return SessionActions.activeSessionScheduleFingerprint(...args);}
function applyStoredSessionSnapshot(...args:Parameters<typeof SessionActions.applyStoredSessionSnapshot>){return SessionActions.applyStoredSessionSnapshot(...args);}
function hydratePrimaryStateFromStorage(...args:Parameters<typeof SessionActions.hydratePrimaryStateFromStorage>){return SessionActions.hydratePrimaryStateFromStorage(...args);}
const {
  writeLease:writeAppOwner, release:releaseAppOwner, evaluate:evaluateAppOwnership,
  setPrimary:setPrimaryTabState, takeOwnership:claimAppControl, install:installAppOwnership
}=AppOwnership;
function flushAndReleaseAppOwner(requestId:Parameters<typeof AppOwnership['flushAndRelease']>[0]=''){return AppOwnership.flushAndRelease(requestId);}
function requirePrimaryTab(...args:Parameters<typeof StartupOwnershipViews.requirePrimaryTab>){return StartupOwnershipViews.requirePrimaryTab(...args);}
function renderPrimaryTabBlock(...args:Parameters<typeof StartupOwnershipViews.renderPrimaryTabBlock>){return StartupOwnershipViews.renderPrimaryTabBlock(...args);}
/* DAILY RECORD COMPACTION AND SANITIZERS · IMPORTED */
type DailyRecordCodecInput=Parameters<typeof RecordCodecsModule.createDailyRecordCodec>[0];
const DailyRecordCodec=RecordCodecsModule.createDailyRecordCodec(Object.freeze<DailyRecordCodecInput>({
  limits:APP_LIMITS,
  dataContract:DATA_CONTRACT,
  domain:DomainModule,
  keyedRecord:KeyedRecord,
  helpers:Object.freeze<DailyRecordCodecInput['helpers']>({
    boundedInt,boundedNumber,clampText,clampEditorContent,editorContentWithinLimits,optionalBoundedNumber,optionalText,safeBoolean,
    sameDataValue,normalizeStudyQuality,todayISO,dateInsightsMeta,sanitizePracticeRun
  }),
  timestamps:Object.freeze<DailyRecordCodecInput['timestamps']>({normalizeTimestamp,normalizeImportedTimestamp,normalizeImportedEpochMillis}),
  timer:Object.freeze<DailyRecordCodecInput['timer']>({
    modes:Object.freeze({PAUSED:TIMER_MODES.PAUSED,RUNNING:TIMER_MODES.RUNNING}),
    defaultBreakSeconds:()=>Pomodoro.configuration.breakSeconds()
  })
}));
const PersonalDataCodec=RecordCodecsModule.createPersonalDataCodec(APP_LIMITS);
/* ACTIVE SESSION CODEC */
/* ACTIVE SESSION CODEC · IMPORTED */
type ActiveSessionCodecInput=Parameters<typeof RecordCodecsModule.createActiveSessionCodec>[0];
const ActiveSessionCodec=RecordCodecsModule.createActiveSessionCodec(Object.freeze<ActiveSessionCodecInput>({
  limits:APP_LIMITS,
  dataContract:DATA_CONTRACT,
  activeSessionId:ACTIVE_SESSION_ID,
  domain:DomainModule,
  keyedRecord:KeyedRecord,
  helpers:Object.freeze<ActiveSessionCodecInput['helpers']>({
    boundedInt,boundedNumber,clampText,clampEditorContent,editorContentWithinLimits,cleanDayRevision,sameDataValue,
    activeSessionScheduleFingerprint,isCanonicalScheduleText,isValidIsoDate,normalizeStudyQuality,
    parseProgressNumber,sanitizePracticeState
  }),
  timestamps:Object.freeze({normalizeTimestamp,normalizeImportedTimestamp,normalizeImportedEpochMillis}),
  dailyRecordCodec:DailyRecordCodec
}));
type PendingReviewCodecInput=Parameters<typeof RecordCodecsModule.createPendingReviewCodec>[0];
const PendingReviewCodec=RecordCodecsModule.createPendingReviewCodec(Object.freeze<PendingReviewCodecInput>({
  dataContract:DATA_CONTRACT,dailyRecordCodec:DailyRecordCodec,activeSessionCodec:ActiveSessionCodec,personalDataCodec:PersonalDataCodec,
  helpers:Object.freeze<PendingReviewCodecInput['helpers']>({sameDataValue,randomBytes:count=>crypto.getRandomValues(new Uint8Array(count))})
}));
const {
  buildDailyRecordSummary, compactPauseEvents, compactRealTimeSnapshot, compactAdjustedSchedule,
  normalizeDailyResultEntry, dailyRecordMetricsFromEvidence, sanitizeCurrentDailyRecord, createDiaryRecord, isSupportedSavedDate,
  materializeDailyRecordView, sanitizeDailyRecordSummary, materializeDailyRecordSummary
}=DailyRecordCodec;


function timerRuntimePayload(){return TimerRestoration.timerRuntimePayload();}

/* DATE AND REVIEW-DAY HELPERS */
function todayISO(now=new Date()){
  const d=new Date(now);
  if(d.getHours()<STUDY_DAY_ROLLOVER_HOUR)d.setDate(d.getDate()-1);
  return localISODate(d);
}
function prettyDate(iso:string){
  const d=new Date(iso+'T00:00:00');
  return d.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
}
function dateInsightsMeta(iso:string){
  const d=new Date(iso+'T00:00:00');
  const dayOfWeek=d.getDay();
  return {dayOfWeek,dayName:FULL_WEEKDAY_NAMES[dayOfWeek]||'Invalid Date'};
}
function hoursLabel(min:unknown){
  const n=Math.round((Number(min)||0)*10)/10;
  if(n<60)return Math.round(n)+'m';
  const h=n/60;
  return (Math.round(h*10)/10)+'h';
}
function optionalHoursLabel(value:unknown){
  return value===null||value===undefined||!Number.isFinite(Number(value))?'—':hoursLabel(Number(value));
}
const ScheduleDerivedState={fingerprint:'',adjustmentsRevision:0,adjustmentsCache:{revision:-1,value:Object.freeze({})},renderDirty:true};
let taskNoteScheduleRevision=0;
function advanceTaskNoteScheduleRevision(){taskNoteScheduleRevision+=1;return taskNoteScheduleRevision;}
function invalidateScheduleDerived({identity=false,adjustments=false,render=false}={}){
  if(identity)ScheduleDerivedState.fingerprint='';
  if(adjustments)ScheduleDerivedState.adjustmentsRevision++;
  if(render)ScheduleDerivedState.renderDirty=true;
}
function scheduleFingerprint(){
  return ScheduleDerivedState.fingerprint||(ScheduleDerivedState.fingerprint=scheduleFingerprintForRows(TASKS));
}
const PlanScheduleGateway=ExecutionHostModule.createScheduleGateway(Object.freeze<Parameters<typeof ExecutionHostModule.createScheduleGateway>[0]>({
  runtime:ExecutionRuntime,completionSources:COMPLETION_SOURCES,document,ScheduleDerivedState,APP_LIMITS,
  getCarryForward:()=>latestCarryForward,setCarryForward:value=>{latestCarryForward=value;},
  taskAreaKey,taskMeasureValue,taskTargetValue,isTrackableBlock,clampText,normalizeCompletionSource,makeTaskId,
  isLiveTrackableTimer,saveNote,captureReviewInputs:(...args)=>captureReviewInputs(...args),syncUnfinishedNoteDraft,getReviewDate,
  showEmpty,refreshCoreUi,showDone,isValidIsoDate,todayISO,buildTasks,isValidHHMM,clockMinuteToStudyMinute,t2m,
  invalidateScheduleDerived,applySessionSnapshot,restoreLiveDraftIfAny,restoreTimerRuntimeIfAny,
  clearFutureUntouchedProgress:(...args)=>clearFutureUntouchedProgress(...args),
  flushLiveDraft,scheduleFingerprint,writeLiveDraftNow,advanceTaskNoteScheduleRevision,markDayContentChanged,clearSessionSafetyMessage,
  SessionLifecycle:{run:(...args)=>SessionLifecycle.run(...args),reconcile:(...args)=>SessionLifecycle.reconcile(...args)}
}));
function maybePromptBackupNudge(force=false){return BackupNudge?BackupNudge.run(force):Promise.resolve(false);}
/* LIVE DRAFT AND ACTIVE SESSION STORE */
function captureSessionSnapshot(evidence=null){return ActiveSessionRuntime?.captureSnapshot(evidence)||null;}
// Keep elapsed time and practice progress at the ownership boundary while
// retaining any later text, completion or reflection edits for reconciliation.
function snapshotWhileSessionClaimFrozen(){return SessionHandoffRuntime?.snapshotForWrite()||captureSessionSnapshot();}
function nextSessionRevision(seed:Parameters<typeof AppData['activeSession']['nextRevision']>[0]=0){return AppData.activeSession.nextRevision(seed);}
async function activeSessionContentFingerprint(session:ActiveSession|null){
  const content=ActiveSessionCodec.contentValue(session);
  if(!content)throw new Error('Active Session content is invalid.');
  const fingerprint=String(await Exports.run('checksum',{value:CanonicalModule.signature(content),algorithm:'sha256'}));
  if(!/^[a-f0-9]{64}$/u.test(fingerprint))throw new Error('Active Session content fingerprint could not be derived safely.');
  return fingerprint;
}
function activeSessionPayload(snapshot=null,options={}){return ActiveSessionRuntime?.payload(snapshot,options)||null;}
function readLocalRecoverySession(){return ActiveSessionRuntime?.readLocal()||null;}
function handleActiveSessionRepositoryResult(...args:Parameters<typeof SessionActions.handleActiveSessionRepositoryResult>){return SessionActions.handleActiveSessionRepositoryResult(...args);}
function requireCanonicalSessionWrite(saved:Parameters<NonNullable<typeof ActiveSessionRuntime>['requireCanonicalWrite']>[0],expected:Parameters<NonNullable<typeof ActiveSessionRuntime>['requireCanonicalWrite']>[1],operation:Parameters<NonNullable<typeof ActiveSessionRuntime>['requireCanonicalWrite']>[2]='active-session transition'){return requireActiveSessionRuntime().requireCanonicalWrite(saved,expected,operation);}
function writeActiveSessionNow(snapshot:Parameters<NonNullable<typeof ActiveSessionRuntime>['writeSnapshot']>[0],options:Parameters<NonNullable<typeof ActiveSessionRuntime>['writeSnapshot']>[1]={}){return requireActiveSessionRuntime().writeSnapshot(snapshot,options);}
function writeLiveDraftNow(options:Parameters<NonNullable<typeof ActiveSessionRuntime>['writeNow']>[0]={}){return requireActiveSessionRuntime().writeNow(options);}
function saveLiveDraft(options:Parameters<NonNullable<typeof ActiveSessionRuntime>['saveLiveDraft']>[0]={}){return requireActiveSessionRuntime().saveLiveDraft(options);}
function cancelPendingLiveDraftSave(){return ActiveSessionRuntime?.cancelPendingLiveDraftSave()||false;}
function flushLiveDraft(options={}){return ActiveSessionRuntime?.flushLiveDraft(options)||null;}
function maybeSnapshotRunningTimer(){return ActiveSessionRuntime?.maybeSnapshotRunningTimer()||false;}
function applySessionSnapshot(snapshot:Parameters<NonNullable<typeof ActiveSessionRuntime>['applySnapshot']>[0]){return ActiveSessionRuntime?.applySnapshot(snapshot)||false;}
function restoreLiveDraftIfAny(...args:Parameters<typeof SessionActions.restoreLiveDraftIfAny>){return SessionActions.restoreLiveDraftIfAny(...args);}
function activeSessionSnapshot(...args:Parameters<typeof SessionActions.activeSessionSnapshot>){return SessionActions.activeSessionSnapshot(...args);}

// A session another device runs: this device shows it and never runs its timer.
function sessionRunsElsewhere(...args:Parameters<typeof SessionActions.sessionRunsElsewhere>){return SessionActions.sessionRunsElsewhere(...args);}
function sessionFromElsewhere(...args:Parameters<typeof SessionActions.sessionFromElsewhere>){return SessionActions.sessionFromElsewhere(...args);}
function isRestorableActiveSession(...args:Parameters<typeof SessionActions.isRestorableActiveSession>){return SessionActions.isRestorableActiveSession(...args);}
function isSuspendedActiveSession(...args:Parameters<typeof SessionActions.isSuspendedActiveSession>){return SessionActions.isSuspendedActiveSession(...args);}
function isPreviousActiveSessionRecord(...args:Parameters<typeof SessionActions.isPreviousActiveSessionRecord>){return SessionActions.isPreviousActiveSessionRecord(...args);}
// Verify the actual canonical Saved Day, not just a date match or two
// unrelated devices' numeric revision counters. The session must first carry
// its own durable save acknowledgement; its study evidence must still be
// represented by the Day presently in Library.
function savedDayCoversActiveSession(...args:Parameters<typeof SessionActions.savedDayCoversActiveSession>){return SessionActions.savedDayCoversActiveSession(...args);}
function retireCoveredPreviousActiveSession(...args:Parameters<typeof SessionActions.retireCoveredPreviousActiveSession>){return SessionActions.retireCoveredPreviousActiveSession(...args);}
function setSessionPanelMode(...args:Parameters<typeof SessionActions.setSessionPanelMode>){return SessionActions.setSessionPanelMode(...args);}
function recoverPreviousSessionForReview(...args:Parameters<typeof SessionActions.recoverPreviousSessionForReview>){return SessionActions.recoverPreviousSessionForReview(...args);}
function handlePreviousActiveSession(...args:Parameters<typeof SessionActions.handlePreviousActiveSession>){return SessionActions.handlePreviousActiveSession(...args);}
function revisitPreviousStoredSession(...args:Parameters<typeof SessionActions.revisitPreviousStoredSession>){return SessionActions.revisitPreviousStoredSession(...args);}
function attemptAutoRestoreActiveSession(...args:Parameters<typeof SessionActions.attemptAutoRestoreActiveSession>){return SessionActions.attemptAutoRestoreActiveSession(...args);}
/* INDEXEDDB STORE ADAPTERS · IMPORTED */
type IndexedDbHostInput=Parameters<typeof DataBootstrapHostModule.createIndexedDb>[0];
const IndexedDb=DataBootstrapHostModule.createIndexedDb(Object.freeze<IndexedDbHostInput>({
  module:PersistenceModule,
  config:Object.freeze<IndexedDbHostInput['config']>({
    dbName:DB_NAME,
    dbVersion:DB_VER,
    stores:Object.freeze<IndexedDbHostInput['config']['stores']>({
      dailyRecords:DB_DAILY_RECORD_STORE,
      dailySummaries:DB_DAILY_SUMMARY_STORE,
      notes:DB_NOTES_STORE,
      activeSessions:DB_ACTIVE_SESSION_STORE,
      appMeta:DB_APP_META_STORE,
      assets:DB_ASSET_STORE
    }),
  }),
  hooks:Object.freeze<IndexedDbHostInput['hooks']>({
    onError:message=>{markStorageHealthError('indexedDB',`Browser database is unavailable: ${message}`);},
    onOk:()=>{markStorageHealthOk('indexedDB');},
    capture:(scope,error,level)=>{AppDiagnostics.capture(scope,error,level);},
    onReset:event=>{void handleBrowserStorageReset(event).catch(error=>AppDiagnostics.capture('storage-reset.handle',error,'error'));}
  })

}));
const ReconciliationBaselineCodec=ReconciliationBaselineModule.createCodec(Object.freeze<Parameters<typeof ReconciliationBaselineModule.createCodec>[0]>({limits:APP_LIMITS,isNoteKey:DailyRecordCodec.noteKeys.isKey}));
const AppMetaGateway=DataBootstrapHostModule.createAppMetaGateway(Object.freeze<Parameters<typeof DataBootstrapHostModule.createAppMetaGateway>[0]>({
  module:AppMetaModule,indexedDb:IndexedDb,store:DB_APP_META_STORE,registry:APP_META_REGISTRY
}));
// Data this build cannot read stays exactly as it is. Every start, before
// anything reads stored data, the census finds it: a record whose version is
// above this build's, an appMeta row of a family this build does not know or
// in an unsupported shape. The storage layer then keeps it out of every
// read and refuses every change to it, and the app works with everything else
// (local clean-up and Drive uploads wait while any of it is here, since both
// would read its absence as a deletion). Bookkeeping the data contract lets
// any build replace (leases, maintenance progress, caches) is replaced as
// usual. A database a newer build changed so much that a store this build
// needs is gone, or keyed differently, is not opened: the profile waits for
// an update and the person can use another profile meanwhile.
const UnsupportedData=DataBootstrapHostModule.createUnsupportedData(Object.freeze<Parameters<typeof DataBootstrapHostModule.createUnsupportedData>[0]>({
  dataContract:DATA_CONTRACT,stores:DB_STORES,indexedDb:IndexedDb,appMeta:AppMetaGateway,profiles:Profiles,profileScope:ProfileScope,notices:NoticeCoordinator,
  checkUnsupportedUpdate:()=>checkUnsupportedUpdate(),
  checkForUpdate:()=>PwaLifecycle.checkForUpdate(),
  capture:(scope,error)=>AppDiagnostics.capture(scope,error,'warn')
}));
type MetadataOwnersInput=Parameters<typeof DataBootstrapHostModule.createMetadataOwners>[0];
const {RepositoryAppMeta,JournalAppMeta,HostAppMeta,ExportsAppMeta,DeviceFolderAppMeta,BackupAppMeta}=DataBootstrapHostModule.createMetadataOwners(Object.freeze<MetadataOwnersInput>({
  gateway:AppMetaGateway,
  repositoriesModule:RepositoryModule,
  repositoryValidatorInput:Object.freeze<MetadataOwnersInput['repositoryValidatorInput']>({
    limits:APP_LIMITS,
    dataContract:DATA_CONTRACT,
    personalDataCodec:PersonalDataCodec,
    pendingReviewCodec:PendingReviewCodec,
    helpers:Object.freeze<MetadataOwnersInput['repositoryValidatorInput']['helpers']>({isValidIsoDate,isNoteId:DailyRecordCodec.noteKeys.isId,isNoteKey:DailyRecordCodec.noteKeys.isKey,normalizeTimestamp,sameDataValue})
  }),
  journalsModule:RepositoryJournalModule,
  journalLimits:APP_LIMITS,
  hostMetadataModule:HostMetadataModule,
  hostValidatorInput:Object.freeze<MetadataOwnersInput['hostValidatorInput']>({
    keys:Object.freeze<MetadataOwnersInput['hostValidatorInput']['keys']>({
      verifiedRecoveryBackups:APP_META_KEYS.verifiedRecoveryBackups,backupProtection:APP_META_KEYS.backupProtection,
      attachmentIntegrityAudit:APP_META_KEYS.attachmentIntegrityAudit,deviceFolder:APP_META_KEYS.deviceFolder,
      repositoryIntegrityScrub:APP_META_KEYS.repositoryIntegrityScrub,managedProviderBackupPending:APP_META_KEYS.managedProviderBackupPending,repositoryMaintenancePending:APP_META_KEYS.repositoryMaintenancePending,
      reconciliationBase:APP_META_KEYS.reconciliationBase,reconciliationBaseNotePrefix:APP_META_KEYS.reconciliationBaseNotePrefix,reconciliationBaseDayPrefix:APP_META_KEYS.reconciliationBaseDayPrefix
    }),
    same:sameDataValue,
    normalizers:Object.freeze<MetadataOwnersInput['hostValidatorInput']['normalizers']>({
      verifiedRecovery:value=>BackupReadinessHostModule.normalizeVerifiedRecoveryState(value),attachmentIntegrity:normalizeAttachmentIntegrityState,
      repositoryIntegrity:normalizeRepositoryIntegrityState,
      reconciliationBase:ReconciliationBaselineCodec.normalizeHeader,reconciliationBaseNote:ReconciliationBaselineCodec.normalizeNote,reconciliationBaseDays:ReconciliationBaselineCodec.normalizeDays
    })
  })
}));
const ReconciliationBaselineStore=ReconciliationBaselineModule.createStore(Object.freeze<Parameters<typeof ReconciliationBaselineModule.createStore>[0]>({
  codec:ReconciliationBaselineCodec,meta:HostAppMeta,
  families:Object.freeze({header:'reconciliationBase',notes:'reconciliationBaseNotePrefix',days:'reconciliationBaseDayPrefix'})
}));
let richAssetReferenceRevision=0,captureMutationGeneration=0;
let imagePreparationCount=0,pwaWorkRevision=0;
document.addEventListener('input',()=>{pwaWorkRevision++;},true);
document.addEventListener('change',()=>{pwaWorkRevision++;},true);
let invalidateAttachmentLibrary=()=>false;
let scheduleRichTextAssetMaintenance:(delay?:number)=>boolean=()=>false;
let notifyRichTextAssetLeaseReleased:()=>boolean=()=>false;
const CanonicalCommitHost=BackupReadinessHostModule.createCanonicalCommit(Object.freeze<Parameters<typeof BackupReadinessHostModule.createCanonicalCommit>[0]>({
  storage:requireStorageHealthController(),scanAttachmentReferences:value=>RichTextApi.scanAttachmentReferences(value),incrementReferenceRevision:()=>{richAssetReferenceRevision++;},
  syncCapability:event=>CapabilityBadge?.syncFromCanonicalCommit(event),notifyBackupChange:change=>notifyBackupChange(change),scheduleAssetMaintenance:()=>scheduleRichTextAssetMaintenance(),invalidateAttachmentLibrary:()=>invalidateAttachmentLibrary(),
  fullyInitialized:()=>StartupLifecycle.status().fullyInitialized,refreshKeptVersions:()=>KeptVersions?.refresh()||false,reminderDate:()=>ReviewDayState.reminder.date,revalidateSaveReminder:()=>revalidateSaveReminderAfterCanonicalConvergence(),nowIso:()=>new Date().toISOString()
}));
const RecoveryAssetMaintenancePause=BackupRecoveryHostModule.createMaintenancePause(Object.freeze<Parameters<typeof BackupRecoveryHostModule.createMaintenancePause>[0]>({maintenance:()=>RichTextAssetMaintenance}));
if(!Object.isFrozen(RecoveryAssetMaintenancePause)||RecoveryAssetMaintenancePause.format!=='study-director.backup-maintenance-pause'||RecoveryAssetMaintenancePause.contractVersion!==1){
  throw new Error('Study Director recovery attachment-maintenance pause is unavailable or incompatible.');
}
let BackupIntegrity:ReturnType<typeof BackupIntegrityHostModule.createController>|null=null,AttachmentIntegrityJob:ReturnType<typeof BackupIntegrityHostModule.createController>['attachmentJob']|null=null;
const RichTextAssetWriteLease=AssetStorageModule.createLease();
function richAssetId(value:unknown){const id=String(value||'');if(!RichTextApi.isAssetId(id))throw new TypeError('Rich-text asset identity is invalid.');return id;}
type AttachmentIngestInput=Parameters<typeof AttachmentIngestModule.create>[0];
const AttachmentIngest=AttachmentIngestModule.create(Object.freeze<AttachmentIngestInput>({
  createWorker:()=>new Worker(trustedAssetURL('@@SD_ATTACHMENT_WORKER_FILENAME@@'),{name:'study-director-attachment-ingest'}),storage:navigator.storage,directory:ProfileScope.scoped('@@SD_ATTACHMENT_OPFS_DIRECTORY@@'),onAbandoned:()=>{scheduleRichTextAssetMaintenance(5000);}
}));
window.addEventListener('pagehide',()=>AttachmentIngest.destroy());
type AttachmentStorageInput=Parameters<typeof AssetStorageModule.create>[0];
const AttachmentStorage=AssetStorageModule.create(Object.freeze<AttachmentStorageInput>({
  name:DB_NAME,directory:ProfileScope.scoped('@@SD_ATTACHMENT_OPFS_DIRECTORY@@'),maxBytes:APP_LIMITS.richAssetMaxBytes,validId:AttachmentsModule.validId,validType:AttachmentsModule.validType,limitForType:AttachmentsModule.limitForType,
  storage:navigator.storage,locks:navigator.locks,protocol:location.protocol,ingest:AttachmentIngest,onReleased:()=>notifyRichTextAssetLeaseReleased(),
  canMutate:()=>appCanMutate(),issueToken:()=>AppOwnership.issueWriteToken('write attachment'),assertToken:token=>AppOwnership.assertWriteToken(token,'write attachment'),
  read:id=>IndexedDb.get(DB_ASSET_STORE,id,'attachment metadata read aborted'),
  entries:()=>IndexedDb.storeTransaction<readonly (readonly [string,unknown])[]>(DB_ASSET_STORE,'readonly',(store,tx,finish)=>{const keys=store.getAllKeys(),values=store.getAll();tx.oncomplete=()=>finish(true,keys.result.map((id,i)=>[String(id),values.result[i]] as const));},'attachment catalogue read aborted'),
  keys:()=>IndexedDb.storeTransaction<string[]>(DB_ASSET_STORE,'readonly',(store,tx,finish)=>{const request=store.getAllKeys();request.onsuccess=()=>finish(true,(request.result||[]).map(String));request.onerror=()=>finish(false,request.error);},'attachment keys read aborted'),
  commit:(rows,remove,token,guard=()=>true,deletionState=null)=>IndexedDb.strictTransaction([DB_ASSET_STORE,DB_APP_META_STORE],'readwrite',(tx,finish)=>{
    const store=tx.objectStore(DB_ASSET_STORE);AppOwnership.assertWriteToken(token,'commit attachment metadata');if(!guard())throw new Error('Attachment references changed during cleanup.');
    if(rows.length||remove.length){
      const units=[...new Set([...rows.map(([id])=>`attachmentAsset:${String(id)}`),...remove.map(id=>`attachmentAsset:${String(id)}`)])];
      AppData.mutationEpoch.stage(tx,units);
    }
    if(deletionState)AppData.deletionRecovery.stageAttachments(tx,deletionState);
    for(const [id,row] of rows)store.put(row,id);for(const id of remove)store.delete(id);tx.oncomplete=()=>finish(true,undefined);
  },'attachment metadata commit aborted').then(result=>{writeStorageHealth({lastLocalSaveAt:AppData.mutationEpoch.nextChangeAt()});notifyBackupChange({reason:'attachment-metadata'});if(BackupIntegrity?.attachmentState()?.issues.length)scheduleAttachmentIntegrityAudit(5000);return result;})
}));
type RichTextAssetStore=AssetStore&Readonly<{retain():Promise<()=>void>;keys():Promise<string[]>;removeMany(assetIds:readonly string[]):Promise<number>}>;
const RichTextAssets:RichTextAssetStore=Object.freeze({
  retain:()=>AttachmentStorage.retain(),
  get:(assetId:string)=>AttachmentStorage.get(richAssetId(assetId)),
  async put(assetId:string,blob:Blob){const id=richAssetId(assetId),notice=NoticeCoordinator.presentation('attachments').begin({id:'image-'+id,title:'Attach image',message:'Saving image…',announce:false});try{await AttachmentStorage.during(async()=>{await AttachmentStorage.put(id,blob);RichTextAssetWriteLease.protect(id);});invalidateAttachmentLibrary();notice.finish('succeeded','Image attached.',{announce:false,surface:'quiet'});}catch(error){notice.finish('failed','Image could not be attached. Keep this tab open and retry after storage recovers. '+(error instanceof Error?error.message:String(error)));throw error;}},
  // An abandoned insertion releases its lease; only a verified reference sweep deletes it.
  async remove(assetId:string){RichTextAssetWriteLease.release(richAssetId(assetId));scheduleRichTextAssetMaintenance();},
  keys:()=>AttachmentStorage.keys(),
  async removeMany(_assetIds:readonly string[]){scheduleRichTextAssetMaintenance();return 0;}
});
type RichTextAssetMaintenancePorts=Parameters<typeof AssetMaintenanceModule.create>[0];
const RichTextAssetMaintenance=AssetMaintenanceModule.create(Object.freeze<RichTextAssetMaintenancePorts>({
  isAvailable:()=>upkeepBlocker()||(AttachmentStorage.supported()?true:'storage-unavailable'),
  canMutate:()=>appCanMutate(),
  mutationActive:()=>RecoveryAssetMaintenancePause.active()||backgroundMaintenanceForegroundBusy()||storageResetUnresolved(),
  collect:(operation,options)=>AttachmentStorage.collect(operation,options),
  readRestoreJournal:async()=>{const value=await AppData.restoreJournal.read();return value&&typeof value==='object'&&'state' in value?value as {state:unknown}:null;},
  readLibraryClearJournal:async()=>{const value=await AppData.libraryClearJournal.read();return value&&typeof value==='object'&&'state' in value?value as {state:unknown}:null;},
  liveFields:()=>[...document.querySelectorAll<HTMLTextAreaElement>('textarea.task-note-field,textarea.library-diary-textarea,#daily-reflection')],
  getReferenceRevision:()=>richAssetReferenceRevision,
  getDatasetRevision:async()=>{const daily=await AppData.dailyRecords.datasetRevision(),epoch=await AppData.mutationEpoch.read();return daily===null||!epoch?.token?null:daily+'|'+epoch.token;},
  scanReferences:value=>RichTextApi.scanAttachmentReferences(String(value??'')),
  readNotes:()=>AppData.notes.readFreshPayload(),
  loadActiveSession:async()=>{const loaded=await AppData.activeSession.load(0,{strict:true});const row=loaded&&typeof loaded==='object'?loaded as {ok?:unknown;error?:unknown;value?:unknown}:null;const value=ActiveSessionCodec.sanitizeCurrent(row?.value);return {ok:row?.ok===true,error:row?.error,value};},
  listDailyRecords:()=>AppData.dailyRecords.list({strict:true}),
  readPendingReviewTexts:async()=>(await AppData.pendingReviews.list()).flatMap(review=>PendingReviewCodec.richTexts(review)).filter((value):value is string=>typeof value==='string'),
  budget:()=>BackgroundTasks.budget(),yieldTask:options=>BackgroundTasks.yieldTask(options),
  invalidate:()=>invalidateAttachmentLibrary(),
  captureError:error=>AppDiagnostics.capture('rich-text.assets.maintenance',error,'warn'),
  diagnostics:Object.freeze<NonNullable<RichTextAssetMaintenancePorts['diagnostics']>>({start:(kind,source,details)=>BackupOperationDiagnostics.start(kind,source,details),mark:(name,details,id)=>BackupOperationDiagnostics.mark(name,details,id),finish:(details,id)=>BackupOperationDiagnostics.finish(details,id),fail:(error,details,id)=>BackupOperationDiagnostics.fail(error,details,id)})
}),Object.freeze({lease:RichTextAssetWriteLease}));
// Cleanup runs after each day's upkeep, and soon after anything leaves a file
// unused. A request lost to a reload is caught by the next day's sweep.
scheduleRichTextAssetMaintenance=delay=>RichTextAssetMaintenance.schedule(delay);
notifyRichTextAssetLeaseReleased=()=>RichTextAssetMaintenance.leaseReleased();
function renderRichTextContent(container:HTMLElement|null,value:unknown,emptyText:string='',label:string='Rich text'){
  if(!container)return false;
  const canonical=String(value??'');
  if(!canonical.trim()){container.textContent=String(emptyText||'');return false;}
  try{return RichTextApi.renderRichText({container,value:canonical,label:String(label||'Rich text'),assets:RichTextAssets,workspaceOverlay:RichTextWorkspaceOverlay,notes:richTextNotes()});}
  catch(error){AppDiagnostics.capture('rich-text.display',error,'warn');container.textContent=plainTextContent(canonical).trim()||String(emptyText||'');return false;}
}
function exactAppMetaFamily(capability:typeof HostAppMeta,key:unknown,label:string='app metadata'){
  const resolved=AppMetaGateway.resolve(String(key||''));
  if(!resolved||resolved.owner!==capability.owner||resolved.kind!=='exact')throw new TypeError(`Unclassified ${label} key.`);
  return resolved.family;
}
function exactAppMetaStorage(capability:typeof HostAppMeta,family:string,key:unknown,label:string){
  const expected=String(key||'');
  const assertKey=(value:unknown)=>{if(String(value||'')!==expected)throw new TypeError(`${label} metadata identity is invalid.`);};
  return Object.freeze({
    read:async (value:unknown)=>{assertKey(value);return capability.read(family);},
    write:async(value:unknown,payload:unknown,options:Parameters<typeof capability.write>[2]={})=>{assertKey(value);return capability.write(family,payload,options);},
    remove:async(value:unknown,options:Parameters<typeof capability.remove>[2]={})=>{assertKey(value);return capability.remove(family,'',options);}
  });
}
async function readHostAppMetaValue(key:unknown){return HostAppMeta.read(exactAppMetaFamily(HostAppMeta,key,'host app metadata'));}
function writeHostAppMetaValue(key:unknown,value:unknown,options:Parameters<typeof HostAppMeta.write>[2]={}){return HostAppMeta.write(exactAppMetaFamily(HostAppMeta,key,'host app metadata'),value,options);}
async function readReconciliationBase(){return ReconciliationBaselineStore.readHeader();}
async function readReconciliationBaseNotes(keys:Parameters<typeof ReconciliationBaselineStore['readNotes']>[0]){return ReconciliationBaselineStore.readNotes(keys);}
async function readReconciliationBaseDayAncestry(dates:Parameters<typeof ReconciliationBaselineStore['readDayAncestry']>[0],checkpointId:Parameters<typeof ReconciliationBaselineStore['readDayAncestry']>[1]){return ReconciliationBaselineStore.readDayAncestry(dates,checkpointId);}
async function writeReconciliationBase(checkpointId:Parameters<typeof ReconciliationBaselineStore['write']>[0],spec:Parameters<typeof ReconciliationBaselineStore['write']>[1]){return ReconciliationBaselineStore.write(checkpointId,spec);}
type VerifiedRecoveryInput=Parameters<typeof BackupReadinessHostModule.createVerifiedRecovery>[0];
const VerifiedRecovery=BackupReadinessHostModule.createVerifiedRecovery(Object.freeze<VerifiedRecoveryInput>({
  metadata:Object.freeze<VerifiedRecoveryInput['metadata']>({
    read:()=>readHostAppMetaValue(APP_META_KEYS.verifiedRecoveryBackups),
    write:value=>writeHostAppMetaValue(APP_META_KEYS.verifiedRecoveryBackups,value)
  }),
  storageHealth:Object.freeze<VerifiedRecoveryInput['storageHealth']>({snapshot:()=>requireStorageHealthController().snapshot(),updateHistory:patch=>requireStorageHealthController().updateHistory(patch)}),
  mutationEpoch:Object.freeze<VerifiedRecoveryInput['mutationEpoch']>({latestChangeAt:recorded=>AppData.mutationEpoch.latestChangeAt(recorded)}),
  backupVersion:DATA_CONTRACT.schemas.Backup.version,
  sourceRevision:()=>BackupRuntimeHost.sourceRevision(),
  refreshProviders:()=>BackupProviderRuntime.refresh(),
  capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level),
  nowIso:()=>new Date().toISOString()
}));
if(!Object.isFrozen(VerifiedRecovery)||VerifiedRecovery.format!=='study-director.verified-recovery-readiness'||VerifiedRecovery.contractVersion!==1){
  throw new Error('Study Director verified-recovery readiness is unavailable or incompatible.');
}

BackupNudge=BackupReadinessHostModule.createBackupNudge(Object.freeze<Parameters<typeof BackupReadinessHostModule.createBackupNudge>[0]>({
  verified:VerifiedRecovery,storageHealth:requireStorageHealthController(),dueMs:7*24*60*60*1000,checkMs:60*60*1000,
  canMutate:()=>appCanMutate(),now:()=>Date.now(),automaticActive:()=>BackupProviderRuntime.automaticActive(),
  dailySummaryCount:async()=>{const summaries=await AppData.dailyRecords.summaries();return Array.isArray(summaries)?summaries.length:0;},
  todayIso:()=>todayISO(),publishMessage:()=>refreshStorageFallbackWarning(),
  notify:(title,message,tag)=>notifyUser(title,message,tag),capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level)
}));
if(!Object.isFrozen(BackupNudge)||BackupNudge.format!=='study-director.backup-nudge'||BackupNudge.contractVersion!==1){
  throw new Error('Study Director backup reminder readiness is unavailable or incompatible.');
}
/* APPDATA REPOSITORY FACADE */
function handleRepositoryDailyRecordsChanged(change:Parameters<RepositoryCompositionInput['appData']['hooks']['onDailyRecordsChanged']>[0]){
  richAssetReferenceRevision++;
  LibraryView.invalidate();
  if(document.getElementById('pane-library')?.classList.contains('on'))setTimeout(()=>{if(document.getElementById('pane-library')?.classList.contains('on'))void LibraryView.render();},0);
}
function handleRepositoryDatasetRevisionChanged(){
  if(!document.getElementById('pane-insights')?.classList.contains('on'))return;
  setTimeout(()=>{if(document.getElementById('pane-insights')?.classList.contains('on'))UiTabRegistry.renderTab('insights');},0);
}
function persistedActiveSessionUnfinished(value:unknown){
  const session=ActiveSessionCodec.sanitizeCurrent(value);
  if(!session||!['active','suspended'].includes(session.status||'active'))return false;
  const snapshot=activeSessionSnapshot(session);
  const draft=parseScheduleDraftText(String(session.scheduleText||''));
  if(!snapshot||!draft.ok||!draft.parsed.length)return false;
  const taskState=snapshot.taskState&&typeof snapshot.taskState==='object'?snapshot.taskState:{};
  return draft.parsed.some((task,index)=>{
    if(!isTrackableBlock(task))return false;
    const taskId=makeTaskId(task,index);
    const resolved=taskState[taskId]&&taskState[taskId].resolvedState;
    return resolved!=='done'&&resolved!=='skipped';
  });
}
function handleCanonicalCommit(event:Parameters<typeof CanonicalCommitHost['handle']>[0]){return CanonicalCommitHost.handle(event);}

async function refreshPersistedSessionBadge(){return CapabilityBadge?CapabilityBadge.refreshPersistedSessionBadge():false;}
type RepositoryCompositionInput=Parameters<typeof DataBootstrapHostModule.createRepositoryComposition>[0];
const {RepositoryJournals,AppData}=DataBootstrapHostModule.createRepositoryComposition(Object.freeze<RepositoryCompositionInput>({
  repositoriesModule:RepositoryModule,
  journalsModule:RepositoryJournalModule,
  journal:Object.freeze<RepositoryCompositionInput['journal']>({
    appMeta:JournalAppMeta,
    limits:APP_LIMITS,
    helpers:Object.freeze<RepositoryCompositionInput['journal']['helpers']>({clampText}),
    clock:Object.freeze<RepositoryCompositionInput['journal']['clock']>({nowMs:DecisionClock.nowMs})
  }),
  appData:Object.freeze<RepositoryCompositionInput['appData']>({
    local:LocalStorageContract,
    indexedDb:IndexedDb,
    appMeta:RepositoryAppMeta,
    installationIdentity:InstallationIdentity,
    dailyRecordCodec:DailyRecordCodec,
    activeSessionCodec:ActiveSessionCodec,
    personalDataCodec:PersonalDataCodec,
    pendingReviewCodec:PendingReviewCodec,
    keyedRecord:KeyedRecord,
    notesRepositoryModule:NotesRepositoryModule,
    saveLaneModule:SaveLaneModule,
    limits:APP_LIMITS,
    dataContract:DATA_CONTRACT,
    stores:Object.freeze<RepositoryCompositionInput['appData']['stores']>({
      dailyRecords:DB_DAILY_RECORD_STORE,
      dailySummaries:DB_DAILY_SUMMARY_STORE,
      notes:DB_NOTES_STORE,
      activeSessions:DB_ACTIVE_SESSION_STORE,
      appMeta:DB_APP_META_STORE
    }),
    keys:Object.freeze<RepositoryCompositionInput['appData']['keys']>({
      recovery:STORAGE_KEYS.recovery,
      fallbackDailyRecords:STORAGE_KEYS.fallbackDailyRecords,
      noteRescue:STORAGE_KEYS.noteRescue,
      deletionRecovery:STORAGE_KEYS.deletionRecovery
    }),
    metaKeys:Object.freeze<RepositoryCompositionInput['appData']['metaKeys']>({
      planDraft:APP_META_KEYS.planDraft,
      planLibrary:APP_META_KEYS.planLibrary,
      personalPreferences:APP_META_KEYS.personalPreferences,
      canonicalMutationEpoch:APP_META_KEYS.canonicalMutationEpoch,
      backupPreparationUnitPrefix:APP_META_KEYS.backupPreparationUnitPrefix,
      insightsDatasetRevision:APP_META_KEYS.insightsDatasetRevision,
      dataMaintenance:APP_META_KEYS.dataMaintenance,
      savedDayDeletionPrefix:APP_META_KEYS.savedDayDeletionPrefix,
      noteDeletionPrefix:APP_META_KEYS.noteDeletionPrefix,
      attachmentDeletionPrefix:APP_META_KEYS.attachmentDeletionPrefix,
      pendingReviewPrefix:APP_META_KEYS.pendingReviewPrefix
    }),
    activeSessionId:ACTIVE_SESSION_ID,
    clock:Object.freeze<RepositoryCompositionInput['appData']['clock']>({nowMs:DecisionClock.nowMs}),
    helpers:Object.freeze<RepositoryCompositionInput['appData']['helpers']>({
      boundedInt,boundedNumber,clampText,clampEditorContent,editorContentWithinLimits,wipeObject,isValidIsoDate,isCanonicalScheduleText,sameDataValue,
      activeSessionScheduleFingerprint,normalizeAreaName,displayAreaName,isoDateDay:value=>{const day=isoDateDay(value);if(day===null)throw new TypeError('Canonical ISO date is invalid.');return day;},normalizeTimestamp,jsonByteLength
    }),
    hooks:Object.freeze<RepositoryCompositionInput['appData']['hooks']>({
      canMutate:appCanMutate,
      getOwnershipRevision:()=>AppOwnership.revision,
      issueWriteToken:(reason,options)=>AppOwnership.issueWriteToken(reason,options),
      assertWriteToken:(token,reason)=>AppOwnership.assertWriteToken(token,reason),
      isOwnershipLostError:error=>AppOwnership.isOwnershipLostError(error),
      capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level),
      onStorageOk:markStorageHealthOk,
      onStorageError:markStorageHealthError,
      onNotesChanged:refreshNoteConsumers,
      onNoteSyncState:setNoteSyncStateForKey,
      onNoteConflict:reportNoteConflict,
      onDailyRecordsChanged:handleRepositoryDailyRecordsChanged,
      onDatasetRevisionChanged:handleRepositoryDatasetRevisionChanged,
      onCanonicalCommit:handleCanonicalCommit
    })
  })
}));
// Saves made before the startup repair still continue the change clock from
// the last recorded save, even if the system clock went back across a reload.
try{AppData.mutationEpoch.seedChangeClock(readStorageHealth().lastLocalSaveAt);}catch(error){AppDiagnostics.capture('backup.change-clock-seed',error,'warn');}
CapabilityBadge=CapabilitiesHostModule.createBadge(Object.freeze<Parameters<typeof CapabilitiesHostModule.createBadge>[0]>({
  controller:()=>NativeCapabilities,
  activeSession:()=>AppData.activeSession,
  persistedActiveSessionUnfinished,
  capture:(scope,error)=>AppDiagnostics.capture(scope,error,'warn')
}));
type NativeCapabilitiesHostInput=Parameters<typeof CapabilitiesHostModule.createController>[0];
NativeCapabilities=CapabilitiesHostModule.createController(Object.freeze<NativeCapabilitiesHostInput>({
  module:NativeCapabilitiesModule,
  configuration:Object.freeze<NativeCapabilitiesHostInput['configuration']>({installNoticeKey:STORAGE_KEYS.installNoticeShown,wakePreferenceKey:STORAGE_KEYS.keepScreenAwake}),
  environment:Object.freeze<NativeCapabilitiesHostInput['environment']>({document,navigator,window}),
  hooks:Object.freeze<NativeCapabilitiesHostInput['hooks']>({
    capture:(scope,error)=>AppDiagnostics.capture(scope,error,'warn'),
    isTimerRunning:()=>appCanMutate()&&TimerState.mode===TIMER_MODES.RUNNING&&!TimerState.paused&&isLiveTrackableTimer(),
    readPreference:key=>AppData.local.getJson(key,false)===true,
    writePreference:(key,value)=>AppData.local.setJson(key,value===true),
    render:renderNativeCapabilities
  })
}));
StorageHealthController.activate();

/* SESSION RESET ORCHESTRATION */
function resetRuntimeSessionState(...args:Parameters<typeof SessionActions.resetRuntimeSessionState>){return SessionActions.resetRuntimeSessionState(...args);}
function refreshPlanAfterSessionReset(...args:Parameters<typeof SessionActions.refreshPlanAfterSessionReset>){return SessionActions.refreshPlanAfterSessionReset(...args);}
function suspendTodaySession(...args:Parameters<typeof SessionActions.suspendTodaySession>){return SessionActions.suspendTodaySession(...args);}
function sessionUpdateTime(...args:Parameters<typeof SessionActions.sessionUpdateTime>){return SessionActions.sessionUpdateTime(...args);}
// The device a session runs on, by name: "on iPhone · Safari", or "on another device".
function sessionDevice(...args:Parameters<typeof SessionActions.sessionDevice>){return SessionActions.sessionDevice(...args);}
// Continue Here: this device runs the session from now on. A session still
// running on another device moves only after a warning; that device stops its
// timer at its next sync and offers what it recorded since for review.
function confirmSessionTakeover(...args:Parameters<typeof SessionActions.confirmSessionTakeover>){return SessionActions.confirmSessionTakeover(...args);}
const HANDOFF_RETRY_MESSAGE=SessionHandoffModule.retryMessage;
// P5.4C owns the distributed claim/compensation state machine. This host
// adapter supplies UI progress only; provider and persistence semantics live
// behind the checked controller.
function transferSessionOwnershipHere(...args:Parameters<typeof SessionActions.transferSessionOwnershipHere>){return SessionActions.transferSessionOwnershipHere(...args);}
// Continue Here in progress: every Continue Here button says so and the
// Execute card shows the step; a failure stays in the card until the next
// try or until the session moves on.
function setSessionHandoff(...args:Parameters<typeof SessionActions.setSessionHandoff>){return SessionActions.setSessionHandoff(...args);}
// The block a stored session is on and how many of its blocks are done.
function sessionProgressSummary(...args:Parameters<typeof SessionActions.sessionProgressSummary>){return SessionActions.sessionProgressSummary(...args);}
function sessionHandoffProblem(...args:Parameters<typeof SessionActions.sessionHandoffProblem>){return SessionActions.sessionHandoffProblem(...args);}
function continueSessionHere(...args:Parameters<typeof SessionActions.continueSessionHere>){return SessionActions.continueSessionHere(...args);}
// From a pop-up or the profile panel: open Execute first, where the card
// shows each Continue Here step.
function continueSessionOnExecute(...args:Parameters<typeof SessionActions.continueSessionOnExecute>){return SessionActions.continueSessionOnExecute(...args);}
// Another device continued today's session after this one changed it: the
// timer stops here and this device's progress stays as a suspended session,
// so the review can offer both.
function yieldSessionToOtherDevice(...args:Parameters<typeof SessionActions.yieldSessionToOtherDevice>){return SessionActions.yieldSessionToOtherDevice(...args);}
function restoreSuspendedTodaySession(...args:Parameters<typeof SessionActions.restoreSuspendedTodaySession>){return SessionActions.restoreSuspendedTodaySession(...args);}
function finishTodaySession(...args:Parameters<typeof SessionActions.finishTodaySession>){return SessionActions.finishTodaySession(...args);}
function resetTodaySession(...args:Parameters<typeof SessionActions.resetTodaySession>){return SessionActions.resetTodaySession(...args);}
let latestCarryForward='';
/* AREA NOTES REPOSITORY */

function notesRuntime(){
  if(!NotesRuntime)throw new Error('Notes runtime is unavailable.');
  return NotesRuntime;
}
function legacyNoteBinding(binding:NoteEditorBinding|null){
  return binding?Object.freeze({...binding,areaKey:binding.key,areaLabel:binding.label}):null;
}
function noteStoredValueForKey(key:Parameters<NonNullable<typeof NotesRuntime>['storedValueForKey']>[0]){return notesRuntime().storedValueForKey(key);}
function noteTextForKey(key:Parameters<NonNullable<typeof NotesRuntime>['textForKey']>[0]){return notesRuntime().textForKey(key);}
function noteEditorContent(binding:NoteEditorBinding|null,value:unknown){return notesRuntime().editorContent({key:binding?.key||''},value);}
function applicableNotesForTask(task:Task|undefined){return notesRuntime().applicableForTask(task);}
function inheritedNoteEntries(areaKey:unknown){return notesRuntime().inheritedEntries(areaKey);}
function normalizeOngoingAreaInput(value:unknown){return notesRuntime().normalizeAreaInput(value);}
function orderOngoingAreaEntries(source:readonly NoteCatalogueInput[]){return notesRuntime().orderEntries(source);}
function noteSearchDocuments(){return AppData.notes.searchSnapshot().documents;}
function noteCatalogue(){return notesRuntime().catalogue();}
let refreshLibraryNotes:ReturnType<typeof LibraryModule.createView>['refreshNotes']=()=>false;
let updateNoteSearchDocument:(document:Readonly<{key:string;revision:string;plain:string}>)=>unknown=()=>false;
function updateNoteSearchText(key:string,plain:unknown){const entry=key?AppData.notes.get(key):null;if(entry)updateNoteSearchDocument({key,revision:entry.updatedAt||'',plain:String(plain||'')});}
function refreshNoteConsumers(){
  richAssetReferenceRevision++;
  return NotesRuntime?NotesRuntime.refreshConsumers():false;
}
function reportNoteConflict(info:Parameters<NonNullable<typeof NotesRuntime>['reportConflict']>[0]={}){return NotesRuntime?NotesRuntime.reportConflict(info):false;}

/* BOUNDED DATA MAINTENANCE */
const DATA_MAINTENANCE_SCHEDULE_INTERVAL_MS=AppData.maintenance.intervalMs,DATA_MAINTENANCE_FAILURE_RETRY_MS=30*60*1000,ATTACHMENT_CLEANUP_AFTER_UPKEEP_MS=5000;
// Every background job asks this one question before it starts: this tab owns
// writes and start-up has finished. Housekeeping (attachment cleanup and
// checks, scratch files, backups and their upkeep) also waits while a
// browser-data clear is unresolved. Canonical maintenance is recovery, so it
// keeps running through a clear. Ownership is asked first: a job configured
// while the page is still loading asks before start-up exists, and no tab owns
// writes until start-up has begun.
let BackgroundMaintenance:ReturnType<typeof BackupMaintenanceHostModule.createBackground>|null=null,DataMaintenanceJob:ReturnType<typeof BackupMaintenanceHostModule.createBackground>['job']|null=null;
function backgroundBlocker(options:Parameters<NonNullable<typeof BackgroundMaintenance>['backgroundBlocker']>[0]={}){return BackgroundMaintenance?BackgroundMaintenance.backgroundBlocker(options):'startup';}
function upkeepBlocker(options:Parameters<NonNullable<typeof BackgroundMaintenance>['upkeepBlocker']>[0]={}){return BackgroundMaintenance?BackgroundMaintenance.upkeepBlocker(options):'startup';}
function foregroundChanged(){return BackgroundMaintenance?.foregroundChanged()||false;}
function installBackgroundOwners(){return BackgroundMaintenance?.install()||false;}
function wakeBackgroundOperations(trigger:Parameters<NonNullable<typeof BackgroundMaintenance>['wake']>[0]='eligibility'){return BackgroundMaintenance?.wake(trigger)||false;}
function backgroundMaintenanceForegroundBusy(){return BackgroundMaintenance?BackgroundMaintenance.foregroundBusy():true;}
function waitForClosedTabLease(limitMs:number=25000){return BackgroundMaintenance?BackgroundMaintenance.waitForClosedTabLease(AppOwnership,requireMutationCoordinator(),limitMs):Promise.resolve(false);}
function scheduleDataMaintenance(delay:number=1200,trigger:string='scheduled'){return BackgroundMaintenance?.schedule(delay,trigger)||false;}
NoticeCoordinator.subscribe(()=>{foregroundChanged();});

/* ONGOING SUBJECT NOTES · P5.6A CHECKED OWNER */
const NOTE_EDITOR_BINDING_VERSION=NotesHostModule.bindingVersion;
function inheritedSubjectNotesHtml(task:Task|undefined){return notesRuntime().inheritedTextForTask(task);}
function renderInheritedNotes(container:HTMLElement|null,areaKey:unknown,compact:boolean=false,options:Parameters<NonNullable<typeof NotesRuntime>['renderInherited']>[3]={}){return notesRuntime().renderInherited(container,areaKey,compact,options);}
function renderInheritedSubjectNotes(container:HTMLElement|null,task:Task|undefined,compact:boolean=false){return notesRuntime().renderInheritedForTask(container,task,compact);}
function currentNoteEntriesForWorkTasks(tasks:readonly Task[]){return notesRuntime().currentEntriesForTasks(tasks);}
function clearTaskNoteEditorBinding(field:HTMLTextAreaElement|null){return NotesRuntime?NotesRuntime.clearEditor(field):false;}
function taskNoteEditorIsVisible(field:HTMLTextAreaElement){return NotesRuntime?NotesRuntime.editorVisible(field):false;}
function bindTaskNoteEditor(field:HTMLTextAreaElement,idx:number,source:string='field'){return legacyNoteBinding(notesRuntime().bindTaskEditor(field,idx,source));}
function bindNoteEditor(field:HTMLTextAreaElement,areaKey:unknown,areaLabel:unknown,source:string='library'){return legacyNoteBinding(notesRuntime().bindAreaEditor(field,areaKey,areaLabel,source));}
function resolveTaskNoteEditorBinding(field:HTMLTextAreaElement|null,options:Parameters<NonNullable<typeof NotesRuntime>['resolveEditor']>[1]={}){return legacyNoteBinding(notesRuntime().resolveEditor(field,options));}
function refreshSubjectNoteFieldsForKey(key:unknown,originField:HTMLTextAreaElement|null=null,derived:Parameters<NonNullable<typeof NotesRuntime>['refreshFieldsForKey']>[2]=null,options:Parameters<NonNullable<typeof NotesRuntime>['refreshFieldsForKey']>[3]={}){return notesRuntime().refreshFieldsForKey(key,originField,derived,options);}
function refreshAllSubjectNoteFieldsFromRepository(){return NotesRuntime?NotesRuntime.refreshAllFields():false;}
function setNoteSyncStateForKey(key:unknown,state:NoteSyncState){return NotesRuntime?NotesRuntime.setSyncState(key,state):false;}
function updateNoteSyncIndicators(idx:number,key:unknown){
  const task=TASKS[idx],safeKey=key?normalizeAreaName(key):(task?noteKeyForTask(task):'');
  return setNoteSyncStateForKey(safeKey,'synced');
}
/* PLAN DRAFTS, SAVED DEFAULTS, AND QUOTE DRAFT */
const PROTECTED_PREFERENCES_SAVE_DELAY_MS=250;
type PortablePreferencesState=ReturnType<typeof PersonalDataCodec.portablePreferences>;
let protectedPreferencesState:PortablePreferencesState=Object.freeze({version:2,studentName:null,theme:null,presentation:null,quote:null,practiceCueMode:null,fontScale:null,practiceTargetMs:null,nudge:null,updatedAt:null});
let protectedPreferencesHydrated=false,protectedPreferencesDirty=false,protectedPreferencesWriteTimer:number|null=null,protectedPreferencesWriteFailure:unknown=null;
let protectedPreferencesWriteChain:Promise<unknown>=Promise.resolve();
type PresentationController=ReturnType<typeof PresentationHostModule.createController>;
let PresentationRuntime:PresentationController|null=null;
function requirePresentationRuntime(){if(!PresentationRuntime)throw new Error('Study Director presentation host is unavailable.');return PresentationRuntime;}
function canonicalPortablePreferences(value:unknown):PortablePreferencesState{
  return PersonalDataCodec.currentPortablePreferences(value)??PersonalDataCodec.portablePreferences(value);
}
function acceptProtectedPreferences(value:unknown){
  const clean=canonicalPortablePreferences(value);
  protectedPreferencesState=Object.freeze({...clean});protectedPreferencesHydrated=true;return protectedPreferencesState;
}
function refreshAppearanceMirrors(value:unknown=protectedPreferencesState){
  const clean=canonicalPortablePreferences(value);
  return requirePresentationRuntime().refreshMirrors(clean);
}
function applyPortablePreferencesToRuntime(value:unknown=protectedPreferencesState){
  const clean=canonicalPortablePreferences(value);
  applyStudentName(clean.studentName||FACTORY_DEFAULTS.studentName);
  requirePresentationRuntime().applyPreferences(clean);
  const qi=document.getElementById('quote-input');if(qi instanceof HTMLInputElement||qi instanceof HTMLTextAreaElement){qi.value=clean.quote||'';const display=document.getElementById('quote-display');if(display)display.textContent=qi.value.trim();}
  Pomodoro.configuration.load();
  NoticeCoordinator.setSoundMode(clean.soundMode??(clean.nudge?.sound===false?'off':'full'));renderSoundSettings();
  return clean;
}
async function hydrateProtectedPreferences({force=false}:Readonly<{force?:boolean}>={}){
  if(protectedPreferencesHydrated&&!force)return protectedPreferencesState;
  const saved=await AppData.personalPreferences.read();
  protectedPreferencesDirty=false;protectedPreferencesWriteFailure=null;
  const accepted=acceptProtectedPreferences(saved||{version:2,studentName:null,theme:null,presentation:null,quote:null,practiceCueMode:null,fontScale:null,practiceTargetMs:null,nudge:null,updatedAt:null});
  refreshAppearanceMirrors(accepted);applyPortablePreferencesToRuntime(accepted);
  return accepted;
}
async function flushProtectedPreferences(options:Readonly<{backupCapture?:boolean}>={}){
  if(protectedPreferencesWriteTimer!==null){clearTimeout(protectedPreferencesWriteTimer);protectedPreferencesWriteTimer=null;}
  if(!appCanMutate())return false;
  while(protectedPreferencesDirty){
    const snapshot=protectedPreferencesState;
    protectedPreferencesDirty=false;
    const run=protectedPreferencesWriteChain.catch(()=>true).then(()=>AppData.personalPreferences.write(snapshot,{backupCapture:options.backupCapture===true}));
    protectedPreferencesWriteChain=run;
    try{
      const saved=await run;
      protectedPreferencesWriteFailure=null;
      if(protectedPreferencesState===snapshot){acceptProtectedPreferences(saved);refreshAppearanceMirrors(saved);}
    }catch(error){
      protectedPreferencesDirty=true;protectedPreferencesWriteFailure=error;
      AppDiagnostics.capture('preferences.write',error,'error');markStorageHealthError('personalPreferences','Personal settings could not be saved.');
      throw error;
    }
  }
  await protectedPreferencesWriteChain.catch(error=>{throw error;});
  if(protectedPreferencesWriteFailure)throw protectedPreferencesWriteFailure;
  return true;
}
function scheduleProtectedPreferencesWrite(){
  if(protectedPreferencesWriteTimer!==null)clearTimeout(protectedPreferencesWriteTimer);
  protectedPreferencesWriteTimer=setTimeout(()=>{protectedPreferencesWriteTimer=null;void flushProtectedPreferences().catch(()=>{});},PROTECTED_PREFERENCES_SAVE_DELAY_MS);
}
type PortablePreferenceOverrides=Partial<Omit<PortablePreferencesState,'version'|'updatedAt'>>;
function persistProtectedPreferences(overrides:PortablePreferenceOverrides={}){
  if(!appCanMutate()||!protectedPreferencesHydrated)return false;
  const next=PersonalDataCodec.portablePreferences({
    ...protectedPreferencesState,...overrides,version:2,updatedAt:new Date().toISOString()
  });
  protectedPreferencesState=Object.freeze({...next});protectedPreferencesHydrated=true;protectedPreferencesDirty=true;protectedPreferencesWriteFailure=null;
  if('theme' in overrides||'presentation' in overrides||'fontScale' in overrides)void flushProtectedPreferences().catch(()=>{});
  else scheduleProtectedPreferencesWrite();
  return true;
}
type PresentationHostInput=Parameters<typeof PresentationHostModule.createController>[0];
PresentationRuntime=PresentationHostModule.createController(Object.freeze<PresentationHostInput>({
  kernel:PRESENTATION_KERNEL,document,window,
  storage:Object.freeze<PresentationHostInput['storage']>({
    keys:Object.freeze<PresentationHostInput['storage']['keys']>({theme:STORAGE_KEYS.theme,presentation:STORAGE_KEYS.presentation,fontScale:STORAGE_KEYS.fontScale}),
    getText:(key,fallback)=>AppData.local.getText(key,fallback),
    setText:(key,value)=>AppData.local.setText(key,value),
    remove:key=>AppData.local.remove(key),
    lastError:()=>AppData.lastStorageError
  }),
  preferences:Object.freeze<PresentationHostInput['preferences']>({
    hydrated:()=>protectedPreferencesHydrated,current:()=>protectedPreferencesState,
    persist:value=>persistProtectedPreferences(value)
  }),
  ownership:Object.freeze<PresentationHostInput['ownership']>({require:reason=>requirePrimaryTab(null,reason)}),
  diagnostics:Object.freeze<PresentationHostInput['diagnostics']>({capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level)}),
  popovers:Object.freeze<PresentationHostInput['popovers']>({create:menu=>RichTextApi.createAnchoredPopover(menu,{align:'end',side:'top'})})
}));
if(!Object.isFrozen(PresentationRuntime)||PresentationRuntime.format!=='study-director.presentation-host'||PresentationRuntime.contractVersion!==1){
  throw new Error('Study Director presentation host is unavailable or incompatible.');
}
function saveQuoteDraft(){
  if(!appCanMutate())return;
  try{const el=document.getElementById('quote-input');if(el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement){const value=clampText(el.value,APP_LIMITS.maxQuoteChars);if(el.value!==value)el.value=value;persistProtectedPreferences({quote:value});}}catch(e){}
}
const StartupDraftHydration=StartupHostModule.createDraftHydration({document,hydratePlan:()=>PlanData.hydrate(),hydratePreferences:options=>hydrateProtectedPreferences(options),
 capture:AppDiagnostics.capture,markStorageError:markStorageHealthError,projectPlan:options=>PlanRuntime.hydrate(options),renderSavedPlans:()=>PlanRuntime.savedPlans.render(),quote:()=>protectedPreferencesState.quote||'',quoteChanged:options=>onQuoteChange(options)});
async function hydrateSavedDrafts(options:Parameters<typeof StartupDraftHydration>[0]={}){return StartupDraftHydration(options);}
type UserDefaultOverrides=Partial<Pick<PersonalPreferences,'studentName'|'practiceTargetMs'|'practiceCueMode'>>;
function userDefaultsPayload(overrides:UserDefaultOverrides={}){
  const saved:Partial<NonNullable<ReturnType<typeof readUserDefaults>>>=readUserDefaults()??{},has=(key:keyof UserDefaultOverrides)=>Object.prototype.hasOwnProperty.call(overrides,key);
  const studentName=normalizeStudentName(has('studentName')?overrides.studentName:saved.studentName||getStudentNameFromDisplay());
  const practiceTargetMs=validPracticeMs(has('practiceTargetMs')?overrides.practiceTargetMs:saved.practiceTargetMs,{min:APP_LIMITS.minPracticeTargetMs});
  const practiceCueMode=sanitizePracticeCueMode(has('practiceCueMode')?overrides.practiceCueMode:saved.practiceCueMode);
  return {studentName,practiceTargetMs:practiceTargetMs||null,practiceCueMode};
}
function persistUserDefaults(overrides:UserDefaultOverrides={}){return persistProtectedPreferences(userDefaultsPayload(overrides));}
function persistUserDefaultName(studentName:unknown){if(!appCanMutate())return false;return persistUserDefaults({studentName:normalizeStudentName(studentName)});}
function persistPracticeTarget(targetMs:unknown){if(!appCanMutate())return false;const cleanTarget=validPracticeMs(targetMs,{min:APP_LIMITS.minPracticeTargetMs});if(!cleanTarget)return false;return persistUserDefaults({practiceTargetMs:cleanTarget});}
function persistPracticeCueMode(mode:unknown){if(!appCanMutate())return false;return persistUserDefaults({practiceCueMode:sanitizePracticeCueMode(mode)});}
function ensureTaskIds(){return TimerState.ensureTaskIds();}
/* SHELL DEFAULTS AND CLOCK HEADER */
function normalizeStudentName(...args:Parameters<typeof ProfileViews.normalizeStudentName>){return ProfileViews.normalizeStudentName(...args);}
function filenameSafeStudentName(name:unknown){
  const base=normalizeStudentName(name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,Math.max(1,APP_LIMITS.maxBackupFilenameChars-64)).replace(/-$/g,'');
  return base||'student';
}
function readUserDefaults(){
  const saved=protectedPreferencesState;
  if(!protectedPreferencesHydrated&&!saved.studentName&&!saved.practiceTargetMs&&!saved.practiceCueMode)return null;
  const studentName=normalizeStudentName(saved.studentName),practiceTargetMs=validPracticeMs(saved.practiceTargetMs,{min:APP_LIMITS.minPracticeTargetMs}),practiceCueMode=sanitizePracticeCueMode(saved.practiceCueMode);
  if(studentName===FACTORY_DEFAULTS.studentName&&!practiceTargetMs&&practiceCueMode===PRACTICE_CUE_DEFAULT)return null;
  return {studentName,practiceTargetMs:practiceTargetMs||null,practiceCueMode};
}
function getActiveDefaults(){return PlanData.activeDefaults();}
function applyStudentName(...args:Parameters<typeof ProfileViews.applyStudentName>){return ProfileViews.applyStudentName(...args);}
function getStudentNameFromDisplay(...args:Parameters<typeof ProfileViews.getStudentNameFromDisplay>){return ProfileViews.getStudentNameFromDisplay(...args);}
function isDefaultStudentName(...args:Parameters<typeof ProfileViews.isDefaultStudentName>){return ProfileViews.isDefaultStudentName(...args);}
function profileInitial(...args:Parameters<typeof ProfileViews.profileInitial>){return ProfileViews.profileInitial(...args);}
function profileSince(...args:Parameters<typeof ProfileViews.profileSince>){return ProfileViews.profileSince(...args);}
function profileLabel(...args:Parameters<typeof ProfileViews.profileLabel>){return ProfileViews.profileLabel(...args);}
function renderProfileBadge(...args:Parameters<typeof ProfileViews.renderProfileBadge>){return ProfileViews.renderProfileBadge(...args);}
// P5.8B owns the shared profile/sync status surface. These wrappers exist
// early because storage/profile composition can request a redraw before the
// checked owner is instantiated; the pending redraw is replayed after wiring.
function scheduleSyncStatus(){
  if(!SyncStatusHost){syncStatusPending=true;return false;}
  return SyncStatusHost.schedule();
}
function connectDriveForProfile(){return SyncStatusHost?SyncStatusHost.connectDriveForProfile():false;}
function endDriveConnectCard(){return SyncStatusHost?SyncStatusHost.endConnectCard():false;}
function syncStatusAction(event:Parameters<ReturnType<typeof SyncStatusHostModule.createController>['action']>[0]){return SyncStatusHost?SyncStatusHost.action(event):Promise.resolve(false);}
function renderProfilePanel(...args:Parameters<typeof ProfileViews.renderProfilePanel>){return ProfileViews.renderProfilePanel(...args);}
function renderProfile(...args:Parameters<typeof ProfileViews.renderProfile>){return ProfileViews.renderProfile(...args);}
function reportProfileActionError(...args:Parameters<typeof ProfileViews.reportProfileActionError>){return ProfileViews.reportProfileActionError(...args);}
const ProfilePanelActions=ProfilesHostModule.createPanelActions(Object.freeze<Parameters<typeof ProfilesHostModule.createPanelActions>[0]>({
  document,
  getStudentName:()=>getStudentNameFromDisplay(),
  normalizeStudentName,
  applyStudentName,
  persistUserDefaultName,
  renderPanel:()=>renderProfilePanel(),
  reportError:error=>reportProfileActionError(error),
  appCanMutate:()=>appCanMutate(),
  recent:NotificationRecent
}));
function openProfilePanel(){return ProfilePanelActions.open();}
function closeProfilePanel(){return ProfilePanelActions.close();}
function installProfileDialogs(){return ProfilePanelActions.install();}
function startProfileRename(){return ProfilePanelActions.startRename();}
function finishProfileRename(){return ProfilePanelActions.finishRename();}
function handleProfileNameKey(event:Parameters<typeof ProfilePanelActions['handleNameKey']>[0]){return ProfilePanelActions.handleNameKey(event);}

function profileDriveAction(){return ProfileViews.profileDriveAction();}
// Profile deletion composes backup/provider effects behind a checked profile-owned adapter.
type ProfileDeletionInput=Parameters<typeof ProfilesHostModule.createDeletion>[0];
const ProfileDeletion=ProfilesHostModule.createDeletion(Object.freeze<ProfileDeletionInput>({
  profiles:Profiles,
  appCanMutate:()=>appCanMutate(),
  settleCurrentProfile:()=>settleCurrentProfileBeforeReload(),
  mutation:Object.freeze<ProfileDeletionInput['mutation']>({run:(kind,operation)=>requireMutationCoordinator().runExclusive(kind,authority=>operation(Object.freeze({assert:()=>authority.assert()})))}),
  provider:Object.freeze<ProfileDeletionInput['provider']>({
    locationStatus:id=>{const status=BackupProviderRuntime.locationStatus(id);return status?Object.freeze({connected:status.connected,waiting:status.waiting,...(status.sync?{sync:Object.freeze({syncedAt:status.sync.syncedAt,syncing:status.sync.syncing})}:{})}):null;},
    suspendBackground:reason=>BackupProviderRuntime.suspendBackground(reason)
  }),
  device:Object.freeze<ProfileDeletionInput['device']>({
    status:()=>requireDeviceBackup().status(),
    deleteBackups:()=>requireDeviceBackup().deleteBackups()
  }),
  interactions:Object.freeze<ProfileDeletionInput['interactions']>({
    choose:options=>Interactions.choose(options),confirm:async options=>(await Interactions.confirm(options))===true,notify:options=>Interactions.notify(options)
  }),
  capture:(scope,error)=>AppDiagnostics.capture(scope,error,'warn'),
  getStudentName:()=>getStudentNameFromDisplay(),
  renderProfile:()=>renderProfile(),
  verifiedSourceRevision:()=>VerifiedRecovery.verified('google-drive')?.sourceRevision||'',
  currentBackupSourceRevision:()=>BackupRuntimeHost.sourceRevision()
}));
const deleteThisProfile=ProfileDeletion.deleteThisProfile;
const driveProfileDeleted=ProfileDeletion.driveProfileDeleted;

type ProfileDriveBindingInput=Parameters<typeof ProfilesHostModule.createDriveBinding>[0];
const ProfileDriveBinding=ProfilesHostModule.createDriveBinding(Object.freeze<ProfileDriveBindingInput>({
  profiles:Profiles,
  appCanMutate:()=>appCanMutate(),
  interactions:Object.freeze<ProfileDriveBindingInput['interactions']>({confirm:async options=>(await Interactions.confirm(options))===true,notify:options=>Interactions.notify(options)}),
  clearBaseline:()=>ReconciliationBaselineStore.clear(),
  renderProfile:()=>renderProfile(),
  endConnectCard:()=>endDriveConnectCard(),
  firstStartJoined:()=>FirstStart.joined(),
  capture:(scope,error)=>AppDiagnostics.capture(scope,error,'warn'),
  storageHealthTime,
  now:()=>Date.now()
}));
type SyncStatusHostInput=Parameters<typeof SyncStatusHostModule.createController>[0];
SyncStatusHost=SyncStatusHostModule.createController(Object.freeze<SyncStatusHostInput>({
  document,
  providers:()=>BackupProviderRuntime,
  presentation:BackupPresentation,
  device:()=>DeviceBackup,
  protection:()=>BackupProtection,
  keptVersions:()=>KeptVersions,
  profileKey:()=>Profiles.current()?.scope||'',
  profileEmail:()=>Profiles.current()?.email||'',
  profileName:()=>getStudentNameFromDisplay(),
  deviceName:id=>deviceName(id),
  markDriveRequested:()=>ProfileDriveBinding.markRequested(),
  storageIssues:()=>readStorageHealth().issues,
  unsupportedDataHeld:()=>UnsupportedData.held(),
  backupReminder:()=>BackupNudge?.message()||'',
  updateReady:()=>PwaRuntime.updateReady(),
  sessionElsewhere:()=>sessionPanelMode==='elsewhere'&&sessionPanelSession?sessionDevice(sessionPanelSession):'',
  sessionReady:()=>sessionParkedHere()&&sessionFromElsewhere(sessionPanelSession)?sessionDevice(sessionPanelSession):'',
  unseen:()=>NoticeCoordinator.recent().unseen,
  canMutate:()=>appCanMutate(),
  actions:Object.freeze<SyncStatusHostInput['actions']>({
    closeProfilePanel:()=>closeProfilePanel(),
    enterPassword:()=>requireBackupActions().manageProtection(),
    checkUpdate:()=>checkUnsupportedUpdate(),
    applyUpdate:()=>applyPwaUpdateFromUi(),
    connectDevice:()=>connectDeviceBackupWithRecovery(),
    openExecute:()=>goTab('execute',{source:'sync-status'}),
    continueSession:()=>continueSessionOnExecute('sync-status'),
    openData:async()=>{if(!await goTab('library',{source:'sync-status'}))return false;LibraryView.showSection('data');return true;}
  }),
  environment:Object.freeze<SyncStatusHostInput['environment']>({
    window,now:()=>Date.now(),online:()=>navigator.onLine!==false,visible:()=>document.visibilityState==='visible',
    setTimeout:(callback,delay)=>setTimeout(callback,delay),clearTimeout:handle=>{if(handle!==null)clearTimeout(handle);},
    setInterval:(callback,delay)=>setInterval(callback,delay)
  }),
  capture:(scope,error)=>AppDiagnostics.capture(scope,error,'warn')
}));
if(syncStatusPending){syncStatusPending=false;SyncStatusHost.schedule();}
const bindDriveLibrary=ProfileDriveBinding.bind;

// First start (and Add profile): name, an optional password and Google
// Drive. Someone joining their own Drive library takes its name and settings
// from it, so nothing typed here competes with them.
type FirstStartInput=Parameters<typeof ProfilesHostModule.createFirstStart>[0];
const FirstStart=ProfilesHostModule.createFirstStart(Object.freeze<FirstStartInput>({
  document,
  profiles:Profiles,
  backupProtection:Object.freeze({enable:password=>BackupProtection.enable(password)}),
  provider:Object.freeze<FirstStartInput['provider']>({locationStatus:id=>BackupProviderRuntime.locationStatus(id)}),
  connectDriveForProfile:()=>connectDriveForProfile(),
  getStudentName:()=>getStudentNameFromDisplay(),
  isDefaultStudentName,
  applyStudentName,
  persistUserDefaultName,
  renderProfile:()=>renderProfile(),
  reportError:error=>reportProfileActionError(error),
  appCanMutate:()=>appCanMutate()
}));

// A deliberate profile reload must not outrun writes owned by the current
// profile. Page-exit flushing remains a last safety net, not the commit gate.
const ProfileSettlement=ProfilesHostModule.createSettlement({AppOwnership,AppMutationCoordinator:requireMutationCoordinator(),appCanMutate,
 PlanDraftEditor:{flush:options=>PlanDraftEditor.flush(options)},PlanData:{settled:()=>PlanData.settled()},flushPreferences:()=>flushProtectedPreferences(),
 settleAttachmentWriters:()=>LibraryDocuments.settleAttachmentWriters(),deletionRecovery:AppData.deletionRecovery,AppDiagnostics,setPlanStatus:(...args)=>setPlanStatus(...args)
});
async function settleCurrentProfileWriters(){return ProfileSettlement.settleCurrentProfileWriters();}
async function settleCurrentProfileBeforeReload(){return ProfileSettlement.settleCurrentProfileBeforeReload();}
// Startup: make sure this page's profile is on the device's list, and offer
// the first-start form to someone new.
const ProfileLifecycle=ProfilesHostModule.createLifecycle(Object.freeze<Parameters<typeof ProfilesHostModule.createLifecycle>[0]>({
  profiles:Profiles,
  firstStart:FirstStart,
  settleCurrentProfile:()=>settleCurrentProfileBeforeReload(),
  getStudentName:()=>getStudentNameFromDisplay(),
  isDefaultStudentName,
  canonicalLocalRecoveryEmpty:()=>canonicalLocalRecoveryEmpty(),
  renderProfile:()=>renderProfile(),
  appCanMutate:()=>appCanMutate(),
  reportError:error=>reportProfileActionError(error),
  backupProtection:Object.freeze({ask:()=>BackupProtection.ask()}),
  setBackupProtectionSurfaceError:error=>setBackupProtectionSurfaceError(error)
}));
const switchProfile=ProfileLifecycle.switchProfile;
const addProfile=ProfileLifecycle.addProfile;
const startProfile=ProfileLifecycle.startProfile;
const askProfilePassword=ProfileLifecycle.askProfilePassword;

// Version History reads each encrypted version for its date and counts, so a
// password put off at start is asked for first. Not now still opens the list,
// with those versions shown as locked.
function withBackupPassword(open:Parameters<NonNullable<typeof BackupProtectionHost>['withPassword']>[0]){return requireBackupProtectionHost().withPassword(open);}
function onQuoteChange(options:Readonly<{markChanged?:boolean}>={}){
  if(options.markChanged!==false)markDayContentChanged();
  const input=document.getElementById('quote-input');
  if(!(input instanceof HTMLInputElement||input instanceof HTMLTextAreaElement))return;
  const bounded=clampText(input.value,APP_LIMITS.maxQuoteChars);
  if(input.value!==bounded)input.value=bounded;
  const v=bounded.trim();
  const disp=document.getElementById('quote-display');
  if(disp)disp.textContent=v;
  saveQuoteDraft();
}
function tickClock(){
  const n=new Date();
  setTextSafe('clock',n.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}));
  const dd=document.getElementById('day-date');
  const autoDate=todayISO(n);
  // Previous-day Review is an explicit recovery choice, not a live study
  // session eligible for automatic rollover or a surprise Day save.
  if(studyDayRolledOver(n)&&sessionPanelMode!=='previous'){void handleStudyDayRollover();return;}
  if(dd instanceof HTMLInputElement&&dd.dataset['autoDate']==='1'&&dd.value!==autoDate&&!SessionLifecycle.transitioning){
    void SessionLifecycle.run('date-rollover',{date:autoDate,autoDate:true},()=>{
      dd.value=autoDate;return true;
    }).catch(error=>AppDiagnostics.capture('review.auto-date-rollover',error,'warn'));
  }
  maybePromptScheduleEndSave(n);
  void maybePromptBackupNudge();
  if(!maybeAutoStartScheduledBlock(n)){
    if(document.getElementById('pane-plan')?.classList.contains('on'))updateRealTimeAwareness();
    if(document.getElementById('pane-execute')?.classList.contains('on'))refreshExecuteIdleDisplay(n);
  }
}
function updateHeaderInfo(){
  const now=new Date();
  const dowShort=['SUN','MON','TUE','WED','THU','FRI','SAT'][now.getDay()];
  const dowFull=FULL_WEEKDAY_NAMES[now.getDay()];
  const monShort=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][now.getMonth()];
  const monFull=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][now.getMonth()];
  const dd=now.getDate(),yyyy=now.getFullYear();
  const sbDate=document.getElementById('sb-date');if(sbDate)sbDate.textContent=`${dowShort} · ${monShort} ${dd} · ${yyyy}`;
  const statusDate=document.getElementById('status-date');if(statusDate)statusDate.textContent=`${dowShort} ${monShort} ${dd}`;
  const schedTitle=document.getElementById('sched-title');if(schedTitle)schedTitle.textContent=`${dowFull} · ${monFull} ${dd}`;
  const rptDate=document.getElementById('review-date');if(rptDate)rptDate.textContent=`${dowFull} · ${monFull} ${dd}`;
  document.title=`STUDY DIRECTOR · ${monShort} ${dd}`;
  const workBlocks=TASKS.filter(isWorkBlock);
  const totalMin=workBlocks.reduce((a,t)=>a+positiveMinutes(t.dur),0);
  const hrs=Math.round(totalMin/6)/10;
  const hrsLabel=workBlocks.length?`${hrs}H`:'—';
  const blockLabel=workBlocks.length?`${workBlocks.length} BLOCK${workBlocks.length===1?'':'S'}`:'NO SCHEDULE';
  const sbTotal=document.getElementById('sb-total');if(sbTotal)sbTotal.textContent=hrsLabel;
  const statusBlock=document.getElementById('status-block');if(statusBlock)statusBlock.textContent=blockLabel;
  const schedMeta=document.getElementById('sched-meta');if(schedMeta)schedMeta.textContent=workBlocks.length?`${hrsLabel} · ${blockLabel}`:'BUILD TODAY’S PLAN';
}
/* SHELL, PLUGINS, AND TABS */
type NavigationUiInput=Parameters<typeof FoundationHostModule.createNavigation>[0];
const {NAV_HORIZONTAL_MEDIA_QUERY,preferredScrollBehavior,UiTabRegistry,presentTabCommit,prepareTabDeparture,commitTabView,waitForTabReady,goTab}=FoundationHostModule.createNavigation(Object.freeze<NavigationUiInput>({document,window,clampText,controller:()=>NavigationController,
  library:()=>Object.freeze({settleDiary:()=>LibraryView.settleDiary(),deactivate:options=>LibraryView.deactivate(options),activate:options=>LibraryView.activate(options.restoreScroll===undefined?{immediateScroll:options.immediateScroll}:{immediateScroll:options.immediateScroll,restoreScroll:options.restoreScroll})}),
  review:()=>Object.freeze({deactivate:()=>ReviewView.deactivate(),activate:options=>ReviewView.activate(options.restoreScroll===undefined?{immediateScroll:options.immediateScroll}:{immediateScroll:options.immediateScroll,restoreScroll:options.restoreScroll})}),
  attachments:()=>Object.freeze({close:()=>requireAttachmentLibrary().close(),refresh:()=>requireAttachmentLibrary().refresh()}),reviewEditor:()=>ReviewEditor,
  flushPendingReviewSave:(...args)=>flushPendingReviewSave(...args),setStatus:(...args)=>setStatus(...args),clearPreview:tab=>PreviewRuntime.clearExcept(tab),refreshPnote:(...args)=>refreshPnote(...args),updateCD:(...args)=>updateCD(...args),isLiveTrackableTimer:(...args)=>isLiveTrackableTimer(...args),refreshExecuteIdleDisplay:(...args)=>refreshExecuteIdleDisplay(...args),
  paused:()=>TimerState.paused,updateBreakMeter:(...args)=>updateBreakMeter(...args),renderPacer:()=>PracticePacer.render(),startTimerPresentation:()=>TimerPresentation.start(),stopTimerPresentation:()=>TimerPresentation.stop(),
  renderScheduleOnPlanOpen:(...args)=>renderScheduleOnPlanOpen(...args),updateRealTimeAwareness:(...args)=>updateRealTimeAwareness(...args),requestPluginTab:tab=>PluginRuntime.requestTab(tab),applyOwnership:()=>OwnershipUiProjection.apply(),richTextSyncAll:(...args)=>richTextSyncAll(...args)}));


const STUDY_DIRECTOR_READY_EVENT='studydirector:ready';
const OPTIONAL_PLUGIN_DESCRIPTORS=Object.freeze([
  Object.freeze({tabId:'guide',label:'Guide',icon:'?',src:'@@SD_EXTERNAL_GUIDE_FILENAME@@',pluginName:'SD-guide'}),
  Object.freeze({tabId:'insights',label:'Insights',icon:'✦',src:'@@SD_EXTERNAL_INSIGHTS_FILENAME@@',pluginName:'SD-insights'})
]);
type PluginRuntimeInput=Parameters<typeof PublicApiHostModule.createRuntime>[0];
const PluginRuntime=PublicApiHostModule.createRuntime(Object.freeze<PluginRuntimeInput>({
  configuration:Object.freeze<PluginRuntimeInput['configuration']>({capabilities:STUDY_DIRECTOR_CAPABILITIES,descriptors:OPTIONAL_PLUGIN_DESCRIPTORS}),
  environment:Object.freeze<PluginRuntimeInput['environment']>({document,trustedAssetURL:value=>trustedAssetURL(value)}),
  tabs:Object.freeze<PluginRuntimeInput['tabs']>({registerTab:config=>UiTabRegistry.registerTab(config),renderTab:id=>UiTabRegistry.renderTab(id)}),
  preview:Object.freeze<PluginRuntimeInput['preview']>({registerProvider:(target,provider)=>PreviewRuntime.registerProvider(target,provider)}),
  clampText
}));
const InsightsPreload=InsightsHostModule.createPreloadScheduler(Object.freeze<Parameters<typeof InsightsHostModule.createPreloadScheduler>[0]>({
  document,
  setTimer:(callback,delayMs)=>setTimeout(callback,delayMs),
  scheduleIdle:typeof requestIdleCallback==='function'
    ?(callback,timeoutMs)=>requestIdleCallback(callback,{timeout:timeoutMs})
    :null,
  requestTab:()=>PluginRuntime.requestTab('insights')??Promise.resolve(false)
}));
if(location.protocol==='file:'){
  const notice=document.createElement('div');notice.className='ui-status err';notice.setAttribute('role','alert');
  notice.textContent='This copy was opened directly from index.html. Attachments and worker-based backups need the local launcher or hosted app. Close this copy and open Start-Study-Director in the deployment folder.';
  document.querySelector('main')?.prepend(notice);
}
// Local, bounded diagnostics: never record document samples, URLs or note text.
const trustedTypeViolations=new Map<string,number>();
document.addEventListener('securitypolicyviolation',event=>{
  if(!['trusted-types','require-trusted-types-for'].includes(event.effectiveDirective))return;
  const key=event.effectiveDirective+':'+(['enforce','report'].includes(event.disposition)?event.disposition:'unknown');
  if(!trustedTypeViolations.has(key))AppDiagnostics.capture('security.trusted-types',new Error('Trusted Types boundary requires review: '+key));
  trustedTypeViolations.set(key,Math.min(1000,(trustedTypeViolations.get(key)||0)+1));
});
const trustedAssetURL=(()=>{
  const allowed=new Set(['@@SD_EXTERNAL_GUIDE_FILENAME@@','@@SD_EXTERNAL_INSIGHTS_FILENAME@@','@@SD_EXPORT_WORKER_FILENAME@@','@@SD_SEARCH_WORKER_FILENAME@@','@@SD_IMAGE_WORKER_FILENAME@@','@@SD_ATTACHMENT_WORKER_FILENAME@@','./sw.js'].map(value=>new URL(value,location.href).href));
  const validate=(value:string)=>{const url=new URL(value,location.href).href;if(!allowed.has(url))throw new TypeError('Unapproved application script.');return url;};
  type TrustedTypesFactory=Readonly<{createPolicy(name:string,rules:Readonly<{createScriptURL(value:string):string}>):Readonly<{createScriptURL(value:string):string}>}>;
  const trustedTypes=(globalThis as typeof globalThis&{trustedTypes?:TrustedTypesFactory}).trustedTypes;
  const policy=trustedTypes?.createPolicy('sd-assets',{createScriptURL:validate});
  return (value:string)=>policy?policy.createScriptURL(value):validate(value);
})();

function fullscreenAvailable(){
  const standalone=(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)||(navigator as Navigator&{standalone?:boolean}).standalone===true;
  return document.fullscreenEnabled===true&&typeof document.documentElement.requestFullscreen==='function'&&!standalone;
}
function updateFullscreenButton(){
  const btn=document.getElementById('fs-btn');
  const available=fullscreenAvailable();
  if(!btn)return;
  btn.hidden=!available;
  if(available){
    const active=!!document.fullscreenElement;
    btn.textContent=active?'✕':'⛶';
    btn.setAttribute('aria-label',active?'Exit fullscreen':'Enter fullscreen');
    btn.title=active?'Exit fullscreen':'Enter fullscreen';
  }
}
function renderThemeControls(){return requirePresentationRuntime().renderThemeControls();}
function applyTheme(themeId:Parameters<PresentationController['applyTheme']>[0],options:Parameters<PresentationController['applyTheme']>[1]={}){return requirePresentationRuntime().applyTheme(themeId,options);}
function setTheme(themeId:Parameters<PresentationController['setTheme']>[0],options:Parameters<PresentationController['setTheme']>[1]={}){return requirePresentationRuntime().setTheme(themeId,options);}
function handleThemeSelection(event:Parameters<PresentationController['handleThemeSelection']>[0]){return requirePresentationRuntime().handleThemeSelection(event);}
function renderPresentationControls(){return requirePresentationRuntime().renderPresentationControls();}
function applyPresentation(presentationId:Parameters<PresentationController['applyPresentation']>[0],options:Parameters<PresentationController['applyPresentation']>[1]={}){return requirePresentationRuntime().applyPresentation(presentationId,options);}
function setPresentation(presentationId:Parameters<PresentationController['setPresentation']>[0],options:Parameters<PresentationController['setPresentation']>[1]={}){return requirePresentationRuntime().setPresentation(presentationId,options);}
function registerPresentationPack(definition:Parameters<PresentationController['registerPresentation']>[0]){return requirePresentationRuntime().registerPresentation(definition);}
function handlePresentationSelection(event:Parameters<PresentationController['handlePresentationSelection']>[0]){return requirePresentationRuntime().handlePresentationSelection(event);}
function normalizeFontScale(value:Parameters<PresentationController['normalizeFontScale']>[0]){return requirePresentationRuntime().normalizeFontScale(value);}
function readFontScale(){return requirePresentationRuntime().readFontScale();}
function applyFontScale(value:Parameters<PresentationController['applyFontScale']>[0]){return requirePresentationRuntime().applyFontScale(value);}
function setFontScale(value:Parameters<PresentationController['setFontScale']>[0]){return requirePresentationRuntime().setFontScale(value);}
function stepFontScale(delta:Parameters<PresentationController['stepFontScale']>[0]){return requirePresentationRuntime().stepFontScale(delta);}
function toggleDisplayTools(){return requirePresentationRuntime().toggleDisplayTools();}
function toggleFS(){
  if(!fullscreenAvailable())return;
  const action=document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();
  void action.catch(error=>AppDiagnostics.capture('ui.fullscreen',error));
  updateFullscreenButton();
}
function shouldIgnoreFullscreenDblClick(target:Element|null){
  if(!target||!target.closest||!target.closest('.app'))return true;
  if(target.closest('button,input,textarea,select,a,summary,label,[contenteditable="true"],[data-action],[data-tab]'))return true;
  if(target.closest('dialog,#gap-overlay,#nudge-overlay,.execute-state-overlay,.nav-item,.plan-draft-row,.sched-row,.rcard,.library-day'))return true;
  if(target.closest('span,code,pre,.ui-label,.ui-body,.ui-mono,.plan-header,.library-title,.review-date,.rt-value'))return true;
  return false;
}
function handleFullscreenDblClick(ev:MouseEvent){
  if((window.matchMedia&&window.matchMedia('(hover:none) and (pointer:coarse)').matches)||!appCanMutate()||shouldIgnoreFullscreenDblClick(ev.target instanceof Element?ev.target:null))return;
  ev.preventDefault();
  toggleFS();
}
function clockHM(d=new Date()){
  return d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:false});
}
function clockHMS(d=new Date()){
  return d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
}
function timeLabelFromIso(iso:unknown):string|null{
  if(!iso)return null;
  try{return clockHM(new Date(String(iso)));}catch(e){return null;}
}
function shortTaskLabel(t:Task|undefined){
  if(!t)return '—';
  const prefix=isFixedBlock(t)?(taskAreaValue(t)||'fixed').toUpperCase()+': ':'';
  return prefix+t.name;
}
function realTimeAwarenessKey(...args:Parameters<typeof ExecutionViews.realTimeAwarenessKey>){return ExecutionViews.realTimeAwarenessKey(...args);}
function realTimeElements(...args:Parameters<typeof ExecutionViews.realTimeElements>){return ExecutionViews.realTimeElements(...args);}
function updateRealTimeAwareness(...args:Parameters<typeof ExecutionViews.updateRealTimeAwareness>){return ExecutionViews.updateRealTimeAwareness(...args);}
type RenderKey='schedule'|'badges'|'header'|'realtime'|'recovery';
const renderQueue=new Set<RenderKey>();
let renderQueueFrame=0;
const markScheduleRenderDirty=()=>PlanRuntime.markRenderDirty();
const renderScheduleIfVisible=()=>PlanRuntime.renderIfVisible();
const renderScheduleOnPlanOpen=()=>PlanRuntime.renderOnOpen();
const RENDER_ORDER:readonly RenderKey[]=['schedule','badges','header','realtime','recovery'];
const RENDER_HANDLERS:Readonly<Record<RenderKey,()=>unknown>>={
  schedule:()=>renderScheduleIfVisible(),
  badges:()=>updateBadges(),
  header:()=>updateHeaderInfo(),
  realtime:()=>updateRealTimeAwareness(),
  recovery:()=>renderRecoveryReview()
};
function flushRenderQueue(){
  renderQueueFrame=0;
  const pending=new Set(renderQueue);
  renderQueue.clear();
  RENDER_ORDER.forEach(key=>{if(pending.has(key))RENDER_HANDLERS[key]();});
}
function requestRender(...keys:RenderKey[]){
  keys.flat().forEach(key=>{
    if(!RENDER_HANDLERS[key])return;
    if(key==='schedule')markScheduleRenderDirty();
    renderQueue.add(key);
  });
  if(!renderQueueFrame)renderQueueFrame=requestAnimationFrame(flushRenderQueue);
}
function refreshCoreUi(options:Readonly<{header?:boolean}>={}){
  renderSched();
  updateBadges();
  if(options.header)updateHeaderInfo();
  PracticePacer.render();
  OwnershipUiProjection.apply();
}
let protectedMutationUiReconcileQueued=false;
function reconcileProtectedMutationUi(){
  if(AppMutationCoordinator?.blocksUi()||!AppOwnership.canMutate())return false;
  try{renderSched();PlanRuntime.savedPlans.syncAccess();}catch(error){AppDiagnostics.capture('mutation-ui.plan',error,'warn');}
  try{setExecuteControlsEnabled(isLiveTrackableTimer());updateSessionControls();PracticePacer.render();}catch(error){AppDiagnostics.capture('mutation-ui.execute',error,'warn');}
  try{ReviewView.syncMode();if(document.getElementById('pane-review')?.classList.contains('on'))ReviewView.refresh({force:true});}catch(error){AppDiagnostics.capture('mutation-ui.review',error,'warn');}
  try{LibraryView.refreshNotes();if(document.getElementById('pane-library')?.classList.contains('on')){LibraryView.requestRender();void requireAttachmentLibrary().refresh();}}catch(error){AppDiagnostics.capture('mutation-ui.library',error,'warn');}
  try{OwnershipUiProjection.apply();}catch(error){AppDiagnostics.capture('mutation-ui.ownership',error,'warn');}
  return true;
}
function queueProtectedMutationUiReconcile(){
  if(protectedMutationUiReconcileQueued)return false;
  protectedMutationUiReconcileQueued=true;
  queueMicrotask(()=>{protectedMutationUiReconcileQueued=false;reconcileProtectedMutationUi();});
  return true;
}
/* TIMER RECOVERY ACTIONS AND UNFINISHED NOTE DRAFT */
function recoverySetStatus(...args:Parameters<typeof ExecutionViews.recoverySetStatus>){return ExecutionViews.recoverySetStatus(...args);}

function recoveryTargetTrackableIdx(...args:Parameters<typeof ExecutionViews.recoveryTargetTrackableIdx>){return ExecutionViews.recoveryTargetTrackableIdx(...args);}
function recoveryFallbackTrackableIdx(...args:Parameters<typeof ExecutionViews.recoveryFallbackTrackableIdx>){return ExecutionViews.recoveryFallbackTrackableIdx(...args);}
function renderRecoveryTarget(...args:Parameters<typeof ExecutionViews.renderRecoveryTarget>){return ExecutionViews.renderRecoveryTarget(...args);}
function recoveryStartTimerAt(...args:Parameters<typeof ExecutionViews.recoveryStartTimerAt>){return ExecutionViews.recoveryStartTimerAt(...args);}
function recoveryJumpToScheduledNow(...args:Parameters<typeof ExecutionViews.recoveryJumpToScheduledNow>){return ExecutionViews.recoveryJumpToScheduledNow(...args);}
function recoveryStartScheduledFull(...args:Parameters<typeof ExecutionViews.recoveryStartScheduledFull>){return ExecutionViews.recoveryStartScheduledFull(...args);}
function recoveryStartRemainingWindow(...args:Parameters<typeof ExecutionViews.recoveryStartRemainingWindow>){return ExecutionViews.recoveryStartRemainingWindow(...args);}
function recoveryShiftStartIndex(...args:Parameters<typeof ExecutionViews.recoveryShiftStartIndex>){return ExecutionViews.recoveryShiftStartIndex(...args);}
function deriveRecoveryShiftPlan(...args:Parameters<typeof ExecutionViews.deriveRecoveryShiftPlan>){return ExecutionViews.deriveRecoveryShiftPlan(...args);}
function applyRecoveryShiftPlan(...args:Parameters<typeof ExecutionViews.applyRecoveryShiftPlan>){return ExecutionViews.applyRecoveryShiftPlan(...args);}
function recoveryShiftOverflowText(...args:Parameters<typeof ExecutionViews.recoveryShiftOverflowText>){return ExecutionViews.recoveryShiftOverflowText(...args);}
function finishRecoveryShiftPlan(...args:Parameters<typeof ExecutionViews.finishRecoveryShiftPlan>){return ExecutionViews.finishRecoveryShiftPlan(...args);}
function recoveryShiftRemainingDay(...args:Parameters<typeof ExecutionViews.recoveryShiftRemainingDay>){return ExecutionViews.recoveryShiftRemainingDay(...args);}
function recoveryCarryForwardItems(...args:Parameters<typeof ExecutionViews.recoveryCarryForwardItems>){return ExecutionViews.recoveryCarryForwardItems(...args);}
function buildCarryForwardText(...args:Parameters<typeof ExecutionViews.buildCarryForwardText>){return ExecutionViews.buildCarryForwardText(...args);}
function setCarryForwardDraft(...args:Parameters<typeof ExecutionViews.setCarryForwardDraft>){return ExecutionViews.setCarryForwardDraft(...args);}
function recoveryGenerateCarryForward(...args:Parameters<typeof ExecutionViews.recoveryGenerateCarryForward>){return ExecutionViews.recoveryGenerateCarryForward(...args);}
function syncUnfinishedNoteDraft(...args:Parameters<typeof ExecutionViews.syncUnfinishedNoteDraft>){return ExecutionViews.syncUnfinishedNoteDraft(...args);}
function copyCarryForward(...args:Parameters<typeof ExecutionViews.copyCarryForward>){return ExecutionViews.copyCarryForward(...args);}
function unfinishedNoteDraftText(...args:Parameters<typeof ExecutionViews.unfinishedNoteDraftText>){return ExecutionViews.unfinishedNoteDraftText(...args);}
function closeUnfinishedNotePanel(...args:Parameters<typeof ExecutionViews.closeUnfinishedNotePanel>){return ExecutionViews.closeUnfinishedNotePanel(...args);}
function renderRecoveryReview(...args:Parameters<typeof ExecutionViews.renderRecoveryReview>){return ExecutionViews.renderRecoveryReview(...args);}
/* TASK PROGRESS AND ONGOING NOTE EDITORS */
function getTaskCompletion(idx:number){
  return resolveTaskCompletion(idx).pct;
}
function commitTaskNoteEditor(field:HTMLTextAreaElement,value:unknown,event:Event|null=null){return notesRuntime().commitEditor(field,value,event);}
/* DAILY REFLECTION + DIARY PERSISTENCE · P5.5B CHECKED OWNER */
type ReviewPersistenceInput=Parameters<typeof ReviewPersistenceModule.createPersistence>[0];
const ReviewPersistence=ReviewPersistenceModule.createPersistence(Object.freeze<ReviewPersistenceInput>({
  configuration:Object.freeze<ReviewPersistenceInput['configuration']>({limits:APP_LIMITS,dataContract:DATA_CONTRACT}),
  records:Object.freeze<ReviewPersistenceInput['records']>({
    get:(...args)=>AppData.dailyRecords.get(...args),
    save:(...args)=>AppData.dailyRecords.save(...args),
    remove:(...args)=>AppData.dailyRecords.remove(...args),
    verifyCanonical:(...args)=>AppData.dailyRecords.verifyCanonical(...args),
    verifyCanonicalAbsent:(...args)=>AppData.dailyRecords.verifyCanonicalAbsent(...args),
    timestamp:(...args)=>AppData.dailyRecords.timestamp(...args)
  }),
  codec:Object.freeze<ReviewPersistenceInput['codec']>({createDiaryRecord}),
  ownership:Object.freeze<ReviewPersistenceInput['ownership']>({canMutate:()=>appCanMutate(),revision:()=>AppOwnership.revision}),
  text:Object.freeze<ReviewPersistenceInput['text']>({clampEditorContent,editorContentWithinLimits,plain:plainTextContent,isRich:value=>RichTextApi.isRichTextValue(value)}),
  richText:Object.freeze<ReviewPersistenceInput['richText']>({
    closeField:field=>richTextCloseField(field),syncField:field=>richTextSyncField(field),
    validatedInput:(event,field)=>validatedRichInputMeta(event,field)
  }),
  dates:Object.freeze<ReviewPersistenceInput['dates']>({isSupported:isSupportedSavedDate,insights:dateInsightsMeta}),
  saveLane:SaveLaneModule,
  environment:Object.freeze<ReviewPersistenceInput['environment']>({nowIso:()=>new Date().toISOString(),queueMicrotask,setTimeout,clearTimeout})
}));
const {DailyReflectionPersistence,DiaryEditor:LibraryDiaryEditor}=ReviewPersistence;
/* RICH TEXT */
function richTextDocumentFor(field:HTMLTextAreaElement,options:Readonly<{requireVisible?:boolean;editable?:boolean}>={}){
  if(!(field instanceof HTMLTextAreaElement)||!field.isConnected)return null;
  const editable=options.editable!==false,requireVisible=options.requireVisible!==false;
  if(editable&&(field.disabled||field.readOnly||!appCanMutate()))return null;
  if(field.matches('.library-diary-textarea'))return LibraryDiaryEditor.documentFor(field);
  if(field.id==='daily-reflection'){
    const date=getReviewDate();
    if(!isValidIsoDate(date))return null;
    return Object.freeze({documentId:`reflection:${date}`,label:`Daily reflection for ${date}`,initialValue:ReviewEditor.contentForDate(date),maxWords:APP_LIMITS.maxRichTextWords,surface:'reflection'});
  }
  if(field.matches('.task-note-field')){
    const binding=editable?resolveTaskNoteEditorBinding(field,{requireVisible}):(()=>{const areaKey=normalizeAreaName(field.dataset['areaKey']);return areaKey?Object.freeze({areaKey,areaLabel:displayAreaName(field.dataset['areaLabel']||areaKey)}):null;})();
    if(!binding)return null;
    return Object.freeze({documentId:`area:${binding.areaKey}`,label:`Note for ${binding.areaLabel}`,initialValue:noteStoredValueForKey(binding.areaKey),maxWords:APP_LIMITS.maxRichTextWords,surface:field.id==='pn-extra'?'execute-note':'note'});
  }
  return null;
}
// Links between notes: the one note picker and the linked-notes bar.
type NoteLinksInput=Parameters<typeof NoteLinksModule.createController>[0];
const NoteLinks=NoteLinksModule.createController(Object.freeze<NoteLinksInput>({ports:Object.freeze<NoteLinksInput['ports']>({
  view:Object.freeze<NoteLinksInput['ports']['view']>({document}),
  notes:Object.freeze<NoteLinksInput['ports']['notes']>({documents:()=>AppData.notes.searchSnapshot(),get:ref=>AppData.notes.get(ref),link:(ref,id,options)=>AppData.notes.link(ref,id,options),linkedFrom:ref=>AppData.notes.linkedFrom(ref),list:()=>AppData.notes.metadataSnapshot().records}),
  text:Object.freeze<NoteLinksInput['ports']['text']>({tagsIn:value=>RichTextApi.tagsIn(value)}),
  ownership:Object.freeze<NoteLinksInput['ports']['ownership']>({canMutate:()=>appCanMutate(),revision:()=>AppOwnership.revision})
})}));
// Checked P5.6B navigation keeps link context with the rich-text surface while
// deferring Library access until a user actually follows a link or tag.
type NoteLinkNavigationInput=Parameters<typeof NoteLinksModule.createNavigation>[0];
const NoteLinkNavigation=NoteLinksModule.createNavigation(Object.freeze<NoteLinkNavigationInput>({
  controller:NoteLinks,
  notes:Object.freeze<NoteLinkNavigationInput['notes']>({get:ref=>AppData.notes.get(ref)}),
  execution:Object.freeze<NoteLinkNavigationInput['execution']>({
    isLiveTrackableTimer:()=>isLiveTrackableTimer(),
    current:()=>{
      const index=TimerState.currentIndex,task=TASKS[index];
      return Object.freeze({task,taskId:TaskIdentity.idAt(index),ownNote:task&&hasOngoingTaskNotes(task)?AppData.notes.get(noteKeyForTask(task)):null});
    },
    open:(id,taskId,ownNote)=>openExecuteNote(id,taskId,ownNote)
  }),
  library:Object.freeze<NoteLinkNavigationInput['library']>({
    open:()=>goTab('library',{source:'note-link'}),
    reveal:ref=>LibraryView.revealNoteReference(ref),
    filterTag:(name,options)=>LibraryView.filterTag(name,options)
  })
}));
const openLinkedNote=NoteLinkNavigation.open;
const richTextNotes=NoteLinkNavigation.richText;
const showNotesTagged=NoteLinkNavigation.showTagged;
// Renames a tag in every note that has it, then saves. A note that changed
// meanwhile is left as it is and named in the result.
function renameNoteTag(...args:Parameters<ReturnType<typeof NotesHostModule.createController>['renameTag']>){return notesRuntime().renameTag(...args);}
function importNoteFiles(...args:Parameters<ReturnType<typeof NotesHostModule.createController>['importFiles']>){return notesRuntime().importFiles(...args);}
type RichTextRuntimeInput=Parameters<typeof RichTextHostModule.createRuntime>[0];
const RichTextRuntime=RichTextHostModule.createRuntime(Object.freeze<RichTextRuntimeInput>({
  configuration:Object.freeze<RichTextRuntimeInput['configuration']>({maxRichTextBytes:APP_LIMITS.maxRichTextBytes}),document,window,
  richText:RichTextApi,assets:RichTextAssets,
  attachments:Object.freeze<RichTextRuntimeInput['attachments']>({
    port:()=>RichTextAttachmentPort,
    createImageWorker:()=>new Worker(trustedAssetURL('@@SD_IMAGE_WORKER_FILENAME@@'),{name:'study-director-image'}),
    workspaceOverlay:RichTextWorkspaceOverlay as WorkspaceOverlayPort,
    onBusy:busy=>{imagePreparationCount+=busy?1:-1;if(busy)pwaWorkRevision++;else schedulePwaUpdateEvaluation(250);}
  }),
  notes:Object.freeze<RichTextRuntimeInput['notes']>({
    repository:AppData.notes,links:field=>richTextNotes(field),normalizeArea:normalizeAreaName,
    setSyncState:(key,state)=>setNoteSyncStateForKey(key,state),updateSearchText:(key,plain)=>updateNoteSearchText(key,plain)
  }),
  review:Object.freeze<RichTextRuntimeInput['review']>({date:()=>getReviewDate(),flushPending:options=>ReviewEditor.flushPending(options),settled:()=>ReviewEditor.settled()}),
  session:Object.freeze<RichTextRuntimeInput['session']>({settled:()=>AppData.activeSession.settled()}),
  view:Object.freeze<RichTextRuntimeInput['view']>({
    documentFor:(field,options)=>richTextDocumentFor(field,options),render:(container,value,emptyText,label)=>renderRichTextContent(container,value,emptyText,label),
    plain:value=>plainTextContent(value),visible:field=>taskNoteEditorIsVisible(field),validatedInput:(event,field)=>validatedRichInputMeta(event,field),
    applyOwnership:root=>OwnershipUiProjection.apply(root)
  }),
  activation:Object.freeze<RichTextRuntimeInput['activation']>({kinds:APP_ACTIVATION_KINDS,subscribe:callback=>AppActivation.subscribe(callback)}),
  diagnostics:Object.freeze<RichTextRuntimeInput['diagnostics']>({capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level)})
}));
if(!Object.isFrozen(RichTextRuntime)||RichTextRuntime.format!=='study-director.rich-text-runtime'||RichTextRuntime.contractVersion!==1){
  throw new Error('Study Director rich-text host runtime is unavailable or incompatible.');
}
SaveLaneModule.onBeforeFlush(()=>RichTextRuntime.flushEditors());
type RecoveryQuiescenceInput=Parameters<typeof BackupRecoveryHostModule.createQuiescence>[0];
ManagedRecoveryQuiescence=BackupRecoveryHostModule.createQuiescence(Object.freeze<RecoveryQuiescenceInput>({
  cancelPendingLiveDraftSave:()=>cancelPendingLiveDraftSave(),
  clock:Object.freeze<RecoveryQuiescenceInput['clock']>({nowMs:()=>DecisionClock.nowMs()}),
  timer:Object.freeze({stopExecution:()=>TimerEngine.stopExecution(),resumeAfterPrimaryRestore:options=>TimerEngine.resumeAfterPrimaryRestore(options)}),
  richText:Object.freeze<RecoveryQuiescenceInput['richText']>({quiesce:operation=>RichTextRuntime.quiesce(operation)}),
  mutation:Object.freeze<RecoveryQuiescenceInput['mutation']>({settled:()=>requireMutationCoordinator().settled(),active:()=>!!requireMutationCoordinator().status().active}),
  handoff:Object.freeze<RecoveryQuiescenceInput['handoff']>({frozen:()=>!!SessionHandoffRuntime?.frozen()}),
  diagnostics:Object.freeze<RecoveryQuiescenceInput['diagnostics']>({capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level)})
}));
if(!Object.isFrozen(ManagedRecoveryQuiescence)||ManagedRecoveryQuiescence.format!=='study-director.recovery-quiescence'||ManagedRecoveryQuiescence.contractVersion!==1){
  throw new Error('Study Director recovery quiescence is unavailable or incompatible.');
}
richTextClose=()=>RichTextRuntime.close();
richTextCloseField=field=>RichTextRuntime.closeField(field);
richTextSyncField=field=>RichTextRuntime.syncField(field);
richTextSyncAll=()=>RichTextRuntime.syncAll(document);
richTextReconcileExternal=(field,canonical,revision)=>RichTextRuntime.reconcileExternal(field,canonical,revision);
type NotesControllerInput=Parameters<typeof NotesHostModule.createController>[0];
NotesRuntime=NotesHostModule.createController(Object.freeze<NotesControllerInput>({
  configuration:Object.freeze<NotesControllerInput['configuration']>({
    maxAreaNameChars:APP_LIMITS.maxAreaNameChars,maxNoteChars:APP_LIMITS.maxNoteChars,maxNotes:APP_LIMITS.maxNotes,
    maxRichTextWords:APP_LIMITS.maxRichTextWords,maxRichTextBytes:APP_LIMITS.maxRichTextBytes,supportNote:SUPPORT_NOTE
  }),
  repository:AppData.notes,
  tasks:()=>TASKS,
  taskIdentity:Object.freeze<NotesControllerInput['taskIdentity']>({
    validIndex:value=>TaskIdentity.validIndex(value),idAt:index=>TaskIdentity.idAt(index),indexForId:id=>TaskIdentity.indexForId(id),
    scheduleRevision:()=>taskNoteScheduleRevision
  }),
  domain:Object.freeze<NotesControllerInput['domain']>({
    normalizeAreaName,displayAreaName,areaParentKeys,clampText,hasOngoingTaskNotes,noteKeyForTask,noteLabelForTask,isSupportBlock,isTrackableBlock
  }),
  lifecycle:Object.freeze<NotesControllerInput['lifecycle']>({canWrite:()=>SessionLifecycle.canWrite(),revision:()=>SessionLifecycle.revision}),
  ownership:Object.freeze<NotesControllerInput['ownership']>({canMutate:()=>appCanMutate(),revision:()=>AppOwnership.revision}),
  richText:Object.freeze<NotesControllerInput['richText']>({
    closeField:field=>RichTextRuntime.closeField(field),syncField:field=>RichTextRuntime.syncField(field),
    reconcileExternal:(field,canonical,revision)=>RichTextRuntime.reconcileExternal(field,canonical,revision),
    validatedInput:(event,field)=>validatedRichInputMeta(event,field),plain:plainTextContent,
    isRich:value=>RichTextApi.isRichTextValue(String(value??'')),
    render:(container,value,empty,label)=>renderRichTextContent(container,value,empty,label),
    normalizeTag:value=>RichTextApi.normalizeTag(value),renameTag:(value,from,to)=>RichTextApi.renameTag(value,from,to),
    fromText:value=>RichTextApi.fromText(value),fromMarkdown:value=>RichTextApi.fromMarkdown(value),
    quiesce:operation=>RichTextRuntime.quiesce(operation)
  }),
  tags:Object.freeze<NotesControllerInput['tags']>({tagged:names=>NoteLinks.tagged(names)}),
  mutation:Object.freeze<NotesControllerInput['mutation']>({runExclusive:(name,operation)=>requireMutationCoordinator().runExclusive(name,operation)}),
  view:Object.freeze<NotesControllerInput['view']>({
    document,currentTaskIndex:()=>TimerState.currentIndex,saveLiveDraft:()=>saveLiveDraft(),
    updateSearchText:(key,plain)=>updateNoteSearchText(key,plain),refreshExecute:()=>refreshPnote(),refreshLibrary:()=>refreshLibraryNotes(),
    requestScheduleRender:()=>requestRender('schedule'),
    refreshReviewIfVisible:()=>document.getElementById('pane-review')?.classList.contains('on')?ReviewView.refresh():false,
    refreshRecovery:()=>document.getElementById('recovery-carry-text')?renderRecoveryReview():false,
    setStatus:(...args)=>setStatus(...args),setPlanStatus:(...args)=>setPlanStatus(...args),
    publishSafetyNotice:(...args)=>publishSafetyNotice(...args),syncPopover:element=>NoteSyncPopover.refresh(element)
  }),
  diagnostics:Object.freeze<NotesControllerInput['diagnostics']>({capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level)}),
  environment:Object.freeze<NotesControllerInput['environment']>({queueMicrotask:callback=>queueMicrotask(callback)})
}));
if(!Object.isFrozen(NotesRuntime)||NotesRuntime.format!=='study-director.notes-runtime'||NotesRuntime.contractVersion!==1){
  throw new Error('Study Director notes runtime is unavailable or incompatible.');
}
/* PERSONAL PLAN DOCUMENTS · checked host persistence/default adapter */
type PlanDataInput=Parameters<typeof PlanHostModule.createData>[0];
const PlanData=PlanHostModule.createData(Object.freeze<PlanDataInput>({
  codec:PersonalDataCodec,
  repositories:Object.freeze<PlanDataInput['repositories']>({
    plans:Object.freeze<PlanDataInput['repositories']['plans']>({
      read:()=>AppData.planData.read(),
      replace:value=>AppData.planData.replace(value),
      replacePortable:value=>AppData.planData.replacePortable(value),
      writeDraft:(value,options)=>AppData.planData.writeDraft(value,options),
      writeLibrary:(value,options)=>AppData.planData.writeLibrary(value,options)
    }),
    preferences:Object.freeze<PlanDataInput['repositories']['preferences']>({read:()=>AppData.personalPreferences.read()})
  }),
  ownership:Object.freeze<PlanDataInput['ownership']>({
    issueWriteToken:(reason,options)=>AppOwnership.issueWriteToken(reason,options),
    assertWriteToken:(token,reason)=>AppOwnership.assertWriteToken(token,reason)
  }),
  storage:Object.freeze<PlanDataInput['storage']>({markError:(surface,message)=>markStorageHealthError(surface,message)}),
  preferences:Object.freeze<PlanDataInput['preferences']>({
    fallback:()=>protectedPreferencesState,
    flush:options=>flushProtectedPreferences(options),
    accept:value=>acceptProtectedPreferences(value),
    refreshAppearance:value=>refreshAppearanceMirrors(value),
    applyRuntime:value=>applyPortablePreferencesToRuntime(value),
    studentName:()=>readUserDefaults()?.studentName||null
  }),
  runtime:Object.freeze<PlanDataInput['runtime']>({
    canMutate:()=>appCanMutate(),
    flushDraft:options=>PlanDraftEditor.flush(options),
    replaceDraftText:value=>{const input=document.getElementById('plan-input');if(input instanceof HTMLTextAreaElement)input.value=value;},
    previewDraft:()=>PlanDraftEditor.preview({silent:true,enterDraft:false}),
    renderSavedPlans:()=>PlanRuntime.savedPlans.render()
  }),
  defaults:Object.freeze<PlanDataInput['defaults']>({factory:Object.freeze<PlanDataInput['defaults']['factory']>({studentName:FACTORY_DEFAULTS.studentName,scheduleText:FACTORY_DEFAULTS.scheduleText})})
}));

/* PLAN MODULE COMPOSITION */
type PlanControllerInput=Parameters<typeof PlanHostModule.createController>[0];
const PlanRuntime=PlanHostModule.createController(Object.freeze<PlanControllerInput>({
  module:PlanModule,
  data:PlanData,
  ports:Object.freeze<PlanControllerInput['ports']>({
    configuration:Object.freeze<PlanControllerInput['ports']['configuration']>({limits:Object.freeze({
      maxStatusMessageChars:APP_LIMITS.maxStatusMessageChars,
      maxDurationMinutes:APP_LIMITS.maxDurationMinutes,
      maxScheduleChars:APP_LIMITS.maxScheduleChars,
      maxTaskNameChars:APP_LIMITS.maxTaskNameChars,
      maxAreaNameChars:APP_LIMITS.maxAreaNameChars,
      maxUnitChars:APP_LIMITS.maxUnitChars
    })}),
    persistence:Object.freeze<PlanControllerInput['ports']['persistence']>({
      lastError:()=>AppData.lastStorageError,
      reportDraftResult:(ok,error)=>{
        if(ok)markStorageHealthOk('planDraft.write');
        else{const detail=error instanceof Error?error.message:String(error||'browser storage is unavailable');markStorageHealthError('planDraft.write',`Plan draft was not saved: ${detail}. Keep this tab open and copy the draft before closing.`);}
      }
    }),
    defaults:Object.freeze<PlanControllerInput['ports']['defaults']>({applyStudentName}),
    domain:Object.freeze<PlanControllerInput['ports']['domain']>({
      clampText,fmtDur,fmtS,hasOngoingTaskNotes,isFixedBlock,isSupportBlock,isTrackableBlock,isWorkBlock,
      makeScheduleRow,normalizeScheduleKind,normalizeScheduleTarget,positiveMinutes,scheduleFingerprintForRows,
      scheduleToken,scheduleWarningsMessage,taskAreaKey:noteKeyForTask,taskAreaValue,taskMeasureValue,taskTargetValue,noteTextForKey
    }),
    parser:Object.freeze<PlanControllerInput['ports']['parser']>({isCanonicalScheduleText,parseScheduleDraftText,scheduleTextFromRows}),
    clock:Object.freeze<PlanControllerInput['ports']['clock']>({clockHM,clockMinuteToStudyMinute,getMinuteOfDay,isValidHHMM,normalizeHHMM,studyMinuteToHHMM,t2m,timeLabelFromIso}),
    view:Object.freeze<PlanControllerInput['ports']['view']>({document,on:(target,type,handler)=>{target.addEventListener(type,handler);return target;},textEl,updateRealTimeAwareness,window}),
    notifications:NoticeCoordinator.presentation('plan'),
    scheduleGateway:PlanScheduleGateway,
    ownership:Object.freeze<PlanControllerInput['ports']['ownership']>({canMutate:()=>appCanMutate(),requirePrimary:(event,reason)=>!requireMutationCoordinator().blocksUi()&&requirePrimaryTab(event,reason)}),
    interactions:Object.freeze<PlanControllerInput['ports']['interactions']>({confirm:async options=>(await Interactions.confirm(options))===true,input:options=>Interactions.input(options)}),
    overlays:Object.freeze<PlanControllerInput['ports']['overlays']>({createAnchoredPopover:(popup,options)=>RichTextApi.createAnchoredPopover(popup,options)}),
    environment:Object.freeze<PlanControllerInput['ports']['environment']>({
      clearTimeout:id=>clearTimeout(id),
      setTimeout:(callback,delay)=>setTimeout(callback,delay)
    })
  })
}));
const {
  draft:PlanDraftEditor, render:renderSched, apply:applySchedule, setStatus:setPlanStatus,
  loadDefault:loadDefaultPlan, getDraft:getPlanDraftText,
  loadDraft:loadScheduleIntoDraft
}=PlanRuntime;
LibraryNoteWorkflows=NotesHostModule.createLibraryWorkflows(Object.freeze<Parameters<typeof NotesHostModule.createLibraryWorkflows>[0]>({
  runtime:NotesRuntime,repository:AppData.notes,plan:PlanRuntime,
  ownership:Object.freeze({canMutate:appCanMutate,revision:()=>AppOwnership.revision}),
  interactions:Object.freeze({confirm:async options=>(await Interactions.confirm(options))===true}),
  mergeText:(existing,moved)=>RichTextApi.appendIncomingAdditions(existing,moved).value
}));
if(!Object.isFrozen(LibraryNoteWorkflows)||LibraryNoteWorkflows.format!=='study-director.library-note-workflows'||LibraryNoteWorkflows.contractVersion!==1){
  throw new Error('Study Director note workflows are unavailable or incompatible.');
}
/* TIMER COUNTDOWN EXECUTION · PRIVATE ENGINE */
/* EXECUTE ONGOING PROGRESS NOTE PANEL */
function saveNote(){
  const doneNode=document.getElementById('pn-done'),totalNode=document.getElementById('pn-total');
  const doneEl=doneNode instanceof HTMLInputElement?doneNode:null,totalEl=totalNode instanceof HTMLInputElement?totalNode:null;
  if(doneEl&&totalEl){
    const state=progressInputState(TimerState.currentIndex,doneEl.value,totalEl.value,taskTargetValue(TASKS[TimerState.currentIndex]));
    syncProgressInputsToState(TimerState.currentIndex,state,{updateUI:false,save:false});
  }
  if(hasOngoingTaskNotes(TASKS[TimerState.currentIndex])){
    const field=document.getElementById('pn-extra');
    if(field instanceof HTMLTextAreaElement)commitTaskNoteEditor(field,field.value);
  }
}
let pnoteInfoPopover:ReturnType<typeof RichTextApi.createAnchoredPopover>|null=null;
function togglePnoteInfo(){const button=document.getElementById('pn-info-btn'),popover=document.getElementById('pn-info-popover');if(!button||!popover)return false;pnoteInfoPopover??=RichTextApi.createAnchoredPopover(popover,{align:'end'});const opening=popover.hidden;if(opening)pnoteInfoPopover.show(button);else pnoteInfoPopover.hide();return opening;}
const backupInfoPopovers=new Map<string,ReturnType<typeof RichTextApi.createAnchoredPopover>>();
function toggleBackupInfo(event:MouseEvent){const button=event.target instanceof Element?event.target.closest<HTMLElement>('[data-backup-info-target]'):null,id=String(button?.dataset?.['backupInfoTarget']||''),popover=id?document.getElementById(id):null;if(!button||!popover)return false;let controller=backupInfoPopovers.get(id);if(!controller){controller=RichTextApi.createAnchoredPopover(popover,{align:'end',onClose:()=>button.setAttribute('aria-expanded','false')});backupInfoPopovers.set(id,controller);}const opening=popover.hidden;if(opening){controller.show(button);button.setAttribute('aria-expanded','true');}else{controller.hide();button.setAttribute('aria-expanded','false');}return opening;}
let executeNoteView:Readonly<{taskId:string|null;id:string}>|null=null;
function refreshPnote(options:Readonly<{force?:boolean}>={}){
  const t=TASKS[TimerState.currentIndex];
  if(!isLiveTrackableTimer()||!t){
    const key=`no-area:${taskNoteScheduleRevision}:${TimerState.mode}:${TASKS.length}`;
    if(!options.force&&key===executeProgressPanelRenderKey)return false;
    executeProgressPanelRenderKey=key;
    setTextSafe('pn-utag','—');setTextSafe('pn-dlbl','Done');
    const doneNode=document.getElementById('pn-done'),totalNode=document.getElementById('pn-total'),doneEl=doneNode instanceof HTMLInputElement?doneNode:null,totalEl=totalNode instanceof HTMLInputElement?totalNode:null;
    setElementValue(doneEl,'');setElementValue(totalEl,'');setElementDisabled(doneEl,true);setElementDisabled(totalEl,true);
    const pbar=document.getElementById('pbar');if(pbar)pbar.style.width='0%';
    setTextSafe('pn-sum','No active trackable block');
    setTextSafe('pn-title','Notes');
    const areaShare=document.getElementById('pn-area-share');
    if(areaShare){areaShare.textContent='';areaShare.hidden=true;}
    setTextSafe('pn-info-popover','Persistent notes stay with their shared Area or support context. Use the Daily Diary for observations specific to today.');
    const pnNode=document.getElementById('pn-extra'),pn=pnNode instanceof HTMLTextAreaElement?pnNode:null;
    if(pn){const shell=pn.closest('.execute-note-editor-shell'),active=document.activeElement;if(shell&&active instanceof HTMLElement&&shell.contains(active))active.blur();clearTaskNoteEditorBinding(pn);setElementValue(pn,'');setElementDisabled(pn,true);pn.hidden=false;setElementAttribute(pn,'placeholder','');setElementAttribute(pn,'aria-label','Note unavailable: no work or support block is active');}
    executeNoteView=null;document.getElementById('pn-links')?.replaceChildren();
    renderInheritedNotes(document.getElementById('pn-inherited'),'');
    const ps=document.getElementById('pn-sync');if(ps){setElementText(ps,'—');ps.removeAttribute('title');ps.setAttribute('aria-label','No active Area note');ps.classList.add('idle');ps.classList.remove('saving','err');NoteSyncPopover.refresh(ps);}
    const empty=document.getElementById('pn-empty');if(empty)empty.hidden=false;
    return false;
  }
  const measure=taskMeasureValue(t,'units'),hasNotes=hasOngoingTaskNotes(t),support=isSupportBlock(t),areaKey=hasNotes?noteKeyForTask(t):'';
  const n=TaskSessionState.getField(TimerState.currentIndex,'notes')||{};
  const done=n.done!==undefined?n.done:'',total=n.total!==undefined?n.total:(taskTargetValue(t)||'');
  // A linked note opened from the bar stays on screen until this block ends.
  const taskId=TaskIdentity.idAt(TimerState.currentIndex),viewed=hasNotes&&executeNoteView&&executeNoteView.taskId===taskId?AppData.notes.get(executeNoteView.id):null;
  if(!viewed)executeNoteView=null;
  const noteKey=viewed?viewed.key:areaKey,noteText=hasNotes?noteTextForKey(noteKey):'',inheritedText=inheritedSubjectNotesHtml(t);
  const key=[taskNoteScheduleRevision,taskId,TimerState.currentIndex,measure,done,total,areaKey,noteKey,noteText,inheritedText].join('|');
  if(!options.force&&key===executeProgressPanelRenderKey){document.querySelector<HTMLElement&{refresh?:()=>void}>('#pn-links .note-links')?.refresh?.();return false;}
  executeProgressPanelRenderKey=key;
  setTextSafe('pn-utag',measure||'—');
  const labels:Readonly<Record<string,string>>={pages:'Pages',min:'Minutes',Qs:'Questions',videos:'Videos',cards:'Cards',topics:'Topics',answers:'Answers',block:'Block',blocks:'Blocks'};
  setTextSafe('pn-dlbl',labels[measure]||'Done');
  const doneNode=document.getElementById('pn-done'),totalNode=document.getElementById('pn-total'),doneEl=doneNode instanceof HTMLInputElement?doneNode:null,totalEl=totalNode instanceof HTMLInputElement?totalNode:null;
  setElementValue(doneEl,done);setElementValue(totalEl,total);
  setElementDisabled(doneEl,false);setElementDisabled(totalEl,false);
  const areaShare=document.getElementById('pn-area-share');
  setTextSafe('pn-title',support?'Support notes':'Notes');
  if(areaShare){
    const fullShare=support?'Shared by all support activities':hasNotes?`Shared by Area: ${noteLabelForTask(t)}`:'';
    areaShare.textContent=viewed?`Linked · ${viewed.label}`:support?'All support activities':hasNotes?`Area · ${noteLabelForTask(t)}`:'';
    areaShare.title=fullShare;areaShare.setAttribute('aria-label',fullShare);
    areaShare.hidden=!hasNotes;
  }
  setTextSafe('pn-info-popover',support?'One shared persistent note for every support activity. Use the Daily Diary for observations specific to today.':'This note is shared by blocks with the exact same Area. Parent-Area notes may appear as read-only context. Use the Daily Diary for observations specific to today.');
  const infoButton=document.getElementById('pn-info-btn');if(infoButton)infoButton.setAttribute('aria-label',support?'About support notes':'About notes');
  const pnNode=document.getElementById('pn-extra'),pn=pnNode instanceof HTMLTextAreaElement?pnNode:null;
  if(pn){
    if(viewed)bindNoteEditor(pn,viewed.key,viewed.label,'execute');
    else if(hasNotes)bindTaskNoteEditor(pn,TimerState.currentIndex,'execute');
    else clearTaskNoteEditorBinding(pn);
    pn.hidden=!hasNotes;
    setElementDisabled(pn,!hasNotes);
    setElementAttribute(pn,'placeholder',support?'Ongoing reminders, decisions, follow-ups, and routine notes shared across support activities…':'Ongoing reminders, doubts, tasks, mistakes, and points to revisit for this subject/area…');
    setElementValue(pn,noteText);
  }
  const links=document.getElementById('pn-links');
  if(links){const own=AppData.notes.get(areaKey);links.replaceChildren(...(hasNotes?[NoteLinks.bar({ref:own?own.id:areaKey,label:noteLabelForTask(t),own:true,current:viewed?viewed.id:'',onOpen:ref=>openExecuteNote(ref,taskId,own)})]:[]));}
  renderInheritedSubjectNotes(document.getElementById('pn-inherited'),t);
  const empty=document.getElementById('pn-empty');if(empty)empty.hidden=true;
  if(hasNotes)updateNoteSyncIndicators(TimerState.currentIndex,noteKey);
  onPnoteChange();return true;
}
// Execute's editor shows a linked note in place of the block's own until the
// own chip is tapped or the block changes.
function openExecuteNote(ref:string,taskId:string|null,own:ReturnType<typeof AppData.notes.get>|null){
  const target=AppData.notes.get(ref);
  executeNoteView=target&&(!own||target.id!==own.id)?Object.freeze({taskId,id:target.id}):null;
  return refreshPnote({force:true});
}
async function openNotesLibrary(){
  if(!await goTab('library',{source:'notes'}))return false;
  LibraryView.showSection('notes');
  const section=document.getElementById('library-notes');
  if(section)requestAnimationFrame(()=>section.scrollIntoView({block:'start',behavior:preferredScrollBehavior()}));
  return true;
}
function onPnoteChange(){
  const doneNode=document.getElementById('pn-done'),totalNode=document.getElementById('pn-total');
  const doneEl=doneNode instanceof HTMLInputElement?doneNode:null,totalEl=totalNode instanceof HTMLInputElement?totalNode:null;
  const t=TASKS[TimerState.currentIndex];if(!t||!doneEl||!totalEl)return;const measure=taskMeasureValue(t,'units');
  const state=progressInputState(TimerState.currentIndex,doneEl.value,totalEl.value,taskTargetValue(t));
  const resolved=syncProgressInputsToState(TimerState.currentIndex,state,{updateUI:false,save:false});
  const unitPct=state.pct!==null?state.pct:0;
  const pbar=document.getElementById('pbar');
  if(pbar)pbar.style.width=unitPct+'%';
  const sum=document.getElementById('pn-sum');
  setProgressSummary(sum,state.done,state.total,measure);
  syncRptFromTimer(TimerState.currentIndex,resolved.pct,state.done,state.total);
  recalcStats();
  if(resolved.changed)saveLiveDraft();
}
/* EXECUTE IDLE DISPLAY AND SESSION CONTROLS */
function isLiveTrackableTimer(...args:Parameters<typeof ExecutionViews.isLiveTrackableTimer>){return ExecutionViews.isLiveTrackableTimer(...args);}
function setExecuteControlsEnabled(...args:Parameters<typeof ExecutionViews.setExecuteControlsEnabled>){return ExecutionViews.setExecuteControlsEnabled(...args);}
function setExecuteShellVisible(...args:Parameters<typeof ExecutionViews.setExecuteShellVisible>){return ExecutionViews.setExecuteShellVisible(...args);}
function nextTrackableWindowLabel(...args:Parameters<typeof ExecutionViews.nextTrackableWindowLabel>){return ExecutionViews.nextTrackableWindowLabel(...args);}
function stripScheduleLead(...args:Parameters<typeof ExecutionViews.stripScheduleLead>){return ExecutionViews.stripScheduleLead(...args);}
function executeIdleView(...args:Parameters<typeof ExecutionViews.executeIdleView>){return ExecutionViews.executeIdleView(...args);}
function executeIdlePresentation(...args:Parameters<typeof ExecutionViews.executeIdlePresentation>){return ExecutionViews.executeIdlePresentation(...args);}
function setExecuteStateOverlay(...args:Parameters<typeof ExecutionViews.setExecuteStateOverlay>){return ExecutionViews.setExecuteStateOverlay(...args);}
function clearExecuteStateOverlay(...args:Parameters<typeof ExecutionViews.clearExecuteStateOverlay>){return ExecutionViews.clearExecuteStateOverlay(...args);}
function refreshExecuteIdleDisplay(...args:Parameters<typeof ExecutionViews.refreshExecuteIdleDisplay>){return ExecutionViews.refreshExecuteIdleDisplay(...args);}
function showExecuteWaitingState(...args:Parameters<typeof ExecutionViews.showExecuteWaitingState>){return ExecutionViews.showExecuteWaitingState(...args);}
function maybeAutoStartScheduledBlock(...args:Parameters<typeof ExecutionViews.maybeAutoStartScheduledBlock>){return ExecutionViews.maybeAutoStartScheduledBlock(...args);}
function maybePromptScheduleEndSave(...args:Parameters<typeof ExecutionViews.maybePromptScheduleEndSave>){return ExecutionViews.maybePromptScheduleEndSave(...args);}
function showDone(...args:Parameters<typeof ExecutionViews.showDone>){return ExecutionViews.showDone(...args);}
function showEmpty(...args:Parameters<typeof ExecutionViews.showEmpty>){return ExecutionViews.showEmpty(...args);}
function badgeElements(...args:Parameters<typeof ExecutionViews.badgeElements>){return ExecutionViews.badgeElements(...args);}
function updateBadges(...args:Parameters<typeof ExecutionViews.updateBadges>){return ExecutionViews.updateBadges(...args);}
function updateSessionControls(...args:Parameters<typeof ExecutionViews.updateSessionControls>){return ExecutionViews.updateSessionControls(...args);}
/* REVIEW SUBSYSTEM · PRIVATE MODULE */
type ReviewHostInput=Parameters<typeof ReviewHostModule.createSubsystem>[0];
type ReviewSubsystemInput=ReviewHostInput['subsystem'];
const ReviewSubsystem=ReviewHostModule.createSubsystem(Object.freeze<ReviewHostInput>({
  module:ReviewModule,
  subsystem:Object.freeze<ReviewSubsystemInput>({
  constants:Object.freeze<ReviewSubsystemInput['constants']>({
    limits:APP_LIMITS,dataContract:DATA_CONTRACT,
    completionSources:COMPLETION_SOURCES,taskOutcomes:TASK_OUTCOMES,timerModes:TIMER_MODES
  }),
  services:Object.freeze<ReviewSubsystemInput['services']>({
    appData:AppData,diagnostics:AppDiagnostics,practicePacer:PracticePacer,
    taskIdentity:TaskIdentity,taskSessionState:TaskSessionState,keyedRecord:KeyedRecord,
    evidenceGateway:SessionEvidenceGateway,dailyReflection:DailyReflectionPersistence,saveLane:SaveLaneModule
  }),
  runtime:Object.freeze<ReviewSubsystemInput['runtime']>({
    tasks:TASKS,sessionState:SessionState,scheduleDerivedState:ScheduleDerivedState,
    currentIndex:()=>TimerState.currentIndex,timerMode:()=>TimerState.mode,isPaused:()=>TimerState.paused,pendingGap:()=>TimerState.inactiveGap,
    carryForward:()=>latestCarryForward,originalSchedule:()=>TimerState.originalSchedule,
    setSafetyMessage:value=>{sessionSafetyMessage=String(value||'');}
  }),
  ports:Object.freeze<ReviewSubsystemInput['ports']>({
    domain:Object.freeze<ReviewSubsystemInput['ports']['domain']>({
      boundedInt,clampText,clampEditorContent,editorContentWithinLimits,plainTextContent,classifyTaskOutcome,cleanDayRevision,
      emptyTaskOutcomeCounts,finiteNumber,materializeDailyRecordView:value=>{const record=materializeDailyRecordView(value);return record?.recordKind==='study'?record:null;},normalizeCompletionSource,
      normalizeDailyResultEntry,positiveMinutes,sanitizePracticeRuns,sanitizeTaskOutcomeCounts,
      summarizeCleanPracticeRuns,taskAreaValue,taskMeasureValue,taskOutcomeInfo,taskOutcomeSummaryText,
      taskOutcomeTotal,taskTargetValue
    }),
    presentation:Object.freeze<ReviewSubsystemInput['ports']['presentation']>({
      dateInsightsMeta,fmtS,formatPracticeMs,practicePaceBandLabel,prettyDate,renderRichTextContent,
      setProgressSummary,studyMinuteToHHMM,textEl,timeLabelFromIso
    }),
    schedule:Object.freeze<ReviewSubsystemInput['ports']['schedule']>({
      adjustedEndMin,adjustedStartMin,effectiveNowMin,hasAdjustedTiming,isLiveTrackableTimer,
      isTaskResolved,isTrackableBlock,isWorkBlock,latestTrackableEndMin,originalEndMin,
      originalStartMin,scheduleFingerprint
    }),
    evidence:Object.freeze<ReviewSubsystemInput['ports']['evidence']>({
      actualRecordsSnapshot,applicableNotesForTask:task=>applicableNotesForTask('start' in task?task:{id:task.id,start:task.originalStart,dur:task.dur,name:task.name,kind:task.kind,area:task.area,measure:task.measure,target:task.target}),clearManualCompletionOverride,
      liveTaskOutcome,progressInputState,recordCurrentActiveToTask,
      resolveTaskCompletion,storeResolvedCompletion,setCompletionState,syncProgressInputsToState,updateTimerFocusMetrics
    }),
    session:Object.freeze<ReviewSubsystemInput['ports']['session']>({
      acknowledgeSavedStudyDay,clearCanonicalSessionAfterSavedDay,
      cancelPendingLiveDraftSave,clearSaveReminder,flushLiveDraft,
      getLifecycleRevision:()=>SessionLifecycle.revision,getOwnershipRevision:()=>AppOwnership.revision,getReviewDate,
      lifecycleCanWrite:()=>SessionLifecycle.canWrite(),markDayContentChanged,markDayContentSaved,resetRuntimeSessionState,
      runLifecycle:(kind,options,operation)=>SessionLifecycle.run(kind,options,operation),
      saveLiveDraft,setReviewDateTitle,setSessionPanelMode,stopTimerExecution:()=>TimerEngine.stopExecution(),
      appCanMutate,writeCanonicalNow:(operation,options)=>requireActiveSessionRuntime().writeCanonicalNow(operation,options),writeLiveDraftNow
    }),
    notesDefaults:Object.freeze<ReviewSubsystemInput['ports']['notesDefaults']>({
      noteStoredValueForKey,bindTaskNoteEditor,closeRichTextField:field=>richTextCloseField(field),commitTaskNoteEditor,currentNoteEntriesForWorkTasks,
      refreshPlanAfterSessionReset,renderInheritedNotes,setPlanStatus,syncUnfinishedNoteDraft,unfinishedNoteDraftText
    }),
    notifications:NoticeCoordinator.presentation('review',Object.freeze({label:'Open Review',run:()=>goTab('review')})),
    view:Object.freeze<ReviewSubsystemInput['ports']['view']>({markStorageHealthTimestamp,notifyUser,on,refreshLibraryAfterSave:async()=>{LibraryView.invalidate();return LibraryView.render();},refreshStorageFallbackWarning,setStatus,updateBadges}),
    interactions:Object.freeze<ReviewSubsystemInput['ports']['interactions']>({confirm:async options=>(await Interactions.confirm(options))===true,notify:options=>Interactions.notify({...options,source:'review'})}),
    environment:Object.freeze<ReviewSubsystemInput['ports']['environment']>({cancelAnimationFrame,clearTimeout,requestAnimationFrame,setTimeout,todayISO})
  })
  })
}));
if(!Object.isFrozen(ReviewSubsystem)||ReviewSubsystem.format!=='study-director.review-subsystem'||ReviewSubsystem.contractVersion!==1){
  throw new Error('Study Director Review subsystem is unavailable or incompatible.');
}
const {
  ReviewModel, ReviewEditor
}=ReviewSubsystem;
const {
  ReviewSaveService, ReviewView, SharedReviewPresentation
}=ReviewSubsystem;
const {
  setQuality:setStudyQuality, saveReview:saveReviewState, queueReview:queueReviewSave,
  flushPending:flushPendingReviewSave
}=ReviewEditor;
hydrateReviewState=ReviewEditor.hydrate;
currentReviewSnapshot=ReviewEditor.activeSessionReview;
bindReviewSession=ReviewEditor.bindSession;
const {
  captureInputs:captureReviewInputs,
  clearFutureUntouched:clearFutureUntouchedProgress, deletePracticeRun
}=ReviewEditor;
const {isRolledOver:studyDayRolledOver}=ReviewSaveService;
const calculateReviewMetrics=ReviewModel.calculate;
const {
  copy:copyReview, toggleCopyMenu:toggleCopyReportMenu, resetCopySelection:resetCopyReportSelection, copyText:copyTextToClipboard, recalculateStats:recalcStats, renderCompletionChange,
  renderUnfinishedNote:renderReviewUnfinishedNote, setDisclosures:setReviewDetailDisclosures,
  syncFromTimer:syncRptFromTimer
}=ReviewView;
const {
  createSavedDayTaskCard:createSavedDayTaskReviewCard, createPomodoroSummaryLine, populatePracticeRunTable,
  durationLabel, optionalDurationLabel, optionalPercentLabel
}=SharedReviewPresentation;

/* CANONICAL SESSION / EDITOR LIFECYCLE */
const SessionLifecycleViews=SessionActionsModule.createLifecycleViews(Object.freeze<Parameters<typeof SessionActionsModule.createLifecycleViews>[0]>({
 document,NOTE_EDITOR_BINDING_VERSION,setTimeout:(fn,delay)=>setTimeout(fn,delay),
 get ReviewEditor(){return ReviewEditor;},get ReviewView(){return ReviewView;},
 invalidateProgressPanel:()=>{executeProgressPanelRenderKey='';},
richTextClose:(...args)=>richTextClose(...args),
cancelPendingLiveDraftSave:(...args)=>cancelPendingLiveDraftSave(...args),
advanceTaskNoteScheduleRevision:(...args)=>advanceTaskNoteScheduleRevision(...args),
clearTaskNoteEditorBinding:(...args)=>clearTaskNoteEditorBinding(...args),
isValidIsoDate:(...args)=>isValidIsoDate(...args),
getReviewDate:(...args)=>getReviewDate(...args),
refreshAllSubjectNoteFieldsFromRepository:(...args)=>refreshAllSubjectNoteFieldsFromRepository(...args),
refreshPnote:(...args)=>refreshPnote(...args),
hydrateReviewState:(...args)=>hydrateReviewState(...args),
refreshLibraryNotes:(...args)=>refreshLibraryNotes(...args),
requestRender:(...args)=>requestRender(...args),
appCanMutate:(...args)=>appCanMutate(...args),
schedulePwaUpdateEvaluation:(...args)=>schedulePwaUpdateEvaluation(...args)
}));
function lifecycleEditorElements(...args:Parameters<typeof SessionLifecycleViews.lifecycleEditorElements>){return SessionLifecycleViews.lifecycleEditorElements(...args);}
function setLifecycleEditorsBlocked(...args:Parameters<typeof SessionLifecycleViews.setLifecycleEditorsBlocked>){return SessionLifecycleViews.setLifecycleEditorsBlocked(...args);}
function invalidateLifecycleEditors(...args:Parameters<typeof SessionLifecycleViews.invalidateLifecycleEditors>){return SessionLifecycleViews.invalidateLifecycleEditors(...args);}
function reconcileLifecycleEditors(...args:Parameters<typeof SessionLifecycleViews.reconcileLifecycleEditors>){return SessionLifecycleViews.reconcileLifecycleEditors(...args);}
function completeLifecycleTransition(...args:Parameters<typeof SessionLifecycleViews.completeLifecycleTransition>){return SessionLifecycleViews.completeLifecycleTransition(...args);}
const SessionLifecycleHooks=ReviewHostModule.createLifecycleHooks(Object.freeze<Parameters<typeof ReviewHostModule.createLifecycleHooks>[0]>({
  canMutate:()=>appCanMutate(),
  reviewEditor:ReviewEditor,
  lifecycleViews:SessionLifecycleViews,
  diagnostics:Object.freeze<Parameters<typeof ReviewHostModule.createLifecycleHooks>[0]['diagnostics']>({capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level)})
}));
const SessionLifecycle=SessionLifecycleModule.createCoordinator(Object.freeze<Parameters<typeof SessionLifecycleModule.createCoordinator>[0]>({hooks:SessionLifecycleHooks}));
if(!Object.isFrozen(SessionLifecycle)||SessionLifecycle.format!=='study-director.session-lifecycle-coordinator'||SessionLifecycle.contractVersion!==1){
  throw new Error('Study Director session lifecycle coordinator is unavailable or incompatible.');
}

type SessionHostInput=Parameters<typeof SessionHostModule.createController>[0];
ActiveSessionRuntime=SessionHostModule.createController(Object.freeze<SessionHostInput>({
  configuration:Object.freeze<SessionHostInput['configuration']>({
    activeSessionId:ACTIVE_SESSION_ID,activeSessionVersion:DATA_CONTRACT.schemas.ActiveSession.version,
    sessionSnapshotVersion:DATA_CONTRACT.schemas.SessionSnapshot.version,maxCarryForwardChars:APP_LIMITS.maxCarryForwardChars,
    maxScheduleChars:APP_LIMITS.maxScheduleChars,maxTasksPerDay:APP_LIMITS.maxTasksPerDay,
    debounceMs:LIVE_DRAFT_SAVE_DEBOUNCE_MS,timerSnapshotIntervalMs:TIMER_SNAPSHOT_INTERVAL_MS,
    completionNone:COMPLETION_SOURCES.NONE,
    practicePauseCauses:Object.freeze({session:PRACTICE_PAUSE_CAUSES.SESSION,gap:PRACTICE_PAUSE_CAUSES.GAP,main:PRACTICE_PAUSE_CAUSES.MAIN})
  }),
  codec:Object.freeze<SessionHostInput['codec']>({canonicalize:value=>ActiveSessionCodec.canonicalize(value),sanitizeCurrent:value=>ActiveSessionCodec.sanitizeCurrent(value),sanitizeSessionSnapshot:(value,date,fingerprint,revision)=>ActiveSessionCodec.sanitizeSessionSnapshot(value,date,fingerprint,revision)}),
  repository:Object.freeze<SessionHostInput['repository']>({
    save:(value,options)=>AppData.activeSession.save(value,options),load:(retry,options)=>AppData.activeSession.load(retry,options),
    clear:options=>AppData.activeSession.clear(options),readLocal:()=>AppData.activeSession.readLocal(),
    nextRevision:seed=>AppData.activeSession.nextRevision(seed),settled:()=>AppData.activeSession.settled()
  }),
  canonical:Object.freeze<SessionHostInput['canonical']>({same:(a,b)=>CanonicalModule.same(a,b)}),
  snapshot:Object.freeze<SessionHostInput['snapshot']>({
    tasks:()=>TASKS,ensureTaskIds,taskIdentity:TaskIdentity,taskState:TaskSessionState,timerState:TimerState,
    captureEvidence:()=>captureRuntimeEvidence({includeActivePause:false,withCompletion:false,includeRecords:true}),
    timerPayload:timerRuntimePayload,reviewSnapshot:()=>currentReviewSnapshot(),practiceSnapshot:()=>PracticePacer.snapshot(),
    practiceRestore:(value,options)=>PracticePacer.restore(value,options),getReviewDate,scheduleFingerprint,
    sessionFingerprint:activeSessionScheduleFingerprint,appliedScheduleText:()=>PlanRuntime.appliedScheduleText(),
    getCarryForward:()=>latestCarryForward,setCarryForward:value=>{latestCarryForward=value;},clearProgress:clearProgressRuntime,
    sanitizeAdjustedSchedule:sanitizeRuntimeAdjustedSchedule,invalidateScheduleDerived,setCurrentTask,timerRestoreValid:runtime=>!!validateTimerRestoreCandidate(runtime)
  }),
  domain:Object.freeze<SessionHostInput['domain']>({normalizeCompletionSource,clampCompletion:CompletionModel.clampPercent,cleanDayRevision,clampText,isCanonicalScheduleText,isValidIsoDate,todayISO}),
  persistence:Object.freeze<SessionHostInput['persistence']>({
    canMutate:appCanMutate,ownsSession:()=>AppOwnership.canMutate(),canProject:()=>{try{AppOwnership.issueWriteToken('project the canonical session',{allowHydrating:true});return true;}catch{return false;}},ownershipRevision:()=>AppOwnership.revision,recoveryQuiesced:managedRecoverySessionQuiesced,
    persistenceBlocked:()=>ReviewSaveService.status().activeSessionPersistenceBlocked,
    recoveryWorkActive:()=>AppOwnership.canMutate()&&AppMutationCoordinator?.status().active==='managed-recovery',
    timerSnapshotEligible:()=>!TimerState.paused&&!TimerState.inactiveGap&&!!TimerState.runtime&&TimerState.runtime.startMs!==null,
    markContentChanged:markDayContentChanged,
    snapshotForWrite:()=>SessionHandoffRuntime?.snapshotForWrite()||requireActiveSessionRuntime().captureSnapshot(),
    reportResult:handleActiveSessionRepositoryResult,warn:showLiveDraftSaveWarning
  }),
  lifecycle:Object.freeze<SessionHostInput['lifecycle']>({revision:()=>SessionLifecycle.revision,run:(kind,options,operation)=>SessionLifecycle.run(kind,options,operation)}),
  apply:Object.freeze<SessionHostInput['apply']>({
    readPlanDraft:()=>{const input=document.getElementById('plan-input');return input instanceof HTMLTextAreaElement||input instanceof HTMLInputElement?input.value:'';},
    writePlanDraft:value=>{const input=document.getElementById('plan-input');if(input instanceof HTMLTextAreaElement||input instanceof HTMLInputElement)input.value=value;},
    previewPlanDraft:()=>PlanDraftEditor.preview({silent:true,enterDraft:false}),
    setStudyDate:(date,automatic)=>{const dd=document.getElementById('day-date');if(dd instanceof HTMLInputElement){dd.value=date;dd.dataset['autoDate']=automatic?'1':'0';}},
    applySessionSchedule:async input=>(await applySchedule({source:input.source,skipNotify:true,studyDate:input.studyDate,reviewOnly:input.reviewOnly,forceReload:true,sessionSnapshot:input.snapshot,lifecycleManaged:true,scheduleText:input.scheduleText,persistDraft:false,currentEditor:input.current}))!==false
  }),
  reset:Object.freeze<SessionHostInput['reset']>({
    stopTimerPresentation:()=>TimerPresentation.stop(),
    invalidatePresentation:()=>{executeIdleDisplayKey='';realTimeAwarenessRenderKey='';executePanelsRenderKey='';executeProgressPanelRenderKey='';scheduleEndPromptKey='';},
    resetCountdown:resetCountdownRuntime,setCurrentTask,resetBreak:resetBreakState,setEmptyTimerMode:()=>setTimerMode(TIMER_MODES.EMPTY,'session-reset'),
    clearTimerSession:()=>TimerState.clearSession(),hydrateReview:(date,review=null)=>hydrateReviewState({date,snapshotReview:review}),
    invalidateSchedule:()=>invalidateScheduleDerived({identity:true,adjustments:true,render:true}),resetPlanSession:()=>PlanRuntime.resetSession(),
    clearProgress:clearProgressRuntime,clearCarryForward:()=>{latestCarryForward='';},resetPractice:()=>PracticePacer.reset(),
    pausePracticeForSessionEnd:()=>PracticePacer.pauseForSessionEnd({persist:false})
  }),
  installation:Object.freeze<SessionHostInput['installation']>({id:()=>InstallationIdentity.getId()}),clock:Object.freeze<SessionHostInput['clock']>({nowMs:DecisionClock.nowMs,nowIso:()=>new Date().toISOString()}),
  environment:Object.freeze<SessionHostInput['environment']>({clearTimeout:id=>clearTimeout(id),setTimeout:(callback,delay)=>setTimeout(callback,delay)})
}));
if(!Object.isFrozen(ActiveSessionRuntime)||ActiveSessionRuntime.format!=='study-director.session-host'||ActiveSessionRuntime.contractVersion!==1){
  throw new Error('Study Director Active Session runtime is unavailable or incompatible.');
}

type ReviewSavedDayInput=Parameters<typeof ReviewHostModule.createSavedDayCoordinator>[0];
ReviewSavedDayRuntime=ReviewHostModule.createSavedDayCoordinator(Object.freeze<ReviewSavedDayInput>({
  document,day:ReviewDayState,
  runtime:Object.freeze<ReviewSavedDayInput['runtime']>({
    tasks:()=>TASKS,timerState:TimerState,isTrackableBlock,captureSessionSnapshot:()=>captureSessionSnapshot(),
    appliedScheduleText:()=>PlanRuntime.appliedScheduleText(),appCanMutate:()=>appCanMutate(),panelMode:()=>sessionPanelMode,
    safetyMessage:()=>sessionSafetyMessage,setSafetyMessage:value=>{sessionSafetyMessage=String(value||'');},
    isSuspended:session=>isSuspendedActiveSession(session),activeSessionSnapshot:session=>activeSessionSnapshot(session),
    applyStoredSessionSnapshot:async(session,snapshot,options)=>(await applyStoredSessionSnapshot(session,snapshot,options))!==false,
    setPanelMode:(mode,session)=>setSessionPanelMode(mode,session),setTimerDone:()=>setTimerMode(TIMER_MODES.DONE,'suspended-session-saved'),
    updateSessionControls
  }),
  repositories:Object.freeze<ReviewSavedDayInput['repositories']>({
    loadActiveSession:(...args)=>AppData.activeSession.load(...args),
    dailyDocuments:(...args)=>AppData.dailyRecords.documents(...args),
    verifyDaily:record=>AppData.dailyRecords.verifyCanonical(record),
    pendingReviews:()=>AppData.pendingReviews.list()
  }),
  codecs:Object.freeze<ReviewSavedDayInput['codecs']>({
    sanitizeSession:value=>ActiveSessionCodec.sanitizeCurrent(value),
    savedDayCoversSessionEvidence:(record,subject,options)=>DailyRecordCodec.savedDayCoversSessionEvidence(record,subject,options)
  }),
  session:Object.freeze<ReviewSavedDayInput['session']>({
    writeCanonicalNow:(label,options)=>requireActiveSessionRuntime().writeCanonicalNow(label,options),
    clearCanonicalAfterSavedDay:()=>requireActiveSessionRuntime().clearCanonical('clearing the saved study session'),
    clearSafetyMessage:prefix=>clearSessionSafetyMessage(prefix)
  }),
  review:Object.freeze<ReviewSavedDayInput['review']>({
    saveService:ReviewSaveService,editor:ReviewEditor,
    closeReflectionEditor:()=>{const field=document.getElementById('daily-reflection');return richTextCloseField(field instanceof HTMLTextAreaElement?field:null);}
  }),
  view:Object.freeze<ReviewSavedDayInput['view']>({
    prettyDate,refreshStorageWarning:refreshStorageFallbackWarning,notifyUser,setStatus,openDetails:setReviewDetailDisclosures,
    diagnostics:(scope,error,level)=>AppDiagnostics.capture(scope,error,level),
    staleSaveStatus:()=>NoticeCoordinator.eventStatus().events.some(event=>event.source==='review'&&event.id==='status-save-status'&&event.message==='Review is ready. Save today to Library when you are done.')
  }),
  activation:Object.freeze<ReviewSavedDayInput['activation']>({publishRollover:()=>AppActivation.publish(APP_ACTIVATION_KINDS.DATE_ROLLOVER,'study-day-rollover',{destructive:true})})
}));

/* LIVE FOCUS EVIDENCE IN THE EXECUTION HEADER */
function timerMetricElements(...args:Parameters<typeof ExecutionViews.timerMetricElements>){return ExecutionViews.timerMetricElements(...args);}
function updateTimerFocusMetrics(...args:Parameters<typeof ExecutionViews.updateTimerFocusMetrics>){return ExecutionViews.updateTimerFocusMetrics(...args);}
/* PORTABLE ONGOING-NOTE EXPORT · READ-ONLY */
const RetainedBackupFiles=BackupRecoveryHostModule.createRetainedBackupFiles(Object.freeze<Parameters<typeof BackupRecoveryHostModule.createRetainedBackupFiles>[0]>({
  restoreJournalPayload:()=>JournalAppMeta.read('restoreJournalPayload'),
  repositoryIntegrityState:()=>BackupAppMeta.read('repositoryIntegrityScrub')
}));
if(!Object.isFrozen(RetainedBackupFiles)||RetainedBackupFiles.format!=='study-director.retained-backup-files'||RetainedBackupFiles.contractVersion!==1){
  throw new Error('Study Director retained backup-file policy is unavailable or incompatible.');
}
type BackupFileStoreInput=Parameters<typeof ExportsModule.createFileStore>[0];
const BackupFiles=ExportsModule.createFileStore(Object.freeze<BackupFileStoreInput>({
  storage:Object.freeze<BackupFileStoreInput['storage']>({getDirectory:()=>navigator.storage.getDirectory()}),
  locks:navigator.locks,root:ProfileScope.scoped('@@SD_BACKUP_FILES_OPFS_DIRECTORY@@'),retained:()=>RetainedBackupFiles.names(),
  isAvailable:()=>upkeepBlocker()||(typeof Reflect.get(navigator.storage,'getDirectory')==='function'&&typeof Reflect.get(navigator,'locks')==='object'?true:'storage-unavailable'),
  onError:error=>AppDiagnostics.capture('backup.file-cleanup',error,'warn')
}));
let fileProcessingNotice:ReturnType<ReturnType<typeof NoticeCoordinator.presentation>['begin']>|null=null;
type ExportCoordinatorInput=Parameters<typeof ExportsModule.createCoordinator>[0];
const Exports=ExportsModule.createCoordinator(Object.freeze<ExportCoordinatorInput>({
  createWorker:()=>new Worker(trustedAssetURL('@@SD_EXPORT_WORKER_FILENAME@@'),{name:'study-director-exports'}),window,document,files:BackupFiles,
  onState:state=>{renderFileBackup();if(state.fileBusy){if(!fileProcessingNotice)fileProcessingNotice=NoticeCoordinator.presentation('file-processing').begin({id:'worker',surfaceId:'file-processing-status',foreground:false,announce:false,title:'File processing'});fileProcessingNotice.update({message:state.phase,progress:{stage:state.phase}});}else{fileProcessingNotice?.resolve();fileProcessingNotice=null;const status=document.getElementById('file-processing-status');if(status)status.textContent='';}}
}));
let BackupProtectionHost:ReturnType<typeof BackupActionsHostModule.createProtectionHost>|null=null;
function backupBackgroundAvailability(){return BackupProtectionHost?BackupProtectionHost.backgroundAvailability():backgroundBlocker()||'locked';}
function setBackupProtectionSurfaceError(error:unknown){return BackupProtectionHost?.surfaceError(error)||false;}
const BackupProtectionStorage=BackupActionsHostModule.createProtectionStorage(Object.freeze<Parameters<typeof BackupActionsHostModule.createProtectionStorage>[0]>({meta:ExportsAppMeta,settingName:'backupProtection',settingKey:APP_META_KEYS.backupProtection}));
type BackupProtectionHostInput=Parameters<typeof BackupActionsHostModule.createProtectionHost>[0];
BackupProtectionHost=BackupActionsHostModule.createProtectionHost(Object.freeze<BackupProtectionHostInput>({
  module:ExportsModule,processing:Exports,storage:BackupProtectionStorage,
  interactions:Object.freeze<BackupProtectionHostInput['interactions']>({
    input:async options=>{const {signal,...rest}=options;const result=await Interactions.input(signal?{...rest,signal}:rest);return result?{value:result.value}:null;},
    confirm:async options=>(await Interactions.confirm(options))===true,
    choose:async options=>await Interactions.choose(options)
  }),settingKey:APP_META_KEYS.backupProtection,
  mutation:Object.freeze<BackupProtectionHostInput['mutation']>({
    remember:()=>Profiles.list().length<2,canMutate:()=>appCanMutate(),
    issueToken:()=>AppOwnership.issueWriteToken('change backup encryption'),
    assertToken:token=>AppOwnership.assertWriteToken(token,'change backup encryption')
  }),
  environment:Object.freeze<BackupProtectionHostInput['environment']>({window,backgroundBlocker:()=>backgroundBlocker()}),
  view:Object.freeze<BackupProtectionHostInput['view']>({
    document,clampText,maxStatusMessageChars:APP_LIMITS.maxStatusMessageChars,
    resolveSettingNotice:()=>NoticeCoordinator.resolveEvent('backup-protection','settings'),
    publishSettingError:message=>NoticeCoordinator.emit({source:'backup-protection',id:'settings',surfaceId:'backup-protection-hint',surface:'inline',severity:'error',lifecycle:'failed',cue:'none',message}),
    fullyInitialized:()=>StartupLifecycle.status().fullyInitialized,
    wakeBackground:reason=>wakeBackgroundOperations(reason),
    refreshProviders:():unknown=>BackupProviderRuntime.refresh(),
    renderProfile:()=>renderProfile()
  })
}));
if(!Object.isFrozen(BackupProtectionHost)||BackupProtectionHost.format!=='study-director.backup-protection-host'||BackupProtectionHost.contractVersion!==1){
  throw new Error('Study Director backup-protection host is unavailable or incompatible.');
}
const BackupProtection:NonNullable<typeof BackupProtectionHost>['protection']=BackupProtectionHost.protection;
BackupProtectionHost.install();
type NoteExporterInput=Parameters<typeof NoteExportModule.createExporter>[0];
const NoteExporter=NoteExportModule.createExporter(Object.freeze<NoteExporterInput>({ports:Object.freeze<NoteExporterInput['ports']>({
  assets:Object.freeze<NoteExporterInput['ports']['assets']>({get:id=>RichTextAssets.get(id)}),
  notes:Object.freeze<NoteExporterInput['ports']['notes']>({get:key=>AppData.notes.get(key)}),
  processing:Object.freeze<NoteExporterInput['ports']['processing']>({job:(operation,options)=>AttachmentStorage.during(()=>Exports.job(operation,options)),run:Exports.run,cancel:Exports.cancel,check:Exports.check}),
  scheduling:Object.freeze<NoteExporterInput['ports']['scheduling']>({yieldTask:BackgroundTasks.yieldTask,budget:BackgroundTasks.budget}),
  output:Object.freeze<NoteExporterInput['ports']['output']>({chooseSave:Exports.chooseSave,save:Exports.save}),
  richText:Object.freeze<NoteExporterInput['ports']['richText']>({assetIds:value=>RichTextApi.assetIds(value),exportDocument:value=>RichTextApi.exportDocument(value)})
})}));
if(!Object.isFrozen(NoteExporter)||NoteExporter.format!=='study-director.note-exporter'||NoteExporter.contractVersion!==2){
  throw new Error('Study Director note exporter is unavailable or incompatible.');
}
type PdfDocumentsInput=Parameters<typeof DocumentHostModule.createPdfController>[0];
const PdfDocuments=DocumentHostModule.createPdfController(Object.freeze<PdfDocumentsInput>({
  document,window,urls:URL,store:AttachmentStorage,overlay:WorkspaceOverlay,
  notifications:Object.freeze({notify:input=>Interactions.notify(input),resolve:(source,key)=>NoticeCoordinator.resolveEvent(source,key)}),
  diagnostics:Object.freeze<PdfDocumentsInput['diagnostics']>({capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level)})
}));
type NotePrinterInput=Parameters<typeof DocumentHostModule.createPrinter>[0];
const NotePrinter=DocumentHostModule.createPrinter(Object.freeze<NotePrinterInput>({
  document,window,richText:RichTextApi,assets:RichTextAssets,plain:value=>plainTextContent(value),
  diagnostics:Object.freeze<NotePrinterInput['diagnostics']>({capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level)}),now:()=>Date.now()
}));
let AttachmentLibrary:ReturnType<typeof AttachmentsModule.create>|null=null;
function journalHasState(value:unknown){return !!(value&&typeof value==='object'&&Reflect.get(value,'state'));}
type LibraryDocumentsInput=Parameters<typeof DocumentHostModule.createIntegration>[0];
const LibraryDocuments=DocumentHostModule.createIntegration(Object.freeze<LibraryDocumentsInput>({
  limits:Object.freeze({maxRichAssetPerDocument:APP_LIMITS.richAssetMaxPerDocument,maxRichAssetBytesPerDocument:RichTextApi.assetPolicy.maxBytesPerDocument}),
  notes:AppData.notes,
  ownership:Object.freeze<LibraryDocumentsInput['ownership']>({issue:reason=>AppOwnership.issueWriteToken(reason),assert:(token,reason)=>AppOwnership.assertWriteToken(token as ReturnType<typeof AppOwnership.issueWriteToken>,reason)}),
  editor:RichTextRuntime,review:ReviewEditor,session:Object.freeze<LibraryDocumentsInput['session']>({settled:()=>AppData.activeSession.settled()}),
  library:()=>LibraryView,attachmentLibrary:()=>requireAttachmentLibrary(),attachmentTypes:AttachmentsModule,assets:RichTextAssets,richText:RichTextApi,
  content:Object.freeze<LibraryDocumentsInput['content']>({withinLimits:value=>editorContentWithinLimits(value)}),printer:NotePrinter,exporter:NoteExporter
}));
if(!Object.isFrozen(LibraryDocuments)||LibraryDocuments.format!=='study-director.document-integration'||LibraryDocuments.contractVersion!==1){
  throw new Error('Study Director Library document integration is unavailable or incompatible.');
}
/* LIBRARY MODULE COMPOSITION */
const settleAttachmentWriters=LibraryDocuments.settleAttachmentWriters;
type AttachmentReferenceInput=Parameters<typeof AttachmentsModule.createReferenceCoordinator>[0];
const AttachmentReferences=AttachmentsModule.createReferenceCoordinator(Object.freeze<AttachmentReferenceInput>({
  data:AppData,
  scan:value=>RichTextApi.scanAttachmentReferences(String(value||'')),
  rewriteReferences:(targets,operation)=>LibraryClearState.rewriteReferences(targets,operation),
  withPersistenceSuppressed:operation=>withRestoreSessionPersistenceSuppressed(operation),
  background:Object.freeze<AttachmentReferenceInput['background']>({budget:()=>BackgroundTasks.budget(),yieldTask:options=>BackgroundTasks.yieldTask(options)}),
  live:Object.freeze<AttachmentReferenceInput['live']>({
    fields:()=>document.querySelectorAll<HTMLTextAreaElement>('textarea.task-note-field,textarea.library-diary-textarea,#daily-reflection'),
    reviewDate:()=>getReviewDate(),todayIso:()=>todayISO(),noteKey:area=>{const title=normalizeAreaName(area);return title?AppData.notes.get(title)?.id||title:'';}
  })
}));
type LibraryClearStateInput=Parameters<typeof LibraryClearModule.createState>[0];
const LibraryClearState=LibraryClearModule.createState(Object.freeze<LibraryClearStateInput>({
  createRollbackScope:(plan,policy)=>LibraryClearModule.createRollbackScope(plan,policy),
  withPersistenceSuppressed:operation=>withRestoreSessionPersistenceSuppressed(operation),
  data:AppData,
  references:Object.freeze<LibraryClearStateInput['references']>({
    scan:value=>AttachmentReferences.scan(value),
    remove:(value,ids)=>RichTextApi.removeAttachmentReferences(value,ids),
    listSources:()=>AttachmentReferences.sources({includeLive:false})
  }),
  attachments:Object.freeze<LibraryClearStateInput['attachments']>({
    inventory:()=>requireAttachmentLibrary().inventory(),
    verifyMetadata:rows=>requireAttachmentLibrary().verifyMetadata(rows),
    restoreMetadata:rows=>requireAttachmentLibrary().restoreMetadata(rows)
  }),
  review:Object.freeze<LibraryClearStateInput['review']>({hydrate:options=>ReviewEditor.hydrate(options),invalidateBindings:()=>ReviewEditor.invalidateBindings()}),
  nowIso:()=>new Date().toISOString()
}));
const validateAttachmentInsertionValue=LibraryDocuments.validateAttachmentInsertion;
const insertAttachmentIntoNote=LibraryDocuments.insertAttachment;
const quiesceAttachmentMutation=LibraryDocuments.quiesceAttachmentMutation;
type AttachmentLibraryInput=Parameters<typeof AttachmentsModule.create>[0];
AttachmentLibrary=AttachmentsModule.create(Object.freeze<AttachmentLibraryInput>({
  notifications:NoticeCoordinator.presentation('attachments',Object.freeze({label:'Open attachments',run:async()=>{if(await goTab('library')){LibraryView.showSection('data');const panel=document.getElementById('library-attachments');if(panel instanceof HTMLDetailsElement){panel.open=true;panel.scrollIntoView({block:'start'});}}}})),
  onWorkStart:()=>{pwaWorkRevision++;},
  store:AttachmentStorage,processing:Exports,document,interactions:Interactions,
  canMutate:()=>appCanMutate(),requireOwner:()=>{if(!appCanMutate())throw new Error('Use the primary tab to manage attachments.');},token:()=>AppOwnership.issueWriteToken('manage attachments'),assertToken:token=>AppOwnership.assertWriteToken(token,'manage attachments'),
  isActive:()=>document.getElementById('pane-library')?.classList.contains('on')===true&&document.getElementById('library-data')?.hidden===false,cleanup:()=>scheduleRichTextAssetMaintenance(),renderReference:(container,source)=>renderRichTextContent(container,source.value,'',source.label),sources:options=>AttachmentReferences.sources(options),integrityIssue:id=>BackupIntegrity?.attachmentIssue(String(id||''))||null,destinations:()=>LibraryView.noteDestinations(),settle:settleAttachmentWriters,openLibrary:()=>{LibraryView.showSection('data');void goTab('library',{source:'attachment-library'});},
  openSource:async source=>{if(!await goTab('library',{source:'attachment-reference'}))return false;if(source.kind==='note')return LibraryView.revealNoteReference(source.key);if(source.kind==='day')return LibraryView.openDay(source.key);return false;},
  preparePdfOpen:()=>PdfDocuments.prepareNativeWindow(),
  openPdf:(row,file,reservedWindow,releaseReader)=>PdfDocuments.open(row,file,reservedWindow,releaseReader),
  deletionGuard:async options=>{if(journalHasState(await AppData.restoreJournal.read()))throw new Error('Finish backup recovery before deleting attachments.');if(!options?.allowLibraryClearJournal&&journalHasState(await AppData.libraryClearJournal.read()))throw new Error('Finish Library data recovery before deleting attachments.');const token=AppOwnership.issueWriteToken('delete attachment'),revision=richAssetReferenceRevision,dataset=await AppData.dailyRecords.datasetRevision();if(dataset===null)throw new Error('Saved notes could not be verified.');return ()=>{AppOwnership.assertWriteToken(token,'delete attachment');return revision===richAssetReferenceRevision;};},
  runExclusive:(kind,operation)=>AppMutationCoordinator.runExclusive(kind,authority=>withRestoreSessionPersistenceSuppressed(()=>operation(authority))),
  quiesce:(operation,options)=>quiesceAttachmentMutation(operation,options),
  removeReferences:(id,_refs,assert)=>AttachmentReferences.removeEverywhere(id,assert),
  insert:(key,row)=>insertAttachmentIntoNote(key,row)
 }));
const RichTextAttachmentPort=LibraryDocuments.richAttachmentPort;
invalidateAttachmentLibrary=()=>requireAttachmentLibrary().invalidate();

function normalizeAttachmentIntegrityState(value:Parameters<typeof BackupIntegrityHostModule['normalizeAttachmentState']>[0]){return BackupIntegrityHostModule.normalizeAttachmentState(value,AttachmentsModule.validId);}
function normalizeRepositoryIntegrityTarget(value:Parameters<typeof BackupIntegrityHostModule['normalizeRepositoryTarget']>[0]){return BackupIntegrityHostModule.normalizeRepositoryTarget(value,IntegrityContinuationModule.normalize);}
function normalizeRepositoryIntegrityState(value:Parameters<typeof BackupIntegrityHostModule['normalizeRepositoryState']>[0]){return BackupIntegrityHostModule.normalizeRepositoryState(value,IntegrityContinuationModule.normalize);}
function renderIntegrityStatuses(){return BackupIntegrity?.render()||false;}
function requestRepositoryIntegrityRecheck(target:Parameters<NonNullable<typeof BackupIntegrity>['requestRepositoryRecheck']>[0]){return BackupIntegrity?.requestRepositoryRecheck(target)||Promise.resolve(false);}
function scheduleAttachmentIntegrityAudit(delay=15000,trigger='scheduled'){return BackupIntegrity?.scheduleAttachment(delay,trigger)||false;}
function installAttachmentIntegrityAudit(){return BackupIntegrity?.installAttachment()||Promise.resolve(null);}
function installRepositoryIntegrityScrub(){return BackupIntegrity?.installRepository()||Promise.resolve(null);}

async function libraryClearSnapshot(){
  const [attachments,sources]=await Promise.all([requireAttachmentLibrary().inventory(),AttachmentReferences.sources({includeLive:false})]);
  return Object.freeze({attachments,sources});
}
async function assertLibraryClearEligible(){
  if(hasBlockingActiveSession())throw new Error('End or suspend the active session before clearing Library data.');
  if(journalHasState(await AppData.restoreJournal.read()))throw new Error('Finish backup recovery before clearing Library data.');
  if(journalHasState(await AppData.libraryClearJournal.read()))throw new Error('An interrupted Library clear requires recovery before another clear can start.');
  if(!appCanMutate())throw new Error('Use the primary tab to clear Library data.');
  return true;
}
type LibraryClearCoordinatorInput=Parameters<typeof LibraryClearModule.createCoordinator>[0];
const LibraryClearCoordinator=LibraryClearModule.createCoordinator(Object.freeze<LibraryClearCoordinatorInput>({
  diagnostics:Object.freeze<NonNullable<LibraryClearCoordinatorInput['diagnostics']>>({start:BackupOperationDiagnostics.start,mark:BackupOperationDiagnostics.mark,finish:BackupOperationDiagnostics.finish,fail:BackupOperationDiagnostics.fail}),
  runExclusive:(kind,operation)=>AppMutationCoordinator.runExclusive(kind,()=>withRestoreSessionPersistenceSuppressed(operation)),
  canMutate:()=>AppOwnership.canMutate(),assertAuthority:options=>AppMutationCoordinator.assertAuthority(options),assertEligible:assertLibraryClearEligible,settle:settleAttachmentWriters,snapshot:libraryClearSnapshot,
  // The connected backup location keeps a protected copy first: the Device
  // Folder, otherwise Google Drive while signed in. With neither, Clear
  // Library relies on its own local safeguards.
  createProtectedSafety:async purpose=>{
    const location=BackupProviderRuntime.list().find(item=>item.id==='device-folder'&&item.connected)||BackupProviderRuntime.list().find(item=>item.connected);
    if(!location)return Object.freeze({verified:false,skipped:true,reason:'no-backup-location'});
    const safety=await BackupProviderRuntime.createProtectedSafety(location.id,purpose);
    if(!safety||safety.verified!==true)throw new Error(`Clear Library stopped because the ${location.label} safety version could not be verified. Your Library data was not changed.`);
    return safety;
  },capture:LibraryClearState.capture,
  deleteNotes:()=>AppData.notes.clearAll(),deleteSavedDays:()=>AppData.dailyRecords.clearAll(),removeReferences:LibraryClearState.rewriteReferences,verifyLogical:LibraryClearState.verifyLogical,
  removeAttachmentMetadata:ids=>requireAttachmentLibrary().removeMetadata(ids),verifyFinal:LibraryClearState.verifyFinal,restore:LibraryClearState.restore,verifyRestore:LibraryClearState.verifyRestore,sweep:()=>requireAttachmentLibrary().sweepOrphans(),
  failClosed:message=>AppMutationCoordinator.failClosed(message,'library-clear'),clearFault:()=>AppMutationCoordinator.clearFault(),
  journal:Object.freeze<LibraryClearCoordinatorInput['journal']>({
    prepare:async value=>{const raw=await AppData.libraryClearJournal.prepare(value);const state=raw&&typeof raw==='object'?Reflect.get(raw,'state'):null,id=state&&typeof state==='object'?String(Reflect.get(state,'id')||''):'';if(!id)throw new Error('Library clear journal preparation did not return an identity.');return {state:{id},payload:raw&&typeof raw==='object'?Reflect.get(raw,'payload'):null};},
    read:async()=>{const raw=await AppData.libraryClearJournal.read();const state=raw&&typeof raw==='object'?Reflect.get(raw,'state'):null,id=state&&typeof state==='object'?String(Reflect.get(state,'id')||''):'';return id?{state:{id},payload:raw&&typeof raw==='object'?Reflect.get(raw,'payload'):null}:null;},
    mark:(id,phase)=>AppData.libraryClearJournal.mark(id,phase),clear:id=>AppData.libraryClearJournal.clear(id)
  })
}));
// P5.7B owns kept-version refresh/review state in the checked recovery host.
// Library/profile callers keep this deferred reference because they are composed
// before the Backup runtime and therefore before its kept-version controller.
// Library → Data says what this device holds from a newer version.
function renderUnsupportedData(){
  scheduleSyncStatus();
  const state=UnsupportedData.summary(),row=document.getElementById('unsupported-data'),text=document.getElementById('unsupported-data-text');
  if(row)row.hidden=!state.total;
  if(text)text.textContent=state.total?`${UnsupportedData.describe(state)} on this device ${state.total===1?'was':'were'} saved by a newer version of Study Director. ${state.total===1?'It is':'They are'} kept safe but hidden here, and Drive sync is paused until you update the app.`:'';
}
// Update app: look for the newer version; say so when there is none yet.
async function checkUnsupportedUpdate(){
  try{
    await PwaLifecycle.checkForUpdate();
    if(!PwaLifecycle.status().updateReady)Interactions.notify({source:'unsupported-data',key:'no-update',title:'No newer version yet',message:'This device has the newest version it can get right now. The data stays safe and hidden until an update arrives.'});
  }catch(error){AppDiagnostics.capture('unsupported-data.update-check',error,'warn');}
}
type LibraryViewInput=Parameters<typeof LibraryModule.createView>[0];
const LibraryView=LibraryModule.createView(Object.freeze<LibraryViewInput>({ports:Object.freeze<LibraryViewInput['ports']>({
  notifications:NoticeCoordinator.presentation('library',Object.freeze({label:'Open Library',run:()=>goTab('library')})),
  records:Object.freeze<LibraryViewInput['ports']['records']>({
    get:date=>AppData.dailyRecords.get(date),
    remove:date=>AppData.dailyRecords.remove(date),
    sortedSummaries:()=>AppData.dailyRecords.sortedSummaries()
  }),
  domain:Object.freeze<LibraryViewInput['ports']['domain']>({
    countTaskOutcomes:tasks=>countTaskOutcomes([...tasks]),earliestSupportedSavedDate:()=>APP_LIMITS.minSupportedSavedDate,isTrackableBlock,isValidIsoDate,isSupportedSavedDate,todayISO,sanitizePracticeRuns,
    sanitizeTaskOutcomeCounts,taskOutcomeSummaryText
  }),
  presentation:Object.freeze<LibraryViewInput['ports']['presentation']>({
    createSavedDayTaskReviewCard,createPomodoroSummaryLine,emptyMsg,
    optionalDurationLabel,optionalHoursLabel,optionalPercentLabel,populatePracticeRunTable,prettyDate,renderRichTextContent,textEl,plainTextContent,
  }),
  view:Object.freeze<LibraryViewInput['ports']['view']>({document,goTab:(tab,options)=>goTab(tab,options),setStatus,setTextSafe,window}),
  interactions:Object.freeze<LibraryViewInput['ports']['interactions']>({
    choose:options=>Interactions.choose(options),confirm:options=>Interactions.confirm(options),input:options=>Interactions.input(options)
  }),
  environment:Object.freeze<LibraryViewInput['ports']['environment']>({
    cancelAnimationFrame:frame=>cancelAnimationFrame(frame),
    createOption:(text,value)=>new Option(text,value),
    createSearchWorker:()=>new Worker(trustedAssetURL(NOTES_SEARCH_WORKER_URL),{name:'study-director-note-search'}),
    requestAnimationFrame:callback=>requestAnimationFrame(callback)
  }),
  exporter:LibraryDocuments.exporter,
  diary:Object.freeze<LibraryViewInput['ports']['diary']>({
    bindEditor:(field,date,record,options)=>LibraryDiaryEditor.bind(field,date,record,options),
    captureEditor:(field,event)=>LibraryDiaryEditor.capture(field,event),
    deleteEntry:(date,options)=>LibraryDiaryEditor.deleteEntry(date,options),
    draft:date=>LibraryDiaryEditor.draft(date),
    clearEditor:field=>LibraryDiaryEditor.clear(field),
    scheduleEditor:(field,value)=>LibraryDiaryEditor.schedule(field,value),
    flushEditor:(field,options)=>LibraryDiaryEditor.flush(field,options),
    settled:field=>LibraryDiaryEditor.settled(field)
  }),
  notes:Object.freeze<LibraryViewInput['ports']['notes']>({
    areaUse:title=>LibraryNoteWorkflows.areaUse(title),
    bindEditor:bindNoteEditor,
    focusEditor:field=>{void RichTextRuntime.activate(field,{focus:true}).catch(error=>AppDiagnostics.capture('library.note-focus',error,'warn'));},
    // Recently deleted gives way at the limit, so only live notes count here.
    canCreate:()=>NotesRuntime.canCreate(),
    catalogue:noteCatalogue,
    clearEditor:clearTaskNoteEditorBinding,
    clearFind:field=>RichTextRuntime.clearFind(field),
    commitEditor:commitTaskNoteEditor,
    find:(field,query,onClear)=>RichTextRuntime.find(field,query,onClear),
    findStep:(field,direction)=>RichTextRuntime.findStep(field,direction),
    get:key=>AppData.notes.get(key),
    importFiles:(files,parent)=>importNoteFiles(files,parent),
    linksBar:options=>NoteLinks.bar(options),
    normalizeArea:normalizeOngoingAreaInput,
    normalizeTag:value=>RichTextApi.normalizeTag(value),
    orderEntries:orderOngoingAreaEntries,
    purgeTrash:()=>AppData.notes.purgeExpiredTrash(),
    remove:key=>LibraryNoteWorkflows.remove(key),
    renameTag:(from,to)=>renameNoteTag(from,to),
    rename:(entry,value,options)=>LibraryNoteWorkflows.rename(entry,value,options),
    renderInherited:renderInheritedNotes,
    restore:key=>LibraryNoteWorkflows.restore(key),
    reviewKept:id=>void requireKeptVersions().review(id),
    keptVersion:id=>requireKeptVersions().note(id),
    searchDocuments:noteSearchDocuments,
    size:()=>NotesRuntime.size(),
    tagged:names=>NoteLinks.tagged(names),
    tags:()=>NoteLinks.tags(),
    trash:key=>LibraryNoteWorkflows.trash(key),
    trashSnapshot:()=>AppData.notes.trashSnapshot(),
    versions:async target=>{const value=await withBackupPassword(()=>requireBackupRecoveryHost().history.openNote(target));if(!value||typeof value!=='object')return {};const reason=objectField(value,'reason'),opened=objectField(value,'opened');return Object.freeze({...((typeof reason==='string')?{reason}:{}),...((typeof opened==='boolean')?{opened}:{})});},
    print:(key,title)=>LibraryDocuments.printNote(key,title)
  }),
  attachments:Object.freeze<LibraryViewInput['ports']['attachments']>({
    batch:operation=>requireAttachmentLibrary().batch(operation),
    close:()=>requireAttachmentLibrary().close(),
    count:()=>requireAttachmentLibrary().count(),
    invalidate:()=>requireAttachmentLibrary().invalidate(),
    reconcile:()=>requireAttachmentLibrary().reconcile(),
    refresh:()=>requireAttachmentLibrary().refresh()
  }),
  preferences:Object.freeze<LibraryViewInput['ports']['preferences']>({
    read:()=>AppData.local.getJson(STORAGE_KEYS.libraryView,null),
    write:value=>AppData.local.setJson(STORAGE_KEYS.libraryView,value)
  }),
  clearLibrary:Object.freeze<LibraryViewInput['ports']['clearLibrary']>({
    preflight:selection=>LibraryClearCoordinator.preflight(selection),
    execute:options=>RichTextRuntime.quiesce(()=>LibraryClearCoordinator.execute(options))
  }),
  ownership:Object.freeze<LibraryViewInput['ports']['ownership']>({canMutate:()=>appCanMutate(),revision:()=>AppOwnership.revision}),
  overlays:Object.freeze<LibraryViewInput['ports']['overlays']>({createAnchoredPopover:(popup,options)=>RichTextApi.createAnchoredPopover(popup,options)}),
  session:Object.freeze<LibraryViewInput['ports']['session']>({hasActiveSession:hasBlockingActiveSession})
})}));
if(!Object.isFrozen(LibraryView)||LibraryView.format!=='study-director.library-view'||LibraryView.contractVersion!==1){
  throw new Error('Study Director Library view is unavailable or incompatible.');
}
type NavigationInput=Parameters<typeof NavigationModule.createController>[0];
NavigationController=NavigationModule.createController(Object.freeze<NavigationInput>({
  window,
  host:Object.freeze<NavigationInput['host']>({
    currentTab:()=>String(document.querySelector('.pane.on')?.id||'pane-plan').replace(/^pane-/,'')||'plan',
    prepare:prepareTabDeparture,
    present:presentTabCommit,
    commit:commitTabView,
    ready:waitForTabReady,
    report:(boundary,error)=>AppDiagnostics.capture(boundary,error,'warn'),
    workspace:Object.freeze<NonNullable<NavigationInput['host']['workspace']>>({
      current:()=>WorkspaceRouteCoordinator.current(),
      reconcile:(descriptor,context)=>WorkspaceRouteCoordinator.reconcile(descriptor,context)
    })
  })
}));
if(!Object.isFrozen(NavigationController)||NavigationController.format!=='study-director.navigation-controller'||NavigationController.contractVersion!==1){
  throw new Error('Study Director navigation controller is unavailable or incompatible.');
}
refreshLibraryNotes=LibraryView.refreshNotes;
updateNoteSearchDocument=LibraryView.updateSearchDocument;
/* BACKUP MODULE COMPOSITION */
type BackupCodecInput=Parameters<typeof BackupCodecModule.createBackupCodec>[0];
const BackupCodecProcessing=Object.freeze<BackupCodecInput['processing']>({
  run:Exports.run as BackupCodecInput['processing']['run'],
  scope:operation=>Exports.scope(operation)
});
const BackupCodec=BackupCodecModule.createBackupCodec(Object.freeze<BackupCodecInput>({
  processing:BackupCodecProcessing,
  appConfig:Object.freeze<BackupCodecInput['appConfig']>({
    appName:APP_CONFIG.appName,
    attribution:APP_CONFIG.attribution
  }),
  limits:APP_LIMITS,
  dataContract:DATA_CONTRACT,
  entityTypes:BACKUP_ENTITY_TYPES,
  keyedRecord:KeyedRecord,
  entities:Object.freeze<BackupCodecInput['entities']>({entityDefinition,entityIdentity}),
  helpers:Object.freeze({boundedInt,jsonByteLength}),
  richText:Object.freeze<BackupCodecInput['richText']>({assetIds:value=>RichTextApi.scanAttachmentReferences(value).assetIds,assetIdValid:AttachmentsModule.validId,imageMimeTypeValid:AttachmentsModule.validType}),
  dailyRecordCodec:DailyRecordCodec,
  activeSessionCodec:ActiveSessionCodec,
  personalDataCodec:PersonalDataCodec,
  pendingReviewCodec:PendingReviewCodec
}));

const RuntimeBackupCodec=Object.freeze({...BackupCodec,inspect:BackupCodec.inspectCurrent});

function restoreSessionStateThroughLifecycle(...args:Parameters<typeof SessionActions.restoreSessionStateThroughLifecycle>){return SessionActions.restoreSessionStateThroughLifecycle(...args);}
function verifyRestoredTimerRuntimeSemantics(...args:Parameters<typeof SessionActions.verifyRestoredTimerRuntimeSemantics>){return SessionActions.verifyRestoredTimerRuntimeSemantics(...args);}
function verifyRestoredSessionRuntime(...args:Parameters<typeof SessionActions.verifyRestoredSessionRuntime>){return SessionActions.verifyRestoredSessionRuntime(...args);}

// Byte staging finishes before the single attachment metadata commit. Rollback
// replaces the catalogue; physical reclamation still waits for all readers.
type NoteReconciliationInput=Parameters<typeof ReconciliationUIModule.createController>[0];
const NoteReconciliationUI=ReconciliationUIModule.createController(Object.freeze<NoteReconciliationInput>({ports:Object.freeze<NoteReconciliationInput['ports']>({
  configuration:Object.freeze<NoteReconciliationInput['ports']['configuration']>({maxWords:APP_LIMITS.maxRichTextWords,maxBytes:APP_LIMITS.maxRichTextBytes}),
  richText:Object.freeze<NoteReconciliationInput['ports']['richText']>({mountRichTextEditor:RichTextApi.mountRichTextEditor,compareRichText:RichTextApi.compareRichText,mergeIncomingAdditions:RichTextApi.mergeIncomingAdditions,appendIncomingAdditions:RichTextApi.appendIncomingAdditions,mergeThreeWay:RichTextApi.mergeThreeWay}),
  assets:Object.freeze<NoteReconciliationInput['ports']['assets']>({get:assetId=>RichTextAssets.get(assetId)}),
  diagnostics:Object.freeze({capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level)}),
  view:Object.freeze<NoteReconciliationInput['ports']['view']>({document,requestAnimationFrame:callback=>requestAnimationFrame(callback),cancelAnimationFrame:id=>cancelAnimationFrame(id)})
})}));
type BackupRuntimeHostInput=Parameters<typeof BackupRecoveryHostModule.createRuntime>[0];
const BackupRuntimeHost=BackupRecoveryHostModule.createRuntime(Object.freeze<BackupRuntimeHostInput>({
  module:BackupModule,
  configuration:Object.freeze<BackupRuntimeHostInput['configuration']>({
    appVersion:APP_VERSION,backupVersion:DATA_CONTRACT.schemas.Backup.version,starterSchedule:FACTORY_DEFAULTS.scheduleText,
    limits:APP_LIMITS
  }),
  appData:AppData,storageHealthKey:STORAGE_KEYS.storageHealth,storageHealth:Object.freeze<BackupRuntimeHostInput['storageHealth']>({snapshot:()=>requireStorageHealthController().snapshot(),markOk:(source,key)=>requireStorageHealthController().markOk(source,key)}),
  storageGeneration:()=>IndexedDb.lifecycle().resets,
  personal:Object.freeze<BackupRuntimeHostInput['personal']>({draft:PlanDraftEditor,data:PlanData,inputValue:()=>{const field=document.getElementById('plan-input');return field instanceof HTMLTextAreaElement||field instanceof HTMLInputElement?field.value:null;},canMutate:()=>appCanMutate()}),
  files:BackupFiles,processing:Exports,protection:BackupProtection,backgroundAvailable:backupBackgroundAvailability,
  assets:Object.freeze<BackupRuntimeHostInput['assets']>({
    during:operation=>AttachmentStorage.during(operation),get:id=>AttachmentStorage.get(id),put:(id,blob)=>AttachmentStorage.put(id,blob),keys:()=>AttachmentStorage.keys(),list:()=>AttachmentStorage.list(),
    stage:(id,blob,options)=>AttachmentStorage.put(id,blob,{stage:true,token:options.token,...(options.signal?{signal:options.signal}:{}),check:options.check}),
    publish:(rows,token,check,options)=>AttachmentStorage.publish(rows,token,check,options),discard:rows=>AttachmentStorage.discard(rows),
    identify:blob=>AttachmentsModule.identify(blob),issueToken:reason=>AppOwnership.issueWriteToken(reason),assertToken:(token,reason)=>AppOwnership.assertWriteToken(token,reason),
    removeMany:ids=>RichTextAssets.removeMany(ids),removeMetadata:ids=>requireAttachmentLibrary().removeMetadata(ids),invalidateLibrary:()=>invalidateAttachmentLibrary(),scheduleMaintenance:delay=>scheduleRichTextAssetMaintenance(delay)
  }),
  referenceRevision:()=>richAssetReferenceRevision,mutationGeneration:()=>captureMutationGeneration,baseline:ReconciliationBaselineStore,
  codecs:Object.freeze<BackupRuntimeHostInput['codecs']>({activeSession:ActiveSessionCodec,backup:RuntimeBackupCodec,dailyRecord:DailyRecordCodec,pendingReview:PendingReviewCodec}),
  reconciliation:Object.freeze<BackupRuntimeHostInput['reconciliation']>({createPlan:ReconciliationModule.createPlan,resolvePlan:ReconciliationModule.resolvePlan,summarizePlan:ReconciliationModule.summarizePlan,savedDayContentValue:ReconciliationModule.savedDayContentValue}),
  noteReconciliation:Object.freeze<BackupRuntimeHostInput['noteReconciliation']>({controller:NoteReconciliationUI,maintenancePause:RecoveryAssetMaintenancePause,merge:(base,local,incoming)=>RichTextApi.mergeThreeWay(base,local,incoming)}),
  recoveryNotes:Object.freeze<BackupRuntimeHostInput['recoveryNotes']>({lifecycle:SessionLifecycle,date:()=>getReviewDate()}),
  session:Object.freeze<BackupRuntimeHostInput['session']>({
    canMutate:()=>appCanMutate(),cancelLiveDraftSave:()=>cancelPendingLiveDraftSave(),captureSnapshot:captureSessionSnapshot,
    checkpointPendingReview:async options=>await ReviewEditor.flushPending({strict:true,backupCapture:options?.backupCapture===true,allowDuringRecoveryQuiescence:true})!==false,
    hasActiveSession:hasBlockingActiveSession,hasTasks:()=>TASKS.length>0,toActiveSession:snapshot=>requireActiveSessionRuntime().payload(snapshot),
    withPersistenceSuppressed:operation=>withRestoreSessionPersistenceSuppressed(operation),yieldSession:options=>yieldSessionToOtherDevice(options)
  }),
  domain:Object.freeze<BackupRuntimeHostInput['domain']>({clampText,filenameSafeStudentName,getStudentName:getStudentNameFromDisplay,materializeDailyRecordView,sanitizeCurrentDailyRecord,todayISO}),
  view:Object.freeze<BackupRuntimeHostInput['view']>({presentation:BackupPresentation,refreshPnote,refreshReview:()=>ReviewView.refresh(),renderSchedule:renderSched,deviceName:(id,others)=>deviceName(id,others)}),
  events:Object.freeze<BackupRuntimeHostInput['events']>({
    libraryChanged:()=>{void LibraryView.render();if(ReviewDayState.reminder.date)void revalidateSaveReminderAfterCanonicalConvergence();},
    restoreSessionState:restoreSessionStateThroughLifecycle,verifyActiveSessionRuntime:verifyRestoredSessionRuntime,
    notifyBackupChange:change=>notifyBackupChange(change),settleStorageReset:()=>settleStorageReset(),
    resetBackupNudge:()=>BackupNudge?.reset(),refreshStorageWarning:()=>refreshStorageFallbackWarning(),scheduleUpdate:delay=>schedulePwaUpdateEvaluation(delay)
  }),
  verifiedRecovery:VerifiedRecovery,
  interactions:Object.freeze<BackupRuntimeHostInput['interactions']>({
    choose:async options=>await Interactions.choose(options),
    configure:async options=>await Interactions.configure(compactInteractionOptions(options)),
    notify:async options=>Interactions.notify(options)
  }),
  operations:Object.freeze<BackupRuntimeHostInput['operations']>({assertAuthority:options=>requireMutationCoordinator().assertAuthority(options),canShare:()=>UnsupportedData.held()?'unsupported-data':true,clearFault:()=>requireMutationCoordinator().clearFault(),failClosed:message=>requireMutationCoordinator().failClosed(message),runExclusive:(kind,operation)=>requireMutationCoordinator().runExclusive(kind,operation)}),
  environment:Object.freeze<BackupRuntimeHostInput['environment']>({AbortController,yieldTask:options=>BackgroundTasks.yieldTask(options?.signal?{signal:options.signal,...(options.priority?{priority:options.priority}:{})}:options?.priority?{priority:options.priority}:undefined),clearTimeout:timer=>clearTimeout(timer),setTimeout:(callback,delay)=>setTimeout(callback,delay)}),
  diagnostics:Object.freeze<BackupRuntimeHostInput['diagnostics']>({capture:AppDiagnostics.capture,start:BackupOperationDiagnostics.start,mark:BackupOperationDiagnostics.mark,finish:BackupOperationDiagnostics.finish,fail:BackupOperationDiagnostics.fail})
}));
if(!Object.isFrozen(BackupRuntimeHost)||BackupRuntimeHost.format!=='study-director.backup-runtime-host'||BackupRuntimeHost.contractVersion!==1){
  throw new Error('Study Director Backup runtime host is unavailable or incompatible.');
}
const BackupRuntime=BackupRuntimeHost.runtime;
const {controller:BackupController,checkpoint:CheckpointPipeline,repository:RepositoryCheckpointPipeline,providers:BackupProviderRuntime}=BackupRuntime;
const KeptVersionsView=BackupRecoveryHostModule.createKeptVersionsView(Object.freeze<Parameters<typeof BackupRecoveryHostModule.createKeptVersionsView>[0]>({document,count:()=>KeptVersions?.count()||0}));
if(!Object.isFrozen(KeptVersionsView)||KeptVersionsView.format!=='study-director.kept-versions-view'||KeptVersionsView.contractVersion!==1){
  throw new Error('Study Director Kept Versions view is unavailable or incompatible.');
}
type KeptVersionsInput=Parameters<typeof BackupRecoveryHostModule.createKeptVersions>[0];
KeptVersions=BackupRecoveryHostModule.createKeptVersions(Object.freeze<KeptVersionsInput>({
  controller:Object.freeze<KeptVersionsInput['controller']>({
    status:()=>BackupController.status(),
    resolveConvergedKeptVersions:()=>BackupController.resolveConvergedKeptVersions(),
    reviewKeptVersions:options=>BackupController.reviewKeptVersions(options)
  }),
  reviews:Object.freeze<KeptVersionsInput['reviews']>({list:()=>AppData.pendingReviews.list()}),
  diagnostics:Object.freeze<KeptVersionsInput['diagnostics']>({capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level)}),
  environment:Object.freeze<KeptVersionsInput['environment']>({
    canMutate:()=>appCanMutate(),now:()=>Date.now(),
    connectCardOpen:()=>SyncStatusHost?.connectCardOpen()===true,sessionYieldedAt:()=>sessionYieldedAt
  }),
  notifications:Object.freeze<KeptVersionsInput['notifications']>({
    notify:options=>Interactions.notify(options),
    resolveEvent:(source,id)=>NoticeCoordinator.resolveEvent(source,id)
  }),
  view:Object.freeze<KeptVersionsInput['view']>({
    render:()=>KeptVersionsView.render(),renderLocation:()=>renderDriveBackup(),scheduleStatus:()=>scheduleSyncStatus(),
    refreshNotes:()=>LibraryView.refreshNotes()
  })
}));
if(!Object.isFrozen(KeptVersions)||KeptVersions.format!=='study-director.kept-versions'||KeptVersions.contractVersion!==1){
  throw new Error('Study Director kept-version recovery controller is unavailable or incompatible.');
}
type SessionHandoffInput=Parameters<typeof SessionHandoffModule.createController>[0];
type SessionHandoffProvider=SessionHandoffInput['provider'];
type SessionHandoffSource=Awaited<ReturnType<SessionHandoffProvider['readHandoffSource']>>;
type SessionHandoffClaimProjection=Awaited<ReturnType<SessionHandoffProvider['readClaim']>>;
type SessionHandoffClaimResult=Awaited<ReturnType<SessionHandoffProvider['claimOwnership']>>;
function objectField(value:unknown,key:string):unknown{return value&&typeof value==='object'?Reflect.get(value,key):undefined;}
function normalizeSessionClaimProjection(value:unknown):SessionHandoffClaimProjection{
  const state=objectField(value,'state');if(state!=='owned'&&state!=='released')return null;
  const epoch=Number(objectField(value,'epoch'));if(!Number.isFinite(epoch))return null;
  const projection:Record<string,unknown>={state,epoch,applies:objectField(value,'applies')===true,ownedHere:objectField(value,'ownedHere')===true};
  const newer=objectField(value,'newer');if(typeof newer==='boolean')projection['newer']=newer;
  for(const key of ['revision','observedRevision']){const item=Number(objectField(value,key));if(Number.isFinite(item))projection[key]=item;}
  for(const key of ['ownerToken','observedOwnerToken','observedContentFingerprint','handoffToken']){const item=objectField(value,key);if(typeof item==='string')projection[key]=item;}
  return Object.freeze(projection) as NonNullable<SessionHandoffClaimProjection>;
}
function normalizeSessionHandoffSource(value:unknown):SessionHandoffSource{
  const status=String(objectField(value,'status')||'unavailable'),source:Record<string,unknown>={status};
  for(const key of ['reason','checkpointId','sharedContentFingerprint']){const item=objectField(value,key);if(typeof item==='string')source[key]=item;}
  if(value&&typeof value==='object'&&Reflect.has(value,'session'))source['session']=ActiveSessionCodec.sanitizeCurrent(objectField(value,'session'));
  if(value&&typeof value==='object'&&Reflect.has(value,'priorClaim'))source['priorClaim']=normalizeSessionClaimProjection(objectField(value,'priorClaim'));
  return Object.freeze(source) as SessionHandoffSource;
}
function normalizeSessionClaimResult(value:unknown):SessionHandoffClaimResult{
  const result:Record<string,unknown>={status:String(objectField(value,'status')||'unavailable')};
  const reason=objectField(value,'reason');if(typeof reason==='string')result['reason']=reason;
  const rawClaim=objectField(value,'claim'),revision=Number(objectField(rawClaim,'revision'));
  if(rawClaim&&typeof rawClaim==='object'&&Number.isFinite(revision))result['claim']=Object.freeze({...rawClaim as Record<string,unknown>,revision});
  const rawSource=objectField(value,'source');if(rawSource&&typeof rawSource==='object')result['source']=normalizeSessionHandoffSource(rawSource);
  return Object.freeze(result) as SessionHandoffClaimResult;
}
SessionHandoffRuntime=SessionHandoffModule.createController(Object.freeze<SessionHandoffInput>({
  configuration:Object.freeze<SessionHandoffInput['configuration']>({
    providerId:'google-drive',claimWatchMs:SESSION_CLAIM_WATCH_MS,claimSyncRetryMs:SESSION_CLAIM_SYNC_RETRY_MS,
    claimSaveWarning:'The session moved to another device, but the latest local progress has not been verified in browser storage. Keep this tab open; saving will retry. Do not clear its data.'
  }),
  authority:Object.freeze<SessionHandoffInput['authority']>({
    canMutate:()=>appCanMutate(),startupReady:()=>StartupLifecycle.status().fullyInitialized,
    visible:()=>document.visibilityState==='visible',online:()=>navigator.onLine!==false,
    hasTasks:()=>TASKS.length>0,panelElsewhere:()=>sessionPanelMode==='elsewhere'
  }),
  provider:Object.freeze<SessionHandoffInput['provider']>({
    connected:id=>BackupProviderRuntime.connected(id),
    readHandoffSource:async id=>normalizeSessionHandoffSource(await BackupProviderRuntime.readSessionHandoffSource(id)),
    claimOwnership:async(id,request)=>normalizeSessionClaimResult(await BackupProviderRuntime.claimSessionOwnership(id,{
      date:request.date,handoffToken:request.handoffToken,onWrite:request.onWrite,
      decide:async source=>({...await request.decide(normalizeSessionHandoffSource(source))})
    })),
    releaseClaim:(id,claim)=>BackupProviderRuntime.releaseSessionClaim(id,claim),
    readClaim:async id=>normalizeSessionClaimProjection(await BackupProviderRuntime.readSessionClaim(id)),
    scheduleSync:(id,reason)=>BackupProviderRuntime.scheduleSharedSync(id,reason),
    suspendBackground:reason=>BackupProviderRuntime.suspendBackground(reason),
    wakeBackground:reason=>BackupProviderRuntime.wakeBackground(reason)
  }),
  session:Object.freeze<SessionHandoffInput['session']>({
    host:ActiveSessionRuntime,sanitize:value=>ActiveSessionCodec.sanitizeCurrent(value),
    same:(left,right)=>CanonicalModule.same(left,right),nextRevision:seed=>nextSessionRevision(seed),
    contentFingerprint:value=>activeSessionContentFingerprint(value),assetIds:value=>BackupCodec.assetIds(value)
  }),
  plan:Object.freeze<SessionHandoffInput['plan']>({
    flushDraft:()=>PlanDraftEditor.flush(),settled:()=>PlanData.settled(),readDraft:()=>PlanData.readDraft(),
    readCanonicalDraft:async()=>{const value=await AppData.planData.read();return value.draft;},
    displayedDraft:()=>{const field=document.getElementById('plan-input');return field instanceof HTMLTextAreaElement||field instanceof HTMLInputElement?field.value:'';},
    defaultScheduleText:()=>getActiveDefaults().scheduleText
  }),
  runtime:Object.freeze<SessionHandoffInput['runtime']>({
    markContentChanged:()=>markDayContentChanged(),
    captureEvidence:()=>captureRuntimeEvidence({includeActivePause:false,withCompletion:false,includeRecords:true}),
    stopExecution:()=>TimerEngine.stopExecution(),resumeExecution:options=>TimerEngine.resumeAfterPrimaryRestore(options),
  }),
  presentation:Object.freeze<SessionHandoffInput['presentation']>({
    capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level),
    setStatus:(message,ok)=>setPlanStatus(message,ok),
    warnStorage:SessionActions.warnStorage,
    clearStorageWarning:SessionActions.clearStorageWarning,
    notifyNewerClaim:SessionActions.notifyNewerClaim,
    noteBackupChange:reason=>notifyBackupChange({urgent:true,reason})
  }),
  installation:Object.freeze<SessionHandoffInput['installation']>({id:()=>InstallationIdentity.getId()}),
  clock:Object.freeze<SessionHandoffInput['clock']>({nowMs:DecisionClock.nowMs,nowIso:()=>new Date().toISOString()}),
  identity:Object.freeze<SessionHandoffInput['identity']>({uuid:()=>crypto.randomUUID()})
}));
if(!Object.isFrozen(SessionHandoffRuntime)||SessionHandoffRuntime.format!=='study-director.session-handoff'||SessionHandoffRuntime.contractVersion!==1){
  throw new Error('Study Director session handoff runtime is unavailable or incompatible.');
}
// File/location controls, user entry points and foreground/background exclusion
// are owned by the checked P5.7A host boundary.
type BackupControlsInput=Parameters<typeof BackupActionsHostModule.createControls>[0];
BackupActions=BackupActionsHostModule.createControls(Object.freeze<BackupControlsInput>({
  document,controller:BackupController,processing:Exports,protection:BackupProtectionHost,
  device:()=>DeviceBackup,providers:BackupProviderRuntime,presentation:BackupPresentation,
  verifiedAt:source=>VerifiedRecovery.verified(source)?.at||'',timeLabel:storageHealthTime,
  capture:(scope,error)=>AppDiagnostics.capture(scope,error,'warn'),
  resolveFileOpen:()=>NoticeCoordinator.resolveEvent('file','file-open'),
  foregroundChanged,scheduleSyncStatus,renderProfile:()=>renderProfile(),
  firstStartOpen:()=>FirstStart.isOpen(),renderFirstStart:()=>FirstStart.render(),
  scheduleUpdate:delay=>schedulePwaUpdateEvaluation(delay),
  connectDevice:()=>connectDeviceBackupWithRecovery(),connectDrive:()=>connectDriveForProfile(),
  openHistory:()=>BackupRecoveryHost?.history.open()??false
}));
if(!Object.isFrozen(BackupActions)||BackupActions.format!=='study-director.backup-controls'||BackupActions.contractVersion!==1){
  throw new Error('Study Director backup controls are unavailable or incompatible.');
}
function renderDriveBackup(){return requireBackupActions().renderDrive();}
function renderDeviceBackup(state:Parameters<NonNullable<typeof BackupActions>['renderDevice']>[0]){return requireBackupActions().renderDevice(state);}
requireBackupActions().install();
type BackgroundMaintenanceInput=Parameters<typeof BackupMaintenanceHostModule.createBackground>[0];
BackgroundMaintenance=BackupMaintenanceHostModule.createBackground(Object.freeze<BackgroundMaintenanceInput>({
  lifecycle:OperationLifecycle,
  environment:Object.freeze<BackgroundMaintenanceInput['environment']>({now:()=>Date.now(),setTimeout:(callback,delay)=>setTimeout(callback,delay),clearTimeout:handle=>clearTimeout(handle)}),
  authority:Object.freeze<BackgroundMaintenanceInput['authority']>({
    canMutate:()=>appCanMutate(),fullyInitialized:()=>StartupLifecycle.status().fullyInitialized,
    storageResetUnresolved:()=>storageResetUnresolved(),unsupportedDataHeld:()=>UnsupportedData.held()
  }),
  foreground:Object.freeze<BackgroundMaintenanceInput['foreground']>({
    pwaReserved:()=>PwaRuntime.reservationActive(),mutation:AppMutationCoordinator,attachmentIngest:AttachmentIngest,
    exports:Exports,backupController:BackupController,providers:BackupProviderRuntime
  }),
  data:Object.freeze<BackgroundMaintenanceInput['data']>({maintenance:AppData.maintenance,notes:AppData.notes}),
  diagnostics:Object.freeze<BackupIntegrityInput['diagnostics']>({
    capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level),
    start:(kind,label,details)=>BackupOperationDiagnostics.start(kind,label,details),
    mark:(kind,details,traceId)=>BackupOperationDiagnostics.mark(kind,details,traceId),
    finish:(details,traceId)=>BackupOperationDiagnostics.finish(details,traceId),
    fail:(error,details,traceId)=>BackupOperationDiagnostics.fail(error,details,traceId)
  }),
  backgroundOwners:()=>Object.freeze([
    Object.freeze(['attachments',Object.freeze({wake:(trigger:string)=>RichTextAssetMaintenance.wake(trigger)})] as const),
    Object.freeze(['attachment-integrity',Object.freeze({wake:(trigger:string)=>{if(!AttachmentIntegrityJob)return false;return AttachmentIntegrityJob.wake(trigger,true);}})] as const),
    Object.freeze(['temporary-files',BackupFiles] as const),
    Object.freeze(['device-folder',Object.freeze({wake:()=>DeviceBackup?.wake()||false})] as const),
    Object.freeze(['backup-locations',Object.freeze({wake:(trigger:string)=>BackupProviderRuntime.wakeBackground(trigger)})] as const)
  ]),
  scheduleAssetMaintenance:delay=>scheduleRichTextAssetMaintenance(delay),
  intervals:Object.freeze<BackgroundMaintenanceInput['intervals']>({
    maintenanceMs:DATA_MAINTENANCE_SCHEDULE_INTERVAL_MS,failureRetryMs:DATA_MAINTENANCE_FAILURE_RETRY_MS,
    assetCleanupDelayMs:ATTACHMENT_CLEANUP_AFTER_UPKEEP_MS,foregroundRecheckMs:15000
  })
}));
if(!Object.isFrozen(BackgroundMaintenance)||BackgroundMaintenance.format!=='study-director.background-maintenance-host'||BackgroundMaintenance.contractVersion!==1){
  throw new Error('Study Director background maintenance host is unavailable or incompatible.');
}
DataMaintenanceJob=BackgroundMaintenance.job;
type RepositoryMaintenanceInput=Parameters<typeof BackupMaintenanceHostModule.createRepositoryMaintenance>[0];
const RepositoryMaintenanceHost=BackupMaintenanceHostModule.createRepositoryMaintenance(Object.freeze<RepositoryMaintenanceInput>({
  meta:BackupAppMeta,metadataName:'repositoryMaintenancePending',
  diagnostics:Object.freeze({capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level)}),
  environment:Object.freeze<RepositoryMaintenanceInput['environment']>({nowIso:()=>new Date().toISOString(),uuid:()=>crypto.randomUUID()})
}));
BackupProviderRuntime.configureRepositoryMaintenance(RepositoryMaintenanceHost.hooks);

function requireStorageResetRecovery(){
  if(!StorageResetRecovery)throw new Error('Study Director storage-reset recovery is not initialized.');
  return StorageResetRecovery;
}
function canonicalLocalRecoveryEmpty(){return StorageResetRecovery?StorageResetRecovery.canonicalEmpty():Promise.resolve(null);}
function offerDeviceRecoveryIfLocalEmpty(options={}){return requireStorageResetRecovery().offerDeviceRecovery(options);}
function connectDeviceBackupWithRecovery(){return requireStorageResetRecovery().connectDevice();}
function ensureDeviceBackupInstalled(){return requireStorageResetRecovery().ensureDeviceInstalled();}
function storageResetUnresolved(){return StorageResetRecovery?StorageResetRecovery.unresolved():IndexedDb.lifecycle().resets>0;}
function storageResetConnectionsChanged(){return StorageResetRecovery?.connectionsChanged()||false;}
function handleBrowserStorageReset(event={}){return requireStorageResetRecovery().handle(event);}
function resumeUnresolvedStorageReset(){return StorageResetRecovery?.resume()||false;}
function settleStorageReset(){return StorageResetRecovery?.settle()||false;}
function restoreAfterStorageReset(){return requireStorageResetRecovery().restore();}

type DeviceBackupHooksInput=Parameters<typeof BackupActionsHostModule.createDeviceHooks>[0];
const DeviceBackupHooks=BackupActionsHostModule.createDeviceHooks(Object.freeze<DeviceBackupHooksInput>({
  interactions:Object.freeze<DeviceBackupHooksInput['interactions']>({choose:async options=>await Interactions.choose(options)}),capture:(scope,error)=>AppDiagnostics.capture(scope,error,'warn'),
  profileId:()=>Profiles.current()?.id||'',profileScope:()=>ProfileScope.scope,installationId:()=>InstallationIdentity.getId(),backupFolderName:()=>backupFolderName({device:true}),
  render:state=>renderDeviceBackup(state),sourceRevision:()=>BackupRuntimeHost.sourceRevision(),verifiedAt:()=>VerifiedRecovery.verified('device-folder')?.at||''
}));
// The Device Folder is one backup location of the engine. P5.7A owns the
// browser picker, provider callbacks and typed Device Folder storage composition.
type DeviceBackupCompositionInput=Parameters<typeof BackupActionsHostModule.createDeviceBackup>[0];
DeviceBackup=BackupActionsHostModule.createDeviceBackup(Object.freeze<DeviceBackupCompositionInput>({
  module:DeviceBackupModule,storageModule:DeviceFolderStorageModule,
  configuration:Object.freeze<DeviceBackupCompositionInput['configuration']>({metadataKey:APP_META_KEYS.deviceFolder,pickerId:EXTERNAL_REPOSITORY_IDENTITIES.deviceFolderPickerId,settingsTimeoutMs:10*1000}),
  engine:BackupProviderRuntime,
  environment:Object.freeze<DeviceBackupCompositionInput['environment']>({
    backgroundBlocker:()=>backgroundBlocker(),canMutate:()=>appCanMutate(),clearTimeout:timer=>clearTimeout(timer),setTimeout:(callback,delay)=>setTimeout(callback,delay),
    showDirectoryPicker:typeof Reflect.get(window,'showDirectoryPicker')==='function'?async options=>await Reflect.apply(Reflect.get(window,'showDirectoryPicker') as (...args:unknown[])=>Promise<unknown>,window,[options]) as Awaited<ReturnType<NonNullable<DeviceBackupCompositionInput['environment']['showDirectoryPicker']>>>:undefined,
    withLock:work=>navigator.locks?.request?navigator.locks.request(ProfileScope.scoped('study-director-device-folder-prepare'),{mode:'exclusive'},()=>work()):Promise.resolve().then(work)
  }),
  hooks:DeviceBackupHooks,
  presentation:BackupPresentation,
  settings:exactAppMetaStorage(DeviceFolderAppMeta,'deviceFolder',APP_META_KEYS.deviceFolder,'Device Backup'),
  storage:Object.freeze<DeviceBackupCompositionInput['storage']>({
    identities:Object.freeze<DeviceBackupCompositionInput['storage']['identities']>({prefix:EXTERNAL_REPOSITORY_IDENTITIES.backupFolderPrefix,objects:EXTERNAL_REPOSITORY_IDENTITIES.deviceFolderObjects,checkpoints:EXTERNAL_REPOSITORY_IDENTITIES.deviceFolderCheckpoints,commits:EXTERNAL_REPOSITORY_IDENTITIES.deviceFolderCommits}),
    owner:()=>Object.freeze({profile:Profiles.current()?.id||'',scope:ProfileScope.scope,device:InstallationIdentity.getId()}),
    checksum:(blob,{signal}={})=>Exports.run('checksum',{value:blob},{signal}),
    inspectManifest:(file,options)=>RepositoryCheckpointPipeline.inspectManifest(file,options),
    environment:Object.freeze<DeviceBackupCompositionInput['storage']['environment']>({canMutate:()=>appCanMutate(),now:()=>Date.now(),setTimeout:(callback,delay)=>setTimeout(callback,delay),clearTimeout:timer=>clearTimeout(timer),yieldTask:()=>BackgroundTasks.yieldTask({priority:'background'})}),
    limits:Object.freeze<DeviceBackupCompositionInput['storage']['limits']>({publicationMaxAgeMs:RepositoryPolicyModule.protocol.publicationMaxAgeMs,publicationAssertionMarginMs:RepositoryPolicyModule.protocol.publicationAssertionMarginMs,publicationRenewMs:RepositoryPolicyModule.protocol.publicationRenewMs,publicationStaleMs:RepositoryPolicyModule.protocol.publicationStaleMs,maintenanceMaxAgeMs:RepositoryPolicyModule.protocol.maintenanceMaxAgeMs,maintenanceAssertionMarginMs:RepositoryPolicyModule.protocol.maintenanceAssertionMarginMs,responseTimeoutMs:10*1000})
  })
}));
if(!Object.isFrozen(DeviceBackup)||DeviceBackup.format!=='study-director.device-backup'||DeviceBackup.contractVersion!==1){
  throw new Error('Study Director automatic device backup is unavailable or incompatible.');
}
type StorageResetInput=Parameters<typeof BackupRecoveryHostModule.createStorageReset>[0];
StorageResetRecovery=BackupRecoveryHostModule.createStorageReset(Object.freeze<StorageResetInput>({
  authority:Object.freeze<StorageResetInput['authority']>({canMutate:()=>appCanMutate()}),
  canonical:Object.freeze<StorageResetInput['canonical']>({
    dailyRecordsList:()=>AppData.dailyRecords.list({strict:true}),notesReadFreshPayload:()=>AppData.notes.readFreshPayload(),activeSessionLoad:()=>AppData.activeSession.load(0,{strict:true}),
    planDataRead:()=>AppData.planData.read(),attachmentsList:()=>AttachmentStorage.list(),pendingReviewsList:()=>AppData.pendingReviews.list(),
    savedDayDeletions:()=>AppData.deletionRecovery.savedDays(),noteDeletions:()=>AppData.deletionRecovery.notes()
  }),
  writeback:Object.freeze<StorageResetInput['writeback']>({
    installationKeep:()=>InstallationIdentity.keep(),notesRecover:()=>AppData.notes.recoverAfterStorageLoss(),planRewrite:()=>PlanData.rewriteAfterStorageReset(),
    settingsFlush:()=>{protectedPreferencesDirty=true;return flushProtectedPreferences();},hasTasks:()=>TASKS.length>0,
    writeLiveDraft:async()=>{const result=await writeLiveDraftNow({markChanged:false});if(!result)throw new Error('Active Session write did not return a canonical result.');return result;}
  }),
  provider:Object.freeze({
    history:(id,options)=>BackupProviderRuntime.history(id,options),
    restoreRepositoryProviderVersion:(id,options)=>BackupProviderRuntime.restoreRepositoryProviderVersion(id,options),
    bringInRepositoryProvider:(id,options)=>BackupProviderRuntime.bringInRepositoryProvider(id,options),
    syncRepositoryProvider:id=>BackupProviderRuntime.syncRepositoryProvider(id),
    list:()=>BackupProviderRuntime.list(),locationStatus:id=>BackupProviderRuntime.locationStatus(id),
    suspendBackground:reason=>BackupProviderRuntime.suspendBackground(reason),connected:id=>BackupProviderRuntime.connected(id)
  }),
  device:Object.freeze<StorageResetInput['device']>({
    status:()=>requireDeviceBackup().status(),connect:()=>requireDeviceBackup().connect(),install:()=>requireDeviceBackup().install(),refreshPermission:()=>requireDeviceBackup().refreshPermission(),
    rememberAfterStorageReset:()=>requireDeviceBackup().rememberAfterStorageReset()
  }),
  storage:Object.freeze<StorageResetInput['storage']>({
    health:()=>readStorageHealth(),updateHealth:patch=>writeStorageHealth(patch),
    storedHealth:()=>AppData.local.getJson(STORAGE_KEYS.storageHealth,null),indexedDbLifecycle:()=>IndexedDb.lifecycle()
  }),
  presentation:Object.freeze<StorageResetInput['presentation']>({
    restoreChoices:()=>backupRestoreChoices(),openRestore:()=>openBackupRestore(),confirm:async options=>(await Interactions.confirm(compactInteractionOptions(options)))===true,notify:options=>Interactions.notify(options),
    emit:event=>NoticeCoordinator.emit(event),resolve:(source,id)=>NoticeCoordinator.resolveEvent(source,id),subscribe:listener=>NoticeCoordinator.subscribe(listener)
  }),
  ownership:Object.freeze<StorageResetInput['ownership']>({announceStorageReset:detectedAt=>AppOwnership.announceStorageReset(detectedAt)}),
  mutation:Object.freeze<StorageResetInput['mutation']>({settled:()=>AppMutationCoordinator.settled()}),background:Object.freeze<StorageResetInput['background']>({wake:reason=>wakeBackgroundOperations(reason)}),
  session:Object.freeze<StorageResetInput['session']>({hasBlocking:()=>hasBlockingActiveSession(),suspend:()=>suspendTodaySession()}),
  view:Object.freeze<StorageResetInput['view']>({refreshAfterWriteback:()=>{refreshNoteConsumers();renderSched();}}),readiness:Object.freeze<StorageResetInput['readiness']>({reconcileStartupChangeClock:()=>VerifiedRecovery.reconcileStartupChangeClock()}),
  diagnostics:Object.freeze<StorageResetInput['diagnostics']>({capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level)}),
  environment:Object.freeze<StorageResetInput['environment']>({now:()=>Date.now(),nowIso:()=>new Date().toISOString(),setTimeout:(callback,delay)=>setTimeout(callback,delay),clearTimeout:handle=>clearTimeout(handle)})
}));
if(!Object.isFrozen(StorageResetRecovery)||StorageResetRecovery.format!=='study-director.storage-reset-recovery'||StorageResetRecovery.contractVersion!==1){
  throw new Error('Study Director storage-reset recovery is unavailable or incompatible.');
}
type RecoveryHostInput=Parameters<typeof BackupRecoveryHostModule.createHost>[0];
BackupRecoveryHost=BackupRecoveryHostModule.createHost(Object.freeze<RecoveryHostInput>({
  presentation:BackupPresentation,
  cancellation:Object.freeze<RecoveryHostInput['cancellation']>({cancelImport:(reason,options)=>BackupController.cancelImport(reason,options)}),
  diagnostics:Object.freeze<RecoveryHostInput['diagnostics']>({capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level),mark:(phase,details)=>BackupOperationDiagnostics.mark(phase,details)}),
  document,
  interactions:Object.freeze<RecoveryHostInput['interactions']>({choose:async options=>await Interactions.choose(options)}),
  lifecycle:Object.freeze<RecoveryHostInput['lifecycle']>({
    activeSessionIssue:loaded=>BackupRecoveryHostModule.activeSessionIssue({ok:!loaded.error,value:ActiveSessionCodec.sanitizeCurrent(loaded.value),error:loaded.error??null,storage:{local:false,idb:loaded.storage?.idb===true}}),activeSessionLoad:()=>AppData.activeSession.load(0,{strict:true}),activeSessionSettled:()=>AppData.activeSession.settled(),
    attachmentBusy:()=>imagePreparationCount>0||AttachmentIngest.status().busy,canonicalPlanDraft:async()=>(await AppData.planData.read()).draft,deletionRecoveryFlush:()=>AppData.deletionRecovery.flush(),
    flushNotes:()=>AppData.notes.flush({strict:true}),flushPlanDraft:async()=>await PlanDraftEditor.flush(),hasTasks:()=>TASKS.length>0,noteFailure:()=>AppData.notes.failure(),
    planDraft:()=>PlanData.readDraft(),planInputValue:()=>PlanDraftEditor.authoredText(),quiesce:operation=>ManagedRecoveryQuiescence.run(operation),
    savePlanDraft:async options=>await PlanDraftEditor.save(options?.force?{strictDurability:true}:undefined),settleAttachmentWriters:options=>settleAttachmentWriters(options),settlePlan:()=>PlanData.settled(),writeLiveDraft:async()=>{const result=await writeLiveDraftNow({markChanged:false,allowDuringRecoveryQuiescence:true});if(!result)throw new Error('Recovery session write did not return a canonical result.');return result;}
  }),
  managedRecovery:Object.freeze<RecoveryHostInput['managedRecovery']>({createCoordinator:ManagedRecoveryModule.createCoordinator}),
  mutation:Object.freeze<RecoveryHostInput['mutation']>({run:(kind,operation)=>AppMutationCoordinator.runExclusive(kind,operation)}),
  providers:Object.freeze<RecoveryHostInput['providers']>({
    bringInRepositoryProvider:(id,options)=>BackupProviderRuntime.bringInRepositoryProvider(id,options),cancelForeground:(reason,id)=>BackupProviderRuntime.cancelForeground(reason,id),
    configureManagedRecovery:config=>BackupProviderRuntime.configureManagedRecovery(config),configurePendingBackupRetry:config=>BackupProviderRuntime.configurePendingBackupRetry(config),
    history:(id,options)=>BackupProviderRuntime.history(id,options),list:()=>BackupProviderRuntime.list(),noteVersions:(id,noteId,options)=>BackupProviderRuntime.noteVersions(id,noteId,options),removeRepositoryProviderVersion:(id,checkpointId)=>BackupProviderRuntime.removeRepositoryProviderVersion(id,checkpointId),
    restoreRepositoryProviderVersion:(id,options)=>BackupProviderRuntime.restoreRepositoryProviderVersion(id,options),suspendBackground:(reason,options)=>BackupProviderRuntime.suspendBackground(reason,options)
  }),
  session:Object.freeze<RecoveryHostInput['session']>({hasBlocking:()=>hasBlockingActiveSession()}),
  sourceRevision:()=>BackupRuntimeHost.sourceRevision(),
  storage:Object.freeze<RecoveryHostInput['storage']>({
    read:()=>BackupAppMeta.read('managedProviderBackupPending'),
    write:value=>BackupAppMeta.write('managedProviderBackupPending',value,{strict:true}),
    remove:()=>BackupAppMeta.remove('managedProviderBackupPending','',{strict:true})
  }),
  view:Object.freeze<RecoveryHostInput['view']>({
    deviceName:(id,others)=>deviceName(id,others),invalidateAttachments:()=>invalidateAttachmentLibrary(),refreshCore:()=>{renderSched();refreshCoreUi({header:true});},refreshNotes:()=>refreshPnote(),refreshReview:()=>ReviewView.refresh(),
    renderLibrary:()=>{void LibraryView.render();},setStatus:message=>{setTextSafe('backup-status',message);}
  })
}));
if(!Object.isFrozen(BackupRecoveryHost)||BackupRecoveryHost.format!=='study-director.backup-recovery-host'||BackupRecoveryHost.contractVersion!==1){
  throw new Error('Study Director backup-recovery host is unavailable or incompatible.');
}

type RepositoryIntegrityContinuationInput=Parameters<typeof IntegrityContinuationModule.create>[0];
const RepositoryIntegrityContinuation=IntegrityContinuationModule.create(Object.freeze<RepositoryIntegrityContinuationInput>({files:BackupFiles,processing:Exports as RepositoryIntegrityContinuationInput['processing'],protection:BackupProtection,yieldTask:async()=>{await BackgroundTasks.yieldTask({priority:'background'});}}));
type BackupIntegrityInput=Parameters<typeof BackupIntegrityHostModule.createController>[0];
BackupIntegrity=BackupIntegrityHostModule.createController(Object.freeze<BackupIntegrityInput>({
  lifecycle:OperationLifecycle,metadata:Object.freeze<BackupIntegrityInput['metadata']>({attachment:HostAppMeta,repository:BackupAppMeta}),attachmentMetadataName:'attachmentIntegrityAudit',repositoryMetadataName:'repositoryIntegrityScrub',
  storage:AttachmentStorage,references:AttachmentReferences,validAttachmentId:AttachmentsModule.validId,
  data:Object.freeze<BackupIntegrityInput['data']>({datasetRevision:()=>AppData.dailyRecords.datasetRevision()}),referenceRevision:()=>richAssetReferenceRevision,
  authority:Object.freeze<BackupIntegrityInput['authority']>({canMutate:()=>appCanMutate()}),
  background:Object.freeze<BackupIntegrityInput['background']>({upkeepBlocker:()=>upkeepBlocker(),backgroundBlocker:()=>backgroundBlocker(),foregroundBusy:()=>backgroundMaintenanceForegroundBusy()}),
  backgroundTasks:Object.freeze<BackupIntegrityInput['backgroundTasks']>({budget:()=>BackgroundTasks.budget(),yieldTask:options=>BackgroundTasks.yieldTask(options)}),
  provider:BackupProviderRuntime,continuation:Object.freeze<BackupIntegrityInput['continuation']>({verify:options=>{const {signal,...rest}=options;return RepositoryIntegrityContinuation.verify(signal?{...rest,signal}:rest);}}),normalizeContinuation:value=>IntegrityContinuationModule.normalize(value),
  unsafe:Object.freeze<BackupIntegrityInput['unsafe']>({mutation:()=>!!AppMutationCoordinator.status()?.active,attachmentIngest:()=>!!AttachmentIngest.status()?.busy}),
  storageHealth:Object.freeze<BackupIntegrityInput['storageHealth']>({markError:(source,message,options)=>markStorageHealthError(source,message,options),markOk:source=>markStorageHealthOk(source)}),
  invalidateAttachmentLibrary:()=>invalidateAttachmentLibrary(),
  diagnostics:Object.freeze({
    capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level),
    start:(kind,label,details)=>BackupOperationDiagnostics.start(kind,label,details),
    mark:(kind,details,traceId)=>BackupOperationDiagnostics.mark(kind,details,traceId),
    finish:(details,traceId)=>BackupOperationDiagnostics.finish(details,traceId),
    fail:(error,details,traceId)=>BackupOperationDiagnostics.fail(error,details,traceId)
  }),
  document,environment:Object.freeze<BackupIntegrityInput['environment']>({now:()=>Date.now(),nowIso:()=>new Date().toISOString(),uuid:()=>crypto.randomUUID(),setTimeout:(callback,delay)=>setTimeout(callback,delay),clearTimeout:handle=>clearTimeout(handle)}),
  limits:Object.freeze<BackupIntegrityInput['limits']>({attachmentIntervalMs:24*60*60*1000,attachmentRetryMs:10*60*1000,repositoryBatchObjects:4,repositoryBatchBytes:256*1024*1024})
}));
if(!Object.isFrozen(BackupIntegrity)||BackupIntegrity.format!=='study-director.backup-integrity-host'||BackupIntegrity.contractVersion!==1){
  throw new Error('Study Director backup integrity host is unavailable or incompatible.');
}
AttachmentIntegrityJob=BackupIntegrity.attachmentJob;
BackupProviderRuntime.configureIntegrityScrub(BackupIntegrity.repositoryHooks);

const DeviceBackupActivation=BackupActionsHostModule.createDeviceActivation(Object.freeze<Parameters<typeof BackupActionsHostModule.createDeviceActivation>[0]>({
  device:()=>DeviceBackup,
  refreshKinds:new Set([APP_ACTIVATION_KINDS.OWNERSHIP_TAKEOVER,APP_ACTIVATION_KINDS.ORDINARY_FOCUS,APP_ACTIVATION_KINDS.VISIBILITY_RETURN])
}));
AppActivation.subscribe(event=>{
  if((event.kind===APP_ACTIVATION_KINDS.ORDINARY_FOCUS||event.kind===APP_ACTIVATION_KINDS.VISIBILITY_RETURN||event.kind===APP_ACTIVATION_KINDS.OWNERSHIP_TAKEOVER||event.kind===APP_ACTIVATION_KINDS.DATE_ROLLOVER)&&wakeBackgroundOperations('activation')&&Date.now()-CapabilityStorage.lastCheckedAt()>=STORAGE_ESTIMATE_REFRESH_MS)void inspectStorageCapability().catch(error=>AppDiagnostics.capture('storage.estimate-refresh',error,'warn'));
  void DeviceBackupActivation.handle(event.kind).catch(error=>AppDiagnostics.capture('device-backup.permission-refresh',error,'warn'));
});
// A location backs up on its own once this device has backed up to it (the
// Device Folder from when it was chosen). A change found on start is backed up
// only while local data is present.
const AutomaticBackupPolicy=BackupReadinessHostModule.createAutomaticBackupPolicy(Object.freeze<Parameters<typeof BackupReadinessHostModule.createAutomaticBackupPolicy>[0]>({verified:VerifiedRecovery,currentRevision:()=>BackupRuntimeHost.sourceRevision(),canonicalEmpty:()=>StorageResetRecovery.canonicalEmpty()}));
BackupProviderRuntime.configureAutomaticBackup(AutomaticBackupPolicy);
BackupProviderRuntime.configureSessionOwnership(Object.freeze<Parameters<typeof BackupProviderRuntime.configureSessionOwnership>[0]>({
  installationId:()=>InstallationIdentity.getId(),
  today:()=>todayISO(),
  read:async()=>{const loaded=await AppData.activeSession.load(0,{strict:true});if(!loaded||loaded.ok!==true||loaded.error)throw loaded?.error||new Error('Active Session ownership could not be read safely.');const value=loaded.value;return value?Object.freeze({date:value.date,runningOn:value.runningOn,revision:value.revision}):null;}
}));
/* PWA SHELL AND SAFE UPDATE COORDINATION */
type PwaRuntimeInput=Parameters<typeof PwaUpdateHostModule.createController>[0];
const PwaRuntime=PwaUpdateHostModule.createController(Object.freeze<PwaRuntimeInput>({
  configuration:Object.freeze<PwaRuntimeInput['configuration']>({
    assetId:'__SD_PAGE_ASSET_ID__',buildId:'@@SD_BUILD_ID@@',reloadSessionKey:SESSION_STORAGE_KEYS.pwaReload,scope:'./',workerUrl:trustedAssetURL('./sw.js'),
    updateCheckStorageKey:STORAGE_KEYS.pwaUpdateCheck,primaryState:OWNERSHIP_STATES.PRIMARY,secondaryState:OWNERSHIP_STATES.SECONDARY,runningTimerMode:TIMER_MODES.RUNNING
  }),
  lifecycle:Object.freeze<PwaRuntimeInput['lifecycle']>({
    module:PwaLifecycleModule,
    environment:Object.freeze<PwaRuntimeInput['lifecycle']['environment']>({AbortController,MessageChannel:(typeof MessageChannel==='function'?MessageChannel:null) as PwaRuntimeInput['lifecycle']['environment']['MessageChannel'],clearTimeout:timer=>clearTimeout(timer),document,navigator,setTimeout:(callback,delay)=>setTimeout(callback,delay),window})
  }),
  environment:Object.freeze<PwaRuntimeInput['environment']>({document,window,navigator,setTimeout:(callback,delay)=>setTimeout(callback,delay),clearTimeout:timer=>clearTimeout(timer),now:()=>Date.now()}),
  state:Object.freeze<PwaRuntimeInput['state']>({
    startupReady:()=>StartupLifecycle.status().fullyInitialized,ownership:()=>AppOwnership.status(),sessionLifecycle:()=>SessionLifecycle.status(),mutation:()=>requireMutationCoordinator().status(),reviewSave:()=>ReviewSaveService.status(),
    imagePreparationCount:()=>imagePreparationCount,attachmentLibraryBusy:()=>requireAttachmentLibrary().status().busy,attachmentIngestBusy:()=>AttachmentIngest.status().busy,exportsBusy:()=>Exports.status().busy,
    backupBusy:()=>BackupController.status().busy,providerBusy:()=>BackupProviderRuntime.status().busy,
    providerBackgroundBackupActive:()=>BackupProviderRuntime.list().some(row=>BackupProviderRuntime.locationStatus(row.id)?.backingUp===true),
    providerDriveBackingUp:()=>BackupProviderRuntime.locationStatus('google-drive')?.backingUp===true,
    liveTimer:()=>isLiveTrackableTimer(),timerPaused:()=>TimerState.paused,timerMode:()=>TimerState.mode,pacerRunning:()=>PracticePacer.status().running,canMutate:()=>appCanMutate(),
    blockingUiOpen:()=>!!document.querySelector('dialog[open],[data-rich-asset-picker="active"]'),workRevision:()=>pwaWorkRevision,tasks:()=>TASKS,
    isTrackableTask:task=>isTrackableBlock(task&&typeof task==='object'?task as Parameters<typeof isTrackableBlock>[0]:undefined),isTaskResolved:index=>isTaskResolved(index),currentTaskIndex:()=>TimerState.currentIndex
  }),
  reservation:Object.freeze<PwaRuntimeInput['reservation']>({
    settleMutation:()=>requireMutationCoordinator().settled(),suspendProvider:()=>BackupProviderRuntime.suspendBackground('pwa-update'),settleRichTextAssets:()=>RichTextAssetMaintenance.settled(),settleMaintenance:()=>AppData.maintenance.settled(),
    settleAttachmentIntegrity:()=>AttachmentIntegrityJob?AttachmentIntegrityJob.settled():Promise.resolve(),quiesceRichText:run=>RichTextRuntime.quiesce(run),
    runExclusive:(name,run)=>requireMutationCoordinator().runExclusive(name,authority=>run({assert:()=>{authority.assert();}})),runManagedRecovery:run=>ManagedRecoveryQuiescence.run(run),
    yieldFollowerOwnership:()=>{const owner=AppOwnership.status();if(owner.state===OWNERSHIP_STATES.SECONDARY)return true;if(owner.state!==OWNERSHIP_STATES.PRIMARY)return false;AppOwnership.transitionReleasing();AppOwnership.release();AppOwnership.setPrimary(false);return true;},
    projectOwnership:()=>OwnershipUiProjection.apply(),foregroundChanged:()=>foregroundChanged()
  }),
  persistence:Object.freeze<PwaRuntimeInput['persistence']>({
    settleDiary:()=>LibraryView.settleDiary(),flushPlanDraft:async()=>await PlanDraftEditor.flush()!==false,planAuthoredText:()=>PlanDraftEditor.authoredText(),planReadDraft:()=>PlanData.readDraft(),
    savePlanDraft:async()=>await PlanDraftEditor.save()!==false,settlePlanData:()=>PlanData.settled(),readStoredPlan:()=>AppData.planData.read(),
    flushPendingReview:async()=>await flushPendingReviewSave({strict:true,allowDuringRecoveryQuiescence:true})!==false,settleReviewEditor:()=>ReviewEditor.settled(),
    writeLiveDraft:allowDuringRecoveryQuiescence=>writeLiveDraftNow({markChanged:false,allowDuringRecoveryQuiescence}),flushNotes:()=>AppData.notes.flush(),noteFailure:()=>AppData.notes.failure(),
    flushDeletionRecovery:async()=>await AppData.deletionRecovery.flush()!==false,settleActiveSession:()=>AppData.activeSession.settled(),loadActiveSession:()=>AppData.activeSession.load(),
    activeSessionIssue:loaded=>BackupRecoveryHostModule.activeSessionIssue({ok:!loaded.error,value:ActiveSessionCodec.sanitizeCurrent(loaded.value),error:loaded.error??null,storage:{local:false,idb:loaded.storage?.idb===true}})
  }),
  effects:Object.freeze<PwaRuntimeInput['effects']>({
    automaticBackupsWaiting:()=>automaticBackupsWaiting(),flushAutomaticBackups:async reason=>{await flushAutomaticBackups(reason);},pauseTimer:()=>togglePause(),togglePacer:()=>PracticePacer.toggle(),scheduleSyncStatus:()=>scheduleSyncStatus(),
    publishNotice:value=>NoticeCoordinator.publish('update',value),capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level),
    localGet:(key,fallback)=>AppData.local.getText(key,fallback),localSet:(key,value)=>AppData.local.setText(key,value)
  })
}));
const PwaLifecycle=PwaRuntime.lifecycle;
const schedulePwaUpdateEvaluation=(delay?:Parameters<typeof PwaRuntime.scheduleEvaluation>[0])=>PwaRuntime.scheduleEvaluation(delay);
const schedulePwaUpdateCheck=(delay?:Parameters<typeof PwaRuntime.scheduleCheck>[0])=>PwaRuntime.scheduleCheck(delay);
const clearPwaUpdateCheckTimer=()=>PwaRuntime.clearCheckTimer();
const applyPwaUpdateFromUi=()=>PwaRuntime.applyFromUi();
/* INSIGHTS AND PLUGIN BOUNDARY */
// Read-only Insights boundary. Insights modules should read through this object
// and return derived metrics without mutating records, notes, timer state, or storage.
const InsightsBoundary=InsightsHostModule.createBoundary(Object.freeze<Parameters<typeof InsightsHostModule.createBoundary>[0]>({
  dailyRecords:AppData.dailyRecords,
  dailyRecordCodec:DailyRecordCodec,
  notifications:NoticeCoordinator.presentation('insights'),
  logic:Object.freeze({classifyTaskOutcome,summarizePracticeRuns:summarizePracticeRunsForInsights}),
  requestProviderTab:async tab=>await PluginRuntime.requestTab(tab),
  capture:(scope,error)=>AppDiagnostics.capture(scope,error),
  todayISO:()=>todayISO(),
  clampText
}));
const PreviewRuntime=InsightsBoundary.preview;
const AppInsights=InsightsBoundary.appInsights;
const InsightsDeviceState=InsightsHostModule.createDeviceState(Object.freeze<Parameters<typeof InsightsHostModule.createDeviceState>[0]>({
  readWindow:fallback=>AppData.local.getText(STORAGE_KEYS.insightsWindow,fallback),
  writeWindow:value=>AppData.local.setText(STORAGE_KEYS.insightsWindow,value)
}));
/* DOM BINDINGS AND STARTUP */
type DiagnosticRow=Readonly<{job:string;state:string;[key:string]:unknown}>;
function currentBackupDiagnosticStates(){
  const states:DiagnosticRow[]=[];
  const sample=<T>(job:string,read:()=>T,project:(value:T)=>DiagnosticRow|readonly DiagnosticRow[])=>{
    try{
      const projected=project(read()),rows=Array.isArray(projected)?projected:[projected];
      states.push(...rows as readonly DiagnosticRow[]);
    }catch{states.push({job,state:'unavailable',reason:'state-unavailable'});}
  };
  sample('Local storage health',()=>requireStorageHealthController().snapshot(),health=>{
    const rows:DiagnosticRow[]=[{job:'Local storage health',state:health.hasIssues?'attention':'observed',issues:health.issues?.length||0,completedAt:health.lastLocalSaveAt||'',studyDataSavedAt:health.lastStudyDataSaveAt||'',storagePersisted:CapabilityStorage.snapshot().persisted,usageBytes:CapabilityStorage.snapshot().usageBytes,quotaBytes:CapabilityStorage.snapshot().quotaBytes}];
    const sources=['indexedDB','localStorage.read','localStorage.write','planDraft.write','activeSession','notes','dailyRecords','deletionRecovery','maintenance','capacity','backup','attachmentIntegrity','repositoryIntegrity'];
    for(const source of sources){const issue=health.issues?.find(row=>row.source===source);if(issue)rows.push({job:'Storage '+source,state:'attention',severity:issue.level,failedAt:issue.at});}
    return rows;
  });
  sample('Note saving',()=>AppData.notes.failure(),value=>({job:'Note saving',state:value.failed?'failed':'observed',failed:value.failed===true}));
  sample('Write ownership',()=>({primary:appCanMutate(),...requireMutationCoordinator().status()}),value=>({job:'Write ownership',state:value.active?'running':value.recoveryFault?'blocked':value.primary?'primary':'secondary',busy:!!value.active,pending:!!value.recoveryFault,foreign:value.foreign,authorityHealthy:value.authorityHealthy,authorityDurableProtected:value.authorityDurableProtected}));
  sample('Backup controller',()=>BackupController.status(),value=>({job:'Backup controller',...OperationLifecycle.snapshot(value),importActive:value.importActive,importCancelled:value.importCancelled,exportActive:value.standaloneExportActive}));
  sample('Device backup',()=>requireDeviceBackup().status(),value=>({job:'Device backup',...OperationLifecycle.snapshot({busy:value.busy||value.backingUp,pending:value.pending,nextEligibleAt:value.nextEligibleAt}),connected:value.connected,permission:value.permission,stalePermissionResponses:value.stalePermissionResponses,retryAttempt:value.retryAttempt,retryBackoffCapped:value.retryBackoffCapped,completedAt:value.lastBackupAt||''}));
  sample('Provider operation',()=>BackupProviderRuntime.status(),value=>({job:'Provider operation',...OperationLifecycle.snapshot(value)}));
  sample('Provider connection',()=>BackupProviderRuntime.diagnosticConnections(),values=>values.map(value=>({job:value.id==='google-drive'?'Google Drive connection':'External provider connection',state:value.connected?'connected':'disconnected',connected:value.connected,scopeBound:value.scopeBound,retryAttempt:value.retryAttempt,retryBackoffCapped:value.retryBackoffCapped})));
  sample('Backup encryption',()=>BackupProtection.status(),value=>({job:'Backup encryption',state:value.enabled?value.unlocked?'unlocked':'locked':'off',enabled:value.enabled,unlocked:value.unlocked}));
  sample('Canonical maintenance',()=>{
    if(!DataMaintenanceJob)throw new Error('Canonical maintenance job is unavailable.');
    const status=DataMaintenanceJob.status();return {...status,busy:status.busy||AppData.maintenance.status().busy};
  },value=>({job:'Canonical maintenance',...value,...OperationLifecycle.snapshot(value),lastOutcome:value.lastOutcome}));
  sample('Attachment cleanup',()=>RichTextAssetMaintenance.status(),value=>({...value,job:'Attachment cleanup'}));
  sample('Backup scratch cleanup',()=>BackupFiles.status(),value=>({...value,job:'Backup scratch cleanup'}));
  sample('Attachment processor',()=>AttachmentIngest.status(),value=>({...OperationLifecycle.snapshot({busy:value.busy}),job:'Attachment processor'}));
  sample('File processor',()=>Exports.status(),value=>({...OperationLifecycle.snapshot({busy:value.busy}),job:'File processor',phase:value.phase}));
  sample('App update',()=>PwaLifecycle.status(),pwa=>{const update=PwaRuntime.diagnostics();return {job:'App update',state:pwa.phase,busy:pwa.applying||pwa.reloading||pwa.checking,pending:pwa.updateReady,scheduled:update.nextCheckAt>0,nextEligibleAt:update.nextCheckAt?new Date(update.nextCheckAt).toISOString():'',completedAt:update.lastSuccessfulCheckAt?new Date(update.lastSuccessfulCheckAt).toISOString():'',retryAttempt:update.failureCount,bootState:pwa.bootState,cacheState:pwa.cacheState||'',reason:pwa.cacheReason||''};});
  for(const row of BackupIntegrity?.diagnosticRows()||[])states.push(row as DiagnosticRow);
  sample('Drive sync',()=>BackupProviderRuntime.diagnosticSync(),values=>values.map(value=>({job:'Drive sync',state:!value.connected?'disconnected':value.catchingUp?'running':value.needsPassword?'locked':value.needsUpdate||UnsupportedData.held()?'blocked':value.needsReview?'attention':value.behind?'pending':value.syncedAt?'current':'unknown',completedAt:value.syncedAt,attemptedAt:value.checkedAt,nextEligibleAt:value.nextEligibleAt,signInEndsAt:value.signInEndsAt,needsReview:value.needsReview,needsUpdate:value.needsUpdate,needsPassword:value.needsPassword,behind:value.behind,catchingUp:value.catchingUp,turnWaits:value.turnWaits,...(value.waitingFor||value.waitingSince?{waitingFor:PersistenceModule.deviceName(value.waitingFor)||'another device',waitingSince:value.waitingSince,waitingRenewedAt:value.waitingRenewedAt}:{}),keptVersions:requireKeptVersions().count()})));
  sample('Profiles',()=>({count:Profiles.list().length,pending:Profiles.removalPending(),unsupported:Profiles.unsupported()}),value=>({job:'Profiles',state:value.unsupported?'unsupported':value.pending?'pending':'observed',profiles:value.count,removalPending:value.pending>0}));
  sample('Unsupported data',()=>UnsupportedData.summary(),value=>({job:'Unsupported data',state:value.blocked?'blocked':value.protected?'held':value.held?'replaceable':'none',held:value.held,protectedCount:value.protected,savedDays:value.items.days,notes:value.items.notes,assets:value.items.attachments,sessions:value.items.sessions,settings:value.items.settings}));
  sample('Provider background',()=>BackupProviderRuntime.backgroundStatus(),values=>values as readonly DiagnosticRow[]);
  return states;
}
// Why a version was kept, for diagnostics: the kind of difference, not its content.
type DiagnosticPendingReview=Awaited<ReturnType<typeof AppData.pendingReviews.list>>[number];
function keptReviewCause(review:DiagnosticPendingReview){
  if(review.subject==='note'){const kept=review.kept;return !kept?'note-deletion':typeof kept.text==='string'&&typeof kept.label==='string'?'note-text-title':typeof kept.text==='string'?'note-text':'note-title';}
  if(review.subject==='savedDay')return review.kept?'saved-day':'saved-day-deletion';
  if(review.subject==='session')return review.kept?'session':'session-absent';
  return 'settings';
}
type AsyncDiagnosticSpec=Readonly<{job:string;run():Promise<readonly DiagnosticRow[]>}>;
function diagnosticSpec<T>(job:string,read:()=>T|PromiseLike<T>,project:(value:T)=>DiagnosticRow|readonly DiagnosticRow[]):AsyncDiagnosticSpec{
  return Object.freeze({job,async run(){
    const projected=project(await read()),rows=Array.isArray(projected)?projected:[projected];
    return rows as readonly DiagnosticRow[];
  }});
}
// Read current storage and recovery summaries for on-demand diagnostics.
async function readDataDiagnosticStates(){
  const profileStorage=diagnosticSpec('Profile storage',async()=>{
    const base=DATA_CONTRACT.storage.dbName,ours=(name:string)=>name===base||name.startsWith(base+ProfileScope.separator);
    const names=typeof indexedDB?.databases==='function'?(await indexedDB.databases()).map(row=>String(row?.name||'')).filter(ours):null;
    return {names,listed:!!Profiles.current(),listPresent:LocalStorageContract.getText(ProfileScope.registryKey,null)!==null,fresh:IndexedDb.lifecycle().startedFresh===true,clearedAt:String(readStorageHealth().browserDataClearedAt||'')};
  },value=>({job:'Profile storage',state:value.names?'observed':'partial',scoped:!!ProfileScope.scope,profileListPresent:value.listPresent,pageProfileListed:value.listed,startedFresh:value.fresh,...(value.clearedAt?{dataClearedAt:value.clearedAt}:{}),...(value.names?{databases:value.names.length,otherDatabases:value.names.filter(name=>name!==DB_NAME).length}:{})}));

  const keptVersions=diagnosticSpec('Kept versions',()=>AppData.pendingReviews.list(),list=>{
    const open=[...list].filter(review=>!review.resolvedAt).sort((a,b)=>b.keptAt.localeCompare(a.keptAt));
    return [{job:'Kept versions',state:open.length?'pending':'none',count:open.length},...open.slice(0,12).map(review=>({job:'Kept version',state:'pending',subject:review.subject,cause:keptReviewCause(review),device:!review.keptFrom?'not recorded':review.keptFrom===InstallationIdentity.getId()?'this device':PersistenceModule.deviceName(review.keptFrom)||'another device',keptAt:review.keptAt,...(review.keptChangedAt?{changedAt:review.keptChangedAt}:{})}))];
  });

  const maintenanceRecord=diagnosticSpec('Canonical maintenance record',()=>AppData.metadata.diagnostics(),value=>({job:'Canonical maintenance record',state:String(value.maintenanceStatus||'unknown'),pending:value.maintenanceStatus==='pending',completedAt:value.completedAt,queuedDeletions:value.deletions,localRecovery:value.localRecovery}));

  const journalSpec=(job:string,owner:Readonly<{diagnostics():Promise<unknown>}>):AsyncDiagnosticSpec=>diagnosticSpec(job,()=>owner.diagnostics(),value=>{
    const phase=objectField(value,'phase'),updatedAt=objectField(value,'updatedAt');
    return {job,state:value?'pending':'absent',pending:!!value,phase:typeof phase==='string'?phase:'',updatedAt:typeof updatedAt==='string'?updatedAt:'',coverage:'journal-header'};
  });

  const repositoryCleanup=diagnosticSpec('Repository cleanup intent',()=>BackupAppMeta.read('repositoryMaintenancePending'),value=>{
    const raw=objectField(value,'entries'),entries=Array.isArray(raw)?raw:[];
    const rows:DiagnosticRow[]=[{job:'Repository cleanup intent',state:entries.length?'pending':'absent',pending:entries.length>0,count:entries.length}];
    for(const entry of entries){
      const providerId=String(objectField(entry,'providerId')||'');if(!['device-folder','google-drive'].includes(providerId))continue;
      rows.push({job:providerId==='device-folder'?'Device cleanup intent':'Drive cleanup intent',state:'pending',pending:true,reason:String(objectField(entry,'reason')||''),nextEligibleAt:String(objectField(entry,'nextEligibleAt')||''),scopeBound:!!objectField(entry,'repositoryScope')});
    }
    return rows;
  });

  const externalPending=diagnosticSpec('External backup pending',()=>BackupAppMeta.read('managedProviderBackupPending'),value=>{
    const raw=objectField(value,'entries'),entries=Array.isArray(raw)?raw:[];
    return {job:'External backup pending',state:entries.length?'pending':'absent',pending:entries.length>0,count:entries.length};
  });

  const verifiedCopies=diagnosticSpec('Verified external copies',()=>BackupAppMeta.read('verifiedRecoveryBackups'),value=>{
    const providers=objectField(value,'providers'),providerValues:unknown[]=providers&&typeof providers==='object'?Object.values(providers as Record<string,unknown>):[];
    const entries=[objectField(value,'file'),...providerValues].filter((entry):entry is object=>!!entry&&typeof entry==='object');
    const completedAt=entries.map(entry=>String(objectField(entry,'at')||'')).filter(at=>Number.isFinite(Date.parse(at))).sort().at(-1)||'';
    return {job:'Verified external copies',state:entries.length?'recorded':'never',count:entries.length,completedAt,coverage:'recorded-verification'};
  });

  const samples:readonly AsyncDiagnosticSpec[]=[
    profileStorage,keptVersions,maintenanceRecord,
    journalSpec('Restore journal',AppData.restoreJournal),
    journalSpec('Library clear journal',AppData.libraryClearJournal),
    repositoryCleanup,externalPending,verifiedCopies
  ];
  const results=new Map<string,readonly DiagnosticRow[]>();
  const reads=samples.map(sample=>sample.run().then(rows=>results.set(sample.job,rows)).catch(()=>results.set(sample.job,[{job:sample.job,state:'unavailable',reason:'state-unavailable'}])));
  try{await OperationLifecycle.waitForSettlement(reads,{timeoutMs:3000,timeoutCode:'DIAGNOSTIC_SNAPSHOT_TIMEOUT',timeoutMessage:'Diagnostic snapshot could not finish.'});}catch{}
  return samples.flatMap(sample=>results.get(sample.job)||[{job:sample.job,state:'unavailable',reason:'diagnostic-deadline'}]);
}
async function copyBackupDiagnostics(){
  const notice=NoticeCoordinator.presentation('diagnostics').begin({id:'copy-backup',surfaceId:'backup-diagnostics-status',announce:false,title:'Copy data and backup diagnostics'});
  try{
    if(!navigator.clipboard||typeof navigator.clipboard.writeText!=='function')throw new Error('Clipboard access is unavailable.');
    const states=currentBackupDiagnosticStates(),durable=await readDataDiagnosticStates(),text=BackupOperationDiagnostics.text([...states,...durable]);
    await navigator.clipboard.writeText(text);notice.finish('succeeded','Copied',{announce:false,cue:'none',retainInline:false});return true;
  }catch(error){
    notice.finish('failed','Copy failed. Check clipboard permission and try again.',{announce:false,cue:'none'});AppDiagnostics.capture('backup.diagnostics-copy',error,'warn');return false;
  }
}
// App-specific DOM handlers are installed only through the private startup/lifecycle coordinator.
type DelegatedHostInput=Parameters<typeof FoundationHostModule.createDelegated>[0];
const CLICK_ACTIONS:DelegatedHostInput['CLICK_ACTIONS']=Object.freeze({
  'recheck-device-integrity':()=>requestRepositoryIntegrityRecheck('device-folder'),
  'recheck-drive-integrity':()=>requestRepositoryIntegrityRecheck('google-drive'),
  'apply-pwa-update': ()=>applyPwaUpdateFromUi(),
  'protect-local-data': ()=>protectLocalData(),
  'install-notice-action': ()=>runInstallationAction({dismissNotice:true}),
  'check-unsupported-update': ()=>void checkUnsupportedUpdate(),
  'dismiss-install-notice': ()=>CapabilityInstallation.dismissInstallNotice(),
  'toggle-system-alerts': ()=>SystemNotifications.toggle(),
  'connect-device-backup': ()=>BackupActions.connectDevice(),
  'backup-now': ()=>BackupActions.backUpEverywhere(),
  'cancel-device-backup': ()=>BackupActions.cancelDevice(),
  'toggle-backup-settings': ev=>BackupActions.toggleSettings(ev.target instanceof Element?ev.target.closest<HTMLElement>('[data-backup-settings]')?.dataset['backupSettings']:undefined),
  'disconnect-device-backup': ()=>BackupActions.disconnectDevice(),
  'open-version-history': ()=>BackupActions.openHistory(),
  'connect-drive-backup': ()=>BackupActions.connectDrive(),
  'cancel-drive-backup': ()=>BackupActions.cancelDrive(),
  'disconnect-drive-backup': ()=>BackupActions.disconnectDrive(),
  'refresh-version-history': ()=>BackupRecoveryHost.history.refresh(),
  'close-version-history': ()=>BackupRecoveryHost.history.close(),
  'cancel-version-history-operation': ()=>BackupRecoveryHost.history.cancel(),
  'recover-managed-version': ev=>BackupRecoveryHost.history.recover(ev),
  'compare-managed-note': ev=>BackupRecoveryHost.history.recover(ev),
  'remove-managed-version': ev=>BackupRecoveryHost.history.removeVersion(ev),
  'toggle-pause': ()=>togglePause(),
  'practice-mode': ev=>PracticePacer.setSetupMode(ev.target instanceof Element?ev.target.closest<HTMLElement>('[data-practice-mode]')?.dataset['practiceMode']:undefined),
  'practice-total-toggle': ()=>PracticePacer.toggleTotal(),
  'practice-cue-toggle': ()=>PracticePacer.toggleCueMode(),
  'practice-start': ()=>PracticePacer.start(),
  'practice-next': ()=>PracticePacer.next(),
  'practice-undo': ()=>PracticePacer.undoLast(),
  'practice-reset': ()=>PracticePacer.requestReset(),
  'practice-reset-confirm': ()=>PracticePacer.confirmReset(),
  'practice-reset-cancel': ()=>PracticePacer.cancelReset(),
  'practice-delete-run': ev=>deletePracticeRun(ev),
  'practice-toggle': ()=>{const result=PracticePacer.toggle();schedulePwaUpdateEvaluation(150);return result;},
  'practice-finish': ()=>finishPracticePacer(),
  'mark-done': ()=>markDone(),
  'skip-task': ()=>skipTask(),
  'jump-scheduled-now': ()=>recoveryJumpToScheduledNow(),
  'start-scheduled-full': ()=>recoveryStartScheduledFull(),
  'start-remaining-window': ()=>recoveryStartRemainingWindow(),
  'shift-remaining-day': ()=>recoveryShiftRemainingDay(),
  'generate-carry-forward': ()=>recoveryGenerateCarryForward(),
  'copy-carry-forward': ()=>copyCarryForward(),
  'close-unfinished-note': ()=>closeUnfinishedNotePanel(),
  'save-day': ()=>saveDayRecord(),
  'copy-review': ()=>copyReview(),
  'toggle-copy-report-menu': ()=>toggleCopyReportMenu(),
  'reset-copy-report': ()=>resetCopyReportSelection(),
  'render-library': ()=>LibraryView.render(),
  'open-library-day': ev=>LibraryView.openDay(ev.target instanceof Element?ev.target.closest<HTMLElement>('[data-library-date]')?.dataset['libraryDate']:undefined),
  'export-backup': ()=>BackupActions.exportLocal(),
  'clear-library': ()=>LibraryView.clearAll(),
  'backup-protection': ()=>BackupActions.manageProtection(),
  'copy-backup-diagnostics': ()=>copyBackupDiagnostics(),
  'cancel-standalone-import': ()=>BackupActions.cancelStandalone(),
  'pick-import-file': ()=>BackupActions.pickImportFile(),
  'test-sound': ()=>NoticeCoordinator.testSound(),
  'test-system-alert': ()=>SystemNotifications.test(),
  'toggle-pomodoro': ()=>Pomodoro.configuration.toggleNudges(),
  'restore-session': ()=>SessionActions.restoreSessionAction(),
  'suspend-session': ()=>suspendTodaySession(),
  'finish-session': ()=>finishTodaySession(),
  'reset-session': ()=>resetTodaySession(),
  'edit-plan': ()=>PlanDraftEditor.enter(),
  'confirm-plan-edit': ()=>uploadSoonAfterPlanApply(PlanDraftEditor.confirm()),
  'cancel-plan-edit': ()=>PlanDraftEditor.cancel(),
  'load-default': ()=>loadDefaultPlan(),
  'apply-schedule': ()=>SessionActions.applyScheduleAction(),
  'clear-schedule-draft': ()=>PlanDraftEditor.clear(),
  'open-notes': ()=>openNotesLibrary(),
  'toggle-pnote-info': ()=>togglePnoteInfo(),
  'toggle-backup-info': ev=>toggleBackupInfo(ev),
  'load-more-library': ()=>LibraryView.loadMore(),
  'close-nudge': ()=>Pomodoro.stop({dismiss:true,audio:false}),
  'take-pomodoro-break': ()=>{
    const request=Pomodoro.acceptedBreak({dismissIfMissing:true,activeSec:currentTimerActiveSeconds()});
    return request?beginTimerPause('pomodoro',request):false;
  },
  'gap-focus': ()=>classifyInactiveGap('focus'),
  'gap-break': ()=>classifyInactiveGap('break'),
  'gap-split': ()=>showInactiveGapSplit(),
  'gap-ignore': ()=>classifyInactiveGap('ignore'),
  'gap-apply': ()=>applyInactiveGapSplit(),
  'dismiss-storage-warning': ()=>dismissStorageWarning(),
  'sync-status-action': ev=>syncStatusAction(ev),
  // Hiding the card leaves the work running; the indicator still shows it.
  'close-drive-connect': ()=>endDriveConnectCard(),
  'recent-action': ev=>NotificationRecent.run(ev),
  'recent-more': ()=>NotificationRecent.toggle(),
  'rename-profile': ()=>startProfileRename(),
  'clear-recent': ()=>NotificationRecent.clear(),
  'review-kept-versions': ()=>KeptVersions.review(),
  'open-profile': ()=>openProfilePanel(),
  'close-profile': ()=>closeProfilePanel(),
  'profile-drive': ()=>profileDriveAction(),
  'switch-profile': ev=>switchProfile(ev),
  'add-profile': ()=>addProfile(),
  'delete-profile': ()=>deleteThisProfile(),
  'first-start-drive': ()=>FirstStart.connect(),
  'first-start-continue': ()=>FirstStart.finish(),
  'first-start-skip': ()=>FirstStart.skip(),
  'font-smaller': ()=>stepFontScale(-1),
  'font-reset': ()=>setFontScale(1),
  'font-larger': ()=>stepFontScale(1),
  'set-theme': ev=>handleThemeSelection(ev),
  'set-presentation': ev=>handlePresentationSelection(ev),
  'toggle-display-tools': ()=>toggleDisplayTools(),
  'toggle-fullscreen': ()=>toggleFS()
});
const CHANGE_ACTIONS:DelegatedHostInput['CHANGE_ACTIONS']=Object.freeze({
  'render-library': ()=>LibraryView.render(),
  'import-backup': ev=>BackupActions.importLocal(ev),
  'change-reflection-date': ()=>requireReviewSavedDayRuntime().selectReviewDate(),
  'sound-mode': event=>handleSoundModeChange(event),
  'keep-screen-awake': ev=>CapabilityInstallation.setKeepAwake(ev.target instanceof HTMLInputElement&&ev.target.checked)
});
const INPUT_ACTIONS:DelegatedHostInput['INPUT_ACTIONS']=Object.freeze({
  'first-start-password': ()=>FirstStart.confirmField(),
  'pnote-progress': ()=>onPnoteChange(),
  'save-reflection': event=>queueReviewSave({event}),
  'quote': ()=>onQuoteChange(),
  'schedule-draft': ()=>PlanDraftEditor.composerInput(),
  'render-library': ()=>LibraryView.requestRender(),
  'unfinished-note': ()=>{syncUnfinishedNoteDraft();ReviewView.sync();},
  'practice-setup': ()=>PracticePacer.previewSetup()
});
const BLUR_ACTIONS:DelegatedHostInput['BLUR_ACTIONS']=Object.freeze({
  'profile-name': finishProfileRename,
  'save-reflection': ()=>{void flushPendingReviewSave().catch(error=>AppDiagnostics.capture('review.blur-flush',error,'warn'));}
});
const KEYDOWN_ACTIONS:DelegatedHostInput['KEYDOWN_ACTIONS']=Object.freeze({
  'profile-name': handleProfileNameKey,
  'first-start': e=>FirstStart.key(e),
  'gap-split': handleInactiveGapSplitKey,
  'practice-start': handlePracticeStartKey
});
const OWNER_REQUIRED_CLICK_ACTIONS=new Set([
  'toggle-pause','practice-mode','practice-total-toggle','practice-cue-toggle','practice-start','practice-next','practice-undo','practice-reset','practice-reset-confirm','practice-delete-run','practice-toggle','practice-finish','mark-done','skip-task',
  'jump-scheduled-now','start-scheduled-full','start-remaining-window','shift-remaining-day',
  'generate-carry-forward','close-unfinished-note','save-day','clear-library','pick-import-file','backup-protection','remove-managed-version','review-kept-versions','rename-profile','recheck-device-integrity','recheck-drive-integrity',
  'toggle-pomodoro','toggle-system-alerts','restore-session','suspend-session','finish-session','reset-session','edit-plan','confirm-plan-edit','cancel-plan-edit',
  'load-default','apply-schedule','clear-schedule-draft','take-pomodoro-break',
  'gap-focus','gap-break','gap-split','gap-ignore','gap-apply','profile-drive','switch-profile','add-profile','delete-profile','first-start-drive','first-start-continue','first-start-skip',
  'font-smaller','font-reset','font-larger','set-theme','set-presentation',
  'connect-device-backup','disconnect-device-backup','connect-drive-backup','disconnect-drive-backup','backup-now','open-version-history','recover-managed-version','compare-managed-note'
]);
const OWNER_REQUIRED_CHANGE_ACTIONS=new Set(['import-backup','change-reflection-date','keep-screen-awake','sound-mode']);
const OWNER_REQUIRED_INPUT_ACTIONS=new Set(['pnote-progress','save-reflection','quote','schedule-draft','unfinished-note','practice-setup']);
const OWNER_REQUIRED_BLUR_ACTIONS=new Set(['profile-name','save-reflection']);
const OWNER_REQUIRED_KEYDOWN_ACTIONS=new Set(['profile-name','first-start','gap-split','practice-start']);
const ACTIVE_SESSION_BLOCKED_CLICK_ACTIONS=new Set(['clear-library','pick-import-file','open-version-history','recover-managed-version']);
const ACTIVE_SESSION_BLOCKED_CHANGE_ACTIONS=new Set(['import-backup']);
const ACTIVE_SESSION_BLOCKED_IDS=new Set<string>();
const ACTIVE_SESSION_DISABLED_REASON='Suspend or reset today’s active session to restore a backup or clear Library data.';
const BlockedActionHint=(()=>{
  let popover:HTMLDivElement|null=null,target:HTMLElement|null=null,controller:ReturnType<typeof RichTextApi.createAnchoredPopover>|null=null,installed=false;
  const blockedTarget=(eventTarget:EventTarget|null)=>eventTarget instanceof Element?eventTarget.closest<HTMLElement>('[data-ownership-ui-reason="active-session"]'):null;
  const clearTarget=()=>{if(target?.getAttribute('aria-describedby')==='ownership-blocked-popover')target.removeAttribute('aria-describedby');target=null;};
  const hide=(element:HTMLElement|null=null)=>{if(element&&target!==element)return;controller?.hide();clearTarget();};
  const ensure=()=>{
    if(popover)return;
    popover=document.createElement('div');popover.id='ownership-blocked-popover';popover.className='ownership-blocked-popover';popover.setAttribute('role','tooltip');document.body.append(popover);
    controller=RichTextApi.createAnchoredPopover(popover,{align:'start',manual:true,onClose:clearTarget});
  };
  const showFor=(element:HTMLElement|null)=>{if(!element||element.dataset['ownershipUiReason']!=='active-session')return false;ensure();if(target!==element)hide();target=element;popover!.textContent=ACTIVE_SESSION_DISABLED_REASON;element.setAttribute('aria-describedby','ownership-blocked-popover');controller!.show(element);return true;};
  const install=()=>{
    if(installed)return false;installed=true;
    document.addEventListener('pointerover',event=>{const element=blockedTarget(event.target);if(!element)return;const previous=event.relatedTarget;if(previous instanceof Node&&element.contains(previous))return;showFor(element);},true);
    document.addEventListener('pointerout',event=>{const element=blockedTarget(event.target);if(!element)return;const next=event.relatedTarget;if(!(next instanceof Node)||!element.contains(next))hide(element);},true);
    document.addEventListener('focusin',event=>{const element=blockedTarget(event.target);if(element)showFor(element);},true);
    document.addEventListener('focusout',event=>{const element=blockedTarget(event.target);if(!element)return;const next=event.relatedTarget;if(!(next instanceof Node)||!element.contains(next))hide(element);},true);
    return true;
  };
  return Object.freeze({install,showFor,hide});
})();
const OwnershipUiProjection=(()=>{
  type OwnershipStateValue=ReturnType<typeof AppOwnership.status>['state'];
  type OwnershipUiElement=HTMLElement&Partial<Pick<HTMLInputElement,'disabled'|'readOnly'>>;
  type OwnershipBaseline=Readonly<{disabled:boolean|null;readOnly:boolean|null;draggable:string|null;ariaDisabled:string|null;ariaReadonly:string|null}>;
  type OwnershipUiSnapshot=Readonly<{format:'study-director.ownership-ui-snapshot';contractVersion:1;state:OwnershipStateValue;canMutate:boolean;activeSessionBlocked:boolean;transitional:boolean;revision:number;reason:string}>;
  const TRANSITIONAL_STATES=new Set<OwnershipStateValue>([
    OWNERSHIP_STATES.RESOLVING,OWNERSHIP_STATES.ACQUIRING,OWNERSHIP_STATES.HYDRATING,OWNERSHIP_STATES.RELEASING
  ]);
  const ACTION_BINDINGS:readonly Readonly<{attribute:string;actions:ReadonlySet<string>}>[]=Object.freeze([
    Object.freeze({attribute:'data-action',actions:OWNER_REQUIRED_CLICK_ACTIONS}),
    Object.freeze({attribute:'data-change',actions:OWNER_REQUIRED_CHANGE_ACTIONS}),
    Object.freeze({attribute:'data-input',actions:OWNER_REQUIRED_INPUT_ACTIONS}),
    Object.freeze({attribute:'data-blur',actions:OWNER_REQUIRED_BLUR_ACTIONS}),
    Object.freeze({attribute:'data-keydown',actions:OWNER_REQUIRED_KEYDOWN_ACTIONS})
  ]);
  const DIRECT_SELECTORS=Object.freeze([
    '.task-note-field','[data-quality]','[data-draft-field]','[data-draft-action]','[data-owner-mutation]',
    '#review-list input','#review-list textarea','#ns-nudge-after','#ns-break'
  ]);
  const BLOCKED_EVENT_TYPES:readonly string[]=Object.freeze(['beforeinput','input','change','paste','cut','drop','dragstart']);
  const baselines=new WeakMap<OwnershipUiElement,OwnershipBaseline>();
  let current:OwnershipUiSnapshot=Object.freeze({
    format:'study-director.ownership-ui-snapshot',contractVersion:1,state:OWNERSHIP_STATES.SECONDARY,canMutate:false,activeSessionBlocked:false,transitional:false,revision:0,reason:'Ownership has not been established yet.'
  });
  let observer:MutationObserver|null=null,applyQueued=false;

  function reasonFor(state:OwnershipStateValue){
    if(state===OWNERSHIP_STATES.PRIMARY)return 'This tab has control.';
    if(state===OWNERSHIP_STATES.HYDRATING)return 'Reloading canonical data before this tab becomes writable.';
    if(state===OWNERSHIP_STATES.ACQUIRING)return 'Acquiring exclusive control.';
    if(state===OWNERSHIP_STATES.RESOLVING)return 'Checking which tab has control.';
    if(state===OWNERSHIP_STATES.RELEASING)return 'Saving and transferring control.';
    if(state===OWNERSHIP_STATES.FAULTED)return 'Ownership could not be established safely.';
    return 'Another tab has control.';
  }
  function createSnapshot():OwnershipUiSnapshot{
    const status=AppOwnership.status(),transitional=TRANSITIONAL_STATES.has(status.state),mutationBlocked=PwaRuntime.reservationActive()||requireMutationCoordinator().blocksUi();
    return Object.freeze({format:'study-director.ownership-ui-snapshot',contractVersion:1,state:status.state,canMutate:!mutationBlocked&&!transitional&&status.state===OWNERSHIP_STATES.PRIMARY&&appCanMutate(),activeSessionBlocked:hasBlockingActiveSession(),transitional:transitional||mutationBlocked,revision:Math.max(0,Number(status.revision)||0),reason:mutationBlocked?'A protected data operation is in progress.':reasonFor(status.state)});
  }
  function candidateElements(root:ParentNode=document):OwnershipUiElement[]{
    const found=new Set<OwnershipUiElement>(),elementRoot=root instanceof HTMLElement?root as OwnershipUiElement:null,queryRoot=root&&typeof root.querySelectorAll==='function'?root:document;
    const addBoundElement=(element:OwnershipUiElement)=>{ACTION_BINDINGS.forEach(binding=>{if(binding.actions.has(element.getAttribute(binding.attribute)||''))found.add(element);});};
    if(elementRoot)addBoundElement(elementRoot);
    queryRoot.querySelectorAll<OwnershipUiElement>('[data-action],[data-change],[data-input],[data-blur],[data-keydown]').forEach(addBoundElement);
    DIRECT_SELECTORS.forEach(selector=>{if(elementRoot&&elementRoot.matches(selector))found.add(elementRoot);queryRoot.querySelectorAll<OwnershipUiElement>(selector).forEach(element=>found.add(element));});
    queryRoot.querySelectorAll<OwnershipUiElement>('.si.draft[draggable]').forEach(element=>found.add(element));
    return [...found];
  }
  function captureBaseline(element:OwnershipUiElement):OwnershipBaseline{
    const prior=baselines.get(element);if(prior)return prior;
    const baseline=Object.freeze({disabled:typeof element.disabled==='boolean'?element.disabled:null,readOnly:typeof element.readOnly==='boolean'?element.readOnly:null,draggable:element.getAttribute('draggable'),ariaDisabled:element.getAttribute('aria-disabled'),ariaReadonly:element.getAttribute('aria-readonly')});
    baselines.set(element,baseline);return baseline;
  }
  function restoreAttribute(element:OwnershipUiElement,name:string,value:string|null){if(value===null){if(element.hasAttribute(name))element.removeAttribute(name);}else if(element.getAttribute(name)!==value)element.setAttribute(name,value);}
  function releaseElement(element:OwnershipUiElement){
    const baseline=baselines.get(element);
    if(baseline){
      if(baseline.disabled!==null&&element.disabled!==baseline.disabled)element.disabled=baseline.disabled;
      if(baseline.readOnly!==null&&element.readOnly!==baseline.readOnly)element.readOnly=baseline.readOnly;
      restoreAttribute(element,'draggable',baseline.draggable);restoreAttribute(element,'aria-disabled',baseline.ariaDisabled);restoreAttribute(element,'aria-readonly',baseline.ariaReadonly);baselines.delete(element);
    }
    BlockedActionHint.hide(element);
    if(element.dataset['ownershipUi']!==undefined)delete element.dataset['ownershipUi'];
    if(element.dataset['ownershipUiReason']!==undefined)delete element.dataset['ownershipUiReason'];
  }
  function projectionMode(element:OwnershipUiElement){
    if(element.matches('.si.draft[draggable]'))return 'drag';
    if(element.matches('textarea,input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="range"])'))return 'readonly';
    if(element.matches('button,select,input,[aria-pressed]'))return 'disabled';
    return 'action';
  }
  function blockElement(element:OwnershipUiElement,reason='ownership'){
    captureBaseline(element);const mode=projectionMode(element);element.dataset['ownershipUiReason']=reason;if(element.dataset['ownershipUi']!==mode)element.dataset['ownershipUi']=mode;
    if(mode==='readonly'){if(!element.readOnly)element.readOnly=true;if(element.getAttribute('aria-readonly')!=='true')element.setAttribute('aria-readonly','true');return;}
    if(mode==='disabled'){if(!element.disabled)element.disabled=true;if(element.getAttribute('aria-disabled')!=='true')element.setAttribute('aria-disabled','true');return;}
    if(mode==='drag'&&element.draggable)element.draggable=false;if(element.getAttribute('aria-disabled')!=='true')element.setAttribute('aria-disabled','true');
  }
  function blockedByActiveSession(element:OwnershipUiElement){if(!current.activeSessionBlocked)return false;if(ACTIVE_SESSION_BLOCKED_IDS.has(element.id))return true;if(ACTIVE_SESSION_BLOCKED_CLICK_ACTIONS.has(element.getAttribute('data-action')||''))return true;return ACTIVE_SESSION_BLOCKED_CHANGE_ACTIONS.has(element.getAttribute('data-change')||'');}
  function apply(root:ParentNode=document){
    const previousCanMutate=current.canMutate;current=createSnapshot();const page=document.documentElement,mutable=current.canMutate?'1':'0',revision=String(current.revision);
    if(page.dataset['studyDirectorUiMutable']!==mutable)page.dataset['studyDirectorUiMutable']=mutable;
    if(page.dataset['studyDirectorUiState']!==current.state)page.dataset['studyDirectorUiState']=current.state;
    if(page.dataset['studyDirectorUiRevision']!==revision)page.dataset['studyDirectorUiRevision']=revision;
    candidateElements(root).forEach(element=>{if(!current.canMutate){blockElement(element,'ownership');return;}if(blockedByActiveSession(element)){blockElement(element,'active-session');return;}releaseElement(element);});
    if(previousCanMutate!==current.canMutate){queueMicrotask(()=>{void richTextSyncAll();});if(current.canMutate){schedulePwaUpdateCheck(250);schedulePwaUpdateEvaluation(250);}else clearPwaUpdateCheckTimer();}
    return current;
  }
  function queueApply(){if(applyQueued)return;applyQueued=true;queueMicrotask(()=>{applyQueued=false;void apply();});}
  function mutationNeedsProjection(mutation:MutationRecord){if(mutation.type==='attributes')return mutation.target instanceof HTMLElement&&!!mutation.target.dataset['ownershipUi'];return [...mutation.addedNodes].some(node=>node?.nodeType===1);}
  function guardEvent(event:Event){
    const target=event.target instanceof Element?event.target.closest<HTMLElement>('[data-ownership-ui]'):null;if(!target)return;
    const activeSessionReason=target.dataset['ownershipUiReason']==='active-session';if(current.canMutate&&!activeSessionReason)return;const mode=target.dataset['ownershipUi'];
    if(event.type==='click'&&mode!=='action')return;if(event.type!=='click'&&!BLOCKED_EVENT_TYPES.includes(event.type))return;
    event.preventDefault();event.stopImmediatePropagation();if(event.type==='click'&&!activeSessionReason)AppOwnership.requirePrimary('use this control');
  }
  function install(){if(observer)return false;BLOCKED_EVENT_TYPES.forEach(type=>document.addEventListener(type,guardEvent,true));document.addEventListener('click',guardEvent,true);observer=new MutationObserver(mutations=>{if(mutations.some(mutationNeedsProjection))queueApply();});observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled','readonly','aria-disabled','aria-readonly','draggable']});apply();return true;}
  function snapshot(){return current;}
  return Object.freeze({format:'study-director.ownership-ui-projection',contractVersion:1,apply,install,snapshot});
})();
refreshSessionSafetyUi=()=>OwnershipUiProjection.apply();
const {actionNeedsAppControl,handleDelegatedClick,handleDelegatedChange,handleDelegatedInput,handleDelegatedBlur,handleDelegatedKeydown}=FoundationHostModule.createDelegated({document,goTab,setStudyQuality,requirePrimaryTab,CLICK_ACTIONS,CHANGE_ACTIONS,INPUT_ACTIONS,BLUR_ACTIONS,KEYDOWN_ACTIONS,
  OWNER_REQUIRED_CLICK_ACTIONS,OWNER_REQUIRED_CHANGE_ACTIONS,OWNER_REQUIRED_INPUT_ACTIONS,OWNER_REQUIRED_BLUR_ACTIONS,OWNER_REQUIRED_KEYDOWN_ACTIONS,
  editedTextarea:()=>{richAssetReferenceRevision++;captureMutationGeneration++;},UiTabRegistry,Pomodoro});

const NoteSyncPopover=(()=>{
  let popover:HTMLDivElement|null=null,target:HTMLElement|null=null,controller:ReturnType<typeof RichTextApi.createAnchoredPopover>|null=null,installed=false;
  const clearTarget=()=>{if(target?.getAttribute('aria-describedby')==='note-sync-popover')target.removeAttribute('aria-describedby');target=null;};
  const hide=(element:HTMLElement|null=null)=>{if(element&&target!==element)return;controller?.hide();clearTarget();};
  const show=(element:HTMLElement|null)=>{
    if(!element)return;
    const message=String(element.getAttribute('aria-label')||'').trim();if(!message){hide();return;}
    if(!popover){popover=document.createElement('div');popover.id='note-sync-popover';popover.className='note-sync-popover';popover.setAttribute('role','tooltip');controller=RichTextApi.createAnchoredPopover(popover,{align:'end',manual:true,onClose:clearTarget});}
    if(target!==element){hide();const parent=element.closest<HTMLElement>('.workspace-overlay-rich-text')||document.body;parent.append(popover!);popover!.inert=false;}
    target=element;popover!.textContent=message;element.setAttribute('aria-describedby','note-sync-popover');controller!.show(element);
  };
  const refresh=(element:HTMLElement)=>{if(target===element)show(element);};
  const install=()=>{
    if(installed)return;installed=true;
    document.addEventListener('pointerover',event=>{const element=event.target instanceof Element?event.target.closest<HTMLElement>('.note-sync'):null;if(!element)return;const previous=event.relatedTarget;if(previous instanceof Node&&element.contains(previous))return;show(element);},true);
    document.addEventListener('pointerout',event=>{const element=event.target instanceof Element?event.target.closest<HTMLElement>('.note-sync'):null;if(!element)return;const next=event.relatedTarget;if(!(next instanceof Node)||!element.contains(next))hide(element);},true);
    document.addEventListener('focusin',event=>{const element=event.target instanceof Element?event.target.closest<HTMLElement>('.note-sync'):null;if(element)show(element);},true);
    document.addEventListener('focusout',event=>{const element=event.target instanceof Element?event.target.closest<HTMLElement>('.note-sync'):null;if(!element)return;const next=event.relatedTarget;if(!(next instanceof Node)||!element.contains(next))hide(element);},true);
  };
  return Object.freeze({install,refresh,hide});
})();
function installDelegatedEventBindings(){
  document.addEventListener('click',handleDelegatedClick);
  document.addEventListener('change',handleDelegatedChange);
  document.addEventListener('input',handleDelegatedInput);
  document.addEventListener('blur',handleDelegatedBlur,true);
  document.addEventListener('keydown',handleOverlayFocusTrap,true);
  document.addEventListener('keydown',handleDelegatedKeydown);
  document.addEventListener('dblclick',handleFullscreenDblClick);
  document.addEventListener('fullscreenchange',updateFullscreenButton);
}
function installApplicationDomBindings(){
  document.documentElement.dataset['studyDirectorBound']='1';
  installProfileDialogs();
  const liveLimits:Readonly<Record<string,number>>={
    'profile-name-input':APP_LIMITS.maxStudentNameChars,'first-start-name':APP_LIMITS.maxStudentNameChars,
    'quote-input':APP_LIMITS.maxQuoteChars,'plan-input':APP_LIMITS.maxScheduleChars,
    'daily-reflection':APP_LIMITS.maxReflectionChars,'recovery-carry':APP_LIMITS.maxCarryForwardChars,
    'library-search':APP_LIMITS.maxSearchChars,'library-notes-search':APP_LIMITS.maxSearchChars,
    'pn-extra':APP_LIMITS.maxNoteChars
  };
  Object.entries(liveLimits).forEach(([id,max])=>{const field=document.getElementById(id);if(field instanceof HTMLInputElement||field instanceof HTMLTextAreaElement)field.maxLength=max;});
  installDelegatedEventBindings();
  NoteSyncPopover.install();
  requireAttachmentLibrary().install();
  void installAttachmentIntegrityAudit();
  void VerifiedRecovery.install().catch(error=>AppDiagnostics.capture('backup.freshness-startup',error,'warn'));
  OwnershipUiProjection.install();
  BlockedActionHint.install();
  RichTextRuntime.install();
  SystemNotifications.install();AppAudio.install();renderSoundSettings();
  requireNativeCapabilities().install();
  void BackupProtection.refresh().catch(setBackupProtectionSurfaceError);
  BackupProviderRuntime.subscribeStatus(renderDriveBackup);renderDriveBackup();
  // A check starting or stopping updates Verification as it happens.
  BackupProviderRuntime.subscribeStatus(renderIntegrityStatuses);
  BackupProviderRuntime.subscribeStatus(storageResetConnectionsChanged);
  // P5.8B owns status subscriptions, network/visibility refresh and Drive wake-up.
  requireSyncStatusHost().install();
  NoticeCoordinator.subscribeRecent(NotificationRecent.changed);
  void ensureDeviceBackupInstalled().then(()=>installRepositoryIntegrityScrub()).catch(error=>AppDiagnostics.capture('backup.repository-integrity-install',error,'warn'));
  updateFullscreenButton();
  PlanDraftEditor.install();
  UiTabRegistry.updateOrientation();
  requireNavigationController().install();
  if(window.matchMedia){
    const navMedia=window.matchMedia(NAV_HORIZONTAL_MEDIA_QUERY);
    if(typeof navMedia.addEventListener==='function')navMedia.addEventListener('change',UiTabRegistry.updateOrientation);
  }

  const pnNode=document.getElementById('pn-extra'),pn=pnNode instanceof HTMLTextAreaElement?pnNode:null;
  if(pn)pn.addEventListener('input',event=>{
    if(!appCanMutate())return;
    commitTaskNoteEditor(pn,pn.value,event);
  });
  const ddNode=document.getElementById('day-date'),dd=ddNode instanceof HTMLInputElement?ddNode:null;
  if(dd){dd.value=todayISO();dd.dataset['autoDate']='1';}
  PracticePacer.hydrateDefault();
  // Load nudge configuration and hydrate nudge/sound controls
  Pomodoro.configuration.load();
  ['ns-nudge-after','ns-break'].forEach(id=>{
    const el=document.getElementById(id);
    if(el){
      el.addEventListener('blur',()=>{if(appCanMutate())Pomodoro.configuration.updateFromUi();});
      el.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();if(appCanMutate())Pomodoro.configuration.updateFromUi();el.blur();}});
    }
  });
  refreshStorageFallbackWarning();
  renderStorageHealth();
}

function applyPwaLaunchRoute(){
  return requireNavigationController().hydrate({source:'launch-route',explicitOnly:true}).then(result=>result.ok===true);
}
StartupLifecycle=StartupHostModule.createCoordinator(Object.freeze<Parameters<typeof StartupHostModule.createCoordinator>[0]>({
  module:StartupLifecycleModule,
  environment:Object.freeze({document,window}),
  diagnostics:Object.freeze({guard:AppDiagnostics.guard}),
  activation:AppActivation,
  ownership:AppOwnership,
  timer:Object.freeze({
    stopPresentation:TimerPresentation.stop,
    syncAfterWake:StartupHostModule.createWake({quiesced:managedRecoverySessionQuiesced,sync:syncTimerAfterWake})
  }),
  flushers:Object.freeze({
    planDraft:PlanDraftEditor.flush,
    preferences:()=>flushProtectedPreferences(),
    review:()=>ReviewEditor.flushPending({strict:false}),
    activeSession:flushLiveDraft,
    notes:()=>AppData.notes.flush(),
    deletionRecovery:AppData.deletionRecovery.flush
  }),
  startup:StartupHostModule.createStages({document,window,version:APP_VERSION,notices:NoticeCoordinator,
    stages:{bindDom:installApplicationDomBindings,recoverInterruptedLibraryClear:()=>LibraryClearCoordinator.recoverInterrupted(),loadNotes:()=>AppData.notes.load(),hydrateDrafts:hydrateSavedDrafts,previewPlan:()=>PlanDraftEditor.preview({silent:true}),refreshCoreUi:()=>refreshCoreUi(),renderRecovery:renderRecoveryReview,checkBackup:()=>maybePromptBackupNudge(true),openInitialTab:()=>goTab('plan',{source:'startup-initial',history:'none',restoreScroll:false,force:true}),applyLaunchRoute:applyPwaLaunchRoute,showNameSetup:startProfile},
    profileSafe:()=>ProfileScope.safe===true,census:()=>UnsupportedData.census(),preferencesHydrated:()=>protectedPreferencesHydrated,applyProtectedAppearance:()=>applyPortablePreferencesToRuntime(protectedPreferencesState),
    restoreTheme:()=>requirePresentationRuntime().restoreTheme(),restorePresentation:()=>requirePresentationRuntime().restorePresentation(),restoreFontScale:()=>requirePresentationRuntime().restoreFontScale(),
    hydratePlan:()=>PlanData.hydrate(),readRestoreJournal:()=>AppData.restoreJournal.read(),waitForClosedTabLease,recoverRestore:()=>BackupController.recoverInterruptedRestore(),tickClock,updateHeader:updateHeaderInfo,setInterval:(fn,ms)=>setInterval(fn,ms),setTimeout:(fn,ms)=>setTimeout(fn,ms),
    hasTasks:()=>TASKS.length>0,showEmpty,canMutate:appCanMutate,restoreSession:attemptAutoRestoreActiveSession,refreshBadge:refreshPersistedSessionBadge,inspectStorage:inspectStorageCapability,offerInstallNotice:()=>CapabilityInstallation.offerInstallNotice(),topology:()=>IndexedDb.topology(),
    setFastFenceReady:value=>{BackupRuntimeHost.setFastFenceReady(value);},reseedEpoch:()=>AppData.mutationEpoch.reseed(),capture:AppDiagnostics.capture,reconcileChangeClock:()=>VerifiedRecovery.reconcileStartupChangeClock(),resumeStorageReset:resumeUnresolvedStorageReset,
    installBackground:installBackgroundOwners,scheduleMaintenance:scheduleDataMaintenance,wakeBackground:reason=>wakeBackgroundOperations(reason),installSessionWatch,refreshKeptVersions:()=>requireKeptVersions().refresh(),announceUnsupported:()=>UnsupportedData.announce(),renderUnsupported:renderUnsupportedData,
    collectProfiles:()=>Profiles.collect(),askProfilePassword,collectFiles:()=>BackupFiles.collect(),preloadInsights:InsightsPreload.schedule,confirmBoot:()=>PwaLifecycle.confirmBoot(),offerDeviceRecovery:()=>offerDeviceRecoveryIfLocalEmpty({reason:'startup'}),
    reportUnsupported:()=>UnsupportedData.reportBlocked(),setPlanStatus,noticeCanCompact,getReviewDate,reconcileLifecycle:(...args)=>SessionLifecycle.reconcile(...args)
  })
}));
/* PUBLIC PLUGIN API */
if(!PluginRuntime.registerPlaceholders())throw new Error('Study Director optional plugin tabs could not be registered.');
type PublicApiInput=Parameters<typeof PluginRuntime.createPublicApi>[0];
const StudyDirectorPublicAPI=PluginRuntime.createPublicApi(Object.freeze<PublicApiInput>({
  version:APP_VERSION,
  data:Object.freeze({contract:DATA_CONTRACT,deviceState:InsightsDeviceState}),
  insights:AppInsights,
  logic:InsightsBoundary.logic,
  plan:Object.freeze({getDraft:getPlanDraftText,loadDraft:loadScheduleIntoDraft}),
  preview:InsightsBoundary.publicPreview,
  backup:Object.freeze<PublicApiInput['backup']>({
    createCheckpoint:CheckpointPipeline.create,
    inspect:CheckpointPipeline.inspect,
    releaseFile:file=>Exports.run('file.release',{file}),
    receiveStream:(stream,size,options={})=>Exports.job(()=>Exports.receiveStream(stream,size,options),{wait:true}),
    checksum:(blob,signal)=>Exports.job(()=>Exports.run('checksum',{value:blob},{signal}),{wait:true}),
    restore:CheckpointPipeline.restore,
    downloadSafetyCopy:BackupController.downloadSafetyCopy,
    maxFileBytes:APP_LIMITS.backupMaxFileBytes,
    repositoryPolicy:RepositoryPolicyModule.protocol,
    device:()=>AppData.provenance.installationId(),
    profile:Object.freeze<PublicApiInput['backup']['profile']>({id:()=>Profiles.current()?.id||'',name:()=>backupFolderName(),bind:info=>bindDriveLibrary({...info,library:info.library?{savedAt:info.library.savedAt,...(info.library.notes===null?{}:{notes:info.library.notes})}:null}),deleted:info=>driveProfileDeleted(info),controls:control=>ProfileDeletion.setLibraryControl(control)}),
    providers:Object.freeze<PublicApiInput['backup']['providers']>({register:config=>BackupProviderRuntime.register(config),list:()=>BackupProviderRuntime.list()})
  }),
  installation:Object.freeze<PublicApiInput['installation']>({
    status:()=>requireNativeCapabilities().status(),promptInstall:()=>requireNativeCapabilities().promptInstall(),inspectInstallation:()=>requireNativeCapabilities().inspectInstallation(),revealInstallHelp:()=>requireNativeCapabilities().revealInstallHelp()
  }),
  appearance:Object.freeze<PublicApiInput['appearance']>({
    theme:Object.freeze<PublicApiInput['appearance']['theme']>({defaultId:DEFAULT_THEME_ID,supported:PUBLIC_THEME_METADATA.filter((item):item is NonNullable<(typeof PUBLIC_THEME_METADATA)[number]>=>item!==undefined),get:PRESENTATION_KERNEL.activeThemeId,set:setTheme}),
    presentation:Object.freeze<PublicApiInput['appearance']['presentation']>({
      defaultId:DEFAULT_PRESENTATION_ID,invariants:PRESENTATION_INVARIANTS,breakpoints:PRESENTATION_BREAKPOINTS,tokens:PRESENTATION_TOKEN_CONTRACT,manifest:PRESENTATION_MANIFEST,
      list:PRESENTATION_KERNEL.listPresentations,register:registerPresentationPack,get:PRESENTATION_KERNEL.activePresentationId,set:setPresentation
    })
  }),
  ui:Object.freeze<PublicApiInput['ui']>({registerTab:UiTabRegistry.registerTab,goTab,navigationStatus:()=>requireNavigationController().status(),workspaceHistory:WorkspaceHistoryPublic})
}));
HOST_WINDOW.StudyDirector=StudyDirectorPublicAPI;
window.dispatchEvent(new CustomEvent(STUDY_DIRECTOR_READY_EVENT,{detail:Object.freeze({version:StudyDirectorPublicAPI.version,theme:PRESENTATION_KERNEL.activeThemeId(),presentation:PRESENTATION_KERNEL.activePresentationId()})}));
SessionLifecycle.invalidate('app-restart',{date:todayISO(),autoDate:true,reconcile:false});
StartupLifecycle.start();
void PwaRuntime.install();
})();
