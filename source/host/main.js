
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
const INTERNAL_MODULES=window[Symbol.for('studyDirector.internalModules.v1')];
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
const AudioEngineModule=INTERNAL_MODULES.load('audio-engine',1,'study-director.audio-engine-module',1);
const NoticeCoordinatorModule=INTERNAL_MODULES.load('notice-coordinator',1,'study-director.notice-coordinator-module',1);
const NavigationModule=INTERNAL_MODULES.load('navigation',1,'study-director.navigation-module',1);
const FoundationHostModule=INTERNAL_MODULES.load('foundation-host',1,'study-director.foundation-host-module',1);
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
const BackupRecoveryHostModule=INTERNAL_MODULES.load('backup-recovery-host',1,'study-director.backup-recovery-host-module',1);
const PwaLifecycleModule=INTERNAL_MODULES.load('pwa-lifecycle',1,'study-director.pwa-lifecycle-module',1);
const NativeCapabilitiesModule=INTERNAL_MODULES.load('native-capabilities',1,'study-director.native-capabilities-module',1);
const CapabilitiesHostModule=INTERNAL_MODULES.load('capabilities-host',1,'study-director.capabilities-host-module',1);
const PlanHostModule=INTERNAL_MODULES.load('plan-host',1,'study-director.plan-host-module',1);
const PlanModule=INTERNAL_MODULES.load('plan',1,'study-director.plan-module',1);
const StartupLifecycleModule=INTERNAL_MODULES.load('startup-lifecycle',1,'study-director.startup-lifecycle',1);
const StartupHostModule=INTERNAL_MODULES.load('startup-host',1,'study-director.startup-host-module',1);
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
const PRESENTATION_KERNEL=window[Symbol.for('studyDirector.presentationKernel.v1')];
const PRESENTATION_MANIFEST=PRESENTATION_KERNEL&&PRESENTATION_KERNEL.manifest;
if(!PRESENTATION_KERNEL||PRESENTATION_KERNEL.format!=='study-director.presentation-kernel'||PRESENTATION_KERNEL.version!==1||!PRESENTATION_MANIFEST||PRESENTATION_MANIFEST.format!=='study-director.presentation-manifest'||PRESENTATION_MANIFEST.version!==1){
  throw new Error('Study Director presentation kernel is unavailable or incompatible.');
}
const DEFAULT_THEME_ID=PRESENTATION_MANIFEST.defaults.theme;
const DEFAULT_PRESENTATION_ID=PRESENTATION_MANIFEST.defaults.preferredPresentation;
const {
  presentations:PRESENTATION_PROFILES, themes:THEME_DEFINITIONS
}=PRESENTATION_MANIFEST;
const THEME_IDS=Object.freeze(Object.keys(THEME_DEFINITIONS));
const PUBLIC_THEME_METADATA=Object.freeze(THEME_IDS.map(id=>THEME_DEFINITIONS[id]));
const {
  invariants:PRESENTATION_INVARIANTS, breakpoints:PRESENTATION_BREAKPOINTS, tokens:PRESENTATION_TOKEN_CONTRACT
}=PRESENTATION_MANIFEST;
const NOTES_SEARCH_WORKER_URL='@@SD_SEARCH_WORKER_FILENAME@@';
const RICH_TEXT_BOOT_API=window.StudyDirectorRichText;
if(!RICH_TEXT_BOOT_API||!RICH_TEXT_BOOT_API.assetPolicy||typeof RICH_TEXT_BOOT_API.isAssetId!=='function'||typeof RICH_TEXT_BOOT_API.isSupportedImageType!=='function'){throw new Error('Study Director rich text runtime is unavailable or incompatible.');}
const ProfileScopeBootstrap=window[Symbol.for('studyDirector.profileScope.v1')];
const {
  APP_VERSION,APP_CONFIG,APP_LIMITS,ProfileScope,DEVICE_WIDE_STORAGE_KEYS,STORAGE_KEYS,SESSION_STORAGE_KEYS,APP_META_KEYS,EXTERNAL_REPOSITORY_IDENTITIES,APP_META_REGISTRY,
  DATA_CONTRACT,DB_STORES,DB_NAME,DB_VER,DB_DAILY_RECORD_STORE,DB_DAILY_SUMMARY_STORE,DB_NOTES_STORE,DB_ACTIVE_SESSION_STORE,DB_APP_META_STORE,DB_ASSET_STORE,
  ACTIVE_SESSION_ID,ENTITY_DEFINITIONS,BACKUP_ENTITY_TYPES,FACTORY_DEFAULTS,entityDefinition,entityIdentity
}=DataBootstrapHostModule.createConfiguration(Object.freeze({
  release:'@@SD_RELEASE@@',
  profileScope:ProfileScopeBootstrap,
  raw:Object.freeze({
    productionLimits:@@SD_PRODUCTION_LIMITS@@,
    deviceWideStorageKeys:@@SD_DEVICE_WIDE_LOCAL_STORAGE_KEYS@@,
    localStorageKeys:@@SD_LOCAL_STORAGE_KEYS@@,
    sessionStorageKeys:@@SD_SESSION_STORAGE_KEYS@@,
    appMetaKeys:@@SD_APP_META_KEYS@@,
    externalRepositoryIdentities:@@SD_EXTERNAL_REPOSITORY_IDENTITIES@@,
    appMetaRegistry:@@SD_APP_META_REGISTRY@@,
    runtimeDataContract:@@SD_RUNTIME_DATA_CONTRACT@@,
    indexedDbStoreNames:@@SD_INDEXED_DB_STORE_NAMES@@
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
let storageResetHold=null,storageResetHandling=null,storageResetSince=0,storageResetAcknowledged=0;
let NativeCapabilities=null,CapabilityBadge=null;
let DeviceBackup=null,BackupRecoveryHost=null;
const BackgroundTasks=NativeCapabilitiesModule.createTaskScheduler(window);
const LocalStorageContract=PersistenceModule.createLocalStorage(Object.freeze({
  onError:(operation,error)=>StorageHealthController?.observeLocalStorage(operation,error),
  onOk:operation=>StorageHealthController?.observeLocalStorage(operation,null)
}));
function createStorageHealthController(local){
  const sourceLabels=Object.freeze({
    'indexedDB':'Browser database','localStorage.read':'Browser storage read','localStorage.write':'Browser storage write',
    'planDraft.write':'Plan draft','activeSession':'Live-session recovery','notes':'Notes',
    'dailyRecords':'Library records','deletionRecovery':'Deletion recovery',
    'maintenance':'Data maintenance','capacity':'Storage capacity','backup':'Backup','attachmentIntegrity':'Attachment storage','repositoryIntegrity':'Backup verification'
  });
  const issueMap=new Map();
  let active=false,mirroring=false;
  const stored=local.getJson(STORAGE_KEYS.storageHealth,null);
  let history=Object.assign(emptyStorageHealth(),stored&&typeof stored==='object'?stored:{},{version:3});
  const initialReadError=local.lastError;
  if(initialReadError){
    issueMap.set('localStorage.read',Object.freeze({
      source:'localStorage.read',label:sourceLabels['localStorage.read'],
      message:`Browser storage could not be read: ${initialReadError.message||initialReadError}. Changes may not restore after reload.`,
      level:'error',at:new Date().toISOString()
    }));
  }
  function notify(){if(active)refreshStorageFallbackWarning();}
  function normalizeSource(value){return String(value||'storage').slice(0,80);}
  function normalizeMessage(value){return clampText(String(value||'Storage is unavailable.'),APP_LIMITS.maxStatusMessageChars);}
  function issue(source,message,options={}){
    const key=normalizeSource(source),at=new Date().toISOString();
    const entry=Object.freeze({
      source:key,label:sourceLabels[key]||'Storage',message:normalizeMessage(message),
      level:options&&options.level==='warn'?'warn':'error',at
    });
    // Issues are shown live and never stored: they describe this session.
    issueMap.set(key,entry);
    // When the database fails, browser storage is the safety net: rewriting
    // this record shows at once whether it can still be written.
    if(key==='indexedDB'&&(!options||options.mirror!==false))mirror();
    notify();
    return snapshot();
  }
  function recover(source,patch=null,options={}){
    const key=normalizeSource(source);
    const recovered=issueMap.delete(key);
    const hasPatch=!!(patch&&typeof patch==='object'&&Object.keys(patch).length);
    if(!recovered&&!hasPatch)return snapshot();
    if(hasPatch){history=Object.assign({},history,patch,{version:3});if(!options||options.mirror!==false)mirror();}
    notify();
    return snapshot();
  }
  // Each tab mirrors its own copy of this record. An unresolved browser-data
  // clear is kept as stored unless this tab set or resolved it itself.
  let clearMarkerOwned=false;
  function updateHistory(patch){
    const marker=!!patch&&typeof patch==='object'&&Object.hasOwn(patch,'browserDataClearedAt');
    history=Object.assign({},history,patch&&typeof patch==='object'?patch:{},{version:3});
    mirror({marker});if(marker)clearMarkerOwned=!!history.browserDataClearedAt;
    notify();return snapshot();
  }
  function observeLocalStorage(operation,error){
    const kind=operation==='write'?'write':'read';
    const source=`localStorage.${kind}`;
    if(error){
      const action=kind==='write'?'written':'read';
      issue(source,`Browser storage could not be ${action}: ${error.message||error}. Changes may not survive a reload.`,{mirror:false});
    }else if(issueMap.has(source))recover(source,null,{mirror:false});
  }
  // Save times only move forward: another tab may have stored a later one
  // than this tab holds, and writing back an older copy would hide that save.
  function laterTime(own,other){
    const ownAt=Date.parse(String(own||'')),otherAt=Date.parse(String(other||''));
    return Number.isFinite(otherAt)&&(!Number.isFinite(ownAt)||otherAt>ownAt)?other:own??null;
  }
  function mirror({marker=false}={}){
    if(mirroring)return false;
    mirroring=true;
    try{
      const stored=local.getJson(STORAGE_KEYS.storageHealth,null),known=stored&&typeof stored==='object'?stored:{};
      history=Object.assign({},history,{lastLocalSaveAt:laterTime(history.lastLocalSaveAt,known.lastLocalSaveAt),lastStudyDataSaveAt:laterTime(history.lastStudyDataSaveAt,known.lastStudyDataSaveAt)});
      if(!clearMarkerOwned&&!marker)history=Object.assign({},history,{browserDataClearedAt:known.browserDataClearedAt||null});
      return local.setJson(STORAGE_KEYS.storageHealth,history);
    }
    finally{mirroring=false;}
  }
  function snapshot(){
    const issues=Object.freeze([...issueMap.values()].sort((a,b)=>a.at.localeCompare(b.at)));
    return Object.freeze({...history,issues,hasIssues:issues.length>0});
  }
  function activate(){active=true;notify();return snapshot();}
  return Object.freeze({activate,issue,recover,updateHistory,observeLocalStorage,snapshot});
}
StorageHealthController=createStorageHealthController(LocalStorageContract);
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
  names:Object.freeze({database:DATA_CONTRACT.storage.dbName,directories:Object.freeze(['@@SD_ATTACHMENT_OPFS_DIRECTORY@@','@@SD_BACKUP_FILES_OPFS_DIRECTORY@@']),keys:Object.freeze(Object.entries(@@SD_LOCAL_STORAGE_KEYS@@).filter(([name])=>!DEVICE_WIDE_STORAGE_KEYS.includes(name)).map(([,key])=>key))}),
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
const BackupPresentation=BackupPresentationModule.createPresentation(Object.freeze({notifications:NoticeCoordinator,timeLabel:storageHealthTime,synced:()=>BackupProviderRuntime.syncing()===true,verified:source=>verifiedRecoveryState.providers[source]||null,action:(source,kind)=>Object.freeze({label:kind==='permission'?(source==='device-folder'?'Allow access':'Reconnect'):kind==='sync-review'?'Review':kind==='sync-password'?'Enter password':kind==='sync-newer'?'Check for update':'Show details',opens:true,run:()=>showBackupPresentation(source,kind)})}));
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
// The profile indicator's state (renderSyncStatus); declared early because
// storage health asks for a redraw during start-up.
let backupNudgeMessage='',driveConnecting=false,syncStatusTimer=null,syncStatusRing='',syncStatusSettle=null,sessionHandoff={step:'',error:''},sessionMovingHere=null,driveConnectCard=null,driveConnectCardHide=null,sessionYieldedAt=0;
let backupNudgeCheckedAt=0;
let backupNudgeNotifiedDate='';
let managedRecoverySessionQuiescenceDepth=0,managedRecoveryTimerFrozenSinceMs=null;
let refreshSessionSafetyUi=()=>{};
function restoreSessionPersistenceSuppressed(){return !!ActiveSessionRuntime?.persistenceSuppressed();}
function managedRecoverySessionQuiesced(){return managedRecoverySessionQuiescenceDepth>0;}
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
const BACKUP_NUDGE_MS=7*24*60*60*1000;
const BACKUP_NUDGE_CHECK_MS=60*60*1000;
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
let pwaUpdateReservation=null;
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
function notifyBackupChange(change){
  try{BackupProviderRuntime?.noteChange(Object.freeze({urgent:change?.urgent===true,reason:String(change?.reason||'change')}));return true;}
  catch(error){AppDiagnostics.capture('backup.change-provider',error,'warn');return false;}
}
// Changes still waiting for an automatic backup go out at once when the app
// goes to the background (a phone may close it there) and before an update.
function flushAutomaticBackups(reason){
  try{return Promise.allSettled([BackupProviderRuntime.flushAutomatic(reason)]);}
  catch(error){AppDiagnostics.capture('backup.flush-provider',error,'warn');return Promise.resolve([]);}
}
function automaticBackupsWaiting(){try{return BackupProviderRuntime.automaticWaiting();}catch{return false;}}
// Hidden: back up waiting changes. Visible again: redraw the locations, since a
// sign-in may have ended while timers were throttled.
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(appCanMutate())void flushAutomaticBackups('app-hidden');}else BackupProviderRuntime.refresh();});
// An update waits up to a minute for waiting automatic backups to finish. A
// backup that is still running after that keeps the update postponed until it
// is done; one that failed does not hold the update back.
const PWA_UPDATE_BACKUP_WAIT_MS=60*1000;
async function backUpBeforeUpdate(){
  if(!automaticBackupsWaiting())return;
  pwaAutomaticBlockMessage='Backing up before the update…';renderPwaUpdateStatus(PwaLifecycle.status());
  let timer=null;
  try{await Promise.race([flushAutomaticBackups('app-update'),new Promise(resolve=>{timer=setTimeout(resolve,PWA_UPDATE_BACKUP_WAIT_MS);})]);}
  finally{clearTimeout(timer);}
}
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

function emptyStorageHealth(){
  // lastLocalSaveAt: the change clock's fast copy for backup decisions.
  // lastStudyDataSaveAt: when study data (notes, Saved Days, sessions, plans,
  // kept versions; not settings alone) was last saved in this browser.
  // browserDataClearedAt: a browser-data clear still being resolved.
  return {version:3,lastLocalSaveAt:null,lastStudyDataSaveAt:null,browserDataClearedAt:null};
}
function readStorageHealth(){
  return StorageHealthController.snapshot();
}
function writeStorageHealth(patch){
  return StorageHealthController.updateHistory(patch);
}
function localISODate(dateLike){
  const d=new Date(dateLike);
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const day=String(d.getDate()).padStart(2,'0');
  return y+'-'+m+'-'+day;
}
function storageHealthTime(iso){
  if(!iso)return 'never';
  const d=new Date(iso);
  if(isNaN(d.getTime()))return 'unknown';
  const now=new Date();
  const localIso=localISODate(d);
  const today=localISODate(now);
  if(localIso===today)return timeLabelFromIso(iso)||'today';
  return d.toLocaleDateString('en-IN',{day:'2-digit',month:'short'});
}
function storageHealthClass(health){
  if(health.issues.some(issue=>issue.level==='error'))return 'err';
  if(health.issues.some(issue=>issue.level==='warn'))return 'warn';
  return 'ok';
}
function renderStorageHealth(health=readStorageHealth()){
  scheduleSyncStatus();
  const el=document.getElementById('storage-health');
  const lastSaved=document.getElementById('last-local-save');
  if(lastSaved){lastSaved.textContent=health.lastLocalSaveAt?storageHealthTime(health.lastLocalSaveAt):'Never';lastSaved.title=health.lastLocalSaveAt||'';}
  if(el){
    el.hidden=!health.issues.length;
    el.textContent=health.issues.map(issue=>`${issue.label}: ${String(issue.message).slice(0,180)}`).join(' · ');
    el.className='storage-health ui-surface ui-status '+storageHealthClass(health);
  }
  if(NativeCapabilities)renderNativeCapabilities(NativeCapabilities.status());
}


function publishSafetyNotice(message,title='Unsaved work needs attention',id='safety'){
  const text=String(message||'').trim();
  return NoticeCoordinator.publish(String(id||'safety'),{visible:!!text,kind:'safety',title,message:text||'Resolved.',compact:noticeCanCompact(text)});
}
// Native capability presentation is owned by the checked capabilities-host adapter.
// The portable-file row, drawn like the location rows: Export and Cancel from
// the backup controller and file processor, the note from the 'file'
// presentation. It draws once both exist; their status changes redraw it.
let fileBackupRowReady=false;
function renderFileBackup(){
  if(!fileBackupRowReady)return;
  const state=BackupController.status(),exporting=state.standaloneExportActive,node=id=>document.getElementById(id);
  const button=node('download-backup'),cancel=node('cancel-standalone-import'),importCancel=node('cancel-backup-import'),note=node('backup-file-status');
  if(button){button.disabled=exporting;button.setAttribute('aria-busy',exporting?'true':'false');button.textContent=exporting?'Preparing backup…':'Export backup…';}
  if(cancel)cancel.hidden=!(exporting||Exports.status().fileBusy);
  if(importCancel)importCancel.hidden=!state.importHoldsBackground;
  if(note){const event=BackupPresentation.current('file'),message=BackupPresentation.summary(event);note.hidden=!message;if(note.textContent!==message)note.textContent=message;note.dataset.state=event?.severity==='error'?'error':'ok';}
}
// Each location row opens its settings in place: 'device' or 'drive'.
function toggleBackupSettings(kind){
  const panel=document.getElementById(`${kind}-backup-settings-panel`),button=document.getElementById(`${kind}-backup-settings`);
  if(!panel||!button||button.hidden)return false;
  panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',panel.hidden?'false':'true');return !panel.hidden;
}
// Google Drive's row, drawn from the engine's status like the Device Folder row.
// Before the Drive integration registers, the row keeps its static "Not connected".
function renderDriveBackup(){
  const state=BackupProviderRuntime.locationStatus('google-drive');if(!state)return;
  const node=id=>document.getElementById(id),status=node('backup-provider-row-status-google-drive'),connect=node('connect-drive-backup'),cancel=node('cancel-drive-backup'),settings=node('drive-backup-settings'),panel=node('drive-backup-settings-panel'),last=node('drive-backup-settings-last'),disconnect=node('disconnect-drive-backup');
  const connected=state.connected,working=state.busy||state.backingUp;
  if(status){status.textContent=BackupPresentation.locationLabel('google-drive',state);status.classList.toggle('protected',connected&&!working);status.classList.toggle('standard',!connected||working);}
  if(connect){const label=state.wasConnected?'Reconnect':'Connect';connect.hidden=connected;connect.textContent=label;connect.disabled=state.engineBusy;connect.setAttribute('aria-label',`${label} Google Drive`);}
  if(cancel){cancel.hidden=!state.cancellable;cancel.disabled=!state.cancellable;}
  if(settings){settings.hidden=!connected;settings.disabled=state.engineBusy;settings.setAttribute('aria-expanded',panel&&!panel.hidden?'true':'false');}
  if(panel&&!connected)panel.hidden=true;
  if(last){const at=verifiedRecoveryState.providers['google-drive']?.at;last.textContent=at?`Last backup ${storageHealthTime(at)}`:'No backup yet';}
  if(disconnect)disconnect.disabled=state.engineBusy;
  renderBackupActions();renderProfile();if(FirstStart.isOpen())FirstStart.render();
}
// One Back up now and one Version History for every location, shown while
// any location is connected. Version History stays available during a
// restore so it can be reopened.
function renderBackupActions(){
  const group=document.getElementById('backup-shared-actions'),backupNow=document.getElementById('backup-now'),versions=document.getElementById('open-version-history');if(!group)return;
  const rows=['device-folder','google-drive'].map(id=>BackupProviderRuntime.locationStatus(id)).filter(Boolean),connected=rows.some(row=>row.connected===true),busy=rows.some(row=>row.busy===true||row.engineBusy===true),recovering=rows.some(row=>row.busy===true&&['history','restore-version','bring-in','remove-version'].includes(String(row.foregroundKind||'')));
  // A sync greys both out for a moment; the tooltip says why.
  const syncText=rows.some(row=>row.sync?.syncing===true)?'Syncing with Google Drive…':'';
  group.hidden=!connected;
  if(backupNow){backupNow.disabled=busy;backupNow.title=busy&&syncText?syncText:rows.some(row=>row.maintenanceBusy)?'Background backup maintenance will yield to Back up now.':'';}
  if(versions){versions.disabled=busy&&!recovering;versions.title=recovering?'Reopen the active recovery operation.':busy&&syncText?syncText:'';}
}
// Back up each enabled destination independently. The sequential UI action
// avoids overlapping foreground operations; neither destination consumes the other.
async function backUpEverywhere(){
  let done=false;
  if(DeviceBackup.status().connected)done=await DeviceBackup.backupNow()!==false||done;
  if(BackupProviderRuntime.connected('google-drive'))done=await BackupProviderRuntime.backup('google-drive')!==false||done;
  return done;
}
function renderDeviceBackup(state){
  if(!state)return;
  scheduleSyncStatus();
  const status=document.getElementById('device-backup-status');
  const actions=document.getElementById('device-backup-actions');
  const connect=document.getElementById('connect-device-backup');
  const cancel=document.getElementById('cancel-device-backup');
  const settings=document.getElementById('device-backup-settings');
  const settingsPanel=document.getElementById('device-backup-settings-panel');
  const settingsState=document.getElementById('device-backup-settings-state');
  const folderName=document.getElementById('device-backup-folder-name');
  const repositoryName=document.getElementById('device-backup-repository-name');
  const settingsLast=document.getElementById('device-backup-settings-last');
  const disconnect=document.getElementById('disconnect-device-backup');
  const note=document.getElementById('device-backup-note');
  const connected=state.connected===true,operationBusy=state.busy||state.maintenanceBusy===true,recoveryActive=state.busy===true&&['history','restore-version','bring-in'].includes(String(state.foregroundKind||''));
  const last=state.lastBackupAt?storageHealthTime(state.lastBackupAt):'';
  if(status){
    status.textContent=BackupPresentation.locationLabel('device-folder',state);
    status.classList.toggle('protected',connected&&!operationBusy);
    status.classList.toggle('standard',!connected||operationBusy);
    status.title=state.lastBackupAt||'';
  }
  if(actions)actions.hidden=!state.supported;
  if(connect){
    connect.hidden=connected;
    connect.disabled=operationBusy;
    connect.textContent=state.mode==='permission'?'Allow access':'Choose folder…';
  }
  if(cancel){cancel.hidden=state.cancellable!==true;cancel.disabled=state.cancellable!==true;}
  if(settings){settings.hidden=!connected;settings.disabled=operationBusy;settings.setAttribute('aria-expanded',settingsPanel&&!settingsPanel.hidden?'true':'false');}
  if(settingsPanel&&!connected)settingsPanel.hidden=true;
  if(settingsState)settingsState.textContent=connected?'On':'Off';
  if(folderName)folderName.textContent=state.folderName||'Connected folder';
  // The folder inside it that holds this profile and device's versions.
  if(repositoryName)repositoryName.textContent=state.repositoryName||'—';
  if(settingsLast)settingsLast.textContent=last?`Last backup ${last}`:'No backup yet';
  if(disconnect){disconnect.hidden=!connected;disconnect.disabled=operationBusy;}
  if(note){
    const fallback=state.mode==='unsupported'?'Automatic folder backup is unavailable in this browser. Portable and Google Drive backups still work.':
      connected?(state.pending?'Changes wait for the next automatic backup.':'Your automatic backup is up to date.') : '';
    // Messages and progress show in the row's inline note; this note only says how the folder is doing.
    const message=state.hasNote?'':fallback;
    note.hidden=!message||recoveryActive;
    if(note.textContent!==message)note.textContent=message;
  }

  renderBackupActions();
  if(state.installed&&!operationBusy)schedulePwaUpdateEvaluation(250);
}
function markStorageHealthOk(source,key=''){
  const patch=key?{[key]:new Date().toISOString()}:null;
  return StorageHealthController.recover(source,patch);
}
function markStorageHealthTimestamp(key){
  return writeStorageHealth({[key]:new Date().toISOString()});
}
function markStorageHealthError(source,reason,options={}){
  return StorageHealthController.issue(source,reason||'Storage is unavailable.',options);
}
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
  const storageMessages=[backupNudgeMessage,...issues.filter(issue=>!failedSources.has(issue.source)).map(issue=>issue.message)].map(value=>String(value||'').trim()).filter(Boolean);
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
async function maybePromptBackupNudge(force=false){
  if(!appCanMutate())return;
  const now=Date.now();
  if(!force&&now-backupNudgeCheckedAt<BACKUP_NUDGE_CHECK_MS)return;
  backupNudgeCheckedAt=now;
  let backups;
  try{backups=await readVerifiedRecoveryState();}
  catch(error){AppDiagnostics.capture('backup.nudge-receipt-read',error,'warn');return;}
  const health=readStorageHealth(),entries=verifiedRecoveryEntries(backups);
  // One reminder for every kind of backup, counted from the latest backup
  // anywhere: a verified file, a download, the Device Folder or Drive. It stays away while an
  // automatic backup is able to run, and while a backup already holds the latest
  // changes, however old: automatic backups only run when something changed.
  const last=lastBackupTime(backups);
  const covered=Math.max(-Infinity,...entries.map(entry=>Date.parse(entry.sourceRevision)).filter(Number.isFinite));
  const changed=Date.parse(health.lastLocalSaveAt||''),unbacked=!Number.isFinite(covered)||!Number.isFinite(changed)||changed>covered;
  const automatic=BackupProviderRuntime.automaticActive();
  let due=!automatic&&unbacked&&Number.isFinite(last)&&(now-last>=BACKUP_NUDGE_MS);
  if(!Number.isFinite(last)&&!automatic){
    try{
      const summaries=await AppData.dailyRecords.summaries();
      due=Array.isArray(summaries)&&summaries.length>=7;
    }catch(e){}
  }
  // Someone who backs up to Google Drive gets back to it by signing in again.
  const drive=!!backups.providers?.['google-drive'];
  backupNudgeMessage=due?(drive?'Backup reminder: your changes have not reached Google Drive for over a week. Sign in again in Library → Data.':'Backup reminder: the last backup is over a week old. Open Library → Data.'):'';
  refreshStorageFallbackWarning();
  const notifyDate=todayISO();
  if(due&&backupNudgeNotifiedDate!==notifyDate){
    backupNudgeNotifiedDate=notifyDate;
    notifyUser(drive?'Sign in to Google Drive':'Back up Study Director',drive?'Your changes have not been backed up for at least seven days.':'It has been at least seven days since the last backup.',`sdm-backup-${notifyDate}`);
  }
}
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
      verifiedRecovery:normalizeVerifiedRecoveryState,attachmentIntegrity:normalizeAttachmentIntegrityState,
      repositoryIntegrity:normalizeRepositoryIntegrityState,
      reconciliationBase:ReconciliationBaselineCodec.normalizeHeader,reconciliationBaseNote:ReconciliationBaselineCodec.normalizeNote,reconciliationBaseDays:ReconciliationBaselineCodec.normalizeDays
    })
  })
}));
const ReconciliationBaselineStore=ReconciliationBaselineModule.createStore(Object.freeze({
  codec:ReconciliationBaselineCodec,meta:HostAppMeta,
  families:Object.freeze({header:'reconciliationBase',notes:'reconciliationBaseNotePrefix',days:'reconciliationBaseDayPrefix'})
}));
let richAssetReferenceRevision=0,captureMutationGeneration=0,backupFastFenceReady=false;
let imagePreparationCount=0,pwaWorkRevision=0;
document.addEventListener('input',()=>{pwaWorkRevision++;},true);
document.addEventListener('change',()=>{pwaWorkRevision++;},true);
let invalidateAttachmentLibrary=()=>false;
let scheduleRichTextAssetMaintenance=()=>false;
let notifyRichTextAssetLeaseReleased=()=>false;
let richTextAssetMaintenancePauseCount=0;
const canonicalAttachmentReferenceSignatures=new Map();
async function withRichTextAssetMaintenancePaused(operation){
  if(typeof operation!=='function')throw new TypeError('Attachment-maintenance pause operation is required.');
  richTextAssetMaintenancePauseCount++;
  try{await RichTextAssetMaintenance.settled();return await operation();}
  finally{richTextAssetMaintenancePauseCount=Math.max(0,richTextAssetMaintenancePauseCount-1);if(richTextAssetMaintenancePauseCount===0)scheduleRichTextAssetMaintenance();}
}
let attachmentIntegrityIssues=new Map();
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
  },'attachment metadata commit aborted').then(result=>{writeStorageHealth({lastLocalSaveAt:AppData.mutationEpoch.nextChangeAt()});notifyBackupChange({reason:'attachment-metadata'});if(attachmentIntegrityIssues.size)scheduleAttachmentIntegrityAudit(5000);return result;})
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
  mutationActive:()=>richTextAssetMaintenancePauseCount>0||backgroundMaintenanceForegroundBusy()||storageResetUnresolved(),
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
const VERIFIED_RECOVERY_META_KEY=APP_META_KEYS.verifiedRecoveryBackups;
// The one record of past backups (version 3). Each entry is a copy: when it was
// made (at), the change it holds (sourceRevision) and its backup format. file is
// the last portable backup: read back through the save dialog (verified) or a
// download, which cannot be read back but is still a backup the person made.
// providers holds each location's last verified copy.
let verifiedRecoveryState=Object.freeze({version:3,file:null,providers:Object.freeze({})}),verifiedRecoveryWriteChain=Promise.resolve();
function backupTime(value){return typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():'';}
function normalizeBackupCopy(value){
  const at=backupTime(value?.at),sourceRevision=backupTime(value?.sourceRevision);if(!at||!sourceRevision)return null;
  return Object.freeze({at,sourceRevision,format:Number.isSafeInteger(value.format)?value.format:null});
}
function normalizeVerifiedRecoveryState(value){
  if(Number(value?.version)!==3)return Object.freeze({version:3,file:null,providers:Object.freeze({})});
  const providers={};
  if(value.providers&&typeof value.providers==='object')for(const [id,row] of Object.entries(value.providers)){
    const copy=/^[a-z][a-z0-9-]{0,40}$/u.test(id)?normalizeBackupCopy(row):null;if(copy)providers[id]=copy;
  }
  const file=normalizeBackupCopy(value.file);
  return Object.freeze({version:3,file:file?Object.freeze({...file,verified:value.file.verified===true}):null,providers:Object.freeze(providers)});
}
function verifiedRecoveryEntries(state=verifiedRecoveryState){return [state.file,...Object.values(state.providers||{})].filter(Boolean);}
// When data was last backed up anywhere: a file, a download, the Device Folder or Drive.
function lastBackupTime(state=verifiedRecoveryState){return Math.max(-Infinity,...verifiedRecoveryEntries(state).map(entry=>Date.parse(entry.at)).filter(Number.isFinite));}
// Decisions read the record fresh; a failed read falls back to the copy in memory.
async function readVerifiedRecoveryState(){
  return normalizeVerifiedRecoveryState(await readHostAppMetaValue(VERIFIED_RECOVERY_META_KEY));
}
// A receipt becomes visible only after its durable metadata write commits.
// A provider may have published successfully even when this local receipt fails;
// keep its real external outcome, but never represent the receipt as durable.
function updateVerifiedRecoveryState(change){
  const run=async()=>{
    const next=normalizeVerifiedRecoveryState(change(await readVerifiedRecoveryState()));
    try{await writeHostAppMetaValue(VERIFIED_RECOVERY_META_KEY,next);}
    catch(error){AppDiagnostics.capture('backup.freshness-write',error,'warn');throw error;}
    verifiedRecoveryState=next;BackupProviderRuntime.refresh();
    return true;
  };
  const next=verifiedRecoveryWriteChain.catch(()=>{}).then(run);verifiedRecoveryWriteChain=next;return next;
}
// Every completed backup lands here. source is 'file' or a location id.
function recordBackupCopy(copy){
  const source=String(copy?.source||''),sourceRevision=backupTime(copy?.sourceRevision);
  if(!sourceRevision||!/^[a-z][a-z0-9-]{0,40}$/u.test(source))return Promise.resolve(false);
  // Known missing attachment bytes may be archived, but cannot be used as
  // proof of a fully recoverable, current-format external safety copy.
  const entry={at:new Date().toISOString(),sourceRevision,format:copy.attachmentsComplete===false?null:DATA_CONTRACT.schemas.Backup.version};
  return updateVerifiedRecoveryState(prior=>source==='file'?{...prior,file:{...entry,verified:copy.verified===true}}:{...prior,providers:{...prior.providers,[source]:entry}});
}
// Every save writes the change clock inside its own transaction (the
// mutation epoch); the last-save time in storage health is a fast copy for
// backup decisions. If a save committed but the copy was not written (the tab
// closed in between), the epoch repairs it here, so that change is still
// backed up. Seeding the clock also keeps later saves later after a reload.
async function reconcileChangeClock(){
  const recorded=String(readStorageHealth().lastLocalSaveAt||'');let latest=recorded;
  try{latest=await AppData.mutationEpoch.latestChangeAt(recorded);}catch(error){AppDiagnostics.capture('backup.change-clock-read',error,'error');throw error;}
  if(latest===recorded)return false;
  writeStorageHealth({lastLocalSaveAt:latest});return true;
}
let startupChangeClockReady=null;
function reconcileStartupChangeClock(){
  // An unknown durable clock cannot authorize automatic provider work.
  // Do not memoize a transient failure as a successful startup check.
  if(!startupChangeClockReady)startupChangeClockReady=reconcileChangeClock().catch(error=>{startupChangeClockReady=null;throw error;});
  return startupChangeClockReady;
}
async function installVerifiedRecoveryFreshness(){
  verifiedRecoveryState=await readVerifiedRecoveryState();
  BackupProviderRuntime.refresh();return verifiedRecoveryState;
}
async function verifyFreshCurrentBackup(){
  const unknown=()=>Object.freeze({ok:false,verifiedCopies:0,latestVerifiedAt:''});
  let currentRevision;
  try{
    // Canonical commits write the mutation epoch inside their transaction;
    // the localStorage health clock alone is not proof of the latest change.
    currentRevision=await AppData.mutationEpoch.latestChangeAt(currentBackupSourceRevision());
  }catch(error){AppDiagnostics.capture('backup.freshness-epoch-read',error,'warn');return unknown();}
  const currentSave=Date.parse(String(currentRevision||''));
  if(!Number.isFinite(currentSave))return unknown();
  let state;
  try{state=normalizeVerifiedRecoveryState(await readHostAppMetaValue(VERIFIED_RECOVERY_META_KEY));}
  catch(error){AppDiagnostics.capture('backup.freshness-receipt-read',error,'warn');return unknown();}
  // A missing, invalid or untrusted clock cannot authorize destructive work.
  const candidates=verifiedRecoveryEntries(state).filter(entry=>entry.verified!==false&&entry.format===DATA_CONTRACT.schemas.Backup.version&&Date.parse(entry.sourceRevision)>=currentSave);
  return Object.freeze({ok:candidates.length>0,verifiedCopies:candidates.length,latestVerifiedAt:candidates.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))[0]?.at||''});
}
// Compare policy identity and ownership inside the same typed metadata transaction.
function mutateBackupProtection(value,options){
  return ExportsAppMeta.transaction('readwrite',(meta,tx,finish)=>{
    const handle=meta.get('backupProtection'),request=handle.request;
    request.onerror=()=>finish(false,request.error);
    request.onsuccess=()=>{try{
      options.check();
      const current=handle.value();
      if((current?.id||'')!==options.expectedId)throw new Error('Backup encryption changed. Try again.');
      const mutation=value?meta.put('backupProtection',value):meta.remove('backupProtection');
      mutation.onerror=()=>finish(false,mutation.error);
    }catch(error){try{tx.abort();}catch{}finish(false,error);}};
    tx.oncomplete=()=>finish(true,true);
  },{abortMessage:'backup encryption update aborted'});
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
function canonicalAttachmentReferenceDescriptor(event){
  const type=String(event&&event.entityType||''),operation=event&&event.operation==='delete'?'delete':'upsert',value=event&&event.value;
  if(type==='dataset')return Object.freeze({key:'dataset:*',force:true,deleted:operation==='delete',text:''});
  let identity='',text='';
  if(type==='note'){identity=String(value&&value.key||'');text=String(value&&value.text||'');}
  else if(type==='dailyRecord'){identity=String(value&&value.date||'');text=String(value&&value.reflection||'');}
  else if(type==='activeSession'){identity=String(value&&value.id||ACTIVE_SESSION_ID);text=String(value&&value.snapshot&&value.snapshot.review&&value.snapshot.review.reflection||'');}
  // A kept version may be the last to use an image: recheck them all.
  else if(type==='pendingReview')return Object.freeze({key:'pendingReview:*',force:true,deleted:false,text:''});
  else return null;
  return Object.freeze({key:`${type}:${identity||'*'}`,force:false,deleted:operation==='delete',text});
}
function canonicalCommitChangesAttachmentReferences(event){
  const descriptor=canonicalAttachmentReferenceDescriptor(event);if(!descriptor)return false;
  if(descriptor.force){canonicalAttachmentReferenceSignatures.clear();return true;}
  const prior=canonicalAttachmentReferenceSignatures.get(descriptor.key);
  if(descriptor.deleted){canonicalAttachmentReferenceSignatures.delete(descriptor.key);return prior!==undefined||descriptor.key.startsWith('activeSession:');}
  let signature='';
  try{
    const scan=RichTextApi.scanAttachmentReferences(descriptor.text);
    if(!scan||scan.trusted!==true)return true;
    signature=[...new Set(scan.assetIds||[])].sort().join('|');
  }catch{return true;}
  canonicalAttachmentReferenceSignatures.set(descriptor.key,signature);
  return prior===undefined||prior!==signature;
}
const STUDY_DATA_COMMITS=Object.freeze(new Set(['note','dailyRecord','activeSession','planData','pendingReview']));
function handleCanonicalCommit(event){
  const referencesChanged=canonicalCommitChangesAttachmentReferences(event);
  if(referencesChanged)richAssetReferenceRevision++;
  const committedAt=event&&event.committedAt||new Date().toISOString();
  // Study data was saved here: notes, Saved Days, sessions, plans, kept
  // versions, whether made here or taken in by a sync: what the empty-device
  // check counts. Settings alone (a name, a theme) and canonical hydration
  // do not count as authored study data.
  const studyData=!!event&&event.startup!==true&&event.settingsOnly!==true&&STUDY_DATA_COMMITS.has(event.entityType);
  writeStorageHealth(studyData?{lastLocalSaveAt:committedAt,lastStudyDataSaveAt:committedAt}:{lastLocalSaveAt:committedAt});
  renderStorageHealth();
  CapabilityBadge?.syncFromCanonicalCommit(event);
  if(event?.backupCapture!==true)notifyBackupChange({
    urgent:event&&event.entityType==='dailyRecord',
    reason:String(event&&event.entityType||'canonical-commit')
  });
  if(referencesChanged&&event?.backupCapture!==true){
    scheduleRichTextAssetMaintenance();
    invalidateAttachmentLibrary();
  }
  if(event&&event.entityType==='pendingReview'&&StartupLifecycle.status().fullyInitialized)void KeptVersions.refresh();
  if(event?.entityType==='dailyRecord'&&ReviewDayState.reminder.date)
    void revalidateSaveReminderAfterCanonicalConvergence();
}

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
function backgroundBlocker({housekeeping=true}={}){
  if(!appCanMutate())return 'awaiting-control';
  if(!StartupLifecycle.status().fullyInitialized)return 'startup';
  return housekeeping&&storageResetUnresolved()?'storage-reset':'';
}
// Local upkeep (canonical maintenance, attachment cleanup and checks, scratch
// files) also gives way to anything the person is doing and to backups. It then
// waits under the named reason 'foreground-busy', like backup jobs paused by a
// foreground operation: one watcher, not each job, checks back while the work
// lasts, and every job is woken the moment it ends. Notices and backup status
// changes check at once; the watcher's own check is the fallback.
const FOREGROUND_RECHECK_MS=15000;let foregroundWatch=null;
function upkeepBlocker(options){
  const blocker=backgroundBlocker(options);if(blocker)return blocker;
  // Clean-up decides what nothing refers to; data this build cannot read may.
  if(UnsupportedData.held())return 'unsupported-data';
  if(!backgroundMaintenanceForegroundBusy())return '';
  if(foregroundWatch===null)foregroundWatch=setTimeout(foregroundChanged,FOREGROUND_RECHECK_MS);
  return 'foreground-busy';
}
function foregroundChanged(){
  if(foregroundWatch===null)return false;
  clearTimeout(foregroundWatch);foregroundWatch=null;
  if(backgroundMaintenanceForegroundBusy()){foregroundWatch=setTimeout(foregroundChanged,FOREGROUND_RECHECK_MS);return false;}
  return wakeBackgroundOperations('foreground-released');
}
const BackgroundOperations=OperationLifecycle.createGroup((id,error)=>AppDiagnostics.capture('background.owner.'+id,error,'warn'));
let backgroundOwnersInstalled=false;
function installBackgroundOwners(){
  if(backgroundOwnersInstalled)return;
  for(const [id,owner] of [
    ['canonical',Object.freeze({wake:trigger=>DataMaintenanceJob.wake(trigger,true)})],
    ['attachments',Object.freeze({wake:trigger=>RichTextAssetMaintenance.wake(trigger)})],
    ['attachment-integrity',Object.freeze({wake:trigger=>AttachmentIntegrityJob.wake(trigger,true)})],
    ['temporary-files',BackupFiles],
    // The Device Folder's own folder is settled before its backups run.
    ['device-folder',Object.freeze({wake:()=>DeviceBackup.wake()})],
    ['backup-locations',Object.freeze({wake:BackupProviderRuntime.wakeBackground})]
  ])BackgroundOperations.register(id,owner);
  backgroundOwnersInstalled=true;
}
// A page closed in the middle of a change (a sync applying it, perhaps as
// the phone put the app away) leaves its write lease until it runs out, at
// most 20 s. This tab owns the app, so the lease is that closed page's:
// start-up recovery waits for it to end rather than asking for a reload.
async function waitForClosedTabLease(limitMs=25000){
  for(let waited=0;waited<limitMs&&AppOwnership.canMutate()&&AppMutationCoordinator.foreignActive();waited+=250)await new Promise(resolve=>setTimeout(resolve,250));
  return !AppMutationCoordinator.foreignActive();
}
function wakeBackgroundOperations(trigger='eligibility'){
  if(!StartupLifecycle.status().fullyInitialized)return false;
  installBackgroundOwners();BackgroundOperations.wake(trigger);return true;
}
NoticeCoordinator.subscribe(()=>{foregroundChanged();});
function backgroundMaintenanceStatusBusy(owner,field='busy'){
  try{return !!owner?.status?.()?.[field];}
  catch(error){try{AppDiagnostics.capture('maintenance.foreground-status',error);}catch{}return true;}
}
function backgroundMaintenanceForegroundBusy(){
  return !!pwaUpdateReservation||backgroundMaintenanceStatusBusy(AppMutationCoordinator,'active')||backgroundMaintenanceStatusBusy(AttachmentIngest)||backgroundMaintenanceStatusBusy(Exports)||backgroundMaintenanceStatusBusy(BackupController)||backgroundMaintenanceStatusBusy(BackupProviderRuntime);
}
const DataMaintenanceJob=OperationLifecycle.createJob({
  environment:{now:()=>Date.now(),setTimeout,clearTimeout},
  isAvailable:()=>upkeepBlocker({housekeeping:false})||true,
  retryMs:DATA_MAINTENANCE_FAILURE_RETRY_MS,capture:error=>AppDiagnostics.capture('maintenance.schedule',error,'error'),
  execute:async({trigger,nextEligibleAt})=>{
    if(backgroundMaintenanceForegroundBusy())return Object.freeze({status:'skipped',reason:'foreground-busy'});
    const traceId=BackupOperationDiagnostics.start('data-maintenance','Canonical storage',{background:true,trigger,nextEligibleAt,actionable:true});BackupOperationDiagnostics.mark('data-maintenance-eligibility',{trigger,nextEligibleAt,actionable:true},traceId);
    const foregroundCheck=()=>{if(backgroundMaintenanceForegroundBusy())throw Object.assign(new Error('Data maintenance yielded.'),{code:'DATA_MAINTENANCE_YIELDED',reason:'foreground-busy'});};
    const workBudget=OperationLifecycle.createWorkBudget({now:()=>Date.now(),milliseconds:20000,check:foregroundCheck,yieldError:()=>Object.assign(new Error('Data maintenance yielded.'),{code:'DATA_MAINTENANCE_YIELDED',reason:'budget'})});
    try{
      const result=await AppData.maintenance.run({check:foregroundCheck,workBudget});
      const status=String(result&&result.status||'failed'),reason=String(result&&result.reason||'');
      BackupOperationDiagnostics.finish({status,result:status,reason},traceId);
      if(status==='yielded')scheduleDataMaintenance(15000,reason||'yielded');
      else if(status==='completed'){
        // The rest of the daily upkeep follows: notes past their 30 days in
        // Recently deleted go, then attachment cleanup sweeps unused files.
        try{AppData.notes.purgeExpiredTrash();}catch(error){AppDiagnostics.capture('maintenance.trash',error,'warn');}
        scheduleRichTextAssetMaintenance(ATTACHMENT_CLEANUP_AFTER_UPKEEP_MS);
        scheduleDataMaintenance(DATA_MAINTENANCE_SCHEDULE_INTERVAL_MS,'interval');
      }
      else if(status==='skipped'&&reason==='recent'){
        const lastRun=Date.parse(String(result&&result.lastRun||'')),remaining=Number.isFinite(lastRun)?Math.max(1000,lastRun+DATA_MAINTENANCE_SCHEDULE_INTERVAL_MS-Date.now()):DATA_MAINTENANCE_SCHEDULE_INTERVAL_MS;
        scheduleDataMaintenance(remaining,'interval');
      }else if(status==='failed'||reason==='indexeddb-unavailable')DataMaintenanceJob.schedule(DATA_MAINTENANCE_FAILURE_RETRY_MS,'retry','replace');
      return result;
    }catch(error){BackupOperationDiagnostics.fail(error,{background:true},traceId);throw error;}
  }
});
function scheduleDataMaintenance(delay=1200,trigger='scheduled'){
  if(!StartupLifecycle.status().fullyInitialized)return false;
  return DataMaintenanceJob.schedule(Math.max(0,Number(delay)||0),trigger);
}

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
let protectedPreferencesWriteChain=Promise.resolve();
function acceptProtectedPreferences(value){
  const clean=PersonalDataCodec.currentPortablePreferences(value)||PersonalDataCodec.portablePreferences({version:2,...value});
  protectedPreferencesState=Object.freeze({...clean});protectedPreferencesHydrated=true;return protectedPreferencesState;
}
function refreshAppearanceMirrors(value=protectedPreferencesState){
  const clean=PersonalDataCodec.currentPortablePreferences(value)||PersonalDataCodec.portablePreferences({version:2,...value});
  const entries=[['theme',clean.theme],['presentation',clean.presentation],['fontScale',clean.fontScale]];
  for(const [name,current] of entries){
    const ok=current===null?AppData.local.remove(STORAGE_KEYS[name]):AppData.local.setText(STORAGE_KEYS[name],String(current));
    if(!ok)AppDiagnostics.capture('preferences.mirror-write',AppData.lastStorageError||new Error(`${name} startup mirror could not be refreshed.`),'warn');
  }
  return true;
}
function applyPortablePreferencesToRuntime(value=protectedPreferencesState){
  const clean=PersonalDataCodec.currentPortablePreferences(value)||PersonalDataCodec.portablePreferences({version:2,...value});
  applyStudentName(clean.studentName||FACTORY_DEFAULTS.studentName);
  applyFontScale(clean.fontScale??1);
  applyTheme(clean.theme??DEFAULT_THEME_ID);applyPresentation(clean.presentation??DEFAULT_PRESENTATION_ID);renderPresentationControls();
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
      if(protectedPreferencesState.updatedAt===snapshot.updatedAt){acceptProtectedPreferences(saved);refreshAppearanceMirrors(saved);}
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
// One status for the phone circle, the sidebar name and the profile panel:
// a ring for sync health and a badge for what needs the person
// (docs/areas/status-indicator.md). Drawn after the current task, so every input
// below is initialised and bursts of changes draw once.
function scheduleSyncStatus(){if(syncStatusTimer===null)syncStatusTimer=setTimeout(renderSyncStatus,0);}
function syncStatusInput(){
  const drive=BackupProviderRuntime.locationStatus('google-drive'),email=Profiles.current()?.email||'';
  let device=null,protection=null,storage=[];
  try{device=DeviceBackup.status();}catch{/* Not installed yet. */}
  try{protection=BackupProtection.status();}catch{/* Not installed yet. */}
  try{storage=readStorageHealth().issues;}catch{/* Not installed yet. */}
  return {
    online:navigator.onLine!==false,
    drive:drive?{...namedTurnDevice(drive),setUp:drive.connected||drive.wasConnected||!!email,connecting:driveConnecting}:driveConnecting?{connecting:true}:null,
    device:device&&device.supported?device:null,
    passwordNeeded:!!protection&&protection.enabled&&!protection.unlocked,
    newerData:UnsupportedData.held(),
    kept:KeptVersions.count(),
    storage:storage.map(issue=>({source:issue.source,label:issue.label,message:issue.message,level:issue.level})),
    reminder:backupNudgeMessage,
    updateReady:!!(pwaLatestUpdateState?.updateReady&&!pwaLatestUpdateState.applying),
    sessionElsewhere:sessionPanelMode==='elsewhere'&&sessionPanelSession?sessionDevice(sessionPanelSession):'',
    sessionReady:sessionParkedHere()&&sessionFromElsewhere(sessionPanelSession)?sessionDevice(sessionPanelSession):'',
    operation:driveRunningOperation(),
    unseen:NoticeCoordinator.recent().unseen
  };
}
function drawStatusHost(host,model){
  if(!host)return;
  if(host.dataset.ring!==model.ring)host.dataset.ring=model.ring;
  if((host.dataset.badge||'')!==model.badge)host.dataset.badge=model.badge;
  host.toggleAttribute('data-slow',model.slow);
  const many=value=>value>9?'9+':String(value);
  const badge=host.querySelector('.status-badge'),text=model.badge==='review'&&model.count>1?many(model.count):model.badge==='info'&&model.unseen>1?many(model.unseen):['error','warning'].includes(model.badge)?'!':model.badge==='update'?'↑':'';
  if(badge&&badge.textContent!==text)badge.textContent=text;
}
function renderSyncStatus(){
  syncStatusTimer=null;
  let model;
  try{model=BackupPresentation.status(syncStatusInput());}
  catch(error){AppDiagnostics.capture('sync-status.render',error,'warn');return;}
  const hosts=['profile-tag','profile-badge','profile-avatar'].map(id=>document.getElementById(id));
  // Syncing settles into the green ring with a brief glow.
  if(syncStatusRing==='syncing'&&model.ring==='synced'){
    clearTimeout(syncStatusSettle);for(const host of hosts)host?.classList.add('status-settle');
    syncStatusSettle=setTimeout(()=>{for(const host of hosts)host?.classList.remove('status-settle');},1400);
  }
  syncStatusRing=model.ring;
  for(const host of hosts)drawStatusHost(host,model);
  const name=getStudentNameFromDisplay();
  const tag=document.getElementById('profile-tag');if(tag){tag.title=`${model.label} — profile and sync`;tag.setAttribute('aria-label',`Profile: ${name} · ${model.label}`);}
  const badge=document.getElementById('profile-badge');if(badge){badge.title=model.label;badge.setAttribute('aria-label',`Profile: ${name} · ${model.label}`);}
  renderSyncStatusPanel(model);
  renderDriveConnectCard();
}
function renderSyncStatusPanel(model){
  const dialog=document.getElementById('profile-dialog');if(!dialog?.open)return;
  const headline=document.getElementById('profile-status-headline');if(headline&&headline.textContent!==model.headline)headline.textContent=model.headline;
  const detail=document.getElementById('profile-status-detail');if(detail)detail.textContent=model.detail;
  const primary=document.getElementById('profile-status-primary');
  // Sync now (shown only while waiting) is a quiet link beside the sentence;
  // Try again keeps the full button.
  if(primary){primary.hidden=!model.action;if(model.action){primary.textContent=model.action.label;primary.dataset.syncAction=model.action.action;primary.classList.toggle('profile-act-quiet',model.action.action==='sync-now');}}
  // Rebuilt only when the items change, so a focused button keeps focus.
  const list=document.getElementById('profile-status-items'),key=JSON.stringify(model.items);
  if(list&&list.dataset.key!==key){list.dataset.key=key;list.replaceChildren(...model.items.map(item=>{
    const row=document.createElement('li');row.className='profile-status-item';row.dataset.tone=item.tone;row.dataset.item=item.id;
    const mark=document.createElement('span');mark.className='profile-status-mark';mark.setAttribute('aria-hidden','true');
    const text=document.createElement('span');text.className='profile-status-text';text.textContent=item.text;
    const button=document.createElement('button');button.type='button';button.className='profile-act ui-btn';button.dataset.action='sync-status-action';button.dataset.syncAction=item.action;button.textContent=item.actionLabel;
    row.append(mark,text,button);return row;
  }));}
}
// Each panel action calls the feature's own action; the indicator never
// starts work by itself. Sync now, Try again and Sign in keep the panel open
// so the ring shows the work; the others close it for their own dialog or view.
async function syncStatusAction(ev){
  const kind=String(ev?.target?.closest?.('[data-sync-action]')?.dataset.syncAction||'');
  if(!['sync-now','retry','sign-in'].includes(kind))closeProfilePanel();
  try{
    switch(kind){
      // Sync now (shown while waiting for another device) uploads without
      // waiting for that device's turn; Try again keeps the usual turns.
      case 'sync-now':case 'retry':BackupProviderRuntime.scheduleSharedSync('google-drive',kind==='retry'?'sync-retry':'sync-now',{skipTurn:kind==='sync-now'});scheduleSyncStatus();return true;
      case 'sign-in':return await connectDriveForProfile();
      case 'enter-password':return await CLICK_ACTIONS['backup-protection']();
      case 'unlock-sync':return await BackupProviderRuntime.unlockSync('google-drive');
      case 'check-update':return await checkUnsupportedUpdate();
      case 'apply-update':return await applyPwaUpdateFromUi();
      case 'review-sync':return await BackupProviderRuntime.reviewSync('google-drive');
      case 'review-kept':return await KeptVersions.review();
      case 'device-permission':return await connectDeviceBackupWithRecovery();
      case 'open-execute':return await goTab('execute',{source:'sync-status'});
      case 'continue-session':return await continueSessionOnExecute('sync-status');
      case 'open-data':if(!await goTab('library',{source:'sync-status'}))return false;LibraryView.showSection('data');return true;
      default:return false;
    }
  }catch(error){AppDiagnostics.capture('sync-status.action',error,'warn');return false;}
}
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
  verifiedSourceRevision:()=>verifiedRecoveryState.providers['google-drive']?.sourceRevision||'',
  currentBackupSourceRevision:()=>currentBackupSourceRevision()
}));
const deleteThisProfile=ProfileDeletion.deleteThisProfile;
const driveProfileDeleted=ProfileDeletion.driveProfileDeleted;

