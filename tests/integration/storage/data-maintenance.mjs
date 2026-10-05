import assert from 'node:assert/strict';
import {createHarness} from '../../helpers/repository-harness.mjs';

const obsoleteKey='reflectionDraftMigration.v1';
const retainedKey='planDraft.v1';
const recentAt=new Date().toISOString(),oldAt=new Date(Date.now()-2*24*60*60*1000).toISOString();
const stores={area:new Map(),sync:new Map(),tombstones:new Map(),reflection:new Map(),daily:new Map(),summary:new Map(),session:new Map(),meta:new Map([
  [obsoleteKey,{key:obsoleteKey,version:1,value:{complete:true},updatedAt:recentAt}],
  [retainedKey,{key:retainedKey,version:1,value:{scheduleText:'keep'},updatedAt:recentAt}],
  ['dataMaintenance',{key:'dataMaintenance',version:1,value:{version:5,status:'completed',completedAt:oldAt},updatedAt:recentAt}]
])};
const {app}=createHarness(new Map(),stores);

const removed=await app.compatibility.cleanupObsoleteMetadata();
assert.equal(removed,1,'obsolete metadata cleanup belongs to the temporary compatibility surface');
assert.equal(stores.meta.has(obsoleteKey),false,'obsolete reflection migration residue must be removed by compatibility migration');
assert.equal(stores.meta.has(retainedKey),true,'classified canonical metadata must be retained');

await app.compatibility.migrateDailyRecords();
const report=await app.maintenance.run();
assert.equal(report.status,'completed','maintenance must run after the canonical Daily Record baseline is established');
assert.equal(report.version,6);
assert.equal(stores.meta.has(retainedKey),true,'maintenance must preserve canonical Plan metadata');

stores.meta.set(obsoleteKey,{key:obsoleteKey,version:1,value:{complete:true},updatedAt:recentAt});
const recent=await app.maintenance.run();
assert.equal(recent.status,'skipped');
assert.equal(recent.reason,'recent');
assert.equal(stores.meta.has(obsoleteKey),true,'recurring maintenance must not own compatibility cleanup after consolidation');

console.log(JSON.stringify({status:'PASS',suite:'data-maintenance',compatibilityRemoved:removed,report,recent},null,2));

// Canonical automatic maintenance respects foreground work between operations
// and never writes a completion after an unavailable metadata read.
const {default:fs}=await import('node:fs'),{default:vm}=await import('node:vm');
const source=fs.readFileSync('source/core/repositories.js','utf8');
const preemptionControls={},preemption=createHarness(new Map(),null,preemptionControls);
await preemption.app.compatibility.migrateDailyRecords();await preemption.app.notes.load();
let blocked=false,notesReads=0,sessionReads=0;
preemptionControls.onAreaRead=async()=>{notesReads++;blocked=true;};preemptionControls.onSessionRead=async()=>{sessionReads++;};
const yielded=await preemption.app.maintenance.run({check:()=>{if(blocked)throw Object.assign(new Error('foreground'),{code:'DATA_MAINTENANCE_YIELDED',reason:'foreground-busy'});}});
assert.equal(yielded.status,'yielded');assert.equal(preemption.stores.meta.get('dataMaintenance').value.status,'pending');assert.equal(sessionReads,0);
preemptionControls.onStorageRead=async({store})=>{if(store==='meta')throw new Error('metadata unavailable');};
assert.equal((await preemption.app.maintenance.run()).status,'failed');assert.equal(preemption.stores.meta.get('dataMaintenance').value.status,'pending');
preemptionControls.onStorageRead=null;blocked=false;preemptionControls.onAreaRead=async()=>{notesReads++;};
assert.equal((await preemption.app.maintenance.run()).status,'completed');assert.equal(notesReads,2,'foreground interruption invalidates the phase continuation');
console.log(JSON.stringify({status:'PASS',suite:'data-maintenance-preemption',yielded,metadataRetry:true}));

