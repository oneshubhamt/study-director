import {createHarness as createRepositoryHarness} from '../../helpers/repository-harness.mjs';
import {createFakeClock} from '../../helpers/fake-clock.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function freeze(value){return Object.freeze(value)}

const clock=createFakeClock('2026-09-04T06:00:00.000Z');
const createHarness=(sharedLocal=new Map(),sharedStores=null,controls={})=>{
  controls.clock=clock;
  return createRepositoryHarness(sharedLocal,sharedStores,controls);
};
const settleRecovery=()=>clock.drainMicrotasks(12);
// QA_FIXTURE: a Wordgard-validated canonical edit bypasses duplicate repository parsing,
// while the ordinary update API retains its defensive validation path. Exact no-op saves
// also return before validation so close/save hooks do not reparse the same WG1 value.
const fastLocal=new Map(),fastStores={area:new Map(),sync:new Map(),tombstones:new Map(),reflection:new Map(),daily:new Map(),summary:new Map(),session:new Map(),meta:new Map()};
const fast=createHarness(fastLocal,fastStores);await fast.app.notes.load();
const canonical='WG1:{"version":1,"doc":{"type":"Doc","content":[{"type":"Paragraph","content":[{"type":"Text","param":"Trusted rich edit"}]}]}}';
fast.validationCalls.within=0;fast.validationCalls.clamp=0;
const trusted=fast.app.notes.updateValidatedRich('trusted','Trusted',canonical,'');assert.equal(trusted.status,'changed');assert.deepEqual(fast.validationCalls,{within:0,clamp:0},'validated Wordgard edit must not re-enter repository rich validation');
fast.validationCalls.within=0;fast.validationCalls.clamp=0;
const noOp=fast.app.notes.update('trusted','Trusted',canonical,trusted.revision);assert.equal(noOp.status,'unchanged');assert.deepEqual(fast.validationCalls,{within:0,clamp:0},'exact canonical no-op must return before validation');
fast.validationCalls.within=0;fast.validationCalls.clamp=0;
const defensive=fast.app.notes.update('plain','Plain','ordinary text','');assert.equal(defensive.status,'changed');assert.equal(fast.validationCalls.within,1,'ordinary repository update must retain validation');assert.equal(fast.validationCalls.clamp,1,'ordinary repository update must retain canonical clamping');

const cloneStores=(source,{copyArea=false}={})=>({
  area:copyArea?new Map([...source.area].map(([key,value])=>[key,structuredClone(value)])):new Map(),
  sync:new Map(),tombstones:new Map(),reflection:new Map(),daily:new Map(),summary:new Map(),session:new Map(),
  meta:new Map([...source.meta].map(([key,value])=>[key,structuredClone(value)]))
});
const recoveryEntries=stores=>[...stores.meta.values()].filter(row=>row?.value?.format==='study-director.area-note-recovery');
const recoveryFor=(stores,key)=>recoveryEntries(stores).find(row=>row.value.key===key)?.value?.entry||null;

const sharedLocal=new Map(),sharedStores={area:new Map(),sync:new Map(),tombstones:new Map(),reflection:new Map(),daily:new Map(),summary:new Map(),session:new Map(),meta:new Map()};
const first=createHarness(sharedLocal,sharedStores);await first.app.notes.load();assert.ok(first.idbReads.boundedMetaGetAll>0,'recovery load must use a bounded appMeta key-range read');assert.equal(first.idbReads.unboundedMetaGetAll,0,'recovery load must not scan unrelated appMeta rows');
let revision='';const revisions=[];
{const result=first.app.notes.update('area','Area','rapid-0',revision);assert.equal(result.status,'changed');revision=result.revision;revisions.push(revision);}
await settleRecovery();
assert.equal(recoveryFor(sharedStores,'area').text,'rapid-0','first edit of a clean note must become crash-recoverable in IndexedDB immediately');
assert.equal(sharedLocal.has('pending'),false,'current Area-note recovery must not require a redundant localStorage marker');
for(let i=1;i<100;i++){
  const result=first.app.notes.update('area','Area',`rapid-${i}`,revision);assert.equal(result.status,'changed');revision=result.revision;revisions.push(revision);
}
assert.equal(new Set(revisions).size,1,'100 same-burst edits should reuse one revision timestamp');
assert.equal(sharedStores.sync.size,0,'Area-note keystrokes must not write the retired sync queue');
assert.equal(sharedStores.tombstones.size,0,'Area-note keystrokes must not write retired tombstones');
assert.equal(first.localWrites.pending||0,0,'Area-note recovery must not write a redundant localStorage marker');
await clock.advance(201);
await settleRecovery();
assert.ok(first.idbWrites.recovery<=2,`rapid burst should coalesce recovery writes, got ${first.idbWrites.recovery}`);
assert.equal(recoveryFor(sharedStores,'area').text,'rapid-99','coalesced IndexedDB recovery snapshot must contain latest text');

