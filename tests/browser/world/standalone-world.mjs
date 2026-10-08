import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {deploymentDirectoryName} from '../../../release.config.mjs';
import {startReleaseServer,launchChromium,waitForStudyDirector,waitFor} from '../../helpers/browser-harness.mjs';

const server=await startReleaseServer();
const browser=await launchChromium({args:process.env.SD_WORLD_GPU_TEST==='1'?[
 '--enable-unsafe-webgpu','--use-angle=swiftshader','--enable-features=Vulkan','--use-vulkan=swiftshader','--disable-gpu-sandbox'
]:[]});
const result={status:'PASS',checks:{}};
const policy="worker-src 'self'; require-trusted-types-for 'script'; trusted-types sd-inert-html sd-assets sd-legal-html sd-insights-worker sd-world-worker sd-google-signin";
const publicDirectory=process.env.SD_WORLD_MINIFIED_TEST==='1'?path.join('dist',deploymentDirectoryName,'public'):'dist/deployment';
if(process.env.SD_WORLD_MINIFIED_TEST==='1'){
 const serve=(directory,prefix='')=>{for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
  const relative=prefix+entry.name,file=path.join(directory,entry.name);
  if(entry.isDirectory())serve(file,relative+'/');else server.setOverride('deployment',relative,fs.readFileSync(file));
 }};serve(publicDirectory);
}
const html=fs.readFileSync(path.join(publicDirectory,'index.html'),'utf8')
 .replace(/void PwaLifecycle\.install\(\)(?:\.then\(\(\)=>schedulePwaUpdateCheck\(750\)\))?;/,'/* Offline lifecycle is covered by the PWA suite. */')
 .replace('<head>',`<head><meta http-equiv="Content-Security-Policy" content="${policy}">`);
