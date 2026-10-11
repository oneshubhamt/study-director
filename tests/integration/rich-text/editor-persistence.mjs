import {createHarness as createRepositoryHarness} from '../../helpers/repository-harness.mjs';
import {createFakeClock} from '../../helpers/fake-clock.mjs';
import {noteId,noteRow,storedNote} from '../../helpers/note-ids.mjs';
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

const emptyStores=()=>({area:new Map(),sync:new Map(),tombstones:new Map(),reflection:new Map(),daily:new Map(),summary:new Map(),session:new Map(),meta:new Map()});
const cloneStores=(source,{copyArea=false}={})=>({
  ...emptyStores(),
  area:copyArea?new Map([...source.area].map(([key,value])=>[key,structuredClone(value)])):new Map(),
  meta:new Map([...source.meta].map(([key,value])=>[key,structuredClone(value)]))
});
const journalRows=stores=>[...stores.meta.values()].filter(row=>row?.value?.format==='study-director.area-note-recovery');
const rescueFor=(local,key)=>local.get('areaNoteRescue')?.entries?.[key]||null;

// Typing saves straight to the database a moment after it pauses. Every change
// moves the revision forward; nothing is journaled and the browser copy stays
// untouched while saves succeed.
const sharedLocal=new Map(),sharedStores=emptyStores();
const first=createHarness(sharedLocal,sharedStores);await first.app.notes.load();
let revision='';const revisions=[];
for(let i=0;i<100;i++){
  const result=first.app.notes.update('area','Area',`rapid-${i}`,revision);assert.equal(result.status,'changed');revision=result.revision;revisions.push(revision);
}
assert.equal(new Set(revisions).size,100,'every change gets its own revision, even within one millisecond');
assert.ok(revisions.every((value,index)=>!index||value>revisions[index-1]),'revisions only move forward');
assert.equal(storedNote(sharedStores.area,'area'),undefined,'nothing is written while typing continues');
await clock.advance(251);await settleRecovery();
assert.equal(storedNote(sharedStores.area,'area').text,'rapid-99','the pause after typing writes the latest text');const areaId=first.app.notes.get('area').id;
assert.equal(journalRows(sharedStores).length,0,'no journal rows are written');
assert.equal(first.localWrites.all,0,'successful saves never write the browser copy');
assert.equal(sharedStores.sync.size+sharedStores.tombstones.size,0,'retired sync stores stay untouched');

// A clock that goes back still moves the revision forward.
const beforeSkew=first.app.notes.get('area').updatedAt;await clock.advance(-60000);
const skewed=first.app.notes.update('area','Area','after clock skew',beforeSkew);assert.equal(skewed.status,'changed');assert.ok(skewed.revision>beforeSkew,'a clock moved back cannot reuse or lower a revision');
await clock.advance(60000);await first.app.notes.flush({strict:true});

// Hiding or closing the page with an unsaved edit keeps a browser copy; the
// next start folds it back in and saves it.
const hidden=first.app.notes.update('area','Area','typed just before closing',first.app.notes.get('area').updatedAt);assert.equal(hidden.status,'changed');
assert.equal(first.app.notes.protectUnsaved(),true);assert.equal(rescueFor(sharedLocal,areaId).text,'typed just before closing');
const crashStores=cloneStores(sharedStores,{copyArea:true});
const recovered=createHarness(sharedLocal,crashStores);await recovered.app.notes.load();
assert.equal(recovered.app.notes.get('area').text,'typed just before closing','the browser copy restores the unsaved edit');
await recovered.app.notes.flush({strict:true});
assert.equal(crashStores.area.get(areaId).text,'typed just before closing','the recovered edit becomes the stored note');
assert.equal(sharedLocal.has('areaNoteRescue'),false,'the browser copy is cleared once saved');
assert.equal(recovered.app.notes.protectUnsaved(),true);assert.equal(sharedLocal.has('areaNoteRescue'),false,'hiding with nothing unsaved writes no copy');

// A stale browser copy that storage already matches is dropped on load.
sharedLocal.set('areaNoteRescue',{format:'study-director.area-note-rescue',version:1,updatedAt:new Date().toISOString(),entries:{[areaId]:structuredClone(crashStores.area.get(areaId))}});
const staleRescue=createHarness(sharedLocal,crashStores);await staleRescue.app.notes.load();
assert.equal(sharedLocal.has('areaNoteRescue'),false,'a copy identical to storage is removed');

