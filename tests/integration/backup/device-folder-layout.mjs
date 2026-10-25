import assert from 'node:assert/strict';
import {createDeviceFolderWorld as world,sharedLock,IDENTITIES,LEGACY_ROOT,REPOSITORY_NAME,QA_DEVICE,QA_PROFILE} from '../../helpers/device-folder-world.mjs';

// Inside the chosen Device Folder each profile and device has its own backup
// folder ("Study Director - Ana - iPhone Safari"), known by the marker file
// inside it. The single folder earlier versions used is moved into it.
const cases=[];
async function test(name,run){await run();cases.push(name);}
const SCOPE_FILE='repository.sdscope';
async function marker(folder,name){return JSON.parse(await (await (await (await folder.getDirectoryHandle(name)).getFileHandle(SCOPE_FILE)).getFile()).text());}
async function copyTree(from,to){
  for await (const [name,handle] of from.entries()){
    if(handle.kind==='directory'){await copyTree(handle,await to.getDirectoryHandle(name,{create:true}));continue;}
    const writable=await (await to.getFileHandle(name,{create:true})).createWritable();await writable.write(await handle.getFile());await writable.close();
  }
}
async function names(folder,name,kind){try{return (await (await folder.getDirectoryHandle(name)).getDirectoryHandle(kind)).names();}catch{return [];}}
// A folder as released versions left it: one repository folder of a fixed
// name, with no marker, holding `count` versions. It is written by another
// page and copied into a folder of `into` (on that world's clock).
async function legacyFolder(into,count=2){
  const w=world(),source=w.directory(),folder=into.directory();await w.controller.install();w.choose(source);await w.controller.connect();await w.settle();
  for(let index=1;index<count;index++){await w.tick(60*60*1000);w.change(true);await w.tick(10*1000);}
  await copyTree(await source.getDirectoryHandle(REPOSITORY_NAME),await folder.getDirectoryHandle(LEGACY_ROOT,{create:true}));
  await (await folder.getDirectoryHandle(LEGACY_ROOT)).removeEntry(SCOPE_FILE);
  return {folder,commits:await names(folder,LEGACY_ROOT,IDENTITIES.commits),checkpoints:await names(folder,LEGACY_ROOT,IDENTITIES.checkpoints),objects:await names(folder,LEGACY_ROOT,IDENTITIES.objects)};
}

await test('a new folder holds one backup folder named for the profile and device, marked as theirs',async()=>{
  const w=world(),folder=w.directory();await w.controller.install();w.choose(folder);await w.controller.connect();await w.settle();
  assert.deepEqual(folder.names(),[REPOSITORY_NAME]);assert.equal((await w.commits(folder)).length,1);
  const value=await marker(folder,REPOSITORY_NAME);
  assert.equal(value.version,2);assert.equal(value.profile,QA_PROFILE);assert.equal(value.scope,'');assert.equal(value.device,QA_DEVICE);
  assert.equal(w.repositoryChoices.length,0,'no other backup folder to offer');
});

await test('the folder of earlier versions moves into the new one: every version kept, the old folder deleted',async()=>{
  const w=world({start:'2026-10-06T12:00:00.000Z'}),legacy=await legacyFolder(w,3);assert.equal(legacy.commits.length,3);
  w.store(legacy.folder);await w.controller.install();await w.settle();
  assert.equal(w.controller.status().connected,true);
  assert.deepEqual(legacy.folder.names(),[REPOSITORY_NAME],'only the new folder is left');
  assert.deepEqual(await names(legacy.folder,REPOSITORY_NAME,IDENTITIES.commits),legacy.commits,'every version moved');
  assert.deepEqual(await names(legacy.folder,REPOSITORY_NAME,IDENTITIES.objects),legacy.objects);
  const value=await marker(legacy.folder,REPOSITORY_NAME);
  assert.match(value.id,/^[a-f0-9]{32}$/u,'the moved folder gets its identity');assert.equal(value.version,2);assert.equal(value.movedFrom,LEGACY_ROOT);assert.equal(value.moving,undefined);
  assert.match(w.note(),/Backups moved to “Study Director - QA - Test Device”/u);
  w.change(true);await w.tick(10*1000);
  assert.equal(w.published.length,1);assert.ok((await w.commits(legacy.folder)).some(name=>name.startsWith(w.published[0].checkpointId)),'the next backup lands next to the moved versions');assert.deepEqual(legacy.folder.names(),[REPOSITORY_NAME]);
});

