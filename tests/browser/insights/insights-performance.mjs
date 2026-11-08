import assert from 'node:assert/strict';
import {PERFORMANCE_BUDGETS} from '../../../contracts/performance-budgets.mjs';
import {launchChromium,sleep,instrumentedHtml,startReleaseServer,waitFor,waitForStudyDirector} from '../../helpers/browser-harness.mjs';

// Opening Insights with 590 saved days, measured the way people meet it:
//   settled   the app has been open a moment, so idle pre-computation is ready;
//   rebuild   a day changed since then, so the model is rebuilt on a warm worker;
//   cold      the tab is opened at start-up, before any pre-computation.
// Timing claims use the median of three samples. Settled openings meet the
// unchanged product budgets, the long-task one included. Openings that must
// compute the history meet their own named ceiling; their longest task is the
// host's own storage read of the saved days (repositories, not Insights), so it
// is reported, not held to the Insights main-thread budget. Correctness checks
// (model parity, failure retry, what was sent to the worker) never depend on
// timing, so a slow machine cannot hide them or be blamed for them.
const SAMPLES=3;
const B=PERFORMANCE_BUDGETS;

const server=await startReleaseServer();
const exposed=instrumentedHtml().replace('Object.freeze({StartupLifecycle,','Object.freeze({CompatibilityCodecs,StartupLifecycle,');
server.setOverride('deployment','instrumented.html',process.env.SD_SECURITY_TEST==='1'
  ?exposed.replace('<head>',"<head><meta http-equiv=\"Content-Security-Policy\" content=\"worker-src 'self'; require-trusted-types-for 'script'; trusted-types sd-inert-html sd-assets sd-legal-html sd-insights-worker sd-google-signin\">")
  :exposed);
const browser=await launchChromium({profilePrefix:'study-director-qa-insights-'});
const pages=[];
const url=server.url('deployment','instrumented.html');

// The reference history. `quality` lets the rebuild scenario change one saved
// day without changing how many there are.
const records=(quality=null)=>`(()=>{
  const total=${B.referenceInsightsDays},now=new Date(),end=Math.floor(Date.UTC(now.getFullYear(),now.getMonth(),now.getDate())/86400000),records=[];
  const iso=day=>new Date(day*86400000).toISOString().slice(0,10),dayNames=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  for(let index=0;index<total;index+=1){
    const date=iso(end-total+1+index),pace=125-index*.06,targetMs=60000,actualMs=Math.max(1000,Math.round(targetMs*pace/100));
    const a='a-'+index,b='b-'+index,completionA=Math.max(5,Math.min(100,45+index*.05)),completionB=Math.max(0,100-completionA/2),dayOfWeek=new Date(date+'T00:00:00Z').getUTCDay();
    records.push({version:13,date,dayOfWeek,dayName:dayNames[dayOfWeek],savedAt:date+'T18:00:00.000Z',sourceRevision:1,studyQuality:index===total-1&&${JSON.stringify(quality)}!==null?${JSON.stringify(quality)}:index%5+1,
      schedule:[{id:a,start:'08:00',duration:30,name:'Practice set',kind:'work',area:'Practice',measure:'questions',target:4},{id:b,start:'08:30',duration:30,name:'Review set',kind:'work',area:'Review',measure:'items',target:10}],
      results:{[a]:{completion:completionA,completionSource:'manual',actualSeconds:Math.round(completionA*18)},[b]:{completion:completionB,completionSource:'manual',actualSeconds:1200}},
      practiceRuns:[{taskId:a,targetMs,totalUnits:4,unitMs:[actualMs,actualMs,actualMs,actualMs]}]});
  }
  return records;
})()`;
const seed=`(async()=>{const records=${records()};await __PWA6.AppData.dailyRecords.saveBatch(records.map(record=>__PWA6.CompatibilityCodecs.dailyRecord(record)));localStorage.setItem('studyDirector.insights.window.v1','all');return records.length;})()`;
const changeLatestDay=quality=>`(async()=>{const records=${records(quality)};await __PWA6.AppData.dailyRecords.saveBatch(records.slice(-1).map(record=>__PWA6.CompatibilityCodecs.dailyRecord(record)));return true;})()`;

async function open(preload=''){
  const page=await browser.createPage(url,{preload});pages.push(page);await waitForStudyDirector(page,{instrumented:true});return page;
}
async function close(page){pages.splice(pages.indexOf(page),1);await browser.closePage(page);}
const median=values=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)];};
const reported=({modelSignature,...profile})=>profile;

