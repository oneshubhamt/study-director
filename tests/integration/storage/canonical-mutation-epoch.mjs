import assert from 'node:assert/strict';
import {createHarness} from '../../helpers/repository-harness.mjs';
import {createFakeClock} from '../../helpers/fake-clock.mjs';
import {noteId} from '../../helpers/note-ids.mjs';

const clock=createFakeClock('2026-09-22T04:45:00.000Z');
const commits=[],controls={clock,onCanonicalCommit:event=>commits.push(event)};
const h=createHarness(new Map(),null,controls);
const {app,stores}=h;
const tokenPattern=/^[a-f0-9]{32}$/u;
const epoch=async()=>app.mutationEpoch.read();
const token=async()=>String((await epoch())?.token||'');
const preparationToken=async unit=>String((await app.preparationUnits.list()).find(row=>row.unit===unit)?.token||'');

assert.equal(await epoch(),null,'The coordination epoch is optional before verified startup reseeds it.');
const seeded=await app.mutationEpoch.reseed();
assert.match(seeded.token,tokenPattern);
assert.equal((await epoch()).token,seeded.token);
const reseeded=await app.mutationEpoch.reseed();
assert.notEqual(reseeded.token,seeded.token,'Startup/restart reseeding must invalidate captures created against an earlier process baseline.');

// Two independent repository contexts share IndexedDB state in production. A
// canonical write from either context must therefore invalidate a fence read by
// the other without relying on a process-local counter or wall-clock ordering.
const peer=createHarness(new Map(),stores,{clock});
assert.equal((await peer.app.mutationEpoch.read()).token,reseeded.token,'A second context must observe the current durable epoch.');
await app.planData.writeDraft('cross-context mutation');
const peerObserved=await peer.app.mutationEpoch.read();
assert.notEqual(peerObserved.token,reseeded.token,'A canonical write in one context must be visible to another context through the durable epoch.');
assert.match(String((await peer.app.preparationUnits.list()).find(row=>row.unit==='personalData')?.token||''),tokenPattern,'A peer context must observe the same precise preparation-unit invalidation as the canonical epoch.');

// Recovery journals are operational safety state, not portable logical data.
// They must never invalidate the canonical backup fence by themselves.
const operationalBefore=peerObserved.token;
const restoreId='restore_epoch-operational-0001';
await app.restoreJournal.prepare(Object.freeze({id:restoreId,blob:new Blob(['epoch rollback']),filename:'epoch.sdbackup',scheduleText:''}));
await app.restoreJournal.mark(restoreId,'committing');
await app.restoreJournal.clear(restoreId);
assert.equal((await app.mutationEpoch.read()).token,operationalBefore,'Restore-journal bookkeeping must not advance the canonical mutation epoch.');

// The preparation-stamp set is disposable derived metadata. Rebuilding it must
// not itself make canonical data look changed, and malformed unit identities
// must be rejected rather than silently entering the incremental planner.
const rebuildEpoch=await token();
const rebuiltStamps=await app.preparationUnits.replace(['dailyRecordPack:2026-09','personalData']);
assert.equal(await token(),rebuildEpoch,'Rebuilding disposable preparation metadata must not advance the canonical mutation epoch.');
assert.equal([...rebuiltStamps].map(row=>row.unit).sort().join('|'),'dailyRecordPack:2026-09|personalData');
await assert.rejects(()=>app.preparationUnits.replace(['unknown-unit']),/preparation unit identity is invalid/i);
assert.equal(await token(),rebuildEpoch,'Rejected performance-metadata rebuilds must remain canonically inert.');

async function assertAdvances(label,operation,unit=null){
  const before=await token(),unitBefore=unit?await preparationToken(unit):'';
  await operation();
  const after=await token();
  assert.match(after,tokenPattern,`${label} must leave a canonical epoch token.`);
  assert.notEqual(after,before,`${label} must advance the canonical mutation epoch.`);
  if(unit){const unitAfter=await preparationToken(unit);assert.match(unitAfter,tokenPattern,`${label} must publish a precise backup-preparation stamp.`);assert.notEqual(unitAfter,unitBefore,`${label} must invalidate its logical backup unit atomically with the canonical epoch.`);}
}

await assertAdvances('Daily Record save',()=>app.dailyRecords.save({version:1,date:'2026-09-22',updatedAt:'2026-09-22T04:45:01.000Z',savedAt:'2026-09-22T04:45:01.000Z'}),'dailyRecordPack:2026-09');

