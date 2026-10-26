import assert from 'node:assert/strict';
import {createDeviceFolderWorld as world,sharedLock,IDENTITIES,LEGACY_ROOT,REPOSITORY_NAME,QA_DEVICE,QA_PROFILE} from '../../helpers/device-folder-world.mjs';

// Inside the chosen Device Folder each profile and device has its own backup
// folder ("Study Director - Ana - iPhone Safari"), known by the marker file
// inside it. The single folder earlier versions used is moved into it.
const cases=[];
async function test(name,run){await run();cases.push(name);}
const SCOPE_FILE='repository.sdscope';
async function marker(folder,name){return JSON.parse(await (await (await (await folder.getDirectoryHandle(name)).getFileHandle(SCOPE_FILE)).getFile()).text());}

async function names(folder,name,kind){try{return (await (await folder.getDirectoryHandle(name)).getDirectoryHandle(kind)).names();}catch{return [];}}
// A folder as released versions left it: one repository folder of a fixed
// name, with no marker, holding `count` versions. It is written by another
// page and copied into a folder of `into` (on that world's clock).


await test('a new folder holds one backup folder named for the profile and device, marked as theirs',async()=>{
  const w=world(),folder=w.directory();await w.controller.install();w.choose(folder);await w.controller.connect();await w.settle();
  assert.deepEqual(folder.names(),[REPOSITORY_NAME]);assert.equal((await w.commits(folder)).length,1);
  const value=await marker(folder,REPOSITORY_NAME);
  assert.equal(value.version,2);assert.equal(value.profile,QA_PROFILE);assert.equal(value.scope,'');assert.equal(value.device,QA_DEVICE);
  assert.equal(w.repositoryChoices.length,0,'no other backup folder to offer');
});


await test('after a browser data clear the device can take over its earlier backup folder, or start a new one',async()=>{
  const first=world(),folder=first.directory();await first.controller.install();first.choose(folder);await first.controller.connect();await first.settle();
  const before=await marker(folder,REPOSITORY_NAME);
  // The same browser after a clear: a new device id, and nothing remembered.
  const cleared=world({device:'inst_qa_test_mvf00000_abcdef02'});await cleared.controller.install();
  cleared.chooseRepositoryWith(()=>null);cleared.choose(folder);await cleared.controller.connect();
  assert.equal(cleared.controller.status().connected,false);assert.equal(cleared.note(),'Folder selection was cancelled.');assert.equal(cleared.settingsStore.size,0);
  assert.deepEqual(cleared.repositoryChoices[0].map(row=>[row.name,row.versions]),[[REPOSITORY_NAME,1]],'the choice shows each folder and how many versions it holds');
  cleared.chooseRepositoryWith(rows=>rows[0].name);cleared.choose(folder);await cleared.controller.connect();await cleared.settle();
  assert.equal(cleared.controller.status().connected,true);assert.deepEqual(folder.names(),[REPOSITORY_NAME]);
  const after=await marker(folder,REPOSITORY_NAME);assert.equal(after.id,before.id,'taken over, with its identity');assert.equal(after.device,'inst_qa_test_mvf00000_abcdef02');
  assert.match(cleared.note(),/Existing Study Director backups found/u,'its versions are offered for recovery');
  const fresh=world({device:'inst_qa_test_mvg00000_abcdef03',name:'Study Director - QA - Test Device'});await fresh.controller.install();
  fresh.chooseRepositoryWith(()=>'');fresh.choose(folder);await fresh.controller.connect();await fresh.settle();
  assert.deepEqual(folder.names(),[REPOSITORY_NAME,`${REPOSITORY_NAME} (2)`],'a new folder never takes a name in use');
  assert.equal((await marker(folder,`${REPOSITORY_NAME} (2)`)).device,'inst_qa_test_mvg00000_abcdef03');
});

await test('each profile on a device keeps its own folder, and a profile that takes another id keeps it too',async()=>{
  const ana=world(),folder=ana.directory();await ana.controller.install();ana.choose(folder);await ana.controller.connect();await ana.settle();
  const ben=world({profile:'prof_ben_mve00000_abcdef02',name:'Study Director - Ben - Test Device'});ben.setOwner({scope:'prof_ben_mve00000_abcdef02'});
  await ben.controller.install();ben.choose(folder);await ben.controller.connect();await ben.settle();
  assert.equal(ben.repositoryChoices.length,0,'another profile’s folder on this device is never offered');
  assert.deepEqual(folder.names(),['Study Director - Ben - Test Device',REPOSITORY_NAME]);
  // Ana's profile continues a Drive library from another device and takes its id.
  const again=world({profile:'prof_qa_mvd00000_0000abcd'});again.store(folder);await again.controller.install();await again.settle();
  assert.equal(again.controller.status().connected,true);assert.equal((await marker(folder,REPOSITORY_NAME)).profile,'prof_qa_mvd00000_0000abcd','the marker follows the new id');
  assert.deepEqual(folder.names(),['Study Director - Ben - Test Device',REPOSITORY_NAME]);
});

await test('deleting a profile everywhere deletes its backup folder here and leaves the others',async()=>{
  const ana=world(),folder=ana.directory();await ana.controller.install();ana.choose(folder);await ana.controller.connect();await ana.settle();
  const ben=world({profile:'prof_ben_mve00000_abcdef02',name:'Study Director - Ben - Test Device'});ben.setOwner({scope:'prof_ben_mve00000_abcdef02'});
  await ben.controller.install();ben.choose(folder);await ben.controller.connect();await ben.settle();
  assert.equal(await ana.controller.deleteBackups(),REPOSITORY_NAME);
  assert.deepEqual(folder.names(),['Study Director - Ben - Test Device'],'only this profile’s folder goes');
  assert.equal(ana.controller.status().connected,false);assert.equal(ana.settingsStore.size,0,'Device Folder backup is off for it');
  assert.equal(await ana.controller.deleteBackups(),'','nothing left to delete');
});

// Only the tab that writes prepares the folder, and one tab at a time: two
// tabs opened together (an app update reloads every tab) move the old folder
// once, and a tab that does not write never touches the folder.


await test('unsupported folders stay untouched while canonical backups use their own folder',async()=>{
 const w=world(),folder=w.directory(),old=await folder.getDirectoryHandle(LEGACY_ROOT,{create:true});const file=await old.getFileHandle('retained.txt',{create:true}),writer=await file.createWritable();await writer.write('unsupported bytes');await writer.close();
 await w.controller.install();w.choose(folder);await w.controller.connect();await w.settle();assert.equal(await (await file.getFile()).text(),'unsupported bytes');assert.deepEqual(folder.names(),[LEGACY_ROOT,REPOSITORY_NAME].sort());assert.ok((await w.commits(folder)).length);
});
await test('read-only tabs wait and two writable tabs select one canonical folder',async()=>{
 const lock=sharedLock(),first=world({lock}),second=world({lock}),folder=first.directory();first.store(folder);first.setCanMutate(false);await first.controller.install();await first.settle();assert.deepEqual(folder.names(),[]);
 first.setCanMutate(true);second.store(folder);await Promise.all([first.controller.wake(),second.controller.install()]);await Promise.all([first.settle(),second.settle()]);assert.deepEqual(folder.names(),[REPOSITORY_NAME]);assert.equal(first.controller.status().repositoryName,REPOSITORY_NAME);assert.equal(second.controller.status().repositoryName,REPOSITORY_NAME);
});
console.log(JSON.stringify({status:'PASS',suite:'device-folder-layout',cases},null,2));
