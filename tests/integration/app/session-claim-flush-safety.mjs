import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../../../source/app.html',import.meta.url),'utf8');
function productionFunction(name){
  const start=source.indexOf(name),end=start<0?-1:source.indexOf('\n}',start);
  assert.ok(start>=0&&end>start, `Production function missing: ${name}`);
  return source.slice(start,end+2);
}
// The claim cadence comes from the app itself, so the test follows it.
const claimTimings=source.match(/^const SESSION_WATCH_MS=.*;$/mu)?.[0];
assert.ok(claimTimings,'Production session-claim timings must exist.');
const saveWarning=source.match(/^const SESSION_CLAIM_SAVE_WARNING=.*;$/mu)?.[0];
assert.ok(saveWarning,'Production session-claim warning must exist.');
const newerMessage=source.match(/^const SESSION_NEWER_CLAIM_MESSAGE=.*;$/mu)?.[0];
assert.ok(newerMessage,'Production newer-claim message must exist.');
const runtime=[saveWarning,newerMessage,productionFunction('function notifyNewerSessionClaim(){'),productionFunction('async function requireCanonicalSessionWrite(saved,expected,operation=\'active-session transition\'){'),productionFunction('async function verifyFrozenSessionClaim(){'),productionFunction('function resumeAfterReleasedSessionClaim(session){'),productionFunction('async function checkSessionOwnershipClaim(){'),productionFunction('function writeLiveDraftNow(options={}){'),productionFunction('function snapshotWhileSessionClaimFrozen(){')].join('\n');

const owned={epoch:2,applies:true,state:'owned',ownedHere:false};
const session={runningOn:'inst_local',revision:4};
const saved={ok:true,value:{...session,revision:5},storage:{local:false,idb:true}};
const localOnly={ok:true,value:{...session,revision:5},storage:{local:true,idb:false},error:new Error('IndexedDB unavailable')};
const failed={ok:false,value:{...session,revision:5},storage:{local:false,idb:false},error:new Error('Both local stores unavailable')};
const loaded=value=>({ok:true,value,storage:{local:false,idb:true}});
function harness(){
  let claim={...owned},now=100000,sessionValue={...session},saves=[],loads=[],captureFailure=false,resumeWorks=true,reviewText='Retain the last edits';
  const calls={notices:[],updates:0,stops:0,resumes:0,holds:[],releases:0,snapshots:[],captureEvidenceArgs:[],evidences:[],writes:[],syncs:[],warnings:[],status:[],captures:[],changed:0,cancelled:0};
  const app={
    document:{visibilityState:'visible'},navigator:{onLine:true},
    StartupLifecycle:{status:()=>({fullyInitialized:true})},
    TASKS:[{}],sessionPanelMode:'active',
    BackupProviderRuntime:{connected:()=>true,readSessionClaim:async()=>claim,scheduleSharedSync:(id,reason)=>{calls.syncs.push(reason);return true;}},
    AppData:{activeSession:{load:async()=>{const next=loads.length?loads.shift():loaded(sessionValue);return typeof next==='function'?await next():await next;}}},
    ActiveSessionCodec:{sanitizeCurrent:value=>value},CanonicalModule:{same:(a,b)=>JSON.stringify(a)===JSON.stringify(b)},
    InstallationIdentity:{getId:()=> 'inst_local'},
    DecisionClock:{nowMs:()=>now},lastTimerSnapshotMs:0,
    restoreSessionPersistenceSuppressed:()=>false,managedRecoverySessionQuiesced:()=>false,appCanMutate:()=>true,
    showLiveDraftSaveWarning:reason=>calls.warnings.push({key:'capture',message:reason}),
    TimerEngine:{stopExecution:()=>{calls.stops++;return true;},holdClockAt:ms=>{calls.holds.push(ms);return true;},releaseHeldClock:()=>{calls.releases++;return true;},resumeAfterPrimaryRestore:()=>{calls.resumes++;return resumeWorks;}},
    markDayContentChanged:()=>{calls.changed++;},
    captureRuntimeEvidence:()=>{const evidence={actualTime:[42],actualRecords:[{seconds:42}],capturedAt:now};calls.evidences.push(evidence);return evidence;},
    captureSessionSnapshot:evidence=>{if(captureFailure)throw new Error('snapshot failed');const snap={token:calls.snapshots.length+1,review:{reflection:reviewText},timerRuntime:{frozenAt:now},practice:{frozenAt:now},actualTime:evidence?.actualTime||[]};calls.snapshots.push(snap);calls.captureEvidenceArgs.push(evidence);return snap;},
    cancelPendingLiveDraftSave:()=>{calls.cancelled++;},
    writeActiveSessionNow:async(snapshot,options)=>{
      calls.writes.push({snapshot,options});
      assert.ok(saves.length,'Unexpected Active Session save');
      const next=saves.shift();
      return typeof next==='function'?await next():await next;
    },
    AppDiagnostics:{capture:(scope,error)=>calls.captures.push({scope,error})},
    markStorageHealthError:(key,message)=>{calls.warnings.push({key,message});},
    refreshStorageFallbackWarning:()=>{},
    setPlanStatus:(message,ok)=>calls.status.push({message,ok}),
    Interactions:{notify:notice=>calls.notices.push(notice)},checkUnsupportedUpdate:async()=>{calls.updates++;},
    clearSessionSafetyMessage:()=>{vm.runInContext("sessionSafetyMessage='';",context);},
    Object
  };
  const context=vm.createContext(app);
  vm.runInContext(`${claimTimings}\nlet sessionClaimFreeze=null,sessionClaimCheckActive=false,sessionSafetyMessage='';\n${runtime}\nglobalThis.check=checkSessionOwnershipClaim;globalThis.liveWrite=writeLiveDraftNow;globalThis.state=()=>({freeze:sessionClaimFreeze,warning:sessionSafetyMessage,active:sessionClaimCheckActive});`,context,{filename:'production-session-claim.js'});
  return {calls,check:()=>context.check(),liveWrite:options=>context.liveWrite(options),state:()=>context.state(),saves,loads,setClaim:v=>{claim=v;},setLocal:v=>{sessionValue=v;},setNow:v=>{now=v;},setResumeWorks:v=>{resumeWorks=v;},setReviewText:v=>{reviewText=v;},failCapture:()=>{captureFailure=true;},setTasks:v=>{context.TASKS=v;}};
}
const good=()=>loaded({...session,revision:5});

