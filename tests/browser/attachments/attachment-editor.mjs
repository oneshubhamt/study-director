import assert from 'node:assert/strict';
import fs from 'node:fs';
import {launchChromium,waitFor} from '../../helpers/browser-harness.mjs';
const bundle=fs.readFileSync('source/external/rich-text.js','utf8');
const browser=await launchChromium({profilePrefix:'qa-attach-editor-'});let page;
try{
  page=await browser.createPage('about:blank',{viewport:{width:900,height:700,mobile:false,scale:1}});
  await page.evaluate(`(()=>{document.body.innerHTML='<textarea id="f" style="width:720px;height:300px;font-size:16px;line-height:1.55;padding:16px"></textarea>'})()`);
  await page.evaluate(bundle,{returnByValue:false});
  await page.evaluate(`(async()=>{window.realInputClick=HTMLInputElement.prototype.click;HTMLInputElement.prototype.click=function(){if(this.classList.contains('sd-rte-asset-input')){window.pickedInput=this;return;}return realInputClick.call(this)};const b=new Uint8Array(16044),v=new DataView(b.buffer);b.set(new TextEncoder().encode('RIFF'));v.setUint32(4,b.length-8,true);b.set(new TextEncoder().encode('WAVEfmt '),8);v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,8000,true);v.setUint32(28,16000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);b.set(new TextEncoder().encode('data'),36);v.setUint32(40,b.length-44,true);window.audioBlob=new Blob([b],{type:'audio/wav'});window.__resolveAudioAsset=null;window.assets={get:async id=>id==='att-09876543210987654321'?await new Promise(resolve=>window.__resolveAudioAsset=resolve):null,put:async()=>{},remove:async()=>{}};window.uploads=[];window.attachments=Object.freeze({upload:async file=>{uploads.push({name:file.name,type:file.type,size:file.size});const pdf=file.name.endsWith('.pdf');return {id:pdf?'att-12345678901234567890':'att-09876543210987654321',name:file.name,type:pdf?'application/pdf':'audio/wav'}}});f.value='Start ';window.m=await StudyDirectorRichText.mountRichTextEditor({field:f,label:'Attachment note',initialValue:f.value,maxWords:10000,maxBytes:917504,assets,attachments});document.querySelector('.sd-rte-editor').focus()})()`);await page.settle();
  await page.click('.sd-rte-attachment-trigger');
  const menu=await page.evaluate(`(()=>{const p=document.querySelector('.sd-rte-attachment-trigger').getAttribute('aria-controls'),menu=document.getElementById(p),labels=[...menu.querySelectorAll('button')].map(b=>b.textContent);return {labels,hidden:menu.hidden,toolbarScroll:document.querySelector('.sd-rte-toolbar-rail').scrollWidth<=document.querySelector('.sd-rte-toolbar-rail').clientWidth+1}})()`);
  assert.deepEqual(menu.labels,['Image','PDF','Audio']);assert.equal(menu.hidden,false);
  await page.evaluate(`document.getElementById(document.querySelector('.sd-rte-attachment-trigger').getAttribute('aria-controls')).querySelectorAll('button')[1].click()`);
  await page.evaluate(`(()=>{const input=window.pickedInput;const dt=new DataTransfer();dt.items.add(new File(['%PDF-1.4\\n%%EOF'],'Lecture.pdf',{type:'application/pdf'}));Object.defineProperty(input,'files',{value:dt.files,configurable:true});input.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await waitFor(()=>page.evaluate(`uploads.length===1&&f.value.includes('#attachment=att-12345678901234567890')`),{label:'PDF attachment link'});
  assert.equal(await page.evaluate(`StudyDirectorRichText.toPlainText(f.value).includes('Lecture.pdf')`),true);
  await page.click('.sd-rte-attachment-trigger');await page.evaluate(`document.getElementById(document.querySelector('.sd-rte-attachment-trigger').getAttribute('aria-controls')).querySelectorAll('button')[2].click()`);
  await page.evaluate(`(()=>{const input=window.pickedInput;const dt=new DataTransfer();dt.items.add(new File([window.audioBlob],'Voice.wav',{type:'audio/wav'}));Object.defineProperty(input,'files',{value:dt.files,configurable:true});input.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await waitFor(()=>page.evaluate(`uploads.length===2&&StudyDirectorRichText.scanAttachmentReferences(f.value).occurrences.some(item=>item.kind==='inline-audio'&&item.id==='att-09876543210987654321')`),{label:'inline audio attachment'});
  assert.equal(await page.evaluate(`StudyDirectorRichText.toPlainText(f.value).includes('Voice.wav')`),true);
  await waitFor(()=>page.evaluate(`document.querySelector('.sd-rte-audio-status')?.textContent==='Loading audio…'`),{label:'audio status while asset is genuinely pending'});
  // Use a valid PCM WAV and the browser's real metadata/error events. Faking
  // readyState for malformed bytes races the truthful decoder error.
  await page.evaluate(`window.__resolveAudioAsset(window.audioBlob)`);
  await waitFor(()=>page.evaluate(`(()=>{const p=document.querySelector('.sd-rte-audio-player'),s=document.querySelector('.sd-rte-audio-status');return !!p?.src&&p.src.startsWith('blob:')&&p.readyState>=1&&!p.error&&s?.textContent==='';})()`),{label:'already-ready audio clears loading status'});
  await page.evaluate(`(()=>{const editor=document.querySelector('.sd-rte-editor'),text=[...editor.querySelectorAll('p')].at(-1)?.firstChild;if(!text)return;const range=document.createRange(),selection=getSelection();range.setStart(text,text.length);range.collapse(true);selection.removeAllRanges();selection.addRange(range);editor.focus()})()`);
  await page.send('Input.insertText',{text:' after audio'});
  await waitFor(()=>page.evaluate(`f.value.includes('after audio')`),{label:'post-audio editor update'});await page.settle();
  assert.equal(await page.evaluate(`document.querySelector('.sd-rte-audio-status')?.textContent||''`),'','Cached ready audio must not regress to a stale Loading audio status after an editor redraw/update.');
  await page.setViewport({width:390,height:700,mobile:true,scale:3});await page.settle();await page.tap('.sd-rte-attachment-trigger');await page.settle();
  const mobile=await page.evaluate(`(()=>{const t=document.querySelector('.sd-rte-attachment-trigger').getBoundingClientRect(),m=document.getElementById(document.querySelector('.sd-rte-attachment-trigger').getAttribute('aria-controls')).getBoundingClientRect();return {trigger:{w:t.width,h:t.height},menu:{left:m.left,right:innerWidth-m.right,width:m.width},pageOverflow:document.documentElement.scrollWidth>innerWidth}})()`);
  assert.ok(mobile.trigger.w>=44&&mobile.trigger.h>=44,JSON.stringify(mobile));assert.ok(mobile.menu.left>=0&&mobile.menu.right>=0,JSON.stringify(mobile));assert.equal(mobile.pageOverflow,false);
  assert.deepEqual(page.events,[]);
  console.log(JSON.stringify({status:'PASS',checks:['paperclip Image/PDF/Audio menu','PDF host-port link insertion','audio host-port inline insertion','pending audio status','ready audio status remains clear after update','390px fit + 44px touch target']},null,2));
}finally{if(page)await browser.closePage(page).catch(()=>{});await browser.close();}
