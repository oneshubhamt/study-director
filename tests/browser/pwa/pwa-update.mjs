import {createPwaVariant} from '../../helpers/pwa-variant.mjs';
import assert from 'node:assert/strict';
import {artifactPath,writeArtifact} from '../../helpers/artifacts.mjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {renderBuild,validateBuild} from '../../../build/build.mjs';

const root=process.cwd();
const build=renderBuild();
assert.equal(validateBuild(build),true);
const deployment=build.deployment;
const originalIndex=deployment.get(build.identity.main);
const originalWorker=deployment.get('sw.js');
const originalPwa=build.pwa.deployment;
const chromium=process.env.CHROMIUM_PATH||['/usr/bin/chromium','/tmp/chromium'].find(fs.existsSync)||'/usr/bin/chromium';
if(!fs.existsSync(chromium))throw new Error(`Chromium not found: ${chromium}`);

const support=JSON.parse(deployment.get('firebase-hosting-headers.merge.json'));
const rootHeaders=support.hosting.headers.find(rule=>rule.source==='/**')?.headers||[];
const enforced=rootHeaders.find(header=>header.key==='Content-Security-Policy')?.value||'';
const trusted=rootHeaders.find(header=>header.key==='Content-Security-Policy-Report-Only')?.value||'';
const enforcedCsp=`${enforced}; ${trusted}`;

const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitFor(operation,{timeout=60000,interval=100,label='condition'}={}){
  const started=Date.now();let last;
  while(Date.now()-started<timeout){
    try{last=await operation();if(last)return last;}catch(error){last=error;}
    await sleep(interval);
  }
  throw new Error(`Timed out waiting for ${label}${last instanceof Error?`: ${last.message}`:''}`);
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

class CdpPage{
  constructor(socket){
    this.socket=socket;this.nextId=0;this.pending=new Map();this.events=[];this.loadCount=0;
    socket.onmessage=event=>{
      const message=JSON.parse(event.data);
      if(message.id){
        const pending=this.pending.get(message.id);if(!pending)return;
        this.pending.delete(message.id);
        message.error?pending.reject(new Error(JSON.stringify(message.error))):pending.resolve(message.result);return;
      }
      if(message.method==='Page.loadEventFired')this.loadCount+=1;
      if(message.method==='Runtime.exceptionThrown')this.events.push({kind:'exception',text:message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text||'Runtime exception'});
      if(message.method==='Runtime.consoleAPICalled'&&message.params.type==='error')this.events.push({kind:'console-error',text:message.params.args.map(arg=>arg.value??arg.description??'').join(' ')});
    };
  }
  static async connect(url){const socket=new WebSocket(url);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});return new CdpPage(socket);}
  send(method,params={}){return new Promise((resolve,reject)=>{const id=++this.nextId;const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error(`CDP ${method} timed out`));},10000);this.pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});this.socket.send(JSON.stringify({id,method,params}));});}
  async evaluate(expression){
    const result=await this.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});
    if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Evaluation failed');
    return result.result.value;
  }
  close(){this.socket.close();}
}

const profile=fs.mkdtempSync(path.join(os.tmpdir(),'study-director-qa-pwa-'));
const browser=spawn(chromium,[
  '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check',
  '--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'
],{stdio:['ignore','ignore','pipe'],env:{...process.env,TERM:process.env.TERM||'xterm'}});
let browserError='';browser.stderr.on('data',chunk=>{browserError+=chunk;});
const activePath=path.join(profile,'DevToolsActivePort');
await waitFor(()=>fs.existsSync(activePath),{timeout:20000,label:'Chromium DevTools port'});
const [browserPort]=fs.readFileSync(activePath,'utf8').trim().split(/\r?\n/);
await waitFor(async()=>{try{return (await fetch(`http://127.0.0.1:${browserPort}/json/version`)).ok;}catch{return false;}},{label:'Chromium endpoint'});

