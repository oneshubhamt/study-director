import type {BrowserRegistry} from '../../types/browser-registry.ts';
import type {PresentationKernel} from '../../types/presentation.ts';
import type {ProfileScopeValue} from '../../types/profile-scope.ts';
import type {StudyDirectorPublicApi} from '../../types/public-api-host.ts';
import type {RichTextApi} from '../../rich-text/editor.ts';

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
const RAW_LOCAL_STORAGE_KEYS=decodeBuildStringRecord('@@SD_LOCAL_STORAGE_KEYS_URI@@','local storage keys');
const DEVICE_WIDE_STORAGE_KEY_NAMES=new Set<string>(decodeBuildJson('@@SD_DEVICE_WIDE_LOCAL_STORAGE_KEYS_URI@@','device-wide storage keys') as string[]);
const {
  APP_VERSION,APP_CONFIG,APP_LIMITS,ProfileScope,DEVICE_WIDE_STORAGE_KEYS,STORAGE_KEYS,SESSION_STORAGE_KEYS,APP_META_KEYS,EXTERNAL_REPOSITORY_IDENTITIES,APP_META_REGISTRY,
  DATA_CONTRACT,DB_STORES,DB_NAME,DB_VER,DB_DAILY_RECORD_STORE,DB_DAILY_SUMMARY_STORE,DB_NOTES_STORE,DB_ACTIVE_SESSION_STORE,DB_APP_META_STORE,DB_ASSET_STORE,
  ACTIVE_SESSION_ID,ENTITY_DEFINITIONS,BACKUP_ENTITY_TYPES,FACTORY_DEFAULTS,entityDefinition,entityIdentity
}=DataBootstrapHostModule.createConfiguration(Object.freeze({
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
let StorageHealthController=null;
let StorageResetRecovery=null,BackupNudge=null;
let NativeCapabilities=null,CapabilityBadge=null;
let DeviceBackup=null,BackupRecoveryHost=null,KeptVersions=null,BackupActions=null;
const BackgroundTasks=NativeCapabilitiesModule.createTaskScheduler(window);
const LocalStorageContract=PersistenceModule.createLocalStorage(Object.freeze({
  onError:(operation,error)=>StorageHealthController?.observeLocalStorage(operation,error),
  onOk:operation=>StorageHealthController?.observeLocalStorage(operation,null)
}));
StorageHealthController=BackupReadinessHostModule.createStorageHealth(Object.freeze({
  local:LocalStorageContract,key:STORAGE_KEYS.storageHealth,maxStatusMessageChars:APP_LIMITS.maxStatusMessageChars,clampText,
  refreshWarning:()=>refreshStorageFallbackWarning(),scheduleSyncStatus:()=>scheduleSyncStatus(),document,
  timeLabelFromIso:value=>timeLabelFromIso(value),
  renderCapabilities:()=>NativeCapabilities?renderNativeCapabilities(NativeCapabilities.status()):false
}));
function localISODate(dateLike){
  const d=new Date(dateLike);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function storageHealthTime(iso){
  if(!iso)return 'never';
  const date=new Date(iso);if(!Number.isFinite(date.getTime()))return 'unknown';
  return localISODate(date)===localISODate(new Date())?timeLabelFromIso(iso)||'today':date.toLocaleDateString('en-IN',{day:'2-digit',month:'short'});
}
function publishSafetyNotice(message,title='Unsaved work needs attention',id='safety'){
  const text=String(message||'').trim();
  return NoticeCoordinator.publish(String(id||'safety'),{visible:!!text,kind:'safety',title,message:text||'Resolved.',compact:noticeCanCompact(text)});
}
function renderFileBackup(){return BackupActions?.renderFile();}
const AppDiagnostics=(()=>{
  function capture(scope,error,level='warn'){
    // Contained faults remain observable to external QA without retaining a
    // second, private error database on the user's device.
    try{
      const method=level==='error'?'error':level==='info'?'info':'warn';
      console[method](`[Study Director] ${clampText(scope||'app',80)}`,error);
    }catch(reportingError){}
    return null;
  }
  function guard(scope,fn,fallback=null){try{return fn();}catch(error){capture(scope,error,'error');return fallback;}}
  return Object.freeze({capture,guard});
})();
const BackupOperationDiagnostics=BackupOperationDiagnosticsModule.createRecorder(Object.freeze({
  configuration:Object.freeze({release:APP_VERSION,limit:20}),
  environment:Object.freeze({now:()=>Date.now()}),
  storage:Object.freeze({
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
const InstallationIdentity=DataBootstrapHostModule.createInstallationIdentity(Object.freeze({
  module:PersistenceModule,local:LocalStorageContract,installationKey:STORAGE_KEYS.installationId,navigator
}));
// The people who use Study Director on this device (core/profiles.ts).
const Profiles=ProfilesHostModule.createController(Object.freeze({module:ProfilesModule,ports:Object.freeze({
  scope:Object.freeze({pattern:ProfileScope.pattern,registryKey:ProfileScope.registryKey,scope:ProfileScope.scope,separator:ProfileScope.separator}),
  storage:Object.freeze({
    read:()=>LocalStorageContract.getText(ProfileScope.registryKey,null),
    write:text=>LocalStorageContract.setText(ProfileScope.registryKey,text),
    keys:()=>LocalStorageContract.keys(),
    remove:key=>LocalStorageContract.remove(key)
  }),
  names:Object.freeze({database:DATA_CONTRACT.storage.dbName,directories:Object.freeze(['@@SD_ATTACHMENT_OPFS_DIRECTORY@@','@@SD_BACKUP_FILES_OPFS_DIRECTORY@@']),keys:Object.freeze(Object.entries(RAW_LOCAL_STORAGE_KEYS).filter(([name])=>!DEVICE_WIDE_STORAGE_KEY_NAMES.has(name)).map(([,key])=>key))}),
  platform:ProfilesHostModule.createPlatform({indexedDB,window,localStorage,storage:navigator.storage,now:()=>Date.now(),random:randomIdPart,reload:()=>location.reload()}),
  limits:Object.freeze({maxName:APP_LIMITS.maxStudentNameChars})
})}));
Profiles.watch();
const ProfileViews=ProfilesHostModule.createViews({document,Profiles,APP_LIMITS,FACTORY_DEFAULTS,clampText,appCanMutate:()=>appCanMutate(),scheduleSyncStatus,
 driveStatus:()=>BackupProviderRuntime.locationStatus('google-drive'),protectionStatus:()=>BackupProtection.status(),deviceName:()=>PersistenceModule.deviceName(InstallationIdentity.getId()),
 connectDrive:()=>connectDriveForProfile(),disconnectDrive:()=>BackupProviderRuntime.disconnect('google-drive'),AppDiagnostics,Interactions:{notify:input=>Interactions.notify(input)}
});
const {deviceName,backupFolderName}=DataBootstrapHostModule.createNaming(Object.freeze({
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
let NavigationController=null;
const {WorkspaceRouteCoordinator,WorkspaceHistoryBridge,WorkspaceHistoryPublic}=FoundationHostModule.createWorkspace({navigation:()=>NavigationController,interactions:()=>Interactions,overlay:()=>WorkspaceOverlay});


const {renderNotificationSurfaces,renderCoordinatedNotice,noticeCanCompact,setStatus}=FoundationHostModule.createNoticeViews({document,notifications:()=>NoticeCoordinator,clampText,maxStatusMessageChars:APP_LIMITS.maxStatusMessageChars});
const NoticeCoordinator=NoticeCoordinatorModule.createCoordinator(Object.freeze({
  render:renderCoordinatedNotice,now:()=>Date.now(),
  setTimeout:(callback,delay)=>setTimeout(callback,delay),clearTimeout:timer=>clearTimeout(timer),
  installationCooldownMs:1200,capture:(scope,error)=>AppDiagnostics.capture(scope,error,'warn')
}));
if(!Object.isFrozen(NoticeCoordinator)||NoticeCoordinator.format!=='study-director.notice-coordinator'||NoticeCoordinator.contractVersion!==1){
  throw new Error('Study Director notice coordinator is unavailable or incompatible.');
}
const {renderNativeCapabilities}=CapabilitiesHostModule.createViews(Object.freeze({document,window,notices:NoticeCoordinator}));
// Recent (docs/areas/notifications.md): today's pop-ups and banners in the profile
// panel. Kept for this window across a reload (sessionStorage), tied to the
// profile; never uploaded or backed up. Opening the panel marks news seen.
const {NotificationRecent}=FoundationHostModule.createRecent({document,sessionStorage,SESSION_STORAGE_KEYS,ProfileScope,NoticeCoordinator,AppDiagnostics,scheduleSyncStatus,closeProfilePanel});
const {showBackupPresentation,openBackupRestore,backupRestoreChoices}=FoundationHostModule.createBackupActions({document,AppDiagnostics,device:()=>DeviceBackup,providers:()=>BackupProviderRuntime,history:()=>BackupRecoveryHost?.history,checkForUpdate:()=>PwaLifecycle.checkForUpdate(),connectDeviceBackupWithRecovery,connectDriveForProfile,goTab:(...args)=>goTab(...args),showData:()=>LibraryView.showSection('data'),preferredScrollBehavior:()=>preferredScrollBehavior()});
NoticeCoordinator.subscribe(renderNotificationSurfaces);
const BackupPresentation=BackupPresentationModule.createPresentation(Object.freeze({notifications:NoticeCoordinator,timeLabel:storageHealthTime,synced:()=>BackupProviderRuntime.syncing()===true,verified:source=>VerifiedRecovery.verified(source),action:(source,kind)=>Object.freeze({label:kind==='permission'?(source==='device-folder'?'Allow access':'Reconnect'):kind==='sync-review'?'Review':kind==='sync-password'?'Enter password':kind==='sync-newer'?'Check for update':'Show details',opens:true,run:()=>showBackupPresentation(source,kind)})}));
const Interactions=InteractionsModule.createController(Object.freeze({ports:Object.freeze({
  environment:Object.freeze({
    clearTimeout:id=>clearTimeout(id),document,
    nativeConfirm:message=>window.confirm(message),
    nativePrompt:(message,defaultValue)=>window.prompt(message,defaultValue),
    requestAnimationFrame:callback=>requestAnimationFrame(callback),
    setTimeout:(callback,delay)=>setTimeout(callback,delay),window
  }),
  diagnostics:Object.freeze({capture:(scope,error)=>AppDiagnostics.capture(scope,error,'warn')}),
  history:WorkspaceHistoryBridge,
  notifications:Object.freeze({notify:NoticeCoordinator.notify,subscribe:NoticeCoordinator.subscribe,dismissEvent:NoticeCoordinator.dismissEvent,dismissAll:NoticeCoordinator.dismissAll,pauseEvent:NoticeCoordinator.pauseEvent,setPaused:NoticeCoordinator.setPaused,setHidden:NoticeCoordinator.setHidden})
})}));
if(!Object.isFrozen(Interactions)||Interactions.format!=='study-director.interactions'||Interactions.contractVersion!==1){
  throw new Error('Study Director interaction controller is unavailable or incompatible.');
}
const WorkspaceOverlay=WorkspaceOverlayModule.createController(Object.freeze({ports:Object.freeze({
  environment:Object.freeze({document}),
  history:WorkspaceHistoryBridge,
})}));
if(!Object.isFrozen(WorkspaceOverlay)||WorkspaceOverlay.format!=='study-director.workspace-overlay'||WorkspaceOverlay.contractVersion!==1){
  throw new Error('Study Director workspace overlay controller is unavailable or incompatible.');
}
const RichTextWorkspaceOverlay=Object.freeze({open:options=>WorkspaceOverlay.open(options)});
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
function validatedRichInputMeta(event,field){
  const meta=event&&event[RICH_VALIDATED_INPUT_META];
  if(!meta||meta.format!=='study-director.rich-validated-input'||meta.version!==1||typeof meta.canonical!=='string'||typeof meta.plain!=='string')return null;
  return field&&String(field.value||'')===meta.canonical?meta:null;
}
if(typeof RichTextApi.mountRichTextEditor!=='function'||typeof RichTextApi.renderRichText!=='function'||typeof RichTextApi.toPlainText!=='function'||typeof RichTextApi.toMarkdown!=='function'||typeof RichTextApi.classifySerializedValue!=='function'||typeof RichTextApi.isRichTextValue!=='function'||typeof RichTextApi.measure!=='function'||typeof RichTextApi.assetIds!=='function'||typeof RichTextApi.scanAssetReferences!=='function'||typeof RichTextApi.scanAttachmentReferences!=='function'||typeof RichTextApi.insertAttachmentReference!=='function'||typeof RichTextApi.removeAttachmentReferences!=='function'||typeof RichTextApi.exportDocument!=='function'||typeof RichTextApi.compareRichText!=='function'||typeof RichTextApi.mergeIncomingAdditions!=='function'||typeof RichTextApi.appendIncomingAdditions!=='function'||typeof RichTextApi.mergeThreeWay!=='function'){
  throw new Error('Study Director rich text runtime is unavailable or incompatible.');
}
function clampEditorContent(value,plainLimit){
  const text=String(value??''),kind=RichTextApi.classifySerializedValue(text);
  if(kind==='rich')return text;
  return kind==='invalid-rich'?'':clampText(text,plainLimit);
}
function editorContentWithinLimits(value){
  const text=String(value??''),kind=RichTextApi.classifySerializedValue(text);
  if(kind==='invalid-rich')return false;
  if(kind!=='rich')return true;
  const size=RichTextApi.measure(text);return size.words<=APP_LIMITS.maxRichTextWords&&size.bytes<=APP_LIMITS.maxRichTextBytes;
}
function plainTextContent(value){return RichTextApi.toPlainText(String(value??''));}

function normalizeStudyQuality(value){
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
function noteKeyForTask(task){return isSupportBlock(task)?SUPPORT_NOTE.key:taskAreaKey(task);}
function noteLabelForTask(task){return isSupportBlock(task)?SUPPORT_NOTE.label:taskAreaLabel(task);}
const {
  normalizeSource:normalizeCompletionSource, parseProgressNumber
}=CompletionModel;
const {
  classify:classifyTaskOutcome, emptyCounts:emptyTaskOutcomeCounts, count:countTaskOutcomes,
  sanitizeCounts:sanitizeTaskOutcomeCounts, total:taskOutcomeTotal, info:taskOutcomeInfo,
  summary:taskOutcomeSummaryText
}=OutcomeModel;
function updateExecutePanels(...args){return ExecutionViews.updateExecutePanels(...args);}
// Today's session as another device runs it, while this one shows it there.
function sessionShownElsewhere(...args){return ExecutionViews.sessionShownElsewhere(...args);}
// Today's session parked on this device (Suspend Today, or handed over by another).
function sessionParkedHere(...args){return ExecutionViews.sessionParkedHere(...args);}
function executeSessionStatusModel(...args){return ExecutionViews.executeSessionStatusModel(...args);}
function updateExecuteSessionStatus(...args){return ExecutionViews.updateExecuteSessionStatus(...args);}
/* RUNTIME STATE · CHECKED LIVE EXECUTION HOST */
const SLEEP_GAP_THRESHOLD_MS=120000;
// While the timer runs on a work block here, pop-ups that block nothing
// wait; support and fixed blocks, a pause or the end let them show
// (docs/areas/status-indicator.md, noise rules).
function syncStudyQuiet(...args){return ExecutionViews.syncStudyQuiet(...args);}
const ExecutionRuntime=ExecutionHostModule.createRuntime(Object.freeze({
  modules:Object.freeze({timerState:TimerStateModule,pomodoro:PomodoroModule,practicePacer:PracticePacerModule,timerEngine:TimerEngineModule}),
  timerState:Object.freeze({
    helpers:Object.freeze({makeTaskId}),
    diagnostics:Object.freeze({capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level)}),
    effects:Object.freeze({modeChanged:()=>{updateExecutePanels();void NativeCapabilities?.syncWake();syncStudyQuiet();}})
  }),
  pomodoro:Object.freeze({
    schedule:Object.freeze({isPomodoroEligibleBlock}),
    persistence:Object.freeze({
      canMutate:()=>appCanMutate(),
      readConfiguration:()=>protectedPreferencesState.nudge,
      writeConfiguration:value=>persistProtectedPreferences({nudge:value,soundMode:NoticeCoordinator.soundStatus().mode}),
      writeSession:(...args)=>writeLiveDraftNow(...args)
    }),
    view:Object.freeze({document,notifications:NoticeCoordinator,updateExecutePanels}),
    environment:Object.freeze({nowIso:()=>new Date().toISOString()})
  }),
  practiceModel:Object.freeze({
    configuration:Object.freeze({APP_LIMITS}),
    domain:Object.freeze({boundedInt,boundedNumber,clampArray,clampText,fmtS})
  }),
  practice:Object.freeze({
    configuration:Object.freeze({APP_LIMITS}),
    schedule:Object.freeze({isWorkBlock}),
    persistence:Object.freeze({persistPracticeCueMode,persistPracticeTarget,saveLiveDraft,writeLiveDraftNow}),
    view:Object.freeze({
      document,
      isExecutePaneVisible:()=>!document.hidden&&!!document.getElementById('pane-execute')?.classList.contains('on'),
      setElementAttribute,setElementClass,setElementDisabled,setElementHidden,setElementStyle,setElementText,setTextSafe
    }),
    userPreferences:Object.freeze({notifications:NoticeCoordinator,readUserDefaults}),
    ownership:Object.freeze({appCanMutate:()=>appCanMutate()}),
    clock:Object.freeze({nowMs:DecisionClock.nowMs})
  }),
  schedule:Object.freeze({
    model:ScheduleModel,time:TimeModel,
    compactAdjustedSchedule:value=>compactAdjustedSchedule(value),
    invalidateDerived:options=>invalidateScheduleDerived(options)
  }),
  evidence:Object.freeze({
    completionModel:CompletionModel,sources:COMPLETION_SOURCES,classifyTaskOutcome,
    taskTargetValue,
    renderCompletionChange:(...args)=>renderCompletionChange(...args),
    saveLiveDraft:()=>saveLiveDraft()
  }),
  timer:Object.freeze({
    configuration:Object.freeze({APP_LIMITS,SLEEP_GAP_THRESHOLD_MS}),
    domain:Object.freeze({KeyedRecord,boundedInt,clampText,cleanDayRevision,fmtOver,fmtS,makeTaskId,positiveMinutes,shortTaskLabel,studyMinuteToHHMM,taskAreaValue,taskMeasureValue,taskTargetValue}),
    schedule:Object.freeze({getLatestCarryForward:()=>latestCarryForward,getScheduleDerivedState:()=>ScheduleDerivedState,handleStudyDayRollover:(...args)=>handleStudyDayRollover(...args),isLiveTrackableTimer,isWorkBlock,scheduleFingerprint,studyDayRolledOver:(...args)=>studyDayRolledOver(...args)}),
    persistence:Object.freeze({compactPauseEvents:(...args)=>compactPauseEvents(...args),compactRealTimeSnapshot:(...args)=>compactRealTimeSnapshot(...args),flushLiveDraft,maybeSnapshotRunningTimer,recoverySetStatus,saveLiveDraft,saveNote,writeLiveDraftNow}),
    view:Object.freeze({cachedElements,clearExecuteStateOverlay,invalidateExecuteIdleDisplay:()=>{executeIdleDisplayKey='';},refreshPnote,refreshExecuteIdleDisplay,requestRender,setElementStyle,setElementText,setTextSafe,setExecuteControlsEnabled,setExecuteShellVisible,showDone,showEmpty,textEl}),
    clock:Object.freeze({nowMs:DecisionClock.nowMs}),
    reviewEvidence:Object.freeze({applicableNotesForTask,getReviewDate,updateRealTimeAwareness,updateTimerFocusMetrics}),
    clockEnvironment:Object.freeze({cancelAnimationFrame:frame=>cancelAnimationFrame(frame),clearInterval:id=>clearInterval(id),document,getComputedStyle:element=>getComputedStyle(element),requestAnimationFrame:callback=>requestAnimationFrame(callback),setInterval:(callback,delay)=>setInterval(callback,delay),setTimeout:(callback,delay)=>setTimeout(callback,delay),window}),
    userPreferences:Object.freeze({notifications:NoticeCoordinator}),
    ownership:Object.freeze({appCanMutate:()=>appCanMutate()})
  }),
  hooks:Object.freeze({syncStudyQuiet})
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
const ReviewDayState=ReviewHostModule.createDayState(Object.freeze({
  document,timerState:TimerState,tasks:()=>TASKS,isTrackableBlock,isValidIsoDate,todayISO,fullWeekdayNames:FULL_WEEKDAY_NAMES
}));
function getReviewDate(){return ReviewDayState.getReviewDate();}
function cleanDayRevision(value){return ReviewDayState.cleanRevision(value);}
function daySaveDirty(date=getReviewDate()){return ReviewDayState.isDirty(date);}
function markDayContentChanged(){return ReviewDayState.markChanged();}
function markDayContentSaved(date,revision){return ReviewDayState.markSaved(date,revision);}
function reviewDateTitle(iso){return ReviewDayState.dateTitle(iso);}
function setReviewDateTitle(iso){return ReviewDayState.setDateTitle(iso);}
let ReviewSavedDayRuntime=null;
function requireReviewSavedDayRuntime(){if(!ReviewSavedDayRuntime)throw new Error('Study Director Saved Day coordinator is unavailable.');return ReviewSavedDayRuntime;}
function promptSaveToday(...args){return requireReviewSavedDayRuntime().promptSaveToday(...args);}
function clearSaveReminder(...args){return requireReviewSavedDayRuntime().clearSaveReminder(...args);}
function revalidateSaveReminderAfterCanonicalConvergence(...args){return requireReviewSavedDayRuntime().revalidateSaveReminder(...args);}
function acknowledgeSavedStudyDay(...args){return requireReviewSavedDayRuntime().acknowledgeSavedStudyDay(...args);}
function clearCanonicalSessionAfterSavedDay(...args){return requireReviewSavedDayRuntime().clearCanonicalSessionAfterSavedDay(...args);}
function saveDayRecord(...args){return requireReviewSavedDayRuntime().saveDayRecord(...args);}
function handleStudyDayRollover(...args){return requireReviewSavedDayRuntime().handleStudyDayRollover(...args);}
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
const TimerRestoration=ExecutionHostModule.createTimerRestoration(Object.freeze({
  runtime:ExecutionRuntime,DecisionClock,isTrackableBlock,clampText,
  invalidateIdleDisplay:()=>{executeIdleDisplayKey='';},
  setExecuteShellVisible,setExecuteControlsEnabled,clearExecuteStateOverlay,refreshPnote,requestRender,updateBadges,flushLiveDraft
}));
function validateTimerRestoreCandidate(runtime){return TimerRestoration.validateTimerRestoreCandidate(runtime);}
function restoreTimerRuntimeIfAny(){return TimerRestoration.restoreTimerRuntimeIfAny();}
/* TASK SESSION STATE · 3. LIVE DRAFT, NOTES, AND RECOVERY COORDINATION */
const LIVE_DRAFT_SAVE_DEBOUNCE_MS=1000;
const TIMER_SNAPSHOT_INTERVAL_MS=60*1000;
let ActiveSessionRuntime=null,SessionHandoffRuntime=null;
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
const SessionActions=SessionActionsModule.createController(Object.freeze({
  checkUnsupportedUpdate:(...args)=>checkUnsupportedUpdate(...args),applySchedule:(...args)=>applySchedule(...args),schedulePwaUpdateEvaluation:(...args)=>schedulePwaUpdateEvaluation(...args),
  state:SessionActionState,runtime:ExecutionRuntime,completionSources:COMPLETION_SOURCES,
  get AppData(){return AppData;},
  get ActiveSessionRuntime(){return ActiveSessionRuntime;},
  get SessionHandoffRuntime(){return SessionHandoffRuntime;},
  get ActiveSessionCodec(){return ActiveSessionCodec;},
  get DailyRecordCodec(){return DailyRecordCodec;},
  get CanonicalModule(){return CanonicalModule;},
  get AppDiagnostics(){return AppDiagnostics;},
  get AppMutationCoordinator(){return AppMutationCoordinator;},
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
  get KeptVersions(){return KeptVersions;},
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

function clearSessionSafetyMessage(...args){return SessionActions.clearSessionSafetyMessage(...args);}
const ExecutionViewCache={get executePanelsRenderKey(){return executePanelsRenderKey;},set executePanelsRenderKey(value){executePanelsRenderKey=value;},get executeIdleDisplayKey(){return executeIdleDisplayKey;},set executeIdleDisplayKey(value){executeIdleDisplayKey=value;},get realTimeAwarenessRenderKey(){return realTimeAwarenessRenderKey;},set realTimeAwarenessRenderKey(value){realTimeAwarenessRenderKey=value;},get scheduleEndPromptKey(){return scheduleEndPromptKey;},set scheduleEndPromptKey(value){scheduleEndPromptKey=value;}};
const ExecutionViews=ExecutionViewsModule.createController(Object.freeze({
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
setElementText:(...args)=>setElementText(...args),
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
let sessionPanelMode='none',sessionPanelSession=null;
let sessionSafetyMessage='';
// The checked sync/status host is declared early because storage health can
// request a profile-indicator redraw during start-up.
let SyncStatusHost=null,syncStatusPending=false,sessionHandoff={step:'',error:''},sessionMovingHere=null,sessionYieldedAt=0;
let ManagedRecoveryQuiescence=null;
let refreshSessionSafetyUi=()=>{};
function restoreSessionPersistenceSuppressed(){return !!ActiveSessionRuntime?.persistenceSuppressed();}
function managedRecoverySessionQuiesced(){return ManagedRecoveryQuiescence?.active()||false;}
async function withRestoreSessionPersistenceSuppressed(operation){
  if(!ActiveSessionRuntime)throw new Error('Active Session runtime is unavailable.');
  return ActiveSessionRuntime.withPersistenceSuppressed(operation);
}
function hasBlockingActiveSession(...args){return SessionActions.hasBlockingActiveSession(...args);}
let hydrateReviewState=()=>false;
let currentReviewSnapshot=()=>Object.freeze({reflection:'',studyQuality:null});
let bindReviewSession=()=>false;
let richTextClose=()=>Promise.resolve();
let richTextCloseField=()=>false;
let richTextSyncField=()=>false;
let richTextSyncAll=()=>false;
let richTextReconcileExternal=()=>Object.freeze({status:'unmounted'});
let NotesRuntime=null,LibraryNoteWorkflows=null;
let executeIdleDisplayKey='';
let realTimeAwarenessRenderKey='';
let executePanelsRenderKey='';
let executeProgressPanelRenderKey='';
let scheduleEndPromptKey='';
/* APPLICATION ACTIVATION CONTRACT */
const AppActivation=StartupHostModule.createActivation(Object.freeze({
  capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level)
}));
const APP_ACTIVATION_KINDS=AppActivation.kinds;
let StartupLifecycle;
/* APPLICATION WRITE AUTHORITY · 4. CROSS-TAB OWNERSHIP */
const OWNERSHIP_HEARTBEAT_MS=4000;
const OWNERSHIP_STALE_MS=15000;
const OWNERSHIP_PROBE_MS=700;
const OWNERSHIP_WEB_LOCK_NAME=ProfileScope.scoped('study-director-app-owner-v1');
const OWNERSHIP_STATES=OwnershipModule.OWNERSHIP_STATES;

let AppMutationCoordinator=null;
let mutationUiOperationActive=false;
const AppOwnership=StartupHostModule.createOwnershipController(Object.freeze({
  module:OwnershipModule,
  config:Object.freeze({
    storageKey:STORAGE_KEYS.appOwner,sessionTabKey:SESSION_STORAGE_KEYS.appTab,
    channelName:ProfileScope.scoped('study-director-app-owner'),heartbeatMs:OWNERSHIP_HEARTBEAT_MS,
    staleMs:OWNERSHIP_STALE_MS,probeMs:OWNERSHIP_PROBE_MS,webLockName:OWNERSHIP_WEB_LOCK_NAME
  }),
  environment:Object.freeze({
    document,window,now:DecisionClock.nowMs,randomIdPart,
    setInterval:(fn,delay)=>setInterval(fn,delay),clearInterval:id=>clearInterval(id),
    setTimeout:(fn,delay)=>setTimeout(fn,delay),clearTimeout:id=>clearTimeout(id)
  }),
  local:Object.freeze({
    getJson:(key,fallback)=>AppData.local.getJson(key,fallback),
    setJson:(key,value)=>AppData.local.setJson(key,value),
    remove:key=>AppData.local.remove(key),
    lastError:()=>AppData.lastStorageError
  }),
  diagnostics:Object.freeze({
    capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level),
    guard:(scope,operation)=>AppDiagnostics.guard(scope,operation)
  }),
  activation:AppActivation,
  reloadHint:()=>performance.getEntriesByType('navigation')[0]?.type==='reload'||performance.navigation?.type===1,
  lifecycle:Object.freeze({
    isReady:()=>StartupLifecycle.status().fullyInitialized,
    resumeStorageReset:()=>resumeUnresolvedStorageReset()
  }),
  hydration:Object.freeze({
    hydratePlanData:()=>PlanData.hydrate(),
    hydratePlanRuntime:()=>PlanRuntime.hydrate(),
    renderSavedPlans:()=>PlanRuntime.savedPlans.render(),
    hydratePrimary:options=>hydratePrimaryStateFromStorage(options),
    censusUnsupported:()=>UnsupportedData.census(),
    hydrateSavedDrafts:options=>hydrateSavedDrafts(options)
  }),
  hooks:Object.freeze({
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
const transitionAppOwnership=next=>next===OWNERSHIP_STATES.RELEASING
  ?AppOwnership.transitionReleasing():AppOwnership.state;
AppMutationCoordinator=MutationCoordinatorModule.createCoordinator(Object.freeze({
  configuration:Object.freeze({lockName:ProfileScope.scoped('study-director-data-mutation-v1'),storageKey:STORAGE_KEYS.mutationLock,leaseMs:20000,heartbeatMs:5000}),
  environment:Object.freeze({
    AbortController,locks:navigator.locks||null,now:DecisionClock.nowMs,randomIdPart,
    setInterval:(callback,delay)=>setInterval(callback,delay),clearInterval:id=>clearInterval(id),setTimeout:(callback,delay)=>setTimeout(callback,delay),
    addStorageListener:listener=>window.addEventListener('storage',listener)
  }),
  identity:Object.freeze({status:()=>AppOwnership.status(),canMutate:()=>AppOwnership.canMutate()}),
  local:Object.freeze({getJson:(key,fallback)=>AppData.local.getJson(key,fallback),setJson:(key,value)=>AppData.local.setJson(key,value),remove:key=>AppData.local.remove(key)}),
  durable:Object.freeze({acquire:request=>AppData.mutationLease.acquire(request),release:id=>AppData.mutationLease.release(id)}),
  hooks:Object.freeze({refreshUi:()=>{
    const active=!!AppMutationCoordinator?.status?.().active;
    try{OwnershipUiProjection.apply();}catch{}
    try{renderOwnershipBanner();}catch{}
    if(mutationUiOperationActive&&!active&&!AppMutationCoordinator.blocksUi())queueProtectedMutationUiReconcile();
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
function sendSessionChangeSoon(...args){return ExecutionViews.sendSessionChangeSoon(...args);}
function togglePause(...args){return ExecutionViews.togglePause(...args);}
// Every backup location that backs up on its own (the Device Folder, and
// Google Drive once this device has backed up to it) hears about each change.
// With no such location nothing happens.
const BackupProviderBackground=BackupMaintenanceHostModule.createProviderBackgroundBridge(Object.freeze({
  provider:()=>BackupProviderRuntime,capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level)
}));
function notifyBackupChange(change){return BackupProviderBackground.noteChange(change);}
function flushAutomaticBackups(reason){return BackupProviderBackground.flush(reason);}
function automaticBackupsWaiting(){return BackupProviderBackground.waiting();}
// Hidden: back up waiting changes. Visible again: redraw the locations, since a
// sign-in may have ended while timers were throttled.
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(appCanMutate())void flushAutomaticBackups('app-hidden');}else BackupProviderRuntime.refresh();});
// A plan applied by hand goes to Drive within seconds, like Suspend and
// Continue Here, so the other device sees today's session at its next check.
function uploadSoonAfterPlanApply(...args){return SessionActions.uploadSoonAfterPlanApply(...args);}
// During a live session, the checked P5.4C controller owns remote-claim
// observation, timer preemption, frozen evidence and retry cadence. The host
// keeps only scheduling and browser lifecycle adapters.
const SESSION_WATCH_MS=2*60*1000,SESSION_CLAIM_WATCH_MS=15*1000,SESSION_CLAIM_SYNC_RETRY_MS=30*1000;

async function checkSessionOwnershipClaim(){return SessionHandoffRuntime?SessionHandoffRuntime.checkClaim():false;}
function wakeSessionOwnershipClaim(slackMs=0){return SessionHandoffRuntime?SessionHandoffRuntime.wakeClaim(slackMs):false;}
function installSessionWatch(...args){return ExecutionViews.installSessionWatch(...args);}
function notifyDeviceBackupIfStudyDayResolved(...args){return ExecutionViews.notifyDeviceBackupIfStudyDayResolved(...args);}
function markDone(...args){return ExecutionViews.markDone(...args);}
function skipTask(...args){return ExecutionViews.skipTask(...args);}
function finishPracticePacer(...args){return ExecutionViews.finishPracticePacer(...args);}
function handlePracticeStartKey(...args){return ExecutionViews.handlePracticeStartKey(...args);}
/* STORAGE HEALTH AND SINGLE-TAB GUARD */

function readStorageHealth(){return StorageHealthController.snapshot();}
function writeStorageHealth(patch){return StorageHealthController.updateHistory(patch);}
function renderStorageHealth(health=readStorageHealth()){return StorageHealthController.render(health);}
function markStorageHealthOk(source,key=''){return StorageHealthController.markOk(source,key);}
function markStorageHealthTimestamp(key){return StorageHealthController.markTimestamp(key);}
function markStorageHealthError(source,reason,options={}){return StorageHealthController.markError(source,reason,options);}
function storageSizeLabel(bytes){
  const value=Math.max(0,Number(bytes)||0);
  if(value<1024*1024)return `${Math.round(value/1024)} KB`;
  if(value<1024**3)return `${Math.round(value/(1024*1024)*10)/10} MB`;
  return `${Math.round(value/1024**3*10)/10} GB`;
}
// The browser's storage estimate is measured at launch, and again when the app
// is returned to at most once an hour, so a tab left open for days still warns
// before storage fills. It is kept in memory for diagnostics.
const STORAGE_ESTIMATE_REFRESH_MS=60*60*1000;
const CapabilityStorage=CapabilitiesHostModule.createStorage(Object.freeze({
  document,navigator,
  limits:Object.freeze({storageCriticalRatio:APP_LIMITS.storageCriticalRatio,storageWarningRatio:APP_LIMITS.storageWarningRatio}),
  controller:()=>NativeCapabilities,
  storageSizeLabel,markStorageHealthError,markStorageHealthOk,renderStorageHealth
}));
const inspectStorageCapability=CapabilityStorage.inspectStorageCapability;
const protectLocalData=CapabilityStorage.protectLocalData;
const CapabilityInstallation=CapabilitiesHostModule.createInstallation(Object.freeze({
  document,window,controller:()=>NativeCapabilities,
  goTab:(name,options)=>goTab(name,options),
  preferredScrollBehavior:()=>preferredScrollBehavior()
}));
const runInstallationAction=CapabilityInstallation.runInstallationAction;
function showLiveDraftSaveWarning(reason){
  const message=`Live draft could not be saved${reason?`: ${reason}`:''}. Save today in Review or export a backup before closing this tab.`;
  markStorageHealthError('activeSession',message);
  setPlanStatus('CRITICAL: Local storage is full or unavailable. Live draft is not saving.',false);
}
function refreshStorageFallbackWarning(){
  const safetyMessage=String(sessionSafetyMessage||'').trim();
  const issues=StorageHealthController.snapshot().issues,localFailures=issues.filter(issue=>issue.level==='error'&&['indexedDB','localStorage.write','planDraft.write','activeSession','notes','dailyRecords','deletionRecovery'].includes(issue.source));
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
function resumeTimerLoopAfterPrimaryRestore(...args){return SessionActions.resumeTimerLoopAfterPrimaryRestore(...args);}
const StartupOwnershipViews=StartupHostModule.createOwnershipViews({document,OWNERSHIP_STATES,AppOwnership,NoticeCoordinator,appCanMutate,
 claimAppControl:(...args)=>claimAppControl(...args),setPlanStatus:(...args)=>setPlanStatus(...args),mutationStatus:()=>AppMutationCoordinator?.status()||null,ready:()=>StartupLifecycle.status().fullyInitialized,
 syncPlanAccess:()=>PlanRuntime.savedPlans.syncAccess(),projectOwnership:()=>OwnershipUiProjection.apply(),wakeBackground:wakeBackgroundOperations,syncWake:()=>NativeCapabilities?.syncWake()});
function renderOwnershipBanner(...args){return StartupOwnershipViews.renderOwnershipBanner(...args);}
function renderOwnershipUi(...args){return StartupOwnershipViews.renderOwnershipUi(...args);}
function loadActiveSessionForRestore(...args){return SessionActions.loadActiveSessionForRestore(...args);}
function activeSessionScheduleFingerprint(...args){return SessionActions.activeSessionScheduleFingerprint(...args);}
function applyStoredSessionSnapshot(...args){return SessionActions.applyStoredSessionSnapshot(...args);}
function hydratePrimaryStateFromStorage(...args){return SessionActions.hydratePrimaryStateFromStorage(...args);}
const {
  writeLease:writeAppOwner, release:releaseAppOwner, evaluate:evaluateAppOwnership,
  setPrimary:setPrimaryTabState, takeOwnership:claimAppControl, install:installAppOwnership
}=AppOwnership;
function flushAndReleaseAppOwner(requestId=''){return AppOwnership.flushAndRelease(requestId);}
function requirePrimaryTab(...args){return StartupOwnershipViews.requirePrimaryTab(...args);}
function renderPrimaryTabBlock(...args){return StartupOwnershipViews.renderPrimaryTabBlock(...args);}
/* DAILY RECORD COMPACTION AND SANITIZERS · IMPORTED */
const DailyRecordCodec=RecordCodecsModule.createDailyRecordCodec(Object.freeze({
  limits:APP_LIMITS,
  dataContract:DATA_CONTRACT,
  domain:DomainModule,
  keyedRecord:KeyedRecord,
  helpers:Object.freeze({
    boundedInt,boundedNumber,clampText,clampEditorContent,editorContentWithinLimits,optionalBoundedNumber,optionalText,safeBoolean,
    sameDataValue,normalizeStudyQuality,todayISO,dateInsightsMeta,sanitizePracticeRun
  }),
  timestamps:Object.freeze({normalizeTimestamp,normalizeImportedTimestamp,normalizeImportedEpochMillis}),
  timer:Object.freeze({
    modes:Object.freeze({PAUSED:TIMER_MODES.PAUSED,RUNNING:TIMER_MODES.RUNNING}),
    defaultBreakSeconds:()=>Pomodoro.configuration.breakSeconds()
  })
}));
const PersonalDataCodec=RecordCodecsModule.createPersonalDataCodec(APP_LIMITS);
/* ACTIVE SESSION CODEC */
/* ACTIVE SESSION CODEC · IMPORTED */
const ActiveSessionCodec=RecordCodecsModule.createActiveSessionCodec(Object.freeze({
  limits:APP_LIMITS,
  dataContract:DATA_CONTRACT,
  activeSessionId:ACTIVE_SESSION_ID,
  domain:DomainModule,
  keyedRecord:KeyedRecord,
  helpers:Object.freeze({
    boundedInt,boundedNumber,clampText,clampEditorContent,editorContentWithinLimits,cleanDayRevision,sameDataValue,
    activeSessionScheduleFingerprint,isCanonicalScheduleText,isValidIsoDate,normalizeStudyQuality,
    parseProgressNumber,sanitizePracticeState
  }),
  timestamps:Object.freeze({normalizeTimestamp,normalizeImportedTimestamp,normalizeImportedEpochMillis}),
  dailyRecordCodec:DailyRecordCodec
}));
const PendingReviewCodec=RecordCodecsModule.createPendingReviewCodec(Object.freeze({
  dataContract:DATA_CONTRACT,dailyRecordCodec:DailyRecordCodec,activeSessionCodec:ActiveSessionCodec,personalDataCodec:PersonalDataCodec,
  helpers:Object.freeze({sameDataValue,randomBytes:count=>crypto.getRandomValues(new Uint8Array(count))})
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
function prettyDate(iso){
  const d=new Date(iso+'T00:00:00');
  return d.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
}
function dateInsightsMeta(iso){
  const d=new Date(iso+'T00:00:00');
  const dayOfWeek=d.getDay();
  return {dayOfWeek,dayName:FULL_WEEKDAY_NAMES[dayOfWeek]||'Invalid Date'};
}
function hoursLabel(min){
  const n=Math.round((min||0)*10)/10;
  if(n<60)return Math.round(n)+'m';
  const h=n/60;
  return (Math.round(h*10)/10)+'h';
}
function optionalHoursLabel(value){
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
const PlanScheduleGateway=ExecutionHostModule.createScheduleGateway(Object.freeze({
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
function nextSessionRevision(seed=0){return AppData.activeSession.nextRevision(seed);}
async function activeSessionContentFingerprint(session){
  const content=ActiveSessionCodec.contentValue(session);
  if(!content)throw new Error('Active Session content is invalid.');
  const fingerprint=String(await Exports.run('checksum',{value:CanonicalModule.signature(content),algorithm:'sha256'}));
  if(!/^[a-f0-9]{64}$/u.test(fingerprint))throw new Error('Active Session content fingerprint could not be derived safely.');
  return fingerprint;
}
function activeSessionPayload(snapshot=null,options={}){return ActiveSessionRuntime?.payload(snapshot,options)||null;}
function readLocalRecoverySession(){return ActiveSessionRuntime?.readLocal()||null;}
function handleActiveSessionRepositoryResult(...args){return SessionActions.handleActiveSessionRepositoryResult(...args);}
function requireCanonicalSessionWrite(saved,expected,operation='active-session transition'){return ActiveSessionRuntime.requireCanonicalWrite(saved,expected,operation);}
function writeActiveSessionNow(snapshot,options={}){return ActiveSessionRuntime.writeSnapshot(snapshot,options);}
function writeLiveDraftNow(options={}){return ActiveSessionRuntime.writeNow(options);}
function saveLiveDraft(options={}){return ActiveSessionRuntime.saveLiveDraft(options);}
function cancelPendingLiveDraftSave(){return ActiveSessionRuntime?.cancelPendingLiveDraftSave()||false;}
function flushLiveDraft(options={}){return ActiveSessionRuntime?.flushLiveDraft(options)||null;}
function maybeSnapshotRunningTimer(){return ActiveSessionRuntime?.maybeSnapshotRunningTimer()||false;}
function applySessionSnapshot(snapshot){return ActiveSessionRuntime?.applySnapshot(snapshot)||false;}
function restoreLiveDraftIfAny(...args){return SessionActions.restoreLiveDraftIfAny(...args);}
function activeSessionSnapshot(...args){return SessionActions.activeSessionSnapshot(...args);}

// A session another device runs: this device shows it and never runs its timer.
function sessionRunsElsewhere(...args){return SessionActions.sessionRunsElsewhere(...args);}
function sessionFromElsewhere(...args){return SessionActions.sessionFromElsewhere(...args);}
function isRestorableActiveSession(...args){return SessionActions.isRestorableActiveSession(...args);}
function isSuspendedActiveSession(...args){return SessionActions.isSuspendedActiveSession(...args);}
function isPreviousActiveSessionRecord(...args){return SessionActions.isPreviousActiveSessionRecord(...args);}
// Verify the actual canonical Saved Day, not just a date match or two
// unrelated devices' numeric revision counters. The session must first carry
// its own durable save acknowledgement; its study evidence must still be
// represented by the Day presently in Library.
function savedDayCoversActiveSession(...args){return SessionActions.savedDayCoversActiveSession(...args);}
function retireCoveredPreviousActiveSession(...args){return SessionActions.retireCoveredPreviousActiveSession(...args);}
function setSessionPanelMode(...args){return SessionActions.setSessionPanelMode(...args);}
function recoverPreviousSessionForReview(...args){return SessionActions.recoverPreviousSessionForReview(...args);}
function handlePreviousActiveSession(...args){return SessionActions.handlePreviousActiveSession(...args);}
function revisitPreviousStoredSession(...args){return SessionActions.revisitPreviousStoredSession(...args);}
function attemptAutoRestoreActiveSession(...args){return SessionActions.attemptAutoRestoreActiveSession(...args);}
/* INDEXEDDB STORE ADAPTERS · IMPORTED */
const IndexedDb=DataBootstrapHostModule.createIndexedDb(Object.freeze({
  module:PersistenceModule,
  config:Object.freeze({
    dbName:DB_NAME,
    dbVersion:DB_VER,
    stores:Object.freeze({
      dailyRecords:DB_DAILY_RECORD_STORE,
      dailySummaries:DB_DAILY_SUMMARY_STORE,
      notes:DB_NOTES_STORE,
      activeSessions:DB_ACTIVE_SESSION_STORE,
      appMeta:DB_APP_META_STORE,
      assets:DB_ASSET_STORE
    }),
  }),
  hooks:Object.freeze({
    onError:message=>markStorageHealthError('indexedDB',`Browser database is unavailable: ${message}`),
    onOk:key=>markStorageHealthOk('indexedDB',key),
    capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level),
    onReset:event=>{void handleBrowserStorageReset(event).catch(error=>AppDiagnostics.capture('storage-reset.handle',error,'error'));}
  })

}));
const ReconciliationBaselineCodec=ReconciliationBaselineModule.createCodec(Object.freeze({limits:APP_LIMITS,isNoteKey:DailyRecordCodec.noteKeys.isKey}));
const AppMetaGateway=DataBootstrapHostModule.createAppMetaGateway(Object.freeze({
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
const UnsupportedData=DataBootstrapHostModule.createUnsupportedData(Object.freeze({
  dataContract:DATA_CONTRACT,stores:DB_STORES,indexedDb:IndexedDb,appMeta:AppMetaGateway,profiles:Profiles,profileScope:ProfileScope,notices:NoticeCoordinator,
  checkUnsupportedUpdate:()=>checkUnsupportedUpdate(),
  checkForUpdate:()=>PwaLifecycle.checkForUpdate(),
  capture:(scope,error)=>AppDiagnostics.capture(scope,error,'warn')
}));
const {RepositoryAppMeta,JournalAppMeta,HostAppMeta,ExportsAppMeta,DeviceFolderAppMeta,BackupAppMeta}=DataBootstrapHostModule.createMetadataOwners(Object.freeze({
  gateway:AppMetaGateway,
  repositoriesModule:RepositoryModule,
  repositoryValidatorInput:Object.freeze({
    limits:APP_LIMITS,
    dataContract:DATA_CONTRACT,
    personalDataCodec:PersonalDataCodec,
    pendingReviewCodec:PendingReviewCodec,
    helpers:Object.freeze({isValidIsoDate,isNoteId:DailyRecordCodec.noteKeys.isId,isNoteKey:DailyRecordCodec.noteKeys.isKey,normalizeTimestamp,sameDataValue})
  }),
  journalsModule:RepositoryJournalModule,
  journalLimits:APP_LIMITS,
  hostMetadataModule:HostMetadataModule,
  hostValidatorInput:Object.freeze({
    keys:Object.freeze({
      verifiedRecoveryBackups:APP_META_KEYS.verifiedRecoveryBackups,backupProtection:APP_META_KEYS.backupProtection,
      attachmentIntegrityAudit:APP_META_KEYS.attachmentIntegrityAudit,deviceFolder:APP_META_KEYS.deviceFolder,
      repositoryIntegrityScrub:APP_META_KEYS.repositoryIntegrityScrub,managedProviderBackupPending:APP_META_KEYS.managedProviderBackupPending,repositoryMaintenancePending:APP_META_KEYS.repositoryMaintenancePending,
      reconciliationBase:APP_META_KEYS.reconciliationBase,reconciliationBaseNotePrefix:APP_META_KEYS.reconciliationBaseNotePrefix,reconciliationBaseDayPrefix:APP_META_KEYS.reconciliationBaseDayPrefix
    }),
    same:sameDataValue,
    normalizers:Object.freeze({
      verifiedRecovery:value=>BackupReadinessHostModule.normalizeVerifiedRecoveryState(value),attachmentIntegrity:normalizeAttachmentIntegrityState,
      repositoryIntegrity:normalizeRepositoryIntegrityState,
      reconciliationBase:ReconciliationBaselineCodec.normalizeHeader,reconciliationBaseNote:ReconciliationBaselineCodec.normalizeNote,reconciliationBaseDays:ReconciliationBaselineCodec.normalizeDays
    })
  })
}));
const ReconciliationBaselineStore=ReconciliationBaselineModule.createStore(Object.freeze({
  codec:ReconciliationBaselineCodec,meta:HostAppMeta,
  families:Object.freeze({header:'reconciliationBase',notes:'reconciliationBaseNotePrefix',days:'reconciliationBaseDayPrefix'})
}));
let richAssetReferenceRevision=0,captureMutationGeneration=0;
let imagePreparationCount=0,pwaWorkRevision=0;
document.addEventListener('input',()=>{pwaWorkRevision++;},true);
document.addEventListener('change',()=>{pwaWorkRevision++;},true);
let invalidateAttachmentLibrary=()=>false;
let scheduleRichTextAssetMaintenance=()=>false;
let notifyRichTextAssetLeaseReleased=()=>false;
const CanonicalCommitHost=BackupReadinessHostModule.createCanonicalCommit(Object.freeze({
  storage:StorageHealthController,scanAttachmentReferences:value=>RichTextApi.scanAttachmentReferences(value),incrementReferenceRevision:()=>{richAssetReferenceRevision++;},
  syncCapability:event=>CapabilityBadge?.syncFromCanonicalCommit(event),notifyBackupChange:change=>notifyBackupChange(change),scheduleAssetMaintenance:()=>scheduleRichTextAssetMaintenance(),invalidateAttachmentLibrary:()=>invalidateAttachmentLibrary(),
  fullyInitialized:()=>StartupLifecycle.status().fullyInitialized,refreshKeptVersions:()=>KeptVersions?.refresh()||false,reminderDate:()=>ReviewDayState.reminder.date,revalidateSaveReminder:()=>revalidateSaveReminderAfterCanonicalConvergence(),nowIso:()=>new Date().toISOString()
}));
const RecoveryAssetMaintenancePause=BackupRecoveryHostModule.createMaintenancePause(Object.freeze({maintenance:()=>RichTextAssetMaintenance}));
if(!Object.isFrozen(RecoveryAssetMaintenancePause)||RecoveryAssetMaintenancePause.format!=='study-director.backup-maintenance-pause'||RecoveryAssetMaintenancePause.contractVersion!==1){
  throw new Error('Study Director recovery attachment-maintenance pause is unavailable or incompatible.');
}
let BackupIntegrity=null,AttachmentIntegrityJob=null;
const RichTextAssetWriteLease=AssetStorageModule.createLease();
function richAssetId(value){const id=String(value||'');if(!RichTextApi.isAssetId(id))throw new TypeError('Rich-text asset identity is invalid.');return id;}
const AttachmentIngest=AttachmentIngestModule.create({
  createWorker:()=>new Worker(trustedAssetURL('@@SD_ATTACHMENT_WORKER_FILENAME@@'),{name:'study-director-attachment-ingest'}),storage:navigator.storage,directory:ProfileScope.scoped('@@SD_ATTACHMENT_OPFS_DIRECTORY@@'),onAbandoned:()=>scheduleRichTextAssetMaintenance(5000)
});
window.addEventListener('pagehide',()=>AttachmentIngest.destroy());
const AttachmentStorage=AssetStorageModule.create({
  name:DB_NAME,directory:ProfileScope.scoped('@@SD_ATTACHMENT_OPFS_DIRECTORY@@'),maxBytes:APP_LIMITS.richAssetMaxBytes,validId:AttachmentsModule.validId,validType:AttachmentsModule.validType,limitForType:AttachmentsModule.limitForType,
  storage:navigator.storage,locks:navigator.locks,protocol:location.protocol,ingest:AttachmentIngest,onReleased:()=>notifyRichTextAssetLeaseReleased(),
  canMutate:()=>appCanMutate(),issueToken:options=>AppOwnership.issueWriteToken('write attachment',options),assertToken:token=>AppOwnership.assertWriteToken(token,'write attachment'),
  read:id=>IndexedDb.get(DB_ASSET_STORE,id,'attachment metadata read aborted'),
  entries:()=>IndexedDb.storeTransaction(DB_ASSET_STORE,'readonly',(store,tx,finish)=>{const keys=store.getAllKeys(),values=store.getAll();tx.oncomplete=()=>finish(true,keys.result.map((id,i)=>[id,values.result[i]]));},'attachment catalogue read aborted'),
  keys:()=>IndexedDb.storeTransaction(DB_ASSET_STORE,'readonly',(store,tx,finish)=>{const request=store.getAllKeys();request.onsuccess=()=>finish(true,request.result||[]);request.onerror=()=>finish(false,request.error);},'attachment keys read aborted'),
  commit:(rows,remove,token,guard=()=>true,deletionState=null)=>IndexedDb.strictTransaction([DB_ASSET_STORE,DB_APP_META_STORE],'readwrite',(tx,finish)=>{
    const store=tx.objectStore(DB_ASSET_STORE);AppOwnership.assertWriteToken(token,'commit attachment metadata');if(!guard())throw new Error('Attachment references changed during cleanup.');
    if(rows.length||remove.length){
      const units=[...new Set([...rows.map(([id])=>`attachmentAsset:${String(id)}`),...remove.map(id=>`attachmentAsset:${String(id)}`)])];
      AppData.mutationEpoch.stage(tx,units);
    }
    if(deletionState)AppData.deletionRecovery.stageAttachments(tx,deletionState);
    for(const [id,row] of rows)store.put(row,id);for(const id of remove)store.delete(id);tx.oncomplete=()=>finish(true);
  },'attachment metadata commit aborted').then(result=>{writeStorageHealth({lastLocalSaveAt:AppData.mutationEpoch.nextChangeAt()});notifyBackupChange({reason:'attachment-metadata'});if(BackupIntegrity?.attachmentState()?.issues.length)scheduleAttachmentIntegrityAudit(5000);return result;})
});
const RichTextAssets=Object.freeze({
  retain:()=>AttachmentStorage.retain(),
  get:assetId=>AttachmentStorage.get(richAssetId(assetId)),
  async put(assetId,blob){const id=richAssetId(assetId),notice=NoticeCoordinator.presentation('attachments').begin({id:'image-'+id,title:'Attach image',message:'Saving image…',announce:false});try{await AttachmentStorage.during(async()=>{await AttachmentStorage.put(id,blob);RichTextAssetWriteLease.protect(id);});invalidateAttachmentLibrary();notice.finish('succeeded','Image attached.',{announce:false,surface:'quiet'});}catch(error){notice.finish('failed','Image could not be attached. Keep this tab open and retry after storage recovers. '+error.message);throw error;}},
  // An abandoned insertion releases its lease; only a verified reference sweep deletes it.
  async remove(assetId){RichTextAssetWriteLease.release(richAssetId(assetId));scheduleRichTextAssetMaintenance();},
  keys:()=>AttachmentStorage.keys(),
  async removeMany(_assetIds){scheduleRichTextAssetMaintenance();return 0;}
});
const RichTextAssetMaintenance=AssetMaintenanceModule.create(Object.freeze({
  isAvailable:()=>upkeepBlocker()||(AttachmentStorage.supported()?true:'storage-unavailable'),
  canMutate:()=>appCanMutate(),
  mutationActive:()=>RecoveryAssetMaintenancePause.active()||backgroundMaintenanceForegroundBusy()||storageResetUnresolved(),
  collect:(operation,options)=>AttachmentStorage.collect(operation,options),
  readRestoreJournal:()=>AppData.restoreJournal.read(),
  readLibraryClearJournal:()=>AppData.libraryClearJournal.read(),
  liveFields:()=>[...document.querySelectorAll('textarea.task-note-field,textarea.library-diary-textarea,#daily-reflection')],
  getReferenceRevision:()=>richAssetReferenceRevision,
  getDatasetRevision:async()=>{const daily=await AppData.dailyRecords.datasetRevision(),epoch=await AppData.mutationEpoch.read();return daily===null||!epoch?.token?null:daily+'|'+epoch.token;},
  scanReferences:value=>RichTextApi.scanAttachmentReferences(String(value??'')),
  readNotes:()=>AppData.notes.readFreshPayload(),
  loadActiveSession:()=>AppData.activeSession.load(0,{strict:true}),
  listDailyRecords:()=>AppData.dailyRecords.list({strict:true}),
  readPendingReviewTexts:async()=>(await AppData.pendingReviews.list()).flatMap(review=>PendingReviewCodec.richTexts(review)),
  budget:()=>BackgroundTasks.budget(),yieldTask:options=>BackgroundTasks.yieldTask(options),
  invalidate:()=>invalidateAttachmentLibrary(),
  captureError:error=>AppDiagnostics.capture('rich-text.assets.maintenance',error,'warn'),
  diagnostics:Object.freeze({start:(kind,source,details)=>BackupOperationDiagnostics.start(kind,source,details),mark:(name,details,id)=>BackupOperationDiagnostics.mark(name,details,id),finish:(details,id)=>BackupOperationDiagnostics.finish(details,id),fail:(error,details,id)=>BackupOperationDiagnostics.fail(error,details,id)})
}),Object.freeze({lease:RichTextAssetWriteLease}));
// Cleanup runs after each day's upkeep, and soon after anything leaves a file
// unused. A request lost to a reload is caught by the next day's sweep.
scheduleRichTextAssetMaintenance=delay=>RichTextAssetMaintenance.schedule(delay);
notifyRichTextAssetLeaseReleased=()=>RichTextAssetMaintenance.leaseReleased();
function renderRichTextContent(container,value,emptyText='',label='Rich text'){
  if(!container)return false;
  const canonical=String(value??'');
  if(!canonical.trim()){container.textContent=String(emptyText||'');return false;}
  try{return RichTextApi.renderRichText({container,value:canonical,label:String(label||'Rich text'),assets:RichTextAssets,workspaceOverlay:RichTextWorkspaceOverlay,notes:richTextNotes()});}
  catch(error){AppDiagnostics.capture('rich-text.display',error,'warn');container.textContent=plainTextContent(canonical).trim()||String(emptyText||'');return false;}
}
function exactAppMetaFamily(capability,key,label='app metadata'){
  const resolved=AppMetaGateway.resolve(String(key||''));
  if(!resolved||resolved.owner!==capability.owner||resolved.kind!=='exact')throw new TypeError(`Unclassified ${label} key.`);
  return resolved.family;
}
function exactAppMetaStorage(capability,family,key,label){
  const expected=String(key||'');
  const assertKey=value=>{if(String(value||'')!==expected)throw new TypeError(`${label} metadata identity is invalid.`);};
  return Object.freeze({
    read:async value=>{assertKey(value);return capability.read(family);},
    write:async(value,payload,options={})=>{assertKey(value);return capability.write(family,payload,options);},
    remove:async(value,options={})=>{assertKey(value);return capability.remove(family,'',options);}
  });
}
async function readHostAppMetaValue(key){return HostAppMeta.read(exactAppMetaFamily(HostAppMeta,key,'host app metadata'));}
function writeHostAppMetaValue(key,value,options={}){return HostAppMeta.write(exactAppMetaFamily(HostAppMeta,key,'host app metadata'),value,options);}
async function readReconciliationBase(){return ReconciliationBaselineStore.readHeader();}
async function readReconciliationBaseNotes(keys){return ReconciliationBaselineStore.readNotes(keys);}
async function readReconciliationBaseDayAncestry(dates,checkpointId){return ReconciliationBaselineStore.readDayAncestry(dates,checkpointId);}
async function writeReconciliationBase(checkpointId,spec){return ReconciliationBaselineStore.write(checkpointId,spec);}
const VerifiedRecovery=BackupReadinessHostModule.createVerifiedRecovery(Object.freeze({
  metadata:Object.freeze({
    read:()=>readHostAppMetaValue(APP_META_KEYS.verifiedRecoveryBackups),
    write:value=>writeHostAppMetaValue(APP_META_KEYS.verifiedRecoveryBackups,value)
  }),
  storageHealth:Object.freeze({snapshot:()=>StorageHealthController.snapshot(),updateHistory:patch=>StorageHealthController.updateHistory(patch)}),
  mutationEpoch:Object.freeze({latestChangeAt:recorded=>AppData.mutationEpoch.latestChangeAt(recorded)}),
  backupVersion:DATA_CONTRACT.schemas.Backup.version,
  sourceRevision:()=>BackupRuntimeHost.sourceRevision(),
  refreshProviders:()=>BackupProviderRuntime.refresh(),
  capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level),
  nowIso:()=>new Date().toISOString()
}));
if(!Object.isFrozen(VerifiedRecovery)||VerifiedRecovery.format!=='study-director.verified-recovery-readiness'||VerifiedRecovery.contractVersion!==1){
  throw new Error('Study Director verified-recovery readiness is unavailable or incompatible.');
}

BackupNudge=BackupReadinessHostModule.createBackupNudge(Object.freeze({
  verified:VerifiedRecovery,storageHealth:StorageHealthController,dueMs:7*24*60*60*1000,checkMs:60*60*1000,
  canMutate:()=>appCanMutate(),now:()=>Date.now(),automaticActive:()=>BackupProviderRuntime.automaticActive(),
  dailySummaryCount:async()=>{const summaries=await AppData.dailyRecords.summaries();return Array.isArray(summaries)?summaries.length:0;},
  todayIso:()=>todayISO(),publishMessage:()=>refreshStorageFallbackWarning(),
  notify:(title,message,tag)=>notifyUser(title,message,tag),capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level)
}));
if(!Object.isFrozen(BackupNudge)||BackupNudge.format!=='study-director.backup-nudge'||BackupNudge.contractVersion!==1){
  throw new Error('Study Director backup reminder readiness is unavailable or incompatible.');
}
/* APPDATA REPOSITORY FACADE */
function handleRepositoryDailyRecordsChanged(change){
  richAssetReferenceRevision++;
  LibraryView.invalidate();
  if(document.getElementById('pane-library')?.classList.contains('on'))setTimeout(()=>{if(document.getElementById('pane-library')?.classList.contains('on'))void LibraryView.render();},0);
}
function handleRepositoryDatasetRevisionChanged(){
  if(!document.getElementById('pane-insights')?.classList.contains('on'))return;
  setTimeout(()=>{if(document.getElementById('pane-insights')?.classList.contains('on'))UiTabRegistry.renderTab('insights');},0);
}
function persistedActiveSessionUnfinished(session){
  if(!session||session.deleted===true||!['active','suspended'].includes(session.status||'active'))return false;
  const snapshot=activeSessionSnapshot(session);
  const draft=parseScheduleDraftText(String(session.scheduleText||''));
  if(!snapshot||!draft.ok||!draft.parsed.length)return false;
  const taskState=snapshot.taskState&&typeof snapshot.taskState==='object'?snapshot.taskState:{};
  return draft.parsed.some((task,index)=>{
    if(!isTrackableBlock(task))return false;
    const taskId=String(task.id||makeTaskId(task,index));
    const resolved=taskState[taskId]&&taskState[taskId].resolvedState;
    return resolved!=='done'&&resolved!=='skipped';
  });
}
function handleCanonicalCommit(event){return CanonicalCommitHost.handle(event);}

async function refreshPersistedSessionBadge(){return CapabilityBadge?CapabilityBadge.refreshPersistedSessionBadge():false;}
const {RepositoryJournals,AppData}=DataBootstrapHostModule.createRepositoryComposition(Object.freeze({
  repositoriesModule:RepositoryModule,
  journalsModule:RepositoryJournalModule,
  journal:Object.freeze({
    appMeta:JournalAppMeta,
    limits:APP_LIMITS,
    helpers:Object.freeze({clampText}),
    clock:Object.freeze({nowMs:DecisionClock.nowMs})
  }),
  appData:Object.freeze({
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
    stores:Object.freeze({
      dailyRecords:DB_DAILY_RECORD_STORE,
      dailySummaries:DB_DAILY_SUMMARY_STORE,
      notes:DB_NOTES_STORE,
      activeSessions:DB_ACTIVE_SESSION_STORE,
      appMeta:DB_APP_META_STORE
    }),
    keys:Object.freeze({
      recovery:STORAGE_KEYS.recovery,
      fallbackDailyRecords:STORAGE_KEYS.fallbackDailyRecords,
      noteRescue:STORAGE_KEYS.noteRescue,
      deletionRecovery:STORAGE_KEYS.deletionRecovery
    }),
    metaKeys:Object.freeze({
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
    clock:Object.freeze({nowMs:DecisionClock.nowMs}),
    helpers:Object.freeze({
      boundedInt,boundedNumber,clampText,clampEditorContent,editorContentWithinLimits,wipeObject,isValidIsoDate,isCanonicalScheduleText,sameDataValue,
      activeSessionScheduleFingerprint,normalizeAreaName,displayAreaName,isoDateDay,normalizeTimestamp,jsonByteLength
    }),
    hooks:Object.freeze({
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
CapabilityBadge=CapabilitiesHostModule.createBadge(Object.freeze({
  controller:()=>NativeCapabilities,
  activeSession:()=>AppData.activeSession,
  persistedActiveSessionUnfinished,
  capture:(scope,error)=>AppDiagnostics.capture(scope,error,'warn')
}));
NativeCapabilities=CapabilitiesHostModule.createController(Object.freeze({
  module:NativeCapabilitiesModule,
  configuration:Object.freeze({installNoticeKey:STORAGE_KEYS.installNoticeShown,wakePreferenceKey:STORAGE_KEYS.keepScreenAwake}),
  environment:Object.freeze({document,navigator,window}),
  hooks:Object.freeze({
    capture:(scope,error)=>AppDiagnostics.capture(scope,error,'warn'),
    isTimerRunning:()=>appCanMutate()&&TimerState.mode===TIMER_MODES.RUNNING&&!TimerState.paused&&isLiveTrackableTimer(),
    readPreference:key=>AppData.local.getJson(key,false)===true,
    writePreference:(key,value)=>AppData.local.setJson(key,value===true),
    render:renderNativeCapabilities
  })
}));
StorageHealthController.activate();

/* SESSION RESET ORCHESTRATION */
function resetRuntimeSessionState(...args){return SessionActions.resetRuntimeSessionState(...args);}
function refreshPlanAfterSessionReset(...args){return SessionActions.refreshPlanAfterSessionReset(...args);}
function suspendTodaySession(...args){return SessionActions.suspendTodaySession(...args);}
function sessionUpdateTime(...args){return SessionActions.sessionUpdateTime(...args);}
// The device a session runs on, by name: "on iPhone · Safari", or "on another device".
function sessionDevice(...args){return SessionActions.sessionDevice(...args);}
// Continue Here: this device runs the session from now on. A session still
// running on another device moves only after a warning; that device stops its
// timer at its next sync and offers what it recorded since for review.
function confirmSessionTakeover(...args){return SessionActions.confirmSessionTakeover(...args);}
const HANDOFF_RETRY_MESSAGE=SessionHandoffModule.retryMessage;
// P5.4C owns the distributed claim/compensation state machine. This host
// adapter supplies UI progress only; provider and persistence semantics live
// behind the checked controller.
function transferSessionOwnershipHere(...args){return SessionActions.transferSessionOwnershipHere(...args);}
// Continue Here in progress: every Continue Here button says so and the
// Execute card shows the step; a failure stays in the card until the next
// try or until the session moves on.
function setSessionHandoff(...args){return SessionActions.setSessionHandoff(...args);}
// The block a stored session is on and how many of its blocks are done.
function sessionProgressSummary(...args){return SessionActions.sessionProgressSummary(...args);}
function sessionHandoffProblem(...args){return SessionActions.sessionHandoffProblem(...args);}
function continueSessionHere(...args){return SessionActions.continueSessionHere(...args);}
// From a pop-up or the profile panel: open Execute first, where the card
// shows each Continue Here step.
function continueSessionOnExecute(...args){return SessionActions.continueSessionOnExecute(...args);}
// Another device continued today's session after this one changed it: the
// timer stops here and this device's progress stays as a suspended session,
// so the review can offer both.
function yieldSessionToOtherDevice(...args){return SessionActions.yieldSessionToOtherDevice(...args);}
function restoreSuspendedTodaySession(...args){return SessionActions.restoreSuspendedTodaySession(...args);}
function finishTodaySession(...args){return SessionActions.finishTodaySession(...args);}
function resetTodaySession(...args){return SessionActions.resetTodaySession(...args);}
let latestCarryForward='';
/* AREA NOTES REPOSITORY */

function notesRuntime(){
  if(!NotesRuntime)throw new Error('Notes runtime is unavailable.');
  return NotesRuntime;
}
function legacyNoteBinding(binding){
  return binding?Object.freeze({...binding,areaKey:binding.key,areaLabel:binding.label}):null;
}
function noteStoredValueForKey(key){return notesRuntime().storedValueForKey(key);}
function noteTextForKey(key){return notesRuntime().textForKey(key);}
function noteEditorContent(binding,value){return notesRuntime().editorContent({key:binding?.areaKey||binding?.key||''},value);}
function applicableNotesForTask(task){return notesRuntime().applicableForTask(task);}
function inheritedNoteEntries(areaKey){return notesRuntime().inheritedEntries(areaKey);}
function normalizeOngoingAreaInput(value){return notesRuntime().normalizeAreaInput(value);}
function orderOngoingAreaEntries(source){return notesRuntime().orderEntries(source);}
function noteSearchDocuments(){return AppData.notes.searchSnapshot().documents;}
function noteCatalogue(){return notesRuntime().catalogue();}
let refreshLibraryNotes=()=>false;
let updateNoteSearchDocument=()=>false;
function updateNoteSearchText(key,plain){const entry=key?AppData.notes.get(key):null;if(entry)updateNoteSearchDocument({key,revision:entry.updatedAt||'',plain:String(plain||'')});}
function refreshNoteConsumers(){
  richAssetReferenceRevision++;
  return NotesRuntime?NotesRuntime.refreshConsumers():false;
}
function reportNoteConflict(info={}){return NotesRuntime?NotesRuntime.reportConflict(info):false;}

/* BOUNDED DATA MAINTENANCE */
const DATA_MAINTENANCE_SCHEDULE_INTERVAL_MS=AppData.maintenance.intervalMs,DATA_MAINTENANCE_FAILURE_RETRY_MS=30*60*1000,ATTACHMENT_CLEANUP_AFTER_UPKEEP_MS=5000;
// Every background job asks this one question before it starts: this tab owns
// writes and start-up has finished. Housekeeping (attachment cleanup and
// checks, scratch files, backups and their upkeep) also waits while a
// browser-data clear is unresolved. Canonical maintenance is recovery, so it
// keeps running through a clear. Ownership is asked first: a job configured
// while the page is still loading asks before start-up exists, and no tab owns
// writes until start-up has begun.
let BackgroundMaintenance=null,DataMaintenanceJob=null;
function backgroundBlocker(options={}){return BackgroundMaintenance?BackgroundMaintenance.backgroundBlocker(options):'startup';}
function upkeepBlocker(options={}){return BackgroundMaintenance?BackgroundMaintenance.upkeepBlocker(options):'startup';}
function foregroundChanged(){return BackgroundMaintenance?.foregroundChanged()||false;}
function installBackgroundOwners(){return BackgroundMaintenance?.install()||false;}
function wakeBackgroundOperations(trigger='eligibility'){return BackgroundMaintenance?.wake(trigger)||false;}
function backgroundMaintenanceForegroundBusy(){return BackgroundMaintenance?BackgroundMaintenance.foregroundBusy():true;}
function waitForClosedTabLease(limitMs=25000){return BackgroundMaintenance?BackgroundMaintenance.waitForClosedTabLease(AppOwnership,AppMutationCoordinator,limitMs):Promise.resolve(false);}
function scheduleDataMaintenance(delay=1200,trigger='scheduled'){return BackgroundMaintenance?.schedule(delay,trigger)||false;}
NoticeCoordinator.subscribe(()=>{foregroundChanged();});

/* ONGOING SUBJECT NOTES · P5.6A CHECKED OWNER */
const NOTE_EDITOR_BINDING_VERSION=NotesHostModule.bindingVersion;
function inheritedSubjectNotesHtml(task){return notesRuntime().inheritedTextForTask(task);}
function renderInheritedNotes(container,areaKey,compact=false,options={}){return notesRuntime().renderInherited(container,areaKey,compact,options);}
function renderInheritedSubjectNotes(container,task,compact=false){return notesRuntime().renderInheritedForTask(container,task,compact);}
function currentNoteEntriesForWorkTasks(tasks){return notesRuntime().currentEntriesForTasks(tasks);}
function clearTaskNoteEditorBinding(field){return NotesRuntime?NotesRuntime.clearEditor(field):false;}
function taskNoteEditorIsVisible(field){return NotesRuntime?NotesRuntime.editorVisible(field):false;}
function bindTaskNoteEditor(field,idx,source='field'){return legacyNoteBinding(notesRuntime().bindTaskEditor(field,idx,source));}
function bindNoteEditor(field,areaKey,areaLabel,source='library'){return legacyNoteBinding(notesRuntime().bindAreaEditor(field,areaKey,areaLabel,source));}
function resolveTaskNoteEditorBinding(field,options={}){return legacyNoteBinding(notesRuntime().resolveEditor(field,options));}
function refreshSubjectNoteFieldsForKey(key,originField=null,derived=null,options={}){return notesRuntime().refreshFieldsForKey(key,originField,derived,options);}
function refreshAllSubjectNoteFieldsFromRepository(){return NotesRuntime?NotesRuntime.refreshAllFields():false;}
function setNoteSyncStateForKey(key,state){return NotesRuntime?NotesRuntime.setSyncState(key,state):false;}
function updateNoteSyncIndicators(idx,key){
  const task=TASKS[idx],safeKey=key?normalizeAreaName(key):(task?noteKeyForTask(task):'');
  return setNoteSyncStateForKey(safeKey,'synced');
}
/* PLAN DRAFTS, SAVED DEFAULTS, AND QUOTE DRAFT */
const PROTECTED_PREFERENCES_SAVE_DELAY_MS=250;
let protectedPreferencesState=Object.freeze({version:2,studentName:null,theme:null,presentation:null,quote:null,practiceCueMode:null,fontScale:null,practiceTargetMs:null,nudge:null,updatedAt:null});
let protectedPreferencesHydrated=false,protectedPreferencesDirty=false,protectedPreferencesWriteTimer=null,protectedPreferencesWriteFailure=null;
let protectedPreferencesWriteChain=Promise.resolve(),PresentationRuntime=null;
function requirePresentationRuntime(){if(!PresentationRuntime)throw new Error('Study Director presentation host is unavailable.');return PresentationRuntime;}
function acceptProtectedPreferences(value){
  const clean=PersonalDataCodec.currentPortablePreferences(value)||PersonalDataCodec.portablePreferences({version:2,...value});
  protectedPreferencesState=Object.freeze({...clean});protectedPreferencesHydrated=true;return protectedPreferencesState;
}
function refreshAppearanceMirrors(value=protectedPreferencesState){
  const clean=PersonalDataCodec.currentPortablePreferences(value)||PersonalDataCodec.portablePreferences({version:2,...value});
  return requirePresentationRuntime().refreshMirrors(clean);
}
function applyPortablePreferencesToRuntime(value=protectedPreferencesState){
  const clean=PersonalDataCodec.currentPortablePreferences(value)||PersonalDataCodec.portablePreferences({version:2,...value});
  applyStudentName(clean.studentName||FACTORY_DEFAULTS.studentName);
  requirePresentationRuntime().applyPreferences(clean);
  const qi=document.getElementById('quote-input');if(qi){qi.value=clean.quote||'';const display=document.getElementById('quote-display');if(display)display.textContent=qi.value.trim();}
  Pomodoro.configuration.load();
  NoticeCoordinator.setSoundMode(clean.soundMode??(clean.nudge?.sound===false?'off':'full'));renderSoundSettings();
  return clean;
}
async function hydrateProtectedPreferences({force=false}={}){
  if(protectedPreferencesHydrated&&!force)return protectedPreferencesState;
  const saved=await AppData.personalPreferences.read();
  protectedPreferencesDirty=false;protectedPreferencesWriteFailure=null;
  const accepted=acceptProtectedPreferences(saved||{version:2,studentName:null,theme:null,presentation:null,quote:null,practiceCueMode:null,fontScale:null,practiceTargetMs:null,nudge:null,updatedAt:null});
  refreshAppearanceMirrors(accepted);applyPortablePreferencesToRuntime(accepted);
  return accepted;
}
async function flushProtectedPreferences(options={}){
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
function persistProtectedPreferences(overrides={}){
  if(!appCanMutate()||!protectedPreferencesHydrated)return false;
  const next=PersonalDataCodec.portablePreferences({
    ...protectedPreferencesState,...overrides,version:2,updatedAt:new Date().toISOString()
  });
  protectedPreferencesState=Object.freeze({...next});protectedPreferencesHydrated=true;protectedPreferencesDirty=true;protectedPreferencesWriteFailure=null;
  if('theme' in overrides||'presentation' in overrides||'fontScale' in overrides)void flushProtectedPreferences().catch(()=>{});
  else scheduleProtectedPreferencesWrite();
  return true;
}
PresentationRuntime=PresentationHostModule.createController(Object.freeze({
  kernel:PRESENTATION_KERNEL,document,window,
  storage:Object.freeze({
    keys:Object.freeze({theme:STORAGE_KEYS.theme,presentation:STORAGE_KEYS.presentation,fontScale:STORAGE_KEYS.fontScale}),
    getText:(key,fallback)=>AppData.local.getText(key,fallback),
    setText:(key,value)=>AppData.local.setText(key,value),
    remove:key=>AppData.local.remove(key),
    lastError:()=>AppData.lastStorageError
  }),
  preferences:Object.freeze({
    hydrated:()=>protectedPreferencesHydrated,current:()=>protectedPreferencesState,
    persist:value=>persistProtectedPreferences(value)
  }),
  ownership:Object.freeze({require:reason=>requirePrimaryTab(null,reason)}),
  diagnostics:Object.freeze({capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level)}),
  popovers:Object.freeze({create:menu=>RichTextApi.createAnchoredPopover(menu,{align:'end',side:'top'})})
}));
if(!Object.isFrozen(PresentationRuntime)||PresentationRuntime.format!=='study-director.presentation-host'||PresentationRuntime.contractVersion!==1){
  throw new Error('Study Director presentation host is unavailable or incompatible.');
}
function saveQuoteDraft(){
  if(!appCanMutate())return;
  try{const el=document.getElementById('quote-input');if(el){const value=clampText(el.value,APP_LIMITS.maxQuoteChars);if(el.value!==value)el.value=value;persistProtectedPreferences({quote:value});}}catch(e){}
}
const StartupDraftHydration=StartupHostModule.createDraftHydration({document,hydratePlan:()=>PlanData.hydrate(),hydratePreferences:options=>hydrateProtectedPreferences(options),
 capture:AppDiagnostics.capture,markStorageError:markStorageHealthError,projectPlan:options=>PlanRuntime.hydrate(options),renderSavedPlans:()=>PlanRuntime.savedPlans.render(),quote:()=>protectedPreferencesState.quote,quoteChanged:options=>onQuoteChange(options)});
async function hydrateSavedDrafts(options={}){return StartupDraftHydration(options);}
function userDefaultsPayload(overrides={}){
  const saved=readUserDefaults()||{},has=key=>Object.prototype.hasOwnProperty.call(overrides,key);
  const studentName=normalizeStudentName(has('studentName')?overrides.studentName:saved.studentName||getStudentNameFromDisplay());
  const practiceTargetMs=validPracticeMs(has('practiceTargetMs')?overrides.practiceTargetMs:saved.practiceTargetMs,{min:APP_LIMITS.minPracticeTargetMs});
  const practiceCueMode=sanitizePracticeCueMode(has('practiceCueMode')?overrides.practiceCueMode:saved.practiceCueMode);
  return {studentName,practiceTargetMs:practiceTargetMs||null,practiceCueMode};
}
function persistUserDefaults(overrides={}){return persistProtectedPreferences(userDefaultsPayload(overrides));}
function persistUserDefaultName(studentName){if(!appCanMutate())return false;return persistUserDefaults({studentName:normalizeStudentName(studentName)});}
function persistPracticeTarget(targetMs){if(!appCanMutate())return false;const cleanTarget=validPracticeMs(targetMs,{min:APP_LIMITS.minPracticeTargetMs});if(!cleanTarget)return false;return persistUserDefaults({practiceTargetMs:cleanTarget});}
function persistPracticeCueMode(mode){if(!appCanMutate())return false;return persistUserDefaults({practiceCueMode:sanitizePracticeCueMode(mode)});}
function ensureTaskIds(){return TimerState.ensureTaskIds();}
/* SHELL DEFAULTS AND CLOCK HEADER */
function normalizeStudentName(...args){return ProfileViews.normalizeStudentName(...args);}
function filenameSafeStudentName(name){
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
function applyStudentName(...args){return ProfileViews.applyStudentName(...args);}
function getStudentNameFromDisplay(...args){return ProfileViews.getStudentNameFromDisplay(...args);}
function isDefaultStudentName(...args){return ProfileViews.isDefaultStudentName(...args);}
function profileInitial(...args){return ProfileViews.profileInitial(...args);}
function profileSince(...args){return ProfileViews.profileSince(...args);}
function profileLabel(...args){return ProfileViews.profileLabel(...args);}
function renderProfileBadge(...args){return ProfileViews.renderProfileBadge(...args);}
// P5.8B owns the shared profile/sync status surface. These wrappers exist
// early because storage/profile composition can request a redraw before the
// checked owner is instantiated; the pending redraw is replayed after wiring.
function scheduleSyncStatus(){
  if(!SyncStatusHost){syncStatusPending=true;return false;}
  return SyncStatusHost.schedule();
}
function connectDriveForProfile(){return SyncStatusHost?SyncStatusHost.connectDriveForProfile():false;}
function endDriveConnectCard(){return SyncStatusHost?SyncStatusHost.endConnectCard():false;}
function syncStatusAction(event){return SyncStatusHost?SyncStatusHost.action(event):Promise.resolve(false);}
function renderProfilePanel(...args){return ProfileViews.renderProfilePanel(...args);}
function renderProfile(...args){return ProfileViews.renderProfile(...args);}
function reportProfileActionError(...args){return ProfileViews.reportProfileActionError(...args);}
const ProfilePanelActions=ProfilesHostModule.createPanelActions(Object.freeze({
  document,
  getStudentName:()=>getStudentNameFromDisplay(),
  normalizeStudentName,
  applyStudentName,
  persistUserDefaultName,
  renderPanel:()=>renderProfilePanel(),
  reportError:error=>reportProfileActionError(error),
  recent:NotificationRecent
}));
function openProfilePanel(){return ProfilePanelActions.open();}
function closeProfilePanel(){return ProfilePanelActions.close();}
function installProfileDialogs(){return ProfilePanelActions.install();}
function startProfileRename(){return ProfilePanelActions.startRename();}
function finishProfileRename(){return ProfilePanelActions.finishRename();}
function handleProfileNameKey(event){return ProfilePanelActions.handleNameKey(event);}

function profileDriveAction(){return ProfileViews.profileDriveAction();}
// Profile deletion composes backup/provider effects behind a checked profile-owned adapter.
const ProfileDeletion=ProfilesHostModule.createDeletion(Object.freeze({
  profiles:Profiles,
  provider:Object.freeze({
    locationStatus:id=>BackupProviderRuntime.locationStatus(id),
    suspendBackground:reason=>BackupProviderRuntime.suspendBackground(reason)
  }),
  device:Object.freeze({
    status:()=>DeviceBackup.status(),
    deleteBackups:()=>DeviceBackup.deleteBackups()
  }),
  interactions:Interactions,
  capture:(scope,error)=>AppDiagnostics.capture(scope,error,'warn'),
  getStudentName:()=>getStudentNameFromDisplay(),
  renderProfile:()=>renderProfile(),
  verifiedSourceRevision:()=>VerifiedRecovery.verified('google-drive')?.sourceRevision||'',
  currentBackupSourceRevision:()=>BackupRuntimeHost.sourceRevision()
}));
const deleteThisProfile=ProfileDeletion.deleteThisProfile;
const driveProfileDeleted=ProfileDeletion.driveProfileDeleted;

const ProfileDriveBinding=ProfilesHostModule.createDriveBinding(Object.freeze({
  profiles:Profiles,
  interactions:Interactions,
  clearBaseline:()=>ReconciliationBaselineStore.clear(),
  renderProfile:()=>renderProfile(),
  endConnectCard:()=>endDriveConnectCard(),
  firstStartJoined:()=>FirstStart.joined(),
  capture:(scope,error)=>AppDiagnostics.capture(scope,error,'warn'),
  storageHealthTime,
  now:()=>Date.now()
}));
SyncStatusHost=SyncStatusHostModule.createController(Object.freeze({
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
  actions:Object.freeze({
    closeProfilePanel:()=>closeProfilePanel(),
    enterPassword:()=>BackupActions.manageProtection(),
    checkUpdate:()=>checkUnsupportedUpdate(),
    applyUpdate:()=>applyPwaUpdateFromUi(),
    connectDevice:()=>connectDeviceBackupWithRecovery(),
    openExecute:()=>goTab('execute',{source:'sync-status'}),
    continueSession:()=>continueSessionOnExecute('sync-status'),
    openData:async()=>{if(!await goTab('library',{source:'sync-status'}))return false;LibraryView.showSection('data');return true;}
  }),
  environment:Object.freeze({
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
const FirstStart=ProfilesHostModule.createFirstStart(Object.freeze({
  document,
  profiles:Profiles,
  backupProtection:Object.freeze({enable:password=>BackupProtection.enable(password)}),
  provider:Object.freeze({locationStatus:id=>BackupProviderRuntime.locationStatus(id)}),
  connectDriveForProfile:()=>connectDriveForProfile(),
  getStudentName:()=>getStudentNameFromDisplay(),
  isDefaultStudentName,
  applyStudentName,
  persistUserDefaultName,
  renderProfile:()=>renderProfile(),
  reportError:error=>reportProfileActionError(error)
}));

// A deliberate profile reload must not outrun writes owned by the current
// profile. Page-exit flushing remains a last safety net, not the commit gate.
const ProfileSettlement=ProfilesHostModule.createSettlement({AppOwnership,AppMutationCoordinator,appCanMutate,
 PlanDraftEditor:{flush:options=>PlanDraftEditor.flush(options)},PlanData:{settled:()=>PlanData.settled()},settleAttachmentWriters:()=>LibraryDocuments.settleAttachmentWriters(),
 deletionRecovery:AppData.deletionRecovery,AppDiagnostics,setPlanStatus:(...args)=>setPlanStatus(...args)
});
async function settleCurrentProfileWriters(){return ProfileSettlement.settleCurrentProfileWriters();}
async function settleCurrentProfileBeforeReload(){return ProfileSettlement.settleCurrentProfileBeforeReload();}
// Startup: make sure this page's profile is on the device's list, and offer
// the first-start form to someone new.
const ProfileLifecycle=ProfilesHostModule.createLifecycle(Object.freeze({
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
function withBackupPassword(open){return BackupProtectionHost.withPassword(open);}
function onQuoteChange(options={}){
  if(options.markChanged!==false)markDayContentChanged();
  const input=document.getElementById('quote-input');
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
  if(studyDayRolledOver(n)&&sessionPanelMode!=='previous'){handleStudyDayRollover();return;}
  if(dd&&dd.dataset.autoDate==='1'&&dd.value!==autoDate&&!SessionLifecycle.transitioning){
    void SessionLifecycle.run('date-rollover',{date:autoDate,autoDate:true},()=>{
      dd.value=autoDate;return true;
    }).catch(error=>AppDiagnostics.capture('review.auto-date-rollover',error,'warn'));
  }
  maybePromptScheduleEndSave(n);
  maybePromptBackupNudge();
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
const {NAV_HORIZONTAL_MEDIA_QUERY,preferredScrollBehavior,UiTabRegistry,presentTabCommit,prepareTabDeparture,commitTabView,waitForTabReady,goTab}=FoundationHostModule.createNavigation({document,window,clampText,controller:()=>NavigationController,
  library:()=>LibraryView,review:()=>ReviewView,attachments:()=>AttachmentLibrary,reviewEditor:()=>ReviewEditor,
  flushPendingReviewSave:(...args)=>flushPendingReviewSave(...args),setStatus:(...args)=>setStatus(...args),clearPreview:tab=>PreviewRuntime.clearExcept(tab),refreshPnote:(...args)=>refreshPnote(...args),updateCD:(...args)=>updateCD(...args),isLiveTrackableTimer:(...args)=>isLiveTrackableTimer(...args),refreshExecuteIdleDisplay:(...args)=>refreshExecuteIdleDisplay(...args),
  paused:()=>TimerState.paused,updateBreakMeter:(...args)=>updateBreakMeter(...args),renderPacer:()=>PracticePacer.render(),startTimerPresentation:()=>TimerPresentation.start(),stopTimerPresentation:()=>TimerPresentation.stop(),
  renderScheduleOnPlanOpen:(...args)=>renderScheduleOnPlanOpen(...args),updateRealTimeAwareness:(...args)=>updateRealTimeAwareness(...args),requestPluginTab:tab=>PluginRuntime.requestTab(tab),applyOwnership:()=>OwnershipUiProjection.apply(),richTextSyncAll:(...args)=>richTextSyncAll(...args)});


const STUDY_DIRECTOR_READY_EVENT='studydirector:ready';
const OPTIONAL_PLUGIN_DESCRIPTORS=Object.freeze([
  Object.freeze({tabId:'guide',label:'Guide',icon:'?',src:'@@SD_EXTERNAL_GUIDE_FILENAME@@',pluginName:'SD-guide'}),
  Object.freeze({tabId:'insights',label:'Insights',icon:'✦',src:'@@SD_EXTERNAL_INSIGHTS_FILENAME@@',pluginName:'SD-insights'})
]);
const PluginRuntime=PublicApiHostModule.createRuntime(Object.freeze({
  configuration:Object.freeze({capabilities:STUDY_DIRECTOR_CAPABILITIES,descriptors:OPTIONAL_PLUGIN_DESCRIPTORS}),
  environment:Object.freeze({document,trustedAssetURL:value=>trustedAssetURL(value)}),
  tabs:Object.freeze({registerTab:config=>UiTabRegistry.registerTab(config),renderTab:id=>UiTabRegistry.renderTab(id)}),
  preview:Object.freeze({registerProvider:(target,provider)=>PreviewRuntime.registerProvider(target,provider)}),
  clampText
}));
const InsightsPreload=InsightsHostModule.createPreloadScheduler(Object.freeze({
  document,
  setTimer:(callback,delayMs)=>setTimeout(callback,delayMs),
  scheduleIdle:typeof requestIdleCallback==='function'
    ?(callback,timeoutMs)=>requestIdleCallback(callback,{timeout:timeoutMs})
    :null,
  requestTab:()=>PluginRuntime.requestTab('insights')
}));
function registerStudyDirectorPlugin(plugin){
  return PluginRuntime.register(plugin);
}
if(location.protocol==='file:'){
  const notice=document.createElement('div');notice.className='ui-status err';notice.setAttribute('role','alert');
  notice.textContent='This copy was opened directly from index.html. Attachments and worker-based backups need the local launcher or hosted app. Close this copy and open Start-Study-Director in the deployment folder.';
  document.querySelector('main')?.prepend(notice);
}
// Local, bounded diagnostics: never record document samples, URLs or note text.
const trustedTypeViolations=new Map();
document.addEventListener('securitypolicyviolation',event=>{
  if(!['trusted-types','require-trusted-types-for'].includes(event.effectiveDirective))return;
  const key=event.effectiveDirective+':'+(['enforce','report'].includes(event.disposition)?event.disposition:'unknown');
  if(!trustedTypeViolations.has(key))AppDiagnostics.capture('security.trusted-types',new Error('Trusted Types boundary requires review: '+key));
  trustedTypeViolations.set(key,Math.min(1000,(trustedTypeViolations.get(key)||0)+1));
});
const trustedAssetURL=(()=>{
  const allowed=new Set(['@@SD_EXTERNAL_GUIDE_FILENAME@@','@@SD_EXTERNAL_INSIGHTS_FILENAME@@','@@SD_EXPORT_WORKER_FILENAME@@','@@SD_SEARCH_WORKER_FILENAME@@','@@SD_IMAGE_WORKER_FILENAME@@','@@SD_ATTACHMENT_WORKER_FILENAME@@','./sw.js'].map(value=>new URL(value,location.href).href));
  const validate=value=>{const url=new URL(value,location.href).href;if(!allowed.has(url))throw new TypeError('Unapproved application script.');return url;};
  const policy=globalThis.trustedTypes?.createPolicy('sd-assets',{createScriptURL:validate});
  return value=>policy?policy.createScriptURL(value):validate(value);
})();

function fullscreenAvailable(){
  const standalone=(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true;
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
function applyTheme(themeId,options={}){return requirePresentationRuntime().applyTheme(themeId,options);}
function setTheme(themeId,options={}){return requirePresentationRuntime().setTheme(themeId,options);}
function handleThemeSelection(event){return requirePresentationRuntime().handleThemeSelection(event);}
function renderPresentationControls(){return requirePresentationRuntime().renderPresentationControls();}
function applyPresentation(presentationId,options={}){return requirePresentationRuntime().applyPresentation(presentationId,options);}
function setPresentation(presentationId,options={}){return requirePresentationRuntime().setPresentation(presentationId,options);}
function registerPresentationPack(definition){return requirePresentationRuntime().registerPresentation(definition);}
function handlePresentationSelection(event){return requirePresentationRuntime().handlePresentationSelection(event);}
function normalizeFontScale(value){return requirePresentationRuntime().normalizeFontScale(value);}
function readFontScale(){return requirePresentationRuntime().readFontScale();}
function applyFontScale(value){return requirePresentationRuntime().applyFontScale(value);}
function setFontScale(value){return requirePresentationRuntime().setFontScale(value);}
function stepFontScale(delta){return requirePresentationRuntime().stepFontScale(delta);}
function toggleDisplayTools(){return requirePresentationRuntime().toggleDisplayTools();}
function toggleFS(){
  if(!fullscreenAvailable())return;
  const action=document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();
  if(action&&typeof action.catch==='function')action.catch(error=>AppDiagnostics.capture('ui.fullscreen',error));
  updateFullscreenButton();
}
function shouldIgnoreFullscreenDblClick(target){
  if(!target||!target.closest||!target.closest('.app'))return true;
  if(target.closest('button,input,textarea,select,a,summary,label,[contenteditable="true"],[data-action],[data-tab]'))return true;
  if(target.closest('dialog,#gap-overlay,#nudge-overlay,.execute-state-overlay,.nav-item,.plan-draft-row,.sched-row,.rcard,.library-day'))return true;
  if(target.closest('span,code,pre,.ui-label,.ui-body,.ui-mono,.plan-header,.library-title,.review-date,.rt-value'))return true;
  return false;
}
function handleFullscreenDblClick(ev){
  if((window.matchMedia&&window.matchMedia('(hover:none) and (pointer:coarse)').matches)||!appCanMutate()||shouldIgnoreFullscreenDblClick(ev.target))return;
  ev.preventDefault();
  toggleFS();
}
function clockHM(d=new Date()){
  return d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:false});
}
function clockHMS(d=new Date()){
  return d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
}
function timeLabelFromIso(iso){
  if(!iso)return null;
  try{return clockHM(new Date(iso));}catch(e){return null;}
}
function shortTaskLabel(t){
  if(!t)return '—';
  const prefix=isFixedBlock(t)?(taskAreaValue(t)||'fixed').toUpperCase()+': ':'';
  return prefix+t.name;
}
function realTimeAwarenessKey(...args){return ExecutionViews.realTimeAwarenessKey(...args);}
function realTimeElements(...args){return ExecutionViews.realTimeElements(...args);}
function updateRealTimeAwareness(...args){return ExecutionViews.updateRealTimeAwareness(...args);}
const renderQueue=new Set();
let renderQueueFrame=0;
const markScheduleRenderDirty=()=>PlanRuntime.markRenderDirty();
const renderScheduleIfVisible=()=>PlanRuntime.renderIfVisible();
const renderScheduleOnPlanOpen=()=>PlanRuntime.renderOnOpen();
const RENDER_ORDER=['schedule','badges','header','realtime','recovery'];
const RENDER_HANDLERS={
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
function requestRender(...keys){
  keys.flat().forEach(key=>{
    if(!RENDER_HANDLERS[key])return;
    if(key==='schedule')markScheduleRenderDirty();
    renderQueue.add(key);
  });
  if(!renderQueueFrame)renderQueueFrame=requestAnimationFrame(flushRenderQueue);
}
function refreshCoreUi(options={}){
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
  try{LibraryView.refreshNotes();if(document.getElementById('pane-library')?.classList.contains('on')){LibraryView.requestRender();void AttachmentLibrary.refresh();}}catch(error){AppDiagnostics.capture('mutation-ui.library',error,'warn');}
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
function recoverySetStatus(...args){return ExecutionViews.recoverySetStatus(...args);}

function recoveryTargetTrackableIdx(...args){return ExecutionViews.recoveryTargetTrackableIdx(...args);}
function recoveryFallbackTrackableIdx(...args){return ExecutionViews.recoveryFallbackTrackableIdx(...args);}
function renderRecoveryTarget(...args){return ExecutionViews.renderRecoveryTarget(...args);}
function recoveryStartTimerAt(...args){return ExecutionViews.recoveryStartTimerAt(...args);}
function recoveryJumpToScheduledNow(...args){return ExecutionViews.recoveryJumpToScheduledNow(...args);}
function recoveryStartScheduledFull(...args){return ExecutionViews.recoveryStartScheduledFull(...args);}
function recoveryStartRemainingWindow(...args){return ExecutionViews.recoveryStartRemainingWindow(...args);}
function recoveryShiftStartIndex(...args){return ExecutionViews.recoveryShiftStartIndex(...args);}
function deriveRecoveryShiftPlan(...args){return ExecutionViews.deriveRecoveryShiftPlan(...args);}
function applyRecoveryShiftPlan(...args){return ExecutionViews.applyRecoveryShiftPlan(...args);}
function recoveryShiftOverflowText(...args){return ExecutionViews.recoveryShiftOverflowText(...args);}
function finishRecoveryShiftPlan(...args){return ExecutionViews.finishRecoveryShiftPlan(...args);}
function recoveryShiftRemainingDay(...args){return ExecutionViews.recoveryShiftRemainingDay(...args);}
function recoveryCarryForwardItems(...args){return ExecutionViews.recoveryCarryForwardItems(...args);}
function buildCarryForwardText(...args){return ExecutionViews.buildCarryForwardText(...args);}
function setCarryForwardDraft(...args){return ExecutionViews.setCarryForwardDraft(...args);}
function recoveryGenerateCarryForward(...args){return ExecutionViews.recoveryGenerateCarryForward(...args);}
function syncUnfinishedNoteDraft(...args){return ExecutionViews.syncUnfinishedNoteDraft(...args);}
function copyCarryForward(...args){return ExecutionViews.copyCarryForward(...args);}
function unfinishedNoteDraftText(...args){return ExecutionViews.unfinishedNoteDraftText(...args);}
function closeUnfinishedNotePanel(...args){return ExecutionViews.closeUnfinishedNotePanel(...args);}
function renderRecoveryReview(...args){return ExecutionViews.renderRecoveryReview(...args);}
/* TASK PROGRESS AND ONGOING NOTE EDITORS */
function getTaskCompletion(idx){
  return resolveTaskCompletion(idx).pct;
}
function commitTaskNoteEditor(field,value,event=null){return notesRuntime().commitEditor(field,value,event);}
/* DAILY REFLECTION + DIARY PERSISTENCE · P5.5B CHECKED OWNER */
const ReviewPersistence=ReviewPersistenceModule.createPersistence(Object.freeze({
  configuration:Object.freeze({limits:APP_LIMITS,dataContract:DATA_CONTRACT}),
  records:Object.freeze({
    get:(...args)=>AppData.dailyRecords.get(...args),
    save:(...args)=>AppData.dailyRecords.save(...args),
    remove:(...args)=>AppData.dailyRecords.remove(...args),
    verifyCanonical:(...args)=>AppData.dailyRecords.verifyCanonical(...args),
    verifyCanonicalAbsent:(...args)=>AppData.dailyRecords.verifyCanonicalAbsent(...args),
    timestamp:(...args)=>AppData.dailyRecords.timestamp(...args)
  }),
  codec:Object.freeze({createDiaryRecord}),
  ownership:Object.freeze({canMutate:()=>appCanMutate(),revision:()=>AppOwnership.revision}),
  text:Object.freeze({clampEditorContent,editorContentWithinLimits,plain:plainTextContent,isRich:value=>RichTextApi.isRichTextValue(value)}),
  richText:Object.freeze({
    closeField:field=>richTextCloseField(field),syncField:field=>richTextSyncField(field),
    validatedInput:(event,field)=>validatedRichInputMeta(event,field)
  }),
  dates:Object.freeze({isSupported:isSupportedSavedDate,insights:dateInsightsMeta}),
  saveLane:SaveLaneModule,
  environment:Object.freeze({nowIso:()=>new Date().toISOString(),queueMicrotask,setTimeout,clearTimeout})
}));
const {DailyReflectionPersistence,DiaryEditor:LibraryDiaryEditor}=ReviewPersistence;
/* RICH TEXT */
function richTextDocumentFor(field,options={}){
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
    const binding=editable?resolveTaskNoteEditorBinding(field,{requireVisible}):(()=>{const areaKey=normalizeAreaName(field.dataset.areaKey);return areaKey?Object.freeze({areaKey,areaLabel:displayAreaName(field.dataset.areaLabel||areaKey)}):null;})();
    if(!binding)return null;
    return Object.freeze({documentId:`area:${binding.areaKey}`,label:`Note for ${binding.areaLabel}`,initialValue:noteStoredValueForKey(binding.areaKey),maxWords:APP_LIMITS.maxRichTextWords,surface:field.id==='pn-extra'?'execute-note':'note'});
  }
  return null;
}
// Links between notes: the one note picker and the linked-notes bar.
const NoteLinks=NoteLinksModule.createController(Object.freeze({ports:Object.freeze({
  view:Object.freeze({document}),
  notes:Object.freeze({documents:()=>AppData.notes.searchSnapshot(),get:ref=>AppData.notes.get(ref),link:(ref,id,options)=>AppData.notes.link(ref,id,options),linkedFrom:ref=>AppData.notes.linkedFrom(ref),list:()=>AppData.notes.metadataSnapshot().records}),
  text:Object.freeze({tagsIn:value=>RichTextApi.tagsIn(value)}),
  ownership:Object.freeze({canMutate:()=>appCanMutate()})
})}));
// Checked P5.6B navigation keeps link context with the rich-text surface while
// deferring Library access until a user actually follows a link or tag.
const NoteLinkNavigation=NoteLinksModule.createNavigation(Object.freeze({
  controller:NoteLinks,
  notes:Object.freeze({get:ref=>AppData.notes.get(ref)}),
  execution:Object.freeze({
    isLiveTrackableTimer:()=>isLiveTrackableTimer(),
    current:()=>{
      const index=TimerState.currentIndex,task=TASKS[index];
      return Object.freeze({task,taskId:TaskIdentity.idAt(index),ownNote:task&&hasOngoingTaskNotes(task)?AppData.notes.get(noteKeyForTask(task)):null});
    },
    open:(id,taskId,ownNote)=>openExecuteNote(id,taskId,ownNote)
  }),
  library:Object.freeze({
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
async function renameNoteTag(from,to){return notesRuntime().renameTag(from,to);}
async function importNoteFiles(files,parent=''){return notesRuntime().importFiles(files,parent);}
const RichTextRuntime=RichTextHostModule.createRuntime(Object.freeze({
  configuration:Object.freeze({maxRichTextBytes:APP_LIMITS.maxRichTextBytes}),document,window,
  richText:RichTextApi,assets:RichTextAssets,
  attachments:Object.freeze({
    port:()=>RichTextAttachmentPort,
    createImageWorker:()=>new Worker(trustedAssetURL('@@SD_IMAGE_WORKER_FILENAME@@'),{name:'study-director-image'}),
    workspaceOverlay:RichTextWorkspaceOverlay,
    onBusy:busy=>{imagePreparationCount+=busy?1:-1;if(busy)pwaWorkRevision++;else schedulePwaUpdateEvaluation(250);}
  }),
  notes:Object.freeze({
    repository:AppData.notes,links:field=>richTextNotes(field),normalizeArea:normalizeAreaName,
    setSyncState:(key,state)=>setNoteSyncStateForKey(key,state),updateSearchText:(key,plain)=>updateNoteSearchText(key,plain)
  }),
  review:Object.freeze({date:()=>getReviewDate(),flushPending:options=>ReviewEditor.flushPending(options),settled:()=>ReviewEditor.settled()}),
  session:Object.freeze({settled:()=>AppData.activeSession.settled()}),
  view:Object.freeze({
    documentFor:(field,options)=>richTextDocumentFor(field,options),render:(container,value,emptyText,label)=>renderRichTextContent(container,value,emptyText,label),
    plain:value=>plainTextContent(value),visible:field=>taskNoteEditorIsVisible(field),validatedInput:(event,field)=>validatedRichInputMeta(event,field),
    applyOwnership:root=>OwnershipUiProjection.apply(root)
  }),
  activation:Object.freeze({kinds:APP_ACTIVATION_KINDS,subscribe:callback=>AppActivation.subscribe(callback)}),
  diagnostics:Object.freeze({capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level)})
}));
if(!Object.isFrozen(RichTextRuntime)||RichTextRuntime.format!=='study-director.rich-text-runtime'||RichTextRuntime.contractVersion!==1){
  throw new Error('Study Director rich-text host runtime is unavailable or incompatible.');
}
SaveLaneModule.onBeforeFlush(()=>RichTextRuntime.flushEditors());
ManagedRecoveryQuiescence=BackupRecoveryHostModule.createQuiescence(Object.freeze({
  cancelPendingLiveDraftSave:()=>cancelPendingLiveDraftSave(),
  clock:Object.freeze({nowMs:()=>DecisionClock.nowMs()}),
  timer:Object.freeze({stopExecution:()=>TimerEngine.stopExecution(),resumeAfterPrimaryRestore:options=>TimerEngine.resumeAfterPrimaryRestore(options)}),
  richText:Object.freeze({quiesce:operation=>RichTextRuntime.quiesce(operation)}),
  mutation:Object.freeze({settled:()=>AppMutationCoordinator.settled(),active:()=>!!AppMutationCoordinator.status().active}),
  handoff:Object.freeze({frozen:()=>!!SessionHandoffRuntime?.frozen()}),
  diagnostics:Object.freeze({capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level)})
}));
if(!Object.isFrozen(ManagedRecoveryQuiescence)||ManagedRecoveryQuiescence.format!=='study-director.recovery-quiescence'||ManagedRecoveryQuiescence.contractVersion!==1){
  throw new Error('Study Director recovery quiescence is unavailable or incompatible.');
}
richTextClose=()=>RichTextRuntime.close();
richTextCloseField=field=>RichTextRuntime.closeField(field);
richTextSyncField=field=>RichTextRuntime.syncField(field);
richTextSyncAll=()=>RichTextRuntime.syncAll(document);
richTextReconcileExternal=(field,canonical,revision)=>RichTextRuntime.reconcileExternal(field,canonical,revision);
NotesRuntime=NotesHostModule.createController(Object.freeze({
  configuration:Object.freeze({
    maxAreaNameChars:APP_LIMITS.maxAreaNameChars,maxNoteChars:APP_LIMITS.maxNoteChars,maxNotes:APP_LIMITS.maxNotes,
    maxRichTextWords:APP_LIMITS.maxRichTextWords,maxRichTextBytes:APP_LIMITS.maxRichTextBytes,supportNote:SUPPORT_NOTE
  }),
  repository:AppData.notes,
  tasks:()=>TASKS,
  taskIdentity:Object.freeze({
    validIndex:value=>TaskIdentity.validIndex(value),idAt:index=>TaskIdentity.idAt(index),indexForId:id=>TaskIdentity.indexForId(id),
    scheduleRevision:()=>taskNoteScheduleRevision
  }),
  domain:Object.freeze({
    normalizeAreaName,displayAreaName,areaParentKeys,clampText,hasOngoingTaskNotes,noteKeyForTask,noteLabelForTask,isSupportBlock,isTrackableBlock
  }),
  lifecycle:Object.freeze({canWrite:()=>SessionLifecycle.canWrite(),revision:()=>SessionLifecycle.revision}),
  ownership:Object.freeze({canMutate:()=>appCanMutate(),revision:()=>AppOwnership.revision}),
  richText:Object.freeze({
    closeField:field=>RichTextRuntime.closeField(field),syncField:field=>RichTextRuntime.syncField(field),
    reconcileExternal:(field,canonical,revision)=>RichTextRuntime.reconcileExternal(field,canonical,revision),
    validatedInput:(event,field)=>validatedRichInputMeta(event,field),plain:plainTextContent,
    isRich:value=>RichTextApi.isRichTextValue(String(value??'')),
    render:(container,value,empty,label)=>renderRichTextContent(container,value,empty,label),
    normalizeTag:value=>RichTextApi.normalizeTag(value),renameTag:(value,from,to)=>RichTextApi.renameTag(value,from,to),
    fromText:value=>RichTextApi.fromText(value),fromMarkdown:value=>RichTextApi.fromMarkdown(value),
    quiesce:operation=>RichTextRuntime.quiesce(operation)
  }),
  tags:Object.freeze({tagged:names=>NoteLinks.tagged(names)}),
  mutation:Object.freeze({runExclusive:(name,operation)=>AppMutationCoordinator.runExclusive(name,operation)}),
  view:Object.freeze({
    document,currentTaskIndex:()=>TimerState.currentIndex,saveLiveDraft:()=>saveLiveDraft(),
    updateSearchText:(key,plain)=>updateNoteSearchText(key,plain),refreshExecute:()=>refreshPnote(),refreshLibrary:()=>refreshLibraryNotes(),
    requestScheduleRender:()=>requestRender('schedule'),
    refreshReviewIfVisible:()=>document.getElementById('pane-review')?.classList.contains('on')?ReviewView.refresh():false,
    refreshRecovery:()=>document.getElementById('recovery-carry-text')?renderRecoveryReview():false,
    setStatus:(...args)=>setStatus(...args),setPlanStatus:(...args)=>setPlanStatus(...args),
    publishSafetyNotice:(...args)=>publishSafetyNotice(...args),syncPopover:element=>NoteSyncPopover.refresh(element)
  }),
  diagnostics:Object.freeze({capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level)}),
  environment:Object.freeze({queueMicrotask:callback=>queueMicrotask(callback)})
}));
if(!Object.isFrozen(NotesRuntime)||NotesRuntime.format!=='study-director.notes-runtime'||NotesRuntime.contractVersion!==1){
  throw new Error('Study Director notes runtime is unavailable or incompatible.');
}
/* PERSONAL PLAN DOCUMENTS · checked host persistence/default adapter */
const PlanData=PlanHostModule.createData(Object.freeze({
  codec:PersonalDataCodec,
  repositories:Object.freeze({
    plans:Object.freeze({
      read:()=>AppData.planData.read(),
      replace:value=>AppData.planData.replace(value),
      replacePortable:value=>AppData.planData.replacePortable(value),
      writeDraft:(value,options)=>AppData.planData.writeDraft(value,options),
      writeLibrary:(value,options)=>AppData.planData.writeLibrary(value,options)
    }),
    preferences:Object.freeze({read:()=>AppData.personalPreferences.read()})
  }),
  ownership:Object.freeze({
    issueWriteToken:(reason,options)=>AppOwnership.issueWriteToken(reason,options),
    assertWriteToken:(token,reason)=>AppOwnership.assertWriteToken(token,reason)
  }),
  storage:Object.freeze({markError:(surface,message)=>markStorageHealthError(surface,message)}),
  preferences:Object.freeze({
    fallback:()=>protectedPreferencesState,
    flush:options=>flushProtectedPreferences(options),
    accept:value=>acceptProtectedPreferences(value),
    refreshAppearance:value=>refreshAppearanceMirrors(value),
    applyRuntime:value=>applyPortablePreferencesToRuntime(value),
    studentName:()=>readUserDefaults()?.studentName||null
  }),
  runtime:Object.freeze({
    canMutate:()=>appCanMutate(),
    flushDraft:options=>PlanDraftEditor.flush(options),
    replaceDraftText:value=>{const input=document.getElementById('plan-input');if(input)input.value=value;},
    previewDraft:()=>PlanDraftEditor.preview({silent:true,enterDraft:false}),
    renderSavedPlans:()=>PlanRuntime.savedPlans.render()
  }),
  defaults:Object.freeze({factory:Object.freeze({studentName:FACTORY_DEFAULTS.studentName,scheduleText:FACTORY_DEFAULTS.scheduleText})})
}));

/* PLAN MODULE COMPOSITION */
const PlanRuntime=PlanHostModule.createController(Object.freeze({
  module:PlanModule,
  data:PlanData,
  ports:Object.freeze({
    configuration:Object.freeze({limits:Object.freeze({
      maxStatusMessageChars:APP_LIMITS.maxStatusMessageChars,
      maxDurationMinutes:APP_LIMITS.maxDurationMinutes,
      maxTaskNameChars:APP_LIMITS.maxTaskNameChars,
      maxAreaNameChars:APP_LIMITS.maxAreaNameChars,
      maxUnitChars:APP_LIMITS.maxUnitChars
    })}),
    persistence:Object.freeze({
      lastError:()=>AppData.lastStorageError,
      reportDraftResult:(ok,error)=>{
        if(ok)markStorageHealthOk('planDraft.write');
        else markStorageHealthError('planDraft.write',`Plan draft was not saved: ${error&&error.message?error.message:error||'browser storage is unavailable'}. Keep this tab open and copy the draft before closing.`);
      }
    }),
    defaults:Object.freeze({applyStudentName}),
    domain:Object.freeze({
      clampText,fmtDur,fmtS,hasOngoingTaskNotes,isFixedBlock,isSupportBlock,isTrackableBlock,isWorkBlock,
      makeScheduleRow,normalizeScheduleKind,normalizeScheduleTarget,positiveMinutes,scheduleFingerprintForRows,
      scheduleToken,scheduleWarningsMessage,taskAreaKey:noteKeyForTask,taskAreaValue,taskMeasureValue,taskTargetValue,noteTextForKey
    }),
    parser:Object.freeze({isCanonicalScheduleText,parseScheduleDraftText,scheduleTextFromRows}),
    clock:Object.freeze({clockHM,clockMinuteToStudyMinute,getMinuteOfDay,isValidHHMM,normalizeHHMM,studyMinuteToHHMM,t2m,timeLabelFromIso}),
    view:Object.freeze({document,on,textEl,updateRealTimeAwareness,window}),
    notifications:NoticeCoordinator.presentation('plan'),
    scheduleGateway:PlanScheduleGateway,
    ownership:Object.freeze({canMutate:()=>appCanMutate(),requirePrimary:(event,reason)=>!AppMutationCoordinator.blocksUi()&&requirePrimaryTab(event,reason)}),
    interactions:Object.freeze({confirm:options=>Interactions.confirm(options),input:options=>Interactions.input(options)}),
    overlays:Object.freeze({createAnchoredPopover:(popup,options)=>RichTextApi.createAnchoredPopover(popup,options)}),
    environment:Object.freeze({
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
LibraryNoteWorkflows=NotesHostModule.createLibraryWorkflows(Object.freeze({
  runtime:NotesRuntime,repository:AppData.notes,plan:PlanRuntime,
  interactions:Object.freeze({confirm:options=>Interactions.confirm(options)}),
  mergeText:(existing,moved)=>RichTextApi.appendIncomingAdditions(existing,moved).value
}));
if(!Object.isFrozen(LibraryNoteWorkflows)||LibraryNoteWorkflows.format!=='study-director.library-note-workflows'||LibraryNoteWorkflows.contractVersion!==1){
  throw new Error('Study Director note workflows are unavailable or incompatible.');
}
/* TIMER COUNTDOWN EXECUTION · PRIVATE ENGINE */
/* EXECUTE ONGOING PROGRESS NOTE PANEL */
function saveNote(){
  const doneEl=document.getElementById('pn-done');
  const totalEl=document.getElementById('pn-total');
  if(doneEl&&totalEl){
    const state=progressInputState(TimerState.currentIndex,doneEl.value,totalEl.value,taskTargetValue(TASKS[TimerState.currentIndex]));
    syncProgressInputsToState(TimerState.currentIndex,state,{updateUI:false,save:false});
  }
  if(hasOngoingTaskNotes(TASKS[TimerState.currentIndex])){
    const field=document.getElementById('pn-extra');
    if(field)commitTaskNoteEditor(field,field.value);
  }
}
let pnoteInfoPopover=null;
function togglePnoteInfo(){const button=document.getElementById('pn-info-btn'),popover=document.getElementById('pn-info-popover');if(!button||!popover)return false;pnoteInfoPopover??=RichTextApi.createAnchoredPopover(popover,{align:'end'});const opening=popover.hidden;if(opening)pnoteInfoPopover.show(button);else pnoteInfoPopover.hide();return opening;}
const backupInfoPopovers=new Map();
function toggleBackupInfo(event){const button=event?.target?.closest?.('[data-backup-info-target]'),id=String(button?.dataset?.backupInfoTarget||''),popover=id?document.getElementById(id):null;if(!button||!popover)return false;let controller=backupInfoPopovers.get(id);if(!controller){controller=RichTextApi.createAnchoredPopover(popover,{align:'end',onClose:()=>button.setAttribute('aria-expanded','false')});backupInfoPopovers.set(id,controller);}const opening=popover.hidden;if(opening){controller.show(button);button.setAttribute('aria-expanded','true');}else{controller.hide();button.setAttribute('aria-expanded','false');}return opening;}
let executeNoteView=null;
function refreshPnote(options={}){
  const t=TASKS[TimerState.currentIndex];
  if(!isLiveTrackableTimer()){
    const key=`no-area:${taskNoteScheduleRevision}:${TimerState.mode}:${TASKS.length}`;
    if(!options.force&&key===executeProgressPanelRenderKey)return false;
    executeProgressPanelRenderKey=key;
    setTextSafe('pn-utag','—');setTextSafe('pn-dlbl','Done');
    const doneEl=document.getElementById('pn-done'),totalEl=document.getElementById('pn-total');
    setElementValue(doneEl,'');setElementValue(totalEl,'');setElementDisabled(doneEl,true);setElementDisabled(totalEl,true);
    const pbar=document.getElementById('pbar');if(pbar)pbar.style.width='0%';
    setTextSafe('pn-sum','No active trackable block');
    setTextSafe('pn-title','Notes');
    const areaShare=document.getElementById('pn-area-share');
    if(areaShare){areaShare.textContent='';areaShare.hidden=true;}
    setTextSafe('pn-info-popover','Persistent notes stay with their shared Area or support context. Use the Daily Diary for observations specific to today.');
    const pn=document.getElementById('pn-extra');
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
  if(!options.force&&key===executeProgressPanelRenderKey){document.querySelector('#pn-links .note-links')?.refresh?.();return false;}
  executeProgressPanelRenderKey=key;
  setTextSafe('pn-utag',measure||'—');
  const labels={pages:'Pages',min:'Minutes',Qs:'Questions',videos:'Videos',cards:'Cards',topics:'Topics',answers:'Answers',block:'Block',blocks:'Blocks'};
  setTextSafe('pn-dlbl',labels[measure]||'Done');
  const doneEl=document.getElementById('pn-done'),totalEl=document.getElementById('pn-total');
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
  const pn=document.getElementById('pn-extra');
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
function openExecuteNote(ref,taskId,own){
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
  const doneEl=document.getElementById('pn-done');
  const totalEl=document.getElementById('pn-total');
  const t=TASKS[TimerState.currentIndex];const measure=taskMeasureValue(t,'units');
  if(!t||!doneEl||!totalEl)return;
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
function isLiveTrackableTimer(...args){return ExecutionViews.isLiveTrackableTimer(...args);}
function setExecuteControlsEnabled(...args){return ExecutionViews.setExecuteControlsEnabled(...args);}
function setExecuteShellVisible(...args){return ExecutionViews.setExecuteShellVisible(...args);}
function nextTrackableWindowLabel(...args){return ExecutionViews.nextTrackableWindowLabel(...args);}
function stripScheduleLead(...args){return ExecutionViews.stripScheduleLead(...args);}
function executeIdleView(...args){return ExecutionViews.executeIdleView(...args);}
function executeIdlePresentation(...args){return ExecutionViews.executeIdlePresentation(...args);}
function setExecuteStateOverlay(...args){return ExecutionViews.setExecuteStateOverlay(...args);}
function clearExecuteStateOverlay(...args){return ExecutionViews.clearExecuteStateOverlay(...args);}
function refreshExecuteIdleDisplay(...args){return ExecutionViews.refreshExecuteIdleDisplay(...args);}
function showExecuteWaitingState(...args){return ExecutionViews.showExecuteWaitingState(...args);}
function maybeAutoStartScheduledBlock(...args){return ExecutionViews.maybeAutoStartScheduledBlock(...args);}
function maybePromptScheduleEndSave(...args){return ExecutionViews.maybePromptScheduleEndSave(...args);}
function showDone(...args){return ExecutionViews.showDone(...args);}
function showEmpty(...args){return ExecutionViews.showEmpty(...args);}
function badgeElements(...args){return ExecutionViews.badgeElements(...args);}
function updateBadges(...args){return ExecutionViews.updateBadges(...args);}
function updateSessionControls(...args){return ExecutionViews.updateSessionControls(...args);}
/* REVIEW SUBSYSTEM · PRIVATE MODULE */
const ReviewSubsystem=ReviewHostModule.createSubsystem(Object.freeze({
  module:ReviewModule,
  subsystem:Object.freeze({
  constants:Object.freeze({
    limits:APP_LIMITS,dataContract:DATA_CONTRACT,
    completionSources:COMPLETION_SOURCES,taskOutcomes:TASK_OUTCOMES,timerModes:TIMER_MODES
  }),
  services:Object.freeze({
    appData:AppData,diagnostics:AppDiagnostics,practicePacer:PracticePacer,
    taskIdentity:TaskIdentity,taskSessionState:TaskSessionState,keyedRecord:KeyedRecord,
    evidenceGateway:SessionEvidenceGateway,dailyReflection:DailyReflectionPersistence,saveLane:SaveLaneModule
  }),
  runtime:Object.freeze({
    tasks:TASKS,sessionState:SessionState,scheduleDerivedState:ScheduleDerivedState,
    currentIndex:()=>TimerState.currentIndex,timerMode:()=>TimerState.mode,isPaused:()=>TimerState.paused,pendingGap:()=>TimerState.inactiveGap,
    carryForward:()=>latestCarryForward,originalSchedule:()=>TimerState.originalSchedule,
    setSafetyMessage:value=>{sessionSafetyMessage=String(value||'');}
  }),
  ports:Object.freeze({
    domain:Object.freeze({
      boundedInt,clampText,clampEditorContent,editorContentWithinLimits,plainTextContent,classifyTaskOutcome,cleanDayRevision,dailyRecordMetricsFromEvidence,
      emptyTaskOutcomeCounts,finiteNumber,materializeDailyRecordView,normalizeCompletionSource,
      normalizeDailyResultEntry,positiveMinutes,sanitizePracticeRuns,sanitizeTaskOutcomeCounts,
      summarizeCleanPracticeRuns,taskAreaValue,taskMeasureValue,taskOutcomeInfo,taskOutcomeSummaryText,
      taskOutcomeTotal,taskTargetValue
    }),
    presentation:Object.freeze({
      dateInsightsMeta,fmtS,formatPracticeMs,practicePaceBandLabel,prettyDate,renderRichTextContent,
      setProgressSummary,studyMinuteToHHMM,textEl,timeLabelFromIso
    }),
    schedule:Object.freeze({
      adjustedEndMin,adjustedStartMin,effectiveNowMin,hasAdjustedTiming,isLiveTrackableTimer,
      isTaskResolved,isTrackableBlock,isWorkBlock,latestTrackableEndMin,originalEndMin,
      originalStartMin,scheduleFingerprint
    }),
    evidence:Object.freeze({
      actualRecordsSnapshot,applicableNotesForTask,clearManualCompletionOverride,
      liveTaskOutcome,progressInputState,recordCurrentActiveToTask,
      resolveTaskCompletion,storeResolvedCompletion,setCompletionState,syncProgressInputsToState,updateTimerFocusMetrics
    }),
    session:Object.freeze({
      acknowledgeSavedStudyDay,clearCanonicalSessionAfterSavedDay,
      cancelPendingLiveDraftSave,clearSaveReminder,flushLiveDraft,
      getLifecycleRevision:()=>SessionLifecycle.revision,getOwnershipRevision:()=>AppOwnership.revision,getReviewDate,
      lifecycleCanWrite:()=>SessionLifecycle.canWrite(),markDayContentChanged,markDayContentSaved,resetRuntimeSessionState,
      runLifecycle:(kind,options,operation)=>SessionLifecycle.run(kind,options,operation),
      saveLiveDraft,setReviewDateTitle,setSessionPanelMode,stopTimerExecution:()=>TimerEngine.stopExecution(),
      appCanMutate,writeCanonicalNow:(operation,options)=>ActiveSessionRuntime.writeCanonicalNow(operation,options),writeLiveDraftNow
    }),
    notesDefaults:Object.freeze({
      noteStoredValueForKey,bindTaskNoteEditor,closeRichTextField:field=>richTextCloseField(field),commitTaskNoteEditor,currentNoteEntriesForWorkTasks,
      refreshPlanAfterSessionReset,renderInheritedNotes,setPlanStatus,syncUnfinishedNoteDraft,unfinishedNoteDraftText
    }),
    notifications:NoticeCoordinator.presentation('review',Object.freeze({label:'Open Review',run:()=>goTab('review')})),
    view:Object.freeze({markStorageHealthTimestamp,notifyUser,on,refreshLibraryAfterSave:async()=>{LibraryView.invalidate();return LibraryView.render();},refreshStorageFallbackWarning,setStatus,updateBadges}),
    interactions:Object.freeze({confirm:options=>Interactions.confirm(options),notify:options=>Interactions.notify({...options,source:'review'})}),
    environment:Object.freeze({cancelAnimationFrame,clearTimeout,requestAnimationFrame,setTimeout,todayISO})
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
const SessionLifecycleViews=SessionActionsModule.createLifecycleViews(Object.freeze({
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
function lifecycleEditorElements(...args){return SessionLifecycleViews.lifecycleEditorElements(...args);}
function setLifecycleEditorsBlocked(...args){return SessionLifecycleViews.setLifecycleEditorsBlocked(...args);}
function invalidateLifecycleEditors(...args){return SessionLifecycleViews.invalidateLifecycleEditors(...args);}
function reconcileLifecycleEditors(...args){return SessionLifecycleViews.reconcileLifecycleEditors(...args);}
function completeLifecycleTransition(...args){return SessionLifecycleViews.completeLifecycleTransition(...args);}
const SessionLifecycleHooks=ReviewHostModule.createLifecycleHooks(Object.freeze({
  canMutate:()=>appCanMutate(),
  reviewEditor:ReviewEditor,
  lifecycleViews:SessionLifecycleViews,
  diagnostics:Object.freeze({capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level)})
}));
const SessionLifecycle=SessionLifecycleModule.createCoordinator(Object.freeze({hooks:SessionLifecycleHooks}));
if(!Object.isFrozen(SessionLifecycle)||SessionLifecycle.format!=='study-director.session-lifecycle-coordinator'||SessionLifecycle.contractVersion!==1){
  throw new Error('Study Director session lifecycle coordinator is unavailable or incompatible.');
}

ActiveSessionRuntime=SessionHostModule.createController(Object.freeze({
  configuration:Object.freeze({
    activeSessionId:ACTIVE_SESSION_ID,activeSessionVersion:DATA_CONTRACT.schemas.ActiveSession.version,
    sessionSnapshotVersion:DATA_CONTRACT.schemas.SessionSnapshot.version,maxCarryForwardChars:APP_LIMITS.maxCarryForwardChars,
    maxScheduleChars:APP_LIMITS.maxScheduleChars,maxTasksPerDay:APP_LIMITS.maxTasksPerDay,
    debounceMs:LIVE_DRAFT_SAVE_DEBOUNCE_MS,timerSnapshotIntervalMs:TIMER_SNAPSHOT_INTERVAL_MS,
    completionNone:COMPLETION_SOURCES.NONE,
    practicePauseCauses:Object.freeze({session:PRACTICE_PAUSE_CAUSES.SESSION,gap:PRACTICE_PAUSE_CAUSES.GAP,main:PRACTICE_PAUSE_CAUSES.MAIN})
  }),
  codec:Object.freeze({sanitizeCurrent:value=>ActiveSessionCodec.sanitizeCurrent(value),sanitizeSessionSnapshot:(value,date,fingerprint,revision)=>ActiveSessionCodec.sanitizeSessionSnapshot(value,date,fingerprint,revision)}),
  repository:Object.freeze({
    save:(value,options)=>AppData.activeSession.save(value,options),load:(retry,options)=>AppData.activeSession.load(retry,options),
    clear:()=>AppData.activeSession.clear(),readLocal:()=>AppData.activeSession.readLocal(),
    nextRevision:seed=>AppData.activeSession.nextRevision(seed),settled:()=>AppData.activeSession.settled()
  }),
  canonical:Object.freeze({same:(a,b)=>CanonicalModule.same(a,b)}),
  snapshot:Object.freeze({
    tasks:()=>TASKS,ensureTaskIds,taskIdentity:TaskIdentity,taskState:TaskSessionState,timerState:TimerState,
    captureEvidence:()=>captureRuntimeEvidence({includeActivePause:false,withCompletion:false,includeRecords:true}),
    timerPayload:timerRuntimePayload,reviewSnapshot:()=>currentReviewSnapshot(),practiceSnapshot:()=>PracticePacer.snapshot(),
    practiceRestore:(value,options)=>PracticePacer.restore(value,options),getReviewDate,scheduleFingerprint,
    sessionFingerprint:activeSessionScheduleFingerprint,appliedScheduleText:()=>PlanRuntime.appliedScheduleText(),
    getCarryForward:()=>latestCarryForward,setCarryForward:value=>{latestCarryForward=value;},clearProgress:clearProgressRuntime,
    sanitizeAdjustedSchedule:sanitizeRuntimeAdjustedSchedule,invalidateScheduleDerived,setCurrentTask,timerRestoreValid:runtime=>!!validateTimerRestoreCandidate(runtime)
  }),
  domain:Object.freeze({normalizeCompletionSource,clampCompletion:CompletionModel.clampPercent,cleanDayRevision,clampText,isCanonicalScheduleText,isValidIsoDate,todayISO}),
  persistence:Object.freeze({
    canMutate:appCanMutate,recoveryQuiesced:managedRecoverySessionQuiesced,
    persistenceBlocked:()=>ReviewSaveService.status().activeSessionPersistenceBlocked,
    recoveryWorkActive:()=>AppOwnership.canMutate()&&AppMutationCoordinator?.status().active==='managed-recovery',
    timerSnapshotEligible:()=>!TimerState.paused&&!TimerState.inactiveGap&&!!TimerState.runtime&&TimerState.runtime.startMs!==null,
    markContentChanged:markDayContentChanged,
    snapshotForWrite:()=>SessionHandoffRuntime?.snapshotForWrite()||ActiveSessionRuntime.captureSnapshot(),
    reportResult:handleActiveSessionRepositoryResult,warn:showLiveDraftSaveWarning
  }),
  lifecycle:Object.freeze({run:(kind,options,operation)=>SessionLifecycle.run(kind,options,operation)}),
  apply:Object.freeze({
    readPlanDraft:()=>String(document.getElementById('plan-input')?.value||''),
    writePlanDraft:value=>{const input=document.getElementById('plan-input');if(input)input.value=value;},
    previewPlanDraft:()=>PlanDraftEditor.preview({silent:true,enterDraft:false}),
    setStudyDate:(date,automatic)=>{const dd=document.getElementById('day-date');if(dd){dd.value=date;dd.dataset.autoDate=automatic?'1':'0';}},
    applySessionSchedule:input=>applySchedule({source:input.source,skipNotify:true,studyDate:input.studyDate,reviewOnly:input.reviewOnly,forceReload:true,sessionSnapshot:input.snapshot,lifecycleManaged:true,scheduleText:input.scheduleText,persistDraft:false})
  }),
  reset:Object.freeze({
    stopTimerPresentation:()=>TimerPresentation.stop(),
    invalidatePresentation:()=>{executeIdleDisplayKey='';realTimeAwarenessRenderKey='';executePanelsRenderKey='';executeProgressPanelRenderKey='';scheduleEndPromptKey='';},
    resetCountdown:resetCountdownRuntime,setCurrentTask,resetBreak:resetBreakState,setEmptyTimerMode:()=>setTimerMode(TIMER_MODES.EMPTY,'session-reset'),
    clearTimerSession:()=>TimerState.clearSession(),hydrateReview:date=>hydrateReviewState({date,snapshotReview:null}),
    invalidateSchedule:()=>invalidateScheduleDerived({identity:true,adjustments:true,render:true}),resetPlanSession:()=>PlanRuntime.resetSession(),
    clearProgress:clearProgressRuntime,clearCarryForward:()=>{latestCarryForward='';},resetPractice:()=>PracticePacer.reset(),
    pausePracticeForSessionEnd:()=>PracticePacer.pauseForSessionEnd({persist:false})
  }),
  installation:Object.freeze({id:()=>InstallationIdentity.getId()}),clock:Object.freeze({nowMs:DecisionClock.nowMs,nowIso:()=>new Date().toISOString()}),
  environment:Object.freeze({clearTimeout:id=>clearTimeout(id),setTimeout:(callback,delay)=>setTimeout(callback,delay)})
}));
if(!Object.isFrozen(ActiveSessionRuntime)||ActiveSessionRuntime.format!=='study-director.session-host'||ActiveSessionRuntime.contractVersion!==1){
  throw new Error('Study Director Active Session runtime is unavailable or incompatible.');
}

ReviewSavedDayRuntime=ReviewHostModule.createSavedDayCoordinator(Object.freeze({
  document,day:ReviewDayState,
  runtime:Object.freeze({
    tasks:()=>TASKS,timerState:TimerState,isTrackableBlock,captureSessionSnapshot:()=>captureSessionSnapshot(),
    appliedScheduleText:()=>PlanRuntime.appliedScheduleText(),appCanMutate:()=>appCanMutate(),panelMode:()=>sessionPanelMode,
    safetyMessage:()=>sessionSafetyMessage,setSafetyMessage:value=>{sessionSafetyMessage=String(value||'');},
    isSuspended:session=>isSuspendedActiveSession(session),activeSessionSnapshot:session=>activeSessionSnapshot(session),
    applyStoredSessionSnapshot:(session,snapshot,options)=>applyStoredSessionSnapshot(session,snapshot,options),
    setPanelMode:(mode,session)=>setSessionPanelMode(mode,session),setTimerDone:()=>setTimerMode(TIMER_MODES.DONE,'suspended-session-saved'),
    updateSessionControls
  }),
  repositories:Object.freeze({
    loadActiveSession:(...args)=>AppData.activeSession.load(...args),
    dailyDocuments:(...args)=>AppData.dailyRecords.documents(...args),
    verifyDaily:record=>AppData.dailyRecords.verifyCanonical(record),
    pendingReviews:()=>AppData.pendingReviews.list()
  }),
  codecs:Object.freeze({
    sanitizeSession:value=>ActiveSessionCodec.sanitizeCurrent(value),
    savedDayCoversSessionEvidence:(record,subject,options)=>DailyRecordCodec.savedDayCoversSessionEvidence(record,subject,options)
  }),
  session:Object.freeze({
    writeCanonicalNow:(label,options)=>ActiveSessionRuntime.writeCanonicalNow(label,options),
    clearCanonicalAfterSavedDay:()=>ActiveSessionRuntime.clearCanonical('clearing the saved study session'),
    clearSafetyMessage:prefix=>clearSessionSafetyMessage(prefix)
  }),
  review:Object.freeze({
    saveService:ReviewSaveService,editor:ReviewEditor,
    closeReflectionEditor:()=>richTextCloseField(document.getElementById('daily-reflection'))
  }),
  view:Object.freeze({
    prettyDate,refreshStorageWarning:refreshStorageFallbackWarning,notifyUser,setStatus,openDetails:setReviewDetailDisclosures,
    diagnostics:(scope,error,level)=>AppDiagnostics.capture(scope,error,level),
    staleSaveStatus:()=>NoticeCoordinator.eventStatus().events.some(event=>event.source==='review'&&event.id==='status-save-status'&&event.message==='Review is ready. Save today to Library when you are done.')
  }),
  activation:Object.freeze({publishRollover:()=>AppActivation.publish(APP_ACTIVATION_KINDS.DATE_ROLLOVER,'study-day-rollover',{destructive:true})})
}));

/* LIVE FOCUS EVIDENCE IN THE EXECUTION HEADER */
function timerMetricElements(...args){return ExecutionViews.timerMetricElements(...args);}
function updateTimerFocusMetrics(...args){return ExecutionViews.updateTimerFocusMetrics(...args);}
/* PORTABLE ONGOING-NOTE EXPORT · READ-ONLY */
const RetainedBackupFiles=BackupRecoveryHostModule.createRetainedBackupFiles(Object.freeze({
  restoreJournalPayload:()=>JournalAppMeta.read('restoreJournalPayload'),
  repositoryIntegrityState:()=>BackupAppMeta.read('repositoryIntegrityScrub')
}));
if(!Object.isFrozen(RetainedBackupFiles)||RetainedBackupFiles.format!=='study-director.retained-backup-files'||RetainedBackupFiles.contractVersion!==1){
  throw new Error('Study Director retained backup-file policy is unavailable or incompatible.');
}
const BackupFiles=ExportsModule.createFileStore({storage:navigator.storage,locks:navigator.locks,root:ProfileScope.scoped('@@SD_BACKUP_FILES_OPFS_DIRECTORY@@'),retained:()=>RetainedBackupFiles.names(),isAvailable:()=>upkeepBlocker()||(navigator.storage?.getDirectory&&navigator.locks?.request?true:'storage-unavailable'),onError:error=>AppDiagnostics.capture('backup.file-cleanup',error,'warn')});
let fileProcessingNotice=null;
const Exports=ExportsModule.createCoordinator({
  createWorker:()=>new Worker(trustedAssetURL('@@SD_EXPORT_WORKER_FILENAME@@'),{name:'study-director-exports'}),window,document,files:BackupFiles,
  onState:state=>{renderFileBackup();if(state.fileBusy){if(!fileProcessingNotice)fileProcessingNotice=NoticeCoordinator.presentation('file-processing').begin({id:'worker',surfaceId:'file-processing-status',foreground:false,announce:false,title:'File processing'});fileProcessingNotice.update({message:state.phase,progress:{stage:state.phase}});}else{fileProcessingNotice?.resolve();fileProcessingNotice=null;const status=document.getElementById('file-processing-status');if(status)status.textContent='';}}
});
let BackupProtectionHost=null;
function backupBackgroundAvailability(){return BackupProtectionHost?BackupProtectionHost.backgroundAvailability():backgroundBlocker()||'locked';}
function setBackupProtectionSurfaceError(error){return BackupProtectionHost?.surfaceError(error)||false;}
const BackupProtectionStorage=BackupActionsHostModule.createProtectionStorage(Object.freeze({meta:ExportsAppMeta,settingName:'backupProtection',settingKey:APP_META_KEYS.backupProtection}));
BackupProtectionHost=BackupActionsHostModule.createProtectionHost(Object.freeze({
  module:ExportsModule,processing:Exports,storage:BackupProtectionStorage,
  interactions:Interactions,settingKey:APP_META_KEYS.backupProtection,
  mutation:Object.freeze({
    remember:()=>Profiles.list().length<2,canMutate:()=>appCanMutate(),
    issueToken:()=>AppOwnership.issueWriteToken('change backup encryption'),
    assertToken:token=>AppOwnership.assertWriteToken(token,'change backup encryption')
  }),
  environment:Object.freeze({window,backgroundBlocker:()=>backgroundBlocker()}),
  view:Object.freeze({
    document,clampText,maxStatusMessageChars:APP_LIMITS.maxStatusMessageChars,
    resolveSettingNotice:()=>NoticeCoordinator.resolveEvent('backup-protection','settings'),
    publishSettingError:message=>NoticeCoordinator.emit({source:'backup-protection',id:'settings',surfaceId:'backup-protection-hint',surface:'inline',severity:'error',lifecycle:'failed',cue:'none',message}),
    fullyInitialized:()=>StartupLifecycle.status().fullyInitialized,
    wakeBackground:reason=>wakeBackgroundOperations(reason),
    refreshProviders:()=>BackupProviderRuntime.refresh(),
    renderProfile:()=>renderProfile()
  })
}));
if(!Object.isFrozen(BackupProtectionHost)||BackupProtectionHost.format!=='study-director.backup-protection-host'||BackupProtectionHost.contractVersion!==1){
  throw new Error('Study Director backup-protection host is unavailable or incompatible.');
}
const BackupProtection=BackupProtectionHost.protection;
BackupProtectionHost.install();
const NoteExporter=NoteExportModule.createExporter(Object.freeze({ports:Object.freeze({
  assets:Object.freeze({get:id=>RichTextAssets.get(id)}),
  notes:Object.freeze({get:key=>AppData.notes.get(key)}),
  processing:Object.freeze({job:(operation,options)=>AttachmentStorage.during(()=>Exports.job(operation,options)),run:Exports.run,cancel:Exports.cancel,check:Exports.check}),
  scheduling:Object.freeze({yieldTask:BackgroundTasks.yieldTask,budget:BackgroundTasks.budget}),
  output:Object.freeze({chooseSave:Exports.chooseSave,save:Exports.save}),
  richText:Object.freeze({assetIds:value=>RichTextApi.assetIds(value),exportDocument:value=>RichTextApi.exportDocument(value)})
})}));
if(!Object.isFrozen(NoteExporter)||NoteExporter.format!=='study-director.note-exporter'||NoteExporter.contractVersion!==2){
  throw new Error('Study Director note exporter is unavailable or incompatible.');
}
const PdfDocuments=DocumentHostModule.createPdfController(Object.freeze({
  document,window,urls:URL,store:AttachmentStorage,overlay:WorkspaceOverlay,
  notifications:Object.freeze({notify:input=>Interactions.notify(input),resolve:(source,key)=>NoticeCoordinator.resolveEvent(source,key)}),
  diagnostics:Object.freeze({capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level)})
}));
const NotePrinter=DocumentHostModule.createPrinter(Object.freeze({
  document,window,richText:RichTextApi,assets:RichTextAssets,plain:value=>plainTextContent(value),
  diagnostics:Object.freeze({capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level)}),now:()=>Date.now()
}));
let AttachmentLibrary=null;
const LibraryDocuments=DocumentHostModule.createIntegration(Object.freeze({
  limits:Object.freeze({maxRichAssetPerDocument:APP_LIMITS.richAssetMaxPerDocument,maxRichAssetBytesPerDocument:RichTextApi.assetPolicy.maxBytesPerDocument}),
  notes:AppData.notes,
  ownership:Object.freeze({issue:reason=>AppOwnership.issueWriteToken(reason),assert:(token,reason)=>AppOwnership.assertWriteToken(token,reason)}),
  editor:RichTextRuntime,review:ReviewEditor,session:Object.freeze({settled:()=>AppData.activeSession.settled()}),
  library:()=>LibraryView,attachmentLibrary:()=>AttachmentLibrary,attachmentTypes:AttachmentsModule,assets:RichTextAssets,richText:RichTextApi,
  content:Object.freeze({withinLimits:value=>editorContentWithinLimits(value)}),printer:NotePrinter,exporter:NoteExporter
}));
if(!Object.isFrozen(LibraryDocuments)||LibraryDocuments.format!=='study-director.document-integration'||LibraryDocuments.contractVersion!==1){
  throw new Error('Study Director Library document integration is unavailable or incompatible.');
}
/* LIBRARY MODULE COMPOSITION */
const settleAttachmentWriters=LibraryDocuments.settleAttachmentWriters;
const AttachmentReferences=AttachmentsModule.createReferenceCoordinator(Object.freeze({
  data:AppData,
  scan:value=>RichTextApi.scanAttachmentReferences(String(value||'')),
  rewriteReferences:targets=>LibraryClearState.rewriteReferences(targets),
  withPersistenceSuppressed:operation=>withRestoreSessionPersistenceSuppressed(operation),
  review:Object.freeze({hydrate:options=>ReviewEditor.hydrate(options),invalidateBindings:()=>ReviewEditor.invalidateBindings()}),
  background:Object.freeze({budget:()=>BackgroundTasks.budget(),yieldTask:options=>BackgroundTasks.yieldTask(options)}),
  live:Object.freeze({
    fields:()=>document.querySelectorAll('textarea.task-note-field,textarea.library-diary-textarea,#daily-reflection'),
    reviewDate:()=>getReviewDate(),todayIso:()=>todayISO(),noteKey:area=>{const title=normalizeAreaName(area);return title?AppData.notes.get(title)?.id||title:'';}
  })
}));
const LibraryClearState=LibraryClearModule.createState(Object.freeze({
  createRollbackScope:(plan,policy)=>LibraryClearModule.createRollbackScope(plan,policy),
  withPersistenceSuppressed:operation=>withRestoreSessionPersistenceSuppressed(operation),
  data:AppData,
  references:Object.freeze({
    scan:value=>AttachmentReferences.scan(value),
    remove:(value,ids)=>RichTextApi.removeAttachmentReferences(value,ids),
    listSources:()=>AttachmentReferences.sources({includeLive:false})
  }),
  attachments:Object.freeze({
    inventory:()=>AttachmentLibrary.inventory(),
    verifyMetadata:rows=>AttachmentLibrary.verifyMetadata(rows),
    restoreMetadata:rows=>AttachmentLibrary.restoreMetadata(rows)
  }),
  review:Object.freeze({hydrate:options=>ReviewEditor.hydrate(options),invalidateBindings:()=>ReviewEditor.invalidateBindings()}),
  nowIso:()=>new Date().toISOString()
}));
const validateAttachmentInsertionValue=LibraryDocuments.validateAttachmentInsertion;
const insertAttachmentIntoNote=LibraryDocuments.insertAttachment;
const quiesceAttachmentMutation=LibraryDocuments.quiesceAttachmentMutation;
AttachmentLibrary=AttachmentsModule.create({
  notifications:NoticeCoordinator.presentation('attachments',Object.freeze({label:'Open attachments',run:async()=>{if(await goTab('library')){LibraryView.showSection('data');const panel=document.getElementById('library-attachments');panel.open=true;panel.scrollIntoView({block:'start'});}}})),
  onWorkStart:()=>{pwaWorkRevision++;},
  store:AttachmentStorage,processing:Exports,document,interactions:Interactions,
  canMutate:()=>appCanMutate(),requireOwner:()=>{if(!appCanMutate())throw new Error('Use the primary tab to manage attachments.');},token:()=>AppOwnership.issueWriteToken('manage attachments'),
  isActive:()=>document.getElementById('pane-library').classList.contains('on')&&!document.getElementById('library-data').hidden,cleanup:()=>scheduleRichTextAssetMaintenance(),renderReference:(container,source)=>renderRichTextContent(container,source.value,'',source.label),sources:options=>AttachmentReferences.sources(options),integrityIssue:id=>BackupIntegrity?.attachmentIssue(String(id||''))||null,destinations:()=>LibraryView.noteDestinations(),settle:settleAttachmentWriters,openLibrary:()=>{LibraryView.showSection('data');return goTab('library',{source:'attachment-library'});},
  openSource:async source=>{if(!await goTab('library',{source:'attachment-reference'}))return false;if(source.kind==='note')return LibraryView.revealNoteReference(source.key);if(source.kind==='day')return LibraryView.openDay(source.key);return false;},
  preparePdfOpen:()=>PdfDocuments.prepareNativeWindow(),
  openPdf:(row,file,reservedWindow,releaseReader)=>PdfDocuments.open(row,file,reservedWindow,releaseReader),
  deletionGuard:async options=>{if((await AppData.restoreJournal.read())?.state)throw new Error('Finish backup recovery before deleting attachments.');if(!options?.allowLibraryClearJournal&&(await AppData.libraryClearJournal.read())?.state)throw new Error('Finish Library data recovery before deleting attachments.');const token=AppOwnership.issueWriteToken('delete attachment'),revision=richAssetReferenceRevision,dataset=await AppData.dailyRecords.datasetRevision();if(dataset===null)throw new Error('Saved notes could not be verified.');return ()=>{AppOwnership.assertWriteToken(token,'delete attachment');return revision===richAssetReferenceRevision;};},
  runExclusive:(kind,operation)=>AppMutationCoordinator.runExclusive(kind,authority=>withRestoreSessionPersistenceSuppressed(()=>operation(authority))),
  quiesce:(operation,options)=>quiesceAttachmentMutation(operation,options),
  removeReferences:id=>AttachmentReferences.removeEverywhere(id),
  insert:(key,row)=>insertAttachmentIntoNote(key,row)
 });
const RichTextAttachmentPort=LibraryDocuments.richAttachmentPort;
invalidateAttachmentLibrary=()=>AttachmentLibrary.invalidate();

function normalizeAttachmentIntegrityState(value){return BackupIntegrityHostModule.normalizeAttachmentState(value,AttachmentsModule.validId);}
function normalizeRepositoryIntegrityTarget(value){return BackupIntegrityHostModule.normalizeRepositoryTarget(value,IntegrityContinuationModule.normalize);}
function normalizeRepositoryIntegrityState(value){return BackupIntegrityHostModule.normalizeRepositoryState(value,IntegrityContinuationModule.normalize);}
function renderIntegrityStatuses(){return BackupIntegrity?.render()||false;}
function requestRepositoryIntegrityRecheck(target){return BackupIntegrity?.requestRepositoryRecheck(target)||Promise.resolve(false);}
function scheduleAttachmentIntegrityAudit(delay=15000,trigger='scheduled'){return BackupIntegrity?.scheduleAttachment(delay,trigger)||false;}
function installAttachmentIntegrityAudit(){return BackupIntegrity?.installAttachment()||Promise.resolve(null);}
function installRepositoryIntegrityScrub(){return BackupIntegrity?.installRepository()||Promise.resolve(null);}

async function libraryClearSnapshot(){
  const [attachments,sources]=await Promise.all([AttachmentLibrary.inventory(),AttachmentReferences.sources({includeLive:false})]);
  return Object.freeze({attachments,sources});
}
async function assertLibraryClearEligible(){
  if(hasBlockingActiveSession())throw new Error('End or suspend the active session before clearing Library data.');
  if((await AppData.restoreJournal.read())?.state)throw new Error('Finish backup recovery before clearing Library data.');
  if((await AppData.libraryClearJournal.read())?.state)throw new Error('An interrupted Library clear requires recovery before another clear can start.');
  if(!appCanMutate())throw new Error('Use the primary tab to clear Library data.');
  return true;
}
const LibraryClearCoordinator=LibraryClearModule.createCoordinator(Object.freeze({
  diagnostics:Object.freeze({start:BackupOperationDiagnostics.start,mark:BackupOperationDiagnostics.mark,finish:BackupOperationDiagnostics.finish,fail:BackupOperationDiagnostics.fail}),
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
  removeAttachmentMetadata:ids=>AttachmentLibrary.removeMetadata(ids),verifyFinal:LibraryClearState.verifyFinal,restore:LibraryClearState.restore,verifyRestore:LibraryClearState.verifyRestore,sweep:()=>AttachmentLibrary.sweepOrphans(),
  failClosed:message=>AppMutationCoordinator.failClosed(message,'library-clear'),clearFault:()=>AppMutationCoordinator.clearFault(),
  journal:Object.freeze({prepare:value=>AppData.libraryClearJournal.prepare(value),read:()=>AppData.libraryClearJournal.read(),mark:(id,phase)=>AppData.libraryClearJournal.mark(id,phase),clear:id=>AppData.libraryClearJournal.clear(id)})
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
const LibraryView=LibraryModule.createView(Object.freeze({ports:Object.freeze({
  notifications:NoticeCoordinator.presentation('library',Object.freeze({label:'Open Library',run:()=>goTab('library')})),
  records:Object.freeze({
    get:date=>AppData.dailyRecords.get(date),
    remove:date=>AppData.dailyRecords.remove(date),
    sortedSummaries:()=>AppData.dailyRecords.sortedSummaries()
  }),
  domain:Object.freeze({
    countTaskOutcomes,earliestSupportedSavedDate:()=>APP_LIMITS.minSupportedSavedDate,isTrackableBlock,isValidIsoDate,isSupportedSavedDate,todayISO,sanitizePracticeRuns,
    sanitizeTaskOutcomeCounts,taskOutcomeSummaryText
  }),
  presentation:Object.freeze({
    createSavedDayTaskReviewCard,createPomodoroSummaryLine,emptyMsg,
    optionalDurationLabel,optionalHoursLabel,optionalPercentLabel,populatePracticeRunTable,prettyDate,renderRichTextContent,textEl,plainTextContent,
  }),
  view:Object.freeze({document,goTab,setStatus,setTextSafe,window}),
  interactions:Object.freeze({
    choose:options=>Interactions.choose(options),
    confirm:options=>Interactions.confirm(options),
    input:options=>Interactions.input(options)
  }),
  environment:Object.freeze({
    cancelAnimationFrame:frame=>cancelAnimationFrame(frame),
    createOption:(text,value)=>new Option(text,value),
    createSearchWorker:()=>new Worker(trustedAssetURL(NOTES_SEARCH_WORKER_URL),{name:'study-director-note-search'}),
    requestAnimationFrame:callback=>requestAnimationFrame(callback)
  }),
  exporter:LibraryDocuments.exporter,
  diary:Object.freeze({
    bindEditor:(field,date,record,options)=>LibraryDiaryEditor.bind(field,date,record,options),
    captureEditor:(field,event)=>LibraryDiaryEditor.capture(field,event),
    deleteEntry:(date,options)=>LibraryDiaryEditor.deleteEntry(date,options),
    draft:date=>LibraryDiaryEditor.draft(date),
    clearEditor:field=>LibraryDiaryEditor.clear(field),
    scheduleEditor:(field,value)=>LibraryDiaryEditor.schedule(field,value),
    flushEditor:(field,options)=>LibraryDiaryEditor.flush(field,options),
    settled:field=>LibraryDiaryEditor.settled(field)
  }),
  notes:Object.freeze({
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
    get:(key,label)=>AppData.notes.get(key,label),
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
    reviewKept:id=>void KeptVersions.review(id),
    keptVersion:id=>KeptVersions.note(id),
    searchDocuments:noteSearchDocuments,
    size:()=>NotesRuntime.size(),
    tagged:names=>NoteLinks.tagged(names),
    tags:()=>NoteLinks.tags(),
    trash:key=>LibraryNoteWorkflows.trash(key),
    trashSnapshot:()=>AppData.notes.trashSnapshot(),
    versions:target=>withBackupPassword(()=>BackupRecoveryHost.history.openNote(target)),
    print:(key,title)=>LibraryDocuments.printNote(key,title)
  }),
  attachments:Object.freeze({
    batch:operation=>AttachmentLibrary.batch(operation),
    close:()=>AttachmentLibrary.close(),
    count:()=>AttachmentLibrary.count(),
    invalidate:()=>AttachmentLibrary.invalidate(),
    reconcile:()=>AttachmentLibrary.reconcile(),
    refresh:()=>AttachmentLibrary.refresh()
  }),
  preferences:Object.freeze({
    read:()=>AppData.local.getJson(STORAGE_KEYS.libraryView,null),
    write:value=>AppData.local.setJson(STORAGE_KEYS.libraryView,value)
  }),
  clearLibrary:Object.freeze({
    preflight:selection=>LibraryClearCoordinator.preflight(selection),
    execute:options=>RichTextRuntime.quiesce(()=>LibraryClearCoordinator.execute(options))
  }),
  ownership:Object.freeze({canMutate:()=>appCanMutate()}),
  overlays:Object.freeze({createAnchoredPopover:(popup,options)=>RichTextApi.createAnchoredPopover(popup,options)}),
  session:Object.freeze({hasActiveSession:hasBlockingActiveSession})
})}));
if(!Object.isFrozen(LibraryView)||LibraryView.format!=='study-director.library-view'||LibraryView.contractVersion!==1){
  throw new Error('Study Director Library view is unavailable or incompatible.');
}
NavigationController=NavigationModule.createController(Object.freeze({
  window,
  host:Object.freeze({
    currentTab:()=>String(document.querySelector('.pane.on')?.id||'pane-plan').replace(/^pane-/,'')||'plan',
    prepare:prepareTabDeparture,
    present:presentTabCommit,
    commit:commitTabView,
    ready:waitForTabReady,
    report:(boundary,error)=>AppDiagnostics.capture(boundary,error,'warn'),
    workspace:Object.freeze({
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
const BackupCodec=BackupCodecModule.createBackupCodec(Object.freeze({
  processing:Object.freeze({run:Exports.run,scope:Exports.scope}),
  appConfig:Object.freeze({
    appName:APP_CONFIG.appName,
    attribution:APP_CONFIG.attribution
  }),
  limits:APP_LIMITS,
  dataContract:DATA_CONTRACT,
  entityTypes:BACKUP_ENTITY_TYPES,
  keyedRecord:KeyedRecord,
  entities:Object.freeze({entityDefinition,entityIdentity}),
  helpers:Object.freeze({boundedInt,jsonByteLength}),
  richText:Object.freeze({assetIds:value=>RichTextApi.scanAttachmentReferences(value).assetIds,assetIdValid:AttachmentsModule.validId,imageMimeTypeValid:AttachmentsModule.validType}),
  dailyRecordCodec:DailyRecordCodec,
  activeSessionCodec:ActiveSessionCodec,
  personalDataCodec:PersonalDataCodec,
  pendingReviewCodec:PendingReviewCodec
}));

const RuntimeBackupCodec=Object.freeze({...BackupCodec,inspect:BackupCodec.inspectCurrent});

function restoreSessionStateThroughLifecycle(...args){return SessionActions.restoreSessionStateThroughLifecycle(...args);}
function verifyRestoredTimerRuntimeSemantics(...args){return SessionActions.verifyRestoredTimerRuntimeSemantics(...args);}
function verifyRestoredSessionRuntime(...args){return SessionActions.verifyRestoredSessionRuntime(...args);}

// Byte staging finishes before the single attachment metadata commit. Rollback
// replaces the catalogue; physical reclamation still waits for all readers.
const NoteReconciliationUI=ReconciliationUIModule.createController(Object.freeze({ports:Object.freeze({
  configuration:Object.freeze({maxWords:APP_LIMITS.maxRichTextWords,maxBytes:APP_LIMITS.maxRichTextBytes}),
  richText:Object.freeze({mountRichTextEditor:RichTextApi.mountRichTextEditor,compareRichText:RichTextApi.compareRichText,mergeIncomingAdditions:RichTextApi.mergeIncomingAdditions,appendIncomingAdditions:RichTextApi.appendIncomingAdditions,mergeThreeWay:RichTextApi.mergeThreeWay}),
  assets:Object.freeze({get:assetId=>RichTextAssets.get(assetId)}),
  diagnostics:Object.freeze({capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level)}),
  view:Object.freeze({document,requestAnimationFrame:callback=>requestAnimationFrame(callback),cancelAnimationFrame:id=>cancelAnimationFrame(id)})
})}));
const BackupRuntimeHost=BackupRecoveryHostModule.createRuntime(Object.freeze({
  module:BackupModule,
  configuration:Object.freeze({
    appVersion:APP_VERSION,backupVersion:DATA_CONTRACT.schemas.Backup.version,starterSchedule:FACTORY_DEFAULTS.scheduleText,
    limits:Object.freeze({backupChunkItems:APP_LIMITS.backupChunkItems,backupMaxCompressedBytes:APP_LIMITS.backupMaxCompressedBytes,backupMaxFileBytes:APP_LIMITS.backupMaxFileBytes,backupMaxAssetDescriptors:APP_LIMITS.backupMaxAssetDescriptors,maxImportRecords:APP_LIMITS.maxImportRecords,maxNoteLinks:APP_LIMITS.maxNoteLinks,maxNotes:APP_LIMITS.maxNotes,maxPendingReviews:APP_LIMITS.maxPendingReviews})
  }),
  appData:AppData,storageHealthKey:STORAGE_KEYS.storageHealth,storageHealth:Object.freeze({snapshot:()=>StorageHealthController.snapshot(),markOk:(source,key)=>StorageHealthController.markOk(source,key)}),
  storageGeneration:()=>IndexedDb.lifecycle().resets,
  personal:Object.freeze({draft:PlanDraftEditor,data:PlanData,inputValue:()=>document.getElementById('plan-input')?.value,canMutate:()=>appCanMutate()}),
  files:BackupFiles,processing:Exports,protection:BackupProtection,backgroundAvailable:backupBackgroundAvailability,
  assets:Object.freeze({
    during:operation=>AttachmentStorage.during(operation),get:id=>AttachmentStorage.get(id),put:(id,blob)=>AttachmentStorage.put(id,blob),keys:()=>AttachmentStorage.keys(),list:()=>AttachmentStorage.list(),
    stage:(id,blob,options)=>AttachmentStorage.put(id,blob,{stage:true,token:options.token,...(options.signal?{signal:options.signal}:{}),check:options.check}),
    publish:(rows,token,check,options)=>AttachmentStorage.publish(rows,token,check,options),discard:rows=>AttachmentStorage.discard(rows),
    identify:blob=>AttachmentsModule.identify(blob),issueToken:reason=>AppOwnership.issueWriteToken(reason),assertToken:(token,reason)=>AppOwnership.assertWriteToken(token,reason),
    removeMany:ids=>RichTextAssets.removeMany(ids),removeMetadata:ids=>AttachmentLibrary.removeMetadata(ids),invalidateLibrary:()=>invalidateAttachmentLibrary(),scheduleMaintenance:delay=>scheduleRichTextAssetMaintenance(delay)
  }),
  referenceRevision:()=>richAssetReferenceRevision,mutationGeneration:()=>captureMutationGeneration,baseline:ReconciliationBaselineStore,
  codecs:Object.freeze({activeSession:ActiveSessionCodec,backup:RuntimeBackupCodec,dailyRecord:DailyRecordCodec,pendingReview:PendingReviewCodec}),
  reconciliation:Object.freeze({createPlan:ReconciliationModule.createPlan,resolvePlan:ReconciliationModule.resolvePlan,summarizePlan:ReconciliationModule.summarizePlan,savedDayContentValue:ReconciliationModule.savedDayContentValue}),
  noteReconciliation:Object.freeze({controller:NoteReconciliationUI,maintenancePause:RecoveryAssetMaintenancePause,merge:(base,local,incoming)=>RichTextApi.mergeThreeWay(base,local,incoming)}),
  recoveryNotes:Object.freeze({lifecycle:SessionLifecycle,date:()=>getReviewDate()}),
  session:Object.freeze({
    canMutate:()=>appCanMutate(),cancelLiveDraftSave:()=>cancelPendingLiveDraftSave(),captureSnapshot:captureSessionSnapshot,
    checkpointPendingReview:async()=>await ReviewEditor.flushPending({strict:true,allowDuringRecoveryQuiescence:true})!==false,
    hasActiveSession:hasBlockingActiveSession,hasTasks:()=>TASKS.length>0,toActiveSession:activeSessionPayload,
    withPersistenceSuppressed:operation=>withRestoreSessionPersistenceSuppressed(operation),yieldSession:options=>yieldSessionToOtherDevice(options)
  }),
  domain:Object.freeze({clampText,filenameSafeStudentName,getStudentName:getStudentNameFromDisplay,materializeDailyRecordView,sanitizeCurrentDailyRecord,todayISO}),
  view:Object.freeze({presentation:BackupPresentation,refreshPnote,refreshReview:()=>ReviewView.refresh(),renderSchedule:renderSched,deviceName:(id,others)=>deviceName(id,others)}),
  events:Object.freeze({
    libraryChanged:()=>{LibraryView.render();if(ReviewDayState.reminder.date)void revalidateSaveReminderAfterCanonicalConvergence();},
    restoreSessionState:restoreSessionStateThroughLifecycle,verifyActiveSessionRuntime:verifyRestoredSessionRuntime,
    notifyBackupChange:change=>notifyBackupChange(change),settleStorageReset:()=>settleStorageReset(),
    resetBackupNudge:()=>BackupNudge?.reset(),refreshStorageWarning:()=>refreshStorageFallbackWarning(),scheduleUpdate:delay=>schedulePwaUpdateEvaluation(delay)
  }),
  verifiedRecovery:VerifiedRecovery,
  interactions:Object.freeze({choose:options=>Interactions.choose(options),configure:options=>Interactions.configure(options),notify:options=>Interactions.notify(options)}),
  operations:Object.freeze({assertAuthority:options=>AppMutationCoordinator.assertAuthority(options),canShare:()=>UnsupportedData.held()?'unsupported-data':true,clearFault:()=>AppMutationCoordinator.clearFault(),failClosed:message=>AppMutationCoordinator.failClosed(message),runExclusive:(kind,operation)=>AppMutationCoordinator.runExclusive(kind,operation)}),
  environment:Object.freeze({AbortController,yieldTask:BackgroundTasks.yieldTask,clearTimeout:timer=>clearTimeout(timer),setTimeout:(callback,delay)=>setTimeout(callback,delay)}),
  diagnostics:Object.freeze({capture:AppDiagnostics.capture,start:BackupOperationDiagnostics.start,mark:BackupOperationDiagnostics.mark,finish:BackupOperationDiagnostics.finish,fail:BackupOperationDiagnostics.fail})
}));
if(!Object.isFrozen(BackupRuntimeHost)||BackupRuntimeHost.format!=='study-director.backup-runtime-host'||BackupRuntimeHost.contractVersion!==1){
  throw new Error('Study Director Backup runtime host is unavailable or incompatible.');
}
const BackupRuntime=BackupRuntimeHost.runtime;
const {controller:BackupController,checkpoint:CheckpointPipeline,repository:RepositoryCheckpointPipeline,providers:BackupProviderRuntime}=BackupRuntime;
const KeptVersionsView=BackupRecoveryHostModule.createKeptVersionsView(Object.freeze({document,count:()=>KeptVersions?.count()||0}));
if(!Object.isFrozen(KeptVersionsView)||KeptVersionsView.format!=='study-director.kept-versions-view'||KeptVersionsView.contractVersion!==1){
  throw new Error('Study Director Kept Versions view is unavailable or incompatible.');
}
KeptVersions=BackupRecoveryHostModule.createKeptVersions(Object.freeze({
  controller:Object.freeze({
    status:()=>BackupController.status(),
    resolveConvergedKeptVersions:()=>BackupController.resolveConvergedKeptVersions(),
    reviewKeptVersions:options=>BackupController.reviewKeptVersions(options)
  }),
  reviews:Object.freeze({list:()=>AppData.pendingReviews.list()}),
  diagnostics:Object.freeze({capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level)}),
  environment:Object.freeze({
    canMutate:()=>appCanMutate(),now:()=>Date.now(),
    connectCardOpen:()=>SyncStatusHost?.connectCardOpen()===true,sessionYieldedAt:()=>sessionYieldedAt
  }),
  notifications:Object.freeze({
    notify:options=>Interactions.notify(options),
    resolveEvent:(source,id)=>NoticeCoordinator.resolveEvent(source,id)
  }),
  view:Object.freeze({
    render:()=>KeptVersionsView.render(),renderLocation:()=>renderDriveBackup(),scheduleStatus:()=>scheduleSyncStatus(),
    refreshNotes:()=>LibraryView.refreshNotes()
  })
}));
if(!Object.isFrozen(KeptVersions)||KeptVersions.format!=='study-director.kept-versions'||KeptVersions.contractVersion!==1){
  throw new Error('Study Director kept-version recovery controller is unavailable or incompatible.');
}
SessionHandoffRuntime=SessionHandoffModule.createController(Object.freeze({
  configuration:Object.freeze({
    providerId:'google-drive',claimWatchMs:SESSION_CLAIM_WATCH_MS,claimSyncRetryMs:SESSION_CLAIM_SYNC_RETRY_MS,
    claimSaveWarning:'The session moved to another device, but the latest local progress has not been verified in browser storage. Keep this tab open; saving will retry. Do not clear its data.'
  }),
  authority:Object.freeze({
    canMutate:()=>appCanMutate(),startupReady:()=>StartupLifecycle.status().fullyInitialized,
    visible:()=>document.visibilityState==='visible',online:()=>navigator.onLine!==false,
    hasTasks:()=>TASKS.length>0,panelElsewhere:()=>sessionPanelMode==='elsewhere'
  }),
  provider:Object.freeze({
    connected:id=>BackupProviderRuntime.connected(id),
    readHandoffSource:id=>BackupProviderRuntime.readSessionHandoffSource(id),
    claimOwnership:(id,request)=>BackupProviderRuntime.claimSessionOwnership(id,request),
    releaseClaim:(id,claim)=>BackupProviderRuntime.releaseSessionClaim(id,claim),
    readClaim:id=>BackupProviderRuntime.readSessionClaim(id),
    scheduleSync:(id,reason)=>BackupProviderRuntime.scheduleSharedSync(id,reason),
    suspendBackground:reason=>BackupProviderRuntime.suspendBackground(reason),
    wakeBackground:reason=>BackupProviderRuntime.wakeBackground(reason)
  }),
  session:Object.freeze({
    host:ActiveSessionRuntime,sanitize:value=>ActiveSessionCodec.sanitizeCurrent(value),
    same:(left,right)=>CanonicalModule.same(left,right),nextRevision:seed=>nextSessionRevision(seed),
    contentFingerprint:value=>activeSessionContentFingerprint(value),assetIds:value=>BackupCodec.assetIds(value)
  }),
  plan:Object.freeze({
    flushDraft:()=>PlanDraftEditor.flush(),settled:()=>PlanData.settled(),readDraft:()=>PlanData.readDraft(),
    readCanonicalDraft:async()=>{const value=await AppData.planData.read();return value.draft;},
    displayedDraft:()=>String(document.getElementById('plan-input')?.value||''),
    defaultScheduleText:()=>getActiveDefaults().scheduleText
  }),
  runtime:Object.freeze({
    markContentChanged:()=>markDayContentChanged(),
    captureEvidence:()=>captureRuntimeEvidence({includeActivePause:false,withCompletion:false,includeRecords:true}),
    stopExecution:()=>TimerEngine.stopExecution(),resumeExecution:options=>TimerEngine.resumeAfterPrimaryRestore(options),
  }),
  presentation:Object.freeze({
    capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level),
    setStatus:(message,ok)=>setPlanStatus(message,ok),
    warnStorage:SessionActions.warnStorage,
    clearStorageWarning:SessionActions.clearStorageWarning,
    notifyNewerClaim:SessionActions.notifyNewerClaim,
    noteBackupChange:reason=>notifyBackupChange({urgent:true,reason})
  }),
  installation:Object.freeze({id:()=>InstallationIdentity.getId()}),
  clock:Object.freeze({nowMs:DecisionClock.nowMs,nowIso:()=>new Date().toISOString()}),
  identity:Object.freeze({uuid:()=>crypto.randomUUID()})
}));
if(!Object.isFrozen(SessionHandoffRuntime)||SessionHandoffRuntime.format!=='study-director.session-handoff'||SessionHandoffRuntime.contractVersion!==1){
  throw new Error('Study Director session handoff runtime is unavailable or incompatible.');
}
// File/location controls, user entry points and foreground/background exclusion
// are owned by the checked P5.7A host boundary.
BackupActions=BackupActionsHostModule.createControls(Object.freeze({
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
function renderDriveBackup(){return BackupActions.renderDrive();}
function renderDeviceBackup(state){return BackupActions.renderDevice(state);}
BackupActions.install();
BackgroundMaintenance=BackupMaintenanceHostModule.createBackground(Object.freeze({
  lifecycle:OperationLifecycle,
  environment:Object.freeze({now:()=>Date.now(),setTimeout:(callback,delay)=>setTimeout(callback,delay),clearTimeout:handle=>clearTimeout(handle)}),
  authority:Object.freeze({
    canMutate:()=>appCanMutate(),fullyInitialized:()=>StartupLifecycle.status().fullyInitialized,
    storageResetUnresolved:()=>storageResetUnresolved(),unsupportedDataHeld:()=>UnsupportedData.held()
  }),
  foreground:Object.freeze({
    pwaReserved:()=>PwaRuntime.reservationActive(),mutation:AppMutationCoordinator,attachmentIngest:AttachmentIngest,
    exports:Exports,backupController:BackupController,providers:BackupProviderRuntime
  }),
  data:Object.freeze({maintenance:AppData.maintenance,notes:AppData.notes}),
  diagnostics:Object.freeze({
    capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level),
    start:(kind,label,details)=>BackupOperationDiagnostics.start(kind,label,details),
    mark:(kind,details,traceId)=>BackupOperationDiagnostics.mark(kind,details,traceId),
    finish:(details,traceId)=>BackupOperationDiagnostics.finish(details,traceId),
    fail:(error,details,traceId)=>BackupOperationDiagnostics.fail(error,details,traceId)
  }),
  backgroundOwners:()=>Object.freeze([
    Object.freeze(['attachments',Object.freeze({wake:trigger=>RichTextAssetMaintenance.wake(trigger)})]),
    Object.freeze(['attachment-integrity',Object.freeze({wake:trigger=>AttachmentIntegrityJob.wake(trigger,true)})]),
    Object.freeze(['temporary-files',BackupFiles]),
    Object.freeze(['device-folder',Object.freeze({wake:()=>DeviceBackup.wake()})]),
    Object.freeze(['backup-locations',Object.freeze({wake:trigger=>BackupProviderRuntime.wakeBackground(trigger)})])
  ]),
  scheduleAssetMaintenance:delay=>scheduleRichTextAssetMaintenance(delay),
  intervals:Object.freeze({
    maintenanceMs:DATA_MAINTENANCE_SCHEDULE_INTERVAL_MS,failureRetryMs:DATA_MAINTENANCE_FAILURE_RETRY_MS,
    assetCleanupDelayMs:ATTACHMENT_CLEANUP_AFTER_UPKEEP_MS,foregroundRecheckMs:15000
  })
}));
if(!Object.isFrozen(BackgroundMaintenance)||BackgroundMaintenance.format!=='study-director.background-maintenance-host'||BackgroundMaintenance.contractVersion!==1){
  throw new Error('Study Director background maintenance host is unavailable or incompatible.');
}
DataMaintenanceJob=BackgroundMaintenance.job;
const RepositoryMaintenanceHost=BackupMaintenanceHostModule.createRepositoryMaintenance(Object.freeze({
  meta:BackupAppMeta,metadataName:'repositoryMaintenancePending',
  diagnostics:Object.freeze({capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level)}),
  environment:Object.freeze({nowIso:()=>new Date().toISOString(),uuid:()=>crypto.randomUUID()})
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

const DeviceBackupHooks=BackupActionsHostModule.createDeviceHooks(Object.freeze({
  interactions:Object.freeze({choose:options=>Interactions.choose(options)}),capture:(scope,error)=>AppDiagnostics.capture(scope,error,'warn'),
  profileId:()=>Profiles.current()?.id||'',profileScope:()=>ProfileScope.scope,installationId:()=>InstallationIdentity.getId(),backupFolderName:()=>backupFolderName({device:true}),
  render:state=>renderDeviceBackup(state),sourceRevision:()=>BackupRuntimeHost.sourceRevision(),verifiedAt:()=>VerifiedRecovery.verified('device-folder')?.at||''
}));
// The Device Folder is one backup location of the engine. P5.7A owns the
// browser picker, provider callbacks and typed Device Folder storage composition.
DeviceBackup=BackupActionsHostModule.createDeviceBackup(Object.freeze({
  module:DeviceBackupModule,storageModule:DeviceFolderStorageModule,
  configuration:Object.freeze({metadataKey:APP_META_KEYS.deviceFolder,pickerId:EXTERNAL_REPOSITORY_IDENTITIES.deviceFolderPickerId,settingsTimeoutMs:10*1000}),
  engine:BackupProviderRuntime,
  environment:Object.freeze({
    backgroundBlocker:()=>backgroundBlocker(),canMutate:()=>appCanMutate(),clearTimeout:timer=>clearTimeout(timer),setTimeout:(callback,delay)=>setTimeout(callback,delay),
    showDirectoryPicker:typeof window.showDirectoryPicker==='function'?options=>window.showDirectoryPicker(options):undefined,
    withLock:work=>navigator.locks?.request?navigator.locks.request(ProfileScope.scoped('study-director-device-folder-prepare'),{mode:'exclusive'},()=>work()):Promise.resolve().then(work)
  }),
  hooks:DeviceBackupHooks,
  presentation:BackupPresentation,
  settings:exactAppMetaStorage(DeviceFolderAppMeta,'deviceFolder',APP_META_KEYS.deviceFolder,'Device Backup'),
  storage:Object.freeze({
    identities:Object.freeze({prefix:EXTERNAL_REPOSITORY_IDENTITIES.backupFolderPrefix,objects:EXTERNAL_REPOSITORY_IDENTITIES.deviceFolderObjects,checkpoints:EXTERNAL_REPOSITORY_IDENTITIES.deviceFolderCheckpoints,commits:EXTERNAL_REPOSITORY_IDENTITIES.deviceFolderCommits}),
    owner:()=>Object.freeze({profile:Profiles.current()?.id||'',scope:ProfileScope.scope,device:InstallationIdentity.getId()}),
    checksum:(blob,{signal}={})=>Exports.run('checksum',{value:blob},{signal}),
    inspectManifest:(file,options)=>RepositoryCheckpointPipeline.inspectManifest(file,options),
    environment:Object.freeze({canMutate:()=>appCanMutate(),now:()=>Date.now(),setTimeout:(callback,delay)=>setTimeout(callback,delay),clearTimeout:timer=>clearTimeout(timer),yieldTask:()=>BackgroundTasks.yieldTask({priority:'background'})}),
    limits:Object.freeze({publicationMaxAgeMs:RepositoryPolicyModule.protocol.publicationMaxAgeMs,publicationAssertionMarginMs:RepositoryPolicyModule.protocol.publicationAssertionMarginMs,publicationRenewMs:RepositoryPolicyModule.protocol.publicationRenewMs,publicationStaleMs:RepositoryPolicyModule.protocol.publicationStaleMs,maintenanceMaxAgeMs:RepositoryPolicyModule.protocol.maintenanceMaxAgeMs,maintenanceAssertionMarginMs:RepositoryPolicyModule.protocol.maintenanceAssertionMarginMs,responseTimeoutMs:10*1000})
  })
}));
if(!Object.isFrozen(DeviceBackup)||DeviceBackup.format!=='study-director.device-backup'||DeviceBackup.contractVersion!==1){
  throw new Error('Study Director automatic device backup is unavailable or incompatible.');
}
StorageResetRecovery=BackupRecoveryHostModule.createStorageReset(Object.freeze({
  authority:Object.freeze({canMutate:()=>appCanMutate()}),
  canonical:Object.freeze({
    dailyRecordsList:()=>AppData.dailyRecords.list({strict:true}),notesReadFreshPayload:()=>AppData.notes.readFreshPayload(),activeSessionLoad:()=>AppData.activeSession.load(0,{strict:true}),
    planDataRead:()=>AppData.planData.read(),attachmentsList:()=>AttachmentStorage.list(),pendingReviewsList:()=>AppData.pendingReviews.list(),
    savedDayDeletions:()=>AppData.deletionRecovery.savedDays(),noteDeletions:()=>AppData.deletionRecovery.notes()
  }),
  writeback:Object.freeze({
    installationKeep:()=>InstallationIdentity.keep(),notesRecover:()=>AppData.notes.recoverAfterStorageLoss(),planRewrite:()=>PlanData.rewriteAfterStorageReset(),
    settingsFlush:()=>{protectedPreferencesDirty=true;return flushProtectedPreferences();},hasTasks:()=>TASKS.length>0,
    writeLiveDraft:()=>writeLiveDraftNow({markChanged:false})
  }),
  provider:Object.freeze({
    history:(id,options)=>BackupProviderRuntime.history(id,options),
    restoreRepositoryProviderVersion:(id,options)=>BackupProviderRuntime.restoreRepositoryProviderVersion(id,options),
    bringInRepositoryProvider:(id,options)=>BackupProviderRuntime.bringInRepositoryProvider(id,options),
    syncRepositoryProvider:id=>BackupProviderRuntime.syncRepositoryProvider(id),
    list:()=>BackupProviderRuntime.list(),locationStatus:id=>BackupProviderRuntime.locationStatus(id),
    suspendBackground:reason=>BackupProviderRuntime.suspendBackground(reason),connected:id=>BackupProviderRuntime.connected(id)
  }),
  device:Object.freeze({
    status:()=>DeviceBackup.status(),connect:()=>DeviceBackup.connect(),install:()=>DeviceBackup.install(),refreshPermission:()=>DeviceBackup.refreshPermission(),
    rememberAfterStorageReset:()=>DeviceBackup.rememberAfterStorageReset()
  }),
  storage:Object.freeze({
    health:()=>readStorageHealth(),updateHealth:patch=>writeStorageHealth(patch),
    storedHealth:()=>AppData.local.getJson(STORAGE_KEYS.storageHealth,null),indexedDbLifecycle:()=>IndexedDb.lifecycle()
  }),
  presentation:Object.freeze({
    restoreChoices:()=>backupRestoreChoices(),openRestore:()=>openBackupRestore(),confirm:options=>Interactions.confirm(options),notify:options=>Interactions.notify(options),
    emit:event=>NoticeCoordinator.emit(event),resolve:(source,id)=>NoticeCoordinator.resolveEvent(source,id),subscribe:listener=>NoticeCoordinator.subscribe(listener)
  }),
  ownership:Object.freeze({announceStorageReset:detectedAt=>AppOwnership.announceStorageReset(detectedAt)}),
  mutation:Object.freeze({settled:()=>AppMutationCoordinator.settled()}),background:Object.freeze({wake:reason=>wakeBackgroundOperations(reason)}),
  session:Object.freeze({hasBlocking:()=>hasBlockingActiveSession(),suspend:()=>suspendTodaySession()}),
  view:Object.freeze({refreshAfterWriteback:()=>{refreshNoteConsumers();renderSched();}}),readiness:Object.freeze({reconcileStartupChangeClock:()=>VerifiedRecovery.reconcileStartupChangeClock()}),
  diagnostics:Object.freeze({capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level)}),
  environment:Object.freeze({now:()=>Date.now(),nowIso:()=>new Date().toISOString(),setTimeout:(callback,delay)=>setTimeout(callback,delay),clearTimeout:handle=>clearTimeout(handle)})
}));
if(!Object.isFrozen(StorageResetRecovery)||StorageResetRecovery.format!=='study-director.storage-reset-recovery'||StorageResetRecovery.contractVersion!==1){
  throw new Error('Study Director storage-reset recovery is unavailable or incompatible.');
}
BackupRecoveryHost=BackupRecoveryHostModule.createHost(Object.freeze({
  presentation:BackupPresentation,
  cancellation:Object.freeze({cancelImport:(reason,options)=>BackupController.cancelImport(reason,options)}),
  diagnostics:Object.freeze({capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level),mark:(phase,details)=>BackupOperationDiagnostics.mark(phase,details)}),
  document,
  interactions:Object.freeze({choose:options=>Interactions.choose(options)}),
  lifecycle:Object.freeze({
    activeSessionIssue:loaded=>BackupRecoveryHostModule.activeSessionIssue(loaded),activeSessionLoad:()=>AppData.activeSession.load(0,{strict:true}),activeSessionSettled:()=>AppData.activeSession.settled(),
    attachmentBusy:()=>imagePreparationCount>0||AttachmentIngest.status().busy,canonicalPlanDraft:async()=>(await AppData.planData.read()).draft,deletionRecoveryFlush:()=>AppData.deletionRecovery.flush(),
    flushNotes:()=>AppData.notes.flush({strict:true}),flushPlanDraft:()=>PlanDraftEditor.flush(),hasTasks:()=>TASKS.length>0,noteFailure:()=>AppData.notes.failure(),
    planDraft:()=>PlanData.readDraft(),planInputValue:()=>PlanDraftEditor.authoredText(),quiesce:operation=>ManagedRecoveryQuiescence.run(operation),
    savePlanDraft:options=>PlanDraftEditor.save(options),settleAttachmentWriters:options=>settleAttachmentWriters(options),settlePlan:()=>PlanData.settled(),writeLiveDraft:()=>writeLiveDraftNow({markChanged:false,allowDuringRecoveryQuiescence:true})
  }),
  managedRecovery:Object.freeze({createCoordinator:input=>ManagedRecoveryModule.createCoordinator(input)}),
  mutation:Object.freeze({run:(kind,operation)=>AppMutationCoordinator.runExclusive(kind,operation)}),
  providers:Object.freeze({
    bringInRepositoryProvider:(id,options)=>BackupProviderRuntime.bringInRepositoryProvider(id,options),cancelForeground:(reason,id)=>BackupProviderRuntime.cancelForeground(reason,id),
    configureManagedRecovery:config=>BackupProviderRuntime.configureManagedRecovery(config),configurePendingBackupRetry:config=>BackupProviderRuntime.configurePendingBackupRetry(config),
    history:(id,options)=>BackupProviderRuntime.history(id,options),list:()=>BackupProviderRuntime.list(),noteVersions:(id,noteId,options)=>BackupProviderRuntime.noteVersions(id,noteId,options),removeRepositoryProviderVersion:(id,checkpointId)=>BackupProviderRuntime.removeRepositoryProviderVersion(id,checkpointId),
    restoreRepositoryProviderVersion:(id,options)=>BackupProviderRuntime.restoreRepositoryProviderVersion(id,options),suspendBackground:(reason,options)=>BackupProviderRuntime.suspendBackground(reason,options)
  }),
  session:Object.freeze({hasBlocking:()=>hasBlockingActiveSession()}),
  sourceRevision:()=>BackupRuntimeHost.sourceRevision(),
  storage:Object.freeze({
    read:()=>BackupAppMeta.read('managedProviderBackupPending'),
    write:value=>BackupAppMeta.write('managedProviderBackupPending',value,{strict:true}),
    remove:()=>BackupAppMeta.remove('managedProviderBackupPending','',{strict:true})
  }),
  view:Object.freeze({
    deviceName:(id,others)=>deviceName(id,others),invalidateAttachments:()=>invalidateAttachmentLibrary(),refreshCore:()=>{renderSched();refreshCoreUi({header:true});},refreshNotes:()=>refreshPnote(),refreshReview:()=>ReviewView.refresh(),
    renderLibrary:()=>LibraryView.render(),setStatus
  })
}));
if(!Object.isFrozen(BackupRecoveryHost)||BackupRecoveryHost.format!=='study-director.backup-recovery-host'||BackupRecoveryHost.contractVersion!==1){
  throw new Error('Study Director backup-recovery host is unavailable or incompatible.');
}

const RepositoryIntegrityContinuation=IntegrityContinuationModule.create({files:BackupFiles,processing:Exports,protection:BackupProtection,yieldTask:()=>BackgroundTasks.yieldTask({priority:'background'})});
BackupIntegrity=BackupIntegrityHostModule.createController(Object.freeze({
  lifecycle:OperationLifecycle,metadata:Object.freeze({attachment:HostAppMeta,repository:BackupAppMeta}),attachmentMetadataName:'attachmentIntegrityAudit',repositoryMetadataName:'repositoryIntegrityScrub',
  storage:AttachmentStorage,references:AttachmentReferences,validAttachmentId:AttachmentsModule.validId,
  data:Object.freeze({datasetRevision:()=>AppData.dailyRecords.datasetRevision()}),referenceRevision:()=>richAssetReferenceRevision,
  authority:Object.freeze({canMutate:()=>appCanMutate()}),
  background:Object.freeze({upkeepBlocker:()=>upkeepBlocker(),backgroundBlocker:()=>backgroundBlocker(),foregroundBusy:()=>backgroundMaintenanceForegroundBusy()}),
  backgroundTasks:Object.freeze({budget:()=>BackgroundTasks.budget(),yieldTask:options=>BackgroundTasks.yieldTask(options)}),
  provider:BackupProviderRuntime,continuation:RepositoryIntegrityContinuation,normalizeContinuation:value=>IntegrityContinuationModule.normalize(value),
  unsafe:Object.freeze({mutation:()=>!!AppMutationCoordinator.status()?.active,attachmentIngest:()=>!!AttachmentIngest.status()?.busy}),
  storageHealth:Object.freeze({markError:(source,message,options)=>markStorageHealthError(source,message,options),markOk:source=>markStorageHealthOk(source)}),
  invalidateAttachmentLibrary:()=>invalidateAttachmentLibrary(),
  diagnostics:Object.freeze({
    capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level),
    start:(kind,label,details)=>BackupOperationDiagnostics.start(kind,label,details),
    mark:(kind,details,traceId)=>BackupOperationDiagnostics.mark(kind,details,traceId),
    finish:(details,traceId)=>BackupOperationDiagnostics.finish(details,traceId),
    fail:(error,details,traceId)=>BackupOperationDiagnostics.fail(error,details,traceId)
  }),
  document,environment:Object.freeze({now:()=>Date.now(),nowIso:()=>new Date().toISOString(),uuid:()=>crypto.randomUUID(),setTimeout:(callback,delay)=>setTimeout(callback,delay),clearTimeout:handle=>clearTimeout(handle)}),
  limits:Object.freeze({attachmentIntervalMs:24*60*60*1000,attachmentRetryMs:10*60*1000,repositoryBatchObjects:4,repositoryBatchBytes:256*1024*1024})
}));
if(!Object.isFrozen(BackupIntegrity)||BackupIntegrity.format!=='study-director.backup-integrity-host'||BackupIntegrity.contractVersion!==1){
  throw new Error('Study Director backup integrity host is unavailable or incompatible.');
}
AttachmentIntegrityJob=BackupIntegrity.attachmentJob;
BackupProviderRuntime.configureIntegrityScrub(BackupIntegrity.repositoryHooks);

const DeviceBackupActivation=BackupActionsHostModule.createDeviceActivation(Object.freeze({
  device:()=>DeviceBackup,
  refreshKinds:new Set([APP_ACTIVATION_KINDS.OWNERSHIP_TAKEOVER,APP_ACTIVATION_KINDS.ORDINARY_FOCUS,APP_ACTIVATION_KINDS.VISIBILITY_RETURN])
}));
AppActivation.subscribe(event=>{
  if([APP_ACTIVATION_KINDS.ORDINARY_FOCUS,APP_ACTIVATION_KINDS.VISIBILITY_RETURN,APP_ACTIVATION_KINDS.OWNERSHIP_TAKEOVER,APP_ACTIVATION_KINDS.DATE_ROLLOVER].includes(event.kind)&&wakeBackgroundOperations('activation')&&Date.now()-CapabilityStorage.lastCheckedAt()>=STORAGE_ESTIMATE_REFRESH_MS)void inspectStorageCapability().catch(error=>AppDiagnostics.capture('storage.estimate-refresh',error,'warn'));
  void DeviceBackupActivation.handle(event.kind).catch(error=>AppDiagnostics.capture('device-backup.permission-refresh',error,'warn'));
});
// A location backs up on its own once this device has backed up to it (the
// Device Folder from when it was chosen). A change found on start is backed up
// only while local data is present.
const AutomaticBackupPolicy=BackupReadinessHostModule.createAutomaticBackupPolicy(Object.freeze({verified:VerifiedRecovery,currentRevision:()=>BackupRuntimeHost.sourceRevision(),canonicalEmpty:()=>StorageResetRecovery.canonicalEmpty()}));
BackupProviderRuntime.configureAutomaticBackup(AutomaticBackupPolicy);
BackupProviderRuntime.configureSessionOwnership(Object.freeze({
  installationId:()=>InstallationIdentity.getId(),
  today:()=>todayISO(),
  read:async()=>{const loaded=await AppData.activeSession.load(0,{strict:true});if(!loaded||loaded.ok!==true||loaded.error)throw loaded?.error||new Error('Active Session ownership could not be read safely.');const value=loaded.value;return value?Object.freeze({date:value.date,runningOn:value.runningOn,revision:value.revision}):null;}
}));
/* PWA SHELL AND SAFE UPDATE COORDINATION */
const PwaRuntime=PwaUpdateHostModule.createController(Object.freeze({
  configuration:Object.freeze({
    assetId:'__SD_PAGE_ASSET_ID__',buildId:'@@SD_BUILD_ID@@',reloadSessionKey:SESSION_STORAGE_KEYS.pwaReload,scope:'./',workerUrl:trustedAssetURL('./sw.js'),
    updateCheckStorageKey:STORAGE_KEYS.pwaUpdateCheck,primaryState:OWNERSHIP_STATES.PRIMARY,secondaryState:OWNERSHIP_STATES.SECONDARY,runningTimerMode:TIMER_MODES.RUNNING
  }),
  lifecycle:Object.freeze({
    module:PwaLifecycleModule,
    environment:Object.freeze({AbortController,MessageChannel:typeof MessageChannel==='function'?MessageChannel:null,clearTimeout:timer=>clearTimeout(timer),document,navigator,setTimeout:(callback,delay)=>setTimeout(callback,delay),window})
  }),
  environment:Object.freeze({document,window,navigator,setTimeout:(callback,delay)=>setTimeout(callback,delay),clearTimeout:timer=>clearTimeout(timer),now:()=>Date.now()}),
  state:Object.freeze({
    startupReady:()=>StartupLifecycle.status().fullyInitialized,ownership:()=>AppOwnership.status(),sessionLifecycle:()=>SessionLifecycle.status(),mutation:()=>AppMutationCoordinator.status(),reviewSave:()=>ReviewSaveService.status(),
    imagePreparationCount:()=>imagePreparationCount,attachmentLibraryBusy:()=>AttachmentLibrary.status().busy,attachmentIngestBusy:()=>AttachmentIngest.status().busy,exportsBusy:()=>Exports.status().busy,
    backupBusy:()=>BackupController.status().busy,providerBusy:()=>BackupProviderRuntime.status().busy,
    providerBackgroundBackupActive:()=>BackupProviderRuntime.list().some(row=>BackupProviderRuntime.locationStatus(row.id)?.backingUp===true),
    providerDriveBackingUp:()=>BackupProviderRuntime.locationStatus('google-drive')?.backingUp===true,
    liveTimer:()=>isLiveTrackableTimer(),timerPaused:()=>TimerState.paused,timerMode:()=>TimerState.mode,pacerRunning:()=>PracticePacer.status().running,canMutate:()=>appCanMutate(),
    blockingUiOpen:()=>!!document.querySelector('dialog[open],[data-rich-asset-picker="active"]'),workRevision:()=>pwaWorkRevision,tasks:()=>TASKS,
    isTrackableTask:task=>isTrackableBlock(task),isTaskResolved:index=>isTaskResolved(index),currentTaskIndex:()=>TimerState.currentIndex
  }),
  reservation:Object.freeze({
    settleMutation:()=>AppMutationCoordinator.settled(),suspendProvider:()=>BackupProviderRuntime.suspendBackground('pwa-update'),settleRichTextAssets:()=>RichTextAssetMaintenance.settled(),settleMaintenance:()=>AppData.maintenance.settled(),
    settleAttachmentIntegrity:()=>AttachmentIntegrityJob.settled(),quiesceRichText:run=>RichTextRuntime.quiesce(run),
    runExclusive:(name,run)=>AppMutationCoordinator.runExclusive(name,run),runManagedRecovery:run=>ManagedRecoveryQuiescence.run(run),
    projectOwnership:()=>OwnershipUiProjection.apply(),foregroundChanged:()=>foregroundChanged()
  }),
  persistence:Object.freeze({
    settleDiary:()=>LibraryView.settleDiary(),flushPlanDraft:()=>PlanDraftEditor.flush(),planAuthoredText:()=>PlanDraftEditor.authoredText(),planReadDraft:()=>PlanData.readDraft(),
    savePlanDraft:()=>PlanDraftEditor.save(),settlePlanData:()=>PlanData.settled(),readStoredPlan:()=>AppData.planData.read(),
    flushPendingReview:()=>flushPendingReviewSave({strict:true,allowDuringRecoveryQuiescence:true}),settleReviewEditor:()=>ReviewEditor.settled(),
    writeLiveDraft:allowDuringRecoveryQuiescence=>writeLiveDraftNow({markChanged:false,allowDuringRecoveryQuiescence}),flushNotes:()=>AppData.notes.flush(),noteFailure:()=>AppData.notes.failure(),
    flushDeletionRecovery:()=>AppData.deletionRecovery.flush(),settleActiveSession:()=>AppData.activeSession.settled(),loadActiveSession:()=>AppData.activeSession.load(),
    activeSessionIssue:loaded=>BackupRecoveryHostModule.activeSessionIssue(loaded)
  }),
  effects:Object.freeze({
    automaticBackupsWaiting:()=>automaticBackupsWaiting(),flushAutomaticBackups:reason=>flushAutomaticBackups(reason),pauseTimer:()=>togglePause(),togglePacer:()=>PracticePacer.toggle(),scheduleSyncStatus:()=>scheduleSyncStatus(),
    publishNotice:value=>NoticeCoordinator.publish('update',value),capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level),
    localGet:(key,fallback)=>AppData.local.getText(key,fallback),localSet:(key,value)=>AppData.local.setText(key,value)
  })
}));
const PwaLifecycle=PwaRuntime.lifecycle;
const schedulePwaUpdateEvaluation=delay=>PwaRuntime.scheduleEvaluation(delay);
const schedulePwaUpdateCheck=delay=>PwaRuntime.scheduleCheck(delay);
const clearPwaUpdateCheckTimer=()=>PwaRuntime.clearCheckTimer();
const applyPwaUpdateFromUi=()=>PwaRuntime.applyFromUi();
/* INSIGHTS AND PLUGIN BOUNDARY */
// Read-only Insights boundary. Insights modules should read through this object
// and return derived metrics without mutating records, notes, timer state, or storage.
const InsightsBoundary=InsightsHostModule.createBoundary(Object.freeze({
  dailyRecords:AppData.dailyRecords,
  dailyRecordCodec:DailyRecordCodec,
  notifications:NoticeCoordinator.presentation('insights'),
  logic:Object.freeze({classifyTaskOutcome,summarizePracticeRuns:summarizePracticeRunsForInsights}),
  requestProviderTab:tab=>PluginRuntime.requestTab(tab),
  capture:(scope,error)=>AppDiagnostics.capture(scope,error),
  todayISO:()=>todayISO(),
  clampText
}));
const PreviewRuntime=InsightsBoundary.preview;
const AppInsights=InsightsBoundary.appInsights;
const InsightsDeviceState=InsightsHostModule.createDeviceState(Object.freeze({
  readWindow:fallback=>AppData.local.getText(STORAGE_KEYS.insightsWindow,fallback),
  writeWindow:value=>AppData.local.setText(STORAGE_KEYS.insightsWindow,value)
}));
/* DOM BINDINGS AND STARTUP */
function currentBackupDiagnosticStates(){
  const states=[],sample=(job,read,project)=>{try{states.push(...project(read()));}catch{states.push({job,state:'unavailable',reason:'state-unavailable'});}};
  sample('Local storage health',()=>StorageHealthController.snapshot(),health=>{
    const rows=[{job:'Local storage health',state:health.hasIssues?'attention':'observed',issues:health.issues?.length||0,completedAt:health.lastLocalSaveAt||'',studyDataSavedAt:health.lastStudyDataSaveAt||'',storagePersisted:CapabilityStorage.snapshot().persisted,usageBytes:CapabilityStorage.snapshot().usageBytes,quotaBytes:CapabilityStorage.snapshot().quotaBytes}];
    const sources=['indexedDB','localStorage.read','localStorage.write','planDraft.write','activeSession','notes','dailyRecords','deletionRecovery','maintenance','capacity','backup','attachmentIntegrity','repositoryIntegrity'];
    for(const source of sources){const issue=health.issues?.find(row=>row.source===source);if(issue)rows.push({job:'Storage '+source,state:'attention',severity:issue.level,failedAt:issue.at});}return rows;
  });
  sample('Note saving',()=>AppData.notes.failure(),value=>[{job:'Note saving',state:value.failed?'failed':'observed',failed:value.failed===true}]);
  sample('Write ownership',()=>({primary:appCanMutate(),...AppMutationCoordinator.status()}),value=>[{job:'Write ownership',state:value.active?'running':value.recoveryFault?'blocked':value.primary?'primary':'secondary',busy:!!value.active,pending:!!value.recoveryFault,foreign:value.foreign,authorityHealthy:value.authorityHealthy,authorityDurableProtected:value.authorityDurableProtected}]);
  sample('Backup controller',()=>BackupController.status(),value=>[{job:'Backup controller',...OperationLifecycle.snapshot(value),importActive:value.importActive,importCancelled:value.importCancelled,exportActive:value.standaloneExportActive}]);
  sample('Device backup',()=>DeviceBackup.status(),value=>[{job:'Device backup',...OperationLifecycle.snapshot({busy:value.busy||value.backingUp,pending:value.pending,nextEligibleAt:value.nextEligibleAt}),connected:value.connected,permission:value.permission,stalePermissionResponses:value.stalePermissionResponses,retryAttempt:value.retryAttempt,retryBackoffCapped:value.retryBackoffCapped,completedAt:value.lastBackupAt||''}]);
  sample('Provider operation',()=>BackupProviderRuntime.status(),value=>[{job:'Provider operation',...OperationLifecycle.snapshot(value)}]);
  sample('Provider connection',()=>BackupProviderRuntime.diagnosticConnections(),values=>values.map(value=>({job:value.id==='google-drive'?'Google Drive connection':'External provider connection',state:value.connected?'connected':'disconnected',connected:value.connected,scopeBound:value.scopeBound,retryAttempt:value.retryAttempt,retryBackoffCapped:value.retryBackoffCapped})));
  sample('Backup encryption',()=>BackupProtection.status(),value=>[{job:'Backup encryption',state:value.enabled?value.unlocked?'unlocked':'locked':'off',enabled:value.enabled,unlocked:value.unlocked}]);
  sample('Canonical maintenance',()=>({...DataMaintenanceJob.status(),busy:DataMaintenanceJob.status().busy||AppData.maintenance.status().busy}),value=>[{job:'Canonical maintenance',...value,...OperationLifecycle.snapshot(value),lastOutcome:value.lastOutcome}]);
  for(const [job,owner] of [['Attachment cleanup',RichTextAssetMaintenance],['Backup scratch cleanup',BackupFiles],['Attachment processor',AttachmentIngest],['File processor',Exports]])sample(job,()=>owner.status(),value=>[{job,...(job.endsWith('processor')?OperationLifecycle.snapshot(value):value)}]);
  sample('App update',()=>PwaLifecycle.status(),pwa=>{const update=PwaRuntime.diagnostics();return [{job:'App update',state:pwa.phase,busy:pwa.applying||pwa.reloading||pwa.checking,pending:pwa.updateReady,scheduled:update.nextCheckAt>0,nextEligibleAt:update.nextCheckAt?new Date(update.nextCheckAt).toISOString():'',completedAt:update.lastSuccessfulCheckAt?new Date(update.lastSuccessfulCheckAt).toISOString():'',retryAttempt:update.failureCount,bootState:pwa.bootState,cacheState:pwa.cacheState||'',reason:pwa.cacheReason||''}];});
  states.push(...(BackupIntegrity?.diagnosticRows()||[]));
  // Sync with Drive and the profiles on this device: what to read first when
  // a device does not sync.
  sample('Drive sync',()=>BackupProviderRuntime.diagnosticSync(),values=>values.map(value=>({job:'Drive sync',state:!value.connected?'disconnected':value.catchingUp?'running':value.needsPassword?'locked':value.needsUpdate||UnsupportedData.held()?'blocked':value.needsReview?'attention':value.behind?'pending':value.syncedAt?'current':'unknown',completedAt:value.syncedAt,attemptedAt:value.checkedAt,nextEligibleAt:value.nextEligibleAt,signInEndsAt:value.signInEndsAt,needsReview:value.needsReview,needsUpdate:value.needsUpdate,needsPassword:value.needsPassword,behind:value.behind,catchingUp:value.catchingUp,turnWaits:value.turnWaits,...(value.waitingFor||value.waitingSince?{waitingFor:PersistenceModule.deviceName(value.waitingFor)||'another device',waitingSince:value.waitingSince,waitingRenewedAt:value.waitingRenewedAt}:{}),keptVersions:KeptVersions.count()})));
  sample('Profiles',()=>({count:Profiles.list().length,pending:Profiles.removalPending(),unsupported:Profiles.unsupported()}),value=>[{job:'Profiles',state:value.unsupported?'unsupported':value.pending?'pending':'observed',profiles:value.count,removalPending:value.pending>0}]);
  sample('Unsupported data',()=>UnsupportedData.summary(),value=>[{job:'Unsupported data',state:value.blocked?'blocked':value.protected?'held':value.held?'replaceable':'none',held:value.held,protectedCount:value.protected,savedDays:value.items.days,notes:value.items.notes,assets:value.items.attachments,sessions:value.items.sessions,settings:value.items.settings}]);
  sample('Provider background',()=>BackupProviderRuntime.backgroundStatus(),values=>values);return states;
}
// Why a version was kept, for diagnostics: the kind of difference, not its content.
function keptReviewCause(review){
  const kept=review.kept;
  if(review.subject==='note')return !kept?'note-deletion':typeof kept.text==='string'&&typeof kept.label==='string'?'note-text-title':typeof kept.text==='string'?'note-text':'note-title';
  if(review.subject==='savedDay')return kept?'saved-day':'saved-day-deletion';
  if(review.subject==='session')return kept?'session':'session-absent';
  return 'settings';
}
// Read current storage and recovery summaries for on-demand diagnostics.
async function readDataDiagnosticStates(){
  const samples=[
    // Which storage this page opened. It tells a browser wipe (no profile
    // list, one new database) from the app opening an empty profile while
    // another database on this site still holds the data. Counts, not names.
    {job:'Profile storage',read:async()=>{
      const base=DATA_CONTRACT.storage.dbName,ours=name=>name===base||name.startsWith(base+ProfileScope.separator);
      const names=typeof indexedDB?.databases==='function'?(await indexedDB.databases()).map(row=>String(row?.name||'')).filter(ours):null;
      return {names,listed:!!Profiles.current(),listPresent:LocalStorageContract.getText(ProfileScope.registryKey,null)!==null,fresh:IndexedDb.lifecycle().startedFresh===true,clearedAt:String(readStorageHealth().browserDataClearedAt||'')};
    },project:value=>({job:'Profile storage',state:value.names?'observed':'partial',scoped:!!ProfileScope.scope,profileListPresent:value.listPresent,pageProfileListed:value.listed,startedFresh:value.fresh,...(value.clearedAt?{dataClearedAt:value.clearedAt}:{}),
      ...(value.names?{databases:value.names.length,otherDatabases:value.names.filter(name=>name!==DB_NAME).length}:{})})},
    // Each version kept for review, newest first: what it is, why it was kept
    // and which device's copy it came from (type and browser), never its
    // content or which note or day it is.
    {job:'Kept versions',read:()=>AppData.pendingReviews.list(),project:list=>{
      const open=list.filter(review=>!review.resolvedAt).sort((a,b)=>b.keptAt.localeCompare(a.keptAt));
      return [{job:'Kept versions',state:open.length?'pending':'none',count:open.length},...open.slice(0,12).map(review=>({job:'Kept version',state:'pending',subject:review.subject,cause:keptReviewCause(review),
        device:!review.keptFrom?'not recorded':review.keptFrom===InstallationIdentity.getId()?'this device':PersistenceModule.deviceName(review.keptFrom)||'another device',keptAt:review.keptAt,...(review.keptChangedAt?{changedAt:review.keptChangedAt}:{})}))];
    }},
    {job:'Canonical maintenance record',read:()=>AppData.metadata.diagnostics(),project:value=>({job:'Canonical maintenance record',state:value.maintenanceStatus,pending:value.maintenanceStatus==='pending',completedAt:value.completedAt,queuedDeletions:value.deletions,localRecovery:value.localRecovery})},
    ...[['Restore journal',AppData.restoreJournal],['Library clear journal',AppData.libraryClearJournal]].map(([job,owner])=>({job,read:()=>owner.diagnostics(),project:value=>({job,state:value?'pending':'absent',pending:!!value,phase:value?.phase||'',updatedAt:value?.updatedAt||'',coverage:'journal-header'})})),
    {job:'Repository cleanup intent',read:()=>BackupAppMeta.read('repositoryMaintenancePending'),project:value=>[{job:'Repository cleanup intent',state:value?.entries?.length?'pending':'absent',pending:!!value?.entries?.length,count:value?.entries?.length||0},...(value?.entries||[]).filter(entry=>['device-folder','google-drive'].includes(entry.providerId)).map(entry=>({job:entry.providerId==='device-folder'?'Device cleanup intent':'Drive cleanup intent',state:'pending',pending:true,reason:entry.reason,nextEligibleAt:entry.nextEligibleAt,scopeBound:!!entry.repositoryScope}))]},
    {job:'External backup pending',read:()=>BackupAppMeta.read('managedProviderBackupPending'),project:value=>({job:'External backup pending',state:value?.entries?.length?'pending':'absent',pending:!!value?.entries?.length,count:value?.entries?.length||0})},
    {job:'Verified external copies',read:()=>BackupAppMeta.read('verifiedRecoveryBackups'),project:value=>{const entries=[value?.file,...Object.values(value?.providers||{})].filter(Boolean);return {job:'Verified external copies',state:entries.length?'recorded':'never',count:entries.length,completedAt:entries.map(entry=>entry.at||'').filter(value=>Number.isFinite(Date.parse(value))).sort().at(-1)||'',coverage:'recorded-verification'};}}
  ],results=new Map();
  const reads=samples.map(sample=>Promise.resolve().then(sample.read).then(value=>results.set(sample.job,sample.project(value))).catch(()=>results.set(sample.job,{job:sample.job,state:'unavailable',reason:'state-unavailable'})));
  try{await OperationLifecycle.waitForSettlement(reads,{timeoutMs:3000,timeoutCode:'DIAGNOSTIC_SNAPSHOT_TIMEOUT',timeoutMessage:'Diagnostic snapshot could not finish.'});}catch{}
  return samples.flatMap(sample=>results.get(sample.job)||{job:sample.job,state:'unavailable',reason:'diagnostic-deadline'});
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
const CLICK_ACTIONS=Object.freeze({
  'recheck-device-integrity':()=>requestRepositoryIntegrityRecheck('device-folder'),
  'recheck-drive-integrity':()=>requestRepositoryIntegrityRecheck('google-drive'),
  'apply-pwa-update': applyPwaUpdateFromUi,
  'protect-local-data': protectLocalData,
  'install-notice-action': ()=>runInstallationAction({dismissNotice:true}),
  'check-unsupported-update': ()=>void checkUnsupportedUpdate(),
  'dismiss-install-notice': ()=>CapabilityInstallation.dismissInstallNotice(),
  'toggle-system-alerts': ()=>SystemNotifications.toggle(),
  'connect-device-backup': ()=>BackupActions.connectDevice(),
  'backup-now': ()=>BackupActions.backUpEverywhere(),
  'cancel-device-backup': ()=>BackupActions.cancelDevice(),
  'toggle-backup-settings': ev=>BackupActions.toggleSettings(ev.target.closest('[data-backup-settings]')?.dataset.backupSettings),
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
  'toggle-pause': togglePause,
  'practice-mode': ev=>PracticePacer.setSetupMode(ev.target.closest('[data-practice-mode]')?.dataset.practiceMode),
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
  'practice-finish': finishPracticePacer,
  'mark-done': markDone,
  'skip-task': skipTask,
  'jump-scheduled-now': recoveryJumpToScheduledNow,
  'start-scheduled-full': recoveryStartScheduledFull,
  'start-remaining-window': recoveryStartRemainingWindow,
  'shift-remaining-day': recoveryShiftRemainingDay,
  'generate-carry-forward': recoveryGenerateCarryForward,
  'copy-carry-forward': copyCarryForward,
  'close-unfinished-note': closeUnfinishedNotePanel,
  'save-day': saveDayRecord,
  'copy-review': copyReview,
  'toggle-copy-report-menu': toggleCopyReportMenu,
  'reset-copy-report': resetCopyReportSelection,
  'render-library': LibraryView.render,
  'open-library-day': ev=>LibraryView.openDay(ev.target.closest('[data-library-date]')?.dataset.libraryDate),
  'export-backup': ()=>BackupActions.exportLocal(),
  'clear-library': LibraryView.clearAll,
  'backup-protection': ()=>BackupActions.manageProtection(),
  'copy-backup-diagnostics': ()=>copyBackupDiagnostics(),
  'cancel-standalone-import': ()=>BackupActions.cancelStandalone(),
  'pick-import-file': ()=>BackupActions.pickImportFile(),
  'test-sound': ()=>NoticeCoordinator.testSound(),
  'test-system-alert': ()=>SystemNotifications.test(),
  'toggle-pomodoro': Pomodoro.configuration.toggleNudges,
  'restore-session': SessionActions.restoreSessionAction,
  'suspend-session': suspendTodaySession,
  'finish-session': finishTodaySession,
  'reset-session': resetTodaySession,
  'edit-plan': PlanDraftEditor.enter,
  'confirm-plan-edit': ()=>uploadSoonAfterPlanApply(PlanDraftEditor.confirm()),
  'cancel-plan-edit': PlanDraftEditor.cancel,
  'load-default': loadDefaultPlan,
  'apply-schedule': SessionActions.applyScheduleAction,
  'clear-schedule-draft': PlanDraftEditor.clear,
  'open-notes': openNotesLibrary,
  'toggle-pnote-info': togglePnoteInfo,
  'toggle-backup-info': ev=>toggleBackupInfo(ev),
  'load-more-library': LibraryView.loadMore,
  'close-nudge': ()=>Pomodoro.stop({dismiss:true,audio:false}),
  'take-pomodoro-break': ()=>{
    const request=Pomodoro.acceptedBreak({dismissIfMissing:true,activeSec:currentTimerActiveSeconds()});
    return request?beginTimerPause('pomodoro',request):false;
  },
  'gap-focus': ()=>classifyInactiveGap('focus'),
  'gap-break': ()=>classifyInactiveGap('break'),
  'gap-split': showInactiveGapSplit,
  'gap-ignore': ()=>classifyInactiveGap('ignore'),
  'gap-apply': applyInactiveGapSplit,
  'dismiss-storage-warning': dismissStorageWarning,
  'sync-status-action': syncStatusAction,
  // Hiding the card leaves the work running; the indicator still shows it.
  'close-drive-connect': ()=>endDriveConnectCard(),
  'recent-action': ev=>NotificationRecent.run(ev),
  'recent-more': ()=>NotificationRecent.toggle(),
  'rename-profile': startProfileRename,
  'clear-recent': ()=>NotificationRecent.clear(),
  'review-kept-versions': ()=>KeptVersions.review(),
  'open-profile': openProfilePanel,
  'close-profile': closeProfilePanel,
  'profile-drive': profileDriveAction,
  'switch-profile': switchProfile,
  'add-profile': addProfile,
  'delete-profile': deleteThisProfile,
  'first-start-drive': ()=>FirstStart.connect(),
  'first-start-continue': ()=>FirstStart.finish(),
  'first-start-skip': ()=>FirstStart.skip(),
  'font-smaller': ()=>stepFontScale(-1),
  'font-reset': ()=>setFontScale(1),
  'font-larger': ()=>stepFontScale(1),
  'set-theme': handleThemeSelection,
  'set-presentation': handlePresentationSelection,
  'toggle-display-tools': toggleDisplayTools,
  'toggle-fullscreen': toggleFS
});
const CHANGE_ACTIONS=Object.freeze({
  'render-library': ()=>LibraryView.render(),
  'import-backup': ev=>BackupActions.importLocal(ev),
  'change-reflection-date': ()=>requireReviewSavedDayRuntime().selectReviewDate(),
  'sound-mode': handleSoundModeChange,
  'keep-screen-awake': ev=>CapabilityInstallation.setKeepAwake(ev.target.checked)
});
const INPUT_ACTIONS=Object.freeze({
  'first-start-password': ()=>FirstStart.confirmField(),
  'pnote-progress': onPnoteChange,
  'save-reflection': event=>queueReviewSave({event}),
  'quote': onQuoteChange,
  'schedule-draft': PlanDraftEditor.composerInput,
  'render-library': LibraryView.requestRender,
  'unfinished-note': ()=>{syncUnfinishedNoteDraft();ReviewView.sync();},
  'practice-setup': ()=>PracticePacer.previewSetup()
});
const BLUR_ACTIONS=Object.freeze({
  'profile-name': finishProfileRename,
  'save-reflection': ()=>{void flushPendingReviewSave().catch(error=>AppDiagnostics.capture('review.blur-flush',error,'warn'));}
});
const KEYDOWN_ACTIONS=Object.freeze({
  'profile-name': handleProfileNameKey,
  'first-start': e=>FirstStart.key(e),
  'gap-split': handleInactiveGapSplitKey,
  'practice-start': handlePracticeStartKey
});
const OWNER_REQUIRED_CLICK_ACTIONS=new Set([
  'toggle-pause','practice-mode','practice-total-toggle','practice-cue-toggle','practice-start','practice-next','practice-undo','practice-reset','practice-reset-confirm','practice-delete-run','practice-toggle','practice-finish','mark-done','skip-task',
  'jump-scheduled-now','start-scheduled-full','start-remaining-window','shift-remaining-day',
  'generate-carry-forward','close-unfinished-note','save-day','clear-library','pick-import-file',
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
const ACTIVE_SESSION_BLOCKED_IDS=new Set([]);
const ACTIVE_SESSION_DISABLED_REASON='Suspend or reset today’s active session to restore a backup or clear Library data.';
const BlockedActionHint=(()=>{
  let popover=null,target=null,controller=null,installed=false;
  const blockedTarget=eventTarget=>eventTarget instanceof Element?eventTarget.closest('[data-ownership-ui-reason="active-session"]'):null;
  const clearTarget=()=>{if(target?.getAttribute('aria-describedby')==='ownership-blocked-popover')target.removeAttribute('aria-describedby');target=null;};
  const hide=(element=null)=>{if(element&&target!==element)return;controller?.hide();clearTarget();};
  const ensure=()=>{
    if(popover)return;
    popover=document.createElement('div');popover.id='ownership-blocked-popover';popover.className='ownership-blocked-popover';popover.setAttribute('role','tooltip');document.body.append(popover);
    controller=RichTextApi.createAnchoredPopover(popover,{align:'center',manual:true,onClose:clearTarget});
  };
  const showFor=element=>{if(!element||element.dataset.ownershipUiReason!=='active-session')return false;ensure();if(target!==element)hide();target=element;popover.textContent=ACTIVE_SESSION_DISABLED_REASON;element.setAttribute('aria-describedby','ownership-blocked-popover');controller.show(element);return true;};
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
  const TRANSITIONAL_STATES=new Set([
    OWNERSHIP_STATES.RESOLVING,OWNERSHIP_STATES.ACQUIRING,
    OWNERSHIP_STATES.HYDRATING,OWNERSHIP_STATES.RELEASING
  ]);
  const ACTION_BINDINGS=Object.freeze([
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
  const BLOCKED_EVENT_TYPES=Object.freeze(['beforeinput','input','change','paste','cut','drop','dragstart']);
  const baselines=new WeakMap();
  let current=Object.freeze({
    format:'study-director.ownership-ui-snapshot',contractVersion:1,
    state:OWNERSHIP_STATES.SECONDARY,canMutate:false,activeSessionBlocked:false,transitional:false,revision:0,
    reason:'Ownership has not been established yet.'
  });
  let observer=null;
  let applyQueued=false;

  function reasonFor(state){
    if(state===OWNERSHIP_STATES.PRIMARY)return 'This tab has control.';
    if(state===OWNERSHIP_STATES.HYDRATING)return 'Reloading canonical data before this tab becomes writable.';
    if(state===OWNERSHIP_STATES.ACQUIRING)return 'Acquiring exclusive control.';
    if(state===OWNERSHIP_STATES.RESOLVING)return 'Checking which tab has control.';
    if(state===OWNERSHIP_STATES.RELEASING)return 'Saving and transferring control.';
    if(state===OWNERSHIP_STATES.FAULTED)return 'Ownership could not be established safely.';
    return 'Another tab has control.';
  }
  function createSnapshot(){
    const status=AppOwnership.status();
    const transitional=TRANSITIONAL_STATES.has(status.state);
    const mutationBlocked=PwaRuntime.reservationActive()||!!(AppMutationCoordinator&&AppMutationCoordinator.blocksUi());
    return Object.freeze({
      format:'study-director.ownership-ui-snapshot',contractVersion:1,
      state:status.state,
      canMutate:!mutationBlocked&&!transitional&&status.state===OWNERSHIP_STATES.PRIMARY&&appCanMutate(),
      activeSessionBlocked:hasBlockingActiveSession(),
      transitional:transitional||mutationBlocked,
      revision:Math.max(0,Number(status.revision)||0),
      reason:mutationBlocked?'A protected data operation is in progress.':reasonFor(status.state)
    });
  }
  function candidateElements(root=document){
    const found=new Set();
    const elementRoot=root&&root.nodeType===1?root:null;
    const queryRoot=root&&typeof root.querySelectorAll==='function'?root:document;
    const addBoundElement=element=>{
      ACTION_BINDINGS.forEach(binding=>{
        if(binding.actions.has(element.getAttribute(binding.attribute)||''))found.add(element);
      });
    };
    if(elementRoot)addBoundElement(elementRoot);
    queryRoot.querySelectorAll('[data-action],[data-change],[data-input],[data-blur],[data-keydown]').forEach(addBoundElement);
    DIRECT_SELECTORS.forEach(selector=>{
      if(elementRoot&&elementRoot.matches(selector))found.add(elementRoot);
      queryRoot.querySelectorAll(selector).forEach(element=>found.add(element));
    });
    queryRoot.querySelectorAll('.si.draft[draggable]').forEach(element=>found.add(element));
    return [...found];
  }
  function captureBaseline(element){
    if(baselines.has(element))return baselines.get(element);
    const baseline=Object.freeze({
      disabled:'disabled' in element?!!element.disabled:null,
      readOnly:'readOnly' in element?!!element.readOnly:null,
      draggable:element.getAttribute('draggable'),
      ariaDisabled:element.getAttribute('aria-disabled'),
      ariaReadonly:element.getAttribute('aria-readonly')
    });
    baselines.set(element,baseline);
    return baseline;
  }
  function restoreAttribute(element,name,value){
    if(value===null){if(element.hasAttribute(name))element.removeAttribute(name);}
    else if(element.getAttribute(name)!==value)element.setAttribute(name,value);
  }
  function releaseElement(element){
    const baseline=baselines.get(element);
    if(baseline){
      if(baseline.disabled!==null&&element.disabled!==baseline.disabled)element.disabled=baseline.disabled;
      if(baseline.readOnly!==null&&element.readOnly!==baseline.readOnly)element.readOnly=baseline.readOnly;
      restoreAttribute(element,'draggable',baseline.draggable);
      restoreAttribute(element,'aria-disabled',baseline.ariaDisabled);
      restoreAttribute(element,'aria-readonly',baseline.ariaReadonly);
      baselines.delete(element);
    }
    BlockedActionHint.hide(element);
    if(element.dataset.ownershipUi!==undefined)delete element.dataset.ownershipUi;
    if(element.dataset.ownershipUiReason!==undefined)delete element.dataset.ownershipUiReason;
  }
  function projectionMode(element){
    if(element.matches('.si.draft[draggable]'))return 'drag';
    if(element.matches('textarea,input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="range"])'))return 'readonly';
    if(element.matches('button,select,input,[aria-pressed]'))return 'disabled';
    return 'action';
  }
  function blockElement(element,reason='ownership'){
    captureBaseline(element);
    const mode=projectionMode(element);
    element.dataset.ownershipUiReason=reason;
    if(element.dataset.ownershipUi!==mode)element.dataset.ownershipUi=mode;
    if(mode==='readonly'){
      if(!element.readOnly)element.readOnly=true;
      if(element.getAttribute('aria-readonly')!=='true')element.setAttribute('aria-readonly','true');
      return;
    }
    if(mode==='disabled'){
      if(!element.disabled)element.disabled=true;
      if(element.getAttribute('aria-disabled')!=='true')element.setAttribute('aria-disabled','true');
      return;
    }
    if(mode==='drag'&&element.draggable)element.draggable=false;
    if(element.getAttribute('aria-disabled')!=='true')element.setAttribute('aria-disabled','true');
  }
  function blockedByActiveSession(element){
    if(!current.activeSessionBlocked)return false;
    if(ACTIVE_SESSION_BLOCKED_IDS.has(element.id))return true;
    if(ACTIVE_SESSION_BLOCKED_CLICK_ACTIONS.has(element.getAttribute('data-action')||''))return true;
    return ACTIVE_SESSION_BLOCKED_CHANGE_ACTIONS.has(element.getAttribute('data-change')||'');
  }
  function apply(root=document){
    const previousCanMutate=current.canMutate;
    current=createSnapshot();
    const page=document.documentElement;
    const mutable=current.canMutate?'1':'0',revision=String(current.revision);
    if(page.dataset.studyDirectorUiMutable!==mutable)page.dataset.studyDirectorUiMutable=mutable;
    if(page.dataset.studyDirectorUiState!==current.state)page.dataset.studyDirectorUiState=current.state;
    if(page.dataset.studyDirectorUiRevision!==revision)page.dataset.studyDirectorUiRevision=revision;
    candidateElements(root).forEach(element=>{
      if(!current.canMutate){blockElement(element,'ownership');return;}
      if(blockedByActiveSession(element)){blockElement(element,'active-session');return;}
      releaseElement(element);
    });
    if(previousCanMutate!==current.canMutate){queueMicrotask(()=>richTextSyncAll());if(current.canMutate){schedulePwaUpdateCheck(250);schedulePwaUpdateEvaluation(250);}else clearPwaUpdateCheckTimer();}
    return current;
  }
  function queueApply(){
    if(applyQueued)return;
    applyQueued=true;
    Promise.resolve().then(()=>{applyQueued=false;apply();});
  }
  function mutationNeedsProjection(mutation){
    if(mutation.type==='attributes')return !!mutation.target?.dataset?.ownershipUi;
    return [...mutation.addedNodes].some(node=>node&&node.nodeType===1);
  }
  function guardEvent(event){
    const target=event.target&&event.target.closest&&event.target.closest('[data-ownership-ui]');
    if(!target)return;
    const activeSessionReason=target.dataset.ownershipUiReason==='active-session';
    if(current.canMutate&&!activeSessionReason)return;
    const mode=target.dataset.ownershipUi;
    if(event.type==='click'&&mode!=='action')return;
    if(event.type!=='click'&&!BLOCKED_EVENT_TYPES.includes(event.type))return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if(event.type==='click'&&!activeSessionReason)AppOwnership.requirePrimary('use this control');
  }
  function install(){
    if(observer)return false;
    BLOCKED_EVENT_TYPES.forEach(type=>document.addEventListener(type,guardEvent,true));
    document.addEventListener('click',guardEvent,true);
    observer=new MutationObserver(mutations=>{if(mutations.some(mutationNeedsProjection))queueApply();});
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled','readonly','aria-disabled','aria-readonly','draggable']});
    apply();
    return true;
  }
  function snapshot(){return current;}
  return Object.freeze({format:'study-director.ownership-ui-projection',contractVersion:1,apply,install,snapshot});
})();
refreshSessionSafetyUi=()=>OwnershipUiProjection.apply();
const {actionNeedsAppControl,handleDelegatedClick,handleDelegatedChange,handleDelegatedInput,handleDelegatedBlur,handleDelegatedKeydown}=FoundationHostModule.createDelegated({document,goTab,setStudyQuality,requirePrimaryTab,CLICK_ACTIONS,CHANGE_ACTIONS,INPUT_ACTIONS,BLUR_ACTIONS,KEYDOWN_ACTIONS,
  OWNER_REQUIRED_CLICK_ACTIONS,OWNER_REQUIRED_CHANGE_ACTIONS,OWNER_REQUIRED_INPUT_ACTIONS,OWNER_REQUIRED_BLUR_ACTIONS,OWNER_REQUIRED_KEYDOWN_ACTIONS,
  editedTextarea:()=>{richAssetReferenceRevision++;captureMutationGeneration++;},UiTabRegistry,Pomodoro});

const NoteSyncPopover=(()=>{
  let popover=null,target=null,controller=null,installed=false;
  const clearTarget=()=>{if(target?.getAttribute('aria-describedby')==='note-sync-popover')target.removeAttribute('aria-describedby');target=null;};
  const hide=(element=null)=>{if(element&&target!==element)return;controller?.hide();clearTarget();};
  const show=element=>{
    if(!(element instanceof HTMLElement))return;
    const message=String(element.getAttribute('aria-label')||'').trim();
    if(!message){hide();return;}
    if(!popover){
      popover=document.createElement('div');popover.id='note-sync-popover';popover.className='note-sync-popover';popover.setAttribute('role','tooltip');
      controller=RichTextApi.createAnchoredPopover(popover,{align:'end',manual:true,onClose:clearTarget});
    }
    if(target!==element){hide();const parent=element.closest('.workspace-overlay-rich-text')||document.body;parent.append(popover);popover.inert=false;}
    target=element;popover.textContent=message;element.setAttribute('aria-describedby','note-sync-popover');controller.show(element);
  };
  const refresh=element=>{if(target===element)show(element);};
  const install=()=>{
    if(installed)return;installed=true;
    document.addEventListener('pointerover',event=>{const element=event.target instanceof Element?event.target.closest('.note-sync'):null;if(!element)return;const previous=event.relatedTarget;if(previous instanceof Node&&element.contains(previous))return;show(element);},true);
    document.addEventListener('pointerout',event=>{const element=event.target instanceof Element?event.target.closest('.note-sync'):null;if(!element)return;const next=event.relatedTarget;if(!(next instanceof Node)||!element.contains(next))hide(element);},true);
    document.addEventListener('focusin',event=>{const element=event.target instanceof Element?event.target.closest('.note-sync'):null;if(element)show(element);},true);
    document.addEventListener('focusout',event=>{const element=event.target instanceof Element?event.target.closest('.note-sync'):null;if(!element)return;const next=event.relatedTarget;if(!(next instanceof Node)||!element.contains(next))hide(element);},true);
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
  document.documentElement.dataset.studyDirectorBound='1';
  installProfileDialogs();
  const liveLimits={
    'profile-name-input':APP_LIMITS.maxStudentNameChars,'first-start-name':APP_LIMITS.maxStudentNameChars,
    'quote-input':APP_LIMITS.maxQuoteChars,'plan-input':APP_LIMITS.maxScheduleChars,
    'daily-reflection':APP_LIMITS.maxReflectionChars,'recovery-carry':APP_LIMITS.maxCarryForwardChars,
    'library-search':APP_LIMITS.maxSearchChars,'library-notes-search':APP_LIMITS.maxSearchChars,
    'pn-extra':APP_LIMITS.maxNoteChars
  };
  Object.entries(liveLimits).forEach(([id,max])=>{const field=document.getElementById(id);if(field)field.maxLength=max;});
  installDelegatedEventBindings();
  NoteSyncPopover.install();
  AttachmentLibrary.install();
  void installAttachmentIntegrityAudit();
  void VerifiedRecovery.install().catch(error=>AppDiagnostics.capture('backup.freshness-startup',error,'warn'));
  OwnershipUiProjection.install();
  BlockedActionHint.install();
  RichTextRuntime.install();
  SystemNotifications.install();AppAudio.install();renderSoundSettings();
  NativeCapabilities.install();
  void BackupProtection.refresh().catch(setBackupProtectionSurfaceError);
  BackupProviderRuntime.subscribeStatus(renderDriveBackup);renderDriveBackup();
  // A check starting or stopping updates Verification as it happens.
  BackupProviderRuntime.subscribeStatus(renderIntegrityStatuses);
  BackupProviderRuntime.subscribeStatus(storageResetConnectionsChanged);
  // P5.8B owns status subscriptions, network/visibility refresh and Drive wake-up.
  SyncStatusHost.install();
  NoticeCoordinator.subscribeRecent(NotificationRecent.changed);
  void ensureDeviceBackupInstalled().then(()=>installRepositoryIntegrityScrub()).catch(error=>AppDiagnostics.capture('backup.repository-integrity-install',error,'warn'));
  updateFullscreenButton();
  PlanDraftEditor.install();
  UiTabRegistry.updateOrientation();
  NavigationController.install();
  if(window.matchMedia){
    const navMedia=window.matchMedia(NAV_HORIZONTAL_MEDIA_QUERY);
    if(typeof navMedia.addEventListener==='function')navMedia.addEventListener('change',UiTabRegistry.updateOrientation);
  }

  const pn=document.getElementById('pn-extra');
  if(pn)pn.addEventListener('input',event=>{
    if(!appCanMutate())return;
    commitTaskNoteEditor(pn,pn.value,event);
  });
  const dd=document.getElementById('day-date');
  if(dd){dd.value=todayISO();dd.dataset.autoDate='1';}
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
  return NavigationController.hydrate({source:'launch-route',explicitOnly:true}).then(result=>result.ok===true);
}
StartupLifecycle=StartupHostModule.createCoordinator(Object.freeze({
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
    installBackground:installBackgroundOwners,scheduleMaintenance:scheduleDataMaintenance,wakeBackground:reason=>wakeBackgroundOperations(reason),installSessionWatch,refreshKeptVersions:()=>KeptVersions.refresh(),announceUnsupported:()=>UnsupportedData.announce(),renderUnsupported:renderUnsupportedData,
    collectProfiles:()=>Profiles.collect(),askProfilePassword,collectFiles:()=>BackupFiles.collect(),preloadInsights:InsightsPreload.schedule,confirmBoot:()=>PwaLifecycle.confirmBoot(),offerDeviceRecovery:()=>offerDeviceRecoveryIfLocalEmpty({reason:'startup'}),
    reportUnsupported:()=>UnsupportedData.reportBlocked(),setPlanStatus,noticeCanCompact,getReviewDate,reconcileLifecycle:(...args)=>SessionLifecycle.reconcile(...args)
  })
}));
/* PUBLIC PLUGIN API */
PluginRuntime.registerPlaceholders();
const StudyDirectorPublicAPI=PluginRuntime.createPublicApi(Object.freeze({
  version:APP_VERSION,
  data:Object.freeze({contract:DATA_CONTRACT,deviceState:InsightsDeviceState}),
  insights:AppInsights,
  logic:InsightsBoundary.logic,
  plan:Object.freeze({getDraft:getPlanDraftText,loadDraft:loadScheduleIntoDraft}),
  preview:InsightsBoundary.publicPreview,
  backup:Object.freeze({
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
    profile:Object.freeze({id:()=>Profiles.current()?.id||'',name:()=>backupFolderName(),bind:info=>bindDriveLibrary(info),deleted:info=>driveProfileDeleted(info),controls:control=>ProfileDeletion.setLibraryControl(control)}),
    providers:Object.freeze({register:BackupProviderRuntime.register,list:BackupProviderRuntime.list})
  }),
  installation:Object.freeze({
    status:NativeCapabilities.status,promptInstall:NativeCapabilities.promptInstall,inspectInstallation:NativeCapabilities.inspectInstallation,revealInstallHelp:NativeCapabilities.revealInstallHelp
  }),
  appearance:Object.freeze({
    theme:Object.freeze({defaultId:DEFAULT_THEME_ID,supported:PUBLIC_THEME_METADATA,get:PRESENTATION_KERNEL.activeThemeId,set:setTheme}),
    presentation:Object.freeze({
      defaultId:DEFAULT_PRESENTATION_ID,invariants:PRESENTATION_INVARIANTS,breakpoints:PRESENTATION_BREAKPOINTS,tokens:PRESENTATION_TOKEN_CONTRACT,manifest:PRESENTATION_MANIFEST,
      list:PRESENTATION_KERNEL.listPresentations,register:registerPresentationPack,get:PRESENTATION_KERNEL.activePresentationId,set:setPresentation
    })
  }),
  ui:Object.freeze({registerTab:UiTabRegistry.registerTab,goTab,navigationStatus:()=>NavigationController.status(),workspaceHistory:WorkspaceHistoryPublic})
}));
HOST_WINDOW.StudyDirector=StudyDirectorPublicAPI;
window.dispatchEvent(new CustomEvent(STUDY_DIRECTOR_READY_EVENT,{detail:Object.freeze({version:StudyDirectorPublicAPI.version,theme:PRESENTATION_KERNEL.activeThemeId(),presentation:PRESENTATION_KERNEL.activePresentationId()})}));
SessionLifecycle.invalidate('app-restart',{date:todayISO(),autoDate:true,reconcile:false});
StartupLifecycle.start();
void PwaRuntime.install();
})();
