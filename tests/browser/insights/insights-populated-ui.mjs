import {CdpPage as SharedCdpPage,withoutPwaChecks,studyTimezone} from '../../helpers/browser-harness.mjs';
import fs from 'node:fs';
import {artifactPath,writeArtifact} from '../../helpers/artifacts.mjs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';

const root=process.cwd();
const manifest=JSON.parse(fs.readFileSync(path.join(root,'dist','build-manifest.json'),'utf8'));
const deployment=path.join(root,'dist','deployment');
const chromium=process.env.CHROMIUM_PATH||['/usr/bin/chromium','/tmp/chromium'].find(file=>fs.existsSync(file)&&fs.statSync(file).size>0)||'/usr/bin/chromium';
if(!fs.existsSync(chromium)||fs.statSync(chromium).size===0)throw new Error(`Chromium not found: ${chromium}`);

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitFor(fn,{timeout=45000,interval=100,label='condition'}={}){
  const started=Date.now();let last;
  while(Date.now()-started<timeout){
    try{last=await fn();if(last)return last;}catch(error){last=error;}
    await sleep(interval);
  }
  throw new Error(`Timed out waiting for ${label}${last instanceof Error?`: ${last.message}`:''}`);
}

let main=fs.readFileSync(path.join(deployment,manifest.main),'utf8');
const marker='/* PUBLIC PLUGIN API */';
const exposure='window.__InsightsUiDebug=Object.freeze({StartupLifecycle,AppData,goTab});\n';
if(!main.includes(marker))throw new Error('Insights UI browser harness hook is unavailable.');
main=main.replace(marker,exposure+marker);
main=withoutPwaChecks(main);

const server=http.createServer((request,response)=>{
  const url=new URL(request.url||'/','http://127.0.0.1');
  const name=decodeURIComponent(url.pathname).replace(/^\/+/, '')||manifest.main;
  if(name.includes('..')){response.writeHead(400);response.end('bad path');return;}
  if(name===manifest.main){response.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});response.end(main);return;}
  const file=path.resolve(deployment,name);
  if(!file.startsWith(deployment+path.sep)||!fs.existsSync(file)){response.writeHead(404);response.end('not found');return;}
  const contentType=name.endsWith('.js')?'application/javascript; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':name.endsWith('.webmanifest')?'application/manifest+json; charset=utf-8':name.endsWith('.woff2')?'font/woff2':name.endsWith('.png')?'image/png':'application/octet-stream';
  response.writeHead(200,{'content-type':contentType,'cache-control':'no-store'});response.end(fs.readFileSync(file));
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const appUrl=`http://127.0.0.1:${server.address().port}/${manifest.main}`;

const CdpPage=SharedCdpPage;

