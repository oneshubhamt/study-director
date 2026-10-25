import assert from 'node:assert/strict';
import fs from 'node:fs';
import {launchChromium,waitFor} from '../../helpers/browser-harness.mjs';
import {richTextRuntimeSource} from '../../helpers/rich-text-runtime.mjs';

const bundle=richTextRuntimeSource();
const browser=await launchChromium({profilePrefix:'qa-link-context-'});let page;
const selectTextByPointer=async(selector,start,end,expected)=>{const points=await page.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),t=e.firstChild,r=document.createRange();r.setStart(t,${start});r.setEnd(t,${end});const a=document.createRange(),b=document.createRange();a.setStart(t,${start});a.setEnd(t,${start+1});b.setStart(t,${end-1});b.setEnd(t,${end});const x=a.getBoundingClientRect(),y=b.getBoundingClientRect();return {sx:x.left+1,sy:x.top+x.height/2,ex:y.right-1,ey:y.top+y.height/2}})()`);await page.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:points.sx,y:points.sy});await page.send('Input.dispatchMouseEvent',{type:'mousePressed',x:points.sx,y:points.sy,button:'left',buttons:1,clickCount:1});await page.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:points.ex,y:points.ey,button:'left',buttons:1});await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:points.ex,y:points.ey,button:'left',buttons:0,clickCount:1});await waitFor(()=>page.evaluate(`getSelection().toString()===${JSON.stringify(expected)}`),{timeout:3000,label:`pointer selection ${expected}`})};
try{
  page=await browser.createPage('about:blank',{viewport:{width:900,height:700}});
  await page.evaluate(bundle,{returnByValue:false});
  await page.evaluate(`(async()=>{
    document.body.innerHTML='<main style="margin:20px;width:620px"><textarea id="note">Alpha Bravo</textarea><button id="outside">Outside</button></main>';
    window.openCalls=[];window.open=(...args)=>{openCalls.push(args);return null};
    window.mount=await StudyDirectorRichText.mountRichTextEditor({field:note,label:'Link editor',initialValue:note.value,maxWords:10000,maxBytes:917504,assets:{get:async()=>null,put:async()=>{},remove:async()=>{}}});
  })()`);

  // Existing selected-text path remains functional.
  await selectTextByPointer('.sd-rte-editor p',0,5,'Alpha');
  await page.click('button[aria-label="Link"]');
  await waitFor(()=>page.evaluate(`document.activeElement?.getAttribute('aria-label')==='Link destination'`),{timeout:3000,label:'selected-text link editor'});
  await page.evaluate(`document.querySelector('input[aria-label="Link destination"]').value='example.com'`);
  await page.click('button[aria-label="Apply link"]');
  await waitFor(()=>page.evaluate(`document.querySelector('.sd-rte-editor a')?.getAttribute('href')==='https://example.com/'`),{timeout:3000,label:'selected text linked'});

  // Normal click becomes contextual controls and must not navigate.
  await page.click('.sd-rte-editor a');
  assert.equal(await page.evaluate('openCalls.length'),0,'Normal link click must not open immediately.');
  await waitFor(()=>page.evaluate(`!document.querySelector('.sd-rte-link-menu')?.hidden && !!document.querySelector('button[aria-label="Open link"]')`),{timeout:3000,label:'contextual link actions'});
  assert.deepEqual(await page.evaluate(`['Open link','Edit link','Remove link'].map(a=>!!document.querySelector('button[aria-label="'+a+'"]'))`),[true,true,true]);
  const actionMenuWidth=await page.evaluate(`document.querySelector('.sd-rte-link-menu').getBoundingClientRect().width`);
  assert.ok(actionMenuWidth<=190,`Existing-link action popover should hug its controls (width ${actionMenuWidth}px).`);
  assert.equal(await page.evaluate(`document.querySelector('.sd-rte-link-menu').classList.contains('sd-rte-link-actions-menu')`),true,'Existing-link action state should use the compact shell.');

  // Edit operates on the entire clicked link without selecting its text first.
  await page.click('button[aria-label="Edit link"]');
  await waitFor(()=>page.evaluate(`document.activeElement?.getAttribute('aria-label')==='Link destination'`),{timeout:3000,label:'contextual edit input'});
  assert.equal(await page.evaluate(`document.querySelector('.sd-rte-link-menu').classList.contains('sd-rte-link-actions-menu')`),false,'Edit mode must restore the normal URL-editor layout.');
  assert.equal(await page.evaluate(`document.querySelector('input[aria-label="Link destination"]').value`),'https://example.com/');
  await page.evaluate(`document.querySelector('input[aria-label="Link destination"]').value='https://example.org/new'`);
  await page.click('button[aria-label="Apply link"]');
  assert.equal(await page.evaluate(`document.querySelector('.sd-rte-editor a')?.getAttribute('href')`),'https://example.org/new');
  assert.equal(await page.evaluate(`document.querySelector('.sd-rte-editor a')?.textContent`),'Alpha');

  // Escape from Edit is non-mutating.
  await page.click('.sd-rte-editor a');await page.click('button[aria-label="Edit link"]');
  await page.evaluate(`document.querySelector('input[aria-label="Link destination"]').value='https://should-not-apply.test/'`);
  await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});
  await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});
  await waitFor(()=>page.evaluate(`document.querySelector('.sd-rte-link-menu')?.hidden===true`),{timeout:3000,label:'Escape closes link editor'});
  assert.equal(await page.evaluate(`document.querySelector('.sd-rte-editor a')?.getAttribute('href')`),'https://example.org/new');

  // Remove preserves visible text.
  await page.click('.sd-rte-editor a');await page.click('button[aria-label="Remove link"]');
  assert.equal(await page.evaluate(`document.querySelector('.sd-rte-editor a')`),null);
  assert.equal(await page.evaluate(`document.querySelector('.sd-rte-editor p')?.textContent`),'Alpha Bravo');

  // Empty caret insertion is visible and anchored near editor content, not the toolbar.
  await page.evaluate(`document.querySelector('.sd-rte-editor').style.paddingTop='180px'`);
  await page.click('.sd-rte-editor p');
  await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'End',code:'End',windowsVirtualKeyCode:35,nativeVirtualKeyCode:35});
  await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'End',code:'End',windowsVirtualKeyCode:35,nativeVirtualKeyCode:35});
  await page.click('button[aria-label="Link"]');
  await waitFor(()=>page.evaluate(`document.activeElement?.getAttribute('aria-label')==='Link destination'`),{timeout:3000,label:'caret link editor'});
  const proximity=await page.evaluate(`(()=>{const p=document.querySelector('.sd-rte-editor p').getBoundingClientRect(),m=document.querySelector('.sd-rte-link-menu').getBoundingClientRect(),t=document.querySelector('button[aria-label="Link"]').getBoundingClientRect();const cy=(m.top+m.bottom)/2,py=(p.top+p.bottom)/2,ty=(t.top+t.bottom)/2;return {toText:Math.abs(cy-py),toToolbar:Math.abs(cy-ty)}})()`);
  assert.ok(proximity.toText<proximity.toToolbar,`Link editor must be contextually closer to caret/text than toolbar: ${JSON.stringify(proximity)}`);
  await page.evaluate(`document.querySelector('input[aria-label="Link destination"]').value='example.net/path'`);
  await page.click('button[aria-label="Apply link"]');
  await waitFor(()=>page.evaluate(`!!document.querySelector('.sd-rte-editor a[href="https://example.net/path"]')`),{timeout:3000,label:'caret URL inserted'});
  await page.send('Input.insertText',{text:' X'});await page.settle();
  assert.equal(await page.evaluate(`document.querySelector('.sd-rte-editor a[href="https://example.net/path"]')?.textContent`),'example.net/path');

  // Explicit Open and modifier click are the only direct-open paths.
  const anchor='.sd-rte-editor a[href="https://example.net/path"]';
  await page.click(anchor);await page.click('button[aria-label="Open link"]');
  assert.equal(await page.evaluate('openCalls.length'),1,'Open action must explicitly navigate.');
  const pt=await page.evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(anchor)}).getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
  await page.send('Input.dispatchMouseEvent',{type:'mousePressed',x:pt.x,y:pt.y,button:'left',buttons:1,clickCount:1,modifiers:2});
  await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:pt.x,y:pt.y,button:'left',buttons:0,clickCount:1,modifiers:2});
  await waitFor(()=>page.evaluate('openCalls.length===2'),{timeout:3000,label:'Ctrl-click direct open'});
  assert.equal(await page.evaluate(`document.querySelector('.sd-rte-link-menu')?.hidden`),true,'Modifier direct-open must not leave the contextual menu open.');

  assert.deepEqual(page.events,[],'Contextual link workflow must not emit browser/runtime errors.');
  console.log(JSON.stringify({status:'PASS',suite:'link-context',checks:['selected-text linking','compact context actions','context Open/Edit/Remove','Escape cancel','remove preserves text','caret insertion','contextual placement','explicit Open','Ctrl-click direct open','no runtime errors']},null,2));
}finally{if(page)await browser.closePage(page).catch(()=>{});await browser.close()}
