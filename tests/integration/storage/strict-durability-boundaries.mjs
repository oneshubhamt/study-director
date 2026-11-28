import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readRuntimeSource} from '../../helpers/runtime-source.mjs';
import {createHarness} from '../../helpers/repository-harness.mjs';
import {createFakeClock} from '../../helpers/fake-clock.mjs';

const clock=createFakeClock('2026-09-15T12:00:00.000Z');
const h=createHarness(new Map(),null,{clock});
const {app,idbDurability,stores,dataContract}=h;
const strictCount=()=>idbDurability.strict;
const normalCount=()=>idbDurability.normal;

// Calibrate the storage fixture used by all of the fault-injection cases below.
{
 const fixture=createHarness(),key='ordered';
 fixture.stores.meta.set(key,{key,value:'before'});
 let observed;
 await fixture.indexedDb.strictStoreTransaction('meta','readwrite',(store,tx,finish)=>{
   const read=store.get(key);
   read.onsuccess=()=>{observed=read.result.value;};
   const next={key,value:'after'};
   store.put(next);next.value='changed after submission';
   tx.oncomplete=()=>finish(true);
 });
 assert.equal(observed,'before','an earlier read cannot see a later queued write');
 assert.equal(fixture.stores.meta.get(key).value,'after','submission takes a clone of the record');
 await assert.rejects(fixture.indexedDb.strictStoreTransaction('meta','readwrite',(store,tx,finish)=>{
   store.put({key,value:'must roll back'});store.add({key,value:'duplicate'});tx.oncomplete=()=>finish(true);
 }),/constraint|abort/i,'an unhandled duplicate aborts the transaction');
 assert.equal(fixture.stores.meta.get(key).value,'after','aborting the duplicate also undoes the preceding successful put');
}

// High-frequency Review/Active Session checkpoints stay on normal/default durability.
await app.activeSession.save({id:'active',version:dataContract.schemas.ActiveSession.version,revision:1,date:'2026-09-15',status:'active',scheduleText:'',snapshot:{elapsedMs:1,review:{reflection:'draft',studyQuality:null}},updatedAt:'2026-09-15T12:00:00.000Z'});
assert.equal(strictCount(),0,'Review autosaves through Active Session must not force a storage flush');
assert.ok(normalCount()>0,'Review autosaves through Active Session must keep the normal transaction path');

const beforeSessionStrict=strictCount();
await app.activeSession.save({id:'active',version:dataContract.schemas.ActiveSession.version,revision:2,date:'2026-09-15',status:'active',scheduleText:'',snapshot:{elapsedMs:2,review:{reflection:'draft',studyQuality:null}},updatedAt:'2026-09-15T12:00:01.000Z'});
assert.equal(strictCount(),beforeSessionStrict,'active-session checkpoints must not use strict durability');

await app.notes.load();
const beforeTypingStrict=strictCount(),beforeTypingNormal=normalCount();
const changed=app.notes.update('durability','Durability','recover me','');
assert.equal(changed.status,'changed');
await clock.drainMicrotasks(12);
assert.equal(strictCount()+normalCount(),beforeTypingStrict+beforeTypingNormal,'typing writes nothing until it pauses');

// Canonical user-data boundaries opt into strict durability.
const beforeNoteFlush=strictCount();
await app.notes.flush({strict:true});
assert.ok(strictCount()>beforeNoteFlush,'canonical note commit must use strict IndexedDB durability');

const beforeDaily=strictCount();
await app.dailyRecords.save({version:1,date:'2026-09-15',updatedAt:'2026-09-15T12:01:00.000Z',savedAt:'2026-09-15T12:01:00.000Z'});
assert.ok(strictCount()>beforeDaily,'authoritative Daily Record save must use strict durability');

