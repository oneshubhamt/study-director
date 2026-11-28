import {readScript} from '../../../build/source-script.mts';
import {createNotifications} from '../../helpers/notifications.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={console,Object,Map,Set,Promise,Number,String,Math,Date,JSON,Blob,TextEncoder,TextDecoder,crypto:globalThis.crypto,URL:{createObjectURL:()=>'',revokeObjectURL:()=>{}},structuredClone,queueMicrotask};
context.globalThis=context;vm.createContext(context);
for(const file of ['source/core/internal.ts','source/core/attachments.ts','source/core/library-clear.ts'])vm.runInContext(readScript(file),context,{filename:file});
const registry=context[Symbol.for('studyDirector.internalModules.v1')],attachments=registry.require('attachments',1),Clear=registry.require('library-clear',1);
const ID='att-1234567890abcdefghij';
function documentFixture(){const status={textContent:''},preview={querySelector:()=>null,replaceChildren(){}},root={open:true},detail={replaceChildren(){},append(){},scrollTop:0},list={replaceChildren(){},append(){},children:[],scrollTop:0};return {activeElement:null,getElementById(id){return id==='attachment-status'?status:id==='attachment-preview'?preview:id==='library-attachments'?root:id==='attachment-detail'?detail:id==='attachment-list'?list:{value:'',textContent:'',hidden:false,replaceChildren(){},append(){},addEventListener(){}};},querySelectorAll(){return []},querySelector(){return null},createElement(){return {dataset:{},classList:{add(){}},setAttribute(){},addEventListener(){},append(){},appendChild(){},closest(){return null},focus(){},style:{}}},addEventListener(){}};}
function fixture({metadataFailure=false,sweepFailure=false,trackGuards=false,referenceOwner=null}={}){
  let referenced=true,metadata=true,rollbacks=0,lastDeletionState=null;const order=[];
  const store={requireAvailable(){},list:async()=>metadata?[{id:ID,name:'MRI',type:'application/pdf',size:10,hash:'f'.repeat(64),library:true}]:[],removeMetadata:async(_ids,_guard,options={})=>{order.push('metadata');lastDeletionState=structuredClone(options.deletionState||null);if(metadataFailure)throw new Error('metadata failed');metadata=false;return 1},restoreMetadata:async(_rows,options={})=>{lastDeletionState=structuredClone(options.deletionState||null);metadata=true;return 1;},collect:async work=>{order.push('collect');return work({sweep:async()=>{order.push('sweep');if(sweepFailure)throw new Error('sweep failed');return 1}})}};
  const library=attachments.create({notifications:createNotifications('attachments').port,store,processing:{check(){},job:fn=>fn()},document:documentFixture(),interactions:{choose:async()=> 'remove',confirm:async()=>true,notify(){},input:async()=>null},canMutate:()=>true,requireOwner(){},token:()=>1,assertToken(){},isActive:()=>true,cleanup(){},renderReference(){},sources:async options=>referenceOwner?referenceOwner.refs.sources(options):referenced?[{kind:'note',key:'n',label:'N',ids:new Set([ID]),value:'x'}]:[],destinations:async()=>[],settle:async()=>{if(trackGuards)order.push('settle')},openLibrary(){},openSource(){},deletionGuard:async()=>()=>true,quiesce:async work=>{if(trackGuards)order.push('quiesce-enter');try{return await work();}finally{if(trackGuards)order.push('quiesce-exit')}},runExclusive:async(_kind,work)=>{if(trackGuards)order.push('exclusive-enter');try{return await work();}finally{if(trackGuards)order.push('exclusive-exit')}},removeReferences:async(id,_refs,assert)=>{order.push('surgery');if(referenceOwner)return referenceOwner.refs.removeEverywhere(id,assert);referenced=false;return {rollback:async()=>{order.push('rollback');rollbacks++;referenced=true}}},insert:async()=>{}});
  return {library,state:()=>({referenced,metadata,rollbacks,order,lastDeletionState})};
}

