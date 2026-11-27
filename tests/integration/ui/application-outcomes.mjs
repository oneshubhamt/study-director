import {readCoreScript} from '../../helpers/core-script.mjs';
import {readRuntimeSource} from '../../helpers/runtime-source.mjs';
import {readHostHtml} from '../../../build/host-source.mjs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createNotifications} from '../../helpers/notifications.mjs';
const html=readHostHtml(),review=readRuntimeSource('source/core/review.ts'),library=readRuntimeSource('source/core/library.ts'),hostMain=readRuntimeSource('source/host/main.ts');
const deferred=()=>{let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};};
const noop=()=>{};

// The actual delegated input table must pass the original validated rich-input
// Event inside ReviewSaveOptions, not treat the Event itself as the options bag.
{
  let captured=null;
  const context={
    Object,FirstStart:{confirmField:noop},onPnoteChange:noop,onQuoteChange:noop,
    PlanDraftEditor:{composerInput:noop},LibraryView:{requestRender:noop},
    syncUnfinishedNoteDraft:noop,ReviewView:{sync:noop},PracticePacer:{previewSetup:noop},
    queueReviewSave:options=>{captured=options;return true;}
  };
  vm.createContext(context);
  const start=hostMain.indexOf('const INPUT_ACTIONS'),end=hostMain.indexOf('const BLUR_ACTIONS',start);
  assert.ok(start>=0&&end>start,'input action table must be executable from the production host');
  vm.runInContext(hostMain.slice(start,end)+';globalThis.__inputActions=INPUT_ACTIONS;',context);
  const event={kind:'validated-rich-input'};
  assert.equal(context.__inputActions['save-reflection'](event),true);
  assert.equal(captured?.event,event,'delegated Review input must preserve the exact rich-editor Event object');
}

// Exercise the real OS adapter and coordinator together, including the await
// between permission inspection and service-worker delivery.
{
  const {coordinator}=createNotifications(),registrations=[],shown=[];let preference=true,permission='granted',permissionRequests=0;
  class Notification {static get permission(){return permission;}static requestPermission(){permissionRequests++;return Promise.resolve(permission);}constructor(title,options){shown.push({title,options});}}
  const context={NoticeCoordinator:coordinator,Notification,window:{Notification},AppData:{local:{getJson:()=>preference,setJson:(_k,value)=>{preference=value;}}},STORAGE_KEYS:{systemAlerts:'alerts'},document:{getElementById:()=>null,addEventListener:noop},AppDiagnostics:{capture:noop},Interactions:{notify:noop},appCanMutate:()=>true,location:{href:'https://example.test/'},URL,navigator:{serviceWorker:{getRegistration:()=>{const gate=deferred();registrations.push(gate);return gate.promise;}}}};
  vm.createContext(context);for(const name of ['internal','foundation-host'])vm.runInContext(readCoreScript(name),context);
  context.api=context[Symbol.for('studyDirector.internalModules.v1')].require('foundation-host',1).createSystem({...context,captureOrigin:()=>()=>{},readPreference:()=>preference,writePreference:value=>{preference=value;}}).SystemNotifications;
  const registration={showNotification:async(title,options)=>shown.push({title,options})};
  const first=context.api.notify('Cue','Break','pomodoro','one');
  assert.equal(await context.api.notify('Cue','Break','pomodoro','one'),false,'in-flight duplicate must not start another delivery');
  registrations.shift().resolve(registration);assert.equal(await first,true);assert.equal(shown.length,1);
  assert.equal(await context.api.notify('Cue','Break','pomodoro','one'),false,'delivered occurrence is deduplicated');
  const recurring=context.api.notify('Cue','Break','pomodoro','two');registrations.shift().resolve(registration);assert.equal(await recurring,true);assert.equal(shown.length,2,'new occurrence of the same timer cue must deliver');
  const disabled=context.api.notify('Cue','Break','pomodoro','three');preference=false;registrations.shift().resolve(registration);assert.equal(await disabled,false);assert.equal(shown.length,2,'disabling while registration is pending fences delivery');
  preference=true;const denied=context.api.notify('Cue','Break','pomodoro','three');permission='denied';registrations.shift().resolve(registration);assert.equal(await denied,false);permission='granted';
  const stale=context.api.notify('Cue','Old','pomodoro','four'),newer=context.api.notify('Cue','New','pomodoro','five');
  registrations.shift().resolve(registration);assert.equal(await stale,false);registrations.shift().resolve(registration);assert.equal(await newer,true);assert.equal(shown.at(-1).options.body,'New');
  assert.equal(permissionRequests,0,'delivery must never request permission');assert.equal(coordinator.eventStatus().toasts.length,0,'OS transport must not add duplicate in-app cues');
  coordinator.clear();
}

