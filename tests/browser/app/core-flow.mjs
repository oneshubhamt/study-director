import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitForStudyDirector,waitFor} from '../../helpers/browser-harness.mjs';

const preload=`(()=>{const d=new Date(),today=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');localStorage.setItem('studyDirector.userDefaults.v1',JSON.stringify({version:1,studentName:'CoreFlowQA QA',updatedAt:new Date().toISOString()}));(localStorage.getItem('studyDirector.profiles.v1')||localStorage.setItem('studyDirector.profiles.v1',JSON.stringify({version:1,active:'prof_qa_mve00000_abcdef01',profiles:[{id:'prof_qa_mve00000_abcdef01',scope:'',name:'',email:'',folder:'',createdAt:'2026-08-01T00:00:00.000Z',fresh:false,from:null}],removing:[]})));})();`;
const server=await startReleaseServer();let browser=null,freshBrowser=null,page=null,freshPage=null;
const result={status:'PASS',release:server.manifest.release,checks:{}};
async function editReflection(text,quality){
  await page.click('[data-tab="review"]');
  await waitFor(()=>page.evaluate(`document.querySelector('.pane.on')?.id==='pane-review'&&!!document.querySelector('.sd-rte[data-sd-rich-surface="reflection"] .sd-rte-editor[contenteditable="true"]')`),{label:'reflection editor mounted through Review navigation'});
  await page.evaluate(`(()=>{const editor=document.querySelector('.sd-rte[data-sd-rich-surface="reflection"] .sd-rte-editor');editor.focus();const range=document.createRange();range.selectNodeContents(editor);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);})()`);
  await page.send('Input.insertText',{text});
  await page.click(`[data-quality="${quality}"]`);
  await page.evaluate(`document.querySelector('.sd-rte[data-sd-rich-surface="reflection"] .sd-rte-editor')?.blur()`);
  return page.evaluate(`(async()=>{const d=__PWA6;d.RichTextRuntime.flushEditors();await d.ReviewEditor.flushPending();await d.ReviewEditor.settled();const session=await d.AppData.activeSession.load();return {accepted:session.value?.snapshot?.review?.studyQuality===${quality},review:session.value?.snapshot?.review?{...session.value.snapshot.review,reflection:StudyDirectorRichText.toPlainText(session.value.snapshot.review.reflection)}:null,record:await d.AppData.dailyRecords.get(d.todayISO())};})()`);
}

