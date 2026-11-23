import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readCoreScript} from '../../helpers/core-script.mjs';

const context={Object,Symbol,TypeError,Error,Promise,Set,WeakSet,Map,AbortController,console};
context.globalThis=context;vm.createContext(context);
for(const name of ['internal','pwa-update-host'])vm.runInContext(readCoreScript(name),context,{filename:`source/core/${name}.ts`});
const registry=context[Symbol.for('studyDirector.internalModules.v1')],UpdateHost=registry.require('pwa-update-host',1);

const baseStatus=()=>({
  format:'study-director.pwa-lifecycle-status',contractVersion:1,supported:true,installed:true,registered:true,registering:false,
  registrationError:'',checkError:'',checking:false,bootState:'current',bootReleaseId:'r1',bootConfirmedAt:'',buildId:'qa-build',
  assetId:'a'.repeat(24),cacheState:'',cacheReason:'',updateReady:true,externalUpdate:false,waitingReleaseId:'r2',
  applying:false,reloading:false,revision:1,message:'Update ready.',phase:'ready'
});
function node(tag='div'){
  return {tagName:tag.toUpperCase(),id:'',className:'',textContent:'',disabled:false,isContentEditable:false,
    setAttribute(){},append(){},addEventListener(){},contains(){return false;},showModal(){},close(){},remove(){},matches(){return false;}};
}
function makeHarness(options={}){
  let now=100000,workRevision=1,ownership={state:'primary',revision:1,hydrating:false,takeoverPending:false,resolving:false};
  let lifecycleStatus={...baseStatus(),...(options.lifecycle||{})},backupBusy=!!options.backupBusy,providerBusy=!!options.providerBusy;
  let timerLive=!!options.timerLive,timerPaused=!!options.timerPaused,pacerRunning=!!options.pacerRunning,tasks=options.tasks??[];
  let mutation={active:'',foreign:false,recoveryFault:'',...(options.mutation||{})},session={ready:true,transitioning:false,revision:1,...(options.session||{})};
  const calls={pause:0,pacer:0,backup:0,backupMessage:'',apply:0,check:0,lock:0,providerRelease:0,settleMutation:0,project:0,foreground:0,captures:[],localWrites:0};
  const elements=new Map([['pwa-update-control',node()],['pwa-update-apply',node('button')],['pwa-update-message',node()]]);
  const listeners={document:new Map(),window:new Map()};
  const document={
    hidden:false,body:{append(child){if(child?.id)elements.set(child.id,child);}},
    createElement:tag=>node(tag),getElementById:id=>elements.get(id)||null,querySelector:()=>null,
    addEventListener:(type,fn)=>listeners.document.set(type,fn)
  };
  const window={addEventListener:(type,fn)=>listeners.window.set(type,fn),removeEventListener(){},};
  let lifecycleHooks=null;
  const lifecycle={
    format:'study-director.pwa-lifecycle',contractVersion:1,
    install:async()=>lifecycleStatus,
    apply:async()=>{calls.apply++;return options.applyResult!==false;},
    checkForUpdate:async()=>{calls.check++;return options.checkResult!==false;},
    confirmBoot:async()=>true,reportClient:()=>true,status:()=>lifecycleStatus
  };
  const lifecycleModule={createCoordinator:input=>{lifecycleHooks=input.hooks;return Object.freeze(lifecycle);}};
  const local=new Map();
  const statePorts=Object.freeze({
    startupReady:()=>options.startupReady!==false,ownership:()=>ownership,sessionLifecycle:()=>session,mutation:()=>mutation,
    reviewSave:()=>({rolloverSaveInProgress:false,saveDayInProgress:false,activeSessionPersistenceBlocked:false,...(options.reviewSave||{})}),
    imagePreparationCount:()=>options.imageBusy?1:0,attachmentLibraryBusy:()=>!!options.attachmentBusy,attachmentIngestBusy:()=>!!options.ingestBusy,
    exportsBusy:()=>!!options.exportsBusy,backupBusy:()=>backupBusy,providerBusy:()=>providerBusy,providerBackgroundBackupActive:()=>!!options.backgroundBackingUp||!!options.driveBackingUp,providerDriveBackingUp:()=>!!options.driveBackingUp,
    liveTimer:()=>timerLive,timerPaused:()=>timerPaused,timerMode:()=> 'running',pacerRunning:()=>pacerRunning,canMutate:()=>options.canMutate!==false,
    blockingUiOpen:()=>!!options.blockingUi,workRevision:()=>workRevision,tasks:()=>tasks,
    isTrackableTask:()=>true,isTaskResolved:index=>options.resolvedTasks?.has(index)??false,currentTaskIndex:()=>options.currentTaskIndex??0
  });
  const reservationPorts=Object.freeze({
    settleMutation:async()=>{calls.settleMutation++;},
    suspendProvider:()=>({settled:Promise.resolve(),release:()=>{calls.providerRelease++;}}),
    settleRichTextAssets:async()=>{},settleMaintenance:async()=>{},settleAttachmentIntegrity:async()=>{},
    quiesceRichText:async run=>run(),runExclusive:async(_name,run)=>run({assert(){}}),runManagedRecovery:async run=>run(),
    projectOwnership:()=>{calls.project++;},foregroundChanged:()=>{calls.foreground++;}
  });
  const persistence=Object.freeze({
    settleDiary:async()=>options.diaryOk!==false,flushPlanDraft:async()=>options.planFlushOk!==false,
    planAuthoredText:()=>options.planText??'plan',planReadDraft:()=>options.planRead??(options.planText??'plan'),
    savePlanDraft:async()=>options.planSaveOk!==false,settlePlanData:async()=>{},
    readStoredPlan:async()=>({draft:options.storedPlan??(options.planText??'plan')}),
    flushPendingReview:async()=>options.reviewOk!==false,settleReviewEditor:async()=>{},
    writeLiveDraft:async()=>options.liveResult??{ok:true,value:{revision:7},storage:{idb:true}},
    flushNotes:async()=>{},noteFailure:()=>options.noteFailure??null,flushDeletionRecovery:async()=>options.deletionOk!==false,
    settleActiveSession:async()=>{},loadActiveSession:async()=>options.loadedSession??{value:{revision:7},storage:{idb:true}},
    activeSessionIssue:()=>options.activeSessionIssue??''
  });
  const effects=Object.freeze({
    automaticBackupsWaiting:()=>options.backupWaiting===true,
    flushAutomaticBackups:async reason=>{assert.equal(reason,'app-update');calls.backup++;calls.backupMessage=elements.get('pwa-update-message')?.textContent||'';},pauseTimer:()=>{calls.pause++;timerPaused=true;},
    togglePacer:()=>{calls.pacer++;pacerRunning=false;},scheduleSyncStatus:()=>{},
    publishNotice:()=>{},capture:(scope,error,level)=>calls.captures.push({scope,error,level}),
    localGet:(key,fallback)=>local.get(key)??fallback,localSet:(key,value)=>{calls.localWrites++;local.set(key,value);return true;}
  });
  let nextTimer=1;const timers=new Map();
  const controller=UpdateHost.createController(Object.freeze({
    configuration:Object.freeze({assetId:'a'.repeat(24),buildId:'qa-build',reloadSessionKey:'reload',scope:'./',workerUrl:'./sw.js',updateCheckStorageKey:'last-check',primaryState:'primary',secondaryState:'secondary',runningTimerMode:'running'}),
    lifecycle:Object.freeze({module:lifecycleModule,environment:Object.freeze({})}),
    environment:Object.freeze({document,window,navigator:Object.freeze({onLine:options.offline!==true,locks:Object.freeze({request:async(_name,_lockOptions,perform)=>{calls.lock++;if(options.lockRace)providerBusy=true;return perform();}})}),setTimeout:(fn,delay)=>{const id=nextTimer++;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id),now:()=>now}),
    state:statePorts,reservation:reservationPorts,persistence,effects
  }));
  lifecycleHooks.render(lifecycleStatus);
  return {
    controller,calls,elements,timers,listeners,
    setLifecycle:value=>{lifecycleStatus={...lifecycleStatus,...value};lifecycleHooks.render(lifecycleStatus);},
    setOwnership:value=>{ownership={...ownership,...value};},setMutation:value=>{mutation={...mutation,...value};},
    setSession:value=>{session={...session,...value};},setWorkRevision:value=>{workRevision=value;},
    setBackupBusy:value=>{backupBusy=value;},setProviderBusy:value=>{providerBusy=value;},setTasks:value=>{tasks=value;},
    setNow:value=>{now=value;},local
  };
}

