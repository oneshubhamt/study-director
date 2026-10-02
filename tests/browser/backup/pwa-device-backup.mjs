import assert from 'node:assert/strict';
import {artifactPath,writeArtifact} from '../../helpers/artifacts.mjs';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';

const root=process.cwd();
const chromium=process.env.CHROMIUM_PATH||['/usr/bin/chromium','/tmp/chromium'].find(fs.existsSync)||'/usr/bin/chromium';
if(!fs.existsSync(chromium))throw new Error(`Chromium not found: ${chromium}`);
const manifest=JSON.parse(fs.readFileSync(path.join(root,'dist/build-manifest.json'),'utf8'));
const deployment=path.join(root,'dist/deployment');
const marker='/* PUBLIC PLUGIN API */';
const exposure=`window.__DeviceBackupDebug=Object.freeze({DeviceBackup,BackupController,RepositoryCheckpointPipeline,StartupLifecycle,TimerState,TIMER_MODES,AppData,pwaUpdateBlockReason});\n`;
let main=fs.readFileSync(path.join(deployment,manifest.main),'utf8');
if(!main.includes(marker))throw new Error('Device-backup browser harness hook is unavailable.');
main=main.replace(marker,exposure+marker);
main=main.replace('void PwaLifecycle.install();','/* Service-worker behavior is covered by the dedicated PWA browser gate. */');

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitFor(fn,{timeout=60000,interval=100,label='condition'}={}){
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
  const contentType=name.endsWith('.js')?'application/javascript; charset=utf-8'
    :name.endsWith('.css')?'text/css; charset=utf-8'
      :name.endsWith('.webmanifest')?'application/manifest+json; charset=utf-8'
      :name.endsWith('.woff2')?'font/woff2'
        :name.endsWith('.png')?'image/png'
          :'application/octet-stream';
  res.writeHead(200,{'content-type':contentType,'cache-control':'no-store'});res.end(fs.readFileSync(file));
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const appUrl=`http://127.0.0.1:${server.address().port}/${manifest.main}`;

class CdpPage{
  constructor(ws){
    this.ws=ws;this.nextId=0;this.pending=new Map();this.events=[];
    ws.onmessage=event=>{
      const message=JSON.parse(event.data);
      if(message.id){
        const pending=this.pending.get(message.id);if(!pending)return;
        this.pending.delete(message.id);
        message.error?pending.reject(new Error(JSON.stringify(message.error))):pending.resolve(message.result);return;
      }
      if(message.method==='Runtime.exceptionThrown')this.events.push({kind:'exception',text:message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text||'Runtime exception'});
      if(message.method==='Runtime.consoleAPICalled'&&message.params.type==='error')this.events.push({kind:'console-error',text:message.params.args.map(arg=>arg.value??arg.description??'').join(' ')});
    };
  }
  static async connect(url){const ws=new WebSocket(url);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});return new CdpPage(ws);}
  send(method,params={}){return new Promise((resolve,reject)=>{const id=++this.nextId;this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));});}
  async evaluate(expression){
    const result=await this.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});
    if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Evaluation failed');
    return result.result.value;
  }
  close(){this.ws.close();}
}

const profile=fs.mkdtempSync(path.join(os.tmpdir(),'qa-device-browser-'));
const browser=spawn(chromium,[
  '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check',
  '--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'
],{stdio:['ignore','ignore','pipe']});
let browserError='';browser.stderr.on('data',chunk=>{browserError+=chunk;});
const activePortFile=path.join(profile,'DevToolsActivePort');
await waitFor(()=>fs.existsSync(activePortFile),{timeout:20000,label:'Chromium DevTools port'});
const [browserPort]=fs.readFileSync(activePortFile,'utf8').trim().split(/\r?\n/);
await waitFor(async()=>{try{return (await fetch(`http://127.0.0.1:${browserPort}/json/version`)).ok;}catch{return false;}},{label:'Chromium CDP endpoint'});
const target=await (await fetch(`http://127.0.0.1:${browserPort}/json/new?about:blank`,{method:'PUT'})).json();
const page=await CdpPage.connect(target.webSocketDebuggerUrl);
const prelude=`(()=>{
  window.__devicePickerCalls=()=>Number(sessionStorage.getItem('qa-picker-calls')||0);
  Object.defineProperty(window,'showDirectoryPicker',{configurable:true,value:async()=>{
    sessionStorage.setItem('qa-picker-calls',String(window.__devicePickerCalls()+1));
    return navigator.storage.getDirectory();
  }});
  window.alert=()=>{};window.confirm=()=>true;window.prompt=()=>'';
})();`;
const evidence={status:'PASS',release:manifest.release,checks:{}};

