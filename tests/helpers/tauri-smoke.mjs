// Disposable GitHub-hosted runner only. CDP is enabled only for this child.
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {CdpPage,waitFor,waitForStudyDirector} from './browser-harness.mjs';

assert.equal(process.platform,'win32');
assert.equal(process.env.GITHUB_ACTIONS,'true');
assert.equal(process.env.RUNNER_ENVIRONMENT,'github-hosted');
assert.equal(process.env.GITHUB_REF,'refs/heads/tauri-spike');
const executable=path.resolve('src-tauri/target/release/study-director-tauri-spike.exe');
const sentinel='tauri-qa-'+randomUUID(),dbName='study-director-qa-'+sentinel,filename=sentinel+'.txt';
const origin='https://tauri.localhost';
let app=null,page=null,debugPort=null,policyInstalled=false;
const policy='HKLM\\SOFTWARE\\Policies\\Microsoft\\Edge\\WebView2\\AdditionalBrowserArguments';
const executableName=path.basename(executable);
function removePolicy(){
  if(!policyInstalled)return;
  execFileSync('reg.exe',['delete',policy,'/v',executableName,'/f','/reg:64'],{stdio:'inherit',timeout:15000});
  policyInstalled=false;
}
const deadline=setTimeout(()=>{
  console.error('Native smoke exceeded its overall deadline');
  if(app?.exitCode===null)app.kill();
  try{removePolicy();}finally{process.exit(1);}
},420000);
async function port(){
  const server=createServer();
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const value=server.address().port;
  await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  return value;
}
// WebView2 150+ ignores user/environment overrides for elevated hosts.
// Use the documented machine-policy override only for this named exe on
// the ephemeral runner. Never modify product settings or use a wildcard.
function installPolicy(){
  let present=false;
  try{execFileSync('reg.exe',['query',policy,'/v',executableName,'/reg:64'],{stdio:'ignore',timeout:15000});present=true;}catch(error){if(error.status!==1)throw error;}
  assert.equal(present,false,'refusing to replace an existing WebView2 policy');
  execFileSync('reg.exe',['add',policy,'/v',executableName,'/t','REG_SZ','/d','--remote-debugging-address=127.0.0.1 --remote-debugging-port='+debugPort,'/f','/reg:64'],{stdio:'inherit',timeout:15000});
  policyInstalled=true;
}
async function start(){
  app=spawn(executable,[],{stdio:'inherit',windowsHide:false});
  let launchError;app.once('error',error=>{launchError=error;});
  let target;
  try{target=await waitFor(async()=>{
    if(launchError)throw launchError;
    if(app.exitCode!==null)throw new Error('Tauri exited with '+app.exitCode);
    const response=await fetch('http://127.0.0.1:'+debugPort+'/json/list',{signal:AbortSignal.timeout(1500)});
    if(!response.ok)return false;
    return (await response.json()).find(row=>row.type==='page'&&row.url.startsWith(origin+'/')&&row.webSocketDebuggerUrl);
  },{timeout:60000,label:'packaged WebView2 debug target'});}
  catch(error){
    // This is diagnostic evidence only; never count a missing target as a pass.
    const diagnostic=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','Get-Process study-director-tauri-spike,msedgewebview2 -ErrorAction SilentlyContinue | Select-Object Id,ProcessName,MainWindowTitle,SessionId | Format-Table -AutoSize | Out-String'],{encoding:'utf8',timeout:15000});
    console.error('WebView2 launch diagnostic:',diagnostic);
    throw error;
  }
  page=await CdpPage.connect(target.webSocketDebuggerUrl,target.id);
  await page.send('Runtime.enable');await page.send('Page.enable');await page.send('Log.enable');
  await waitForStudyDirector(page,{timeout:60000});
  assert.equal(await page.evaluate('location.origin'),origin);
  assert.equal(await page.evaluate('isSecureContext'),true);
  assert.equal(await page.evaluate('document.querySelector(\'meta[name="study-director-source-commit"]\').content'),process.env.SD_TAURI_EXPECTED_SHA||process.env.GITHUB_SHA);
  assert.equal(await page.evaluate('PlatformRuntime.kind'),'tauri');
  assert.equal(await page.evaluate('!!window[Symbol.for("studyDirector.installCapture.v1")]'),false);
  assert.equal(await page.evaluate('navigator.serviceWorker ? navigator.serviceWorker.getRegistrations().then(rows=>rows.length) : 0'),0);
  assert.equal(await page.evaluate('!!window.__TAURI__'),false);
  console.log('Packaged WebView2 startup verified');
  await exposeApplication();
}
async function stop(force){
  const child=app;
  if(page){page.socket.close();page=null;}
  assert.equal(child.exitCode,null,'application already exited');
  const exited=once(child,'exit');
  if(force)assert.equal(child.kill(),true);
  else{
    const command='$p=Get-Process -Id '+child.pid+' -ErrorAction Stop; if (-not $p.CloseMainWindow()) { exit 1 }';
    execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{stdio:'inherit',timeout:15000});
  }
  const timer=AbortSignal.timeout(20000);
  await Promise.race([exited,new Promise((_,reject)=>timer.addEventListener('abort',()=>reject(new Error('Application failed to exit')),{once:true}))]);
  if(!force)assert.equal(child.exitCode,0,'normal close exit code');
  app=null;
  await waitFor(async()=>{try{await fetch('http://127.0.0.1:'+debugPort+'/json/list',{signal:AbortSignal.timeout(1500)});return false;}catch{return true;}},{timeout:20000,label:'WebView2 debug endpoint shutdown'});
}
async function storage(write){
  return page.evaluate('('+async function({write,dbName,filename,sentinel}){
    const idb=await new Promise((resolve,reject)=>{
      const request=indexedDB.open(dbName,1);
      request.onupgradeneeded=()=>{if(!write){request.transaction.abort();return;}request.result.createObjectStore('fixture');};
      request.onerror=()=>reject(request.error);
      request.onsuccess=()=>resolve(request.result);
    });
    try{
      if(write)await new Promise((resolve,reject)=>{
        const transaction=idb.transaction('fixture','readwrite',{durability:'strict'});
        transaction.oncomplete=resolve;transaction.onabort=transaction.onerror=()=>reject(transaction.error);
        transaction.objectStore('fixture').put(sentinel,'record');
      });
      const stored=await new Promise((resolve,reject)=>{
        const request=idb.transaction('fixture').objectStore('fixture').get('record');
        request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
      });
      const directory=await navigator.storage.getDirectory();
      if(!write&&!(await indexedDB.databases()).some(row=>row.name===dbName&&row.version===1))throw new Error('Fixture database missing after restart');
      const handle=await directory.getFileHandle(filename,{create:write});
      if(write){const stream=await handle.createWritable();await stream.write(sentinel);await stream.close();}
      return {record:stored,file:await (await handle.getFile()).text(),profile:localStorage.getItem('studyDirector.profiles.v1')};
    }finally{idb.close();}
  }.toString()+')('+JSON.stringify({write,dbName,filename,sentinel})+')');
}
function verify(row){assert.equal(row.record,sentinel);assert.equal(row.file,sentinel);assert.ok(row.profile,'profile registry persisted');}
async function profile(name='Tauri QA'){
  await waitFor(()=>page.evaluate('document.getElementById("first-start-dialog")?.open'),{label:'first-start dialog'});
  await page.evaluate('document.getElementById("first-start-name").value='+JSON.stringify(name)+';document.getElementById("first-start-continue").click();');
  await waitFor(()=>page.evaluate('(()=>{const d=document.getElementById("first-start-dialog");const list=JSON.parse(localStorage.getItem("studyDirector.profiles.v1")||"null");return !d.open&&list?.profiles?.some(row=>row.id===list.active&&row.name==='+JSON.stringify(name)+'&&!row.fresh);})()'),{label:'disposable profile committed'});
}

