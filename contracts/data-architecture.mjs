import {
  INDEXED_DB,OPFS_IDENTITIES as CURRENT_OPFS_IDENTITIES,
  CACHE_STORAGE_IDENTITIES,EXTERNAL_REPOSITORY_IDENTITIES
} from './canonical-identities.mjs';
const freeze=Object.freeze;

export const PERSISTENCE_CLASSES=freeze({
  canonical:'canonical-user-data',
  derived:'derived-rebuildable-data',
  recovery:'recovery-data',
  deviceLocal:'device-local-coordination-state',
  external:'external-backup-export-representation'
});

const ROLE_CLASS=freeze({
  canonical:PERSISTENCE_CLASSES.canonical,'canonical-live':PERSISTENCE_CLASSES.canonical,'canonical-metadata':PERSISTENCE_CLASSES.canonical,
  'canonical-draft':PERSISTENCE_CLASSES.canonical,'canonical-deletion-history':PERSISTENCE_CLASSES.canonical,'canonical-preferences':PERSISTENCE_CLASSES.canonical,
  'canonical-bytes':PERSISTENCE_CLASSES.canonical,derived:PERSISTENCE_CLASSES.derived,'derived-revision':PERSISTENCE_CLASSES.derived,'derived-health':PERSISTENCE_CLASSES.derived,'derived-performance':PERSISTENCE_CLASSES.derived,
  recovery:PERSISTENCE_CLASSES.recovery,'recovery-temporary':PERSISTENCE_CLASSES.recovery,'recovery-journal':PERSISTENCE_CLASSES.recovery,
  coordination:PERSISTENCE_CLASSES.deviceLocal,operational:PERSISTENCE_CLASSES.deviceLocal,'coordination-identity':PERSISTENCE_CLASSES.deviceLocal,preference:PERSISTENCE_CLASSES.deviceLocal,
  'startup-mirror':PERSISTENCE_CLASSES.deviceLocal,'security-policy':PERSISTENCE_CLASSES.deviceLocal,'backup-configuration':PERSISTENCE_CLASSES.deviceLocal,'reconciliation-base':PERSISTENCE_CLASSES.deviceLocal,
  'external-backup':PERSISTENCE_CLASSES.external,'explicit-export':PERSISTENCE_CLASSES.external
});
function surface(role,owner,protection,lifecycle,schema='',details={}){
  const authorityClass=ROLE_CLASS[role];
  if(!authorityClass)throw new Error(`Persistence role ${role} has no primary authority class.`);
  const automatic=authorityClass===PERSISTENCE_CLASSES.canonical?{canonicalAuthority:true}:authorityClass===PERSISTENCE_CLASSES.derived?{canonicalAuthority:false}:authorityClass===PERSISTENCE_CLASSES.recovery?{canonicalAuthority:false}:authorityClass===PERSISTENCE_CLASSES.deviceLocal?{canonicalAuthority:false,portable:false}:authorityClass===PERSISTENCE_CLASSES.external?{canonicalAuthority:false,liveAuthority:false}:{};
  return freeze({...automatic,authorityClass,role,owner,protection,lifecycle,...(schema?{schema}:{}),...details});
}
function containerSurface(role,owner,protection,lifecycle,schema,contains){return freeze({container:true,authorityClass:null,role,owner,protection,lifecycle,schema,contains});}


// Authoritative durable localStorage identities. Current runtime code receives
// these through the build rather than minting persistence keys ad hoc.
export const LOCAL_STORAGE_KEYS=freeze({
  recovery:'studyDirector.activeRecovery.v1',
  appOwner:'studyDirector.appOwner.v1',
  mutationLock:'studyDirector.mutationLock.v1',
  storageHealth:'studyDirector.storageHealth.v2',
  installationId:'studyDirector.installationId.v1',
  deletionRecovery:'studyDirector.deletionRecovery.v1',
  fallbackDailyRecords:'studyDirector.dailyRecordsFallback.v1',
  noteRescue:'studyDirector.noteRescue.v1',
  fontScale:'studyDirector.fontScale.v1',
  keepScreenAwake:'studyDirector.keepScreenAwake.v1',
  installNoticeShown:'studyDirector.installNoticeShown.v1',
  systemAlerts:'studyDirector.systemAlerts.v1',
  theme:'studyDirector.theme.v1',
  presentation:'studyDirector.presentation.v1',
  pwaUpdateCheck:'studyDirector.pwaUpdateCheck.v1',
  insightsWindow:'studyDirector.insights.window.v1',
  libraryView:'studyDirector.library.view.v1',
  driveSession:'studyDirector.driveSession.v1',
  profiles:'studyDirector.profiles.v1'
});

