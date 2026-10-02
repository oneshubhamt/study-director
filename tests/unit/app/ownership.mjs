import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const execute=file=>vm.runInThisContext(fs.readFileSync(new URL(file,import.meta.url),'utf8'),{filename:file});
execute('../../../source/core/internal.js');
execute('../../../source/core/ownership.js');
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const ownershipModule=registry.require('ownership',1);

const lost=new ownershipModule.OwnershipLostError('lost');
assert.equal(ownershipModule.isOwnershipLostError(lost),true);
assert.equal(ownershipModule.isOwnershipLostError({code:'STUDY_DIRECTOR_OWNERSHIP_LOST'}),true);
assert.equal(ownershipModule.isOwnershipLostError(new Error('other')),false);

let ownershipNow=1000,lastError=null;
const ownerStore=new Map(),sessionStore=new Map(),ownershipHookCalls={render:0,refreshStorage:0,practiceRender:0};
const ownership=ownershipModule.createOwnershipController(Object.freeze({
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
}));
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

console.log(JSON.stringify({status:'PASS',contract:'ownership',ownershipWriteFence:true,appScopedContract:true},null,2));
