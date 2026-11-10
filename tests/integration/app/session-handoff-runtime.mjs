import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readCoreScript} from '../../helpers/core-script.mjs';

const context={Object,Symbol,TypeError,Error,Promise,console};context.globalThis=context;vm.createContext(context);
for(const name of ['internal','session-handoff'])vm.runInContext(readCoreScript(name),context,{filename:'source/core/'+name+'.js'});
const registry=context[Symbol.for('studyDirector.internalModules.v1')],module=registry.require('session-handoff',1);
const DATE='2026-10-27',LOCAL='inst_local',REMOTE='inst_remote',CHECKPOINT='cp_'+'a'.repeat(32),FINGERPRINT='f'.repeat(64);
const sessionBase={id:'active',type:'activeSession',version:1,revision:10,date:DATE,status:'active',runningOn:LOCAL,scheduleText:'07:00 | 30 | Work | work | Ethics | units | 1',snapshot:{version:1,date:DATE,fingerprint:'x',contentRevision:1,savedRevision:0,currentTaskId:null,taskState:{},scheduleAdjustments:{},timerRuntime:{token:'timer'},latestCarryForward:'',updatedAt:'2026-10-27T08:00:00.000Z',review:{reflection:'',studyQuality:null},practice:{token:'practice'}},suspendedAt:null,updatedAt:'2026-10-27T08:00:00.000Z'};
const result=value=>({ok:true,value,storage:{idb:true,local:false}});
function makeHarness(options={}){
  let now=100000,current=structuredClone(options.current||sessionBase),claim=options.claim||{epoch:2,applies:true,state:'owned',ownedHere:false},tasks=options.tasks!==false;
  let captureNo=0,claimWrites=0,releaseWorks=options.releaseWorks!==false,source=structuredClone(options.source||current),remoteClaim=claim;
  const calls={stops:0,resumes:0,syncs:[],writes:[],captures:[],evidence:0,warnings:[],status:[],notices:0,notes:0,releases:0,resets:0,pauses:0,lifecycles:[],claimReads:0,sessionLoads:0};
  const strictQueue=[];
  const host={
    captureSnapshot:evidence=>{
      captureNo++;const snap=structuredClone(current.snapshot);snap.token=captureNo;snap.review={reflection:options.reflection?.()||'',studyQuality:null};if(evidence)snap.evidence=evidence;calls.captures.push(snap);return snap;
    },
    writeSnapshot:async(snapshot,writeOptions)=>{
      calls.writes.push({kind:'snapshot',snapshot:structuredClone(snapshot),options:writeOptions});
      if(strictQueue.length){const next=strictQueue.shift();if(next instanceof Error)throw next;if(next===null)return null;if(next.storage?.idb===false)return next;}
      current={...current,revision:current.revision+1,snapshot:structuredClone(snapshot),updatedAt:'2026-10-27T08:00:01.000Z'};return result(structuredClone(current));
    },
    requireCanonicalWrite:async(saved,expected)=>{
      if(!saved||saved.ok!==true||saved.error||saved.storage?.idb!==true)throw saved?.error||new Error('canonical write failed');
      if(JSON.stringify(saved.value)!==JSON.stringify(expected))throw new Error('canonical read-back differs');
      return saved;
    },
    saveCanonicalSession:async(value,_operation,saveOptions={})=>{
      calls.writes.push({kind:'canonical',value:structuredClone(value),options:saveOptions});
      if(saveOptions.expectedCanonical&&JSON.stringify(current)!==JSON.stringify(saveOptions.expectedCanonical)){
        const error=Object.assign(new Error('Active Session changed before this save.'),{code:'ACTIVE_SESSION_CHANGED'});throw error;
      }
      if(strictQueue.length){const next=strictQueue.shift();if(next instanceof Error)throw next;if(next===null)throw new Error('canonical write failed');if(next.storage?.idb===false)throw next.error||new Error('canonical write failed');}
      current=structuredClone(value);return result(structuredClone(current));
    },
    load:async()=>{calls.sessionLoads++;return result(structuredClone(current));},
    payload:(snapshot,payloadOptions={})=>({...structuredClone(current),status:payloadOptions.status||'active',runningOn:LOCAL,revision:current.revision+1,suspendedAt:payloadOptions.suspendedAt||null,snapshot:structuredClone(snapshot),updatedAt:'2026-10-27T08:00:02.000Z'}),
    cancelPendingLiveDraftSave:()=>true,
    resetRuntime:()=>{calls.resets++;return true;}
  };
  const controller=module.createController(Object.freeze({
    configuration:Object.freeze({providerId:'google-drive',claimWatchMs:15000,claimSyncRetryMs:30000,claimSaveWarning:'SAVE WARNING'}),
    authority:Object.freeze({canMutate:()=>true,startupReady:()=>true,visible:()=>true,online:()=>true,hasTasks:()=>tasks,panelElsewhere:()=>false}),
    provider:Object.freeze({
      connected:()=>true,
      readHandoffSource:async()=>({status:'completed',checkpointId:CHECKPOINT,session:source,priorClaim:remoteClaim,sharedContentFingerprint:options.shared||''}),
      claimOwnership:async(_id,ask)=>{
        const decision=await ask.decide({status:'completed',checkpointId:CHECKPOINT,session:source,priorClaim:remoteClaim,sharedContentFingerprint:options.shared||''});
        claimWrites++;ask.onWrite();
        if(options.claimFailure==='before')throw new Error('claim response failed');
        remoteClaim={epoch:(remoteClaim?.epoch||0)+1,state:'owned',applies:true,ownedHere:true,ownerToken:'mine',observedOwnerToken:'old',observedRevision:decision.observedRevision,observedContentFingerprint:decision.observedContentFingerprint,revision:decision.revision};
        if(options.claimFailure==='after')throw new Error('claim response lost');
        return {status:'completed',claim:{revision:decision.revision,epoch:remoteClaim.epoch,state:'owned'}};
      },
      releaseClaim:async()=>{calls.releases++;return releaseWorks;},
      readClaim:async()=>{calls.claimReads++;return claim;},
      scheduleSync:(_id,reason)=>{calls.syncs.push(reason);return true;},
      suspendBackground:()=>({settled:Promise.resolve(),release:()=>true}),
      wakeBackground:()=>true
    }),
    session:Object.freeze({
      host,sanitize:value=>value&&typeof value==='object'?value:null,
      same:(a,b)=>JSON.stringify(a)===JSON.stringify(b),
      nextRevision:value=>Number(value)+1,
      contentFingerprint:async value=>value.snapshot?.fingerprintValue||FINGERPRINT,
      assetIds:value=>value.snapshot?.assets||[]
    }),
    plan:Object.freeze({
      flushDraft:()=>true,settled:()=>Promise.resolve(),readDraft:()=>null,readCanonicalDraft:async()=>null,
      displayedDraft:()=> 'DEFAULT',defaultScheduleText:()=> 'DEFAULT'
    }),
    runtime:Object.freeze({
      markContentChanged:()=>true,
      captureEvidence:()=>{calls.evidence++;return {actualTime:{0:42},actualRecords:{0:{activeSeconds:42}}};},
      stopExecution:()=>{calls.stops++;return true;},
      resumeExecution:()=>{calls.resumes++;return options.resumeWorks!==false;},
      runLifecycle:async(kind,_options,work)=>{calls.lifecycles.push(kind);return work();},
      pausePractice:()=>{calls.pauses++;},todayISO:()=>DATE
    }),
    presentation:Object.freeze({
      capture:()=>{},setStatus:(message,ok)=>calls.status.push({message,ok}),
      warnStorage:message=>calls.warnings.push(message),clearStorageWarning:()=>{},
      notifyNewerClaim:()=>{calls.notices++;},noteBackupChange:()=>{calls.notes++;}
    }),
    installation:Object.freeze({id:()=>LOCAL}),
    clock:Object.freeze({nowMs:()=>now,nowIso:()=> '2026-10-27T08:00:03.000Z'}),
    identity:Object.freeze({uuid:()=> '00000000-0000-4000-8000-000000000001'})
  }));
  return {controller,calls,strictQueue,setNow:value=>{now=value;},setClaim:value=>{claim=value;},setCurrent:value=>{current=structuredClone(value);},setSource:value=>{source=structuredClone(value);},setTasks:value=>{tasks=value;},current:()=>structuredClone(current),claims:()=>claimWrites,setReleaseWorks:value=>{releaseWorks=value;}};
}

