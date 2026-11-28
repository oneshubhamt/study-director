import {readScript} from '../../../build/source-script.mts';
import {readCoreScript} from '../core-script.mts';
import assert from 'node:assert/strict';
import type {RepositoryControls} from '../repository-harness.mts';
import {checkedRepository as createHarness,field} from '../repository-safety-ports.mts';
import {storedNote,requiredStoredNote,required,storedRow} from '../repository-note-ports.mts';
import {method,registeredExports} from '../registered-exports.mts';
import {jsonObject,jsonArray,jsonString} from './read-verification.mts';
import {createFakeClock} from '../fake-clock.mts';
import vm from 'node:vm';

type Harness=ReturnType<typeof createHarness>;
type Clock=ReturnType<typeof createFakeClock>;
type Controls=RepositoryControls&{foreground?:boolean;storageReset?:boolean;wakes?:string[];cleanups?:number[];host?:unknown};
const markerValue=(h:Harness)=>jsonObject(field(h.stores.meta.get('dataMaintenance'),'value'));
const payloadText=(h:Harness,title:string)=>required(h.app.notes.exportPayload()[h.app.notes.getRequired(title).id]).text;
const fallbackCount=(h:Harness)=>jsonArray(h.sharedLocal.get('fallback')).length;

const unknownKey='unknownMetadata';
const retainedKey='planDraft';
const recentAt=new Date().toISOString(),oldAt=new Date(Date.now()-2*24*60*60*1000).toISOString();
const stores={area:new Map<string,unknown>(),sync:new Map<string,unknown>(),tombstones:new Map<string,unknown>(),reflection:new Map<string,unknown>(),daily:new Map<string,unknown>(),summary:new Map<string,unknown>(),session:new Map<string,unknown>(),meta:new Map<string,unknown>([
  [unknownKey,{key:unknownKey,version:1,value:{complete:true},updatedAt:recentAt}],
  [retainedKey,{key:retainedKey,version:1,value:{scheduleText:'keep'},updatedAt:recentAt}],
  ['dataMaintenance',{key:'dataMaintenance',version:1,value:{version:6,status:'completed',completedAt:oldAt},updatedAt:recentAt}]
])};
const {app}=createHarness(new Map<string,unknown>(),stores);

assert.equal(app.compatibility,undefined);
const report=await app.maintenance.run();
assert.equal(report.status,'completed','maintenance must run after the canonical Daily Record baseline is established');
assert.equal(report['version'],6);
assert.equal(stores.meta.has(retainedKey),true,'maintenance must preserve canonical Plan metadata');

stores.meta.set(unknownKey,{key:unknownKey,version:1,value:{complete:true},updatedAt:recentAt});
const recent=await app.maintenance.run();
assert.equal(recent.status,'skipped');
assert.equal(recent['reason'],'recent');
assert.equal(stores.meta.has(unknownKey),true,'recurring maintenance must leave metadata it does not own alone');

console.log(JSON.stringify({status:'PASS',suite:'data-maintenance',compatibilityRemoved:report,recent},null,2));

// Canonical automatic maintenance respects foreground work between operations
// and never writes a completion after an unavailable metadata read.
const source=readScript('source/core/repositories.ts');
const preemptionControls:Controls={},preemption=createHarness(new Map<string,unknown>(),null,preemptionControls);
await preemption.app.notes.load();
let blocked=false,notesReads=0,sessionReads=0;
preemptionControls.onAreaRead=async()=>{notesReads++;blocked=true;};preemptionControls.onSessionRead=async()=>{sessionReads++;};
const yielded=await preemption.app.maintenance.run({check:()=>{if(blocked)throw Object.assign(new Error('foreground'),{code:'DATA_MAINTENANCE_YIELDED',reason:'foreground-busy'});}});
assert.equal(yielded.status,'yielded');assert.equal(markerValue(preemption)['status'],'pending');assert.equal(sessionReads,0);
preemptionControls.onStorageRead=async({store})=>{if(store==='meta')throw new Error('metadata unavailable');};
assert.equal((await preemption.app.maintenance.run()).status,'failed');assert.equal(markerValue(preemption)['status'],'pending');
preemptionControls.onStorageRead=null;blocked=false;preemptionControls.onAreaRead=async()=>{notesReads++;};
assert.equal((await preemption.app.maintenance.run()).status,'completed');assert.equal(notesReads,2,'foreground interruption invalidates the phase continuation');
console.log(JSON.stringify({status:'PASS',suite:'data-maintenance-preemption',yielded,metadataRetry:true}));

