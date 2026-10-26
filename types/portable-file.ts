import type {WorkerProgress} from '../portable/worker-contracts.ts';
export type Bytes=Uint8Array<ArrayBuffer>;
export type Progress=(value:WorkerProgress)=>void;
export interface ByteWriter{write(bytes:Bytes):Promise<void>;close():Promise<void>;abort():Promise<void>}
export interface SyncFilePort{write(bytes:Bytes,options:{at:number}):number;truncate(size:number):void;flush():void;close():void}
export interface AsyncFilePort{write(bytes:Bytes):Promise<void>;truncate(size:number):Promise<void>;seek(position:number):Promise<void>;close():Promise<void>;abort():Promise<void>}
export interface FilePort{getFile():Promise<Blob>;createSyncAccessHandle?:()=>Promise<SyncFilePort>;createWritable?:(options:{keepExistingData:boolean})=>Promise<AsyncFilePort>}
export type OutputTarget=FilePort|{kind:'opfs';name:string;directory:string};
export type FileOutput=ByteWriter&{file():Promise<Blob>;readonly size:number};
