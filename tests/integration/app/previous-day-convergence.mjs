import {readHostHtml} from '../../../build/host-source.mjs';
import {readRuntimeSource} from '../../helpers/runtime-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=readHostHtml();
function production(signature){
  const start=app.indexOf(signature),end=start<0?-1:app.indexOf('\n}',start);
  assert.ok(start>=0&&end>start,'Production function missing: '+signature);
  return app.slice(start,end+2);
}
const reminderLive=production('function liveSaveReminderEvidence(date){');
const reminderCovers=production('function savedDayCoversReminderEvidence(record,subjects){');
const reminderPending=production('async function savedDayHasUncoveredKeptSession(record,date){');
const coversWork=production('async function savedDayCoversWork(date,captured=null){');
const savedExists=production('async function savedRecordExistsForDate(date){');
const reminder=production('async function revalidateSaveReminderAfterCanonicalConvergence(){');
const prompt=production('async function promptSaveToday(){');
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
// proves it: after a current acknowledged session, or after sync retired
// the old session without leaving an uncovered divergent review version.
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
  let verified=0,statusClears=0,activeReads=0;
  const snapshot={contentRevision:7,savedRevision:spec.ack?7:0};
  const current=spec.current?{date:day,snapshot}:null;
  const evidence=spec.evidence===false?null:{date:day,snapshot:{contentRevision:7,savedRevision:0}};
  const record={date:day,recordKind:'study'};
  const context=vm.createContext({
    saveReminderDate:day,saveReminderEvidence:evidence,saveReminderGeneration:1,
    sessionSafetyMessage:'Review reminder: historical work is unsaved',
    daySaveDirty:()=>!!spec.dirty,
    TASKS:spec.runtime?[{}]:[],
    isTrackableBlock:()=>true,TimerState:{studyDate:day},getReviewDate:()=>day,
    PlanRuntime:{appliedScheduleText:()=> 'valid plan'},
    captureSessionSnapshot:()=>({date:day,uncovered:!!spec.runtimeUncovered}),
    cleanDayRevision:value=>Number(value)||0,
    AppData:{
      activeSession:{load:async()=>({ok:true,value:++activeReads>1&&spec.postReadDrift
        ?{date:day,snapshot:{...snapshot,uncovered:true}}:current,storage:{idb:!spec.rescue}})},
      dailyRecords:{
        documents:async()=>{if(spec.readFailure)throw new Error('Canonical IndexedDB read failed');return spec.covered?[record]:[];},
        verifyCanonical:async()=>{verified++;return true;}
      },
      pendingReviews:{list:async()=>spec.uncoveredReview?[{
        subject:'session',resolvedAt:'',kept:{date:day,uncovered:true}
      }]:[]}
    },
    DailyRecordCodec:{savedDayCoversSessionEvidence:(stored,value)=>{
      return !!stored&&stored.date===value.date&&!value.uncovered&&!value.snapshot?.uncovered;
    }},
    clearSessionSafetyMessage:()=>{context.sessionSafetyMessage='';},
    NoticeCoordinator:{eventStatus:()=>({events:[{source:'review',id:'status-save-status',
      message:spec.newerStatus?'Newer user feedback':'Review is ready. Save today to Library when you are done.'}]})},
    setStatus:(id,message)=>{assert.equal(id,'save-status');assert.equal(message,'');statusClears++;},
    AppDiagnostics:{capture:()=>{}}
  });
  vm.runInContext([reminderLive,reminderCovers,reminderPending,coversWork,reminder,
    'globalThis.revalidate=revalidateSaveReminderAfterCanonicalConvergence;'].join('\n'),context);
  assert.equal(await context.revalidate(),spec.want,spec.label);
  assert.equal(context.saveReminderDate,spec.want?'':day,spec.label+' reminder state');
  assert.equal(context.sessionSafetyMessage==='',spec.want,spec.label+' visible warning');
  assert.equal(verified,spec.want||spec.postReadDrift?1:0,spec.label+' canonical Day verification');
  assert.equal(statusClears,spec.want&&!spec.newerStatus?1:0,spec.label+' stale inline status');
}

