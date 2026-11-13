import {readRuntimeSource} from '../../helpers/runtime-source.mjs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

function loadReviewHost(){
  class FakeInput{constructor(value=''){this.value=value;}}
  const context=vm.createContext({console,Object,Array,Set,Map,WeakMap,Promise,Date,Number,String,Boolean,Math,JSON,Error,TypeError,RangeError,Symbol,HTMLInputElement:FakeInput});
  vm.runInContext(readRuntimeSource('source/core/internal.ts'),context,{filename:'source/core/internal.ts'});
  vm.runInContext(readRuntimeSource('source/core/review-host.ts'),context,{filename:'source/core/review-host.ts'});
  return {module:context[Symbol.for('studyDirector.internalModules.v1')].require('review-host',1),FakeInput};
}
const {module:ReviewHost,FakeInput}=loadReviewHost();
const date='2026-08-27';
function fixture(options={}){
  const input=new FakeInput(date),title={textContent:''},document={getElementById:id=>id==='day-date'?input:id==='review-date'?title:null};
  const timerState={studyDate:date,contentRevision:7,savedRevision:options.savedRevision??0},tasks=options.tasks??[{kind:'work'}];
  const day=ReviewHost.createDayState(Object.freeze({
    document,timerState,tasks:()=>tasks,isTrackableBlock:task=>task?.kind==='work',isValidIsoDate:value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')),
    todayISO:()=>date,fullWeekdayNames:['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  }));
  let stored=options.active===undefined?{date,snapshot:{contentRevision:7,savedRevision:0},status:'active'}:options.active;
  const events=[],panel=options.panel||'none';let panelMode=panel,safety='',clears=0,writes=0;
  const coordinator=ReviewHost.createSavedDayCoordinator(Object.freeze({
    document,day,
    runtime:Object.freeze({
      tasks:()=>tasks,timerState,isTrackableBlock:task=>task?.kind==='work',captureSessionSnapshot:()=>options.liveSnapshot??null,
      appliedScheduleText:()=> 'valid plan',appCanMutate:()=>options.canMutate!==false,panelMode:()=>panelMode,
      safetyMessage:()=>safety,setSafetyMessage:value=>{safety=value;},isSuspended:session=>session?.status==='suspended',
      activeSessionSnapshot:session=>session?.snapshot||null,
      applyStoredSessionSnapshot:(session,snapshot,applyOptions)=>{events.push(['hydrate',session,snapshot,applyOptions]);return options.hydrate!==false;},
      setPanelMode:(mode,session)=>{panelMode=mode;events.push(['panel',mode,session]);},
      setTimerDone:()=>events.push(['done']),updateSessionControls:()=>events.push(['controls'])
    }),
    repositories:Object.freeze({
      loadActiveSession:async()=>({ok:true,value:stored,error:null,storage:{idb:options.activeInIdb!==false,local:true}}),
      dailyDocuments:async()=>options.dayRecord?[options.dayRecord]:[],
      verifyDaily:async record=>{events.push(['verify',record]);if(options.verifyFailure)throw new Error('canonical verification failed');return true;},
      pendingReviews:async()=>options.pendingReviews||[]
    }),
    codecs:Object.freeze({
      sanitizeSession:value=>value,
      savedDayCoversSessionEvidence:(record,subject,coverageOptions)=>{assert.equal(coverageOptions.allowAdvances,true);return options.coverage?options.coverage(record,subject):!!record;}
    }),
    session:Object.freeze({
      writeCanonicalNow:async(label,writeOptions)=>{
        writes++;assert.equal(label,'acknowledging the Saved Day');assert.equal(writeOptions.markChanged,false);
        if(options.writeFailure)throw new Error('IndexedDB unavailable');
        const savedRevision=options.mismatchedWrite?Math.max(0,timerState.savedRevision-1):timerState.savedRevision;
        stored={...stored,date,snapshot:{...(stored?.snapshot||{}),savedRevision}};
        return {ok:true,value:stored,storage:{idb:true}};
      },
      clearCanonicalAfterSavedDay:async()=>{clears++;if(options.clearFailure)throw new Error('IndexedDB unavailable');stored=null;return true;},
      clearSafetyMessage:prefix=>{if(safety.startsWith(prefix))safety='';}
    }),
    review:Object.freeze({
      saveService:Object.freeze({
        saveToday:async saveOptions=>{events.push(['save',saveOptions]);return options.saveResult!==false;},
        handleRollover:async()=>options.rolloverResult!==false,hasSaveableDay:()=>true,isRolledOver:()=>true,status:()=>({rolloverSaveInProgress:false,saveDayInProgress:false,activeSessionPersistenceBlocked:false})
      }),
      editor:Object.freeze({selectDate:()=>{events.push(['date']);return true;}}),closeReflectionEditor:()=>events.push(['close-editor'])
    }),
    view:Object.freeze({
      prettyDate:value=>value,refreshStorageWarning:()=>{},notifyUser:()=>{},setStatus:(...args)=>events.push(['status',...args]),openDetails:()=>{},
      diagnostics:(...args)=>events.push(['diagnostic',...args]),staleSaveStatus:()=>true
    }),
    activation:Object.freeze({publishRollover:()=>events.push(['rollover'])})
  }));
  return {coordinator,day,timerState,events,state:()=>({stored,panelMode,safety,clears,writes})};
}

// Saved-Day acknowledgement advances the session receipt only after the strict
// canonical session write succeeds. Failure restores the previous revision.
{
  const good=fixture();assert.equal(await good.coordinator.acknowledgeSavedStudyDay(date,7),true);
  assert.equal(good.timerState.savedRevision,7);assert.equal(good.state().writes,1);
  for(const fault of ['writeFailure','mismatchedWrite']){
    const trial=fixture({[fault]:true});
    await assert.rejects(trial.coordinator.acknowledgeSavedStudyDay(date,7),/IndexedDB unavailable|acknowledgement was not saved/u);
    assert.equal(trial.timerState.savedRevision,0,fault+' must not mark the session saved');
  }
  const cleared=fixture();await cleared.coordinator.clearCanonicalSessionAfterSavedDay();assert.equal(cleared.state().clears,1);
  await assert.rejects(fixture({clearFailure:true}).coordinator.clearCanonicalSessionAfterSavedDay(),/IndexedDB unavailable/u);
}

// Reminder checks reread canonical storage. A prior positive result cannot hide
// a later replacement/deletion, and rescue-only Active Session evidence is not
// a canonical receipt.
{
  let current={date,recordKind:'study',reflection:'Saved'},reads=0;
  const trial=fixture({savedRevision:7,active:{date,status:'active',snapshot:{contentRevision:7,savedRevision:7}},dayRecord:current,
    coverage:(record)=>record?.reflection==='Saved'});
  const original=trial.coordinator;
  assert.equal(await original.savedRecordExistsForDate(date),true);
  // Recreate against changed canonical providers: there is deliberately no positive cache.
  const changed=fixture({savedRevision:7,active:{date,status:'active',snapshot:{contentRevision:7,savedRevision:7}},dayRecord:{...current,reflection:'Other'},
    coverage:(record)=>record?.reflection==='Saved'});
  assert.equal(await changed.coordinator.savedRecordExistsForDate(date),false);
  const rescue=fixture({savedRevision:7,active:{date,status:'active',snapshot:{contentRevision:7,savedRevision:7}},activeInIdb:false,dayRecord:current,
    coverage:()=>true});
  assert.equal(await rescue.coordinator.savedRecordExistsForDate(date),false);
}

// Repository canonical receipts normalize a materialized Saved-Day view, reject
// conflicting rescue/deletion state, and verify physical deletion rather than a
// recovery-shadowed interactive read.
{
  const repo=readRuntimeSource(new URL('../../../source/core/repositories.ts',import.meta.url));
  function production(name,next){
    const start=repo.indexOf(name),end=repo.indexOf(next,start);assert.ok(start>=0&&end>start,name+' missing');return repo.slice(start,end);
  }
  const verify=production('async function verifyCanonicalDailyRecord(record','async function verifyCanonicalDailyRecordAbsent');
  const absent=production('async function verifyCanonicalDailyRecordAbsent(date','async function storeDailyRecord(');
  const record={date,recordKind:'study',sourceRevision:7,reflection:'Saved'};
  for(const spec of [
    {label:'canonical',actual:record,fallback:[],deleting:false,ok:true},
    {label:'different canonical',actual:{...record,reflection:'Other'},fallback:[],deleting:false,ok:false},
    {label:'conflicting rescue',actual:record,fallback:[{...record,reflection:'Newer rescue'}],deleting:false,ok:false},
    {label:'pending deletion',actual:record,fallback:[],deleting:true,ok:false}
  ]){
    const context=vm.createContext({
      storedDailyRecordFields:value=>value,sanitizeCurrentDailyRecord:value=>value,idbGetRecord:async()=>spec.actual,readableDailyRecord:value=>value,
      fallbackDailyRecordsRawGet:()=>spec.fallback,pendingDeletionShadowsEntity:()=>spec.deleting,sameDataValue:(a,b)=>JSON.stringify(a)===JSON.stringify(b),
      pendingDeletionEntries:()=>spec.deleting?[{kind:'dailyRecord',id:date}]:[],isValidIsoDate:()=>true,Error
    });
    vm.runInContext(verify+'\n'+absent+'\nglobalThis.verify=verifyCanonicalDailyRecord;globalThis.absent=verifyCanonicalDailyRecordAbsent;',context);
    if(spec.ok)assert.equal(await context.verify(record),true,spec.label);else await assert.rejects(context.verify(record),/read-back/u,spec.label);
  }
  for(const spec of [{stored:null,fallback:[],deletion:[],ok:true},{stored:record,fallback:[],deletion:[],ok:false},{stored:null,fallback:[record],deletion:[],ok:false},{stored:null,fallback:[],deletion:[{kind:'dailyRecord',id:date}],ok:false}]){
    const context=vm.createContext({idbGetRecord:async()=>spec.stored,readableDailyRecord:value=>value,fallbackDailyRecordsRawGet:()=>spec.fallback,pendingDeletionEntries:()=>spec.deletion,isValidIsoDate:()=>true,Error});
    vm.runInContext(absent+'\nglobalThis.absent=verifyCanonicalDailyRecordAbsent;',context);
    if(spec.ok)assert.equal(await context.absent(date),true);else await assert.rejects(context.absent(date),/deletion did not pass/u);
  }
}

// BF-1R1: execute the real common Saved-Day evidence predicate and the
// previous-day retirement gate together. Revisions across devices are not
// content ancestry, and no local rescue copy is a canonical Saved Day.
{
  const sourceCodec=readRuntimeSource(new URL('../../../source/core/record-codecs.ts',import.meta.url));
  const start=sourceCodec.search(/function savedDayCoversSessionEvidence\(record\s*,session\s*,\{allowAdvances=false\}\s*=\{\}\)\s*\{/u),end=start<0?-1:sourceCodec.indexOf('\n}',start);
  assert.ok(start>=0&&end>start,'production Saved-Day coverage predicate must exist');
  for(const file of ['source/core/internal.ts','source/core/session-actions.ts'])vm.runInThisContext(readRuntimeSource(file),{filename:file});
  const actions=globalThis[Symbol.for('studyDirector.internalModules.v1')].require('session-actions',1);
  const src=sourceCodec.slice(start,end+2);
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
    vm.runInContext(src+'\nglobalThis.covered=savedDayCoversSessionEvidence;',ctx);
    ctx.covers=actions.createController({runtime:{TimerEngine:{}},state:{},ActiveSessionRuntime:{classify:()=> 'previous',sessionSnapshot:()=>snap},ActiveSessionCodec:{sanitizeCurrent:v=>v},AppData:ctx.AppData,DailyRecordCodec:{savedDayCoversSessionEvidence:ctx.covered},AppDiagnostics:ctx.AppDiagnostics}).savedDayCoversActiveSession;
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

// A Saved Day suppresses a reminder only when current canonical/live evidence is covered.
{
  for(const spec of [
    {label:'canonical covered session',activeInIdb:true,coverage:true,expected:true},
    {label:'different study evidence',activeInIdb:true,coverage:false,expected:false},
    {label:'local-only session',activeInIdb:false,coverage:true,expected:false},
    {label:'missing day',activeInIdb:true,coverage:true,missing:true,expected:false},
    {label:'failed canonical verification',activeInIdb:true,coverage:true,verifyFailure:true,expected:false}
  ]){
    const dayRecord=spec.missing?null:{date,recordKind:'study',reflection:'Saved'};
    const trial=fixture({savedRevision:7,active:{date,status:'active',snapshot:{contentRevision:7,savedRevision:7}},activeInIdb:spec.activeInIdb,dayRecord,
      verifyFailure:spec.verifyFailure,coverage:()=>spec.coverage});
    assert.equal(await trial.coordinator.savedRecordExistsForDate(date),spec.expected,spec.label);
  }
}

// Suspended Review delegates canonical finalization to ReviewSaveService and
// never performs a second Active Session write.
{
  for(const [hasTasks,success] of [[false,true],[false,false],[true,true],[true,false]]){
    const suspended={date,status:'suspended',snapshot:{date,contentRevision:7,savedRevision:0,timerRuntime:null}};
    const trial=fixture({tasks:hasTasks?[{kind:'work'}]:[],active:suspended,panel:'suspended',saveResult:success});
    assert.equal(await trial.coordinator.saveDayRecord(),success);
    assert.equal(trial.events.some(event=>event[0]==='hydrate'),!hasTasks);
    assert.deepEqual(trial.events.filter(event=>event[0]==='save').map(event=>event[1].closeSession),[true]);
    assert.equal(trial.events.some(event=>event[0]==='done'),success);
    assert.equal(trial.state().panelMode,success?'none':'suspended');
    assert.equal(trial.state().writes,0,'suspended Save Today must not write a second Active Session acknowledgement');
  }
}

console.log(JSON.stringify({status:'PASS',suite:'session-persistence-safety',canonicalSavedDay:true,previousDayRetirement:true,productionFunctions:true}));
