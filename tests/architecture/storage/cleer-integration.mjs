import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const app=read('source/app.html');
const backup=read('source/core/backup.js');
const managedRepository=read('source/core/managed-repository.js');
const backupProvider=read('source/core/backup-provider.js');
const reconciliation=read('source/core/reconciliation.js');
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

for(const retiredCounter of ['summariesRebuilt','fallbackRecordsMigrated','invalidRecoveryCacheCleared','pendingDeletionRecovery']){
  assert.equal(repositories.includes(`report.${retiredCounter}`),false,`maintenance report counter must stay retired: ${retiredCounter}`);
}

for(const retiredStartup of ['syncQueue','syncEmergency','tombstone','pendingSync']){
  assert.equal(startup.includes(retiredStartup),false,`startup must not contain retired sync flushing: ${retiredStartup}`);
}

assert.doesNotMatch(app,/inspectManifest:\(\.\.\.args\)=>RepositoryCheckpointPipeline\.inspectManifest/u,'app.html must not recreate mechanical repository pass-through wrappers');
const expectedRepositoryPort=['activeProtected','bringIn','classifyState','cleanup','createPublication','establishBase','inspect','inspectCommit','inspectManifest','markCompleted','noteObject','projectHistory','publish','publishInline','readNote','restoreVersion','retention','scrub','selectRetention','sharedBase','validatePolicy','verifyCheckpoint','verifyObject'].sort();
const repositoryCapabilityBody=backup.match(/const repository=freeze\(\{([\s\S]*?)\n\}\);\nreturn freeze\(\{controller,repository\}\);/u)?.[1]||'';
const repositoryCapabilityKeys=[...repositoryCapabilityBody.matchAll(/^\s{2}([A-Za-z_$][\w$]*):/gmu)].map(match=>match[1]).sort();
const providerRepositoryKeys=[...(backupProvider.match(/const REPOSITORY_FIELDS=freeze\(\[([^\]]+)\]\)/u)?.[1]||'').matchAll(/['"]([^'"]+)['"]/gu)].map(match=>match[1]).sort();
assert.deepEqual(repositoryCapabilityKeys,expectedRepositoryPort,'the shared repository pipeline must expose exactly the canonical Device/Drive repository capability surface');
assert.deepEqual(providerRepositoryKeys,expectedRepositoryPort,'managed providers must require exactly the canonical shared repository capability surface');
assert.match(managedRepository,/registry\.define\('managed-repository',1/u,'managed-repository must be a first-class private module');
assert.match(backupProvider,/registry\.define\('backup-provider',1/u,'backup-provider must be a first-class private module');
for(const repositoryOwned of [/REPOSITORY_MANIFEST_FORMAT/u,/function selectRepositoryRetention\(/u,/async function cleanupRepositoryRetention\(/u,/async function scrubRepositoryIntegrity\(/u])assert.doesNotMatch(backup,repositoryOwned,'repository engine implementation must stay out of backup.js');
for(const providerOwned of ['repositoryProviderState','saveRepositoryProvider','syncRepositoryProvider','bringInRepositoryProvider','restoreRepositoryProviderVersion'])assert.equal(backup.includes(providerOwned),false,`managed-provider concern must stay out of backup.js: ${providerOwned}`);
for(const retired of ['isInspected','prepareRepositoryCheckpoint:','materializeRepositoryCheckpoint:','commitRepositoryCheckpoint:','establishRepositoryReconciliationBase:','releaseRepositoryCheckpoint:','mergeManagedRepositoryHistory','logicalRepositoryFingerprint'])assert.equal(backup.includes(retired),false,`dead public repository API must stay absent: ${retired}`);
assert.doesNotMatch(managedRepository,/PortableCheckpointMaterializer|materializeRepositoryCheckpoint|inspectBackup\(portable\.blob/u,'managed repository restore must not recreate and reopen a temporary portable container');
assert.doesNotMatch(backup,/function managedParsedSnapshot\([\s\S]{0,1200}currentDailyRecords\(/u,'managed repository validation must not require historical Saved Days to already match the current DailyRecord schema');
assert.match(backup,/function managedSnapshotStage\([\s\S]*managed-checkpoint-\$\{label\}-failed[\s\S]*errorCode/u,'managed checkpoint portable validation failures must expose safe stage-coded diagnostics');
for(const code of ['MANAGED_CHECKPOINT_DAILY_RECORDS_FAILED','MANAGED_CHECKPOINT_NOTES_FAILED','MANAGED_CHECKPOINT_ACTIVE_SESSION_FAILED','MANAGED_CHECKPOINT_PERSONAL_DATA_FAILED','MANAGED_CHECKPOINT_COUNTS_FAILED','MANAGED_CHECKPOINT_ATTACHMENTS_FAILED','MANAGED_CHECKPOINT_PROTECTED_MANIFEST_FAILED'])assert.match(backup,new RegExp(code),'managed checkpoint validation must retain '+code);
assert.doesNotMatch(backup,/function (?:resolve|merge|reconcile)Repository(?:Conflict|Handoff)/u,'repository restore must not introduce a parallel conflict engine');
assert.doesNotMatch(reconciliation,/sameCanonical/u,'canonical equality must not be reimplemented or re-exported by reconciliation');
for(const stale of ['handoffCapable','chooseRestoreMode'])assert.equal(backup.includes(stale),false,`stale Handoff terminology must stay absent from current backup orchestration: ${stale}`);
assert.match(backup,/async function restoreManagedVersion\(candidate,options=\{\}\)[\s\S]*finally\{try\{await candidate\.release\(\)/u,'managed Replace must release its selected candidate exactly at its public consumption boundary');
assert.match(backup,/async function restoreStandaloneVersion\(candidate,options=\{\}\)[\s\S]*finally\{try\{await candidate\.release\(\)/u,'standalone Replace must release its selected candidate exactly at its public consumption boundary');
assert.match(backup,/async function importPortableBackup\(ev\)[\s\S]*if\(candidate&&!consumed\)try\{await candidate\.release\(\)/u,'standalone import selection must release a verified candidate only when it was not handed to Replace or Combine');
assert.doesNotMatch(backup,/CheckpointPipeline\.create\(/u,'an already-owned standalone file job must not re-enter the public checkpoint wrapper');
assert.match(managedRepository,/await assertLogicalCheckpointCurrent\(capture\);await context\.checkProtection/u,'managed repository preparation must verify source/protection after all local checkpoint data is captured');
assert.match(managedRepository,/prepareRepositoryCheckpointWork already verifies the canonical source[\s\S]*await state\.context\.checkProtection/u,'repository publication must treat a verified local capture as sealed while continuing protection checks during external publication');
assert.match(device,/registry\.define\('device-backup',1,\(\)=>/u,'the Device Folder controller takes no repository dependency');
assert.doesNotMatch(device,/input\.repository|RepositoryCheckpointPipeline|createMaintenanceScheduler|registerJob|selectRetention|classifyState|publishInline/u,'the Device Folder must not carry its own repository machinery: backing up, history, restore, cleanup and integrity run through the shared engine');
assert.match(device,/engine\.register\(freeze\(\{\s*id:ID,label:LABEL,hosted:true/u,'the Device Folder registers as a hosted location of the shared engine');
assert.doesNotMatch(managedRepository,/normalRows\.length<=REPOSITORY_RETENTION_POLICY\.normalLimit/u,'shared retention must collapse redundant same-bucket checkpoints immediately rather than keeping all history below 15');
assert.match(app,/ready:async\(\)=>await canonicalLocalRecoveryEmpty\(\)===false/u,'the start-up guard uses the canonical empty-local check');
assert.match(app,/async function canonicalLocalRecoveryEmpty\(\)[\s\S]*AppData\.notes\.readFreshPayload\(\)[\s\S]*AttachmentStorage\.list\(\)[\s\S]*Object\.keys\(notePayload\|\|\{\}\)\.length[\s\S]*assets\|\|\[\]\)\.length/u,'empty-local recovery detection must inspect complete canonical notes and attachment-library state rather than a keyless targeted note read');
assert.match(app,/async function offerDeviceRecoveryIfLocalEmpty[\s\S]*BackupProviderRuntime\.history\('device-folder',\{interactive:false\}\)[\s\S]*confirmLabel:'Recover latest'[\s\S]*BackupProviderRuntime\.restoreRepositoryProviderVersion\('device-folder',\{checkpointId:candidate\.location\.checkpointId,confirmed:true\}\)/u,'empty-local startup/reconnect recovery must remain explicit and use the engine');
assert.match(app,/const connected=state\.connected===true,operationBusy=state\.busy\|\|state\.maintenanceBusy===true/u,'Device Folder UI availability must include repository maintenance so Back up now cannot silently no-op while cleanup is active');
assert.doesNotMatch(device,/Releasing backup protection/u,'internal publication-lease terminology must not leak into Device Folder progress text');
assert.match(backupProvider,/async function queueOtherLocations\(selected\)[\s\S]*automaticRecoveryDestination\(other\)[\s\S]*markPendingRetry\(other\),scheduled=retryQueued&&schedulePendingProviderBackup\(other,1000,\{trigger:'managed-recovery-peer'\}\)[\s\S]*async function queueResolvedProviderState[\s\S]*markPendingRetry\(selected\),scheduled=retryQueued&&schedulePendingProviderBackup\(selected,1000,\{trigger:'managed-recovery'\}\)[\s\S]*others:await queueOtherLocations\(selected\)/u,'managed recovery must durably record source and configured-peer obligations before scheduling their normal convergence jobs');
assert.match(backupProvider,/if\(automaticNeeded\(selected\)\)\{[\s\S]{0,500}markPendingRetry\(selected\),scheduled=retryQueued&&schedulePendingProviderBackup\(selected,1000,\{trigger:'managed-recovery-source-current'\}\)/u,'an already-present source checkpoint must durably retain convergence when recovery produced a newer local canonical revision');
assert.match(backupProvider,/createSafety:sync\?null:async\(\)=>\{[\s\S]*const safetyPurpose=mode==='bring-in'\?'before-combine':'before-restore'[\s\S]*saveRepositoryProvider\(selected,\{retention:\{role:'before-restore',purpose:safetyPurpose\}/u,'every location writes a protected safety version before a restore or combine');
assert.doesNotMatch(backupRecoveryHost,/input\.device\b|requestDeviceConvergence|configureConvergencePropagation/u,'the recovery host reaches every location, the Device Folder included, through the engine');
assert.match(app,/restoredFromFile:\(\)=>\{notifyBackupChange\(\{urgent:true,reason:'file-restore'\}\);return BackupProviderRuntime\.automaticActive\(\);\}/u,'a file restore tells every automatic backup location at once');
assert.match(backup,/await assertRestoreReconciliationCurrent\(reconciliationRevision,relevantDates,stable\.scope\);[\s\S]*runRestoreMutation\(stored,'restore-backup'[\s\S]*captureLocalSafetyCopy\(stored,\{afterCapture:\(\)=>assertRestoreReconciliationCurrent\(reconciliationRevision,relevantDates,stable\.scope\)\}\)[\s\S]*AppData\.restoreJournal\.prepare/u,'stale reconciliation must be rechecked before the safety/journaled commit boundary');
for(const retiredPort of ['importNotes','importReflectionDrafts','importActiveSession','configureHandoffPropagation','handoffPropagationHooks'])assert.equal(backup.includes(retiredPort),false,`obsolete Handoff-era backup port must stay retired: ${retiredPort}`);
assert.doesNotMatch(backup,/reconcileNotes\([^\n]+\{\s*merge\s*:/u,'normal note reconciliation must not carry a collection merge/replace mode flag');
assert.doesNotMatch(backup,/id:'(?:notes|reflectionDrafts)'/u,'current restore choices must not expose whole-collection Note or Reflection Draft authority decisions');
assert.match(app,/async function reconcileNotesThroughLifecycle[\s\S]*AppData\.notes\.reconcile\(importedNotes,deletions\)/u,'host composition must expose an explicit per-key note merge/delete reconciliation path');
assert.match(app,/async function restoreNotesSnapshotThroughLifecycle[\s\S]*AppData\.notes\.replace/u,'host composition must keep whole-note replacement confined to snapshot rollback');
assert.match(repositories,/NotesRepositoryModule\.create/u,'repositories façade must compose the extracted Notes domain through an explicit dependency');
assert.match(managedRepository,/const REPOSITORY_RETENTION_POLICY=freeze\(\{[\s\S]*normalLimit:15,dailyDays:6,weeklyPeriods:4,monthlyPeriods:4,hourlyLimit:10,hourlyWindowHours:24,protectedLimit:1[\s\S]*calendar:'local-at-capture'/u,'shared repository lifecycle must define the deterministic 15-point tiered retention policy, up to 10 hourly versions from the last 24 hours, and one protected slot');
assert.match(backupProvider,/writeManifest:async file=>\{[\s\S]*await file\.checkSource\?\.\(\);[\s\S]*verifyUploadedRepositoryManifest\(selected,item,file\.manifest,digest,signal\);await file\.checkSource\?\.\(\)/u,'provider publication transport must recheck the source-revision fence around remote verification');
const combineBody=backupProvider.slice(backupProvider.indexOf('async function bringInRepositoryProvider('),backupProvider.indexOf('async function restoreRepositoryProviderVersion('));
assert.doesNotMatch(combineBody,/options\?\.sync|sync:true/u,'user Combine must not hide ordinary synchronization as an option');
assert.doesNotMatch(backupProvider,/shared=\[\.\.\.providers\.values\(\)\]\.find\(sharedSyncing\)/u,'Device Folder recovery must not probe Drive to impersonate shared ancestry');
assert.match(backupProvider,/result=await RepositoryCheckpointPipeline\.bringIn\(candidate,\{note,missingOnly,review:/u,'provider Combine must continue to use the existing Bring-in reconciliation engine without the sync mode');
assert.doesNotMatch(device+drive,/chooseCheckpoint|chooseRepositoryCheckpoint/u,'no location has a version picker of its own');
assert.doesNotMatch(device,/lastSlot|Automatic-Checkpoint-A|Automatic-Checkpoint-B/u,'retired Device A/B settings residue must not remain in production code');
assert.doesNotMatch(app,/function repositoryIntegrityUnsafe\(\)[\s\S]{0,900}hasBlockingActiveSession/u,'repository integrity scrub must not be blocked merely because a study plan or timer session is active');
// Active Session is coordinated by a tiny monotonic ownership record, while
// full session content remains in ordinary immutable checkpoints.
assert.doesNotMatch(backupProvider,/claim=freeze\(\{format:SESSION_CLAIM_FORMAT,version:SESSION_CLAIM_VERSION,date[,}]/u,'new Active Session claims must not persist the session date.');
assert.doesNotMatch(backupProvider,/claim=freeze\(\{format:SESSION_CLAIM_FORMAT,version:SESSION_CLAIM_VERSION,[^\n]*\bowner[,}]/u,'new Active Session claims must not persist an installation id.');
assert.match(backupProvider,/state:'released'/u,'session end must use a higher-epoch released ownership state rather than deleting the current claim');
assert.match(backupProvider,/claim\.state==='released'&&current\.claim\.revision>=observedRevision/u,'a released ownership epoch blocks only the session revision it closed or an older one; a strictly newer same-day canonical session may establish a fresh handoff epoch.');
assert.doesNotMatch(backupProvider,/publishSharedStateNow/u,'live ownership transfer must not put a full checkpoint publication on the timer critical path');
const sessionClaimRelease=backupProvider.slice(backupProvider.indexOf('async function releaseSessionClaim('),backupProvider.indexOf('async function readSessionClaim('));
assert.doesNotMatch(sessionClaimRelease,/deleteSessionClaim/u,'failed takeover rollback must never delete the newest immutable claim and expose an older owner');
const sessionTransfer=app.slice(app.indexOf('async function transferSessionOwnershipHere('),app.indexOf('// Another device continued today\'s session'));
assert.ok(sessionTransfer.indexOf("claimSessionOwnership('google-drive'")>=0&&sessionTransfer.indexOf("claimSessionOwnership('google-drive'")<sessionTransfer.indexOf('AppData.activeSession.save(next,{strictDurability:true})'),'Drive ownership must become durable before the new local owner is saved or allowed to run');
assert.match(app,/'apply-schedule': async\(\)=>\{[\s\S]{0,700}transferSessionOwnershipHere\(sessionPanelSession\)/u,'Start a new plan here must use the same durable ownership transfer as Continue Here');

assert.match(backupProvider,/async function synchronizeRepositoryScope\(selected\)[\s\S]*recentHistoryByProvider\.delete\(id\);verifiedHistoryByProvider\.delete\(id\);formatsByProvider\.delete\(id\);unreadableByProvider\.delete\(id\);providerConvergenceRetryAttempts\.delete\(id\);providerBackground\(selected\)\.clearAllScheduled\(\);[\s\S]*maintenanceHooks\.clear\(id,pending\)/u,'a changed physical repository generation must discard provider-session history, verification, convergence and the matching durable maintenance intent from the deleted repository');
assert.match(backupProvider,/async function loadRepositoryProvider\(selected,operation,[\s\S]*?await synchronizeRepositoryScope\(selected\);[\s\S]*?recentHistory\(providerSelected,checkpointId\)/u,'restore must validate repository generation before consulting recent Version History cache');
assert.doesNotMatch(backupProvider,/deferPublicationRelease/u,'Drive publication-marker release must not be detached from the foreground operation');
assert.match(backupProvider,/finally\{[\s\S]{0,180}if\(publicationLease\)\{[\s\S]*provider-publication-release-start[\s\S]*await endRepositoryPublication[\s\S]*provider-publication-release-complete[\s\S]*publication-contention[\s\S]*request\('repository-state',MAINTENANCE_POLICY\.busyMs,\{mode:'replace'\}\)/u,'Drive must await publication-marker release, then pull any contention-blocked maintenance forward once after successful release');
assert.match(app,/strictTransaction\(\[DB_ASSET_STORE,DB_APP_META_STORE\],'readwrite',[\s\S]*AppData\.deletionRecovery\.stageAttachments\(tx,deletionState\)[\s\S]*store\.put\(row,id\)[\s\S]*store\.delete\(id\)/u,'attachment metadata and explicit attachment-deletion state must share one strict assets + appMeta transaction');
assert.match(attachments,/store\.publish\(pending,token,ensure,\{deletionState:\{clear:pending\.map\(\(\[assetId\]\)=>assetId\)\}\}\)/u,'standalone attachment archive import must atomically clear stale deletion markers while publishing restored identities');
assert.match(backupProvider,/async function cleanupRepositoryProviderState\([\s\S]*assertLease=checkMaintenance\|\|\(async\(\)=>\{if\(maintenanceLease\)await assertRepositoryMaintenance\(selected,maintenanceLease\);\}\)[\s\S]*deleteCheckpoint:async row=>\{await assertLease\(\)[\s\S]*deleteObject:async item=>\{await assertLease\(\)/u,'destructive provider cleanup must reassert its shared renewable guard or maintenance lease before checkpoint and object deletion');
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

assert.match(codec,/const LEGACY_TOMBSTONE_TYPE='tombstone',LEGACY_REFLECTION_DRAFT_TYPE='reflectionDraft'/u,'historical backup adapter must retain explicit tombstone and retired Reflection Draft vocabulary only inside compatibility parsing');
assert.match(codec,/Historical completion proofs depend on the original entity order/u,'historical completion-proof ordering must be documented and isolated');
assert.equal(currentEntities.includes('LEGACY_TOMBSTONE_TYPE'),false,'historical backup vocabulary must not leak into current domain entities');

// Current checkpoint purity: the contract no longer writes or owns the retired distributed-sync schema version.
assert.equal(canonical.includes('LEGACY_SYNC_SCHEMA_VERSION'),false,'legacy sync schema naming must be absent from the current identity contract');
assert.match(compatibility,/export const LEGACY_BACKUP_SCHEMA_VERSION=1;/u,'historical backup schema ceiling must live in compatibility, not the current data contract');
assert.match(app,/const LEGACY_BACKUP_SCHEMA_VERSION=@@SD_LEGACY_BACKUP_SCHEMA_VERSION@@;/u,'host must receive the historical backup ceiling through explicit compatibility injection');


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
