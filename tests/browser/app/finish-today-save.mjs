import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitFor} from '../../helpers/browser-harness.mjs';
import {open,sleep} from '../../helpers/drive-browser.mjs';
import {runSession} from '../../helpers/sync-journey-world.mjs';

// Finish Today, write the reflection, then Save Today (owner, 2026-11-26, F33).
// The save queues the reflection for the session while it holds the session's
// writes, so that write is refused; the save then drops it (the reflection is
// in the Saved Day). Its failure stayed behind: "the session could not be
// saved", Save Reflection failed, and Review could not be left. Now the
// dropped write's failure goes with it.
const server=await startReleaseServer(),browser=await launchChromium({profilePrefix:'sd-finish-save-'});
const status=page=>page.evaluate(`document.getElementById('save-status')?.textContent||''`);
try{
  const page=await open(browser,server,'A');
  assert.equal(await page.evaluate(runSession('Day')),'running');
  await sleep(1500);
  await page.evaluate(`(()=>{window.__accept=setInterval(()=>{const d=document.getElementById('sd-interaction-dialog');if(d&&d.open)d.querySelector('.interaction-actions .primary,.interaction-actions .danger')?.click();},50);__PWA6.goTab('execute');document.querySelector('.pane.on [data-action="finish-session"]').click();})()`);
  await waitFor(()=>page.evaluate(`document.getElementById('pane-review').classList.contains('on')`),{label:'Finish Today opens Review'});
  await page.evaluate(`clearInterval(window.__accept)`);
  const editable='.pane.on .sd-rte[data-sd-rich-surface="reflection"] [contenteditable="true"]';
  await waitFor(()=>page.evaluate(`!!document.querySelector(${JSON.stringify(editable)})&&!document.getElementById('daily-reflection').disabled`),{label:'the reflection editor'});
  await page.click(editable);
  await page.send('Input.insertText',{text:'Mock done'});
  // A pause, so the save's own reflection write runs while it holds the session.
  await sleep(3000);
  await page.click('.pane.on [data-action="save-day"]');
  await waitFor(async()=>/^✓ Saved /u.test(await status(page)),{label:'the day is saved',timeout:20000});
  const day=await page.evaluate(`__PWA6.todayISO()`);
  assert.match(await page.evaluate(`__PWA6.AppData.dailyRecords.get(${JSON.stringify(day)}).then(r=>String(r&&r.reflection||''))`),/Mock done/u,'the Saved Day holds the reflection');
  assert.equal(await page.evaluate(`__PWA6.AppData.activeSession.load().then(r=>r.value)`),null,'the finished session closes with the save');
  assert.equal(await page.evaluate(`__PWA6.ReviewEditor.settled().then(()=>'settled',e=>e.message)`),'settled','no reflection write is left failing');
  await sleep(2500);
  assert.match(await status(page),/^✓ Saved /u,'the save’s message stays');
  await page.evaluate(`__PWA6.goTab('plan')`);
  await waitFor(()=>page.evaluate(`document.getElementById('pane-plan').classList.contains('on')`),{label:'Review can be left',timeout:5000});
  await page.evaluate(`__PWA6.goTab('review')`);
  await waitFor(()=>page.evaluate(`!document.getElementById('daily-reflection').disabled`),{label:'Today Reflection loads'});
  await page.evaluate(`__PWA6.saveDayRecord()`);
  await waitFor(async()=>/Reflection saved in Diary/u.test(await status(page)),{label:'Save Reflection saves',timeout:5000});
  console.log(JSON.stringify({status:'PASS',suite:'finish-today-save',checks:['reflection in the Saved Day','session closed','nothing left failing','Review can be left','Save Reflection saves']}));
}finally{await browser.close();await server.close();}
