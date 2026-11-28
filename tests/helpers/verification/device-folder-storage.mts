import {readCoreScript} from '../core-script.mts';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {createMemoryDirectory} from '../memory-directory.mts';

for(const name of ['internal','device-folder-storage'])vm.runInThisContext(readCoreScript(name),{filename:name+'.js'});
import {method,registeredExports} from '../registered-exports.mts';
import {folderStoragePort} from '../device-folder-ports.mts';
import {field,errorMessage} from '../repository-safety-ports.mts';
import {required} from '../repository-note-ports.mts';
import {jsonObject,jsonString} from './read-verification.mts';
const module=registeredExports(globalThis,'device-folder-storage'),freeze=Object.freeze;
const createStorage=(input:unknown)=>folderStoragePort(method(module,'createStorage')(input));
type Kind='object'|'checkpoint'|'commit';
type Directory=Awaited<ReturnType<ReturnType<typeof createMemoryDirectory>['getDirectoryHandle']>>;
const sha256=async (blob:Blob)=>Buffer.from(await webcrypto.subtle.digest('SHA-256',await blob.arrayBuffer())).toString('hex');
let now=Date.parse('2026-10-06T08:00:00.000Z'),folder:Directory|{getDirectoryHandle:()=>Promise<never>}|null=null,canMutate=true;
const faults={corruptReadOf:new Set<string>()},identities=freeze({root:'Study Director - QA - Test Device',prefix:'Study Director',objects:'objects',checkpoints:'checkpoints',commits:'commits'});
const manifestFor=(id:string)=>freeze({checkpoint:freeze({checkpointId:id}),logicalFingerprint:'a'.repeat(64),exportedAt:new Date(now).toISOString(),counts:freeze({dailyRecord:3,note:2}),encrypted:false,retention:freeze({role:'normal',protectedUntil:'',purpose:'',calendar:freeze({localDate:'2026-10-06',weekStart:'2026-10-05',month:'2026-10',utcOffsetMinutes:0})}),assets:freeze([freeze({assetId:'asset-present',objectId:'obj_present'}),freeze({assetId:'asset-gone',missing:true})])});
const storageInput=freeze({
  folder:()=>folder,identities,owner:()=>({profile:'prof_qa_mve00000_abcdef01',scope:'',device:'inst_qa_test_mve00000_abcdef01'}),
  checksum:async (blob:Blob)=>sha256(blob),
  inspectManifest:async (file:Blob)=>{const raw:unknown=JSON.parse(await file.text()),value=jsonObject(raw);if(value['locked'])throw Object.assign(new Error('locked'),{code:'BACKUP_LOCKED'});return manifestFor(jsonString(value['id']));},
  environment:freeze({canMutate:()=>canMutate,now:()=>now,setTimeout,clearTimeout,yieldTask:async()=>{}}),
  limits:freeze({publicationMaxAgeMs:24*3600000,publicationAssertionMarginMs:30*60000,publicationRenewMs:2*60000,publicationStaleMs:15*60000,maintenanceMaxAgeMs:60000,maintenanceAssertionMarginMs:30000,responseTimeoutMs:10000})
});
const storage=createStorage(storageInput);
folder=createMemoryDirectory({now:()=>now,faults});
const id=(n:number)=>'cp_'+String(n).padStart(32,'0'),objectId=(n:number)=>'obj_'+String(n).padStart(32,'0');
const upload=async(kind:Kind,fileId:string,text:string)=>{const blob=new Blob([text]);return storage.upload(freeze({kind,id:fileId,name:'',blob,size:blob.size,digest:await sha256(blob)}));};

