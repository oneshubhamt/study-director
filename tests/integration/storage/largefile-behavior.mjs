import {createNotifications} from '../../helpers/notifications.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {drainMicrotasks,nextTurn} from '../../helpers/async-tools.mjs';

const MiB=1048576;
function loadModule(files,name){
  const context={console,Blob,DOMException,AbortController,TextEncoder,TextDecoder,URL,crypto:webcrypto,Map,Set,Object,Promise,Number,String,Math,Uint8Array,Uint32Array,DataView,queueMicrotask,setTimeout,clearTimeout,Symbol};
  context.globalThis=context;vm.createContext(context);
  for(const file of files)vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
  return {context,module:context[Symbol.for('studyDirector.internalModules.v1')].require(name,1)};
}

// Coordinator: a 260 MiB attachment is admitted by quota rather than an arbitrary byte ceiling.
{
  const {module}=loadModule(['source/core/internal.js','source/core/attachment-ingest.js'],'attachment-ingest');
  let estimateCalls=0;const posted=[];
  const worker={terminate(){},postMessage(message){posted.push(message);if(message.type==='ingest')queueMicrotask(()=>{this.onmessage?.({data:{id:message.id,progress:{phase:'copying',loaded:130*MiB,total:260*MiB,mode:'sync'}}});this.onmessage?.({data:{id:message.id,value:{storageName:message.data.storageName,hash:'a'.repeat(64),size:260*MiB,mode:'sync'}}});});}};
  const coordinator=module.create({createWorker:()=>worker,storage:{estimate:async()=>{estimateCalls++;return {quota:1024*MiB,usage:100*MiB};}},randomUUID:()=> '12345678-1234-1234-1234-123456789012'});
  const virtual=Object.create(Blob.prototype);Object.defineProperty(virtual,'size',{value:260*MiB});
  let progressCalls=0;
  const result=await coordinator.ingest(virtual,{onProgress:progress=>{progressCalls++;if(progress.phase==='copying')throw new Error('UI callback failure must be isolated');}});
  assert.equal(result.size,260*MiB);assert.equal(result.mode,'sync');assert.equal(estimateCalls,1);assert.ok(progressCalls>=2);assert.equal(posted.filter(row=>row.type==='ingest').length,1);
  console.log('ok - 260 MiB admission is quota-based and progress callback failures are isolated');
}

// Quota failure and pre-aborted requests stop before worker ingestion.
{
  const {module}=loadModule(['source/core/internal.js','source/core/attachment-ingest.js'],'attachment-ingest');
  let estimateCalls=0,workerPosts=0;
  const worker={terminate(){},postMessage(){workerPosts++;}};
  const virtual=Object.create(Blob.prototype);Object.defineProperty(virtual,'size',{value:260*MiB});
  const low=module.create({createWorker:()=>worker,storage:{estimate:async()=>{estimateCalls++;return {quota:300*MiB,usage:40*MiB};}},randomUUID:()=> '12345678-1234-1234-1234-123456789012'});
  await assert.rejects(()=>low.ingest(virtual),error=>error?.name==='QuotaExceededError');
  assert.equal(workerPosts,0,'quota rejection must happen before worker ingestion');
  const controller=new AbortController();controller.abort();estimateCalls=0;
  await assert.rejects(()=>low.ingest(virtual,{signal:controller.signal}),error=>error?.name==='AbortError');
  assert.equal(estimateCalls,0,'already-aborted ingestion must not even perform quota estimation');
  console.log('ok - quota and pre-abort gates fail early');
}

function element(id=''){
  const listeners=new Map();
  return {id,open:true,value:'',textContent:'',hidden:false,children:[],get childNodes(){return this.children;},dataset:{},scrollTop:0,files:[],max:1,
    classList:{add(){},toggle(){},remove(){}},setAttribute(){},removeAttribute(name){if(name==='value')delete this.value;},hasAttribute(){return false},
    addEventListener(type,fn){listeners.set(type,fn)},emit(type,event={}){return listeners.get(type)?.({target:this,preventDefault(){},stopImmediatePropagation(){},...event})},
    append(...nodes){this.children.push(...nodes)},appendChild(node){this.children.push(node)},replaceChildren(...nodes){this.children=[...nodes]},
    querySelector(){return null},querySelectorAll(){return []},closest(){return null},focus(){},scrollIntoView(){},load(){},pause(){},click(){return this.emit('click')}
  };
}