const readerContext={fallbackDailyRecordsGet:()=>[],filterPendingDeletedEntities:(value:unknown)=>value,mergeDailyRecordSets:()=>[],idbAllRecords:async()=>{throw new Error('storage unavailable');},isCanonicalRuntimeError:()=>false,showStorageFallbackWarning(){},materializeDailyRecordView:(value:unknown)=>value,storedDailyRecordFields:(value:unknown)=>value};
vm.createContext(readerContext);vm.runInContext(source.slice(source.indexOf('async function getDailyRecords('),source.indexOf('async function removeDailyRecord(')),readerContext);
assert.equal(jsonArray(await method(readerContext,'getDailyRecords')()).length,0,'interactive read retains its fallback policy');
await assert.rejects(Promise.resolve(method(readerContext,'getDailyRecords')({strict:true})),/storage unavailable/);
console.log(JSON.stringify({status:'PASS',suite:'daily-record-strict-gc-read',unavailableSourceNotEmpty:true}));

const failureCases:string[]=[];
async function maintenanceFailure(name:string,prepare:(h:Harness,c:Controls)=>Promise<()=>Promise<void>>,verify:(h:Harness)=>Promise<unknown>){
 const controls:Controls={},h=createHarness(new Map<string,unknown>(),null,controls);await h.app.notes.load();
 const recover=await prepare(h,controls),previous=h.stores.meta.get('dataMaintenance');
 const failed=await h.app.maintenance.run({force:true});assert.equal(failed.status,'failed',name);const marker=h.stores.meta.get('dataMaintenance');assert.ok(marker===previous||field(field(marker,'value'),'status')==='pending',name+' must not commit completion');
 await verify(h);await recover();const retry=await h.app.maintenance.run();assert.equal(retry.status,'completed',name+' must remain eligible for immediate retry');assert.equal(retry['version'],6);assert.equal((await h.app.maintenance.run())['reason'],'recent');failureCases.push(name);
}
await maintenanceFailure('canonical note write failure',async(h,c)=>{h.app.notes.update('audit','Audit','pending note','');c.failNextAreaWrite=true;return async()=>{};},async h=>{assert.equal(h.app.notes.failure().failed,true);assert.equal(storedNote(h.stores.area,'audit'),undefined);assert.equal(payloadText(h,'audit'),'pending note');});
await maintenanceFailure('canonical note read unavailable',async(h,c)=>{h.app.notes.update('read-pending','Read Pending','retained through read failure','');c.onAreaRead=async()=>{throw new Error('note read unavailable');};return async()=>{c.onAreaRead=null;};},async h=>assert.equal(payloadText(h,'read-pending'),'retained through read failure'));
await maintenanceFailure('session read unavailable',async(h,c)=>{c.onSessionRead=async()=>{throw new Error('session read unavailable');};return async()=>{c.onSessionRead=null;};},async()=>{});
const sessionFixture={id:'active',version:1,revision:1,date:'2026-09-17',status:'active',scheduleText:'08:00 30 Study',snapshot:{date:'2026-09-17'},updatedAt:'2026-09-17T11:00:00.000Z'};
await maintenanceFailure('session reconciliation write failure',async(h,c)=>{c.failSessionWrite=true;assert.equal((await h.app.activeSession.save(sessionFixture)).ok,true);return async()=>{c.failSessionWrite=false;};},async h=>{assert.ok(h.sharedLocal.has('recovery'));assert.equal(h.stores.session.has('active'),false);});
await maintenanceFailure('session recovery retirement failure',async(h,c)=>{await h.app.activeSession.save(sessionFixture);h.sharedLocal.set('recovery',{stale:true});c.failLocalRemoveKeys=new Set(['recovery']);return async()=>{c.failLocalRemoveKeys=null;};},async h=>assert.ok(h.sharedLocal.has('recovery')));
const dayFixture={version:1,date:'2026-09-16',savedAt:'2026-09-17T10:00:00.000Z',updatedAt:'2026-09-17T10:00:00.000Z',reflection:'pending deletion'};
async function pendingDelete(h:Harness,c:Controls){await h.app.dailyRecords.save(dayFixture);c.failNextDailyWrite=true;await h.app.dailyRecords.remove(dayFixture.date);assert.ok(h.sharedLocal.has('deletionRecovery'));}
await maintenanceFailure('deletion recovery transaction failure',async(h,c)=>{await pendingDelete(h,c);c.failNextDailyWrite=true;return async()=>{};},async h=>{assert.equal(h.stores.daily.has(dayFixture.date),true);assert.equal(await h.app.dailyRecords.get(dayFixture.date),null);assert.ok(h.sharedLocal.has('deletionRecovery'));});
await maintenanceFailure('deletion recovery read unavailable',async(h,c)=>{await pendingDelete(h,c);c.failLocalGetKeys=new Set(['deletionRecovery']);return async()=>{c.failLocalGetKeys=null;};},async h=>assert.ok(h.sharedLocal.has('deletionRecovery')));
await maintenanceFailure('deletion recovery marker retirement failure',async(h,c)=>{await pendingDelete(h,c);c.failLocalRemoveKeys=new Set(['deletionRecovery']);return async()=>{c.failLocalRemoveKeys=null;};},async h=>{assert.equal(h.stores.daily.has(dayFixture.date),false);assert.ok(h.sharedLocal.has('deletionRecovery'));});
await maintenanceFailure('fallback migration transaction failure',async(h,c)=>{h.sharedLocal.set('fallback',[dayFixture]);c.failNextDailyWrite=true;return async()=>{};},async h=>{assert.equal(h.stores.daily.has(dayFixture.date),false);assert.equal(fallbackCount(h),1);});
await maintenanceFailure('fallback migration cleanup failure',async(h,c)=>{h.sharedLocal.set('fallback',[dayFixture]);c.failLocalSetKeys=new Set(['fallback']);return async()=>{c.failLocalSetKeys=null;};},async h=>{assert.equal(h.stores.daily.has(dayFixture.date),true);assert.equal(fallbackCount(h),1);});
await maintenanceFailure('pending intent commit failure',async(_h,c)=>{c.failNextMetaOnlyWrite=true;return async()=>{};},async()=>{});
await maintenanceFailure('completion metadata commit failure',async(_h,c)=>{c.failNextMaintenanceCompletion=true;return async()=>{};},async h=>assert.equal(markerValue(h)['status'],'pending'));
{
 const c:Controls={},h=createHarness(new Map<string,unknown>(),null,c);c.onAreaRead=async()=>{throw new Error('initial notes unavailable');};await h.app.notes.load();assert.equal((await h.app.maintenance.run()).status,'failed');c.onAreaRead=null;assert.equal((await h.app.maintenance.run()).status,'completed');failureCases.push('initial fallback note load recovers strictly');
}
{
 const c:Controls={},h=createHarness(new Map<string,unknown>(),null,c);const completed=await h.app.maintenance.run();h.app.notes.update('restart-pending','Restart Pending','retained after failed forced pass','');c.failNextAreaWrite=true;assert.equal((await h.app.maintenance.run({force:true})).status,'failed');const pending=markerValue(h);assert.equal(pending['status'],'pending');assert.equal(pending['completedAt'],completed['completedAt']);
 const restarted=createHarness(h.sharedLocal,h.stores,{});assert.equal((await restarted.app.maintenance.run()).status,'completed','durable pending work bypasses a recent prior success after restart');assert.equal(requiredStoredNote(h.stores.area,'restart-pending').text,'retained after failed forced pass');failureCases.push('failure after recent success remains pending across restart');
}
console.log(JSON.stringify({status:'PASS',suite:'data-maintenance-phase-outcomes',cases:failureCases.length,failureCases,immediateRetry:true,recoveryPreserved:true},null,2));