{
  const t=fixture({trackGuards:true});assert.equal(await t.library.remove(ID,true),true);const s=t.state();
  assert.deepEqual(s.order.filter(value=>['quiesce-enter','exclusive-enter','settle','surgery','metadata','collect','exclusive-exit','quiesce-exit'].includes(value)),['quiesce-enter','exclusive-enter','settle','surgery','metadata','collect','exclusive-exit','quiesce-exit'],'Deletion must settle writers, rewrite references, and commit metadata under quiescence and exclusive ownership.');
  assert.deepEqual(s.lastDeletionState,{record:[ID]},'Explicit deletion of an independently retained attachment must stage its deletion marker in the same metadata commit.');
}
{
  const t=fixture({metadataFailure:true});await assert.rejects(()=>t.library.remove(ID),/metadata failed/);const s=t.state();
  assert.equal(s.rollbacks,1,'Metadata failure must roll reference surgery back.');assert.equal(s.referenced,true);assert.equal(s.metadata,true);assert.deepEqual(s.order.filter(value=>['surgery','metadata','rollback'].includes(value)),['surgery','metadata','rollback']);
}
{
  const t=fixture({sweepFailure:true});assert.equal(await t.library.remove(ID),true);const s=t.state();
  assert.equal(s.rollbacks,0,'Orphan sweep failure occurs after logical deletion and must not resurrect references.');assert.equal(s.referenced,false);assert.equal(s.metadata,false);assert.deepEqual(s.order.filter(value=>['surgery','metadata','sweep'].includes(value)),['surgery','metadata','sweep']);
}
{
  const t=fixture();await t.library.restoreMetadata([{id:ID,name:'MRI',type:'application/pdf',size:10,hash:'f'.repeat(64),library:true}]);
  assert.deepEqual(t.state().lastDeletionState,{clear:[ID]},'Metadata rollback/import restoration must clear the matching deletion marker in the same metadata commit.');
}

console.log(JSON.stringify({status:'PASS',contracts:['guard ordering','metadata rollback','post-commit sweep failure']},null,2));