// Commit succeeds before refresh/cleanup. A later error must never say that the
// locally committed record was not saved, or emit a success followed by failure.
{
  const {coordinator,port}=createNotifications('review');let failCommit=false,failCommittedReadback=false,failFollowup=true,failAck=false,failClear=false,failCheckpoint=false,acknowledged=0,clears=0,checkpoints=0,expectBlockedAtCommit=false;
  const context={notifications:port,saveDayInProgress:false,rolloverSaveInProgress:false,captureStudySaveOrigin:()=>()=>{},assertCheckpointCurrent:noop,activeSessionPersistenceBlocked:false,reviewHasStudyDay:()=>true,saveReflectionOnlyRecord:noop,appCanMutate:()=>true,document:{querySelector:()=>({})},setStatus:noop,SessionEvidenceGateway:{snapshot:()=>({date:'2026-09-30'})},todayISO:()=> '2026-09-30',PracticePacer:{finalizeForDayClose:noop},captureTodayState:noop,
    flushFinalActiveSessionCheckpoint:async()=>{assert.equal(context.activeSessionPersistenceBlocked,false,'final checkpoint must run before later Active Session writes are blocked');checkpoints++;if(failCheckpoint)throw new Error('checkpoint unavailable');return {date:'2026-09-30',snapshot:{contentRevision:1}};},
    ReviewView:{refresh:()=>({evidence:{date:'2026-09-30'}}),sync:noop},commitDailyRecord:async()=>{assert.equal(context.activeSessionPersistenceBlocked,expectBlockedAtCommit,'close paths block only after the verified checkpoint');if(failCommit)throw new Error('disk full');if(failCommittedReadback)throw Object.assign(new Error('read-back unavailable'),{code:'DAILY_RECORD_COMMITTED_UNVERIFIED'});return {doc:{sourceRevision:'r1'},rec:{date:'2026-09-30'}};},markStorageHealthTimestamp:noop,stopTimerExecution:noop,cancelPendingLiveDraftSave:noop,clearCanonicalSessionAfterSavedDay:async()=>{if(failClear)throw new Error('session close failed');clears++;},acknowledgeSavedStudyDay:async()=>{if(failAck)throw new Error('acknowledgement write failed');acknowledged++;},clearSaveReminder:noop,refreshLibraryAfterSave:async()=>{if(failFollowup)throw new Error('refresh unavailable');},prettyDate:v=>v,durationLabel:()=>'',displayPercent:()=>'',syncReviewSurfaceMode:noop,errorMessage:error=>String(error?.message||error),errorCode:error=>String(error?.code||'')};
  vm.createContext(context);vm.runInContext(review.slice(review.indexOf('async function saveDayRecord('),review.indexOf('/* ROLLOVER SAVE ORCHESTRATION */')),context);
  assert.equal(await context.saveDayRecord(),false);
  let event=coordinator.readEvent('review','save-study-day');assert.equal(event.outcome,'local-save-completed');assert.match(event.message,/canonical storage.*follow-up/i);assert.equal(coordinator.eventStatus().toasts.length,1);
  failFollowup=false;assert.equal(await context.saveDayRecord(),true);event=coordinator.readEvent('review','save-study-day');assert.equal(event.lifecycle,'succeeded');assert.equal(event.persistent,false);
  assert.equal(acknowledged,2,'successful Save Today must pass the acknowledgement gate');
  failAck=true;assert.equal(await context.saveDayRecord(),false);event=coordinator.readEvent('review','save-study-day');assert.equal(event.outcome,'local-save-completed');failAck=false;
  expectBlockedAtCommit=true;assert.equal(await context.saveDayRecord({closeSession:true}),true);
  assert.equal(clears,1,'a suspended Study Day closes the original session in the save lifecycle');
  assert.equal(acknowledged,2,'closing a suspended session must not publish an interim Active Session acknowledgement');
  failClear=true;assert.equal(await context.saveDayRecord({closeSession:true}),false);
  event=coordinator.readEvent('review','save-study-day');assert.equal(event.outcome,'local-save-completed','a saved Day with an uncleared suspended session is not called complete');failClear=false;
  failCheckpoint=true;const commitsBeforeCheckpointFailure=checkpoints;assert.equal(await context.saveDayRecord({closeSession:true}),false);assert.equal(context.activeSessionPersistenceBlocked,false);assert.equal(checkpoints,commitsBeforeCheckpointFailure+1);failCheckpoint=false;
  expectBlockedAtCommit=false;failCommit=true;assert.equal(await context.saveDayRecord(),false);event=coordinator.readEvent('review','save-study-day');assert.equal(event.outcome,'local-save-failed');assert.equal(event.persistent,true);assert.match(event.message,/Keep this tab open/);
  coordinator.dismissEvent(event.key,event.deliveryId);assert.equal(await context.saveDayRecord(),false);assert.equal(coordinator.eventStatus().toasts.length,1,'a new failed attempt re-arms the dismissed warning');
  failCommit=false;failCommittedReadback=true;assert.equal(await context.saveDayRecord(),false);event=coordinator.readEvent('review','save-study-day');assert.equal(event.outcome,'local-save-completed','canonical commit followed by uncertain read-back must never be reported as not saved');assert.match(event.message,/reached canonical storage/i);failCommittedReadback=false;coordinator.clear();
}


// Study Day publication uses the same optimistic-concurrency fence as Diary
// reflection edits. A newer same-owner Diary record must survive, and a
// read-back failure after an IndexedDB receipt is explicitly post-commit.
{
  const date='2026-10-04',existing=Object.freeze({version:16,recordKind:'diary',date,reflection:'Diary baseline',savedAt:'2026-10-04T10:00:00.000Z',updatedAt:'2026-10-04T10:00:00.000Z'}),newer=Object.freeze({...existing,reflection:'Newer Diary edit',updatedAt:'2026-10-04T10:00:01.000Z'});
  let current=existing,saveOptions=null,mode='conflict';
  const context={Object,Error,freeze:Object.freeze,errorMessage:error=>String(error?.message||error),currentReviewState:()=>({reflection:'',studyQuality:null,unfinished:''}),
    projectDailyRecord:()=>({version:16,recordKind:'study',date,reflection:'',savedAt:'2026-10-04T10:00:02.000Z',updatedAt:'2026-10-04T10:00:02.000Z',sourceRevision:7,schedule:[],results:{},practiceRuns:[],carryForwardDraft:''}),
    materializeDailyRecordView:value=>value,
    AppData:{dailyRecords:{
      get:async()=>existing,
      save:async(doc,options)=>{saveOptions=options;if(mode==='conflict'){current=newer;throw Object.assign(new Error('Daily Record changed before this save.'),{code:'DAILY_RECORD_CHANGED'});}current=doc;return {storage:'indexeddb'};},
      verifyCanonical:async()=>{if(mode==='readback')throw new Error('read-back unavailable');return true;}
    }}
  };
  vm.createContext(context);
  const start=review.indexOf('async function commitDailyRecord('),end=review.indexOf('async function saveReflectionOnlyRecord(',start);
  vm.runInContext(review.slice(start,end),context);
  await assert.rejects(context.commitDailyRecord({date},'canonical daily record',noop),{code:'DAILY_RECORD_CHANGED'});
  assert.equal(saveOptions.expectedCanonical,existing,'Study Day save must compare against the exact record it read');
  assert.equal(current,newer,'a newer Diary edit must not be overwritten by stale Study Day evidence');
  mode='readback';current=existing;saveOptions=null;
  await assert.rejects(context.commitDailyRecord({date},'canonical daily record',noop),{code:'DAILY_RECORD_COMMITTED_UNVERIFIED'});
  assert.equal(saveOptions.expectedCanonical,existing);
  assert.equal(current.recordKind,'study','the canonical transaction completed before the read-back ambiguity');
}


