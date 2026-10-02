import {INDEXED_DB,OBSOLETE_INDEXED_DB,CURRENT_SCHEMA_VERSIONS,OPFS_IDENTITIES,EXTERNAL_FORMATS} from './canonical-identities.mjs';
const freeze=Object.freeze;
export const LEGACY_BACKUP_SCHEMA_VERSION=1;
const item=value=>freeze(value);
const items=values=>freeze(values.map(item));

// SDVB74L10 defines the hardened canonical baseline the ordinary app is moving toward.
// Temporary compatibility exists only to cross into this baseline; it must not
// become part of the permanent persistence model.
export const CANONICAL_BASELINE=freeze({
  id:'SDVB74L10',
  format:'study-director.canonical-data-baseline',
  contractVersion:1,
  status:'target-not-yet-proven',
  indexedDb:freeze({
    name:INDEXED_DB.name,
    version:INDEXED_DB.version,
    schemas:freeze({
      dailyRecords:CURRENT_SCHEMA_VERSIONS.DailyRecord,
      dailySummaries:CURRENT_SCHEMA_VERSIONS.DailySummary,
      areaNotes:CURRENT_SCHEMA_VERSIONS.AreaNote,
      activeSessions:CURRENT_SCHEMA_VERSIONS.ActiveSession,
      sessionSnapshots:CURRENT_SCHEMA_VERSIONS.SessionSnapshot,
      appMeta:CURRENT_SCHEMA_VERSIONS.AppMeta
    })
  }),
  richText:freeze({prefix:'WG1:',version:1}),
  attachments:freeze({metadataVersion:INDEXED_DB.stores.assets.schemaVersion,storage:'opfs',directory:OPFS_IDENTITIES.attachments}),
  recovery:freeze({activeSessionEnvelopeVersion:1,areaNoteRowVersion:1}),
  external:freeze({
    completeBackup:EXTERNAL_FORMATS.completeBackup,
    protectedBackup:EXTERNAL_FORMATS.protectedBackup,
    attachmentArchive:EXTERNAL_FORMATS.attachmentArchive
  }),
  policy:freeze({
    ordinaryRuntime:'current-canonical-only',
    historicalConversion:'temporary-facade-only',
    malformedOrNewerData:'reject-without-mutating-source',
    retirement:'remove temporary facade after every supported installation proves this baseline and has a fresh verified current-format backup'
  })
});

// Ordinary runtime is current-schema only. Compatibility orchestration owns the
// historical entry points. Host-owned live migration is physically isolated in
// compatibility-host.js; repository/topology adapters remain near low-level
// persistence only where transaction access requires it. All remain temporary and
// unreachable from normal hydration/read paths.
export const MIGRATION_FACADE_CONTRACT=freeze({
  format:'study-director.migration-facade-contract',
  contractVersion:1,
  baselineId:CANONICAL_BASELINE.id,
  plannedModule:'core/compatibility.js',
  status:'runtime-isolated-detachable-host',
  disposable:false,
  retirementMode:'isolate-adapters-then-delete-package',
  accepts:freeze(['legacy-live-storage','legacy-local-record-shapes','legacy-host-metadata','legacy-backup-files','legacy-protected-backup-files','legacy-update-protocol']),
  emits:'current-canonical-data-or-explicit-rejection',
  verification:freeze({
    proofFormat:'study-director.canonical-installation-proof',
    localChecks:freeze(['planLegacy','reflectionLegacy','activeSession','areaNotes','areaNoteRecovery','dailyRecords','deletionState','insightsRevisionEnvelope','canonicalStores','legacyStorage','legacyAttachments','obsoleteMetadata','topology','retiredIdentity']),
    retirementCompatibilityCheck:'retiredHostCompatibility',
    backupCheck:'freshBackup',
    localResult:'canonical',
    retirementDataResult:'retirementDataReady'
  }),
  mustNotOwn:freeze(['current-canonical-validation','current-recovery','current-backup-writing','current-attachment-archive-writing','future-schema-upgrade-mechanism']),
  retirementProof:freeze([
    'all-supported-installations-report-canonical-baseline',
    'no-legacy-localstorage-identities-remain',
    'no-legacy-opfs-or-attachment-metadata-remains',
    'no-obsolete-appmeta-residue-remains',
    'all-canonical-indexeddb-records-validate-at-current-schema',
    'fresh-current-format-backup-created-and-verified',
    'runtime-canonical-installation-proof-passes',
    'no-transitional-v1-backup-protection-policy-remains'
  ])
});

