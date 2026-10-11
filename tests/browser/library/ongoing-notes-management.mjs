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
    const drawer=document.getElementById('library-notes-drawer');drawer.open=false;await wait(30);drawer.open=true;await wait(60);
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
    d.goTab('library');document.getElementById('library-notes-drawer').open=true;
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

  const mobileMaterials=await page.evaluate(`(()=>{const head=document.querySelector('.library-notes-nav-head'),drawer=document.querySelector('.library-data-drawer');drawer.open=true;const actions=[...document.querySelectorAll('.backup-file-actions>.mini-btn')].map(el=>el.getBoundingClientRect());const hs=getComputedStyle(head),root=document.documentElement;return {presentation:root.dataset.presentation,headBackground:hs.backgroundImage,headBackdrop:hs.backdropFilter||hs.webkitBackdropFilter||'none',actionWidths:actions.map(r=>Math.round(r.width)),overflow:root.scrollWidth-root.clientWidth}})()`);
  assert.equal(mobileMaterials.presentation,'glass');assert.match(mobileMaterials.headBackground,/gradient/i);assert.notEqual(mobileMaterials.headBackdrop,'none');assert.equal(mobileMaterials.actionWidths.length,2);assert.ok(Math.abs(mobileMaterials.actionWidths[0]-mobileMaterials.actionWidths[1])<=2);assert.ok(mobileMaterials.overflow<=1);
  result.checks.glassStickyControlsAndCompactBackupActions=true;

  // A long mobile note must scroll internally without trapping the surrounding Library page at its boundaries.
  await page.evaluate(`(async()=>{const d=__PWA6,current=d.AppData.notes.get('zeta filled'),text=Array.from({length:140},(_,i)=>'Boundary paragraph '+(i+1)+' — durable library scrolling evidence.').join('\\n\\n');d.AppData.notes.update('zeta filled','Zeta Filled',text,current?.updatedAt||'');await d.AppData.notes.flush();d.LibraryView.refreshNotes();const row=[...document.querySelectorAll('[data-ongoing-note-key]')].find(item=>item.dataset.ongoingNoteKey==='zeta filled');row?.click();})()`);
  await waitFor(()=>page.evaluate(`(()=>{const scroller=document.querySelector('#library-notes-editor wg-scroller');return !!scroller&&scroller.scrollHeight>scroller.clientHeight+20})()`),{label:'long-note internal scroll range'});
  const scrollBoundary=await page.evaluate(`(()=>{const inner=document.querySelector('#library-notes-editor wg-scroller'),drawer=document.getElementById('library-notes-drawer'),tail=document.createElement('div');tail.dataset.qaScrollTail='true';tail.style.height='900px';drawer.after(tail);let outer=drawer.parentElement;while(outer&&!(outer.scrollHeight>outer.clientHeight+1&&/auto|scroll/.test(getComputedStyle(outer).overflowY)))outer=outer.parentElement;outer=outer||document.scrollingElement;const innerMax=Math.max(0,inner.scrollHeight-inner.clientHeight);inner.scrollTop=0;const top=inner.scrollTop;inner.scrollTop=innerMax;const bottom=inner.scrollTop;const outerMax=Math.max(0,outer.scrollHeight-outer.clientHeight);outer.scrollTop=Math.min(Math.max(0,outerMax-180),Math.max(0,drawer.offsetTop));const before=outer.scrollTop;outer.scrollTop=Math.min(outerMax,before+180);const after=outer.scrollTop;return {innerMax,top,bottom,overscroll:getComputedStyle(inner).overscrollBehaviorY,outerMax,before,after}})()`);
  assert.ok(scrollBoundary.innerMax>20,'Long note must provide a real internal scroll range.');assert.equal(scrollBoundary.top,0);assert.ok(Math.abs(scrollBoundary.bottom-scrollBoundary.innerMax)<=1,'Long note must reach its bottom boundary.');assert.notEqual(scrollBoundary.overscroll,'contain','Note editor must not trap scroll chaining at its boundaries.');assert.ok(scrollBoundary.outerMax>scrollBoundary.before&&scrollBoundary.after>scrollBoundary.before,'Library page must remain independently scrollable around the long note.');
  result.checks.mobileLongNoteScrollBoundaryHandoff=true;

  result.metrics.finalAreaNotes=Object.keys(await page.evaluate(`__PWA6.AppData.notes.exportPayload()`)).length;
  const unexpected=(page.events||[]).filter(event=>!/ResizeObserver loop|favicon/i.test(event.text));assert.deepEqual(unexpected,[]);
}finally{
  if(page)await browser.closePage(page);await browser.close();await server.close();
}

writeArtifact('ongoing-notes-management-results.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
