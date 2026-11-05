import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync('source/app.html','utf8');
function production(signature){
  const start=app.indexOf(signature),end=start<0?-1:app.indexOf('\n}',start);
  assert.ok(start>=0&&end>start,'Production function missing: '+signature);
  return app.slice(start,end+2);
}
const previous=production('function isPreviousActiveSessionRecord(session){');
const restore=production('async function attemptAutoRestoreActiveSession(){');
const choose=production('async function handlePreviousActiveSession(session){');
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
    pendingSessionHandoffSafety:()=>false,
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
  {label:'current not acknowledged',current:true,ack:false,covered:true,want:false},
  {label:'current only in rescue',current:true,ack:true,rescue:true,covered:true,want:false},
  {label:'current Day missing',current:true,ack:true,covered:false,want:false},
  {label:'remote retirement with captured evidence',current:false,covered:true,want:true},
  {label:'remote retirement without evidence',current:false,evidence:false,covered:true,want:false},
  {label:'retained divergent session uncovered',current:false,covered:true,uncoveredReview:true,want:false},
  {label:'failed canonical Day read',current:false,covered:true,readFailure:true,want:false},
  {label:'local work changed',current:true,ack:true,covered:true,dirty:true,want:false}
]){
  let verified=0;
  const snapshot={contentRevision:7,savedRevision:spec.ack?7:0};
  const current=spec.current?{date:day,snapshot}:null;
  const evidence=spec.evidence===false?null:{date:day,snapshot:{contentRevision:7,savedRevision:0}};
  const record={date:day,recordKind:'study'};
  const context=vm.createContext({
    saveReminderDate:day,saveReminderEvidence:evidence,
    sessionSafetyMessage:'Review reminder: historical work is unsaved',
    daySaveDirty:()=>!!spec.dirty,
    cleanDayRevision:value=>Number(value)||0,
    AppData:{
      activeSession:{load:async()=>({ok:true,value:current,storage:{idb:!spec.rescue}})},
      dailyRecords:{
        documents:async()=>{if(spec.readFailure)throw new Error('Canonical IndexedDB read failed');return spec.covered?[record]:[];},
        verifyCanonical:async()=>{verified++;return true;}
      },
      pendingReviews:{list:async()=>spec.uncoveredReview?[{
        subject:'session',resolvedAt:'',kept:{date:day,uncovered:true}
      }]:[]}
    },
    DailyRecordCodec:{savedDayCoversSessionEvidence:(stored,value)=>{
      return !!stored&&stored.date===value.date&&!value.uncovered;
    }},
    clearSessionSafetyMessage:()=>{context.sessionSafetyMessage='';},
    AppDiagnostics:{capture:()=>{}}
  });
  vm.runInContext(reminder+'\nglobalThis.revalidate=revalidateSaveReminderAfterCanonicalConvergence;',context);
  assert.equal(await context.revalidate(),spec.want,spec.label);
  assert.equal(context.saveReminderDate,spec.want?'':day,spec.label+' reminder state');
  assert.equal(context.sessionSafetyMessage==='',spec.want,spec.label+' visible warning');
  assert.equal(verified,spec.want?1:0,spec.label+' canonical Day verification');
}

// Captured notice evidence must be a committed same-date session with a
// matching local content revision. A failed/partial canonical read can never
// become proof used later to dismiss an alert.
for(const [label,canonicalReady,revisionMatches,expectedEvidence] of [
  ['canonical and matching',true,true,true],
  ['rescue-only session',false,true,false],
  ['lagging canonical session',true,false,false]
]){
  const record={date:day,snapshot:{contentRevision:7}};
  const ctx=vm.createContext({
    TASKS:[{}],isTrackableBlock:()=>true,
    getReviewDate:()=>day,savedRecordExistsForDate:async()=>false,
    saveReminderDate:'',saveReminderEvidence:null,
    TimerState:{studyDate:day,contentRevision:7},
    cleanDayRevision:v=>Number(v)||0,
    AppData:{activeSession:{load:async()=>({
      ok:true,storage:{idb:canonicalReady},value:revisionMatches?record:{...record,snapshot:{contentRevision:6}}
    })}},
    ActiveSessionCodec:{sanitizeCurrent:v=>v},
    AppDiagnostics:{capture:()=>{}},
    prettyDate:v=>v,refreshStorageFallbackWarning:()=>{},
    notifyUser:()=>{},setStatus:()=>{},setReviewDetailDisclosures:()=>{},
    sessionSafetyMessage:''
  });
  vm.runInContext(prompt+'\nglobalThis.prompt=promptSaveToday;',ctx);
  await ctx.prompt();
  assert.equal(!!ctx.saveReminderEvidence,expectedEvidence,label);
  assert.equal(ctx.saveReminderDate,day,label+' still displays an honest reminder');
}

console.log(JSON.stringify({status:'PASS',suite:'previous-day-convergence',
  scenarios:'previous-day routing, remote ownership, stored review actions, stale decisions, strict discard, save notice convergence, captured evidence'}));
