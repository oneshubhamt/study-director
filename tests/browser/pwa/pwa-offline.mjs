import {createPwaVariant} from '../../helpers/pwa-variant.mjs';
import assert from 'node:assert/strict';
import {writeArtifact} from '../../helpers/artifacts.mjs';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {launchChromium} from '../../helpers/browser-harness.mjs';

const root=process.cwd();
const deployment=path.join(root,'dist','deployment');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'dist','build-manifest.json'),'utf8'));
const originalIndex=fs.readFileSync(path.join(deployment,manifest.main),'utf8');
const originalWorker=fs.readFileSync(path.join(deployment,'sw.js'),'utf8');
const originalPwa=manifest.pwa.deployment;
const build={identity:{main:manifest.main},pwa:manifest.pwa,deployment:new Map([[manifest.main,originalIndex],['sw.js',originalWorker],['firebase-hosting-headers.merge.json',fs.readFileSync(path.join(deployment,'firebase-hosting-headers.merge.json'),'utf8')]])};

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitFor(operation,{timeout=45000,interval=100,label='condition'}={}){
  const started=Date.now();let last;
  while(Date.now()-started<timeout){
    try{last=await operation();if(last)return last;}catch(error){last=error;}
    await sleep(interval);
  }
  throw new Error(`Timed out waiting for ${label}${last instanceof Error?`: ${last.message}`:''}`);
}
function variant(label,{corrupt=false}={}){return createPwaVariant(build,label,{corruptAsset:corrupt?'/icon-192.png':''});}

const bad=variant('PWA-QA-CORRUPT',{corrupt:true});
const next=variant('PWA-QA-NEXT');
let served='current';
const servedVariant=()=>served==='bad'?bad:served==='next'?next:null;
const mime=filename=>filename.endsWith('.html')?'text/html; charset=utf-8'
  :filename.endsWith('.js')?'application/javascript; charset=utf-8'
  :filename.endsWith('.css')?'text/css; charset=utf-8'
  :filename.endsWith('.webmanifest')?'application/manifest+json; charset=utf-8'
  :filename.endsWith('.json')?'application/json; charset=utf-8'
  :filename.endsWith('.woff2')?'font/woff2'
  :filename.endsWith('.png')?'image/png':'application/octet-stream';
