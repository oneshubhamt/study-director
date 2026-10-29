import {readScript} from '../../../build/source-script.mts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {APP_META_KEYS,APP_META_RUNTIME_REGISTRY} from '../../../contracts/data-architecture.mjs';

for(const file of ['source/core/internal.js','source/core/app-meta.ts','source/core/host-metadata.ts','source/core/operation-lifecycle.ts','source/core/repository-background.ts'])vm.runInThisContext(readScript(file),{filename:file});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')],freeze=Object.freeze;
const AppMeta=registry.require('app-meta',1),HostMetadata=registry.require('host-metadata',1);
const rows=new Map();let strictWrites=0;
function request(result){return {result,error:null,onsuccess:null,onerror:null,_result:result};}
const transactionFaults={read:false,write:false,commit:false};let transactionChain=Promise.resolve();
function runTransaction(mode,operation,strict=false){
 const task=transactionChain.then(()=>new Promise((resolve,reject)=>{
  if(strict)strictWrites+=1;let settled=false;const staged=new Map([...rows].map(([key,value])=>[key,structuredClone(value)]));
  const finish=(ok=true,value=true)=>{if(settled)return;settled=true;if(ok&&transactionFaults.commit){reject(new Error('commit unavailable'));return;}if(ok){if(mode==='readwrite'){rows.clear();for(const [key,row] of staged)rows.set(key,row);}resolve(value);}else reject(value instanceof Error?value:new Error(String(value||'transaction failed')));};
  const tx={oncomplete:null,onabort:null,onerror:null,objectStore(){return {
   get(key){const req=request();queueMicrotask(()=>{if(transactionFaults.read){req.error=new Error('read unavailable');req.onerror?.();}else{req.result=structuredClone(staged.get(key));req.onsuccess?.();}});return req;},
   getAll(){const req=request();queueMicrotask(()=>{req.result=[...staged.values()].map(structuredClone);req.onsuccess?.();});return req;},
   put(value){const req=request();if(transactionFaults.write)queueMicrotask(()=>{req.error=new Error('write unavailable');req.onerror?.();});else staged.set(value.key,structuredClone(value));return req;},
   delete(key){const req=request();if(transactionFaults.write)queueMicrotask(()=>{req.error=new Error('delete unavailable');req.onerror?.();});else staged.delete(key);return req;}
  };}};
  try{operation(tx,finish);queueMicrotask(()=>queueMicrotask(()=>{if(!settled)tx.oncomplete?.();}));}catch(error){finish(false,error);}
 }));transactionChain=task.catch(()=>{});return task;
}
const indexedDb=freeze({
  transaction:(_store,mode,operation)=>runTransaction(mode,operation,false),
  strictTransaction:(_store,mode,operation)=>runTransaction(mode,operation,true),
  get:async(_store,key)=>structuredClone(rows.get(key)||null),
  getAll:async()=>[...rows.values()].map(structuredClone)
});
const hostKeys=freeze({
  verifiedRecoveryBackups:APP_META_KEYS.verifiedRecoveryBackups,backupProtection:APP_META_KEYS.backupProtection,
  attachmentIntegrityAudit:APP_META_KEYS.attachmentIntegrityAudit,deviceFolder:APP_META_KEYS.deviceFolder,
  repositoryIntegrityScrub:APP_META_KEYS.repositoryIntegrityScrub,managedProviderBackupPending:APP_META_KEYS.managedProviderBackupPending,
  repositoryMaintenancePending:APP_META_KEYS.repositoryMaintenancePending,
  reconciliationBase:APP_META_KEYS.reconciliationBase,reconciliationBaseNotePrefix:APP_META_KEYS.reconciliationBaseNotePrefix,reconciliationBaseDayPrefix:APP_META_KEYS.reconciliationBaseDayPrefix
});
function gateway(){
  const value=AppMeta.create(freeze({indexedDb,store:'meta',registry:APP_META_RUNTIME_REGISTRY}));
  value.registerValidators('host',HostMetadata.createAppMetaValidators(freeze({
    keys:hostKeys,same:(a,b)=>JSON.stringify(a)===JSON.stringify(b),
    normalizers:freeze({verifiedRecovery:v=>v,attachmentIntegrity:v=>v,repositoryIntegrity:v=>v,reconciliationBase:v=>v,reconciliationBaseNote:v=>v,reconciliationBaseDays:v=>v})
  })));
  return value;
}
const first=gateway(),backupMeta=first.bind('backup');
const pending=freeze({format:'study-director.managed-provider-backup-pending',version:1,entries:freeze([freeze({providerId:'google-drive',requestedAt:'2026-09-20T12:00:00.000Z',sourceRevision:'2026-09-20T11:59:59.000Z'})])});
await backupMeta.write('managedProviderBackupPending',pending,{strict:true,updatedAt:'2026-09-20T12:00:00.000Z'});
assert.equal(strictWrites,1,'managed-provider pending intent must use a strict durable appMeta write');
assert.ok(rows.has(APP_META_KEYS.managedProviderBackupPending),'pending intent must live in typed IndexedDB appMeta rather than memory/localStorage');