// Crash simulation: authoritative area-note IDB was not committed, but transient appMeta recovery survives.
const crashStores=cloneStores(sharedStores);
const recovered=createHarness(sharedLocal,crashStores);await recovered.app.notes.load();
assert.equal(recovered.app.notes.get('area').text,'rapid-99','fresh repository must recover latest coalesced text from appMeta after crash');
await recovered.app.notes.flush({strict:true});
assert.equal(crashStores.area.get('area').text,'rapid-99','recovered latest text must become authoritative after strict flush');
assert.equal(recoveryEntries(crashStores).length,0,'recovery rows must clear after authoritative commit');
assert.equal(sharedLocal.has('pending'),false,'Area-note recovery must remain IndexedDB-only after authoritative commit');

// After the coalescing window, a new edit may advance the revision again.
await clock.advance(501);
let recoveredRevision=recovered.app.notes.get('area').updatedAt;
const later=recovered.app.notes.update('area','Area','after-window',recoveredRevision);assert.equal(later.status,'changed');assert.notEqual(later.revision,recoveredRevision,'revision should advance after the bounded coalescing interval');
await recovered.app.notes.flush({strict:true});assert.equal(crashStores.area.get('area').text,'after-window');

// Clearing content is a durable empty note, not an implicit deletion.
const emptyRevision=recovered.app.notes.get('area').updatedAt,emptied=recovered.app.notes.update('area','Area','',emptyRevision);assert.equal(emptied.status,'changed');
await settleRecovery();
assert.notEqual(recoveryFor(crashStores,'area').deleted,true,'blank edit must recover as an empty note, never as a deletion marker');
assert.equal(recoveryFor(crashStores,'area').text,'');
const emptyLocal=new Map([...sharedLocal].map(([key,value])=>[key,structuredClone(value)]));
const staleAuthoritative=cloneStores(crashStores,{copyArea:true});
const emptyRecovered=createHarness(emptyLocal,staleAuthoritative);await emptyRecovered.app.notes.load();assert.equal(emptyRecovered.app.notes.get('area').text,'','pending empty note must shadow stale non-empty canonical content after crash');await emptyRecovered.app.notes.flush({strict:true});
assert.equal(staleAuthoritative.area.get('area').text,'','recovered empty note must become authoritative');
assert.equal(emptyRecovered.app.notes.exportPayload().area.text,'','backup payload must preserve intentional empty notes');
assert.equal(emptyRecovered.app.notes.metadataSnapshot().records.find(record=>record.key==='area').hasNote,false,'empty note must remain catalogued but muted');
assert.equal(emptyRecovered.app.notes.searchSnapshot().documents.some(record=>record.key==='area'),false,'empty notes must not inflate the content-search index');
assert.equal(await emptyRecovered.app.notes.remove('area'),true,'explicit remove must remain the deletion path');
assert.equal(staleAuthoritative.area.has('area'),false,'explicit remove must delete the canonical note');

// Failed authoritative persistence retains the newest appMeta recovery until a later instance commits it.
const failureLocal=new Map(),failureStores={area:new Map(),sync:new Map(),tombstones:new Map(),reflection:new Map(),daily:new Map(),summary:new Map(),session:new Map(),meta:new Map()},failureControls={failNextAreaWrite:false};
const failureBase={version:2,key:'failure',label:'Failure',text:'stable',updatedAt:'2026-09-04T04:00:00.000Z'};failureStores.area.set('failure',structuredClone(failureBase));
const failing=createHarness(failureLocal,failureStores,failureControls);await failing.app.notes.load();failureControls.failNextAreaWrite=true;const failedEdit=failing.app.notes.update('failure','Failure','latest-before-failure',failureBase.updatedAt);assert.equal(failedEdit.status,'changed');await assert.rejects(()=>failing.app.notes.flush({strict:true}),/could not be saved|safely stored/,'strict durability flush must reject when authoritative write fails');assert.equal(failureStores.area.get('failure').text,'stable');assert.equal(recoveryFor(failureStores,'failure').text,'latest-before-failure','failed authoritative write must retain latest IndexedDB recovery');assert.equal(failing.app.notes.failure().failed,true);
const failureRecovered=createHarness(failureLocal,failureStores);await failureRecovered.app.notes.load();assert.equal(failureRecovered.app.notes.get('failure').text,'latest-before-failure');await failureRecovered.app.notes.flush({strict:true});assert.equal(failureStores.area.get('failure').text,'latest-before-failure');assert.equal(recoveryEntries(failureStores).length,0);assert.equal(failureLocal.has('pending'),false);

