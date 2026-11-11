import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitFor} from '../../helpers/browser-harness.mjs';
import {connect,sync,reopen} from '../../helpers/drive-browser.mjs';
import {journeyLog,openDevice,runSession,view,upload,settled,syncNow,noReviews,explain,elsewhere,hold} from '../../helpers/sync-journey-world.mjs';

// Finish Today ends the day for good (backlog item 21): it saves nothing by
// itself, opens Review, leaves Execute, the Pacer and Plan as after Reset
// Today, survives a reload, and reaches the laptop as finished (no Continue
// Here). Save Today then replaces the day's one Saved Day and closes the day.
const {steps,step}=journeyLog('finish-today-journey');
const server=await startReleaseServer();
const phoneBrowser=await launchChromium({profilePrefix:'sd-finish-a-'}),laptopBrowser=await launchChromium({profilePrefix:'sd-finish-b-'});
let phone=null,laptop=null;
const accept=`clearInterval(window.__acceptTimer);window.__acceptTimer=setInterval(()=>{const dialog=document.getElementById('sd-interaction-dialog');if(dialog&&dialog.open)dialog.querySelector('.interaction-actions .primary')?.click();},50);`;
const shown=action=>`[...document.querySelectorAll('[data-action="${action}"]')].filter(button=>!button.hidden&&button.checkVisibility())`;
const day=page=>page.evaluate(`(async()=>{const d=__PWA6,records=(await d.AppData.dailyRecords.list()).filter(row=>row.date===d.todayISO()),session=(await d.AppData.activeSession.load()).value;
  return {records:records.length,reflection:records[0]?.reflection??null,status:session?.status||'',runs:session?.snapshot?.practice?.runs?.length||0};})()`);
const nextStep=page=>page.evaluate(`(async()=>{await __PWA6.goTab('execute');await new Promise(r=>setTimeout(r,150));return [...new Set(${shown('restore-session')}.map(button=>button.textContent))];})()`);
try{
  phone=await openDevice(phoneBrowser,server,'A');laptop=await openDevice(laptopBrowser,server,'B');
  await connect(phone,'A');await waitFor(async()=>!!(await sync(phone))?.syncedAt,{label:'phone synced',timeout:60000});await settled(phone,'A');
  await connect(laptop,'B');await waitFor(async()=>!!(await sync(laptop))?.syncedAt,{label:'laptop synced',timeout:60000});await upload(laptop);await settled(laptop,'B');

  // Execute was open before the block started; the Pacer starts with its
  // default target (item 17).
  assert.equal(await phone.evaluate(runSession('Day')),'running','the phone runs the day');
  await phone.click('[data-action="practice-start"]');
  await waitFor(()=>phone.evaluate(`document.getElementById('practice-pacer-state').textContent==='Running'`),{label:'the Pacer runs',timeout:5000});
  // Save Today while a Drive sync is under way (backlog item 20): background
  // work stops for the save, the save completes, and the sync runs after it.
  const reading=hold('A',request=>request.method==='GET');
  await syncNow(phone);await waitFor(()=>reading.reached,{label:'a sync is reading Drive',timeout:20000});
  const midDay=await phone.evaluate(`(async()=>{const saved=await __PWA6.saveDayRecord();return {saved,notice:document.getElementById('save-status')?.textContent||''};})()`);
  reading.release();
  assert.equal(midDay.saved,true,'a mid-day Save Today completes while a sync is under way');
  assert.doesNotMatch(midDay.notice,/follow-up|could not/iu,'and reports no failed step');
  await upload(phone);await settled(phone,'A');await elsewhere(laptop,'B');

  await phone.evaluate(`(async()=>{${accept}await __PWA6.goTab('execute');await new Promise(r=>setTimeout(r,150));${shown('finish-session')}[0].click();})()`);
  await waitFor(async()=>(await day(phone)).status==='finished',{label:'the day is stored as finished',timeout:15000});
  assert.equal(await phone.evaluate(`document.getElementById('pane-review').classList.contains('on')`),true,'Finish Today opens Review');
  const finished=await day(phone);
  assert.equal(finished.records,1,'Finish Today saves nothing by itself');
  assert.equal(finished.runs,1,'the open Pacer run ends with the day and is kept');
  const look=await phone.evaluate(`(async()=>{const d=__PWA6;await d.goTab('execute');await new Promise(r=>setTimeout(r,150));const execute=document.getElementById('task-name').textContent,pacer=!document.getElementById('practice-pacer-setup').hidden;
    await d.goTab('plan');await new Promise(r=>setTimeout(r,150));let applied=d.applySchedule({skipNotify:true});if(applied&&applied.then)applied=await applied;return {execute,pacer,plan:document.getElementById('plan-board-state').textContent,applied};})()`);
  assert.deepEqual({...look,plan:undefined},{execute:'Today Finished',pacer:true,plan:undefined,applied:false},'Execute and the Pacer show no session; a new plan waits for Reset Today');
  assert.notEqual(look.plan,'LIVE','the Plan board shows the draft');
  assert.equal((await view(phone)).loop,false,'no timer runs');
  step('finish today',{plan:look.plan});

  await phone.evaluate(`(async()=>{const d=__PWA6;await d.goTab('review');await new Promise(r=>setTimeout(r,150));document.getElementById('daily-reflection').value='Finished day reflection';d.ReviewEditor.saveReview({strict:true});await d.ReviewEditor.flushPending();await d.ReviewEditor.settled();})()`);
  await phone.reload();await reopen(phone,'A after reload');
  await waitFor(async()=>(await view(phone)).panel==='Today Finished',{label:'a reload keeps the day finished',timeout:20000});
  await waitFor(()=>phone.evaluate(`__PWA6.BackupProviderRuntime.connected('google-drive')`),{label:'the phone is connected again',timeout:20000});
  await upload(phone);await settled(phone,'A');
  await syncNow(laptop);
  await waitFor(async()=>(await view(laptop)).panel==='Today Finished',{label:'the laptop shows the day finished',timeout:60000});
  assert.deepEqual(await nextStep(laptop),['Open Review'],'the laptop offers Review, not Continue Here');
  assert.equal((await view(laptop)).loop,false,'and runs no timer');
  step('laptop sees the day finished');

  assert.equal(await phone.evaluate(`__PWA6.saveDayRecord()`),true,'Save Today');
  const saved=await day(phone);
  assert.match(String(saved.reflection),/Finished day reflection/u,'the Saved Day is replaced with the reviewed day');
  assert.deepEqual({...saved,reflection:undefined},{records:1,reflection:undefined,status:'',runs:0},'still one Saved Day; the finished day is closed');
  await upload(phone);await settled(phone,'A');await syncNow(laptop);
  await waitFor(async()=>(await view(laptop)).status==='',{label:'the laptop closes the day too',timeout:60000});
  await settled(laptop,'B');
  await noReviews([['A',phone],['B',laptop]],'after the save');
  step('save closes the day');
  console.log(JSON.stringify({status:'PASS',suite:'finish-today-journey',steps}));
}catch(error){
  try{await explain([['A',phone],['B',laptop]]);}catch{}
  throw error;
}finally{await phoneBrowser.close();await laptopBrowser.close();await server.close();}
