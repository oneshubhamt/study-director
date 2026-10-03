import assert from 'node:assert/strict';
import fs from 'node:fs';
import {launchChromium,waitFor} from '../../helpers/browser-harness.mjs';

const bundle=fs.readFileSync('source/external/rich-text.js','utf8');
const browser=await launchChromium({profilePrefix:'qa-image-resize-toolbar-'});let page;
try{
  page=await browser.createPage('about:blank',{viewport:{width:1120,height:820,mobile:false,scale:1}});
  await page.evaluate(bundle,{returnByValue:false});
  const value='WG1:'+JSON.stringify({version:1,doc:{type:'Doc',content:[{type:'SDImage',param:{assetId:'img-12345678901234567890',alt:'resize probe',widthPct:68}},{type:'Paragraph',content:[{type:'Text',param:'After image'}]}]}});
  await page.evaluate(`(async()=>{
    document.body.innerHTML='<main style="width:900px;margin:24px"><textarea id="image"></textarea><textarea id="plain">Toolbar clarity</textarea></main>';
    image.value=${JSON.stringify(value)};
    const c=document.createElement('canvas');c.width=900;c.height=600;c.getContext('2d').fillRect(0,0,900,600);window.__blob=await new Promise(r=>c.toBlob(r,'image/png'));
    window.__resolveAsset=null;window.assets={get:async()=>await new Promise(r=>__resolveAsset=r),put:async()=>{},remove:async()=>{}};
    window.imageMount=await StudyDirectorRichText.mountRichTextEditor({field:image,label:'Resize probe',initialValue:image.value,maxWords:10000,maxBytes:917504,assets});
    window.plainMount=await StudyDirectorRichText.mountRichTextEditor({field:plain,label:'Toolbar probe',initialValue:plain.value,maxWords:10000,maxBytes:917504,assets:{get:async()=>null,put:async()=>{},remove:async()=>{}}});
  })()`);

  // Toolbar: semantic groups, visible separators, and readable control contrast.
  const toolbar=await page.evaluate(`(()=>{
    const root=document.querySelector('#plain + .sd-rte'),groups=[...root.querySelectorAll('.sd-rte-toolbar-group')],bold=root.querySelector('button[aria-label="Bold"]'),panel=getComputedStyle(root.querySelector('.sd-rte-toolbar')).backgroundColor;
    const parse=s=>{if(s.startsWith('rgb'))return s.slice(s.indexOf('(')+1,s.indexOf(')')).split(',').slice(0,3).map(Number);if(s.startsWith('color(srgb '))return s.slice(11,s.lastIndexOf(')')).split(' ').filter(Boolean).slice(0,3).map(v=>Number(v)*255);return [0,0,0]},lum=rgb=>{const a=rgb.map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4});return .2126*a[0]+.7152*a[1]+.0722*a[2]},ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
    return {labels:groups.map(g=>g.getAttribute('aria-label')),separators:groups.filter(g=>g.previousElementSibling?.classList.contains('sd-rte-toolbar-group')).map(g=>({width:getComputedStyle(g).borderLeftWidth,style:getComputedStyle(g).borderLeftStyle,color:getComputedStyle(g).borderLeftColor})),boldColor:getComputedStyle(bold).color,boldOpacity:getComputedStyle(bold).opacity,contrast:ratio(parse(getComputedStyle(bold).color),parse(panel)),utilityClass:!!root.querySelector('.sd-rte-toolbar-group-utility')};
  })()`);
  assert.deepEqual(toolbar.labels,['History','Text formatting','Paragraph and lists','Links and attachments','Insert blocks']);
  assert.ok(toolbar.separators.every(x=>x.width==='1px'&&x.style==='solid'&&!/rgba\([^,]+,[^,]+,[^,]+,\s*0\)/.test(x.color)),'Toolbar groups must have visible vertical separators.');
  assert.ok(toolbar.contrast>=7,`Toolbar enabled-control contrast is too faint (${toolbar.contrast.toFixed(2)}:1).`);
  assert.equal(toolbar.boldOpacity,'1');
  assert.equal(toolbar.utilityClass,false,'Standalone editors without an overlay port must omit the focus-mode control.');

  // Begin a live resize while the image is still unresolved, then force a Wordgard image render
  // replacement during the drag. The visible width must not snap back to the stored 68%.
  const dragStart=await page.evaluate(`(async()=>{
    window.__imageResizeInputs=0;image.addEventListener('input',()=>window.__imageResizeInputs++);const figure=document.querySelector('#image + .sd-rte .sd-rte-image'),handle=figure.querySelector('.sd-rte-image-resize'),rect=handle.getBoundingClientRect(),base=document.querySelector('#image + .sd-rte .sd-rte-editor').getBoundingClientRect().width,originalRect=figure.getBoundingClientRect().width,hadImage=!!figure.querySelector('img');
    window.__resizeStart={x:rect.left+10,y:rect.top+10,base};
    handle.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,clientX:__resizeStart.x,clientY:__resizeStart.y,pointerId:52,pointerType:'mouse',buttons:1}));
    window.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,cancelable:true,clientX:__resizeStart.x-110,clientY:__resizeStart.y,pointerId:52,pointerType:'mouse',buttons:1}));
    await new Promise(r=>requestAnimationFrame(r));
    const live=document.querySelector('#image + .sd-rte .sd-rte-image');return {originalRect,hadImage,rect:live.getBoundingClientRect().width,computed:getComputedStyle(live).width,style:live.style.width,stored:JSON.parse(image.value.slice(4)).doc.content.find(n=>n.type==='SDImage').param.widthPct,inputs:window.__imageResizeInputs};
  })()`);
  assert.equal(dragStart.stored,68,'Resize preview must remain non-persistent until drag end.');
  assert.equal(dragStart.inputs,0,'Transient image resize must not emit host input events.');
  assert.equal(dragStart.hadImage,false,'The regression test must begin before asynchronous image hydration completes.');
  assert.ok(dragStart.rect>0);
  assert.ok(Math.abs(dragStart.rect-dragStart.originalRect)>8,'The drag must visibly move away from the stored 68% geometry before hydration.');

  await page.evaluate(`__resolveAsset(__blob)`);
  await waitFor(()=>page.evaluate(`!!document.querySelector('#image + .sd-rte .sd-rte-image img')`),{label:'mid-drag image hydration'});
  await page.settle();
  const hydrated=await page.evaluate(`(()=>{const live=document.querySelector('#image + .sd-rte .sd-rte-image');return {hasImage:!!live.querySelector('img'),rect:live.getBoundingClientRect().width,computed:getComputedStyle(live).width,style:live.style.width,selected:live.classList.contains('wg-selected-node'),stored:JSON.parse(image.value.slice(4)).doc.content.find(n=>n.type==='SDImage').param.widthPct}})()`);
  assert.equal(hydrated.hasImage,true,'The regression test must exercise an asynchronous image render while resizing.');
  assert.equal(hydrated.stored,68);
  assert.equal(hydrated.selected,true);
  assert.ok(Math.abs(hydrated.rect-dragStart.rect)<=1,`Hydration snapped visible width ${dragStart.rect.toFixed(1)} → ${hydrated.rect.toFixed(1)}.`);

  const widths=[];
  for(const delta of [-125,-140,-155,-170]){
    await page.evaluate(`window.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,cancelable:true,clientX:__resizeStart.x+${delta},clientY:__resizeStart.y,pointerId:52,pointerType:'mouse',buttons:1}))`);
    await page.evaluate(`new Promise(r=>requestAnimationFrame(r))`);
    widths.push(await page.evaluate(`document.querySelector('#image + .sd-rte .sd-rte-image').getBoundingClientRect().width`));
  }
  for(let i=1;i<widths.length;i++)assert.ok(widths[i]<=widths[i-1]+1,`Resize preview was not monotonic: ${widths.join(', ')}`);
  assert.ok(widths.every(width=>Math.abs(width-dragStart.originalRect)>8),'Preview must not transiently return to the stored 68% geometry.');

  await page.evaluate(`window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,cancelable:true,clientX:__resizeStart.x-170,clientY:__resizeStart.y,pointerId:52,pointerType:'mouse',buttons:0}))`);
  await page.evaluate(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
  const committed=await page.evaluate(`(()=>{const live=document.querySelector('#image + .sd-rte .sd-rte-image'),stored=JSON.parse(image.value.slice(4)).doc.content.find(n=>n.type==='SDImage').param.widthPct;return {stored,style:parseFloat(live.style.width),computed:live.getBoundingClientRect().width,preview:document.querySelector('#image + .sd-rte .sd-rte-wordgard').dataset.sdImageResizing||'',inputs:window.__imageResizeInputs}})()`);
  assert.notEqual(committed.stored,68);
  assert.equal(committed.style,committed.stored);
  assert.equal(committed.preview,'','Transient resize preview state must clear after commit.');
  assert.equal(committed.inputs,1,'Image resize must emit exactly one host input event on final commit.');

  // On coarse-pointer layouts the groups retain touch targets and separators while scrolling horizontally.
  await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await page.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  await page.evaluate(`document.querySelector('main').style.width='350px'`);
  const mobile=await page.evaluate(`(()=>{const root=document.querySelector('#plain + .sd-rte'),button=root.querySelector('button[aria-label="Bold"]'),group=root.querySelector('.sd-rte-toolbar-group[aria-label="Text formatting"]'),toolbar=root.querySelector('.sd-rte-toolbar');return {buttonWidth:button.getBoundingClientRect().width,buttonHeight:button.getBoundingClientRect().height,groupHeight:group.getBoundingClientRect().height,overflow:document.documentElement.scrollWidth-innerWidth,toolbarOverflow:toolbar.scrollWidth>=toolbar.clientWidth}})()`);
  assert.ok(mobile.buttonWidth>=44&&mobile.buttonHeight>=44,'Mobile toolbar controls must retain 44px targets.');
  assert.ok(mobile.groupHeight>=44);
  assert.equal(mobile.overflow,0,'Toolbar grouping must not create page-level mobile overflow.');

  assert.deepEqual(page.events,[],'QA_FIXTURE image-resize/toolbar browser test produced runtime errors.');
  console.log(JSON.stringify({status:'PASS',suite:'image-resize-toolbar',toolbar,dragStart,hydrated,widths,committed,mobile},null,2));
}finally{if(page)await browser.closePage(page).catch(()=>{});await browser.close()}
