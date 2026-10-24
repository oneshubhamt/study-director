import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  CANONICAL_BASELINE,MIGRATION_FACADE_CONTRACT,COMPATIBILITY_REGISTRY,
  CURRENT_FORMATS_OUTSIDE_MIGRATION,allCompatibilityEntries,assertCompatibilityContract
} from '../../../contracts/compatibility.mjs';
import {CACHE_STORAGE_IDENTITIES} from '../../../contracts/canonical-identities.mjs';
import {OBSOLETE_APP_META_KEYS,OBSOLETE_LOCAL_STORAGE_KEYS,APP_META_VALIDATION_OWNERS} from '../../../contracts/data-architecture.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const app=read('source/app.html');
const compatibility=read('source/core/compatibility.js');
const compatibilityHost=read('source/core/compatibility-host.js');
const hostMetadata=read('source/core/host-metadata.js');
const startup=read('source/core/startup.js');
const persistence=read('source/core/persistence.js');
const repositories=read('source/core/repositories.js');
const notesRepository=read('source/core/repositories-notes.js');
const review=read('source/core/review.js');
const assets=read('source/core/asset-storage.js');
const backupCodec=read('source/core/backup-codec.js');
const exportsSource=read('source/core/exports.js');
const drive=read('source/external/drive.js');
const sw=read('source/platform/sw.js');
const attachments=read('source/core/attachments.js');
const records=read('source/core/record-codecs.js');
const compatibilityCodecs=read('source/core/compatibility-codecs.js');

assert.equal(assertCompatibilityContract(),true);
assert.equal(MIGRATION_FACADE_CONTRACT.baselineId,CANONICAL_BASELINE.id);
assert.ok(CANONICAL_BASELINE.id.startsWith('SD'+'VB')&&CANONICAL_BASELINE.id.endsWith('L10'));
assert.equal(CANONICAL_BASELINE.status,'target-not-yet-proven');
assert.equal(MIGRATION_FACADE_CONTRACT.disposable,false);
assert.equal(MIGRATION_FACADE_CONTRACT.retirementMode,'isolate-adapters-then-delete-package');
assert.equal(MIGRATION_FACADE_CONTRACT.status,'runtime-isolated-detachable-host');
assert.deepEqual(MIGRATION_FACADE_CONTRACT.verification.localChecks,['planLegacy','reflectionLegacy','activeSession','notes','noteRecovery','dailyRecords','deletionState','insightsRevisionEnvelope','canonicalStores','legacyStorage','legacyAttachments','obsoleteMetadata','topology','retiredIdentity']);
assert.equal(MIGRATION_FACADE_CONTRACT.verification.backupCheck,'freshBackup');
assert.equal(CANONICAL_BASELINE.policy.ordinaryRuntime,'current-canonical-only');

const entries=allCompatibilityEntries();
assert.equal(entries.length,26,'Every temporary compatibility path must remain explicitly inventoried until retirement.');
assert.equal(new Set(entries.map(entry=>entry.id)).size,entries.length);
for(const entry of entries){
  for(const file of entry.sourceFiles)assert.ok(fs.existsSync(path.join(root,file)),`${entry.id} references missing source ${file}`);
  assert.match(entry.retirement,/baseline|backup|installed build/i,`${entry.id} must have an explicit retirement gate.`);
}

