import assert from 'node:assert/strict';
import {PERFORMANCE_BUDGETS} from '../../../contracts/performance-budgets.mjs';
import {launchChromium,sleep,instrumentedHtml,startReleaseServer,waitFor,waitForStudyDirector} from '../../helpers/browser-harness.mjs';

const server=await startReleaseServer();
server.setOverride('deployment','instrumented.html',instrumentedHtml().replace('Object.freeze({StartupLifecycle,','Object.freeze({CompatibilityCodecs,StartupLifecycle,'));
if(process.env.SD_SECURITY_TEST==='1')server.setOverride('deployment','instrumented.html',instrumentedHtml().replace('Object.freeze({StartupLifecycle,','Object.freeze({CompatibilityCodecs,StartupLifecycle,').replace('<head>',"<head><meta http-equiv=\"Content-Security-Policy\" content=\"worker-src 'self'; require-trusted-types-for 'script'; trusted-types sd-inert-html sd-assets sd-legal-html sd-insights-worker sd-google-signin\">"));
const browser=await launchChromium({profilePrefix:'study-director-qa-insights-'});
const pages=[];
const url=server.url('deployment','instrumented.html');

const seed=`(async()=>{
  const total=${PERFORMANCE_BUDGETS.referenceInsightsDays},now=new Date(),end=Math.floor(Date.UTC(now.getFullYear(),now.getMonth(),now.getDate())/86400000),records=[];
  const iso=day=>new Date(day*86400000).toISOString().slice(0,10),dayNames=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  for(let index=0;index<total;index+=1){
    const date=iso(end-total+1+index),pace=125-index*.06,targetMs=60000,actualMs=Math.max(1000,Math.round(targetMs*pace/100));
    const a='a-'+index,b='b-'+index,completionA=Math.max(5,Math.min(100,45+index*.05)),completionB=Math.max(0,100-completionA/2),dayOfWeek=new Date(date+'T00:00:00Z').getUTCDay();
    records.push({version:13,date,dayOfWeek,dayName:dayNames[dayOfWeek],savedAt:date+'T18:00:00.000Z',sourceRevision:1,studyQuality:index%5+1,
      schedule:[{id:a,start:'08:00',duration:30,name:'Practice set',kind:'work',area:'Practice',measure:'questions',target:4},{id:b,start:'08:30',duration:30,name:'Review set',kind:'work',area:'Review',measure:'items',target:10}],
      results:{[a]:{completion:completionA,completionSource:'manual',actualSeconds:Math.round(completionA*18)},[b]:{completion:completionB,completionSource:'manual',actualSeconds:1200}},
      practiceRuns:[{taskId:a,targetMs,totalUnits:4,unitMs:[actualMs,actualMs,actualMs,actualMs]}]});
  }
  await __PWA6.AppData.dailyRecords.saveBatch(records.map(record=>__PWA6.CompatibilityCodecs.dailyRecord(record)));localStorage.setItem('studyDirector.insights.window.v1','all');return total;
})()`;

