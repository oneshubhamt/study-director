import assert from 'node:assert/strict';
import {createHarness} from '../../helpers/repository-harness.mjs';
import {createFakeClock} from '../../helpers/fake-clock.mjs';
import {noteId} from '../../helpers/note-ids.mjs';

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
await assert.rejects(h.app.dailyRecords.remove('2026-09-17'),/fallback could not be cleared|local recovery write failure/i,'without a durable deletion marker, a fallback cleanup failure must abort before deleting IndexedDB');
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


// Note deletions are canonical sync state, not mere absence. Deleting a
// note creates a minimal tombstone under its id; a new note with the same
// title is a different note, and bringing the same id back retires it.
await h.app.notes.load();
let noteWrite=h.app.notes.update('obsolete-note','Obsolete Note','temporary text','');
assert.equal(noteWrite.status,'changed');
await h.app.notes.flush({strict:true});
const obsoleteId=h.app.notes.get('obsolete-note').id;
assert.equal(await h.app.notes.remove('obsolete-note'),true);
let noteLedger=await h.app.deletionRecovery.areaNotes();
assert.equal(noteLedger.some(row=>row.key===obsoleteId),true,'Note deletion must create durable canonical deletion history.');
noteWrite=h.app.notes.update('obsolete-note','Obsolete Note','recreated text','');
assert.equal(noteWrite.status,'changed');
await h.app.notes.flush({strict:true});
assert.notEqual(h.app.notes.get('obsolete-note').id,obsoleteId,'a new note with a deleted note’s title gets its own id');
noteLedger=await h.app.deletionRecovery.areaNotes();
assert.equal(noteLedger.some(row=>row.key===obsoleteId),true,'a new note with the same title must not retire the deleted note’s marker');
const aligned=h.app.notes.alignByTitle({[obsoleteId]:{version:3,key:obsoleteId,label:'Obsolete Note',text:'old text',updatedAt:'2026-09-17T12:00:00.000Z'}},[obsoleteId]);
assert.deepEqual(Object.keys(aligned),[obsoleteId],'a backup copy of a deleted note keeps its id, so its deletion still applies');
await h.app.notes.reconcile({[obsoleteId]:{version:3,key:obsoleteId,label:'obsolete-note',text:'restored text',updatedAt:'2026-09-17T12:00:00.000Z'}});
noteLedger=await h.app.deletionRecovery.areaNotes();
assert.equal(noteLedger.some(row=>row.key===obsoleteId),false,'Bringing a note back must atomically retire its deletion marker.');
assert.deepEqual(Object.values(h.app.notes.exportPayload()).map(entry=>entry.label).sort(),['obsolete-note','obsolete-note (2)'],'two notes never share a title');
// A note deleted elsewhere (a combine applying a deletion) moves to Recently deleted here, as deleting it here would.
await h.app.notes.reconcile({},[{key:obsoleteId,deletedAt:'2026-09-18T00:00:00.000Z'}]);
const retired=h.app.notes.exportPayload()['~deleted '+obsoleteId];
assert.equal(h.app.notes.exportPayload()[obsoleteId],undefined);assert.equal(retired&&retired.text,'restored text','the deleted note’s text stays in Recently deleted');
assert.equal((await h.app.deletionRecovery.areaNotes()).some(row=>row.key===obsoleteId),true,'and its deletion is recorded');

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

// Deletion ledgers stay bounded: past the limit only the oldest records go.
// Listing applies the rule, so a full ledger never stops a backup, and data
// maintenance removes the same records from storage.
{
  const bounded=createHarness(new Map(),null,{});
  bounded.stores.meta.set('dailyRecordMigration',{key:'dailyRecordMigration',version:1,value:{recordVersion:1,summaryVersion:1,complete:true,recordCount:0},updatedAt:'2026-09-15T12:00:00.000Z'});
  const at=index=>new Date(Date.parse('2026-01-01T00:00:00.000Z')+index*60000).toISOString();
  const nth=index=>noteId(`note ${String(index).padStart(4,'0')}`);
  for(let index=0;index<1003;index+=1){const key=nth(index);bounded.stores.meta.set(`areaNoteDeletion:${key}`,{key:`areaNoteDeletion:${key}`,version:1,value:{format:'study-director.area-note-deletion',version:1,key,deletedAt:at(index)},updatedAt:at(index)});}
  const listed=await bounded.app.deletionRecovery.areaNotes();
  assert.equal(listed.length,1000,'a full ledger lists its newest records');
  assert.deepEqual([0,1,2].map(index=>listed.some(entry=>entry.key===nth(index))),[false,false,false],'the oldest records are the ones left out');
  assert.equal((await bounded.app.deletionRecovery.verify()).ok,true,'a full ledger is not an integrity failure');
  assert.equal((await bounded.app.maintenance.run({force:true})).status,'completed');
  const stored=[...bounded.stores.meta.keys()].filter(key=>key.startsWith('areaNoteDeletion:'));
  assert.equal(stored.length,1000,'maintenance removes the records listing leaves out');assert.equal(bounded.stores.meta.has(`areaNoteDeletion:${nth(2)}`),false);
  assert.deepEqual(await bounded.app.deletionRecovery.areaNotes(),listed,'pruning changes nothing a backup reads');
  await bounded.app.deletionRecovery.replaceAreaNotes([...listed,{key:noteId('newest'),deletedAt:at(5000)}]);
  const replaced=await bounded.app.deletionRecovery.areaNotes();
  assert.equal(replaced.length,1000);assert.ok(replaced.some(entry=>entry.key===noteId('newest')),'a new deletion is always kept');assert.equal(replaced.some(entry=>entry.key===nth(3)),false);
}

