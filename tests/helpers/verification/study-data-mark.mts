import {readRuntimeSource} from '../runtime-source.mts';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {method,registeredExports} from '../registered-exports.mts';
import {jsonObject} from './read-verification.mts';
import {checkedRepository as createHarness,field} from '../repository-safety-ports.mts';
import {createFakeClock} from '../fake-clock.mts';

// "Study data was saved here" (lastStudyDataSaveAt) is what lets a start that
// finds the database removed show the clear notice instead of starting as
// new. It covers notes, Saved Days, sessions, plans and kept versions (what
// the empty-device check counts), not settings alone, and the start-up
// compatibility step never sets it on a fresh install.

// Repository: plan and settings writes say whether the start-up step made them.
const clock=createFakeClock('2026-11-07T09:00:00.000Z'),commits:unknown[]=[];
const {app}=createHarness(new Map(),null,{clock,onCanonicalCommit:event=>commits.push(event)});
await app.planData.writeDraft('07:00 | 30 | Work | work | Ethics | block | 1');
await app.personalPreferences.write({version:2,studentName:null,theme:null,presentation:null,quote:null,practiceCueMode:null,fontScale:null,practiceTargetMs:null,nudge:null},{allowHydrating:true});
await app.personalPreferences.write({version:2,studentName:'QA',theme:null,presentation:null,quote:null,practiceCueMode:null,fontScale:null,practiceTargetMs:null,nudge:null});
assert.deepEqual(commits.map(event=>[field(event,'entityType'),field(event,'startup'),field(event,'settingsOnly')]),[['planData',false,false],['planData',true,true],['planData',false,true]],'the start-up write and settings alone are marked as such');

// App: which commits record study data.
const writes:Record<string,unknown>[]=[],history:Record<string,unknown>={},context=vm.createContext({Symbol,Object});
for(const file of ['internal','backup-readiness-host'])vm.runInContext(readRuntimeSource('source/core/'+file+'.ts'),context);
const readiness=registeredExports(context,'backup-readiness-host');
const noop=()=>{};
const commitsHost=method(readiness,'createCanonicalCommit')(Object.freeze({
  storage:{updateHistory:(patch:unknown)=>{const row=jsonObject(patch);writes.push(row);Object.assign(history,row);},render:noop},scanAttachmentReferences:()=>({trusted:true,assetIds:[]}),
  incrementReferenceRevision:noop,syncCapability:noop,notifyBackupChange:noop,scheduleAssetMaintenance:noop,
  invalidateAttachmentLibrary:noop,fullyInitialized:()=>false,refreshKeptVersions:noop,reminderDate:()=>'',revalidateSaveReminder:noop,nowIso:()=>clock.now()
}));
const committedAt='2026-11-07T09:30:00.000Z',marked=(event:{entityType:string;startup?:boolean;settingsOnly?:boolean;operation?:'upsert'|'delete'})=>{writes.length=0;method(commitsHost,'handle')({committedAt,operation:'upsert',...event});return field(writes[0],'lastStudyDataSaveAt')===committedAt;};
for(const entityType of ['note','dailyRecord','activeSession','planData','pendingReview'])
  assert.equal(marked({entityType}),true,`a ${entityType} save records study data`);
assert.equal(marked({entityType:'planData',startup:true}),false,'settings rebuilt by the start-up step on a fresh install do not');
assert.equal(marked({entityType:'planData',settingsOnly:true}),false,'settings alone (a name or a theme) do not: the empty-device check does not count them either');
assert.equal(marked({entityType:'activeSession',operation:'delete'}),true,'removing a session still says study data was here');
assert.equal(field(writes[0],'lastLocalSaveAt'),committedAt,'every commit still moves the change clock');

// Settings-only writes must not erase the previously persisted study-data marker.
const laterAt='2026-11-07T10:00:00.000Z';
method(commitsHost,'handle')({committedAt:laterAt,entityType:'planData',operation:'upsert',settingsOnly:true});
assert.equal(history['lastStudyDataSaveAt'],committedAt);
assert.equal(history['lastLocalSaveAt'],laterAt);

console.log(JSON.stringify({status:'PASS',suite:'study-data-mark',kinds:5,startupExcluded:true}));
