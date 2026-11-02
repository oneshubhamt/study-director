import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class StoreNames{
  constructor(set){this.set=set;}
  contains(name){return this.set.has(String(name));}
  [Symbol.iterator](){return [...this.set].sort()[Symbol.iterator]();}
}
function fakeIndexedDb(initial){
  let state=initial?{version:Number(initial.version),stores:new Set(initial.stores)}:null,lastDb=null;
  function dbView(){
    return {
      get version(){return state.version;},
      objectStoreNames:new StoreNames(state.stores),
      createObjectStore(name){state.stores.add(String(name));return {};},
      deleteObjectStore(name){state.stores.delete(String(name));},
      close(){},onversionchange:null,onclose:null
    };
  }
  return {
    open(name,requestedVersion){
      const req={result:null,error:null,onupgradeneeded:null,onsuccess:null,onerror:null,onblocked:null};
      queueMicrotask(()=>{
        try{
          const existed=!!state;
          const oldVersion=existed?state.version:0;
          const nextVersion=requestedVersion===undefined?(existed?oldVersion:1):Number(requestedVersion);
          if(existed&&nextVersion<oldVersion){req.error=new Error('VersionError');req.onerror?.();return;}
          if(!state)state={version:nextVersion,stores:new Set()};
          const upgrading=nextVersion>oldVersion;
          state.version=nextVersion;
          const db=dbView();
          req.result=db;lastDb=db;
          if(upgrading){
            // Renaming a store in the upgrade transaction keeps its rows.
            const transaction={aborted:false,abort(){this.aborted=true;},objectStore(from){return {set name(to){state.stores.delete(String(from));state.stores.add(String(to));}};}};
            req.onupgradeneeded?.({oldVersion,target:{result:db,transaction}});
            if(transaction.aborted)return;
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
  for(const file of ['internal','persistence','compatibility'])vm.runInContext(fs.readFileSync(`source/core/${file}.js`,'utf8'),context,{filename:`${file}.js`});
  const registry=context[Symbol.for('studyDirector.internalModules.v1')];
  return {persistence:registry.require('persistence',1),compatibility:registry.require('compatibility',1)};
}

const currentStores=Object.freeze({
  dailyRecords:'dailyRecords',dailySummaries:'dailySummaries',notes:'notes',activeSessions:'activeSessions',
  appMeta:'appMeta',assets:'assets'
});
const legacyStores=Object.freeze({syncQueue:'syncQueue',tombstones:'tombstones',reflectionDrafts:'reflectionDrafts'});
const canonicalNames=Object.values(currentStores).sort();
// Notes were kept in a store called areaNotes until version 8 renamed it.
const renamedStores=Object.freeze({notes:'areaNotes'}),shippedNames=canonicalNames.map(name=>name==='notes'?'areaNotes':name);
const upgradeWith=(compatibility,apply)=>Object.freeze({renameStores:context=>compatibility.renameIndexedDbStores(Object.freeze({...context,renamedStores})),apply});
function makeDb(indexedDB,onReset=null,apply=()=>false){
  const {persistence,compatibility}=loadModules(indexedDB);
  return persistence.createIndexedDb(Object.freeze({
    config:Object.freeze({dbName:'StudyDirectorDB',dbVersion:9,bridgeVersion:8,stores:currentStores,legacyStores}),
    hooks:Object.freeze(onReset?{onError:()=>{},onOk:()=>{},capture:()=>{},onReset}:{onError:()=>{},onOk:()=>{},capture:()=>{}}),
    upgrade:upgradeWith(compatibility,apply)
  }));
}

// The retired sync-era topology remains readable until verified migration retires it.
const legacyBackend=fakeIndexedDb({version:5,stores:[...shippedNames,'syncQueue','tombstones','reflectionDrafts']});
const legacyDb=makeDb(legacyBackend);
await legacyDb.open();
let topology=await legacyDb.topology();
assert.equal(topology.version,8,'an older database opens at the bridge version');
assert.equal(topology.stores.includes('notes'),true,'the bridge gives the notes store its current name');assert.equal(topology.stores.includes('areaNotes'),false);
assert.deepEqual([...topology.legacyStores].sort(),['reflectionDrafts','syncQueue','tombstones']);
assert.equal(topology.current,false);
assert.equal(await legacyDb.hasStore('syncQueue'),true,'legacy migration source must still exist before retirement');

const retired=await legacyDb.retireLegacyStores();
assert.equal(retired.status,'retired');
assert.equal(retired.removed,3);
topology=await legacyDb.topology();
assert.equal(topology.version,9);
assert.deepEqual([...topology.stores].sort(),canonicalNames);
assert.deepEqual([...topology.legacyStores],[]);
assert.equal(topology.current,true);
assert.equal(await legacyDb.hasStore('syncQueue'),false);
assert.equal(await legacyDb.hasStore('tombstones'),false);
assert.equal(await legacyDb.hasStore('reflectionDrafts'),false,'retired Reflection Draft object store must be physically deleted during topology retirement.');
assert.deepEqual(legacyBackend.snapshot(),{version:9,stores:canonicalNames});

// The previous build's database (version 7, already lean) gets the renamed store at the bridge too.
const previousBackend=fakeIndexedDb({version:7,stores:shippedNames});
const previousDb=makeDb(previousBackend);
await previousDb.open();
assert.deepEqual(previousBackend.snapshot().stores,[...canonicalNames,'syncQueue','tombstones'].sort(),'the bridge renames the notes store and adds the empty stores compatibility reads');
await previousDb.retireLegacyStores();
assert.deepEqual(previousBackend.snapshot(),{version:9,stores:canonicalNames});

// A fresh installation never creates the obsolete stores at all.
const freshBackend=fakeIndexedDb(null);
const freshDb=makeDb(freshBackend);
await freshDb.open();
const freshTopology=await freshDb.topology();
assert.equal(freshTopology.version,9);
assert.deepEqual([...freshTopology.stores].sort(),canonicalNames);
assert.deepEqual([...freshTopology.legacyStores],[]);
assert.equal(freshTopology.current,true);
assert.equal(freshDb.lifecycle().startedFresh,true,'a first-ever database is a fresh start, not a reset');
assert.equal(freshDb.lifecycle().resets,0);

// Clearing site data while the page stays open recreates the database on the
// next open. That is reported once; an ordinary reconnection is not a reset.
const resetEvents=[],resetBackend=fakeIndexedDb({version:9,stores:canonicalNames});
const resetDb=makeDb(resetBackend,event=>resetEvents.push(event));
await resetDb.open();
assert.equal(resetDb.lifecycle().startedFresh,false,'an existing database is not a fresh start');
resetBackend.closeConnection();await resetDb.open();await new Promise(resolve=>setTimeout(resolve,0));
assert.deepEqual(resetEvents,[],'reopening an existing database after a closed connection is not a reset');
resetBackend.clearSiteData();
const recreated=await resetDb.open();await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(Number(recreated.version),9,'the recreated database receives the current topology');
assert.equal(resetEvents.length,1,'the browser data clear is reported exactly once');
assert.equal(resetEvents[0].count,1);assert.ok(Number.isFinite(Date.parse(resetEvents[0].detectedAt)));
assert.equal(resetDb.lifecycle().resets,1);assert.equal(resetDb.lifecycle().startedFresh,false);


// A genuinely historical pre-v3 database must not be mistaken for a fresh v1 database.
let historicalUpgradeCalls=0;
const historicalBackend=fakeIndexedDb({version:1,stores:['dailyRecords','appMeta']});
const historicalDb=makeDb(historicalBackend,null,context=>{historicalUpgradeCalls++;return Number(context.oldVersion)<3;});
await historicalDb.open();
const historicalTopology=await historicalDb.topology();
assert.equal(historicalTopology.version,8,'historical DB must stop at the compatibility bridge before retirement');
assert.deepEqual([...historicalTopology.legacyStores].sort(),['syncQueue','tombstones']);
assert.equal(historicalUpgradeCalls,1,'pre-v3 compatibility upgrade adapter must run for an existing historical v1 database');
await historicalDb.retireLegacyStores();
assert.deepEqual(historicalBackend.snapshot(),{version:9,stores:canonicalNames});

// Another tab holding the database blocks an upgrade until it closes its
// connection. The open waits for that within its time limit; one that never
// clears fails, and a late result after that is closed and never upgrades.
function blockingIndexedDb({releaseAfter}){
  const events={aborted:0,closed:0};
  return {events,open(){
    const req={result:null,error:null,onupgradeneeded:null,onsuccess:null,onerror:null,onblocked:null};
    queueMicrotask(()=>req.onblocked?.());
    if(releaseAfter!==null)fastTimeout(()=>{
      const db={version:9,objectStoreNames:new StoreNames(new Set(canonicalNames)),createObjectStore(){},deleteObjectStore(){},close(){events.closed++;},onversionchange:null,onclose:null};
      req.result=db;req.onupgradeneeded?.({oldVersion:8,target:{result:db,transaction:{abort(){events.aborted++;},objectStore(){return {};}}}});req.onsuccess?.();
    },releaseAfter);
    return req;
  }};
}
{
  const released=blockingIndexedDb({releaseAfter:50});
  assert.equal(Number((await makeDb(released).open()).version),9,'an open blocked for a moment by another tab succeeds once it closes');
  assert.deepEqual(released.events,{aborted:0,closed:0});
  const stuck=blockingIndexedDb({releaseAfter:null});
  await assert.rejects(makeDb(stuck).open(),/IndexedDB open blocked/u,'a block that never clears fails within the time limit');
  const late=blockingIndexedDb({releaseAfter:2700});
  await assert.rejects(makeDb(late).open(),/IndexedDB open blocked/u);
  await new Promise(resolve=>fastTimeout(resolve,300));
  assert.deepEqual(late.events,{aborted:1,closed:1},'a late result is not upgraded and its connection is closed');
}

// A slow open (nothing blocking it) gets one fresh attempt before the app
// stops; the first request, if it finishes late, is closed and never upgrades.
// Two silent attempts fail with one storage error.
function silentIndexedDb({answerFrom,lateAfter=null}){
  const events={opens:0,aborted:0,closed:0};
  const answer=req=>{
    const db={version:9,objectStoreNames:new StoreNames(new Set(canonicalNames)),createObjectStore(){},deleteObjectStore(){},close(){events.closed++;},onversionchange:null,onclose:null};
    req.result=db;req.onupgradeneeded?.({oldVersion:8,target:{result:db,transaction:{abort(){events.aborted++;},objectStore(){return {};}}}});req.onsuccess?.();
  };
  return {events,open(){
    const attempt=++events.opens,req={result:null,error:null,onupgradeneeded:null,onsuccess:null,onerror:null,onblocked:null};
    if(attempt>=answerFrom)queueMicrotask(()=>answer(req));
    else if(lateAfter!==null)fastTimeout(()=>answer(req),lateAfter);
    return req;
  }};
}
function countingDb(indexedDB,errors){
  const {persistence,compatibility}=loadModules(indexedDB);
  return persistence.createIndexedDb(Object.freeze({
    config:Object.freeze({dbName:'StudyDirectorDB',dbVersion:9,bridgeVersion:8,stores:currentStores,legacyStores}),
    hooks:Object.freeze({onError:message=>errors.push(String(message)),onOk:()=>{},capture:()=>{}}),
    upgrade:upgradeWith(compatibility,()=>false)
  }));
}
{
  const errors=[],slow=silentIndexedDb({answerFrom:2,lateAfter:2700});
  assert.equal(Number((await countingDb(slow,errors).open()).version),9,'a slow open succeeds on its second attempt');
  await new Promise(resolve=>fastTimeout(resolve,500));
  assert.deepEqual(slow.events,{opens:2,aborted:1,closed:1},'the late first request is closed without upgrading');
  assert.deepEqual(errors,[],'a slow open that recovers reports no storage error');
  const hungErrors=[],hung=silentIndexedDb({answerFrom:Infinity});
  await assert.rejects(countingDb(hung,hungErrors).open(),/IndexedDB open timed out/u,'an open that never answers fails after the second attempt');
  assert.equal(hung.events.opens,2,'a hung open is tried twice, not more');
  assert.deepEqual(hungErrors,['IndexedDB open timed out'],'the storage error is reported once, after the last attempt');
}

console.log(JSON.stringify({
  status:'PASS',suite:'indexeddb-topology-retirement',
  migrated:{from:5,to:9,removed:['syncQueue','tombstones','reflectionDrafts'],renamed:{areaNotes:'notes'}},previousBuildBridged:true,briefBlockWaited:true,slowOpenRetriedOnce:true,freshInstallLean:true,historicalV1Bridged:true,siteDataClearDetected:true
},null,2));
