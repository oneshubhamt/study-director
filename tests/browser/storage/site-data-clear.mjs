import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitForStudyDirector,waitFor} from '../../helpers/browser-harness.mjs';
import {CURRENT_SCHEMA_VERSIONS} from '../../../contracts/canonical-identities.mjs';

// Chrome's "Clear browsing data" removes this site's IndexedDB, localStorage and
// OPFS even while the app is open. Everything the open tab still holds is written
// back and automatic backups pause. With a connected Device Folder the newest
// version saved before the clear adds back past Saved Days by itself; otherwise a
// notice offers "Restore from backup" or "Continue with current data" and stays,
// across reloads, until one is done. Reconnecting the folder after a reload adds
// the missing Saved Days back the same way. Where folders are unsupported (iPad,
// iPhone, Android, Safari, Firefox) the same choice leads to Google Drive and the
// backup file import instead.
const today=`const d=new Date(),today=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');`;
const preload=`(()=>{${today}(localStorage.getItem('studyDirector.profiles.v1')||localStorage.setItem('studyDirector.profiles.v1',JSON.stringify({version:1,active:'prof_qa_mve00000_abcdef01',profiles:[{id:'prof_qa_mve00000_abcdef01',scope:'',name:'',email:'',folder:'',createdAt:'2026-08-01T00:00:00.000Z',fresh:false,from:null}],removing:[]})));})();`;
// The stand-in Device Folder lives in OPFS; a real folder is outside browser storage.
const folderPreload=`(()=>{${today}(localStorage.getItem('studyDirector.profiles.v1')||localStorage.setItem('studyDirector.profiles.v1',JSON.stringify({version:1,active:'prof_qa_mve00000_abcdef01',profiles:[{id:'prof_qa_mve00000_abcdef01',scope:'',name:'',email:'',folder:'',createdAt:'2026-08-01T00:00:00.000Z',fresh:false,from:null}],removing:[]})));Object.defineProperty(window,'showDirectoryPicker',{configurable:true,value:async()=>navigator.storage.getDirectory()});})();`;
// No Device Folder support, as on iPad and iPhone.
const noFolderPreload=`(()=>{${today}(localStorage.getItem('studyDirector.profiles.v1')||localStorage.setItem('studyDirector.profiles.v1',JSON.stringify({version:1,active:'prof_qa_mve00000_abcdef01',profiles:[{id:'prof_qa_mve00000_abcdef01',scope:'',name:'',email:'',folder:'',createdAt:'2026-08-01T00:00:00.000Z',fresh:false,from:null}],removing:[]})));Object.defineProperty(window,'showDirectoryPicker',{configurable:true,value:undefined});})();`;
const toast=pattern=>`[...document.querySelectorAll('#sd-toast-region .interaction-toast')].find(toast=>${pattern}.test(toast.textContent))`;
const decision=toast('/Continue with current data/');
// What Data & Backup shows after "Restore from backup" with nothing connected.
const restoreView=`(()=>{const shown=node=>!!node&&node.checkVisibility();return {tab:document.querySelector('.pane.on')?.id||'',drawer:!document.getElementById('library-data').hidden,
  importButton:shown(document.querySelector('[data-action="pick-import-file"]')),driveRow:shown(document.getElementById('backup-provider-row-status-google-drive')),folderRow:document.getElementById('device-backup-status').textContent.trim()};})()`;
const restoredToast=toast('/Added 1 past Saved Day and 0 attachments from your Device Folder backup/');
// The automatic restore reports as news (docs/areas/notifications.md, kinds): it
// waits while the timer runs on a work block and shows at a pause.
const restoreReported=`!!__PWA6.NoticeCoordinator.readEvent('storage-reset','restored')`;
const read=`(async()=>{const d=__PWA6,session=await d.AppData.activeSession.load(0,{strict:true}),plans=await d.AppData.planData.read(),notes=await d.AppData.notes.readFreshPayload(),notice=${decision},yesterday=await d.AppData.dailyRecords.get(window.__qaYesterday||'');
  return {message:notice?notice.textContent:'',cleared:d.readStorageHealth().browserDataClearedAt||null,note:Object.values(notes).find(row=>String(row?.label||'').toLowerCase()==='medicine')?.text||null,draft:String(plans.draft||''),savedPlans:plans.savedPlans.length,session:!!session.value,mode:d.TimerState.mode,name:(await d.AppData.personalPreferences.read())?.studentName||null,yesterday:yesterday?.reflection||null,
    notice:notice?{dismissible:!!notice.querySelector('.interaction-toast-close'),buttons:[...notice.querySelectorAll('button:not(.interaction-toast-close)')].map(button=>button.textContent.trim())}:null,paused:d.DeviceBackup.status().paused,folder:d.DeviceBackup.status().connected};})()`;
