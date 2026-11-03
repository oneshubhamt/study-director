import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitForStudyDirector,waitFor} from '../../helpers/browser-harness.mjs';

// A different plan draft, edited on the Plan tab or brought in by Drive sync,
// must not change the session that is running. The saved session keeps the
// applied plan, so it stays valid: the Practice Pacer run is saved, and a
// backup captures the session in full instead of stopping as incomplete.
const preload=`(()=>{localStorage.getItem('studyDirector.profiles.v1')||localStorage.setItem('studyDirector.profiles.v1',JSON.stringify({version:1,active:'prof_qa_mve00000_abcdef01',profiles:[{id:'prof_qa_mve00000_abcdef01',scope:'',name:'QA',email:'',folder:'',createdAt:'2026-08-01T00:00:00.000Z',fresh:false,from:null}],removing:[]}));})();`;
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

  // BF-1: a previous-day Active Session is only an unsaved recovery candidate
  // when its content is newer than the Saved Day. Seed yesterday with an exact
  // saved acknowledgement, reload, and require startup to retire the redundant
  // recovery copy without asking to save the day again.
  const coveredPrevious=await page.evaluate(`(async()=>{const d=__PWA6,wait=ms=>new Promise(r=>setTimeout(r,ms));d.TimerEngine.stopExecution();d.goTab('review');await wait(120);d.setStudyQuality(4,{save:false});if(!await d.saveDayRecord())throw new Error('BF1 fixture Save Today failed');const today=d.todayISO(),dateObject=new Date(today+'T12:00:00');dateObject.setDate(dateObject.getDate()-1);const yesterday=[dateObject.getFullYear(),String(dateObject.getMonth()+1).padStart(2,'0'),String(dateObject.getDate()).padStart(2,'0')].join('-'),record=await d.AppData.dailyRecords.get(today),loaded=await d.AppData.activeSession.load(),session=structuredClone(loaded.value);if(!record||!session)throw new Error('BF1 fixture state missing');const stamp=new Date().toISOString(),saved={...record,date:yesterday,savedAt:stamp,updatedAt:stamp},snapshot={...session.snapshot,date:yesterday},previous={...session,date:yesterday,snapshot,status:'active',updatedAt:stamp};await d.AppData.dailyRecords.save(saved);const stored=await d.AppData.activeSession.save(previous,{strictDurability:true});if(stored?.ok===false)throw stored.error||new Error('BF1 previous session save failed');return {yesterday,sourceRevision:Number(saved.sourceRevision),contentRevision:Number(snapshot.contentRevision)};})()`);
  assert.ok(coveredPrevious.sourceRevision>=coveredPrevious.contentRevision,'the previous-day Saved Day covers the recovery content revision');
  await page.reload();await waitForStudyDirector(page,{instrumented:true});await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().hasControl`),{label:'ownership after covered previous-day reload'});
  await waitFor(()=>page.evaluate(`__PWA6.AppData.activeSession.load().then(result=>result.value===null)`),{label:'covered previous-day recovery retired'});
  assert.equal(await page.evaluate(`document.getElementById('sd-interaction-dialog')?.textContent.includes('Unsaved previous study day found')||false`),false,'a Saved Day that covers the recovery session is not reported as unsaved again');

  assert.deepEqual(page.warnings.filter(text=>/\[Study Director\]/u.test(text)),[],'no session save failed');
  assert.deepEqual(page.events.filter(event=>!/favicon|ResizeObserver loop/iu.test(event.text||'')),[]);
  console.log(JSON.stringify({status:'PASS',checks:{appliedPlanKept:true,pacerSaved:true,backupComplete:true,popUpsWaitOnlyDuringWorkBlocks:true,coveredPreviousDayRetired:true}}));
}finally{await browser.close();await server.close();}