await app.notes.load();
const noteChange=app.notes.update('general','General','epoch note','');
assert.equal(noteChange.status,'changed');
const generalUnit=`areaNote:${app.notes.get('general').id}`;
await assertAdvances('Note canonical flush',()=>app.notes.flush({strict:true}),generalUnit);

await assertAdvances('Review-state Active Session save',()=>app.activeSession.save({id:'active',revision:1,date:'2026-09-22',status:'active',scheduleText:'',snapshot:{elapsedMs:1,review:{reflection:'draft',studyQuality:null}},updatedAt:'2026-09-22T04:45:02.000Z'}),'activeSession');
assert.equal(commits.at(-1).entityType,'activeSession','Review persistence must invalidate the Active Session backup unit, not a separate draft family.');

await assertAdvances('Active Session save',()=>app.activeSession.save({id:'active',revision:2,date:'2026-09-22',status:'active',scheduleText:'',snapshot:{elapsedMs:2,review:{reflection:'draft',studyQuality:null}},updatedAt:'2026-09-22T04:45:03.000Z'}),'activeSession');
assert.equal(commits.at(-1).backupCapture,false,'ordinary live-session saves still schedule automatic backup');
await assertAdvances('Backup capture session save',()=>app.activeSession.save({id:'active',revision:3,date:'2026-09-22',status:'active',scheduleText:'',snapshot:{elapsedMs:3,review:{reflection:'draft',studyQuality:null}},updatedAt:'2026-09-22T04:45:04.000Z'},{backupCapture:true}),'activeSession');
assert.equal(commits.at(-1).backupCapture,true,'backup preparation saves advance canonical storage without scheduling themselves again');

await assertAdvances('Plan draft save',()=>app.planData.writeDraft('Plan epoch draft'),'personalData');
await assertAdvances('Plan library save',()=>app.planData.writeLibrary({savedPlans:[],defaultId:null}),'personalData');
await assertAdvances('Portable preference save',()=>app.personalPreferences.write({studentName:'Epoch',theme:'glass',presentation:null,quote:null,practiceCueMode:null,fontScale:null,practiceTargetMs:null,nudge:null}),'personalData');

// Every canonical family that backup settlement may flush must preserve the
// backupCapture marker while still advancing the durable canonical fence.
await assertAdvances('Backup-capture Plan draft save',()=>app.planData.writeDraft('Plan epoch draft captured',{backupCapture:true}),'personalData');
assert.equal(commits.at(-1).entityType,'planData');assert.equal(commits.at(-1).backupCapture,true);
const backupNoteBase=app.notes.get('general');const backupNoteChange=app.notes.update('general','General','epoch note captured',backupNoteBase.updatedAt);assert.equal(backupNoteChange.status,'changed');
await assertAdvances('Backup-capture note flush',()=>app.notes.flush({strict:true,backupCapture:true}),generalUnit);
assert.equal(commits.at(-1).entityType,'areaNote');assert.equal(commits.at(-1).backupCapture,true);
await assertAdvances('Backup-capture Daily Record save',()=>app.dailyRecords.save({version:1,date:'2026-09-22',reflection:'captured diary',updatedAt:'2026-09-22T04:45:06.000Z',savedAt:'2026-09-22T04:45:01.000Z'},{backupCapture:true}),'dailyRecordPack:2026-09');
assert.equal(commits.at(-1).entityType,'dailyRecord');assert.equal(commits.at(-1).backupCapture,true);
await assertAdvances('Backup-capture Portable preference save',()=>app.personalPreferences.write({studentName:'Epoch Capture',theme:'glass',presentation:null,quote:null,practiceCueMode:null,fontScale:null,practiceTargetMs:null,nudge:null},{backupCapture:true}),'personalData');
assert.equal(commits.at(-1).entityType,'planData');assert.equal(commits.at(-1).backupCapture,true);

await assertAdvances('Saved-Day deletion ledger replacement',()=>app.deletionRecovery.replaceSavedDays([{date:'2026-09-21',deletedAt:'2026-09-22T04:45:04.000Z'}]));
await assertAdvances('Note deletion ledger replacement',()=>app.deletionRecovery.replaceAreaNotes([{key:noteId('old-note'),deletedAt:'2026-09-22T04:45:05.000Z'}]));
const assetId='att-aaaaaaaaaaaaaaaaaaaa';
await assertAdvances('Attachment deletion ledger write',()=>app.deletionRecovery.recordAttachment(assetId,'2026-09-22T04:45:06.000Z'));
await assertAdvances('Attachment deletion ledger clear',()=>app.deletionRecovery.clearAttachment(assetId));

