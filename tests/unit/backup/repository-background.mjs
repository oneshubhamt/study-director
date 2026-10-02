import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

for(const file of ['source/core/internal.js','source/core/operation-lifecycle.js','source/core/repository-background.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const module=registry.require('repository-background',1,Object.freeze({lifecycle:registry.require('operation-lifecycle',1)})),freeze=Object.freeze;

function clock(start=Date.parse('2026-09-26T00:00:00.000Z')){
  let now=start,next=0;const timers=new Map();
  async function advance(ms){now+=ms;for(;;){const due=[...timers.entries()].filter(([,row])=>row.at<=now).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;timers.delete(due[0]);due[1].callback();await Promise.resolve();await Promise.resolve();}}
  return freeze({now:()=>now,setTimeout:(callback,delay)=>{const id=++next;timers.set(id,{callback,at:now+Math.max(0,Number(delay)||0)});return id;},clearTimeout:id=>timers.delete(id),advance,pending:()=>[...timers.values()].map(row=>row.at-now).sort((a,b)=>a-b)});
}
function coordinator(fake,target='device-folder'){
  return module.createCoordinator(freeze({target,environment:freeze({AbortController:globalThis.AbortController,clearTimeout:fake.clearTimeout,now:fake.now,setTimeout:fake.setTimeout})}));
}

{
  const fake=clock(),bg=coordinator(fake),cancelled=new AbortController();cancelled.abort();assert.equal(await bg.beginBackground('integrity',{externalSignal:cancelled.signal}),null);
  const foreground=bg.beginForeground({externalSignal:cancelled.signal});await assert.rejects(foreground.settled,{name:'AbortError'});foreground.release();assert.equal(fake.pending().length,0);
  bg.schedule('maintenance',1000,()=>{});const state=bg.jobStatus('maintenance',false,{status:'pending',reason:'gc-grace'});assert.equal(state.state,'scheduled');assert.equal(state.lastOutcome,'deferred');assert.equal(Date.parse(state.nextEligibleAt),fake.now()+1000);
  const hold=bg.suspend();assert.equal(bg.jobStatus('maintenance').state,'paused');assert.equal(bg.jobStatus('maintenance').scheduled,true);await hold.settled;bg.resume(hold);bg.clearAllScheduled();
  const pending=bg.maintenanceDetails({phase:'pending',reason:'delete-failure',cleanup:{gcPending:true,gcFailures:1}});assert.equal(bg.outcome(pending),'failed');assert.equal(pending.gcFailures,1);
  const integrity=bg.integrityDetails({status:'completed',complete:false,checked:2,total:4});assert.equal(bg.outcome(integrity),'yielded');assert.equal(integrity.checked,2);
  assert.equal(bg.integrityDetails({status:'unavailable',reason:'private transport path'}).reason,'repository-unavailable');
  const mixed=bg.integrityDetails({status:'yielded',complete:false,checked:0,attempted:1,corruption:true});assert.equal(mixed.attempted,1);assert.equal(mixed.checked,0);assert.equal(bg.outcome(mixed),'yielded');assert.equal(mixed.reason,'integrity-corrupt');
}

{
  assert.equal(module.maintenancePlan(freeze({gcPending:true,checkpointDeferred:1})).reason,'bounded-continuation');
  const fallbackContention=module.maintenancePlan(freeze({gcPending:true,maintenanceBlocked:true}));assert.equal(fallbackContention.reason,'publication-contention');assert.equal(fallbackContention.retryMs,module.maintenance.contentionMs);const hintedContention=module.maintenancePlan(freeze({gcPending:true,maintenanceBlocked:true,contentionRetryMs:1234567}));assert.equal(hintedContention.retryMs,1234567,'coordination-aware maintenance must honor the actual marker-expiry retry hint');
  assert.equal(module.maintenancePlan(freeze({gcPending:true,gcFailures:1})).reason,'delete-failure');
  assert.equal(module.maintenancePlan(freeze({gcPending:true,gcSkipped:true})).reason,'blocked-uncertain');
  assert.equal(module.maintenancePlan(freeze({gcPending:true,gcDeferred:1})).reason,'gc-grace');
assert.equal(module.maintenanceDefersAcrossObservation(freeze({reason:'publication-contention'})),true,'publication-contention backoff must survive routine repository observations');
}

{
  const fake=clock(),bg=coordinator(fake);let fired=0;
  bg.schedule('maintenance',1000,()=>{fired+=1;});
  const foreground=bg.beginForeground();assert.ok(foreground);await fake.advance(2000);assert.equal(fired,0,'foreground ownership must disarm scheduled background work');
  foreground.release();await fake.advance(0);assert.equal(fired,1,'deferred background work must resume after foreground release');
}

{
  const fake=clock(),bg=coordinator(fake);let fired=0;const automatic=await bg.beginBackground('automatic');assert.ok(automatic);
  bg.schedule('maintenance',1000,()=>{fired+=1;});await fake.advance(1500);assert.equal(fired,0,'lower-priority scheduled work must not fire while a higher-priority background job owns the target');
  automatic.release();await fake.advance(0);assert.equal(fired,1,'deferred scheduled work must re-arm when the higher-priority owner releases');
}

{
  const fake=clock(),bg=coordinator(fake);const low=await bg.beginBackground('integrity');assert.ok(low);
  const higherPromise=bg.beginBackground('maintenance');await Promise.resolve();assert.equal(low.signal.aborted,true,'higher-priority maintenance must pre-empt integrity');low.release();const higher=await higherPromise;assert.ok(higher);higher.release();
}

// Different contenders can await the same retiring executor. Admission must
// recheck all current owners, and an aborted executor remains active until release.
for(const pair of [['maintenance','automatic'],['maintenance','convergence'],['automatic','convergence']]){
 for(const order of [pair,[...pair].reverse()]){
  const fake=clock(),bg=coordinator(fake),original=await bg.beginBackground('integrity');
  const requests=order.map(job=>bg.beginBackground(job));assert.equal(original.signal.aborted,true);original.release();
  const acquired=await Promise.all(requests),winner=acquired.find(Boolean),highest=pair[1];
  assert.equal(acquired.filter(Boolean).length,1,'only one contender may acquire after a shared wait');
  assert.equal(bg.status().active.length,1,'a live executor must not overlap another background job');
  assert.equal(winner.signal.aborted,winner.job!==highest,'higher-priority contention must preempt the newly admitted lower executor');
  winner.release();const retry=await bg.beginBackground(highest);assert.ok(retry,'the existing retry path must acquire after actual release');retry.release();
  assert.deepEqual(bg.status().active,[]);assert.deepEqual(fake.pending(),[]);
 }
}
{
 const fake=clock(),bg=coordinator(fake),original=await bg.beginBackground('integrity');
 const contenders=[bg.beginBackground('maintenance'),bg.beginBackground('convergence')],foreground=bg.beginForeground();
 original.release();assert.deepEqual(await Promise.all(contenders),[null,null],'foreground arrival must prevent pending contenders from acquiring');
 await foreground.settled;foreground.release();assert.deepEqual(fake.pending(),[]);
}

{
  const fake=clock(),bg=coordinator(fake);const running=await bg.beginBackground('maintenance');assert.ok(running);const foreground=bg.beginForeground();assert.ok(foreground);assert.equal(running.signal.aborted,true,'foreground work must abort active background work');running.release();await foreground.settled;foreground.release();assert.deepEqual(bg.status().active,[]);
}

{
  const fake=clock(),bg=coordinator(fake);const running=await bg.beginBackground('automatic');assert.ok(running);let settled=false;
  const suspension=bg.suspend('managed-recovery');suspension.settled.then(()=>{settled=true;});await Promise.resolve();assert.equal(running.signal.aborted,true,'suspension must abort active background work');assert.equal(settled,false,'suspension settlement must wait until aborted background work actually releases');
  running.release();await suspension.settled;assert.equal(settled,true);assert.equal(bg.resume(suspension),true);assert.equal(bg.status().suspended,false);
}

{
  const fake=clock(),bg=coordinator(fake),low=await bg.beginBackground('maintenance'),foreground=bg.beginForeground();
  const failed=assert.rejects(foreground.settled,{code:'REPOSITORY_BACKGROUND_UNSETTLED'});await fake.advance(10000);await failed;
  assert.deepEqual([...bg.status().active],['maintenance'],'timeout must not pretend the old executor released');foreground.release();
  const higher=bg.beginBackground('automatic');await fake.advance(10000);assert.equal(await higher,null,'higher-priority work must not overlap an unsettled lower job');
  low.release();const retry=bg.beginForeground();await retry.settled;retry.release();assert.deepEqual(fake.pending(),[],'settlement deadlines must be retired after recovery');
}
{
  const fake=clock(),bg=coordinator(fake),low=await bg.beginBackground('integrity'),foreground=bg.beginForeground();
  const failed=assert.rejects(foreground.settled,{name:'AbortError'});foreground.controller.abort(Object.assign(new Error('cancelled'),{name:'AbortError'}));await failed;
  assert.deepEqual(fake.pending(),[]);assert.deepEqual([...bg.status().active],['integrity']);foreground.release();low.release();
}

{
  const fake=clock(),bg=coordinator(fake);let stored=null,markCalls=0;
  const intent=bg.maintenanceIntent(freeze({scope:()=>'actual-repository',capture:()=>{},read:async()=>stored,mark:async value=>{markCalls+=1;stored=freeze({requestedAt:new Date(fake.now()).toISOString(),...value});return true;},clear:async()=>{stored=null;return true;},selectRetention:rows=>freeze({remove:freeze(rows.length>1?[rows[0]]:[])})}));
  const decision=await intent.observe(freeze({uncommitted:freeze([{id:'cp_x'}]),rows:freeze([])}));assert.equal(decision.needed,true);assert.equal(markCalls,1);assert.equal(stored.reason,'repository-state');assert.equal(decision.schedule,true);
  stored=freeze({requestedAt:new Date(fake.now()).toISOString(),nextEligibleAt:new Date(fake.now()+module.maintenance.blockedMs).toISOString(),reason:'blocked-uncertain'});const preserved=await intent.observe(freeze({uncommitted:freeze([{id:'cp_y'}]),rows:freeze([])}));assert.equal(markCalls,1,'a deferred blocked state must not be pulled forward by repeated observation');assert.equal(preserved.pending.reason,'blocked-uncertain');
}

{
  const fake=clock(),bg=coordinator(fake);const intent=bg.maintenanceIntent(freeze({scope:()=>'actual-repository',capture:()=>{},read:async()=>null,mark:async()=>false,clear:async()=>true,selectRetention:()=>freeze({remove:freeze([])})}));
  const decision=await intent.observe(freeze({uncommitted:freeze([{id:'cp_z'}]),rows:freeze([])}));assert.equal(decision.writeFailed,true);assert.equal(decision.reason,'intent-write-failed');assert.equal(decision.delay,module.maintenance.errorMs,'failed durable intent creation must back off and retry intent creation, not pretend maintenance is runnable');
}


{
  const fake=clock(),bg=coordinator(fake);let stored=freeze({requestedAt:new Date(fake.now()).toISOString(),nextEligibleAt:new Date(fake.now()).toISOString(),reason:'repository-state'}),seenTrigger='';
  const intent=bg.maintenanceIntent(freeze({scope:()=>'actual-repository',capture:()=>{},read:async()=>stored,mark:async value=>{stored=freeze({requestedAt:stored.requestedAt,...value});return true;},clear:async()=>{stored=null;return true;},selectRetention:()=>freeze({remove:freeze([])})}));
  const scheduler=bg.createMaintenanceScheduler(freeze({intent,budgetMs:1000,budgetCode:'TEST_BUDGET',budgetMessage:'budget',preemptCode:'TEST_PREEMPT',preemptMessage:'preempt',capture:()=>{},isAvailable:()=>true,isBusy:()=>false,execute:async({trigger})=>{seenTrigger=trigger;return freeze({gcPending:false});},report:()=>{}}));
  scheduler.schedule(1000,'first-trigger','earliest');scheduler.schedule(5000,'later-trigger','earliest');await fake.advance(1000);while(scheduler.status().running)await Promise.resolve();assert.equal(seenTrigger,'first-trigger','an earlier retained maintenance timer must keep the trigger that actually scheduled it');
}

{
  const fake=clock(),bg=coordinator(fake);let stored=freeze({requestedAt:new Date(fake.now()).toISOString(),nextEligibleAt:new Date(fake.now()).toISOString(),reason:'repository-state'}),cleanup=freeze({gcPending:true,checkpointDeferred:1}),reports=[];
  const intent=bg.maintenanceIntent(freeze({scope:()=>'actual-repository',capture:()=>{},read:async()=>stored,mark:async value=>{stored=freeze({requestedAt:stored?.requestedAt||new Date(fake.now()).toISOString(),...value});return true;},clear:async()=>{stored=null;return true;},selectRetention:()=>freeze({remove:freeze([])})}));
  const scheduler=module.createMaintenanceScheduler(freeze({coordinator:bg,intent,budgetMs:20000,budgetCode:'TEST_BUDGET',budgetMessage:'budget',preemptCode:'TEST_PREEMPT',preemptMessage:'preempt',capture:()=>{},isAvailable:()=>true,isBusy:()=>false,execute:async()=>cleanup,report:event=>reports.push(event)}));
  const first=await scheduler.run('unit');assert.equal(first.reason,'bounded-continuation');assert.equal(stored.reason,'bounded-continuation');assert.equal(fake.pending()[0],module.maintenance.continuationMs,'bounded work must continue promptly');
  cleanup=freeze({gcPending:true,gcDeferred:1});await fake.advance(module.maintenance.continuationMs);while(scheduler.status().running)await Promise.resolve();assert.equal(stored.reason,'gc-grace');assert.equal(fake.pending()[0],module.maintenance.graceMs,'grace-only maintenance must sleep rather than hot-loop');
  cleanup=freeze({gcPending:false,gcRemoved:1});await fake.advance(module.maintenance.graceMs);while(scheduler.status().running)await Promise.resolve();assert.equal(stored,null,'completed maintenance must retire its durable marker');assert.ok(reports.some(event=>event.phase==='settled'),'scheduler must expose post-settlement state for UI/status refresh');
}

{
  const fake=clock(),bg=coordinator(fake);let stored=freeze({requestedAt:new Date(fake.now()).toISOString(),nextEligibleAt:new Date(fake.now()).toISOString(),reason:'repository-state'}),executed=0;
  const intent=bg.maintenanceIntent(freeze({scope:()=>'actual-repository',capture:()=>{},read:async()=>stored,mark:async value=>{stored=freeze({requestedAt:stored.requestedAt,...value});return true;},clear:async()=>{stored=null;return true;},selectRetention:()=>freeze({remove:freeze([])})}));
  const scheduler=module.createMaintenanceScheduler(freeze({coordinator:bg,intent,budgetMs:1000,budgetCode:'TEST_BUDGET',budgetMessage:'budget',preemptCode:'TEST_PREEMPT',preemptMessage:'preempt',capture:()=>{},isAvailable:()=> 'awaiting-connection',isBusy:()=>false,execute:async()=>{executed+=1;return freeze({gcPending:false});},report:()=>{}}));
  const result=await scheduler.run('unit');assert.equal(result.reason,'awaiting-connection');assert.equal(executed,0);assert.equal(fake.pending().length,0,'event-driven unavailability must not become background polling');assert.ok(stored,'pending maintenance must remain durable while its target is unavailable');
}

{
  const fake=clock(),bg=coordinator(fake);let stored=null;
  const intent=bg.maintenanceIntent(freeze({scope:()=>'actual-repository',capture:()=>{},read:async()=>stored,mark:async value=>{stored=freeze({requestedAt:stored?.requestedAt||new Date(fake.now()).toISOString(),...value});return true;},clear:async()=>{stored=null;return true;},selectRetention:()=>freeze({remove:freeze([])})}));
  const scheduler=bg.createMaintenanceScheduler(freeze({intent,budgetMs:1000,budgetCode:'TEST_BUDGET',budgetMessage:'budget',preemptCode:'TEST_PREEMPT',preemptMessage:'preempt',capture:()=>{},isAvailable:()=>true,isBusy:()=>false,execute:async()=>freeze({gcPending:false}),report:()=>{}}));
  const pending=await scheduler.adopt(freeze({gcPending:true,gcDeferred:2}),{trigger:'external-cleanup',pending:await intent.read()});assert.equal(pending.reason,'gc-grace');assert.equal(stored.reason,'gc-grace');assert.equal(fake.pending()[0],module.maintenance.graceMs,'adopted grace-only cleanup must use the shared deferred cadence');
  const complete=await scheduler.adopt(freeze({gcPending:false,gcRemoved:2}),{trigger:'external-cleanup',pending:await intent.read()});assert.equal(complete.pending,false);assert.equal(stored,null);assert.equal(fake.pending().length,0,'adopted complete cleanup must retire both durable intent and scheduled maintenance');
}

{
  const fake=clock(),bg=coordinator(fake);let target=freeze({completedAt:'',cycleStartedAt:'',cursor:'',quarantinedObjectIds:freeze([])}),executed=0;
  const scheduler=bg.createIntegrityScheduler(freeze({budgetMs:1000,budgetCode:'TEST_BUDGET',budgetMessage:'budget',preemptCode:'TEST_PREEMPT',preemptMessage:'preempt',capture:()=>{},execute:async()=>{executed+=1;return freeze({status:'completed',complete:true});},isAvailable:()=> 'authorized-opportunity',isUnsafe:()=>false,readTarget:async()=>target,writeResult:async()=>{},yieldTask:async()=>{}}));
  const result=await scheduler.run();assert.equal(result.reason,'authorized-opportunity');assert.equal(executed,0);assert.equal(fake.pending().length,0,'opportunity-driven integrity must not poll after authorization becomes unavailable');
}

{
  const fake=clock(),bg=coordinator(fake);let target=freeze({completedAt:'',cycleStartedAt:'',cursor:'',quarantinedObjectIds:freeze([])}),writes=0,executes=0;
  const scheduler=bg.createIntegrityScheduler(freeze({budgetMs:20000,budgetCode:'TEST_INTEGRITY_BUDGET',budgetMessage:'budget',preemptCode:'TEST_INTEGRITY_PREEMPTED',preemptMessage:'preempted',capture:()=>{},execute:async({signal})=>{assert.ok(signal);executes+=1;return freeze({status:'completed',complete:true,cursor:'',checked:1,checkedBytes:1,total:1});},isAvailable:()=>true,isUnsafe:()=>false,readTarget:async()=>target,writeResult:async result=>{writes+=1;target=freeze({...target,completedAt:new Date(fake.now()).toISOString(),cursor:String(result.cursor||'')});},yieldTask:async()=>{}}));
  const result=await scheduler.run();assert.equal(result.status,'completed');assert.equal(executes,1);assert.equal(writes,1);assert.equal(fake.pending()[0],module.integrity.intervalMs,'completed integrity work must schedule its real recurrence interval');
}


{
  const fake=clock(),bg=coordinator(fake);let target=freeze({completedAt:'',cycleStartedAt:'',cursor:'',quarantinedObjectIds:freeze([])}),seenSignal=null;
  const scheduler=bg.createIntegrityScheduler(freeze({budgetMs:20000,budgetCode:'TEST_INTEGRITY_BUDGET',budgetMessage:'budget',preemptCode:'TEST_INTEGRITY_PREEMPTED',preemptMessage:'preempted',capture:()=>{},execute:({signal})=>new Promise((resolve,reject)=>{seenSignal=signal;if(signal.aborted)return reject(signal.reason);signal.addEventListener('abort',()=>reject(signal.reason),{once:true});}),isAvailable:()=>true,isUnsafe:()=>false,readTarget:async()=>target,writeResult:async()=>{},yieldTask:async()=>{}}));
  const task=scheduler.run();for(let i=0;i<8&&!seenSignal;i+=1)await Promise.resolve();assert.ok(seenSignal,'shared integrity scheduler must acquire a cancellable background scope before execution');const foreground=bg.beginForeground();assert.ok(foreground);const result=await task;assert.equal(result.status,'skipped');assert.equal(result.reason,'preempted');await foreground.settled;foreground.release();
}

{
  const fake=clock(),bg=coordinator(fake);let stored=freeze({requestedAt:new Date(fake.now()).toISOString(),nextEligibleAt:new Date(fake.now()).toISOString(),reason:'repository-state'}),reports=[];
  const intent=bg.maintenanceIntent(freeze({scope:()=>'actual-repository',capture:()=>{},read:async()=>stored,mark:async value=>{stored=freeze({requestedAt:stored.requestedAt,...value});return true;},clear:async()=>{stored=null;return true;},selectRetention:()=>freeze({remove:freeze([])})}));
  const scheduler=bg.createMaintenanceScheduler(freeze({intent,budgetMs:1000,budgetCode:'TEST_BUDGET',budgetMessage:'budget',preemptCode:'TEST_PREEMPT',preemptMessage:'preempt',capture:()=>{},isAvailable:()=>true,isBusy:()=>false,execute:async()=>{const error=new Error('foreground publication arrived');error.name='AbortError';error.code='TEST_PREEMPT';throw error;},report:event=>reports.push(event)}));
  const result=await scheduler.run('remote-publication');assert.equal(result.reason,'preempted','A remote foreground publication signalled as AbortError must be classified as a maintenance yield even when the local coordinator signal was not directly aborted.');assert.equal(stored.reason,'preempted');assert.equal(fake.pending()[0],module.maintenance.busyMs,'Yielded maintenance must be rescheduled promptly rather than weakened or abandoned.');assert.ok(reports.some(event=>event.phase==='yielded'));
}

assert.equal(module.integrityResultDelay({status:'yielded',reason:'budget'}),module.integrity.continueMs);
assert.equal(module.integrityResultDelay({status:'yielded',corruption:true,reason:'corrupt',complete:false}),module.integrity.continueMs);
assert.equal(module.integrityResultDelay({status:'failed',corruption:true,recheckComplete:true,complete:true}),module.integrity.failureRetryMs);
assert.equal(module.integrityResultDelay({status:'unavailable',reason:'timeout'}),module.integrity.retryMs);
assert.equal(module.integrityTargetDue({completedAt:new Date().toISOString(),cursor:'verified-prefix'}),true,'partial cycle must remain actionable after a recent prior completion');
for(const phase of ['read','write']){
  const fake=clock(),bg=coordinator(fake);let failing=true,executed=0;
  const scheduler=bg.createIntegrityScheduler(freeze({budgetMs:120000,budgetCode:'TEST_BUDGET',budgetMessage:'budget',preemptCode:'TEST_PREEMPT',preemptMessage:'preempted',capture:()=>{},execute:async()=>{executed++;return {status:'completed',complete:true};},isAvailable:()=>true,isUnsafe:()=>false,readTarget:async()=>{if(phase==='read'&&failing)throw new Error('read unavailable');return {};},writeResult:async()=>{if(phase==='write'&&failing)throw new Error('commit unavailable');},yieldTask:async()=>{}}));
  assert.equal((await scheduler.run()).status,'unavailable');assert.equal(fake.pending()[0],module.integrity.stateRetryMs,'failed state persistence must retain a short retry instead of a completion interval');failing=false;assert.equal((await scheduler.run()).status,'completed');assert.equal(fake.pending()[0],module.integrity.intervalMs);assert.ok(executed>0);
}
console.log(JSON.stringify({status:'PASS',suite:'repository-background',sharedPolicy:true,priority:true,foregroundPreemption:true,suspensionSettlement:true,durableIntent:true,maintenanceLifecycle:true,triggerAttribution:true,integrityRecurrence:true,integrityStateFailureRetry:true},null,2));
