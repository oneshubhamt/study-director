import fs from 'node:fs';
import {artifactPath,writeArtifact} from '../../helpers/artifacts.mjs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitForStudyDirector,waitFor,instrumentedHtml} from '../../helpers/browser-harness.mjs';
import {deploymentDirectoryName} from '../../../release.config.mjs';
const server=await startReleaseServer(),browser=await launchChromium({profilePrefix:'qa-runtime-security-'});
const policy="worker-src 'self'; require-trusted-types-for 'script'; trusted-types sd-inert-html sd-assets sd-legal-html sd-insights-worker sd-google-signin";
let html=instrumentedHtml();
if(process.env.SD_MINIFIED_TEST==='1'){
 const root=path.resolve('dist',deploymentDirectoryName,'public');
 for(const name of fs.readdirSync(root))if(fs.statSync(path.join(root,name)).isFile())server.setOverride('deployment',name,fs.readFileSync(path.join(root,name)));
 const expose=html.match(/window\.__PWA6=Object\.freeze\(\{[^;]+;\n/)[0];
 html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace('window.StudyDirector=StudyDirectorPublicAPI;',expose+'window.StudyDirector=StudyDirectorPublicAPI;').replace(/void PwaLifecycle\.install\(\)(?:\.then\(\(\)=>schedulePwaUpdateCheck\(750\)\))?;/,'');
}
server.setOverride('deployment','runtime-security.html',html.replace('<head>','<head><meta http-equiv="Content-Security-Policy" content="'+policy+'">').replace('Object.freeze({StartupLifecycle,','Object.freeze({mutateBackupProtection,ExportsAppMeta,trustedAssetURL,trustedTypeViolations,StartupLifecycle,'));
const preload=`(()=>{const d=new Date(),today=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');localStorage.setItem('studyDirector.userDefaults.v1',JSON.stringify({version:1,studentName:'Security QA',updatedAt:d.toISOString()}));localStorage.setItem('studyDirector.nameSetupSkippedDate.v1',today);})();`;
let page;
try{
 page=await browser.createPage(server.url('deployment','runtime-security.html'),{preload});await waitForStudyDirector(page,{instrumented:true});await waitFor(()=>page.evaluate('__PWA6.AppOwnership.status().hasControl'));
 const imageWorkerName=html.match(/sd\.image-worker\.[a-f0-9]+\.js/)[0];
 assert.equal(await page.evaluate(`new Promise((resolve,reject)=>{const w=new Worker(__PWA6.trustedAssetURL(${JSON.stringify(imageWorkerName)}));w.onmessage=({data})=>{w.terminate();resolve(data.result?.width)};w.onerror=()=>{w.terminate();reject(Error('Image worker failed under Trusted Types'))};w.postMessage({file:new Blob([Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'),c=>c.charCodeAt(0))],{type:'image/gif'}),mimeType:'image/gif'})})`),1);

 const searchWorkerName=html.match(/sd\.note-search\.[a-f0-9]+\.js/)[0];
 assert.deepEqual(await page.evaluate(`new Promise((resolve,reject)=>{const w=new Worker(__PWA6.trustedAssetURL(${JSON.stringify(searchWorkerName)}));w.onmessage=({data})=>{w.terminate();resolve(data.keys)};w.onerror=()=>{w.terminate();reject(Error('Search worker failed under Trusted Types'))};w.postMessage({type:'sync',documents:[{key:'qa',plain:'search boundary'}]});w.postMessage({type:'query',id:1,query:'boundary'})})`),['qa']);
 const policyWrites=await page.evaluate(`(async()=>{
   const mutate=__PWA6.mutateBackupProtection,record={version:1,id:'qa-policy',verifier:new Blob(['proof'])};
   const writes=await Promise.allSettled([mutate(record,{expectedId:'',check(){}}),mutate({...record,id:'stale-policy'},{expectedId:'',check(){}})]);
   const current=await __PWA6.ExportsAppMeta.read('backupProtection');
   const refused=await mutate(null,{expectedId:current.id,check(){throw Error('ownership lost')}}).then(()=>false,()=>true);
   const retained=(await __PWA6.ExportsAppMeta.read('backupProtection')).id===current.id;
   await mutate(null,{expectedId:current.id,check(){}});
   return {commits:writes.filter(x=>x.status==='fulfilled').length,refused,retained};
 })()`);
 assert.deepEqual(policyWrites,{commits:1,refused:true,retained:true});

 await page.evaluate(`(()=>{const d=__PWA6,now=new Date(),m=now.getHours()*60+now.getMinutes(),fmt=v=>String(Math.floor(v/60)).padStart(2,'0')+':'+String(v%60).padStart(2,'0');document.getElementById('plan-input').value=fmt(m)+' | 30 | Ethics study | work | Ethics | pages | 10';d.applySchedule({skipNotify:true});d.goTab('execute');d.TimerEngine.startCur(30);})()`);
 assert.equal(await page.evaluate('document.querySelector(".pane.on").id'),'pane-execute');
 assert.equal(await page.evaluate('__PWA6.TimerState.paused'),false);
 await page.click('#cd-card');assert.equal(await page.evaluate('__PWA6.TimerState.paused'),true);
 await page.click('#cd-card');assert.equal(await page.evaluate('__PWA6.TimerState.paused'),false);
 // Repeat HTML paste to catch duplicate policy creation under enforcement.
 await page.evaluate(`(async()=>{const field=document.createElement('textarea');field.id='security-note';document.body.appendChild(field);window.testEditor=await StudyDirectorRichText.mountRichTextEditor({field,label:'Security paste',initialValue:'',maxWords:10000,maxBytes:917504,assets:{get:async()=>null,put:async()=>{},remove:async()=>{}}});for(let i=0;i<2;i++){const editor=document.querySelector('#security-note + .sd-rte .sd-rte-editor');editor.focus();const data=new DataTransfer();data.setData('text/html','<p><strong>Safe text</strong><img src=x onerror="window.badPaste=true"><a href="javascript:alert(1)">bad link</a></p>');data.setData('text/plain','Safe text');editor.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,50));}})()`);
 assert.equal(await page.evaluate('window.badPaste===true'),false);
 assert.match(await page.evaluate('document.querySelector("#security-note + .sd-rte").textContent'),/Safe text/);
 assert.equal(await page.evaluate('document.querySelector("#security-note + .sd-rte a[href^=javascript]")===null'),true);
 await page.evaluate('testEditor.destroy();document.getElementById("security-note").remove()');
 await page.evaluate(`__PWA6.goTab('guide')`);await waitFor(()=>page.evaluate('!!document.getElementById("pane-guide")'));
 await waitFor(()=>page.evaluate('!![...document.querySelectorAll("#pane-guide button")].find(b=>b.textContent==="Privacy")'));
 await page.evaluate('[...document.querySelectorAll("#pane-guide button")].find(b=>b.textContent==="Privacy").click()');
 await waitFor(()=>page.evaluate('!!document.querySelector(".legal-center-document")'));
 assert.equal(await page.evaluate('document.querySelector(".legal-center-document script")===null'),true);
 await page.evaluate('history.back()');
 await waitFor(()=>page.evaluate('!document.querySelector(".legal-center-overlay:not([hidden])")'));
 // Export worker construction is also a TrustedScriptURL sink.
 await page.evaluate('__PWA6.BackupController.createCheckpoint()');
 assert.equal(await page.evaluate('__PWA6.trustedTypeViolations.size'),0);
 await page.evaluate('__PWA6.TimerEngine.stopExecution()');
 console.log(JSON.stringify({status:'PASS',suite:'runtime-security-boundary',strictTrustedTypes:true,repeatedPaste:true,exportWorker:true,timer:true,minified:process.env.SD_MINIFIED_TEST==='1'}));
 const errors=page.events.filter(e=>!/favicon|ResizeObserver loop/.test(e.text));assert.deepEqual(errors,[]);
}finally{if(page)await browser.closePage(page);await browser.close();await server.close();}
