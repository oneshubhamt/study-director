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
    canMutate:()=>true,captureOrigin:()=>()=>{},now:()=>now,automaticActive:()=>device||drive,dailySummaryCount:async()=>savedDays,todayIso:()=> '2026-10-06',
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
// Exercise the actual owner across each deferred boundary, not a copied rule.
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const empty=freeze({version:3,file:null,providers:freeze({})});
function raceFixture({read=async()=>empty,count=async()=>7}={}){
  let lease=1,owner=true,automatic=false;
  const published=[],notified=[];
  const nudge=Readiness.createBackupNudge(freeze({
    verified:freeze({read,entries:state=>[state.file,...Object.values(state.providers)].filter(Boolean),lastBackupTime:state=>state.file?Date.parse(state.file.at):-Infinity}),
    storageHealth:freeze({snapshot:()=>({lastLocalSaveAt:iso(now-1000)})}),dueMs:7*DAY,checkMs:60*60*1000,
    canMutate:()=>owner,captureOrigin:()=>{const origin=lease;return ()=>{if(origin!==lease||!owner)throw Error('retired');};},
    now:()=>now,automaticActive:()=>automatic,dailySummaryCount:count,todayIso:()=> '2026-10-06',
    publishMessage:value=>published.push(value),notify:(...args)=>notified.push(args),capture:()=>{}
  }));
  return {nudge,published,notified,retire:()=>{owner=false;lease++;owner=true;},activateAutomatic:()=>{automatic=true;}};
}
{
  const receipt=deferred(),f=raceFixture({read:()=>receipt.promise});
  const pending=f.nudge.run(true);f.nudge.reset();receipt.resolve(empty);
  assert.equal(await pending,false);assert.deepEqual(f.published,['']);assert.equal(f.notified.length,0);assert.equal(f.nudge.message(),'');
  cases.push('reset retires deferred receipt check');
}
{
  const count=deferred(),entered=deferred(),f=raceFixture({count:()=>{entered.resolve();return count.promise;}});
  const pending=f.nudge.run(true);await entered.promise;f.retire();count.resolve(7);
  assert.equal(await pending,false);assert.deepEqual(f.published,[]);assert.equal(f.notified.length,0);
  assert.equal(await f.nudge.run(true),true);assert.equal(f.notified.length,1);
  cases.push('ownership loss and reacquisition retire deferred day count; fresh check works');
}
{
  const receipt=deferred();let reads=0;
  const f=raceFixture({read:()=>++reads===1?receipt.promise:Promise.resolve(freeze({...empty,file:copy(iso(now-1000))}))});
  const pending=f.nudge.run(true);assert.equal(await f.nudge.run(true),false);receipt.resolve(empty);
  assert.equal(await pending,false);assert.deepEqual(f.published,['']);assert.equal(f.notified.length,0);
  cases.push('newer forced check supersedes deferred check');
}
{
  const count=deferred(),entered=deferred(),f=raceFixture({count:()=>{entered.resolve();return count.promise;}});
  const pending=f.nudge.run(true);await entered.promise;f.activateAutomatic();count.resolve(7);
  assert.equal(await pending,false);assert.deepEqual(f.published,['']);assert.equal(f.notified.length,0);
  cases.push('automatic backup becoming available during deferred count suppresses reminder');
}
// A verified remote checkpoint can outlive the operation that observed it.
// Its queued local freshness receipt must retain the original owner's fence.
{
  let durable=empty,owner=1,writes=0,refreshes=0,delayRead=null,delayWrite=null,enteredRead=null,enteredWrite=null;
  const verified=Readiness.createVerifiedRecovery(freeze({
    metadata:freeze({read:async()=>{enteredRead?.resolve();if(delayRead)await delayRead.promise;return durable;},
      write:async(value,assertOrigin)=>{enteredWrite?.resolve();if(delayWrite)await delayWrite.promise;assertOrigin?.();durable=value;writes++;}}),
    storageHealth:freeze({snapshot:()=>({}),updateHistory:()=>{}}),mutationEpoch:freeze({latestChangeAt:async value=>value}),
    backupVersion:24,sourceRevision:()=>'',refreshProviders:()=>{refreshes++;},capture:()=>{},nowIso:()=>iso(now)
  }));
  const origin=()=>{const revision=owner;return ()=>{if(owner!==revision)throw Error('receipt origin retired');};};
  const receipt=sourceRevision=>({source:'google-drive',sourceRevision});
  delayRead=deferred();enteredRead=deferred();
  const readPending=verified.record(receipt(iso(now-1000)),origin());await enteredRead.promise;owner++;delayRead.resolve();
  await assert.rejects(readPending,/receipt origin retired/u);delayRead=null;enteredRead=null;
  assert.equal(writes,0);assert.equal(refreshes,0);assert.equal(verified.verified('google-drive'),null);
  delayWrite=deferred();enteredWrite=deferred();
  const writePending=verified.record(receipt(iso(now-500)),origin());await enteredWrite.promise;owner++;delayWrite.resolve();
  await assert.rejects(writePending,/receipt origin retired/u);delayWrite=null;enteredWrite=null;
  assert.equal(writes,0);assert.equal(refreshes,0);assert.equal(durable,empty);
  assert.equal(await verified.record(receipt(iso(now)),origin()),true);
  assert.equal(writes,1);assert.equal(refreshes,1);assert.equal(verified.verified('google-drive').sourceRevision,iso(now));
  cases.push('retired verified recovery receipt cannot replace stored or projected freshness; fresh authority succeeds');
}
console.log(JSON.stringify({status:'PASS',suite:'backup-reminder',productionOwner:'backup-readiness-host',cases},null,2));