await assertAdvances('Daily Record deletion',()=>app.dailyRecords.remove('2026-09-22'),'dailyRecordPack:2026-09');
await assertAdvances('Active Session final clear',()=>app.activeSession.clear(),'activeSession');

assert.equal(app.mutationEpoch.eligible(),true,'Healthy canonical storage must be eligible for the O(1) fence.');

// One change clock: the epoch each save writes inside its transaction and the
// commit notice after it only move forward, even when the system clock goes
// back, so "has anything changed since the last backup?" stays right. After a
// reload the clock is seeded from what was saved and keeps moving forward.
{
  let now=Date.parse('2026-09-22T05:00:00.000Z');
  class BackDate extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  const notices=[],backClock=Object.freeze({Date:BackDate,setTimeout,clearTimeout});
  const back=createHarness(new Map(),null,{clock:backClock,onCanonicalCommit:event=>notices.push(event.committedAt)});
  await back.app.mutationEpoch.reseed();
  await back.app.planData.writeDraft('before the clock goes back');const first=(await back.app.mutationEpoch.read()).committedAt;
  now-=3600000;
  await back.app.planData.writeDraft('after the clock goes back');const second=(await back.app.mutationEpoch.read()).committedAt;
  assert.ok(second>first,'a later save keeps a later change time when the system clock goes back');
  assert.ok(notices.at(-1)>notices.at(-2)&&notices.at(-1)>=second,'the commit notice follows the same clock');
  const reloaded=createHarness(new Map(),back.stores,{clock:backClock});
  assert.equal(await reloaded.app.mutationEpoch.latestChangeAt('2000-01-01T00:00:00.000Z'),second,'a stale last-save copy is repaired from the change time saved with the data');
  assert.equal(await reloaded.app.mutationEpoch.latestChangeAt(notices.at(-1)),notices.at(-1),'an up-to-date copy is kept');
  await reloaded.app.mutationEpoch.reseed();
  assert.equal((await reloaded.app.mutationEpoch.read()).committedAt,second,'a startup reseed is not a data change and keeps the last change time');
  await reloaded.app.planData.writeDraft('after a reload');
  assert.ok((await reloaded.app.mutationEpoch.read()).committedAt>notices.at(-1),'after a reload the change clock continues past every earlier change');
}

// If IndexedDB cannot commit a Daily Record, the existing emergency fallback is
// allowed to preserve the record. That fallback must not fabricate an IDB epoch;
// instead it makes the fast fence ineligible so backup returns to the legacy fence.
const degradedControls={clock,failNextDailyWrite:true,dailyKeyEnumeration:true};
const degraded=createHarness(new Map(),null,degradedControls);
await degraded.app.mutationEpoch.reseed();
const degradedBefore=(await degraded.app.mutationEpoch.read()).token;
await degraded.app.dailyRecords.save({version:1,date:'2026-09-23',updatedAt:'2026-09-22T04:45:07.000Z',savedAt:'2026-09-22T04:45:07.000Z'});
assert.equal((await degraded.app.mutationEpoch.read()).token,degradedBefore,'A failed IndexedDB transaction must not advance the durable epoch.');
assert.equal((await degraded.app.preparationUnits.list()).some(row=>row.unit==='dailyRecordPack:2026-09'),false,'A failed IndexedDB transaction must not publish a preparation stamp without its canonical data.');
assert.equal(degraded.stores.daily.has('2026-09-23'),false,'The failed IndexedDB transaction must not publish a canonical Daily Record.');
assert.equal(degraded.app.mutationEpoch.eligible(),false,'Emergency fallback data must force the legacy backup fence.');
const degradedCoverage=await degraded.app.dailyRecords.backupDates();
assert.equal(degradedCoverage.canonical,false,'Unreconciled emergency fallback Saved Days must keep backup capture classified as rescue/degraded even after IndexedDB is readable again.');
assert.match(degradedCoverage.warning,/fallback records.*not yet been reconciled|rescue data/i,'Unreconciled fallback coverage must carry an explicit rescue warning.');
console.log(JSON.stringify({status:'PASS',suite:'canonical-mutation-epoch',covered:['monotonic change clock','startup reseed','cross-context visibility','operational-write exclusion','daily records','notes','review in active session','active session','plans','preferences','deletion ledgers','per-unit preparation stamps','failed transaction','backup-capture propagation'],epochFormat:(await epoch())?.format},null,2));
