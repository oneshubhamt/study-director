import assert from 'node:assert/strict';
import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {launchChromium,waitFor} from '../../helpers/browser-harness.mjs';

const bundle=fs.readFileSync('source/external/rich-text.js','utf8');
const browser=await launchChromium({profilePrefix:'qa-rich-hotpath-'});let page;
async function typeBatch(selector,count){
  await page.evaluate(`__focusText(${JSON.stringify(selector)});__cellScrolls=0`);
  const started=performance.now();
  for(let i=0;i<count;i++)await page.send('Input.insertText',{text:'x'});
  return {ms:performance.now()-started,scrolls:await page.evaluate(`__cellScrolls`)};
}
try{
  page=await browser.createPage('about:blank',{viewport:{width:1100,height:820,mobile:false,scale:1}});
  await page.evaluate(bundle,{returnByValue:false});
  await page.evaluate(`(()=>{
    document.body.innerHTML='<main id="root" style="width:760px;margin:20px"></main>';
    const native=Element.prototype.scrollIntoView;window.__cellScrolls=0;
    Element.prototype.scrollIntoView=function(options){if(this.matches?.('td,th'))window.__cellScrolls++;return native.call(this,options)};
    window.__assets={get:async()=>null,put:async()=>{},remove:async()=>{}};
    window.__mount=async(id,value,label='Hot path')=>{if(window.__mounted)await window.__mounted.destroy();const field=document.createElement('textarea');field.id=id;field.value=value;root.replaceChildren(field);window.__lastMeta=null;field.addEventListener('input',event=>{window.__lastMeta=event[Symbol.for('studyDirector.richValidatedInput.v1')]||null});window.__mounted=await StudyDirectorRichText.mountRichTextEditor({field,label,initialValue:value,maxWords:10000,maxBytes:917504,assets:__assets});return true};
    window.__focusText=selector=>{const target=document.querySelector(selector);if(!target)throw new Error('Missing target '+selector);const text=target.firstChild,range=document.createRange(),selection=getSelection();target.closest('[contenteditable=true]')?.focus();if(text&&text.nodeType===Node.TEXT_NODE)range.setStart(text,text.nodeValue.length);else range.setStart(target,target.childNodes.length);range.collapse(true);selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange'))};
    window.__wrap=content=>'WG1:'+JSON.stringify({version:1,doc:{type:'Doc',content}});
    window.__para=text=>({type:'Paragraph',content:text?[{type:'Text',param:text}]:[]});
    window.__table=(rows,cols)=>({type:'Table',marks:{SDTableWidth:100},content:Array.from({length:rows},(_,r)=>({type:'TableRow',content:Array.from({length:cols},(_,c)=>({type:'Cell',marks:{SDCellWidth:100/cols,SDCellHeight:34},content:[__para('c'+r+'-'+c)]}))}))});
  })()`);

  const tableMountStart=performance.now();
  await page.evaluate(`__mount('tableNote',__wrap([__table(15,15),__para('tail')]),'Large table')`);
  await waitFor(()=>page.evaluate(`!!document.querySelector('#tableNote + .sd-rte table')`),{label:'15x15 table mount'});
  const tableMountMs=performance.now()-tableMountStart;
  const tableTyping=await typeBatch('#tableNote + .sd-rte tr:first-child td:first-child p',30);
  assert.ok(tableTyping.scrolls<=1,`Typing in one table cell must not repeatedly call scrollIntoView (got ${tableTyping.scrolls}).`);
  const meta=await page.evaluate(`__lastMeta&&({format:__lastMeta.format,version:__lastMeta.version,words:__lastMeta.words,bytes:__lastMeta.bytes,plain:__lastMeta.plain,canonical:__lastMeta.canonical})`);
  assert.equal(meta?.format,'study-director.rich-validated-input');assert.equal(meta?.version,1);assert.ok(Number.isInteger(meta?.words)&&meta.words>=0);assert.ok(Number.isInteger(meta?.bytes)&&meta.bytes>0);assert.equal(typeof meta?.plain,'string');assert.equal(typeof meta?.canonical,'string');

  const switched=await typeBatch('#tableNote + .sd-rte tr:first-child td:nth-child(2) p',12);
  assert.ok(switched.scrolls<=1,'Typing after switching cells must require at most one reveal.');

  const prose='word '.repeat(9500).trim(),proseMountStart=performance.now();
  await page.evaluate(`__mount('prose',__wrap([__para(${JSON.stringify(prose)})]),'Near-limit prose')`);
  const proseMountMs=performance.now()-proseMountStart;
  const proseTyping=await typeBatch('#prose + .sd-rte p',24);

  const denseMountStart=performance.now();
  await page.evaluate(`__mount('dense',__wrap(Array.from({length:1000},(_,i)=>__para('block '+i))),'Dense document')`);
  const denseMountMs=performance.now()-denseMountStart;
  const denseTyping=await typeBatch('#dense + .sd-rte p',24);

  const profile={table:{mountMs:tableMountMs,typingMs:tableTyping.ms,sameCellScrolls:tableTyping.scrolls},prose:{mountMs:proseMountMs,typingMs:proseTyping.ms},dense:{mountMs:denseMountMs,typingMs:denseTyping.ms}};
  assert.ok(profile.prose.typingMs<1500,`Near-limit prose typing regressed catastrophically (${profile.prose.typingMs.toFixed(1)} ms / 24 chars).`);
  assert.ok(profile.dense.typingMs<2000,`Structurally dense typing regressed catastrophically (${profile.dense.typingMs.toFixed(1)} ms / 24 chars).`);
  assert.ok(profile.dense.mountMs<3000,`Structurally dense mount regressed catastrophically (${profile.dense.mountMs.toFixed(1)} ms).`);
  assert.ok(profile.table.typingMs<2000,`15x15 table typing regressed catastrophically (${profile.table.typingMs.toFixed(1)} ms / 30 chars).`);
  assert.deepEqual(page.events,[],'QA_FIXTURE hot-path browser test produced runtime errors.');
  console.log(JSON.stringify({status:'PASS',suite:'rich-editor-hotpath',profile},null,2));
}finally{if(page)await browser.closePage(page).catch(()=>{});await browser.close();}