const restarted=gateway(),restartedBackupMeta=restarted.bind('backup'),afterRestart=await restartedBackupMeta.read('managedProviderBackupPending');
assert.deepEqual(afterRestart,pending,'pending provider backup intent must survive reconstruction of the runtime over the same IndexedDB state');
await restartedBackupMeta.remove('managedProviderBackupPending','',{strict:true});
assert.equal(await restartedBackupMeta.read('managedProviderBackupPending'),null,'successful retry/disconnect must be able to clear the durable pending intent strictly');
assert.equal(strictWrites,2,'pending intent removal must use strict durability too');

const maintenance=freeze({format:'study-director.repository-maintenance-pending',version:4,entries:freeze([freeze({providerId:'google-drive',requestedAt:'2026-09-20T12:05:00.000Z',nextEligibleAt:'2026-09-20T18:05:00.000Z',reason:'gc-grace',repositoryScope:'',requestId:''})])});
await restartedBackupMeta.write('repositoryMaintenancePending',maintenance,{strict:true,updatedAt:'2026-09-20T12:05:00.000Z'});
assert.equal(strictWrites,3,'repository-maintenance intent must use a strict durable appMeta write');
const maintenanceRestart=gateway().bind('backup');assert.deepEqual(await maintenanceRestart.read('repositoryMaintenancePending'),maintenance,'repository-maintenance intent must survive runtime reconstruction over the same IndexedDB state');
await maintenanceRestart.remove('repositoryMaintenancePending','',{strict:true});assert.equal(await maintenanceRestart.read('repositoryMaintenancePending'),null,'safe maintenance completion must be able to clear durable maintenance intent strictly');
assert.equal(strictWrites,4,'repository-maintenance intent removal must use strict durability too');

console.log(JSON.stringify({status:'PASS',suite:'managed-provider-backup-pending',strictDurability:true,restartPersistence:true,clearable:true,maintenanceRestartPersistence:true,maintenanceStrictDurability:true,maintenanceEligibilityPersistence:true},null,2));