// A normal remote claim must persist and reread the frozen snapshot before sync.
{
  const t=harness();t.loads.push(loaded(session),good());t.saves.push(saved);
  assert.equal(await t.check(),true);
  assert.equal(t.calls.stops,1);
  assert.equal(t.calls.holds.length,1,'the stopped timer holds its time at the moment it stopped, so the screen does not count on');
  assert.equal(t.calls.snapshots.length,2,'initial capture and current non-timing projection');
  assert.equal(t.calls.writes.length,1);
  assert.equal(t.calls.writes[0].snapshot.timerRuntime,t.calls.snapshots[0].timerRuntime);
  assert.equal(t.calls.captureEvidenceArgs[1],t.calls.evidences[0]);
  assert.equal(t.calls.writes[0].options.emergency,true);
  assert.equal(t.calls.writes[0].options.strictDurability,true);
  assert.equal(t.state().freeze.localVerified,true);
  assert.deepEqual(t.calls.syncs,['session-claim']);
  assert.equal(t.state().warning,'');
  t.loads.push(loaded(session));assert.equal(await t.check(),true);
  assert.equal(t.calls.stops,1,'same epoch does not re-freeze');
  assert.equal(t.calls.writes.length,1,'verified snapshot is not rewritten on each poll');
  assert.equal(t.calls.syncs.length,1,'unchanged claim obeys sync cooldown');
  t.setNow(115000);t.loads.push(loaded(session));await t.check();
  assert.equal(t.calls.syncs.length,2,'a stopped device asks again for the letting-go sync at its next 15 s claim check');
}

// A newer build's claim: the timer stops and the progress is saved, as for any
// remote claim, but nothing here can follow it, so the app asks for an
// update once and no sync is asked for.
{
  const t=harness();t.setClaim({...owned,newer:true});t.loads.push(loaded(session),good());t.saves.push(saved);
  assert.equal(await t.check(),true);
  assert.equal(t.calls.stops,1,'the timer stops');assert.equal(t.state().freeze.localVerified,true,'the progress is saved and read back');
  assert.deepEqual(t.calls.syncs,[],'no sync is asked for');
  assert.equal(t.calls.notices.length,1);assert.equal(t.calls.notices[0].title,'Update the app to continue');assert.match(t.calls.notices[0].message,/newer version of Study Director.*progress is saved.*Update the app/u);
  t.calls.notices[0].action.run();assert.equal(t.calls.updates,1,'Update app looks for the new version');
  t.setNow(200000);t.loads.push(loaded(session));assert.equal(await t.check(),true);
  assert.equal(t.calls.stops,1);assert.equal(t.calls.notices.length,1,'it asks once');assert.deepEqual(t.calls.syncs,[]);
}
// The save failing first: the timer stays stopped and the update notice waits for a verified save.
{
  const t=harness();t.setClaim({...owned,newer:true});t.loads.push(loaded(session));t.saves.push(failed);
  assert.equal(await t.check(),true);assert.equal(t.calls.stops,1);assert.equal(t.calls.notices.length,0);assert.match(t.state().warning,/Keep this tab open/u);
  t.loads.push(loaded(session),good());t.saves.push(saved);assert.equal(await t.check(),true);
  assert.equal(t.calls.notices.length,1,'asked once the progress is saved');assert.deepEqual(t.calls.syncs,[]);
}

// Failed, null, local-only and thrown writes keep the execution frozen and skip claim-triggered sync.
for(const [name,result] of [
  ['failed',failed],['null',null],['local-only',localOnly],['throw',()=>Promise.reject(new Error('disk write failed'))]
]){
  const t=harness();t.loads.push(loaded(session));t.saves.push(result);
  assert.equal(await t.check(),true,name);
  assert.equal(t.calls.stops,1,name);
  assert.equal(t.calls.syncs.length,0,name);
  assert.equal(t.state().freeze.localVerified,false,name);
  assert.match(t.state().warning,/Keep this tab open/u,name);
  assert.ok(t.calls.warnings.length,name);
  assert.equal(t.calls.status.at(-1).ok,false,name);
  t.loads.push(loaded(session),good());t.saves.push(saved);
  assert.equal(await t.check(),true,name+' retry');
  assert.equal(t.calls.stops,1,name+' no duplicate freeze');
  assert.equal(t.calls.evidences.length,1,name+' one frozen timing evidence');
  assert.equal(t.calls.writes[1].snapshot.timerRuntime,t.calls.writes[0].snapshot.timerRuntime,name+' retry must not accrue time');
  assert.equal(t.state().freeze.localVerified,true,name+' recovered');
  assert.equal(t.state().warning,'',name+' clears owned warning');
  assert.deepEqual(t.calls.syncs,['session-claim'],name+' sync after verification');
}

// Successful write with failing/ambiguous readback must not be called canonical.
for(const bad of [
  {ok:false,value:null,error:new Error('read failed')},
  {ok:true,value:{...session,revision:3},storage:{idb:true}},
  {ok:true,value:{...session,revision:5,unexpectedProgress:9},storage:{idb:true}},
  {ok:true,value:{...session,revision:5},storage:{idb:false}},
  ()=>Promise.reject(new Error('readback rejected'))
]){
  const t=harness();t.loads.push(loaded(session),bad);t.saves.push(saved);
  assert.equal(await t.check(),true);
  assert.equal(t.calls.stops,1);
  assert.equal(t.calls.syncs.length,0);
  assert.equal(t.state().freeze.localVerified,false);
  t.loads.push(loaded(session),good());t.saves.push(saved);await t.check();
  assert.equal(t.calls.syncs.length,1);
}

// The owner can return, but an unverified frozen state may not restart its timer.
{
  const t=harness();t.loads.push(loaded(session));t.saves.push(null);await t.check();
  t.setClaim({...owned,ownedHere:true});
  t.loads.push(loaded(session),good());t.saves.push(saved);
  assert.equal(await t.check(),true);
  assert.equal(t.calls.resumes,1);
  assert.equal(t.state().freeze,null);
  assert.equal(t.calls.stops,1);
  assert.equal(t.calls.syncs.length,0);
}

// If the timer is not restorable yet, do not clear the frozen handoff or report success.
{
  const t=harness();t.loads.push(loaded(session),good());t.saves.push(saved);await t.check();
  t.setClaim({...owned,ownedHere:true});t.setResumeWorks(false);
  t.loads.push(loaded(session));
  assert.equal(await t.check(),false);
  assert.ok(t.state().freeze,'cannot retire an unresumed frozen state');
  assert.equal(t.calls.resumes,1);
  t.setResumeWorks(true);t.loads.push(loaded(session));
  assert.equal(await t.check(),true);
  assert.equal(t.state().freeze,null);
  assert.equal(t.calls.resumes,2);
}

