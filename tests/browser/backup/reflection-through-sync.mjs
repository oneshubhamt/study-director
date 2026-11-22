import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitFor} from '../../helpers/browser-harness.mjs';
import {sync,connect} from '../../helpers/drive-browser.mjs';
import {openDevice,upload,settled,journeyLog} from '../../helpers/sync-journey-world.mjs';

// Today's reflection written on another device, on a day with no study
// session (owner, 2026-11-22). Before each sync a device saves what its Review
// field holds. The phone had not opened Review that day, so its field was
// empty and had never loaded the stored reflection; it saved that empty text
// as an edit. Once the laptop's reflection had arrived, the save was refused
// ("changed elsewhere") and every later sync on the phone stopped. Now only an
// edit made on the device is saved before a sync.
const {steps,step}=journeyLog('reflection-through-sync');
const server=await startReleaseServer();
const laptopBrowser=await launchChromium({profilePrefix:'sd-reflection-sync-a-'}),phoneBrowser=await launchChromium({profilePrefix:'sd-reflection-sync-b-'});
const stored=(page,date)=>page.evaluate(`__PWA6.AppData.dailyRecords.get(${JSON.stringify(date)}).then(r=>r?String(r.reflection||''):null)`);
const write=(page,date,text)=>page.evaluate(`__PWA6.DailyReflectionPersistence.commit(${JSON.stringify(date)},${JSON.stringify(text)},{}).then(saved=>saved.canonical)`);
const refusals=page=>page.warnings.filter(text=>/changed elsewhere/u.test(text)).length;
// A sync the device runs now; it must finish, not fall behind.
async function syncs(page,label){
  const before=(await sync(page))?.syncedAt||'';
  await page.evaluate(`__PWA6.BackupProviderRuntime.scheduleSharedSync('google-drive','qa-reflection')`);
  await waitFor(async()=>{const state=await sync(page);return !!state?.syncedAt&&state.syncedAt!==before&&state.behind===false;},{label:`${label}: the sync finishes`,timeout:60000});
  await settled(page,label);
}
async function sends(page,label){await upload(page);await settled(page,label);}
let laptop=null,phone=null;
try{
  laptop=await openDevice(laptopBrowser,server,'A');phone=await openDevice(phoneBrowser,server,'B');
  await connect(laptop,'A');await waitFor(async()=>!!(await sync(laptop))?.syncedAt,{label:'laptop synced',timeout:60000});await settled(laptop,'A');
  await connect(phone,'B');await waitFor(async()=>!!(await sync(phone))?.syncedAt,{label:'phone synced',timeout:60000});await settled(phone,'B');
  const today=await phone.evaluate(`__PWA6.todayISO()`);
  assert.equal(await phone.evaluate(`__PWA6.AppData.activeSession.load().then(r=>r.value)`),null,'no study session on the phone');

  // The phone has not opened Review today.
  await write(laptop,today,'From the laptop');await sends(laptop,'A');
  await syncs(phone,'B');
  assert.equal(await stored(phone,today),'From the laptop','the laptop’s reflection arrives');
  await write(laptop,today,'From the laptop, edited');await sends(laptop,'A');
  await syncs(phone,'B');
  assert.equal(await stored(phone,today),'From the laptop, edited','the next sync brings the edit too');
  await syncs(phone,'B');
  assert.equal(refusals(phone),0,'the phone never saved its unopened field');
  step('Review never opened: every sync finishes');

  // The phone opens Review, then goes elsewhere; the laptop edits twice.
  await phone.evaluate(`__PWA6.goTab('review')`);
  await waitFor(()=>phone.evaluate(`!document.getElementById('daily-reflection').disabled&&/edited/u.test(String(__PWA6.ReviewEditor.contentForDate(${JSON.stringify(today)})))`),{label:'the phone’s Review loads the reflection',timeout:20000});
  await phone.evaluate(`__PWA6.goTab('plan')`);
  await write(laptop,today,'From the laptop, third');await sends(laptop,'A');
  await syncs(phone,'B');
  await write(laptop,today,'From the laptop, fourth');await sends(laptop,'A');
  await syncs(phone,'B');
  assert.equal(await stored(phone,today),'From the laptop, fourth');
  assert.equal(refusals(phone),0,'the phone never saved the field it had loaded');
  await phone.evaluate(`__PWA6.goTab('review')`);
  await waitFor(()=>phone.evaluate(`/fourth/u.test(String(__PWA6.ReviewEditor.contentForDate(${JSON.stringify(today)})))`),{label:'Review shows the latest reflection',timeout:20000});
  step('Review opened earlier: every sync finishes, and Review shows the latest');

  // Typing on the phone is still saved before its sync, and reaches the laptop.
  const editable='.pane.on .sd-rte[data-sd-rich-surface="reflection"] [contenteditable="true"]';
  await waitFor(()=>phone.evaluate(`!!document.querySelector(${JSON.stringify(editable)})`),{label:'reflection editor'});
  await phone.click(editable);
  await phone.evaluate(`(()=>{const surface=document.querySelector(${JSON.stringify(editable)}),range=document.createRange();range.selectNodeContents(surface);range.collapse(false);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);})()`);
  await phone.send('Input.insertText',{text:' and the phone'});
  await syncs(phone,'B');
  assert.match(await stored(phone,today),/and the phone/u,'the typed words are saved');
  await sends(phone,'B');
  await syncs(laptop,'A');
  assert.match(await stored(laptop,today),/fourth[\s\S]*and the phone/u,'and reach the laptop');
  assert.equal(refusals(phone)+refusals(laptop),0);
  step('typing on the phone is saved and reaches the laptop');
  console.log(JSON.stringify({status:'PASS',suite:'reflection-through-sync',steps}));
}finally{await laptopBrowser.close();await phoneBrowser.close();await server.close();}
