import {readRuntimeSource} from '../../helpers/runtime-source.mjs';
import assert from 'node:assert/strict';
import {drainMicrotasks} from '../../helpers/async-tools.mjs';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=path.resolve(new URL('../../..',import.meta.url).pathname);
const read=relative=>readRuntimeSource(path.join(root,relative));
for(const file of ['source/core/internal.ts','source/core/native-capabilities.ts','source/core/capabilities-host.ts'])vm.runInThisContext(read(file),{filename:file});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const NativeModule=registry.require('native-capabilities',1);
const CapabilitiesHost=registry.require('capabilities-host',1);

function emitter(seed={}){
  const listeners=new Map();
  return Object.assign(seed,{
    addEventListener(name,handler){const rows=listeners.get(name)||[];rows.push(handler);listeners.set(name,rows);},
    emit(name,event={}){for(const handler of listeners.get(name)||[])handler(event);}
  });
}
function wakeSentinel(){
  const target=emitter({released:false,releaseCalls:0});
  target.release=async()=>{if(target.released)return;target.releaseCalls+=1;target.released=true;target.emit('release');};
  return target;
}

{ // scheduler ports, fallback and cancellation
  const posted=[],yielded=[];let now=0,timers=0;
  const scheduler=NativeModule.createTaskScheduler({
    scheduler:{postTask:async(_task,options)=>{posted.push(options.priority);},yield:async()=>{yielded.push(true);}},
    performance:{now:()=>now},setTimeout:callback=>{timers+=1;callback();return timers;}
  });
  await scheduler.yieldTask({priority:'background'});assert.deepEqual(posted,['background']);assert.equal(yielded.length,0);
  await scheduler.yieldTask();assert.equal(yielded.length,1);
  const budget=scheduler.budget(8);assert.equal(budget(),false);now=8;assert.equal(budget(),true);assert.equal(budget(),false);
  const aborter=new AbortController();aborter.abort(new DOMException('cancelled','AbortError'));
  await assert.rejects(()=>scheduler.yieldTask({signal:aborter.signal}),error=>error?.name==='AbortError');
  const fallback=NativeModule.createTaskScheduler({performance:{now:()=>0},setTimeout:callback=>{timers+=1;callback();return timers;}});
  await fallback.yieldTask();assert.ok(timers>=1);
}

let persisted=false,persistCalls=0,wakeRequests=0,timerRunning=false,badge=0;
const sentinels=[];
const document=emitter({hidden:false});
const window=emitter({matchMedia:()=>({matches:false})});
const navigator={
  userAgent:'Mozilla/5.0',
  storage:{persisted:async()=>persisted,persist:async()=>{persistCalls+=1;persisted=true;return true;}},
  wakeLock:{request:async kind=>{assert.equal(kind,'screen');wakeRequests+=1;const sentinel=wakeSentinel();sentinels.push(sentinel);return sentinel;}},
  setAppBadge:async value=>{badge=value;},clearAppBadge:async()=>{badge=0;}
};
const preferences=new Map(),renders=[],captures=[];
const controller=CapabilitiesHost.createController(Object.freeze({module:NativeModule,
  configuration:Object.freeze({installNoticeKey:'install-notice',wakePreferenceKey:'wake'}),
  environment:Object.freeze({document,navigator,window}),
  hooks:Object.freeze({
    capture:(scope,error)=>captures.push({scope,error:String(error)}),
    isTimerRunning:()=>timerRunning,
    readPreference:key=>preferences.get(key)===true,
    writePreference:(key,value)=>{preferences.set(key,value);return true;},
    render:state=>renders.push(state)
  })
}));

let prevented=false,promptCalls=0;
const promptEvent={
  preventDefault(){prevented=true;},
  prompt:async()=>{promptCalls+=1;},
  userChoice:Promise.resolve({outcome:'accepted'})
};
vm.runInNewContext(read('source/host/install-capture.ts'),{window});
window.emit('beforeinstallprompt',promptEvent);
assert.equal(prevented,true,'the early inline capture must retain a valid prompt before host startup');
controller.install();
assert.equal(controller.status().installAvailable,true,'native capabilities must consume the prompt captured before its own startup');
assert.equal(persistCalls,0,'startup must not request persistence');
assert.equal(controller.status().keepAwake,false,'wake lock must default off');
assert.equal(wakeRequests,0);
await controller.inspectStorage();
assert.equal(persistCalls,1,'startup storage inspection should request persistence when it is supported and not already granted');
assert.equal(controller.status().storageMode,'protected');

