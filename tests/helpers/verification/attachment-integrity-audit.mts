import {readScript} from '../../../build/source-script.mts';
import {readCoreScript} from '../core-script.mts';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {createFakeClock} from '../fake-clock.mts';

import {method,registeredExports} from '../registered-exports.mts';
import {assetStoragePort,numberValue} from '../asset-storage-port.mts';
import {required} from '../repository-note-ports.mts';
import {field} from '../repository-safety-ports.mts';
import {jsonArray,jsonObject,jsonString} from './read-verification.mts';
type LockOptions={mode?:string;ifAvailable?:boolean};
type LockCallback=(lock:object|null)=>unknown;
type AuditProgress=Awaited<ReturnType<ReturnType<typeof assetStoragePort>['shallowAudit']>>['progress'];
const context={crypto:webcrypto,TextEncoder,Uint8Array,console,Blob,Object,Set,Map,Math,Number,String,Promise,Date,TypeError,Symbol};
Reflect.set(context,'globalThis',context);vm.createContext(context);
for(const file of ['source/core/internal.ts','source/core/asset-storage.ts'])vm.runInContext(readScript(file),context,{filename:file});
const storageModule=registeredExports(context,'asset-storage');
const createStore=(input:unknown)=>assetStoragePort(method(storageModule,'create')(input));

const hash='a'.repeat(64);
const metadata=(file:string,size=10,library=false)=>({version:2,storage:'opfs',file,hash,size,type:'application/pdf',name:file+'.pdf',library});
const rows=new Map([
  ['asset-good',metadata('attblob-a1111111111111111111111111111',10,false)],
  ['asset-retained-missing',metadata('attblob-b2222222222222222222222222222',10,true)],
  ['asset-orphan-missing',metadata('attblob-c3333333333333333333333333333',10,false)],
  ['asset-size',metadata('attblob-d4444444444444444444444444444',10,false)],
  ['asset-invalid',{version:2,storage:'opfs',file:'not-opaque',hash,size:10,type:'application/pdf',name:'broken.pdf',library:true}]
]);
const files=new Map([
  ['attblob-a1111111111111111111111111111',new Blob(['0123456789'],{type:'application/pdf'})],
  ['attblob-d4444444444444444444444444444',new Blob(['short'],{type:'application/pdf'})]
]);
let commitCalls=0,yieldCalls=0;
const notFound=()=>Object.assign(new Error('missing'),{name:'NotFoundError'});
const dir={
  async getFileHandle(name:string){if(!files.has(name))throw notFound();return {getFile:async()=>files.get(name)};}
};
const root={async getDirectoryHandle(){return dir;},async removeEntry(){throw notFound();}};
const locks={request(_name:string,options:LockOptions|LockCallback,callback?:LockCallback){const run=typeof options==='function'?options:required(callback);return Promise.resolve(run({name:'lock'}));}};
const store=createStore({
  name:'test',protocol:'https:',storage:{getDirectory:async()=>root},locks,
  read:async (key:string)=>rows.get(key),keys:async()=>[...rows.keys()],entries:async()=>[...rows.entries()],
  commit:async()=>{commitCalls++;},validId:(value:unknown)=>/^asset-[a-z-]+$/.test(String(value)),validType:(type:string)=>type==='application/pdf',maxBytes:1024,limitForType:()=>1024,
  issueToken:()=>1,assertToken(){},canMutate:()=>true,ingest:{ingest:async()=>{throw new Error('not used');}}
});

