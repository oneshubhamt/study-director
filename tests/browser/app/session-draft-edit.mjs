import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitForStudyDirector,waitFor} from '../../helpers/browser-harness.mjs';

// A different plan draft, edited on the Plan tab or brought in by Drive sync,
// must not change the session that is running. The saved session keeps the
// applied plan, so it stays valid: the Practice Pacer run is saved, and a
// backup captures the session in full instead of stopping as incomplete.
const preload=`(()=>{localStorage.getItem('studyDirector.profiles.v1')||localStorage.setItem('studyDirector.profiles.v1',JSON.stringify({version:1,active:'prof_qa_mve00000_abcdef01',profiles:[{id:'prof_qa_mve00000_abcdef01',scope:'',name:'QA',email:'',folder:'',createdAt:'2026-08-01T00:00:00.000Z',fresh:false,from:null}],removing:[]}));})();`;
const runPlan=`(async()=>{const d=__PWA6,now=new Date(),m=now.getHours()*60+now.getMinutes(),fmt=v=>String(Math.floor((v+1440)%1440/60)).padStart(2,'0')+':'+String((v+1440)%1440%60).padStart(2,'0');document.getElementById('plan-input').value=fmt(m-5)+' | 60 | Editor QA Block | work | Surgery | pages | 5';const result=d.applySchedule({skipNotify:true});if(result&&result.then)await result;d.goTab('execute');await new Promise(r=>setTimeout(r,50));d.setCurrentTask(0);d.TimerEngine.startCur();await new Promise(r=>setTimeout(r,300));return d.TimerState.snapshot().mode;})()`;
const server=await startReleaseServer(),browser=await launchChromium({profilePrefix:'sd-session-draft-'});
try{
  const page=await browser.createPage(server.url('deployment','instrumented.html'),{preload});
  await waitForStudyDirector(page,{instrumented:true});
  await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().hasControl`),{label:'ownership'});
  const applied=await page.evaluate(`(async()=>{const d=__PWA6,wait=ms=>new Promise(r=>setTimeout(r,ms)),now=new Date(),m=now.getHours()*60+now.getMinutes(),fmt=v=>String(Math.floor((v+1440)%1440/60)).padStart(2,'0')+':'+String((v+1440)%1440%60).padStart(2,'0');
    document.getElementById('plan-input').value=[fmt(m-5)+' | 60 | Draft QA Block | work | Medicine | questions | 12',fmt(m+55)+' | 30 | Draft QA Review | support | Planning | block | 1'].join('\\n');
    const result=d.applySchedule({skipNotify:true});if(result&&result.then)await result;
    d.goTab('execute');await wait(50);d.setCurrentTask(0);d.TimerEngine.startCur();await wait(200);
    // A different draft arrives mid-session.
    document.getElementById('plan-input').value='08:00 | 30 | Other Draft | work | Ethics | pages | 5';
    await d.PlanDraftEditor.save();const previewed=d.PlanDraftEditor.preview({silent:true});d.goTab('execute');await wait(100);
    return {mode:d.TimerState.snapshot().mode,previewed};})()`);
  assert.deepEqual(applied,{mode:'running',previewed:true},'the session runs and the other draft previews');

  await page.click('[data-action="practice-start"]');
  await waitFor(()=>page.evaluate(`document.getElementById('practice-pacer-state').textContent==='Running'`),{label:'pacer running'});
  const stored=await page.evaluate(`(async()=>{const d=__PWA6;await d.flushLiveDraft();const session=(await d.AppData.activeSession.load()).value;return {schedule:session?.scheduleText||'',pacer:!!session?.snapshot?.practice?.active};})()`);
  assert.match(stored.schedule,/Draft QA Block/u,'the saved session keeps the applied plan');
  assert.doesNotMatch(stored.schedule,/Other Draft/u,'the draft does not leak into the saved session');
  assert.equal(stored.pacer,true,'the Practice Pacer run is saved');

  const capture=await page.evaluate(`__PWA6.BackupController.createCheckpoint().then(file=>({ok:true,warning:String(file.warning||'')}),error=>({ok:false,error:String(error&&error.message||error)}))`);
  assert.equal(capture.ok,true,`a backup captures the session (${capture.error||''})`);
  assert.doesNotMatch(capture.warning,/from memory/u,'the session comes from storage, not memory');

  // While the timer runs on a work block, news (a pop-up that blocks nothing)
  // waits and a blocking one shows; pausing shows the one that waited, and so does
  // moving on to a support block (docs/areas/status-indicator.md, noise rules).
  const hold=await page.evaluate(`(async()=>{const d=__PWA6,wait=ms=>new Promise(r=>setTimeout(r,ms)),shown=text=>[...document.querySelectorAll('#sd-toast-region .interaction-toast')].some(node=>node.textContent.includes(text));
    d.Interactions.notify({source:'sync',key:'kept-new',kind:'warning',tier:'news',title:'Kept for review',message:'One version was kept.'});
    d.Interactions.notify({source:'qa',key:'blocking',kind:'warning',tier:'blocking',title:'Needs password',message:'Enter it to keep syncing.'});
    await wait(200);const running={mode:d.TimerState.mode,kept:shown('Kept for review'),blocking:shown('Needs password')};
    d.togglePause();await wait(300);const paused={mode:d.TimerState.mode,kept:shown('Kept for review')};
    d.togglePause();await wait(200);
    d.Interactions.notify({source:'sync',key:'qa-waiting',kind:'warning',tier:'news',title:'Waiting pop-up',message:'Blocks nothing.'});
    await wait(200);const working={mode:d.TimerState.mode,waiting:shown('Waiting pop-up')};
    d.markDone();await wait(300);const support={mode:d.TimerState.mode,kind:d.TimerState.tasks[d.TimerState.currentIndex]?.kind||'',waiting:shown('Waiting pop-up')};
    return {running,paused,working,support};})()`);
  assert.deepEqual(hold,{running:{mode:'running',kept:false,blocking:true},paused:{mode:'paused',kept:true},working:{mode:'running',waiting:false},support:{mode:'running',kind:'support',waiting:true}},'pop-ups that block nothing wait only while a work block runs');

  // Editors stay usable (backlog item 19): Finish Block above moved Execute
  // to the support block, and its note has a live editor, not a read-only
  // preview.
  const live=selector=>page.evaluate(`!!document.querySelector('${selector} ~ .sd-rte [contenteditable="true"]')`);
  await waitFor(()=>live('#pn-extra'),{label:'the next block\'s note has its editor',timeout:3000});

  // BF-1: a previous-day Active Session is only an unsaved recovery candidate
  // when its content is newer than the Saved Day. Seed yesterday with an exact
  // saved acknowledgement, reload, and require startup to retire the redundant
  // recovery copy without asking to save the day again. Today's session is
  // reset first: the page saves its live session as it unloads, which would
  // replace the seeded one.
  const coveredPrevious=await page.evaluate(`(async()=>{const d=__PWA6,wait=ms=>new Promise(r=>setTimeout(r,ms));d.TimerEngine.stopExecution();d.goTab('review');await wait(120);d.setStudyQuality(4,{save:false});if(!await d.saveDayRecord())throw new Error('BF1 fixture Save Today failed');const today=d.todayISO(),dateObject=new Date(today+'T12:00:00');dateObject.setDate(dateObject.getDate()-1);const yesterday=[dateObject.getFullYear(),String(dateObject.getMonth()+1).padStart(2,'0'),String(dateObject.getDate()).padStart(2,'0')].join('-'),record=await d.AppData.dailyRecords.get(today),loaded=await d.AppData.activeSession.load(),session=structuredClone(loaded.value);if(!record||!session)throw new Error('BF1 fixture state missing');const reset=d.resetTodaySession();await wait(150);document.querySelector('#sd-interaction-dialog .interaction-actions .danger')?.click();await reset;if((await d.AppData.activeSession.load()).value)throw new Error('BF1 fixture could not end today\\'s session');const stamp=new Date().toISOString(),saved={...record,date:yesterday,savedAt:stamp,updatedAt:stamp},snapshot={...session.snapshot,date:yesterday},previous={...session,date:yesterday,snapshot,status:'active',updatedAt:stamp};await d.AppData.dailyRecords.save(saved);const stored=await d.AppData.activeSession.save(previous,{strictDurability:true});if(stored?.ok===false)throw stored.error||new Error('BF1 previous session save failed');return {yesterday,sourceRevision:Number(saved.sourceRevision),contentRevision:Number(snapshot.contentRevision)};})()`);
  assert.ok(coveredPrevious.sourceRevision>=coveredPrevious.contentRevision,'the previous-day Saved Day covers the recovery content revision');
  await page.reload();await waitForStudyDirector(page,{instrumented:true});await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().hasControl`),{label:'ownership after covered previous-day reload'});
  await waitFor(()=>page.evaluate(`__PWA6.AppData.activeSession.load().then(result=>result.value===null)`),{label:'covered previous-day recovery retired'});
  assert.equal(await page.evaluate(`document.getElementById('sd-interaction-dialog')?.textContent.includes('Unsaved previous study day found')||false`),false,'a Saved Day that covers the recovery session is not reported as unsaved again');

  // The Diary edits a day saved with Save Today: the repository reads the
  // day as its view and saves it back as its stored fields (this failed with
  // "New daily record failed its canonical validation").
  const diaryEdit=await page.evaluate(`(async()=>{const d=__PWA6,date=d.todayISO(),o=new Date(date+'T12:00:00');o.setDate(o.getDate()-1);
    const yesterday=[o.getFullYear(),String(o.getMonth()+1).padStart(2,'0'),String(o.getDate()).padStart(2,'0')].join('-'),before=await d.AppData.dailyRecords.get(yesterday);
    const later='WG1:'+JSON.stringify({version:1,doc:{type:'Doc',content:[{type:'Paragraph',content:[{type:'Text',param:'Edited later in the Diary'}]}]}});
    try{await d.DailyReflectionPersistence.commit(yesterday,later,{expectedCanonical:String(before?.reflection||'')});}catch(error){return {kind:before?.recordKind,error:String(error?.message||error)};}
    const after=await d.AppData.dailyRecords.get(yesterday);return {kind:after?.recordKind,edited:after?.reflection===later,results:Object.keys(after?.results||{}).length};})()`);
  assert.deepEqual(diaryEdit,{kind:'study',edited:true,results:2},'the Diary edit of a saved study day saves, and keeps the day');

  // On Review, a session lifecycle step (as a sync bringing in the session
  // runs) keeps the reflection's editor, cursor and text; a reflection that
  // changed elsewhere is taken in, and saved as such (backlog item 19).
  assert.equal(await page.evaluate(runPlan),'running','a new plan runs');
  await page.evaluate(`__PWA6.goTab('review')`);await waitFor(()=>live('#daily-reflection'),{label:'reflection editor',timeout:3000});
  await page.click('#daily-reflection ~ .sd-rte [contenteditable="true"]');await page.send('Input.insertText',{text:'Kept through a sync'});
  const step=await page.evaluate(`(async()=>{const d=__PWA6,editor=()=>document.querySelector('#daily-reflection ~ .sd-rte [contenteditable="true"]'),before=editor();
    d.SessionLifecycle.reconcile('qa-sync',{date:d.todayISO()});await new Promise(r=>setTimeout(r,500));
    const kept={same:editor()===before,text:editor()?.textContent,focused:!!document.activeElement?.closest?.('.sd-rte')};
    await d.ReviewEditor.flushPending();await d.ReviewEditor.settled();const stored=(await d.AppData.activeSession.load()).value;
    await d.restoreSessionStateThroughLifecycle({...stored,revision:stored.revision+1,snapshot:{...stored.snapshot,review:{...stored.snapshot.review,reflection:'WG1:'+JSON.stringify({version:1,doc:{type:'Doc',content:[{type:'Paragraph',content:[{type:'Text',param:'Changed elsewhere'}]}]}})}}},{keepRunning:true});await new Promise(r=>setTimeout(r,500));
    await d.ReviewEditor.flushPending();await d.ReviewEditor.settled();const saved=(await d.AppData.activeSession.load()).value.snapshot.review.reflection;
    return {kept,arrived:editor()?.textContent,saved:saved.includes('Changed elsewhere')&&!saved.includes('Kept through')};})()`);
  assert.deepEqual(step,{kept:{same:true,text:'Kept through a sync',focused:true},arrived:'Changed elsewhere',saved:true},'a lifecycle step keeps the editor; a change from elsewhere is taken in and saved as such');

  assert.deepEqual(page.warnings.filter(text=>/\[Study Director\]/u.test(text)),[],'no session save failed');
  assert.deepEqual(page.events.filter(event=>!/favicon|ResizeObserver loop/iu.test(event.text||'')),[]);
  console.log(JSON.stringify({status:'PASS',checks:{appliedPlanKept:true,pacerSaved:true,backupComplete:true,popUpsWaitOnlyDuringWorkBlocks:true,coveredPreviousDayRetired:true,diaryEditsSavedStudyDay:true}}));
}finally{await browser.close();await server.close();}
