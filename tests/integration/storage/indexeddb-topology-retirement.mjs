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
            const transaction={aborted:false,abort(){this.aborted=true;}};
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

function loadPersistence(indexedDB){
  const context=vm.createContext({
    console,Date,Math,JSON,RegExp,Error,TypeError,Object,Array,String,Number,Map,Set,Promise,Uint8Array,TextEncoder,
    crypto:globalThis.crypto,indexedDB,setTimeout,clearTimeout,queueMicrotask,globalThis:null
  });
  context.globalThis=context;
  for(const file of ['internal','persistence'])vm.runInContext(fs.readFileSync(`source/core/${file}.js`,'utf8'),context,{filename:`${file}.js`});
  return context[Symbol.for('studyDirector.internalModules.v1')].require('persistence',1);
}

const currentStores=Object.freeze({
  dailyRecords:'dailyRecords',dailySummaries:'dailySummaries',areaNotes:'areaNotes',activeSessions:'activeSessions',
  appMeta:'appMeta',assets:'assets'
});
const legacyStores=Object.freeze({syncQueue:'syncQueue',tombstones:'tombstones',reflectionDrafts:'reflectionDrafts'});
const canonicalNames=Object.values(currentStores).sort();
function makeDb(indexedDB,onReset=null){
  const persistence=loadPersistence(indexedDB);
  return persistence.createIndexedDb(Object.freeze({
    config:Object.freeze({dbName:'StudyDirectorDB',dbVersion:7,legacyBaselineVersion:5,stores:currentStores,legacyStores}),
    hooks:Object.freeze(onReset?{onError:()=>{},onOk:()=>{},capture:()=>{},onReset}:{onError:()=>{},onOk:()=>{},capture:()=>{}}),
    upgrade:Object.freeze({apply:()=>false})
  }));
}

// The retired sync-era topology remains readable until verified migration retires it.
const legacyBackend=fakeIndexedDb({version:5,stores:[...canonicalNames,'syncQueue','tombstones','reflectionDrafts']});
const legacyDb=makeDb(legacyBackend);
await legacyDb.open();
let topology=await legacyDb.topology();
assert.equal(topology.version,5);
assert.deepEqual([...topology.legacyStores].sort(),['reflectionDrafts','syncQueue','tombstones']);
assert.equal(topology.current,false);
assert.equal(await legacyDb.hasStore('syncQueue'),true,'legacy migration source must still exist before retirement');

const retired=await legacyDb.retireLegacyStores();
assert.equal(retired.status,'retired');
assert.equal(retired.removed,3);
topology=await legacyDb.topology();
assert.equal(topology.version,7);
assert.deepEqual([...topology.stores].sort(),canonicalNames);
assert.deepEqual([...topology.legacyStores],[]);
assert.equal(topology.current,true);
assert.equal(await legacyDb.hasStore('syncQueue'),false);
assert.equal(await legacyDb.hasStore('tombstones'),false);
assert.equal(await legacyDb.hasStore('reflectionDrafts'),false,'retired Reflection Draft object store must be physically deleted during topology retirement.');
assert.deepEqual(legacyBackend.snapshot(),{version:7,stores:canonicalNames});

// A fresh installation never creates the obsolete stores at all.
const freshBackend=fakeIndexedDb(null);
const freshDb=makeDb(freshBackend);
await freshDb.open();
const freshTopology=await freshDb.topology();
assert.equal(freshTopology.version,7);
assert.deepEqual([...freshTopology.stores].sort(),canonicalNames);
assert.deepEqual([...freshTopology.legacyStores],[]);
assert.equal(freshTopology.current,true);
assert.equal(freshDb.lifecycle().startedFresh,true,'a first-ever database is a fresh start, not a reset');
assert.equal(freshDb.lifecycle().resets,0);

// Clearing site data while the page stays open recreates the database on the
// next open. That is reported once; an ordinary reconnection is not a reset.
const resetEvents=[],resetBackend=fakeIndexedDb({version:7,stores:canonicalNames});
const resetDb=makeDb(resetBackend,event=>resetEvents.push(event));
await resetDb.open();
assert.equal(resetDb.lifecycle().startedFresh,false,'an existing database is not a fresh start');
resetBackend.closeConnection();await resetDb.open();await new Promise(resolve=>setTimeout(resolve,0));
assert.deepEqual(resetEvents,[],'reopening an existing database after a closed connection is not a reset');
resetBackend.clearSiteData();
const recreated=await resetDb.open();await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(Number(recreated.version),7,'the recreated database receives the current topology');
assert.equal(resetEvents.length,1,'the browser data clear is reported exactly once');
assert.equal(resetEvents[0].count,1);assert.ok(Number.isFinite(Date.parse(resetEvents[0].detectedAt)));
assert.equal(resetDb.lifecycle().resets,1);assert.equal(resetDb.lifecycle().startedFresh,false);


// A genuinely historical pre-v3 database must not be mistaken for a fresh v1 database.
let historicalUpgradeCalls=0;
const historicalBackend=fakeIndexedDb({version:1,stores:['dailyRecords','appMeta']});
const historicalPersistence=loadPersistence(historicalBackend);
const historicalDb=historicalPersistence.createIndexedDb(Object.freeze({
  config:Object.freeze({dbName:'StudyDirectorDB',dbVersion:7,legacyBaselineVersion:5,stores:currentStores,legacyStores}),
  hooks:Object.freeze({onError:()=>{},onOk:()=>{},capture:()=>{}}),
  upgrade:Object.freeze({apply:context=>{historicalUpgradeCalls++;return Number(context.oldVersion)<3;}})
}));
await historicalDb.open();
const historicalTopology=await historicalDb.topology();
assert.equal(historicalTopology.version,5,'historical DB must stop at the compatibility bridge before retirement');
assert.deepEqual([...historicalTopology.legacyStores].sort(),['syncQueue','tombstones']);
assert.equal(historicalUpgradeCalls,1,'pre-v3 compatibility upgrade adapter must run for an existing historical v1 database');
await historicalDb.retireLegacyStores();
assert.deepEqual(historicalBackend.snapshot(),{version:7,stores:canonicalNames});

console.log(JSON.stringify({
  status:'PASS',suite:'indexeddb-topology-retirement',
  migrated:{from:5,to:7,removed:['syncQueue','tombstones','reflectionDrafts']},freshInstallLean:true,historicalV1Bridged:true,siteDataClearDetected:true
},null,2));
