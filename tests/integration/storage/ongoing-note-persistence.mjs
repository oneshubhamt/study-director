import assert from 'node:assert/strict';
import {createHarness} from '../../helpers/repository-harness.mjs';
import {createFakeClock} from '../../helpers/fake-clock.mjs';

// Ongoing Notes are first-class documents: an accepted edit is never replaced by
// an older stored revision, storage that vanished underneath an open tab is
// rewritten from memory, and the losing side of a genuine conflict stays
// recoverable until the user applies or discards it.
async function setup(){
  const clock=createFakeClock('2026-09-15T12:00:00.000Z'),controls={clock},h=createHarness(new Map(),null,controls);
  h.stores.meta.set('dailyRecordMigration',{key:'dailyRecordMigration',version:1,value:{recordVersion:1,summaryVersion:1,complete:true,recordCount:0},updatedAt:'2026-09-15T12:00:00.000Z'});
  await h.app.notes.load();
  return {clock,controls,...h};
}
const settle=async clock=>{await clock.runAll();await clock.drainMicrotasks(64);};
const conflictRows=stores=>[...stores.meta.entries()].filter(([key])=>key.startsWith('areaNoteConflict.v1:')).map(([,row])=>row.value);
function clearSiteData(stores){for(const map of Object.values(stores))map.clear();}

// 1. A save batch queued while an earlier batch for the same note is still
// committing must not mistake that earlier commit for a competing edit.
{
  const {app,stores,clock}=await setup();
  app.notes.update('economics','Economics','first','');
  await clock.advance(1000);
  const second=app.notes.update('economics','Economics','second',app.notes.get('economics').updatedAt);
  assert.equal(second.status,'changed');
  await settle(clock);
  assert.equal(app.notes.get('economics').text,'second','the newer accepted edit must remain in memory');
  assert.equal(stores.area.get('economics').text,'second','the newer accepted edit must reach storage');
  assert.deepEqual(conflictRows(stores),[],'sequential batches from one tab are not a conflict');
  assert.equal((await app.notes.conflicts()).length,0);
}

// 2. Clearing browser data removes rows without deletion records. An edit to a
// note this tab still holds is stored again instead of being discarded.
{
  const {app,stores,clock}=await setup();
  app.notes.update('ethics','Ethics','before clearing','');await app.notes.flush({strict:true});
  app.notes.update('history','History','untouched survivor','');await app.notes.flush({strict:true});
  await clock.advance(2000);
  clearSiteData(stores);
  const edit=app.notes.update('ethics','Ethics','written after clearing',app.notes.get('ethics').updatedAt);
  assert.equal(edit.status,'changed');
  await app.notes.flush({strict:true});
  assert.equal(app.notes.get('ethics').text,'written after clearing');
  assert.equal(stores.area.get('ethics').text,'written after clearing','a vanished row is rewritten, not treated as a newer decision');
  // A fresh reload must not wipe notes that survived only in memory.
  assert.equal(await app.notes.reloadFresh(),true);
  assert.equal(app.notes.get('history')?.text,'untouched survivor','a reload after clearing keeps the in-memory survivor');
  await app.notes.flush({strict:true});
  assert.equal(stores.area.get('history')?.text,'untouched survivor','the survivor is written back to storage');
  assert.deepEqual(conflictRows(stores),[]);
}

// 3. The explicit storage-loss signal rewrites every note even after another
// write has already re-created the database's mutation epoch.
{
  const {app,stores,clock}=await setup();
  app.notes.update('alpha','Alpha','alpha text','');app.notes.update('beta','Beta','beta text','');
  await app.notes.flush({strict:true});await clock.advance(2000);
  clearSiteData(stores);
  stores.meta.set('canonicalMutationEpoch.v1',{key:'canonicalMutationEpoch.v1',version:1,value:{format:'study-director.canonical-mutation-epoch',version:1,token:'a'.repeat(32),committedAt:'2026-09-15T12:00:02.000Z'},updatedAt:'2026-09-15T12:00:02.000Z'});
  assert.equal(await app.notes.recoverAfterStorageLoss(),true);
  assert.equal(stores.area.get('alpha')?.text,'alpha text');
  assert.equal(stores.area.get('beta')?.text,'beta text');
  assert.deepEqual(conflictRows(stores),[],'a storage-loss rewrite does not manufacture conflict copies');
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
  assert.equal(stores.area.get('gamma')?.text,'edited while clearing','the strict flush rewrites the surviving note');
}