// Same-date Diary edits use a full-record compare-and-swap. A newer Saved Day
// that arrives after the Diary read must survive both stale update and delete.
const expectedDay=await app.dailyRecords.get('2026-09-15',{strict:true});
assert.ok(expectedDay);
const richerDay={...expectedDay,sourceRevision:Number(expectedDay.sourceRevision||0)+1,reflection:String(expectedDay.reflection||''),updatedAt:'2026-09-15T12:02:00.000Z'};
await app.dailyRecords.save(richerDay);
const staleReflection={...expectedDay,reflection:'stale diary edit',updatedAt:'2026-09-15T12:03:00.000Z'};
await assert.rejects(app.dailyRecords.save(staleReflection,{expectedCanonical:expectedDay}),error=>error?.code==='DAILY_RECORD_CHANGED');
let preserved=await app.dailyRecords.get('2026-09-15',{strict:true});
assert.equal(preserved.sourceRevision,richerDay.sourceRevision,'stale Diary update must not replace newer study evidence');
await assert.rejects(app.dailyRecords.remove('2026-09-15',{expectedCanonical:expectedDay}),error=>error?.code==='DAILY_RECORD_CHANGED');
preserved=await app.dailyRecords.get('2026-09-15',{strict:true});
assert.equal(preserved.sourceRevision,richerDay.sourceRevision,'stale Diary deletion must not remove newer study evidence');

