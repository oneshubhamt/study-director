import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitFor} from '../../helpers/browser-harness.mjs';
import {open,sleep} from '../../helpers/drive-browser.mjs';

// A note just made, then written in (owner, 2026-11-28). Its header, with the
// ⋯ menu and the line under the title, was drawn while the note was empty, and
// the first words do not redraw it (the editor stays as it is). The ⋯ menu
// kept "Nothing written yet", so Print and Export stayed off, and the line
// kept "Empty". Right-click was right: it reads the list as it stands.
const server=await startReleaseServer(),browser=await launchChromium({profilePrefix:'sd-new-note-'});
const menuItem=(page,id)=>page.evaluate(`(()=>{const item=document.getElementById(${JSON.stringify(id)});return item?{disabled:item.disabled,hint:item.querySelector('.library-note-menu-hint')?.textContent||''}:null;})()`);
try{
  const page=await open(browser,server,'A');
  await page.evaluate(`(async()=>{await __PWA6.goTab('library');__PWA6.LibraryView.showSection('notes');})()`);
  await waitFor(()=>page.evaluate(`!!document.getElementById('library-note-add')&&!document.getElementById('library-note-add').disabled`),{label:'Notes open'});
  await page.evaluate(`document.getElementById('library-note-add').click()`);
  await waitFor(()=>page.evaluate(`!!document.getElementById('sd-interaction-dialog')?.open`),{label:'the New note dialog'});
  await page.evaluate(`(()=>{const dialog=document.getElementById('sd-interaction-dialog'),field=dialog.querySelector('.interaction-input');field.value='Fresh note';field.dispatchEvent(new Event('input',{bubbles:true}));dialog.querySelector('.interaction-actions .primary').click();})()`);
  const editable='#library-notes-editor .sd-rte-wordgard [contenteditable]';
  await waitFor(()=>page.evaluate(`!document.getElementById('sd-interaction-dialog')?.open&&!!document.querySelector(${JSON.stringify(editable)})&&!!document.getElementById('library-note-actions')`),{label:'the new note opens'});
  const before=await page.evaluate(`document.querySelector('.library-notes-editor-meta').textContent`);
  assert.match(before,/Not written yet/u,'a new note starts unwritten');
  await page.click(editable);
  await page.send('Input.insertText',{text:'First words in the note'});
  await waitFor(()=>page.evaluate(`/First words/u.test(__PWA6.AppData.notes.get('fresh note')?.text||'')`),{label:'the words are saved'});
  await sleep(300);
  const meta=await page.evaluate(`document.querySelector('.library-notes-editor-meta').textContent`);
  assert.doesNotMatch(meta,/Empty|Not written/u,`the line under the title follows the words (${meta})`);
  await page.evaluate(`document.getElementById('library-note-actions').click()`);
  await waitFor(()=>page.evaluate(`!!document.getElementById('library-note-print')`),{label:'the ⋯ menu opens'});
  for(const id of ['library-note-print','library-note-export-one','library-note-versions'])assert.deepEqual(await menuItem(page,id),{disabled:false,hint:''},`${id} is offered for the written note`);
  const printed=await page.evaluate(`(async()=>{let seen=null;const realPrint=window.print;window.print=()=>{const sheet=document.querySelector('.note-print');seen={title:sheet?.querySelector('h1')?.textContent||'',text:/First words/u.test(sheet?.innerText||'')};};
    document.getElementById('library-note-print').click();for(let i=0;i<60&&!seen;i++)await new Promise(r=>setTimeout(r,50));
    window.dispatchEvent(new Event('afterprint'));window.print=realPrint;return seen;})()`);
  assert.deepEqual(printed,{title:'Fresh note',text:true},'Print… prints the new note');
  console.log(JSON.stringify({status:'PASS',suite:'new-note-actions',checks:['top line follows the first words','⋯ offers Print, Export and Earlier versions','Print prints it']}));
}finally{await browser.close();await server.close();}
