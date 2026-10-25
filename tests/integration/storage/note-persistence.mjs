import assert from 'node:assert/strict';
import {createHarness} from '../../helpers/repository-harness.mjs';
import {createFakeClock} from '../../helpers/fake-clock.mjs';
import {noteKeys,noteId,noteRow,storedNote} from '../../helpers/note-ids.mjs';

// Notes are first-class documents: an accepted edit is never replaced by
// an older stored revision, and storage that vanished underneath an open tab is
// rewritten from memory. No extra persisted state is involved.
async function setup(){
  const clock=createFakeClock('2026-09-15T12:00:00.000Z'),reports=[],controls={clock,onNoteConflict:info=>reports.push(info),onStorageRead:({store,key})=>{if(controls.failEpochRead&&store==='meta'&&key==='canonicalMutationEpoch')throw new Error('QA_FIXTURE metadata read failure');}},h=createHarness(new Map(),null,controls);
  h.stores.meta.set('dailyRecordMigration',{key:'dailyRecordMigration',version:1,value:{recordVersion:1,summaryVersion:1,complete:true,recordCount:0},updatedAt:'2026-09-15T12:00:00.000Z'});
  await h.app.notes.load();
  return {clock,controls,reports,...h};
}
const settle=async clock=>{await clock.runAll();await clock.drainMicrotasks(64);};
function clearSiteData(stores){for(const map of Object.values(stores))map.clear();}
// Any other write after a clear (for example the running timer's session save)
// stores a fresh canonical mutation epoch.
const recreateEpoch=stores=>stores.meta.set('canonicalMutationEpoch',{key:'canonicalMutationEpoch',version:1,value:{format:'study-director.canonical-mutation-epoch',version:1,token:'a'.repeat(32),committedAt:'2026-09-15T12:00:02.000Z'},updatedAt:'2026-09-15T12:00:02.000Z'});
const deletionRecord=key=>({key:`noteDeletion:${key}`,version:1,value:{format:'study-director.note-deletion',version:1,key,deletedAt:'2026-09-15T12:00:03.000Z'},updatedAt:'2026-09-15T12:00:03.000Z'});

// 1. A save batch queued while an earlier batch for the same note is still
// committing must not mistake that earlier commit for a competing edit.
{
  const {app,stores,clock,reports}=await setup();
  app.notes.update('economics','Economics','first','');
  await clock.advance(1000);
  const second=app.notes.update('economics','Economics','second',app.notes.get('economics').updatedAt);
  assert.equal(second.status,'changed');
  await settle(clock);
  assert.equal(app.notes.get('economics').text,'second','the newer accepted edit must remain in memory');
  assert.equal(storedNote(stores.area,'economics').text,'second','the newer accepted edit must reach storage');
  assert.deepEqual(reports,[],'sequential batches from one tab are not a conflict');
}

// 2. Clearing browser data removes rows without deletion records. An edit to a
// note this tab still holds is stored again instead of being discarded.
{
  const {app,stores,clock,reports}=await setup();
  app.notes.update('ethics','Ethics','before clearing','');await app.notes.flush({strict:true});
  app.notes.update('history','History','untouched survivor','');await app.notes.flush({strict:true});
  await clock.advance(2000);
  clearSiteData(stores);
  const edit=app.notes.update('ethics','Ethics','written after clearing',app.notes.get('ethics').updatedAt);
  assert.equal(edit.status,'changed');
  await app.notes.flush({strict:true});
  assert.equal(app.notes.get('ethics').text,'written after clearing');
  assert.equal(storedNote(stores.area,'ethics').text,'written after clearing','a vanished row is rewritten, not treated as a newer decision');
  // A fresh reload must not wipe notes that survived only in memory.
  assert.equal(await app.notes.reloadFresh(),true);
  assert.equal(app.notes.get('history')?.text,'untouched survivor','a reload after clearing keeps the in-memory survivor');
  await app.notes.flush({strict:true});
  assert.equal(storedNote(stores.area,'history')?.text,'untouched survivor','the survivor is written back to storage');
  assert.deepEqual(reports,[],'storage loss is not a conflict');
}