const evidenceByCompatibilityId=Object.freeze({
  'plan-legacy-schedule':['tests/integration/storage/compatibility-retirement.mjs','tests/integration/plans/saved-plans-logic.mjs'],
  'reflection-drafts-retirement':['tests/integration/storage/compatibility-retirement.mjs','tests/integration/review/reflection-session-codec.mjs'],
  'active-session-v7-domain-separation':['tests/integration/review/reflection-session-codec.mjs'],
  'note-historical-rows':['tests/integration/rich-text/editor-persistence.mjs'],
  'note-recovery-v1':['tests/integration/rich-text/editor-persistence.mjs'],
  'daily-record-historical-shapes':['tests/integration/storage/canonical-baseline.mjs'],
  'r10-sync-delete-state':['tests/integration/storage/deletion-recovery.mjs'],
  'r10-indexeddb-topology-retirement':['tests/integration/storage/indexeddb-topology-retirement.mjs'],
  'insights-revision-appmeta-envelope':['tests/integration/storage/appmeta-contract.mjs'],
  'legacy-device-identity':['tests/integration/storage/installation-identity.mjs'],
  'indexeddb-pre-v3-migration-marker':['tests/integration/storage/compatibility-retirement.mjs','tests/unit/storage/indexeddb-durability.mjs'],
  'legacy-localstorage-residue':['tests/integration/storage/compatibility-retirement.mjs'],
  'legacy-attachment-storage':['tests/integration/attachments/legacy-attachment-cleanup.mjs'],
  'obsolete-reflection-migration-meta':['tests/integration/storage/data-maintenance.mjs'],
  'legacy-json-backups':['tests/integration/backup/backup-persistence.mjs'],
  'complete-backup-v7-v19':['tests/integration/backup/backup-persistence.mjs'],
  'l7-host-metadata-normalization':['tests/integration/storage/compatibility-host.mjs'],
  'appmeta-stable-names':['tests/integration/storage/compatibility-host.mjs'],
  'l13e-repository-maintenance-v1':['tests/integration/storage/compatibility-host.mjs','tests/integration/backup/repository-incremental-preparation.mjs','tests/integration/backup/repository-restore.mjs'],
  'restore-journal-payload-v1-v4':['tests/integration/storage/compatibility-host.mjs','tests/integration/storage/repository-journals.mjs'],
  'canonical-note-and-folder-names':['tests/integration/storage/compatibility-host.mjs','tests/integration/storage/indexeddb-topology-retirement.mjs'],
  'area-note-names-in-backups':['tests/integration/backup/current-canonical-roundtrip.mjs','tests/integration/backup/repository-restore.mjs'],
  'backup-repository-v1-v4':['tests/integration/backup/repository-restore.mjs'],
  'device-folder-single-repository':['tests/integration/backup/device-folder-layout.mjs'],
  'name-keyed-notes-in-backups':['tests/integration/backup/current-canonical-roundtrip.mjs','tests/integration/backup/repository-restore.mjs','tests/integration/storage/canonical-schema-separation.mjs'],
  'legacy-service-worker-update-bridge':['tests/integration/pwa/service-worker-lifecycle.mjs'],
});
assert.deepEqual(Object.keys(evidenceByCompatibilityId).sort(),entries.map(entry=>entry.id).sort(),'every disposable compatibility path must have explicit regression evidence');
for(const files of Object.values(evidenceByCompatibilityId))for(const file of files)assert.ok(fs.existsSync(path.join(root,file)),`compatibility evidence test is missing: ${file}`);

// Read once, convert, retire: every retired browser-storage key is handed to a
// compatibility path, every retired appMeta identity is cleaned by it, and no
// retired identity is still a current validated family.
for(const name of Object.keys(OBSOLETE_LOCAL_STORAGE_KEYS))assert.match(app,new RegExp(`OBSOLETE_STORAGE_KEYS\\.${name}\\b`,'u'),`retired browser-storage key ${name} has no compatibility path`);
assert.match(app,/obsoleteMetaKeys:Object\.freeze\(Object\.values\(OBSOLETE_APP_META_KEYS\)\)/u,'every retired appMeta identity is removed by the compatibility cleanup');
for(const name of Object.keys(OBSOLETE_APP_META_KEYS))assert.ok(!Object.values(APP_META_VALIDATION_OWNERS).flat().includes(name),`retired appMeta identity ${name} must not be a current family`);
assert.doesNotMatch(read('source/core/host-metadata.js'),/version===1\|\||\[1,2(,3)?(,4)?\]\.includes|version>=3&&version<=5/u,'ordinary host metadata validators read only current versions');