// Clearing content is a durable empty note, not an implicit deletion.
const emptyRevision=recovered.app.notes.get('area').updatedAt,emptied=recovered.app.notes.update('area','Area','',emptyRevision);assert.equal(emptied.status,'changed');
recovered.app.notes.protectUnsaved();
assert.notEqual(rescueFor(sharedLocal,areaId).deleted,true,'a blank edit is kept as an empty note, never as a deletion');
const emptyLocal=new Map([...sharedLocal].map(([key,value])=>[key,structuredClone(value)]));
const staleAuthoritative=cloneStores(crashStores,{copyArea:true});
const emptyRecovered=createHarness(emptyLocal,staleAuthoritative);await emptyRecovered.app.notes.load();assert.equal(emptyRecovered.app.notes.get('area').text,'','the empty note shadows older stored text');await emptyRecovered.app.notes.flush({strict:true});
assert.equal(staleAuthoritative.area.get(areaId).text,'','the recovered empty note is stored');
assert.equal(emptyRecovered.app.notes.exportPayload()[areaId].text,'','backups keep intentional empty notes');
assert.equal(emptyRecovered.app.notes.metadataSnapshot().records.find(record=>record.key==='area').hasNote,false,'an empty note stays listed but muted');
assert.equal(emptyRecovered.app.notes.searchSnapshot().documents.some(record=>record.key==='area'),false,'empty notes stay out of search');
assert.equal(await emptyRecovered.app.notes.remove('area'),true,'explicit remove stays the deletion path');
assert.equal(staleAuthoritative.area.has(areaId),false,'explicit remove deletes the stored note');
await recovered.app.notes.flush({strict:true});

// A reload while an edit waits for its save keeps the edit.
const reloadLocal=new Map(),reloadStores=emptyStores();
const reloading=createHarness(reloadLocal,reloadStores);await reloading.app.notes.load();
reloading.app.notes.update('reload','Reload','saved','');await reloading.app.notes.flush({strict:true});
reloading.app.notes.update('reload','Reload','typed during reload',reloading.app.notes.get('reload').updatedAt);
await reloading.app.notes.reloadFresh();
assert.equal(reloading.app.notes.get('reload').text,'typed during reload','a reload never replaces an unsaved edit');
await reloading.app.notes.flush({strict:true});assert.equal(storedNote(reloadStores.area,'reload').text,'typed during reload');

// A failed save keeps the newest text in the browser copy until a later
// instance stores it.
const failureLocal=new Map(),failureStores=emptyStores(),failureControls={failNextAreaWrite:false};
const failureBase=noteRow('Failure','stable','2026-09-04T04:00:00.000Z');failureStores.area.set(failureBase.key,structuredClone(failureBase));
const failing=createHarness(failureLocal,failureStores,failureControls);await failing.app.notes.load();failureControls.failNextAreaWrite=true;
const failedEdit=failing.app.notes.update('failure','Failure','latest-before-failure',failureBase.updatedAt);assert.equal(failedEdit.status,'changed');
await assert.rejects(()=>failing.app.notes.flush({strict:true}),/could not be saved|safely stored/,'a strict flush rejects when the save fails');
assert.equal(failureStores.area.get(failureBase.key).text,'stable');assert.equal(rescueFor(failureLocal,failureBase.key).text,'latest-before-failure','a failed save keeps the newest text in the browser copy');assert.equal(failing.app.notes.failure().failed,true);
const failureRecovered=createHarness(failureLocal,failureStores);await failureRecovered.app.notes.load();assert.equal(failureRecovered.app.notes.get('failure').text,'latest-before-failure');await failureRecovered.app.notes.flush({strict:true});
assert.equal(failureStores.area.get(failureBase.key).text,'latest-before-failure');assert.equal(failureLocal.has('areaNoteRescue'),false);
// The same tab recovers on its next successful save.
failureControls.failNextAreaWrite=true;failing.app.notes.update('failure','Failure','second attempt',failing.app.notes.get('failure').updatedAt);
await assert.rejects(()=>failing.app.notes.flush({strict:true}));
await failing.app.notes.flush({strict:true}).catch(()=>{});
assert.equal(failing.app.notes.failure().failed,false,'a later successful save clears the failure');assert.equal(failureLocal.has('areaNoteRescue'),false);

