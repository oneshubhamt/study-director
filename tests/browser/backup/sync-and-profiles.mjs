import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitFor} from '../../helpers/browser-harness.mjs';
import {drive,faults,ledger,commits,noteText,sync,open,reopen,connect,markers,uploadsBy,waiting,sleep} from '../../helpers/drive-browser.mjs';

// Two browsers share one simulated Google Drive. A writes a note and connects;
// B, the same person's other device, connects and receives it. A edits, B
// picks the edit up when it comes back to the front. A reload keeps the
// sign-in. Then B adds a second profile (empty), switches back (the notes are
// there) and removes it (its database is deleted from this device).

const server=await startReleaseServer();
const first=await launchChromium({profilePrefix:'sd-sync-a-'}),second=await launchChromium({profilePrefix:'sd-sync-b-'});
try{
  // A: a note, then Drive. The first upload carries it.
  let a=await open(first,server,'A');
  await a.evaluate(`(async()=>{__PWA6.AppData.notes.update('ethics','Ethics','Written on A','');await __PWA6.AppData.notes.flush({strict:true});})()`);
  await connect(a,'A');
  await waitFor(()=>commits()>=1,{label:'A uploads its first version',timeout:60000});
  await waitFor(async()=>!!(await sync(a))?.syncedAt,{label:'A synced',timeout:30000});

  // A reload keeps the sign-in: connected again without asking Google.
  await a.reload();await reopen(a,'A after reload');
  await waitFor(()=>a.evaluate(`__PWA6.BackupProviderRuntime.connected('google-drive')`),{label:'A still signed in after reload',timeout:20000});
  assert.equal(await a.evaluate(`window.__gisTokenRequests||0`),0,'the reload asked Google for no new sign-in');

  // B: the same profile on another device. Connecting brings A's note.
  const b=await open(second,server,'B');
  assert.equal(await noteText(b,'ethics'),null,'B starts without the note');
  await connect(b,'B');
  await waitFor(async()=>/Written on A/u.test(await noteText(b,'ethics')||''),{label:'B receives A\'s note',timeout:60000});
  await waitFor(async()=>!!(await sync(b))?.syncedAt,{label:'B synced',timeout:30000});

  // B's first sync uploads what it brought (its own first-start settings),
  // and Drive cleanup may follow. Both finish before A edits.
  await waitFor(async()=>!markers()&&!await waiting(b),{label:'B settles',timeout:90000});

  // Library → Data offers Recheck only for a connected location; a recheck
  // says it started and then shows its result under Verification.
  await b.evaluate(`(async()=>{__PWA6.goTab('library');await new Promise(r=>setTimeout(r,150));document.getElementById('library-tab-data').click();})()`);
  await waitFor(()=>b.evaluate(`!document.getElementById('recheck-google-drive').hidden`),{label:'B offers Recheck Google Drive',timeout:20000});
  assert.equal(await b.evaluate(`document.getElementById('recheck-device-folder').hidden&&getComputedStyle(document.getElementById('recheck-device-folder')).display==='none'`),true,'Recheck Device Folder must not be offered without a Device Folder');
  await b.evaluate(`document.getElementById('recheck-google-drive').click()`);
  await waitFor(()=>b.evaluate(`/Google Drive recheck started/u.test(document.getElementById('library-status').textContent)`),{label:'B says the recheck started',timeout:5000});
  await waitFor(()=>b.evaluate(`/^Google Drive: Checked/u.test(document.getElementById('drive-verification-status').textContent)`),{label:'B shows the recheck result',timeout:60000});

  // A edits and goes to the background: the edit goes up (after B's turn,
  // if B is still saving).
  const before=uploadsBy('A');
  const edited=await a.evaluate(`(async()=>{const notes=__PWA6.AppData.notes,result=notes.update('ethics','Ethics','Edited on A',notes.get('ethics').updatedAt);await notes.flush({strict:true});await __PWA6.BackupProviderRuntime.flushAutomatic('app-hidden');return result.status;})()`);
  assert.equal(edited,'changed','A edits the note');
  await waitFor(async()=>uploadsBy('A')>before&&!await waiting(a),{label:'A uploads the edit',timeout:120000});

  // B comes back to the front a minute after its last check and takes it in.
  for(let wait=1;wait>0;){wait=(Date.parse((await sync(b)).checkedAt)||0)+61000-Date.now();if(wait>0)await sleep(wait);}
  await b.evaluate(`window.dispatchEvent(new Event('focus'))`);
  await waitFor(async()=>/Edited on A/u.test(await noteText(b,'ethics')||''),{label:'B takes in A\'s edit on return',timeout:30000});
  assert.equal((await sync(b)).needsReview,false,'nothing for review: only A changed the note');

  // Profiles on B: a new one is empty, the first keeps its notes, and a
  // removed one leaves nothing behind on this device.
  const original=await b.evaluate(`__PWA6.Profiles.current().id`);
  await b.evaluate(`setTimeout(()=>__PWA6.Profiles.add(),0)`);
  await sleep(1500);await reopen(b,'B in the added profile');
  const added=await b.evaluate(`__PWA6.Profiles.current()`);
  assert.notEqual(added.id,original,'the added profile is open');
  assert.equal(await noteText(b,'ethics'),null,'the added profile is empty');
  assert.equal(await b.evaluate(`__PWA6.BackupProviderRuntime.connected('google-drive')`),false,'the added profile is not signed in to Drive');
  const databases=()=>b.evaluate(`indexedDB.databases().then(rows=>rows.map(row=>row.name))`);
  await waitFor(async()=>(await databases()).some(name=>name.endsWith(added.scope)),{label:'the added profile has its own database'});

  await b.evaluate(`setTimeout(()=>__PWA6.Profiles.switchTo(${JSON.stringify(original)}),0)`);
  await sleep(1500);await reopen(b,'B back in the first profile');
  assert.equal(await b.evaluate(`__PWA6.Profiles.current().id`),original);
  assert.match(await noteText(b,'ethics')||'',/Edited on A/u,'the first profile keeps its notes');

  await b.evaluate(`setTimeout(()=>__PWA6.Profiles.switchTo(${JSON.stringify(added.id)}),0)`);
  await sleep(1500);await reopen(b,'B in the added profile again');
  await b.evaluate(`setTimeout(()=>__PWA6.Profiles.remove(),0)`);
  await sleep(1500);await reopen(b,'B after removing the added profile');
  assert.equal(await b.evaluate(`__PWA6.Profiles.current().id`),original,'removing opens the profile it came from');
  assert.deepEqual(await b.evaluate(`__PWA6.Profiles.list().map(row=>row.id)`),[original],'the removed profile is gone from the list');
  await waitFor(async()=>!(await databases()).some(name=>name.endsWith(added.scope)),{label:'the removed profile\'s database is deleted',timeout:20000});
  assert.match(await noteText(b,'ethics')||'',/Edited on A/u,'the remaining profile is untouched');

  assert.deepEqual(faults,[],'every Drive request was well formed');
  const errors=[...a.events,...b.events].filter(event=>/startup\.initialize|Uncaught/u.test(String(event.text||'')));
  assert.deepEqual(errors.map(event=>String(event.text).slice(0,200)),[],'no start-up or uncaught errors');
  console.log(JSON.stringify({status:'PASS',commits:commits(),requests:drive.state.requests.length}));
}catch(error){
  console.error(JSON.stringify({faults:faults.slice(0,10),drive:ledger.slice(-40)},null,1));
  throw error;
}finally{
  await first.close();await second.close();await server.close();
}