// A failed recovery-row cleanup after a successful canonical write must not poison later strict preflight.
const staleCleanupLocal=new Map(),staleCleanupStores={area:new Map(),sync:new Map(),tombstones:new Map(),reflection:new Map(),daily:new Map(),summary:new Map(),session:new Map(),meta:new Map()},staleCleanupControls={failNextMetaOnlyWrite:false};
const staleCleanup=createHarness(staleCleanupLocal,staleCleanupStores,staleCleanupControls);await staleCleanup.app.notes.load();
const staleEdit=staleCleanup.app.notes.update('stale','Stale','canonically-saved','');assert.equal(staleEdit.status,'changed');await settleRecovery();
staleCleanupControls.failNextMetaOnlyWrite=true;
await staleCleanup.app.notes.flush({strict:true});
await settleRecovery();
assert.equal(staleCleanupStores.area.get('stale').text,'canonically-saved','canonical note write must succeed even when recovery cleanup fails transiently');
await staleCleanup.app.notes.flush({strict:true});
assert.equal(staleCleanup.app.notes.failure().failed,false,'strict flush must clear only a stale failure latch after canonical equality is independently verified');
assert.equal(staleCleanupStores.area.get('stale').text,'canonically-saved');

// Concurrent authoritative revision wins and stale transient recovery is removed.
const conflictLocal=new Map(),conflictStores={area:new Map(),sync:new Map(),tombstones:new Map(),reflection:new Map(),daily:new Map(),summary:new Map(),session:new Map(),meta:new Map()};
const conflictBase={version:2,key:'conflict',label:'Conflict',text:'base',updatedAt:'2026-09-04T04:10:00.000Z'};conflictStores.area.set('conflict',structuredClone(conflictBase));const conflicting=createHarness(conflictLocal,conflictStores);await conflicting.app.notes.load();const localConflictEdit=conflicting.app.notes.update('conflict','Conflict','local-dirty',conflictBase.updatedAt);assert.equal(localConflictEdit.status,'changed');conflictStores.area.set('conflict',{...structuredClone(conflictBase),text:'remote-newer',updatedAt:'2026-09-04T04:10:01.000Z'});await conflicting.app.notes.flush({strict:true});assert.equal(conflicting.app.notes.get('conflict').text,'remote-newer');assert.equal(conflictStores.area.get('conflict').text,'remote-newer');assert.equal(recoveryEntries(conflictStores).length,0);assert.equal(conflictLocal.has('pending'),false);

// Completing one note must not sweep another context's still-pending recovery row.
const scopedLocal=new Map(),scopedStores={area:new Map(),sync:new Map(),tombstones:new Map(),reflection:new Map(),daily:new Map(),summary:new Map(),session:new Map(),meta:new Map()};
const scoped=createHarness(scopedLocal,scopedStores);await scoped.app.notes.load();
const foreignEntry={version:2,key:'foreign',label:'Foreign',text:'other-context-pending',updatedAt:'2026-09-04T04:20:00.000Z'},foreignRowUpdatedAt='2026-09-04T04:20:01.000Z';
scopedStores.meta.set('areaNoteRecovery.v1:foreign',{key:'areaNoteRecovery.v1:foreign',version:1,value:{format:'study-director.area-note-recovery',version:1,key:'foreign',entry:structuredClone(foreignEntry),updatedAt:foreignRowUpdatedAt},updatedAt:foreignRowUpdatedAt});
const scopedEdit=scoped.app.notes.update('local','Local','local-dirty','');assert.equal(scopedEdit.status,'changed');await scoped.app.notes.flush({strict:true});
assert.equal(scopedStores.area.get('local').text,'local-dirty');assert.equal(recoveryFor(scopedStores,'local'),null,'successful local save must clear only its own recovery row');assert.equal(recoveryFor(scopedStores,'foreign').text,'other-context-pending','successful local save must preserve unrelated pending recovery');assert.equal(scopedLocal.has('pending'),false,'unrelated recovery rows must remain discoverable from IndexedDB without a localStorage marker');
const scopedRecovered=createHarness(scopedLocal,scopedStores);await scopedRecovered.app.notes.load();assert.equal(scopedRecovered.app.notes.get('foreign').text,'other-context-pending','preserved recovery row must remain recoverable by a fresh repository');await scopedRecovered.app.notes.flush({strict:true});assert.equal(scopedStores.area.get('foreign').text,'other-context-pending');assert.equal(recoveryEntries(scopedStores).length,0);assert.equal(scopedLocal.has('pending'),false);