// The production Review flush is Promise-based for an active Study Day. Its
// rejection is a transition blocker, not a fire-and-forget background failure.
{
  const events=[],date='2026-10-03';
  const context={SaveLane:{prepareFlush:()=>events.push('prepare')},reviewHasStudyDay:()=>true,
    resolveReviewEditorBinding:()=>({date,reflection:'pending',studyQuality:null}),getReviewDate:()=>date,
    persistedReview:Object.freeze({date,reflection:'old',studyQuality:null}),normalizeReviewState:value=>value,
    reflectionLane:{pending:()=>false,cancel:noop},flushLiveDraft:async()=>{events.push('flush');throw new Error('async Active Session flush failed');},
    lifecycleCanWrite:()=>true,handleActiveSessionRepositoryResult:()=>true};
  vm.createContext(context);
  const start=review.indexOf('async function flushPendingReviewSave('),end=review.indexOf('function reviewPersistenceCommitted(',start);
  vm.runInContext(review.slice(start,end),context);
  await assert.rejects(context.flushPendingReviewSave({strict:true}),/async Active Session flush failed/);
  assert.deepEqual(events,['prepare','flush']);
}

// Rollover is production Review orchestration over the real lifecycle module:
// after the Saved Day commit, a failed Active Session clear must not reconcile
// Review to the requested new date or publish writable readiness.
{
  const oldDate='2026-11-12',newDate='2026-11-13',events=[];let reconciledDate=oldDate;
  const context={console,Promise,Object,Date,Error,TypeError,Symbol,
    rolloverSaveInProgress:false,saveDayInProgress:false,captureStudySaveOrigin:()=>()=>{},assertCheckpointCurrent:noop,activeSessionPersistenceBlocked:false,appCanMutate:()=>true,
    SessionState:{studyDate:oldDate},todayISO:()=>newDate,stopTimerExecution:()=>events.push('stop'),cancelPendingLiveDraftSave:()=>events.push('cancel'),
    TASKS:[{kind:'work'}],isTrackableBlock:()=>true,isLiveTrackableTimer:()=>false,
    Runtime:{currentIndex:()=>0,setSafetyMessage:message=>events.push(['safety',message])},
    PracticePacer:{finalizeForDayClose:()=>events.push('finalize')},captureReviewInputs:noop,syncUnfinishedNoteDraft:noop,saveReviewState:()=>true,
    flushFinalActiveSessionCheckpoint:async()=>{events.push('checkpoint');return {date:oldDate,snapshot:{contentRevision:9}};},
    commitDailyRecord:async()=>{events.push('commit');return {doc:{sourceRevision:9},rec:{date:oldDate}};},
    SessionEvidenceGateway:{snapshot:()=>({date:oldDate})},markStorageHealthTimestamp:noop,
    clearCanonicalSessionAfterSavedDay:async()=>{events.push('clear');throw new Error('canonical clear failed');},
    resetRuntimeSessionState:()=>events.push('reset'),inputById:()=>null,syncReviewDateMode:noop,setSessionPanelMode:()=>events.push('panel'),
    refreshPlanAfterSessionReset:()=>events.push('plan'),setPlanStatus:()=>events.push('plan-status'),refreshStorageFallbackWarning:()=>events.push('storage-warning'),
    markDayContentSaved:()=>events.push('mark-saved'),notifyUser:()=>events.push('notify'),prettyDate:value=>value,errorMessage:error=>String(error?.message||error),
    AppDiagnostics:{capture:(scope,error)=>events.push(['capture',scope,String(error?.message||error)])}
  };
  vm.createContext(context);
  vm.runInContext(readRuntimeSource('source/core/internal.ts'),context,{filename:'source/core/internal.ts'});
  vm.runInContext(readRuntimeSource('source/core/session-lifecycle.ts'),context,{filename:'source/core/session-lifecycle.ts'});
  const lifecycleModule=context[Symbol.for('studyDirector.internalModules.v1')].require('session-lifecycle',1);
  const lifecycle=lifecycleModule.createCoordinator(Object.freeze({hooks:Object.freeze({
    canMutate:()=>true,flushPending:async()=>{events.push('flush');return true;},prepare:()=>events.push('prepare'),
    reconcile:ctx=>{events.push('reconcile');reconciledDate=ctx.options.date;},
    complete:ctx=>events.push(['complete',ctx.kind,ctx.failed,ctx.reconciled]),capture:noop
  })}));
  context.runLifecycle=(...args)=>lifecycle.run(...args);
  const start=review.indexOf('/* ROLLOVER SAVE ORCHESTRATION */'),end=review.indexOf('function reviewRichInputPlain(',start);
  vm.runInContext(review.slice(start,end),context);
  assert.equal(await context.handleStudyDayRollover(),false);
  assert.ok(events.indexOf('commit')<events.indexOf('clear'),'Saved Day commits before final session retirement');
  assert.equal(events.includes('reset'),false,'runtime reset must not run after a failed canonical clear');
  assert.equal(events.includes('reconcile'),false,'failed rollover must not reconcile to its target date');
  assert.equal(reconciledDate,oldDate,'Review stays associated with the surviving old session/date');
  assert.equal(lifecycle.canWrite(),false,'failed rollover leaves lifecycle editors fail-closed');
  assert.equal(lifecycle.status().last.failed,true);
  assert.equal(lifecycle.status().last.reconciled,false);
}

