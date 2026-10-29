export type DbKey=IDBValidKey;
export type DbQuery=DbKey|IDBKeyRange;
export type DbCursor=Omit<IDBCursorWithValue,'value'>&{readonly value:unknown};
export type DbStore=Omit<IDBObjectStore,'get'|'getAll'|'openCursor'|'transaction'>&{
 get(query:DbQuery):IDBRequest<unknown>;getAll(query?:DbQuery|null,count?:number):IDBRequest<unknown[]>;
 openCursor(query?:DbQuery|null,direction?:IDBCursorDirection):IDBRequest<DbCursor|null>;
 readonly transaction:DbTransaction;
};
export type DbTransaction=Omit<IDBTransaction,'objectStore'>&{objectStore(name:string):DbStore};
export type FinishArgs<T>=[ok:true,value:T]|[ok:false,error:unknown];
export type Finish<T>=(...args:FinishArgs<T>)=>void;
export type TransactionOperation<T>=(transaction:DbTransaction,finish:Finish<T>)=>void;
export type StoreOperation<T>=(store:DbStore,transaction:DbTransaction,finish:Finish<T>)=>void;
export type StoredClassification=string|{reason?:string;replaceable?:boolean}|null|false|undefined;
export interface Topology{version:number;stores:readonly string[];current:boolean;newer:boolean;usable:boolean;missing:readonly string[];changed:readonly string[]}
export type StoreNames={dailyRecords:string;dailySummaries:string;notes:string;activeSessions:string;appMeta:string;assets:string};
export type DbInput={config:{dbName:string;dbVersion:number;stores:StoreNames};hooks:{onError:(message:unknown)=>void;onOk:()=>void;capture:(name:string,error:unknown,severity?:'warn')=>void;onReset?:(event:Readonly<{detectedAt:string;count:number}>)=>void}};
export interface IndexedDb{
 readonly format:'study-director.indexeddb-primitives';readonly contractVersion:2;
 isAvailable():boolean;clearConnection(database?:IDBDatabase|null):boolean;open():Promise<IDBDatabase>;
 transaction<T>(stores:string|string[],mode:IDBTransactionMode,operation:TransactionOperation<T>,abortMessage?:string):Promise<T>;
 strictTransaction<T>(stores:string|string[],mode:IDBTransactionMode,operation:TransactionOperation<T>,abortMessage?:string):Promise<T>;
 storeTransaction<T>(store:string,mode:IDBTransactionMode,operation:StoreOperation<T>,abortMessage?:string):Promise<T>;
 strictStoreTransaction<T>(store:string,mode:IDBTransactionMode,operation:StoreOperation<T>,abortMessage?:string):Promise<T>;
 get(store:string,key:DbQuery,abortMessage?:string):Promise<unknown>;getAll(store:string,abortMessage?:string):Promise<unknown[]>;getAllIfPresent(store:string,abortMessage?:string):Promise<unknown[]>;hasStore(name:string):Promise<boolean>;topology():Promise<Readonly<Topology>>;
 readonly unsupported:{scan(store:string,classify:(value:unknown,key:DbKey)=>StoredClassification,abortMessage?:string):Promise<number>;hold(store:string,key:DbKey,reason?:string,options?:{replaceable?:boolean}):boolean;has(store:string,key:DbKey):boolean;keys(store:string):readonly DbKey[];summary():Readonly<{total:number;protected:number;stores:Readonly<Record<string,number>>;reasons:Readonly<Record<string,number>>}>};
 lifecycle():Readonly<{startedFresh:boolean;resets:number;lastResetAt:string}>;
}
export type LocalHooks={onError?:(operation:'read'|'write',error:unknown)=>void;onOk?:(operation:'read'|'write')=>void};
export interface LocalStoragePort{readonly lastError:unknown;getText(key:string,fallback?:string):string;getText(key:string,fallback:null):string|null;setText(key:string,value:unknown):boolean;getJson(key:string,fallback?:unknown):unknown;setJson(key:string,value:unknown):boolean;remove(key:string):boolean;keys():string[]}
export type DeviceType='iphone'|'ipad'|'android'|'windows'|'mac'|'chromeos'|'linux'|'device';
export type BrowserType='safari'|'chrome'|'edge'|'firefox'|'opera'|'samsung'|'browser';
export type DeviceDescription={type:DeviceType;browser:BrowserType};
export type NavigatorIdentity={userAgent?:string;platform?:string;maxTouchPoints?:number;userAgentData?:{platform?:string}};
export type IdentityInput={local:LocalStoragePort;keys:{installationId:string};describe:()=>Partial<DeviceDescription>|null|undefined};
export interface PersistenceModule{
 readonly format:'study-director.persistence-primitives';readonly contractVersion:1;
 createLocalStorage(input?:LocalHooks|null):Readonly<LocalStoragePort>;
 createInstallationIdentity(input:IdentityInput):Readonly<{format:'study-director.installation-identity';contractVersion:4;getId():string;keep():boolean}>;
 describeDevice(nav:NavigatorIdentity|null|undefined):Readonly<DeviceDescription>;deviceName(id:unknown,others?:Iterable<unknown>):string;randomIdPart(bytes?:number):string;
 normalizeTimestamp(value:unknown,fallback?:null):string|null;normalizeTimestamp(value:unknown,fallback:string):string;normalizeImportedTimestamp(value:unknown,fallback?:null,nowMs?:number):string|null;normalizeImportedTimestamp(value:unknown,fallback:string,nowMs?:number):string;normalizeImportedEpochMillis(value:unknown,fallback?:null,nowMs?:number):number|null;normalizeImportedEpochMillis(value:unknown,fallback:number,nowMs?:number):number;jsonByteLength(value:unknown):number;
 createIndexedDb(input:DbInput):Readonly<IndexedDb>;
}