// Real host job -> lifecycle -> AppData, with latency placed at storage boundaries.
// Finite, healthy phases must finish without repeating slow preparation. Changes
// to authority, durable data or unsaved rescue state invalidate retained proof.
const lifecycleContext=vm.createContext({Symbol,Object,Error,TypeError,Date,Promise,Map,Set,setTimeout,clearTimeout});
for(const file of ['source/core/internal.ts','source/core/operation-lifecycle.ts','source/core/backup-maintenance-host.ts'])vm.runInContext(readScript(file),lifecycleContext,{filename:file});
const lifecycle=registeredExports(lifecycleContext,'operation-lifecycle'),maintenanceHost=registeredExports(lifecycleContext,'backup-maintenance-host');
function automaticMaintenance(h:Harness,clock:Clock,controls:Controls){
 const idle=Object.freeze({status:()=>Object.freeze({busy:false,active:false})}),foreground=Object.freeze({status:()=>Object.freeze({busy:!!controls.foreground,active:!!controls.foreground})});
 const owner=method(maintenanceHost,'createBackground')(Object.freeze({
  lifecycle,environment:Object.freeze({now:()=>clock.now(),setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout}),
  authority:Object.freeze({canMutate:()=>controls.owned!==false,fullyInitialized:()=>true,storageResetUnresolved:()=>!!controls.storageReset,unsupportedDataHeld:()=>false}),
  foreground:Object.freeze({pwaReserved:()=>false,mutation:idle,attachmentIngest:idle,exports:foreground,backupController:idle,providers:idle}),
  data:Object.freeze({maintenance:field(h.rawApp,'maintenance'),notes:field(h.rawApp,'notes')}),
  diagnostics:Object.freeze({capture(){},start:()=>'',mark(){},finish(){},fail(){}}),
  backgroundOwners:()=>Object.freeze([Object.freeze(['observer',Object.freeze({wake:(trigger:string)=>{(controls.wakes??=[]).push(trigger);}})])]),
  scheduleAssetMaintenance:(delay:number)=>{(controls.cleanups??=[]).push(delay);return true;},
  intervals:Object.freeze({maintenanceMs:86400000,failureRetryMs:300000,assetCleanupDelayMs:5000,foregroundRecheckMs:15000})
 }));
 controls.host=owner;const job=field(owner,'job');
 return {run:async(trigger:string)=>{const row=jsonObject(await method(job,'run')(trigger));return {...row,status:jsonString(row['status']),reason:row['reason'],phase:row['phase']};},status:()=>jsonObject(method(job,'status')()),dispose:()=>method(job,'dispose')(),settled:async()=>method(job,'settled')()};
}
const progressCases=[];
for(const slowStore of ['area','session','meta','all'])for(const delayMs of [0,1000,19999,20000,35000]){
 const clock=createFakeClock(),controls:Controls={clock},h=createHarness(new Map<string,unknown>(),null,controls);await h.app.notes.load();
 let reads=0;controls.onStorageRead=async({store})=>{if(store==='area')reads++;if(slowStore==='all'||store===slowStore)await clock.advance(delayMs);};
 const job=automaticMaintenance(h,clock,controls),phases:number[]=[];let result:Awaited<ReturnType<ReturnType<typeof automaticMaintenance>['run']>>|undefined;
 for(let attempt=0;attempt<8;attempt++){result=await job.run('latency');if(result.status==='completed')break;assert.equal(result.status,'yielded',`${slowStore} ${delayMs}`);assert.equal(result.reason,'budget');const phase=result.phase;assert.ok(typeof phase==='number'&&phase>0&&phase<7);assert.ok(!phases.length||phase>required(phases.at(-1)),'stable source must advance monotonically');phases.push(phase);assert.equal(markerValue(h)['status'],'pending');}
 assert.equal(required(result).status,'completed',`${slowStore} ${delayMs} must finish within the finite phase count`);assert.deepEqual(controls.cleanups,[5000],'attachment cleanup follows each completed daily upkeep');assert.equal(reads,1,'successful strict Notes preparation is not repeated');assert.ok(markerValue(h)['completedAt']);job.dispose();progressCases.push({slowStore,delayMs,attempts:phases.length+1});
}
for(const change of ['canonical','unsaved-note','rescue','ownership','reload','unavailable','local-unavailable']){
 const clock=createFakeClock(),controls:Controls={clock},h=createHarness(new Map<string,unknown>(),null,controls);await h.app.notes.load();
 let reads=0;controls.onAreaRead=async()=>{reads++;await clock.advance(21000);};let current=h,job=automaticMaintenance(h,clock,controls);
 const first=await job.run('initial');assert.equal(first.status,'yielded');assert.equal(first.phase,2);
 if(change==='canonical')await h.app.mutationEpoch.reseed();
 if(change==='unsaved-note')h.app.notes.update('new-note','New Note','new unsaved value','');
 if(change==='rescue')h.sharedLocal.set('recovery',{stale:true});
 if(change==='ownership')controls.ownershipRevision=2;
 if(change==='reload'){job.dispose();current=createHarness(h.sharedLocal,h.stores,controls);job=automaticMaintenance(current,clock,controls);}
 if(change==='local-unavailable'){controls.failLocalGetKeys=new Set(['recovery']);assert.equal((await job.run('local-unavailable')).status,'failed');assert.equal(markerValue(h)['status'],'pending');controls.failLocalGetKeys=null;}
 if(change==='unavailable'){
  controls.onStorageRead=async({store})=>{if(store==='meta')throw new Error('unavailable source');};assert.equal((await job.run('unavailable')).status,'failed');assert.equal(markerValue(h)['status'],'pending');controls.onStorageRead=null;
 }
 let result;for(let attempt=0;attempt<7;attempt++){result=await job.run('resume');if(result.status==='completed')break;assert.equal(result.status,'yielded');}
 assert.equal(required(result).status,'completed',change);assert.ok(['unavailable','local-unavailable'].includes(change)?reads===1:reads>=2&&reads<=4,change+' must use only current phase proof and converge after finite source changes');job.dispose();progressCases.push({change,reads});
}
console.log(JSON.stringify({status:'PASS',suite:'canonical-maintenance-progress',productionHost:true,productionAppData:true,matrices:progressCases},null,2));

