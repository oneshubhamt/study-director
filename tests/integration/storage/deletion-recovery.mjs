import assert from 'node:assert/strict';
import {createHarness} from '../../helpers/repository-harness.mjs';

const controls={};
const h=createHarness(new Map(),null,controls);
const day=(date,updatedAt='2026-09-17T08:00:00.000Z')=>({version:1,date,savedAt:updatedAt,updatedAt,reflection:'x'});

await h.app.dailyRecords.save(day('2026-09-15'));
assert.equal(h.stores.sync.size,0,'normal DailyRecord writes must not touch the retired sync queue');
assert.equal(h.stores.tombstones.size,0,'normal DailyRecord writes must not touch retired tombstones');
await h.app.dailyRecords.remove('2026-09-15');
assert.equal(h.stores.daily.has('2026-09-15'),false);
assert.deepEqual(Array.from(await h.app.deletionRecovery.savedDays(),row=>String(row.date)),['2026-09-15']);
assert.equal(h.stores.sync.size,0);assert.equal(h.stores.tombstones.size,0);

await h.app.dailyRecords.save(day('2026-09-15','2026-09-17T09:00:00.000Z'));
assert.equal((await h.app.deletionRecovery.savedDays()).some(row=>row.date==='2026-09-15'),false,'recreating a Saved Day must atomically retire its deletion ledger entry');

await h.app.dailyRecords.save(day('2026-09-16','2026-09-17T10:00:00.000Z'));
controls.failNextDailyWrite=true;
await h.app.dailyRecords.remove('2026-09-16');
assert.equal(h.stores.daily.has('2026-09-16'),true,'injected IndexedDB failure keeps the stale physical row until retry');
assert.equal(await h.app.dailyRecords.get('2026-09-16'),null,'pending delete recovery must shadow the stale row');
assert.ok(h.sharedLocal.has('deletionRecovery'),'failed delete must retain a bounded local recovery marker');
assert.equal(await h.app.deletionRecovery.flush(),true);
assert.equal(h.stores.daily.has('2026-09-16'),false,'recovery flush must finish the canonical delete');
assert.equal(h.sharedLocal.has('deletionRecovery'),false,'verified recovery must retire its marker');
assert.equal((await h.app.deletionRecovery.savedDays()).some(row=>row.date==='2026-09-16'),true);

await h.app.dailyRecords.save(day('2026-09-17','2026-09-17T10:30:00.000Z'));
h.sharedLocal.set('fallback',[day('2026-09-17','2026-09-17T10:30:00.000Z')]);
controls.failLocalSetKeys=new Set(['deletionRecovery','fallback']);
await assert.rejects(h.app.dailyRecords.remove('2026-09-17'),/fallback could not be cleared/i,'without a durable deletion marker, a fallback cleanup failure must abort before deleting IndexedDB');
assert.equal(h.stores.daily.has('2026-09-17'),true,'fail-closed deletion must preserve the canonical IndexedDB row');
assert.equal(h.sharedLocal.get('fallback').some(row=>row.date==='2026-09-17'),true,'fail-closed deletion must preserve the fallback copy when it cannot be cleared');
assert.equal(h.sharedLocal.has('deletionRecovery'),false,'a failed marker write must not be mistaken for durable deletion intent');
assert.equal((await h.app.deletionRecovery.savedDays()).some(row=>row.date==='2026-09-17'),false,'aborted deletion must not create deletion history');
controls.failLocalSetKeys=new Set();

await h.app.dailyRecords.save(day('2026-09-18','2026-09-17T10:45:00.000Z'));
h.sharedLocal.set('fallback',[...h.sharedLocal.get('fallback'),day('2026-09-18','2026-09-17T10:45:00.000Z')]);
controls.failLocalSetKeys=new Set(['fallback']);
await h.app.dailyRecords.remove('2026-09-18');
assert.equal(h.stores.daily.has('2026-09-18'),false,'a durable marker permits the IndexedDB delete to commit even if fallback cleanup is temporarily unavailable');
assert.equal(await h.app.dailyRecords.get('2026-09-18'),null,'the durable marker must shadow the stale fallback copy');
assert.ok(h.sharedLocal.has('deletionRecovery'),'the marker must remain until the stale fallback is physically removed');
assert.equal(h.sharedLocal.get('fallback').some(row=>row.date==='2026-09-18'),true);
controls.failLocalSetKeys=new Set();
assert.equal(await h.app.deletionRecovery.flush(),true);
assert.equal(h.sharedLocal.get('fallback').some(row=>row.date==='2026-09-18'),false,'recovery flush must physically remove a stale fallback before retiring the marker');
assert.equal(h.sharedLocal.has('deletionRecovery'),false);
assert.equal(await h.app.dailyRecords.get('2026-09-18'),null,'a stale fallback must not resurrect after the marker is retired');


