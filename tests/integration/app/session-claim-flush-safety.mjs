import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../../../source/app.html',import.meta.url),'utf8');
function productionFunction(name){
  const start=source.indexOf(name),end=start<0?-1:source.indexOf('\n}',start);
  assert.ok(start>=0&&end>start, `Production function missing: ${name}`);
  return source.slice(start,end+2);
}
const saveWarning=source.match(/^const SESSION_CLAIM_SAVE_WARNING=.*;$/mu)?.[0];
assert.ok(saveWarning,'Production session-claim warning must exist.');
const runtime=[saveWarning,productionFunction('async function requireCanonicalSessionWrite(saved,expected,operation=\'active-session transition\'){'),productionFunction('async function verifyFrozenSessionClaim(){'),productionFunction('function resumeAfterReleasedSessionClaim(session){'),productionFunction('async function checkSessionOwnershipClaim(){'),productionFunction('function writeLiveDraftNow(options={}){'),productionFunction('function snapshotWhileSessionClaimFrozen(){')].join('\n');

const owned={epoch:2,applies:true,state:'owned',ownedHere:false};
const session={runningOn:'inst_local',revision:4};
const saved={ok:true,value:{...session,revision:5},storage:{local:false,idb:true}};
const localOnly={ok:true,value:{...session,revision:5},storage:{local:true,idb:false},error:new Error('IndexedDB unavailable')};
const failed={ok:false,value:{...session,revision:5},storage:{local:false,idb:false},error:new Error('Both local stores unavailable')};
const loaded=value=>({ok:true,value,storage:{local:false,idb:true}});
function harness(){
  let claim={...owned},now=100000,sessionValue={...session},saves=[],loads=[],captureFailure=false,resumeWorks=true,reviewText='Retain the last edits';
  const calls={stops:0,resumes:0,snapshots:[],captureEvidenceArgs:[],evidences:[],writes:[],syncs:[],warnings:[],status:[],captures:[],changed:0,cancelled:0};
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
    TimerEngine:{stopExecution:()=>{calls.stops++;return true;},resumeAfterPrimaryRestore:()=>{calls.resumes++;return resumeWorks;}},
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
    clearSessionSafetyMessage:()=>{vm.runInContext("sessionSafetyMessage='';",context);},
    Object,
    SESSION_CLAIM_SYNC_RETRY_MS:30000
  };
  const context=vm.createContext(app);
  vm.runInContext(`let sessionClaimFreeze=null,sessionClaimCheckActive=false,sessionSafetyMessage='';\n${runtime}\nglobalThis.check=checkSessionOwnershipClaim;globalThis.liveWrite=writeLiveDraftNow;globalThis.state=()=>({freeze:sessionClaimFreeze,warning:sessionSafetyMessage,active:sessionClaimCheckActive});`,context,{filename:'production-session-claim.js'});
  return {calls,check:()=>context.check(),liveWrite:options=>context.liveWrite(options),state:()=>context.state(),saves,loads,setClaim:v=>{claim=v;},setLocal:v=>{sessionValue=v;},setNow:v=>{now=v;},setResumeWorks:v=>{resumeWorks=v;},setReviewText:v=>{reviewText=v;},failCapture:()=>{captureFailure=true;},setTasks:v=>{context.TASKS=v;}};
}
const good=()=>loaded({...session,revision:5});

