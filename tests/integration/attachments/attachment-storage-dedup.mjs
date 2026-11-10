import {readScript} from '../../../build/source-script.mts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

// Attachment deduplication contract: verified publication avoids redundant hashing and shared physical bytes survive until the final logical reference is removed.

{ // attachment-postverify-dedup
const context={console,Blob,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Map,Set,Object,Promise,Number,String,Math,Date,JSON,crypto:webcrypto,Symbol};
context.globalThis=context;vm.createContext(context);
for(const file of ['source/core/internal.ts','source/core/asset-storage.ts'])vm.runInContext(readScript(file),context,{filename:file});
const mod=context[Symbol.for('studyDirector.internalModules.v1')].require('asset-storage',1);

const metadata=new Map(),files=new Map();
const digest=async blob=>Array.from(new Uint8Array(await webcrypto.subtle.digest('SHA-256',await blob.arrayBuffer())),v=>v.toString(16).padStart(2,'0')).join('');
let physicalSequence=0,verifyCalls=0;
const ingest={
  async ingest(blob){const storageName=`attblob-${String(++physicalSequence).padStart(20,'a')}`,hash=await digest(blob);files.set(storageName,blob);return {storageName,hash,size:blob.size,mode:'test'};},
  async verify(){verifyCalls++;throw new Error('Freshly verified ingestion must not trigger a second full-file verification.');},
  async remove(name){files.delete(name);return true;}
};
const directory={
  async getFileHandle(name){if(!files.has(name)){const e=new Error('missing');e.name='NotFoundError';throw e;}return {async getFile(){return files.get(name)}};},
  async removeEntry(name){files.delete(name);},
  async *entries(){for(const name of files.keys())yield [name,{kind:'file'}];}
};
const storage={async getDirectory(){return {async getDirectoryHandle(){return directory;},async removeEntry(){const e=new Error('missing');e.name='NotFoundError';throw e;}};}};
let readers=0;
const locks={async request(name,options,callback){
  if(typeof options==='function')return options({name});
  if(options.mode==='shared'){readers++;try{return await callback({name});}finally{readers--;}}
  return callback(readers&&options.ifAvailable?null:{name});
}};
let token=0;
const ports={
  name:'test',protocol:'https:',storage,locks,ingest,maxBytes:1024*1024,
  validId:value=>/^att-[a-z0-9]{20}$/.test(value),validType:type=>type==='audio/mpeg',limitForType:()=>1024*1024,
  issueToken:()=>++token,assertToken:()=>true,canMutate:()=>true,
  read:async key=>metadata.get(key)||null,keys:async()=>[...metadata.keys()],entries:async()=>[...metadata.entries()],
  commit:async(upserts,removes,_token,guard=()=>true)=>{if(!guard())throw new Error('guard');for(const [key,row] of upserts)metadata.set(key,row);for(const key of removes)metadata.delete(key);return true;}
};
const store=mod.create(ports),A='att-aaaaaaaaaaaaaaaaaaaa',B='att-bbbbbbbbbbbbbbbbbbbb',C='att-cccccccccccccccccccc';
const blob=new Blob([new TextEncoder().encode('same audio bytes')],{type:'audio/mpeg'});

await store.put(A,blob,{name:'first.mp3',library:true});
const second=await store.put(B,blob,{name:'second.mp3',library:true});
assert.equal(verifyCalls,0,'direct duplicate publication must not perform hidden post-verification hashing');
assert.equal(metadata.get(A).file,metadata.get(B).file,'duplicate metadata must converge on one canonical verified physical file');
assert.equal(metadata.get(B).file,second.file,'latest verified upload should be the canonical copy');
assert.equal(files.size,2,'publication defers obsolete-file reclamation');

const staged=await store.put(C,blob,{name:'staged.mp3',library:true,stage:true,token:99});
assert.equal(verifyCalls,0,'staged audio upload must return immediately after worker verification');
assert.equal(metadata.has(C),false,'staged metadata must remain unpublished until publish');
await store.publish([[C,staged]],99,()=>{});
assert.equal(verifyCalls,0,'staged publish must remain metadata-only after verified ingestion');
assert.equal(metadata.get(A).file,metadata.get(C).file,'staged publish must canonicalize duplicate metadata without rehashing');
assert.equal(metadata.get(B).file,metadata.get(C).file);
assert.equal(files.size,3,'staged publication also defers reclamation');
const release=await store.retain();
assert.equal((await store.collect(async gc=>({removed:await gc.sweep()}))).status,'skipped','an active reader prevents sweeping');
assert.equal(files.size,3);release();await new Promise(resolve=>setImmediate(resolve));
assert.equal((await store.collect(async gc=>({removed:await gc.sweep()}))).removed,2);
assert.equal(files.size,1,'exclusive cleanup reclaims only obsolete files');
assert.equal((await store.get(C)).size,blob.size);

console.log(JSON.stringify({status:'PASS',suite:'attachment-postverify-dedup',surface:'post-verification attachment publication'},null,2));
}

