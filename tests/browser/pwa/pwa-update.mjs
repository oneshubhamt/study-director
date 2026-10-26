import {createPwaVariant} from '../../helpers/pwa-variant.mjs';
import assert from 'node:assert/strict';
import {writeArtifact} from '../../helpers/artifacts.mjs';
import http from 'node:http';
import {launchChromium,skipFirstStart} from '../../helpers/browser-harness.mjs';
import {renderBuild,validateBuild} from '../../../build/build.mjs';

const build=renderBuild();
assert.equal(validateBuild(build),true);
const deployment=build.deployment;
const originalIndex=deployment.get(build.identity.main);
const originalWorker=deployment.get('sw.js');
const originalPwa=build.pwa.deployment;

const support=JSON.parse(deployment.get('firebase-hosting-headers.merge.json'));
const rootHeaders=support.hosting.headers.find(rule=>rule.source==='/**')?.headers||[];
const enforced=rootHeaders.find(header=>header.key==='Content-Security-Policy')?.value||'';
const trusted=rootHeaders.find(header=>header.key==='Content-Security-Policy-Report-Only')?.value||'';
const enforcedCsp=`${enforced}; ${trusted}`;

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitFor(operation,{timeout=60000,interval=100,label='condition',describe=null}={}){
  const started=Date.now();let last;
  while(Date.now()-started<timeout){
    try{last=await operation();if(last)return last;}catch(error){last=error;}
    await sleep(interval);
  }
  let state='';
  if(describe){try{state=` (last state: ${JSON.stringify(await describe())})`;}catch(error){state=` (state unavailable: ${error.message})`;}}
  throw new Error(`Timed out waiting for ${label}${last instanceof Error?`: ${last.message}`:''}${state}`);
}
function variant(label,{corruptPrecache=false}={}){return createPwaVariant(build,label,{corruptAsset:corruptPrecache?'/icon-192.png':''});}

const next=variant('PwaUpdateQA-AUTO-UPDATE-NEXT');
const badPrecache=variant('PwaUpdateQA-BAD-PRECACHE',{corruptPrecache:true});
const badSyntax=Object.freeze({label:'PwaUpdateQA-BAD-SYNTAX',index:originalIndex,worker:"'use strict';\nthis is not valid service worker javascript {\n"});
let served='current',swRequests=0;
const selected=()=>served==='next'?next:served==='bad-precache'?badPrecache:served==='bad-syntax'?badSyntax:null;
const mime=name=>name.endsWith('.html')?'text/html; charset=utf-8'
  :name.endsWith('.js')?'application/javascript; charset=utf-8'
  :name.endsWith('.css')?'text/css; charset=utf-8'
  :name.endsWith('.webmanifest')?'application/manifest+json; charset=utf-8'
  :name.endsWith('.json')?'application/json; charset=utf-8'
  :name.endsWith('.woff2')?'font/woff2'
  :name.endsWith('.png')?'image/png':'application/octet-stream';

