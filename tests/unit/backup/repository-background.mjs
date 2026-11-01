import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createFakeClock} from '../../helpers/fake-clock.mjs';

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
 const fake=clock(),bg=coordinator(fake),scope=await bg.beginBackground('maintenance',{budgetCode:'DELETION_BUDGET'});
 await fake.advance(45000);assert.equal(scope.signal.aborted,false,'responsive read-only discovery has no destructive deadline');
 assert.equal(scope.workBudget.start(1000),true);await fake.advance(600);assert.equal(scope.workBudget.start(1000),false,'a repeated phase notification cannot extend an allowance');
 await fake.advance(401);assert.equal(scope.signal.aborted,false,'elapsed preparation must not kill the first protected unit');scope.workBudget.check();scope.workBudget.advance();assert.throws(()=>scope.workBudget.check(),{code:'DELETION_BUDGET',name:'AbortError'});scope.release();scope.release();assert.equal(fake.pending().length,0);assert.equal(scope.workBudget.start(1000),false);
 const transfer=await bg.beginBackground('convergence');assert.throws(()=>transfer.workBudget.start(1000),/progress watchdogs/u);transfer.release();
  assert.deepEqual(Object.keys(module.priority),['integrity','maintenance','convergence']);
  await assert.rejects(bg.beginBackground('automatic'),/job is invalid/u);
  assert.throws(()=>bg.schedule('automatic',1000,()=>{}),/scheduled job is invalid/u);
  assert.throws(()=>bg.registerJob('automatic',{isAvailable:()=>true,capture:()=>{},execute:async()=>({status:'completed'})}),/job is invalid/u);
}

{
  const fake=clock(),bg=coordinator(fake),cancelled=new AbortController();cancelled.abort();assert.equal(await bg.beginBackground('integrity',{externalSignal:cancelled.signal}),null);
  const foreground=bg.beginForeground({externalSignal:cancelled.signal});await assert.rejects(foreground.settled,{name:'AbortError'});foreground.release();assert.equal(fake.pending().length,0);
  bg.schedule('maintenance',1000,()=>{});const state=bg.jobStatus('maintenance',false,{status:'pending',reason:'gc-grace'});assert.equal(state.state,'scheduled');assert.equal(state.lastOutcome,'deferred');assert.equal(Date.parse(state.nextEligibleAt),fake.now()+1000);assert.equal(bg.status().nextEligibleAt,state.nextEligibleAt);
  const hold=bg.suspend();assert.equal(bg.jobStatus('maintenance').state,'paused');assert.equal(bg.jobStatus('maintenance').scheduled,false);await hold.settled;bg.resume(hold);bg.clearAllScheduled();
  const pending=bg.maintenanceDetails({phase:'pending',reason:'delete-failure',cleanup:{gcPending:true,gcFailures:1}});assert.equal(bg.outcome(pending),'failed');assert.equal(pending.gcFailures,1);
  const integrity=bg.integrityDetails({status:'completed',complete:false,checked:2,total:4});assert.equal(bg.outcome(integrity),'yielded');assert.equal(integrity.checked,2);
  assert.equal(bg.integrityDetails({status:'unavailable',reason:'private transport path'}).reason,'repository-unavailable');
  const mixed=bg.integrityDetails({status:'yielded',complete:false,checked:0,attempted:1,corruption:true});assert.equal(mixed.attempted,1);assert.equal(mixed.checked,0);assert.equal(bg.outcome(mixed),'yielded');assert.equal(mixed.reason,'integrity-corrupt');
}

{
  assert.equal(module.integrityDetails({status:'unavailable',complete:true}).complete,false,'unavailable verification cannot report completion');assert.equal(module.maintenanceDetails({phase:'yielded',reason:'bounded-continuation'}).pending,true,'a yielded attempt retains pending work');
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
  const fake=clock(),bg=coordinator(fake),hold=bg.suspend('qa-hold');
  assert.equal(bg.beginForeground({respectBackgroundSuspension:true}),null,'automatic foreground handoff must not enter while provider background is suspended');
  const manual=bg.beginForeground();assert.ok(manual,'explicit foreground work still overrides a background suspension');assert.equal(manual.signal.aborted,false);manual.release();bg.resume(hold);

  const automatic=bg.beginForeground({respectBackgroundSuspension:true});assert.ok(automatic);
  const paused=bg.suspend('qa-update');assert.equal(automatic.signal.aborted,true,'a suspension that arrives after automatic foreground admission must pre-empt it');
  let settled=false;paused.settled.then(()=>{settled=true;});await Promise.resolve();assert.equal(settled,false,'suspension settlement waits for the automatic foreground handoff to release');
  automatic.release();await paused.settled;assert.equal(settled,true);bg.resume(paused);assert.equal(fake.pending().length,0);
}

