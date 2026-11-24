import {readRuntimeSource} from '../../helpers/runtime-source.mjs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createHarness} from '../../helpers/repository-harness.mjs';
import {createFakeClock} from '../../helpers/fake-clock.mjs';

// "Study data was saved here" (lastStudyDataSaveAt) is what lets a start that
// finds the database removed show the clear notice instead of starting as
// new. It covers notes, Saved Days, sessions, plans and kept versions (what
// the empty-device check counts), not settings alone, and the start-up
// compatibility step never sets it on a fresh install.

// Repository: plan and settings writes say whether the start-up step made them.
const clock=createFakeClock('2026-11-07T09:00:00.000Z'),commits=[];
const {app}=createHarness(new Map(),null,{clock,onCanonicalCommit:event=>commits.push(event)});
await app.planData.writeDraft('07:00 | 30 | Work | work | Ethics | block | 1');
await app.personalPreferences.write({version:2,studentName:null,theme:null,presentation:null,quote:null,practiceCueMode:null,fontScale:null,practiceTargetMs:null,nudge:null},{allowHydrating:true});
await app.personalPreferences.write({version:2,studentName:'QA',theme:null,presentation:null,quote:null,practiceCueMode:null,fontScale:null,practiceTargetMs:null,nudge:null});
assert.deepEqual(commits.map(event=>[event.entityType,event.startup,event.settingsOnly]),[['planData',false,false],['planData',true,true],['planData',false,true]],'the start-up write and settings alone are marked as such');

// App: which commits record study data.
const writes=[],context=vm.createContext({Symbol,Object});
for(const file of ['internal','backup-readiness-host'])vm.runInContext(readRuntimeSource('source/core/'+file+'.ts'),context);
const readiness=context[Symbol.for('studyDirector.internalModules.v1')].require('backup-readiness-host',1);
const noop=()=>{};
const commitsHost=readiness.createCanonicalCommit(Object.freeze({
  storage:{updateHistory:patch=>writes.push(patch),render:noop},scanAttachmentReferences:()=>({trusted:true,assetIds:[]}),
  incrementReferenceRevision:noop,syncCapability:noop,notifyBackupChange:noop,scheduleAssetMaintenance:noop,
  invalidateAttachmentLibrary:noop,fullyInitialized:()=>false,refreshKeptVersions:noop,reminderDate:()=>'',revalidateSaveReminder:noop,nowIso:()=>clock.now()
}));
const committedAt='2026-11-07T09:30:00.000Z',marked=event=>{writes.length=0;commitsHost.handle({committedAt,operation:'upsert',...event});return writes[0].lastStudyDataSaveAt===committedAt;};
for(const entityType of ['note','dailyRecord','activeSession','planData','pendingReview'])
  assert.equal(marked({entityType}),true,`a ${entityType} save records study data`);
assert.equal(marked({entityType:'planData',startup:true}),false,'settings rebuilt by the start-up step on a fresh install do not');
assert.equal(marked({entityType:'planData',settingsOnly:true}),false,'settings alone (a name or a theme) do not: the empty-device check does not count them either');
assert.equal(marked({entityType:'activeSession',operation:'delete'}),true,'removing a session still says study data was here');
assert.equal(writes[0].lastLocalSaveAt,committedAt,'every commit still moves the change clock');

console.log(JSON.stringify({status:'PASS',suite:'study-data-mark',kinds:5,startupExcluded:true}));