const server=http.createServer((request,response)=>{
  const requestUrl=new URL(request.url||'/','http://127.0.0.1');
  const relative=decodeURIComponent(requestUrl.pathname).replace(/^\/+/, '')||build.identity.main;
  if(relative.includes('..')){response.writeHead(400);response.end('bad path');return;}
  const current=selected();
  if(relative===build.identity.main){
    response.writeHead(200,{'content-type':mime(relative),'cache-control':'no-store','content-security-policy':selected()?.csp||enforcedCsp});
    response.end(current?.index||originalIndex);return;
  }
  if(relative==='sw.js'){
    swRequests+=1;
    response.writeHead(200,{'content-type':mime(relative),'cache-control':'no-cache, no-store, must-revalidate','service-worker-allowed':'/'});
    response.end(current?.worker||originalWorker);return;
  }
  if(!deployment.has(relative)){response.writeHead(404,{'cache-control':'no-store'});response.end('not found');return;}
  response.writeHead(200,{'content-type':mime(relative),'cache-control':'no-store'});
  response.end(deployment.get(relative));
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const appUrl=`http://127.0.0.1:${server.address().port}/${build.identity.main}`;

const browser=await launchChromium({profilePrefix:'study-director-qa-pwa-'});

async function createPage(url=appUrl){
  const page=await browser.createPage(url,{preload:"window.alert=()=>{};window.confirm=()=>true;window.prompt=()=>'';window.__sd73iViolations=[];document.addEventListener('securitypolicyviolation',event=>window.__sd73iViolations.push({directive:event.effectiveDirective,disposition:event.disposition,blocked:event.blockedURI||''}));const nativeUpdate=ServiceWorkerRegistration.prototype.update;ServiceWorkerRegistration.prototype.update=function(){localStorage.setItem('qa.pwaExplicitChecks',String(Number(localStorage.getItem('qa.pwaExplicitChecks')||0)+1));return nativeUpdate.call(this)};"});
  await waitForStartup(page);
  await skipFirstStart(page);
  return page;
}
async function waitForStartup(page){
  await waitFor(()=>page.evaluate(`document.documentElement.dataset.studyDirectorLifecycle==='ready'||document.documentElement.dataset.studyDirectorLifecycle==='read-only'`),{label:'session lifecycle ready'});
}
async function reloadOffline(page,label){
  // CDP's network override does not reliably survive an offline cached document's
  // Navigator state. Keep the app's offline signal explicit for that document;
  // real network emulation and service-worker cache serving remain in force.
  const script=await page.send('Page.addScriptToEvaluateOnNewDocument',{source:"Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false});"});
  const previous=await page.evaluate('performance.timeOrigin');
  await page.send('Page.reload',{ignoreCache:false});
  await waitFor(()=>page.evaluate(`performance.timeOrigin!==${previous}&&document.readyState==='complete'`),{label});
  await page.send('Page.removeScriptToEvaluateOnNewDocument',{identifier:script.identifier});
  await waitForStartup(page);assert.equal(await page.evaluate('navigator.onLine'),false);
}
async function workerIdentity(page,slot='active'){
  return page.evaluate(`(async()=>{const registration=await navigator.serviceWorker.getRegistration();const worker=registration&&registration['${slot}'];if(!worker)return '';return new Promise(resolve=>{const channel=new MessageChannel();const timer=setTimeout(()=>resolve('timeout'),3000);channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data&&event.data.releaseId||'')};worker.postMessage({type:'SD_PWA_IDENTIFY'},[channel.port2])})})()`);
}
// What each tab sees of the update, for timeout messages.
async function updateState(pages){
  return Promise.all(pages.map(async page=>({
    hidden:await page.evaluate('document.hidden'),
    active:await workerIdentity(page),
    waiting:await page.evaluate(`navigator.serviceWorker.getRegistration().then(registration=>registration?.waiting?.state||'none')`),
    message:await page.evaluate(`document.getElementById('pwa-update-message')?.textContent||''`)
  })));
}
// Browser registration may perform native checks too. Count only explicit calls
// to registration.update(), including the application's automatic checks.
async function explicitChecks(page){return page.evaluate("Number(localStorage.getItem('qa.pwaExplicitChecks')||0)");}
async function waitForNoInstalling(page){
  return waitFor(()=>page.evaluate(`navigator.serviceWorker.getRegistration().then(registration=>registration&&!registration.installing&&!document.getElementById('pwa-update-apply').disabled)`),{label:'service-worker check and installation settled'});
}

const evidence={status:'PASS',release:build.identity.release,checks:{}};
let page1=null,page2=null;
try{
  page1=await createPage();
  await waitForStartup(page1);
  await waitFor(()=>page1.evaluate(`navigator.serviceWorker.ready.then(()=>!!navigator.serviceWorker.controller)`),{timeout:60000,label:'Trusted-Types service-worker registration/control'});
  await waitFor(()=>page1.evaluate(`Number(localStorage.getItem('studyDirector.pwaUpdateCheck.v1')||0)>0`),{label:'startup update-check timestamp'});
  assert.equal(await workerIdentity(page1),originalPwa.releaseId);
  const violations1=await page1.evaluate(`__sd73iViolations.filter(row=>row.directive==='trusted-types'||row.directive==='require-trusted-types-for')`);
  assert.deepEqual(violations1,[],'Trusted Types enforcement produced a violation during startup/service-worker registration');
  evidence.checks.trustedTypesRegistration={enforced:true,registered:true,activeRelease:originalPwa.releaseId};

  const recentStamp=await page1.evaluate(`Number(localStorage.getItem('studyDirector.pwaUpdateCheck.v1'))`);
  assert.ok(Date.now()-recentStamp<30000,'startup update-check timestamp is not recent');
  const noCheckBefore=await explicitChecks(page1);
  served='next';
  await page1.evaluate(`window.dispatchEvent(new Event('focus'))`);
  await sleep(700);
  assert.equal(await explicitChecks(page1),noCheckBefore,'a fresh 24-hour cooldown performed an unnecessary update check');
  assert.equal(await page1.evaluate(`navigator.serviceWorker.getRegistration().then(registration=>!!registration.waiting)`),false);
  evidence.checks.cooldown={twentyFourHours:true,recentForegroundSkipped:true};
  served='current';

  page2=await createPage();
  await waitForStartup(page2);
  await waitFor(()=>page2.evaluate(`!!navigator.serviceWorker.controller`),{label:'secondary controlled tab'});
  await waitFor(()=>page1.evaluate(`document.documentElement.dataset.studyDirectorUiState==='primary'`),{label:'primary ownership'});
  await waitFor(()=>page2.evaluate(`document.documentElement.dataset.studyDirectorUiState==='secondary'`),{label:'secondary ownership'});
  // Use actual tab visibility: the edited primary is foreground, and the
  // secondary is hidden. Changing a JS getter would leave Chrome throttling
  // the primary while the fixture falsely called the foreground tab hidden.
  await page1.send('Page.bringToFront');
  await waitFor(()=>page1.evaluate(`!document.hidden`),{label:'foreground primary tab'});
  await waitFor(()=>page2.evaluate(`document.hidden`),{label:'hidden secondary tab'});


  const due=Date.now()-25*60*60*1000;
  await Promise.all([page1,page2].map(page=>page.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0})));
  await Promise.all([page1,page2].map(page=>waitFor(()=>page.evaluate(`navigator.onLine===false`),{label:'offline tab'})));
  await page1.evaluate(`localStorage.setItem('studyDirector.pwaUpdateCheck.v1','${due}')`);
  await waitFor(()=>page1.evaluate(`navigator.onLine===false`),{label:'offline state'});
  await reloadOffline(page1,'offline restart before due discovery');
  if(await page1.evaluate(`document.documentElement.dataset.studyDirectorUiState==='secondary'`))await page1.evaluate(`document.querySelector('.ownership-banner[data-ownership-state="secondary"] button').click()`);
  await waitFor(()=>page1.evaluate(`document.documentElement.dataset.studyDirectorUiState==='primary'`),{label:'primary control after offline restart'});
  const scheduleState=await page1.evaluate(`(async()=>{const now=new Date(),minute=now.getHours()*60+now.getMinutes()-1,hh=String(Math.floor((minute+1440)%1440/60)).padStart(2,'0'),mm=String((minute+1440)%1440%60).padStart(2,'0'),input=document.getElementById('plan-input');document.querySelector('[data-tab="plan"]').click();input.value=hh+':'+mm+' | 30 | PwaUpdateQA Update QA | work | QA | pages | 5';input.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,500));const apply=document.querySelector('[data-action="apply-schedule"]');const enabled=!apply.disabled;apply.click();return enabled})()`);
  assert.equal(scheduleState,true,'QA Plan could not be applied');
  await waitFor(()=>page1.evaluate(`document.getElementById('cd-mode')?.textContent.includes('RUNNING')&&document.getElementById('execute-state-overlay')?.hidden`),{label:'running timer'});

  await waitFor(()=>page1.evaluate(`!document.getElementById('pwa-update-apply').disabled`),{label:'ongoing update check settled'});
  await waitForNoInstalling(page1);await sleep(250);
  served='next';
  const offlineChecks=await explicitChecks(page1);
  await page1.evaluate(`document.dispatchEvent(new Event('visibilitychange'))`);
  await sleep(500);
  assert.equal(await explicitChecks(page1),offlineChecks,'offline due check attempted a service-worker fetch');
  assert.equal(await page1.evaluate(`Number(localStorage.getItem('studyDirector.pwaUpdateCheck.v1'))`),due,'offline due check consumed the 24-hour cooldown');
  const discoveryChecks=await explicitChecks(page1);
  await Promise.all([page1,page2].map(page=>page.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1})));
  await page1.evaluate(`delete navigator.onLine`);
  await waitFor(()=>page1.evaluate(`navigator.onLine===true`),{label:'online state'});
  await Promise.all([page1,page2].map(page=>page.evaluate(`window.dispatchEvent(new Event('online'))`)));
  await waitFor(()=>page1.evaluate(`navigator.serviceWorker.getRegistration().then(registration=>!!registration.waiting)`),{timeout:60000,label:'automatic due update discovery'});
  await waitFor(async()=>(await explicitChecks(page1))>discoveryChecks,{label:'primary proactive check after reconnection'});
  assert.equal((await explicitChecks(page1))-discoveryChecks,1,'multiple tabs duplicated the proactive service-worker update check');
  assert.equal(await workerIdentity(page1,'waiting'),next.releaseId);
  assert.equal(await workerIdentity(page1),originalPwa.releaseId);
  await waitFor(()=>page1.evaluate(`document.getElementById('pwa-update-message')?.textContent.includes('live timer before updating')`),{label:'automatic Plan-end queue'});
  assert.equal(await page1.evaluate(`document.getElementById('pwa-update-apply').textContent`),'Pause & Update');
  evidence.checks.discovery={offlineDeferred:true,onlineRetry:true,noTestSideRegistrationUpdate:true,onePrimaryCheckAcrossTabs:true,queuedAutomatically:true};

  await page1.evaluate(`(()=>{const field=document.getElementById('quote-input');field.value='PwaUpdateQA recent edit guard';field.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-action="mark-done"]').click();window.dispatchEvent(new Event('focus'));return true})()`);
  const loadsBefore={page1:page1.loadCount,page2:page2.loadCount};
  await sleep(700);
  assert.equal(page1.loadCount,loadsBefore.page1,'automatic update interrupted a recent edit before the idle guard elapsed');
  assert.equal(await workerIdentity(page1),originalPwa.releaseId,'waiting update activated while recent edit guard was active');
  // Watch the registration, not the workers: Chromium activates a waiting worker
  // only once the old one is idle, so messaging it in a loop delays activation.
  await waitFor(async()=>(await Promise.all([page1,page2].map(page=>page.evaluate(`navigator.serviceWorker.getRegistration().then(registration=>!!registration&&!registration.waiting&&!registration.installing&&registration.active?.state==='activated')`)))).every(Boolean),{timeout:60000,label:'automatic safe activation',describe:()=>updateState([page1,page2])});
  await waitFor(()=>page1.loadCount>loadsBefore.page1&&page2.loadCount>loadsBefore.page2,{timeout:60000,label:'all controlled tabs immediate reload'});
  assert.equal(page1.loadCount-loadsBefore.page1,1);
  assert.equal(page2.loadCount-loadsBefore.page2,1,'hidden secondary tab did not reload immediately after controller change');
  await waitFor(()=>page1.evaluate(`!!window.StudyDirector`),{label:'primary shell after update'});
  await waitFor(()=>page2.evaluate(`!!window.StudyDirector`),{label:'secondary shell after update'});
  const markers=await Promise.all([page1,page2].map(page=>page.evaluate(`sessionStorage.getItem('studyDirector.pwaReload.v1')`)));
  await waitFor(async()=>(await Promise.all([page1,page2].map(page=>page.evaluate(`sessionStorage.getItem('studyDirector.pwaReload.v1')`)))).every(value=>value===null),{label:'intended release boot confirmation'});
  assert.ok(markers.every(value=>value===null||JSON.parse(value).releaseId===next.releaseId));
  assert.equal(await workerIdentity(page1),next.releaseId);assert.equal(await workerIdentity(page2),next.releaseId);
  evidence.checks.activation={planEndAutomatic:true,recentEditSettled:true,hiddenSecondaryReloadImmediate:true,singleReloadEach:true,activeRelease:next.releaseId};

  const violationsAfter=await page1.evaluate(`__sd73iViolations.filter(row=>row.directive==='trusted-types'||row.directive==='require-trusted-types-for')`);
  assert.deepEqual(violationsAfter,[],'Trusted Types violation appeared after automatic update');

  // Corrupt service-worker script must fail closed without displacing the active release.
  served='bad-syntax';
  await waitForStartup(page1);
  if(await page1.evaluate(`document.documentElement.dataset.studyDirectorUiState==='secondary'`))await page1.evaluate(`document.querySelector('.ownership-banner[data-ownership-state="secondary"] button').click()`);
  await waitFor(()=>page1.evaluate(`document.documentElement.dataset.studyDirectorUiState==='primary'`),{timeout:30000,label:'primary ownership after update'});
  const corruptDueStamp=await page1.evaluate(`Number(localStorage.getItem('studyDirector.pwaUpdateCheck.v1'))`);
  const syntaxRequestFloor=swRequests;
  await waitFor(()=>page1.evaluate(`!document.getElementById('pwa-update-apply').disabled`),{label:'update control settled'});
  await page1.evaluate(`document.getElementById('pwa-update-apply').click()`);
  await waitFor(()=>swRequests>syntaxRequestFloor,{label:'corrupt worker check'});
  await sleep(700);
  await waitForNoInstalling(page1);
  assert.equal(await page1.evaluate(`Number(localStorage.getItem('studyDirector.pwaUpdateCheck.v1'))`),corruptDueStamp,'failed update check consumed the 24-hour cooldown');
  assert.equal(await workerIdentity(page1),next.releaseId);
  assert.equal(await page1.evaluate(`navigator.serviceWorker.getRegistration().then(registration=>!!registration.waiting)`),false);
  evidence.checks.corruptWorker={rejected:true,activePreserved:true};

  // A user retry bypasses failure backoff through the existing update control.
  // Required-asset hash failure must keep the active release and remove partial cache.
  served='bad-precache';
  const precacheRequestFloor=swRequests;
  await waitFor(()=>page1.evaluate(`!document.getElementById('pwa-update-apply').disabled`),{label:'failed check settled'});
  await page1.evaluate(`document.getElementById('pwa-update-apply').click()`);
  await waitFor(()=>swRequests>precacheRequestFloor,{label:'bad-precache worker check'});
  await waitForNoInstalling(page1);
  await sleep(400);
  assert.equal(await workerIdentity(page1),next.releaseId);
  assert.equal(await page1.evaluate(`navigator.serviceWorker.getRegistration().then(registration=>!!registration.waiting)`),false);
  const cacheNames=await page1.evaluate(`caches.keys()`);
  assert.equal(cacheNames.some(name=>name===`study-director-shell-${badPrecache.releaseId}`),false,'failed precache left a partial shell cache');
  evidence.checks.precacheFailure={rejected:true,partialCacheRemoved:true,activePreserved:true};

  const serious=[...page1.events,...page2.events].filter(event=>event.kind==='exception'||event.kind==='console-error');
  // Expected service-worker update failures are reported by Chromium as console errors; app runtime exceptions are not acceptable.
  const unexpected=serious.filter(event=>!/(ServiceWorker|service worker|Failed to update a ServiceWorker|bad-precache|invalid service worker)/i.test(event.text));
  assert.deepEqual(unexpected,[],`Unexpected runtime errors: ${unexpected.map(event=>event.text).join(' | ')}`);
  writeArtifact('pwa-update-results.json',JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify(evidence,null,2));
}catch(error){
  let diagnostic=null;
  console.error('Tab reloads',JSON.stringify({page1:page1?.loadCount,page2:page2?.loadCount}));
  console.error('Second tab state',await page2?.evaluate(`({origin:performance.timeOrigin,ui:document.documentElement.dataset.studyDirectorUiState,lifecycle:document.documentElement.dataset.studyDirectorLifecycle,pwaMessage:document.getElementById('pwa-update-message')?.textContent,update:document.getElementById('pwa-update-apply')?.textContent,reloadMarker:sessionStorage.getItem('studyDirector.pwaReload.v1')})`).catch(()=>null));
  try{diagnostic=await page1?.evaluate(`(async()=>({href:location.href,title:document.title,body:(document.body?.innerText||'').slice(0,700),pwaMessage:document.getElementById('pwa-update-message')?.textContent,openDialogs:[...document.querySelectorAll('dialog[open],[data-rich-asset-picker="active"]')].map(node=>node.tagName+'#'+node.id+'.'+node.className),ui:document.documentElement.dataset.studyDirectorUiState,controller:!!navigator.serviceWorker?.controller,registration:!!(await navigator.serviceWorker?.getRegistration()),waiting:!!(await navigator.serviceWorker?.getRegistration())?.waiting,caches:typeof caches==='undefined'?[]:await caches.keys(),violations:window.__sd73iViolations||[]}))()`);}catch(diagnosticError){diagnostic={error:String(diagnosticError)};}
  throw new Error(`${error.stack||error}\nPage diagnostic: ${JSON.stringify(diagnostic)}\nChromium stderr:\n${browser.stderr().slice(-8000)}`);
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