// One runtime facade owns all live migration orchestration and legacy backup routing.
assert.match(compatibility,/function createFacade\(input\)/u);
assert.match(compatibility,/async function migrateLive\(\)/u);
assert.match(compatibility,/input\.live\.migratePlan\(\)/u);
assert.match(compatibility,/input\.live\.migrateReflections\(\)/u);
assert.match(compatibility,/input\.live\.migrateActiveSession\(\)/u);
assert.match(compatibility,/input\.live\.migrateNoteRecovery\(\)/u);
assert.match(compatibility,/input\.live\.migrateDailyRecords\(\)/u);
assert.match(compatibility,/input\.live\.migrateDeletionState\(\)/u);
assert.match(compatibility,/input\.live\.migrateInsightsRevisionEnvelope\(\)/u);
assert.match(compatibility,/input\.live\.migrateHostMetadata\(\)/u);
assert.match(compatibility,/input\.live\.cleanupLegacyAttachments\(\)/u);
assert.match(compatibility,/input\.live\.cleanupObsoleteMetadata\(\)/u);
assert.match(compatibility,/input\.live\.retireTopology\(\)/u);
assert.match(compatibility,/input\.live\.retireLegacyIdentity\(\)/u);
assert.match(compatibility,/error&&error\.code==='STUDY_DIRECTOR_LEGACY_BACKUP'/u);
assert.match(compatibility,/async function verifyCanonicalInstallation\(\)/u);
assert.match(compatibility,/retirementDataReady:canonical&&backupReady&&compatibilityRetired/u);
assert.match(app,/const CompatibilityFacade=CompatibilityHostModule\.createFacade/u);
assert.match(app,/migrateCompatibility:\(\)=>CompatibilityFacade\.migrateLive\(\)/u);
assert.match(app,/verifyReady:\(\)=>CompatibilityFacade\.verifyCanonicalInstallation\(\)/u,'actual installations must run the canonical proof before publishing startup-ready');
assert.match(app,/studyDirectorCanonicalBaseline=proof\.canonical\?'verified':'not-proven'/u);
assert.match(app,/studydirector:canonicalstatus/u);
assert.match(app,/const entry=\{at:new Date\(\)\.toISOString\(\),sourceRevision,format:DATA_CONTRACT\.schemas\.Backup\.version\}/u,'each recorded backup copy keeps only when it was made, the change it holds and its backup format');
assert.match(app,/async function verifyFreshCurrentBackup\(\)/u);
assert.match(app,/entry\.verified!==false&&entry\.format===DATA_CONTRACT\.schemas\.Backup\.version/u,'only a verified copy in the current backup format proves a fresh backup');
assert.match(startup,/await runStage\('compatibility-migration',startup\.migrateCompatibility\)/u);
assert.doesNotMatch(startup,/cleanupLegacyStorage|cleanupLegacyAttachments/u,'startup must see one compatibility operation, not individual legacy branches');

