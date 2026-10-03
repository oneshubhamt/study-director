import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
function fixture(){
  const files=new Map(),keep=new Set(),timers=new Map(),locksHeld=new Set(),errors=[];let sequence=0,stamp=0,fail=false;
  const name=i=>'backup-'+String(i).padStart(8,'0')+'-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const dir={async *entries(){for(const key of files.keys())yield [key,{kind:'file'}];},getFileHandle:async(key,{create}={})=>{if(create)files.set(key,new Blob(['x']));return {getFile:async()=>files.get(key)};},removeEntry:async key=>{files.delete(key);}};
  const locks={request:async(key,options,work)=>{if(options.ifAvailable&&locksHeld.has(key))return work(null);return work({key});}};
  const context={Blob,TextEncoder,AbortController,crypto:webcrypto,setTimeout:(fn,ms)=>{timers.set(++sequence,{fn,ms});return sequence;},clearTimeout:id=>timers.delete(id)};vm.createContext(context);for(const file of ['internal','operation-lifecycle','exports'])vm.runInContext(fs.readFileSync(`source/core/${file}.js`,'utf8'),context,{filename:`source/core/${file}.js`});
  const api=context[Symbol.for('studyDirector.internalModules.v1')].require('exports',1,Object.freeze({lifecycle:context[Symbol.for('studyDirector.internalModules.v1')].require('operation-lifecycle',1)})).createFileStore({storage:{getDirectory:async()=>({getDirectoryHandle:async()=>dir})},locks,retained:async()=>{if(fail)throw new Error('journal unavailable');return [...keep];},maxEntries:3,now:()=>stamp,onError:error=>errors.push(error)});
  return {files,keep,timers,locksHeld,errors,api,name,fail:value=>fail=value,advance:ms=>stamp+=ms};
}
const cases=[];
{
  const h=fixture();for(let i=1;i<=10;i++)h.files.set(h.name(i),new Blob(['x']));h.keep.add(h.name(1));const staged=await h.api.stage();let passes=0;for(let i=0;i<20;i++){const r=await h.api.collect();assert.ok(r.visited<=3);passes++;if(r.status==='completed')break;}assert.ok(passes>1);assert.ok(h.files.has(h.name(1)));assert.ok(h.files.has(staged.name));assert.equal(h.files.size,2);await h.api.release(staged.name);assert.ok(h.files.has(staged.name),'release must not await a whole-directory sweep');assert.equal(h.api.status().scheduled,true);await h.api.collect();assert.equal(h.files.has(staged.name),false);cases.push('bounded passes resume while journal and producer leases preserve bytes');
}
{
  const h=fixture();h.files.set(h.name(1),new Blob(['x']));h.fail(true);assert.equal((await h.api.collect()).status,'unavailable');assert.match(h.errors[0].message,/journal unavailable/);assert.equal(h.api.status().pending,true);assert.equal(h.files.size,1);assert.equal([...h.timers.values()][0].ms,1800000);h.fail(false);assert.equal((await h.api.collect()).status,'completed');assert.equal(h.files.size,0);assert.equal(h.timers.size,0);cases.push('unknown retained metadata fails closed and retry recovers');
}
{
  const h=fixture();h.files.set(h.name(1),new Blob(['x']));const resume=h.api.suspend();assert.equal((await h.api.collect()).status,'deferred');assert.equal(h.api.status().pending,true);assert.equal(h.api.status().blocker,'foreground-busy');assert.equal(h.files.size,1);assert.equal(h.api.status().busy,false);resume();assert.equal(h.api.status().scheduled,true);await h.api.collect();assert.equal(h.files.size,0);cases.push('foreground suspension retains intent and resumes later');
}
{
  const h=fixture();for(let i=1;i<=5;i++)h.files.set(h.name(i),new Blob(['x']));h.locksHeld.add('@@SD_BACKUP_FILES_OPFS_DIRECTORY@@:'+h.name(1));let r;for(let i=0;i<5;i++){r=await h.api.collect();if(r.reason==='reader-locked')break;}assert.equal(r.reason,'reader-locked');assert.ok(h.files.has(h.name(1)));assert.equal([...h.timers.values()][0].ms,300000);h.locksHeld.clear();await h.api.collect();assert.equal(h.files.size,0);cases.push('external reader lock survives batches and retains a retry');
}
console.log(JSON.stringify({status:'PASS',suite:'scratch-gc',cases},null,2));