function referenceFixture({scanTrusted=true,rewriteMode='success',liveFields=[]}={}){
  const marker=`ref:${ID}`,date='2026-09-13',stamp='2026-09-13T00:00:00.000Z';
  const notes={n:{key:'n',label:'N',text:marker,updatedAt:'r1',links:[]}};
  const days=new Map([[date,{date,reflection:marker,updatedAt:stamp,tasks:['original']}]]);let revision=1,owner=true;
  let session={id:'current',date,revision:1,updatedAt:stamp,snapshot:{review:{reflection:marker,studyQuality:null}}};
  let dayFailure='',sessionFailure='',failDayRead=false,failSessionRead=false,noteWrites=0,dayWrites=0,sessionWrites=0;
  const clone=value=>structuredClone(value),equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const data={
    notes:{get:key=>notes[key]?clone(notes[key]):null,readFreshPayload:async()=>clone(notes),replace:async()=>{},updateValidatedRich(key,label,text,expected){if(notes[key]?.updatedAt!==expected)return {status:'conflict',revision:notes[key]?.updatedAt};noteWrites++;notes[key]={...notes[key],label,text,updatedAt:'r'+(++revision)};return {status:'changed',revision:notes[key].updatedAt};},flush:async()=>true,failure:()=>({failed:false})},
    dailyRecords:{list:async()=>[...days.values()].map(clone),get:async key=>clone(days.get(key)||null),saveBatch:async()=>assert.fail('individual attachment mutation must be conditional'),restoreBatch:async()=>{},verifyCanonical:async row=>{if(failDayRead){failDayRead=false;throw new Error('injected day read-back failure');}if(!equal(days.get(row.date),row))throw new Error('canonical day mismatch');return true;},save:async(row,options)=>{
      if(dayFailure==='successor'){dayFailure='';days.set(date,{...days.get(date),tasks:['newer'],updatedAt:'2026-09-14T00:00:00.000Z'});}
      if(!options||!equal(days.get(row.date),options.expectedCanonical))throw new Error('Daily Record changed before this save.');
      dayWrites++;days.set(row.date,clone(row));if(dayFailure==='readback'){dayFailure='';failDayRead=true;}return {ok:true,storage:'indexeddb'};
    }},
    activeSession:{load:async()=>{if(failSessionRead){failSessionRead=false;return {ok:false,value:null,error:new Error('injected session read-back failure')};}return {ok:true,value:clone(session),error:null};},nextRevision:()=>session.revision+1,clear:async()=>{},save:async(row,options)=>{
      if(sessionFailure==='successor'){sessionFailure='';session={...session,revision:100,snapshot:{...session.snapshot,review:{reflection:'newer reflection',studyQuality:5}}};}
      if(!options||!equal(session,options.expectedCanonical))return {ok:false,error:new Error('Active Session changed before save.')};
      sessionWrites++;session=clone(row);if(sessionFailure==='readback'){sessionFailure='';failSessionRead=true;}return {ok:true,value:clone(row)};
    }}
  };
  const scan=value=>({trusted:scanTrusted,assetIds:String(value).includes(ID)?[ID]:[],occurrences:[]});
  const reviewEvents=[],yieldPriorities=[],review={hydrate(options){reviewEvents.push(['hydrate',structuredClone(options)]);},invalidateBindings(){reviewEvents.push('invalidate');}};
  let state;
  const ports={
    data,scan,
    rewriteReferences:async(targets,operation)=>{
      if(rewriteMode==='throw')throw new Error('rewrite failed');
      if(rewriteMode==='noop')return 0;
      return state.rewriteReferences(targets,operation);
    },
    withPersistenceSuppressed:work=>work(),
    background:{budget:()=>{let first=true;return()=>{const answer=first;first=false;return answer;}},yieldTask:async options=>{yieldPriorities.push(options?.priority||'');}},
    live:{fields:()=>liveFields,reviewDate:()=>date,todayIso:()=>date,noteKey:value=>String(value||'').trim().toLowerCase()}
  };
  const refs=attachments.createReferenceCoordinator(ports);
  const statePorts={data,createRollbackScope:Clear.createRollbackScope,withPersistenceSuppressed:work=>work(),references:{scan,remove:(value,ids)=>({value:value.replace(marker,''),removed:{total:ids.length}}),listSources:()=>refs.sources({includeLive:false})},attachments:{inventory:async()=>[],verifyMetadata:async()=>{},restoreMetadata:async()=>{}},review,nowIso:()=> '2026-09-13T12:00:00.000Z'};
  state=Clear.createState(statePorts);
  const assertOwner=()=>{if(!owner)throw new Error('owner lost');};
  return {refs,ports,statePorts,marker,notes,days,getSession:()=>session,reviewEvents,yieldPriorities,assertOwner,loseOwner:()=>{owner=false;},writes:()=>({noteWrites,dayWrites,sessionWrites}),setDayFailure:value=>{dayFailure=value;},setSessionFailure:value=>{sessionFailure=value;},
    successors(){notes.n={...notes.n,text:'newer note',updatedAt:'r100'};days.set(date,{...days.get(date),reflection:'newer day',tasks:['newer'],updatedAt:'2026-09-14T00:00:00.000Z'});session={...session,revision:100,snapshot:{...session.snapshot,review:{reflection:'newer session',studyQuality:5}}};}
  };
}

