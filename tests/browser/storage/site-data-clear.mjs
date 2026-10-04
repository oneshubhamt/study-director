import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitForStudyDirector,waitFor} from '../../helpers/browser-harness.mjs';
import {CURRENT_SCHEMA_VERSIONS} from '../../../contracts/canonical-identities.mjs';

// Chrome's "Clear browsing data" removes this site's IndexedDB, localStorage and
// OPFS even while the app is open. Everything the open tab still holds is written
// back and automatic backups pause. With a connected Device Folder the latest
// version adds back past Saved Days by itself; otherwise a notice offers
// "Restore from backup" or "Continue with current data" and stays until one is done.
const today=`const d=new Date(),today=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');`;
const preload=`(()=>{${today}localStorage.setItem('studyDirector.nameSetupSkippedDate.v1',today);})();`;
// The stand-in Device Folder lives in OPFS; a real folder is outside browser storage.
const folderPreload=`(()=>{${today}localStorage.setItem('studyDirector.nameSetupSkippedDate.v1',today);Object.defineProperty(window,'showDirectoryPicker',{configurable:true,value:async()=>navigator.storage.getDirectory()});})();`;
const toast=pattern=>`[...document.querySelectorAll('#sd-toast-region .interaction-toast')].find(toast=>${pattern}.test(toast.textContent))`;
const read=`(async()=>{const d=__PWA6,session=await d.AppData.activeSession.load(0,{strict:true}),plans=await d.AppData.planData.read(),notes=await d.AppData.notes.readFreshPayload(),notice=${toast('/Automatic backups are paused/')},yesterday=await d.AppData.dailyRecords.get(window.__qaYesterday||'');
  return {note:notes.medicine?.text||null,draft:String(plans.draft||''),savedPlans:plans.savedPlans.length,session:!!session.value,mode:d.TimerState.mode,name:(await d.AppData.personalPreferences.read())?.studentName||null,yesterday:yesterday?.reflection||null,
    notice:notice?{dismissible:!!notice.querySelector('.interaction-toast-close'),buttons:[...notice.querySelectorAll('button:not(.interaction-toast-close)')].map(button=>button.textContent.trim())}:null,paused:d.DeviceBackup.status().automaticSuspended,folder:d.DeviceBackup.status().connected};})()`;
const startSession=(name)=>`(async()=>{const d=__PWA6,wait=ms=>new Promise(r=>setTimeout(r,ms)),now=new Date(),m=now.getHours()*60+now.getMinutes(),fmt=v=>String(Math.floor((v+1440)%1440/60)).padStart(2,'0')+':'+String((v+1440)%1440%60).padStart(2,'0');
  const input=document.getElementById('student-display');input.value='${name}';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('blur',{bubbles:true}));
  document.getElementById('plan-input').value=[fmt(m-5)+' | 60 | ${name} Block | work | Medicine | pages | 12',fmt(m+55)+' | 30 | Lunch | fixed | Meal | |'].join('\\n');await d.PlanDraftEditor.save();
  d.goTab('plan');await wait(100);document.getElementById('saved-plan-name').value='${name} plan';document.querySelector('[data-saved-plan="save"]').click();await wait(300);
  if(!d.applySchedule({skipNotify:true}))throw new Error('schedule did not apply');d.goTab('execute');await wait(50);d.setCurrentTask(0);d.TimerEngine.startCur();await wait(200);
  d.AppData.notes.update('medicine','Medicine','${name} note before clearing','');await d.AppData.notes.flush({strict:true});await d.flushLiveDraft();})()`;
