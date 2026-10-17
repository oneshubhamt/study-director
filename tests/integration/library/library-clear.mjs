import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {createHarness} from '../../helpers/repository-harness.mjs';
import {noteRow} from '../../helpers/note-ids.mjs';
import assert from 'node:assert/strict';

// Library clear is one transactional contract: planning, scaling, reference rewrites, rollback, and commit semantics.

{ // library-clear-reference-index
const context={console,Map,Set,Object,Promise,Number,String,Math,Date,JSON,structuredClone};
context.globalThis=context;
vm.createContext(context);
for(const file of ['source/core/internal.js','source/core/library-clear.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
const libraryClear=context[Symbol.for('studyDirector.internalModules.v1')].require('library-clear',1);

let membershipProbes=0;
const referencedIds={
  *[Symbol.iterator](){yield 'att-aaaaaaaaaaaaaaaaaaaa';yield 'att-bbbbbbbbbbbbbbbbbbbb';},
  has(){membershipProbes++;return false;}
};
const sources=Array.from({length:30},(_,index)=>({kind:'note',key:`n${index}`,label:`N${index}`,ids:referencedIds}));
const attachments=Array.from({length:50},(_,index)=>({id:`att-${String(index).padStart(20,'0')}`,name:'x'}));
attachments[0]={id:'att-aaaaaaaaaaaaaaaaaaaa'};
attachments[1]={id:'att-bbbbbbbbbbbbbbbbbbbb'};

const plan=libraryClear.createPlan({selection:{attachments:true},attachments,sources});
assert.equal(membershipProbes,0,'Library-clear planning must build an inverted reference index instead of probing every source for every attachment.');
assert.deepEqual([...plan.attachments.protectedIds].sort(),['att-aaaaaaaaaaaaaaaaaaaa','att-bbbbbbbbbbbbbbbbbbbb'],'Both referenced attachments must be identified.');
assert.equal(plan.attachments.rewriteTargets.length,30,'Each affected source must produce one grouped rewrite target.');

console.log(JSON.stringify({status:'PASS',attachments:attachments.length,sources:sources.length,membershipProbes},null,2));
}

{ // library-clear-rollback-state
const context={console,Object,Promise,Map,Set,Date,String,Number,Array,Error,TypeError,structuredClone,Symbol,JSON,Math};
context.globalThis=context;vm.createContext(context);
for(const file of ['source/core/internal.js','source/core/library-clear.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
const registry=context[Symbol.for('studyDirector.internalModules.v1')];
const libraryClear=registry.require('library-clear',1);

function noopData(){
  return {
    notes:{readFreshPayload:async()=>({}),replace:async()=>{},updateValidatedRich:()=>({status:'unchanged'}),flush:async()=>true,failure:()=>({failed:false})},
    dailyRecords:{get:async()=>null,list:async()=>[],saveBatch:async()=>{},restoreBatch:async()=>{}},
    activeSession:{load:async()=>({ok:true,value:null,error:null}),nextRevision:()=>1,save:async()=>({ok:true}),clear:async()=>({ok:true})}
  };
}
function createState({data=noopData(),references={},attachments={},review={},nowIso=()=> '2026-09-13T00:00:00.000Z'}={}){
  return libraryClear.createState({
    createRollbackScope:(plan,policy)=>libraryClear.createRollbackScope(plan,policy),
    withPersistenceSuppressed:async operation=>operation(),data,
    references:{scan:references.scan||(()=>({trusted:true,assetIds:[]})),remove:references.remove||((value)=>({value,removed:{total:0}})),listSources:references.listSources||(async()=>[])},
    attachments:{inventory:attachments.inventory||(async()=>[]),verifyMetadata:attachments.verifyMetadata||(async()=>true),restoreMetadata:attachments.restoreMetadata||(async()=>true)},
    review:{hydrate:review.hydrate||(()=>{}),invalidateBindings:review.invalidateBindings||(()=>{})},
    nowIso
  });
}

// Sparse rollback touches only journaled Notes; full rollback replaces the collection.
{
  const notes={target:{key:'target',label:'Target',text:'mutated',updatedAt:'rev2'},unrelated:{key:'unrelated',label:'Unrelated',text:'keep-me',updatedAt:'u1'}};
  let replaces=0,updates=0;
  const data=noopData();
  data.notes={
    readFreshPayload:async()=>structuredClone(notes),
    replace:async payload=>{replaces++;for(const key of Object.keys(notes))delete notes[key];Object.assign(notes,structuredClone(payload));},
    updateValidatedRich:(key,label,text,expected)=>{assert.equal(expected,notes[key]?.updatedAt||'');updates++;notes[key]={...notes[key],key,label,text,updatedAt:'restored'};return {status:'changed'};},
    flush:async()=>true,failure:()=>({failed:false})
  };
  const state=createState({data});
  const base={format:'study-director.library-clear-rollback',version:1,attachmentMetadata:[],dailyRecords:null,sessionCaptured:false,activeSession:null};
  await state.restore({...base,notes:{mode:'selected',entries:{target:{key:'target',label:'Target',text:'original',updatedAt:'rev1'}}}});
  assert.equal(updates,1);assert.equal(replaces,0);assert.equal(notes.target.text,'original');assert.equal(notes.unrelated.text,'keep-me');
  await state.restore({...base,notes:{mode:'all',entries:{only:{key:'only',label:'Only',text:'all-original',updatedAt:'x'}}}});
  assert.equal(replaces,1);assert.deepEqual(Object.keys(notes),['only']);
}

// Many references in one document are transformed and persisted once.
{
  const ids=Array.from({length:50},(_,i)=>`att-${String(i+1).padStart(20,'0')}`),token=id=>`[[${id}]]`,starting=ids.map(token).join(' ');
  let transforms=0,updates=0,flushes=0,reads=0;
  const notes={biology:{key:'biology',label:'Biology',text:starting,updatedAt:'r1'}};
  const scan=value=>({trusted:true,assetIds:ids.filter(id=>String(value).includes(token(id)))});
  const data=noopData();
  data.notes={readFreshPayload:async()=>{reads++;return structuredClone(notes);},updateValidatedRich:(key,label,text)=>{updates++;notes[key]={...notes[key],label,text,updatedAt:'r2'};return {status:'changed'};},flush:async()=>{flushes++;},failure:()=>({failed:false}),replace:async()=>{}};
  const state=createState({data,references:{scan,remove:(value,targetIds)=>{transforms++;let next=String(value);for(const id of targetIds)next=next.replaceAll(token(id),'');return {value:next,removed:{total:[...targetIds].length}};}}});
  const changed=await state.rewriteReferences([{kind:'note',key:'biology',label:'Biology',attachmentIds:ids}]);
  assert.equal(changed,1);assert.equal(transforms,1);assert.equal(updates,1);assert.equal(flushes,1);assert.equal(scan(notes.biology.text).assetIds.length,0);assert.ok(reads<=2);
}

// Full and sparse Saved-Day rollback preserve the intended scope.
{
  const notes={},days=new Map();let noteReplaces=0,dayRestoreBatches=0;
  const data=noopData();
  data.notes={readFreshPayload:async()=>structuredClone(notes),replace:async payload=>{noteReplaces++;for(const key of Object.keys(notes))delete notes[key];Object.assign(notes,structuredClone(payload));},updateValidatedRich:(key,label,text)=>{notes[key]={key,label,text,updatedAt:'restored'};return {status:'changed'};},flush:async()=>true,failure:()=>({failed:false})};
  data.dailyRecords={get:async key=>days.get(key)||null,list:async()=>[...days.values()].map(row=>structuredClone(row)),saveBatch:async()=>{},restoreBatch:async rows=>{dayRestoreBatches++;for(const row of rows)days.set(row.date,structuredClone(row));}};
  const state=createState({data});
  const full={format:'study-director.library-clear-rollback',version:1,attachmentMetadata:[],notes:{mode:'all',entries:{a:{key:'a',label:'A',text:'one'},b:{key:'b',label:'B',text:'two'}}},dailyRecords:{mode:'all',entries:[{date:'2026-09-01',reflection:'r1'},{date:'2026-09-02',reflection:'r2'}]},sessionCaptured:false,activeSession:null};
  await state.restore(full);assert.equal(noteReplaces,1);assert.deepEqual(Object.keys(notes).sort(),['a','b']);assert.deepEqual([...days.keys()].sort(),['2026-09-01','2026-09-02']);assert.equal(dayRestoreBatches,1);
  days.set('2026-09-99',{date:'2026-09-99',reflection:'unrelated'});days.set('2026-09-01',{date:'2026-09-01',reflection:'mutated'});
  const sparse={...full,notes:null,dailyRecords:{mode:'selected',entries:[{date:'2026-09-01',reflection:'original'}]}};
  await state.restore(sparse);assert.equal(days.get('2026-09-01').reflection,'original');assert.equal(days.get('2026-09-99').reflection,'unrelated');
  await state.verifyRestore(sparse);
}

// Capture is sparse for retained collections and full for selected-for-deletion collections.
{
  const inventory=[{id:'att-00000000000000000001',name:'A',type:'application/pdf',size:1,hash:'a'.repeat(64),library:true}];
  const notePayload={target:{key:'target',label:'Target',text:'with attachment',updatedAt:'r1'},unrelated:{key:'unrelated',label:'Unrelated',text:'keep',updatedAt:'u1'}};
  const data=noopData();data.notes={readFreshPayload:async()=>structuredClone(notePayload),replace:async()=>{},updateValidatedRich:()=>({status:'unchanged'}),flush:async()=>true,failure:()=>({failed:false})};
  const state=createState({data,attachments:{inventory:async()=>structuredClone(inventory),verifyMetadata:async()=>true}});
  const rewriteTargets=[{kind:'note',key:'target',label:'Target',attachmentIds:[inventory[0].id]}];
  const plan={selection:{savedDays:false,notes:false,attachments:true},signature:'sig',attachments:{rewriteTargets}};
  const sparse=await state.capture(plan,{forceReferenced:true,deleteIds:[inventory[0].id]});
  assert.equal(sparse.notes.mode,'selected');assert.deepEqual(Object.keys(sparse.notes.entries),['target']);assert.equal(sparse.notes.entries.unrelated,undefined);
  const full=await state.capture({...plan,selection:{...plan.selection,notes:true}},{forceReferenced:true,deleteIds:[inventory[0].id]});
  assert.equal(full.notes.mode,'all');assert.deepEqual(Object.keys(full.notes.entries).sort(),['target','unrelated']);
}

// ActiveSession reference rewrites and rollback must synchronize the live Review state with canonical storage.
{
  const id='att-00000000000000000001',token=`[[${id}]]`;let session={id:'current',date:'2026-09-13',revision:1,snapshot:{review:{reflection:token,studyQuality:4}}};
  const hydration=[];const data=noopData();
  data.activeSession={load:async()=>({ok:true,value:structuredClone(session),error:null}),nextRevision:()=>session.revision+1,save:async row=>{session=structuredClone(row);return {ok:true,value:structuredClone(row)};},clear:async()=>({ok:true})};
  const scan=value=>({trusted:true,assetIds:String(value).includes(id)?[id]:[]});
  const state=createState({data,references:{scan,remove:value=>({value:String(value).replace(token,''),removed:{total:1}})},review:{hydrate:options=>hydration.push(structuredClone(options)),invalidateBindings:()=>hydration.push('invalidate')}});
  assert.equal(await state.rewriteReferences([{kind:'session',key:'current',label:'Session',attachmentIds:[id],expectedValue:token}]),1);
  assert.equal(session.snapshot.review.reflection,'');assert.equal(hydration[0].snapshotReview.reflection,'','canonical session rewrite must hydrate the transformed Review state');assert.equal(hydration[1],'invalidate');
  const rollback={format:'study-director.library-clear-rollback',version:1,attachmentMetadata:[],notes:null,dailyRecords:null,sessionCaptured:true,activeSession:{id:'current',date:'2026-09-13',revision:1,snapshot:{review:{reflection:token,studyQuality:4}}}};
  await state.restore(rollback);
  assert.equal(session.snapshot.review.reflection,token);assert.equal(hydration[2].snapshotReview.reflection,token,'ActiveSession rollback must hydrate the restored canonical Review state');assert.equal(hydration[3],'invalidate');
}

console.log(JSON.stringify({status:'PASS',suite:'library-clear-rollback-state',checks:28},null,2));
}

{ // library-clear-scaling
const context={console,Map,Set,Object,Promise,Number,String,Math,Date,JSON,structuredClone};
context.globalThis=context;vm.createContext(context);
for(const file of ['source/core/internal.js','source/core/library-clear.js']){
  vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
}
const mod=context[Symbol.for('studyDirector.internalModules.v1')].require('library-clear',1);
const id=n=>`att-${String(n).padStart(20,'0')}`;
const attachments=Array.from({length:50},(_,i)=>({id:id(i+1)}));
const allIds=new Set(attachments.map(row=>row.id));
const sources=[
  {kind:'note',key:'biology',label:'Biology',ids:new Set(allIds)},
  {kind:'day',key:'2026-09-10',label:'Reflection · 2026-09-10',ids:new Set([id(1),id(2)])},
  {kind:'session',key:'current',label:'Unsaved Review · current session',ids:new Set([id(3)])},
  {kind:'note',key:'unrelated',label:'Unrelated',ids:new Set()}
];

const forcePlan=mod.createPlan({selection:{savedDays:false,notes:false,attachments:true},attachments,sources});
assert.equal(forcePlan.attachments.rewriteTargets.length,3,'references must be grouped by canonical source');
const biology=forcePlan.attachments.rewriteTargets.find(target=>target.kind==='note'&&target.key==='biology');
assert.ok(biology,'Biology rewrite target is missing');
assert.equal(biology.attachmentIds.length,50,'all attachment ids in one note must be grouped into one rewrite target');
assert.deepEqual([...biology.attachmentIds],attachments.map(row=>row.id),'rewrite ids must be stable and sorted');

const scope=mod.createRollbackScope(forcePlan,{forceReferenced:true,deleteIds:attachments.map(row=>row.id)});
assert.equal(scope.notes.mode,'selected');
assert.deepEqual([...scope.notes.keys],['biology'],'retained Notes must capture only surgically rewritten note keys');
assert.equal(scope.savedDays.mode,'selected');
assert.deepEqual([...scope.savedDays.keys],['2026-09-10'],'retained Saved Days must capture only surgically rewritten day keys');
assert.equal(scope.session.capture,true);
assert.deepEqual([...scope.session.keys],['current']);

const fullPlan=mod.createPlan({selection:{savedDays:true,notes:true,attachments:true},attachments,sources});
const fullScope=mod.createRollbackScope(fullPlan,{forceReferenced:true,deleteIds:attachments.map(row=>row.id)});
assert.equal(fullScope.notes.mode,'all','whole Notes deletion must retain a full collection rollback snapshot');
assert.equal(fullScope.savedDays.mode,'all','whole Saved Days deletion must retain a full collection rollback snapshot');
assert.equal(fullScope.session.capture,true,'unsaved Review state is never a Clear Library collection checkbox but must be captured when its attachment references are rewritten');
assert.deepEqual([...fullScope.session.keys],['current']);

let removeCalls=0,receivedTargets=null;
const fixtureSnapshot={attachments,sources};
const coordinator=mod.createCoordinator({
  runExclusive:async(_kind,fn)=>fn(),assertAuthority:()=>true,canMutate:()=>true,assertEligible:async()=>{},settle:async()=>{},snapshot:async()=>fixtureSnapshot,createProtectedSafety:async()=>({verified:true}),
  capture:async(plan,policy)=>({format:'test',plan,policy}),deleteNotes:async()=>({count:0}),deleteSavedDays:async()=>({count:0}),
  removeReferences:async targets=>{removeCalls++;receivedTargets=targets;return targets.length;},verifyLogical:async()=>{},removeAttachmentMetadata:async ids=>({removed:ids.length}),verifyFinal:async()=>{},
  restore:async()=>{},verifyRestore:async()=>{},sweep:async()=>0,failClosed:()=>{},clearFault:()=>{},
  journal:{prepare:async input=>({state:{id:input.id},payload:input.payload}),read:async()=>null,mark:async()=>{},clear:async()=>{}}
});
const preflight=await coordinator.preflight({savedDays:false,notes:false,attachments:true});
await coordinator.execute({selection:preflight.selection,signature:preflight.signature,forceReferenced:true});
assert.equal(removeCalls,1,'bulk force-delete must invoke the reference-rewrite phase once');
assert.ok(Array.isArray(receivedTargets)&&receivedTargets.length===3,'coordinator must pass grouped per-source rewrite targets');
assert.equal(receivedTargets.find(target=>target.key==='biology').attachmentIds.length,50,'coordinator must preserve multi-id grouping');

console.log(JSON.stringify({status:'PASS',suite:'library-clear-scaling',checks:14},null,2));
}

{ // library-clear-transaction
const context={console,Map,Set,Object,Promise,Number,String,Math,Date,JSON,structuredClone,crypto:globalThis.crypto};
context.globalThis=context;vm.createContext(context);
for(const file of ['source/core/internal.js','source/core/library-clear.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
const mod=context[Symbol.for('studyDirector.internalModules.v1')].require('library-clear',1);
const A='att-aaaaaaaaaaaaaaaaaaaa',B='att-bbbbbbbbbbbbbbbbbbbb';
const baseSnapshot=()=>({attachments:[{id:A},{id:B}],sources:[{kind:'note',key:'n1',label:'N1',ids:new Set([B])},{kind:'session',key:'current',label:'Session reflection · 2026-09-11',ids:new Set([B])}]});
function fixture({failAt='',stale=false,recoveryJournal=null,readFailure=false,canMutate=true,diagnostics}={}){
  const order=[];let journal=recoveryJournal,closed=false,fault='',restored=0,snapshot=baseSnapshot();
  const failures=new Set(Array.isArray(failAt)?failAt:[failAt].filter(Boolean));
  const fail=phase=>{if(failures.has(phase))throw new Error('injected '+phase);};
  const ports={
    diagnostics,
    runExclusive:async(kind,fn)=>{order.push('lock:'+kind);return fn();},
    canMutate:()=>canMutate,
    assertAuthority:()=>true,
    assertEligible:async()=>{order.push('eligible');fail('eligible');},
    settle:async()=>{order.push('settle');fail('settle');},
    snapshot:async()=>{order.push('snapshot');fail('snapshot');return stale?{attachments:snapshot.attachments,sources:[...snapshot.sources,{kind:'note',key:'n2',label:'N2',ids:new Set([A])}]}:snapshot;},
    createProtectedSafety:async purpose=>{order.push('safety:'+purpose);fail('safety');return {verified:true,purpose};},
    capture:async(plan,policy)=>{order.push('capture');fail('capture');return {format:'fixture',planSignature:plan.signature,policy,original:true};},
    journal:{
      prepare:async value=>{order.push('journal:prepare');fail('prepare');journal={state:{id:value.id,phase:'prepared'},payload:value.payload};return journal;},
      read:async()=>{if(readFailure)throw new Error('corrupt journal');return journal;},
      mark:async(id,phase)=>{order.push('journal:'+phase);fail(phase);journal.state.phase=phase;return journal.state;},
      clear:async()=>{order.push('journal:clear');fail('journal-clear');journal=null;return true;}
    },
    deleteNotes:async()=>{order.push('delete:notes');fail('delete-notes');return {count:1};},
    deleteSavedDays:async()=>{order.push('delete:days');fail('delete-days');return {count:2};},
    removeReferences:async targets=>{order.push('references:'+targets.map(target=>`${target.kind}:${target.key}:${target.attachmentIds.join('|')}`).join(';'));fail('references');return {changed:true};},
    verifyLogical:async()=>{order.push('verify:logical');fail('verify-logical');return true;},
    removeAttachmentMetadata:async ids=>{order.push('metadata:'+ids.join(','));fail('metadata');return {removed:ids.length};},
    verifyFinal:async()=>{order.push('verify:final');fail('verify-final');return true;},
    restore:async payload=>{order.push('restore');restored++;fail('restore');return true;},
    verifyRestore:async payload=>{order.push('verify:restore');fail('verify-restore');return true;},
    sweep:async()=>{order.push('sweep');fail('sweep');return 2;},
    failClosed:message=>{fault=message;order.push('fail-closed');},
    clearFault:()=>{fault='';order.push('clear-fault');}
  };
  const coordinator=mod.createCoordinator(ports);
  return {coordinator,order,state:()=>({journal,closed,fault,restored})};
}

{
  const t=fixture();
  const preflight=await t.coordinator.preflight({savedDays:true,notes:true,attachments:true});
  const result=await t.coordinator.execute({selection:preflight.selection,signature:preflight.signature,forceReferenced:true});
  assert.equal(result.attachmentsRemoved,2);
  assert.deepEqual(t.order,[
    'settle','snapshot','lock:clear-library','eligible','settle','snapshot','safety:before-clear-library','capture','journal:prepare','journal:deleting-records','delete:notes','delete:days',
    'journal:removing-references','references:session:current:'+B,'verify:logical','journal:removing-attachment-metadata','metadata:'+A+','+B,'verify:final','journal:verified','journal:clear','clear-fault','sweep'
  ]);
  console.log('ok - transaction order keeps OPFS sweep after verified journal clear');
}
{
  const t=fixture({failAt:'metadata'});
  const preflight=await t.coordinator.preflight({savedDays:false,notes:false,attachments:true});
  await assert.rejects(()=>t.coordinator.execute({selection:preflight.selection,signature:preflight.signature,forceReferenced:true}),/injected metadata/);
  assert.equal(t.state().restored,1);
  assert.equal(t.state().journal,null,'successful rollback must clear journal');
  assert.ok(t.order.indexOf('restore')>t.order.indexOf('metadata:'+A+','+B));
  assert.ok(!t.order.includes('sweep'),'failed logical transaction must not sweep OPFS');
  console.log('ok - pre-commit failure restores journaled logical state');
}
{
  const t=fixture({failAt:['metadata','restore']});
  const preflight=await t.coordinator.preflight({savedDays:false,notes:false,attachments:true});
  await assert.rejects(()=>t.coordinator.execute({selection:preflight.selection,signature:preflight.signature,forceReferenced:true}),/Automatic Library rollback also failed/);
  assert.ok(t.state().journal,'failed rollback must retain the journal');
  assert.match(t.state().fault,/Library data recovery required/);
  console.log('ok - rollback failure retains journal and fails closed');
}
{
  const t=fixture();
  const preflight=await t.coordinator.preflight({savedDays:false,notes:false,attachments:true});
  t.coordinator._testSetSnapshot?.();
  const stale=fixture({stale:true});
  await assert.rejects(()=>stale.coordinator.execute({selection:preflight.selection,signature:preflight.signature,forceReferenced:false}),/changed while Clear Library was open/);
  assert.ok(!stale.order.includes('journal:prepare'),'stale plan must abort before journal/write');
  console.log('ok - stale preflight aborts before writes');
}
{
  const t=fixture({failAt:'safety'});
  const preflight=await t.coordinator.preflight({savedDays:true,notes:false,attachments:false});
  await assert.rejects(()=>t.coordinator.execute({selection:preflight.selection,signature:preflight.signature,forceReferenced:false}),/injected safety/);
  assert.ok(!t.order.includes('journal:prepare'),'Clear Library safety failure must abort before durable deletion work');
  assert.ok(!t.order.includes('delete:days'),'Clear Library safety failure must leave Saved Days untouched');
  console.log('ok - protected pre-clear safety checkpoint gates destructive Library clearing');
}
{
  const journal={state:{id:'libraryclear_test1234',phase:'removing-attachment-metadata'},payload:{format:'fixture',original:true}};
  const t=fixture({recoveryJournal:journal});
  const result=await t.coordinator.recoverInterrupted();
  assert.equal(result.recovered,true);
  assert.equal(t.state().journal,null);
  assert.equal(t.state().restored,1);
  assert.deepEqual(t.order,['lock:library-clear-recovery','journal:startup-rolling-back','restore','verify:restore','journal:startup-rolled-back','journal:clear','clear-fault']);
  console.log('ok - startup recovery restores and clears interrupted Library journal');
}
{
  const t=fixture({failAt:'sweep'});
  const preflight=await t.coordinator.preflight({savedDays:false,notes:false,attachments:true});
  const result=await t.coordinator.execute({selection:preflight.selection,signature:preflight.signature,forceReferenced:false});
  assert.equal(result.sweepPending,true);
  assert.equal(t.state().journal,null,'sweep failure occurs after logical commit/journal clear');
  assert.equal(t.state().restored,0);
  console.log('ok - post-commit sweep failure is deferred cleanup, not rollback');
}
{
  const t=fixture({readFailure:true});
  await assert.rejects(()=>t.coordinator.recoverInterrupted(),/Library data recovery required/);
  assert.match(t.state().fault,/Library data recovery required/);
  console.log('ok - unreadable startup journal fails closed');
}

{
  const clean=fixture();
  const preflight=await clean.coordinator.preflight({savedDays:true,notes:true,attachments:true});
  for(const phase of ['eligible','settle','snapshot','safety','capture','prepare']){
    const t=fixture({failAt:phase});
    await assert.rejects(()=>t.coordinator.execute({selection:preflight.selection,signature:preflight.signature,forceReferenced:true}),new RegExp('injected '+phase));
    assert.equal(t.state().restored,0,phase+' occurs before a durable journal exists');
    assert.equal(t.state().journal,null,phase+' must not leave a synthetic durable journal');
    assert.ok(!t.order.includes('sweep'),phase+' failure must not sweep OPFS');
  }
  console.log('ok - every pre-journal failure aborts without destructive cleanup');
}
{
  const clean=fixture();
  const preflight=await clean.coordinator.preflight({savedDays:true,notes:true,attachments:true});
  const phases=['deleting-records','delete-notes','delete-days','removing-references','references','verify-logical','removing-attachment-metadata','metadata','verify-final','verified'];
  for(const phase of phases){
    const t=fixture({failAt:phase});
    await assert.rejects(()=>t.coordinator.execute({selection:preflight.selection,signature:preflight.signature,forceReferenced:true}),new RegExp('injected '+phase));
    assert.equal(t.state().restored,1,phase+' must restore journaled logical state');
    assert.equal(t.state().journal,null,phase+' successful rollback must clear the journal');
    assert.ok(!t.order.includes('sweep'),phase+' failure must not sweep OPFS');
  }
  console.log('ok - every journaled pre-commit phase rolls back and never sweeps OPFS');
}
{
  const clean=fixture();
  const preflight=await clean.coordinator.preflight({savedDays:true,notes:true,attachments:true});
  const t=fixture({failAt:'journal-clear'});
  await assert.rejects(()=>t.coordinator.execute({selection:preflight.selection,signature:preflight.signature,forceReferenced:true}),/Automatic Library rollback also failed/);
  assert.ok(t.state().journal,'a journal that cannot be cleared must remain fail-closed');
  assert.match(t.state().fault,/Library data recovery required/);
  assert.ok(!t.order.includes('sweep'));
  console.log('ok - journal-clear failure remains fail-closed instead of pretending commit or rollback completed');
}
{
  const journal={state:{id:'libraryclear_test1234',phase:'deleting-records'},payload:{format:'fixture',original:true}};
  const t=fixture({recoveryJournal:journal,canMutate:false});
  const result=await t.coordinator.recoverInterrupted();
  assert.equal(result.recovered,false);
  assert.equal(result.pending,true);
  assert.equal(t.state().restored,0);
  assert.ok(t.state().journal,'journal remains until a primary mutable context can recover it');
  assert.match(t.state().fault,/primary tab/);
  console.log('ok - startup recovery fails closed when mutation ownership is unavailable');
}

// Recovery and destructive clearing remain independent from diagnostic failure.
for(const fault of ['', 'verify-logical', 'restore']){
 const events=[],diagnostics={start:(kind)=>{events.push(['start',kind]);return 'trace';},mark:(phase)=>events.push(['mark',phase]),finish:()=>events.push(['finish']),fail:()=>events.push(['fail'])};
 const t=fixture({failAt:fault==='restore'?['verify-logical','restore']:fault,diagnostics});
 const run=()=>t.coordinator.execute({selection:{savedDays:true,notes:true,attachments:true},forceReferenced:true});
 if(fault)await assert.rejects(run);else await run();assert.equal(events[0][1],'library-clear');assert.equal(events.at(-1)[0],fault?'fail':'finish');
 assert.ok(events.some(row=>row[1]===(fault==='restore'?'clear-rollback-failed':fault?'clear-rollback-complete':'clear-journal-retired')));
}
{const events=[],t=fixture({recoveryJournal:{state:{id:'interrupted',phase:'prepared'},payload:{}},diagnostics:{start:kind=>{events.push(kind);return 'trace';},mark:phase=>events.push(phase),finish:()=>events.push('finish'),fail:()=>events.push('fail')}});assert.equal((await t.coordinator.recoverInterrupted()).recovered,true);assert.ok(events.includes('library-clear-recovery'));assert.ok(events.includes('clear-rollback-complete'));assert.equal(events.at(-1),'finish');}
{const fail=()=>{throw new Error('diagnostic storage unavailable');},t=fixture({diagnostics:{start:fail,mark:fail,finish:fail,fail}});assert.equal((await t.coordinator.execute({selection:{savedDays:true}})).status,'completed');assert.equal(t.state().journal,null);}
console.log(JSON.stringify({status:'PASS',suite:'library-clear-transaction',faultInjection:true}));
}

// Whole transaction invariant: deletion requires a complete safety image;
// retirement of its durable journal requires a complete restoration proof.
{
  const context={console,URL,TextEncoder,TextDecoder,setTimeout,clearTimeout,queueMicrotask,structuredClone,crypto:webcrypto};vm.createContext(context);
  vm.runInContext(fs.readFileSync('source/external/rich-text.js','utf8'),context);
  for(const file of ['internal','attachments','library-clear'])vm.runInContext(fs.readFileSync(`source/core/${file}.js`,'utf8'),context);
  const registry=context[Symbol.for('studyDirector.internalModules.v1')],Clear=registry.require('library-clear',1),Attachments=registry.require('attachments',1),rich=context.StudyDirectorRichText;
  const id='att-'+ 'd'.repeat(32),reference=rich.insertAttachmentReference('',{id,name:'Study diagram',mode:'inline-image'}).value;
  const cases=[],stages=['capture','verify-rollback'],faults=['days','notes','session','session-rescue','local-days','local-session','local-deletions'];
  for(const stage of stages)for(const fault of faults){
    const controls={dailyKeyEnumeration:true},h=createHarness(new Map(),null,controls);let phase='setup',armed=false,enableFault=true,deletes=0,faultClosed=0;
    const session={id:'active',type:'activeSession',version:1,date:'2026-10-01',status:'suspended',scheduleText:'',suspendedAt:'2026-10-01T12:00:00.000Z',revision:20,updatedAt:'2026-10-01T12:20:00.000Z',snapshot:{review:{reflection:reference}}};
    h.stores.session.set('active',session);
    const biologyNote=noteRow('Biology',reference,'2026-10-01T12:20:00.000Z'),otherNote=noteRow('Other note','Preserve this note','2026-10-01T12:20:00.000Z');
    await h.app.notes.replace({[biologyNote.key]:biologyNote,[otherNote.key]:otherNote});
    await h.app.dailyRecords.saveBatch(['2026-09-30','2026-10-01'].map((date,i)=>({version:1,date,savedAt:'2026-10-01T12:20:00.000Z',updatedAt:'2026-10-01T12:20:00.000Z',reflection:i?reference:'Preserve this day'})));
    const meta={id,name:'Diagram',library:false},metadata=new Map([[id,meta]]),phases=[];
    let state;const references=Attachments.createReferenceCoordinator({data:h.app,scan:rich.scanAttachmentReferences,rewriteReferences:targets=>state.rewriteReferences(targets),withPersistenceSuppressed:work=>work(),review:{hydrate(){},invalidateBindings(){}},background:{budget:()=>()=>false,yieldTask:async()=>{}},live:{fields:()=>[],reviewDate:()=>'',todayIso:()=> '2026-10-01',noteKey:value=>value}});
    state=Clear.createState({data:h.app,createRollbackScope:Clear.createRollbackScope,withPersistenceSuppressed:work=>work(),references:{scan:rich.scanAttachmentReferences,remove:rich.removeAttachmentReferences,listSources:()=>references.sources({includeLive:false})},attachments:{inventory:async()=>[...metadata.values()],verifyMetadata:async()=>true,restoreMetadata:async rows=>{for(const row of rows)metadata.set(row.id,structuredClone(row));}},review:{hydrate(){},invalidateBindings(){}}});
    const snapshot=async()=>({days:Array.from(await h.app.dailyRecords.list({strict:true})),notes:await h.app.notes.readFreshPayload(),session:(await h.app.activeSession.load(0,{strict:true})).value?.snapshot,metadata:[...metadata]});
    const before=JSON.stringify(await snapshot());
    const arm=async()=>{
      armed=true;
      if(fault==='session-rescue'){
        controls.failSessionWrite=true;
        await h.app.activeSession.save({...session,revision:19,updatedAt:'2026-10-01T12:19:00.000Z',snapshot:{review:{reflection:'Older rescue'}}},{emergency:true});controls.failSessionWrite=false;h.stores.session.set('active',structuredClone(session));
      }
      controls.failLocalGetKeys=new Set(fault==='local-days'?['fallback']:fault==='local-session'?['recovery']:fault==='local-deletions'?['deletionRecovery']:[]);
    };
    controls.onStorageRead=async({store})=>{if(armed&&phase===stage&&((fault==='days'&&store==='daily')||(fault==='notes'&&store==='area')||(fault.startsWith('session')&&store==='session')))throw new Error('Unavailable '+fault+' safety read');};
    const coordinator=Clear.createCoordinator({runExclusive:(_kind,work)=>work(),canMutate:()=>true,assertAuthority(){},assertEligible:async()=>{},settle:async()=>{},snapshot:async()=>({attachments:[...metadata.values()],sources:await references.sources({includeLive:false})}),createProtectedSafety:async()=>({verified:false,skipped:true,reason:'device-backup-not-connected'}),
      capture:async(plan,policy)=>{phase='capture';if(stage==='capture')await arm();return state.capture(plan,policy);},deleteNotes:async()=>{phase='delete';deletes++;return h.app.notes.clearAll();},deleteSavedDays:async()=>{deletes++;return h.app.dailyRecords.clearAll();},removeReferences:state.rewriteReferences,verifyLogical:state.verifyLogical,removeAttachmentMetadata:async ids=>{for(const key of ids)metadata.delete(key);return {removed:ids.length};},verifyFinal:async()=>{throw new Error('Injected late verification failure');},restore:async payload=>{phase='restore';return state.restore(payload);},verifyRestore:async payload=>{phase='verify-rollback';if(stage==='verify-rollback'&&enableFault)await arm();return state.verifyRestore(payload);},sweep:async()=>{assert.fail('Uncommitted clear must not sweep bytes');},failClosed:()=>{faultClosed++;},clearFault(){},journal:h.app.libraryClearJournal,diagnostics:{start:()=>'',mark:name=>phases.push(name),finish(){},fail(){}}});
    await assert.rejects(()=>coordinator.execute({selection:{savedDays:true,notes:true,attachments:true},forceReferenced:true}));
    if(stage==='capture'){
      assert.equal(deletes,0,fault+' unavailable safety image must prevent every deletion');assert.equal(await h.app.libraryClearJournal.read(),null);assert.equal(faultClosed,0);assert.equal(phases.includes('clear-rollback-complete'),false);
    }else{
      assert.equal(deletes,2);assert.ok(await h.app.libraryClearJournal.read(),fault+' uncertain restoration must retain journal');assert.equal(faultClosed,1);assert.equal(phases.includes('clear-rollback-complete'),false);
    }
    armed=false;enableFault=false;controls.failLocalGetKeys=new Set();
    if(stage==='verify-rollback'){
      const recovered=await coordinator.recoverInterrupted();assert.equal(recovered.recovered,true,fault+' must recover on retry');assert.equal(await h.app.libraryClearJournal.read(),null);assert.ok(phases.includes('clear-rollback-complete'));
    }
    assert.equal(JSON.stringify(await snapshot()),before,fault+' must preserve the original complete logical dataset');
    cases.push(stage+': '+fault);
  }
  // Known empty and non-empty inventories are both valid; late failure restores exactly.
  for(const size of [0,1,8]){
    const h=createHarness(new Map(),null,{dailyKeyEnumeration:true});
    const rows=Array.from({length:size},(_,i)=>({version:1,date:'2026-09-'+String(i+1).padStart(2,'0'),savedAt:'2026-10-01T12:20:00.000Z',updatedAt:'2026-10-01T12:20:00.000Z',reflection:'Day '+i}));await h.app.dailyRecords.saveBatch(rows);
    const state=Clear.createState({data:h.app,createRollbackScope:Clear.createRollbackScope,withPersistenceSuppressed:work=>work(),references:{scan:()=>({trusted:true,assetIds:[]}),remove:()=>{},listSources:async()=>[]},attachments:{inventory:async()=>[],verifyMetadata:async()=>{},restoreMetadata:async()=>{}},review:{hydrate(){},invalidateBindings(){}}});
    const coordinator=Clear.createCoordinator({runExclusive:(_kind,work)=>work(),canMutate:()=>true,assertAuthority(){},assertEligible:async()=>{},settle:async()=>{},snapshot:async()=>({attachments:[],sources:[]}),createProtectedSafety:async()=>({verified:false,skipped:true,reason:'device-backup-not-connected'}),capture:state.capture,deleteNotes:h.app.notes.clearAll,deleteSavedDays:h.app.dailyRecords.clearAll,removeReferences:state.rewriteReferences,verifyLogical:state.verifyLogical,removeAttachmentMetadata:async()=>({removed:0}),verifyFinal:async()=>{throw new Error('Late failure');},restore:state.restore,verifyRestore:state.verifyRestore,sweep:async()=>assert.fail('Uncommitted clear cannot sweep'),failClosed:()=>assert.fail('Healthy rollback must be proven'),clearFault(){},journal:h.app.libraryClearJournal});
    await assert.rejects(()=>coordinator.execute({selection:{savedDays:true}}),/Late failure/);assert.equal(JSON.stringify(Array.from(await h.app.dailyRecords.list({strict:true}))),JSON.stringify(rows));assert.equal(await h.app.libraryClearJournal.read(),null);cases.push('complete safety image with '+size+' days restores exactly');
  }
  for(const rescued of [false,true]){
    const controls={},h=createHarness(new Map(),null,controls),date='2026-10-01';
    const row={version:1,date,savedAt:'2026-10-01T12:20:00.000Z',updatedAt:'2026-10-01T12:20:00.000Z',reflection:reference};await h.app.dailyRecords.save(row);
    if(rescued)h.sharedLocal.set('fallback',[{...row,updatedAt:'2026-10-01T12:19:00.000Z',reflection:'Older rescue'}]);
    const state=Clear.createState({data:h.app,createRollbackScope:Clear.createRollbackScope,withPersistenceSuppressed:work=>work(),references:{scan:rich.scanAttachmentReferences,remove:rich.removeAttachmentReferences,listSources:async()=>[]},attachments:{inventory:async()=>[{id}],verifyMetadata:async()=>{},restoreMetadata:async()=>{}},review:{hydrate(){},invalidateBindings(){}}});
    const plan=Clear.createPlan({selection:{attachments:true},attachments:[{id}],sources:[{kind:'day',key:date,value:reference,ids:new Set([id])}]}),policy={forceReferenced:true,deleteIds:[id]};
    controls.onStorageRead=async({store,kind})=>{if(store==='daily'&&kind==='get')throw new Error('Unavailable selected Saved Day');};
    await assert.rejects(()=>state.capture(plan,policy),/Unavailable selected Saved Day/);
    assert.equal(h.stores.daily.get(date).reflection,reference);
    controls.onStorageRead=null;const safety=await state.capture(plan,policy);assert.equal(safety.dailyRecords.mode,'selected');assert.equal(safety.dailyRecords.entries[0].reflection,reference);
    cases.push('selected safety capture rejects unavailable day '+(rescued?'with':'without')+' older rescue');
  }
  console.log(JSON.stringify({status:'PASS',suite:'library-clear-storage-contract',cases},null,2));
}
