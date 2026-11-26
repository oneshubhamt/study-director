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
  recovery:freeze({readLibraryClear:async()=>null,readRestore:async()=>null,failClosed:()=>assert.fail('unexpected recovery block')}),
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

function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function admissionHarness({library=async()=>null,restore=async()=>null,plan=async()=>true}={}){
  const values=new Map(),sessions=new Map(),events=[],faults=[],errors=[];let clock=1000;
  const activation=StartupHost.createActivation(freeze({capture:(scope,error)=>errors.push({scope,error})}));
  activation.subscribe(event=>events.push(event.kind));
  const tab=StartupHost.createOwnershipController(freeze({
    module:Ownership,config:freeze({storageKey:'owner',sessionTabKey:'tab',channelName:'qa-journal',heartbeatMs:1000,staleMs:10000,probeMs:25,webLockName:'qa-journal-lock'}),
    environment:freeze({document:{documentElement:{dataset:{}}},window:{sessionStorage:{getItem:key=>sessions.get(key)||null,setItem:(key,value)=>sessions.set(key,String(value))},navigator:{},addEventListener:()=>{}},now:()=>clock,randomIdPart:()=> 'fixed',setInterval:()=>1,clearInterval:()=>{},setTimeout:()=>1,clearTimeout:()=>{}}),
    local:freeze({getJson:(key,fallback)=>values.get(key)||fallback,setJson:(key,value)=>{values.set(key,value);return true;},remove:key=>values.delete(key),lastError:()=>null}),
    diagnostics:freeze({capture:(scope,error)=>errors.push({scope,error}),guard:(_scope,work)=>work()}),activation,reloadHint:()=>false,
    lifecycle:freeze({isReady:()=>true,resumeStorageReset:()=>events.push('storage-reset')}),
    recovery:freeze({readLibraryClear:library,readRestore:restore,failClosed:(message,kind)=>faults.push({message,kind})}),
    hydration:freeze({hydratePlanData:async()=>{events.push('plan');return plan();},hydratePlanRuntime:()=>events.push('runtime'),renderSavedPlans:()=>events.push('saved-plans'),hydratePrimary:async()=>events.push('session'),censusUnsupported:async()=>events.push('census'),hydrateSavedDrafts:async()=>events.push('drafts')}),
    hooks:freeze({render:()=>{},refreshStorage:()=>{},stopExecution:()=>{},resume:()=>events.push('resume'),refreshCore:()=>{},scheduleMaintenance:()=>events.push('maintenance'),practiceRender:()=>{},blocked:()=>{},peerStorageReset:()=>{},invalidate:()=>{},flush:()=>{},settled:async()=>{}})
  }));
  return {tab,values,events,faults,errors,lose(){tab.release();tab.setPrimary(false);clock+=100;}};
}
for(const kind of ['library-clear','restore','library-read-error','restore-read-error']){
  const gate=deferred(),isLibrary=kind.startsWith('library'),read=()=>gate.promise;
  const h=admissionHarness(isLibrary?{library:read}:{restore:read});
  assert.equal(h.tab.writeLease({force:true}),true,'any initialized acquisition must admit recovery, even without a hydrate hint');
  await drain();
  assert.equal(h.tab.status().state,'hydrating');
  assert.throws(()=>h.tab.issueWriteToken('read repair',{allowHydrating:true}),Ownership.isOwnershipLostError,'unadmitted hydration must not authorize read repair');
  assert.deepEqual(h.events,[],'no projection before both journals are checked');
  if(kind.endsWith('error'))gate.reject(new Error('injected journal read failure'));else gate.resolve({state:{id:'pending'}});
  await drain();
  assert.equal(h.tab.status().state,'faulted');assert.equal(h.tab.canMutate(),false);
  assert.equal(h.values.has('owner'),false);assert.equal(h.faults.length,1);
  assert.equal(h.faults[0].kind,kind.endsWith('error')?'journal-verification':kind);
  assert.deepEqual(h.events,[],'pending or unreadable journal cannot hydrate any domain');
  assert.equal(await h.tab.evaluate(),false,'reload-required fault is not retried by heartbeat');
  assert.equal(await h.tab.takeOwnership(true),false);
  assert.equal(h.tab.writeLease({force:true,hydrate:true}),false);
}
{
  const gate=deferred(),h=admissionHarness({plan:()=>gate.promise});
  h.tab.writeLease({force:true,hydrate:true});await drain();
  assert.deepEqual(h.events,['plan']);assert.equal(h.tab.canMutate(),false);
  const token=h.tab.issueWriteToken('permitted session reconciliation',{allowHydrating:true});assert.equal(h.tab.assertWriteToken(token),true);
  gate.resolve(true);await drain();
  assert.equal(h.tab.canMutate(),true);
  assert.deepEqual(h.events,['plan','runtime','saved-plans','session','ownership-takeover','storage-reset','census','drafts','resume','maintenance']);
  assert.throws(()=>h.tab.assertWriteToken(token),Ownership.isOwnershipLostError,'hydration token cannot outlive its phase');
}
for(const late of ['pending','failure','clear']){
  const first=deferred(),second=deferred();let reads=0;
  const h=admissionHarness({library:()=>++reads===1?first.promise:second.promise});
  h.tab.writeLease({force:true,hydrate:true});await drain();h.lose();
  h.tab.writeLease({force:true,hydrate:true});await drain();const successor=h.tab.status();
  if(late==='failure')first.reject(Error('obsolete journal read'));else first.resolve(late==='pending'?{state:{id:'old'}}:null);
  await drain();
  assert.deepEqual(h.tab.status(),successor,'former admission must not release, promote or fault the successor');
  assert.deepEqual(h.events,[]);assert.deepEqual(h.faults,[]);
  second.resolve(null);await drain();assert.equal(h.tab.canMutate(),true);
}
{
  const first=deferred();let plans=0;
  const h=admissionHarness({plan:()=>++plans===1?first.promise:Promise.resolve(true)});
  h.tab.writeLease({force:true,hydrate:true});await drain();h.lose();
  h.tab.writeLease({force:true,hydrate:true});await drain();assert.equal(h.tab.canMutate(),true);
  const successor=h.tab.status(),events=h.events.slice();
  first.reject(Error('obsolete projection failure'));await drain();
  assert.deepEqual(h.tab.status(),successor);assert.deepEqual(h.events,events);assert.deepEqual(h.faults,[]);
}
console.log('PASS: actual ownership/StartupHost — pending and unreadable journals deny takeover and hydration tokens, normal admission works, stale claim results cannot affect successors');

 // Test the actual final hydration owner as well as the ownership wrapper.
