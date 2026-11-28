import {readCoreScript} from '../core-script.mts';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createProcessingEngine} from '../file-processing.mts';
import {createDeviceFolderWorld,IDENTITIES,MINUTE} from '../device-folder-world.mts';

// Encrypted Device Folder backups through the shared engine, with the real
// backup encryption: objects and version files are sealed, commit markers
// carry metadata only, a locked app writes nothing on its own, Back up now
// asks to unlock, and a write that reads back wrong never becomes a version.
for(const name of ['internal','operation-lifecycle','exports'])vm.runInThisContext(readCoreScript(name),{filename:name+'.js'});
import {method,registeredExports} from '../registered-exports.mts';
import {field} from '../repository-safety-ports.mts';
import {required} from '../repository-note-ports.mts';
import {jsonObject,jsonString} from './read-verification.mts';
import {deviceControllerPort,deviceRuntimePort,folderStoragePort} from '../device-folder-ports.mts';
const lifecycle=registeredExports(globalThis,'operation-lifecycle'),exportsModule=registeredExports(globalThis,'exports',Object.freeze({lifecycle})),engine=createProcessingEngine(),settings=new Map<string,unknown>();
let unlockPrompts=0;
const processing={...engine,check:()=>{},job:<T,>(fn:()=>T)=>fn()},storage={read:async (key:string)=>settings.get(key)||null,write:async(key:string,value:unknown)=>settings.set(key,value),remove:async (key:string)=>settings.delete(key)};
const interactions={input:async()=>{unlockPrompts+=1;return {value:'folder encryption passphrase'};},choose:async()=>'unlock',confirm:async()=>true};
// remember: the device holds one profile, so its kept key opens it again.
const makeProtection=(remember=()=>true)=>method(exportsModule,'createProtection')({processing,storage,interactions,settingKey:'backupProtection',remember});
let protection=makeProtection();await method(protection,'manage')();assert.equal(field(method(protection,'status')(),'unlocked'),true);
const sealed=Object.freeze({protect:(...args:unknown[])=>method(protection,'protect')(...args),unprotect:(...args:unknown[])=>method(protection,'unprotect')(...args),status:()=>method(protection,'status')()});
function world(options:Parameters<typeof createDeviceFolderWorld>[0]){const raw=createDeviceFolderWorld(options);return {...raw,controller:deviceControllerPort(raw.controller),runtime:deviceRuntimePort(raw.runtime),note:()=>jsonString(raw.note())};}
const w=world({protection:sealed}),folder=w.directory();
const cases:string[]=[];
async function folderFile(kind:'objects'|'checkpoints'|'commits',name:string){const root=await folder.getDirectoryHandle(IDENTITIES.root);return (await (await root.getDirectoryHandle(IDENTITIES[kind])).getFileHandle(name)).getFile();}
const commits=async()=>(await w.commits(folder)).length;