// Deliberately interleave the real Reflection persistence sequence:
// read R -> concurrent Save Today writes R2 -> Reflection attempts { ...R }.
// The repository CAS must reject the stale replacement and preserve R2.
{
  const date='2026-09-16';
  const base={version:1,recordKind:'study',date,reflection:'baseline',sourceRevision:4,evidence:'base',savedAt:'2026-09-16T08:00:00.000Z',updatedAt:'2026-09-16T08:00:00.000Z'};
  await app.dailyRecords.save(base);
  let enteredResolve,releaseResolve,intercepted=false;
  const entered=new Promise(resolve=>{enteredResolve=resolve;});
  const release=new Promise(resolve=>{releaseResolve=resolve;});
  class TextArea{
    dataset={};isConnected=true;value='';
    setAttribute(){}
  }
  let pausedSave=null,pausedRead=null,failReadback=false,ownerRevision=1,canWrite=true,mutations=0;
  const context=vm.createContext({console,Promise,Object,Symbol,Error,TypeError,String,Number,Math,Array,Set,Map,WeakMap,Date,setTimeout,clearTimeout,queueMicrotask,HTMLTextAreaElement:TextArea});
  vm.runInContext(readRuntimeSource('source/core/internal.ts'),context,{filename:'source/core/internal.ts'});
  vm.runInContext(readRuntimeSource('source/core/save-lane.ts'),context,{filename:'source/core/save-lane.ts'});
  vm.runInContext(readRuntimeSource('source/core/review-persistence.ts'),context,{filename:'source/core/review-persistence.ts'});
  const module=context[Symbol.for('studyDirector.internalModules.v1')].require('review-persistence',1);
  const persistence=module.createPersistence(Object.freeze({
    configuration:Object.freeze({limits:Object.freeze({maxReflectionChars:5000,maxRichTextWords:1000}),dataContract:Object.freeze({schemas:Object.freeze({DailyRecord:Object.freeze({version:1})})})}),
    records:Object.freeze({
      get:async(target,options)=>{
        const value=await app.dailyRecords.get(target,options);
        if(!intercepted&&options?.strict===true){intercepted=true;enteredResolve();await release;}
        if(pausedRead&&options?.strict===true){const pending=pausedRead;pausedRead=null;pending.enter();await pending.wait;}
        return value;
      },
      save:async(...args)=>{
        mutations++;
        if(pausedSave){const pending=pausedSave;pending.enter();await pending.wait;if(pending.fail)throw new Error('old Diary write failed');}
        return app.dailyRecords.save(...args);
      },
      remove:(...args)=>{mutations++;return app.dailyRecords.remove(...args);},
      verifyCanonical:(...args)=>{if(failReadback){failReadback=false;throw new Error('QA read-back unavailable');}return app.dailyRecords.verifyCanonical(...args);},
      verifyCanonicalAbsent:(...args)=>app.dailyRecords.verifyCanonicalAbsent(...args),
      timestamp:(...args)=>app.dailyRecords.timestamp(...args)
    }),
    codec:Object.freeze({createDiaryRecord:()=>{throw new Error('study-record path must not create a diary record');}}),
    ownership:Object.freeze({canMutate:()=>canWrite,revision:()=>ownerRevision}),
    text:Object.freeze({clampEditorContent:value=>String(value??''),editorContentWithinLimits:()=>true,plain:value=>String(value??''),isRich:()=>false}),
    richText:Object.freeze({closeField:()=>true,syncField:()=>true,validatedInput:()=>null}),
    dates:Object.freeze({isSupported:value=>/^\d{4}-\d{2}-\d{2}$/.test(value),insights:()=>Object.freeze({dayOfWeek:3,dayName:'Wednesday'})}),
    saveLane:context[Symbol.for('studyDirector.internalModules.v1')].require('save-lane',1),environment:Object.freeze({nowIso:()=> '2026-09-16T08:02:00.000Z',queueMicrotask,setTimeout,clearTimeout})
  }));
  const stale=persistence.DailyReflectionPersistence.commit(date,'stale diary edit',{expectedCanonical:'baseline',backupCapture:false});
  await entered;
  const newer={...base,sourceRevision:5,evidence:'newer-study-evidence',updatedAt:'2026-09-16T08:01:00.000Z'};
  await app.dailyRecords.save(newer);
  releaseResolve();
  await assert.rejects(stale,error=>error?.code==='DAILY_RECORD_CHANGED');
  const final=await app.dailyRecords.get(date,{strict:true});
  assert.equal(final.sourceRevision,5);
  assert.equal(final.evidence,'newer-study-evidence','interleaved Reflection write must preserve the concurrently saved Study Day');

  // Rebinding cancels retries, but cannot cancel an in-flight canonical write.
  // Neither its failure nor its stale completion may report into the new Diary.
  for(const fail of [false,true]){
    let enter,release;
    const started=new Promise(resolve=>{enter=resolve;}),wait=new Promise(resolve=>{release=resolve;});
    pausedSave={enter,wait,fail};
    const field=new TextArea(),oldStates=[],newStates=[];
    persistence.DiaryEditor.bind(field,date,await app.dailyRecords.get(date),{onState:state=>oldStates.push(state)});
    persistence.DiaryEditor.schedule(field,'new reflection '+String(fail));
    const flushing=persistence.DiaryEditor.flush(field);
    const rejected=assert.rejects(flushing,/old Diary write failed|became stale|no longer bound to the current study owner/);
    await started;
    persistence.DiaryEditor.bind(field,'2026-09-17',{...base,date:'2026-09-17',reflection:'successor'}, {onState:state=>newStates.push(state)});
    const successor={...field.dataset},previousStates=[...oldStates];
    release();await rejected;
    assert.deepEqual(field.dataset,successor,'old save feedback must not overwrite successor sync state');
    assert.equal(field.value,'successor');
    assert.deepEqual(oldStates,previousStates,'disposed Diary callbacks must stay silent');
    assert.deepEqual(newStates,[]);
    persistence.DiaryEditor.clear(field);
  }
  pausedSave=null;

  // A physical write followed by a failed read-back must not be retried as
  // another write or misreported as a rollback. The requested value can settle
  // after verification succeeds, even though the original baseline is old.
  const oldReflection=(await app.dailyRecords.get(date,{strict:true})).reflection;
  failReadback=true;
  await assert.rejects(persistence.DailyReflectionPersistence.commit(date,'committed reflection',{expectedCanonical:oldReflection}),error=>error?.code==='DAILY_RECORD_COMMITTED_UNVERIFIED');
  const committedMutations=mutations;
  assert.equal((await persistence.DailyReflectionPersistence.commit(date,'committed reflection',{expectedCanonical:oldReflection})).canonical,'committed reflection');
  assert.equal(mutations,committedMutations,'read-back recovery must not rewrite the Saved Day');

  // A read begun by a former owner cannot use a newly acquired write lease.
  // Exercise both the direct Review commit and the Diary deletion pre-read.
  for(const action of ['save','delete']){
    for(const reacquire of [false,true]){
      const before=await app.dailyRecords.get(date,{strict:true}),beforeMutations=mutations;
      let enter,release;
      const started=new Promise(resolve=>{enter=resolve;}),wait=new Promise(resolve=>{release=resolve;});
      pausedRead={enter,wait};
      const operation=action==='save'
        ?persistence.DailyReflectionPersistence.commit(date,'stale owner reflection',{expectedCanonical:before.reflection})
        :persistence.DiaryEditor.deleteEntry(date);
      const rejected=assert.rejects(operation,/Daily Reflection ownership changed/);
      await started;
      canWrite=false;ownerRevision++;
      if(reacquire){canWrite=true;ownerRevision++;}
      release();await rejected;
      assert.equal(mutations,beforeMutations,'the former owner must not reach a new repository mutation');
      assert.deepEqual(await app.dailyRecords.get(date,{strict:true}),before,'the canonical Saved Day must remain unchanged');
      canWrite=true;ownerRevision++;
    }
  }
}

