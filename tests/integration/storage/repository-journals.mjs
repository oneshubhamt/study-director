import assert from 'node:assert/strict';
import {createHarness} from '../../helpers/repository-harness.mjs';
import {createFakeClock} from '../../helpers/fake-clock.mjs';

const clock=createFakeClock('2026-09-13T06:00:00.000Z');
const {app,journalMeta,idbDurability,stores}=createHarness(new Map(),null,{clock});

const lease=await app.mutationLease.acquire(Object.freeze({
  id:'mutation_qa-journal-0001',owner:'tab_qa-journal-owner-0001',kind:'restore',expiresAt:clock.now()+60_000
}));
assert.equal(lease.acquired,true,'durable mutation lease should acquire when no live holder exists');
const blocked=await app.mutationLease.acquire(Object.freeze({
  id:'mutation_qa-journal-0002',owner:'tab_qa-journal-owner-0002',kind:'library-clear',expiresAt:clock.now()+60_000
}));
assert.equal(blocked.acquired,false,'a second durable mutation must observe the live holder');
await clock.advance(60_001);
const expiredTakeover=await app.mutationLease.acquire(Object.freeze({id:'mutation_qa-journal-0003',owner:'tab_qa-journal-owner-0003',kind:'restore',expiresAt:clock.now()+60_000}));
assert.equal(expiredTakeover.acquired,true,'lease expiry is decided by the injected clock, not ambient wall time');
assert.equal(await app.mutationLease.release('mutation_qa-journal-0003'),true);

const restoreId='restore_qa-journal-0001';
const blob=new Blob(['safety-copy']);
const rollbackDeletions=Object.freeze([Object.freeze({date:'2026-09-12',deletedAt:'2026-09-13T05:30:00.000Z'})]);
const rollbackNoteDeletions=Object.freeze([Object.freeze({key:'Ethics',deletedAt:'2026-09-13T05:31:00.000Z'})]);
const rollbackAttachmentDeletions=Object.freeze([Object.freeze({assetId:'img-journalabcdefghijklmnop',deletedAt:'2026-09-13T05:32:00.000Z'})]);
await app.restoreJournal.prepare(Object.freeze({id:restoreId,blob,filename:'qa.sdbackup',scheduleText:'07:00 | 60 | QA | Study | Area | pages | 10',savedDayDeletions:rollbackDeletions,noteDeletions:rollbackNoteDeletions,attachmentDeletions:rollbackAttachmentDeletions}));
const restoreHeader=await app.restoreJournal.diagnostics();assert.equal(restoreHeader.phase,'prepared');assert.equal(restoreHeader.blob,undefined);assert.equal(restoreHeader.scheduleText,undefined);
let restore=await app.restoreJournal.read();
assert.equal(restore.state.id,restoreId);
assert.equal(restore.state.phase,'prepared');
assert.equal(await restore.payload.blob.text(),'safety-copy');
assert.equal(restore.payload.version,5);
assert.equal(JSON.stringify(restore.payload.savedDayDeletions),JSON.stringify(rollbackDeletions),'restore journal must persist the Saved-Day deletion ledger needed for exact rollback');
assert.equal(JSON.stringify(restore.payload.noteDeletions),JSON.stringify(rollbackNoteDeletions),'restore journal must persist note deletion history for exact rollback');
assert.equal(JSON.stringify(restore.payload.attachmentDeletions),JSON.stringify(rollbackAttachmentDeletions),'restore journal must persist Attachment Library deletion history for exact rollback');
await app.restoreJournal.mark(restoreId,'committing');
restore=await app.restoreJournal.read();
assert.equal(restore.state.phase,'committing');
const restoreStrictBefore=idbDurability.strict,restoreNormalBefore=idbDurability.normal;
await app.restoreJournal.clear(restoreId);
assert.equal(idbDurability.strict,restoreStrictBefore+1,'restore journal retirement must use strict durability');
assert.equal(idbDurability.normal,restoreNormalBefore,'restore journal retirement must not fall back to a normal durability transaction');
assert.equal(await app.restoreJournal.read(),null,'restore journal should disappear only after explicit cleanup');

const libraryClearId='libraryclear_qa-journal-0001';
const payload=Object.freeze({planSignature:'qa-signature',savedDays:Object.freeze({'2026-09-13':Object.freeze({date:'2026-09-13'})})});
await app.libraryClearJournal.prepare(Object.freeze({id:libraryClearId,signature:'qa-signature',payload}));
const libraryHeader=await app.libraryClearJournal.diagnostics();assert.equal(libraryHeader.phase,'prepared');assert.equal(libraryHeader.payload,undefined);
let libraryClear=await app.libraryClearJournal.read();
assert.equal(libraryClear.state.id,libraryClearId);
assert.equal(libraryClear.state.phase,'prepared');
assert.deepEqual(libraryClear.payload,payload);
await app.libraryClearJournal.mark(libraryClearId,'mutating');
libraryClear=await app.libraryClearJournal.read();
assert.equal(libraryClear.state.phase,'mutating');
const libraryStrictBefore=idbDurability.strict,libraryNormalBefore=idbDurability.normal;
await app.libraryClearJournal.clear(libraryClearId);
assert.equal(idbDurability.strict,libraryStrictBefore+1,'library-clear journal retirement must use strict durability');
assert.equal(idbDurability.normal,libraryNormalBefore,'library-clear journal retirement must not fall back to a normal durability transaction');
assert.equal(await app.libraryClearJournal.read(),null,'library-clear journal should clear its state and chunk payload together');

