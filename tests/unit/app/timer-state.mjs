import {fileURLToPath} from 'node:url';
import {readScript} from '../../../build/source-script.mts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const execute=file=>vm.runInThisContext(readScript(fileURLToPath(new URL(file,import.meta.url))),{filename:file});
execute('../../../source/core/internal.ts');
execute('../../../source/core/timer-state.ts');
execute('../../../source/core/execution-host.ts');
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const timer=registry.require('timer-state',1);
const executionHost=registry.require('execution-host',1);

const captures=[];
const transitions=[];
const controller=timer.createStateController(Object.freeze({
  helpers:Object.freeze({makeTaskId:(task,index)=>`generated-${index}-${String(task?.name||'task').toLowerCase().replace(/\W+/g,'-')}`}),
  diagnostics:Object.freeze({capture:(...args)=>captures.push(args)}),
  effects:Object.freeze({modeChanged:(...args)=>transitions.push(args)})
}));

assert.equal(controller.mode,'empty');
assert.equal(controller.currentIndex,0);
assert.equal(Object.isFrozen(controller),true);

// Schedule normalization gives every task a stable, unique identity and exposes read-only live views.
const tasksView=controller.loadSchedule([
  {id:'same',name:'A'},
  {id:'same',name:'B'},
  {name:'C'}
],{studyDate:'2026-09-13'});
assert.equal(tasksView.length,3);
assert.equal(tasksView[0].id,'same');
assert.equal(tasksView[1].id,'generated-1-b');
assert.equal(tasksView[2].id,'generated-2-c');
assert.equal(controller.studyDate,'2026-09-13');
assert.equal(controller.currentTaskId,'same');
assert.throws(()=>{tasksView.extra=true;},TypeError);

// State normalization clamps malformed runtime values rather than leaking them into persistence.
controller.runtime={taskIdx:-1,startMs:100,durationSec:-10,totalPausedMs:3.6,recordedSec:'7.6',sleepPausedMs:-2};
assert.deepEqual({...controller.runtime},{
  taskIdx:null,startMs:100,durationSec:0,totalPausedMs:4,pausedStartedMs:null,
  recordedSec:8,overtimeNotified:false,lastTickMs:null,sleepPausedMs:0
});

controller.currentIndex=1;
assert.equal(controller.currentTaskId,'generated-1-b');
controller.currentIndex=999;
assert.equal(controller.currentIndex,3);
assert.equal(controller.currentTaskId,null);

// Unexpected transitions remain observable diagnostically, but state progression is not silently blocked.
controller.setMode('done','unit-test');
assert.equal(controller.mode,'done');
assert.equal(captures.some(([scope])=>scope==='timer.unexpected-transition'),true);
assert.deepEqual(transitions.at(-1),['empty','done','unit-test']);
assert.equal(controller.setMode('not-a-mode'),false);

// Adjustment persistence is keyed by task identity rather than fragile array position.
controller.currentIndex=0;
controller.setAdjustment(0,{start:60,end:90});
controller.setAdjustment(1,{start:100,end:130});
assert.deepEqual({...controller.captureAdjustmentsByTaskId()},{same:{start:60,end:90},'generated-1-b':{start:100,end:130}});
controller.removeAdjustment(0);
assert.deepEqual({...controller.captureAdjustmentsByTaskId()},{'generated-1-b':{start:100,end:130}});

// Revisions and evidence snapshots are bounded, immutable value objects.
controller.contentRevision=7.6;
controller.savedRevision=99;
const projected=controller.projectSessionSnapshot({date:'2026-09-13',updatedAt:'2026-09-13T00:00:00.000Z'});
assert.equal(projected.version,6,'Current SessionSnapshot projection must default to v6.');
assert.equal(projected.contentRevision,8);
assert.equal(projected.savedRevision,8);
assert.equal(Object.isFrozen(projected),true);
controller.savedRevision=6;
const gateway=controller.createEvidenceGateway(()=>({taskEvidence:{same:{completion:50}},practiceRuns:[{id:'p1'}]}));
const evidence=gateway.snapshot();
assert.equal(evidence.currentTaskId,'same');
assert.equal(evidence.contentRevision,8);
assert.equal(evidence.savedRevision,6);
assert.equal(Object.isFrozen(evidence),true);
assert.deepEqual({...gateway.taskEvidence('same')},{completion:50});

