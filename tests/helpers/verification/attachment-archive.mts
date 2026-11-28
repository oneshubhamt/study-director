import {method,registeredExports} from '../registered-exports.mts';
import {readScript} from '../../../build/source-script.mts';
import assert from 'node:assert/strict';
import vm from 'node:vm';

for(const file of ['source/core/internal.ts','source/core/attachments.ts'])vm.runInThisContext(readScript(file),{filename:file});
const exported=registeredExports(globalThis,'attachments');
assert.ok(exported&&typeof exported==='object'&&'limits' in exported);
const limits=exported.limits;
assert.ok(limits&&typeof limits==='object'&&'maxImage' in limits&&'maxPdfAudio' in limits);
const module={limits,checkManifest:method(exported,'checkManifest'),inspect:async(file:Blob)=>method(exported,'inspect')(file)};
const payload=new Blob([new Uint8Array([1,2,3,4])],{type:'image/png'});
const hash='a'.repeat(64),id='img-abcdefghijklmnopqrst';
const manifest={format:'study-director.attachments',version:1,entries:[{id,name:'qa.png',type:'image/png',size:payload.size,hash,library:true}],files:[{hash,size:payload.size}]};
const metadata=new TextEncoder().encode(JSON.stringify(manifest));
const header=new Uint8Array(44);header.set(new TextEncoder().encode('SDAT01\r\n'));new DataView(header.buffer).setUint32(8,metadata.length,true);header.set(new Uint8Array(await crypto.subtle.digest('SHA-256',metadata)),12);
const archive=new Blob([header,metadata,payload],{type:'application/octet-stream'});
const parsed=await module.inspect(archive);
assert.ok(parsed&&typeof parsed==='object'&&'manifest' in parsed&&'contents' in parsed);
const parsedManifest=parsed.manifest;
assert.ok(parsedManifest&&typeof parsedManifest==='object'&&'version' in parsedManifest&&'entries' in parsedManifest);
assert.equal(parsedManifest.version,1);
assert.ok(Array.isArray(parsedManifest.entries));
const entry:unknown=parsedManifest.entries[0];
assert.ok(entry&&typeof entry==='object'&&'id' in entry);
assert.equal(entry.id,id);
assert.ok(parsed.contents instanceof Map);
const bytes:unknown=parsed.contents.get(hash);
assert.ok(bytes instanceof Blob);
assert.equal(bytes.size,payload.size);

assert.equal(module.limits.maxImage,12*1024*1024,'Image attachments must use the 12 MiB stored-image ceiling.');
assert.equal(module.limits.maxPdfAudio,2*1024*1024*1024,'PDF/audio attachments must use the 2 GiB per-file ceiling.');
assert.throws(()=>module.checkManifest({format:'study-director.attachments',version:1,entries:[{id,name:'too-large.png',type:'image/png',size:12*1024*1024+1,hash,library:true}],files:[{hash,size:12*1024*1024+1}]}),/Invalid archived attachment/u);
assert.throws(()=>module.checkManifest({format:'study-director.attachments',version:1,entries:[{id:'att-abcdefghijklmnopqrst',name:'too-large.pdf',type:'application/pdf',size:2*1024*1024*1024+1,hash,library:true}],files:[{hash,size:2*1024*1024*1024+1}]}),/Invalid archived content/u);

// Manifest decoding rejects malformed transport values without normalizing them
// into identities or sizes that could point at a different attachment.
assert.equal(module.checkManifest(manifest),manifest,'validated manifests retain their identity');
for(const patch of [{size:'4'},{library:1},{type:null},{hash:null},{id:7}]){
  assert.throws(()=>module.checkManifest({...manifest,entries:[{...manifest.entries[0]!,...patch}]}),/Invalid archived attachment/);
}
for(const patch of [{size:'4'},{hash:{toString:()=>hash}},{size:NaN}]){
  assert.throws(()=>module.checkManifest({...manifest,files:[{...manifest.files[0]!,...patch}]}),/Invalid archived content/);
}

// Keep the altered manifest valid JSON and the same length, so the digest
// check alone distinguishes the wrong historical metadata from valid input.
const wrongMetadata=new TextEncoder().encode(JSON.stringify({...manifest,entries:[{...manifest.entries[0]!,name:'qb.png'}]}));
assert.equal(wrongMetadata.length,metadata.length);
const tampered=new Uint8Array(await archive.arrayBuffer());tampered.set(wrongMetadata,44);
await assert.rejects(()=>module.inspect(new Blob([tampered])),/manifest failed verification/u);
await assert.rejects(()=>module.inspect(new Blob([archive,new Uint8Array([9])])),/truncated or contains unexpected data/u);

console.log(JSON.stringify({status:'PASS',suite:'attachment-archive',format:'SDAT01',manifestIntegrity:true,trailingBytesRejected:true},null,2));