const result=await store.shallowAudit(['asset-good','asset-size','asset-no-metadata'],{
  shouldYield:()=>true,
  yieldTask:async()=>{yieldCalls++;},
  check(){}
});
assert.equal(result.status,'completed');
assert.equal(result.checked,3,'Only referenced or independently retained valid rows should touch OPFS.');
assert.equal(result.references,3);
assert.equal(commitCalls,0,'A shallow integrity audit must never mutate attachment state.');
assert.ok(yieldCalls>=rows.size+result.checked,'The audit should yield cooperatively through metadata and physical checks.');
const byId=new Map(result.issues.map(issue=>[jsonString(issue['id']),issue] as const));
assert.equal(byId.get('asset-retained-missing')?.['kind'],'missing-file','Retained library files are durable logical content and must be checked.');
assert.equal(byId.get('asset-size')?.['kind'],'size-mismatch');
assert.equal(byId.get('asset-size')?.['expectedSize'],10);
assert.equal(byId.get('asset-size')?.['actualSize'],5);
assert.equal(byId.get('asset-no-metadata')?.['kind'],'missing-metadata','A canonical rich-text reference without metadata must be reported.');
assert.equal(byId.get('asset-invalid')?.['kind'],'metadata-invalid');
assert.equal(byId.has('asset-orphan-missing'),false,'Unreferenced, non-retained orphan bytes are maintenance material and should not trigger integrity warnings.');
assert.equal(byId.has('asset-good'),false,'A healthy referenced file must not produce a warning.');

let auditProgress:AuditProgress=null,passes=0,boundedResult;
do{boundedResult=await store.shallowAudit(['asset-good','asset-size','asset-no-metadata'],{maxEntries:2,progress:auditProgress});auditProgress=boundedResult.progress;passes++;assert.ok(passes<10);}while(!boundedResult.complete);
assert.ok(passes>1);assert.equal(boundedResult.checked,result.checked);assert.deepEqual(boundedResult.issues,result.issues,'resumed audit must retain all findings');
let clock=0;const deadline=await store.shallowAudit(['asset-good'],{workMs:5,now:()=>clock,shouldYield:()=>true,yieldTask:async()=>{clock+=6;}});assert.equal(deadline.status,'yielded');assert.ok(required(deadline.progress).cursor>0);
const changedInventory=await store.shallowAudit(['asset-good','asset-new-reference'],{maxEntries:1,progress:{...required(deadline.progress),cursor:4}});assert.equal(required(changedInventory.progress).cursor,1,'changed references must restart the inventory cursor');

// Successful but slow inventory reads must preserve a monotonically advancing
// cursor and exactly the same findings as the fast complete audit.
for(const latency of [4999,5000,6000,20000]){
 let stamp=0;
 const slow=createStore({name:'slow-audit',protocol:'https:',storage:{getDirectory:async()=>root},locks,
  read:async (key:string)=>rows.get(key),keys:async()=>[...rows.keys()],entries:async()=>{stamp+=latency;return [...rows.entries()];},commit:async()=>assert.fail('read-only audit'),validId:(value:unknown)=>/^asset-[a-z-]+$/.test(String(value)),validType:(type:string)=>type==='application/pdf',maxBytes:1024,issueToken:()=>1,assertToken(){},canMutate:()=>true,ingest:{ingest:async()=>assert.fail('unused')}});
 let progress:AuditProgress=null,previous=0,final:Awaited<ReturnType<typeof slow.shallowAudit>>|undefined;
 for(let pass=0;pass<10;pass++){final=await slow.shallowAudit(['asset-good','asset-size','asset-no-metadata'],{now:()=>stamp,progress});progress=final.progress;if(final.complete)break;assert.ok(required(progress).cursor>previous);previous=required(progress).cursor;}
 assert.equal(required(final).complete,true);assert.deepEqual(required(final).issues,result.issues);assert.equal(required(final).checked,result.checked);
}

// A same-size metadata mutation during a yielded audit must invalidate its
// old scan identity; cursor 1 cannot silently advance to cursor 2.
{
 const first=await store.shallowAudit(['asset-good','asset-size'],{maxEntries:1});
 assert.equal(required(first.progress).cursor,1);
 const previous=required(rows.get('asset-good'));
 rows.set('asset-good',{...previous,name:'changedname.pdf'});
 const restart=await store.shallowAudit(['asset-good','asset-size'],{maxEntries:1,progress:first.progress});
 assert.equal(required(restart.progress).cursor,1,'same-size metadata change restarts strong inventory digest');
 assert.notEqual(required(restart.progress).scanId,required(first.progress).scanId);
 rows.set('asset-good',previous);
}

const originalGet=dir.getFileHandle;
dir.getFileHandle=async()=>{throw Object.assign(new Error('permission unavailable'),{name:'NotAllowedError'});};
await assert.rejects(store.shallowAudit(['asset-good']),{name:'NotAllowedError'},'unavailable file access must not become a missing-file finding');dir.getFileHandle=originalGet;

