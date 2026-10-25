import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createDeviceFolderWorld,MINUTE} from '../../helpers/device-folder-world.mjs';

// Someone who uses neither the Device Folder nor Google Drive: every backup
// interaction across the app still works, does nothing it does not need to,
// and never shows a notice. The app's own functions run against the real
// backup engine with no location registered (a browser without folder access).
const html=fs.readFileSync(new URL('../../../source/app.html',import.meta.url),'utf8');
const slice=(from,to)=>{const start=html.indexOf(from),end=html.indexOf(to,start);assert.ok(start>=0&&end>start,`app.html must contain ${from}`);return html.slice(start,end);};
const w=createDeviceFolderWorld({supported:false});await w.controller.install();
const runtime=w.runtime,captured=[],statuses=[],shown=[];
const AppDiagnostics={capture:(scope,error)=>captured.push(`${scope}: ${error?.message||error}`)};
const source=[
  slice('function notifyBackupChange(change){','document.addEventListener(\'visibilitychange\',()=>{if(document.hidden'),
  slice('const PWA_UPDATE_BACKUP_WAIT_MS=','function notifyDeviceBackupIfStudyDayResolved('),
  slice('async function openBackupRestore(){','function backupRestoreChoices(){'),
  slice('async function restoreMissingAfterStorageReset(hold){','// A reload or a takeover in another tab brings back an unresolved clear.')
].join('\n');
const run=new Function('BackupProviderRuntime','DeviceBackup','AppDiagnostics','appCanMutate','showBackupPresentation','renderPwaUpdateStatus','PwaLifecycle','settleStorageReset','NoticeCoordinator','setTimeout','clearTimeout',
  `let pwaAutomaticBlockMessage='';${source};return {notifyBackupChange,flushAutomaticBackups,automaticBackupsWaiting,backUpBeforeUpdate,openBackupRestore,restoreMissingAfterStorageReset,blockMessage:()=>pwaAutomaticBlockMessage};`);
const app=run(runtime,w.controller,AppDiagnostics,()=>true,async(source,kind)=>{shown.push(`${source}:${kind}`);return true;},()=>statuses.push('render'),{status:()=>({})},()=>{throw new Error('nothing to settle');},{emit:()=>{throw new Error('no notice expected');}},w.clock.setTimeout,w.clock.clearTimeout);
const cases=[];

assert.equal(runtime.list({hosted:true}).length,0,'no backup location exists');
assert.equal(app.notifyBackupChange({urgent:true,reason:'study-day-completed'}),true);await w.tick(30*MINUTE);
assert.equal(w.published.length,0);cases.push('changes and key moments are noted without any backup');
await app.flushAutomaticBackups('app-hidden');assert.equal(app.automaticBackupsWaiting(),false);cases.push('going to the background does nothing');
const started=w.clock.now();await app.backUpBeforeUpdate();assert.equal(w.clock.now(),started,'an update never waits');assert.equal(app.blockMessage(),'');assert.deepEqual(statuses,[]);cases.push('an update applies without waiting');
assert.equal(await app.restoreMissingAfterStorageReset({clearedAt:'2026-10-06T07:00:00.000Z'}),false,'after a browser data clear the person chooses');cases.push('a browser data clear falls back to the decision notice');
await app.openBackupRestore();assert.deepEqual(shown,['restore:status'],'restore opens Data & Backup with every way back in');cases.push('restore opens Data & Backup');
assert.equal(runtime.automaticActive(),false,'so the 7-day reminder stays available');
assert.deepEqual({...await runtime.createProtectedSafety('device-folder','before-clear-library')},{verified:false,skipped:true,reason:'unavailable'},'Clear Library proceeds on its own safeguards');cases.push('Clear Library needs no backup location');
assert.equal((await runtime.history('google-drive',{interactive:false})).available,false);assert.equal(runtime.backgroundStatus().length,0);cases.push('Version History and diagnostics report no location');
assert.deepEqual(w.notices,[],'no notice at any point');assert.deepEqual(captured,[]);assert.deepEqual(w.captures,[]);
console.log(JSON.stringify({status:'PASS',suite:'no-backup-location',productionEngine:true,cases},null,2));
