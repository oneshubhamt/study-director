import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createFakeClock} from '../../helpers/fake-clock.mjs';
for(const file of ['internal','operation-lifecycle'])vm.runInThisContext(fs.readFileSync(`source/core/${file}.js`,'utf8'),{filename:`source/core/${file}.js`});
const lifecycle=globalThis[Symbol.for('studyDirector.internalModules.v1')].require('operation-lifecycle',1);
const cases=[];
const timers=new Map();let sequence=0;
const clock={setTimeout:(fn,ms)=>{const id=++sequence;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id)};
const task=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=()=>{for(const [id,row] of [...timers]){timers.delete(id);row.fn();}};
{
  const a=task(),b=task(),wait=lifecycle.waitForSettlement([a.promise,b.promise],clock);let finished=false;wait.then(()=>{finished=true;});
  a.resolve('one');await Promise.resolve();assert.equal(finished,false);b.resolve('two');assert.deepEqual(await wait,['one','two']);assert.equal(timers.size,0);
  cases.push('all real operations must release before the barrier opens');
}
{
  const native=task(),wait=lifecycle.waitForSettlement([native.promise],{...clock,timeoutCode:'LOCK_STILL_HELD'}),failed=assert.rejects(wait,{code:'LOCK_STILL_HELD'});tick();await failed;
  assert.equal(timers.size,0);native.resolve('released');assert.deepEqual(await lifecycle.waitForSettlement([native.promise],clock),['released']);
  cases.push('deadline bounds the wait while the native operation can settle later');
}
{
  const controller=new AbortController(),native=task(),wait=lifecycle.waitForSettlement([native.promise],{...clock,signal:controller.signal}),failed=assert.rejects(wait,{name:'AbortError'});
  controller.abort();await failed;assert.equal(timers.size,0);native.reject(new Error('late failure'));await Promise.resolve();
  controller.abort();await assert.rejects(lifecycle.waitForSettlement([],{...clock,signal:controller.signal}),{name:'AbortError'});assert.equal(timers.size,0);
  cases.push('cancellation works with and without active work and observes late rejections');
}
{
  let cancel,subscriptions=0;const native=task(),wait=lifecycle.waitForSettlement([native.promise],{...clock,subscribeCancel:fn=>{cancel=fn;subscriptions++;return ()=>subscriptions--;}}),failed=assert.rejects(wait,{code:'OPERATION_CANCELLED'});
  cancel();await failed;assert.equal(subscriptions,0);assert.equal(timers.size,0);native.resolve();
  await assert.rejects(lifecycle.waitForSettlement([Promise.reject(new Error('IO'))],clock),/IO/u);
  assert.deepEqual(await lifecycle.waitForSettlement([Promise.reject(new Error('retired'))],{...clock,ignoreFailures:true}),[null]);assert.equal(timers.size,0);
  cases.push('global cancellation cleans up; failure propagation is an explicit caller choice');
}
{
  for(const [details,expected] of [
    [{status:'clean'},'completed'],[{status:'completed',complete:false},'yielded'],[{status:'pending',reason:'bounded-continuation'},'yielded'],[{status:'pending',reason:'delete-failure'},'failed'],[{status:'pending',reason:'gc-grace'},'deferred'],[{status:'unavailable'},'unavailable'],[{status:'unavailable',reason:'error'},'unavailable'],[{status:'skipped',reason:'permission'},'unavailable'],[{status:'skipped',reason:'not-primary'},'deferred'],[{cancelled:true},'cancelled'],[{status:'interrupted'},'interrupted']
  ])assert.equal(lifecycle.outcome(details),expected,JSON.stringify(details));
  assert.equal(lifecycle.snapshot({busy:true,suspended:true}).state,'running');assert.equal(lifecycle.snapshot({pending:true,suspended:true}).state,'paused');assert.equal(lifecycle.snapshot({pending:true,scheduled:true}).state,'scheduled');assert.equal(lifecycle.snapshot({pending:true}).state,'pending');assert.equal(lifecycle.snapshot().state,'idle');
  const state=lifecycle.snapshot({lastResult:{status:'completed',complete:false},nextEligibleAt:'bad'});assert.equal(state.lastOutcome,'yielded');assert.equal(state.nextEligibleAt,'');assert.ok(Object.isFrozen(state));
  cases.push('current ownership and attempt outcomes have separate stable vocabularies');
}
// Lifecycle conservation and liveness: vary blocker order, failure count and
// bounded workload size. There is one opportunity, never two active attempts.
for(const units of [1,2,7,19])for(const failures of [0,1,3])for(const blocker of ['awaiting-control','awaiting-connection','locked']){
  const clock=createFakeClock(),errors=[];let available=blocker,remaining=units,failuresLeft=failures,active=0,maxActive=0,executions=0;
  const job=lifecycle.createJob({environment:clock,isAvailable:()=>available,capture:error=>errors.push(error),retryMs:30,
    execute:async()=>{executions++;maxActive=Math.max(maxActive,++active);try{if(failuresLeft-->0)throw new Error('unavailable');remaining--;return {status:remaining?'yielded':'completed',complete:remaining===0};}finally{active--;}}
  });
  job.schedule(10,'dirty');job.schedule(100,'later');await clock.advance(10000);
  assert.equal(executions,0);assert.equal(clock.pending(),0);assert.equal(job.status().pending,true);assert.equal(job.status().blocker,blocker);
  available=true;job.wake('restored');job.wake('restored');assert.equal(clock.pending(),1);
  for(let attempt=0;attempt<units+failures+1&&job.status().pending;attempt++){await clock.advance(30);await clock.drainMicrotasks(20);}
  assert.equal(remaining,0);assert.equal(maxActive,1);assert.equal(errors.length,failures);assert.equal(executions,units+failures);assert.equal(job.status().pending,false);assert.equal(clock.pending(),0);
}
cases.push('finite work completes across all blocker orders and repeated failures with one executor and one timer');
{
  const clock=createFakeClock(),gate=task();let available=true,calls=0;
  const job=lifecycle.createJob({environment:clock,isAvailable:()=>available,capture:()=>{},execute:async()=>{if(++calls===1)await gate.promise;return {status:'completed'};}});
  job.schedule(100,'quiet');await clock.advance(40);available='foreground';job.wake('foreground');assert.equal(clock.pending(),0);
  await clock.advance(30);available=true;job.wake('release');assert.equal(Date.parse(job.status().nextEligibleAt)-clock.now(),30,'foreground preserves the quiet deadline');
  await clock.advance(30);const first=job.settled();assert.equal(job.status().busy,true);assert.equal(job.run(),first);
  job.schedule(200,'newer-request');gate.resolve();await first;assert.equal(job.status().pending,true);assert.equal(clock.pending(),1,'older completion cannot erase a newer request');
  await clock.advance(200);await clock.drainMicrotasks(20);assert.equal(calls,2);assert.equal(job.status().pending,false);assert.equal(clock.pending(),0);
  job.schedule(10);job.dispose();job.wake('retired',true);await clock.advance(100);assert.equal(calls,2);assert.equal(clock.pending(),0);
  cases.push('foreground preserves deadlines; late requests survive completion; retirement cannot re-arm work');
}
{
  const clock=createFakeClock(),errors=[];let available=false,executions=0;
  const job=lifecycle.createJob({environment:clock,isAvailable:()=>available,capture:error=>errors.push(error),retryMs:100,execute:async()=>{executions++;return {ok:true};}});
  job.schedule(1);await clock.advance(1000);assert.equal(executions,0);assert.equal(clock.pending(),1,'unknown availability must retain bounded recovery');
  available=true;await clock.advance(100);await clock.drainMicrotasks(20);assert.equal(job.status().lastOutcome,'unavailable');assert.equal(job.status().pending,true,'an implicit success cannot retire work');assert.equal(errors.length,1);
  job.dispose();
  const group=lifecycle.createGroup((id,error)=>errors.push([id,error]));let wakes=0;
  group.register('broken',{wake(){throw new Error('configuration');}});group.register('healthy',{wake(){wakes++;}});
  group.wake('connection');assert.equal(wakes,1);assert.equal(errors.length,2);assert.throws(()=>group.register('healthy',{wake(){}}),TypeError);
  cases.push('unknown availability and unverified completion retry; one owner failure cannot suppress another wake-up');
}
console.log(JSON.stringify({status:'PASS',suite:'operation-lifecycle',cases},null,2));