// A clash with a newer stored revision keeps the stored note and the local
// text as its own note.
const conflictLocal=new Map(),conflictStores=emptyStores();
const conflictBase=noteRow('Conflict','base','2026-09-04T04:10:00.000Z');conflictStores.area.set(conflictBase.key,structuredClone(conflictBase));const conflicting=createHarness(conflictLocal,conflictStores);await conflicting.app.notes.load();const localConflictEdit=conflicting.app.notes.update('conflict','Conflict','local-dirty',conflictBase.updatedAt);assert.equal(localConflictEdit.status,'changed');conflictStores.area.set(conflictBase.key,{...structuredClone(conflictBase),text:'remote-newer',updatedAt:'2026-09-04T04:10:01.000Z'});await conflicting.app.notes.flush({strict:true});assert.equal(conflicting.app.notes.get('conflict').text,'remote-newer');assert.equal(conflictStores.area.get(conflictBase.key).text,'remote-newer');assert.equal(storedNote(conflictStores.area,'conflict (unsaved copy)')?.text,'local-dirty');assert.equal(conflictLocal.has('areaNoteRescue'),false);

// The browser copy holds every unsaved note, the newest first while it fits.
const scopedLocal=new Map([['areaNoteRescue',{format:'study-director.area-note-rescue',version:1,updatedAt:'2026-09-04T04:20:01.000Z',entries:{[noteId('foreign')]:noteRow('Foreign','from an earlier session','2026-09-04T04:20:00.000Z')}}]]),scopedStores=emptyStores(),scopedControls={failNextAreaWrite:true};
const scoped=createHarness(scopedLocal,scopedStores,scopedControls);await scoped.app.notes.load();
scoped.app.notes.update('local','Local','local-dirty','');await scoped.app.notes.flush().catch(()=>{});
assert.deepEqual(Object.keys(scopedLocal.get('areaNoteRescue').entries).sort(),[noteId('foreign'),scoped.app.notes.get('local').id].sort(),'a failed save keeps earlier unsaved notes in the copy');
await scoped.app.notes.flush({strict:true});
assert.equal(scopedStores.area.get(noteId('foreign')).text,'from an earlier session');assert.equal(storedNote(scopedStores.area,'local').text,'local-dirty');assert.equal(scopedLocal.has('areaNoteRescue'),false);

// A note larger than the browser copy still saves normally; hiding reports
// that the copy cannot hold it.
const largeLocal=new Map(),largeStores=emptyStores();
const large=createHarness(largeLocal,largeStores);await large.app.notes.load();
const largeText='WG1:'+JSON.stringify({version:1,doc:{type:'Doc',content:[{type:'Paragraph',content:[{type:'Text',param:'x'.repeat(1100*1024)}]}]}});
assert.equal(large.app.notes.updateValidatedRich('large','Large',largeText,'').status,'changed');
assert.equal(large.app.notes.protectUnsaved(),false,'a note over the copy limit is reported');
await large.app.notes.flush({strict:true});assert.equal(storedNote(largeStores.area,'large').text,largeText,'the database stores it in full');

// The emergency copies share one browser-storage budget: a large session copy
// leaves less room for unsaved notes, and an unreadable session copy leaves none.
const budgetLocal=new Map(),budgetControls={},budget=createHarness(budgetLocal,emptyStores(),budgetControls);await budget.app.notes.load();
const mediumText='WG1:'+JSON.stringify({version:1,doc:{type:'Doc',content:[{type:'Paragraph',content:[{type:'Text',param:'y'.repeat(600*1024)}]}]}});
assert.equal(budget.app.notes.updateValidatedRich('medium','Medium',mediumText,'').status,'changed');
assert.equal(budget.app.notes.protectUnsaved(),true,'a note within its share is kept');
budgetLocal.set('recovery','s'.repeat(3.6*1024*1024));
assert.equal(budget.app.notes.protectUnsaved(),false,'the session copy comes first');assert.equal(budgetLocal.get('areaNoteRescue').entries[budget.app.notes.get('medium').id].text,mediumText,'the earlier copy is never overwritten by a smaller one');
budgetLocal.delete('recovery');budgetControls.failLocalGetKeys=new Set(['recovery']);
assert.equal(budget.app.notes.protectUnsaved(),false,'an unreadable copy is not counted as empty');budgetControls.failLocalGetKeys=null;
assert.equal(budget.app.notes.protectUnsaved(),true);