await test('a copy that does not match keeps the old folder; the next try continues in the same new folder',async()=>{
  const w=world({start:'2026-10-06T12:00:00.000Z'}),legacy=await legacyFolder(w,2);
  legacy.folder.faults.corruptReadOf.add(legacy.checkpoints[0]);
  w.store(legacy.folder);await w.controller.install();await w.settle();
  assert.equal(w.controller.status().connected,false,'no backup runs until the move is complete');
  assert.match(w.note(),/did not match\. The old folder was kept/u);
  assert.deepEqual(legacy.folder.names(),[LEGACY_ROOT,REPOSITORY_NAME].sort());assert.equal((await marker(legacy.folder,REPOSITORY_NAME)).moving,LEGACY_ROOT);
  assert.deepEqual(await names(legacy.folder,LEGACY_ROOT,IDENTITIES.commits),legacy.commits,'the old folder is untouched');
  assert.equal(await w.controller.backupNow(),true);await w.settle();
  assert.deepEqual(legacy.folder.names(),[REPOSITORY_NAME],'the same new folder is finished, not a second one');
  assert.equal((await w.commits(legacy.folder)).length,3);assert.equal((await marker(legacy.folder,REPOSITORY_NAME)).movedFrom,LEGACY_ROOT);
});

await test('stored objects are checked by contents too: a bad copy keeps the old folder, a wrong leftover is copied again',async()=>{
  const w=world({start:'2026-10-06T12:00:00.000Z'}),legacy=await legacyFolder(w,2),objectName=legacy.objects[0];
  const bytes=async(name,file)=>Buffer.from(await (await (await (await (await legacy.folder.getDirectoryHandle(name)).getDirectoryHandle(IDENTITIES.objects)).getFileHandle(file)).getFile()).arrayBuffer());
  const original=await bytes(LEGACY_ROOT,objectName);
  // The copy of a stored object comes out wrong: the move stops and the old folder stays.
  legacy.folder.faults.corruptReadOf.add(objectName);
  w.store(legacy.folder);await w.controller.install();await w.settle();
  assert.equal(w.controller.status().connected,false);assert.match(w.note(),/did not match\. The old folder was kept/u);
  assert.deepEqual(legacy.folder.names(),[LEGACY_ROOT,REPOSITORY_NAME].sort());assert.deepEqual(await bytes(LEGACY_ROOT,objectName),original,'the original is untouched');
  // An interrupted move left a same-size object with the wrong contents: the next try copies it again.
  const wrong=Buffer.from(original);wrong[0]^=0xff;
  const writable=await (await (await (await legacy.folder.getDirectoryHandle(REPOSITORY_NAME)).getDirectoryHandle(IDENTITIES.objects)).getFileHandle(objectName)).createWritable();await writable.write(new Blob([wrong]));await writable.close();
  assert.equal(await w.controller.backupNow(),true);await w.settle();
  assert.deepEqual(legacy.folder.names(),[REPOSITORY_NAME],'the move finished');
  assert.deepEqual(await bytes(REPOSITORY_NAME,objectName),original,'the moved object holds the original bytes');
});

await test('an old folder that holds no version is simply removed',async()=>{
  const w=world(),folder=w.directory();await (await folder.getDirectoryHandle(LEGACY_ROOT,{create:true})).getDirectoryHandle('objects',{create:true});
  await w.controller.install();w.choose(folder);await w.controller.connect();await w.settle();
  assert.deepEqual(folder.names(),[REPOSITORY_NAME]);assert.equal((await w.commits(folder)).length,1);
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
await test('a tab that does not write never prepares or moves the folder; it does once it writes',async()=>{
  const w=world({start:'2026-10-06T12:00:00.000Z'}),legacy=await legacyFolder(w,2);
  w.setCanMutate(false);w.store(legacy.folder);await w.controller.install();await w.settle();await w.controller.refreshPermission();await w.settle();
  assert.deepEqual(legacy.folder.names(),[LEGACY_ROOT],'nothing is created, moved or deleted from a read-only tab');
  assert.equal(w.captures.length,0,'and nothing fails');
  w.setCanMutate(true);w.controller.wake();await w.settle();
  assert.deepEqual(legacy.folder.names(),[REPOSITORY_NAME],'the writing tab moves it when the gate opens');
  assert.deepEqual(await names(legacy.folder,REPOSITORY_NAME,IDENTITIES.commits),legacy.commits);
});
await test('two tabs opened together move the old folder once, with no error in either',async()=>{
  const lock=sharedLock(),first=world({start:'2026-10-06T12:00:00.000Z',lock}),second=world({start:'2026-10-06T12:00:00.000Z',lock}),legacy=await legacyFolder(first,3);
  first.store(legacy.folder);second.store(legacy.folder);
  await Promise.all([first.controller.install(),second.controller.install()]);await Promise.all([first.settle(),second.settle()]);
  assert.deepEqual(legacy.folder.names(),[REPOSITORY_NAME],'one new folder, the old one gone');
  assert.deepEqual(await names(legacy.folder,REPOSITORY_NAME,IDENTITIES.commits),legacy.commits,'every version moved');
  assert.deepEqual([...first.captures,...second.captures].filter(row=>row.scope==='device-backup.prepare'),[],'neither tab reports a failed preparation');
  assert.equal(first.controller.status().repositoryName,REPOSITORY_NAME);assert.equal(second.controller.status().repositoryName,REPOSITORY_NAME);
  assert.equal([first.note(),second.note()].filter(text=>/Backups moved/u.test(text)).length,1,'one tab moved them; the other waited and found them moved');
});

console.log(JSON.stringify({status:'PASS',suite:'device-folder-layout',cases},null,2));
