import {fileURLToPath} from 'node:url';
import {readScript} from '../../../build/source-script.mts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const execute=file=>vm.runInThisContext(readScript(fileURLToPath(new URL(file,import.meta.url))),{filename:file});
execute('../../../source/core/internal.js');
execute('../../../source/core/ownership.ts');
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const ownershipModule=registry.require('ownership',1);

const lost=new ownershipModule.OwnershipLostError('lost');
assert.equal(ownershipModule.isOwnershipLostError(lost),true);
assert.equal(ownershipModule.isOwnershipLostError({code:'STUDY_DIRECTOR_OWNERSHIP_LOST'}),true);
assert.equal(ownershipModule.isOwnershipLostError(new Error('other')),false);

let ownershipNow=1000,lastError=null;
const ownerStore=new Map(),sessionStore=new Map(),ownershipHookCalls={render:0,refreshStorage:0,practiceRender:0};
const ownershipInput=Object.freeze({
  config:Object.freeze({storageKey:'owner',sessionTabKey:'tab',channelName:'test',heartbeatMs:1000,staleMs:100,probeMs:25,webLockName:'test-lock'}),
  environment:Object.freeze({
    document:{documentElement:{dataset:{}},visibilityState:'visible'},
    window:{sessionStorage:{getItem:key=>sessionStore.get(key)||null,setItem:(key,value)=>sessionStore.set(key,String(value))},navigator:{},addEventListener:()=>{}},
    now:()=>ownershipNow,randomIdPart:()=> 'fixed',setInterval:()=>1,clearInterval:()=>{},setTimeout:()=>1,clearTimeout:()=>{}
  }),
  local:Object.freeze({
    getJson:(key,fallback)=>ownerStore.has(key)?ownerStore.get(key):fallback,
    setJson:(key,value)=>{ownerStore.set(key,value);lastError=null;return true;},
    remove:key=>ownerStore.delete(key),lastError:()=>lastError
  }),
  diagnostics:Object.freeze({capture:()=>{},guard:(_scope,fn)=>fn()}),
  hooks:Object.freeze({
    render:()=>{ownershipHookCalls.render+=1;},refreshStorage:()=>{ownershipHookCalls.refreshStorage+=1;},stopExecution:()=>{},isInitialized:()=>false,hydrate:async()=>{},finalizeHydration:async()=>{},resume:()=>{},refreshCore:()=>{},
    scheduleMaintenance:()=>{},practiceRender:()=>{ownershipHookCalls.practiceRender+=1;},blocked:()=>{},invalidate:()=>{},flush:async()=>{},settled:async()=>{}
  })
});
const ownership=ownershipModule.createOwnershipController(ownershipInput);
assert.equal(ownership.writeLease({force:true}),true);
const initialHookCalls={...ownershipHookCalls};
ownershipNow=1050;
assert.equal(ownership.writeLease({force:true}),true,'A primary tab must be able to renew its ownership lease.');
assert.deepEqual(ownershipHookCalls,initialHookCalls,'A routine ownership heartbeat must renew only the lease; it must not re-run whole-app UI/storage hooks.');
const writeToken=ownership.issueWriteToken('unit write');
assert.equal(ownership.assertWriteToken(writeToken,'unit commit'),true);
ownershipNow=1200;
assert.throws(()=>ownership.assertWriteToken(writeToken,'expired commit'),error=>ownershipModule.isOwnershipLostError(error));
assert.equal(ownership.writeLease({force:true}),true);
assert.equal(ownership.assertWriteToken(writeToken,'renewed commit'),true);
ownerStore.set('owner',{...ownerStore.get('owner'),claimId:'other-claim'});
assert.throws(()=>ownership.assertWriteToken(writeToken,'tampered commit'),error=>ownershipModule.isOwnershipLostError(error));
assert.equal(ownership.format,'study-director.app-ownership-controller');
assert.equal(ownership.status().format,'study-director.app-ownership-status');