// The IndexedDB read callback is a second ownership boundary, even when
// the canonical precondition still matches. No former owner may mutate it.
{
  const date='2026-09-15',timestamp='2026-09-15T12:00:00.000Z';
  const day={version:1,date,reflection:'keep this reflection',savedAt:timestamp,updatedAt:timestamp};
  const session={id:'active',version:1,revision:1,date,status:'active',scheduleText:'',snapshot:{date,elapsedMs:1},updatedAt:timestamp};
  for(const reacquire of [false,true]){
    for(const action of ['delete-day','save-session']){
      const authority={ownershipRevision:1};
      const owned=createHarness(new Map(),null,authority);
      await owned.app.dailyRecords.save(day);
      assert.equal((await owned.app.activeSession.save(session)).ok,true);
      const previousDay=structuredClone(owned.stores.daily.get(date)),previousSession=structuredClone(owned.stores.session.get('active'));
      let triggered=false;
      authority.onTransactionRead=({store,key,mode})=>{
        if(mode!=='readwrite'||(action==='delete-day'?(store!=='daily'||key!==date):(store!=='session'||key!=='active')))return;
        delete authority.onTransactionRead;triggered=true;authority.owned=false;authority.ownershipRevision++;
        if(reacquire){authority.owned=true;authority.ownershipRevision++;}
      };
      if(action==='delete-day')await assert.rejects(owned.app.dailyRecords.remove(date,{expectedCanonical:previousDay}),error=>error?.code==='OWNERSHIP');
      else{
        const saved=await owned.app.activeSession.save({...previousSession,revision:2},{expectedCanonical:previousSession,strictDurability:true});
        assert.equal(saved.ok,false);assert.equal(saved.error?.code,'OWNERSHIP');assert.equal(saved.storage.idb,false);
      }
      assert.equal(triggered,true,'exercise the actual transactional pre-read');
      assert.deepEqual(owned.stores.daily.get(date),previousDay);
      assert.deepEqual(owned.stores.session.get('active'),previousSession);
      assert.equal(owned.sharedLocal.has('deletionRecovery'),false,'conditional mutations must not leave a rejected deletion marker');
    }
  }
  const events=[],authority={ownershipRevision:1,onCanonicalCommit:event=>events.push(event)};
  const owned=createHarness(new Map(),null,authority);
  assert.equal((await owned.app.activeSession.save(session)).ok,true);
  const before=events.length,previous=structuredClone(owned.stores.session.get('active'));
  authority.onTransactionComplete=({stores,mode})=>{
    if(mode!=='readwrite'||!Array.isArray(stores)||!stores.includes('session'))return;
    delete authority.onTransactionComplete;authority.owned=false;authority.ownershipRevision++;
  };
  const saved=await owned.app.activeSession.save({...previous,revision:2},{expectedCanonical:previous,strictDurability:true});
  assert.equal(saved.ok,false,'former owner cannot acknowledge a committed save as a current-owner success');
  assert.equal(saved.error?.code,'OWNERSHIP');
  assert.equal(saved.storage.idb,true,'physical commit still reported accurately');
  assert.equal(owned.stores.session.get('active').revision,2);
  assert.equal(events.length,before,'former owner must not publish a canonical completion notification');
}

// A Daily Record uses the same physical-commit truth. If ownership/request
// authority changes only after IndexedDB completed, the canonical row exists;
// the caller must get an explicit committed-but-unverified result and the
// repository must not manufacture a fallback copy or stale completion event.
{
  const date='2026-09-18',stamp='2026-09-18T12:00:00.000Z',events=[];
  const controls={ownershipRevision:1,onCanonicalCommit:event=>events.push(event)},owned=createHarness(new Map(),null,controls);
  const before={version:1,date,recordKind:'study',reflection:'before',savedAt:stamp,updatedAt:stamp,sourceRevision:1};
  await owned.app.dailyRecords.save(before);
  const expected=await owned.app.dailyRecords.get(date,{strict:true}),eventCount=events.length,fallbackBefore=structuredClone(owned.sharedLocal.get('fallback')??null);
  controls.onTransactionComplete=({stores,mode})=>{
    if(mode!=='readwrite'||!Array.isArray(stores)||!stores.includes('daily'))return;
    delete controls.onTransactionComplete;controls.owned=false;controls.ownershipRevision++;
  };
  const after={...expected,reflection:'committed after authority change',sourceRevision:2,updatedAt:'2026-09-18T12:01:00.000Z'};
  await assert.rejects(owned.app.dailyRecords.save(after,{expectedCanonical:expected}),error=>error?.code==='DAILY_RECORD_COMMITTED_UNVERIFIED');
  assert.equal(owned.stores.daily.get(date).reflection,after.reflection,'the physically committed Daily Record must remain canonical');
  assert.deepEqual(owned.sharedLocal.get('fallback')??null,fallbackBefore,'post-commit ambiguity must not change the fallback Daily Record state');
  assert.equal(events.length,eventCount,'the former owner must not publish a stale Daily Record completion event');
}