// Library-originated ingestion bypasses the global file-job coordinator; Cancel aborts only its own signal.
{
  const {module}=loadModule(['source/core/internal.js','source/core/attachments.js'],'attachments');
  const ids=new Map();
  for(const id of ['library-attachments','attachment-status','attachment-preview','attachment-detail','attachment-list','attachment-search','attachment-count','attachment-cancel','attachment-add','attachment-files','attachment-import','attachment-archive','attachment-export','attachment-progress','attachment-progress-bar','attachment-progress-label','attachment-progress-value'])ids.set(id,element(id));
  let jobCalls=0,cancelCalls=0,putStarted=false,putAborted=false;const lateProgress=[];
  const {coordinator,port}=createNotifications('attachments');
  const document={activeElement:null,getElementById:id=>ids.get(id)||element(id),querySelectorAll(){return []},querySelector(){return null},createElement:tag=>element(tag),createDocumentFragment:()=>element('fragment'),addEventListener(){}};
  const html=fs.readFileSync('source/app.html','utf8');
  vm.runInNewContext(html.slice(html.indexOf('function renderNotificationSurfaces(state){'),html.indexOf('const BackupPresentation=')),{NoticeCoordinator:coordinator,document});
  const store={
    requireAvailable(){},during:fn=>fn(),list:async()=>[],discard:async()=>0,publish:async()=>1,
    put:async(_id,blob,options)=>{putStarted=true;lateProgress.push(options.onProgress);options.onProgress?.({phase:'copying',loaded:1,total:blob.size,mode:'async'});return await new Promise((resolve,reject)=>{const onAbort=()=>{putAborted=true;const error=new Error('cancelled');error.name='AbortError';reject(error)};options.signal?.addEventListener('abort',onAbort,{once:true});});},
    get:async()=>null,collect:async fn=>fn({sweep:async()=>0,removeMany:async()=>0}),setLibrary:async()=>{},rename:async()=>{}
  };
  const processing={check(){},job:async fn=>{jobCalls++;return fn()},cancel(){cancelCalls++;},run:async()=>'',chooseSave:async()=>null,download(){}};
  const library=module.create({notifications:port,store,processing,document,interactions:{choose:async()=>null,confirm:async()=>false,notify(){},input:async()=>null},canMutate:()=>true,requireOwner(){},token:()=>1,isActive:()=>true,cleanup(){},renderReference(){},sources:async()=>[],destinations:async()=>[],settle:async()=>{},openLibrary(){},openSource(){},deletionGuard:async()=>()=>true,runExclusive:async(_k,fn)=>fn(),removeReferences:async()=>null,insert:async()=>{}});
  library.install();
  const file=new Blob(['%PDF-1.4\nfixture']);Object.defineProperty(file,'name',{value:'large.pdf'});ids.get('attachment-files').files=[file];ids.get('attachment-files').emit('change');
  await drainMicrotasks();assert.equal(putStarted,true);assert.equal(jobCalls,0,'ingestion must bypass global processing.job');
  ids.get('attachment-cancel').click();await drainMicrotasks();assert.equal(putAborted,true);assert.equal(cancelCalls,0,'ingest cancellation must not call global processing.cancel');
  assert.equal(coordinator.readEvent('attachments','attachment-operation').lifecycle,'cancelled');
  lateProgress[0]({phase:'copying',loaded:9,total:10});assert.equal(ids.get('attachment-progress').hidden,true,'late progress must not reopen a cancelled panel');
  store.put=async(_id,blob,options)=>{lateProgress.push(options.onProgress);return {size:blob.size,type:blob.type};};
  ids.get('attachment-files').files=[file];ids.get('attachment-files').emit('change');for(let turn=0;turn<30&&library.status().busy;turn++)await nextTurn();
  assert.equal(coordinator.readEvent('attachments','attachment-operation').lifecycle,'succeeded');
  const completed=ids.get('attachment-status').textContent;assert.match(completed,/Added 1 attachment/);lateProgress[0]({phase:'copying',loaded:1,total:10});lateProgress[1]({phase:'copying',loaded:1,total:10});
  assert.equal(ids.get('attachment-status').textContent,completed,'old and terminal callbacks cannot overwrite the new outcome');assert.equal(ids.get('attachment-progress').hidden,true);assert.equal(coordinator.eventStatus().toasts.length,1);
  let releaseUpload;store.put=async(_id,blob,options)=>{lateProgress.push(options.onProgress);await new Promise(resolve=>{releaseUpload=resolve;});return {size:blob.size,type:blob.type};};
  const upload=library.add(file);for(let turn=0;turn<30&&!releaseUpload;turn++)await nextTurn();assert.ok(releaseUpload);
  const newer=port.begin({id:'attachment-export',surfaceId:'attachment-status'});newer.finish('succeeded','Newer export verified.');
  lateProgress.at(-1)({phase:'copying',loaded:1,total:10});assert.equal(ids.get('attachment-status').textContent,'Newer export verified.');releaseUpload();await upload;assert.equal(ids.get('attachment-status').textContent,'Newer export verified.');coordinator.clear();
  console.log('ok - library ingestion and cancellation are isolated from export/backup coordinator');
}

console.log(JSON.stringify({status:'PASS',suite:'largefile-behavior',pass:'large-file + concurrency behavior'},null,2));