{
  const fake=clock(),bg=coordinator(fake),automatic=bg.beginForeground({respectBackgroundSuspension:true});
  assert.ok(automatic,'automatic sync enters without an external hold');
  const internal=bg.suspend('sync',{preserveForegroundController:automatic.controller});
  await internal.settled;assert.equal(automatic.signal.aborted,false,'managed recovery must not cancel the automatic sync that initiated its own suspension');
  assert.equal(bg.status().held,true,'managed recovery still suspends other background work');
  assert.equal(await bg.beginBackground('convergence'),null,'no second automatic operation may enter during managed recovery');
  const external=bg.suspend('pwa-update');
  assert.equal(automatic.signal.aborted,true,'a separate PWA suspension must still cancel the retained automatic sync');
  let finished=false;external.settled.then(()=>{finished=true;});await Promise.resolve();
  assert.equal(finished,false,'external suspension waits until the cancelled automatic sync actually releases');
  automatic.release();await external.settled;assert.equal(finished,true);
  bg.resume(internal);bg.resume(external);
  const later=bg.beginForeground({respectBackgroundSuspension:true});assert.ok(later,'automatic sync can resume after all holds release');later.release();
  assert.deepEqual(fake.pending(),[]);
}

{
  const fake=clock(),bg=coordinator(fake);let fired=0;const convergence=await bg.beginBackground('convergence');assert.ok(convergence);
  bg.schedule('maintenance',1000,()=>{fired+=1;});await fake.advance(1500);assert.equal(fired,0,'lower-priority scheduled work must not fire while a higher-priority background job owns the target');
  convergence.release();await fake.advance(0);assert.equal(fired,1,'deferred scheduled work must re-arm when the higher-priority owner releases');
}

{
  const fake=clock(),bg=coordinator(fake);const low=await bg.beginBackground('integrity');assert.ok(low);
  const higherPromise=bg.beginBackground('maintenance');await Promise.resolve();assert.equal(low.signal.aborted,true,'higher-priority maintenance must pre-empt integrity');low.release();const higher=await higherPromise;assert.ok(higher);higher.release();
}

// Different contenders can await the same retiring executor. Admission must
// recheck all current owners, and an aborted executor remains active until release.
for(const pair of [['maintenance','convergence']]){
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
  const fake=clock(),bg=coordinator(fake);const running=await bg.beginBackground('convergence');assert.ok(running);let settled=false;
  const suspension=bg.suspend('managed-recovery');suspension.settled.then(()=>{settled=true;});await Promise.resolve();assert.equal(running.signal.aborted,true,'suspension must abort active background work');assert.equal(settled,false,'suspension settlement must wait until aborted background work actually releases');
  running.release();await suspension.settled;assert.equal(settled,true);assert.equal(bg.resume(suspension),true);assert.equal(bg.status().suspended,false);
}