// 3. The explicit storage-loss signal rewrites every note even after another
// write has already re-created the database's mutation epoch.
{
  const {app,stores,clock,reports}=await setup();
  app.notes.update('alpha','Alpha','alpha text','');app.notes.update('beta','Beta','beta text','');
  await app.notes.flush({strict:true});await clock.advance(2000);
  clearSiteData(stores);recreateEpoch(stores);
  assert.equal(await app.notes.recoverAfterStorageLoss(),true);
  assert.equal(storedNote(stores.area,'alpha')?.text,'alpha text');
  assert.equal(storedNote(stores.area,'beta')?.text,'beta text');
  assert.deepEqual(reports,[],'a storage-loss rewrite does not manufacture conflicts');
}

// 4. A save that failed while storage was disappearing is recovered by the
// strict flush that restore/update preparation requires.
{
  const {app,stores,clock,controls}=await setup();
  app.notes.update('gamma','Gamma','kept through the failure','');await app.notes.flush({strict:true});await clock.advance(2000);
  controls.failNextAreaWrite=true;
  app.notes.update('gamma','Gamma','edited while clearing',app.notes.get('gamma').updatedAt);
  await app.notes.flush();
  assert.equal(app.notes.failure().failed,true,'the injected write failure is visible');
  clearSiteData(stores);
  await app.notes.flush({strict:true});
  assert.equal(app.notes.failure().failed,false);
  assert.equal(storedNote(stores.area,'gamma')?.text,'edited while clearing','the strict flush rewrites the surviving note');
}

// 5. The storage-loss rule never overrides a row that exists or a recorded
// deletion: the stored version wins, and the local text is kept as its own note.
{
  const {app,stores,clock,reports}=await setup();
  app.notes.update('physics','Physics','shared start','');await app.notes.flush({strict:true});await clock.advance(2000);
  app.notes.update('physics','Physics','local line',app.notes.get('physics').updatedAt);
  const physicsId=app.notes.get('physics').id;stores.area.set(physicsId,{version:3,key:physicsId,label:'Physics',text:'stored line',updatedAt:'2026-09-15T12:00:05.000Z'});
  await app.notes.flush();await settle(clock);
  assert.equal(storedNote(stores.area,'physics').text,'stored line','an existing stored row is never overwritten by a stale revision');
  assert.equal(reports.length,1);
  app.notes.update('chemistry','Chemistry','to be deleted','');await app.notes.flush({strict:true});await clock.advance(2000);
  app.notes.update('chemistry','Chemistry','edited here',app.notes.get('chemistry').updatedAt);
  const chemistryId=app.notes.get('chemistry').id;
  stores.area.delete(chemistryId);
  stores.meta.set(`noteDeletion:${chemistryId}`,deletionRecord(chemistryId));
  await app.notes.flush();await settle(clock);
  assert.equal(stores.area.has(chemistryId),false,'a recorded deletion is not resurrected');
  assert.equal(reports.length,2);
  await app.notes.flush({strict:true});
  assert.equal(storedNote(stores.area,'physics (unsaved copy)')?.text,'local line','the rejected edit is kept as its own note');
  assert.equal(storedNote(stores.area,'chemistry (unsaved copy)')?.text,'edited here');
  assert.deepEqual(reports.map(report=>report.copyLabel),['Physics (unsaved copy)','Chemistry (unsaved copy)'],'the notice names the kept copy');
}