const profile=fs.mkdtempSync(path.join(os.tmpdir(),'study-director-qa-insights-'));
const browser=spawn(chromium,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
let stderr='';browser.stderr.on('data',chunk=>{stderr+=chunk;});
const activePath=path.join(profile,'DevToolsActivePort');
await waitFor(()=>fs.existsSync(activePath),{timeout:20000,label:'Chromium DevTools port'});
const [port]=fs.readFileSync(activePath,'utf8').trim().split(/\r?\n/);
await waitFor(async()=>{try{return (await fetch(`http://127.0.0.1:${port}/json/version`)).ok;}catch{return false;}},{label:'Chromium endpoint'});

let page;
try{
  const target=await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(appUrl)}`,{method:'PUT'})).json();
  page=await CdpPage.connect(target.webSocketDebuggerUrl);
  await page.send('Runtime.enable');await page.send('Page.enable');await page.send('Log.enable');
  await page.send('Emulation.setTimezoneOverride',{timezoneId:studyTimezone()});
  await page.send('Emulation.setDeviceMetricsOverride',{width:1365,height:900,deviceScaleFactor:1,mobile:false});
  await waitFor(()=>page.evaluate(`!!(window.__InsightsUiDebug&&__InsightsUiDebug.StartupLifecycle.status().fullyInitialized)`),{label:'Study Director startup'});
  const seeded=await page.evaluate(`(async()=>{
    const total=590,now=new Date(),end=Math.floor(Date.UTC(now.getFullYear(),now.getMonth(),now.getDate())/86400000),records=[];
    const iso=day=>new Date(day*86400000).toISOString().slice(0,10);
    const dayNames=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    for(let index=0;index<total;index+=1){
      const date=iso(end-total+1+index),recent=true,recentIndex=index;
      const pace=recent?125-recentIndex*.06:65+index*.12,targetMs=60000,actualMs=Math.max(1000,Math.round(targetMs*pace/100));
      const completionA=Math.max(5,Math.min(100,recent?45+recentIndex*.05:95-index*.08));
      const completionB=Math.max(0,100-completionA/2),actualSecondsA=Math.round(completionA*18),actualSecondsB=1200;
      const completedEquivalentMinutes=30*completionA/100+30*completionB/100,actualFocusMinutes=(actualSecondsA+actualSecondsB)/60;
      const taskA='a-'+index,taskB='b-'+index,dayOfWeek=new Date(date+'T00:00:00Z').getUTCDay();
      records.push({version:13,date,dayOfWeek,dayName:dayNames[dayOfWeek],savedAt:date+'T18:00:00.000Z',sourceRevision:1,
        quote:'',reflection:'',carryForwardDraft:'',studyQuality:index%5+1,realTimeSnapshot:null,
        metrics:{originalPlannedStudyMinutes:60,completedEquivalentMinutes,actualFocusMinutes,completionPercent:completedEquivalentMinutes/60*100,averageBlockCompletion:(completionA+completionB)/2,actualVsPlannedMinutes:actualFocusMinutes-60,actualVsCompletedMinutes:actualFocusMinutes-completedEquivalentMinutes,shiftedStudyBlocks:0,totalScheduleShiftMinutes:0,netScheduleShiftMinutes:0},
        schedule:[
          {id:taskA,start:'08:00',duration:30,name:'Practice set',kind:'work',area:'Practice',measure:'questions',target:4},
          {id:taskB,start:'08:30',duration:30,name:'Review set',kind:'work',area:'Review',measure:'items',target:10}
        ],
        results:{
          [taskA]:{completion:completionA,completionSource:'manual',actualSeconds:actualSecondsA},
          [taskB]:{completion:completionB,completionSource:'manual',actualSeconds:actualSecondsB}
        },
        practiceRuns:[{taskId:taskA,targetMs,totalUnits:4,unitMs:[actualMs,actualMs,actualMs,actualMs]}]});
    }
    const saved=await __InsightsUiDebug.AppData.dailyRecords.saveBatch(records.map((record,index)=>{const converted=__InsightsUiDebug.,.dailyRecord(record);if(!converted)throw new Error('Invalid legacy fixture at '+index+': '+JSON.stringify(record));return converted;}));
    localStorage.setItem('studyDirector.insights.window.v1','all');
    const started=performance.now();__InsightsUiDebug.goTab('insights');
    return {saved,started,total};
  })()`);
  assert.equal(seeded.total,590);
  await waitFor(()=>page.evaluate(`document.getElementById('pane-insights')?.getAttribute('aria-busy')==='false'&&!!document.querySelector('#pane-insights .insights-wrap')&&!!window.__StudyDirectorInsightsLastProfile`),{timeout:15000,label:'dense Insights render'});
  const desktop=await page.evaluate(`(()=>{
    const pane=document.getElementById('pane-insights');
    const evidence=[...pane.querySelectorAll('.insights-evidence-item')].map(item=>({label:item.querySelector('.l')?.textContent||'',value:item.querySelector('.v')?.textContent||'',note:item.querySelector('.n')?.textContent||''}));
    const practiceTab=[...pane.querySelectorAll('.insights-execution-tab')].find(button=>/Practice Pacing/i.test(button.textContent));practiceTab?.click();
    const practiceDetails=pane.querySelector('.insights-practice');if(practiceDetails&&practiceDetails.tagName==='DETAILS')practiceDetails.open=true;
    const calculation=practiceDetails?.querySelector('.insights-calculation-disclosure')||null;
    const practiceCopy=pane.querySelector('.insights-practice-trend-card')?.innerText||'';
    const calculationClosed=calculation?!calculation.open:false;if(calculation)calculation.open=true;
    return {
      elapsed:performance.now()-${seeded.started},window:pane.querySelector('.insights-window-note')?.textContent||'',
      workTrend:evidence.find(item=>item.label==='Work trend')||null,
      practiceSummary:pane.querySelector('.insights-practice-summary-meta')?.textContent||'',
      practiceCopy,calculationClosed,calculationCopy:calculation?.innerText||'',
      documentOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
      profile:window.__StudyDirectorInsightsLastProfile||null
    };
  })()`);
  await page.settle(2);
  desktop.calculationCopy=await page.evaluate(`document.querySelector('.insights-practice .insights-calculation-disclosure')?.innerText||''`);
  assert.match(desktop.window,/totals, averages and counts use the full window/i);
  assert.match(desktop.workTrend?.note||'',/All records/i);
  assert.match(desktop.workTrend?.note||'',/590 completion days/i);
  assert.doesNotMatch(desktop.workTrend?.value||'',/No data/i);
  assert.match(desktop.practiceSummary,/590 practice days/i);
  assert.doesNotMatch(desktop.practiceCopy,/block-jackknife|time-stratified slope/i);
  assert.equal(desktop.calculationClosed,true);
  assert.match(desktop.calculationCopy,/block-jackknife/i);
  assert.match(desktop.calculationCopy,/time-stratified slope/i);
  assert.match(desktop.practiceCopy,/All records/i);
  assert.doesNotMatch(desktop.practiceCopy,/leave-one-day-out/i);
  assert.ok(desktop.elapsed<10000,`Dense browser render took ${desktop.elapsed.toFixed(1)} ms`);
  assert.ok(desktop.documentOverflow<=1);
  assert.equal(desktop.profile?.mode,'worker');

  await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true,screenWidth:390,screenHeight:844});
  await page.settle(3);
  const phone=await page.evaluate(`(()=>({overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,trendWidth:document.querySelector('.insights-practice-trend-card')?.getBoundingClientRect().width||0,windowWidth:document.querySelector('.insights-window-copy')?.getBoundingClientRect().width||0,text:document.querySelector('.insights-practice-trend-limit')?.textContent||''}))()`);
  assert.ok(phone.overflow<=1,JSON.stringify(phone));
  assert.ok(phone.trendWidth>0&&phone.trendWidth<=390);
  assert.ok(phone.windowWidth>0&&phone.windowWidth<=390);
  assert.match(phone.text,/interpretation uses all eligible Pacer evidence/i);
  assert.deepEqual(page.events,[]);

  const evidence={status:'PASS',release:manifest.release,denseHistoryDays:590,desktop:{renderMilliseconds:Number(desktop.elapsed.toFixed(2)),window:desktop.window,workTrend:desktop.workTrend,practiceSummary:desktop.practiceSummary,overflow:desktop.documentOverflow,profile:desktop.profile},phone};
  writeArtifact('insights-ui.json',`${JSON.stringify(evidence,null,2)}\n`);
  console.log(JSON.stringify(evidence,null,2));
}finally{
  try{page?.close();}catch{}
  try{browser.kill('SIGTERM');}catch{}
  await sleep(100);
  try{fs.rmSync(profile,{recursive:true,force:true});}catch{}
  await new Promise(resolve=>server.close(resolve));
}
