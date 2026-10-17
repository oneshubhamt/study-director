import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  COMPATIBILITY_REGISTRY,CURRENT_FORMATS_OUTSIDE_MIGRATION,PERMANENT_NON_MIGRATION,MIGRATION_FACADE_CONTRACT,allCompatibilityEntries
} from '../../../contracts/compatibility.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const exists=file=>fs.existsSync(path.join(root,file));
const assertEvidence=(label,map,expected)=>{
  assert.deepEqual(Object.keys(map).sort(),expected.sort(),`${label} coverage map must stay exhaustive`);
  for(const [id,files] of Object.entries(map)){
    assert.ok(Array.isArray(files)&&files.length,`${label} ${id} needs direct evidence`);
    for(const file of files)assert.ok(exists(file),`${label} ${id} evidence is missing: ${file}`);
  }
};

const migrationEvidence=Object.freeze({
  'plan-legacy-schedule':['tests/integration/storage/compatibility-retirement.mjs','tests/integration/plans/saved-plans-logic.mjs'],
  'reflection-drafts-retirement':['tests/integration/storage/compatibility-retirement.mjs','tests/integration/review/reflection-session-codec.mjs'],
  'active-session-v7-domain-separation':['tests/integration/review/reflection-session-codec.mjs'],
  'note-historical-rows':['tests/integration/storage/canonical-baseline.mjs','tests/integration/rich-text/editor-persistence.mjs'],
  'note-recovery-v1':['tests/integration/rich-text/editor-persistence.mjs'],
  'daily-record-historical-shapes':['tests/integration/storage/canonical-baseline.mjs'],
  'insights-revision-appmeta-envelope':['tests/integration/storage/appmeta-contract.mjs'],
  'r10-sync-delete-state':['tests/integration/storage/deletion-recovery.mjs'],
  'r10-indexeddb-topology-retirement':['tests/integration/storage/indexeddb-topology-retirement.mjs'],
  'legacy-device-identity':['tests/integration/storage/installation-identity.mjs'],
  'indexeddb-pre-v3-migration-marker':['tests/integration/storage/compatibility-retirement.mjs','tests/unit/storage/indexeddb-durability.mjs'],
  'legacy-localstorage-residue':['tests/integration/storage/compatibility-retirement.mjs'],
  'legacy-attachment-storage':['tests/integration/attachments/legacy-attachment-cleanup.mjs'],
  'obsolete-reflection-migration-meta':['tests/integration/storage/data-maintenance.mjs'],
  'legacy-json-backups':['tests/integration/backup/backup-persistence.mjs'],
  'complete-backup-v7-v19':['tests/integration/backup/backup-persistence.mjs','tests/integration/backup/checkpoint-handoff.mjs'],
  'l7-host-metadata-normalization':['tests/integration/storage/compatibility-host.mjs'],
  'appmeta-stable-names':['tests/integration/storage/compatibility-host.mjs'],
  'l13e-repository-maintenance-v1':['tests/integration/storage/compatibility-host.mjs','tests/integration/backup/repository-incremental-preparation.mjs','tests/integration/backup/repository-restore.mjs'],
  'restore-journal-payload-v1-v4':['tests/integration/storage/compatibility-host.mjs','tests/integration/storage/repository-journals.mjs'],
  'canonical-note-and-folder-names':['tests/integration/storage/compatibility-host.mjs','tests/integration/storage/indexeddb-topology-retirement.mjs'],
  'area-note-names-in-backups':['tests/integration/backup/current-canonical-roundtrip.mjs','tests/integration/backup/repository-restore.mjs'],
  'backup-repository-v1-v4':['tests/integration/backup/repository-restore.mjs'],
  'name-keyed-notes-in-backups':['tests/integration/backup/current-canonical-roundtrip.mjs','tests/integration/backup/repository-restore.mjs','tests/integration/storage/canonical-schema-separation.mjs'],
  'legacy-service-worker-update-bridge':['tests/integration/pwa/service-worker-lifecycle.mjs']
});
assertEvidence('migration',migrationEvidence,allCompatibilityEntries(COMPATIBILITY_REGISTRY).map(entry=>entry.id));

