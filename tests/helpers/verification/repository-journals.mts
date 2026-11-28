import assert from 'node:assert/strict';
import {createHarness,type RepositoryControls} from '../repository-harness.mts';
import {method} from '../registered-exports.mts';
import {jsonArray,jsonObject,jsonString} from './read-verification.mts';
import {createFakeClock} from '../fake-clock.mts';

// The production journal owners run in the repository VM. Decode only the
// returned fields these assertions inspect, and leave malformed inputs intact.
function required<T>(value:T|null):T{assert.ok(value!==null,'expected durable journal evidence');return value;}
async function blobText(value:unknown){assert.ok(value instanceof Blob,'restore payload must retain its Blob');return value.text();}
function journal(owner:unknown){
  async function read(){const value=await method(owner,'read')();if(value===null)return null;const record=jsonObject(value);return {state:jsonObject(record['state']),payload:jsonObject(record['payload'])};}
  async function diagnostics(){const value=await method(owner,'diagnostics')();return value===null?null:jsonObject(value);}
  return {
    prepare:async(value:unknown,fence?:unknown)=>method(owner,'prepare')(value,fence),
    mark:async(id:string,phase:string,fence?:unknown)=>method(owner,'mark')(id,phase,fence),
    clear:async(id?:string,fence?:unknown)=>method(owner,'clear')(id,fence),
    read,diagnostics,readRequired:async()=>required(await read()),diagnosticsRequired:async()=>required(await diagnostics())
  };
}
function checkedHarness(...args:Parameters<typeof createHarness>){
  const h=createHarness(...args),owner=jsonObject(h.app),meta=h.journalMeta,lease=owner['mutationLease'];
  return {...h,app:{
    restoreJournal:journal(owner['restoreJournal']),libraryClearJournal:journal(owner['libraryClearJournal']),
    mutationLease:{acquire:async(value:unknown)=>jsonObject(await method(lease,'acquire')(value)),release:async(id:string,ownerId:string)=>method(lease,'release')(id,ownerId)},
    metadata:{diagnostics:async()=>jsonObject(await method(owner['metadata'],'diagnostics')())}
  },journalMeta:{
    write:async(name:string,value:unknown,options?:unknown)=>method(meta,'write')(name,value,options),
    remove:async(name:string,suffix?:string)=>method(meta,'remove')(name,suffix),
    read:async(name:string)=>jsonObject(await method(meta,'read')(name)),
    list:async(name:string)=>Array.from(jsonArray(await method(meta,'list')(name)),value=>{const row=jsonObject(value);return {suffix:jsonString(row['suffix']),value:jsonObject(row['value'])};})
  }};
}

const clock=createFakeClock('2026-09-13T06:00:00.000Z');
const {app,journalMeta,idbDurability,stores}=checkedHarness(new Map(),null,{clock});

const lease=await app.mutationLease.acquire(Object.freeze({
  id:'mutation_qa-journal-0001',owner:'tab_qa-journal-owner-0001',kind:'restore',expiresAt:clock.now()+60_000
}));
assert.equal(lease['acquired'],true,'durable mutation lease should acquire when no live holder exists');
const blocked=await app.mutationLease.acquire(Object.freeze({
  id:'mutation_qa-journal-0002',owner:'tab_qa-journal-owner-0002',kind:'library-clear',expiresAt:clock.now()+60_000
}));
assert.equal(blocked['acquired'],false,'a second durable mutation must observe the live holder');
await clock.advance(60_001);
const expiredTakeover=await app.mutationLease.acquire(Object.freeze({id:'mutation_qa-journal-0003',owner:'tab_qa-journal-owner-0003',kind:'restore',expiresAt:clock.now()+60_000}));
assert.equal(expiredTakeover['acquired'],true,'lease expiry is decided by the injected clock, not ambient wall time');
assert.equal(await app.mutationLease.release('mutation_qa-journal-0003','tab_qa-journal-owner-0003'),true);

