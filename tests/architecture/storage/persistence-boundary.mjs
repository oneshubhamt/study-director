import {readScript} from '../../../build/source-script.mts';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>readScript(file);
const persistence=read('source/core/persistence.ts');
const codecs=read('source/core/record-codecs.ts');
const backup=read('source/core/backup-codec.ts');
const journals=read('source/core/repository-journals.ts');
const repositories=read('source/core/repositories.ts');
const notes=read('source/core/repositories-notes.ts');
const app=read('source/app.html');
const appMeta=read('source/core/app-meta.ts');

assert.match(persistence,/createLocalStorage[\s\S]*createInstallationIdentity[\s\S]*createIndexedDb/,'persistence primitives must retain browser storage ownership and separate installation identity');
assert.doesNotMatch(persistence,/createSyncMetadata/,'distributed-sync metadata must not remain a current persistence primitive');
assert.match(codecs,/exactObject\(input,\['limits','dataContract','domain','keyedRecord','helpers','timestamps','timer'\]/u,'Daily Record codec must consume timestamps, not a sync contract');
assert.doesNotMatch(codecs,/sanitizeCurrentSyncMetadata|sanitizeHistoricalSyncMetadata/u,'current domain codecs must not own distributed-sync metadata');
assert.match(persistence,/strictTransaction:idbStrictTransaction[\s\S]*strictStoreTransaction:idbStrictStoreTransaction/,'IndexedDB primitives must expose one centralized strict-durability capability');
assert.match(persistence,/db\.transaction\(stores,mode,\{durability:'strict'\}\)/,'strict durability must use the native IndexedDB transaction option');
assert.doesNotMatch(repositories,/idbPutReflectionDraft|DB_REFLECTION_DRAFT_STORE/u,'retired Reflection Draft persistence must not remain a current repository boundary');
assert.match(repositories,/async function idbPutActiveSession[\s\S]*?return idbTransaction\(\[DB_ACTIVE_SESSION_STORE,DB_APP_META_STORE\],'readwrite'/,'high-frequency active-session checkpoints must share their canonical mutation epoch in the same default-durability transaction');
assert.doesNotMatch(notes,/meta\.put\('noteRecoveryPrefix'/u,'Notes save straight to their canonical rows and never journal edits in appMeta');
assert.match(notes,/async function idbApplyDelta[\s\S]*?idbStrictTransaction\s*\(\[DB_NOTES_STORE,DB_APP_META_STORE\],'readwrite'/,'canonical note commits and deletion markers must share one strict transaction');
assert.match(repositories,/async function idbPutDailyRecordBatch[\s\S]*?idbStrictTransaction\s*\(stores,'readwrite'/,'authoritative Daily Record commits must opt into strict durability');

const functionSlice=(source,name,next)=>{const start=source.indexOf(name),end=next?source.indexOf(next,start+name.length):-1;assert.ok(start>=0,`${name} must exist`);return source.slice(start,end>start?end:source.length);};


assert.match(repositories,/study-director\.saved-day-deletion/,'Saved-Day deletion history must have a purpose-specific repository contract');
assert.match(repositories,/function randomCoordinationToken\(\)[\s\S]*crypto\.getRandomValues/,'canonical coordination tokens must come from fresh opaque random bytes rather than portable/domain authority');
assert.match(repositories,/function newCanonicalMutationEpoch\(\)\{\s*return freeze\(\{format:'study-director\.canonical-mutation-epoch',version:1,token:randomCoordinationToken\(\)/u,'canonical mutation fencing must use the opaque coordination-token generator');
assert.match(repositories,/function stageCanonicalMutationEpoch\(tx,preparationUnits=null\)[\s\S]*Meta\.view\(tx\)\.put\('canonicalMutationEpoch'/,'canonical epoch publication and preparation-unit attribution must be stageable inside the same IndexedDB transaction as canonical data');
assert.match(app,/async function fullBackupSnapshotRevision\(\)[\s\S]*AppData\.dailyRecords\.datasetRevision\(\)[\s\S]*PlanData\.exportData\(\{flush:false\}\)[\s\S]*AttachmentStorage\.list\(\)/,'the full snapshot fence must remain available as a conservative fallback');
assert.match(app,/async function backupSnapshotRevision\(options=\{\}\)[\s\S]*options&&options\.full===true[\s\S]*AppData\.mutationEpoch\.eligible\(\)[\s\S]*study-director\.fast-capture-fence\.v1/,'healthy backup fencing must use the constant-size epoch/generation guard and fail back to the full snapshot fence when explicitly requested or ineligible');
assert.match(app,/captureMutationGeneration\+\+/,'in-process textarea mutations must advance the local capture generation before canonical persistence necessarily settles');
assert.match(app,/markReady:async proof=>\{[\s\S]*backupFastFenceReady=false;[\s\S]*proof&&proof\.canonical===true[\s\S]*AppData\.mutationEpoch\.reseed\(\)[\s\S]*backupFastFenceReady=true/,'the fast fence must activate only after startup proves canonical readiness and successfully reseeds the durable epoch');

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
assert.match(repositories,/const Meta=input\.appMeta/,'AppData must consume owner-scoped appMeta capability rather than reacquiring arbitrary metadata access');
assert.match(journals,/const APP_LIMITS=input\.limits,Meta=input\.appMeta/,'repository journals must consume their owner-scoped appMeta capability');
assert.match(appMeta,/function family\(name\s*,owner\s*\)/,'appMeta gateway must enforce family ownership');
assert.match(persistence,/n>Number\(nowMs\)\+10\*60\*1000/,'import timestamp acceptance must use an explicit caller-supplied decision time');
assert.match(journals,/Number\(current\.expiresAt\)>decisionNowMs\(\)/,'durable mutation lease expiry must use the injected decision clock');
assert.match(repositories,/decisionNowMs\(\)-lastRun<DATA_MAINTENANCE_INTERVAL_MS/,'repository maintenance recency must use the injected decision clock');
assert.match(repositories,/NotesRepositoryModule\.create/,'AppData facade must compose the extracted notes repository through an injected module contract');
assert.match(repositories,/Math\.floor\(Number\(seed\)\|\|0\),lastSessionRevision,decisionNowMs\(\)/,'session revision ordering must use the injected decision clock');

console.log(JSON.stringify({status:'PASS',boundary:'persistence-repositories',layers:['persistence primitives','record codecs','backup codec','repository journals','AppData facade']},null,2));
