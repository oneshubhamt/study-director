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

console.log(JSON.stringify({status:'PASS',suite:'session-claim-flush-safety',scenarios:18,productionFunctions:true}));
