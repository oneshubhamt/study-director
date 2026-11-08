import {readCoreScript} from '../../helpers/core-script.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class StoreNames{
  constructor(set){this.set=set;}
  get length(){return this.set.size;}
  contains(name){return this.set.has(String(name));}
  [Symbol.iterator](){return [...this.set].sort()[Symbol.iterator]();}
}
function fakeIndexedDb(initial){
  const requests=[];
  let state=initial?{version:Number(initial.version),stores:new Set(initial.stores)}:null,lastDb=null;
  function dbView(){
    return {
      get version(){return state.version;},
      objectStoreNames:new StoreNames(state.stores),
      createObjectStore(name){state.stores.add(String(name));return {};},
      deleteObjectStore(name){state.stores.delete(String(name));},
      transaction(name){return {objectStore:()=>({keyPath:({dailyRecords:'date',dailySummaries:'date',notes:'key',activeSessions:'id',appMeta:'key',assets:null})[name]})};},
      close(){},onversionchange:null,onclose:null
    };
  }
  return {
    requests,
    open(name,requestedVersion){
      requests.push(requestedVersion);
      const req={result:null,error:null,onupgradeneeded:null,onsuccess:null,onerror:null,onblocked:null};
      queueMicrotask(()=>{
        try{
          const existed=!!state;
          const oldVersion=existed?state.version:0;
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
            const transaction={aborted:false,abort(){this.aborted=true;},objectStore(from){return {set name(to){state.stores.delete(String(from));state.stores.add(String(to));}};}};
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
const fastTimeout=(fn,ms=0)=>setTimeout(fn,Math.ceil((Number(ms)||0)/TIME_SCALE));

function loadModules(indexedDB){
  const context=vm.createContext({
    console,Date,Math,JSON,RegExp,Error,TypeError,Object,Array,String,Number,Map,Set,Promise,Uint8Array,TextEncoder,
    crypto:globalThis.crypto,indexedDB,setTimeout:fastTimeout,clearTimeout,queueMicrotask,globalThis:null
  });
  context.globalThis=context;
  for(const file of ['internal','persistence'])vm.runInContext(readCoreScript(file),context,{filename:`${file}.js`});
  const registry=context[Symbol.for('studyDirector.internalModules.v1')];
  return {persistence:registry.require('persistence',1)};
}

const currentStores=Object.freeze({
  dailyRecords:'dailyRecords',dailySummaries:'dailySummaries',notes:'notes',activeSessions:'activeSessions',
  appMeta:'appMeta',assets:'assets'
});
const canonicalNames=Object.values(currentStores).sort();
function makeDb(backend,onReset=null){
 const {persistence}=loadModules(backend);
 return persistence.createIndexedDb(Object.freeze({config:Object.freeze({dbName:'StudyDirectorDB',dbVersion:9,stores:currentStores}),hooks:Object.freeze({...{onError:()=>{},onOk:()=>{},capture:()=>{}},...(onReset?{onReset}:{})})}));
}
for(const version of [1,5,7,8]){
 const backend=fakeIndexedDb({version,stores:['areaNotes','syncQueue','tombstones']}),before=backend.snapshot();
 await assert.rejects(makeDb(backend).open(),error=>error.code==='STUDY_DIRECTOR_UNSUPPORTED_TOPOLOGY');
 assert.deepEqual(backend.snapshot(),before,'unsupported topology is not upgraded, reset, renamed or deleted');
}
const current=fakeIndexedDb({version:9,stores:canonicalNames}),db=makeDb(current);
assert.equal((await db.topology()).current,true);assert.deepEqual(current.snapshot(),{version:9,stores:canonicalNames});
assert.equal(db.retireLegacyStores,undefined);
const extra=fakeIndexedDb({version:9,stores:[...canonicalNames,'syncQueue']});
await assert.rejects(makeDb(extra).open(),error=>error.code==='STUDY_DIRECTOR_UNSUPPORTED_TOPOLOGY');
assert.ok(extra.snapshot().stores.includes('syncQueue'));
const newer=fakeIndexedDb({version:10,stores:canonicalNames});assert.equal((await makeDb(newer).topology()).newer,true);assert.equal(newer.snapshot().version,10);
const newerMissing=fakeIndexedDb({version:10,stores:canonicalNames.filter(name=>name!=='dailySummaries')}),missingBefore=newerMissing.snapshot();
assert.equal((await makeDb(newerMissing).topology()).usable,false,'startup can identify and explain a newer topology without touching it');assert.deepEqual(newerMissing.snapshot(),missingBefore);
const fresh=fakeIndexedDb(),resets=[],freshDb=makeDb(fresh,event=>resets.push(event));
await freshDb.open();assert.deepEqual(fresh.requests,[9],'fresh installation creates the current version in one atomic open');assert.deepEqual(fresh.snapshot(),{version:9,stores:canonicalNames});assert.equal(freshDb.lifecycle().startedFresh,true);
fresh.clearSiteData();await freshDb.open();await new Promise(resolve=>setTimeout(resolve,0));assert.equal(resets.length,1);assert.equal(freshDb.lifecycle().resets,1);
// A slow open (nothing blocking it) gets one fresh attempt before the app
// stops; the first request, if it finishes late, is closed unused. Two silent
// attempts fail with one storage error.
function silentIndexedDb({answerFrom,lateAfter=null}){
  const events={opens:0,closed:0};
  const answer=req=>{req.result={version:9,objectStoreNames:new StoreNames(new Set(canonicalNames)),createObjectStore(){},deleteObjectStore(){},transaction(name){return {objectStore:()=>({keyPath:({dailyRecords:'date',dailySummaries:'date',notes:'key',activeSessions:'id',appMeta:'key',assets:null})[name]})};},close(){events.closed++;},onversionchange:null,onclose:null};req.onsuccess?.();};
  return {events,open(){
    const attempt=++events.opens,req={result:null,error:null,onupgradeneeded:null,onsuccess:null,onerror:null,onblocked:null};
    if(attempt>=answerFrom)queueMicrotask(()=>answer(req));
    else if(lateAfter!==null)fastTimeout(()=>answer(req),lateAfter);
    return req;
  }};
}
function countingDb(backend,errors){
  const {persistence}=loadModules(backend);
  return persistence.createIndexedDb(Object.freeze({config:Object.freeze({dbName:'StudyDirectorDB',dbVersion:9,stores:currentStores}),hooks:Object.freeze({onError:message=>errors.push(String(message)),onOk:()=>{},capture:()=>{}})}));
}
{
  const errors=[],slow=silentIndexedDb({answerFrom:2,lateAfter:2700});
  assert.equal(Number((await countingDb(slow,errors).open()).version),9,'a slow open succeeds on its second attempt');
  await new Promise(resolve=>setTimeout(resolve,500));
  assert.deepEqual(slow.events,{opens:2,closed:1},'the late first request is closed unused');
  assert.deepEqual(errors,[],'a slow open that recovers reports no storage error');
  const hungErrors=[],hung=silentIndexedDb({answerFrom:Infinity});
  await assert.rejects(countingDb(hung,hungErrors).open(),/IndexedDB open timed out/u,'an open that never answers fails after the second attempt');
  assert.equal(hung.events.opens,2,'a hung open is tried twice, not more');
  assert.deepEqual(hungErrors,['IndexedDB open timed out'],'the storage error is reported once, after the last attempt');
}
// A transaction that cannot start while the open checks the stores is a
// storage failure: reported as one, never as an unsupported database.
{
  const errors=[],events={closed:0},broken={open(){
    const req={result:null,error:null,onupgradeneeded:null,onsuccess:null,onerror:null,onblocked:null};
    queueMicrotask(()=>{req.result={version:9,objectStoreNames:new StoreNames(new Set(canonicalNames)),createObjectStore(){},deleteObjectStore(){},transaction(){throw new Error('forced transaction failure');},close(){events.closed++;},onversionchange:null,onclose:null};req.onsuccess?.();});
    return req;
  }};
  await assert.rejects(countingDb(broken,errors).open(),error=>error.message==='forced transaction failure'&&error.code!=='STUDY_DIRECTOR_UNSUPPORTED_TOPOLOGY');
  assert.deepEqual(errors,['forced transaction failure'],'the failure is reported as a storage error');
  assert.equal(events.closed,1,'the connection is closed');
}
console.log(JSON.stringify({status:'PASS',suite:'canonical-topology',currentPreserved:true,unsupportedUntouched:true,freshCreation:true,recreationDetected:true,newerNotDowngraded:true,slowOpenRetriedOnce:true,transactionFailureNotUnsupported:true}));
