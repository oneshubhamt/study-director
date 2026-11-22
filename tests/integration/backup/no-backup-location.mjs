import {readCoreScript} from '../../helpers/core-script.mjs';
import {readScript} from '../../../build/source-script.mts';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createDeviceFolderWorld,MINUTE} from '../../helpers/device-folder-world.mjs';

for(const file of ['source/core/internal.ts','source/core/backup-maintenance-host.ts','source/core/backup-recovery-host.ts'])vm.runInThisContext(readScript(file),{filename:file});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const Maintenance=registry.require('backup-maintenance-host',1),Recovery=registry.require('backup-recovery-host',1),freeze=Object.freeze;

// Someone who uses neither the Device Folder nor Google Drive: every backup
// interaction across the app still works, does nothing it does not need to,
// and keeps recovery explicit after a browser-data clear.
const w=createDeviceFolderWorld({supported:false});await w.controller.install();
const runtime=w.runtime,captured=[],shown=[],storageEvents=[];
const capture=(scope,error)=>captured.push(scope+': '+(error?.message||error));
const background=Maintenance.createProviderBackgroundBridge(freeze({provider:()=>runtime,capture:(scope,error)=>capture(scope,error)}));
const cases=[];

assert.equal(runtime.list({hosted:true}).length,0,'no backup location exists');
assert.equal(background.noteChange({urgent:true,reason:'study-day-completed'}),true);await w.tick(30*MINUTE);
assert.equal(w.published.length,0);cases.push('changes and key moments are noted without any backup');
await background.flush('app-hidden');assert.equal(background.waiting(),false);cases.push('going to the background does nothing');
const started=w.clock.now();await background.flush('app-update');assert.equal(w.clock.now(),started,'an update-triggered backup flush never waits when there is no location');assert.equal(background.waiting(),false);cases.push('an update backup flush has nothing to wait for');

let health={lastStudyDataSaveAt:'2026-10-06T06:00:00.000Z',browserDataClearedAt:null};
const reset=Recovery.createStorageReset(freeze({
  authority:freeze({canMutate:()=>true}),
  canonical:freeze({
    dailyRecordsList:async()=>freeze([]),notesReadFreshPayload:async()=>freeze({}),
    activeSessionLoad:async()=>freeze({ok:true,value:null,error:null,storage:freeze({idb:true})}),
    planDataRead:async()=>freeze({draft:'',savedPlans:freeze([])}),attachmentsList:async()=>freeze([]),
    pendingReviewsList:async()=>freeze([]),savedDayDeletions:async()=>freeze([]),noteDeletions:async()=>freeze([])
  }),
  writeback:freeze({
    installationKeep:()=>true,notesRecover:()=>true,planRewrite:()=>true,settingsFlush:()=>true,hasTasks:()=>false,
    writeLiveDraft:async()=>freeze({ok:true,value:null,error:null,storage:freeze({idb:true})})
  }),
  provider:freeze({
    history:(id,options)=>runtime.history(id,options),
    restoreRepositoryProviderVersion:(id,options)=>runtime.restoreRepositoryProviderVersion(id,options),
    bringInRepositoryProvider:(id,options)=>runtime.bringInRepositoryProvider(id,options),
    syncRepositoryProvider:id=>runtime.syncRepositoryProvider(id),
    list:()=>runtime.list(),locationStatus:id=>runtime.locationStatus(id),
    suspendBackground:reason=>runtime.suspendBackground(reason),connected:id=>runtime.connected(id)
  }),
  device:freeze({
    status:()=>w.controller.status(),connect:()=>w.controller.connect(),install:()=>w.controller.install(),
    refreshPermission:()=>w.controller.refreshPermission(),rememberAfterStorageReset:()=>w.controller.rememberAfterStorageReset()
  }),
  storage:freeze({
    health:()=>freeze({...health}),updateHealth:patch=>{health={...health,...patch};return true;},
    storedHealth:()=>freeze({...health}),indexedDbLifecycle:()=>freeze({resets:1,startedFresh:false})
  }),
  presentation:freeze({
    restoreChoices:()=>'Data & Backup',openRestore:async()=>false,confirm:async()=>false,notify:()=>{},
    emit:event=>{storageEvents.push(event);return true;},resolve:()=>true,subscribe:()=>()=>{}
  }),
  ownership:freeze({announceStorageReset:()=>true}),mutation:freeze({settled:async()=>true}),background:freeze({wake:()=>true}),
  session:freeze({hasBlocking:()=>false,suspend:async()=>true}),view:freeze({refreshAfterWriteback:()=>true}),
  readiness:freeze({reconcileStartupChangeClock:async()=>true}),diagnostics:freeze({capture:(scope,error)=>capture(scope,error)}),
  environment:freeze({now:w.clock.now,nowIso:()=>new Date(w.clock.now()).toISOString(),setTimeout:w.clock.setTimeout,clearTimeout:w.clock.clearTimeout})
}));
await reset.handle({detectedAt:'2026-10-06T07:00:00.000Z'});
assert.equal(reset.unresolved(),true,'without a location, a browser data clear stays unresolved for an explicit choice');
assert.equal(storageEvents.filter(event=>event.id==='detected').length,1,'the checked recovery owner surfaces the restore/continue decision');
assert.match(storageEvents.find(event=>event.id==='detected').message,/can be restored from Data & Backup/u);
reset.settle();cases.push('a browser data clear falls back to the explicit recovery decision');

const context=vm.createContext({requestAnimationFrame:callback=>callback()});
for(const name of ['internal','foundation-host'])vm.runInContext(readCoreScript(name),context);
const foundation=context[Symbol.for('studyDirector.internalModules.v1')].require('foundation-host',1);
const restore=foundation.createBackupActions({device:()=>w.controller,providers:()=>runtime,goTab:async tab=>{assert.equal(tab,'library');return true;},showData:()=>shown.push('restore:status'),document:{getElementById:()=>({parentElement:null,scrollIntoView(){}}),querySelector:()=>({open:false})},preferredScrollBehavior:()=> 'auto'});
await restore.openBackupRestore();assert.deepEqual(shown,['restore:status'],'restore opens Data & Backup with every way back in');cases.push('restore opens Data & Backup');
assert.equal(runtime.automaticActive(),false,'so the 7-day reminder stays available');
assert.deepEqual({...await runtime.createProtectedSafety('device-folder','before-clear-library')},{verified:false,skipped:true,reason:'unavailable'},'Clear Library proceeds on its own safeguards');cases.push('Clear Library needs no backup location');
assert.equal((await runtime.history('google-drive',{interactive:false})).available,false);assert.equal(runtime.backgroundStatus().length,0);cases.push('Version History and diagnostics report no location');
assert.deepEqual(w.notices,[],'no provider notice at any point');assert.deepEqual(captured,[]);assert.deepEqual(w.captures,[]);
console.log(JSON.stringify({status:'PASS',suite:'no-backup-location',productionEngine:true,productionOwners:['backup-maintenance-host','backup-recovery-host'],cases},null,2));
