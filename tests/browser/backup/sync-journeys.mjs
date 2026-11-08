import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitFor} from '../../helpers/browser-harness.mjs';
import {faults,ledger,hooks,sync,connect,uploadsBy,sleep} from '../../helpers/drive-browser.mjs';
import {shot,journeyLog,openDevice,hold,versionUpload,setOffline,freeze,thaw,runSession,view,noteOf,writeNote,upload,syncNow,settled,continueHere,stopsWithin,markDone,owner,running,elsewhere,bothSettled,noReviews,keeps,explain,holds} from '../../helpers/sync-journey-world.mjs';

// Sync journeys, part 1: a laptop (A) and a phone (B) share one simulated
// Google Drive. A first sync that waits for another device's upload (Sync
// now on the Connect card), then the day's session moved between them while
// the other device is mid-upload, offline or frozen in the background, and
// a pause and a resume that reach the other device by themselves.
// Part 2 is session-handoff-journeys.mjs; the helpers say what each checks.

const {steps,step}=journeyLog('sync-journeys');
const server=await startReleaseServer();
const laptop=await launchChromium({profilePrefix:'sd-journey-a-'}),phone=await launchChromium({profilePrefix:'sd-journey-b-'});
let a=null,b=null;
try{
  a=await openDevice(laptop,server,'A');b=await openDevice(phone,server,'B');

  // Journey 1. First sync on a new phone while the laptop is mid-upload.
  // The phone brings Drive's latest in without waiting; only its own upload
  // waits its turn, and the Connect card then offers Sync now on that step's
  // line. Sync now uploads at once; the laptop's upload, overtaken, stops
  // before its commit, takes the phone's change in and uploads again.
  await connect(a,'A');await waitFor(async()=>!!(await sync(a))?.syncedAt,{label:'A synced',timeout:60000});await settled(a,'A');
  await writeNote(a,'from-laptop','written on the laptop');
  const laptopCommit=hold('A',versionUpload);void upload(a);
  await waitFor(()=>laptopCommit.reached,{label:'the laptop is mid-upload',timeout:30000});
  await writeNote(b,'from-phone','written on the phone before connecting');
  // The phone connects with the Connect button, as a person does.
  await b.evaluate(`document.querySelector('[data-action="connect-drive-backup"]').click()`);
  await waitFor(()=>b.evaluate(`__PWA6.BackupProviderRuntime.connected('google-drive')`),{label:'B connects',timeout:20000});
  await waitFor(()=>b.evaluate(`(()=>{const link=document.querySelector('#drive-connect-steps .drive-connect-step-action');return !!link&&link.checkVisibility()&&link.textContent==='Sync now';})()`),{label:'the Connect card offers Sync now on the upload step',timeout:90000});
  const card=await b.evaluate(`(()=>{const root=document.getElementById('drive-connect-card'),steps=[...root.querySelectorAll('#drive-connect-steps li')].map(item=>({state:item.dataset.state,text:item.textContent})),link=root.querySelector('.drive-connect-step-action'),row=link.closest('li').getBoundingClientRect(),box=link.getBoundingClientRect();return {status:document.getElementById('drive-connect-status').textContent,steps,button:!document.getElementById('drive-connect-action').hidden,sameLine:Math.abs((box.top+box.bottom)/2-(row.top+row.bottom)/2)<2,rightAligned:Math.abs(row.right-box.right)<12};})()`);
  assert.match(card.status,/^Waiting for Linux · Chrome( \(since [^)]+\))? to finish saving…$/u,`the card names the device it waits for by type and browser (${card.status})`);
  assert.deepEqual(card.steps.map(row=>row.state),['done','done','waiting'],'Drive\'s latest is in; only the upload waits');
  assert.equal(card.button,false,'no separate button row: Sync now sits on the step\'s line');
  assert.equal(await b.evaluate(`document.getElementById('drive-connect-bar').hidden`),true,'nothing moves on the card while it only waits');
  assert.equal(card.sameLine&&card.rightAligned,true,'Sync now is on the waiting step\'s line, at its end');
  const cardBox=await b.evaluate(`(()=>{const r=document.getElementById('drive-connect-card').getBoundingClientRect();return {x:Math.max(0,r.left-8),y:Math.max(0,r.top-8),width:r.width+16,height:r.height+16};})()`);
  await b.screenshot(shot('connect-card-waiting-laptop'),cardBox);
  await b.setViewport({width:390,height:844,mobile:true,scale:2});await b.settle(4);
  const phoneBox=await b.evaluate(`(()=>{const r=document.getElementById('drive-connect-card').getBoundingClientRect();return {x:Math.max(0,r.left-8),y:Math.max(0,r.top-8),width:Math.min(innerWidth,r.width+16),height:r.height+16,overflow:document.documentElement.scrollWidth>innerWidth};})()`);
  assert.equal(phoneBox.overflow,false,'the card fits a phone screen');
  await b.screenshot(shot('connect-card-waiting-phone'),phoneBox);
  const phoneUploads=uploadsBy('B');
  await b.tap('#drive-connect-steps .drive-connect-step-action');
  await waitFor(()=>uploadsBy('B')>phoneUploads,{label:'Sync now uploads the phone\'s data at once',timeout:30000});
  const laptopCommits=uploadsBy('A');laptopCommit.release();
  await waitFor(()=>uploadsBy('A')>laptopCommits,{label:'the laptop uploads again after taking the phone\'s version in',timeout:90000});
  await waitFor(async()=>await noteOf(a,'from-phone')==='written on the phone before connecting',{label:'the laptop takes the phone\'s note in',timeout:90000});
  await settled(a,'A');await syncNow(b);await settled(b,'B');
  await waitFor(async()=>await noteOf(b,'from-laptop')==='written on the laptop',{label:'the phone has the laptop\'s note',timeout:90000});
  await b.setViewport({width:1365,height:900,mobile:false,scale:1});
  step('first sync waits, Sync now on the card',{status:card.status});

  // Journey 2. The laptop runs the session; the phone continues it.
  assert.equal(await a.evaluate(runSession('Day')),'running','the laptop starts the day');
  await upload(a);await settled(a,'A');await elsewhere(b,'B');
  let ms=await continueHere(b,'B');const idB=await owner(b);
  const stopA=await stopsWithin(a,'A');
  await bothSettled([['A',a],['B',b]],'handoff');await syncNow(a);await bothSettled([['A',a],['B',b]],'handoff');
  assert.equal(await running(b),true,'the phone keeps running the session');assert.equal(await owner(a),idB,'the laptop records the phone as the owner');
  await noReviews([['A',a],['B',b]],'handoff');
  step('handoff',{continueHereMs:ms,oldOwnerStopsMs:stopA});

  // Journey 3. The phone finishes a block and its upload is still in flight
  // (the final minutes) when the laptop presses Continue Here. Continue Here
  // does not wait for it; the phone's upload lands first, and the block
  // finished on the phone is taken in by the laptop, with no review.
  let held=hold('B',versionUpload);const phoneFinished=(await view(b)).current;await markDone(b);void upload(b);
  await waitFor(()=>held.reached,{label:'the phone is mid-upload with its finished block',timeout:30000});
  await elsewhere(a,'A');
  ms=await continueHere(a,'A');const idA=await owner(a);
  held.release();await stopsWithin(b,'B');
  await bothSettled([['A',a],['B',b]],'mid-upload');await syncNow(a);await bothSettled([['A',a],['B',b]],'mid-upload');
  const midUpload=await keeps(a,'the laptop',phoneFinished,'continue during the old owner\'s upload');
  assert.equal(await running(a),true,'the laptop keeps running');assert.equal(await owner(b),idA);
  await noReviews([['A',a],['B',b]],'mid-upload');
  step('continue while the old owner uploads',{continueHereMs:ms,lastBlock:midUpload});

  // Journey 4. The laptop goes offline with its timer running; the phone
  // continues. Back online, the laptop stops within one claim check.
  await syncNow(b);await settled(b,'B');await elsewhere(b,'B');
  await setOffline(a,'A',true);
  ms=await continueHere(b,'B');
  await sleep(3000);assert.equal((await view(a)).loop,true,'offline, the laptop cannot know yet');
  await setOffline(a,'A',false);const stopOffline=await stopsWithin(a,'A',40000);
  await bothSettled([['A',a],['B',b]],'offline');await syncNow(a);await bothSettled([['A',a],['B',b]],'offline');
  assert.equal(await running(b),true,'the phone keeps running');assert.equal(await owner(a),idB);
  await noReviews([['A',a],['B',b]],'offline');
  step('old owner offline',{continueHereMs:ms,stopsAfterOnlineMs:stopOffline});

  // Journey 5. The phone is frozen in the background with its timer running;
  // the laptop continues. When the phone wakes it stops, and changes nothing.
  await elsewhere(a,'A');
  await freeze(b);
  ms=await continueHere(a,'A');
  await sleep(4000);await thaw(b);const stopFrozen=await stopsWithin(b,'B',40000);
  await bothSettled([['A',a],['B',b]],'frozen');await syncNow(b);await bothSettled([['A',a],['B',b]],'frozen');
  assert.equal(await running(a),true,'the laptop keeps running');assert.equal(await owner(b),idA);
  await noReviews([['A',a],['B',b]],'frozen');
  step('old owner frozen',{continueHereMs:ms,stopsAfterWakeMs:stopFrozen});

  // Journey 6. A pause or resume reaches the other device by itself within
  // seconds: the laptop pauses (its app stays open, nothing flushes) and the
  // phone's Continue Here continues it paused, so the pause is not counted
  // as study; the phone resumes, and the laptop's Continue Here runs it.
  const pauseOn=page=>page.evaluate(`(async()=>{const d=__PWA6;d.goTab('execute');await new Promise(r=>setTimeout(r,80));d.togglePause();})()`);
  await pauseOn(a);assert.equal((await view(a)).mode,'paused','the laptop pauses');
  await sleep(8000);await elsewhere(b,'B');
  const pausedMs=await continueHere(b,'B',{mode:'paused'});await stopsWithin(a,'A');
  await pauseOn(b);assert.equal((await view(b)).mode,'running','the phone resumes');
  await sleep(8000);await elsewhere(a,'A');
  const resumedMs=await continueHere(a,'A');await stopsWithin(b,'B');
  await bothSettled([['A',a],['B',b]],'pause');await noReviews([['A',a],['B',b]],'pause');
  step('a pause and a resume reach the other device by themselves',{continueHereMs:[pausedMs,resumedMs]});

  // A change made while an upload runs goes out with the next flush (the
  // app going to the background), not at the next 20-minute cadence.
  await writeNote(a,'during-upload-1','first change');
  const heldUpload=hold('A',versionUpload),first=a.evaluate(`__PWA6.BackupProviderRuntime.flushAutomatic('app-hidden')`);
  await waitFor(()=>heldUpload.reached,{label:'the laptop is uploading its first change',timeout:30000});
  await writeNote(a,'during-upload-2','made while the upload ran');
  const second=a.evaluate(`__PWA6.BackupProviderRuntime.flushAutomatic('app-hidden')`);
  heldUpload.release();await first;await second;
  await syncNow(b);await waitFor(async()=>await noteOf(b,'during-upload-2')==='made while the upload ran',{label:'the change made during the upload reaches the phone with that flush',timeout:30000});
  step('a change made during an upload goes out with the next flush');

  for(const page of [a,b])assert.deepEqual(page.warnings.filter(text=>/\[Study Director\]/u.test(text)),[]);
  assert.deepEqual(faults,[],'every request reached the simulated Drive or failed on purpose');
  console.log(JSON.stringify({status:'PASS',suite:'sync-journeys',journeys:steps.length,steps}));
}catch(error){console.error(ledger.slice(-40).join('\n'));await explain([['A',a],['B',b]]);throw error;}
finally{for(const entry of [...holds])entry.release();hooks.before=null;await laptop.close();await phone.close();await server.close();}
