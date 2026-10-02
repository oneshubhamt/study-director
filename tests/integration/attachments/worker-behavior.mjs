import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {OPFS_IDENTITIES} from '../../../contracts/canonical-identities.mjs';

const MiB=1048576;
class MemoryFileHandle{
  constructor(mode='sync'){this.mode=mode;this.bytes=new Uint8Array(0)}
  async createSyncAccessHandle(){
    if(this.mode==='fallback')throw new DOMException('sync unavailable','NotAllowedError');
    const handle=this;
    return {
      truncate(size){const next=new Uint8Array(size);next.set(handle.bytes.subarray(0,Math.min(size,handle.bytes.length)));handle.bytes=next},
      write(bytes,{at=0}={}){const end=at+bytes.byteLength;if(end>handle.bytes.length){const next=new Uint8Array(end);next.set(handle.bytes);handle.bytes=next}handle.bytes.set(bytes,at);return bytes.byteLength},
      read(view,{at=0}={}){const available=Math.max(0,Math.min(view.byteLength,handle.bytes.length-at));view.set(handle.bytes.subarray(at,at+available));return available},
      getSize(){return handle.bytes.length},flush(){},close(){}
    };
  }
  async createWritable(){
    const handle=this;let parts=[],aborted=false;
    return {async write(bytes){if(aborted)throw new Error('aborted');parts.push(new Uint8Array(bytes))},async close(){if(aborted)return;const size=parts.reduce((n,p)=>n+p.byteLength,0),next=new Uint8Array(size);let at=0;for(const part of parts){next.set(part,at);at+=part.byteLength}handle.bytes=next;parts=[]},async abort(){aborted=true;parts=[]}};
  }
  async getFile(){return new Blob([this.bytes])}
}
function createHarness(mode='sync'){
  const files=new Map(),messages=[],waiters=new Map();let cancelOnFirstCopy=false;
  const dir={async getFileHandle(name,{create=false}={}){if(!files.has(name)){if(!create)throw new DOMException('missing','NotFoundError');files.set(name,new MemoryFileHandle(mode))}return files.get(name)},async removeEntry(name){if(!files.delete(name))throw new DOMException('missing','NotFoundError')}};
  const self={postMessage(message){messages.push(message);if(cancelOnFirstCopy&&message.progress?.phase==='copying'){cancelOnFirstCopy=false;self.onmessage({data:{type:'cancel',target:message.id}})}if(message.value||message.error){waiters.get(message.id)?.(message);waiters.delete(message.id)}}};
  const context={console,Blob,DOMException,Map,Set,Promise,Number,String,Math,Uint8Array,Uint32Array,DataView,setTimeout,clearTimeout,navigator:{storage:{getDirectory:async()=>({getDirectoryHandle:async()=>dir})}},self};
  context.globalThis=context;vm.createContext(context);const source=fs.readFileSync('source/external/attachment-worker.js','utf8').replaceAll('@@SD_ATTACHMENT_OPFS_DIRECTORY@@',OPFS_IDENTITIES.attachments);vm.runInContext(source,context,{filename:'attachment-worker.js'});
  let nextId=0;
  const request=(type,data,{cancelAfterFirstCopy=false}={})=>new Promise(resolve=>{const id=++nextId;cancelOnFirstCopy=cancelAfterFirstCopy;waiters.set(id,resolve);self.onmessage({data:{id,type,data}})});
  return {request,files,messages};
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
console.log(JSON.stringify({status:'PASS',suite:'worker-behavior',pass:'attachment worker behavioral QA'},null,2));