const readerContext={fallbackDailyRecordsGet:()=>[],filterPendingDeletedEntities:value=>value,mergeDailyRecordSets:()=>[],idbAllRecords:async()=>{throw new Error('storage unavailable');},isCanonicalRuntimeError:()=>false,showStorageFallbackWarning(){},materializeDailyRecordView:value=>value};
vm.createContext(readerContext);vm.runInContext(source.slice(source.indexOf('async function getDailyRecords('),source.indexOf('async function removeDailyRecord(')),readerContext);
assert.equal((await readerContext.getDailyRecords()).length,0,'interactive read retains its fallback policy');
await assert.rejects(readerContext.getDailyRecords({strict:true}),/storage unavailable/);
console.log(JSON.stringify({status:'PASS',suite:'daily-record-strict-gc-read',unavailableSourceNotEmpty:true}));

const failureCases=[];
async function maintenanceFailure(name,prepare,verify){
 const controls={},h=createHarness(new Map(),null,controls);await h.app.compatibility.migrateDailyRecords();await h.app.notes.load();
 const recover=await prepare(h,controls),previous=h.stores.meta.get('dataMaintenance');
 const failed=await h.app.maintenance.run({force:true});assert.equal(failed.status,'failed',name);const marker=h.stores.meta.get('dataMaintenance');assert.ok(marker===previous||marker?.value?.status==='pending',name+' must not commit completion');
 await verify(h);await recover();const retry=await h.app.maintenance.run();assert.equal(retry.status,'completed',name+' must remain eligible for immediate retry');assert.equal(retry.version,6);assert.equal((await h.app.maintenance.run()).reason,'recent');failureCases.push(name);
}
await maintenanceFailure('canonical note write failure',async(h,c)=>{h.app.notes.update('audit','Audit','pending note','');c.failNextAreaWrite=true;return async()=>{};},async h=>{assert.equal(h.app.notes.failure().failed,true);assert.equal(h.stores.area.has('audit'),false);assert.equal(h.app.notes.exportPayload().audit.text,'pending note');});
await maintenanceFailure('canonical note read unavailable',async(h,c)=>{h.app.notes.update('read-pending','Read Pending','retained through read failure','');c.onAreaRead=async()=>{throw new Error('note read unavailable');};return async()=>{c.onAreaRead=null;};},async h=>assert.equal(h.app.notes.exportPayload()['read-pending'].text,'retained through read failure'));
await maintenanceFailure('session read unavailable',async(h,c)=>{c.onSessionRead=async()=>{throw new Error('session read unavailable');};return async()=>{c.onSessionRead=null;};},async()=>{});
const sessionFixture={id:'active',version:1,revision:1,date:'2026-09-17',status:'active',scheduleText:'08:00 30 Study',snapshot:{date:'2026-09-17'},updatedAt:'2026-09-17T11:00:00.000Z'};
await maintenanceFailure('session reconciliation write failure',async(h,c)=>{c.failSessionWrite=true;assert.equal((await h.app.activeSession.save(sessionFixture)).ok,true);return async()=>{c.failSessionWrite=false;};},async h=>{assert.ok(h.sharedLocal.has('recovery'));assert.equal(h.stores.session.has('active'),false);});
await maintenanceFailure('session recovery retirement failure',async(h,c)=>{await h.app.activeSession.save(sessionFixture);h.sharedLocal.set('recovery',{stale:true});c.failLocalRemoveKeys=new Set(['recovery']);return async()=>{c.failLocalRemoveKeys.clear();};},async h=>assert.ok(h.sharedLocal.has('recovery')));
const dayFixture={version:1,date:'2026-09-16',savedAt:'2026-09-17T10:00:00.000Z',updatedAt:'2026-09-17T10:00:00.000Z',reflection:'pending deletion'};
async function pendingDelete(h,c){await h.app.dailyRecords.save(dayFixture);c.failNextDailyWrite=true;await h.app.dailyRecords.remove(dayFixture.date);assert.ok(h.sharedLocal.has('deletionRecovery'));}
await maintenanceFailure('deletion recovery transaction failure',async(h,c)=>{await pendingDelete(h,c);c.failNextDailyWrite=true;return async()=>{};},async h=>{assert.equal(h.stores.daily.has(dayFixture.date),true);assert.equal(await h.app.dailyRecords.get(dayFixture.date),null);assert.ok(h.sharedLocal.has('deletionRecovery'));});
await maintenanceFailure('deletion recovery read unavailable',async(h,c)=>{await pendingDelete(h,c);c.failLocalGetKeys=new Set(['deletionRecovery']);return async()=>{c.failLocalGetKeys.clear();};},async h=>assert.ok(h.sharedLocal.has('deletionRecovery')));
await maintenanceFailure('deletion recovery marker retirement failure',async(h,c)=>{await pendingDelete(h,c);c.failLocalRemoveKeys=new Set(['deletionRecovery']);return async()=>{c.failLocalRemoveKeys.clear();};},async h=>{assert.equal(h.stores.daily.has(dayFixture.date),false);assert.ok(h.sharedLocal.has('deletionRecovery'));});
await maintenanceFailure('fallback migration transaction failure',async(h,c)=>{h.sharedLocal.set('fallback',[dayFixture]);c.failNextDailyWrite=true;return async()=>{};},async h=>{assert.equal(h.stores.daily.has(dayFixture.date),false);assert.equal(h.sharedLocal.get('fallback').length,1);});
await maintenanceFailure('fallback migration cleanup failure',async(h,c)=>{h.sharedLocal.set('fallback',[dayFixture]);c.failLocalSetKeys=new Set(['fallback']);return async()=>{c.failLocalSetKeys.clear();};},async h=>{assert.equal(h.stores.daily.has(dayFixture.date),true);assert.equal(h.sharedLocal.get('fallback').length,1);});
await maintenanceFailure('pending intent commit failure',async(_h,c)=>{c.failNextMetaOnlyWrite=true;return async()=>{};},async()=>{});
await maintenanceFailure('completion metadata commit failure',async(_h,c)=>{c.failNextMaintenanceCompletion=true;return async()=>{};},async h=>assert.equal(h.stores.meta.get('dataMaintenance').value.status,'pending'));
{
 const c={},h=createHarness(new Map(),null,c);await h.app.compatibility.migrateDailyRecords();c.onAreaRead=async()=>{throw new Error('initial notes unavailable');};await h.app.notes.load();assert.equal((await h.app.maintenance.run()).status,'failed');c.onAreaRead=null;assert.equal((await h.app.maintenance.run()).status,'completed');failureCases.push('initial fallback note load recovers strictly');
}
{
 const h=createHarness();await h.app.compatibility.migrateDailyRecords();const at=new Date().toISOString();h.stores.meta.set('dataMaintenance',{key:'dataMaintenance',version:1,value:{version:5,status:'completed',completedAt:at},updatedAt:at});assert.equal((await h.app.maintenance.run()).status,'completed','older soft completion cannot suppress strict maintenance');failureCases.push('recent legacy completion revalidated');
}
{
 const c={},h=createHarness(new Map(),null,c);await h.app.compatibility.migrateDailyRecords();const completed=await h.app.maintenance.run();h.app.notes.update('restart-pending','Restart Pending','retained after failed forced pass','');c.failNextAreaWrite=true;assert.equal((await h.app.maintenance.run({force:true})).status,'failed');const pending=h.stores.meta.get('dataMaintenance').value;assert.equal(pending.status,'pending');assert.equal(pending.completedAt,completed.completedAt);
 const restarted=createHarness(h.sharedLocal,h.stores,{});assert.equal((await restarted.app.maintenance.run()).status,'completed','durable pending work bypasses a recent prior success after restart');assert.equal(h.stores.area.get('restart-pending').text,'retained after failed forced pass');failureCases.push('failure after recent success remains pending across restart');
}
console.log(JSON.stringify({status:'PASS',suite:'data-maintenance-phase-outcomes',cases:failureCases.length,failureCases,immediateRetry:true,recoveryPreserved:true},null,2));

