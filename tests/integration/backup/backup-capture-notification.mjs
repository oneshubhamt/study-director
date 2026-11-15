import {readScript} from '../../../build/source-script.mts';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const context=vm.createContext({Symbol,Object,Map,Set,Date,Promise,Error,TypeError});
for(const file of ['source/core/internal.ts','source/core/backup-readiness-host.ts'])
  vm.runInContext(readScript(file),context,{filename:file});
const module=context[Symbol.for('studyDirector.internalModules.v1')].require('backup-readiness-host',1);
const commits=[],notifications=[],maintenanceDelays=[],badgeEvents=[];
let revision=0,reminderDate='',noticeRechecks=0;
const RichTextApi={scanAttachmentReferences:value=>({trusted:true,assetIds:[...String(value||'').matchAll(/img-[a-z0-9-]{20,80}/g)].map(match=>match[0])})};
const handler=module.createCanonicalCommit(Object.freeze({
  storage:Object.freeze({updateHistory:state=>{commits.push(state);return state;},render:()=>{}}),
  scanAttachmentReferences:value=>RichTextApi.scanAttachmentReferences(value),
  incrementReferenceRevision:()=>{revision++;},
  syncCapability:event=>badgeEvents.push(event),
  notifyBackupChange:change=>notifications.push(change),
  scheduleAssetMaintenance:()=>maintenanceDelays.push(15000),
  invalidateAttachmentLibrary:()=>{},
  fullyInitialized:()=>true,
  refreshKeptVersions:()=>false,
  reminderDate:()=>reminderDate,
  revalidateSaveReminder:()=>{noticeRechecks++;return Promise.resolve(true);},
  nowIso:()=>new Date().toISOString()
}));

handler.handle({entityType:'activeSession',operation:'upsert',value:{snapshot:{review:{reflection:'',studyQuality:null}}},committedAt:'2026-09-23T17:00:00.000Z',backupCapture:true});
assert.equal(badgeEvents.length,1,'the capability badge observes even a backup-capture commit');
assert.equal(commits.length,1,'A backup session flush still updates local storage health.');
assert.equal(notifications.length,0,'A backup capture cannot schedule another automatic device backup.');
assert.equal(maintenanceDelays.length,0,'The first routine active-session snapshot must not manufacture attachment GC work.');
for(const entityType of ['planData','note','dailyRecord']){
  const before=notifications.length,value=entityType==='note'?{key:'BackupCaptureQA',text:''}:entityType==='dailyRecord'?{date:'2026-09-22',reflection:''}:null;
  handler.handle({entityType,operation:'upsert',value,committedAt:'2026-09-23T17:00:30.000Z',backupCapture:true});
  assert.equal(notifications.length,before,`${entityType} flushed for backup capture must not recursively schedule another Device backup.`);
}
const backupCaptureMaintenance=maintenanceDelays.length;
handler.handle({entityType:'activeSession',operation:'upsert',value:{snapshot:{review:{reflection:'',studyQuality:null}}},committedAt:'2026-09-23T17:01:00.000Z',backupCapture:false});
assert.equal(notifications.length,1,'A live session checkpoint still marks Device Folder state dirty.');
assert.equal(maintenanceDelays.length,backupCaptureMaintenance,'An unchanged active-session reference set must not schedule attachment maintenance.');
handler.handle({entityType:'activeSession',operation:'upsert',value:{snapshot:{review:{reflection:'img-reference-12345678901234567890',studyQuality:null}}},committedAt:'2026-09-23T17:01:30.000Z',backupCapture:false});
assert.equal(notifications.length,2,'A changed live session checkpoint still marks Device Folder state dirty.');
assert.equal(maintenanceDelays.length,backupCaptureMaintenance+1,'A changed Active Session reflection is now authoritative unsaved Review state and must update attachment reachability.');
handler.handle({entityType:'dailyRecord',operation:'upsert',value:{date:'2026-09-23',reflection:'plain text'},committedAt:'2026-09-23T17:02:00.000Z'});
assert.equal(notifications.length,3,'Saving a day still schedules automatic backup.');
assert.equal(notifications.at(-1).urgent,true);
assert.equal(maintenanceDelays.length,backupCaptureMaintenance+2,'The first Saved-Day reflection commit establishes its own verified cleanup baseline.');
handler.handle({entityType:'dailyRecord',operation:'upsert',value:{date:'2026-09-23',reflection:'plain text changed'},committedAt:'2026-09-23T17:03:00.000Z'});
assert.equal(maintenanceDelays.length,backupCaptureMaintenance+2,'Plain-text edits with the same Saved-Day attachment-reference set must not rescan attachment GC.');
handler.handle({entityType:'dailyRecord',operation:'upsert',value:{date:'2026-09-23',reflection:'img-reference-12345678901234567890'},committedAt:'2026-09-23T17:04:00.000Z'});
assert.equal(maintenanceDelays.length,backupCaptureMaintenance+3,'Adding an attachment reference must schedule attachment maintenance.');
assert.equal(revision,6,'Canonical reference signatures advance independently of whether backup-capture commits suppress maintenance scheduling.');

const backupBeforeReminder=notifications.length;
reminderDate='2026-09-23';
handler.handle({entityType:'dailyRecord',operation:'upsert',value:{date:'2026-09-23',reflection:'plain text'},committedAt:'2026-09-23T17:05:00.000Z',backupCapture:true});
assert.equal(noticeRechecks,1,'a pending Save Today warning must revalidate after a canonical Day commit');
assert.equal(notifications.length,backupBeforeReminder,'reminder reconciliation must not schedule a recursive backup');
reminderDate='';
handler.handle({entityType:'dailyRecord',operation:'upsert',value:{date:'2026-09-23',reflection:'plain text'},backupCapture:true});
assert.equal(noticeRechecks,1,'no redundant coverage read after the reminder is settled');

console.log(JSON.stringify({status:'PASS',suite:'backup-capture-notification',checkedOwner:true,referenceAwareMaintenance:true,reminderRevalidation:true}));