// A change during an awaited later phase cannot be adopted as proof that the
// already completed earlier phase processed it.
{
 const controls:Controls={},h=createHarness(new Map<string,unknown>(),null,controls);await h.app.notes.load();let changed=false;
 controls.onSessionRead=async()=>{if(!changed){changed=true;h.app.notes.update('during-session','During Session','must be flushed before maintenance completes','');}};
 assert.equal((await h.app.maintenance.run()).status,'completed');assert.equal(requiredStoredNote(h.stores.area,'during-session').text,'must be flushed before maintenance completes');assert.equal(h.app.notes.failure().failed,false);
 console.log(JSON.stringify({status:'PASS',suite:'canonical-maintenance-source-fence',latePhaseChangeRevalidated:true}));
}

// Recovery adoption is atomic with respect to accepted live mutations and
// queued writes, not merely wall-clock timestamps. A superseded read preserves
// the live model, autosave and durable intent, then converges on a stable retry.
// Adoption follows the canonical read with no further wait, so an edit, or an
// edit whose autosave commits, can only land during that read.
const noteRecoveryCases=[];
for(const boundary of ['stable','canonical-read','autosave'])for(const change of boundary==='stable'?['none']:['edit','add','delete','queued-save']){
 const clock=createFakeClock(),controls:Controls={clock},local=new Map<string,unknown>();let changed=false,mutation:Promise<unknown>=Promise.resolve();
 const stores={area:new Map<string,unknown>(),sync:new Map<string,unknown>(),tombstones:new Map<string,unknown>(),reflection:new Map<string,unknown>(),daily:new Map<string,unknown>(),summary:new Map<string,unknown>(),session:new Map<string,unknown>(),meta:new Map<string,unknown>()},h=createHarness(local,stores,controls);
 controls.onAreaRead=async()=>{throw new Error('startup notes unavailable');};await h.app.notes.load();controls.onAreaRead=null;
 h.app.notes.update('first','First','earlier note','');await h.app.notes.flush({strict:true});await clock.advance(20);
 if(change==='queued-save')h.app.notes.update('first','First','latest edit',h.app.notes.getRequired('first').updatedAt);
 const applyChange=()=>{
  if(changed)return;changed=true;
  if(change==='queued-save'){void clock.advance(1000);return;}
  if(change==='delete')mutation=h.app.notes.remove('first');
  else if(change==='add')h.app.notes.update('second','Second','new note','');
  else{const current=h.app.notes.getRequired('first');h.app.notes.update('first','First','intervening edit',current.updatedAt);const updated=h.app.notes.getRequired('first');h.app.notes.update('first','First','latest edit',updated.updatedAt);assert.ok(h.app.notes.getRequired('first').updatedAt>updated.updatedAt,'every accepted change moves the revision forward');}
  if(boundary==='autosave')void clock.advance(1000);
 };
 controls.onAreaRead=async()=>{if(boundary!=='stable')applyChange();};
 const job=automaticMaintenance(h,clock,controls),first=await job.run('recovery');controls.onAreaRead=null;await mutation;
 const expected=boundary==='stable'?{first:'earlier note'}:change==='delete'?{}:change==='add'?{first:'earlier note',second:'new note'}:{first:'latest edit'};
 const texts=(payload:unknown)=>Object.fromEntries(Object.values(jsonObject(payload)).map(value=>{const row=storedRow(value);return [row.label.toLowerCase(),row.text];}));
 assert.deepEqual(texts(h.app.notes.exportPayload()),expected,`${boundary} ${change}: recovery cannot regress the live model`);
 if(first.status==='completed')assert.deepEqual(texts(Object.fromEntries(stores.area)),expected,'completion acknowledges exactly the accepted work');
 else{
  assert.equal(first.status,'yielded',`${boundary} ${change}: a superseded snapshot cannot certify completion`);assert.equal(first.reason,'notes-changed');assert.equal(markerValue(h)['status'],'pending');
  await clock.advance(2000);assert.deepEqual(texts(Object.fromEntries(stores.area)),expected,'ordinary autosave remains armed after recovery defers');
  assert.equal(job.status()['scheduled'],true);await clock.advance(13000);
  for(let turn=0;turn<100&&job.status()['busy'];turn++)await clock.drainMicrotasks(50);
  assert.equal(job.status()['busy'],false);assert.equal(markerValue(h)['status'],'completed','the automatic wake-up reconciles stable recovery without manual repair');
 }
 await h.app.notes.flush({strict:true});assert.deepEqual(texts(Object.fromEntries(stores.area)),expected);
 const restarted=createHarness(local,stores,{clock});await restarted.app.notes.load();assert.deepEqual(texts(restarted.app.notes.exportPayload()),expected,'restart sees the same acknowledged model');
 if(change==='edit'&&changed){const current=h.app.notes.getRequired('first');h.app.notes.update('first','First',current.text+' + subsequent edit',current.updatedAt);await h.app.notes.flush({strict:true});assert.equal(requiredStoredNote(stores.area,'first').text,'latest edit + subsequent edit');}
 job.dispose();noteRecoveryCases.push({boundary,change});
}
console.log(JSON.stringify({status:'PASS',suite:'note-recovery-conservation',productionAppData:true,matrices:noteRecoveryCases},null,2));

