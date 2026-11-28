import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {startReleaseServer,launchChromium,waitFor,sleep,CdpPage} from '../../helpers/browser-harness.mjs';
import {open} from '../../helpers/drive-browser.mjs';

// Ctrl+C on a note image copied "[Image]", not the picture (owner,
// 2026-11-28): the editor's copy holds an image by its stored id only. Now the
// clipboard gets the picture too: a lone image as a PNG and in the HTML, and
// text with images as HTML with the pictures in it. A paste back into a note
// still reads the stored image, with its size, as the note wrote it.
const fixtureDir=fs.mkdtempSync(path.join(os.tmpdir(),'qa-image-copy-'));
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
const imageFile=path.join(fixtureDir,'picture.png');fs.writeFileSync(imageFile,png);
const server=await startReleaseServer(),browser=await launchChromium({profilePrefix:'sd-image-copy-'});
const editable='#library-notes-editor .sd-rte-wordgard [contenteditable="true"]';
const key=async(page,key,code,keyCode,commands)=>{await page.send('Input.dispatchKeyEvent',{type:'rawKeyDown',key,code,windowsVirtualKeyCode:keyCode,modifiers:2,commands});await page.send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:keyCode,modifiers:2});};
// What the clipboard holds: each type, the text ones as text.
const clipboard=page=>page.evaluate(`(async()=>{const out={};for(const item of await navigator.clipboard.read())for(const type of item.types){const blob=await item.getType(type);out[type]=type.startsWith('text/')?await blob.text():blob.size;}return out;})()`);
async function newNote(page,name){
  await page.evaluate(`document.getElementById('library-note-add').click()`);
  await waitFor(()=>page.evaluate(`!!document.getElementById('sd-interaction-dialog')?.open`),{label:`the New note dialog for ${name}`});
  await page.evaluate(`(()=>{const dialog=document.getElementById('sd-interaction-dialog');dialog.querySelector('.note-place-change')?.click();setTimeout(()=>{dialog.querySelector('.note-place-option[data-key=""]')?.click();const field=dialog.querySelector('.interaction-input');field.value=${JSON.stringify(name)};field.dispatchEvent(new Event('input',{bubbles:true}));dialog.querySelector('.interaction-actions .primary').click();},50);})()`);
  await waitFor(()=>page.evaluate(`!document.getElementById('sd-interaction-dialog')?.open&&document.querySelector('#library-notes-editor .library-notes-editor-title')?.textContent.trim()===${JSON.stringify(name)}&&!!document.querySelector(${JSON.stringify(editable)})`),{label:`${name} opens`});
}
try{
  const page=await open(browser,server,'A');
  await page.send('Page.setInterceptFileChooserDialog',{enabled:true});
  // Reading the clipboard back needs the browser's permission.
  const info=await (await fetch(`http://127.0.0.1:${browser.port}/json/version`)).json(),root=await CdpPage.connect(info.webSocketDebuggerUrl,'browser');
  await root.send('Browser.grantPermissions',{origin:new URL(server.url('deployment','instrumented.html')).origin,permissions:['clipboardReadWrite','clipboardSanitizedWrite']});
  await page.evaluate(`(async()=>{await __PWA6.goTab('library');__PWA6.LibraryView.showSection('notes');})()`);
  await waitFor(()=>page.evaluate(`!!document.getElementById('library-note-add')&&!document.getElementById('library-note-add').disabled`),{label:'Notes open'});
  await newNote(page,'Pictures');
  await page.click(editable);await page.send('Input.insertText',{text:'Words before the picture'});
  await page.evaluate(`(()=>{const input=document.querySelector('#library-notes-editor .sd-rte-asset-input');input.showPicker=()=>{};input.click=()=>{};})()`);
  await page.click('#library-notes-editor .sd-rte-attachment-trigger');await page.click('#library-notes-editor button[aria-label="Insert image"]');
  const documentNode=await page.send('DOM.getDocument',{depth:-1,pierce:true}),input=await page.send('DOM.querySelector',{nodeId:documentNode.root.nodeId,selector:'#library-notes-editor .sd-rte-asset-input'});
  await page.send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[imageFile]});
  await waitFor(()=>page.evaluate(`!!document.querySelector('#library-notes-editor .sd-rte-image img')&&/"type":"SDImage"/u.test(__PWA6.AppData.notes.get('pictures')?.text||'')`),{label:'the picture is in the note'});
  const stored=await page.evaluate(`(()=>{const ids=StudyDirectorRichText.assetIds(__PWA6.AppData.notes.get('pictures').text);return {ids,width:JSON.parse(__PWA6.AppData.notes.get('pictures').text.slice(4)).doc.content.flatMap(node=>node.type==='SDImage'?[node]:node.content||[]).find(node=>node.type==='SDImage')?.param?.widthPct??null};})()`);
  assert.equal(stored.ids.length,1,'one stored picture');
  const asset=stored.ids[0];

  // The picture alone: as a PNG, and in the HTML with the note's markers.
  await page.click('#library-notes-editor .sd-rte-image img');await sleep(200);
  await key(page,'c','KeyC',67,['copy']);
  await waitFor(async()=>!!(await clipboard(page))['image/png'],{label:'the picture goes on the clipboard as a PNG',timeout:10000});
  const lone=await clipboard(page);
  assert.ok(lone['image/png']>0,'a PNG of the picture');
  assert.match(lone['text/html'],/<img [^>]*src="data:image\/png;base64,/u,'the HTML holds the picture itself');
  assert.match(lone['text/html'],new RegExp(`data-sd-asset-id="${asset}"`,'u'),'and the note’s own marker for it');
  assert.doesNotMatch(lone['text/html'],/Loading image|<button/u,'without the editor’s placeholder or controls');

  // Text with the picture in it: HTML with both; no PNG for a mixed copy.
  await page.click(editable);await key(page,'a','KeyA',65,['selectAll']);await sleep(150);
  await key(page,'c','KeyC',67,['copy']);
  await waitFor(async()=>{const now=await clipboard(page);return /Words before the picture/u.test(now['text/html']||'')&&/data:image\/png/u.test(now['text/html']||'');},{label:'text and picture copied together',timeout:10000});
  const mixed=await clipboard(page);
  assert.equal(mixed['image/png'],undefined,'a copy of text and pictures is HTML, not one image');
  assert.match(mixed['text/plain'],/Words before the picture/u,'the plain text keeps the words');

  // Pasted into another note (Ctrl+V): the same stored picture, as the note
  // wrote it. Before, a note's copy of an image pasted as "Loading image…".
  const storedImages=()=>page.evaluate(`__PWA6.RichTextAssets.keys().then(keys=>keys.length)`),before=await storedImages();
  await newNote(page,'Copy target');
  await page.click(editable);await key(page,'v','KeyV',86,['paste']);
  await waitFor(()=>page.evaluate(`/"type":"SDImage"/u.test(__PWA6.AppData.notes.get('copy target')?.text||'')`),{label:'the paste brings the picture',timeout:10000});
  const pasted=await page.evaluate(`(()=>{const text=__PWA6.AppData.notes.get('copy target').text,image=JSON.parse(text.slice(4)).doc.content.find(node=>node.type==='SDImage');return {ids:StudyDirectorRichText.assetIds(text),words:/Words before the picture/u.test(text),loading:/Loading image/u.test(text),width:image?.param?.widthPct??null};})()`);
  assert.deepEqual(pasted,{ids:[asset],words:true,loading:false,width:stored.width},'the paste reads the stored picture by its id, at its size, with the words');
  assert.equal(await storedImages(),before,'and stores no second copy of it');
  await waitFor(()=>page.evaluate(`!!document.querySelector('#library-notes-editor .sd-rte-image img')`),{label:'the pasted picture shows'});
  console.log(JSON.stringify({status:'PASS',suite:'image-copy',checks:['a lone picture copies as a PNG and HTML','text with a picture copies as HTML with the picture','a paste back into a note reads the stored picture']}));
}finally{await browser.close();await server.close();}
