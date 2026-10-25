import assert from 'node:assert/strict';
import fs from 'node:fs';
import {launchChromium} from '../../helpers/browser-harness.mjs';
import {richTextRuntimeSource} from '../../helpers/rich-text-runtime.mjs';

const bundle=richTextRuntimeSource();
const id='img-12345678901234567890';
const value='WG1:'+JSON.stringify({version:1,doc:{type:'Doc',content:[
  {type:'Heading',param:2,marks:{SDLineHeight:1.55},content:[{type:'Text',param:'Typography probe'}]},
  {type:'SDImage',param:{assetId:id,alt:'alignment probe',widthPct:60}},
  {type:'Paragraph',content:[{type:'Text',param:'Tail'}]}
]}});
const browser=await launchChromium({profilePrefix:'qa-typography-'});let page;
const root='#note + .sd-rte';
try{
  page=await browser.createPage('about:blank',{viewport:{width:520,height:720,mobile:false,scale:1}});
  await page.evaluate(bundle,{returnByValue:false});
  await page.evaluate(`(async()=>{document.body.innerHTML='<main style="width:420px;margin:12px"><textarea id="note"></textarea><div id="readonly"></div></main>';note.value=${JSON.stringify(value)};const png=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='),c=>c.charCodeAt(0));window.assets={get:async id=>id===${JSON.stringify(id)}?new Blob([png],{type:'image/png'}):null,put:async()=>{},remove:async()=>{}};window.mount=await StudyDirectorRichText.mountRichTextEditor({field:note,label:'Refinement',initialValue:note.value,maxWords:10000,maxBytes:917504,assets});})()`);
  await page.settle();

  // Text mode: H1/H2/N order, no overflow, spacing reset.
  await page.evaluate(`(()=>{const h=document.querySelector('${root} h2'),t=h.firstChild,r=document.createRange(),s=getSelection();document.querySelector('${root} .sd-rte-editor').focus();r.setStart(t,1);r.collapse(true);s.removeAllRanges();s.addRange(r);document.dispatchEvent(new Event('selectionchange'))})()`);await page.settle();
  await page.click(`${root} button[aria-label="Typography"]`);await page.settle();
  const textUI=await page.evaluate(`(()=>{const menu=document.querySelector('${root} .sd-rte-typography'),align=menu.querySelector('.sd-rte-typography-align');return {presets:[...menu.querySelectorAll('.sd-rte-typography-presets button')].map(b=>b.textContent),labels:[...align.querySelectorAll('button')].map(b=>b.getAttribute('aria-label')),menuOverflow:menu.scrollWidth>menu.clientWidth,alignOverflow:align.scrollWidth>align.clientWidth}})()`);
  assert.deepEqual(textUI.presets,['H1','H2','N']);
  assert.deepEqual(textUI.labels,['Align left','Align center','Align right','Justify']);
  assert.equal(textUI.menuOverflow,false);assert.equal(textUI.alignOverflow,false);
  await page.click(`${root} button[aria-label="Reset line spacing"]`);await page.settle();
  let doc=await page.evaluate(`JSON.parse(note.value.slice(4)).doc`);
  assert.equal(doc.content[0].marks?.SDLineHeight,undefined,'Spacing reset must clear the custom line-height mark.');
  await page.click(`${root} button[aria-label="Typography"]`);await page.settle();

  // Image mode: same Aa trigger, only L/C/R, no overflow, alignment persists/rendering changes.
  await page.click(`${root} .sd-rte-image`);await page.settle();
  const trigger=await page.evaluate(`(()=>{const b=document.querySelector('${root} button[aria-label="Image position"]');return {disabled:b.disabled,expanded:b.getAttribute('aria-expanded')}})()`);
  assert.equal(trigger.disabled,false,'Aa must stay available for an image node selection.');
  await page.click(`${root} button[aria-label="Image position"]`);await page.settle();
  const imageUI=await page.evaluate(`(()=>{const menu=document.querySelector('${root} .sd-rte-typography'),visible=[...menu.querySelectorAll('button')].filter(b=>!b.hidden&&b.getClientRects().length>0).map(b=>b.getAttribute('aria-label'));return {mode:menu.dataset.mode,visible,overflow:menu.scrollWidth>menu.clientWidth}})()`);
  assert.equal(imageUI.mode,'image');
  assert.deepEqual(imageUI.visible,['Align left','Align center','Align right']);
  assert.equal(imageUI.overflow,false);

  await page.click(`${root} button[aria-label="Align center"]`);await page.settle();
  doc=await page.evaluate(`JSON.parse(note.value.slice(4)).doc`);
  assert.equal(doc.content.find(n=>n.type==='SDImage').param.align,'center');
  let rendered=await page.evaluate(`(()=>{const f=document.querySelector('${root} .sd-rte-image'),cs=getComputedStyle(f);return {align:f.dataset.sdImageAlign,start:cs.marginInlineStart,end:cs.marginInlineEnd}})()`);
  assert.equal(rendered.align,'center');assert.equal(rendered.start,rendered.end);

  await page.click(`${root} button[aria-label="Align right"]`);await page.settle();
  doc=await page.evaluate(`JSON.parse(note.value.slice(4)).doc`);
  assert.equal(doc.content.find(n=>n.type==='SDImage').param.align,'right');
  rendered=await page.evaluate(`(()=>{StudyDirectorRichText.renderRichText({container:readonly,value:note.value,label:'Read only',assets});const f=readonly.querySelector('.sd-rte-image'),cs=getComputedStyle(f);return {align:f.dataset.sdImageAlign,start:cs.marginInlineStart,end:cs.marginInlineEnd}})()`);
  assert.equal(rendered.align,'right');assert.equal(rendered.end,'0px');

  assert.deepEqual(page.events,[],'Typography refinement browser pass produced runtime errors.');
  console.log(JSON.stringify({status:'PASS',suite:'typography-refinement',checks:['compact popover','H1 H2 N','spacing reset','text L/C/R/J','image L/C/R']},null,2));
}finally{if(page)await browser.closePage(page).catch(()=>{});await browser.close()}
