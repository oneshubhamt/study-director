import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Sha256,hashBlob} from '../../../portable/sha256.ts';

const deterministicBytes=size=>Uint8Array.from({length:size},(_,index)=>(index*131+size*17+29)&255);
for(const size of [0,1,55,56,63,64,65,1000,1048581]){
  const bytes=deterministicBytes(size),expected=createHash('sha256').update(bytes).digest('hex');
  for(const step of [1,17,64,999]){
    const hash=new Sha256();
    for(let i=0;i<size;i+=step)hash.update(bytes.subarray(i,i+step));
    assert.equal(hash.hex(),expected);
    assert.throws(()=>hash.update(bytes),/finished/);
  }
  assert.equal(await hashBlob(new Blob([bytes])),expected);
}
const megabyte=deterministicBytes(1048576),expected=createHash('sha256');
for(let i=0;i<40;i++)expected.update(megabyte);
const bounded={size:40*1048576,arrayBuffer(){throw Error('must not buffer file');},slice(from,to){assert.ok(to-from<=1048576);return new Blob([megabyte]);}};
assert.equal(await hashBlob(bounded),expected.digest('hex'));
console.log(JSON.stringify({status:'PASS',vectors:9,chunkSteps:[1,17,64,999],boundedMiB:40},null,2));
