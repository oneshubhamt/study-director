import {chooseIncomingBackup,configureFixtureHook} from '../../helpers/backup-fixture-choices.mjs';
import assert from 'node:assert/strict';
import {RUNTIME_DATA_CONTRACT as DATA_CONTRACT} from '../../../contracts/canonical-identities.mjs';
import {artifactPath,writeArtifact} from '../../helpers/artifacts.mjs';
import fs from 'node:fs';
import {launchChromium,startReleaseServer,instrumentedHtml,waitForStudyDirector,waitFor} from '../../helpers/browser-harness.mjs';

const server=await startReleaseServer(),browser=await launchChromium({profilePrefix:'qa-exports-'});
server.setOverride('deployment','exports-fixture.html',instrumentedHtml().replace('Object.freeze({StartupLifecycle,','Object.freeze({Exports,NoteExporter,BackupCodec:RuntimeBackupCodec,StartupLifecycle,').replace('configure:options=>Interactions.configure(options)',configureFixtureHook));
const preload=`window.chooseIncomingBackup=${chooseIncomingBackup.toString()};(()=>{
  const date=new Date(),today=[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');localStorage.setItem('studyDirector.userDefaults.v1',JSON.stringify({version:1,studentName:'Export QA',updatedAt:date.toISOString()}));localStorage.setItem('studyDirector.nameSetupSkippedDate.v1',today);
  const NativeWorker=Worker;window.workerCounts={started:0,live:0,messages:0};
  window.Worker=class extends NativeWorker{
    constructor(url,options){if(options?.name==='study-director-exports'&&window.failWorker)throw new Error('Injected worker startup failure');super(url,options);this.exports=options?.name==='study-director-exports';if(this.exports){workerCounts.started++;workerCounts.live++;}}
    postMessage(...args){if(this.exports){workerCounts.messages++;if(window.holdWorker)return;}return super.postMessage(...args);}
    terminate(){if(this.exports){workerCounts.live--;this.exports=false;}return super.terminate();}
  };
  HTMLAnchorElement.prototype.click=function(){window.latestDownload={name:this.download,blob:fetch(this.href).then(response=>response.blob())}};
  window.showSaveFilePicker=options=>{window.pickerActivation=navigator.userActivation.isActive;window.pickerCount=(window.pickerCount||0)+1;if(window.cancelPicker)return Promise.reject(new DOMException('Cancelled','AbortError'));return navigator.storage.getDirectory().then(root=>root.getFileHandle(options.suggestedName,{create:true})).then(handle=>(window.savedHandle=handle));};
})();`;
let page;const result={status:'PASS',suite:'exports',checks:{}};
try{
  page=await browser.createPage(server.url('deployment','exports-fixture.html'),{preload,viewport:{width:1200,height:850}});
  try{await waitForStudyDirector(page,{instrumented:true,timeout:10000});}catch(error){console.log(JSON.stringify({events:page.events,body:await page.evaluate('document.body.innerText.slice(-1000)')}));throw error;}await waitFor(()=>page.evaluate('__PWA6.AppOwnership.status().hasControl'));
  assert.equal(await page.evaluate('workerCounts.started'),0,'export worker stays cold at startup');
  await page.evaluate(`__PWA6.goTab('library');__PWA6.LibraryView.showSection('data');document.querySelectorAll('details').forEach(el=>el.open=true);document.getElementById('download-backup').scrollIntoView()`);
  // Export backup opens the save dialog straight from the click, writes the
  // chosen file, reads it back and says so.
  await page.settle();await page.click('#download-backup');
  await waitFor(()=>page.evaluate(`!!window.savedHandle&&!__PWA6.BackupController.status().standaloneExportActive`),{timeout:15000,label:'verified backup save'});
  assert.equal(await page.evaluate('window.pickerCount||0'),1,'Export backup opens one save dialog');assert.equal(await page.evaluate('pickerActivation'),true,'the dialog opens from the click itself');
  const chosen=await page.evaluate(`(async()=>{const file=await savedHandle.getFile(),candidate=await __PWA6.BackupController.inspect(file,{filename:file.name});return {name:file.name,size:file.size,preview:candidate.preview,workers:workerCounts,status:document.getElementById('backup-file-status').textContent}})()`);
  assert.match(chosen.name,/^export-qa-study-director-backup-\d{4}-\d{2}-\d{2}\.sdbackup$/u);assert.equal(chosen.preview.formatVersion,DATA_CONTRACT.schemas.Backup.version);assert.ok(chosen.size>0);assert.equal(chosen.workers.live,0);
  assert.match(chosen.status,/Backup saved and verified: export-qa-study-director-backup-/u);result.checks.saveDialogBackup=true;
  // Browsers without a save dialog download the verified file instead.
  await page.evaluate('window.nativePicker=window.showSaveFilePicker;window.showSaveFilePicker=undefined;window.latestDownload=null');await page.click('#download-backup');
  await waitFor(()=>page.evaluate(`!!window.latestDownload&&!__PWA6.BackupController.status().standaloneExportActive`),{timeout:15000,label:'verified backup download'});
  await page.evaluate('window.showSaveFilePicker=window.nativePicker');
  const downloaded=await page.evaluate(`(async()=>{const blob=await latestDownload.blob,candidate=await __PWA6.BackupController.inspect(blob,{filename:latestDownload.name});return {size:blob.size,preview:candidate.preview,workers:workerCounts}})()`);
  assert.equal(downloaded.preview.formatVersion,DATA_CONTRACT.schemas.Backup.version);assert.ok(downloaded.size>0);assert.equal(downloaded.workers.live,0);result.checks.downloadFallback=true;
  // Native file writes belong to the shared processor; keep their independent
  // user-activation and read-back verification checks alongside browser download.
  await page.evaluate(`(()=>{const button=document.createElement('button');button.id='native-save-probe';button.textContent='Native save QA';button.onclick=()=>{const handle=__PWA6.Exports.chooseSave('Native-QA.sdbackup',{'application/octet-stream':['.sdbackup']});window.nativeSave=handle.then(async target=>__PWA6.Exports.save(await __PWA6.BackupController.createCheckpoint(),target));};document.body.append(button);})()`);
  await page.click('#native-save-probe');await page.evaluate('nativeSave');assert.equal(await page.evaluate('pickerActivation'),true);
  const saved=await page.evaluate(`(async()=>{const file=await savedHandle.getFile(),candidate=await __PWA6.BackupController.inspect(file,{filename:file.name});return {size:file.size,preview:candidate.preview,workers:workerCounts}})()`);
  assert.equal(saved.preview.formatVersion,DATA_CONTRACT.schemas.Backup.version);assert.equal(saved.workers.live,0);result.checks.nativeSave=saved;
  const cancelled=await page.evaluate(`(async()=>{cancelPicker=true;const before=workerCounts.started;let cancelled=false;try{await __PWA6.Exports.chooseSave('Cancelled.sdbackup',{'application/octet-stream':['.sdbackup']});}catch(error){cancelled=error.name==='AbortError';}finally{cancelPicker=false;}return {cancelled,workers:workerCounts.started-before};})()`);
  assert.equal(cancelled.cancelled,true);assert.equal(cancelled.workers,0);result.checks.cancelledPicker=true;

  const notes=await page.evaluate(`(async()=>{
    const d=__PWA6,id='img-1234567890abcdefghijklmn',value='WG1:'+JSON.stringify({version:1,doc:{type:'Doc',content:[{type:'Paragraph',content:[{type:'Text',param:'Study notes',marks:{Strong:true}}]},{type:'SDImage',param:{assetId:id,alt:'Diagram',widthPct:100}}]}});
    const image=new Blob([new Uint8Array([137,80,78,71,13,10,26,10])],{type:'image/png'});await d.RichTextAssets.put(id,image);
    d.AppData.notes.update('History','History',value);await d.AppData.notes.flush();
    const exported=await d.NoteExporter.exportKeys(['History']),file=await savedHandle.getFile();
    const backup=await d.BackupController.createCheckpoint(),parsed=await d.BackupCodec.inspect(backup.blob,{filename:backup.filename});
    window.fixtureBackup=backup;
    return {exported,zipMagic:new DataView(await file.slice(0,4).arrayBuffer()).getUint32(0,true),backupImages:parsed.importedAssets.length,assetSize:parsed.importedAssets[0]?.blob.size,workers:workerCounts};
  })()`);
  assert.equal(notes.exported.status,'saved');assert.equal(notes.exported.assets,1);assert.equal(notes.zipMagic,0x04034b50);assert.equal(notes.backupImages,1);assert.equal(notes.assetSize,8);assert.equal(notes.workers.live,0);result.checks.notesAndImages=notes;
  const fallback=await page.evaluate(`(async()=>{window.showSaveFilePicker=undefined;const click=HTMLAnchorElement.prototype.click;window.downloads=[];HTMLAnchorElement.prototype.click=function(){downloads.push(this.download)};try{const result=await __PWA6.NoteExporter.exportKeys(['History']);return {result,downloads};}finally{HTMLAnchorElement.prototype.click=click;}})()`);
  assert.equal(fallback.result.status,'downloaded');assert.equal(fallback.downloads.length,1);result.checks.downloadFallback=true;
  const failed=await page.evaluate(`(async()=>{failWorker=true;try{await __PWA6.BackupController.createCheckpoint();return false;}catch(error){return /startup failure/.test(error.message);}finally{failWorker=false;}})()`);assert.equal(failed,true);
  const cancellation=await page.evaluate(`(async()=>{holdWorker=true;const pending=__PWA6.NoteExporter.exportKeys(['History']);await new Promise(resolve=>setTimeout(resolve,50));__PWA6.Exports.cancel();const result=await pending;holdWorker=false;return {result,live:workerCounts.live};})()`);assert.equal(cancellation.result.status,'cancelled');assert.equal(cancellation.live,0);result.checks.workerFailureCancellation=true;
  const open=await page.evaluate(`(async()=>{window.showOpenFilePicker=async()=>[{getFile:async()=>new File([fixtureBackup.blob],fixtureBackup.filename)}];const file=await __PWA6.Exports.open(document.getElementById('import-file'));return (await __PWA6.BackupController.inspect(file,{filename:file.name})).preview.formatVersion;})()`);assert.equal(open,DATA_CONTRACT.schemas.Backup.version);result.checks.openPreview=true;

  const restored=await page.evaluate(`(async()=>{
    const d=__PWA6,original=d.AppData.notes.get('History').text;await d.AppData.notes.remove('History');await d.AppData.notes.flush();
    window.restoreChoices=chooseIncomingBackup;
    const click=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){};
    try{const candidate=await d.BackupController.inspect(fixtureBackup.blob,{filename:fixtureBackup.filename}),outcome=await d.BackupController.restore(candidate);return {restored:d.AppData.notes.get('History').text===original,outcome,workersRemaining:workerCounts.live};}
    finally{HTMLAnchorElement.prototype.click=click;delete window.restoreChoices;}
  })()`);
  assert.equal(restored.restored,true);assert.equal(restored.workersRemaining,0);result.checks.repositoryRestore=restored;
  const safety=await page.evaluate(`(async()=>{
    const d=__PWA6,before=d.AppData.notes.get('History').text,bytes=new Uint8Array(await fixtureBackup.blob.arrayBuffer());bytes[bytes.length-1]^=1;let rejected=false;
    try{await d.BackupController.inspect(new Blob([bytes]),{filename:'corrupt.sdbackup'});}catch(error){rejected=/integrity/.test(error.message);}
    const unchanged=d.AppData.notes.get('History').text===before;
    const legacy=new Blob([JSON.stringify({version:6,records:[],areaNotes:{History:{...d.AppData.notes.get('History'),text:'Legacy plain note',syncStatus:'synced'}}})],{type:'application/json'});
    await d.AppData.notes.remove('History');await d.AppData.notes.flush();const candidate=await d.BackupController.inspect(legacy,{filename:'legacy.json'});window.restoreChoices=chooseIncomingBackup;
    const click=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){};
    try{await d.BackupController.restore(candidate);return {rejected,unchanged,legacy:candidate.preview.legacy,legacyRestored:d.AppData.notes.get('History').text==='Legacy plain note',workersRemaining:workerCounts.live};}finally{HTMLAnchorElement.prototype.click=click;delete window.restoreChoices;}
  })()`);assert.equal(safety.rejected,true);assert.equal(safety.unchanged,true);assert.equal(safety.legacy,true);assert.equal(safety.legacyRestored,true);assert.equal(safety.workersRemaining,0);result.checks.corruptAndLegacyRestore=safety;
  const parity=await page.evaluate(`(async()=>{
    const api=StudyDirectorRichText,values=['plain \u03b1 ** text','WG1:'+JSON.stringify({version:1,doc:{type:'Doc',content:[{type:'Heading',param:2,content:[{type:'Text',param:'Title'}]},{type:'Blockquote',content:[{type:'Paragraph',content:[{type:'Text',param:'Quoted',marks:{Emphasis:true}}]}]}]}})];
    return await __PWA6.Exports.job(async()=>{for(const value of values){const {doc,text}=api.exportDocument(value),actual=await __PWA6.Exports.run('markdown',{doc,text,paths:{}});if(actual!==api.toMarkdown(value))return false;}return true;});
  })()`);assert.equal(parity,true);result.checks.sharedMarkdownParity=true;

  const responsiveness=await page.evaluate(`(async()=>{
    const d=__PWA6,data=new Blob([new Uint8Array(24*1024*1024)],{type:'image/png'});let ticks=0,maxGap=0,last=performance.now();const timer=setInterval(()=>{const now=performance.now();maxGap=Math.max(maxGap,now-last);last=now;ticks++;},8),start=performance.now();
    try{await d.Exports.job(()=>d.Exports.run('zip',{files:[{name:'large.png',blob:data}],date:new Date().toISOString()}));}finally{clearInterval(timer);}
    return {bytes:data.size,milliseconds:performance.now()-start,ticks,maxGap,workersRemaining:workerCounts.live};
  })()`);
  assert.ok(responsiveness.ticks>0,'UI tasks must run during worker packaging');assert.equal(responsiveness.workersRemaining,0);result.checks.responsiveness=responsiveness;
  const errors=page.events.filter(event=>!/favicon|ResizeObserver loop/i.test(event.text||''));assert.deepEqual(errors,[]);
}finally{await browser.close();await server.close();}
writeArtifact('browser-exports.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
