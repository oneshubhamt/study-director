import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

for(const file of ['source/core/internal.js','source/core/ownership.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const Ownership=registry.require('ownership',1);
const freeze=Object.freeze;

let now=1000,captured=[];
const ownerStore=new Map(),sessionStore=new Map();
const doc={documentElement:{dataset:{}}};
const drain=async(turns=24)=>{for(let i=0;i<turns;i++)await Promise.resolve();};
const controller=Ownership.createOwnershipController(freeze({
  config:freeze({storageKey:'owner',sessionTabKey:'tab',channelName:'qa-r125',heartbeatMs:1000,staleMs:10000,probeMs:25,webLockName:'qa-r125-lock'}),
  environment:freeze({
    document:doc,
    window:{sessionStorage:{getItem:key=>sessionStore.get(key)||null,setItem:(key,value)=>sessionStore.set(key,String(value))},navigator:{},addEventListener:()=>{}},
    now:()=>now,randomIdPart:()=> 'r125fixed',setInterval:()=>1,clearInterval:()=>{},setTimeout:()=>1,clearTimeout:()=>{}
  }),
  local:freeze({getJson:(key,fallback)=>ownerStore.has(key)?ownerStore.get(key):fallback,setJson:(key,value)=>{ownerStore.set(key,value);return true;},remove:key=>ownerStore.delete(key),lastError:()=>null}),
  diagnostics:freeze({capture:(scope,error)=>captured.push({scope,error:String(error?.message||error)}),guard:(_scope,fn)=>{try{return fn();}catch{return false;}}}),
  hooks:freeze({
    render:()=>{},refreshStorage:()=>{},stopExecution:()=>{},isInitialized:()=>true,
    hydrate:async()=>true,
    finalizeHydration:async()=>{throw new Error('Injected canonical Preferences hydration failure');},
    resume:()=>{},refreshCore:()=>{},scheduleMaintenance:()=>{},practiceRender:()=>{},blocked:()=>{},invalidate:()=>{},flush:()=>{},settled:async()=>{}
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

console.log(JSON.stringify({status:'PASS',suite:'ownership-hydration-fail-closed',hydratingNotWritable:true,failedHydrationFaults:true,leaseReleased:true},null,2));