await controller.setKeepAwake(true);
assert.equal(preferences.get('wake'),true);
assert.equal(wakeRequests,0,'a setting alone cannot acquire wake lock without a running timer');
timerRunning=true;
await controller.syncWake();
assert.equal(wakeRequests,1);
assert.equal(controller.status().wakeAcquired,true);
document.hidden=true;document.emit('visibilitychange');
await drainMicrotasks();
assert.equal(sentinels[0].released,true);
assert.equal(controller.status().wakeAcquired,false);
document.hidden=false;document.emit('visibilitychange');
await drainMicrotasks();
assert.equal(wakeRequests,2,'returning to a visible running timer reacquires wake lock');
await sentinels[1].release();
assert.equal(controller.status().wakeAcquired,false,'browser revocation is tolerated');
assert.equal(wakeRequests,2,'revocation does not spin an immediate retry');
document.emit('visibilitychange');
await drainMicrotasks();
assert.equal(wakeRequests,3,'a later visibility event retries after revocation');
await controller.setKeepAwake(false);
assert.equal(sentinels[2].released,true);
assert.equal(controller.status().wakeAcquired,false);

let malformedPrevented=false;
window.emit('beforeinstallprompt',{preventDefault(){malformedPrevented=true;}});
assert.equal(malformedPrevented,false,'malformed install events are ignored rather than retained as callable prompts');
assert.equal(controller.status().installAvailable,true,'a malformed later event must not displace the captured prompt');
assert.equal(await controller.promptInstall(),true);
assert.equal(promptCalls,1);
assert.equal(controller.status().standalone,false,'accepting installation must not convert the current tab to standalone');
window.emit('appinstalled');
assert.equal(controller.status().installationState,'installed');
assert.equal(controller.status().standalone,false,'appinstalled must not convert the current tab to standalone');

controller.offerInstallNotice();
assert.equal(controller.status().installNoticeVisible,false,'an already installed app must not show the first-run notice');

await controller.updateBadge(true);assert.equal(badge,1);
{
  const badgeErrors=[];
  const adapter=CapabilitiesHost.createBadge(Object.freeze({
    controller:()=>controller,
    activeSession:()=>Object.freeze({settled:async()=>{throw new Error('canonical session unavailable');},load:async()=>null}),
    persistedActiveSessionUnfinished:()=>false,
    capture:(scope,error)=>badgeErrors.push({scope,message:String(error)})
  }));
  assert.equal(await adapter.refreshPersistedSessionBadge(),false);
  assert.equal(badge,1,'an unavailable canonical session read preserves the prior badge instead of asserting emptiness');
  assert.ok(badgeErrors.some(row=>row.scope==='native.badge-refresh'));
}
await controller.updateBadge(false);assert.equal(badge,0);
assert.equal(captures.length,0);
assert.ok(renders.some(state=>state.wakeAcquired));

function storageOnlyHarness(navigatorValue,capture=()=>{},isTimerRunning=()=>false){
  const documentValue=emitter({hidden:false}),windowValue=emitter({matchMedia:()=>({matches:false})});
  const controller=NativeModule.createController(Object.freeze({
    configuration:Object.freeze({installNoticeKey:'install-notice',wakePreferenceKey:'wake'}),
    environment:Object.freeze({document:documentValue,navigator:navigatorValue,window:windowValue}),
    hooks:Object.freeze({capture,isTimerRunning,readPreference:()=>false,writePreference:()=>true,render:()=>{}})
  }));
  return {controller,document:documentValue,window:windowValue};
}
function storageOnlyController(navigatorValue,capture=()=>{},isTimerRunning=()=>false){
  return storageOnlyHarness(navigatorValue,capture,isTimerRunning).controller;
}
let deniedPersistCalls=0;
const denied=storageOnlyController({
  userAgent:'Mozilla/5.0',storage:{persisted:async()=>false,persist:async()=>{deniedPersistCalls+=1;return false;}}
});
denied.install();
const deniedStartupState=await denied.inspectStorage();
assert.equal(deniedPersistCalls,1,'startup should make one proactive persistence request');
assert.equal(deniedStartupState.storageMode,'standard');
assert.match(deniedStartupState.storageMessage,/try protection again/i);
const deniedRetryState=await denied.protectLocalData();
assert.equal(deniedPersistCalls,2,'the explicit retry action should request persistence again');
assert.equal(deniedRetryState.storageMode,'standard');
assert.match(deniedRetryState.storageMessage,/try protection again/i);
const unsupported=storageOnlyController({userAgent:'Mozilla/5.0'});
unsupported.install();
const unsupportedState=await unsupported.inspectStorage();
assert.equal(unsupportedState.storageMode,'unsupported');
assert.match(unsupportedState.storageMessage,/browser-managed/i);

