import {
  INDEXED_DB,OBSOLETE_INDEXED_DB,OPFS_IDENTITIES as CURRENT_OPFS_IDENTITIES,OBSOLETE_OPFS_IDENTITIES as CURRENT_OBSOLETE_OPFS_IDENTITIES,
  CACHE_STORAGE_IDENTITIES,EXTERNAL_REPOSITORY_IDENTITIES
} from './canonical-identities.mjs';
const freeze=Object.freeze;

export const PERSISTENCE_CLASSES=freeze({
  canonical:'canonical-user-data',
  derived:'derived-rebuildable-data',
  recovery:'recovery-data',
  deviceLocal:'device-local-coordination-state',
  migration:'migration-compatibility-state',
  external:'external-backup-export-representation'
});

const ROLE_CLASS=freeze({
  canonical:PERSISTENCE_CLASSES.canonical,'canonical-live':PERSISTENCE_CLASSES.canonical,'canonical-metadata':PERSISTENCE_CLASSES.canonical,
  'canonical-draft':PERSISTENCE_CLASSES.canonical,'canonical-deletion-history':PERSISTENCE_CLASSES.canonical,'canonical-preferences':PERSISTENCE_CLASSES.canonical,
  'canonical-bytes':PERSISTENCE_CLASSES.canonical,derived:PERSISTENCE_CLASSES.derived,'derived-revision':PERSISTENCE_CLASSES.derived,'derived-health':PERSISTENCE_CLASSES.derived,'derived-performance':PERSISTENCE_CLASSES.derived,
  recovery:PERSISTENCE_CLASSES.recovery,'recovery-temporary':PERSISTENCE_CLASSES.recovery,'recovery-journal':PERSISTENCE_CLASSES.recovery,
  coordination:PERSISTENCE_CLASSES.deviceLocal,operational:PERSISTENCE_CLASSES.deviceLocal,'coordination-identity':PERSISTENCE_CLASSES.deviceLocal,preference:PERSISTENCE_CLASSES.deviceLocal,
  'startup-mirror':PERSISTENCE_CLASSES.deviceLocal,'security-policy':PERSISTENCE_CLASSES.deviceLocal,'backup-configuration':PERSISTENCE_CLASSES.deviceLocal,'reconciliation-base':PERSISTENCE_CLASSES.deviceLocal,
  migration:PERSISTENCE_CLASSES.migration,'legacy-migration':PERSISTENCE_CLASSES.migration,'legacy-residue':PERSISTENCE_CLASSES.migration,
  'external-backup':PERSISTENCE_CLASSES.external,'explicit-export':PERSISTENCE_CLASSES.external
});
function surface(role,owner,protection,lifecycle,schema='',details={}){
  const authorityClass=ROLE_CLASS[role];
  if(!authorityClass)throw new Error(`Persistence role ${role} has no primary authority class.`);
  const automatic=authorityClass===PERSISTENCE_CLASSES.canonical?{canonicalAuthority:true}:authorityClass===PERSISTENCE_CLASSES.derived?{canonicalAuthority:false}:authorityClass===PERSISTENCE_CLASSES.recovery?{canonicalAuthority:false}:authorityClass===PERSISTENCE_CLASSES.deviceLocal?{canonicalAuthority:false,portable:false}:authorityClass===PERSISTENCE_CLASSES.migration?{canonicalAuthority:false,runtimeAuthority:false,retirement:lifecycle}:authorityClass===PERSISTENCE_CLASSES.external?{canonicalAuthority:false,liveAuthority:false}:{};
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
  nameSetupSkipped:'studyDirector.nameSetupSkippedDate.v1',
  fontScale:'studyDirector.fontScale.v1',
  keepScreenAwake:'studyDirector.keepScreenAwake.v1',
  installNoticeShown:'studyDirector.installNoticeShown.v1',
  systemAlerts:'studyDirector.systemAlerts.v1',
  theme:'studyDirector.theme.v1',
  presentation:'studyDirector.presentation.v1',
  pwaUpdateCheck:'studyDirector.pwaUpdateCheck.v1',
  insightsWindow:'studyDirector.insights.window.v1',
  libraryView:'studyDirector.library.view.v1',
  driveSession:'studyDirector.driveSession.v1'
});

export const SESSION_STORAGE_KEYS=freeze({
  appTab:'studyDirector.appTab.v1',
  pwaReload:'studyDirector.pwaReload.v1'
});