{ // shared-hash-safety
const context={console,Blob,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Map,Set,Object,Promise,Number,String,Math,Date,JSON,crypto:globalThis.crypto};
context.globalThis=context;vm.createContext(context);
for(const file of ['source/core/internal.ts','source/core/asset-storage.ts'])vm.runInContext(readScript(file),context,{filename:file});
const mod=context[Symbol.for('studyDirector.internalModules.v1')].require('asset-storage',1);

const metadata=new Map(),files=new Map();
const digest=async blob=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),v=>v.toString(16).padStart(2,'0')).join('');
let physicalSequence=0;
const ingest={
  async ingest(blob){const storageName=`attblob-${String(++physicalSequence).padStart(20,'a')}`,hash=await digest(blob);files.set(storageName,blob);return {storageName,hash,size:blob.size,mode:'test'};},
  async verify(name,hash,size){const blob=files.get(name);return !!blob&&blob.size===size&&await digest(blob)===hash;},
  async remove(name){files.delete(name);return true;}
};
const fileHandle=name=>({async getFile(){if(!files.has(name)){const e=new Error('missing');e.name='NotFoundError';throw e;}return files.get(name);}});
const directory={
  async getFileHandle(name){if(!files.has(name)){const e=new Error('missing');e.name='NotFoundError';throw e;}return fileHandle(name);},
  async removeEntry(name){files.delete(name);},
  async *entries(){for(const name of files.keys())yield [name,{kind:'file'}];}
};
const storage={async getDirectory(){return {async getDirectoryHandle(){return directory;}};}};
const locks={async request(_name,options,callback){if(typeof options==='function')return options({name:_name});return callback({name:_name});}};
let token=0;
const ports={
  name:'test',protocol:'https:',storage,locks,ingest,maxBytes:1024*1024,
  validId:value=>/^att-[a-z0-9]{20}$/.test(value),validType:type=>type==='application/pdf',limitForType:()=>1024*1024,
  issueToken:()=>++token,assertToken:()=>true,canMutate:()=>true,
  read:async key=>metadata.get(key)||null,keys:async()=>[...metadata.keys()],entries:async()=>[...metadata.entries()],
  commit:async(upserts,removes,_token,guard=()=>true)=>{if(!guard())throw new Error('guard');for(const [key,row] of upserts)metadata.set(key,row);for(const key of removes)metadata.delete(key);return true;}
};
const store=mod.create(ports);
const A='att-aaaaaaaaaaaaaaaaaaaa',B='att-bbbbbbbbbbbbbbbbbbbb';
const blob=new Blob([new TextEncoder().encode('shared attachment bytes')],{type:'application/pdf'});
const rowA=await store.put(A,blob,{name:'A.pdf',library:true});
const rowB=await store.put(B,blob,{name:'B.pdf',library:true});
assert.equal(rowA.hash,rowB.hash,'same bytes must share one content hash');
assert.equal(metadata.get(A).file,metadata.get(B).file,'deduplicated metadata must converge on one verified OPFS object');
assert.equal(metadata.get(B).file,rowB.file,'latest verified upload becomes the canonical physical copy without a second full-file read');
assert.equal(files.size,2,'publication must defer reclaiming the superseded physical copy while existing readers may still hold it');

await store.collect(async gc=>{assert.equal(await gc.sweep(),1);});
assert.equal(files.size,1,'exclusive retention sweep must reclaim the obsolete physical copy');
assert.equal(metadata.get(A).file,metadata.get(B).file,'sweeping obsolete bytes must not disturb shared metadata');

await store.collect(async gc=>{assert.equal(await gc.removeMany([A],()=>true,true),1);assert.equal(await gc.sweep(),0);});
assert.equal(metadata.has(A),false);
assert.equal(metadata.has(B),true);
assert.equal(files.size,1,'shared OPFS object must survive while another metadata row retains its file');

await store.collect(async gc=>{assert.equal(await gc.removeMany([B],()=>true,true),1);assert.equal(await gc.sweep(),1);});
assert.equal(metadata.size,0);
assert.equal(files.size,0,'OPFS object becomes collectible only after the final metadata row is gone');
console.log('QA_FIXTURE shared-hash attachment safety: PASS');
}