// Older restore-journal payloads are converted once by the compatibility host;
// the ordinary journal store accepts only the current version.
const legacyId='restore_qa-journal-legacy1',legacyTime='2026-09-13T05:00:00.000Z';
const backupFile=Object.freeze({name:'backup-123e4567-e89b-12d3-a456-426614174000',size:64,hash:'a'.repeat(64)});
for(const payload of [
  Object.freeze({format:'study-director.restore-journal',version:1,id:legacyId,backupFile,filename:'legacy-v1.sdbackup',scheduleText:''}),
  Object.freeze({format:'study-director.restore-journal',version:2,id:legacyId,blob:new Blob(['v2']),filename:'legacy-v2.sdbackup',scheduleText:'',savedDayDeletions:Object.freeze([{date:'2026-09-10',deletedAt:legacyTime}])}),
  Object.freeze({format:'study-director.restore-journal',version:3,id:legacyId,blob:new Blob(['v3']),filename:'legacy-v3.sdbackup',scheduleText:'',savedDayDeletions:Object.freeze([]),noteDeletions:Object.freeze([{key:'GS2',deletedAt:legacyTime}])})
]){
  await assert.rejects(()=>journalMeta.write('restoreJournalPayload',payload),/not canonical/u,`version ${payload.version} is not read by the ordinary runtime`);
}
await assert.rejects(()=>journalMeta.write('restoreJournalPayload',Object.freeze({format:'study-director.restore-journal',version:5,id:legacyId,blob:new Blob(['v5']),filename:'bad.sdbackup',scheduleText:''})),/not canonical/u);
await journalMeta.remove('restoreJournalPayload');

// Invalid and mismatched mutation/journal operations fail closed rather than mutating another operation's state.
await assert.rejects(()=>app.mutationLease.acquire(Object.freeze({id:'bad',owner:'tab_qa-journal-owner-0004',kind:'restore',expiresAt:clock.now()+1000})),/invalid/u);
assert.equal(await app.mutationLease.release('bad'),false);
const held=await app.mutationLease.acquire(Object.freeze({id:'mutation_qa-journal-0004',owner:'tab_qa-journal-owner-0004',kind:'restore',expiresAt:clock.now()+60_000}));assert.equal(held.acquired,true);assert.equal(await app.mutationLease.release('mutation_qa-journal-wrong'),false);assert.equal(await app.mutationLease.release('mutation_qa-journal-0004'),true);
await assert.rejects(()=>app.restoreJournal.mark('bad','committing'),/phase is invalid/u);
await app.restoreJournal.prepare(Object.freeze({id:'restore_qa-journal-0002',blob:new Blob(['rollback']),filename:'qa2.sdbackup',scheduleText:''}));
await assert.rejects(()=>app.restoreJournal.mark('restore_qa-journal-other','committing'),/identity changed/u);
await assert.rejects(()=>app.restoreJournal.clear('restore_qa-journal-other'),/identity changed/u);
await app.restoreJournal.clear();assert.equal(await app.restoreJournal.read(),null);
await assert.rejects(()=>app.libraryClearJournal.prepare(Object.freeze({id:'bad',signature:'x',payload:{}})),/input is invalid/u);
await app.libraryClearJournal.prepare(Object.freeze({id:'libraryclear_qa-journal-0002',signature:'sig2',payload:Object.freeze({planSignature:'sig2',savedDays:Object.freeze({})})}));
await assert.rejects(()=>app.libraryClearJournal.prepare(Object.freeze({id:'libraryclear_qa-journal-0003',signature:'sig3',payload:Object.freeze({planSignature:'sig3'})})),/still requires recovery/u);
await assert.rejects(()=>app.libraryClearJournal.mark('bad','mutating'),/phase is invalid/u);
await assert.rejects(()=>app.libraryClearJournal.mark('libraryclear_qa-journal-other','mutating'),/identity changed/u);
await assert.rejects(()=>app.libraryClearJournal.clear('libraryclear_qa-journal-other'),/identity changed/u);
await app.libraryClearJournal.clear();assert.equal(await app.libraryClearJournal.read(),null);

console.log(JSON.stringify({status:'PASS',suite:'repository-journals',contracts:['exclusive durable mutation lease','restore journal lifecycle','library-clear chunked integrity journal lifecycle']},null,2));

// Missing payloads do not make the header-only diagnostic call read or repair payloads.
await app.restoreJournal.prepare(Object.freeze({id:'restore_qa-diagnostic-0001',blob:new Blob(['PRIVATE DATA']),filename:'private.sdbackup',scheduleText:''}));
assert.ok(stores.meta.has('restoreJournalPayload'));stores.meta.delete('restoreJournalPayload');assert.equal((await app.restoreJournal.diagnostics()).phase,'prepared');assert.equal(stores.meta.has('restoreJournalPayload'),false,'diagnostics must not repair or write a missing payload');
assert.equal((await app.metadata.diagnostics()).maintenanceStatus,'never');assert.equal((await app.metadata.diagnostics()).deletions,0);assert.equal((await app.metadata.diagnostics()).localRecovery,false);
await app.restoreJournal.clear();assert.equal(await app.restoreJournal.diagnostics(),null);assert.equal(await app.libraryClearJournal.diagnostics(),null);
console.log(JSON.stringify({status:'PASS',suite:'read-only-data-diagnostics',headerOnly:true,noPayloadRepair:true,metadataSummary:true},null,2));

{const failures=new Set(['deletionRecovery']),h=createHarness(new Map(),null,{failLocalGetKeys:failures});await assert.rejects(h.app.metadata.diagnostics(),/local recovery read failure/u);}