{
  const t=referenceFixture();
  const change=await t.refs.removeEverywhere(ID,t.assertOwner);
  assert.equal(change.changed,true);assert.equal(change.sources,3);assert.equal(await t.refs.verifyAbsent(ID),true,'all canonical reference surfaces must verify clean after surgery');
  await change.rollback();
  await change.rollback();
  assert.equal(t.notes.n.text,t.marker);assert.equal(t.days.get('2026-09-13').reflection,t.marker);assert.equal(t.getSession().snapshot.review.reflection,t.marker,'rollback restores every mutated reference surface');
  assert.deepEqual(t.reviewEvents.map(event=>Array.isArray(event)?event[0]:event),['hydrate','invalidate','hydrate','invalidate'],'forward and rollback each hydrate exactly once even when rollback is called twice');
  assert.equal(t.reviewEvents[2][1].snapshotReview.reflection,t.marker,'Review rollback hydration must use the verified canonical ActiveSession review.');
}
{
  const t=referenceFixture();
  const absent=await t.refs.removeEverywhere('att-zzzzzzzzzzzzzzzzzzzz',t.assertOwner);
  assert.deepEqual({changed:absent.changed,sources:absent.sources,rollback:absent.rollback},{changed:false,sources:0,rollback:null},'unreferenced attachment removal is a no-op');
}
{
  const t=referenceFixture({rewriteMode:'throw'});
  await assert.rejects(()=>t.refs.removeEverywhere(ID,t.assertOwner),/rewrite failed/);
  assert.equal(t.notes.n.text,t.marker);assert.equal(t.days.get('2026-09-13').reflection,t.marker);assert.equal(t.getSession().snapshot.review.reflection,t.marker,'rewrite failure restores the full canonical snapshot');
}
{
  const t=referenceFixture({rewriteMode:'noop'});
  await assert.rejects(()=>t.refs.removeEverywhere(ID,t.assertOwner),/did not verify globally/);
  assert.equal(t.notes.n.text,t.marker,'global verification failure rolls references back');
}
{
  const t=referenceFixture({scanTrusted:false});
  await assert.rejects(()=>t.refs.sources(),/could not be verified/,'untrusted rich text fails closed before attachment surgery');
}
for(const failure of ['saved-days','active-session']){
  const t=referenceFixture();
  if(failure==='saved-days')t.ports.data.dailyRecords.list=async options=>{assert.equal(options.strict,true);throw new Error('source unavailable');};
  else t.ports.data.activeSession.load=async()=>({ok:false,value:null,error:new Error('source unavailable')});
  await assert.rejects(()=>t.refs.removeEverywhere(ID,t.assertOwner),/source unavailable/);
  assert.equal(t.notes.n.text,t.marker);assert.equal(t.days.get('2026-09-13').reflection,t.marker);assert.equal(t.getSession().snapshot.review.reflection,t.marker,'unavailable sources must leave reference-removal surfaces intact');
}
{
  const t=referenceFixture();
  await t.refs.sources({includeLive:false,priority:'background'});
  assert.ok(t.yieldPriorities.length>0,'Canonical attachment-reference discovery should cooperatively yield on larger datasets.');
  assert.ok(t.yieldPriorities.every(priority=>priority==='background'),'Background integrity discovery must preserve background scheduler priority.');
}
{
  const field=(kind,value,dataset={})=>({id:kind==='reflection'?'daily-reflection':'',dataset,value,matches:selector=>selector==='.library-diary-textarea'&&kind==='diary'});
  const t=referenceFixture({liveFields:[
    field('area',`live ${ID}`,{areaKey:' Focus '}),
    field('area',`edited ${ID}`,{areaKey:' N '}),
    field('diary',`live ${ID}`,{diaryDate:'2026-09-13'}),
    field('reflection',`live ${ID}`,{reflectionDate:''})
  ]});
  const rows=await t.refs.sources();
  const focus=rows.find(row=>row.kind==='note'&&row.key==='focus');
  const day=rows.find(row=>row.kind==='day'&&row.key==='2026-09-13');
  const sessionRow=rows.find(row=>row.kind==='session'&&row.key==='current');
  assert.ok(focus?.ids.has(ID),'live Area-note fields join canonical reference discovery');
  const stored=rows.filter(row=>row.kind==='note'&&row.key==='n');
  assert.equal(stored.length,1,'an open note merges with its stored note, named by the same key');assert.equal(stored[0].value,`edited ${ID}`,'the open text is the one checked');
  assert.ok(day?.ids.has(ID),'live Diary fields merge with the persisted Saved-Day source');
  assert.ok(sessionRow?.ids.has(ID),'live Reflection fields merge with the persisted Active Session source');
}
{
  const valid=referenceFixture().ports;
  assert.throws(()=>attachments.createReferenceCoordinator(null),/ports are required/);
  assert.throws(()=>attachments.createReferenceCoordinator({...valid,data:{}}),/data ports are incomplete/);
  assert.throws(()=>attachments.createReferenceCoordinator({...valid,scan:null}),/mutation ports are incomplete/);
  assert.throws(()=>Clear.createState({...referenceFixture().statePorts,review:{}}),/review ports are incomplete/);
  assert.throws(()=>attachments.createReferenceCoordinator({...valid,background:{}}),/background ports are incomplete/);
  assert.throws(()=>attachments.createReferenceCoordinator({...valid,live:{}}),/live-source ports are incomplete/);
}