await w.controller.install();w.choose(folder);await w.controller.connect();await w.settle();
{
  assert.equal(await commits(),1);
  const root=await folder.getDirectoryHandle(IDENTITIES.root),objectName=required((await root.getDirectoryHandle(IDENTITIES.objects)).names().find(name=>name.endsWith('.sdobject'))),commitName=required((await w.commits(folder))[0]);
  assert.equal(await (await folderFile('objects',objectName)).slice(0,8).text(),'SDENC02\n','backup objects are encrypted');
  assert.equal(await (await folderFile('checkpoints',commitName.replace(/\.sdcommit$/u,'.sdcheckpoint'))).slice(0,8).text(),'SDENC02\n','version files are encrypted');
  const rawMarker:unknown=JSON.parse(await (await folderFile('commits',commitName)).text()),marker=jsonObject(rawMarker);assert.equal(jsonString(marker['checkpointId'])+'.sdcommit',commitName,'commit markers hold metadata only');
  const history=await w.runtime.history('device-folder',{interactive:false});assert.equal(history.entries.length,1);assert.equal(required(history.entries[0]).location['encrypted'],true);
  cases.push('objects and versions are sealed; commit markers hold metadata only');
}
{
  // With several profiles on the device, reopening locks encryption: nothing is written on its own.
  protection=makeProtection(()=>false);await method(protection,'refresh')();assert.equal(field(method(protection,'status')(),'unlocked'),false);const promptsBefore=unlockPrompts;
  w.change();await w.tick(25*MINUTE);
  assert.equal(await commits(),1,'a locked app writes nothing automatically');assert.equal(w.controller.status()['pending'],true,'the row says changes are waiting');assert.equal(unlockPrompts,promptsBefore,'nothing prompts on its own');
  // Version History while locked, on a page that has not read the versions yet: they are listed as locked, without counts.
  const other=world({protection:sealed});await other.controller.install();other.choose(folder);await other.controller.connect();await other.settle();
  const lockedHistory=await other.runtime.history('device-folder',{interactive:false});
  assert.equal(lockedHistory.entries.length,1);assert.equal(required(lockedHistory.entries[0]).locked,true,'a version waiting for the password is listed as locked');assert.equal(required(lockedHistory.entries[0]).counts,null,'with no counts it cannot know yet');assert.equal(unlockPrompts,promptsBefore);
  await method(protection,'manage')();assert.equal(field(method(protection,'status')(),'unlocked'),true);w.runtime.wakeBackground('encryption-unlocked');await w.tick(5000);
  assert.equal(await commits(),2,'unlocking backs up what waited');assert.equal(w.controller.status()['pending'],false);
  cases.push('locked encryption pauses automatic backups until unlocked, and Version History lists versions as locked');
}
{
  protection=makeProtection(()=>false);await method(protection,'refresh')();const before=unlockPrompts;
  w.change();assert.equal(await w.controller.backupNow(),true);
  assert.equal(unlockPrompts,before+1,'Back up now asks to unlock');assert.equal(await commits(),3);
  cases.push('Back up now while locked asks to unlock, then backs up');
}
{
  const snapshot=async()=>Promise.all((await w.commits(folder)).map(async name=>{const manifest=name.replace(/\.sdcommit$/u,'.sdcheckpoint');const bytes=await (await folderFile('checkpoints',manifest)).arrayBuffer();return [name,Buffer.from(bytes).toString('hex')];}));
  const prior=await snapshot();
  await w.tick(1000);w.change();folder.faults.corruptReadOf.add(await w.nextObjectName());
  assert.equal(await w.controller.backupNow(),false);
  assert.equal(await commits(),3,'a write that reads back wrong never becomes a version');assert.deepEqual(await snapshot(),prior,'failed encrypted backup preserves all previously committed manifests byte for byte');assert.match(w.note(),/failed verification/u);
  const root=await folder.getDirectoryHandle(IDENTITIES.root),objects=(await root.getDirectoryHandle(IDENTITIES.objects)).names();assert.ok(!objects.includes(await w.nextObjectName()),'the bad file is removed');
  assert.equal(await w.controller.backupNow(),true,'the next attempt succeeds');assert.equal(await commits(),4);
  const fresh=world({protection:sealed,start:new Date(w.clock.now()).toISOString()});await fresh.controller.install();fresh.choose(folder);await fresh.controller.connect();await fresh.settle();
  const inventory=folderStoragePort(fresh.storageFor(()=>folder));
  const expected=(await w.commits(folder)).map(name=>name.replace(/\.sdcommit$/u,'')).sort();
  const [manifests,markers]=await Promise.all([inventory.list({kind:'checkpoint',freshDigests:true}),inventory.list({kind:'commit',freshDigests:true})]);
  assert.equal(expected.length,4);assert.deepEqual(manifests.items.map(item=>item.id).sort(),expected,'fresh owner sees every physical encrypted checkpoint');assert.deepEqual(markers.items.map(item=>item.id).sort(),expected,'fresh owner sees every matching commit marker');
  const reopened=await fresh.runtime.history('device-folder',{interactive:false});assert.equal(reopened.available,true);const latest=required(reopened.entries[0]);assert.equal(latest.location['checkpointId'],required(w.published.at(-1)).checkpointId,'retention-filtered history shows the latest committed retry');assert.equal(latest.location['encrypted'],true);
  const retained=await snapshot();assert.deepEqual(retained.filter(row=>prior.some(old=>old[0]===row[0])),prior,'retry and reopening preserve the predecessor encrypted manifests');
  cases.push('a corrupt read-back fails the backup and leaves nothing behind');
}
{
  // One profile on the device: reopening keeps encryption open, so automatic backups go on without asking.
  protection=makeProtection();await method(protection,'refresh')();assert.equal(field(method(protection,'status')(),'unlocked'),true);const before=unlockPrompts,lastBefore=jsonString(w.controller.status()['lastBackupAt']);
  await w.tick(1000);w.change();await w.tick(25*MINUTE);
  assert.ok(jsonString(w.controller.status()['lastBackupAt'])>lastBefore,'the automatic backup is written');assert.equal(w.controller.status()['pending'],false);assert.equal(unlockPrompts,before,'nothing asks for the password');
  cases.push('one profile reopens with encryption open and keeps backing up');
}
console.log(JSON.stringify({status:'PASS',suite:'folder-encryption',productionEngine:true,cases},null,2));
