import {Sha256} from './sha256.js';

const CHUNK_BYTES=4*1024*1024;
const YIELD_EVERY_CHUNKS=8;
// Each profile keeps its attachments in its own folder: the plain one, or
// the plain one followed by ~<profile scope>. The folder is split rather than
// measured: the bundler would fix a name's length before the build fills it in.
const DIRECTORY='@@SD_ATTACHMENT_OPFS_DIRECTORY@@',SEPARATOR='@@SD_PROFILE_SCOPE_SEPARATOR@@',PROFILE_SCOPE=/^prof_[a-z0-9]{1,24}_[a-z0-9]{6,12}_[a-f0-9]{8}$/u;
let folder=DIRECTORY;
function useFolder(value:unknown){const name=String(value||''),[base,scope,...rest]=name.split(SEPARATOR);if(base!==DIRECTORY||scope!==undefined&&(rest.length>0||!PROFILE_SCOPE.test(scope)))throw new TypeError('Attachment folder is invalid.');folder=name}
type ProgressPhase='preparing'|'copying'|'verifying'|'complete';
type TaskState={cancelled:boolean;storageName?:string};
const tasks=new Map<number,TaskState>();

function abortError(){const error=new Error('Attachment operation cancelled.');error.name='AbortError';return error;}
function check(id:number){if(tasks.get(id)?.cancelled)throw abortError();}
function validStorageName(value:unknown):value is string{return typeof value==='string'&&/^attblob-[a-f0-9-]{20,80}$/i.test(value)}
function progress(id:number,phase:ProgressPhase,loaded:number,total:number,mode?:string){self.postMessage({id,progress:{phase,loaded,total,mode}})}
const yieldToWorker=()=>new Promise<void>(resolve=>setTimeout(resolve,0));
async function directory(){const root=await navigator.storage.getDirectory();return root.getDirectoryHandle(folder,{create:true})}
async function removeEntry(storageName:string){if(!validStorageName(storageName))throw new TypeError('Attachment storage identity is invalid.');const dir=await directory();try{await dir.removeEntry(storageName)}catch(error){if((error as DOMException)?.name!=='NotFoundError')throw error}}

async function openSync(handle:FileSystemFileHandle){
  const factory=(handle as FileSystemFileHandle&{createSyncAccessHandle?:()=>Promise<FileSystemSyncAccessHandle>}).createSyncAccessHandle;
  if(typeof factory!=='function')return null;
  try{return await factory.call(handle)}
  catch(error){if(['NoModificationAllowedError','InvalidStateError','NotSupportedError','NotAllowedError','SecurityError'].includes((error as DOMException)?.name))return null;throw error}
}

async function verifySync(id:number,access:FileSystemSyncAccessHandle,total:number){
  if(access.getSize()!==total)throw new Error('Attachment write size did not verify.');
  const hash=new Sha256(),buffer=new Uint8Array(Math.min(CHUNK_BYTES,Math.max(1,total)));
  let offset=0,chunks=0;
  while(offset<total){
    check(id);const wanted=Math.min(buffer.byteLength,total-offset),view=wanted===buffer.byteLength?buffer:buffer.subarray(0,wanted),read=access.read(view,{at:offset});
    if(read!==wanted)throw new Error('Attachment read-back was incomplete.');hash.update(view);offset+=read;progress(id,'verifying',offset,total,'sync');
    if(++chunks%YIELD_EVERY_CHUNKS===0)await yieldToWorker();
  }
  return hash.hex();
}

async function writeAndVerifySync(id:number,file:Blob,handle:FileSystemFileHandle){
  const access=await openSync(handle);if(!access)return null;
  const sourceHash=new Sha256();
  try{
    access.truncate(0);
    for(let offset=0;offset<file.size;offset+=CHUNK_BYTES){
      check(id);const bytes=new Uint8Array(await file.slice(offset,Math.min(file.size,offset+CHUNK_BYTES)).arrayBuffer());check(id);sourceHash.update(bytes);
      const written=access.write(bytes,{at:offset});if(written!==bytes.byteLength)throw new Error('Attachment write was incomplete.');
      progress(id,'copying',Math.min(file.size,offset+written),file.size,'sync');
    }
    access.truncate(file.size);access.flush();check(id);
    const expected=sourceHash.hex(),verified=await verifySync(id,access,file.size);if(verified!==expected)throw new Error('Attachment write did not verify.');
    return {hash:expected,mode:'sync'} as const;
  }finally{try{access.close()}catch{}}
}

