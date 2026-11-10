import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const internal=fs.readFileSync('source/core/internal.js','utf8');
const persistence=fs.readFileSync('source/core/persistence.js','utf8');

function createPrimitiveHarness({strictUnsupported=false}={}){
  const calls=[],captures=[];
  const db={
    objectStoreNames:{contains:()=>true},
    close(){},
    transaction(stores,mode,options){
      calls.push({stores:Array.isArray(stores)?[...stores]:stores,mode,args:arguments.length,options:options?{...options}:null});
      if(strictUnsupported&&arguments.length>=3)throw new TypeError('durability options unsupported');
      return {durability:options?.durability||'default',onerror:null,onabort:null,oncomplete:null,objectStore:()=>({})};
    }
  };
  const indexedDB={open(){const request={result:db,error:null,onupgradeneeded:null,onsuccess:null,onerror:null,onblocked:null};queueMicrotask(()=>request.onsuccess?.());return request;}};
  const context=vm.createContext({console,queueMicrotask,setTimeout,clearTimeout,Date,Promise,Object,Array,String,Number,Math,JSON,RegExp,Error,TypeError,Uint8Array,TextEncoder,indexedDB,globalThis:null});
  context.globalThis=context;
  vm.runInContext(internal,context,{filename:'internal.js'});
  vm.runInContext(persistence,context,{filename:'persistence.js'});
  const module=context[Symbol.for('studyDirector.internalModules.v1')].require('persistence',1);
  const api=module.createIndexedDb(Object.freeze({
    config:Object.freeze({
      dbName:'durability-test',dbVersion:9,bridgeVersion:8,
      stores:Object.freeze({dailyRecords:'daily',dailySummaries:'summary',notes:'notes',activeSessions:'session',appMeta:'meta',assets:'assets'}),
      legacyStores:Object.freeze({syncQueue:'sync',tombstones:'tombstones',reflectionDrafts:'reflection'})
    }),
    hooks:Object.freeze({onError:()=>{},onOk:()=>{},capture:(scope,error,level)=>captures.push({scope,error:String(error&&error.message||error),level})})
  }));
  return {api,calls,captures};
}

{
  const {api,calls}=createPrimitiveHarness();
  assert.equal(await api.transaction('meta','readwrite',(_tx,finish)=>finish(true,'normal')),'normal');
  assert.equal(await api.strictTransaction('meta','readwrite',(_tx,finish)=>finish(true,'strict')),'strict');
  assert.equal(await api.strictStoreTransaction('meta','readwrite',(_store,_tx,finish)=>finish(true,'store-strict')),'store-strict');
  assert.equal(calls[0].args,2,'ordinary transactions must preserve the browser default durability path');
  assert.equal(calls[0].options,null);
  assert.equal(calls[1].args,3,'strict transactions must opt in through the IndexedDB transaction options parameter');
  assert.deepEqual(calls[1].options,{durability:'strict'});
  assert.equal(calls[2].args,3);
  assert.deepEqual(calls[2].options,{durability:'strict'});
}

{
  const {api,calls,captures}=createPrimitiveHarness({strictUnsupported:true});
  assert.equal(await api.strictTransaction('meta','readwrite',(_tx,finish)=>finish(true,'fallback')),'fallback','unsupported strict options must degrade safely instead of breaking storage');
  assert.equal(calls.length,2,'strict capability fallback should retry the same transaction with the legacy two-argument API');
  assert.equal(calls[0].args,3);
  assert.equal(calls[1].args,2);
  assert.ok(captures.some(entry=>entry.scope==='storage.idb-strict-durability-unavailable'),'strict durability fallback must remain diagnosable');
}

// A strict write may have a successful put request but an aborted transaction.
 // The caller must not interpret request success as a durable commit.
{
  const {api,calls}=createPrimitiveHarness();
  let acknowledged=false;
  await assert.rejects(()=>api.strictTransaction('meta','readwrite',(tx,finish)=>{
    tx.oncomplete=()=>{acknowledged=true;finish(true,'committed');};
    queueMicrotask(()=>tx.onabort?.());
  },'injected strict transaction abort'),/injected strict transaction abort/u);
  assert.equal(acknowledged,false,'aborted strict transaction cannot run oncomplete acknowledgement');
  assert.equal(calls.at(-1).options?.durability,'strict');
  assert.equal(await api.strictTransaction('meta','readwrite',(tx,finish)=>{
    tx.oncomplete=()=>finish(true,'recovered');
    queueMicrotask(()=>tx.oncomplete?.());
  }),'recovered','a later healthy strict commit is still possible');
}

{
  // The database's life on this page, for diagnostics: the last committed
  // write, and storage faults by name only (an app's own refusal is not one).
  const {api}=createPrimitiveHarness();
  assert.equal(api.lifecycle().lastWriteAt,'');
  await api.transaction('meta','readonly',(_tx,finish)=>finish(true,null));
  assert.equal(api.lifecycle().lastWriteAt,'','a read is not a write');
  await api.transaction('meta','readwrite',(_tx,finish)=>finish(true,null));
  assert.ok(Number.isFinite(Date.parse(api.lifecycle().lastWriteAt)),'a committed write is recorded');
  await assert.rejects(api.transaction('meta','readwrite',(_tx,finish)=>finish(false,Object.assign(new Error('disk full'),{name:'QuotaExceededError'}))));
  await assert.rejects(api.transaction('meta','readwrite',(_tx,finish)=>finish(false,Object.assign(new Error('refused'),{code:'STUDY_DIRECTOR_UNSUPPORTED_DATA'}))));
  const life=api.lifecycle();
  assert.equal(life.errors,1,'an app refusal is not a storage fault');
  assert.equal(life.lastError,'QuotaExceededError');
  assert.ok(Number.isFinite(Date.parse(life.lastErrorAt)));
}

console.log(JSON.stringify({status:'PASS',suite:'indexeddb-durability',contracts:['default path unchanged','strict opt-in uses transaction options','unsupported option falls back safely']},null,2));
