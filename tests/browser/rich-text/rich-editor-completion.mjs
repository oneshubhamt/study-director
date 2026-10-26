import assert from 'node:assert/strict';
import fs from 'node:fs';
import {launchChromium,waitFor} from '../../helpers/browser-harness.mjs';
import {richTextRuntimeSource} from '../../helpers/rich-text-runtime.mjs';

const bundle=richTextRuntimeSource();
const browser=await launchChromium({profilePrefix:'qa-editor-completion-'});let page;
const keySpec=value=>({ArrowDown:{code:'ArrowDown',keyCode:40},ArrowUp:{code:'ArrowUp',keyCode:38},Home:{code:'Home',keyCode:36},End:{code:'End',keyCode:35},Enter:{code:'Enter',keyCode:13},Backspace:{code:'Backspace',keyCode:8}}[value]||{code:value,keyCode:0});
const key=async(value,modifiers=0)=>{const {code,keyCode}=keySpec(value),payload={key:value,code,modifiers,windowsVirtualKeyCode:keyCode,nativeVirtualKeyCode:keyCode};await page.send('Input.dispatchKeyEvent',{type:'keyDown',...payload});await page.send('Input.dispatchKeyEvent',{type:'keyUp',...payload})};
const ctrl=2;
try{
  page=await browser.createPage('about:blank',{viewport:{width:1180,height:900,mobile:false,scale:1}});
  await page.evaluate(bundle,{returnByValue:false});
  const imageValue='WG1:'+JSON.stringify({version:1,doc:{type:'Doc',content:[{type:'SDImage',param:{assetId:'img-12345678901234567890',alt:'original.png',widthPct:68}},{type:'Paragraph',content:[{type:'Text',param:'After image'}]}]}});
  await page.evaluate(`(async()=>{
    document.body.innerHTML='<main style="width:900px;margin:20px"><textarea id="heading">Heading text</textarea><textarea id="check">Task</textarea><textarea id="table">Table</textarea><textarea id="image"></textarea><textarea id="limit">x</textarea></main>';
    image.value=${JSON.stringify(imageValue)};
    const c=document.createElement('canvas');c.width=8;c.height=8;c.getContext('2d').fillRect(0,0,8,8);window.__imageBlob=await new Promise(r=>c.toBlob(r,'image/png'));
    window.assets={get:async id=>id==='img-12345678901234567890'?__imageBlob:null,put:async()=>{},remove:async()=>{}};
    window.emptyAssets={get:async()=>null,put:async()=>{},remove:async()=>{}};
    window.selectText=(selector,start,end)=>{const p=document.querySelector(selector),t=p.firstChild,r=document.createRange(),s=getSelection();p.closest('.sd-rte-editor')?.focus({preventScroll:true});r.setStart(t,start);r.setEnd(t,end);s.removeAllRanges();s.addRange(r);document.dispatchEvent(new Event('selectionchange'))};
    window.selectStart=selector=>{const p=document.querySelector(selector),r=document.createRange(),s=getSelection();p.closest('.sd-rte-editor')?.focus({preventScroll:true});r.setStart(p,0);r.collapse(true);s.removeAllRanges();s.addRange(r);document.dispatchEvent(new Event('selectionchange'))};
    headingMount=await StudyDirectorRichText.mountRichTextEditor({field:heading,label:'Heading editor',initialValue:heading.value,maxWords:10000,maxBytes:917504,assets:emptyAssets});
    checkMount=await StudyDirectorRichText.mountRichTextEditor({field:check,label:'Checklist editor',initialValue:check.value,maxWords:10000,maxBytes:917504,assets:emptyAssets});
    tableMount=await StudyDirectorRichText.mountRichTextEditor({field:table,label:'Table editor',initialValue:table.value,maxWords:10000,maxBytes:917504,assets:emptyAssets});
    imageMount=await StudyDirectorRichText.mountRichTextEditor({field:image,label:'Image editor',initialValue:image.value,maxWords:10000,maxBytes:917504,assets});
    limitMount=await StudyDirectorRichText.mountRichTextEditor({field:limit,label:'Limit editor',initialValue:limit.value,maxWords:10000,maxBytes:180,assets:emptyAssets});
  })()`);
  await page.settle();

  // Heading state comes from the authoritative Wordgard command, and the style popup is keyboard navigable.
  await page.evaluate(`selectText('#heading + .sd-rte .sd-rte-editor p',4,4);document.querySelector('#heading + .sd-rte button[aria-label="Typography"]').focus()`);await page.settle();
  await key('ArrowDown');await page.settle();
  assert.equal(await page.evaluate(`document.activeElement?.getAttribute('aria-label')`),'Heading 1','ArrowDown on a closed style trigger should open it and focus the first option.');
  await key('ArrowDown');await page.settle();
  assert.equal(await page.evaluate(`document.activeElement?.getAttribute('aria-label')`),'Heading 2','ArrowDown should move focus within the style popup.');
  await page.evaluate(`document.activeElement.click()`);await page.settle();
  const headingState=await page.evaluate(`(()=>{const root=document.querySelector('#heading + .sd-rte'),trigger=root.querySelector('button[aria-label="Typography"]');return {tag:root.querySelector('.sd-rte-editor').firstElementChild?.tagName,label:trigger.querySelector('.sd-rte-glyph')?.dataset.glyph||trigger.textContent,canonical:heading.value}})()`);
  assert.equal(headingState.tag,'H2');assert.match(headingState.label,/^Aa/,'Heading toolbar label must follow Wordgard command activity.');
  await key('Escape');await page.evaluate(`document.querySelector('#heading + .sd-rte button[aria-label="Typography"]').focus()`);await key('ArrowDown');await page.settle();
  assert.equal(await page.evaluate(`document.querySelector('#heading + .sd-rte button[aria-label="Heading 2"]').getAttribute('aria-pressed')`),'true','Heading option must report active after reopening the popup.');
  await key('Home');await page.settle();
  assert.equal(await page.evaluate(`document.activeElement?.getAttribute('aria-label')`),'Heading 1','Home should move popup focus to the first option.');
  await key('End');await page.settle();
  assert.equal(await page.evaluate(`document.activeElement?.getAttribute('aria-label')`),'Justify','End should move popup focus to the last option.');
  await page.evaluate(`document.querySelector('#heading + .sd-rte .sd-rte-editor').focus()`);

  // Checklist role must be genuinely keyboard-operable.
  await page.evaluate(`selectText('#check + .sd-rte .sd-rte-editor p',4,4)`);await page.click('#check + .sd-rte button[aria-label="Checklist"]');await page.settle();
  const beforeCheck=await page.evaluate(`document.querySelector('#check + .sd-rte li[role="checkbox"]')?.getAttribute('aria-checked')`);
  assert.equal(beforeCheck,'false');
  await key('Enter',ctrl);await page.settle();
  const checklist=await page.evaluate(`(()=>{const li=document.querySelector('#check + .sd-rte li[role="checkbox"]'),json=JSON.parse(check.value.slice(4));return {checked:li?.getAttribute('aria-checked'),shortcut:li?.getAttribute('aria-keyshortcuts'),stored:JSON.stringify(json).includes('SDChecklistChecked')&&JSON.stringify(json).includes('true')}})()`);
  assert.equal(checklist.checked,'true');assert.match(checklist.shortcut,/Control\+Enter/);assert.equal(checklist.stored,true);

  // Semantic header row + proportional column editing + direct table-edge resizing.
  await page.evaluate(`selectText('#table + .sd-rte .sd-rte-editor p',3,3)`);await page.click('#table + .sd-rte button[aria-label="Insert 2 × 2 table"]');await page.settle();
  await page.evaluate(`document.querySelector('#table + .sd-rte button[aria-label="Toggle header row"]').focus();document.activeElement.click()`);await page.settle();
  let tableState=await page.evaluate(`(()=>{const root=document.querySelector('#table + .sd-rte'),json=JSON.parse(table.value.slice(4)),node=json.doc.content.find(n=>n.type==='Table');return {th:root.querySelectorAll('th').length,types:node.content[0].content.map(c=>c.type),markdown:StudyDirectorRichText.toMarkdown(table.value)}})()`);
  assert.equal(tableState.th,2);assert.deepEqual(tableState.types,['HeaderCell','HeaderCell']);assert.match(tableState.markdown,/\| --- \| --- \|/,'Header tables should export as Markdown tables with a real header separator.');

  assert.equal(await page.evaluate(`!!document.querySelector('#table + .sd-rte button[aria-label="Widen column"],#table + .sd-rte button[aria-label="Narrow column"],#table + .sd-rte button[aria-label="Make row taller"],#table + .sd-rte button[aria-label="Shorten row"]')`),false,'Redundant table dimension step-buttons must not live in the toolbar.');
  await page.evaluate(`(()=>{const cell=document.querySelector('#table + .sd-rte tr:first-child th:first-child'),r=cell.getBoundingClientRect();window.__qa={x:r.right-1,y:r.top+r.height/2};cell.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,clientX:__qa.x,clientY:__qa.y,pointerId:571,pointerType:'mouse',buttons:1}))})()`);
  await page.evaluate(`window.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,cancelable:true,clientX:__qa.x+36,clientY:__qa.y,pointerId:571,pointerType:'mouse',buttons:1}));window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,cancelable:true,clientX:__qa.x+36,clientY:__qa.y,pointerId:571,pointerType:'mouse',buttons:0}))`);await page.settle();
  const resized=await page.evaluate(`(()=>{const n=JSON.parse(table.value.slice(4)).doc.content.find(x=>x.type==='Table');return n.content[0].content.map(c=>c.marks.SDCellWidth)})()`);
  assert.ok(resized[0]>resized[1],'Direct column-edge resizing must alter the selected column pair.');
  const ratioBefore=resized[0]/resized[1];
  await page.evaluate(`document.querySelector('#table + .sd-rte button[aria-label="Add column"]').focus();document.activeElement.click()`);await page.settle();
  const added=await page.evaluate(`(()=>{const n=JSON.parse(table.value.slice(4)).doc.content.find(x=>x.type==='Table');return {widths:n.content[0].content.map(c=>c.marks.SDCellWidth),types:n.content[0].content.map(c=>c.type),columns:document.querySelector('#table + .sd-rte tr').cells.length}})()`);
  assert.equal(added.columns,3);assert.deepEqual(added.types,['HeaderCell','HeaderCell','HeaderCell'],'A new column in a header table must create a header cell in row 1.');
  assert.ok(Math.abs(added.widths[0]/added.widths[2]-ratioBefore)<0.02,'Adding a column must preserve the relative proportions of existing resized columns.');
  await page.evaluate(`document.querySelector('#table + .sd-rte button[aria-label="Delete column"]').focus();document.activeElement.click()`);await page.settle();
  const removed=await page.evaluate(`(()=>{const n=JSON.parse(table.value.slice(4)).doc.content.find(x=>x.type==='Table');return n.content[0].content.map(c=>c.marks.SDCellWidth)})()`);
  assert.equal(removed.length,2);assert.ok(Math.abs(removed[0]/removed[1]-ratioBefore)<0.02,'Deleting the inserted column must preserve survivor proportions.');
  // Row height is content-driven; column proportions are the stored geometry.
  const rowBefore=await page.evaluate(`document.querySelector('#table + .sd-rte tr').getBoundingClientRect().height`);
  await page.evaluate(`(()=>{const cell=document.querySelector('#table + .sd-rte th p');cell.closest('[contenteditable=true]').focus();const r=document.createRange();r.selectNodeContents(cell);r.collapse(false);const selection=getSelection();selection.removeAllRanges();selection.addRange(r);document.dispatchEvent(new Event('selectionchange'));})()`);
  await page.send('Input.insertText',{text:'Long cell content '.repeat(30)});await page.settle();
  const rowAfter=await page.evaluate(`document.querySelector('#table + .sd-rte tr').getBoundingClientRect().height`);
  assert.ok(rowAfter>rowBefore,'Rows must grow to display their content without storing fixed row heights');

  await page.evaluate(`document.querySelector('#table + .sd-rte button[aria-label=\"Toggle header row\"]').click()`);await page.settle();
  tableState=await page.evaluate(`(()=>{const n=JSON.parse(table.value.slice(4)).doc.content.find(x=>x.type==='Table');return {th:document.querySelectorAll('#table + .sd-rte th').length,types:n.content[0].content.map(c=>c.type),markdown:StudyDirectorRichText.toMarkdown(table.value)}})()`);
  assert.equal(tableState.th,0);assert.deepEqual(tableState.types,['Cell','Cell']);assert.ok(tableState.markdown.includes('<table>\n<tbody>'),'Headerless table export must preserve table structure without inventing a Markdown header.');assert.ok(!tableState.markdown.includes('| --- |'),'Headerless export must not contain a fabricated Markdown header separator.');

  // Image alt text is editable from the selected image node.
  await page.evaluate(`selectText('#image + .sd-rte .sd-rte-editor > p:last-child',0,0)`);await page.settle();await key('Backspace');await page.settle();
  assert.equal(await page.evaluate(`document.querySelector('#image + .sd-rte .sd-rte-image')?.classList.contains('wg-selected-node')`),true,'Backspace at the following paragraph should select the atomic image.');
  assert.equal(await page.evaluate(`!!document.querySelector('#image + .sd-rte .sd-rte-toolbar button[aria-label="Image description"],#image + .sd-rte .sd-rte-toolbar button[aria-label="Edit image description"]')`),false,'Image description must not occupy the permanent toolbar.');
  assert.equal(await page.evaluate(`!!document.querySelector('#image + .sd-rte .sd-rte-image button[aria-label="Edit image description"]')`),true,'Selected images must expose a local description action.');
  await page.click('#image + .sd-rte .sd-rte-image button[aria-label="Edit image description"]');await waitFor(()=>page.evaluate(`document.activeElement===document.querySelector('#image + .sd-rte input[aria-label="Image description"]')`),{label:'image description input'});
  await page.evaluate(`document.querySelector('#image + .sd-rte input[aria-label="Image description"]').value='Study flow diagram'`);await key('Enter');await page.settle();
  const altState=await page.evaluate(`(()=>{const n=JSON.parse(image.value.slice(4)).doc.content.find(x=>x.type==='SDImage');return {stored:n.param.alt,dom:document.querySelector('#image + .sd-rte img')?.alt,caption:document.querySelector('#image + .sd-rte figcaption')?.textContent}})()`);
  assert.deepEqual(altState,{stored:'Study flow diagram',dom:'Study flow diagram',caption:'Study flow diagram'});

  // Byte exhaustion should be distinguished from structural invalidity.
  await page.evaluate(`selectText('#limit + .sd-rte .sd-rte-editor p',1,1)`);await page.send('Input.insertText',{text:'z'.repeat(500)});await page.settle();
  const limitState=await page.evaluate(`({message:limit.dataset.richEditorStatus,state:limit.dataset.richEditorStatusState,value:limit.value})`);
  assert.equal(limitState.message,'This rich note is too large to save safely.');assert.equal(limitState.state,'error');assert.ok(!limitState.message.includes('structurally'));

  assert.deepEqual(page.events,[],'QA_FIXTURE completion browser test produced runtime errors.');
  console.log(JSON.stringify({status:'PASS',suite:'rich-editor-completion',headingState,checklist,resized,added,removed,rowBefore,rowAfter,tableState,altState,limitState:{message:limitState.message,state:limitState.state}},null,2));
}finally{if(page)await browser.closePage(page).catch(()=>{});await browser.close()}
