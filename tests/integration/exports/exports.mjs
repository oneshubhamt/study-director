import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {Worker} from 'node:worker_threads';
import {createProcessingEngine} from '../../../portable/processing.js';
import {nextTurn} from '../../helpers/async-tools.mjs';

for(const file of ['internal','operation-lifecycle','exports']){const filename=`source/core/${file}.js`;vm.runInThisContext(fs.readFileSync(filename,'utf8'),{filename});}
const module=globalThis[Symbol.for('studyDirector.internalModules.v1')].require('exports',1,Object.freeze({lifecycle:globalThis[Symbol.for('studyDirector.internalModules.v1')].require('operation-lifecycle',1)}));
const workerSource=fs.readFileSync('source/external/export-worker.js','utf8');
let alive=0,created=0,downloads=0,failStart=false,hold=false,lastWorker=null;const workerTypes=[];
const fakeWindow={URL:{createObjectURL:()=> 'blob:test',revokeObjectURL:()=>{}},setTimeout:fn=>fn()};
const document={body:{appendChild:()=>{}},createElement:()=>({click:()=>{downloads++;},remove:()=>{}})};
function createWorker(){
  if(failStart)throw new Error('Worker startup unavailable');
  const native=new Worker(`const {parentPort}=require('node:worker_threads');global.self=global;self.postMessage=value=>parentPort.postMessage(value);${workerSource};parentPort.on('message',data=>self.onmessage({data}));`,{eval:true});
  alive++;created++;let stopped=false;
  const wrapper={postMessage:data=>{workerTypes.push(data.type);if(!hold)native.postMessage(data);},terminate:()=>{if(!stopped){stopped=true;alive--;void native.terminate();}}};
  native.on('message',data=>wrapper.onmessage?.({data}));native.on('error',error=>wrapper.onerror?.({message:error.message,preventDefault(){}}));lastWorker=wrapper;return wrapper;
}
const fileStates=[];const coordinator=module.createCoordinator({createWorker,window:fakeWindow,document,onState:state=>fileStates.push(state)});
const engine=createProcessingEngine();
const order=[];let release;const firstJob=coordinator.job(async()=>{order.push('first');await new Promise(resolve=>release=resolve);});const secondJob=coordinator.job(async()=>order.push('second'),{wait:true});
assert.equal(coordinator.status().busy,true);assert.equal(coordinator.status().fileBusy,false,'managed work must not claim the standalone file controls');
release();await Promise.all([firstJob,secondJob]);assert.deepEqual(order,['first','second']);
let releaseFile;const fileJob=coordinator.job(async()=>new Promise(resolve=>{releaseFile=resolve;}),{surface:'file'});
assert.equal(coordinator.status().fileBusy,true,'standalone work owns the file processing controls');releaseFile();await fileJob;
assert.equal(coordinator.status().fileBusy,false,'standalone controls must clear on completion');
const png=new Blob([new Uint8Array([137,80,78,71,1,2,3])],{type:'image/png'});
const scenarios=[];
await coordinator.job(async()=>{
  const firstCreated=created;
  const checksumProgress=[];assert.equal(await coordinator.run('checksum',{value:png},{onProgress:progress=>checksumProgress.push(progress)}),await engine.run('checksum',{value:png}));assert.ok(checksumProgress.length>0&&checksumProgress.at(-1).loaded===png.size,'blob checksum verification must expose real per-call progress');
  const body={seq:0,entityType:'areaNote',items:[{key:'Ethics',text:'नमस्ते 🌱'}],algorithm:'sha256',maxLineBytes:65536};
  const chunk=await coordinator.run('chunk',body);assert.deepEqual(chunk,await engine.run('chunk',body));
  const writer=await coordinator.run('encode.open',{gzip:true,maxBytes:100000});
  await coordinator.run('encode.write',{id:writer,line:chunk.line+'\n'});
  const blob=await coordinator.run('encode.finish',{id:writer});
  const reader=await coordinator.run('decode.open',{file:blob,gzip:true,maxBytes:100000,maxLineBytes:65536});
  const first=await coordinator.run('decode.next',{id:reader});assert.deepEqual(first.value.value,JSON.parse(chunk.line));
  assert.equal((await coordinator.run('decode.next',{id:reader})).done,true);
  const markup=await coordinator.run('markdown',{doc:{type:'Doc',content:[{type:'Paragraph',content:[{type:'Text',param:'bold',marks:{Strong:true}}]},{type:'SDImage',param:{assetId:'image',alt:'Diagram'}}]},text:'',paths:{image:'assets/a.png'}});
  assert.equal(markup,'**bold**\n\n![Diagram](assets/a.png)\n','blocks are kept apart by a blank line');
  const zip=await coordinator.run('zip',{files:[{name:'a.md',blob:new Blob([markup])},{name:'assets/a.png',blob:png}],date:'2026-09-06T00:00:00Z'});
  assert.equal(zip.type,'application/zip');assert.equal(new DataView(await zip.slice(0,4).arrayBuffer()).getUint32(0,true),0x04034b50);
  assert.equal(created,firstCreated+1,'one worker serves a complete job');
  await assert.rejects(coordinator.job(async()=>{}),/Another file operation/);
});
assert.equal(alive,0);assert.equal(coordinator.status().busy,false);scenarios.push('real worker round-trip, ZIP, Markdown, Unicode, shared lifetime, exclusive jobs');