console.log(JSON.stringify({status:'PASS',suite:'deletion-recovery',boundedDeletionLedgers:true,savedDayLedger:true,areaNoteDeletionLedger:true,reflectionDraftDomainRetired:true,attachmentDeletionLedger:true,failedDailyDeleteRecovery:true,failedActiveSessionDeleteRecovery:true,legacySyncStateMigrated:true,normalWritesUseNoSyncStores:true},null,2));

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

// Fail each actual local read in a healthy trace, one at a time. Operations on
// A must conserve an acknowledged B across all copies, including asynchronous
// subset reconciliation. A finite failure followed by a retry must converge.
const readSafetyCases=[];
const stamp='2026-10-04T07:00:00.000Z',target='2026-10-01',protectedDay='2026-10-02';
const record=(date,text)=>({...day(date,stamp),reflection:text});
const hasCopy=(h,date,expected)=>[h.stores.daily.get(date),...(h.sharedLocal.get('fallback')||[])].some(value=>value?.date===date&&JSON.stringify(value)===JSON.stringify(expected));
function failRead(controls,index){
  let reads=0,injected=false;
  controls.failLocalGetKeys={has:()=>{reads++;if(index&&reads===index){injected=true;return true;}return false;}};
  return ()=>({reads,injected});
}
for(const operation of ['save','saveBatch','importBatches','remove','subset-reconciliation','fallback-save','fallback-batch','maintenance']){
  let readCount=0;
  for(let fault=0;fault<=readCount;fault++){
    const clock=createFakeClock('2026-10-04T08:00:00.000Z'),controls={clock},current=createHarness(new Map(),null,controls);
    if(operation==='subset-reconciliation')controls.failNextDailyWrite=true;
    await current.app.dailyRecords.save(record(target,'original target'));
    const original=record(protectedDay,'unrelated day: only rescue copy');
    controls.failNextDailyWrite=true;await current.app.dailyRecords.save(original);
    assert.equal(current.stores.daily.has(protectedDay),false);
    const proposed=record(target,'updated target'),trace=failRead(controls,fault);
    const execute=async()=>{
      if(operation==='maintenance')return current.app.maintenance.run({force:true});
      if(operation==='subset-reconciliation'){const value=await current.app.dailyRecords.get(target);await current.app.activeSession.settled();return value;}
      if(operation==='remove')return current.app.dailyRecords.remove(target);
      if(operation.startsWith('fallback-'))controls.failNextDailyWrite=true;
      if(operation==='save'||operation==='fallback-save')return current.app.dailyRecords.save(proposed);
      return current.app.dailyRecords[operation==='fallback-batch'?'saveBatch':operation]([proposed]);
    };
    let result,error=null;
    try{result=await execute();}catch(reason){error=reason;}
    controls.failLocalGetKeys=null;
    assert.equal(hasCopy(current,protectedDay,original),true,`${operation} read ${fault}: preserve the unrelated acknowledged day`);
    const observed=trace();
    if(!fault){assert.equal(error,null);readCount=observed.reads;if(operation==='importBatches')assert.equal(result.committed,1,'Import fixture must commit a real nonempty batch');}
    else assert.equal(observed.injected,true,`${operation}: every selected read fault must execute`);
    await execute();await current.app.activeSession.settled();
    assert.equal((await current.app.maintenance.run({force:true})).status,'completed',`${operation}: healthy retry finishes maintenance`);
    assert.equal(hasCopy(current,protectedDay,original),true);
    assert.equal(current.stores.daily.get(protectedDay).reflection,original.reflection);
    assert.equal(current.sharedLocal.get('fallback')?.length||0,0,'All rescued days eventually reconcile');
    readSafetyCases.push({operation,fault,reads:observed.reads});
  }
}

