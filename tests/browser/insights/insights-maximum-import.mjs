import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {launchChromium,startReleaseServer,waitFor,withoutPwaChecks} from '../../helpers/browser-harness.mjs';

const root=process.cwd();
const manifest=JSON.parse(fs.readFileSync(path.join(root,'dist','build-manifest.json'),'utf8'));
let html=fs.readFileSync(path.join(root,'dist','deployment',manifest.main),'utf8');
const marker='/* PUBLIC PLUGIN API */';
if(!html.includes(marker))throw new Error('Insights browser harness hook is unavailable.');
html=html.replace(marker,`window.__InsightsMaximumQA=Object.freeze({StartupLifecycle,AppData,BackupCodec,PlanData,goTab});\n${marker}`);
html=withoutPwaChecks(html);
const insightsName=manifest.externalRuntimeFiles.find(name=>name.startsWith('sd.insights.'));
assert.ok(insightsName,'content-hashed Insights runtime is missing');
const insights=fs.readFileSync(path.join(root,'dist','deployment',insightsName),'utf8');

const chromium=process.env.CHROMIUM_PATH||['/usr/bin/chromium','/tmp/chromium'].find(file=>fs.existsSync(file))||'/usr/bin/chromium';
const browser=await launchChromium({executable:chromium,profilePrefix:'study-director-qa-maximum-import-'});
const server=await startReleaseServer();
let page=null;
try{
  server.setOverride('deployment','maximum-instrumented.html',html);
  const preload=`(()=>{try{localStorage.setItem('studyDirector.userDefaults.v1',JSON.stringify({version:1,studentName:'Maximum Import QA',updatedAt:new Date().toISOString()}));(localStorage.getItem('studyDirector.profiles.v1')||localStorage.setItem('studyDirector.profiles.v1',JSON.stringify({version:1,active:'prof_qa_mve00000_abcdef01',profiles:[{id:'prof_qa_mve00000_abcdef01',scope:'',name:'',email:'',folder:'',createdAt:'2026-08-01T00:00:00.000Z',fresh:false,from:null}],removing:[]})));localStorage.setItem('studyDirector.installNoticeShown.v1','true');}catch{}window.alert=()=>{};window.confirm=()=>true;window.prompt=()=>'';try{navigator.__qaNativeStorage=navigator.storage;Object.defineProperty(navigator,'storage',{configurable:true,value:{getDirectory:()=>StorageManager.prototype.getDirectory.call(navigator.__qaNativeStorage),persisted:async()=>false,persist:async()=>false,estimate:async()=>({usage:0,quota:268435456})}})}catch{}})();`;
  page=await browser.createPage(server.url('deployment','maximum-instrumented.html'),{preload});
  await waitFor(()=>page.evaluate(`!!(window.__InsightsMaximumQA&&__InsightsMaximumQA.StartupLifecycle.status().fullyInitialized)`),{timeout:45000,label:'maximum-data Study Director startup'});
  await page.evaluate(insights);
  await waitFor(()=>page.evaluate(`StudyDirector.plugins.status().registered.some(row=>row.name==='SD-insights'&&row.state==='registered')`),{timeout:30000,label:'content-hashed Insights registration'});

  const result=await page.evaluate(`(async()=>{
    const qa=window.__InsightsMaximumQA,dayMs=86400000,start=Date.parse('2025-01-01T00:00:00Z'),end=Date.parse('2026-08-13T00:00:00Z'),records=[];
    const repeated='Realistic maximum-data browser fixture. '.repeat(12);
    for(let stamp=start,dayIndex=0;stamp<=end;stamp+=dayMs,dayIndex++){
      const date=new Date(stamp).toISOString().slice(0,10),schedule=[],results={};
      for(let taskIndex=0;taskIndex<8;taskIndex++){
        const id='d'+dayIndex+'-t'+taskIndex;
        schedule.push({id,start:String(7+taskIndex).padStart(2,'0')+':00',duration:50,name:('Study '+taskIndex+' '+repeated).slice(0,300),kind:'work',area:'Area '+(taskIndex%12),measure:'pages',target:20+taskIndex,note:repeated});
        results[id]={completion:55+(dayIndex+taskIndex)%46,completionSource:'manual',actualSeconds:1800+(taskIndex*120)};
      }
      records.push(qa.,.dailyRecord({version:13,date,dayName:'Study day',studyQuality:1+(dayIndex%5),schedule,results,practiceRuns:[]}));
    }
    const codec=qa.BackupCodec,counts=codec.countShape({checkpointManifest:1,personalData:1,dailyRecord:records.length,note:0,activeSession:0});
    const manifest=codec.createManifest({studentName:'Maximum Import QA',installationId:'inst_maximum_import_browser',exportedAt:'2026-08-13T00:00:00.000Z',counts},{compression:'none',algorithm:'sha256'});
    const lines=[JSON.stringify(manifest)],hashes=[];let sequence=0,parserYields=0,commitYields=0;
    for(const [type,value] of [['checkpointManifest',codec.createProtectedManifest({sourceRevision:manifest.exportedAt,recordDates:records.map(row=>row.date)},manifest.checkpoint)],['personalData',await qa.PlanData.exportData({flush:false})]]){const encoded=await codec.encodeChunk(sequence++,type,[value],'sha256');lines.push(encoded.line);hashes.push(encoded.checksum);}
    for(const group of codec.splitItems(records)){
      const encoded=await codec.encodeChunk(sequence++,'dailyRecord',group,'sha256');
      lines.push(encoded.line);hashes.push(encoded.checksum);
    }
    lines.push(JSON.stringify(await codec.encodeCompletion(sequence,counts,hashes,'sha256')));
    const metadata=new Blob([lines.join('\\n')+'\\n'],{type:'application/octet-stream'}),blob=codec.createV10Container(metadata,{compression:'none'});
    const started=performance.now();
    const inspected=await codec.inspectCurrent(blob,{filename:'maximum-data.sdbackup',yieldControl:()=>new Promise(resolve=>requestAnimationFrame(()=>{parserYields++;resolve();}))});
    const committed=await qa.AppData.dailyRecords.importBatches(inspected.records,{yieldControl:()=>new Promise(resolve=>requestAnimationFrame(()=>{commitYields++;resolve();}))});
    const summaries=await qa.AppData.dailyRecords.summaries();
    localStorage.setItem('studyDirector.insights.window.v1','all');
    qa.goTab('insights');
    window.__InsightsMaximumImportResult={records:records.length,bytes:blob.size,parsed:inspected.records.length,committed:committed.committed,batches:committed.batches,summaries:summaries.length,parserYields,commitYields,importMs:performance.now()-started};
    return window.__InsightsMaximumImportResult;
  })()`);
  assert.equal(result.records,590);
  assert.equal(result.parsed,result.records);
  assert.equal(result.committed,result.records);
  assert.equal(result.summaries,result.records);
  assert.ok(result.parserYields>0,'maximum parser did not yield to the browser');
  assert.ok(result.commitYields>0,'maximum IndexedDB import did not yield to the browser');
  await waitFor(()=>page.evaluate(`document.getElementById('pane-insights')?.getAttribute('aria-busy')==='false'&&!!document.querySelector('#pane-insights .insights-wrap')`),{timeout:120000,label:'maximum-data Insights render'});
  const rendered=await page.evaluate(`({active:document.querySelector('#pane-insights .insights-window-btn.active')?.textContent.trim()||'',text:document.getElementById('pane-insights')?.innerText||'',events:window.__InsightsMaximumImportResult})`);
  assert.equal(rendered.active,'All');
  assert.match(rendered.text,/All records · 590 saved days/u);
  assert.deepEqual(page.events,[]);
  console.log(JSON.stringify({status:'PASS',suite:'insights-maximum-import',maximumSupportedSavedDays:result.records,backupBytes:result.bytes,parserYields:result.parserYields,commitYields:result.commitYields,importMs:Number(result.importMs.toFixed(1)),insightsRendered:true},null,2));
}finally{
  if(page)await browser.closePage(page);
  await server.close();
  try{await browser.close();}catch{}
}
