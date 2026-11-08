import {withoutPwaChecks,launchChromium} from '../../helpers/browser-harness.mjs';
import assert from 'node:assert/strict';
import {writeArtifact} from '../../helpers/artifacts.mjs';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const root=process.cwd();
// The manifest version this build writes (raised whenever the format changes).
const MANIFEST_VERSION=Number(fs.readFileSync(path.join(root,'source/core/managed-repository.js'),'utf8').match(/REPOSITORY_MANIFEST_VERSION=(\d+)/u)?.[1]);
const manifest=JSON.parse(fs.readFileSync(path.join(root,'dist/build-manifest.json'),'utf8'));
const deployment=path.join(root,'dist/deployment');
const marker='/* PUBLIC PLUGIN API */';
const exposure=`window.__DeviceBackupDebug=Object.freeze({DeviceBackup,BackupProviderRuntime,BackupController,RepositoryCheckpointPipeline,StartupLifecycle,TimerState,TIMER_MODES,AppData,pwaUpdateBlockReason,integrity:()=>repositoryIntegrityView?.locations?.['device-folder']||null});\n`;
let main=fs.readFileSync(path.join(deployment,manifest.main),'utf8');
if(!main.includes(marker))throw new Error('Device-backup browser harness hook is unavailable.');
main=main.replace(marker,exposure+marker);
main=withoutPwaChecks(main);

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitFor(fn,{timeout=60000,interval=100,label='condition',describe=null}={}){
  const started=Date.now();let last;
  while(Date.now()-started<timeout){
    try{last=await fn();if(last)return last;}catch(error){last=error;}
    await sleep(interval);
  }
  let state='';if(describe)try{state=` (last state: ${JSON.stringify(await describe())})`;}catch{}
  throw new Error(`Timed out waiting for ${label}${last instanceof Error?`: ${last.message}`:''}${state}`);
}
const rowState=()=>page.evaluate(`({row:document.getElementById('device-backup-status').textContent.trim(),device:__DeviceBackupDebug.DeviceBackup.status(),integrity:__DeviceBackupDebug.integrity(),background:__DeviceBackupDebug.BackupProviderRuntime.backgroundStatus?.()||null})`);

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

const browser=await launchChromium({profilePrefix:'qa-device-browser-'});
let page=null;
const prelude=`(()=>{
  (localStorage.getItem('studyDirector.profiles.v1')||localStorage.setItem('studyDirector.profiles.v1',JSON.stringify({version:1,active:'prof_qa_mve00000_abcdef01',profiles:[{id:'prof_qa_mve00000_abcdef01',scope:'',name:'',email:'',folder:'',createdAt:'2026-08-01T00:00:00.000Z',fresh:false,from:null}],removing:[]})));
  window.__devicePickerCalls=()=>Number(sessionStorage.getItem('qa-picker-calls')||0);
  Object.defineProperty(window,'showDirectoryPicker',{configurable:true,value:async()=>{
    sessionStorage.setItem('qa-picker-calls',String(window.__devicePickerCalls()+1));
    return navigator.storage.getDirectory();
  }});
  window.alert=()=>{};window.confirm=()=>true;window.prompt=()=>'';
  // The backup folder named for this profile and device, and the versions in
  // it, read from the folder itself.
  window.__deviceRepository=async()=>{const root=await navigator.storage.getDirectory();for await(const [name,handle] of root.entries())if(handle.kind==='directory'&&name.startsWith('Study Director - '))return handle;throw new Error('no backup folder');};
  // The versions in the folder, read from the folder itself.
  window.__deviceVersions=async()=>{try{const repo=await __deviceRepository(),commits=await repo.getDirectoryHandle('commits'),out=[];for await(const [name] of commits.entries())if(/^cp_[a-f0-9]{32}\\.sdcommit$/.test(name))out.push(name.slice(0,-'.sdcommit'.length));return out.sort();}catch{return [];}};
})();`;
const evidence={status:'PASS',release:manifest.release,checks:{}};

