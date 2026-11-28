// The five in-memory stores used by the repository VM. Requests within one
// transaction run in submission order. Browser tests own cross-connection scheduling.
type StoreName='area'|'daily'|'summary'|'session'|'meta';
type Stores=Record<StoreName,Map<string,unknown>>;
type Names=StoreName|StoreName[];
type Mode='readonly'|'readwrite';
type Range={lower:string;upper:string};
type Finish=(ok?:boolean,value?:unknown)=>void;
type KeyFault=Pick<ReadonlySet<string>,'has'>|null;
type ReadEvent={store:StoreName;key:string;mode:Mode};
export type StorageControls={
  failLocal?:boolean;failLocalRemove?:boolean;failLocalGetKeys?:KeyFault;failLocalSetKeys?:KeyFault;failLocalRemoveKeys?:KeyFault;
  failSessionWrite?:boolean;failNextAreaWrite?:boolean;failNextDailyWrite?:boolean;failNextMetaOnlyWrite?:boolean;
  failNextMetaWrite?:boolean;failNextMaintenanceCompletion?:boolean;failNextMetaRequest?:{operation:string;key:string};
  storageResets?:number;dailyKeyEnumeration?:boolean;
  onTransactionComplete?:(event:{stores:Names;mode:Mode})=>void;onTransactionRead?:(event:ReadEvent)=>void;
  onStorageRead?:((event:{store:StoreName;kind:'get'|'list';key?:string})=>unknown)|null;onAreaRead?:(()=>unknown)|null;onSessionRead?:(()=>unknown)|null;
};
type Request={result:unknown;error:Error|null;onsuccess:((event:{target:Request})=>void)|null;onerror:(()=>void)|null};
type Store={
 get(key:string):Request;add(value:unknown,key?:string):Request;put(value:unknown,key?:string):Request;
 count():Request;getAll(range?:Range|null):Request;getAllKeys:((range?:Range|null,count?:number)=>Request)|undefined;
 openCursor():Request;delete(key:string|Range):Request;clear():Request;
};
type Transaction={oncomplete:(()=>void)|null;onabort:(()=>void)|null;onerror:(()=>void)|null;abort():void;objectStore(name:StoreName):Store};
type Operation=(tx:Transaction,finish:Finish)=>void;
type StoreOperation=(store:Store,tx:Transaction,finish:Finish)=>void;
function field(value:unknown,key:string):unknown{return value&&typeof value==='object'?Object.getOwnPropertyDescriptor(value,key)?.value as unknown:undefined;}
function keyOf(value:unknown,key?:string){const id=key??field(value,'key')??field(value,'date')??field(value,'id');if(typeof id!=='string')throw new Error('Missing fixture record key');return id;}
const newRequest=():Request=>({result:undefined,error:null,onsuccess:null,onerror:null});
const inRange=(key:string,range?:Range|null)=>!range||(key>=range.lower&&key<=range.upper);
export function repositoryStorage(sharedLocal:Map<string,unknown>,sharedStores:Stores|null,controls:StorageControls){
 const stores:Stores=sharedStores??{area:new Map(),daily:new Map(),summary:new Map(),session:new Map(),meta:new Map()};
 const localWrites={pending:0,all:0,sessionBytes:0},idbWrites={recovery:0},idbReads={metaGetAll:0,boundedMetaGetAll:0,unboundedMetaGetAll:0};
 const idbDurability={strict:0,normal:0,strictStores:[] as StoreName[][],normalStores:[] as StoreName[][]};
 const localStorage={
  getItem(key:string){if(controls.failLocalGetKeys?.has(key))throw new Error('QA_FIXTURE local recovery read failure');return sharedLocal.has(key)?JSON.stringify(sharedLocal.get(key)):null;},
  setItem(key:string,text:string){if(controls.failLocal||controls.failLocalSetKeys?.has(key))throw new Error('QA_FIXTURE local recovery write failure');if(key==='recovery')localWrites.sessionBytes+=Buffer.byteLength(text);localWrites.all++;if(key==='pending')localWrites.pending++;sharedLocal.set(key,JSON.parse(text) as unknown);},
  removeItem(key:string){if(controls.failLocalRemove||controls.failLocalRemoveKeys?.has(key))throw new Error('QA_FIXTURE local recovery removal failure');sharedLocal.delete(key);}
 };
 function run(names:Names,mode:Mode,operation:Operation,durability:'normal'|'strict'){
  return new Promise<unknown>((resolve,reject)=>{
   const scope=Array.isArray(names)?names:[names];
   idbDurability[durability]++;idbDurability[durability==='strict'?'strictStores':'normalStores'].push([...scope]);
   if(controls.failSessionWrite&&scope.includes('session'))throw new Error('Injected session write failure');
   if(mode==='readwrite'){
    if(scope.includes('area')&&controls.failNextAreaWrite){controls.failNextAreaWrite=false;throw new Error('QA_FIXTURE injected note write failure');}
    if(scope.includes('daily')&&controls.failNextDailyWrite){controls.failNextDailyWrite=false;throw new Error('QA_FIXTURE injected daily-record write failure');}
    if(names==='meta'&&controls.failNextMetaOnlyWrite){controls.failNextMetaOnlyWrite=false;throw new Error('QA_FIXTURE injected appMeta-only write failure');}
    if(scope.includes('meta')&&controls.failNextMetaWrite){controls.failNextMetaWrite=false;throw new Error('QA_FIXTURE injected appMeta write failure');}
   }
   let pending=0,active=true;
   const undo=new Map<Map<string,unknown>,Map<string,{present:boolean;value:unknown}>>();
   function remember(map:Map<string,unknown>,key:string){
    let rows=undo.get(map);if(!rows){rows=new Map();undo.set(map,rows);}
    // Bypass test Map subclasses that inject a successor on the next observed read.
    if(!rows.has(key))rows.set(key,{present:Map.prototype.has.call(map,key),value:Map.prototype.get.call(map,key) as unknown});
   }
   function abort(error:unknown){
    if(!active)return;
    active=false;
    for(const [map,rows] of undo)for(const [key,before] of rows){if(before.present)map.set(key,before.value);else map.delete(key);}
    undo.clear();queueMicrotask(()=>{try{tx.onabort?.();}finally{reject(error);}});
   }
   const finish:Finish=(ok=true,value=true)=>{if(ok)resolve(value);else reject(value instanceof Error?value:new Error(String(value||'transaction failed')));};
   const complete=()=>queueMicrotask(()=>{if(active&&!pending){active=false;undo.clear();controls.onTransactionComplete?.({stores:names,mode});tx.oncomplete?.();}});
   function enqueue(action:()=>unknown,req=newRequest()){
    if(!active)throw new Error('QA_FIXTURE transaction inactive');
    pending++;
    queueMicrotask(()=>{
     try{if(active){req.result=action();req.onsuccess?.({target:req});}}
     catch(error){req.error=error instanceof Error?error:new Error(String(error));try{req.onerror?.();}finally{abort(req.error);}}
     finally{pending--;complete();}
    });
    return req;
   }
   function objectStore(name:StoreName):Store{
    const map=stores[name];
    if(!map||!scope.includes(name))throw new Error('Unknown transaction store: '+name);
    function checkFault(operation:string,key:string){
     const fault=controls.failNextMetaRequest;
     if(name==='meta'&&fault?.operation===operation&&fault.key===key){delete controls.failNextMetaRequest;throw new Error('QA_FIXTURE injected appMeta request failure');}
    }
    function write(value:unknown,key:string|undefined,add:boolean){
     const copy=structuredClone(value),resolved=keyOf(copy,key??(name==='session'&&typeof field(copy,'id')==='string'?String(field(copy,'id')):undefined));
     return enqueue(()=>{
      checkFault('put',resolved);
      const payload=field(copy,'value');
      if(name==='meta'&&resolved==='dataMaintenance'&&field(payload,'status')==='completed'&&controls.failNextMaintenanceCompletion){controls.failNextMaintenanceCompletion=false;throw new Error('QA_FIXTURE maintenance completion write failure');}
      if(add&&map.has(resolved))throw new Error('QA_FIXTURE ConstraintError: key already exists');
      if(name==='meta'&&field(payload,'format')==='study-director.area-note-recovery')idbWrites.recovery++;
      remember(map,resolved);map.set(resolved,copy);return resolved;
     });
    }
    const remove=(key:string)=>{remember(map,key);map.delete(key);};
    const store:Store={
     get(key){return enqueue(()=>{checkFault('get',key);const value=structuredClone(map.get(key));controls.onTransactionRead?.({store:name,key,mode});return value;});},
     add:(value,key)=>write(value,key,true),put:(value,key)=>write(value,key,false),count:()=>enqueue(()=>map.size),
     getAll(range){if(name==='meta'){idbReads.metaGetAll++;range?idbReads.boundedMetaGetAll++:idbReads.unboundedMetaGetAll++;}return enqueue(()=>{const rows=[...map].filter(([key])=>inRange(key,range)).map(([,value])=>structuredClone(value));controls.onTransactionRead?.({store:name,key:'*',mode});return rows;});},
     getAllKeys:name==='daily'&&!controls.dailyKeyEnumeration?undefined:(range,count=Infinity)=>enqueue(()=>[...map.keys()].filter(key=>inRange(key,range)).sort().slice(0,count)),
     openCursor(){
      const req=newRequest();
      let entries:IterableIterator<[string,unknown]>|undefined;
      const step=():unknown=>{entries??=map.entries();const next=entries.next();if(next.done)return null;const [key,value]=next.value;return {key,value:structuredClone(value),update:(next:unknown)=>write(next,key,false),delete:()=>store.delete(key),continue:()=>{enqueue(step,req);}};};
      return enqueue(step,req);
     },
     delete(key){return enqueue(()=>{if(typeof key==='string'){checkFault('delete',key);remove(key);}else for(const candidate of map.keys())if(inRange(candidate,key))remove(candidate);});},
     clear(){return enqueue(()=>{for(const key of map.keys())remove(key);});}
    };
    return store;
   }
   const tx:Transaction={oncomplete:null,onabort:null,onerror:null,abort(){if(!active)throw new Error('QA_FIXTURE transaction inactive');abort(new Error('QA_FIXTURE transaction aborted'));},objectStore};
   try{operation(tx,finish);complete();}catch(error){abort(error);}
  });
 }
 const indexedDb=Object.freeze({
  transaction:(names:Names,mode:Mode,operation:Operation)=>run(names,mode,operation,'normal'),
  strictTransaction:(names:Names,mode:Mode,operation:Operation)=>run(names,mode,operation,'strict'),
  storeTransaction:(name:StoreName,mode:Mode,op:StoreOperation)=>run(name,mode,(tx,finish)=>op(tx.objectStore(name),tx,finish),'normal'),
  strictStoreTransaction:(name:StoreName,mode:Mode,op:StoreOperation)=>run(name,mode,(tx,finish)=>op(tx.objectStore(name),tx,finish),'strict'),
  isAvailable:()=>true,lifecycle:()=>Object.freeze({startedFresh:false,resets:Number(controls.storageResets)||0,lastResetAt:''}),
  get:async(name:StoreName,key:string)=>{await controls.onStorageRead?.({store:name,kind:'get',key});const value=structuredClone(stores[name].get(key)??null);if(name==='session')await controls.onSessionRead?.();return value;},
  getAll:async(name:StoreName)=>{await controls.onStorageRead?.({store:name,kind:'list'});if(name==='area')await controls.onAreaRead?.();return [...stores[name].values()].map(v=>structuredClone(v));},
  getAllIfPresent:async(name:StoreName)=>[...stores[name].values()].map(v=>structuredClone(v)),
  hasStore:async(name:string)=>Object.hasOwn(stores,name),
  topology:async()=>Object.freeze({version:9,stores:Object.freeze(Object.keys(stores)),current:true,newer:false,usable:true})
 });
 return {indexedDb,localStorage,localWrites,idbReads,idbWrites,idbDurability,stores};
}
