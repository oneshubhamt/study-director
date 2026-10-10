import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createProcessingEngine} from '../../helpers/file-processing.mjs';
import {createDeviceFolderWorld,IDENTITIES,MINUTE} from '../../helpers/device-folder-world.mjs';

// Encrypted Device Folder backups through the shared engine, with the real
// backup encryption: objects and version files are sealed, commit markers
// carry metadata only, a locked app writes nothing on its own, Back up now
// asks to unlock, and a write that reads back wrong never becomes a version.
for(const name of ['internal','operation-lifecycle','exports'])vm.runInThisContext(fs.readFileSync(`source/core/${name}.js`,'utf8'),{filename:name+'.js'});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')],engine=createProcessingEngine(),settings=new Map();
let unlockPrompts=0;
const processing={...engine,check:()=>{},job:fn=>fn()},storage={read:async key=>settings.get(key)||null,write:async(key,value)=>settings.set(key,value),remove:async key=>settings.delete(key)};
const interactions={input:async()=>{unlockPrompts+=1;return {value:'folder encryption passphrase'};},choose:async()=>'unlock',confirm:async()=>true};
const makeProtection=()=>registry.require('exports',1,Object.freeze({lifecycle:registry.require('operation-lifecycle',1)})).createProtection({processing,storage,interactions,settingKey:'backupProtection'});
let protection=makeProtection();await protection.manage();assert.equal(protection.status().unlocked,true);
const sealed=Object.freeze({protect:(...args)=>protection.protect(...args),unprotect:(...args)=>protection.unprotect(...args),status:()=>protection.status()});
const w=createDeviceFolderWorld({protection:sealed}),folder=w.directory();
const cases=[];
async function folderFile(kind,name){const root=await folder.getDirectoryHandle(IDENTITIES.root);return (await (await root.getDirectoryHandle(IDENTITIES[kind])).getFileHandle(name)).getFile();}
const commits=async()=>(await w.commits(folder)).length;

await w.controller.install();w.choose(folder);await w.controller.connect();await w.settle();
{
  assert.equal(await commits(),1);
  const root=await folder.getDirectoryHandle(IDENTITIES.root),objectName=(await root.getDirectoryHandle(IDENTITIES.objects)).names().find(name=>name.endsWith('.sdobject')),commitName=(await w.commits(folder))[0];
  assert.equal(await (await folderFile('objects',objectName)).slice(0,8).text(),'SDENC02\n','backup objects are encrypted');
  assert.equal(await (await folderFile('checkpoints',commitName.replace(/\.sdcommit$/u,'.sdcheckpoint'))).slice(0,8).text(),'SDENC02\n','version files are encrypted');
  const marker=JSON.parse(await (await folderFile('commits',commitName)).text());assert.equal(marker.checkpointId+'.sdcommit',commitName,'commit markers hold metadata only');
  const history=await w.runtime.history('device-folder',{interactive:false});assert.equal(history.entries.length,1);assert.equal(history.entries[0].location.encrypted,true);
  cases.push('objects and versions are sealed; commit markers hold metadata only');
}
{
  // Reopening the app locks encryption: nothing is written on its own.
  protection=makeProtection();await protection.refresh();assert.equal(protection.status().unlocked,false);const promptsBefore=unlockPrompts;
  w.change();await w.tick(25*MINUTE);
  assert.equal(await commits(),1,'a locked app writes nothing automatically');assert.equal(w.controller.status().pending,true,'the row says changes are waiting');assert.equal(unlockPrompts,promptsBefore,'nothing prompts on its own');
  await protection.manage();assert.equal(protection.status().unlocked,true);w.runtime.wakeBackground('encryption-unlocked');await w.tick(5000);
  assert.equal(await commits(),2,'unlocking backs up what waited');assert.equal(w.controller.status().pending,false);
  cases.push('locked encryption pauses automatic backups until unlocked');
}
{
  protection=makeProtection();await protection.refresh();const before=unlockPrompts;
  w.change();assert.equal(await w.controller.backupNow(),true);
  assert.equal(unlockPrompts,before+1,'Back up now asks to unlock');assert.equal(await commits(),3);
  cases.push('Back up now while locked asks to unlock, then backs up');
}
{
  await w.tick(1000);w.change();folder.faults.corruptReadOf.add(await w.nextObjectName());
  assert.equal(await w.controller.backupNow(),false);
  assert.equal(await commits(),3,'a write that reads back wrong never becomes a version');assert.match(w.controller.status().message,/failed verification/u);
  const root=await folder.getDirectoryHandle(IDENTITIES.root),objects=(await root.getDirectoryHandle(IDENTITIES.objects)).names();assert.ok(!objects.includes(await w.nextObjectName()),'the bad file is removed');
  assert.equal(await w.controller.backupNow(),true,'the next attempt succeeds');assert.equal(await commits(),4);
  cases.push('a corrupt read-back fails the backup and leaves nothing behind');
}
console.log(JSON.stringify({status:'PASS',suite:'folder-encryption',productionEngine:true,cases},null,2));