try{
  freshBrowser=await launchChromium({profilePrefix:'study-director-qa-core-fresh-'});
  freshPage=await freshBrowser.createPage(server.url('deployment','instrumented.html'),{viewport:{width:1280,height:860,mobile:false,scale:1}});
  await waitForStudyDirector(freshPage,{instrumented:true});
  await waitFor(()=>freshPage.evaluate(`__PWA6.AppOwnership.status().hasControl&&document.getElementById('first-start-dialog')?.open===true`),{label:'cold fresh-profile startup'});
  const freshState=await freshPage.evaluate(`(()=>({profile:__PWA6.Profiles.current(),apiFrozen:Object.isFrozen(StudyDirector),startup:__PWA6.StartupLifecycle.status()}))()`);
  assert.equal(freshState.profile?.fresh,true,'a pristine browser profile must enter first-start as a fresh profile');
  assert.equal(freshState.apiFrozen,true,'public capabilities must already be frozen when fresh-profile startup completes');
  assert.equal(freshState.startup.fullyInitialized,true,'fresh-profile startup must reach the checked lifecycle boundary');
  result.checks.coldFreshProfileStartup=true;
  await freshBrowser.closePage(freshPage);freshPage=null;await freshBrowser.close();freshBrowser=null;

  browser=await launchChromium({profilePrefix:'study-director-qa-core-'});
  page=await browser.createPage(server.url('deployment','instrumented.html'),{preload,viewport:{width:1280,height:860,mobile:false,scale:1}});
  await waitForStudyDirector(page,{instrumented:true});
  await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().hasControl`),{label:'primary ownership'});
  // Start-up and the background jobs it wakes log nothing on a clean start.
  await page.evaluate(`new Promise(resolve=>setTimeout(resolve,1500))`);
  assert.deepEqual(page.warnings.filter(text=>/\[Study Director\]/.test(text)),[],'a clean startup logs no app warnings');result.checks.cleanStartup=true;
  await page.evaluate(`(()=>{const now=new Date(),m=now.getHours()*60+now.getMinutes()-1,fmt=v=>String(Math.floor((v+1440)%1440/60)).padStart(2,'0')+':'+String((v+1440)%1440%60).padStart(2,'0'),field=document.getElementById('plan-input');field.value=[fmt(m)+' | 20 | CoreFlowQA Core Block | work | Medicine | pages | 12',fmt(m+20)+' | 10 | CoreFlowQA Review | support | Planning | block | 1'].join('\\n');field.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText'}));})()`);
  await waitFor(()=>page.evaluate(`document.querySelector('[data-action="apply-schedule"]')?.disabled===false`),{label:'Plan Apply delegated control enabled'});
  await page.click('[data-action="apply-schedule"]');
  await waitFor(()=>page.evaluate(`document.querySelectorAll('#sched-list .si:not(.draft)').length===2`),{label:'Plan applied through delegated handler'});
  await page.click('[data-tab="execute"]');await waitFor(()=>page.evaluate(`document.querySelector('.pane.on')?.id==='pane-execute'`),{label:'Execute navigation through tab handler'});
  await page.evaluate(`__PWA6.TimerEngine.startCur(2)`);await waitFor(()=>page.evaluate(`__PWA6.TimerState.snapshot().mode==='running'`),{label:'timer fixture running'});
  const runningMode=await page.evaluate(`__PWA6.TimerState.snapshot().mode`);
  await page.click('#cd-card');await waitFor(()=>page.evaluate(`__PWA6.TimerState.snapshot().paused===true`),{label:'timer paused through delegated handler'});
  const setup=await page.evaluate(`(()=>{const d=__PWA6;const result={applied:document.querySelectorAll('#sched-list .si:not(.draft)').length===2,paused:d.TimerState.snapshot().paused,date:d.todayISO()};d.TimerEngine.stopExecution();return result;})()`);
  assert.equal(setup.applied,true);assert.equal(runningMode,'running');assert.equal(setup.paused,true);result.checks.realDelegatedPlanAndTimerHandlers=true;
  const initial=await editReflection('CoreFlowQA durable reflection',4);assert.equal(initial.accepted,true);assert.equal(initial.review?.reflection,'CoreFlowQA durable reflection');assert.equal(initial.review?.studyQuality,4);
  const storage=await page.evaluate(`(async()=>({session:(await __PWA6.AppData.activeSession.load()).value,reflection:StudyDirectorRichText.toPlainText((await __PWA6.AppData.activeSession.load()).value.snapshot.review.reflection),records:(await __PWA6.AppData.dailyRecords.list()).length}))()`);
  assert.equal(storage.reflection,'CoreFlowQA durable reflection');assert.equal(storage.records,0);result.checks.planTimerReviewIndexedDb=true;
  await page.reload();await waitForStudyDirector(page,{instrumented:true});await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().hasControl`),{label:'ownership after reload'});
  await page.click('[data-tab="review"]');
  try{await waitFor(()=>page.evaluate(`document.querySelector('.pane.on')?.id==='pane-review'&&StudyDirectorRichText.toPlainText(document.getElementById('daily-reflection').value)==='CoreFlowQA durable reflection'`),{label:'reflection reload through Review navigation'});}
  catch(error){
    const diagnostics=await page.evaluate(`(async()=>({owner:__PWA6.AppOwnership.status(),lifecycle:__PWA6.SessionLifecycle.status(),startup:__PWA6.StartupLifecycle.status(),session:(await __PWA6.AppData.activeSession.load()).value,review:__PWA6.ReviewEditor.state(),fieldPlain:StudyDirectorRichText.toPlainText(document.getElementById('daily-reflection')?.value||''),editor:document.querySelector('.sd-rte[data-sd-rich-surface="reflection"] .sd-rte-editor')?.textContent||'',activePane:document.querySelector('.pane.on')?.id||''}))()`);
    throw new Error(error.message+'; diagnostics='+JSON.stringify(diagnostics),{cause:error});
  }
  const newer=await editReflection('Newer active-session review',5);
  assert.equal(newer.accepted,true);assert.equal(newer.review.reflection,'Newer active-session review');assert.equal(newer.review.studyQuality,5);assert.equal(newer.record,null);result.checks.reviewPersistsOnlyInActiveSessionUntilSave=true;

  await page.reload();await waitForStudyDirector(page,{instrumented:true});await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().hasControl`),{label:'second ownership after reload'});await page.click('[data-tab="review"]');await waitFor(()=>page.evaluate(`document.querySelector('.pane.on')?.id==='pane-review'&&StudyDirectorRichText.toPlainText(document.getElementById('daily-reflection').value)==='Newer active-session review'`),{label:'newer review reload through Review navigation'});
  await page.click('[data-action="save-day"]');
  await waitFor(()=>page.evaluate(`__PWA6.AppData.dailyRecords.get(__PWA6.todayISO()).then(Boolean)`),{label:'Save Today delegated handler persisted the day'});
  await page.click('[data-tab="library"]');await waitFor(()=>page.evaluate(`document.querySelector('.pane.on')?.id==='pane-library'`),{label:'Library navigation through tab handler'});
  const saved=await page.evaluate(`(async()=>{const d=__PWA6,record=await d.AppData.dailyRecords.get(d.todayISO());d.LibraryView.invalidate();d.LibraryView.render();await new Promise(r=>setTimeout(r,100));const first=await d.BackupController.createCheckpoint(),inspected=await d.BackupController.inspect(first.blob,{filename:first.filename}),second=await d.BackupController.createCheckpoint();return {record:{...record,reflection:StudyDirectorRichText.toPlainText(record.reflection)},libraryCards:document.querySelectorAll('.library-card').length,first:{size:first.blob.size,counts:first.counts},preview:inspected.preview,second:{size:second.blob.size,counts:second.counts}};})()`);
  assert.equal(saved.record.reflection,'Newer active-session review');assert.ok(saved.first.size>0&&saved.second.size>0);assert.equal(saved.first.counts.dailyRecord,1);assert.equal(Object.prototype.hasOwnProperty.call(saved.first.counts,'reflectionDraft'),false);assert.deepEqual(saved.second.counts,saved.first.counts);result.checks.savedDaySaveBackupReexport=true;result.checks.realDelegatedReviewAndSaveHandlers=true;
  const unexpected=page.events.filter(event=>!/favicon|ResizeObserver loop/i.test(event.text||''));assert.deepEqual(unexpected,[]);result.checks.noRuntimeErrors=true;
}finally{if(freshPage&&freshBrowser)await freshBrowser.closePage(freshPage).catch(()=>{});if(page&&browser)await browser.closePage(page).catch(()=>{});if(freshBrowser)await freshBrowser.close().catch(()=>{});if(browser)await browser.close().catch(()=>{});await server.close();}
console.log(JSON.stringify(result,null,2));