// Other save callers (notably managed-recovery preflight) must not recapture
// elapsed wall time after the remote owner's timer has been frozen.
{
  const t=harness();t.loads.push(loaded(session),good());t.saves.push(saved);await t.check();
  const original=t.state().freeze.snapshot;
  t.setNow(130000);t.setReviewText('Edited reflection after ownership moved');t.saves.push(saved);
  assert.equal((await t.liveWrite({markChanged:false,allowDuringRecoveryQuiescence:true})).ok,true);
  assert.equal(t.calls.writes[1].snapshot.timerRuntime,original.timerRuntime,'recovery preflight preserves frozen timer evidence');
  assert.equal(t.calls.writes[1].snapshot.practice,original.practice,'recovery preflight preserves practice evidence');
  assert.equal(t.calls.writes[1].snapshot.review.reflection,'Edited reflection after ownership moved','a later reflection is not silently discarded');
  assert.equal(t.calls.evidences.length,1,'no fresh timing evidence while ownership moved');
  assert.equal(t.calls.changed,1,'the initial freeze marks change only once');
}
{
  const t=harness();t.saves.push(saved);
  assert.equal((await t.liveWrite({markChanged:false})).ok,true);
  assert.equal(t.calls.snapshots.length,1,'ordinary live saving still captures latest state');
  assert.equal(t.calls.writes[0].snapshot,t.calls.snapshots[0]);
}

// A newer remote epoch freezes a new snapshot once and never reuses an old proof.
{
  const t=harness();t.loads.push(loaded(session),good());t.saves.push(saved);await t.check();
  t.setClaim({...owned,epoch:3});
  t.loads.push(loaded(session),good());t.saves.push(saved);await t.check();
  assert.equal(t.calls.stops,2);
  assert.equal(t.calls.snapshots.length,4,'each epoch projects once after its timing capture');
  assert.notEqual(t.calls.snapshots[0],t.calls.snapshots[2]);
  assert.equal(t.calls.syncs.length,2);
}

// Non-applicable or not-locally-owned claims cannot stop the timer.
{
  const t=harness();t.setClaim({...owned,applies:false});t.loads.push(loaded(session));
  assert.equal(await t.check(),false);assert.equal(t.calls.stops,0);
  t.setClaim({...owned});t.setLocal({runningOn:'inst_other',revision:6});t.loads.push(loaded({runningOn:'inst_other',revision:6}));
  assert.equal(await t.check(),false);assert.equal(t.calls.stops,0);
}

// If snapshot capture fails, the verified remote owner still stops execution and warns.
{
  const t=harness();t.failCapture();t.loads.push(loaded(session));
  assert.equal(await t.check(),true);
  assert.equal(t.calls.stops,1);assert.equal(t.calls.syncs.length,0);
  assert.match(t.state().warning,/Keep this tab open/u);
  assert.ok(t.calls.captures.some(row=>row.scope==='session.claim-snapshot'));
}

// Concurrent observer calls share one watcher and cannot duplicate a handoff.
{
  const t=harness();t.loads.push(loaded(session),good());
  let release;const pending=new Promise(resolve=>{release=resolve;});
  t.saves.push(()=>pending);
  const first=t.check();
  await Promise.resolve();await Promise.resolve();await Promise.resolve();
  assert.equal(await t.check(),false,'second watcher yields while first is outstanding');
  release(saved);assert.equal(await first,true);
  assert.equal(t.calls.stops,1);assert.equal(t.calls.writes.length,1);
  assert.deepEqual(t.calls.syncs,['session-claim']);
}

// A frozen claim fences a primary-tab timer resume; nothing else does.
{
  const fn=productionFunction('function resumeTimerLoopAfterPrimaryRestore(){');
  let calls=0;
  const c=vm.createContext({
    sessionClaimFreeze:{epoch:2},
    TimerEngine:{resumeAfterPrimaryRestore:()=>{calls++;return true;}},
    StartupLifecycle:{status:()=>({fullyInitialized:false})},
    AppDiagnostics:{capture:()=>{}}
  });
  vm.runInContext(fn+'\nglobalThis.tryResume=resumeTimerLoopAfterPrimaryRestore;globalThis.unfreeze=()=>{sessionClaimFreeze=null;};',c);
  assert.equal(c.tryResume(),false,'a session claimed elsewhere does not resume here');
  assert.equal(calls,0);
  c.unfreeze();
  assert.equal(c.tryResume(),true);
  assert.equal(calls,1);
}