// Real host job -> lifecycle -> AppData, with latency placed at storage boundaries.
// Finite, healthy phases must finish without repeating slow preparation. Changes
// to authority, durable data or unsaved rescue state invalidate retained proof.
const {createFakeClock}=await import('../../helpers/fake-clock.mjs');
const lifecycleContext=vm.createContext({Symbol,Object,Error,TypeError,Date,Promise,Map,Set,setTimeout,clearTimeout});
for(const file of ['internal','operation-lifecycle'])vm.runInContext(fs.readFileSync(`source/core/${file}.js`,'utf8'),lifecycleContext);
const lifecycle=lifecycleContext[Symbol.for('studyDirector.internalModules.v1')].require('operation-lifecycle',1),hostSource=fs.readFileSync('source/app.html','utf8');
function automaticMaintenance(h,clock,controls){
 const context={Object,Error,Date:clock.Date,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,OperationLifecycle:lifecycle,AppData:h.app,StartupLifecycle:{status:()=>({fullyInitialized:true})},appCanMutate:()=>controls.owned!==false,backgroundMaintenanceForegroundBusy:()=>!!controls.foreground,AppDiagnostics:{capture(){}},BackupOperationDiagnostics:{start:()=>'',mark(){},finish(){},fail(){}},DATA_MAINTENANCE_FAILURE_RETRY_MS:300000,DATA_MAINTENANCE_SCHEDULE_INTERVAL_MS:86400000,scheduleDataMaintenance:(delay,reason)=>context.job.schedule(delay,reason)};
 vm.createContext(context);vm.runInContext(hostSource.slice(hostSource.indexOf('const DataMaintenanceJob='),hostSource.indexOf('function scheduleDataMaintenance('))+'\nglobalThis.job=DataMaintenanceJob;',context);return context.job;
}
const progressCases=[];
for(const slowStore of ['area','session','meta','all'])for(const delayMs of [0,1000,19999,20000,35000]){
 const clock=createFakeClock(),controls={clock},h=createHarness(new Map(),null,controls);await h.app.compatibility.migrateDailyRecords();await h.app.notes.load();
 let reads=0;controls.onStorageRead=async({store})=>{if(store==='area')reads++;if(slowStore==='all'||store===slowStore)await clock.advance(delayMs);};
 const job=automaticMaintenance(h,clock,controls),phases=[];let result;
 for(let attempt=0;attempt<7;attempt++){result=await job.run('latency');if(result.status==='completed')break;assert.equal(result.status,'yielded',`${slowStore} ${delayMs}`);assert.equal(result.reason,'budget');assert.ok(result.phase>0&&result.phase<6);assert.ok(!phases.length||result.phase>phases.at(-1),'stable source must advance monotonically');phases.push(result.phase);assert.equal(h.stores.meta.get('dataMaintenance').value.status,'pending');}
 assert.equal(result.status,'completed',`${slowStore} ${delayMs} must finish within the finite phase count`);assert.equal(reads,1,'successful strict Notes preparation is not repeated');assert.ok(h.stores.meta.get('dataMaintenance').value.completedAt);job.dispose();progressCases.push({slowStore,delayMs,attempts:phases.length+1});
}
for(const change of ['canonical','unsaved-note','rescue','ownership','reload','unavailable','local-unavailable']){
 const clock=createFakeClock(),controls={clock},h=createHarness(new Map(),null,controls);await h.app.compatibility.migrateDailyRecords();await h.app.notes.load();
 let reads=0;controls.onAreaRead=async()=>{reads++;await clock.advance(21000);};let current=h,job=automaticMaintenance(h,clock,controls);
 const first=await job.run('initial');assert.equal(first.status,'yielded');assert.equal(first.phase,2);
 if(change==='canonical')await h.app.mutationEpoch.reseed();
 if(change==='unsaved-note')h.app.notes.update('new-note','New Note','new unsaved value','');
 if(change==='rescue')h.sharedLocal.set('recovery',{stale:true});
 if(change==='ownership')controls.ownershipRevision=2;
 if(change==='reload'){job.dispose();current=createHarness(h.sharedLocal,h.stores,controls);job=automaticMaintenance(current,clock,controls);}
 if(change==='local-unavailable'){controls.failLocalGetKeys=new Set(['recovery']);assert.equal((await job.run('local-unavailable')).status,'failed');assert.equal(h.stores.meta.get('dataMaintenance').value.status,'pending');controls.failLocalGetKeys.clear();}
 if(change==='unavailable'){
  controls.onStorageRead=async({store})=>{if(store==='meta')throw new Error('unavailable source');};assert.equal((await job.run('unavailable')).status,'failed');assert.equal(h.stores.meta.get('dataMaintenance').value.status,'pending');controls.onStorageRead=null;
 }
 let result;for(let attempt=0;attempt<7;attempt++){result=await job.run('resume');if(result.status==='completed')break;assert.equal(result.status,'yielded');}
 assert.equal(result.status,'completed',change);assert.ok(['unavailable','local-unavailable'].includes(change)?reads===1:reads>=2&&reads<=4,change+' must use only current phase proof and converge after finite source changes');job.dispose();progressCases.push({change,reads});
}
console.log(JSON.stringify({status:'PASS',suite:'canonical-maintenance-progress',productionHost:true,productionAppData:true,matrices:progressCases},null,2));

