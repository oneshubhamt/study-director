import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {OPFS_IDENTITIES} from '../../../contracts/canonical-identities.mjs';

const MiB=1048576;
class MemoryFileHandle{
  constructor(mode='sync'){this.mode=mode;this.bytes=new Uint8Array(0)}
  async createSyncAccessHandle(){
    if(this.mode.startsWith('fallback'))throw new DOMException('sync unavailable','NotAllowedError');
    const handle=this;
    return {
      truncate(size){const next=new Uint8Array(size);next.set(handle.bytes.subarray(0,Math.min(size,handle.bytes.length)));handle.bytes=next},
      write(bytes,{at=0}={}){if(handle.mode==='sync-write-fault')throw new DOMException('injected OPFS write failure','QuotaExceededError');const end=at+bytes.byteLength;if(end>handle.bytes.length){const next=new Uint8Array(end);next.set(handle.bytes);handle.bytes=next}handle.bytes.set(bytes,at);return bytes.byteLength},
      read(view,{at=0}={}){const available=Math.max(0,Math.min(view.byteLength,handle.bytes.length-at));view.set(handle.bytes.subarray(at,at+available));if(handle.mode==='sync-corrupt-read'&&at===0&&available)view[0]^=1;return available},
      getSize(){return handle.bytes.length},flush(){},close(){}
    };
  }
  async createWritable(){
    const handle=this;let parts=[],aborted=false;
    return {async write(bytes){if(aborted)throw new Error('aborted');if(handle.mode==='fallback-write-fault')throw new DOMException('injected OPFS quota failure','QuotaExceededError');parts.push(new Uint8Array(bytes))},async close(){if(aborted)return;const size=parts.reduce((n,p)=>n+p.byteLength,0),next=new Uint8Array(size);let at=0;for(const part of parts){next.set(part,at);at+=part.byteLength}if(handle.mode==='fallback-corrupt-read'&&next.length)next[0]^=1;handle.bytes=next;parts=[]},async abort(){aborted=true;parts=[]}};
  }
  async getFile(){return new Blob([this.bytes])}
}
function createHarness(mode='sync'){
  const files=new Map(),messages=[],waiters=new Map(),folders=[];let cancelOnFirstCopy=false;
  const dir={async getFileHandle(name,{create=false}={}){if(!files.has(name)){if(!create)throw new DOMException('missing','NotFoundError');files.set(name,new MemoryFileHandle(mode))}return files.get(name)},async removeEntry(name){if(!files.delete(name))throw new DOMException('missing','NotFoundError')}};
  const self={postMessage(message){messages.push(message);if(cancelOnFirstCopy&&message.progress?.phase==='copying'){cancelOnFirstCopy=false;self.onmessage({data:{type:'cancel',target:message.id}})}if(message.value||message.error){waiters.get(message.id)?.(message);waiters.delete(message.id)}}};
  const context={console,Blob,DOMException,Map,Set,Promise,Number,String,Math,Uint8Array,Uint32Array,DataView,setTimeout,clearTimeout,navigator:{storage:{getDirectory:async()=>({getDirectoryHandle:async name=>{folders.push(name);return dir;}})}},self};
  context.globalThis=context;vm.createContext(context);const source=fs.readFileSync('source/external/attachment-worker.js','utf8').replaceAll('@@SD_ATTACHMENT_OPFS_DIRECTORY@@',OPFS_IDENTITIES.attachments).replaceAll('@@SD_PROFILE_SCOPE_SEPARATOR@@','~');vm.runInContext(source,context,{filename:'attachment-worker.js'});
  let nextId=0;
  // Each request names the open profile's attachment folder.
  const request=(type,data,{cancelAfterFirstCopy=false,directory=OPFS_IDENTITIES.attachments}={})=>new Promise(resolve=>{const id=++nextId;cancelOnFirstCopy=cancelAfterFirstCopy;waiters.set(id,resolve);self.onmessage({data:{id,type,data:{...data,directory}}})});
  return {request,files,messages,folders};
}
const digest=async blob=>Array.from(new Uint8Array(await webcrypto.subtle.digest('SHA-256',await blob.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');

{
  const h=createHarness('sync'),file=new Blob([new Uint8Array(9*MiB).fill(37)]),name='attblob-12345678-1234-1234-1234-123456789012';
  const result=await h.request('ingest',{file,storageName:name});assert.ok(result.value);assert.equal(result.value.mode,'sync');assert.equal(result.value.hash,await digest(file));assert.equal(h.files.get(name).bytes.length,file.size);
  const phases=new Set(h.messages.filter(m=>m.progress).map(m=>m.progress.phase));assert.deepEqual([...['preparing','copying','verifying','complete']].every(p=>phases.has(p)),true);
  console.log('ok - built worker sync path hashes, writes, verifies and reports progress');
}
{
  const h=createHarness('fallback'),file=new Blob([new Uint8Array(5*MiB).fill(19)]),name='attblob-22345678-1234-1234-1234-123456789012';
  const result=await h.request('ingest',{file,storageName:name});assert.ok(result.value);assert.equal(result.value.mode,'async');assert.equal(result.value.hash,await digest(file));assert.equal(h.files.get(name).bytes.length,file.size);
  console.log('ok - NotAllowedError on SyncAccessHandle falls back to async OPFS writer');
}
{
  const h=createHarness('sync'),file=new Blob([new Uint8Array(9*MiB).fill(11)]),name='attblob-32345678-1234-1234-1234-123456789012';
  const result=await h.request('ingest',{file,storageName:name},{cancelAfterFirstCopy:true});assert.equal(result.error?.name,'AbortError');assert.equal(h.files.has(name),false,'cancelled staged file must be deleted');
  console.log('ok - built worker cancellation removes partial staged bytes');
}
// Both OPFS modes must reject an uncommitted write or corrupted read-back,
 // remove staged bytes, and never emit a completed attachment descriptor.
for(const mode of ['sync-write-fault','sync-corrupt-read','fallback-write-fault','fallback-corrupt-read']){
  const h=createHarness(mode),name='attblob-52345678-1234-1234-1234-123456789012';
  const result=await h.request('ingest',{file:new Blob([new Uint8Array(2048).fill(13)]),storageName:name});
  assert.ok(result.error,mode+' must fail ingestion rather than publish a metadata candidate');
  assert.equal(result.value,undefined,mode+' must not expose a verified attachment descriptor');
  assert.equal(h.files.has(name),false,mode+' must delete staged incomplete/corrupt OPFS bytes');
}
{
  // Profiles: each request names its profile's folder; any other folder is refused.
  const h=createHarness('sync'),file=new Blob([new Uint8Array(1024).fill(5)]),name='attblob-42345678-1234-1234-1234-123456789012',profileFolder=OPFS_IDENTITIES.attachments+'~prof_ben_mve00000_abcdef01';
  const result=await h.request('ingest',{file,storageName:name},{directory:profileFolder});assert.ok(result.value,JSON.stringify(result.error));assert.equal(h.folders.at(-1),profileFolder,'a later profile stores attachments in its own folder');
  for(const directory of ['',OPFS_IDENTITIES.attachments+'~other',OPFS_IDENTITIES.attachments+'/../x','elsewhere']){const refused=await h.request('ingest',{file,storageName:name},{directory});assert.ok(refused.error,'an unknown attachment folder is refused: '+directory);}
  console.log('ok - attachment worker opens only the profile attachment folder it is given');
}
console.log(JSON.stringify({status:'PASS',suite:'worker-behavior',pass:'attachment worker behavioral QA'},null,2));
