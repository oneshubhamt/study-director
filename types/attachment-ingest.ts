import type {AttachmentRequest,WorkerProgress} from '../portable/worker-contracts.ts';
export type IngestOptions={signal?:AbortSignal|undefined;onProgress?:((value:Readonly<WorkerProgress>)=>void)|undefined};
export interface IngestWorker{onmessage:((event:MessageEvent<unknown>)=>void)|null;onerror:((event:ErrorEvent)=>void)|null;onmessageerror:((event:MessageEvent<unknown>)=>void)|null;postMessage(message:AttachmentRequest<Blob>):void;terminate():void}
export interface IngestInput{createWorker():IngestWorker;storage?:{estimate():Promise<StorageEstimate>};directory:string;randomUUID?:()=>string;setTimeout?:(callback:()=>void,delay:number)=>number;clearTimeout?:(id:number)=>void;stallTimeoutMs?:number;cancelTimeoutMs?:number;estimateTimeoutMs?:number;idleTimeoutMs?:number;onAbandoned?:()=>void}
export type IngestPending={type:'ingest'|'verify'|'remove';resolve(value:unknown):void;reject(error:unknown):void;onProgress:IngestOptions['onProgress'];cancelling:boolean;watch():void};
export type IngestCall=Exclude<AttachmentRequest<Blob>,{type:'cancel'}> extends infer R?R extends {id:number}?Omit<R,'id'>:never:never;