// Non-timer blockers are rejected before Pause & Update mutates timer state.
{
  const t=makeHarness({timerLive:true,backupBusy:true});
  assert.equal(await t.controller.applyFromUi(),false);
  assert.equal(t.calls.pause,0);assert.equal(t.calls.backup,0);assert.equal(t.calls.apply,0);
}
{
  const t=makeHarness({timerLive:true,backgroundBackingUp:true});
  assert.equal(await t.controller.applyFromUi(),false);
  assert.equal(t.calls.pause,0);assert.equal(t.calls.backup,0);assert.equal(t.calls.apply,0);
}
{
  const t=makeHarness({timerLive:true,pacerRunning:true});
  assert.equal(await t.controller.applyFromUi(),true);
  assert.equal(t.calls.pause,1);assert.equal(t.calls.pacer,1);assert.equal(t.calls.backup,0);assert.equal(t.calls.apply,1);
}

// A reservation owns exactly its own guard and releases provider/UI state on cancellation.
{
  const t=makeHarness(),abort=new AbortController();
  const guard=t.controller.reserve(Object.freeze({requestId:'r1',releaseId:'release-1',automatic:false,external:false,signal:abort.signal}));
  await guard.ready;assert.equal(t.controller.reservationActive(),true);assert.equal(guard.validate(),true);
  abort.abort();await guard.release();
  assert.equal(t.controller.reservationActive(),false);assert.equal(t.calls.providerRelease,1);assert.equal(t.calls.foreground,1);
}