const Background=registry.require('repository-background',1,freeze({lifecycle:registry.require('operation-lifecycle',1)})),hostSource=fs.readFileSync('source/app.html','utf8'),hostText=hostSource.slice(hostSource.indexOf('const REPOSITORY_MAINTENANCE_FORMAT='),hostSource.indexOf('async function canonicalLocalRecoveryEmpty('));
function host(){
 const context={Object,Number,String,Date,Promise,Map,crypto:globalThis.crypto,AppDiagnostics:{capture(){}},BackupProviderRuntime:{configureRepositoryMaintenance(){}},BackupAppMeta:gateway().bind('backup')};vm.createContext(context);vm.runInContext(hostText,context);
 return {read:vm.runInContext('repositoryMaintenanceState',context),mark:vm.runInContext('markRepositoryMaintenancePending',context),clear:vm.runInContext('clearRepositoryMaintenancePending',context)};
}
function clock(){let now=Date.now(),sequence=0;const timers=new Map();return {now:()=>now,setTimeout:(callback,delay)=>{const id=++sequence;timers.set(id,{callback,due:now+delay});return id;},clearTimeout:id=>timers.delete(id),advance:async ms=>{now+=ms;for(const [id,timer] of [...timers])if(timer.due<=now){timers.delete(id);timer.callback();await Promise.resolve();}},pending:()=>[...timers.values()].map(value=>value.due-now)};}
function setup(h,execute){
 let repositoryScope='actual-repository';
 const fake=clock(),bg=Background.createCoordinator(freeze({target:'google-drive',environment:freeze({AbortController,now:fake.now,setTimeout:fake.setTimeout,clearTimeout:fake.clearTimeout})}));
 const intent=bg.maintenanceIntent(freeze({scope:()=>repositoryScope,read:()=>h.read('google-drive'),mark:(value,expected)=>h.mark('google-drive',{...value,repositoryScope},expected),clear:expected=>h.clear('google-drive',expected),capture:()=>{},selectRetention:()=>freeze({remove:freeze([])})}));
 const scheduler=bg.createMaintenanceScheduler(freeze({intent,execute,isAvailable:()=>true,isBusy:()=>false,report:()=>{},capture:()=>{},budgetMs:60000,budgetCode:'TEST_BUDGET',budgetMessage:'budget',preemptCode:'TEST_PREEMPT',preemptMessage:'preempt'}));return {fake,bg,intent,scheduler,setScope:value=>{repositoryScope=value;}};
}
async function settleUntil(predicate){for(let i=0;i<1000&&!predicate();i++)await Promise.resolve();assert.ok(predicate(),'fixture work must settle within the bounded microtask harness');}
const intentCases=[];
for(const outcome of ['completed','failed','budget','preempted','gc-grace']){
 const h=host();await h.clear('google-drive');await h.mark('google-drive',{reason:'repository-state',nextEligibleAt:new Date(Date.now()-1000).toISOString(),repositoryScope:'actual-repository'});
 let release,entered=false,executions=0;const gate=new Promise(resolve=>{release=resolve;}),fixture=setup(h,async()=>{executions++;if(executions>1)return {gcPending:false};entered=true;await gate;if(outcome==='completed')return {gcPending:false};if(outcome==='gc-grace')return {gcPending:true,gcDeferred:1};throw Object.assign(new Error(outcome),outcome==='failed'?{}:{name:'AbortError',code:outcome==='budget'?'TEST_BUDGET':'TEST_PREEMPT'});});
 const older=fixture.scheduler.run('old');await settleUntil(()=>entered);assert.equal(await fixture.scheduler.request('failure-cleanup',1000),true);const newer=await h.read('google-drive');release();const result=await older;assert.equal(result.status,'pending');assert.equal(result.reason,'newer-request');assert.equal(JSON.stringify(await host().read('google-drive')),JSON.stringify(newer),'restart must preserve the exact new request and deadline');
 await fixture.fake.advance(1001);await settleUntil(()=>executions===2);await settleUntil(()=>!fixture.scheduler.status().running);assert.equal(await h.read('google-drive'),null);fixture.bg.clearAllScheduled();intentCases.push('request during '+outcome);
}
for(const cleanup of [{gcPending:false},{gcPending:true,gcDeferred:1}]){
 const h=host();await h.mark('google-drive',{reason:'old-cleanup',nextEligibleAt:new Date().toISOString(),repositoryScope:'actual-repository'});const fixture=setup(h,async()=>({gcPending:false})),serviced=await fixture.intent.read();await fixture.scheduler.request('failure-cleanup',1000);const newer=await h.read('google-drive');const result=await fixture.scheduler.adopt(cleanup,{pending:serviced});assert.equal(result.pending,true);assert.deepEqual(await h.read('google-drive'),newer);fixture.bg.clearAllScheduled();intentCases.push('external adoption '+String(cleanup.gcPending));
}
{
 const h=host();await h.clear('google-drive');const missing=await h.read('google-drive');await h.mark('google-drive',{reason:'new',nextEligibleAt:new Date().toISOString()});const first=await h.read('google-drive');assert.equal(await h.mark('google-drive',{reason:'older',nextEligibleAt:new Date().toISOString()},missing),'superseded');
 await h.mark('google-drive',{reason:first.reason,nextEligibleAt:first.nextEligibleAt});const second=await h.read('google-drive');assert.notEqual(second.requestId,first.requestId,'identical same-tick requests need distinct durable identities');assert.equal(await h.clear('google-drive',first),'superseded');assert.deepEqual(await h.read('google-drive'),second);assert.equal(await h.clear('google-drive',second),true);intentCases.push('same-tick identities and absent-snapshot fencing');
}
for(const fault of ['read','write','commit']){
 const h=host();await h.mark('google-drive',{reason:'retained',nextEligibleAt:new Date().toISOString()});const before=await h.read('google-drive');transactionFaults[fault]=true;assert.equal(await h.clear('google-drive',before),false);transactionFaults[fault]=false;assert.deepEqual(await h.read('google-drive'),before);assert.equal(await h.clear('google-drive',before),true);intentCases.push(fault+' failure retains intent');
}
{
 const h=host();await h.mark('device-folder',{reason:'device-work',nextEligibleAt:new Date().toISOString()});const device=await h.read('device-folder');await h.mark('google-drive',{reason:'drive-work',nextEligibleAt:new Date().toISOString()});await h.clear('google-drive',await h.read('google-drive'));assert.deepEqual(await h.read('device-folder'),device);await h.clear('device-folder',device);intentCases.push('independent providers');
}
// Older payload versions are converted once by the compatibility host; the ordinary runtime rejects them.
for(const version of [1,2,3]){
 const at=new Date().toISOString(),entry={providerId:'google-drive',requestedAt:at};if(version>=2)Object.assign(entry,{nextEligibleAt:at,reason:'legacy-work'});if(version>=3)entry.repositoryScope='actual-repository';
 await assert.rejects(gateway().bind('backup').write('repositoryMaintenancePending',{format:'study-director.repository-maintenance-pending',version,entries:[entry]},{strict:true}),/not canonical/u);intentCases.push('older payload '+version+' rejected');
}
{
 // A converted intent carries no request identity yet; the next mark assigns one.
 const h=host(),at=new Date().toISOString();await gateway().bind('backup').write('repositoryMaintenancePending',{format:'study-director.repository-maintenance-pending',version:4,entries:[{providerId:'google-drive',requestedAt:at,nextEligibleAt:at,reason:'requested',repositoryScope:'',requestId:''}]},{strict:true});const old=await h.read('google-drive');assert.equal(old.requestId,'');await h.mark('google-drive',{reason:'resumed',nextEligibleAt:at},old);const current=await h.read('google-drive');assert.match(current.requestId,/^[a-f0-9-]{36}$/u);assert.equal(await h.clear('google-drive',old),'superseded');assert.equal(await h.clear('google-drive',current),true);intentCases.push('converted intent without request identity');
}
// Requests accepted after a conditional commit must also retain their timer.
for(const path of ['adopt-complete','adopt-pending','run-complete']){
 const h=host();await h.mark('google-drive',{reason:'old',nextEligibleAt:new Date(Date.now()-1000).toISOString()});const fixture=setup(h,async()=>({gcPending:false})),pending=await fixture.intent.read();let once=true;
 const inject=async()=>{if(once){once=false;await fixture.scheduler.request('after-commit',1000);}};
 const original=path==='adopt-pending'?h.mark:h.clear;
 if(path==='adopt-pending')h.mark=async(id,value,expected)=>{const result=await original(id,value,expected);if(expected!==undefined)await inject();return result;};
 else h.clear=async(id,expected)=>{const result=await original(id,expected);await inject();return result;};
 const result=path==='run-complete'?await fixture.scheduler.run():await fixture.scheduler.adopt(path==='adopt-pending'?{gcPending:true,gcDeferred:1}:{gcPending:false},{pending});assert.equal(result.reason,'newer-request');assert.equal((await h.read('google-drive')).reason,'after-commit');assert.ok(fixture.fake.pending().includes(1000),'the newer timer must survive completion or retry scheduling');fixture.bg.clearAllScheduled();await h.clear('google-drive');intentCases.push(path+' request after commit');
}
{
 const h=host();await h.mark('google-drive',{reason:'canonical',nextEligibleAt:new Date().toISOString()});const valid=structuredClone(rows.get(APP_META_KEYS.repositoryMaintenancePending));
 for(const requestId of [null,'invalid']){const invalid=structuredClone(valid);invalid.value.entries[0].requestId=requestId;rows.set(APP_META_KEYS.repositoryMaintenancePending,invalid);await assert.rejects(h.read('google-drive'),/not canonical/u);}
 rows.set(APP_META_KEYS.repositoryMaintenancePending,valid);await h.clear('google-drive');intentCases.push('noncanonical request identity rejected');
}
console.log(JSON.stringify({status:'PASS',suite:'repository-maintenance-request-fencing',cases:intentCases.length,intentCases,canonicalMetadataGateway:true,atomicTransactions:true,newerRequestsExecuted:true,restartPersistence:true},null,2));

