import assert from 'node:assert/strict';
import fs from 'node:fs';
import {launchChromium} from '../../helpers/browser-harness.mjs';

const bundle=fs.readFileSync('source/external/rich-text.js','utf8');
const browser=await launchChromium({profilePrefix:'qa-paste-sanitize-'});let page;
try{
  page=await browser.createPage('about:blank',{viewport:{width:900,height:720,mobile:false,scale:1}});
  await page.evaluate(bundle,{returnByValue:false});
  await page.evaluate(`(async()=>{document.body.innerHTML='<main style="width:760px"><textarea id="note"></textarea></main>';window.assets={get:async()=>null,put:async()=>{},remove:async()=>{}};window.mount=await StudyDirectorRichText.mountRichTextEditor({field:note,label:'Paste sanitizer',initialValue:'',maxWords:10000,maxBytes:917504,assets});const editor=document.querySelector('#note + .sd-rte .sd-rte-editor'),dt=new DataTransfer();dt.setData('text/html','<h1>One</h1><h2>Two</h2><h3>Three</h3><pre>Four</pre><p><s>Five</s> <del>Six</del> <code>Seven</code></p><table><thead><tr><th colspan="2">H1</th><th>H2</th></tr></thead><tbody><tr><td rowspan="2">A</td><td>B</td></tr></tbody></table>');dt.setData('text/plain','One Two Three Four Five Six Seven H1 H2 A B');editor.focus();editor.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}))})()`);
  await page.settle();
  const result=await page.evaluate(`(()=>{const root=document.querySelector('#note + .sd-rte .sd-rte-editor'),json=JSON.parse(note.value.slice(4)),text=StudyDirectorRichText.toPlainText(note.value);return {html:root.innerHTML,text,types:json.doc.content.map(n=>[n.type,n.param??null]),headings:json.doc.content.filter(n=>n.type==='Heading').map(n=>n.param??1),headerCells:root.querySelectorAll('th').length,colspan:root.querySelectorAll('[colspan]').length,rowspan:root.querySelectorAll('[rowspan]').length,status:note.dataset.richEditorStatus||''}})()`);
  assert.deepEqual(result.headings,[1,2],'Approved H1 and legacy H2 should survive as headings; unsupported H3+ are demoted.');
  assert.match(result.text,/One\s+Two\s+Three\s+Four\s+Five Six Seven/,'Unsupported block wrappers must preserve text boundaries instead of concatenating content.');
  assert.equal(result.colspan,0,'Unsupported colspan must be stripped during paste.');
  assert.equal(result.rowspan,0,'Unsupported rowspan must be stripped during paste.');
  assert.equal(result.headerCells,2,'A complete pasted first-row header remains semantic header cells after sanitization.');
  assert.equal(result.status,'','Sanitized supported paste must remain structurally valid.');
  assert.deepEqual(page.events,[],'QA_FIXTURE paste-sanitization browser test produced runtime errors.');
  console.log(JSON.stringify({status:'PASS',suite:'paste-sanitization',result},null,2));
}finally{if(page)await browser.closePage(page).catch(()=>{});await browser.close()}