// New work after reservation readiness invalidates the exact reservation.
{
  const t=makeHarness(),abort=new AbortController();
  const update=Object.freeze({requestId:'r2',releaseId:'release-2',automatic:false,external:false,signal:abort.signal});
  const guard=t.controller.reserve(update);
  await guard.ready;assert.equal((await t.controller.prepare(update)).ok,true);
  t.setWorkRevision(2);assert.equal(guard.validate(),false);await guard.release();
}

// Direct preparation still waits for the mutation coordinator and verifies durable read-back.
{
  const t=makeHarness();
  const result=await t.controller.prepare({requestId:'',automatic:false,external:false});assert.equal(result.ok,true);assert.equal(result.reason,'');
  assert.equal(t.calls.settleMutation,1);
}
{
  const t=makeHarness({storedPlan:'stale'});
  const result=await t.controller.prepare({requestId:'',automatic:false,external:false});
  assert.equal(result.ok,false);assert.match(result.reason,/Plan draft did not pass/u);
}
{
  const t=makeHarness({tasks:[{}],liveResult:{ok:true,value:{revision:8},storage:{idb:true}},loadedSession:{value:{revision:7},storage:{idb:true}}});
  const result=await t.controller.prepare({requestId:'',automatic:false,external:false});
  assert.equal(result.ok,false);assert.match(result.reason,/read-back/u);
}
{
  const t=makeHarness({deletionOk:false});
  const result=await t.controller.prepare({requestId:'',automatic:false,external:false});
  assert.equal(result.ok,false);assert.match(result.reason,/Pending deletions/u);
}