// The same host-owned allowance reaches individual recovery transactions;
// checkpointed prefixes, rather than repeated batch preparation, conserve work.
const recoveryProgressCases=[];
for(const delayMs of [19999,20000,35000])for(const preempt of [false,true]){
 const clock=createFakeClock(),controls:Controls={clock},local=new Map<string,unknown>();let reads=0,armed=false;
 class SlowRecords extends Map<string,unknown>{override get(key:string){if(armed&&this.has(key)){reads++;void clock.advance(delayMs);if(preempt&&reads===2)controls.foreground=true;}return super.get(key);}}
 const dates=['2026-09-01','2026-09-02','2026-09-03','2026-09-04'],records=new SlowRecords(dates.map(date=>[date,{version:1,date,savedAt:'2026-09-17T08:00:00.000Z',updatedAt:'2026-09-17T08:00:00.000Z',reflection:'pending deletion'}]));
 const stores={area:new Map<string,unknown>(),sync:new Map<string,unknown>(),tombstones:new Map<string,unknown>(),reflection:new Map<string,unknown>(),daily:records,summary:new Map<string,unknown>(),session:new Map<string,unknown>(),meta:new Map<string,unknown>()},h=createHarness(local,stores,controls);await h.app.notes.load();
 local.set('deletionRecovery',{format:'study-director.deletion-recovery',version:1,updatedAt:'2026-09-17T09:00:00.000Z',entries:dates.map(date=>({key:'dailyRecord:'+date,kind:'dailyRecord',id:date,deletedAt:'2026-09-17T09:00:00.000Z'}))});armed=true;
 const job=automaticMaintenance(h,clock,controls);let result,preempted=false;
 for(let attempt=0;attempt<dates.length*2+2;attempt++){
  result=await job.run('recovery');if(result.status==='completed')break;assert.equal(result.status,'yielded');assert.equal(markerValue(h)['status'],'pending');
  if(result.reason==='foreground-busy'){assert.equal(reads,2,'foreground prevents the next recovery transaction');assert.equal(records.size,dates.length-2);preempted=true;controls.foreground=false;}
  assert.equal((local.has('deletionRecovery')?jsonArray(field(local.get('deletionRecovery'),'entries')).length:0),records.size,'a confirmed retired prefix leaves exactly the unfinished requests');
 }
 assert.equal(required(result).status,'completed');assert.equal(records.size,0);assert.equal(local.has('deletionRecovery'),false);assert.equal(reads,dates.length,'each recovery row is consumed once');assert.equal(preempted,preempt);job.dispose();recoveryProgressCases.push({delayMs,preempt,reads});
}
console.log(JSON.stringify({status:'PASS',suite:'canonical-recovery-progress',productionHost:true,conservedWork:true,matrices:recoveryProgressCases},null,2));

