import {createNotifications} from '../../helpers/notifications.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {drainMicrotasks} from '../../helpers/async-tools.mjs';

// Attachment Library lifecycle contract: reactive projection, mutation batching, direct deletion, and deferred physical cleanup.

{ // attachment-library-reactivity
const context={console,Blob,TextEncoder,TextDecoder,URL,AbortController,crypto:globalThis.crypto,Map,Set,Object,Promise,Number,String,Math,Uint8Array,DataView,queueMicrotask};
context.globalThis=context;vm.createContext(context);
for(const file of ['source/core/internal.js','source/core/attachments.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
const attachments=context[Symbol.for('studyDirector.internalModules.v1')].require('attachments',1);

function element(id=''){
  const listeners=new Map();
  return {id,open:true,value:'',textContent:'',hidden:false,children:[],dataset:{},scrollTop:0,files:[],classList:{add(){},toggle(){}},setAttribute(){},hasAttribute(){return false},removeAttribute(){},append(...nodes){this.children.push(...nodes)},appendChild(node){this.children.push(node)},replaceChildren(...nodes){this.children=[...nodes]},querySelector(){return null},querySelectorAll(){return []},closest(){return null},focus(){},scrollIntoView(){},load(){},pause(){},addEventListener(type,fn){listeners.set(type,fn)},emit(type,event={}){return listeners.get(type)?.({target:this,preventDefault(){},stopImmediatePropagation(){},...event})},click(){return this.emit('click')}};
}
function createLibrary({confirm=true}={}){
  const ids=new Map();
  for(const id of ['library-attachments','attachment-status','attachment-preview','attachment-detail','attachment-list','attachment-search','attachment-count','attachment-cancel','attachment-add','attachment-files','attachment-import','attachment-archive','attachment-export'])ids.set(id,element(id));
  let listCalls=0,downloads=0;
  const document={activeElement:null,getElementById:id=>ids.get(id)||element(id),querySelectorAll(){return []},querySelector(){return null},createElement:tag=>element(tag),addEventListener(){}};
  const store={list:async()=>{listCalls++;return []},get:async()=>null,requireAvailable(){},during:async fn=>fn(),collect:async fn=>fn({sweep:async()=>0,removeMany:async()=>0}),setLibrary:async()=>{},rename:async()=>{}};
  const library=attachments.create({notifications:createNotifications('attachments').port,store,processing:{check(){},job:fn=>fn(),cancel(){},run:async()=>'',chooseSave:async()=>null,download(){downloads++}},document,interactions:{choose:async()=>null,confirm:async()=>confirm,notify(){},input:async()=>null},canMutate:()=>true,requireOwner(){},token:()=>1,isActive:()=>true,cleanup(){},renderReference(){},sources:async()=>[],destinations:async()=>[],settle:async()=>{},openLibrary(){},openSource(){},deletionGuard:async()=>()=>true,runExclusive:async(_kind,fn)=>fn(),removeReferences:async()=>null,insert:async()=>{}});
  library.install();
  return {library,ids,listCalls:()=>listCalls,downloads:()=>downloads};
}
const settle=()=>drainMicrotasks();

{
  const t=createLibrary();
  await t.library.batch(async()=>{
    t.library.invalidate();t.library.invalidate();
    assert.equal(t.listCalls(),0,'Mutation batches must suppress intermediate reconciliation.');
  });
  await settle();
  assert.equal(t.listCalls(),1,'A mutation batch must reconcile exactly once.');
}
{
  const t=createLibrary();
  t.library.invalidate();t.library.invalidate();t.library.invalidate();
  await settle();
  assert.equal(t.listCalls(),1,'Same-turn invalidations must coalesce into one reconciliation.');
}
{
  const t=createLibrary({confirm:false});
  t.ids.get('attachment-export').click();await settle();
  assert.equal(t.listCalls(),0,'Cancelled export must not reconcile the Library.');
  assert.equal(t.downloads(),0,'Cancelled export must not download.');
}
{
  const t=createLibrary({confirm:true});
  t.ids.get('attachment-export').click();await settle();
  assert.equal(t.listCalls(),1,'Read-only export must read the catalogue once without a redundant refresh.');
}

console.log(JSON.stringify({status:'PASS',contracts:['batched reconciliation','same-turn coalescing','cancelled export is inert','read-only export avoids duplicate refresh']},null,2));
}

{ // attachment-lifecycle
const context={console,Blob,TextEncoder,TextDecoder,URL:{createObjectURL:()=>'',revokeObjectURL:()=>{}},crypto:globalThis.crypto,Map,Set,Object,Promise,Number,String,Math,Uint8Array,DataView,queueMicrotask,structuredClone};
context.globalThis=context;vm.createContext(context);
for(const file of ['source/core/internal.js','source/core/attachments.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
const module=context[Symbol.for('studyDirector.internalModules.v1')].require('attachments',1);

const retainedId='att-'+ 'a'.repeat(20);
const referencedId='att-'+ 'b'.repeat(20);
const orphanId='att-'+ 'c'.repeat(20);
const hash='f'.repeat(64);
const row=(id,library=false)=>({id,name:id,type:'application/pdf',size:10,hash,library});

function element(id=''){
  return {
    id,open:false,value:'',textContent:'',hidden:false,children:[],dataset:{},scrollTop:0,
    classList:{add(){},toggle(){}},
    setAttribute(){},hasAttribute(){return false},addEventListener(){},append(...nodes){this.children.push(...nodes)},appendChild(node){this.children.push(node)},replaceChildren(...nodes){this.children=[...nodes]},
    querySelector(){return null},querySelectorAll(){return []},closest(){return null},focus(){},scrollIntoView(){},removeAttribute(){},load(){},pause(){}
  };
}
function fakeDocument(open=false){
  const ids=new Map();
  for(const id of ['library-attachments','attachment-status','attachment-preview','attachment-detail','attachment-list','attachment-search','attachment-count','attachment-cancel','attachment-add','attachment-files','attachment-import','attachment-archive','attachment-export'])ids.set(id,element(id));
  ids.get('library-attachments').open=open;
  return {
    ids,activeElement:null,
    getElementById:id=>ids.get(id)||element(id),
    querySelectorAll(){return []},querySelector(){return null},
    createElement:tag=>element(tag),createDocumentFragment:()=>element('fragment'),addEventListener(){}
  };
}
function createLibrary({open=false,rows=[row(retainedId,true),row(referencedId,false),row(orphanId,false)],sources=async()=>[{kind:'note',key:'n',label:'N',ids:new Set([referencedId])}],collect}={}){
  let listCalls=0;
  const document=fakeDocument(open);
  const store={
    list:async()=>{listCalls++;return structuredClone(rows)},get:async()=>null,requireAvailable(){},during:async fn=>fn(),
    retain:async()=>()=>{},removeMetadata:async()=>1,collect:collect|| (async fn=>fn({sweep:async()=>0,removeMany:async()=>0})),setLibrary:async()=>{},rename:async()=>{}
  };
  const library=module.create({notifications:createNotifications('attachments').port,
    store,processing:{check(){},job:fn=>fn(),cancel(){},run:async()=>'',chooseSave:async()=>null,download(){}},document,
    interactions:{choose:async()=>null,confirm:async()=>false,notify(){},input:async()=>null},
    canMutate:()=>true,requireOwner(){},token:()=>1,isActive:()=>true,cleanup(){},renderReference(){},sources,destinations:async()=>[],settle:async()=>{},openLibrary(){},openSource(){},deletionGuard:async()=>()=>true,runExclusive:async(_k,fn)=>fn(),quiesce:async fn=>fn(),removeReferences:async()=>null,insert:async()=>{}
  });
  return {library,document,listCalls:()=>listCalls,store};
}

{
  const t=createLibrary({open:false});t.library.install();
  t.library.invalidate();
  await drainMicrotasks();
  assert.equal(t.listCalls(),1,'closed drawer invalidation must still refresh canonical logical state');
  assert.equal(t.document.ids.get('attachment-count').textContent,'· 2','count must include retained + canonically referenced rows, not an unreferenced transient orphan');
  assert.equal(await t.library.count(),2,'public count must use the same logical projection');
  console.log('ok - closed drawer keeps logical attachment count reactive');
}

{
  const t=createLibrary({open:false});t.library.install();
  await t.library.batch(async()=>{
    t.library.invalidate();
    assert.equal(await t.library.refresh(),false,'direct refresh must defer while a mutation batch owns reconciliation');
    assert.equal(t.listCalls(),0,'mutation hold must prevent intermediate storage/list projection reads');
  });
  await drainMicrotasks();
  assert.equal(t.listCalls(),1,'batched mutation must reconcile exactly once after the hold releases');
  console.log('ok - mutation batch blocks intermediate direct refresh and reconciles once');
}

{
  const id=referencedId;
  let referenced=true,duringMutationListCalls=-1,api;
  const t=createLibrary({
    rows:[row(id,false)],
    sources:async()=>referenced?[{kind:'note',key:'n',label:'N',ids:new Set([id])}]:[],
    collect:async work=>work({removeMany:async()=>1,sweep:async()=>0})
  });
  api=module.create({notifications:createNotifications('attachments').port,
    store:t.store,processing:{check(){},job:fn=>fn()},document:t.document,
    interactions:{choose:async()=> 'remove',confirm:async()=>true,notify(){}},canMutate:()=>true,requireOwner(){},token:()=>1,isActive:()=>true,
    sources:async()=>referenced?[{kind:'note',key:'n',label:'N',ids:new Set([id])}]:[],settle:async()=>{},quiesce:async fn=>fn(),runExclusive:async(_k,fn)=>fn(),
    removeReferences:async()=>{referenced=false;api.invalidate();await drainMicrotasks();duringMutationListCalls=t.listCalls();return {rollback:async()=>{referenced=true}};},
    deletionGuard:async()=>()=>true,cleanup(){},openLibrary(){},renderReference(){},destinations:async()=>[],openSource(){},insert(){}
  });
  api.install();
  assert.equal(await api.remove(id),true);
  assert.equal(duringMutationListCalls,0,'remove() must hold reconciliation while canonical reference surgery is still running');
  await drainMicrotasks();
  assert.equal(t.listCalls(),1,'direct remove must perform exactly one post-transaction logical reconciliation');
  console.log('ok - remove owns the full reconciliation hold for direct callers');
}

{
  let present=true;
  const id=orphanId;
  const t=createLibrary({
    rows:[],sources:async()=>[],
    collect:async work=>work({removeMany:async()=>{present=false;return 0},sweep:async()=>0})
  });
  t.store.removeMetadata=async()=>{present=false;return 0};
  t.store.list=async()=>present?[row(id,true)]:[];
  const api=module.create({notifications:createNotifications('attachments').port,
    store:t.store,processing:{check(){},job:fn=>fn()},document:t.document,
    interactions:{choose:async()=>null,confirm:async()=>true,notify(){}},canMutate:()=>true,requireOwner(){},token:()=>1,isActive:()=>true,
    sources:async()=>[],settle:async()=>{},quiesce:async fn=>fn(),runExclusive:async(_k,fn)=>fn(),removeReferences:async()=>null,deletionGuard:async()=>()=>true,
    cleanup(){},openLibrary(){},renderReference(){},destinations:async()=>[],openSource(){},insert(){}
  });
  api.install();await api.refresh();
  assert.equal(t.document.ids.get('attachment-count').textContent,'· 1');
  assert.equal(await api.remove(id),true,'already-absent metadata after collection must be an idempotent success');
  await drainMicrotasks();
  assert.equal(t.document.ids.get('attachment-count').textContent,'· 0','remove() must own its final logical invalidation for direct callers');
  console.log('ok - stale attachment row delete is idempotent and self-reconciles');
}

{
  const id=orphanId;
  const t=createLibrary({rows:[row(id,false)],sources:async()=>[],collect:async()=>({status:'skipped',reason:'active-editor-or-file-operation',removed:0})});
  const api=module.create({notifications:createNotifications('attachments').port,
    store:t.store,processing:{check(){},job:fn=>fn()},document:t.document,
    interactions:{choose:async()=>null,confirm:async()=>true,notify(){}},canMutate:()=>true,requireOwner(){},token:()=>1,isActive:()=>true,
    sources:async()=>[],settle:async()=>{},quiesce:async fn=>fn(),runExclusive:async(_k,fn)=>fn(),removeReferences:async()=>null,deletionGuard:async()=>()=>true,
    cleanup(){},openLibrary(){},renderReference(){},destinations:async()=>[],openSource(){},insert(){}
  });
  assert.equal(await api.remove(id),true,'Logical deletion can complete while existing readers defer physical cleanup');
  console.log('ok - physical cleanup deferred while readers remain');
}

console.log('attachment lifecycle behavior: PASS');
}

{ // attachment-integrity-projection
const context={console,Blob,TextEncoder,TextDecoder,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},AbortController,crypto:globalThis.crypto,Map,Set,Object,Promise,Number,String,Math,Uint8Array,DataView,queueMicrotask,structuredClone};
context.globalThis=context;vm.createContext(context);
for(const file of ['source/core/internal.js','source/core/attachments.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
const attachments=context[Symbol.for('studyDirector.internalModules.v1')].require('attachments',1);

function makeClassList(node){
  const classes=new Set();
  return {
    add(...values){for(const value of values)for(const part of String(value).split(/\s+/).filter(Boolean))classes.add(part);node._className=[...classes].join(' ');},
    toggle(value,force){const next=force===undefined?!classes.has(value):!!force;if(next)classes.add(value);else classes.delete(value);node._className=[...classes].join(' ');return next;},
    contains(value){return classes.has(value);},
    _set(value){classes.clear();for(const part of String(value||'').split(/\s+/).filter(Boolean))classes.add(part);node._className=[...classes].join(' ');}
  };
}
function element(tag='div',id=''){
  const listeners=new Map(),node={tagName:String(tag).toUpperCase(),id,open:false,value:'',textContent:'',hidden:false,children:[],dataset:{},scrollTop:0,files:[],attributes:new Map(),_className:'',parentNode:null};
  node.classList=makeClassList(node);
  Object.defineProperty(node,'className',{get(){return node._className;},set(value){node.classList._set(value);}});
  Object.defineProperty(node,'childNodes',{get(){return node.children;}});
  node.setAttribute=(name,value)=>{node.attributes.set(name,String(value));if(name==='id')node.id=String(value);};
  node.getAttribute=name=>node.attributes.get(name)??null;
  node.removeAttribute=name=>node.attributes.delete(name);
  node.hasAttribute=name=>node.attributes.has(name);
  node.addEventListener=(type,fn)=>{if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);};
  node.append=(...nodes)=>{for(const child of nodes){node.children.push(child);if(child&&typeof child==='object')child.parentNode=node;}};
  node.appendChild=child=>{node.append(child);return child;};
  node.replaceChildren=(...nodes)=>{node.children=[];node.append(...nodes);};
  node.querySelector=selector=>walk(node).find(child=>matches(child,selector))||null;
  node.querySelectorAll=selector=>walk(node).filter(child=>matches(child,selector));
  node.closest=selector=>{
    for(let current=node;current;current=current.parentNode){
      if(selector==='#library-attachments'&&current.id==='library-attachments')return current;
      if(selector==='#library-attachments [data-attachment-action]'&&current.dataset.attachmentAction){for(let parent=current.parentNode;parent;parent=parent.parentNode)if(parent.id==='library-attachments')return current;}
    }
    return null;
  };node.focus=()=>{document.activeElement=node;};node.scrollIntoView=()=>{};node.load=()=>{};node.pause=()=>{};node.click=()=>{for(const fn of listeners.get('click')||[])fn({target:node,preventDefault(){},stopImmediatePropagation(){}});};
  return node;
}
function walk(node){const out=[];for(const child of node.children||[]){if(!child||typeof child!=='object')continue;out.push(child,...walk(child));}return out;}
function matches(node,selector){
  if(selector==='audio')return node.tagName==='AUDIO';
  if(selector==='[data-attachment-id]')return !!node.dataset?.attachmentId;
  if(selector.includes('[data-attachment-action]'))return !!node.dataset?.attachmentAction;
  return false;
}
function textTree(node){return [node?.textContent||'',...(node?.children||[]).flatMap(textTree)].join(' ');}
function flattenFragments(node){return walk(node).filter(Boolean);}

const id='att-'+ 'a'.repeat(24),row={id,name:'Important PDF.pdf',type:'application/pdf',size:42,hash:'f'.repeat(64),library:true};
const ids=new Map();
for(const key of ['library-attachments','attachment-status','attachment-preview','attachment-detail','attachment-list','attachment-search','attachment-count','attachment-cancel','attachment-add','attachment-files','attachment-import','attachment-archive','attachment-export','attachment-progress','attachment-progress-bar','attachment-progress-label','attachment-progress-value'])ids.set(key,element('div',key));
ids.get('library-attachments').open=true;
let getCalls=0;
const document={
  activeElement:null,
  getElementById:key=>ids.get(key)||null,
  querySelectorAll(selector){return walk(ids.get('library-attachments')).filter(node=>matches(node,selector));},querySelector(){return null},
  createElement:tag=>element(tag),createDocumentFragment:()=>element('fragment'),addEventListener(){}
};
ids.get('library-attachments').append(ids.get('attachment-list'),ids.get('attachment-detail'));
const issue={id,kind:'missing-file',name:row.name};
const library=attachments.create({notifications:createNotifications('attachments').port,
  store:{list:async()=>[row],get:async()=>{getCalls++;throw new Error('missing file must not be opened');},requireAvailable(){},during:async fn=>fn(),retain:async()=>()=>{},collect:async fn=>fn({sweep:async()=>0,removeMany:async()=>0}),setLibrary:async()=>{},rename:async()=>{}},
  processing:{check(){},job:fn=>fn(),cancel(){},run:async()=>'',chooseSave:async()=>null,download(){}},document,
  interactions:{choose:async()=>null,confirm:async()=>false,notify(){},input:async()=>null},
  canMutate:()=>true,requireOwner(){},token:()=>1,isActive:()=>true,cleanup(){},renderReference(){},sources:async()=>[],integrityIssue:assetId=>assetId===id?issue:null,
  destinations:async()=>[{key:'note',label:'Ongoing Note'}],settle:async()=>{},openLibrary(){},openSource(){},deletionGuard:async()=>()=>true,runExclusive:async(_k,fn)=>fn(),quiesce:async fn=>fn(),removeReferences:async()=>null,insert:async()=>{throw new Error('must not offer insertion for unhealthy attachment');}
});
library.install();
await library.refresh();
const listRoot=ids.get('attachment-list');
const tile=flattenFragments(listRoot).find(node=>node.dataset?.attachmentId===id);
assert.ok(tile,'Attachment tile should render.');
assert.ok(tile.classList.contains('integrity-issue'),'Affected Attachment Library tile should carry the restrained integrity state class.');
assert.match(textTree(tile),/File missing/u,'Affected tile should explain the concrete issue.');

await library.select(id);
const detailText=textTree(ids.get('attachment-detail'));
assert.match(detailText,/stored attachment file is missing/u,'Selected attachment should expose the specific recovery guidance.');
assert.doesNotMatch(detailText,/Insert in note|Add link to note/u,'An unhealthy physical attachment must not offer insertion actions.');
assert.equal(getCalls,0,'Missing or size-mismatched files must not be reopened merely to render the issue UI.');

const oldRename=walk(ids.get('attachment-detail')).find(node=>node.dataset.attachmentAction==='rename');
oldRename.focus();await library.refresh();
const newRename=walk(ids.get('attachment-detail')).find(node=>node.dataset.attachmentAction==='rename');
assert.notEqual(newRename,oldRename);assert.equal(document.activeElement,newRename,'detail refresh must restore focus to the corresponding replacement action');

console.log(JSON.stringify({status:'PASS',suite:'attachment-integrity-ui',tile:'integrity-issue',detail:'specific missing-file guidance',getCalls},null,2));
}
