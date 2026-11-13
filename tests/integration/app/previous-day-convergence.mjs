import {readRuntimeSource} from '../../helpers/runtime-source.mjs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createSavedDayFixture} from '../../helpers/review-saved-day-fixture.mjs';

const day='2026-11-04',today='2026-11-05';
const session=(status,runningOn='inst_here',date=day)=>({
  id:'current',version:10,revision:7,date,status,runningOn,
  scheduleText:'valid plan',snapshot:{contentRevision:7,savedRevision:0}
});
for(const file of ['source/core/internal.ts','source/core/session-actions.ts'])vm.runInThisContext(readRuntimeSource(file),{filename:file});
const SessionActions=globalThis[Symbol.for('studyDirector.internalModules.v1')].require('session-actions',1);
function prepare(current,{covered=false,choice=null,changeDuringChoice=false}={}){
  let stored=current,applies=0,claims=0,clears=0,restores=0,exclusive=0,chosen=null;
  const events=[],state={sessionPanelMode:'none',sessionPanelSession:null,sessionSafetyMessage:'',sessionHandoff:{step:'',error:''},sessionMovingHere:null,sessionYieldedAt:0,saveReminderDate:'',saveReminderEvidence:null,saveReminderGeneration:0};
  const clone=v=>structuredClone(v),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const load=async()=>({ok:true,value:clone(stored),storage:{idb:true},error:null});
  const runtime={TASKS:[],TimerState:{},TIMER_MODES:{},TimerEngine:{},TaskIdentity:{}};
  const ports={state,runtime,completionSources:{},
    AppData:{activeSession:{load},dailyRecords:{documents:async()=>[{date:day}],verifyCanonical:async()=>true}},
    ActiveSessionCodec:{sanitizeCurrent:v=>v},DailyRecordCodec:{savedDayCoversSessionEvidence:()=>covered},CanonicalModule:{same},
    ActiveSessionRuntime:{load,classify:s=>!s?'none':s.date<today?'previous':s.status==='suspended'?'today-suspended':'today-active',sessionSnapshot:s=>s?.snapshot,
      applyStoredSession(s,snapshot,options){applies++;assert.equal(snapshot.timerRuntime,null);assert.equal(options.reviewOnly,true);return true;},
      clearCanonical:async()=>{clears++;stored=null;},restoreSuspendedLocal:async s=>{restores++;return {...s,status:'active'};}},
    SessionHandoffRuntime:{runsElsewhere:s=>!!s&&s.status!=='suspended'&&s.runningOn!=='inst_here',fromElsewhere:s=>!!s&&s.runningOn!=='inst_here',prefetchSource:async()=>null,
      transferHere:async s=>{claims++;stored={...s,runningOn:'inst_here'};return {previous:s,session:stored};}},
    AppMutationCoordinator:{runExclusive:async(kind,operation)=>{assert.equal(kind,'discard-previous-session');exclusive++;return operation();}},
    Interactions:{choose:async spec=>{chosen=spec;if(changeDuringChoice)stored={...stored,revision:99};return choice;},confirm:async()=>true,notify(){}},NoticeCoordinator:{resolveEvent(){},emit(){}},
    AppDiagnostics:{capture(scope,error){events.push([scope,String(error)]);}},PlanScheduleGateway:{hasLiveState:()=>false},
    markStorageHealthError(){},setPlanStatus(message){events.push(message);},prettyDate:x=>x,refreshStorageFallbackWarning(){},notifyBackupChange(){},
    updateExecuteSessionStatus(){},refreshExecuteIdleDisplay(){},updateSessionControls(){},scheduleSyncStatus(){},goTab(){},appCanMutate:()=>true,
    storageHealthTime:x=>x,deviceName:()=>'',navigator:{onLine:true},clearCanonicalSessionAfterSavedDay:async()=>{clears++;stored=null;}
  };
  return {controller:SessionActions.createController(ports),ports,state,events,counts:()=>({applies,claims,clears,restores,exclusive}),chosen:()=>chosen};
}
for(const status of ['active','suspended'])for(const owner of ['inst_here','inst_other']){
  const old=session(status,owner),fixture=prepare(old);
  await fixture.controller.attemptAutoRestoreActiveSession();
  assert.equal(fixture.state.sessionPanelMode,'previous');
  assert.equal(fixture.counts().claims,0);assert.equal(fixture.counts().applies,0);
  assert.equal(await fixture.controller.continueSessionHere(),false);
  assert.equal(await fixture.controller.restoreSuspendedTodaySession(),false);
  assert.equal(fixture.counts().claims,0,'previous days never transfer ownership');
  assert.equal(fixture.counts().restores,0,'previous timers never restart');
  const acknowledged={...old,snapshot:{...old.snapshot,savedRevision:7}};
  const retired=prepare(acknowledged,{covered:true});await retired.controller.attemptAutoRestoreActiveSession();
  assert.equal(retired.counts().clears,1);assert.equal(retired.chosen(),null,'covered recovery retires before a dialog');
}
for(const owner of ['inst_here','inst_other']){
  const fixture=prepare(session('suspended',owner,today));
  assert.equal(await fixture.controller.restoreSuspendedTodaySession(),true);
  assert.equal(fixture.counts().claims,owner==='inst_other'?1:0);assert.equal(fixture.counts().restores,1);
}
const elsewhere=prepare(session('active','inst_other',today));
await elsewhere.controller.attemptAutoRestoreActiveSession();assert.equal(elsewhere.state.sessionPanelMode,'elsewhere');assert.equal(elsewhere.counts().claims,0);
for(const [owner,choice,changed] of [['inst_other','recover',false],['inst_other',null,false],['inst_here','discard',false],['inst_here','discard',true],['inst_here','recover',true]]){
  const original=session('active',owner),fixture=prepare(original,{choice,changeDuringChoice:changed});
  await fixture.controller.handlePreviousActiveSession(original);
  assert.equal(fixture.chosen().choices.some(row=>row.value==='discard'),owner==='inst_here');
  assert.equal(fixture.counts().applies,choice==='recover'&&!changed?1:0);
  assert.equal(fixture.counts().clears,choice==='discard'&&!changed?1:0);
  assert.equal(fixture.counts().exclusive,choice==='discard'&&!changed?1:0);
  if(changed)assert.ok(fixture.events.some(event=>typeof event==='string'&&event.includes('changed while')));
}

