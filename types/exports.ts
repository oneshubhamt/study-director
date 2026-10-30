import type {ProcessingInputs,ProcessingOutputs} from './portable-processing.ts';
import type {IntegrityInputs,IntegrityOutputs} from '../portable/integrity-segments.ts';
import type {ProcessingOptions} from './backup-models.ts';
import type {WorkerProgress} from '../portable/worker-contracts.ts';
import type {LifecycleModule,Snapshot} from './lifecycle.ts';
import type {FilePort} from './portable-file.ts';
export type ExportsModuleInput={lifecycle:LifecycleModule};
export type FileReference={name:string;size:number;hash:string};
export type ExportInputs=Omit<ProcessingInputs,'file.copy'|'crypto.stream.encrypt'|'crypto.stream.decrypt'>&IntegrityInputs&{
 'file.copy':{file:Blob};'crypto.stream.encrypt':{file:Blob;key:CryptoKey};'crypto.stream.decrypt':{file:Blob;key:CryptoKey};
 'file.release':{file:Blob|string};'file.read':{ref:FileReference};'file.persist':{file:Blob};'file.collect':Record<string,never>;
};
export type CollectionResult={status:string;reason?:string;removed?:number;visited?:number;pending?:boolean};
export type ExportOutputs=ProcessingOutputs&IntegrityOutputs&{'file.release':void;'file.read':Blob;'file.persist':FileReference;'file.collect':CollectionResult|void};
export type ExportOperation=keyof ExportInputs;
export interface ExportOptions extends ProcessingOptions{onProgress?:((value:WorkerProgress)=>void)|null|undefined}
export type ExportArguments={[K in ExportOperation]:[type:K,data:ExportInputs[K],options?:ExportOptions|undefined]}[ExportOperation];
export interface ExportProcessing{
 run<K extends ExportOperation>(type:K,data:ExportInputs[NoInfer<K>],options?:ExportOptions):Promise<ExportOutputs[K]>;
 scope<T>(operation:()=>Promise<T>):Promise<T>;job<T>(operation:()=>Promise<T>,options?:{wait?:boolean;surface?:string}):Promise<T>;
 check():void;checkpoint?():()=>void;
}
export interface ScratchHandle{getFile():Promise<Blob>;createWritable(options:{keepExistingData:boolean}):Promise<{write(value:Blob|Uint8Array|ArrayBuffer):Promise<void>;close():Promise<void>;abort():Promise<void>}>}
export interface ScratchDirectory{getDirectoryHandle(name:string,options:{create:boolean}):Promise<ScratchDirectory>;getFileHandle(name:string,options?:{create:boolean}):Promise<ScratchHandle>;removeEntry(name:string):Promise<void>;entries():AsyncIterableIterator<[string,{kind:'file'|'directory'}]>}
export type StagedFile={name:string;directory:string;handle:ScratchHandle};
export type LeaseToken={name:string;unlock():void;active:boolean;pinCount:number;releaseRequested:boolean};
export interface FileStoreInput{
 storage:{getDirectory():Promise<ScratchDirectory>};locks:Pick<LockManager,'request'>;root?:string;retained?:()=>Promise<readonly string[]>;setTimeout?:(callback:()=>void,ms:number)=>number;clearTimeout?:(handle:number)=>void;now?:()=>number;workMs?:number;maxEntries?:number;isAvailable?:()=>boolean|string;onError?:(error:unknown)=>void;
}
export interface ScratchFiles{
 stage():Promise<StagedFile>;resume(name:string):Promise<StagedFile>;release(value:Blob|string):Promise<void>;bind<T extends Blob>(blob:T,name:string):T;read(ref:FileReference):Promise<Blob>;nameOf(blob:Blob):string|null;collect(options?:{signal?:AbortSignal|null}):Promise<CollectionResult>;pin(blob:Blob):()=>void;suspend():()=>void;status():{busy:boolean};settled():Promise<unknown>;
}
export type ExportStatus=Readonly<{busy:boolean;jobBusy:boolean;fileBusy:boolean;pending:number;phase:string}>;
export interface FileWorker{onmessage:((event:MessageEvent<unknown>)=>void)|null;onerror:((event:ErrorEvent)=>void)|null;onmessageerror:((event:MessageEvent<unknown>)=>void)|null;terminate():void;postMessage(value:unknown):void}
export interface ExportWindow{URL:Pick<typeof URL,'createObjectURL'|'revokeObjectURL'>;setTimeout(callback:()=>void,ms:number):number;showSaveFilePicker?:(options:{suggestedName:string;types:{description:string;accept:Record<string,string[]>}[];id?:string})=>Promise<ScratchHandle&{name?:string}>;showOpenFilePicker?:(options:{multiple:boolean;types:{description:string;accept:Record<string,string[]>}[]})=>Promise<(ScratchHandle&{name?:string})[]>}
export interface CoordinatorInput{createWorker():FileWorker;window:ExportWindow;document:Document;onState?:(status:ExportStatus)=>void;files?:ScratchFiles|null}
export type PendingExport={resolve(value:unknown):void;reject(error:unknown):void;timeout:number;type:ExportOperation;stallTimeoutMs:number;onProgress:((value:WorkerProgress)=>void)|null|undefined};
export type SaveFile={blob:Blob;filename:string;checkProtection?:()=>Promise<void>};
export type Policy={version:unknown;id:string;verifier:Blob;key?:CryptoKey|null;setAt?:unknown};
export type PasswordOptions={confirm?:boolean;title?:string;message?:string;confirmLabel?:string;cancelLabel?:string;signal?:AbortSignal|null|undefined};
export interface ProtectionInput<Token>{
 processing:ExportProcessing;storage:{read(key:string):Promise<unknown>;write(key:string,value:Policy,options:{expectedId:string;check():void}):Promise<unknown>;remove(key:string,options:{expectedId:string;check():void}):Promise<unknown>};
 interactions:{input(options:PasswordOptions&{title:string;message:string;inputLabel:string;inputType:'password';confirmPassword:boolean;maxLength:number;required:boolean;hint:string;validate(value:string):string;confirmLabel:string}):Promise<{value:string}|null>;confirm(options:{title:string;message:string;confirmLabel:string;danger:boolean}):Promise<boolean>;choose(options:{title:string;message:string;choices:{value:string;label:string;description?:string;kind?:'danger'}[]}):Promise<string|null>};
 settingKey:string;onState?:(state:Readonly<{enabled:boolean;unlocked:boolean}>)=>void;canMutate?:()=>boolean;issueToken?:()=>Token|null;assertToken?:(token:Token|null)=>void;remember?:()=>boolean;
}
export type ProtectionOptions=ExportOptions&{interactive?:boolean};
export type FrameInput=Omit<IntegrityInputs['integrity.decrypt'],'key'|'output'>&{output?:import('./portable-file.ts').OutputTarget|null};