// Strict flush success is not proof of the intended durable note. These
// faults leave no reference to the attachment in the note text; a global
// reference census alone cannot distinguish them from the intended edit.
for(const [fault,patch] of [
  ['text',{text:'unexpected persisted text'}],
  ['revision',{updatedAt:'r100'}],
  ['links',{links:['successor-note']}]
]){
  const t=referenceFixture(),deletion=fixture({referenceOwner:t});
  let persisted;
  const flush=t.ports.data.notes.flush;
  t.ports.data.notes.flush=async options=>{
    assert.equal(options.strict,true);
    await flush(options);
    assert.equal(t.notes.n.text,'','the attempted note rewrite removes the attachment');
    persisted={...t.notes.n,...patch};
    t.notes.n=structuredClone(persisted);
    return true;
  };
  let rejection;
  try{await deletion.library.remove(ID);}catch(error){rejection=error;}
  assert.match(String(rejection?.message||''),/Note reference removal verification failed/u,fault+' readback must refuse attachment deletion');
  assert.ok(persisted,'the fault ran after strict flush');
  assert.deepEqual(t.notes.n,persisted,fault+' readback must preserve the observed note rather than adopting it for compensation');
  assert.deepEqual(t.writes(),{noteWrites:1,dayWrites:0,sessionWrites:0},'refusal must not rewrite the successor or untouched surfaces');
  assert.equal(deletion.state().metadata,true,'refusal keeps attachment metadata');
  assert.ok(!deletion.state().order.some(event=>event==='metadata'||event==='sweep'),'refusal prevents logical deletion and physical cleanup');
  assert.equal(t.days.get('2026-09-13').reflection,t.marker);
  assert.equal(t.getSession().snapshot.review.reflection,t.marker);
}

// Compensation must neither adopt successors nor write untouched records.
{
  const t=referenceFixture(),change=await t.refs.removeEverywhere(ID,t.assertOwner);
  t.successors();const writes=t.writes(),events=t.reviewEvents.length;
  await assert.rejects(()=>change.rollback(),/successor was preserved|Daily Record changed/);
  assert.deepEqual(t.writes(),writes);assert.equal(t.reviewEvents.length,events);
  assert.equal(t.notes.n.text,'newer note');assert.deepEqual(t.days.get('2026-09-13').tasks,['newer']);assert.equal(t.getSession().snapshot.review.studyQuality,5);
}
for(const surface of ['day','session']){
  const t=referenceFixture();
  if(surface==='day')t.setDayFailure('readback');else t.setSessionFailure('readback');
  await assert.rejects(()=>t.refs.removeEverywhere(ID,t.assertOwner),/injected .* read-back failure/);
  assert.equal(t.notes.n.text,t.marker);assert.equal(t.days.get('2026-09-13').reflection,t.marker);assert.equal(t.getSession().snapshot.review.reflection,t.marker);
}
{
  const t=referenceFixture();t.setDayFailure('successor');
  await assert.rejects(()=>t.refs.removeEverywhere(ID,t.assertOwner),/Daily Record changed/);
  assert.equal(t.notes.n.text,t.marker);assert.deepEqual(t.days.get('2026-09-13').tasks,['newer']);assert.equal(t.writes().dayWrites,0);assert.equal(t.writes().sessionWrites,0);
}
{
  const t=referenceFixture();t.setSessionFailure('successor');
  await assert.rejects(()=>t.refs.removeEverywhere(ID,t.assertOwner),/Active Session changed/);
  assert.equal(t.notes.n.text,t.marker);assert.equal(t.days.get('2026-09-13').reflection,t.marker);assert.equal(t.getSession().snapshot.review.reflection,'newer reflection');assert.equal(t.writes().sessionWrites,0);assert.equal(t.reviewEvents.length,0);
}
{
  const t=referenceFixture(),change=await t.refs.removeEverywhere(ID,t.assertOwner);t.loseOwner();const writes=t.writes();
  await assert.rejects(()=>change.rollback(),/owner lost/);assert.deepEqual(t.writes(),writes);
}
console.log('PASS: actual reference coordinator and rewrite owner; conditional compensation and successor preservation with simulated repositories');
