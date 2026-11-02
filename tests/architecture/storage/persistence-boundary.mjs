import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');
const persistence=read('source/core/persistence.js');
const codecs=read('source/core/record-codecs.js');
const backup=read('source/core/backup-codec.js');
const journals=read('source/core/repository-journals.js');
const repositories=read('source/core/repositories.js');
const notes=read('source/core/repositories-notes.js');
const app=read('source/app.html');
const appMeta=read('source/core/app-meta.js');

assert.match(persistence,/createLocalStorage[\s\S]*createInstallationIdentity[\s\S]*createIndexedDb/,'persistence primitives must retain browser storage ownership and separate installation identity');
assert.doesNotMatch(persistence,/createSyncMetadata/,'distributed-sync metadata must not remain a current persistence primitive');
assert.match(codecs,/exactObject\(input,\['limits','dataContract','domain','keyedRecord','helpers','timestamps','timer'\]/u,'Daily Record codec must consume timestamps, not a sync contract');
assert.doesNotMatch(codecs,/sanitizeCurrentSyncMetadata|sanitizeHistoricalSyncMetadata/u,'current domain codecs must not own distributed-sync metadata');
assert.doesNotMatch(repositories,/idbPutReflectionDraft|DB_REFLECTION_DRAFT_STORE/u,'retired Reflection Draft persistence must not remain a current repository boundary');
assert.doesNotMatch(notes,/meta\.put\('noteRecoveryPrefix'/u,'Notes save straight to their canonical rows and never journal edits in appMeta');
assert.match(notes,/async function idbApplyDelta[\s\S]*?idbStrictTransaction\(\[DB_NOTES_STORE,DB_APP_META_STORE\],'readwrite'/,'canonical note commits and deletion markers must share one strict transaction');

const functionSlice=(source,name,next)=>{const start=source.indexOf(name),end=next?source.indexOf(next,start+name.length):-1;assert.ok(start>=0,`${name} must exist`);return source.slice(start,end>start?end:source.length);};
for(const [label,slice] of [
  ['DailyRecord batch write',functionSlice(repositories,'async function idbPutDailyRecordBatch','async function idbGet')],
  ['DailyRecord delete',functionSlice(repositories,'async function idbDelete(','async function idbAll')],
  ['ActiveSession write',functionSlice(repositories,'async function idbPutActiveSession','async function idbGetActiveSession')],
  ['Note commit',functionSlice(notes,'async function idbApplyDelta','async function idbReplace')]
]){
  assert.doesNotMatch(slice,/DB_SYNC_QUEUE_STORE|DB_TOMBSTONE_STORE/u,`${label} must not depend on legacy sync stores`);
}
assert.match(app,/async function legacyBackupSnapshotRevision\(\)[\s\S]*AppData\.dailyRecords\.datasetRevision\(\)[\s\S]*PlanData\.exportData\(\{flush:false\}\)[\s\S]*AttachmentStorage\.list\(\)/,'the legacy heavyweight fence must remain available as a conservative fallback');
assert.match(app,/async function backupSnapshotRevision\(options=\{\}\)[\s\S]*options&&options\.legacy===true[\s\S]*AppData\.mutationEpoch\.eligible\(\)[\s\S]*study-director\.fast-capture-fence\.v1/,'healthy backup fencing must use the constant-size epoch/generation guard and fail back to the legacy fence when explicitly requested or ineligible');
assert.match(app,/captureMutationGeneration\+\+/,'in-process textarea mutations must advance the local capture generation before canonical persistence necessarily settles');
assert.match(app,/markReady:async proof=>\{[\s\S]*backupFastFenceReady=false;[\s\S]*proof&&proof\.canonical===true[\s\S]*AppData\.mutationEpoch\.reseed\(\)[\s\S]*backupFastFenceReady=true/,'the fast fence must activate only after startup proves canonical compatibility and successfully reseeds the durable epoch');

assert.match(app,/commit:\(rows,remove,token,guard=\(\)=>true,deletionState=null\)=>IndexedDb\.strictTransaction\(\[DB_ASSET_STORE,DB_APP_META_STORE\],'readwrite',[\s\S]*AppData\.deletionRecovery\.stageAttachments\(tx,deletionState\)/u,'verified attachment metadata, deletion state, and the canonical mutation epoch must publish atomically with strict durability');
assert.match(app,/const units=\[\.\.\.new Set\(\[\.\.\.rows\.map\(\(\[id\]\)=>`attachmentAsset:\$\{String\(id\)\}`\),\.\.\.remove\.map\(id=>`attachmentAsset:\$\{String\(id\)\}`\)\]\)\];[\s\S]*AppData\.mutationEpoch\.stage\(tx,units\)/u,'attachment metadata publication/removal must invalidate exactly the affected attachment preparation identities inside the canonical transaction');
assert.doesNotMatch(persistence,/createDailyRecordCodec|createActiveSessionCodec|createBackupCodec|createPersonalDataCodec/,'persistence primitives must not reacquire codecs');
assert.match(codecs,/createDailyRecordCodec[\s\S]*createActiveSessionCodec[\s\S]*createPersonalDataCodec/,'record codecs must own canonical record/session/personal normalization');
assert.doesNotMatch(codecs,/localStorage|indexedDB|createBackupCodec/,'record codecs must remain independent of browser storage and backup framing');
assert.match(backup,/createBackupCodec/);
assert.match(backup,/personalDataCodec/,'backup codec must consume the personal-data codec through an explicit port');
assert.match(journals,/prepareLibraryClearJournal[\s\S]*prepareRestoreJournal/,'durable destructive-operation journals must share one authoritative module');
assert.match(journals,/acquireMutationLease[\s\S]*releaseMutationLease/,'durable mutation lease belongs with destructive-operation journals');
assert.doesNotMatch(repositories,/ARCHIVE_CLEAR_JOURNAL_STATE_KEY|RESTORE_JOURNAL_STATE_KEY|MUTATION_LEASE_KEY/,'AppData facade must not reacquire journal storage internals');
assert.match(repositories,/input\.journals/,'AppData must compose journal capabilities through an injected contract');
assert.match(appMeta,/function family\(name,owner\)/,'appMeta gateway must enforce family ownership');
assert.match(repositories,/NotesRepositoryModule\.create/,'AppData facade must compose the extracted notes repository through an injected module contract');
assert.match(repositories,/Math\.floor\(Number\(seed\)\|\|0\),lastSessionRevision,decisionNowMs\(\)/,'session revision ordering must use the injected decision clock');

console.log(JSON.stringify({status:'PASS',boundary:'persistence-repositories',layers:['persistence primitives','record codecs','backup codec','repository journals','AppData facade']},null,2));