const startSession=(name)=>`(async()=>{const d=__PWA6,wait=ms=>new Promise(r=>setTimeout(r,ms)),now=new Date(),m=now.getHours()*60+now.getMinutes(),fmt=v=>String(Math.floor((v+1440)%1440/60)).padStart(2,'0')+':'+String((v+1440)%1440%60).padStart(2,'0');
  const input=document.getElementById('profile-name-input');input.value='${name}';document.getElementById('profile-dialog').dispatchEvent(new Event('close'));await wait(100);
  document.getElementById('plan-input').value=[fmt(m-5)+' | 60 | ${name} Block | work | Medicine | pages | 12',fmt(m+55)+' | 30 | Lunch | fixed | Meal | |'].join('\\n');await d.PlanDraftEditor.save();
  d.goTab('plan');await wait(100);document.getElementById('saved-plan-name').value='${name} plan';document.querySelector('[data-saved-plan="save"]').click();await wait(300);
  if(!d.applySchedule({skipNotify:true}))throw new Error('schedule did not apply');d.goTab('execute');await wait(50);d.setCurrentTask(0);d.TimerEngine.startCur();await wait(200);
  d.AppData.notes.update('medicine','Medicine','${name} note before clearing','');await d.AppData.notes.flush({strict:true});await d.flushLiveDraft();})()`;
