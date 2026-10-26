import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash,webcrypto} from 'node:crypto';
import {createDriveHarness} from '../../helpers/drive-harness.mjs';
import {createFakeClock} from '../../helpers/fake-clock.mjs';
import {outputHandle} from '../../helpers/file-processing.mjs';
import {Sha256} from '../../../portable/sha256.js';
import {hashSnapshot,restoreHash} from '../../../portable/integrity-hash.js';
import {integritySegment} from '../../../portable/integrity-segments.js';
import {openIntegrityOutput} from '../../../portable/integrity-output.js';
import {passwordKey,transformEncrypted} from '../../../portable/stream-encryption.js';
import {openOutput} from '../../../portable/file-output.js';
import {createProcessingEngine} from '../../../portable/processing.js';
for(const file of ['internal','integrity-continuation'])vm.runInThisContext(fs.readFileSync('source/core/'+file+'.js','utf8'),{filename:'source/core/'+file+'.js'});
const module=globalThis[Symbol.for('studyDirector.internalModules.v1')].require('integrity-continuation',1),digest=blob=>blob.arrayBuffer().then(bytes=>createHash('sha256').update(new Uint8Array(bytes)).digest('hex'));
const size=2*1048576+177,bytes=new Uint8Array(size);for(let i=0;i<size;i++)bytes[i]=i%251;
const source=new Blob([bytes]),fingerprint=await digest(source),objectId='obj_'+'a'.repeat(32),cases=[];
function harness(blob=source,{encrypted=false,key=null,sourceBytes=source.size,plainHash=fingerprint,segments=1}={}){
  const handles=new Map(),reads=[],readSizes=[],held=new Set();let sequence=0,version='v1',durable=null,writeFailed=false,readFailed=false;
  const entry={objectId,kind:'attachment',storedChecksum:'',storedBytes:blob.size,sourceBytes,fingerprint:plainHash};
  const files={async stage(){const name='backup-'+(++sequence).toString(16).padStart(8,'0')+'-0000-0000-0000-000000000000',handle=await outputHandle();handles.set(name,handle);held.add(name);return {name,handle};},async resume(name){if(!handles.has(name))throw new Error('scratch missing');held.add(name);return {name,handle:handles.get(name)};},async release(name){held.delete(name);}};
  const engine=createProcessingEngine();const processing={scope:operation=>operation(),async run(type,data){if(!type.startsWith('integrity.'))return engine.run(type,data);if(data.output)data={...data,output:handles.get(data.output.name)};return integritySegment(type,data);}};
  const protection={async unprotect(){throw new Error('compatibility reader not needed');},async verifyFrame(data){if(!key)throw Object.assign(new Error('locked'),{code:'BACKUP_LOCKED'});return processing.run('integrity.decrypt',{...data,key});}};
  const readRange=async(_entry,{offset,length})=>{reads.push(offset);readSizes.push(length);if(readFailed)throw Object.assign(new Error('transport unavailable'),{code:'DRIVE_TIMEOUT'});return {blob:blob.slice(offset,offset+length),totalBytes:blob.size,version};};
  return {entry,reads,readSizes,held,handles,get durable(){return durable;},set durable(value){durable=value;},set version(value){version=value;},set writeFailed(value){writeFailed=value;},set readFailed(value){readFailed=value;},unlock(value){key=value;},async pass(options={}){
    if(!entry.storedChecksum)entry.storedChecksum=await digest(blob);
    const verifier=module.create({files,processing,protection,maxSegments:segments});
    return verifier.verify({entry,manifest:{encrypted},readRange,checkpoint:structuredClone(durable),onCheckpoint:async checkpoint=>{if(writeFailed)throw new Error('metadata unavailable');durable=structuredClone(checkpoint);},...options});
  }};
}
for(const length of [0,1,63,64,65,1024]){const hash=new Sha256();hash.update(bytes.slice(0,length));const copy=restoreHash(structuredClone(hashSnapshot(hash)));copy.update(bytes.slice(length,2048));assert.equal(copy.hex(),createHash('sha256').update(bytes.slice(0,2048)).digest('hex'));}
assert.throws(()=>restoreHash({version:1,length:1,state:Array(8).fill(0),tail:[]}));cases.push('hash snapshots round-trip at block and tail boundaries');
{
 const h=harness();let result;for(let i=0;i<5;i++){result=await h.pass();assert.equal(h.held.size,0);if(result.complete)break;assert.ok(h.durable.stored.offset>0);}
 assert.equal(result.complete,true);assert.deepEqual(h.reads.filter((_,i)=>h.readSizes[i]>64),[0,1048576,2097152]);assert.equal(h.durable.phase,'verified');cases.push('object download resumes across new verifier instances without repeating its verified prefix');
}
{
 const h=harness();await h.pass();const before=structuredClone(h.durable);h.readFailed=true;await assert.rejects(h.pass(),{code:'DRIVE_TIMEOUT'});assert.deepEqual(h.durable,before);assert.equal(h.held.size,0);h.readFailed=false;
 h.version='v2';await assert.rejects(h.pass(),{code:'REPOSITORY_OBJECT_CHANGED'});assert.equal(h.durable,null);await h.pass();assert.equal(h.durable.stored.offset,1048576);cases.push('unavailable reads preserve progress; changed source versions restart it');
}
{
 const h=harness();await h.pass();h.writeFailed=true;await assert.rejects(h.pass(),/metadata unavailable/);assert.equal(h.durable.stored.offset,1048576);h.writeFailed=false;await h.pass();await h.pass();assert.deepEqual(h.reads.filter((_,i)=>h.readSizes[i]>64),[0,1048576,1048576,2097152]);assert.equal(h.held.size,0);cases.push('a failed checkpoint commit safely truncates and repeats only the uncommitted segment');
}
{
 const h=harness();await h.pass();h.handles.delete(h.durable.stored.name);await assert.rejects(h.pass(),/scratch missing/);assert.equal(h.durable,null);await h.pass();assert.equal(h.durable.stored.offset,1048576);cases.push('missing scratch data clears only its continuation and retries');
}
{
 const corrupt=new Blob([new Uint8Array([255]),source.slice(1)]),h=harness(corrupt,{segments:8});h.entry.storedChecksum=fingerprint;await assert.rejects(h.pass(),{code:'REPOSITORY_INTEGRITY_CORRUPT'});assert.equal(h.held.size,0);cases.push('only a completed stored checksum mismatch proves corruption');
}
{
 const h=harness();await h.pass();const checkpoint=structuredClone(h.durable),handle=h.handles.get(checkpoint.stored.name),original=handle.createSyncAccessHandle;
 handle.createSyncAccessHandle=async()=>{const writer=await original();return {...writer,write(bytes,options){writer.write(bytes.slice(0,128),options);throw new Error('scratch write failed');}};};
 await assert.rejects(h.pass(),/scratch write failed/);assert.deepEqual(h.durable,checkpoint);assert.equal(await digest(await handle.getFile()),await digest(source.slice(0,1048576)),'writer failure must preserve the committed prefix');handle.createSyncAccessHandle=original;await h.pass();await h.pass();assert.equal(h.durable.phase,'verified');cases.push('failed segment writes preserve the committed prefix');
}
{
 let closed=0,aborted=0;
 const sync={getFile:async()=>new Blob(),createSyncAccessHandle:async()=>({truncate(){throw new Error('initialize sync failed');},close(){closed++;}})};
 await assert.rejects(openIntegrityOutput(sync,0),/initialize sync failed/);assert.equal(closed,1);
 const asyncHandle={getFile:async()=>new Blob(),createWritable:async()=>({async truncate(){throw new Error('initialize async failed');},async abort(){aborted++;}})};
 await assert.rejects(openIntegrityOutput(asyncHandle,0),/initialize async failed/);assert.equal(aborted,1);
 cases.push('checkpoint initialization failures release sync handles and abort async writers');
}
{
 let committed=new Uint8Array(),failWrite=false,failClose=false,aborted=0;
 const handle={getFile:async()=>new Blob([committed]),async createWritable({keepExistingData}){
   let staged=keepExistingData?committed.slice():new Uint8Array(),position=0;
   return {async truncate(size){const next=new Uint8Array(size);next.set(staged.subarray(0,size));staged=next;},async seek(offset){position=offset;},async write(chunk){const next=new Uint8Array(Math.max(staged.length,position+chunk.length));next.set(staged);next.set(chunk,position);staged=next;position+=chunk.length;if(failWrite)throw new Error('async segment write failed');},async close(){if(failClose)throw new Error('async segment commit failed');committed=staged;},async abort(){aborted++;}};
 }};
 const first=await integritySegment('integrity.append',{chunk:new Blob(['prefix']),offset:0,hash:null,output:handle});
 committed=new TextEncoder().encode('prefixuncommitted');failWrite=true;
 await assert.rejects(integritySegment('integrity.append',{chunk:new Blob(['tail']),offset:6,hash:first.hash,output:handle}),/async segment write failed/);assert.equal(aborted,1);assert.equal(await handle.getFile().then(file=>file.text()),'prefixuncommitted');
 failWrite=false;failClose=true;await assert.rejects(integritySegment('integrity.append',{chunk:new Blob(['tail']),offset:6,hash:first.hash,output:handle}),/async segment commit failed/);assert.equal(aborted,2);assert.equal(await handle.getFile().then(file=>file.text()),'prefixuncommitted');
 failClose=false;const complete=await integritySegment('integrity.append',{chunk:new Blob(['tail']),offset:6,hash:first.hash,output:handle});assert.equal(await handle.getFile().then(file=>file.text()),'prefixtail');assert.equal(complete.checksum,createHash('sha256').update('prefixtail').digest('hex'));
 cases.push('async checkpoint writes commit atomically, abort failures and discard uncommitted tails on retry');
}
const key=await passwordKey('long passphrase for integrity QA'),writer=await openOutput(await outputHandle());await transformEncrypted(source,key,writer);await writer.close();const encrypted=await writer.file();
{
 const h=harness(encrypted,{encrypted:true,segments:2});await h.pass();await assert.rejects(h.pass(),{code:'BACKUP_LOCKED'});assert.equal(h.durable.phase,'plain');const downloaded=h.readSizes.filter(size=>size>64).length;h.unlock(key);let result;
 for(let i=0;i<5;i++){result=await h.pass();if(result.complete)break;}
 assert.equal(result.complete,true);assert.equal(h.readSizes.filter(size=>size>64).length,downloaded);assert.equal(h.durable.plain.offset,source.size);assert.equal(h.durable.plain.frame,4);assert.equal(h.held.size,0);cases.push('locked encryption resumes at authenticated frames, including the terminal frame');
}
{
 const wrong=await passwordKey('wrong passphrase'),h=harness(encrypted,{encrypted:true,key:wrong,segments:8});await assert.rejects(h.pass(),{code:'BACKUP_AUTH_FAILED'});assert.equal(h.durable.phase,'plain');assert.equal(h.held.size,0);cases.push('a wrong password is unavailable verification, never confirmed corruption');
}
{
 const h=harness(source,{segments:8});h.entry.kind='note';const result=await h.pass();assert.equal(result.complete,true);assert.equal(await digest(result.opened.blob),fingerprint);assert.equal(h.held.size,1);await result.opened.release();assert.equal(h.held.size,0);cases.push('structured verification receives a leased file for its original semantic checks');
}
{
 const h=harness(encrypted,{encrypted:true,key,segments:2});h.entry.kind='note';let result;for(let i=0;i<8;i++){result=await h.pass();if(result.complete)break;}
 assert.ok(result.opened);assert.equal(await digest(result.opened.blob),fingerprint);assert.equal(h.held.size,2);await result.opened.release();assert.equal(h.held.size,0);cases.push('encrypted structured staging resumes and retains both leases through semantic verification');
}
{
 const h=harness(source,{segments:8});h.entry.kind='note';const verified=await h.pass();await verified.opened.release();const handle=h.handles.get(h.durable.stored.name),writer=await handle.createSyncAccessHandle();writer.write(new Uint8Array([255]),{at:0});writer.flush();writer.close();
 await assert.rejects(h.pass(),error=>!error.code&&/scratch verification failed|staging is damaged/.test(error.message));assert.equal(h.durable,null);cases.push('staging corruption restarts the read instead of quarantining repository data');
}
{
 const h=harness(encrypted,{encrypted:true,key,segments:3});await h.pass();assert.equal(h.durable.phase,'plain');h.version='v2';await assert.rejects(h.pass(),{code:'REPOSITORY_OBJECT_CHANGED'});assert.equal(h.durable,null);cases.push('plaintext continuation revalidates source version after a locked or interrupted interval');
}
for(const corruptAt of [100,encrypted.size-1]){
 const h=harness(encrypted,{encrypted:true,key,segments:3});await h.pass();const handle=h.handles.get(h.durable.stored.name),original=new Uint8Array(await(await handle.getFile()).slice(corruptAt,corruptAt+1).arrayBuffer()),writer=await handle.createSyncAccessHandle();writer.write(new Uint8Array([original[0]^255]),{at:corruptAt});writer.flush();writer.close();
 let failure;for(let i=0;i<5;i++){try{await h.pass();}catch(error){failure=error;break;}}assert.ok(failure&&!failure.code&&/staging is damaged/.test(failure.message));assert.equal(h.durable,null);let result;for(let i=0;i<8;i++){result=await h.pass();if(result.complete)break;}assert.equal(result.complete,true);cases.push('damaged cached '+(corruptAt===100?'ciphertext':'terminal tag')+' restarts with bounded range proofs');
}
{
 const bundle=fs.readFileSync('source/external/export-worker.js','utf8');
 let receive=()=>{};
 const handle=await outputHandle(),messages=[],context=vm.createContext({Blob,TextEncoder,TextDecoder,Uint8Array,Uint32Array,DataView,WeakMap,Map,Set,crypto:webcrypto,performance,navigator:{storage:{getDirectory:async()=>({getDirectoryHandle:async()=>({getFileHandle:async()=>handle})})}},self:{postMessage:value=>{messages.push(value);receive(value);}}});
 vm.runInContext(bundle,context,{filename:'source/external/export-worker.js'});
 // Browser event dispatch ignores return values; completion is the correlated reply.
 const request=message=>new Promise(resolve=>{receive=value=>{if(value.id===message.data.id&&('value' in value||'error' in value))resolve(value);};context.self.onmessage(message);});
 await request({data:{id:1,type:'integrity.append',data:{chunk:new Blob(['worker segment']),offset:0,hash:null,output:{kind:'opfs',name:'backup-00000000-0000-0000-0000-000000000001',directory:'@@SD_BACKUP_FILES_OPFS_DIRECTORY@@'}}}});assert.equal(messages.at(-1).value?.offset,14,JSON.stringify(messages.at(-1).error));
 await request({data:{id:2,type:'checksum',data:{value:'existing worker operation'}}});assert.equal(messages.at(-1).value,createHash('sha256').update('existing worker operation').digest('hex'));cases.push('the one worker build runs integrity segments and every other operation');
}
// Compose the real Drive range transport, continuation/hash implementation and
// shared scheduler. A slow segment exceeding the pass allowance must be saved
// before yielding, then resumed without redownloading that completed segment.
{
 const clock=createFakeClock(),drive=createDriveHarness({clock});await drive.provider.prepare();await drive.provider.authorize();
 const h=harness(),ref=await drive.provider.repository.upload({kind:'object',id:objectId,name:objectId+'.sdobject',blob:source,size:source.size,digest:fingerprint,exportedAt:'2026-09-01T00:00:00.000Z',appVersion:'QA_FIXTURE'});
 for(const file of ['internal','operation-lifecycle','repository-background'])vm.runInContext(fs.readFileSync('source/core/'+file+'.js','utf8'),drive.context);
 const registry=drive.context[Symbol.for('studyDirector.internalModules.v1')],bg=registry.require('repository-background',1,Object.freeze({lifecycle:registry.require('operation-lifecycle',1)})).createCoordinator(Object.freeze({target:'google-drive',environment:Object.freeze({AbortController,now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout})}));
 drive.state.rangeChunkDelayMs=35000;const readOffsets=[];let completed=false,passes=0,transferring=0;
 const scheduler=bg.createIntegrityScheduler(Object.freeze({budgetMs:120000,budgetCode:'TEST_BUDGET',budgetMessage:'budget',preemptCode:'TEST_PREEMPT',preemptMessage:'preempt',capture:error=>assert.fail(error),isAvailable:()=>true,isUnsafe:()=>false,readTarget:async()=>({scanId:'slow-proof',partial:structuredClone(h.durable)}),writeResult:async result=>{if(result.complete)completed=true;},yieldTask:async()=>{},execute:async({signal,checkpoint})=>{
  try{const result=await h.pass({signal,readRange:async(_entry,range)=>{if(range.length>64)readOffsets.push(range.offset);transferring++;try{return await drive.provider.repository.download(ref,range);}finally{transferring--;}},onCheckpoint:async value=>{h.durable=structuredClone(value);checkpoint({scanId:'slow-proof',partial:value});}});return {...result,status:result.complete?'completed':'yielded'};}
  catch(error){if(error.code==='TEST_BUDGET')return {status:'yielded',reason:'budget',complete:false};throw error;}
 }}));
 for(;passes<8&&!completed;passes++){
  let outcome;const before=h.durable?.stored?.offset||0;scheduler.run().then(value=>{outcome=value;});
  // Fake time moves only while the simulated Drive download waits on it. Real
  // hashing and scratch writes finish on their own schedule, so a loaded
  // machine cannot let fake deadlines outrun them.
  for(let elapsed=0,turns=0;!outcome&&elapsed<500000&&turns<1000000;turns++){await new Promise(resolve=>setImmediate(resolve));if(!outcome&&transferring){await clock.advance(1000);elapsed+=1000;}else await clock.advance(0);}
  assert.ok(outcome);assert.ok(completed||h.durable.stored.offset>before,'each healthy slow pass must persist a useful segment');assert.equal(h.held.size,0);
 }
 assert.equal(completed,true);assert.ok(passes>1);assert.deepEqual(readOffsets,[0,1048576,2097152]);assert.equal(h.durable.phase,'verified');assert.equal(bg.status().active.length,0);
 await drive.provider.disconnect();cases.push('slow Drive transport persists each segment before cooperative yield and completes without repeated prefixes');
}
console.log(JSON.stringify({status:'PASS',suite:'integrity-continuation',cases},null,2));