// Secondary external activation is allowed to reload only after the follower reservation path is established.
{
  const t=makeHarness();t.setOwnership({state:'secondary',revision:4});
  const abort=new AbortController(),guard=t.controller.reserve(Object.freeze({requestId:'f1',releaseId:'release-f',automatic:true,external:true,signal:abort.signal}));
  await guard.ready;assert.equal(guard.validate(),true);
  const prepared=await t.controller.prepare({requestId:'f1',releaseId:'release-f',automatic:true,external:true,signal:abort.signal});assert.equal(prepared.ok,true);assert.equal(prepared.reason,'');
  await guard.release();
}

// A follower classification captured at controller-change time remains read-only
// even if the initiating primary reload releases ownership before reserve begins.
{
  const t=makeHarness();t.setOwnership({state:'primary',revision:5,hydrating:false,takeoverPending:false,resolving:false});
  const abort=new AbortController(),guard=t.controller.reserve(Object.freeze({requestId:'f2',releaseId:'release-f2',automatic:true,external:true,follower:true,signal:abort.signal}));
  await guard.ready;
  assert.equal(guard.validate(),true,'captured follower role must survive a secondary-to-primary handoff before reservation');
  const prepared=await t.controller.prepare({requestId:'f2',releaseId:'release-f2',automatic:true,external:true,follower:true,signal:abort.signal});
  assert.equal(prepared.ok,true);assert.equal(t.calls.settleMutation,0,'captured follower handoff must remain read-only');
  await guard.release();
}

// Automatic update waits for applied-plan completion, then backs up and applies.
{
  const t=makeHarness({tasks:[{},{}],resolvedTasks:new Set([0])});
  assert.equal(await t.controller.evaluateAutomatic(),false);assert.equal(t.calls.apply,0);
  t.setTasks([]);assert.equal(await t.controller.evaluateAutomatic(),true);assert.equal(t.calls.backup,0);assert.equal(t.calls.apply,1);
}
{
  const t=makeHarness({backupWaiting:true});
  assert.equal(await t.controller.evaluateAutomatic(),true);
  assert.equal(t.calls.backupMessage,'Backing up before the update…','the checked PWA owner must render backup-wait state before entering the host backup callback');
}

// Successful update checks persist their timestamp; failures do not.
{
  const ok=makeHarness({checkResult:true});assert.equal(await ok.controller.checkIfDue({force:true}),true);assert.equal(ok.calls.check,1);assert.equal(ok.calls.localWrites,1);
  const failed=makeHarness({checkResult:false});assert.equal(await failed.controller.checkIfDue({force:true}),false);assert.equal(failed.calls.check,1);assert.equal(failed.calls.localWrites,0);assert.equal(failed.controller.diagnostics().failureCount,1);
}

// Automatic discovery yields to provider work before and after lock acquisition; force remains user-driven.
{
  const t=makeHarness({providerBusy:true});assert.equal(await t.controller.checkIfDue(),false);
  assert.equal(t.calls.check,0);assert.equal(t.calls.lock,0);
  assert.ok([...t.timers.values()].some(row=>row.delay===30000));
}
{
  const t=makeHarness({lockRace:true});assert.equal(await t.controller.checkIfDue(),false);
  assert.equal(t.calls.lock,1);assert.equal(t.calls.check,0);
}
{
  const t=makeHarness({providerBusy:true});assert.equal(await t.controller.checkIfDue({force:true}),true);
  assert.equal(t.calls.lock,1);assert.equal(t.calls.check,1);
}
{
  const t=makeHarness({offline:true});assert.equal(await t.controller.checkIfDue(),false);
  assert.equal(t.calls.lock,0);assert.equal(t.calls.check,0);
}

// Controller changes and lifecycle UI remain driven by the checked lifecycle status, not host globals.
{
  const t=makeHarness();t.setLifecycle({updateReady:false,checking:true,phase:'checking',message:'Checking for an update…'});
  assert.equal(t.controller.updateReady(),false);assert.equal(t.elements.get('pwa-update-apply').disabled,true);
}

console.log(JSON.stringify({status:'PASS',suite:'application-update-safety',checkedOwner:true,reservationCancellation:true,newWorkFence:true,readBack:true,preflightBeforePause:true,autoPlanGate:true,checkTimestamp:true},null,2));
