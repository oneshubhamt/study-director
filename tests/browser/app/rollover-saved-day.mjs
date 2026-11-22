import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitForStudyDirector,waitFor} from '../../helpers/browser-harness.mjs';
import {preload,sleep} from '../../helpers/drive-browser.mjs';
import {runSession} from '../../helpers/sync-journey-world.mjs';

// Midnight with a day still loaded (owner, 2026-11-22). The laptop, left open
// overnight after Save Today, woke in the morning and saved the day again with
// "Study day auto-saved"; the phone then kept two versions of that day for
// review. The rule now:
//   a device that slept through midnight saves nothing and does what a fresh
//   start does: a covered day closes quietly, an unsaved one is asked about;
//   a device live through midnight auto-saves only its own unsaved work, closes
//   a covered day quietly, and never overwrites a Saved Day it did not make.
// "Study day auto-saved" goes out only with a save, so an unchanged Saved Day
// also means no notice. ("Midnight" here is the study day's end, 04:00.)
const server=await startReleaseServer();
// offset: milliseconds to add, or 'midnight' to start 30 s before the page's
// next study-day change (04:00 local, in the browser's time zone, not this
// process's), so a live page ticks across it.
const skew=offset=>`(()=>{const Real=Date;const off=${offset==='midnight'?"(()=>{const n=new Real();return new Real(n.getFullYear(),n.getMonth(),n.getDate()+(n.getHours()>=4?1:0),4).getTime()-30000-Real.now();})()":offset};class Skewed extends Real{constructor(...args){super(...(args.length?args:[Real.now()+off]));}static now(){return Real.now()+off;}}globalThis.Date=Skewed;})();`;
const beforeMidnight=()=>'midnight';
const dayOf=page=>page.evaluate(`__PWA6.todayISO()`);
const savedDay=(page,date)=>page.evaluate(`__PWA6.AppData.dailyRecords.get(${JSON.stringify(date)}).then(r=>r?{updatedAt:r.updatedAt,sourceRevision:r.sourceRevision,reflection:String(r.reflection||'')}:null)`);
const storedSession=page=>page.evaluate(`__PWA6.AppData.activeSession.load().then(r=>r.value?r.value.date:null)`);
const asked=page=>page.evaluate(`(()=>{const d=document.getElementById('sd-interaction-dialog');return !!(d&&d.open&&/Previous study day needs review/u.test(d.textContent));})()`);
// Late at night a block must end by 04:00, where the study day ends.
const runLate=`(async()=>{const d=__PWA6,wait=ms=>new Promise(r=>setTimeout(r,ms)),now=new Date(),m=now.getHours()*60+now.getMinutes(),toEnd=(240-m+1440)%1440,fmt=v=>String(Math.floor((v+1440)%1440/60)).padStart(2,'0')+':'+String((v+1440)%1440%60).padStart(2,'0');
  document.getElementById('plan-input').value=fmt(m-10)+' | '+(10+toEnd)+' | Late | work | Medicine | pages | 12';const r=d.applySchedule({skipNotify:true});if(r&&r.then)await r;
  d.goTab('execute');await wait(50);if(window.__planOnly){await d.flushLiveDraft();return 'planned';}d.setCurrentTask(0);d.TimerEngine.startCur();await wait(300);await d.flushLiveDraft();return d.TimerState.snapshot().mode;})()`;
// A plan applied and nothing started.
const planOnly=`(async()=>{const d=__PWA6,now=new Date(),m=now.getHours()*60+now.getMinutes(),fmt=v=>String(Math.floor((v+1440)%1440/60)).padStart(2,'0')+':'+String((v+1440)%1440%60).padStart(2,'0');
  document.getElementById('plan-input').value=fmt(m+5)+' | 30 | Planned | work | Medicine | pages | 12';const r=d.applySchedule({skipNotify:true});if(r&&r.then)await r;await d.flushLiveDraft();return 'planned';})()`;
