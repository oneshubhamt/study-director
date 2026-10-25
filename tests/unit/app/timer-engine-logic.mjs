import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createNotifications} from '../../helpers/notifications.mjs';
import {createFakeClock} from '../../helpers/fake-clock.mjs';

for(const file of ['source/core/internal.js','source/core/practice-pacer.js','source/core/timer-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const {coordinator:notifications}=createNotifications();
const practiceModule=registry.require('practice-pacer',1);
const module=registry.require('timer-engine',2);
const freeze=Object.freeze,noop=()=>false;
const clock=createFakeClock('2026-09-13T06:00:00.000Z');
const pauseRecords=[],practiceEvents=[],modeTransitions=[],recordedFocusSec=[];let scheduleRows=[],engineRef=null;
const fields=(names,overrides={})=>freeze(Object.fromEntries(names.map(name=>[name,Object.prototype.hasOwnProperty.call(overrides,name)?overrides[name]:noop])));

const limits=freeze({
  minPracticeTargetMs:1000,maxPracticeTargetMs:4*60*60*1000,maxPracticeUnitsPerRun:20,maxPracticeUnitsPerDay:40,maxPracticeRunsPerDay:8,
  maxPracticePlanGroups:12,maxPracticeMarksPerUnit:100,maxUnitChars:40,maxDurationMinutes:1440,maxCarryForwardChars:5000,maxQuoteChars:5000,maxLiveSessionsPerTask:100
});
const timerState={
  currentIndex:0,mode:'ready',paused:false,runtime:null,inactiveGap:null,contentRevision:0,savedRevision:0,
  breakStartMs:null,currentBreakSec:0,activeBreak:null,
  createEvidenceGateway:()=>freeze({}),
  emptyRuntime:()=>({taskIdx:null,startMs:null,durationSec:0,totalPausedMs:0,pausedStartedMs:null,recordedSec:0,overtimeNotified:false,lastTickMs:null,sleepPausedMs:0}),
  patchRuntime(patch){this.runtime={...(this.runtime||this.emptyRuntime()),...patch};},
  patchActiveBreak(patch){this.activeBreak={...(this.activeBreak||{}),...patch};},
  patchInactiveGap(patch){this.inactiveGap={...(this.inactiveGap||{}),...patch};}
};
const domainPort=fields(['KeyedRecord','boundedInt','boundedNumber','clampArray','clampText','cleanDayRevision','fmtOver','fmtS','makeTaskId','positiveMinutes','shortTaskLabel','studyMinuteToHHMM','taskAreaValue','taskMeasureValue','taskTargetValue'],{
    KeyedRecord:freeze({create:()=>Object.create(null)}),
    boundedInt:(value,{min=0,max=Number.MAX_SAFE_INTEGER,fallback=0}={})=>{const n=Number(value);return Number.isInteger(n)&&n>=min&&n<=max?n:fallback;},
    boundedNumber:(value,{min=0,max=Number.MAX_SAFE_INTEGER,fallback=0}={})=>{const n=Number(value);return Number.isFinite(n)&&n>=min&&n<=max?n:fallback;},
    clampArray:(value,max)=>Array.isArray(value)?value.slice(0,max):[],clampText:(value,max)=>String(value??'').slice(0,max),cleanDayRevision:value=>Math.max(0,Math.round(Number(value)||0)),
    fmtOver:value=>String(value),fmtS:value=>String(value),makeTaskId:()=>'',positiveMinutes:value=>Math.max(0,Number(value)||0),shortTaskLabel:value=>String(value?.name||''),studyMinuteToHHMM:()=>'',taskAreaValue:()=>'',taskMeasureValue:()=>'',taskTargetValue:()=>null
  });
const documentStub={hidden:false,getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],activeElement:null};
const practiceModel=practiceModule.createModel(freeze({ports:freeze({
  configuration:freeze({APP_LIMITS:limits}),
  domain:freeze({boundedInt:domainPort.boundedInt,boundedNumber:domainPort.boundedNumber,clampArray:domainPort.clampArray,clampText:domainPort.clampText,fmtS:domainPort.fmtS})
})}));
const practiceController=practiceModule.createController(freeze({model:practiceModel,ports:freeze({
  configuration:freeze({APP_LIMITS:limits}),
  state:freeze({TASKS:freeze([]),TIMER_MODES:freeze({EMPTY:'empty',READY:'ready',RUNNING:'running',PAUSED:'paused',DONE:'done'}),TaskIdentity:freeze({idAt:()=>null,indexForId:()=>null}),TimerState:timerState}),
  schedule:freeze({isTaskResolved:()=>false,isWorkBlock:()=>false}),
  persistence:freeze({persistPracticeCueMode:noop,persistPracticeTarget:noop,saveLiveDraft:noop,writeLiveDraftNow:noop}),
  view:freeze({document:documentStub,isExecutePaneVisible:()=>false,setElementAttribute:noop,setElementClass:noop,setElementDisabled:noop,setElementHidden:noop,setElementStyle:noop,setElementText:noop,setTextSafe:noop}),
  userPreferences:freeze({notifications,readUserDefaults:()=>({})}),
  ownership:freeze({appCanMutate:()=>true}),
  clock:freeze({nowMs:clock.now})
})}));
const tasks=freeze([{id:'task-1',name:'Focus block'}]);
const practiceStub=freeze({
  rebaseClock:delta=>{practiceEvents.push(['rebase',delta]);return true;},
  pauseFromMain:(cause,now)=>{practiceEvents.push(['pause',cause,now]);return true;},
  resumeFromMain:now=>{practiceEvents.push(['resume',now]);return true;},
  onInactiveGapOpened:gap=>{practiceEvents.push(['gap-open',gap.gapMs]);},
  resolveInactiveGap:(focus,options)=>{practiceEvents.push(['gap-resolve',focus,options.resume,options.now]);return true;},
  paint:noop,pulse:noop,paintProgress:noop,onMainTaskChanging:noop,onBlockResolved:noop,status:()=>freeze({})
});
const ports=freeze({
  configuration:fields(['APP_LIMITS','SLEEP_GAP_THRESHOLD_MS'],{APP_LIMITS:limits,SLEEP_GAP_THRESHOLD_MS:30000}),
  state:fields(['TASKS','TIMER_MODES','TaskIdentity','TaskSessionState','TimerState','resetBreakState','setCurrentTask','setTimerMode'],{
    TASKS:tasks,TIMER_MODES:freeze({EMPTY:'empty',READY:'ready',RUNNING:'running',PAUSED:'paused',DONE:'done'}),
    TaskIdentity:freeze({idAt:index=>tasks[index]?.id||null,indexForId:id=>tasks.findIndex(task=>task.id===id)}),TaskSessionState:freeze({getField:()=>null,resolvedState:()=>'',indexSnapshot:()=>({})}),TimerState:timerState,
    resetBreakState:()=>{timerState.breakStartMs=null;timerState.currentBreakSec=0;timerState.activeBreak=null;},
    setCurrentTask:index=>{timerState.currentIndex=index;return index;},
    setTimerMode:(mode,reason)=>{modeTransitions.push([timerState.mode,mode,reason]);timerState.mode=mode;return mode;}
  }),
  domain:freeze({KeyedRecord:domainPort.KeyedRecord,boundedInt:domainPort.boundedInt,clampText:domainPort.clampText,cleanDayRevision:domainPort.cleanDayRevision,fmtOver:domainPort.fmtOver,fmtS:domainPort.fmtS,makeTaskId:domainPort.makeTaskId,positiveMinutes:domainPort.positiveMinutes,shortTaskLabel:domainPort.shortTaskLabel,studyMinuteToHHMM:domainPort.studyMinuteToHHMM,taskAreaValue:domainPort.taskAreaValue,taskMeasureValue:domainPort.taskMeasureValue,taskTargetValue:domainPort.taskTargetValue}),
  schedule:fields(['adjustedEndMin','adjustedStartMin','beginActualTask','effectiveNowMin','findNextIncompleteTrackableAfter','getLatestCarryForward','getScheduleDerivedState','handleStudyDayRollover','hasAdjustedTiming','isFixedBlock','isLiveTrackableTimer','isTaskResolved','isTrackableBlock','isWorkBlock','originalEndMin','originalStartMin','plannedRows','scheduleFingerprint','studyDayRolledOver'],{getScheduleDerivedState:()=>({adjustmentsRevision:0}),plannedRows:()=>scheduleRows,scheduleFingerprint:()=>'',isFixedBlock:task=>task?.kind==='fixed',isTrackableBlock:task=>task?.kind!=='fixed',isWorkBlock:task=>!task?.kind||task.kind==='work',isLiveTrackableTimer:()=>true,studyDayRolledOver:()=>false,effectiveNowMin:(date=new Date(clock.now()))=>date.getUTCHours()*60+date.getUTCMinutes()}),
  persistence:fields(['activePauseEventSnapshot','addPauseToActual','compactPauseEvents','compactRealTimeSnapshot','flushLiveDraft','maybeSnapshotRunningTimer','recoveryCaptureActiveBeforeSwitch','recoverySetStatus','reopenActualSessionForTimer','saveLiveDraft','saveNote','writeLiveDraftNow'],{addPauseToActual:(idx,sec,meta)=>{pauseRecords.push({idx,sec,meta});return true;}}),
  view:fields(['cachedElements','clearExecuteStateOverlay','invalidateExecuteIdleDisplay','refreshPnote','refreshExecuteIdleDisplay','requestRender','setElementStyle','setElementText','setTextSafe','setExecuteControlsEnabled','setExecuteShellVisible','showDone','showEmpty','textEl','toggleDoneMarker'],{cachedElements:()=>({}),textEl:()=>({})}),
  clock:fields(['nowMs'],{nowMs:clock.now}),
  reviewEvidence:fields(['applicableNotesForTask','buildRealTimeSnapshot','exactTaskCompletionPercent','getReviewDate','liveTaskOutcome','recordCurrentActiveToTask','resolveTaskCompletion','setTaskDoneState','setTaskSkippedState','updateRealTimeAwareness','updateTimerFocusMetrics'],{recordCurrentActiveToTask:()=>{recordedFocusSec.push(engineRef?engineRef.currentTimerActiveSeconds():null);return 0;},buildRealTimeSnapshot:()=>({}),getReviewDate:()=> '2026-09-13',resolveTaskCompletion:()=>({pct:0,source:'unresolved'})}),
  clockEnvironment:fields(['cancelAnimationFrame','clearInterval','document','getComputedStyle','requestAnimationFrame','setInterval','setTimeout','window'],{
    document:documentStub,getComputedStyle:()=>({}),window:{matchMedia:()=>({matches:false})},requestAnimationFrame:()=>1,setInterval:()=>1,setTimeout:()=>1
  }),
  userPreferences:fields(['Pomodoro','notifications'],{notifications,Pomodoro:freeze({timerEvent:noop,configuration:freeze({breakSeconds:()=>300}),acceptedBreak:()=>null,stop:noop})}),
  ownership:fields(['appCanMutate'],{appCanMutate:()=>true}),
  practice:freeze({controller:practiceStub,model:practiceModel})
});

const engine=module.createEngine(freeze({ports}));engineRef=engine;
assert.equal(engine.format,'study-director.timer-engine');
const restored=engine.restoredRuntimeRecordedSec({mode:'paused',paused:true,updatedAt:'2026-09-13T00:00:20.000Z',activeBreak:{startedAtMs:10000}},{startMs:1000,totalPausedMs:2000,pausedStartedMs:10000,recordedSec:3});
assert.equal(restored,7,'restored evidence uses active elapsed time at the pause boundary and never regresses below saved evidence');

// Pause/resume accounting is entirely clock-driven and records only the paused interval.
timerState.mode='running';timerState.paused=false;timerState.inactiveGap=null;timerState.runtime={...timerState.emptyRuntime(),taskIdx:0,startMs:clock.now()-30000,durationSec:600,totalPausedMs:0,lastTickMs:clock.now()};
assert.equal(engine.beginTimerPause('manual'),true);assert.equal(timerState.mode,'paused');assert.equal(timerState.paused,true);assert.equal(timerState.runtime.pausedStartedMs,clock.now());
await clock.advance(15000);engine.togglePause();
assert.equal(timerState.mode,'running');assert.equal(timerState.paused,false);assert.equal(timerState.runtime.totalPausedMs,15000);assert.equal(pauseRecords.at(-1).sec,15);assert.equal(pauseRecords.at(-1).meta.type,'manual');
assert.equal(practiceEvents.some(event=>event[0]==='pause'),true);assert.equal(practiceEvents.some(event=>event[0]==='resume'),true);

// A long inactive gap is detected once, then classified as break time without counting focus.
timerState.mode='running';timerState.paused=false;timerState.inactiveGap=null;timerState.runtime={...timerState.emptyRuntime(),taskIdx:0,startMs:clock.now()-60000,durationSec:600,totalPausedMs:0,lastTickMs:clock.now()-40000};
assert.equal(engine.absorbInactiveTimerGap('unit-wake'),40000);assert.equal(timerState.inactiveGap.gapMs,40000);
engine.classifyInactiveGap('break');
assert.equal(timerState.inactiveGap,null);assert.equal(timerState.runtime.totalPausedMs,40000);assert.equal(timerState.runtime.sleepPausedMs,40000);assert.equal(pauseRecords.at(-1).sec,40);assert.equal(pauseRecords.at(-1).meta.type,'inactive-gap');
// A pending gap whose timer already stopped (for example at a fixed block) must
// still close on any choice instead of leaving an unresponsive dialog.
timerState.inactiveGap={id:'gap_stale',taskIdx:0,gapMs:90000,lastMs:clock.now()-90000,detectedAtMs:clock.now(),source:'sleep'};
const savedRuntime=timerState.runtime;timerState.runtime=timerState.emptyRuntime();
engine.classifyInactiveGap('focus');
assert.equal(timerState.inactiveGap,null,'a gap without a live timer is released, not left pending');
timerState.runtime=savedRuntime;

// Away time counts only while the running block's study time lasted. A fixed
// (or, for a work block, support) block that began during the gap ends the
// countable part; a fixed block also stops the timer. Every choice closes.
await clock.advance(60000-(clock.now()%60000));
const minuteNow=()=>new Date(clock.now()).getUTCHours()*60+new Date(clock.now()).getUTCMinutes();
function awayFor(kind,{ranMin=10,awayMin=20,startsAgoMin=5}={}){
  scheduleRows=[{idx:1,t:{kind,name:kind},start:minuteNow()-startsAgoMin,end:minuteNow()+25}];
  timerState.mode='running';timerState.paused=false;timerState.inactiveGap=null;
  timerState.runtime={...timerState.emptyRuntime(),taskIdx:0,startMs:clock.now()-(ranMin+awayMin)*60000,durationSec:3600,totalPausedMs:0,lastTickMs:clock.now()-awayMin*60000};
  assert.equal(engine.absorbInactiveTimerGap('unit-wake'),awayMin*60000);
}
for(const [choice,focusMs,expectedMin] of [['focus',null,25],['break',null,10],['split',5*60000,15],['split',60*60000,25],['ignore',null,10]]){
  awayFor('fixed');const before=recordedFocusSec.length,breaks=pauseRecords.length;
  engine.classifyInactiveGap(choice,focusMs);
  assert.equal(timerState.inactiveGap,null,`${choice} closes the dialog`);
  assert.equal(recordedFocusSec.length,before+1,'the fixed block stops the timer and records its focus');
  assert.equal(recordedFocusSec.at(-1),expectedMin*60,`${choice}: only the 15 minutes before the fixed block can count`);
  assert.equal(timerState.mode,'ready');assert.equal(timerState.runtime.startMs,null);
  if(choice==='break')assert.equal(pauseRecords.at(-1).sec,15*60,'break covers only the countable part');
  else assert.equal(pauseRecords.length,breaks+(choice==='split'&&focusMs<15*60000?1:0));
}
awayFor('fixed',{startsAgoMin:-5});
engine.classifyInactiveGap('focus');
assert.equal(timerState.mode,'running','a fixed block that has not started yet does not limit the gap');
assert.equal(engine.currentTimerActiveSeconds(),30*60);
awayFor('support');
engine.classifyInactiveGap('focus');
assert.equal(timerState.mode,'running','a support block limits the countable time without stopping the timer');
assert.equal(engine.currentTimerActiveSeconds(),25*60,'support-block time is not counted as work focus');
scheduleRows=[];timerState.inactiveGap=null;
assert.equal(practiceEvents.some(event=>event[0]==='gap-open'),true);assert.equal(practiceEvents.some(event=>event[0]==='gap-resolve'&&event[1]===0),true);

// Wake after a backward wall-clock jump rebases every coupled timer timestamp by the same delta.
const wakeNow=clock.now(),futureLast=wakeNow+10000;
timerState.mode='paused';timerState.paused=true;timerState.breakStartMs=wakeNow+5000;timerState.currentBreakSec=0;timerState.activeBreak={type:'manual',taskIdx:0,startedAtMs:wakeNow+5000};
timerState.runtime={...timerState.emptyRuntime(),taskIdx:0,startMs:wakeNow-90000,durationSec:600,totalPausedMs:0,pausedStartedMs:wakeNow+5000,lastTickMs:futureLast};
timerState.inactiveGap={id:'gap',taskIdx:0,gapMs:30000,lastMs:wakeNow-30000,detectedAtMs:wakeNow+2000,source:'sleep'};
assert.equal(engine.syncTimerAfterWake(),false);
assert.equal(timerState.runtime.lastTickMs,wakeNow);assert.equal(timerState.runtime.startMs,wakeNow-100000);assert.equal(timerState.runtime.pausedStartedMs,wakeNow-5000);assert.equal(timerState.breakStartMs,wakeNow-5000);assert.equal(timerState.activeBreak.startedAtMs,wakeNow-5000);assert.equal(timerState.inactiveGap.lastMs,wakeNow-40000);assert.equal(timerState.inactiveGap.detectedAtMs,wakeNow-8000);
assert.equal(practiceEvents.some(event=>event[0]==='rebase'&&event[1]===-10000),true);

// A running timer restored after a cross-device handoff resumes RUNNING on the same task,
// while the handoff interval is protected as an inactive gap rather than counted as focus.
const handoffNow=clock.now();
timerState.currentIndex=0;timerState.mode='ready';timerState.paused=false;timerState.inactiveGap=null;timerState.activeBreak=null;timerState.breakStartMs=null;
timerState.runtime={...timerState.emptyRuntime(),taskIdx:0,startMs:handoffNow-240000,durationSec:600,totalPausedMs:0,recordedSec:60,lastTickMs:handoffNow-180000};
assert.equal(engine.resumeRestoredRunning(),true);
assert.equal(timerState.mode,'running');assert.equal(timerState.paused,false);assert.equal(timerState.currentIndex,0);assert.equal(timerState.runtime.taskIdx,0);
assert.ok(timerState.inactiveGap&&timerState.inactiveGap.gapMs>=180000,'A >2 minute cross-device interval must become a pending inactive gap.');
assert.equal(timerState.runtime.recordedSec>=60,true,'Restoring a running timer must never regress saved focus evidence.');

// A restore that kept the session running only froze the display. Time the
// timer was frozen for is study time, not an away gap; a gap that began
// before the freeze (the page was closed) is still asked about.
for(const [label,lastTickAgoMs,frozenAgoMs,expectGap] of [['ticking when frozen',1000,200000,false],['already stale when frozen',400000,200000,true],['no freeze time given',1000,null,true]]){
  const now=clock.now();
  timerState.currentIndex=0;timerState.mode='running';timerState.paused=false;timerState.inactiveGap=null;timerState.activeBreak=null;timerState.breakStartMs=null;
  timerState.runtime={...timerState.emptyRuntime(),taskIdx:0,startMs:now-600000,durationSec:3600,totalPausedMs:0,recordedSec:60,lastTickMs:now-frozenAgoMs-lastTickAgoMs};
  if(frozenAgoMs===null)timerState.runtime.lastTickMs=now-200000;
  assert.equal(engine.resumeAfterPrimaryRestore(frozenAgoMs===null?undefined:{frozenSinceMs:now-frozenAgoMs}),true,label);
  assert.equal(!!timerState.inactiveGap,expectGap,label);
  engine.stopExecution();timerState.inactiveGap=null;
}

// A paused timer remains PAUSED after restore and preserves its active break semantics.
const pausedAt=clock.now()-45000;
timerState.mode='ready';timerState.paused=false;timerState.inactiveGap=null;timerState.runtime={...timerState.emptyRuntime(),taskIdx:0,startMs:clock.now()-300000,durationSec:600,totalPausedMs:30000,recordedSec:90,lastTickMs:pausedAt,pausedStartedMs:pausedAt};
const restoredBreak={startedAtMs:pausedAt,now:clock.now(),overrunCapped:false,activeBreak:{type:'manual',taskIdx:0,startedAtMs:pausedAt,plannedSeconds:0,cueIssuedAt:null,doneNotified:false}};
assert.equal(engine.resumeRestoredPaused(restoredBreak),true);
assert.equal(timerState.mode,'paused');assert.equal(timerState.paused,true);assert.equal(timerState.currentIndex,0);assert.equal(timerState.runtime.taskIdx,0);assert.equal(timerState.activeBreak.type,'manual');

console.log(JSON.stringify({status:'PASS',contract:'timer-engine-state-machine',restoreFreezeNotAwayGap:true,restoreEvidence:true,pauseResume:true,inactiveGap:true,staleGapReleased:true,fixedAndSupportTimeExcluded:true,wakeRebase:true,crossDeviceRunningRestore:true,pausedRestore:true},null,2));