// A valid rich note above the old 512 KiB localStorage ceiling remains fully recoverable.
const largeLocal=new Map(),largeStores={area:new Map(),sync:new Map(),tombstones:new Map(),reflection:new Map(),daily:new Map(),summary:new Map(),session:new Map(),meta:new Map()};
const large=createHarness(largeLocal,largeStores);await large.app.notes.load();
const largeText='WG1:'+JSON.stringify({version:1,doc:{type:'Doc',content:[{type:'Paragraph',content:[{type:'Text',param:'x'.repeat(600*1024)}]}]}});
const largeEdit=large.app.notes.updateValidatedRich('large','Large',largeText,'');assert.equal(largeEdit.status,'changed');await settleRecovery();
assert.ok(Buffer.byteLength(recoveryFor(largeStores,'large').text)>512*1024,'recovery row must preserve a valid rich note larger than the old localStorage ceiling');
assert.equal(largeLocal.has('pending'),false,'large-note recovery must not use localStorage');
await large.app.notes.flush({strict:true});assert.equal(recoveryEntries(largeStores).length,0);assert.equal(largeLocal.has('pending'),false);

// Existing v1 localStorage recovery is migrated to appMeta and the legacy source is retired.
const legacyEntry={key:'legacy',label:'Legacy',text:'legacy-unsaved',updatedAt:'2026-09-04T05:00:00.000Z',entityType:'areaNote',entityId:'legacy',schemaVersion:1,deviceId:'dev_legacy',createdAt:'2026-09-04T05:00:00.000Z',deleted:false,syncStatus:'pending'};
const legacyLocal=new Map([['pending',{version:1,updatedAt:'2026-09-04T05:00:01.000Z',pending:{legacy:structuredClone(legacyEntry)}}]]),legacyStores={area:new Map(),sync:new Map(),tombstones:new Map(),reflection:new Map(),daily:new Map(),summary:new Map(),session:new Map(),meta:new Map()};
const legacy=createHarness(legacyLocal,legacyStores);await legacy.app.compatibility.migrateAreaNoteRecovery();await legacy.app.notes.load();assert.equal(legacy.app.notes.get('legacy').text,'legacy-unsaved','legacy local recovery must restore only after the explicit compatibility adapter runs');assert.equal(recoveryFor(legacyStores,'legacy').text,'legacy-unsaved','legacy recovery must migrate to appMeta');assert.equal(legacyLocal.has('pending'),false,'verified migration must delete the legacy localStorage recovery source without replacing it with another marker');await legacy.app.notes.flush({strict:true});assert.equal(legacyStores.area.get('legacy').text,'legacy-unsaved');assert.equal(recoveryEntries(legacyStores).length,0);assert.equal(legacyLocal.has('pending'),false);

console.log(JSON.stringify({status:'PASS',rapidEdits:100,recoveryWrites:first.idbWrites.recovery,localMarkerWrites:first.localWrites.pending,uniqueRapidRevisions:new Set(revisions).size,crashRecovered:true,crashEmptyRecovered:true,explicitDelete:true,failedWriteRecovered:true,staleCleanupRecovered:true,conflictRollback:true,largeRecoveryBytes:Buffer.byteLength(largeText),legacyMigrated:true,scopedRecoveryPreserved:true,boundedRecoveryReads:first.idbReads.boundedMetaGetAll,unboundedRecoveryReads:first.idbReads.unboundedMetaGetAll,validatedRichFastPath:true,canonicalNoOpFastPath:true},null,2));
