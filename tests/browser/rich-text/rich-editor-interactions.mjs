import assert from 'node:assert/strict';
import fs from 'node:fs';
import {launchChromium,waitFor} from '../../helpers/browser-harness.mjs';
import {richTextRuntimeSource} from '../../helpers/rich-text-runtime.mjs';

const bundle=richTextRuntimeSource();
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const browser=await launchChromium({profilePrefix:'qa-rich-interactions-'});
let page;
const keySpec=value=>{
  const map={
    '7':{code:'Digit7',keyCode:55},'8':{code:'Digit8',keyCode:56},
    b:{code:'KeyB',keyCode:66},k:{code:'KeyK',keyCode:75},
    Tab:{code:'Tab',keyCode:9},Enter:{code:'Enter',keyCode:13},
    Backspace:{code:'Backspace',keyCode:8},Escape:{code:'Escape',keyCode:27}
  };
  return map[value]||{code:value,keyCode:0};
};
const key=async(value,modifiers=0)=>{const {code,keyCode}=keySpec(value),payload={key:value,code,modifiers,windowsVirtualKeyCode:keyCode,nativeVirtualKeyCode:keyCode};await page.send('Input.dispatchKeyEvent',{type:'keyDown',...payload});await page.send('Input.dispatchKeyEvent',{type:'keyUp',...payload})};
const ctrl=2,shift=8;
async function mount(viewport){
  page=await browser.createPage('about:blank',{viewport});
  await page.evaluate(bundle,{returnByValue:false});
  await page.evaluate(`(async()=>{
    document.body.style.margin='0';
    document.body.innerHTML='<div style="height:780px"></div><main style="width:min(920px,calc(100vw - 24px));margin:0 auto 900px"><textarea id="list">One</textarea><textarea id="bullet">Alpha</textarea><textarea id="check">Task A</textarea><textarea id="table">Table anchor</textarea><textarea id="image">Image anchor</textarea><textarea id="short">Shortcut text</textarea><textarea id="history">Alpha</textarea><textarea id="empty" placeholder="Start writing…"></textarea></main>';
    window.assetMap=new Map();window.assets={get:async id=>assetMap.get(id)||null,put:async(id,b)=>assetMap.set(id,b),remove:async id=>assetMap.delete(id)};
    window.selectText=(root,start,end)=>{const p=document.querySelector(root),t=p.firstChild,r=document.createRange(),s=getSelection();p.closest('.sd-rte-editor')?.focus({preventScroll:true});r.setStart(t,start);r.setEnd(t,end);s.removeAllRanges();s.addRange(r);document.dispatchEvent(new Event('selectionchange'))};
    window.selectStart=(root)=>{const p=document.querySelector(root),r=document.createRange(),s=getSelection();p.closest('.sd-rte-editor')?.focus({preventScroll:true});r.setStart(p,0);r.collapse(true);s.removeAllRanges();s.addRange(r);document.dispatchEvent(new Event('selectionchange'))};
    for(const id of ['list','bullet','check','table','image','short','history','empty']){const field=document.getElementById(id);window['m_'+id]=await StudyDirectorRichText.mountRichTextEditor({field,label:id,initialValue:field.value,maxWords:10000,maxBytes:917504,assets});}
  })()`);
  await page.settle();
}
async function close(){if(page){await browser.closePage(page);page=null}}