// 6. The database layer counts a clear the moment it reopens storage. An edit
// made before the app's own handler runs, after another write already stored a
// fresh epoch, is rewritten rather than treated as a clash.
{
  const {app,stores,clock,controls,reports}=await setup();
  app.notes.update('anatomy','Anatomy','before clearing','');await app.notes.flush({strict:true});await clock.advance(2000);
  clearSiteData(stores);recreateEpoch(stores);controls.storageResets=1;
  assert.equal(app.notes.update('anatomy','Anatomy','edited after clearing',app.notes.get('anatomy').updatedAt).status,'changed');
  await app.notes.flush();await settle(clock);
  assert.equal(storedNote(stores.area,'anatomy')?.text,'edited after clearing');assert.equal(app.notes.get('anatomy')?.text,'edited after clearing');
  assert.deepEqual(reports,[],'a counted clear is storage loss, not a clash');
  assert.equal(await app.notes.recoverAfterStorageLoss(),true);
  // Once written back, a row removed without a deletion record is a clash again.
  stores.area.delete(app.notes.get('anatomy').id);
  app.notes.update('anatomy','Anatomy','after recovery',app.notes.get('anatomy').updatedAt);await app.notes.flush();await settle(clock);
  assert.equal(reports.length,1,'the clear is acknowledged after recovery');
  await app.notes.flush({strict:true});assert.equal(storedNote(stores.area,'anatomy (unsaved copy)')?.text,'after recovery','and the edit is still kept');
}

// 7. If a takeover reload cannot read metadata, it cannot tell a clear from a
// deletion made in another tab: it stops and keeps memory instead of guessing.
for(const failEpochRead of [false,true]){
  const {app,stores,clock,controls}=await setup();
  app.notes.update('ethics','Ethics','deleted in another tab','');await app.notes.flush({strict:true});await clock.advance(2000);
  const ethicsId=app.notes.get('ethics').id;stores.area.delete(ethicsId);stores.meta.set(`noteDeletion:${ethicsId}`,deletionRecord(ethicsId));
  controls.failEpochRead=failEpochRead;
  if(failEpochRead)await assert.rejects(()=>app.notes.reloadFresh(),/could not confirm what storage still holds/);
  else assert.equal(await app.notes.reloadFresh(),true);
  controls.failEpochRead=false;await app.notes.flush();await settle(clock);
  assert.equal(stores.area.has(ethicsId),false,'the deleted note is not written back');
  assert.ok(stores.meta.has(`noteDeletion:${ethicsId}`),'the deletion record survives');
  if(!failEpochRead)assert.equal(app.notes.get('ethics'),null,'a healthy reload adopts the deletion');
  else{assert.equal(app.notes.get('ethics')?.text,'deleted in another tab','memory is left as it was');assert.equal(await app.notes.reloadFresh(),true);assert.equal(app.notes.get('ethics'),null,'a later reload adopts the deletion');}
}