const server=http.createServer((request,response)=>{
  const requestUrl=new URL(request.url||'/','http://127.0.0.1');
  const relative=decodeURIComponent(requestUrl.pathname).replace(/^\/+/, '')||manifest.main;
  if(relative.includes('..')){response.writeHead(400);response.end('bad path');return;}
  const selected=servedVariant();
  if(relative===manifest.main){
    response.writeHead(200,{'content-type':mime(relative),'cache-control':'no-store'});
    response.end(selected?.index||originalIndex);return;
  }
  if(relative==='sw.js'){
    response.writeHead(200,{'content-type':mime(relative),'cache-control':'no-store','service-worker-allowed':'/'});
    response.end(selected?.worker||originalWorker);return;
  }
  const filename=path.resolve(deployment,relative);
  if(!filename.startsWith(deployment+path.sep)||!fs.existsSync(filename)||!fs.statSync(filename).isFile()){
    response.writeHead(404,{'cache-control':'no-store'});response.end('not found');return;
  }
  response.writeHead(200,{'content-type':mime(relative),'cache-control':'no-store'});
  response.end(fs.readFileSync(filename));
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const appUrl=`http://127.0.0.1:${server.address().port}/${manifest.main}`;

const browser=await launchChromium({profilePrefix:'study-director-pwa-qa-'});

async function createPage(url=appUrl){
  const page=await browser.createPage(url,{preload:"window.alert=()=>{};window.confirm=()=>true;window.prompt=()=>'';"});
  await waitForStartup(page);
  await page.evaluate(`document.querySelector('[data-action="first-start-skip"]')?.click()`);
  return page;
}
async function waitForStartup(page){
  await waitFor(()=>page.evaluate(`document.documentElement.dataset.studyDirectorLifecycle==='ready'||document.documentElement.dataset.studyDirectorLifecycle==='read-only'`),{label:'session lifecycle ready'});
}
async function workerIdentity(page,slot='active'){
  return page.evaluate(`(async()=>{const registration=await navigator.serviceWorker.getRegistration();const worker=registration&&registration['${slot}'];if(!worker)return '';return new Promise(resolve=>{const channel=new MessageChannel();const timer=setTimeout(()=>resolve('timeout'),3000);channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data&&event.data.releaseId||'')};worker.postMessage({type:'SD_PWA_IDENTIFY'},[channel.port2])})})()`);
}
async function forceUpdate(page){
  return page.evaluate(`(async()=>{const registration=await navigator.serviceWorker.getRegistration();await registration.update();return true})()`);
}

const evidence={status:'PASS',release:manifest.release,checks:{}};
let page1=null,page2=null;
try{
  page1=await createPage();
  await waitForStartup(page1);
  await waitFor(()=>page1.evaluate(`navigator.serviceWorker.ready.then(()=>!!navigator.serviceWorker.controller)`),{timeout:60000,label:'first service worker control'});
  assert.equal(await workerIdentity(page1),originalPwa.releaseId);
  const initialCache=await page1.evaluate(`(async()=>{const names=await caches.keys(),cache=await caches.open('study-director-shell-${originalPwa.releaseId}'),keys=await cache.keys();return {names,keys:keys.map(request=>new URL(request.url).pathname)}})()`);
  assert.ok(initialCache.names.includes(`study-director-shell-${originalPwa.releaseId}`));
  assert.ok(initialCache.keys.includes(`/${manifest.main}`));
  evidence.checks.firstInstall={activeRelease:originalPwa.releaseId,cachedAssets:initialCache.keys.length};

  await page1.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  assert.equal(await page1.evaluate(`fetch('./index.html').then(response=>response.ok).catch(()=>false)`),true);
  const beforeOfflineReload=page1.loadCount;
  await page1.send('Page.reload');
  await waitFor(()=>page1.loadCount>beforeOfflineReload,{label:'offline reload event'});
  await waitFor(()=>page1.evaluate(`!!window.StudyDirector`),{label:'offline shell reload'});
  await waitForStartup(page1);
  await page1.evaluate(`document.querySelector('[data-tab="guide"]')?.click()`);
  await waitFor(()=>page1.evaluate(`StudyDirector.plugins.status().optionalFiles.find(row=>row.tabId==='guide')?.state==='registered'`),{label:'offline Guide module'});
  await page1.evaluate(`document.querySelector('[data-tab="insights"]')?.click()`);
  await waitFor(()=>page1.evaluate(`StudyDirector.plugins.status().optionalFiles.find(row=>row.tabId==='insights')?.state==='registered'`),{label:'offline Insights module'});
  const offlinePlugins=await page1.evaluate(`({guide:StudyDirector.plugins.status().optionalFiles.find(row=>row.tabId==='guide')?.state==='registered',insights:StudyDirector.plugins.status().optionalFiles.find(row=>row.tabId==='insights')?.state==='registered'})`);
  assert.deepEqual(offlinePlugins,{guide:true,insights:true});
  const beforeShortcut=page1.loadCount;
  await page1.send('Page.navigate',{url:`${appUrl}?tab=review`});
  await waitFor(()=>page1.loadCount>beforeShortcut,{label:'offline shortcut navigation event'});
  await waitFor(()=>page1.evaluate(`!!window.StudyDirector&&document.getElementById('pane-review')?.classList.contains('on')`),{label:'offline Review shortcut'});
  evidence.checks.offline={coldReload:true,guide:true,insights:true,reviewShortcut:true};
  await page1.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  await waitForStartup(page1);

  served='bad';
  await forceUpdate(page1);
  await waitFor(()=>page1.evaluate(`navigator.serviceWorker.getRegistration().then(r=>!r.installing)`),{label:'corrupt worker rejection'});
  assert.equal(await page1.evaluate(`navigator.serviceWorker.getRegistration().then(r=>!!r.waiting)`),false);
  assert.equal(await workerIdentity(page1),originalPwa.releaseId);
  const cacheNamesAfterBad=await page1.evaluate(`caches.keys()`);
  assert.equal(cacheNamesAfterBad.some(name=>name.endsWith(bad.releaseId)),false);
  evidence.checks.corruptUpdate={rejected:true,activeRelease:originalPwa.releaseId,partialCacheRemoved:true};

  served='current';
  page2=await createPage(appUrl);
  await waitForStartup(page2);
  await waitFor(()=>page2.evaluate(`!!navigator.serviceWorker.controller`),{label:'second controlled tab'});
  await page2.evaluate(`(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});return true})()`);
  const scheduleState=await page1.evaluate(`(async()=>{const now=new Date(),minute=now.getHours()*60+now.getMinutes()-1,hh=String(Math.floor((minute+1440)%1440/60)).padStart(2,'0'),mm=String((minute+1440)%1440%60).padStart(2,'0'),input=document.getElementById('plan-input');document.querySelector('[data-tab="plan"]').click();input.value=hh+':'+mm+' | 30 | PWA Update Safety | work | QA | pages | 5';input.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,500));const apply=document.querySelector('[data-action="apply-schedule"]');const enabled=!apply.disabled;apply.click();return enabled})()`);
  assert.equal(scheduleState,true);
  await waitFor(()=>page1.evaluate(`document.getElementById('cd-mode')?.textContent.includes('RUNNING')&&document.getElementById('execute-state-overlay')?.hidden`),{label:'running timer'});

  served='next';
  await page1.send('Page.bringToFront');
  await forceUpdate(page1);
  await waitFor(()=>page1.evaluate(`navigator.serviceWorker.getRegistration().then(r=>!!r.waiting&&!document.getElementById('pwa-update-control').hidden)`),{timeout:60000,label:'waiting update control'});
  assert.equal(await workerIdentity(page1,'waiting'),next.releaseId);
  assert.equal(await page1.evaluate(`document.getElementById('pwa-update-apply').textContent`),'Pause & Update');
  assert.equal(await workerIdentity(page1),originalPwa.releaseId);
  const loadsBefore={page1:page1.loadCount,page2:page2.loadCount};
  await page1.evaluate(`document.getElementById('pwa-update-apply').click()`);
  await waitFor(async()=>(await workerIdentity(page1))===next.releaseId&&(await workerIdentity(page2))===next.releaseId,{timeout:60000,label:'coordinated activation'});
  await waitFor(()=>page1.loadCount>loadsBefore.page1&&page2.loadCount>loadsBefore.page2,{timeout:60000,label:'all controlled tabs reload after activation'});
  await waitFor(()=>page1.evaluate(`!!window.StudyDirector`),{label:'first tab reload'});
  await waitFor(()=>page2.evaluate(`!!window.StudyDirector`),{label:'second tab reload'});
  assert.equal(page1.loadCount-loadsBefore.page1,1);
  assert.equal(page2.loadCount-loadsBefore.page2,1);
  const markers=await Promise.all([page1,page2].map(page=>page.evaluate(`sessionStorage.getItem('studyDirector.pwaReload.v1')`)));
  await waitFor(async()=>(await Promise.all([page1,page2].map(page=>page.evaluate(`sessionStorage.getItem('studyDirector.pwaReload.v1')`)))).every(value=>value===null),{label:'intended release boot confirmation'});
  assert.ok(markers.every(value=>value===null||JSON.parse(value).releaseId===next.releaseId));
  const finalCaches=await page1.evaluate(`caches.keys()`);
  assert.deepEqual(finalCaches.filter(name=>name.startsWith('study-director-shell-')).sort(),[`study-director-shell-${originalPwa.releaseId}`,`study-director-shell-${next.releaseId}`].sort());
  evidence.checks.pauseAndUpdate={timerPaused:true,readBackPassed:true,onlyInitiatorPrepared:true,hiddenSecondaryReloadedImmediately:true,singleReloadEach:true,activeRelease:next.releaseId};

  const serious=[...page1.events,...page2.events].filter(event=>event.kind==='exception'||event.kind==='console-error');
  assert.deepEqual(serious,[]);
  writeArtifact('pwa-offline-results.json',JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify(evidence,null,2));
}catch(error){
  let pageDiagnostic=null;console.error('Reload counts',JSON.stringify({page1:page1?.loadCount,page2:page2?.loadCount}));console.error('Second tab',await page2?.evaluate(`({lifecycle:document.documentElement.dataset.studyDirectorLifecycle,ui:document.documentElement.dataset.studyDirectorUiState,update:document.getElementById('pwa-update-message')?.textContent,body:document.body?.innerText.slice(-1800)})`).catch(()=>null));
  try{pageDiagnostic=await page1?.evaluate(`(async()=>({href:location.href,title:document.title,body:(document.body?.innerText||'').slice(0,500),controller:!!navigator.serviceWorker?.controller,caches:typeof caches==='undefined'?[]:await caches.keys()}))()`);}catch(diagnosticError){pageDiagnostic={error:String(diagnosticError)};}
  throw new Error(`${error.stack||error}\nPage diagnostic: ${JSON.stringify(pageDiagnostic)}\nChromium stderr:\n${browser.stderr().slice(-6000)}`);
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