const restoreId='restore_qa-journal-0001';
const blob=new Blob(['safety-copy']);
const rollbackDeletions=Object.freeze([Object.freeze({date:'2026-09-12',deletedAt:'2026-09-13T05:30:00.000Z'})]);
const rollbackNoteDeletions=Object.freeze([Object.freeze({key:'Ethics',deletedAt:'2026-09-13T05:31:00.000Z'})]);
const rollbackAttachmentDeletions=Object.freeze([Object.freeze({assetId:'img-journalabcdefghijklmnop',deletedAt:'2026-09-13T05:32:00.000Z'})]);
await app.restoreJournal.prepare(Object.freeze({id:restoreId,blob,filename:'qa.sdbackup',savedDayDeletions:rollbackDeletions,noteDeletions:rollbackNoteDeletions,attachmentDeletions:rollbackAttachmentDeletions}));
const restoreHeader=await app.restoreJournal.diagnosticsRequired();assert.equal(restoreHeader['phase'],'prepared');assert.equal(restoreHeader['blob'],undefined);assert.equal(restoreHeader['scheduleText'],undefined);
let restore=await app.restoreJournal.readRequired();
assert.equal(restore.state['id'],restoreId);
assert.equal(restore.state['phase'],'prepared');
assert.equal(await blobText(restore.payload['blob']),'safety-copy');
assert.equal(restore.payload['version'],6);assert.equal(Object.hasOwn(restore.payload,'scheduleText'),false,'restore journal no longer carries the independent Plan draft');
assert.equal(JSON.stringify(restore.payload['savedDayDeletions']),JSON.stringify(rollbackDeletions),'restore journal must persist the Saved-Day deletion ledger needed for exact rollback');
assert.equal(JSON.stringify(restore.payload['noteDeletions']),JSON.stringify(rollbackNoteDeletions),'restore journal must persist note deletion history for exact rollback');
assert.equal(JSON.stringify(restore.payload['attachmentDeletions']),JSON.stringify(rollbackAttachmentDeletions),'restore journal must persist Attachment Library deletion history for exact rollback');
const initialPayload=restore.payload;
for(const id of [restoreId,'restore_qa-journal-other']){
  await assert.rejects(()=>app.restoreJournal.prepare(Object.freeze({id,blob:new Blob(['MUST NOT REPLACE']),filename:'override.sdbackup'})),/still requires recovery/u,'new journal preparation must not overwrite an existing rollback');
}
assert.equal((await app.restoreJournal.readRequired()).state['id'],restoreId);
assert.equal(await blobText((await app.restoreJournal.readRequired()).payload['blob']),'safety-copy','original recovery data survives duplicate and competing journal preparations');

await app.restoreJournal.mark(restoreId,'committing');
restore=await app.restoreJournal.readRequired();
assert.equal(restore.state['phase'],'committing');
const restoreStrictBefore=idbDurability.strict,restoreNormalBefore=idbDurability.normal;
await app.restoreJournal.clear(restoreId);
assert.equal(idbDurability.strict,restoreStrictBefore+1,'restore journal retirement must use strict durability');
assert.equal(idbDurability.normal,restoreNormalBefore,'restore journal retirement must not fall back to a normal durability transaction');
assert.equal(await app.restoreJournal.read(),null,'restore journal should disappear only after explicit cleanup');
await assert.rejects(()=>app.restoreJournal.clear(restoreId),/disappeared before cleanup/u,'a named journal cannot silently disappear during cleanup');
await journalMeta.write('restoreJournalPayload',initialPayload);
await assert.rejects(()=>app.restoreJournal.read(),/incomplete or corrupted/u,'orphan payload must fail closed');
await assert.rejects(()=>app.restoreJournal.prepare(Object.freeze({id:'restore_qa-orphan-payload',blob:new Blob(['new']),filename:'new.sdbackup'})),/still requires recovery/u,'orphan payload cannot be overwritten');
await assert.rejects(()=>app.restoreJournal.clear(),/incomplete or mismatched/u,'clear must preserve orphaned rollback payload');
await journalMeta.remove('restoreJournalPayload');


