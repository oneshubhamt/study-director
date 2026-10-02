import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

for(const file of ['source/core/internal.js','source/core/mutation-coordinator.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')],mod=registry.require('mutation-coordinator',1),freeze=Object.freeze;

function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
function fixture({durableHeartbeatFailure=false,localHeartbeatFailure=false}={}){
  let intervalCallback=null,releases=0,acquires=0,localWrites=0,localValue=null;
  const coordinator=mod.createCoordinator(freeze({
    configuration:freeze({heartbeatMs:1000,leaseMs:5000,lockName:'qa-mutation',storageKey:'qa-lock'}),
    durable:freeze({
      acquire:async request=>{acquires++;if(durableHeartbeatFailure&&acquires>1)return freeze({acquired:false,holder:freeze({id:'mutation_other',expiresAt:Date.now()+5000})});return freeze({acquired:true,lease:freeze({...request})});},
      release:async()=>{releases++;return true;}
    }),
    environment:freeze({AbortController,addStorageListener:()=>{},clearInterval:()=>{intervalCallback=null;},locks:null,now:()=>Date.now(),randomIdPart:()=> 'abcdefghij',setInterval:callback=>(intervalCallback=callback,1),setTimeout:(callback,delay)=>setTimeout(callback,Math.min(delay,2))}),
    hooks:freeze({refreshUi:()=>{},scheduleUpdate:()=>{}}),
    identity:freeze({canMutate:()=>true,status:()=>freeze({tabId:'tabqa123',pageId:'pageqa123',claimId:'claimqa123'})}),
    local:freeze({getJson:()=>localValue,remove:()=>{localValue=null;return true;},setJson:(_key,value)=>{localWrites++;if(localHeartbeatFailure&&localWrites>1)return false;localValue=value;return true;}})
  }));
  return {coordinator,heartbeat:async()=>{assert.equal(typeof intervalCallback,'function');intervalCallback();for(let i=0;i<20&&acquires<2;i++)await new Promise(r=>setTimeout(r,1));await new Promise(r=>setTimeout(r,1));},stats:()=>({releases,acquires,localWrites})};
}

{
  const f=fixture({localHeartbeatFailure:true}),gate=deferred(),entered=deferred();let authority;
  const task=f.coordinator.runExclusive('clear-library',async value=>{authority=value;entered.resolve();await gate.promise;return 'should-not-commit';});
  await entered.promise;await f.heartbeat();
  assert.equal(authority.signal.aborted,true,'local mirror renewal failure must abort the active mutation');
  assert.equal(authority.status().durableProtected,true,'durable lease must remain the strongest proven authority after local mirror failure');
  assert.equal(f.stats().releases,0,'local mirror failure must not release the durable lease while the operation is still unwinding');
  assert.throws(()=>authority.assert(),error=>error?.code==='STUDY_DIRECTOR_MUTATION_AUTHORITY_LOST');
  assert.equal(authority.assert({allowDurableProtected:true}),true,'rollback may proceed only while durable authority remains proven');
  gate.resolve();await assert.rejects(task,error=>error?.code==='STUDY_DIRECTOR_MUTATION_AUTHORITY_LOST');
  assert.equal(f.stats().releases,1,'durable lease must be released only after the operation settles');
  assert.equal(f.coordinator.status().recoveryFault,'','local mirror degradation must not permanently block later writes after the durable lease was retained through unwind');
  assert.equal(f.coordinator.writesBlocked(),false,'local mirror degradation must clear with the settled operation once no foreign lease remains');
}

{
  const f=fixture({durableHeartbeatFailure:true}),gate=deferred(),entered=deferred();let authority;
  const task=f.coordinator.runExclusive('restore-backup',async value=>{authority=value;entered.resolve();await gate.promise;return true;});
  await entered.promise;await f.heartbeat();
  assert.equal(authority.signal.aborted,true,'durable lease renewal failure must abort the active mutation');
  assert.equal(authority.status().durableProtected,false,'durable renewal failure must not be treated as rollback-safe authority');
  assert.throws(()=>authority.assert({allowDurableProtected:true}),error=>error?.code==='STUDY_DIRECTOR_MUTATION_AUTHORITY_LOST');
  gate.resolve();await assert.rejects(task,error=>error?.code==='STUDY_DIRECTOR_MUTATION_AUTHORITY_LOST');
  assert.match(f.coordinator.status().recoveryFault,/durable data mutation lease/i,'durable authority loss must remain fail-closed after the active operation unwinds');
  assert.equal(f.coordinator.writesBlocked(),true,'durable authority loss must block later writes until recovery/reload resolves the fault');
}

console.log(JSON.stringify({status:'PASS',suite:'mutation-coordinator',localMirrorFailClosed:true,durableLeaseFailClosed:true,rollbackRequiresDurableAuthority:true,localMirrorDoesNotBrickApp:true},null,2));