export const OBSOLETE_LOCAL_STORAGE_KEYS=freeze({
  schedule:'studyDirector.scheduleText',
  quote:'studyDirector.quote',
  reflectionDrafts:'studyDirector.reflectionDrafts.v1',
  reflectionLegacy:'studyDirector.reflectionDraft',
  notesPending:'studyDirector.areaNotesPending.v1',
  defaults:'studyDirector.userDefaults.v1',
  liveDraft:'studyDirector.liveDraft',
  activeSession:'studyDirector.activeSession.v1',
  storageCapability:'studyDirector.storageCapability.v1',
  diagnostics:'studyDirector.diagnostics.v1',
  deviceId:'studyDirector.deviceId.v1',
  syncEmergency:'studyDirector.syncEmergency.v1',
  nudge:'studyDirector.nudgeConfig',
  legacyOwnershipLease:'studyDirector.timerOwner.v1',
  attachmentMaintenanceAttemptDay:'studyDirector.attachmentMaintenanceDay.v1',
  // Attachment cleanup now follows the daily upkeep and keeps no record of its own.
  attachmentMaintenanceDay:'studyDirector.attachmentMaintenanceDay.v2',
  attachmentMaintenancePending:'studyDirector.attachmentMaintenancePending.v1',
  // Renamed: moved once to noteRescue before anything reads it.
  noteRescueLegacy:'studyDirector.areaNoteRescue.v1'
});