// Emergency fallback is part of the compared evidence. A conditional edit
// or deletion must preserve an independently newer rescue copy, including
// the case where the attempted canonical transaction cannot start.
{
  const date='2026-09-20',stamp='2026-09-20T12:00:00.000Z',controls={},h=createHarness(new Map(),null,controls);
  const base={version:1,recordKind:'study',date,reflection:'baseline',savedAt:stamp,updatedAt:stamp,sourceRevision:1};
  await h.app.dailyRecords.save(base);
  const expected=await h.app.dailyRecords.get(date,{strict:true});
  controls.failNextDailyWrite=true;
  assert.equal((await h.app.dailyRecords.save({...expected,reflection:'new rescue',updatedAt:'2026-09-20T12:01:00.000Z'})).storage,'fallback');
  const recovery=structuredClone(h.sharedLocal.get('fallback'));
  const stale={...expected,reflection:'stale candidate',updatedAt:'2026-09-20T12:02:00.000Z'};
  for(const unavailable of [false,true]){
    controls.failNextDailyWrite=unavailable;
    await assert.rejects(h.app.dailyRecords.save(stale,{expectedCanonical:expected}),error=>error?.code==='DAILY_RECORD_CHANGED');
    await assert.rejects(h.app.dailyRecords.remove(date,{expectedCanonical:expected}),error=>error?.code==='DAILY_RECORD_CHANGED');
    assert.deepEqual(h.sharedLocal.get('fallback'),recovery,'newer rescue evidence is preserved');
    assert.equal(h.stores.daily.get(date).reflection,'baseline');
  }
}

// The actual Diary deletion transaction must honor the external request's
// lifetime independently of tab ownership, including a physical commit.
for(const stage of ['read','committed']){
  const date='2026-09-19',stamp='2026-09-19T12:00:00.000Z',events=[];
  const controls={onCanonicalCommit:event=>events.push(event)},h=createHarness(new Map(),null,controls);
  await h.app.dailyRecords.save({version:1,recordKind:'diary',date,reflection:'keep the reflection',savedAt:stamp,updatedAt:stamp,sourceRevision:0});
  const expected=await h.app.dailyRecords.get(date,{strict:true}),count=events.length;
  let current=true;
  const assertOrigin=()=>{if(!current)throw new Error('Diary request retired');};
  if(stage==='read')controls.onTransactionRead=({store,key,mode})=>{if(mode==='readwrite'&&store==='daily'&&key===date){delete controls.onTransactionRead;current=false;}};
  else controls.onTransactionComplete=({stores,mode})=>{if(mode==='readwrite'&&stores.includes('daily')){delete controls.onTransactionComplete;current=false;}};
  await assert.rejects(h.app.dailyRecords.remove(date,{expectedCanonical:expected,assertOrigin}),error=>stage==='committed'?error?.code==='DAILY_RECORD_COMMITTED_UNVERIFIED':/Diary request retired/u.test(error?.message));
  assert.equal(h.stores.daily.has(date),stage==='read','only the physically committed deletion can remove the row');
  assert.equal(events.length,count,'retired deletion may not publish completion');
}

