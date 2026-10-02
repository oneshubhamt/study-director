import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createNotifications} from '../../helpers/notifications.mjs';
import {createFakeClock} from '../../helpers/fake-clock.mjs';

for(const file of ['source/core/internal.js','source/core/practice-pacer.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const {coordinator:notifications}=createNotifications();
const module=globalThis[Symbol.for('studyDirector.internalModules.v1')].require('practice-pacer',1);
const freeze=Object.freeze,noop=()=>false;
const limits=freeze({
  minPracticeTargetMs:1000,maxPracticeTargetMs:4*60*60*1000,maxPracticeUnitsPerRun:20,maxPracticeUnitsPerDay:40,maxPracticeRunsPerDay:8,
  maxPracticePlanGroups:12,maxPracticeMarksPerUnit:100,maxUnitChars:40
});
const domain=freeze({
  boundedInt:(value,{min=0,max=Number.MAX_SAFE_INTEGER,fallback=0}={})=>{const n=Number(value);return Number.isInteger(n)&&n>=min&&n<=max?n:fallback;},
  boundedNumber:(value,{min=0,max=Number.MAX_SAFE_INTEGER,fallback=0}={})=>{const n=Number(value);return Number.isFinite(n)&&n>=min&&n<=max?n:fallback;},
  clampArray:(value,max)=>Array.isArray(value)?value.slice(0,max):[],
  clampText:(value,max)=>String(value??'').slice(0,max),
  fmtS:value=>`${Math.floor(Number(value)||0)}s`
});
const model=module.createModel(freeze({ports:freeze({configuration:freeze({APP_LIMITS:limits}),domain})}));
assert.equal(model.format,'study-director.practice-pacer-model');
assert.equal(model.parsePracticeDurationMs('1:30'),90000);
assert.equal(model.parsePracticeDurationMs('90s'),90000);
assert.equal(model.parsePracticeDurationMs('1.5h'),5400000);
assert.equal(model.parsePracticeDurationMs('garbage'),0);

const timePlan=model.parsePracticeUnitPlan('Warmup | 2×10 min\nMain | 3×15 min');
assert.equal(timePlan.error,'');
assert.deepEqual(timePlan.plan.groups,[[2,600000],[3,900000]]);
assert.deepEqual(timePlan.plan.segments,[[2,'Warmup'],[5,'Main']]);
const marksPlan=model.parsePracticeUnitPlan('2×10 marks, 1×20 marks',{sessionTargetMs:3600000});
assert.equal(marksPlan.error,'');
const marksContext=model.createPracticePlanContext({targetMs:60000,sessionTargetMs:3600000,unitPlan:marksPlan.plan});
assert.equal(marksContext.plannedUnits,3);
assert.equal(marksContext.unitTargets.reduce((sum,value)=>sum+value,0),3600000);
// Marks allocation uses cumulative proportional rounding: every prefix must equal the rounded ideal prefix,
// so rounding error cannot drift and the final allocation conserves the paper duration exactly.
for(const scenario of [
  {sessionTargetMs:3600000,groups:[[2,10],[1,20]]},
  {sessionTargetMs:10800000,groups:[[5,10],[3,15],[2,20]]},
  {sessionTargetMs:5400000,groups:[[1,7.5],[2,12.5],[3,20]]}
]){
  const plan={mode:'marks',groups:scenario.groups};
  const ctx=model.createPracticePlanContext({targetMs:60000,sessionTargetMs:scenario.sessionTargetMs,unitPlan:plan},plan);
  const weights=scenario.groups.flatMap(([count,marks])=>Array.from({length:count},()=>marks));
  const totalWeight=weights.reduce((sum,value)=>sum+value,0);
  let cumulativeWeight=0;
  assert.equal(ctx.unitTargets.length,weights.length);
  ctx.unitTargets.forEach((target,index)=>{
    cumulativeWeight+=weights[index];
    const idealPrefix=Math.round(scenario.sessionTargetMs*cumulativeWeight/totalWeight);
    assert.equal(ctx.targetPrefixMs[index+1],idealPrefix,'each marks-plan prefix must equal cumulative proportional rounding');
    assert.equal(target,ctx.targetPrefixMs[index+1]-ctx.targetPrefixMs[index],'unit target must be the exact adjacent-prefix difference');
  });
  assert.equal(ctx.targetPrefixMs.at(-1),scenario.sessionTargetMs,'marks-plan allocation must conserve total session time exactly');
}
assert.equal(model.practicePaceBand(47999,60000),'fast');
assert.equal(model.practicePaceBand(48000,60000),'controlled');
assert.equal(model.practicePaceBand(60000,60000),'controlled');
assert.equal(model.practicePaceBand(60001,60000),'over');

const cleanRun=model.sanitizePracticeRun({taskId:'task-1',targetMs:60000,unitMs:[45000,60000,90000],totalUnits:3},{allowedTaskIds:new Set(['task-1'])});
assert.equal(cleanRun.taskId,'task-1');
assert.equal(model.summarizeCleanPracticeRuns([cleanRun]).units,3);
assert.equal(model.summarizePracticeRunsForInsights([cleanRun,{targetMs:0,unitMs:[1]}]).audit.rejectedRawIndexes.length,1);

const targetInput={value:'1',disabled:false};
const documentStub={
  activeElement:null,
  getElementById:id=>id==='practice-target'?targetInput:null,
  querySelector:()=>null,
  querySelectorAll:()=>[]
};
const clock=createFakeClock('2026-09-13T06:00:00.000Z');
const timerState={mode:'running',paused:false,inactiveGap:null,runtime:{startMs:1,taskIdx:0},currentIndex:0};
const controller=module.createController(freeze({model,ports:freeze({
  configuration:freeze({APP_LIMITS:limits}),
  state:freeze({TASKS:freeze([{id:'task-1'}]),TIMER_MODES:freeze({RUNNING:'running'}),TaskIdentity:freeze({idAt:()=> 'task-1',indexForId:id=>id==='task-1'?0:null}),TimerState:timerState}),
  schedule:freeze({isTaskResolved:()=>false,isWorkBlock:()=>true}),
  persistence:freeze({persistPracticeCueMode:noop,persistPracticeTarget:noop,saveLiveDraft:noop,writeLiveDraftNow:noop}),
  view:freeze({document:documentStub,isExecutePaneVisible:()=>false,setElementAttribute:noop,setElementClass:noop,setElementDisabled:noop,setElementHidden:noop,setElementStyle:noop,setElementText:noop,setTextSafe:noop}),
  userPreferences:freeze({notifications,readUserDefaults:()=>({})}),
  ownership:freeze({appCanMutate:()=>true}),
  clock:freeze({nowMs:clock.now})
})}));
assert.equal(controller.start(),true);
const started=controller.status();
assert.equal(started.active.taskId,'task-1');
assert.equal(started.running,true);
await clock.advance(60000);
assert.equal(controller.pauseFromMain(model.PRACTICE_PAUSE_CAUSES.MAIN),true);
assert.equal(controller.status().running,false);
assert.equal(controller.finish(),true);
assert.equal(controller.completedRuns().length,1);
assert.equal(controller.completedRuns()[0].unitMs[0]>=59000,true);

console.log(JSON.stringify({status:'PASS',contract:'practice-pacer',model:true,plans:true,pacing:true,controller:true},null,2));
