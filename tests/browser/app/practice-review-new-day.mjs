import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitForStudyDirector,waitFor} from '../../helpers/browser-harness.mjs';
import {preload,sleep} from '../../helpers/drive-browser.mjs';
import {runSession} from '../../helpers/sync-journey-world.mjs';

// The owner's morning on the phone (2026-11-22): a day with a Practice Pacer
// run, saved at night; the app woke after midnight and auto-saved the day;
// Save Today again; today's plan applied. Review then showed yesterday's
// Practice Pacer run until a reload: the panel was hidden without being
// emptied, and showing Review for a planned day unhid it. Now the panel shows
// only a study day's own runs and keeps nothing while hidden.
const panel=page=>page.evaluate(`(()=>{const p=document.getElementById('practice-review');return {shown:!p.hidden,rows:p.querySelectorAll('.practice-run-table > *').length,runs:__PWA6.PracticePacer.completedRuns().length};})()`);
const pacerRun=async page=>{
  await page.evaluate(`__PWA6.goTab('execute')`);await sleep(300);
  await page.click('[data-action="practice-start"]');await sleep(500);
  for(let i=0;i<3;i++){await page.click('[data-action="practice-next"]');await sleep(250);}
  await page.click('[data-action="practice-finish"]');await sleep(500);
  await page.evaluate(`__PWA6.flushLiveDraft()`);
};
const showReview=async page=>{await page.evaluate(`__PWA6.goTab('review')`);await sleep(600);return panel(page);};
const server=await startReleaseServer(),browser=await launchChromium({profilePrefix:'sd-practice-review-day-'});
try{
  const page=await browser.createPage(server.url('deployment','instrumented.html'),{preload});
  await waitForStudyDirector(page,{instrumented:true});
  await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().hasControl`),{label:'ownership'});
  assert.equal(await page.evaluate(runSession('Day')),'running');
  await pacerRun(page);
  const yesterday=await showReview(page);
  assert.equal(yesterday.shown,true,'a day with a run shows the Practice Pacer panel');
  assert.ok(yesterday.rows>0,'with its run');
  const firstDay=await page.evaluate(`__PWA6.todayISO()`);
  assert.equal(await page.evaluate(`__PWA6.saveDayRecord()`),true,'Save Today at night');

  // After midnight, with the app open: the day is auto-saved and closed.
  await page.evaluate(`(()=>{const off=86400000;const Real=Date;class Skewed extends Real{constructor(...args){super(...(args.length?args:[Real.now()+off]));}static now(){return Real.now()+off;}}globalThis.Date=Skewed;})()`);
  await waitFor(()=>page.evaluate(`__PWA6.todayISO()!==${JSON.stringify(firstDay)}&&document.getElementById('day-date').value===__PWA6.todayISO()&&__PWA6.PracticePacer.completedRuns().length===0`),{timeout:20000,label:'the new day rolls over'});
  assert.deepEqual(await showReview(page),{shown:false,rows:0,runs:0},'the new day shows no Practice Pacer panel');
  assert.equal(await page.evaluate(`__PWA6.saveDayRecord()`),true,'Save Today again, as the owner did');

  // Today's plan applied and started: still nothing from yesterday.
  assert.equal(await page.evaluate(runSession('Day')),'running');
  assert.deepEqual(await showReview(page),{shown:false,rows:0,runs:0},'today’s Review does not show yesterday’s run');
  const stored=await page.evaluate(`__PWA6.AppData.activeSession.load().then(r=>({date:r.value?.date,runs:(r.value?.snapshot?.practice?.runs||[]).length}))`);
  assert.deepEqual(stored,{date:await page.evaluate(`__PWA6.todayISO()`),runs:0},'today’s session holds no run from yesterday');

  // Today's own run still shows.
  await pacerRun(page);
  const today=await showReview(page);
  assert.equal(today.shown,true,'today’s own run shows');
  assert.equal(today.runs,1);assert.ok(today.rows>0);
  const errors=page.events.filter(event=>!/favicon|ResizeObserver loop/i.test(event.text||''));
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({status:'PASS',suite:'practice-review-new-day',checks:{yesterdayShown:true,newDayEmpty:true,todayPlanEmpty:true,todayRunShown:true}}));
}finally{await browser.close();await server.close();}