// Startup gives an earlier version's name-keyed rows, journal rows and
// deletion records permanent ids, then folds the journal rows and v1
// localStorage payload into the stored notes once, the newer revision winning,
// and removes them.
const legacyEntry={key:'legacy',label:'Legacy',text:'legacy-unsaved',updatedAt:'2026-09-04T05:00:00.000Z',entityType:'areaNote',entityId:'legacy',schemaVersion:1,deviceId:'dev_legacy',createdAt:'2026-09-04T05:00:00.000Z',deleted:false,syncStatus:'pending'};
const journalRow=(key,entry,updatedAt)=>[`areaNoteRecovery.v1:${key}`,{key:`areaNoteRecovery.v1:${key}`,version:1,value:{format:'study-director.area-note-recovery',version:1,key,entry,updatedAt},updatedAt}];
const legacyLocal=new Map([['pending',{version:1,updatedAt:'2026-09-04T05:00:01.000Z',pending:{legacy:structuredClone(legacyEntry)}}]]),legacyStores=emptyStores();
legacyStores.area.set('journaled',{version:2,key:'journaled',label:'Journaled',text:'stored',updatedAt:'2026-09-04T05:00:00.000Z'});
legacyStores.area.set('outdated',{version:2,key:'outdated',label:'Outdated',text:'stored newer',updatedAt:'2026-09-04T05:10:00.000Z'});
legacyStores.area.set('removed',{version:2,key:'removed',label:'Removed',text:'deleted in the journal',updatedAt:'2026-09-04T05:00:00.000Z'});
for(const [key,value] of [
  journalRow('journaled',{version:2,key:'journaled',label:'Journaled',text:'journaled newer',updatedAt:'2026-09-04T05:05:00.000Z'},'2026-09-04T05:05:00.000Z'),
  journalRow('outdated',{version:2,key:'outdated',label:'Outdated',text:'journaled older',updatedAt:'2026-09-04T05:05:00.000Z'},'2026-09-04T05:05:00.000Z'),
  journalRow('removed',{key:'removed',deleted:true,updatedAt:'2026-09-04T05:05:00.000Z'},'2026-09-04T05:05:00.000Z'),
  journalRow('later-deleted',{version:2,key:'later-deleted',label:'Later deleted',text:'edit before deletion',updatedAt:'2026-09-04T05:00:00.000Z'},'2026-09-04T05:00:00.000Z'),
  ['areaNoteDeletion:later-deleted',{key:'areaNoteDeletion:later-deleted',version:1,value:{format:'study-director.area-note-deletion',version:1,key:'later-deleted',deletedAt:'2026-09-04T05:01:00.000Z'},updatedAt:'2026-09-04T05:01:00.000Z'}]
])legacyStores.meta.set(key,value);
const legacy=createHarness(legacyLocal,legacyStores);
assert.equal((await legacy.app.compatibility.migrateAreaNotes()).status,'migrated','name-keyed notes take their ids first');
const folded=await legacy.app.compatibility.migrateAreaNoteRecovery();assert.equal(folded.status,'migrated');
assert.equal(legacyStores.area.get(noteId('legacy')).text,'legacy-unsaved','the v1 localStorage payload is stored');
assert.equal(legacyStores.area.get(noteId('journaled')).text,'journaled newer','a newer journal entry is stored');
assert.equal(legacyStores.area.get(noteId('outdated')).text,'stored newer','a newer stored note is kept');
assert.equal(legacyStores.area.has(noteId('removed')),false,'a newer journal deletion is applied');assert.ok(legacyStores.meta.has(`areaNoteDeletion:${noteId('removed')}`),'the deletion is recorded');
assert.equal(legacyStores.area.has(noteId('later-deleted')),false,'a note deleted after the journaled edit stays deleted');
assert.equal([...legacyStores.area.keys()].every(key=>/^n_[0-9a-f]{16}$/u.test(key)),true,'no name-keyed row remains');
assert.equal(journalRows(legacyStores).length,0,'every journal row is removed');assert.equal(legacyLocal.has('pending'),false,'the v1 payload is removed');
assert.equal((await legacy.app.compatibility.verifyAreaNoteRecovery()).ok,true);
assert.equal((await legacy.app.compatibility.migrateAreaNoteRecovery()).status,'not-needed');
await legacy.app.notes.load();assert.equal(legacy.app.notes.get('journaled').text,'journaled newer');
legacyStores.meta.set(...journalRow('residue',{version:2,key:'residue',label:'Residue',text:'left behind',updatedAt:'2026-09-04T05:00:00.000Z'},'2026-09-04T05:00:00.000Z'));
assert.deepEqual([...(await legacy.app.compatibility.verifyAreaNoteRecovery()).issues],['area-note-recovery-residue'],'verification reports journal rows that remain');

console.log(JSON.stringify({status:'PASS',rapidEdits:100,uniqueRapidRevisions:new Set(revisions).size,browserCopyWritesWhileSaving:first.localWrites.all,clockSkewSafe:true,closeRecovered:true,staleCopyDropped:true,emptyRecovered:true,explicitDelete:true,reloadKeepsEdit:true,failedWriteRecovered:true,conflictCopyKept:true,unsavedSetCopied:true,largeNoteSaved:Buffer.byteLength(largeText),legacyFolded:true,validatedRichFastPath:true,canonicalNoOpFastPath:true},null,2));
