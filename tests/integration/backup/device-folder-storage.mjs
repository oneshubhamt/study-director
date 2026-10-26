import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {createMemoryDirectory} from '../../helpers/memory-directory.mjs';

for(const name of ['internal','device-folder-storage'])vm.runInThisContext(fs.readFileSync(`source/core/${name}.js`,'utf8'),{filename:name+'.js'});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')],freeze=Object.freeze;
const sha256=async blob=>Buffer.from(await webcrypto.subtle.digest('SHA-256',await blob.arrayBuffer())).toString('hex');
let now=Date.parse('2026-10-06T08:00:00.000Z'),folder=null,canMutate=true;
const faults={corruptReadOf:new Set()},identities=freeze({root:'Study Director - QA - Test Device',prefix:'Study Director',objects:'objects',checkpoints:'checkpoints',commits:'commits'});
const manifestFor=id=>freeze({checkpoint:freeze({checkpointId:id}),logicalFingerprint:'a'.repeat(64),exportedAt:new Date(now).toISOString(),counts:freeze({dailyRecord:3,note:2}),encrypted:false,retention:freeze({role:'normal',protectedUntil:'',purpose:'',calendar:freeze({localDate:'2026-10-06',weekStart:'2026-10-05',month:'2026-10',utcOffsetMinutes:0})})});
const storage=registry.require('device-folder-storage',1).createStorage(freeze({
  folder:()=>folder,identities,owner:()=>({profile:'prof_qa_mve00000_abcdef01',scope:'',device:'inst_qa_test_mve00000_abcdef01'}),
  checksum:async blob=>sha256(blob),
  inspectManifest:async file=>{const value=JSON.parse(await file.text());if(value.locked)throw Object.assign(new Error('locked'),{code:'BACKUP_LOCKED'});return manifestFor(value.id);},
  environment:freeze({canMutate:()=>canMutate,now:()=>now,setTimeout,clearTimeout,yieldTask:async()=>{}}),
  limits:freeze({publicationMaxAgeMs:24*3600000,publicationAssertionMarginMs:30*60000,maintenanceMaxAgeMs:60000,maintenanceAssertionMarginMs:30000,responseTimeoutMs:10000})
}));
folder=createMemoryDirectory({now:()=>now,faults});
const id=n=>'cp_'+String(n).padStart(32,'0'),objectId=n=>'obj_'+String(n).padStart(32,'0');
const upload=async(kind,fileId,text)=>{const blob=new Blob([text]);return storage.upload(freeze({kind,id:fileId,name:'',blob,size:blob.size,digest:await sha256(blob)}));};

// Files land in the same folders as before and read back verified.
const object=await upload('object',objectId(1),'object bytes'),manifest=await upload('checkpoint',id(1),JSON.stringify({id:id(1)})),commit=await upload('commit',id(1),'commit bytes');
const root=await folder.getDirectoryHandle(identities.root);
assert.deepEqual(root.names(),['checkpoints','commits','objects','repository.sdscope']);
assert.deepEqual((await root.getDirectoryHandle('objects')).names(),[objectId(1)+'.sdobject']);
assert.equal(object.kind,'object');assert.equal(object.size,12);assert.equal(manifest.digest,await sha256(new Blob([JSON.stringify({id:id(1)})])));assert.equal(commit.kind,'commit');
assert.equal(await (await storage.download(object)).text(),'object bytes');

// A version's listing carries its summary from the manifest, so history needs no other reads.
const listed=(await storage.list({kind:'checkpoint'})).items;
assert.equal(listed.length,1);assert.equal(listed[0].history.counts.dailyRecord,3);assert.equal(listed[0].history.retention.calendar.month,'2026-10');
assert.match(listed[0].verificationScope,/^device-folder:1:[a-f0-9]{32}$/u);assert.equal((await storage.list({kind:'commit'})).items[0].verificationScope,listed[0].verificationScope,'one stable identity per folder');
assert.equal(await storage.scope(),listed[0].verificationScope);