for(const stage of ['plan','preferences']){
  for(const outcome of ['success','failure']){
    const gate=deferred(),entered=deferred(),events=[];let valid=true;
    const assertOrigin=()=>{if(!valid)throw Error('retired hydration');};
    const wait=async check=>{assert.equal(check,assertOrigin);entered.resolve();return gate.promise;};
    const hydrate=StartupHost.createDraftHydration({
      document:{querySelector:()=>null},
      hydratePlan:check=>stage==='plan'?wait(check):Promise.resolve(),
      hydratePreferences:options=>stage==='preferences'?wait(options.assertOrigin):Promise.resolve(),
      capture:()=>events.push('capture'),markStorageError:()=>events.push('error'),
      projectPlan:()=>events.push('project'),renderSavedPlans:()=>events.push('render'),
      quote:()=>'',quoteChanged:()=>events.push('quote')
    });
    const pending=hydrate({forcePreferences:true,failClosed:true,assertOrigin}),rejected=assert.rejects(pending,/retired hydration/u);
    await entered.promise;valid=false;
    if(outcome==='failure')gate.reject(Error('late read failure'));else gate.resolve();
    await rejected;
    assert.deepEqual(events,[],'retired hydration cannot project or publish storage errors');
  }
}
console.log('PASS: final hydration forwards and enforces the originating ownership guard on both read outcomes');