const recoveryCases=[];
async function drain(fixture){await settleUntil(()=>!fixture.scheduler.status().running);}
for(const fault of ['read','write','commit']){
 const h=host();await h.clear('google-drive');let executions=0;const fixture=setup(h,async()=>{executions++;return {gcPending:false};});transactionFaults[fault]=true;
 assert.equal(await fixture.scheduler.request('failure-cleanup',1000),false);assert.equal(await h.read('google-drive'),null);assert.equal(fixture.scheduler.status().intentPending,true);assert.equal(fixture.scheduler.status().pending,true);assert.equal(executions,0);
 await fixture.fake.advance(300001);await drain(fixture);assert.equal(fixture.scheduler.status().intentPending,true,'continued persistence failure must retain a retryable request');assert.ok(fixture.fake.pending().some(delay=>delay>=299000));assert.equal(executions,0);
 transactionFaults[fault]=false;await fixture.fake.advance(300001);await drain(fixture);assert.equal(fixture.scheduler.status().intentPending,false);assert.equal((await h.read('google-drive')).reason,'failure-cleanup');
 await fixture.fake.advance(1001);await settleUntil(()=>executions===1);await drain(fixture);assert.equal(await h.read('google-drive'),null);fixture.bg.clearAllScheduled();recoveryCases.push('first '+fault+' failure and repeated recovery');
}
{
 const h=host();await h.clear('google-drive');let executions=0;const fixture=setup(h,async()=>{executions++;return {gcPending:false};}),read=h.read;let unavailable=true;h.read=async id=>{if(unavailable)throw new Error('initial metadata read unavailable');return read(id);};assert.equal(await fixture.scheduler.request('failure-cleanup',1000),false);unavailable=false;
 await h.mark('google-drive',{reason:'gc-grace',nextEligibleAt:new Date(fixture.fake.now()+900000).toISOString(),repositoryScope:'actual-repository'});const before=await read('google-drive');await fixture.fake.advance(300001);await drain(fixture);const renewed=await read('google-drive');assert.equal(renewed.reason,before.reason);assert.equal(renewed.nextEligibleAt,before.nextEligibleAt);assert.notEqual(renewed.requestId,before.requestId,'a recovered unknown-baseline request must fence older adopted completions');assert.equal(await h.clear('google-drive',before),'superseded');assert.equal(executions,0);fixture.bg.clearAllScheduled();await h.clear('google-drive');recoveryCases.push('unknown baseline preserves existing deadline and renews identity');
}
{
 const h=host();await h.clear('google-drive');let executions=0;const fixture=setup(h,async()=>{executions++;return {gcPending:false};});transactionFaults.write=true;await fixture.scheduler.request('failure-cleanup',1000);transactionFaults.write=false;await h.mark('google-drive',{reason:'gc-grace',nextEligibleAt:new Date(fixture.fake.now()+900000).toISOString(),repositoryScope:'actual-repository'});const newer=await h.read('google-drive');await fixture.fake.advance(300001);await drain(fixture);assert.deepEqual(await h.read('google-drive'),newer,'a newer durable request must win over recovery');assert.equal(fixture.scheduler.status().intentPending,false);assert.equal(executions,0);fixture.bg.clearAllScheduled();await h.clear('google-drive');recoveryCases.push('newer durable request wins');
}
for(const when of ['before-retry','during-read']){
 const h=host();await h.clear('google-drive');let executions=0;const fixture=setup(h,async()=>{executions++;return {gcPending:false};});transactionFaults.write=true;await fixture.scheduler.request('failure-cleanup',1000);transactionFaults.write=false;
 if(when==='before-retry')fixture.setScope('another-repository');else{const read=h.read;h.read=async id=>{const result=await read(id);fixture.setScope('another-repository');return result;};}
 await fixture.fake.advance(300001);await drain(fixture);assert.equal(await h.read('google-drive'),null);assert.equal(executions,0);assert.equal(fixture.scheduler.status().intentPending,false);fixture.bg.clearAllScheduled();recoveryCases.push('repository switch '+when+' discards stale request');
}
{
 const h=host();await h.clear('google-drive');let executions=0;const fixture=setup(h,async()=>{executions++;return {gcPending:false};});transactionFaults.write=true;await fixture.scheduler.request('failure-cleanup',1000);transactionFaults.write=false;const hold=fixture.bg.suspend('foreground');assert.equal(fixture.scheduler.status().intentPending,true);await fixture.fake.advance(300001);assert.equal(executions,0);assert.equal(await h.read('google-drive'),null);fixture.bg.resume(hold);fixture.scheduler.schedule(1000,'retry');await fixture.fake.advance(1001);await drain(fixture);await fixture.fake.advance(1001);await settleUntil(()=>executions===1);await drain(fixture);assert.equal(await h.read('google-drive'),null);fixture.bg.clearAllScheduled();recoveryCases.push('foreground suspension retains request and resumes');
}
{
 const h=host();await h.mark('google-drive',{reason:'repository-state',nextEligibleAt:new Date().toISOString(),repositoryScope:'actual-repository'});let release,entered=false;const gate=new Promise(resolve=>{release=resolve;}),fixture=setup(h,async()=>{entered=true;await gate;return {gcPending:false};});const older=fixture.scheduler.run();await settleUntil(()=>entered);transactionFaults.write=true;assert.equal(await fixture.scheduler.request('failure-cleanup',1000),false);transactionFaults.write=false;release();assert.equal((await older).reason,'newer-request');assert.equal(fixture.scheduler.status().intentPending,true);await fixture.fake.advance(300001);await drain(fixture);assert.equal((await h.read('google-drive')).reason,'failure-cleanup');await fixture.fake.advance(1001);await drain(fixture);assert.equal(await h.read('google-drive'),null);fixture.bg.clearAllScheduled();recoveryCases.push('old completion cannot retire failed new request');
}
console.log(JSON.stringify({status:'PASS',suite:'repository-maintenance-first-intent-recovery',cases:recoveryCases.length,recoveryCases,canonicalHostAndMetadata:true},null,2));