const libraryClearId='libraryclear_qa-journal-0001';
const payload=Object.freeze({planSignature:'qa-signature',savedDays:Object.freeze({'2026-09-13':Object.freeze({date:'2026-09-13'})})});
await app.libraryClearJournal.prepare(Object.freeze({id:libraryClearId,signature:'qa-signature',payload}));
const libraryHeader=await app.libraryClearJournal.diagnosticsRequired();assert.equal(libraryHeader['phase'],'prepared');assert.equal(libraryHeader['payload'],undefined);
let libraryClear=await app.libraryClearJournal.readRequired();
assert.equal(libraryClear.state['id'],libraryClearId);
assert.equal(libraryClear.state['phase'],'prepared');
assert.deepEqual(libraryClear.payload,payload);
await app.libraryClearJournal.mark(libraryClearId,'mutating');
libraryClear=await app.libraryClearJournal.readRequired();
assert.equal(libraryClear.state['phase'],'mutating');
const libraryStrictBefore=idbDurability.strict,libraryNormalBefore=idbDurability.normal;
await app.libraryClearJournal.clear(libraryClearId);
assert.equal(idbDurability.strict,libraryStrictBefore+1,'library-clear journal retirement must use strict durability');
assert.equal(idbDurability.normal,libraryNormalBefore,'library-clear journal retirement must not fall back to a normal durability transaction');
assert.equal(await app.libraryClearJournal.read(),null,'library-clear journal should clear its state and chunk payload together');

// Historical restore-journal payloads are rejected without conversion.
const legacyId='restore_qa-journal-legacy1',legacyTime='2026-09-13T05:00:00.000Z';
const backupFile=Object.freeze({name:'backup-123e4567-e89b-12d3-a456-426614174000',size:64,hash:'a'.repeat(64)});
for(const payload of [
  Object.freeze({format:'study-director.restore-journal',version:1,id:legacyId,backupFile,filename:'legacy-v1.sdbackup'}),
  Object.freeze({format:'study-director.restore-journal',version:2,id:legacyId,blob:new Blob(['v2']),filename:'legacy-v2.sdbackup',savedDayDeletions:Object.freeze([{date:'2026-09-10',deletedAt:legacyTime}])}),
  Object.freeze({format:'study-director.restore-journal',version:3,id:legacyId,blob:new Blob(['v3']),filename:'legacy-v3.sdbackup',savedDayDeletions:Object.freeze([]),noteDeletions:Object.freeze([{key:'GS2',deletedAt:legacyTime}])})
]){
  await assert.rejects(()=>journalMeta.write('restoreJournalPayload',payload),/not canonical/u,`version ${payload.version} is not read by the ordinary runtime`);
}
await assert.rejects(()=>journalMeta.write('restoreJournalPayload',Object.freeze({format:'study-director.restore-journal',version:5,id:legacyId,blob:new Blob(['v5']),filename:'bad.sdbackup'})),/not canonical/u);
await journalMeta.remove('restoreJournalPayload');

// Invalid and mismatched mutation/journal operations fail closed rather than mutating another operation's state.
await assert.rejects(()=>app.mutationLease.acquire(Object.freeze({id:'bad',owner:'tab_qa-journal-owner-0004',kind:'restore',expiresAt:clock.now()+1000})),/invalid/u);
assert.equal(await app.mutationLease.release('bad','tab_qa-journal-owner-0004'),false);
const held=await app.mutationLease.acquire(Object.freeze({id:'mutation_qa-journal-0004',owner:'tab_qa-journal-owner-0004',kind:'restore',expiresAt:clock.now()+60_000}));assert.equal(held['acquired'],true);assert.equal(await app.mutationLease.release('mutation_qa-journal-wrong','tab_qa-journal-owner-0004'),false);assert.equal(await app.mutationLease.release('mutation_qa-journal-0004','tab_qa-journal-owner-0004'),true);
await assert.rejects(()=>app.restoreJournal.mark('bad','committing'),/phase is invalid/u);
await app.restoreJournal.prepare(Object.freeze({id:'restore_qa-journal-0002',blob:new Blob(['rollback']),filename:'qa2.sdbackup'}));
const original=await app.restoreJournal.readRequired();
await journalMeta.write('restoreJournalPayload',Object.freeze({...original.payload,id:'restore_qa-journal-other'}));
await assert.rejects(()=>app.restoreJournal.read(),/incomplete or corrupted/u,'a mismatched pair cannot be accepted');
await assert.rejects(()=>app.restoreJournal.clear('restore_qa-journal-0002'),/incomplete or mismatched/u,'a mismatched pair must not be retired');
await journalMeta.write('restoreJournalPayload',original.payload);