// 9. Deleting moves a note to Recently deleted: an ordinary row under its id
// behind a reserved prefix, written in one transaction with the deletion record
// for its id. The title is free at once; restore puts the note back with its id,
// under its title or beside a newer note.
{
  const {app,stores,clock}=await setup();
  app.notes.update('gs2 > polity','GS2 > Polity','fundamental rights','');await app.notes.flush({strict:true});
  const polityId=app.notes.get('gs2 > polity').id;
  const trashKey=await app.notes.trash('gs2 > polity');
  assert.equal(trashKey,noteKeys.trash(polityId),'the trash key is the note’s id behind the reserved prefix');
  assert.equal(stores.area.has(polityId),false,'the live row is gone');
  assert.equal(stores.area.get(trashKey).text,'fundamental rights','the text is kept in the same store');
  assert.equal(stores.area.get(trashKey).label,'GS2 > Polity','the original name is kept');
  assert.ok(stores.meta.has(`noteDeletion:${polityId}`),'the note is recorded as deleted for Combine');
  assert.equal(stores.meta.has(`noteDeletion:${trashKey}`),false,'trash rows get no deletion record');
  assert.equal(app.notes.metadataSnapshot().records.some(record=>record.key===trashKey),false,'trash is not listed with live notes');
  assert.equal(app.notes.searchSnapshot().documents.some(record=>record.key===trashKey),false,'trash is not searched');
  assert.deepEqual(app.notes.trashSnapshot().map(item=>item.label),['GS2 > Polity']);
  assert.equal(app.notes.exportPayload()[trashKey].text,'fundamental rights','backups carry trash');
  assert.equal(app.notes.update(trashKey.toUpperCase(),'Fake','text','').status,'rejected','no live note can take a title that reads as a stored key');
  // Today's plan still uses the name: its blocks start a new note.
  assert.equal(app.notes.update('gs2 > polity','GS2 > Polity','new notes from today','').status,'changed');await app.notes.flush({strict:true});
  const restoredKey=await app.notes.restore(trashKey);
  assert.equal(restoredKey,'gs2 > polity (restored)','a name in use gets a "(restored)" note beside it');
  assert.equal(storedNote(stores.area,'gs2 > polity').text,'new notes from today','the newer note is untouched');
  assert.equal(storedNote(stores.area,restoredKey).text,'fundamental rights');assert.equal(storedNote(stores.area,restoredKey).key,polityId,'restore keeps the id');assert.equal(stores.area.has(trashKey),false);
  assert.equal(app.notes.trashSnapshot().length,0);
  // Restoring to a free name, and deleting forever.
  const again=await app.notes.trash(restoredKey);assert.equal(await app.notes.restore(again),restoredKey,'a free name is reused');
  const gone=await app.notes.trash(restoredKey);assert.equal(await app.notes.remove(gone),true);
  assert.equal(stores.area.has(gone),false);assert.equal(stores.meta.has(`noteDeletion:${gone}`),false,'deleting forever leaves no record');
  // An empty note is simply removed.
  app.notes.update('blank','Blank','x','');await app.notes.flush({strict:true});app.notes.update('blank','Blank','',app.notes.get('blank').updatedAt);await app.notes.flush({strict:true});
  assert.equal(await app.notes.trash('blank'),'','an empty note is removed without a trash entry');
  // Retention: after 30 days the next load removes it.
  const old=await app.notes.trash('gs2 > polity');assert.ok(old);
  await clock.advance(29*86400000);assert.equal(app.notes.trashSnapshot().length,1);
  await clock.advance(86400000+1000);assert.equal(app.notes.trashSnapshot().length,0,'expired trash is not shown');
  assert.equal(app.notes.purgeExpiredTrash(),1);await app.notes.flush({strict:true});
  assert.equal(stores.area.has(old),false,'expired trash is removed');assert.equal(stores.meta.has(`noteDeletion:${old}`),false);
}

// 10. Renaming moves a note with everything nested under it, in one
// transaction that changes only their titles: ids stay and nothing is recorded
// as deleted. A title that already holds text is merged only when asked.
{
  const {app,stores}=await setup();
  const write=async(key,label,text)=>{app.notes.update(key,label,text,app.notes.get(key)?.updatedAt||'');await app.notes.flush({strict:true});};
  await write('gs2','GS2','paper');await write('gs2 > polity','GS2 > Polity','constitution');await write('gs2 > polity > rights','GS2 > Polity > Rights','articles');await write('history','History','ancient');
  const familyIds=['gs2','gs2 > polity','gs2 > polity > rights'].map(title=>app.notes.get(title).id);
  const moved=await app.notes.rename('gs2','Paper 2');
  assert.equal(moved.status,'renamed');assert.deepEqual(Array.from(moved.moved,item=>item.to).sort(),['paper 2','paper 2 > polity','paper 2 > polity > rights']);
  assert.equal(storedNote(stores.area,'paper 2 > polity > rights').label,'Paper 2 > Polity > Rights','children keep their own names under the new parent');
  assert.equal(storedNote(stores.area,'paper 2 > polity').text,'constitution');
  assert.deepEqual(['paper 2','paper 2 > polity','paper 2 > polity > rights'].map(title=>app.notes.get(title).id),familyIds,'every moved note keeps its id');
  for(const title of ['gs2','gs2 > polity','gs2 > polity > rights'])assert.equal(storedNote(stores.area,title),undefined);
  assert.equal([...stores.meta.keys()].some(key=>key.startsWith('noteDeletion:')),false,'a rename records nothing as deleted');
  // A capitalisation change keeps the key and relabels the family.
  assert.equal((await app.notes.rename('paper 2','PAPER 2')).status,'renamed');assert.equal(storedNote(stores.area,'paper 2 > polity').label,'PAPER 2 > Polity');
  // Moving into itself is refused.
  assert.equal((await app.notes.rename('paper 2','Paper 2 > Polity > Deeper')).status,'inside-itself');
  // A taken name needs an explicit merge.
  await write('modern','Modern','colonial');const historyId=app.notes.get('history').id,modernId=app.notes.get('modern').id;
  const clash=await app.notes.rename('modern','History');
  assert.equal(clash.status,'collision');assert.deepEqual([...clash.labels],['History']);assert.equal(storedNote(stores.area,'modern').text,'colonial','nothing changes without a merge');
  const merged=await app.notes.rename('modern','History',{merge:(existing,moved)=>`${existing}\n${moved}`});
  assert.equal(merged.status,'renamed');assert.equal(merged.merged,1);
  assert.equal(stores.area.get(historyId).text,'ancient\ncolonial');assert.equal(stores.area.get(historyId).label,'History','the existing note keeps its name and id');
  assert.equal(stores.area.has(modernId),false);assert.ok(stores.meta.has(`noteDeletion:${modernId}`),'the note merged away is recorded as deleted');
  // A deeper note may take a name another moved note leaves.
  await write('ias > polity','IAS > Polity','A');await write('ias > polity > y','IAS > Polity > Y','B');await write('ias > polity > polity > y','IAS > Polity > Polity > Y','C');
  const up=await app.notes.rename('ias > polity','IAS');
  assert.equal(up.status,'renamed');
  assert.deepEqual(['ias','ias > y','ias > polity > y'].map(title=>storedNote(stores.area,title)?.text),['A','B','C']);
  assert.equal(storedNote(stores.area,'ias > polity'),undefined);assert.equal(storedNote(stores.area,'ias > polity > polity > y'),undefined);
}

