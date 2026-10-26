import type {Bytes,ByteWriter,Progress} from '../types/portable-file.ts';
// SDENC02: fixed-size authenticated frames; output is an OPFS file, never an
// array of accumulated ciphertext/plaintext chunks. Used in the export worker.
export const FRAME_BYTES=1024*1024;
export const HEADER_BYTES=64;
const FRAME_WINDOW=4;
const ITERATIONS=600000,TAG_BYTES=16,MAX_CHUNKS=0xfffffffe;
const MAGIC=new TextEncoder().encode('SDENC02\n');
const VERIFIER_MAGIC=new TextEncoder().encode('SDKEY01\n'),VERIFIER_BYTES=64;
const VERIFIER_PROOF=new TextEncoder().encode('Study Director backup protection verifier v2');
const invalid=(message:string,code='BACKUP_ENCRYPTION_INVALID')=>Object.assign(new Error(message),{code});
const u64=(bytes:Bytes,offset:number,value:number)=>new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).setBigUint64(offset,BigInt(value));
export function encryptedSize(size:number){
  if(!Number.isSafeInteger(size)||size<1||Math.ceil(size/FRAME_BYTES)>MAX_CHUNKS)throw invalid('Backup exceeds the authenticated format’s numeric or nonce range.');
  return HEADER_BYTES+size+(Math.ceil(size/FRAME_BYTES)+1)*TAG_BYTES;
}
export async function streamEncryptionInfo(file:Blob){
  if(!(file instanceof Blob))throw invalid('A backup file is required.');
  const header=new Uint8Array(await file.slice(0,HEADER_BYTES).arrayBuffer());
  if(!MAGIC.every((byte,i)=>header[i]===byte))return null;
  if(header.length!==HEADER_BYTES)throw invalid('Encrypted backup header is truncated.');
  const view=new DataView(header.buffer),size=Number(view.getBigUint64(40));
  if(header[8]!==2||header[9]!==1||header[10]!==0||header[11]!==0||view.getUint32(12)!==FRAME_BYTES||view.getUint32(16)!==ITERATIONS||header.slice(48).some(Boolean))throw invalid('Encrypted backup parameters are unsupported.');
  if(encryptedSize(size)!==file.size)throw invalid('Encrypted backup is truncated or has trailing data.');
  return {header,size,version:2};
}
export async function passwordKey(password:string){
  if(typeof password!=='string'||!password.length||password.length>1024)throw invalid('Enter a password of 1–1024 characters.');
  const bytes=new TextEncoder().encode(password);
  try{return await crypto.subtle.importKey('raw',bytes,'PBKDF2',false,['deriveKey']);}finally{bytes.fill(0);}
}
async function verifierHmacKey(key:CryptoKey,salt:Bytes){
  if(key?.type!=='secret'||key.algorithm?.name!=='PBKDF2'||key.extractable)throw invalid('Unlock backup protection first.','BACKUP_LOCKED');
  return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:ITERATIONS},key,{name:'HMAC',hash:'SHA-256',length:256},false,['sign','verify']);
}
export async function createPasswordVerifier(key:CryptoKey){
  const header=new Uint8Array(32);header.set(VERIFIER_MAGIC);header[8]=1;header[9]=1;
  new DataView(header.buffer).setUint32(12,ITERATIONS);header.set(crypto.getRandomValues(new Uint8Array(16)),16);
  const hmac=await verifierHmacKey(key,header.slice(16,32));
  const signature=new Uint8Array(await crypto.subtle.sign('HMAC',hmac,VERIFIER_PROOF));
  return new Blob([header,signature],{type:'application/octet-stream'});
}
export async function verifyPasswordVerifier(file:Blob,key:CryptoKey){
  if(!(file instanceof Blob)||file.size!==VERIFIER_BYTES)throw invalid('Backup encryption settings are unreadable.');
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(!VERIFIER_MAGIC.every((byte,i)=>bytes[i]===byte)||bytes[8]!==1||bytes[9]!==1||bytes[10]!==0||bytes[11]!==0||new DataView(bytes.buffer).getUint32(12)!==ITERATIONS)throw invalid('Backup encryption settings are unreadable.');
  const hmac=await verifierHmacKey(key,bytes.slice(16,32));
  if(!await crypto.subtle.verify('HMAC',hmac,bytes.slice(32),VERIFIER_PROOF))throw invalid('The password is incorrect.','BACKUP_AUTH_FAILED');
  return true;
}
export async function derive(key:CryptoKey,header:Bytes){
  if(key?.type!=='secret'||key.algorithm?.name!=='PBKDF2'||key.extractable)throw invalid('Unlock backup protection first.','BACKUP_LOCKED');
  return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt:header.slice(20,36),iterations:ITERATIONS},key,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export function params(header:Bytes,index:number,length:number,terminal:boolean){
  const iv=new Uint8Array(12);iv.set(header.slice(36,40));u64(iv,4,index);
  const aad=new Uint8Array(HEADER_BYTES+13);aad.set(header);u64(aad,HEADER_BYTES,index);new DataView(aad.buffer).setUint32(HEADER_BYTES+8,length);aad[HEADER_BYTES+12]=terminal?1:0;
  return {name:'AES-GCM',iv,additionalData:aad,tagLength:128};
}
export async function transformEncrypted(file:Blob,key:CryptoKey,writer:Pick<ByteWriter,'write'>,{decrypt=false,progress=()=>{},check=()=>{}}:{decrypt?:boolean;progress?:Progress;check?:()=>void}={}){
  let header,size=file.size;
  if(decrypt){const info=await streamEncryptionInfo(file);if(!info)throw invalid('Not a streaming encrypted backup.');({header,size}=info);}
  else{
    encryptedSize(size);header=new Uint8Array(HEADER_BYTES);header.set(MAGIC);header[8]=2;header[9]=1;
    const view=new DataView(header.buffer);view.setUint32(12,FRAME_BYTES);view.setUint32(16,ITERATIONS);
    header.set(crypto.getRandomValues(new Uint8Array(16)),20);header.set(crypto.getRandomValues(new Uint8Array(4)),36);u64(header,40,size);
  }
  const aes=await derive(key,header);check();if(!decrypt)await writer.write(header);
  // Up to FRAME_WINDOW frames are read and sealed (or opened) at once, so the
  // browser's AES runs alongside the reads; results are written strictly in
  // order and every buffer is zeroed after use. The last frame is empty and
  // marks the end.
  // Only the last data frame can be short, so frame i starts after min(i·FRAME, size)
  // plaintext bytes (plus one tag per earlier frame when decrypting).
  const frames=Math.ceil(size/FRAME_BYTES)+1,frameLength=(index:number)=>Math.max(0,Math.min(FRAME_BYTES,size-index*FRAME_BYTES)),frameStart=(index:number)=>(decrypt?HEADER_BYTES+index*TAG_BYTES:0)+Math.min(index*FRAME_BYTES,size);
  const transform=async (index:number)=>{
    const length=frameLength(index),start=frameStart(index),bytes=new Uint8Array(await file.slice(start,start+length+(decrypt?TAG_BYTES:0)).arrayBuffer());
    try{return new Uint8Array(await crypto.subtle[decrypt?'decrypt':'encrypt'](params(header,index,length,index===frames-1),aes,bytes));}
    catch(error){if(decrypt&&error!==null&&typeof error==='object'&&'name' in error&&error.name==='OperationError')throw invalid('The password is incorrect or the encrypted backup is damaged.','BACKUP_AUTH_FAILED');throw error;}
    finally{bytes.fill(0);}
  };
  const pending:Promise<Bytes>[]=[];let launched=0,done=0;
  try{
    for(let index=0;index<frames;index++){
      check();while(pending.length<FRAME_WINDOW&&launched<frames){const task=transform(launched++);task.catch(()=>{});pending.push(task);}
      const result=await pending.shift()!;
      try{check();await writer.write(result);}finally{result.fill(0);}
      done+=frameLength(index);progress({loaded:done,total:size,phase:decrypt?'decrypting':'encrypting'});
    }
  }finally{for(const row of await Promise.allSettled(pending))if(row.status==='fulfilled')row.value.fill(0);}
  if(decrypt&&HEADER_BYTES+size+frames*TAG_BYTES!==file.size)throw invalid('Encrypted backup has trailing data.');
  return decrypt?size:encryptedSize(size);
}