await assert.rejects(()=>app.restoreJournal.mark('restore_qa-journal-other','committing'),/identity changed/u);
await assert.rejects(()=>app.restoreJournal.clear('restore_qa-journal-other'),/identity changed/u);
await app.restoreJournal.clear();assert.equal(await app.restoreJournal.read(),null);
await assert.rejects(()=>app.libraryClearJournal.prepare(Object.freeze({id:'bad',signature:'x',payload:{}})),/input is invalid/u);
await app.libraryClearJournal.prepare(Object.freeze({id:'libraryclear_qa-journal-0002',signature:'sig2',payload:Object.freeze({planSignature:'sig2',savedDays:Object.freeze({})})}));
await assert.rejects(()=>app.libraryClearJournal.prepare(Object.freeze({id:'libraryclear_qa-journal-0003',signature:'sig3',payload:Object.freeze({planSignature:'sig3'})})),/still requires recovery/u);
await assert.rejects(()=>app.libraryClearJournal.mark('bad','mutating'),/phase is invalid/u);
await assert.rejects(()=>app.libraryClearJournal.mark('libraryclear_qa-journal-other','mutating'),/identity changed/u);
await assert.rejects(()=>app.libraryClearJournal.clear('libraryclear_qa-journal-other'),/identity changed/u);
await app.libraryClearJournal.clear();assert.equal(await app.libraryClearJournal.read(),null);

console.log(JSON.stringify({status:'PASS',suite:'repository-journals',contracts:['exclusive durable mutation lease','restore journal lifecycle','library-clear chunked integrity journal lifecycle']},null,2));

// Missing payloads do not make the header-only diagnostic call read or repair payloads.
await app.restoreJournal.prepare(Object.freeze({id:'restore_qa-diagnostic-0001',blob:new Blob(['PRIVATE DATA']),filename:'private.sdbackup'}));
assert.ok(stores.meta.has('restoreJournalPayload'));stores.meta.delete('restoreJournalPayload');assert.equal((await app.restoreJournal.diagnosticsRequired())['phase'],'prepared');assert.equal(stores.meta.has('restoreJournalPayload'),false,'diagnostics must not repair or write a missing payload');
assert.equal((await app.metadata.diagnostics())['maintenanceStatus'],'never');assert.equal((await app.metadata.diagnostics())['deletions'],0);assert.equal((await app.metadata.diagnostics())['localRecovery'],false);
await assert.rejects(()=>app.restoreJournal.clear(),/incomplete or mismatched/u,'state-only journal must be preserved for manual recovery');
await journalMeta.remove('restoreJournalState');await app.restoreJournal.clear();assert.equal(await app.restoreJournal.diagnostics(),null);assert.equal(await app.libraryClearJournal.diagnostics(),null);
console.log(JSON.stringify({status:'PASS',suite:'read-only-data-diagnostics',headerOnly:true,noPayloadRepair:true,metadataSummary:true},null,2));

{const failures=new Set(['deletionRecovery']),h=checkedHarness(new Map(),null,{failLocalGetKeys:failures});await assert.rejects(h.app.metadata.diagnostics(),/local recovery read failure/u);}

{
  const request={id:'mutation_qa-journal-0005',owner:'tab_qa-journal-owner-0005',kind:'restore',expiresAt:clock.now()+1000};
  assert.equal((await app.mutationLease.acquire(request))['acquired'],true);
  assert.equal((await app.mutationLease.acquire({...request,owner:'tab_qa-journal-owner-other'}))['acquired'],false,'same ID does not grant a different owner a live lease');
  assert.equal(await app.mutationLease.release(request.id,'tab_qa-journal-owner-other'),false,'release requires exact owner as well as ID');
  assert.equal((await app.mutationLease.acquire({...request,renew:true,expiresAt:clock.now()+1000}))['acquired'],true);
  assert.equal(await app.mutationLease.release(request.id,request.owner),true);
  assert.equal((await app.mutationLease.acquire({...request,renew:true,expiresAt:clock.now()+1000}))['acquired'],false,'retired lease cannot be resurrected by renewal');
  assert.equal((await app.mutationLease.acquire({...request,expiresAt:clock.now()-1}))['acquired'],false,'expired request cannot acquire');
}