// Reflection-only persistence keeps the date-specific concurrency baseline and
// treats Library refresh as a post-commit follow-up, never as a storage retry.
{
  let currentDate='2026-10-02',reflectionOnlyState=Object.freeze({date:currentDate,canonical:'Current B',recordKind:'diary'}),persistedReview=null,refreshFailure=new Error('refresh unavailable'),commitOptions=null;
  const context={Object,Promise,Error,freeze:Object.freeze,reflectionOnlyState,persistedReview,
    writeLiveDraftNow:async()=>({ok:true}),DailyReflection:{commit:async(_date,reflection,options)=>{commitOptions=options;return {canonical:reflection,revision:1,recordKind:'diary'};}},
    getReviewDate:()=>currentDate,reviewDate:value=>String(value),normalizeReviewState:(value,date)=>Object.freeze({date,reflection:value.reflection,studyQuality:null}),syncReviewSurfaceMode:noop,
    markStorageHealthTimestamp:noop,refreshLibraryAfterSave:async()=>{if(refreshFailure)throw refreshFailure;},AppDiagnostics:{capture:noop}
  };
  vm.createContext(context);
  const start=review.indexOf('function reflectionLibraryFollowup('),end=review.indexOf('function reflectionLaneState(',start);
  vm.runInContext(review.slice(start,end),context);
  const oldDate='2026-10-01';
  const pending={mode:'saved-day',date:oldDate,reflection:'Saved A',expectedCanonical:'Original A',backupCapture:false};
  const saved=await context.writeReflection(pending);
  assert.equal(commitOptions.expectedCanonical,'Original A','the queued write uses its captured date-A baseline after date B becomes current');
  assert.equal(context.reflectionOnlyState.date,currentDate,'an old-date completion must not replace the newly selected date state');
  assert.equal(await saved.followup,refreshFailure,'post-commit refresh failure is contained in the follow-up result');
  currentDate=oldDate;context.reflectionOnlyState=Object.freeze({date:oldDate,canonical:'Original A',recordKind:'diary'});refreshFailure=null;
  const current=await context.writeReflection({...pending,reflection:'Saved A2'});
  assert.equal(context.reflectionOnlyState.canonical,'Saved A2','a still-current date adopts its verified committed value');
  assert.equal(await current.followup,null);
}

// Manual Save Reflection reports a verified commit honestly when only Library
// refresh fails, while a real persistence failure remains a failed save.
{
  const {coordinator,port}=createNotifications('review');let refreshError=new Error('refresh unavailable'),storageError=null;
  const context={notifications:port,saveDayInProgress:false,rolloverSaveInProgress:false,appCanMutate:()=>true,reflectionOnlyReady:()=>true,getReviewDate:()=> '2026-10-01',
    resolveReviewEditorBinding:()=>({date:'2026-10-01',reflection:'Committed reflection'}),document:{querySelector:()=>({})},
    flushReflectionOnlySave:async()=>{if(storageError)throw storageError;return {canonical:'Committed reflection',followup:Promise.resolve(refreshError)};},
    ReviewView:{sync:noop},syncReviewSurfaceMode:noop,errorMessage:error=>String(error?.message||error)
  };
  vm.createContext(context);
  const start=review.indexOf('async function saveReflectionOnlyRecord('),end=review.indexOf('async function saveDayRecord(',start);
  vm.runInContext(review.slice(start,end),context);
  assert.equal(await context.saveReflectionOnlyRecord(),false);
  let event=coordinator.readEvent('review','save-reflection');assert.equal(event.outcome,'local-save-completed');assert.match(event.message,/Reflection saved locally; refreshing Library failed/u);
  refreshError=null;assert.equal(await context.saveReflectionOnlyRecord(),true);event=coordinator.readEvent('review','save-reflection');assert.equal(event.lifecycle,'succeeded');
  storageError=new Error('disk full');assert.equal(await context.saveReflectionOnlyRecord(),false);event=coordinator.readEvent('review','save-reflection');assert.equal(event.outcome,'local-save-failed');assert.match(event.message,/Could not save reflection/u);
  coordinator.clear();
}

