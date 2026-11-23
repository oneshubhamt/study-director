import assert from 'node:assert/strict';
import {launchChromium,startReleaseServer,instrumentedHtml,waitForStudyDirector} from '../../helpers/browser-harness.mjs';

const server=await startReleaseServer(),browser=await launchChromium({profilePrefix:'sd-generated-export-'});
const html=instrumentedHtml().replace('Object.freeze({StartupLifecycle,','Object.freeze({Exports,StartupLifecycle,');
server.setOverride('deployment','generated-export-runtime.html',html);
const preload=`(()=>{localStorage.setItem('studyDirector.userDefaults.v1',JSON.stringify({version:1,studentName:'Generated Export QA'}));localStorage.setItem('studyDirector.profiles.v1',JSON.stringify({version:1,active:'prof_qa_mve00000_abcdef01',profiles:[{id:'prof_qa_mve00000_abcdef01',scope:'',name:'',email:'',folder:'',createdAt:'2026-08-01T00:00:00.000Z',fresh:false,from:null}],removing:[]}));const NativeWorker=Worker;window.generatedExportWorkers=0;window.Worker=class extends NativeWorker{constructor(url,options){super(url,options);if(options?.name==='study-director-exports')generatedExportWorkers++;}};})();`;
let page;
try{
  page=await browser.createPage(server.url('deployment','generated-export-runtime.html'),{preload});
  await waitForStudyDirector(page,{instrumented:true});
  const result=await page.evaluate(`(async()=>{const file=await __PWA6.Exports.run('file.copy',{file:new Blob(['generated runtime export witness'])}),text=await file.text();await __PWA6.Exports.run('file.release',{file});return {text,workers:generatedExportWorkers,status:__PWA6.Exports.status()};})()`);
  assert.equal(result.text,'generated runtime export witness');
  assert.equal(result.workers,1,'browser export must execute through the generated export worker');
  assert.equal(result.status.pending,0);
  assert.equal(result.status.busy,false);
  console.log(JSON.stringify({status:'PASS',suite:'generated-export-runtime',workers:result.workers,pending:result.status.pending}));
}finally{
  if(page)await browser.closePage(page);
  await browser.close();
  await server.close();
}
