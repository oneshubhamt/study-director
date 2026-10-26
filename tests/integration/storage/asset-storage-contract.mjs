import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {OPFS_IDENTITIES} from '../../../contracts/canonical-identities.mjs';

const render=source=>source
  .replaceAll('@@SD_ATTACHMENT_OPFS_DIRECTORY@@',OPFS_IDENTITIES.attachments)
  .replaceAll('@@SD_LEGACY_ATTACHMENT_OPFS_DIRECTORY@@'.attachmentsV1);
const context={console,Blob,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Map,Set,Object,Promise,Number,String,Math,Date,JSON,crypto:webcrypto,Symbol,TypeError,Error};
context.globalThis=context;vm.createContext(context);
vm.runInContext(fs.readFileSync('source/core/internal.js','utf8'),context,{filename:'source/core/internal.js'});
vm.runInContext(render(fs.readFileSync('source/core/asset-storage.js','utf8')),context,{filename:'source/core/asset-storage.js'});
const mod=context[Symbol.for('studyDirector.internalModules.v1')].require('asset-storage',1);

let now=1000;const lease=mod.createLease(1500,()=>now);
assert.equal(lease.protect('x'),'x');assert.equal(lease.isProtected('x'),true);now=2600;assert.equal(lease.isProtected('x'),false);lease.protect('y');assert.equal(lease.release('y'),true);

const metadata=new Map(),files=new Map(),legacyFiles=new Map();let seq=0,sharedReaders=0,tokenSeq=0,mutating=true,verifyCalls=0;
const hash=async blob=>Array.from(new Uint8Array(await webcrypto.subtle.digest('SHA-256',await blob.arrayBuffer())),v=>v.toString(16).padStart(2,'0')).join('');
const notFound=()=>Object.assign(new Error('missing'),{name:'NotFoundError'});
function fileDirectory(map){return {
  async getFileHandle(name){if(!map.has(name))throw notFound();return {async getFile(){return map.get(name)}};},
  async removeEntry(name){if(!map.delete(name))throw notFound();},
  async *entries(){for(const name of map.keys())yield [name,{kind:'file'}];}
};}
const currentDir=fileDirectory(files),legacyDir=fileDirectory(legacyFiles),root={legacyPresent:false,
  async getDirectoryHandle(name,{create=false}={}){if(name===OPFS_IDENTITIES.attachments)return currentDir;if(name==='study-director-assets-v1'&&this.legacyPresent)return legacyDir;if(name==='study-director-assets-v1'&&!create)throw notFound();throw notFound();},
  async removeEntry(name){if(name!=='study-director-assets-v1'||!this.legacyPresent)throw notFound();this.legacyPresent=false;legacyFiles.clear();}
};
const locks={async request(name,options,callback){if(typeof options==='function'){callback=options;options={};}
  if(name.includes('retention')&&options.mode==='shared'){sharedReaders++;try{return await callback({name});}finally{sharedReaders--;}}
  if(name.includes('retention')&&options.ifAvailable&&sharedReaders)return callback(null);
  return callback({name});
}};
const ingest={
  async ingest(blob,{signal,onProgress}={}){if(signal?.aborted)throw Object.assign(new Error('cancelled'),{name:'AbortError'});const storageName=`attblob-${String(++seq).padStart(20,'a')}`,digest=await hash(blob);files.set(storageName,blob);onProgress?.({loaded:blob.size,total:blob.size});return {storageName,hash:digest,size:blob.size};},
  async verify(name,digest,size){verifyCalls+=1;const blob=files.get(name);return !!blob&&blob.size===size&&await hash(blob)===digest;},
  async remove(name){return files.delete(name);}
};
const validId=value=>/^att-[a-z]{20}$/.test(String(value));
const validType=value=>['application/pdf','audio/mpeg'].includes(String(value));
const commits=[];
const ports={name:'qa',protocol:'https:',storage:{getDirectory:async()=>root},locks,ingest,maxBytes:1024*1024,limitForType:type=>type==='audio/mpeg'?2048:4096,
  validId,validType,issueToken:()=>++tokenSeq,assertToken:token=>{if(!Number.isInteger(token))throw new Error('stale token');},canMutate:()=>mutating,
  read:async key=>metadata.get(key)??null,keys:async()=>[...metadata.keys()],entries:async()=>[...metadata.entries()],
  commit:async(upserts,removes,token,guard=()=>true)=>{assert.ok(Number.isInteger(token));if(!guard())throw new Error('guard');commits.push({upserts:upserts.length,removes:removes.length});for(const [key,row] of upserts)metadata.set(key,row);for(const key of removes)metadata.delete(key);return true;}
};
const store=mod.create(ports),A='att-aaaaaaaaaaaaaaaaaaaa',B='att-bbbbbbbbbbbbbbbbbbbb',C='att-cccccccccccccccccccc',D='att-dddddddddddddddddddd';
assert.equal(store.supported(),true);store.requireAvailable();await assert.rejects(()=>store.get('bad'),/Invalid attachment identity/);
const unsupported=mod.create({...ports,protocol:'file:'});assert.equal(unsupported.supported(),false);assert.throws(()=>unsupported.requireAvailable(),/opened directly/);


