import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHarness} from '../../helpers/repository-harness.mjs';

for(const file of ['internal','backup-capture'])vm.runInThisContext(fs.readFileSync(`source/core/${file}.js`,'utf8'));
const module=globalThis[Symbol.for('studyDirector.internalModules.v1')].require('backup-capture',1),freeze=Object.freeze;
function harness(overrides={}){
  let revision=1,generation=0,notes={Subject:{key:'Subject',text:'old'}},session={id:'current',text:'old session'},dates=['2026-09-28'];
  const hooks={},calls=[],readOptions=[];
  const hook=async name=>{calls.push(name);if(hooks[name])await hooks[name]();};
  const token=()=>revision.toString(16).padStart(32,'0'),sourceRevision=()=>new Date(Date.UTC(2026,8,28,0,revision)).toISOString();
  const load=async()=>{await hook('sessionRead');return {ok:true,error:null,value:session,storage:{idb:true}};};
  const capture=module.create(freeze({
    configuration:freeze({backupVersion:20,limits:freeze({backupChunkItems:100}),portableAssets:true}),
    data:freeze(overrides.data||{
      activeSession:freeze({save:async value=>({ok:true,value,storage:{idb:true}}),settled:async()=>{},load}),
      dailyRecords:freeze({backupDates:async()=>{await hook('datesRead');return {dates:[...dates],canonical:true};},backupMonth:async()=>[]}),
      notes:freeze({flush:async()=>hook('notesSettle'),failure:()=>null,readFreshPayload:async()=>notes,exportPayload:()=>notes,readFreshItems:async keys=>keys.map(key=>notes[key])}),
      deletionRecovery:freeze({flush:async()=>{await hook('deletionSettle');return true;},savedDays:async()=>[],notes:async()=>[],attachments:async()=>[]}),
      mutationEpoch:freeze({read:async()=>({token:token()})}),preparationUnits:freeze({list:async()=>[],replace:async()=>[]}),provenance:freeze({installationId:()=> 'capture-test'}),pendingReviews:freeze({list:async()=>[],readItems:async ids=>ids.map(()=>null)})
    }),
    codecs:freeze({activeSession:freeze({sanitizeCurrent:value=>value}),backup:freeze({countShape:value=>value,assetIds:overrides.backup?.assetIds||(()=>[]),attachmentCoverage:values=>freeze({total:values.length,missing:values.filter(row=>row.missing).length,missingIds:freeze(values.filter(row=>row.missing).map(row=>row.assetId)),fullyRecoverable:!values.some(row=>row.missing)}),missingAttachmentWarning:values=>values.some(row=>row.missing)?'Partial attachment recovery: 1 attachment missing.':'',createCheckpointMetadata:(_id,createdAt)=>({checkpointId:'checkpoint',createdAt}),createProtectedManifest:()=>({checkpointId:'checkpoint'})})}),
    session:freeze(overrides.session||{canMutate:()=>true,cancelLiveDraftSave:()=>{},captureSnapshot:()=>session,hasTasks:()=>false,toActiveSession:value=>value}),
    personal:freeze({settle:async()=>hook('personalSettle'),export:async options=>{readOptions.push(options);await hook('personalRead');return {name:'Student'};}}),
    assets:freeze(overrides.assets||{get:async()=>null,list:async()=>[]}),exports:freeze({check:()=>{},run:async()=>{}}),
    persistence:freeze(overrides.persistence||{sourceRevision:async()=>sourceRevision(),snapshotRevision:async()=>{await hook('fence');return `study-director.fast-capture-fence.v1|${token()}|${revision}`;},dailyRecordDocuments:async values=>values.map(date=>({date})),storageGeneration:()=>generation}),
    diagnostics:freeze({capture:()=>{},mark:()=>{}}),domain:freeze({getStudentName:()=> 'Student',currentDailyRecords:values=>values}),environment:freeze({yieldTask:async()=>{}})
  }));
  return {capture,hooks,calls,readOptions,clearBrowserData:()=>{generation++;},changeNote:()=>{notes={Subject:{key:'Subject',text:'new'}};revision++;},changeSession:()=>{session={id:'current',text:'new session'};revision++;},changeDates:()=>{dates=['2026-09-27','2026-09-28'];revision++;}};
}