// Every entry below is temporary by design. Current validation/recovery is not
// listed here because it survives after the facade is retired.
export const COMPATIBILITY_REGISTRY=freeze({
  liveMigrations:items([
    {
      id:'plan-legacy-schedule',owner:'compatibility/host',kind:'live-migration',
      source:'localStorage scheduleText and userDefaults.v1.scheduleText',
      target:'appMeta planDraft.v1 / planLibrary.v1 plus personalPreferences.v1',
      proof:'legacy schedule/defaults/quote keys absent after verified canonical Plan and personalPreferences commits',
      retirement:'baseline verified on all supported installations',
      sourceFiles:freeze(['source/core/compatibility-host.js'])
    },
    {
      id:'reflection-drafts-retirement',owner:'compatibility/host',kind:'live-migration',
      source:'retired localStorage reflectionDrafts.v1/reflectionDraft plus IndexedDB reflectionDrafts store',
      target:'absence; current unsaved Review state is ActiveSession.snapshot.review',
      proof:'obsolete localStorage identities are removed and IndexedDB v7 topology contains no reflectionDrafts store',
      retirement:'after every supported installation has crossed the v7 topology and old backup compatibility is no longer required',
      sourceFiles:freeze(['source/core/compatibility-host.js','source/core/persistence.js','source/core/compatibility-codecs.js'])
    },
    {
      id:'active-session-v7-domain-separation',owner:'record-codecs/repositories',kind:'live-canonicalization',
      source:'historical IndexedDB ActiveSession rows including v8 snapshots with reflectionDraft',
      target:'strict current ActiveSession.v9 with snapshot.review {reflection, studyQuality} and revision/updatedAt retained as local recovery ordering only',
      proof:'a retained interrupted session is converted and rewritten before canonical-store verification; malformed/newer sessions are rejected without mutating the source',
      retirement:'baseline verified on all supported installations',
      sourceFiles:freeze(['source/core/compatibility-codecs.js','source/core/repositories.js'])
    },
    {
      id:'area-note-historical-rows',owner:'record-codecs/repositories-area-notes',kind:'live-canonicalization',
      source:'IndexedDB AreaNote.v1 rows/recovery entries carrying historical sync metadata or degraded historical shapes',
      target:'strict current AreaNote.v2 domain rows containing only version, key, label, text and local updatedAt revision',
      proof:'every retained Area Note and recovery entry is rewritten losslessly into the strict current shape before ordinary reads resume',
      retirement:'baseline verified on all supported installations',
      sourceFiles:freeze(['source/core/compatibility-codecs.js','source/core/repositories-area-notes.js','source/core/repositories.js'])
    },
    {
      id:'area-note-recovery-v1',owner:'repositories-area-notes',kind:'live-migration',
      source:'localStorage areaNotesPending.v1 payload with version 1 pending map',
      target:'appMeta areaNoteRecovery.v1:* rows only',
      proof:'pending entries are persisted to IndexedDB recovery rows before canonical note reconciliation',
      retirement:'baseline verified on all supported installations',
      sourceFiles:freeze(['source/core/repositories-area-notes.js','source/core/repositories.js'])
    },
    {
      id:'daily-record-historical-shapes',owner:'record-codecs/repositories',kind:'live-canonicalization',
      source:'IndexedDB/imported DailyRecord versions <= 15 and non-current historical field shapes, including R10 embedded sync metadata',
      target:'current DailyRecord v16 (study or diary) with local updatedAt/sourceRevision plus rebuildable exact DailySummary v5',
      proof:'every retained Daily Record is rewritten and strict-current validation succeeds; exact summaries rebuild from those records',
      retirement:'after canonical rewrite is implemented and baseline verified on all supported installations',
      sourceFiles:freeze(['source/core/compatibility-codecs.js','source/core/repositories.js'])
    },
    {
      id:'insights-revision-appmeta-envelope',owner:'repositories',kind:'live-migration',
      source:'legacy direct appMeta insightsDatasetRevision row shape',
      target:'uniform AppMeta.v1 envelope containing InsightsDatasetRevision.v2',
      proof:'revision row is absent or uses the canonical {key,version,value,updatedAt} appMeta envelope with an exact v2 value',
      retirement:'baseline verified on all supported installations',
      sourceFiles:freeze(['source/core/repositories.js'])
    },
    {
      id:'r10-sync-delete-state',owner:'repositories',kind:'live-migration',
      source:'localStorage studyDirector.syncEmergency.v1 plus IndexedDB syncQueue/tombstones delete entries',
      target:'studyDirector.deletionRecovery.v1 and appMeta savedDayDeletion.v1:* rows',
      proof:'delete intents are converted before legacy state is retired; obsolete upsert-only sync intents are not recreated',
      retirement:'after canonical baseline verification B4 physically retires the obsolete stores; adapter remains only for already-retired/no-source startup compatibility until R12 isolation',
      sourceFiles:freeze(['source/core/repositories.js','source/core/startup.js','contracts/data-architecture.mjs'])
    },
    {
      id:'legacy-device-identity',owner:'compatibility/host',kind:'live-migration',
      source:'localStorage studyDirector.deviceId.v1',
      target:'separate studyDirector.installationId.v1 provenance identity with the legacy deviceId key removed after verification',
      proof:'current installationId exists independently of canonical user-domain records and is stable across reloads',
      retirement:'B4 removes the legacy deviceId key after installationId and the canonical local baseline are verified',
      sourceFiles:freeze(['contracts/data-architecture.mjs','source/core/compatibility-host.js'])
    },
    {
      id:'l7-host-metadata-normalization',owner:'compatibility/host',kind:'live-migration',
      source:'L7 appMeta dataMaintenance v1 plus rebuildable noncanonical maintenance rows from intermediate upgrades, verifiedRecoveryBackups entries without baseline fields, attachmentIntegrityAudit issues with name, DeviceBackupSettings.v1, and backupProviderOperation:* journals',
      target:'current host/repository metadata shapes or verified absence for obsolete operational rows',
      proof:'strict current appMeta verification passes after normalization; Device Folder handle/timestamps are retained, obsolete provider-operation journals are removed, and unknown historical shapes fail closed',
      retirement:'after all supported installations have crossed the metadata normalization, report the canonical baseline, and no historical provider journal remains',
      sourceFiles:freeze(['source/core/compatibility-host.js','source/core/host-metadata.js','source/app.html'])
    },
    {
      id:'l13e-repository-maintenance-v1',owner:'compatibility/host',kind:'live-migration',
      source:'appMeta repositoryMaintenancePending.v1 provider maintenance intent produced by SDVB74L13E and earlier v1 writers',
      target:'appMeta repositoryMaintenancePending.v2 with explicit nextEligibleAt/reason scheduling state',
      proof:'every valid v1 provider intent is normalized to v2, the replacement is read back and verified, and only then is the v1 identity removed before canonical appMeta verification',
      retirement:'after every supported installed build has crossed the L13E-era v2 maintenance identity migration and the canonical baseline no longer requires this adapter',
      sourceFiles:freeze(['contracts/data-architecture.mjs','source/core/compatibility-host.js','source/core/host-metadata.js','source/app.html'])
    },
    {
      id:'l7-backup-protection-policy-v1',owner:'compatibility/exports',kind:'live-migration',
      source:'appMeta backupProtection v1 verifier encrypted with SDENC01',
      target:'backupProtection v2 password verifier with the same policy identity',
      proof:'v1 remains locked/fail-closed until the existing password authenticates; successful unlock atomically writes v2 and retirement proof remains false while v1 exists',
      retirement:'after no supported installation reports backupProtection v1',
      sourceFiles:freeze(['source/core/compatibility-host.js','source/core/host-metadata.js','source/core/exports.js'])
    },
    {
      id:'r10-indexeddb-topology-retirement',owner:'compatibility/persistence',kind:'schema-bridge',
      source:`historical IndexedDB topology containing retired ${OBSOLETE_INDEXED_DB.stores.syncQueue}/${OBSOLETE_INDEXED_DB.stores.tombstones}/${OBSOLETE_INDEXED_DB.stores.reflectionDrafts} stores`,
      target:`current IndexedDB v${INDEXED_DB.version} six-store topology`,
      proof:'all local canonical surfaces and deletion-state conversion pass before version upgrade; post-upgrade topology contains only canonical stores',
      retirement:'after the canonical baseline is verified and all supported installations have crossed v7; generic IndexedDB upgrade support remains permanent',
      sourceFiles:freeze(['contracts/canonical-identities.mjs','source/core/persistence.js','source/core/compatibility.js','source/app.html'])
    },
    {
      id:'indexeddb-pre-v3-migration-marker',owner:'compatibility/persistence',kind:'schema-bridge',
      source:'IndexedDB oldVersion < 3',
      target:'R10 bridge topology long enough to migrate, followed by the current six-store IndexedDB v7 topology',
      proof:'pre-v3 data receives the migration marker, canonical conversion verifies, then the database upgrades to v7 with all retired stores absent',
      retirement:'remove historical oldVersion branch after baseline verification; retain generic onupgradeneeded infrastructure',
      sourceFiles:freeze(['source/core/compatibility.js','source/core/persistence.js'])
    },
  ]),
  legacyCleanup:items([
    {
      id:'legacy-localstorage-residue',owner:'compatibility/host',kind:'cleanup',
      source:'liveDraft, activeSession.v1, storageCapability.v1, diagnostics.v1',
      target:'absence',
      proof:'all four legacy localStorage identities are absent',
      retirement:'baseline verified on all supported installations',
      sourceFiles:freeze(['source/core/compatibility-host.js','source/core/startup.js'])
    },
    {
      id:'legacy-attachment-storage',owner:'compatibility/asset-storage',kind:'cleanup',
      source:'Blob or metadata version 1 rows and OPFS study-director-assets-v1 directory',
      target:'attachment metadata v2 / study-director-assets-v2 only',
      proof:'no legacy metadata rows and legacy OPFS directory is absent',
      retirement:'baseline verified on all supported installations',
      sourceFiles:freeze(['source/core/asset-storage.js','source/core/startup.js'])
    },
    {
      id:'obsolete-reflection-migration-meta',owner:'compatibility/repositories',kind:'cleanup',
      source:'appMeta reflectionDraftMigration.v1 residue',
      target:'absence',
      proof:'compatibility migration removes the obsolete metadata identity without touching canonical Plan metadata',
      retirement:'baseline verified on all supported installations',
      sourceFiles:freeze(['contracts/data-architecture.mjs','source/core/repositories.js'])
    }
  ]),
  externalImportCompatibility:items([
    {
      id:'legacy-json-backups',owner:'backup-codec',kind:'import-adapter',
      source:'pre-complete-format JSON backups (legacy/unversioned through historical versions before v7)',
      target:'current validated restore model',
      proof:'legacy source is parsed under size limits, sanitized, and never written before restore validation/journaling',
      retirement:'after all required historical backups are replaced by a fresh current-format verified backup',
      sourceFiles:freeze(['source/core/backup-codec.js','source/core/backup.js','source/core/compatibility-codecs.js'])
    },
    {
      id:'legacy-protected-backup-v1',owner:'exports/portable-processing',kind:'import-adapter',
      source:'SDENC01 password-encrypted backup container produced by L7 and earlier supported builds',
      target:'decrypted bytes routed into the ordinary backup compatibility inspector/restore model',
      proof:'authenticated AES-256-GCM v1 envelope validates under its fixed parameters and wrong passwords/corruption fail closed before backup parsing',
      retirement:'after every required historical encrypted backup has been replaced by a verified current SDENC02 backup',
      sourceFiles:freeze(['source/core/exports.js'])
    },
    {
      id:'complete-backup-v7-v19',owner:'backup-codec',kind:'import-adapter',
      source:'study-director-backup metadata versions 7 through 19, including pre-v10 framing/checksum/entity-set variants, the pre-L10 personal-data envelope, R10 records carrying embedded sync metadata, B1 v14 checkpoints without protected reconciliation metadata, v15 protected-manifest checkpoints before the current deletion-ledger evolution, v16 personal-data payloads that still transported device-local Wake Lock/System Alerts fields, v17 checkpoints that predate protected capture-authority proof, v18 checkpoints that still carried the retired ReflectionDraft domain, and v19 checkpoints that predate DailyRecord.v16 record kinds',
      target:'current v20 checkpoint restore model with protected reconciliation manifest, portable Preferences only, lean canonical domain records, and protected canonical-complete/rescue-partial capture authority',
      proof:'manifest/chunks/completion proof validate and imported entities pass canonical sanitizers before restore',
      retirement:'after all required historical backups are replaced by a fresh current-format verified backup',
      sourceFiles:freeze(['source/core/backup-codec.js','source/core/backup.js','source/core/compatibility-codecs.js','source/external/drive.js'])
    },
  ]),
  protocolCompatibility:items([
    {
      id:'legacy-service-worker-update-bridge',owner:'service-worker/pwa-lifecycle',kind:'protocol-bridge',
      source:'older page <-> Service Worker update protocol',
      target:'current updater protocol',
      proof:'all supported installed pages have crossed the bridge cache checkpoint',
      retirement:'after minimum supported installed build no longer requires the older protocol',
      sourceFiles:freeze(['source/platform/sw.js','source/core/pwa-lifecycle.js'])
    }
  ])
});