const openApp=async(browser,offset,{start=true}={})=>{
  const page=await browser.createPage(server.url('deployment','instrumented.html'),{preload:skew(offset)+preload});
  await waitForStudyDirector(page,{instrumented:true});
  await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().hasControl`),{label:'ownership'});
  const day=await dayOf(page);
  if(!start&&offset==='midnight')await page.evaluate(`window.__planOnly=true`);
  const ran=await page.evaluate(!start&&offset!=='midnight'?planOnly:offset==='midnight'?runLate:runSession('Day'));
  assert.equal(ran,start?'running':'planned',start?'the day\u2019s session runs':'the day\u2019s plan is applied');
  assert.equal(await dayOf(page),day,'set up before the study day ends');
  return page;
};
const changeAfterSave=page=>page.evaluate(`(async()=>{__PWA6.setStudyQuality(4);await new Promise(r=>setTimeout(r,300));})()`);
const rolledOver=(page,day)=>waitFor(()=>page.evaluate(`__PWA6.todayISO()!==${JSON.stringify(day)}&&document.getElementById('day-date').value===__PWA6.todayISO()&&!__PWA6.ReviewSaveService?.status?.().rolloverSaveInProgress`).catch(()=>false),{timeout:120000,label:'the day rolls over'});
const results={};
const cases={
  async 'woke, saved at night'(browser){
    const page=await openApp(browser,0),day=await dayOf(page);
    assert.equal(await page.evaluate(`__PWA6.saveDayRecord()`),true);await sleep(500);
    const night=await savedDay(page,day);
    await page.evaluate(skew(86400000));await rolledOver(page,day);await sleep(1500);
    assert.deepEqual(await savedDay(page,day),night,'the night save is left as it was');
    assert.equal(await storedSession(page),null,'the covered day is closed');
    assert.equal(await asked(page),false,'and nothing is asked');
    return 'quiet';
  },
  async 'woke, not saved'(browser){
    const page=await openApp(browser,0),day=await dayOf(page);await sleep(1500);
    await page.evaluate(skew(86400000));await rolledOver(page,day);
    await waitFor(()=>asked(page),{timeout:15000,label:'the previous day is asked about'});
    assert.equal(await savedDay(page,day),null,'a woken device saves nothing');
    assert.equal(await storedSession(page),day,'the day stays stored for review');
    return 'asks';
  },
  // Begun on the phone, worked on the laptop: the phone wakes holding only
  // the plan. It saves nothing (an empty day would be set against the real
  // one) and asks nothing.
  async 'woke, plan only'(browser){
    const page=await openApp(browser,0,{start:false}),day=await dayOf(page);
    await page.evaluate(skew(86400000));await rolledOver(page,day);await sleep(2500);
    assert.equal(await asked(page),false,'nothing is asked');
    assert.equal(await savedDay(page,day),null,'no empty day is saved');
    assert.equal(await storedSession(page),day,'the plan-only copy is kept quietly');
    await page.evaluate(`__PWA6.goTab('execute')`);await sleep(500);
    assert.match(await page.evaluate(`document.getElementById('pane-execute').innerText`),/Previous Day: Plan Only/u,'Execute says only the plan is here');
    assert.equal(await page.evaluate(`document.getElementById('session-panel-title').textContent`),'Previous Day: Plan Only','and so does the session panel');
    // Today's plan replaces the copy.
    await page.evaluate(`__PWA6.goTab('plan')`);await sleep(300);
    assert.equal(await page.evaluate(planOnly),'planned');
    const today=await dayOf(page);
    assert.notEqual(today,day);
    await waitFor(async()=>await storedSession(page)===today,{timeout:15000,label:'today’s plan replaces the copy'});
    assert.equal(await savedDay(page,day),null,'still no empty day');
    assert.equal(await asked(page),false);
    return 'quiet, nothing saved, replaced by today';
  },
  async 'live, plan only'(browser){
    const page=await openApp(browser,beforeMidnight(),{start:false}),day=await dayOf(page);
    await rolledOver(page,day);await sleep(1500);
    assert.ok(await savedDay(page,day),'the planned day is kept as an empty day');
    assert.equal(await storedSession(page),null);
    assert.equal(await asked(page),false,'nothing is asked');
    return 'empty day kept';
  },
  async 'live, not saved'(browser){
    const page=await openApp(browser,beforeMidnight()),day=await dayOf(page);
    await rolledOver(page,day);await sleep(1500);
    assert.ok(await savedDay(page,day),'its own unsaved work is auto-saved');
    assert.equal(await storedSession(page),null);
    return 'auto-saves';
  },
  async 'live, saved, nothing since'(browser){
    const page=await openApp(browser,beforeMidnight()),day=await dayOf(page);
    assert.equal(await page.evaluate(`__PWA6.saveDayRecord()`),true);await sleep(500);
    const night=await savedDay(page,day);
    await rolledOver(page,day);await sleep(1500);
    assert.deepEqual(await savedDay(page,day),night,'a covered day is not saved again');
    assert.equal(await storedSession(page),null);
    return 'quiet';
  },
  async 'live, saved, more work since'(browser){
    const page=await openApp(browser,beforeMidnight()),day=await dayOf(page);
    assert.equal(await page.evaluate(`__PWA6.saveDayRecord()`),true);await sleep(500);
    const night=await savedDay(page,day);
    await changeAfterSave(page);
    await rolledOver(page,day);await sleep(1500);
    const after=await savedDay(page,day);
    assert.notEqual(after.updatedAt,night.updatedAt,'its own later work is auto-saved over its own save');
    assert.equal(await storedSession(page),null);
    return 'auto-saves';
  },
  async 'live, another device saved it'(browser){
    const page=await openApp(browser,beforeMidnight()),day=await dayOf(page);
    assert.equal(await page.evaluate(`__PWA6.saveDayRecord()`),true);await sleep(500);
    // The laptop's later save arrives by sync: a different Saved Day.
    await page.evaluate(`(async()=>{const d=__PWA6,r=await d.AppData.dailyRecords.get(${JSON.stringify(day)});const at=new Date().toISOString();await d.AppData.dailyRecords.save({...r,sourceRevision:Number(r.sourceRevision)+1000,reflection:'Saved on the laptop',updatedAt:at,savedAt:at});})()`);
    const laptop=await savedDay(page,day);
    await changeAfterSave(page);
    await rolledOver(page,day);
    await waitFor(()=>asked(page),{timeout:15000,label:'the previous day is asked about'});
    assert.deepEqual(await savedDay(page,day),laptop,'another device’s Saved Day is never overwritten');
    assert.equal(await storedSession(page),day,'the day stays stored for review');
    return 'asks';
  }
};
try{
  for(const [name,run] of Object.entries(cases)){
    const browser=await launchChromium({profilePrefix:'sd-rollover-'});
    try{results[name]=await run(browser);}
    catch(error){error.message=`${name}: ${error.message}`;throw error;}
    finally{await browser.close();}
  }
  console.log(JSON.stringify({status:'PASS',suite:'rollover-saved-day',results}));
}finally{await server.close();}
