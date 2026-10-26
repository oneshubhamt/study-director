import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createProcessingEngine} from '../../../portable/processing.ts';
import {processingRequest} from '../../../portable/request-decoder.ts';
import {integrityRequest} from '../../../portable/integrity-segments.ts';
import {Sha256} from '../../../portable/sha256.ts';
import {hashSnapshot,restoreHash} from '../../../portable/integrity-hash.ts';
const engine=createProcessingEngine();
const dispatch=(type,input)=>{const request=processingRequest(type,input);return engine.run(request.type,request.data);};
for(const size of [0,1,55,56,63,64,65,127,128,129,1048577]){
 const bytes=Uint8Array.from({length:size},(_,i)=>i%251),expected=createHash('sha256').update(bytes).digest('hex');
 const hash=new Sha256();for(let at=0;at<size;at+=37)hash.update(bytes.subarray(at,at+37));
 assert.equal(restoreHash(hashSnapshot(hash)).hex(),expected);assert.equal(await dispatch('file.hash',{file:new Blob([bytes])}),expected);
 const split=Math.floor(size/2),checkpoint=hashSnapshot(new Sha256().update(bytes.subarray(0,split))),resumed=restoreHash(checkpoint);resumed.update(bytes.subarray(split));assert.equal(resumed.hex(),expected);
}
const checkpoint=hashSnapshot(new Sha256().update(new Uint8Array([1,2,3])));
for(const invalid of [{...checkpoint,length:-1},{...checkpoint,state:[1]},{...checkpoint,tail:[256,2,3]},{...checkpoint,length:4}])assert.throws(()=>integrityRequest('integrity.digest',{hash:invalid}),/checkpoint/);
assert.equal(await dispatch('checksum',{value:'abc'}),createHash('sha256').update('abc').digest('hex'));
assert.deepEqual(await dispatch('parseBlob',{file:new Blob(['{"answer":42}']),maxBytes:100}),{answer:42});
await assert.rejects(dispatch('parseBlob',{file:new Blob(['{}']),maxBytes:1}),/size limit/);
for(const [type,input] of [['file.hash',{file:'bytes'}],['parseBlob',{file:new Blob(),maxBytes:NaN}],['encode.write',{id:'1',line:'{}'}],['zip',{files:[{name:'x',blob:'bad'}],date:0}],['markdown',{doc:{content:[null]},paths:{}}],['unknown',{}]])assert.throws(()=>processingRequest(type,input));
for(const gzip of [false,true]){
 const id=await dispatch('encode.open',{gzip,maxBytes:1024});
 await assert.rejects(dispatch('decode.close',{id}),/reader expired/);
 await dispatch('encode.write',{id,line:'{"value":1}\n'});await dispatch('encode.write',{id,line:'{"value":2}\n'});
 const file=await dispatch('encode.finish',{id});await assert.rejects(dispatch('encode.write',{id,line:'x'}),/writer expired/);
 const reader=await dispatch('decode.open',{file,gzip,maxBytes:1024,maxLineBytes:100});
 await assert.rejects(dispatch('encode.close',{id:reader}),/writer expired/);
 for(const value of [1,2]){const next=await dispatch('decode.next',{id:reader});assert.equal(next.done,false);assert.deepEqual(next.value.value,{value});}
 assert.equal((await dispatch('decode.next',{id:reader})).done,true);await assert.rejects(dispatch('decode.next',{id:reader}),/reader expired/);
}
const id=await dispatch('decode.open',{file:new Blob(['{"large":"payload"}']),maxBytes:100,maxLineBytes:3});
await assert.rejects(dispatch('decode.next',{id}),/oversized/);await dispatch('decode.close',{id});
console.log(JSON.stringify({status:'PASS',suite:'processing-contracts',checkpointBoundarySizes:11,transportRejections:true,sessionIsolation:true}));
