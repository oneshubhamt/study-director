import {createNotifications} from '../../helpers/notifications.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={console,Object,Map,Set,Promise,Number,String,Math,Date,JSON,Blob,TextEncoder,TextDecoder,crypto:globalThis.crypto,URL:{createObjectURL:()=>'',revokeObjectURL:()=>{}},structuredClone,queueMicrotask};
context.globalThis=context;vm.createContext(context);
for(const file of ['source/core/internal.js','source/core/attachments.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
const attachments=context[Symbol.for('studyDirector.internalModules.v1')].require('attachments',1);
const ID='att-1234567890abcdefghij';
function documentFixture(){const status={textContent:''},preview={querySelector:()=>null,replaceChildren(){}},root={open:true},detail={replaceChildren(){},append(){},scrollTop:0},list={replaceChildren(){},append(){},children:[],scrollTop:0};return {activeElement:null,getElementById(id){return id==='attachment-status'?status:id==='attachment-preview'?preview:id==='library-attachments'?root:id==='attachment-detail'?detail:id==='attachment-list'?list:{value:'',textContent:'',hidden:false,replaceChildren(){},append(){},addEventListener(){}};},querySelectorAll(){return []},querySelector(){return null},createElement(){return {dataset:{},classList:{add(){}},setAttribute(){},addEventListener(){},append(){},appendChild(){},closest(){return null},focus(){},style:{}}},addEventListener(){}};}
function fixture({metadataFailure=false,sweepFailure=false,trackGuards=false}={}){
  let referenced=true,metadata=true,rollbacks=0,lastDeletionState=null;const order=[];
  const store={requireAvailable(){},list:async()=>metadata?[{id:ID,name:'MRI',type:'application/pdf',size:10,hash:'f'.repeat(64),library:true}]:[],removeMetadata:async(_ids,_guard,options={})=>{order.push('metadata');lastDeletionState=structuredClone(options.deletionState||null);if(metadataFailure)throw new Error('metadata failed');metadata=false;return 1},restoreMetadata:async(_rows,options={})=>{lastDeletionState=structuredClone(options.deletionState||null);metadata=true;return 1;},collect:async work=>{order.push('collect');return work({sweep:async()=>{order.push('sweep');if(sweepFailure)throw new Error('sweep failed');return 1}})}};
  const library=attachments.create({notifications:createNotifications('attachments').port,store,processing:{check(){},job:fn=>fn()},document:documentFixture(),interactions:{choose:async()=> 'remove',confirm:async()=>true,notify(){},input:async()=>null},canMutate:()=>true,requireOwner(){},token:()=>1,isActive:()=>true,cleanup(){},renderReference(){},sources:async()=>referenced?[{kind:'note',key:'n',label:'N',ids:new Set([ID]),value:'x'}]:[],destinations:async()=>[],settle:async()=>{if(trackGuards)order.push('settle')},openLibrary(){},openSource(){},deletionGuard:async()=>()=>true,quiesce:async work=>{if(trackGuards)order.push('quiesce-enter');try{return await work();}finally{if(trackGuards)order.push('quiesce-exit')}},runExclusive:async(_kind,work)=>{if(trackGuards)order.push('exclusive-enter');try{return await work();}finally{if(trackGuards)order.push('exclusive-exit')}},removeReferences:async()=>{order.push('surgery');referenced=false;return {rollback:async()=>{order.push('rollback');rollbacks++;referenced=true}}},insert:async()=>{}});
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
  const marker=`ref:${ID}`;
  const notes={n:{key:'n',label:'N',text:marker,updatedAt:'r1'}};
  const days=new Map([['2026-09-13',{date:'2026-09-13',reflection:marker}]]);
  let session={id:'current',revision:1,snapshot:{review:{reflection:marker,studyQuality:null}}};
  const clone=value=>structuredClone(value);
  const data={
    notes:{readFreshPayload:async()=>clone(notes),updateValidatedRich(key,label,text){notes[key]={...notes[key],label,text,updatedAt:'r2'};return {status:'changed'};},flush:async()=>true,failure:()=>({failed:false})},
    dailyRecords:{list:async()=>[...days.values()].map(clone),get:async key=>clone(days.get(key)||null),save:async row=>{days.set(row.date,clone(row));return row;}},
    activeSession:{load:async()=>({ok:true,value:clone(session),error:null}),nextRevision:()=>session.revision+1,save:async row=>{session=clone(row);return {ok:true,value:clone(row)};}}
  };
  const scan=value=>({trusted:scanTrusted,assetIds:String(value).includes(ID)?[ID]:[],occurrences:[]});
  const reviewEvents=[],yieldPriorities=[];
  const ports={
    data,scan,
    rewriteReferences:async targets=>{
      if(rewriteMode==='throw')throw new Error('rewrite failed');
      if(rewriteMode==='noop')return 0;
      for(const target of targets){const next=String(target.expectedValue).replace(marker,'');if(target.kind==='note')notes[target.key]={...notes[target.key],text:next};else if(target.kind==='day')days.set(target.key,{...days.get(target.key),reflection:next});else if(target.kind==='session')session={...session,revision:session.revision+1,snapshot:{...session.snapshot,review:{...session.snapshot.review,reflection:next}}};}
      return targets.length;
    },
    withPersistenceSuppressed:work=>work(),
    review:{hydrate(options){reviewEvents.push(['hydrate',structuredClone(options)]);},invalidateBindings(){reviewEvents.push('invalidate');}},
    background:{budget:()=>{let first=true;return()=>{const answer=first;first=false;return answer;}},yieldTask:async options=>{yieldPriorities.push(options?.priority||'');}},
    live:{fields:()=>liveFields,reviewDate:()=> '2026-09-13',todayIso:()=> '2026-09-13',noteKey:value=>String(value||'').trim().toLowerCase()}
  };
  const refs=attachments.createReferenceCoordinator(ports);
  return {refs,ports,marker,notes,days,getSession:()=>session,reviewEvents,yieldPriorities};
}

{
  const t=referenceFixture();
  const change=await t.refs.removeEverywhere(ID);
  assert.equal(change.changed,true);assert.equal(change.sources,3);assert.equal(await t.refs.verifyAbsent(ID),true,'all canonical reference surfaces must verify clean after surgery');
  await change.rollback();
  await change.rollback();
  assert.equal(t.notes.n.text,t.marker);assert.equal(t.days.get('2026-09-13').reflection,t.marker);assert.equal(t.getSession().snapshot.review.reflection,t.marker,'rollback restores every mutated reference surface');
  assert.deepEqual(t.reviewEvents.map(event=>Array.isArray(event)?event[0]:event),['hydrate','invalidate'],'session Review rollback hydrates the canonical ActiveSession review exactly once even when rollback is called twice');
  assert.equal(t.reviewEvents[0][1].snapshotReview.reflection,t.marker,'Review rollback hydration must use the verified canonical ActiveSession review.');
}
{
  const t=referenceFixture();
  const absent=await t.refs.removeEverywhere('att-zzzzzzzzzzzzzzzzzzzz');
  assert.deepEqual({changed:absent.changed,sources:absent.sources,rollback:absent.rollback},{changed:false,sources:0,rollback:null},'unreferenced attachment removal is a no-op');
}
{
  const t=referenceFixture({rewriteMode:'throw'});
  await assert.rejects(()=>t.refs.removeEverywhere(ID),/rewrite failed/);
  assert.equal(t.notes.n.text,t.marker);assert.equal(t.days.get('2026-09-13').reflection,t.marker);assert.equal(t.getSession().snapshot.review.reflection,t.marker,'rewrite failure restores the full canonical snapshot');
}
{
  const t=referenceFixture({rewriteMode:'noop'});
  await assert.rejects(()=>t.refs.removeEverywhere(ID),/did not verify globally/);
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
  await assert.rejects(()=>t.refs.removeEverywhere(ID),/source unavailable/);
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
  assert.throws(()=>attachments.createReferenceCoordinator({...valid,review:{}}),/review ports are incomplete/);
  assert.throws(()=>attachments.createReferenceCoordinator({...valid,background:{}}),/background ports are incomplete/);
  assert.throws(()=>attachments.createReferenceCoordinator({...valid,live:{}}),/live-source ports are incomplete/);
}
