(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,functionPort:functions}=registry.contracts;
registry.define('persistence',1,()=>{
  const freeze=Object.freeze;
  function createLocalStorage(input=null){
    const hooks=input&&typeof input==='object'?input:{};
    const onError=typeof hooks.onError==='function'?hooks.onError:()=>{};
    const onOk=typeof hooks.onOk==='function'?hooks.onOk:()=>{};
    let lastError=null;
    const api={
      get lastError(){return lastError;},
      getText(key,fallback=''){
        try{
          const value=globalThis.localStorage.getItem(key);
          lastError=null;onOk('read');
          return value===null?fallback:value;
        }catch(error){lastError=error;onError('read',error);return fallback;}
      },
      setText(key,value){
        try{globalThis.localStorage.setItem(key,String(value??''));lastError=null;onOk('write');return true;}
        catch(error){lastError=error;onError('write',error);return false;}
      },
      getJson(key,fallback=null){
        try{
          const raw=globalThis.localStorage.getItem(key);
          lastError=null;onOk('read');
          return raw?JSON.parse(raw):fallback;
        }catch(error){lastError=error;onError('read',error);return fallback;}
      },
      setJson(key,value){
        try{globalThis.localStorage.setItem(key,JSON.stringify(value));lastError=null;onOk('write');return true;}
        catch(error){lastError=error;onError('write',error);return false;}
      },
      remove(key){
        try{globalThis.localStorage.removeItem(key);lastError=null;onOk('write');return true;}
        catch(error){lastError=error;onError('write',error);return false;}
      },
      keys(){
        try{const keys=Object.keys(globalThis.localStorage);lastError=null;onOk('read');return keys;}
        catch(error){lastError=error;onError('read',error);return [];}
      }
    };
    return freeze(api);
  }
  function randomIdPart(bytes=8){
    try{
      const arr=new Uint8Array(bytes);
      crypto.getRandomValues(arr);
      return [...arr].map(n=>n.toString(16).padStart(2,'0')).join('');
    }catch(e){
      return Math.random().toString(36).slice(2,12)+Date.now().toString(36);
    }
  }
  // A device ID says what the device is, so any device can name any other
  // with nothing typed and nothing else stored:
  // inst_<type>_<browser>_<first use, base 36>_<random>.
  const DEVICE_TYPES=freeze({iphone:'iPhone',ipad:'iPad',android:'Android',windows:'Windows',mac:'Mac',chromeos:'ChromeOS',linux:'Linux',device:'Device'});
  const BROWSERS=freeze({safari:'Safari',chrome:'Chrome',edge:'Edge',firefox:'Firefox',opera:'Opera',samsung:'Samsung Internet',browser:'Browser'});
  const INSTALLATION_ID=/^inst_([a-z]+)_([a-z]+)_([a-z0-9]{6,12})_([a-f0-9]{8})$/u;
  // Read once, when the ID is made. Some iPads report themselves as a Mac;
  // a touch screen tells them apart.
  function describeDevice(nav){
    const ua=String(nav&&nav.userAgent||''),platform=String(nav&&(nav.userAgentData&&nav.userAgentData.platform||nav.platform)||''),touch=Number(nav&&nav.maxTouchPoints)||0;
    const type=/iPhone|iPod/u.test(ua)?'iphone':/iPad/u.test(ua)||/Macintosh/u.test(ua)&&touch>1?'ipad':/Android/u.test(ua)?'android':/CrOS/u.test(ua)?'chromeos':/Windows/u.test(ua)||/^Win/u.test(platform)?'windows':/Macintosh|Mac OS X/u.test(ua)||/^Mac/u.test(platform)?'mac':/Linux/u.test(ua)||/Linux/u.test(platform)?'linux':'device';
    const browser=/SamsungBrowser/u.test(ua)?'samsung':/Edg(?:e|A|iOS)?\//u.test(ua)?'edge':/OPR\/|Opera/u.test(ua)?'opera':/Firefox\/|FxiOS/u.test(ua)?'firefox':/Chrome\/|CriOS|Chromium/u.test(ua)?'chrome':/Safari\//u.test(ua)?'safari':'browser';
    return freeze({type,browser});
  }
  // "iPhone · Safari", with the first-use date added only when another of
  // the given devices would read the same. '' for an ID that does not say.
  function deviceName(id,others=[]){
    const parse=value=>{const match=INSTALLATION_ID.exec(String(value||''));return match&&DEVICE_TYPES[match[1]]&&BROWSERS[match[2]]?freeze({label:`${DEVICE_TYPES[match[1]]} · ${BROWSERS[match[2]]}`,since:parseInt(match[3],36)}):null;};
    const own=parse(id);if(!own)return '';
    const alike=[...others].some(other=>String(other||'')!==String(id)&&parse(other)?.label===own.label);
    return alike?`${own.label} (since ${new Date(own.since).toLocaleDateString(undefined,{day:'numeric',month:'short'})})`:own.label;
  }
  function createInstallationIdentity(input){
    exactObject(input,['local','keys','describe'],'Installation identity input');
    exactObject(input.keys,['installationId'],'Installation identity keys');
    if(!Object.isFrozen(input.local)||typeof input.describe!=='function')throw new TypeError('Installation identity storage must be frozen.');
    const LocalStorageContract=input.local,key=input.keys.installationId;
    let cached='';
    function normalize(value){const match=INSTALLATION_ID.exec(String(value||''));return match&&DEVICE_TYPES[match[1]]&&BROWSERS[match[2]]?String(value):'';}
    function getId(){
      if(cached)return cached;
      const current=normalize(LocalStorageContract.getText(key,''));
      if(current){cached=current;return current;}
      const kind=input.describe()||{},type=DEVICE_TYPES[kind.type]?kind.type:'device',browser=BROWSERS[kind.browser]?kind.browser:'browser';
      const id=`inst_${type}_${browser}_${Date.now().toString(36)}_${randomIdPart(4)}`;
      if(!LocalStorageContract.setText(key,id))throw LocalStorageContract.lastError||new Error('Installation identity could not be persisted.');
      const verified=normalize(LocalStorageContract.getText(key,''));
      if(verified!==id)throw new Error('Installation identity write could not be verified.');
      cached=id;return id;
    }
    return freeze({format:'study-director.installation-identity',contractVersion:4,getId});
  }
  function normalizeTimestamp(value,fallback=null){
    const n=Date.parse(value||'');
    return Number.isFinite(n)?new Date(n).toISOString():fallback;
  }
  function normalizeImportedTimestamp(value,fallback=null,nowMs=Date.now()){
    const n=Date.parse(value||'');
    return !Number.isFinite(n)||n>Number(nowMs)+10*60*1000?fallback:new Date(n).toISOString();
  }
  function normalizeImportedEpochMillis(value,fallback=null,nowMs=Date.now()){
    const n=Number(value);
    return !Number.isFinite(n)||n<0||n>Number(nowMs)+10*60*1000?fallback:Math.round(n);
  }
  function jsonByteLength(value){
    const text=typeof value==='string'?value:JSON.stringify(value);
    try{return new TextEncoder().encode(text).byteLength;}catch(e){return text.length*2;}
  }
  function createIndexedDb(input){
    if(!input||!Object.isFrozen(input))throw new TypeError('IndexedDB input must be frozen.');
    const inputKeys=Object.keys(input).sort(),allowedKeys=['config','hooks','upgrade'];
    if(inputKeys.some(key=>!allowedKeys.includes(key))||!inputKeys.includes('config')||!inputKeys.includes('hooks'))throw new TypeError('IndexedDB input is incomplete, mutable, or contains unexpected fields.');
    exactObject(input.config,['dbName','dbVersion','bridgeVersion','stores','legacyStores'],'IndexedDB config');
    exactObject(input.config.stores,['dailyRecords','dailySummaries','notes','activeSessions','appMeta','assets'],'IndexedDB stores');
    exactObject(input.config.legacyStores,['syncQueue','tombstones','reflectionDrafts'],'IndexedDB legacy stores');
    functions(input.hooks,Object.hasOwn(input.hooks,'onReset')?['onError','onOk','capture','onReset']:['onError','onOk','capture'],'IndexedDB hooks');
    if(input.upgrade!==undefined)functions(input.upgrade,['renameStores','apply'],'IndexedDB upgrade adapter');
    const applyUpgrade=input.upgrade?input.upgrade.apply:()=>false,renameStores=input.upgrade?input.upgrade.renameStores:()=>0;
    const DB_NAME=input.config.dbName;
    const DB_VER=input.config.dbVersion;
    const BRIDGE_VER=input.config.bridgeVersion;
    const DB_DAILY_RECORD_STORE=input.config.stores.dailyRecords;
    const DB_DAILY_SUMMARY_STORE=input.config.stores.dailySummaries;
    const DB_NOTES_STORE=input.config.stores.notes;
    const DB_ACTIVE_SESSION_STORE=input.config.stores.activeSessions;
    const DB_APP_META_STORE=input.config.stores.appMeta;
    const DB_ASSET_STORE=input.config.stores.assets;
    const DB_LEGACY_SYNC_QUEUE_STORE=input.config.legacyStores.syncQueue;
    const DB_LEGACY_TOMBSTONE_STORE=input.config.legacyStores.tombstones;
    const DB_RETIRED_REFLECTION_DRAFT_STORE=input.config.legacyStores.reflectionDrafts;
    const LEGACY_STORES=freeze([DB_LEGACY_SYNC_QUEUE_STORE,DB_LEGACY_TOMBSTONE_STORE,DB_RETIRED_REFLECTION_DRAFT_STORE]);
    const markStorageHealthError=input.hooks.onError;
    const markStorageHealthOk=input.hooks.onOk;
    const AppDiagnostics=freeze({capture:input.hooks.capture});
    const onReset=typeof input.hooks.onReset==='function'?input.hooks.onReset:null;
    let appDbConnection=null;
    let appDbOpenPromise=null;
    const freshlyCreatedDatabases=new WeakSet();
    // A database created after this page already held a connection was not
    // opened for the first time: the browser deleted the site's data while the
    // page stayed open (for example, Clear browsing data). Callers must not
    // treat their in-memory "already saved" knowledge as durable after that.
    let establishedConnection=false,startedFresh=false,resetCount=0,lastResetAt='';
    function noteRecreatedDatabase(){
      resetCount++;lastResetAt=new Date().toISOString();
      const event=freeze({detectedAt:lastResetAt,count:resetCount});
      AppDiagnostics.capture('storage.idb-recreated',new Error('The browser database was recreated while the app was open.'),'warn');
      if(onReset)setTimeout(()=>{try{onReset(event);}catch(error){AppDiagnostics.capture('storage.idb-recreated-hook',error);}},0);
    }
    function clearAppDBConnection(db=null){
      if(db&&appDbConnection!==db)return false;
      appDbConnection=null;
      return true;
    }
    function ensureCurrentStores(db){
      if(!db.objectStoreNames.contains(DB_DAILY_RECORD_STORE))db.createObjectStore(DB_DAILY_RECORD_STORE,{keyPath:'date'});
      if(!db.objectStoreNames.contains(DB_DAILY_SUMMARY_STORE))db.createObjectStore(DB_DAILY_SUMMARY_STORE,{keyPath:'date'});
      if(!db.objectStoreNames.contains(DB_NOTES_STORE))db.createObjectStore(DB_NOTES_STORE,{keyPath:'key'});
      if(!db.objectStoreNames.contains(DB_ACTIVE_SESSION_STORE))db.createObjectStore(DB_ACTIVE_SESSION_STORE,{keyPath:'id'});
      if(!db.objectStoreNames.contains(DB_APP_META_STORE))db.createObjectStore(DB_APP_META_STORE,{keyPath:'key'});
      if(!db.objectStoreNames.contains(DB_ASSET_STORE))db.createObjectStore(DB_ASSET_STORE);
    }
    function ensureLegacyStores(db){
      if(!db.objectStoreNames.contains(DB_LEGACY_SYNC_QUEUE_STORE))db.createObjectStore(DB_LEGACY_SYNC_QUEUE_STORE,{keyPath:'key'});
      if(!db.objectStoreNames.contains(DB_LEGACY_TOMBSTONE_STORE))db.createObjectStore(DB_LEGACY_TOMBSTONE_STORE,{keyPath:'key'});
    }
    function removeLegacyStores(db){
      for(const name of LEGACY_STORES)if(db.objectStoreNames.contains(name))db.deleteObjectStore(name);
    }
    function attachConnection(db){
      appDbConnection=db;establishedConnection=true;
      db.onversionchange=()=>{
        if(appDbConnection===db)clearAppDBConnection(db);
        try{db.close();}catch(error){AppDiagnostics.capture('storage.db-versionchange-close',error);}
      };
      if('onclose' in db)db.onclose=()=>clearAppDBConnection(db);
      markStorageHealthOk();
      return db;
    }
    function openRequest(version=null,{legacyBridge=false,retireLegacy=false,fresh=false}={}){
      return new Promise((resolve,reject)=>{
        if(typeof globalThis.indexedDB?.open!=='function'){markStorageHealthError('IndexedDB unavailable');reject(new Error('IndexedDB unavailable'));return;}
        let settled=false,blocked=false;
        const finish=(fn,val)=>{if(settled)return;settled=true;clearTimeout(timer);fn(val);};
        const timer=setTimeout(()=>{const message=blocked?'IndexedDB open blocked':'IndexedDB open timed out';markStorageHealthError(message);finish(reject,new Error(message));},2500);
        let req;
        try{req=version===null?globalThis.indexedDB.open(DB_NAME):globalThis.indexedDB.open(DB_NAME,version);}catch(error){markStorageHealthError(error&&error.message?error.message:'IndexedDB open failed');finish(reject,error);return;}
        req.onupgradeneeded=e=>{
          // An open that was given up on never upgrades in the background.
          if(settled){try{e.target.transaction&&e.target.transaction.abort();}catch(abortError){}return;}
          try{
            const db=e.target.result,tx=e.target.transaction;
            if(version===null&&Number(e.oldVersion||0)===0)freshlyCreatedDatabases.add(db);
            if(!fresh)renameStores(Object.freeze({db,transaction:tx}));
            ensureCurrentStores(db);
            if(legacyBridge)ensureLegacyStores(db);
            if(retireLegacy)removeLegacyStores(db);
            if(!fresh)applyUpgrade(Object.freeze({oldVersion:Number(e.oldVersion||0),db,transaction:tx,appMetaStore:DB_APP_META_STORE}));
          }catch(error){
            try{e.target.transaction&&e.target.transaction.abort();}catch(abortError){}
            markStorageHealthError((error&&error.message)||'IndexedDB upgrade failed');
            finish(reject,error||new Error('IndexedDB upgrade failed'));
          }
        };
        req.onsuccess=()=>{if(settled){try{req.result.close();}catch(closeError){}return;}finish(resolve,req.result);};
        req.onerror=()=>{if(settled)return;markStorageHealthError((req.error&&req.error.message)||'IndexedDB open failed');finish(reject,req.error||new Error('IndexedDB open failed'));};
        // Another tab still holds the database while it closes its connection
        // (each tab closes on a version change); the open waits for it within
        // the same time limit.
        req.onblocked=()=>{blocked=true;};
      });
    }
    async function openBootstrapDatabase(){
      let db=await openRequest(null,{fresh:true});
      // A brand-new versionless database is created at v1. Promote it directly
      // to the current lean topology; there is no historical state to bridge.
      if(Number(db.version)===1&&freshlyCreatedDatabases.has(db)){
        db.close();
        db=await openRequest(DB_VER,{retireLegacy:true,fresh:true});
        if(establishedConnection)noteRecreatedDatabase();else startedFresh=true;
        return db;
      }
      if(Number(db.version)<BRIDGE_VER){
        db.close();
        db=await openRequest(BRIDGE_VER,{legacyBridge:true});
      }
      if(Number(db.version)>DB_VER){
        const version=db.version;db.close();
        throw new Error(`IndexedDB version ${version} is newer than this Study Director build supports.`);
      }
      return db;
    }
    function openAppDB(){
      if(appDbConnection)return Promise.resolve(appDbConnection);
      if(appDbOpenPromise)return appDbOpenPromise;
      const opening=openBootstrapDatabase().then(attachConnection);
      appDbOpenPromise=opening;
      opening.then(()=>{if(appDbOpenPromise===opening)appDbOpenPromise=null;},()=>{if(appDbOpenPromise===opening)appDbOpenPromise=null;});
      return opening;
    }
    async function topology(){
      const db=await openAppDB();
      const stores=[...db.objectStoreNames];
      return freeze({version:Number(db.version),stores:freeze(stores),legacyStores:freeze(LEGACY_STORES.filter(name=>stores.includes(name))),current:stores.filter(name=>LEGACY_STORES.includes(name)).length===0&&Number(db.version)===DB_VER});
    }
    async function hasStore(name){const db=await openAppDB();return db.objectStoreNames.contains(String(name));}
    async function getAllIfPresent(storeName,abortMessage='read aborted'){
      if(!(await hasStore(storeName)))return [];
      return idbGetAll(storeName,abortMessage);
    }
    async function retireLegacyStores(){
      const current=await openAppDB();
      const present=LEGACY_STORES.filter(name=>current.objectStoreNames.contains(name));
      if(Number(current.version)===DB_VER){
        if(present.length)throw new Error('Current IndexedDB version still contains retired compatibility stores.');
        return freeze({status:'current',version:DB_VER,removed:0});
      }
      if(Number(current.version)>DB_VER)throw new Error('IndexedDB is newer than the current Study Director topology.');
      clearAppDBConnection(current);try{current.close();}catch(error){}
      const upgraded=await openRequest(DB_VER,{retireLegacy:true});
      attachConnection(upgraded);
      const remaining=LEGACY_STORES.filter(name=>upgraded.objectStoreNames.contains(name));
      if(remaining.length)throw new Error(`Obsolete IndexedDB stores remain after topology retirement: ${remaining.join(', ')}`);
      return freeze({status:present.length?'retired':'upgraded',version:DB_VER,removed:present.length});
    }
    let strictDurabilitySupport=0;
    function createIdbTransaction(db,stores,mode,strict=false){
      if(!strict)return db.transaction(stores,mode);
      if(mode!=='readwrite')throw new TypeError('Strict IndexedDB durability is reserved for readwrite transactions.');
      if(strictDurabilitySupport<0)return db.transaction(stores,mode);
      try{
        const tx=db.transaction(stores,mode,{durability:'strict'});
        if(String(tx&&tx.durability||'')==='strict')strictDurabilitySupport=1;
        else if(strictDurabilitySupport===0){
          strictDurabilitySupport=-1;
          AppDiagnostics.capture('storage.idb-strict-durability-unavailable',new Error('This browser did not confirm strict IndexedDB durability; default durability is being used.'),'warn');
        }
        return tx;
      }catch(error){
        if(error&&error.name==='TypeError'){
          strictDurabilitySupport=-1;
          AppDiagnostics.capture('storage.idb-strict-durability-unavailable',error,'warn');
          return db.transaction(stores,mode);
        }
        throw error;
      }
    }
    async function runIdbTransaction(stores,mode,fn,abortMessage='transaction aborted',strict=false,retry=0){
      const db=await openAppDB();
      return new Promise((resolve,reject)=>{
        let tx;
        try{tx=createIdbTransaction(db,stores,mode,strict);}
        catch(error){
          if(appDbConnection===db){clearAppDBConnection(db);try{db.close();}catch(closeError){}}
          if(retry<1){runIdbTransaction(stores,mode,fn,abortMessage,strict,retry+1).then(resolve,reject);return;}
          markStorageHealthError((error&&error.message)||abortMessage);reject(error);return;
        }
        let settled=false;
        const finish=(ok,val)=>{
          if(settled)return;settled=true;
          if(ok){markStorageHealthOk();resolve(val);}
          else{markStorageHealthError((val&&val.message)||abortMessage);reject(val);}
        };
        tx.onerror=()=>finish(false,tx.error||new Error(abortMessage));
        tx.onabort=()=>finish(false,tx.error||new Error(abortMessage));
        try{fn(tx,finish);}catch(error){try{tx.abort();}catch{}finish(false,error);}
      });
    }
    function idbTransaction(stores,mode,fn,abortMessage='transaction aborted'){return runIdbTransaction(stores,mode,fn,abortMessage,false);}
    function idbStrictTransaction(stores,mode,fn,abortMessage='transaction aborted'){return runIdbTransaction(stores,mode,fn,abortMessage,true);}
    function idbStoreTransaction(storeName,mode,fn,abortMessage='transaction aborted'){return idbTransaction(storeName,mode,(tx,finish)=>fn(tx.objectStore(storeName),tx,finish),abortMessage);}
    function idbStrictStoreTransaction(storeName,mode,fn,abortMessage='transaction aborted'){return idbStrictTransaction(storeName,mode,(tx,finish)=>fn(tx.objectStore(storeName),tx,finish),abortMessage);}
    function idbGet(storeName,key,abortMessage='read aborted'){
      return idbStoreTransaction(storeName,'readonly',(store,tx,finish)=>{const req=store.get(key);req.onsuccess=()=>finish(true,req.result||null);req.onerror=()=>finish(false,req.error||new Error(abortMessage));},abortMessage);
    }
    function idbGetAll(storeName,abortMessage='read aborted'){
      return idbStoreTransaction(storeName,'readonly',(store,tx,finish)=>{const req=store.getAll();req.onsuccess=()=>finish(true,req.result||[]);req.onerror=()=>finish(false,req.error||new Error(abortMessage));},abortMessage);
    }
    return freeze({
      format:'study-director.indexeddb-primitives',contractVersion:2,
      isAvailable:()=>typeof globalThis.indexedDB?.open==='function',clearConnection:clearAppDBConnection,open:openAppDB,
      transaction:idbTransaction,strictTransaction:idbStrictTransaction,storeTransaction:idbStoreTransaction,strictStoreTransaction:idbStrictStoreTransaction,
      get:idbGet,getAll:idbGetAll,getAllIfPresent,hasStore,topology,retireLegacyStores,
      lifecycle:()=>freeze({startedFresh,resets:resetCount,lastResetAt})
    });
  }

  return freeze({
    format:'study-director.persistence-primitives',
    contractVersion:1,
    createLocalStorage,
    createInstallationIdentity,describeDevice,deviceName,
    randomIdPart,normalizeTimestamp,normalizeImportedTimestamp,normalizeImportedEpochMillis,jsonByteLength,
    createIndexedDb
  });
});
})();
