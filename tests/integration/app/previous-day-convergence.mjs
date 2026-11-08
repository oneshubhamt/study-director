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
const previous=production('function isPreviousActiveSessionRecord(session){');
const continueHere=production('async function continueSessionHere(){');
const restoreSuspended=production('async function restoreSuspendedTodaySession(){');
const restore=production('async function attemptAutoRestoreActiveSession(){');
const choose=production('async function handlePreviousActiveSession(session){');
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
const validSession=s=>!!s&&s.id==='current'&&s.date<today;
const canonical=x=>x||null;

// The actual startup router must reach previous-day handling BEFORE foreign
// ownership or today's suspended-state handlers, and retire covered rows first.
for(const [label,state,covered,expected] of [
  ['old local active',session('active'),false,'previous'],
  ['old local suspended',session('suspended'),false,'previous'],
  ['old remote active',session('active','inst_other'),false,'previous'],
  ['old remote suspended',session('suspended','inst_other'),false,'previous'],
  ['covered old remote active',session('active','inst_other'),true,'retired'],
  ['today remote active',session('active','inst_other',today),false,'elsewhere']
]){
  const events=[];
  const context=vm.createContext({
    TASKS:[],PlanScheduleGateway:{hasLiveState:()=>false},
    loadActiveSessionForRestore:async()=>state,
    isValidIsoDate:()=>true,todayISO:()=>today,
    isCanonicalScheduleText:()=>true,activeSessionSnapshot:()=>state.snapshot,
    DATA_CONTRACT:{schemas:{ActiveSession:{version:10}}},ACTIVE_SESSION_ID:'current',
    retireCoveredPreviousActiveSession:async()=>{if(covered)events.push('retired');return covered;},
    sessionRunsElsewhere:x=>x.status!=='suspended'&&x.runningOn!=='inst_here',
    handlePreviousActiveSession:async()=>{events.push('previous');return false;},
    setSessionPanelMode:mode=>events.push(mode),
    isSuspendedActiveSession:()=>false,isRestorableActiveSession:()=>false,
    AppDiagnostics:{capture:()=>{}}
  });
  vm.runInContext(previous+'\n'+restore+'\nglobalThis.restore=attemptAutoRestoreActiveSession;',context);
  await context.restore();
  assert.equal(events.at(-1),expected,label+' must not restart or transfer historical work');
}

// Continue Here classifies the canonical record's date before any Continue
// Here or Restore path.
for(const status of ['active','suspended'])for(const owner of ['inst_here','inst_other']){
  const current=session(status,owner,day),events=[],handoff={step:'',error:''};
  const ctx=vm.createContext({
    appCanMutate:()=>true,sessionHandoff:handoff,
    setSessionHandoff:(step='',error='')=>{handoff.step=step;handoff.error=error;},
    NoticeCoordinator:{resolveEvent:()=>{}},
    AppData:{activeSession:{load:async()=>({ok:true,value:current,storage:{idb:true}})}},
    isValidIsoDate:()=>true,todayISO:()=>today,isCanonicalScheduleText:()=>true,
    activeSessionSnapshot:s=>s?.snapshot,
    DATA_CONTRACT:{schemas:{ActiveSession:{version:10}}},ACTIVE_SESSION_ID:'current',
    sessionFromElsewhere:s=>s.runningOn!=='inst_here',
    sessionRunsElsewhere:s=>s.status!=='suspended'&&s.runningOn!=='inst_here',
    setSessionPanelMode:mode=>events.push(mode),setPlanStatus:()=>{},
    attemptAutoRestoreActiveSession:async()=>{events.push('timer');return true;},
    restoreSuspendedTodaySession:async()=>{events.push('restore');return true;},
    confirmSessionTakeover:async()=>true,
    transferSessionOwnershipHere:async()=>{events.push('claim');return {previous:current,session:current};},
    AppDiagnostics:{capture:()=>{}},sessionHandoffProblem:e=>String(e?.message||e),
    Interactions:{notify:()=>{}},navigator:{onLine:true}
  });
  vm.runInContext(previous+'\n'+continueHere+'\nglobalThis.continueOld=continueSessionHere;',ctx);
  assert.equal(await ctx.continueOld(),false,status+' / '+owner+' must not continue a historical timer');
  assert.ok(events.includes('previous'),'historical session must remain visible for Review');
  assert.ok(!events.some(e=>['timer','restore','claim','elsewhere'].includes(e)),'no today-only execution');
}