// Execute the checked P5.7C attachment-integrity owner. Old findings must
// survive both a metadata read failure and failure to durably save a newly
// clean scan, and a newer near-term request must retain its earlier deadline.
const integrityContext=vm.createContext({
  console,Symbol,Object,Map,Set,Promise,Date,Error,TypeError,
  HTMLButtonElement:class HTMLButtonElement{}
});
for(const file of ['source/core/internal.ts','source/core/operation-lifecycle.ts','source/core/backup-integrity-host.ts'])
  vm.runInContext(readScript(file),integrityContext,{filename:file});
const integrityLifecycle=registeredExports(integrityContext,'operation-lifecycle'),integrityHost=registeredExports(integrityContext,'backup-integrity-host');
{
  const epoch=1,clock=createFakeClock(),wrong={owner:'backup',read:async()=>null,write:async()=>({family:'integrity',value:null,updatedAt:new clock.Date().toISOString()})},repository={owner:'backup',read:async()=>null,transaction:async()=>{throw new Error('unused');}};
  assert.throws(()=>method(integrityHost,'createController')(Object.freeze({
    lifecycle:integrityLifecycle,metadata:Object.freeze({attachment:wrong,repository}),attachmentMetadataName:'integrity',repositoryMetadataName:'repository-integrity',
    storage:Object.freeze({supported:()=>false,shallowAudit:async()=>({status:'completed',complete:true,checked:0,issues:[],progress:null})}),references:Object.freeze({sources:async()=>new Set()}),validAttachmentId:()=>true,
    data:Object.freeze({datasetRevision:async()=>1}),referenceRevision:()=>0,authority:Object.freeze({canMutate:()=>true,revision:()=>epoch}),background:Object.freeze({upkeepBlocker:()=>'',backgroundBlocker:()=>'',foregroundBusy:()=>false}),backgroundTasks:Object.freeze({yieldTask:async()=>{},budget:()=>()=>false}),
    provider:Object.freeze({backgroundStatus:()=>[],locationStatus:()=>null,repositoryScope:async()=>'',requestIntegrity:()=>false}),continuation:Object.freeze({verify:async()=>{throw new Error('unused');}}),normalizeContinuation:()=>null,unsafe:Object.freeze({mutation:()=>false,attachmentIngest:()=>false}),storageHealth:Object.freeze({markError(){},markOk(){}}),invalidateAttachmentLibrary(){},diagnostics:Object.freeze({capture(){},start:()=>'',mark(){},finish(){},fail(){}}),document:{getElementById:()=>null,createElement:()=>({})},environment:Object.freeze({now:()=>clock.now(),nowIso:()=>new clock.Date().toISOString(),uuid:()=> '00000000-0000-0000-0000-000000000001',setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout}),limits:Object.freeze({attachmentIntervalMs:1,attachmentRetryMs:1,repositoryBatchObjects:1,repositoryBatchBytes:1})
  })),/owned by host/,'attachment integrity must reject a backup-owned metadata capability instead of degrading into an unavailable warning');
}
for(const failure of ['read','write','retired-scan','retired-write']){
  const clock=createFakeClock();let cleared=0,writes=0,failRead=false,failWrite=false,epoch=1;
  let persisted:unknown={version:2,checkedAt:'',attemptedAt:'',lastOutcome:'completed',progress:null,issues:[{id:'asset-good',kind:'size-mismatch'}]};
  const attachmentMeta={owner:'host',read:async()=>{if(failRead)throw new Error('read unavailable');return persisted;},write:async(_name:string,value:unknown,options:{strict:boolean;assertOrigin:()=>void})=>{writes++;assert.equal(options.strict,true);options.assertOrigin();if(failure==='retired-write')epoch+=2;options.assertOrigin();if(failWrite)throw new Error('write unavailable');persisted=value;return {family:'integrity',value,updatedAt:new clock.Date().toISOString()};}};
  const repositoryMeta={owner:'backup',read:async()=>{throw new Error('repository integrity path is not used by this attachment witness');},transaction:async()=>{throw new Error('repository integrity path is not used by this attachment witness');}};
  const controller=method(integrityHost,'createController')(Object.freeze({
    lifecycle:integrityLifecycle,metadata:Object.freeze({attachment:attachmentMeta,repository:repositoryMeta}),attachmentMetadataName:'integrity',repositoryMetadataName:'repository-integrity',
    storage:Object.freeze({supported:()=>true,shallowAudit:async()=>{if(failure==='retired-scan')epoch+=2;return {status:'completed',complete:true,checked:1,issues:[],progress:null};}}),
    references:Object.freeze({sources:async (options:{referencesOnly:boolean})=>{assert.equal(options.referencesOnly,true);return new Set(['asset-good']);}}),
    validAttachmentId:(value:unknown)=>/^asset-/.test(String(value||'')),
    data:Object.freeze({datasetRevision:async()=>1}),referenceRevision:()=>0,
    authority:Object.freeze({canMutate:()=>true,revision:()=>epoch}),
    background:Object.freeze({upkeepBlocker:()=>'',backgroundBlocker:()=>'',foregroundBusy:()=>false}),
    backgroundTasks:Object.freeze({yieldTask:async()=>{},budget:()=>()=>false}),
    provider:Object.freeze({backgroundStatus:()=>[],locationStatus:()=>null,repositoryScope:async()=>'',requestIntegrity:()=>false}),
    continuation:Object.freeze({verify:async()=>{throw new Error('repository continuation is not used by this attachment witness');}}),
    normalizeContinuation:()=>null,
    unsafe:Object.freeze({mutation:()=>false,attachmentIngest:()=>false}),
    storageHealth:Object.freeze({markError(){},markOk(){cleared++;}}),
    invalidateAttachmentLibrary(){},
    diagnostics:Object.freeze({capture(){},start:()=>'',mark(){},finish(){},fail(){}}),
    document:{getElementById:()=>null,createElement:()=>({})},
    environment:Object.freeze({now:()=>clock.now(),nowIso:()=>new clock.Date().toISOString(),uuid:()=> '00000000-0000-0000-0000-000000000001',setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout}),
    limits:Object.freeze({attachmentIntervalMs:24*60*60*1000,attachmentRetryMs:10*60*1000,repositoryBatchObjects:4,repositoryBatchBytes:256*1024*1024})
  }));
  await method(controller,'installAttachment')();const job=field(controller,'attachmentJob');method(job,'clear')();
  assert.equal(field(method(controller,'attachmentIssue')('asset-good'),'kind'),'size-mismatch');
  failRead=failure==='read';failWrite=failure==='write';
  const running=Promise.resolve(method(job,'run')('test'));
  method(controller,'scheduleAttachment')(5000,'new-attachment');
  const attempt=await running;
  assert.equal(field(attempt,'status'),failure.startsWith('retired')?'skipped':'unavailable');assert.equal(field(method(controller,'attachmentIssue')('asset-good'),'kind'),'size-mismatch','failed verification retains prior findings');
  assert.equal(cleared,0);assert.equal(writes,failure==='write'||failure==='retired-write'?1:0);
  assert.equal(clock.nextAt(),clock.now()+5000,'a running audit cannot replace a newer five-second request with its later error retry');
  method(controller,'scheduleAttachment')(60000,'interval');
  assert.equal(clock.nextAt(),clock.now()+5000,'a later recurrence cannot postpone pending work');
  method(controller,'scheduleAttachment')(2000,'earlier-attachment');
  assert.equal(clock.nextAt(),clock.now()+2000,'a newly requested earlier deadline must pull verification forward');
  method(job,'dispose')();
}
// The integrity path needs only attachment IDs. It must scan the same
// complete, strict canonical sources as the interactive descriptor path.
vm.runInContext(readCoreScript('attachments'),context,{filename:'source/core/attachments.ts'});
const Attachments=registeredExports(context,'attachments');
{
 const refs=Array.from({length:13},(_,i)=>'att-'+String(i).padStart(32,'a'));
 let reads=0,days=0,sessionReads=0,yields=0,scanCalls=0,bad=false;
 const notes=Object.fromEntries(Array.from({length:1000},(_,i)=>['note-'+i,{label:'Note '+i,text:i===999&&bad?'UNTRUSTED':'text '+refs[i%refs.length]}]));
 const records=Array.from({length:1000},(_,i)=>({date:'2026-10-'+String(i+1).padStart(4,'0'),reflection:'diary '+refs[(i+3)%refs.length]}));
 const data={
  notes:{readFreshPayload:async()=>{reads++;return notes;}},
  dailyRecords:{list:async (options:{strict:boolean})=>{assert.equal(options.strict,true);days++;return records;}},
  activeSession:{load:async(_:unknown,opts:{strict:boolean})=>{assert.equal(opts.strict,true);sessionReads++;return {ok:true,value:{id:'session',date:'2026-10-01',snapshot:{review:{reflection:refs[12]}}}};}}
 };
 const owner=method(Attachments,'createReferenceCoordinator')({
  data,scan:(text:unknown)=>{scanCalls++;return {trusted:!String(text).includes('UNTRUSTED'),assetIds:refs.filter(id=>String(text).includes(id)),occurrences:[]};},
  rewriteReferences:async()=>{},withPersistenceSuppressed:(fn:()=>unknown)=>fn(),review:{hydrate:()=>{},invalidateBindings:()=>{}},
  background:{budget:()=>()=>true,yieldTask:async()=>{yields++;}},
  live:{fields:()=>[],reviewDate:()=>'',todayIso:()=>'',noteKey:(x:unknown)=>x}
 });
 const sources=async(options:unknown)=>method(owner,'sources')(options);
 const checkedSet=(value:unknown)=>{assert.ok(value instanceof Set);const set:Set<unknown>=value;return Array.from(set,jsonString);};
 const compact=await sources({includeLive:false,priority:'background',referencesOnly:true});
 assert.ok(compact instanceof Set);assert.deepEqual(checkedSet(compact).sort(),refs.slice().sort());
 assert.equal(reads,1);assert.equal(days,1);assert.equal(sessionReads,1);
 assert.ok(yields>=2000,'large inventory yields between descriptors rather than one long synchronous walk');
 const normal=await sources({includeLive:false,priority:'background'});
 assert.ok(Array.isArray(normal));assert.equal(normal.length,2001);
 assert.deepEqual([...new Set(jsonArray(normal).flatMap(row=>checkedSet(field(row,'ids'))))].sort(),checkedSet(compact).sort());
 assert.equal(reads,2);assert.equal(days,2);assert.equal(sessionReads,2,'compact mode never duplicates strict whole-source reads');
 assert.ok(scanCalls>=4000);
 required(notes['note-999']).text='UNTRUSTED';bad=true;
 await assert.rejects(()=>sources({includeLive:false,priority:'background',referencesOnly:true}),/could not be verified/);
 await assert.rejects(()=>sources({includeLive:false,priority:'background'}),/could not be verified/);
}
// The GC's unresolved-key count replaces a repeated keys.every() traversal.
// Durable source-revision and untrusted-text checks remain the deletion gate.
vm.runInContext(readCoreScript('operation-lifecycle'),context,{filename:'source/core/operation-lifecycle.ts'});
vm.runInContext(readCoreScript('asset-maintenance'),context,{filename:'source/core/asset-maintenance.ts'});
const Lifecycle=registeredExports(context,'operation-lifecycle'),Maintenance=registeredExports(context,'asset-maintenance',Object.freeze({lifecycle:Lifecycle}));
function gcFixture(size:number,{untrusted=false,untrustedLive=false,emptyNotes=false}:{untrusted?:boolean;untrustedLive?:boolean;emptyNotes?:boolean}={}){
 let currentRevision=1,notesRead=0,removed=0,scanned=0,daysRead=0,activeRead=0,callbacks:{id:number;cb:()=>void;ms:number}[]=[],seq=0;
 const ids=Array.from({length:size},(_,i)=>'asset-'+String(i).padStart(6,'0'));
 const notes=emptyNotes?{}:Object.fromEntries(ids.map((id,i)=>[id,{text:untrusted&&i===0?'INVALID':'ref '+id}]));
 const fields=untrustedLive?[{value:'INVALID',isConnected:true}]:[];
 const ports={
  canMutate:()=>true,mutationActive:()=>false,
  collect:async(operation:(scope:unknown)=>unknown)=>operation({keys:async()=>ids,removeMany:async (collection:readonly string[])=>{removed+=collection.length;return collection.length;},sweep:async()=>0,status:()=>({sweepPending:false})}),
  readRestoreJournal:async()=>null,readLibraryClearJournal:async()=>null,liveFields:()=>fields,
  getReferenceRevision:()=>currentRevision,getDatasetRevision:async()=>String(currentRevision),
  scanReferences:(text:string)=>{scanned++;return {trusted:!text.includes('INVALID'),assetIds:ids.filter(id=>text.includes(id))};},
  readNotes:async()=>{notesRead++;return notes;},loadActiveSession:async()=>{activeRead++;return {ok:true,value:null};},
  listDailyRecords:async()=>{daysRead++;return [];},readPendingReviewTexts:async()=>[],
  budget:()=>()=>false,yieldTask:async()=>{},invalidate:()=>{},captureError:(error:unknown)=>{throw error;},
  setTimeout:(cb:()=>void,ms:number)=>{callbacks.push({id:++seq,cb,ms});return seq;},clearTimeout:(id:number)=>{callbacks=callbacks.filter(row=>row.id!==id);},
  now:()=>1000
 };
 const runner=method(Maintenance,'create')(ports,{lease:{protect:()=>{},release:()=>{},isProtected:()=>false},batchSize:128});
 return {runner:{run:async()=>{const row=jsonObject(await method(runner,'run')());return {status:jsonString(row['status']),reason:row['reason']};}},ids,notes,fields,setRevision:(v:number)=>{currentRevision=v;},stats:()=>({notesRead,daysRead,activeRead,removed,scanned}),callbacks:()=>callbacks};
}
for(const size of [0,1,128,129,1001]){
 const f=gcFixture(size);
 let result;
 for(let n=0;n<20;n++){
  result=await f.runner.run();if(['completed','clean'].includes(result.status))break;
  assert.equal(result.status,'yielded','large inventory must remain resumable');
 }
 assert.ok(['completed','clean'].includes(required(result).status),'all referenced keys eventually complete at '+size);
 assert.equal(f.stats().removed,0);
 assert.ok(f.stats().scanned<=size+1,'reference scan is linear rather than repeatedly scanning keys');
 if(size>=129)assert.ok(f.stats().notesRead<=2,'large text source stays resumable between bounded phases');
}
{
 const f=gcFixture(129,{untrusted:true}),result=await f.runner.run();
 assert.equal(result.reason,'uncertain-rich-text');assert.equal(f.stats().removed,0,'unknown text cannot authorize a deletion');
}

