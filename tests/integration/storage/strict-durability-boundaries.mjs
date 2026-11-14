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
  const context=vm.createContext({console,Promise,Object,Symbol,Error,TypeError,String,Number,Math,Array,Set,Map,WeakMap,Date,setTimeout,clearTimeout,queueMicrotask,HTMLTextAreaElement:class{}});
  vm.runInContext(readRuntimeSource('source/core/internal.ts'),context,{filename:'source/core/internal.ts'});
  vm.runInContext(readRuntimeSource('source/core/review-persistence.ts'),context,{filename:'source/core/review-persistence.ts'});
  const module=context[Symbol.for('studyDirector.internalModules.v1')].require('review-persistence',1);
  const persistence=module.createPersistence(Object.freeze({
    configuration:Object.freeze({limits:Object.freeze({maxReflectionChars:5000,maxRichTextWords:1000}),dataContract:Object.freeze({schemas:Object.freeze({DailyRecord:Object.freeze({version:1})})})}),
    records:Object.freeze({
      get:async(target,options)=>{
        const value=await app.dailyRecords.get(target,options);
        if(!intercepted&&options?.strict===true){intercepted=true;enteredResolve();await release;}
        return value;
      },
      save:(...args)=>app.dailyRecords.save(...args),
      remove:(...args)=>app.dailyRecords.remove(...args),
      verifyCanonical:(...args)=>app.dailyRecords.verifyCanonical(...args),
      verifyCanonicalAbsent:(...args)=>app.dailyRecords.verifyCanonicalAbsent(...args),
      timestamp:(...args)=>app.dailyRecords.timestamp(...args)
    }),
    codec:Object.freeze({createDiaryRecord:()=>{throw new Error('study-record path must not create a diary record');}}),
    ownership:Object.freeze({canMutate:()=>true,revision:()=>1}),
    text:Object.freeze({clampEditorContent:value=>String(value??''),editorContentWithinLimits:()=>true,plain:value=>String(value??''),isRich:()=>false}),
    richText:Object.freeze({closeField:()=>true,syncField:()=>true,validatedInput:()=>null}),
    dates:Object.freeze({isSupported:value=>/^\d{4}-\d{2}-\d{2}$/.test(value),insights:()=>Object.freeze({dayOfWeek:3,dayName:'Wednesday'})}),
    saveLane:Object.freeze({}),environment:Object.freeze({nowIso:()=> '2026-09-16T08:02:00.000Z',queueMicrotask,setTimeout,clearTimeout})
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
await app.mutationLease.release('mutation_durability-boundary-0001');
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

console.log(JSON.stringify({status:'PASS',suite:'strict-durability-boundaries',strictTransactions:idbDurability.strict,normalTransactions:idbDurability.normal,contracts:['review/session recovery checkpoints stay normal','canonical notes and records are strict','Daily Record conditional writes preserve newer same-date evidence','saved plan library is strict while draft is normal','final session deletion is strict','destructive-operation journal prepare/phase/retirement is strict','mutation lease acquisition is strict while expiring lease cleanup stays normal']},null,2));
