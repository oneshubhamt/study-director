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

const originalGet=dir.getFileHandle;
dir.getFileHandle=async()=>{throw Object.assign(new Error('permission unavailable'),{name:'NotAllowedError'});};
await assert.rejects(store.shallowAudit(['asset-good']),{name:'NotAllowedError'},'unavailable file access must not become a missing-file finding');dir.getFileHandle=originalGet;

// Execute the host audit's commit boundary: old findings must survive both a
// metadata read failure and failure to durably save a newly clean scan.
const app=fs.readFileSync('source/app.html','utf8'),begin=app.indexOf('let attachmentIntegrityView='),end=app.indexOf('const REPOSITORY_INTEGRITY_BATCH_BYTES=',begin);
for(const failure of ['read','write']){
  const clock=createFakeClock();let cleared=0,writes=0;const retained=new Map([['asset-good',{kind:'size-mismatch'}]]),scheduled=[];
  const context=vm.createContext({console,Object,Map,Date:clock.Date,Promise,Symbol,TypeError,StartupLifecycle:{status:()=>({fullyInitialized:true})},APP_META_KEYS:{attachmentIntegrityAudit:'integrity'},AttachmentsModule:{validId:value=>/^asset-/.test(value)},attachmentIntegrityIssues:retained,
    readHostAppMetaValue:async()=>{if(failure==='read')throw new Error('read unavailable');return {version:1,checkedAt:'',issues:[{id:'asset-good',kind:'size-mismatch'}]};},
    writeHostAppMetaValue:async(_,__,options)=>{writes++;assert.equal(options.strict,true);throw new Error('write unavailable');},
    AttachmentStorage:{supported:()=>true,shallowAudit:async()=>({checked:1,issues:[]})},AttachmentReferences:{sources:async()=>[{ids:['asset-good']}]},
    AppDiagnostics:{capture(){}},BackupOperationDiagnostics:{start:()=>'',mark(){},finish(){},fail(){}},appCanMutate:()=>true,backgroundMaintenanceForegroundBusy:()=>false,
    BackgroundTasks:{yieldTask:async()=>{},budget:()=>()=>false},markStorageHealthError(){},markStorageHealthOk(){cleared++;},invalidateAttachmentLibrary(){},
    setTimeout:(_fn,ms)=>{scheduled.push(ms);return scheduled.length;},clearTimeout(){}
  });
  for(const file of ['internal','operation-lifecycle'])vm.runInContext(fs.readFileSync(`source/core/${file}.js`,'utf8'),context);context.OperationLifecycle=context[Symbol.for('studyDirector.internalModules.v1')].require('operation-lifecycle',1);context.document={getElementById:()=>null};context.richAssetReferenceRevision=0;context.AppData={dailyRecords:{datasetRevision:async()=>1}};context.storageResetUnresolved=()=>false;vm.runInContext(app.slice(app.indexOf('function backgroundBlocker('),app.indexOf('const BackgroundOperations=')),context);vm.runInContext(app.slice(begin,end),context);const result=await vm.runInContext('AttachmentIntegrityJob.run()',context);
  assert.equal(result.status,'unavailable');assert.equal(context.attachmentIntegrityIssues,retained);assert.equal(cleared,0);assert.equal(writes,failure==='write'?1:0);assert.equal(scheduled.at(-1),30*60*1000);
}

console.log(JSON.stringify({status:'PASS',suite:'attachment-integrity-audit',checked:result.checked,issues:result.issues.map(issue=>issue.kind),yieldCalls,unavailableIsNotCorruption:true,failedMetadataPreservesFindings:true},null,2));
