import fs from 'node:fs';
import {writeArtifact} from '../../helpers/artifacts.mjs';
import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitForStudyDirector,waitFor} from '../../helpers/browser-harness.mjs';

const preload=`(()=>{
  const d=new Date(),today=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  localStorage.setItem('studyDirector.userDefaults.v1',JSON.stringify({version:1,studentName:'Notes QA',updatedAt:new Date().toISOString()}));
  localStorage.setItem('studyDirector.nameSetupSkippedDate.v1',today);
})()`;

const server=await startReleaseServer();
const browser=await launchChromium({profilePrefix:'study-director-qa-notes-'});
const result={status:'PASS',release:server.manifest.release,checks:{},metrics:{}};
let page=null;
try{
  page=await browser.createPage(server.url('deployment','instrumented.html'),{preload});
  await waitForStudyDirector(page,{instrumented:true});
  await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().state==='primary'&&__PWA6.SessionLifecycle.status().ready`),{label:'primary ownership'});
  await page.evaluate(`(()=>{
    const waitFor=(test,timeout=3000)=>new Promise((resolve,reject)=>{const started=Date.now(),poll=()=>{const value=test();if(value)resolve(value);else if(Date.now()-started>timeout)reject(new Error('interaction timeout'));else setTimeout(poll,16);};poll();});
    window.__interactionQA=Object.freeze({
      async create(value,option='top'){
        document.getElementById('library-note-add').click();
        const dialog=await waitFor(()=>{const item=document.getElementById('sd-interaction-dialog');return item&&item.open?item:null;});
        const optionButton=dialog.querySelector('.interaction-option[data-value="'+option+'"]');if(optionButton)optionButton.click();
        const field=dialog.querySelector('.interaction-input');field.value=value;field.dispatchEvent(new Event('input',{bubbles:true}));
        dialog.querySelector('.interaction-actions .primary,.interaction-actions .danger').click();
        await waitFor(()=>!dialog.open);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return true;
      },
      async accept(){
        const dialog=await waitFor(()=>{const item=document.getElementById('sd-interaction-dialog');return item&&item.open?item:null;});
        const text=dialog.textContent;dialog.querySelector('.interaction-actions .primary,.interaction-actions .danger').click();await waitFor(()=>!dialog.open);return text;
      }
    });
  })()`);

  const prepared=await page.evaluate(`(()=>{
    const d=__PWA6,now=new Date(),base=now.getHours()*60+now.getMinutes()+2;
    const fmt=value=>String(Math.floor((value+1440)%1440/60)).padStart(2,'0')+':'+String((value+1440)%1440%60).padStart(2,'0');
    const rows=[['Alpha Task','Alpha Empty'],['Zeta Task','Zeta Filled'],['Child Task','Parent > Child Empty']];
    document.getElementById('plan-input').value=rows.map((row,index)=>fmt(base+index*20)+' | 20 | '+row[0]+' | work | '+row[1]+' | pages | 10').join('\\n');
    const applied=d.applySchedule({skipNotify:true});d.goTab('library');
    const drawer=document.getElementById('library-notes-drawer');drawer.open=true;
    return {applied};
  })()`);
  assert.equal(prepared.applied,true);
  await page.settle(3);

  const filled=await page.evaluate(`(async()=>{
    const d=__PWA6,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),nextRender=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const row=[...document.querySelectorAll('[data-ongoing-note-key]')].find(item=>item.dataset.ongoingNoteKey==='zeta filled');row.click();await wait(30);
    const field=document.querySelector('#library-notes-editor .library-notes-textarea');field.value='Durable Zeta note';field.dispatchEvent(new Event('input',{bubbles:true}));await d.AppData.notes.flush();
    const drawer=document.getElementById('library-notes-drawer');drawer.open=false;await wait(30);drawer.open=true;await wait(60);
    let rows=[...document.querySelectorAll('[data-ongoing-note-key]')];
    const search=document.getElementById('library-notes-search');search.value='Durable Zeta note';search.dispatchEvent(new Event('input',{bubbles:true}));await nextRender();
    const filtered=[...document.querySelectorAll('[data-ongoing-note-key]')].map(item=>item.dataset.ongoingNoteKey);
    search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));await nextRender();rows=[...document.querySelectorAll('[data-ongoing-note-key]')];
    return {
      keys:rows.map(item=>item.dataset.ongoingNoteKey),
      filtered,
      classes:Object.fromEntries(rows.map(item=>[item.dataset.ongoingNoteKey,item.className])),
      colors:Object.fromEntries(rows.map(item=>[item.dataset.ongoingNoteKey,getComputedStyle(item).color])),
      deleteDisabled:document.getElementById('library-note-delete').disabled
    };
  })()`);
  assert.equal(filled.keys[0],'zeta filled');
  assert.deepEqual(filled.filtered,['zeta filled']);
  assert.match(filled.classes['zeta filled'],/has-note/);assert.match(filled.classes['alpha empty'],/empty-note/);
  assert.notEqual(filled.colors['zeta filled'],filled.colors['alpha empty']);
  result.checks.filledFirstHierarchyAndMutedEmptyRows=true;
  console.error('[qa-notes] hierarchy and search passed');

  const temporary=await page.evaluate(`(async()=>{
    const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));await __interactionQA.create('Standalone Only','top');await wait(30);
    const before={
      selected:document.querySelector('.library-note-nav-item.active')?.dataset.ongoingNoteKey||'',
      title:document.querySelector('.library-notes-editor-title')?.textContent||'',
      badge:document.querySelector('.library-notes-editor-badge')?.textContent||'',
      focused:document.activeElement===document.querySelector('.library-notes-textarea')||document.activeElement===document.querySelector('.library-notes-editor .sd-rte-editor'),
      persisted:!!__PWA6.AppData.notes.exportPayload()['standalone only']
    };
    const drawer=document.getElementById('library-notes-drawer');drawer.open=false;await wait(30);drawer.open=true;await wait(60);
    return {...before,afterKeys:[...document.querySelectorAll('[data-ongoing-note-key]')].map(item=>item.dataset.ongoingNoteKey)};
  })()`);
  assert.deepEqual({...temporary,afterKeys:undefined},{selected:'standalone only',title:'Standalone Only',badge:'New Area',focused:true,persisted:false,afterKeys:undefined});
  assert.equal(temporary.afterKeys.includes('standalone only'),false);
  result.checks.blankManualAreaIsTemporaryAndDiscarded=true;
  console.error('[qa-notes] temporary blank passed');

  const created=await page.evaluate(`(async()=>{
    const d=__PWA6,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    await __interactionQA.create('Standalone Only','top');await wait(25);
    let field=document.querySelector('.library-notes-textarea');field.value='Standalone Area knowledge';field.dispatchEvent(new Event('input',{bubbles:true}));await d.AppData.notes.flush();
    let drawer=document.getElementById('library-notes-drawer');drawer.open=false;await wait(25);drawer.open=true;await wait(50);
    [...document.querySelectorAll('[data-ongoing-note-key]')].find(item=>item.dataset.ongoingNoteKey==='standalone only').click();await wait(25);
    await __interactionQA.create('Nested Topic','nested');await wait(25);
    field=document.querySelector('.library-notes-textarea');field.value='Nested knowledge';field.dispatchEvent(new Event('input',{bubbles:true}));await d.AppData.notes.flush();
    drawer.open=false;await wait(25);drawer.open=true;await wait(60);
    const rows=[...document.querySelectorAll('[data-ongoing-note-key]')],keys=rows.map(item=>item.dataset.ongoingNoteKey);
    const beforeCount=keys.filter(key=>key==='standalone only').length;
    [...document.querySelectorAll('[data-ongoing-note-key]')].find(item=>item.dataset.ongoingNoteKey==='standalone only').click();await wait(20);
    await __interactionQA.create('  standalone   only  ','top');await wait(30);
    return {
      keys,adjacent:keys.indexOf('standalone only > nested topic')===keys.indexOf('standalone only')+1,
      beforeCount,afterCount:[...document.querySelectorAll('[data-ongoing-note-key="standalone only"]')].length,
      selected:document.querySelector('.library-note-nav-item.active')?.dataset.ongoingNoteKey||'',
      payload:d.AppData.notes.exportPayload()
    };
  })()`);
  assert.equal(created.adjacent,true);
  assert.equal(created.beforeCount,1);assert.equal(created.afterCount,1);assert.equal(created.selected,'standalone only');
  assert.equal(created.payload['standalone only'].text,'Standalone Area knowledge');
  assert.equal(created.payload['standalone only > nested topic'].text,'Nested knowledge');
  result.checks.standaloneNestedAndDuplicateNormalizedCreation=true;
  console.error('[qa-notes] standalone and nested creation passed');

  const linkedToPlan=await page.evaluate(`(async()=>{
    const d=__PWA6,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),now=new Date(),minute=now.getHours()*60+now.getMinutes()+2;
    const start=String(Math.floor((minute+1440)%1440/60)).padStart(2,'0')+':'+String((minute+1440)%1440%60).padStart(2,'0');
    d.goTab('plan');document.getElementById('plan-input').value=start+' | 20 | Manual Area Task | work | Standalone Only | pages | 10';
    const applying=d.applySchedule({skipNotify:true});await __interactionQA.accept();const applied=await applying;d.goTab('execute');d.refreshPnote({force:true});await wait(50);
    const timer={value:document.getElementById('pn-extra').value,key:document.getElementById('pn-extra').dataset.areaKey};
    d.goTab('review');d.ReviewView.refresh({force:true});await wait(70);
    const reviewField=[...document.querySelectorAll('#review-list .task-note-field')].find(field=>field.dataset.areaKey==='standalone only');
    const review={value:reviewField?.value||'',key:reviewField?.dataset.areaKey||''};
    d.goTab('library');const drawer=document.getElementById('library-notes-drawer');drawer.open=true;await wait(60);
    return {applied,timer,review};
  })()`);
  assert.equal(linkedToPlan.applied,true);
  assert.deepEqual(linkedToPlan.timer,{value:'Standalone Area knowledge',key:'standalone only'});
  assert.deepEqual(linkedToPlan.review,{value:'Standalone Area knowledge',key:'standalone only'});
  result.checks.manualAreaAutomaticallyRejoinsPlanTimerAndReview=true;
  console.error('[qa-notes] Plan/Timer/Review link passed');

  const backupBeforeDelete=await page.evaluate(`(async()=>{
    const d=__PWA6,file=await d.BackupController.createCheckpoint(),candidate=await d.BackupController.inspect(file.blob,{filename:file.filename});
    return {counts:file.counts,inspectedCounts:candidate.preview.counts,keys:Object.keys(d.AppData.notes.exportPayload()).sort(),blobSize:file.blob.size};
  })()`);
  assert.equal(backupBeforeDelete.counts.dailyRecord,0);assert.equal(backupBeforeDelete.counts.areaNote,3);assert.ok(backupBeforeDelete.blobSize>0);
  assert.deepEqual(backupBeforeDelete.inspectedCounts,backupBeforeDelete.counts);
  assert.deepEqual(backupBeforeDelete.keys,['standalone only','standalone only > nested topic','zeta filled']);
  result.checks.areaOnlyNotesBackUpIndependentlyOfSavedDays=true;
  console.error('[qa-notes] independent backup passed');

  const deletedParent=await page.evaluate(`(async()=>{
    const d=__PWA6,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const parent=[...document.querySelectorAll('[data-ongoing-note-key]')].find(item=>item.dataset.ongoingNoteKey==='standalone only');parent.click();await wait(25);
    const before={deleteDisabled:document.getElementById('library-note-delete').disabled,child:d.AppData.notes.exportPayload()['standalone only > nested topic']?.text||''};
    document.getElementById('library-note-delete').click();const confirmation=await __interactionQA.accept();
    await new Promise((resolve,reject)=>{const started=Date.now(),poll=()=>{if(!d.AppData.notes.exportPayload()['standalone only'])resolve();else if(Date.now()-started>5000)reject(new Error('delete timeout'));else setTimeout(poll,40);};poll();});
    await wait(100);
    const rows=[...document.querySelectorAll('[data-ongoing-note-key]')],parentAfter=rows.find(item=>item.dataset.ongoingNoteKey==='standalone only');
    return {
      before,confirmation,status:document.getElementById('ongoing-notes-status').textContent,
      parentPresent:!!parentAfter,parentClass:parentAfter?.className||'',
      child:d.AppData.notes.exportPayload()['standalone only > nested topic']?.text||'',
      zeta:d.AppData.notes.exportPayload()['zeta filled']?.text||''
    };
  })()`);
  assert.equal(deletedParent.before.deleteDisabled,false);assert.equal(deletedParent.before.child,'Nested knowledge');
  assert.match(deletedParent.confirmation,/Plan tasks and saved days are unchanged/);assert.match(deletedParent.confirmation,/Parent Areas, child notes and existing backups are unchanged/);
  assert.match(deletedParent.status,/Deleted the note/);assert.equal(deletedParent.parentPresent,true);assert.match(deletedParent.parentClass,/empty-note/);
  assert.equal(deletedParent.child,'Nested knowledge');assert.equal(deletedParent.zeta,'Durable Zeta note');
  result.checks.revisionSafeDeletePreservesHierarchyTasksDaysChildrenAndBackupHistory=true;
  console.error('[qa-notes] explicit deletion passed');

  await page.setViewport({width:390,height:844,mobile:true,scale:2});await page.settle(3);
  const mobile=await page.evaluate(`(()=>{
    const add=document.getElementById('library-note-add'),remove=document.getElementById('library-note-delete'),root=document.documentElement;
    const rect=element=>{const r=element.getBoundingClientRect();return {width:r.width,height:r.height}};
    return {add:rect(add),remove:rect(remove),addLabel:add.getAttribute('aria-label'),removeLabel:remove.getAttribute('aria-label'),overflow:root.scrollWidth-root.clientWidth};
  })()`);
  assert.ok(mobile.add.width>=44&&mobile.add.height>=44);assert.ok(mobile.remove.width>=44&&mobile.remove.height>=44);
  assert.equal(mobile.addLabel,'Create an Area note');assert.equal(mobile.removeLabel,'Delete the selected Area note');assert.ok(mobile.overflow<=1);
  result.checks.compactAccessibleTouchControlsAndNoHorizontalOverflow=true;

  const mobileMaterials=await page.evaluate(`(()=>{const head=document.querySelector('.library-notes-nav-head'),drawer=document.querySelector('.library-data-drawer');drawer.open=true;const actions=[...document.querySelectorAll('.backup-file-actions>.mini-btn')].map(el=>el.getBoundingClientRect());const hs=getComputedStyle(head),root=document.documentElement;return {presentation:root.dataset.presentation,headBackground:hs.backgroundImage,headBackdrop:hs.backdropFilter||hs.webkitBackdropFilter||'none',actionWidths:actions.map(r=>Math.round(r.width)),overflow:root.scrollWidth-root.clientWidth}})()`);
  assert.equal(mobileMaterials.presentation,'glass');assert.match(mobileMaterials.headBackground,/gradient/i);assert.notEqual(mobileMaterials.headBackdrop,'none');assert.equal(mobileMaterials.actionWidths.length,2);assert.ok(Math.abs(mobileMaterials.actionWidths[0]-mobileMaterials.actionWidths[1])<=2);assert.ok(mobileMaterials.overflow<=1);
  result.checks.glassStickyControlsAndCompactBackupActions=true;

  // A long mobile note must scroll internally without trapping the surrounding Library page at its boundaries.
  await page.evaluate(`(async()=>{const d=__PWA6,current=d.AppData.notes.get('zeta filled'),text=Array.from({length:140},(_,i)=>'Boundary paragraph '+(i+1)+' — durable library scrolling evidence.').join('\n\n');d.AppData.notes.update('zeta filled','Zeta Filled',text,current?.updatedAt||'');await d.AppData.notes.flush();d.LibraryView.refreshNotes();const row=[...document.querySelectorAll('[data-ongoing-note-key]')].find(item=>item.dataset.ongoingNoteKey==='zeta filled');row?.click();})()`);
  await waitFor(()=>page.evaluate(`(()=>{const scroller=document.querySelector('#library-notes-editor wg-scroller');return !!scroller&&scroller.scrollHeight>scroller.clientHeight+20})()`),{label:'long-note internal scroll range'});
  const scrollBoundary=await page.evaluate(`(()=>{const inner=document.querySelector('#library-notes-editor wg-scroller'),drawer=document.getElementById('library-notes-drawer'),tail=document.createElement('div');tail.dataset.qaScrollTail='true';tail.style.height='900px';drawer.after(tail);const outer=document.scrollingElement,innerMax=Math.max(0,inner.scrollHeight-inner.clientHeight);inner.scrollTop=0;const top=inner.scrollTop;inner.scrollTop=innerMax;const bottom=inner.scrollTop;const outerMax=Math.max(0,outer.scrollHeight-outer.clientHeight);outer.scrollTop=Math.min(outerMax,Math.max(0,drawer.offsetTop));const before=outer.scrollTop;outer.scrollTop=Math.min(outerMax,before+180);const after=outer.scrollTop;return {innerMax,top,bottom,overscroll:getComputedStyle(inner).overscrollBehaviorY,outerMax,before,after}})()`);
  assert.ok(scrollBoundary.innerMax>20,'Long ongoing note must provide a real internal scroll range.');assert.equal(scrollBoundary.top,0);assert.ok(Math.abs(scrollBoundary.bottom-scrollBoundary.innerMax)<=1,'Long ongoing note must reach its bottom boundary.');assert.notEqual(scrollBoundary.overscroll,'contain','Ongoing-note editor must not trap scroll chaining at its boundaries.');assert.ok(scrollBoundary.outerMax>scrollBoundary.before&&scrollBoundary.after>scrollBoundary.before,'Library page must remain independently scrollable around the long note.');
  result.checks.mobileLongNoteScrollBoundaryHandoff=true;

  result.metrics.finalAreaNotes=Object.keys(await page.evaluate(`__PWA6.AppData.notes.exportPayload()`)).length;
  const unexpected=(page.events||[]).filter(event=>!/ResizeObserver loop|favicon/i.test(event.text));assert.deepEqual(unexpected,[]);
}finally{
  if(page)await browser.closePage(page);await browser.close();await server.close();
}

writeArtifact('ongoing-notes-management-results.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