// Profiles (5.3): these belong to the device and are shared by every profile
// on it. Every other durable name belongs to one profile: the first profile
// keeps the plain names, a later one adds ~<its scope> (IndexedDB, browser
// storage, attachment files, locks and the Device Folder repository).
export const DEVICE_WIDE_LOCAL_STORAGE_KEYS=freeze(['installationId','installNoticeShown','pwaUpdateCheck','profiles']);
export const PROFILE_SCOPE_SEPARATOR='~';

export const SESSION_STORAGE_KEYS=freeze({
  appTab:'studyDirector.appTab.v1',
  pwaReload:'studyDirector.pwaReload.v1',
  notifications:'studyDirector.notifications.v1'
});


// One authoritative identity map for the heterogeneous appMeta store. Names are
// stable; a record's version lives inside its value.
export const APP_META_KEYS=freeze({
  planDraft:'planDraft',
  planLibrary:'planLibrary',
  personalPreferences:'personalPreferences',
  canonicalMutationEpoch:'canonicalMutationEpoch',
  backupPreparationUnitPrefix:'backupPreparationUnit:',
  insightsDatasetRevision:'insightsDatasetRevision',
  dataMaintenance:'dataMaintenance',
  savedDayDeletionPrefix:'savedDayDeletion:',
  noteDeletionPrefix:'noteDeletion:',
  attachmentDeletionPrefix:'attachmentDeletion:',
  pendingReviewPrefix:'pendingReview:',
  libraryClearJournalState:'libraryClearJournalState',
  libraryClearJournalPayloadPrefix:'libraryClearJournalPayload:',
  restoreJournalState:'restoreJournalState',
  restoreJournalPayload:'restoreJournalPayload',
  mutationLease:'mutationLease',
  verifiedRecoveryBackups:'verifiedRecoveryBackups',
  backupProtection:'backupProtection',
  attachmentIntegrityAudit:'attachmentIntegrityAudit',
  deviceFolder:'deviceFolder',
  repositoryIntegrityScrub:'repositoryIntegrityScrub',
  managedProviderBackupPending:'managedProviderBackupPending',
  repositoryMaintenancePending:'repositoryMaintenancePending',
  reconciliationBase:'reconciliationBase',
  reconciliationBaseNotePrefix:'reconciliationBaseNote:',
  reconciliationBaseDayPrefix:'reconciliationBaseDays:'
});
// Earlier names of these records: while names carried a version, and before
export const APP_META_FAMILY_COUNT=Object.keys(APP_META_KEYS).length;
export const APP_META_FAMILY_LABEL=`${APP_META_FAMILY_COUNT} typed appMeta families`;


export const APP_META_VALIDATION_OWNERS=freeze({
  repositories:freeze(['planDraft','planLibrary','personalPreferences','canonicalMutationEpoch','insightsDatasetRevision','dataMaintenance','backupPreparationUnitPrefix','savedDayDeletionPrefix','noteDeletionPrefix','attachmentDeletionPrefix','pendingReviewPrefix']),
  journals:freeze(['libraryClearJournalState','libraryClearJournalPayloadPrefix','restoreJournalState','restoreJournalPayload','mutationLease']),
  host:freeze(['verifiedRecoveryBackups','backupProtection','attachmentIntegrityAudit','deviceFolder','repositoryIntegrityScrub','managedProviderBackupPending','repositoryMaintenancePending','reconciliationBase','reconciliationBaseNotePrefix','reconciliationBaseDayPrefix'])
});

function appMetaValidationOwner(name){
  for(const [owner,names] of Object.entries(APP_META_VALIDATION_OWNERS))if(names.includes(name))return owner;
  throw new Error(`appMeta family ${name} has no validation owner.`);
}