// While the person is busy, upkeep waits under a named reason with no timer of
// its own; one watcher checks back and wakes every job when the work ends.
{
 const clock=createFakeClock(),controls:Controls={clock},h=createHarness(new Map<string,unknown>(),null,controls);await h.app.notes.load();
 const job=automaticMaintenance(h,clock,controls),host=controls.host,watch=()=>method(host,'watchingForeground')();controls.foreground=true;
 const deferred=await job.run('interval');assert.equal(deferred.status,'deferred');assert.equal(deferred.reason,'foreground-busy');
 assert.equal(job.status()['blocker'],'foreground-busy');assert.equal(job.status()['scheduled'],false,'no job timer while the person is busy');assert.equal(watch(),true,'the shared watcher is armed');
 assert.equal(clock.pending(),1,'only the watcher waits');await clock.advance(15000);assert.equal(controls.wakes,undefined,'still busy: no wake');assert.equal(clock.pending(),1,'the watcher re-arms itself');
 assert.equal(method(host,'foregroundChanged')(),false,'a change while still busy keeps waiting');controls.foreground=false;
 assert.equal(method(host,'foregroundChanged')(),true);assert.deepEqual(controls.wakes,['foreground-released']);assert.equal(watch(),false);assert.equal(method(host,'foregroundChanged')(),false,'nothing to release twice');
 await clock.advance(0);await job.settled();assert.ok(markerValue(h)['completedAt'],'the woken job runs at once');assert.deepEqual(controls.cleanups,[5000]);job.dispose();
 console.log(JSON.stringify({status:'PASS',suite:'upkeep-foreground-watcher',namedWait:true,oneWatcher:true,wakeOnRelease:true}));
}