// Right after a clear, Chromium may still be closing the cleared database, so
// the first save can abort; the app keeps the edit and retries. Wait for the
// save rather than requiring the first attempt to succeed.
const editNote=async(page,text)=>{
  const status=await page.evaluate(`(()=>{const d=__PWA6,current=d.AppData.notes.get('medicine');return d.AppData.notes.update('medicine','Medicine','${text}',current?.updatedAt||'').status;})()`);
  await waitFor(()=>page.evaluate(`__PWA6.AppData.notes.flush({strict:true}).then(()=>true)`),{label:'note edit saved'});
  return status;
};
const reload=async page=>{await page.reload();await waitForStudyDirector(page,{instrumented:true});await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().hasControl`),{label:'ownership after reload'});};
const noRuntimeErrors=page=>assert.deepEqual(page.events.filter(event=>!/favicon|ResizeObserver loop/i.test(event.text||'')),[]);
const appWarnings=page=>page.warnings.filter(text=>/\[Study Director\]/.test(text));
const click=(page,label)=>page.evaluate(`[...${decision}.querySelectorAll('button')].find(button=>button.textContent.trim()===${JSON.stringify(label)}).click()`);
const server=await startReleaseServer();
const result={status:'PASS',release:server.manifest.release,checks:{}};
try{
  // Without a Device Folder: the decision notice.
  {
    const browser=await launchChromium({profilePrefix:'study-director-qa-site-data-clear-'});let page=null;
    try{
      page=await browser.createPage(server.url('deployment','instrumented.html'),{preload,viewport:{width:1280,height:860,mobile:false,scale:1}});
      await waitForStudyDirector(page,{instrumented:true});
      await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().hasControl`),{label:'primary ownership'});
      await page.evaluate(`new Promise(resolve=>setTimeout(resolve,1500))`);
      assert.deepEqual(appWarnings(page),[],'a clean startup logs no app warnings');result.checks.cleanStartup=true;
      await page.evaluate(startSession('SiteDataQA'));
      const before=await page.evaluate(read);
      assert.equal(before.note,'SiteDataQA note before clearing');assert.equal(before.savedPlans,1);assert.equal(before.session,true);assert.equal(before.name,'SiteDataQA');assert.equal(before.paused,false);

      await page.send('Storage.clearDataForOrigin',{origin:server.origin,storageTypes:'all'});
      assert.equal(await editNote(page,'SiteDataQA note edited after clearing'),'changed','an edit after clearing is accepted rather than rejected as outdated');
      await waitFor(()=>page.evaluate(`${read}.then(state=>!!state.notice)`),{label:'browser-data-clear notice'});
      const cleared=await page.evaluate(read);
      assert.equal(cleared.note,'SiteDataQA note edited after clearing');assert.match(cleared.draft,/SiteDataQA Block/);assert.equal(cleared.savedPlans,1);
      assert.equal(cleared.session,true);assert.equal(cleared.mode,'running');assert.equal(cleared.name,'SiteDataQA');
      assert.deepEqual(cleared.notice,{dismissible:false,buttons:['Restore from backup','Continue with current data']},'only a choice can clear the notice');
      assert.match(cleared.message,/were saved again/,'the notice only claims what was verified');assert.ok(cleared.cleared,'the unresolved clear is noted for a reload');
      assert.doesNotMatch(cleared.message,/Automatic backups/,'automatic backups are mentioned only when one is set up');
      assert.equal(cleared.paused,true,'automatic backup pauses so the reduced state cannot become the latest backup');
      result.checks.openTabStateWrittenBack=true;result.checks.automaticBackupPaused=true;

      // Restoring first suspends the running session; keeping it active backs out
      // and the notice stays.
      await click(page,'Restore from backup');
      await waitFor(()=>page.evaluate(`!!document.getElementById('sd-interaction-dialog')?.open`),{label:'suspend confirmation'});
      await page.evaluate(`[...document.querySelectorAll('#sd-interaction-dialog button')].find(button=>button.textContent.trim()==='Keep session active').click()`);
      await waitFor(()=>page.evaluate(`!document.getElementById('sd-interaction-dialog')?.open`),{label:'confirmation closed'});
      const backedOut=await page.evaluate(read);
      assert.ok(backedOut.notice,'the notice stays until a restore finishes');assert.equal(backedOut.paused,true);assert.equal(backedOut.mode,'running');
      result.checks.noticeStaysUntilRestoreFinishes=true;

      // Reloading before choosing brings the notice and the pause back.
      await reload(page);
      await waitFor(()=>page.evaluate(`${read}.then(state=>!!state.notice)`),{label:'notice after reload'});
      const reloadedBeforeChoice=await page.evaluate(read);
      assert.match(reloadedBeforeChoice.message,/Browser data was cleared on .*can be restored from your Device Folder, Google Drive or a backup file/);
      assert.equal(reloadedBeforeChoice.paused,true,'the pause comes back with the notice');
      assert.equal(reloadedBeforeChoice.note,'SiteDataQA note edited after clearing');assert.equal(reloadedBeforeChoice.session,true);assert.equal(reloadedBeforeChoice.savedPlans,1);
      result.checks.reloadKeepsDecision=true;

      await click(page,'Continue with current data');
      await waitFor(()=>page.evaluate(`${read}.then(state=>!state.notice&&!state.paused)`),{label:'continue with current data'});
      result.checks.continueResumesBackups=true;

      await reload(page);await page.evaluate(`new Promise(resolve=>setTimeout(resolve,1000))`);
      const reloaded=await page.evaluate(read);
      assert.equal(reloaded.notice,null,'a resolved clear stays resolved');assert.equal(reloaded.cleared,null);
      assert.equal(reloaded.note,'SiteDataQA note edited after clearing');assert.equal(reloaded.savedPlans,1);assert.equal(reloaded.session,true);assert.equal(reloaded.name,'SiteDataQA');assert.equal(reloaded.paused,false);
      result.checks.survivesReload=true;
      noRuntimeErrors(page);
    }finally{if(page)await browser.closePage(page).catch(()=>{});await browser.close();}
  }

  // With a connected Device Folder: past Saved Days come back without a question.
  {
    const browser=await launchChromium({profilePrefix:'study-director-qa-site-data-clear-folder-'});let page=null;
    try{
      page=await browser.createPage(server.url('deployment','instrumented.html'),{preload:folderPreload,viewport:{width:1280,height:860,mobile:false,scale:1}});
      await waitForStudyDirector(page,{instrumented:true});
      await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().hasControl`),{label:'primary ownership'});
      const yesterday=await page.evaluate(`(async()=>{const d=__PWA6,day=new Date(d.todayISO()+'T12:00:00');day.setDate(day.getDate()-1);const date=[day.getFullYear(),String(day.getMonth()+1).padStart(2,'0'),String(day.getDate()).padStart(2,'0')].join('-'),stamp=new Date(Date.now()-86400000).toISOString();
        await d.AppData.dailyRecords.saveBatch([{version:${CURRENT_SCHEMA_VERSIONS.DailyRecord},recordKind:'study',date,savedAt:stamp,updatedAt:stamp,sourceRevision:1,reflection:'FolderQA yesterday',quote:'',studyQuality:4,realTimeSnapshot:null,
          schedule:[{id:'folderqa-yesterday-1',start:'09:00',duration:30,name:'Yesterday Block',kind:'work',area:'Medicine',measure:'pages',target:10}],results:{},practiceRuns:[],carryForwardDraft:''}]);return date;})()`);
      const remember=`window.__qaYesterday=${JSON.stringify(yesterday)}`;
      await page.evaluate(remember);
      await page.evaluate(startSession('FolderQA'));
      const backup=await page.evaluate(`(async()=>{const d=__PWA6;await d.DeviceBackup.connect();return await d.DeviceBackup.backupNow()===true;})()`);
      assert.equal(backup,true);
      const before=await page.evaluate(read);
      assert.equal(before.yesterday,'FolderQA yesterday');assert.equal(before.folder,true);assert.equal(before.mode,'running');
      const repository=await page.evaluate(`__PWA6.DeviceBackup.status().repositoryName`);assert.ok(repository);

      await page.send('Storage.clearDataForOrigin',{origin:server.origin,storageTypes:'indexeddb,local_storage,cache_storage,service_workers'});
      assert.equal(await editNote(page,'FolderQA note edited after clearing'),'changed');
      await waitFor(()=>page.evaluate(restoreReported),{label:'automatic restore',timeout:60000});
      assert.equal(await page.evaluate(`!!${restoredToast}`),false,'the restore pop-up waits while a work block runs');
      const restored=await page.evaluate(read);
      assert.equal(restored.yesterday,'FolderQA yesterday','the missing Saved Day is added back from the latest backup');
      assert.equal(restored.note,'FolderQA note edited after clearing','notes written after the clear are kept');
      assert.equal(restored.session,true);assert.equal(restored.mode,'running','the running session is untouched');
      assert.equal(restored.notice,null,'no decision is needed');assert.equal(restored.paused,false,'automatic backups resume');
      await page.evaluate(`__PWA6.togglePause()`);
      await waitFor(()=>page.evaluate(`!!${restoredToast}`),{label:'the restore pop-up shows at a pause',timeout:10000});
      await page.evaluate(`__PWA6.togglePause()`);
      result.checks.automaticMissingOnlyRestore=true;
      assert.equal(await page.evaluate(`__PWA6.DeviceBackup.backupNow().then(result=>result===true)`),true,'the combined state backs up completely');
      result.checks.restoredStateBacksUp=true;

      await reload(page);await page.evaluate(remember);
      const reloaded=await page.evaluate(read);
      assert.equal(reloaded.yesterday,'FolderQA yesterday');assert.equal(reloaded.note,'FolderQA note edited after clearing');assert.equal(reloaded.session,true);
      // The folder reconnects in the background just after startup.
      await waitFor(()=>page.evaluate(`__PWA6.DeviceBackup.status().connected`),{label:'the Device Folder is remembered after the clear'});
      // The open tab wrote the device ID back, so the reload keeps backing up
      // into the same folder rather than starting a new one.
      await waitFor(()=>page.evaluate(`__PWA6.DeviceBackup.status().repositoryName===${JSON.stringify(repository)}`),{label:'same backup folder after the clear'});
      result.checks.folderRemembered=true;

      // Without a connected folder the clear needs a decision; after a reload,
      // reconnecting the folder adds the missing Saved Day back by itself. The
      // open tab wrote this device's ID back, so the folder's backups are
      // still this device's: nothing to pick.
      await page.evaluate(`__PWA6.DeviceBackup.disconnect()`);
      await page.send('Storage.clearDataForOrigin',{origin:server.origin,storageTypes:'indexeddb,local_storage,cache_storage,service_workers'});
      assert.equal(await editNote(page,'FolderQA note edited after second clear'),'changed');
      await waitFor(()=>page.evaluate(`${read}.then(state=>!!state.notice)`),{label:'decision notice without folder'});
      await reload(page);await page.evaluate(remember);
      await waitFor(()=>page.evaluate(`${read}.then(state=>!!state.notice&&!state.folder)`),{label:'notice after reload'});
      assert.equal((await page.evaluate(read)).yesterday,null,'the Saved Day is missing until a restore');
      await page.evaluate(`document.getElementById('connect-device-backup').click()`);
      await waitFor(()=>page.evaluate(restoreReported),{label:'restore after reconnecting',timeout:60000});
      await waitFor(()=>page.evaluate(`${read}.then(state=>!state.notice)`),{label:'notice resolved after reconnecting'});
      const reconnected=await page.evaluate(read);
      assert.equal(reconnected.yesterday,'FolderQA yesterday');assert.equal(reconnected.note,'FolderQA note edited after second clear');
      assert.equal(reconnected.notice,null);assert.equal(reconnected.paused,false);assert.equal(reconnected.cleared,null);assert.equal(reconnected.folder,true);
      result.checks.reconnectAfterReloadRestores=true;
      noRuntimeErrors(page);
    }finally{if(page)await browser.closePage(page).catch(()=>{});await browser.close();}
  }

  // Without Device Folder support (iPad, iPhone): the startup hint and the clear
  // notice offer Google Drive and a backup file, and "Restore from backup" opens
  // Data & Backup with both in view.
  {
    const browser=await launchChromium({profilePrefix:'study-director-qa-site-data-clear-nofolder-'});let page=null;
    try{
      page=await browser.createPage(server.url('deployment','instrumented.html'),{preload:noFolderPreload,viewport:{width:390,height:844,mobile:true,scale:2}});
      await waitForStudyDirector(page,{instrumented:true});
      await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().hasControl`),{label:'primary ownership'});
      assert.equal(await page.evaluate(`__PWA6.DeviceBackup.status().supported`),false);
      const hint=toast('/No local study data found/');
      // A brand-new install has never saved study data here, so it gets no hint.
      await new Promise(resolve=>setTimeout(resolve,1500));
      assert.equal(await page.evaluate(`!!${hint}`),false,'a brand-new install sees no empty-data hint');
      // Study data saved here and then lost with the database while the app was closed.
      await page.evaluate(`(async()=>{const d=__PWA6;d.AppData.notes.update('medicine','Medicine','NoFolderQA lost note','');await d.AppData.notes.flush({strict:true});})()`);
      await page.navigate(server.url('deployment','license.html'));
      await page.send('Storage.clearDataForOrigin',{origin:server.origin,storageTypes:'indexeddb,file_systems'});
      page.events.splice(0);// what the stand-in page logged is not the app's
      await page.navigate(server.url('deployment','instrumented.html'));
      await waitForStudyDirector(page,{instrumented:true});
      await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().hasControl`),{label:'primary ownership after the loss'});
      await waitFor(()=>page.evaluate(`!!${hint}`),{label:'empty-data hint'});
      const hintText=await page.evaluate(`${hint}.textContent`);
      assert.match(hintText,/restore from Google Drive or a backup file/);assert.doesNotMatch(hintText,/Device Folder/,'no folder is offered where folders are unsupported');
      await page.evaluate(`[...${hint}.querySelectorAll('button')].find(button=>button.textContent.trim()==='Restore from backup').click()`);
      await waitFor(()=>page.evaluate(`${restoreView}.importButton`),{label:'restore choices in view'});
      const fromHint=await page.evaluate(restoreView);
      assert.deepEqual({...fromHint,folderRow:undefined},{tab:'pane-library',drawer:true,importButton:true,driveRow:true,folderRow:undefined},'Data & Backup opens with Google Drive and the backup file import in view');
      result.checks.noFolderStartupHint=true;result.checks.freshInstallNoHint=true;

      await page.evaluate(`(async()=>{const d=__PWA6;d.goTab('plan');d.AppData.notes.update('medicine','Medicine','NoFolderQA note','');await d.AppData.notes.flush({strict:true});})()`);
      await page.send('Storage.clearDataForOrigin',{origin:server.origin,storageTypes:'all'});
      // The read only makes the app notice the clear; the clear itself may abort it.
      await page.evaluate(`__PWA6.AppData.notes.readFreshPayload().catch(()=>null)`);
      await waitFor(()=>page.evaluate(`${read}.then(state=>!!state.notice)`),{label:'clear notice without folder support'});
      const cleared=await page.evaluate(read);
      assert.match(cleared.message,/can be restored from Google Drive or a backup file/);
      assert.doesNotMatch(cleared.message,/Device Folder|Automatic backups/,'neither a folder nor automatic backups are mentioned');
      assert.equal(cleared.note,'NoFolderQA note');
      await click(page,'Restore from backup');
      await waitFor(()=>page.evaluate(`${restoreView}.tab==='pane-library'&&${restoreView}.importButton`),{label:'restore choices after the clear'});
      assert.ok((await page.evaluate(read)).notice,'the notice stays until a restore or a choice');
      result.checks.noFolderRestoreChoices=true;
      noRuntimeErrors(page);
    }finally{if(page)await browser.closePage(page).catch(()=>{});await browser.close();}
  }

  // Two tabs: the background tab is first to reopen storage after the clear. It
  // tells the tab in control, which writes its copy back and shows the decision.
  {
    const browser=await launchChromium({profilePrefix:'study-director-qa-site-data-clear-tabs-'}),pages=[];
    try{
      const owner=await browser.createPage(server.url('deployment','instrumented.html'),{preload,viewport:{width:1280,height:860,mobile:false,scale:1}});pages.push(owner);
      await waitForStudyDirector(owner,{instrumented:true});await waitFor(()=>owner.evaluate(`__PWA6.AppOwnership.status().hasControl`),{label:'owner control'});
      await owner.evaluate(`(async()=>{const d=__PWA6;d.AppData.notes.update('medicine','Medicine','TabsQA note','');await d.AppData.notes.flush({strict:true});})()`);
      const other=await browser.createPage(server.url('deployment','instrumented.html'),{preload,viewport:{width:1280,height:860,mobile:false,scale:1}});pages.push(other);
      await waitForStudyDirector(other,{instrumented:true});await waitFor(()=>other.evaluate(`!__PWA6.AppOwnership.status().hasControl`),{label:'background tab'});
      // A tab cannot classify its first-ever database open as a *reopen*
      // after deletion. Establish its original connection before clearing,
      // as a background tab that has already inspected notes would do.
      assert.ok(await other.evaluate(`__PWA6.AppData.notes.readFreshPayload().then(rows=>Object.values(rows).some(row=>row.text==='TabsQA note'))`),'the background tab must first have seen the old database');
      await owner.send('Storage.clearDataForOrigin',{origin:server.origin,storageTypes:'all'});
      await other.evaluate(`__PWA6.AppData.notes.readFreshPayload().catch(()=>null)`);
      try{
        await waitFor(()=>other.evaluate(`__PWA6.IndexedDb.lifecycle().resets===1`),{label:'background tab counted the clear'});
      }catch(error){
        const state=await Promise.all(pages.map(async tab=>tab.evaluate(`(async()=>({
          lifecycle:__PWA6.IndexedDb.lifecycle(),
          ownership:__PWA6.AppOwnership.status(),
          notes:(await __PWA6.AppData.notes.readFreshPayload().catch(err=>({error:String(err)}))),
          databaseNames:typeof indexedDB.databases==='function'?await indexedDB.databases():[],
          storageHealth:__PWA6.readStorageHealth()
        }))()`).catch(err=>({error:String(err)}))));
        throw new Error(`${error.message}; diagnostic ${JSON.stringify(state).slice(0,5000)}`,{cause:error});
      }
      await waitFor(()=>owner.evaluate(`${read}.then(state=>!!state.notice&&state.note==='TabsQA note')`),{label:'owner handles the clear',timeout:30000});
      assert.equal(await owner.evaluate(`__PWA6.IndexedDb.lifecycle().resets`),0,'the tab in control learned of the clear from the other tab');
      assert.equal(await other.evaluate(`!!${decision}`),false,'only the tab in control asks for a decision');
      result.checks.backgroundTabHandsOverClear=true;
      for(const page of pages)noRuntimeErrors(page);
    }finally{for(const page of pages)await browser.closePage(page).catch(()=>{});await browser.close();}
  }
}finally{await server.close();}
console.log(JSON.stringify(result,null,2));