async function createPage(){
  // Navigate at target creation so the first CDP evaluation is never stranded across an initial navigation.
  // The enforced CSP is already delivered by the server before any application script runs.
  const target=await (await fetch(`http://127.0.0.1:${browserPort}/json/new?${encodeURIComponent(appUrl)}`,{method:'PUT'})).json();
  const page=await CdpPage.connect(target.webSocketDebuggerUrl);
  await page.send('Runtime.enable');await page.send('Page.enable');await page.send('Network.enable');
  await page.send('Emulation.setTimezoneOverride',{timezoneId:'Asia/Kolkata'});
  await page.send('Emulation.setDeviceMetricsOverride',{width:1365,height:900,deviceScaleFactor:1,mobile:false});
  await waitFor(()=>page.evaluate(`!!(window.StudyDirector&&document.querySelector('[data-tab="plan"]'))`),{label:'Study Director shell'});
  await page.evaluate(`(()=>{window.__sd73iViolations=[];document.addEventListener('securitypolicyviolation',event=>__sd73iViolations.push({directive:event.effectiveDirective,disposition:event.disposition,blocked:event.blockedURI||''}));window.alert=()=>{};window.confirm=()=>true;window.prompt=()=>'';document.querySelector('[data-action="skip-name-setup"]')?.click();return true})()`);
  return page;
}
async function waitForStartup(page){
  await waitFor(()=>page.evaluate(`document.documentElement.dataset.studyDirectorLifecycle==='ready'||document.documentElement.dataset.studyDirectorLifecycle==='read-only'`),{label:'session lifecycle ready'});
}
async function workerIdentity(page,slot='active'){
  return page.evaluate(`(async()=>{const registration=await navigator.serviceWorker.getRegistration();const worker=registration&&registration['${slot}'];if(!worker)return '';return new Promise(resolve=>{const channel=new MessageChannel();const timer=setTimeout(()=>resolve('timeout'),3000);channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data&&event.data.releaseId||'')};worker.postMessage({type:'SD_PWA_IDENTIFY'},[channel.port2])})})()`);
}
async function waitForNoInstalling(page){
  return waitFor(()=>page.evaluate(`navigator.serviceWorker.getRegistration().then(registration=>registration&&!registration.installing)`),{label:'service-worker installation settled'});
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
  const noCheckBefore=swRequests;
  served='next';
  await page1.evaluate(`window.dispatchEvent(new Event('focus'))`);
  await sleep(700);
  assert.equal(swRequests,noCheckBefore,'a fresh 24-hour cooldown performed an unnecessary update check');
  assert.equal(await page1.evaluate(`navigator.serviceWorker.getRegistration().then(registration=>!!registration.waiting)`),false);
  evidence.checks.cooldown={twentyFourHours:true,recentForegroundSkipped:true};
  served='current';

  page2=await createPage();
  await waitForStartup(page2);
  await waitFor(()=>page2.evaluate(`!!navigator.serviceWorker.controller`),{label:'secondary controlled tab'});
  await waitFor(()=>page1.evaluate(`document.documentElement.dataset.studyDirectorUiState==='primary'`),{label:'primary ownership'});
  await waitFor(()=>page2.evaluate(`document.documentElement.dataset.studyDirectorUiState==='secondary'`),{label:'secondary ownership'});
  await page2.evaluate(`(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});return true})()`);


  const due=Date.now()-25*60*60*1000;
  await Promise.all([page1,page2].map(page=>page.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0})));
  await Promise.all([page1,page2].map(page=>waitFor(()=>page.evaluate(`navigator.onLine===false`),{label:'offline tab'})));
  await page1.evaluate(`localStorage.setItem('studyDirector.pwaUpdateCheck.v1','${due}')`);
  await waitFor(()=>page1.evaluate(`navigator.onLine===false`),{label:'offline state'});
  const offlineDocument=await page1.evaluate('performance.timeOrigin');
  await page1.send('Page.reload',{ignoreCache:false});
  await waitFor(()=>page1.evaluate(`performance.timeOrigin!==${offlineDocument}&&document.readyState==='complete'`),{label:'offline restart before due discovery'});
  await waitForStartup(page1);
  if(await page1.evaluate(`document.documentElement.dataset.studyDirectorUiState==='secondary'`))await page1.evaluate(`document.querySelector('.ownership-banner[data-ownership-state="secondary"] button').click()`);
  await waitFor(()=>page1.evaluate(`document.documentElement.dataset.studyDirectorUiState==='primary'`),{label:'primary control after offline restart'});
  const scheduleState=await page1.evaluate(`(async()=>{const now=new Date(),minute=now.getHours()*60+now.getMinutes()-1,hh=String(Math.floor((minute+1440)%1440/60)).padStart(2,'0'),mm=String((minute+1440)%1440%60).padStart(2,'0'),input=document.getElementById('plan-input');document.querySelector('[data-tab="plan"]').click();input.value=hh+':'+mm+' | 30 | PwaUpdateQA Update QA | work | QA | pages | 5';input.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,500));const apply=document.querySelector('[data-action="apply-schedule"]');const enabled=!apply.disabled;apply.click();return enabled})()`);
  assert.equal(scheduleState,true,'QA Plan could not be applied');
  await waitFor(()=>page1.evaluate(`document.getElementById('cd-mode')?.textContent.includes('RUNNING')&&document.getElementById('execute-state-overlay')?.hidden`),{label:'running timer'});

  await waitFor(()=>page1.evaluate(`!document.getElementById('pwa-update-apply').disabled`),{label:'ongoing update check settled'});
  await waitForNoInstalling(page1);await sleep(250);
  served='next';
  const offlineSwRequests=swRequests;
  await page1.evaluate(`document.dispatchEvent(new Event('visibilitychange'))`);
  await sleep(500);
  assert.equal(swRequests,offlineSwRequests,'offline due check attempted a service-worker fetch');
  assert.equal(await page1.evaluate(`Number(localStorage.getItem('studyDirector.pwaUpdateCheck.v1'))`),due,'offline due check consumed the 24-hour cooldown');
  await Promise.all([page1,page2].map(page=>page.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1})));
  await waitFor(()=>page1.evaluate(`navigator.onLine===true`),{label:'online state'});
  const discoveryRequests=swRequests;
  await Promise.all([page1,page2].map(page=>page.evaluate(`window.dispatchEvent(new Event('online'))`)));
  await waitFor(()=>page1.evaluate(`navigator.serviceWorker.getRegistration().then(registration=>!!registration.waiting)`),{timeout:60000,label:'automatic due update discovery'});
  assert.equal(swRequests-discoveryRequests,1,'multiple tabs duplicated the proactive service-worker update check');
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
  await waitFor(async()=>(await workerIdentity(page1))===next.releaseId&&(await workerIdentity(page2))===next.releaseId,{timeout:60000,label:'automatic safe activation'});
  await waitFor(()=>page1.loadCount>loadsBefore.page1&&page2.loadCount>loadsBefore.page2,{timeout:60000,label:'all controlled tabs immediate reload'});
  assert.equal(page1.loadCount-loadsBefore.page1,1);
  assert.equal(page2.loadCount-loadsBefore.page2,1,'hidden secondary tab did not reload immediately after controller change');
  await waitFor(()=>page1.evaluate(`!!window.StudyDirector`),{label:'primary shell after update'});
  await waitFor(()=>page2.evaluate(`!!window.StudyDirector`),{label:'secondary shell after update'});
  const markers=await Promise.all([page1,page2].map(page=>page.evaluate(`sessionStorage.getItem('studyDirector.pwaReload.v1')`)));
  await waitFor(async()=>(await Promise.all([page1,page2].map(page=>page.evaluate(`sessionStorage.getItem('studyDirector.pwaReload.v1')`)))).every(value=>value===null),{label:'intended release boot confirmation'});
  assert.ok(markers.every(value=>value===null||JSON.parse(value).releaseId===next.releaseId));
  evidence.checks.activation={planEndAutomatic:true,recentEditSettled:true,hiddenSecondaryReloadImmediate:true,singleReloadEach:true,activeRelease:next.releaseId};

  const violationsAfter=await page1.evaluate(`__sd73iViolations.filter(row=>row.directive==='trusted-types'||row.directive==='require-trusted-types-for')`);
  assert.deepEqual(violationsAfter,[],'Trusted Types violation appeared after automatic update');

  // Corrupt service-worker script must fail closed without displacing the active release.
  served='bad-syntax';
  await waitFor(()=>page1.evaluate(`document.documentElement.dataset.studyDirectorUiState==='primary'`),{timeout:30000,label:'primary ownership after update'});
  await page1.evaluate(`localStorage.setItem('studyDirector.pwaUpdateCheck.v1',String(Date.now()-25*60*60*1000));window.dispatchEvent(new Event('online'))`);
  const corruptDueStamp=await page1.evaluate(`Number(localStorage.getItem('studyDirector.pwaUpdateCheck.v1'))`);
  const syntaxRequestFloor=swRequests;
  await waitFor(()=>swRequests>syntaxRequestFloor,{label:'corrupt worker check'});
  await sleep(700);
  await waitForNoInstalling(page1);
  assert.equal(await page1.evaluate(`Number(localStorage.getItem('studyDirector.pwaUpdateCheck.v1'))`),corruptDueStamp,'failed update check consumed the 24-hour cooldown');
  assert.equal(await workerIdentity(page1),next.releaseId);
  assert.equal(await page1.evaluate(`navigator.serviceWorker.getRegistration().then(registration=>!!registration.waiting)`),false);
  evidence.checks.corruptWorker={rejected:true,activePreserved:true};

  // Restart the page offline so the bounded in-memory failure backoff is reset without performing a successful check.
  await page1.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  const priorDocument=await page1.evaluate('performance.timeOrigin');
  await page1.send('Page.reload',{ignoreCache:false});
  await waitFor(()=>page1.evaluate(`performance.timeOrigin!==${priorDocument}&&document.readyState==='complete'`),{label:'new offline document'});
  await waitFor(()=>page1.evaluate(`!!window.StudyDirector`),{label:'shell after offline updater retry reset'});
  await waitForStartup(page1);

  // Valid worker with a bad required-asset hash must delete its partial shell and keep the old active release.
  served='bad-precache';
  await page1.evaluate(`localStorage.setItem('studyDirector.pwaUpdateCheck.v1',String(Date.now()-25*60*60*1000))`);
  await page1.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  await waitFor(()=>page1.evaluate(`navigator.onLine===true`),{label:'online state before bad-precache retry'});
  await page1.evaluate(`window.dispatchEvent(new Event('online'))`);
  const precacheRequestFloor=swRequests;
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
  try{diagnostic=await page1?.evaluate(`(async()=>({href:location.href,title:document.title,body:(document.body?.innerText||'').slice(0,700),pwaMessage:document.getElementById('pwa-update-message')?.textContent,ui:document.documentElement.dataset.studyDirectorUiState,controller:!!navigator.serviceWorker?.controller,registration:!!(await navigator.serviceWorker?.getRegistration()),waiting:!!(await navigator.serviceWorker?.getRegistration())?.waiting,caches:typeof caches==='undefined'?[]:await caches.keys(),violations:window.__sd73iViolations||[]}))()`);}catch(diagnosticError){diagnostic={error:String(diagnosticError)};}
  throw new Error(`${error.stack||error}\nPage diagnostic: ${JSON.stringify(diagnostic)}\nChromium stderr:\n${browserError.slice(-8000)}`);
}finally{
  try{page1?.close();page2?.close();}catch{}
  browser.kill('SIGTERM');
  await Promise.race([new Promise(resolve=>browser.once('exit',resolve)),sleep(3000)]);
  server.close();
  try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});}catch(cleanupError){console.error('QA profile cleanup:',cleanupError.code);}
}