// Renaming a note with its Area relabels today's blocks in place: ids, the
// current block, adjustments and the running timer stay as they are.
const renameDemo=timer.createStateController(Object.freeze({
  helpers:Object.freeze({makeTaskId:(task,index)=>`task-${index}`}),diagnostics:Object.freeze({capture:()=>{}}),effects:Object.freeze({modeChanged:()=>{}})
}));
renameDemo.loadSchedule([{id:'a',name:'Read',area:'GS2 > Polity'},{id:'b',name:'Notes',area:'GS2 > Polity > Rights'},{id:'c',name:'Maths',area:'Maths'}],{studyDate:'2026-09-13'});
renameDemo.originalSchedule=[{id:'a',area:'GS2 > Polity'},{id:'c',area:'Maths'}];
renameDemo.currentIndex=1;renameDemo.runtime={taskIdx:1,startMs:100,durationSec:600};renameDemo.setAdjustment(1,{start:60,end:90});
const renameTo=row=>{const area=String(row.area||'');return area==='GS2 > Polity'||area.startsWith('GS2 > Polity > ')?'Paper 2'+area.slice('GS2 > Polity'.length):undefined;};
assert.equal(renameDemo.renameTaskAreas(renameTo),2,'two blocks use the renamed Area or one inside it');
assert.deepEqual(renameDemo.tasks.map(task=>[task.id,task.area]),[['a','Paper 2'],['b','Paper 2 > Rights'],['c','Maths']]);
assert.deepEqual(renameDemo.originalSchedule.map(task=>task.area),['Paper 2','Maths'],'the original schedule follows');
assert.equal(renameDemo.currentIndex,1);assert.equal(renameDemo.currentTaskId,'b');assert.equal(renameDemo.runtime.startMs,100,'the running timer is untouched');
assert.deepEqual({...renameDemo.captureAdjustmentsByTaskId()},{b:{start:60,end:90}},'adjustments stay with their blocks');
assert.equal(renameDemo.renameTaskAreas(()=>undefined),0,'nothing to rename changes nothing');


// Per-task runtime evidence is keyed by stable task identity rather than array position.
const evidenceController=timer.createStateController(Object.freeze({
  helpers:Object.freeze({makeTaskId:(task,index)=>String(task?.id||`task-${index}`)}),
  diagnostics:Object.freeze({capture:()=>{}}),effects:Object.freeze({modeChanged:()=>{}})
}));
evidenceController.loadSchedule([
  {id:'a',start:'08:00',dur:60,name:'A',kind:'work',area:'Core',measure:'block',target:1},
  {id:'b',start:'09:00',dur:60,name:'B',kind:'work',area:'Core',measure:'block',target:1}
]);
const taskState=executionHost.createTaskSessionState(evidenceController.taskIdentity);
assert.equal(taskState.setField(0,'completion',40),true);
assert.equal(taskState.setField(0,'notes',{done:2,total:5}),true);
assert.equal(taskState.setResolved(1,'skipped'),true);
assert.equal(taskState.setField(0,'unknown-field',1),false,'unknown runtime evidence fields fail closed for JavaScript callers');
assert.equal(taskState.getField(0,'unknown-field'),undefined);
evidenceController.loadSchedule([
  {id:'b',start:'08:00',dur:60,name:'B',kind:'work',area:'Core',measure:'block',target:1},
  {id:'a',start:'09:00',dur:60,name:'A',kind:'work',area:'Core',measure:'block',target:1}
]);
assert.equal(taskState.resolvedState(0),'skipped','resolved state follows task b after reorder');
assert.equal(taskState.getField(1,'completion'),40,'completion follows task a after reorder');
assert.deepEqual(taskState.getField(1,'notes'),{done:2,total:5});
assert.deepEqual(taskState.indexSnapshot('completion'),{'1':40},'snapshots use current indices without relocating identity-owned evidence');
assert.equal(taskState.deleteField(1,'completion'),true);
assert.equal(taskState.deleteField(1,'notes'),true);
assert.equal(taskState.indices().includes(1),false,'empty unresolved task evidence is pruned');
taskState.clear();
assert.deepEqual(taskState.indices(),[],'clear removes all runtime evidence');

