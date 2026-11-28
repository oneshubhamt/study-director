import {readCoreScript} from '../core-script.mts';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {method,registeredExports} from '../registered-exports.mts';
import {field,errorCode,errorMessage} from '../repository-safety-ports.mts';
import {required} from '../repository-note-ports.mts';
import {jsonObject} from './read-verification.mts';

type Topology={version:number;stores:Iterable<string>};
type State={version:number;stores:Set<string>};
type Upgrade={aborted:boolean;abort():void;objectStore(from:string):{name:string}};
type DbView={version:number;objectStoreNames:StoreNames;createObjectStore(name:string):unknown;deleteObjectStore(name:string):unknown;transaction(name:string):unknown;close():void;onversionchange:(()=>void)|null;onclose:(()=>void)|null};
type Request={result:DbView|null;error:unknown;onupgradeneeded:((event:{oldVersion:number;target:{result:DbView;transaction:Upgrade}})=>void)|null;onsuccess:(()=>void)|null;onerror:(()=>void)|null;onblocked:(()=>void)|null};
const newRequest=():Request=>({result:null,error:null,onupgradeneeded:null,onsuccess:null,onerror:null,onblocked:null});
const keyPaths:Record<string,string|null>={dailyRecords:'date',dailySummaries:'date',notes:'key',activeSessions:'id',appMeta:'key',assets:null};

class StoreNames{
  private readonly set:Set<string>;
  constructor(set:Set<string>){this.set=set;}
  get length(){return this.set.size;}
  contains(name:string){return this.set.has(String(name));}
  [Symbol.iterator](){return [...this.set].sort()[Symbol.iterator]();}
}
function fakeIndexedDb(initial?:Topology){
  const requests:(number|undefined)[]=[];
  let state:State|null=initial?{version:Number(initial.version),stores:new Set(initial.stores)}:null,lastDb:DbView|null=null;
  function dbView():DbView{
    return {
      get version(){return required(state).version;},
      objectStoreNames:new StoreNames(required(state).stores),
      createObjectStore(name){required(state).stores.add(String(name));return {};},
      deleteObjectStore(name){required(state).stores.delete(String(name));},
      transaction(name:string){return {objectStore:()=>({keyPath:keyPaths[name]})};},
      close(){},onversionchange:null,onclose:null
    };
  }
  return {
    requests,
    open(_name:string,requestedVersion?:number){
      requests.push(requestedVersion);
      const req=newRequest();
      queueMicrotask(()=>{
        try{
          const existed=!!state;
          const oldVersion=state?.version??0;
          const previous=state?{version:state.version,stores:new Set(state.stores)}:null;
          const nextVersion=requestedVersion===undefined?(existed?oldVersion:1):Number(requestedVersion);
          if(existed&&nextVersion<oldVersion){req.error=Object.assign(new Error('VersionError'),{name:'VersionError'});req.onerror?.();return;}
          if(!state)state={version:nextVersion,stores:new Set()};
          const upgrading=nextVersion>oldVersion;
          state.version=nextVersion;
          const db=dbView();
          req.result=db;lastDb=db;
          if(upgrading){
            // Renaming a store in the upgrade transaction keeps its rows.
            const transaction:Upgrade={aborted:false,abort(){this.aborted=true;},objectStore(from:string){return {set name(to:string){required(state).stores.delete(String(from));required(state).stores.add(String(to));}};}};
            req.onupgradeneeded?.({oldVersion,target:{result:db,transaction}});
            if(transaction.aborted){state=previous;return;}
          }
          req.onsuccess?.();
        }catch(error){req.error=error;req.onerror?.();}
      });
      return req;
    },
    snapshot(){return {version:state?.version??0,stores:[...(state?.stores||[])].sort()};},
    // Browser "Clear browsing data": the database disappears and open connections close.
    clearSiteData(){state=null;lastDb?.onclose?.();},
    closeConnection(){lastDb?.onclose?.();}
  };
}

