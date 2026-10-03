import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {createFakeClock} from '../../helpers/fake-clock.mjs';
for(const name of ['internal','operation-lifecycle','exports'])vm.runInThisContext(fs.readFileSync(`source/core/${name}.js`,'utf8'));
const module=globalThis[Symbol.for('studyDirector.internalModules.v1')].require('exports',1,Object.freeze({lifecycle:globalThis[Symbol.for('studyDirector.internalModules.v1')].require('operation-lifecycle',1)}));
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sd-file-lifetimes-')),readers=new Map(),retained=new Set();let failRetentionScan=false;
const locks={async request(name,options,callback){if(options.mode==='shared'){readers.set(name,(readers.get(name)||0)+1);try{return await callback({name});}finally{readers.set(name,readers.get(name)-1)}}return callback(readers.get(name)?null:{name});}};
const directory={async getFileHandle(name,{create=false}={}){const filename=path.join(root,name);if(create)fs.writeFileSync(filename,'');return {write:bytes=>fs.writeFileSync(filename,bytes),getFile:()=>fs.openAsBlob(filename)};},async *entries(){for(const name of fs.readdirSync(root))yield[name,{kind:'file'}]},async removeEntry(name){fs.unlinkSync(path.join(root,name))}};
const storage={getDirectory:async()=>({getDirectoryHandle:async()=>directory})};
const clock=createFakeClock(),errors=[];
const store=module.createFileStore({storage,locks,now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,onError:error=>errors.push(error),retained:async()=>{if(failRetentionScan)throw new Error('retention scan failed');return [...retained];}});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
try{
 const stage=await store.stage();stage.handle.write('saved bytes');const original=store.bind(await stage.handle.getFile(),stage.name),ref={name:stage.name,size:11,hash:createHash('sha256').update('saved bytes').digest('hex')};
 const one=await store.read(ref),two=await store.read(ref);
 await store.release(original);await store.release(one);await store.release(one);await tick();await store.collect();assert.equal(await two.text(),'saved bytes','releasing producer/another reader must not reclaim the surviving reader');
 await store.release(two);await tick();await store.collect();assert.equal(fs.existsSync(path.join(root,ref.name)),false,'last reader permits reclamation');
 const durable=await store.stage();durable.handle.write('journal');const blob=store.bind(await durable.handle.getFile(),durable.name);retained.add(durable.name);await store.release(blob);await tick();await store.collect();assert.ok(fs.existsSync(path.join(root,durable.name)),'durable IDB reference protects bytes after tab leases disappear');retained.clear();await store.collect();assert.equal(fs.existsSync(path.join(root,durable.name)),false);
 const pinned=await store.stage();pinned.handle.write('download');const pinnedBlob=store.bind(await pinned.handle.getFile(),pinned.name),unpin=store.pin(pinnedBlob);await store.release(pinnedBlob);await store.collect();assert.equal(fs.existsSync(path.join(root,pinned.name)),true,'a browser-download pin must defer scratch reclamation after the caller releases its blob');unpin();await tick();await tick();await store.collect();assert.equal(fs.existsSync(path.join(root,pinned.name)),false,'unpinning a released browser download must complete deferred release and allow reclamation');
 const gcStage=await store.stage();gcStage.handle.write('gc');const gcBlob=store.bind(await gcStage.handle.getFile(),gcStage.name);failRetentionScan=true;await assert.doesNotReject(store.release(gcBlob),'opportunistic post-release GC must not turn an otherwise successful file operation into failure');assert.equal((await store.collect()).status,'unavailable');assert.match(errors.at(-1).message,/retention scan failed/);assert.equal(store.status().pending,true,'failed collection retains its lifecycle and diagnostic outcome');assert.equal(fs.existsSync(path.join(root,gcStage.name)),true);failRetentionScan=false;await store.collect();assert.equal(fs.existsSync(path.join(root,gcStage.name)),false,'a later successful explicit collector must reclaim the orphan left by a failed opportunistic collection');
 await assert.rejects(store.read({name:'../escape',size:1,hash:'a'.repeat(64)}),/invalid/i);
 console.log(JSON.stringify({status:'PASS',suite:'file-lifetimes',independentReaders:true,idempotentRelease:true,durableRetention:true,unreferencedCleanup:true,deferredPinnedRelease:true,bestEffortAutomaticGc:true,explicitGcStillDiagnostic:true,unsafeNamesRejected:true}));
}finally{fs.rmSync(root,{recursive:true,force:true})}
