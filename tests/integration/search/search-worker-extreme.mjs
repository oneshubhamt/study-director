import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Worker} from 'node:worker_threads';
import {performance} from 'node:perf_hooks';
import {PERFORMANCE_BUDGETS} from '../../../contracts/performance-budgets.mjs';
import {createNoteSnapshotHarness} from '../../helpers/note-snapshot-harness.mjs';

const read=file=>fs.readFileSync(new URL('../../../'+file,import.meta.url),'utf8');
const workerSource=read('source/external/search-worker.js');
const notesRepository=read('source/core/repositories-notes.js');

// The note limit, with ten million words between them.
const NOTES=2000,WORDS_PER_NOTE=5000,BATCH_CHARS=2*1024*1024;

const hundredWords=Array.from({length:100},()=>"word");
function makeDocument(i){
  const content=Array.from({length:WORDS_PER_NOTE/100},(_,paragraph)=>{
    const words=hundredWords.slice();
    if(paragraph===WORDS_PER_NOTE/100-1)words[99]=`x${String(i).padStart(4,'0')}`;
    return {type:'Paragraph',content:[{type:'Text',param:words.join(' ')}]};
  });
  return {key:`k${i}`,revision:'r1',value:'WG1:'+JSON.stringify({version:1,doc:{type:'Doc',content}})};
}

// Search finds notes by their title key, the label normalised.
const canonicalEntries=Array.from({length:NOTES},(_,i)=>{const row=makeDocument(i);return {key:row.key,label:`Area ${i}`,text:row.value,updatedAt:row.revision}});
const hostHarness=createNoteSnapshotHarness(notesRepository,canonicalEntries);
let hostStart=performance.now();const hostSnapshot=hostHarness.api.searchSnapshot();const hostColdSnapshotMs=performance.now()-hostStart;
const documents=hostSnapshot.documents;
const hostHotSamples=[];for(let i=0;i<100;i++){hostStart=performance.now();assert.strictEqual(hostHarness.api.searchSnapshot(),hostSnapshot);hostHotSamples.push(performance.now()-hostStart)}
hostHotSamples.sort((a,b)=>a-b);const hostHotSnapshotP95=hostHotSamples[Math.floor(hostHotSamples.length*.95)];
assert.ok(hostHotSnapshotP95<PERFORMANCE_BUDGETS.notesHostSnapshotHotP95Ms,`Extreme host snapshot p95 ${hostHotSnapshotP95.toFixed(3)} ms indicates cache loss.`);
const serializedBytes=documents.reduce((sum,row)=>sum+Buffer.byteLength(row.value),0);
assert.ok(documents.every(row=>row.value.length<70000),'Fixture must remain inside the production note character ceiling.');

const wrapper=`
const {parentPort}=require('node:worker_threads');
const self={
  addEventListener(type,callback){if(type==='message')parentPort.on('message',data=>callback({data}));},
  postMessage(message){const memory=process.memoryUsage();parentPort.postMessage({...message,__heap:memory.heapUsed,__rss:memory.rss});}
};
globalThis.self=self;
${workerSource}
`;
const worker=new Worker(wrapper,{eval:true});
worker.setMaxListeners(0);
let workerFailure=null;
worker.on('error',error=>{workerFailure=error;});
const query=(id,value)=>new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>{worker.off('message',onMessage);reject(new Error(`Search Worker query ${id} timed out.`));},10000);
  const onMessage=message=>{
    if(Number(message?.id)!==id)return;
    clearTimeout(timeout);worker.off('message',onMessage);resolve(message);
  };
  worker.on('message',onMessage);
  worker.postMessage({type:'query',id,query:value});
});

worker.postMessage({type:'sync',documents:[]});
let cursor=0,batches=0,maxBatchChars=0,maxPostMs=0;
const coldStart=performance.now();
while(cursor<documents.length){
  const batch=[];let chars=0;
  while(cursor<documents.length){
    const row=documents[cursor],size=row.value.length;
    if(batch.length&&chars+size>BATCH_CHARS)break;
    batch.push(row);chars+=size;cursor++;
  }
  assert.ok(chars<=BATCH_CHARS||batch.length===1,'A cold-index batch exceeded its bounded clone target.');
  maxBatchChars=Math.max(maxBatchChars,chars);batches++;
  const postStart=performance.now();worker.postMessage({type:'batch',documents:batch});
  maxPostMs=Math.max(maxPostMs,performance.now()-postStart);
  await new Promise(resolve=>setImmediate(resolve));
}
const first=await query(1,'x1999');
const coldIndexMs=performance.now()-coldStart;
if(workerFailure)throw workerFailure;
assert.deepEqual(first.keys,['area 1999']);

const hotSamples=[];
for(let i=0;i<20;i++){
  const start=performance.now();
  const result=await query(100+i,`x${String(NOTES-1-i).padStart(4,'0')}`);
  hotSamples.push(performance.now()-start);
  assert.deepEqual(result.keys,[`area ${NOTES-1-i}`]);
}
hotSamples.sort((a,b)=>a-b);
const hotP95=hotSamples[Math.floor(hotSamples.length*.95)];

// These are catastrophic-regression guards, not optimisation targets. Normal results are far below them.
assert.ok(coldIndexMs<PERFORMANCE_BUDGETS.notesExtremeColdMs,`Extreme cold index ${coldIndexMs.toFixed(1)} ms indicates a scaling regression.`);
assert.ok(hotP95<PERFORMANCE_BUDGETS.notesExtremeHotP95Ms,`Extreme hot-query p95 ${hotP95.toFixed(1)} ms is no longer interactively responsive.`);
assert.ok(maxPostMs<PERFORMANCE_BUDGETS.notesExtremePostMs,`A bounded Worker post blocked for ${maxPostMs.toFixed(1)} ms.`);

const report={
  status:'PASS',suite:'search-worker-extreme',notes:NOTES,wordsPerNote:WORDS_PER_NOTE,totalWords:NOTES*WORDS_PER_NOTE,
  serializedMiB:Number((serializedBytes/1048576).toFixed(2)),hostColdSnapshotMs:Number(hostColdSnapshotMs.toFixed(2)),hostHotSnapshotP95Ms:Number(hostHotSnapshotP95.toFixed(4)),mainThreadRichDecodeCalls:0,batches,maxBatchMiB:Number((maxBatchChars/1048576).toFixed(2)),
  coldIndexMs:Number(coldIndexMs.toFixed(1)),maxPostMs:Number(maxPostMs.toFixed(2)),hotQueryP95Ms:Number(hotP95.toFixed(2)),
  workerHeapMiB:Number((Number(first.__heap||0)/1048576).toFixed(1)),workerRssMiB:Number((Number(first.__rss||0)/1048576).toFixed(1)),
  persistentIndex:false
};
await worker.terminate();
console.log(JSON.stringify(report,null,2));