// The recovery/transfer request may retire while local tab ownership remains.
// Assert that the originating guard is checked inside the actual IDB CAS, not
// just by the controller, and that a physical commit is reported accurately.
for(const stage of ['read','committed']){
  const date='2026-09-15',stamp='2026-09-15T12:00:00.000Z';
  const events=[],controls={onCanonicalCommit:event=>events.push(event)},h=createHarness(new Map(),null,controls);
  const session={id:'active',version:1,revision:1,date,status:'active',scheduleText:'',snapshot:{date,elapsedMs:1},updatedAt:stamp};
  assert.equal((await h.app.activeSession.save(session)).ok,true);
  const before=structuredClone(h.stores.session.get('active')),count=events.length;
  let current=true;
  const assertOrigin=()=>{if(!current)throw new Error('recovery request changed');};
  if(stage==='read')controls.onTransactionRead=({store,key,mode})=>{if(mode==='readwrite'&&store==='session'&&key==='active'){delete controls.onTransactionRead;current=false;}};
  else controls.onTransactionComplete=({stores,mode})=>{if(mode==='readwrite'&&stores.includes('session')){delete controls.onTransactionComplete;current=false;}};
  const saved=await h.app.activeSession.save({...before,revision:2},{expectedCanonical:before,strictDurability:true,assertOrigin});
  assert.equal(saved.ok,false);assert.match(saved.error.message,/recovery request changed/u);
  assert.equal(saved.storage.idb,stage==='committed');
  assert.equal(h.stores.session.get('active').revision,stage==='committed'?2:1);
  assert.equal(events.length,count,'no stale completion');assert.equal(h.sharedLocal.has('recovery'),false);
}
// Explicit absence is a real CAS precondition. A successor in canonical or
// emergency storage cannot be removed or replaced by an older operation.
{
  const session={id:'active',version:1,revision:1,date:'2026-09-15',status:'active',scheduleText:'',snapshot:{date:'2026-09-15',elapsedMs:1},updatedAt:'2026-09-15T12:00:00.000Z'};
  const authority={},owned=createHarness(new Map(),null,authority);
  assert.equal((await owned.app.activeSession.save(session,{expectedCanonical:null})).ok,true);
  const before=structuredClone(owned.stores.session.get('active'));
  const stale=await owned.app.activeSession.save({...before,revision:2},{expectedCanonical:null,recoveryFallback:true});
  assert.equal(stale.ok,false);assert.equal(stale.error?.code,'ACTIVE_SESSION_CHANGED');
  assert.equal((await owned.app.activeSession.clear({expectedCanonical:null})).ok,false);
  assert.deepEqual(owned.stores.session.get('active'),before);
  assert.equal(owned.sharedLocal.has('deletionRecovery'),false);
  // Cleanup must fail closed before the physical delete, even without a
  // deletion marker. The original canonical record is still recoverable.
  authority.failLocalRemoveKeys=new Set(['recovery']);
  const cleanupFailed=await owned.app.activeSession.clear({expectedCanonical:before});
  assert.equal(cleanupFailed.ok,false);
  assert.equal(cleanupFailed.storage.idb,false);
  assert.deepEqual(owned.stores.session.get('active'),before);
  assert.equal(owned.sharedLocal.has('deletionRecovery'),false);
  authority.failLocalRemoveKeys=null;
  let successorSave;
  authority.onTransactionComplete=({stores,mode})=>{
    if(mode!=='readwrite'||!stores.includes('session'))return;
    delete authority.onTransactionComplete;
    successorSave=owned.app.activeSession.save({...before,revision:3},{emergency:true});
  };
  const cleared=await owned.app.activeSession.clear({expectedCanonical:before});
  assert.equal(cleared.ok,false,'a committed deletion must not acknowledge a superseded clear');
  assert.equal(cleared.error?.code,'ACTIVE_SESSION_CHANGED');
  assert.equal((await successorSave).ok,true);
  assert.equal(owned.stores.session.get('active').revision,3);
}

