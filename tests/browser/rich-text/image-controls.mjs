import assert from 'node:assert/strict';
import fs from 'node:fs';
import {launchChromium,waitFor} from '../../helpers/browser-harness.mjs';

const bundle=fs.readFileSync('source/external/rich-text.js','utf8');
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const ids=['img-12345678901234567890','img-abcdefghijklmnopqrstuv'];
const value=id=>'WG1:'+JSON.stringify({version:1,doc:{type:'Doc',content:[{type:'SDImage',param:{assetId:id,alt:'',widthPct:68}},{type:'Paragraph',content:[{type:'Text',param:'After image'}]}]}});
const browser=await launchChromium({profilePrefix:'qa-image-controls-'});let page;
try{
  page=await browser.createPage('about:blank',{viewport:{width:1100,height:800,mobile:false,scale:1}});
  await page.evaluate(bundle,{returnByValue:false});
  await page.evaluate(`(async()=>{
    document.body.innerHTML='<textarea id="alt"></textarea><textarea id="remove"></textarea>';
    const bytes=Uint8Array.from(atob('${png}'),c=>c.charCodeAt(0));
    const blob=new Blob([bytes],{type:'image/png'});
    const assets={get:async id=>${JSON.stringify(ids)}.includes(id)?blob:null,put:async()=>{},remove:async()=>{}};
    alt.value=${JSON.stringify(value(ids[0]))}; remove.value=${JSON.stringify(value(ids[1]))};
    window.altMount=await StudyDirectorRichText.mountRichTextEditor({field:alt,label:'ALT editor',initialValue:alt.value,maxWords:10000,maxBytes:917504,assets});
    window.removeMount=await StudyDirectorRichText.mountRichTextEditor({field:remove,label:'Remove editor',initialValue:remove.value,maxWords:10000,maxBytes:917504,assets});
  })()`);
  await waitFor(()=>page.evaluate(`document.querySelectorAll('.sd-rte-image img').length===2`),{label:'two image editors'});

  // Direct first-click ALT action; do not preselect the image.
  await page.click('#alt + .sd-rte .sd-rte-image-alt');
  await waitFor(()=>page.evaluate(`document.activeElement?.getAttribute('aria-label')==='Image description'`),{timeout:3000,label:'ALT input on first click'});
  assert.equal(await page.evaluate(`!!document.querySelector('#alt + .sd-rte .sd-rte-image input[aria-label="Image description"]')`),false,'ALT input must live outside Wordgard-owned image atom.');
  assert.equal(await page.evaluate(`!!document.querySelector('#alt + .sd-rte input[aria-label="Image description"]')`),true);
  await page.send('Input.insertText',{text:'Knee rehabilitation chart'});
  await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});
  await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});
  await waitFor(()=>page.evaluate(`alt.value.includes('Knee rehabilitation chart')`),{label:'ALT commit'});
  await page.click('#alt + .sd-rte .sd-rte-image-alt');
  await waitFor(()=>page.evaluate(`document.activeElement?.getAttribute('aria-label')==='Image description'`),{timeout:3000,label:'ALT reopen for Escape'});
  await page.evaluate(`document.querySelector('#alt + .sd-rte input[aria-label="Image description"]').value='Cancel me'`);
  await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});
  await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});
  await page.settle();
  assert.equal(await page.evaluate(`JSON.parse(alt.value.slice(4)).doc.content.find(n=>n.type==='SDImage').param.alt`),'Knee rehabilitation chart','Escape must cancel an uncommitted image description.');

  // Direct first-click delete; do not preselect the image.
  await page.click('#remove + .sd-rte .sd-rte-image-remove');
  await waitFor(()=>page.evaluate(`!document.querySelector('#remove + .sd-rte .sd-rte-image')`),{timeout:3000,label:'image removed on first click'});
  await page.settle();

  // Coarse-pointer/mobile contract: contextual image controls must remain visibly discoverable,
  // after selecting the image with a real touch, without relying on mouse hover.
  await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:700,deviceScaleFactor:3,mobile:true});
  await page.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
  await page.settle();
  const touch=await page.evaluate(`(()=>{const img=document.querySelector('#alt + .sd-rte img');img.scrollIntoView({block:'center'});const r=img.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
  await page.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch]});
  await page.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.settle();
  const mobileControls=await page.evaluate(`(()=>{
    const root=document.querySelector('#alt + .sd-rte'),figure=root.querySelector('.sd-rte-image');
    const probe=selector=>{const el=figure.querySelector(selector),r=el.getBoundingClientRect(),style=getComputedStyle(el);return {w:r.width,h:r.height,opacity:Number(style.opacity||1),visibility:style.visibility,display:style.display,borderWidth:parseFloat(style.borderTopWidth)||0,borderColor:style.borderTopColor,background:style.backgroundColor}};
    const alt=figure.querySelector('.sd-rte-image-alt'),resize=figure.querySelector('.sd-rte-image-resize'),altGlyph=getComputedStyle(alt,'::before'),resizeGlyph=getComputedStyle(resize,'::after');
    return {coarse:matchMedia('(pointer: coarse)').matches,alt:probe('.sd-rte-image-alt'),remove:probe('.sd-rte-image-remove'),resize:probe('.sd-rte-image-resize'),altGlyph:{content:altGlyph.content,fontSize:parseFloat(altGlyph.fontSize)||0},resizeGlyph:{width:parseFloat(resizeGlyph.width)||0,height:parseFloat(resizeGlyph.height)||0,borderRight:parseFloat(resizeGlyph.borderRightWidth)||0},overflow:document.documentElement.scrollWidth-innerWidth};
  })()`);
  assert.equal(mobileControls.coarse,true,JSON.stringify(mobileControls));
  for(const [name,control] of Object.entries({alt:mobileControls.alt,remove:mobileControls.remove,resize:mobileControls.resize})){
    assert.ok(control.w>=44&&control.h>=44,`${name} image control is not touch-safe: ${JSON.stringify(control)}`);
    assert.ok(control.opacity>=0.75&&control.visibility!=='hidden'&&control.display!=='none',`${name} image control is visually hidden: ${JSON.stringify(control)}`);
    assert.ok(control.borderWidth>=1&&!/rgba\([^)]*,\s*0\)$/.test(control.borderColor)&&control.borderColor!=='transparent',`${name} image control lacks visible border chrome: ${JSON.stringify(control)}`);
    assert.ok(control.background!=='transparent'&&!/rgba\([^)]*,\s*0\)$/.test(control.background),`${name} image control lacks visible background chrome: ${JSON.stringify(control)}`);
  }
  assert.ok(mobileControls.altGlyph.fontSize>=10&&mobileControls.altGlyph.content!=='none'&&mobileControls.altGlyph.content!=='normal','ALT glyph must remain legible on mobile.');
  assert.ok(mobileControls.resizeGlyph.width>=12&&mobileControls.resizeGlyph.height>=12&&mobileControls.resizeGlyph.borderRight>=2,'Resize glyph must remain legible on mobile.');
  assert.ok(mobileControls.overflow<=1,'Image controls must not create page-level horizontal overflow.');

  assert.deepEqual(page.events,[],'Image controls must not trigger browser/runtime reconciliation errors.');
  console.log(JSON.stringify({status:'PASS',checks:['alt-first-click','alt-wordgard-ownership','alt-escape-cancel','delete-first-click','mobile-visible-44px-controls','mobile-legible-alt-resize-glyphs','no-runtime-errors']},null,2));
}finally{if(page)await browser.closePage(page).catch(()=>{});await browser.close()}
