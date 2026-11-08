import {readScript} from '../../../build/source-script.mts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

for(const file of ['source/core/internal.js','source/core/mutation-coordinator.ts'])vm.runInThisContext(readScript(file),{filename:file});
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
    hooks:freeze({foreignReleased:()=>{},refreshUi:()=>{},scheduleUpdate:()=>{}}),
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

// A tab closed in the middle of a change leaves its lease in storage until
// it runs out, and nothing announces that. The tab that found it looks again
// when it ends and wakes the work that waited (before, background sync on a
// reopened app stayed paused until something else woke it).
{
  let now=1_000_000,localValue={version:1,tabId:'tabclosed1',pageId:'pageclosed',claimId:'claimclosed',kind:'managed-recovery',id:'mutation_closed',expiresAt:now+20000};
  const timers=[];let released=0,refreshed=0;
  const coordinator=mod.createCoordinator(freeze({
    configuration:freeze({heartbeatMs:1000,leaseMs:20000,lockName:'qa-mutation',storageKey:'qa-lock'}),
    durable:freeze({acquire:async request=>freeze({acquired:true,lease:freeze({...request})}),release:async()=>true}),
    environment:freeze({AbortController,addStorageListener:()=>{},clearInterval:()=>{},locks:null,now:()=>now,randomIdPart:()=> 'abcdefghij',setInterval:()=>1,setTimeout:(callback,delay)=>{timers.push({callback,at:now+delay});return timers.length;}}),
    hooks:freeze({refreshUi:()=>{refreshed++;},scheduleUpdate:()=>{},foreignReleased:()=>{released++;}}),
    identity:freeze({canMutate:()=>true,status:()=>freeze({tabId:'tabqa123',pageId:'pageqa123',claimId:'claimqa123'})}),
    local:freeze({getJson:()=>localValue,remove:()=>{localValue=null;return true;},setJson:(_key,value)=>{localValue=value;return true;}})
  }));
  const fire=()=>{const due=timers.filter(timer=>timer.at<=now);for(const timer of due){timers.splice(timers.indexOf(timer),1);timer.callback();}};
  assert.equal(coordinator.writesBlocked(),true,'another tab\'s lease blocks writes here');
  coordinator.writesBlocked();coordinator.foreignActive();assert.equal(timers.length,1,'one look-again, however often it is asked');
  // The other tab is alive and renews before the end: nothing fires early.
  now+=15000;localValue={...localValue,expiresAt:now+20000};now+=5100;fire();
  assert.equal(released,0,'a renewed lease is not taken for ended');assert.equal(timers.length,1,'and it looks again at the new end');
  // The other tab was closed: its lease simply runs out.
  now+=20000;fire();
  assert.equal(coordinator.writesBlocked(),false,'the ended lease no longer blocks writes');
  assert.equal(released,1,'the work that waited is woken once');assert.ok(refreshed>=1,'and the screen is redrawn');
}

console.log(JSON.stringify({status:'PASS',suite:'mutation-coordinator',localMirrorFailClosed:true,durableLeaseFailClosed:true,rollbackRequiresDurableAuthority:true,localMirrorDoesNotBrickApp:true,closedTabLeaseWakes:true},null,2));