// The Drive connection a person asked for in the last few minutes may ask
// them about the library it finds; one that just happens (a restored sign-in,
// a background sync) never does.
// The indicator shows Connecting… from the click until the sign-in settles,
// and the Connect card follows the first sync to its end.
function connectDriveForProfile(){
  ProfileDriveBinding.markRequested();driveConnecting=true;startDriveConnectCard();scheduleSyncStatus();
  const settled=ok=>{
    driveConnecting=false;
    if(driveConnectCard&&driveConnectCard.phase==='signing-in'){
      if(ok===true)driveConnectCard.phase='signed-in';
      else{const said=BackupPresentation.read('google-drive','backup-status');driveConnectCard.phase='failed';driveConnectCard.error=String(said?.message||'').replace(/^Connection failed:\s*/u,'')||'Sign-in didn’t finish.';}
    }
    scheduleSyncStatus();
  };
  const result=BackupProviderRuntime.connect('google-drive');Promise.resolve(result).then(settled,()=>settled(false));return result;
}
// The Connect card (docs/areas/status-indicator.md, Connect card): it reads what Drive
// reports and decides nothing itself.
function startDriveConnectCard(){
  clearTimeout(driveConnectCardHide);driveConnectCardHide=null;
  driveConnectCard={startedAt:Date.now(),phase:'signing-in',error:'',seen:{sync:false,upload:false},kept:KeptVersions.count(),lastStatus:''};
}
function endDriveConnectCard(){clearTimeout(driveConnectCardHide);driveConnectCardHide=null;driveConnectCard=null;renderDriveConnectCard();}
function driveRunningOperation(){
  for(const [id,kind] of [['external-sync','sync'],['backup-operation',''],['external-backup','upload']]){
    const event=BackupPresentation.read('google-drive',id);
    if(event&&event.lifecycle==='running')return {kind:kind||(event.kind==='sync'?'sync':'upload'),message:String(event.message||''),progress:event.progress||null};
  }
  return null;
}
// Drive reports the device whose upload this one waits for by its id; what
// the person reads is its type and browser ("Windows · Chrome").
function namedTurnDevice(drive){return drive?.sync?{...drive,sync:{...drive.sync,turnDevice:drive.sync.turnDevice?deviceName(drive.sync.turnDevice):''}}:drive;}
function renderDriveConnectCard(){
  const node=id=>document.getElementById(id),root=node('drive-connect-card');if(!root)return;
  const state=driveConnectCard;
  if(!state){root.hidden=true;return;}
  let model;
  try{
    const drive=namedTurnDevice(BackupProviderRuntime.locationStatus('google-drive')),operation=driveRunningOperation();
    if(drive?.sync?.syncing||operation?.kind==='sync')state.seen.sync=true;
    if(operation?.kind==='upload'&&['upload','commit','complete'].includes(String(operation.progress?.stage||'')))state.seen.upload=true;
    model=BackupPresentation.connectProgress({phase:state.phase,error:state.error,startedAt:state.startedAt,online:navigator.onLine!==false,drive,operation,seen:state.seen,keptNew:Math.max(0,KeptVersions.count()-state.kept)});
  }catch(error){AppDiagnostics.capture('drive-connect-card.render',error,'warn');root.hidden=true;return;}
  root.hidden=false;root.dataset.tone=model.tone;
  setTextSafe('drive-connect-title',model.title);
  // Screen readers hear the sentence when it changes, not every count.
  if(state.lastStatus!==model.status){state.lastStatus=model.status;setTextSafe('drive-connect-status',model.status);}
  // Sync now and Try now sit on the line of the step that waits, as a quiet
  // link; any other action is the card's button.
  const inline=model.action?.step?model.action:null,list=node('drive-connect-steps'),key=JSON.stringify([model.steps,inline]);
  if(list&&list.dataset.key!==key){
    list.dataset.key=key;
    list.replaceChildren(...model.steps.map(step=>{
      const item=document.createElement('li');item.dataset.state=step.state;if(step.state==='active')item.setAttribute('aria-current','step');
      const label=document.createElement('span');label.textContent=step.label;item.append(label);
      if(inline&&inline.step===step.id){const link=document.createElement('button');link.type='button';link.className='drive-connect-step-action';link.dataset.action='sync-status-action';link.dataset.syncAction=inline.action;link.textContent=inline.label;item.append(link);}
      return item;
    }));
  }
  // No moving bar while a step only waits (for another device, or a retry).
  const bar=node('drive-connect-bar'),showBar=model.tone==='working'&&state.phase!=='signing-in'&&!model.steps.some(step=>step.state==='waiting');
  if(bar){bar.hidden=!showBar;bar.dataset.mode=model.fraction===null?'indeterminate':'determinate';bar.firstElementChild.style.width=model.fraction===null?'':`${Math.round(model.fraction*100)}%`;}
  const detail=node('drive-connect-detail');if(detail){detail.hidden=!model.detail;if(detail.textContent!==model.detail)detail.textContent=model.detail;}
  const action=node('drive-connect-action');
  if(action){action.hidden=!model.action||!!inline;if(model.action&&!inline){action.dataset.syncAction=model.action.action;if(action.textContent!==model.action.label)action.textContent=model.action.label;}}
  // Synced closes on its own; anything that needs the person stays.
  if(model.done&&!driveConnectCardHide)driveConnectCardHide=setTimeout(()=>{if(driveConnectCard===state)endDriveConnectCard();},6000);
}
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
async function withBackupPassword(open){
  try{const protection=BackupProtection.status();if(protection.enabled&&!protection.unlocked)await BackupProtection.ask();}catch(error){setBackupProtectionSurfaceError(error);}
  return open();
}
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
const PluginRuntime=(()=>{
  const descriptorsByTab=new Map(OPTIONAL_PLUGIN_DESCRIPTORS.map(descriptor=>[descriptor.tabId,descriptor]));
  const descriptorsByPlugin=new Map(OPTIONAL_PLUGIN_DESCRIPTORS.map(descriptor=>[descriptor.pluginName,descriptor]));
  const files=new Map(OPTIONAL_PLUGIN_DESCRIPTORS.map(descriptor=>[descriptor.tabId,Object.freeze({...descriptor,state:'not-requested',detail:'',attempts:0,updatedAt:null})]));
  const loadPromises=new Map();
  const registered=new Map();
  const MAX_LOAD_ATTEMPTS=2;
  const MAX_REGISTRATION_ATTEMPTS=2;
  function nowStamp(){return new Date().toISOString();}
  function fileState(tabId){
    const descriptor=descriptorsByTab.get(tabId);
    return descriptor?(files.get(tabId)||Object.freeze({...descriptor,state:'not-requested',detail:'',attempts:0,updatedAt:null})):null;
  }
  function markFile(tabId,state,detail='',attempts=null){
    const descriptor=descriptorsByTab.get(tabId);
    if(!descriptor)return null;
    const previous=fileState(tabId);
    const next=Object.freeze({
      ...descriptor,
      state,
      detail:clampText(detail||'',200),
      attempts:attempts===null?Math.max(0,Number(previous&&previous.attempts)||0):Math.max(0,Number(attempts)||0),
      updatedAt:nowStamp()
    });
    files.set(tabId,next);
    const pane=document.getElementById('pane-'+tabId);
    if(pane)pane.setAttribute('aria-busy',state==='loading'?'true':'false');
    return next;
  }
  function activeTabId(){return document.querySelector('.nav-item.on[data-tab]')?.dataset.tab||'';}
  function renderIfActive(tabId){
    if(activeTabId()===tabId)UiTabRegistry.renderTab(tabId);
  }
  function canRetry(record){
    return !!record&&['loaded','missing','failed'].includes(record.state)&&record.attempts<MAX_LOAD_ATTEMPTS;
  }
  function placeholderMessage(record){
    if(record.state==='loading')return `Loading ${record.label}…`;
    if(record.state==='missing')return `${record.label} could not be loaded. The core app remains available.`;
    if(record.state==='incompatible')return `${record.label} is not compatible with this core build.`;
    if(record.state==='failed')return `${record.label} could not start. The core app remains available.`;
    if(record.state==='loaded')return `${record.label} loaded but did not register.`;
    if(record.state==='registered')return `Opening ${record.label}…`;
    return `${record.label} loads only when you open this tab.`;
  }
  function renderPlaceholder(context,descriptor){
    const pane=context&&context.pane;
    if(!pane)return;
    const record=fileState(descriptor.tabId);
    pane.setAttribute('aria-busy',record&&record.state==='loading'?'true':'false');
    const panel=document.createElement('section');
    const insightsLoading=descriptor.tabId==='insights'&&record&&!['missing','incompatible','failed','loaded'].includes(record.state);
    panel.className='ui-panel'+(insightsLoading?' plugin-loading-panel':'');
    const kicker=document.createElement('div');
    kicker.className='ui-label';
    kicker.textContent=insightsLoading?'Study Coach + Evidence Dashboard':'Optional module';
    const title=document.createElement('h1');
    title.className='ui-title';
    title.textContent=descriptor.label;
    const status=document.createElement('div');
    const isError=record&&['missing','incompatible','failed','loaded'].includes(record.state);
    status.className='ui-status'+(isError?' err':'');
    status.setAttribute('role',isError?'alert':'status');
    status.setAttribute('aria-live',isError?'assertive':'polite');
    status.textContent=insightsLoading?(record.state==='registered'?'Opening Insights…':'Preparing your saved study history…'):placeholderMessage(record);
    panel.append(kicker,title,status);
    if(insightsLoading){
      const copy=document.createElement('div');
      copy.className='ui-body plugin-loading-copy';
      copy.textContent='Insights is loading once for this app session. Your existing page will be retained on later visits unless its source data changes.';
      const track=document.createElement('div');
      track.className='plugin-loading-track';
      track.setAttribute('aria-hidden','true');
      panel.append(copy,track);
    }
    if(record&&record.detail){
      const detail=document.createElement('div');
      detail.className='ui-helper';
      detail.textContent=record.detail;
      panel.appendChild(detail);
    }
    if(canRetry(record)){
      const retry=document.createElement('button');
      retry.className='mini-btn ui-btn';
      retry.type='button';
      retry.textContent='Retry loading';
      retry.addEventListener('click',()=>{
        requestTab(descriptor.tabId,{retry:true});
        renderIfActive(descriptor.tabId);
      });
      panel.appendChild(retry);
    }
    pane.replaceChildren(panel);
  }
  function registerPlaceholders(){
    let complete=true;
    OPTIONAL_PLUGIN_DESCRIPTORS.forEach(descriptor=>{
      if(!UiTabRegistry.registerTab({
        id:descriptor.tabId,
        label:descriptor.label,
        icon:descriptor.icon,
        render:context=>renderPlaceholder(context,descriptor)
      }))complete=false;
    });
    return complete;
  }
  function unmetCapabilities(requirements){
    if(!requirements||typeof requirements!=='object')return [];
    return Object.entries(requirements).filter(([key,minimum])=>Number(STUDY_DIRECTOR_CAPABILITIES[key]||0)<Math.max(0,Number(minimum)||0));
  }
  function register(plugin){
    if(!plugin||typeof plugin.setup!=='function')return false;
    const name=clampText(plugin.name||'anonymous-plugin',80);
    const descriptor=descriptorsByPlugin.get(name)||null;
    const previous=registered.get(name);
    if(previous&&previous.state==='registered'){
      if(descriptor){markFile(descriptor.tabId,'registered','',fileState(descriptor.tabId)?.attempts);renderIfActive(descriptor.tabId);}
      return true;
    }
    if(previous&&previous.state==='incompatible'){
      if(descriptor){markFile(descriptor.tabId,'incompatible',previous.detail||'',fileState(descriptor.tabId)?.attempts);renderIfActive(descriptor.tabId);}
      return false;
    }
    const attempts=Math.max(0,Number(previous&&previous.attempts)||0);
    if(attempts>=MAX_REGISTRATION_ATTEMPTS){
      if(descriptor){markFile(descriptor.tabId,'failed','Registration attempt limit reached.',fileState(descriptor.tabId)?.attempts);renderIfActive(descriptor.tabId);}
      return false;
    }
    const nextAttempt=attempts+1;
    const unmet=unmetCapabilities(plugin.requires);
    if(unmet.length){
      const detail='Missing capabilities: '+unmet.map(([key,minimum])=>`${key}>=${Math.max(0,Number(minimum)||0)}`).join(', ');
      registered.set(name,{name,version:clampText(plugin.version||'',40),state:'incompatible',attempts:nextAttempt,detail:clampText(detail,160),updatedAt:nowStamp()});
      if(descriptor){markFile(descriptor.tabId,'incompatible',detail,fileState(descriptor.tabId)?.attempts);renderIfActive(descriptor.tabId);}
      return false;
    }
    try{
      const ok=plugin.setup(window.StudyDirector)!==false;
      const detail=ok?'':'Plugin setup did not activate.';
      if(ok&&plugin.previewProviders&&typeof plugin.previewProviders==='object'){
        Object.entries(plugin.previewProviders).forEach(([target,provider])=>PreviewRuntime.registerProvider(target,provider));
      }
      registered.set(name,{name,version:clampText(plugin.version||'',40),state:ok?'registered':'inactive',attempts:nextAttempt,detail,updatedAt:nowStamp()});
      if(descriptor){markFile(descriptor.tabId,ok?'registered':'failed',detail,fileState(descriptor.tabId)?.attempts);renderIfActive(descriptor.tabId);}
      return ok;
    }catch(error){
      const detail=clampText(error&&error.message||String(error),160);
      registered.set(name,{name,version:clampText(plugin.version||'',40),state:'failed',attempts:nextAttempt,detail,updatedAt:nowStamp()});
      if(descriptor){markFile(descriptor.tabId,'failed',detail,fileState(descriptor.tabId)?.attempts);renderIfActive(descriptor.tabId);}
      return false;
    }
  }
  function startLoad(descriptor){
    const previous=fileState(descriptor.tabId);
    const attempts=Math.max(0,Number(previous&&previous.attempts)||0)+1;
    markFile(descriptor.tabId,'loading','',attempts);
    const promise=new Promise(resolve=>{
      const script=document.createElement('script');
      script.src=trustedAssetURL(descriptor.src);
      script.async=false;
      script.dataset.studyDirectorPlugin='optional';
      script.dataset.studyDirectorPluginTab=descriptor.tabId;
      script.onload=()=>{
        const latest=fileState(descriptor.tabId);
        if(latest&&latest.state==='loading')markFile(descriptor.tabId,'loaded','Plugin file loaded but did not register.',attempts);
        renderIfActive(descriptor.tabId);
        resolve(fileState(descriptor.tabId)?.state==='registered');
      };
      script.onerror=()=>{
        script.remove();
        markFile(descriptor.tabId,'missing',`Could not load ${descriptor.src}.`,attempts);
        renderIfActive(descriptor.tabId);
        resolve(false);
      };
      document.head.appendChild(script);
    });
    loadPromises.set(descriptor.tabId,promise);
    promise.finally(()=>{
      if(loadPromises.get(descriptor.tabId)===promise)loadPromises.delete(descriptor.tabId);
    });
    return promise;
  }
  function requestTab(tabId,{retry=false}={}){
    const descriptor=descriptorsByTab.get(String(tabId||'').trim());
    if(!descriptor)return null;
    const pending=loadPromises.get(descriptor.tabId);
    if(pending)return pending;
    const record=fileState(descriptor.tabId);
    if(record&&record.state==='registered')return Promise.resolve(true);
    if(record&&record.state==='not-requested')return startLoad(descriptor);
    if(retry&&canRetry(record))return startLoad(descriptor);
    return Promise.resolve(false);
  }
  function status(){
    return {
      optionalFiles:OPTIONAL_PLUGIN_DESCRIPTORS.map(descriptor=>fileState(descriptor.tabId)),
      registered:[...registered.values()]
    };
  }
  return Object.freeze({registerPlaceholders,requestTab,register,status});
})();
// Insights prepares a long saved history in idle time so its first opening
// does not wait on a cold worker. Load its file only after start-up
// housekeeping has had its turn, while the page is visible and idle.
const INSIGHTS_PRELOAD_DELAY_MS=4000;
function scheduleInsightsPreload(){
  setTimeout(()=>{
    const load=()=>{
      if(document.visibilityState==='hidden'){document.addEventListener('visibilitychange',load,{once:true});return;}
      // requestTab reports load failures in plugin status and never rejects.
      void PluginRuntime.requestTab('insights');
    };
    if(typeof requestIdleCallback==='function')requestIdleCallback(load,{timeout:10000});else load();
  },INSIGHTS_PRELOAD_DELAY_MS);
}
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
let appearanceShiftTimer=0;
function beginAppearanceShift(){
  // Fallback for engines without View Transitions: crossfade colour roles
  // (see core.css APPEARANCE SHIFT).
  const root=document.documentElement;
  root.setAttribute('data-sd-appearance-shift','');
  clearTimeout(appearanceShiftTimer);
  appearanceShiftTimer=setTimeout(()=>root.removeAttribute('data-sd-appearance-shift'),520);
}
function runAppearanceChange(origin,change){
  // The one native View Transition boundary. Appearance changes are
  // synchronous, so the snapshot never waits on storage, plugins or layout
  // work; the new appearance is revealed from the control that chose it.
  const reduce=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if(reduce||document.visibilityState!=='visible'){change();return;}
  if(typeof document.startViewTransition!=='function'){beginAppearanceShift();change();return;}
  const root=document.documentElement;
  const rect=origin&&origin.getBoundingClientRect?origin.getBoundingClientRect():null;
  const x=rect?rect.left+rect.width/2:window.innerWidth/2,y=rect?rect.top+rect.height/2:window.innerHeight/2;
  const radius=Math.hypot(Math.max(x,window.innerWidth-x),Math.max(y,window.innerHeight-y));
  root.style.setProperty('--sd-reveal-x',`${Math.round(x)}px`);
  root.style.setProperty('--sd-reveal-y',`${Math.round(y)}px`);
  root.style.setProperty('--sd-reveal-radius',`${Math.ceil(radius)}px`);
  root.setAttribute('data-sd-appearance-reveal','');
  let transition=null;
  try{transition=document.startViewTransition(()=>{change();});}
  catch(error){root.removeAttribute('data-sd-appearance-reveal');change();return;}
  const settle=()=>{root.removeAttribute('data-sd-appearance-reveal');['--sd-reveal-x','--sd-reveal-y','--sd-reveal-radius'].forEach(name=>root.style.removeProperty(name));};
  transition.finished.then(settle,settle);
  transition.ready.catch(()=>{});
}
function renderThemeControls(){
  const controls=document.getElementById('theme-controls');
  if(!controls)return;
  const shouldExpose=THEME_IDS.length>1;
  controls.hidden=!shouldExpose;
  if(!shouldExpose){controls.replaceChildren();return;}
  const label=document.createElement('span');
  label.className='theme-controls-label ui-label';
  label.textContent='Theme';
  const active=PRESENTATION_KERNEL.activeThemeId();
  const buttons=THEME_IDS.map(id=>{
    const definition=THEME_DEFINITIONS[id];
    const button=document.createElement('button');
    button.className='theme-btn';
    button.type='button';
    button.dataset.action='set-theme';
    button.dataset.themeId=id;
    button.textContent=definition.label;
    button.setAttribute('aria-pressed',id===active?'true':'false');
    return button;
  });
  controls.replaceChildren(label,...buttons);
}
function applyTheme(themeId,{persist=false,restoreFocus=false}={}){
  const clean=PRESENTATION_KERNEL.switchTheme(themeId,{persist:false});
  if(persist)persistProtectedPreferences({theme:clean});
  renderThemeControls();
  if(restoreFocus){
    const selected=[...document.querySelectorAll('.theme-btn[data-theme-id]')].find(button=>button.dataset.themeId===clean)||null;
    if(selected)selected.focus();
  }
  return clean;
}
function setTheme(themeId,{restoreFocus=false,origin=null}={}){
  if(!requirePrimaryTab(null,'change appearance settings'))return PRESENTATION_KERNEL.activeThemeId();
  const clean=PRESENTATION_KERNEL.normalizeThemeId(themeId);
  if(clean===PRESENTATION_KERNEL.activeThemeId())return applyTheme(clean,{persist:true,restoreFocus});
  runAppearanceChange(origin,()=>applyTheme(clean,{persist:true,restoreFocus}));
  return clean;
}
function handleThemeSelection(ev){
  const control=ev.target.closest('[data-theme-id]');
  if(control)setTheme(control.dataset.themeId,{restoreFocus:true,origin:control});
}
function renderPresentationControls(){
  const controls=document.getElementById('presentation-controls');
  if(!controls)return;
  const profiles=PRESENTATION_KERNEL.listPresentations();
  const shouldExpose=profiles.length>1;
  controls.hidden=!shouldExpose;
  if(!shouldExpose){controls.replaceChildren();return;}
  const label=document.createElement('span');
  label.className='presentation-controls-label ui-label';
  label.textContent='Skin';
  const active=PRESENTATION_KERNEL.activePresentationId();
  const buttons=profiles.map(profile=>{
    const button=document.createElement('button');
    button.className='presentation-btn';
    button.type='button';
    button.dataset.action='set-presentation';
    button.dataset.presentationId=profile.id;
    button.textContent=profile.label;
    button.setAttribute('aria-pressed',profile.id===active?'true':'false');
    return button;
  });
  controls.replaceChildren(label,...buttons);
}
function applyPresentation(presentationId,{persist=false,restoreFocus=false}={}){
  const clean=PRESENTATION_KERNEL.switchPresentation(presentationId,{persist:false});
  if(persist)persistProtectedPreferences({presentation:clean});
  renderPresentationControls();
  if(restoreFocus){
    const selected=[...document.querySelectorAll('.presentation-btn[data-presentation-id]')].find(button=>button.dataset.presentationId===clean)||null;
    if(selected)selected.focus();
  }
  return clean;
}
function setPresentation(presentationId,{restoreFocus=false,origin=null}={}){
  if(!requirePrimaryTab(null,'change appearance settings'))return PRESENTATION_KERNEL.activePresentationId();
  const clean=PRESENTATION_KERNEL.normalizePresentationId(presentationId);
  if(clean===PRESENTATION_KERNEL.activePresentationId())return applyPresentation(clean,{persist:true,restoreFocus});
  runAppearanceChange(origin,()=>applyPresentation(clean,{persist:true,restoreFocus}));
  return clean;
}
function registerPresentationPack(definition){
  const accepted=PRESENTATION_KERNEL.registerPresentation(definition);
  if(accepted)renderPresentationControls();
  return accepted;
}
function handlePresentationSelection(ev){
  const control=ev.target.closest('[data-presentation-id]');
  if(control)setPresentation(control.dataset.presentationId,{restoreFocus:true,origin:control});
}
const FONT_SCALE_STEPS=Object.freeze([0.95,1,1.08,1.16]);
function normalizeFontScale(value){
  const n=Number(value);
  if(!Number.isFinite(n))return 1;
  return FONT_SCALE_STEPS.reduce((best,step)=>Math.abs(step-n)<Math.abs(best-n)?step:best,1);
}
function readFontScale(){
  if(protectedPreferencesHydrated)return normalizeFontScale(protectedPreferencesState.fontScale??1);
  return normalizeFontScale(AppData.local.getText(STORAGE_KEYS.fontScale,'1'));
}
function applyFontScale(scale){
  const clean=normalizeFontScale(scale);
  const percent=Math.round(clean*1000)/10;
  document.documentElement.style.fontSize=`${percent}%`;
  document.documentElement.dataset.typeScale=String(clean);
  document.documentElement.dataset.fontScale=String(clean);
  document.querySelectorAll('.type-btn[data-action^="font-"]').forEach(btn=>{
    const action=btn.dataset.action;
    btn.setAttribute('aria-pressed',action==='font-reset'&&clean===1?'true':'false');
  });
  return clean;
}
function setFontScale(scale){
  const clean=applyFontScale(scale);
  persistProtectedPreferences({fontScale:clean});
}
function stepFontScale(delta){
  const current=applyFontScale(readFontScale());
  const idx=FONT_SCALE_STEPS.indexOf(current);
  const next=FONT_SCALE_STEPS[Math.min(FONT_SCALE_STEPS.length-1,Math.max(0,idx+delta))];
  setFontScale(next);
}
let displayToolsPopover=null;
function toggleDisplayTools(){
  const menu=document.getElementById('display-tools-menu'),trigger=document.getElementById('display-tools-trigger');
  if(!menu||!trigger)return;
  displayToolsPopover??=RichTextApi.createAnchoredPopover(menu,{align:'end',side:'top'});
  if(menu.hidden)displayToolsPopover.show(trigger);else displayToolsPopover.hide();
}
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
async function quiesceManagedRecoveryRuntime(operation){
  if(typeof operation!=='function')throw new TypeError('Managed recovery quiescence requires an operation.');
  const outer=managedRecoverySessionQuiescenceDepth===0;
  managedRecoverySessionQuiescenceDepth+=1;
  if(outer){cancelPendingLiveDraftSave();if(managedRecoveryTimerFrozenSinceMs===null)managedRecoveryTimerFrozenSinceMs=DecisionClock.nowMs();TimerEngine.stopExecution();}
  try{return await RichTextRuntime.quiesce(operation);}
  finally{
    managedRecoverySessionQuiescenceDepth=Math.max(0,managedRecoverySessionQuiescenceDepth-1);
    if(outer&&managedRecoverySessionQuiescenceDepth===0)void AppMutationCoordinator.settled().then(()=>{
      if(managedRecoverySessionQuiesced()||AppMutationCoordinator.status().active)return;
      const frozenSinceMs=managedRecoveryTimerFrozenSinceMs;managedRecoveryTimerFrozenSinceMs=null;
      if(SessionHandoffRuntime?.frozen())return;
       try{TimerEngine.resumeAfterPrimaryRestore({frozenSinceMs});}catch(error){AppDiagnostics.capture('managed-recovery.resume-timer',error,'warn');}
    });
  }
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
    recoveryWorkActive:()=>AppMutationCoordinator?.status().active==='managed-recovery',
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
async function retainedBackupFileNames(){
  const payload=await JournalAppMeta.read('restoreJournalPayload');
  const integrity=await BackupAppMeta.read('repositoryIntegrityScrub'),names=payload?.backupFile?.name?[payload.backupFile.name]:[];
  for(const target of Object.values(integrity?.locations||{}))for(const part of [target?.partial?.stored,target?.partial?.plain])if(part?.name)names.push(part.name);
  return names;
}
const BackupFiles=ExportsModule.createFileStore({storage:navigator.storage,locks:navigator.locks,root:ProfileScope.scoped('@@SD_BACKUP_FILES_OPFS_DIRECTORY@@'),retained:retainedBackupFileNames,isAvailable:()=>upkeepBlocker()||(navigator.storage?.getDirectory&&navigator.locks?.request?true:'storage-unavailable'),onError:error=>AppDiagnostics.capture('backup.file-cleanup',error,'warn')});
let fileProcessingNotice=null;
const Exports=ExportsModule.createCoordinator({
  createWorker:()=>new Worker(trustedAssetURL('@@SD_EXPORT_WORKER_FILENAME@@'),{name:'study-director-exports'}),window,document,files:BackupFiles,
  onState:state=>{renderFileBackup();if(state.fileBusy){if(!fileProcessingNotice)fileProcessingNotice=NoticeCoordinator.presentation('file-processing').begin({id:'worker',surfaceId:'file-processing-status',foreground:false,announce:false,title:'File processing'});fileProcessingNotice.update({message:state.phase,progress:{stage:state.phase}});}else{fileProcessingNotice?.resolve();fileProcessingNotice=null;const status=document.getElementById('file-processing-status');if(status)status.textContent='';}}
});
let backupProtectionReady=false;
function backupBackgroundAvailability(){return backgroundBlocker()||(backupProtectionReady?true:'locked');}
function setBackupProtectionSurfaceError(error){
  const hint=document.getElementById('backup-protection-hint');if(!hint)return;
  hint.hidden=false;NoticeCoordinator.emit({source:'backup-protection',id:'settings',surfaceId:'backup-protection-hint',surface:'inline',severity:'error',lifecycle:'failed',cue:'none',message:clampText(String(error&&error.message||error||'Backup encryption could not be updated.'),APP_LIMITS.maxStatusMessageChars)});
}
const BackupProtection=ExportsModule.createProtection({processing:Exports,storage:{read:key=>{if(String(key)!==APP_META_KEYS.backupProtection)throw new TypeError('Backup protection metadata identity is invalid.');return ExportsAppMeta.read('backupProtection');},write:(key,value,options)=>{if(String(key)!==APP_META_KEYS.backupProtection)throw new TypeError('Backup protection metadata identity is invalid.');return mutateBackupProtection(value,options);},remove:(key,options)=>{if(String(key)!==APP_META_KEYS.backupProtection)throw new TypeError('Backup protection metadata identity is invalid.');return mutateBackupProtection(null,options);}},interactions:Interactions,settingKey:APP_META_KEYS.backupProtection,remember:()=>Profiles.list().length<2,canMutate:()=>appCanMutate(),issueToken:()=>AppOwnership.issueWriteToken('change backup encryption'),assertToken:token=>AppOwnership.assertWriteToken(token,'change backup encryption'),onState:state=>{
  NoticeCoordinator.resolveEvent('backup-protection','settings');
  const ready=!state.enabled||state.unlocked,restored=ready&&!backupProtectionReady;backupProtectionReady=ready;
  // Rows say when automatic backups wait for the password; redraw them on every change.
  if(StartupLifecycle.status().fullyInitialized){if(restored)wakeBackgroundOperations('encryption-unlocked');BackupProviderRuntime.refresh();}
  const label=document.getElementById('backup-protection-status');if(label)label.textContent=state.enabled?(state.unlocked?'On':'Not entered yet'):'Off';
  const button=document.getElementById('manage-backup-protection');if(button)button.textContent=state.enabled?(state.unlocked?'Change or remove…':'Enter password…'):'Set password…';
  const hint=document.getElementById('backup-protection-hint');if(hint){hint.className='backup-inline-note ui-helper';hint.textContent='Sync and encrypted backups wait until this profile’s backup password is entered.';hint.hidden=!state.enabled||state.unlocked;}
  if(StartupLifecycle.status().fullyInitialized)renderProfile();
}});
window.addEventListener('pagehide',()=>BackupProtection.lock());
window.addEventListener('pageshow',event=>{if(event.persisted)void BackupProtection.refresh().catch(setBackupProtectionSurfaceError);});
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
  isActive:()=>document.getElementById('pane-library').classList.contains('on')&&!document.getElementById('library-data').hidden,cleanup:()=>scheduleRichTextAssetMaintenance(),renderReference:(container,source)=>renderRichTextContent(container,source.value,'',source.label),sources:options=>AttachmentReferences.sources(options),integrityIssue:id=>attachmentIntegrityIssues.get(String(id||''))||null,destinations:()=>LibraryView.noteDestinations(),settle:settleAttachmentWriters,openLibrary:()=>{LibraryView.showSection('data');return goTab('library',{source:'attachment-library'});},
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

let attachmentIntegrityView=null,repositoryIntegrityView=null;const repositoryIntegrityBoundScopes=Object.create(null);
// Verification, one location per row: a plain headline for what is happening
// now or the last result, then when the last full check finished. A running
// check reports its progress live (integrityLive); a Recheck answers at once.
const integrityLive=Object.create(null),integrityRecheckAsked=Object.create(null),integrityRowError=Object.create(null);
function integrityStatus(target,{shallow=false,running=false,live=null}={}){
  const value=target||{},completed=value.completedAt||value.checkedAt||'',files=shallow?'attachments':'backup files';
  const between=!!(value.partial||value.progress||value.cursor||value.cycleStartedAt),damaged=value.quarantinedObjectIds?.length||0;
  const count=live&&Number.isFinite(live.total)&&live.total>0?` ${Math.min(live.done||0,live.total)} of ${live.total} ${files}`:'';
  const head=running?`Checking…${count}`
    :value.blockedReason==='locked'?'Paused until backup encryption is unlocked'
    :value.blockedReason==='preempted'?'Paused while another backup task runs; continues by itself'
    :value.lastOutcome==='unavailable'?(value.recheck?'Recheck could not run this time; it will try again':'Could not check this time; it will try again')
    :value.recheck?(value.blockedReason==='corrupt'?`Recheck continuing; some ${files} are still damaged`:'Recheck requested; starts in a moment')
    :damaged?`${damaged} damaged backup file${damaged===1?'':'s'}; the next backup writes fresh copies`
    :between?`Checking in small steps${count?`;${count} so far`:''}; continues by itself`
    :completed?(shallow?'All attachments present':`All ${files} intact`)
    :'Not checked yet';
  const parts=[completed?`Last full check: ${new Date(completed).toLocaleString()}`:'No full check yet'];
  if(value.partial)parts.push(`${Math.floor(value.partial.stored.offset/1048576)} of ${Math.ceil(value.partial.storedBytes/1048576)} MB of a large file read${value.partial.phase==='plain'?'; checking its decrypted content':''}`);
  else if(value.progress)parts.push(`${value.progress.cursor} of ${value.progress.total} records`);
  if(damaged&&value.recheck)parts.push(`${damaged} damaged`);
  if(shallow)parts.push('File contents are not checked.');
  return Object.freeze({head,detail:parts.join(' · ')});
}
// Kept for diagnostics-style callers: the headline and its detail in one line.
function integrityStatusText(target,options={}){const status=integrityStatus(target,options);return status.head+' · '+status.detail;}
function renderIntegrityStatuses(){
  let jobs=[];try{jobs=BackupProviderRuntime.backgroundStatus();}catch{jobs=[];}
  for(const [id,label,location] of [['attachment-verification-status','Attachment presence and size',''],['device-verification-status','Device Folder','device-folder'],['drive-verification-status','Google Drive','google-drive']]){
    const element=document.getElementById(id);if(!element)continue;
    const value=location?repositoryIntegrityView?.locations?.[location]:attachmentIntegrityView,bound=!location||value?.repositoryScope&&repositoryIntegrityBoundScopes[location]===value.repositoryScope;
    const running=!!location&&jobs.some(row=>row.job===location+' integrity'&&row.running===true);
    if(location&&value?.recheck)integrityRecheckAsked[location]=false;
    const status=bound?integrityStatus(value,{shallow:!location,running,live:location?integrityLive[location]:null}):Object.freeze({head:'Not connected',detail:'Connect it to check its backups.'});
    const error=location?integrityRowError[location]||'':'';
    const name=document.createElement('strong'),head=document.createElement('span'),detail=document.createElement('span');
    name.textContent=label+': ';head.className='verification-head';head.textContent=error||status.head;
    detail.className='verification-detail';detail.textContent=' '+status.detail;
    element.classList.toggle('verification-error',!!error);element.replaceChildren(name,head,detail);
    // Recheck is offered only for a location this device is connected to,
    // and says it is working until the recheck finishes.
    const recheck=location&&document.getElementById('recheck-'+location);
    if(recheck){
      const busy=bound&&(integrityRecheckAsked[location]===true||value?.recheck===true);
      recheck.hidden=!bound;recheck.disabled=busy;recheck.setAttribute('aria-busy',busy?'true':'false');
      const text=busy?'Rechecking…':`Recheck ${label}`;if(recheck.textContent!==text)recheck.textContent=text;
    }
  }
}
async function requestRepositoryIntegrityRecheck(target){
  const label=target==='device-folder'?'Device Folder':'Google Drive';
  integrityRowError[target]='';integrityRecheckAsked[target]=true;renderIntegrityStatuses();
  try{
    if(!appCanMutate())throw new Error('Use the primary tab to request backup verification.');
    if(!BackupProviderRuntime.locationStatus(target)?.connected)throw new Error(`Connect ${label} before rechecking it.`);
    const bound=await readRepositoryIntegrityTarget(target);
    await mutateRepositoryIntegrityTarget(target,current=>{if(current.repositoryScope!==bound.repositoryScope)throw repositoryIntegrityChanged();return {...current,requestId:crypto.randomUUID(),recheck:true,recheckCursor:'',cursor:'',scanId:'',partial:null,cycleStartedAt:new Date().toISOString()};});
    BackupProviderRuntime.requestIntegrity(target);
    renderIntegrityStatuses();return true;
  }catch(error){
    integrityRecheckAsked[target]=false;integrityRowError[target]=`Recheck did not start: ${String(error?.message||error)}`;renderIntegrityStatuses();
    AppDiagnostics.capture('backup.integrity-recheck',error,'warn');return false;
  }
}
const ATTACHMENT_INTEGRITY_META_KEY=APP_META_KEYS.attachmentIntegrityAudit;
const ATTACHMENT_INTEGRITY_INTERVAL_MS=24*60*60*1000;
const ATTACHMENT_INTEGRITY_RETRY_MS=10*60*1000;
const AttachmentIntegrityJob=OperationLifecycle.createJob({
  environment:{now:()=>Date.now(),setTimeout,clearTimeout},minDelayMs:1000,retryMs:30*60*1000,
  isAvailable:()=>upkeepBlocker()||(AttachmentStorage.supported()?true:'storage-unavailable'),
  capture:error=>AppDiagnostics.capture('attachments.integrity-lifecycle',error,'warn'),execute:runAttachmentIntegrityAttempt
});
function normalizeAttachmentIntegrityIssue(value){
  const kind=String(value?.kind||'');
  if(!['missing-file','size-mismatch','metadata-invalid','missing-metadata'].includes(kind))return null;
  const rawId=String(value?.id||''),id=AttachmentsModule.validId(rawId)?rawId:'';
  return Object.freeze({id,kind,expectedSize:Number.isSafeInteger(value?.expectedSize)?value.expectedSize:null,actualSize:Number.isSafeInteger(value?.actualSize)?value.actualSize:null});
}
function normalizeAttachmentIntegrityState(value){
  const issues=Array.isArray(value?.issues)?value.issues.map(normalizeAttachmentIntegrityIssue).filter(Boolean):[];
  const checkedAt=typeof value?.checkedAt==='string'&&Number.isFinite(Date.parse(value.checkedAt))?new Date(value.checkedAt).toISOString():'';
  const raw=value?.progress,progress=raw&&/^[a-f0-9]{64}$/u.test(raw.scanId)&&Number.isSafeInteger(raw.cursor)&&raw.cursor>=0&&Number.isSafeInteger(raw.checked)&&raw.checked>=0&&Number.isSafeInteger(raw.total)&&raw.total>=raw.cursor?Object.freeze({scanId:raw.scanId,cursor:raw.cursor,checked:raw.checked,total:raw.total,issues:Object.freeze((Array.isArray(raw.issues)?raw.issues:[]).map(normalizeAttachmentIntegrityIssue).filter(Boolean))}):null;
  const attemptedAt=typeof value?.attemptedAt==='string'&&Number.isFinite(Date.parse(value.attemptedAt))?new Date(value.attemptedAt).toISOString():'';
  const lastOutcome=['completed','yielded','unavailable','skipped'].includes(value?.lastOutcome)?value.lastOutcome:'';
  return Object.freeze({version:2,checkedAt,attemptedAt,lastOutcome,progress,issues:Object.freeze(issues)});
}
function attachmentIntegrityIssueLabel(issue){
  return issue?.kind==='missing-file'?'stored file is missing':issue?.kind==='size-mismatch'?'stored file size does not match':issue?.kind==='metadata-invalid'?'metadata is unreadable':issue?.kind==='missing-metadata'?'library record is missing':'storage issue';
}
function attachmentIntegrityWarning(state){
  const issues=state?.issues||[];if(!issues.length)return '';
  const first=issues[0];
  if(issues.length===1){
    const subject=first.id?`attachment ${first.id.slice(0,18)}…`:'an attachment';
    return `Attachment storage needs attention · ${subject}: ${attachmentIntegrityIssueLabel(first)}. Open Library → Data → Files.`;
  }
  return `Attachment storage needs attention · ${issues.length} attachment issues detected. Open Library → Data → Files.`;
}
function applyAttachmentIntegrityState(state){
  const normalized=normalizeAttachmentIntegrityState(state);
  attachmentIntegrityView=normalized;renderIntegrityStatuses();
  attachmentIntegrityIssues=new Map(normalized.issues.filter(issue=>issue.id).map(issue=>[issue.id,issue]));
  const warning=attachmentIntegrityWarning(normalized);
  if(warning)markStorageHealthError('attachmentIntegrity',warning,{level:'warn'});else markStorageHealthOk('attachmentIntegrity');
  invalidateAttachmentLibrary();
  return normalized;
}
function scheduleAttachmentIntegrityAudit(delay=15000,trigger='scheduled'){
  return AttachmentIntegrityJob.schedule(delay,trigger,'earliest');
}
function attachmentIntegrityDeferredError(message='Attachment integrity audit deferred.',code='ATTACHMENT_INTEGRITY_DEFERRED'){const error=new Error(message);error.code=code;return error;}
async function runAttachmentIntegrityAttempt({trigger,nextEligibleAt}){
  let traceId='',priorState=null;return (async()=>{
    const prior=normalizeAttachmentIntegrityState(await readHostAppMetaValue(ATTACHMENT_INTEGRITY_META_KEY));priorState=prior;
    if(!AttachmentStorage.supported()){applyAttachmentIntegrityState(prior);return Object.freeze({status:'skipped',reason:'storage-unavailable'});}
    const last=Date.parse(prior.checkedAt||''),now=Date.now();
    if(!prior.progress&&Number.isFinite(last)&&now-last<ATTACHMENT_INTEGRITY_INTERVAL_MS){applyAttachmentIntegrityState(prior);scheduleAttachmentIntegrityAudit(ATTACHMENT_INTEGRITY_INTERVAL_MS-(now-last)+1000);return Object.freeze({status:'skipped',reason:'not-due'});}
    if(!appCanMutate()){applyAttachmentIntegrityState(prior);return Object.freeze({status:'skipped',reason:'not-primary'});}
    if(backgroundMaintenanceForegroundBusy())return Object.freeze({status:'skipped',reason:'foreground-busy'});
    traceId=BackupOperationDiagnostics.start('attachment-integrity','Attachment storage',{background:true,trigger,nextEligibleAt,actionable:true});BackupOperationDiagnostics.mark('attachment-integrity-eligibility',{trigger,nextEligibleAt,actionable:true},traceId);
    const check=()=>{if(!appCanMutate())throw attachmentIntegrityDeferredError('Attachment integrity audit is awaiting primary-tab control.','ATTACHMENT_INTEGRITY_NOT_PRIMARY');if(backgroundMaintenanceForegroundBusy())throw attachmentIntegrityDeferredError();};
    await BackgroundTasks.yieldTask({priority:'background'});check();
    const referenceRevision=richAssetReferenceRevision,dataset=await AppData.dailyRecords.datasetRevision();
    const references=await AttachmentReferences.sources({includeLive:false,priority:'background',referencesOnly:true});
    if(Object.prototype.toString.call(references)!=='[object Set]')throw new Error('Attachment reference inventory could not be verified.');
    const audit=await AttachmentStorage.shallowAudit([...references].filter(AttachmentsModule.validId),{
      progress:prior.progress,workMs:5000,maxEntries:128,shouldYield:BackgroundTasks.budget(),yieldTask:()=>BackgroundTasks.yieldTask({priority:'background'}),check
    });
    check();if(referenceRevision!==richAssetReferenceRevision||dataset!==await AppData.dailyRecords.datasetRevision())throw attachmentIntegrityDeferredError();
    const complete=audit.complete!==false,state=normalizeAttachmentIntegrityState({...prior,checkedAt:complete?new Date().toISOString():prior.checkedAt,attemptedAt:new Date().toISOString(),lastOutcome:complete?'completed':'yielded',progress:complete?null:audit.progress,issues:complete?audit.issues:prior.issues});
    await writeHostAppMetaValue(ATTACHMENT_INTEGRITY_META_KEY,state,{strict:true});
    applyAttachmentIntegrityState(state);scheduleAttachmentIntegrityAudit(complete?ATTACHMENT_INTEGRITY_INTERVAL_MS:2000,complete?'interval':'continue');
    BackupOperationDiagnostics.finish({status:complete?'completed':'yielded',checked:Number(audit.checked)||0,issues:state.issues.length},traceId);return Object.freeze({status:complete?'completed':'yielded',checked:audit.checked,issues:state.issues.length});
  })().catch(async error=>{
    if(error.attachmentAuditProgress&&priorState&&appCanMutate()){try{const state=normalizeAttachmentIntegrityState({...priorState,progress:error.attachmentAuditProgress,attemptedAt:new Date().toISOString(),lastOutcome:'yielded'});await writeHostAppMetaValue(ATTACHMENT_INTEGRITY_META_KEY,state,{strict:true});applyAttachmentIntegrityState(state);}catch(writeError){error=writeError;}}
    if(error?.code==='ATTACHMENT_INTEGRITY_NOT_PRIMARY'){if(traceId)BackupOperationDiagnostics.finish({status:'skipped',reason:'not-primary'},traceId);return Object.freeze({status:'skipped',reason:'not-primary'});}
    if(error?.code==='ATTACHMENT_INTEGRITY_DEFERRED'){if(traceId)BackupOperationDiagnostics.finish({status:'skipped',reason:'deferred'},traceId);scheduleAttachmentIntegrityAudit(backgroundMaintenanceForegroundBusy()?0:ATTACHMENT_INTEGRITY_RETRY_MS,'deferred');return Object.freeze({status:'skipped',reason:'deferred'});}
    {attachmentIntegrityView=normalizeAttachmentIntegrityState({...priorState||attachmentIntegrityView||{},attemptedAt:new Date().toISOString(),lastOutcome:'unavailable'});renderIntegrityStatuses();}if(traceId)BackupOperationDiagnostics.fail(error,{background:true,status:'unavailable'},traceId);AppDiagnostics.capture('attachments.integrity-audit',error,'warn');markStorageHealthError('attachmentIntegrity','Attachment verification is unavailable. Previous findings are retained; Study Director will retry.',{level:'warn'});scheduleAttachmentIntegrityAudit(30*60*1000,'error');return Object.freeze({status:'unavailable',reason:error?.message||String(error)});
  });
}
async function installAttachmentIntegrityAudit(){
  let state;
  try{state=normalizeAttachmentIntegrityState(await readHostAppMetaValue(ATTACHMENT_INTEGRITY_META_KEY));}
  catch(error){AppDiagnostics.capture('attachments.integrity-state-read',error,'warn');markStorageHealthError('attachmentIntegrity','Attachment verification state is unavailable. Study Director will retry.',{level:'warn'});scheduleAttachmentIntegrityAudit(30*60*1000,'state-read-failed');return null;}
  applyAttachmentIntegrityState(state);
  if(!AttachmentStorage.supported())return state;
  const last=Date.parse(state.checkedAt||''),age=Number.isFinite(last)?Math.max(0,Date.now()-last):ATTACHMENT_INTEGRITY_INTERVAL_MS;
  scheduleAttachmentIntegrityAudit(state.progress||age>=ATTACHMENT_INTEGRITY_INTERVAL_MS?15000:ATTACHMENT_INTEGRITY_INTERVAL_MS-age+1000);
  return state;
}

const REPOSITORY_INTEGRITY_BATCH_BYTES=256*1024*1024;
const REPOSITORY_INTEGRITY_BATCH_OBJECTS=4;
function normalizeRepositoryIntegrityTarget(value){
  const iso=key=>typeof value?.[key]==='string'&&Number.isFinite(Date.parse(value[key]))?new Date(value[key]).toISOString():'';
  const cursor=/^obj_[a-f0-9]{32}$/u.test(String(value?.cursor||''))?String(value.cursor):'';
  const seen=new Set(),quarantinedObjectIds=[];for(const raw of Array.isArray(value?.quarantinedObjectIds)?value.quarantinedObjectIds:[]){const id=String(raw||'');if(!/^obj_[a-f0-9]{32}$/u.test(id)||seen.has(id))continue;seen.add(id);quarantinedObjectIds.push(id);}
  const repositoryScope=typeof value?.repositoryScope==='string'&&value.repositoryScope.length<=320?value.repositoryScope:'';
  const scanId=/^[a-f0-9]{64}$/u.test(String(value?.scanId||''))?String(value.scanId):'';
  const partial=IntegrityContinuationModule.normalize(value?.partial),recheck=value?.recheck===true,requestId=/^[a-f0-9-]{36}$/u.test(value?.requestId||'')?value.requestId:'';
  const recheckCursor=recheck&&/^obj_[a-f0-9]{32}$/u.test(String(value?.recheckCursor||''))?String(value.recheckCursor):'';
  const lastOutcome=['completed','yielded','failed','unavailable','skipped'].includes(value?.lastOutcome)?value.lastOutcome:'',blockedReason=['locked','budget','preempted','unavailable','permission','corrupt'].includes(value?.blockedReason)?value.blockedReason:'';
  const history=Object.freeze((Array.isArray(value?.history)?value.history:[]).slice(-8).filter(row=>row&&Number.isFinite(Date.parse(row.at))&&['completed','yielded','failed','unavailable','skipped'].includes(row.outcome)).map(row=>Object.freeze({at:new Date(row.at).toISOString(),outcome:row.outcome,complete:row.complete===true})));
  return Object.freeze({repositoryScope,scanId,partial,recheck,recheckCursor,requestId,blockedReason,completedAt:iso('completedAt'),cycleStartedAt:iso('cycleStartedAt'),cursor,failedAt:iso('failedAt'),attemptedAt:iso('attemptedAt'),lastOutcome,history,quarantinedObjectIds:Object.freeze(quarantinedObjectIds)});
}
const INTEGRITY_LOCATION_ID=/^[a-z][a-z0-9-]{0,40}$/u;
function normalizeRepositoryIntegrityState(value){
  const locations={};
  for(const [id,target] of Object.entries(value?.locations&&typeof value.locations==='object'?value.locations:{}).slice(0,8))if(INTEGRITY_LOCATION_ID.test(id))locations[id]=normalizeRepositoryIntegrityTarget(target);
  return Object.freeze({version:7,locations:Object.freeze(locations)});
}

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
// 5.2: versions a sync kept where two devices changed the same thing. Their
// count shows in Library → Data and the sidebar; a note with one carries a
// quiet "Needs review" mark. Reviewing never opens by itself.
const KeptVersions=(()=>{
  let count=0,notes=new Set(),generation=0,seen=null;
  async function refresh(){
    const token=++generation;let open;
    try{
      open=(await AppData.pendingReviews.list()).filter(review=>!review.resolvedAt);
      if(open.length&&appCanMutate()&&!BackupController.status().busy){
        // Resolve only verified, now-identical canonical alternatives. The
        // Backup controller writes and reads back replicated tombstones;
        // this view still reads the actual resulting count.
        try{await BackupController.resolveConvergedKeptVersions();}
        catch(error){AppDiagnostics.capture('kept-versions.convergence',error,'warn');}
        open=(await AppData.pendingReviews.list()).filter(review=>!review.resolvedAt);
      }
    }catch(error){AppDiagnostics.capture('kept-versions.refresh',error,'warn');return false;}
    if(token!==generation)return false;
    const next=new Set(open.filter(review=>review.subject==='note').map(review=>review.ref)),notesChanged=[...next].sort().join('|')!==[...notes].sort().join('|');
    // Kept versions pop up once, when they first appear; those already here
    // at start-up do not.
    const fresh=seen?open.filter(review=>!seen.has(review.id)):[];
    seen=new Set([...(seen||[]),...open.map(review=>review.id)]);
    count=open.length;notes=next;renderKeptVersions();renderDriveBackup();
    if(notesChanged)LibraryView.refreshNotes();
    if(!count)NoticeCoordinator.resolveEvent('sync','kept-new');
    else if(fresh.length)announce(fresh);
    return true;
  }
  function announce(fresh){
    // The Connect card reports what its sync kept, and the pop-up for a
    // session that moved to another device says this device's was kept.
    if(driveConnectCard)return;
    if(Date.now()-sessionYieldedAt<60000&&fresh.every(review=>review.subject==='session'))return;
    Interactions.notify({source:'sync',key:'kept-new',kind:'warning',tier:'news',title:'Kept for review',
      message:`${count===1?'One alternative needs':`${count} alternatives need`} review because their differences could not be safely settled. Verified matching alternatives are cleared automatically; choose what to keep when ready.`,
      action:{label:'Review',opens:true,run:()=>void review()}});
  }
  async function review(ref=''){
    try{
      const result=await BackupController.reviewKeptVersions({ref:String(ref||'')});
      if(result.cancelled)return result;
      const parts=[result.reviewed?`${result.reviewed} reviewed`:'',result.changed?`${result.changed} changed while you chose; review ${result.changed===1?'it':'them'} again`:'',result.left?`${result.left} still waiting${!result.reviewed&&!result.changed?' (a kept session waits until this session ends)':''}`:''].filter(Boolean);
      Interactions.notify({source:'sync',key:'kept-review',title:'Kept versions',message:`${parts.join(' · ')||'Nothing to review'}.`});
      return result;
    }catch(error){
      AppDiagnostics.capture('kept-versions.review',error,'warn');
      Interactions.notify({source:'sync',key:'kept-review',kind:'error',title:'Review not saved',message:error&&error.message||'Nothing was changed. Try again.'});
      return null;
    }finally{void refresh();}
  }
  return Object.freeze({refresh,review,count:()=>count,note:id=>notes.has(String(id||''))});
})();
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
function renderKeptVersions(){
  const row=document.getElementById('kept-versions'),text=document.getElementById('kept-versions-text'),count=KeptVersions.count();
  if(row)row.hidden=!count;
  if(text)text.textContent=`${count} retained alternative${count===1?' needs':'s need'} review. Only differences not proven safely equivalent are kept; open Kept Versions to choose the remaining values.`;
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

async function reconcileNotesThroughLifecycle(importedNotes,deletions=[]){
  return SessionLifecycle.run('reconciled-notes',{
    date:getReviewDate(),
  },()=>AppData.notes.reconcile(importedNotes,deletions));
}
async function restoreNotesSnapshotThroughLifecycle(snapshotNotes){
  return SessionLifecycle.run('restored-notes-snapshot',{
    date:getReviewDate(),
  },()=>AppData.notes.replace(snapshotNotes));
}
function restoreSessionStateThroughLifecycle(...args){return SessionActions.restoreSessionStateThroughLifecycle(...args);}
function verifyRestoredTimerRuntimeSemantics(...args){return SessionActions.verifyRestoredTimerRuntimeSemantics(...args);}
function verifyRestoredSessionRuntime(...args){return SessionActions.verifyRestoredSessionRuntime(...args);}

// Byte staging finishes before the single attachment metadata commit. Rollback
// replaces the catalogue; physical reclamation still waits for all readers.
async function importBackupAttachments(items,{signal,replace=false}={}){
  return AttachmentStorage.during(async()=>{
    const token=AppOwnership.issueWriteToken('restore attachments'),staged=[],rows=[],contents=new Map();
    const local=new Map((await AttachmentStorage.list()).map(row=>[row.hash+':'+row.size,row]));
    const check=()=>{AppOwnership.assertWriteToken(token,'restore attachments');if(signal?.aborted)throw Object.assign(new Error('Restore cancelled.'),{name:'AbortError'});};
    try{
      for(const item of items){
        check();const group=item.checksum+':'+item.size;let content=contents.get(group)||local.get(group);
        if(!content){
          const blob=await AttachmentsModule.identify(item.blob);
          if(blob.type!==item.mimeType)throw new Error('Backup attachment type does not match its bytes.');
          content=await AttachmentStorage.put(item.assetId,blob,{stage:true,token,signal,check});staged.push(content);
          if(content.hash!==item.checksum)throw new Error('Restored attachment failed stored-byte verification.');
        }
        contents.set(group,content);rows.push([item.assetId,{...content,type:item.mimeType,name:item.name,library:item.library}]);
      }
      check();await AttachmentStorage.publish(rows,token,check,{restoreLabels:true,replaceAll:replace});
      invalidateAttachmentLibrary();return rows.length;
    }catch(error){await AttachmentStorage.discard(staged).catch(()=>{});throw error;}
  });
}
function currentBackupSourceRevision(){
  const stored=AppData.local.getJson(STORAGE_KEYS.storageHealth,null),memory=readStorageHealth();let latest='',latestAt=NaN;
  for(const value of [stored&&stored.lastLocalSaveAt,memory.lastLocalSaveAt]){
    const revision=String(value||''),at=Date.parse(revision);
    if(Number.isFinite(at)&&(!Number.isFinite(latestAt)||at>latestAt)){latest=revision;latestAt=at;}
  }
  return latest;
}
async function fullBackupSnapshotRevision(){
  return JSON.stringify([await AppData.dailyRecords.datasetRevision(),await AppData.deletionRecovery.savedDays(),await AppData.deletionRecovery.notes(),await AppData.deletionRecovery.attachments(),richAssetReferenceRevision,await PlanData.exportData({flush:false}),document.getElementById('plan-input')?.value,await AttachmentStorage.list()]);
}
async function backupSnapshotRevision(options={}){
  if(options&&options.full===true||!backupFastFenceReady||!AppData.mutationEpoch.eligible())return fullBackupSnapshotRevision();
  try{
    const epoch=await AppData.mutationEpoch.read();
    if(!epoch)return fullBackupSnapshotRevision();
    return `study-director.fast-capture-fence.v1|${epoch.token}|${captureMutationGeneration}|${currentBackupSourceRevision()}`;
  }catch(error){AppDiagnostics.capture('backup.fast-capture-fence',error,'warn');return fullBackupSnapshotRevision();}
}
const NoteReconciliationUI=ReconciliationUIModule.createController(Object.freeze({ports:Object.freeze({
  configuration:Object.freeze({maxWords:APP_LIMITS.maxRichTextWords,maxBytes:APP_LIMITS.maxRichTextBytes}),
  richText:Object.freeze({mountRichTextEditor:RichTextApi.mountRichTextEditor,compareRichText:RichTextApi.compareRichText,mergeIncomingAdditions:RichTextApi.mergeIncomingAdditions,appendIncomingAdditions:RichTextApi.appendIncomingAdditions,mergeThreeWay:RichTextApi.mergeThreeWay}),
  assets:Object.freeze({get:assetId=>RichTextAssets.get(assetId)}),
  diagnostics:Object.freeze({capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level)}),
  view:Object.freeze({document,requestAnimationFrame:callback=>requestAnimationFrame(callback),cancelAnimationFrame:id=>cancelAnimationFrame(id)})
})}));
const BackupRuntime=BackupModule.createRuntime(Object.freeze({ports:Object.freeze({
  configuration:Object.freeze({
    appVersion:APP_VERSION,
    backupVersion:DATA_CONTRACT.schemas.Backup.version,
    starterSchedule:FACTORY_DEFAULTS.scheduleText,
    limits:Object.freeze({
      backupChunkItems:APP_LIMITS.backupChunkItems,
      backupMaxCompressedBytes:APP_LIMITS.backupMaxCompressedBytes,
      backupMaxFileBytes:APP_LIMITS.backupMaxFileBytes,
      backupMaxAssetDescriptors:APP_LIMITS.backupMaxAssetDescriptors,
      maxImportRecords:APP_LIMITS.maxImportRecords,
      maxNoteLinks:APP_LIMITS.maxNoteLinks,
      maxNotes:APP_LIMITS.maxNotes,
      maxPendingReviews:APP_LIMITS.maxPendingReviews
    })
  }),
  persistence:Object.freeze({
    activeSessionLoad:(retry=0,options={})=>AppData.activeSession.load(retry,options),
    activeSessionSave:(value,options)=>AppData.activeSession.save(value,options),
    activeSessionClear:()=>AppData.activeSession.clear(),
    activeSessionSettled:()=>AppData.activeSession.settled(),
    dailyRecordBackupDates:()=>AppData.dailyRecords.backupDates(),
    dailyRecordBackupMonth:(month,options)=>AppData.dailyRecords.backupMonth(month,options),
    dailyRecordDocuments:(dates,options)=>AppData.dailyRecords.documents(dates,options),
    dailyRecordImportBatches:(records,options)=>AppData.dailyRecords.importBatches(records,options),
    dailyRecordRemove:(date,options)=>AppData.dailyRecords.remove(date,options),
    dailyRecordTimestamp:value=>AppData.dailyRecords.timestamp(value),
    notesExportPayload:()=>AppData.notes.exportPayload(),
    notesReadFreshPayload:()=>AppData.notes.readFreshPayload(),
    notesReadFreshItems:keys=>AppData.notes.readFreshItems(keys),
    notesFlush:options=>AppData.notes.flush(options),
    notesNormalizePayload:value=>AppData.notes.normalizePayload(value),
    notesAlignByTitle:(value,deletedIds)=>AppData.notes.alignByTitle(value,deletedIds),
    notesTrashKey:key=>DailyRecordCodec.noteKeys.trash(key),
    notesFailure:()=>AppData.notes.failure(),
    restoreJournalPrepare:async value=>{
      const backupFile=await Exports.run('file.persist',{file:value.blob}),{blob,...metadata}=value;
      try{return await AppData.restoreJournal.prepare({...metadata,backupFile});}
      catch(error){
        // A failed/ambiguous commit must never discard the only rollback bytes.
        // Release an unused producer only after a fresh journal read proves
        // that no durable reference points to this file.
        try{
          const journal=await AppData.restoreJournal.read();
          if(journal?.payload?.backupFile?.name!==backupFile.name)await BackupFiles.release(backupFile.name);
        }catch(probeError){AppDiagnostics.capture('backup.restore-journal-orphan-check',probeError,'warn');}
        throw error;
      }
    },
    restoreJournalRead:async()=>{const journal=await AppData.restoreJournal.read();if(!journal)return null;const ref=journal.payload.backupFile;return ref?{...journal,payload:{...journal.payload,blob:await Exports.run('file.read',{ref})}}:journal;},
    restoreJournalMark:async(id,phase)=>{const marked=await AppData.restoreJournal.mark(id,phase);if(phase==='verified')settleStorageReset();return marked;},
    restoreJournalClear:async id=>{
      const journal=await AppData.restoreJournal.read();
      await AppData.restoreJournal.clear(id);
      // Once the durable journal is retired, failed scratch disposal must not
      // convert a verified restore into a failed restore/second rollback.
      if(journal?.payload.backupFile)try{await BackupFiles.release(journal.payload.backupFile.name);}
      catch(error){AppDiagnostics.capture('backup.restore-journal-file-release',error,'warn');}
    },
    personalSettle:async options=>{
      const backupCapture=options&&options.backupCapture===true;
      if(appCanMutate()&&await PlanDraftEditor.flush({backupCapture})===false)throw new Error('The current Plan draft could not be safely settled before backup.');
      await PlanData.settled({backupCapture});
      return true;
    },
    personalExport:options=>PlanData.exportData(options),
    personalImport:value=>PlanData.importData(value),
    personalVerify:value=>PlanData.verify(value),
    sourceRevision:()=>currentBackupSourceRevision(),
    snapshotRevision:options=>backupSnapshotRevision(options),
    storageGeneration:()=>IndexedDb.lifecycle().resets,
    canonicalMutationEpochRead:()=>AppData.mutationEpoch.read(),
    canonicalPreparationRebase:()=>AppData.mutationEpoch.rebasePreparation(),
    preparationUnitStamps:()=>AppData.preparationUnits.list(),
    preparationUnitReplace:units=>AppData.preparationUnits.replace(units),
    installationId:()=>AppData.provenance.installationId(),
    deletionRecoveryFlush:()=>AppData.deletionRecovery.flush(),
    deletionRecoverySavedDays:()=>AppData.deletionRecovery.savedDays(),
    deletionRecoveryReplaceSavedDays:values=>AppData.deletionRecovery.replaceSavedDays(values),
    deletionRecoveryNotes:()=>AppData.deletionRecovery.notes(),
    deletionRecoveryReplaceNotes:values=>AppData.deletionRecovery.replaceNotes(values),
    deletionRecoveryAttachments:()=>AppData.deletionRecovery.attachments(),
    deletionRecoveryReplaceAttachments:values=>AppData.deletionRecovery.replaceAttachments(values),
    deletionRecoveryClearAttachment:assetId=>AppData.deletionRecovery.clearAttachment(assetId),
    reconciliationBaseRead:()=>readReconciliationBase(),
    reconciliationBaseReadNotes:keys=>readReconciliationBaseNotes(keys),
    reconciliationBaseReadDayAncestry:(dates,checkpointId)=>readReconciliationBaseDayAncestry(dates,checkpointId),
    reconciliationBaseWrite:(checkpointId,spec)=>writeReconciliationBase(checkpointId,spec),
    pendingReviewsList:()=>AppData.pendingReviews.list(),
    pendingReviewsReadItems:ids=>AppData.pendingReviews.readItems(ids),
    pendingReviewsMerge:values=>AppData.pendingReviews.merge(values),
    pendingReviewsReplace:values=>AppData.pendingReviews.replace(values),
    pendingReviewsResolve:ids=>AppData.pendingReviews.resolve(ids)
  }),
  assets:Object.freeze({
    get:assetId=>AttachmentStorage.get(assetId),
    put:(assetId,blob)=>AttachmentStorage.put(assetId,blob),
    keys:()=>AttachmentStorage.keys(),
    list:()=>AttachmentStorage.list(),
    importAll:(items,signal)=>importBackupAttachments(items,{signal}),
    restoreAll:items=>importBackupAttachments(items,{replace:true}),
    removeMany:assetIds=>RichTextAssets.removeMany(assetIds),
    removeMetadata:assetIds=>AttachmentLibrary.removeMetadata(assetIds),
    scheduleMaintenance:delay=>scheduleRichTextAssetMaintenance(delay)
  }),
  codecs:Object.freeze({activeSession:ActiveSessionCodec,backup:RuntimeBackupCodec,dailyRecord:DailyRecordCodec,pendingReview:PendingReviewCodec}),
  reconciliation:Object.freeze({createPlan:ReconciliationModule.createPlan,resolvePlan:ReconciliationModule.resolvePlan,summarizePlan:ReconciliationModule.summarizePlan,savedDayContentValue:ReconciliationModule.savedDayContentValue}),
  noteReconciliation:Object.freeze({resolve:options=>withRichTextAssetMaintenancePaused(()=>NoteReconciliationUI.resolve(options)),merge:(base,local,incoming)=>RichTextApi.mergeThreeWay(base,local,incoming)}),
  exports:Object.freeze({backgroundAvailable:backupBackgroundAvailability,cancel:Exports.cancel,protect:BackupProtection.protect,unprotect:BackupProtection.unprotect,followProtection:BackupProtection.follow,check:Exports.check,scope:operation=>AttachmentStorage.during(()=>Exports.scope(operation)),job:(operation,options)=>AttachmentStorage.during(()=>Exports.job(operation,options)),run:Exports.run,download:Exports.download,chooseSave:Exports.chooseSave,save:Exports.save}),
  session:Object.freeze({
    canMutate:()=>appCanMutate(),
    cancelLiveDraftSave:()=>cancelPendingLiveDraftSave(),
    captureSnapshot:captureSessionSnapshot,
    hasActiveSession:hasBlockingActiveSession,
    hasTasks:()=>TASKS.length>0,
    toActiveSession:activeSessionPayload,
    withPersistenceSuppressed:operation=>withRestoreSessionPersistenceSuppressed(operation),
    yieldSession:options=>yieldSessionToOtherDevice(options)
  }),
  domain:Object.freeze({
    clampText,filenameSafeStudentName,
    getStudentName:getStudentNameFromDisplay,
    materializeDailyRecordView,sanitizeCurrentDailyRecord,todayISO
  }),
  view:Object.freeze({presentation:BackupPresentation,
    refreshPnote,
    refreshReview:()=>ReviewView.refresh(),
    renderSchedule:renderSched,
    deviceName:(id,others)=>deviceName(id,others)
  }),
  events:Object.freeze({
    libraryChanged:()=>{LibraryView.render();if(ReviewDayState.reminder.date)void revalidateSaveReminderAfterCanonicalConvergence();},
    reconcileNotes:reconcileNotesThroughLifecycle,
    restoreNotesSnapshot:restoreNotesSnapshotThroughLifecycle,
    restoreSessionState:restoreSessionStateThroughLifecycle,
    verifyActiveSessionRuntime:verifyRestoredSessionRuntime,
    restoredFromFile:()=>{notifyBackupChange({urgent:true,reason:'file-restore'});return BackupProviderRuntime.automaticActive();},
    backupCompleted:context=>{
      if(context?.userExport)settleStorageReset();
      markStorageHealthOk('backup');
      backupNudgeMessage='';
      backupNudgeCheckedAt=Date.now();
      backupNudgeNotifiedDate='';
      refreshStorageFallbackWarning();
      if(context?.copy)void recordBackupCopy(context.copy).catch(error=>AppDiagnostics.capture('backup.freshness-receipt',error,'warn'));
      schedulePwaUpdateEvaluation(250);
    }
  }),
  interactions:Object.freeze({
    choose:options=>Interactions.choose(options),
    configure:options=>Interactions.configure(options),
    notify:options=>Interactions.notify(options)
  }),
  operations:Object.freeze({
    assertAuthority:options=>AppMutationCoordinator.assertAuthority(options),
    // A shared location (Drive) takes no upload while data this build cannot read is held.
    canShare:()=>UnsupportedData.held()?'unsupported-data':true,
    clearFault:()=>AppMutationCoordinator.clearFault(),
    failClosed:message=>AppMutationCoordinator.failClosed(message),
    runExclusive:(kind,operation)=>AppMutationCoordinator.runExclusive(kind,operation)
  }),
  environment:Object.freeze({
    AbortController,
    yieldTask:BackgroundTasks.yieldTask,
    clearTimeout:timer=>clearTimeout(timer),
    setTimeout:(callback,delay)=>setTimeout(callback,delay)
  }),
  diagnostics:Object.freeze({capture:AppDiagnostics.capture,start:BackupOperationDiagnostics.start,mark:BackupOperationDiagnostics.mark,finish:BackupOperationDiagnostics.finish,fail:BackupOperationDiagnostics.fail})
})}));
if(!Object.isFrozen(BackupRuntime)||BackupRuntime.format!=='study-director.backup-runtime'||BackupRuntime.contractVersion!==1){
  throw new Error('Study Director Backup runtime is unavailable or incompatible.');
}
const {
  controller:BackupController, checkpoint:CheckpointPipeline, repository:RepositoryCheckpointPipeline, providers:BackupProviderRuntime
}=BackupRuntime;
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
// Each location row has one inline note, drawn from the presentation's current event.
// The controller owns execution; the coordinator owns the immutable presentation event.
fileBackupRowReady=true;BackupController.subscribeStatus(renderFileBackup);renderFileBackup();
// A user-started file backup/import holds background locations until it ends.
// An automatic Drive catch-up also uses the shared import controller but is
// already suspension-aware; treating it as manual file work cancels itself.
let fileWorkHold=null;
function holdBackgroundForFileWork(){
  const status=BackupController.status(),active=!!(status.importHoldsBackground||status.standaloneExportActive);
  if(active&&!fileWorkHold){try{fileWorkHold=BackupProviderRuntime.suspendBackground('file-backup');void Promise.resolve(fileWorkHold.settled).catch(()=>{});}catch(error){fileWorkHold=null;AppDiagnostics.capture('backup.file-hold',error,'warn');}}
  else if(!active&&fileWorkHold){const hold=fileWorkHold;fileWorkHold=null;try{hold.release();}catch(error){AppDiagnostics.capture('backup.file-hold-release',error,'warn');}}
  foregroundChanged();
}
BackupController.subscribeStatus(holdBackgroundForFileWork);
BackupPresentation.subscribe(()=>{
  renderFileBackup();
  for(const source of ['device-folder','google-drive']){
    const node=document.getElementById(`backup-operation-note-${source}`);if(!node)continue;
    const event=BackupPresentation.current(source);
    const message=BackupPresentation.summary(event);node.hidden=!message;
    if(node.textContent!==message)node.textContent=message;
    node.dataset.state=event?.severity==='error'?'error':'ok';
    node.classList.toggle('ui-status',event?.severity==='error');node.classList.toggle('err',event?.severity==='error');
  }
});
const REPOSITORY_MAINTENANCE_FORMAT='study-director.repository-maintenance-pending';
const REPOSITORY_MAINTENANCE_VERSION=4;
let repositoryMaintenanceWriteChain=Promise.resolve();
function maintenanceReason(value){const reason=String(value||'requested').trim().toLowerCase();return /^[a-z][a-z0-9-]{0,47}$/u.test(reason)?reason:'requested';}
function maintenanceIso(value,fallback=''){const text=String(value||'');return Number.isFinite(Date.parse(text))?text:fallback;}
function normalizeRepositoryMaintenancePending(value){
  const entries=[],seen=new Set(),rows=value&&value.format===REPOSITORY_MAINTENANCE_FORMAT&&Number(value.version)===REPOSITORY_MAINTENANCE_VERSION&&Array.isArray(value.entries)?value.entries:[];
  for(const raw of rows){
    const providerId=String(raw&&raw.providerId||''),requestedAt=maintenanceIso(raw&&raw.requestedAt),nextEligibleAt=maintenanceIso(raw&&raw.nextEligibleAt,requestedAt),reason=maintenanceReason(raw&&raw.reason),repositoryScope=String(raw&&raw.repositoryScope||''),requestId=String(raw&&raw.requestId||'');
    if(!/^[a-z][a-z0-9-]{0,40}$/u.test(providerId)||seen.has(providerId)||!requestedAt||!nextEligibleAt)continue;
    if(repositoryScope.length>320||requestId&&!/^[a-f0-9-]{36}$/u.test(requestId))continue;seen.add(providerId);entries.push(Object.freeze({providerId,requestedAt,nextEligibleAt,reason,repositoryScope,requestId}));
  }
  return Object.freeze({format:REPOSITORY_MAINTENANCE_FORMAT,version:REPOSITORY_MAINTENANCE_VERSION,entries:Object.freeze(entries)});
}
async function readRepositoryMaintenancePending({throwOnError=false}={}){try{return normalizeRepositoryMaintenancePending(await BackupAppMeta.read('repositoryMaintenancePending'));}catch(error){AppDiagnostics.capture('backup.repository-maintenance-read',error,'warn');if(throwOnError)throw error;return normalizeRepositoryMaintenancePending(null);}}
function mutateRepositoryMaintenancePending(providerId,mode,state={},expected=undefined){
  const id=String(providerId||'');if(!/^[a-z][a-z0-9-]{0,40}$/u.test(id))return Promise.resolve(false);
  const task=repositoryMaintenanceWriteChain.then(()=>BackupAppMeta.transaction('readwrite',(view,tx,finish)=>{
    const handle=view.get('repositoryMaintenancePending');let outcome=true;
    handle.request.onerror=()=>finish(false,handle.request.error||new Error('Maintenance intent could not be read.'));
    handle.request.onsuccess=()=>{
      try{
        const current=normalizeRepositoryMaintenancePending(handle.value()),byId=new Map(current.entries.map(entry=>[entry.providerId,entry])),previous=byId.get(id)||null;
        if(expected!==undefined&&(!previous!==!expected||expected&&['requestId','requestedAt','nextEligibleAt','reason','repositoryScope'].some(key=>String(previous?.[key]||'')!==String(expected[key]||'')))){outcome='superseded';return;}
        if(mode==='mark'){
          const now=new Date().toISOString(),requestedAt=previous?.requestedAt||now,nextEligibleAt=maintenanceIso(state&&state.nextEligibleAt,now),reason=maintenanceReason(state&&state.reason||previous?.reason||'catch-up'),repositoryScope=String((state&&state.repositoryScope)??previous?.repositoryScope??'').slice(0,320),requestId=state.newRequest!==true&&expected!==undefined&&previous?.requestId?previous.requestId:crypto.randomUUID();
          byId.set(id,Object.freeze({providerId:id,requestedAt,nextEligibleAt,reason,repositoryScope,requestId}));
        }else byId.delete(id);
        const next=Object.freeze({format:REPOSITORY_MAINTENANCE_FORMAT,version:REPOSITORY_MAINTENANCE_VERSION,entries:Object.freeze([...byId.values()].sort((a,b)=>a.providerId.localeCompare(b.providerId)))});
        const write=next.entries.length?view.put('repositoryMaintenancePending',next):view.remove('repositoryMaintenancePending');
        write.onerror=()=>finish(false,write.error||new Error('Maintenance intent could not be saved.'));
      }catch(error){finish(false,error);}
    };
    tx.oncomplete=()=>finish(true,outcome);
  },{strict:true,abortMessage:'Maintenance intent transaction aborted'})).catch(error=>{AppDiagnostics.capture('backup.repository-maintenance-write',error,'warn');return false;});
  repositoryMaintenanceWriteChain=task.then(()=>{});return task;
}
const repositoryMaintenanceState=async providerId=>(await readRepositoryMaintenancePending({throwOnError:true})).entries.find(entry=>entry.providerId===String(providerId||''))||null;
const markRepositoryMaintenancePending=(providerId,state={},expected=undefined)=>mutateRepositoryMaintenancePending(providerId,'mark',state,expected);
const clearRepositoryMaintenancePending=(providerId,expected=undefined)=>mutateRepositoryMaintenancePending(providerId,'clear',{},expected);
BackupProviderRuntime.configureRepositoryMaintenance(Object.freeze({read:repositoryMaintenanceState,mark:markRepositoryMaintenancePending,clear:clearRepositoryMaintenancePending}));
async function canonicalLocalRecoveryEmpty(){
  try{
    const [records,notePayload,active,plans,assets,reviews]=await Promise.all([
      AppData.dailyRecords.list({strict:true}),AppData.notes.readFreshPayload(),AppData.activeSession.load(0,{strict:true}),AppData.planData.read(),AttachmentStorage.list(),AppData.pendingReviews.list()
    ]);
    if(!active||active.ok!==true||active.error)throw active?.error||new Error('Active Session could not be read completely.');
    if(!Array.isArray(reviews))throw new Error('Kept Versions could not be read completely.');
    const hasPlan=!!(plans&&(String(plans.draft||'').trim()||(plans.savedPlans||[]).length));
    return !(records||[]).length&&!Object.keys(notePayload||{}).length&&!active?.value&&!hasPlan&&!(assets||[]).length&&!reviews.some(review=>!review.resolvedAt);
  }catch(error){AppDiagnostics.capture('backup.device-recovery-empty-check',error,'warn');return null;}
}
// The empty-data hint is for a browser that lost study data. Storage health
// remembers when study data was last saved here, so a brand-new
// install never sees it, and data the person deleted leaves deletion history
// that explains the emptiness. An unresolved clear has its own notice.
async function studyDataLostHere(){
  const health=readStorageHealth();if(!health.lastStudyDataSaveAt||storageResetUnresolved())return false;
  try{const deletions=await Promise.all([AppData.deletionRecovery.savedDays(),AppData.deletionRecovery.notes()]);return deletions.every(list=>!(list||[]).length);}
  catch(error){AppDiagnostics.capture('backup.device-recovery-deletions',error,'warn');return false;}
}
let deviceRecoveryOfferRunning=false,deviceRecoveryOfferDismissed=false,deviceRecoveryHintNotified=false;
async function offerDeviceRecoveryIfLocalEmpty(options={}){
  if(deviceRecoveryOfferRunning||deviceRecoveryOfferDismissed||!appCanMutate())return false;
  if(!await canonicalLocalRecoveryEmpty())return false;
  const state=DeviceBackup.status(),latestBefore=Number(options.latestBefore)||Number.POSITIVE_INFINITY;
  if(!state.connected){
    if(options.reason==='startup'&&!deviceRecoveryHintNotified&&await studyDataLostHere()){deviceRecoveryHintNotified=true;Interactions.notify({key:'device-recovery-empty-local',tier:'news',title:'No local study data found',message:`If browser data was cleared, restore from ${backupRestoreChoices()}.`,action:{label:'Restore from backup',opens:true,run:()=>void openBackupRestore()}});}
    return false;
  }
  deviceRecoveryOfferRunning=true;
  try{
    const history=await BackupProviderRuntime.history('device-folder',{interactive:false});
    const candidate=history.available?(history.entries||[]).find(entry=>entry?.location?.tier==='latest'&&Date.parse(String(entry.exportedAt||entry.location?.exportedAt||''))<=latestBefore):null;
    if(!candidate)return false;
    const accepted=await Interactions.confirm({
      title:'Recover from Device Folder?',
      message:'This browser has no local study data, but an existing Device Folder backup is available.',
      details:[`Latest backup: ${new Date(candidate.location.exportedAt).toLocaleString()}.`,'Study Director checks the backup before replacing this device’s data. Nothing is restored unless you choose Recover latest.'],
      confirmLabel:'Recover latest',cancelLabel:'Not now'
    });
    deviceRecoveryOfferDismissed=true;
    if(!accepted)return false;
    try{const restored=await BackupProviderRuntime.restoreRepositoryProviderVersion('device-folder',{checkpointId:candidate.location.checkpointId,confirmed:true});return !!restored&&restored.cancelled!==true;}
    catch(error){AppDiagnostics.capture('backup.device-recovery-offer',error,'warn');return false;}
  }finally{deviceRecoveryOfferRunning=false;}
}
async function connectDeviceBackupWithRecovery(){
  const startedAt=Date.now(),result=await DeviceBackup.connect();
  if(DeviceBackup.status().connected){
    if(storageResetHold)await recoverAfterStorageResetOnConnect('device-folder');
    else await offerDeviceRecoveryIfLocalEmpty({reason:'connect',latestBefore:startedAt-1});
  }
  return result;
}
// Google Drive or the Device Folder connected while a browser-data clear is
// unresolved. A device that wrote back what its open tab held adds only what
// is missing, as the open tab would have done had the location been
// connected. A device holding nothing (its database was removed while the
// app was closed, so nothing was in memory) takes its library back in full:
// from Drive by a sync, which is a first sync after the clear, so nothing is
// deleted on either side; from the Device Folder by offering its newest
// version from before the clear. Uploads stay paused until that is verified;
// anything that fails, or is declined, leaves the notice.
async function recoverAfterStorageResetOnConnect(id){
  const hold=storageResetHold;if(!hold||!appCanMutate())return false;
  (hold.tried??=new Set()).add(id);
  const empty=await canonicalLocalRecoveryEmpty()===true;
  if(storageResetHold!==hold)return false;
  let recovered=false;
  if(!empty)recovered=await restoreMissingAfterStorageReset(hold,id);
  else if(id==='device-folder')recovered=await offerDeviceRecoveryIfLocalEmpty({reason:'connect',latestBefore:Date.parse(hold.clearedAt)});
  else{
    let synced=null;
    try{synced=await BackupProviderRuntime.syncRepositoryProvider(id);}catch(error){AppDiagnostics.capture('storage-reset.sync-recovery',error,'warn');}
    recovered=!!synced&&synced.cancelled===false&&synced.verified===true;
    if(recovered){
      // A verified sync settles the clear itself (restore journal); this
      // covers one that changed nothing.
      if(storageResetHold===hold)settleStorageReset();
      const label=BackupProviderRuntime.list().find(item=>item.id===id)?.label||'Google Drive';
      NoticeCoordinator.emit({source:'storage-reset',id:'restored',severity:'success',lifecycle:'succeeded',foreground:false,tier:'news',surface:'toast',
        title:'Browser data was cleared',message:`Your library was brought back from ${label}.`});
    }
  }
  if(!recovered&&storageResetHold===hold)showStorageResetDecision();
  return recovered;
}
// Google Drive connected while a clear is unresolved, at start with a sign-in
// kept in browser storage or by signing in: tried once per connection, after
// the clear's own handling and once Drive is free.
function storageResetConnectionsChanged(){
  const hold=storageResetHold;if(!hold||storageResetHandling)return false;
  const tried=hold.tried??=new Set(),drive=BackupProviderRuntime.locationStatus('google-drive');
  if(!drive?.connected){tried.delete('google-drive');return false;}
  if(tried.has('google-drive')||drive.engineBusy)return false;
  void recoverAfterStorageResetOnConnect('google-drive').catch(error=>AppDiagnostics.capture('storage-reset.connect-recovery',error,'warn'));
  return true;
}
/* BROWSER DATA CLEARING · keep what an open tab still holds */
// Clearing site data deletes IndexedDB, localStorage and OPFS even with persistent
// storage granted. The database layer counts the clear the moment it reopens
// storage, so notes and background backups treat storage as lost from then on.
// This tab writes back what it still holds and checks each write. Saved Days and
// attachments exist only in a backup: with a connected Device Folder, the newest
// version saved before the clear adds them back without touching the rescued data;
// otherwise the user chooses. Until then automatic backups stay paused so the
// reduced data cannot become the newest backup. The unresolved clear is noted in
// storage health, so a reload brings the notice and the pause back.
const STORAGE_RESET_RETRY_MS=Object.freeze([3000,10000,30000]);
const STORAGE_RESET_PARTS=Object.freeze({device:'this device’s ID',notes:'notes',plans:'plans',settings:'settings',session:'today’s session'});
function storageResetUnresolved(){return !!storageResetHold||IndexedDb.lifecycle().resets>storageResetAcknowledged;}
function storageResetList(names){const parts=names.map(name=>STORAGE_RESET_PARTS[name]||name);return parts.length<2?parts.join(''):`${parts.slice(0,-1).join(', ')} and ${parts.at(-1)}`;}
function showStorageResetDecision({unsaved=[],retrying=false}={}){
  const hold=storageResetHold,clearedAt=Date.parse(String(hold?.clearedAt||'')),parts=[];
  if(hold?.reloaded)parts.push(`Browser data was cleared${Number.isFinite(clearedAt)?` on ${new Date(clearedAt).toLocaleString()}`:''}.`);
  else if(unsaved.length)parts.push(`Not saved again${retrying?' yet':''}: ${storageResetList(unsaved)}. ${retrying?'Study Director is retrying. ':''}Until then that data exists only in this tab, so keep it open${retrying?'':' and export a backup file from Data & Backup'}.`);
  else parts.push('Your open notes, plans, settings and today’s session were saved again.');
  const backingUp=DeviceBackup.status().connected||BackupProviderRuntime.connected('google-drive');
  parts.push(backingUp?'Past Saved Days and attachments need a restore from backup.':`Past Saved Days and attachments can be restored from ${backupRestoreChoices()}.`);
  if(backingUp)parts.push('Automatic backups are paused until you choose.');
  NoticeCoordinator.emit({source:'storage-reset',id:'detected',severity:'warning',lifecycle:'succeeded',foreground:false,tier:'critical',surface:'toast',dismissible:false,
    title:'Browser data was cleared',message:parts.join(' '),
    action:{label:'Restore from backup',run:()=>void restoreAfterStorageReset()},
    secondaryAction:{label:'Continue with current data',run:()=>settleStorageReset()}});
}
// Pausing is synchronous: scheduling stops at once, and waiting only lets a
// running automatic backup wind down.
let deviceBackupInstallPromise=null;
function ensureDeviceBackupInstalled(){
  // Startup and reset recovery share the same installation/permission read.
  // A second caller must not mistake an in-flight installation for readiness.
  if(!deviceBackupInstallPromise)deviceBackupInstallPromise=reconcileStartupChangeClock().then(()=>DeviceBackup.install()).catch(error=>{deviceBackupInstallPromise=null;throw error;});
  return deviceBackupInstallPromise;
}
function beginStorageResetHold(clearedAt){
  if(storageResetHold)return storageResetHold;
  const hold={provider:null,deviceReady:null,reloaded:false,clearedAt:String(clearedAt||new Date().toISOString())};storageResetHold=hold;storageResetSince=Date.now();
  try{hold.provider=BackupProviderRuntime.suspendBackground('storage-reset');}catch(error){AppDiagnostics.capture('storage-reset.provider-suspend',error,'warn');}
  // Permission may have changed while the site data was cleared. Never prompt
  // automatically: a denied or disconnected folder falls through to Drive or
  // the explicit restore decision. The timeout bounds a stalled browser API.
  hold.deviceReady=new Promise(resolve=>{
    let finished=false;
    const complete=value=>{if(finished)return;finished=true;clearTimeout(timer);resolve(value);};
    const timer=setTimeout(()=>{AppDiagnostics.capture('storage-reset.device-ready',new Error('Device Folder readiness did not finish in time.'),'warn');complete(false);},8000);
    void ensureDeviceBackupInstalled().then(()=>DeviceBackup.refreshPermission()).then(()=>complete(DeviceBackup.status().connected)).catch(error=>{AppDiagnostics.capture('storage-reset.device-ready',error,'warn');complete(false);});
  });
  if(readStorageHealth().browserDataClearedAt!==hold.clearedAt)writeStorageHealth({browserDataClearedAt:hold.clearedAt});
  return hold;
}
const storageResetSteps=Object.freeze({
  device:()=>InstallationIdentity.keep(),
  notes:()=>AppData.notes.recoverAfterStorageLoss(),
  plans:()=>PlanData.rewriteAfterStorageReset(),
  settings:()=>{protectedPreferencesDirty=true;return flushProtectedPreferences();},
  session:async()=>{if(!TASKS.length)return true;const result=await writeLiveDraftNow({markChanged:false});return !!(result&&result.ok&&result.storage?.idb===true);}
});
// Each write is checked. Failed parts are retried a few times; the notice says
// what is still only in memory instead of claiming it was saved.
async function writeBackAfterStorageReset(hold){
  let pending=Object.keys(storageResetSteps);
  for(let attempt=0;;attempt+=1){
    const failed=[];
    for(const name of pending){let saved=false;try{saved=await storageResetSteps[name]()===true;}catch(error){AppDiagnostics.capture(`storage-reset.${name}`,error,'error');}if(!saved)failed.push(name);}
    if(!failed.length||attempt>=STORAGE_RESET_RETRY_MS.length||storageResetHold!==hold||!appCanMutate())return failed;
    pending=failed;showStorageResetDecision({unsaved:failed,retrying:true});
    await new Promise(resolve=>setTimeout(resolve,STORAGE_RESET_RETRY_MS[attempt]));
  }
}
async function handleBrowserStorageReset(event={}){
  if(storageResetHandling)return storageResetHandling;
  storageResetHandling=(async()=>{
    // Another tab holds control and handles the clear; this one picks up an
    // unresolved clear from storage health if it takes over.
    if(!appCanMutate()){
      storageResetAcknowledged=IndexedDb.lifecycle().resets;void AppData.notes.recoverAfterStorageLoss();
      if(!event.peer)AppOwnership.announceStorageReset(event.detectedAt);
      return;
    }
    const hold=beginStorageResetHold(event.detectedAt);
    const unsaved=await writeBackAfterStorageReset(hold);
    try{refreshNoteConsumers();renderSched();}catch(error){AppDiagnostics.capture('storage-reset.render',error,'warn');}
    if(storageResetHold!==hold)return;
    if(unsaved.length){showStorageResetDecision({unsaved});return;}
    await hold.deviceReady;
    if(storageResetHold===hold&&!(await restoreMissingAfterStorageReset(hold))&&storageResetHold===hold)showStorageResetDecision();
  })().finally(()=>{storageResetHandling=null;});
  return storageResetHandling;
}
// Add back only what this device lacks, from the newest version saved before
// the clear: from the location named (one that just connected), otherwise the
// Device Folder first, then Google Drive if it is already connected (this
// never asks to sign in). Anything needing a decision falls back to the
// notice.
async function restoreMissingAfterStorageReset(hold,id=''){
  if(!appCanMutate())return false;
  const locations=BackupProviderRuntime.list(),location=id?locations.find(item=>item.id===id&&item.connected):locations.find(item=>item.id==='device-folder'&&item.connected)||locations.find(item=>item.connected);if(!location)return false;
  (hold.tried??=new Set()).add(location.id);
  const options={missingOnly:true,quiet:true,before:hold.clearedAt};let outcome=null;
  try{const restored=await BackupProviderRuntime.bringInRepositoryProvider(location.id,options);if(restored&&restored.cancelled===false&&restored.verified)outcome={exportedAt:restored.exportedAt,result:restored,label:location.label};}
  catch(error){AppDiagnostics.capture('storage-reset.missing-restore',error,'warn');}
  if(!outcome)return false;
  settleStorageReset();
  const at=Date.parse(String(outcome.exportedAt||'')),days=Math.max(0,Number(outcome.result?.added)||0),files=Math.max(0,Number(outcome.result?.assetsRestored)||0);
  const source=`your ${outcome.label} backup${Number.isFinite(at)?` of ${new Date(at).toLocaleString()}`:''}`,count=(value,word)=>`${value} ${word}${value===1?'':'s'}`;
  NoticeCoordinator.emit({source:'storage-reset',id:'restored',severity:'success',lifecycle:'succeeded',foreground:false,tier:'news',surface:'toast',
    title:'Browser data was cleared',
    message:days||files?`Your open work was kept. Added ${count(days,'past Saved Day')} and ${count(files,'attachment')} from ${source}.`:`Your open work was kept. Nothing was missing compared with ${source}.`});
  return true;
}
// The browser removed this profile's database while the app was closed: this
// start made it anew, yet browser storage says study data was saved here. It
// is handled as a clear seen while open: automatic uploads pause so the empty
// copy cannot replace a backup, and the notice offers the restore. A fresh
// install or a new profile has no such record, so it is never mistaken.
function noteDatabaseRemovedWhileClosed(){
  if(IndexedDb.lifecycle().startedFresh!==true||!appCanMutate())return false;
  const health=readStorageHealth();if(!health.lastStudyDataSaveAt||health.browserDataClearedAt)return false;
  AppDiagnostics.capture('storage.idb-missing-at-start',new Error('The browser database was missing at start although study data had been saved here.'),'warn');
  writeStorageHealth({browserDataClearedAt:new Date().toISOString()});
  return true;
}
// A reload or a takeover in another tab brings back an unresolved clear.
function resumeUnresolvedStorageReset(){
  noteDatabaseRemovedWhileClosed();
  const stored=AppData.local.getJson(STORAGE_KEYS.storageHealth,null),clearedAt=String(stored&&stored.browserDataClearedAt||readStorageHealth().browserDataClearedAt||'');
  if(!clearedAt||storageResetHold||!appCanMutate())return false;
  beginStorageResetHold(clearedAt).reloaded=true;showStorageResetDecision();storageResetConnectionsChanged();return true;
}
// Continuing, any verified restore or combine (restoreJournalMark), and any
// backup the user makes to a file, the Device Folder or Drive lift the pause.
function settleStorageReset(){
  const hold=storageResetHold;storageResetHold=null;storageResetAcknowledged=IndexedDb.lifecycle().resets;
  NoticeCoordinator.resolveEvent('storage-reset','detected');
  if(readStorageHealth().browserDataClearedAt)writeStorageHealth({browserDataClearedAt:null});
  wakeBackgroundOperations('storage-reset-settled');
  if(!hold)return false;
  try{hold.provider?.release();}catch(error){AppDiagnostics.capture('storage-reset.provider-resume',error,'warn');}
  void Promise.resolve(AppMutationCoordinator.settled()).then(()=>DeviceBackup.rememberAfterStorageReset()).catch(error=>AppDiagnostics.capture('storage-reset.remember-folder',error,'warn'));
  return true;
}
NoticeCoordinator.subscribe(state=>{
  if(!storageResetHold)return;
  if(state.events.some(event=>event.id==='backup-verified'&&event.lifecycle==='succeeded'&&Date.parse(String(event.completedAt||''))>=storageResetSince))settleStorageReset();
});
// The notice stays until the restore actually finishes. A restore replaces or
// combines today's session, so a running session is suspended first.
async function restoreAfterStorageReset(){
  if(hasBlockingActiveSession()){await suspendTodaySession();if(hasBlockingActiveSession())return false;}
  return openBackupRestore();
}
// The Device Folder is one backup location of the engine; this controller
// keeps only the chosen folder, its permission and its status row.
DeviceBackup=DeviceBackupModule.createController(Object.freeze({
  configuration:Object.freeze({metadataKey:APP_META_KEYS.deviceFolder,pickerId:EXTERNAL_REPOSITORY_IDENTITIES.deviceFolderPickerId,settingsTimeoutMs:10*1000}),
  engine:Object.freeze({backup:id=>BackupProviderRuntime.backup(id),cancelForeground:(reason,id)=>BackupProviderRuntime.cancelForeground(reason,id),disconnect:id=>BackupProviderRuntime.disconnect(id),forget:id=>BackupProviderRuntime.forget(id),locationStatus:id=>BackupProviderRuntime.locationStatus(id),register:config=>BackupProviderRuntime.register(config),subscribeStatus:listener=>BackupProviderRuntime.subscribeStatus(listener)}),
  environment:Object.freeze({
    backgroundBlocker:()=>backgroundBlocker(),canMutate:()=>appCanMutate(),clearTimeout:timer=>clearTimeout(timer),setTimeout:(callback,delay)=>setTimeout(callback,delay),
    showDirectoryPicker:typeof window.showDirectoryPicker==='function'?options=>window.showDirectoryPicker(options):null,
    withLock:work=>navigator.locks?.request?navigator.locks.request(ProfileScope.scoped('study-director-device-folder-prepare'),{mode:'exclusive'},()=>work()):Promise.resolve().then(work)
  }),
  hooks:Object.freeze({
    capture:(scope,error)=>AppDiagnostics.capture(scope,error,'warn'),
    // Several repository folders in the chosen folder and none of this
    // profile and device's: use one of them here, or start a new one.
    chooseRepository:rows=>Interactions.choose({
      title:'This folder already has Study Director backups',
      message:'Use one of them on this device, for example after clearing this browser, or start a new backup folder for this profile and device.',
      cancelLabel:'Cancel',
      choices:[...rows.map(row=>({value:row.name,label:row.name,description:`${row.versions} version${row.versions===1?'':'s'}${row.newest?` · newest ${new Date(row.newest).toLocaleString()}`:''}`})),{value:'',label:'Start a new backup folder',description:backupFolderName({device:true}),kind:'primary'}]
    }),
    repositoryOwner:()=>Object.freeze({profile:Profiles.current()?.id||'',scope:ProfileScope.scope,device:InstallationIdentity.getId(),name:backupFolderName({device:true})}),
    render:renderDeviceBackup,
    sourceRevision:()=>currentBackupSourceRevision(),
    verifiedAt:()=>verifiedRecoveryState.providers['device-folder']?.at||''
  }),
  presentation:BackupPresentation,
  settings:exactAppMetaStorage(DeviceFolderAppMeta,'deviceFolder',APP_META_KEYS.deviceFolder,'Device Backup'),
  transport:(folder,repository)=>DeviceFolderStorageModule.createStorage(Object.freeze({
    folder,
    identities:Object.freeze({root:repository,prefix:EXTERNAL_REPOSITORY_IDENTITIES.backupFolderPrefix,objects:EXTERNAL_REPOSITORY_IDENTITIES.deviceFolderObjects,checkpoints:EXTERNAL_REPOSITORY_IDENTITIES.deviceFolderCheckpoints,commits:EXTERNAL_REPOSITORY_IDENTITIES.deviceFolderCommits}),
    owner:()=>Object.freeze({profile:Profiles.current()?.id||'',scope:ProfileScope.scope,device:InstallationIdentity.getId()}),
    checksum:(blob,{signal}={})=>Exports.run('checksum',{value:blob},{signal}),
    inspectManifest:(file,options)=>RepositoryCheckpointPipeline.inspectManifest(file,options),
    environment:Object.freeze({canMutate:()=>appCanMutate(),now:()=>Date.now(),setTimeout:(callback,delay)=>setTimeout(callback,delay),clearTimeout:timer=>clearTimeout(timer),yieldTask:()=>BackgroundTasks.yieldTask({priority:'background'})}),
    limits:Object.freeze({publicationMaxAgeMs:RepositoryPolicyModule.protocol.publicationMaxAgeMs,publicationAssertionMarginMs:RepositoryPolicyModule.protocol.publicationAssertionMarginMs,publicationRenewMs:RepositoryPolicyModule.protocol.publicationRenewMs,publicationStaleMs:RepositoryPolicyModule.protocol.publicationStaleMs,maintenanceMaxAgeMs:RepositoryPolicyModule.protocol.maintenanceMaxAgeMs,maintenanceAssertionMarginMs:RepositoryPolicyModule.protocol.maintenanceAssertionMarginMs,responseTimeoutMs:10*1000})
  }))
}));
if(!Object.isFrozen(DeviceBackup)||DeviceBackup.format!=='study-director.device-backup'||DeviceBackup.contractVersion!==1){
  throw new Error('Study Director automatic device backup is unavailable or incompatible.');
}
BackupRecoveryHost=BackupRecoveryHostModule.createHost(Object.freeze({
  presentation:BackupPresentation,
  cancellation:Object.freeze({cancelImport:(reason,options)=>BackupController.cancelImport(reason,options)}),
  diagnostics:Object.freeze({capture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level),mark:(phase,details)=>BackupOperationDiagnostics.mark(phase,details)}),
  document,
  interactions:Object.freeze({choose:options=>Interactions.choose(options)}),
  lifecycle:Object.freeze({
    activeSessionIssue:loaded=>pwaRecoveryReadBackIssue(loaded),activeSessionLoad:()=>AppData.activeSession.load(0,{strict:true}),activeSessionSettled:()=>AppData.activeSession.settled(),
    attachmentBusy:()=>imagePreparationCount>0||AttachmentIngest.status().busy,canonicalPlanDraft:async()=>(await AppData.planData.read()).draft,deletionRecoveryFlush:()=>AppData.deletionRecovery.flush(),
    flushNotes:()=>AppData.notes.flush({strict:true}),flushPlanDraft:()=>PlanDraftEditor.flush(),hasTasks:()=>TASKS.length>0,noteFailure:()=>AppData.notes.failure(),
    planDraft:()=>PlanData.readDraft(),planInputValue:()=>PlanDraftEditor.authoredText(),quiesce:operation=>quiesceManagedRecoveryRuntime(operation),
    savePlanDraft:options=>PlanDraftEditor.save(options),settleAttachmentWriters:()=>settleAttachmentWriters(),settlePlan:()=>PlanData.settled(),writeLiveDraft:()=>writeLiveDraftNow({markChanged:false,allowDuringRecoveryQuiescence:true})
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
  sourceRevision:()=>currentBackupSourceRevision(),
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

let repositoryIntegrityWriteChain=Promise.resolve();
async function readRepositoryIntegrityState(){
  // An unavailable read is unknown state, never an empty-state permission to write.
  return normalizeRepositoryIntegrityState(await BackupAppMeta.read('repositoryIntegrityScrub'));
}
function applyRepositoryIntegrityHealth(state){
  repositoryIntegrityView=state;renderIntegrityStatuses();
  const targets=Object.entries(state?.locations||{}).filter(([id,target])=>!!target?.repositoryScope&&repositoryIntegrityBoundScopes[id]===target.repositoryScope).map(([,target])=>target);
  const quarantined=targets.some(target=>target.quarantinedObjectIds?.length);
  const failed=targets.some(target=>{const failure=Date.parse(String(target.failedAt||'')),completed=Date.parse(String(target.completedAt||''));return Number.isFinite(failure)&&(!Number.isFinite(completed)||failure>=completed);});
  if(quarantined)markStorageHealthError('repositoryIntegrity','Some backup objects failed integrity verification. Keep the local copy and use a healthy backup version.',{level:'warn'});
  else if(failed)markStorageHealthError('repositoryIntegrity','Backup verification is incomplete or unavailable. Study Director will retry; keep the local copy until verification succeeds.',{level:'warn'});
  else markStorageHealthOk('repositoryIntegrity');
  return state;
}
function mutateRepositoryIntegrityTarget(target,change){
  if(!INTEGRITY_LOCATION_ID.test(String(target||'')))return Promise.reject(new Error('Unknown backup location.'));
  const task=repositoryIntegrityWriteChain.catch(()=>{}).then(()=>BackupAppMeta.transaction('readwrite',(view,tx,finish)=>{
    const handle=view.get('repositoryIntegrityScrub');let updated;
    handle.request.onerror=()=>finish(false,handle.request.error||new Error('Integrity metadata could not be read.'));
    handle.request.onsuccess=()=>{
      try{
        if(!appCanMutate())throw new Error('Study control is required to save integrity state.');
        const state=normalizeRepositoryIntegrityState(handle.value()),next=normalizeRepositoryIntegrityTarget(change(state.locations[target]||normalizeRepositoryIntegrityTarget(null)));
        updated=Object.freeze({...state,locations:Object.freeze({...state.locations,[target]:next})});
        const write=view.put('repositoryIntegrityScrub',updated);write.onerror=()=>finish(false,write.error||new Error('Integrity metadata could not be saved.'));
      }catch(error){finish(false,error);}
    };
    tx.oncomplete=()=>finish(true,updated);
  },{strict:true,abortMessage:'Integrity metadata transaction aborted'})).then(updated=>{applyRepositoryIntegrityHealth(updated);return updated.locations[target];}).catch(error=>{
    if(!error.code)error.code='REPOSITORY_INTEGRITY_STATE_UNAVAILABLE';
    markStorageHealthError('repositoryIntegrity','Backup verification state could not be saved or read. The previous state is preserved; verification will retry.',{level:'warn'});
    AppDiagnostics.capture('backup.repository-integrity-state',error,'warn');throw error;
  });
  repositoryIntegrityWriteChain=task.catch(()=>{});return task;
}
function repositoryIntegrityChanged(){const error=new Error('The backup repository changed during integrity verification.');error.code='REPOSITORY_CHANGED';return error;}
async function readRepositoryIntegrityTarget(target){
  const actual=await BackupProviderRuntime.repositoryScope(target);
  if(!actual)throw new Error('The backup repository identity is unavailable.');
  const state=await readRepositoryIntegrityState(),prior=state.locations[target]||normalizeRepositoryIntegrityTarget(null);
  const same=prior.repositoryScope===actual;
  if(same&&prior.repositoryScope){repositoryIntegrityBoundScopes[target]=prior.repositoryScope;applyRepositoryIntegrityHealth(state);return prior;}
  const repositoryScope=String(actual);
  const bound=await mutateRepositoryIntegrityTarget(target,current=>{
    if(current.repositoryScope!==prior.repositoryScope)throw repositoryIntegrityChanged();
    return {...normalizeRepositoryIntegrityTarget(null),repositoryScope};
  });
  repositoryIntegrityBoundScopes[target]=bound.repositoryScope;applyRepositoryIntegrityHealth(await readRepositoryIntegrityState());return bound;
}
async function updateRepositoryIntegrityTarget(target,result){
  if(!result?.repositoryScope)throw new Error('Integrity results require their repository identity.');
  const bound=await readRepositoryIntegrityTarget(target);
  if(bound.repositoryScope!==result.repositoryScope)throw repositoryIntegrityChanged();
  return mutateRepositoryIntegrityTarget(target,current=>{
    if(current.repositoryScope!==result.repositoryScope)throw repositoryIntegrityChanged();
    const now=new Date().toISOString(),dailyHistory=current.history.at(-1)?.at.slice(0,10)===now.slice(0,10)?current.history.slice(0,-1):current.history;
    // A check already running when Recheck was pressed belongs to the older
    // request: its progress and findings do not settle the recheck, which
    // stays pending as it is. A clean full pass is still recorded as the last
    // full scan, so Verification shows it instead of the result vanishing.
    if(current.requestId!==String(result.requestId||'')){
      if(result.complete!==true||result.status!=='completed'||result.corruption||result.checkpointOnly)throw repositoryIntegrityChanged();
      return {...current,attemptedAt:now,completedAt:now,lastOutcome:'completed',blockedReason:'',history:[...dailyHistory,{at:now,outcome:'completed',complete:true}].slice(-8)};
    }
    const quarantine=result.status==='unavailable'?[...new Set([...current.quarantinedObjectIds,...(result.quarantined||[])])]:result.quarantined===undefined?current.quarantinedObjectIds:result.quarantined;
    const hasProgress=Object.hasOwn(result,'cursor')&&Object.hasOwn(result,'scanId');
    const progress=hasProgress?{cursor:result.cursor,scanId:result.scanId,...(Object.hasOwn(result,'recheckCursor')?{recheckCursor:result.recheckCursor}:{}),...(Object.hasOwn(result,'partial')?{partial:result.partial}:{} )}:{};
    const blockedReason=['locked','budget','preempted','permission'].includes(result.reason)?result.reason:result.status==='unavailable'?'unavailable':result.corruption?'corrupt':'';
    const outcome={attemptedAt:now,lastOutcome:result.status,blockedReason,history:result.checkpointOnly?current.history:[...dailyHistory,{at:now,outcome:result.status,complete:result.complete===true&&['completed','failed'].includes(result.status)}].slice(-8)};
    const finishedRecheck=current.recheck&&result.recheckComplete===true&&result.status==='failed'&&result.corruption===true;
    if(result.complete===true&&(result.status==='completed'||finishedRecheck))return {...current,...outcome,completedAt:now,cycleStartedAt:'',cursor:'',recheckCursor:'',scanId:'',partial:null,recheck:false,failedAt:finishedRecheck?now:'',quarantinedObjectIds:quarantine};
    if(['completed','yielded','failed','unavailable','skipped'].includes(result.status))return {...current,...progress,...outcome,partial:progress.partial===undefined?result.corruption?null:current.partial:progress.partial,cycleStartedAt:hasProgress?current.cycleStartedAt||now:current.cycleStartedAt,failedAt:['failed','unavailable'].includes(result.status)?now:current.failedAt,quarantinedObjectIds:quarantine};
    return current;
  });
}
const RepositoryIntegrityContinuation=IntegrityContinuationModule.create({files:BackupFiles,processing:Exports,protection:BackupProtection,yieldTask:()=>BackgroundTasks.yieldTask({priority:'background'})});
async function refreshDeviceBackgroundPermission(event){
  if(![APP_ACTIVATION_KINDS.OWNERSHIP_TAKEOVER,APP_ACTIVATION_KINDS.ORDINARY_FOCUS,APP_ACTIVATION_KINDS.VISIBILITY_RETURN].includes(event?.kind))return;
  // The controller reconnects its whole job owner after permission changes.
  await DeviceBackup.refreshPermission();
}
AppActivation.subscribe(event=>{if([APP_ACTIVATION_KINDS.ORDINARY_FOCUS,APP_ACTIVATION_KINDS.VISIBILITY_RETURN,APP_ACTIVATION_KINDS.OWNERSHIP_TAKEOVER,APP_ACTIVATION_KINDS.DATE_ROLLOVER].includes(event.kind)&&wakeBackgroundOperations('activation')&&Date.now()-CapabilityStorage.lastCheckedAt()>=STORAGE_ESTIMATE_REFRESH_MS)void inspectStorageCapability().catch(error=>AppDiagnostics.capture('storage.estimate-refresh',error,'warn'));void refreshDeviceBackgroundPermission(event).catch(error=>AppDiagnostics.capture('device-backup.permission-refresh',error,'warn'));});
// A location backs up on its own once this device has backed up to it (the
// Device Folder from when it was chosen). A change found on start is backed up
// only while local data is present.
BackupProviderRuntime.configureAutomaticBackup(Object.freeze({covered:id=>verifiedRecoveryState.providers[id]?.sourceRevision||'',current:()=>currentBackupSourceRevision(),ready:async()=>{const empty=await canonicalLocalRecoveryEmpty();return empty===null?null:!empty;}}));
BackupProviderRuntime.configureSessionOwnership(Object.freeze({
  installationId:()=>InstallationIdentity.getId(),
  today:()=>todayISO(),
  read:async()=>{const loaded=await AppData.activeSession.load(0,{strict:true});if(!loaded||loaded.ok!==true||loaded.error)throw loaded?.error||new Error('Active Session ownership could not be read safely.');const value=loaded.value;return value?Object.freeze({date:value.date,runningOn:value.runningOn,revision:value.revision}):null;}
}));
// Each location's integrity state is kept under its location id.
BackupProviderRuntime.configureIntegrityScrub(Object.freeze({
  readTarget:id=>readRepositoryIntegrityTarget(id),
  // How far the cycle has got stays shown between its batches, until it finishes.
  writeResult:async(id,result)=>{if(result?.complete===true||!Number(result?.total))delete integrityLive[id];else integrityLive[id]=Object.freeze({done:Number(result.done)||0,total:Number(result.total)});await updateRepositoryIntegrityTarget(id,result);},
  prepare:async(id,target,{trigger,nextEligibleAt})=>Object.freeze({repositoryScope:target.repositoryScope,requestId:target.requestId,scanId:target.scanId,cursor:target.cursor,recheckCursor:target.recheckCursor,partial:target.partial,recheck:target.recheck,verifyIncremental:RepositoryIntegrityContinuation.verify,maxObjects:REPOSITORY_INTEGRITY_BATCH_OBJECTS,maxBytes:REPOSITORY_INTEGRITY_BATCH_BYTES,skipObjectIds:target.quarantinedObjectIds,trigger:String(trigger||'scheduled-integrity'),nextEligibleAt:String(nextEligibleAt||''),onProgress:progress=>{integrityLive[id]=Object.freeze({done:Number(progress?.done)||0,total:Number(progress?.total)||0});renderIntegrityStatuses();return updateRepositoryIntegrityTarget(id,{...progress,status:'yielded',checkpointOnly:true,repositoryScope:target.repositoryScope,requestId:target.requestId});}}),
  isAvailable:()=>backgroundBlocker()||true,
  isUnsafe:()=>!!AppMutationCoordinator?.status?.()?.active||!!AttachmentIngest?.status?.()?.busy,
  yieldTask:()=>BackgroundTasks.yieldTask({priority:'background'}),
  quarantine:async id=>(await readRepositoryIntegrityTarget(id)).quarantinedObjectIds
}));
async function installRepositoryIntegrityScrub(){
  let state=null;
  try{state=applyRepositoryIntegrityHealth(await readRepositoryIntegrityState());}
  catch(error){AppDiagnostics.capture('backup.repository-integrity-state-read',error,'warn');markStorageHealthError('repositoryIntegrity','Backup verification state is unavailable. Study Director will retry.',{level:'warn'});}
  return state;
}
/* PWA SHELL AND SAFE UPDATE COORDINATION */
const PWA_UPDATE_READY_DELAY_MS=650;
const PWA_UPDATE_SAFETY_RETRY_MS=5*60*1000;
// A window whose service worker already moved to the new release runs old page
// code against it, so it retries within seconds rather than at the safety retry.
const PWA_UPDATE_EXTERNAL_RETRY_MS=5000;
const PWA_UPDATE_CHECK_INTERVAL_MS=24*60*60*1000;
const PWA_UPDATE_CHECK_RETRY_BASE_MS=5*60*1000;
const PWA_UPDATE_CHECK_RETRY_MAX_MS=60*60*1000;
const PWA_UPDATE_CHECK_LOCK='study-director-pwa-update-check-v1';
const PWA_EDIT_IDLE_MS=1800;
let pwaLatestUpdateState=null,pwaUpdateRetryTimer=null,pwaUpdateEvaluationRunning=false,pwaAutomaticBlockMessage='';
let pwaUpdateCheckTimer=null,pwaUpdateCheckDueAt=0,pwaUpdateCheckRunning=false,pwaLastEditableInputAt=0,pwaLastSuccessfulUpdateCheckMemoryAt=0,pwaUpdateCheckFailureCount=0,pwaUpdateCheckRetryAt=0;
function pwaRecentEditableInput(){return pwaLastEditableInputAt>0&&Date.now()-pwaLastEditableInputAt<PWA_EDIT_IDLE_MS;}
function pwaAppliedPlanEnded(){
  if(!TASKS.length)return false;
  const trackable=TASKS.map((task,index)=>({task,index})).filter(row=>isTrackableBlock(row.task));
  return trackable.length?trackable.every(row=>isTaskResolved(row.index)):TimerState.currentIndex>=TASKS.length;
}
function pwaRecoveryReadBackIssue(loaded){
  if(!loaded)return 'Saved session state could not be verified.';
  if(loaded.error)return `Saved session recovery could not be verified: ${loaded.error.message||loaded.error}`;
  if(loaded.value&&loaded.storage?.idb!==true)return 'The stored recovery session has not yet been confirmed in canonical browser storage.';
  return '';
}
function pwaUpdateBlockReason(options={}){
  const automatic=options&&options.automatic===true,ignoreActiveTimers=options&&options.ignoreActiveTimers===true;
  const ownReservation=pwaUpdateReservation?.requestId===options.requestId&&!!options.requestId;
  if(pwaUpdateReservation&&!ownReservation)return 'Another update is already preparing this window.';
  if(!StartupLifecycle.status().fullyInitialized)return 'Study Director is still starting. Try again in a moment.';
  const ownership=AppOwnership.status();
  if(ownership.hydrating||ownership.takeoverPending||ownership.resolving||![OWNERSHIP_STATES.PRIMARY,OWNERSHIP_STATES.SECONDARY].includes(ownership.state)){
    return 'Study Director ownership is still changing. Wait for this tab to settle, then try again.';
  }
  const follower=options.external===true&&ownership.state===OWNERSHIP_STATES.SECONDARY;
  if(ownership.state!==OWNERSHIP_STATES.PRIMARY&&!follower)return automatic?'The primary Study Director window will apply this update when saved state is safe.':'This is a read-only secondary window. Update from the Study Director window that currently has control.';
  // A read-only follower holds nothing to save, so a lifecycle left unreconciled
  // (for example after it lost primary control) must not keep it on the old release.
  const lifecycle=SessionLifecycle.status();
  if(lifecycle.transitioning||!lifecycle.ready&&!follower)return 'Study Director is still reconciling session state. Try again when it is ready.';
  const mutation=AppMutationCoordinator.status();
  if(mutation.active&&!(ownReservation&&mutation.active==='pwa-update'))return `A ${mutation.active} operation is still active. The update will retry after it finishes.`;
  if(mutation.foreign&&!follower)return 'Another Study Director window is changing stored data. The update will retry after it finishes.';
  if(mutation.recoveryFault)return `Stored-data recovery must finish before updating: ${mutation.recoveryFault}`;
  const review=ReviewSaveService.status();
  if(review.rolloverSaveInProgress||review.saveDayInProgress||review.activeSessionPersistenceBlocked)return 'A Review save is still finishing. Wait for it to complete.';
  if(imagePreparationCount>0||AttachmentLibrary.status().busy||AttachmentIngest.status().busy)return 'An attachment is still being prepared or saved.';
  if(Exports.status().busy||BackupController.status().busy||BackupProviderRuntime.status().busy)return 'A backup, import, or storage-provider operation is still active.';
  if(!follower&&!ignoreActiveTimers&&isLiveTrackableTimer()&&!TimerState.paused&&TimerState.mode===TIMER_MODES.RUNNING)return 'Pause or finish the live timer before updating.';
  if(!follower&&!ignoreActiveTimers&&PracticePacer.status().running)return 'Pause or finish the Practice Pacer before updating.';
  if(!appCanMutate()&&!follower)return 'This window cannot safely write saved state yet. Wait for storage and ownership to settle.';
  if(!ownReservation&&document.querySelector('dialog[open],[data-rich-asset-picker="active"]'))return 'Finish the open dialog or file selection before updating.';
  if(automatic&&pwaRecentEditableInput())return 'Automatic update is waiting for the current edit to settle.';
  return '';
}
function reserveApplicationUpdate(context){
  const reason=pwaUpdateBlockReason(context);if(reason)throw new Error(reason);
  const owner=AppOwnership.status(),follower=context.external===true&&owner.state===OWNERSHIP_STATES.SECONDARY;
  const token={requestId:context.requestId,ownerRevision:owner.revision,ownerState:owner.state,workRevision:null,authority:null};
  let released=false,resolveReady,rejectReady,unlock,providerHold=null;
  const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;}),held=new Promise(resolve=>{unlock=resolve;});
  // Observe early rejection even if releasing beats the caller's await.
  ready.catch(()=>{});
  pwaUpdateReservation=token;
  const dialog=document.createElement('dialog');dialog.id='pwa-update-progress';dialog.className='interaction-dialog';
  dialog.setAttribute('aria-labelledby','pwa-update-progress-title');dialog.setAttribute('aria-describedby','pwa-update-progress-message');
  const body=document.createElement('div');body.className='interaction-body';
  const title=document.createElement('h2');title.id='pwa-update-progress-title';title.textContent='Updating Study Director';
  const copy=document.createElement('p');copy.id='pwa-update-progress-message';copy.setAttribute('role','status');copy.textContent='Saving your work. Editing will resume if the update cannot finish.';
  body.append(title,copy);dialog.append(body);dialog.addEventListener('cancel',event=>event.preventDefault());document.body.append(dialog);
  const block=event=>{if(!released&&!dialog.contains(event.target)){event.preventDefault();event.stopImmediatePropagation();}};
  const blockedEvents=['beforeinput','click','dblclick','keydown','paste','cut','drop','submit','change'];
  for(const type of blockedEvents)window.addEventListener(type,block,true);
  const validate=()=>{
    if(released||context.signal.aborted||pwaUpdateReservation!==token)return false;
    const now=AppOwnership.status();
    if(now.state!==token.ownerState||now.revision!==token.ownerRevision||now.hydrating||now.takeoverPending||now.resolving)return false;
    if(token.workRevision!==null&&token.workRevision!==pwaWorkRevision)return false;
    token.authority?.assert();return !pwaUpdateBlockReason({...context,requestId:token.requestId});
  };
  const releaseSignal=()=>{released=true;unlock();rejectReady(new Error('Update preparation was cancelled.'));};
  context.signal.addEventListener('abort',releaseSignal,{once:true});
  const task=(async()=>{
    try{
      dialog.showModal();OwnershipUiProjection.apply();
      const run=async authority=>{
        token.authority=authority;if(released||context.signal.aborted)return;
        providerHold=BackupProviderRuntime.suspendBackground('pwa-update');
        const settled=Promise.all([providerHold.settled,RichTextAssetMaintenance.settled(),AppData.maintenance.settled(),AttachmentIntegrityJob.settled()]);
        await Promise.race([settled,held]);
        if(released||context.signal.aborted)return;
        if(!validate())throw new Error('Study Director control changed while preparing the update.');
        resolveReady();await held;
      };
      if(follower)await RichTextRuntime.quiesce(()=>run(null));
      else await AppMutationCoordinator.runExclusive('pwa-update',authority=>quiesceManagedRecoveryRuntime(()=>run(authority)));
    }catch(error){rejectReady(error);}
    finally{
      providerHold?.release();
      context.signal.removeEventListener('abort',releaseSignal);
      for(const type of blockedEvents)window.removeEventListener(type,block,true);
      if(pwaUpdateReservation===token){pwaUpdateReservation=null;foregroundChanged();}
      dialog.close();dialog.remove();OwnershipUiProjection.apply();
    }
  })();
  return Object.freeze({ready,validate,release:()=>{releaseSignal();return task;}});
}
async function prepareApplicationUpdate(context={}){
  const initialReason=pwaUpdateBlockReason(context);
  if(initialReason)return Object.freeze({ok:false,reason:initialReason});
  const reservation=pwaUpdateReservation?.requestId===context.requestId?pwaUpdateReservation:null;
  const check=()=>{context.signal?.throwIfAborted();if(reservation&&pwaUpdateReservation!==reservation)throw new Error('Update preparation was cancelled.');};
  if(context.external===true&&AppOwnership.status().state===OWNERSHIP_STATES.SECONDARY){
    if(reservation)reservation.workRevision=pwaWorkRevision;
    return Object.freeze({ok:true,reason:''});
  }
  const workRevision=pwaWorkRevision;
  const ownershipBefore=AppOwnership.status();
  const lifecycleBefore=SessionLifecycle.status();
  try{
    if(!reservation)await AppMutationCoordinator.settled();check();
    if(!await LibraryView.settleDiary())return Object.freeze({ok:false,reason:'The Diary edit could not be saved. Keep this tab open and retry.'});
    check();
    if(await PlanDraftEditor.flush()===false)return Object.freeze({ok:false,reason:'The Plan draft could not be saved. Keep this tab open and retry after browser storage recovers.'});
    check();
    // The default plan shown over no stored draft is not saved as a draft.
    const planText=PlanDraftEditor.authoredText();
    if(planText!==null&&(PlanData.readDraft()??'')!==planText&&await PlanDraftEditor.save()===false){
      return Object.freeze({ok:false,reason:'The Plan draft could not be saved. Keep this tab open and retry after browser storage recovers.'});
    }
    await PlanData.settled();
    check();
    const storedPlan=planText!==null?await AppData.planData.read():null;
    check();
    if(planText!==null&&storedPlan.draft!==planText){
      return Object.freeze({ok:false,reason:'The Plan draft did not pass the update read-back check.'});
    }
    if(await flushPendingReviewSave({strict:true})===false)return Object.freeze({ok:false,reason:'The pending reflection could not be saved. Keep this tab open and retry.'});
    await ReviewEditor.settled();
    check();
    const liveResult=TASKS.length?await writeLiveDraftNow({markChanged:false,allowDuringRecoveryQuiescence:!!reservation}):null;
    check();
    await AppData.notes.flush();
    check();
    const noteFailure=AppData.notes.failure();
    if(noteFailure&&noteFailure.failed)return Object.freeze({ok:false,reason:noteFailure.message||'Notes are not safely stored yet.'});
    if(await AppData.deletionRecovery.flush()!==true)return Object.freeze({ok:false,reason:'Pending deletions could not be safely reconciled. Keep this tab open and retry after browser storage recovers.'});
    check();
    await AppData.activeSession.settled();
    const loaded=await AppData.activeSession.load();
    await AppData.activeSession.settled();
    const recoveryIssue=pwaRecoveryReadBackIssue(loaded);
    if(recoveryIssue)return Object.freeze({ok:false,reason:recoveryIssue});
    if(TASKS.length){
      if(!liveResult||!liveResult.ok||!liveResult.value||liveResult.storage?.idb!==true)return Object.freeze({ok:false,reason:'The active session could not be confirmed in canonical browser storage.'});
      if(!loaded.value||Number(loaded.value.revision)!==Number(liveResult.value.revision)){
        return Object.freeze({ok:false,reason:'The saved active session did not pass the update read-back check.'});
      }
    }
  }catch(error){
    AppDiagnostics.capture('pwa.prepare',error,'error');
    return Object.freeze({ok:false,reason:error&&error.message?error.message:'Current work could not be safely settled for the update.'});
  }
  if(workRevision!==pwaWorkRevision)return Object.freeze({ok:false,reason:'New work started while the update was preparing. Retry after it is saved.'});
  check();
  const finalReason=pwaUpdateBlockReason(context);
  if(finalReason)return Object.freeze({ok:false,reason:finalReason});
  const ownershipAfter=AppOwnership.status(),lifecycleAfter=SessionLifecycle.status();
  if(ownershipAfter.state!==OWNERSHIP_STATES.PRIMARY||ownershipAfter.state!==ownershipBefore.state||ownershipAfter.revision!==ownershipBefore.revision||
    lifecycleAfter.revision!==lifecycleBefore.revision||lifecycleAfter.transitioning){
    return Object.freeze({ok:false,reason:'Session ownership changed while the update was preparing. Let this tab settle and try again.'});
  }
  if(reservation)reservation.workRevision=pwaWorkRevision;
  return Object.freeze({ok:true,reason:''});
}
function pwaUpdateRetryDelay(){return pwaLatestUpdateState?.externalUpdate?PWA_UPDATE_EXTERNAL_RETRY_MS:PWA_UPDATE_SAFETY_RETRY_MS;}
function schedulePwaUpdateEvaluation(delay=pwaUpdateRetryDelay()){
  if(pwaUpdateRetryTimer!==null){clearTimeout(pwaUpdateRetryTimer);pwaUpdateRetryTimer=null;}
  if(!pwaLatestUpdateState||(!pwaLatestUpdateState.updateReady&&!pwaLatestUpdateState.applying))return false;
  const editDelay=pwaLastEditableInputAt?Math.max(0,pwaLastEditableInputAt+PWA_EDIT_IDLE_MS+50-Date.now()):0;
  pwaUpdateRetryTimer=setTimeout(()=>{pwaUpdateRetryTimer=null;void evaluateAutomaticPwaUpdate();},Math.max(0,Number(delay)||0,editDelay));
  return true;
}
async function evaluateAutomaticPwaUpdate(){
  const state=pwaLatestUpdateState;
  if(!state||!state.updateReady||state.applying||pwaUpdateEvaluationRunning)return false;
  const readOnlyFollower=state.externalUpdate===true&&AppOwnership.status().state===OWNERSHIP_STATES.SECONDARY;
  if(state.bootState==='mismatch'&&!readOnlyFollower){pwaAutomaticBlockMessage='The loaded release needs confirmation. Use Update Now after saving current work.';return false;}
  pwaUpdateEvaluationRunning=true;
  try{
    const blocker=pwaUpdateBlockReason({automatic:true,external:state.externalUpdate===true});
    if(blocker){pwaAutomaticBlockMessage=blocker;return false;}
    if(TASKS.length&&!pwaAppliedPlanEnded()&&!(state.externalUpdate&&AppOwnership.status().state===OWNERSHIP_STATES.SECONDARY)){
      pwaAutomaticBlockMessage='Update queued. It will install when the applied Plan ends and saved state is verified.';
      return false;
    }
    await backUpBeforeUpdate();
    pwaAutomaticBlockMessage='Updating Study Director…';
    return PwaLifecycle.apply({automatic:true});
  }catch(error){
    AppDiagnostics.capture('pwa.auto-update',error,'warn');
    pwaAutomaticBlockMessage=`Automatic update is waiting because saved state could not be verified${error&&error.message?`: ${error.message}`:'.'}`;
    return false;
  }finally{
    pwaUpdateEvaluationRunning=false;
    if(pwaLatestUpdateState&&!pwaLatestUpdateState.applying)renderPwaUpdateStatus(pwaLatestUpdateState);
    if(pwaLatestUpdateState?.updateReady&&!pwaLatestUpdateState.applying&&pwaUpdateRetryTimer===null)schedulePwaUpdateEvaluation(pwaUpdateRetryDelay());
  }
}
function pwaUpdateActionLabel(){
  return AppOwnership.status().state===OWNERSHIP_STATES.PRIMARY&&(isLiveTrackableTimer()&&!TimerState.paused&&TimerState.mode===TIMER_MODES.RUNNING||PracticePacer.status().running)?'Pause & Update':'Update Now';
}
async function applyPwaUpdateFromUi(){
  const state=PwaLifecycle.status();
  if(state.applying)return false;
  if(!state.updateReady){clearPwaUpdateCheckFailure();return checkPwaUpdateIfDue({force:true});}
  const preflightReason=pwaUpdateBlockReason({automatic:false,ignoreActiveTimers:true,external:state.externalUpdate===true});
  if(preflightReason){
    pwaAutomaticBlockMessage=preflightReason;
    renderPwaUpdateStatus(state);
    return false;
  }
  if(AppOwnership.status().state===OWNERSHIP_STATES.PRIMARY){
    if(isLiveTrackableTimer()&&!TimerState.paused&&TimerState.mode===TIMER_MODES.RUNNING)togglePause();
    if(PracticePacer.status().running)PracticePacer.toggle();
  }
  await backUpBeforeUpdate();
  return PwaLifecycle.apply();
}
function renderPwaUpdateStatus(state){
  const control=document.getElementById('pwa-update-control');
  const button=document.getElementById('pwa-update-apply');
  const message=document.getElementById('pwa-update-message');
  if(!control||!button||!message)return;
  const previous=pwaLatestUpdateState;
  pwaLatestUpdateState=state;scheduleSyncStatus();
  button.disabled=!!state.applying||!!state.checking;
  button.textContent=state.applying?'Updating…':state.checking?'Checking…':!state.updateReady&&state.bootState==='pending'?'Retry confirmation':state.registrationError||state.checkError&&!state.updateReady?'Retry update check':pwaUpdateActionLabel();
  const progress=document.getElementById('pwa-update-progress-message');if(progress)progress.textContent=state.message||'Preparing the update…';
  const lifecycleMessage=String(state.message||'');
  const lifecyclePriority=state.applying||['blocked','registering','checking','downloading','installation-failed','registration-failed','boot-failed','boot-pending'].includes(state.phase);
  const messageText=lifecyclePriority?lifecycleMessage:pwaAutomaticBlockMessage||lifecycleMessage||'Saved state will be checked before reload.';
  message.textContent=messageText;
  NoticeCoordinator.publish('update',{
    visible:!!state.updateReady||!!state.applying||!!state.registrationError||!!state.checkError||['mismatch','pending'].includes(state.bootState)||['checking','downloading'].includes(state.phase),kind:'update',
    title:state.applying?'Updating Study Director':state.registrationError?'Update checks unavailable':state.checkError?'Update installation needs attention':state.bootState==='pending'?'Update confirmation pending':state.bootState==='mismatch'?'Update not confirmed':state.checking?'Checking for an update':'Study Director update available',message:messageText,
    actionLabel:button.textContent
  });
  if(state.checkError&&!previous?.checkError&&!pwaUpdateCheckRunning){recordPwaUpdateCheckFailure();schedulePwaUpdateCheck();}
  if(!state.updateReady||state.applying){
    if(pwaUpdateRetryTimer!==null){clearTimeout(pwaUpdateRetryTimer);pwaUpdateRetryTimer=null;}
    return;
  }
  const newlyReady=!previous?.updateReady||previous.waitingReleaseId!==state.waitingReleaseId;
  if(newlyReady)schedulePwaUpdateEvaluation(PWA_UPDATE_READY_DELAY_MS);
  else if(pwaUpdateRetryTimer===null)schedulePwaUpdateEvaluation(pwaUpdateRetryDelay());
}
function pwaLastUpdateCheckAt(){
  let stored=0;
  try{const value=Number(AppData.local.getText(STORAGE_KEYS.pwaUpdateCheck,'')||0);stored=Number.isFinite(value)&&value>0?value:0;}catch(error){}
  return Math.max(stored,pwaLastSuccessfulUpdateCheckMemoryAt);
}
function markPwaUpdateCheck(at=Date.now()){
  const exact=Math.max(1,Math.floor(Number(at)||Date.now()));
  pwaLastSuccessfulUpdateCheckMemoryAt=Math.max(pwaLastSuccessfulUpdateCheckMemoryAt,exact);
  try{return AppData.local.setText(STORAGE_KEYS.pwaUpdateCheck,String(exact));}catch(error){return false;}
}
function pwaUpdateCheckDue(now=Date.now()){
  const last=pwaLastUpdateCheckAt();
  return !last||Math.max(0,Number(now)||Date.now())-last>=PWA_UPDATE_CHECK_INTERVAL_MS;
}
function pwaUpdateCheckBackoffMs(failureCount=pwaUpdateCheckFailureCount){
  const exponent=Math.max(0,Math.min(8,Math.floor(Number(failureCount)||1)-1));
  return Math.min(PWA_UPDATE_CHECK_RETRY_MAX_MS,PWA_UPDATE_CHECK_RETRY_BASE_MS*(2**exponent));
}
function clearPwaUpdateCheckFailure(){pwaUpdateCheckFailureCount=0;pwaUpdateCheckRetryAt=0;}
function recordPwaUpdateCheckFailure(at=Date.now()){
  pwaUpdateCheckFailureCount=Math.min(9,pwaUpdateCheckFailureCount+1);
  pwaUpdateCheckRetryAt=Math.max(1,Math.floor(Number(at)||Date.now()))+pwaUpdateCheckBackoffMs();
  return pwaUpdateCheckRetryAt;
}
function clearPwaUpdateCheckTimer(){pwaUpdateCheckDueAt=0;if(pwaUpdateCheckTimer!==null){clearTimeout(pwaUpdateCheckTimer);pwaUpdateCheckTimer=null;}}
function schedulePwaUpdateCheck(minimumDelay=0){
  clearPwaUpdateCheckTimer();
  const lifecycle=PwaLifecycle.status();if(!lifecycle.supported)return false;
  if(AppOwnership.status().state!==OWNERSHIP_STATES.PRIMARY)return false;
  if(lifecycle.registrationError&&!pwaUpdateCheckRetryAt)recordPwaUpdateCheckFailure();
  const now=Date.now(),last=pwaLastUpdateCheckAt(),dueIn=lifecycle.registered&&!lifecycle.checkError&&last?Math.max(0,last+PWA_UPDATE_CHECK_INTERVAL_MS-now):0,retryIn=pwaUpdateCheckRetryAt?Math.max(0,pwaUpdateCheckRetryAt-now):0;
  const delay=Math.max(dueIn,retryIn,Math.max(0,Number(minimumDelay)||0));
  pwaUpdateCheckDueAt=now+delay;pwaUpdateCheckTimer=setTimeout(()=>{pwaUpdateCheckTimer=null;pwaUpdateCheckDueAt=0;void checkPwaUpdateIfDue();},delay);
  return true;
}
function pwaProviderNetworkBusy(){return BackupProviderRuntime.status().busy===true||BackupProviderRuntime.locationStatus('google-drive')?.backingUp===true;}
async function checkPwaUpdateIfDue({force=false}={}){
  const lifecycle=PwaLifecycle.status();
  if(!lifecycle.supported||pwaUpdateCheckRunning||!force&&(lifecycle.registered&&!lifecycle.checkError&&!pwaUpdateCheckDue()||pwaUpdateCheckRetryAt>Date.now()))return false;
  const ownership=AppOwnership.status();
  if(ownership.state!==OWNERSHIP_STATES.PRIMARY)return false;
  if(navigator.onLine===false)return false;
  // Automatic update discovery must not compete with an active provider transfer.
  // Manual checks remain explicit user actions; they are never delayed here.
  if(!force&&pwaProviderNetworkBusy()){schedulePwaUpdateCheck(30000);return false;}
  pwaUpdateCheckRunning=true;let deferredForProvider=false;
  const perform=async()=>{
    if(!force&&(PwaLifecycle.status().registered&&!PwaLifecycle.status().checkError&&!pwaUpdateCheckDue()||pwaUpdateCheckRetryAt>Date.now()))return false;
    // A transfer may have started while waiting for the cross-tab update lock.
    if(!force&&pwaProviderNetworkBusy()){deferredForProvider=true;return false;}
    const success=await PwaLifecycle.checkForUpdate();
    if(success){markPwaUpdateCheck();clearPwaUpdateCheckFailure();return true;}
    recordPwaUpdateCheckFailure();
    return false;
  };
  try{
    if(navigator.locks&&typeof navigator.locks.request==='function'){
      return await navigator.locks.request(PWA_UPDATE_CHECK_LOCK,{mode:'exclusive'},perform);
    }
    return await perform();
  }catch(error){recordPwaUpdateCheckFailure();AppDiagnostics.capture('pwa.update-check-scheduler',error,'warn');return false;}
  finally{pwaUpdateCheckRunning=false;schedulePwaUpdateCheck(deferredForProvider?30000:0);}
}
const PwaLifecycle=PwaLifecycleModule.createCoordinator(Object.freeze({
  configuration:Object.freeze({assetId:'__SD_PAGE_ASSET_ID__',buildId:'@@SD_BUILD_ID@@',scope:'./',workerUrl:trustedAssetURL('./sw.js'),reloadSessionKey:SESSION_STORAGE_KEYS.pwaReload}),
  environment:Object.freeze({
    AbortController,
    MessageChannel:typeof MessageChannel==='function'?MessageChannel:null,
    clearTimeout:timer=>clearTimeout(timer),document,navigator,
    setTimeout:(callback,delay)=>setTimeout(callback,delay),window
  }),
  hooks:Object.freeze({
    capture:(scope,error)=>AppDiagnostics.capture(scope,error,'warn'),
    prepare:prepareApplicationUpdate,
    reserve:reserveApplicationUpdate,
    render:renderPwaUpdateStatus
  })
}));
if(!Object.isFrozen(PwaLifecycle)||PwaLifecycle.format!=='study-director.pwa-lifecycle'||PwaLifecycle.contractVersion!==1){
  throw new Error('Study Director PWA lifecycle coordinator is unavailable or incompatible.');
}
document.addEventListener('input',event=>{
  const target=event.target instanceof Element?event.target:null;
  if(!target||!(target.isContentEditable||target.matches('input,textarea,select,[contenteditable]:not([contenteditable="false"])')))return;
  pwaLastEditableInputAt=Date.now();
  schedulePwaUpdateEvaluation(PWA_EDIT_IDLE_MS+50);
},true);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){schedulePwaUpdateCheck(250);schedulePwaUpdateEvaluation(250);}});
window.addEventListener('focus',()=>{schedulePwaUpdateCheck(250);schedulePwaUpdateEvaluation(250);});
window.addEventListener('online',()=>{schedulePwaUpdateCheck(250);schedulePwaUpdateEvaluation(250);});
window.addEventListener('storage',event=>{if(event.key===STORAGE_KEYS.pwaUpdateCheck)schedulePwaUpdateCheck();});
/* INSIGHTS AND PLUGIN BOUNDARY */
// Read-only Insights boundary. Insights modules should read through this object
// and return derived metrics without mutating records, notes, timer state, or storage.
function normalizeInsightsRecordWindowOptions(options,summaries){return AppData.dailyRecords.normalizeWindow(options,summaries);}
const PREVIEW_SAMPLE_DAYS=28;
const PreviewRuntime=(()=>{
  let preview=null,revision=0;
  const providers=new Map();
  const TARGETS=Object.freeze(new Set(['insights']));
  const PROVIDER_TABS=Object.freeze({insights:'guide'});
  function normalizeTarget(target='insights'){
    const clean=String(target||'insights').trim();
    return TARGETS.has(clean)?clean:'insights';
  }
  function normalizeRecords(records){
    return clampArray(records,PREVIEW_SAMPLE_DAYS).map(record=>{
      const clean=materializeDailyRecordView(record);
      return clean;
    }).filter(r=>r&&isValidIsoDate(r.date)).sort((a,b)=>a.date.localeCompare(b.date));
  }
  function active(target=''){
    return !!(preview&&(!target||preview.target===target));
  }
  function status(target=''){
    return active(target)
      ? {type:'demo',label:preview.label,mode:'preview',available:true,target:preview.target,revision:`preview:${preview.revision}`}
      : {type:'real',label:'Saved Data',mode:'real',available:false,target:target||null};
  }
  function summaries(target){
    if(!active(target))return null;
    return preview.records.map(record=>{
      const summary=buildDailyRecordSummary(record);
      return sanitizeDailyRecordSummary(summary);
    }).filter(Boolean).sort((a,b)=>a.date.localeCompare(b.date));
  }
  function applyWindow(records,options={}){
    const opts=options&&typeof options==='object'?options:{};
    if(!(opts.windowDays||opts.from||opts.to||opts.limit))return records;
    const window=normalizeInsightsRecordWindowOptions(opts,summaries(preview.target));
    const allow=new Set(window.dates);
    return records.filter(record=>allow.has(record.date));
  }
  function records(target,options={}){
    if(!active(target))return null;
    return applyWindow(preview.records,options);
  }
  function setRecords(records,options={}){
    const opts=options&&typeof options==='object'?options:{};
    const label=clampText(opts.label||'Sample Data',80);
    const target=normalizeTarget(opts.target);
    revision+=1;
    preview=Object.freeze({target,label,revision,records:normalizeRecords(records)});
    return status(target);
  }
  function registerProvider(target,provider){
    const cleanTarget=normalizeTarget(target);
    if(typeof provider!=='function')return false;
    providers.set(cleanTarget,provider);
    return true;
  }
  async function useSample(options={}){
    const opts=options&&typeof options==='object'?options:{};
    const target=normalizeTarget(opts.target);
    let provider=providers.get(target);
    if(!provider){
      const providerTab=PROVIDER_TABS[target];
      if(providerTab)await PluginRuntime.requestTab(providerTab);
      provider=providers.get(target);
    }
    if(!provider)return {ok:false,status:status(target)};
    try{
      const records=provider({today:isValidIsoDate(opts.today)?opts.today:todayISO()});
      const normalized=normalizeRecords(records);
      if(normalized.length!==PREVIEW_SAMPLE_DAYS)throw new Error(`Expected ${PREVIEW_SAMPLE_DAYS} sample records.`);
      setRecords(normalized,{target,label:opts.label||`Sample ${PREVIEW_SAMPLE_DAYS} days`});
      return {ok:true,status:status(target)};
    }catch(error){
      AppDiagnostics.capture('preview.sample-provider',error);
      return {ok:false,status:status(target)};
    }
  }
  function clear(target=''){
    if(!target||active(target)){if(preview)revision+=1;preview=null;}
    return status(target);
  }
  function clearExcept(target){
    if(preview&&preview.target!==target){revision+=1;preview=null;}
    return status(target);
  }
  return Object.freeze({registerProvider,useSample,setRecords,clear,clearExcept,status,summaries,records});
})();
const InsightsDataSource=Object.freeze({
  async getDailySnapshot(){
    const previewRecords=PreviewRuntime.records('insights',{});
    if(previewRecords)return Object.freeze({records:previewRecords,summaries:PreviewRuntime.summaries('insights')||[]});
    const snapshot=await AppData.dailyRecords.insightsSnapshot({yieldProjection:true});
    return Object.freeze({records:snapshot.records,summaries:snapshot.summaries.filter(summary=>summary?.recordKind==='study')});
  },
  async getDailySummaries(){
    const preview=PreviewRuntime.summaries('insights');
    if(preview)return preview;
    return (await AppData.dailyRecords.sortedSummaries()).filter(summary=>summary?.recordKind==='study');
  },
  async getDailyRecords(options={}){
    const preview=PreviewRuntime.records('insights',options);
    if(preview)return preview;
    return AppData.dailyRecords.window({...options,yieldProjection:true});
  },
  getRecordSource(){
    return PreviewRuntime.status('insights');
  },
  async getDatasetRevision(){
    if(PreviewRuntime.status('insights').type==='demo')return null;
    return AppData.dailyRecords.datasetRevision();
  },
  getCurrentStudyDate(){
    return todayISO();
  }
});
const AppInsights = Object.freeze({
  notifications:NoticeCoordinator.presentation('insights'),
  dataSource: InsightsDataSource
});
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
  sample('App update',()=>PwaLifecycle.status(),pwa=>[{job:'App update',state:pwa.phase,busy:pwa.applying||pwa.reloading||pwa.checking,pending:pwa.updateReady,scheduled:pwaUpdateCheckDueAt>0,nextEligibleAt:pwaUpdateCheckDueAt?new Date(pwaUpdateCheckDueAt).toISOString():'',completedAt:pwaLastUpdateCheckAt()?new Date(pwaLastUpdateCheckAt()).toISOString():'',retryAttempt:pwaUpdateCheckFailureCount,bootState:pwa.bootState,cacheState:pwa.cacheState||'',reason:pwa.cacheReason||''}]);
  sample('Attachment verification',()=>AttachmentIntegrityJob.status(),value=>[{job:'Attachment verification',...value,completedAt:attachmentIntegrityView?.checkedAt||'',attemptedAt:attachmentIntegrityView?.attemptedAt||'',cursor:attachmentIntegrityView?.progress?.cursor||0,total:attachmentIntegrityView?.progress?.total||0,coverage:'presence-and-size'}]);
  for(const [target,value] of Object.entries(repositoryIntegrityView?.locations||{})){const bound=!!value?.repositoryScope&&repositoryIntegrityBoundScopes[target]===value.repositoryScope;states.push({job:target+' verification',reason:bound?value?.blockedReason||'':'awaiting-connection',state:!bound?'unbound':value?.recheck?'recheck-pending':value?.partial||value?.cursor?'partial':value?.lastOutcome||'never',completedAt:bound?value?.completedAt||'':'',attemptedAt:bound?value?.attemptedAt||'':'',failedAt:bound?value?.failedAt||'':'',progressBytes:bound?value?.partial?.stored?.offset||0:0,quarantined:bound?value?.quarantinedObjectIds?.length||0:0,history:bound?(value?.history||[]).map(row=>row.at+':'+row.outcome+(row.complete?':full':'')).join(' | '):''});}
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
  'connect-device-backup': ()=>connectDeviceBackupWithRecovery(),
  'backup-now': ()=>backUpEverywhere(),
  'cancel-device-backup': ()=>DeviceBackup.cancelForeground(),
  'toggle-backup-settings': ev=>toggleBackupSettings(ev.target.closest('[data-backup-settings]')?.dataset.backupSettings),
  'disconnect-device-backup': ()=>DeviceBackup.disconnect(),
  'open-version-history': ()=>withBackupPassword(()=>BackupRecoveryHost.history.open()),
  'connect-drive-backup': connectDriveForProfile,
  'cancel-drive-backup': ()=>BackupProviderRuntime.cancelForeground(undefined,'google-drive'),
  'disconnect-drive-backup': ()=>BackupProviderRuntime.disconnect('google-drive'),
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
  'export-backup': BackupController.exportLocal,
  'clear-library': LibraryView.clearAll,
  'backup-protection': async()=>{try{await BackupProtection.manage();}catch(error){if(error.name!=='AbortError')setBackupProtectionSurfaceError(error);}},
  'copy-backup-diagnostics': ()=>copyBackupDiagnostics(),
  'cancel-standalone-import': ()=>BackupController.cancelStandalone(),
  'pick-import-file': async()=>{
    const input=document.getElementById('import-file');
    try{const file=await Exports.open(input);if(file){NoticeCoordinator.resolveEvent('file','file-open');await BackupController.importLocal({target:{files:[file],value:''}});}}
    catch(error){if(error?.name==='AbortError')return;BackupPresentation.condition('file','file-open','Could not open backup: '+String(error&&error.message||error));}
  },
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
  'close-drive-connect': ()=>{endDriveConnectCard();return true;},
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
  'import-backup': ev=>BackupController.importLocal(ev),
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
    const mutationBlocked=!!pwaUpdateReservation||!!(AppMutationCoordinator&&AppMutationCoordinator.blocksUi());
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
  void installVerifiedRecoveryFreshness().catch(error=>AppDiagnostics.capture('backup.freshness-startup',error,'warn'));
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
  // The indicator also follows the network and keeps its times current.
  for(const type of ['online','offline'])window.addEventListener(type,scheduleSyncStatus);
  // Background sync waits while offline (Drive reports it unavailable); back
  // online, it goes at once rather than at its next retry.
  window.addEventListener('online',()=>{try{BackupProviderRuntime.wakeBackground('online');}catch(error){AppDiagnostics.capture('backup-provider.online-wake',error,'warn');}});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')scheduleSyncStatus();});
  setInterval(()=>{if(document.visibilityState==='visible')scheduleSyncStatus();},30*1000);
  // The indicator, the panel's counts and the Connect card follow each step
  // and count of a sync or upload.
  BackupPresentation.subscribe(scheduleSyncStatus);
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
    restoreTheme:()=>applyTheme(PRESENTATION_KERNEL.readStoredTheme((key,fallback)=>AppData.local.getText(key,fallback)),{persist:false}),restorePresentation:()=>applyPresentation(PRESENTATION_KERNEL.readStoredPresentation((key,fallback)=>AppData.local.getText(key,fallback)),{persist:false}),restoreFontScale:()=>applyFontScale(readFontScale()),
    hydratePlan:()=>PlanData.hydrate(),readRestoreJournal:()=>AppData.restoreJournal.read(),waitForClosedTabLease,recoverRestore:()=>BackupController.recoverInterruptedRestore(),tickClock,updateHeader:updateHeaderInfo,setInterval:(fn,ms)=>setInterval(fn,ms),setTimeout:(fn,ms)=>setTimeout(fn,ms),
    hasTasks:()=>TASKS.length>0,showEmpty,canMutate:appCanMutate,restoreSession:attemptAutoRestoreActiveSession,refreshBadge:refreshPersistedSessionBadge,inspectStorage:inspectStorageCapability,offerInstallNotice:()=>CapabilityInstallation.offerInstallNotice(),topology:()=>IndexedDb.topology(),
    setFastFenceReady:value=>{backupFastFenceReady=value;},reseedEpoch:()=>AppData.mutationEpoch.reseed(),capture:AppDiagnostics.capture,reconcileChangeClock:reconcileStartupChangeClock,resumeStorageReset:resumeUnresolvedStorageReset,
    installBackground:installBackgroundOwners,scheduleMaintenance:scheduleDataMaintenance,wakeBackground:reason=>BackgroundOperations.wake(reason),installSessionWatch,refreshKeptVersions:()=>KeptVersions.refresh(),announceUnsupported:()=>UnsupportedData.announce(),renderUnsupported:renderUnsupportedData,
    collectProfiles:()=>Profiles.collect(),askProfilePassword,collectFiles:()=>BackupFiles.collect(),preloadInsights:scheduleInsightsPreload,confirmBoot:()=>PwaLifecycle.confirmBoot(),offerDeviceRecovery:()=>offerDeviceRecoveryIfLocalEmpty({reason:'startup'}),
    reportUnsupported:()=>UnsupportedData.reportBlocked(),setPlanStatus,noticeCanCompact,getReviewDate,reconcileLifecycle:(...args)=>SessionLifecycle.reconcile(...args)
  })
}));
/* PUBLIC PLUGIN API */
PluginRuntime.registerPlaceholders();
const StudyDirectorPublicAPI=Object.freeze({
  version:APP_VERSION,
  capabilities:STUDY_DIRECTOR_CAPABILITIES,
  data:Object.freeze({
    contract:DATA_CONTRACT,
    deviceState:Object.freeze({
      readInsightsWindow:fallback=>AppData.local.getText(STORAGE_KEYS.insightsWindow,String(fallback??'')),
      writeInsightsWindow:value=>AppData.local.setText(STORAGE_KEYS.insightsWindow,String(value??''))
    })
  }),
  insights:AppInsights,
  logic:Object.freeze({
    classifyTaskOutcome,
    summarizePracticeRuns:summarizePracticeRunsForInsights
  }),
  plan:Object.freeze({
    getDraft:getPlanDraftText,
    loadDraft:loadScheduleIntoDraft
  }),
  preview:Object.freeze({
    useSample:PreviewRuntime.useSample,
    setRecords:PreviewRuntime.setRecords,
    clear:PreviewRuntime.clear
  }),
  backup:Object.freeze({
    createCheckpoint:CheckpointPipeline.create,
    inspect:CheckpointPipeline.inspect,
    releaseFile:file=>Exports.run('file.release',{file}),
    receiveStream:(stream,size,options={})=>Exports.job(()=>Exports.receiveStream(stream,size,options),{wait:true}),
    checksum:(blob,signal)=>Exports.job(()=>Exports.run('checksum',{value:blob},{signal}),{wait:true}),
    restore:CheckpointPipeline.restore,
    downloadSafetyCopy:BackupController.downloadSafetyCopy,
    limits:Object.freeze({
      maxFileBytes:APP_LIMITS.backupMaxFileBytes
    }),
    repositoryPolicy:RepositoryPolicyModule.protocol,
    // This device, named on Drive's upload markers.
    device:()=>AppData.provenance.installationId(),
    // The active profile, and who decides which Drive library it may use.
    profile:Object.freeze({id:()=>Profiles.current()?.id||'',name:()=>backupFolderName(),bind:info=>bindDriveLibrary(info),deleted:info=>driveProfileDeleted(info),controls:control=>ProfileDeletion.setLibraryControl(control)}),
    providers:Object.freeze({
      register:BackupProviderRuntime.register,
      list:BackupProviderRuntime.list
    })
  }),
  installation:Object.freeze({
    status:NativeCapabilities.status,
    prompt:NativeCapabilities.promptInstall,
    inspect:NativeCapabilities.inspectInstallation,
    showHelp:NativeCapabilities.revealInstallHelp
  }),
  appearance:Object.freeze({
    theme:Object.freeze({
      defaultId:DEFAULT_THEME_ID,
      supported:PUBLIC_THEME_METADATA,
      get:PRESENTATION_KERNEL.activeThemeId,
      set:setTheme
    }),
    presentation:Object.freeze({
      defaultId:DEFAULT_PRESENTATION_ID,
      get supported(){return PRESENTATION_KERNEL.listPresentations();},
      invariants:PRESENTATION_INVARIANTS,
      breakpoints:PRESENTATION_BREAKPOINTS,
      tokens:PRESENTATION_TOKEN_CONTRACT,
      manifest:PRESENTATION_MANIFEST,
      list:PRESENTATION_KERNEL.listPresentations,
      register:registerPresentationPack,
      get:PRESENTATION_KERNEL.activePresentationId,
      set:setPresentation
    })
  }),
  ui:Object.freeze({
    registerTab:UiTabRegistry.registerTab,
    goTab,
    navigationStatus:()=>NavigationController.status(),
    workspaceHistory:WorkspaceHistoryPublic
  }),
  plugins:Object.freeze({
    status:PluginRuntime.status
  }),
  registerPlugin:registerStudyDirectorPlugin
});
window.StudyDirector=StudyDirectorPublicAPI;
window.dispatchEvent(new CustomEvent(STUDY_DIRECTOR_READY_EVENT,{detail:Object.freeze({version:StudyDirectorPublicAPI.version,theme:PRESENTATION_KERNEL.activeThemeId(),presentation:PRESENTATION_KERNEL.activePresentationId()})}));
SessionLifecycle.invalidate('app-restart',{date:todayISO(),autoDate:true,reconcile:false});
StartupLifecycle.start();
void PwaLifecycle.install().then(()=>schedulePwaUpdateCheck(750));
})();