// Different entity families share the pending-deletion ledger. Staging another
// request may never consume an older unrelated request on a failed read.
for(const operation of ['active-clear','daily-remove']){
  let readCount=0;
  for(let fault=0;fault<=readCount;fault++){
    const clock=createFakeClock('2026-10-04T08:00:00.000Z'),controls={clock},current=createHarness(new Map(),null,controls);
    await current.app.dailyRecords.save(record(protectedDay,'already deleted'));
    await current.app.dailyRecords.save(record(target,'separate target'));
    await current.app.activeSession.save({...session,updatedAt:stamp});
    controls.failNextDailyWrite=true;await current.app.dailyRecords.remove(protectedDay);
    const pendingBefore=structuredClone(current.sharedLocal.get('deletionRecovery').entries),trace=failRead(controls,fault);
    const execute=()=>operation==='active-clear'?current.app.activeSession.clear():current.app.dailyRecords.remove(target);
    let result,error=null;try{result=await execute();}catch(reason){error=reason;}
    controls.failLocalGetKeys=null;
    for(const entry of pendingBefore)assert.equal(current.sharedLocal.get('deletionRecovery')?.entries.some(value=>JSON.stringify(value)===JSON.stringify(entry)),true,`${operation} read ${fault}: conserve unrelated deletion intent`);
    assert.equal(await current.app.dailyRecords.get(protectedDay),null,'The unrelated deleted day remains hidden');
    const observed=trace();if(!fault){assert.equal(error,null);readCount=observed.reads;if(operation==='active-clear')assert.equal(result.ok,true);}else assert.equal(observed.injected,true);
    await execute();assert.equal(await current.app.deletionRecovery.flush(),true);
    assert.equal(current.stores.daily.has(protectedDay),false);assert.equal(current.sharedLocal.has('deletionRecovery'),false);
    readSafetyCases.push({operation,fault,reads:observed.reads});
  }
}

// An old deletion and a newer rescue-only save can coexist after database and
// cleanup failures. Recovery must preserve the newer acknowledged value even
// if any intermediate read fails, and must not report a failed attempt clean.
for(const family of ['active','daily']){
  let readCount=0;
  for(let fault=0;fault<=readCount;fault++){
    const clock=createFakeClock('2026-10-04T08:00:00.000Z'),controls={clock},current=createHarness(new Map(),null,controls);
    if(family==='active'){
      await current.app.activeSession.save({...session,updatedAt:stamp});controls.failSessionWrite=true;await current.app.activeSession.clear();
    }else{
      await current.app.dailyRecords.save(record(target,'older day'));controls.failNextDailyWrite=true;await current.app.dailyRecords.remove(target);
    }
    await clock.advance(3600000);
    const newer=family==='active'?{...session,revision:2,updatedAt:'2026-10-04T09:00:00.000Z',snapshot:{...session.snapshot,review:{reflection:'newer rescue-only session'}}}:{...record(target,'newer rescue-only day'),updatedAt:'2026-10-04T09:00:00.000Z'};
    controls.failLocalRemoveKeys=new Set(['deletionRecovery']);
    if(family==='active'){const saved=await current.app.activeSession.save(newer);assert.equal(saved.storage.idb,false);}
    else{controls.failNextDailyWrite=true;assert.equal((await current.app.dailyRecords.save(newer)).storage,'fallback');}
    controls.failSessionWrite=false;controls.failLocalRemoveKeys=null;
    assert.equal(current.sharedLocal.has('deletionRecovery'),true);
    const trace=failRead(controls,fault),flushed=await current.app.deletionRecovery.flush();controls.failLocalGetKeys=null;
    const preserved=()=>family==='active'?[current.stores.session.get('active'),current.sharedLocal.get('recovery')].some(value=>value?.snapshot?.review?.reflection===newer.snapshot.review.reflection):hasCopy(current,target,newer);
    assert.equal(preserved(),true,`${family} recovery read ${fault}: preserve the newer acknowledged rescue`);
    const observed=trace();if(!fault){assert.equal(flushed,true);readCount=observed.reads;}else{assert.equal(observed.injected,true);assert.equal(flushed,false,'Unavailable recovery reads never report a clean flush');}
    assert.equal(await current.app.deletionRecovery.flush(),true);
    assert.equal((await current.app.maintenance.run({force:true})).status,'completed');
    assert.equal(preserved(),true);assert.equal(current.sharedLocal.has('deletionRecovery'),false);
    readSafetyCases.push({operation:family+'-recovery',fault,reads:observed.reads});
  }
}
console.log(JSON.stringify({status:'PASS',suite:'local-recovery-read-safety',productionStorageAdapter:true,copyConservation:true,intentConservation:true,eventualCompletion:true,cases:readSafetyCases.length,operations:[...new Set(readSafetyCases.map(value=>value.operation))]},null,2));