// A person-started file import/export holds every provider. An automatic
// Drive catch-up shares the import controller but never suspends itself.
// Execute the checked P5.7A owner so this remains behavioral evidence after extraction.
{
 const status={importActive:false,importHoldsBackground:false,standaloneExportActive:false,busy:false},holds:{reason:string;released:number;settled:Promise<void>;release():void}[]=[],listeners:(()=>void)[]=[];let changes=0;
 class TestElement{} class TestButton extends TestElement{}
 const context={console,Symbol,Object,Promise,HTMLButtonElement:TestButton,HTMLElement:TestElement};
 vm.createContext(context);
 for(const file of ['internal','backup-actions-host'])vm.runInContext(readCoreScript(file),context);
 const module=registeredExports(context,'backup-actions-host');
 const freeze=Object.freeze;
 const controller=freeze({
   status:()=>({...status}),subscribeStatus:(fn:()=>void)=>{listeners.push(fn);return()=>{};},
   exportLocal:()=>false,importLocal:()=>false,cancelStandalone:()=>false
 });
 const processing=freeze({status:()=>({fileBusy:status.busy}),open:async()=>null});
 const protection=freeze({withPassword:async (open:()=>unknown)=>open(),manage:async()=>false});
 const providers=freeze({
   suspendBackground:(reason:string)=>{const hold={reason,released:0,settled:Promise.resolve(),release(){hold.released++;}};holds.push(hold);return hold;},
   locationStatus:()=>null,connected:()=>false,backup:async()=>false,cancelForeground:()=>false,disconnect:async()=>false
 });
 const presentation=freeze({current:()=>null,summary:()=>'',subscribe:()=>()=>{},locationLabel:()=>'',condition:()=>false});
 const controls=method(module,'createControls')(freeze({
   document:{getElementById:()=>null},controller,processing,protection,device:()=>null,providers,presentation,
   verifiedAt:()=>'',timeLabel:(value:unknown)=>value,capture:(_scope:unknown,error:unknown)=>{throw error;},captureActionAuthority:()=>()=>{},resolveFileOpen:()=>{},
   foregroundChanged:()=>{changes++;},scheduleSyncStatus:()=>{},renderProfile:()=>{},firstStartOpen:()=>false,renderFirstStart:()=>{},
   scheduleUpdate:()=>{},connectDevice:()=>false,connectDrive:()=>false,openHistory:()=>false
 }));
 assert.equal(method(controls,'install')(),true);assert.equal(listeners.length,1);assert.equal(changes,0,'install does not invent a foreground transition');
 const notify=()=>required(listeners[0])();
 status.busy=true;notify();assert.equal(holds.length,0,'an automatic backup does not hold itself');
 status.standaloneExportActive=true;notify();notify();assert.equal(holds.length,1,'one hold while the file backup runs');assert.equal(required(holds[0]).reason,'file-backup');
 status.standaloneExportActive=false;status.importActive=true;status.importHoldsBackground=true;notify();assert.equal(holds.length,1,'a manual import that follows keeps the same hold');assert.equal(required(holds[0]).released,0);
 status.importActive=false;status.importHoldsBackground=false;status.busy=false;notify();assert.equal(required(holds[0]).released,1,'released when the person-started work ends');notify();assert.equal(required(holds[0]).released,1);
 status.importActive=true;notify();assert.equal(holds.length,1,'an automatic provider sync must not acquire a fresh file-backup hold');
 status.importActive=false;notify();assert.equal(required(holds[0]).released,1,'an automatic sync cannot release someone else\'s completed hold');
 assert.equal(changes,8,'each status change lets the upkeep watcher check at once');
 console.log(JSON.stringify({status:'PASS',suite:'file-work-hold',checkedOwner:true,holdsOnlyPersonStartedWork:true,singleHold:true,releasesOnEnd:true}));
}
