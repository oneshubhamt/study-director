import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitFor} from '../../helpers/browser-harness.mjs';
import {preload,sleep} from '../../helpers/drive-browser.mjs';
import {openDevice,runSession,markDone} from '../../helpers/sync-journey-world.mjs';

// A day saved at night is not asked about again the next morning. Save Today
// keeps the session (it may carry on), and the next start retires it quietly
// when the Saved Day holds all its work. Until 2026-11-12 it asked "Previous
// study day needs review" almost every morning: closing the app counted as a
// change made after the save, the block running or paused at the save had a
// different end in the session than in the Saved Day, and a timer left
// running kept adding time until a fixed Sleep block stopped it (Save Today
// now pauses it). Work done after the save is still asked about.
const server=await startReleaseServer();
const nextDay=`(()=>{const off=86400000;const Real=Date;class Skewed extends Real{constructor(...args){super(...(args.length?args:[Real.now()+off]));}static now(){return Real.now()+off;}}globalThis.Date=Skewed;})();`;
const dialogText=page=>page.evaluate(`(()=>{const dialog=document.getElementById('sd-interaction-dialog');return dialog&&dialog.open?dialog.textContent.replace(/\\s+/g,' '):'';})()`).catch(()=>'');
const started=page=>page.evaluate(`!!window.__PWA6&&__PWA6.StartupLifecycle.status().fullyInitialized`).catch(()=>false);
const cases=[
  // Save Today pauses a running timer (owner's choice, 2026-11-12): no time
  // is added after the save, until a fixed Sleep block or the app closing.
  ['Save Today while the timer runs, then close',async page=>{assert.equal(await page.evaluate(`__PWA6.saveDayRecord()`),true);
    assert.equal(await page.evaluate(`__PWA6.TimerState.snapshot().mode`),'paused','Save Today pauses the running timer');},false],
  ['pause, Save Today, close',async page=>{await page.evaluate(`(async()=>{__PWA6.togglePause();await new Promise(r=>setTimeout(r,500));})()`);assert.equal(await page.evaluate(`__PWA6.saveDayRecord()`),true);},false],
  ['Save Today, then finish the block, close',async page=>{assert.equal(await page.evaluate(`__PWA6.saveDayRecord()`),true);await markDone(page);},true],
];
const results={};
try{
  for(const [name,act,asks] of cases){
    const browser=await launchChromium({profilePrefix:'sd-next-morning-'});
    try{
      let page=await openDevice(browser,server,'A');
      assert.equal(await page.evaluate(runSession('Day')),'running');await sleep(3000);
      await act(page);
      await browser.closePage(page);await sleep(500);
      // The next morning (the start-up waits for the person's answer if it asks).
      page=await browser.createPage(server.url('deployment','instrumented.html'),{preload:nextDay+preload});
      let text='';
      await waitFor(async()=>!!(text=await dialogText(page))||await started(page),{label:`${name}: the next start`,timeout:30000});
      if(!text){await sleep(2000);text=await dialogText(page);}
      const asked=/Previous study day needs review/u.test(text);
      assert.equal(asked,asks,`${name}: ${asks?'work after the save is asked about':'a saved day is not asked about again'}`);
      if(!asks){
        const stored=await page.evaluate(`(async()=>!!(await __PWA6.AppData.activeSession.load()).value)()`);
        assert.equal(stored,false,`${name}: the saved day's session is retired`);
      }
      results[name]=asked?'asks':'quiet';
    }finally{await browser.close();}
  }
  console.log(JSON.stringify({status:'PASS',suite:'next-morning-saved-day',results}));
}finally{await server.close();}
