import assert from 'node:assert/strict';
import {artifactPath,writeArtifact} from '../../helpers/artifacts.mjs';
import fs from 'node:fs';
import {launchChromium,startReleaseServer,waitForStudyDirector,waitFor,sleep} from '../../helpers/browser-harness.mjs';

const bundle=fs.readFileSync('source/external/rich-text.js','utf8');
const browser=await launchChromium({profilePrefix:'qa-overlays-'});
const results=[];
let server;
const key=async(page,value)=>{for(const type of ['keyDown','keyUp'])await page.send('Input.dispatchKeyEvent',{type,key:value,code:value,windowsVirtualKeyCode:value==='Escape'?27:value==='ArrowDown'?40:13})};
const box=page=>page.evaluate(`(()=>{const p=document.querySelector('.sd-rte-menu:not([hidden])'),r=p.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,native:p.hasAttribute('popover'),open:p.hasAttribute('popover')&&p.matches(':popover-open')}})()`);
const selectTextByPointer=async(page,selector,start,end,expected)=>{const points=await page.evaluate(`(()=>{const p=document.querySelector(${JSON.stringify(selector)}),t=p?.firstChild;if(!(t instanceof Text))throw new Error('Missing text selection target');const rectAt=(from,to)=>{const r=document.createRange();r.setStart(t,from);r.setEnd(t,to);const b=r.getBoundingClientRect();return {left:b.left,right:b.right,y:b.top+b.height/2}};const a=rectAt(${start},Math.min(${start}+1,t.length)),b=rectAt(Math.max(${end}-1,0),${end});return {sx:a.left+1,sy:a.y,ex:b.right+1,ey:b.y}})()`);await page.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:points.sx,y:points.sy});await page.send('Input.dispatchMouseEvent',{type:'mousePressed',x:points.sx,y:points.sy,button:'left',buttons:1,clickCount:1});await page.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:points.ex,y:points.ey,button:'left',buttons:1});await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:points.ex,y:points.ey,button:'left',buttons:0,clickCount:1});await waitFor(()=>page.evaluate(`getSelection().toString()===${JSON.stringify(expected)}`),{timeout:3000,label:`pointer selection ${expected}`})};
try{
  for(const mode of ['native','css-fallback','legacy']){
    console.log('Checking overlay path:',mode);
    const page=await browser.createPage('about:blank',{viewport:{width:900,height:650}});
    const send=page.send.bind(page);page.send=async(method,params)=>{try{return await send(method,params)}catch(error){throw new Error(method+': '+error.message)}};
    if(mode==='legacy')await page.evaluate(`void Object.defineProperty(HTMLElement.prototype,'showPopover',{value:undefined,configurable:true})`);
    if(mode==='css-fallback')await page.evaluate(`(()=>{const supports=CSS.supports.bind(CSS);CSS.supports=(...args)=>args[0]==='position-area'?false:supports(...args)})()`);
    await page.evaluate(bundle,{returnByValue:false});
    await page.evaluate(`(async()=>{
      document.head.insertAdjacentHTML('beforeend','<meta name="viewport" content="width=device-width,initial-scale=1">');
      document.body.innerHTML='<button id="outside">Outside</button><main style="margin:20px;width:620px"><textarea id="note">Alpha Bravo</textarea></main><div style="height:1000px"></div>';
      window.mount=await StudyDirectorRichText.mountRichTextEditor({field:note,label:'Overlay editor',initialValue:note.value,maxWords:10000,maxBytes:917504,assets:{get:async()=>null,put:async()=>{},remove:async()=>{}}});
    })()`);
    await selectTextByPointer(page,'.sd-rte-editor p',0,5,'Alpha');await page.settle();
    await page.click('button[aria-label="Link"]');await page.settle();
    const initial=await box(page);assert.equal(initial.native,mode!=='legacy');assert.equal(initial.open,mode!=='legacy');
    await page.evaluate(`document.querySelector('input[aria-label="Link destination"]').value='https://example.com'`);await key(page,'Enter');
    assert.equal(await page.evaluate(`document.querySelector('.sd-rte-editor a')?.textContent`),'Alpha',`${mode}: link preserves selected text`);
    await page.click('button[aria-label="Typography"]');
    await page.click('button[aria-label="Typography"]');
    assert.equal(await page.evaluate(`document.querySelectorAll('.sd-rte-menu:not([hidden])').length`),0,`${mode}: trigger toggles shut without reopening after native dismissal`);
    await page.click('button[aria-label="Typography"]');await page.click('#outside');
    assert.equal(await page.evaluate(`document.querySelectorAll('.sd-rte-menu:not([hidden])').length`),0,`${mode}: outside dismissal`);
    await page.evaluate(`document.querySelector('button[aria-label="More text formatting"]').focus()`);await key(page,'ArrowDown');await page.settle();
    assert.equal(await page.evaluate(`document.activeElement.getAttribute('aria-label')`),'Underline');
    await key(page,'ArrowDown');assert.equal(await page.evaluate(`document.activeElement.getAttribute('aria-label')`),'Subscript');
    await key(page,'Escape');assert.equal(await page.evaluate(`document.activeElement.getAttribute('aria-label')`),'More text formatting');
    assert.equal(await page.evaluate(`document.querySelector('button[aria-label="More text formatting"]').getAttribute('aria-expanded')`),'false');
    // Closing via the browser API must synchronize application state immediately.
    if(mode!=='legacy'){
      await page.click('button[aria-label="Typography"]');
      await page.evaluate(`document.querySelector('.sd-rte-menu:not([hidden])').hidePopover()`);
      assert.equal(await page.evaluate(`document.querySelector('button[aria-label="Typography"]').getAttribute('aria-expanded')`),'false');
    }
    // Edge positioning and temporary listener cleanup use the same controller as app popups.
    await page.evaluate(`(()=>{
      const t=document.createElement('button'),p=document.createElement('div');t.id='edge';t.textContent='Edge';t.style.cssText='position:fixed;right:9px;bottom:12px;anchor-name:--existing';p.id='edge-popup';p.style.cssText='width:300px;height:110px;background:#223;color:white';p.innerHTML='<button>Popup action</button>';document.body.append(t,p);
      const targets=[document,window,visualViewport].filter(Boolean);window.overlayListeners=0;
      for(const target of targets){const add=target.addEventListener.bind(target),remove=target.removeEventListener.bind(target);target.addEventListener=(...args)=>{overlayListeners++;return add(...args)};target.removeEventListener=(...args)=>{overlayListeners--;return remove(...args)}}
      window.edgeOverlay=StudyDirectorRichText.createAnchoredPopover(p,{align:'end'});edgeOverlay.show(t);
    })()`);await page.settle();
    const edge=await page.evaluate(`(()=>{const r=document.getElementById('edge-popup').getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,listeners:overlayListeners}})()`);
    assert.ok(edge.left>=7&&edge.right<=893&&edge.top>=7&&edge.bottom<=638,`${mode}: edge bounds ${JSON.stringify(edge)}`);
    await page.setViewport({width:390,height:650});
    await page.evaluate(`document.getElementById('edge').style.right='160px';edgeOverlay.show(document.getElementById('edge'))`);await page.settle();
    const narrow=await page.evaluate(`(()=>{const r=document.getElementById('edge-popup').getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}})()`);
    assert.ok(narrow.left>=7&&narrow.right<=383&&narrow.top>=7&&narrow.bottom<=643,`${mode}: centered phone bounds ${JSON.stringify(narrow)}`);
    await page.send('Emulation.setPageScaleFactor',{pageScaleFactor:2});await page.settle();
    const zoom=await page.evaluate(`(()=>{const r=document.getElementById('edge-popup').getBoundingClientRect(),v=visualViewport;return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,viewLeft:v.offsetLeft,viewRight:v.offsetLeft+v.width,viewTop:v.offsetTop,viewBottom:v.offsetTop+v.height}})()`);
    assert.ok(zoom.left>=zoom.viewLeft+7&&zoom.right<=zoom.viewRight-7&&zoom.top>=zoom.viewTop+7&&zoom.bottom<=zoom.viewBottom-7,`${mode}: zoom bounds ${JSON.stringify(zoom)}`);
    await page.evaluate(`edgeOverlay.destroy()`);
    assert.equal(await page.evaluate('overlayListeners'),0,`${mode}: all temporary global listeners removed`);
    assert.equal(await page.evaluate(`document.getElementById('edge').style.getPropertyValue('anchor-name')`),'--existing');
    await page.evaluate('mount.destroy()');assert.equal(await page.evaluate(`document.querySelectorAll('[popover]:popover-open').length`),0);
    results.push({mode,initial,edge,narrow,zoom});console.log('Passed overlay path:',mode);await browser.closePage(page);
  }
  // Exercise the actual composed host, including tooltip placement inside inert focus mode.
  server=await startReleaseServer();
  const preload=`localStorage.setItem('studyDirector.userDefaults.v1',JSON.stringify({version:1,studentName:'Overlay QA',updatedAt:new Date().toISOString()}));`;
  const page=await browser.createPage(server.url('deployment','instrumented.html'),{preload});
  await waitForStudyDirector(page,{instrumented:true});
  await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().hasControl`));
  await page.evaluate(`(()=>{const now=new Date(),time=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');document.getElementById('plan-input').value=time+' | 30 | Study | work | History | pages | 10';__PWA6.applySchedule({skipNotify:true});__PWA6.setCurrentTask(0,{force:true});__PWA6.goTab('execute');__PWA6.refreshPnote({force:true})})()`);
  await waitFor(()=>page.evaluate(`document.querySelector('#pnote .sd-rte')!==null`),{label:'mounted ongoing-notes editor'});
  await page.click('#pn-info-btn');
  assert.equal(await page.evaluate(`document.getElementById('pn-info-popover').matches(':popover-open')`),true);
  await page.click('#display-tools-trigger');
  assert.equal(await page.evaluate(`document.getElementById('pn-info-popover').hidden`),true);
  assert.equal(await page.evaluate(`document.getElementById('display-tools-menu').matches(':popover-open')`),true);
  await key(page,'Escape');
  await page.click('#pnote .sd-rte .sd-rte-focus-trigger');
  await page.evaluate(`document.querySelector('.sd-rte-focus-sync').focus()`);await page.settle();
  const tip=await page.evaluate(`(()=>{const p=document.getElementById('note-sync-popover'),r=p.getBoundingClientRect(),t=document.querySelector('.sd-rte-focus-sync');return {native:p.matches(':popover-open'),inside:!!p.closest('.workspace-overlay-rich-text'),inert:p.inert,described:t.getAttribute('aria-describedby'),right:r.right,bottom:r.bottom}})()`);
  assert.equal(tip.native,true);assert.equal(tip.inside,true);assert.equal(tip.inert,false);assert.equal(tip.described,'note-sync-popover');assert.ok(tip.right<=1365&&tip.bottom<=900);
  await page.screenshot(artifactPath('focus-tooltip.png'));
  await key(page,'Escape');assert.equal(await page.evaluate(`!!document.querySelector('dialog.workspace-overlay-rich-text')`),true);
  assert.equal(await page.evaluate(`document.querySelector('.sd-rte-focus-sync').hasAttribute('aria-describedby')`),false);
  await page.click('.workspace-overlay-rich-text .workspace-overlay-close');
  results.push({host:tip});await browser.closePage(page);
  writeArtifact('native-overlays.json',JSON.stringify({status:'PASS',results},null,2)+'\n');
  console.log(JSON.stringify({status:'PASS',results},null,2));
}finally{await browser.close();if(server)await server.close()}