// Plan and protected Preferences must fence the originating request at
// the actual metadata transaction, including its last queued write and
// post-commit acknowledgement. A post-commit rejection is not a rollback.
for(const target of ['plan','preferences','portable']){
  for(const stage of ['last-request','committed']){
    const events=[],controls={onCanonicalCommit:event=>events.push(event)},h=createHarness(new Map(),null,controls);
    await h.app.planData.writeDraft('before');
    const initial=await h.app.planData.read(),count=events.length;
    let current=true,checks=0;
    const assertOrigin=()=>{if(stage==='last-request'&&++checks>=3)current=false;if(!current)throw new Error('personal data request changed');};
    if(stage==='committed')controls.onTransactionComplete=({stores,mode})=>{if(mode==='readwrite'&&stores.includes('meta')){delete controls.onTransactionComplete;current=false;}};
    const replacement={draft:'after',savedPlans:[],defaultId:null};
    const work=target==='plan'?h.app.planData.replace(replacement,{assertOrigin}):target==='preferences'?h.app.personalPreferences.write({studentName:'After'},{assertOrigin}):h.app.planData.replacePortable({version:2,plans:replacement,preferences:{studentName:'After',theme:null,presentation:null,quote:null,practiceCueMode:null,fontScale:null,practiceTargetMs:null,nudge:null}},{assertOrigin});
    await assert.rejects(work,/personal data request changed/u);
    if(target!=='preferences')assert.equal((await h.app.planData.read()).draft,stage==='committed'?'after':initial.draft);
    if(target!=='plan')assert.equal((await h.app.personalPreferences.read())?.studentName??null,stage==='committed'?'After':null);
    assert.equal(events.length,count,'no stale Plan/preference commit announcement');
  }
}

const beforePlanDraftStrict=strictCount();
await app.planData.writeDraft('temporary draft');
assert.equal(strictCount(),beforePlanDraftStrict,'high-frequency Plan draft persistence must remain normal/default durability');
const beforePlanLibrary=strictCount();
await app.planData.writeLibrary({savedPlans:[],defaultId:null});
assert.ok(strictCount()>beforePlanLibrary,'saved Plan library commits must use strict durability');

const beforeFinalize=strictCount();
await app.activeSession.clear();
assert.ok(strictCount()>beforeFinalize,'active-session final deletion must use strict durability');


const beforeLease=strictCount();
await app.mutationLease.acquire(Object.freeze({id:'mutation_durability-boundary-0001',owner:'tab_durability-boundary-owner-0001',kind:'restore',expiresAt:clock.now()+60_000}));
assert.ok(strictCount()>beforeLease,'durable mutation-lease acquisition must use strict durability');
const beforeLeaseRelease=strictCount();
assert.equal(await app.mutationLease.release('mutation_durability-boundary-0001','tab_durability-boundary-owner-0001'),true,'normal lease release must actually remove the original lease');
assert.equal(strictCount(),beforeLeaseRelease,'mutation-lease release may remain normal because a stale lease expires fail-safe');

const libraryClearId='libraryclear_durability-boundary-0001';
const libraryClearPayload=Object.freeze({planSignature:'durability-signature',savedDays:Object.freeze({})});
const beforeLibraryClearJournal=strictCount();
await app.libraryClearJournal.prepare(Object.freeze({id:libraryClearId,signature:'durability-signature',payload:libraryClearPayload}));
await app.libraryClearJournal.mark(libraryClearId,'mutating');
assert.ok(strictCount()>=beforeLibraryClearJournal+2,'Library-clear safety-journal prepare and phase commits must use strict durability');
const beforeLibraryClear=strictCount();
await app.libraryClearJournal.clear(libraryClearId);
assert.equal(strictCount(),beforeLibraryClear+1,'Library-clear journal retirement must use strict durability so a verified destructive commit does not retain a stale rollback marker after an abrupt failure');

const beforeJournal=strictCount();
const restoreId='restore_durability-boundary-0001';
await app.restoreJournal.prepare(Object.freeze({id:restoreId,blob:new Blob(['backup']),filename:'durability.sdbackup',scheduleText:''}));
await app.restoreJournal.mark(restoreId,'committing');
assert.ok(strictCount()>=beforeJournal+2,'restore safety-journal prepare and phase commits must use strict durability');
const beforeJournalClear=strictCount();
await app.restoreJournal.clear(restoreId);
assert.equal(strictCount(),beforeJournalClear+1,'Restore journal retirement must use strict durability so a verified restore does not retain a stale rollback marker after an abrupt failure');

console.log(JSON.stringify({status:'PASS',suite:'strict-durability-boundaries',strictTransactions:idbDurability.strict,normalTransactions:idbDurability.normal,contracts:['review/session recovery checkpoints stay normal','canonical notes and records are strict','Daily Record conditional writes preserve newer same-date evidence','Daily Record post-commit authority loss is classified without fallback','saved plan library is strict while draft is normal','final session deletion is strict','destructive-operation journal prepare/phase/retirement is strict','mutation lease acquisition is strict while expiring lease cleanup stays normal']},null,2));
