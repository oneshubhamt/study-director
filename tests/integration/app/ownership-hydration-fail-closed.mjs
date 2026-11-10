import {readScript} from '../../../build/source-script.mts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

for(const file of ['source/core/internal.ts','source/core/ownership.ts','source/core/startup-host.ts'])vm.runInThisContext(readScript(file),{filename:file});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const Ownership=registry.require('ownership',1);
const StartupHost=registry.require('startup-host',1);
const freeze=Object.freeze;

let now=1000,captured=[];
const ownerStore=new Map(),sessionStore=new Map();
const doc={documentElement:{dataset:{}}};
const drain=async(turns=24)=>{for(let i=0;i<turns;i++)await Promise.resolve();};
const hydrationEvents=[];
const activation=StartupHost.createActivation(freeze({capture:(scope,error)=>captured.push({scope,error:String(error?.message||error)})}));
activation.subscribe(event=>hydrationEvents.push(`activation:${event.kind}`));
const controller=StartupHost.createOwnershipController(freeze({
  module:Ownership,
  config:freeze({storageKey:'owner',sessionTabKey:'tab',channelName:'qa-r125',heartbeatMs:1000,staleMs:10000,probeMs:25,webLockName:'qa-r125-lock'}),
  environment:freeze({
    document:doc,
    window:{sessionStorage:{getItem:key=>sessionStore.get(key)||null,setItem:(key,value)=>sessionStore.set(key,String(value))},navigator:{},addEventListener:()=>{}},
    now:()=>now,randomIdPart:()=> 'r125fixed',setInterval:()=>1,clearInterval:()=>{},setTimeout:()=>1,clearTimeout:()=>{}
  }),
  local:freeze({getJson:(key,fallback)=>ownerStore.has(key)?ownerStore.get(key):fallback,setJson:(key,value)=>{ownerStore.set(key,value);return true;},remove:key=>ownerStore.delete(key),lastError:()=>null}),
  diagnostics:freeze({capture:(scope,error)=>captured.push({scope,error:String(error?.message||error)}),guard:(_scope,fn)=>{try{return fn();}catch{return false;}}}),
  activation,
  reloadHint:()=>true,
  lifecycle:freeze({isReady:()=>true,resumeStorageReset:()=>hydrationEvents.push('resume-storage-reset')}),
  hydration:freeze({
    hydratePlanData:async()=>{hydrationEvents.push('plan-data');return true;},
    hydratePlanRuntime:()=>hydrationEvents.push('plan-runtime'),
    renderSavedPlans:()=>hydrationEvents.push('saved-plans'),
    hydratePrimary:async options=>{hydrationEvents.push(`primary:${options.sameTabReload}`);return true;},
    censusUnsupported:async()=>{hydrationEvents.push('unsupported-census');return true;},
    hydrateSavedDrafts:async options=>{hydrationEvents.push(`drafts:${options.forcePreferences}:${options.failClosed}`);throw new Error('Injected canonical Preferences hydration failure');}
  }),
  hooks:freeze({
    render:()=>{},refreshStorage:()=>{},stopExecution:()=>{},resume:()=>{},refreshCore:()=>{},scheduleMaintenance:()=>{},practiceRender:()=>{},blocked:()=>{},
    peerStorageReset:()=>{},invalidate:()=>{},flush:()=>{},settled:async()=>{}
  })
}));

assert.equal(controller.writeLease({force:true,hydrate:true}),true,'lease acquisition should enter hydration before the injected failure');
assert.equal(controller.status().state,Ownership.OWNERSHIP_STATES.HYDRATING);
assert.equal(controller.canMutate(),false,'hydrating ownership must not permit writes');
await drain();
assert.equal(controller.status().state,Ownership.OWNERSHIP_STATES.FAULTED,'failed canonical hydration must fault the takeover');
assert.equal(controller.canMutate(),false,'a failed takeover must never become writable');
assert.equal(ownerStore.has('owner'),false,'failed takeover must release its ownership lease');
assert.ok(captured.some(item=>item.scope==='ownership.hydrate'&&/Preferences hydration failure/i.test(item.error)),'hydration failure must be diagnosed');
assert.deepEqual(hydrationEvents.slice(0,8),['plan-data','plan-runtime','saved-plans','primary:true','activation:ownership-takeover','resume-storage-reset','unsupported-census','drafts:true:true'],'startup host must preserve takeover hydration order, merge reload evidence, and force canonical finalization');

console.log(JSON.stringify({status:'PASS',suite:'ownership-hydration-fail-closed',hydratingNotWritable:true,failedHydrationFaults:true,leaseReleased:true,startupHostHydration:true,reloadHintMerged:true},null,2));