// Finish may announce success only after the canonical write; failures restore
// the captured evidence and never navigate as though the day was committed.
for(const failure of ['', 'write', 'readback']){
  const fixture=prepare(session('active','inst_here',today)),events=[],snapshot={date:today,contentRevision:7};
  const timer={mode:'ready',runtime:{startMs:null},currentIndex:0,emptyRuntime:()=>({startMs:null})};
  const controller=SessionActions.createController({...fixture.ports,
    runtime:{...fixture.ports.runtime,TASKS:[{kind:'work'}],TimerState:timer,TIMER_MODES:{DONE:'done',READY:'ready'},
      TimerEngine:{stopExecution:()=>events.push('stop')},PracticePacer:{pauseForSessionEnd:()=>events.push('pause')},
      setTimerMode:mode=>{timer.mode=mode;},resetBreakState(){}},
    isTrackableBlock:task=>task?.kind==='work',refreshCoreUi(){},goTab:tab=>events.push(tab),ReviewView:{refresh(){}},
    NoticeCoordinator:{begin:()=>({operationId:'finish',update:value=>events.push(value.lifecycle)})},notifyBackupChange:()=>events.push('backup'),
    ActiveSessionRuntime:{captureSnapshot:()=>snapshot,writeCanonicalNow:async()=>{events.push('write');if(failure)throw {message:`${failure} failed`};},
      rollbackLocalTransition:async(value,source)=>{assert.equal(value,snapshot);assert.equal(source,'finish-today-rollback');timer.mode='ready';events.push('rollback');}},
  });
  assert.equal(await controller.finishTodaySession(),!failure);
  assert.equal(events.includes('rollback'),!!failure);assert.equal(events.includes('review'),!failure);assert.equal(events.includes('succeeded'),!failure);assert.equal(events.includes('backup'),!failure);
  assert.equal(timer.mode,failure?'ready':'done');
  if(failure)assert.ok(fixture.events.some(message=>typeof message==='string'&&message.includes(`${failure} failed`)),'structured errors retain their useful message');
}