export const OPFS_IDENTITIES=CURRENT_OPFS_IDENTITIES;

export const DATA_ARCHITECTURE=freeze({
  indexedDb:freeze({
    dailyRecords:surface('canonical','repositories','protect','retained',INDEXED_DB.stores.dailyRecords.schema),
    dailySummaries:surface('derived','repositories','protect','rebuildable-from-dailyRecords',INDEXED_DB.stores.dailySummaries.schema,{rebuildFrom:'indexedDb.dailyRecords'}),
    notes:surface('canonical','repositories','protect','retained',INDEXED_DB.stores.notes.schema),
    activeSessions:surface('canonical-live','repositories','protect','until-session-finalization',INDEXED_DB.stores.activeSessions.schema),
    appMeta:containerSurface('typed-container','app-meta-gateway','mixed','key-family-specific',INDEXED_DB.stores.appMeta.schema,APP_META_FAMILY_LABEL),
    assets:surface('canonical-metadata','attachment-storage','protect','while attachment is retained/referenced',INDEXED_DB.stores.assets.schema)
  }),
  opfs:freeze({
    attachments:surface('canonical-bytes','attachment-storage','protect','while attachment is retained/referenced'),
    backupFiles:surface('recovery-temporary','exports','protect-if-source-is-protected','while durably journaled/leased','',{protects:'external backup/export construction',created:'when a streamed backup/export requires durable scratch storage',cleared:'after verified completion, release, or stale-file collection',supersededBy:'verified external output'})
  }),
  localStorage:freeze({
    recovery:surface('recovery','repositories','protect','until canonical session settles','',{protects:'indexedDb.activeSessions',created:'when live session state needs crash recovery',cleared:'after canonical session persistence/finalization settles',supersededBy:'newer canonical ActiveSession or canonical deletion'}),
    appOwner:surface('coordination','ownership','operational','lease lifetime'),
    mutationLock:surface('coordination','host','operational','lease lifetime'),
    storageHealth:surface('operational','host','operational','bounded operational diagnostics; no user-content details'),
    installationId:surface('coordination-identity','persistence','protect-identifiers','retained'),
    deletionRecovery:surface('recovery','repositories','protect-identifiers','until the failed DailyRecord/ActiveSession delete is reconciled','',{protects:'DailyRecord/ActiveSession deletion intent',created:'when authoritative deletion cannot complete atomically',cleared:'after canonical deletion state is verified',supersededBy:'verified canonical record/deletion state'}),
    fallbackDailyRecords:surface('recovery','repositories','protect','until replayed to IndexedDB','',{protects:'indexedDb.dailyRecords',created:'when a DailyRecord cannot be persisted to IndexedDB',cleared:'after replay and verification in canonical IndexedDB',supersededBy:'verified canonical DailyRecord'}),
    noteRescue:surface('recovery','repositories','protect','until the unsaved notes it holds are saved','',{protects:'indexedDb.notes',created:'when a note save fails or the page is hidden or closed before a save finishes',cleared:'after the matching canonical Note/deletion commits',supersededBy:'newer canonical Note or deletion state',capacity:'noteRescueBytes (1 MiB), newest notes first; the save failure names any unsaved note left out'}),
    fontScale:surface('startup-mirror','host','operational','disposable mirror of appMeta portable Preferences fontScale','',{mirrorOf:'appMeta.personalPreferences.fontScale'}),
    keepScreenAwake:surface('preference','native-capabilities','operational','retained'),
    installNoticeShown:surface('preference','native-capabilities','operational','retained'),
    systemAlerts:surface('preference','host','operational','retained'),
    theme:surface('startup-mirror','host','operational','disposable mirror of appMeta portable Preferences theme','',{mirrorOf:'appMeta.personalPreferences.theme'}),
    presentation:surface('startup-mirror','host','operational','disposable mirror of appMeta portable Preferences presentation','',{mirrorOf:'appMeta.personalPreferences.presentation'}),
    pwaUpdateCheck:surface('operational','host','operational','retained'),
    insightsWindow:surface('preference','insights','operational','retained'),
    libraryView:surface('preference','library','operational','retained'),
    driveSession:surface('operational','drive','operational','until the Drive sign-in expires (about an hour), is disconnected or is rejected; keeps the sign-in across reloads and reopening'),
    profiles:surface('coordination-identity','profiles','protect-identifiers','retained; the device profile list: the active profile and each profile name, scope and Google account email')
  }),
  sessionStorage:freeze({
    appTab:surface('coordination-identity','ownership','operational','tab-session lifetime'),
    pwaReload:surface('operational','pwa-lifecycle','operational','single update/reload handoff'),
    notifications:surface('operational','notifications','protect-identifiers','this window, today only: the profile panel Recent list (pop-up and banner titles and messages, at most 20); tied to the profile; never uploaded, backed up or exported')
  }),
  cacheStorage:freeze({
    clientState:surface('operational','service-worker','operational','current client asset acknowledgements for safe shell retirement','',{identity:CACHE_STORAGE_IDENTITIES.clientState}),
    applicationShell:surface('operational','service-worker','operational','release-scoped application assets only; no user data','',{identity:CACHE_STORAGE_IDENTITIES.shellPrefix,identityKind:'release-prefix'}),
  }),
  memory:freeze({
    insightsModels:surface('derived','insights','protect','ephemeral/rebuildable','',{rebuildFrom:'canonical study records'}),
    searchIndex:surface('derived','search','protect','ephemeral/rebuildable','',{rebuildFrom:'canonical searchable records'}),
    driveAccessToken:surface('operational','drive','protect','authorization-session only; kept across reloads only through localStorage.driveSession until it expires')
  }),
  appMeta:freeze({
    exact:freeze({
      planDraft:surface('canonical-draft','repositories','protect','retained','PlanDraft.v1'),
      planLibrary:surface('canonical','repositories','protect','retained','PlanLibrary.v1'),
      personalPreferences:surface('canonical-preferences','repositories','protect','retained','PortablePreferences.v2'),
      canonicalMutationEpoch:surface('coordination','repositories','operational','replace atomically with portable canonical mutations; reseed after canonical startup validation','CanonicalMutationEpoch.v1'),
      insightsDatasetRevision:surface('derived-revision','repositories','operational','rebuildable','InsightsDatasetRevision.v2',{rebuildFrom:'canonical IndexedDB data revisions'}),
      dataMaintenance:surface('operational','repositories','operational','replace on maintenance','DataMaintenance.v6'),
      libraryClearJournalState:surface('recovery-journal','repository-journals','protect','until verified completion/rollback','LibraryClearJournalState.v1',{protects:'Library clear mutation',created:'before destructive Library clear commit',cleared:'after verified completion or rollback',supersededBy:'verified post-operation canonical state'}),
      restoreJournalState:surface('recovery-journal','repository-journals','operational','until verified completion/rollback','RestoreJournalState.v1',{protects:'checkpoint restore mutation',created:'before destructive restore commit',cleared:'after verified completion or rollback',supersededBy:'verified post-restore canonical state'}),
      restoreJournalPayload:surface('recovery-journal','repository-journals','protect','until verified completion/rollback','RestoreJournalPayload.v6',{protects:'canonical dataset rollback image',created:'before destructive restore commit',cleared:'after verified completion or rollback',supersededBy:'verified post-restore canonical state'}),
      mutationLease:surface('coordination','repository-journals','operational','lease lifetime','MutationLease.v1'),
      verifiedRecoveryBackups:surface('operational','host','operational','replace on every backup','VerifiedRecoveryBackups.v3'),
      backupProtection:surface('security-policy','exports','operational','while a backup password is set; holds a check value and the non-extractable key made from the password, never the password','BackupProtection.v3'),
      attachmentIntegrityAudit:surface('derived-health','host','protect','replace on audit; opaque identity/error details only','AttachmentIntegrityAudit.v2',{rebuildFrom:'indexedDb.assets + opfs.attachments'}),
      deviceFolder:surface('backup-configuration','device-backup','operational','while connected','DeviceFolderSettings.v4'),
      repositoryIntegrityScrub:surface('derived-health','backup','operational','transactional progress/completion bound to repository identity; opaque quarantined object ids only; no user-content details','RepositoryIntegrityScrub.v7',{rebuildFrom:'external backup repository manifests and objects'}),
      managedProviderBackupPending:surface('operational','backup','operational','until the affected managed provider successfully publishes a later current backup or is explicitly disconnected','ManagedProviderBackupPending.v1'),
      repositoryMaintenancePending:surface('operational','backup','operational','until post-commit repository retention and safe orphan reclamation complete','RepositoryMaintenancePending.v4'),
      reconciliationBase:surface('reconciliation-base','host','protect','advance atomically when a version this device shares through Drive is placed there or caught up to','ReconciliationBase.v5')
    }),
    prefixes:freeze({
      backupPreparationUnitPrefix:surface('derived-performance','repositories','operational','disposable; rebuild from canonical data after loss, uncertainty or representation change','BackupPreparationUnit.v1',{rebuildFrom:'portable canonical IndexedDB state'}),
      savedDayDeletionPrefix:surface('canonical-deletion-history','repositories','protect','retain until the same Saved Day is recreated','SavedDayDeletion.v1'),
      noteDeletionPrefix:surface('canonical-deletion-history','repositories','protect','retain until the same Note is recreated','NoteDeletion.v1'),
      attachmentDeletionPrefix:surface('canonical-deletion-history','repositories','protect-identifiers','retain until the same Attachment Library identity is explicitly restored/recreated','AttachmentDeletion.v1'),
      pendingReviewPrefix:surface('canonical','repositories','protect','a kept version stays until the person resolves it; a resolved one keeps only its id, so other devices learn of it, and the newest of those are kept','PendingReview.v2'),
      libraryClearJournalPayloadPrefix:surface('recovery-journal','repository-journals','protect','until verified completion/rollback','LibraryClearJournalChunk.v1',{protects:'canonical Library rollback chunks',created:'before destructive Library clear commit',cleared:'after verified completion or rollback',supersededBy:'verified post-operation canonical state'}),
      reconciliationBaseNotePrefix:surface('reconciliation-base','host','protect','update/delete only changed Note baselines; lazily read only for actual reconciliation conflicts','ReconciliationBaseNote.v1'),
      reconciliationBaseDayPrefix:surface('reconciliation-base','host','protect','one row of Saved-Day fingerprints per month; update/delete only changed months; read only for differing Saved Days','ReconciliationBaseDays.v2')
    }),
  }),
  external:freeze({
    deviceBackup:surface('external-backup','device-backup','protect-when-data-protection-enabled','incremental repository with deterministic 15-point tiered retention, one temporary protected Before-restore point, immutable commit markers, shared verified objects, independent provider-neutral Version History projection, Bring-in reconciliation and exact historical Version Restore','',{repositoryPrefix:EXTERNAL_REPOSITORY_IDENTITIES.backupFolderPrefix,repositoryNaming:'Study Director - <profile> - <device>, found by its marker file (profile scope and device id); the folder of earlier versions is moved into it',objectsDirectory:EXTERNAL_REPOSITORY_IDENTITIES.deviceFolderObjects,checkpointsDirectory:EXTERNAL_REPOSITORY_IDENTITIES.deviceFolderCheckpoints,commitsDirectory:EXTERNAL_REPOSITORY_IDENTITIES.deviceFolderCommits}),
    completeBackup:surface('external-backup','backup','protect-when-data-protection-enabled','user-retained/current canonical format only; public provenance + protected checkpoint manifest'),
    driveBackup:surface('external-backup','drive','protect-when-data-protection-enabled','incremental repository with deterministic 15-point tiered retention, one temporary protected Before-restore point, immutable commit markers and shared verified objects; independently projects into provider-neutral Version History while provider transport supports separate Bring-in and exact historical Version Restore orchestration','',{repositoryRoot:EXTERNAL_REPOSITORY_IDENTITIES.driveFolder,repositoryNaming:'Study Director – <profile>, renamed with the profile; found by its properties'}),
    attachmentArchive:surface('explicit-export','attachments','user-choice','user-controlled file lifetime'),
    markdownExport:surface('explicit-export','note-export','user-choice','user-controlled file lifetime'),
    zipExport:surface('explicit-export','note-export','user-choice','user-controlled file lifetime')
  })
});