{
  const request={id:'mutation_journal_fence_12345',owner:'tab_journal_fence_owner',kind:'restore',expiresAt:clock.now()+60000};
  assert.equal((await app.mutationLease.acquire(request))['acquired'],true);
  const library={id:'libraryclear_fence_12345',signature:'qa-signature',payload},restore={id:'restore_fence_12345',blob,filename:'qa.sdbackup'};
  for(const [journal,value] of [[app.libraryClearJournal,library],[app.restoreJournal,restore]] as const){
    let checks=0;const stale={id:request.id,owner:request.owner,assert(){if(++checks===2)throw new Error('injected owner loss at write boundary');return true;}};
    await assert.rejects(journal.prepare(value,stale),/injected owner loss/u);assert.equal(await journal.read(),null);
    const fence={id:request.id,owner:request.owner,assert:()=>true};
    await journal.prepare(value,fence);
    const other={...fence,owner:'tab_journal_other_owner'};
    await assert.rejects(journal.mark(value.id,'verified',other),/original durable mutation lease/u);
    await assert.rejects(journal.clear(value.id,other),/original durable mutation lease/u);
    assert.equal((await journal.readRequired()).state['phase'],'prepared');
    checks=0;await assert.rejects(journal.mark(value.id,'verified',stale),/injected owner loss/u);assert.equal((await journal.readRequired()).state['phase'],'prepared');
    checks=0;await assert.rejects(journal.clear(value.id,stale),/injected owner loss/u);assert.equal((await journal.readRequired()).state['id'],value.id);
    await journal.mark(value.id,'verified',fence);await journal.clear(value.id,fence);assert.equal(await journal.read(),null);
  }
  await app.mutationLease.release(request.id,request.owner);
  await assert.rejects(app.restoreJournal.prepare(restore,{id:request.id,owner:request.owner,assert:()=>true}),/original durable mutation lease/u);
}
{
  await app.libraryClearJournal.prepare({id:'libraryclear_orphan_12345',signature:'qa-signature',payload});
  await journalMeta.remove('libraryClearJournalState');
  await assert.rejects(app.libraryClearJournal.read(),/orphaned payload chunks/u);
  await assert.rejects(app.libraryClearJournal.prepare({id:'libraryclear_other_12345',signature:'qa-signature',payload}),/Orphaned Library-clear journal chunks/u);
  await assert.rejects(app.libraryClearJournal.clear(),/unmatched recovery evidence/u);
  const rows=await journalMeta.list('libraryClearJournalPayloadPrefix');assert.ok(rows.length>0);
  for(const row of rows)await journalMeta.remove('libraryClearJournalPayloadPrefix',row.suffix);
}
console.log('PASS: original durable journal fence and orphan preservation');