// 5. A genuine competing revision keeps the stored winner and preserves the
// losing text, with its ancestor, as a durable conflict copy.
{
  const {app,stores,clock}=await setup();
  app.notes.update('physics','Physics','shared start','');await app.notes.flush({strict:true});await clock.advance(2000);
  app.notes.update('physics','Physics','shared start + local line',app.notes.get('physics').updatedAt);
  stores.area.set('physics',{version:2,key:'physics',label:'Physics',text:'shared start + remote line',updatedAt:'2026-09-15T12:00:05.000Z'});
  await app.notes.flush();await settle(clock);
  assert.equal(app.notes.get('physics').text,'shared start + remote line','the stored winner is kept');
  assert.equal(stores.area.get('physics').text,'shared start + remote line','the stored winner is never overwritten');
  const [copy]=await app.notes.conflicts();
  assert.equal(copy.key,'physics');assert.equal(copy.text,'shared start + local line','the losing text is preserved');
  assert.equal(copy.ancestor,'shared start','the common ancestor supports a three-way review');
  assert.equal(copy.storedRevision,'2026-09-15T12:00:05.000Z');
  assert.equal([...stores.meta.keys()].some(key=>key.startsWith('areaNoteRecovery.v1:physics')),false,'the recovery journal retires only after the copy is durable');
  const resolved=await app.notes.resolveConflict('physics','shared start + remote line + local line',copy.createdAt);
  assert.equal(resolved.status,'changed');
  assert.equal(stores.area.get('physics').text,'shared start + remote line + local line');
  assert.deepEqual(conflictRows(stores),[],'applying the reviewed text retires the copy');
}

// 6. A note deleted elsewhere (deletion record present) is not resurrected; the
// edit made here is preserved for review instead.
{
  const {app,stores,clock}=await setup();
  app.notes.update('chemistry','Chemistry','to be deleted elsewhere','');await app.notes.flush({strict:true});await clock.advance(2000);
  app.notes.update('chemistry','Chemistry','edited here',app.notes.get('chemistry').updatedAt);
  stores.area.delete('chemistry');
  stores.meta.set('areaNoteDeletion.v1:chemistry',{key:'areaNoteDeletion.v1:chemistry',version:1,value:{format:'study-director.area-note-deletion',version:1,key:'chemistry',deletedAt:'2026-09-15T12:00:03.000Z'},updatedAt:'2026-09-15T12:00:03.000Z'});
  await app.notes.flush();await settle(clock);
  assert.equal(stores.area.has('chemistry'),false,'a recorded deletion wins over a stale edit');
  assert.equal(app.notes.get('chemistry'),null);
  assert.equal((await app.notes.conflicts())[0]?.text,'edited here','the stale edit remains recoverable');
}

// 7. A stale editor binding is rejected, but its text is kept. Discarding with
// an outdated identity never removes a newer copy.
{
  const {app,stores,clock}=await setup();
  app.notes.update('biology','Biology','current text','');await app.notes.flush({strict:true});await clock.advance(2000);
  const rejected=app.notes.update('biology','Biology','typed in a stale editor','2026-01-01T00:00:00.000Z');
  assert.equal(rejected.status,'conflict');
  await settle(clock);
  const [first]=await app.notes.conflicts();
  assert.equal(first.text,'typed in a stale editor');
  assert.equal(app.notes.get('biology').text,'current text','the stored note is unchanged');
  await clock.advance(1000);
  app.notes.update('biology','Biology','typed again in the stale editor','2026-01-01T00:00:00.000Z');await settle(clock);
  assert.equal(await app.notes.discardConflict('biology',first.createdAt),false,'an outdated identity cannot discard the newer copy');
  const [newer]=await app.notes.conflicts();
  assert.equal(newer.text,'typed again in the stale editor');
  assert.equal(await app.notes.discardConflict('biology',newer.createdAt),true);
  assert.deepEqual(conflictRows(stores),[]);
}

console.log(JSON.stringify({status:'PASS',suite:'ongoing-note-persistence',contracts:[
  'queued batches use the revision committed by the earlier batch',
  'rows lost to a browser data clear are rewritten from memory',
  'reloads keep in-memory survivors of a data clear',
  'strict flush self-heals after storage loss',
  'genuine conflicts keep the stored winner and a durable copy with its ancestor',
  'recorded deletions are not resurrected',
  'stale editor text is preserved and identity-fenced on discard'
]},null,2));