// A change during an awaited later phase cannot be adopted as proof that the
// already completed earlier phase processed it.
{
 const controls={},h=createHarness(new Map(),null,controls);await h.app.compatibility.migrateDailyRecords();await h.app.notes.load();let changed=false;
 controls.onSessionRead=async()=>{if(!changed){changed=true;h.app.notes.update('during-session','During Session','must be flushed before maintenance completes','');}};
 assert.equal((await h.app.maintenance.run()).status,'completed');assert.equal(h.stores.area.get('during-session').text,'must be flushed before maintenance completes');assert.equal(h.app.notes.failure().failed,false);
 console.log(JSON.stringify({status:'PASS',suite:'canonical-maintenance-source-fence',latePhaseChangeRevalidated:true}));
}

// Recovery adoption is atomic with respect to accepted live mutations and
// queued writes, not merely wall-clock timestamps. A superseded read preserves
// the live model, autosave and durable intent, then converges on a stable retry.
// Adoption follows the canonical read with no further wait, so an edit, or an
// edit whose autosave commits, can only land during that read.
const noteRecoveryCases=[];
for(const boundary of ['stable','canonical-read','autosave'])for(const change of boundary==='stable'?['none']:['edit','add','delete','queued-save']){
 const clock=createFakeClock(),controls={clock},local=new Map();let changed=false,mutation=Promise.resolve();
 const stores={area:new Map(),sync:new Map(),tombstones:new Map(),reflection:new Map(),daily:new Map(),summary:new Map(),session:new Map(),meta:new Map()},h=createHarness(local,stores,controls);
 controls.onAreaRead=async()=>{throw new Error('startup notes unavailable');};await h.app.notes.load();controls.onAreaRead=null;
 h.app.notes.update('first','First','earlier note','');await h.app.notes.flush({strict:true});await clock.advance(20);
 if(change==='queued-save')h.app.notes.update('first','First','latest edit',h.app.notes.get('first').updatedAt);
 const applyChange=()=>{
  if(changed)return;changed=true;
  if(change==='queued-save'){void clock.advance(1000);return;}
  if(change==='delete')mutation=h.app.notes.remove('first');
  else if(change==='add')h.app.notes.update('second','Second','new note','');
  else{const current=h.app.notes.get('first');h.app.notes.update('first','First','intervening edit',current.updatedAt);const updated=h.app.notes.get('first');h.app.notes.update('first','First','latest edit',updated.updatedAt);assert.ok(h.app.notes.get('first').updatedAt>updated.updatedAt,'every accepted change moves the revision forward');}
  if(boundary==='autosave')void clock.advance(1000);
 };
 controls.onAreaRead=async()=>{if(boundary!=='stable')applyChange();};
 const job=automaticMaintenance(h,clock,controls),first=await job.run('recovery');controls.onAreaRead=null;await mutation;
 const expected=boundary==='stable'?{first:'earlier note'}:change==='delete'?{}:change==='add'?{first:'earlier note',second:'new note'}:{first:'latest edit'};
 const texts=payload=>Object.fromEntries(Object.entries(payload).map(([key,value])=>[key,value.text]));
 assert.deepEqual(texts(h.app.notes.exportPayload()),expected,`${boundary} ${change}: recovery cannot regress the live model`);
 if(first.status==='completed')assert.deepEqual(texts(Object.fromEntries(stores.area)),expected,'completion acknowledges exactly the accepted work');
 else{
  assert.equal(first.status,'yielded',`${boundary} ${change}: a superseded snapshot cannot certify completion`);assert.equal(first.reason,'notes-changed');assert.equal(h.stores.meta.get('dataMaintenance').value.status,'pending');
  await clock.advance(2000);assert.deepEqual(texts(Object.fromEntries(stores.area)),expected,'ordinary autosave remains armed after recovery defers');
  assert.equal(job.status().scheduled,true);await clock.advance(13000);
  for(let turn=0;turn<100&&job.status().busy;turn++)await clock.drainMicrotasks(50);
  assert.equal(job.status().busy,false);assert.equal(h.stores.meta.get('dataMaintenance').value.status,'completed','the automatic wake-up reconciles stable recovery without manual repair');
 }
 await h.app.notes.flush({strict:true});assert.deepEqual(texts(Object.fromEntries(stores.area)),expected);
 const restarted=createHarness(local,stores,{clock});await restarted.app.notes.load();assert.deepEqual(texts(restarted.app.notes.exportPayload()),expected,'restart sees the same acknowledged model');
 if(change==='edit'&&changed){const current=h.app.notes.get('first');h.app.notes.update('first','First',current.text+' + subsequent edit',current.updatedAt);await h.app.notes.flush({strict:true});assert.equal(stores.area.get('first').text,'latest edit + subsequent edit');}
 job.dispose();noteRecoveryCases.push({boundary,change});
}
console.log(JSON.stringify({status:'PASS',suite:'note-recovery-conservation',productionAppData:true,matrices:noteRecoveryCases},null,2));

