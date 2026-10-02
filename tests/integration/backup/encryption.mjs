import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {pbkdf2Sync,createDecipheriv} from 'node:crypto';
import {FRAME_BYTES,HEADER_BYTES,passwordKey,createPasswordVerifier,verifyPasswordVerifier,streamEncryptionInfo} from '../../../portable/stream-encryption.js';
import {createProcessingEngine,outputHandle} from '../../helpers/file-processing.mjs';
import {openOutput} from '../../../portable/file-output.js';

const password='  密码 strong passphrase 🌱  ',key=await passwordKey(password),plain=new Blob(['WG1:private study data',new Uint8Array(4096)]),engine=createProcessingEngine();
assert.equal(key.extractable,false);
const verifier=await createPasswordVerifier(key),againVerifier=await createPasswordVerifier(key);
assert.equal(verifier.size,64);assert.notDeepEqual(new Uint8Array(await verifier.arrayBuffer()),new Uint8Array(await againVerifier.arrayBuffer()),'fresh verifier salt per policy');
assert.equal(await verifyPasswordVerifier(verifier,key),true);
await assert.rejects(verifyPasswordVerifier(verifier,await passwordKey('wrong password')),{code:'BACKUP_AUTH_FAILED'});
const verifierBytes=new Uint8Array(await verifier.arrayBuffer());verifierBytes[verifierBytes.length-1]^=1;
await assert.rejects(verifyPasswordVerifier(new Blob([verifierBytes]),key),{code:'BACKUP_AUTH_FAILED'});
const copiedReceipt=await engine.run('file.copy',{file:plain,proof:true});assert.equal(copiedReceipt.file instanceof Blob,true);assert.match(copiedReceipt.hash,/^[a-f0-9]{64}$/u);assert.equal(copiedReceipt.hash,await engine.run('file.hash',{file:copiedReceipt.file}),'staged-copy receipt must describe the exact output bytes without a second source read');
const sealedReceipt=await engine.run('crypto.stream.encrypt',{file:plain,key,proof:true});assert.equal(sealedReceipt.file instanceof Blob,true);assert.match(sealedReceipt.hash,/^[a-f0-9]{64}$/u);assert.equal(sealedReceipt.hash,await engine.run('file.hash',{file:sealedReceipt.file}),'encrypted-output receipt must describe the exact ciphertext bytes');
const small=await engine.run('crypto.stream.encrypt',{file:plain,key}),smallAgain=await engine.run('crypto.stream.encrypt',{file:plain,key});
assert.equal((await streamEncryptionInfo(small)).version,2);assert.notDeepEqual(new Uint8Array(await small.arrayBuffer()),new Uint8Array(await smallAgain.arrayBuffer()),'fresh SDENC02 salt/nonce prefix per export');
assert.equal(await (await engine.run('crypto.stream.decrypt',{file:small,key})).text(),await plain.text());
await assert.rejects(engine.run('crypto.stream.decrypt',{file:small,key:await passwordKey(password.trim())}),{code:'BACKUP_AUTH_FAILED'});
assert.equal(await streamEncryptionInfo(plain),null);
// Worker-owned OPFS resolution: the worker receives only a clone-safe opaque name and opens its own handle.
{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator'),scratch=await outputHandle();let seenDirectory='',seenName='';
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{storage:{getDirectory:async()=>({getDirectoryHandle:async name=>{seenDirectory=name;return {getFileHandle:async fileName=>{seenName=fileName;return scratch;}};}})}}});
  try{
    const name='backup-00000000-0000-4000-8000-000000000001',writer=await openOutput({kind:'opfs',name});await writer.write(new Uint8Array([1,2,3]));await writer.close();
    assert.equal(seenDirectory,'@@SD_BACKUP_FILES_OPFS_DIRECTORY@@');assert.equal(seenName,name);assert.deepEqual(new Uint8Array(await (await writer.file()).arrayBuffer()),new Uint8Array([1,2,3]));
    await assert.rejects(openOutput({kind:'opfs',name:'unsafe'}),/identity is invalid/u);
  }finally{if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;}
}
for(const file of ['internal','operation-lifecycle','exports'])vm.runInThisContext(fs.readFileSync(`source/core/${file}.js`,'utf8'));
const module=globalThis[Symbol.for('studyDirector.internalModules.v1')].require('exports',1,Object.freeze({lifecycle:globalThis[Symbol.for('studyDirector.internalModules.v1')].require('operation-lifecycle',1)}));
let saved=null,state,answers=[],choice='unlock',writes=0,readError=false;
const processing={run:engine.run,check:()=>{},job:fn=>fn()};
const storage={read:async()=>{if(readError)throw new Error('IDB unavailable');return saved;},write:async(k,v)=>{saved=v;writes++;},remove:async()=>{saved=null;writes++;}};
const interactions={input:async()=>answers.shift()??null,choose:async()=>choice,confirm:async()=>true};
const factory=()=>module.createProtection({processing,storage,interactions,settingKey:'backupProtection',onState:s=>{state=s;}});
const protection=factory();answers=[{value:password}];await protection.manage();assert.equal(state.unlocked,true);assert.equal(writes,1);assert.equal(saved.version,2);assert.equal(saved.verifier instanceof Blob,true);assert.deepEqual(Object.keys(saved).sort(),['id','verifier','version']);
const exported=await protection.protect({blob:plain},{interactive:false});assert.equal(exported.encrypted,true);
assert.equal(await (await protection.unprotect(exported.blob,{interactive:false})).blob.text(),await plain.text());
const restarted=factory();await restarted.refresh();assert.equal(state.unlocked,false);await assert.rejects(restarted.protect({blob:plain},{interactive:false}),{code:'BACKUP_LOCKED'});assert.equal(writes,1);
answers=[{value:'wrong'},{value:password}];await restarted.manage();assert.equal(state.unlocked,true);assert.equal(answers.length,0);assert.equal(writes,1);
restarted.lock();answers=[null];await assert.rejects(restarted.protect({blob:plain}),{name:'AbortError'});
let resolvePassword,asked;const originalInput=interactions.input;const waiting=new Promise(resolve=>{asked=resolve;});
interactions.input=()=>{asked();return new Promise(resolve=>{resolvePassword=resolve;});};
const interruptedUnlock=restarted.manage();await waiting;restarted.lock();resolvePassword({value:password});await assert.rejects(interruptedUnlock,{name:'AbortError'});assert.equal(state.unlocked,false);interactions.input=originalInput;
readError=true;await assert.rejects(restarted.protect({blob:plain},{interactive:false}),/IDB unavailable/);readError=false;
// Remote settings changes invalidate retained keys; no fallback to plaintext.
saved={...saved,id:'changed-in-other-tab'};await assert.rejects(protection.protect({blob:plain},{interactive:false}),{code:'BACKUP_LOCKED'});
choice='disable';answers=[{value:password}];await protection.manage();await protection.manage();assert.equal(saved,null);assert.equal((await protection.protect({blob:plain})).encrypted,false);
console.log(JSON.stringify({status:'PASS',suite:'encryption',checks:['Unicode and whitespace password','independent OpenSSL decryption','fresh salt and IV','authenticated header/cipher/tag','wrong password','truncated/trailing data','32 MiB admission','no persisted key/password','restart locked','retry','cancel','storage failure closed','cross-tab invalidation','explicit disabling','copy/encryption output receipts']},null,2));

