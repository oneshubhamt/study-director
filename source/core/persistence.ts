import type {BrowserRegistry} from '../../types/browser-registry.ts';
import type {LocalHooks,DeviceType,BrowserType,NavigatorIdentity,IdentityInput,DbInput,DbKey,DbQuery,DbCursor,DbStore,DbTransaction,FinishArgs,TransactionOperation,StoreOperation,StoredClassification} from '../../types/persistence.ts';
(()=>{
'use strict';
const registry=(globalThis as typeof globalThis & {[key:symbol]:BrowserRegistry|undefined})[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,functionPort:functions}=registry.contracts;
registry.define('persistence',1,()=>{
  const freeze=Object.freeze;
  // Error properties are inspected structurally, including errors from other realms.
  const errorField=(error:unknown,key:'message'|'code'|'name'):unknown=>error==null?undefined:(error as Partial<Record<'message'|'code'|'name',unknown>>)[key];
  function createLocalStorage(input:LocalHooks|null=null){
    const hooks=input&&typeof input==='object'?input:{};
    const onError=typeof hooks.onError==='function'?hooks.onError:()=>{};
    const onOk=typeof hooks.onOk==='function'?hooks.onOk:()=>{};
    let lastError:unknown=null;
    function getText(key:string,fallback?:string):string;
    function getText(key:string,fallback:null):string|null;
    function getText(key:string,fallback:string|null=''){
        try{
          const value=globalThis.localStorage.getItem(key);
          lastError=null;onOk('read');
          return value===null?fallback:value;
        }catch(error){lastError=error;onError('read',error);return fallback;}
      }
    const api={
      get lastError(){return lastError;},
      getText,
      setText(key:string,value:unknown){
        try{globalThis.localStorage.setItem(key,String(value??''));lastError=null;onOk('write');return true;}
        catch(error){lastError=error;onError('write',error);return false;}
      },
      getJson(key:string,fallback:unknown=null):unknown{
        try{
          const raw=globalThis.localStorage.getItem(key);
          lastError=null;onOk('read');
          return raw?JSON.parse(raw) as unknown:fallback;
        }catch(error){lastError=error;onError('read',error);return fallback;}
      },
      setJson(key:string,value:unknown){
        try{globalThis.localStorage.setItem(key,String(JSON.stringify(value)));lastError=null;onOk('write');return true;}
        catch(error){lastError=error;onError('write',error);return false;}
      },
      remove(key:string){
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
  const DEVICE_TYPES:Readonly<Record<string,string>>=freeze({iphone:'iPhone',ipad:'iPad',android:'Android',windows:'Windows',mac:'Mac',chromeos:'ChromeOS',linux:'Linux',device:'Device'});
  const BROWSERS:Readonly<Record<string,string>>=freeze({safari:'Safari',chrome:'Chrome',edge:'Edge',firefox:'Firefox',opera:'Opera',samsung:'Samsung Internet',browser:'Browser'});
  const INSTALLATION_ID=/^inst_([a-z]+)_([a-z]+)_([a-z0-9]{6,12})_([a-f0-9]{8})$/u;
  // Read once, when the ID is made. Some iPads report themselves as a Mac;
  // a touch screen tells them apart.
  function describeDevice(nav:NavigatorIdentity|null|undefined){
    const ua=String(nav&&nav.userAgent||''),platform=String(nav&&(nav.userAgentData&&nav.userAgentData.platform||nav.platform)||''),touch=Number(nav&&nav.maxTouchPoints)||0;
    const type:DeviceType=/iPhone|iPod/u.test(ua)?'iphone':/iPad/u.test(ua)||/Macintosh/u.test(ua)&&touch>1?'ipad':/Android/u.test(ua)?'android':/CrOS/u.test(ua)?'chromeos':/Windows/u.test(ua)||/^Win/u.test(platform)?'windows':/Macintosh|Mac OS X/u.test(ua)||/^Mac/u.test(platform)?'mac':/Linux/u.test(ua)||/Linux/u.test(platform)?'linux':'device';
    const browser:BrowserType=/SamsungBrowser/u.test(ua)?'samsung':/Edg(?:e|A|iOS)?\//u.test(ua)?'edge':/OPR\/|Opera/u.test(ua)?'opera':/Firefox\/|FxiOS/u.test(ua)?'firefox':/Chrome\/|CriOS|Chromium/u.test(ua)?'chrome':/Safari\//u.test(ua)?'safari':'browser';
    return freeze({type,browser});
  }
  // "iPhone · Safari", with the first-use date added only when another of
  // the given devices would read the same. '' for an ID that does not say.
  function deviceName(id:unknown,others:Iterable<unknown>=[]){
    const parse=(value:unknown)=>{const match=INSTALLATION_ID.exec(String(value||''));return match&&DEVICE_TYPES[match[1]!]&&BROWSERS[match[2]!]?freeze({label:`${DEVICE_TYPES[match[1]!]} · ${BROWSERS[match[2]!]}`,since:parseInt(match[3]!,36)}):null;};
    const own=parse(id);if(!own)return '';
    const alike=[...others].some(other=>String(other||'')!==String(id)&&parse(other)?.label===own.label);
    return alike?`${own.label} (since ${new Date(own.since).toLocaleDateString(undefined,{day:'numeric',month:'short'})})`:own.label;
  }
  function createInstallationIdentity(input:IdentityInput){
    exactObject(input,['local','keys','describe'],'Installation identity input');
    exactObject(input.keys,['installationId'],'Installation identity keys');
    if(!Object.isFrozen(input.local)||typeof input.describe!=='function')throw new TypeError('Installation identity storage must be frozen.');
    const LocalStorageContract=input.local,key=input.keys.installationId;
    let cached='';
    function normalize(value:unknown){const match=INSTALLATION_ID.exec(String(value||''));return match&&DEVICE_TYPES[match[1]!]&&BROWSERS[match[2]!]?String(value):'';}
    function getId(){
      if(cached)return cached;
      const current=normalize(LocalStorageContract.getText(key,''));
      if(current){cached=current;return current;}
      const kind=input.describe()||{},type=DEVICE_TYPES[kind.type||'']?kind.type:'device',browser=BROWSERS[kind.browser||'']?kind.browser:'browser';
      const id=`inst_${type}_${browser}_${Date.now().toString(36)}_${randomIdPart(4)}`;
      if(!LocalStorageContract.setText(key,id))throw LocalStorageContract.lastError||new Error('Installation identity could not be persisted.');
      const verified=normalize(LocalStorageContract.getText(key,''));
      if(verified!==id)throw new Error('Installation identity write could not be verified.');
      cached=id;return id;
    }
    // After a browser-data clear the open tab writes its ID back, so the device
    // keeps its name and its Device Folder backups. An ID another tab has
    // written since is left alone.
    function keep(){
      if(!cached||normalize(LocalStorageContract.getText(key,'')))return true;
      return LocalStorageContract.setText(key,cached)&&normalize(LocalStorageContract.getText(key,''))===cached;
    }
    return freeze({format:'study-director.installation-identity',contractVersion:4,getId,keep});
  }
  function normalizeTimestamp(value:unknown,fallback?:null):string|null;
  function normalizeTimestamp(value:unknown,fallback:string):string;
  function normalizeTimestamp(value:unknown,fallback:string|null=null){
    const n=Date.parse(String(value||''));
    return Number.isFinite(n)?new Date(n).toISOString():fallback;
  }
  function normalizeImportedTimestamp(value:unknown,fallback?:null,nowMs?:number):string|null;
  function normalizeImportedTimestamp(value:unknown,fallback:string,nowMs?:number):string;
  function normalizeImportedTimestamp(value:unknown,fallback:string|null=null,nowMs=Date.now()){
    const n=Date.parse(String(value||''));
    return !Number.isFinite(n)||n>Number(nowMs)+10*60*1000?fallback:new Date(n).toISOString();
  }
  function normalizeImportedEpochMillis(value:unknown,fallback?:null,nowMs?:number):number|null;
  function normalizeImportedEpochMillis(value:unknown,fallback:number,nowMs?:number):number;
  function normalizeImportedEpochMillis(value:unknown,fallback:number|null=null,nowMs=Date.now()){
    const n=Number(value);
    return !Number.isFinite(n)||n<0||n>Number(nowMs)+10*60*1000?fallback:Math.round(n);
  }
  function jsonByteLength(value:unknown){
    const text=typeof value==='string'?value:JSON.stringify(value);
    try{return new TextEncoder().encode(text).byteLength;}catch(e){return text!.length*2;}
  }
  function createIndexedDb(input:DbInput){
    if(!input||!Object.isFrozen(input))throw new TypeError('IndexedDB input must be frozen.');
    const inputKeys=Object.keys(input).sort(),allowedKeys=['config','hooks'];
    if(inputKeys.some(key=>!allowedKeys.includes(key))||!inputKeys.includes('config')||!inputKeys.includes('hooks'))throw new TypeError('IndexedDB input is incomplete, mutable, or contains unexpected fields.');
    exactObject(input.config,['dbName','dbVersion','stores'],'IndexedDB config');
    exactObject(input.config.stores,['dailyRecords','dailySummaries','notes','activeSessions','appMeta','assets'],'IndexedDB stores');
    functions(input.hooks,Object.hasOwn(input.hooks,'onReset')?['onError','onOk','capture','onReset']:['onError','onOk','capture'],'IndexedDB hooks');
    const DB_NAME=input.config.dbName;
    const DB_VER=input.config.dbVersion;
    const DB_DAILY_RECORD_STORE=input.config.stores.dailyRecords;
    const DB_DAILY_SUMMARY_STORE=input.config.stores.dailySummaries;
    const DB_NOTES_STORE=input.config.stores.notes;
    const DB_ACTIVE_SESSION_STORE=input.config.stores.activeSessions;
    const DB_APP_META_STORE=input.config.stores.appMeta;
    const DB_ASSET_STORE=input.config.stores.assets;
    const markStorageHealthError=input.hooks.onError;
    const markStorageHealthOk=input.hooks.onOk;
    const AppDiagnostics=freeze({capture:input.hooks.capture});
    const onReset=typeof input.hooks.onReset==='function'?input.hooks.onReset:null;
    let appDbConnection:IDBDatabase|null=null;
    let appDbOpenPromise:Promise<IDBDatabase>|null=null;
    // The key each current store is read by (null: the key is given apart from the record).
    const STORE_KEY_PATHS=new Map([[DB_DAILY_RECORD_STORE,'date'],[DB_DAILY_SUMMARY_STORE,'date'],[DB_NOTES_STORE,'key'],[DB_ACTIVE_SESSION_STORE,'id'],[DB_APP_META_STORE,'key'],[DB_ASSET_STORE,null]]);
    let newerDatabase:ReturnType<typeof inspectNewerDatabase>|null=null;
    const freshlyCreatedDatabases=new WeakSet<IDBDatabase>();
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
    function clearAppDBConnection(db:IDBDatabase|null=null){
      if(db&&appDbConnection!==db)return false;
      appDbConnection=null;
      return true;
    }
    function ensureCurrentStores(db:IDBDatabase){
      if(!db.objectStoreNames.contains(DB_DAILY_RECORD_STORE))db.createObjectStore(DB_DAILY_RECORD_STORE,{keyPath:'date'});
      if(!db.objectStoreNames.contains(DB_DAILY_SUMMARY_STORE))db.createObjectStore(DB_DAILY_SUMMARY_STORE,{keyPath:'date'});
      if(!db.objectStoreNames.contains(DB_NOTES_STORE))db.createObjectStore(DB_NOTES_STORE,{keyPath:'key'});
      if(!db.objectStoreNames.contains(DB_ACTIVE_SESSION_STORE))db.createObjectStore(DB_ACTIVE_SESSION_STORE,{keyPath:'id'});
      if(!db.objectStoreNames.contains(DB_APP_META_STORE))db.createObjectStore(DB_APP_META_STORE,{keyPath:'key'});
      if(!db.objectStoreNames.contains(DB_ASSET_STORE))db.createObjectStore(DB_ASSET_STORE);
    }
    function attachConnection(db:IDBDatabase){
      appDbConnection=db;establishedConnection=true;
      db.onversionchange=()=>{
        if(appDbConnection===db)clearAppDBConnection(db);
        try{db.close();}catch(error){AppDiagnostics.capture('storage.db-versionchange-close',error);}
      };
      if('onclose' in db)db.onclose=()=>clearAppDBConnection(db);
      markStorageHealthOk();
      return db;
    }
    // A slow open gets one fresh attempt before the app stops: a busy phone can
    // take longer than the time limit. The first request, if it finishes late,
    // is closed without upgrading. An open blocked by another tab fails at once.
    function openRequest(version:number|null=null){
      return openAttempt(version,false).catch(error=>{
        if(errorField(error,'code')!=='IDB_OPEN_TIMEOUT')throw error;
        return openAttempt(version,true);
      });
    }
    function openAttempt(version:number|null,last:boolean){
      return new Promise<IDBDatabase>((resolve,reject)=>{
        if(typeof globalThis.indexedDB?.open!=='function'){markStorageHealthError('IndexedDB unavailable');reject(new Error('IndexedDB unavailable'));return;}
        let settled=false,blocked=false;
        const finish=<T>(fn:(value:T)=>void,val:T)=>{if(settled)return;settled=true;clearTimeout(timer);fn(val);};
        const timer=setTimeout(()=>{
          const error=Object.assign(new Error(blocked?'IndexedDB open blocked':'IndexedDB open timed out'),{code:blocked?'IDB_OPEN_BLOCKED':'IDB_OPEN_TIMEOUT'});
          if(blocked||last)markStorageHealthError(errorField(error,'message'));finish(reject,error);
        },2500);
        let req;
        try{req=version===null?globalThis.indexedDB.open(DB_NAME):globalThis.indexedDB.open(DB_NAME,version);}catch(error){markStorageHealthError(error&&errorField(error,'message')?errorField(error,'message'):'IndexedDB open failed');finish(reject,error);return;}
        req.onupgradeneeded=e=>{
          const opened=e.target as IDBOpenDBRequest;
          // An open that was given up on never upgrades in the background.
          if(settled){try{opened.transaction&&opened.transaction.abort();}catch(abortError){}return;}
          try{
            const db=opened.result;
            if(Number(e.oldVersion||0)===0)freshlyCreatedDatabases.add(db);
            if(Number(e.oldVersion||0)!==0)throw Object.assign(new Error('Only the current canonical database topology is supported. No data was converted or deleted.'),{code:'STUDY_DIRECTOR_UNSUPPORTED_TOPOLOGY'});
            ensureCurrentStores(db);
          }catch(error){
            try{opened.transaction&&opened.transaction.abort();}catch(abortError){}
            markStorageHealthError((error&&errorField(error,'message'))||'IndexedDB upgrade failed');
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
      let db;
      try{db=await openRequest(DB_VER);}
      catch(error){if(errorField(error,'name')!=='VersionError')throw error;db=await openRequest();}
      let state;try{state=inspectNewerDatabase(db);}catch(error){try{db.close();}catch{}throw error;}
      if(Number(db.version)<DB_VER||Number(db.version)===DB_VER&&(!state.usable||db.objectStoreNames.length!==STORE_KEY_PATHS.size)){
        db.close();throw Object.assign(new Error('This database is not in the supported canonical topology. No data was converted or deleted.'),{code:'STUDY_DIRECTOR_UNSUPPORTED_TOPOLOGY'});
      }
      newerDatabase=Number(db.version)>DB_VER?state:null;
      if(freshlyCreatedDatabases.has(db)){if(establishedConnection)noteRecreatedDatabase();else startedFresh=true;}
      return db;
    }
    function inspectNewerDatabase(db:IDBDatabase){
      const missing=[],changed=[];
      for(const [name,keyPath] of STORE_KEY_PATHS){
        if(!db.objectStoreNames.contains(name)){missing.push(name);continue;}
        // A store whose transaction cannot start is a storage failure, reported
        // as one; only a different key path makes the topology unsupported.
        let actual;
        try{actual=db.transaction(name,'readonly').objectStore(name).keyPath;}
        catch(error){markStorageHealthError((error&&errorField(error,'message'))||'IndexedDB transaction failed');throw error;}
        if((actual??null)!==keyPath)changed.push(name);
      }
      return freeze({version:Number(db.version),missing:freeze(missing),changed:freeze(changed),usable:missing.length===0&&changed.length===0});
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
      const stores=[...db.objectStoreNames],newer=Number(db.version)>DB_VER?(newerDatabase||inspectNewerDatabase(db)):null;
      return freeze({version:Number(db.version),stores:freeze(stores),current:Number(db.version)===DB_VER,newer:!!newer,usable:newer?newer.usable:true,missing:newer?newer.missing:freeze([]),changed:newer?newer.changed:freeze([])});
    }
    async function hasStore(name:string){const db=await openAppDB();return db.objectStoreNames.contains(String(name));}
    async function getAllIfPresent(storeName:string,abortMessage='read aborted'){
      if(!(await hasStore(storeName)))return [];
      return idbGetAll(storeName,abortMessage);
    }
    let strictDurabilitySupport=0;
    function createIdbTransaction(db:IDBDatabase,stores:string|string[],mode:IDBTransactionMode,strict=false){
      if(!strict)return db.transaction(stores,mode) as DbTransaction;
      if(mode!=='readwrite')throw new TypeError('Strict IndexedDB durability is reserved for readwrite transactions.');
      if(strictDurabilitySupport<0)return db.transaction(stores,mode) as DbTransaction;
      try{
        const tx=db.transaction(stores,mode,{durability:'strict'}) as DbTransaction;
        if(String(tx&&tx.durability||'')==='strict')strictDurabilitySupport=1;
        else if(strictDurabilitySupport===0){
          strictDurabilitySupport=-1;
          AppDiagnostics.capture('storage.idb-strict-durability-unavailable',new Error('This browser did not confirm strict IndexedDB durability; default durability is being used.'),'warn');
        }
        return tx;
      }catch(error){
        if(error&&errorField(error,'name')==='TypeError'){
          strictDurabilitySupport=-1;
          AppDiagnostics.capture('storage.idb-strict-durability-unavailable',error,'warn');
          return db.transaction(stores,mode) as DbTransaction;
        }
        throw error;
      }
    }
    // Data this build cannot read: records a newer Study Director wrote, or
    // ones in a shape this build does not know. They stay exactly as they are.
    // Reads do not see them; a write or delete of one is refused, and a clear
    // or a range delete leaves them in place. The list is empty for almost
    // every start, and then every transaction is the plain browser one.
    const unsupported=new Map<string,Map<string,Readonly<{key:DbKey;reason:string;replaceable:boolean}>>>();
    const keyId=(key:unknown)=>`${typeof key}:${typeof key==='string'?key:JSON.stringify(key)}`;
    // replaceable: the record is this build's own bookkeeping (a lease,
    // maintenance progress, a cache), which the data contract lets any build
    // replace; writing it takes it back. Everything else is never changed.
    function hold(storeName:string,key:DbKey,reason='unsupported',{replaceable=false}={}){
      const name=String(storeName||'');if(!STORE_KEY_PATHS.has(name)||key===undefined||key===null)return false;
      if(!unsupported.has(name))unsupported.set(name,new Map());
      const rows=unsupported.get(name)!,id=keyId(key);if(rows.has(id))return false;
      rows.set(id,freeze({key,reason:String(reason||'unsupported'),replaceable:replaceable===true}));return true;
    }
    const heldRow=(storeName:string,key:unknown)=>unsupported.get(storeName)?.get(keyId(key))||null;
    const isHeld=(storeName:string,key:unknown)=>!!unsupported.get(storeName)?.has(keyId(key));
    const heldIn=(storeName:string)=>(unsupported.get(storeName)?.size||0)>0;
    function unsupportedSummary(){
      const stores:Record<string,number>={},reasons:Record<string,number>={};let total=0,protectedTotal=0;
      for(const [name,rows] of unsupported){if(!rows.size)continue;stores[name]=rows.size;total+=rows.size;for(const row of rows.values()){reasons[row.reason]=(reasons[row.reason]||0)+1;if(!row.replaceable)protectedTotal++;}}
      return freeze({total,protected:protectedTotal,stores:freeze(stores),reasons:freeze(reasons)});
    }
    const unsupportedKeys=(storeName:string)=>freeze([...(unsupported.get(String(storeName||''))?.values()||[])].map(row=>row.key));
    function unsupportedDataError(storeName:string){
      return Object.assign(new Error('This was saved by a newer version of Study Director, so this version keeps it as it is and does not change it. Update the app to change it.'),{name:'UnsupportedDataError',code:'STUDY_DIRECTOR_UNSUPPORTED_DATA',store:String(storeName||'')});
    }
    const isRange=(value:unknown):value is IDBKeyRange=>typeof globalThis.IDBKeyRange==='function'&&value instanceof globalThis.IDBKeyRange;
    const passThrough=(target:object,prop:PropertyKey):unknown=>{const value:unknown=Reflect.get(target,prop,target);return typeof value==='function'?value.bind(target) as unknown:value;};
    const eventFor=(event:Event,view:object)=>new Proxy(event,{get:(target,prop)=>prop==='target'||prop==='currentTarget'?view:passThrough(target,prop)});
    // A request answered by this guard. It always answers later, inside the
    // same transaction, like a browser request.
    type SyntheticEvent={type:string;target:SyntheticRequest;currentTarget:SyntheticRequest;preventDefault():void;stopPropagation():void};
    type SyntheticListener=(this:SyntheticRequest,event:SyntheticEvent)=>void;
    type SyntheticRequest={result:unknown;error:DOMException|null;readyState:'pending'|'done';source:DbStore;transaction:DbTransaction;onsuccess:SyntheticListener|null;onerror:SyntheticListener|null;addEventListener(type:string,listener:unknown):void;removeEventListener(type:string,listener:unknown):void};
    function answeredRequest(source:DbStore,transaction:DbTransaction){
      const listeners:Record<string,Set<SyntheticListener>>={success:new Set(),error:new Set()};
      const request:SyntheticRequest={result:undefined,error:null,readyState:'pending',source,transaction,onsuccess:null,onerror:null,
        addEventListener:(type,listener)=>{if(listeners[type]&&typeof listener==='function')listeners[type].add(listener as SyntheticListener);},
        removeEventListener:(type,listener)=>{listeners[type]?.delete(listener as SyntheticListener);}};
      const fire=(type:'success'|'error')=>{request.readyState='done';const event={type,target:request,currentTarget:request,preventDefault(){},stopPropagation(){}};const handler=type==='success'?request.onsuccess:request.onerror;if(typeof handler==='function')handler.call(request,event);for(const listener of listeners[type]!)listener.call(request,event);};
      return freeze({request,succeed:(value:unknown)=>{request.result=value;fire('success');},fail:(error:DOMException|null)=>{request.error=error;fire('error');}});
    }
    // A browser request whose success reaches the caller only for records it may see.
    function viewedRequest<T>(real:IDBRequest<T>,{result=value=>value,skip=()=>false}:{result?:(value:T)=>unknown;skip?:(request:IDBRequest<T>)=>boolean}={}){
      let onsuccess:unknown=null;const listeners=new Map<EventListener,EventListener>();
      const view=new Proxy(real,{
        get(target,prop){
          if(prop==='result')return result(target.result);
          if(prop==='onsuccess')return onsuccess;
          if(prop==='addEventListener')return (type:string,listener:EventListenerOrEventListenerObject,options?:boolean|AddEventListenerOptions)=>{if(type!=='success'||typeof listener!=='function')return target.addEventListener(type,listener,options);const wrapped:EventListener=event=>{if(!skip(target))listener.call(view,eventFor(event,view));};listeners.set(listener,wrapped);target.addEventListener(type,wrapped,options);};
          if(prop==='removeEventListener')return (type:string,listener:EventListenerOrEventListenerObject,options?:boolean|EventListenerOptions)=>target.removeEventListener(type,type==='success'&&typeof listener==='function'&&listeners.get(listener)||listener,options);
          return passThrough(target,prop);
        },
        set(target,prop,value:unknown){
          if(prop==='onsuccess'){onsuccess=value;target.onsuccess=typeof value==='function'?event=>{if(!skip(target))(value as EventListener).call(view,eventFor(event,view));}:null;return true;}
          return Reflect.set(target,prop,value,target);
        }
      });
      return view;
    }
    function guardStore(store:DbStore,{transaction,view:transactionView}:{transaction:DbTransaction;view:DbTransaction},state:{error:unknown}){
      const name=store.name,keyPath=store.keyPath;
      const keyOf=(value:unknown,key:DbKey|undefined):unknown=>{
        if(key!==undefined||typeof keyPath!=='string')return key;
        let current=value;for(const part of keyPath.split('.'))current=current&&typeof current==='object'?(current as Record<string,unknown>)[part]:undefined;return current;
      };
      const refuse=()=>{const error=unsupportedDataError(name);state.error=error;try{transaction.abort();}catch{}throw error;};
      // A write or delete of a held record: bookkeeping is taken back (and
      // held again if the transaction does not commit); anything else is refused.
      const claim=(key:unknown)=>{
        const row=heldRow(name,key);if(!row)return;
        if(!row.replaceable)refuse();
        unsupported.get(name)!.delete(keyId(key));
        transaction.addEventListener('abort',()=>{if(!heldRow(name,key))hold(name,row.key,row.reason,{replaceable:true});});
      };
      const heldInRange=(range:IDBKeyRange)=>[...(unsupported.get(name)?.values()||[])].some(row=>{try{return range.includes(row.key);}catch{return false;}});
      // Walks the store with a cursor, past the records this build keeps.
      function walk<T>(query:DbQuery|null|undefined,{keys=false,limit=Infinity,visit,done}:{keys?:boolean;limit?:number;visit:(cursor:IDBCursor&{value?:unknown})=>void;done:()=>T}){
        const answer=answeredRequest(view,transactionView),cursorRequest=keys&&typeof store.openKeyCursor==='function'?store.openKeyCursor(query??null):store.openCursor(query??null);
        let seen=0;
        cursorRequest.onerror=()=>answer.fail(cursorRequest.error);
        cursorRequest.onsuccess=()=>{
          const cursor=cursorRequest.result;
          if(!cursor){answer.succeed(done());return;}
          if(!isHeld(name,cursor.primaryKey)){visit(cursor);if(++seen>=limit){answer.succeed(done());return;}}
          cursor.continue();
        };
        return answer.request;
      }
      const methods={
        get:(query:DbQuery)=>{
          if(isRange(query)){let found:unknown;return walk(query,{limit:1,visit:cursor=>{found=cursor.value;},done:()=>found});}
          return isHeld(name,query)?viewedRequest(store.count(query),{result:()=>undefined}):store.get(query);
        },
        getKey:(query:DbQuery)=>{
          if(isRange(query)){let found:unknown;return walk(query,{keys:true,limit:1,visit:cursor=>{found=cursor.primaryKey;},done:()=>found});}
          return isHeld(name,query)?viewedRequest(store.count(query),{result:()=>undefined}):store.getKey(query);
        },
        getAll:(query?:DbQuery|null,count?:number)=>{const out:unknown[]=[];return walk(query,{limit:Number(count)>0?Number(count):Infinity,visit:cursor=>out.push(cursor.value),done:()=>out});},
        getAllKeys:(query?:DbQuery|null,count?:number)=>{const out:DbKey[]=[];return walk(query,{keys:true,limit:Number(count)>0?Number(count):Infinity,visit:cursor=>out.push(cursor.primaryKey),done:()=>out});},
        count:(query?:DbQuery|null)=>{let total=0;return walk(query,{keys:true,visit:()=>{total++;},done:()=>total});},
        openCursor:(query?:DbQuery|null,direction?:IDBCursorDirection)=>viewedRequest(store.openCursor(query??null,direction),{skip:target=>{const cursor=target.result;if(cursor&&isHeld(name,cursor.primaryKey)){cursor.continue();return true;}return false;}}),
        openKeyCursor:(query?:DbQuery|null,direction?:IDBCursorDirection)=>viewedRequest(store.openKeyCursor(query??null,direction),{skip:target=>{const cursor=target.result;if(cursor&&isHeld(name,cursor.primaryKey)){cursor.continue();return true;}return false;}}),
        put:(value:unknown,key?:DbKey)=>{claim(keyOf(value,key));return key===undefined?store.put(value):store.put(value,key);},
        add:(value:unknown,key?:DbKey)=>{claim(keyOf(value,key));return key===undefined?store.add(value):store.add(value,key);},
        delete:(query:DbQuery)=>{
          if(!isRange(query)){claim(query);return store.delete(query);}
          if(!heldInRange(query))return store.delete(query);
          return walk(query,{visit:cursor=>{cursor.delete();},done:()=>undefined});
        },
        clear:()=>walk(null,{visit:cursor=>{cursor.delete();},done:()=>undefined}),
        index:()=>{throw unsupportedDataError(name);}
      };
      const view=new Proxy(store,{get:(target,prop)=>Object.hasOwn(methods,prop)?methods[prop as keyof typeof methods]:prop==='transaction'?transactionView:passThrough(target,prop),set:(target,prop,value)=>Reflect.set(target,prop,value,target)});
      return view;
    }
    function guardTransaction(tx:DbTransaction,state:{error:unknown}){
      const guarded=new Map<string,DbStore>();
      const view=new Proxy(tx,{
        get(target,prop){
          if(prop==='objectStore')return (storeName:string)=>{const store=target.objectStore(storeName);if(!heldIn(store.name))return store;if(!guarded.has(store.name))guarded.set(store.name,guardStore(store,{transaction:target,view},state));return guarded.get(store.name);};
          return passThrough(target,prop);
        },
        set:(target,prop,value)=>Reflect.set(target,prop,value,target)
      });
      return view;
    }
    const touchesHeld=(stores:string|string[])=>(Array.isArray(stores)?stores:[stores]).some(name=>heldIn(String(name)));
    async function runIdbTransaction<T>(stores:string|string[],mode:IDBTransactionMode,fn:TransactionOperation<T>,abortMessage='transaction aborted',strict=false,retry=0,raw=false):Promise<T>{
      const db=await openAppDB();
      return new Promise<T>((resolve,reject)=>{
        let tx;
        try{tx=createIdbTransaction(db,stores,mode,strict);}
        catch(error){
          if(appDbConnection===db){clearAppDBConnection(db);try{db.close();}catch(closeError){}}
          if(retry<1){runIdbTransaction(stores,mode,fn,abortMessage,strict,retry+1,raw).then(resolve,reject);return;}
          markStorageHealthError((error&&errorField(error,'message'))||abortMessage);reject(error);return;
        }
        let settled=false;
        const finish=(...[ok,val]:FinishArgs<T>)=>{
          if(settled)return;settled=true;
          if(ok){markStorageHealthOk();resolve(val);}
          else{markStorageHealthError((val&&errorField(val,'message'))||abortMessage);reject(val);}
        };
        const state:{error:unknown}={error:null},view=!raw&&touchesHeld(stores)?guardTransaction(tx,state):tx;
        tx.onerror=()=>finish(false,state.error||tx.error||new Error(abortMessage));
        tx.onabort=()=>finish(false,state.error||tx.error||new Error(abortMessage));
        try{fn(view,finish);}catch(error){try{tx.abort();}catch{}finish(false,error);}
      });
    }
    function idbTransaction<T>(stores:string|string[],mode:IDBTransactionMode,fn:TransactionOperation<T>,abortMessage='transaction aborted'){return runIdbTransaction(stores,mode,fn,abortMessage,false);}
    function idbStrictTransaction<T>(stores:string|string[],mode:IDBTransactionMode,fn:TransactionOperation<T>,abortMessage='transaction aborted'){return runIdbTransaction(stores,mode,fn,abortMessage,true);}
    function idbStoreTransaction<T>(storeName:string,mode:IDBTransactionMode,fn:StoreOperation<T>,abortMessage='transaction aborted'){return idbTransaction<T>(storeName,mode,(tx,finish)=>fn(tx.objectStore(storeName),tx,finish),abortMessage);}
    function idbStrictStoreTransaction<T>(storeName:string,mode:IDBTransactionMode,fn:StoreOperation<T>,abortMessage='transaction aborted'){return idbStrictTransaction<T>(storeName,mode,(tx,finish)=>fn(tx.objectStore(storeName),tx,finish),abortMessage);}
    // Reads every record of a store as stored (unsupported ones included) and
    // holds each one classify names a reason for (a string, or {reason,replaceable}). A store this build
    // knows but the database lacks reads as empty.
    async function scanUnsupported(storeName:string,classify:(value:unknown,key:DbKey)=>StoredClassification,abortMessage='unsupported data scan aborted'){
      if(!(await hasStore(storeName)))return 0;
      return runIdbTransaction<number>(storeName,'readonly',(tx,finish)=>{
        const request=tx.objectStore(storeName).openCursor();let found=0;
        request.onerror=()=>finish(false,request.error||new Error(abortMessage));
        request.onsuccess=()=>{
          const cursor=request.result;if(!cursor){finish(true,found);return;}
          let verdict:StoredClassification='';try{verdict=classify(cursor.value,cursor.primaryKey);}catch(error){verdict='unreadable';}
          const reason=typeof verdict==='string'?verdict:String(verdict&&verdict.reason||'');
          if(reason&&hold(storeName,cursor.primaryKey,reason,{replaceable:!!verdict&&typeof verdict==='object'&&verdict.replaceable===true}))found++;
          cursor.continue();
        };
      },abortMessage,false,0,true);
    }
    function idbGet(storeName:string,key:DbQuery,abortMessage='read aborted'){
      return idbStoreTransaction(storeName,'readonly',(store,tx,finish)=>{const req=store.get(key);req.onsuccess=()=>finish(true,req.result||null);req.onerror=()=>finish(false,req.error||new Error(abortMessage));},abortMessage);
    }
    function idbGetAll(storeName:string,abortMessage='read aborted'){
      return idbStoreTransaction<unknown[]>(storeName,'readonly',(store,tx,finish)=>{const req=store.getAll();req.onsuccess=()=>finish(true,req.result||[]);req.onerror=()=>finish(false,req.error||new Error(abortMessage));},abortMessage);
    }
    return freeze({
      format:'study-director.indexeddb-primitives',contractVersion:2,
      isAvailable:()=>typeof globalThis.indexedDB?.open==='function',clearConnection:clearAppDBConnection,open:openAppDB,
      transaction:idbTransaction,strictTransaction:idbStrictTransaction,storeTransaction:idbStoreTransaction,strictStoreTransaction:idbStrictStoreTransaction,
      get:idbGet,getAll:idbGetAll,getAllIfPresent,hasStore,topology,
      unsupported:freeze({scan:scanUnsupported,hold,has:(storeName:string,key:DbKey)=>isHeld(String(storeName||''),key),keys:unsupportedKeys,summary:unsupportedSummary}),
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
