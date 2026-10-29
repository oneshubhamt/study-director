import type {HashSnapshot} from '../portable/integrity-hash.ts';
import type {IntegrityInputs,IntegrityOutputs} from '../portable/integrity-segments.ts';
import type {ProcessingPort,ProcessingOptions} from './backup-models.ts';
import type {ProcessingInputs,ProcessingOutputs} from './portable-processing.ts';
import type {FilePort,OutputTarget} from './portable-file.ts';
export type IntegrityPart={name:string;offset:number;hash:HashSnapshot|null;frame:number};
export type IntegrityState={version:1;objectId:string;storedChecksum:string;storedBytes:number;phase:'stored'|'plain'|'verified';sourceVersion:string;stored:IntegrityPart;plain:IntegrityPart};
export type RepositoryObject={objectId:string;kind:string;storedChecksum:string;storedBytes:number;sourceBytes:number;fingerprint:string};
export type ScratchFile={name:string;directory:string;handle:Pick<FilePort,'getFile'>};
export interface IntegrityProcessing extends Omit<ProcessingPort,'run'>{
 run<K extends keyof (ProcessingInputs&IntegrityInputs)>(type:K,data:(ProcessingInputs&IntegrityInputs)[K],options?:ProcessingOptions):Promise<(ProcessingOutputs&IntegrityOutputs)[K]>;
}
export interface IntegrityInput{
 files:{stage():Promise<ScratchFile>;resume(name:string):Promise<ScratchFile>;release(name:string):Promise<unknown>};processing:IntegrityProcessing;
 protection:{verifyFrame(data:{file:Blob;hash:HashSnapshot|null;frame:number;output:OutputTarget|null},options?:ProcessingOptions):Promise<IntegrityOutputs['integrity.decrypt']>;unprotect(file:Blob,options?:ProcessingOptions):Promise<{blob:Blob;encrypted:boolean}>};
 yieldTask?:()=>Promise<void>;maxSegments?:number;
}
export interface VerificationInput{
 entry:RepositoryObject;manifest:{encrypted:boolean};checkpoint?:unknown;
 readRange(entry:RepositoryObject,range:{offset:number;length:number;signal:AbortSignal|undefined}):Promise<{blob:Blob;totalBytes:number;version:string}|null>;
 onCheckpoint(state:IntegrityState|null):Promise<void>;signal?:AbortSignal;
}
export type VerificationResult=Readonly<{complete:false;checkpoint:IntegrityState}|{complete:true;opened?:Readonly<{blob:Blob;release():Promise<void>}>}>;
