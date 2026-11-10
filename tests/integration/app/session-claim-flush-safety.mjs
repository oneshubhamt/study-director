import {readHostHtml} from '../../../build/host-source.mjs';
import {readRuntimeSource} from '../../helpers/runtime-source.mjs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const source=readHostHtml();
function productionFunction(name){
  const start=source.indexOf(name),end=start<0?-1:source.indexOf('\n}',start);
  assert.ok(start>=0&&end>start, 'Production function missing: '+name);
  return source.slice(start,end+2);
}

// Distributed ownership, claim freezing, Continue Here, compensation and
// yield now belong to the checked P5.4C session-handoff runtime and are
// exercised in session-handoff-runtime.mjs plus browser handoff journeys.
// This file retains only the still-distinct canonical persistence regressions.

// Saved-Day acknowledgement integrates with the P5.4B canonical session owner:
 // the host may advance savedRevision only after the checked strict write succeeds.
{
  const src=[
    productionFunction('async function acknowledgeSavedStudyDay(date,revision){'),
    productionFunction('function clearCanonicalSessionAfterSavedDay(){')
  ].join('\n');
  const date='2026-08-27';
  const prepare=(failure='')=>{
    let acknowledged=0,clears=0,writes=0;
    const sessionState={savedRevision:0,contentRevision:7,studyDate:date};
    const context=vm.createContext({
      TASKS:[{}],TimerState:sessionState,
      getReviewDate:()=>date,
      cleanDayRevision:value=>Math.max(0,Math.floor(Number(value)||0)),
      clearSaveReminder:()=>{acknowledged++;},
      ActiveSessionRuntime:{
        writeCanonicalNow:async(operation,options)=>{
          writes++;assert.equal(operation,'acknowledging the Saved Day');assert.equal(options.markChanged,false);
          if(failure==='write-failure')throw new Error('IndexedDB unavailable');
          const savedRevision=failure==='mismatched-write'?Math.max(0,sessionState.savedRevision-1):sessionState.savedRevision;
          return {ok:true,value:{date,snapshot:{savedRevision}},storage:{idb:true}};
        },
        clearCanonical:async operation=>{
          clears++;assert.equal(operation,'clearing the saved study session');
          if(failure==='clear-failure')throw new Error('IndexedDB unavailable');
          return {ok:true,value:null,storage:{idb:true}};
        }
      },
      Object
    });
    vm.runInContext(src+'\nglobalThis.ack=acknowledgeSavedStudyDay;globalThis.clearDay=clearCanonicalSessionAfterSavedDay;',context);
    return {ack:()=>context.ack(date,7),clear:()=>context.clearDay(),state:()=>({saved:sessionState.savedRevision,acknowledged,clears,writes})};
  };
  const good=prepare();assert.equal(await good.ack(),true);
  assert.deepEqual(good.state(),{saved:7,acknowledged:1,clears:0,writes:1});
  for(const fault of ['write-failure','mismatched-write']){
    const trial=prepare(fault);
    await assert.rejects(trial.ack(),/IndexedDB unavailable|acknowledgement was not saved/u,fault);
    assert.equal(trial.state().saved,0,fault+' must not mark session revision saved');
    assert.equal(trial.state().acknowledged,0);
  }
  const cleared=prepare();await cleared.clear();assert.equal(cleared.state().clears,1);
  const failedClear=prepare('clear-failure');await assert.rejects(failedClear.clear(),/IndexedDB unavailable/u);assert.equal(failedClear.state().clears,1);
}
{
  // A successful reminder check must never survive a later canonical Day
  // replacement as an in-memory positive cache.
  const fn=[
    productionFunction('function liveSaveReminderEvidence(date){'),
    productionFunction('function savedDayCoversReminderEvidence(record,subjects){'),
    productionFunction('async function savedDayHasUncoveredKeptSession(record,date){'),
    productionFunction('async function savedDayCoversWork(date,captured=null){'),
    productionFunction('async function savedRecordExistsForDate(date){')
  ].join('\n');
  const date='2026-08-27',session={date,snapshot:{savedRevision:7,contentRevision:7}};
  let day={date,reflection:'Saved'},reads=0,coverageChecks=0;
  const context=vm.createContext({
    daySaveDirty:()=>false,cleanDayRevision:x=>Number(x),
    TASKS:[],isTrackableBlock:()=>false,TimerState:{studyDate:date},getReviewDate:()=>date,
    AppData:{
      activeSession:{load:async()=>({ok:true,value:session,storage:{idb:true}})},
      pendingReviews:{list:async()=>[]},
      dailyRecords:{documents:async()=>{reads++;return day?[day]:[];},
        verifyCanonical:async record=>{assert.equal(record,day);return true;}}
    },
    DailyRecordCodec:{savedDayCoversSessionEvidence:(value,sessionValue,options)=>{
      coverageChecks++;assert.equal(sessionValue,session);
      assert.equal(options.allowAdvances,true,'A later Day may cover the session without the same source revision');
      return value?.reflection==='Saved';
    }},
    AppDiagnostics:{capture:()=>false}
  });
  vm.runInContext(fn+'\nglobalThis.checkSavedDay=savedRecordExistsForDate;',context);
  assert.equal(await context.checkSavedDay(date),true);
  day={date,reflection:'Other content'};
  assert.equal(await context.checkSavedDay(date),false,
    'A replaced Saved Day with different evidence must not be hidden by an earlier positive read.');
  day=null;
  assert.equal(await context.checkSavedDay(date),false,
    'Deleting a previously verified Saved Day must be observed by the next reminder check.');
  assert.equal(reads,3,'Each discrete reminder check must reread canonical storage.');
  assert.equal(coverageChecks,3);
}
{
  // A successful repository write receipt is not sufficient if the strict
  // IDB read disagrees or the value exists only in local rescue storage.
  const repo=readRuntimeSource(new URL('../../../source/core/repositories.ts',import.meta.url));
  const start=repo.search(/async function verifyCanonicalDailyRecord\(record\s*\)\{/u),end=start<0?-1:repo.indexOf('\n}',start);
  assert.ok(start>=0&&end>start,'canonical Saved Day verifier must exist in production');
  const fn=repo.slice(start,end+2),record={date:'2026-08-27',recordKind:'study',sourceRevision:7,reflection:'Saved'};
  for(const actual of [record,{...record,reflection:'Unrelated'},null]){
    const context=vm.createContext({
      sanitizeCurrentDailyRecord:r=>r,
      idbGetRecord:async()=>actual,
      readableDailyRecord:r=>r,
      sameDataValue:(a,b)=>JSON.stringify(a)===JSON.stringify(b)
    });
    vm.runInContext(fn+'\nglobalThis.verify=verifyCanonicalDailyRecord;',context);
    if(actual===record)assert.equal(await context.verify(record),true);
    else await assert.rejects(context.verify(record),/read-back did not match/u);
  }
}

// BF-1R1: execute the real common Saved-Day evidence predicate and the
// previous-day retirement gate together. Revisions across devices are not
// content ancestry, and no local rescue copy is a canonical Saved Day.
{
  const sourceCodec=readRuntimeSource(new URL('../../../source/core/record-codecs.ts',import.meta.url));
  const start=sourceCodec.search(/function savedDayCoversSessionEvidence\(record\s*,session\s*,\{allowAdvances=false\}\s*=\{\}\)\s*\{/u),end=start<0?-1:sourceCodec.indexOf('\n}',start);
  assert.ok(start>=0&&end>start,'production Saved-Day coverage predicate must exist');
  const src=[sourceCodec.slice(start,end+2),productionFunction('async function savedDayCoversActiveSession(session){')].join('\n');
  const date='2026-08-27';
  const row={start:'07:00',duration:60,name:'Ethics',kind:'work',area:'Ethics',measure:'units',target:1,id:'ethics-1'};
  const task={completion:50,completionSource:'manual',progress:{done:1,total:2},actual:{seconds:300}};
  const snapshot={contentRevision:7,savedRevision:7,review:{reflection:'Reviewed',studyQuality:4},latestCarryForward:'',taskState:{'ethics-1':task},practice:{runs:[]}};
  const saved={recordKind:'study',date,sourceRevision:7,schedule:[row],practiceRuns:[],reflection:'Reviewed',studyQuality:4,carryForwardDraft:'',results:{'ethics-1':{completion:50,completionSource:'manual',done:1,total:2,actualSeconds:300}}};
  const session={date,scheduleText:'07:00 | 60 | Ethics | work | Ethics | units | 1',snapshot};
  const createContext=(record,snap,{rejectRead=false}={})=>{
    let checked=0;
    const ctx=vm.createContext({
      isPreviousActiveSessionRecord:()=>true,activeSessionSnapshot:()=>snap,
      AppData:{dailyRecords:{
        documents:async()=>record?[record]:[],
        verifyCanonical:async value=>{checked++;if(rejectRead)throw new Error('IndexedDB unavailable');assert.equal(value,record);return true;}
      }},
      AppDiagnostics:{capture:()=>{}},
      ScheduleModel:{
        parseText:()=>({ok:true,parsed:[{...row,dur:row.duration}]}),
        fingerprint:rows=>rows.map(r=>[r.start,r.dur,r.name,r.kind,r.area,r.measure,r.target].join('|')).join('|')
      },
      TimeModel:{studyMinuteToHHMM:()=> '08:00'},
      sameDataValue:(a,b)=>JSON.stringify(a)===JSON.stringify(b),
      Number,Object,Array
    });
    vm.runInContext(src+'\nconst DailyRecordCodec={savedDayCoversSessionEvidence};globalThis.covers=savedDayCoversActiveSession;globalThis.covered=savedDayCoversSessionEvidence;',ctx);
    return {ctx,checks:()=>checked};
  };
  const cases=[
    ['exact',saved,snapshot,true],
    ['different reflection',{...saved,reflection:'Different'},snapshot,false],
    ['different focus',{...saved,results:{'ethics-1':{...saved.results['ethics-1'],actualSeconds:200}}},snapshot,false],
    ['different saved-day revision',{...saved,sourceRevision:8},snapshot,true],
    ['later preserved progress',{...saved,sourceRevision:99,results:{'ethics-1':{...saved.results['ethics-1'],completion:75,done:2,actualSeconds:500}}},snapshot,true],
    ['different applied schedule',{...saved,schedule:[{...row,name:'Other Work'}]},snapshot,false],
    ['different practice evidence',saved,{...snapshot,practice:{runs:[{id:'unrecorded'}]}},false],
    ['unacknowledged session',saved,{...snapshot,savedRevision:6},false],
    ['unrecorded schedule adjustment',saved,{...snapshot,scheduleAdjustments:{'ethics-1':{startMin:240}}},false],
    ['covered schedule adjustment',{...saved,results:{'ethics-1':{...saved.results['ethics-1'],adjustedStart:'08:00'}}},{...snapshot,scheduleAdjustments:{'ethics-1':{startMin:240}}},true],
    ['unrecorded wall-clock evidence',saved,{...snapshot,taskState:{'ethics-1':{...task,actual:{...task.actual,clock:{startedAt:'2026-08-27T07:00:00.000Z'}}}}},false],
    ['missing day',null,snapshot,false]
  ];
  for(const [label,record,snap,expected] of cases){
    const {ctx,checks}=createContext(record,snap);
    assert.equal(await ctx.covers({...session,snapshot:snap}),expected,label);
    assert.equal(checks(),expected?1:0,label+' strict canonical receipt');
  }
  const verified=createContext(saved,snapshot,{rejectRead:true});
  assert.equal(await verified.ctx.covers(session),false,'emergency-only Saved Day cannot retire prior work');
  const richer={...saved,sourceRevision:99,results:{'ethics-1':{...saved.results['ethics-1'],completion:75,done:2,actualSeconds:500}}};
  const advanced=createContext(richer,snapshot);
  assert.equal(advanced.ctx.covered(richer,session,{allowAdvances:true}),true,'a genuinely continuing session may exceed the shared evidence without matching unrelated revisions');
  assert.equal(advanced.ctx.covered({...richer,results:{'ethics-1':{...richer.results['ethics-1'],actualSeconds:100}}},session,{allowAdvances:true}),false,'a Saved Day that drops previously recorded work does not cover the old session');
  assert.equal(advanced.ctx.covered({...richer,schedule:[{...row,name:'Different plan'}]},session,{allowAdvances:true}),false,'a same-date Saved Day for another schedule is not a safe retirement receipt');

  // BF-C6.2 (G): a verified Day may contain later finish time only when
  // the original start is unchanged AND the actual focus seconds increased.
  const clockStart='2026-08-27T07:00:00.000Z',clockEnd='2026-08-27T07:05:00.000Z';
  const timedSnapshot={...snapshot,taskState:{'ethics-1':{...task,actual:{
    seconds:300,clock:{startedAt:clockStart,endedAt:clockEnd}}}}};
  const extendedDay={...saved,results:{'ethics-1':{...saved.results['ethics-1'],
    actualStart:clockStart,actualEnd:'2026-08-27T07:09:00.000Z',actualSeconds:540}}};
  const timed=createContext(extendedDay,timedSnapshot);
  const oldTimedSession={...session,snapshot:timedSnapshot};
  assert.equal(timed.ctx.covered(extendedDay,oldTimedSession,{allowAdvances:true}),true,
    'an actual longer focus interval with the same start is covered');
  assert.equal(timed.ctx.covered({...extendedDay,results:{'ethics-1':{
    ...extendedDay.results['ethics-1'],actualSeconds:300}}},oldTimedSession,{allowAdvances:true}),false,
    'moving only the wall clock is not evidence of extended focus');
  assert.equal(timed.ctx.covered({...extendedDay,results:{'ethics-1':{
    ...extendedDay.results['ethics-1'],actualStart:'2026-08-27T07:01:00.000Z'}}},oldTimedSession,{allowAdvances:true}),false,
    'a changed start remains a different recorded interval');
  assert.equal(timed.ctx.covered({...extendedDay,results:{'ethics-1':{
    ...extendedDay.results['ethics-1'],actualEnd:'2026-08-27T07:04:00.000Z'}}},oldTimedSession,{allowAdvances:true}),false,
    'an earlier end is not a safe continuation');

  // A partial Practice Pacer record can grow into a completed run only with
  // an exact unit-prefix and identical identity, target and plan metadata.
  const priorRun={targetMs:60000,unitMs:[61000],partial:true,taskId:'ethics-1',totalUnits:3};
  const laterRun={targetMs:60000,unitMs:[61000,59000],taskId:'ethics-1',totalUnits:3};
  const practiceSnap={...snapshot,practice:{runs:[priorRun]}};
  const practiceDay={...saved,practiceRuns:[laterRun]};
  const practice=createContext(practiceDay,practiceSnap);
  const practiceSession={...session,snapshot:practiceSnap};
  assert.equal(practice.ctx.covered(practiceDay,practiceSession,{allowAdvances:true}),true,
    'later completed practice runs preserve prior partial units');
  assert.equal(practice.ctx.covered({...practiceDay,practiceRuns:[{...laterRun,unitMs:[62000,59000]}]},practiceSession,{allowAdvances:true}),false,
    'rewritten practice units never count as a continuation');
  assert.equal(practice.ctx.covered({...practiceDay,practiceRuns:[{...laterRun,targetMs:70000}]},practiceSession,{allowAdvances:true}),false,
    'a different practice pacing target is not the same run');
  const doubled={...snapshot,practice:{runs:[priorRun,priorRun]}};
  assert.equal(practice.ctx.covered(practiceDay,{...session,snapshot:doubled},{allowAdvances:true}),false,
    'one saved run cannot cover two distinct earlier records');
  // Exact matches are reserved ahead of overlapping partial prefixes, or
  // the first partial can steal the only complete-run match unnecessarily.
  const completedRun={...laterRun};
  const longerRun={...laterRun,unitMs:[61000,59000,57000]};
  const overlappingDay={...saved,practiceRuns:[completedRun,longerRun]};
  const overlappingSnap={...snapshot,practice:{runs:[priorRun,completedRun]}};
  assert.equal(practice.ctx.covered(overlappingDay,{...session,snapshot:overlappingSnap},{allowAdvances:true}),true,
    'exact-first matching avoids a spurious conflict between overlapping practice prefixes');
}

// A saved calendar date is not enough to suppress the user's Save Today
// reminder. The current Active Session must carry its own verified receipt.
{
  const src=[
    productionFunction('function liveSaveReminderEvidence(date){'),
    productionFunction('function savedDayCoversReminderEvidence(record,subjects){'),
    productionFunction('async function savedDayHasUncoveredKeptSession(record,date){'),
    productionFunction('async function savedDayCoversWork(date,captured=null){'),
    productionFunction('async function savedRecordExistsForDate(date){')
  ].join('\n');
  const date='2026-08-27',record={date,recordKind:'study'};
  for(const [label,mode,covered,expected] of [
    ['canonical covered session','committed',true,true],
    ['different study evidence','committed',false,false],
    ['unacknowledged session covered by canonical study evidence','unsaved',true,true],
    ['local-only session','rescue',true,false],
    ['no session','missing',true,false],
    ['strict Saved Day read fails','failed-day-read',true,false]
  ]){
    const session={date,snapshot:{contentRevision:7,savedRevision:mode==='unsaved'?6:7}};
    let dayReads=0;
    const context=vm.createContext({
      daySaveDirty:()=>false,
      cleanDayRevision:v=>Number(v)||0,
      TASKS:[],isTrackableBlock:()=>false,
      TimerState:{studyDate:date},getReviewDate:()=>date,
      AppData:{
        activeSession:{load:async()=>({ok:true,value:mode==='missing'?null:session,storage:{idb:mode!=='rescue'}})},
        pendingReviews:{list:async()=>[]},
        dailyRecords:{
          documents:async()=>{dayReads++;if(mode==='failed-day-read')throw new Error('IndexedDB failed');return [record];},
          verifyCanonical:async()=>true
        }
      },
      DailyRecordCodec:{savedDayCoversSessionEvidence:(day,value,options)=>{assert.equal(options.allowAdvances,true);return covered;}},
      AppDiagnostics:{capture:()=>{}},
      Object
    });
    vm.runInContext(src+'\nglobalThis.hasSaved=savedRecordExistsForDate;',context);
    assert.equal(await context.hasSaved(date),expected,label);
    assert.equal(await context.hasSaved(date),expected,label+' replay');
    assert.equal(dayReads,['missing','rescue'].includes(mode)?0:2,
      label+' must recheck canonical storage on every eligible reminder');
  }
}

// The real app-level suspended-Review adapter delegates the final canonical
// deletion to ReviewSaveService, rather than separately writing a temporary
// new owner session or resurrecting a stale suspended snapshot on failure.
{
  const src=productionFunction('async function saveDayRecord(){');
  for(const [hasTasks,success] of [[false,true],[false,false],[true,true],[true,false]]){
    const session={date:'2026-08-27',status:'suspended',snapshot:{token:'saved'}};
    const events=[],state={tasks:hasTasks?[{}]:[]};
    const context=vm.createContext({
      TASKS:state.tasks,sessionPanelMode:'suspended',
      AppData:{activeSession:{
        load:async(_retry,options)=>{assert.equal(options.strict,true);return {ok:true,value:session};},
        save:()=>{throw new Error('Suspended save must never perform a second Active Session save');},
        clear:()=>{throw new Error('Suspended save must not duplicate the Review service clear');}
      }},
      isSuspendedActiveSession:row=>row===session,
      appCanMutate:()=>true,activeSessionSnapshot:row=>row.snapshot,
      applyStoredSessionSnapshot:(_row,_snapshot,options)=>{assert.equal(options.reviewOnly,true);events.push('review-only');return true;},
      saveDayRecordCore:async options=>{events.push('core');assert.equal(options.closeSession,true);return success;},
      setTimerMode:()=>events.push('finished'),setSessionPanelMode:value=>events.push('panel:'+value),
      updateSessionControls:()=>events.push('controls'),setStatus:()=>{},
      AppDiagnostics:{capture:()=>{}},TIMER_MODES:{DONE:'done'},Object
    });
    vm.runInContext(src+'\nglobalThis.reviewSave=saveDayRecord;',context);
    assert.equal(await context.reviewSave(),success,'suspended save outcome must match canonical finalization');
    assert.equal(events.includes('review-only'),!hasTasks,'only an unloaded suspended session requires review-only hydration');
    assert.deepEqual(events.filter(x=>x==='core'),['core']);
    assert.equal(events.includes('finished'),success);
    assert.equal(events.includes(success?'panel:none':'panel:suspended'),true);
  }
}

console.log(JSON.stringify({status:'PASS',suite:'session-persistence-safety',canonicalSavedDay:true,previousDayRetirement:true,productionFunctions:true}));