// P5.6A notes host fences stale editors and reports partial Plan follow-up
// failures without pretending the committed note rename rolled back.
{
  const context={Object,Symbol,Map,Set,Promise,Date,Number,String,Error,TypeError,HTMLElement:class{},HTMLDetailsElement:class{}};
  vm.createContext(context);
  vm.runInContext(readCoreScript('internal'),context);
  vm.runInContext(readCoreScript('notes-host'),context);
  const host=context[Symbol.for('studyDirector.internalModules.v1')].require('notes-host',1);
  let ownershipRevision=1,scheduleRevision=1,savedDrafts=0,lastExpected=null,renameMode='renamed',confirmRename=true,planRenameFails=false,renameCalls=0,confirmGate=null,confirmEntered=null,metadataRevision=1;
  let note={id:'n1',key:'core',label:'Core',text:'old',updatedAt:'r1'};
  const repository=Object.freeze({
    get:ref=>note&&(String(ref).toLowerCase()==='core'||ref===note.id)?Object.freeze({...note}):null,
    update:(key,label,value,expected)=>{
      lastExpected=expected;
      if(note&&String(expected||'')!==String(note.updatedAt||''))return Object.freeze({status:'conflict'});
      note={id:note?.id||'n1',key:'core',label:String(label),text:String(value),updatedAt:'r2'};
      return Object.freeze({status:'changed'});
    },
    updateValidatedRich:(key,label,value,expected)=>repository.update(key,label,value,expected),
    flush:async()=>true,failure:()=>Object.freeze({failed:false,message:''}),
    metadataSnapshot:()=>Object.freeze({revision:metadataRevision,records:Object.freeze(note?[Object.freeze({id:note.id,key:'core',label:note.label,hasNote:!!note.text,updatedAt:note.updatedAt})]:[])}),
    searchSnapshot:()=>Object.freeze({revision:1,documents:Object.freeze([])}),size:()=>note?1:0,
    rename:async(_from,to)=>(renameCalls++,renameMode==='collision'?Object.freeze({status:'collision',labels:Object.freeze([String(to)])}):Object.freeze({status:'renamed',key:'renamed',target:'renamed',moved:Object.freeze([Object.freeze({from:'core',to:'renamed'})]),merged:0})),
    trash:async()=>null,restore:async()=>null,remove:async()=>false,trashSnapshot:()=>Object.freeze([]),purgeExpiredTrash:async()=>0
  });
  const tasks=Object.freeze([Object.freeze({id:'t1',kind:'work',area:'Core'})]);
  const fakeDocument={querySelectorAll:()=>[],getElementById:()=>null,createElement:()=>({})};
  const runtime=host.createController(Object.freeze({
    configuration:Object.freeze({maxAreaNameChars:120,maxNoteChars:100000,maxNotes:500,maxRichTextWords:50000,maxRichTextBytes:1000000,supportNote:Object.freeze({key:'support',label:'Support'})}),
    repository,tasks:()=>tasks,
    taskIdentity:Object.freeze({validIndex:value=>Number(value)===0?0:null,idAt:()=> 't1',indexForId:id=>id==='t1'?0:null,scheduleRevision:()=>scheduleRevision}),
    domain:Object.freeze({
      normalizeAreaName:value=>String(value||'').trim().toLowerCase(),displayAreaName:value=>String(value||'').trim(),areaParentKeys:()=>[],
      clampText:(value,max)=>String(value||'').slice(0,max),hasOngoingTaskNotes:task=>!!task,noteKeyForTask:()=> 'core',noteLabelForTask:()=> 'Core',
      isSupportBlock:()=>false,isTrackableBlock:()=>true
    }),
    lifecycle:Object.freeze({canWrite:()=>true,revision:()=>1}),ownership:Object.freeze({canMutate:()=>true,revision:()=>ownershipRevision}),
    richText:Object.freeze({
      closeField:()=>true,syncField:()=>true,reconcileExternal:()=>Object.freeze({status:'synced'}),
      validatedInput:event=>event?.canonical?Object.freeze({canonical:event.canonical,plain:event.plain||event.canonical}):null,
      plain:value=>String(value||''),isRich:()=>false,render:()=>true,normalizeTag:value=>String(value||''),renameTag:value=>value,
      fromText:value=>value,fromMarkdown:value=>value,quiesce:async operation=>await operation()
    }),
    tags:Object.freeze({tagged:()=>Object.freeze([])}),mutation:Object.freeze({runExclusive:async(_name,operation)=>await operation()}),
    view:Object.freeze({
      document:fakeDocument,currentTaskIndex:()=>0,saveLiveDraft:()=>{savedDrafts++;},updateSearchText:()=>true,
      refreshExecute:()=>true,refreshLibrary:()=>true,requestScheduleRender:()=>true,refreshReviewIfVisible:()=>true,refreshRecovery:()=>true,
      setStatus:()=>true,setPlanStatus:()=>true,publishSafetyNotice:()=>true,syncPopover:()=>true
    }),
    diagnostics:Object.freeze({capture:()=>true}),
    environment:Object.freeze({queueMicrotask:callback=>callback()})
  }));
  const field={dataset:{},isConnected:true,value:'old',closest:()=>null,setAttribute:()=>{},removeAttribute:()=>{},maxLength:0};
  runtime.bindTaskEditor(field,0,'test');
  assert.equal(field.dataset.noteId,'n1');
  ownershipRevision=2;
  assert.equal(runtime.commitEditor(field,'ownership-stale'),false,'ownership handoff invalidates an editor binding before mutation');
  assert.equal(note.text,'old');
  ownershipRevision=1;runtime.bindTaskEditor(field,0,'test');note=null;
  assert.equal(runtime.commitEditor(field,'deleted-stale'),false,'a deleted/renamed bound note cannot be silently recreated by a stale editor');
  note={id:'n1',key:'core',label:'Core',text:'old',updatedAt:'r1'};runtime.bindTaskEditor(field,0,'test');
  assert.equal(runtime.commitEditor(field,'ignored',{canonical:'rich-current',plain:'rich current'}),true);
  assert.equal(lastExpected,'r1','the checked repository receives the editor revision fence');
  assert.equal(note.text,'rich-current');assert.equal(savedDrafts,1);

  const plan=Object.freeze({areaUse:()=>Object.freeze({today:true,savedPlans:1}),renameArea:async()=>{if(planRenameFails)throw new Error('plan write failed');return Object.freeze({blocks:1,savedPlans:1});}});
  const workflows=host.createLibraryWorkflows(Object.freeze({runtime,repository,plan,ownership:Object.freeze({canMutate:()=>true,revision:()=>ownershipRevision}),interactions:Object.freeze({confirm:async()=>{if(confirmGate){confirmEntered.resolve();return await confirmGate.promise;}return confirmRename;}}),mergeText:(existing,moved)=>existing+moved}));
  renameMode='collision';confirmRename=false;
  assert.equal((await workflows.rename(Object.freeze({key:'core',label:'Core'}),'Renamed',{renamePlans:true})).status,'cancelled','declined collision leaves the rename cancelled');
  renameMode='renamed';confirmRename=true;planRenameFails=true;
  const partial=await workflows.rename(Object.freeze({key:'core',label:'Core'}),'Renamed',{renamePlans:true});
  assert.equal(partial.status,'renamed');assert.equal(partial.plan.ok,false,'a failed Plan fan-out is reported separately after the note rename committed');
  for(const change of ['ownership','content']){
    renameMode='collision';confirmGate=deferred();confirmEntered=deferred();const prior=renameCalls;
    const pending=workflows.rename(Object.freeze({key:'core',label:'Core'}),'Renamed',{renamePlans:true});
    await confirmEntered.promise;
    if(change==='ownership')ownershipRevision+=2;else metadataRevision++;
    confirmGate.resolve(true);
    assert.equal((await pending).status,'cancelled');
    assert.equal(renameCalls,prior+1,'stale collision decision never reaches merge');
    confirmGate=null;
  }
  const read=deferred(),entered=deferred(),before=note.text,importing=runtime.importFiles([{name:'import.txt',size:10,text:()=>{entered.resolve();return read.promise;}}]);
  await entered.promise;ownershipRevision+=2;read.resolve('stale file');
  await assert.rejects(importing,/superseded/);
  assert.equal(note.text,before,'file read from prior owner does not publish an import');
}