// Mutation after the first payload read: notes have been read, then personal export yields to a note commit.
{
  const h=harness();h.hooks.personalRead=h.changeNote;
  await assert.rejects(()=>h.capture.captureLogicalCheckpoint(undefined,{requireCanonicalComplete:true}),/changed while capturing/);
}
// Intentional settle-time changes are included, not rejected or labelled with stale payloads.
{
  const h=harness();h.hooks.personalSettle=()=>{h.changeNote();h.changeSession();h.changeDates();};
  const captured=await h.capture.captureLogicalCheckpoint();
  assert.equal(captured.noteItems[0].text,'new');assert.equal(captured.activeSession.text,'new session');assert.equal(captured.recordDates.length,2);
  assert.ok(h.calls.indexOf('personalSettle')<h.calls.indexOf('fence'));assert.ok(h.readOptions.every(options=>options.flush===false),'payload reads must not initiate writes');
  await h.capture.assertLogicalCheckpointCurrent(captured);
  h.changeNote();await assert.rejects(()=>h.capture.assertLogicalCheckpointCurrent(captured),/changed/);
}
// The incremental path must not reuse the session read before deletion settlement.
{
  const h=harness();h.hooks.deletionSettle=h.changeSession;
  const prepared=await h.capture.beginManagedPreparationCapture();assert.ok(prepared);
  const [unit]=await h.capture.readManagedPreparationUnits(prepared,['activeSession']);assert.equal(unit.payload.text,'new session');
  h.changeSession();await assert.rejects(()=>h.capture.readManagedPreparationUnits(prepared,['activeSession']),/changed/);
}
// A formerly settled caller still requires a fence around all payload reads.
{
  const h=harness();h.hooks.personalRead=h.changeNote;
  await assert.rejects(()=>h.capture.captureLogicalCheckpoint(undefined,{assumeFlushed:true}),/changed while capturing/);
}
// Browser data cleared while a backup is being prepared: the capture read a mix of
// old and emptied storage, so it is never saved. A clear before the capture
// started gives a consistent capture (automatic backups are paused separately).
{
  const settling=harness();settling.hooks.notesSettle=settling.clearBrowserData;
  await assert.rejects(()=>settling.capture.captureLogicalCheckpoint(),/Browser data was cleared while this backup was being prepared/);
  const reading=harness();reading.hooks.personalRead=reading.clearBrowserData;
  await assert.rejects(()=>reading.capture.captureLogicalCheckpoint(undefined,{assumeFlushed:true}),/Browser data was cleared/);
  const before=harness();before.clearBrowserData();
  const captured=await before.capture.captureLogicalCheckpoint();await before.capture.assertLogicalCheckpointCurrent(captured);
  before.clearBrowserData();await assert.rejects(()=>before.capture.assertLogicalCheckpointCurrent(captured),/Browser data was cleared/);
  const preparing=harness();preparing.hooks.notesSettle=preparing.clearBrowserData;
  await assert.rejects(()=>preparing.capture.beginManagedPreparationCapture(),/Browser data was cleared/);
  const prepared=harness(),preparation=await prepared.capture.beginManagedPreparationCapture();assert.ok(preparation);
  prepared.clearBrowserData();await assert.rejects(()=>prepared.capture.readManagedPreparationUnits(preparation,['activeSession']),/Browser data was cleared/);
}
const cases=['payload reads reject overlapping mutations','settle-time writes are included','incremental session reads are fenced','assumed settlement does not bypass fencing','a browser data clear during capture stops the backup'];