// Real StorageManager environments require device acceptance. This OPFS
// mock tests bounded iterator continuation, mutation and active-reader locks.
{
 const physical=new Map<string,Blob>(),meta=new Map<string,unknown>();let reads=0,removed=0;
 const key='asset-retained',name='attblob-'+'c'.repeat(32);
 const physicalDir={
  async *entries(){for(const item of physical.keys())yield [item,{kind:'file'}];},
  async removeEntry(item:string){if(physical.delete(item))removed++;},
  async getFileHandle(item:string){if(!physical.has(item))throw Object.assign(new Error('missing'),{name:'NotFoundError'});return {getFile:async()=>physical.get(item)};}
 };
 const physicalLocks={readers:0,async request(_name:string,options:LockOptions|LockCallback,callback?:LockCallback){
   if(typeof options==='function'){callback=options;options={};}const run=required(callback);
   if(options.mode==='shared'){this.readers++;try{return await run({});}finally{this.readers--;}}
   if(options.ifAvailable&&this.readers)return run(null);
   return run({});
 }};
 const persisted={version:2,storage:'opfs',file:name,hash:'a'.repeat(64),size:1,type:'application/pdf',name:'keep',library:true};
 meta.set(key,persisted);physical.set(name,new Blob(['X']));
 for(let i=0;i<129;i++)physical.set('attblob-'+String(i).padStart(32,'b'),new Blob(['X']));
 const scoped=createStore({name:'mutation-test',protocol:'https:',storage:{getDirectory:async()=>({getDirectoryHandle:async()=>physicalDir})},locks:physicalLocks,
   read:async (k:string)=>meta.get(k)||null,keys:async()=>[...meta.keys()],entries:async()=>{reads++;return [...meta];},
   commit:async()=>assert.fail('sweep must not change logical metadata'),validId:(k:string)=>/^asset-/.test(k),validType:(t:string)=>t==='application/pdf',maxBytes:1024,limitForType:()=>1024,
   issueToken:()=>1,assertToken(){},canMutate:()=>true,ingest:{ingest:async()=>assert.fail('unused')}
 });
 const first=await scoped.collectReport(async gc=>({removed:await gc.sweep(),pending:gc.status()['sweepPending']}),{maxEntries:8});
 assert.equal(first['pending'],true);assert.ok(numberValue(first['removed'])<=8);
 const inserted='attblob-'+'e'.repeat(32);physical.set(inserted,new Blob(['new during iterator']));
 const release=await scoped.retain();
 assert.equal((await scoped.collectReport(async gc=>gc.sweep()))['reason'],'active-editor-or-file-operation');
 release();await new Promise(resolve=>setImmediate(resolve));
 for(let n=0;n<30;n++){const step=await scoped.collectReport(async gc=>({removed:await gc.sweep(),pending:gc.status()['sweepPending']}),{maxEntries:8});if(!step['pending'])break;}
 assert.equal(physical.has(name),true,'published bytes survive all continuation passes');
 assert.equal(physical.has(inserted),false,'new orphan is eventually reconsidered in mock iterator');
 assert.equal(physical.size,1);
 assert.ok(removed>=130);assert.ok(reads>=1);
}
// No safe short-cut for a full metadata fingerprint: the digest must revalidate
// inventory even when a 1001-entry audit is resumed in 128-entry passes.
{
 const many=new Map(Array.from({length:1001},(_,i)=>['asset-'+String(i).padStart(6,'0'),metadata('attblob-'+String(i).padStart(32,'a'),10,false)]));
 let catalogReads=0,progress:AuditProgress=null,complete=false,passes=0;
 const store=createStore({name:'large-read',protocol:'https:',storage:{getDirectory:async()=>root},locks,
   read:async (k:string)=>many.get(k),keys:async()=>[...many.keys()],entries:async()=>{catalogReads++;return [...many];},
   commit:async()=>assert.fail('read only'),validId:(k:string)=>/^asset-/.test(k),validType:(t:string)=>t==='application/pdf',maxBytes:1024,limitForType:()=>1024,
   issueToken:()=>1,assertToken(){},canMutate:()=>true,ingest:{ingest:async()=>assert.fail('unused')}
 });
 while(!complete){const result=await store.shallowAudit([],{maxEntries:128,progress});complete=result.complete;progress=result.progress;passes++;assert.ok(passes<12);}
 assert.equal(passes,8);
 assert.equal(catalogReads,passes,'P4 retains fresh metadata validation for every persisted scan continuation');
}

// The same invalid editor across two separate retry attempts must never be
// mistaken for a verified scan just because the cached signature matches.
{
 const f=gcFixture(1,{untrustedLive:true,emptyNotes:true});
 for(let retry=0;retry<2;retry++){
  const result=await f.runner.run();
  assert.equal(result.reason,'uncertain-rich-text','malformed live editor blocks every retry');
  assert.equal(f.stats().removed,0,'untrusted live text must never authorize GC');
 }
 required(f.fields[0]).value='valid without attachment references';
 const after=await f.runner.run();
 assert.equal(after.status,'completed','trusted editor permits normal verified orphan cleanup');
 assert.equal(f.stats().removed,1,'only a now-trusted source allows metadata GC');
}
console.log(JSON.stringify({status:'PASS',suite:'attachment-integrity-audit',checked:result.checked,issues:result.issues.map(issue=>issue['kind']),yieldCalls,unavailableIsNotCorruption:true,failedMetadataPreservesFindings:true},null,2));