const sources=Object.freeze({UNITS:'units',MANUAL:'manual',TIME:'time',FINISHED_TIME:'finished-time',FINISHED_UNVERIFIED:'finished-unverified',SKIPPED:'skipped',NONE:'none'});
const completionModel=Object.freeze({
  normalizeSource:value=>Object.values(sources).includes(value)?value:sources.NONE,
  fromUnits:()=>null,
  progressInput:()=>({done:null,total:null,pct:null,hasDone:false,hasTotal:false}),
  fromFocus:()=>null,
  needsFocus:()=>false,
  resolve:input=>({pct:Number(input?.storedPct)||0,source:input?.source||sources.NONE}),
  clampPercent:value=>Math.max(0,Math.min(100,Number(value)||0))
});
const completion=executionHost.createCompletionEvidence(Object.freeze({
  tasks:evidenceController.tasks,taskSessionState:taskState,completionModel,sources,
  classifyTaskOutcome:()=> 'untouched',taskTargetValue:()=>null,actualTimeSnapshot:()=>({}),
  renderCompletionChange:()=>false,saveLiveDraft:()=>false
}));
taskState.setResolved(0,'skipped');taskState.setField(0,'completion',0);taskState.setField(0,'completionSource','skipped');
assert.equal(completion.toggleDoneState(0),'reopened-skip','reopening a skipped block uses the checked completion owner');
assert.equal(taskState.resolvedState(0),null);assert.equal(taskState.getField(0,'completion'),undefined);assert.equal(taskState.getField(0,'completionSource'),undefined);
taskState.setResolved(0,'done');taskState.setField(0,'completion',0);taskState.setField(0,'completionSource','finished-unverified');
assert.equal(completion.toggleDoneState(0),null,'reopening an unverified finished block clears the synthetic done state');
assert.equal(taskState.getField(0,'completion'),undefined);assert.equal(taskState.getField(0,'completionSource'),undefined);
taskState.setResolved(0,'done');taskState.setField(0,'completion',55);taskState.setField(0,'completionSource','manual');
assert.equal(completion.toggleDoneState(0),null);
assert.equal(taskState.getField(0,'completion'),55,'reopening preserves genuine manual completion evidence');
assert.equal(taskState.getField(0,'completionSource'),'manual');
assert.equal(completion.toggleDoneState(99),false,'invalid task indices fail closed');
taskState.setField(0,'notes',{done:1,total:2});
const clearedProgress=completion.syncProgressInputsToState(0,{done:null,total:null,pct:null,hasDone:false,hasTotal:false});
assert.equal(clearedProgress.changed,true);
assert.equal(taskState.getField(0,'notes'),undefined,'blank progress inputs prune empty runtime evidence');

controller.clearSession();
assert.equal(controller.mode,'empty');
assert.equal(controller.tasks.length,0);
assert.equal(controller.studyDate,null);
assert.equal(controller.runtime.startMs,null);

console.log(JSON.stringify({status:'PASS',contract:'timer-state',taskIdentity:true,runtimeNormalization:true,transitions:true,snapshots:true,taskIdentityEvidence:true,areaRenameInPlace:true},null,2));
