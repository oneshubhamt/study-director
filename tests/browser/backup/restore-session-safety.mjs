import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';

const root=process.cwd();
const chromium=process.env.CHROMIUM_PATH||['/usr/bin/chromium','/tmp/chromium'].find(fs.existsSync)||'/usr/bin/chromium';
const manifest=JSON.parse(fs.readFileSync(path.join(root,'dist/build-manifest.json'),'utf8'));
const deployment=path.join(root,'dist/deployment');
const mainPath=path.join(deployment,manifest.main);
const marker='/* PUBLIC PLUGIN API */';
const exposure=`window.__RestoreSafetyQA=Object.freeze({StartupLifecycle,AppOwnership,OwnershipUiProjection,AppMutationCoordinator,BackupController,CompatibilityFacade,suspendTodaySession,LibraryView,ReviewEditor,AppData,TimerEngine,TimerState,TIMER_MODES,TASKS,applySchedule,goTab,flushLiveDraft,setStudyQuality,hasBlockingActiveSession,resetRuntimeSessionState,setSessionPanelMode,setTimerMode,todayISO});\n`;
let main=fs.readFileSync(mainPath,'utf8');
if(!main.includes(marker))throw new Error('Restore-safety browser harness hook is unavailable.');
main=main.replace(marker,exposure+marker).replace('void PwaLifecycle.install();','/* PWA disabled for deterministic RestoreSafetyQA browser QA. */');

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitFor(fn,{timeout=30000,interval=80,label='condition'}={}){
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
  if(name===manifest.main){res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(main);return;}
  const file=path.resolve(deployment,name);
  if(!file.startsWith(deployment+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end('not found');return;}
  const type=name.endsWith('.js')?'application/javascript; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':name.endsWith('.webmanifest')?'application/manifest+json; charset=utf-8':name.endsWith('.woff2')?'font/woff2':name.endsWith('.png')?'image/png':'application/octet-stream';
  res.writeHead(200,{'content-type':type,'cache-control':'no-store'});res.end(fs.readFileSync(file));
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const appUrl=`http://127.0.0.1:${server.address().port}/${manifest.main}`;

class CdpPage{
  constructor(ws){this.ws=ws;this.nextId=0;this.pending=new Map();this.events=[];ws.onmessage=event=>{const msg=JSON.parse(event.data);if(msg.id){const pending=this.pending.get(msg.id);if(!pending)return;this.pending.delete(msg.id);msg.error?pending.reject(new Error(JSON.stringify(msg.error))):pending.resolve(msg.result);return;}if(msg.method==='Runtime.exceptionThrown')this.events.push(msg.params.exceptionDetails.exception?.description||msg.params.exceptionDetails.text||'runtime exception');};}
  static async connect(url){const ws=new WebSocket(url);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});return new CdpPage(ws);}
  send(method,params={}){return new Promise((resolve,reject)=>{const id=++this.nextId;this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));});}
  async evaluate(expression){const result=await this.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'evaluation failed');return result.result.value;}
  close(){this.ws.close();}
}

