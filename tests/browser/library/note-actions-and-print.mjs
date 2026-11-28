import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitFor} from '../../helpers/browser-harness.mjs';
import {open,sleep} from '../../helpers/drive-browser.mjs';

// A note just made, then written in (owner, 2026-11-28). Its header, with the
// ⋯ menu and the line under the title, was drawn while the note was empty, and
// the first words do not redraw it (the editor stays as it is). The ⋯ menu
// kept "Nothing written yet", so Print and Export stayed off, and the line
// kept "Empty". Right-click was right: it reads the list as it stands.
// A long note prints over as many pages as it needs (owner, 2026-11-28: the
// app's screen-height page clipped it to one), and Save as PDF in the print
// dialog names the PDF after the note.
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
  assert.equal(await page.evaluate(`document.getElementById('library-note-print').firstChild.textContent`),'Print or save as PDF…');
  const appTitle=await page.evaluate(`document.title`);
  const printed=await page.evaluate(`(async()=>{let seen=null;const realPrint=window.print;window.print=()=>{const sheet=document.querySelector('.note-print');seen={title:sheet?.querySelector('h1')?.textContent||'',text:/First words/u.test(sheet?.innerText||''),pdfName:document.title};};
    document.getElementById('library-note-print').click();for(let i=0;i<60&&!seen;i++)await new Promise(r=>setTimeout(r,50));
    window.dispatchEvent(new Event('afterprint'));window.print=realPrint;return seen;})()`);
  assert.deepEqual(printed,{title:'Fresh note',text:true,pdfName:'Fresh note'},'Print… prints the new note, and Save as PDF names it after the note');
  assert.equal(await page.evaluate(`document.title`),appTitle,'the page’s title comes back after printing');

  // A long note: its print runs past the first page.
  const long=Array.from({length:300},(_,index)=>`Paragraph ${index+1}: a line long enough to wrap once on a printed page, about deposits, withdrawals and the dates they were made.`).join('\n\n');
  const updated=await page.evaluate(`(async()=>{const notes=__PWA6.AppData.notes;const result=notes.update('long note','Long note',${JSON.stringify(long)},'');await notes.flush({strict:true});return JSON.stringify(result);})()`);
  assert.equal(JSON.parse(updated).status,'changed');
  await page.evaluate(`(async()=>{await __PWA6.goTab('plan');await __PWA6.goTab('library');__PWA6.LibraryView.showSection('notes');})()`);
  await waitFor(()=>page.evaluate(`(()=>{const row=[...document.querySelectorAll('[data-note-key]')].find(item=>item.dataset.noteKey==='long note');if(row)row.click();return document.querySelector('#library-notes-editor .library-notes-editor-title')?.textContent.trim()==='Long note';})()`),{label:'the long note opens'});
  await page.evaluate(`(()=>{window.__printing=false;window.__realPrint=window.print;window.print=()=>{window.__printing=true;};document.getElementById('library-note-actions').click();})()`);
  await waitFor(()=>page.evaluate(`!!document.getElementById('library-note-print')&&!document.getElementById('library-note-print').disabled`),{label:'Print… offered'});
  await page.evaluate(`document.getElementById('library-note-print').click()`);
  await waitFor(()=>page.evaluate(`window.__printing`),{label:'the long note goes to print'});
  await page.send('Emulation.setEmulatedMedia',{media:'print'});
  assert.equal(await page.evaluate(`getComputedStyle(document.querySelector('.note-print h1')).breakAfter`),'avoid','a heading stays with what follows it');
  await page.send('Emulation.setEmulatedMedia',{media:''});
  const pdf=Buffer.from((await page.send('Page.printToPDF',{printBackground:false})).data,'base64').toString('latin1');
  await page.evaluate(`(()=>{window.dispatchEvent(new Event('afterprint'));window.print=window.__realPrint;})()`);
  const pages=(pdf.match(/\/Type\s*\/Page[^s]/gu)||[]).length;
  assert.ok(pages>=3,`the long note prints over several pages (${pages})`);
  console.log(JSON.stringify({status:'PASS',suite:'note-actions-and-print',checks:['top line follows the first words','⋯ offers Print, Export and Earlier versions','Print prints it, PDF named after the note','headings keep with what follows',`a long note prints over ${pages} pages`]}));
}finally{await browser.close();await server.close();}