{ // rejected native APIs remain contained and observable
  const rejected=[];
  const rejecting=storageOnlyController({
    userAgent:'Mozilla/5.0',
    storage:{persisted:async()=>false,persist:async()=>{throw new Error('persist denied');}},
    getInstalledRelatedApps:async()=>{throw new Error('related apps denied');},
    setAppBadge:async()=>{throw new Error('badge denied');},clearAppBadge:async()=>{}
  },(scope,error)=>rejected.push({scope,message:String(error)}));
  rejecting.install();
  assert.equal((await rejecting.inspectStorage()).storageMode,'standard');
  assert.equal(await rejecting.updateBadge(true),false);
  await rejecting.inspectInstallation();
  assert.ok(rejected.some(row=>row.scope==='native.storage-protect-auto'));
  assert.ok(rejected.some(row=>row.scope==='native.badge'));
  assert.ok(rejected.some(row=>row.scope==='native.install-inspection'));
  const wakeRejected=storageOnlyController({
    userAgent:'Mozilla/5.0',wakeLock:{request:async()=>{throw new Error('wake denied');}}
  },(scope,error)=>rejected.push({scope,message:String(error)}),()=>true);
  wakeRejected.install();await wakeRejected.setKeepAwake(true);
  assert.equal(wakeRejected.status().wakeAcquired,false);
  assert.ok(rejected.some(row=>row.scope==='native.wake-request'));
  const promptHarness=storageOnlyHarness({userAgent:'Mozilla/5.0'},(scope,error)=>rejected.push({scope,message:String(error)}));
  promptHarness.controller.install();
  promptHarness.window.emit('beforeinstallprompt',{preventDefault(){},prompt:async()=>{throw new Error('prompt denied');}});
  assert.equal(await promptHarness.controller.promptInstall(),false);
  assert.ok(rejected.some(row=>row.scope==='native.install-prompt'));
}

{ // synchronous provider exceptions clear memoized probes so later retries remain possible
  const syncErrors=[];let wakeCalls=0,wakeThrows=true;
  const wakeHarness=storageOnlyHarness({
    userAgent:'Mozilla/5.0',
    wakeLock:{request(){wakeCalls+=1;if(wakeThrows){wakeThrows=false;throw new Error('wake threw synchronously');}return Promise.resolve(wakeSentinel());}}
  },(scope,error)=>syncErrors.push({scope,message:String(error)}),()=>true);
  wakeHarness.controller.install();
  await wakeHarness.controller.setKeepAwake(true);
  assert.equal(wakeCalls,1);assert.equal(wakeHarness.controller.status().wakeAcquired,false);
  assert.equal(await wakeHarness.controller.syncWake(),true,'a synchronous wake-lock exception must not poison later retries');
  assert.equal(wakeCalls,2);assert.equal(wakeHarness.controller.status().wakeAcquired,true);
  assert.ok(syncErrors.some(row=>row.scope==='native.wake-request'));

  let inspectionCalls=0,inspectionThrows=true;
  const inspectionHarness=storageOnlyHarness({
    userAgent:'Mozilla/5.0',
    getInstalledRelatedApps(){inspectionCalls+=1;if(inspectionThrows){inspectionThrows=false;throw new Error('inspection threw synchronously');}return Promise.resolve([{platform:'webapp'}]);}
  },(scope,error)=>syncErrors.push({scope,message:String(error)}));
  inspectionHarness.controller.install();
  await drainMicrotasks();
  assert.equal(inspectionCalls,1);assert.equal(inspectionHarness.controller.status().installedConfirmed,false);
  const retried=await inspectionHarness.controller.inspectInstallation();
  assert.equal(inspectionCalls,2,'a synchronous installed-app inspection exception must not remain cached');
  assert.equal(retried.installedConfirmed,true);
  assert.ok(syncErrors.some(row=>row.scope==='native.install-inspection'));
}