// Independently exercise the acquiring device's production Continue Here
// function. A success requires both a Drive claim and an exact canonical
// IndexedDB receipt; a partial claim is never silently treated as success.
const handoffConstants=[
  source.match(/^const sessionHandoffError=.*;$/mu)?.[0],
  source.match(/^const HANDOFF_RETRY_MESSAGE=.*;$/mu)?.[0]
];
assert.ok(handoffConstants.every(Boolean));
const acquireRuntime=[
  ...handoffConstants,
  productionFunction('async function requireCanonicalSessionWrite(saved,expected,operation='),
  productionFunction('async function transferSessionOwnershipHere(session,')
].join('\n');
const OWN_CLAIM_OWNER='d'.repeat(64),OLD_OWNER='e'.repeat(64);
function acquiringHarness(fault='',draft='SEPARATE-PLAN-DRAFT'){
  const previous={date:'2026-10-27',runningOn:'inst_handoff_old',revision:10,status:'active',snapshot:{label:'original'},scheduleText:'07:00 | 30 | Work | work | Ethics | block | 1'};
  const syncs=[],requests=[];let current=structuredClone(previous),claims=0,reads=0,separateReads=0,compensations=0,backgroundReleases=0,notify=0,faultMode=fault,remoteClaim=null,head='cp_'+'a'.repeat(32),remoteSource=previous,sharedContent='',id=0,readbackFailed=false,conditionalWrites=0,compensationWrites=0;
  const app={
    document:{getElementById:id=>id==='plan-input'?{value:faultMode==='display-mismatch'?'UNSAVED-UNMATCHED':draft===null?'FALLBACK DEFAULT':draft}:null},
    navigator:{onLine:true},Date,Promise,Object,JSON,
    crypto:{randomUUID:()=>('00000000-0000-4000-8000-'+String(++id).padStart(12,'0'))},
    appCanMutate:()=>true,
    getActiveDefaults:()=>({scheduleText:'FALLBACK DEFAULT'}),
    PlanDraftEditor:{flush:async()=>true},
    PlanData:{settled:async()=>{if(faultMode==='draft-fail')throw new Error('draft write failed');},readDraft:()=>draft},
    AppData:{
      planData:{read:async()=>({draft:faultMode==='draft-mismatch'?'OTHER DRAFT':draft})},
      activeSession:{
        save:async(value,options={})=>{
          // Compensation puts the observed session back over this device's
          // attempted one; every other handoff save replaces the copy the
          // press started from.
          const compensating=options.expectedCanonical?.runningOn==='inst_handoff_new';
          if(options.expectedCanonical)conditionalWrites++;
          if(compensating)compensationWrites++;
          if(faultMode==='compensation-race'&&compensating||faultMode==='local-write-before-save'&&options.expectedCanonical&&!compensating){
            current={...current,snapshot:{label:'new unshared local work'}};
          }
          if(options.expectedCanonical&&JSON.stringify(current)!==JSON.stringify(options.expectedCanonical))
            return {ok:false,value,error:Object.assign(new Error('Active Session changed before this save.'),{code:'ACTIVE_SESSION_CHANGED'}),storage:{idb:false,local:false}};
          if(['local-only','claim-crash'].includes(faultMode)&&value.runningOn==='inst_handoff_new')
            return {ok:true,value,error:new Error('IndexedDB failed'),storage:{idb:false,local:true}};
          current=structuredClone(value);return {ok:true,value:current,storage:{idb:true,local:false}};
        },
        load:async()=>{
          if(['compensation-readback','compensation-race'].includes(faultMode)&&current.runningOn==='inst_handoff_new'&&!readbackFailed){readbackFailed=true;return {ok:false,value:null,error:new Error('readback failed before compensation'),storage:{idb:true}};}
          const content=faultMode==='different-read'&&current.runningOn==='inst_handoff_new'?
            {...current,snapshot:{...current.snapshot,label:'unexpected concurrent progress'}}:current;
          return {ok:true,value:content,storage:{idb:true,local:false}};
        }
      }
    },
    InstallationIdentity:{getId:()=> 'inst_handoff_new'},
    ActiveSessionCodec:{sanitizeCurrent:value=>value||null},
    CanonicalModule:{same:(a,b)=>JSON.stringify(a)===JSON.stringify(b)},
    activeSessionContentFingerprint:async session=>session?.snapshot?.label==='original'?'f'.repeat(64):session?.snapshot?.label==='changed here'?'1'.repeat(64):'0'.repeat(64),
    BackupCodec:{assetIds:session=>session?.snapshot?.label==='remote with missing attachment'?['img-unavailable']:[]},
    nextSessionRevision:value=>Number(value)+1,
    setPlanStatus:()=>{},handleActiveSessionRepositoryResult:()=>true,
    AppDiagnostics:{capture:()=>{}},
    notifyBackupChange:()=>{notify++;},
    BackupProviderRuntime:{
      connected:()=>true,
      readSessionClaim:async()=>remoteClaim,
      readSessionHandoffSource:async()=>{separateReads++;return {status:'completed',checkpointId:head,observedOwnerToken:OLD_OWNER,session:remoteSource,priorClaim:remoteClaim,sharedContentFingerprint:sharedContent};},
      suspendBackground:()=>({settled:Promise.resolve(),release:()=>{backgroundReleases++;}}),
      // As the provider does: one lease covers the read and the claim; decide
      // names the claim (or throws, and nothing is written), and onWrite marks
      // the moment the claim goes to Drive.
      claimSessionOwnership:async(_provider,ask)=>{
        if(faultMode==='claim-busy')return {status:'busy',reason:'busy'};
        reads++;
        const fields=await ask.decide({status:'completed',checkpointId:head,observedOwnerToken:OLD_OWNER,session:remoteSource,priorClaim:remoteClaim,sharedContentFingerprint:sharedContent});
        const request={...fields,date:ask.date,handoffToken:ask.handoffToken,expectedCheckpointId:head};
        claims++;requests.push(request);ask.onWrite?.();
        if(faultMode==='claim-throws-before-remote')throw new Error('claim did not reach Drive');
        remoteClaim={epoch:(remoteClaim?.epoch||0)+1,state:'owned',applies:true,ownedHere:true,ownerToken:OWN_CLAIM_OWNER,
          observedOwnerToken:OLD_OWNER,observedRevision:request.observedRevision,
          observedContentFingerprint:request.observedContentFingerprint,handoffToken:request.handoffToken,
          revision:request.revision};
        if(faultMode==='claim-throws-after-remote')throw new Error('claim accepted but response lost');
        return {status:'completed',claim:remoteClaim};
      },
      releaseSessionClaim:async()=>{
        compensations++;
        if(faultMode==='claim-crash')return false;
        remoteClaim={...remoteClaim,epoch:remoteClaim.epoch+1,ownedHere:false,ownerToken:OLD_OWNER,
          observedOwnerToken:OWN_CLAIM_OWNER,observedRevision:remoteClaim.revision,
          revision:previous.revision,observedContentFingerprint:''};
        return true;
      },
      wakeBackground:()=>true,scheduleSharedSync:(_id,reason)=>{syncs.push(reason);return true;}
    }
  };
  let context;
  const boot=()=>{
    context=vm.createContext({...app});
    vm.runInContext(acquireRuntime+'\nglobalThis.takeOver=transferSessionOwnershipHere;',context,{filename:'production-handoff-acquisition.js'});
  };
  boot();
  return {previous,transfer:(session=current,options)=>context.takeOver(structuredClone(session),options),reload:boot,
    setFault:value=>{faultMode=value;},setSourceSession:value=>{remoteSource=value;},setShared:value=>{sharedContent=value;},
    setCurrent:value=>{current=structuredClone(value);},setClaim:value=>{remoteClaim=value;},
    state:()=>({current,claim:remoteClaim,claims,reads,separateReads,requests:[...requests],compensations,conditionalWrites,compensationWrites,backgroundReleases,notify,syncs:[...syncs]})};
}
{
  const t=acquiringHarness();
  const result=await t.transfer(),state=t.state();
  assert.deepEqual(state.syncs,['session-continue'],'once the session moves, notes and everything else sync at once in the background');
  assert.equal(result.session.runningOn,'inst_handoff_new');
  assert.equal(state.current.runningOn,'inst_handoff_new');
  assert.equal(state.claims,1);
  assert.equal(state.compensations,0);
  assert.equal(state.notify,1,'only verified ownership is published as a local change');
  assert.equal(state.backgroundReleases,1);
  assert.match(state.requests[0].handoffToken,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u,'each attempt names itself');
  assert.equal(state.reads,1);assert.equal(state.separateReads,0,'the session is read and claimed under one Drive lease, with no separate read');
}
// A read started while the person confirmed finishes before the claim starts.
{
  const t=acquiringHarness();let finished=false,claimedEarly=false;
  const preread=new Promise(resolve=>setTimeout(()=>{finished=true;resolve(null);},5));
  const original=t.state().claims;
  await t.transfer(undefined,{preread:preread.then(value=>{claimedEarly=t.state().claims!==original;return value;})});
  assert.equal(finished,true);assert.equal(claimedEarly,false,'no claim starts while the read ahead runs');assert.equal(t.state().claims,1);
}
// A local write can succeed before its read-back fails. Compensation must
// conditionally compare inside IndexedDB, not trust an earlier standalone read.
{
  const t=acquiringHarness('compensation-readback');
  await assert.rejects(t.transfer(),/readback failed before compensation/u);
  assert.equal(t.state().compensationWrites,1,'compensation must use canonical compare-and-write');
  assert.equal(t.state().current.runningOn,'inst_handoff_old');
  assert.equal(t.state().compensations,1);
}
{
  const t=acquiringHarness('compensation-race');
  await assert.rejects(t.transfer(),e=>e?.code==='SESSION_CONTINUE_INCOMPLETE');
  assert.equal(t.state().compensationWrites,1);
  assert.equal(t.state().current.snapshot.label,'new unshared local work',
    'a competing write between read and compensation cannot be overwritten');
  assert.equal(t.state().compensations,0);
}