// A retained session owns the Study Day reflection for its date. Library may
// still edit historical Study Days and diary-only reflections, but it must not
// create a second writer for the retained session's Study Day.
{
  let retainedDate='2026-11-18';
  const context={activeDate:()=>retainedDate};
  vm.createContext(context);
  const start=library.indexOf('    function activeSessionOwnsDiaryRecord('),end=library.indexOf('    function diaryHeader(',start);
  assert.ok(start>=0&&end>start,'Library active-session Diary ownership guard must remain independently executable');
  vm.runInContext(library.slice(start,end),context);
  const study=date=>({recordKind:'study',date}),diary=date=>({recordKind:'diary',date});
  assert.equal(context.activeSessionOwnsDiaryRecord(study('2026-11-18')),true,'retained session date owns its saved Study Day reflection');
  assert.equal(context.activeSessionOwnsDiaryRecord(study('2026-11-17')),false,'historical Study Day remains editable in Diary');
  assert.equal(context.activeSessionOwnsDiaryRecord(diary('2026-11-18')),false,'diary-only reflection is not mistaken for a saved Study Day');
  retainedDate='';assert.equal(context.activeSessionOwnsDiaryRecord(study('2026-11-18')),false,'ended/discarded session releases the Diary Study Day');
}

// P5.6B Saved-Day presentation is request-generation fenced: a slower older
// read, including a stale failure, cannot replace or error over the newest day.
{
  const rendered=[],statuses=[],reads=new Map();
  const study=date=>({recordKind:'study',date,tasks:[]});
  const context={
    Promise,String,Error,
    libraryDayRequestToken:0,
    isValidIsoDate:value=>/^\d{4}-\d{2}-\d{2}$/u.test(String(value||'')),
    document:{getElementById:id=>id==='pane-library'?{classList:{contains:name=>name==='on'}}:null},
    goTab:async()=>true,
    getDailyRecord:date=>reads.get(String(date)).promise,
    setStatus:(id,message,ok)=>statuses.push({id,message,ok}),
    errorMessage:error=>String(error?.message||error),
    renderLibraryDayDetail:record=>rendered.push(record.date)
  };
  vm.createContext(context);
  const start=library.indexOf('    async function openLibraryDayDetail('),end=library.indexOf('    function libraryMutationBlocked(',start);
  assert.ok(start>0&&end>start,'P5.6B Saved-Day navigation source remains independently testable');
  vm.runInContext(library.slice(start,end),context);

  const oldRead=deferred(),newRead=deferred();reads.set('2026-11-10',oldRead);reads.set('2026-11-11',newRead);
  const oldOpen=context.openLibraryDayDetail('2026-11-10'),newOpen=context.openLibraryDayDetail('2026-11-11');
  newRead.resolve(study('2026-11-11'));assert.equal(await newOpen,true);
  oldRead.resolve(study('2026-11-10'));assert.equal(await oldOpen,false);
  assert.deepEqual(rendered,['2026-11-11'],'an older successful read cannot republish stale day detail');

  const staleFailure=deferred(),currentRead=deferred();reads.set('2026-11-12',staleFailure);reads.set('2026-11-13',currentRead);
  const staleOpen=context.openLibraryDayDetail('2026-11-12'),currentOpen=context.openLibraryDayDetail('2026-11-13');
  staleFailure.reject(new Error('old storage failure'));currentRead.resolve(study('2026-11-13'));
  assert.equal(await staleOpen,false);assert.equal(await currentOpen,true);
  assert.equal(statuses.some(row=>String(row.message).includes('old storage failure')),false,'a superseded storage failure stays silent');

  const currentFailure=deferred();reads.set('2026-11-14',currentFailure);
  const failedOpen=context.openLibraryDayDetail('2026-11-14');currentFailure.reject(new Error('current storage failure'));
  assert.equal(await failedOpen,false);
  assert.ok(statuses.some(row=>String(row.message).includes('current storage failure')),'the current Saved-Day storage failure remains truthful and visible');
}

// P5.6B summary refresh failures retain the last rendered Library state instead
// of escaping from requestAnimationFrame as an unhandled rejection.
{
  const statuses=[];let restored=0;
  const context={
    Promise,Error,
    attachmentMutationHold:0,libraryRenderToken:0,libraryRenderedRevision:0,
    document:{getElementById:id=>id==='library-list'?{}:null},
    loadLibrarySummaries:()=>Promise.reject(new Error('summary storage failure')),
    setStatus:(id,message,ok)=>statuses.push({id,message,ok}),
    errorMessage:error=>String(error?.message||error),
    restoreLibraryScroll:()=>{restored+=1;}
  };
  vm.createContext(context);
  const start=library.indexOf('    async function renderLibrary('),end=library.indexOf('    async function activateLibrary(',start);
  assert.ok(start>0&&end>start,'P5.6B Library refresh source remains independently testable');
  vm.runInContext(library.slice(start,end),context);
  assert.equal(await context.renderLibrary({restoreScroll:true}),false);
  assert.equal(restored,1,'a current failed refresh restores the preserved viewport');
  assert.ok(statuses.some(row=>String(row.message).includes('summary storage failure')),'the current summary storage failure is visible');
}

// A strict writer-settlement flush may see an untouched, bound Reflection
// before the Diary-only baseline has ever been hydrated. That is a no-op, not
// evidence that an edit can be discarded; a changed unverified binding still fails closed.
{
  const date='2026-11-14',binding={date,reflection:'',studyQuality:null},calls=[];
  const context={
    Promise,Error,
    getReviewDate:()=>date,
    resolveReviewEditorBinding:()=>binding,
    reflectionOnlyPending:()=>null,
    persistedReview:{date,reflection:'',studyQuality:null},
    reflectionLane:{pending:()=>false,schedule:value=>calls.push(['schedule',value]),flush:async options=>{calls.push(['flush',options]);return true;}}
  };
  vm.createContext(context);
  const start=review.indexOf('function flushReflectionOnlySave('),end=review.indexOf('function persistReviewBinding(',start);
  vm.runInContext(review.slice(start,end),context);
  assert.equal(await context.flushReflectionOnlySave({strict:true}),true,'untouched unhydrated Reflection is a safe strict no-op during writer settlement');
  assert.equal(calls.filter(row=>row[0]==='schedule').length,0);
  binding.reflection='unsaved edit';
  await assert.rejects(context.flushReflectionOnlySave({strict:true}),/no longer has a verified baseline/,'changed unverified Reflection still fails closed');
}

