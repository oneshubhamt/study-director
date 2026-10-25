import assert from 'node:assert/strict';
import {createHarness} from '../../helpers/repository-harness.mjs';
import {createFakeClock} from '../../helpers/fake-clock.mjs';

const clock=createFakeClock('2026-09-15T12:00:00.000Z');
const h=createHarness(new Map(),null,{clock});
const {app,idbDurability,stores}=h;
stores.meta.set('dailyRecordMigration',{key:'dailyRecordMigration',version:1,value:{recordVersion:1,summaryVersion:1,complete:true,recordCount:0},updatedAt:'2026-09-15T12:00:00.000Z'});
const strictCount=()=>idbDurability.strict;
const normalCount=()=>idbDurability.normal;

// High-frequency Review/Active Session checkpoints stay on normal/default durability.
await app.activeSession.save({id:'active',revision:1,date:'2026-09-15',status:'active',scheduleText:'',snapshot:{elapsedMs:1,review:{reflection:'draft',studyQuality:null}},updatedAt:'2026-09-15T12:00:00.000Z'});
assert.equal(strictCount(),0,'Review autosaves through Active Session must not force a storage flush');
assert.ok(normalCount()>0,'Review autosaves through Active Session must keep the normal transaction path');

const beforeSessionStrict=strictCount();
await app.activeSession.save({id:'active',revision:2,date:'2026-09-15',status:'active',scheduleText:'',snapshot:{elapsedMs:2,review:{reflection:'draft',studyQuality:null}},updatedAt:'2026-09-15T12:00:01.000Z'});
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

console.log(JSON.stringify({status:'PASS',suite:'strict-durability-boundaries',strictTransactions:idbDurability.strict,normalTransactions:idbDurability.normal,contracts:['review/session recovery checkpoints stay normal','canonical notes and records are strict','saved plan library is strict while draft is normal','final session deletion is strict','destructive-operation journal prepare/phase/retirement is strict','mutation lease acquisition is strict while expiring lease cleanup stays normal']},null,2));