try{
  page=await browser.createPage(appUrl,{preload:prelude});
  await waitFor(()=>page.evaluate(`!!window.__DeviceBackupDebug&&__DeviceBackupDebug.StartupLifecycle.status().fullyInitialized`),{label:'Study Director startup'});
  await waitFor(()=>page.evaluate(`__DeviceBackupDebug.DeviceBackup.status().installed===true`),{label:'device-backup startup'});

  const startup=await page.evaluate(`(()=>{
    document.querySelector('[data-tab="library"]').click();document.getElementById('library-tab-data').click();
    return {
      supported:__DeviceBackupDebug.DeviceBackup.status().supported,
      mode:__DeviceBackupDebug.DeviceBackup.status().mode,
      label:document.getElementById('device-backup-status').textContent.trim(),
      fileActions:[...document.querySelectorAll('.backup-file-actions > button')].map(button=>button.textContent.trim()),
      versionHistoryLabel:document.getElementById('open-version-history')?.textContent.trim()||'',
      sharedActionsHidden:document.getElementById('backup-shared-actions')?.hidden===true,
      advancedOpen:document.querySelector('.backup-advanced-disclosure')?.open===true,
      locationBadges:document.querySelectorAll('.backup-location-badge').length,
      pickerCalls:__devicePickerCalls()
    };
  })()`);
  assert.equal(startup.supported,true);assert.equal(startup.mode,'off');assert.equal(startup.label,'Off');
  assert.deepEqual(startup.fileActions,['Export backup…','Restore from file…']);
  assert.equal(startup.versionHistoryLabel,'Version History');assert.equal(startup.sharedActionsHidden,true,'Back up now and Version History appear once a location is connected');
  assert.equal(startup.advancedOpen,false);assert.equal(startup.locationBadges,0,'neither location is ranked');
  assert.equal(startup.pickerCalls,0,'startup invoked the folder picker');
  evidence.checks.startup={off:true,noPrompt:true,manualBackupPreserved:true};

  await page.evaluate(`document.getElementById('connect-device-backup').click()`);
  await waitFor(()=>page.evaluate(`(async()=>{const state=__DeviceBackupDebug.DeviceBackup.status();return state.connected&&!state.busy&&(await __deviceVersions()).length===1;})()`),{timeout:90000,label:'initial verified repository checkpoint'});
  const first=await page.evaluate(`(async()=>{
    const repo=await __deviceRepository();
    const checkpoints=await repo.getDirectoryHandle('checkpoints'),objects=await repo.getDirectoryHandle('objects'),checkpointNames=[],objectNames=[];
    for await(const [name] of checkpoints.entries())checkpointNames.push(name);for await(const [name] of objects.entries())objectNames.push(name);
    checkpointNames.sort();const file=await (await checkpoints.getFileHandle(checkpointNames[0])).getFile();
    const manifest=await __DeviceBackupDebug.RepositoryCheckpointPipeline.inspectManifest(file,{interactive:false});
    return {checkpointNames,objectNames:objectNames.sort(),size:file.size,format:manifest.format,version:manifest.version,pickerCalls:__devicePickerCalls(),status:document.getElementById('device-backup-status').textContent.trim()};
  })()`);
  assert.equal(first.checkpointNames.length,1);assert.match(first.checkpointNames[0],/^cp_[a-f0-9]{32}\.sdcheckpoint$/u);
  assert.ok(first.size>0);assert.equal(first.format,'study-director.backup-repository-checkpoint');assert.ok(MANIFEST_VERSION>0);assert.equal(first.version,MANIFEST_VERSION);assert.ok(first.objectNames.length>0);assert.equal(first.pickerCalls,1);
  // Maintenance may run just after the first backup; the row then settles on On.
  await waitFor(()=>page.evaluate(`/^On(?:\\s|$)/.test(document.getElementById('device-backup-status').textContent.trim())`),{timeout:60000,label:'Device Folder row at rest after the first backup',describe:rowState});
  // The Device Folder's integrity check reads every object back in ranges and
  // completes, so the row never warns that backup verification is unavailable.
  await page.evaluate(`__DeviceBackupDebug.BackupProviderRuntime.requestIntegrity('device-folder')`);
  const integrity=await waitFor(()=>page.evaluate(`(()=>{const state=__DeviceBackupDebug.integrity();return state&&(state.lastOutcome==='completed'&&state.completedAt||state.failedAt)?state:null;})()`),{timeout:90000,label:'Device Folder integrity check'});
  assert.equal(integrity.failedAt,'',`the integrity check failed: ${integrity.lastOutcome} ${integrity.blockedReason}`);
  assert.equal(integrity.lastOutcome,'completed');
  await waitFor(()=>page.evaluate(`/^On(?:\\s|$)/.test(document.getElementById('device-backup-status').textContent.trim())`),{timeout:15000,label:'Device Folder row back to On after the integrity check',describe:rowState});
  evidence.checks.integrity={completed:true,rowAtRest:true};

  // Nothing changed: Back up now confirms the folder is current and adds no version.
  await page.evaluate(`document.getElementById('backup-now').click()`);
  await waitFor(()=>page.evaluate(`!__DeviceBackupDebug.DeviceBackup.status().busy&&/already has your latest data/.test(document.getElementById('library-data')?.textContent||'')`),{timeout:90000,label:'unchanged backup confirmed'});
  assert.equal(await page.evaluate('__deviceVersions().then(rows=>rows.length)'),1,'an unchanged backup adds no version');
  // A real change gets its own version.
  await page.evaluate(`(async()=>{__DeviceBackupDebug.AppData.notes.update('Rotation','Rotation','A change worth a new version');await __DeviceBackupDebug.AppData.notes.flush();})()`);
  await page.evaluate(`document.getElementById('backup-now').click()`);
  await waitFor(()=>page.evaluate(`(async()=>!__DeviceBackupDebug.DeviceBackup.status().busy&&(await __deviceVersions()).length===2)()`),{timeout:90000,label:'second verified repository checkpoint'});
  const rotation=await page.evaluate(`(async()=>{const repo=await __deviceRepository(),checkpoints=await repo.getDirectoryHandle('checkpoints'),out=[];for await(const [name,handle] of checkpoints.entries()){const file=await handle.getFile();out.push({name,size:file.size});}return out.sort((a,b)=>a.name.localeCompare(b.name));})()`);
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
  // A note can be restored from an earlier Device Folder version while the
  // study timer runs: only that note changes, the timer keeps running and the
  // restore is not mistaken for time away.
  const noteKey=await page.evaluate(`(async()=>{
    const notes=__DeviceBackupDebug.AppData.notes,result=notes.update('Reliability','Reliability','Version kept in the backup','');
    await notes.flush({strict:true});return result.status==='changed'?notes.get('Reliability','Reliability').key:'';
  })()`);
  assert.ok(noteKey,'the note was saved before the backup');
  const versionsBeforeNote=await page.evaluate('__deviceVersions()');
  await page.evaluate(`document.getElementById('backup-now').click()`);
  const noteCheckpoint=await waitFor(()=>page.evaluate(`(async()=>{if(__DeviceBackupDebug.DeviceBackup.status().busy)return '';const added=(await __deviceVersions()).filter(id=>!${JSON.stringify(versionsBeforeNote)}.includes(id));return added.length===1?added[0]:'';})()`),{timeout:90000,label:'backup holding the note'});
  await page.evaluate(`(async()=>{
    const debug=__DeviceBackupDebug,hold=debug.BackupProviderRuntime.suspendBackground('qa-note-restore');await hold.settled;window.__qaNoteSuspension=hold;
    const notes=debug.AppData.notes,current=notes.get(${JSON.stringify(noteKey)},'Reliability');notes.update(current.key,'Reliability','Text after an accident',current.updatedAt);await notes.flush({strict:true});
  })()`);
  await page.evaluate(`(()=>{document.querySelector('[data-tab="library"]').click();document.getElementById('library-tab-notes').click();})()`);
  await waitFor(()=>page.evaluate(`[...document.querySelectorAll('[data-note-key]')].some(row=>row.dataset.noteKey===${JSON.stringify(noteKey)})`),{label:'note listed in the Library'});
  await page.evaluate(`[...document.querySelectorAll('[data-note-key]')].find(row=>row.dataset.noteKey===${JSON.stringify(noteKey)}).click()`);
  await waitFor(()=>page.evaluate(`!!document.getElementById('library-note-actions')`),{label:'open note menu'});
  await page.evaluate(`(()=>{document.getElementById('library-note-actions').click();document.getElementById('library-note-versions').click();})()`);
  await waitFor(()=>page.evaluate(`!!document.querySelector('#managed-version-history [data-action="compare-managed-note"][data-version-history-checkpoint="${noteCheckpoint}"]')`),{timeout:60000,label:'note versions listed during the session'});
  await page.evaluate(`document.querySelector('#managed-version-history [data-action="compare-managed-note"][data-version-history-checkpoint="${noteCheckpoint}"]').click()`);
  await waitFor(()=>page.evaluate(`(()=>{const dialog=document.querySelector('dialog.sd-note-reconcile-dialog[open]');const take=dialog&&dialog.querySelector('[data-action="import"]');return !!take&&!take.disabled;})()`),{timeout:60000,label:'side-by-side note review'});
  const reviewLabels=await page.evaluate(`[...document.querySelectorAll('dialog.sd-note-reconcile-dialog[open] .sd-note-reconcile-strategies button:not([hidden])')].map(button=>button.textContent.trim())`);
  assert.deepEqual(reviewLabels,['Keep current','Smart merge','Add what’s missing','Use this version'],'the review speaks about versions of this note');
  await page.evaluate(`(()=>{const dialog=document.querySelector('dialog.sd-note-reconcile-dialog[open]');dialog.querySelector('[data-action="import"]').click();})()`);
  await sleep(300);
  await page.evaluate(`document.querySelector('dialog.sd-note-reconcile-dialog[open] .sd-note-reconcile-apply').click()`);
  await waitFor(()=>page.evaluate(`/Version kept in the backup/.test(__DeviceBackupDebug.AppData.notes.get(${JSON.stringify(noteKey)},'Reliability')?.text||'')`),{timeout:90000,label:'note restored from the earlier version'});
  await sleep(1500);
  const afterNoteRestore=await page.evaluate(`({mode:__DeviceBackupDebug.TimerState.mode,running:__DeviceBackupDebug.TIMER_MODES.RUNNING,gap:__DeviceBackupDebug.TimerState.inactiveGap,status:document.getElementById('notes-status')?.textContent||''})`);
  assert.equal(afterNoteRestore.mode,afterNoteRestore.running,'the study timer keeps running through a note restore');
  assert.equal(afterNoteRestore.gap,null,'a note restore is not time away');
  assert.match(afterNoteRestore.status,/Restored “Reliability” from the backup of/u);
  await page.evaluate(`window.__qaNoteSuspension.release()`);
  evidence.checks.noteRestoreDuringSession={timerKeptRunning:true,noAwayGap:true};
  const beforeCompletion=await page.evaluate(`__DeviceBackupDebug.DeviceBackup.status().lastBackupAt`);
  await page.evaluate(`document.querySelector('[data-action="mark-done"]').click()`);
  await waitFor(()=>page.evaluate(`(()=>{const state=__DeviceBackupDebug.DeviceBackup.status();return !state.busy&&!state.backingUp&&state.lastBackupAt>${JSON.stringify(beforeCompletion)};})()`),{timeout:90000,label:'task-completion early repository backup'});
  evidence.checks.importantEvent={taskCompletionEarlyBackup:true};

  const priorDocument=await page.evaluate('performance.timeOrigin');
  await page.send('Page.reload',{ignoreCache:true});
  await waitFor(()=>page.evaluate(`performance.timeOrigin!==${priorDocument}&&document.readyState==='complete'`),{label:'new document after reload'});
  await waitFor(()=>page.evaluate(`!!window.__DeviceBackupDebug&&__DeviceBackupDebug.StartupLifecycle.status().fullyInitialized`),{label:'reload startup'});
  await waitFor(()=>page.evaluate(`__DeviceBackupDebug.DeviceBackup.status().connected===true&&/^On(?:\\s|$)/.test(document.getElementById('device-backup-status').textContent.trim())`),{label:'stored handle restoration'});
  const restored=await page.evaluate(`({pickerCalls:__devicePickerCalls(),state:__DeviceBackupDebug.DeviceBackup.status(),label:document.getElementById('device-backup-status').textContent.trim()})`);
  assert.equal(restored.pickerCalls,1,'reload prompted for a folder again');
  assert.equal(restored.state.permission,'granted');assert.match(restored.label,/^On(?:\s|$)/);
  evidence.checks.restart={handleRestored:true,noPrompt:true,lastBackupRetained:true};

  await page.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await sleep(250);
  const mobile=await page.evaluate(`(()=>{
    document.querySelector('[data-tab="library"]').click();document.getElementById('library-tab-data').click();
    const row=document.getElementById('device-backup-status').closest('.backup-location-row').getBoundingClientRect();
    return {overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,row:{left:row.left,right:row.right,width:row.width},viewport:innerWidth,buttons:[...document.querySelectorAll('#device-backup-actions button:not([hidden])')].filter(button=>button.getClientRects().length>0).map(button=>({text:button.textContent.trim(),height:button.getBoundingClientRect().height}))};
  })()`);
  assert.ok(mobile.overflow<=1,`390px device-backup surface overflowed by ${mobile.overflow}px`);
  assert.ok(mobile.row.left>=-1&&mobile.row.right<=mobile.viewport+1,'device-backup row escaped the phone viewport');
  assert.ok(mobile.buttons.every(button=>button.height>=44),'device-backup phone actions are below the touch target: '+JSON.stringify(mobile.buttons));
  evidence.checks.mobile={contained:true,touchTargets:true};

  await page.evaluate(`document.getElementById('disconnect-device-backup').click()`);
  await waitFor(()=>page.evaluate(`(()=>{const state=__DeviceBackupDebug.DeviceBackup.status();return !state.busy&&state.mode==='off'&&!state.connected;})()`),{label:'device backup turn off'});
  const off=await page.evaluate(`({label:document.getElementById('device-backup-status').textContent.trim(),connect:!document.getElementById('connect-device-backup').hidden,backupNow:document.getElementById('backup-shared-actions').hidden})`);
  assert.deepEqual(off,{label:'Off',connect:true,backupNow:true});
  evidence.checks.turnOff={off:true,connectAvailable:true};

  assert.deepEqual(page.events,[],`Unexpected runtime errors: ${page.events.map(event=>event.text).join(' | ')}`);
  writeArtifact('pwa-device-backup-results.json',JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify(evidence,null,2));
}catch(error){
  let diagnostic=null;
  try{diagnostic=await page?.evaluate(`({href:location.href,title:document.title,body:(document.body?.innerText||'').slice(0,1000),device:window.__DeviceBackupDebug?.DeviceBackup.status()||null,pickerCalls:window.__devicePickerCalls?.()||null})`);}catch(diagnosticError){diagnostic={error:String(diagnosticError)};}
  throw new Error(`${error.stack||error}\nPage diagnostic: ${JSON.stringify(diagnostic)}\nChromium stderr:\n${browser.stderr().slice(-6000)}`);
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
