import {readScript} from '../../../build/source-script.mts';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {createFakeClock} from '../../helpers/fake-clock.mjs';

const repositories=readScript('source/core/repositories.ts');
const id='att-'+'a'.repeat(32),otherId='att-'+'c'.repeat(32);
async function fixture(){
  const clock=createFakeClock();
  const context={crypto:webcrypto,TextEncoder,Uint8Array,console,Blob,Object,Set,Map,Math,Number,String,Promise,Date:clock.Date,Error,TypeError,Symbol,structuredClone,HTMLButtonElement:class HTMLButtonElement{}};context.globalThis=context;vm.createContext(context);
  for(const file of ['source/core/internal.ts','source/core/operation-lifecycle.ts','source/core/asset-storage.ts','source/core/attachments.ts','source/core/backup-integrity-host.ts'])vm.runInContext(readScript(file),context,{filename:file});
  const registry=context[Symbol.for('studyDirector.internalModules.v1')],Assets=registry.require('asset-storage',1),Attachments=registry.require('attachments',1),IntegrityHost=registry.require('backup-integrity-host',1);
  const metadata={version:2,storage:'opfs',file:'attblob-'+'b'.repeat(32),hash:'a'.repeat(64),size:10,type:'application/pdf',name:'fixture.pdf',library:false};
  const dir={getFileHandle:async()=>{throw Object.assign(new Error('missing'),{name:'NotFoundError'});}},storageRoot={getDirectoryHandle:async()=>dir};
  const locks={request(_name,options,callback){if(typeof options==='function')callback=options;return Promise.resolve(callback({name:'lock'}));}};
  const store=Assets.create({name:'test',protocol:'https:',storage:{getDirectory:async()=>storageRoot},locks,read:async()=>metadata,keys:async()=>[id,otherId],entries:async()=>[[id,metadata],[otherId,metadata]],commit:async()=>{throw new Error('Read-only audit must not mutate attachments');},validId:Attachments.validId,validType:Attachments.validType,maxBytes:1024,limitForType:()=>1024,issueToken:()=>1,assertToken(){},canMutate:()=>true,ingest:{ingest:async()=>{throw new Error('unused');}}});
  let failure='',empty=false,writes=0,healthy=0,rewrites=0;
  const dayContext={LocalStorageContract:{lastError:null},fallbackDailyRecordsGet:()=>[],filterPendingDeletedEntities:value=>value,mergeDailyRecordSets:rows=>rows,idbAllRecords:async()=>{if(failure==='saved-days')throw new Error('Saved Days read unavailable');return !empty&&failure.startsWith('saved-days')?[{date:'2026-10-01',reflection:'REFERENCE'}]:[];},isCanonicalRuntimeError:()=>false,showStorageFallbackWarning(){},materializeDailyRecordView:value=>value,confirmDailyRecordStorage(){}};
  // The actual reader supplies the strict-vs-interactive fallback behaviour.
  vm.createContext(dayContext);vm.runInContext(repositories.slice(repositories.indexOf('async function getDailyRecords('),repositories.indexOf('async function removeDailyRecord(')),dayContext);
  const session={id:'current',date:'2026-10-02',snapshot:{review:{reflection:'REFERENCE'}}};
  const data={notes:{readFreshPayload:async()=>({})},dailyRecords:{list:dayContext.getDailyRecords,datasetRevision:async()=>1},activeSession:{load:async()=>{
    if(failure==='active-session')return {ok:false,value:null,error:new Error('Active Session read unavailable'),storage:{idb:false,local:false}};
    if(failure==='session-rescue')return {ok:true,value:session,error:new Error('Active Session read unavailable'),storage:{idb:false,local:true}};
    if(failure==='session-no-error')return {ok:false,value:null,error:null};
    return {ok:true,value:empty||failure.startsWith('saved-days')?null:session,error:null};
  }}};
  const background={budget:()=>()=>false,yieldTask:async()=>{}};
  const references=Attachments.createReferenceCoordinator({data,scan:text=>({trusted:true,assetIds:text==='REFERENCE'?[id]:[],occurrences:[]}),rewriteReferences:async()=>{rewrites++;},withPersistenceSuppressed:work=>work(),review:{hydrate:async()=>{},invalidateBindings(){}},background,live:{fields:()=>[],reviewDate:()=>'',todayIso:()=>'',noteKey:value=>value}});
  let durable={version:2,checkedAt:'',attemptedAt:'',lastOutcome:'yielded',issues:[{id,kind:'missing-file'}],progress:null};const scheduled=[],warnings=[];
  const controller=IntegrityHost.createController(Object.freeze({
    lifecycle:registry.require('operation-lifecycle',1),
    meta:Object.freeze({
      read:async()=>durable,
      write:async(_key,state,options)=>{assert.equal(options.strict,true);durable=state;writes++;return {family:'integrity',value:state,updatedAt:new clock.Date().toISOString()};},
      transaction:async()=>{throw new Error('repository integrity path is not used by this attachment witness');}
    }),
    attachmentMetadataName:'integrity',repositoryMetadataName:'repository-integrity',storage,references,validAttachmentId:Attachments.validId,
    data:Object.freeze({datasetRevision:()=>data.dailyRecords.datasetRevision()}),referenceRevision:()=>0,authority:Object.freeze({canMutate:()=>true}),
    background:Object.freeze({upkeepBlocker:()=>'',backgroundBlocker:()=>'',foregroundBusy:()=>false}),backgroundTasks:background,
    provider:Object.freeze({backgroundStatus:()=>[],locationStatus:()=>null,repositoryScope:async()=>'',requestIntegrity:()=>false}),
    continuation:Object.freeze({verify:async()=>{throw new Error('repository continuation is unused');}}),normalizeContinuation:()=>null,
    unsafe:Object.freeze({mutation:()=>false,attachmentIngest:()=>false}),
    storageHealth:Object.freeze({markError:(_kind,message)=>warnings.push(message),markOk:()=>{healthy++;}}),invalidateAttachmentLibrary(){},
    diagnostics:Object.freeze({capture(){},start:()=>'',mark(){},finish(){},fail(){}}),
    document:{getElementById:()=>null,createElement:()=>({})},
    environment:Object.freeze({now:()=>clock.now(),nowIso:()=>new clock.Date().toISOString(),uuid:()=> '00000000-0000-0000-0000-000000000001',setTimeout:(_callback,ms)=>{scheduled.push(ms);return scheduled.length;},clearTimeout(){}}),
    limits:Object.freeze({attachmentIntervalMs:24*60*60*1000,attachmentRetryMs:10*60*1000,repositoryBatchObjects:4,repositoryBatchBytes:256*1024*1024})
  }));
  await controller.installAttachment();controller.attachmentJob.clear();scheduled.length=0;
  return {context,data,references,store,controller,scheduled,warnings,setFailure:value=>{failure=value;},empty:()=>{empty=true;},setProgress:value=>{durable={...durable,progress:value};},stats:()=>({durable,writes,healthy,rewrites})};
}
const cases=[];
for(const failure of ['active-session','session-rescue','saved-days'])for(const partial of [false,true]){
  const t=await fixture();if(partial){const audit=await t.store.shallowAudit([id],{maxEntries:1});assert.equal(audit.complete,false);t.setProgress(audit.progress);}
  const before=JSON.stringify(t.stats().durable);t.setFailure(failure);
  if(failure==='saved-days')assert.equal((await t.data.dailyRecords.list()).length,0,'interactive Saved Days reading keeps its existing rescue fallback');
  const result=await t.controller.attachmentJob.run();assert.equal(result.status,'unavailable');
  assert.equal(JSON.stringify(t.stats().durable),before,'source unavailability must preserve completion date, progress and earlier warnings');
  assert.equal(t.stats().writes,0);assert.equal(t.stats().healthy,0);assert.equal(t.controller.attachmentIssue(id)?.kind,'missing-file');
  assert.equal(t.scheduled.at(-1),30*60*1000,'unavailable sources use recovery retry rather than daily completion');
  assert.match(t.warnings.at(-1),/Previous findings are retained/);
  assert.equal(t.controller.attachmentState()?.lastOutcome,'unavailable','developer verification status must explain the incomplete scan');
  await assert.rejects(()=>t.references.verifyAbsent(id));await assert.rejects(()=>t.references.removeEverywhere(id));assert.equal(t.stats().rewrites,0,'incomplete reference inventory cannot authorize reference surgery');
  t.setFailure(failure==='saved-days'?'saved-days-recovered':'');
  const recovered=await t.controller.attachmentJob.run();assert.equal(recovered.status,'completed','source recovery must resume without a false not-due gate');
  assert.equal(t.stats().writes,1);assert.equal(t.stats().durable.issues[0]?.kind,'missing-file');assert.equal(t.stats().durable.progress,null);assert.ok(t.stats().durable.checkedAt);
  cases.push(failure+(partial?' retains partial cursor':' retains findings'));
}
{
  const t=await fixture();t.setFailure('session-no-error');await assert.rejects(()=>t.references.sources(),/could not be read completely/);cases.push('failed session without error rejects');
}
{
  const t=await fixture();t.empty();const result=await t.controller.attachmentJob.run();
  assert.equal(result.status,'completed');assert.equal(result.checked,0);assert.equal(t.stats().durable.issues.length,0);assert.ok(t.stats().durable.checkedAt);assert.equal(t.stats().healthy,1);
  cases.push('valid empty reference sources can complete cleanly');
}
console.log(JSON.stringify({status:'PASS',suite:'attachment-reference-recovery',cases},null,2));
