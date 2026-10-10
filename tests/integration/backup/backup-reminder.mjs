import assert from 'node:assert/strict';
import fs from 'node:fs';

// The 7-day backup reminder is one rule for every kind of backup: it never
// appears while an automatic backup can run or while some backup already holds
// the latest changes, and it does appear when changes have gone a week
// without reaching any backup.
const html=fs.readFileSync(new URL('../../../source/app.html',import.meta.url),'utf8');
const start=html.indexOf('async function maybePromptBackupNudge(force=false){'),end=html.indexOf('\n/* LIVE DRAFT AND ACTIVE SESSION STORE */',start);
assert.ok(start>=0&&end>start,'The backup reminder must be available.');
const helpers=['function verifiedRecoveryEntries(','function lastBackupTime('].map(head=>{const at=html.indexOf(head);assert.ok(at>=0,head);return html.slice(at,html.indexOf('\n',at));}).join('\n');
const DAY=24*60*60*1000,now=Date.parse('2026-10-06T08:00:00.000Z'),iso=ms=>new Date(ms).toISOString();
// backups is the one record of past backups (verifiedRecoveryBackups v3): the
// last portable file (saved and read back, or downloaded) and each location's copy.
function reminder({file=null,providers={},lastLocalSaveAt=null,device=false,drive=false,savedDays=0}){
  const notified=[],backups=Object.freeze({version:3,file,providers});
  const run=new Function('appCanMutate','readStorageHealth','readVerifiedRecoveryState','BackupProviderRuntime','AppData','refreshStorageFallbackWarning','todayISO','notifyUser','Date',
    `let backupNudgeCheckedAt=0,backupNudgeMessage='',backupNudgeNotifiedDate='';const BACKUP_NUDGE_CHECK_MS=3600000,BACKUP_NUDGE_MS=7*24*60*60*1000;let verifiedRecoveryState=null;${helpers}\n${html.slice(start,end)};return maybePromptBackupNudge(true).then(()=>backupNudgeMessage);`);
  const FixedDate=class extends Date{static now(){return now;}};
  // Device Folder and Drive are both engine locations: either one able to back
  // up on its own makes automaticActive() true.
  return run(()=>true,()=>({lastLocalSaveAt}),async()=>backups,{automaticActive:()=>device||drive},
    {dailyRecords:{summaries:async()=>Array.from({length:savedDays},(_,i)=>({date:i}))}},()=>{},()=>'2026-10-06',(...args)=>notified.push(args),FixedDate).then(message=>({message,notified}));
}
const copy=(at,sourceRevision=at)=>Object.freeze({at,sourceRevision,format:1});
const cases=[];
{
  const r=await reminder({file:copy(iso(now-10*DAY)),lastLocalSaveAt:iso(now-2*DAY)});
  assert.match(r.message,/over a week old/u);assert.equal(r.notified.length,1);cases.push('changes a week past the last backup: reminded');
  const next=await reminder({file:copy(iso(now-10*DAY)),lastLocalSaveAt:iso(now-2*DAY)});
  assert.equal(next.notified.length,1);cases.push('still due at the next launch: reminded again');
}
{
  const r=await reminder({file:copy(iso(now-10*DAY)),lastLocalSaveAt:iso(now-10*DAY)});
  assert.equal(r.message,'');assert.equal(r.notified.length,0);cases.push('an old backup that holds the latest changes: no reminder');
}
for(const [label,options] of [['Device Folder',{device:true}],['Drive while signed in',{drive:true}]]){
  const r=await reminder({file:copy(iso(now-10*DAY)),lastLocalSaveAt:iso(now-1000),...options});
  assert.equal(r.message,'');assert.equal(r.notified.length,0);cases.push(`automatic ${label}: no reminder`);
  const fresh=await reminder({savedDays:9,...options});assert.equal(fresh.message,'',`automatic ${label} covers a device that never made a backup file`);
}
{
  const r=await reminder({file:copy(iso(now-3*DAY)),lastLocalSaveAt:iso(now-1000)});
  assert.equal(r.message,'');cases.push('a recent backup: no reminder');
}
{
  // A Drive backup counts even after the sign-in has lapsed, and so does a
  // Device Folder backup made before the folder was turned off.
  for(const id of ['google-drive','device-folder']){
    const recent=await reminder({file:copy(iso(now-20*DAY)),providers:{[id]:copy(iso(now-3*DAY))},lastLocalSaveAt:iso(now-1000)});
    assert.equal(recent.message,'',`a recent ${id} backup must count`);
    const old=await reminder({providers:{[id]:copy(iso(now-8*DAY))},lastLocalSaveAt:iso(now-1000),savedDays:9});
    assert.match(old.message,/over a week old/u);assert.equal(old.notified.length,1);
  }
  cases.push('a Drive or Device Folder backup counts: reminded only a week after it');
}
{
  // A download cannot be read back, but the person did back up, and it holds
  // the changes made before it.
  const download=at=>Object.freeze({...copy(at),verified:false});
  const recent=await reminder({file:download(iso(now-2*DAY)),lastLocalSaveAt:iso(now-1000),savedDays:9});
  assert.equal(recent.message,'');
  const old=await reminder({file:download(iso(now-8*DAY)),lastLocalSaveAt:iso(now-1000),savedDays:9});
  assert.match(old.message,/over a week old/u);
  const unchanged=await reminder({file:download(iso(now-8*DAY)),lastLocalSaveAt:iso(now-9*DAY),savedDays:9});
  assert.equal(unchanged.message,'','a download that holds the latest changes needs no reminder');
  cases.push('a download counts: reminded only a week after it');
}
{
  assert.match((await reminder({savedDays:7})).message,/over a week old/u);assert.equal((await reminder({savedDays:3})).message,'');
  cases.push('never backed up: reminded once a week of days is saved');
}
console.log(JSON.stringify({status:'PASS',suite:'backup-reminder',cases},null,2));
