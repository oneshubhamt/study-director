import assert from 'node:assert/strict';
import fs from 'node:fs';

// The 7-day backup reminder is one rule for every kind of backup: it never
// appears while an automatic backup can run or while some backup already holds
// the latest changes, and it does appear when changes have gone a week
// without reaching any backup.
const html=fs.readFileSync(new URL('../../../source/app.html',import.meta.url),'utf8');
const start=html.indexOf('async function maybePromptBackupNudge(force=false){'),end=html.indexOf('\n/* LIVE DRAFT AND ACTIVE SESSION STORE */',start);
assert.ok(start>=0&&end>start,'The backup reminder must be available.');
const DAY=24*60*60*1000,now=Date.parse('2026-10-06T08:00:00.000Z'),iso=ms=>new Date(ms).toISOString();
function reminder({lastBackupAt=null,lastLocalSaveAt=null,covered=[],device=false,drive=false,savedDays=0}){
  const notified=[];
  const run=new Function('appCanMutate','readStorageHealth','verifiedRecoveryEntries','DeviceBackup','BackupProviderRuntime','AppData','refreshStorageFallbackWarning','todayISO','notifyUser','Date',
    `let backupNudgeCheckedAt=0,backupNudgeMessage='',backupNudgeNotifiedDate='';const BACKUP_NUDGE_CHECK_MS=3600000,BACKUP_NUDGE_MS=7*24*60*60*1000;${html.slice(start,end)};return maybePromptBackupNudge(true).then(()=>backupNudgeMessage);`);
  const FixedDate=class extends Date{static now(){return now;}};
  // Device Folder and Drive are both engine locations: either one able to back
  // up on its own makes automaticActive() true.
  return run(()=>true,()=>({lastBackupAt,lastLocalSaveAt}),()=>covered.map(at=>({sourceRevision:at})),null,{automaticActive:()=>device||drive},
    {dailyRecords:{summaries:async()=>Array.from({length:savedDays},(_,i)=>({date:i}))}},()=>{},()=>'2026-10-06',(...args)=>notified.push(args),FixedDate).then(message=>({message,notified}));
}
const cases=[];
{
  const r=await reminder({lastBackupAt:iso(now-10*DAY),lastLocalSaveAt:iso(now-2*DAY),covered:[iso(now-10*DAY)]});
  assert.match(r.message,/over a week old/u);assert.equal(r.notified.length,1);cases.push('changes a week past the last backup: reminded once');
}
{
  const r=await reminder({lastBackupAt:iso(now-10*DAY),lastLocalSaveAt:iso(now-10*DAY),covered:[iso(now-10*DAY)]});
  assert.equal(r.message,'');assert.equal(r.notified.length,0);cases.push('an old backup that holds the latest changes: no reminder');
}
for(const [label,options] of [['Device Folder',{device:true}],['Drive while signed in',{drive:true}]]){
  const r=await reminder({lastBackupAt:iso(now-10*DAY),lastLocalSaveAt:iso(now-1000),covered:[iso(now-10*DAY)],...options});
  assert.equal(r.message,'');assert.equal(r.notified.length,0);cases.push(`automatic ${label}: no reminder`);
  const fresh=await reminder({savedDays:9,...options});assert.equal(fresh.message,'',`automatic ${label} covers a device that never made a backup file`);
}
{
  const r=await reminder({lastBackupAt:iso(now-3*DAY),lastLocalSaveAt:iso(now-1000),covered:[iso(now-3*DAY)]});
  assert.equal(r.message,'');cases.push('a recent backup: no reminder');
}
{
  assert.match((await reminder({savedDays:7})).message,/over a week old/u);assert.equal((await reminder({savedDays:3})).message,'');
  cases.push('never backed up: reminded once a week of days is saved');
}
console.log(JSON.stringify({status:'PASS',suite:'backup-reminder',cases},null,2));
