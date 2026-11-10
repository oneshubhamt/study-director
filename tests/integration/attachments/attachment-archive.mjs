import {readScript} from '../../../build/source-script.mts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

for(const file of ['source/core/internal.ts','source/core/attachments.ts'])vm.runInThisContext(readScript(file),{filename:file});
const module=globalThis[Symbol.for('studyDirector.internalModules.v1')].require('attachments',1);
const payload=new Blob([new Uint8Array([1,2,3,4])],{type:'image/png'});
const hash='a'.repeat(64),id='img-abcdefghijklmnopqrst';
const manifest={format:'study-director.attachments',version:1,entries:[{id,name:'qa.png',type:'image/png',size:payload.size,hash,library:true}],files:[{hash,size:payload.size}]};
const metadata=new TextEncoder().encode(JSON.stringify(manifest));
const header=new Uint8Array(44);header.set(new TextEncoder().encode('SDAT01\r\n'));new DataView(header.buffer).setUint32(8,metadata.length,true);header.set(new Uint8Array(await crypto.subtle.digest('SHA-256',metadata)),12);
const archive=new Blob([header,metadata,payload],{type:'application/octet-stream'});
const parsed=await module.inspect(archive);
assert.equal(parsed.manifest.version,1);
assert.equal(parsed.manifest.entries[0].id,id);
assert.equal(parsed.contents.get(hash).size,payload.size);

assert.equal(module.limits.maxImage,12*1024*1024,'Image attachments must use the 12 MiB stored-image ceiling.');
assert.equal(module.limits.maxPdfAudio,2*1024*1024*1024,'PDF/audio attachments must use the 2 GiB per-file ceiling.');
assert.throws(()=>module.checkManifest({format:'study-director.attachments',version:1,entries:[{id,name:'too-large.png',type:'image/png',size:12*1024*1024+1,hash,library:true}],files:[{hash,size:12*1024*1024+1}]}),/Invalid archived attachment/u);
assert.throws(()=>module.checkManifest({format:'study-director.attachments',version:1,entries:[{id:'att-abcdefghijklmnopqrst',name:'too-large.pdf',type:'application/pdf',size:2*1024*1024*1024+1,hash,library:true}],files:[{hash,size:2*1024*1024*1024+1}]}),/Invalid archived content/u);

// Manifest decoding rejects malformed transport values without normalizing them
// into identities or sizes that could point at a different attachment.
assert.equal(module.checkManifest(manifest),manifest,'validated manifests retain their identity');
for(const patch of [{size:'4'},{library:1},{type:null},{hash:null},{id:7}]){
  assert.throws(()=>module.checkManifest({...manifest,entries:[{...manifest.entries[0],...patch}]}),/Invalid archived attachment/);
}
for(const patch of [{size:'4'},{hash:{toString:()=>hash}},{size:NaN}]){
  assert.throws(()=>module.checkManifest({...manifest,files:[{...manifest.files[0],...patch}]}),/Invalid archived content/);
}

const tampered=new Uint8Array(await archive.arrayBuffer());tampered[44]^=1;
await assert.rejects(()=>module.inspect(new Blob([tampered])),/manifest failed verification/u);
await assert.rejects(()=>module.inspect(new Blob([archive,new Uint8Array([9])])),/truncated or contains unexpected data/u);

console.log(JSON.stringify({status:'PASS',suite:'attachment-archive',format:'SDAT01',manifestIntegrity:true,trailingBytesRejected:true},null,2));