// A Save Today notice may disappear only after canonical Saved Day coverage
// proves it, including the same failure/race cases that previously exercised
// host-local reminder functions.
for(const spec of [
  {label:'acknowledged current session',current:true,ack:true,covered:true,want:true},
  {label:'newer Review feedback is preserved',current:true,ack:true,covered:true,newerStatus:true,want:true},
  {label:'current unacknowledged but evidence covered',current:true,ack:false,covered:true,want:true},
  {label:'current only in rescue',current:true,ack:true,rescue:true,covered:true,want:false},
  {label:'current Day missing',current:true,ack:true,covered:false,want:false},
  {label:'remote retirement with captured evidence',current:false,covered:true,want:true},
  {label:'remote retirement without evidence',current:false,evidence:false,covered:true,want:false},
  {label:'retained divergent session uncovered',current:false,covered:true,uncoveredReview:true,want:false},
  {label:'failed canonical Day read',current:false,covered:true,readFailure:true,want:false},
  {label:'local dirty with no runtime proof',current:true,ack:true,covered:true,dirty:true,want:false},
  {label:'dirty counter but live evidence covered',current:true,ack:false,covered:true,dirty:true,runtime:true,want:true},
  {label:'new unsaved live evidence remains',current:true,ack:true,covered:true,dirty:true,runtime:true,runtimeUncovered:true,want:false},
  {label:'null capture, retired canonical session, live work covered',current:false,evidence:false,runtime:true,dirty:true,covered:true,want:true},
  {label:'canonical session changed during readback',current:true,ack:true,covered:true,postReadDrift:true,want:false}
]){
  const snapshot={contentRevision:7,savedRevision:spec.ack?7:0},current=spec.current?{date:day,status:'active',snapshot}:null;
  const captured=spec.evidence===false?null:{date:day,snapshot:{contentRevision:7,savedRevision:0}};
  const dayRecord=spec.covered?{date:day,recordKind:'study',reflection:'Saved'}:null;
  const trial=createSavedDayFixture({
    date:day,studyDate:day,contentRevision:7,savedRevision:spec.dirty?6:7,
    tasks:spec.runtime?[{kind:'work'}]:[],active:current,activeInIdb:!spec.rescue,dayRecord,
    reminder:true,reminderEvidence:captured,safetyMessage:'Review reminder: historical work is unsaved',
    liveSnapshot:spec.runtime?()=>({date:day,uncovered:!!spec.runtimeUncovered}):null,
    pendingReviews:spec.uncoveredReview?[{subject:'session',resolvedAt:'',kept:{date:day,uncovered:true}}]:[],
    dayReadFailure:!!spec.readFailure,staleSaveStatus:!spec.newerStatus,
    activeValue:spec.postReadDrift?(read,value)=>read>1?{...value,snapshot:{...snapshot,uncovered:true}}:value:undefined,
    coverage:(record,value)=>!!record&&record.date===value?.date&&!value?.uncovered&&!value?.snapshot?.uncovered
  });
  assert.equal(await trial.coordinator.revalidateSaveReminder(),spec.want,spec.label);
  assert.equal(trial.day.reminder.date,spec.want?'':day,spec.label+' reminder state');
  assert.equal(trial.state().safety==='',spec.want,spec.label+' visible warning');
  const verifies=trial.events.filter(event=>event[0]==='verify').length;
  assert.equal(verifies,spec.want||spec.postReadDrift?1:0,spec.label+' canonical Day verification');
  const statusClears=trial.events.filter(event=>event[0]==='status'&&event[1]==='save-status'&&event[2]==='').length;
  assert.equal(statusClears,spec.want&&!spec.newerStatus?1:0,spec.label+' stale inline status');
}

