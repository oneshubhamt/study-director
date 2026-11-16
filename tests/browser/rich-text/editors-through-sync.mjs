import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitForStudyDirector,waitFor} from '../../helpers/browser-harness.mjs';

// A sync that brings in changes runs a session lifecycle step while the person
// types. Each editor (a Library note, today's reflection, the Execute note)
// stays mounted through it, keeps the cursor and takes the next keystrokes;
// none shows its raw stored text. Before 2026-11-16 the Library note was put
// away and its raw stored text stayed on screen, dead to clicks, and the
// reflection was rebuilt (cursor lost) or showed its raw text over the new
// editor. Today's reflection with no study session also mounts once loaded,
// not at the next pane switch.
const preload=`(()=>{localStorage.setItem('studyDirector.userDefaults.v1',JSON.stringify({version:1,studentName:'Editors QA',updatedAt:new Date().toISOString()}));})()`;
const server=await startReleaseServer();
const browser=await launchChromium({profilePrefix:'qa-editors-sync-'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const checks=[];
try{
  const page=await browser.createPage(server.url('deployment','instrumented.html'),{preload});
  await waitForStudyDirector(page,{instrumented:true});
  await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().state==='primary'&&__PWA6.SessionLifecycle.status().ready`),{label:'primary ownership'});
  const editable=surface=>`.pane.on .sd-rte[data-sd-rich-surface="${surface}"] [contenteditable="true"]`;
  const mounted=(surface,label)=>waitFor(()=>page.evaluate(`!!document.querySelector(${JSON.stringify(editable(surface))})`),{label});
  // What is on screen: the editor's surface, any textarea showing raw stored
  // text, and where the cursor is.
  const view=()=>page.evaluate(`(()=>({editors:[...document.querySelectorAll('.pane.on .sd-rte:not(.sd-rte-dormant-shell)')].map(node=>node.dataset.sdRichSurface),raw:[...document.querySelectorAll('.pane.on textarea')].filter(field=>getComputedStyle(field).display!=='none'&&/^WG1:/u.test(field.value)).map(field=>field.id||field.className),focused:!!document.activeElement?.closest?.('.sd-rte')}))()`);
  const syncStep=()=>page.evaluate(`(async()=>{const d=__PWA6;await d.SessionLifecycle.run('reconciled-notes',{date:d.todayISO()},async()=>{await new Promise(resolve=>setTimeout(resolve,50));});})()`);
  const throughStep=async(surface,label)=>{
    assert.deepEqual(await view(),{editors:[surface],raw:[],focused:true},`${label}: typing before the sync`);
    await syncStep();
    for(const ms of [0,300,1200]){await sleep(ms);assert.deepEqual(await view(),{editors:[surface],raw:[],focused:true},`${label}: ${ms} ms after the sync the same editor has the cursor`);}
  };

  // Library note.
  await page.evaluate(`(async()=>{const d=__PWA6;d.AppData.notes.update('gs2','GS2','first line','');await d.AppData.notes.flush();d.goTab('library');d.LibraryView.showSection('notes');})()`);
  await sleep(400);
  await page.evaluate(`[...document.querySelectorAll('#library-notes-list [data-note-key]')].find(row=>row.dataset.noteKey==='gs2').click()`);
  await mounted('note','Library note editor');
  await page.click(editable('note'));await page.send('Input.insertText',{text:' typed'});await sleep(1000);
  const field=await page.evaluate(`(window.__noteField=document.querySelector('#library-notes-editor textarea'),true)`);assert.ok(field);
  await throughStep('note','Library note');
  assert.equal(await page.evaluate(`document.querySelector('#library-notes-editor textarea')===window.__noteField&&window.__noteField.dataset.noteBinding==='area-v2'`),true,'the note keeps its editor and stays bound');
  await page.send('Input.insertText',{text:' after'});await sleep(900);
  assert.match(await page.evaluate(`String(__PWA6.AppData.notes.get('gs2').text)`),/typed after/u,'typing after the sync reaches the note');
  checks.push('Library note: editor, cursor and typing kept through a sync');
  // Put away (as after 90 s in the background): the textarea holding the raw
  // stored text stays hidden behind the read-only preview.
  await page.evaluate(`(async()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});await __PWA6.RichTextRuntime.close();})()`);
  await sleep(300);
  assert.deepEqual((await view()).raw,[],'a put-away note never shows its raw stored text');
  await page.evaluate(`(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));})()`);
  await mounted('note','Library note editor back');
  checks.push('Library note: a put-away editor never shows raw stored text');

  // Today's reflection, no study session: mounts once loaded, no pane switch.
  await page.evaluate(`__PWA6.goTab('review')`);
  await mounted('reflection','reflection editor without a pane switch');
  await page.click(editable('reflection'));await page.send('Input.insertText',{text:'reflect'});await sleep(1000);
  await throughStep('reflection','Reflection');
  await page.send('Input.insertText',{text:' more'});await sleep(1000);
  assert.match(await page.evaluate(`String(__PWA6.ReviewEditor.contentForDate(__PWA6.todayISO()))`),/reflect more/u,'typing after the sync reaches the reflection');
  assert.equal(await page.evaluate(`document.getElementById('daily-reflection').dataset.richSyncStatus`),'Saved','the reflection is not left labelled read-only');
  checks.push('Reflection: mounts once loaded; editor, cursor and typing kept through a sync');

  // Execute's note for the running block.
  await page.evaluate(`(async()=>{const d=__PWA6,now=new Date(),minute=now.getHours()*60+now.getMinutes()-1,start=String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0');document.getElementById('plan-input').value=start+' | 30 | GS2 Task | work | GS2 | pages | 10';await d.applySchedule({skipNotify:true});d.goTab('execute');})()`);
  await mounted('execute-note','Execute note editor');
  await page.click(editable('execute-note'));await page.send('Input.insertText',{text:' exec'});await sleep(1000);
  await throughStep('execute-note','Execute note');
  await page.send('Input.insertText',{text:' later'});await sleep(1000);
  assert.match(await page.evaluate(`String(__PWA6.AppData.notes.get('gs2').text)`),/exec later/u,'typing after the sync reaches the Execute note');
  checks.push('Execute note: editor, cursor and typing kept through a sync');
  console.log(JSON.stringify({status:'PASS',suite:'editors-through-sync',checks},null,2));
}finally{await browser.close();await server.close();}
