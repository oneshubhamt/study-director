import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitForStudyDirector,waitFor} from '../../helpers/browser-harness.mjs';

// A sync can merge another device's decisions into the session running here:
// the other device finished the block this device is on and moved to the
// next, sometimes with no timer of its own (it had stopped). This device was
// studying all along, so its timer keeps running, now on the next block. A
// plain restore (not a sync merge) keeps the session's own timer state.
const preload=`(()=>{localStorage.getItem('studyDirector.profiles.v1')||localStorage.setItem('studyDirector.profiles.v1',JSON.stringify({version:1,active:'prof_qa_mve00000_abcdef01',profiles:[{id:'prof_qa_mve00000_abcdef01',scope:'',name:'QA',email:'',folder:'',createdAt:'2026-08-01T00:00:00.000Z',fresh:false,from:null}],removing:[]}));})();`;
const server=await startReleaseServer(),browser=await launchChromium({profilePrefix:'sd-merge-timer-'});
try{
  const page=await browser.createPage(server.url('deployment','instrumented.html'),{preload});
  await waitForStudyDirector(page,{instrumented:true});
  await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().hasControl`),{label:'ownership'});
  const run=`(async()=>{const d=__PWA6,wait=ms=>new Promise(r=>setTimeout(r,ms)),now=new Date(),m=now.getHours()*60+now.getMinutes(),fmt=v=>String(Math.floor((v+1440)%1440/60)).padStart(2,'0')+':'+String((v+1440)%1440%60).padStart(2,'0');
    document.getElementById('plan-input').value=[fmt(m-5)+' | 60 | Merge One | work | Medicine | pages | 12',fmt(m+55)+' | 30 | Merge Two | work | Ethics | pages | 5'].join('\\n');
    const result=await d.applySchedule({skipNotify:true});if(result!==true)throw new Error('Session fixture Plan failed to apply: '+document.getElementById('plan-status').textContent);
    await d.goTab('execute');d.setCurrentTask(0);d.TimerEngine.startCur();await wait(300);
    const saved=await d.flushLiveDraft();
    if(!saved?.ok||!saved.storage?.idb||saved.error)throw new Error('Session fixture checkpoint failed: '+JSON.stringify({saved,ownership:d.AppOwnership.status(),lifecycle:d.SessionLifecycle.status(),timer:d.TimerState.snapshot(),plan:document.getElementById('plan-status').textContent}));
    return d.TimerState.snapshot().mode;})()`;
  // The merged session: the first block done elsewhere, on the second, no timer.
  const merge=keepRunning=>`(async()=>{const d=__PWA6,wait=ms=>new Promise(r=>setTimeout(r,ms)),s=structuredClone((await d.AppData.activeSession.load()).value);
    const ids=d.TimerState.snapshot().tasks.map(task=>task.id),first=s.snapshot.currentTaskId,next=ids[ids.indexOf(first)+1];
    s.snapshot.taskState={...s.snapshot.taskState,[first]:{...(s.snapshot.taskState[first]||{}),resolvedState:'done'}};s.snapshot.currentTaskId=next;s.snapshot.timerRuntime=null;s.revision+=1;s.snapshot.contentRevision+=1;
    await d.restoreSessionStateThroughLifecycle(s,{keepRunning:${keepRunning}});await wait(300);
    const t=d.TimerState.snapshot();return {mode:t.mode,loop:d.TimerEngine.status().loopActive,on:ids[t.currentIndex]===next};})()`;
  assert.equal(await page.evaluate(run),'running','the session runs');
  assert.deepEqual(await page.evaluate(merge(true)),{mode:'running',loop:true,on:true},'a sync merge keeps this device\'s timer running, on the next block');
  assert.equal(await page.evaluate(run),'running','the session runs again');
  const plain=await page.evaluate(merge(false));
  assert.equal(plain.on,true);assert.notEqual(plain.mode,'running','a plain restore keeps the session\'s own timer state');
  // Plan replacement is not a new study day. Preserve the day-wide
  // reflection and quality through the real lifecycle, then verify storage.
  const review=await page.evaluate(`(async()=>{
    const d=__PWA6,wait=ms=>new Promise(r=>setTimeout(r,ms));
    await d.goTab('review');await wait(120);
    document.getElementById('daily-reflection').value='KEEP REFLECTION THROUGH PLAN REPLACEMENT';
    d.setStudyQuality(4,{save:false});d.ReviewEditor.saveReview({strict:true});
    await d.ReviewEditor.flushPending({strict:true});await d.ReviewEditor.settled();
    const before=(await d.AppData.activeSession.load()).value;
    if(!before||!before.snapshot.review?.reflection.includes('KEEP REFLECTION THROUGH PLAN REPLACEMENT'))throw new Error('Review fixture did not persist');
    const plan=document.getElementById('plan-input');plan.value=plan.value.replace('Merge Two','Merge Two revised');
    let settled=false,result,error;Promise.resolve(d.applySchedule({skipNotify:true})).then(v=>{result=v;settled=true},e=>{error=e;settled=true});
    const deadline=Date.now()+20000;
    while(!settled&&Date.now()<deadline){document.querySelector('#sd-interaction-dialog[open] .interaction-actions .primary')?.click();await wait(30);}
    if(error)throw error;if(!settled||result!==true)throw new Error('Plan replacement did not finish: '+document.getElementById('plan-status').textContent);
    const visible=document.getElementById('daily-reflection').value;
    await d.flushLiveDraft();await d.AppData.activeSession.settled();
    const after=(await d.AppData.activeSession.load()).value;
    return {date:after?.date,expectedDate:before.date,reflection:after?.snapshot?.review?.reflection,expectedReflection:before.snapshot.review.reflection,quality:after?.snapshot?.review?.studyQuality,visible,schedule:after?.scheduleText};
  })()`);
  assert.equal(review.date,review.expectedDate);assert.equal(review.reflection,review.expectedReflection,'same-day reflection survives the complete lifecycle and subsequent checkpoint');
  assert.equal(review.quality,4);assert.match(review.visible,/KEEP REFLECTION THROUGH PLAN REPLACEMENT/u);assert.match(review.schedule,/Merge Two revised/u);
  assert.deepEqual(page.warnings.filter(text=>/\[Study Director\]/u.test(text)),[]);
  console.log(JSON.stringify({status:'PASS',suite:'session-merge-timer',sameDayReviewPreserved:true}));
}finally{await browser.close();await server.close();}