// A concurrent newer reminder on the same study date cannot be dismissed
// by an earlier canonical read-back. Null evidence is not a unique token.
{
  let resumeVerification,verificationEntered;
  const blockingVerification=new Promise(resolve=>{resumeVerification=resolve;});
  const entered=new Promise(resolve=>{verificationEntered=resolve;});
  const dayRecord={date:day,recordKind:'study'};
  const ctx=vm.createContext({
    saveReminderDate:day,saveReminderEvidence:null,saveReminderGeneration:4,
    sessionSafetyMessage:'Review reminder: keep my latest study work',
    daySaveDirty:()=>false,TASKS:[],TimerState:{studyDate:day},
    getReviewDate:()=>day,isTrackableBlock:()=>true,
    AppData:{
      activeSession:{load:async()=>({ok:true,value:{date:day,snapshot:{}},storage:{idb:true}})},
      dailyRecords:{documents:async()=>[dayRecord],verifyCanonical:async()=>{verificationEntered();await blockingVerification;}},
      pendingReviews:{list:async()=>[]}
    },
    DailyRecordCodec:{savedDayCoversSessionEvidence:()=>true},
    clearSessionSafetyMessage:()=>{ctx.sessionSafetyMessage='';},
    NoticeCoordinator:{eventStatus:()=>({events:[]})},
    setStatus:()=>{throw new Error('newer reminder status should never be cleared');},
    AppDiagnostics:{capture:()=>{}}
  });
  vm.runInContext([reminderLive,reminderCovers,reminderPending,coversWork,reminder,
    'globalThis.revalidate=revalidateSaveReminderAfterCanonicalConvergence;'].join('\n'),ctx);
  const oldRevalidation=ctx.revalidate();
  await entered;
  ctx.saveReminderGeneration+=1;
  ctx.saveReminderEvidence={date:day,snapshot:{newer:true}};
  resumeVerification();
  assert.equal(await oldRevalidation,false,'new same-day notice must invalidate earlier read-back');
  assert.equal(ctx.saveReminderDate,day);
  assert.equal(ctx.saveReminderGeneration,5);
  assert.ok(ctx.sessionSafetyMessage.startsWith('Review reminder:'));
}

// A subsequent Save Today prompt uses the same canonical/live proof instead
// of repeating a stale warning when a cross-device Saved Day covers the work.
for(const spec of [
  {name:'unacknowledged canonical session fully covered',dirty:false,runtime:true,want:true},
  {name:'dirty counter but matching live work',dirty:true,runtime:true,want:true},
  {name:'dirty with no live evidence',dirty:true,runtime:false,want:false},
  {name:'live work diverges from saved evidence',dirty:true,runtime:true,uncovered:true,want:false},
  {name:'pending divergent kept session',dirty:false,runtime:true,uncoveredReview:true,want:false},
  {name:'canonical read unavailable',dirty:false,runtime:true,invalidRead:true,want:false}
]){
  let verifies=0;
  const ctx=vm.createContext({
    TASKS:spec.runtime?[{}]:[],isTrackableBlock:()=>true,
    TimerState:{studyDate:day},getReviewDate:()=>day,daySaveDirty:()=>spec.dirty,
    PlanRuntime:{appliedScheduleText:()=> 'valid plan'},
    captureSessionSnapshot:()=>({date:day,uncovered:!!spec.uncovered}),
    AppData:{
      activeSession:{load:async()=>({ok:!spec.invalidRead,error:spec.invalidRead?new Error('read failure'):null,
        storage:{idb:true},value:{date:day,snapshot:{contentRevision:5,savedRevision:0}}})},
      dailyRecords:{documents:async()=>[{date:day}],verifyCanonical:async()=>{verifies++;return true;}},
      pendingReviews:{list:async()=>spec.uncoveredReview?[{subject:'session',resolvedAt:'',kept:{date:day,uncovered:true}}]:[]}
    },
    DailyRecordCodec:{savedDayCoversSessionEvidence:(record,value)=>
      !!record&&record.date===value.date&&!value.uncovered&&!value.snapshot?.uncovered},
    AppDiagnostics:{capture:()=>{}}
  });
  vm.runInContext([reminderLive,reminderCovers,reminderPending,coversWork,savedExists,
    'globalThis.checkSaved=savedRecordExistsForDate;'].join('\n'),ctx);
  assert.equal(await ctx.checkSaved(day),spec.want,spec.name);
  assert.equal(verifies,spec.want?1:0,spec.name+' canonical readback');
}

