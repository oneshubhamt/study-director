import assert from 'node:assert/strict';
import {createHarness} from '../../helpers/repository-harness.mjs';
import {createFakeClock} from '../../helpers/fake-clock.mjs';

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
let blocked=false,readsFail=false,writes=0,phases=[];
const context={DATA_MAINTENANCE_VERSION:6,appCanMutate:()=>true,IndexedDb:{isAvailable:()=>true},getOwnershipRevision:()=>1,decisionNowMs:Date.now,AppDiagnostics:{capture(){}},Meta:{read:async()=>{if(readsFail)throw new Error('metadata unavailable');return null;},write:async(_name,value)=>{if(value.status==='completed')writes++;return true;}},fallbackDailyRecordsGet:()=>[],AreaNotesRepository:{load:async options=>{assert.equal(options.strict,true);phases.push('notes');blocked=true;return true;},flush:async options=>{assert.equal(options.strict,true);phases.push('flush');return true;}},LocalStorageContract:{getJson:()=>null,remove(){}},STORAGE_KEYS:{recovery:'recovery'},loadActiveSessionRecord:async(_retry,options)=>{assert.equal(options.strict,true);phases.push('session');return {ok:true,error:null};},flushDeletionRecovery:async()=>{phases.push('deletion');return true;},markStorageHealthOk(){},markStorageHealthError(){}};
vm.createContext(context);vm.runInContext(source.slice(source.indexOf('const DATA_MAINTENANCE_INTERVAL_MS='),source.indexOf('    async function getDailyRecordDocumentsByDates(')),context);
const yielded=await context.runDataMaintenance({check:()=>{if(blocked)throw Object.assign(new Error('foreground'),{code:'DATA_MAINTENANCE_YIELDED',reason:'foreground-busy'});}});assert.equal(yielded.status,'yielded');assert.equal(writes,0);assert.deepEqual(phases,['notes']);
readsFail=true;assert.equal((await context.runDataMaintenance()).status,'failed');assert.equal(writes,0);
readsFail=false;assert.equal((await context.runDataMaintenance()).status,'completed');assert.equal(writes,1);
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

// Exercise the existing application scheduler with real AppData. Recovery must
// preserve edits and autosave even when timestamps repeat or a save is queued.
const appSource=fs.readFileSync('source/app.html','utf8');
function maintenanceHost(h,clock){
 const attempts=[];
 const host=vm.createContext({
  Date:clock.Date,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,
  dataMaintenanceTimer:null,DATA_MAINTENANCE_SCHEDULE_INTERVAL_MS:86400000,DATA_MAINTENANCE_FAILURE_RETRY_MS:60000,
  StartupLifecycle:{status:()=>({fullyInitialized:true})},scheduleDailyAttachmentMaintenance(){},
  backgroundMaintenanceForegroundBusy:()=>false,AppData:h.app,AppDiagnostics:{capture(){}},
  BackupOperationDiagnostics:{start:()=>1,mark(){},finish:result=>attempts.push(result),fail(){}}
 });
 vm.runInContext(appSource.slice(appSource.indexOf('function scheduleDataMaintenance('),appSource.indexOf('/* ONGOING SUBJECT NOTES */')),host);
 return {host,attempts};
}
const noteRecoveryCases=[];
for(const boundary of ['stable','canonical-read','final-result','autosave'])for(const change of boundary==='stable'?['none']:['edit','add','delete','queued-save']){
 const clock=createFakeClock(),controls={clock},local=new Map();let armed=false,changed=false,mutation=Promise.resolve();
 class ObservedMeta extends Map{entries(){const result=[...super.entries()];if(armed&&boundary!=='canonical-read'&&boundary!=='stable')queueMicrotask(applyChange);return result[Symbol.iterator]();}}
 const stores={area:new Map(),sync:new Map(),tombstones:new Map(),reflection:new Map(),daily:new Map(),summary:new Map(),session:new Map(),meta:new ObservedMeta()},h=createHarness(local,stores,controls);
 await h.app.compatibility.migrateDailyRecords();
 controls.onAreaRead=async()=>{throw new Error('startup notes unavailable');};await h.app.notes.load();controls.onAreaRead=null;
 h.app.notes.update('first','First','earlier note','');await h.app.notes.flush({strict:true});await clock.advance(20);
 if(change==='queued-save')h.app.notes.update('first','First','latest edit',h.app.notes.get('first').updatedAt);
 const applyChange=()=>{
  if(changed)return;changed=true;
  if(change==='queued-save'){void clock.advance(1000);return;}
  if(change==='delete')mutation=h.app.notes.remove('first');
  else if(change==='add')h.app.notes.update('second','Second','new note','');
  else{const current=h.app.notes.get('first');h.app.notes.update('first','First','intervening edit',current.updatedAt);const updated=h.app.notes.get('first');h.app.notes.update('first','First','latest edit',updated.updatedAt);assert.equal(h.app.notes.get('first').updatedAt,updated.updatedAt,'equal timestamps must not conceal a mutation');}
  if(boundary==='autosave')void clock.advance(1000);
 };
 controls.onAreaRead=async()=>{armed=true;if(boundary==='canonical-read')applyChange();};
 const {host,attempts}=maintenanceHost(h,clock);host.scheduleDataMaintenance(0,'recovery');
 await clock.advance(0);await clock.drainMicrotasks(256);
 armed=false;controls.onAreaRead=null;await mutation;
 const first=attempts[0];assert.ok(first,'the host records the recovery attempt');
 const expected=boundary==='stable'?{first:'earlier note'}:change==='delete'?{}:change==='add'?{first:'earlier note',second:'new note'}:{first:'latest edit'};
 const texts=payload=>Object.fromEntries(Object.entries(payload).map(([key,value])=>[key,value.text]));
 assert.deepEqual(texts(h.app.notes.exportPayload()),expected,`${boundary} ${change}: recovery preserves the live model`);
 if(first.status==='completed')assert.deepEqual(texts(Object.fromEntries(stores.area)),expected,'completion acknowledges exactly the accepted work');
 else{
  assert.equal(first.status,'yielded');assert.equal(first.reason,'notes-changed');assert.equal(stores.meta.get('dataMaintenance').value.status,'pending');
  await clock.advance(2000);assert.deepEqual(texts(Object.fromEntries(stores.area)),expected,'ordinary autosave remains armed');
  await clock.advance(13000);await clock.drainMicrotasks(256);
  assert.equal(attempts.at(-1).status,'completed','the existing host automatically retries stable recovery');
  assert.equal(stores.meta.get('dataMaintenance').value.status,'completed');
 }
 await h.app.notes.flush({strict:true});assert.deepEqual(texts(Object.fromEntries(stores.area)),expected);
 const restarted=createHarness(local,stores,{clock});await restarted.app.notes.load();assert.deepEqual(texts(restarted.app.notes.exportPayload()),expected,'restart preserves the acknowledged model');
 if(change==='edit'&&changed){const current=h.app.notes.get('first');h.app.notes.update('first','First',current.text+' + subsequent edit',current.updatedAt);await h.app.notes.flush({strict:true});assert.equal(stores.area.get('first').text,'latest edit + subsequent edit');}
 clock.clearTimeout(host.dataMaintenanceTimer);noteRecoveryCases.push({boundary,change});
}
console.log(JSON.stringify({status:'PASS',suite:'note-recovery-conservation',productionHost:true,productionAppData:true,matrices:noteRecoveryCases},null,2));