// Once the canonical write commits, unavailable rescue cleanup is pending
// housekeeping, not a failed save. Replaying the retained older copy must not
// roll back that acknowledged write, including passive single-day migration.
for(const operation of ['save','saveBatch','importBatches']){
  const diagnostics=[],issues=[],commits=[],controls={clock:createFakeClock(),onDiagnostic:scope=>diagnostics.push(scope),onStorageError:(...args)=>issues.push(args),onCanonicalCommit:event=>commits.push(event)},current=createHarness(new Map(),null,controls);
  const older=record(target,'older rescued value'),newer={...older,updatedAt:'2026-10-04T09:00:00.000Z',reflection:'new canonical value'};
  controls.failNextDailyWrite=true;await current.app.dailyRecords.save(older);
  diagnostics.length=0;issues.length=0;commits.length=0;
  let injected=false;controls.failLocalGetKeys={has:key=>{if(key==='fallback'&&!injected){injected=true;return true;}return false;}};
  const result=await current.app.dailyRecords[operation](operation==='save'?newer:[newer],{backupCapture:true});controls.failLocalGetKeys=null;
  assert.equal(injected,true);
  if(operation==='save'){assert.equal(result.ok,true);assert.equal(result.storage,'indexeddb');assert.equal(commits[0].backupCapture,true);}
  else if(operation==='saveBatch')assert.equal(result,true);else assert.equal(result.committed,1);
  assert.equal(commits.length,1,'Committed data still notifies automatic backup');
  assert.equal(diagnostics.includes('daily-record.recovery-cleanup'),true,'Unavailable cleanup is diagnosed');assert.ok(issues.length);
  assert.equal(hasCopy(current,target,older),true,'Unknown rescue collection stays unchanged');
  assert.deepEqual(current.stores.daily.get(target),newer);
  assert.equal((await current.app.dailyRecords.get(target)).reflection,newer.reflection);await current.app.activeSession.settled();
  assert.deepEqual(current.stores.daily.get(target),newer,'Passive rescue replay cannot overwrite newer canonical data');
  assert.equal((await current.app.maintenance.run({force:true})).status,'completed');assert.equal(current.sharedLocal.get('fallback').length,0);
}

// A save arriving while reconciliation awaits its database transaction owns
// its rescue copy. Cleanup rereads the collection and retires only the copy it
// committed; it must preserve both unrelated and newer same-day arrivals.
for(const executor of ['migration','deletion-recovery'])for(const arrival of ['unrelated','newer-same-day']){
  const local=new Map(),controls={clock:createFakeClock()},older=record(target,'captured rescue'),incoming={...record(arrival==='unrelated'?protectedDay:target,'arrived during reconciliation'),updatedAt:'2026-10-04T10:00:00.000Z'};let armed=false,changed=false;
  class ConcurrentRecords extends Map{
    get(key){if(armed&&!changed&&key===target){changed=true;const values=local.get('fallback').filter(value=>value.date!==incoming.date);local.set('fallback',[...values,incoming]);}return super.get(key);}
  }
  const stores={area:new Map(),sync:new Map(),tombstones:new Map(),reflection:new Map(),daily:new ConcurrentRecords(),summary:new Map(),session:new Map(),meta:new Map()},current=createHarness(local,stores,controls);
  controls.failNextDailyWrite=true;await current.app.dailyRecords.save(older);
  if(executor==='deletion-recovery')local.set('deletionRecovery',{format:'study-director.deletion-recovery',version:1,updatedAt:'2026-10-04T06:00:00.000Z',entries:[{key:'dailyRecord:'+target,kind:'dailyRecord',id:target,deletedAt:'2026-10-04T06:00:00.000Z'}]});
  armed=true;
  if(executor==='migration')assert.equal((await current.app.maintenance.run({force:true})).status,'failed','A concurrent rescue retains pending reconciliation');
  else assert.equal(await current.app.deletionRecovery.flush(),true);
  assert.equal(changed,true);assert.equal(hasCopy(current,incoming.date,incoming),true,'Concurrent acknowledged value is conserved');
  assert.equal((await current.app.maintenance.run({force:true})).status,'completed');
  assert.deepEqual(stores.daily.get(incoming.date),incoming);assert.equal(local.get('fallback').length,0);
}
console.log(JSON.stringify({status:'PASS',suite:'rescue-reconciliation',committedSavesAcknowledged:true,cleanupDiagnosed:true,staleReplayProtected:true,concurrentCopiesPreserved:true,cases:7}));