// 11. A clash keeps this tab's version in the transaction that finds it: the
// stored version replaces it only once the copy is stored. Copy names never run
// out. At the note limit the oldest deleted note makes room; with none, nothing
// is replaced, the failure says so, and deleting a note lets the copy in.
{
  const put=(stores,entry)=>stores.area.set(entry.key,entry);
  const clash=async(app,stores,clock,key,label,mine,theirs)=>{
    app.notes.update(key,label,'shared',app.notes.get(key)?.updatedAt||'');await app.notes.flush({strict:true});await clock.advance(2000);
    app.notes.update(key,label,mine,app.notes.get(key).updatedAt);
    const id=app.notes.get(key).id;put(stores,{version:3,key:id,label,text:theirs,updatedAt:'2026-09-15T13:00:00.000Z'});
  };
  { // The write that finds the clash stores the copy; a crash right after loses nothing.
    const {app,stores,clock,reports}=await setup();
    await clash(app,stores,clock,'botany','Botany','mine','theirs');
    assert.equal(await app.notes.flush(),true,'one write settles the clash');
    assert.equal(storedNote(stores.area,'botany')?.text,'theirs');assert.equal(storedNote(stores.area,'botany (unsaved copy)')?.text,'mine','the copy is stored by the same transaction');
    assert.equal(reports.at(-1).copyLabel,'Botany (unsaved copy)');
    const reopened=createHarness(new Map(),stores,{clock});await reopened.app.notes.load();
    assert.equal(reopened.app.notes.get('botany').text,'theirs');assert.equal(reopened.app.notes.get('botany (unsaved copy)').text,'mine','both versions survive a crash after the clash');
  }
  { // Edits made while the clash is settled join the copy.
    const {app,stores,clock}=await setup();
    await clash(app,stores,clock,'geology','Geology','mine','theirs');
    const read=stores.area.get.bind(stores.area),geologyId=app.notes.get('geology').id;let typed=false;
    stores.area.get=key=>{if(key===geologyId&&!typed){typed=true;app.notes.update('geology','Geology','mine and more',app.notes.get('geology').updatedAt);}return read(key);};
    await app.notes.flush({strict:true});stores.area.get=read;
    assert.equal(typed,true);assert.equal(app.notes.get('geology').text,'theirs');
    assert.equal(storedNote(stores.area,'geology (unsaved copy)')?.text,'mine and more','the latest local text is stored with the copy');
  }
  { // Names never run out: past 99 numbered copies the name is stamped.
    const {app,stores,clock}=await setup();
    for(let index=1;index<100;index+=1){const label=`Zoology (unsaved copy${index>1?` ${index}`:''})`;put(stores,noteRow(label,`old copy ${index}`,'2026-09-15T11:00:00.000Z'));}
    await app.notes.reloadFresh();
    await clash(app,stores,clock,'zoology','Zoology','mine','theirs');await app.notes.flush({strict:true});
    const copies=[...stores.area.values()].filter(entry=>entry.label.toLowerCase().startsWith('zoology (unsaved copy'));
    assert.equal(copies.length,100);assert.equal(copies.filter(entry=>entry.text==='mine').length,1,'the copy got a stamped name');
    assert.match(copies.find(entry=>entry.text==='mine').label,/^Zoology \(unsaved copy [0-9a-z]{16}\)$/u);
    assert.equal(storedNote(stores.area,'zoology (unsaved copy 99)').text,'old copy 99','no stored note is replaced');
  }
  const oldTrash=noteKeys.trash(noteId('deleted first')),newerTrash=noteKeys.trash(noteId('deleted second'));
  const fill=(stores,count,trash=[])=>{for(const [index,key] of trash.entries())put(stores,{version:3,key,label:`Deleted ${index}`,text:`deleted ${index}`,updatedAt:`2026-09-15T11:0${index}:00.000Z`});for(let index=0;stores.area.size<count;index+=1)put(stores,noteRow(`filler ${index}`,'x','2026-09-15T11:00:00.000Z'));};
  { // At the limit the oldest deleted note makes room for the copy.
    const {app,stores,clock}=await setup();
    await clash(app,stores,clock,'ecology','Ecology','mine','theirs');fill(stores,1000,[oldTrash,newerTrash]);
    assert.equal(await app.notes.flush(),true);
    assert.equal(stores.area.size,1000,'the limit holds');assert.equal(stores.area.has(oldTrash),false,'the oldest deleted note made room');assert.equal(stores.area.has(newerTrash),true);
    assert.equal(storedNote(stores.area,'ecology (unsaved copy)')?.text,'mine');
  }
  { // Without room nothing is replaced; deleting a note lets the copy in.
    const {app,stores,clock,sharedLocal}=await setup();
    await clash(app,stores,clock,'ethics','Ethics','mine','theirs');fill(stores,1000);
    assert.equal(await app.notes.flush(),false,'the write reports failure');
    const ethicsId=app.notes.get('ethics').id;
    assert.equal(storedNote(stores.area,'ethics').text,'theirs');assert.equal(app.notes.get('ethics').text,'mine','this tab keeps its version');
    assert.equal(sharedLocal.get('noteRescue')?.entries?.[ethicsId]?.text,'mine','and the browser copy holds it');
    const clashFailure=app.notes.failure().message;
    assert.match(clashFailure,/Ethics changed in another tab, and notes are at the 1,000-note limit.*Delete a note to make room/u);
    await assert.rejects(app.notes.flush({strict:true}),/1,000-note limit/u,'a strict flush never reports it as saved');
    await app.notes.reloadFresh();assert.equal(app.notes.get('ethics').text,'mine','a reload keeps the unsaved version');
    const trashed=await app.notes.trash('filler 0');
    assert.ok(trashed,'another note can still be deleted');
    await app.notes.flush({strict:true});
    assert.equal(storedNote(stores.area,'ethics').text,'theirs');assert.equal(storedNote(stores.area,'ethics (unsaved copy)')?.text,'mine','the copy is stored once there is room');
    assert.equal(stores.area.size,1000);assert.equal(app.notes.failure().failed,false);assert.equal(sharedLocal.get('noteRescue')?.entries?.[ethicsId],undefined);
  }
}

