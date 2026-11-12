import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitFor} from '../../helpers/browser-harness.mjs';
import {connect,sync} from '../../helpers/drive-browser.mjs';
import {journeyLog,openDevice,runSession,view,upload,settled,syncNow,continueHere,stopsWithin,elsewhere,bothSettled,noReviews,explain,writeNote,setOffline,hold,versionUpload} from '../../helpers/sync-journey-world.mjs';

// A handoff moves the session and nothing else (backlog item 5: saved plans
// and the draft were found gone on the device that handed over). Two devices
// hold every kind of data the person makes: saved plans, the Plan draft, a
// setting, notes (one with an image), a Saved Day. The session moves between
// them while the newest changes are not on Drive yet, while one device is
// offline, and back while the other's last upload is held. At the end both
// devices hold everything either made, a note deleted on purpose is gone
// from both, and nothing is kept for review. Last, the phone's database is
// removed while it is closed (the phone's data loss): it gets everything
// back, and the laptop loses nothing to its empty start.
const {steps,step}=journeyLog('handoff-data-journey');
const server=await startReleaseServer();
const laptopBrowser=await launchChromium({profilePrefix:'sd-handoff-data-a-'}),phoneBrowser=await launchChromium({profilePrefix:'sd-handoff-data-b-'});
let laptop=null,phone=null;
const IMAGE='img-handoffdatajourney0001',TRASH='~deleted ';
const TOMORROW='07:00 | 30 | Tomorrow block | work | Ethics | pages | 5';
const planText=name=>`08:00 | 45 | ${name} block | work | Medicine | pages | 10`;
const page=fn=>`(async()=>{const d=__PWA6,wait=ms=>new Promise(r=>setTimeout(r,ms));${fn}})()`;
// The Plan box as the person types in it; saved after its short delay.
const typeDraft=text=>`await d.goTab('plan');await wait(100);const input=document.getElementById('plan-input');input.value=${JSON.stringify(text)};input.dispatchEvent(new Event('input',{bubbles:true}));await wait(400);await d.PlanDraftEditor.flush();await d.PlanData.settled();`;
const setDraft=(device,text)=>device.evaluate(page(`${typeDraft(text)}return d.PlanData.readDraft();`));
// Plan → Saved plans → Save current draft.
const savePlan=(device,name,text)=>device.evaluate(page(`${typeDraft(text)}document.getElementById('saved-plan-name').value=${JSON.stringify(name)};document.querySelector('[data-saved-plan="save"]').click();
  await waitFor();async function waitFor(){for(let i=0;i<50;i++){if(d.PlanData.library().savedPlans.some(plan=>plan.label===${JSON.stringify(name)}))return;await wait(100);}throw new Error('plan not saved');}
  await d.PlanData.settled();return d.PlanData.library().savedPlans.map(plan=>plan.label);`));
const largerText=device=>device.evaluate(page(`document.querySelector('[data-action="font-larger"]').click();await wait(200);await d.PlanData.settled();return document.documentElement.dataset.fontScale;`));
const imageNote=device=>device.evaluate(page(`const value='WG1:'+JSON.stringify({version:1,doc:{type:'Doc',content:[{type:'Paragraph',content:[{type:'Text',param:'Diagram notes'}]},{type:'SDImage',param:{assetId:${JSON.stringify(IMAGE)},alt:'Diagram',widthPct:100}}]}});
  await d.RichTextAssets.put(${JSON.stringify(IMAGE)},new Blob([new Uint8Array([137,80,78,71,13,10,26,10])],{type:'image/png'}));d.AppData.notes.update('laptop-image','laptop-image',value,'');await d.AppData.notes.flush({strict:true});return true;`));
// A note deleted on purpose: Library → note → Delete (to Recently deleted).
const deleteNote=(device,label)=>device.evaluate(page(`await d.AppData.notes.trash(${JSON.stringify(label)});await d.AppData.notes.flush({strict:true});return !d.AppData.notes.get(${JSON.stringify(label)});`));
// Everything the person made, as this device holds it.
const census=device=>device.evaluate(page(`const data=await d.PlanData.exportData({flush:false}),notes=Object.values(d.AppData.notes.normalizePayload(await d.AppData.notes.readFreshPayload()));
  return {draft:data.plans.draft,plans:data.plans.savedPlans.map(plan=>plan.label).sort(),fontScale:data.preferences.fontScale??null,
    notes:notes.filter(note=>!note.key.startsWith(${JSON.stringify(TRASH)})).map(note=>note.label).sort(),recentlyDeleted:notes.filter(note=>note.key.startsWith(${JSON.stringify(TRASH)})).map(note=>note.label).sort(),
    days:(await d.AppData.dailyRecords.list()).map(row=>row.date).sort(),image:!!(await d.RichTextAssets.get(${JSON.stringify(IMAGE)})),
    reviews:(await d.AppData.pendingReviews.list()).filter(row=>!row.resolvedAt).map(row=>row.subject+':'+row.ref)};`));
