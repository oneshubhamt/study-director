import {readHostHtml} from '../../../build/host-source.mjs';
import {readScript} from '../../../build/source-script.mts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const read=relative=>readScript(path.join(root,relative));
const app=readHostHtml();
const backup=read('source/core/backup.ts');
const backupCapture=read('source/core/backup-capture.ts');
const managedRepository=read('source/core/managed-repository.ts');
const repositoryBackground=read('source/core/repository-background.ts');
const backupProvider=read('source/core/backup-provider.ts');
const reconciliation=read('source/core/reconciliation.ts');
const canonicalCore=read('source/core/canonical.ts');
const codec=read('source/core/backup-codec.ts');
const device=read('source/core/device-backup.ts');
const drive=read('source/external/drive.js');
const attachments=read('source/core/attachments.ts');
const repositories=read('source/core/repositories.ts');
const notes=read('source/core/repositories-notes.ts');
const startup=read('source/core/startup.ts');
const dataBootstrap=read('source/core/data-bootstrap-host.ts');
const persistence=read('source/core/persistence.ts');
const hostMetadata=read('source/core/host-metadata.ts');
const backupRecoveryHost=read('source/core/backup-recovery-host.ts');
const canonical=read('contracts/canonical-identities.mjs');

const dataArchitecture=read('contracts/data-architecture.mjs');
const build=read('build/build.mjs');
const currentSource=[app,backup,managedRepository,backupProvider,device,repositories,startup,persistence].join('\n');

for(const retired of ['AppData.sync','createVerified','syncEntityKey','normalizeSyncTimestamp','syncable','maxImportTombstones']){
  assert.equal(currentSource.includes(retired),false,`retired current-runtime symbol must stay absent: ${retired}`);
}

const entityStart=dataBootstrap.indexOf('const ENTITY_DEFINITIONS');
const entityEnd=dataBootstrap.indexOf('const BACKUP_ENTITY_TYPES=',entityStart);
assert.ok(entityStart>=0&&entityEnd>entityStart,'current entity definition block must remain discoverable in the typed data-bootstrap authority');
const currentEntities=dataBootstrap.slice(entityStart,entityEnd);
assert.equal(currentEntities.includes('tombstone'),false,'generalized tombstones must not be a current entity definition');
assert.equal(currentEntities.includes('syncable'),false,'current domain entities must not carry distributed-sync capability flags');

assert.match(repositories,/const DATA_MAINTENANCE_VERSION\s*=6;/u,'strict maintenance completion must use the lean v6 shape');
assert.match(repositories,/const report\s*=\s*\{version:DATA_MAINTENANCE_VERSION\s*,status:'completed'\s*,completedAt:new Date\s*\(\s*\)\s*\.toISOString\s*\(\s*\)\};/u,'maintenance must persist operational scheduling metadata only');
for(const retiredCounter of ['summariesRebuilt','fallbackRecordsMigrated','invalidRecoveryCacheCleared','pendingDeletionRecovery']){
  assert.equal(repositories.includes(`report.${retiredCounter}`),false,`maintenance report counter must stay retired: ${retiredCounter}`);
}

for(const retiredStartup of ['syncQueue','syncEmergency','tombstone','pendingSync']){
  assert.equal(startup.includes(retiredStartup),false,`startup must not contain retired sync flushing: ${retiredStartup}`);
}