// Files land in the same folders as before and read back verified.
const object=await upload('object',objectId(1),'object bytes'),manifest=await upload('checkpoint',id(1),JSON.stringify({id:id(1)})),commit=await upload('commit',id(1),'commit bytes');
const root=await folder.getDirectoryHandle(identities.root);
assert.deepEqual(root.names(),['checkpoints','commits','objects','repository.sdscope']);
assert.deepEqual((await root.getDirectoryHandle('objects')).names(),[objectId(1)+'.sdobject']);
assert.equal(object.kind,'object');assert.equal(object.size,12);assert.equal(manifest.digest,await sha256(new Blob([JSON.stringify({id:id(1)})])));assert.equal(commit.kind,'commit');
assert.equal(await (await storage.download(object)).text(),'object bytes');
// Repeating an uncertain upload may reuse the exact immutable file, but a
// conflicting payload must not truncate an existing committed object or marker.
for(const [kind,fileId,original,conflict] of [
  ['object',objectId(1),'object bytes','different object bytes'],
  ['checkpoint',id(1),JSON.stringify({id:id(1)}),'{"id":"other"}'],
  ['commit',id(1),'commit bytes','different commit bytes']
] as const){
  const initial=required((await storage.list({kind})).items.find(item=>item.id===fileId));
  const repeated=await upload(kind,fileId,original);
  assert.equal(repeated.remoteVersion,initial.remoteVersion,'idempotent '+kind+' replay must preserve existing bytes and version');
  await assert.rejects(()=>upload(kind,fileId,conflict),/identity collision/u,'conflicting '+kind+' replay must fail closed');
  assert.equal(await (await storage.download(initial)).text(),original,'collision must preserve original '+kind+' bytes');
}
// A stale caller digest cannot authorize falsely reusing a different Blob.
const stale=new Blob(['OBJECT bytes']);
const originalDigest=await sha256(new Blob(['object bytes']));
await assert.rejects(()=>storage.upload(freeze({kind:'object',id:objectId(1),blob:stale,size:stale.size,digest:originalDigest})),/identity collision/u);
assert.equal(await (await storage.download(object)).text(),'object bytes');
// Absence of a caller checksum cannot authorize replacing an existing file.
await assert.rejects(()=>storage.upload(freeze({kind:'object',id:objectId(1),blob:new Blob(['object bytes'])})),/identity collision/u);
assert.equal(await (await storage.download(object)).text(),'object bytes');

// A digest mismatch in a retry cleanup cannot delete a pre-existing
// immutable file, even if the caller knows its correct kind and identity.
for(const [kind,fileId,original] of [
  ['object',objectId(1),'object bytes'],
  ['checkpoint',id(1),JSON.stringify({id:id(1)})],
  ['commit',id(1),'commit bytes']
] as const){
  const wrongDigest=await sha256(new Blob(['not the existing file']));
  await assert.rejects(()=>storage.delete(freeze({kind,id:fileId,digest:wrongDigest})),/changed checksum before deletion/u);
  assert.equal(await (await storage.download(freeze({kind,id:fileId}))).text(),original);
}
// A range read (integrity verification) carries the file's size and version,
// the same shape Drive returns; a range outside the file is refused.
{
  const range=await storage.download(object,{offset:7,length:5});
  assert.ok(range.blob instanceof Blob,'a range read returns its bytes as a Blob');
  assert.equal(await range.blob.text(),'bytes');assert.equal(range.totalBytes,12);
  assert.equal(range.version,object.remoteVersion,'a range is tied to the listed version of the file');
  await assert.rejects(()=>storage.download(object,{offset:8,length:5}),/range is invalid/u);
  await assert.rejects(()=>storage.download(object,{offset:-1,length:1}),/range is invalid/u);
}

// A version's listing carries its summary from the manifest, so history needs no other reads.
const listed=(await storage.list({kind:'checkpoint'})).items;
assert.equal(listed.length,1);const first=required(listed[0]),history=required(first.history);assert.equal(history.counts.dailyRecord,3);assert.equal(history.retention.calendar['month'],'2026-10');
assert.equal(history.attachmentsMissing,1,'the summary counts attachments the version is missing, so Version History can hide Replace');
assert.match(first.verificationScope,/^device-folder:1:[a-f0-9]{32}$/u);assert.equal(required((await storage.list({kind:'commit'})).items[0]).verificationScope,first.verificationScope,'one stable identity per folder');
assert.equal(await storage.scope(),first.verificationScope);