// Ongoing Note deletions are canonical sync state, not mere absence. Deleting a
// note creates a minimal tombstone; recreating the same key retires it.
await h.app.notes.load();
let noteWrite=h.app.notes.update('obsolete-note','Obsolete Note','temporary text','');
assert.equal(noteWrite.status,'changed');
await h.app.notes.flush({strict:true});
assert.equal(await h.app.notes.remove('obsolete-note'),true);
let noteLedger=await h.app.deletionRecovery.areaNotes();
assert.equal(noteLedger.some(row=>row.key==='obsolete-note'),true,'Ongoing Note deletion must create durable canonical deletion history.');
noteWrite=h.app.notes.update('obsolete-note','Obsolete Note','recreated text','');
assert.equal(noteWrite.status,'changed');
await h.app.notes.flush({strict:true});
noteLedger=await h.app.deletionRecovery.areaNotes();
assert.equal(noteLedger.some(row=>row.key==='obsolete-note'),false,'Recreating an Ongoing Note must atomically retire its deletion marker.');

// Review working state now belongs to Active Session and historical reflection
// belongs to the Daily Record. There is no separate Reflection Draft register or
// deletion/tombstone domain to maintain.
assert.equal(Object.prototype.hasOwnProperty.call(h.app,'reflectionDrafts'),false,'Current canonical repositories must not expose the retired Reflection Draft domain.');
const reviewDate='2026-09-13';
await h.app.dailyRecords.save(day(reviewDate,'2026-09-17T13:00:00.000Z'));
assert.ok(await h.app.dailyRecords.get(reviewDate),'Saving a historical day must not depend on Reflection Draft state.');


// Standalone Attachment Library deletion history is a minimal portable ledger.
// Ordinary OPFS GC does not use it; explicit library deletion records/clears it.
const deletedAttachmentId='img-deletionabcdefghijklmnop';
await h.app.deletionRecovery.recordAttachment(deletedAttachmentId,'2026-09-17T13:30:00.000Z');
assert.equal((await h.app.deletionRecovery.attachments()).some(row=>row.assetId===deletedAttachmentId),true,'Explicit Attachment Library deletion history must be durable canonical metadata.');
assert.equal(await h.app.deletionRecovery.clearAttachment(deletedAttachmentId),true);
assert.equal((await h.app.deletionRecovery.attachments()).some(row=>row.assetId===deletedAttachmentId),false,'Recreating/restoring an Attachment Library identity must retire its deletion marker.');

const session={id:'active',version:1,revision:1,date:'2026-09-17',status:'active',scheduleText:'08:00 30 Study',snapshot:{date:'2026-09-17'},updatedAt:'2026-09-17T11:00:00.000Z'};
await h.app.activeSession.save(session);
assert.equal(h.stores.sync.size,0);assert.equal(h.stores.tombstones.size,0);
controls.failSessionWrite=true;
const cleared=await h.app.activeSession.clear();
assert.equal(cleared.ok,true,'a durable deletion marker may safely shadow a temporarily undeletable Active Session');
{const emptyAfterClear=await h.app.activeSession.load();assert.equal(emptyAfterClear.ok,true);assert.equal(emptyAfterClear.value,null);}
assert.ok(h.sharedLocal.has('deletionRecovery'));
controls.failSessionWrite=false;
assert.equal(await h.app.deletionRecovery.flush(),true);
assert.equal(h.stores.session.has('active'),false);
assert.equal(h.sharedLocal.has('deletionRecovery'),false);

await h.app.activeSession.save({...session,revision:2,updatedAt:'2026-09-17T11:10:00.000Z'});
h.sharedLocal.set('recovery',{stale:true});
controls.failLocalSetKeys=new Set(['deletionRecovery']);
controls.failLocalRemoveKeys=new Set(['recovery']);
const failClosedSession=await h.app.activeSession.clear();
assert.equal(failClosedSession.ok,false,'without a durable marker, failure to clear local recovery must abort the canonical Active Session delete');
assert.equal(h.stores.session.has('active'),true,'fail-closed Active Session deletion must preserve IndexedDB');
assert.equal(h.sharedLocal.has('recovery'),true);
assert.equal(h.sharedLocal.has('deletionRecovery'),false);
controls.failLocalSetKeys=new Set();controls.failLocalRemoveKeys=new Set();
assert.equal((await h.app.activeSession.clear()).ok,true);

await h.app.activeSession.save({...session,revision:3,updatedAt:'2026-09-17T11:20:00.000Z'});
h.sharedLocal.set('recovery',{stale:true});
controls.failLocalRemoveKeys=new Set(['recovery']);
const durableSessionDelete=await h.app.activeSession.clear();
assert.equal(durableSessionDelete.ok,true,'a durable deletion marker may safely commit logical deletion while stale local recovery awaits cleanup');
assert.equal(h.stores.session.has('active'),false);
assert.equal(h.sharedLocal.has('recovery'),true);
assert.ok(h.sharedLocal.has('deletionRecovery'));
assert.equal((await h.app.activeSession.load()).value,null,'the durable marker must prevent stale Active Session recovery from resurrecting');
controls.failLocalRemoveKeys=new Set();
assert.equal(await h.app.deletionRecovery.flush(),true);
assert.equal(h.sharedLocal.has('recovery'),false,'recovery flush must physically retire stale Active Session recovery before clearing its marker');
assert.equal(h.sharedLocal.has('deletionRecovery'),false);