// Quantified completeness: for every preparation route and settlement failure,
// a canonical checkpoint is forbidden. A later successful retry must include
// the deletion ledger and retire the pending marker, not resurrect the record.
const appSource=fs.readFileSync('source/app.html','utf8');
for(const route of ['canonical','assumed-settled','rescue','incremental'])for(const fault of ['database-write','marker-read','throws','false','undefined']){
  const controls={dailyKeyEnumeration:true},h=createHarness(new Map(),null,controls),date='2026-09-16';
  await h.app.dailyRecords.save({version:1,date,savedAt:'2026-09-17T10:00:00.000Z',updatedAt:'2026-09-17T10:00:00.000Z',reflection:'Deliberately deleted study day'});
  controls.failNextDailyWrite=true;await h.app.dailyRecords.remove(date);
  assert.equal(h.stores.daily.has(date),true);assert.ok(h.sharedLocal.has('deletionRecovery'));assert.equal((await h.app.deletionRecovery.savedDays()).length,0);
  const host={AppData:h.app,backupFastFenceReady:true,richAssetReferenceRevision:0,captureMutationGeneration:0,currentBackupSourceRevision:()=> '2026-09-17T10:00:00.000Z',PlanData:{exportData:async()=>({})},document:{getElementById:()=>null},AttachmentStorage:{list:async()=>[]},AppDiagnostics:{capture(){}}};vm.createContext(host);
  vm.runInContext(appSource.slice(appSource.indexOf('async function legacyBackupSnapshotRevision('),appSource.indexOf('const NoteReconciliationUI=')),host);
  let failing=true;const settlements=[];
  const flush=async()=>{
    if(failing&&fault==='throws')throw new Error('Temporary deletion reconciliation failure');
    if(failing&&fault==='false'){settlements.push(false);return false;}
    if(failing&&fault==='undefined'){settlements.push(undefined);return undefined;}
    if(failing&&fault==='database-write')controls.failNextDailyWrite=true;
    if(failing&&fault==='marker-read')controls.failLocalGetKeys=new Set(['deletionRecovery']);
    const result=await h.app.deletionRecovery.flush();controls.failLocalGetKeys=new Set();settlements.push(result);return result;
  };
  const {capture}=harness({data:freeze({activeSession:freeze({save:h.app.activeSession.save,settled:h.app.activeSession.settled,load:h.app.activeSession.load}),dailyRecords:freeze({backupDates:h.app.dailyRecords.backupDates,backupMonth:h.app.dailyRecords.backupMonth}),notes:freeze({flush:h.app.notes.flush,failure:h.app.notes.failure,readFreshPayload:h.app.notes.readFreshPayload,exportPayload:h.app.notes.exportPayload,readFreshItems:h.app.notes.readFreshItems}),deletionRecovery:freeze({flush,savedDays:h.app.deletionRecovery.savedDays,notes:h.app.deletionRecovery.notes,attachments:h.app.deletionRecovery.attachments}),mutationEpoch:freeze({read:h.app.mutationEpoch.read}),preparationUnits:h.app.preparationUnits,provenance:h.app.provenance,pendingReviews:freeze({list:h.app.pendingReviews.list,readItems:h.app.pendingReviews.readItems})}),persistence:freeze({storageGeneration:()=>0,sourceRevision:host.currentBackupSourceRevision,snapshotRevision:host.backupSnapshotRevision,dailyRecordDocuments:h.app.dailyRecords.documents})});
  const options={requireCanonicalComplete:route!=='rescue',assumeFlushed:route==='assumed-settled'};
  if(route==='rescue'){
    const partial=await capture.captureLogicalCheckpoint(undefined,options);assert.equal(partial.completeness.complete,false);assert.equal(partial.completeness.deletionState,'uncertain');assert.match(partial.warning,/deletion recovery/);
  }else{
    if(route==='incremental')assert.equal(await capture.beginManagedPreparationCapture(),null,'incomplete settlement cannot authorize preparation units');
    await assert.rejects(()=>capture.captureLogicalCheckpoint(undefined,options),{code:'BACKUP_CANONICAL_CAPTURE_INCOMPLETE'});
  }
  assert.equal(h.stores.daily.has(date),true,'failed reconciliation must retain the physical row');assert.ok(h.sharedLocal.has('deletionRecovery'),'pending deletion must remain recoverable');
  failing=false;
  const complete=await capture.captureLogicalCheckpoint(undefined,{requireCanonicalComplete:true,assumeFlushed:options.assumeFlushed});
  assert.equal(complete.completeness.complete,true);assert.equal(complete.completeness.deletionState,'canonical');assert.equal(complete.warning,'');assert.deepEqual(Array.from(complete.recordDates),[]);assert.equal(complete.savedDayDeletions[0]?.date,date);
  assert.equal(settlements.at(-1),true);assert.equal(h.stores.daily.has(date),false);assert.equal(h.sharedLocal.has('deletionRecovery'),false);
  cases.push(route+': '+fault+' blocks false completeness and recovers with deletion history');
}
// Without write control, only a canonical fast fence proves settled state.
for(const proven of [true,false]){
  const base=harness({session:freeze({canMutate:()=>false,cancelLiveDraftSave(){},captureSnapshot:()=>null,hasTasks:()=>false,toActiveSession:value=>value}),persistence:freeze({storageGeneration:()=>0,sourceRevision:async()=> '2026-10-01T12:00:00.000Z',snapshotRevision:async()=>proven?'study-director.fast-capture-fence.v1|'+'a'.repeat(32)+'|stable':'legacy-unsettled',dailyRecordDocuments:async dates=>dates.map(date=>({date}))})});
  const captured=await base.capture.captureLogicalCheckpoint();assert.equal(captured.completeness.complete,proven);assert.equal(captured.completeness.deletionState,proven?'canonical':'uncertain');assert.ok(!base.calls.includes('deletionSettle'),'read-only capture must not reconcile deletions');await base.capture.assertLogicalCheckpointCurrent(captured);
  cases.push('read-only completeness requires '+(proven?'proven':'unavailable')+' canonical fence');
}
// Execute the production host gateway against real session recovery, not a
// fixture wrapper that accidentally drops strict-read options.
const hostSessionLoad=appSource.match(/persistence:Object\.freeze\(\{\s*activeSessionLoad:([^\n]+),\n/u)[1];
for(const rescued of [false,true]){
  const controls={},h=createHarness(new Map(),null,controls),session={id:'active',type:'activeSession',version:1,date:'2026-10-01',status:'suspended',scheduleText:'',suspendedAt:'2026-10-01T12:00:00.000Z',revision:20,updatedAt:'2026-10-01T12:20:00.000Z',snapshot:{review:{reflection:'Current canonical reflection'}}};
  if(rescued){controls.failSessionWrite=true;await h.app.activeSession.save({...session,revision:19,updatedAt:'2026-10-01T12:19:00.000Z',snapshot:{review:{reflection:'Older rescue'}}},{emergency:true});controls.failSessionWrite=false;}
  h.stores.session.set('active',session);controls.onSessionRead=async()=>{throw new Error('Temporary canonical session read failure');};
  const load=vm.runInNewContext('('+hostSessionLoad+')',{AppData:h.app});
  const interactive=await load();assert.equal(interactive.ok,rescued);assert.ok(interactive.error);assert.equal(interactive.value?.revision||null,rescued?19:null);
  await assert.rejects(()=>load(0,{strict:true}),/Temporary canonical session read failure/);
  controls.onSessionRead=null;const recovered=await load(0,{strict:true});assert.equal(recovered.ok,true);assert.equal(recovered.error,null);assert.equal(recovered.value.revision,20);
  cases.push('host strict-read propagation rejects unavailable canonical session '+(rescued?'with':'without')+' older rescue and recovers newest stored state');
}


// Canonical text-domain capture and recoverability of referenced binary assets
// are distinct. A missing image must preserve the rescue checkpoint, not claim
// that all of its attachment bytes are available.
{
  const missingId='img-abcdefghijklmnopqrstuvwx';
  const h=harness({backup:{assetIds:()=>freeze([missingId])}});
  const captured=await h.capture.captureLogicalCheckpoint();
  assert.equal(captured.completeness.complete,true,'canonical record capture must remain available as a partial rescue');
  assert.equal(captured.completeness.attachments,'missing');
  assert.equal(captured.completeness.fullyRecoverable,false);
  assert.equal(captured.assetItems[0].descriptor.assetId,missingId);
  assert.equal(captured.assetItems[0].descriptor.missing,true);
  assert.match(captured.warning,/Partial attachment recovery/u,'a missing attachment must produce explicit success warning');
}

// The actual host freshness/receipt functions must not certify a backup from
// absent canonical revision evidence or an uncommitted local receipt.
{
  const appSource=fs.readFileSync('source/app.html','utf8');
  const first=appSource.indexOf('const VERIFIED_RECOVERY_META_KEY='),last=appSource.indexOf('// Compare policy identity',first);
  assert.ok(first>=0&&last>first,'freshness host code must remain identifiable');
  let durable={version:3,file:null,providers:{}},changedAt='',writeGate=null,failWrite=false,failRead=false;
  const diagnostics=[];
  const sandbox={
    APP_META_KEYS:{verifiedRecoveryBackups:'verifiedRecoveryBackups'},
    DATA_CONTRACT:{schemas:{Backup:{version:20}}},
    BackupProviderRuntime:{refresh(){}},
    AppDiagnostics:{capture:(...parts)=>diagnostics.push(parts)},
    currentBackupSourceRevision:()=>changedAt,
    readStorageHealth:()=>({lastLocalSaveAt:changedAt}),
    readHostAppMetaValue:async()=>{if(failRead)throw new Error('Injected receipt read failure');return durable;},
    writeHostAppMetaValue:async(_key,value)=>{if(failWrite)throw new Error('Injected receipt commit failure');if(writeGate)await writeGate;durable=structuredClone(value);},
    AppData:{mutationEpoch:{latestChangeAt:async recorded=>changedAt||recorded}}
  };
  vm.createContext(sandbox);
  vm.runInContext(appSource.slice(first,last)+'\n globalThis.freshnessTest={recordBackupCopy,verifyFreshCurrentBackup,receipt:()=>verifiedRecoveryState};',sandbox);
  const api=sandbox.freshnessTest;
  assert.equal((await api.verifyFreshCurrentBackup()).ok,false,'missing canonical change clock cannot certify a fresh copy');
  changedAt='2026-10-01T12:00:00.000Z';
  let unlock;writeGate=new Promise(resolve=>{unlock=resolve;});
  const pending=api.recordBackupCopy({source:'google-drive',sourceRevision:changedAt,attachmentsComplete:true});
  await Promise.resolve();
  assert.equal(Object.keys(api.receipt().providers).length,0,'pending local receipt must not appear durable before commit');
  unlock();await pending;writeGate=null;
  assert.equal((await api.verifyFreshCurrentBackup()).ok,true,'durable full copy at canonical revision is fresh');
  assert.ok(api.receipt().providers['google-drive'],'completed local metadata commit becomes visible');
  changedAt='2026-10-01T12:00:01.000Z';
  assert.equal((await api.verifyFreshCurrentBackup()).ok,false,'stale copy cannot satisfy newer canonical revision');
  failWrite=true;
  await assert.rejects(api.recordBackupCopy({source:'device-folder',sourceRevision:changedAt,attachmentsComplete:true}),/Injected receipt commit failure/);
  assert.equal(api.receipt().providers['device-folder'],undefined,'failed durable receipt write must not update memory');
  failWrite=false;failRead=true;
  assert.equal((await api.verifyFreshCurrentBackup()).ok,false,'unreadable receipt must fail closed');
  failRead=false;
  await api.recordBackupCopy({source:'google-drive',sourceRevision:changedAt,attachmentsComplete:false});
  assert.equal(api.receipt().providers['google-drive'].format,null,'known partial attachment copy cannot certify full recovery');
  assert.equal((await api.verifyFreshCurrentBackup()).ok,false,'known partial attachment backup cannot prove fully fresh recovery');
  assert.ok(diagnostics.some(row=>String(row[0]).includes('freshness-write')),'failed local receipt must leave diagnostics');
}



// Browser-reset recovery must await the actual Device Folder installation and
// permission read, share an in-flight startup task, and fail open to the
// explicit recovery decision rather than hanging forever.
{
  const appSource=fs.readFileSync('source/app.html','utf8');
  const start=appSource.indexOf('const STORAGE_RESET_RETRY_MS='),end=appSource.indexOf('const storageResetSteps=',start);
  assert.ok(start>=0&&end>start,'storage reset gate remains a single host contract');
  let finishInstall,finishPermission,connected=false,installCalls=0,refreshCalls=0,timeout=null;
  const installing=new Promise(resolve=>{finishInstall=resolve;}),permission=new Promise(resolve=>{finishPermission=resolve;});
  const diagnostics=[];
  const sandbox={
    Date,Promise,Object,Array,Map,Set,Error,
    setTimeout:callback=>{timeout=callback;return 1;},clearTimeout:()=>{timeout=null;},
    BackupProviderRuntime:{suspendBackground:()=>({release(){}}),connected:()=>false},
    DeviceBackup:{install:()=>{installCalls++;return installing;},refreshPermission:()=>{refreshCalls++;return permission;},status:()=>({connected})},
    reconcileStartupChangeClock:async()=>true,
    readStorageHealth:()=>({browserDataClearedAt:''}),writeStorageHealth:()=>{},
    AppDiagnostics:{capture:(...args)=>diagnostics.push(args)}
  };
  vm.createContext(sandbox);
  vm.runInContext('let storageResetHold=null,storageResetSince=0;\n'+appSource.slice(start,end),sandbox);
  const hold=vm.runInContext("beginStorageResetHold('2026-10-31T00:00:00.000Z')",sandbox);
  assert.ok(hold.deviceReady&&typeof hold.deviceReady.then==='function');
  let ready=false;hold.deviceReady.then(()=>{ready=true;});
  await Promise.resolve();await Promise.resolve();await Promise.resolve();
  assert.equal(ready,false,'readiness remains pending during in-flight installation');
  const same=vm.runInContext('ensureDeviceBackupInstalled()',sandbox);
  assert.equal(same,vm.runInContext('ensureDeviceBackupInstalled()',sandbox),'startup/reset reuse the installation promise');
  finishInstall({connected:false});
  for(let i=0;i<8;i++)await Promise.resolve();
  assert.equal(ready,false,'permission refresh must also settle before recovery starts');
  connected=true;finishPermission({connected:true});
  assert.equal(await hold.deviceReady,true);assert.equal(installCalls,1);assert.equal(refreshCalls,1);
  vm.runInContext('storageResetHold=null;deviceBackupInstallPromise=null;',sandbox);
  sandbox.DeviceBackup.install=async()=>({connected:false});
  sandbox.DeviceBackup.refreshPermission=async()=>{throw new Error('Permission unavailable');};
  const unavailable=vm.runInContext("beginStorageResetHold('2026-10-31T00:01:00.000Z')",sandbox);
  assert.equal(await unavailable.deviceReady,false,'failed permission is a fallback, not a stalled restore');
  assert.ok(diagnostics.some(row=>String(row[0]).includes('storage-reset.device-ready')));
  vm.runInContext('storageResetHold=null;deviceBackupInstallPromise=null;',sandbox);
  sandbox.DeviceBackup.install=()=>new Promise(()=>{});
  const stalled=vm.runInContext("beginStorageResetHold('2026-10-31T00:02:00.000Z')",sandbox);
  assert.equal(typeof timeout,'function');
  timeout();
  assert.equal(await stalled.deviceReady,false,'unresponsive permission API is bounded');
}



// The browser can remove the database while the app is closed and keep the
// rest of its browser storage. The next start then makes a new, empty
// database. When browser storage says study data was saved here, that start
// is handled as a browser-data clear: recorded, uploads paused, notice shown.
// A fresh install, a new profile and a secondary tab never take this path.
{
  const appSource=fs.readFileSync('source/app.html','utf8');
  const start=appSource.indexOf('function noteDatabaseRemovedWhileClosed(){'),end=appSource.indexOf('// Continuing, any verified restore or combine',start);
  assert.ok(start>=0&&end>start,'the cold-start detector sits beside the reload resume');
  const run=({fresh,saved,primary=true,cleared=''})=>{
    const health={lastStudyDataSaveAt:saved?'2026-11-04T20:00:00.000Z':null,browserDataClearedAt:cleared||null},calls={holds:[],decisions:0,writes:0,diagnostics:[]};
    const sandbox={Date,Object,Error,String,
      IndexedDb:{lifecycle:()=>({startedFresh:fresh})},appCanMutate:()=>primary,
      readStorageHealth:()=>({...health}),writeStorageHealth:patch=>{calls.writes++;Object.assign(health,patch);return true;},
      AppData:{local:{getJson:()=>({...health})}},STORAGE_KEYS:{storageHealth:'health'},
      beginStorageResetHold:clearedAt=>{const hold={clearedAt,reloaded:false};calls.holds.push(hold);return hold;},
      showStorageResetDecision:()=>{calls.decisions++;},
      storageResetConnectionsChanged:()=>{calls.connections=(calls.connections||0)+1;return false;},
      AppDiagnostics:{capture:(...args)=>calls.diagnostics.push(args)}
    };
    vm.createContext(sandbox);
    vm.runInContext('let storageResetHold=null;\n'+appSource.slice(start,end)+'\nglobalThis.resume=resumeUnresolvedStorageReset;',sandbox);
    return {resumed:sandbox.resume(),health,calls};
  };
  const lost=run({fresh:true,saved:true});
  assert.equal(lost.resumed,true,'a new database where study data was saved before is a clear');
  assert.ok(Number.isFinite(Date.parse(lost.health.browserDataClearedAt)),'it is recorded, so a reload brings the notice back');
  assert.equal(lost.calls.holds.length,1);assert.equal(lost.calls.holds[0].clearedAt,lost.health.browserDataClearedAt);
  assert.equal(lost.calls.holds[0].reloaded,true);assert.equal(lost.calls.decisions,1,'the restore notice is shown at once');
  assert.equal(lost.calls.connections,1,'a Drive sign-in kept from before the clear is checked at once');
  assert.ok(lost.calls.diagnostics.some(row=>row[0]==='storage.idb-missing-at-start'));
  for(const [label,state] of [['a fresh install',{fresh:true,saved:false}],['a database that was already here',{fresh:false,saved:true}],['a secondary tab',{fresh:true,saved:true,primary:false}]]){
    const result=run(state);
    assert.equal(result.resumed,false,label+' is not a clear');
    assert.equal(result.calls.writes,0,label+' records nothing');assert.equal(result.calls.holds.length,0,label+' pauses nothing');assert.equal(result.calls.decisions,0);
  }
  // A second loss while the first notice is unanswered is dated by its own
  // start: the notice says when data was last cleared, and the restore takes
  // the newest version saved before it. While a clear is unanswered this
  // device uploads nothing, so a later time never takes in its empty state.
  const earlier='2026-11-05T02:51:00.000Z',again=run({fresh:true,saved:true,cleared:earlier});
  assert.equal(again.calls.writes,1,'a second loss records its own time');
  assert.ok(Date.parse(again.health.browserDataClearedAt)>Date.parse(earlier));
  assert.equal(again.calls.holds[0].clearedAt,again.health.browserDataClearedAt);assert.equal(again.calls.decisions,1);
  const reloaded=run({fresh:false,saved:true,cleared:earlier});
  assert.equal(reloaded.calls.writes,0,'a reload of an unanswered clear keeps its time');assert.equal(reloaded.calls.holds[0].clearedAt,earlier);
}

// Removed profiles keep emergency browser rescue copies if IndexedDB/OPFS
// deletion fails; the registry intent survives and retries are idempotent.
{
  vm.runInThisContext(fs.readFileSync('source/core/profiles.js','utf8'));
  const profiles=globalThis[Symbol.for('studyDirector.internalModules.v1')].require('profiles',1);
  const removed='prof_removed_abcdef_12345678',live='prof_live_abcdef_12345679',registryKey='profiles-test-registry';
  const registryRow={version:1,active:live,profiles:[{id:live,scope:live,name:'Current',createdAt:'2026-10-31T00:00:00.000Z'}],removing:[removed]};
  const store=new Map([[registryKey,JSON.stringify(registryRow)],['noteRescue~'+removed,'unsaved'],['noteRescue~'+live,'current']]);
  const events=[],fail={db:true,opfs:false,local:false};
  const controller=profiles.createController(freeze({ports:freeze({
    scope:freeze({pattern:/^prof_[a-z0-9]{1,24}_[a-z0-9]{6,12}_[a-f0-9]{8}$/u,registryKey,scope:live,separator:'~'}),
    storage:freeze({read:()=>store.get(registryKey)||null,write:value=>{store.set(registryKey,value);return true;},keys:()=>[...store.keys()],remove:key=>{if(fail.local)return false;return store.delete(key);}}),
    names:freeze({database:'study-db',directories:freeze(['assets','rollback']),keys:freeze(['noteRescue']),legacyDirectory:'legacy-assets'}),
    platform:freeze({deleteDatabase:async name=>{events.push('db:'+name);if(fail.db)throw new Error('Blocked IDB delete');return true;},removeDirectory:async name=>{events.push('opfs:'+name);if(fail.opfs)throw new Error('Blocked OPFS delete');},listen:()=>()=>{},now:()=>Date.now(),random:()=> '12345678',reload:()=>{}}),
    limits:freeze({maxName:60})
  })}));
  const pending=()=>JSON.parse(store.get(registryKey)).removing;
  assert.equal((await controller.collect()).removed,false);
  assert.equal(store.get('noteRescue~'+removed),'unsaved','blocked IDB deletion must preserve rescue bytes');
  assert.deepEqual(pending(),[removed]);
  fail.db=false;fail.opfs=true;
  assert.equal((await controller.collect()).removed,false);
  assert.equal(store.get('noteRescue~'+removed),'unsaved','failed OPFS deletion must preserve rescue bytes');
  assert.deepEqual(pending(),[removed]);
  fail.opfs=false;fail.local=true;
  assert.equal((await controller.collect()).removed,false);
  assert.deepEqual(pending(),[removed],'failed local rescue removal retains pending deletion');
  fail.local=false;
  assert.equal((await controller.collect()).removed,true);
  assert.equal(store.has('noteRescue~'+removed),false);
  assert.equal(store.get('noteRescue~'+live),'current','an unrelated live profile is untouched');
  assert.deepEqual(pending(),[]);
  assert.equal((await controller.collect()).removed,false,'a completed cleanup is idempotent');
  assert.ok(events.some(row=>row.startsWith('opfs:')));
}

console.log(JSON.stringify({status:'PASS',suite:'backup-capture-safety',cases},null,2));