// A concurrent newer reminder on the same date cannot be dismissed by an
// earlier read-back. The generation token, not nullable evidence, fences it.
{
  let resume,enteredResolve;
  const blocked=new Promise(resolve=>{resume=resolve;});
  const entered=new Promise(resolve=>{enteredResolve=resolve;});
  const trial=createSavedDayFixture({
    date:day,studyDate:day,savedRevision:7,tasks:[],active:{date:day,status:'active',snapshot:{contentRevision:7,savedRevision:7}},
    dayRecord:{date:day,recordKind:'study'},reminder:true,reminderEvidence:null,reminderGeneration:4,
    safetyMessage:'Review reminder: keep my latest study work',coverage:()=>true,
    verifyDaily:async()=>{enteredResolve();await blocked;}
  });
  const pending=trial.coordinator.revalidateSaveReminder();await entered;
  trial.day.reminder.generation+=1;trial.day.reminder.evidence={date:day,snapshot:{newer:true}};resume();
  assert.equal(await pending,false);assert.equal(trial.day.reminder.date,day);assert.equal(trial.day.reminder.generation,5);
  assert.ok(trial.state().safety.startsWith('Review reminder:'));
}

// Prompting uses the same canonical/live proof and captures only trustworthy
// same-date session evidence when a reminder really remains necessary.
for(const spec of [
  {name:'unacknowledged canonical session fully covered',dirty:false,runtime:true,want:true},
  {name:'dirty counter but matching live work',dirty:true,runtime:true,want:true},
  {name:'dirty with no live evidence',dirty:true,runtime:false,want:false},
  {name:'live work diverges from saved evidence',dirty:true,runtime:true,uncovered:true,want:false},
  {name:'pending divergent kept session',dirty:false,runtime:true,uncoveredReview:true,want:false},
  {name:'canonical read unavailable',dirty:false,runtime:true,invalidRead:true,want:false}
]){
  const trial=createSavedDayFixture({
    date:day,studyDate:day,contentRevision:7,savedRevision:spec.dirty?6:7,tasks:spec.runtime?[{kind:'work'}]:[],
    active:{date:day,status:'active',snapshot:{contentRevision:7,savedRevision:0}},activeReadFailure:!!spec.invalidRead,
    dayRecord:{date:day,recordKind:'study'},liveSnapshot:spec.runtime?()=>({date:day,uncovered:!!spec.uncovered}):null,
    pendingReviews:spec.uncoveredReview?[{subject:'session',resolvedAt:'',kept:{date:day,uncovered:true}}]:[],
    coverage:(record,value)=>!!record&&record.date===value?.date&&!value?.uncovered&&!value?.snapshot?.uncovered
  });
  assert.equal(await trial.coordinator.savedRecordExistsForDate(day),spec.want,spec.name);
}

for(const [label,canonicalReady,revisionMatches,runtimeReady,expectedEvidence] of [
  ['canonical and matching',true,true,false,true],
  ['rescue-only without live evidence',false,true,false,false],
  ['rescue-only with live evidence',false,true,true,true],
  ['lagging canonical without live evidence',true,false,false,false],
  ['lagging canonical with live evidence',true,false,true,true]
]){
  const record={date:day,status:'active',snapshot:{contentRevision:revisionMatches?7:6,savedRevision:0}};
  const trial=createSavedDayFixture({
    date:day,studyDate:day,contentRevision:7,savedRevision:6,tasks:[{kind:'work'}],active:record,activeInIdb:canonicalReady,
    dayRecord:null,liveSnapshot:runtimeReady?()=>({date:day,contentRevision:7}):null,coverage:()=>false
  });
  await trial.coordinator.promptSaveToday();
  assert.equal(!!trial.day.reminder.evidence,expectedEvidence,label);
  if(runtimeReady&&!canonicalReady)assert.equal(trial.day.reminder.evidence.scheduleText,'valid plan','memory-only evidence keeps authored schedule');
  assert.equal(trial.day.reminder.date,day,label+' still displays an honest reminder');
}

// Historical Review never reaches the rollover service; active Review does.
for(const mode of ['previous','active']){
  const trial=createSavedDayFixture({date:day,panel:mode,rolloverResult:true});
  assert.equal(await trial.coordinator.handleStudyDayRollover(),mode!=='previous');
  assert.equal(trial.events.some(event=>event[0]==='service-rollover'),mode!=='previous');
  assert.equal(trial.events.some(event=>event[0]==='rollover'),mode!=='previous');
}

console.log(JSON.stringify({status:'PASS',suite:'previous-day-convergence',
  scenarios:'previous-day routing, remote ownership, stored review actions, stale decisions, strict discard, save notice convergence, captured evidence'}));
