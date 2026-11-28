import {readScript} from '../../../build/source-script.mts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

for(const file of ['source/core/internal.ts','source/core/mutation-coordinator.ts'])vm.runInThisContext(readScript(file),{filename:file});
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
    identity:freeze({canMutate:()=>true,status:()=>freeze({tabId:'tabqa123',pageId:'pageqa123',claimId:'claimqa123',revision:1})}),
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
    identity:freeze({canMutate:()=>true,status:()=>freeze({tabId:'tabqa123',pageId:'pageqa123',claimId:'claimqa123',revision:1})}),
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

const lost=error=>error?.code==='STUDY_DIRECTOR_MUTATION_AUTHORITY_LOST';
const drain=async()=>{for(let i=0;i<32;i++)await Promise.resolve();};
function lifetime({acquire,locks=null,mirrorFailure=false,release}={}){
  let now=100000,revision=1,claimId='claim_a',writable=true,localValue=null,interval=null;
  const requests=[],releases=[],mirrors=[],timers=[];
  const coordinator=mod.createCoordinator(freeze({
    configuration:freeze({heartbeatMs:1000,leaseMs:5000,lockName:'qa-mutation',storageKey:'qa-lock'}),
    durable:freeze({acquire:async value=>{requests.push(value);return acquire?acquire(value,requests.length):{acquired:true};},release:async(id,owner)=>{releases.push({id,owner});return release?release(id,owner):true;}}),
    environment:freeze({AbortController,addStorageListener:()=>{},clearInterval:()=>{interval=null;},locks,now:()=>now,randomIdPart:()=> 'abcdefghij',setInterval:fn=>(interval=fn,1),setTimeout:fn=>(timers.push(fn),timers.length)}),
    hooks:freeze({foreignReleased:()=>{},refreshUi:()=>{},scheduleUpdate:()=>{}}),
    identity:freeze({canMutate:()=>writable,status:()=>({tabId:'tabqa',pageId:'pageqa',claimId,revision})}),
    local:freeze({getJson:()=>localValue,remove:()=>{localValue=null;return true;},setJson:(_key,value)=>{mirrors.push(value);if(mirrorFailure&&mirrors.length>1)return false;localValue=value;return true;}})
  }));
  return {coordinator,requests,releases,mirrors,timers,get local(){return localValue;},set local(value){localValue=value;},tick:()=>{assert.ok(interval);interval();},advance:ms=>{now+=ms;},change:({sameClaim=false,canMutate=true}={})=>{revision+=2;if(!sameClaim)claimId='claim_b';writable=canMutate;}};
}
// A foreign reservation is a real admission barrier, not just a UI flag.
{
 const f=lifetime(),foreign={version:1,tabId:'other',pageId:'other',claimId:'other',id:'mutation_other',expiresAt:110000};f.local=foreign;
 let entered=false,error;
 try{await f.coordinator.runExclusive('clear-library',()=>{entered=true;});}catch(failure){error=failure;}
 assert.equal(entered,false,'a competing foreign lease must deny entry');
 assert.match(String(error?.message||''),/Another Study Director tab/u);
 assert.deepEqual(f.requests,[],'no durable write may be attempted under a competing mirror');
 assert.deepEqual(f.local,foreign);
 f.local=null;await f.coordinator.runExclusive('clear-library',()=>{entered=true;});
 assert.equal(entered,true,'an eligible successor can write after release');
}
// A stale revision within an unchanged claim is still stale authority.
{
 const gate=deferred(),f=lifetime({acquire:()=>gate.promise});let entered=false;
 const task=f.coordinator.runExclusive('clear-library',()=>{entered=true;}).catch(error=>error);
 await drain();f.change({sameClaim:true});gate.resolve({acquired:true});const error=await task;
 assert.equal(entered,false,'an old revision cannot borrow the same claim after asynchronous admission');
 assert.equal(lost(error),true);assert.deepEqual(f.mirrors,[]);assert.equal(f.releases.length,1);
}
// Baseline reproducer: the real checked owner must not enter the operation
// after its durable acquire resolves for a former ownership claim.
for(const sameClaim of [false,true]){
  const gate=deferred(),f=lifetime({acquire:()=>gate.promise});let entered=false;
  const task=f.coordinator.runExclusive('clear-library',()=>{entered=true;});const rejected=assert.rejects(task,lost);
  await drain();assert.equal(f.requests.length,1);
  assert.equal(f.coordinator.blocksUi(),true,'pending acquisition reserves the operation and UI');
  await assert.rejects(f.coordinator.runExclusive('restore-backup',()=>assert.fail('overlapping request entered')),/already running/u);
  f.change({sameClaim});const successor={version:1,tabId:'tabqa',pageId:'pageqa',claimId:'claim_b',id:'mutation_successor',expiresAt:999999};f.local=successor;
  gate.resolve({acquired:true});await rejected;assert.equal(entered,false);assert.deepEqual(f.mirrors,[]);
  assert.deepEqual(f.releases,[{id:f.requests[0].id,owner:f.requests[0].owner}]);assert.deepEqual(f.local,successor,'cleanup preserves a successor mirror');
  assert.equal(f.coordinator.status().active,'');
}
{
  const gate=deferred(),f=lifetime({locks:{request:async(_name,_options,callback)=>{await gate.promise;return callback({});}}});
  const task=f.coordinator.runExclusive('restore-backup',()=>assert.fail('stale Web Lock entered'));const rejected=assert.rejects(task,lost);await drain();f.change();gate.resolve();await rejected;
  assert.equal(f.requests.length,0,'stale Web Lock cannot request a durable lease');
}
{
  const f=lifetime({acquire:(_value,count)=>count===1?{acquired:false,holder:{expiresAt:103000}}:{acquired:true}});
  const task=f.coordinator.runExclusive('restore-recovery',()=>assert.fail('stale recovery retry entered'));const rejected=assert.rejects(task,lost);
  await drain();assert.equal(f.timers.length,1);f.change();f.timers[0]();await rejected;assert.equal(f.requests.length,1,'recovery wait cannot reacquire for new owner');
}
{
  const gate=deferred(),f=lifetime({acquire:()=>gate.promise});const task=f.coordinator.runExclusive('clear-library',()=>assert.fail('expired acquisition entered'));const rejected=assert.rejects(task,lost);
  await drain();f.advance(5000);gate.resolve({acquired:true});await rejected;assert.deepEqual(f.mirrors,[]);
}
{
  const f=lifetime(),gate=deferred();let old,current;
  await f.coordinator.runExclusive('clear-library',authority=>{old=authority;assert.equal(authority.assert(),true);});
  assert.throws(()=>old.assert(),lost);assert.throws(()=>old.assert({allowDurableProtected:true}),lost);assert.deepEqual(old.status(),{healthy:false,durableProtected:false});
  const next=f.coordinator.runExclusive('restore-backup',async authority=>{current=authority;await gate.promise;});await drain();
  assert.notEqual(f.requests[0].id,f.requests[1].id,'same-time attempts must have distinct IDs');
  assert.throws(()=>old.assert(),lost);assert.equal(current.assert(),true);assert.equal(f.coordinator.assertAuthority(),true);gate.resolve();await next;
  assert.equal(f.coordinator.assertAuthority(),true,'ambient preflight remains available outside mutation');
}
for(const loss of ['claim','revision','expiry','mirror-then-claim','renewal-race']){
  const renewal=deferred(),f=lifetime({mirrorFailure:loss==='mirror-then-claim',acquire:(_value,count)=>loss==='renewal-race'&&count===2?renewal.promise:{acquired:true}}),gate=deferred();let authority;
  const task=f.coordinator.runExclusive('clear-library',async value=>{authority=value;await gate.promise;});const rejected=assert.rejects(task,lost);await drain();
  if(loss==='mirror-then-claim'){f.tick();await drain();assert.equal(authority.assert({allowDurableProtected:true}),true);f.change();}
  else if(loss==='expiry')f.advance(5000);
  else if(loss==='renewal-race'){f.tick();await drain();f.change();renewal.resolve({acquired:true});await drain();assert.equal(f.mirrors.length,1,'late renewal must not mirror successor ownership');}
  else f.change({sameClaim:loss==='revision'});
  assert.throws(()=>authority.assert({allowDurableProtected:true}),lost,loss);
  assert.equal(authority.signal.aborted,true);assert.deepEqual(authority.status(),{healthy:false,durableProtected:false});
  gate.resolve();await rejected;assert.equal(f.coordinator.writesBlocked(),true);
  assert.ok(f.releases.every(value=>value.owner===f.requests[0].owner));
}
{
  const release=deferred(),f=lifetime({release:()=>release.promise});let authority;
  const task=f.coordinator.runExclusive('clear-library',value=>{authority=value;});await drain();assert.equal(f.releases.length,1);
  assert.throws(()=>authority.assert(),lost,'authority retires before asynchronous release settles');
  await assert.rejects(f.coordinator.runExclusive('restore-backup',()=>assert.fail('release overlapped')),/already running/u);
  release.resolve(true);await task;
}
console.log('PASS: immutable origin, pending reservation, retired authority, recovery wait, stale renewal and expired durable protection');

{
  const {coordinator}=lifetime();
  coordinator.failClosed('library fault','library-clear');coordinator.failClosed('restore fault','restore');
  coordinator.clearFault('restore');assert.equal(coordinator.status().recoveryKind,'library-clear');assert.equal(coordinator.writesBlocked(),true);
  await assert.rejects(coordinator.runExclusive('restore-recovery',()=>assert.fail('unrelated recovery admitted')),/library fault/u);
  await coordinator.runExclusive('library-clear-recovery',authority=>{assert.equal(coordinator.writesBlocked(),false);const fence=coordinator.journalFence();assert.equal(fence.assert(),true);authority.assert();coordinator.clearFault('library-clear');});
  assert.equal(coordinator.writesBlocked(),false);
  let retired;await coordinator.runExclusive('restore-backup',()=>{retired=coordinator.journalFence();});
  assert.throws(()=>retired.assert(),lost);
}
