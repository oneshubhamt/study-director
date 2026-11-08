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

  // One status indicator replaces the sidebar's sync line: the sidebar name and
  // the phone circle both show Synced (docs/areas/status-indicator.md).
  await waitFor(()=>a.evaluate(`['profile-tag','profile-badge'].every(id=>document.getElementById(id).dataset.ring==='synced')`),{label:'A shows the synced ring',timeout:20000});
  assert.match(await a.evaluate(`document.getElementById('profile-tag').getAttribute('aria-label')`),/· Synced \d/u,'the sidebar name says when it synced');
  assert.equal(await a.evaluate(`!!document.getElementById('sb-sync')`),false,'the sidebar sync line is gone');

  // A reload keeps the sign-in: connected again without asking Google.
  await a.reload();await reopen(a,'A after reload');
  await waitFor(()=>a.evaluate(`__PWA6.BackupProviderRuntime.connected('google-drive')`),{label:'A still signed in after reload',timeout:20000});
  assert.equal(await a.evaluate(`window.__gisTokenRequests||0`),0,'the reload asked Google for no new sign-in');

  // B: the same profile on another device. Connecting brings A's note. B
  // connects with the Connect button, and the Connect card follows its first
  // sync on any tab: signed in, bringing in A's changes, uploading, Synced.
  const b=await open(second,server,'B');
  assert.equal(await noteText(b,'ethics'),null,'B starts without the note');
  await b.evaluate(`(()=>{window.__connectCard=[];const card=document.getElementById('drive-connect-card'),seen=()=>{if(card.hidden)return;const row=[card.dataset.tone,document.getElementById('drive-connect-status').textContent,[...card.querySelectorAll('#drive-connect-steps li')].map(item=>item.dataset.state).join(',')].join('|');if(window.__connectCard.at(-1)!==row)window.__connectCard.push(row);};new MutationObserver(seen).observe(card,{subtree:true,childList:true,attributes:true,characterData:true});__PWA6.goTab('plan');document.querySelector('[data-action="connect-drive-backup"]').click();seen();})()`);
  await waitFor(()=>b.evaluate(`__PWA6.BackupProviderRuntime.connected('google-drive')`),{label:'B connects',timeout:20000});
  await waitFor(async()=>/Written on A/u.test(await noteText(b,'ethics')||''),{label:'B receives A\'s note',timeout:60000});
  await waitFor(async()=>!!(await sync(b))?.syncedAt,{label:'B synced',timeout:30000});
  await waitFor(()=>b.evaluate(`document.getElementById('drive-connect-card').dataset.tone==='done'`),{label:'the Connect card says Synced',timeout:90000});
  const connectCard=await b.evaluate(`({rows:window.__connectCard,steps:[...document.querySelectorAll('#drive-connect-steps li')].map(item=>item.textContent),status:document.getElementById('drive-connect-status').textContent,inRegion:document.getElementById('drive-connect-card').parentElement.id})`);
  assert.equal(connectCard.inRegion,'sd-toast-region','the card sits in the notification area');
  assert.ok(connectCard.rows.some(row=>/^working\|Signing in/u.test(row)),`the card starts at sign-in (${connectCard.rows.join(' / ')})`);
  assert.ok(connectCard.rows.some(row=>/^working\|Bringing in changes from Google Drive…\|done,active,pending$/u.test(row)),`the card shows the catch-up step (${connectCard.rows.join(' / ')})`);
  assert.ok(connectCard.rows.some(row=>/^working\|Uploading this device’s data…\|done,done,active$/u.test(row)),`the card shows the upload step (${connectCard.rows.join(' / ')})`);
  assert.match(connectCard.status,/^Synced at \d/u,'the card ends Synced');
  assert.deepEqual(connectCard.steps,['Signed in to Google','Brought in changes from Google Drive','Uploaded this device’s data']);
  await waitFor(()=>b.evaluate(`document.getElementById('drive-connect-card').hidden`),{label:'the Connect card closes on its own',timeout:12000});

  // B's first sync uploads what it brought (its own first-start settings),
  // and Drive cleanup may follow. Both finish before A edits.
  await waitFor(async()=>!markers()&&!await waiting(b),{label:'B settles',timeout:90000});

  // Library → Data offers Recheck only for a connected location; Recheck
  // answers at once in its own row and then shows the result there.
  await b.evaluate(`(async()=>{__PWA6.goTab('library');await new Promise(r=>setTimeout(r,150));document.getElementById('library-tab-data').click();})()`);
  await waitFor(()=>b.evaluate(`!document.getElementById('recheck-google-drive').hidden`),{label:'B offers Recheck Google Drive',timeout:20000});
  assert.equal(await b.evaluate(`document.getElementById('recheck-device-folder').hidden&&getComputedStyle(document.getElementById('recheck-device-folder')).display==='none'`),true,'Recheck Device Folder must not be offered without a Device Folder');
  await b.evaluate(`document.getElementById('recheck-google-drive').click()`);
  assert.equal(await b.evaluate(`document.getElementById('recheck-google-drive').textContent`),'Rechecking…','Recheck answers at once');
  await waitFor(()=>b.evaluate(`/^Google Drive: All backup files intact/u.test(document.getElementById('drive-verification-status').textContent)&&document.getElementById('recheck-google-drive').textContent==='Recheck Google Drive'`),{label:'B shows the recheck result',timeout:60000});

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