// Every handoff save replaces only the copy the press started from. A save
// made here meanwhile is kept: before the claim nothing moves; after it the
// press asks to be repeated, and nothing here is overwritten.
{
  const t=acquiringHarness();await t.transfer();
  assert.equal(t.state().conditionalWrites,1,'the ownership save is conditional');
  const s=acquiringHarness(),ahead={...s.previous,revision:12,snapshot:{label:'more study on the other device'}};
  s.setSourceSession(ahead);s.setShared('f'.repeat(64));await s.transfer();
  assert.equal(s.state().conditionalWrites,2,'taking Drive\'s newer copy first is conditional too');
}
{
  const t=acquiringHarness('local-write-before-save');
  await assert.rejects(t.transfer(),error=>error?.code==='SESSION_CONTINUE_INCOMPLETE','after the claim, a changed copy asks for another press');
  assert.equal(t.state().current.snapshot.label,'new unshared local work','the save made here meanwhile is kept');
  assert.equal(t.state().compensations,0,'and is not rolled back over');
}
{
  const t=acquiringHarness('local-write-before-save'),ahead={...t.previous,revision:12,snapshot:{label:'more study on the other device'}};
  t.setSourceSession(ahead);t.setShared('f'.repeat(64));
  await assert.rejects(t.transfer(),error=>error?.code==='SESSION_CONTINUE_CHANGED','before the claim, a changed copy stops the press');
  assert.equal(t.state().claims,0,'nothing is claimed');
  assert.equal(t.state().current.snapshot.label,'new unshared local work','Drive\'s copy does not replace the save made here');
}
// BF-1R2: a fresh installation displays its default without persisting
// an independent Plan draft. Ownership transfer must accept canonical null.
{
  const t=acquiringHarness('',null);
  const result=await t.transfer();
  assert.equal(result.session.runningOn,'inst_handoff_new','Continue Here works with no saved Plan draft');
  assert.equal(t.state().claims,1,'the default display is not silently written to draft storage');
}
// A changed visible draft or inconsistent canonical read-back stops before
// any remote claim, rather than risking a silent draft overwrite.
for(const fault of ['display-mismatch','draft-mismatch']){
  const t=acquiringHarness(fault,null);
  await assert.rejects(t.transfer(),error=>error?.code==='SESSION_CONTINUE_DRAFT_UNSAVED',fault+' must block an unsafe draft handoff');
  assert.equal(t.state().claims,0,'no remote ownership claim precedes draft verification');
}
{
  const t=acquiringHarness('local-only');
  await assert.rejects(t.transfer(),/IndexedDB failed/u,'localStorage rescue is not an ownership commit');
  const state=t.state();
  assert.equal(state.claims,1);
  assert.equal(state.compensations,1,'failed local commit compensates the remote claim');
  assert.equal(state.current.runningOn,'inst_handoff_old');
  assert.equal(state.notify,0);
}
{
  const t=acquiringHarness('different-read');
  await assert.rejects(t.transfer(),error=>error?.code==='SESSION_CONTINUE_INCOMPLETE','unexpected same-revision content is not a verified handoff');
  const state=t.state();
  assert.equal(state.claims,1);
  assert.equal(state.compensations,0,'divergent canonical progress is not overwritten by an unsafe rollback');
  assert.equal(state.notify,0);
}
{
  const t=acquiringHarness('draft-fail');
  await assert.rejects(t.transfer(),/draft write failed/u);
  const state=t.state();
  assert.equal(state.claims,0,'no remote claim is attempted before the Plan-draft write settles');
  assert.equal(state.current.runningOn,'inst_handoff_old');
}
{
  // Drive answers busy before writing any claim: the reason is shown as is.
  const t=acquiringHarness('claim-busy');
  await assert.rejects(t.transfer(),error=>error?.code==='SESSION_CONTINUE_BUSY');
  assert.equal(t.state().current.runningOn,'inst_handoff_old');
}