{ // checked UI projection preserves unsupported fallbacks and deduplicates change events
  const nodes=new Map();
  const node=id=>{const value={id,hidden:false,textContent:'',title:'',disabled:false,checked:false,attrs:new Map(),classes:new Map(),classList:{toggle(name,on){value.classes.set(name,!!on);}},setAttribute(name,val){value.attrs.set(name,val);}};nodes.set(id,value);return value;};
  for(const id of ['install-notice-action','local-data-status','protect-local-data','wake-setting','keep-screen-awake','wake-lock-indicator'])node(id);
  const doc={getElementById:id=>nodes.get(id)||null},events=[],notices=[];
  const views=CapabilitiesHost.createViews(Object.freeze({document:doc,window:{dispatchEvent:event=>{events.push(event.type);return true;}},notices:{publish:(id,value)=>notices.push({id,value})}}));
  views.renderNativeCapabilities(unsupportedState);views.renderNativeCapabilities(unsupportedState);
  assert.equal(nodes.get('local-data-status').textContent,'Browser-managed');
  assert.equal(nodes.get('wake-lock-indicator').textContent,'Unavailable');
  assert.equal(nodes.get('keep-screen-awake').disabled,true);
  assert.equal(events.filter(type=>type==='studydirector:installationchange').length,1);
  assert.equal(notices.at(-1).id,'installation');
}


const deferred=()=>{let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};};

