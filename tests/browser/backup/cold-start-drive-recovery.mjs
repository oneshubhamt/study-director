import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitFor} from '../../helpers/browser-harness.mjs';
import {faults,ledger,noteText,sync,open,connect,markers,waiting} from '../../helpers/drive-browser.mjs';
import {LOCAL_STORAGE_KEYS} from '../../../contracts/data-architecture.mjs';

// The browser removes the database while the app is closed (Chrome can evict
// a site's database this way) on a device synced with Google Drive. The next
// start shows "Browser data was cleared" and pauses uploads. Once Drive is
// connected, whether the sign-in was kept from before or the person signs in
// again, the whole library comes back by itself (notes and saved plans
// included) and the pause lifts. Before the fix the pause also held back
// the sync, so nothing came back until the person answered the notice.

const server=await startReleaseServer(),browser=await launchChromium({profilePrefix:'sd-cold-drive-'});
const notice=`!!__PWA6.NoticeCoordinator.readEvent('storage-reset','detected')`;
const plans=page=>page.evaluate(`__PWA6.AppData.planData.read().then(value=>value.savedPlans.map(plan=>plan.label))`);
const save=(page,text)=>page.evaluate(`(async()=>{const d=__PWA6,now=new Date().toISOString(),notes=d.AppData.notes;notes.update('ethics','Ethics',${JSON.stringify(text)},notes.get('ethics')?.updatedAt||'');await notes.flush({strict:true});
  await d.AppData.planData.writeLibrary({savedPlans:[{id:'plan-coldstart',label:${JSON.stringify(text+' plan')},scheduleText:'07:00 | 30 | Work | work | Ethics | block | 1',createdAt:now,updatedAt:now}],defaultId:null});})()`);
const settled=page=>waitFor(async()=>!!(await sync(page))?.syncedAt&&!await waiting(page)&&!markers(),{label:'synced and settled',timeout:120000});
// Close the app, then remove only its database; signedOut also drops the
// Drive sign-in kept in browser storage, as when it expired days later.
async function removeDatabaseWhileClosed(page,{signedOut=false}={}){
  await browser.closePage(page);await new Promise(resolve=>setTimeout(resolve,500));
  const cleaner=await browser.createPage(server.url('deployment','manifest.webmanifest'),{viewport:{width:800,height:600,mobile:false,scale:1}});
  await cleaner.send('Storage.clearDataForOrigin',{origin:server.origin,storageTypes:'indexeddb'});
  if(signedOut)await cleaner.evaluate(`Object.keys(localStorage).filter(key=>key.includes(${JSON.stringify(LOCAL_STORAGE_KEYS.driveSession)})).forEach(key=>localStorage.removeItem(key))`);
  await browser.closePage(cleaner);
}
async function comesBack(page,text){
  await waitFor(async()=>(await noteText(page,'ethics'))===text,{label:`the note comes back (${text})`,timeout:120000});
  await waitFor(async()=>JSON.stringify(await plans(page))===JSON.stringify([text+' plan']),{label:'saved plans come back too',timeout:30000});
  await waitFor(()=>page.evaluate(`!${notice}&&!__PWA6.readStorageHealth().browserDataClearedAt`),{label:'the clear is settled',timeout:30000});
  await waitFor(()=>page.evaluate(`!!__PWA6.NoticeCoordinator.readEvent('storage-reset','restored')`),{label:'it says the library was brought back',timeout:30000});
  await settled(page);
  assert.equal(await noteText(page,'ethics'),text,'nothing was lost after uploads resumed');
}
let page=null;const errors=[];
const collect=current=>errors.push(...current.events.filter(event=>/startup\.initialize|Uncaught/u.test(String(event.text||''))).map(event=>String(event.text).slice(0,200)));
try{
  page=await open(browser,server,'A');
  await save(page,'Written before the clear');
  await connect(page,'A');await settled(page);

  // Still signed in: the library comes back at start, with no click.
  collect(page);await removeDatabaseWhileClosed(page);page=null;
  page=await open(browser,server,'A');
  await waitFor(()=>page.evaluate(`${notice}||__PWA6.NoticeCoordinator.readEvent('storage-reset','restored')!==null`),{label:'the clear is found',timeout:30000});
  await comesBack(page,'Written before the clear');

  // Signed out: signing in with the Connect button brings it back.
  await save(page,'Written before the second clear');await page.evaluate(`__PWA6.BackupProviderRuntime.flushAutomatic('app-hidden')`);await settled(page);
  collect(page);await removeDatabaseWhileClosed(page,{signedOut:true});page=null;
  page=await open(browser,server,'A');
  await waitFor(()=>page.evaluate(notice),{label:'the clear notice',timeout:30000});
  assert.equal(await noteText(page,'ethics'),null,'the removed database took the note with it');
  assert.equal(await page.evaluate(`__PWA6.BackupProviderRuntime.connected('google-drive')`),false,'signed out');
  await page.evaluate(`(()=>{__PWA6.goTab('plan');document.querySelector('[data-action="connect-drive-backup"]').click();})()`);
  await comesBack(page,'Written before the second clear');

  assert.deepEqual(faults,[],'every Drive request was well formed');
  collect(page);assert.deepEqual(errors,[],'no start-up or uncaught errors');
  console.log(JSON.stringify({status:'PASS',suite:'cold-start-drive-recovery',keptSignIn:true,signedOut:true}));
}catch(error){
  console.error(JSON.stringify({faults:faults.slice(0,10),drive:ledger.slice(-40)},null,1));
  throw error;
}finally{
  if(page)await browser.closePage(page).catch(()=>{});await browser.close();await server.close();
}