{
  const fake=clock(),bg=coordinator(fake),low=await bg.beginBackground('maintenance'),foreground=bg.beginForeground();
  const failed=assert.rejects(foreground.settled,{code:'REPOSITORY_BACKGROUND_UNSETTLED'});await fake.advance(10000);await failed;
  assert.deepEqual([...bg.status().active],['maintenance'],'timeout must not pretend the old executor released');foreground.release();
  const higher=bg.beginBackground('convergence');await fake.advance(10000);assert.equal(await higher,null,'higher-priority work must not overlap an unsettled lower job');
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
  bg.clearScheduled('maintenance'); // Isolate explicit-request coalescing from initial durable discovery.
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

// A fresh recheck is not postponed by an older scan finishing. Cover both
// the executor and its durable state write, including a failed state write.
for(const stage of ['execute','write','failed-write']){
  const fake=clock(),bg=coordinator(fake);let entered=false,release,executes=0,writes=0;
  const gate=new Promise(resolve=>{release=resolve;});
  const scheduler=bg.createIntegrityScheduler(freeze({
    budgetMs:20000,budgetCode:'TEST_INTEGRITY_BUDGET',budgetMessage:'budget',preemptCode:'TEST_INTEGRITY_PREEMPTED',preemptMessage:'preempted',capture:()=>{},
    isAvailable:()=>true,isUnsafe:()=>false,readTarget:async()=>({completedAt:'',cycleStartedAt:'',cursor:''}),yieldTask:async()=>{},
    execute:async()=>{executes++;if(stage==='execute'&&executes===1){entered=true;await gate;}return {status:'completed',complete:true};},
    writeResult:async()=>{writes++;if(stage!=='execute'&&writes===1){entered=true;await gate;if(stage==='failed-write')throw new Error('simulated state write failure');}}
  }));
  const running=scheduler.run('old-scan');for(let n=0;n<100&&!entered;n++)await Promise.resolve();
  assert.equal(entered,true,stage+' reached its paused stage');
  scheduler.schedule(1000,'manual-recheck');
  release();const result=await running;
  assert.equal(result.status,stage==='failed-write'?'unavailable':'completed');
  assert.equal(fake.pending()[0],1000,'a new recheck must beat older '+stage+' recurrence or retry');
  await fake.advance(1000);for(let n=0;n<100;n++)await Promise.resolve();
  assert.equal(executes,2,'the newer request must execute after '+stage);
  assert.equal(writes,2,'each attempt must reach durable state write after '+stage);
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
// Eligibility loss cancels active work without claiming its native operations
// settled. Reconnection refreshes the same lifecycle, never a second executor.
{
 const clock=createFakeClock(),bg=coordinator(clock);let available=true,scope=null,resolveNative,attempts=0;
 const native=new Promise(resolve=>{resolveNative=resolve;});
 const job=bg.registerJob('maintenance',{isAvailable:()=>available,capture:()=>{},retryMs:1000,execute:async()=>{
  attempts++;scope=await bg.beginBackground('maintenance');try{if(attempts===1)await native;return {status:scope.signal.aborted?'yielded':'completed'};}finally{scope.release();}
 }});
 await clock.advance(1000);await clock.drainMicrotasks(80);assert.equal(attempts,1);available='awaiting-control';bg.wake('ownership');assert.equal(scope.signal.aborted,true);assert.equal(job.status().busy,true);assert.equal(bg.status().active.length,1);
 available=true;bg.wake('ownership');assert.equal(clock.pending(),0);assert.equal(attempts,1);resolveNative();await job.settled();assert.equal(bg.status().active.length,0);assert.equal(job.status().pending,true);
 await clock.advance(1000);await clock.drainMicrotasks(80);assert.equal(attempts,2);assert.equal(job.status().pending,false);assert.equal(clock.pending(),0);
}
// Discovery is a state predicate: known idle jobs stay idle, while unknown
// settings and dirty repositories are rediscovered after eligibility changes.
for(const blocked of [false,true]){
 const fake=createFakeClock(),bg=coordinator(fake);let dirty=false,available=blocked?'awaiting-control':true,attempts=0;
 const job=bg.registerJob('convergence',{initialDelayMs:null,discover:()=>dirty,isAvailable:()=>available,capture:()=>{},retryMs:1000,execute:async()=>{attempts++;dirty=false;return {status:'completed'};}});
 bg.wake('startup');assert.equal(job.status().pending,false);assert.equal(fake.pending(),0);
 dirty=true;bg.wake('permission');assert.equal(job.status().pending,true);
 if(blocked){assert.equal(fake.pending(),0);available=true;bg.wake('control');}
 await fake.advance(1000);await fake.drainMicrotasks(80);assert.equal(attempts,1);assert.equal(job.status().pending,false);
 bg.wake('unchanged');await fake.advance(1000);assert.equal(attempts,1);
 // Explicit pending intent must wake even when discovery already reports clean.
 job.schedule(1000,'retained');bg.wake('reconnect');await fake.advance(1000);await fake.drainMicrotasks(80);assert.equal(attempts,2);
}
{
 const fake=createFakeClock(),bg=coordinator(fake);let errors=0,attempts=0;
 bg.registerJob('convergence',{initialDelayMs:null,discover:()=>{throw new Error('state unavailable');},isAvailable:()=>true,capture:()=>{errors++;},execute:async()=>{attempts++;return {status:'completed'};}});
 bg.wake('startup');await fake.advance(1000);await fake.drainMicrotasks(80);assert.equal(errors,1);assert.equal(attempts,1,'uncertain discovery retains an execution opportunity');
}
// The elapsed allowance is enforced at an executor's durable checkpoint,
// never halfway through useful slow IO. Foreground cancellation remains immediate.
for(const elapsed of [19999,20000,20001,180000]){
 const fake=clock(),bg=coordinator(fake);let persisted=0,observed=null;
 const scheduler=bg.createIntegrityScheduler(freeze({budgetMs:20000,budgetCode:'TEST_BUDGET',budgetMessage:'budget',preemptCode:'TEST_PREEMPT',preemptMessage:'preempt',capture:()=>{},isAvailable:()=>true,isUnsafe:()=>false,readTarget:async()=>({}),writeResult:async()=>{},yieldTask:async()=>{},execute:async({signal,checkpoint})=>{
  await fake.advance(elapsed);assert.equal(signal.aborted,false,'elapsed time alone cannot discard a productive segment');persisted=1;checkpoint();return {status:'completed',complete:true};
 }}));
 observed=await scheduler.run();assert.equal(persisted,1);assert.equal(observed.reason,elapsed>=20000?'budget':undefined);assert.equal(observed.status,elapsed>=20000?'skipped':'completed');assert.equal(bg.status().active.length,0);
}
{
 const fake=clock(),bg=coordinator(fake);let savedOffset=0;
 const prior={scanId:'same',partial:{objectId:'object',stored:{offset:1024},plain:{offset:0,frame:0}}};
 const scheduler=bg.createIntegrityScheduler(freeze({budgetMs:20000,budgetCode:'TEST_BUDGET',budgetMessage:'budget',preemptCode:'TEST_PREEMPT',preemptMessage:'preempt',capture:()=>{},isAvailable:()=>true,isUnsafe:()=>false,readTarget:async()=>prior,writeResult:async()=>{},yieldTask:async()=>{},execute:async({checkpoint,signal})=>{
  await fake.advance(180000);checkpoint({...prior,partial:{...prior.partial,plain:{name:'new-scratch',offset:0,frame:0}}});assert.equal(signal.aborted,false,'scratch initialization cannot starve productive work after slow preparation');
  savedOffset=2048;checkpoint({...prior,partial:{...prior.partial,stored:{offset:savedOffset}}});assert.fail('a saved segment beyond the allowance must yield');
 }}));
 assert.equal((await scheduler.run()).reason,'budget');assert.equal(savedOffset,2048);
}
// A job that gives back its slot tells its listeners once it is no longer
// active, so a status drawn while it ran ("Maintaining backups…") is redrawn.
{
  const fake=clock(),bg=coordinator(fake),seen=[];
  const stop=bg.onRelease(job=>seen.push({job,active:[...bg.status().active]}));
  const scope=await bg.beginBackground('integrity');assert.deepEqual(seen,[],'acquiring a slot is not a release');
  assert.deepEqual([...bg.status().active],['integrity']);
  scope.release();scope.release();
  assert.deepEqual(seen,[{job:'integrity',active:[]}],'released once, after the job left the active list');
  stop();const again=await bg.beginBackground('maintenance');again.release();assert.equal(seen.length,1,'an unsubscribed listener is not told');
  assert.throws(()=>bg.onRelease(null),/listener is invalid/u);
}
// The browser timeout clock is monotonic, while repository deadlines use
// civil time. Simulate clock jumps without pretending setTimeout moves too.
function jumpingClock(start=Date.parse('2026-09-26T00:00:00.000Z')){
  let wall=start,elapsed=0,next=0;const timers=new Map();
  const setTimeout=(callback,delay)=>{const id=++next;timers.set(id,{callback,at:elapsed+Math.max(0,Number(delay)||0)});return id;};
  const clearTimeout=id=>timers.delete(id);
  const flush=async()=>{for(let n=0;n<30;n++)await Promise.resolve();};
  async function advance(ms){
    const end=elapsed+ms;
    for(;;){
      const due=[...timers.entries()].filter(([,entry])=>entry.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];
      if(!due)break;
      wall+=due[1].at-elapsed;elapsed=due[1].at;timers.delete(due[0]);due[1].callback();await flush();
    }
    wall+=end-elapsed;elapsed=end;await flush();
  }
  return freeze({now:()=>wall,setTimeout,clearTimeout,advance,shiftWall:delta=>{wall+=delta;},pending:()=>[...timers.values()].map(entry=>entry.at-elapsed).sort((a,b)=>a-b)});
}
{
  const fake=jumpingClock(),bg=coordinator(fake);let runs=0;
  bg.schedule('maintenance',1000,()=>{runs++;});
  fake.shiftWall(-800);
  await fake.advance(1000);
  assert.equal(runs,0,'backward clock jump must not execute before the absolute due date');
  assert.deepEqual(fake.pending(),[800],'callback is rearmed for remaining civil-time eligibility');
  await fake.advance(800);
  assert.equal(runs,1);assert.deepEqual(fake.pending(),[]);
}
{
  const fake=jumpingClock(),bg=coordinator(fake);let runs=0;
  bg.schedule('integrity',60000,()=>{runs++;});
  fake.shiftWall(65000);bg.wake('pageshow',false);await fake.advance(0);
  assert.equal(runs,1,'eligibility wake must recheck a past absolute deadline after a forward jump');
  assert.deepEqual(fake.pending(),[]);
}
{
  const fake=jumpingClock(),bg=coordinator(fake);let runs=0;
  bg.schedule('maintenance',1000,()=>{runs++;});
  const foreground=bg.beginForeground();fake.shiftWall(5000);bg.wake('suspended',false);
  await fake.advance(2000);assert.equal(runs,0,'foreground protection takes precedence over overdue clock deadline');
  foreground.release();await fake.advance(0);assert.equal(runs,1,'real foreground release resumes overdue work');
}
// A priority denial is not an error or a durable publication deferral.
// A job can retry after the actual competing slot clears, not 15s/10m later.
{
  const fake=clock(),bg=coordinator(fake),high=await bg.beginBackground('convergence');
  let stored=freeze({requestedAt:new Date(fake.now()).toISOString(),nextEligibleAt:new Date(fake.now()).toISOString(),reason:'repository-state'}),runs=0;
  const intent=bg.maintenanceIntent(freeze({scope:()=>'slot-test',capture:()=>{},read:async()=>stored,mark:async value=>{stored=freeze({...stored,...value});return true;},clear:async()=>{stored=null;return true;},selectRetention:()=>freeze({remove:freeze([])})}));
  const maintenance=bg.createMaintenanceScheduler(freeze({intent,budgetMs:1000,budgetCode:'TEST_BUDGET',budgetMessage:'budget',preemptCode:'TEST_PREEMPT',preemptMessage:'preempt',capture:()=>{},isAvailable:()=>true,isBusy:()=>false,execute:async()=>{runs++;return freeze({gcPending:false});},report:()=>{}}));
  const result=await maintenance.run('blocked-by-convergence');
  assert.equal(result.reason,'background-busy');assert.equal(runs,0);
  assert.equal(fake.pending()[0],module.maintenance.busyMs);
  high.release();
  assert.equal(fake.pending()[0],1000,'actual slot release shortens only the transient contention retry');
  await fake.advance(1000);for(let n=0;n<80;n++)await Promise.resolve();
  assert.equal(runs,1);assert.equal(stored,null);
  assert.equal(fake.pending().length,0,'no repeated busy spin after job completes');
}
{
  const fake=clock(),bg=coordinator(fake),higher=await bg.beginBackground('maintenance');let runs=0;
  const integrity=bg.createIntegrityScheduler(freeze({budgetMs:1000,budgetCode:'TEST_BUDGET',budgetMessage:'budget',preemptCode:'TEST_PREEMPT',preemptMessage:'preempt',capture:()=>{},isAvailable:()=>true,isUnsafe:()=>false,readTarget:async()=>({}),writeResult:async()=>{},yieldTask:async()=>{},execute:async()=>{runs++;return freeze({status:'completed',complete:true});}}));
  const result=await integrity.run('blocked-by-maintenance');
  assert.equal(result.reason,'busy');assert.equal(runs,0);assert.equal(fake.pending()[0],module.integrity.retryMs);
  higher.release();assert.equal(fake.pending()[0],1000,'release does not retain the 10-minute missed-slot penalty');
  await fake.advance(1000);for(let n=0;n<80;n++)await Promise.resolve();
  assert.equal(runs,1);assert.equal(fake.pending()[0],module.integrity.intervalMs);
}
{
  const fake=clock(),bg=coordinator(fake);let stored=freeze({requestedAt:new Date(fake.now()).toISOString(),nextEligibleAt:new Date(fake.now()+module.maintenance.contentionMs).toISOString(),reason:'publication-contention'}),runs=0;
  const intent=bg.maintenanceIntent(freeze({scope:()=>'retained-deadline',capture:()=>{},read:async()=>stored,mark:async()=>{assert.fail('deferred pending intent must not be rewritten');},clear:async()=>{stored=null;return true;},selectRetention:()=>freeze({remove:freeze([])})}));
  const maintenance=bg.createMaintenanceScheduler(freeze({intent,budgetMs:1000,budgetCode:'TEST_BUDGET',budgetMessage:'budget',preemptCode:'TEST_PREEMPT',preemptMessage:'preempt',capture:()=>{},isAvailable:()=>true,isBusy:()=>false,execute:async()=>{runs++;return freeze({gcPending:false});},report:()=>{}}));
  const held=await bg.beginBackground('convergence');
  const result=await maintenance.run('durable-defer');
  assert.equal(result.reason,'publication-contention');
  held.release();assert.equal(fake.pending()[0],module.maintenance.contentionMs,'durable publication backoff is never pulled forward by unrelated releases');
  await fake.advance(1000);assert.equal(runs,0);
}
// Provider hook reconfiguration unregisters and re-registers a job on the
// same coordinator; an obsolete slot-release callback must not survive it.
{
  const fake=clock(),bg=coordinator(fake),high=await bg.beginBackground('convergence'),notifications=[];
  const unsubscribe=bg.onRelease(job=>notifications.push(job));
  let stored=freeze({requestedAt:new Date(fake.now()).toISOString(),nextEligibleAt:new Date(fake.now()).toISOString(),reason:'repository-state'}),executions=0;
  const intent=bg.maintenanceIntent(freeze({scope:()=>'reconfiguration',capture:()=>{},read:async()=>stored,mark:async value=>{stored=freeze({...stored,...value});return true;},clear:async()=>{stored=null;return true;},selectRetention:()=>freeze({remove:freeze([])})}));
  const create=()=>bg.createMaintenanceScheduler(freeze({intent,budgetMs:1000,budgetCode:'TEST_BUDGET',budgetMessage:'budget',preemptCode:'TEST_PREEMPT',preemptMessage:'preempt',capture:()=>{},isAvailable:()=>true,isBusy:()=>false,execute:async()=>{executions++;return freeze({gcPending:false});},report:()=>{}}));
  const old=create();assert.equal((await old.run('waiting')).reason,'background-busy');
  assert.equal(fake.pending()[0],module.maintenance.busyMs);
  assert.equal(bg.unregisterJob('maintenance'),true);
  assert.deepEqual(fake.pending(),[],'unregistering retires the former deadline and listener');
  high.release();
  assert.deepEqual(fake.pending(),[],'the old listener cannot reschedule disposed work');
  assert.deepEqual(notifications,['convergence'],'other release subscribers retain their notifications');
  const fresh=create();assert.ok(fresh);
  await fake.advance(1000);for(let n=0;n<80;n++)await Promise.resolve();
  assert.equal(executions,1,'a newly registered scheduler runs once');
  assert.equal(stored,null);
  unsubscribe();
}
console.log(JSON.stringify({status:'PASS',suite:'repository-background',sharedPolicy:true,priority:true,foregroundPreemption:true,suspensionSettlement:true,durableIntent:true,maintenanceLifecycle:true,triggerAttribution:true,integrityRecurrence:true,integrityStateFailureRetry:true},null,2));