// Open the Insights tab (or reopen it) and return its published profile.
async function render(page){
  const probe=await page.evaluate(`(()=>{
    const pane=document.getElementById('pane-insights'),started=performance.now();window.__InsightsShellVisibleMs=null;window.__StudyDirectorInsightsLastProfile=null;
    const shown=()=>pane.classList.contains('on')&&!!pane.querySelector('.plugin-loading-panel,.insights-hero');
    const observer=new MutationObserver(()=>{if(window.__InsightsShellVisibleMs===null&&shown()){window.__InsightsShellVisibleMs=performance.now()-started;observer.disconnect();}});
    observer.observe(pane,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});__PWA6.goTab('insights');return {started};
  })()`);
  assert.ok(Number.isFinite(probe.started));
  await waitFor(()=>page.evaluate(`document.getElementById('pane-insights')?.getAttribute('aria-busy')==='false'&&!!window.__StudyDirectorInsightsLastProfile`),{timeout:30000,label:'profiled Insights render'});
  const result=await page.evaluate(`({profile:window.__StudyDirectorInsightsLastProfile,shellVisibleMs:window.__InsightsShellVisibleMs,text:document.querySelector('#pane-insights .insights-wrap')?.innerText.slice(0,500)||''})`);
  assert.ok(Number.isFinite(result.shellVisibleMs),'the Insights shell never became visible');
  assert.match(result.text,/Insights/i);
  return result;
}
async function leave(page){
  await page.evaluate(`__PWA6.goTab('execute')`);
  await waitFor(()=>page.evaluate(`!document.getElementById('pane-insights')?.classList.contains('on')`),{label:'Insights closed'});
}
async function prefetched(page){
  await waitFor(()=>page.evaluate(`window.__StudyDirectorInsightsPrefetch?.state==='ready'`),{timeout:30000,label:'idle Insights pre-computation'});
  return page.evaluate('window.__StudyDirectorInsightsPrefetch');
}
// Structure is checked on every sample: it does not depend on machine speed.
function checkStructure(result,label,{mode,source}){
  assert.equal(result.profile.mode,mode,`${label}: ${JSON.stringify(reported(result.profile))}`);
  assert.equal(result.profile.source,source,`${label}: ${JSON.stringify(reported(result.profile))}`);
  assert.equal(result.profile.records,B.referenceInsightsDays,`${label} built a different history`);
  assert.ok(result.profile.domChunks>=9,`${label} did not progressively render secondary sections.`);
}
// Timing is judged on the median of the samples against the stated budgets.
function checkTiming(samples,label,{completeMs,shellMs=B.insightsShellMs,mainThread=true}){
  const pick=read=>median(samples.map(read));
  const summary={
    completeMs:pick(s=>s.profile.completeMs),shellVisibleMs:pick(s=>s.shellVisibleMs),
    maxLongTaskMs:pick(s=>s.profile.maxLongTaskMs),maxDomChunkMs:pick(s=>s.profile.maxDomChunkMs)
  };
  const detail=`${label} medians ${JSON.stringify(summary)}; samples ${JSON.stringify(samples.map(s=>reported(s.profile)))}`;
  assert.ok(summary.completeMs<=completeMs,`${label} completed in ${summary.completeMs} ms (budget ${completeMs}). ${detail}`);
  assert.ok(summary.shellVisibleMs<=shellMs,`${label} shell took ${summary.shellVisibleMs.toFixed(1)} ms (budget ${shellMs}). ${detail}`);
  assert.ok(summary.maxDomChunkMs<=B.insightsMaxDomChunkMs,`${label} DOM chunk was ${summary.maxDomChunkMs} ms. ${detail}`);
  if(mainThread)assert.ok(summary.maxLongTaskMs<=B.insightsMaxMainThreadTaskMs,`${label} long task was ${summary.maxLongTaskMs} ms. ${detail}`);
  return summary;
}

