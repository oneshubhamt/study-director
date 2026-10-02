import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=file=>fs.readFileSync(new URL('../../../'+file,import.meta.url),'utf8');
const workerSource=read('source/external/search-worker.js');

let handler=null;const replies=[];
const self={
  addEventListener(type,callback){if(type==='message')handler=callback;},
  postMessage(message){replies.push(message);}
};
const sandbox={self,console,TextEncoder,TextDecoder,Map,Set};sandbox.globalThis=sandbox;
vm.createContext(sandbox);vm.runInContext(workerSource,sandbox,{filename:'search-worker.js'});
assert.equal(typeof handler,'function','Search worker did not install its message listener.');
const send=data=>handler({data});
const result=()=>replies.at(-1);
const paragraph=param=>({type:'Paragraph',content:[{type:'Text',param}]});
const wg1=(...paragraphs)=>'WG1:'+JSON.stringify({version:1,doc:{type:'Doc',content:paragraphs.map(paragraph)}});

send({type:'sync',documents:[
  {key:'physics',revision:'r1',value:wg1('Orbital velocity and escape velocity')},
  {key:'biology',revision:'r1',value:wg1('Photosynthesis chlorophyll stroma')},
  {key:'ethics',revision:'r1',value:'Integrity and impartiality'}
]});
send({type:'query',id:1,query:'PHOTO'});
assert.deepEqual([...result().keys],['biology']);
send({type:'query',id:2,query:'velocity'});
assert.deepEqual([...result().keys],['physics']);
send({type:'query',id:3,query:'IMPARTIALITY'});
assert.deepEqual([...result().keys],['ethics']);
send({type:'batch',documents:[{key:'geography',revision:'r1',value:wg1('Monsoon orographic rainfall')} ]});
send({type:'query',id:31,query:'orographic'});
assert.deepEqual([...result().keys],['geography']);

// Active editor updates may share the same throttled revision, so an explicit derived-text update
// must replace the cached text even when revision has not advanced.
send({type:'upsert',document:{key:'biology',revision:'r1',plain:'Mitochondria oxidative phosphorylation'}});
send({type:'query',id:4,query:'photosynthesis'});assert.deepEqual([...result().keys],[]);
send({type:'query',id:5,query:'oxidative'});assert.deepEqual([...result().keys],['biology']);

// A corpus sync is authoritative for membership; deleted notes disappear without rebuilding a
// permanent index or touching application storage.
send({type:'sync',documents:[{key:'biology',revision:'r2',value:wg1('Genetics meiosis')} ]});
send({type:'query',id:6,query:'velocity'});assert.deepEqual([...result().keys],[]);
send({type:'query',id:7,query:'meiosis'});assert.deepEqual([...result().keys],['biology']);

// Explicit deletion evicts the disposable RAM entry immediately. Invalid reserved WG1 envelopes
// must not degrade into searchable raw JSON, which could expose transient/editor state.
send({type:'delete',key:'biology'});
send({type:'query',id:8,query:'meiosis'});assert.deepEqual([...result().keys],[]);
const polluted='WG1:'+JSON.stringify({version:1,doc:{type:'Doc',content:[paragraph('canonical body')]},history:{done:['transient needle']}});
send({type:'upsert',document:{key:'polluted',revision:'r1',value:polluted}});
send({type:'query',id:9,query:'transient needle'});assert.deepEqual([...result().keys],[]);
send({type:'query',id:10,query:'canonical body'});assert.deepEqual([...result().keys],[]);

// Scale contract: a large in-memory corpus remains functionally correct without making
// wall-clock timing part of the deterministic fast gate. Performance belongs to release QA.
const makeNote=i=>{
  const blocks=[];
  for(let p=0;p<10;p++)blocks.push(Array.from({length:10},(_,w)=>`n${i}p${p}w${w}`).join(' '));
  return {key:`k${i}`,revision:'r1',value:wg1(...blocks)};
};
const documents=Array.from({length:1000},(_,i)=>makeNote(i));
send({type:'sync',documents});
send({type:'query',id:100,query:'n999p9w9'});assert.deepEqual([...result().keys],['k999']);
send({type:'upsert',document:{key:'k500',revision:'r2',plain:'single incremental replacement needle'}});
send({type:'query',id:101,query:'replacement needle'});assert.deepEqual([...result().keys],['k500']);

console.log(JSON.stringify({status:'PASS',documents:1000,wordsPerDocument:100,persistentIndex:false},null,2));
