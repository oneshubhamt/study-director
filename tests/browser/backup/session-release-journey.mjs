import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitFor} from '../../helpers/browser-harness.mjs';
import {connect,sync,sleep,drive} from '../../helpers/drive-browser.mjs';
import {journeyLog,openDevice,hold,versionUpload,runSession,view,upload,settled,continueHere,stopsWithin,noReviews,explain,elsewhere} from '../../helpers/sync-journey-world.mjs';

// Continue Here on the laptop while its copy of the session cannot reach
// Drive for a while (on 2026-11-09 a leftover cleanup mark held it back for
// 2.5 minutes). The phone sees the claim and stops its timer at once; until
// the laptop's copy lands, its screen keeps the stopped time, however often
// it is redrawn. Once the copy is on Drive the phone lets go by itself,
// with no Sync now and no return from the background, and nothing is kept
// for review on either device.
const {steps,step}=journeyLog('session-release-journey');
const server=await startReleaseServer();
const phoneBrowser=await launchChromium({profilePrefix:'sd-release-a-'}),laptopBrowser=await launchChromium({profilePrefix:'sd-release-b-'});
let phone=null,laptop=null;
try{
  phone=await openDevice(phoneBrowser,server,'A');laptop=await openDevice(laptopBrowser,server,'B');
  await connect(phone,'A');await waitFor(async()=>!!(await sync(phone))?.syncedAt,{label:'phone synced',timeout:60000});await settled(phone,'A');
  await connect(laptop,'B');await waitFor(async()=>!!(await sync(laptop))?.syncedAt,{label:'laptop synced',timeout:60000});await upload(laptop);await settled(laptop,'B');
  assert.equal(await phone.evaluate(runSession('Day')),'running','the phone runs the day');
  await upload(phone);await settled(phone,'A');
  await elsewhere(laptop,'B');

  // The laptop's copy of the session is held back; its claim is not.
  const held=hold('B',versionUpload);
  const continueMs=await continueHere(laptop,'B');
  const stopMs=await stopsWithin(phone,'A');
  // Stopped means stopped on screen too: going to Library and back to
  // Execute shows the same time, as does a redraw in place.
  const first=(await view(phone)).countdown;await sleep(3000);
  await phone.evaluate(`(async()=>{await __PWA6.goTab('library');await new Promise(r=>setTimeout(r,1500));})()`);
  const second=(await view(phone)).countdown;
  assert.equal(second,first,`the phone's stopped timer does not move when Execute is shown again (${first} then ${second})`);
  step('phone stops on the claim',{continueHereMs:continueMs,stopMs,shown:first});

  // The copy lands; the phone lets go by itself.
  await waitFor(()=>held.reached,{label:'the laptop tried to upload its copy',timeout:60000});
  // Long enough for the laptop's request to time out and be retried while
  // the first one is still on its way (a slow connection).
  await sleep(Number(process.env.SD_RELEASE_HOLD_MS)||75000);held.release();
  const released=Date.now();
  await waitFor(async()=>(await view(phone)).panel==='Running on Another Device',{label:'the phone lets go by itself once the laptop\'s copy is on Drive',timeout:90000});
  const releaseMs=Date.now()-released;
  assert.equal((await view(laptop)).mode,'running','the laptop keeps running the session');
  // A running timer saves its progress each minute: flush it, as a device going to the background would.
  await upload(laptop);await settled(laptop,'B');await settled(phone,'A');
  await noReviews([['A',phone],['B',laptop]],'after the handoff');
  step('phone lets go by itself',{releaseMs});
  console.log(JSON.stringify({status:'PASS',suite:'session-release-journey',steps}));
}catch(error){
  try{await explain([['A',phone],['B',laptop]]);}catch{}
  console.error('marks on Drive',JSON.stringify([...drive.state.files.values()].filter(file=>['publication','maintenance'].includes(file.appProperties?.studyDirectorRepositoryKind)).map(file=>({kind:file.appProperties.studyDirectorRepositoryKind,created:file.createdTime,modified:file.modifiedTime,props:file.appProperties}))));
  throw error;
}finally{await phoneBrowser.close();await laptopBrowser.close();await server.close();}
