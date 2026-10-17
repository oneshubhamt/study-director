import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../../../source/app.html',import.meta.url),'utf8');
const start=html.indexOf('function canonicalAttachmentReferenceDescriptor(event){');
const end=html.indexOf('\nasync function refreshPersistedSessionBadge()',start);
assert.ok(start>=0&&end>start,'The reference-aware canonical commit handler must be available.');
const commits=[],notifications=[],maintenanceDelays=[];
const RichTextApi={scanAttachmentReferences:value=>({trusted:true,assetIds:[...String(value||'').matchAll(/img-[a-z0-9-]{20,80}/g)].map(match=>match[0])})};
const handler=new Function('writeStorageHealth','renderStorageHealth','document','NativeCapabilities','notifyBackupChange','scheduleRichTextAssetMaintenance','invalidateAttachmentLibrary','RichTextApi','ACTIVE_SESSION_ID',
  `let richAssetReferenceRevision=0;const canonicalAttachmentReferenceSignatures=new Map();${html.slice(start,end)};return {handleCanonicalCommit,getRevision:()=>richAssetReferenceRevision};`)(
  state=>commits.push(state),()=>{}, {querySelector:()=>null},null,change=>notifications.push(change),delay=>maintenanceDelays.push(delay),()=>{},RichTextApi,'active-session'
);
handler.handleCanonicalCommit({entityType:'activeSession',operation:'upsert',value:{snapshot:{review:{reflection:'',studyQuality:null}}},committedAt:'2026-09-23T17:00:00.000Z',backupCapture:true});
assert.equal(commits.length,1,'A backup session flush still updates local storage health.');
assert.equal(notifications.length,0,'A backup capture cannot schedule another automatic device backup.');
assert.equal(maintenanceDelays.length,0,'The first routine active-session snapshot must not manufacture attachment GC work.');
for(const entityType of ['planData','note','dailyRecord']){
  const before=notifications.length,value=entityType==='note'?{key:'BackupCaptureQA',text:''}:entityType==='dailyRecord'?{date:'2026-09-22',reflection:''}:null;
  handler.handleCanonicalCommit({entityType,operation:'upsert',value,committedAt:'2026-09-23T17:00:30.000Z',backupCapture:true});
  assert.equal(notifications.length,before,`${entityType} flushed for backup capture must not recursively schedule another Device backup.`);
}
const backupCaptureMaintenance=maintenanceDelays.length;
handler.handleCanonicalCommit({entityType:'activeSession',operation:'upsert',value:{snapshot:{review:{reflection:'',studyQuality:null}}},committedAt:'2026-09-23T17:01:00.000Z',backupCapture:false});
assert.equal(notifications.length,1,'A live session checkpoint still marks Device Folder state dirty.');
assert.equal(maintenanceDelays.length,backupCaptureMaintenance,'An unchanged active-session reference set must not schedule attachment maintenance.');
handler.handleCanonicalCommit({entityType:'activeSession',operation:'upsert',value:{snapshot:{review:{reflection:'img-reference-12345678901234567890',studyQuality:null}}},committedAt:'2026-09-23T17:01:30.000Z',backupCapture:false});
assert.equal(notifications.length,2,'A changed live session checkpoint still marks Device Folder state dirty.');
assert.equal(maintenanceDelays.length,backupCaptureMaintenance+1,'A changed Active Session reflection is now authoritative unsaved Review state and must update attachment reachability.');
handler.handleCanonicalCommit({entityType:'dailyRecord',operation:'upsert',value:{date:'2026-09-23',reflection:'plain text'},committedAt:'2026-09-23T17:02:00.000Z'});
assert.equal(notifications.length,3,'Saving a day still schedules automatic backup.');
assert.equal(notifications.at(-1).urgent,true);
assert.equal(maintenanceDelays.length,backupCaptureMaintenance+2,'The first Saved-Day reflection commit establishes its own verified cleanup baseline.');
handler.handleCanonicalCommit({entityType:'dailyRecord',operation:'upsert',value:{date:'2026-09-23',reflection:'plain text changed'},committedAt:'2026-09-23T17:03:00.000Z'});
assert.equal(maintenanceDelays.length,backupCaptureMaintenance+2,'Plain-text edits with the same Saved-Day attachment-reference set must not rescan attachment GC.');
handler.handleCanonicalCommit({entityType:'dailyRecord',operation:'upsert',value:{date:'2026-09-23',reflection:'img-reference-12345678901234567890'},committedAt:'2026-09-23T17:04:00.000Z'});
assert.equal(maintenanceDelays.length,backupCaptureMaintenance+3,'Adding an attachment reference must schedule attachment maintenance.');
assert.equal(handler.getRevision(),6,'Canonical reference signatures advance independently of whether backup-capture commits suppress maintenance scheduling.');
console.log(JSON.stringify({status:'PASS',suite:'backup-capture-notification',referenceAwareMaintenance:true}));
