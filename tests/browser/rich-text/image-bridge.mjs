import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {launchChromium,waitFor,pasteInPage} from '../../helpers/browser-harness.mjs';
import {richTextRuntimeSource} from '../../helpers/rich-text-runtime.mjs';

const bundle=richTextRuntimeSource();
const fixture=path.join(os.tmpdir(),'qa-image.png');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
fs.writeFileSync(fixture,png);
const browser=await launchChromium({profilePrefix:'qa-image-'});let page;
try{
  page=await browser.createPage('about:blank',{viewport:{width:1000,height:760,mobile:false,scale:1}});
  await page.evaluate(bundle,{returnByValue:false});
  await page.evaluate(`(async()=>{document.body.innerHTML='<main style="width:820px;margin:24px"><textarea id="picker">Alpha\\nBeta</textarea><textarea id="paste">Gamma\\nDelta</textarea></main>';window.assetMap=new Map();window.assets={get:async id=>assetMap.get(id)||null,put:async(id,b)=>assetMap.set(id,b),remove:async id=>assetMap.delete(id)};window.selectPara=(id,index,offset)=>{const p=document.querySelector('#'+id+' + .sd-rte .sd-rte-editor').children[index],t=p.firstChild,r=document.createRange(),s=getSelection();r.setStart(t,offset);r.collapse(true);s.removeAllRanges();s.addRange(r);document.dispatchEvent(new Event('selectionchange'))};window.mp=await StudyDirectorRichText.mountRichTextEditor({field:picker,label:'Picker',initialValue:picker.value,maxWords:10000,maxBytes:917504,assets});window.ms=await StudyDirectorRichText.mountRichTextEditor({field:paste,label:'Paste',initialValue:paste.value,maxWords:10000,maxBytes:917504,assets})})()`);
  await page.settle();

  await page.click('#picker + .sd-rte .sd-rte-editor p:nth-of-type(2)');await page.settle();
  await page.send('Page.setInterceptFileChooserDialog',{enabled:true});
  await page.click('#picker + .sd-rte .sd-rte-attachment-trigger');await page.click('#picker + .sd-rte button[aria-label="Insert image"]');
  // Reproduce the user's observed browser caret jump while the native chooser owns focus.
  await page.evaluate(`selectPara('picker',0,0)`);await page.settle();
  const doc=await page.send('DOM.getDocument',{depth:-1,pierce:true}),input=await page.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#picker + .sd-rte .sd-rte-asset-input'});
  await page.send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[fixture]});
  await waitFor(()=>page.evaluate(`document.getElementById('picker').value.includes('"type":"SDImage"')`),{timeout:10000,label:'picker image insertion'});
  assert.deepEqual(await page.evaluate(`[...document.querySelector('#picker + .sd-rte .sd-rte-editor').children].map(n=>n.tagName)`),['P','P','FIGURE','P'],'Picker image must use the selection captured before toolbar/native-dialog focus changes.');

  await page.click('#paste + .sd-rte .sd-rte-editor p:nth-of-type(2)');await page.evaluate(`(()=>{const bytes=Uint8Array.from(atob(${JSON.stringify(png.toString('base64'))}),c=>c.charCodeAt(0)),file=new File([bytes],'clipboard.png',{type:'image/png'}),dt=new DataTransfer();dt.items.add(file);dt.setData('text/plain','true');${pasteInPage}(document.querySelector('#paste + .sd-rte .sd-rte-editor'),dt)})()`);
  await waitFor(()=>page.evaluate(`document.getElementById('paste').value.includes('"type":"SDImage"')`),{timeout:10000,label:'clipboard image insertion'});
  const pasted=await page.evaluate(`({children:[...document.querySelector('#paste + .sd-rte .sd-rte-editor').children].map(n=>n.tagName),text:document.querySelector('#paste + .sd-rte .sd-rte-editor').innerText,assets:assetMap.size})`);
  assert.deepEqual(pasted.children,['P','P','FIGURE','P']);
  assert.equal(/(?:^|\\s)true(?:$|\\s)/.test(pasted.text),false,'Clipboard image must not fall through as literal true text.');
  assert.equal(pasted.assets,2);
  assert.deepEqual(page.events,[],'Image bridge browser test produced runtime errors.');
  console.log(JSON.stringify({status:'PASS',suite:'image-bridge',checks:['pre-picker selection survives caret reset','native chooser image inserts','clipboard image consumes stray true text','shared Blob pipeline']},null,2));
}finally{if(page)await browser.closePage(page).catch(()=>{});await browser.close();fs.rmSync(fixture,{force:true})}