async function open(preload=''){
  const page=await browser.createPage(url,{preload});pages.push(page);await waitForStudyDirector(page,{instrumented:true});return page;
}
async function render(page,{seedData=false}={}){
  if(seedData)assert.equal(await page.evaluate(seed),PERFORMANCE_BUDGETS.referenceInsightsDays);
  else await page.evaluate(`localStorage.setItem('studyDirector.insights.window.v1','all')`);
  const probe=await page.evaluate(`(()=>{
    const pane=document.getElementById('pane-insights'),started=performance.now();window.__InsightsShellVisibleMs=null;
    const observer=new MutationObserver(()=>{if(window.__InsightsShellVisibleMs===null&&pane.querySelector('.plugin-loading-panel,.insights-hero')){window.__InsightsShellVisibleMs=performance.now()-started;observer.disconnect();}});
    observer.observe(pane,{childList:true,subtree:true});__PWA6.goTab('insights');return {started};
  })()`);
  assert.ok(Number.isFinite(probe.started));
  await waitFor(()=>page.evaluate(`document.getElementById('pane-insights')?.getAttribute('aria-busy')==='false'&&!!window.__StudyDirectorInsightsLastProfile`),{timeout:30000,label:'profiled Insights render'});
  return page.evaluate(`({profile:window.__StudyDirectorInsightsLastProfile,shellVisibleMs:window.__InsightsShellVisibleMs,text:document.querySelector('#pane-insights .insights-wrap')?.innerText.slice(0,500)||''})`);
}
function enforcePerformance(result,label,{strictMainThread=true}={}){
  assert.ok(result.shellVisibleMs<=PERFORMANCE_BUDGETS.insightsShellMs,`${label} visible shell took ${result.shellVisibleMs.toFixed(1)} ms.`);
  assert.ok(result.profile.shellMs<=PERFORMANCE_BUDGETS.insightsShellMs,`${label} shell profile exceeded budget.`);
  assert.ok(result.profile.completeMs<=PERFORMANCE_BUDGETS.insightsCompleteMs,`${label} completed in ${result.profile.completeMs} ms.`);
  if(strictMainThread)assert.ok(result.profile.maxLongTaskMs<=PERFORMANCE_BUDGETS.insightsMaxMainThreadTaskMs,`${label} long task was ${result.profile.maxLongTaskMs} ms.`);
  assert.ok(result.profile.maxDomChunkMs<=PERFORMANCE_BUDGETS.insightsMaxDomChunkMs,`${label} DOM chunk was ${result.profile.maxDomChunkMs} ms.`);
  assert.ok(result.profile.domChunks>=9,`${label} did not progressively render secondary sections.`);
  assert.match(result.text,/Insights/i);
}

try{
  const workerPage=await open();
  const workerResult=await render(workerPage,{seedData:true});
  assert.equal(workerResult.profile.mode,'worker',JSON.stringify(workerResult));console.log('Worker render profile:',JSON.stringify(workerResult.profile));enforcePerformance(workerResult,'Worker path');

  const fallbackPage=await open(`Object.defineProperty(window,'Worker',{configurable:true,writable:true,value:undefined});`);
  const fallbackResult=await render(fallbackPage);
  assert.equal(fallbackResult.profile.mode,'main-thread-unavailable');enforcePerformance(fallbackResult,'Worker-unavailable fallback',{strictMainThread:false});
  assert.equal(fallbackResult.profile.modelSignature,workerResult.profile.modelSignature,'Worker and fallback model results differ.');

  const brokenPage=await open(`window.__NativeWorker=window.Worker;Object.defineProperty(window,'Worker',{configurable:true,writable:true,value:class{constructor(){throw new Error('QA_FIXTURE injected Worker failure');}}});`);
  await brokenPage.evaluate(`localStorage.setItem('studyDirector.insights.window.v1','all');__PWA6.goTab('insights')`);
  await waitFor(()=>brokenPage.evaluate(`document.getElementById('pane-insights')?.textContent.includes('Insights processing failed')`),{timeout:30000,label:'visible worker failure'});
  await brokenPage.evaluate(`window.Worker=window.__NativeWorker`);await brokenPage.click('#pane-insights .insights-retry');
  await waitFor(()=>brokenPage.evaluate(`window.__StudyDirectorInsightsLastProfile?.mode==='worker'`),{timeout:30000,label:'worker retry succeeds'});
  const brokenResult={profile:{mode:'worker-error-then-retry'}};

  const unexpected=pages.flatMap(page=>page.events).filter(event=>!/favicon|ResizeObserver loop/.test(event.text||''));
  assert.deepEqual(unexpected,[]);
  console.log(JSON.stringify({
    status:'PASS',suite:'insights-performance',fixtureDays:PERFORMANCE_BUDGETS.referenceInsightsDays,
    worker:workerResult.profile,fallback:fallbackResult.profile,workerFailure:brokenResult.profile,
    checks:{visibleShell:true,progressiveDom:true,workerFallbackParity:true,constructorFailureReported:true,workerPathWithinLongTaskBudget:true,fallbackDegradationReported:true}
  },null,2));
}finally{
  for(const page of pages)try{await browser.closePage(page);}catch{}
  await browser.close();await server.close();await sleep(50);
}