try{
  await page.send('Runtime.enable');await page.send('Page.enable');await page.send('Log.enable');
  await page.send('Emulation.setTimezoneOverride',{timezoneId:'Asia/Kolkata'});
  await page.send('Emulation.setDeviceMetricsOverride',{width:1365,height:900,deviceScaleFactor:1,mobile:false});
  await page.send('Page.addScriptToEvaluateOnNewDocument',{source:prelude});
  await page.send('Page.navigate',{url:appUrl});
  await waitFor(()=>page.evaluate(`!!window.__DeviceBackupDebug&&__DeviceBackupDebug.StartupLifecycle.status().fullyInitialized`),{label:'Study Director startup'});
  await waitFor(()=>page.evaluate(`__DeviceBackupDebug.DeviceBackup.status().installed===true`),{label:'device-backup startup'});

  const startup=await page.evaluate(`(()=>{
    document.querySelector('[data-tab="library"]').click();document.querySelector('.library-data-drawer').open=true;
    return {
      supported:__DeviceBackupDebug.DeviceBackup.status().supported,
      mode:__DeviceBackupDebug.DeviceBackup.status().mode,
      label:document.getElementById('device-backup-status').textContent.trim(),
      fileActions:[...document.querySelectorAll('.backup-file-actions > button')].map(button=>button.textContent.trim()),
      recoverLabel:document.getElementById('recover-device-backup')?.textContent.trim()||'',
      recoverHidden:document.getElementById('recover-device-backup')?.hidden===true,
      advancedOpen:document.querySelector('.backup-advanced-disclosure')?.open===true,
      locationBadges:[...document.querySelectorAll('.backup-location-badge')].map(node=>node.textContent.trim()),
      pickerCalls:__devicePickerCalls()
    };
  })()`);
  assert.equal(startup.supported,true);assert.equal(startup.mode,'off');assert.equal(startup.label,'Off');
  assert.deepEqual(startup.fileActions,['Export backup…','Import backup…']);
  assert.equal(startup.recoverLabel,'Recover…');assert.equal(startup.recoverHidden,true,'Device recovery should appear only after a folder is connected');
  assert.equal(startup.advancedOpen,false);assert.deepEqual(startup.locationBadges,['Primary','Optional']);
  assert.equal(startup.pickerCalls,0,'startup invoked the folder picker');
  evidence.checks.startup={off:true,noPrompt:true,manualBackupPreserved:true};

  await page.evaluate(`document.getElementById('connect-device-backup').click()`);
  await waitFor(()=>page.evaluate(`(()=>{const state=__DeviceBackupDebug.DeviceBackup.status();return state.connected&&!state.busy&&/^cp_[a-f0-9]{32}\.sdcheckpoint$/.test(state.lastFilename||'');})()`),{timeout:90000,label:'initial verified repository checkpoint'});
  const first=await page.evaluate(`(async()=>{
    const root=await navigator.storage.getDirectory(),repo=await root.getDirectoryHandle('Study-Director-Automatic-Backup-Repository');
    const checkpoints=await repo.getDirectoryHandle('checkpoints'),objects=await repo.getDirectoryHandle('objects'),checkpointNames=[],objectNames=[];
    for await(const [name] of checkpoints.entries())checkpointNames.push(name);for await(const [name] of objects.entries())objectNames.push(name);
    checkpointNames.sort();const file=await (await checkpoints.getFileHandle(checkpointNames[0])).getFile();
    const manifest=await __DeviceBackupDebug.RepositoryCheckpointPipeline.inspectManifest(file,{interactive:false});
    return {checkpointNames,objectNames:objectNames.sort(),size:file.size,format:manifest.format,version:manifest.version,pickerCalls:__devicePickerCalls(),status:document.getElementById('device-backup-status').textContent.trim()};
  })()`);
  assert.equal(first.checkpointNames.length,1);assert.match(first.checkpointNames[0],/^cp_[a-f0-9]{32}\.sdcheckpoint$/u);
  assert.ok(first.size>0);assert.equal(first.format,'study-director.backup-repository-checkpoint');assert.equal(first.version,4);assert.ok(first.objectNames.length>0);assert.equal(first.pickerCalls,1);assert.match(first.status,/^On(?:\s|$)/);

  await page.evaluate(`document.getElementById('device-backup-now').click()`);
  await waitFor(()=>page.evaluate(`(()=>{const state=__DeviceBackupDebug.DeviceBackup.status();return !state.busy&&state.checkpointCount===2&&/^cp_[a-f0-9]{32}\.sdcheckpoint$/.test(state.lastFilename||'');})()`),{timeout:90000,label:'second verified repository checkpoint'});
  const rotation=await page.evaluate(`(async()=>{const root=await navigator.storage.getDirectory(),repo=await root.getDirectoryHandle('Study-Director-Automatic-Backup-Repository'),checkpoints=await repo.getDirectoryHandle('checkpoints'),out=[];for await(const [name,handle] of checkpoints.entries()){const file=await handle.getFile();out.push({name,size:file.size});}return out.sort((a,b)=>a.name.localeCompare(b.name));})()`);
  assert.equal(rotation.length,2);assert.ok(rotation.every(row=>/^cp_[a-f0-9]{32}\.sdcheckpoint$/u.test(row.name)&&row.size>0));
  evidence.checks.rotation={immutableCheckpointNames:true,repositoryManifestReadback:true,twoManifests:true,retentionTarget:15};

  const scheduleApplied=await page.evaluate(`(async()=>{
    const now=new Date(),minute=now.getHours()*60+now.getMinutes()-1;
    const hh=String(Math.floor((minute+1440)%1440/60)).padStart(2,'0'),mm=String((minute+1440)%1440%60).padStart(2,'0');
    document.querySelector('[data-tab="plan"]').click();
    const input=document.getElementById('plan-input');
    input.value=hh+':'+mm+' | 30 | Device backup completion QA | work | Reliability | pages | 5';
    input.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,500));
    const apply=document.querySelector('[data-action="apply-schedule"]'),enabled=!apply.disabled;apply.click();return enabled;
  })()`);
  assert.equal(scheduleApplied,true);
  await waitFor(()=>page.evaluate(`__DeviceBackupDebug.TimerState.mode===__DeviceBackupDebug.TIMER_MODES.RUNNING`),{label:'running completion test timer'});
  await page.evaluate(`document.querySelector('[data-action="mark-done"]').click()`);
  await waitFor(()=>page.evaluate(`(()=>{const state=__DeviceBackupDebug.DeviceBackup.status();return !state.busy&&state.checkpointCount>=3&&/^cp_[a-f0-9]{32}\.sdcheckpoint$/.test(state.lastFilename||'');})()`),{timeout:90000,label:'task-completion early repository backup'});
  evidence.checks.importantEvent={taskCompletionEarlyBackup:true};

  await page.send('Page.reload',{ignoreCache:true});
  await waitFor(()=>page.evaluate(`!!window.__DeviceBackupDebug&&__DeviceBackupDebug.StartupLifecycle.status().fullyInitialized`),{label:'reload startup'});
  await waitFor(()=>page.evaluate(`__DeviceBackupDebug.DeviceBackup.status().connected===true`),{label:'stored handle restoration'});
  const restored=await page.evaluate(`({pickerCalls:__devicePickerCalls(),state:__DeviceBackupDebug.DeviceBackup.status(),label:document.getElementById('device-backup-status').textContent.trim()})`);
  assert.equal(restored.pickerCalls,1,'reload prompted for a folder again');
  assert.equal(restored.state.permission,'granted');assert.match(restored.label,/^On(?:\s|$)/);
  evidence.checks.restart={handleRestored:true,noPrompt:true,lastBackupRetained:true};

  await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await sleep(250);
  const mobile=await page.evaluate(`(()=>{
    document.querySelector('[data-tab="library"]').click();document.querySelector('.library-data-drawer').open=true;
    const row=document.getElementById('device-backup-status').closest('.backup-compact-row').getBoundingClientRect();
    return {overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,row:{left:row.left,right:row.right,width:row.width},viewport:innerWidth,buttons:[...document.querySelectorAll('#device-backup-actions button:not([hidden])')].map(button=>({text:button.textContent.trim(),height:button.getBoundingClientRect().height}))};
  })()`);
  assert.ok(mobile.overflow<=1,`390px device-backup surface overflowed by ${mobile.overflow}px`);
  assert.ok(mobile.row.left>=-1&&mobile.row.right<=mobile.viewport+1,'device-backup row escaped the phone viewport');
  assert.ok(mobile.buttons.every(button=>button.height>=44),'device-backup phone actions are below the touch target');
  evidence.checks.mobile={contained:true,touchTargets:true};

  await page.evaluate(`document.getElementById('disconnect-device-backup').click()`);
  await waitFor(()=>page.evaluate(`(()=>{const state=__DeviceBackupDebug.DeviceBackup.status();return !state.busy&&state.mode==='off'&&!state.connected;})()`),{label:'device backup turn off'});
  const off=await page.evaluate(`({label:document.getElementById('device-backup-status').textContent.trim(),connect:!document.getElementById('connect-device-backup').hidden,backupNow:document.getElementById('device-backup-now').hidden})`);
  assert.deepEqual(off,{label:'Off',connect:true,backupNow:true});
  evidence.checks.turnOff={off:true,connectAvailable:true};

  assert.deepEqual(page.events,[],`Unexpected runtime errors: ${page.events.map(event=>event.text).join(' | ')}`);
  writeArtifact('pwa-device-backup-results.json',JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify(evidence,null,2));
}catch(error){
  let diagnostic=null;
  try{diagnostic=await page.evaluate(`({href:location.href,title:document.title,body:(document.body?.innerText||'').slice(0,1000),device:window.__DeviceBackupDebug?.DeviceBackup.status()||null,pickerCalls:window.__devicePickerCalls?.()||null})`);}catch(diagnosticError){diagnostic={error:String(diagnosticError)};}
  throw new Error(`${error.stack||error}\nPage diagnostic: ${JSON.stringify(diagnostic)}\nChromium stderr:\n${browserError.slice(-6000)}`);
}finally{
  try{page.close();}catch{}
  browser.kill('SIGTERM');await Promise.race([new Promise(resolve=>browser.once('exit',resolve)),sleep(3000)]);
  server.close();fs.rmSync(profile,{recursive:true,force:true});
}