// The modules and this test share one clock running 10 times faster, so the app's
// 2.5 s open limit and the waits around it keep their order without real waiting.
const TIME_SCALE=10;
const fastTimeout=(fn:()=>void,ms=0)=>setTimeout(fn,Math.ceil((Number(ms)||0)/TIME_SCALE));

function loadModules(indexedDB:unknown){
  const context=vm.createContext({
    console,Date,Math,JSON,RegExp,Error,TypeError,Object,Array,String,Number,Map,Set,Promise,Uint8Array,TextEncoder,
    crypto:globalThis.crypto,indexedDB,setTimeout:fastTimeout,clearTimeout,queueMicrotask,globalThis:null
  });
  Reflect.set(context,'globalThis',context);
  for(const file of ['internal','persistence'])vm.runInContext(readCoreScript(file),context,{filename:`source/core/${file}.ts`});
  return {persistence:registeredExports(context,'persistence')};
}

const currentStores=Object.freeze({
  dailyRecords:'dailyRecords',dailySummaries:'dailySummaries',notes:'notes',activeSessions:'activeSessions',
  appMeta:'appMeta',assets:'assets'
});
const canonicalNames=Object.values(currentStores).sort();
function dbPort(owner:unknown){
 return {open:async()=>jsonObject(await method(owner,'open')()),topology:async()=>jsonObject(await method(owner,'topology')()),lifecycle:()=>jsonObject(method(owner,'lifecycle')()),retireLegacyStores:field(owner,'retireLegacyStores')};
}
function makeDb(backend:unknown,onReset:((event:unknown)=>void)|null=null){
 const {persistence}=loadModules(backend);
 return dbPort(method(persistence,'createIndexedDb')(Object.freeze({config:Object.freeze({dbName:'StudyDirectorDB',dbVersion:9,stores:currentStores}),hooks:Object.freeze({...{onError:()=>{},onOk:()=>{},capture:()=>{}},...(onReset?{onReset}:{})})})));
}
for(const version of [1,5,7,8]){
 const backend=fakeIndexedDb({version,stores:['areaNotes','syncQueue','tombstones']}),before=backend.snapshot();
 await assert.rejects(makeDb(backend).open(),(error:unknown)=>errorCode(error)==='STUDY_DIRECTOR_UNSUPPORTED_TOPOLOGY');
 assert.deepEqual(backend.snapshot(),before,'unsupported topology is not upgraded, reset, renamed or deleted');
}
const current=fakeIndexedDb({version:9,stores:canonicalNames}),db=makeDb(current);
assert.equal((await db.topology())['current'],true);assert.deepEqual(current.snapshot(),{version:9,stores:canonicalNames});
assert.equal(db.retireLegacyStores,undefined);
const extra=fakeIndexedDb({version:9,stores:[...canonicalNames,'syncQueue']});
await assert.rejects(makeDb(extra).open(),(error:unknown)=>errorCode(error)==='STUDY_DIRECTOR_UNSUPPORTED_TOPOLOGY');
assert.ok(extra.snapshot().stores.includes('syncQueue'));
const newer=fakeIndexedDb({version:10,stores:canonicalNames});assert.equal((await makeDb(newer).topology())['newer'],true);assert.equal(newer.snapshot().version,10);
const newerMissing=fakeIndexedDb({version:10,stores:canonicalNames.filter(name=>name!=='dailySummaries')}),missingBefore=newerMissing.snapshot();
assert.equal((await makeDb(newerMissing).topology())['usable'],false,'startup can identify and explain a newer topology without touching it');assert.deepEqual(newerMissing.snapshot(),missingBefore);
const fresh=fakeIndexedDb(),resets:unknown[]=[],freshDb=makeDb(fresh,event=>resets.push(event));
await freshDb.open();assert.deepEqual(fresh.requests,[9],'fresh installation creates the current version in one atomic open');assert.deepEqual(fresh.snapshot(),{version:9,stores:canonicalNames});assert.equal(freshDb.lifecycle()['startedFresh'],true);
fresh.clearSiteData();await freshDb.open();await new Promise(resolve=>setTimeout(resolve,0));assert.equal(resets.length,1);assert.equal(freshDb.lifecycle()['resets'],1);
// A slow open (nothing blocking it) gets one fresh attempt before the app
// stops; the first request, if it finishes late, is closed unused. Two silent
// attempts fail with one storage error.
function silentIndexedDb({answerFrom,lateAfter=null}:{answerFrom:number;lateAfter?:number|null}){
  const events={opens:0,closed:0};
  const answer=(req:Request)=>{req.result={version:9,objectStoreNames:new StoreNames(new Set(canonicalNames)),createObjectStore(){},deleteObjectStore(){},transaction(name:string){return {objectStore:()=>({keyPath:keyPaths[name]})};},close(){events.closed++;},onversionchange:null,onclose:null};req.onsuccess?.();};
  return {events,open(){
    const attempt=++events.opens,req=newRequest();
    if(attempt>=answerFrom)queueMicrotask(()=>answer(req));
    else if(lateAfter!==null)fastTimeout(()=>answer(req),lateAfter);
    return req;
  }};
}
function countingDb(backend:unknown,errors:string[]){
  const {persistence}=loadModules(backend);
  return dbPort(method(persistence,'createIndexedDb')(Object.freeze({config:Object.freeze({dbName:'StudyDirectorDB',dbVersion:9,stores:currentStores}),hooks:Object.freeze({onError:(message:unknown)=>errors.push(String(message)),onOk:()=>{},capture:()=>{}})})));
}
{
  const errors:string[]=[],slow=silentIndexedDb({answerFrom:2,lateAfter:2700});
  assert.equal(Number((await countingDb(slow,errors).open())['version']),9,'a slow open succeeds on its second attempt');
  await new Promise(resolve=>setTimeout(resolve,500));
  assert.deepEqual(slow.events,{opens:2,closed:1},'the late first request is closed unused');
  assert.deepEqual(errors,[],'a slow open that recovers reports no storage error');
  const hungErrors:string[]=[],hung=silentIndexedDb({answerFrom:Infinity});
  await assert.rejects(countingDb(hung,hungErrors).open(),/IndexedDB open timed out/u,'an open that never answers fails after the second attempt');
  assert.equal(hung.events.opens,2,'a hung open is tried twice, not more');
  assert.deepEqual(hungErrors,['IndexedDB open timed out'],'the storage error is reported once, after the last attempt');
}
// A transaction that cannot start while the open checks the stores is a
// storage failure: reported as one, never as an unsupported database.
{
  const errors:string[]=[],events={closed:0},broken={open(){
    const req=newRequest();
    queueMicrotask(()=>{req.result={version:9,objectStoreNames:new StoreNames(new Set(canonicalNames)),createObjectStore(){},deleteObjectStore(){},transaction(){throw new Error('forced transaction failure');},close(){events.closed++;},onversionchange:null,onclose:null};req.onsuccess?.();});
    return req;
  }};
  await assert.rejects(countingDb(broken,errors).open(),(error:unknown)=>errorMessage(error)==='forced transaction failure'&&errorCode(error)!=='STUDY_DIRECTOR_UNSUPPORTED_TOPOLOGY');
  assert.deepEqual(errors,['forced transaction failure'],'the failure is reported as a storage error');
  assert.equal(events.closed,1,'the connection is closed');
}
console.log(JSON.stringify({status:'PASS',suite:'canonical-topology',currentPreserved:true,unsupportedUntouched:true,freshCreation:true,recreationDetected:true,newerNotDowngraded:true,slowOpenRetriedOnce:true,transactionFailureNotUnsupported:true}));