// A fresh registered runtime must see the exact rollback data after a rejected
// prepare, phase update or retirement. Use a separate store per journal family.
for(const kind of ['restore','library-clear']){
  const h=checkedHarness(new Map(),null,{clock});
  const controls:RepositoryControls={clock};
  const runtime=()=>checkedHarness(h.sharedLocal,h.stores,controls);
  let current=runtime();
  const journal=()=>kind==='restore'?current.app.restoreJournal:current.app.libraryClearJournal;
  const id=kind==='restore'?'restore_qa_restart_failure':'libraryclear_qa_restart_failure';
  const headerKey=kind==='restore'?'restoreJournalState':'libraryClearJournalState';
  const laterPutKey=kind==='restore'?'restoreJournalPayload':`libraryClearJournalPayload:${id}:00000001`;
  const laterDeleteKey=kind==='restore'?'restoreJournalPayload':headerKey;
  const rollbackText='A'.repeat(512*1024+32);
  const expected=kind==='restore'?{id,blob:new Blob([rollbackText]),filename:'restart.sdbackup'}:
    {id,signature:'restart-signature',payload:{planSignature:'restart-signature',savedDays:{},rollbackText}};
  const verify=async(phase:string)=>{
    const durable=await journal().readRequired();
    assert.equal(durable.state['id'],id);
    assert.equal(durable.state['phase'],phase);
    if(kind==='restore')assert.equal(await blobText(durable.payload['blob']),rollbackText);
    else {
      assert.equal(durable.state['chunkCount'],2);
      assert.equal(durable.payload['rollbackText'],rollbackText);
      assert.equal(durable.payload['planSignature'],'restart-signature');
    }
  };
  controls.failNextMetaWrite=true;
  await assert.rejects(journal().prepare(expected),/injected appMeta write failure/u);
  current=runtime();
  assert.equal(await journal().read(),null,'rejected journal preparation must leave no rollback evidence');
  assert.equal(h.stores.meta.size,0);
  controls.failNextMetaRequest={operation:'put',key:laterPutKey};
  await assert.rejects(journal().prepare(expected),/transaction aborted|injected appMeta request failure/u);
  assert.equal(controls.failNextMetaRequest,undefined,'the later preparation request must actually fail');
  current=runtime();
  assert.equal(await journal().read(),null,'a failed later put rolls back every earlier journal put');
  assert.equal(h.stores.meta.size,0,'no partial header or chunk survives the aborted transaction');
  let before=current.idbDurability.strict,normal=current.idbDurability.normal;
  await journal().prepare(expected);
  assert.equal(current.idbDurability.strict,before+1,'journal preparation uses a strict transaction');
  assert.equal(current.idbDurability.normal,normal);
  current=runtime();
  await verify('prepared');
  controls.failNextMetaWrite=true;
  await assert.rejects(journal().mark(id,'verified'),/injected appMeta write failure/u);
  current=runtime();
  await verify('prepared');
  controls.failNextMetaRequest={operation:'put',key:headerKey};
  await assert.rejects(journal().mark(id,'verified'),/transaction aborted|injected appMeta request failure/u);
  assert.equal(controls.failNextMetaRequest,undefined);
  current=runtime();
  await verify('prepared');
  before=current.idbDurability.strict;normal=current.idbDurability.normal;
  await journal().mark(id,'verified');
  assert.equal(current.idbDurability.strict,before+1,'journal phase publication uses a strict transaction');
  assert.equal(current.idbDurability.normal,normal);
  current=runtime();
  await verify('verified');
  const committedRows=structuredClone(h.stores.meta);
  controls.failNextMetaRequest={operation:'get',key:headerKey};
  await assert.rejects(journal().read(),/transaction aborted|injected appMeta request failure/u);
  assert.equal(controls.failNextMetaRequest,undefined);
  assert.deepEqual(h.stores.meta,committedRows,'failed readback must not change committed recovery rows');
  current=runtime();
  await verify('verified');
  controls.failNextMetaWrite=true;
  await assert.rejects(journal().clear(id),/injected appMeta write failure/u);
  current=runtime();
  await verify('verified');
  controls.failNextMetaRequest={operation:'delete',key:laterDeleteKey};
  await assert.rejects(journal().clear(id),/transaction aborted|injected appMeta request failure/u);
  assert.equal(controls.failNextMetaRequest,undefined,'the later cleanup request must actually fail');
  current=runtime();
  await verify('verified');
  assert.deepEqual(h.stores.meta,committedRows,'an aborted cleanup must restore every removed recovery row');
  if(kind==='library-clear'){
    // Change one ASCII byte without changing the size or JSON validity.
    const chunks=await current.journalMeta.list('libraryClearJournalPayloadPrefix');
    assert.equal(chunks.length,2);
    const row=chunks.find(entry=>entry.value['index']===0);
    assert.ok(row);
    const heldBytes=row.value['bytes'];assert.ok(heldBytes instanceof Uint8Array);
    const bytes=new Uint8Array(heldBytes),offset=bytes.indexOf(65);
    assert.ok(offset>=0);
    bytes[offset]=66;
    await current.journalMeta.write('libraryClearJournalPayloadPrefix',{...row.value,bytes},{suffix:row.suffix,strict:true});
    current=runtime();
    await assert.rejects(journal().read(),/failed integrity verification/u,'same-length rollback corruption must fail closed');
    assert.equal((await current.journalMeta.list('libraryClearJournalPayloadPrefix')).length,2,'failed verification must retain both recovery chunks');
    await current.journalMeta.write('libraryClearJournalPayloadPrefix',row.value,{suffix:row.suffix,strict:true});
    await verify('verified');
    const header=await current.journalMeta.read('libraryClearJournalState');
    await current.journalMeta.write('libraryClearJournalState',{...header,signatureHash:'0'.repeat(64)},{strict:true});
    current=runtime();
    await assert.rejects(journal().read(),/plan signature does not verify/u,'a valid payload digest cannot authorize a mismatched plan signature');
    assert.equal((await current.journalMeta.list('libraryClearJournalPayloadPrefix')).length,2);
    await current.journalMeta.write('libraryClearJournalState',header,{strict:true});
    await verify('verified');
  }
  await journal().clear(id);
  current=runtime();
  assert.equal(await journal().read(),null,'completed journal retirement survives restart');
  assert.equal(h.stores.meta.size,0);
}
console.log('PASS: journal failure/restart, aborted requests, readback, strict publication and multi-chunk integrity');