// Real canonical-commit adapter and native driver: a clear cannot be skipped
// while an earlier set is in flight, and physical native calls never overlap.
{
  let physical=0;const calls=[],gates=[];
  const native=storageOnlyController({
    setAppBadge:value=>{calls.push(value);const gate=deferred();gates.push(gate);return gate.promise.then(()=>{physical=value;});},
    clearAppBadge:()=>{calls.push(0);const gate=deferred();gates.push(gate);return gate.promise.then(()=>{physical=0;});}
  });
  const adapter=CapabilitiesHost.createBadge(Object.freeze({controller:()=>native,activeSession:()=>({settled:async()=>{},load:async()=>null}),
    persistedActiveSessionUnfinished:value=>value?.unfinished===true,capture:()=>{}}));
  adapter.syncFromCanonicalCommit({entityType:'activeSession',operation:'upsert',value:{unfinished:true}});
  assert.deepEqual(calls,[1]);
  adapter.syncFromCanonicalCommit({entityType:'activeSession',operation:'delete'});
  const cleared=native.updateBadge(false);
  assert.deepEqual(calls,[1],'the newer clear must wait for the physical set');
  gates[0].resolve();await drainMicrotasks();
  assert.deepEqual(calls,[1,0],'a pending set cannot make canonical deletion disappear');
  gates[1].resolve();assert.equal(await cleared,true);assert.equal(physical,0);assert.equal(native.status().badgeActive,false);
  const setting=native.updateBadge(true),obsolete=native.updateBadge(false),latest=native.updateBadge(true);
  assert.equal(await setting,false);assert.equal(await obsolete,false);
  assert.deepEqual(calls,[1,0,1]);
  gates[2].resolve();assert.equal(await latest,true);assert.equal(physical,1);assert.equal(native.status().badgeActive,true);
  const failure=native.updateBadge(false);gates[3].reject(new Error('badge denied'));assert.equal(await failure,false);
  const retry=native.updateBadge(false);assert.deepEqual(calls,[1,0,1,0,0]);gates[4].resolve();assert.equal(await retry,true);
}
// A stale startup read or an unconfirmed receipt must not clear or set a
// newer canonical badge; confirmed absence is different from a failed read.
{
  const calls=[];const native=storageOnlyController({setAppBadge:async value=>{calls.push(value);},clearAppBadge:async()=>{calls.push(0);}});
  await native.updateBadge(true);
  let loaded=deferred(),reads=0;
  const adapter=CapabilitiesHost.createBadge(Object.freeze({controller:()=>native,
    activeSession:()=>({settled:async()=>{},load:(retry,options)=>{assert.equal(retry,0);assert.deepEqual(options,{strict:true});reads++;return loaded.promise;}}),
    persistedActiveSessionUnfinished:value=>value?.unfinished===true,capture:()=>{}}));
  const stale=adapter.refreshPersistedSessionBadge();await drainMicrotasks();assert.equal(reads,1);
  adapter.syncFromCanonicalCommit({entityType:'activeSession',operation:'upsert',value:{unfinished:true}});
  loaded.resolve({ok:true,value:null,storage:{idb:false}});assert.equal(await stale,false);assert.deepEqual(calls,[1]);
  for(const receipt of [null,{ok:false,value:null,storage:{idb:false}},{ok:true,error:new Error('read failed'),value:null},{ok:true,value:{unfinished:true},storage:{idb:false}},{ok:true}]){
    loaded=deferred();const refresh=adapter.refreshPersistedSessionBadge();loaded.resolve(receipt);assert.equal(await refresh,false);assert.deepEqual(calls,[1]);
  }
  loaded=deferred();const absent=adapter.refreshPersistedSessionBadge();loaded.resolve({ok:true,value:null,error:null,storage:{idb:false}});
  assert.equal(await absent,true);assert.deepEqual(calls,[1,0]);
  loaded=deferred();const current=adapter.refreshPersistedSessionBadge();loaded.resolve({ok:true,value:{unfinished:true},error:null,storage:{idb:true}});
  assert.equal(await current,true);assert.deepEqual(calls,[1,0,1]);
}
// Automatic and explicit storage requests share the same native operation;
// host usage projections cannot regress to a retired estimate.
{
  let persisted=false,persistCalls=0;const protection=deferred(),estimates=[],health=[];
  const navigator={storage:{persisted:async()=>persisted,persist:()=>{persistCalls++;return protection.promise.then(value=>{persisted=value;return value;});},
    estimate:()=>{const gate=deferred();estimates.push(gate);return gate.promise;}}};
  const native=storageOnlyController(navigator);
  const inspected=native.inspectStorage(),explicit=native.protectLocalData();
  assert.equal(native.status().storageBusy,true);assert.equal(inspected,explicit);
  await drainMicrotasks();assert.equal(persistCalls,1);
  protection.resolve(true);assert.equal((await explicit).storageMode,'protected');assert.equal(native.status().storageBusy,false);
  const usage={textContent:''};
  const host=CapabilitiesHost.createStorage(Object.freeze({document:{getElementById:()=>usage},navigator,limits:{storageCriticalRatio:.9,storageWarningRatio:.8},
    controller:()=>native,storageSizeLabel:String,markStorageHealthError:(_source,reason)=>health.push(reason),markStorageHealthOk:()=>health.push('ok'),renderStorageHealth:()=>{}}));
  const older=host.inspectStorageCapability();await drainMicrotasks();
  const newer=host.inspectStorageCapability();await drainMicrotasks();assert.equal(estimates.length,2);
  estimates[1].resolve({usage:95,quota:100});assert.equal((await newer).usageRatio,.95);assert.match(health.at(-1),/95% full/);
  estimates[0].resolve({usage:1,quota:100});assert.equal(await older,null);assert.equal(host.snapshot().usageBytes,95);assert.match(usage.textContent,/95/);
  const unknown=host.inspectStorageCapability();await drainMicrotasks();estimates[2].resolve({usage:-1,quota:0});
  assert.equal((await unknown).usageRatio,null);assert.equal(host.snapshot().usageBytes,null);assert.match(health.at(-1),/95% full/);
  const recovered=host.inspectStorageCapability();await drainMicrotasks();estimates[3].resolve({usage:1,quota:100});await recovered;assert.equal(health.at(-1),'ok');
}
// The installed event and a replacement browser prompt take precedence over
// the old userChoice or failed prompt. An already-released wake sentinel is
// not an acquired resource.
{
  const h=storageOnlyHarness({});h.controller.install();
  const choice=deferred(),replacement=deferred();
  h.window.emit('beforeinstallprompt',{prompt:async()=>{},userChoice:choice.promise});
  const old=h.controller.promptInstall();assert.equal(h.controller.status().installationState,'installing');
  h.window.emit('beforeinstallprompt',{prompt:async()=>{},userChoice:replacement.promise});
  choice.resolve({outcome:'accepted'});assert.equal(await old,false);assert.equal(h.controller.status().installationState,'available');
  const next=h.controller.promptInstall();h.window.emit('appinstalled');replacement.reject(new Error('retired prompt'));
  assert.equal(await next,true);assert.equal(h.controller.status().installFeedback,'Installed on this device.');
  const already=wakeSentinel();await already.release();
  const wake=storageOnlyController({wakeLock:{request:async()=>already}},()=>{},()=>true);
  wake.install();await wake.setKeepAwake(true);assert.equal(wake.status().wakeAcquired,false);
}

console.log(JSON.stringify({
  status:'PASS',schedulerPorts:true,persistenceAutoRequested:true,persistenceRetryAvailable:true,wakeLifecycle:true,
  persistenceDenialSafe:true,persistenceUnsupportedSafe:true,rejectedApisContained:true,rejectedWakeAndInstallSafe:true,
  installGuidance:true,malformedInstallPromptIgnored:true,installedTabRemainsBrowser:true,badgeBestEffort:true,badgeUnknownPreserved:true,checkedHostAdapter:true,wakeRequests,persistCalls
},null,2));
