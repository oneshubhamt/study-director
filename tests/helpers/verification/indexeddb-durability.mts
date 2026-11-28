import {method,registeredExports} from '../registered-exports.mts';
import {readRuntimeSource} from '../../helpers/runtime-source.mts';
import {readScript} from '../../../build/source-script.mts';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const internal=readRuntimeSource('source/core/internal.ts');
const persistence=readScript('source/core/persistence.ts');

type Store='daily'|'summary'|'notes'|'session'|'meta'|'assets';
type Options={durability?:string};
type Tx={durability:string;onerror:(()=>void)|null;onabort:(()=>void)|null;oncomplete:(()=>void)|null;objectStore:()=>object};
type Finish=(ok:boolean,value:unknown)=>void;
type Transaction=(stores:Store|Store[],mode:'readonly'|'readwrite',action:(tx:Tx,finish:Finish)=>void,abortMessage?:string)=>Promise<unknown>;
type StoreTransaction=(store:Store,mode:'readonly'|'readwrite',action:(objectStore:unknown,tx:Tx,finish:Finish)=>void)=>Promise<unknown>;
function createPrimitiveHarness({strictUnsupported=false}={}){
  const calls:{stores:Store|Store[];mode:string;args:number;options:Options|null}[]=[],captures:{scope:string;error:string;level:string}[]=[];
  const db={
    version:9,objectStoreNames:Object.assign(['daily','summary','notes','session','meta','assets'],{contains:()=>true}),
    close(){},
    transaction(stores:Store|Store[],mode:'readonly'|'readwrite',options?:Options){
      if(mode==='readonly')return {objectStore:()=>({keyPath:({daily:'date',summary:'date',notes:'key',session:'id',meta:'key',assets:null})[Array.isArray(stores)?stores[0]!:stores]})};
      calls.push({stores:Array.isArray(stores)?[...stores]:stores,mode,args:arguments.length,options:options?{...options}:null});
      if(strictUnsupported&&arguments.length>=3)throw new TypeError('durability options unsupported');
      return {durability:options?.durability||'default',onerror:null,onabort:null,oncomplete:null,objectStore:()=>({})};
    }
  };
  const indexedDB={open(){const request:{result:typeof db;error:Error|null;onupgradeneeded:(()=>void)|null;onsuccess:(()=>void)|null;onerror:(()=>void)|null;onblocked:(()=>void)|null}={result:db,error:null,onupgradeneeded:null,onsuccess:null,onerror:null,onblocked:null};queueMicrotask(()=>request.onsuccess?.());return request;}};
  const context=vm.createContext({console,queueMicrotask,setTimeout,clearTimeout,Date,Promise,Object,Array,String,Number,Math,JSON,RegExp,Error,TypeError,Uint8Array,TextEncoder,indexedDB,globalThis:null});
  context.globalThis=context;
  vm.runInContext(internal,context,{filename:'source/core/internal.ts'});
  vm.runInContext(persistence,context,{filename:'source/core/persistence.ts'});
  const module=registeredExports(context,'persistence');
  const exported=method(module,'createIndexedDb')(Object.freeze({
    config:Object.freeze({
      dbName:'durability-test',dbVersion:9,
      stores:Object.freeze({dailyRecords:'daily',dailySummaries:'summary',notes:'notes',activeSessions:'session',appMeta:'meta',assets:'assets'})
    }),
    hooks:Object.freeze({onError:()=>{},onOk:()=>{},capture:(scope:string,error:unknown,level:string)=>captures.push({scope,error:String(error&&typeof error==='object'&&'message' in error?error.message:error),level})})
  }));
  // Only the native transaction callback subset exercised here crosses the VM boundary.
  const api={transaction:method(exported,'transaction') as Transaction,strictTransaction:method(exported,'strictTransaction') as Transaction,strictStoreTransaction:method(exported,'strictStoreTransaction') as StoreTransaction};
  return {api,calls,captures};
}

{
  const {api,calls}=createPrimitiveHarness();
  assert.equal(await api.transaction('meta','readwrite',(_tx,finish)=>finish(true,'normal')),'normal');
  assert.equal(await api.strictTransaction('meta','readwrite',(_tx,finish)=>finish(true,'strict')),'strict');
  assert.equal(await api.strictStoreTransaction('meta','readwrite',(_store,_tx,finish)=>finish(true,'store-strict')),'store-strict');
  assert.equal(calls[0]!.args,2,'ordinary transactions must preserve the browser default durability path');
  assert.equal(calls[0]!.options,null);
  assert.equal(calls[1]!.args,3,'strict transactions must opt in through the IndexedDB transaction options parameter');
  assert.deepEqual(calls[1]!.options,{durability:'strict'});
  assert.equal(calls[2]!.args,3);
  assert.deepEqual(calls[2]!.options,{durability:'strict'});
}

{
  const {api,calls,captures}=createPrimitiveHarness({strictUnsupported:true});
  assert.equal(await api.strictTransaction('meta','readwrite',(_tx,finish)=>finish(true,'fallback')),'fallback','unsupported strict options must degrade safely instead of breaking storage');
  assert.equal(calls.length,2,'strict capability fallback should retry the same transaction with the legacy two-argument API');
  assert.equal(calls[0]!.args,3);
  assert.equal(calls[1]!.args,2);
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
  assert.equal(calls.at(-1)!.options?.durability,'strict');
  assert.equal(await api.strictTransaction('meta','readwrite',(tx,finish)=>{
    tx.oncomplete=()=>finish(true,'recovered');
    queueMicrotask(()=>tx.oncomplete?.());
  }),'recovered','a later healthy strict commit is still possible');
}

console.log(JSON.stringify({status:'PASS',suite:'indexeddb-durability',contracts:['default path unchanged','strict opt-in uses transaction options','unsupported option falls back safely']},null,2));
