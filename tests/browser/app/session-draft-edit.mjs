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
    document.getElementById('plan-input').value=[fmt(m-5)+' | 60 | Draft QA Block | work | Medicine | questions | 12',fmt(m+55)+' | 30 | Draft QA Next | work | Ethics | pages | 5'].join('\\n');
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

  // While the timer runs, a pop-up that blocks nothing waits and a blocking
  // one shows; pausing shows the one that waited (STATUS-SYSTEM.md, noise rules).
  const hold=await page.evaluate(`(async()=>{const d=__PWA6,wait=ms=>new Promise(r=>setTimeout(r,ms)),shown=text=>[...document.querySelectorAll('#sd-toast-region .interaction-toast')].some(node=>node.textContent.includes(text));
    d.Interactions.notify({source:'sync',key:'kept-new',kind:'warning',duration:12000,waitWhileStudying:true,title:'Kept for review',message:'One version was kept.'});
    d.Interactions.notify({source:'qa',key:'blocking',kind:'warning',duration:12000,title:'Needs password',message:'Enter it to keep syncing.'});
    await wait(200);const running={mode:d.TimerState.mode,kept:shown('Kept for review'),blocking:shown('Needs password')};
    d.togglePause();await wait(300);const paused={mode:d.TimerState.mode,kept:shown('Kept for review')};
    return {running,paused};})()`);
  assert.deepEqual(hold,{running:{mode:'running',kept:false,blocking:true},paused:{mode:'paused',kept:true}},'pop-ups that block nothing wait for the timer to stop');
  assert.deepEqual(page.warnings.filter(text=>/\[Study Director\]/u.test(text)),[],'no session save failed');
  assert.deepEqual(page.events.filter(event=>!/favicon|ResizeObserver loop/iu.test(event.text||'')),[]);
  console.log(JSON.stringify({status:'PASS',checks:{appliedPlanKept:true,pacerSaved:true,backupComplete:true,popUpsWaitWhileStudying:true}}));
}finally{await browser.close();await server.close();}
