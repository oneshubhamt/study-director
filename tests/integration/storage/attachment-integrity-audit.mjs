import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {createFakeClock} from '../../helpers/fake-clock.mjs';

const context={crypto:webcrypto,TextEncoder,Uint8Array,console,Blob,Object,Set,Map,Math,Number,String,Promise,Date,TypeError,Symbol};
context.globalThis=context;vm.createContext(context);
for(const file of ['source/core/internal.js','source/core/asset-storage.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
const storageModule=context[Symbol.for('studyDirector.internalModules.v1')].require('asset-storage',1);

const hash='a'.repeat(64);
const metadata=(file,size=10,library=false)=>({version:2,storage:'opfs',file,hash,size,type:'application/pdf',name:file+'.pdf',library});
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
  async getFileHandle(name){if(!files.has(name))throw notFound();return {getFile:async()=>files.get(name)};}
};
const root={async getDirectoryHandle(){return dir;},async removeEntry(){throw notFound();}};
const locks={request(_name,options,callback){if(typeof options==='function'){callback=options;}return Promise.resolve(callback({name:'lock'}));}};
const store=storageModule.create({
  name:'test',protocol:'https:',storage:{getDirectory:async()=>root},locks,
  read:async key=>rows.get(key),keys:async()=>[...rows.keys()],entries:async()=>[...rows.entries()],
  commit:async()=>{commitCalls++;},validId:value=>/^asset-[a-z-]+$/.test(value),validType:type=>type==='application/pdf',maxBytes:1024,limitForType:()=>1024,
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
const byId=new Map(result.issues.map(issue=>[issue.id,issue]));
assert.equal(byId.get('asset-retained-missing')?.kind,'missing-file','Retained library files are durable logical content and must be checked.');
assert.equal(byId.get('asset-size')?.kind,'size-mismatch');
assert.equal(byId.get('asset-size')?.expectedSize,10);
assert.equal(byId.get('asset-size')?.actualSize,5);
assert.equal(byId.get('asset-no-metadata')?.kind,'missing-metadata','A canonical rich-text reference without metadata must be reported.');
assert.equal(byId.get('asset-invalid')?.kind,'metadata-invalid');
assert.equal(byId.has('asset-orphan-missing'),false,'Unreferenced, non-retained orphan bytes are maintenance material and should not trigger integrity warnings.');
assert.equal(byId.has('asset-good'),false,'A healthy referenced file must not produce a warning.');

let auditProgress=null,passes=0,boundedResult;
do{boundedResult=await store.shallowAudit(['asset-good','asset-size','asset-no-metadata'],{maxEntries:2,progress:auditProgress});auditProgress=boundedResult.progress;passes++;assert.ok(passes<10);}while(!boundedResult.complete);
assert.ok(passes>1);assert.equal(boundedResult.checked,result.checked);assert.deepEqual(boundedResult.issues,result.issues,'resumed audit must retain all findings');
let clock=0;const deadline=await store.shallowAudit(['asset-good'],{workMs:5,now:()=>clock,shouldYield:()=>true,yieldTask:async()=>{clock+=6;}});assert.equal(deadline.status,'yielded');assert.ok(deadline.progress.cursor>0);
const changedInventory=await store.shallowAudit(['asset-good','asset-new-reference'],{maxEntries:1,progress:{...deadline.progress,cursor:4}});assert.equal(changedInventory.progress.cursor,1,'changed references must restart the inventory cursor');

// Successful but slow inventory reads must preserve a monotonically advancing
// cursor and exactly the same findings as the fast complete audit.
for(const latency of [4999,5000,6000,20000]){
 let stamp=0;
 const slow=storageModule.create({name:'slow-audit',protocol:'https:',storage:{getDirectory:async()=>root},locks,
  read:async key=>rows.get(key),keys:async()=>[...rows.keys()],entries:async()=>{stamp+=latency;return [...rows.entries()];},commit:async()=>assert.fail('read-only audit'),validId:value=>/^asset-[a-z-]+$/.test(value),validType:type=>type==='application/pdf',maxBytes:1024,issueToken:()=>1,assertToken(){},canMutate:()=>true,ingest:{ingest:async()=>assert.fail('unused')}});
 let progress=null,previous=0,final;
 for(let pass=0;pass<10;pass++){final=await slow.shallowAudit(['asset-good','asset-size','asset-no-metadata'],{now:()=>stamp,progress});progress=final.progress;if(final.complete)break;assert.ok(progress.cursor>previous);previous=progress.cursor;}
 assert.equal(final.complete,true);assert.deepEqual(final.issues,result.issues);assert.equal(final.checked,result.checked);
}

// A same-size metadata mutation during a yielded audit must invalidate its
// old scan identity; cursor 1 cannot silently advance to cursor 2.
{
 const first=await store.shallowAudit(['asset-good','asset-size'],{maxEntries:1});
 assert.equal(first.progress.cursor,1);
 const previous=rows.get('asset-good');
 rows.set('asset-good',{...previous,name:'changedname.pdf'});
 const restart=await store.shallowAudit(['asset-good','asset-size'],{maxEntries:1,progress:first.progress});
 assert.equal(restart.progress.cursor,1,'same-size metadata change restarts strong inventory digest');
 assert.notEqual(restart.progress.scanId,first.progress.scanId);
 rows.set('asset-good',previous);
}

const originalGet=dir.getFileHandle;
dir.getFileHandle=async()=>{throw Object.assign(new Error('permission unavailable'),{name:'NotAllowedError'});};
await assert.rejects(store.shallowAudit(['asset-good']),{name:'NotAllowedError'},'unavailable file access must not become a missing-file finding');dir.getFileHandle=originalGet;

// Execute the host audit's commit boundary: old findings must survive both a
// metadata read failure and failure to durably save a newly clean scan.
const app=fs.readFileSync('source/app.html','utf8'),begin=app.indexOf('let attachmentIntegrityView='),end=app.indexOf('const REPOSITORY_INTEGRITY_BATCH_BYTES=',begin);
for(const failure of ['read','write']){
  const clock=createFakeClock();let cleared=0,writes=0;const retained=new Map([['asset-good',{kind:'size-mismatch'}]]);
  const context=vm.createContext({console,Object,Map,Date:clock.Date,Promise,Symbol,TypeError,StartupLifecycle:{status:()=>({fullyInitialized:true})},APP_META_KEYS:{attachmentIntegrityAudit:'integrity'},AttachmentsModule:{validId:value=>/^asset-/.test(value)},attachmentIntegrityIssues:retained,
    readHostAppMetaValue:async()=>{if(failure==='read')throw new Error('read unavailable');return {version:1,checkedAt:'',issues:[{id:'asset-good',kind:'size-mismatch'}]};},
    writeHostAppMetaValue:async(_,__,options)=>{writes++;assert.equal(options.strict,true);throw new Error('write unavailable');},
    AttachmentStorage:{supported:()=>true,shallowAudit:async()=>({checked:1,issues:[]})},AttachmentReferences:{sources:async options=>{assert.equal(options.referencesOnly,true);return new Set(['asset-good']);}},
    AppDiagnostics:{capture(){}},BackupOperationDiagnostics:{start:()=>'',mark(){},finish(){},fail(){}},appCanMutate:()=>true,UnsupportedData:{held:()=>false},backgroundMaintenanceForegroundBusy:()=>false,
    BackgroundTasks:{yieldTask:async()=>{},budget:()=>()=>false},markStorageHealthError(){},markStorageHealthOk(){cleared++;},invalidateAttachmentLibrary(){},
    setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout
  });
  for(const file of ['internal','operation-lifecycle'])vm.runInContext(fs.readFileSync(`source/core/${file}.js`,'utf8'),context);context.OperationLifecycle=context[Symbol.for('studyDirector.internalModules.v1')].require('operation-lifecycle',1);context.document={getElementById:()=>null};context.richAssetReferenceRevision=0;context.AppData={dailyRecords:{datasetRevision:async()=>1}};context.storageResetUnresolved=()=>false;vm.runInContext(app.slice(app.indexOf('function backgroundBlocker('),app.indexOf('const BackgroundOperations=')),context);vm.runInContext(app.slice(begin,end),context);const running=vm.runInContext('AttachmentIntegrityJob.run()',context);
  vm.runInContext("scheduleAttachmentIntegrityAudit(5000,'new-attachment')",context);
  const result=await running;
  assert.equal(result.status,'unavailable');assert.equal(context.attachmentIntegrityIssues,retained);assert.equal(cleared,0);assert.equal(writes,failure==='write'?1:0);assert.equal(clock.nextAt(),clock.now()+5000,'a running audit cannot replace a newer five-second request with its later error retry');
  vm.runInContext("scheduleAttachmentIntegrityAudit(60000,'interval')",context);
  assert.equal(clock.nextAt(),clock.now()+5000,'a later recurrence cannot postpone pending work');
  vm.runInContext("scheduleAttachmentIntegrityAudit(2000,'earlier-attachment')",context);
  assert.equal(clock.nextAt(),clock.now()+2000,'a newly requested earlier deadline must pull verification forward');
}

// The integrity path needs only attachment IDs. It must scan the same
// complete, strict canonical sources as the interactive descriptor path.
vm.runInContext(fs.readFileSync('source/core/attachments.js','utf8'),context,{filename:'source/core/attachments.js'});
const Attachments=context[Symbol.for('studyDirector.internalModules.v1')].require('attachments',1);
{
 const refs=Array.from({length:13},(_,i)=>'att-'+String(i).padStart(32,'a'));
 let reads=0,days=0,sessionReads=0,yields=0,scanCalls=0,bad=false;
 const notes=Object.fromEntries(Array.from({length:1000},(_,i)=>['note-'+i,{label:'Note '+i,text:i===999&&bad?'UNTRUSTED':'text '+refs[i%refs.length]}]));
 const records=Array.from({length:1000},(_,i)=>({date:'2026-10-'+String(i+1).padStart(4,'0'),reflection:'diary '+refs[(i+3)%refs.length]}));
 const data={
  notes:{readFreshPayload:async()=>{reads++;return notes;}},
  dailyRecords:{list:async options=>{assert.equal(options.strict,true);days++;return records;}},
  activeSession:{load:async(_,opts)=>{assert.equal(opts.strict,true);sessionReads++;return {ok:true,value:{id:'session',date:'2026-10-01',snapshot:{review:{reflection:refs[12]}}}};}}
 };
 const port=Attachments.createReferenceCoordinator({
  data,scan:text=>{scanCalls++;return {trusted:!String(text).includes('UNTRUSTED'),assetIds:refs.filter(id=>String(text).includes(id)),occurrences:[]};},
  rewriteReferences:async()=>{},withPersistenceSuppressed:fn=>fn(),review:{hydrate:()=>{},invalidateBindings:()=>{}},
  background:{budget:()=>()=>true,yieldTask:async()=>{yields++;}},
  live:{fields:()=>[],reviewDate:()=>'',todayIso:()=>'',noteKey:x=>x}
 });
 const compact=await port.sources({includeLive:false,priority:'background',referencesOnly:true});
 assert.ok(compact instanceof Set);assert.deepEqual([...compact].sort(),refs.slice().sort());
 assert.equal(reads,1);assert.equal(days,1);assert.equal(sessionReads,1);
 assert.ok(yields>=2000,'large inventory yields between descriptors rather than one long synchronous walk');
 const normal=await port.sources({includeLive:false,priority:'background'});
 assert.ok(Array.isArray(normal));assert.equal(normal.length,2001);
 assert.deepEqual([...new Set(normal.flatMap(row=>[...row.ids]))].sort(),[...compact].sort());
 assert.equal(reads,2);assert.equal(days,2);assert.equal(sessionReads,2,'compact mode never duplicates strict whole-source reads');
 assert.ok(scanCalls>=4000);
 notes['note-999'].text='UNTRUSTED';bad=true;
 await assert.rejects(()=>port.sources({includeLive:false,priority:'background',referencesOnly:true}),/could not be verified/);
 await assert.rejects(()=>port.sources({includeLive:false,priority:'background'}),/could not be verified/);
}
// The GC's unresolved-key count replaces a repeated keys.every() traversal.
// Durable source-revision and untrusted-text checks remain the deletion gate.
vm.runInContext(fs.readFileSync('source/core/operation-lifecycle.js','utf8'),context,{filename:'source/core/operation-lifecycle.js'});
vm.runInContext(fs.readFileSync('source/core/asset-maintenance.js','utf8'),context,{filename:'source/core/asset-maintenance.js'});
const Lifecycle=context[Symbol.for('studyDirector.internalModules.v1')].require('operation-lifecycle',1),Maintenance=context[Symbol.for('studyDirector.internalModules.v1')].require('asset-maintenance',1,Object.freeze({lifecycle:Lifecycle}));
function gcFixture(size,{untrusted=false}={}){
 let currentRevision=1,notesRead=0,removed=0,scanned=0,daysRead=0,activeRead=0,callbacks=[],seq=0;
 const ids=Array.from({length:size},(_,i)=>'asset-'+String(i).padStart(6,'0'));
 const notes=Object.fromEntries(ids.map((id,i)=>[id,{text:untrusted&&i===0?'INVALID':'ref '+id}]));
 const ports={
  canMutate:()=>true,mutationActive:()=>false,
  collect:async(operation)=>operation({keys:async()=>ids,removeMany:async collection=>{removed+=collection.length;return collection.length;},sweep:async()=>0,status:()=>({sweepPending:false})}),
  readRestoreJournal:async()=>null,readLibraryClearJournal:async()=>null,liveFields:()=>[],
  getReferenceRevision:()=>currentRevision,getDatasetRevision:async()=>String(currentRevision),
  scanReferences:text=>{scanned++;return {trusted:!text.includes('INVALID'),assetIds:ids.filter(id=>text.includes(id))};},
  readNotes:async()=>{notesRead++;return notes;},loadActiveSession:async()=>{activeRead++;return {ok:true,value:null};},
  listDailyRecords:async()=>{daysRead++;return [];},readPendingReviewTexts:async()=>[],
  budget:()=>()=>false,yieldTask:async()=>{},invalidate:()=>{},captureError:error=>{throw error;},
  setTimeout:(cb,ms)=>{callbacks.push({id:++seq,cb,ms});return seq;},clearTimeout:id=>{callbacks=callbacks.filter(row=>row.id!==id);},
  now:()=>1000
 };
 const runner=Maintenance.create(ports,{lease:{protect:()=>{},release:()=>{},isProtected:()=>false},batchSize:128});
 return {runner,ids,notes,setRevision:v=>{currentRevision=v;},stats:()=>({notesRead,daysRead,activeRead,removed,scanned}),callbacks:()=>callbacks};
}
for(const size of [0,1,128,129,1001]){
 const f=gcFixture(size);
 let result;
 for(let n=0;n<20;n++){
  result=await f.runner.run();if(['completed','clean'].includes(result.status))break;
  assert.equal(result.status,'yielded','large inventory must remain resumable');
 }
 assert.ok(['completed','clean'].includes(result.status),'all referenced keys eventually complete at '+size);
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
 const physical=new Map(),meta=new Map();let reads=0,removed=0;
 const key='asset-retained',name='attblob-'+'c'.repeat(32);
 const physicalDir={
  async *entries(){for(const item of physical.keys())yield [item,{kind:'file'}];},
  async removeEntry(item){if(physical.delete(item))removed++;},
  async getFileHandle(item){if(!physical.has(item))throw Object.assign(new Error('missing'),{name:'NotFoundError'});return {getFile:async()=>physical.get(item)};}
 };
 const physicalLocks={readers:0,async request(_name,options,callback){
   if(typeof options==='function'){callback=options;options={};}
   if(options.mode==='shared'){this.readers++;try{return await callback({});}finally{this.readers--;}}
   if(options.ifAvailable&&this.readers)return callback(null);
   return callback({});
 }};
 const persisted={version:2,storage:'opfs',file:name,hash:'a'.repeat(64),size:1,type:'application/pdf',name:'keep',library:true};
 meta.set(key,persisted);physical.set(name,new Blob(['X']));
 for(let i=0;i<129;i++)physical.set('attblob-'+String(i).padStart(32,'b'),new Blob(['X']));
 const scoped=storageModule.create({name:'mutation-test',protocol:'https:',storage:{getDirectory:async()=>({getDirectoryHandle:async()=>physicalDir})},locks:physicalLocks,
   read:async k=>{reads++;return meta.get(k)||null;},keys:async()=>[...meta.keys()],entries:async()=>[...meta],
   commit:async()=>assert.fail('sweep must not change logical metadata'),validId:k=>/^asset-/.test(k),validType:t=>t==='application/pdf',maxBytes:1024,limitForType:()=>1024,
   issueToken:()=>1,assertToken(){},canMutate:()=>true,ingest:{ingest:async()=>assert.fail('unused')}
 });
 const first=await scoped.collect(async gc=>({removed:await gc.sweep(),pending:gc.status().sweepPending}),{maxEntries:8});
 assert.equal(first.pending,true);assert.ok(first.removed<=8);
 const inserted='attblob-'+'e'.repeat(32);physical.set(inserted,new Blob(['new during iterator']));
 const release=await scoped.retain();
 assert.equal((await scoped.collect(async gc=>gc.sweep())).reason,'active-editor-or-file-operation');
 release();await new Promise(resolve=>setImmediate(resolve));
 for(let n=0;n<30;n++){const step=await scoped.collect(async gc=>({removed:await gc.sweep(),pending:gc.status().sweepPending}),{maxEntries:8});if(!step.pending)break;}
 assert.equal(physical.has(name),true,'published bytes survive all continuation passes');
 assert.equal(physical.has(inserted),false,'new orphan is eventually reconsidered in mock iterator');
 assert.equal(physical.size,1);
 assert.ok(removed>=130);assert.ok(reads>=1);
}
// No safe short-cut for a full metadata fingerprint: the digest must revalidate
// inventory even when a 1001-entry audit is resumed in 128-entry passes.
{
 const many=new Map(Array.from({length:1001},(_,i)=>['asset-'+String(i).padStart(6,'0'),metadata('attblob-'+String(i).padStart(32,'a'),10,false)]));
 let catalogReads=0,progress=null,complete=false,passes=0;
 const store=storageModule.create({name:'large-read',protocol:'https:',storage:{getDirectory:async()=>root},locks,
   read:async k=>many.get(k),keys:async()=>[...many.keys()],entries:async()=>{catalogReads++;return [...many];},
   commit:async()=>assert.fail('read only'),validId:k=>/^asset-/.test(k),validType:t=>t==='application/pdf',maxBytes:1024,limitForType:()=>1024,
   issueToken:()=>1,assertToken(){},canMutate:()=>true,ingest:{ingest:async()=>assert.fail('unused')}
 });
 while(!complete){const result=await store.shallowAudit([],{maxEntries:128,progress});complete=result.complete;progress=result.progress;passes++;assert.ok(passes<12);}
 assert.equal(passes,8);
 assert.equal(catalogReads,passes,'P4 retains fresh metadata validation for every persisted scan continuation');
}

console.log(JSON.stringify({status:'PASS',suite:'attachment-integrity-audit',checked:result.checked,issues:result.issues.map(issue=>issue.kind),yieldCalls,unavailableIsNotCorruption:true,failedMetadataPreservesFindings:true},null,2));