let pickerCalled=false,writes=0,closed=0,aborted=0,stored=null;
const handle={name:'Chosen.sdbackup',createWritable:async()=>({write:async blob=>{writes++;stored=blob;},close:async()=>{closed++;},abort:async()=>{aborted++;}}),getFile:async()=>stored};
fakeWindow.showSaveFilePicker=()=>{pickerCalled=true;return Promise.resolve(handle);};
const picked=coordinator.chooseSave('test.sdbackup',{'application/octet-stream':['.sdbackup']});assert.equal(pickerCalled,true,'picker is invoked before yielding');
workerTypes.length=0;const result=await coordinator.save({blob:png,filename:'test.sdbackup'},await picked);assert.equal(result.status,'saved');assert.equal(result.filename,'Chosen.sdbackup');assert.equal(writes,1);assert.equal(closed,1);assert.equal(alive,0);assert.equal(workerTypes.includes('equalFiles'),true,'unknown file provenance must retain exact byte-for-byte save verification');

// Staged outputs from our own copy/encryption stream are plain scratch files.
// Save As compares the reopened destination with them byte for byte, which is
// bound by reading speed, and rejects any difference.
let proofStage=0;const proofNames=new WeakMap(),proofWorkerTypes=[],proofWorkerOutputs=[];
const proofFiles={stage:async()=>({name:'staged-'+(++proofStage),directory:'scratch~prof_ben_mve00000_abcdef01',handle:{}}),bind:(blob,name)=>{proofNames.set(blob,name);return blob;},nameOf:blob=>proofNames.get(blob)||null,release:async()=>true,collect:async()=>true};
function createProofWorker(){let stopped=false;const wrapper={terminate:()=>{stopped=true;},postMessage:message=>{proofWorkerTypes.push(message.type);structuredClone(message);if(message.data?.output)proofWorkerOutputs.push(message.data.output);queueMicrotask(async()=>{if(stopped)return;try{let value;if(message.type==='file.copy'){assert.equal(message.data.proof,undefined,'staged copies carry no hash receipt');value=new Blob([message.data.file],{type:message.data.file.type});}else value=await engine.run(message.type,message.data);wrapper.onmessage?.({data:{id:message.id,value}});}catch(error){wrapper.onmessage?.({data:{id:message.id,error:{name:error.name,message:error.message,code:error.code}}});}});}};return wrapper;}
const proofCoordinator=module.createCoordinator({createWorker:createProofWorker,window:fakeWindow,document,files:proofFiles}),proofed=await proofCoordinator.run('file.copy',{file:png});
assert.deepEqual(proofWorkerOutputs,[{kind:'opfs',name:'staged-1',directory:'scratch~prof_ben_mve00000_abcdef01'}],'worker file operations must receive only an opaque scratch identity and the profile folder it lives in');
let proofStored=null;const proofHandle={name:'Proof.sdbackup',async createWritable(){const parts=[];return {write:async part=>parts.push(part),close:async()=>{proofStored=new Blob(parts);},abort:async()=>{}};},getFile:async()=>proofStored};
proofWorkerTypes.length=0;const progress=[];const proofSaved=await proofCoordinator.save({blob:proofed,filename:'proof.sdbackup'},proofHandle,{onProgress:value=>progress.push(value)});assert.equal(proofSaved.status,'saved');assert.deepEqual(proofWorkerTypes,['equalFiles'],'Save As verifies by byte comparison alone');assert.ok(progress.some(value=>value.loaded===png.size&&value.total===png.size),'writing and checking report progress');
const goodProofStored=proofStored;proofHandle.getFile=async()=>new Blob([goodProofStored,new Uint8Array([1])]);await assert.rejects(proofCoordinator.save({blob:proofed,filename:'proof.sdbackup'},proofHandle),error=>error.fileWritten&&/did not match/.test(error.message),'a changed reopened destination is rejected');
const flipped=new Uint8Array(await goodProofStored.arrayBuffer());flipped[flipped.length-1]^=1;proofHandle.getFile=async()=>new Blob([flipped]);await assert.rejects(proofCoordinator.save({blob:proofed,filename:'proof.sdbackup'},proofHandle),error=>error.fileWritten&&/did not match/.test(error.message),'one changed byte is rejected');
proofHandle.getFile=async()=>proofStored;scenarios.push('Save As compares the saved file with the staged one and rejects any difference');
handle.getFile=async()=>new Blob([new Uint8Array(png.size)]);
await assert.rejects(coordinator.save({blob:png,filename:'test'},handle),error=>error.fileWritten&&/did not match/.test(error.message));
handle.createWritable=async()=>({write:async()=>{throw new Error('disk full');},abort:async()=>{aborted++;}});
await assert.rejects(coordinator.save({blob:png,filename:'test'},handle),/disk full/);assert.equal(aborted,1);
handle.createWritable=async()=>({write:async()=>coordinator.cancel(),close:async()=>{throw new Error('Must not close a cancelled write');},abort:async()=>{aborted++;}});
await assert.rejects(coordinator.save({blob:png,filename:'test'},handle),error=>error.name==='AbortError'&&!error.fileWritten);assert.equal(aborted,2);
handle.createWritable=async()=>({write:async blob=>stored=blob,close:async()=>coordinator.cancel(),abort:async()=>{throw new Error('A closed file must not be aborted');}});handle.getFile=async()=>stored;
await assert.rejects(coordinator.save({blob:png,filename:'test'},handle),error=>error.name==='AbortError'&&error.fileWritten);
fakeWindow.showSaveFilePicker=async()=>{throw new DOMException('cancelled','AbortError');};
await assert.rejects(coordinator.chooseSave('test',{}),{name:'AbortError'});assert.equal(downloads,0);
delete fakeWindow.showSaveFilePicker;assert.equal(await coordinator.chooseSave('test',{}),null);
assert.equal((await coordinator.save({blob:png,filename:'test'})).status,'downloaded');assert.equal(downloads,1);
let fallbackOpened=0;assert.equal(await coordinator.open({click:()=>fallbackOpened++}),null);assert.equal(fallbackOpened,1);
fakeWindow.showOpenFilePicker=async()=>[{getFile:async()=>png}];assert.equal(await coordinator.open({}),png);
fakeWindow.showOpenFilePicker=async()=>{throw new DOMException('cancelled','AbortError');};assert.equal(await coordinator.open({}),null);
scenarios.push('picker activation, cancellation, fallback, verified save, mismatched reopen, write abort, open');

