import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitForStudyDirector,waitFor} from '../../helpers/browser-harness.mjs';
import {preload,attachDrive,connect,sync,sleep} from '../../helpers/drive-browser.mjs';
import {journeyLog,openDevice,hold,runSession,view,upload,settled,elsewhere,continueHere} from '../../helpers/sync-journey-world.mjs';

// The owner's morning (2026-11-22): the day began on the phone, which ran its
// first block, then went to sleep; the laptop continued the day and saved it.
// The phone, waking after 04:00, held its own copy of the day with a little
// timer time and asked "Previous study day needs review" before it could see
// the laptop's save. Its Drive sign-in had ended overnight (Google gives an
// hour, renewed only by a tap), so it could not look. Now the question offers
// that tap first: Check Google Drive first signs in and syncs, and the
// laptop's Saved Day covers the copy, which clears with no second question.
// (A device still signed in syncs before asking at all:
// tests/integration/app/previous-day-question.mjs.)
const {steps,step}=journeyLog('morning-after-handoff');
const server=await startReleaseServer();
const laptopBrowser=await launchChromium({profilePrefix:'sd-handoff-am-a-'}),phoneBrowser=await launchChromium({profilePrefix:'sd-handoff-am-b-'});
// The phone's clock moves on when it wakes.
const movableClock=`(()=>{const Real=Date;globalThis.__clockOffsetMs=0;class Skewed extends Real{constructor(...args){super(...(args.length?args:[Real.now()+globalThis.__clockOffsetMs]));}static now(){return Real.now()+globalThis.__clockOffsetMs;}}globalThis.Date=Skewed;})();`;
const asked=page=>page.evaluate(`(()=>{const d=document.getElementById('sd-interaction-dialog');return !!(d&&d.open&&/Previous study day needs review/u.test(d.textContent));})()`).catch(()=>false);
const stored=page=>page.evaluate(`__PWA6.AppData.activeSession.load().then(r=>r.value?r.value.date:null)`);
const savedDay=(page,date)=>page.evaluate(`__PWA6.AppData.dailyRecords.get(${JSON.stringify(date)}).then(r=>r?{sourceRevision:r.sourceRevision,seconds:Object.values(r.results||{}).reduce((sum,x)=>sum+(Number(x.actualSeconds)||0),0)}:null)`);
let laptop=null,phone=null;
try{
  laptop=await openDevice(laptopBrowser,server,'A');
  phone=await phoneBrowser.createPage(server.url('deployment','instrumented.html'),{preload:movableClock+preload});
  await attachDrive(phone,'B');await waitForStudyDirector(phone,{instrumented:true});
  await waitFor(()=>phone.evaluate(`__PWA6.AppOwnership.status().hasControl`),{label:'B: ownership'});
  await connect(laptop,'A');await waitFor(async()=>!!(await sync(laptop))?.syncedAt,{label:'laptop synced',timeout:60000});await settled(laptop,'A');
  await connect(phone,'B');await waitFor(async()=>!!(await sync(phone))?.syncedAt,{label:'phone synced',timeout:60000});await settled(phone,'B');

  assert.equal(await phone.evaluate(runSession('Day')),'running','the phone begins the day');
  const day=await phone.evaluate(`__PWA6.todayISO()`);
  await sleep(3000);await upload(phone);await settled(phone,'B');
  step('the phone runs its first block');

  // The phone sleeps: nothing it sends reaches Drive, so it never sees the
  // laptop take the day over.
  const asleep=hold('B',()=>true);
  await elsewhere(laptop,'A');await continueHere(laptop,'A');
  await sleep(3000);
  assert.equal(await laptop.evaluate(`__PWA6.saveDayRecord()`),true,'the laptop saves the day');
  await upload(laptop);await settled(laptop,'A');
  const laptopDay=await savedDay(laptop,day);
  assert.ok(laptopDay&&laptopDay.seconds>0,'with the day’s work');
  step('the laptop continues the day and saves it');

  // The phone wakes the next morning, its copy still its own and its Drive
  // sign-in over.
  assert.equal(await stored(phone),day);
  await phone.evaluate(`globalThis.__clockOffsetMs=86400000`);
  await waitFor(()=>phone.evaluate(`__PWA6.todayISO()!==${JSON.stringify(day)}`),{label:'the phone’s day rolls over',timeout:15000});
  asleep.release();
  const offers=page=>page.evaluate(`(()=>{const d=document.getElementById('sd-interaction-dialog');return !!(d&&d.open&&[...d.querySelectorAll('button')].some(b=>b.textContent.trim().startsWith('Check Google Drive first')));})()`);
  await waitFor(()=>offers(phone),{label:'the phone offers to check Google Drive first',timeout:30000});
  assert.equal(await phone.evaluate(`__PWA6.BackupProviderRuntime.locationStatus('google-drive').connected`),false,'it is signed out');
  await phone.evaluate(`[...document.getElementById('sd-interaction-dialog').querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('Check Google Drive first')).click()`);
  let askedAgain=false;
  await waitFor(async()=>{askedAgain=askedAgain||await asked(phone);return askedAgain||(await stored(phone)===null&&!!await savedDay(phone,day));},{label:'one tap: the phone signs in, syncs and clears its copy',timeout:60000});
  for(let i=0;i<12&&!askedAgain;i++){await sleep(250);askedAgain=await asked(phone);}
  assert.equal(askedAgain,false,'no second question: the laptop’s save covers the copy');
  assert.equal(await stored(phone),null,'its copy is cleared');
  assert.deepEqual(await savedDay(phone,day),laptopDay,'and it holds the laptop’s Saved Day, unchanged');
  await settled(phone,'B');
  assert.deepEqual((await view(phone)).reviews,[],'nothing is kept for review');
  step('the phone wakes signed out; one tap checks Drive and clears its copy');
  console.log(JSON.stringify({status:'PASS',suite:'morning-after-handoff',steps}));
}finally{await laptopBrowser.close();await phoneBrowser.close();await server.close();}
