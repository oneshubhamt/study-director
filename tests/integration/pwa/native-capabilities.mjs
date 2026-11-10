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

controller.install();
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

let prevented=false,promptCalls=0;
window.emit('beforeinstallprompt',{preventDefault(){prevented=true;}});
assert.equal(prevented,false,'malformed install events are ignored rather than retained as callable prompts');
assert.equal(controller.status().installAvailable,false);
const promptEvent={
  preventDefault(){prevented=true;},
  prompt:async()=>{promptCalls+=1;},
  userChoice:Promise.resolve({outcome:'accepted'})
};
window.emit('beforeinstallprompt',promptEvent);
assert.equal(prevented,true);
assert.equal(controller.status().installAvailable,true);
assert.equal(await controller.promptInstall(),true);
assert.equal(promptCalls,1);
assert.equal(controller.status().standalone,false,'accepting installation must not convert the current tab to standalone');
window.emit('appinstalled');
assert.equal(controller.status().installationState,'installed');
assert.equal(controller.status().standalone,false,'appinstalled must not convert the current tab to standalone');

controller.offerInstallNotice();
assert.equal(controller.status().installNoticeVisible,false,'an already installed app must not show the first-run notice');

await controller.updateBadge(true);assert.equal(badge,1);
await controller.updateBadge(false);assert.equal(badge,0);
assert.equal(captures.length,0);
assert.ok(renders.some(state=>state.wakeAcquired));

function storageOnlyController(navigatorValue,capture=()=>{}){
  const documentValue=emitter({hidden:false}),windowValue=emitter({matchMedia:()=>({matches:false})});
  return NativeModule.createController(Object.freeze({
    configuration:Object.freeze({installNoticeKey:'install-notice',wakePreferenceKey:'wake'}),
    environment:Object.freeze({document:documentValue,navigator:navigatorValue,window:windowValue}),
    hooks:Object.freeze({capture,isTimerRunning:()=>false,readPreference:()=>false,writePreference:()=>true,render:()=>{}})
  }));
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

console.log(JSON.stringify({
  status:'PASS',schedulerPorts:true,persistenceAutoRequested:true,persistenceRetryAvailable:true,wakeLifecycle:true,
  persistenceDenialSafe:true,persistenceUnsupportedSafe:true,rejectedApisContained:true,
  installGuidance:true,malformedInstallPromptIgnored:true,installedTabRemainsBrowser:true,badgeBestEffort:true,checkedHostAdapter:true,wakeRequests,persistCalls
},null,2));