const pdf=new Blob(['same-pdf-bytes'],{type:'application/pdf'}),audio=new Blob(['audio-bytes'],{type:'audio/mpeg'});
await assert.rejects(()=>store.put(A,new Blob([],{type:'application/pdf'})),/supported file limits/);
const a=await store.put(A,pdf,{name:' A\u0000.pdf ',library:false});assert.equal(a.name,'A.pdf');assert.equal((await store.get(A)).size,pdf.size);
assert.equal((await store.list()).length,1);assert.equal((await store.rename(A,' renamed.pdf ')).name,'renamed.pdf');assert.equal((await store.setLibrary(A,true)).library,true);assert.equal((await store.setLibrary(A,true)).library,true);
const b=await store.put(B,pdf,{name:'B.pdf',library:true});assert.equal(metadata.get(A).file,b.file);assert.equal(metadata.get(B).file,b.file);verifyCalls=0;assert.equal(await store.verifyMetadata([{id:A,...metadata.get(A)},{id:B,...metadata.get(B)}]),2);assert.equal(verifyCalls,1,'metadata verification must hash one shared physical attachment source once per verification phase while validating both logical IDs');
const staged=await store.put(C,audio,{name:'C.mp3',library:true,stage:true,token:77});assert.equal(metadata.has(C),false);await store.publish([[C,staged]],77,()=>{});assert.equal(metadata.has(C),true);
const d=await store.put(D,audio,{name:'D.mp3',stage:true,token:78});assert.equal(await store.discard([d]),1);assert.equal(await store.discard([{bad:true}]),0);
assert.equal(await store.verifyMetadata([{id:C,...metadata.get(C)}]),1);assert.equal(await store.restoreMetadata([{id:C,...metadata.get(C)}]),1);
await assert.rejects(()=>store.verifyMetadata([{id:C,...metadata.get(C)},{id:C,...metadata.get(C)}]),/Duplicate attachment identity/);

const audit=await store.shallowAudit([A,C,'att-ffffffffffffffffffff'],{shouldYield:()=>true,yieldTask:async()=>{},check:()=>{}});assert.equal(audit.status,'completed');assert.equal(audit.references,3);assert.ok(audit.issues.some(issue=>issue.kind==='missing-metadata'));
await assert.rejects(()=>store.removeMetadata([A],()=>false),/references changed/);assert.equal(await store.removeMetadata([A],()=>true),1);assert.equal(metadata.has(A),false);
mutating=false;await assert.rejects(()=>store.removeMetadata([B]),/Take control/);mutating=true;

const release=await store.retain();assert.equal((await store.collect(async()=>({status:'should-not-run'}))).reason,'active-editor-or-file-operation');release();await new Promise(r=>setImmediate(r));
mutating=false;assert.equal((await store.collect(async()=>({}))).reason,'not-primary');mutating=true;
const collectResult=await store.collect(async gc=>{const keys=await gc.keys();assert.ok(keys.includes(B)===false,'library item must remain pinned');await assert.rejects(()=>gc.removeMany([C],()=>false,true),/references changed/);assert.equal(await gc.removeMany([C],()=>true,true),1);return {removed:await gc.sweep()};});assert.ok(collectResult.removed>=1);

const rowB=metadata.get(B);const restored={id:B,...rowB,name:'incoming.pdf',library:false};await store.publish([[B,rowB]],99,()=>{}, {restoreLabels:false});assert.equal(metadata.get(B).name,'B.pdf');
await store.publish([[B,{...rowB,name:'incoming.pdf',library:false}]],100,()=>{}, {restoreLabels:true,replaceAll:true});assert.equal(metadata.get(B).name,'incoming.pdf');
await assert.rejects(()=>store.publish([[B,{...metadata.get(B),hash:'f'.repeat(64)}]],101,()=>{}),/conflicts with an existing file/);

console.log(JSON.stringify({status:'PASS',suite:'asset-storage-contract',commits:commits.length,metadataRows:metadata.size,files:files.size,lease:true,legacyCleanup:true,publication:true,collection:true},null,2));

// Physical collection releases the retention/metadata locks between bounded
// opportunities, while rebuilding the retained set for every continuation.
for(let i=0;i<70;i++)files.set('attblob-'+String(i).padStart(20,'b'),new Blob(['orphan']));
let passes=0,totalSwept=0;
for(;passes<20;passes++){
  const result=await store.collect(async gc=>({removed:await gc.sweep(),pending:gc.status().sweepPending}),{maxEntries:8});
  assert.ok(result.removed<=8);totalSwept+=result.removed;if(!result.pending)break;
}
assert.ok(passes>1);assert.equal(totalSwept,70);assert.ok(files.has(metadata.get(B).file),'currently published attachment bytes must survive all physical batches');
let checks=0;
files.set('attblob-'+String(999).padStart(20,'b'),new Blob(['later']));
await assert.rejects(store.collect(async gc=>gc.sweep(),{check:()=>{if(++checks>=5)throw Object.assign(new Error('foreground'),{code:'ASSET_MAINTENANCE_YIELDED'});},maxEntries:8}),/foreground/);
assert.ok(files.has('attblob-'+String(999).padStart(20,'b')));
assert.equal((await store.collect(async gc=>gc.sweep(),{maxEntries:8})),1,'the interrupted iterator entry must remain resumable');
console.log(JSON.stringify({status:'PASS',suite:'asset-storage-bounded-sweep',passes,totalSwept,retainedSource:true,foregroundPreemption:true}));