// Both devices hold exactly the same, and what is expected.
async function same(label,expected){
  const [a,b]=[await census(laptop),await census(phone)];
  assert.deepEqual(b,a,`${label}: the phone holds what the laptop holds`);
  for(const [key,value] of Object.entries(expected))assert.deepEqual(a[key],value,`${label}: ${key}`);
  return a;
}
// A sync asked for and finished: settled() alone can pass before an asked-for
// sync has started, and an edit made then counts as made on both sides.
const syncFully=async(device,who)=>{const asked=Date.now();await syncNow(device);await waitFor(async()=>{const row=await sync(device);return !!row&&Date.parse(row.checkedAt||'')>=asked&&!row.catchingUp;},{label:`${who} syncs`,timeout:60000});await settled(device,who);};
// Each device's changes are on Drive, and each has taken in the other's.
const settle=async label=>{for(let round=0;round<2;round++){await upload(laptop);await upload(phone);await syncFully(laptop,`${label}: A`);await syncFully(phone,`${label}: B`);}await bothSettled([['A',laptop],['B',phone]],label);};
try{
  laptop=await openDevice(laptopBrowser,server,'A');phone=await openDevice(phoneBrowser,server,'B');
  await connect(laptop,'A');await waitFor(async()=>!!(await sync(laptop))?.syncedAt,{label:'laptop synced',timeout:60000});await settled(laptop,'A');
  await connect(phone,'B');await waitFor(async()=>!!(await sync(phone))?.syncedAt,{label:'phone synced',timeout:60000});await upload(phone);await settled(phone,'B');

  // 1. Each device makes its own plans and notes; the laptop a setting too.
  // (The phone starts after taking in the laptop's: saving a plan sets the
  // shared draft, and a draft changed on both is rightly kept for review.)
  await savePlan(laptop,'Laptop plan',planText('Laptop'));await imageNote(laptop);await writeNote(laptop,'to-delete','delete me on purpose');
  assert.equal(await largerText(laptop),'1.08');
  await upload(laptop);await settled(laptop,'A');await syncFully(phone,'B');
  await savePlan(phone,'Phone plan',planText('Phone'));await writeNote(phone,'phone-note','from the phone');
  await upload(phone);await settle('seed');
  const seeded=await same('seed',{draft:planText('Phone'),plans:['Laptop plan','Phone plan'],notes:['laptop-image','phone-note','to-delete'],fontScale:1.08,image:true,reviews:[]});
  step('seed',{plans:seeded.plans.length,notes:seeded.notes.length});

  // 2. The day runs on the laptop. Tomorrow's plan is drafted meanwhile and
  // today is saved part-way through.
  assert.equal(await laptop.evaluate(runSession('Day')),'running','the laptop runs the day');
  assert.equal(await setDraft(laptop,TOMORROW),TOMORROW);
  assert.equal(await laptop.evaluate(`__PWA6.saveDayRecord()`),true,'Save Today part-way through the day');
  const today=await laptop.evaluate(`__PWA6.todayISO()`);
  await upload(laptop);await settled(laptop,'A');await elsewhere(phone,'B');await settle('day');
  await same('day',{draft:TOMORROW,days:[today]});
  step('day on the laptop');

  // 3. Continue Here on the phone while the laptop's newest changes are not
  // on Drive yet: a note deleted on purpose, a new note and a new plan.
  assert.equal(await deleteNote(laptop,'to-delete'),true);await writeNote(laptop,'laptop-late','made just before the handoff');
  await savePlan(laptop,'Laptop late plan',TOMORROW);
  const laptopHeld=hold('A',versionUpload);
  assert.equal((await census(phone)).notes.includes('laptop-late'),false,'the phone does not have the laptop\'s newest changes yet');
  const toPhoneMs=await continueHere(phone,'B');const laptopStopsMs=await stopsWithin(laptop,'A');
  laptopHeld.release();await upload(laptop);await settle('handoff to the phone');
  await same('handoff to the phone',{draft:TOMORROW,plans:['Laptop late plan','Laptop plan','Phone plan'],notes:['laptop-image','laptop-late','phone-note'],recentlyDeleted:['to-delete'],fontScale:1.08,days:[today],image:true,reviews:[]});
  step('handoff to the phone, the laptop\'s newest changes not on Drive yet',{continueHereMs:toPhoneMs,laptopStopsMs});

  // 4. The laptop goes offline. Both devices change things meanwhile.
  await setOffline(laptop,'A',true);
  await writeNote(laptop,'laptop-offline','made offline');assert.equal(await largerText(laptop),'1.16');
  await writeNote(phone,'phone-running','made while running the session');await savePlan(phone,'Phone plan two',TOMORROW);
  await upload(phone);await settled(phone,'B');
  await setOffline(laptop,'A',false);await syncFully(laptop,'A');await settle('offline');
  await same('laptop offline',{draft:TOMORROW,plans:['Laptop late plan','Laptop plan','Phone plan','Phone plan two'],notes:['laptop-image','laptop-late','laptop-offline','phone-note','phone-running'],fontScale:1.16,reviews:[]});
  step('laptop offline while the phone runs the session');

  // 5. The laptop takes the session back while the phone's last upload is held.
  await writeNote(phone,'phone-before-return','made just before the session went back');
  const phoneHeld=hold('B',versionUpload);
  await elsewhere(laptop,'A');
  assert.equal((await census(laptop)).notes.includes('phone-before-return'),false,'the laptop does not have the phone\'s newest note yet');
  const toLaptopMs=await continueHere(laptop,'A');const phoneStopsMs=await stopsWithin(phone,'B');
  phoneHeld.release();await upload(phone);await settle('handoff back');
  const final=await same('handoff back',{draft:TOMORROW,plans:['Laptop late plan','Laptop plan','Phone plan','Phone plan two'],
    notes:['laptop-image','laptop-late','laptop-offline','phone-before-return','phone-note','phone-running'],recentlyDeleted:['to-delete'],fontScale:1.16,days:[today],image:true,reviews:[]});
  await noReviews([['A',laptop],['B',phone]],'at the end');
  assert.equal((await view(laptop)).mode,'running','the laptop runs the session again');
  step('handoff back, the phone\'s last upload held',{continueHereMs:toLaptopMs,phoneStopsMs,notes:final.notes.length,plans:final.plans.length});

  // 6. The browser removes the phone's database while the app is closed (the
  // phone's data loss) while the laptop runs the session and adds a note.
  // The laptop keeps everything; the phone gets it all back.
  await phoneBrowser.closePage(phone);phone=null;
  const cleaner=await phoneBrowser.createPage(server.url('deployment','manifest.webmanifest'),{viewport:{width:800,height:600,mobile:false,scale:1}});
  await cleaner.send('Storage.clearDataForOrigin',{origin:server.origin,storageTypes:'indexeddb'});await phoneBrowser.closePage(cleaner);
  await writeNote(laptop,'laptop-after-loss','made while the phone was closed');await upload(laptop);await settled(laptop,'A');
  const laptopBefore=await census(laptop);
  phone=await openDevice(phoneBrowser,server,'B');
  await waitFor(async()=>JSON.stringify((await census(phone)).notes)===JSON.stringify(laptopBefore.notes),{label:'the phone gets every note back',timeout:120000});
  await settle('after the phone\'s loss');
  const after=await same('after the phone\'s loss',{...laptopBefore,reviews:[]});
  assert.deepEqual(after,laptopBefore,'the laptop lost nothing to the phone\'s empty start');
  assert.equal((await view(laptop)).mode,'running','and still runs the session');
  step('phone database removed while closed',{notes:after.notes.length,plans:after.plans.length});
  console.log(JSON.stringify({status:'PASS',suite:'handoff-data-journey',steps}));
}catch(error){
  try{for(const [who,device] of [['A',laptop],['B',phone]])if(device)console.error(who,'census',JSON.stringify(await census(device)));}catch{}
  try{await explain([['A',laptop],['B',phone]]);}catch{}
  throw error;
}finally{await laptopBrowser.close();await phoneBrowser.close();await server.close();}