// A normal remote claim must persist and reread the frozen snapshot before sync.
{
  const t=harness();t.loads.push(loaded(session),good());t.saves.push(saved);
  assert.equal(await t.check(),true);
  assert.equal(t.calls.stops,1);
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
  t.setNow(131000);t.loads.push(loaded(session));await t.check();
  assert.equal(t.calls.syncs.length,2,'an existing frozen claim retains its 30 s sync cadence');
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

// Independently exercise the acquiring device's production Continue Here
// function. A success requires both a Drive claim and an exact canonical
// IndexedDB receipt; a partial claim is never silently treated as success.
const handoffConstants=[
  source.match(/^const sessionHandoffError=.*;$/mu)?.[0],
  source.match(/^const HANDOFF_SAFETY_FORMAT=.*;$/mu)?.[0],
  source.match(/^const HANDOFF_LEGACY_SAFETY_FORMAT=.*;$/mu)?.[0],
  source.match(/^const HANDOFF_ATTEMPT_PATTERN=.*;$/mu)?.[0],
  source.match(/^const HANDOFF_FINGERPRINT_PATTERN=.*;$/mu)?.[0],
  source.match(/^const HANDOFF_UNCERTAIN_MESSAGE=.*;$/mu)?.[0]
];
assert.ok(handoffConstants.every(Boolean));
const acquireRuntime=[
  ...handoffConstants,
  productionFunction('function pendingSessionHandoffSafety(){'),
  productionFunction('function armSessionHandoffSafety(session,checkpointId,'),
  productionFunction('function validSessionHandoffSafety(marker,session){'),
  productionFunction('function handoffClaimMatches(marker,claim){'),
  productionFunction('async function resolveSessionHandoffSafety(session){'),
  productionFunction('function clearSessionHandoffSafety(){'),
  productionFunction('async function requireCanonicalSessionWrite(saved,expected,operation='),
  productionFunction('async function transferSessionOwnershipHere(session,')
].join('\n');
function acquiringHarness(fault='',draft='SEPARATE-PLAN-DRAFT'){
  const previous={date:'2026-10-27',runningOn:'inst_handoff_old',revision:10,status:'active',snapshot:{label:'original'},scheduleText:'07:00 | 30 | Work | work | Ethics | block | 1'};
  let current=structuredClone(previous),claims=0,compensations=0,backgroundReleases=0,notify=0,faultMode=fault,remoteClaim=null,head='cp_'+'a'.repeat(32),id=0;
  const storage=new Map();
  const app={
    document:{getElementById:id=>id==='plan-input'?{value:faultMode==='display-mismatch'?'UNSAVED-UNMATCHED':draft===null?'FALLBACK DEFAULT':draft}:null},
    navigator:{onLine:true},Date,Promise,Object,JSON,
    crypto:{randomUUID:()=>('00000000-0000-4000-8000-'+String(++id).padStart(12,'0'))},
    appCanMutate:()=>true,
    getActiveDefaults:()=>({scheduleText:'FALLBACK DEFAULT'}),
    PlanDraftEditor:{flush:async()=>true},
    PlanData:{settled:async()=>{if(faultMode==='draft-fail')throw new Error('draft write failed');},readDraft:()=>draft},
    AppData:{
      local:{
        setJson:(key,value)=>(storage.set(key,structuredClone(value)),true),
        getJson:(key,fallback)=>storage.has(key)?storage.get(key):fallback,
        remove:key=>faultMode==='clear-fail'?false:(storage.delete(key),true)
      },
      planData:{read:async()=>({draft:faultMode==='draft-mismatch'?'OTHER DRAFT':draft})},
      activeSession:{
        save:async value=>{
          if(['local-only','claim-crash'].includes(faultMode)&&value.runningOn==='inst_handoff_new')
            return {ok:true,value,error:new Error('IndexedDB failed'),storage:{idb:false,local:true}};
          current=structuredClone(value);return {ok:true,value:current,storage:{idb:true,local:false}};
        },
        load:async()=>{
          const content=faultMode==='different-read'&&current.runningOn==='inst_handoff_new'?
            {...current,snapshot:{...current.snapshot,label:'unexpected concurrent progress'}}:current;
          return {ok:true,value:content,storage:{idb:true,local:false}};
        }
      }
    },
    STORAGE_KEYS:{sessionHandoffSafety:'test-session-handoff'},
    InstallationIdentity:{getId:()=> 'inst_handoff_new'},
    ActiveSessionCodec:{sanitizeCurrent:value=>value||null},
    CanonicalModule:{same:(a,b)=>JSON.stringify(a)===JSON.stringify(b)},
    activeSessionContentFingerprint:async()=> 'f'.repeat(64),
    BackupCodec:{assetIds:()=>[]},
    nextSessionRevision:value=>Number(value)+1,
    setPlanStatus:()=>{},handleActiveSessionRepositoryResult:()=>true,
    AppDiagnostics:{capture:()=>{}},
    notifyBackupChange:()=>{notify++;},
    BackupProviderRuntime:{
      connected:()=>true,
      readSessionClaim:async()=>remoteClaim,
      readSessionHandoffSource:async()=>({status:'completed',checkpointId:head,observedOwnerToken:'e'.repeat(64),session:previous}),
      suspendBackground:()=>({settled:Promise.resolve(),release:()=>{backgroundReleases++;}}),
      claimSessionOwnership:async(_provider,request)=>{
        claims++;
        if(faultMode==='claim-throws-before-remote')throw new Error('claim did not reach Drive');
        remoteClaim={epoch:1,state:'owned',applies:true,ownedHere:true,ownerToken:'d'.repeat(64),
          observedOwnerToken:'e'.repeat(64),observedRevision:request.observedRevision,
          observedContentFingerprint:request.observedContentFingerprint,handoffToken:request.handoffToken,
          revision:request.revision};
        if(faultMode==='claim-throws-after-remote')throw new Error('claim accepted but response lost');
        return {status:'completed',claim:remoteClaim};
      },
      releaseSessionClaim:async()=>{
        compensations++;
        if(faultMode==='claim-crash')return false;
        remoteClaim={...remoteClaim,epoch:remoteClaim.epoch+1,ownedHere:false,ownerToken:'e'.repeat(64),
          observedOwnerToken:'d'.repeat(64),observedRevision:remoteClaim.revision,
          revision:previous.revision,observedContentFingerprint:''};
        return true;
      },
      wakeBackground:()=>true,scheduleSharedSync:()=>true
    }
  };
  let context;
  const boot=()=>{
    context=vm.createContext({...app});
    vm.runInContext(acquireRuntime+'\nglobalThis.takeOver=transferSessionOwnershipHere;globalThis.recover=resolveSessionHandoffSafety;',context,{filename:'production-handoff-acquisition.js'});
  };
  boot();
  return {previous,transfer:()=>context.takeOver(previous),reload:boot,recover:()=>context.recover(structuredClone(current)),
    setFault:value=>{faultMode=value;},setHead:value=>{head=value;},
    setCurrent:value=>{current=structuredClone(value);},setClaim:value=>{remoteClaim=value;},
    setOffline:value=>{app.navigator.onLine=!value;},
    state:()=>({current,claim:remoteClaim,claims,compensations,backgroundReleases,notify,marker:storage.get('test-session-handoff')||null})};
}
{
  const t=acquiringHarness();
  const result=await t.transfer(),state=t.state();
  assert.equal(result.session.runningOn,'inst_handoff_new');
  assert.equal(state.current.runningOn,'inst_handoff_new');
  assert.equal(state.claims,1);
  assert.equal(state.compensations,0);
  assert.equal(state.marker,null,'successful handoff clears its crash-recovery latch');
  assert.equal(state.notify,1,'only verified ownership is published as a local change');
  assert.equal(state.backgroundReleases,1);
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
  assert.equal(state.marker,null,'verified compensation retires the safety latch');
  assert.equal(state.notify,0);
}
{
  const t=acquiringHarness('different-read');
  await assert.rejects(t.transfer(),error=>error?.code==='SESSION_CONTINUE_ROLLBACK_UNCERTAIN','unexpected same-revision content is not a verified handoff');
  const state=t.state();
  assert.equal(state.claims,1);
  assert.equal(state.compensations,0,'divergent canonical progress is not overwritten by an unsafe rollback');
  assert.ok(state.marker,'uncertain ownership is durably latched for recovery after reload');
  assert.equal(state.notify,0);
}
{
  const t=acquiringHarness('draft-fail');
  await assert.rejects(t.transfer(),/draft write failed/u);
  const state=t.state();
  assert.equal(state.claims,0,'no remote claim is attempted before the Plan-draft write settles');
  assert.equal(state.marker,null);
  assert.equal(state.current.runningOn,'inst_handoff_old');
}


// BF-1R3: the exact interrupted claim can be adopted after a fresh VM boot,
// without republishing it or silently recovering unrelated data.
for(const fault of ['claim-crash','claim-throws-after-remote']){
  const t=acquiringHarness(fault);
  await assert.rejects(t.transfer(),error=>error?.code==='SESSION_CONTINUE_ROLLBACK_UNCERTAIN');
  assert.equal(t.state().current.runningOn,'inst_handoff_old');
  assert.ok(t.state().marker,'the preclaim marker survives a failed/unknown acquisition');
  assert.equal(t.state().claim?.handoffToken,t.state().marker.handoffToken,'remote and local evidence name the same attempt');
  t.setFault('');t.reload();
  assert.equal(await t.recover(),true,'an identical remote claim is adoptable after reload');
  assert.equal(t.state().current.runningOn,'inst_handoff_new');
  assert.equal(t.state().marker,null);
  assert.equal(t.state().claims,1,'recovery must not publish a second claim');
  assert.equal(await t.recover(),true,'recovery is idempotent');
}
// Strict local commit succeeded, but the marker could not be cleared;
// subsequent verification must not rewrite the already-committed session.
{
  const t=acquiringHarness('clear-fail');
  await assert.rejects(t.transfer(),error=>error?.code==='SESSION_CONTINUE_ROLLBACK_UNCERTAIN');
  assert.equal(t.state().current.runningOn,'inst_handoff_new');
  t.setFault('');t.reload();
  assert.equal(await t.recover(),true);
  assert.equal(t.state().marker,null);
  assert.equal(t.state().claims,1);
}
// No claim accepted: verify the unchanged remote source, retire the latch,
// but never start the timer or claim automatically.
{
  const t=acquiringHarness('claim-throws-before-remote');
  await assert.rejects(t.transfer(),error=>error?.code==='SESSION_CONTINUE_ROLLBACK_UNCERTAIN');
  t.setFault('');t.reload();
  assert.equal(await t.recover(),true);
  assert.equal(t.state().current.runningOn,'inst_handoff_old');
  assert.equal(t.state().claims,1);
}
// A changed verified checkpoint, mismatching claim token, a divergent local
// snapshot or offline Drive must keep recovery blocked with the marker intact.
for(const mode of ['changed-head','different-claim','divergent-local','offline']){
  const t=acquiringHarness('claim-crash');
  await assert.rejects(t.transfer(),error=>error?.code==='SESSION_CONTINUE_ROLLBACK_UNCERTAIN');
  if(mode==='changed-head')t.setHead('cp_'+'b'.repeat(32));
  if(mode==='different-claim')t.setClaim({...t.state().claim,handoffToken:'ffffffff-ffff-4fff-8fff-ffffffffffff'});
  if(mode==='divergent-local')t.setCurrent({...t.state().current,snapshot:{label:'unpublished new work'}});
  if(mode==='offline')t.setOffline(true);
  t.setFault('');t.reload();
  assert.equal(await t.recover(),false,mode+' must remain blocked');
  assert.ok(t.state().marker,mode+' retains durable recovery evidence');
  assert.equal(t.state().current.runningOn,'inst_handoff_old',mode+' cannot steal ownership');
  assert.equal(t.state().claims,1,mode+' cannot publish a second claim');
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
      TASKS:[{}],todayISO:()=> '2026-10-27',TIMER_MODES:{SUSPENDED:'suspended'},SessionLifecycle:{run:async(_action,_options,work)=>work()},
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
    const memory=new Set(['2026-08-27']);
    const context=vm.createContext({
      TASKS:[{}],TimerState:sessionState,savedRecordDates:memory,
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
    return {ack:()=>context.ack(date,7),clear:()=>context.clearDay(),state:()=>({saved:sessionState.savedRevision,acknowledged,clears,memory})};
  };
  const good=prepare();assert.equal(await good.ack(),true);
  assert.equal(good.state().saved,7);assert.equal(good.state().acknowledged,1);
  for(const fault of ['local-only','no-receipt','mismatched-read']){
    const trial=prepare(fault);
    await assert.rejects(trial.ack(),/IndexedDB unavailable|acknowledgement was not saved|read-back differs/u,fault);
    assert.equal(trial.state().saved,0,fault+' must not mark session revision saved');
    assert.equal(trial.state().acknowledged,0);
    assert.equal(trial.state().memory.size,0,'invalidated saved-date cache cannot suppress a later reminder');
  }
  const localOnlyClear=prepare('clear-local-only');
  await assert.rejects(localOnlyClear.clear(),/IndexedDB unavailable/u);
  assert.equal(localOnlyClear.state().clears,1);
  const mismatchedClear=prepare('clear-shadow');
  await assert.rejects(mismatchedClear.clear(),/remained after its canonical deletion/u);
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
    ['different saved-day revision',{...saved,sourceRevision:8},snapshot,false],
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
}

// A saved calendar date is not enough to suppress the user's Save Today
// reminder. The current Active Session must carry its own verified receipt.
{
  const src=productionFunction('async function savedRecordExistsForDate(date){');
  const date='2026-08-27',record={date,recordKind:'study'};
  for(const [label,mode,covered,expected] of [
    ['canonical covered session','committed',true,true],
    ['different study evidence','committed',false,false],
    ['session not acknowledged','unsaved',true,false],
    ['local-only session','rescue',true,false],
    ['no session','missing',true,false],
    ['strict Saved Day read fails','failed-day-read',true,false]
  ]){
    const cache=new Set(),pending=new Map(),session={date,snapshot:{contentRevision:7,savedRevision:mode==='unsaved'?6:7}};
    let dayReads=0;
    const context=vm.createContext({
      daySaveDirty:()=>false,
      savedRecordDates:cache,savedRecordCheckPromises:pending,
      cleanDayRevision:v=>Number(v)||0,
      AppData:{
        activeSession:{load:async()=>({ok:true,value:mode==='missing'?null:session,storage:{idb:mode!=='rescue'}})},
        dailyRecords:{
          documents:async()=>{dayReads++;if(mode==='failed-day-read')throw new Error('IndexedDB failed');return [record];},
          verifyCanonical:async()=>true
        }
      },
      DailyRecordCodec:{savedDayCoversSessionEvidence:()=>covered},
      AppDiagnostics:{capture:()=>{}},
      Object
    });
    vm.runInContext(src+'\nglobalThis.hasSaved=savedRecordExistsForDate;',context);
    assert.equal(await context.hasSaved(date),expected,label);
    assert.equal(cache.has(date),expected,label+' memoization');
    assert.equal(await context.hasSaved(date),expected,label+' replay');
    assert.equal(dayReads,expected?1:mode==='failed-day-read'?2:mode==='committed'?2:0,label+' canonical query gate');
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

console.log(JSON.stringify({status:'PASS',suite:'session-claim-flush-safety',scenarios:57,productionFunctions:true}));
