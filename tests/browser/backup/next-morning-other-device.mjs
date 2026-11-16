import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitFor} from '../../helpers/browser-harness.mjs';
import {preload,attachDrive,connect,sync,sleep} from '../../helpers/drive-browser.mjs';
import {journeyLog,openDevice,runSession,view,upload,settled,elsewhere} from '../../helpers/sync-journey-world.mjs';

// The laptop runs and saves the day; the phone showed it running elsewhere
// and was closed before the save. The next morning the phone's Drive
// sign-in has expired, so it cannot see the save yet. It asked "Previous
// study day needs review" every morning (owner, 2026-11-12). Now only the
// device that ran the session asks: the phone keeps its copy quietly, says
// where the day ran, and clears it once a sync shows the day saved.
const {steps,step}=journeyLog('next-morning-other-device');
const server=await startReleaseServer();
const laptopBrowser=await launchChromium({profilePrefix:'sd-morning-a-'}),phoneBrowser=await launchChromium({profilePrefix:'sd-morning-b-'});
const nextDay=`(()=>{const off=86400000;const Real=Date;class Skewed extends Real{constructor(...args){super(...(args.length?args:[Real.now()+off]));}static now(){return Real.now()+off;}}globalThis.Date=Skewed;})();`;
const dialogText=page=>page.evaluate(`(()=>{const dialog=document.getElementById('sd-interaction-dialog');return dialog&&dialog.open?dialog.textContent.replace(/\\s+/g,' '):'';})()`).catch(()=>'');
const stored=page=>page.evaluate(`(async()=>!!(await __PWA6.AppData.activeSession.load()).value)()`);
const savedDays=page=>page.evaluate(`(async()=>(await __PWA6.AppData.dailyRecords.list()).length)()`);
async function nextMorning(browser,who){
  const page=await browser.createPage(server.url('deployment','instrumented.html'),{preload:nextDay+preload});await attachDrive(page,who);
  let asked='';
  await waitFor(async()=>!!(asked=await dialogText(page))||await page.evaluate(`!!window.__PWA6&&__PWA6.StartupLifecycle.status().fullyInitialized`).catch(()=>false),{label:`${who}: the next start`,timeout:45000});
  await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().hasControl`),{label:`${who}: ownership`}).catch(()=>{});
  await sleep(2000);asked=asked||await dialogText(page);
  return {page,asked:/Previous study day needs review/u.test(asked)};
}
let laptop=null,phone=null;
try{
  laptop=await openDevice(laptopBrowser,server,'A');phone=await openDevice(phoneBrowser,server,'B');
  await connect(laptop,'A');await waitFor(async()=>!!(await sync(laptop))?.syncedAt,{label:'laptop synced',timeout:60000});await settled(laptop,'A');
  await connect(phone,'B');await waitFor(async()=>!!(await sync(phone))?.syncedAt,{label:'phone synced',timeout:60000});await upload(phone);await settled(phone,'B');
  assert.equal(await laptop.evaluate(runSession('Day')),'running','the laptop runs the day');
  await upload(laptop);await settled(laptop,'A');await elsewhere(phone,'B');await settled(phone,'B');await sleep(2000);await settled(phone,'B');
  await phoneBrowser.closePage(phone);phone=null;
  assert.equal(await laptop.evaluate(`__PWA6.saveDayRecord()`),true,'the laptop saves the day');
  await upload(laptop);await settled(laptop,'A');await laptopBrowser.closePage(laptop);laptop=null;
  step('the laptop saved the day after the phone closed');

  const morningPhone=await nextMorning(phoneBrowser,'B');phone=morningPhone.page;
  assert.equal(morningPhone.asked,false,'the phone does not ask about a day another device ran');
  assert.equal(await stored(phone),true,'and keeps its copy until a sync shows the day saved');
  assert.equal((await view(phone)).panel,'Previous Day from Another Device','Execute says where the day ran');
  await connect(phone,'B');
  await waitFor(async()=>await savedDays(phone)===1&&!await stored(phone),{label:'after its sync the phone holds the Saved Day and clears its copy',timeout:90000});
  step('the phone stays quiet and clears its copy after its sync');

  const morningLaptop=await nextMorning(laptopBrowser,'A');laptop=morningLaptop.page;
  assert.equal(morningLaptop.asked,false,'the laptop, which saved the day, does not ask either');
  step('the laptop is quiet too');
  console.log(JSON.stringify({status:'PASS',suite:'next-morning-other-device',steps}));
}finally{await laptopBrowser.close();await phoneBrowser.close();await server.close();}