try{
  // Desktop: nested lists + shortcuts + stable table controls + atomic-node UI.
  await mount({width:1180,height:860,mobile:false,scale:1});
  await page.evaluate(`selectText('#list + .sd-rte .sd-rte-editor p',3,3)`);await page.settle();
  await key('7',ctrl|shift);await page.settle();
  assert.equal(await page.evaluate(`document.querySelectorAll('#list + .sd-rte .sd-rte-editor > ol > li').length`),1,'Ctrl/Cmd+Shift+7 must create a numbered list.');
  await key('Enter');await page.send('Input.insertText',{text:'Two'});await key('Tab');await page.settle();
  assert.equal(await page.evaluate(`document.querySelectorAll('#list + .sd-rte .sd-rte-editor > ol > li > ol > li').length`),1,'Tab must indent an ordered-list item.');
  await key('Enter');await page.send('Input.insertText',{text:'Three'});await key('Tab');await page.settle();
  assert.equal(await page.evaluate(`document.querySelectorAll('#list + .sd-rte .sd-rte-editor > ol > li > ol > li > ol > li').length`),1,'Nested lists must support at least a third level.');
  await key('Tab',shift);await key('Tab',shift);await page.settle();
  assert.equal(await page.evaluate(`document.querySelectorAll('#list + .sd-rte .sd-rte-editor > ol > li').length`),2,'Shift+Tab must lift nested ordered-list items without leaving the editor.');

  await page.evaluate(`selectText('#bullet + .sd-rte .sd-rte-editor p',5,5)`);await page.settle();await key('8',ctrl|shift);await page.settle();
  assert.equal(await page.evaluate(`document.querySelectorAll('#bullet + .sd-rte .sd-rte-editor > ul > li').length`),1,'Ctrl/Cmd+Shift+8 must create a bulleted list.');
  await key('Tab');await page.settle();
  assert.equal(await page.evaluate(`document.activeElement===document.querySelector('#bullet + .sd-rte .sd-rte-editor')`),true,'Tab on the first list item must stay in the editor rather than escape focus.');
  await key('Enter');await page.send('Input.insertText',{text:'Beta'});await key('Tab');await page.settle();
  assert.equal(await page.evaluate(`document.querySelectorAll('#bullet + .sd-rte .sd-rte-editor > ul > li > ul > li').length`),1,'Bulleted lists must nest with Tab.');
  await key('Tab',shift);await page.settle();
  assert.equal(await page.evaluate(`document.querySelectorAll('#bullet + .sd-rte .sd-rte-editor > ul > li').length`),2,'Shift+Tab must lift nested bullet items.');

  await page.evaluate(`selectText('#check + .sd-rte .sd-rte-editor p',6,6)`);await page.click('#check + .sd-rte button[aria-label="Checklist"]');await key('Enter');await page.send('Input.insertText',{text:'Task B'});await key('Tab');await page.settle();
  assert.deepEqual(await page.evaluate(`({nested:document.querySelectorAll('#check + .sd-rte ul[data-sd-checklist=true] li ul[data-sd-checklist=true] li').length,roles:[...document.querySelectorAll('#check + .sd-rte ul[data-sd-checklist=true] li')].map(x=>x.getAttribute('role'))})`),{nested:1,roles:['checkbox','checkbox']},'Checklist nesting must preserve checklist semantics.');

  await page.evaluate(`selectText('#short + .sd-rte .sd-rte-editor p',0,8)`);await page.settle();await key('b',ctrl);await page.settle();
  assert.equal(await page.evaluate(`document.querySelector('#short + .sd-rte strong')?.textContent`),'Shortcut','Wordgard Bold shortcut must remain functional.');
  await key('k',ctrl);await waitFor(()=>page.evaluate(`document.activeElement===document.querySelector('#short + .sd-rte .sd-rte-link-editor input')`),{label:'Mod-K link shortcut'});
  assert.equal(await page.evaluate(`document.querySelector('#short + .sd-rte button[aria-label="Link"]').getAttribute('aria-keyshortcuts')`),'Control+k Meta+k','Common shortcuts must be discoverable through aria-keyshortcuts.');
  await key('Escape');await page.settle();

  // Native Wordgard history and blockquote behavior must remain observable through the Study Director toolbar.
  const historyRoot='#history + .sd-rte';
  assert.equal(await page.evaluate(`document.querySelector('${historyRoot} button[aria-label="Undo"]').disabled`),true,'Undo starts disabled before an edit.');
  await page.evaluate(`window.validatedInputMeta=null;document.getElementById('history').addEventListener('input',event=>{const meta=event[Symbol.for('studyDirector.richValidatedInput.v1')];if(meta)window.validatedInputMeta={format:meta.format,version:meta.version,canonical:meta.canonical,plain:meta.plain};},{once:true});selectText('${historyRoot} .sd-rte-editor p',5,5)`);
  await page.send('Input.insertText',{text:' Beta'});
  await waitFor(()=>page.evaluate(`StudyDirectorRichText.toPlainText(document.getElementById('history').value)==='Alpha Beta'`),{label:'history edit'});
  const validatedInput=await page.evaluate(`({meta:window.validatedInputMeta,canonical:document.getElementById('history').value})`);
  assert.equal(validatedInput.meta?.format,'study-director.rich-validated-input');assert.equal(validatedInput.meta?.version,1);
  assert.equal(validatedInput.meta?.plain,'Alpha Beta');assert.equal(validatedInput.meta?.canonical,validatedInput.canonical,'validated input metadata must describe the exact canonical value published to the host field');
  await waitFor(()=>page.evaluate(`document.querySelector('${historyRoot} button[aria-label="Undo"]')?.disabled===false`),{label:'Undo enabled after edit'});
  await page.click(`${historyRoot} button[aria-label="Undo"]`);await waitFor(()=>page.evaluate(`StudyDirectorRichText.toPlainText(document.getElementById('history').value)==='Alpha'`),{label:'Wordgard undo'});
  assert.equal(await page.evaluate(`document.querySelector('${historyRoot} button[aria-label="Redo"]').disabled`),false,'Undo must enable Redo.');
  await page.click(`${historyRoot} button[aria-label="Redo"]`);await waitFor(()=>page.evaluate(`StudyDirectorRichText.toPlainText(document.getElementById('history').value)==='Alpha Beta'`),{label:'Wordgard redo'});
  await page.click(`${historyRoot} .sd-rte-editor p`);await page.settle();await page.click(`${historyRoot} button[aria-label="Block quote"]`);
  await waitFor(()=>page.evaluate(`!!document.querySelector('${historyRoot} .sd-rte-editor blockquote')`),{label:'blockquote toggle'});
  const quote=await page.evaluate(`(()=>({pressed:document.querySelector('${historyRoot} button[aria-label="Block quote"]').getAttribute('aria-pressed'),serialized:document.getElementById('history').value,markdown:StudyDirectorRichText.toMarkdown(document.getElementById('history').value)}))()`);
  assert.equal(quote.pressed,'true');assert.ok(quote.serialized.includes('"type":"Blockquote"'),'Blockquote must persist in canonical rich text.');assert.ok(quote.markdown.trim().startsWith('> '),'Blockquote must export as Markdown quote syntax.');

  // Wordgard placeholder geometry must remain line-local so the empty caret matches the first typed line.
  const placeholder=await page.evaluate(`(()=>{const p=document.querySelector('#empty + .sd-rte wg-placeholder'),s=getComputedStyle(p),block=p.closest('p')||p.parentElement,parent=getComputedStyle(p.parentElement),r=p.getBoundingClientRect(),b=block.getBoundingClientRect();return {present:!!p,display:s.display,verticalAlign:s.verticalAlign,fontSize:s.fontSize,lineHeight:s.lineHeight,parentFont:parent.fontSize,parentLine:parent.lineHeight,left:r.left,top:r.top,blockLeft:b.left,blockTop:b.top}})()`);
  assert.equal(placeholder.present,true);assert.equal(placeholder.display,'inline');assert.equal(placeholder.verticalAlign,'top');assert.equal(placeholder.fontSize,placeholder.parentFont);assert.equal(placeholder.lineHeight,placeholder.parentLine);assert.ok(Math.abs(placeholder.left-placeholder.blockLeft)<=1,'Placeholder must share the empty paragraph caret inset.');assert.ok(Math.abs(placeholder.top-placeholder.blockTop)<=2,'Placeholder must share the empty paragraph first-line position.');
  await page.evaluate(`document.querySelector('#empty + .sd-rte .sd-rte-editor').focus()`);await page.send('Input.insertText',{text:'X'});
  await waitFor(()=>page.evaluate(`!document.querySelector('#empty + .sd-rte wg-placeholder')&&StudyDirectorRichText.toPlainText(document.getElementById('empty').value)==='X'`),{label:'placeholder dismissal'});

  await page.evaluate(`(()=>{const w=document.querySelector('#table + .sd-rte');window.scrollTo(0,w.getBoundingClientRect().top+scrollY-80);selectText('#table + .sd-rte .sd-rte-editor p',5,5)})()`);await page.settle();
  const beforeTable=await page.evaluate(`(()=>{const w=document.querySelector('#table + .sd-rte'),h=w.querySelector('.sd-rte-editor-host'),s=w.querySelector('wg-scroller'),t=w.querySelector('.sd-rte-toolbar');return {pageY:scrollY,wrapper:w.getBoundingClientRect().height,host:h.getBoundingClientRect().height,scroller:s.getBoundingClientRect().height,scrollTop:s.scrollTop,toolbar:t.getBoundingClientRect().height}})()`);
  await page.click('#table + .sd-rte button[aria-label="Insert 2 × 2 table"]');await page.settle();
  const afterTable=await page.evaluate(`(()=>{const w=document.querySelector('#table + .sd-rte'),h=w.querySelector('.sd-rte-editor-host'),s=w.querySelector('wg-scroller'),t=w.querySelector('.sd-rte-toolbar'),tools=w.querySelector('.sd-rte-table-tools');return {pageY:scrollY,wrapper:w.getBoundingClientRect().height,host:h.getBoundingClientRect().height,scroller:s.getBoundingClientRect().height,scrollTop:s.scrollTop,toolbar:t.getBoundingClientRect().height,visible:!tools.hidden,inToolbar:tools.parentElement===w.querySelector('.sd-rte-toolbar-rail')}})()`);
  assert.ok(Math.abs(afterTable.pageY-beforeTable.pageY)<=1,'Showing table controls must not scroll the page.');
  for(const keyName of ['wrapper','host','scroller','toolbar'])assert.ok(Math.abs(afterTable[keyName]-beforeTable[keyName])<=1,`Showing table controls must not resize ${keyName}.`);
  assert.ok(Math.abs(afterTable.scrollTop-beforeTable.scrollTop)<=1,'Showing table controls must not jump the editor scroller.');
  assert.equal(afterTable.visible,true);assert.equal(afterTable.inToolbar,true,'Table controls must live in the stable toolbar strip.');

  await page.evaluate(`selectStart('#table + .sd-rte .sd-rte-editor > p:last-child')`);await page.settle();await key('Backspace');await page.settle();
  assert.equal(await page.evaluate(`document.querySelectorAll('#table + .sd-rte table.wg-selected-node').length`),1,'Table must remain atomically selectable.');
  assert.deepEqual(await page.evaluate(`(()=>{const w=document.querySelector('#table + .sd-rte'),labels=['Bold','Italic','Highlight','Block quote','Bulleted list','Numbered list','Checklist','Link'];return {pressed:labels.filter(l=>w.querySelector('button[aria-label="'+l+'"]').getAttribute('aria-pressed')==='true'),horizontal:[...w.querySelectorAll('wg-cursor.wg-cursor-h')].filter(x=>getComputedStyle(x).display!=='none').length}})()`),{pressed:[],horizontal:0},'Atomic table selection must not report text formatting active or expose a horizontal caret.');

  await page.evaluate(`(()=>{const w=document.querySelector('#image + .sd-rte');w.scrollIntoView({block:'center'});selectText('#image + .sd-rte .sd-rte-editor p',5,5);const i=w.querySelector('.sd-rte-asset-input');i.click=()=>{}})()`);await page.settle();await page.click('#image + .sd-rte button[aria-label="Attach"]');await waitFor(()=>page.evaluate(`document.querySelector('#image + .sd-rte [aria-label=\"Attach\"]').getAttribute('aria-expanded')==='true'||document.querySelector('#image + .sd-rte .sd-rte-menu')?.matches(':popover-open')`),{label:'attachment menu'});await page.click('#image + .sd-rte button[aria-label="Insert image"]');
  await page.evaluate(`(()=>{const i=document.querySelector('#image + .sd-rte .sd-rte-asset-input'),d=new DataTransfer(),bytes=Uint8Array.from(atob('${png}'),c=>c.charCodeAt(0));d.items.add(new File([bytes],'sample.png',{type:'image/png'}));Object.defineProperty(i,'files',{configurable:true,value:d.files});i.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await waitFor(()=>page.evaluate(`!!document.querySelector('#image + .sd-rte .sd-rte-image img')`),{label:'image hydration'});await key('Backspace');await page.settle();
  const imageState=await page.evaluate(`(()=>{const w=document.querySelector('#image + .sd-rte'),labels=['Bold','Italic','Highlight','Block quote','Bulleted list','Numbered list','Checklist','Link'],figure=w.querySelector('.sd-rte-image'),img=figure.querySelector('img'),handle=figure.querySelector('.sd-rte-image-resize'),remove=figure.querySelector('.sd-rte-image-remove'),alt=figure.querySelector('.sd-rte-image-alt');return {selected:figure.classList.contains('wg-selected-node'),pressed:labels.filter(l=>w.querySelector('button[aria-label="'+l+'"]').getAttribute('aria-pressed')==='true'),disabled:labels.filter(l=>w.querySelector('button[aria-label="'+l+'"]').disabled),handleOpacity:getComputedStyle(handle).opacity,removeOpacity:getComputedStyle(remove).opacity,altOpacity:getComputedStyle(alt).opacity,removeText:remove.textContent,removePosition:getComputedStyle(remove).position,altPosition:getComputedStyle(alt).position,captionCount:figure.querySelectorAll('figcaption').length,heightDelta:Math.abs(figure.getBoundingClientRect().height-img.getBoundingClientRect().height),horizontal:[...w.querySelectorAll('wg-cursor.wg-cursor-h')].filter(x=>getComputedStyle(x).display!=='none').length}})()`);
  assert.equal(imageState.selected,true);assert.deepEqual(imageState.pressed,[],'Image selection must not make formatting buttons look selected.');assert.equal(imageState.disabled.length,8,'Text-format controls should be disabled for image node selection.');assert.equal(imageState.handleOpacity,'1','Selected image must expose its resize grip without requiring hover.');assert.equal(imageState.removeOpacity,'1','Selected image must expose its remove action without a permanent button row.');assert.equal(imageState.altOpacity,'1','Selected image must expose its local description action without using toolbar space.');assert.equal(imageState.removeText,'','Remove action must be icon-only visually.');assert.equal(imageState.removePosition,'absolute','Remove action must overlay the image instead of consuming editor space.');assert.equal(imageState.altPosition,'absolute','Image description action must overlay the image instead of consuming editor space.');assert.equal(imageState.captionCount,0,'Attachment filename must not render as a caption.');assert.ok(imageState.heightDelta<=1,'Image controls must not add vertical chrome below the image.');assert.equal(imageState.horizontal,0,'Image node selection must not display a horizontal caret.');

  // Force a DOM gap selection directly before the image; Study Director should suppress Wordgard's horizontal atomic-gap caret.
  await page.evaluate(`(()=>{const root=document.querySelector('#image + .sd-rte .sd-rte-editor'),fig=root.querySelector('figure'),r=document.createRange(),s=getSelection(),index=[...root.childNodes].indexOf(fig);r.setStart(root,index);r.collapse(true);s.removeAllRanges();s.addRange(r);document.dispatchEvent(new Event('selectionchange'))})()`);await page.settle();
  assert.deepEqual(await page.evaluate(`(()=>{const w=document.querySelector('#image + .sd-rte'),wg=w.querySelector('.sd-rte-wordgard'),c=w.querySelector('wg-cursor.wg-cursor-h');return {suppress:wg.dataset.sdSuppressGapCaret,display:c?getComputedStyle(c).display:'none'}})()`),{suppress:'true',display:'none'},'Atomic gap cursor should remain logically navigable but not render as a distracting horizontal caret.');
  await close();

  // Mobile: identical layout invariants, touch-sized contextual controls, no page overflow.
  await mount({width:390,height:760,mobile:true,scale:2});
  await page.evaluate(`(()=>{const w=document.querySelector('#table + .sd-rte');window.scrollTo(0,w.getBoundingClientRect().top+scrollY-50);selectText('#table + .sd-rte .sd-rte-editor p',5,5)})()`);await page.settle();
  const mobileBefore=await page.evaluate(`(()=>{const w=document.querySelector('#table + .sd-rte'),h=w.querySelector('.sd-rte-editor-host'),t=w.querySelector('.sd-rte-toolbar');return {pageY:scrollY,wrapper:w.getBoundingClientRect().height,host:h.getBoundingClientRect().height,toolbar:t.getBoundingClientRect().height}})()`);
  await page.click('#table + .sd-rte button[aria-label="Insert 2 × 2 table"]');await page.settle();
  const mobileAfter=await page.evaluate(`(()=>{const w=document.querySelector('#table + .sd-rte'),h=w.querySelector('.sd-rte-editor-host'),t=w.querySelector('.sd-rte-toolbar'),tools=w.querySelector('.sd-rte-table-tools'),buttons=[...tools.querySelectorAll('button')];return {pageY:scrollY,wrapper:w.getBoundingClientRect().height,host:h.getBoundingClientRect().height,toolbar:t.getBoundingClientRect().height,toolMin:Math.min(...buttons.map(b=>b.getBoundingClientRect().height)),overflow:document.documentElement.scrollWidth-innerWidth,inToolbar:tools.parentElement===w.querySelector('.sd-rte-toolbar-rail')}})()`);
  assert.ok(Math.abs(mobileAfter.pageY-mobileBefore.pageY)<=1);for(const keyName of ['wrapper','host','toolbar'])assert.ok(Math.abs(mobileAfter[keyName]-mobileBefore[keyName])<=1,`Mobile table controls must not resize ${keyName}.`);assert.ok(mobileAfter.toolMin>=44,'Mobile table controls must keep touch-sized hit targets.');assert.ok(mobileAfter.overflow<=1,'Contextual table controls must not create page-level horizontal overflow.');assert.equal(mobileAfter.inToolbar,true);

  await page.evaluate(`(()=>{const w=document.querySelector('#image + .sd-rte');w.scrollIntoView({block:'center'});selectText('#image + .sd-rte .sd-rte-editor p',5,5);const i=w.querySelector('.sd-rte-asset-input');i.click=()=>{}})()`);await page.settle();await page.click('#image + .sd-rte button[aria-label="Attach"]');await waitFor(()=>page.evaluate(`document.querySelector('#image + .sd-rte [aria-label=\"Attach\"]').getAttribute('aria-expanded')==='true'||document.querySelector('#image + .sd-rte .sd-rte-menu')?.matches(':popover-open')`),{label:'attachment menu'});await page.click('#image + .sd-rte button[aria-label="Insert image"]');await page.evaluate(`(()=>{const i=document.querySelector('#image + .sd-rte .sd-rte-asset-input'),d=new DataTransfer(),bytes=Uint8Array.from(atob('${png}'),c=>c.charCodeAt(0));d.items.add(new File([bytes],'mobile.png',{type:'image/png'}));Object.defineProperty(i,'files',{configurable:true,value:d.files});i.dispatchEvent(new Event('change',{bubbles:true}))})()`);await waitFor(()=>page.evaluate(`!!document.querySelector('#image + .sd-rte .sd-rte-image img')`),{label:'mobile image hydration'});await key('Backspace');await page.settle();
  assert.deepEqual(await page.evaluate(`(()=>{const w=document.querySelector('#image + .sd-rte'),figure=w.querySelector('.sd-rte-image'),h=figure.querySelector('.sd-rte-image-resize'),r=figure.querySelector('.sd-rte-image-remove'),a=figure.querySelector('.sd-rte-image-alt');return {width:h.getBoundingClientRect().width,height:h.getBoundingClientRect().height,removeWidth:r.getBoundingClientRect().width,removeHeight:r.getBoundingClientRect().height,altWidth:a.getBoundingClientRect().width,altHeight:a.getBoundingClientRect().height,opacity:getComputedStyle(h).opacity,removeOpacity:getComputedStyle(r).opacity,altOpacity:getComputedStyle(a).opacity,captionCount:figure.querySelectorAll('figcaption').length,overflow:document.documentElement.scrollWidth-innerWidth}})()`),{width:44,height:44,removeWidth:44,removeHeight:44,altWidth:44,altHeight:44,opacity:'1',removeOpacity:'1',altOpacity:'1',captionCount:0,overflow:0},'Selected-image controls must be compact, coherent and touch-sized on mobile.');

  assert.deepEqual(page.events,[],'QA_FIXTURE rich-editor interaction pass produced browser errors.');
  console.log(JSON.stringify({status:'PASS',suite:'rich-editor-interactions',checks:['ordered-list shortcut','bullet-list shortcut','deep list nesting','checklist nesting','Mod-K link shortcut','undo/redo history','blockquote persistence/markdown','native placeholder geometry','stable table controls desktop','atomic toolbar state','atomic gap caret suppression','compact selected image affordance','stable table controls mobile','mobile touch targets']},null,2));
}finally{if(page)await browser.closePage(page);await browser.close()}
