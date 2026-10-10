import assert from 'node:assert/strict';
import {createDeviceFolderWorld as world,IDENTITIES,MINUTE,DAY} from '../../helpers/device-folder-world.mjs';

// The Device Folder is one location of the shared backup engine; see the
// world helper for what runs for real.
const cases=[];
async function test(name,run){await run();cases.push(name);}

await test('a browser without folder access never registers a location and every backup path stays quiet',async()=>{
  const w=world({supported:false});await w.controller.install();
  assert.equal(w.controller.status().mode,'unsupported');assert.equal(w.runtime.list({hosted:true}).length,0);
  assert.equal(await w.controller.backupNow(),false);w.change(true);await w.runtime.flushAutomatic('app-hidden');await w.tick(30*MINUTE);
  assert.equal(w.published.length,0);assert.equal(w.runtime.automaticActive(),false);assert.equal(w.runtime.automaticWaiting(),false);assert.equal(w.notices.length,0);
});

await test('choosing an empty folder opens the picker from the click and makes the first backup at once',async()=>{
  const w=world();await w.controller.install();assert.equal(w.controller.status().mode,'off');
  const folder=w.directory();w.choose(folder);
  const connecting=w.controller.connect();assert.equal(w.pickerCalls,1,'the picker opens before anything is awaited');
  await connecting;await w.settle();
  assert.equal(w.controller.status().connected,true);assert.equal(w.published.length,1,'the first backup is made at once');assert.equal((await w.commits(folder)).length,1);
  assert.equal(w.settingsStore.get('automaticDeviceBackup').directoryHandle,folder,'the folder is remembered');
  assert.ok(w.controller.status().lastBackupAt,'the row shows when it was last verified');assert.deepEqual(await w.locks(folder),[],'no lock files remain');
});

await test('automatic backups follow the shared cadence: 20 minutes, seconds after a key moment, at once when hidden',async()=>{
  const w=world(),folder=w.directory();await w.controller.install();w.choose(folder);await w.controller.connect();await w.settle();
  const base=w.published.length,start=w.clock.now();
  w.change();await w.tick(10*MINUTE);w.change();await w.tick(9*MINUTE);
  assert.equal(w.published.length,base,'later changes do not restart the countdown, and nothing runs before it ends');
  assert.equal(w.controller.status().pending,true,'the row says changes are waiting');
  await w.tick(MINUTE+5000);assert.equal(w.published.length,base+1);assert.ok(w.published.at(-1).at-start<=20*MINUTE+5000);
  w.change(true);await w.tick(5000);assert.equal(w.published.length,base+2,'a key moment backs up within seconds');
  w.change();await w.tick(MINUTE);assert.equal(w.published.length,base+2);await w.runtime.flushAutomatic('app-hidden');await w.settle();
  assert.equal(w.published.length,base+3,'going to the background backs up waiting changes at once');
  assert.equal(w.controller.status().pending,false);
});

await test('a folder that already holds backups is not published to on choose; the next change is',async()=>{
  const shared=world(),folder=shared.directory();await shared.controller.install();shared.choose(folder);await shared.controller.connect();await shared.settle();
  assert.equal((await shared.commits(folder)).length,1);
  const w=world({start:'2026-10-06T09:00:00.000Z'});await w.controller.install();w.choose(folder);await w.controller.connect();await w.settle();
  assert.equal(w.published.length,0,'choosing a folder with backups writes nothing');
  assert.match(w.controller.status().message,/Existing Study Director backups found/u);assert.equal(w.runtime.automaticWaiting(),false);
  await w.tick(30*MINUTE);assert.equal(w.published.length,0,'no change, no backup');
  w.change();await w.tick(21*MINUTE);assert.equal(w.published.length,1,'this device backs up from its next change');assert.equal((await w.commits(folder)).length,2);
});

await test('a stored folder found on start backs up waiting changes only while local data is present',async()=>{
  const w=world(),folder=w.directory();w.store(folder,'2026-10-06T07:00:00.000Z');w.setLocalEmpty(true);
  await w.controller.install();assert.equal(w.controller.status().connected,true);await w.tick(MINUTE);
  assert.equal(w.published.length,0,'an emptied browser never becomes the newest version');
  w.setLocalEmpty(false);w.runtime.wakeBackground('activation');await w.tick(MINUTE);
  assert.equal(w.published.length,1,'with local data present, start-up catches up without waiting for an edit');
});

