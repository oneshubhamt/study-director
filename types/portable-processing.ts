import type {OutputTarget} from './portable-file.ts';
import type {MarkdownNode} from '../rich-text/markdown';
import type {ZipFile} from '../portable/zip.ts';
import type {streamEncryptionInfo} from '../portable/stream-encryption.ts';
export type DecodeOptions={gzip?:boolean|undefined;maxBytes:number;maxLineBytes:number};
export type DecodedLine={value:unknown;uncompressedBytes:number;lines:number};
export interface ProcessingInputs{
 'file.copy':{file:Blob;output:OutputTarget};
 'crypto.stream.encrypt':{file:Blob;output:OutputTarget;key:CryptoKey};
 'crypto.stream.decrypt':{file:Blob;output:OutputTarget;key:CryptoKey};
 'crypto.info':{file:Blob};'crypto.key':{password:string};
 'crypto.verifier.create':{key:CryptoKey};'crypto.verifier.check':{file:Blob;key:CryptoKey};
 'file.hash':{file:Blob};checksum:{value:unknown;algorithm?:string|undefined};
 'checksum.ranges':{file:Blob;ranges:{start:number;end:number}[]};
 stringify:{value:unknown};chunk:{seq:number;entityType:string;items:unknown[];algorithm?:string|undefined;maxLineBytes:number};
 parseBlob:{file:Blob;maxBytes:number};'decode.open':DecodeOptions&{file:Blob};'decode.next':{id:number};'decode.close':{id:number};
 'encode.open':{gzip?:boolean|undefined;maxBytes:number};'encode.write':{id:number;line:string};'encode.finish':{id:number};'encode.close':{id:number};
 markdown:{doc:MarkdownNode|null|undefined;text?:string|undefined;paths:Record<string,string>};
 zip:{files:ZipFile[];date:string|number};equalFiles:{left:Blob;right:Blob};
}
export interface ProcessingOutputs{
 'file.copy':Blob;'crypto.stream.encrypt':Blob;'crypto.stream.decrypt':Blob;
 'crypto.info':Awaited<ReturnType<typeof streamEncryptionInfo>>;'crypto.key':CryptoKey;
 'crypto.verifier.create':Blob;'crypto.verifier.check':boolean;'file.hash':string;checksum:string;'checksum.ranges':string[];
 stringify:string|undefined;chunk:{line:string;checksum:string};parseBlob:unknown;
 'decode.open':number;'decode.next':IteratorResult<DecodedLine,void>;'decode.close':boolean;
 'encode.open':number;'encode.write':boolean;'encode.finish':Blob;'encode.close':boolean;
 markdown:string;zip:Blob;equalFiles:boolean;
}
export type ProcessingOperation=keyof ProcessingInputs;
export type ProcessingRequest={[K in ProcessingOperation]:{type:K;data:ProcessingInputs[K]}}[ProcessingOperation];