// Unsuccessful secondary probes must preserve the authority epoch. Actual
// acquisition and release must still invalidate reservations and write tokens.
{
  const values=new Map(),sessions=new Map();let available=false,gate=null,grant=null;
  const locks={request:async(_name,options,callback)=>{assert.equal(options.ifAvailable,true);if(gate)await gate;return callback(available?{}:null);}};
  const input=Object.freeze({...ownershipInput,
    environment:Object.freeze({...ownershipInput.environment,document:{documentElement:{dataset:{}},visibilityState:'visible'},window:{sessionStorage:{getItem:key=>sessions.get(key)||null,setItem:(key,value)=>sessions.set(key,value)},navigator:{locks},addEventListener:()=>{}}}),
    local:Object.freeze({getJson:(key,fallback)=>values.get(key)||fallback,setJson:(key,value)=>{values.set(key,value);return true;},remove:key=>values.delete(key),lastError:()=>null})
  });
  const tab=ownershipModule.createOwnershipController(input);
  assert.equal(await tab.evaluate(),false);const secondary=tab.status();assert.equal(secondary.state,'secondary');
  for(let attempt=0;attempt<50;attempt++){
    assert.equal(await tab.evaluate(),false);assert.equal(tab.status().revision,secondary.revision);assert.equal(tab.canMutate(),false);
    assert.throws(()=>tab.issueWriteToken('secondary write'),error=>ownershipModule.isOwnershipLostError(error));
  }
  available=true;gate=new Promise(resolve=>grant=resolve);const acquiring=tab.evaluate();
  assert.equal(tab.status().state,'secondary');assert.equal(tab.status().revision,secondary.revision);assert.equal(tab.canMutate(),false);
  grant();assert.equal(await acquiring,true);assert.equal(tab.status().state,'primary');assert.ok(tab.status().revision>secondary.revision);
  const token=tab.issueWriteToken('acquired write');assert.equal(tab.assertWriteToken(token),true);
  tab.release();await Promise.resolve();assert.equal(tab.canMutate(),false);
  assert.throws(()=>tab.assertWriteToken(token),error=>ownershipModule.isOwnershipLostError(error));
}

{
  const values=new Map([['owner',{version:2,tabId:'peer-tab',pageId:'peer-page',claimId:'peer-claim',expiresAt:ownershipNow+10000}]]),sessions=new Map(),timers=new Map();let timerId=0,probes=0;
  class PeerChannel{
    postMessage(message){if(message.type==='owner-probe'){probes++;queueMicrotask(()=>this.onmessage({data:{type:'owner-alive',probeId:message.probeId,pageId:'peer-page'}}));}}
  }
  const input=Object.freeze({...ownershipInput,
    environment:Object.freeze({...ownershipInput.environment,document:{documentElement:{dataset:{}},visibilityState:'visible'},window:{sessionStorage:{getItem:key=>sessions.get(key)||null,setItem:(key,value)=>sessions.set(key,value)},navigator:{},BroadcastChannel:PeerChannel,addEventListener:()=>{}},setTimeout:(fn,delay)=>{const id=++timerId;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id)}),
    local:Object.freeze({getJson:(key,fallback)=>values.get(key)||fallback,setJson:(key,value)=>{values.set(key,value);return true;},remove:key=>values.delete(key),lastError:()=>null})
  });
  const tab=ownershipModule.createOwnershipController(input);tab.install();assert.equal(await tab.evaluate(),false);const secondary=tab.status();
  for(let attempt=0;attempt<50;attempt++){
    const checking=tab.evaluate();assert.equal(tab.status().state,'secondary');assert.equal(tab.canMutate(),false);
    assert.equal(await checking,false);assert.equal(tab.status().revision,secondary.revision);assert.equal(timers.size,0);
  }
  assert.equal(probes,51);values.delete('owner');assert.equal(await tab.evaluate(),true);assert.ok(tab.status().revision>secondary.revision);
  const token=tab.issueWriteToken('peer released');tab.release();assert.throws(()=>tab.assertWriteToken(token),error=>ownershipModule.isOwnershipLostError(error));
}

// Only the current lease shape names an owner. A lease without a page id or
// with another version is not a live owner, so this tab can take over.
for(const lease of [{version:1,tabId:'old-tab',claimId:'old-claim',expiresAt:ownershipNow+10000},{version:2,tabId:'old-tab',claimId:'old-claim',expiresAt:ownershipNow+10000}]){
  const values=new Map([['owner',lease]]),sessions=new Map();
  const input=Object.freeze({...ownershipInput,
    environment:Object.freeze({...ownershipInput.environment,window:{sessionStorage:{getItem:key=>sessions.get(key)||null,setItem:(key,value)=>sessions.set(key,String(value))},navigator:{},addEventListener:()=>{}}}),
    local:Object.freeze({getJson:(key,fallback)=>values.has(key)?values.get(key):fallback,setJson:(key,value)=>{values.set(key,value);return true;},remove:key=>values.delete(key),lastError:()=>null})
  });
  const tab=ownershipModule.createOwnershipController(input);
  assert.equal(await tab.evaluate(),true,`a version ${lease.version} lease without a page id must not keep this tab secondary`);
  assert.equal(values.get('owner').version,2);assert.ok(values.get('owner').pageId);
}

console.log(JSON.stringify({status:'PASS',contract:'ownership',ownershipWriteFence:true,appScopedContract:true},null,2));