const recoveryEvidence=Object.freeze({
  canonicalValidation:['tests/integration/storage/canonical-baseline.mjs','tests/integration/backup/backup-persistence.mjs'],
  indexedDbUpgradeMechanism:['tests/unit/storage/indexeddb-durability.mjs','tests/integration/storage/compatibility-retirement.mjs','tests/integration/storage/indexeddb-topology-retirement.mjs'],
  activeSessionRecovery:['tests/integration/app/runtime-resilience.mjs'],
  dailyRecordFallback:['tests/integration/storage/canonical-baseline.mjs'],
  scheduleProgressRemap:['tests/unit/app/practice-pacer.mjs','tests/unit/app/timer-state.mjs'],
  noteRecovery:['tests/integration/rich-text/editor-persistence.mjs'],
  deletionRecovery:['tests/integration/storage/deletion-recovery.mjs','tests/integration/app/runtime-resilience.mjs'],
  savedDayDeletionLedger:['tests/integration/storage/deletion-recovery.mjs'],
  restoreAndLibraryClearJournals:['tests/integration/storage/repository-journals.mjs','tests/integration/library/library-clear.mjs','tests/integration/backup/import-lifecycle.mjs'],
  currentBackupValidation:['tests/integration/backup/backup-persistence.mjs','tests/integration/backup/portable-backup.mjs','tests/integration/backup/checkpoint-handoff.mjs','tests/integration/backup/repository-restore.mjs'],
  currentAttachmentArchiveValidation:['tests/integration/attachments/attachment-archive.mjs']
});
assertEvidence('permanent recovery/validation',recoveryEvidence,Object.keys(PERMANENT_NON_MIGRATION));

const externalEvidence=Object.freeze({
  attachmentArchive:['tests/integration/attachments/attachment-archive.mjs'],
  noteExports:['tests/unit/exports/note-export.mjs'],
  completeBackup:['tests/integration/backup/backup-persistence.mjs','tests/integration/backup/checkpoint-handoff.mjs','tests/integration/backup/device-backup.mjs','tests/integration/backup/repository-restore.mjs','tests/integration/backup/drive-security.mjs'],
  protectedBackup:['tests/integration/backup/encryption.mjs','tests/integration/backup/folder-encryption.mjs','tests/integration/backup/repository-restore.mjs','tests/integration/backup/drive-security.mjs']
});
assertEvidence('external format',externalEvidence,Object.keys(CURRENT_FORMATS_OUTSIDE_MIGRATION));

const integrityEvidence=Object.freeze({
  'canonical-records':['tests/integration/storage/canonical-baseline.mjs'],
  'attachment-bytes':['tests/integration/storage/attachment-integrity-audit.mjs','tests/integration/attachments/worker-behavior.mjs'],
  'shared-attachment-hashes':['tests/integration/attachments/attachment-storage-dedup.mjs'],
  'complete-backup-container':['tests/integration/backup/backup-persistence.mjs','tests/integration/backup/portable-backup.mjs'],
  'protected-backup-authentication':['tests/integration/backup/encryption.mjs'],
  'attachment-archive-container':['tests/integration/attachments/attachment-archive.mjs'],
  'restore-rollback':['tests/integration/backup/import-lifecycle.mjs','tests/integration/backup/restore-assets.mjs'],
  'library-clear-rollback':['tests/integration/library/library-clear.mjs'],
  'strict-durability':['tests/integration/storage/strict-durability-boundaries.mjs']
});
for(const [boundary,files] of Object.entries(integrityEvidence))for(const file of files)assert.ok(exists(file),`integrity boundary ${boundary} evidence is missing: ${file}`);

console.log(JSON.stringify({
  status:'PASS',suite:'retirement-readiness',
  temporaryMigrations:Object.keys(migrationEvidence).length,
  permanentRecoveryAndValidation:Object.keys(recoveryEvidence).length,
  externalFormats:Object.keys(externalEvidence).length,
  integrityBoundaries:Object.keys(integrityEvidence).length,
  facadeDeletionReady:MIGRATION_FACADE_CONTRACT.disposable===true,
  facadeIsolationRequired:MIGRATION_FACADE_CONTRACT.disposable!==true
},null,2));