server.setOverride('deployment','world-test.html',html);
const preload=`(()=>{
 const date=new Date(),today=[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
 localStorage.setItem('studyDirector.nameSetupSkippedDate.v1',today);
 const audit=window.__worldAudit={active:0,started:0,terminated:0,forbidden:[],requests:[],operations:[]};
 const own='studyDirector.plugin.living-world.';
 for(const method of ['getItem','setItem','removeItem']){
  const original=Storage.prototype[method];
  Storage.prototype[method]=function(key,...args){
   if(/sd\\.world\\./.test(new Error().stack||'')&&!String(key).startsWith(own)){audit.forbidden.push(method+':'+key);throw Error('World crossed canonical storage boundary');}
   return original.call(this,key,...args);
  };
 }
 const open=IDBFactory.prototype.open;
 IDBFactory.prototype.open=function(...args){
  if(/sd\\.world\\./.test(new Error().stack||'')){audit.forbidden.push('indexedDB.open');throw Error('World reached canonical IndexedDB');}
  return open.apply(this,args);
 };
 const OriginalWorker=window.Worker;
 window.Worker=class extends OriginalWorker {
  constructor(url,options){super(url,options);this.isWorld=String(url).includes('sd.world-planet-worker.');this.stopped=false;if(this.isWorld){audit.active++;audit.started++;audit.requests.push(String(url));}}
  postMessage(message,...rest){if(this.isWorld)audit.operations.push({operation:message.operation,recordCount:message.timeline?.source?.recordCount});return super.postMessage(message,...rest);}
  terminate(){if(this.isWorld&&!this.stopped){this.stopped=true;audit.active--;audit.terminated++;}return super.terminate();}
 };
 if(${process.env.SD_WORLD_GPU_TEST==='1'?'false':'true'})Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true});
})();`;
let page;
try{
 page=await browser.createPage(server.url('deployment','world-test.html'),{preload,viewport:{width:1440,height:900}});
 await waitForStudyDirector(page); await page.send('Page.bringToFront');
 assert.equal(await page.evaluate(`document.querySelector('script[src^="sd.world."]')!==null`),false,'World must not execute at startup.');
 assert.equal(await page.evaluate(`__worldAudit.started`),0);
 // The host independently records its periodic PWA check. The stack audit still
 // rejects any attempt by World to access that key or any other canonical key.
 const canonicalKeys=`Object.keys(localStorage).filter(key=>!key.startsWith('studyDirector.plugin.living-world.')&&key!=='studyDirector.pwaUpdateCheck.v1').sort()`;
 const baseline=await page.evaluate(`({draft:document.getElementById('plan-input').value,keys:${canonicalKeys}})`);
 await page.click('[data-tab="world"]');
 await waitFor(()=>page.evaluate(`['ready','unavailable','failed'].includes(document.querySelector('#pane-world .world-pass8-stage')?.dataset.renderState)`),{timeout:90000,label:'standalone planet'});
 const world=await page.evaluate(`({state:document.querySelector('#pane-world .world-pass8-stage').dataset.renderState,notice:document.querySelector('.world-unavailable')?.textContent||'',source:document.querySelector('[data-world-status="history"] span').textContent,canvas:document.querySelector('[data-world-renderer-surface]').dataset.worldRenderer||'',seed:localStorage.getItem('studyDirector.plugin.living-world.v1.seed'),plugins:StudyDirector.plugins.status(),audit:__worldAudit,globals:Object.keys(window).filter(key=>key.startsWith('SDWorld'))})`);
 assert.equal(world.plugins.optionalFiles.find(row=>row.tabId==='world').state,'registered');
 assert.deepEqual(world.globals,[],'Planetary engines must remain scoped to their own bundle.');
 assert.match(JSON.parse(world.seed),/^[a-f0-9]{32}$/); assert.match(world.source,/Neutral standalone world/);
 assert.deepEqual(world.audit.forbidden,[]);assert.ok(world.audit.started>=3);
 assert.ok(world.audit.operations.some(row=>row.operation==='evolve-ecology'&&row.recordCount===0));
 if(process.env.SD_WORLD_GPU_TEST==='1'){
  assert.equal(world.state,'ready');assert.equal(world.canvas,'webgpu');
  await waitFor(()=>page.evaluate(`document.querySelector('[data-world-render-badge="renderer"]').textContent.includes('level')`),{timeout:90000,label:'streamed WebGPU terrain'});
  await page.click('[data-world-renderer-surface]');
  await waitFor(()=>page.evaluate(`document.activeElement.matches('[data-world-renderer-surface]')&&localStorage.getItem('studyDirector.plugin.living-world.v1.spherical-camera')!==null`),{label:'focused world camera'});
  const originalCamera=await page.evaluate(`localStorage.getItem('studyDirector.plugin.living-world.v1.spherical-camera')`);
  await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
  await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
  await waitFor(()=>page.evaluate(`localStorage.getItem('studyDirector.plugin.living-world.v1.spherical-camera')!==${JSON.stringify(originalCamera)}`),{label:'own camera state'});
  result.checks.webgpuTerrainAndCamera=true;
 }else{
  assert.equal(world.state,'unavailable');assert.match(world.notice,/WebGPU support/);assert.equal(world.canvas,'');
  result.checks.unsupportedWebgpuMessage=true;
 }
 await page.click('[data-world-view="ecology"]');
 await waitFor(()=>page.evaluate(`document.querySelector('[data-world-view-panel="ecology"]').hidden===false`),{label:'Ecology view'});
 await page.click('[data-world-view="discoveries"]');
 await waitFor(()=>page.evaluate(`document.querySelector('[data-world-view-panel="discoveries"]').hidden===false`),{label:'Discoveries view'});
 await page.click('[data-tab="plan"]');
 await waitFor(()=>page.evaluate(`!document.querySelector('#pane-world .world-pass8')&&__worldAudit.active===0`),{label:'World resources released on exit'});
 assert.equal(await page.evaluate(`document.getElementById('plan-input').value`),baseline.draft);
 const after=await page.evaluate(`({keys:${canonicalKeys},audit:__worldAudit})`);
 assert.deepEqual(after.keys,baseline.keys);assert.deepEqual(after.audit.forbidden,[]);
 assert.equal(after.audit.started,after.audit.terminated);
 // Leave during generation, then reopen while the aborted worker settles.
 await page.click('[data-tab="world"]');await page.click('[data-tab="plan"]');await page.click('[data-tab="world"]');
 await waitFor(()=>page.evaluate(`['ready','unavailable'].includes(document.querySelector('#pane-world .world-pass8-stage')?.dataset.renderState)`),{timeout:90000,label:'World after interrupted generation'});
 assert.equal(await page.evaluate(`localStorage.getItem('studyDirector.plugin.living-world.v1.seed')`),world.seed);
 await page.click('[data-tab="execute"]');
 await waitFor(()=>page.evaluate(`__worldAudit.active===0`),{label:'worker cleanup'});
 assert.ok(await page.evaluate(`document.querySelector('#pane-execute').classList.contains('on')`));
 const unexpected=page.events.filter(event=>!/favicon|ResizeObserver loop/i.test(event.text||''));assert.deepEqual(unexpected,[]);
 result.checks.lazyTrustedExternalRegistration=true;result.checks.noCanonicalStorageAccess=true;
 result.checks.neutralEcology=true;result.checks.exitAndInterruptedGenerationCleanup=true;result.checks.coreNavigationUnaffected=true;
}catch(error){
 if(page)console.error(JSON.stringify(await page.evaluate(`({pane:document.getElementById('pane-world')?.outerHTML.slice(0,3500),plugins:StudyDirector.plugins.status(),audit:__worldAudit,errors:[]})`)),JSON.stringify(page.events));
 throw error;
}finally{if(page)await browser.closePage(page).catch(()=>{});await browser.close();await server.close();}
console.log(JSON.stringify(result,null,2));