const legacyLocal=new Map([['syncEmergency',{version:1,entries:[{key:'dailyRecord:2026-09-10',entityType:'dailyRecord',entityId:'2026-09-10',op:'delete',updatedAt:'2026-09-17T06:00:00.000Z'},{key:'areaNote:ethics',entityType:'areaNote',entityId:'ethics',op:'upsert',updatedAt:'2026-09-17T06:00:00.000Z'}]}]]);
const legacyStores={area:new Map(),sync:new Map([['dailyRecord:2026-09-11',{key:'dailyRecord:2026-09-11',entityType:'dailyRecord',entityId:'2026-09-11',op:'delete',updatedAt:'2026-09-17T07:00:00.000Z'}]]),tombstones:new Map([['dailyRecord:2026-09-12',{key:'dailyRecord:2026-09-12',entityType:'dailyRecord',entityId:'2026-09-12',deletedAt:'2026-09-17T07:30:00.000Z',updatedAt:'2026-09-17T07:30:00.000Z'}]]),reflection:new Map(),daily:new Map([['2026-09-10',day('2026-09-10','2026-09-16T06:00:00.000Z')],['2026-09-11',day('2026-09-11','2026-09-16T06:00:00.000Z')],['2026-09-12',day('2026-09-12','2026-09-16T06:00:00.000Z')]]),summary:new Map(),session:new Map(),meta:new Map()};
const legacy=createHarness(legacyLocal,legacyStores);
const migration=await legacy.app.compatibility.migrateDeletionState();
assert.equal(migration.status,'migrated');
assert.equal(legacyStores.sync.size,0);assert.equal(legacyStores.tombstones.size,0,'legacy distributed-sync stores become inert after verified conversion');
assert.equal(legacyLocal.has('syncEmergency'),false,'legacy syncEmergency is retired only after conversion');
for(const date of ['2026-09-10','2026-09-11','2026-09-12'])assert.equal(legacyStores.daily.has(date),false,`legacy pending delete must not resurrect ${date}`);
const legacyLedger=await legacy.app.deletionRecovery.savedDays();
assert.deepEqual(Array.from(legacyLedger,row=>String(row.date)),['2026-09-10','2026-09-11','2026-09-12']);
assert.equal((await legacy.app.deletionRecovery.verify()).ok,true);

console.log(JSON.stringify({status:'PASS',suite:'deletion-recovery',savedDayLedger:true,areaNoteDeletionLedger:true,reflectionDraftDomainRetired:true,attachmentDeletionLedger:true,failedDailyDeleteRecovery:true,failedActiveSessionDeleteRecovery:true,legacySyncStateMigrated:true,normalWritesUseNoSyncStores:true},null,2));

// Servicing an older request cannot retire a newer request for the same entity.
// The second async database read observes a foreground save followed by a
// failed delete of the first entity, while the old recovery batch is in flight.
{
 const first='2026-09-01',second='2026-09-02',oldAt='2026-09-17T08:00:00.000Z',newAt='2026-09-17T10:00:00.000Z',local=new Map();let armed=false,changed=false;
 const entry=(date,at)=>({key:'dailyRecord:'+date,kind:'dailyRecord',id:date,deletedAt:at});
 class ConcurrentRecords extends Map{
  get(key){if(armed&&!changed&&key===second){changed=true;this.set(first,day(first,'2026-09-17T09:00:00.000Z'));const pending=structuredClone(local.get('deletionRecovery'));pending.updatedAt=newAt;pending.entries[0]=entry(first,newAt);local.set('deletionRecovery',pending);}return super.get(key);}
 }
 const stores={area:new Map(),sync:new Map(),tombstones:new Map(),reflection:new Map(),daily:new ConcurrentRecords([[first,day(first)],[second,day(second)]]),summary:new Map(),session:new Map(),meta:new Map()},current=createHarness(local,stores);
 local.set('deletionRecovery',{format:'study-director.deletion-recovery',version:1,updatedAt:oldAt,entries:[entry(first,oldAt),entry(second,oldAt)]});armed=true;
 assert.equal(await current.app.deletionRecovery.flush(),false,'newer outstanding work cannot report a complete flush');assert.equal(changed,true);
 assert.deepEqual(local.get('deletionRecovery').entries,[entry(first,newAt)],'only the exact serviced requests may retire');assert.equal(stores.daily.has(first),true);assert.equal(await current.app.dailyRecords.get(first),null,'the outstanding newer deletion continues to shadow saved data');
 assert.equal(await current.app.deletionRecovery.flush(),true);assert.equal(stores.daily.has(first),false);assert.equal(local.has('deletionRecovery'),false);
 console.log(JSON.stringify({status:'PASS',suite:'deletion-recovery-request-fence',newerRequestPreserved:true,eventualCompletion:true}));
}
