import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitForStudyDirector,waitFor} from '../../helpers/browser-harness.mjs';

// In a real browser, Copy diagnostics measures this site's storage part by
// part: the database, file storage by folder (a folder the app does not know
// shows up as other) and cached files, with the gap to the browser's figure.
// The database record notes this start and the store counts.
const preload=`(()=>{localStorage.getItem('studyDirector.profiles.v1')||localStorage.setItem('studyDirector.profiles.v1',JSON.stringify({version:1,active:'prof_qa_mve00000_abcdef01',profiles:[{id:'prof_qa_mve00000_abcdef01',scope:'',name:'QA',createdAt:'2026-01-01T00:00:00.000Z'}]}));})()`;
const server=await startReleaseServer(),browser=await launchChromium({profilePrefix:'sd-storage-census-'});
try{
  const page=await browser.createPage(server.url('deployment','instrumented.html'),{preload});
  await waitForStudyDirector(page,{instrumented:true});
  await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().hasControl`),{label:'ownership'});
  // A stray folder in file storage, as an older release might have left.
  await page.evaluate(`(async()=>{const root=await navigator.storage.getDirectory(),dir=await root.getDirectoryHandle('left-by-an-older-release',{create:true}),file=await dir.getFileHandle('blob',{create:true}),w=await file.createWritable();await w.write(new Uint8Array(4096));await w.close();})()`);
  await waitFor(()=>page.evaluate(`!!__PWA6.DatabaseLifecycle.snapshot().current?.countedAt`),{label:'database record counted'});
  const rows=await page.evaluate(`(async()=>JSON.parse(JSON.stringify(await __PWA6.readDataDiagnosticStates())))()`);
  const row=job=>rows.find(entry=>entry.job===job);
  const census=row('Storage census'),files=row('Storage census files'),database=row('Storage census database'),caches=row('Storage census caches'),start=row('Database this start');
  assert.ok(census&&['observed','partial'].includes(census.state),`the census ran: ${JSON.stringify(census)}`);
  assert.ok(Number.isFinite(census.usageBytes)&&Number.isFinite(census.measuredBytes),'the browser figure and the measured total are both shown');
  assert.equal(files.state,'observed');assert.ok(files.otherEntries>=1&&files.otherFileBytes>=4096,`an unknown folder is counted as other: ${JSON.stringify(files)}`);
  assert.equal(database.state,'observed');assert.ok(database.records>=1&&database.metaRecords>=1,`database records are counted: ${JSON.stringify(database)}`);
  assert.ok(caches&&['observed','partial','unavailable'].includes(caches.state));
  if(census.state==='observed')assert.ok(Number.isFinite(census.unexplainedBytes),'a complete census shows the gap');
  assert.ok(start&&['existing','fresh'].includes(start.state)&&start.records>=1&&start.openedVersion>0,`this start is recorded: ${JSON.stringify(start)}`);
  assert.doesNotMatch(JSON.stringify(rows),/left-by-an-older-release/u,'folder names never reach diagnostics');
  assert.deepEqual(page.warnings.filter(text=>/\[Study Director\]/u.test(text)),[]);
  console.log(JSON.stringify({status:'PASS',suite:'storage-census',censusState:census.state,tookMs:census.tookMs}));
}finally{await browser.close();await server.close();}
