import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Connecting Google Drive or the Device Folder while a browser-data clear is
// unresolved brings the library back. A device holding nothing (its database
// was removed while the app was closed) takes it back in full: Drive by a
// verified sync, the Device Folder by offering its newest version from before
// the clear. A device holding what its open tab wrote back adds only what is
// missing. Anything unverified, failed or declined leaves the notice, and
// uploads stay paused.
const source=fs.readFileSync(new URL('../../../source/app.html',import.meta.url),'utf8');
function productionFunction(signature){
  const start=source.indexOf(signature),end=start<0?-1:source.indexOf('\n}',start);
  assert.ok(start>=0&&end>start,`Production function missing: ${signature}`);
  return source.slice(start,end+2);
}
const runtime=[productionFunction('async function recoverAfterStorageResetOnConnect(id){'),productionFunction('async function connectDeviceBackupWithRecovery(){'),productionFunction('function storageResetConnectionsChanged(){')].join('\n');

function harness({empty=true,sync=null,missing=false,offer=false,folderConnected=true}={}){
  const calls={syncs:[],missing:0,offers:[],decisions:0,settled:0,notices:[],captures:[]};
  const hold={clearedAt:'2026-11-07T08:00:00.000Z',reloaded:true};
  const context=vm.createContext({
    Date,
    storageResetHold:hold,storageResetHandling:null,
    appCanMutate:()=>true,
    canonicalLocalRecoveryEmpty:async()=>empty,
    restoreMissingAfterStorageReset:async(given,id)=>{assert.equal(given,hold);calls.missingFrom=id;calls.missing++;if(missing)context.storageResetHold=null;return missing;},
    offerDeviceRecoveryIfLocalEmpty:async options=>{calls.offers.push(options);if(offer)context.storageResetHold=null;return offer;},
    showStorageResetDecision:()=>{calls.decisions++;},
    settleStorageReset:()=>{calls.settled++;context.storageResetHold=null;return true;},
    AppDiagnostics:{capture:(scope)=>calls.captures.push(scope)},
    NoticeCoordinator:{emit:event=>calls.notices.push(event)},
    DeviceBackup:{connect:async()=>true,status:()=>({connected:folderConnected})},
    BackupProviderRuntime:{
      drive:{connected:true,engineBusy:false},locationStatus:id=>id==='google-drive'?context.BackupProviderRuntime.drive:null,
      list:()=>[{id:'google-drive',label:'Google Drive',connected:true}],
      syncRepositoryProvider:async id=>{calls.syncs.push(id);if(sync instanceof Error)throw sync;return sync;}
    }
  });
  vm.runInContext(runtime+'\nglobalThis.recover=recoverAfterStorageResetOnConnect;globalThis.connectFolder=connectDeviceBackupWithRecovery;globalThis.changed=storageResetConnectionsChanged;',context);
  return {context,calls,hold};
}
const cases=[];
{
  // A device holding nothing signs in to Drive: a verified sync brings the library back.
  const t=harness({sync:{cancelled:false,verified:true}});
  assert.equal(await t.context.recover('google-drive'),true);
  assert.deepEqual(t.calls.syncs,['google-drive'],'one sync, in the foreground');
  assert.equal(t.calls.missing,0,'not the missing-only restore, which brings no notes back');
  assert.equal(t.calls.settled,1,'the pause lifts once the sync is verified');assert.equal(t.calls.decisions,0);
  assert.match(t.calls.notices[0].message,/brought back from Google Drive/u);
  cases.push('empty device: verified sync from Drive');
}
for(const [label,sync] of [['an unverified sync',{cancelled:false,verified:false}],['a sync needing a decision',{cancelled:true,reason:'needs-decision'}],['a failed sync',new Error('Drive unavailable')],['an empty Drive',{cancelled:true,reason:'no-source'}]]){
  const t=harness({sync});
  assert.equal(await t.context.recover('google-drive'),false,label);
  assert.equal(t.calls.settled,0,`${label}: uploads stay paused`);assert.equal(t.calls.decisions,1,`${label}: the notice stays`);assert.equal(t.calls.notices.length,0);
  cases.push('empty device: '+label+' keeps the notice');
}
{
  // A device holding what its open tab wrote back adds only what is missing.
  const t=harness({empty:false,missing:true});
  assert.equal(await t.context.recover('google-drive'),true);
  assert.equal(t.calls.missing,1);assert.equal(t.calls.missingFrom,'google-drive','from the location that connected');assert.deepEqual(t.calls.syncs,[],'no sync is forced over data this device holds');assert.equal(t.calls.decisions,0);
  const u=harness({empty:null,missing:false});
  assert.equal(await u.context.recover('google-drive'),false);
  assert.equal(u.calls.missing,1,'an unreadable local state is treated as holding data: only what is missing is added');assert.deepEqual(u.calls.syncs,[]);assert.equal(u.calls.decisions,1);
  cases.push('device with data: missing-only, never a forced sync');
}
{
  // The Device Folder reconnected on a device holding nothing: its newest
  // version from before the clear is offered (the existing question), not a
  // missing-only restore.
  const t=harness({offer:true});
  await t.context.connectFolder();
  assert.equal(t.calls.offers.length,1);assert.equal(t.calls.offers[0].latestBefore,Date.parse(t.hold.clearedAt),'only a version from before the clear');
  assert.equal(t.calls.missing,0);assert.equal(t.calls.decisions,0);
  const declined=harness({offer:false});await declined.context.connectFolder();
  assert.equal(declined.calls.decisions,1,'declining keeps the notice');
  const notConnected=harness({folderConnected:false});await notConnected.context.connectFolder();
  assert.equal(notConnected.calls.offers.length+notConnected.calls.missing+notConnected.calls.decisions,0,'a folder that did not connect changes nothing');
  cases.push('empty device: Device Folder offers its newest version from before the clear');
}
{
  // No unresolved clear: nothing to recover.
  const t=harness();t.context.storageResetHold=null;
  assert.equal(await t.context.recover('google-drive'),false);assert.deepEqual(t.calls.syncs,[]);assert.equal(t.calls.decisions,0);
  cases.push('no clear: nothing runs');
}
{
  // Drive connecting (a kept sign-in at start, or signing in) runs the
  // recovery once per connection, never during the clear's own handling or
  // while Drive is busy; signing in again tries again.
  const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
  const t=harness({sync:{cancelled:true,reason:'needs-decision'}}),drive=t.context.BackupProviderRuntime.drive;
  t.context.storageResetHandling=Promise.resolve();assert.equal(t.context.changed(),false,'not while the open tab handles the clear');t.context.storageResetHandling=null;
  drive.engineBusy=true;assert.equal(t.context.changed(),false,'not while Drive is busy');drive.engineBusy=false;
  assert.equal(t.context.changed(),true);await tick();assert.deepEqual(t.calls.syncs,['google-drive']);
  assert.equal(t.context.changed(),false,'once per connection');
  drive.connected=false;t.context.changed();drive.connected=true;assert.equal(t.context.changed(),true,'signing in again tries again');await tick();assert.equal(t.calls.syncs.length,2);
  t.context.storageResetHold=null;assert.equal(t.context.changed(),false,'nothing once the clear is settled');
  cases.push('Drive connecting triggers the recovery once per connection');
}
console.log(JSON.stringify({status:'PASS',suite:'storage-reset-connect-recovery',cases},null,2));
