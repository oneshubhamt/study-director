import {messageObject} from './worker-contracts.ts';
import {binary,cryptoKey,outputTarget} from './request-decoder.ts';
import type {HashSnapshot} from './integrity-hash.ts';
import type {OutputTarget,ByteWriter,Bytes} from '../types/portable-file.ts';
import {Sha256} from './sha256.ts';
import {openIntegrityOutput} from './integrity-output.ts';
import {hashSnapshot,restoreHash} from './integrity-hash.ts';
import {streamEncryptionInfo,derive,params,FRAME_BYTES,HEADER_BYTES} from './stream-encryption.ts';

// Each request performs one bounded read/hash/write or authenticated frame.
// The host commits checkpoints only after the scratch writer has flushed.
export interface IntegrityInputs{
 'integrity.digest':{hash:HashSnapshot};
 'integrity.append':{hash:HashSnapshot|null;chunk:Blob;offset:number;output:OutputTarget};
 'integrity.decrypt':{hash:HashSnapshot|null;file:Blob;frame?:number;key:CryptoKey;output?:OutputTarget};
}
export type IntegrityCheckpoint={hash:HashSnapshot;offset:number;checksum:string};
export interface IntegrityOutputs{
 'integrity.digest':string;
 'integrity.append':IntegrityCheckpoint;
 'integrity.decrypt':IntegrityCheckpoint&{frame:number;complete:boolean;size:number};
}
export type IntegrityRequest={[K in keyof IntegrityInputs]:{type:K;data:IntegrityInputs[K]}}[keyof IntegrityInputs];
const derived=new WeakMap<CryptoKey,{identity:string;aes:CryptoKey}>();
type Arguments={[K in keyof IntegrityInputs]:[type:K,data:IntegrityInputs[K]]}[keyof IntegrityInputs];
export function integritySegment<K extends keyof IntegrityInputs>(type:K,data:IntegrityInputs[NoInfer<K>]):Promise<IntegrityOutputs[K]>;
export async function integritySegment(...[type,data]:Arguments):Promise<IntegrityOutputs[keyof IntegrityInputs]>{
  if(type==='integrity.digest')return restoreHash(data.hash).hex();
  if(type==='integrity.append'){
    const hash=data.hash?restoreHash(data.hash):new Sha256(),offset=hash.length;
    if(!(data.chunk instanceof Blob)||data.chunk.size<1||data.chunk.size>FRAME_BYTES||offset!==data.offset)throw new Error('Integrity segment is invalid.');
    const bytes=new Uint8Array(await data.chunk.arrayBuffer()),writer=await openIntegrityOutput(data.output,offset);
    try{await writer.write(bytes);hash.update(bytes);await writer.close();return {hash:hashSnapshot(hash),offset:hash.length,checksum:restoreHash(hashSnapshot(hash)).hex()};}
    catch(error){await writer.abort().catch(()=>{});throw error;}finally{bytes.fill(0);}
  }
  if(type==='integrity.decrypt'){
    const info=await streamEncryptionInfo(data.file);if(!info)throw new Error('The repository protection format does not match its manifest.');
    const {header,size}=info,index=Number(data.frame)||0,hash=data.hash?restoreHash(data.hash):new Sha256();
    if(!Number.isSafeInteger(index)||index<0||hash.length!==Math.min(index*FRAME_BYTES,size)||index>Math.ceil(size/FRAME_BYTES))throw new Error('Integrity frame checkpoint is invalid.');
    const identity=Array.from(header).join(','),cached=derived.get(data.key),aes=cached?.identity===identity?cached.aes:await derive(data.key,header);derived.set(data.key,{identity,aes});
    const length=Math.min(FRAME_BYTES,size-hash.length),terminal=length===0,offset=HEADER_BYTES+Math.min(index*FRAME_BYTES,size)+index*16,bytes=new Uint8Array(await data.file.slice(offset,offset+length+16).arrayBuffer());let plain:Bytes|undefined,writer:ByteWriter|undefined;
    try{
      try{plain=new Uint8Array(await crypto.subtle.decrypt(params(header,index,length,terminal),aes,bytes));}
      catch(error){if(error!==null&&typeof error==='object'&&'name' in error&&error.name==='OperationError')throw Object.assign(new Error('Unlock the password used for this backup, or use another backup version.'),{code:'BACKUP_AUTH_FAILED'});throw error;}
      if(data.output){writer=await openIntegrityOutput(data.output,hash.length);await writer.write(plain);await writer.close();}
      hash.update(plain);return {hash:hashSnapshot(hash),offset:hash.length,frame:index+1,complete:terminal,size,checksum:terminal?restoreHash(hashSnapshot(hash)).hex():''};
    }catch(error){await writer?.abort().catch(()=>{});throw error;}finally{bytes.fill(0);plain?.fill(0);}
  }
  throw new Error('Unknown integrity segment operation.');
}

export function integrityRequest(type:unknown,input:unknown):IntegrityRequest{
 const data=messageObject(input),rawHash=data['hash'];
 // Round-trip validation checks every checkpoint word and tail byte before restoring it.
 const hash=rawHash==null?null:hashSnapshot(restoreHash(rawHash));
 if(type==='integrity.digest'){if(!hash)throw new Error('Integrity hash checkpoint is invalid.');return {type,data:{hash}};}
 if(type==='integrity.append'){
  if(typeof data['offset']!=='number')throw new Error('Integrity segment is invalid.');
  return {type,data:{hash,chunk:binary(data['chunk']),offset:data['offset'],output:outputTarget(data['output'])}};
 }
 if(type==='integrity.decrypt'){
  const frame=data['frame'];if(frame!==undefined&&typeof frame!=='number')throw new Error('Integrity frame checkpoint is invalid.');
  return {type,data:{hash,file:binary(data['file']),key:cryptoKey(data['key']),...(frame===undefined?{}:{frame}),...(data['output']?{output:outputTarget(data['output'])}:{})}};
 }
 throw new Error('Unknown integrity segment operation.');
}
