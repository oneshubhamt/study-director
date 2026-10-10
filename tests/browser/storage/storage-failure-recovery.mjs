import fs from 'node:fs';
import {artifactPath,writeArtifact} from '../../helpers/artifacts.mjs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {CdpPage,withoutPwaChecks,studyTimezone} from '../../helpers/browser-harness.mjs';

const root=process.cwd();
const chromium=process.env.CHROMIUM_PATH||['/usr/bin/chromium','/tmp/chromium'].find(fs.existsSync)||'/usr/bin/chromium';
if(!fs.existsSync(chromium))throw new Error(`Chromium not found: ${chromium}`);
const manifest=JSON.parse(fs.readFileSync(path.join(root,'dist/build-manifest.json'),'utf8'));
const deployment=path.join(root,'dist/deployment');
const marker='/* PUBLIC PLUGIN API */';
const exposure=`window.__StorageDebug=Object.freeze({StorageHealthController,IndexedDb,AppData,PlanDraftEditor,writeLiveDraftNow,saveDayRecord,applySchedule,StartupLifecycle,AppOwnership,readStorageHealth,inspectStorageCapability,refreshStorageFallbackWarning,dismissStorageWarning});\n`;
let main=fs.readFileSync(path.join(deployment,manifest.main),'utf8');
if(!main.includes(marker))throw new Error('Storage-health browser harness hook is unavailable.');
main=main.replace(marker,exposure+marker);
main=withoutPwaChecks(main);

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitFor(fn,{timeout=45000,interval=100,label='condition'}={}){
  const started=Date.now();let last;
  while(Date.now()-started<timeout){
    try{last=await fn();if(last)return last;}catch(error){last=error;}
    await sleep(interval);
  }
  throw new Error(`Timed out waiting for ${label}${last instanceof Error?`: ${last.message}`:''}`);
}