// Normal live paths are current-only. Historical conversion remains callable only through explicit adapters.
assert.doesNotMatch(app,/async function migrateLegacyPlanData\(|async function migrateLegacyReflectionDraftData\(|legacyInstallationIdentity\(/u,'historical host migration algorithms must not remain in app.html');
assert.match(compatibilityHost,/async function migratePlan\(\)/u,'Plan migration must live in the detachable compatibility host.');
const planMigration=compatibilityHost.slice(compatibilityHost.indexOf('async function migratePlan(){'),compatibilityHost.indexOf('async function migrateReflections(){'));
assert.ok(planMigration.indexOf('await plan.writeDraft(legacy')<planMigration.indexOf('local.remove(obsolete.schedule)'),'legacy Plan draft must commit before its source key is removed');
assert.ok(planMigration.indexOf('await plan.writeLibrary(')<planMigration.indexOf('local.remove(obsolete.defaults)'),'legacy Plan default must commit before its source field is retired');
assert.ok(planMigration.indexOf('const written=await preferences.write(next')<planMigration.indexOf('local.remove(obsolete.defaults)'),'legacy personal settings must be committed before legacy defaults are removed');
const planBlock=app.slice(app.indexOf('const PlanData=(()=>{'),app.indexOf('/* PLAN MODULE COMPOSITION */'));
assert.doesNotMatch(planBlock,/OBSOLETE_STORAGE_KEYS|migrateLegacy/u,'normal Plan capability must not contain historical storage interpretation');
assert.match(app,/CompatibilityHostModule\.createFacade/u);
assert.match(app,/HostMetadataModule\.createAppMetaValidators/u,'current host appMeta validation must remain outside detachable compatibility');
assert.doesNotMatch(compatibilityHost,/createAppMetaValidators|backupProtection.*verifier/u,'detachable compatibility host must not own permanent current appMeta validation');
assert.match(hostMetadata,/function createAppMetaValidators\(input\)/u);
assert.match(compatibilityHost,/async function migrateReflections\(\)/u,'Reflection migration must live in the detachable compatibility host.');
const reflectionMigration=compatibilityHost.slice(compatibilityHost.indexOf('async function migrateReflections(){'),compatibilityHost.indexOf('async function migrateIdentity(){'));
assert.match(reflectionMigration,/issueWriteToken\('discard retired reflection-draft storage'/u,'Reflection retirement must remain ownership-gated.');
assert.match(reflectionMigration,/local\.remove\(obsolete\.reflectionDrafts\)/u,'Retired Reflection Draft collection storage must be discarded by compatibility migration.');
assert.match(reflectionMigration,/local\.remove\(obsolete\.reflectionLegacy\)/u,'Retired single Reflection Draft storage must be discarded by compatibility migration.');
assert.doesNotMatch(reflectionMigration,/reflection\.migrate|verifiedRows|putReflection|migrateReflectionDrafts/u,'Reflection retirement must not recreate discarded drafts in current canonical storage.');
assert.doesNotMatch(review,/legacyStorageKeys|LEGACY_STORAGE_KEYS|OBSOLETE_STORAGE_KEYS|migrateLegacy/u,'normal Review capability must contain no historical storage parser or migration entry point');
assert.doesNotMatch(app,/event\.key===OBSOLETE_STORAGE_KEYS\.reflectionDrafts/u,'ordinary runtime must not observe retired Reflection LocalStorage as a live data surface');
assert.match(repositories,/async function migrateNoteRecovery\(\)/u);assert.doesNotMatch(notesRepository,/CompatibilityCodec|compatibilityWriteToken|legacyKeys|async function migrate/u,'the notes repository holds no compatibility code');
assert.match(repositories,/async function migrateHistoricalActiveSession\(\)/u);
assert.match(repositories,/migrateActiveSession:migrateHistoricalActiveSession/u);
assert.match(repositories,/async function migrateHistoricalDailyRecords\(\)/u);
assert.match(repositories,/async function verifyDailyRecordCanonicalBaseline\(\)/u);
assert.doesNotMatch(repositories,/migrateReflectionDrafts|idbApplyReflectionDrafts|reflectionDrafts=freeze\(/u,'retired Reflection Draft persistence must not remain exposed by current repositories.');
assert.doesNotMatch(repositories,/function requireDailyRecordCanonicalReady\(\)/u,'normal Daily Record paths must not depend on a disposable migration marker');
assert.match(repositories,/function readableDailyRecord\(record\)[\s\S]{0,260}canonicalRuntimeError/u);
assert.doesNotMatch(notesRepository,/normalizePayload\(parsed\.pending,\{compatibility:true\}\)/u,'normal note normalization must not expose a historical-mode switch');
assert.match(repositories,/function readLegacyPendingNotes\(\)/u,'the v1 pending cache is read only by the compatibility block');
assert.match(compatibility,/Historical data must never leak into ordinary hydration as a fallback/u);
assert.match(assets,/uses historical metadata and must be migrated before normal runtime access/u);
assert.match(records,/function sanitizeCurrentDailyRecord\(record\)/u);
assert.doesNotMatch(records,/canonicalizeHistoricalDailyRecord|sanitizeHistoricalDailyRecord|sanitizeImportedNote|canonicalizeHistoricalNote|sanitizeImportedActiveSession/u,'ordinary record codecs must be current-schema only');
assert.match(compatibilityCodecs,/function sanitizeHistoricalDailyRecord\(record\)/u);
assert.match(compatibilityCodecs,/function dailyRecord\(record\)/u);
assert.match(compatibilityCodecs,/function note\(value,keyHint=''/u);
assert.match(compatibilityCodecs,/function activeSession\(session\)/u);
assert.match(compatibilityCodecs,/function localRecoveryEnvelope\(raw\)/u);
assert.match(compatibilityCodecs,/function migrateSessionSnapshot\(snapshot\)/u,'Historical Active Session compatibility must migrate embedded reflectionDraft state into snapshot.review.');
assert.doesNotMatch(compatibilityCodecs,/function reflectionDraft\(/u,'Standalone Reflection Draft compatibility codec must be retired with the domain.');
assert.doesNotMatch(persistence,/Number\(e\.oldVersion\|\|0\)<3/u,'historical IndexedDB decisions must not remain in permanent persistence');
assert.match(compatibility,/function applyIndexedDbUpgrade\(/u);
assert.doesNotMatch(persistence,/input\.compatibility/u,'permanent IndexedDB primitives must not depend on compatibility');
assert.match(persistence,/const applyUpgrade=input\.upgrade\?input\.upgrade\.apply:\(\)=>false/u,'historical upgrade adapter must be optional and generic');
assert.match(app,/upgrade:Object\.freeze\(\{/u);
assert.doesNotMatch(assets,/async function put[\s\S]{0,1200}cleanupLegacy\(/u,'normal attachment writes must not opportunistically run legacy cleanup');
assert.match(assets,/async function verifyLegacyClean\(\)/u);

// Current backup I/O is separate from temporary legacy import adapters.
assert.match(backupCodec,/async function inspectCurrentBackup\(/u);
assert.match(backupCodec,/async function inspectLegacyBackup\(/u);
assert.match(app,/const RuntimeBackupCodec=Object\.freeze\(Object\.fromEntries/u);
assert.match(app,/!\['inspectCurrent','inspectLegacy'\]\.includes\(key\)/u,'legacy/current backup inspection entry points must not leak onto the ordinary runtime codec');
assert.match(app,/\['inspect',\(file,options\)=>CompatibilityFacade\.inspectBackup\(file,options\)\]/u);
assert.match(exportsSource,/if\(Number\(info\.version\)!==2\)throw/u,'only the current SDENC02 protected format is read');assert.doesNotMatch(exportsSource,/SDENC01|legacyDecryptBackup/u);
assert.doesNotMatch(drive,/SDENC02|\.sdbackup/u,'Drive repository transport must remain opaque to portable/protected backup container formats');
assert.doesNotMatch(allCompatibilityEntries().map(entry=>entry.id).join('|'),/backup-protection-policy-v1|protected-backup-v1/u,'retired password and encrypted-format paths stay gone');

// Service Worker runs in a separate realm but exposes one explicitly disposable companion facade.
assert.match(sw,/const CompatibilityFacade=Object\.freeze/u);
assert.match(sw,/@@SD_CACHE_STORAGE_IDENTITIES@@/u);
assert.equal(CACHE_STORAGE_IDENTITIES.updateBridge,'study-director-update-bridge-v2');
assert.match(sw,/CompatibilityFacade\.installBridgeRequired\(\)/u);
assert.match(sw,/CompatibilityFacade\.recoveryHandoff\(\)/u);

assert.equal(CURRENT_FORMATS_OUTSIDE_MIGRATION.completeBackup.version,23);
assert.equal(CURRENT_FORMATS_OUTSIDE_MIGRATION.protectedBackup.version,2);
assert.match(attachments,/new TextEncoder\(\)\.encode\('SDAT01\\r\\n'\)/u);
assert.match(attachments,/m\.format!=='study-director\.attachments'\|\|m\.version!==1/u);

for(const id of [
  'plan-legacy-schedule','reflection-drafts-retirement','active-session-v7-domain-separation','note-historical-rows','note-recovery-v1','daily-record-historical-shapes','r10-sync-delete-state',
  'legacy-device-identity','l7-host-metadata-normalization','r10-indexeddb-topology-retirement','indexeddb-pre-v3-migration-marker','legacy-localstorage-residue','legacy-attachment-storage',
  'obsolete-reflection-migration-meta','legacy-json-backups','complete-backup-v7-v19','legacy-service-worker-update-bridge'
])assert.ok(entries.some(entry=>entry.id===id),`Missing compatibility inventory entry ${id}`);

console.log(JSON.stringify({
  status:'PASS',suite:'compatibility-contract',baseline:CANONICAL_BASELINE.id,
  temporaryCompatibilityEntries:entries.length,
  groups:Object.fromEntries(Object.entries(COMPATIBILITY_REGISTRY).map(([name,value])=>[name,value.length])),
  runtimeFacade:true,currentRuntimeCanonicalOnly:true
},null,2));