try{
  // Seed outside every timed page: the benchmark is opening an established
  // history, not the aftermath of writing it.
  const seedPage=await open();
  assert.equal(await seedPage.evaluate(seed),B.referenceInsightsDays);
  await close(seedPage);await sleep(100);

  // Cold: opened the moment start-up reports ready, before pre-computation.
  const coldPage=await open();
  const cold=await render(coldPage);
  checkStructure(cold,'Cold opening',{mode:'worker',source:'computed'});
  assert.equal(cold.profile.sentRecords,B.referenceInsightsDays,'a cold worker receives the whole history once');
  const coldTiming=checkTiming([cold],'Cold opening',{completeMs:B.insightsComputedOpenMs,shellMs:B.insightsComputedOpenMs,mainThread:false});
  // Switching window reuses the records the worker already holds.
  // The first-start dialog of the fresh test profile covers the page; the
  // window change itself is what is under test here.
  await coldPage.evaluate(`document.querySelector('#pane-insights .insights-window-btn[aria-pressed="false"]').click()`);
  await waitFor(()=>coldPage.evaluate(`window.__StudyDirectorInsightsLastProfile?.mode==='worker'&&document.getElementById('pane-insights')?.getAttribute('aria-busy')==='false'&&window.__StudyDirectorInsightsLastProfile.records!==${B.referenceInsightsDays}`),{timeout:30000,label:'window change'});
  const switched=await coldPage.evaluate('window.__StudyDirectorInsightsLastProfile');
  assert.equal(switched.sentRecords,0,`a window change must not resend the history: ${JSON.stringify(reported(switched))}`);
  await coldPage.evaluate(`localStorage.setItem('studyDirector.insights.window.v1','all')`);
  await close(coldPage);

  // Settled: three fresh pages, each opened once its pre-computation is ready.
  const settled=[];let prefetchStatus=null;
  for(let index=0;index<SAMPLES;index+=1){
    const page=await open();
    prefetchStatus=await prefetched(page);
    assert.equal(prefetchStatus.mode,'worker',JSON.stringify(prefetchStatus));
    const result=await render(page);
    checkStructure(result,'Settled opening',{mode:'worker',source:'prefetched'});
    assert.equal(result.profile.modelSignature,cold.profile.modelSignature,'a pre-computed model must equal the one computed on opening');
    settled.push(result);
    if(index<SAMPLES-1)await close(page);
  }
  const settledTiming=checkTiming(settled,'Settled opening',{completeMs:B.insightsCompleteMs});

  // Rebuild: change one saved day, then reopen. The idle worker is reused.
  const page=pages.at(-1),rebuilt=[];
  for(let index=0;index<SAMPLES;index+=1){
    await leave(page);
    assert.equal(await page.evaluate(changeLatestDay(index%2?2:5)),true);
    const result=await render(page);
    checkStructure(result,'Rebuild after a change',{mode:'worker',source:'computed'});
    rebuilt.push(result);
  }
  const rebuildTiming=checkTiming(rebuilt,'Rebuild after a change',{completeMs:B.insightsComputedOpenMs,mainThread:false});
  await close(page);
  await (async()=>{const restore=await open();await restore.evaluate(seed);await close(restore);})();

  // Without workers the report still renders, on the main thread and without
  // idle pre-computation, and it computes the same model.
  const fallbackPage=await open(`Object.defineProperty(window,'Worker',{configurable:true,writable:true,value:undefined});`);
  const fallback=await render(fallbackPage);
  checkStructure(fallback,'Worker-unavailable fallback',{mode:'main-thread-unavailable',source:'computed'});
  assert.equal(fallback.profile.modelSignature,cold.profile.modelSignature,'Worker and fallback model results differ.');
  const fallbackTiming=checkTiming([fallback],'Worker-unavailable fallback',{completeMs:B.insightsComputedOpenMs,shellMs:B.insightsComputedOpenMs,mainThread:false});
  assert.notEqual((await fallbackPage.evaluate('window.__StudyDirectorInsightsPrefetch'))?.state,'ready','no idle pre-computation without a worker');

  // A worker that cannot start is reported, and Retry recovers.
  const brokenPage=await open(`window.__NativeWorker=window.Worker;Object.defineProperty(window,'Worker',{configurable:true,writable:true,value:class{constructor(){throw new Error('QA_FIXTURE injected Worker failure');}}});`);
  await brokenPage.evaluate(`localStorage.setItem('studyDirector.insights.window.v1','all');__PWA6.goTab('insights')`);
  await waitFor(()=>brokenPage.evaluate(`document.getElementById('pane-insights')?.textContent.includes('Insights processing failed')`),{timeout:30000,label:'visible worker failure'});
  await brokenPage.evaluate(`window.Worker=window.__NativeWorker`);await brokenPage.click('#pane-insights .insights-retry');
  await waitFor(()=>brokenPage.evaluate(`window.__StudyDirectorInsightsLastProfile?.mode==='worker'`),{timeout:30000,label:'worker retry succeeds'});

  const unexpected=pages.flatMap(item=>item.events).filter(event=>!/favicon|ResizeObserver loop/.test(event.text||''));
  assert.deepEqual(unexpected,[]);
  console.log(JSON.stringify({
    status:'PASS',suite:'insights-performance',fixtureDays:B.referenceInsightsDays,samples:SAMPLES,
    budgets:{completeMs:B.insightsCompleteMs,shellMs:B.insightsShellMs,longTaskMs:B.insightsMaxMainThreadTaskMs,domChunkMs:B.insightsMaxDomChunkMs,computedOpenMs:B.insightsComputedOpenMs},
    medians:{settled:settledTiming,rebuild:rebuildTiming,cold:coldTiming,fallback:fallbackTiming},
    prefetch:prefetchStatus,
    samples:{settled:settled.map(s=>reported(s.profile)),rebuild:rebuilt.map(s=>reported(s.profile)),cold:reported(cold.profile),fallback:reported(fallback.profile),windowChange:reported(switched)},
    checks:{prefetchedEqualsComputed:true,workerFallbackParity:true,windowChangeSendsNoRecords:true,constructorFailureReported:true,noPrefetchWithoutWorker:true}
  },null,2));
}finally{
  for(const item of [...pages])try{await browser.closePage(item);}catch{}
  await browser.close();await server.close();await sleep(50);
}
