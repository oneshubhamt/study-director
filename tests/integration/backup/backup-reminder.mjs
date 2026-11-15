import {readScript} from '../../../build/source-script.mts';
import assert from 'node:assert/strict';
import vm from 'node:vm';

for(const file of ['source/core/internal.ts','source/core/backup-readiness-host.ts'])vm.runInThisContext(readScript(file),{filename:file});
const Readiness=globalThis[Symbol.for('studyDirector.internalModules.v1')].require('backup-readiness-host',1);
const freeze=Object.freeze;

// The 7-day backup reminder is one rule for every kind of backup: it never
// appears while an automatic backup can run or while some backup already holds
// the latest changes, and it does appear when changes have gone a week
// without reaching any backup. Exercise the checked readiness owner directly.
const DAY=24*60*60*1000,now=Date.parse('2026-10-06T08:00:00.000Z'),iso=ms=>new Date(ms).toISOString();
async function reminder({file=null,providers={},lastLocalSaveAt=null,device=false,drive=false,savedDays=0}){
  const notified=[],backups=freeze({version:3,file,providers}),health=freeze({
    version:3,lastLocalSaveAt,lastStudyDataSaveAt:null,browserDataClearedAt:null,issues:freeze([]),hasIssues:false
  });
  const verified=Readiness.createVerifiedRecovery(freeze({
    metadata:freeze({read:async()=>backups,write:async()=>true}),
    storageHealth:freeze({snapshot:()=>health,updateHistory:()=>health}),
    mutationEpoch:freeze({latestChangeAt:async value=>value}),
    backupVersion:24,sourceRevision:()=>'',refreshProviders:()=>{},capture:()=>{},nowIso:()=>iso(now)
  }));
  const nudge=Readiness.createBackupNudge(freeze({
    verified,storageHealth:freeze({snapshot:()=>health}),dueMs:7*DAY,checkMs:60*60*1000,
    canMutate:()=>true,now:()=>now,automaticActive:()=>device||drive,dailySummaryCount:async()=>savedDays,todayIso:()=> '2026-10-06',
    publishMessage:()=>{},notify:(...args)=>notified.push(args),capture:()=>{}
  }));
  await nudge.run(true);
  return {message:nudge.message(),notified};
}
const copy=(at,sourceRevision=at)=>freeze({at,sourceRevision,format:1});
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
  assert.equal(r.message,'');assert.equal(r.notified.length,0);cases.push('automatic '+label+': no reminder');
  const fresh=await reminder({savedDays:9,...options});assert.equal(fresh.message,'','automatic '+label+' covers a device that never made a backup file');
}
{
  const r=await reminder({file:copy(iso(now-3*DAY)),lastLocalSaveAt:iso(now-1000)});
  assert.equal(r.message,'');cases.push('a recent backup: no reminder');
}
{
  for(const id of ['google-drive','device-folder']){
    const recent=await reminder({file:copy(iso(now-20*DAY)),providers:{[id]:copy(iso(now-3*DAY))},lastLocalSaveAt:iso(now-1000)});
    assert.equal(recent.message,'','a recent '+id+' backup must count');
    const old=await reminder({providers:{[id]:copy(iso(now-8*DAY))},lastLocalSaveAt:iso(now-1000),savedDays:9});
    assert.equal(old.notified.length,1);
    if(id==='google-drive'){assert.match(old.message,/have not reached Google Drive for over a week\. Sign in again in Library → Data\./u);assert.equal(old.notified[0][0],'Sign in to Google Drive');}
    else{assert.match(old.message,/over a week old\. Open Library → Data\./u);assert.equal(old.notified[0][0],'Back up Study Director');}
  }
  cases.push('a Drive or Device Folder backup counts: reminded only a week after it; Drive users are asked to sign in');
}
{
  const download=at=>freeze({...copy(at),verified:false});
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
console.log(JSON.stringify({status:'PASS',suite:'backup-reminder',productionOwner:'backup-readiness-host',cases},null,2));