// Continue Here stops after its claim may have reached Drive but before the
// session is saved here. This device's copy still runs elsewhere, so no timer
// starts here; the old owner stops on seeing the claim. Pressing Continue
// Here again finishes the move with a fresh claim.
for(const fault of ['claim-crash','claim-throws-after-remote','claim-throws-before-remote']){
  const t=acquiringHarness(fault);
  await assert.rejects(t.transfer(),error=>error?.code==='SESSION_CONTINUE_INCOMPLETE'&&/Press Continue Here again/u.test(error.message),fault+' asks for another Continue Here');
  assert.equal(t.state().current.runningOn,'inst_handoff_old',fault+' does not run the session here');
  t.setFault('');t.reload();
  const result=await t.transfer();
  assert.equal(result.session.runningOn,'inst_handoff_new',fault+': the second Continue Here finishes');
  assert.equal(t.state().current.runningOn,'inst_handoff_new');
  assert.equal(t.state().claims,2,'the second attempt writes its own claim');
  assert.notEqual(t.state().requests[0].handoffToken,t.state().requests[1].handoffToken);
  assert.equal(t.state().claim.observedContentFingerprint,'f'.repeat(64),'the claim records what this device observed');
}
// Between the two attempts the old owner kept studying and published it
// before it saw this device's claim. This device's copy is still exactly what
// its own claim observed, so the newer session is taken first, as when
// catching up with another owner.
{
  const t=acquiringHarness('claim-crash');
  await assert.rejects(t.transfer(),error=>error?.code==='SESSION_CONTINUE_INCOMPLETE');
  assert.equal(t.state().claim.ownedHere,true);
  const ahead={...t.previous,revision:12,snapshot:{label:'more study on the other device'}};
  t.setSourceSession(ahead);t.setFault('');t.reload();
  const result=await t.transfer();
  assert.equal(result.session.runningOn,'inst_handoff_new');
  assert.equal(result.session.snapshot.label,'more study on the other device','the old owner\'s later study comes with it');
  assert.equal(t.state().requests[1].observedRevision,12,'the new claim observes the newer session');
  assert.equal(t.state().requests[1].observedContentFingerprint,'0'.repeat(64));
}
// If this device's copy changed since its own claim, Drive's newer session is
// not provably a continuation: sync first.
{
  const t=acquiringHarness('claim-crash');
  await assert.rejects(t.transfer(),error=>error?.code==='SESSION_CONTINUE_INCOMPLETE');
  const changed={...t.previous,snapshot:{label:'changed here'}};
  t.setCurrent(changed);
  t.setSourceSession({...t.previous,revision:12,snapshot:{label:'more study on the other device'}});t.setFault('');t.reload();
  await assert.rejects(t.transfer(changed),error=>error?.code==='SESSION_CONTINUE_SYNC_REQUIRED');
  assert.deepEqual(t.state().current,changed,'nothing here is overwritten');
  assert.equal(t.state().claims,1,'nothing more is claimed');
}
// The usual case: this device's copy is behind the owner's, because the owner
// kept studying after this device last synced. When the owner's claim shows it
// took over from exactly this device's copy, the newer session is taken first
// and ownership moves, in the same Continue Here.
{
  const t=acquiringHarness(),ahead={...t.previous,revision:12,snapshot:{label:'more study on the other device'}};
  t.setSourceSession(ahead);
  t.setClaim({epoch:3,state:'owned',applies:true,ownedHere:false,ownerToken:OLD_OWNER,observedOwnerToken:OWN_CLAIM_OWNER,
    observedRevision:9,revision:10,observedContentFingerprint:'f'.repeat(64),handoffToken:'99999999-9999-4999-8999-999999999999'});
  const result=await t.transfer();
  assert.equal(result.session.runningOn,'inst_handoff_new','the handoff completes without a separate sync');
  assert.equal(result.session.snapshot.label,'more study on the other device','the owner\'s later study comes with it');
  assert.equal(t.state().claims,1);
}
// The other device studied on after this device last synced, with no claim
// in between. This copy is still exactly what this device last shared through
// Drive, so the newer session only adds to it: taken first, in one press.
{
  const t=acquiringHarness(),ahead={...t.previous,revision:12,snapshot:{label:'more study on the other device'}};
  t.setSourceSession(ahead);t.setShared('f'.repeat(64));
  const result=await t.transfer();
  assert.equal(result.session.runningOn,'inst_handoff_new','Continue Here finishes in one press');
  assert.equal(result.session.snapshot.label,'more study on the other device','the other device\'s later study comes with it');
  assert.equal(t.state().requests[0].observedRevision,12,'the claim observes the newer session');
  assert.deepEqual(t.state().syncs,['session-continue']);
}
for(const [label,shared,snapshot] of [
  ['this copy changed since it was last shared','1'.repeat(64),{label:'more study on the other device'}],
  ['the newer session needs attachment bytes','f'.repeat(64),{label:'remote with missing attachment'}]
]){
  const t=acquiringHarness();
  t.setSourceSession({...t.previous,revision:12,snapshot});t.setShared(shared);
  await assert.rejects(t.transfer(),error=>error?.code==='SESSION_CONTINUE_SYNC_REQUIRED',label+': sync first');
  assert.equal(t.state().claims,0,label+': nothing is claimed');
  assert.equal(t.state().current.snapshot.label,'original',label+': nothing here changes');
}
{
  // Without a claim or a shared copy that proves it, a newer copy is synced first.
  const t=acquiringHarness();
  t.setSourceSession({...t.previous,revision:12,snapshot:{label:'more study on the other device'}});
  await assert.rejects(t.transfer(),error=>error?.code==='SESSION_CONTINUE_SYNC_REQUIRED');
  assert.deepEqual(t.state().syncs,['session-handoff-source-advanced'],'a sync starts at once so Continue Here can be tried again');
  assert.equal(t.state().claims,0,'nothing is claimed');
}
{
  // A newer session that needs attachment bytes always goes through sync.
  const t=acquiringHarness('claim-crash');
  await assert.rejects(t.transfer(),error=>error?.code==='SESSION_CONTINUE_INCOMPLETE');
  t.setSourceSession({...t.previous,revision:12,snapshot:{label:'remote with missing attachment'}});t.setFault('');t.reload();
  await assert.rejects(t.transfer(),error=>error?.code==='SESSION_CONTINUE_SYNC_REQUIRED');
  assert.equal(t.state().current.runningOn,'inst_handoff_old');
}