// Restore Session does the same, and keeps today's routing.
for(const [label,stored,expected] of [
  ['previous day, here',session('suspended','inst_here',day),'previous'],
  ['previous day, elsewhere',session('suspended','inst_other',day),'previous'],
  ['previous day, active',session('active','inst_here',day),'previous'],
  ['today, here',session('suspended','inst_here',today),'restore'],
  ['today, elsewhere',session('suspended','inst_other',today),'claim']
]){
  const events=[];
  const ctx=vm.createContext({
    appCanMutate:()=>true,
    AppData:{activeSession:{load:async()=>({ok:true,value:stored,storage:{idb:true}})}},
    isValidIsoDate:()=>true,todayISO:()=>today,isCanonicalScheduleText:()=>true,
    DATA_CONTRACT:{schemas:{ActiveSession:{version:10}}},ACTIVE_SESSION_ID:'current',
    isSuspendedActiveSession:s=>s?.status==='suspended'&&s.date===today,
    sessionFromElsewhere:s=>s?.runningOn!=='inst_here',
    setSessionPanelMode:mode=>events.push(mode),setPlanStatus:()=>{},
    attemptAutoRestoreActiveSession:async()=>{events.push('timer');return true;},
    continueSessionHere:async()=>{events.push('claim');return true;},
    activeSessionSnapshot:()=>({}),
    applyStoredSessionSnapshot:()=>{events.push('restore');return true;},
    goTab:async()=>{},Interactions:{notify:()=>{}}
  });
  vm.runInContext(previous+'\n'+restoreSuspended+'\nglobalThis.restoreStored=restoreSuspendedTodaySession;',ctx);
  await ctx.restoreStored();
  assert.ok(events.includes(expected),label+' routes to '+expected);
  const others=['previous','restore','claim','timer','none'].filter(e=>e!==expected);
  assert.ok(!events.some(e=>others.includes(e)),label+' takes no other path');
}

// The choice dialog must expose a safe local recovery for a remote-owned
// previous day, retain a repeatable "keep stored" path, and reject changes
// during an outstanding decision.
for(const [label,owner,selection,mutated,expected] of [
  ['remote recover','inst_other','recover',false,'recover'],
  ['remote keep','inst_other','keep',false,'previous'],
  ['local keep','inst_here','keep',false,'previous'],
  ['stale decision','inst_here','recover',true,'changed'],
  ['local discard','inst_here','discard',false,'discarded']
]){
  const original=session('active',owner),events=[];
  let stored=original,clears=0;
  const context=vm.createContext({
    isPreviousActiveSessionRecord:validSession,
    sessionFromElsewhere:x=>x.runningOn!=='inst_here',
    Interactions:{
      choose:async options=>{
        assert.match(options.message,/will not restart yesterday.s timer or transfer ownership/u);
        assert.equal(options.choices.some(row=>row.value==='discard'),owner==='inst_here',
          'the remote owner must not be offered local session destruction');
        if(mutated)stored={...original,revision:8};
        return selection;
      },
      notify:()=>events.push('notify')
    },
    AppData:{activeSession:{
      load:async(_retry,options)=>{assert.equal(options.strict,true);return {ok:true,value:stored,storage:{idb:!!stored}};},
      clear:async()=>{clears++;stored=null;return {ok:true,value:null,storage:{idb:true}};}
    }},
    ActiveSessionCodec:{sanitizeCurrent:canonical},
    CanonicalModule:{same:(a,b)=>JSON.stringify(a)===JSON.stringify(b)},
    AppMutationCoordinator:{runExclusive:async(_kind,operation)=>operation()},
    retireCoveredPreviousActiveSession:async()=>false,
    recoverPreviousSessionForReview:async()=>{events.push('recover');return true;},
    setPlanStatus:value=>{if(value.includes('changed while'))events.push('changed');else if(value.includes('Discarded'))events.push('discarded');},
    setSessionPanelMode:mode=>events.push(mode),
    handleActiveSessionRepositoryResult:()=>{},
    prettyDate:x=>x,refreshStorageFallbackWarning:()=>{},
    sessionSafetyMessage:''
  });
  vm.runInContext(choose+'\nglobalThis.choosePrevious=handlePreviousActiveSession;',context);
  await context.choosePrevious(original);
  assert.ok(events.includes(expected),label+' must preserve its decision semantics');
  assert.equal(clears,selection==='discard'&&!mutated?1:0,label+' cannot delete implicitly');
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
