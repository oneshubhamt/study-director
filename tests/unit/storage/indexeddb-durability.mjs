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
      dbName:'durability-test',dbVersion:7,legacyBaselineVersion:6,
      stores:Object.freeze({dailyRecords:'daily',dailySummaries:'summary',areaNotes:'area',activeSessions:'session',appMeta:'meta',assets:'assets'}),
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

console.log(JSON.stringify({status:'PASS',suite:'indexeddb-durability',contracts:['default path unchanged','strict opt-in uses transaction options','unsupported option falls back safely']},null,2));
