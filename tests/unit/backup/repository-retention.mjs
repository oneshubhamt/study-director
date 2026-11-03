import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {checkCases} from '../../helpers/generated-cases.mjs';

// Backup retention: which versions each location keeps, and the cleanup that
// deletes the rest. These are the production repository rules with no I/O.
for(const file of ['source/core/internal.js','source/core/managed-repository.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const freeze=Object.freeze;
const unused=()=>{throw new Error('Retention needs no repository I/O.');};
const repository=registry.require('managed-repository',1).createEngine(freeze({
  codec:freeze({countShape:value=>value,utf8Bytes:value=>new TextEncoder().encode(String(value)),compressionSupported:()=>false,assetIds:()=>[]}),
  ports:freeze({
    configuration:freeze({backupVersion:1,limits:freeze({}),logicalCaptureFormat:'qa.capture',logicalCaptureVersion:1}),
    persistence:freeze({reconciliationBaseRead:unused,reconciliationBaseWrite:unused,personalFingerprint:unused,dayFingerprints:unused,sessionFingerprint:unused}),assets:freeze({get:unused,verifyAliases:unused}),
    files:freeze({protect:unused,unprotect:unused,run:unused,scope:unused}),
    checkpoint:freeze({capture:unused,beginPreparation:unused,readPreparationUnits:unused,finalizePreparation:unused,establishPreparationBaseline:unused,assertCurrent:unused,inspectVerifiedCapture:unused,verifyVerifiedCapture:unused,currentImportSignal:unused}),
    domain:freeze({clampText:value=>String(value)}),environment:freeze({throwIfAborted:signal=>{if(signal?.aborted)throw signal.reason;},yieldTask:async()=>{}}),diagnostics:freeze({capture:()=>{}})
  })
}));

// Retention policy: each tier keeps the newest checkpoint from its most recent
// periods that have one, and slots the tiers cannot use go to the remaining
// days; deterministic selection, tier graduation, sparse and long-break
// preservation, retention after every backup, and protected publication.
const retentionCalendar=date=>{const d=new Date(date+'T12:00:00'),day=d.getDay(),monday=new Date(d);monday.setDate(d.getDate()-((day+6)%7));const key=value=>`${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;return freeze({localDate:date,weekStart:key(monday),month:date.slice(0,7),utcOffsetMinutes:-d.getTimezoneOffset()});};
const retentionRow=(id,date,time='12:00:00',role='normal',protectedUntil='',purpose='')=>freeze({id:`cp_${String(id).padStart(32,'0')}`,manifest:freeze({exportedAt:`${date}T${time}.000Z`,retention:freeze({role,protectedUntil,purpose,calendar:retentionCalendar(date)})})});
const retentionHistory=[];let retentionId=1;
for(const date of ['2026-04-14','2026-05-12','2026-06-15','2026-07-16','2026-08-02','2026-08-09','2026-08-16','2026-08-23','2026-08-30','2026-09-06','2026-09-07','2026-09-08','2026-09-09','2026-09-10','2026-09-11','2026-09-12','2026-09-13','2026-09-14','2026-09-15','2026-09-16','2026-09-17','2026-09-18','2026-09-19','2026-09-20'])retentionHistory.push(retentionRow(retentionId++,date));
const retentionNow=new Date(2026,8,20,12,0,0),tiered=repository.selectRetention(retentionHistory,{now:retentionNow}),tierValues=Object.values(tiered.tiers);
assert.equal(tiered.normalRetained,15,'fully populated managed history must retain exactly 15 normal recovery points');assert.equal(tiered.retained.length,15);assert.equal(tierValues.filter(value=>value==='latest').length,1);assert.equal(tierValues.filter(value=>value==='daily').length,6);assert.equal(tierValues.filter(value=>value==='weekly').length,4);assert.equal(tierValues.filter(value=>value==='monthly').length,4);
assert.deepEqual(tiered.retained.map(row=>row.id),repository.selectRetention(retentionHistory,{now:retentionNow}).retained.map(row=>row.id),'retention selection must be deterministic for identical history and local date');
// The anchor may be any weekday, including leap-day and year/month boundaries.
// Dense history fills each slot; order and evaluator date cannot change it.
for(const anchor of ['2024-02-29','2026-12-31',...Array.from({length:7},(_,day)=>`2026-10-${String(day+1).padStart(2,'0')}`)]){
 const anchorMs=Date.parse(anchor+'T12:00:00Z'),dense=[];
 for(let day=219;day>=0;day--){const date=new Date(anchorMs-day*86400000).toISOString().slice(0,10);dense.push(retentionRow(20000+day*2,date,'08:00:00'),retentionRow(20001+day*2,date,'11:00:00'));}
 const selection=repository.selectRetention(dense,{now:new Date(anchorMs)}),tiers=Object.values(selection.tiers),base=selection.retained.filter(row=>selection.tiers[row.id]!=='hourly');
 assert.equal(selection.normalRetained,16);assert.equal(base.length,15);assert.deepEqual(selection.retained.filter(row=>selection.tiers[row.id]==='hourly').map(row=>row.manifest.exportedAt),[anchor+'T08:00:00.000Z'],'the latest day\'s earlier backup is kept as Hourly');assert.equal(tiers.filter(tier=>tier==='latest').length,1);assert.equal(tiers.filter(tier=>tier==='daily').length,6);assert.equal(tiers.filter(tier=>tier==='weekly').length,4);assert.equal(tiers.filter(tier=>tier==='monthly').length,4);
 assert.equal(new Set(base.map(row=>row.manifest.retention.calendar.localDate)).size,15,'tiers must not overlap or retain two ordinary snapshots for a day');
 assert.ok(base.every(row=>row.manifest.exportedAt.includes('T11:00:00')),'each occupied period must use its newest available checkpoint');
 const [daily,weekly,monthly]=['daily','weekly','monthly'].map(tier=>selection.retained.filter(row=>selection.tiers[row.id]===tier).map(row=>row.manifest.retention.calendar));
 assert.ok(weekly[weekly.length-1].weekStart<daily[0].weekStart&&monthly[monthly.length-1].month<weekly[0].month,'no Weekly shares a week with a Daily and no Monthly a month with a Weekly');
 assert.ok(weekly.every((value,index)=>!index||Date.parse(value.localDate)-Date.parse(weekly[index-1].localDate)===7*86400000),'Weeklies are a week apart');
 assert.deepEqual(selection.retained.map(row=>row.id),repository.selectRetention([...dense].reverse(),{now:new Date(anchorMs+86400000*30)}).retained.map(row=>row.id));
 assert.deepEqual(selection.retained.map(row=>row.id),repository.selectRetention(selection.retained,{now:new Date(anchorMs)}).retained.map(row=>row.id),'retention must be idempotent');
}
// Scale: choosing what to keep from 1,000 versions stays well under a second.
{
 const many=[],anchorMs=Date.parse('2026-10-06T12:00:00Z');
 for(let n=0;n<1000;n++){const date=new Date(anchorMs-Math.floor(n/3)*86400000).toISOString().slice(0,10);many.push(retentionRow(60000+n,date,`${String(8+n%3).padStart(2,'0')}:00:00`));}
 const started=performance.now(),selection=repository.selectRetention(many,{now:new Date(anchorMs)}),elapsed=performance.now()-started;
 assert.equal(selection.retained.filter(row=>selection.tiers[row.id]!=='hourly').length,15);assert.equal(selection.normalRetained,17,'the latest day\'s two earlier backups are Hourly');assert.ok(elapsed<1000,`retention over 1,000 versions took ${Math.round(elapsed)} ms`);
 console.log(JSON.stringify({retentionOver1000VersionsMs:Math.round(elapsed)}));
 const expanded=Array.from({length:10000},(_,n)=>{const day=new Date(anchorMs-Math.floor(n/3)*86400000).toISOString().slice(0,10);return retentionRow(100000+n,day,`${String(8+n%3).padStart(2,'0')}:00:00`);});
 const stressStart=performance.now(),stress=repository.selectRetention(expanded,{now:new Date(anchorMs)}),stressMs=performance.now()-stressStart;
 assert.equal(stress.retained.filter(row=>stress.tiers[row.id]!=='hourly').length,15,'10,000 historical versions must retain the same 15 ordinary slots');
 assert.ok(stressMs<5000,`10,000-version retention budget exceeded: ${Math.round(stressMs)} ms`);
 console.log(JSON.stringify({retentionOver10000VersionsMs:Math.round(stressMs),candidates:expanded.length}));

}
const timezoneShiftedEvaluation=repository.selectRetention(retentionHistory,{now:new Date('2026-09-21T02:00:00-11:00')});assert.deepEqual(timezoneShiftedEvaluation.retained.map(row=>row.id),tiered.retained.map(row=>row.id),'tier windows must stay anchored to the committed Latest checkpoint capture rather than the evaluator timezone');assert.deepEqual(timezoneShiftedEvaluation.tiers,tiered.tiers,'timezone changes must not reinterpret retained tier labels for the same committed history');
const sep13=retentionHistory.find(row=>row.manifest.retention.calendar.localDate==='2026-09-13'),historyThroughSep14=retentionHistory.filter(row=>row.manifest.retention.calendar.localDate<='2026-09-14'),asDaily=repository.selectRetention(historyThroughSep14,{now:new Date(2026,8,14,12)}),asWeekly=repository.selectRetention(retentionHistory,{now:retentionNow});assert.equal(asDaily.tiers[sep13.id],'daily','a recent checkpoint must occupy the Daily tier while inside the six-day window');assert.equal(asWeekly.tiers[sep13.id],'weekly','the same immutable checkpoint must graduate into Weekly after newer committed history moves the retention window forward');
const sep16=retentionHistory.find(row=>row.manifest.retention.calendar.localDate==='2026-09-16'),sep23=retentionRow(979,'2026-09-23'),midweek=repository.selectRetention([...retentionHistory,sep23],{now:new Date(2026,8,23,12)});assert.equal(midweek.tiers[sep16.id],'daily','days without a checkpoint do not use up Daily slots: after two empty days, Daily still reaches back six checkpoint days');
const tieredDate=date=>tiered.tiers[retentionHistory.find(row=>row.manifest.retention.calendar.localDate===date).id];assert.equal(tieredDate('2026-08-23'),'weekly');assert.equal(tieredDate('2026-08-16'),undefined,'no Monthly shares a month with a Weekly: the rest of August gives way');assert.equal(tieredDate('2026-07-16'),'monthly','the first Monthly is the month before the oldest Weekly\'s');
const sparse=[retentionRow(901,'2026-06-01'),retentionRow(902,'2026-07-04'),retentionRow(903,'2026-07-30'),retentionRow(904,'2026-08-18'),retentionRow(905,'2026-09-01'),retentionRow(906,'2026-09-19')],sparseResult=repository.selectRetention(sparse,{now:retentionNow});assert.equal(sparseResult.retained.length,6,'each checkpoint of a sparse history is the newest of its own day, so all are kept');assert.equal(sparseResult.remove.length,0);assert.equal(sparseResult.tiers[sparse.at(-1).id],'latest','sparse history must still classify its newest verified checkpoint as Latest');
// A long break never empties the history: a month of daily January
// checkpoints followed by one in July keeps July plus fourteen January days.
const january=Array.from({length:31},(_,day)=>retentionRow(30000+day,`2026-01-${String(day+1).padStart(2,'0')}`)),july=retentionRow(30100,'2026-07-15'),afterBreak=repository.selectRetention([...january,july],{now:new Date(2026,6,15,12)});
const afterBreakDates=tier=>afterBreak.retained.filter(row=>afterBreak.tiers[row.id]===tier).map(row=>row.manifest.retention.calendar.localDate);
assert.equal(afterBreak.tiers[july.id],'latest');assert.deepEqual(afterBreakDates('daily'),['2026-01-26','2026-01-27','2026-01-28','2026-01-29','2026-01-30','2026-01-31']);
assert.deepEqual(afterBreakDates('weekly'),['2026-01-04','2026-01-11','2026-01-18','2026-01-25'],'one per week, the newest of each');
assert.equal(afterBreak.normalRetained,15,'no day is dropped while a slot is free');assert.deepEqual(afterBreakDates('saved'),['2026-01-01','2026-01-08','2026-01-15','2026-01-22'],'the slots Monthly cannot use close the widest gaps, so January stays evenly spread');
// Retention runs after every backup and deletes what it does not keep, as
// Device Folder and Drive do. Whatever the gaps, every day with a backup is
// kept up to 15, one backup never costs more than one version, and the
// newest is always Latest.
// notesAt(index), when given, is the notes fingerprint of each backup, so the
// Hourly rule (only where notes changed) runs on generated histories too.
const withNotes=(row,notes)=>notes?freeze({...row,manifest:freeze({...row.manifest,retention:freeze({...row.manifest.retention,notesFingerprint:notes})})}):row;
const retentionIds=rows=>rows.map(row=>row.id);
// The general rules every selection follows, whatever the history: never
// under-filled, Hourly at most 10 from the last 24 hours, kept and removed
// split the versions, a second pass keeps everything, listing order does not
// matter, and the Hourly rule holds (see the Hourly cases below).
const retentionRules=(candidates,selection,ms)=>{
  const base=selection.retained.filter(row=>selection.tiers[row.id]!=='hourly'),hourly=selection.retained.filter(row=>selection.tiers[row.id]==='hourly');
  assert.equal(base.length,Math.min(15,new Set(candidates.map(row=>row.manifest.retention.calendar.localDate)).size),'never under-filled: up to 15, one per day with a backup');
  assert.ok(hourly.length<=10&&hourly.every(row=>Date.parse(row.manifest.exportedAt)>ms-24*3600000),'Hourly keeps at most 10, all from the 24 hours before the latest');
  assert.deepEqual([...retentionIds(selection.retained),...retentionIds(selection.remove)].sort(),retentionIds(candidates).sort(),'every version is either kept or removed, never both');
  assert.deepEqual(retentionIds(repository.selectRetention(selection.retained,{now:new Date(ms)}).retained),retentionIds(selection.retained),'retention is idempotent');
  assert.deepEqual(retentionIds(repository.selectRetention([...candidates].reverse(),{now:new Date(ms)}).retained),retentionIds(selection.retained),'the order versions are listed in does not matter');
  // Hourly: each differs in local hour and notes from the next newer version
  // kept; below the limit, every removed version in the window matches the
  // next newer version kept in one of them.
  {
    const time=row=>Date.parse(row.manifest.exportedAt),hour=row=>Math.floor((time(row)+row.manifest.retention.calendar.utcOffsetMinutes*60000)/3600000),notes=row=>String(row.manifest.retention.notesFingerprint||'');
    const ordered=[...candidates].sort((x,y)=>time(x)-time(y)||x.id.localeCompare(y.id)),keptIds=new Set(retentionIds(selection.retained)),nextKept=position=>ordered.slice(position+1).find(row=>keptIds.has(row.id));
    const hourlyCount=hourly.length,windowStart=ms-24*3600000;
    ordered.forEach((row,position)=>{
      const next=nextKept(position);if(!next)return;
      const matches=hour(row)===hour(next)||!!notes(row)&&notes(row)===notes(next);
      if(selection.tiers[row.id]==='hourly')assert.ok(!matches,'an Hourly version differs from the next one kept in hour and notes');
      else if(!keptIds.has(row.id)&&hourlyCount<10&&time(row)>windowStart)assert.ok(matches,'a version in the 24 hours whose hour and notes both changed is kept while Hourly has room');
    });
  }
};
const retentionRun=(times,firstId,check=()=>{},notesAt=null)=>{let kept=[],tiers={};times.forEach((ms,index)=>{
  const at=new Date(ms).toISOString(),candidates=[...kept,withNotes(retentionRow(firstId+index,at.slice(0,10),at.slice(11,19)),notesAt?.(index))],selection=repository.selectRetention(candidates,{now:new Date(ms)});
  retentionRules(candidates,selection,ms);
  assert.ok(selection.remove.filter(row=>tiers[row.id]!=='hourly').length<=1,'one backup costs at most one version outside Hourly');assert.equal(selection.tiers[candidates.at(-1).id],'latest');
  kept=[...selection.retained];tiers=selection.tiers;check(kept,index);
});return kept;};
// Six months of backups twice a day, a three-month break, then four months
// of daily backups: the break costs one version, and the older history then
// gives way one version per new backup, Monthly keeping it longest.
const DAY=86400000,historyStart=Date.UTC(2026,0,5,9),historyResume=historyStart+(182+90)*DAY,breakTimes=[],afterResume=[];
for(let day=0;day<182;day++)breakTimes.push(historyStart+day*DAY,historyStart+day*DAY+8*3600000);
for(let day=0;day<120;day++)breakTimes.push(historyResume+day*DAY);
const beforeResume=rows=>rows.filter(row=>Date.parse(row.manifest.exportedAt)<historyResume);
const finalHistory=retentionRun(breakTimes,40000,(kept,index)=>{if(index>=364)afterResume.push(beforeResume(kept).length);});
assert.equal(afterResume[0],14,'the first backup after a three-month break replaces one version, never the history');
assert.ok(afterResume.every((count,index)=>index===0||count===afterResume[index-1]||count===afterResume[index-1]-1),'older versions give way one at a time');
assert.deepEqual(beforeResume(finalHistory).map(row=>row.manifest.retention.calendar.localDate),['2026-07-05'],'four months on, the last day before the break is still kept as Monthly');
// Generated schedules mixing busy study days, hours, days, weeks, months and
// half-year breaks, with notes that change at some backups and not at others.
const retentionCases=await checkCases('retention rules',{seed:20261005,count:40},({random,int,chance},schedule)=>{
  const spans=[()=>int(20,90)*60000,()=>random()*2*3600000,()=>DAY,()=>DAY*int(2,13),()=>DAY*int(20,59),()=>DAY*int(60,179)],weights=spans.map(()=>random()),total=weights.reduce((sum,value)=>sum+value,0),times=[],fingerprints=[];
  let at=Date.UTC(2025,0,1)+int(0,364)*DAY,notes='a';
  // Gaps come in runs of one kind, so a busy day holds many backups.
  for(let index=0,count=int(40,159),span=0,run=0;index<count;index++,run--){if(run<=0){let pick=random()*total;span=0;while(pick>weights[span]){pick-=weights[span];span+=1;}run=int(1,15);}at+=Math.max(60000,Math.round(spans[span]()));times.push(at);if(chance(0.75))notes=String.fromCharCode(97+int(0,5));fingerprints.push(notes.repeat(64));}
  retentionRun(times,50000+schedule*1000,()=>{},index=>fingerprints[index]);
  // A whole history read at once, as a location's first cleanup does, cut at a few points.
  const rows=times.map((ms,index)=>{const at=new Date(ms).toISOString();return withNotes(retentionRow(150000+schedule*1000+index,at.slice(0,10),at.slice(11,19)),fingerprints[index]);});
  for(let cut=0;cut<4;cut++){const end=int(1,rows.length),candidates=rows.slice(0,end),ms=times[end-1],selection=repository.selectRetention(candidates,{now:new Date(ms)});retentionRules(candidates,selection,ms);assert.equal(selection.tiers[candidates.at(-1).id],'latest');}
});
const sameDayUnderLimit=[retentionRow(920,'2026-09-20','09:00:00'),retentionRow(921,'2026-09-20','13:00:00'),retentionRow(922,'2026-09-20','18:00:00')],sameDaySelection=repository.selectRetention(sameDayUnderLimit,{now:retentionNow});assert.deepEqual(sameDaySelection.retained.map(row=>sameDaySelection.tiers[row.id]),['hourly','hourly','latest'],'earlier backups of the latest day are kept as Hourly');assert.equal(sameDaySelection.remove.length,0);
{
  // Hourly: walking back from the latest over the 24 hours before it, the
  // newest backup of each earlier local hour whose notes differ from the
  // version kept after it, up to 10 more. Local hours follow the offset
  // captured with each backup, and the window follows the latest backup, not
  // the clock, so every device selects alike. Rows without a notes
  // fingerprint (older versions) count as changed.
  const localRow=(id,iso,offset=0,notes='')=>{const local=new Date(Date.parse(iso)+offset*60000).toISOString().slice(0,10);return freeze({id:`cp_${String(id).padStart(32,'0')}`,manifest:freeze({exportedAt:iso,retention:freeze({role:'normal',protectedUntil:'',purpose:'',calendar:freeze({...retentionCalendar(local),utcOffsetMinutes:offset}),notesFingerprint:notes})})});};
  const hourlyOf=selection=>selection.retained.filter(row=>selection.tiers[row.id]==='hourly').map(row=>row.manifest.exportedAt);
  // Every 20 minutes for ten hours: one per hour, the newest of each.
  const working=Array.from({length:30},(_,index)=>localRow(70000+index,new Date(Date.UTC(2026,9,10,8,0)+index*20*60000).toISOString()));
  const workday=repository.selectRetention(working,{now:new Date(Date.UTC(2026,9,10,18))});
  assert.equal(workday.tiers[working.at(-1).id],'latest');assert.deepEqual(hourlyOf(workday),['08:40','09:40','10:40','11:40','12:40','13:40','14:40','15:40','16:40'].map(time=>`2026-10-10T${time}:00.000Z`),'each earlier hour keeps its newest backup');
  assert.deepEqual(repository.selectRetention(working,{now:new Date(Date.UTC(2027,0,1))}).retained.map(row=>row.id),workday.retained.map(row=>row.id),'the clock does not move the window');
  // A half-hour offset: 10:20 and 10:40 UTC are 15:50 and 16:10 in India, two local hours.
  const india=[localRow(71000,'2026-10-10T10:20:00.000Z',330),localRow(71001,'2026-10-10T10:40:00.000Z',330),localRow(71002,'2026-10-10T12:00:00.000Z',330)];
  assert.deepEqual(hourlyOf(repository.selectRetention(india,{now:new Date(Date.UTC(2026,9,10,13))})),['2026-10-10T10:20:00.000Z','2026-10-10T10:40:00.000Z']);
  assert.deepEqual(hourlyOf(repository.selectRetention(india.map((row,index)=>localRow(71100+index,row.manifest.exportedAt)),{now:new Date(Date.UTC(2026,9,10,13))})),['2026-10-10T10:40:00.000Z'],'in UTC both fall in the same hour');
  // The window: exactly 24 hours before the latest is outside, a minute later inside.
  const edge=[localRow(72000,'2026-10-09T11:00:00.000Z'),localRow(72001,'2026-10-09T12:00:00.000Z'),localRow(72002,'2026-10-09T12:01:00.000Z'),localRow(72003,'2026-10-10T12:00:00.000Z')],edgeSelection=repository.selectRetention(edge,{now:new Date(Date.UTC(2026,9,10,12))});
  assert.equal(edgeSelection.tiers[edge[2].id],'daily','the newest of the day before is Daily, not Hourly');assert.equal(edgeSelection.tiers[edge[1].id],undefined,'exactly 24 hours before the latest is outside the window');assert.equal(edgeSelection.tiers[edge[0].id],undefined);
  // Twenty hours with a backup: the newest 10 hours are kept.
  const busy=Array.from({length:21},(_,index)=>localRow(73000+index,new Date(Date.UTC(2026,9,10,2,30)+index*3600000).toISOString())),busySelection=repository.selectRetention(busy,{now:new Date(Date.UTC(2026,9,10,23))});
  assert.deepEqual(hourlyOf(busySelection),busy.slice(10,20).map(row=>row.manifest.exportedAt),'up to 10 more, the newest hours first');
  // Only versions whose notes changed: a, a, b, b, b, then the latest c keeps
  // 12:00 (b) and 09:00 (a), the newest of each notes state.
  const fingerprint=letter=>letter.repeat(64),changes=['a','a','b','b','b','c'].map((letter,index)=>localRow(74000+index,`2026-10-10T${String(8+index).padStart(2,'0')}:00:00.000Z`,0,fingerprint(letter)));
  assert.deepEqual(hourlyOf(repository.selectRetention(changes,{now:new Date(Date.UTC(2026,9,10,14))})),['2026-10-10T09:00:00.000Z','2026-10-10T12:00:00.000Z'],'a version whose notes match the one kept after it is not kept');
  // Notes that never change keep no Hourly version.
  assert.deepEqual(hourlyOf(repository.selectRetention(changes.map((row,index)=>localRow(74100+index,row.manifest.exportedAt,0,fingerprint('d'))),{now:new Date(Date.UTC(2026,9,10,14))})),[]);
  assert.deepEqual(repository.selectRetention(busySelection.retained,{now:new Date(Date.UTC(2026,9,10,23))}).retained.map(row=>row.id),busySelection.retained.map(row=>row.id),'Hourly is idempotent');
}
const protectedRow=retentionRow(950,'2026-09-20','13:00:00','before-restore','2026-09-27T13:00:00.000Z','before-clear-library'),withProtected=repository.selectRetention([...retentionHistory,protectedRow],{now:retentionNow});assert.equal(withProtected.normalRetained,15);assert.equal(withProtected.retained.length,16,'one active protected safety checkpoint must live outside the 15 normal slots');assert.equal(withProtected.activeProtected.id,protectedRow.id);assert.equal(withProtected.activeProtected.manifest.retention.purpose,'before-clear-library');assert.equal(withProtected.tiers[protectedRow.id],'before-restore');
const newerProtected=retentionRow(951,'2026-09-20','14:00:00','before-restore','2026-09-27T14:00:00.000Z','before-combine'),twoProtected=repository.selectRetention([...retentionHistory,protectedRow,newerProtected],{now:retentionNow});assert.equal(twoProtected.activeProtected.id,newerProtected.id,'only the newest unexpired protected safety point may occupy the shared slot');assert.equal(twoProtected.retained.length,16,'managed repository must retain 15 normal + exactly one protected point when history is populated');assert.ok(twoProtected.remove.some(row=>row.id===protectedRow.id),'the superseded protected safety point must be removable rather than consuming a normal retention tier');
// Each device keeps its own safety version: a restore on another device does
// not push this one's out. Each device still keeps only its newest.
{
  const onDevice=(row,installationId)=>freeze({...row,manifest:freeze({...row.manifest,installationId})});
  const mine=onDevice(protectedRow,'inst_laptop'),theirs=onDevice(newerProtected,'inst_phone'),theirsNewer=onDevice(retentionRow(952,'2026-09-20','15:00:00','before-restore','2026-09-27T15:00:00.000Z','before-restore'),'inst_phone');
  const perDevice=repository.selectRetention([...retentionHistory,mine,theirs,theirsNewer],{now:retentionNow});
  assert.deepEqual(perDevice.retained.filter(row=>perDevice.tiers[row.id]==='before-restore').map(row=>row.id).sort(),[mine.id,theirsNewer.id].sort(),'one safety version per device');
  assert.equal(perDevice.normalRetained,15,'safety versions sit outside the 15');assert.ok(perDevice.remove.some(row=>row.id===theirs.id),'a device’s older safety version goes');
  assert.equal(perDevice.activeProtected.id,theirsNewer.id,'the newest is still reported');
  assert.equal(repository.activeProtected([mine,theirs,theirsNewer],retentionNow,'inst_laptop').id,mine.id,'and each device’s own can be asked for');
}
const expiredProtected=repository.selectRetention([...retentionHistory,protectedRow],{now:new Date(2026,8,28,12)});assert.equal(expiredProtected.activeProtected,null,'expired safety protection must no longer occupy the protected slot');assert.ok(expiredProtected.remove.some(row=>row.id===protectedRow.id),'expired protected safety checkpoints must be removable, not silently reclassified as normal history');assert.ok(expiredProtected.retained.length<=15);
const gcRows=retentionHistory.map((row,index)=>freeze({...row,manifest:freeze({...row.manifest,objects:freeze([{objectId:'obj_'+String(index+1).padStart(32,'0')}])})})),gcSelection=repository.selectRetention(gcRows,{now:retentionNow}),failedGcRow=gcSelection.remove[0];let objectListCalls=0;const retentionFailure=await repository.cleanup({checkpoints:gcRows,now:retentionNow,invalidCount:0,ignoredCount:0,deleteCheckpoint:async row=>{if(row.id===failedGcRow.id)throw new Error('simulated checkpoint delete failure');return true;},listObjects:async()=>{objectListCalls+=1;return {items:[]};},deleteObject:async()=>true});assert.equal(retentionFailure.gcSkipped,true,'shared-object GC must fail closed when any checkpoint deletion is unconfirmed');assert.equal(objectListCalls,0,'GC must not even enumerate objects after an unconfirmed checkpoint deletion');assert.ok(retentionFailure.retained.some(row=>row.id===failedGcRow.id),'a checkpoint whose deletion failed must remain in the effective retained reachability set');
const overflowCleanup=await repository.cleanup({checkpoints:gcRows,now:retentionNow,overflow:true,invalidCount:0,ignoredCount:0,deleteCheckpoint:async()=>{throw new Error('overflow cleanup must not delete checkpoints');},listObjects:async()=>{throw new Error('overflow cleanup must not enumerate objects');},deleteObject:async()=>{throw new Error('overflow cleanup must not delete objects');}});assert.equal(overflowCleanup.gcSkipped,true,'repository-list overflow must fail closed');assert.equal(overflowCleanup.gcPending,true,'repository-list overflow must remain pending so background maintenance is not silently retired');assert.equal(overflowCleanup.overflow,true,'cleanup result must preserve the overflow cause for scheduler diagnostics and backoff classification');
// Safety and liveness over the assembled reclamation engine: all seven
// combinations of unknown history preserve every file; recovered finite work
// finishes within a bound derived from the two deletion allowances.
for(const invalidCount of [0,1])for(const ignoredCount of [0,1])for(const overflow of [false,true]){
 if(!invalidCount&&!ignoredCount&&!overflow)continue;
 const checkpoints=new Map(gcRows.map(row=>[row.id,row])),objects=new Set(gcRows.flatMap(row=>row.manifest.objects.map(item=>item.objectId))),artifacts=new Set(['abandoned-manifest','orphan-commit']);
 const incomplete=[freeze({kind:'checkpoint',ref:'abandoned-manifest'}),freeze({kind:'commit',ref:'orphan-commit'})];let mutations=0,listings=0,begun=0;
 const cleanupInput=()=>({checkpoints:[...checkpoints.values()],now:retentionNow,inventoryBeforeDelete:true,maxCheckpointDeletes:2,maxObjectDeletes:3,
  incompleteArtifacts:incomplete.filter(row=>artifacts.has(row.ref)),beginDeletion:()=>{begun++;},
  deleteIncompleteArtifact:async row=>{mutations++;artifacts.delete(row.ref);return true;},
  deleteCheckpoint:async row=>{mutations++;checkpoints.delete(row.id);return true;},
  listObjects:async()=>{listings++;return {items:[...objects].map(id=>({id}))};},deleteObject:async row=>{mutations++;objects.delete(row.id);return true;}
 });
 const initial=[...checkpoints.keys()],initialObjects=[...objects];
 const blocked=await repository.cleanup({...cleanupInput(),invalidCount,ignoredCount,overflow});
 assert.equal(mutations,0);assert.equal(listings,0);assert.equal(begun,0);assert.equal(blocked.gcPending,true);assert.equal(blocked.selection,null);
 assert.deepEqual([...checkpoints.keys()],initial);assert.deepEqual([...objects],initialObjects);assert.equal(artifacts.size,2);
 const limit=Math.ceil((gcSelection.remove.length+incomplete.length)/2)+Math.ceil(objects.size/3)+2;let finished=false;
 for(let pass=0;pass<limit;pass++){
  const before=mutations,remainingObjects=objects.size,result=await repository.cleanup({...cleanupInput(),invalidCount:0,ignoredCount:0,overflow:false});
  assert.ok(result.removedCheckpoints+result.removedUncommitted+result.removedOrphanCommits<=2);
  assert.ok(remainingObjects-objects.size<=3);assert.ok(mutations-before<=5);
  for(const row of checkpoints.values())for(const entry of row.manifest.objects)assert.ok(objects.has(entry.objectId),'all surviving versions remain reachable after every partial pass');
  if(!result.gcPending){finished=true;break;}
 }
 assert.equal(finished,true,'healthy finite cleanup must finish within its derived work bound');assert.equal(artifacts.size,0);
 assert.deepEqual([...checkpoints.keys()].sort(),gcSelection.retained.map(row=>row.id).sort());
 assert.deepEqual([...objects].sort(),gcSelection.retained.flatMap(row=>row.manifest.objects.map(entry=>entry.objectId)).sort());
}
// A version this build cannot read is known, not uncertain: retention still
// removes the readable versions it drops and unfinished leftovers go, but no
// shared object is removed, and nothing is retried on a timer for it.
{
 const checkpoints=new Map(gcRows.map(row=>[row.id,row])),objects=new Set(gcRows.flatMap(row=>row.manifest.objects.map(item=>item.objectId))),artifacts=new Set(['abandoned-manifest']);let listings=0;
 const result=await repository.cleanup({checkpoints:[...checkpoints.values()],now:retentionNow,invalidCount:0,ignoredCount:0,unreadableCount:1,incompleteArtifacts:[freeze({kind:'checkpoint',ref:'abandoned-manifest'})],
  deleteIncompleteArtifact:async row=>{artifacts.delete(row.ref);return true;},deleteCheckpoint:async row=>{checkpoints.delete(row.id);return true;},
  listObjects:async()=>{listings++;return {items:[...objects].map(id=>({id}))};},deleteObject:async row=>{objects.delete(row.id);return true;}});
 assert.deepEqual([...checkpoints.keys()].sort(),gcSelection.retained.map(row=>row.id).sort(),'retention still applies to readable versions');assert.equal(artifacts.size,0,'unfinished leftovers are still removed');
 assert.equal(listings,0);assert.equal(objects.size,new Set(gcRows.flatMap(row=>row.manifest.objects.map(item=>item.objectId))).size,'no shared object is removed');
 assert.equal(result.gcSkipped,true);assert.equal(result.gcPending,false,'nothing is retried on a timer');assert.equal(result.formats.unreadable,1);assert.match(result.warning,/could not be read by this app/u);
}
const protectedGcObject='obj_'+'f'.repeat(32),orphanGcObject='obj_'+'e'.repeat(32),protectedGcRow=freeze({...protectedRow,manifest:freeze({...protectedRow.manifest,objects:freeze([{objectId:protectedGcObject}])})}),protectedGcRows=[...gcRows,protectedGcRow],protectedGcDeletes=[];const protectedGcResult=await repository.cleanup({checkpoints:protectedGcRows,now:retentionNow,invalidCount:0,ignoredCount:0,deleteCheckpoint:async()=>true,listObjects:async()=>freeze({items:freeze([...gcRows.map(row=>freeze({id:row.manifest.objects[0].objectId})),freeze({id:protectedGcObject}),freeze({id:orphanGcObject})])}),deleteObject:async item=>(protectedGcDeletes.push(item.id),true)});assert.equal(protectedGcResult.selection.activeProtected.id,protectedGcRow.id,'The active Before restore checkpoint must remain explicitly protected during cleanup.');assert.equal(protectedGcDeletes.includes(protectedGcObject),false,'Object GC must preserve bytes referenced only by the protected Before restore checkpoint.');assert.equal(protectedGcDeletes.includes(orphanGcObject),true,'Object GC must still reclaim an actually unreachable object while a protected checkpoint exists.');
const publicationBlockedDeletes=[];let publicationBlockedLists=0;const publicationBlocked=await repository.cleanup({checkpoints:protectedGcRows,now:retentionNow,invalidCount:0,ignoredCount:0,blockObjectGc:true,deleteCheckpoint:async()=>true,listObjects:async()=>{publicationBlockedLists+=1;return freeze({items:freeze([freeze({id:orphanGcObject,createdAt:'2026-09-01T00:00:00.000Z'})])});},deleteObject:async item=>(publicationBlockedDeletes.push(item.id),true)});assert.equal(publicationBlocked.gcPending,true,'an active remote publication must keep repository maintenance pending');assert.equal(publicationBlocked.gcSkipped,true);assert.equal(publicationBlockedLists,0,'object GC must not enumerate candidates while another publication may still introduce references');assert.deepEqual(publicationBlockedDeletes,[],'object GC must not delete anything while publication protection is active');
const cleanupAbort=Object.assign(new Error('foreground pre-emption'),{name:'AbortError',code:'REPOSITORY_BACKGROUND_PREEMPTED'});await assert.rejects(repository.cleanup({checkpoints:protectedGcRows,now:retentionNow,invalidCount:0,ignoredCount:0,deleteCheckpoint:async()=>true,listObjects:async()=>{throw cleanupAbort;},deleteObject:async()=>true}),error=>error===cleanupAbort,'shared cleanup must propagate foreground cancellation instead of converting it into blocked repository state');
const listingFailure=await repository.cleanup({checkpoints:protectedGcRows,now:retentionNow,invalidCount:0,ignoredCount:0,deleteCheckpoint:async()=>true,listObjects:async()=>{throw new Error('object listing unavailable');},deleteObject:async()=>true});assert.equal(listingFailure.gcPending,true);assert.equal(listingFailure.objectListingFailed,true,'ordinary repository object-list failure must remain explicit for scheduler diagnostics');assert.ok(listingFailure.uncertainCount>=1,'ordinary repository object-list failure must classify as uncertainty rather than completed cleanup');
const oldGraceObject='obj_'+'d'.repeat(32),recentGraceObject='obj_'+'c'.repeat(32),graceDeletes=[];const graceResult=await repository.cleanup({checkpoints:protectedGcRows,now:retentionNow,invalidCount:0,ignoredCount:0,objectGraceBefore:'2026-09-19T00:00:00.000Z',deleteCheckpoint:async()=>true,listObjects:async()=>freeze({items:freeze([freeze({id:oldGraceObject,createdAt:'2026-09-01T00:00:00.000Z'}),freeze({id:recentGraceObject,createdAt:'2026-09-20T00:00:00.000Z'})])}),deleteObject:async item=>(graceDeletes.push(item.id),true)});assert.deepEqual(graceDeletes,[oldGraceObject],'only orphan objects older than the reclamation grace boundary may be physically deleted');assert.equal(graceResult.gcDeferred,1,'fresh orphan objects must remain for a later maintenance pass');assert.equal(graceResult.gcPending,true,'deferred fresh orphans must keep maintenance pending');

const yearBoundaryRows=[retentionRow(980,'2026-12-27'),retentionRow(981,'2026-12-28'),retentionRow(982,'2026-12-29'),retentionRow(983,'2026-12-30'),retentionRow(984,'2026-12-31'),retentionRow(985,'2027-01-01'),retentionRow(986,'2027-01-02'),retentionRow(987,'2027-01-03')],yearBoundary=repository.selectRetention(yearBoundaryRows,{now:new Date(2027,0,3,12)});assert.equal(yearBoundary.tiers[yearBoundaryRows.at(-1).id],'latest');for(const row of yearBoundaryRows.slice(1,-1))assert.equal(yearBoundary.tiers[row.id],'daily','Daily calendar selection must remain continuous across month/year boundaries.');assert.equal(yearBoundary.tiers[yearBoundaryRows[0].id],'weekly','The first day beyond the six-day Daily window must graduate into the appropriate Weekly period across a year boundary.');

console.log(JSON.stringify({status:'PASS',suite:'repository-retention',retentionCases},null,2));
