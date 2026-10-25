import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const app=read('source/app.html');
const backup=read('source/core/backup.js');
const backupCapture=read('source/core/backup-capture.js');
const managedRepository=read('source/core/managed-repository.js');
const repositoryBackground=read('source/core/repository-background.js');
const backupProvider=read('source/core/backup-provider.js');
const reconciliation=read('source/core/reconciliation.js');
const canonicalCore=read('source/core/canonical.js');
const codec=read('source/core/backup-codec.js');
const device=read('source/core/device-backup.js');
const drive=read('source/external/drive.js');
const attachments=read('source/core/attachments.js');
const repositories=read('source/core/repositories.js');
const notes=read('source/core/repositories-notes.js');
const startup=read('source/core/startup.js');
const persistence=read('source/core/persistence.js');
const hostMetadata=read('source/core/host-metadata.js');
const backupRecoveryHost=read('source/core/backup-recovery-host.js');
const canonical=read('contracts/canonical-identities.mjs');
const compatibility=read('contracts/compatibility.mjs');
const dataArchitecture=read('contracts/data-architecture.mjs');
const build=read('build/build.mjs');
const currentSource=[app,backup,managedRepository,backupProvider,device,repositories,startup,persistence].join('\n');

for(const retired of ['AppData.sync','createVerified','syncEntityKey','normalizeSyncTimestamp','syncable','maxImportTombstones']){
  assert.equal(currentSource.includes(retired),false,`retired current-runtime symbol must stay absent: ${retired}`);
}

const entityStart=app.indexOf('const ENTITY_DEFINITIONS=Object.freeze({');
const entityEnd=app.indexOf('const BACKUP_ENTITY_TYPES=',entityStart);
assert.ok(entityStart>=0&&entityEnd>entityStart,'current entity definition block must remain discoverable');
const currentEntities=app.slice(entityStart,entityEnd);
assert.equal(currentEntities.includes('tombstone'),false,'generalized tombstones must not be a current entity definition');
assert.equal(currentEntities.includes('syncable'),false,'current domain entities must not carry distributed-sync capability flags');

assert.match(repositories,/const DATA_MAINTENANCE_VERSION=6;/u,'strict maintenance completion must use the lean v6 shape');
assert.match(repositories,/const report=\{version:DATA_MAINTENANCE_VERSION,status:'completed',completedAt:new Date\(\)\.toISOString\(\)\};/u,'maintenance must persist operational scheduling metadata only');
for(const retiredCounter of ['summariesRebuilt','fallbackRecordsMigrated','invalidRecoveryCacheCleared','pendingDeletionRecovery']){
  assert.equal(repositories.includes(`report.${retiredCounter}`),false,`maintenance report counter must stay retired: ${retiredCounter}`);
}

for(const retiredStartup of ['syncQueue','syncEmergency','tombstone','pendingSync']){
  assert.equal(startup.includes(retiredStartup),false,`startup must not contain retired sync flushing: ${retiredStartup}`);
}
assert.match(startup,/flush-deletion-recovery/u,'startup must retain local deletion-recovery flushing');