await test('a folder that needs permission again asks once, never prompts on its own, and catches up after Allow access',async()=>{
  const w=world(),folder=w.directory({permission:'prompt'});w.store(folder,'2026-10-06T07:00:00.000Z');
  await w.controller.install();assert.equal(w.controller.status().mode,'permission');assert.equal(folder.requests,0,'start-up never prompts');
  assert.equal(w.permissionNotices().length,1);assert.notEqual(w.permissionNotices()[0].persistent,true,'the notice can be dismissed');
  await w.controller.refreshPermission();w.change();await w.tick(25*MINUTE);
  assert.equal(w.permissionNotices().length,1,'one notice per launch');assert.equal(w.published.length,0,'nothing is written without permission');
  const allowing=w.controller.connect();assert.equal(folder.requests,1,'the permission prompt opens from the click');await allowing;await w.tick(5000);
  assert.equal(w.controller.status().connected,true);assert.equal(w.published.length,1,'changes made meanwhile are backed up');assert.equal(w.settingsStore.get('automaticDeviceBackup').directoryHandle,folder,'the same folder is kept');
});

await test('cancelling the picker or refusing permission leaves a clean, unconnected state',async()=>{
  const w=world();await w.controller.install();
  w.choose(Object.assign(new Error('The user aborted a request.'),{name:'AbortError'}));await w.controller.connect();
  assert.equal(w.controller.status().mode,'off');assert.equal(w.controller.status().message,'Folder selection was cancelled.');assert.equal(w.settingsStore.size,0);
  w.choose(w.directory({permission:'prompt',grant:'denied'}));await w.controller.connect();
  assert.equal(w.controller.status().connected,false);assert.match(w.controller.status().message,/Write permission was not granted/u);assert.equal(w.settingsStore.size,0);assert.equal(w.published.length,0);
});

await test('a deleted repository folder heals in the next backup; a deleted chosen folder is forgotten cleanly',async()=>{
  const w=world(),folder=w.directory();await w.controller.install();w.choose(folder);await w.controller.connect();await w.settle();
  await folder.removeEntry(IDENTITIES.root);w.change(true);await w.tick(10*1000);
  assert.equal((await w.commits(folder)).length,1,'the repository is recreated in the same backup');
  folder.markRemoved();w.change(true);await w.tick(10*1000);
  assert.equal(w.controller.status().connected,false);assert.equal(w.controller.status().mode,'off');assert.equal(w.settingsStore.size,0,'the dead folder is forgotten');
  assert.match(w.controller.status().message,/no longer available/u);
  w.change();await w.tick(30*MINUTE);assert.equal(w.runtime.automaticActive(),false,'nothing keeps trying');
});

await test('Turn off forgets the folder and stops automatic backups; the backups stay in the folder',async()=>{
  const w=world(),folder=w.directory();await w.controller.install();w.choose(folder);await w.controller.connect();await w.settle();
  await w.controller.disconnect();assert.equal(w.controller.status().connected,false);assert.equal(w.settingsStore.size,0);
  w.change(true);await w.tick(30*MINUTE);assert.equal(w.published.length,1,'no automatic backups after turning off');assert.equal((await w.commits(folder)).length,1,'existing backups are untouched');
  assert.equal(w.runtime.list({hosted:true})[0].connected,false);
});

await test('after a browser data clear the open tab writes the folder back',async()=>{
  const w=world(),folder=w.directory();await w.controller.install();w.choose(folder);await w.controller.connect();await w.settle();
  w.settingsStore.clear();assert.equal(await w.controller.rememberAfterStorageReset(),true);assert.equal(w.settingsStore.get('automaticDeviceBackup').directoryHandle,folder);
});

await test('a protected safety version is written in the foreground, listed, and removable; retention bounds the folder',async()=>{
  const w=world(),folder=w.directory();await w.controller.install();w.choose(folder);await w.controller.connect();await w.settle();
  const safety=await w.runtime.createProtectedSafety('device-folder','before-clear-library');assert.equal(safety.verified,true);assert.equal(w.published.at(-1).role,'before-restore');
  const history=await w.runtime.history('device-folder',{interactive:false});assert.equal(history.available,true);
  const tiers=history.entries.map(entry=>entry.location.tier);assert.ok(tiers.includes('before-restore'));assert.ok(tiers.includes('latest'));
  const removed=await w.runtime.removeProtectedRepositoryProvider('device-folder',safety.checkpointId);assert.equal(removed.removed,true);
  assert.ok(!(await w.commits(folder)).includes(safety.checkpointId+'.sdcommit'));
  // Forty days of daily backups keep at most 15 ordinary versions once cleanup runs.
  for(let day=0;day<40;day++){await w.tick(DAY);w.change(true);await w.tick(10*1000);}
  await w.tick(2*MINUTE);assert.ok((await w.commits(folder)).length<=15,`retention keeps the folder bounded (${(await w.commits(folder)).length})`);
  assert.deepEqual(await w.locks(folder),[],'no lock files remain after backups and cleanup');
  assert.deepEqual(w.captures.filter(row=>!/integrity/u.test(row.scope)),[],'nothing unexpected was reported');
});

console.log(JSON.stringify({status:'PASS',suite:'device-backup',productionEngine:true,cases},null,2));
