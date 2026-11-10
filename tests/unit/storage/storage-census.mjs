import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// The storage census measures what this site's storage holds, part by part,
// so a phone that reports gigabytes can say of what. It must stay read-only,
// bounded in time, and free of names, keys and content. The lifecycle record
// must keep the start before a database loss, since that is the evidence.
for(const file of ['source/core/internal.js','source/core/operation-lifecycle.js','source/core/backup-operation-diagnostics.js','source/core/storage-census.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const Census=registry.require('storage-census',1);
const freeze=Object.freeze;
assert.equal(Census.format,'study-director.storage-census');

// Sizes: text by length, files and buffers by size, bounded on cycles.
assert.equal(Census.sizeOf('abcd'),4);
assert.equal(Census.sizeOf({ab:'xyz',n:1}),2+3+1+8);
assert.equal(Census.sizeOf(new Blob(['12345'])),5);
assert.equal(Census.sizeOf(new Uint8Array(10)),10);
const cyclic={a:'x'};cyclic.self=cyclic;assert.equal(Census.sizeOf(cyclic),1+1+4);

// A fake browser storage: database stores, file storage folders and caches.
const PRIVATE='PRIVATE-CONTENT';
const records={
  dailyRecords:[['2026-11-01',{reflection:PRIVATE+'x'.repeat(100)}],['2026-11-02',{reflection:'short'}]],
  notes:[['note-1',{text:PRIVATE}]],
  appMeta:[['reconciliationBase',{data:'r'.repeat(50)}],['pendingReview:'+PRIVATE,{kept:'k'.repeat(20)}],['planDraft',{text:'p'.repeat(10)}],[PRIVATE+'-unknown',{v:1}]]
};
const stores=['dailyRecords','dailySummaries','notes','activeSessions','appMeta','assets'].map(id=>freeze({id,name:id}));
const readStore=async(name,visit)=>{for(const [key,value] of records[name]||[])if(visit(key,value)===false)return false;return true;};
const file=(name,size,{unreadable=false}={})=>({kind:'file',name,getFile:async()=>{if(unreadable)throw Object.assign(new Error('locked'),{name:'NoModificationAllowedError'});return {size};}});
const folder=(name,children)=>({kind:'directory',name,async *values(){yield* children;},async *entries(){for(const child of children)yield [child.name,child];}});
const root=folder('',[
  folder('study-director-assets-v2',[folder('nested',[file('a',100),file('b',50)])]),
  folder('study-director-backup-files-v1~abc',[file(PRIVATE+'1',4_000_000_000),file('2',10),file('3',5,{unreadable:true})]),
  folder('study-director-assets-v1',[file('old',7)]),
  folder(PRIVATE+'-folder',[file('x',3)]),
  file(PRIVATE+'-stray',2)
]);
const classifyFolder=name=>{const is=base=>name===base||name.startsWith(base+'~');return is('study-director-assets-v2')?'attachment':is('study-director-backup-files-v1')?'scratch':is('study-director-assets-v1')?'oldFolder':'other';};
const response=(size,type='basic')=>({type,blob:async()=>new Blob([new Uint8Array(size)])});
const cacheStorage={keys:async()=>['shell-a','shell-b'],open:async name=>({keys:async()=>name==='shell-a'?['index','app']:['opaque'],match:async request=>request==='opaque'?response(0,'opaque'):response(request==='index'?1000:2000)})};
const usageDetails={indexedDB:1000,fileSystem:4_000_000_200,caches:3000,serviceWorkerRegistrations:40,other:5};
const estimate=async()=>({usage:4_300_000_000,quota:15_000_000_000,usageDetails});

const result=await Census.measure({now:()=>0,budgetMs:2000,estimate,stores,readStore,fileRoot:async()=>root,classifyFolder,caches:cacheStorage});
const text=JSON.stringify(result);
assert.doesNotMatch(text,/PRIVATE/u,'no name, key or content reaches the census');
assert.equal(result.summary.state,'observed');
assert.equal(result.summary.usageBytes,4_300_000_000);
assert.equal(result.summary.reportedFileBytes,4_000_000_200,'the browser\'s own breakdown is kept, by kind');
assert.equal(result.summary.reportedDatabaseBytes,1000);
assert.equal(result.summary.reportedOtherBytes,5);
assert.equal(result.database.savedDayRecords,2);assert.equal(result.database.noteRecords,1);assert.equal(result.database.metaRecords,4);assert.equal(result.database.records,7);
assert.ok(result.database.savedDayBytes>100,'record sizes are counted');
assert.ok(result.meta.reconciliationMetaBytes>50&&result.meta.reviewMetaBytes>20&&result.meta.planMetaBytes>10&&result.meta.otherMetaBytes>0,'appMeta is grouped by family, never by key');
assert.deepEqual([result.files.attachmentFiles,result.files.attachmentFileBytes],[2,150]);
assert.deepEqual([result.files.scratchFiles,result.files.scratchFileBytes,result.files.unreadableFiles],[3,4_000_000_010,1],'a file another task holds open is counted as unreadable, not skipped');
assert.deepEqual([result.files.oldFolderFiles,result.files.oldFolderFileBytes],[1,7]);
assert.deepEqual([result.files.otherEntries,result.files.otherFiles,result.files.otherFileBytes],[2,2,5],'a folder or file the app does not know shows up as other');
assert.deepEqual([result.caches.caches,result.caches.cacheRequests,result.caches.cacheBytes,result.caches.unmeasuredResponses],[2,3,3000,1]);
const measured=result.database.databaseBytes+result.files.fileBytes+result.caches.cacheBytes;
assert.equal(result.summary.measuredBytes,measured);
assert.equal(result.summary.unexplainedBytes,4_300_000_000-measured,'the gap to the browser\'s figure is shown');

// Out of time: what was counted so far is partial, and no gap is claimed.
let clock=0;const slow=async(name,visit)=>{for(let i=0;i<1000;i++){clock+=10;if(visit('k'+i,{v:i})===false)return false;}return true;};
const partial=await Census.measure({now:()=>clock,budgetMs:200,estimate,stores,readStore:slow});
assert.equal(partial.database.state,'partial');assert.ok(partial.database.records>0&&partial.database.records<1000);
assert.equal(partial.summary.state,'partial');assert.equal(partial.summary.unexplainedBytes,undefined);

// A part that fails or is missing never fails the census.
const broken=await Census.measure({now:()=>0,estimate,stores,readStore,fileRoot:async()=>{throw new Error('no file storage');},caches:null});
assert.equal(broken.files.state,'unavailable');assert.equal(broken.caches.state,'unavailable');assert.equal(broken.summary.state,'partial');assert.equal(broken.summary.unexplainedBytes,undefined);
assert.equal((await Census.measure({now:()=>0})).summary.state,'unavailable');

// The lifecycle record: this start, and the start before a loss.
const L=Census.lifecycle;
assert.deepEqual(L.read({format:'x'}),{format:'study-director.database-lifecycle',version:1,current:null,beforeLoss:null},'anything unrecognised reads as no record');
let record=L.start(null,{startedAt:'2026-11-07T08:00:00.000Z',fresh:false,foundVersion:9,openedVersion:9});
record=L.update(record,{counts:{dailyRecords:40,notes:12,appMeta:30,activeSessions:1},countedAt:'2026-11-07T08:00:01.000Z',lastWriteAt:'2026-11-07T09:30:00.000Z',storageErrors:2,lastError:'QuotaExceededError',lastErrorAt:'2026-11-07T09:00:00.000Z'});
assert.equal(record.current.records,83);assert.equal(record.current.savedDayRecords,40);assert.equal(record.current.lastError,'QuotaExceededError');assert.equal(record.beforeLoss,null);
assert.equal(L.update(record,{lastError:PRIVATE}).current.lastError,'Error','only storage error names are kept');
assert.doesNotMatch(JSON.stringify(L.update(record,{note:PRIVATE,[PRIVATE]:1})),/PRIVATE/u,'unknown fields are dropped');
// The next start finds a new, empty database: the earlier start is the evidence.
const lost=L.start(JSON.parse(JSON.stringify(record)),{startedAt:'2026-11-08T16:13:50.000Z',fresh:true,foundVersion:0,openedVersion:9});
assert.equal(lost.current.fresh,true);assert.equal(lost.current.records,undefined);
assert.equal(lost.beforeLoss.records,83);assert.equal(lost.beforeLoss.lastWriteAt,'2026-11-07T09:30:00.000Z');assert.equal(lost.beforeLoss.lastError,'QuotaExceededError');assert.equal(lost.beforeLoss.detectedAt,'2026-11-08T16:13:50.000Z');
// Later normal starts keep it; a fresh install with nothing before keeps none.
const later=L.start(L.update(lost,{counts:{dailyRecords:40}}),{startedAt:'2026-11-09T06:00:00.000Z',fresh:false,foundVersion:9,openedVersion:9});
assert.equal(later.beforeLoss.detectedAt,'2026-11-08T16:13:50.000Z');assert.equal(later.current.fresh,false);
assert.equal(L.start(null,{startedAt:'2026-11-09T06:00:00.000Z',fresh:true,foundVersion:0,openedVersion:9}).beforeLoss,null);
// A database recreated while the app is open keeps this start as the evidence.
assert.equal(L.noteLoss(record,'2026-11-07T10:00:00.000Z').beforeLoss.records,83);

// Copy diagnostics prints the new lines with their fields, and nothing else.
const Diagnostics=registry.require('backup-operation-diagnostics',1,freeze({lifecycle:registry.require('operation-lifecycle',1)}));
const recorder=Diagnostics.createRecorder(freeze({configuration:freeze({release:'test',limit:3}),environment:freeze({now:()=>Date.parse('2026-11-10T00:00:00.000Z')}),storage:freeze({read:()=>'',write:()=>true})}));
const copied=recorder.text([
  {...result.summary,job:'Storage census'},{...result.database,job:'Storage census database'},{...result.meta,job:'Storage census settings data'},{...result.files,job:'Storage census files'},{...result.caches,job:'Storage census caches'},
  {...later.current,job:'Database this start',state:'existing'},{...later.beforeLoss,job:'Database before last loss',state:'recorded'},{job:'Database this start',state:'existing',lastError:PRIVATE}
]);
assert.match(copied,/Current Storage census: state=observed · .*usageBytes=4300000000/u);
assert.match(copied,/unexplainedBytes=\d+/u);
assert.match(copied,/Current Storage census files: .*scratchFileBytes=4000000010/u);
assert.match(copied,/Current Storage census settings data: .*reconciliationMetaBytes=\d+/u);
assert.match(copied,/Current Storage census caches: .*cacheBytes=3000/u);
assert.match(copied,/Current Database before last loss: state=recorded · .*lastWriteAt=2026-11-07T09:30:00.000Z.*lastError=QuotaExceededError.*detectedAt=2026-11-08T16:13:50.000Z/u);
assert.match(copied,/Current Database before last loss: .*records=83/u);
assert.doesNotMatch(copied,/PRIVATE/u);

console.log(JSON.stringify({status:'PASS',suite:'storage-census',readOnlyFakes:true,partialOnBudget:true,failedPartsContained:true,lossEvidenceKept:true,diagnosticsLines:true}));