// The same host-owned allowance reaches individual recovery transactions;
// checkpointed prefixes, rather than repeated batch preparation, conserve work.
const recoveryProgressCases=[];
for(const delayMs of [19999,20000,35000])for(const preempt of [false,true]){
 const clock=createFakeClock(),controls={clock},local=new Map();let reads=0,armed=false;
 class SlowRecords extends Map{get(key){if(armed&&this.has(key)){reads++;void clock.advance(delayMs);if(preempt&&reads===2)controls.foreground=true;}return super.get(key);}}
 const dates=['2026-09-01','2026-09-02','2026-09-03','2026-09-04'],records=new SlowRecords(dates.map(date=>[date,{version:1,date,savedAt:'2026-09-17T08:00:00.000Z',updatedAt:'2026-09-17T08:00:00.000Z',reflection:'pending deletion'}]));
 const stores={area:new Map(),sync:new Map(),tombstones:new Map(),reflection:new Map(),daily:records,summary:new Map(),session:new Map(),meta:new Map()},h=createHarness(local,stores,controls);await h.app.compatibility.migrateDailyRecords();await h.app.notes.load();
 local.set('deletionRecovery',{format:'study-director.deletion-recovery',version:1,updatedAt:'2026-09-17T09:00:00.000Z',entries:dates.map(date=>({key:'dailyRecord:'+date,kind:'dailyRecord',id:date,deletedAt:'2026-09-17T09:00:00.000Z'}))});armed=true;
 const job=automaticMaintenance(h,clock,controls);let result,preempted=false;
 for(let attempt=0;attempt<dates.length*2+2;attempt++){
  result=await job.run('recovery');if(result.status==='completed')break;assert.equal(result.status,'yielded');assert.equal(h.stores.meta.get('dataMaintenance').value.status,'pending');
  if(result.reason==='foreground-busy'){assert.equal(reads,2,'foreground prevents the next recovery transaction');assert.equal(records.size,dates.length-2);preempted=true;controls.foreground=false;}
  assert.equal(local.get('deletionRecovery')?.entries.length||0,records.size,'a confirmed retired prefix leaves exactly the unfinished requests');
 }
 assert.equal(result.status,'completed');assert.equal(records.size,0);assert.equal(local.has('deletionRecovery'),false);assert.equal(reads,dates.length,'each recovery row is consumed once');assert.equal(preempted,preempt);job.dispose();recoveryProgressCases.push({delayMs,preempt,reads});
}
console.log(JSON.stringify({status:'PASS',suite:'canonical-recovery-progress',productionHost:true,conservedWork:true,matrices:recoveryProgressCases},null,2));
