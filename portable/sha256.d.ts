import type {WorkerProgress} from './worker-contracts';
// Temporary checked consumer boundary; the implementation is converted in the portable phase.
export declare class Sha256 {
 state:Uint32Array;block:Uint8Array;words:Int32Array;length:number;used:number;finished:boolean;
 compress(bytes:Uint8Array,offset?:number):void;
 update(bytes:Uint8Array):this;
 hex():string;
}
export declare function hashBlob(blob:Blob,progress?:(value:WorkerProgress)=>void):Promise<string>;