// Generic feature handles project to the existing surfaces without owning the
// cancellation action, and never accept callbacks from a prior generation.
{
  const {coordinator:n,port}=createNotifications('library');let cancelled=0;
  const first=port.begin({id:'export',surfaceId:'notes-status',title:'Export',action:{label:'Cancel',run:()=>cancelled++}});
  const row=first.read();n.dismissEvent(row.key,row.deliveryId);first.update({message:'Packaging'});assert.equal(n.eventStatus().toasts.length,0);assert.equal(cancelled,0);
  let projected;const unsubscribe=n.subscribe(state=>{projected=state.events.find(event=>event.id==='export');});assert.equal(projected.message,'Packaging');unsubscribe();
  const second=port.begin({id:'export',surfaceId:'notes-status',title:'Export'});assert.equal(first.finish('failed','Old error'),false);assert.equal(first.resolve(),false);
  second.finish('cancelled','Cancelled.');assert.equal(n.eventStatus().toasts.length,0);assert.equal(second.update({message:'Late callback'}),false);
  const third=port.begin({id:'export',title:'Export'});third.finish('succeeded','Download started.');assert.equal(n.eventStatus().toasts.length,1);
  n.publish('reminder',{kind:'safety',title:'Reminder',message:'Save today'});n.publish('disk',{kind:'critical',title:'Local save failed',message:'Keep this tab open'});n.publish('update',{kind:'update',title:'Update',message:'Available'});assert.equal(n.status().active.id,'disk');n.dismiss('disk');assert.equal(n.status().active.id,'reminder');n.clear();
}
// Actual Library export completion policy, including selection retention on
// cancellation/failure and honest download-versus-verification wording.
{
  const source=library,{coordinator,port}=createNotifications('library');
  let result={status:'cancelled'},failure=null;
  const context={notifications:port,noteExportBusy:false,noteSelection:new Set(['one']),noteSelectionMode:true,noteEntries:()=>[],updateNoteSelectionControls:noop,renderNotes:noop,console:{error:noop},errorMessage:error=>String(error?.message||error),exportKeys:async()=>{if(failure)throw failure;return result;}};
  vm.createContext(context);vm.runInContext(source.slice(source.indexOf('    async function exportSelectedNotes('),source.indexOf('    function setNotesStatus(')),context);
  assert.equal(await context.exportSelectedNotes(),false);assert.equal(context.noteSelection.size,1);assert.equal(coordinator.readEvent('library','note-export').lifecycle,'cancelled');assert.equal(coordinator.eventStatus().toasts.length,0);
  failure=new Error('file access denied');assert.equal(await context.exportSelectedNotes(),false);assert.equal(coordinator.readEvent('library','note-export').lifecycle,'failed');assert.equal(context.noteSelection.size,1);
  failure=null;result={status:'downloaded',kind:'markdown'};assert.equal(await context.exportSelectedNotes(),true);assert.equal(context.noteSelection.size,0);assert.match(coordinator.readEvent('library','note-export').message,/download started/);assert.equal(coordinator.eventStatus().toasts.length,1);
  context.noteSelection.add('two');result={status:'saved',kind:'zip',notes:2,assets:1,missing:1};assert.equal(await context.exportSelectedNotes(),true);assert.match(coordinator.readEvent('library','note-export').message,/saved and verified.*unavailable image/);assert.equal(coordinator.eventStatus().toasts.length,1);coordinator.clear();
}

// P5.7B Kept Versions is generation-fenced and failed automatic convergence
// cannot make a still-open canonical alternative disappear from the UI count.
{
  const context={Object,Symbol,Set,Promise,Date,Number,String,Error,TypeError};
  vm.createContext(context);
  vm.runInContext(readCoreScript('internal'),context);
  vm.runInContext(readCoreScript('backup-recovery-host'),context);
  const module=context[Symbol.for('studyDirector.internalModules.v1')].require('backup-recovery-host',1);
  const first=deferred(),second=deferred();let listCall=0,canMutate=false,convergenceFails=false,captures=0,rendered=0,noteRefreshes=0,statusSchedules=0;
  const open=Object.freeze({id:'kept-note',subject:'note',ref:'n1',resolvedAt:''});
  const kept=module.createKeptVersions(Object.freeze({
    controller:Object.freeze({
      status:()=>Object.freeze({busy:false}),
      resolveConvergedKeptVersions:async()=>{if(convergenceFails)throw new Error('verified acknowledgement failed');return 0;},
      reviewKeptVersions:async()=>Object.freeze({reviewed:0,changed:0,left:1})
    }),
    reviews:Object.freeze({list:async()=>{listCall+=1;if(listCall===1)return first.promise;if(listCall===2)return second.promise;return Object.freeze([open]);}}),
    diagnostics:Object.freeze({capture:()=>{captures+=1;}}),
    environment:Object.freeze({canMutate:()=>canMutate,now:()=>Date.now(),connectCardOpen:()=>false,sessionYieldedAt:()=>0}),
    notifications:Object.freeze({notify:()=>{},resolveEvent:()=>{}}),
    view:Object.freeze({render:()=>{rendered+=1;},renderLocation:()=>{},scheduleStatus:()=>{statusSchedules+=1;},refreshNotes:()=>{noteRefreshes+=1;}})
  }));
  const stale=kept.refresh(),current=kept.refresh();
  second.resolve(Object.freeze([open]));assert.equal(await current,true);assert.equal(kept.count(),1);assert.equal(kept.note('n1'),true);
  first.resolve(Object.freeze([]));assert.equal(await stale,false,'a superseded refresh cannot erase the newer canonical kept-version count');
  assert.equal(kept.count(),1);assert.equal(rendered,1);assert.equal(noteRefreshes,1);assert.equal(statusSchedules,1,'an accepted kept-version refresh invalidates the shared status projection');
  canMutate=true;convergenceFails=true;
  assert.equal(await kept.refresh(),true,'failed automatic convergence still renders the canonical unresolved review');
  assert.equal(kept.count(),1);assert.equal(captures,1,'failed verified convergence is diagnosed rather than treated as resolution');assert.equal(statusSchedules,2,'retained reviews still invalidate shared status after failed convergence');
}