const profile=fs.mkdtempSync(path.join(os.tmpdir(),'qa-safety-'));
const proc=spawn(chromium,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
let stderr='';proc.stderr.on('data',chunk=>{stderr+=chunk;});
const activePath=path.join(profile,'DevToolsActivePort');
await waitFor(()=>fs.existsSync(activePath),{timeout:20000,label:'Chromium DevTools port'});
const [browserPort]=fs.readFileSync(activePath,'utf8').trim().split(/\r?\n/);
await waitFor(async()=>{try{return (await fetch(`http://127.0.0.1:${browserPort}/json/version`)).ok;}catch{return false;}},{label:'CDP endpoint'});

async function createPage(){
  const target=await (await fetch(`http://127.0.0.1:${browserPort}/json/new?about:blank`,{method:'PUT'})).json();
  const page=await CdpPage.connect(target.webSocketDebuggerUrl);
  await page.send('Runtime.enable');await page.send('Page.enable');await page.send('Emulation.setTimezoneOverride',{timezoneId:'Asia/Kolkata'});
  await page.send('Page.navigate',{url:appUrl});
  await waitFor(()=>page.evaluate(`document.readyState==='complete'`),{label:'Study Director page load'});
  const loadedUrl=await page.evaluate(`location.href`);
  if(String(loadedUrl||'').startsWith('chrome-error://'))throw new Error('Chromium blocked the local RestoreSafetyQA QA origin before Study Director could load.');
  await waitFor(()=>page.evaluate(`!!(window.__RestoreSafetyQA&&__RestoreSafetyQA.StartupLifecycle.status().fullyInitialized)`),{timeout:45000,label:'Study Director startup'});
  await sleep(250);return page;
}

let page1,page2;
try{
  page1=await createPage();
  assert.equal(await page1.evaluate(`__RestoreSafetyQA.AppOwnership.status().hasControl`),true,'primary tab did not acquire control');

  const initial=await page1.evaluate(`(()=>{const q=s=>document.querySelector(s);return {blocked:__RestoreSafetyQA.hasBlockingActiveSession(),open:q('[data-action="pick-import-file"]').disabled,recoverDevice:q('[data-action="recover-device-backup"]').disabled,clear:q('[data-action="clear-library"]').disabled,export:q('[data-action="export-backup"]').disabled};})()`);
  assert.deepEqual(initial,{blocked:false,open:false,recoverDevice:false,clear:false,export:false},'idle primary tab should allow recovery entry, file import, Clear Library and export');

  const active=await page1.evaluate(`(async()=>{
    const d=__RestoreSafetyQA,wait=ms=>new Promise(r=>setTimeout(r,ms)),now=new Date(),m=now.getHours()*60+now.getMinutes()-1,fmt=v=>String(Math.floor((v+1440)%1440/60)).padStart(2,'0')+':'+String((v+1440)%1440%60).padStart(2,'0');
    document.getElementById('plan-input').value=fmt(m)+' | 60 | Restore safety QA | work | Ethics | pages | 10';
    if(!d.applySchedule({skipNotify:true}))throw new Error('QA schedule did not apply');
    d.TimerEngine.startCur(120);if(d.TimerState.snapshot().mode!==d.TIMER_MODES.RUNNING)throw new Error('QA running timer did not start');await wait(120);await d.flushLiveDraft();
    d.goTab('review');await wait(100);
    const reflection=document.getElementById('daily-reflection');reflection.value='ACTIVE SESSION REVIEW';d.setStudyQuality(4,{save:false});d.ReviewEditor.saveReview({strict:true});await d.ReviewEditor.flushPending();await d.ReviewEditor.settled();await d.flushLiveDraft();
    const loaded=await d.AppData.activeSession.load();if(!loaded?.value)throw new Error('active session was not persisted');
    reflection.value='SESSION SNAPSHOT DIFFERENT';d.setStudyQuality(2,{save:false});d.ReviewEditor.saveReview({strict:true});await d.ReviewEditor.flushPending();await d.ReviewEditor.settled();
    const created=await d.BackupController.createCheckpoint(),candidate=await d.BackupController.inspect(created.blob,{filename:created.filename}),parsed=await d.CompatibilityFacade.inspectBackup(created.blob,{filename:created.filename});
    window.__RestoreSafetyQACandidate=candidate;window.__RestoreSafetyQAExpected=parsed.importedActiveSession;
    reflection.value='ACTIVE SESSION REVIEW';d.setStudyQuality(4,{save:false});d.ReviewEditor.saveReview({strict:true});await d.ReviewEditor.flushPending();await d.ReviewEditor.settled();
    d.TimerState.paused=true;d.OwnershipUiProjection.apply();
    const q=s=>document.querySelector(s),open=q('[data-action="pick-import-file"]'),recoverDevice=q('[data-action="recover-device-backup"]'),clear=q('[data-action="clear-library"]'),file=q('#import-file');
    return {blocked:d.hasBlockingActiveSession(),paused:d.TimerState.paused,open:open.disabled,recoverDevice:recoverDevice.disabled,clear:clear.disabled,file:file.disabled,export:q('[data-action="export-backup"]').disabled,reason:open.dataset.ownershipUiReason,revision:parsed.importedActiveSession?.revision||0,backupReview:parsed.importedActiveSession?.snapshot?.review?.reflection||''};
  })()`);
  assert.equal(active.blocked,true,'applied/paused session did not block destructive import surfaces');
  assert.equal(active.paused,true,'paused-state fixture did not engage');
  assert.deepEqual({open:active.open,recoverDevice:active.recoverDevice,clear:active.clear,file:active.file,export:active.export},{open:true,recoverDevice:true,clear:true,file:true,export:false},'active session UI gate is incomplete or blocks export');
  assert.equal(active.reason,'active-session','active-session disabled control must expose its recovery reason');
  const remedy=await page1.evaluate(`(()=>{const button=document.querySelector('[data-action="pick-import-file"]');button.dispatchEvent(new PointerEvent('pointerover',{bubbles:true}));return {description:button.getAttribute('aria-describedby'),text:document.getElementById('ownership-blocked-popover')?.textContent};})()`);
  assert.equal(remedy.description,'ownership-blocked-popover');assert.match(remedy.text,/Suspend or reset today’s active session/u,'active-session hint must explain the remedy');
  assert.equal(active.backupReview,'SESSION SNAPSHOT DIFFERENT','backup fixture did not preserve Active Session Review state');

  console.log('[restore-safety] active-session UI and backup verified');
  const blockedRestore=await page1.evaluate(`(async()=>{const legacy=new Blob([JSON.stringify({version:6,records:[],areaNotes:{}})],{type:'application/json'}),candidate=await __RestoreSafetyQA.BackupController.inspect(legacy,{filename:'legacy.json'});return __RestoreSafetyQA.BackupController.restore(candidate).then(()=>({ok:true}),error=>({ok:false,message:String(error&&error.message||error)}));})()`);
  assert.equal(blockedRestore.ok,false,'older backup restore unexpectedly began during an active session');
  assert.match(blockedRestore.message,/End or suspend the active session before importing/u,'older backup restore did not fail at the internal precondition');
  console.log('[restore-safety] internal restore guard verified');
  const blockedClear=await page1.evaluate(`(async()=>{await __RestoreSafetyQA.LibraryView.clearAll();return document.getElementById('library-status').textContent;})()`);
  assert.match(blockedClear,/End or suspend the active session before clearing Library data/u,'Clear Library internal precondition did not surface');

  console.log('[restore-safety] internal clear guard verified');
  const suspended=await page1.evaluate(`(async()=>{
    const d=__RestoreSafetyQA;let done=false;const suspending=d.suspendTodaySession().finally(()=>{done=true;});while(!done){const dialog=document.getElementById('sd-interaction-dialog');if(dialog?.open)dialog.querySelector('.interaction-actions .primary')?.click();await new Promise(resolve=>setTimeout(resolve,20));}await suspending;await d.ReviewEditor.settled();
    const q=s=>document.querySelector(s);return {blocked:d.hasBlockingActiveSession(),open:q('[data-action="pick-import-file"]').disabled,recoverDevice:q('[data-action="recover-device-backup"]').disabled,clear:q('[data-action="clear-library"]').disabled,file:q('#import-file').disabled,mode:d.TimerState.mode};
  })()`);
  assert.deepEqual(suspended,{blocked:false,open:false,recoverDevice:false,clear:false,file:false,mode:'suspended'},'genuinely suspended session should allow recovery entry, file import and Clear Library');

  console.log('[restore-safety] suspended-session access verified');
  const restored=await page1.evaluate(`(async()=>{
    const d=__RestoreSafetyQA,wait=ms=>new Promise(r=>setTimeout(r,ms));let done=false,value,error;const deadline=Date.now()+60000;
    d.BackupController.restore(window.__RestoreSafetyQACandidate).then(v=>{value=v;done=true},e=>{error=e;done=true});
    while(!done&&Date.now()<deadline){const dialog=document.getElementById('sd-interaction-dialog');if(dialog?.open){const groups=[...dialog.querySelectorAll('.interaction-group')];for(const group of groups){if(group.querySelector('.interaction-group-title')?.textContent.includes('Active / suspended session')){[...group.querySelectorAll('.interaction-option')].find(button=>button.textContent.includes('Use session from'))?.click();}}dialog.querySelector('.interaction-actions .primary')?.click();}await wait(20);}
    if(!done)throw new Error('Timed out waiting for protected restore to finish.');
    if(error)throw error;
    await d.AppData.activeSession.settled();await d.ReviewEditor.settled();
    const loaded=await d.AppData.activeSession.load(),expected=window.__RestoreSafetyQAExpected;
    return {revision:loaded.value?.revision||0,expectedRevision:expected?.revision||0,blocked:d.hasBlockingActiveSession(),review:loaded.value?.snapshot?.review?.reflection||'',scheduleMatches:loaded.value?.scheduleText===expected?.scheduleText,tasks:d.TASKS.length,mode:d.TimerState.mode,paused:d.TimerState.paused,runtimeActive:!!(d.TimerState.runtime&&d.TimerState.runtime.startMs!==null),taskAligned:d.TimerState.runtime?.taskIdx===d.TimerState.currentIndex,result:value};
  })()`);
  assert.equal(restored.revision,restored.expectedRevision,'restored active session was rewritten to a fresh revision before verification');
  assert.equal(restored.blocked,true,'restored active session did not re-enter active-session safety state');
  assert.equal(restored.review,'SESSION SNAPSHOT DIFFERENT','active-session hydration did not preserve the restored Review state');
  assert.equal(restored.scheduleMatches,true,'restored Active Session did not retain the backed-up applied Plan schedule');
  assert.ok(restored.tasks>0,'restored Active Session did not apply its Plan into live runtime tasks');
  assert.deepEqual({mode:restored.mode,paused:restored.paused,runtimeActive:restored.runtimeActive,taskAligned:restored.taskAligned},{mode:'running',paused:false,runtimeActive:true,taskAligned:true},'a backed-up running Active Session must restore as an applied Plan with a live RUNNING timer on the same task');

  const recovery=await page1.evaluate(`(()=>{const d=__RestoreSafetyQA;d.AppMutationCoordinator.failClosed('RestoreSafetyQA forced rollback verification fault');const banner=document.querySelector('.ownership-banner');return {title:banner?.querySelector('b')?.textContent||'',body:banner?.querySelector('span')?.textContent||'',button:banner?.querySelector('button')?.textContent||'',state:banner?.dataset.ownershipState||''};})()`);
  assert.deepEqual(recovery,{title:'Data recovery required',body:'Study Director retained the recovery journal. Reload to complete recovery. Do not clear site data.',button:'',state:'recovery-fault:restore'},'recovery fault was misrepresented as ordinary ownership');
  await page1.evaluate(`__RestoreSafetyQA.AppMutationCoordinator.clearFault()`);
  await waitFor(()=>page1.evaluate(`!document.querySelector('.ownership-banner')`),{label:'recovery banner removal'});

  page2=await createPage();
  await waitFor(()=>page2.evaluate(`__RestoreSafetyQA.AppOwnership.state==='SECONDARY'||__RestoreSafetyQA.AppOwnership.status().hasControl===false`),{label:'secondary ownership'});
  await waitFor(()=>page2.evaluate(`document.querySelector('.ownership-banner')?.querySelector('b')?.textContent==='Study Director controlled elsewhere'`),{label:'secondary ownership banner'});
  const secondary=await page2.evaluate(`(()=>{const banner=document.querySelector('.ownership-banner');return {title:banner.querySelector('b').textContent,body:banner.querySelector('span').textContent,button:banner.querySelector('button')?.textContent||'',owner:__RestoreSafetyQA.AppOwnership.status().hasControl};})()`);
  assert.equal(secondary.owner,false,'second tab unexpectedly owns the timer');
  assert.equal(secondary.title,'Study Director controlled elsewhere');
  assert.equal(secondary.button,'Take control','genuine secondary ownership must retain Take control');
  assert.match(secondary.body,/Another live tab controls Study Director writes/u);

  const runtimeErrors=[...(page1?.events||[]),...(page2?.events||[])];
  assert.deepEqual(runtimeErrors,[],'runtime errors occurred: '+runtimeErrors.join('\n'));
  console.log(JSON.stringify({status:'PASS',release:manifest.release||'RestoreSafetyQA',checks:{activeAndPausedUiBlocked:true,exportPreserved:true,internalRestoreGuard:true,internalClearGuard:true,suspendedAllowed:true,restoredSessionRevisionStable:true,activeSessionReviewStable:true,runningSessionHandoffOperational:true,recoveryBannerTruthful:true,secondaryTakeControlPreserved:true,noRuntimeErrors:true}},null,2));
}finally{
  try{page1?.close();}catch{}try{page2?.close();}catch{}
  try{proc.kill('SIGTERM');}catch{}server.close();
  if(proc.exitCode===null)await Promise.race([new Promise(resolve=>proc.once('exit',resolve)),sleep(1500)]);
  try{fs.rmSync(profile,{recursive:true,force:true});}catch{}
  if(stderr&&/FATAL|ERROR:.*zygote/i.test(stderr))process.stderr.write(stderr);
}
