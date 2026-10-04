import assert from 'node:assert/strict';
import {createHarness} from '../../helpers/repository-harness.mjs';
import {createFakeClock} from '../../helpers/fake-clock.mjs';

// Ongoing Notes are first-class documents: an accepted edit is never replaced by
// an older stored revision, and storage that vanished underneath an open tab is
// rewritten from memory. No extra persisted state is involved.
async function setup(){
  const clock=createFakeClock('2026-09-15T12:00:00.000Z'),reports=[],controls={clock,onNoteConflict:info=>reports.push(info)},h=createHarness(new Map(),null,controls);
  h.stores.meta.set('dailyRecordMigration',{key:'dailyRecordMigration',version:1,value:{recordVersion:1,summaryVersion:1,complete:true,recordCount:0},updatedAt:'2026-09-15T12:00:00.000Z'});
  await h.app.notes.load();
  return {clock,controls,reports,...h};
}
const settle=async clock=>{await clock.runAll();await clock.drainMicrotasks(64);};
function clearSiteData(stores){for(const map of Object.values(stores))map.clear();}

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
  assert.equal(stores.area.get('economics').text,'second','the newer accepted edit must reach storage');
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
  assert.equal(stores.area.get('ethics').text,'written after clearing','a vanished row is rewritten, not treated as a newer decision');
  // A fresh reload must not wipe notes that survived only in memory.
  assert.equal(await app.notes.reloadFresh(),true);
  assert.equal(app.notes.get('history')?.text,'untouched survivor','a reload after clearing keeps the in-memory survivor');
  await app.notes.flush({strict:true});
  assert.equal(stores.area.get('history')?.text,'untouched survivor','the survivor is written back to storage');
  assert.deepEqual(reports,[],'storage loss is not a conflict');
}

// 3. The explicit storage-loss signal rewrites every note even after another
// write has already re-created the database's mutation epoch.
{
  const {app,stores,clock,reports}=await setup();
  app.notes.update('alpha','Alpha','alpha text','');app.notes.update('beta','Beta','beta text','');
  await app.notes.flush({strict:true});await clock.advance(2000);
  clearSiteData(stores);
  stores.meta.set('canonicalMutationEpoch.v1',{key:'canonicalMutationEpoch.v1',version:1,value:{format:'study-director.canonical-mutation-epoch',version:1,token:'a'.repeat(32),committedAt:'2026-09-15T12:00:02.000Z'},updatedAt:'2026-09-15T12:00:02.000Z'});
  assert.equal(await app.notes.recoverAfterStorageLoss(),true);
  assert.equal(stores.area.get('alpha')?.text,'alpha text');
  assert.equal(stores.area.get('beta')?.text,'beta text');
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
  assert.equal(stores.area.get('gamma')?.text,'edited while clearing','the strict flush rewrites the surviving note');
}

// 5. The storage-loss rule never overrides a row that exists or a recorded
// deletion: those keep the original fail-safe (stored version wins).
{
  const {app,stores,clock,reports}=await setup();
  app.notes.update('physics','Physics','shared start','');await app.notes.flush({strict:true});await clock.advance(2000);
  app.notes.update('physics','Physics','local line',app.notes.get('physics').updatedAt);
  stores.area.set('physics',{version:2,key:'physics',label:'Physics',text:'stored line',updatedAt:'2026-09-15T12:00:05.000Z'});
  await app.notes.flush();await settle(clock);
  assert.equal(stores.area.get('physics').text,'stored line','an existing stored row is never overwritten by a stale revision');
  assert.equal(reports.length,1);
  app.notes.update('chemistry','Chemistry','to be deleted','');await app.notes.flush({strict:true});await clock.advance(2000);
  app.notes.update('chemistry','Chemistry','edited here',app.notes.get('chemistry').updatedAt);
  stores.area.delete('chemistry');
  stores.meta.set('areaNoteDeletion.v1:chemistry',{key:'areaNoteDeletion.v1:chemistry',version:1,value:{format:'study-director.area-note-deletion',version:1,key:'chemistry',deletedAt:'2026-09-15T12:00:03.000Z'},updatedAt:'2026-09-15T12:00:03.000Z'});
  await app.notes.flush();await settle(clock);
  assert.equal(stores.area.has('chemistry'),false,'a recorded deletion is not resurrected');
  assert.equal(reports.length,2);
}

console.log(JSON.stringify({status:'PASS',suite:'ongoing-note-persistence',contracts:[
  'queued batches use the revision committed by the earlier batch',
  'rows lost to a browser data clear are rewritten from memory',
  'reloads keep in-memory survivors of a data clear',
  'strict flush self-heals after storage loss',
  'existing rows and recorded deletions keep the stored-version fail-safe'
]},null,2));