assert.match(backup,/const LogicalCheckpointCapture\s*=freeze\s*\(\s*\{capture:captureLogicalCheckpoint\}\s*\);/u,'checkpoint capture must be a distinct immutable logical-state boundary');
assert.match(backup,/const PortableCheckpointMaterializer\s*=freeze\s*\(\s*\{materialize:materializePortableCheckpoint\}\s*\);/u,'portable .sdbackup materialisation must remain separate from logical checkpoint capture');
assert.match(backup,/async function createCanonicalCheckpoint\s*\(options\s*=\s*\{\}\s*,report\s*=null\s*\)\s*\{[\s\S]*LogicalCheckpointCapture\s*\.capture\s*\(new Date\s*\(\s*\)\s*\.toISOString\s*\(\s*\)\s*,options\s*\)[\s\S]*PortableCheckpointMaterializer\s*\.materialize\s*\(capture\s*,\s*\{preferCompression:true\s*,verify:true\s*,report\}\s*\);/u,'current checkpoint creation must capture once and then materialise the existing portable format');
assert.match(codec,/plan&&plan\s*\.checkpoint\?validateCheckpointMetadata\s*\(plan\s*\.checkpoint\s*\):backupCheckpointMetadata/u,'portable manifest creation must reuse captured checkpoint provenance when supplied');
assert.match(backupCapture,/protectedCheckpointManifest\s*=BackupCodec\s*\.createProtectedManifest\s*\(captureBase\s*,checkpointMetadata\s*\)/u,'logical capture must bind protected deletion/authority state to the same checkpoint identity before materialisation');
assert.match(backup,/BackupCaptureModule\s*\.create/u,'backup façade must compose logical capture and incremental preparation through the extracted capture module');
assert.match(backup,/const CheckpointPipeline\s*=freeze\s*\(\s*\{\s*create:BackupController\s*\.createCheckpoint\s*,inspect:BackupController\s*\.inspect\s*,restore:BackupController\s*\.restore\s*,markCompleted:BackupController\s*\.markCompleted\s*\}\s*\);/su,'portable checkpoint pipeline must remain the explicit .sdbackup transport port');
assert.match(backup,/const \s*\{controller:BackupController\s*,repository:RepositoryCheckpointPipeline\}\s*=\s*\(\s*\(\s*\)\s*=>\s*\{[\s\S]*const repository\s*=freeze\s*\(\s*\{[\s\S]*publish:\s*\(history\s*,options\s*,transport\s*\)\s*=>track\s*\(\s*\(\s*\)\s*=>ManagedRepository\s*\.publish\s*\(history\s*,options\s*,transport\s*\)\s*,true\s*\)\s*,[\s\S]*publishInline:ManagedRepository\s*\.publish\s*,[\s\S]*inspectManifest:ManagedRepository\s*\.inspectManifest\s*,[\s\S]*bringIn:controller\s*\.restore\s*,[\s\S]*restoreVersion:\s*\(\s*\.\s*\.\s*\.args\s*\)\s*=>track\s*\(\s*\(\s*\)\s*=>restoreManagedVersion\s*\(\s*\.\s*\.\s*\.args\s*\)\s*,true\s*\)\s*,[\s\S]*retention:ManagedRepository\s*\.retention\s*,[\s\S]*projectHistory:ManagedRepository\s*\.projectHistory\s*,[\s\S]*markCompleted:controller\s*\.markCompleted[\s\S]*return freeze\s*\(\s*\{controller\s*,repository\}\s*\);/u,'backup runtime must return sibling frozen controller and repository capabilities so repository ownership semantics remain private without proxying pure repository methods through the controller');
assert.doesNotMatch(app,/inspectManifest:\(\.\.\.args\)=>RepositoryCheckpointPipeline\.inspectManifest/u,'app.html must not recreate mechanical repository pass-through wrappers');
const expectedRepositoryPort=['activeProtected','bringIn','classifyState','cleanup','createPublication','establishBase','inspect','inspectCommit','inspectManifest','markCompleted','noteObject','projectHistory','publish','publishInline','readNote','readSession','restoreVersion','retention','scrub','selectRetention','sharedBase','validatePolicy','verifyCheckpoint','verifyObject'].sort();
const repositoryCapabilityBody=backup.match(/const repository=freeze\(\{([\s\S]*?)\n\}\);\nreturn freeze\(\{controller,repository\}\);/u)?.[1]||'';
const repositoryCapabilityKeys=[...repositoryCapabilityBody.matchAll(/^\s{2}([A-Za-z_$][\w$]*):/gmu)].map(match=>match[1]).sort();
const providerRepositoryKeys=[...(backupProvider.match(/const REPOSITORY_FIELDS=freeze\(\[([^\]]+)\]\)/u)?.[1]||'').matchAll(/['"]([^'"]+)['"]/gu)].map(match=>match[1]).sort();
assert.deepEqual(repositoryCapabilityKeys,expectedRepositoryPort,'the shared repository pipeline must expose exactly the canonical Device/Drive repository capability surface');
assert.deepEqual(providerRepositoryKeys,expectedRepositoryPort,'managed providers must require exactly the canonical shared repository capability surface');
assert.match(managedRepository,/registry\s*\.define\s*\('managed-repository'\s*,1/u,'managed-repository must be a first-class private module');
assert.match(backupProvider,/registry\s*\.define\s*\('backup-provider'\s*,1/u,'backup-provider must be a first-class private module');
for(const repositoryOwned of [/REPOSITORY_MANIFEST_FORMAT/u,/function selectRepositoryRetention\(/u,/async function cleanupRepositoryRetention\(/u,/async function scrubRepositoryIntegrity\(/u])assert.doesNotMatch(backup,repositoryOwned,'repository engine implementation must stay out of backup.ts');
for(const providerOwned of ['repositoryProviderState','saveRepositoryProvider','bringInRepositoryProvider','restoreRepositoryProviderVersion'])assert.equal(backup.includes(providerOwned),false,`managed-provider concern must stay out of backup.ts: ${providerOwned}`);
assert.match(backup,/ManagedRepositoryModule\s*\.createEngine/u,'backup.ts must compose the repository engine through an explicit dependency');
assert.match(backup,/BackupProviderModule\s*\.createRuntime/u,'backup.ts must compose the provider runtime through an explicit dependency');
for(const retired of ['isInspected','prepareRepositoryCheckpoint:','materializeRepositoryCheckpoint:','commitRepositoryCheckpoint:','establishRepositoryReconciliationBase:','releaseRepositoryCheckpoint:','mergeManagedRepositoryHistory','logicalRepositoryFingerprint'])assert.equal(backup.includes(retired),false,`dead public repository API must stay absent: ${retired}`);
assert.doesNotMatch(managedRepository,/PortableCheckpointMaterializer|materializeRepositoryCheckpoint|inspectBackup\s*\(portable\s*\.blob/u,'managed repository restore must not recreate and reopen a temporary portable container');
assert.match(managedRepository,/reconstructVerifiedRepositoryCheckpoint[\s\S]*inspectVerifiedCapture\s*\(reconstructed\s*\.capture/u,'managed repository restore must feed verified reconstructed state into the private snapshot producer');
assert.match(backup,/const inspectedBackups\s*=new WeakMap\s*\(\s*\)\s*,verifiedPortableSnapshots\s*=new WeakMap\s*\(\s*\);/u,'verified portable snapshots must be sealed by private module-owned identity rather than a forgeable flag');
assert.match(backup,/function sealVerifiedPortableSnapshot\s*\([\s\S]*verifiedPortableSnapshots\s*\.set\s*\(snapshot\s*,state\s*\)/u,'verified portable snapshot proof must be private and identity-bound');
assert.match(backup,/function managedParsedSnapshot\s*\([\s\S]*BackupCodec\s*\.normalizeRecord\s*\(record\s*\)/u,'managed repository Saved Days must normalize by entity schema version so repository v5 remains readable across DailyRecord upgrades');
assert.doesNotMatch(backup,/function managedParsedSnapshot\s*\([\s\S]{0,1200}currentDailyRecords\s*\(/u,'managed repository validation must not require historical Saved Days to already match the current DailyRecord schema');
assert.match(backup,/function managedSnapshotStage\s*\([\s\S]*managed-checkpoint-\$\s*\{label\}-failed[\s\S]*errorCode/u,'managed checkpoint portable validation failures must expose safe stage-coded diagnostics');
for(const code of ['MANAGED_CHECKPOINT_DAILY_RECORDS_FAILED','MANAGED_CHECKPOINT_NOTES_FAILED','MANAGED_CHECKPOINT_ACTIVE_SESSION_FAILED','MANAGED_CHECKPOINT_PERSONAL_DATA_FAILED','MANAGED_CHECKPOINT_COUNTS_FAILED','MANAGED_CHECKPOINT_ATTACHMENTS_FAILED','MANAGED_CHECKPOINT_PROTECTED_MANIFEST_FAILED'])assert.match(backup,new RegExp(code),'managed checkpoint validation must retain '+code);
assert.match(backup,/function managedParsedSnapshot\s*\([\s\S]*BackupCodec\s*\.normalizeAssetDescriptors/u,'managed direct snapshots must retain portable attachment-descriptor validation');
assert.match(backup,/function managedParsedSnapshot\s*\([\s\S]*BackupCodec\s*\.createProtectedManifest/u,'managed direct snapshots must retain protected-manifest/deletion validation');
assert.doesNotMatch(backup,/function (?:resolve|merge|reconcile)Repository(?:Conflict|Handoff)/u,'repository restore must not introduce a parallel conflict engine');
assert.match(reconciliation,/function createPlan\s*\(input\s*\)[\s\S]*Object\s*\.keys\s*\(input\s*\)\s*\.sort\s*\(\s*\)\s*\.join\s*\('\|'\s*\)!\s*=\s*='incoming\|local'[\s\S]*input\s*\.local[\s\S]*input\s*\.incoming/u,'reconciliation planner must mechanically accept exactly one local and one incoming source');
assert.doesNotMatch(reconciliation,/resolveSavedDayCandidates|groupEquivalent|orderedGroups/u,'retired N-way reconciliation machinery must stay absent');
assert.doesNotMatch(reconciliation,/sameCanonical/u,'canonical equality must not be reimplemented or re-exported by reconciliation');
assert.match(canonicalCore,/function same\(a\s*,b\s*\)\{return signature\(a\)===signature\(b\);\}/u,'canonical equality must have one shared implementation');
for(const stale of ['handoffCapable','chooseRestoreMode'])assert.equal(backup.includes(stale),false,`stale Handoff terminology must stay absent from current backup orchestration: ${stale}`);
assert.match(backup,/async function restoreManagedVersion\s*\(candidate\s*,options\s*=\s*\{\}\s*\)[\s\S]*finally\s*\{try\s*\{await candidate\s*\.release\s*\(\s*\)/u,'managed Replace must release its selected candidate exactly at its public consumption boundary');
assert.match(backup,/async function restoreStandaloneVersion\s*\(candidate\s*,options\s*=\s*\{\}\s*\)[\s\S]*finally\s*\{try\s*\{await candidate\s*\.release\s*\(\s*\)/u,'standalone Replace must release its selected candidate exactly at its public consumption boundary');
assert.match(backup,/async function restoreBackup\s*\(candidate\s*,options\s*=\s*\{\}\s*\)[\s\S]*finally\s*\{try\s*\{await candidate\s*\.release\s*\(\s*\)/u,'Combine must release its selected candidate exactly at its public consumption boundary');
assert.match(backup,/async function importPortableBackup\s*\(ev\s*\)[\s\S]*if\s*\(candidate&&!consumed\s*\)try\s*\{await candidate\s*\.release\s*\(\s*\)/u,'standalone import selection must release a verified candidate only when it was not handed to Replace or Combine');
assert.doesNotMatch(backup,/CheckpointPipeline\s*\.create\s*\(/u,'an already-owned standalone file job must not re-enter the public checkpoint wrapper');
assert.match(backup,/async function exportPortableBackup\s*\(\s*\)[\s\S]*file\s*=await createCheckpoint\s*\(\s*\{\}\s*,report\s*\)/u,'only explicit File export may invoke the private portable-checkpoint creator inside its already-owned job; external providers remain repository-only');
assert.match(managedRepository,/beginPreparationCapture\s*\(exportedAt\s*\)/u,'managed repository preparation must attempt the bounded incremental metadata preflight before falling back to a full capture');
assert.match(managedRepository,/captureLogicalCheckpoint\s*\(exportedAt\s*,preparation\?\s*\{includeAssetBlobs:false\s*,assumeFlushed:true\s*,requireCanonicalComplete:true\}:\s*\{includeAssetBlobs:false\s*,requireCanonicalComplete:true\}\s*\)/u,'cold/fallback repository preparation must preserve descriptor-only attachment capture while requiring complete canonical managed captures');
assert.match(managedRepository,/await assertLogicalCheckpointCurrent\s*\(capture\s*\);await context\s*\.checkProtection/u,'managed repository preparation must verify source/protection after all local checkpoint data is captured');
assert.match(managedRepository,/prepareRepositoryCheckpointWork already verifies the canonical source[\s\S]*await state\s*\.context\s*\.checkProtection/u,'repository publication must treat a verified local capture as sealed while continuing protection checks during external publication');
assert.match(device,/const createModule=\(\)=>\{[\s\S]*registry\.define\('device-backup',1,createModule\)/u,'the Device Folder controller takes no repository dependency');
assert.doesNotMatch(device,/input\s*\.repository|RepositoryCheckpointPipeline|createMaintenanceScheduler|registerJob|selectRetention|classifyState|publishInline/u,'the Device Folder must not carry its own repository machinery: backing up, history, restore, cleanup and integrity run through the shared engine');
assert.match(device,/engine\s*\.register\s*\(freeze\s*\(\s*\{\s*id:ID\s*,label:LABEL\s*,hosted:true/u,'the Device Folder registers as a hosted location of the shared engine');
assert.doesNotMatch(managedRepository,/normalRows\s*\.length<\s*=REPOSITORY_RETENTION_POLICY\s*\.normalLimit/u,'shared retention must collapse redundant same-bucket checkpoints immediately rather than keeping all history below 15');
assert.match(repositoryBackground,/function repositoryObservationNeedsMaintenance\s*\(observation\s*,selectRetention[\s\S]*selectRetention\s*\(normalized\s*,\s*\{now:new Date\s*\(Number\s*\(now\s*\)\s*\)\}\s*\)\s*\.remove\s*\.length>0/u,'repository observation must use the shared retention selector so same-day losers are discovered even below 15 checkpoints');
assert.match(backupProvider,/if\s*\(!pending&&!resuming&&!ancestryOwed&&!changeNoted&&automaticHooks\?\s*\.ready&&await automaticHooks\s*\.ready\s*\(\s*\)\s*=\s*=\s*=false\s*\)return freeze\s*\(\s*\{status:'idle'\s*,reason:'local-empty'/u,'a change found on start or reconnect is backed up only while local data is present');
assert.match(app,/ready:async\(\)=>\{const empty=await canonicalLocalRecoveryEmpty\(\);return empty===null\?null:!empty;\}/u,'the start-up guard uses the canonical empty-local check');
assert.match(app,/async function canonicalLocalRecoveryEmpty\(\)[\s\S]*AppData\.notes\.readFreshPayload\(\)[\s\S]*AttachmentStorage\.list\(\)[\s\S]*Object\.keys\(notePayload\|\|\{\}\)\.length[\s\S]*assets\|\|\[\]\)\.length/u,'empty-local recovery detection must inspect complete canonical notes and attachment-library state rather than a keyless targeted note read');
assert.match(app,/async function offerDeviceRecoveryIfLocalEmpty[\s\S]*BackupProviderRuntime\.history\('device-folder',\{interactive:false\}\)[\s\S]*confirmLabel:'Recover latest'[\s\S]*BackupProviderRuntime\.restoreRepositoryProviderVersion\('device-folder',\{checkpointId:candidate\.location\.checkpointId,confirmed:true\}\)/u,'empty-local startup/reconnect recovery must remain explicit and use the engine');
assert.match(device,/Existing Study Director backups found\s*\. Open Version History to recover one\s*, or Back up now to keep this device’s current data/u,'connecting an existing valid Device repository must not blindly publish a new version');
assert.match(device,/baseline\s*=versions\?sourceRevision\s*\(\s*\):'';initial\s*=!versions;/u,'a folder that already holds backups starts automatic backups from the next change; an empty one gets a first backup');
assert.match(app,/const connected=state\.connected===true,operationBusy=state\.busy\|\|state\.maintenanceBusy===true/u,'Device Folder UI availability must include repository maintenance so Back up now cannot silently no-op while cleanup is active');
assert.doesNotMatch(device,/Releasing backup protection/u,'internal publication-lease terminology must not leak into Device Folder progress text');
assert.match(backupProvider,/async function backupRepositoryProvider\s*\(id\s*,options\s*=\s*\{\}\s*\)[\s\S]*saveRepositoryProvider\s*\(selected,\{\.\.\.saveOptions,pendingIntent:pending\}\)/u,'each location publishes canonical local state with its own pending intent');
assert.match(backupProvider,/async function managedProviderPresent\s*\(selected\s*,result\s*,[\s\S]*queueResolvedProviderState\s*\(selected\s*,result/u,'provider convergence must be queued only from the managed transaction after local recovery verification');
assert.match(backupProvider,/async function queueResolvedProviderState[\s\S]*markPendingRetry\s*\(selected\s*\)[\s\S]*others:await queueOtherLocations\s*\(selected\s*\)/u,'managed merge convergence must durably queue the source location and report every other automatic location');
assert.doesNotMatch(backupProvider,/convergeRepositoryProvider|propagateResolvedProviderState/u,'retired synchronous provider-convergence API must stay absent');
assert.match(backupProvider,/createSafety:async\s*\(\s*\)\s*=>\s*\{[\s\S]*const safetyPurpose\s*=mode\s*=\s*=\s*='bring-in'\?'before-combine':'before-restore'[\s\S]*saveRepositoryProvider\s*\(selected\s*,\s*\{retention:\s*\{role:'before-restore'\s*,purpose:safetyPurpose\}/u,'every location writes a protected safety version before a restore or combine');
assert.doesNotMatch(backupRecoveryHost,/input\.device\b|requestDeviceConvergence|configureConvergencePropagation/u,'the recovery host reaches every location, the Device Folder included, through the engine');
assert.match(app,/restoredFromFile:\(\)=>\{notifyBackupChange\(\{urgent:true,reason:'file-restore'\}\);return BackupProviderRuntime\.automaticActive\(\);\}/u,'a file restore tells every automatic backup location at once');
assert.match(backup,/events:freeze\s*\(\['libraryChanged'\s*,'backupCompleted'\s*,'reconcileNotes'\s*,'restoreNotesSnapshot'\s*,'restoreSessionState'\s*,'verifyActiveSessionRuntime'\s*,'restoredFromFile'\]\s*\)/u,'backup runtime must expose only current reconciliation, rollback-snapshot and automatic-backup notice ports');
assert.match(backup,/async function flushRestorePreflightState[\s\S]*AppData\s*\.notes\s*\.flush\s*\(\s*\{strict:true\}\s*\)[\s\S]*AppData\s*\.deletionRecovery\s*\.flush\s*\(\s*\)[\s\S]*personalSettle\s*\(\s*\)[\s\S]*AppData\s*\.activeSession\s*\.save/u,'restore reconciliation must flush note, deletion, personal-data and live Active Session state before planning');
assert.match(backup,/captureRestoreReconciliationRevision[\s\S]*AppData\s*\.notes\s*\.readFreshPayload\s*\(\s*\)[\s\S]*readCanonicalActiveSession\s*\(\s*\)[\s\S]*personalExport\s*\(\s*\{flush:false\}\s*\)/u,'restore revision fence must cover the current canonical entities used by reconciliation');
assert.match(backup,/async function readCanonicalActiveSession\s*\(\s*\)\s*\{\s*const loaded\s*=await AppData\s*\.activeSession\s*\.load\s*\(0\s*,\s*\{strict:true\}\s*\);\s*if\s*\(loaded\?\s*\.ok!\s*=\s*=true\|\|loaded\s*\.error\s*\)throw/u,'the reconciliation fence must read the active session strictly and fail closed on an incomplete read');
assert.match(backup,/await assertRestoreReconciliationCurrent\s*\(reconciliationRevision\s*,relevantDates\s*,stable\s*\.scope\s*\);[\s\S]*runRestoreMutation\s*\(stored\s*,'restore-backup'[\s\S]*captureLocalSafetyCopy\s*\(stored\s*,\s*\{afterCapture:\s*\(\s*\)\s*=>assertRestoreReconciliationCurrent\s*\(reconciliationRevision\s*,relevantDates\s*,stable\s*\.scope\s*\)\}\s*\)[\s\S]*AppData\s*\.restoreJournal\s*\.prepare/u,'stale reconciliation must be rechecked before the safety/journaled commit boundary');
assert.match(backup,/fields\(error\)\['code'\]!=='STUDY_DIRECTOR_RECONCILIATION_STALE'[\s\S]*Rebuilding the comparison from the latest saved state/u,'stale reconciliation must rebuild rather than commit an obsolete plan');
assert.match(backup,/importPortableBackup[\s\S]*result&&result\s*\.verified&&!result\s*\.cancelled&&result\s*\.changed[\s\S]*restoredFromFile\s*\(\s*\)/u,'a changed file restore must tell the automatic backup locations');
assert.match(backup,/applyResolvedNotes[\s\S]*reconcileNotes\s*\(AppData\s*\.notes\s*\.normalizePayload\s*\(payload\s*\)\s*,deletions\s*\)/u,'normal note reconciliation must use the per-key merge/delete port');
assert.doesNotMatch(backup,/applyResolvedReflectionDrafts|reconcileReflectionDrafts|restoreReflectionDraftSnapshot|AppData\s*\.reflectionDrafts/u,'retired Reflection Draft state must not remain a current reconciliation or restore domain');
assert.match(backup,/async function replacePortableCanonicalSnapshot[\s\S]*restoreNotesSnapshot\s*\(targetNotes\s*\)[\s\S]*restoreSessionState\s*\(targetSession\s*\)/u,'portable snapshot replacement must restore current notes and Active Session state without reviving the retired Reflection Draft domain');
assert.match(backup,/async function rollbackImportedState[\s\S]*replacePortableCanonicalSnapshot\s*\(snapshot/u,'rollback must reuse the exact portable-state replacement primitive rather than duplicate replacement logic');
for(const retiredPort of ['importNotes','importReflectionDrafts','importActiveSession','configureHandoffPropagation','handoffPropagationHooks'])assert.equal(backup.includes(retiredPort),false,`obsolete Handoff-era backup port must stay retired: ${retiredPort}`);
assert.doesNotMatch(backup,/reconcileNotes\s*\([^\n]+\s*\{\s*merge\s*:/u,'normal note reconciliation must not carry a collection merge/replace mode flag');
assert.doesNotMatch(backup,/reconcileReflectionDrafts|restoreReflectionDraftSnapshot/u,'Reflection Draft reconciliation and snapshot replacement ports must remain retired');
assert.doesNotMatch(backup,/id:'(?:notes|reflectionDrafts)'/u,'current restore choices must not expose whole-collection Note or Reflection Draft authority decisions');
assert.match(app,/async function reconcileNotesThroughLifecycle[\s\S]*AppData\.notes\.reconcile\(importedNotes,deletions\)/u,'host composition must expose an explicit per-key note merge/delete reconciliation path');
assert.match(app,/async function restoreNotesSnapshotThroughLifecycle[\s\S]*AppData\.notes\.replace/u,'host composition must keep whole-note replacement confined to snapshot rollback');
assert.doesNotMatch(app,/reconcileReflectionDraftsThroughLifecycle|ReviewEditor\.mergeBackup/u,'host composition must not expose a retired Reflection Draft reconciliation path');
assert.doesNotMatch(app,/restoreReflectionDraftSnapshotThroughLifecycle|ReviewEditor\.replaceBackup/u,'host composition must not expose a retired Reflection Draft snapshot replacement path');
assert.doesNotMatch(app,/ReviewEditor\.importBackup/u,'generic draft import mode switching must remain retired');
assert.match(notes,/return Object\s*\.freeze\s*\(\s*\{[^}]*replace\s*,reconcile\s*,/u,'Notes repository must expose explicit replace and reconcile operations');
assert.match(repositories,/NotesRepositoryModule\s*\.create/u,'repositories façade must compose the extracted Notes domain through an explicit dependency');
assert.match(backup,/const summary\s*=Reconciliation\s*\.summarizePlan\s*\(reconciliationPlan\s*\)/u,'restore impact/conflict counts must be owned by the reconciliation domain instead of duplicated in backup orchestration');
assert.doesNotMatch(backupProvider,/selected\s*\.(?:save|load)\b|confirmPendingReplacement/u,'retired portable-provider fallback must stay absent from core provider runtime');
assert.match(backupProvider,/const publishCheckpoint\s*=retention\?\s*\.role\s*=\s*=\s*='before-restore'\?RepositoryCheckpointPipeline\s*\.publishInline:RepositoryCheckpointPipeline\s*\.publish;[\s\S]*published\s*=await publishCheckpoint\s*\(history\s*,\s*\{interactive\s*,availableObjectIds\s*,excludedObjectIds:excluded\s*,retention\s*,signal\s*,continuation\s*,shared\s*,baseUpdate:shared\|\|sharingActive\s*\(\s*\)\s*,reuse\}/u,'provider repository backup must use the same transport-neutral publication coordinator as Device Folder');
assert.match(managedRepository,/const REPOSITORY_RETENTION_POLICY\s*=freeze\s*\(\s*\{[\s\S]*normalLimit:15\s*,dailyDays:6\s*,weeklyPeriods:4\s*,monthlyPeriods:4\s*,hourlyLimit:10\s*,hourlyWindowHours:24\s*,protectedLimit:1[\s\S]*calendar:'local-at-capture'/u,'shared repository lifecycle must define the deterministic 15-point tiered retention policy, up to 10 hourly versions from the last 24 hours, and one protected slot');
assert.match(managedRepository,/async function cleanupRepositoryRetention\s*\(input\s*\)[\s\S]*selectRepositoryRetention\s*\(rows\s*,[\s\S]*retainedIds\s*=new Set\s*\(\s*\)[\s\S]*for\s*\(const row of keep\s*\)for\s*\(const entry of row\s*\.manifest\?\s*\.objects\|\|\[\]\s*\)retainedIds\s*\.add\s*\(entry\s*\.objectId\s*\)[\s\S]*input\s*\.deleteCheckpoint\s*\(row\s*\)[\s\S]*input\s*\.deleteObject\s*\(item\s*\)/u,'Device and Drive must share one global-selection, reachability-safe retention and object-GC implementation');
assert.match(managedRepository,/const history\s*=repositoryHistory\s*\(previousManifests\s*\);[\s\S]*repositoryReuseIndex\s*\(\[\.\.\.reuseOnly,\.\.\.history\]\s*,context\s*\.protectionId\s*,available\s*\)/u,'repository preparation must search all retained checkpoints for reusable objects while honoring exclusions');
assert.match(backupProvider,/repositoryObjectInventory\s*\(selected\s*,\s*\{signal\}\s*\)[\s\S]*repositoryAvailableObjectIdsFromInventory\s*\(base\s*\.objectInventory\|\|null\s*,\[\.\.\.base\.history,\.\.\.reuse\]\s*\)/u,'provider repository reuse must remain gated by metadata-confirmed remote object availability across retained history while object inventory is overlapped with latest-checkpoint verification');
assert.match(backupProvider,/writeManifest:async file\s*=>\s*\{[\s\S]*await file\s*\.checkSource\?\s*\.\s*\(\s*\);[\s\S]*verifyUploadedRepositoryManifest\s*\(selected\s*,item\s*,file\s*\.manifest\s*,digest\s*,signal\s*\);await file\s*\.checkSource\?\s*\.\s*\(\s*\)/u,'provider publication transport must recheck the source-revision fence around remote verification');
assert.match(backupProvider,/RepositoryCheckpointPipeline\s*\.inspect\s*\(row\s*\.manifest\s*,readObject\s*,\s*\{interactive:!quiet\s*,signal:operation\s*\.signal\s*,committed:true\s*,sharedHead\s*,managedRecovery\s*,managedProgress:onProgress\s*,\s*\.\s*\.\s*\.\s*\(note&&mode\s*=\s*=\s*='bring-in'\?\s*\{note\}:\s*\{\}\s*\)\}\s*\)/u,'managed provider recovery must enter the shared repository-to-portable inspection adapter with P4 transaction orchestration');
assert.match(backupProvider,/result\s*=await RepositoryCheckpointPipeline\s*\.bringIn\s*\(candidate\s*,\s*\{note\s*,missingOnly\s*,review:/u,'provider Combine must continue to use the existing Bring-in reconciliation engine');
assert.match(backupProvider,/async function restoreRepositoryProviderVersion\s*\(id\s*,options\s*=\s*\{\}\s*\)[\s\S]*RepositoryCheckpointPipeline\s*\.restoreVersion\s*\(candidate\s*,\s*\{confirmed:options&&options\s*\.confirmed\s*=\s*=\s*=true\}\s*\)[\s\S]*presentRecovery\s*\(selected\s*,'restore-version'\s*,result\s*\)/u,'provider-scoped Replace must use exact replacement and honor its already-made mode choice');
assert.match(backupProvider,/function presentRecovery\s*\(selected\s*,kind\s*,result\s*\)\s*\{\s*const convergence\s*=result&&result\s*\.managedRecovery&&result\s*\.managedRecovery\s*\.present/u,'Combine and Replace receive their fresh managed present from the shared P4 transaction');

assert.match(managedRepository,/REPOSITORY_SCRUB_KIND_PRIORITY\s*=freeze\s*\(new Map\s*\(\[\['attachment'\s*,0\]\s*,\['structuredPack'\s*,1\]\s*,\['note'\s*,2\]\s*,\['dailyRecordPack'\s*,3\]\s*,\['personalData'\s*,4\]\]\s*\)\s*\)/u,'repository integrity scrub must prioritize attachments, packed tiny structured state, standalone notes, Saved Days, then standalone personal data');
assert.match(device,/repository:transport\n/u,'the Device Folder hands the engine its transport only: every restore names its version');assert.doesNotMatch(device+drive,/chooseCheckpoint|chooseRepositoryCheckpoint/u,'no location has a version picker of its own');
assert.doesNotMatch(device,/lastSlot|Automatic-Checkpoint-A|Automatic-Checkpoint-B/u,'retired Device A/B settings residue must not remain in production code');
assert.match(backupProvider,/saveRepositoryProvider\s*\(providerSelected\s*,\s*\{excludedObjectIds:\[objectId\]\s*,signal:options&&options\s*\.signal\|\|null\s*,preemptBackground:false\}\s*\)/u,'provider scrub corruption must create a fresh checkpoint that excludes the damaged object from reuse');
assert.match(managedRepository,/await opened\s*\.release\s*\(\s*\)\s*\.catch\s*\(\s*\(\s*\)\s*=>\s*\{\}\s*\)/u,'repository integrity verification must release opened object leases');
assert.match(repositoryBackground,/intervalMs:14\*24\*60\*60\*1000/u,'automatic repository integrity scrub must be due every fourteen days through the shared background policy');
assert.doesNotMatch(app,/function repositoryIntegrityUnsafe\(\)[\s\S]{0,900}hasBlockingActiveSession/u,'repository integrity scrub must not be blocked merely because a study plan or timer session is active');
assert.match(drive,/repository:Object\.freeze\(\{discardUploads:[\s\S]*list:repositoryList,upload:repositoryUpload,download:repositoryDownload,delete:repositoryDelete[\s\S]*renewPublication:renewRepositoryPublication[\s\S]*renewMaintenance:renewRepositoryMaintenance[\s\S]*listSessionClaims:[\s\S]*uploadSessionClaim:repositoryUpload,downloadSessionClaim:repositoryDownload,deleteSessionClaim:repositoryDelete[\s\S]*scope:\(\)=>repositoryScope\(\),beginOperation:beginRepositoryOperation,historyReadConcurrency:8\}\)/u,'Drive exposes file operations, renewable leases, current session claims and scoped verification; repository business logic stays in the engine');
assert.match(backupProvider,/async function synchronizeRepositoryScope\s*\(selected\s*\)[\s\S]*recentHistoryByProvider\s*\.delete\s*\(id\s*\);verifiedHistoryByProvider\s*\.delete\s*\(id\s*\);formatsByProvider\s*\.delete\s*\(id\s*\);unreadableByProvider\s*\.delete\s*\(id\s*\);providerConvergenceRetryAttempts\s*\.delete\s*\(id\s*\);providerBackground\s*\(selected\s*\)\s*\.clearAllScheduled\s*\(\s*\);[\s\S]*maintenanceHooks\s*\.clear\s*\(id\s*,pending\s*\)/u,'a changed physical repository generation must discard provider-session history, verification, convergence and the matching durable maintenance intent from the deleted repository');
assert.match(backupProvider,/async function loadRepositoryProvider\s*\(selected\s*,operation\s*,[\s\S]*?await synchronizeRepositoryScope\s*\(selected\s*\);[\s\S]*?recentHistory\s*\(providerSelected\s*,checkpointId\s*\)/u,'restore must validate repository generation before consulting recent Version History cache');
assert.match(backupProvider,/async function beginRepositoryPublication\s*\(selected\s*\)[\s\S]*const lease\s*=await selected\s*\.repository\s*\.beginPublication\s*\(\s*\);[\s\S]*return lease;[\s\S]*async function validateRepositoryPublicationStart\s*\(selected\s*,lease\s*,\s*\{foregroundPriority\s*=false\s*,signal\s*=null\s*,progress\s*=null\}\s*=\s*\{\}\s*\)[\s\S]*repositoryMaintenanceSafety\s*\(selected\s*\)/u,'provider publication must establish its provider-visible marker before independently validating maintenance protection');
assert.match(backupProvider,/async function beginRepositoryMaintenance\s*\(selected\s*,\s*\{onBlocked\s*=null\}\s*=\s*\{\}\s*\)[\s\S]*selected\s*\.repository\s*\.beginMaintenance\s*\(\s*\)[\s\S]*repositoryPublicationSafety\s*\(selected\s*\)[\s\S]*repositoryMaintenanceSafety\s*\(selected\s*,\s*\{excludeId:lease\s*\.id\}\s*\)/u,'provider destructive maintenance must establish its marker and then exclude active publication and competing maintenance');
assert.match(backupProvider,/if\s*\(publicationProtected\s*\)\s*\{publicationLease\s*=await beginRepositoryPublication\s*\(selected\s*\);[\s\S]*publicationSafetyTask\s*=validateRepositoryPublicationStartMeasured\s*\(selected\s*,publicationLease\s*,\s*\{foregroundPriority\s*,signal\s*,progress\}\s*\);\}[\s\S]*discoveryTask\s*=repositorySnapshot\?Promise\s*\.resolve\s*\(null\s*\):repositoryProviderPublicationBase\s*\(selected\s*,\s*\{signal\}\s*\);[\s\S]*Promise\s*\.all\s*\(\[excludedTask\s*,discoveryTask\s*,publicationSafetyTask\|\|Promise\s*\.resolve\s*\(true\s*\)\]\s*\)/u,'provider publication must acquire its marker first, then overlap read-only repository discovery with maintenance-safety validation before publication preparation continues');
assert.doesNotMatch(backupProvider,/deferPublicationRelease/u,'Drive publication-marker release must not be detached from the foreground operation');
assert.match(backupProvider,/finally\s*\{[\s\S]{0,180}if\s*\(publicationLease\s*\)\s*\{[\s\S]*provider-publication-release-start[\s\S]*await endRepositoryPublication[\s\S]*provider-publication-release-complete[\s\S]*publication-contention[\s\S]*request\s*\('repository-state'\s*,MAINTENANCE_POLICY\s*\.busyMs\s*,\s*\{mode:'replace'\}\s*\)/u,'Drive must await publication-marker release, then pull any contention-blocked maintenance forward once after successful release');
assert.match(backupProvider,/const verificationTask\s*=\s*\(async\s*\(\s*\)\s*=>\s*\{[\s\S]*verifyRepositoryInventoryPair[\s\S]*\}\s*\)\s*\(\s*\);[\s\S]*const inventoryTask\s*=\s*\(async\s*\(\s*\)\s*=>\s*\{[\s\S]*repositoryObjectInventory[\s\S]*\}\s*\)\s*\(\s*\);[\s\S]*Promise\s*\.all\s*\(\[verificationTask\s*,inventoryTask\s*,quarantineTask\]\s*\)/u,'restore must overlap selected-checkpoint verification with independent repository-object inventory discovery');
assert.match(app,/strictTransaction\(\[DB_ASSET_STORE,DB_APP_META_STORE\],'readwrite',[\s\S]*AppData\.deletionRecovery\.stageAttachments\(tx,deletionState\)[\s\S]*store\.put\(row,id\)[\s\S]*store\.delete\(id\)/u,'attachment metadata and explicit attachment-deletion state must share one strict assets + appMeta transaction');
assert.match(attachments,/store\.publish\(pending,token,ensure,\{deletionState:\{clear:pending\.map\(\(\[assetId\]\)=>assetId\)\}\}\)/u,'standalone attachment archive import must atomically clear stale deletion markers while publishing restored identities');
assert.match(attachments,/store\.removeMetadata\(\[id\],guard,\{deletionState:\{record:wasLibrary\?\[id\]:\[\]\}\}\)/u,'explicit Attachment Library deletion must stage its deletion marker in the same metadata commit');
assert.match(attachments,/store\.restoreMetadata\(values,\{deletionState:\{clear:values\.map\(row=>\(row\s*\)\?\.id\)\.filter\(Boolean\)\}\}\)/u,'attachment metadata rollback must clear matching deletion markers in the same metadata commit');
assert.match(backupProvider,/async function cleanupRepositoryProviderState\s*\([\s\S]*assertLease\s*=checkMaintenance\|\|\s*\(async\s*\(\s*\)\s*=>\s*\{if\s*\(maintenanceLease\s*\)await assertRepositoryMaintenance\s*\(selected\s*,maintenanceLease\s*\);\}\s*\)[\s\S]*deleteCheckpoint:async row\s*=>\s*\{await assertLease\s*\(\s*\)[\s\S]*deleteObject:async item\s*=>\s*\{await assertLease\s*\(\s*\)/u,'destructive provider cleanup must reassert its shared renewable guard or maintenance lease before checkpoint and object deletion');
const engineCleanup=backupProvider.slice(backupProvider.indexOf('async function cleanupRepositoryProviderSafely('),backupProvider.indexOf('async function saveRepositoryProvider('));
const cleanupStages=[
  'repositoryProviderState(planning,{interactive:false,signal,forCleanup:true})',
  'repositoryObjectInventory(planning,{signal})',
  'beginRepositoryMaintenance(planning,',
  'repositoryOperationSelected(owner,{signal,checkProtection:keepAlive})',
  'repositoryProviderInventory(protectedSelection,{signal,freshDigests:true})',
  'repositoryCleanupInventoryMatches(state,currentInventory)',
  'cleanupRepositoryProviderState(protectedSelection,state,{workBudget,preparedObjectListing,checkMaintenance:()=>keepAlive(true),inventoryBeforeDelete:true',
  'endRepositoryMaintenance(planning,maintenanceLease)'
];
let previousStage=-1;
for(const stage of cleanupStages){const at=engineCleanup.indexOf(stage);assert.ok(at>previousStage,`Repository cleanup must plan without exclusion, acquire its lease only for destructive revalidation/deletion, then release it: ${stage}`);previousStage=at;}
assert.ok(engineCleanup.indexOf('repositoryObjectInventory(planning,{signal})')<engineCleanup.indexOf('beginRepositoryMaintenance(planning,'),'read-only object inventory must not hold the maintenance exclusion.');

for(const forbidden of ['prepareRepositoryCheckpoint','commitRepositoryCheckpoint','materializeRepositoryCheckpoint','resolveRepositoryConflict'])assert.equal(drive.includes(forbidden),false,`Drive transport must not duplicate repository engine logic: ${forbidden}`);
assert.doesNotMatch(drive,/studyDirectorBackup|studyDirectorOperation|\.sdbackup|async function (?:save|load)\(/u,'Drive must not retain the retired whole-Blob backup transport');
assert.doesNotMatch(app,/backupOperationJournal|backupProviderOperation/u,'host must not expose dead monolithic-provider journal infrastructure');

assert.match(hostMetadata,/value\.format!=='study-director\.device-folder-settings'\|\|Number\(value\.version\)!==4/u,'isolated host metadata boundary must validate DeviceFolderSettings.v4');


// Current checkpoint purity: the contract no longer writes or owns the retired distributed-sync schema version.


assert.doesNotMatch(codec,/schemaVersion:DATA_CONTRACT\s*\.schemas\s*\.Backup/u,'current manifest writer must not emit retired schemaVersion baggage');
assert.doesNotMatch(backup,/schemaVersion:Number\s*\(manifest\s*\.schemaVersion/u,'current restore preview must not expose a retired sync-era schema API');

{ // Production session/recovery boundaries retained across TS erasure.
const sessionClaimRelease=backupProvider.slice(backupProvider.indexOf('async function releaseSessionClaim('),backupProvider.indexOf('async function readSessionClaim('));
const sessionTransfer=readScript('source/core/session-handoff.ts');
const sessionActions=readScript('source/core/session-actions.ts');
const combineBody=backupProvider.slice(backupProvider.indexOf('async function bringInRepositoryProvider('),backupProvider.indexOf('async function restoreRepositoryProviderVersion('));
assert.match(app,/ready:async\s*\(\s*\)\s*=>\s*\{const empty\s*=await canonicalLocalRecoveryEmpty\s*\(\s*\);return empty\s*=\s*=\s*=null\?null:!empty;\s*\}/u,'failed canonical emptiness reads remain unknown, not safe to skip');
assert.match(app,/async function canonicalLocalRecoveryEmpty\s*\(\s*\)[\s\S]*AppData\s*\.pendingReviews\s*\.list\s*\(\s*\)[\s\S]*!reviews\s*\.some\s*\(review\s*=>!review\s*\.resolvedAt\s*\)/u,'a locally retained unresolved Kept Version rules out empty-device restore');
assert.match(backupProvider,/async function queueOtherLocations\s*\(selected\s*\)[\s\S]*automaticRecoveryDestination\s*\(other\s*\)[\s\S]*markPendingRetry\s*\(other\s*\),scheduled\s*=retryQueued&&schedulePendingProviderBackup\s*\(other,1000,\s*\{trigger:'managed-recovery-peer'\s*\}\s*\)[\s\S]*async function queueResolvedProviderState[\s\S]*markPendingRetry\s*\(selected\s*\),scheduled\s*=retryQueued&&schedulePendingProviderBackup\s*\(selected,1000,\s*\{trigger:'managed-recovery'\s*\}\s*\)[\s\S]*others:await queueOtherLocations\s*\(selected\s*\)/u,'managed recovery must durably record source and configured-peer obligations before scheduling their normal convergence jobs');
assert.match(backupProvider,/if\s*\(automaticNeeded\s*\(selected\s*\)\s*\)\s*\{[\s\S]{0,500}markPendingRetry\s*\(selected\s*\),scheduled\s*=retryQueued&&schedulePendingProviderBackup\s*\(selected,1000,\s*\{trigger:'managed-recovery-source-current'\s*\}\s*\)/u,'an already-present source checkpoint must durably retain convergence when recovery produced a newer local canonical revision');
assert.doesNotMatch(combineBody,/options\?\s*\.sync|sync:true/u,'user Combine must not hide ordinary synchronization as an option');
assert.doesNotMatch(backupProvider,/shared\s*=\[\s*\.\s*\.\s*\.providers\s*\.values\s*\(\s*\)\]\s*\.find\s*\(sharedSyncing\s*\)/u,'Device Folder recovery must not probe Drive to impersonate shared ancestry');
assert.doesNotMatch(backupProvider,/claim\s*=freeze\s*\(\s*\{format:SESSION_CLAIM_FORMAT,version:SESSION_CLAIM_VERSION,date[,}]/u,'new Active Session claims must not persist the session date.');
assert.doesNotMatch(backupProvider,/claim\s*=freeze\s*\(\s*\{format:SESSION_CLAIM_FORMAT,version:SESSION_CLAIM_VERSION,[^\n]*\bowner[,}]/u,'new Active Session claims must not persist an installation id.');
assert.match(backupProvider,/state:'released'/u,'session end must use a higher-epoch released ownership state rather than deleting the current claim');
assert.match(backupProvider,/claim\s*\.state\s*=\s*=\s*='released'&&current\s*\.claim\s*\.revision>\s*=observedRevision/u,'a released ownership epoch blocks only the session revision it closed or an older one; a strictly newer same-day canonical session may establish a fresh handoff epoch.');
assert.doesNotMatch(backupProvider,/publishSharedStateNow/u,'live ownership transfer must not put a full checkpoint publication on the timer critical path');
assert.doesNotMatch(sessionClaimRelease,/deleteSessionClaim/u,'failed takeover rollback must never delete the newest immutable claim and expose an older owner');
assert.ok(sessionTransfer.indexOf("await provider.claimOwnership(")>=0&&sessionTransfer.indexOf("await provider.claimOwnership(")<sessionTransfer.indexOf("saveCanonicalSession(next,'claiming Active Session ownership'"),'Drive ownership must become durable before the new local owner is saved or allowed to run');
assert.match(app,/'apply-schedule': SessionActions\.applyScheduleAction/u,'Apply routes through the checked session action owner');
assert.match(sessionActions,/async function applyScheduleAction\([\s\S]*?transferSessionOwnershipHere\(session\)[\s\S]*?ports\.applySchedule\(takeover/u,'Start a new plan here transfers durable ownership before applying');
}