const editNote=text=>`(async()=>{const d=__PWA6,current=d.AppData.notes.get('medicine'),status=d.AppData.notes.update('medicine','Medicine','${text}',current?.updatedAt||'').status;await d.AppData.notes.flush({strict:true});return status;})()`;
// Plans are built around the current time; pick a zone whose local time keeps
// them clear of the 04:00 study-day boundary and of midnight.
const timezoneId=['Asia/Kolkata','UTC','America/New_York','Asia/Tokyo','America/Los_Angeles'].find(timeZone=>{const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone,hour:'numeric',hourCycle:'h23'}).format(new Date()));return hour>=6&&hour<=20;});
const reload=async page=>{await page.reload();await waitForStudyDirector(page,{instrumented:true});await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().hasControl`),{label:'ownership after reload'});};
const noRuntimeErrors=page=>assert.deepEqual(page.events.filter(event=>!/favicon|ResizeObserver loop/i.test(event.text||'')),[]);
const server=await startReleaseServer();
const result={status:'PASS',release:server.manifest.release,checks:{}};
try{
  // Without a Device Folder: the decision notice.
  {
    const browser=await launchChromium({profilePrefix:'study-director-qa-site-data-clear-'});let page=null;
    try{
      page=await browser.createPage(server.url('deployment','instrumented.html'),{preload,timezoneId,viewport:{width:1280,height:860,mobile:false,scale:1}});
      await waitForStudyDirector(page,{instrumented:true});
      await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().hasControl`),{label:'primary ownership'});
      await page.evaluate(startSession('SiteDataQA'));
      const before=await page.evaluate(read);
      assert.equal(before.note,'SiteDataQA note before clearing');assert.equal(before.savedPlans,1);assert.equal(before.session,true);assert.equal(before.name,'SiteDataQA');assert.equal(before.paused,false);

      await page.send('Storage.clearDataForOrigin',{origin:server.origin,storageTypes:'all'});
      assert.equal(await page.evaluate(editNote('SiteDataQA note edited after clearing')),'changed','an edit after clearing is accepted rather than rejected as outdated');
      await waitFor(()=>page.evaluate(`${read}.then(state=>!!state.notice)`),{label:'browser-data-clear notice'});
      const cleared=await page.evaluate(read);
      assert.equal(cleared.note,'SiteDataQA note edited after clearing');assert.match(cleared.draft,/SiteDataQA Block/);assert.equal(cleared.savedPlans,1);
      assert.equal(cleared.session,true);assert.equal(cleared.mode,'running');assert.equal(cleared.name,'SiteDataQA');
      assert.deepEqual(cleared.notice,{dismissible:false,buttons:['Restore from backup','Continue with current data']},'only a choice can clear the notice');
      assert.equal(cleared.paused,true,'automatic backup pauses so the reduced state cannot become the latest backup');
      result.checks.openTabStateWrittenBack=true;result.checks.automaticBackupPaused=true;

      // Restoring first suspends the running session; keeping it active backs out
      // and the notice stays.
      const click=label=>page.evaluate(`[...${toast('/Automatic backups are paused/')}.querySelectorAll('button')].find(button=>button.textContent.trim()===${JSON.stringify(label)}).click()`);
      await click('Restore from backup');
      await waitFor(()=>page.evaluate(`!!document.getElementById('sd-interaction-dialog')?.open`),{label:'suspend confirmation'});
      await page.evaluate(`[...document.querySelectorAll('#sd-interaction-dialog button')].find(button=>button.textContent.trim()==='Keep session active').click()`);
      await waitFor(()=>page.evaluate(`!document.getElementById('sd-interaction-dialog')?.open`),{label:'confirmation closed'});
      const backedOut=await page.evaluate(read);
      assert.ok(backedOut.notice,'the notice stays until a restore finishes');assert.equal(backedOut.paused,true);assert.equal(backedOut.mode,'running');
      result.checks.noticeStaysUntilRestoreFinishes=true;

      await click('Continue with current data');
      await waitFor(()=>page.evaluate(`${read}.then(state=>!state.notice&&!state.paused)`),{label:'continue with current data'});
      result.checks.continueResumesBackups=true;

      await reload(page);
      const reloaded=await page.evaluate(read);
      assert.equal(reloaded.note,'SiteDataQA note edited after clearing');assert.equal(reloaded.savedPlans,1);assert.equal(reloaded.session,true);assert.equal(reloaded.name,'SiteDataQA');assert.equal(reloaded.paused,false);
      result.checks.survivesReload=true;
      noRuntimeErrors(page);
    }finally{if(page)await browser.closePage(page).catch(()=>{});await browser.close();}
  }

  // With a connected Device Folder: past Saved Days come back without a question.
  {
    const browser=await launchChromium({profilePrefix:'study-director-qa-site-data-clear-folder-'});let page=null;
    try{
      page=await browser.createPage(server.url('deployment','instrumented.html'),{preload:folderPreload,timezoneId,viewport:{width:1280,height:860,mobile:false,scale:1}});
      await waitForStudyDirector(page,{instrumented:true});
      await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().hasControl`),{label:'primary ownership'});
      const yesterday=await page.evaluate(`(async()=>{const d=__PWA6,day=new Date(d.todayISO()+'T12:00:00');day.setDate(day.getDate()-1);const date=[day.getFullYear(),String(day.getMonth()+1).padStart(2,'0'),String(day.getDate()).padStart(2,'0')].join('-'),stamp=new Date(Date.now()-86400000).toISOString();
        await d.AppData.dailyRecords.saveBatch([{version:${CURRENT_SCHEMA_VERSIONS.DailyRecord},recordKind:'study',date,savedAt:stamp,updatedAt:stamp,sourceRevision:1,reflection:'FolderQA yesterday',quote:'',studyQuality:4,realTimeSnapshot:null,
          schedule:[{id:'folderqa-yesterday-1',start:'09:00',duration:30,name:'Yesterday Block',kind:'work',area:'Medicine',measure:'pages',target:10}],results:{},practiceRuns:[],carryForwardDraft:''}]);return date;})()`);
      const remember=`window.__qaYesterday=${JSON.stringify(yesterday)}`;
      await page.evaluate(remember);
      await page.evaluate(startSession('FolderQA'));
      const backup=await page.evaluate(`(async()=>{const d=__PWA6;await d.DeviceBackup.connect();const result=await d.DeviceBackup.backupNow('manual');return !!(result&&result.ok);})()`);
      assert.equal(backup,true);
      const before=await page.evaluate(read);
      assert.equal(before.yesterday,'FolderQA yesterday');assert.equal(before.folder,true);assert.equal(before.mode,'running');

      await page.send('Storage.clearDataForOrigin',{origin:server.origin,storageTypes:'indexeddb,local_storage,cache_storage,service_workers'});
      assert.equal(await page.evaluate(editNote('FolderQA note edited after clearing')),'changed');
      await waitFor(()=>page.evaluate(`!!${toast('/restored from your Device Folder backup/')}`),{label:'automatic restore toast',timeout:60000});
      const restored=await page.evaluate(read);
      assert.equal(restored.yesterday,'FolderQA yesterday','the missing Saved Day is added back from the latest backup');
      assert.equal(restored.note,'FolderQA note edited after clearing','notes written after the clear are kept');
      assert.equal(restored.session,true);assert.equal(restored.mode,'running','the running session is untouched');
      assert.equal(restored.notice,null,'no decision is needed');assert.equal(restored.paused,false,'automatic backups resume');
      result.checks.automaticMissingOnlyRestore=true;
      assert.equal(await page.evaluate(`__PWA6.DeviceBackup.backupNow('manual').then(result=>!!(result&&result.ok))`),true,'the combined state backs up completely');
      result.checks.restoredStateBacksUp=true;

      await reload(page);await page.evaluate(remember);
      const reloaded=await page.evaluate(read);
      assert.equal(reloaded.yesterday,'FolderQA yesterday');assert.equal(reloaded.note,'FolderQA note edited after clearing');assert.equal(reloaded.session,true);
      assert.equal(reloaded.folder,true,'the Device Folder is remembered after the clear');
      result.checks.folderRemembered=true;
      noRuntimeErrors(page);
    }finally{if(page)await browser.closePage(page).catch(()=>{});await browser.close();}
  }
}finally{await server.close();}
console.log(JSON.stringify(result,null,2));
