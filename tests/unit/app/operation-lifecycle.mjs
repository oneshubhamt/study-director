import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
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
console.log(JSON.stringify({status:'PASS',suite:'operation-lifecycle',cases},null,2));