export const CURRENT_FORMATS_OUTSIDE_MIGRATION=freeze({
  attachmentArchive:item({...EXTERNAL_FORMATS.attachmentArchive,policy:'current-only; no legacy reader exists'}),
  noteExports:item({formats:freeze(['Markdown','ZIP']),policy:'explicit user exports, not canonical storage and not migration inputs'}),
  completeBackup:item({format:EXTERNAL_FORMATS.completeBackup.format,version:EXTERNAL_FORMATS.completeBackup.metadataVersion,containerMagic:EXTERNAL_FORMATS.completeBackup.containerMagic,policy:'current writer'}),
  protectedBackup:item({...EXTERNAL_FORMATS.protectedBackup,policy:'current writer'})
});


// These are intentionally excluded from the disposable facade. They may move
// behind cleaner APIs later, but their purpose is current correctness/safety,
// not historical compatibility.
export const PERMANENT_NON_MIGRATION=freeze({
  canonicalValidation:item({owner:'record-codecs/repositories',reason:'reject malformed/currently unsupported data before persistence or restore'}),
  indexedDbUpgradeMechanism:item({owner:'persistence',reason:'needed for fresh database creation and future schema changes; historical oldVersion branches are separately disposable'}),
  activeSessionRecovery:item({owner:'repositories',reason:'current crash recovery'}),
  dailyRecordFallback:item({owner:'repositories',reason:'current degraded-storage recovery; replay into IndexedDB is recovery, not legacy migration'}),
  scheduleProgressRemap:item({owner:'plan/session',reason:'current in-session progress remapping when a schedule changes; not historical storage compatibility'}),
  areaNoteRecovery:item({owner:'repositories',reason:'current IndexedDB write-ahead recovery rows after the v1 localStorage bridge is retired'}),
  deletionRecovery:item({owner:'repositories',reason:'current failed-delete recovery for DailyRecord and ActiveSession; not a synchronization outbox'}),
  savedDayDeletionLedger:item({owner:'repositories',reason:'current domain deletion history needed for explicit Saved-Day checkpoint reconciliation; not distributed-sync state'}),
  restoreAndLibraryClearJournals:item({owner:'repository-journals',reason:'current destructive-operation rollback/recovery'}),
  currentBackupValidation:item({owner:'backup-codec',reason:'current v20/SDBK10 integrity, protected checkpoint-manifest bounds and canonical validation'}),
  currentAttachmentArchiveValidation:item({owner:'attachments',reason:'current SDAT01 v1 import/export validation'})
});