// External modification can preserve both file size and reported modification
// time. Ordinary listing remains cached; critical cleanup listing must hash
// current bytes, invalidate stale digests and refresh the manifest summary.
{
  const fileId=id(8),originalText=JSON.stringify({id:fileId,locked:false}),modifiedText=originalText.replace('false','true ');
  assert.equal(originalText.length,modifiedText.length);
  await upload('checkpoint',fileId,originalText);
  const before=required((await storage.list({kind:'checkpoint'})).items.find(item=>item.id===fileId));
  assert.ok(before?.history);
  const handle=await (await root.getDirectoryHandle('checkpoints')).getFileHandle(fileId+'.sdcheckpoint');
  const writer=await handle.createWritable({keepExistingData:false});await writer.write(modifiedText);await writer.close();
  const cached=required((await storage.list({kind:'checkpoint'})).items.find(item=>item.id===fileId));
  assert.equal(cached.remoteVersion,before.remoteVersion,'the test must retain an identical filesystem version');
  assert.equal(cached.digest,before.digest,'normal UI listing may use the metadata digest cache');
  const fresh=required((await storage.list({kind:'checkpoint',freshDigests:true})).items.find(item=>item.id===fileId));
  assert.equal(fresh.digest,await sha256(new Blob([modifiedText])),'safety scans hash current bytes');
  assert.notEqual(fresh.digest,before.digest,'same-size same-time modifications invalidate the old proof');
  assert.equal(fresh.locked,true,'digest-aware summary cache must not return a stale unlocked summary');
  await assert.rejects(()=>storage.delete(before),/changed checksum before deletion/u,'stale cleanup identity must not delete a modified checkpoint');
}

// A write that stalls (a disconnected drive, a stuck sync client) fails within
// the timeout instead of hanging the backup.
{
  const stalled=createMemoryDirectory({now:()=>now,faults});
  const forward=(owner:object,key:string|symbol):unknown=>{const value:unknown=Reflect.get(owner,key);return typeof value==='function'?(...args:unknown[]):unknown=>Reflect.apply(value,owner,args):value;};
  const stallWrites=(directory:Directory):Directory=>new Proxy(directory,{get:(target,key)=>key==='getFileHandle'?async(name:string,options?:{create?:boolean})=>{const handle=await target.getFileHandle(name,options);return new Proxy(handle,{get:(file,prop)=>prop==='createWritable'?async()=>({write:()=>new Promise<void>(()=>{}),close:async()=>{},abort:async()=>{}}):forward(file,prop)});}:key==='getDirectoryHandle'?async(name:string,options?:{create?:boolean})=>stallWrites(await target.getDirectoryHandle(name,options)):forward(target,key)});
  const timers:(()=>void)[]=[];const stalledStorage=createStorage(freeze({
    folder:()=>stallWrites(stalled),identities,owner:()=>({profile:'prof_qa_mve00000_abcdef01',scope:'',device:'inst_qa_test_mve00000_abcdef01'}),checksum:async (blob:Blob)=>sha256(blob),inspectManifest:async()=>manifestFor(id(9)),
    environment:freeze({canMutate:()=>true,now:()=>now,setTimeout:(callback:()=>void,_ms:number)=>{timers.push(callback);return timers.length;},clearTimeout:()=>{},yieldTask:async()=>{}}),
    limits:freeze({publicationMaxAgeMs:24*3600000,publicationAssertionMarginMs:30*60000,publicationRenewMs:2*60000,publicationStaleMs:15*60000,maintenanceMaxAgeMs:60000,maintenanceAssertionMarginMs:30000,responseTimeoutMs:10000})
  }));
  const blob=new Blob(['never lands']),pending=stalledStorage.upload(freeze({kind:'object',id:objectId(9),name:'',blob,size:blob.size,digest:await sha256(blob)}));
  for(let i=0;i<20&&!timers.length;i++)await new Promise(resolve=>setImmediate(resolve));
  // Fire every pending timeout: only the stalled chunk write is still waiting.
  while(timers.length)required(timers.shift())();
  await assert.rejects(pending,(error:unknown)=>field(error,'code')==='DEVICE_FILESYSTEM_TIMEOUT'&&/did not respond within 10 seconds/u.test(errorMessage(error)));
}

