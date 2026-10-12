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
      async noteAction(id){
        const trigger=document.getElementById('library-note-actions');trigger.click();
        const item=await waitFor(()=>{const button=document.getElementById(id);return button&&!button.closest('[role="menu"]').hidden&&!button.disabled?button:null;});
        item.click();return true;
      },
      async move(value,{inPlans}={}){
        await this.noteAction('library-note-move');
        const dialog=await waitFor(()=>{const item=document.getElementById('sd-interaction-dialog');return item&&item.open?item:null;});
        const field=dialog.querySelector('.interaction-input'),before=field.value;field.value=value;field.dispatchEvent(new Event('input',{bubbles:true}));
        // The tick box shows only when today's plan or a saved plan uses the Area.
        const box=dialog.querySelector('.interaction-checkbox'),checkbox=box?{label:box.closest('label').querySelector('strong').textContent,defaultChecked:box.checked}:null;if(box&&inPlans!==undefined)box.checked=inPlans;
        const text=dialog.textContent;dialog.querySelector('.interaction-actions .primary,.interaction-actions .danger').click();
        // A merge confirmation may reuse the dialog straight away.
        await waitFor(()=>!dialog.open||!dialog.querySelector('.interaction-input'));return {before,text,checkbox};
      },
      async accept(){
        const dialog=await waitFor(()=>{const item=document.getElementById('sd-interaction-dialog');return item&&item.open?item:null;});
        const text=dialog.textContent;dialog.querySelector('.interaction-actions .primary,.interaction-actions .danger').click();await waitFor(()=>!dialog.open);return text;
      }
    });
  })()`);

  const prepared=await page.evaluate(`(()=>{
    const d=__PWA6,now=new Date(),base=now.getHours()*60+now.getMinutes()-1;
    const fmt=value=>String(Math.floor((value+1440)%1440/60)).padStart(2,'0')+':'+String((value+1440)%1440%60).padStart(2,'0');
    const rows=[['Alpha Task','Alpha Empty'],['Zeta Task','Zeta Filled'],['Child Task','Parent > Child Empty']];
    document.getElementById('plan-input').value=rows.map((row,index)=>fmt(base+index*20)+' | 20 | '+row[0]+' | work | '+row[1]+' | pages | 10').join('\\n');
    const applied=d.applySchedule({skipNotify:true});d.goTab('library');
    __PWA6.LibraryView.showSection('notes');
    return {applied};
  })()`);
  assert.equal(prepared.applied,true);
  await page.settle(3);

  const filled=await page.evaluate(`(async()=>{
    const d=__PWA6,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),nextRender=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const row=[...document.querySelectorAll('[data-ongoing-note-key]')].find(item=>item.dataset.ongoingNoteKey==='zeta filled');row.click();await wait(30);
    const field=document.querySelector('#library-notes-editor .library-notes-textarea');field.value='Durable Zeta note';field.dispatchEvent(new Event('input',{bubbles:true}));await d.AppData.notes.flush();
    __PWA6.LibraryView.showSection('days');await wait(30);__PWA6.LibraryView.showSection('notes');await wait(60);
    let rows=[...document.querySelectorAll('[data-ongoing-note-key]')];
    const search=document.getElementById('library-notes-search');search.value='Durable Zeta note';search.dispatchEvent(new Event('input',{bubbles:true}));for(let i=0;i<100&&document.querySelectorAll('[data-ongoing-note-key]').length!==1;i++)await wait(20);
    const filtered=[...document.querySelectorAll('[data-ongoing-note-key]')].map(item=>item.dataset.ongoingNoteKey);
    search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));for(let i=0;i<100&&document.querySelectorAll('[data-ongoing-note-key]').length!==4;i++)await wait(20);rows=[...document.querySelectorAll('[data-ongoing-note-key]')];
    return {
      keys:rows.map(item=>item.dataset.ongoingNoteKey),
      filtered,
      classes:Object.fromEntries(rows.map(item=>[item.dataset.ongoingNoteKey,item.className])),
      colors:Object.fromEntries(rows.map(item=>[item.dataset.ongoingNoteKey,getComputedStyle(item).color])),
      weights:Object.fromEntries(rows.map(item=>[item.dataset.ongoingNoteKey,Number(getComputedStyle(item.querySelector('.library-note-nav-name')).fontWeight)])),
      noteMenu:!!document.getElementById('library-note-actions')
    };
  })()`);
  assert.deepEqual(filled.keys,['alpha empty','parent','parent > child empty','zeta filled'],'notes are listed by name; a branch holding today’s Areas is open');
  assert.deepEqual(filled.filtered,['zeta filled']);
  assert.match(filled.classes['zeta filled'],/has-note/);assert.match(filled.classes['alpha empty'],/empty-note/);
  assert.ok(filled.weights['zeta filled']>filled.weights['alpha empty'],'saved and empty notes must remain visually distinct in every presentation');
  result.checks.alphabeticalTreeAndMutedEmptyRows=true;
  console.error('[qa-notes] hierarchy and search passed');

  const temporary=await page.evaluate(`(async()=>{
    const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));await __interactionQA.create('Standalone Only','top');await wait(30);
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const before={
      selected:document.querySelector('.library-note-nav-item.active')?.dataset.ongoingNoteKey||'',
      title:document.querySelector('.library-notes-editor-title')?.textContent||'',
      meta:document.querySelector('.library-notes-editor-meta')?.textContent||'',
      focused:document.activeElement===document.querySelector('.library-notes-textarea')||!!document.activeElement.closest('.library-notes-editor .sd-rte-wordgard'),
      persisted:!!__PWA6.AppData.notes.get('standalone only')
    };
    __PWA6.LibraryView.showSection('days');await wait(30);__PWA6.LibraryView.showSection('notes');await wait(60);
    return {...before,afterKeys:[...document.querySelectorAll('[data-ongoing-note-key]')].map(item=>item.dataset.ongoingNoteKey)};
  })()`);
  assert.deepEqual({...temporary,afterKeys:undefined},{selected:'standalone only',title:'Standalone Only',meta:'New · saved when you write',focused:true,persisted:false,afterKeys:undefined});
  assert.equal(temporary.afterKeys.includes('standalone only'),false);
  result.checks.blankManualAreaIsTemporaryAndDiscarded=true;
  console.error('[qa-notes] temporary blank passed');

  const created=await page.evaluate(`(async()=>{
    const d=__PWA6,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    await __interactionQA.create('Standalone Only','top');await wait(25);
    let field=document.querySelector('.library-notes-textarea');field.value='Standalone Area knowledge';field.dispatchEvent(new Event('input',{bubbles:true}));await d.AppData.notes.flush();
    __PWA6.LibraryView.showSection('days');await wait(25);__PWA6.LibraryView.showSection('notes');await wait(50);
    [...document.querySelectorAll('[data-ongoing-note-key]')].find(item=>item.dataset.ongoingNoteKey==='standalone only').click();await wait(25);
    await __interactionQA.create('Nested Topic','nested');await wait(25);
    field=document.querySelector('.library-notes-textarea');field.value='Nested knowledge';field.dispatchEvent(new Event('input',{bubbles:true}));await d.AppData.notes.flush();
    __PWA6.LibraryView.showSection('days');await wait(25);__PWA6.LibraryView.showSection('notes');await wait(60);
    const rows=[...document.querySelectorAll('[data-ongoing-note-key]')],keys=rows.map(item=>item.dataset.ongoingNoteKey);
    const beforeCount=keys.filter(key=>key==='standalone only').length;
    [...document.querySelectorAll('[data-ongoing-note-key]')].find(item=>item.dataset.ongoingNoteKey==='standalone only').click();await wait(20);
    await __interactionQA.create('  standalone   only  ','top');await wait(30);
    return {
      keys,adjacent:keys.indexOf('standalone only > nested topic')===keys.indexOf('standalone only')+1,
      beforeCount,afterCount:[...document.querySelectorAll('[data-ongoing-note-key="standalone only"]')].length,
      selected:document.querySelector('.library-note-nav-item.active')?.dataset.ongoingNoteKey||'',
      payload:Object.fromEntries(Object.values(d.AppData.notes.exportPayload()).map(note=>[note.label.toLowerCase(),note]))
    };
  })()`);
  assert.equal(created.adjacent,true);
  assert.equal(created.beforeCount,1);assert.equal(created.afterCount,1);assert.equal(created.selected,'standalone only');
  assert.equal(created.payload['standalone only'].text,'Standalone Area knowledge');
  assert.equal(created.payload['standalone only > nested topic'].text,'Nested knowledge');
  result.checks.standaloneNestedAndDuplicateNormalizedCreation=true;
  console.error('[qa-notes] standalone and nested creation passed');

  const linkedToPlan=await page.evaluate(`(async()=>{
    const d=__PWA6,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),now=new Date(),minute=now.getHours()*60+now.getMinutes()-1;
    const start=String(Math.floor((minute+1440)%1440/60)).padStart(2,'0')+':'+String((minute+1440)%1440%60).padStart(2,'0');
    d.goTab('plan');document.getElementById('plan-input').value=start+' | 20 | Manual Area Task | work | Standalone Only | pages | 10';
    const applying=d.applySchedule({skipNotify:true});if(applying&&typeof applying.then==='function')await __interactionQA.accept();const applied=await applying;d.goTab('execute');d.refreshPnote({force:true});await wait(50);
    const timer={value:document.getElementById('pn-extra').value,key:document.getElementById('pn-extra').dataset.areaKey};
    d.goTab('review');d.ReviewView.refresh({force:true});await wait(70);
    const reviewField=[...document.querySelectorAll('#review-list .task-note-field')].find(field=>field.dataset.areaKey==='standalone only');
    const review={value:reviewField?.value||'',key:reviewField?.dataset.areaKey||''};
    d.goTab('library');__PWA6.LibraryView.showSection('notes');await wait(60);
    return {applied,timer,review};
  })()`);
  assert.equal(linkedToPlan.applied,true);
  assert.deepEqual(linkedToPlan.timer,{value:'Standalone Area knowledge',key:'standalone only'});
  assert.deepEqual(linkedToPlan.review,{value:'Standalone Area knowledge',key:'standalone only'});
  result.checks.manualAreaAutomaticallyRejoinsPlanTimerAndReview=true;
  console.error('[qa-notes] Plan/Timer/Review link passed');

  const backupBeforeDelete=await page.evaluate(`(async()=>{
    const d=__PWA6,file=await d.BackupController.createCheckpoint(),candidate=await d.BackupController.inspect(file.blob,{filename:file.filename});
    return {counts:file.counts,inspectedCounts:candidate.preview.counts,keys:Object.values(d.AppData.notes.exportPayload()).map(note=>note.label.toLowerCase()).sort(),blobSize:file.blob.size};
  })()`);
  assert.equal(backupBeforeDelete.counts.dailyRecord,0);assert.equal(backupBeforeDelete.counts.areaNote,3);assert.ok(backupBeforeDelete.blobSize>0);
  assert.deepEqual(backupBeforeDelete.inspectedCounts,backupBeforeDelete.counts);
  assert.deepEqual(backupBeforeDelete.keys,['standalone only','standalone only > nested topic','zeta filled']);
  result.checks.areaOnlyNotesBackUpIndependentlyOfSavedDays=true;
  console.error('[qa-notes] independent backup passed');

  const deletedParent=await page.evaluate(`(async()=>{
    const d=__PWA6,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const parent=[...document.querySelectorAll('[data-ongoing-note-key]')].find(item=>item.dataset.ongoingNoteKey==='standalone only');parent.click();await wait(25);
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const before={noteMenu:!!document.getElementById('library-note-actions'),child:d.AppData.notes.get('standalone only > nested topic')?.text||''};
    await __interactionQA.noteAction('library-note-delete');const confirmation=document.getElementById('sd-interaction-dialog')?.open===true;
    await new Promise((resolve,reject)=>{const started=Date.now(),poll=()=>{if(/Moved/.test(document.getElementById('ongoing-notes-status').textContent))resolve();else if(Date.now()-started>5000)reject(new Error('delete timeout'));else setTimeout(poll,40);};poll();});
    await wait(100);
    const rows=[...document.querySelectorAll('[data-ongoing-note-key]')],parentAfter=rows.find(item=>item.dataset.ongoingNoteKey==='standalone only');
    return {
      before,confirmation,status:document.getElementById('ongoing-notes-status').textContent,
      parentPresent:!!parentAfter,parentClass:parentAfter?.className||'',
      child:d.AppData.notes.get('standalone only > nested topic')?.text||'',
      zeta:d.AppData.notes.get('zeta filled')?.text||''
    };
  })()`);
  assert.equal(deletedParent.before.noteMenu,true);assert.equal(deletedParent.before.child,'Nested knowledge');
  assert.equal(deletedParent.confirmation,false,'deleting moves the note to Recently deleted without asking');
  assert.match(deletedParent.status,/Moved “Standalone Only” to Recently deleted/);assert.equal(deletedParent.parentPresent,true);assert.match(deletedParent.parentClass,/empty-note/);
  assert.equal(deletedParent.child,'Nested knowledge');assert.equal(deletedParent.zeta,'Durable Zeta note');
  result.checks.revisionSafeDeletePreservesHierarchyTasksDaysChildrenAndBackupHistory=true;
  console.error('[qa-notes] deletion to Recently deleted passed');

  // Recently deleted: listed at the bottom, opened read-only, restored, and
  // deleted forever after confirmation.
  const trash=await page.evaluate(`(async()=>{
    const d=__PWA6,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),until=async test=>{for(let i=0;i<150&&!test();i++)await wait(20);return test();};
    const section=document.getElementById('library-notes-trash'),toggle=document.getElementById('library-notes-trash-toggle');
    const shown={hidden:section.hidden,label:toggle.textContent.replace(/\\s+/g,' ').trim()};
    toggle.click();await until(()=>document.querySelector('[data-trash-key]'));
    const row=document.querySelector('[data-trash-key]'),listed={name:row.querySelector('.library-note-nav-name').textContent,when:row.querySelector('.library-note-nav-edited').textContent,beforeList:section.firstElementChild.id};
    row.click();await until(()=>[...document.querySelectorAll('#library-notes-editor button')].some(button=>button.textContent==='Restore'));
    const preview={title:document.querySelector('.library-notes-editor-title').textContent,text:document.querySelector('#library-notes-editor .library-ongoing-note-read').textContent,editable:!!document.querySelector('#library-notes-editor textarea')};
    [...document.querySelectorAll('#library-notes-editor button')].find(button=>button.textContent==='Restore').click();
    await until(()=>/Restored/.test(document.getElementById('ongoing-notes-status').textContent));
    const restored={text:d.AppData.notes.get('standalone only')?.text||'',status:document.getElementById('ongoing-notes-status').textContent,selected:document.querySelector('.library-note-nav-item.active')?.dataset.ongoingNoteKey||'',sectionHidden:section.hidden};
    await __interactionQA.noteAction('library-note-delete');await until(()=>/Moved/.test(document.getElementById('ongoing-notes-status').textContent));
    if(toggle.getAttribute('aria-expanded')!=='true')toggle.click();await until(()=>document.querySelector('[data-trash-key]'));
    document.querySelector('[data-trash-key]').click();await until(()=>[...document.querySelectorAll('#library-notes-editor button')].some(button=>button.textContent==='Delete forever'));
    [...document.querySelectorAll('#library-notes-editor button')].find(button=>button.textContent==='Delete forever').click();
    const confirmation=await __interactionQA.accept();await until(()=>section.hidden);
    return {shown,listed,preview,restored,confirmation,forever:{sectionHidden:section.hidden,trashLeft:d.AppData.notes.trashSnapshot().length,child:d.AppData.notes.get('standalone only > nested topic')?.text||''}};
  })()`);
  assert.deepEqual(trash.shown,{hidden:false,label:'Recently deleted (1)'});
  assert.deepEqual(trash.listed,{name:'Standalone Only',when:'Deleted today',beforeList:'library-notes-trash-list'},'deleted notes are listed above the toggle, opening upward');
  assert.deepEqual(trash.preview,{title:'Standalone Only',text:trash.preview.text,editable:false});assert.match(trash.preview.text,/Standalone Area knowledge/);
  assert.equal(trash.restored.text,'Standalone Area knowledge');assert.match(trash.restored.status,/Restored “Standalone Only”/);assert.equal(trash.restored.selected,'standalone only');assert.equal(trash.restored.sectionHidden,true);
  assert.match(trash.confirmation,/will be removed for good/);assert.deepEqual(trash.forever,{sectionHidden:true,trashLeft:0,child:'Nested knowledge'});
  result.checks.recentlyDeletedRestoreAndDeleteForever=true;
  console.error('[qa-notes] Recently deleted passed');

  // The title renames in place (Escape keeps the name); Move… takes a full
  // name, and a name that already holds a note merges only after the person
  // agrees. The breadcrumb opens the parent; parent notes start collapsed.
  const renamed=await page.evaluate(`(async()=>{
    const d=__PWA6,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),until=async test=>{for(let i=0;i<150&&!test();i++)await wait(20);return test();};
    await __interactionQA.create('Rename Me','top');await wait(25);
    const field=document.querySelector('.library-notes-textarea');field.value='Moved knowledge';field.dispatchEvent(new Event('input',{bubbles:true}));await d.AppData.notes.flush();await wait(40);
    d.LibraryView.refreshNotes();await wait(40);
    const status=()=>document.getElementById('ongoing-notes-status').textContent,title=()=>document.querySelector('#library-notes-editor .library-notes-editor-title');
    const key=(target,name)=>target.dispatchEvent(new KeyboardEvent('keydown',{key:name,bubbles:true,cancelable:true}));
    title().click();let input=await until(()=>document.querySelector('.library-notes-title-input'));
    const startValue=input.value;input.value='Discarded';key(input,'Escape');await wait(40);
    const titles=()=>Object.values(d.AppData.notes.exportPayload()).map(note=>note.label.toLowerCase()),startId=d.AppData.notes.get('rename me')?.id||'';
    const escaped={title:title()?.textContent||'',keys:titles().filter(name=>/rename|discarded/.test(name))};
    title().click();input=await until(()=>document.querySelector('.library-notes-title-input'));input.value='Renamed Note';key(input,'Enter');
    await until(()=>/Renamed to/.test(status()));
    const afterRename={keptId:!!startId&&d.AppData.notes.get('renamed note')?.id===startId,keys:titles().filter(name=>/rename/.test(name)),selected:document.querySelector('.library-note-nav-item.active')?.dataset.ongoingNoteKey||'',title:title()?.textContent||'',status:status()};
    const moved=await __interactionQA.move('Standalone Only > Nested Topic');const confirmation=await __interactionQA.accept();
    await until(()=>/Merged into/.test(status()));
    const merged=d.AppData.notes.get('standalone only > nested topic')?.text||'';
    d.AppData.notes.update('standalone only','Standalone Only','Parent context',d.AppData.notes.get('standalone only')?.updatedAt||'');await d.AppData.notes.flush();
    d.LibraryView.openNote('standalone only > nested topic');await wait(60);
    const crumbs=[...document.querySelectorAll('#library-notes-editor .library-notes-crumb')].map(crumb=>crumb.textContent);
    const parents=[...document.querySelectorAll('#library-notes-editor .subject-note-context-entry')];
    const parent={label:parents[0]?.querySelector('summary')?.textContent||'',open:!!parents[0]?.open,drawn:!!parents[0]?.querySelector('.subject-note-context-entry-body')?.textContent};
    parents[0].open=true;await until(()=>parents[0].querySelector('.subject-note-context-entry-body').textContent);
    parent.openedText=parents[0].querySelector('.subject-note-context-entry-body').textContent;
    document.querySelector('#library-notes-editor .library-notes-crumb').click();await wait(40);
    const crumbOpened=document.querySelector('.library-note-nav-item.active')?.dataset.ongoingNoteKey||'';
    document.getElementById('library-notes-info').click();await wait(40);
    const info={shown:!document.getElementById('library-notes-info-popover').hidden,text:document.getElementById('library-notes-info-popover').textContent};
    document.body.click();await wait(20);
    return {startValue,escaped,afterRename,movedFrom:moved.before,confirmation,merged,crumbs,parent,crumbOpened,info,status:status()};
  })()`);
  assert.equal(renamed.startValue,'Rename Me','the title field starts from the current name');
  assert.deepEqual(renamed.escaped,{title:'Rename Me',keys:['rename me']},'Escape keeps the name');
  assert.equal(renamed.afterRename.keptId,true,'a rename keeps the note’s id');assert.deepEqual(renamed.afterRename.keys,['renamed note']);assert.equal(renamed.afterRename.selected,'renamed note');assert.equal(renamed.afterRename.title,'Renamed Note');assert.match(renamed.afterRename.status,/Renamed to “Renamed Note”/);
  assert.equal(renamed.movedFrom,'Renamed Note','Move… starts from the full name');
  assert.match(renamed.confirmation,/Merge “Renamed Note” into “Standalone Only > Nested Topic”\? Its text is added to the end/);
  assert.match(renamed.merged,/Nested knowledge/);assert.match(renamed.merged,/Moved knowledge/);assert.match(renamed.status,/Merged into|Restored/);
  assert.deepEqual(renamed.crumbs,['Standalone Only']);
  assert.deepEqual({...renamed.parent,openedText:undefined},{label:'From Standalone Only',open:false,drawn:false,openedText:undefined},'parent notes start collapsed and are drawn when opened');
  assert.match(renamed.parent.openedText,/Parent context/);
  assert.equal(renamed.crumbOpened,'standalone only','the breadcrumb opens the parent note');
  assert.deepEqual(renamed.info,{shown:true,text:'A note is shared by every plan block in the same Area; support blocks share one note.'});
  result.checks.renameInPlaceMoveMergeBreadcrumbAndParents=true;
  console.error('[qa-notes] rename and merge passed');

  const undone=await page.evaluate(`(async()=>{
    const d=__PWA6,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),until=async test=>{for(let i=0;i<150&&!test();i++)await wait(20);return test();};
    for(const close of document.querySelectorAll('.interaction-toast-close'))close.click();await until(()=>!document.querySelector('.interaction-toast'));
    [...document.querySelectorAll('[data-ongoing-note-key]')].find(item=>item.dataset.ongoingNoteKey==='zeta filled').click();await wait(30);
    await __interactionQA.noteAction('library-note-delete');await until(()=>!d.AppData.notes.get('zeta filled'));
    const toast=await until(()=>[...document.querySelectorAll('.interaction-toast')].find(item=>item.textContent.includes('Moved “Zeta Filled” to Recently deleted')));
    const undo=[...toast.querySelectorAll('button')].find(button=>button.textContent==='Undo');
    undo.click();await until(()=>document.querySelector('.library-note-nav-item.active')?.dataset.ongoingNoteKey==='zeta filled'&&/Restored/.test(document.getElementById('ongoing-notes-status').textContent));
    return {text:d.AppData.notes.get('zeta filled')?.text||'',trash:d.AppData.notes.trashSnapshot().length,selected:document.querySelector('.library-note-nav-item.active')?.dataset.ongoingNoteKey||''};
  })()`);
  assert.deepEqual(undone,{text:'Durable Zeta note',trash:0,selected:'zeta filled'},'Undo puts a deleted note back');
  result.checks.deleteUndo=true;

  // Renaming a note can take its Area along. Ticked (the default), today's
  // running block, the draft and a saved plan follow it in place; unticked,
  // they keep the old name and start a new note under it. Either way the
  // note keeps its id.
  const areaRename=await page.evaluate(`(async()=>{
    const d=__PWA6,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),until=async test=>{for(let i=0;i<150&&!test();i++)await wait(20);return test();};
    for(const close of document.querySelectorAll('.interaction-toast-close'))close.click();
    const status=()=>document.getElementById('ongoing-notes-status').textContent,plans=async()=>{const value=await d.AppData.planData.read();return {draft:String(value.draft||''),saved:value.savedPlans.map(plan=>plan.scheduleText).join('\\n')};};
    const now=new Date(),minute=now.getHours()*60+now.getMinutes()-1,start=String(Math.floor((minute+1440)%1440/60)).padStart(2,'0')+':'+String((minute+1440)%1440%60).padStart(2,'0');
    d.goTab('plan');document.getElementById('plan-input').value=start+' | 20 | Alpha Task | work | Alpha Empty | pages | 10';
    const applying=d.applySchedule({skipNotify:true});if(applying&&typeof applying.then==='function')await __interactionQA.accept();await applying;
    document.getElementById('saved-plan-name').value='Alpha plan';document.querySelector('[data-saved-plan="save"]').click();
    await until(()=>document.querySelector('[data-saved-plan-id]'));
    d.goTab('library');__PWA6.LibraryView.showSection('notes');
    d.AppData.notes.update('alpha empty','Alpha Empty','Alpha knowledge','');await d.AppData.notes.flush();d.LibraryView.refreshNotes();await wait(40);
    [...document.querySelectorAll('[data-ongoing-note-key]')].find(item=>item.dataset.ongoingNoteKey==='alpha empty').click();await wait(30);
    const id=d.AppData.notes.get('alpha empty').id,index=d.TimerState.currentIndex,taskId=d.TimerState.currentTaskId;
    const ticked=await __interactionQA.move('Alpha Renamed',{inPlans:true});await until(()=>/Renamed to “Alpha Renamed”/.test(status()));
    const tickedPlans=await plans();
    const afterTicked={checkbox:ticked.checkbox,sameId:d.AppData.notes.get('alpha renamed')?.id===id,block:d.TimerState.tasks[0]?.area,sameBlock:d.TimerState.currentIndex===index&&d.TimerState.currentTaskId===taskId,
      draft:tickedPlans.draft.includes('Alpha Renamed')&&!tickedPlans.draft.includes('Alpha Empty'),saved:tickedPlans.saved.includes('Alpha Renamed')&&!tickedPlans.saved.includes('Alpha Empty'),status:status()};
    const unticked=await __interactionQA.move('Alpha Solo',{inPlans:false});await until(()=>/Renamed to “Alpha Solo”/.test(status()));
    const untickedPlans=await plans();
    const afterUnticked={defaultChecked:unticked.checkbox?.defaultChecked,sameId:d.AppData.notes.get('alpha solo')?.id===id,block:d.TimerState.tasks[0]?.area,oldTitle:d.AppData.notes.get('alpha renamed'),
      saved:untickedPlans.saved.includes('Alpha Renamed')&&!untickedPlans.saved.includes('Alpha Solo'),status:status()};
    // The running block now shows an empty note under its own Area name.
    d.goTab('execute');d.refreshPnote({force:true});await wait(50);
    afterUnticked.execute={value:document.getElementById('pn-extra').value,key:document.getElementById('pn-extra').dataset.areaKey};d.goTab('library');
    return {afterTicked,afterUnticked};
  })()`);
  assert.deepEqual(areaRename.afterTicked.checkbox,{label:'Also rename it in today’s plan and a saved plan',defaultChecked:true},'the tick box names where the Area is used and starts ticked');
  assert.equal(areaRename.afterTicked.sameId,true,'the note keeps its id');assert.equal(areaRename.afterTicked.block,'Alpha Renamed','today’s block takes the new Area');
  assert.equal(areaRename.afterTicked.sameBlock,true,'the running block stays the running block');assert.equal(areaRename.afterTicked.draft,true);assert.equal(areaRename.afterTicked.saved,true);
  assert.match(areaRename.afterTicked.status,/Today’s plan and a saved plan now use the new name/);
  assert.deepEqual({...areaRename.afterUnticked,status:undefined},{defaultChecked:true,sameId:true,block:'Alpha Renamed',oldTitle:null,saved:true,execute:{value:'',key:'alpha renamed'},status:undefined},'unticked, the plans keep the old name and its note starts empty');
  assert.match(areaRename.afterUnticked.status,/still use the old name/);
  result.checks.renameTakesAreaAlongOrLeavesIt=true;
  console.error('[qa-notes] rename with plans passed');

  // The Library's three sections: one shows at a time and the choice, with the
  // Diary panel and the notes order, is remembered.
  const sections=await page.evaluate(`(async()=>{
    const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),shown=()=>['notes','days','data'].filter(name=>!document.getElementById('library-'+name).hidden);
    document.getElementById('library-tab-days').click();await wait(30);const days=shown();
    const diary=document.getElementById('library-diary');diary.open=true;await wait(30);
    document.getElementById('library-tab-data').click();await wait(30);const data=shown();
    document.getElementById('library-tab-data').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));await wait(30);const wrapped=shown();
    return {days,data,wrapped,selected:document.getElementById('library-tab-notes').getAttribute('aria-selected'),saved:JSON.parse(localStorage.getItem('studyDirector.library.view.v1'))};
  })()`);
  assert.deepEqual(sections,{days:['days'],data:['data'],wrapped:['notes'],selected:'true',saved:{section:'notes',diary:true,sort:'name'}});
  result.checks.librarySectionsSwitchAndRemember=true;

  // Recently edited lists notes flat, newest first, each with its path.
  const sorted=await page.evaluate(`(async()=>{
    const d=__PWA6,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),sort=document.getElementById('library-notes-sort');
    d.AppData.notes.update('alpha renamed','Alpha renamed','Newest edit','');await d.AppData.notes.flush();d.LibraryView.refreshNotes();
    sort.value='recent';sort.dispatchEvent(new Event('change'));await wait(40);
    const list=document.getElementById('library-notes-list'),first=list.querySelector('.library-note-nav-item');
    const out={role:list.getAttribute('role'),first:first?.dataset.ongoingNoteKey,edited:!!first?.querySelector('.library-note-nav-edited'),saved:JSON.parse(localStorage.getItem('studyDirector.library.view.v1')).sort};
    sort.value='name';sort.dispatchEvent(new Event('change'));await wait(40);out.tree=list.getAttribute('role');return out;
  })()`);
  assert.deepEqual(sorted,{role:null,first:'alpha renamed',edited:true,saved:'recent',tree:'tree'});
  result.checks.notesSortRecentlyEdited=true;

  // The list's edge resizes it (arrow keys here), the width is remembered, and Enter resets it.
  const resized=await page.evaluate(`(async()=>{
    const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),handle=document.getElementById('library-notes-resizer'),nav=document.querySelector('#library-notes .library-notes-nav'),width=()=>Math.round(nav.getBoundingClientRect().width),saved=()=>JSON.parse(localStorage.getItem('studyDirector.library.view.v1')).listWidth;
    const before=width();handle.focus();handle.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',shiftKey:true,bubbles:true}));await wait(30);
    const narrower=width(),remembered=saved();handle.dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true}));await wait(30);const minimum=width();
    handle.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await wait(30);
    return {narrower:before-narrower,remembered:remembered===narrower,minimum,reset:Math.abs(width()-before)<=1,cleared:saved()===undefined};
  })()`);
  assert.deepEqual(resized,{narrower:64,remembered:true,minimum:200,reset:true,cleared:true});
  await page.click('#library-notes-resizer');
  result.checks.notesListResizable=true;

  // Search lands on the match: every match is marked, Enter steps, Escape and typing clear.
  await page.evaluate(`(async()=>{const d=__PWA6;d.AppData.notes.update('alpha renamed','Alpha renamed','Mitral valve. Then the mitral area. Mitral again.',d.AppData.notes.get('alpha renamed')?.updatedAt||'');await d.AppData.notes.flush();d.LibraryView.refreshNotes();
    const search=document.getElementById('library-notes-search');search.value='mitral';search.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await waitFor(()=>page.evaluate(`document.querySelectorAll('#library-notes-editor .sd-rte-search-match').length===3`),{label:'search matches marked'});
  const landed=await page.evaluate(`(async()=>{
    const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),search=document.getElementById('library-notes-search'),bar=()=>document.getElementById('library-note-matches'),count=()=>bar().hidden?'':bar().querySelector('.library-note-matches-count').textContent;
    const first=count();search.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await wait(30);const second=count();
    search.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',shiftKey:true,bubbles:true}));search.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',shiftKey:true,bubbles:true}));await wait(30);const wrapped=count();
    search.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await wait(30);const cleared={marks:document.querySelectorAll('#library-notes-editor .sd-rte-search-match').length,bar:bar().hidden};
    search.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await wait(60);
    return {first,second,wrapped,cleared,again:document.querySelectorAll('#library-notes-editor .sd-rte-search-match').length,current:document.querySelectorAll('#library-notes-editor .sd-rte-search-match.current').length};
  })()`);
  assert.deepEqual(landed,{first:'1 of 3',second:'2 of 3',wrapped:'3 of 3',cleared:{marks:0,bar:true},again:3,current:1});
  await page.click('#library-notes-editor .sd-rte-wordgard [contenteditable]');await page.send('Input.insertText',{text:'!'});
  await waitFor(()=>page.evaluate(`document.querySelectorAll('#library-notes-editor .sd-rte-search-match').length===0&&document.getElementById('library-note-matches').hidden`),{label:'typing clears matches'});
  result.checks.searchLandsOnMatches=true;

  // Strikethrough sits in More text formatting; Print… prints the title and text only.
  const formatted=await page.evaluate(`(async()=>{
    const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),shell=document.querySelector('#library-notes-editor .sd-rte');
    const button=[...shell.querySelectorAll('button')].find(item=>item.getAttribute('aria-label')==='Strikethrough');
    const editable=shell.querySelector('[contenteditable]');editable.focus();const range=document.createRange();range.selectNodeContents(editable.querySelector('p'));const selection=getSelection();selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange'));await wait(40);
    button.click();await wait(60);
    let printed=null;const realPrint=window.print;window.print=()=>{const sheet=document.querySelector('.note-print');printed={title:sheet.querySelector('h1').textContent===document.querySelector('#library-notes-editor .library-notes-editor-title').textContent.trim(),text:sheet.innerText.includes('Mitral valve'),printing:document.documentElement.classList.contains('printing-note')};};
    document.getElementById('library-note-actions').click();await wait(30);document.getElementById('library-note-print').click();await wait(400);
    window.dispatchEvent(new Event('afterprint'));window.print=realPrint;
    return {keys:button.getAttribute('aria-keyshortcuts'),struck:!!editable.querySelector('s'),printed,left:document.querySelectorAll('.note-print').length};
  })()`);
  assert.deepEqual(formatted,{keys:'Control+Shift+x Meta+Shift+x',struck:true,printed:{title:true,text:true,printing:true},left:0});
  await page.evaluate(`(()=>{const search=document.getElementById('library-notes-search');search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  result.checks.strikethroughAndPrint=true;
  console.error('[qa-notes] sections, sort, search, strikethrough and print passed');

  // Linked notes: a quiet bar under the text, the one picker, [[ in the text, Linked from, and Execute.
  const linkIds=await page.evaluate(`(async()=>{const n=__PWA6.AppData.notes;for(const [t,x] of [['Links Heart','Heart failure basics.'],['Links Pharm','Receptor table.'],['Links ECG','Axis and rate.']]){n.update(t,t,x);await new Promise(r=>setTimeout(r,20));}await n.flush();
    __PWA6.LibraryView.revealNoteReference(n.get('Links Heart').id);await new Promise(r=>setTimeout(r,300));return {heart:n.get('Links Heart').id,pharm:n.get('Links Pharm').id,ecg:n.get('Links ECG').id};})()`);
  assert.equal(await page.evaluate(`(()=>{const bar=document.querySelector('#library-notes-editor .note-links'),editor=document.querySelector('#library-notes-editor .library-notes-editor-shell');return bar.innerText.trim()+'|'+!!(editor.compareDocumentPosition(bar)&Node.DOCUMENT_POSITION_FOLLOWING);})()`),'+ Link note|true','an empty bar is one quiet button, under the text');
  const pickNote=async(open,query)=>{await page.evaluate(open);await waitFor(()=>page.evaluate(`!!document.querySelector('dialog.note-picker[open]')`),{label:'note picker'});
    await page.evaluate(`(()=>{const f=document.querySelector('.note-picker-field');f.value=${JSON.stringify(query)};f.dispatchEvent(new Event('input',{bubbles:true}));f.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));})()`);await page.settle(4);};
  await pickNote(`document.querySelector('#library-notes-editor .note-links-add').click()`,'links pharm');
  await page.evaluate(`(()=>{const c=document.querySelector('#library-notes-editor [contenteditable="true"]');c.focus();const s=getSelection();s.selectAllChildren(c);s.collapseToEnd();})()`);
  await page.send('Input.insertText',{text:' See '});await page.send('Input.insertText',{text:'['});await page.send('Input.insertText',{text:'['});
  await waitFor(()=>page.evaluate(`!!document.querySelector('dialog.note-picker[open]')`),{label:'[[ picker'});
  assert.equal(await page.evaluate(`document.querySelector('.note-picker-field').value`),'','the keystroke that opens the picker stays out of its field');
  await page.evaluate(`(()=>{const f=document.querySelector('.note-picker-field');f.value='links ecg';f.dispatchEvent(new Event('input',{bubbles:true}));f.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));})()`);await page.settle(6);
  const linked=await page.evaluate(`(async()=>{const n=__PWA6.AppData.notes;await n.flush();const heart=n.get('Links Heart'),anchor=document.querySelector('#library-notes-editor a.sd-note-link');
    return {links:[...heart.links],bar:document.querySelector('#library-notes-editor .note-links-row').innerText.replace(/\\s+/g,' ').trim(),anchor:anchor&&{text:anchor.textContent,href:anchor.getAttribute('href')},stored:heart.text.includes('#note=${linkIds.ecg}')&&!heart.text.includes('[[')};})()`);
  assert.deepEqual(linked,{links:[linkIds.pharm],bar:'Links Pharm × +',anchor:{text:'Links ECG',href:`#note=${linkIds.ecg}`},stored:true});
  const linkedFrom=await page.evaluate(`(async()=>{__PWA6.LibraryView.revealNoteReference(${JSON.stringify(linkIds.ecg)});await new Promise(r=>setTimeout(r,300));return document.querySelector('#library-notes-editor .note-links-from')?.innerText.replace(/\\s+/g,' ').trim();})()`);
  assert.equal(linkedFrom,'Linked from Links Heart','a link in the text shows on the linked note');
  // A deleted note drops out of the bar and comes back when restored.
  const dropped=await page.evaluate(`(async()=>{const n=__PWA6.AppData.notes,trash=await n.trash('Links Pharm');__PWA6.LibraryView.revealNoteReference(${JSON.stringify(linkIds.heart)});await new Promise(r=>setTimeout(r,300));
    const hidden=document.querySelector('#library-notes-editor .note-links-row').innerText.replace(/\\s+/g,' ').trim();await n.restore(trash);__PWA6.LibraryView.revealNoteReference(${JSON.stringify(linkIds.heart)});await new Promise(r=>setTimeout(r,300));
    return {hidden,back:document.querySelector('#library-notes-editor .note-links-row').innerText.replace(/\\s+/g,' ').trim()};})()`);
  assert.deepEqual(dropped,{hidden:'+ Link note',back:'Links Pharm × +'});
  // Execute shows the block's own note first; a chip shows that note in the editor until the own chip is tapped.
  const executeLinks=await page.evaluate(`(async()=>{
    const d=__PWA6,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),now=new Date(),minute=now.getHours()*60+now.getMinutes()-1;
    const start=String(Math.floor((minute+1440)%1440/60)).padStart(2,'0')+':'+String((minute+1440)%1440%60).padStart(2,'0');
    d.goTab('plan');document.getElementById('plan-input').value=start+' | 20 | Linked block | work | Links Heart | pages | 10';
    const applying=d.applySchedule({skipNotify:true});if(applying&&typeof applying.then==='function')await __interactionQA.accept();await applying;d.goTab('execute');d.refreshPnote({force:true});await wait(100);
    const bar=()=>document.querySelector('#pn-links .note-links'),field=document.getElementById('pn-extra');
    const before=bar().querySelector('.note-links-row').innerText.replace(/\\s+/g,' ').trim();
    bar().querySelector('.note-link-open').click();await wait(100);const switched=[field.dataset.areaKey,document.getElementById('pn-area-share').textContent];
    bar().querySelector('.note-link-chip.own').click();await wait(100);
    const back=field.dataset.areaKey;d.goTab('library');return {before,switched,back};})()`);
  assert.deepEqual(executeLinks,{before:'Links Heart Links Pharm × +',switched:['links pharm','Linked · Links Pharm'],back:'links heart'});
  result.checks.linkedNotesBarTextLinksAndExecute=true;
  console.error('[qa-notes] linked notes bar, [[ links and Execute passed');

  // Tags: chips in the text, the list with counts, picks that narrow the list
  // (more than one means all of them), # suggestions, and rename everywhere.
  const tagList=await page.evaluate(`(async()=>{const d=__PWA6,n=d.AppData.notes,wait=ms=>new Promise(r=>setTimeout(r,ms));
    for(const [t,x] of [['Tags One','Renal #revise and #mcq.'],['Tags Two','Heart #Revise only.'],['Tags Three','C# and #1 are not tags. #mcq']]){n.update(t,t,x);await wait(20);}
    await n.flush();d.LibraryView.revealNoteReference(n.get('Tags One').id);await wait(300);
    const chips=()=>[...document.querySelectorAll('#library-notes-tags .library-tag-chip')],chip=name=>chips().find(c=>c.querySelector('.library-tag-name').textContent==='#'+name);
    const listed=()=>[...document.querySelectorAll('#library-notes-list [data-ongoing-note-key]')].map(r=>r.dataset.ongoingNoteKey).filter(k=>k.startsWith('tags '));
    const before=chips().map(c=>c.textContent);chip('revise').click();await wait(60);const revise=listed();chip('mcq').click();await wait(60);const both=listed();
    document.querySelector('#library-notes-tags .library-tag-tool').click();await wait(60);
    return {before,revise,both,cleared:!document.querySelector('#library-notes-tags .library-tag-chip.active'),inText:[...document.querySelectorAll('#library-notes-editor .sd-tag')].map(c=>c.dataset.sdTag)};})()`);
  assert.deepEqual(tagList,{before:['#mcq2','#revise2'],revise:['tags one','tags two'],both:['tags one'],cleared:true,inText:['revise','mcq']});
  await page.evaluate(`(()=>{const c=document.querySelector('#library-notes-editor [contenteditable="true"]');c.focus();const s=getSelection();s.selectAllChildren(c);s.collapseToEnd();})()`);
  await page.send('Input.insertText',{text:' #'});await page.send('Input.insertText',{text:'r'});
  await waitFor(()=>page.evaluate(`!!document.querySelector('dialog.note-picker[open]')`),{label:'tag suggestions'});
  assert.deepEqual(await page.evaluate(`({field:document.querySelector('.note-picker-field').value,options:[...document.querySelectorAll('.note-picker-option .note-picker-title')].map(o=>o.textContent)})`),{field:'r',options:['#revise']});
  await page.evaluate(`document.querySelector('.note-picker-field').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`);await page.settle(4);
  await page.send('Input.insertText',{text:'now'});await page.settle(4);
  const retagged=await page.evaluate(`(async()=>{const d=__PWA6,n=d.AppData.notes,wait=ms=>new Promise(r=>setTimeout(r,ms));await n.flush();
    const typed=document.querySelector('#library-notes-editor [contenteditable="true"]').innerText.trim();
    [...document.querySelectorAll('#library-notes-tags .library-tag-chip')].find(c=>c.querySelector('.library-tag-name').textContent==='#revise').click();await wait(60);
    [...document.querySelectorAll('#library-notes-tags .library-tag-tool')].find(b=>b.textContent==='Rename').click();
    const dialog=await new Promise(resolve=>{const poll=()=>{const item=document.getElementById('sd-interaction-dialog');if(item&&item.open)resolve(item);else setTimeout(poll,16);};poll();});
    const field=dialog.querySelector('.interaction-input');field.value='Review';field.dispatchEvent(new Event('input',{bubbles:true}));dialog.querySelector('.interaction-actions .primary').click();
    for(let i=0;i<100&&!/Renamed #/.test(document.getElementById('ongoing-notes-status').textContent);i++)await wait(30);
    return {typed,status:document.getElementById('ongoing-notes-status').textContent,texts:['Tags One','Tags Two','Tags Three'].map(t=>n.get(t).text),picked:[...document.querySelectorAll('#library-notes-tags .library-tag-chip.active')].map(c=>c.textContent)};})()`);
  assert.equal(retagged.typed,'Renal #revise and #mcq. #revise now');
  assert.equal(retagged.status,'Renamed #revise to #review in 2 notes.');
  assert.match(retagged.texts[0],/Renal #review and #mcq\. #review now/);assert.match(retagged.texts[1],/Heart #review only\./);assert.equal(retagged.texts[2],'C# and #1 are not tags. #mcq');
  assert.deepEqual(retagged.picked,['#review2']);
  result.checks.tagsListFilterSuggestionsAndRename=true;

  // Import: each .txt or .md file becomes a note named after it, inside the open note or at the top level.
  const imported=await page.evaluate(`(async()=>{const d=__PWA6,n=d.AppData.notes,wait=ms=>new Promise(r=>setTimeout(r,ms));
    document.querySelector('#library-notes-tags .library-tag-tool')?.click();d.LibraryView.revealNoteReference(n.get('Tags One').id);await wait(200);
    const input=document.getElementById('library-note-import-file'),files=new DataTransfer();
    files.items.add(new File(['# Valves\\n\\nMitral **stenosis**. #mcq\\n\\n- Murmur\\n- Snap\\n'],'Valves.md',{type:'text/markdown'}));
    files.items.add(new File(['One line\\nTwo lines'],'Plain.txt',{type:'text/plain'}));
    files.items.add(new File(['%PDF'],'Scan.pdf',{type:'application/pdf'}));
    input.files=files.files;input.dispatchEvent(new Event('change'));
    const dialog=await new Promise(resolve=>{const poll=()=>{const item=document.getElementById('sd-interaction-dialog');if(item&&item.open)resolve(item);else setTimeout(poll,16);};poll();});
    const question=dialog.innerText.includes('Import 3 files');
    [...dialog.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('Inside')).click();
    for(let i=0;i<100&&!/Imported/.test(document.getElementById('ongoing-notes-status').textContent);i++)await wait(30);
    const valves=n.get('Tags One > Valves'),plain=n.get('Tags One > Plain');
    return {question,status:document.getElementById('ongoing-notes-status').textContent,open:document.querySelector('#library-notes-editor .library-notes-editor-title')?.textContent,
      valves:!!valves&&valves.text.startsWith('WG1:')&&valves.text.includes('"Heading"')&&valves.text.includes('"BulletList"')&&valves.text.includes('"Strong"'),plain:!!plain&&plain.text.includes('Two lines')};})()`);
  assert.deepEqual(imported,{question:true,status:'Imported 2 notes. Not imported: Scan.pdf (not a .txt or .md file).',open:'Valves',valves:true,plain:true});
  result.checks.importTextAndMarkdownFiles=true;
  console.error('[qa-notes] tags and import passed');

  await page.setViewport({width:390,height:844,mobile:true,scale:2});await page.settle(3);
  const mobile=await page.evaluate(`(()=>{
    const add=document.getElementById('library-note-add'),root=document.documentElement;
    const rect=element=>{const r=element.getBoundingClientRect();return {width:r.width,height:r.height}};
    return {add:rect(add),addLabel:add.getAttribute('aria-label'),addText:add.textContent,overflow:root.scrollWidth-root.clientWidth};
  })()`);
  assert.ok(mobile.add.width>=44&&mobile.add.height>=44);assert.equal(mobile.addLabel,'Create a note');assert.equal(mobile.addText,'+ New');assert.ok(mobile.overflow<=1);
  result.checks.compactAccessibleTouchControlsAndNoHorizontalOverflow=true;

  // Phones show the list or one note: opening a note hides the list, and the
  // back button returns to it with the note's row focused.
  const phone=await page.evaluate(`(async()=>{
    const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),shown=selector=>{const el=document.querySelector(selector);return !!el&&getComputedStyle(el).display!=='none'&&el.getBoundingClientRect().height>0;};
    const before={list:shown('.library-notes-nav'),note:shown('#library-notes-editor')};
    [...document.querySelectorAll('[data-ongoing-note-key]')].find(item=>item.dataset.ongoingNoteKey==='zeta filled').click();await wait(60);
    const open={list:shown('.library-notes-nav'),note:shown('#library-notes-editor'),back:shown('#library-notes-editor .library-notes-back'),menuTarget:(()=>{const r=document.getElementById('library-note-actions').getBoundingClientRect();return r.width>=44&&r.height>=44;})(),width:Math.round(document.getElementById('library-notes-editor').getBoundingClientRect().width),grid:Math.round(document.querySelector('.library-notes-grid').getBoundingClientRect().width)};
    document.querySelector('#library-notes-editor .library-notes-back').click();await wait(80);
    return {before,open,after:{list:shown('.library-notes-nav'),note:shown('#library-notes-editor'),focused:document.activeElement?.dataset?.ongoingNoteKey||''},overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
  })()`);
  assert.deepEqual(phone.before,{list:true,note:false});
  assert.deepEqual({...phone.open,width:undefined,grid:undefined},{list:false,note:true,back:true,menuTarget:true,width:undefined,grid:undefined});assert.ok(Math.abs(phone.open.width-phone.open.grid)<=2,'the open note uses the full width');
  assert.deepEqual(phone.after,{list:true,note:false,focused:'zeta filled'});assert.ok(phone.overflow<=1);
  result.checks.phoneListAndNoteViews=true;

  const mobileMaterials=await page.evaluate(`(()=>{const head=document.querySelector('.library-notes-nav-head');__PWA6.LibraryView.showSection('data');document.querySelector('.backup-advanced-disclosure').open=true;const actions=[...document.querySelectorAll('.backup-file-actions>.mini-btn')].map(el=>el.getBoundingClientRect());__PWA6.LibraryView.showSection('notes');const hs=getComputedStyle(head),root=document.documentElement;return {presentation:root.dataset.presentation,headBackground:hs.backgroundImage,headBackdrop:hs.backdropFilter||hs.webkitBackdropFilter||'none',actionWidths:actions.map(r=>Math.round(r.width)),overflow:root.scrollWidth-root.clientWidth}})()`);
  assert.equal(mobileMaterials.presentation,'glass');assert.match(mobileMaterials.headBackground,/gradient/i);assert.notEqual(mobileMaterials.headBackdrop,'none');assert.equal(mobileMaterials.actionWidths.length,2);assert.ok(Math.abs(mobileMaterials.actionWidths[0]-mobileMaterials.actionWidths[1])<=2);assert.ok(mobileMaterials.overflow<=1);
  result.checks.glassStickyControlsAndCompactBackupActions=true;

  // A long mobile note must scroll internally without trapping the surrounding Library page at its boundaries.
  await page.evaluate(`(async()=>{const d=__PWA6,current=d.AppData.notes.get('zeta filled'),text=Array.from({length:140},(_,i)=>'Boundary paragraph '+(i+1)+' — durable library scrolling evidence.').join('\\n\\n');d.AppData.notes.update('zeta filled','Zeta Filled',text,current?.updatedAt||'');await d.AppData.notes.flush();d.LibraryView.refreshNotes();const row=[...document.querySelectorAll('[data-ongoing-note-key]')].find(item=>item.dataset.ongoingNoteKey==='zeta filled');row?.click();})()`);
  await waitFor(()=>page.evaluate(`(()=>{const scroller=document.querySelector('#library-notes-editor wg-scroller');return !!scroller&&scroller.scrollHeight>scroller.clientHeight+20})()`),{label:'long-note internal scroll range'});
  const scrollBoundary=await page.evaluate(`(()=>{const inner=document.querySelector('#library-notes-editor wg-scroller'),drawer=document.getElementById('library-notes'),tail=document.createElement('div');tail.dataset.qaScrollTail='true';tail.style.height='900px';drawer.after(tail);let outer=drawer.parentElement;while(outer&&!(outer.scrollHeight>outer.clientHeight+1&&/auto|scroll/.test(getComputedStyle(outer).overflowY)))outer=outer.parentElement;outer=outer||document.scrollingElement;const innerMax=Math.max(0,inner.scrollHeight-inner.clientHeight);inner.scrollTop=0;const top=inner.scrollTop;inner.scrollTop=innerMax;const bottom=inner.scrollTop;const outerMax=Math.max(0,outer.scrollHeight-outer.clientHeight);outer.scrollTop=Math.min(Math.max(0,outerMax-180),Math.max(0,drawer.offsetTop));const before=outer.scrollTop;outer.scrollTop=Math.min(outerMax,before+180);const after=outer.scrollTop;return {innerMax,top,bottom,overscroll:getComputedStyle(inner).overscrollBehaviorY,outerMax,before,after}})()`);
  assert.ok(scrollBoundary.innerMax>20,'Long note must provide a real internal scroll range.');assert.equal(scrollBoundary.top,0);assert.ok(Math.abs(scrollBoundary.bottom-scrollBoundary.innerMax)<=1,'Long note must reach its bottom boundary.');assert.notEqual(scrollBoundary.overscroll,'contain','Note editor must not trap scroll chaining at its boundaries.');assert.ok(scrollBoundary.outerMax>scrollBoundary.before&&scrollBoundary.after>scrollBoundary.before,'Library page must remain independently scrollable around the long note.');
  result.checks.mobileLongNoteScrollBoundaryHandoff=true;

  result.metrics.finalAreaNotes=Object.keys(await page.evaluate(`__PWA6.AppData.notes.exportPayload()`)).length;
  const unexpected=(page.events||[]).filter(event=>!/ResizeObserver loop|favicon/i.test(event.text));assert.deepEqual(unexpected,[]);
}finally{
  if(page)await browser.closePage(page);await browser.close();await server.close();
}

writeArtifact('ongoing-notes-management-results.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
