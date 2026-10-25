import assert from 'node:assert/strict';
import fs from 'node:fs';
import {launchChromium,waitFor} from '../../helpers/browser-harness.mjs';
import {richTextRuntimeSource} from '../../helpers/rich-text-runtime.mjs';

const bundle=richTextRuntimeSource();
const browser=await launchChromium({profilePrefix:'qa-table-capacity-'});let page;
try{
  page=await browser.createPage('about:blank',{viewport:{width:1180,height:900,mobile:false,scale:1}});
  await page.evaluate(bundle,{returnByValue:false});
  await page.evaluate(`(async()=>{
    document.body.innerHTML='<main style="width:760px;margin:20px"><textarea id="note">Capacity</textarea></main>';
    window.mount=await StudyDirectorRichText.mountRichTextEditor({field:note,label:'Capacity editor',initialValue:note.value,maxWords:10000,maxBytes:917504,assets:{get:async()=>null,put:async()=>{},remove:async()=>{}}});
  })()`);
  await page.click('#note + .sd-rte button[aria-label="Insert 2 × 2 table"]');
  await waitFor(()=>page.evaluate(`!document.querySelector('#note + .sd-rte .sd-rte-table-tools').hidden`),{label:'table controls'});
  const smallTable=await page.evaluate(`(()=>{const root=document.querySelector('#note + .sd-rte'),table=root.querySelector('table'),scroller=root.querySelector('wg-scroller'),cell=table.rows[0].cells[0];return {clientWidth:table.clientWidth,scrollWidth:table.scrollWidth,clientHeight:table.clientHeight,scrollHeight:table.scrollHeight,cellWidth:cell.getBoundingClientRect().width,outerOverflowX:getComputedStyle(scroller).overflowX,outerScrollLeft:scroller.scrollLeft}})()`);
  assert.ok(smallTable.scrollWidth-smallTable.clientWidth<=2,'A normal 2-column table should not need horizontal scrolling.');
  assert.equal(smallTable.scrollHeight,smallTable.clientHeight,'A normal 2-row table should not need vertical scrolling.');
  assert.ok(smallTable.cellWidth>=120,'Small-table cells must remain comfortably usable.');
  assert.equal(smallTable.outerOverflowX,'hidden','The editor scroller must not own table horizontal overflow.');
  await page.evaluate(`(async()=>{
    const nextFrame=()=>new Promise(r=>requestAnimationFrame(r));
    for(let i=0;i<13;i++){document.querySelector('#note + .sd-rte button[aria-label="Add column"]').click();await nextFrame()}
    for(let i=0;i<13;i++){document.querySelector('#note + .sd-rte button[aria-label="Add row"]').click();await nextFrame()}
  })()`);
  const atLimit=await page.evaluate(`(()=>{
    const root=document.querySelector('#note + .sd-rte'),table=root.querySelector('table'),json=JSON.parse(note.value.slice(4)),stored=json.doc.content.find(n=>n.type==='Table'),widths=stored.content[0].content.map(c=>c.marks.SDCellWidth);
    const scroller=root.querySelector('wg-scroller'),cellWidths=[...table.rows[0].cells].map(cell=>cell.getBoundingClientRect().width);return {rows:table.rows.length,columns:table.rows[0].cells.length,storedRows:stored.content.length,storedColumns:stored.content[0].content.length,widthSum:widths.reduce((a,b)=>a+b,0),minWidth:Math.min(...widths),minCellPx:Math.min(...cellWidths),tableClientWidth:table.clientWidth,tableScrollWidth:table.scrollWidth,tableClientHeight:table.clientHeight,tableScrollHeight:table.scrollHeight,tableScrollLeft:table.scrollLeft,tableScrollTop:table.scrollTop,editorScrollTop:scroller.scrollTop,editorClientHeight:scroller.clientHeight,editorScrollHeight:scroller.scrollHeight,outerOverflowX:getComputedStyle(scroller).overflowX,outerScrollLeft:scroller.scrollLeft,rowAddDisabled:root.querySelector('button[aria-label="Add row"]').disabled,colAddDisabled:root.querySelector('button[aria-label="Add column"]').disabled,valid:StudyDirectorRichText.isRichTextValue(note.value)}
  })()`);
  assert.deepEqual({rows:atLimit.rows,columns:atLimit.columns,storedRows:atLimit.storedRows,storedColumns:atLimit.storedColumns},{rows:15,columns:15,storedRows:15,storedColumns:15});
  assert.ok(Math.abs(atLimit.widthSum-100)<=0.5,`15-column widths must total ~100%, got ${atLimit.widthSum}`);
  assert.ok(atLimit.minWidth>=6.66,`15-column canonical share is unexpectedly small: ${atLimit.minWidth}`);
  assert.ok(atLimit.minCellPx>=119,`15-column cells must begin at a practical width, got ${atLimit.minCellPx}px`);
  assert.ok(atLimit.tableScrollWidth>atLimit.tableClientWidth+1000,'A 15-column table must scroll horizontally inside its own viewport.');
  assert.ok(atLimit.editorScrollHeight>atLimit.editorClientHeight+200,'A 15-row table must remain vertically scrollable within the editor.');
  assert.ok(atLimit.tableScrollLeft>0&&atLimit.editorScrollTop>0,'Selection movement into a large table should reveal the active cell through local horizontal and editor vertical scrolling.');
  assert.equal(atLimit.outerOverflowX,'hidden');assert.equal(atLimit.outerScrollLeft,0,'Large tables must not horizontally move the editor scroller.');
  assert.equal(atLimit.rowAddDisabled,true);assert.equal(atLimit.colAddDisabled,true);assert.equal(atLimit.valid,true);

  const tableObject=await page.evaluate(`document.querySelector('#note + .sd-rte table')`,{returnByValue:false});
  const axTree=await page.send('Accessibility.getPartialAXTree',{objectId:tableObject.objectId,fetchRelatives:true});
  const accessibilityRoles=[...new Set(axTree.nodes.map(node=>node.role?.value).filter(Boolean))];
  assert.ok(accessibilityRoles.includes('table')&&accessibilityRoles.includes('row'),'Scrollable table presentation must preserve semantic table/row accessibility roles.');

  await page.setViewport({width:390,height:760,mobile:true,scale:2});
  const mobileTable=await page.evaluate(`(()=>{const root=document.querySelector('#note + .sd-rte'),table=root.querySelector('table'),scroller=root.querySelector('wg-scroller'),cell=table.rows[0].cells[0];return {clientWidth:table.clientWidth,scrollWidth:table.scrollWidth,cellWidth:cell.getBoundingClientRect().width,outerScrollLeft:scroller.scrollLeft,bodyScrollWidth:document.documentElement.scrollWidth,bodyClientWidth:document.documentElement.clientWidth}})()`);
  assert.ok(mobileTable.scrollWidth>mobileTable.clientWidth+1000,'15-column tables must remain locally scrollable on mobile.');
  assert.ok(mobileTable.cellWidth>=120,'Mobile must preserve the practical table-cell floor.');
  assert.equal(mobileTable.outerScrollLeft,0,'Mobile table overflow must not horizontally move the editor scroller.');
  assert.ok(mobileTable.bodyScrollWidth<=mobileTable.bodyClientWidth+2,'Large tables must not create page-level horizontal overflow on mobile.');
  await page.setViewport({width:1180,height:900,mobile:false,scale:1});

  // Maximum capacity must remain genuinely resizable: the minimum-width policy preserves headroom
  // rather than freezing fifteen equal-width columns at their initial 6.67% share.
  await page.evaluate(`(()=>{const doc=JSON.parse(note.value.slice(4));const table=doc.doc.content.find(n=>n.type==='Table');for(const row of table.content){row.content[0].marks.SDCellWidth=10;row.content[1].marks.SDCellWidth=5;for(let i=2;i<15;i++)row.content[i].marks.SDCellWidth=85/13;}mount.setValue('WG1:'+JSON.stringify(doc));})()`);await page.settle();
  const resizeAtLimit=await page.evaluate(`(()=>{
    const field=document.querySelector('#note'),cell=document.querySelector('#note + .sd-rte tr:first-child td:first-child'),r=cell.getBoundingClientRect(),table=JSON.parse(field.value.slice(4)).doc.content.find(n=>n.type==='Table');
    window.__capacityInputs=0;field.addEventListener('input',()=>window.__capacityInputs++);window.__capacityDrag={x:r.right-1,y:r.top+r.height/2};
    return {px:r.width,pairPx:[...cell.parentElement.cells].slice(0,2).map(c=>c.getBoundingClientRect().width),widths:table.content[0].content.slice(0,2).map(c=>c.marks.SDCellWidth)}
  })()`);
  await page.evaluate(`document.querySelector('#note + .sd-rte tr:first-child td:first-child').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,clientX:__capacityDrag.x,clientY:__capacityDrag.y,pointerId:560,pointerType:'mouse',buttons:1}))`);
  await page.evaluate(`window.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,cancelable:true,clientX:__capacityDrag.x-18,clientY:__capacityDrag.y,pointerId:560,pointerType:'mouse',buttons:1}))`);
  await page.evaluate(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
  const resizePreview=await page.evaluate(`(()=>{const cell=document.querySelector('#note + .sd-rte tr:first-child td:first-child'),table=JSON.parse(note.value.slice(4)).doc.content.find(n=>n.type==='Table');return {px:cell.getBoundingClientRect().width,pairPx:[...cell.parentElement.cells].slice(0,2).map(c=>c.getBoundingClientRect().width),widths:table.content[0].content.slice(0,2).map(c=>c.marks.SDCellWidth),inputs:__capacityInputs}})()`);
  assert.ok(resizePreview.px<resizeAtLimit.px-2,'A 15-column table must retain usable column-resize headroom.');
  assert.ok(Math.min(...resizePreview.pairPx)>=119,'Column resizing must never compress the adjacent cell below the practical 120px floor.');
  assert.deepEqual(resizePreview.widths,resizeAtLimit.widths,'15-column resize preview must remain transient until release.');
  assert.equal(resizePreview.inputs,0,'15-column resize preview must emit zero host input events.');
  await page.evaluate(`window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,cancelable:true,clientX:__capacityDrag.x-18,clientY:__capacityDrag.y,pointerId:560,pointerType:'mouse',buttons:0}))`);
  await page.evaluate(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
  const resizedAtLimit=await page.evaluate(`(()=>{const table=JSON.parse(note.value.slice(4)).doc.content.find(n=>n.type==='Table');return {widths:table.content[0].content.slice(0,2).map(c=>c.marks.SDCellWidth),inputs:__capacityInputs,valid:StudyDirectorRichText.isRichTextValue(note.value)}})()`);
  assert.notDeepEqual(resizedAtLimit.widths,resizeAtLimit.widths,'15-column resize must commit changed canonical widths on release.');
  assert.equal(resizedAtLimit.inputs,1,'15-column resize must emit exactly one final host input event.');
  assert.equal(resizedAtLimit.valid,true,'15-column table must remain canonical after resizing.');

  await page.click('#note + .sd-rte td');await waitFor(()=>page.evaluate(`!document.querySelector('#note + .sd-rte .sd-rte-table-tools').hidden`));
  // Disabled controls must make the limit a hard no-op, not a hidden 16th row/column.
  await page.evaluate(`(()=>{const root=document.querySelector('#note + .sd-rte');root.querySelector('button[aria-label="Add row"]').click();root.querySelector('button[aria-label="Add column"]').click()})()`);
  const afterNoop=await page.evaluate(`(()=>{const table=document.querySelector('#note + .sd-rte table');return {rows:table.rows.length,columns:table.rows[0].cells.length}})()`);
  assert.deepEqual(afterNoop,{rows:15,columns:15});

  // Removing one of each reopens the same bounded model without reconstructing a different table type.
  await page.click('#note + .sd-rte button[aria-label="Delete row"]');
  await page.click('#note + .sd-rte button[aria-label="Delete column"]');
  await waitFor(()=>page.evaluate(`(()=>{const root=document.querySelector('#note + .sd-rte');return !root.querySelector('button[aria-label="Add row"]').disabled&&!root.querySelector('button[aria-label="Add column"]').disabled})()`),{label:'table controls re-enabled'});
  const reopened=await page.evaluate(`(()=>{const table=document.querySelector('#note + .sd-rte table');return {rows:table.rows.length,columns:table.rows[0].cells.length,valid:StudyDirectorRichText.isRichTextValue(note.value)}})()`);
  assert.deepEqual(reopened,{rows:14,columns:14,valid:true});
  assert.deepEqual(page.events,[],'QA_FIXTURE table-capacity browser test produced runtime errors.');
  console.log(JSON.stringify({status:'PASS',suite:'table-capacity',smallTable,atLimit,accessibilityRoles,mobileTable,resizeAtLimit,resizePreview,resizedAtLimit,afterNoop,reopened},null,2));
} finally {if(page)await browser.closePage(page).catch(()=>{});await browser.close()}