// One authoritative identity map for the heterogeneous appMeta store. Names are
// stable; a record's version lives inside its value.
export const APP_META_KEYS=freeze({
  dailyRecordMigration:'dailyRecordMigration',
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
// notes and the Device Folder had their current names. The compatibility host
// moves each record to its current name once, before anything reads it.
export const RENAMED_APP_META_KEYS=freeze({
  planDraft:'planDraft.v1',
  planLibrary:'planLibrary.v1',
  personalPreferences:'personalPreferences.v1',
  canonicalMutationEpoch:'canonicalMutationEpoch.v1',
  backupPreparationUnitPrefix:'backupPreparationUnit.v1:',
  savedDayDeletionPrefix:'savedDayDeletion.v1:',
  noteDeletionPrefix:freeze(['areaNoteDeletion.v1:','areaNoteDeletion:']),
  attachmentDeletionPrefix:'attachmentDeletion.v1:',
  libraryClearJournalState:'libraryClearJournalState.v1',
  libraryClearJournalPayloadPrefix:'libraryClearJournalPayload.v1:',
  restoreJournalState:'restoreJournalState.v1',
  restoreJournalPayload:'restoreJournalPayload.v1',
  mutationLease:'mutationLease.v1',
  managedProviderBackupPending:'managedProviderBackupPending.v1',
  repositoryMaintenancePending:'repositoryMaintenancePending.v2',
  reconciliationBase:'reconciliationBase.v2',
  reconciliationBaseNotePrefix:'reconciliationBaseNote.v1:',
  deviceFolder:'automaticDeviceBackup'
});
// Value formats renamed with their records; a moved value takes the new one.
export const RENAMED_VALUE_FORMATS=freeze({
  'study-director.area-note-deletion':'study-director.note-deletion',
  'study-director.area-note-rescue':'study-director.note-rescue',
  'study-director.device-backup-settings':'study-director.device-folder-settings'
});
export const APP_META_FAMILY_COUNT=Object.keys(APP_META_KEYS).length;
export const APP_META_FAMILY_LABEL=`${APP_META_FAMILY_COUNT} typed appMeta families`;

export const OBSOLETE_APP_META_KEYS=freeze({
  reflectionDraftMigration:'reflectionDraftMigration.v1',
  repositoryMaintenancePendingLegacy:'repositoryMaintenancePending.v1',
  archiveClearJournalStateLegacy:'archiveClearJournalState.v1',
  archiveClearJournalPayloadPrefixLegacy:'archiveClearJournalPayload.v1:',
  reconciliationBaseLegacy:'reconciliationBase.v1',
  noteRecoveryPrefix:'areaNoteRecovery.v1:'
});

export const APP_META_VALIDATION_OWNERS=freeze({
  repositories:freeze(['dailyRecordMigration','planDraft','planLibrary','personalPreferences','canonicalMutationEpoch','insightsDatasetRevision','dataMaintenance','backupPreparationUnitPrefix','savedDayDeletionPrefix','noteDeletionPrefix','attachmentDeletionPrefix','pendingReviewPrefix']),
  journals:freeze(['libraryClearJournalState','libraryClearJournalPayloadPrefix','restoreJournalState','restoreJournalPayload','mutationLease']),
  host:freeze(['verifiedRecoveryBackups','backupProtection','attachmentIntegrityAudit','deviceFolder','repositoryIntegrityScrub','managedProviderBackupPending','repositoryMaintenancePending','reconciliationBase','reconciliationBaseNotePrefix','reconciliationBaseDayPrefix'])
});

function appMetaValidationOwner(name){
  for(const [owner,names] of Object.entries(APP_META_VALIDATION_OWNERS))if(names.includes(name))return owner;
  throw new Error(`appMeta family ${name} has no validation owner.`);
}

export const OPFS_IDENTITIES=CURRENT_OPFS_IDENTITIES;
export const OBSOLETE_OPFS_IDENTITIES=CURRENT_OBSOLETE_OPFS_IDENTITIES;

export const DATA_ARCHITECTURE=freeze({
  indexedDb:freeze({
    dailyRecords:surface('canonical','repositories','protect','retained',INDEXED_DB.stores.dailyRecords.schema),
    dailySummaries:surface('derived','repositories','protect','rebuildable-from-dailyRecords',INDEXED_DB.stores.dailySummaries.schema,{rebuildFrom:'indexedDb.dailyRecords'}),
    notes:surface('canonical','repositories','protect','retained',INDEXED_DB.stores.notes.schema),
    activeSessions:surface('canonical-live','repositories','protect','until-session-finalization',INDEXED_DB.stores.activeSessions.schema),
    appMeta:containerSurface('typed-container','app-meta-gateway','mixed','key-family-specific',INDEXED_DB.stores.appMeta.schema,APP_META_FAMILY_LABEL),
    assets:surface('canonical-metadata','attachment-storage','protect','while attachment is retained/referenced',INDEXED_DB.stores.assets.schema)
  }),
  obsoleteIndexedDb:freeze({
    syncQueue:surface('legacy-migration','compatibility','protect-identifiers','removed after verified R10 deletion-state conversion',OBSOLETE_INDEXED_DB.stores.syncQueue),
    tombstones:surface('legacy-migration','compatibility','protect-identifiers','removed after verified R10 deletion-state conversion',OBSOLETE_INDEXED_DB.stores.tombstones),
    reflectionDrafts:surface('legacy-residue','compatibility','operational','removed during v7 topology retirement; current Review state lives in ActiveSession.snapshot.review',OBSOLETE_INDEXED_DB.stores.reflectionDrafts)
  }),
  opfs:freeze({
    attachments:surface('canonical-bytes','attachment-storage','protect','while attachment is retained/referenced'),
    backupFiles:surface('recovery-temporary','exports','protect-if-source-is-protected','while durably journaled/leased','',{protects:'external backup/export construction',created:'when a streamed backup/export requires durable scratch storage',cleared:'after verified completion, release, or stale-file collection',supersededBy:'verified external output'})
  }),
  obsoleteOpfs:freeze({
    attachmentsV1:surface('legacy-residue','compatibility','protect','remove after verified legacy cleanup')
  }),
  localStorage:freeze({
    recovery:surface('recovery','repositories','protect','until canonical session settles','',{protects:'indexedDb.activeSessions',created:'when live session state needs crash recovery',cleared:'after canonical session persistence/finalization settles',supersededBy:'newer canonical ActiveSession or canonical deletion'}),
    appOwner:surface('coordination','ownership','operational','lease lifetime'),
    mutationLock:surface('coordination','host','operational','lease lifetime'),
    storageHealth:surface('operational','host','operational','bounded operational diagnostics; no user-content details'),
    installationId:surface('coordination-identity','persistence','protect-identifiers','retained'),
    deletionRecovery:surface('recovery','repositories','protect-identifiers','until the failed DailyRecord/ActiveSession delete is reconciled','',{protects:'DailyRecord/ActiveSession deletion intent',created:'when authoritative deletion cannot complete atomically',cleared:'after canonical deletion state is verified',supersededBy:'verified canonical record/deletion state'}),
    fallbackDailyRecords:surface('recovery','repositories','protect','until migrated to IndexedDB','',{protects:'indexedDb.dailyRecords',created:'when a DailyRecord cannot be persisted to IndexedDB',cleared:'after replay and verification in canonical IndexedDB',supersededBy:'verified canonical DailyRecord'}),
    noteRescue:surface('recovery','repositories','protect','until the unsaved notes it holds are saved','',{protects:'indexedDb.notes',created:'when a note save fails or the page is hidden or closed before a save finishes',cleared:'after the matching canonical Note/deletion commits',supersededBy:'newer canonical Note or deletion state',capacity:'noteRescueBytes (1 MiB), newest notes first; the save failure names any unsaved note left out'}),
    nameSetupSkipped:surface('preference','host','operational','short-lived'),
    fontScale:surface('startup-mirror','host','operational','disposable mirror of appMeta portable Preferences fontScale','',{mirrorOf:'appMeta.personalPreferences.fontScale'}),
    keepScreenAwake:surface('preference','native-capabilities','operational','retained'),
    installNoticeShown:surface('preference','native-capabilities','operational','retained'),
    systemAlerts:surface('preference','host','operational','retained'),
    theme:surface('startup-mirror','host','operational','disposable mirror of appMeta portable Preferences theme','',{mirrorOf:'appMeta.personalPreferences.theme'}),
    presentation:surface('startup-mirror','host','operational','disposable mirror of appMeta portable Preferences presentation','',{mirrorOf:'appMeta.personalPreferences.presentation'}),
    pwaUpdateCheck:surface('operational','host','operational','retained'),
    insightsWindow:surface('preference','insights','operational','retained'),
    libraryView:surface('preference','library','operational','retained'),
    driveSession:surface('operational','drive','operational','until the Drive sign-in expires (about an hour), is disconnected or is rejected; keeps the sign-in across reloads and reopening')
  }),
  sessionStorage:freeze({
    appTab:surface('coordination-identity','ownership','operational','tab-session lifetime'),
    pwaReload:surface('operational','pwa-lifecycle','operational','single update/reload handoff')
  }),
  cacheStorage:freeze({
    applicationShell:surface('operational','service-worker','operational','release-scoped application assets only; no user data','',{identity:CACHE_STORAGE_IDENTITIES.shellPrefix,identityKind:'release-prefix'}),
    updateBridge:surface('operational','service-worker','operational','temporary update bridge/recovery handoff','',{identity:CACHE_STORAGE_IDENTITIES.updateBridge,recoveryPrefix:CACHE_STORAGE_IDENTITIES.updateRecoveryPrefix})
  }),
  memory:freeze({
    insightsModels:surface('derived','insights','protect','ephemeral/rebuildable','',{rebuildFrom:'canonical study records'}),
    searchIndex:surface('derived','search','protect','ephemeral/rebuildable','',{rebuildFrom:'canonical searchable records'}),
    driveAccessToken:surface('operational','drive','protect','authorization-session only; kept across reloads only through localStorage.driveSession until it expires')
  }),
  obsoleteLocalStorage:freeze({
    schedule:surface('legacy-migration','compatibility','protect','remove after canonical Plan migration'),
    quote:surface('legacy-migration','compatibility','protect','remove after protected-preference migration'),
    reflectionDrafts:surface('legacy-residue','compatibility','operational','remove during ReflectionDraft retirement'),
    reflectionLegacy:surface('legacy-residue','compatibility','operational','remove during ReflectionDraft retirement'),
    notesPending:surface('legacy-migration','compatibility','protect','remove after Note recovery migration'),
    defaults:surface('legacy-migration','compatibility','protect','remove after Plan/protected-preference migration'),
    liveDraft:surface('legacy-residue','compatibility','protect','remove after verified legacy cleanup'),
    activeSession:surface('legacy-residue','compatibility','protect','remove after verified legacy cleanup'),
    storageCapability:surface('legacy-residue','compatibility','operational','remove after verified legacy cleanup'),
    diagnostics:surface('legacy-residue','compatibility','operational','remove after verified legacy cleanup'),
    deviceId:surface('legacy-migration','compatibility','protect-identifiers','migrate once to installationId; remove after verified canonical migration'),
    syncEmergency:surface('legacy-migration','compatibility','protect-identifiers','convert delete intents to deletionRecovery; discard obsolete upsert intents after verified conversion'),
    nudge:surface('legacy-migration','compatibility','operational','migrate once into PortablePreferences.v2 and retire as an authoritative LocalStorage key'),
    legacyOwnershipLease:surface('legacy-residue','compatibility','operational','remove after app-scoped ownership identity is active'),
    attachmentMaintenanceAttemptDay:surface('legacy-residue','compatibility','operational','old scheduled-attempt day cannot certify completed attachment cleanup'),
    attachmentMaintenanceDay:surface('legacy-residue','compatibility','operational','remove; attachment cleanup now follows the daily upkeep'),
    attachmentMaintenancePending:surface('legacy-residue','compatibility','operational','remove; a cleanup request lost to a reload is caught by the next daily sweep'),
    noteRescueLegacy:surface('legacy-migration','compatibility','protect','moved once to noteRescue, its format renamed, before notes load')
  }),
  appMeta:freeze({
    exact:freeze({
      dailyRecordMigration:surface('migration','compatibility','operational','remove with migration facade after canonical baseline is proven','DailyRecordMigration.v1'),
      planDraft:surface('canonical-draft','repositories','protect','retained','PlanDraft.v1'),
      planLibrary:surface('canonical','repositories','protect','retained','PlanLibrary.v1'),
      personalPreferences:surface('canonical-preferences','repositories','protect','retained','PortablePreferences.v2'),
      canonicalMutationEpoch:surface('coordination','repositories','operational','replace atomically with portable canonical mutations; reseed after verified startup compatibility','CanonicalMutationEpoch.v1'),
      insightsDatasetRevision:surface('derived-revision','repositories','operational','rebuildable','InsightsDatasetRevision.v2',{rebuildFrom:'canonical IndexedDB data revisions'}),
      dataMaintenance:surface('operational','repositories','operational','replace on maintenance','DataMaintenance.v6'),
      libraryClearJournalState:surface('recovery-journal','repository-journals','protect','until verified completion/rollback','LibraryClearJournalState.v1',{protects:'Library clear mutation',created:'before destructive Library clear commit',cleared:'after verified completion or rollback',supersededBy:'verified post-operation canonical state'}),
      restoreJournalState:surface('recovery-journal','repository-journals','operational','until verified completion/rollback','RestoreJournalState.v1',{protects:'checkpoint restore mutation',created:'before destructive restore commit',cleared:'after verified completion or rollback',supersededBy:'verified post-restore canonical state'}),
      restoreJournalPayload:surface('recovery-journal','repository-journals','protect','until verified completion/rollback','RestoreJournalPayload.v5',{protects:'canonical dataset rollback image',created:'before destructive restore commit',cleared:'after verified completion or rollback',supersededBy:'verified post-restore canonical state'}),
      mutationLease:surface('coordination','repository-journals','operational','lease lifetime','MutationLease.v1'),
      verifiedRecoveryBackups:surface('operational','host','operational','replace on every backup','VerifiedRecoveryBackups.v3'),
      backupProtection:surface('security-policy','exports','operational','while backup protection enabled','BackupProtection.v2'),
      attachmentIntegrityAudit:surface('derived-health','host','protect','replace on audit; opaque identity/error details only','AttachmentIntegrityAudit.v2',{rebuildFrom:'indexedDb.assets + opfs.attachments'}),
      deviceFolder:surface('backup-configuration','device-backup','operational','while connected','DeviceFolderSettings.v4'),
      repositoryIntegrityScrub:surface('derived-health','backup','operational','transactional progress/completion bound to repository identity; opaque quarantined object ids only; no user-content details','RepositoryIntegrityScrub.v7',{rebuildFrom:'external backup repository manifests and objects'}),
      managedProviderBackupPending:surface('operational','backup','operational','until the affected managed provider successfully publishes a later current backup or is explicitly disconnected','ManagedProviderBackupPending.v1'),
      repositoryMaintenancePending:surface('operational','backup','operational','until post-commit repository retention and safe orphan reclamation complete','RepositoryMaintenancePending.v4'),
      reconciliationBase:surface('reconciliation-base','host','protect','advance atomically when a version this device shares through Drive is placed there or caught up to','ReconciliationBase.v3')
    }),
    prefixes:freeze({
      backupPreparationUnitPrefix:surface('derived-performance','repositories','operational','disposable; rebuild from canonical data after loss, uncertainty or representation change','BackupPreparationUnit.v1',{rebuildFrom:'portable canonical IndexedDB state'}),
      savedDayDeletionPrefix:surface('canonical-deletion-history','repositories','protect','retain until the same Saved Day is recreated','SavedDayDeletion.v1'),
      noteDeletionPrefix:surface('canonical-deletion-history','repositories','protect','retain until the same Note is recreated','NoteDeletion.v1'),
      attachmentDeletionPrefix:surface('canonical-deletion-history','repositories','protect-identifiers','retain until the same Attachment Library identity is explicitly restored/recreated','AttachmentDeletion.v1'),
      pendingReviewPrefix:surface('canonical','repositories','protect','a kept version stays until the person resolves it; a resolved one keeps only its id, so other devices learn of it, and the newest of those are kept','PendingReview.v1'),
      libraryClearJournalPayloadPrefix:surface('recovery-journal','repository-journals','protect','until verified completion/rollback','LibraryClearJournalChunk.v1',{protects:'canonical Library rollback chunks',created:'before destructive Library clear commit',cleared:'after verified completion or rollback',supersededBy:'verified post-operation canonical state'}),
      reconciliationBaseNotePrefix:surface('reconciliation-base','host','protect','update/delete only changed Note baselines; lazily read only for actual reconciliation conflicts','ReconciliationBaseNote.v1'),
      reconciliationBaseDayPrefix:surface('reconciliation-base','host','protect','one row of Saved-Day fingerprints per month; update/delete only changed months; read only for differing Saved Days','ReconciliationBaseDays.v1')
    }),
    obsolete:freeze({
      reflectionDraftMigration:surface('legacy-residue','compatibility','operational','remove during compatibility migration','ReflectionDraftMigration.v1'),
      repositoryMaintenancePendingLegacy:surface('legacy-migration','compatibility','operational','migrate provider maintenance intent to the current repositoryMaintenancePending record, then remove after verified replacement','RepositoryMaintenancePending.v1'),
      archiveClearJournalStateLegacy:surface('legacy-migration','compatibility','protect','migrate once to LibraryClearJournalState.v1, then remove after verified replacement','ArchiveClearJournalState.v1'),
      archiveClearJournalPayloadPrefixLegacy:surface('legacy-migration','compatibility','protect','migrate once to LibraryClearJournalChunk.v1, then remove after verified replacement','ArchiveClearJournalChunk.v1'),
      reconciliationBaseLegacy:surface('legacy-migration','compatibility','protect','migrate once to ReconciliationBase.v2 plus ReconciliationBaseNote.v1 rows, then remove after verified replacement','ReconciliationBase.v1'),
      noteRecoveryPrefix:surface('legacy-migration','compatibility','protect','fold once into canonical Note rows (newer revision wins), then remove in the same transaction','AreaNoteRecovery.v1')
    })
  }),
  external:freeze({
    completeBackup:surface('external-backup','backup','protect-when-data-protection-enabled','user-retained/current-format-only after compatibility retirement; public provenance + protected checkpoint manifest'),
    deviceBackup:surface('external-backup','device-backup','protect-when-data-protection-enabled','incremental repository with deterministic 15-point tiered retention, one temporary protected Before-restore point, immutable commit markers, shared verified objects, independent provider-neutral Version History projection, Bring-in reconciliation and exact historical Version Restore','',{repositoryRoot:EXTERNAL_REPOSITORY_IDENTITIES.deviceFolderRoot,objectsDirectory:EXTERNAL_REPOSITORY_IDENTITIES.deviceFolderObjects,checkpointsDirectory:EXTERNAL_REPOSITORY_IDENTITIES.deviceFolderCheckpoints,commitsDirectory:EXTERNAL_REPOSITORY_IDENTITIES.deviceFolderCommits}),
    driveBackup:surface('external-backup','drive','protect-when-data-protection-enabled','incremental repository with deterministic 15-point tiered retention, one temporary protected Before-restore point, immutable commit markers and shared verified objects; independently projects into provider-neutral Version History while provider transport supports separate Bring-in and exact historical Version Restore orchestration','',{repositoryRoot:EXTERNAL_REPOSITORY_IDENTITIES.driveFolder}),
    attachmentArchive:surface('explicit-export','attachments','user-choice','user-controlled file lifetime'),
    markdownExport:surface('explicit-export','note-export','user-choice','user-controlled file lifetime'),
    zipExport:surface('explicit-export','note-export','user-choice','user-controlled file lifetime')
  })
});

export const APP_META_RUNTIME_REGISTRY=freeze(Object.fromEntries([
  ...Object.entries(DATA_ARCHITECTURE.appMeta.exact).map(([name,value])=>[name,freeze({name,kind:'exact',key:APP_META_KEYS[name],owner:value.owner,validatorOwner:appMetaValidationOwner(name),schema:value.schema})]),
  ...Object.entries(DATA_ARCHITECTURE.appMeta.prefixes).map(([name,value])=>[name,freeze({name,kind:'prefix',key:APP_META_KEYS[name],owner:value.owner,validatorOwner:appMetaValidationOwner(name),schema:value.schema})])
]));

export function assertDataArchitecture(contract=DATA_ARCHITECTURE,keys=APP_META_KEYS,obsoleteKeys=OBSOLETE_APP_META_KEYS,localKeys=LOCAL_STORAGE_KEYS,obsoleteLocalKeys=OBSOLETE_LOCAL_STORAGE_KEYS,validationOwners=APP_META_VALIDATION_OWNERS){
  if(![contract,keys,obsoleteKeys,localKeys,obsoleteLocalKeys,APP_META_RUNTIME_REGISTRY].every(Object.isFrozen))throw new TypeError('Data architecture contracts must be frozen.');
  const storeNames=Object.keys(INDEXED_DB.stores);
  if(Object.keys(contract.indexedDb).sort().join('|')!==storeNames.sort().join('|'))throw new Error('IndexedDB data architecture inventory is incomplete.');
  for(const [name,value] of Object.entries(contract.indexedDb))if(typeof value.schema!=='string'||!value.schema)throw new Error(`IndexedDB data surface ${name} is missing its canonical schema.`);
  if(Object.keys(contract.localStorage).sort().join('|')!==Object.keys(localKeys).sort().join('|'))throw new Error('Current localStorage inventory differs from the authoritative identities.');
  if(Object.keys(contract.obsoleteLocalStorage).sort().join('|')!==Object.keys(obsoleteLocalKeys).sort().join('|'))throw new Error('Obsolete localStorage inventory differs from the authoritative identities.');
  const exactNames=Object.keys(contract.appMeta.exact),prefixNames=Object.keys(contract.appMeta.prefixes),obsoleteNames=Object.keys(contract.appMeta.obsolete);
  const currentAppMetaNames=[...exactNames,...prefixNames].sort();
  const assignedValidationNames=Object.values(validationOwners).flat();
  if(Object.keys(APP_META_RUNTIME_REGISTRY).sort().join('|')!==currentAppMetaNames.join('|'))throw new Error('Runtime appMeta registry differs from the canonical appMeta inventory.');
  for(const [name,entry] of Object.entries(APP_META_RUNTIME_REGISTRY)){
    if(!Object.isFrozen(entry)||entry.name!==name||!['exact','prefix'].includes(entry.kind)||entry.key!==keys[name]||entry.owner!==(contract.appMeta[entry.kind==='exact'?'exact':'prefixes'][name]?.owner||'')||entry.validatorOwner!==appMetaValidationOwner(name)||entry.schema!==(contract.appMeta[entry.kind==='exact'?'exact':'prefixes'][name]?.schema||''))throw new Error(`Runtime appMeta registry entry ${name} is invalid.`);
  }
  if(assignedValidationNames.length!==new Set(assignedValidationNames).size)throw new Error('appMeta validation ownership is duplicated.');
  if([...assignedValidationNames].sort().join('|')!==currentAppMetaNames.join('|'))throw new Error('appMeta validation ownership is incomplete.');
  for(const name of [...exactNames,...prefixNames])if(typeof keys[name]!=='string'||!keys[name])throw new Error(`appMeta key ${name} is missing.`);
  for(const name of obsoleteNames)if(typeof obsoleteKeys[name]!=='string'||!obsoleteKeys[name])throw new Error(`obsolete appMeta key ${name} is missing.`);
  const allIdentities=[...Object.values(localKeys),...Object.values(obsoleteLocalKeys),...exactNames.map(name=>keys[name]),...prefixNames.map(name=>keys[name]),...obsoleteNames.map(name=>obsoleteKeys[name])];
  if(new Set(allIdentities).size!==allIdentities.length)throw new Error('Durable storage identities must be unique across current and obsolete registries.');
  const prefixes=prefixNames.map(name=>keys[name]);
  for(const prefix of prefixes)for(const identity of allIdentities)if(identity!==prefix&&identity.startsWith(prefix))throw new Error(`Durable identity ${identity} collides with prefix ${prefix}.`);
  const allowedProtection=new Set(['protect','mixed','protect-identifiers','operational','protect-if-source-is-protected','protect-when-data-protection-enabled','user-choice']);
  const allowedRoles=new Set(['canonical','canonical-live','canonical-metadata','canonical-draft','canonical-deletion-history','canonical-preferences','derived','coordination-outbox','canonical-bytes','recovery-temporary','legacy-migration','legacy-residue','recovery','coordination','operational','coordination-identity','preference','startup-mirror','migration','derived-revision','derived-performance','recovery-journal','security-policy','derived-health','backup-configuration','reconciliation-base','external-backup','explicit-export']);
  const primaryClasses=new Set(Object.values(PERSISTENCE_CLASSES));
  const validate=(label,value)=>{
    if(!value||!Object.isFrozen(value)||!allowedRoles.has(value.role)||typeof value.owner!=='string'||!value.owner||!allowedProtection.has(value.protection)||typeof value.lifecycle!=='string'||!value.lifecycle||!primaryClasses.has(value.authorityClass))throw new Error(`Data surface ${label} is invalid or lacks one primary persistence class.`);
    if(value.authorityClass===PERSISTENCE_CLASSES.canonical&&value.canonicalAuthority!==true)throw new Error(`Canonical surface ${label} is not marked as the canonical authority.`);
    if(value.authorityClass!==PERSISTENCE_CLASSES.canonical&&value.canonicalAuthority!==false)throw new Error(`Non-canonical surface ${label} must explicitly reject canonical authority.`);
    if(value.authorityClass===PERSISTENCE_CLASSES.derived&&typeof value.rebuildFrom!=='string')throw new Error(`Derived surface ${label} does not identify its rebuild source.`);
    if(value.authorityClass===PERSISTENCE_CLASSES.recovery&&['protects','created','cleared','supersededBy'].some(field=>typeof value[field]!=='string'||!value[field]))throw new Error(`Recovery surface ${label} does not define its protected entity/lifecycle.`);
    if(value.authorityClass===PERSISTENCE_CLASSES.deviceLocal&&value.portable!==false)throw new Error(`Device-local surface ${label} is not explicitly non-portable.`);
    if(value.role==='startup-mirror'&&(typeof value.mirrorOf!=='string'||!value.mirrorOf))throw new Error(`Startup mirror ${label} does not identify its canonical source.`);
    if(value.authorityClass===PERSISTENCE_CLASSES.migration&&(value.runtimeAuthority!==false||typeof value.retirement!=='string'||!value.retirement))throw new Error(`Migration surface ${label} lacks a retirement condition.`);
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
  if(contract.cacheStorage.applicationShell.identity!==CACHE_STORAGE_IDENTITIES.shellPrefix||contract.cacheStorage.updateBridge.identity!==CACHE_STORAGE_IDENTITIES.updateBridge||contract.cacheStorage.updateBridge.recoveryPrefix!==CACHE_STORAGE_IDENTITIES.updateRecoveryPrefix)throw new Error('Cache Storage identities drifted from the authoritative identity contract.');
  if(contract.external.deviceBackup.repositoryRoot!==EXTERNAL_REPOSITORY_IDENTITIES.deviceFolderRoot||contract.external.deviceBackup.objectsDirectory!==EXTERNAL_REPOSITORY_IDENTITIES.deviceFolderObjects||contract.external.deviceBackup.checkpointsDirectory!==EXTERNAL_REPOSITORY_IDENTITIES.deviceFolderCheckpoints||contract.external.deviceBackup.commitsDirectory!==EXTERNAL_REPOSITORY_IDENTITIES.deviceFolderCommits||contract.external.driveBackup.repositoryRoot!==EXTERNAL_REPOSITORY_IDENTITIES.driveFolder)throw new Error('External repository identities drifted from the authoritative identity contract.');
  return true;
}
assertDataArchitecture();