// 12. Recently deleted shares the note limit but never blocks a note: the oldest
// deleted note gives way, in the same write. Live notes alone at the limit
// refuse a new note, and an import over it is refused whole. A browser copy
// too small for every unsaved note says which notes it could not keep.
{
  const row=(title,text)=>noteRow(title,text,'2026-09-15T11:00:00.000Z',title),put=entry=>stores.area.set(entry.key,entry);
  const {app,stores,clock,controls}=await setup();
  const oldTrash=noteKeys.trash(noteId('deleted first')),newerTrash=noteKeys.trash(noteId('deleted second'));
  put({version:3,key:oldTrash,label:'Deleted first',text:'old',updatedAt:'2026-09-15T11:00:00.000Z'});put({version:3,key:newerTrash,label:'Deleted second',text:'newer',updatedAt:'2026-09-15T11:01:00.000Z'});
  for(let index=0;stores.area.size<1000;index+=1)put(row(`filler ${index}`,'x'));
  await app.notes.reloadFresh();
  assert.equal(app.notes.update('new note','New note','text','').status,'changed','a full library with deleted notes still takes a new note');
  await app.notes.flush({strict:true});
  assert.equal(stores.area.size,1000);assert.equal(stores.area.has(oldTrash),false,'the oldest deleted note gave way');assert.equal(stores.area.has(newerTrash),true);
  assert.deepEqual(app.notes.trashSnapshot().map(item=>item.key),[newerTrash]);
  const imported=row('imported','in');assert.equal((await app.notes.reconcile({[imported.key]:imported}))[newerTrash],undefined,'an import at the limit drops the oldest deleted note');
  assert.equal(storedNote(stores.area,'imported')?.text,'in');assert.equal(stores.area.size,1000);
  assert.equal(app.notes.update('one too many','One too many','text','').status,'limit','live notes alone at the limit refuse a new note');
  const another=row('another','in');await assert.rejects(app.notes.reconcile({[another.key]:another}),error=>error.code==='NOTE_LIMIT','an import over the limit is refused whole');
  assert.equal(stores.area.has(another.key),false);

  // Rescue capacity: newest first, and the failure names what was left out.
  const big=char=>char.repeat(600*1024);
  controls.failNextAreaWrite=true;app.notes.update('filler 1','filler 1',big('a'),app.notes.get('filler 1').updatedAt);await clock.advance(5);
  const oneFits=app.notes.failure();assert.equal(oneFits.failed,true);assert.doesNotMatch(oneFits.message,/emergency copy/u,'one note fits');
  app.notes.update('filler 2','filler 2',big('b'),app.notes.get('filler 2').updatedAt);
  controls.failNextAreaWrite=true;assert.equal(await app.notes.flush(),false);
  assert.equal(app.notes.protectUnsaved(),false,'the browser copy cannot hold both');
  const failure=app.notes.failure().message;
  assert.match(failure,/The browser's emergency copy holds 1 MiB and could not keep filler 1, so closing this tab now would lose it\./u,'the failure names the note left out');
  await app.notes.flush({strict:true});assert.equal(app.notes.failure().failed,false,'a later save clears it');
}

// 13. A note's bar links other notes by id. The notes linking to one are
// worked out of bars and #note= links in text. Deleted notes drop out and come
// back with a restore; notes gone for good are dropped when the bar next changes.
{
  const {app,stores}=await setup();
  for(const [title,text] of [['heart','Heart failure'],['pharm','Pharmacology'],['ecg','ECG basics']])app.notes.update(title,title,text,'');
  await app.notes.flush({strict:true});
  const heart=app.notes.get('heart').id,pharm=app.notes.get('pharm').id,ecg=app.notes.get('ecg').id;
  assert.equal(app.notes.link('heart',pharm).status,'changed');assert.equal(app.notes.link(heart,ecg).status,'changed');
  assert.equal(app.notes.link('heart',pharm).status,'unchanged','a note is on a bar once');
  assert.equal(app.notes.link('heart',heart).status,'rejected','a note never links to itself');
  await app.notes.flush({strict:true});
  assert.deepEqual([...storedNote(stores.area,'heart').links],[pharm,ecg],'the bar is stored on the note, by id');
  assert.deepEqual(app.notes.linkedFrom('pharm').map(note=>note.label),['heart']);
  app.notes.update('ecg','ecg',`See #note=${pharm}`,app.notes.get('ecg').updatedAt);
  assert.deepEqual(app.notes.linkedFrom(pharm).map(note=>note.label),['ecg','heart'],'a link in the text counts too');
  // A title with no note yet gets one when its bar is filled.
  assert.equal(app.notes.link('fresh topic',pharm,{label:'Fresh topic'}).status,'changed');
  assert.deepEqual([...app.notes.get('fresh topic').links],[pharm]);assert.equal(app.notes.get('fresh topic').text,'');
  // Deleting keeps the bar in Recently deleted; restoring brings it back.
  const trashed=await app.notes.trash('heart');
  assert.deepEqual([...app.notes.exportPayload()[trashed].links],[pharm,ecg]);
  assert.equal(await app.notes.restore(trashed),'heart');assert.deepEqual([...app.notes.get('heart').links],[pharm,ecg]);
  // A linked note in Recently deleted stays on the bar, ready to come back; one deleted forever goes on the next change.
  const ecgTrash=await app.notes.trash('ecg');
  assert.deepEqual([...app.notes.get('heart').links],[pharm,ecg],'a deleted note keeps its place');
  await app.notes.remove(ecgTrash);
  assert.equal(app.notes.link('heart',pharm,{on:false}).status,'changed');
  assert.equal(app.notes.get('heart').links.length,0,'ids of notes gone for good are dropped');
  await app.notes.flush({strict:true});assert.equal('links' in storedNote(stores.area,'heart'),false,'an empty bar is not stored');
  // The record keeps the rules: ids only, never itself, no repeats.
  const record=app.notes.exportPayload()[pharm];
  for(const links of [[pharm],[heart,heart],['heart'],[]])assert.throws(()=>app.notes.normalizePayload({[pharm]:{...record,links}}),/canonical schema/u);
  assert.deepEqual([...app.notes.normalizePayload({[pharm]:{...record,links:[heart]}})[pharm].links],[heart]);
}

// 14. A backup note that takes this device's id (same title, made separately)
// keeps every link to it: other backup notes' bars and #note= text follow it.
{
  const {app}=await setup();
  app.notes.update('pharm','pharm','Local pharmacology','');await app.notes.flush({strict:true});
  const local=app.notes.get('pharm').id,remote='n_00000000000000aa',cardio='n_00000000000000bb',other='n_00000000000000cc';
  const at='2026-09-15T13:00:00.000Z',row=(key,label,text,links)=>({version:3,key,label,text,updatedAt:at,...(links?{links}:{})});
  const aligned=app.notes.alignByTitle({[remote]:row(remote,'pharm','Backup pharmacology'),
    [cardio]:row(cardio,'cardio',`See #note=${remote} and #note=${other}`,[remote,other]),[other]:row(other,'other','')});
  assert.deepEqual(Object.keys(aligned).sort(),[cardio,other,local].sort(),'the backup note takes the local id');
  assert.deepEqual([...aligned[cardio].links],[local,other],'the bar follows the moved note');
  assert.equal(aligned[cardio].text,`See #note=${local} and #note=${other}`,'so does the link in the text');
  await app.notes.reconcile(aligned);
  assert.deepEqual(app.notes.linkedFrom('pharm').map(note=>note.label),['cardio'],'the backlink survives the combine');
}

console.log(JSON.stringify({status:'PASS',suite:'note-persistence',contracts:[
  'queued batches use the revision committed by the earlier batch',
  'rows lost to a browser data clear are rewritten from memory',
  'reloads keep in-memory survivors of a data clear',
  'strict flush self-heals after storage loss',
  'existing rows and recorded deletions keep the stored-version fail-safe',
  'a clashing edit is kept as an unsaved-copy note',
  'a clear counted by the database layer protects edits before the handler runs',
  'an unreadable takeover check keeps memory and deletion records',
  'deleted notes go to Recently deleted, restore beside a newer note, and expire after 30 days',
  'rename changes only titles: a note and its children keep their ids; a taken title merges only when asked',
  'a clash stores its copy in the transaction that finds it; names never run out; the limit never drops either version',
  'Recently deleted gives way at the note limit; the rescue names notes it cannot hold',
  'a bar links notes by id; Linked from comes from bars and text; deletion keeps the bar and restore brings it back',
  'a backup note that takes a local id keeps the bars and text links that point to it'
]},null,2));