export function allCompatibilityEntries(registry=COMPATIBILITY_REGISTRY){
  return freeze(Object.values(registry).flatMap(group=>group));
}

export function assertCompatibilityContract({baseline=CANONICAL_BASELINE,facade=MIGRATION_FACADE_CONTRACT,registry=COMPATIBILITY_REGISTRY}={}){
  if(!Object.isFrozen(baseline)||!Object.isFrozen(facade)||!Object.isFrozen(registry))throw new TypeError('Compatibility contracts must be frozen.');
  if(!Number.isSafeInteger(LEGACY_BACKUP_SCHEMA_VERSION)||LEGACY_BACKUP_SCHEMA_VERSION<1)throw new Error('Legacy backup schema ceiling is invalid.');
  if(facade.baselineId!==baseline.id)throw new Error('Migration facade baseline differs from the canonical baseline.');
  const allowedKinds=new Set(['live-migration','live-canonicalization','schema-bridge','cleanup','import-adapter','protocol-bridge']);
  const entries=allCompatibilityEntries(registry),ids=new Set();
  if(!entries.length)throw new Error('Compatibility registry is empty.');
  for(const entry of entries){
    if(!entry||!Object.isFrozen(entry)||typeof entry.id!=='string'||!entry.id||ids.has(entry.id))throw new Error('Compatibility entry identity is invalid or duplicated.');
    ids.add(entry.id);
    if(!allowedKinds.has(entry.kind)||!entry.owner||!entry.source||!entry.target||!entry.proof||!entry.retirement)throw new Error(`Compatibility entry ${entry.id} is incomplete.`);
    if(!Array.isArray(entry.sourceFiles)||!Object.isFrozen(entry.sourceFiles)||!entry.sourceFiles.length)throw new Error(`Compatibility entry ${entry.id} has no source inventory.`);
  }
  if(baseline.indexedDb.version!==INDEXED_DB.version||baseline.indexedDb.schemas.dailyRecords!==CURRENT_SCHEMA_VERSIONS.DailyRecord||baseline.external.completeBackup.metadataVersion!==EXTERNAL_FORMATS.completeBackup.metadataVersion||baseline.external.protectedBackup.magic!==EXTERNAL_FORMATS.protectedBackup.magic)throw new Error('Canonical baseline no longer matches the authoritative persistence identities.');
  return true;
}
assertCompatibilityContract();