// Exercise the real transactional compare-and-write primitive. Compensation
// may replace an exact canonical predecessor, never a concurrently changed one.
{
  const repositorySource=fs.readFileSync(new URL('../../../source/core/repositories.js',import.meta.url),'utf8');
  const begin=repositorySource.indexOf('async function idbPutActiveSession('),end=repositorySource.indexOf('\n}',begin);
  assert.ok(begin>0&&end>begin,'production conditional IndexedDB writer exists');
  const production=repositorySource.slice(begin,end+2);
  const before={id:'active',date:'2026-10-27',runningOn:'inst_handoff_old',revision:10},
    adopted={...before,runningOn:'inst_handoff_new',revision:11};
  async function transactionCase(stored,expected){
    let writes=0,aborted=false,actual=structuredClone(stored);
    const run=(_stores,_mode,body)=>new Promise((resolve,reject)=>{
      const finish=(ok,value)=>ok?resolve(value):reject(value);
      const tx={oncomplete:null,onabort:null,abort:()=>{aborted=true;},
        objectStore:()=>({
          get:()=>{const req={result:null,onsuccess:null,onerror:null};queueMicrotask(()=>{req.result=actual;req.onsuccess?.();});return req;},
          put:value=>{writes++;actual=structuredClone(value);const req={onerror:null};queueMicrotask(()=>tx.oncomplete?.());return req;}
        })
      };
      body(tx,finish);
    });
    const context=vm.createContext({
      ACTIVE_SESSION_ID:'active',DB_ACTIVE_SESSION_STORE:'sessions',DB_APP_META_STORE:'meta',
      ActiveSessionCodec:{sanitizeCurrent:value=>value},
      sameDataValue:(left,right)=>JSON.stringify(left)===JSON.stringify(right),
      idbStrictTransaction:run,idbTransaction:run,stageCanonicalMutationEpoch:()=>{},
      assertWriteToken:()=>{},canonicalRuntimeError:message=>new Error(message)
    });
    vm.runInContext(production+'\nglobalThis.write=idbPutActiveSession;',context);
    let rejected=false;
    try{await context.write(adopted,null,true,expected);}catch(error){rejected=true;}
    return {writes,aborted,rejected,actual};
  }
  const exact=await transactionCase(before,before);
  assert.equal(exact.writes,1,'unchanged canonical predecessor permits one strict write');
  assert.equal(exact.rejected,false);
  assert.equal(exact.actual.runningOn,'inst_handoff_new');
  const concurrent=await transactionCase({...before,snapshot:{label:'late local study'}},before);
  assert.equal(concurrent.writes,0,'changed canonical predecessor is never overwritten');
  assert.equal(concurrent.aborted,true,'the transaction explicitly aborts on mismatch');
  assert.equal(concurrent.rejected,true);
  assert.equal(concurrent.actual.snapshot.label,'late local study','unshared work remains canonical');
}

// A normal cross-device sync must not stop/reset a local session if the
// suspended evidence reached only the browser recovery envelope, not IndexedDB.
{
  const src=[
    productionFunction('async function requireCanonicalSessionWrite(saved,expected,operation='),
    productionFunction('async function yieldSessionToOtherDevice(options={}){')
  ].join('\n');
  const oldSession={date:'2026-10-27',runningOn:'inst_local',revision:4,status:'suspended',snapshot:{review:'before yield'}};
  for(const valid of [false,true]){
    let resets=0,stops=0,panelChanges=0,notices=0;
    const app={
      Object,Date,Promise,
      TASKS:[{}],sessionPanelMode:'active',todayISO:()=> '2026-10-27',TIMER_MODES:{SUSPENDED:'suspended'},SessionLifecycle:{run:async(_action,_options,work)=>work()},
      PracticePacer:{pauseForSessionEnd:()=>{stops++;}},
      activeSessionPayload:()=>oldSession,
      AppData:{activeSession:{
        save:async()=>valid?{ok:true,value:oldSession,storage:{idb:true}}:
          {ok:true,value:oldSession,storage:{idb:false,local:true},error:new Error('IndexedDB unavailable')},
        load:async()=>({ok:true,value:oldSession,storage:{idb:true}})
      }},
      ActiveSessionCodec:{sanitizeCurrent:value=>value},
      CanonicalModule:{same:(left,right)=>JSON.stringify(left)===JSON.stringify(right)},
      resetRuntimeSessionState:()=>{resets++;},
      setSessionPanelMode:()=>{panelChanges++;},
      refreshPlanAfterSessionReset:()=>{},
      setTimerMode:()=>{},
      updateExecutePanels:()=>{},
      Interactions:{notify:()=>{notices++;}},
      sessionYieldedAt:0
    };
    const context=vm.createContext(app);
    vm.runInContext(src+'\nglobalThis.yieldSession=yieldSessionToOtherDevice;',context);
    if(!valid){
      await assert.rejects(context.yieldSession(),/IndexedDB unavailable/u,'rescue-only session is not a safe cross-device yield');
      assert.equal(resets,0,'failed canonical save cannot discard the local live state');
      assert.equal(panelChanges,0,'failed canonical save does not announce a suspended session');
      assert.equal(notices,0);
    }else{
      assert.equal(await context.yieldSession({deferReview:true}),true);
      assert.equal(resets,1);
      assert.equal(panelChanges,1);
      assert.equal(notices,1);
    }
    assert.equal(stops,1,'the Practice Pacer is quiesced before the ownership transition');
  }
}

