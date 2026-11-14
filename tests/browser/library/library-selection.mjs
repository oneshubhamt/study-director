import {readRuntimeSource} from '../../helpers/runtime-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {launchChromium,CdpPage,waitFor} from '../../helpers/browser-harness.mjs';

const internal=readRuntimeSource(new URL('../../../source/core/internal.ts',import.meta.url));
const noticeSource=readRuntimeSource(new URL('../../../source/core/notice-coordinator.ts',import.meta.url));
const librarySource=readRuntimeSource(new URL('../../../source/core/library.ts',import.meta.url));
const coreCss=fs.readFileSync(new URL('../../../source/styles/core.css',import.meta.url),'utf8');
const browser=await launchChromium({profilePrefix:'study-director-library-selection-'});
let page=null;
const result={status:'PASS',suite:'library-selection',checks:{}};
try{
  const targets=await (await fetch(`http://127.0.0.1:${browser.port}/json/list`)).json(),target=targets.find(item=>item.type==='page')||targets[0];
  page=await CdpPage.connect(target.webSocketDebuggerUrl,target.id);await page.send('Runtime.enable');await page.send('Page.enable');
  await page.evaluate(internal+'\n'+noticeSource+'\n'+librarySource,{returnByValue:false});
  await page.evaluate(`(()=>{const style=document.createElement('style');style.textContent=${JSON.stringify(coreCss)};document.head.appendChild(style);})()`);
  await page.evaluate(`(()=>{
    document.body.innerHTML='<div class="pane on" id="pane-library"><section class="library-notes-section" id="library-notes"><span id="library-notes-summary-count"></span><input id="library-notes-search"><div class="library-notes-grid"><nav class="library-notes-nav" style="width:252px"><div class="library-notes-nav-head"><span class="library-notes-nav-title"><span class="ui-label">Areas</span><span class="library-note-selection-count" id="library-note-selection-count" hidden>0 selected</span></span><span class="library-notes-nav-tools"><button class="library-note-action ui-btn" id="library-note-select">Export</button><button class="library-note-action ui-btn" id="library-note-select-all" hidden>All</button><button class="library-note-action ui-btn" id="library-note-selection-clear" hidden>Clear</button><span class="library-note-selection-actions"><button class="library-note-action ui-btn" id="library-note-export" hidden disabled>Export</button><button class="library-note-action ui-btn library-note-selection-cancel" id="library-note-select-cancel" hidden>×</button></span><button class="library-note-tool ui-btn" id="library-note-add">+</button><span class="library-notes-nav-count" id="library-notes-nav-count"></span></span></div><div id="library-notes-list"></div></nav><section class="library-notes-editor" id="library-notes-editor"></section></div><div id="notes-status"></div></section></div>';
    const freeze=Object.freeze;
    const entries=[
      freeze({key:'geography',label:'Geography',text:'Geo note',hasNote:true,current:false,support:false,depth:0}),
      freeze({key:'core-subject',label:'Core Subject',text:'',hasNote:false,current:false,support:false,depth:0}),
      freeze({key:'polity',label:'Core Subject > Polity',text:'Polity note',hasNote:true,current:false,support:false,depth:1}),
      freeze({key:'history',label:'Core Subject > History',text:'History note',hasNote:true,current:false,support:false,depth:1}),
      freeze({key:'ethics',label:'Ethics',text:'Ethics note',hasNote:true,current:false,support:false,depth:0})
    ];
    window.__exports=[];window.__exportResult=null;
    const textEl=(tag,className,text)=>{const el=document.createElement(tag);el.className=className||'';el.textContent=String(text||'');return el;};
    const no=()=>{};
    const coordinator=globalThis[Symbol.for('studyDirector.internalModules.v1')].require('notice-coordinator',1).createCoordinator(freeze({}));
    coordinator.subscribe(state=>{for(const event of [...state.events].sort((a,b)=>a.surfaceRevision-b.surfaceRevision)){const node=document.getElementById(event.surfaceId);if(node)node.textContent=event.message;}});
    const ports=freeze({
      notifications:coordinator.presentation('library'),
      records:freeze({get:async()=>null,remove:async()=>true,sortedSummaries:async()=>[]}),
      domain:freeze({countTaskOutcomes:()=>0,earliestSupportedSavedDate:()=> '2025-01-01',isSupportedSavedDate:()=>false,todayISO:()=> '2026-10-03',isTrackableBlock:()=>false,isValidIsoDate:()=>false,sanitizePracticeRuns:v=>v||[],sanitizeTaskOutcomeCounts:v=>v||{},taskOutcomeSummaryText:()=>''}),
      presentation:freeze({createSavedDayTaskReviewCard:()=>document.createElement('div'),createPomodoroSummaryLine:()=>document.createElement('div'),emptyMsg:text=>textEl('div','',text),optionalDurationLabel:()=>'',optionalHoursLabel:()=>'',optionalPercentLabel:()=>'',plainTextContent:v=>String(v||''),populatePracticeRunTable:no,prettyDate:v=>String(v||''),renderRichTextContent:(target,value)=>{target.textContent='PREVIEW '+String(value||'');},textEl}),
      view:freeze({document,goTab:no,setStatus:no,setTextSafe:(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=String(value||'');},window}),
      interactions:freeze({choose:async()=>null,confirm:async()=>false,input:async()=>null}),
      environment:freeze({cancelAnimationFrame:id=>cancelAnimationFrame(id),createOption:(text,value)=>{const option=document.createElement('option');option.text=text;option.value=value;return option;},createSearchWorker:()=>{const corpus=new Map();return {onmessage:null,onerror:null,postMessage(message){const m=message||{};if(m.type==='sync'){corpus.clear();for(const row of m.documents||[])corpus.set(String(row.key||''),String(row.plain??row.value??'').toLowerCase());return;}if(m.type==='batch'){for(const row of m.documents||[])corpus.set(String(row.key||''),String(row.plain??row.value??'').toLowerCase());return;}if(m.type==='upsert'){const row=m.document||{};corpus.set(String(row.key||''),String(row.plain??row.value??'').toLowerCase());return;}if(m.type==='delete'){corpus.delete(String(m.key||''));return;}if(m.type==='query'){const needle=String(m.query||'').toLowerCase(),keys=[...corpus].filter(([,text])=>text.includes(needle)).map(([key])=>key);queueMicrotask(()=>this.onmessage?.({data:{type:'result',id:m.id,keys}}));}},terminate(){corpus.clear();}};},requestAnimationFrame:cb=>requestAnimationFrame(cb)}),
      exporter:freeze({cancel:()=>{},exportKeys:async keys=>{window.__exports.push([...keys]);return window.__exportResult||freeze({status:'downloaded',kind:keys.length===1?'markdown':'zip',notes:keys.length,assets:0,filename:keys.length===1?'One.md':'Study-Director-Notes.zip'});}}),
      diary:freeze({bindEditor:no,captureEditor:v=>v,clearEditor:no,deleteEntry:async()=>false,draft:()=>null,flushEditor:async()=>null,scheduleEditor:()=>true,settled:async()=>true}),
      notes:freeze({areaUse:()=>freeze({today:false,savedPlans:0}),bindEditor:no,canCreate:()=>true,catalogue:()=>entries,clearEditor:no,clearFind:no,commitEditor:()=>true,find:async()=>0,findStep:()=>freeze({index:-1,count:0}),focusEditor:field=>field.focus(),importFiles:async()=>freeze({made:[],skipped:[]}),linksBar:()=>{const bar=document.createElement('div');bar.className='note-links';return bar;},normalizeTag:v=>String(v||'').toLowerCase(),renameTag:async()=>freeze({changed:0,failed:[]}),tagged:()=>new Set(),tags:()=>[],get:(key,label)=>freeze({key,label,text:entries.find(x=>x.key===key)?.text||''}),normalizeArea:v=>String(v||''),orderEntries:v=>v,print:async()=>true,purgeTrash:()=>0,remove:async()=>true,rename:async()=>freeze({status:'rejected'}),renameAreaInPlans:async()=>freeze({blocks:0,savedPlans:0}),renderInherited:no,restore:async()=>null,trash:async()=>null,trashSnapshot:()=>[],versions:async()=>freeze({opened:false,reason:'no-source'}),reviewKept:no,keptVersion:()=>false,searchDocuments:()=>entries.filter(x=>x.text).map(x=>freeze({key:x.key,revision:'r1',value:x.text})),size:()=>entries.length}),
      attachments:freeze({batch:async fn=>fn(),close:no,count:async()=>0,invalidate:()=>{},reconcile:async()=>true,refresh:async()=>true}),
      preferences:freeze({read:()=>null,write:no}),
      clearLibrary:freeze({preflight:async()=>freeze({status:'ready'}),execute:async()=>freeze({status:'cleared'})}),
      ownership:freeze({canMutate:()=>true}),
      overlays:freeze({createAnchoredPopover:(popup,options={})=>{popup.hidden=true;return freeze({show:()=>{popup.hidden=false;},hide:()=>{if(!popup.hidden){popup.hidden=true;options.onClose?.();}}});}}),
      session:freeze({hasActiveSession:()=>false})
    });
    const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')],module=registry.require('library',1);window.__libraryView=module.createView(freeze({ports}));void window.__libraryView.activate().catch(()=>{});
  })()`);
  // The list is a tree: a branch holding neither today's Areas nor the open
  // note starts closed, and opens on its twisty or the Right arrow key.
  await waitFor(()=>page.evaluate(`document.querySelectorAll('#library-notes-list .library-note-nav-item').length===3`),{label:'library note rows'});
  assert.equal(await page.evaluate(`!!document.querySelector('#library-notes-editor textarea')`),true,'Normal Library mode must remain editable.');
  const tree=await page.evaluate(`(()=>{const list=document.getElementById('library-notes-list'),rows=[...list.querySelectorAll('[role="treeitem"]')];return {role:list.getAttribute('role'),keys:rows.map(row=>row.dataset.noteKey),branch:rows.find(row=>row.dataset.noteKey==='core-subject').getAttribute('aria-expanded'),tabbable:rows.filter(row=>row.tabIndex===0).map(row=>row.dataset.noteKey)};})()`);
  assert.deepEqual(tree,{role:'tree',keys:['geography','core-subject','ethics'],branch:'false',tabbable:['geography']});
  await page.evaluate(`document.querySelector('[data-note-key="core-subject"] .library-note-twisty').click()`);
  await waitFor(()=>page.evaluate(`document.querySelectorAll('#library-notes-list [role="treeitem"]').length===5`),{label:'branch opens'});
  await page.evaluate(`(()=>{const row=document.querySelector('[data-note-key="core-subject"]');row.focus();row.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));})()`);
  await waitFor(()=>page.evaluate(`document.querySelectorAll('#library-notes-list [role="treeitem"]').length===3`),{label:'Left closes the branch'});
  assert.equal(await page.evaluate(`document.activeElement?.dataset.noteKey`),'core-subject','focus stays on the branch');
  await page.evaluate(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))`);
  await waitFor(()=>page.evaluate(`document.querySelectorAll('#library-notes-list [role="treeitem"]').length===5`),{label:'Right opens the branch'});
  await page.evaluate(`(()=>{document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));})()`);
  await waitFor(()=>page.evaluate(`document.querySelector('#library-notes-editor .library-notes-editor-title')?.textContent==='Polity'`),{label:'Enter opens a note'});
  assert.equal(await page.evaluate(`document.activeElement?.dataset.noteKey`),'polity','focus stays in the tree after opening');
  await page.evaluate(`[...document.querySelectorAll('[data-note-key]')].find(row=>row.dataset.noteKey==='geography').click()`);
  await waitFor(()=>page.evaluate(`document.querySelector('#library-notes-editor .library-notes-editor-title')?.textContent==='Geography'`),{label:'back to Geography'});
  result.checks.collapsibleKeyboardTree=true;

  await page.click('#library-note-select');
  await waitFor(()=>page.evaluate(`document.querySelectorAll('#library-notes-list .library-note-checkbox').length===5`),{label:'selection checkboxes'});
  assert.equal(await page.evaluate(`document.getElementById('library-note-selection-count').textContent`),'1 selected','The open saved note should be preselected.');
  assert.equal(await page.evaluate(`!!document.querySelector('#library-notes-editor textarea')`),false,'Selection mode must show a read-only preview rather than an editor.');
  assert.equal(await page.evaluate(`document.querySelector('#library-notes-editor .library-note-read')?.textContent.includes('Geo note')`),true);
  const headerState=await page.evaluate(`(()=>{const nav=document.querySelector('.library-notes-nav'),head=document.querySelector('.library-notes-nav-head'),areas=document.querySelector('.library-notes-nav-title .ui-label'),count=document.getElementById('library-note-selection-count'),ids=['library-note-select-all','library-note-selection-clear','library-note-export','library-note-select-cancel'];return {add:getComputedStyle(document.getElementById('library-note-add')).display,noteMenu:!!document.getElementById('library-note-actions'),navCount:getComputedStyle(document.getElementById('library-notes-nav-count')).display,countVisible:getComputedStyle(count).display,countAligned:Math.abs(areas.getBoundingClientRect().top-count.getBoundingClientRect().top)<8,actions:ids.map(id=>{const el=document.getElementById(id),r=el.getBoundingClientRect();return {id,display:getComputedStyle(el).display,left:r.left,right:r.right,width:r.width};}),nav:{left:nav.getBoundingClientRect().left,right:nav.getBoundingClientRect().right},headHeight:head.getBoundingClientRect().height,duplicateCounts:document.querySelectorAll('.library-note-selection-count').length};})()`);
  assert.equal(headerState.add,'none','Create must be absent from rendered export mode.');
  assert.equal(headerState.noteMenu,false,'Note actions are absent from the read-only export preview.');
  assert.equal(headerState.navCount,'none','Normal note count must be absent from rendered export mode.');
  assert.notEqual(headerState.countVisible,'none','Selection count must remain visible.');
  assert.equal(headerState.countAligned,true,'Selection count must sit beside Areas, not consume action-row width.');
  assert.equal(headerState.duplicateCounts,1,'Selection count must not be duplicated in the preview header.');
  assert.ok(headerState.actions.every(action=>action.display!=='none'&&action.width>=24&&action.left>=headerState.nav.left&&action.right<=headerState.nav.right+1),'All/Clear/Export/× must be visible and usable within the narrow sidebar.');
  result.checks.masterDetailPreservedReadOnly=true;result.checks.compactHeaderRenderedCorrectly=true;
  await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
  const mobileActions=await page.evaluate(`(()=>{const bar=document.querySelector('.library-note-selection-actions'),count=document.getElementById('library-note-selection-count'),exportButton=document.getElementById('library-note-export'),cancel=document.getElementById('library-note-select-cancel'),er=exportButton.getBoundingClientRect(),cr=cancel.getBoundingClientRect();return {position:getComputedStyle(bar).position,countDisplay:getComputedStyle(count).display,exportDisplay:getComputedStyle(exportButton).display,cancelDisplay:getComputedStyle(cancel).display,inside:er.left>=0&&cr.right<=innerWidth+1&&er.width>=44&&cr.width>=44};})()`);
  assert.equal(mobileActions.position,'fixed','Mobile export actions must remain a sticky bottom action bar.');
  assert.notEqual(mobileActions.countDisplay,'none','Mobile selection count must remain visible beside Areas.');
  assert.notEqual(mobileActions.exportDisplay,'none');assert.notEqual(mobileActions.cancelDisplay,'none');assert.equal(mobileActions.inside,true,'Mobile Export and cancel controls must remain touch-usable inside the viewport.');
  result.checks.mobileActionBar=true;
  await page.send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});

  await page.click('#library-note-selection-clear');
  await waitFor(()=>page.evaluate(`document.getElementById('library-note-selection-count').textContent==='0 selected'`),{label:'selection clear'});
  const parentSelector='[data-note-key="core-subject"] .library-note-checkbox';
  assert.equal(await page.evaluate(`!document.querySelector('${parentSelector}').disabled`),true,'A parent with exportable descendants must be selectable.');
  await page.click(parentSelector);
  await waitFor(()=>page.evaluate(`document.getElementById('library-note-selection-count').textContent==='2 selected'`),{label:'parent subtree selection'});
  await page.click('[data-note-key="polity"] .library-note-checkbox');
  await waitFor(()=>page.evaluate(`document.getElementById('library-note-selection-count').textContent==='1 selected'`),{label:'child deselection'});
  assert.equal(await page.evaluate(`document.querySelector('${parentSelector}').indeterminate`),true,'Parent checkbox must become indeterminate when only part of its subtree is selected.');
  result.checks.triStateSubtreeSelection=true;

  await page.evaluate(`(()=>{const input=document.getElementById('library-notes-search');input.value='Polity';input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await waitFor(()=>page.evaluate(`document.querySelectorAll('#library-notes-list .library-note-checkbox').length===1`),{label:'filtered selection list'});
  assert.equal(await page.evaluate(`document.getElementById('library-note-selection-count').textContent`),'1 selected','Search must not discard off-screen selections.');
  await page.click('#library-note-select-all');
  await waitFor(()=>page.evaluate(`document.getElementById('library-note-selection-count').textContent==='4 selected'`),{label:'all saved notes selection'});
  assert.equal(await page.evaluate(`document.getElementById('library-note-select-all').disabled`),true);
  result.checks.searchRetainsSelectionAndAllMeansAll=true;

  await page.evaluate(`(()=>{const input=document.getElementById('library-notes-search');input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await waitFor(()=>page.evaluate(`document.querySelectorAll('#library-notes-list .library-note-nav-item').length===5`),{label:'clear search'});
  await page.click('[data-note-key="ethics"] .library-note-select-copy');
  await waitFor(()=>page.evaluate(`document.querySelector('#library-notes-editor .library-notes-editor-title')?.textContent==='Ethics'`),{label:'selection preview navigation'});
  assert.equal(await page.evaluate(`document.getElementById('library-note-selection-count').textContent`),'4 selected');
  result.checks.previewNavigationDoesNotChangeSelection=true;

  await page.click('#library-note-export');
  await waitFor(()=>page.evaluate(`window.__exports.length===1`),{label:'selection export'});
  assert.deepEqual((await page.evaluate(`window.__exports[0].slice().sort()`)),['ethics','geography','history','polity']);
  assert.equal(await page.evaluate(`document.getElementById('library-note-export').hidden`),true);
  result.checks.selectionPassedToExistingExporter=true;

  await page.click('#library-note-select');
  await page.evaluate(`document.getElementById('library-notes').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
  await waitFor(()=>page.evaluate(`document.getElementById('library-note-select').hidden===false`),{label:'escape exits selection'});
  assert.equal(await page.evaluate(`!!document.querySelector('#library-notes-editor textarea')`),true);
  assert.equal(await page.evaluate(`getComputedStyle(document.getElementById('library-note-add')).display!=='none'&&!!document.getElementById('library-note-actions')`),true,'Normal create and note actions must return after selection mode exits.');
  result.checks.escapeRestoresNormalEditor=true;

  await page.click('#library-note-select');
  await page.click('#library-note-select-all');
  await page.evaluate(`window.__exportResult=Object.freeze({status:'too-large',notes:1,assets:0,maxBytes:128*1024*1024})`);
  await page.click('#library-note-export');
  await waitFor(()=>page.evaluate(`document.getElementById('notes-status').textContent.includes('128 MiB safety limit')`),{label:'export resource safety message'});
  assert.equal(await page.evaluate(`document.getElementById('library-note-export').hidden`),false,'Oversized export must leave selection mode available for narrowing.');
  result.checks.exportResourceGateSurfaced=true;

  // The open note's ⋯ menu exports just that note through the same exporter.
  await page.evaluate(`(()=>{window.__exportResult=null;document.getElementById('library-note-select-cancel').click();})()`);
  await waitFor(()=>page.evaluate(`!!document.getElementById('library-note-actions')`),{label:'note menu after selection'});
  const before=await page.evaluate(`window.__exports.length`);
  await page.evaluate(`(()=>{document.getElementById('library-note-actions').click();document.getElementById('library-note-export-one').click();})()`);
  await waitFor(()=>page.evaluate(`window.__exports.length===${before}+1`),{label:'single note export'});
  assert.deepEqual(await page.evaluate(`window.__exports.at(-1)`),['ethics']);
  await waitFor(()=>page.evaluate(`/Download started: “Ethics”/.test(document.getElementById('notes-status').textContent)`),{label:'single export status'});
  result.checks.exportThisNote=true;
  // Earlier versions come from the backups; without one connected the note says so.
  await page.evaluate(`(()=>{document.getElementById('library-note-actions').click();document.getElementById('library-note-versions').click();})()`);
  await waitFor(()=>page.evaluate(`/Earlier versions come from your backups/.test(document.getElementById('notes-status').textContent)`),{label:'earlier versions without a backup'});
  result.checks.earlierVersionsNeedBackup=true;

  const unexpected=page.events.filter(event=>!/favicon/i.test(event.text));assert.deepEqual(unexpected,[]);result.checks.noRuntimeErrors=true;
}finally{if(page)page.close();await browser.close();}
console.log(JSON.stringify(result,null,2));