// Streaming envelope: >32 MiB, independent OpenSSL frame authentication, and
// no whole-file reads. The production transform writes a real disk-backed Blob.
const sourceHandle=await outputHandle(),sourceWriter=await openOutput(sourceHandle);
for(let index=0;index<40;index++){const block=new Uint8Array(FRAME_BYTES);block.fill(index);await sourceWriter.write(block);}
await sourceWriter.close();const large=await sourceHandle.getFile();
let largestRead=0;const originalSlice=large.slice.bind(large);
Object.defineProperty(large,'arrayBuffer',{value:()=>{throw new Error('Whole-file buffering is forbidden.');}});
Object.defineProperty(large,'slice',{value:(start,end,type)=>{largestRead=Math.max(largestRead,end-start);return originalSlice(start,end,type);}});
const sealed=await engine.run('crypto.stream.encrypt',{file:large,key});
assert.equal((await streamEncryptionInfo(sealed)).size,40*FRAME_BYTES);
const restored=await engine.run('crypto.stream.decrypt',{file:sealed,key});
assert.equal(await engine.run('equalFiles',{left:large,right:restored}),true);
assert.ok(largestRead<=FRAME_BYTES,'attachment reads stay bounded to one frame');
const header=Buffer.from(await sealed.slice(0,HEADER_BYTES).arrayBuffer());
const streamKey=pbkdf2Sync(password,header.subarray(20,36),600000,32,'sha256');
for(const index of [0,1,39,40]){
  const terminal=index===40,length=terminal?0:FRAME_BYTES,offset=HEADER_BYTES+index*(FRAME_BYTES+16);
  const frame=Buffer.from(await sealed.slice(offset,offset+length+16).arrayBuffer()),iv=Buffer.alloc(12),aad=Buffer.alloc(HEADER_BYTES+13);
  header.copy(iv,0,36,40);iv.writeBigUInt64BE(BigInt(index),4);header.copy(aad);aad.writeBigUInt64BE(BigInt(index),HEADER_BYTES);aad.writeUInt32BE(length,HEADER_BYTES+8);aad[HEADER_BYTES+12]=terminal?1:0;
  const native=createDecipheriv('aes-256-gcm',streamKey,iv);native.setAAD(aad);native.setAuthTag(frame.subarray(-16));
  const decoded=Buffer.concat([native.update(frame.subarray(0,-16)),native.final()]);
  assert.equal(decoded.length,length);if(length){assert.equal(decoded[0],index);assert.equal(decoded.at(-1),index);}
}
const short=await engine.run('crypto.stream.encrypt',{file:new Blob([new Uint8Array(FRAME_BYTES*2+7)]),key});
const shortBytes=new Uint8Array(await short.arrayBuffer());
for(const offset of [20,36,HEADER_BYTES,HEADER_BYTES+FRAME_BYTES+16,short.size-1]){
  const changed=shortBytes.slice();changed[offset]^=1;
  await assert.rejects(engine.run('crypto.stream.decrypt',{file:new Blob([changed]),key}),{code:'BACKUP_AUTH_FAILED'});
}
const reordered=shortBytes.slice(),frameSize=FRAME_BYTES+16;
reordered.set(shortBytes.slice(HEADER_BYTES+frameSize,HEADER_BYTES+2*frameSize),HEADER_BYTES);reordered.set(shortBytes.slice(HEADER_BYTES,HEADER_BYTES+frameSize),HEADER_BYTES+frameSize);
await assert.rejects(engine.run('crypto.stream.decrypt',{file:new Blob([reordered]),key}),{code:'BACKUP_AUTH_FAILED'});
for(const file of [short.slice(0,-1),short.slice(0,-16),new Blob([short,'x'])])await assert.rejects(engine.run('crypto.stream.decrypt',{file,key}));
await assert.rejects(engine.run('crypto.stream.decrypt',{file:short,key:await passwordKey('wrong password')}),{code:'BACKUP_AUTH_FAILED'});
console.log(JSON.stringify({status:'PASS',streaming:{bytes:large.size,maxRead:largestRead,independentFrames:4,reorder:true,corruption:true,terminal:true,wrongPassword:true}},null,2));