// CDP exposes the same real closure as the existing browser harness, without
// rebuilding/instrumenting packaged assets or adding product IPC.
async function exposeApplication(){
  await page.send('Debugger.enable');
  const remote=await page.evaluate('StudyDirector.ui.goTab',{returnByValue:false});
  assert.ok(remote.objectId);
  const {breakpointId}=await page.send('Debugger.setBreakpointOnFunctionCall',{objectId:remote.objectId});
  const binding='window.__nativeQA=Object.freeze({AppOwnership,AppData,PlanDraftEditor,PlanData,PlanRuntime,TimerEngine,TimerState,ReviewEditor,DailyReflectionPersistence,LibraryView,Profiles,AttachmentStorage,AttachmentLibrary,Exports,BackupController,RichTextRuntime,applySchedule,goTab,setStudyQuality})';
  let off;
  const paused=new Promise((resolve,reject)=>{
    off=page.on('Debugger.paused',async event=>{
      try{
        const evaluation=await page.send('Debugger.evaluateOnCallFrame',{callFrameId:event.callFrames[0].callFrameId,expression:binding,returnByValue:true});
        if(evaluation.exceptionDetails)throw new Error(JSON.stringify(evaluation.exceptionDetails));
        await page.send('Debugger.removeBreakpoint',{breakpointId});
        await page.send('Debugger.resume');
        resolve(true);
      }catch(error){await page.send('Debugger.resume').catch(()=>{});reject(error);}
    });
  });
  const trigger=page.evaluate('StudyDirector.ui.goTab("plan")');
  try{
    await Promise.race([paused,new Promise((_,reject)=>setTimeout(()=>reject(new Error('App closure breakpoint not reached')),15000))]);
    await trigger;
  }finally{off?.();await page.send('Debugger.disable');}
  assert.equal(await page.evaluate('!!window.__nativeQA'),true);
  await waitFor(()=>page.evaluate('__nativeQA.AppOwnership.canMutate()'),{label:'primary application ownership'});
}
const noteKey='tauri qa note',noteText='Native durable note '+sentinel,reflection='Native durable review '+sentinel;
const pdfText='%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n'+sentinel;
const diaryDate=new Date(Date.now()-2*864e5).toISOString().slice(0,10),diaryText='Native durable diary '+sentinel,planName='Native reusable plan';
async function appWrite(){
  const created=await page.evaluate('('+async function({noteKey,noteText,reflection,pdfText,diaryDate,diaryText,planName}){
    const d=__nativeQA;
    const now=new Date(),minutes=now.getHours()*60+now.getMinutes();
    const base=Math.max(240,Math.min(23*60+30,minutes-1));
    const fmt=v=>String(Math.floor(v/60)).padStart(2,'0')+':'+String(v%60).padStart(2,'0');
    document.getElementById('plan-input').value=fmt(base)+' | 20 | Native QA study | work | Tauri QA Note | pages | 12';
    await d.PlanDraftEditor.save();
    document.getElementById('saved-plan-name').value=planName;
    await d.PlanRuntime.savedPlans.act('save');
    const applied=await d.applySchedule({skipNotify:true});
    const diary=await d.DailyReflectionPersistence.commit(diaryDate,diaryText,{expectedCanonical:''});
    const savedPlan=d.PlanData.library().savedPlans.find(row=>row.name===planName);
    d.AppData.notes.update(noteKey,'Tauri QA Note',noteText);
    await d.AppData.notes.flush();
    await d.goTab('execute');
    d.TimerEngine.startCur(2);
    await new Promise(r=>setTimeout(r,120));
    const running=d.TimerState.snapshot().mode;
    d.TimerEngine.togglePause();
    const paused=d.TimerState.snapshot().paused;
    d.TimerEngine.stopExecution();
    await d.goTab('review');
    const field=document.getElementById('daily-reflection');
    field.value=reflection;d.setStudyQuality(4,{save:false});
    const saved=d.ReviewEditor.saveReview({strict:true});
    await d.ReviewEditor.flushPending();await d.ReviewEditor.settled();
    const active=(await d.AppData.activeSession.load()).value;
    const modes=[];
    await d.Exports.job(()=>d.AttachmentLibrary.upload([new File([pdfText],'Native QA.pdf',{type:'application/pdf'})],{onProgress:progress=>{if(progress.mode)modes.push(progress.mode);}}));
    const rows=await d.AttachmentStorage.list(),asset=rows.find(row=>row.name==='Native QA.pdf');
    const file=asset&&await d.AttachmentStorage.get(asset.id);
    const backup=await d.BackupController.createCheckpoint();
    const candidate=await d.BackupController.inspect(backup.blob,{filename:backup.filename});
    try{return {applied,running,paused,saved:!!saved,review:active?.snapshot?.review?.reflection,note:d.AppData.notes.get(noteKey)?.text,assetId:asset?.id,assetHash:asset?.hash,assetText:file&&await file.text(),diary:diary.record?.reflection,diaryKind:diary.recordKind,savedPlan:!!savedPlan,modes,backupBytes:backup.blob.size,preview:!!candidate.preview};}
    finally{await candidate.release();await backup.release();}
  }.toString()+')('+JSON.stringify({noteKey,noteText,reflection,pdfText,diaryDate,diaryText,planName})+')');
  console.log('Application write witness:',JSON.stringify(created));
  assert.equal(created.applied,true);assert.equal(created.running,'running');assert.equal(created.paused,true);assert.equal(created.saved,true);
  assert.equal(created.review,reflection);assert.equal(created.note,noteText);assert.equal(created.assetText,pdfText);
  assert.ok(created.assetId&&created.backupBytes>0&&created.preview);
  assert.equal(created.diary,diaryText);assert.equal(created.diaryKind,'diary');assert.equal(created.savedPlan,true);
  assert.equal(created.assetHash,createHash('sha256').update(pdfText).digest('hex'));
  assert.ok(created.modes.includes('sync'),'attachment worker must witness synchronous OPFS access');
  return created.assetId;
}
async function appRead(assetId,canonical){
  const row=await page.evaluate('('+async function({assetId,noteKey,diaryDate,planName}){
    const d=__nativeQA,active=(await d.AppData.activeSession.load()).value;
    const file=await d.AttachmentStorage.get(assetId);
    return {note:d.AppData.notes.get(noteKey)?.text,review:active?.snapshot?.review?.reflection,plan:active?.scheduleText,paused:active?.snapshot?.timerRuntime?.paused,diary:(await d.AppData.dailyRecords.get(diaryDate))?.reflection,savedPlan:d.PlanData.library().savedPlans.some(row=>row.name===planName),asset:file&&await file.text(),catalogue:(await d.AttachmentStorage.list()).some(row=>row.id===assetId)};
  }.toString()+')('+JSON.stringify({assetId,noteKey,diaryDate,planName})+')');
  assert.equal(row.note,noteText);assert.equal(row.review,canonical);assert.ok(row.plan?.includes('Native QA study'));assert.equal(row.asset,pdfText);assert.equal(row.catalogue,true);assert.equal(row.diary,diaryText);assert.equal(row.savedPlan,true);assert.equal(row.paused,true);
  console.log('Canonical note, review, plan and attachment restart read verified');
}
async function editor(){
  await page.evaluate('__nativeQA.goTab("review")');
  await waitFor(()=>page.evaluate('!!document.querySelector(".sd-rte[data-sd-rich-surface=reflection] .sd-rte-focus-trigger")'),{label:'Wordgard reflection mounted'});
  await page.evaluate('document.querySelector(".sd-rte[data-sd-rich-surface=reflection] .sd-rte-focus-trigger").click()');
  const selector='.workspace-overlay-rich-text .sd-rte-editor';
  await waitFor(()=>page.evaluate('!!document.querySelector('+JSON.stringify(selector)+')'),{label:'Wordgard focus editor'});
  await page.evaluate('(()=>{const editor=document.querySelector('+JSON.stringify(selector)+');editor.focus();const range=document.createRange();range.selectNodeContents(editor);range.collapse(false);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);})()');
  await page.send('Input.insertText',{text:' via Wordgard'});
  const expected=reflection+' via Wordgard';
  await waitFor(()=>page.evaluate('document.querySelector('+JSON.stringify(selector)+')?.textContent.includes('+JSON.stringify(expected)+')'),{label:'Wordgard keyboard insertion'});
  await page.evaluate('document.querySelector(".workspace-overlay-rich-text .workspace-overlay-close").click()');
  await waitFor(()=>page.evaluate('!document.querySelector("dialog.workspace-overlay-rich-text[open]")'),{label:'Wordgard focus close'});
  const row=await page.evaluate('(async()=>{const d=__nativeQA;d.RichTextRuntime.flushEditors();d.ReviewEditor.saveReview({strict:true});await d.ReviewEditor.flushPending();await d.ReviewEditor.settled();const value=(await d.AppData.activeSession.load()).value?.snapshot?.review?.reflection;return {value,rich:StudyDirectorRichText.isRichTextValue(value),plain:StudyDirectorRichText.toPlainText(value)};})()');
  assert.equal(row.rich,true);assert.equal(row.plain.trim(),expected);
  await page.evaluate('__nativeQA.goTab("plan")');
  console.log('Wordgard keyboard edit and canonical save verified');
  return row.value;
}
async function pauseDurably(){
  await page.evaluate('(async()=>{const d=__nativeQA;await d.goTab("execute");d.TimerEngine.startCur(1200);d.TimerEngine.togglePause();await d.goTab("plan");})()');
  await waitFor(()=>page.evaluate('__nativeQA.AppData.activeSession.load().then(row=>row.value?.snapshot?.timerRuntime?.paused===true)'),{label:'durable paused timer'});
}
async function checkpoint(){
  return page.evaluate('(async()=>{const backup=await __nativeQA.BackupController.createCheckpoint();try{return {filename:backup.filename,bytes:Array.from(new Uint8Array(await backup.blob.arrayBuffer()))};}finally{await backup.release();}})()');
}
async function reloadThrough(action){
  const old=await page.evaluate('performance.timeOrigin');
  await page.evaluate('setTimeout(()=>{'+action+'},0);true');
  await waitFor(()=>page.evaluate('performance.timeOrigin!=='+old+'&&document.readyState==="complete"'),{label:'profile reload'});
  await waitForStudyDirector(page);
  await exposeApplication();
}
async function profilesAndImport(bootProfile,assetId,canonical){
  const backup=await checkpoint();
  await reloadThrough('__nativeQA.Profiles.add()');
  await profile('Tauri QA second');
  const second=await page.evaluate('(async()=>({id:StudyDirector.backup.profile.id(),note:__nativeQA.AppData.notes.get('+JSON.stringify(noteKey)+')||null,assets:(await __nativeQA.AttachmentStorage.list()).length}))()');
  assert.notEqual(second.id,bootProfile);assert.equal(second.note,null);assert.equal(second.assets,0);
  const imported=await page.evaluate('('+async function({backup,assetId,noteKey,diaryDate,planName}){
    const d=__nativeQA,blob=new Blob([Uint8Array.from(backup.bytes)]),candidate=await d.BackupController.inspect(blob,{filename:backup.filename});
    let done=false,result,error;
    d.BackupController.restore(candidate).then(value=>{result=value;done=true;},reason=>{error=reason;done=true;});
    const deadline=Date.now()+60000;
    while(!done&&Date.now()<deadline){
      const dialog=document.getElementById('sd-interaction-dialog');
      if(dialog?.open){
        const title=dialog.querySelector('.interaction-title')?.textContent||'';
        if(title==='Different versions found'){
          for(const group of dialog.querySelectorAll('.interaction-group')){
            const label=group.querySelector('.interaction-group-title')?.textContent||'';
            const options=[...group.querySelectorAll('.interaction-option')];
            const choice=label==='Plan draft and saved plans'?options.find(button=>button.dataset.value==='replace'):
              label==='Personal and display settings'?options.find(button=>button.dataset.value==='keep'):
              label==='Active / suspended session'?options.find(button=>button.dataset.value.endsWith('_incoming')):null;
            if(!choice)throw new Error('Unexpected restore group: '+label);
            choice.click();
          }
          dialog.querySelector('.interaction-actions .primary').click();
        }else throw new Error('Unexpected restore dialog: '+title);
      }
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    if(!done)throw new Error('Portable combine did not settle');
    if(error)throw error;
    const file=await d.AttachmentStorage.get(assetId);
    return {verified:result.verified,changed:result.changed,note:d.AppData.notes.get(noteKey)?.text,diary:(await d.AppData.dailyRecords.get(diaryDate))?.reflection,savedPlan:d.PlanData.library().savedPlans.some(row=>row.name===planName),asset:file&&await file.text(),profile:StudyDirector.backup.profile.id(),result};
  }.toString()+')('+JSON.stringify({backup,assetId,noteKey,diaryDate,planName})+')');
  console.log('Portable combine witness:',JSON.stringify(imported));
  assert.equal(imported.diary,diaryText);assert.equal(imported.savedPlan,true);
  assert.equal(imported.verified,true);assert.equal(imported.changed,true);assert.equal(imported.note,noteText);assert.equal(imported.asset,pdfText);assert.equal(imported.profile,second.id);
  await reloadThrough('__nativeQA.Profiles.switchTo('+JSON.stringify(bootProfile)+')');
  assert.equal(await page.evaluate('StudyDirector.backup.profile.id()'),bootProfile);
  await appRead(assetId,canonical);
  console.log('Profile isolation, portable backup import and switch-back verified');
}
async function security(){
  assert.equal(await page.evaluate('(()=>{const node=document.createElement("div");try{node.innerHTML="<b>untrusted</b>";return false;}catch(error){return error instanceof TypeError&&node.childNodes.length===0;}})()'),true,'Trusted Types must block raw HTML');
  assert.equal(await page.evaluate('Array.from(document.scripts).some(script=>/accounts\\.google\\.com|google-drive|drive\\.[a-f0-9]+\\.js/i.test(script.src))'),false,'browser OAuth bundle must not load');
  await page.evaluate('window.open("about:blank","qa-popup");true');
  await page.evaluate('setTimeout(()=>location.assign("https://tauri-qa.invalid/"),0);true');
  await new Promise(resolve=>setTimeout(resolve,750));
  assert.equal(await page.evaluate('location.origin'),origin);
  const targets=await (await fetch('http://127.0.0.1:'+debugPort+'/json/list')).json();
  assert.equal(targets.filter(row=>row.type==='page').length,1,'no new popup WebView');
  console.log('Trusted Types, OAuth isolation, popup and external navigation denial verified');
}

async function navigation(){
  for(const tab of ['execute','review','library','plan']){
    await page.evaluate('document.getElementById("tab-'+tab+'").click()');
    await waitFor(()=>page.evaluate('document.getElementById("tab-'+tab+'").getAttribute("aria-selected")==="true"'),{label:tab+' selected'});
  }
}
try{
  debugPort=await port();installPolicy();
  await start();await profile();await navigation();
  const assetId=await appWrite(),canonical=await editor();await pauseDurably();
  const first=await storage(true);verify(first);
  const bootProfile=JSON.parse(first.profile).active;
  await stop(false);await start();const normal=await storage(false);verify(normal);
  assert.equal(JSON.parse(normal.profile).active,bootProfile);await appRead(assetId,canonical);
  await stop(true);await start();const killed=await storage(false);verify(killed);
  assert.equal(JSON.parse(killed.profile).active,bootProfile);await appRead(assetId,canonical);
  await navigation();await profilesAndImport(bootProfile,assetId,canonical);await security();await stop(false);
  console.log(JSON.stringify({status:'PASS',origin,packagedBoot:true,navigation:true,profile:true,indexedDB:true,opfs:true,normalCloseReopen:true,forcedTerminationReopen:true,canonicalAppRecords:true,diary:true,savedPlan:true,pausedTimerRecovery:true,attachmentBytes:true,backupRoundtripInspection:true,wordgardEdit:true,workerSyncOPFS:true,profileSwitchIsolation:true,portableImport:true,security:true}));
}finally{
  clearTimeout(deadline);
  if(page)page.socket.close();
  if(app?.exitCode===null)app.kill();
  removePolicy();
}