// A session built for Suspend or for handing over takes its stored form only
// when saved (the codec accepts stored forms alone), so both must check the
// strict read-back against what was saved, not against the built copy. A
// built copy can never pass that check, which left Suspend failing every time
// and a device that lost the session retrying its sync for good.
{
  const src=[
    productionFunction('async function requireCanonicalSessionWrite(saved,expected,operation='),
    productionFunction('async function yieldSessionToOtherDevice(options={}){'),
    productionFunction('async function suspendTodaySession(){')
  ].join('\n');
  for(const readBack of ['exact','different']){
    let stored=null,resets=0,statuses=[];
    const built={date:'2026-10-27',runningOn:'inst_local',revision:4,status:'active',suspendedAt:null,snapshot:{review:'built'}};
    const app={
      Object,Date,Promise,Error,
      TASKS:[{}],sessionPanelMode:'active',todayISO:()=> '2026-10-27',TIMER_MODES:{SUSPENDED:'suspended'},SessionLifecycle:{run:async(_action,_options,work)=>work()},
      PracticePacer:{pauseForSessionEnd:()=>{}},flushLiveDraft:async()=>true,appCanMutate:()=>true,
      activeSessionPayload:(_snapshot,options={})=>({...structuredClone(built),status:options.status||built.status,suspendedAt:options.suspendedAt||null}),
      AppData:{activeSession:{
        save:async value=>{stored={...structuredClone(value),stored:true};return {ok:true,value:stored,storage:{idb:true}};},
        load:async()=>({ok:true,value:readBack==='exact'?stored:{...stored,snapshot:{review:'other'}},storage:{idb:true}})
      }},
      // Like the real codec: only a stored form is current.
      ActiveSessionCodec:{sanitizeCurrent:value=>value&&value.stored===true?value:null},
      CanonicalModule:{same:(left,right)=>JSON.stringify(left)===JSON.stringify(right)},
      resetRuntimeSessionState:()=>{resets++;},setSessionPanelMode:()=>{},refreshPlanAfterSessionReset:()=>{},
      setTimerMode:()=>{},updateExecutePanels:()=>{},setPlanStatus:text=>{statuses.push(String(text));},
      BackupProviderRuntime:{connected:()=>false},notifyBackupChange:()=>{},
      Interactions:{notify:()=>{},confirm:async()=>true},sessionYieldedAt:0
    };
    const context=vm.createContext(app);
    vm.runInContext(src+'\nglobalThis.yieldSession=yieldSessionToOtherDevice;globalThis.suspendSession=suspendTodaySession;',context);
    if(readBack==='exact'){
      assert.equal(await context.yieldSession({deferReview:true}),true,'handing over saves the suspended session and stops here');
      assert.equal(stored.status,'suspended');
      await context.suspendSession();
      assert.equal(resets,2,'Suspend stops the session once it is saved');
      assert.ok(!statuses.some(text=>/Could not suspend/u.test(text)),statuses.join(' / '));
    }else{
      await assert.rejects(context.yieldSession({deferReview:true}),/read-back differs/u,'a read-back that differs still stops the hand-over');
      await context.suspendSession();
      assert.equal(resets,0,'and keeps the live session');
      assert.ok(statuses.some(text=>/Could not suspend/u.test(text)));
    }
  }
}

// BF-1R1: the Saved Day acknowledgement must survive strict canonical
// readback before the app can declare this study revision saved.
{
  const src=[
    productionFunction("async function requireCanonicalSessionWrite(saved,expected,operation='active-session transition'){"),
    productionFunction('async function acknowledgeSavedStudyDay(date,revision){'),
    productionFunction('async function clearCanonicalSessionAfterSavedDay(){')
  ].join('\n');
  const date='2026-08-27';
  const prepare=(failure='')=>{
    let recorded=null,acknowledged=0,clears=0;
    const sessionState={savedRevision:0,contentRevision:7,studyDate:date};
    const context=vm.createContext({
      TASKS:[{}],TimerState:sessionState,
      getReviewDate:()=>date,
      cleanDayRevision:value=>Math.max(0,Math.floor(Number(value)||0)),
      writeLiveDraftNow:async options=>{
        assert.equal(options.strictDurability,true);
        assert.equal(options.markChanged,false);
        recorded={date,snapshot:{savedRevision:sessionState.savedRevision,contentRevision:sessionState.contentRevision},revision:10};
        if(failure==='no-receipt')return null;
        if(failure==='local-only')return {ok:true,value:recorded,error:new Error('IndexedDB unavailable'),storage:{idb:false,local:true}};
        return {ok:true,value:recorded,storage:{idb:true}};
      },
      clearSaveReminder:()=>{acknowledged++;},
      requireUnused:()=>{},
      AppData:{activeSession:{
        load:async()=>failure==='mismatched-read'?{ok:true,value:{...recorded,revision:9},storage:{idb:true}}:
          failure==='clear-shadow'?{ok:true,value:{date},storage:{idb:true}}:
          {ok:true,value:recorded,storage:{idb:true}},
        clear:async()=>{clears++;return failure==='clear-local-only'?{ok:true,storage:{idb:false},error:new Error('IndexedDB unavailable')}:{ok:true,storage:{idb:true}};}
      }},
      ActiveSessionCodec:{sanitizeCurrent:v=>v||null},
      CanonicalModule:{same:(a,b)=>JSON.stringify(a)===JSON.stringify(b)},
      Object
    });
    vm.runInContext(src+'\nglobalThis.ack=acknowledgeSavedStudyDay;globalThis.clearDay=clearCanonicalSessionAfterSavedDay;',context);
    return {ack:()=>context.ack(date,7),clear:()=>context.clearDay(),state:()=>({saved:sessionState.savedRevision,acknowledged,clears})};
  };
  const good=prepare();assert.equal(await good.ack(),true);
  assert.equal(good.state().saved,7);assert.equal(good.state().acknowledged,1);
  for(const fault of ['local-only','no-receipt','mismatched-read']){
    const trial=prepare(fault);
    await assert.rejects(trial.ack(),/IndexedDB unavailable|acknowledgement was not saved|read-back differs/u,fault);
    assert.equal(trial.state().saved,0,fault+' must not mark session revision saved');
    assert.equal(trial.state().acknowledged,0);
  }
  const localOnlyClear=prepare('clear-local-only');
  await assert.rejects(localOnlyClear.clear(),/IndexedDB unavailable/u);
  assert.equal(localOnlyClear.state().clears,1);
  const mismatchedClear=prepare('clear-shadow');
  await assert.rejects(mismatchedClear.clear(),/remained after its canonical deletion/u);
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
  const repo=fs.readFileSync(new URL('../../../source/core/repositories.js',import.meta.url),'utf8');
  const signature='async function verifyCanonicalDailyRecord(record){';
  const start=repo.indexOf(signature),end=start<0?-1:repo.indexOf('\n}',start);
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
  const sourceCodec=fs.readFileSync(new URL('../../../source/core/record-codecs.js',import.meta.url),'utf8');
  const signature='function savedDayCoversSessionEvidence(record,session,{allowAdvances=false}={}){';
  const start=sourceCodec.indexOf(signature),end=start<0?-1:sourceCodec.indexOf('\n}',start);
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
  const src=productionFunction('async function saveDayRecordNow(){');
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
    vm.runInContext(src+'\nglobalThis.reviewSave=saveDayRecordNow;',context);
    assert.equal(await context.reviewSave(),success,'suspended save outcome must match canonical finalization');
    assert.equal(events.includes('review-only'),!hasTasks,'only an unloaded suspended session requires review-only hydration');
    assert.deepEqual(events.filter(x=>x==='core'),['core']);
    // A successful save closes the day inside the Review service, while the
    // session's writes are still held; only a failed one restores the panel.
    assert.equal(events.includes('panel:suspended'),!success);
  }
}

console.log(JSON.stringify({status:'PASS',suite:'session-claim-flush-safety',scenarios:57,productionFunctions:true}));