// Captured notice evidence must be a committed same-date session with a
// matching local content revision. A failed/partial canonical read can never
// become proof used later to dismiss an alert.
for(const [label,canonicalReady,revisionMatches,runtimeReady,expectedEvidence] of [
  ['canonical and matching',true,true,false,true],
  ['rescue-only without live evidence',false,true,false,false],
  ['rescue-only with live evidence',false,true,true,true],
  ['lagging canonical without live evidence',true,false,false,false],
  ['lagging canonical with live evidence',true,false,true,true]
]){
  const record={date:day,snapshot:{contentRevision:7}};
  const ctx=vm.createContext({
    TASKS:[{}],isTrackableBlock:()=>true,
    getReviewDate:()=>day,savedRecordExistsForDate:async()=>false,
    saveReminderDate:'',saveReminderEvidence:null,saveReminderGeneration:0,
    TimerState:{studyDate:day,contentRevision:7},
    cleanDayRevision:v=>Number(v)||0,
    PlanRuntime:{appliedScheduleText:()=> 'valid plan'},
    captureSessionSnapshot:()=>runtimeReady?{date:day,contentRevision:7}:null,
    AppData:{activeSession:{load:async()=>({
      ok:true,storage:{idb:canonicalReady},value:revisionMatches?record:{...record,snapshot:{contentRevision:6}}
    })}},
    ActiveSessionCodec:{sanitizeCurrent:v=>v},
    AppDiagnostics:{capture:()=>{}},
    prettyDate:v=>v,refreshStorageFallbackWarning:()=>{},
    notifyUser:()=>{},setStatus:()=>{},setReviewDetailDisclosures:()=>{},
    sessionSafetyMessage:''
  });
  vm.runInContext(reminderLive+'\n'+prompt+'\nglobalThis.prompt=promptSaveToday;',ctx);
  await ctx.prompt();
  assert.equal(!!ctx.saveReminderEvidence,expectedEvidence,label);
  if(runtimeReady&&!canonicalReady)assert.equal(ctx.saveReminderEvidence.scheduleText,'valid plan','memory-only evidence keeps authored schedule');
  assert.equal(ctx.saveReminderDate,day,label+' still displays an honest reminder');
}

// Historical Review keeps yesterday's date deliberately. Neither the
// second-by-second shell clock nor the timer's rollover callback may auto-save
// or close it before the person has reviewed the evidence.
{
  const clock=production('function tickClock(){');
  const rollover=production('async function handleStudyDayRollover(...args){');
  for(const mode of ['previous','active']){
    let clockRollover=0,serviceRollover=0,announced=0;
    const ctx=vm.createContext({
      sessionPanelMode:mode,
      document:{getElementById:()=>null},
      setTextSafe:()=>{},todayISO:()=>today,
      studyDayRolledOver:()=>true,
      handleStudyDayRollover:()=>{clockRollover++;},
      maybePromptScheduleEndSave:()=>{},maybePromptBackupNudge:()=>{},
      maybeAutoStartScheduledBlock:()=>true,
      ReviewSaveService:{handleRollover:async()=>{serviceRollover++;return true;}},
      AppActivation:{publish:()=>{announced++;}},
      APP_ACTIVATION_KINDS:{DATE_ROLLOVER:'date-rollover'}
    });
    vm.runInContext(clock+'\nglobalThis.clock=tickClock;',ctx);
    ctx.clock();
    assert.equal(clockRollover,mode==='previous'?0:1,
      mode+' clock must not schedule an automatic historical Review save');

    vm.runInContext(rollover+'\nglobalThis.rollover=handleStudyDayRollover;',ctx);
    assert.equal(await ctx.rollover(),mode!=='previous');
    assert.equal(serviceRollover,mode==='previous'?0:1,'historical Review must not reach automatic rollover service');
    assert.equal(announced,mode==='previous'?0:1,'no premature destructive rollover broadcast');
  }
}

console.log(JSON.stringify({status:'PASS',suite:'previous-day-convergence',
  scenarios:'previous-day routing, remote ownership, stored review actions, stale decisions, strict discard, save notice convergence, captured evidence'}));
