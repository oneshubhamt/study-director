import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHarness} from '../../helpers/repository-harness.mjs';
import {createFakeClock} from '../../helpers/fake-clock.mjs';

// "Study data was saved here" (lastStudyDataSaveAt) is what lets a start that
// finds the database removed show the clear notice instead of starting as
// new. It covers every kind of person-made data, not only notes and Saved
// Days, and the start-up compatibility step never sets it on a fresh install.

// Repository: plan and settings writes say whether the start-up step made them.
const clock=createFakeClock('2026-11-07T09:00:00.000Z'),commits=[];
const {app}=createHarness(new Map(),null,{clock,onCanonicalCommit:event=>commits.push(event)});
await app.planData.writeDraft('07:00 | 30 | Work | work | Ethics | block | 1');
await app.personalPreferences.write({version:2,studentName:null,theme:null,presentation:null,quote:null,practiceCueMode:null,fontScale:null,practiceTargetMs:null,nudge:null},{allowHydrating:true});
assert.deepEqual(commits.map(event=>[event.entityType,event.startup]),[['planData',false],['planData',true]],'only the start-up write is marked as such');

// App: which commits record study data.
const source=fs.readFileSync(new URL('../../../source/app.html',import.meta.url),'utf8');
const constant=source.match(/^const STUDY_DATA_COMMITS=.*;$/mu)?.[0];assert.ok(constant,'STUDY_DATA_COMMITS must exist');
const start=source.indexOf('function handleCanonicalCommit(event){'),end=source.indexOf('\n}',start);assert.ok(start>0&&end>start);
const writes=[];
const context=vm.createContext({
  writeStorageHealth:patch=>writes.push(patch),renderStorageHealth:()=>{},canonicalCommitChangesAttachmentReferences:()=>false,
  NativeCapabilities:null,notifyBackupChange:()=>{},StartupLifecycle:{status:()=>({fullyInitialized:false})},saveReminderDate:'',richAssetReferenceRevision:0
});
vm.runInContext(`${constant}\n${source.slice(start,end+2)}\nglobalThis.commit=handleCanonicalCommit;`,context);
const committedAt='2026-11-07T09:30:00.000Z',marked=event=>{writes.length=0;context.commit({committedAt,operation:'upsert',...event});return writes[0].lastStudyDataSaveAt===committedAt;};
for(const entityType of ['note','dailyRecord','activeSession','planData','pendingReview'])
  assert.equal(marked({entityType}),true,`a ${entityType} save records study data`);
assert.equal(marked({entityType:'planData',startup:true}),false,'settings rebuilt by the start-up step on a fresh install do not');
assert.equal(marked({entityType:'activeSession',operation:'delete'}),true,'removing a session still says study data was here');
assert.equal(writes[0].lastLocalSaveAt,committedAt,'every commit still moves the change clock');

console.log(JSON.stringify({status:'PASS',suite:'study-data-mark',kinds:5,startupExcluded:true}));
