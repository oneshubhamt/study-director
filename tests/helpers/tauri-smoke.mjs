// Disposable GitHub-hosted runner only. CDP is enabled only for this child.
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
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
},240000);
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
async function profile(){
  await waitFor(()=>page.evaluate('document.getElementById("first-start-dialog")?.open'),{label:'first-start dialog'});
  await page.evaluate('document.getElementById("first-start-name").value="Tauri QA";document.getElementById("first-start-continue").click();');
  await waitFor(()=>page.evaluate('(()=>{const d=document.getElementById("first-start-dialog");const list=JSON.parse(localStorage.getItem("studyDirector.profiles.v1")||"null");return !d.open&&list?.profiles?.some(row=>row.name==="Tauri QA"&&!row.fresh);})()'),{label:'disposable profile committed'});
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
  const first=await storage(true);verify(first);
  const bootProfile=JSON.parse(first.profile).active;
  await stop(false);await start();const normal=await storage(false);verify(normal);
  assert.equal(JSON.parse(normal.profile).active,bootProfile);
  await stop(true);await start();const killed=await storage(false);verify(killed);
  assert.equal(JSON.parse(killed.profile).active,bootProfile);
  await navigation();await stop(false);
  console.log(JSON.stringify({status:'PASS',origin,packagedBoot:true,navigation:true,profile:true,indexedDB:true,opfs:true,normalCloseReopen:true,forcedTerminationReopen:true}));
}finally{
  clearTimeout(deadline);
  if(page)page.socket.close();
  if(app?.exitCode===null)app.kill();
  removePolicy();
}
