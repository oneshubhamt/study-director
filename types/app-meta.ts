import type {DbTransaction,IndexedDb,Finish} from './persistence.ts';
export interface MetaDefinition{name:string;kind:'exact'|'prefix';key:string;owner:string;validatorOwner:string;schema:string;protection:string}
export interface MetaContext{family:string;key:string;suffix:string;schema:string;owner:string;validatorOwner:string}
export type MetaValidator=(value:unknown,context:Readonly<MetaContext>)=>boolean;
export type MetaEntry=Readonly<{family:string;key:string;suffix:string;value:unknown;updatedAt:string}>;
export type MetaWriteOptions={suffix?:string;updatedAt?:string;strict?:boolean;abortMessage?:string};
export interface MetaView{
 get(name:string,suffix?:string):Readonly<{request:IDBRequest<unknown>;entry():MetaEntry|null;value():unknown}>;
 getAll(name:string):Readonly<{request:IDBRequest<unknown[]>;entries():readonly (MetaEntry|null)[]}>;
 put(name:string,value:unknown,options?:MetaWriteOptions):IDBRequest<IDBValidKey>;
 remove(name:string,suffix?:string):IDBRequest<undefined>;
}
export type MetaOperation<T>=(view:Readonly<MetaView>,transaction:DbTransaction,finish:Finish<T>)=>void;
export interface MetaOwner{
 readonly format:'study-director.app-meta-owner';readonly contractVersion:1;readonly owner:string;
 read(name:string,suffix?:string):Promise<unknown>;readEntry(name:string,suffix?:string):Promise<MetaEntry|null>;
 write<T>(name:string,value:T,options?:MetaWriteOptions):Promise<Readonly<{family:string;value:T;updatedAt:string}>>;
 remove(name:string,suffix?:string,options?:MetaWriteOptions):Promise<boolean>;list(name:string):Promise<readonly (MetaEntry|null)[]>;
 transaction<T>(mode:IDBTransactionMode,operation:MetaOperation<T>,options?:MetaWriteOptions):Promise<T>;
 view(transaction:DbTransaction):Readonly<MetaView>;
}
export interface MetaGateway{
 readonly format:'study-director.app-meta-gateway';readonly contractVersion:1;
 registerValidators(owner:string,validators:Readonly<Record<string,MetaValidator>>):boolean;bind(owner:string):Readonly<MetaOwner>;
 resolve(key:unknown):Readonly<MetaContext&{kind:'exact'|'prefix';protection:string}>|null;
 readable(row:unknown):boolean;verifyAll():Promise<Readonly<{ok:boolean;rows:number;issues:readonly string[]}>>;
}
export interface AppMetaModule{readonly format:'study-director.app-meta';readonly contractVersion:1;create(input:{indexedDb:Pick<IndexedDb,'transaction'|'strictTransaction'|'get'|'getAll'>;store:string;registry:Readonly<Record<string,MetaDefinition>>}):Readonly<MetaGateway>}
