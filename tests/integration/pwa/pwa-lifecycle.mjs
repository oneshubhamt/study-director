import {readRuntimeSource} from '../../helpers/runtime-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
for(const file of ['source/core/internal.ts','source/core/pwa-lifecycle.js'])vm.runInThisContext(readRuntimeSource(file),{filename:file});
const module=globalThis[Symbol.for('studyDirector.internalModules.v1')].require('pwa-lifecycle',1),freeze=Object.freeze;
const flush=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
function emitter(seed={}){const listeners=new Map();return Object.assign(seed,{addEventListener(k,f){if(!listeners.has(k))listeners.set(k,new Set());listeners.get(k).add(f);},removeEventListener(k,f){listeners.get(k)?.delete(f);},emit(k,e={}){for(const f of [...listeners.get(k)||[]])f(e);},listenerCount:k=>listeners.get(k)?.size||0});}
function harness({controlled=true,supported=true}={}){
 let now=0,next=0,reloads=0,registerCalls=0,checks=0,prepareCalls=0,reserves=0,releases=0,held=0;
 const timers=new Map(),channels=[],captures=[],renders=[],prepares=[],storage=new Map();
 const setTimer=(callback,delay)=>{const id=++next;timers.set(id,{callback,at:now+delay});return id;};
 async function advance(ms){const end=now+ms;for(;;){const due=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;now=due[1].at;timers.delete(due[0]);due[1].callback();await flush();}now=end;await flush();}
 class Channel{constructor(){this.port1={closed:false,onmessage:null,close(){this.closed=true;}};this.port2={closed:false,close(){this.closed=true;},postMessage:data=>this.port1.onmessage?.({data})};channels.push(this);}}
 function worker(releaseId,state='installed'){return emitter({releaseId,state,buildId:'qa-build',assetId:'a'.repeat(24),messages:[],identityBlocked:false,acknowledge:true,postMessage(message,ports=[]){this.messages.push(message);if(message.type==='SD_PWA_IDENTIFY'&&!this.identityBlocked)ports[0]?.postMessage({type:'SD_PWA_IDENTITY',releaseId:this.releaseId,buildId:this.buildId,assetId:this.assetId});if(message.type==='SD_PWA_APPLY_UPDATE'&&this.acknowledge)ports[0]?.postMessage({type:'SD_PWA_ACTIVATION_ACK',requestId:message.requestId,releaseId});}});}
 const old=worker('old','activated'),candidate=worker('next'),registration=emitter({waiting:candidate,installing:null,active:old,update:async()=>{checks++;return behavior.update();}});
 const sw=emitter({controller:controlled?old:null,register:async(...args)=>{registerCalls++;behavior.registerArgs=args;await behavior.register();return registration;}});
 const win=emitter({crypto:{randomUUID:()=>`request-${next}`},sessionStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},location:{reload(){reloads++;behavior.reload();}}});
 const doc=emitter({hidden:true});
 const behavior={prepare:async()=>({ok:true}),register:async()=>{},update:async()=>{},reload:()=>{},valid:true,ready:Promise.resolve()};
 const api=module.createCoordinator(freeze({configuration:freeze({assetId:'a'.repeat(24),buildId:'qa-build',reloadSessionKey:'reload',scope:'./',workerUrl:freeze({trusted:'./sw.js'})}),environment:freeze({AbortController,MessageChannel:Channel,clearTimeout:id=>timers.delete(id),setTimeout:setTimer,document:doc,navigator:supported?{serviceWorker:sw}:{},window:win}),hooks:freeze({capture:(scope,error)=>captures.push({scope,error}),render:state=>renders.push(state),reserve:context=>{reserves++;held++;let released=false;return freeze({ready:behavior.ready,validate:()=>behavior.valid&&!context.signal.aborted,release:async()=>{if(!released){released=true;releases++;held--;}}});},prepare:async context=>{prepareCalls++;prepares.push(context);return behavior.prepare(context);}})}));
 const activate=async(worker=candidate,{control=true,state='activated'}={})=>{registration.waiting=null;registration.active=worker;worker.state=state;if(control)sw.controller=worker;worker.emit('statechange');if(control)sw.emit('controllerchange');await flush();};
 const message=(type,source=sw.controller,releaseId=source?.releaseId)=>sw.emit('message',{source,data:{type,releaseId}});
 return {api,sw,win,doc,old,candidate,registration,behavior,timers,channels,captures,renders,storage,prepares,advance,worker,activate,message,counts:()=>({reloads,registerCalls,checks,prepareCalls,reserves,releases,held})};
}
// Real worker-message contract retains the cache outcome and only stable reasons.
{const h=harness();await h.api.install();for(const state of ['completed','deferred','failed']){h.sw.emit('message',{source:h.sw.controller,data:{type:'SD_PWA_CACHE_STATUS',state,reason:'awaiting-client-state'}});assert.equal(h.api.status().cacheState,state);assert.equal(h.api.status().cacheReason,'awaiting-client-state');}h.sw.emit('message',{source:h.sw.controller,data:{type:'SD_PWA_CACHE_STATUS',state:'failed',reason:'PRIVATE DATA'}});assert.equal(h.api.status().cacheReason,'');h.sw.emit('message',{source:h.candidate,data:{type:'SD_PWA_CACHE_STATUS',state:'completed'}});assert.equal(h.api.status().cacheState,'failed','uncontrolled announcements cannot change current cache status');}
const cases=[];
async function test(name,run){await run();cases.push(name);}
await test('trusted registration and coalesced checks',async()=>{
 const h=harness();await Promise.all([h.api.install(),h.api.install()]);assert.equal(h.counts().registerCalls,1);assert.equal(h.behavior.registerArgs[0].trusted,'./sw.js');assert.equal(h.behavior.registerArgs[1].updateViaCache,'none');
 assert.equal(h.api.status().waitingReleaseId,'next');await Promise.all([h.api.checkForUpdate(),h.api.checkForUpdate()]);assert.equal(h.counts().checks,1);assert.equal(h.counts().reloads,0);
});
await test('preparation rejection releases reservation without activation',async()=>{
 const h=harness();await h.api.install();h.behavior.prepare=async()=>({ok:false,reason:'Storage failed.'});assert.equal(await h.api.apply(),false);assert.equal(h.counts().held,0);assert.match(h.api.status().message,/Storage failed/);assert.ok(!h.candidate.messages.some(m=>m.type==='SD_PWA_APPLY_UPDATE'));
});
await test('activating active pointer and ACK cannot trigger reload',async()=>{
 const h=harness();await h.api.install();assert.equal(await h.api.apply(),true);await h.activate(h.candidate,{control:false,state:'activating'});
 assert.equal(h.counts().reloads,0);assert.equal(h.counts().held,1);h.message('SD_PWA_ACTIVATED',h.candidate);await flush();assert.equal(h.counts().reloads,0);
 await h.activate(h.candidate,{control:true,state:'activating'});assert.equal(h.counts().reloads,0);
 await h.activate();assert.equal(h.counts().reloads,1);assert.equal(h.counts().held,1);assert.equal(JSON.parse(h.storage.get('reload')).releaseId,'next');assert.equal(h.api.status().bootState,'not-confirmed');
 h.message('SD_PWA_ACTIVATED');h.sw.emit('controllerchange');await flush();assert.equal(h.counts().reloads,1);
 h.win.emit('pagehide');await flush();assert.equal(h.counts().held,0);assert.equal(h.timers.size,0);assert.ok(h.channels.every(c=>c.port1.closed&&c.port2.closed));
});
await test('first installation never reloads or prepares an interactive page',async()=>{
 const h=harness({controlled:false});h.registration.waiting=null;h.registration.active=null;await h.api.install();await h.activate();h.message('SD_PWA_ACTIVATED');await flush();assert.equal(h.counts().reloads,0);assert.equal(h.counts().prepareCalls,0);
 const later=h.worker('later');h.registration.waiting=later;h.message('SD_PWA_UPDATE_AVAILABLE',later);await flush();assert.equal(h.api.status().updateReady,true);await h.api.apply();await h.activate(later);assert.equal(h.counts().reloads,1);h.win.emit('pagehide');
});
await test('untrusted messages and release names never authorize reload',async()=>{
 const h=harness();await h.api.install();h.message('SD_PWA_ACTIVATED',{},'forged');h.message('SD_PWA_ACTIVATED',h.old,'forged');await flush();assert.equal(h.counts().reloads,0);assert.equal(h.counts().reserves,0);
});
await test('hidden follower prepares and can refuse reload',async()=>{
 const h=harness();h.registration.waiting=null;await h.api.install();h.behavior.prepare=async()=>({ok:false,reason:'Ownership is changing.'});await h.activate();assert.equal(h.counts().reloads,0);assert.equal(h.counts().held,0);assert.equal(h.prepares[0].external,true);
 h.behavior.prepare=async()=>({ok:true});await h.api.apply();assert.equal(h.counts().reloads,1);h.win.emit('pagehide');
});
await test('candidate replacement during preparation never gets stale release request',async()=>{
 const h=harness(),gate=deferred();await h.api.install();h.behavior.prepare=()=>gate.promise;const task=h.api.apply();await flush();const newer=h.worker('newer');h.registration.waiting=newer;h.message('SD_PWA_UPDATE_AVAILABLE',newer);await flush();gate.resolve({ok:true});assert.equal(await task,false);assert.equal(h.counts().held,0);assert.ok(!newer.messages.some(m=>m.type==='SD_PWA_APPLY_UPDATE'));assert.equal(h.api.status().waitingReleaseId,'newer');
 h.behavior.prepare=async()=>({ok:true});await h.api.apply();assert.equal(newer.messages.find(m=>m.type==='SD_PWA_APPLY_UPDATE').releaseId,'newer');h.win.emit('pagehide');
});
await test('redundant or vanished candidate clears ready state',async()=>{
 const h=harness(),gate=deferred();await h.api.install();h.behavior.prepare=()=>gate.promise;const task=h.api.apply();await flush();h.candidate.state='redundant';h.registration.waiting=null;gate.resolve({ok:true});assert.equal(await task,false);assert.equal(h.api.status().updateReady,false);assert.equal(h.counts().held,0);
});
await test('activation timeout restores interaction and late activation saves again',async()=>{
 const h=harness();await h.api.install();await h.api.apply();await h.advance(8000);assert.equal(h.api.status().applying,false);assert.equal(h.counts().held,0);assert.equal(h.counts().reloads,0);assert.ok(h.channels.every(c=>c.port1.closed&&c.port2.closed));
 await h.activate();assert.equal(h.counts().prepareCalls,2);assert.equal(h.counts().reloads,1);h.win.emit('pagehide');
});
await test('preparation timeout settles caller and ignores late success',async()=>{
 const h=harness(),gate=deferred();await h.api.install();h.behavior.prepare=()=>gate.promise;const task=h.api.apply();await flush();await h.advance(20000);assert.equal(await task,false);assert.equal(h.counts().held,0);gate.resolve({ok:true});await flush();assert.ok(!h.candidate.messages.some(m=>m.type==='SD_PWA_APPLY_UPDATE'));
});
await test('reservation timeout releases even before ready',async()=>{
 const h=harness();await h.api.install();h.behavior.ready=new Promise(()=>{});const task=h.api.apply();await flush();await h.advance(20000);assert.equal(await task,false);assert.equal(h.counts().prepareCalls,0);assert.equal(h.counts().held,0);
});
await test('ownership loss at activation prevents reload',async()=>{
 const h=harness();await h.api.install();await h.api.apply();h.behavior.valid=false;await h.activate();assert.equal(h.counts().reloads,0);assert.equal(h.counts().held,0);assert.equal(h.api.status().applying,false);
});
await test('identified controller release must match immutable candidate',async()=>{
 const h=harness();await h.api.install();await h.api.apply();h.candidate.releaseId='unexpected';await h.activate();assert.equal(h.counts().reloads,0);await h.advance(8000);assert.equal(h.counts().held,0);
});
await test('concurrent apply prepares only once',async()=>{
 const h=harness();await h.api.install();const first=h.api.apply();assert.equal(await h.api.apply(),false);await first;assert.equal(h.counts().prepareCalls,1);h.win.emit('pagehide');
});
await test('failed reload marker does not prevent safe retry',async()=>{
 const h=harness();h.storage.set('reload','next');await h.api.install();await h.api.apply();await h.activate();assert.equal(h.counts().reloads,1);await h.advance(8000);assert.equal(h.counts().held,0);assert.equal(h.api.status().reloading,false);await h.api.apply();assert.equal(h.counts().reloads,2);h.win.emit('pagehide');
});
await test('registration failure retries without duplicate listeners',async()=>{
 const h=harness();h.behavior.register=async()=>{throw new Error('offline');};await h.api.install();assert.equal(h.api.status().registered,false);assert.ok(h.api.status().registrationError);h.behavior.register=async()=>{};assert.equal(await h.api.checkForUpdate(),true);assert.equal(h.counts().registerCalls,2);assert.equal(h.sw.listenerCount('message'),1);assert.equal(h.sw.listenerCount('controllerchange'),1);assert.equal(h.api.status().registrationError,'');
});
await test('unsupported mode performs no registration or update work',async()=>{
 const h=harness({supported:false});await h.api.install();assert.equal(await h.api.checkForUpdate(),false);assert.equal(await h.api.apply(),false);assert.equal(h.counts().registerCalls,0);assert.equal(h.timers.size,0);
});
await test('asset installation failure is not a successful check',async()=>{
 const h=harness();await h.api.install();const installing=h.worker('broken','installing');h.registration.installing=installing;const task=h.api.checkForUpdate();await flush();installing.state='redundant';installing.emit('statechange');assert.equal(await task,false);assert.equal(h.timers.size,0);
});
await test('unacknowledged activation ports and repeated state events remain bounded',async()=>{
 const h=harness();h.candidate.acknowledge=false;await h.api.install();await h.api.apply();h.candidate.state='activating';h.candidate.emit('statechange');h.candidate.emit('statechange');await flush();assert.equal(h.timers.size,2);await h.advance(8000);assert.equal(h.counts().held,0);assert.equal(h.timers.size,0);assert.ok(h.channels.every(c=>c.port1.closed&&c.port2.closed));
});
await test('redundant idle candidate removes update notice without requiring apply',async()=>{
 const h=harness();await h.api.install();h.candidate.state='redundant';h.registration.waiting=null;h.candidate.emit('statechange');await flush();assert.equal(h.api.status().updateReady,false);assert.equal(h.renders.at(-1).updateReady,false);
});
await test('first control acquired while registration is pending never reloads',async()=>{
 const h=harness({controlled:false}),gate=deferred();h.registration.waiting=null;h.behavior.register=()=>gate.promise;const install=h.api.install();await h.activate();gate.resolve();await install;h.message('SD_PWA_ACTIVATED');await flush();assert.equal(h.counts().reloads,0);assert.equal(h.counts().reserves,0);
});
await test('installation check waits for success and bounds stalled downloads',async()=>{
 const h=harness();await h.api.install();const installer=h.worker('download','installing');h.registration.installing=installer;let settled=false;const task=h.api.checkForUpdate().then(result=>{settled=true;return result;});await flush();assert.equal(settled,false);installer.state='installed';h.registration.waiting=installer;installer.emit('statechange');assert.equal(await task,true);assert.equal(h.api.status().waitingReleaseId,'download');installer.state='installing';const stalled=h.api.checkForUpdate();await flush();await h.advance(120000);assert.equal(await stalled,false);assert.equal(h.timers.size,0);
});
await test('removed registration is reacquired on the next bounded check',async()=>{
 const h=harness();await h.api.install();h.behavior.update=async()=>{const error=new Error('unregistered');error.name='InvalidStateError';throw error;};assert.equal(await h.api.checkForUpdate(),false);assert.equal(h.api.status().registered,false);assert.ok(h.api.status().registrationError);
 h.behavior.update=async()=>{};assert.equal(await h.api.checkForUpdate(),true);assert.equal(h.counts().registerCalls,2);assert.equal(h.sw.listenerCount('message'),1);
});
await test('boot confirmation checks the actual page assets and worker before clearing the pending marker',async()=>{
 const h=harness();h.registration.waiting=null;await h.api.install();h.storage.set('reload',JSON.stringify({version:2,releaseId:'old',buildId:'qa-build',assetId:'a'.repeat(24)}));
 assert.equal(await h.api.confirmBoot(),true);assert.equal(h.api.status().bootState,'confirmed');assert.equal(h.api.status().bootReleaseId,'old');assert.ok(h.api.status().bootConfirmedAt);assert.equal(h.storage.has('reload'),false);
 assert.ok(h.old.messages.some(m=>m.type==='SD_PWA_CLIENT_STATE'&&m.assetId==='a'.repeat(24)));assert.equal(h.counts().reloads,0);assert.equal(h.counts().prepareCalls,0);
});
await test('wrong loaded assets keep boot pending and advertise safe manual recovery',async()=>{
 const h=harness();h.registration.waiting=null;await h.api.install();h.old.assetId='b'.repeat(24);h.storage.set('reload',JSON.stringify({version:2,releaseId:'old',assetId:'b'.repeat(24)}));
 assert.equal(await h.api.confirmBoot(),false);assert.equal(h.api.status().bootState,'mismatch');assert.equal(h.api.status().phase,'boot-failed');assert.equal(h.api.status().updateReady,true);assert.equal(h.storage.has('reload'),true);assert.equal(h.counts().reloads,0);
 await h.api.apply();await flush();assert.equal(h.counts().reloads,1);assert.equal(JSON.parse(h.storage.get('reload')).assetId,'b'.repeat(24));h.win.emit('pagehide');
});
await test('legacy markers confirm without suppressing retries; current boot without an update reports client generation',async()=>{
 const h=harness();h.registration.waiting=null;await h.api.install();h.storage.set('reload','old');assert.equal(await h.api.confirmBoot(),true);assert.equal(h.api.status().bootState,'confirmed');assert.equal(h.storage.has('reload'),false);
 assert.equal(await h.api.confirmBoot(),true);assert.equal(h.api.status().bootState,'current');const before=h.old.messages.length;h.win.emit('pageshow');await flush();assert.ok(h.old.messages.length>before);assert.equal(h.counts().reloads,0);
});
await test('download failure has an explicit stage and actionable error; success clears it',async()=>{
 const h=harness();h.registration.waiting=null;await h.api.install();const installer=h.worker('broken','installing');h.registration.installing=installer;
 const task=h.api.checkForUpdate();await flush();assert.equal(h.api.status().phase,'downloading');assert.equal(h.api.status().checking,true);installer.state='redundant';installer.emit('statechange');assert.equal(await task,false);assert.equal(h.api.status().phase,'installation-failed');assert.ok(h.api.status().checkError);assert.equal(h.api.status().checking,false);
 h.registration.installing=null;assert.equal(await h.api.checkForUpdate(),true);assert.equal(h.api.status().checkError,'');assert.equal(h.api.status().phase,'idle');
});
await test('silent browser update check is bounded and late resolution cannot erase its failure',async()=>{
 const h=harness(),gate=deferred();await h.api.install();h.behavior.update=()=>gate.promise;const task=h.api.checkForUpdate();await flush();await h.advance(120000);assert.equal(await task,false);assert.equal(h.api.status().checking,false);assert.equal(h.timers.size,0);assert.ok(h.api.status().checkError);gate.resolve();await flush();assert.equal(h.api.status().phase,'installation-failed');
 // Native registration.update() may complete after JavaScript has timed out;
 // its later worker event cannot bypass the protected reload path.
 h.registration.waiting=h.candidate;h.candidate.state='installed';h.candidate.emit('statechange');await flush();
 assert.equal(h.counts().reloads,0);assert.equal(h.counts().reserves,0);assert.equal(h.api.status().checking,false);
});
for(const stage of ['preparation','activation'])await test(`A to B to C replacement during ${stage} only activates freshly prepared C`,async()=>{
 const h=harness(),gate=deferred();h.candidate.releaseId='A';await h.api.install();if(stage==='preparation')h.behavior.prepare=()=>gate.promise;const task=h.api.apply();await flush();
 const b=h.worker('B'),c=h.worker('C');h.registration.waiting=b;h.message('SD_PWA_UPDATE_AVAILABLE',b);await flush();h.registration.waiting=c;h.message('SD_PWA_UPDATE_AVAILABLE',c);await flush();
 if(stage==='preparation')gate.resolve({ok:true});else{h.candidate.state='redundant';h.candidate.emit('statechange');}await task;await flush();assert.equal(h.counts().held,0);assert.equal(h.counts().reloads,0);assert.equal(h.api.status().waitingReleaseId,'C');assert.ok(!b.messages.some(m=>m.type==='SD_PWA_APPLY_UPDATE'));
 h.behavior.prepare=async()=>({ok:true});await h.api.apply();assert.ok(c.messages.filter(m=>m.type==='SD_PWA_APPLY_UPDATE').every(m=>m.releaseId==='C'));await h.activate(c);assert.equal(h.counts().reloads,1);h.win.emit('pagehide');
});
await test('silent registration is bounded and late completion cannot adopt stale registration',async()=>{
 const h=harness(),gate=deferred();h.behavior.register=()=>gate.promise;const installing=h.api.install();await flush();await h.advance(120000);await installing;assert.equal(h.api.status().phase,'registration-failed');gate.resolve();await flush();assert.equal(h.api.status().registered,false);h.behavior.register=async()=>{};await h.api.install();assert.equal(h.api.status().registered,true);assert.equal(h.counts().registerCalls,2);
});
await test('boot identity timeout stays visible and focus retries proof without reloading',async()=>{
 const h=harness();h.registration.waiting=null;await h.api.install();h.storage.set('reload',JSON.stringify({version:2,releaseId:'old',buildId:'qa-build',assetId:'a'.repeat(24)}));h.old.identityBlocked=true;
 const pending=h.api.confirmBoot();await flush();await h.advance(3000);assert.equal(await pending,false);assert.equal(h.api.status().bootState,'pending');assert.equal(h.api.status().phase,'boot-pending');assert.ok(h.storage.has('reload'));assert.equal(h.timers.size,0);
 h.old.identityBlocked=false;h.win.emit('focus');await flush();assert.equal(h.api.status().bootState,'confirmed');assert.equal(h.api.status().phase,'idle');assert.equal(h.storage.has('reload'),false);assert.equal(h.counts().reloads,0);assert.equal(h.counts().reserves,0);
});
await test('successful checks retry pending proof and never advertise an unconfirmed boot as current',async()=>{
 const h=harness();h.registration.waiting=null;await h.api.install();h.storage.set('reload','old');h.old.identityBlocked=true;const pending=h.api.confirmBoot();await flush();await h.advance(3000);await pending;
 const check=h.api.checkForUpdate();await flush();await h.advance(3000);assert.equal(await check,true);assert.equal(h.api.status().bootState,'pending');assert.equal(h.api.status().phase,'boot-pending');assert.ok(!/up to date|version is confirmed/u.test(h.api.status().message));assert.ok(h.storage.has('reload'));
 h.old.identityBlocked=false;assert.equal(await h.api.checkForUpdate(),true);assert.equal(h.api.status().bootState,'confirmed');assert.equal(h.api.status().phase,'idle');assert.equal(h.storage.has('reload'),false);
});
await test('confirmation can recover offline while preserving an unrelated failed-check status',async()=>{
 const h=harness();h.registration.waiting=null;await h.api.install();h.storage.set('reload','old');h.old.identityBlocked=true;const pending=h.api.confirmBoot();await flush();await h.advance(3000);await pending;
 h.old.identityBlocked=false;h.behavior.update=async()=>{throw new Error('offline');};assert.equal(await h.api.checkForUpdate(),false);assert.equal(h.api.status().bootState,'confirmed');assert.equal(h.api.status().phase,'installation-failed');assert.ok(h.api.status().checkError);assert.equal(h.storage.has('reload'),false);
});
await test('successful proof clears obsolete mismatch status and retains a newer ready candidate',async()=>{
 const h=harness();h.registration.waiting=null;await h.api.install();h.old.assetId='b'.repeat(24);assert.equal(await h.api.confirmBoot(),false);assert.equal(h.api.status().phase,'boot-failed');h.old.assetId='a'.repeat(24);assert.equal(await h.api.confirmBoot(),true);assert.equal(h.api.status().phase,'idle');assert.ok(!/not been confirmed/u.test(h.api.status().message));
 h.old.assetId='b'.repeat(24);await h.api.confirmBoot();h.registration.waiting=h.candidate;h.message('SD_PWA_UPDATE_AVAILABLE',h.candidate);await flush();h.old.assetId='a'.repeat(24);await h.api.confirmBoot();assert.equal(h.api.status().phase,'ready');assert.equal(h.api.status().waitingReleaseId,'next');
});
await test('foreground boot retries coalesce, ignore hidden visibility and do not create idle polling',async()=>{
 const h=harness();h.registration.waiting=null;await h.api.install();h.old.identityBlocked=true;const pending=h.api.confirmBoot();await flush();const channels=h.channels.length;for(let i=0;i<20;i++)h.win.emit('focus');h.doc.emit('visibilitychange');await flush();assert.equal(h.channels.length,channels);assert.equal(h.timers.size,1);await h.advance(3000);await pending;assert.equal(h.timers.size,0);
 h.old.identityBlocked=false;h.doc.hidden=false;h.doc.emit('visibilitychange');await flush();assert.equal(h.api.status().bootState,'current');assert.equal(h.timers.size,0);assert.equal(h.counts().reloads,0);
});
await test('pending proof waits for first control without a preparation or reload',async()=>{
 const h=harness({controlled:false});h.registration.waiting=null;await h.api.install();h.storage.set('reload','next');assert.equal(await h.api.confirmBoot(),false);assert.equal(h.api.status().bootState,'pending');await h.activate();assert.equal(h.api.status().bootState,'confirmed');assert.equal(h.storage.has('reload'),false);assert.equal(h.counts().reloads,0);assert.equal(h.counts().prepareCalls,0);
});
await test('unavailable boot marker storage retains pending state until a foreground retry succeeds',async()=>{
 const h=harness();h.registration.waiting=null;await h.api.install();h.storage.set('reload','old');const read=h.win.sessionStorage.getItem;h.win.sessionStorage.getItem=()=>{throw new Error('session storage unavailable');};assert.equal(await h.api.confirmBoot(),false);assert.equal(h.api.status().bootState,'pending');assert.ok(h.storage.has('reload'));h.win.sessionStorage.getItem=read;h.win.emit('focus');await flush();assert.equal(h.api.status().bootState,'confirmed');assert.equal(h.storage.has('reload'),false);
});
await test('boot opportunities cannot clear a reload marker or replace an active update phase',async()=>{
 const h=harness();await h.api.install();await h.api.confirmBoot();await h.api.apply();h.storage.set('reload','next');const before=h.api.status().phase;assert.equal(await h.api.confirmBoot(),false);h.win.emit('focus');await flush();assert.equal(h.api.status().phase,before);assert.ok(h.storage.has('reload'));assert.equal(h.counts().held,1);h.win.emit('pagehide');
});
console.log(JSON.stringify({status:'PASS',suite:'pwa-lifecycle',cases},null,2));