async function hashStoredFile(id:number,handle:FileSystemFileHandle,total:number){
  const file=await handle.getFile();if(file.size!==total)throw new Error('Attachment write size did not verify.');const hash=new Sha256();
  for(let offset=0;offset<file.size;offset+=CHUNK_BYTES){
    check(id);const bytes=new Uint8Array(await file.slice(offset,Math.min(file.size,offset+CHUNK_BYTES)).arrayBuffer());check(id);hash.update(bytes);
    progress(id,'verifying',Math.min(file.size,offset+bytes.byteLength),file.size,'async');
  }
  return hash.hex();
}

async function writeAndVerifyStream(id:number,file:Blob,handle:FileSystemFileHandle){
  const sourceHash=new Sha256();let writer:FileSystemWritableFileStream|null=null;
  try{
    writer=await handle.createWritable({keepExistingData:false});
    for(let offset=0;offset<file.size;offset+=CHUNK_BYTES){
      check(id);const bytes=new Uint8Array(await file.slice(offset,Math.min(file.size,offset+CHUNK_BYTES)).arrayBuffer());check(id);sourceHash.update(bytes);await writer.write(bytes);
      progress(id,'copying',Math.min(file.size,offset+bytes.byteLength),file.size,'async');
    }
    check(id);await writer.close();writer=null;const expected=sourceHash.hex(),verified=await hashStoredFile(id,handle,file.size);if(verified!==expected)throw new Error('Attachment write did not verify.');return {hash:expected,mode:'async'} as const;
  }catch(error){if(writer)await writer.abort().catch(()=>{});throw error}
}

async function ingest(id:number,file:Blob,storageName:string){
  if(!(file instanceof Blob)||!Number.isSafeInteger(file.size)||file.size<=0)throw new TypeError('Attachment file is invalid.');
  if(!validStorageName(storageName))throw new TypeError('Attachment storage identity is invalid.');
  const state=tasks.get(id);if(state)state.storageName=storageName;progress(id,'preparing',0,file.size);
  const dir=await directory(),handle=await dir.getFileHandle(storageName,{create:true});
  try{
    const result=await writeAndVerifySync(id,file,handle)||await writeAndVerifyStream(id,file,handle);check(id);
    progress(id,'complete',file.size,file.size,result.mode);return {storageName,hash:result.hash,size:file.size,mode:result.mode};
  }catch(error){await removeEntry(storageName).catch(()=>{});throw error}
}

async function verify(id:number,storageName:string,expectedHash:string,size:number){
  if(!validStorageName(storageName)||typeof expectedHash!=='string'||! /^[a-f0-9]{64}$/.test(expectedHash)||!Number.isSafeInteger(size)||size<=0)throw new TypeError('Attachment verification request is invalid.');
  const dir=await directory(),handle=await dir.getFileHandle(storageName),access=await openSync(handle);let actual='';
  if(access){try{actual=await verifySync(id,access,size)}finally{try{access.close()}catch{}}}else actual=await hashStoredFile(id,handle,size);
  return actual===expectedHash;
}

self.onmessage=(event:MessageEvent)=>{
  const message=event.data||{};
  if(message.type==='cancel'){const state=tasks.get(Number(message.target));if(state)state.cancelled=true;return}
  const id=Number(message.id);if(!Number.isSafeInteger(id)||id<=0)return;
  const state:TaskState={cancelled:false};tasks.set(id,state);
  Promise.resolve().then(async()=>{
    useFolder(message.data?.directory);
    if(message.type==='ingest')return ingest(id,message.data?.file,message.data?.storageName);
    if(message.type==='verify')return verify(id,message.data?.storageName,message.data?.expectedHash,message.data?.size);
    if(message.type==='remove'){await removeEntry(message.data?.storageName);return true}
    throw new Error('Unknown attachment worker operation.');
  }).then(value=>self.postMessage({id,value}),error=>self.postMessage({id,error:{name:error instanceof Error?error.name:'Error',message:error instanceof Error?error.message:'Attachment ingestion failed.'}})).finally(()=>tasks.delete(id));
};
