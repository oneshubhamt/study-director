import assert from 'node:assert/strict';
import fs from 'node:fs';
import {launchChromium,waitFor} from '../../helpers/browser-harness.mjs';

const bundle=fs.readFileSync('source/external/rich-text.js','utf8');
const browser=await launchChromium({profilePrefix:'qa-table-resize-controls-'});let page;
const root=content=>'WG1:'+JSON.stringify({version:1,doc:{type:'Doc',content}});
const text=param=>({type:'Text',param});
const paragraph=value=>({type:'Paragraph',content:value?[text(value)]:[]});
const imageId='img-12345678901234567890';
const imageValue=root([
  {type:'BulletList',content:[{type:'ListItem',content:[paragraph('Bullet before image')]}]},
  {type:'SDImage',param:{assetId:imageId,alt:'resize image',widthPct:68}},
  paragraph('After image')
]);

try{
  page=await browser.createPage('about:blank',{viewport:{width:1120,height:900,mobile:false,scale:1}});
  await page.evaluate(bundle,{returnByValue:false});
  await page.evaluate(`(async()=>{
    document.body.innerHTML='<main style="display:grid;gap:24px;width:680px;margin:20px"><textarea id="table" style="height:520px">Before table</textarea><textarea id="image" style="height:420px"></textarea></main>';
    image.value=${JSON.stringify(imageValue)};
    const c=document.createElement('canvas');c.width=1000;c.height=700;c.getContext('2d').fillRect(0,0,1000,700);const blob=await new Promise(r=>c.toBlob(r,'image/png'));
    window.assets={get:async id=>id===${JSON.stringify(imageId)}?blob:null,put:async()=>{},remove:async()=>{}};
    window.tableMount=await StudyDirectorRichText.mountRichTextEditor({field:table,label:'Table editor',initialValue:table.value,maxWords:10000,maxBytes:917504,assets:{get:async()=>null,put:async()=>{},remove:async()=>{}}});
    window.imageMount=await StudyDirectorRichText.mountRichTextEditor({field:image,label:'Image editor',initialValue:image.value,maxWords:10000,maxBytes:917504,assets});
  })()`);
  await waitFor(()=>page.evaluate(`!!document.querySelector('#image + .sd-rte .sd-rte-image img')`),{label:'image hydration'});

  // Table insertion: reveal contextual controls by scrolling the toolbar only, with no vertical jump.
  const beforeInsert=await page.evaluate(`(()=>{const root=document.querySelector('#table + .sd-rte'),toolbar=root.querySelector('.sd-rte-toolbar-rail'),scroller=root.querySelector('wg-scroller');toolbar.scrollLeft=0;return {pageY:scrollY,editorY:scroller.scrollTop,wrapperH:root.getBoundingClientRect().height,toolbarLeft:toolbar.scrollLeft,toolbarClient:toolbar.clientWidth,toolbarScroll:toolbar.scrollWidth}})()`);
  assert.ok(beforeInsert.toolbarScroll>beforeInsert.toolbarClient,'Regression fixture must have a horizontally overflowing toolbar.');
  await page.click('#table + .sd-rte button[aria-label="Insert 2 × 2 table"]');
  await waitFor(()=>page.evaluate(`(()=>{const root=document.querySelector('#table + .sd-rte'),tools=root.querySelector('.sd-rte-table-tools'),toolbar=root.querySelector('.sd-rte-toolbar-rail');return !tools.hidden&&toolbar.scrollLeft>0})()`),{label:'table controls reveal'});
  await page.settle();
  const revealed=await page.evaluate(`(()=>{const root=document.querySelector('#table + .sd-rte'),toolbar=root.querySelector('.sd-rte-toolbar-rail'),tools=root.querySelector('.sd-rte-table-tools'),scroller=root.querySelector('wg-scroller'),rowAdd=tools.querySelector('button[aria-label="Add row"]'),bold=root.querySelector('button[aria-label="Bold"]'),tr=tools.getBoundingClientRect(),br=toolbar.getBoundingClientRect();return {pageY:scrollY,editorY:scroller.scrollTop,wrapperH:root.getBoundingClientRect().height,toolbarLeft:toolbar.scrollLeft,toolsVisible:tr.left>=br.left-1&&tr.right<=br.right+1,rowColor:getComputedStyle(rowAdd).color,rowBorder:getComputedStyle(rowAdd).borderColor,boldColor:getComputedStyle(bold).color,tableLabel:getComputedStyle(tools.querySelector('.sd-rte-table-tools-label')).color}})()`);
  assert.equal(revealed.pageY,beforeInsert.pageY,'Table-control reveal must not scroll the page vertically.');
  assert.equal(revealed.editorY,beforeInsert.editorY,'Table-control reveal must not scroll the editor surface vertically.');
  assert.ok(Math.abs(revealed.wrapperH-beforeInsert.wrapperH)<=1,'Table controls must not resize the editor shell.');
  assert.ok(revealed.toolbarLeft>0,'Entering a table must horizontally reveal its contextual controls.');
  assert.equal(revealed.toolsVisible,true,'Table controls should be brought into the visible toolbar viewport.');
  assert.notEqual(revealed.rowColor,revealed.boldColor,'Table controls must be visually distinct from ordinary text controls.');
  assert.notEqual(revealed.rowBorder,'rgba(0, 0, 0, 0)','Table controls must have a visible contextual border.');

  // The auto-reveal must be transition based: do not fight deliberate toolbar scrolling while the caret remains in the table.
  await page.evaluate(`document.querySelector('#table + .sd-rte .sd-rte-toolbar-rail').scrollLeft=0`);
  const firstCellPoint=await page.evaluate(`(()=>{const r=document.querySelector('#table + .sd-rte td').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
  await page.send('Input.dispatchMouseEvent',{type:'mousePressed',x:firstCellPoint.x,y:firstCellPoint.y,button:'left',buttons:1,clickCount:1});
  await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:firstCellPoint.x,y:firstCellPoint.y,button:'left',buttons:0,clickCount:1});
  await page.settle();
  assert.ok((await page.evaluate(`document.querySelector('#table + .sd-rte .sd-rte-toolbar-rail').scrollLeft`))<=2,'Caret movement within an already-active table must not repeatedly force toolbar scrolling.');

  // Leave the table, then re-enter: controls should reveal again because this is a new table-context transition.
  const paragraphPoint=await page.evaluate(`(()=>{const r=document.querySelector('#table + .sd-rte .sd-rte-editor > p').getBoundingClientRect();return {x:r.left+12,y:r.top+r.height/2}})()`);
  await page.send('Input.dispatchMouseEvent',{type:'mousePressed',x:paragraphPoint.x,y:paragraphPoint.y,button:'left',buttons:1,clickCount:1});
  await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:paragraphPoint.x,y:paragraphPoint.y,button:'left',buttons:0,clickCount:1});
  await waitFor(()=>page.evaluate(`document.querySelector('#table + .sd-rte .sd-rte-table-tools').hidden`),{label:'leave table context'});
  await page.evaluate(`document.querySelector('#table + .sd-rte .sd-rte-toolbar-rail').scrollLeft=0`);
  await page.send('Input.dispatchMouseEvent',{type:'mousePressed',x:firstCellPoint.x,y:firstCellPoint.y,button:'left',buttons:1,clickCount:1});
  await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:firstCellPoint.x,y:firstCellPoint.y,button:'left',buttons:0,clickCount:1});
  await waitFor(()=>page.evaluate(`document.querySelector('#table + .sd-rte .sd-rte-toolbar-rail').scrollLeft>0`),{label:'re-enter table reveal'});

  // Table-width resize: sustained movement must be monotonic and preview state must clear after one final commit.
  const startTable=await page.evaluate(`(()=>{const field=document.querySelector('#table'),cell=[...document.querySelectorAll('#table + .sd-rte tr:first-child td')].at(-1),table=cell.closest('table'),r=cell.getBoundingClientRect();window.__tableResizeInputs=0;field.addEventListener('input',()=>window.__tableResizeInputs++);window.__tableDrag={x:r.right-1,y:r.top+r.height/2};return {width:table.getBoundingClientRect().width,stored:JSON.parse(field.value.slice(4)).doc.content.find(n=>n.type==='Table').marks.SDTableWidth}})()`);
  await page.evaluate(`(()=>{const cell=[...document.querySelectorAll('#table + .sd-rte tr:first-child td')].at(-1);cell.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,clientX:__tableDrag.x,clientY:__tableDrag.y,pointerId:73,pointerType:'mouse',buttons:1}))})()`);
  const tableWidths=[],tableClobberWidths=[];
  for(const dx of [-15,-25,-35,-45,-55,-65,-75,-85]){
    await page.evaluate(`window.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,cancelable:true,clientX:__tableDrag.x+${dx},clientY:__tableDrag.y,pointerId:73,pointerType:'mouse',buttons:1}))`);
    await page.evaluate(`new Promise(r=>requestAnimationFrame(r))`);
    tableWidths.push(await page.evaluate(`document.querySelector('#table + .sd-rte table').getBoundingClientRect().width`));
    // Simulate Wordgard reconciliation restoring canonical inline geometry during an active drag.
    // Wordgard-owned transient decorations must survive reconciliation and restore the preview by the next paint.
    await page.evaluate(`(()=>{const table=document.querySelector('#table + .sd-rte table');table.style.width=${JSON.stringify(String(startTable.stored)+'%')}})()`);
    await page.evaluate(`new Promise(r=>requestAnimationFrame(r))`);
    tableClobberWidths.push(await page.evaluate(`document.querySelector('#table + .sd-rte table').getBoundingClientRect().width`));
  }
  for(let i=1;i<tableWidths.length;i++)assert.ok(tableWidths[i]<=tableWidths[i-1]+1,`Table width preview snapped during drag: ${tableWidths.join(', ')}`);
  assert.ok(tableWidths.every(width=>Math.abs(width-startTable.width)>3),'Table resize preview must not transiently return to its starting geometry.');
  tableClobberWidths.forEach((width,index)=>assert.ok(Math.abs(width-tableWidths[index])<=1.5,`Table preview was not repaired after canonical-style clobber: preview=${tableWidths[index]}, repaired=${width}`));
  const duringTable=await page.evaluate(`(()=>{const root=document.querySelector('#table + .sd-rte'),stored=JSON.parse(document.querySelector('#table').value.slice(4)).doc.content.find(n=>n.type==='Table').marks.SDTableWidth;return {mode:root.querySelector('.sd-rte-wordgard').dataset.sdTableResizing,stored,inputs:window.__tableResizeInputs}})()`);
  assert.equal(duringTable.mode,'table');
  assert.equal(duringTable.stored,startTable.stored,'Table resize must remain non-persistent until pointer-up.');
  assert.equal(duringTable.inputs,0,'Transient table-resize effects must not emit host input events before pointer-up.');
  await page.evaluate(`window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,cancelable:true,clientX:__tableDrag.x-85,clientY:__tableDrag.y,pointerId:73,pointerType:'mouse',buttons:0}))`);
  await page.evaluate(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
  const committedTable=await page.evaluate(`(()=>{const root=document.querySelector('#table + .sd-rte'),node=JSON.parse(document.querySelector('#table').value.slice(4)).doc.content.find(n=>n.type==='Table');return {stored:node.marks.SDTableWidth,mode:root.querySelector('.sd-rte-wordgard').dataset.sdTableResizing||'',inputs:window.__tableResizeInputs}})()`);
  assert.notEqual(committedTable.stored,startTable.stored);
  assert.equal(committedTable.mode,'');
  assert.equal(committedTable.inputs,1,'Table resize must emit exactly one host input event for the final document commit.');

  // Column and row resizing use the same Wordgard transient-decoration path and remain monotonic.
  const colStart=await page.evaluate(`(()=>{const cell=document.querySelector('#table + .sd-rte tr:first-child td:first-child'),r=cell.getBoundingClientRect();window.__colDrag={x:r.right-1,y:r.top+r.height/2};return [...document.querySelectorAll('#table + .sd-rte tr:first-child td')].map(c=>c.getBoundingClientRect().width)})()`);
  await page.evaluate(`document.querySelector('#table + .sd-rte tr:first-child td:first-child').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,clientX:__colDrag.x,clientY:__colDrag.y,pointerId:74,pointerType:'mouse',buttons:1}))`);
  const colWidths=[],colClobberWidths=[];
  for(const dx of [18,32,46]){await page.evaluate(`window.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,cancelable:true,clientX:__colDrag.x+${dx},clientY:__colDrag.y,pointerId:74,pointerType:'mouse',buttons:1}))`);await page.evaluate(`new Promise(r=>requestAnimationFrame(r))`);colWidths.push(await page.evaluate(`document.querySelector('#table + .sd-rte tr:first-child td:first-child').getBoundingClientRect().width`));await page.evaluate(`(()=>{const cells=[...document.querySelectorAll('#table + .sd-rte tr:first-child td')];cells[0].style.width='50%';cells[1].style.width='50%'})()`);await page.evaluate(`new Promise(r=>requestAnimationFrame(r))`);colClobberWidths.push(await page.evaluate(`document.querySelector('#table + .sd-rte tr:first-child td:first-child').getBoundingClientRect().width`));}
  for(let i=1;i<colWidths.length;i++)assert.ok(colWidths[i]>=colWidths[i-1]-1,`Column preview snapped: ${colWidths.join(', ')}`);
  colClobberWidths.forEach((width,index)=>assert.ok(Math.abs(width-colWidths[index])<=1.5,`Column preview was not repaired after style clobber: preview=${colWidths[index]}, repaired=${width}`));
  assert.ok(colWidths.at(-1)>colStart[0]+3);
  await page.evaluate(`window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,cancelable:true,clientX:__colDrag.x+46,clientY:__colDrag.y,pointerId:74,pointerType:'mouse',buttons:0}))`);
  await page.evaluate(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);

  const rowStart=await page.evaluate(`(()=>{const cell=document.querySelector('#table + .sd-rte tr:first-child td:first-child'),r=cell.getBoundingClientRect();window.__rowDrag={x:r.left+r.width/2,y:r.bottom-1};return r.height})()`);
  await page.evaluate(`document.querySelector('#table + .sd-rte tr:first-child td:first-child').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,clientX:__rowDrag.x,clientY:__rowDrag.y,pointerId:75,pointerType:'mouse',buttons:1}))`);
  const rowHeights=[],rowClobberHeights=[];
  for(const dy of [12,24,36]){await page.evaluate(`window.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,cancelable:true,clientX:__rowDrag.x,clientY:__rowDrag.y+${dy},pointerId:75,pointerType:'mouse',buttons:1}))`);await page.evaluate(`new Promise(r=>requestAnimationFrame(r))`);rowHeights.push(await page.evaluate(`document.querySelector('#table + .sd-rte tr:first-child td:first-child').getBoundingClientRect().height`));await page.evaluate(`document.querySelectorAll('#table + .sd-rte tr:first-child td').forEach(cell=>cell.style.height=${JSON.stringify(String(rowStart)+'px')})`);await page.evaluate(`new Promise(r=>requestAnimationFrame(r))`);rowClobberHeights.push(await page.evaluate(`document.querySelector('#table + .sd-rte tr:first-child td:first-child').getBoundingClientRect().height`));}
  for(let i=1;i<rowHeights.length;i++)assert.ok(rowHeights[i]>=rowHeights[i-1]-1,`Row preview snapped: ${rowHeights.join(', ')}`);
  rowClobberHeights.forEach((height,index)=>assert.ok(Math.abs(height-rowHeights[index])<=1.5,`Row preview was not repaired after style clobber: preview=${rowHeights[index]}, repaired=${height}`));
  assert.ok(rowHeights.at(-1)>rowStart+3);
  await page.evaluate(`window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,cancelable:true,clientX:__rowDrag.x,clientY:__rowDrag.y+36,pointerId:75,pointerType:'mouse',buttons:0}))`);
  await page.evaluate(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);

  // Repeated same-instance resize stress: alternate table width in both directions while deliberately
  // restoring canonical geometry mid-drag. This catches intermittent reconciliation snap-back without
  // conflating production behavior with repeated Chromium process startup.
  const stressCycles=[];
  for(let cycle=0;cycle<12;cycle++){
    const pointerId=100+cycle,dx=cycle%2===0?-24:24;
    const start=await page.evaluate(`(()=>{const cell=[...document.querySelectorAll('#table + .sd-rte tr:first-child td')].at(-1),table=cell.closest('table'),r=cell.getBoundingClientRect(),stored=JSON.parse(document.querySelector('#table').value.slice(4)).doc.content.find(n=>n.type==='Table').marks.SDTableWidth;window.__stressDrag={x:r.right-1,y:r.top+r.height/2};return {width:table.getBoundingClientRect().width,stored}})()`);
    await page.evaluate(`(()=>{const cell=[...document.querySelectorAll('#table + .sd-rte tr:first-child td')].at(-1);cell.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,clientX:__stressDrag.x,clientY:__stressDrag.y,pointerId:${pointerId},pointerType:'mouse',buttons:1}))})()`);
    await page.evaluate(`window.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,cancelable:true,clientX:__stressDrag.x+${dx},clientY:__stressDrag.y,pointerId:${pointerId},pointerType:'mouse',buttons:1}))`);
    await page.evaluate(`new Promise(r=>requestAnimationFrame(r))`);
    const preview=await page.evaluate(`document.querySelector('#table + .sd-rte table').getBoundingClientRect().width`);
    assert.ok(Math.abs(preview-start.width)>2,`Stress cycle ${cycle+1} did not produce a visible table-width preview.`);
    await page.evaluate(`document.querySelector('#table + .sd-rte table').style.width=${JSON.stringify(String(start.stored)+'%')}`);
    await page.evaluate(`new Promise(r=>requestAnimationFrame(r))`);
    const repaired=await page.evaluate(`document.querySelector('#table + .sd-rte table').getBoundingClientRect().width`);
    assert.ok(Math.abs(repaired-preview)<=1.5,`Stress cycle ${cycle+1} snapped after canonical-style clobber: preview=${preview}, repaired=${repaired}`);
    const storedDuring=await page.evaluate(`JSON.parse(document.querySelector('#table').value.slice(4)).doc.content.find(n=>n.type==='Table').marks.SDTableWidth`);
    assert.equal(storedDuring,start.stored,`Stress cycle ${cycle+1} persisted before pointer-up.`);
    await page.evaluate(`window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,cancelable:true,clientX:__stressDrag.x+${dx},clientY:__stressDrag.y,pointerId:${pointerId},pointerType:'mouse',buttons:0}))`);
    await page.evaluate(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    const storedAfter=await page.evaluate(`JSON.parse(document.querySelector('#table').value.slice(4)).doc.content.find(n=>n.type==='Table').marks.SDTableWidth`);
    assert.notEqual(storedAfter,start.stored,`Stress cycle ${cycle+1} did not commit on pointer-up.`);
    stressCycles.push({cycle:cycle+1,preview,repaired});
  }

  // Image-resize atomic interaction: even if the previous caret was in a bullet list, list controls must
  // immediately clear and stay clear throughout the drag.
  await page.click('#image + .sd-rte li');
  await waitFor(()=>page.evaluate(`document.querySelector('#image + .sd-rte button[aria-label="Bulleted list"]').getAttribute('aria-pressed')==='true'`),{label:'bullet list active before image resize'});
  const imageHandle=await page.evaluate(`(()=>{const h=document.querySelector('#image + .sd-rte .sd-rte-image-resize'),r=h.getBoundingClientRect();window.__imageDrag={x:r.left+r.width/2,y:r.top+r.height/2};return true})()`);assert.equal(imageHandle,true);
  await page.evaluate(`document.querySelector('#image + .sd-rte .sd-rte-image-resize').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,clientX:__imageDrag.x,clientY:__imageDrag.y,pointerId:76,pointerType:'mouse',buttons:1}))`);
  await page.evaluate(`window.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,cancelable:true,clientX:__imageDrag.x-70,clientY:__imageDrag.y,pointerId:76,pointerType:'mouse',buttons:1}))`);
  await page.evaluate(`new Promise(r=>requestAnimationFrame(r))`);
  const listDuringImage=await page.evaluate(`(()=>{const root=document.querySelector('#image + .sd-rte');return Object.fromEntries(['Bulleted list','Numbered list','Checklist'].map(label=>{const b=root.querySelector('button[aria-label="'+label+'"]');return [label,{pressed:b.getAttribute('aria-pressed'),disabled:b.disabled}]}))})()`);
  for(const state of Object.values(listDuringImage)){assert.equal(state.pressed,'false','List controls must not appear active while an image resize owns the interaction.');assert.equal(state.disabled,true,'List controls must be disabled during an image resize.');}
  await page.evaluate(`window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,cancelable:true,clientX:__imageDrag.x-70,clientY:__imageDrag.y,pointerId:76,pointerType:'mouse',buttons:0}))`);

  // Mobile: contextual tools remain distinct, auto-reveal inside the toolbar, and retain 44px targets.
  await page.setViewport({width:390,height:844,mobile:true,scale:1});
  await page.evaluate(`document.querySelector('main').style.width='350px';const toolbar=document.querySelector('#table + .sd-rte .sd-rte-toolbar-rail');toolbar.scrollLeft=0`);
  const mobileParagraph=await page.evaluate(`(()=>{const r=document.querySelector('#table + .sd-rte .sd-rte-editor > p').getBoundingClientRect();return {x:r.left+8,y:r.top+r.height/2}})()`);
  await page.send('Input.dispatchMouseEvent',{type:'mousePressed',x:mobileParagraph.x,y:mobileParagraph.y,button:'left',buttons:1,clickCount:1});await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:mobileParagraph.x,y:mobileParagraph.y,button:'left',buttons:0,clickCount:1});
  const mobileCell=await page.evaluate(`(()=>{const r=document.querySelector('#table + .sd-rte td').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
  await page.send('Input.dispatchMouseEvent',{type:'mousePressed',x:mobileCell.x,y:mobileCell.y,button:'left',buttons:1,clickCount:1});await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:mobileCell.x,y:mobileCell.y,button:'left',buttons:0,clickCount:1});
  await waitFor(()=>page.evaluate(`document.querySelector('#table + .sd-rte .sd-rte-toolbar-rail').scrollLeft>0`),{label:'mobile table tool reveal'});
  await page.settle();
  const mobile=await page.evaluate(`(()=>{const root=document.querySelector('#table + .sd-rte'),tools=root.querySelector('.sd-rte-table-tools'),toolbar=root.querySelector('.sd-rte-toolbar-rail'),add=tools.querySelector('button[aria-label="Add row"]'),label=tools.querySelector('.sd-rte-table-tools-label'),ar=add.getBoundingClientRect(),lr=label.getBoundingClientRect(),br=toolbar.getBoundingClientRect();return {w:ar.width,h:ar.height,startVisible:lr.left>=br.left-1&&lr.right<=br.right+1,rowAddVisible:ar.left>=br.left-1&&ar.right<=br.right+1,pageOverflow:document.documentElement.scrollWidth-innerWidth,scrollLeft:toolbar.scrollLeft}})()`);
  assert.ok(mobile.w>=44&&mobile.h>=44,'Table controls must retain 44px mobile targets.');
  assert.equal(mobile.startVisible,true,'Auto-reveal should expose the Table context label on mobile.');
  assert.equal(mobile.rowAddVisible,true,'Auto-reveal should expose the first row controls on mobile.');
  assert.equal(mobile.pageOverflow,0);

  // Touch resize uses the same column-width engine as desktop, exposed through a subtle midpoint grip.
  await waitFor(()=>page.evaluate(`(()=>{const ruler=document.querySelector('#table + .sd-rte .sd-rte-table-ruler'),handle=ruler?.querySelector('.sd-rte-table-ruler-handle:not([hidden])');return !!ruler&&!ruler.hidden&&!!handle})()`),{label:'mobile table resize grip'});
  const touchStart=await page.evaluate(`(()=>{const root=document.querySelector('#table + .sd-rte'),table=root.querySelector('table'),ruler=root.querySelector('.sd-rte-table-ruler'),handle=ruler.querySelector('.sd-rte-table-ruler-handle:not([hidden])'),hr=handle.getBoundingClientRect(),tr=table.getBoundingClientRect(),v=visualViewport,visibleTop=Math.max(tr.top,v.offsetTop+4),visibleBottom=Math.min(tr.bottom,v.offsetTop+v.height-4),visual=getComputedStyle(handle,'::before'),node=JSON.parse(document.querySelector('#table').value.slice(4)).doc.content.find(n=>n.type==='Table'),widths=node.content[0].content.map(c=>c.marks.SDCellWidth);window.__touchResize={x:hr.left+hr.width/2,y:hr.top+hr.height/2};return {x:__touchResize.x,y:__touchResize.y,handle:{width:hr.width,height:hr.height,visualWidth:parseFloat(visual.width),visualHeight:parseFloat(visual.height),background:visual.backgroundColor},midpoint:(visibleTop+visibleBottom)/2,widths}})()`);
  assert.ok(touchStart.handle.width>=44&&touchStart.handle.height>=44,'Mobile table resize grip must retain a 44px touch target.');assert.ok(touchStart.handle.visualWidth>=6&&touchStart.handle.visualWidth<=10&&touchStart.handle.visualHeight>=20&&touchStart.handle.visualHeight<=30,'Visible resize affordance should be a subtle compact rectangle rather than the whole hit target.');assert.ok(Math.abs(touchStart.y-touchStart.midpoint)<=2,'Mobile resize grip must sit at the visible midpoint of the column boundary.');
  await page.evaluate(`document.querySelector('#table + .sd-rte .sd-rte-table-ruler-handle:not([hidden])').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,clientX:__touchResize.x,clientY:__touchResize.y,pointerId:901,pointerType:'touch',buttons:1}))`);
  await page.evaluate(`window.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,cancelable:true,clientX:__touchResize.x+34,clientY:__touchResize.y,pointerId:901,pointerType:'touch',buttons:1}));window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,cancelable:true,clientX:__touchResize.x+34,clientY:__touchResize.y,pointerId:901,pointerType:'touch',buttons:0}))`);await page.settle();
  const touchCommitted=await page.evaluate(`(()=>{const node=JSON.parse(document.querySelector('#table').value.slice(4)).doc.content.find(n=>n.type==='Table');return node.content[0].content.map(c=>c.marks.SDCellWidth)})()`);
  assert.ok(Math.abs(touchCommitted[0]-touchStart.widths[0])>0.1,'Touch resize must commit a changed first-column width.');assert.ok(Math.abs((touchCommitted[0]+touchCommitted[1])-(touchStart.widths[0]+touchStart.widths[1]))<=0.05,'Touch resize must conserve the resized column pair width.');
  const persistedValue=await page.evaluate(`document.querySelector('#table').value`);
  await page.evaluate(`(async()=>{const value=${JSON.stringify(persistedValue)};await tableMount.destroy();table.value=value;window.tableMount=await StudyDirectorRichText.mountRichTextEditor({field:table,label:'Table editor',initialValue:value,maxWords:10000,maxBytes:917504,assets:{get:async()=>null,put:async()=>{},remove:async()=>{}}})})()`);await page.settle();
  const remountedWidths=await page.evaluate(`JSON.parse(document.querySelector('#table').value.slice(4)).doc.content.find(n=>n.type==='Table').content[0].content.map(c=>c.marks.SDCellWidth)`);
  assert.deepEqual(remountedWidths,touchCommitted,'Touch-resized column widths must survive serialization and editor remount.');

  assert.deepEqual(page.events,[],'QA_FIXTURE table-resize/control browser test produced runtime errors.');
  console.log(JSON.stringify({status:'PASS',suite:'table-resize-controls',revealed,tableWidths,tableClobberWidths,colWidths,colClobberWidths,rowHeights,rowClobberHeights,stressCycles,listDuringImage,mobile},null,2));
}finally{if(page)await browser.closePage(page).catch(()=>{});await browser.close()}