// Claim polling cadence is owned by the controller, not by host/provider timers.
{
  const t=makeHarness({claim:null});
  assert.equal(await t.controller.wakeClaim(),false,'a no-op claim read returns false');
  assert.equal(t.calls.claimReads,1);assert.equal(t.calls.sessionLoads,1);
  assert.equal(t.controller.wakeClaim(),false,'same-tick duplicate wake is coalesced');
  assert.equal(t.calls.claimReads,1);
  t.setNow(114990);await t.controller.wakeClaim(1000);
  assert.equal(t.calls.claimReads,2,'the 15 s host tick may arrive a few milliseconds early without becoming a 30 s cadence');
  assert.equal(t.calls.sessionLoads,2,'each remote claim read is paired with a strict local session read');
}

// Remote claim preempts execution before persistence, freezes timing, and only syncs after strict receipt.
{
  const t=makeHarness();assert.equal(await t.controller.checkClaim(),true);
  assert.equal(t.calls.stops,1);assert.equal(t.calls.evidence,1);assert.equal(t.calls.writes.length,1);
  assert.equal(t.calls.syncs[0],'session-claim');assert.equal(t.controller.status().localVerified,true);
  const frozen=t.controller.snapshotForWrite();t.setNow(130000);
  assert.equal(t.controller.snapshotForWrite().timerRuntime.token,frozen.timerRuntime.token,'waiting wall time never becomes study time');
}
// A local-only/failed receipt leaves execution frozen; a retry reuses frozen timing evidence.
{
  const t=makeHarness();t.strictQueue.push({ok:true,value:sessionBase,error:new Error('IndexedDB unavailable'),storage:{idb:false,local:true}});
  assert.equal(await t.controller.checkClaim(),true);assert.equal(t.calls.syncs.length,0);assert.equal(t.controller.status().localVerified,false);assert.equal(t.calls.stops,1);
  assert.equal(await t.controller.checkClaim(),true);assert.equal(t.calls.evidence,1);assert.equal(t.controller.status().localVerified,true);assert.equal(t.calls.syncs.length,1);
}
// Claim returns here only after the frozen evidence is verified; then the same timer can resume.
{
  const t=makeHarness();await t.controller.checkClaim();t.setClaim({epoch:2,applies:true,state:'owned',ownedHere:true});
  assert.equal(await t.controller.checkClaim(),true);assert.equal(t.calls.resumes,1);assert.equal(t.controller.frozen(),false);
}
// Newer claims stop and persist but never trigger a sync this build cannot interpret.
{
  const t=makeHarness({claim:{epoch:4,applies:true,state:'owned',ownedHere:false,newer:true}});
  assert.equal(await t.controller.checkClaim(),true);assert.equal(t.calls.stops,1);assert.equal(t.calls.notices,1);assert.deepEqual(t.calls.syncs,[]);
}
// Successful Continue Here linearizes Drive claim before the strict local owner save.
{
  const remote={...structuredClone(sessionBase),runningOn:REMOTE};const t=makeHarness({current:remote,source:remote});
  const moved=await t.controller.transferHere(remote);
  assert.equal(moved.session.runningOn,LOCAL);assert.equal(t.claims(),1);assert.equal(t.calls.notes,1);assert.deepEqual(t.calls.syncs,['session-continue']);
}
// A genuinely advanced, unproven source starts ordinary sync and writes no ownership claim.
{
  const requested={...structuredClone(sessionBase),runningOn:REMOTE,snapshot:{...structuredClone(sessionBase.snapshot),fingerprintValue:'old'}};
  const advanced={...structuredClone(requested),revision:12,snapshot:{...structuredClone(requested.snapshot),fingerprintValue:'new'}};
  const t=makeHarness({current:requested,source:advanced});
  await assert.rejects(t.controller.transferHere(requested),error=>error?.code==='SESSION_CONTINUE_SYNC_REQUIRED');
  assert.equal(t.claims(),0);assert.deepEqual(t.calls.syncs,['session-handoff-source-advanced']);
}
// A failed local owner save after the claim compensates only over the exact attempted predecessor.
{
  const remote={...structuredClone(sessionBase),runningOn:REMOTE};const t=makeHarness({current:remote,source:remote});
  t.strictQueue.push(new Error('IndexedDB failed'));
  await assert.rejects(t.controller.transferHere(remote),/IndexedDB failed/u);
  assert.equal(t.claims(),1);assert.equal(t.calls.releases,1);assert.equal(t.current().runningOn,REMOTE);
}
// If compensation cannot prove the local predecessor, the retry state is explicit and no timer starts here.
{
  const remote={...structuredClone(sessionBase),runningOn:REMOTE};const t=makeHarness({current:remote,source:remote,releaseWorks:false});
  t.strictQueue.push(new Error('IndexedDB failed'));
  await assert.rejects(t.controller.transferHere(remote),error=>error?.code==='SESSION_CONTINUE_INCOMPLETE'&&/Press Continue Here again/u.test(error.message));
  assert.equal(t.current().runningOn,REMOTE);
}
// Yield is a strict suspended-session transition through the P5.4B session host, not an ad-hoc provider write.
{
  const t=makeHarness();const yielded=await t.controller.yieldLocal();
  assert.equal(yielded.status,'suspended');assert.equal(t.calls.pauses,1);assert.equal(t.calls.resets,1);assert.deepEqual(t.calls.lifecycles,['session-yield']);
}
console.log(JSON.stringify({status:'PASS',suite:'session-handoff-runtime',remotePreemption:true,strictFreeze:true,staleSource:true,compensation:true,yield:true}));
