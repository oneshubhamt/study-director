import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const execute=file=>vm.runInThisContext(fs.readFileSync(new URL(file,import.meta.url),'utf8'),{filename:file});
execute('../../../source/core/internal.js');
execute('../../../source/core/timer-state.js');
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const timer=registry.require('timer-state',1);

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

controller.clearSession();
assert.equal(controller.mode,'empty');
assert.equal(controller.tasks.length,0);
assert.equal(controller.studyDate,null);
assert.equal(controller.runtime.startMs,null);

console.log(JSON.stringify({status:'PASS',contract:'timer-state',taskIdentity:true,runtimeNormalization:true,transitions:true,snapshots:true},null,2));