// P5.6A/C: closing a conflicted rich editor is asynchronous, but Execute can
// synchronously reuse the same textarea for the next task. The old editor may
// not leave its conflict marker or restore its canonical text into the new
// binding after its destroy/flush awaits settle.
{
  const destroyGate=deferred(),syncStates=[];
  class Element{
    constructor(){this.dataset=Object.create(null);this.style={display:''};this.hidden=false;this.isConnected=true;this.parentElement=null;this.className='';this.attributes=new Map();this.inert=false;}
    matches(selector){return selector.includes('.task-note-field')&&this.className.includes('task-note-field');}
    closest(){return null;}querySelectorAll(){return [];}insertAdjacentElement(){}remove(){}
    getAttribute(name){return this.attributes.has(name)?this.attributes.get(name):null;}setAttribute(name,value){this.attributes.set(name,String(value));}removeAttribute(name){this.attributes.delete(name);}
  }
  class HTMLElement extends Element{focus(){}blur(){}}
  class HTMLTextAreaElement extends HTMLElement{constructor(){super();this.value='';this.id='';this.disabled=false;this.readOnly=false;}}
  class HTMLDetailsElement extends HTMLElement{}
  class MutationObserver{observe(){}disconnect(){}}
  const body=new HTMLElement(),documentElement=new HTMLElement();
  const document={body,documentElement,hidden:false,activeElement:body,addEventListener:noop,querySelectorAll:()=>[],getElementById:()=>null};
  const window={setTimeout:()=>1,clearTimeout:noop,addEventListener:noop,removeEventListener:noop};
  let alphaCanonical='WG1:alpha-local';
  const context={Object,Symbol,Set,Map,WeakMap,Promise,Date,Number,String,Error,TypeError,Element,HTMLElement,HTMLTextAreaElement,HTMLDetailsElement,MutationObserver,document,window,queueMicrotask};
  vm.createContext(context);vm.runInContext(readCoreScript('internal'),context);vm.runInContext(readCoreScript('rich-text-host'),context);
  const module=context[Symbol.for('studyDirector.internalModules.v1')].require('rich-text-host',1),field=new HTMLTextAreaElement();field.className='task-note-field';field.dataset.areaKey='alpha';field.dataset.noteRevision='a1';field.value='Alpha visible';
  const runtime=module.createRuntime(Object.freeze({
    configuration:Object.freeze({maxRichTextBytes:100000}),document,window,
    richText:Object.freeze({storagePrefix:'WG1:',isRichTextValue:value=>String(value||'').startsWith('WG1:'),mountRichTextEditor:async()=>Object.freeze({destroy:()=>destroyGate.promise,focus:noop,search:async()=>0,stepSearch:()=>({index:-1,count:0}),clearSearch:noop,flush:noop})}),
    assets:Object.freeze({retain:async()=>noop}),
    attachments:Object.freeze({port:()=>Object.freeze({upload:async()=>{throw new Error('unused');}}),createImageWorker:()=>({}),onBusy:noop}),
    notes:Object.freeze({
      repository:Object.freeze({flush:async()=>true,protectUnsaved:noop,get:key=>key==='zeta'?Object.freeze({updatedAt:'z2'}):Object.freeze({updatedAt:'a2'})}),
      links:()=>Object.freeze({}),normalizeArea:value=>String(value||''),setSyncState:(key,state)=>syncStates.push([key,state]),updateSearchText:noop
    }),
    review:Object.freeze({date:()=> '2026-11-16',flushPending:async()=>true,settled:async()=>true}),session:Object.freeze({settled:async()=>true}),
    view:Object.freeze({
      documentFor:editor=>editor.dataset.areaKey==='alpha'?Object.freeze({documentId:'area:alpha',label:'Alpha',initialValue:alphaCanonical,maxWords:100,surface:'note'}):editor.dataset.areaKey==='zeta'?Object.freeze({documentId:'area:zeta',label:'Zeta',initialValue:'WG1:zeta',maxWords:100,surface:'note'}):null,
      render:()=>true,plain:value=>String(value||'').replace(/^WG1:/u,''),visible:()=>true,validatedInput:()=>null,applyOwnership:noop
    }),
    activation:Object.freeze({kinds:Object.freeze({BACKGROUND:'background',ORDINARY_FOCUS:'focus',VISIBILITY_RETURN:'visible',OWNERSHIP_TAKEOVER:'ownership',DATE_ROLLOVER:'rollover',EXIT:'exit'}),subscribe:noop}),
    diagnostics:Object.freeze({capture:noop})
  }));
  assert.equal(await runtime.activate(field),true);field.dataset.richSyncState='saving';alphaCanonical='WG1:alpha-remote';
  assert.equal(runtime.reconcileExternal(field,alphaCanonical,'a2').status,'conflict');assert.equal(field.dataset.richExternalConflict,'1');
  assert.equal(runtime.closeField(field),true);assert.equal(field.dataset.richExternalConflict,undefined,'closing an old rich document clears its conflict marker before synchronous rebinding');
  field.dataset.areaKey='zeta';field.dataset.noteRevision='z2';field.dataset.richSyncState='synced';field.value='Zeta visible';field.hidden=false;
  destroyGate.resolve();for(let i=0;i<8;i++)await Promise.resolve();
  assert.equal(field.value,'Zeta visible','settled disposal of Alpha must not restore Alpha canonical text into the rebound Zeta field');
  assert.equal(field.dataset.noteRevision,'z2','old disposal must not rewrite the new note revision');
  assert.deepEqual(syncStates,[['alpha','conflict']],'old conflict settlement must not publish a synced state for the new note');
}

console.log(JSON.stringify({status:'PASS',suite:'application-outcomes',checks:['OS duplicate and recurrence','permission reversal and superseded delivery','committed save versus follow-up failure','verified final Active Session checkpoint ordering','awaited active-Review lifecycle flush','failed rollover stays on surviving session/date','validated rich-input Event reaches Review save options','date-stable reflection baseline','reflection commit versus Library refresh failure','note binding ownership/id fences and Plan partial failure','P5.6B stale Saved-Day read fence','P5.6B summary refresh failure containment','untouched Reflection writer settlement','failure resolution and recurrence','scoped cancellation and stale callbacks','local-save priority','export cancellation/failure/verification outcomes','P5.7B kept-version generation/convergence fencing','P5.6 rich-editor conflict rebind fencing']}));