assert.match(backup,/const LogicalCheckpointCapture=freeze\(\{capture:captureLogicalCheckpoint\}\);/u,'checkpoint capture must be a distinct immutable logical-state boundary');
assert.match(backup,/const PortableCheckpointMaterializer=freeze\(\{materialize:materializePortableCheckpoint\}\);/u,'portable .sdbackup materialisation must remain separate from logical checkpoint capture');
assert.match(backup,/async function createCanonicalCheckpoint\(options=\{\},report=null\)\{[\s\S]*LogicalCheckpointCapture\.capture\(new Date\(\)\.toISOString\(\),options\)[\s\S]*PortableCheckpointMaterializer\.materialize\(capture,\{preferCompression:true,verify:true,report\}\);/u,'current checkpoint creation must capture once and then materialise the existing portable format');
assert.match(codec,/plan&&plan\.checkpoint\?validateCheckpointMetadata\(plan\.checkpoint\):backupCheckpointMetadata/u,'portable manifest creation must reuse captured checkpoint provenance when supplied');
assert.match(backupCapture,/protectedCheckpointManifest=Number\(backupVersion\)>=15\?BackupCodec\.createProtectedManifest\(captureBase,checkpointMetadata\):null/u,'logical capture must bind protected deletion/authority state to the same checkpoint identity before materialisation');
assert.match(backup,/BackupCaptureModule\.create/u,'backup façade must compose logical capture and incremental preparation through the extracted capture module');
assert.match(backup,/const CheckpointPipeline=freeze\(\{\s*create:BackupController\.createCheckpoint,inspect:BackupController\.inspect,restore:BackupController\.restore,markCompleted:BackupController\.markCompleted\s*\}\);/su,'portable checkpoint pipeline must remain the explicit .sdbackup transport port');
assert.match(backup,/const \{controller:BackupController,repository:RepositoryCheckpointPipeline\}=\(\(\)=>\{[\s\S]*const repository=freeze\(\{[\s\S]*publish:\(\.\.\.args\)=>track\(\(\)=>ManagedRepository\.publish\(\.\.\.args\),true\),[\s\S]*publishInline:ManagedRepository\.publish,[\s\S]*inspectManifest:ManagedRepository\.inspectManifest,[\s\S]*bringIn:controller\.restore,[\s\S]*restoreVersion:\(\.\.\.args\)=>track\(\(\)=>restoreManagedVersion\(\.\.\.args\),true\),[\s\S]*retention:ManagedRepository\.retention,[\s\S]*projectHistory:ManagedRepository\.projectHistory,[\s\S]*markCompleted:controller\.markCompleted[\s\S]*return freeze\(\{controller,repository\}\);/u,'backup runtime must return sibling frozen controller and repository capabilities so repository ownership semantics remain private without proxying pure repository methods through the controller');
assert.doesNotMatch(app,/inspectManifest:\(\.\.\.args\)=>RepositoryCheckpointPipeline\.inspectManifest/u,'app.html must not recreate mechanical repository pass-through wrappers');
const expectedRepositoryPort=['activeProtected','bringIn','classifyState','cleanup','createPublication','establishBase','inspect','inspectCommit','inspectManifest','markCompleted','noteObject','projectHistory','publish','publishInline','readNote','restoreVersion','retention','scrub','selectRetention','sharedBase','spine','validatePolicy','verifyCheckpoint','verifyObject'].sort();
const repositoryCapabilityBody=backup.match(/const repository=freeze\(\{([\s\S]*?)\n\}\);\nreturn freeze\(\{controller,repository\}\);/u)?.[1]||'';
const repositoryCapabilityKeys=[...repositoryCapabilityBody.matchAll(/^\s{2}([A-Za-z_$][\w$]*):/gmu)].map(match=>match[1]).sort();
const providerRepositoryKeys=[...(backupProvider.match(/const REPOSITORY_FIELDS=freeze\(\[([^\]]+)\]\)/u)?.[1]||'').matchAll(/['"]([^'"]+)['"]/gu)].map(match=>match[1]).sort();
assert.deepEqual(repositoryCapabilityKeys,expectedRepositoryPort,'the shared repository pipeline must expose exactly the canonical Device/Drive repository capability surface');
assert.deepEqual(providerRepositoryKeys,expectedRepositoryPort,'managed providers must require exactly the canonical shared repository capability surface');
assert.match(managedRepository,/registry\.define\('managed-repository',1/u,'managed-repository must be a first-class private module');
assert.match(backupProvider,/registry\.define\('backup-provider',1/u,'backup-provider must be a first-class private module');
for(const repositoryOwned of [/REPOSITORY_MANIFEST_FORMAT/u,/function selectRepositoryRetention\(/u,/async function cleanupRepositoryRetention\(/u,/async function scrubRepositoryIntegrity\(/u])assert.doesNotMatch(backup,repositoryOwned,'repository engine implementation must stay out of backup.js');
for(const providerOwned of ['repositoryProviderState','saveRepositoryProvider','bringInRepositoryProvider','restoreRepositoryProviderVersion'])assert.equal(backup.includes(providerOwned),false,`managed-provider concern must stay out of backup.js: ${providerOwned}`);
assert.match(backup,/ManagedRepositoryModule\.createEngine/u,'backup.js must compose the repository engine through an explicit dependency');
assert.match(backup,/BackupProviderModule\.createRuntime/u,'backup.js must compose the provider runtime through an explicit dependency');
for(const retired of ['isInspected','prepareRepositoryCheckpoint:','materializeRepositoryCheckpoint:','commitRepositoryCheckpoint:','establishRepositoryReconciliationBase:','releaseRepositoryCheckpoint:','mergeManagedRepositoryHistory','logicalRepositoryFingerprint'])assert.equal(backup.includes(retired),false,`dead public repository API must stay absent: ${retired}`);
assert.doesNotMatch(managedRepository,/PortableCheckpointMaterializer|materializeRepositoryCheckpoint|inspectBackup\(portable\.blob/u,'managed repository restore must not recreate and reopen a temporary portable container');
assert.match(managedRepository,/reconstructVerifiedRepositoryCheckpoint[\s\S]*inspectVerifiedCapture\(reconstructed\.capture/u,'managed repository restore must feed verified reconstructed state into the private snapshot producer');
assert.match(backup,/const inspectedBackups=new WeakMap\(\),verifiedPortableSnapshots=new WeakMap\(\);/u,'verified portable snapshots must be sealed by private module-owned identity rather than a forgeable flag');
assert.match(backup,/function sealVerifiedPortableSnapshot\([\s\S]*verifiedPortableSnapshots\.set\(snapshot,state\)/u,'verified portable snapshot proof must be private and identity-bound');
assert.match(backup,/function managedParsedSnapshot\([\s\S]*BackupCodec\.normalizeRecord\(record\)/u,'managed repository Saved Days must normalize by entity schema version so repository v5 remains readable across DailyRecord upgrades');
assert.doesNotMatch(backup,/function managedParsedSnapshot\([\s\S]{0,1200}currentDailyRecords\(/u,'managed repository validation must not require historical Saved Days to already match the current DailyRecord schema');
assert.match(backup,/function managedSnapshotStage\([\s\S]*managed-checkpoint-\$\{label\}-failed[\s\S]*errorCode/u,'managed checkpoint portable validation failures must expose safe stage-coded diagnostics');
for(const code of ['MANAGED_CHECKPOINT_DAILY_RECORDS_FAILED','MANAGED_CHECKPOINT_NOTES_FAILED','MANAGED_CHECKPOINT_ACTIVE_SESSION_FAILED','MANAGED_CHECKPOINT_PERSONAL_DATA_FAILED','MANAGED_CHECKPOINT_COUNTS_FAILED','MANAGED_CHECKPOINT_ATTACHMENTS_FAILED','MANAGED_CHECKPOINT_PROTECTED_MANIFEST_FAILED'])assert.match(backup,new RegExp(code),'managed checkpoint validation must retain '+code);
assert.match(backup,/function managedParsedSnapshot\([\s\S]*BackupCodec\.normalizeAssetDescriptors/u,'managed direct snapshots must retain portable attachment-descriptor validation');
assert.match(backup,/function managedParsedSnapshot\([\s\S]*BackupCodec\.createProtectedManifest/u,'managed direct snapshots must retain protected-manifest/deletion validation');
assert.doesNotMatch(backup,/function (?:resolve|merge|reconcile)Repository(?:Conflict|Handoff)/u,'repository restore must not introduce a parallel conflict engine');
assert.match(reconciliation,/function createPlan\(input\)[\s\S]*Object\.keys\(input\)\.sort\(\)\.join\('\|'\)!=='incoming\|local'[\s\S]*input\.local[\s\S]*input\.incoming/u,'reconciliation planner must mechanically accept exactly one local and one incoming source');
assert.doesNotMatch(reconciliation,/resolveSavedDayCandidates|groupEquivalent|orderedGroups/u,'retired N-way reconciliation machinery must stay absent');
assert.doesNotMatch(reconciliation,/sameCanonical/u,'canonical equality must not be reimplemented or re-exported by reconciliation');
assert.match(canonicalCore,/function same\(a,b\)\{return signature\(a\)===signature\(b\);\}/u,'canonical equality must have one shared implementation');
for(const stale of ['handoffCapable','chooseRestoreMode'])assert.equal(backup.includes(stale),false,`stale Handoff terminology must stay absent from current backup orchestration: ${stale}`);
assert.match(backup,/async function restoreManagedVersion\(candidate,options=\{\}\)[\s\S]*finally\{try\{await candidate\.release\(\)/u,'managed Replace must release its selected candidate exactly at its public consumption boundary');
assert.match(backup,/async function restoreStandaloneVersion\(candidate,options=\{\}\)[\s\S]*finally\{try\{await candidate\.release\(\)/u,'standalone Replace must release its selected candidate exactly at its public consumption boundary');
assert.match(backup,/async function restoreBackup\(candidate,options=\{\}\)[\s\S]*finally\{try\{await candidate\.release\(\)/u,'Combine must release its selected candidate exactly at its public consumption boundary');
assert.match(backup,/async function importPortableBackup\(ev\)[\s\S]*if\(candidate&&!consumed\)try\{await candidate\.release\(\)/u,'standalone import selection must release a verified candidate only when it was not handed to Replace or Combine');
assert.doesNotMatch(backup,/CheckpointPipeline\.create\(/u,'an already-owned standalone file job must not re-enter the public checkpoint wrapper');
assert.match(backup,/async function exportPortableBackup\(\)[\s\S]*file=await createCheckpoint\(\{\},report\)/u,'only explicit File export may invoke the private portable-checkpoint creator inside its already-owned job; external providers remain repository-only');
assert.match(managedRepository,/beginPreparationCapture\(exportedAt\)/u,'managed repository preparation must attempt the bounded incremental metadata preflight before falling back to a full capture');
assert.match(managedRepository,/captureLogicalCheckpoint\(exportedAt,preparation\?\{includeAssetBlobs:false,assumeFlushed:true,requireCanonicalComplete:true\}:\{includeAssetBlobs:false,requireCanonicalComplete:true\}\)/u,'cold/fallback repository preparation must preserve descriptor-only attachment capture while requiring complete canonical managed captures');
assert.match(managedRepository,/await assertLogicalCheckpointCurrent\(capture\);await context\.checkProtection/u,'managed repository preparation must verify source/protection after all local checkpoint data is captured');
assert.match(managedRepository,/prepareRepositoryCheckpointWork already verifies the canonical source[\s\S]*await state\.context\.checkProtection/u,'repository publication must treat a verified local capture as sealed while continuing protection checks during external publication');
assert.match(device,/registry\.define\('device-backup',1,\(\)=>/u,'the Device Folder controller takes no repository dependency');
assert.doesNotMatch(device,/input\.repository|RepositoryCheckpointPipeline|createMaintenanceScheduler|registerJob|selectRetention|classifyState|publishInline/u,'the Device Folder must not carry its own repository machinery: backing up, history, restore, cleanup and integrity run through the shared engine');
assert.match(device,/engine\.register\(freeze\(\{\s*id:ID,label:LABEL,hosted:true/u,'the Device Folder registers as a hosted location of the shared engine');
assert.doesNotMatch(managedRepository,/normalRows\.length<=REPOSITORY_RETENTION_POLICY\.normalLimit/u,'shared retention must collapse redundant same-bucket checkpoints immediately rather than keeping all history below 15');
assert.match(repositoryBackground,/function repositoryObservationNeedsMaintenance\(observation,selectRetention[\s\S]*selectRetention\(normalized,\{now:new Date\(Number\(now\)\)\}\)\.remove\.length>0/u,'repository observation must use the shared retention selector so same-day losers are discovered even below 15 checkpoints');
assert.match(backupProvider,/if\(!pending&&!resuming&&!changeNoted&&automaticHooks\?\.ready&&await automaticHooks\.ready\(\)===false\)return freeze\(\{status:'idle',reason:'local-empty'/u,'a change found on start or reconnect is backed up only while local data is present');
assert.match(app,/ready:async\(\)=>await canonicalLocalRecoveryEmpty\(\)===false/u,'the start-up guard uses the canonical empty-local check');
assert.match(app,/async function canonicalLocalRecoveryEmpty\(\)[\s\S]*AppData\.notes\.readFreshPayload\(\)[\s\S]*AttachmentStorage\.list\(\)[\s\S]*Object\.keys\(notePayload\|\|\{\}\)\.length[\s\S]*assets\|\|\[\]\)\.length/u,'empty-local recovery detection must inspect complete canonical notes and attachment-library state rather than a keyless targeted note read');
assert.match(app,/async function offerDeviceRecoveryIfLocalEmpty[\s\S]*BackupProviderRuntime\.history\('device-folder',\{interactive:false\}\)[\s\S]*confirmLabel:'Recover latest'[\s\S]*BackupProviderRuntime\.restoreRepositoryProviderVersion\('device-folder',\{checkpointId:candidate\.location\.checkpointId,confirmed:true\}\)/u,'empty-local startup/reconnect recovery must remain explicit and use the engine');
assert.match(device,/Existing Study Director backups found\. Open Version History to recover one, or Back up now to keep this device’s current data/u,'connecting an existing valid Device repository must not blindly publish a new version');
assert.match(device,/baseline=versions\?sourceRevision\(\):'';initial=!versions;/u,'a folder that already holds backups starts automatic backups from the next change; an empty one gets a first backup');
assert.match(app,/const connected=state\.connected===true,operationBusy=state\.busy\|\|state\.maintenanceBusy===true/u,'Device Folder UI availability must include repository maintenance so Back up now cannot silently no-op while cleanup is active');
assert.doesNotMatch(device,/Releasing backup protection/u,'internal publication-lease terminology must not leak into Device Folder progress text');
assert.match(backupProvider,/async function backupRepositoryProvider\(id,options=\{\}\)[\s\S]*save=value=>saveRepositoryProvider\(selected,\{\.\.\.saveOptions,pendingIntent:pending,copy:value\}\)/u,'external providers must use the managed repository checkpoint path directly');
assert.match(backupProvider,/async function managedProviderPresent\(selected,result,[\s\S]*queueResolvedProviderState\(selected,result/u,'provider convergence must be queued only from the managed transaction after local recovery verification');
assert.match(backupProvider,/async function queueResolvedProviderState[\s\S]*markPendingRetry\(selected\)[\s\S]*others:otherLocations\(selected\)/u,'managed merge convergence must durably queue the source location and report every other automatic location');
assert.doesNotMatch(backupProvider,/convergeRepositoryProvider|propagateResolvedProviderState/u,'retired synchronous provider-convergence API must stay absent');
assert.match(backupProvider,/createSafety:sync\?null:async\(\)=>\{[\s\S]*const safetyPurpose=mode==='bring-in'\?'before-combine':'before-restore'[\s\S]*saveRepositoryProvider\(selected,\{retention:\{role:'before-restore',purpose:safetyPurpose\}/u,'every location writes a protected safety version before a restore or combine');
assert.doesNotMatch(backupRecoveryHost,/input\.device\b|requestDeviceConvergence|configureConvergencePropagation/u,'the recovery host reaches every location, the Device Folder included, through the engine');
assert.match(app,/restoredFromFile:\(\)=>\{notifyBackupChange\(\{urgent:true,reason:'file-restore'\}\);return BackupProviderRuntime\.automaticActive\(\);\}/u,'a file restore tells every automatic backup location at once');
assert.match(backup,/events:freeze\(\['libraryChanged','backupCompleted','reconcileNotes','restoreNotesSnapshot','restoreSessionState','verifyActiveSessionRuntime','restoredFromFile'\]\)/u,'backup runtime must expose only current reconciliation, rollback-snapshot and automatic-backup notice ports');
assert.match(backup,/async function flushRestorePreflightState[\s\S]*AppData\.notes\.flush\(\{strict:true\}\)[\s\S]*AppData\.deletionRecovery\.flush\(\)[\s\S]*personalSettle\(\)[\s\S]*AppData\.activeSession\.save/u,'restore reconciliation must flush note, deletion, personal-data and live Active Session state before planning');
assert.match(backup,/captureRestoreReconciliationRevision[\s\S]*AppData\.notes\.readFreshPayload\(\)[\s\S]*readCanonicalActiveSession\(\)[\s\S]*personalExport\(\{flush:false\}\)/u,'restore revision fence must cover the current canonical entities used by reconciliation');
assert.match(backup,/await assertRestoreReconciliationCurrent\(reconciliationRevision,relevantDates,stable\.scope\);[\s\S]*runRestoreMutation\(stored,'restore-backup'[\s\S]*captureLocalSafetyCopy\(stored,\{afterCapture:\(\)=>assertRestoreReconciliationCurrent\(reconciliationRevision,relevantDates,stable\.scope\)\}\)[\s\S]*AppData\.restoreJournal\.prepare/u,'stale reconciliation must be rechecked before the safety/journaled commit boundary');
assert.match(backup,/error\?\.code!=='STUDY_DIRECTOR_RECONCILIATION_STALE'[\s\S]*Rebuilding the comparison from the latest saved state/u,'stale reconciliation must rebuild rather than commit an obsolete plan');
assert.match(backup,/importPortableBackup[\s\S]*result&&result\.verified&&!result\.cancelled&&result\.changed[\s\S]*restoredFromFile\(\)/u,'a changed file restore must tell the automatic backup locations');
assert.match(backup,/applyResolvedNotes[\s\S]*reconcileNotes\(AppData\.notes\.normalizePayload\(payload\),deletions\)/u,'normal note reconciliation must use the per-key merge/delete port');
assert.doesNotMatch(backup,/applyResolvedReflectionDrafts|reconcileReflectionDrafts|restoreReflectionDraftSnapshot|AppData\.reflectionDrafts/u,'retired Reflection Draft state must not remain a current reconciliation or restore domain');
assert.match(backup,/async function replacePortableCanonicalSnapshot[\s\S]*restoreNotesSnapshot\(targetNotes\)[\s\S]*restoreSessionState\(targetSession,String\(scheduleText\|\|''\)\)/u,'portable snapshot replacement must restore current notes and Active Session state without reviving the retired Reflection Draft domain');
assert.match(backup,/async function rollbackImportedState[\s\S]*replacePortableCanonicalSnapshot\(snapshot/u,'rollback must reuse the exact portable-state replacement primitive rather than duplicate replacement logic');
for(const retiredPort of ['importNotes','importReflectionDrafts','importActiveSession','configureHandoffPropagation','handoffPropagationHooks'])assert.equal(backup.includes(retiredPort),false,`obsolete Handoff-era backup port must stay retired: ${retiredPort}`);
assert.doesNotMatch(backup,/reconcileNotes\([^\n]+\{\s*merge\s*:/u,'normal note reconciliation must not carry a collection merge/replace mode flag');
assert.doesNotMatch(backup,/reconcileReflectionDrafts|restoreReflectionDraftSnapshot/u,'Reflection Draft reconciliation and snapshot replacement ports must remain retired');
assert.doesNotMatch(backup,/id:'(?:notes|reflectionDrafts)'/u,'current restore choices must not expose whole-collection Note or Reflection Draft authority decisions');
assert.match(app,/async function reconcileNotesThroughLifecycle[\s\S]*AppData\.notes\.reconcile\(importedNotes,deletions\)/u,'host composition must expose an explicit per-key note merge/delete reconciliation path');
assert.match(app,/async function restoreNotesSnapshotThroughLifecycle[\s\S]*AppData\.notes\.replace/u,'host composition must keep whole-note replacement confined to snapshot rollback');
assert.doesNotMatch(app,/reconcileReflectionDraftsThroughLifecycle|ReviewEditor\.mergeBackup/u,'host composition must not expose a retired Reflection Draft reconciliation path');
assert.doesNotMatch(app,/restoreReflectionDraftSnapshotThroughLifecycle|ReviewEditor\.replaceBackup/u,'host composition must not expose a retired Reflection Draft snapshot replacement path');
assert.doesNotMatch(app,/ReviewEditor\.importBackup/u,'generic draft import mode switching must remain retired');
assert.match(notes,/return Object\.freeze\(\{[^}]*replace,reconcile,/u,'Notes repository must expose explicit replace and reconcile operations');
assert.match(repositories,/NotesRepositoryModule\.create/u,'repositories façade must compose the extracted Notes domain through an explicit dependency');
assert.match(backup,/const summary=Reconciliation\.summarizePlan\(reconciliationPlan\)/u,'restore impact/conflict counts must be owned by the reconciliation domain instead of duplicated in backup orchestration');
assert.doesNotMatch(backupProvider,/selected\.(?:save|load)\b|confirmPendingReplacement/u,'retired portable-provider fallback must stay absent from core provider runtime');
assert.match(backupProvider,/const publishCheckpoint=retention\?\.role==='before-restore'\?RepositoryCheckpointPipeline\.publishInline:RepositoryCheckpointPipeline\.publish;[\s\S]*published=await publishCheckpoint\(history,\{interactive,availableObjectIds,excludedObjectIds:excluded,retention,signal,continuation,shared,baseUpdate:shared\|\|sharingActive\(\),copy:copied\}/u,'provider repository backup must use the same transport-neutral publication coordinator as Device Folder');
assert.match(managedRepository,/const REPOSITORY_RETENTION_POLICY=freeze\(\{[\s\S]*normalLimit:15,dailyDays:6,weeklyPeriods:4,monthlyPeriods:4,hourlyLimit:10,hourlyWindowHours:24,protectedLimit:1[\s\S]*calendar:'local-at-capture'/u,'shared repository lifecycle must define the deterministic 15-point tiered retention policy, up to 10 hourly versions from the last 24 hours, and one protected slot');
assert.match(managedRepository,/async function cleanupRepositoryRetention\(input\)[\s\S]*selectRepositoryRetention\(rows,[\s\S]*retainedIds=new Set\(\)[\s\S]*for\(const row of keep\)for\(const entry of row\.manifest\?\.objects\|\|\[\]\)retainedIds\.add\(entry\.objectId\)[\s\S]*input\.deleteCheckpoint\(row\)[\s\S]*input\.deleteObject\(item\)/u,'Device and Drive must share one global-selection, reachability-safe retention and object-GC implementation');
assert.match(managedRepository,/const history=repositoryHistory\(previousManifests\);[\s\S]*repositoryReuseIndex\(history,context\.protectionId,available\)/u,'repository preparation must search all retained checkpoints for reusable objects while honoring exclusions');
assert.match(backupProvider,/repositoryObjectInventory\(selected,\{signal\}\)[\s\S]*repositoryAvailableObjectIdsFromInventory\(base\.objectInventory,base\.history\)/u,'provider repository reuse must remain gated by metadata-confirmed remote object availability across retained history while object inventory is overlapped with latest-checkpoint verification');
assert.match(backupProvider,/writeManifest:async file=>\{[\s\S]*await file\.checkSource\?\.\(\);[\s\S]*verifyUploadedRepositoryManifest\(selected,item,file\.manifest,digest,signal\);await file\.checkSource\?\.\(\)/u,'provider publication transport must recheck the source-revision fence around remote verification');
assert.match(backupProvider,/RepositoryCheckpointPipeline\.inspect\(row\.manifest,readObject,\{interactive:!quiet,signal:operation\.signal,committed:true,sharedHead,managedRecovery,managedProgress:onProgress,\.\.\.\(note&&mode==='bring-in'\?\{note\}:\{\}\)\}\)/u,'managed provider recovery must enter the shared repository-to-portable inspection adapter with P4 transaction orchestration');
assert.match(backupProvider,/result=await RepositoryCheckpointPipeline\.bringIn\(candidate,\{note,missingOnly,sync,review:/u,'provider Combine must continue to use the existing Bring-in reconciliation engine');
assert.match(backupProvider,/async function restoreRepositoryProviderVersion\(id,options=\{\}\)[\s\S]*RepositoryCheckpointPipeline\.restoreVersion\(candidate,\{confirmed:options&&options\.confirmed===true\}\)[\s\S]*presentRecovery\(selected,'restore-version',result\)/u,'provider-scoped Replace must use exact replacement and honor its already-made mode choice');
assert.match(backupProvider,/function presentRecovery\(selected,kind,result\)\{\s*const convergence=result&&result\.managedRecovery&&result\.managedRecovery\.present/u,'Combine and Replace receive their fresh managed present from the shared P4 transaction');
assert.match(managedRepository,/const LEGACY_REFLECTION_DRAFT_PACK_KIND='reflectionDraftPack';[\s\S]*const REPOSITORY_SCRUB_SKIPPED_KINDS=freeze\(new Set\(\['activeSession',LEGACY_REFLECTION_DRAFT_PACK_KIND\]\)\)/u,'repository integrity scrub may still recognize legacy Reflection Draft packs for compatibility, but only through an explicitly legacy constant');
assert.match(managedRepository,/REPOSITORY_SCRUB_KIND_PRIORITY=freeze\(new Map\(\[\['attachment',0\],\['structuredPack',1\],\['note',2\],\['dailyRecordPack',3\],\['personalData',4\]\]\)\)/u,'repository integrity scrub must prioritize attachments, packed tiny structured state, standalone notes, Saved Days, then standalone personal data');
assert.match(device,/repository:transport\n/u,'the Device Folder hands the engine its transport only: every restore names its version');assert.doesNotMatch(device+drive,/chooseCheckpoint|chooseRepositoryCheckpoint/u,'no location has a version picker of its own');
assert.doesNotMatch(device,/lastSlot|Automatic-Checkpoint-A|Automatic-Checkpoint-B/u,'retired Device A/B settings residue must not remain in production code');
assert.match(backupProvider,/saveRepositoryProvider\(providerSelected,\{excludedObjectIds:\[objectId\],signal:options&&options\.signal\|\|null,preemptBackground:false\}\)/u,'provider scrub corruption must create a fresh checkpoint that excludes the damaged object from reuse');
assert.match(managedRepository,/await opened\.release\(\)\.catch\(\(\)=>\{\}\)/u,'repository integrity verification must release opened object leases');
assert.match(repositoryBackground,/intervalMs:14\*24\*60\*60\*1000/u,'automatic repository integrity scrub must be due every fourteen days through the shared background policy');
assert.doesNotMatch(app,/function repositoryIntegrityUnsafe\(\)[\s\S]{0,900}hasBlockingActiveSession/u,'repository integrity scrub must not be blocked merely because a study plan or timer session is active');
assert.match(drive,/repository:Object\.freeze\(\{discardUploads:\(\)=>repositoryUploads\.clear\(\),list:repositoryList,upload:repositoryUpload,download:repositoryDownload,delete:repositoryDelete,beginPublication:beginRepositoryPublication,listPublications:listRepositoryPublications,assertPublication:assertRepositoryPublication,endPublication:endRepositoryPublication,beginMaintenance:beginRepositoryMaintenance,listMaintenances:listRepositoryMaintenances,assertMaintenance:assertRepositoryMaintenance,renewMaintenance:renewRepositoryMaintenance,endMaintenance:endRepositoryMaintenance,scope:\(\)=>repositoryScope\(\),beginOperation:beginRepositoryOperation,historyReadConcurrency:8\}\)/u,'Drive provider must expose only repository transport primitives, protection leases, repository-generation scope, the operation-scoped verification boundary and bounded immutable-history concurrency instead of repository business logic');
assert.match(backupProvider,/async function synchronizeRepositoryScope\(selected\)[\s\S]*recentHistoryByProvider\.delete\(id\);verifiedHistoryByProvider\.delete\(id\);formatsByProvider\.delete\(id\);unreadableByProvider\.delete\(id\);providerConvergenceRetryAttempts\.delete\(id\);providerBackground\(selected\)\.clearAllScheduled\(\);[\s\S]*maintenanceHooks\.clear\(id,pending\)/u,'a changed physical repository generation must discard provider-session history, verification, convergence and the matching durable maintenance intent from the deleted repository');
assert.match(backupProvider,/async function loadRepositoryProvider\(selected,operation,[\s\S]*?await synchronizeRepositoryScope\(selected\);[\s\S]*?recentHistory\(providerSelected,checkpointId\)/u,'restore must validate repository generation before consulting recent Version History cache');
assert.match(backupProvider,/async function beginRepositoryPublication\(selected\)[\s\S]*const lease=await selected\.repository\.beginPublication\(\);[\s\S]*return lease;[\s\S]*async function validateRepositoryPublicationStart\(selected,lease,\{foregroundPriority=false,signal=null,progress=null\}=\{\}\)[\s\S]*repositoryMaintenanceSafety\(selected\)/u,'provider publication must establish its provider-visible marker before independently validating maintenance protection');
assert.match(backupProvider,/async function beginRepositoryMaintenance\(selected,\{onBlocked=null\}=\{\}\)[\s\S]*selected\.repository\.beginMaintenance\(\)[\s\S]*repositoryPublicationSafety\(selected\)[\s\S]*repositoryMaintenanceSafety\(selected,\{excludeId:lease\.id\}\)/u,'provider destructive maintenance must establish its marker and then exclude active publication and competing maintenance');
assert.match(backupProvider,/if\(publicationProtected\)\{publicationLease=await beginRepositoryPublication\(selected\);[\s\S]*publicationSafetyTask=validateRepositoryPublicationStartMeasured\(selected,publicationLease,\{foregroundPriority,signal,progress\}\);\}[\s\S]*discoveryTask=repositorySnapshot\?Promise\.resolve\(null\):repositoryProviderPublicationBase\(selected,\{signal\}\);[\s\S]*Promise\.all\(\[excludedTask,discoveryTask,publicationSafetyTask\|\|Promise\.resolve\(true\)\]\)/u,'provider publication must acquire its marker first, then overlap read-only repository discovery with maintenance-safety validation before publication preparation continues');
assert.doesNotMatch(backupProvider,/deferPublicationRelease/u,'Drive publication-marker release must not be detached from the foreground operation');
assert.match(backupProvider,/finally\{[\s\S]{0,180}if\(publicationLease\)\{[\s\S]*provider-publication-release-start[\s\S]*await endRepositoryPublication[\s\S]*provider-publication-release-complete[\s\S]*publication-contention[\s\S]*request\('repository-state',MAINTENANCE_POLICY\.busyMs,\{mode:'replace'\}\)/u,'Drive must await publication-marker release, then pull any contention-blocked maintenance forward once after successful release');
assert.match(backupProvider,/const verificationTask=\(async\(\)=>\{[\s\S]*verifyRepositoryInventoryPair[\s\S]*\}\)\(\);[\s\S]*const inventoryTask=\(async\(\)=>\{[\s\S]*repositoryObjectInventory[\s\S]*\}\)\(\);[\s\S]*Promise\.all\(\[verificationTask,inventoryTask,quarantineTask\]\)/u,'restore must overlap selected-checkpoint verification with independent repository-object inventory discovery');
assert.match(app,/strictTransaction\(\[DB_ASSET_STORE,DB_APP_META_STORE\],'readwrite',[\s\S]*AppData\.deletionRecovery\.stageAttachments\(tx,deletionState\)[\s\S]*store\.put\(row,id\)[\s\S]*store\.delete\(id\)/u,'attachment metadata and explicit attachment-deletion state must share one strict assets + appMeta transaction');
assert.match(attachments,/store\.publish\(pending,token,ensure,\{deletionState:\{clear:pending\.map\(\(\[assetId\]\)=>assetId\)\}\}\)/u,'standalone attachment archive import must atomically clear stale deletion markers while publishing restored identities');
assert.match(attachments,/store\.removeMetadata\(\[id\],guard,\{deletionState:\{record:wasLibrary\?\[id\]:\[\]\}\}\)/u,'explicit Attachment Library deletion must stage its deletion marker in the same metadata commit');
assert.match(attachments,/store\.restoreMetadata\(values,\{deletionState:\{clear:values\.map\(row=>row\?\.id\)\.filter\(Boolean\)\}\}\)/u,'attachment metadata rollback must clear matching deletion markers in the same metadata commit');
assert.match(backupProvider,/async function cleanupRepositoryProviderState\([\s\S]*assertLease=checkMaintenance\|\|\(async\(\)=>\{if\(maintenanceLease\)await assertRepositoryMaintenance\(selected,maintenanceLease\);\}\)[\s\S]*deleteCheckpoint:async row=>\{await assertLease\(\)[\s\S]*deleteObject:async item=>\{await assertLease\(\)/u,'destructive provider cleanup must reassert its shared renewable guard or maintenance lease before checkpoint and object deletion');
const engineCleanup=backupProvider.slice(backupProvider.indexOf('async function cleanupRepositoryProviderSafely('),backupProvider.indexOf('async function saveRepositoryProvider('));
const cleanupStages=['beginRepositoryMaintenance(scoped,','repositoryOperationSelected(owner,{signal,checkProtection:keepAlive})','repositoryProviderState(protectedSelection,{interactive:false,signal,forCleanup:true})','cleanupRepositoryProviderState(protectedSelection,state,{workBudget,checkMaintenance:()=>keepAlive(true),inventoryBeforeDelete:true','endRepositoryMaintenance(scoped,maintenanceLease)'];
let previousStage=-1;
for(const stage of cleanupStages){const at=engineCleanup.indexOf(stage);assert.ok(at>previousStage,`Repository cleanup must retain renewable exclusion through inspection and cleanup, then release it: ${stage}`);previousStage=at;}

for(const forbidden of ['prepareRepositoryCheckpoint','commitRepositoryCheckpoint','materializeRepositoryCheckpoint','resolveRepositoryConflict'])assert.equal(drive.includes(forbidden),false,`Drive transport must not duplicate repository engine logic: ${forbidden}`);
assert.match(drive,/MULTIPART_UPLOAD_MAX_BYTES=5\*1024\*1024/u,'Drive must keep an explicit small-object multipart threshold');
assert.match(drive,/file\.blob\.size<=MULTIPART_UPLOAD_MAX_BYTES[\s\S]*uploadRepositoryMultipart[\s\S]*beginRepositoryUpload[\s\S]*uploadContent/u,'Drive must use multipart upload for small repository files and resumable upload for larger files');
assert.match(drive,/REPOSITORY_MARKER=Object\.freeze\(\{key:REPOSITORY_IDENTITIES\.driveRepositoryMarker,value:'true'\}\)/u,'Drive repository files must use the centralized explicit repository marker identity');
assert.doesNotMatch(drive,/studyDirectorBackup|studyDirectorOperation|\.sdbackup|async function (?:save|load)\(/u,'Drive must not retain the retired whole-Blob backup transport');
assert.doesNotMatch(app,/backupOperationJournal|backupProviderOperation/u,'host must not expose dead monolithic-provider journal infrastructure');

assert.match(hostMetadata,/value\.format!=='study-director\.device-folder-settings'\|\|Number\(value\.version\)!==4/u,'isolated host metadata boundary must validate DeviceFolderSettings.v4');
assert.match(dataArchitecture,/deviceFolder:surface\('backup-configuration','device-backup','operational','while connected','DeviceFolderSettings\.v4'\)/u,'data-architecture contract must classify DeviceFolderSettings.v4');
assert.match(dataArchitecture,/deviceBackup:surface\('external-backup',[\s\S]*Bring-in reconciliation and exact historical Version Restore/u,'Device Folder architecture must classify distinct managed Bring-in and Version Restore semantics');
assert.match(dataArchitecture,/driveBackup:surface\('external-backup',[\s\S]*separate Bring-in and exact historical Version Restore orchestration/u,'Drive architecture must classify distinct managed Bring-in and Version Restore semantics');

assert.match(codec,/const LEGACY_TOMBSTONE_TYPE='tombstone',LEGACY_REFLECTION_DRAFT_TYPE='reflectionDraft'/u,'historical backup adapter must retain explicit tombstone and retired Reflection Draft vocabulary only inside compatibility parsing');
assert.match(codec,/Historical completion proofs depend on the original entity order/u,'historical completion-proof ordering must be documented and isolated');
assert.equal(currentEntities.includes('LEGACY_TOMBSTONE_TYPE'),false,'historical backup vocabulary must not leak into current domain entities');

// Current checkpoint purity: the contract no longer writes or owns the retired distributed-sync schema version.
assert.equal(canonical.includes('LEGACY_SYNC_SCHEMA_VERSION'),false,'legacy sync schema naming must be absent from the current identity contract');
assert.match(compatibility,/export const LEGACY_BACKUP_SCHEMA_VERSION=1;/u,'historical backup schema ceiling must live in compatibility, not the current data contract');
assert.match(app,/const LEGACY_BACKUP_SCHEMA_VERSION=@@SD_LEGACY_BACKUP_SCHEMA_VERSION@@;/u,'host must receive the historical backup ceiling through explicit compatibility injection');
assert.match(build,/@@SD_LEGACY_BACKUP_SCHEMA_VERSION@@/u,'build must own compatibility-value injection');
assert.doesNotMatch(codec,/schemaVersion:DATA_CONTRACT\.schemas\.Backup/u,'current v19 manifest writer must not emit retired schemaVersion baggage');
assert.doesNotMatch(backup,/schemaVersion:Number\(manifest\.schemaVersion/u,'current restore preview must not expose a retired sync-era schema API');


console.log(JSON.stringify({
  status:'PASS',suite:'cleer-integration',
  currentSyncRuntimeRemoved:true,
  maintenanceMetadata:'v6-lean',
  startupSyncFlushRemoved:true,
  checkpointTransports:['file'],
  repositoryTransports:['device-folder-tiered-15-plus-1','google-drive-tiered-15-plus-1','restore-adapter'],
  historicalBackupCompatibilityIsolated:true,
  currentCheckpointSyncSchemaBaggage:false
},null,2));
