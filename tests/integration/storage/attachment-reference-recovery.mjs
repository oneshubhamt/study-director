import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {createFakeClock} from '../../helpers/fake-clock.mjs';

const app=fs.readFileSync('source/app.html','utf8'),repositories=fs.readFileSync('source/core/repositories.js','utf8');
const id='att-'+'a'.repeat(32),otherId='att-'+'c'.repeat(32);
function fixture(){
  const clock=createFakeClock();
  const context={crypto:webcrypto,TextEncoder,Uint8Array,console,Blob,Object,Set,Map,Math,Number,String,Promise,Date:clock.Date,TypeError,Symbol,structuredClone};context.globalThis=context;vm.createContext(context);
  for(const file of ['source/core/internal.js','source/core/operation-lifecycle.js','source/core/asset-storage.js','source/core/attachments.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
  const registry=context[Symbol.for('studyDirector.internalModules.v1')],Assets=registry.require('asset-storage',1),Attachments=registry.require('attachments',1);
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
  Object.assign(context,{OperationLifecycle:registry.require('operation-lifecycle',1),StartupLifecycle:{status:()=>({fullyInitialized:true})},APP_META_KEYS:{attachmentIntegrityAudit:'integrity'},AttachmentsModule:Attachments,AttachmentStorage:store,AttachmentReferences:references,attachmentIntegrityIssues:new Map([[id,{kind:'missing-file'}]]),AppData:data,richAssetReferenceRevision:0,
    readHostAppMetaValue:async()=>durable,writeHostAppMetaValue:async(_key,state,options)=>{assert.equal(options.strict,true);durable=state;writes++;},AppDiagnostics:{capture(){}},BackupOperationDiagnostics:{start:()=>'',mark(){},finish(){},fail(){}},appCanMutate:()=>true,UnsupportedData:{held:()=>false},backgroundMaintenanceForegroundBusy:()=>false,BackgroundTasks:background,
    markStorageHealthError:(_kind,message)=>warnings.push(message),markStorageHealthOk(){healthy++;},invalidateAttachmentLibrary(){},renderIntegrityStatuses(){},setTimeout:(_callback,ms)=>{scheduled.push(ms);return scheduled.length;},clearTimeout(){}});
  // The shared background gate, as the app defines it.
  context.storageResetUnresolved=()=>false;vm.runInContext(app.slice(app.indexOf('function backgroundBlocker('),app.indexOf('const BackgroundOperations=')),context);
  vm.runInContext(app.slice(app.indexOf('const ATTACHMENT_INTEGRITY_META_KEY='),app.indexOf('const REPOSITORY_INTEGRITY_BATCH_BYTES=')),context);
  return {context,data,references,store,scheduled,warnings,setFailure:value=>{failure=value;},empty:()=>{empty=true;},setProgress:value=>{durable={...durable,progress:value};},stats:()=>({durable,writes,healthy,rewrites})};
}
const cases=[];
for(const failure of ['active-session','session-rescue','saved-days'])for(const partial of [false,true]){
  const t=fixture();if(partial){const audit=await t.store.shallowAudit([id],{maxEntries:1});assert.equal(audit.complete,false);t.setProgress(audit.progress);}
  const before=JSON.stringify(t.stats().durable);t.setFailure(failure);
  if(failure==='saved-days')assert.equal((await t.data.dailyRecords.list()).length,0,'interactive Saved Days reading keeps its existing rescue fallback');
  const result=await vm.runInContext('AttachmentIntegrityJob.run()',t.context);assert.equal(result.status,'unavailable');
  assert.equal(JSON.stringify(t.stats().durable),before,'source unavailability must preserve completion date, progress and earlier warnings');
  assert.equal(t.stats().writes,0);assert.equal(t.stats().healthy,0);assert.ok(t.context.attachmentIntegrityIssues.has(id));
  assert.equal(t.scheduled.at(-1),30*60*1000,'unavailable sources use recovery retry rather than daily completion');
  assert.match(t.warnings.at(-1),/Previous findings are retained/);
  assert.equal(vm.runInContext('attachmentIntegrityView.lastOutcome',t.context),'unavailable','developer verification status must explain the incomplete scan');
  await assert.rejects(()=>t.references.verifyAbsent(id));await assert.rejects(()=>t.references.removeEverywhere(id));assert.equal(t.stats().rewrites,0,'incomplete reference inventory cannot authorize reference surgery');
  t.setFailure(failure==='saved-days'?'saved-days-recovered':'');
  const recovered=await vm.runInContext('AttachmentIntegrityJob.run()',t.context);assert.equal(recovered.status,'completed','source recovery must resume without a false not-due gate');
  assert.equal(t.stats().writes,1);assert.equal(t.stats().durable.issues[0]?.kind,'missing-file');assert.equal(t.stats().durable.progress,null);assert.ok(t.stats().durable.checkedAt);
  cases.push(failure+(partial?' retains partial cursor':' retains findings'));
}
{
  const t=fixture();t.setFailure('session-no-error');await assert.rejects(()=>t.references.sources(),/could not be read completely/);cases.push('failed session without error rejects');
}
{
  const t=fixture();t.empty();const result=await vm.runInContext('AttachmentIntegrityJob.run()',t.context);
  assert.equal(result.status,'completed');assert.equal(result.checked,0);assert.equal(t.stats().durable.issues.length,0);assert.ok(t.stats().durable.checkedAt);assert.equal(t.stats().healthy,1);
  cases.push('valid empty reference sources can complete cleanly');
}
console.log(JSON.stringify({status:'PASS',suite:'attachment-reference-recovery',cases},null,2));
