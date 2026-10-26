import {readCoreScript,coreScriptPath} from '../../helpers/core-script.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function clock(){let now=0,next=0;const timers=new Map();return {timers,setTimeout(fn,ms){const id=++next;timers.set(id,{fn,at:now+ms});return id;},clearTimeout(id){timers.delete(id);},tick(ms){now+=ms;for(const [id,t] of [...timers])if(t.at<=now){timers.delete(id);t.fn();}}};}
function fixture(kind='attachment-ingest'){
  const time=clock(),workers=[],context={console,Blob,TextEncoder,AbortController,DOMException,setTimeout:time.setTimeout,clearTimeout:time.clearTimeout};vm.createContext(context);
  for(const name of ['internal','operation-lifecycle',kind])vm.runInContext(readCoreScript(name),context,{filename:coreScriptPath(name)});
  let failStart=false,abandoned=0;const createWorker=()=>{if(failStart)throw new Error('startup');const worker={messages:[],terminated:0,postMessage(value){this.messages.push(value);if(this.throwPost)throw new Error('clone');},terminate(){this.terminated++;if(this.throwTerminate)throw new Error('terminate');}};workers.push(worker);return worker;};
  const mod=context[Symbol.for('studyDirector.internalModules.v1')].require(kind,1,Object.freeze({lifecycle:context[Symbol.for('studyDirector.internalModules.v1')].require('operation-lifecycle',1)})),api=kind==='attachment-ingest'?mod.create({createWorker,directory:'study-director-assets-v2',randomUUID:()=> 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',setTimeout:time.setTimeout,clearTimeout:time.clearTimeout,stallTimeoutMs:100,cancelTimeoutMs:10,onAbandoned:()=>abandoned++}):mod.createCoordinator({createWorker,window:{},document:{}});
  return {api,time,workers,get abandoned(){return abandoned;},failStart:()=>{failStart=true;}};
}
const cases=[];
{
  const h=fixture(),a=h.api.verify('source','hash',1),b=h.api.remove('source');const results=Promise.allSettled([a,b]);assert.equal(h.api.status().busy,true);h.time.tick(100);assert.ok((await results).every(r=>r.status==='rejected'&&r.reason.code==='ATTACHMENT_WORKER_TIMEOUT'));assert.equal(h.api.status().busy,false);assert.equal(h.time.timers.size,0);assert.equal(h.workers[0].terminated,1);cases.push('stall rejects every request and clears timers');
}
{
  const h=fixture(),controller=new AbortController(),result=h.api.ingest(new Blob(['data']),{signal:controller.signal});const rejection=assert.rejects(result,{name:'AbortError'});await flush();const old=h.workers[0],lateMessage=old.onmessage,lateError=old.onerror,id=old.messages[0].id;
  old.onmessage({data:{id,progress:{loaded:1,total:4}}});h.time.tick(95);assert.equal(h.api.status().busy,true);controller.abort();assert.equal(old.messages.at(-1).type,'cancel');h.time.tick(9);old.onmessage({data:{id,progress:{loaded:4,total:4}}});h.time.tick(1);await rejection;assert.equal(h.api.status().busy,false);assert.equal(h.abandoned,1);assert.equal(h.time.timers.size,0);
  const retry=h.api.remove('new');const current=h.workers[1],newId=current.messages[0].id;lateMessage({data:{id:newId,value:'stale'}});lateError({});assert.equal(h.api.status().busy,true);current.onmessage({data:{id:newId,value:true}});assert.equal(await retry,true);assert.equal(current.terminated,0);h.api.destroy();cases.push('cancel deadline ignores progress and retired worker callbacks; retry works');
}
{
  const h=fixture(),controller=new AbortController(),result=h.api.ingest(new Blob(['x']),{signal:controller.signal});const rejection=assert.rejects(result,{name:'AbortError'});await flush();controller.abort();const worker=h.workers[0];worker.onmessage({data:{id:worker.messages[0].id,value:{storageName:'late'}}});await rejection;assert.equal(h.abandoned,1);assert.equal(h.time.timers.size,1,'only the idle release remains');h.api.destroy();assert.equal(h.time.timers.size,0);cases.push('late success cannot commit a cancelled ingest');
}
for(const mode of ['messageerror','error','throwTerminate']){
  const h=fixture(),result=h.api.remove('x'),rejection=assert.rejects(result);h.workers[0].throwTerminate=mode==='throwTerminate';if(mode==='messageerror')h.workers[0].onmessageerror({});else if(mode==='error')h.workers[0].onerror({});else h.api.destroy();await rejection;assert.equal(h.api.status().busy,false);assert.equal(h.time.timers.size,0);
}
cases.push('error, unreadable response and throwing teardown still settle');
{
  const h=fixture();h.failStart();await assert.rejects(h.api.remove('x'),/startup/);assert.equal(h.api.status().busy,false);assert.equal(h.time.timers.size,0);const c=new AbortController();c.abort();await assert.rejects(h.api.verify('x','hash',1,{signal:c.signal}),{name:'AbortError'});assert.equal(h.workers.length,0);cases.push('startup and pre-cancel clean up');
}
{
  const h=fixture('exports'),c=new AbortController(),result=h.api.run('checksum',{value:new Blob(['x'])},{signal:c.signal});const rejection=assert.rejects(result,{name:'AbortError'});await flush();const old=h.workers[0],late=old.onerror;c.abort();await rejection;const retry=h.api.run('checksum',{value:'x'});await flush();late({});assert.equal(h.api.status().busy,true);const current=h.workers[1];current.onmessage({data:{id:current.messages[0].id,value:'ok'}});assert.equal(await retry,'ok');assert.equal(h.api.status().busy,false);assert.equal(h.time.timers.size,0);cases.push('export retired errors cannot terminate a replacement');
}
{
  const h=fixture(),context={console,Blob,setTimeout:h.time.setTimeout,clearTimeout:h.time.clearTimeout};vm.createContext(context);for(const file of ['internal','operation-lifecycle','attachment-ingest'])vm.runInContext(readCoreScript(file),context);
  const api=context[Symbol.for('studyDirector.internalModules.v1')].require('attachment-ingest',1).create({directory:'study-director-assets-v2',createWorker:()=>{throw new Error('must not start');},storage:{estimate:()=>new Promise(()=>{})}});
  const c=new AbortController(),result=api.ingest(new Blob(['x']),{signal:c.signal}),rejection=assert.rejects(result,{name:'AbortError'});c.abort();await rejection;assert.equal(h.time.timers.size,0);
  const preflight=api.preflight(1);h.time.tick(5000);assert.equal((await preflight).checked,false);assert.equal(h.time.timers.size,0);cases.push('quota preflight timeout and cancel settle before worker dispatch');
}
{
  const h=fixture('exports'),context={Blob,TextEncoder,AbortController,setTimeout:h.time.setTimeout,clearTimeout:h.time.clearTimeout};vm.createContext(context);for(const file of ['internal','operation-lifecycle','exports'])vm.runInContext(readCoreScript(file),context);
  let resumed=0,called=false;const api=context[Symbol.for('studyDirector.internalModules.v1')].require('exports',1,Object.freeze({lifecycle:context[Symbol.for('studyDirector.internalModules.v1')].require('operation-lifecycle',1)})).createCoordinator({createWorker:()=>{throw new Error('must not dispatch');},window:{},document:{},files:{status:()=>({busy:true}),settled:()=>new Promise(()=>{}),suspend:()=>()=>resumed++}});
  const picker=api.job(async()=>{called=true;});assert.equal(called,true,'a scratch hold must preserve synchronous picker activation');await picker;
  const result=api.run('checksum',{value:'x'}),rejected=assert.rejects(result,{code:'BACKUP_GC_UNSETTLED'});await flush();h.time.tick(10000);await rejected;assert.equal(api.status().busy,false);assert.equal(h.time.timers.size,0);assert.ok(resumed>=2);cases.push('scratch settlement deadline rejects safely and preserves picker activation');
}
// An idle attachment worker is let go after two quiet minutes; a new request
// keeps it, and the next one after it went starts a fresh worker.
{
  const h=fixture(),reply=(worker,value=true)=>worker.onmessage({data:{id:worker.messages.at(-1).id,value}});
  const first=h.api.remove('a'),worker=h.workers[0];reply(worker);assert.equal(await first,true);
  h.time.tick(119999);assert.equal(worker.terminated,0,'a quiet worker stays for two minutes');
  const second=h.api.remove('b');h.time.tick(10);reply(worker);assert.equal(await second,true);
  h.time.tick(119999);assert.equal(worker.terminated,0,'each request restarts the quiet period');
  h.time.tick(1);assert.equal(worker.terminated,1,'the worker is let go once quiet');assert.equal(h.time.timers.size,0);
  const third=h.api.remove('c');assert.equal(h.workers.length,2,'the next request starts a fresh worker');reply(h.workers[1]);assert.equal(await third,true);
  cases.push('an idle attachment worker is released after two quiet minutes');
}
console.log(JSON.stringify({status:'PASS',suite:'worker-client-lifetime',cases},null,2));