hold=true;
const running=coordinator.job(()=>coordinator.run('checksum',{value:png}),{surface:'file'});
await nextTurn();assert.equal(coordinator.status().fileBusy,true,'standalone cancel control must remain visible during processing');coordinator.cancel();assert.ok(fileStates.some(state=>state.fileBusy&&state.phase==='Cancelling standalone file…'),'cancellation must immediately show a status in the standalone section');await assert.rejects(running,{name:'AbortError'});assert.equal(coordinator.status().fileBusy,false,'cancelled standalone processing must clear its controls');assert.equal(alive,0);
hold=false;failStart=true;await assert.rejects(coordinator.run('checksum',{value:png}),/startup unavailable/);assert.equal(coordinator.status().busy,false);failStart=false;
assert.equal(typeof await coordinator.run('checksum',{value:png}),'string');assert.equal(alive,0);
hold=true;const failure=coordinator.run('checksum',{value:png});await nextTurn();lastWorker.onerror({preventDefault(){}});await assert.rejects(failure,/processor failed/);hold=false;assert.equal(alive,0);
await assert.rejects(coordinator.run('parseBlob',{file:new Blob(['{']),maxBytes:100}),/JSON|Expected/);
await coordinator.job(async()=>{
  const id=await coordinator.run('decode.open',{file:new Blob(['x'.repeat(256)]),maxBytes:128,maxLineBytes:64});
  await assert.rejects(coordinator.run('decode.next',{id}),/expands beyond/);
});
assert.equal(alive,0);scenarios.push('cancel, startup failure, runtime failure, retry, malformed JSON, decompression bounds, teardown');
// Own scratch resources immediately, including failure while acquiring a stream reader.
{
  let staged=0,released=0;
  const files={stage:async()=>({name:'receive-scratch-'+(++staged),handle:{}}),release:async()=>{released++;}};
  const receiver=module.createCoordinator({createWorker,window:fakeWindow,document,files});
  const locked=new ReadableStream();const owner=locked.getReader();
  await assert.rejects(receiver.receiveStream(locked,1),TypeError);
  assert.equal(staged,1);assert.equal(released,1,'failed reader acquisition must release staged storage');
  owner.releaseLock();assert.equal(receiver.status().busy,false);
}
// An abort during asynchronous staging must not start copy/encryption work afterward.
for(const type of ['file.copy','crypto.stream.encrypt']){
  const abort=new AbortController();let released=0,workerStarts=0;
  const files={stage:async()=>{abort.abort();return {name:'cancelled-stage',handle:{}};},release:async()=>{released++;},bind:value=>value};
  const stagedCoordinator=module.createCoordinator({window:fakeWindow,document,files,createWorker:()=>{workerStarts++;return {terminate(){},postMessage(message){queueMicrotask(()=>this.onmessage({data:{id:message.id,value:png}}));}};}});
  await assert.rejects(stagedCoordinator.run(type,{file:png},{signal:abort.signal}),{name:'AbortError'});
  assert.equal(workerStarts,0);assert.equal(released,1);assert.equal(stagedCoordinator.status().busy,false);
}
for(const mode of ['success','write-failure','cancel-close']){
  const abort=new AbortController();let releases=0,writerAborts=0;const parts=[];
  const files={stage:async()=>({name:'stream-stage',handle:{
    createWritable:async()=>({write:async part=>{if(mode==='write-failure')throw new Error('disk full');parts.push(part);},close:async()=>{if(mode==='cancel-close')abort.abort();},abort:async()=>{writerAborts++;}}),
    getFile:async()=>new Blob(parts)
  }}),bind:value=>value,release:async()=>{releases++;}};
  const receiver=module.createCoordinator({createWorker,window:fakeWindow,document,files});
  const stream=new ReadableStream({start(controller){controller.enqueue(new Uint8Array([1,2,3]));controller.close();}});
  if(mode==='success')assert.deepEqual(new Uint8Array(await (await receiver.receiveStream(stream,3,{signal:abort.signal})).arrayBuffer()),new Uint8Array([1,2,3]));
  else await assert.rejects(receiver.receiveStream(stream,3,{signal:abort.signal}),mode==='cancel-close'?{name:'AbortError'}:/disk full/);
  assert.equal(stream.locked,false);assert.equal(receiver.status().busy,false);
  assert.equal(releases,mode==='success'?0:1);assert.equal(writerAborts,mode==='write-failure'?1:0);
}
scenarios.push('failed stream-reader acquisition releases scratch; staging cancellation prevents worker dispatch');
// Small parts stored back to back are checked with one read: each digest is
// the standard SHA-256 of its part, and a changed byte shows in that part only.
{
  const parts=[new Uint8Array(1000).fill(1),new Uint8Array(0),new Uint8Array(70000).fill(7),new Uint8Array(5).fill(9)],file=new Blob(parts);let at=0;
  const ranges=parts.map(part=>{const range={start:at,end:at+part.length};at+=part.length;return range;});
  const digests=await engine.run('checksum.ranges',{file,ranges});
  assert.deepEqual(digests,await Promise.all(parts.map(part=>engine.run('checksum',{value:new Blob([part])}))));
  const changed=new Uint8Array(await file.arrayBuffer());changed[1500]^=1;const after=await engine.run('checksum.ranges',{file:new Blob([changed]),ranges});
  assert.deepEqual(after.map((digest,index)=>digest===digests[index]),[true,true,false,true]);
  for(const bad of [[],[{start:0,end:file.size+1}],[{start:10,end:5}],[{start:0,end:20},{start:10,end:30}]])await assert.rejects(engine.run('checksum.ranges',{file,ranges:bad}),/Checksum ranges are invalid/u);
  await assert.rejects(engine.run('checksum.ranges',{file:new Blob([new Uint8Array(17*1048576)]),ranges:[{start:0,end:17*1048576}]}),/Checksum ranges are invalid/u,'one read stays bounded to 16 MB');
  scenarios.push('back-to-back parts checked with one bounded read');
}
console.log(JSON.stringify({status:'PASS',scenarios,workersCreated:created,workersRemaining:alive},null,2));