const server=http.createServer((req,res)=>{
  const url=new URL(req.url||'/','http://127.0.0.1');
  const name=decodeURIComponent(url.pathname).replace(/^\/+/, '')||manifest.main;
  if(name.includes('..')){res.writeHead(400);res.end('bad path');return;}
  if(name===manifest.main){
    res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(main);return;
  }
  const file=path.resolve(deployment,name);
  if(!file.startsWith(deployment+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end('not found');return;}
  const contentType=name.endsWith('.js')?'application/javascript; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':name.endsWith('.webmanifest')?'application/manifest+json; charset=utf-8':name.endsWith('.woff2')?'font/woff2':name.endsWith('.png')?'image/png':'application/octet-stream';
  res.writeHead(200,{'content-type':contentType,'cache-control':'no-store'});res.end(fs.readFileSync(file));
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const appUrl=`http://127.0.0.1:${server.address().port}/${manifest.main}`;


const profile=fs.mkdtempSync(path.join(os.tmpdir(),'qa-storage-health-'));
const browser=spawn(chromium,[
  '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check',
  '--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'
],{stdio:['ignore','ignore','pipe']});
let browserError='';browser.stderr.on('data',chunk=>{browserError+=chunk;});
const activePortFile=path.join(profile,'DevToolsActivePort');
await waitFor(()=>fs.existsSync(activePortFile),{timeout:20000,label:'Chromium DevTools port'});
const [browserPort]=fs.readFileSync(activePortFile,'utf8').trim().split(/\r?\n/);
await waitFor(async()=>{try{return (await fetch(`http://127.0.0.1:${browserPort}/json/version`)).ok;}catch{return false;}},{label:'Chromium CDP endpoint'});

const controllableLocalStorage=`(()=>{
  const values=new Map();
  const faults={read:false,write:false,quota:false};
  const failure=(kind)=>{if(kind==='read'&&faults.read)throw new DOMException('forced localStorage read failure','SecurityError');if(kind==='write'&&faults.quota)throw new DOMException('forced localStorage quota failure','QuotaExceededError');if(kind==='write'&&faults.write)throw new DOMException('forced localStorage write failure','SecurityError');};
  const store={getItem:key=>{failure('read');key=String(key);return values.has(key)?values.get(key):null;},setItem:(key,value)=>{failure('write');values.set(String(key),String(value));},removeItem:key=>{failure('write');values.delete(String(key));},clear:()=>{failure('write');values.clear();},key:index=>[...values.keys()][index]??null,get length(){failure('read');return values.size;},_dump:()=>Object.fromEntries(values)};
  Object.defineProperty(window,'localStorage',{configurable:true,value:store});
  window.__storageFaults=faults;
})();`;
function indexedDbPrelude(mode){
  if(mode==='normal')return '';
  if(mode==='absent')return `Object.defineProperty(window,'indexedDB',{configurable:true,value:undefined});`;
  if(mode==='malformed')return `Object.defineProperty(window,'indexedDB',{configurable:true,value:{open:42}});`;
  if(mode==='throwing')return `Object.defineProperty(window,'indexedDB',{configurable:true,value:{open(){throw new Error('forced IndexedDB open throw')}}});`;
  if(mode==='blocked')return `Object.defineProperty(window,'indexedDB',{configurable:true,value:{open(){const request={error:null};setTimeout(()=>request.onblocked&&request.onblocked(),0);return request;}}});`;
  if(mode==='timeout')return `Object.defineProperty(window,'indexedDB',{configurable:true,value:{open(){return {error:null}}}});`;
  throw new Error(`Unknown IndexedDB mode: ${mode}`);
}
async function createPage({idbMode='normal',allLocalFailures=false,waitForStartup=true}={}){
  const target=await (await fetch(`http://127.0.0.1:${browserPort}/json/new?about:blank`,{method:'PUT'})).json();
  const page=await CdpPage.connect(target.webSocketDebuggerUrl);
  await page.send('Runtime.enable');await page.send('Page.enable');await page.send('Log.enable');
  await page.send('Emulation.setTimezoneOverride',{timezoneId:studyTimezone()});
  const faultSetup=allLocalFailures?`window.__storageFaults.read=true;window.__storageFaults.write=true;`:'';
  await page.send('Page.addScriptToEvaluateOnNewDocument',{source:`${controllableLocalStorage}${faultSetup}${indexedDbPrelude(idbMode)}window.alert=()=>{};window.confirm=()=>true;window.prompt=()=>'';`});
  await page.send('Page.navigate',{url:appUrl});
  try{await waitFor(()=>page.evaluate(`!!window.__StorageDebug`),{timeout:10000,label:`${idbMode} debug exposure`});}
  catch(error){
    const diagnostic=await page.evaluate(`({href:location.href,title:document.title,ready:document.readyState,body:(document.body&&document.body.innerText||'').slice(0,500)})`).catch(()=>null);
    throw new Error(`${error.message}; page=${JSON.stringify(diagnostic)}; exceptions=${page.events.map(event=>event.text).join(' | ')}`);
  }
  if(waitForStartup)await waitFor(()=>page.evaluate(`__StorageDebug.StartupLifecycle.status().fullyInitialized`),{timeout:60000,label:`${idbMode} startup`});
  await page.settle(3);
  return page;
}

const results={release:manifest.release,localStorage:{},indexedDB:{},planDraft:{},activeSession:{},recovery:{}};
const pages=[];
try{
  const page=await createPage();pages.push(page);
  const planScenario=await page.evaluate(`(async()=>{
    const d=__StorageDebug,wait=ms=>new Promise(r=>setTimeout(r,ms)),warningVisible=()=>!document.getElementById('notice-region').hidden&&!document.getElementById('storage-warning').hidden;
    const input=document.getElementById('plan-input');
    input.value='05:30 | 60 | Storage health probe | work | Reliability | block | 1';
    const originalPut=IDBObjectStore.prototype.put;__storageFaults.plan=true;
    IDBObjectStore.prototype.put=function(value,...args){if(this.name==='appMeta'&&value?.key==='planDraft'&&__storageFaults.plan)throw new DOMException('forced Plan metadata quota failure','QuotaExceededError');return originalPut.call(this,value,...args);};
    __storageFaults.quota=true;d.AppData.local.setText('probe','quota');
    d.PlanDraftEditor.composerInput();await wait(420);
    const failed=d.readStorageHealth();
    const failedView={issues:failed.issues.map(row=>row.source),warning:warningVisible(),status:document.getElementById('plan-status').textContent,board:document.getElementById('plan-board-state').textContent};
    await d.inspectStorageCapability();
    const afterCapabilityInspection=d.readStorageHealth().issues.map(row=>row.source);
    await d.IndexedDb.open();
    const afterUnrelatedSuccess=d.readStorageHealth().issues.map(row=>row.source);
    d.dismissStorageWarning();const dismissed=warningVisible();
    __storageFaults.quota=false;__storageFaults.plan=false;d.AppData.local.setText('probe','recovered');
    const recovered=await d.PlanDraftEditor.save();await wait(50);
    const recoveredView={issues:d.readStorageHealth().issues.map(row=>row.source),warning:warningVisible(),status:document.getElementById('plan-status').textContent};
    __storageFaults.write=true;d.AppData.local.setText('probe','blocked');__storageFaults.plan=true;input.value+='\\n';
    d.PlanDraftEditor.composerInput();const flushed=await d.PlanDraftEditor.flush();await wait(30);
    const explicitView={issues:d.readStorageHealth().issues.map(row=>row.source),warning:warningVisible(),status:document.getElementById('plan-status').textContent};
    __storageFaults.read=true;d.AppData.local.getText('probe','');
    const readFailed=d.readStorageHealth().issues.map(row=>row.source);
    __storageFaults.read=false;d.AppData.local.getText('probe','');
    const readRecovered=d.readStorageHealth().issues.map(row=>row.source);
    __storageFaults.write=false;__storageFaults.plan=false;await d.PlanDraftEditor.save();d.AppData.local.setText('probe','recovered');await wait(30);
    __storageFaults.plan=true;input.value+='\\n';await d.PlanDraftEditor.save();await wait(20);
    const secondFailureVisible=warningVisible();__storageFaults.plan=false;IDBObjectStore.prototype.put=originalPut;await d.PlanDraftEditor.save();if((await d.AppData.planData.read()).draft!==input.value)throw new Error('Plan recovery did not persist canonical metadata');
    return {failedView,afterCapabilityInspection,afterUnrelatedSuccess,dismissed,recovered,recoveredView,flushed,explicitView,readFailed,readRecovered,secondFailureVisible};
  })()`);
  assert.ok(planScenario.failedView.issues.includes('planDraft.write'),'debounced Plan failure was not source-owned');
  assert.ok(planScenario.failedView.issues.includes('localStorage.write'),'localStorage quota failure was not retained');
  assert.equal(planScenario.failedView.warning,true,'global warning did not surface the Plan failure');
  assert.match(planScenario.failedView.status,/Draft not saved/i,'Plan status did not surface failed durability');
  assert.equal(planScenario.failedView.board,'DRAFT READY','syntactic Plan validity was not preserved');
  assert.ok(planScenario.afterCapabilityInspection.includes('planDraft.write'),'capability inspection erased an active Plan issue');
  assert.ok(planScenario.afterUnrelatedSuccess.includes('planDraft.write'),'IndexedDB success cleared an unrelated Plan issue');
  assert.equal(planScenario.dismissed,false,'warning dismissal failed');
  assert.equal(planScenario.recovered,true,'Plan recovery save did not succeed');
  assert.ok(!planScenario.recoveredView.issues.includes('planDraft.write'),'Plan issue did not clear after Plan recovery');
  assert.equal(planScenario.flushed,false,'explicit Plan flush did not report persistence failure');
  assert.ok(planScenario.explicitView.issues.includes('planDraft.write'),'explicit Plan flush failure was not surfaced');
  assert.ok(planScenario.readFailed.includes('localStorage.read'),'localStorage read failure was not tracked');
  assert.ok(!planScenario.readRecovered.includes('localStorage.read'),'localStorage read issue did not clear after a successful read');
  assert.ok(planScenario.readRecovered.includes('localStorage.write'),'successful read incorrectly cleared the write issue');
  assert.equal(planScenario.secondFailureVisible,true,'a recovered then repeated issue remained incorrectly dismissed');
  results.planDraft={debounce:true,explicitFlush:true,status:true,validityPreserved:true};
  results.localStorage={read:true,write:true,quota:true,operationOwnedRecovery:true,dismissal:true};

  const activeScenario=await page.evaluate(`(async()=>{
    const d=__StorageDebug,wait=ms=>new Promise(r=>setTimeout(r,ms));
    __storageFaults.write=false;__storageFaults.quota=false;
    await d.PlanDraftEditor.save();d.applySchedule({skipNotify:true});
    await d.writeLiveDraftNow({markChanged:false});await wait(50);
    const beforeHealth=d.readStorageHealth();
    const original=IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction=function(){throw new DOMException('forced transaction failure','InvalidStateError')};
    d.IndexedDb.clearConnection();
    const fallbackOnly=await d.writeLiveDraftNow({markChanged:false});await wait(40);
    const afterFallbackOnly=d.readStorageHealth();
    __storageFaults.write=true;
    const failed=await d.writeLiveDraftNow({markChanged:false});await wait(40);
    const afterFailure=d.readStorageHealth();
    IDBDatabase.prototype.transaction=original;d.IndexedDb.clearConnection();__storageFaults.write=false;
    const recovered=await d.writeLiveDraftNow({markChanged:false});await wait(40);
    const afterRecovery=d.readStorageHealth();
    return {
      beforeLiveAt:beforeHealth.lastLiveSaveAt,beforeLocalAt:beforeHealth.lastLocalSaveAt,
      fallbackOk:!!(fallbackOnly&&fallbackOnly.ok),fallbackStorage:fallbackOnly&&fallbackOnly.storage,
      afterFallbackLiveAt:afterFallbackOnly.lastLiveSaveAt,afterFallbackLocalAt:afterFallbackOnly.lastLocalSaveAt,
      failedOk:!!(failed&&failed.ok),afterFailureLiveAt:afterFailure.lastLiveSaveAt,afterFailureLocalAt:afterFailure.lastLocalSaveAt,
      failureIssues:afterFailure.issues.map(row=>row.source),recoveredOk:!!(recovered&&recovered.ok),
      afterRecoveryLiveAt:afterRecovery.lastLiveSaveAt,afterRecoveryLocalAt:afterRecovery.lastLocalSaveAt,
      recoveryIssues:afterRecovery.issues.map(row=>row.source)
    };
  })()`);
  assert.ok(activeScenario.beforeLiveAt,'healthy live-session save did not establish its compatibility timestamp');
  assert.ok(activeScenario.beforeLocalAt,'healthy IndexedDB commit did not establish the visible local-save timestamp');
  assert.equal(activeScenario.fallbackOk,true,'local recovery fallback was not reported as available');
  assert.deepEqual(activeScenario.fallbackStorage,{local:true,idb:false},'fallback-only save did not report its actual storage outcome');
  assert.equal(activeScenario.afterFallbackLiveAt,activeScenario.beforeLiveAt,'fallback-only save advanced the live saved timestamp');
  assert.equal(activeScenario.afterFallbackLocalAt,activeScenario.beforeLocalAt,'fallback-only save advanced the confirmed local-save timestamp');
  assert.equal(activeScenario.failedOk,false,'forced live-session storage failure was reported as successful');
  assert.equal(activeScenario.afterFailureLiveAt,activeScenario.beforeLiveAt,'failed live-session save advanced the live saved timestamp');
  assert.equal(activeScenario.afterFailureLocalAt,activeScenario.beforeLocalAt,'failed live-session save advanced the confirmed local-save timestamp');
  assert.ok(activeScenario.failureIssues.includes('activeSession'),'failed live-session save was not surfaced');
  assert.ok(activeScenario.failureIssues.includes('indexedDB'),'transaction failure was not surfaced by IndexedDB');
  assert.equal(activeScenario.recoveredOk,true,'live-session recovery save failed after storage restoration');
  assert.ok(Date.parse(activeScenario.afterRecoveryLiveAt)>=Date.parse(activeScenario.beforeLiveAt),'successful recovery did not advance the live timestamp');
  assert.ok(Date.parse(activeScenario.afterRecoveryLocalAt)>=Date.parse(activeScenario.beforeLocalAt),'successful recovery did not advance the confirmed local-save timestamp');
  assert.ok(!activeScenario.recoveryIssues.includes('activeSession'),'active-session issue did not clear after repository-confirmed recovery');
  assert.ok(!activeScenario.recoveryIssues.includes('indexedDB'),'IndexedDB issue did not clear after a successful transaction');
  results.activeSession={repositoryConfirmedTimestamp:true,fallbackDoesNotConfirm:true,transactionFailure:true,recovery:true};

  const savedDayFallbackScenario=await page.evaluate(`(async()=>{
    const d=__StorageDebug,wait=ms=>new Promise(r=>setTimeout(r,ms));
    const original=IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction=function(){throw new DOMException('forced saved-day transaction failure','InvalidStateError')};
    d.IndexedDb.clearConnection();__storageFaults.write=false;
    await d.saveDayRecord();await wait(120);
    const degraded=d.readStorageHealth();
    IDBDatabase.prototype.transaction=original;d.IndexedDb.clearConnection();
    await d.AppData.dailyRecords.summaries();await wait(250);
    const recovered=d.readStorageHealth();
    return {savedAt:degraded.lastDailyRecordSaveAt,degradedIssues:degraded.issues.map(row=>row.source),recoveredIssues:recovered.issues.map(row=>row.source)};
  })()`);
  assert.ok(savedDayFallbackScenario.savedAt,'fallback Saved-Day save did not record its confirmed save time');
  assert.ok(savedDayFallbackScenario.degradedIssues.includes('dailyRecords'),'fallback Saved-Day success incorrectly cleared its degraded-storage issue');
  assert.ok(!savedDayFallbackScenario.recoveredIssues.includes('dailyRecords'),'Saved-Day issue did not clear after fallback migration recovered');
  results.activeSession.savedDayFallbackIssueOwnership=true;

  for(const mode of ['absent','malformed','throwing','blocked','timeout']){
    const faultPage=await createPage({idbMode:mode,waitForStartup:false});pages.push(faultPage);
    await waitFor(()=>faultPage.evaluate(`(()=>{const state=__StorageDebug.StartupLifecycle.status();return state.startRequested&&!state.initializing})()`),{timeout:60000,label:`${mode} fail-closed startup`});
    const state=await faultPage.evaluate(`(()=>({available:__StorageDebug.IndexedDb.isAvailable(),issues:__StorageDebug.readStorageHealth().issues.map(row=>row.source),warning:!document.getElementById('notice-region').hidden&&!document.getElementById('storage-warning').hidden,startup:__StorageDebug.StartupLifecycle.status(),planReadOnly:document.getElementById('plan-input').readOnly,applyDisabled:document.querySelector('[data-action="apply-schedule"]').disabled}))()`);
    assert.equal(state.available,!['absent','malformed'].includes(mode),`${mode} IndexedDB capability detection was incorrect`);
    assert.ok(state.issues.includes('indexedDB'),`${mode} IndexedDB failure was not source-owned`);
    assert.equal(state.warning,true,`${mode} IndexedDB failure was not globally visible`);
    assert.equal(state.startup.fullyInitialized,false,`${mode} IndexedDB failure allowed writable startup`);
    assert.equal(state.planReadOnly,true,`${mode} IndexedDB failure left Plan writable`);
    assert.equal(state.applyDisabled,true,`${mode} IndexedDB failure left Apply enabled`);
    results.indexedDB[mode]=true;
  }

  const doubleFault=await createPage({idbMode:'absent',allLocalFailures:true,waitForStartup:false});pages.push(doubleFault);
  await waitFor(()=>doubleFault.evaluate(`(()=>{const health=__StorageDebug.readStorageHealth(),warning=!document.getElementById('notice-region').hidden&&!document.getElementById('storage-warning').hidden;return warning&&health.issues.some(row=>row.source==='indexedDB')&&health.issues.some(row=>row.source==='localStorage.read')&&health.issues.some(row=>row.source==='localStorage.write')})()`),{timeout:10000,label:'combined storage failure visible'});
  const doubleState=await doubleFault.evaluate(`(()=>({issues:__StorageDebug.readStorageHealth().issues.map(row=>row.source),warning:!document.getElementById('notice-region').hidden&&!document.getElementById('storage-warning').hidden,text:document.getElementById('storage-warning-text').textContent,plan:document.getElementById('plan-board-state').textContent,startup:__StorageDebug.StartupLifecycle.status()}))()`);
  assert.ok(doubleState.issues.includes('indexedDB'),'combined failure lost the IndexedDB issue');
  assert.ok(doubleState.issues.includes('localStorage.read'),'combined failure lost the localStorage read issue');
  assert.ok(doubleState.issues.includes('localStorage.write'),'combined failure lost the localStorage write issue');
  assert.equal(doubleState.warning,true,'combined storage failure was not globally visible');
  await doubleFault.send('Page.reload',{ignoreCache:true});
  await waitFor(()=>doubleFault.evaluate(`!!window.__StorageDebug`),{timeout:15000,label:'combined-failure reload'});
  await waitFor(()=>doubleFault.evaluate(`(()=>{const health=__StorageDebug.readStorageHealth(),warning=!document.getElementById('notice-region').hidden&&!document.getElementById('storage-warning').hidden;return warning&&health.issues.some(row=>row.source==='indexedDB')&&health.issues.some(row=>row.source==='localStorage.read')})()`),{timeout:10000,label:'combined storage failure reconstructed'});
  const reloadState=await doubleFault.evaluate(`(()=>({issues:__StorageDebug.readStorageHealth().issues.map(row=>row.source),warning:!document.getElementById('notice-region').hidden&&!document.getElementById('storage-warning').hidden}))()`);
  assert.ok(reloadState.issues.includes('indexedDB')&&reloadState.issues.includes('localStorage.read'),'storage failures were not reconstructed after reload');
  assert.equal(reloadState.warning,true,'storage warning did not return after reload');
  results.recovery={bothSystemsUnavailable:true,inMemoryAuthority:true,reload:true};

  const runtimeExceptions=pages.flatMap(current=>current.events.filter(event=>event.kind==='exception').map(event=>event.text));
  assert.deepEqual(runtimeExceptions,[],`Unexpected runtime exceptions: ${runtimeExceptions.join(' | ')}`);
  writeArtifact('storage-failure-recovery-results.json',JSON.stringify({status:'PASS',...results},null,2)+'\n');
  console.log(JSON.stringify({status:'PASS',...results},null,2));
}finally{
  pages.forEach(page=>{try{page.close();}catch{}});
  browser.kill('SIGTERM');
  server.close();
  await sleep(100);
  if(browser.exitCode===null)browser.kill('SIGKILL');
  if(browserError&&process.exitCode)console.error(browserError.slice(-4000));
}