export const APP_META_RUNTIME_REGISTRY=freeze(Object.fromEntries([
  ...Object.entries(DATA_ARCHITECTURE.appMeta.exact).map(([name,value])=>[name,freeze({name,kind:'exact',key:APP_META_KEYS[name],owner:value.owner,validatorOwner:appMetaValidationOwner(name),schema:value.schema,protection:value.protection})]),
  ...Object.entries(DATA_ARCHITECTURE.appMeta.prefixes).map(([name,value])=>[name,freeze({name,kind:'prefix',key:APP_META_KEYS[name],owner:value.owner,validatorOwner:appMetaValidationOwner(name),schema:value.schema,protection:value.protection})])
]));

export function assertDataArchitecture(contract=DATA_ARCHITECTURE,keys=APP_META_KEYS,localKeys=LOCAL_STORAGE_KEYS,validationOwners=APP_META_VALIDATION_OWNERS){
  if(![contract,keys,localKeys,APP_META_RUNTIME_REGISTRY].every(Object.isFrozen))throw new TypeError('Data architecture contracts must be frozen.');
  const storeNames=Object.keys(INDEXED_DB.stores);
  if(Object.keys(contract.indexedDb).sort().join('|')!==storeNames.sort().join('|'))throw new Error('IndexedDB data architecture inventory is incomplete.');
  for(const [name,value] of Object.entries(contract.indexedDb))if(typeof value.schema!=='string'||!value.schema)throw new Error(`IndexedDB data surface ${name} is missing its canonical schema.`);
  if(Object.keys(contract.localStorage).sort().join('|')!==Object.keys(localKeys).sort().join('|'))throw new Error('Current localStorage inventory differs from the authoritative identities.');
  if(!Object.isFrozen(DEVICE_WIDE_LOCAL_STORAGE_KEYS)||DEVICE_WIDE_LOCAL_STORAGE_KEYS.some(name=>!Object.hasOwn(localKeys,name)))throw new Error('Device-wide localStorage identities must be current identities.');
  const exactNames=Object.keys(contract.appMeta.exact),prefixNames=Object.keys(contract.appMeta.prefixes);
  const currentAppMetaNames=[...exactNames,...prefixNames].sort();
  const assignedValidationNames=Object.values(validationOwners).flat();
  if(Object.keys(APP_META_RUNTIME_REGISTRY).sort().join('|')!==currentAppMetaNames.join('|'))throw new Error('Runtime appMeta registry differs from the canonical appMeta inventory.');
  for(const [name,entry] of Object.entries(APP_META_RUNTIME_REGISTRY)){
    if(!Object.isFrozen(entry)||entry.name!==name||!['exact','prefix'].includes(entry.kind)||entry.key!==keys[name]||entry.owner!==(contract.appMeta[entry.kind==='exact'?'exact':'prefixes'][name]?.owner||'')||entry.validatorOwner!==appMetaValidationOwner(name)||entry.schema!==(contract.appMeta[entry.kind==='exact'?'exact':'prefixes'][name]?.schema||''))throw new Error(`Runtime appMeta registry entry ${name} is invalid.`);
  }
  if(assignedValidationNames.length!==new Set(assignedValidationNames).size)throw new Error('appMeta validation ownership is duplicated.');
  if([...assignedValidationNames].sort().join('|')!==currentAppMetaNames.join('|'))throw new Error('appMeta validation ownership is incomplete.');
  for(const name of [...exactNames,...prefixNames])if(typeof keys[name]!=='string'||!keys[name])throw new Error(`appMeta key ${name} is missing.`);
  const allIdentities=[...Object.values(localKeys),...exactNames.map(name=>keys[name]),...prefixNames.map(name=>keys[name])];
  if(new Set(allIdentities).size!==allIdentities.length)throw new Error('Durable storage identities must be unique across canonical registries.');
  const prefixes=prefixNames.map(name=>keys[name]);
  for(const prefix of prefixes)for(const identity of allIdentities)if(identity!==prefix&&identity.startsWith(prefix))throw new Error(`Durable identity ${identity} collides with prefix ${prefix}.`);
  const allowedProtection=new Set(['protect','mixed','protect-identifiers','operational','protect-if-source-is-protected','protect-when-data-protection-enabled','user-choice']);
  const allowedRoles=new Set(['canonical','canonical-live','canonical-metadata','canonical-draft','canonical-deletion-history','canonical-preferences','derived','coordination-outbox','canonical-bytes','recovery-temporary','recovery','coordination','operational','coordination-identity','preference','startup-mirror','derived-revision','derived-performance','recovery-journal','security-policy','derived-health','backup-configuration','reconciliation-base','external-backup','explicit-export']);
  const primaryClasses=new Set(Object.values(PERSISTENCE_CLASSES));
  const validate=(label,value)=>{
    if(!value||!Object.isFrozen(value)||!allowedRoles.has(value.role)||typeof value.owner!=='string'||!value.owner||!allowedProtection.has(value.protection)||typeof value.lifecycle!=='string'||!value.lifecycle||!primaryClasses.has(value.authorityClass))throw new Error(`Data surface ${label} is invalid or lacks one primary persistence class.`);
    if(value.authorityClass===PERSISTENCE_CLASSES.canonical&&value.canonicalAuthority!==true)throw new Error(`Canonical surface ${label} is not marked as the canonical authority.`);
    if(value.authorityClass!==PERSISTENCE_CLASSES.canonical&&value.canonicalAuthority!==false)throw new Error(`Non-canonical surface ${label} must explicitly reject canonical authority.`);
    if(value.authorityClass===PERSISTENCE_CLASSES.derived&&typeof value.rebuildFrom!=='string')throw new Error(`Derived surface ${label} does not identify its rebuild source.`);
    if(value.authorityClass===PERSISTENCE_CLASSES.recovery&&['protects','created','cleared','supersededBy'].some(field=>typeof value[field]!=='string'||!value[field]))throw new Error(`Recovery surface ${label} does not define its protected entity/lifecycle.`);
    if(value.authorityClass===PERSISTENCE_CLASSES.deviceLocal&&value.portable!==false)throw new Error(`Device-local surface ${label} is not explicitly non-portable.`);
    if(value.role==='startup-mirror'&&(typeof value.mirrorOf!=='string'||!value.mirrorOf))throw new Error(`Startup mirror ${label} does not identify its canonical source.`);
    if(value.authorityClass===PERSISTENCE_CLASSES.external&&value.liveAuthority!==false)throw new Error(`External representation ${label} must not be a live authority.`);
  };
  for(const [group,entries] of Object.entries(contract)){
    if(group==='appMeta'){
      for(const [family,families] of Object.entries(entries))for(const [name,value] of Object.entries(families)){
        validate(`appMeta.${family}.${name}`,value);
        if(typeof value.schema!=='string'||!value.schema)throw new Error(`appMeta.${family}.${name} is missing its canonical value schema.`);
      }
      continue;
    }
    for(const [name,value] of Object.entries(entries)){
      if(group==='indexedDb'&&name==='appMeta'){
        if(!value.container||value.authorityClass!==null||value.role!=='typed-container'||value.contains!==APP_META_FAMILY_LABEL)throw new Error('Physical appMeta store must be classified only through its typed logical families.');
        continue;
      }
      validate(`${group}.${name}`,value);
    }
  }
  if(Object.values(contract.localStorage).some(value=>value.authorityClass===PERSISTENCE_CLASSES.canonical))throw new Error('LocalStorage must not own canonical user data.');
  for(const name of ['theme','presentation','fontScale'])if(contract.localStorage[name].authorityClass!==PERSISTENCE_CLASSES.deviceLocal||!contract.localStorage[name].mirrorOf.startsWith('appMeta.personalPreferences.'))throw new Error(`Appearance mirror ${name} is not disposable/non-authoritative.`);
  if(contract.cacheStorage.applicationShell.identity!==CACHE_STORAGE_IDENTITIES.shellPrefix)throw new Error('Cache Storage identities drifted from the authoritative identity contract.');
  if(contract.external.deviceBackup.repositoryPrefix!==EXTERNAL_REPOSITORY_IDENTITIES.backupFolderPrefix)throw new Error('Device repository prefix drifted.');
  return true;
}
assertDataArchitecture();