// A write that stalls (a disconnected drive, a stuck sync client) fails within
// the timeout instead of hanging the backup.
{
  const stalled=createMemoryDirectory({now:()=>now,faults});
  const stallWrites=directory=>new Proxy(directory,{get:(target,key)=>key==='getFileHandle'?async(name,options)=>{const handle=await target.getFileHandle(name,options);return new Proxy(handle,{get:(file,prop)=>prop==='createWritable'?async()=>({write:()=>new Promise(()=>{}),close:async()=>{},abort:async()=>{}}):typeof file[prop]==='function'?file[prop].bind(file):file[prop]});}:key==='getDirectoryHandle'?async(name,options)=>stallWrites(await target.getDirectoryHandle(name,options)):typeof target[key]==='function'?target[key].bind(target):target[key]});
  const timers=[];const stalledStorage=registry.require('device-folder-storage',1).createStorage(freeze({
    folder:()=>stallWrites(stalled),identities,owner:()=>({profile:'prof_qa_mve00000_abcdef01',scope:'',device:'inst_qa_test_mve00000_abcdef01'}),checksum:async blob=>sha256(blob),inspectManifest:async()=>manifestFor(id(9)),
    environment:freeze({canMutate:()=>true,now:()=>now,setTimeout:(callback,ms)=>{timers.push(callback);return timers.length;},clearTimeout:()=>{},yieldTask:async()=>{}}),
    limits:freeze({publicationMaxAgeMs:24*3600000,publicationAssertionMarginMs:30*60000,maintenanceMaxAgeMs:60000,maintenanceAssertionMarginMs:30000,responseTimeoutMs:10000})
  }));
  const blob=new Blob(['never lands']),pending=stalledStorage.upload(freeze({kind:'object',id:objectId(9),name:'',blob,size:blob.size,digest:await sha256(blob)}));
  for(let i=0;i<20&&!timers.length;i++)await new Promise(resolve=>setImmediate(resolve));
  // Fire every pending timeout: only the stalled chunk write is still waiting.
  while(timers.length)timers.shift()();
  await assert.rejects(pending,error=>error.code==='DEVICE_FILESYSTEM_TIMEOUT'&&/did not respond within 10 seconds/u.test(error.message));
}

// A write that reads back wrong is removed and fails.
faults.corruptReadOf.add(objectId(2)+'.sdobject');
await assert.rejects(()=>upload('object',objectId(2),'second object'),/failed verification/u);
assert.deepEqual((await root.getDirectoryHandle('objects')).names(),[objectId(1)+'.sdobject'],'a bad write leaves nothing behind');

// Deletion refuses a file that changed since it was listed.
now+=1000;await upload('commit',id(1),'commit bytes again');
await assert.rejects(()=>storage.delete(commit),/changed before deletion/u);
assert.equal(await storage.delete((await storage.list({kind:'commit'})).items[0]),true);assert.equal(await storage.delete({kind:'commit',id:id(1)}),false);
await assert.rejects(()=>storage.download({kind:'commit',id:id(1)}),error=>error.code==='REPOSITORY_OBJECT_MISSING');

// Locks keep their existing file names and format, expire by age, and renew.
const publication=await storage.beginPublication();
assert.match(publication.name,/^pub_[a-f0-9]{32}\.sdpublication$/u);assert.equal((await storage.listPublications()).items.length,1);
assert.equal(await storage.assertPublication(publication),true);
now+=24*3600000;await assert.rejects(()=>storage.assertPublication(publication),/too old/u);
assert.equal(await storage.endPublication(publication),true);assert.equal((await storage.listPublications()).items.length,0);
const maintenance=await storage.beginMaintenance();now+=40000;
await assert.rejects(()=>storage.assertMaintenance(maintenance),/too old/u,'maintenance must renew before its window closes');
await storage.endMaintenance(maintenance);const renewed=await storage.beginMaintenance();now+=20000;await storage.renewMaintenance(renewed);now+=20000;
assert.equal(await storage.assertMaintenance(renewed),true,'renewal restarts the maintenance window');await storage.endMaintenance(renewed);

// A locked (encrypted) manifest still lists; it just has no summary until unlocked.
await upload('checkpoint',id(2),JSON.stringify({id:id(2),locked:true}));
const lockedListing=(await storage.list({kind:'checkpoint'})).items.find(item=>item.id===id(2));
assert.ok(lockedListing&&!lockedListing.history);

// Losing control mid-write fails the write; a folder that disappeared says so.
canMutate=false;await assert.rejects(()=>upload('object',objectId(3),'late object'),/Control changed/u);canMutate=true;
folder={getDirectoryHandle:async()=>{throw Object.assign(new Error('gone'),{name:'NotFoundError'});}};
await assert.rejects(()=>storage.list({kind:'checkpoint'}),error=>error.code==='DEVICE_FOLDER_MISSING');

console.log(JSON.stringify({status:'PASS',suite:'device-folder-storage',checks:['verified writes','listing summaries','folder identity','guarded deletion','locks','locked manifests','control loss','missing folder']},null,2));