// A write that reads back wrong is removed and fails.
faults.corruptReadOf.add(objectId(2)+'.sdobject');
await assert.rejects(()=>upload('object',objectId(2),'second object'),/failed verification/u);
assert.deepEqual((await root.getDirectoryHandle('objects')).names(),[objectId(1)+'.sdobject'],'a bad write leaves nothing behind');
const reopened=createStorage(storageInput);assert.equal(await (await reopened.download(object)).text(),'object bytes','a fresh storage owner can read original bytes after failed publication');
await upload('object',objectId(2),'second object');assert.equal(await (await reopened.download({kind:'object',id:objectId(2)})).text(),'second object','retry is independently readable');

// Deletion refuses a file that changed since it was listed.
now+=1000;
// Simulate an external modification, not a repository upload: repository
// uploads must never replace committed identities.
const modified=(await root.getDirectoryHandle('commits'));const modifiedHandle=await modified.getFileHandle(id(1)+'.sdcommit'),modifiedWriter=await modifiedHandle.createWritable({keepExistingData:false});await modifiedWriter.write('commit bytes again');await modifiedWriter.close();
await assert.rejects(()=>storage.delete(commit),/changed before deletion/u);
assert.equal(await storage.delete(required((await storage.list({kind:'commit'})).items[0])),true);assert.equal(await storage.delete({kind:'commit',id:id(1)}),false);
await assert.rejects(()=>storage.download({kind:'commit',id:id(1)}),(error:unknown)=>field(error,'code')==='REPOSITORY_OBJECT_MISSING');

// Locks keep their existing file names and format, expire by age, and renew.
const publication=await storage.beginPublication();
assert.match(publication.name,/^pub_[a-f0-9]{32}\.sdpublication$/u);assert.equal((await storage.listPublications()).items.length,1);
assert.equal(await storage.assertPublication(publication),true);
// An upload lock renews: its upload rewrites it while it runs. Unrenewed
// close to the abandoned limit, it can no longer be renewed or relied on.
assert.equal(publication.renews,true,'a new upload lock says it renews');assert.equal(required((await storage.listPublications()).items[0]).renews,true,'cleanup sees that the lock renews');
now+=10*60000;const renewedPublication=await storage.renewPublication(publication);
assert.equal(renewedPublication.id,publication.id);assert.equal(renewedPublication.renews,true,'renewal keeps the promise to renew');assert.equal(Date.parse(renewedPublication.createdAt),now,'renewal restarts the lock\'s age');
assert.equal(required((await storage.listPublications()).items[0]).renews,true,'a renewed lock still says it renews');
now+=13*60000;await assert.rejects(()=>storage.assertPublication(renewedPublication),/too old/u,'a renewing lock unrenewed this long may already look abandoned');
await assert.rejects(()=>storage.renewPublication(renewedPublication),/too old/u,'nor can it be renewed');
// A lock from an older build does not renew and keeps the full day.
const objectsFolder=await root.getDirectoryHandle('objects'),legacyHandle=await objectsFolder.getFileHandle(publication.name),legacyWriter=await legacyHandle.createWritable();await legacyWriter.write(JSON.stringify({format:'study-director.repository-publication',version:1,id:publication.id,startedAt:new Date(now).toISOString()}));await legacyWriter.close();
assert.equal(required((await storage.listPublications()).items[0]).renews,false,'an older build\'s lock does not renew');
now+=60*60000;assert.equal(await storage.assertPublication(publication),true,'an older build\'s lock keeps the full day');
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
await assert.rejects(()=>storage.list({kind:'checkpoint'}),(error:unknown)=>field(error,'code')==='DEVICE_FOLDER_MISSING');

console.log(JSON.stringify({status:'PASS',suite:'device-folder-storage',checks:['verified writes','immutable replay and collision safety','listing summaries','folder identity','guarded deletion','locks','locked manifests','control loss','missing folder']},null,2));
