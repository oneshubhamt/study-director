import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitForStudyDirector,waitFor} from '../../helpers/browser-harness.mjs';

// Chrome's "Clear browsing data" removes this site's IndexedDB, localStorage and
// OPFS even while the app is open. Everything the open tab still holds must be
// written back, automatic backups must pause until the user decides, and the
// decision notice must stay until one of its two choices is made.
const preload=`(()=>{const d=new Date(),today=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');localStorage.setItem('studyDirector.nameSetupSkippedDate.v1',today);})();`;
const read=`(async()=>{const d=__PWA6,session=await d.AppData.activeSession.load(0,{strict:true}),plans=await d.AppData.planData.read(),notes=await d.AppData.notes.readFreshPayload(),notice=[...document.querySelectorAll('#sd-toast-region .interaction-toast')].find(toast=>/Browser data was cleared/.test(toast.textContent));
  return {note:notes.medicine?.text||null,draft:String(plans.draft||''),savedPlans:plans.savedPlans.length,session:!!session.value,mode:d.TimerState.mode,name:(await d.AppData.personalPreferences.read())?.studentName||null,
    notice:notice?{dismissible:!!notice.querySelector('.interaction-toast-close'),action:notice.querySelector('button:not(.interaction-toast-close)')?.textContent||''}:null,paused:d.DeviceBackup.status().automaticSuspended};})()`;
const server=await startReleaseServer(),browser=await launchChromium({profilePrefix:'study-director-qa-site-data-clear-'});let page=null;
const result={status:'PASS',release:server.manifest.release,checks:{}};
try{
  page=await browser.createPage(server.url('deployment','instrumented.html'),{preload,viewport:{width:1280,height:860,mobile:false,scale:1}});
  await waitForStudyDirector(page,{instrumented:true});
  await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().hasControl`),{label:'primary ownership'});
  await page.evaluate(`(async()=>{const d=__PWA6,wait=ms=>new Promise(r=>setTimeout(r,ms)),now=new Date(),m=now.getHours()*60+now.getMinutes(),fmt=v=>String(Math.floor((v+1440)%1440/60)).padStart(2,'0')+':'+String((v+1440)%1440%60).padStart(2,'0');
    const name=document.getElementById('student-display');name.value='SiteDataQA';name.dispatchEvent(new Event('input',{bubbles:true}));name.dispatchEvent(new Event('blur',{bubbles:true}));
    document.getElementById('plan-input').value=[fmt(m-5)+' | 60 | SiteDataQA Block | work | Medicine | pages | 12',fmt(m+55)+' | 30 | Lunch | fixed | Meal | |'].join('\\n');await d.PlanDraftEditor.save();
    d.goTab('plan');await wait(100);document.getElementById('saved-plan-name').value='SiteDataQA plan';document.querySelector('[data-saved-plan="save"]').click();await wait(300);
    if(!d.applySchedule({skipNotify:true}))throw new Error('schedule did not apply');d.goTab('execute');await wait(50);d.setCurrentTask(0);d.TimerEngine.startCur();await wait(200);
    d.AppData.notes.update('medicine','Medicine','SiteDataQA note before clearing','');await d.AppData.notes.flush({strict:true});await d.flushLiveDraft();})()`);
  const before=await page.evaluate(read);
  assert.equal(before.note,'SiteDataQA note before clearing');assert.equal(before.savedPlans,1);assert.equal(before.session,true);assert.equal(before.name,'SiteDataQA');assert.equal(before.paused,false);

  await page.send('Storage.clearDataForOrigin',{origin:server.origin,storageTypes:'all'});
  const edit=await page.evaluate(`(async()=>{const d=__PWA6,current=d.AppData.notes.get('medicine'),status=d.AppData.notes.update('medicine','Medicine','SiteDataQA note edited after clearing',current?.updatedAt||'').status;await d.AppData.notes.flush({strict:true});return status;})()`);
  assert.equal(edit,'changed','an edit after clearing is accepted rather than rejected as outdated');
  await waitFor(()=>page.evaluate(`${read}.then(state=>!!state.notice)`),{label:'browser-data-clear notice'});
  const cleared=await page.evaluate(read);
  assert.equal(cleared.note,'SiteDataQA note edited after clearing');assert.match(cleared.draft,/SiteDataQA Block/);assert.equal(cleared.savedPlans,1);
  assert.equal(cleared.session,true);assert.equal(cleared.mode,'running');assert.equal(cleared.name,'SiteDataQA');
  assert.deepEqual(cleared.notice,{dismissible:false,action:'Review'},'only a decision can clear the notice');
  assert.equal(cleared.paused,true,'automatic backup pauses so the reduced state cannot become the latest backup');
  result.checks.openTabStateWrittenBack=true;result.checks.automaticBackupPaused=true;

  await page.evaluate(`[...document.querySelectorAll('#sd-toast-region .interaction-toast')].find(toast=>/Browser data was cleared/.test(toast.textContent)).querySelector('button:not(.interaction-toast-close)').click()`);
  await waitFor(()=>page.evaluate(`!!document.getElementById('sd-interaction-dialog')?.open`),{label:'review dialog'});
  const choices=await page.evaluate(`[...document.querySelectorAll('#sd-interaction-dialog button')].map(button=>button.textContent.trim())`);
  assert.ok(choices.some(text=>text.startsWith('Restore a backup'))&&choices.some(text=>text.startsWith('Keep current data')));
  await page.evaluate(`[...document.querySelectorAll('#sd-interaction-dialog button')].find(button=>button.textContent.trim().startsWith('Keep current data')).click()`);
  await waitFor(()=>page.evaluate(`${read}.then(state=>!state.notice&&!state.paused)`),{label:'keep current data'});
  result.checks.keepCurrentDataResumes=true;

  await page.reload();await waitForStudyDirector(page,{instrumented:true});await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().hasControl`),{label:'ownership after reload'});
  const reloaded=await page.evaluate(read);
  assert.equal(reloaded.note,'SiteDataQA note edited after clearing');assert.equal(reloaded.savedPlans,1);assert.equal(reloaded.session,true);assert.equal(reloaded.name,'SiteDataQA');assert.equal(reloaded.paused,false);
  result.checks.survivesReload=true;
  const unexpected=page.events.filter(event=>!/favicon|ResizeObserver loop/i.test(event.text||''));assert.deepEqual(unexpected,[]);result.checks.noRuntimeErrors=true;
}finally{if(page)await browser.closePage(page).catch(()=>{});await browser.close();await server.close();}
console.log(JSON.stringify(result,null,2));
