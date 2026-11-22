import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitForStudyDirector,waitFor} from '../../helpers/browser-harness.mjs';

const preload=`(()=>{const d=new Date(),today=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');localStorage.setItem('studyDirector.userDefaults.v1',JSON.stringify({version:1,studentName:'CoreFlowQA QA',updatedAt:new Date().toISOString()}));(localStorage.getItem('studyDirector.profiles.v1')||localStorage.setItem('studyDirector.profiles.v1',JSON.stringify({version:1,active:'prof_qa_mve00000_abcdef01',profiles:[{id:'prof_qa_mve00000_abcdef01',scope:'',name:'',email:'',folder:'',createdAt:'2026-08-01T00:00:00.000Z',fresh:false,from:null}],removing:[]})));})();`;
const server=await startReleaseServer(),browser=await launchChromium({profilePrefix:'study-director-qa-core-'});let page=null;
const result={status:'PASS',release:server.manifest.release,checks:{}};
async function editReflection(text,quality){
  await page.evaluate(`__PWA6.goTab('review')`);
  await waitFor(()=>page.evaluate(`!!document.querySelector('.sd-rte[data-sd-rich-surface="reflection"] .sd-rte-editor[contenteditable="true"]')`),{label:'reflection editor mounted'});
  await page.evaluate(`(()=>{const editor=document.querySelector('.sd-rte[data-sd-rich-surface="reflection"] .sd-rte-editor');editor.focus();const range=document.createRange();range.selectNodeContents(editor);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);})()`);
  await page.send('Input.insertText',{text});
  return page.evaluate(`(async()=>{const d=__PWA6;d.RichTextRuntime.flushEditors();d.setStudyQuality(${quality},{save:false});const accepted=d.ReviewEditor.saveReview({strict:true});await d.ReviewEditor.flushPending();await d.ReviewEditor.settled();const session=await d.AppData.activeSession.load();return {accepted,review:session.value?.snapshot?.review?{...session.value.snapshot.review,reflection:StudyDirectorRichText.toPlainText(session.value.snapshot.review.reflection)}:null,record:await d.AppData.dailyRecords.get(d.todayISO())};})()`);
}

try{
  page=await browser.createPage(server.url('deployment','instrumented.html'),{preload,viewport:{width:1280,height:860,mobile:false,scale:1}});
  await waitForStudyDirector(page,{instrumented:true});
  await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().hasControl`),{label:'primary ownership'});
  // Start-up and the background jobs it wakes log nothing on a clean start.
  await page.evaluate(`new Promise(resolve=>setTimeout(resolve,1500))`);
  assert.deepEqual(page.warnings.filter(text=>/\[Study Director\]/.test(text)),[],'a clean startup logs no app warnings');result.checks.cleanStartup=true;
  const setup=await page.evaluate(`(async()=>{const d=__PWA6,wait=ms=>new Promise(r=>setTimeout(r,ms)),now=new Date(),m=now.getHours()*60+now.getMinutes()-1,fmt=v=>String(Math.floor((v+1440)%1440/60)).padStart(2,'0')+':'+String((v+1440)%1440%60).padStart(2,'0');document.getElementById('plan-input').value=[fmt(m)+' | 20 | CoreFlowQA Core Block | work | Medicine | pages | 12',fmt(m+20)+' | 10 | CoreFlowQA Review | support | Planning | block | 1'].join('\\n');const applied=await d.applySchedule({skipNotify:true});d.goTab('execute');d.TimerEngine.startCur(2);await wait(120);const running=d.TimerState.snapshot().mode;d.TimerEngine.togglePause();await wait(30);const paused=d.TimerState.snapshot().paused;d.TimerEngine.stopExecution();return {applied,running,paused,date:d.todayISO()};})()`);
  assert.equal(setup.applied,true);assert.equal(setup.running,'running');assert.equal(setup.paused,true);
  const initial=await editReflection('CoreFlowQA durable reflection',4);assert.equal(initial.accepted,true);assert.equal(initial.review?.reflection,'CoreFlowQA durable reflection');assert.equal(initial.review?.studyQuality,4);
  const storage=await page.evaluate(`(async()=>({session:(await __PWA6.AppData.activeSession.load()).value,reflection:StudyDirectorRichText.toPlainText((await __PWA6.AppData.activeSession.load()).value.snapshot.review.reflection),records:(await __PWA6.AppData.dailyRecords.list()).length}))()`);
  assert.equal(storage.reflection,'CoreFlowQA durable reflection');assert.equal(storage.records,0);result.checks.planTimerReviewIndexedDb=true;

  await page.reload();await waitForStudyDirector(page,{instrumented:true});await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().hasControl`),{label:'ownership after reload'});
  await page.evaluate(`__PWA6.goTab('review')`);await waitFor(()=>page.evaluate(`StudyDirectorRichText.toPlainText(document.getElementById('daily-reflection').value)==='CoreFlowQA durable reflection'`),{label:'reflection reload'});
  const newer=await editReflection('Newer active-session review',5);
  assert.equal(newer.accepted,true);assert.equal(newer.review.reflection,'Newer active-session review');assert.equal(newer.review.studyQuality,5);assert.equal(newer.record,null);result.checks.reviewPersistsOnlyInActiveSessionUntilSave=true;

  await page.reload();await waitForStudyDirector(page,{instrumented:true});await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().hasControl`),{label:'second ownership after reload'});await page.evaluate(`__PWA6.goTab('review')`);await waitFor(()=>page.evaluate(`StudyDirectorRichText.toPlainText(document.getElementById('daily-reflection').value)==='Newer active-session review'`),{label:'newer review reload'});
  const saved=await page.evaluate(`(async()=>{const d=__PWA6;await d.saveDayRecord();const record=await d.AppData.dailyRecords.get(d.todayISO());d.goTab('library');d.LibraryView.invalidate();d.LibraryView.render();await new Promise(r=>setTimeout(r,100));const first=await d.BackupController.createCheckpoint(),inspected=await d.BackupController.inspect(first.blob,{filename:first.filename}),second=await d.BackupController.createCheckpoint();return {record:{...record,reflection:StudyDirectorRichText.toPlainText(record.reflection)},libraryCards:document.querySelectorAll('.library-card').length,first:{size:first.blob.size,counts:first.counts},preview:inspected.preview,second:{size:second.blob.size,counts:second.counts}};})()`);
  assert.equal(saved.record.reflection,'Newer active-session review');assert.ok(saved.first.size>0&&saved.second.size>0);assert.equal(saved.first.counts.dailyRecord,1);assert.equal(Object.prototype.hasOwnProperty.call(saved.first.counts,'reflectionDraft'),false);assert.deepEqual(saved.second.counts,saved.first.counts);result.checks.savedDaySaveBackupReexport=true;
  const unexpected=page.events.filter(event=>!/favicon|ResizeObserver loop/i.test(event.text||''));assert.deepEqual(unexpected,[]);result.checks.noRuntimeErrors=true;
}finally{if(page)await browser.closePage(page).catch(()=>{});await browser.close();await server.close();}
console.log(JSON.stringify(result,null,2));
