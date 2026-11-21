import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitForStudyDirector,waitFor} from '../../helpers/browser-harness.mjs';

// Creating, moving and renaming notes, notes not yet written, and the
// right-click menu: New asks for the name and picks its place from a list;
// Move picks a place and shows a clash before it happens; a new note stays
// listed until written or discarded; a parent or plan Area with no note can
// be renamed; the count is of real notes; right-click and a long press open
// a note's actions, each unusable one saying why.
const preload=`(()=>{
  localStorage.setItem('studyDirector.userDefaults.v1',JSON.stringify({version:1,studentName:'Places QA',updatedAt:new Date().toISOString()}));
  (localStorage.getItem('studyDirector.profiles.v1')||localStorage.setItem('studyDirector.profiles.v1',JSON.stringify({version:1,active:'prof_qa_mve00000_abcdef01',profiles:[{id:'prof_qa_mve00000_abcdef01',scope:'',name:'',email:'',folder:'',createdAt:'2026-08-01T00:00:00.000Z',fresh:false,from:null}],removing:[]})));
})()`;
const server=await startReleaseServer();
const browser=await launchChromium({profilePrefix:'qa-note-places-'});
try{
  const page=await browser.createPage(server.url('deployment','instrumented.html'),{preload});
  await waitForStudyDirector(page,{instrumented:true});
  await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().state==='primary'&&__PWA6.SessionLifecycle.status().ready`),{label:'primary ownership'});
  const result=await page.evaluate(`(async()=>{
    const d=__PWA6,wait=ms=>new Promise(r=>setTimeout(r,ms)),out={};
    const until=async(test,ms=6000)=>{const start=Date.now();while(Date.now()-start<ms){const value=test();if(value)return value;await wait(16);}throw new Error('timeout');};
    const row=key=>[...document.querySelectorAll('#library-notes-list [data-note-key]')].find(item=>item.dataset.noteKey===key);
    const keys=()=>[...document.querySelectorAll('#library-notes-list [data-note-key]')].map(item=>item.dataset.noteKey);
    const dialog=()=>until(()=>{const item=document.getElementById('sd-interaction-dialog');return item&&item.open?item:null;});
    const meta=()=>document.querySelector('.library-notes-editor-meta')?.textContent;
    const now=new Date(),minute=now.getHours()*60+now.getMinutes()-1,start=String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0');
    document.getElementById('plan-input').value=start+' | 20 | Bio Task | work | Biology | pages | 10';await d.applySchedule({skipNotify:true});
    for(const [key,label] of [['gs2','GS2'],['gs2 > polity','GS2 > Polity'],['physics','Physics'],['geo > rivers','Geo > Rivers']])d.AppData.notes.update(key,label,'text','');
    await d.AppData.notes.flush();d.goTab('library');d.LibraryView.showSection('notes');await wait(300);
    out.count=document.getElementById('library-notes-nav-count').textContent;
    // New: the place starts as the open note; Change picks another.
    row('gs2').click();await wait(150);
    document.getElementById('library-note-add').click();let box=await dialog();
    const name=box.querySelector('.interaction-input');name.value='Rights';name.dispatchEvent(new Event('input',{bubbles:true}));
    out.newDefault=box.querySelector('.interaction-preview').textContent;
    box.querySelector('.note-place-change').click();const search=await until(()=>box.querySelector('.note-place-search'));
    search.value='phys';search.dispatchEvent(new Event('input',{bubbles:true}));await wait(50);
    out.newPicked=box.querySelector('.interaction-preview').textContent;
    box.querySelector('.interaction-actions .primary').click();await until(()=>!box.open);await wait(200);
    out.newOpen={selected:document.querySelector('#library-notes-list .active')?.dataset.noteKey,meta:meta()};
    row('gs2').click();await wait(150);d.LibraryView.showSection('days');await wait(50);d.LibraryView.showSection('notes');await wait(150);
    out.newKept=keys().includes('physics > rights')||(row('physics')&&(row('physics').click(),await wait(150),keys().includes('physics > rights')));
    // "Support Activities" belongs to the shared support note: New refuses it.
    document.getElementById('library-note-add').click();box=await dialog();
    box.querySelector('.note-place-change').click();(await until(()=>box.querySelector('.note-place-option[data-key=""]'))).click();
    const reserved=box.querySelector('.interaction-input');reserved.value='support activities';reserved.dispatchEvent(new Event('input',{bubbles:true}));
    out.reservedPreview=box.querySelector('.interaction-preview').textContent;box.querySelector('.interaction-actions .primary').click();await wait(100);
    out.reservedError={open:box.open,error:box.querySelector('.interaction-error')?.textContent};box.querySelector('[data-interaction-cancel]').click();await until(()=>!box.open);
    // A new note renames and moves in memory, and Delete discards it.
    row('physics > rights').click();await wait(150);
    document.querySelector('button.library-notes-editor-title').click();const title=await until(()=>document.querySelector('.library-notes-title-input'));
    title.value='Laws';title.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await wait(200);
    out.newRenamed={selected:document.querySelector('#library-notes-list .active')?.dataset.noteKey,stored:!!d.AppData.notes.get('physics > laws')};
    document.getElementById('library-note-actions').click();await wait(100);
    const discard=document.getElementById('library-note-delete');out.discardLabel=discard.textContent;discard.click();
    out.discarded=!!(await until(()=>!keys().includes('physics > laws')).catch(()=>false));
    // Move: pick a place; a clash shows before anything happens.
    d.AppData.notes.update('physics > polity','Physics > Polity','other','');await d.AppData.notes.flush();d.LibraryView.refreshNotes();await wait(100);
    row('gs2 > polity')?.click()||(row('gs2').click(),await wait(100),row('gs2 > polity').click());await wait(150);
    document.getElementById('library-note-actions').click();await wait(100);document.getElementById('library-note-move').click();box=await dialog();
    out.moveStart={name:box.querySelector('.interaction-input').value,button:box.querySelector('.interaction-actions .primary').textContent,places:[...box.querySelectorAll('.note-place-option')].map(item=>item.dataset.key)};
    (await until(()=>box.querySelector('.note-place-option[data-key="physics"]'))).click();await wait(50);
    out.moveClash={preview:box.querySelector('.interaction-preview').textContent,button:box.querySelector('.interaction-actions .primary').textContent};
    box.querySelector('.note-place-option[data-key=""]').click();await wait(50);
    out.moveTop={preview:box.querySelector('.interaction-preview').textContent,button:box.querySelector('.interaction-actions .primary').textContent};
    const id=d.AppData.notes.get('gs2 > polity').id;
    box.querySelector('.interaction-actions .primary').click();await until(()=>!box.open);await wait(400);
    out.moved={sameId:d.AppData.notes.get('polity')?.id===id,status:document.getElementById('notes-status').textContent};
    // A parent with no note and a plan Area with no note: labels, and the
    // right-click menu says why what cannot be used cannot.
    const open=key=>{const target=row(key),rect=target.getBoundingClientRect();target.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:rect.left+40,clientY:rect.top+10}));return until(()=>{const menu=document.querySelector('.library-note-context-menu');return menu&&!menu.hidden&&menu.querySelector('.library-note-menu-item')?menu:null;});};
    let menu=await open('geo');
    out.parentMenu=Object.fromEntries([...menu.querySelectorAll('.library-note-menu-item')].map(item=>[item.id.replace('library-note-',''),item.disabled?item.querySelector('.library-note-menu-hint').textContent:'on']));
    menu.querySelector('#library-note-rename').click();const parentTitle=await until(()=>document.querySelector('.library-notes-title-input'));
    out.parentMeta=meta();parentTitle.value='Geography';parentTitle.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await until(()=>row('geography'));await wait(100);
    out.parentRenamed=!!d.AppData.notes.get('geography > rivers')&&!row('geo');
    row('biology').click();await wait(150);out.planMeta=meta();
    document.querySelector('button.library-notes-editor-title').click();const planTitle=await until(()=>document.querySelector('.library-notes-title-input'));
    planTitle.value='Botany';planTitle.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await until(()=>row('botany'));
    out.planRenamed=d.TimerState.tasks[0]?.area;
    // A long press on a touch screen opens the same menu, and its click does not open the note.
    row('physics').click();await wait(100);
    const target=row('gs2'),rect=target.getBoundingClientRect(),at={pointerId:7,pointerType:'touch',clientX:rect.left+40,clientY:rect.top+10,bubbles:true};
    document.querySelector('.library-note-context-menu')?.hidePopover?.();
    target.dispatchEvent(new PointerEvent('pointerdown',at));await wait(650);target.dispatchEvent(new PointerEvent('pointerup',at));target.click();await wait(100);
    menu=document.querySelector('.library-note-context-menu');
    out.longPress={menu:!!menu&&!menu.hidden&&menu.getAttribute('aria-label'),selected:document.querySelector('#library-notes-list .active')?.dataset.noteKey};
    // Tags: one row that scrolls sideways, Clear and the picked tags first;
    // "#..." in search looks up tags; "# Tag" under a note adds one.
    for(let index=0;index<12;index++)d.AppData.notes.update('tagged '+index,'Tagged '+index,'Note text #topic'+String.fromCharCode(97+index)+(index%2?' #odd':''),'');
    await d.AppData.notes.flush();d.LibraryView.refreshNotes();await wait(200);
    const tagRow=document.getElementById('library-notes-tags'),oneLine=()=>tagRow.getBoundingClientRect().height<44;
    out.tagRow={oneLine:oneLine(),scrolls:tagRow.scrollWidth>tagRow.clientWidth,fadeAfter:tagRow.classList.contains('more-after')};
    [...tagRow.querySelectorAll('.library-tag-chip')].filter(chip=>/#topic[ab]/.test(chip.textContent)).forEach(chip=>chip.click());await wait(150);
    out.tagRowPicked={oneLine:oneLine(),first:[...tagRow.children].slice(0,3).map(item=>(item.querySelector('.library-tag-name')||item).textContent),scrollLeft:tagRow.scrollLeft};
    tagRow.dispatchEvent(new WheelEvent('wheel',{deltaY:100,bubbles:true,cancelable:true}));out.wheel=tagRow.scrollLeft>0;
    tagRow.querySelector('.library-tag-tool').click();await wait(100);
    const notesSearch=document.getElementById('library-notes-search');notesSearch.value='#od';notesSearch.dispatchEvent(new Event('input',{bubbles:true}));await wait(200);
    out.tagSearch={notes:[...document.querySelectorAll('#library-notes-list [data-note-key]')].map(item=>item.dataset.noteKey).filter(key=>key.startsWith('tagged')).length,tags:[...tagRow.querySelectorAll('.library-tag-name')].map(item=>item.textContent)};
    notesSearch.value='';notesSearch.dispatchEvent(new Event('input',{bubbles:true}));await wait(150);
    row('physics').click();await wait(200);
    const tagButton=[...document.querySelectorAll('.note-foot-button')].find(button=>button.textContent==='# Tag');out.footButtons=[...document.querySelectorAll('.note-foot-button')].map(button=>button.textContent);
    tagButton.click();const pickerField=await until(()=>{const dialog=document.querySelector('dialog.note-picker');return dialog&&dialog.open?dialog.querySelector('.note-picker-field'):null;});
    pickerField.value='formula';pickerField.dispatchEvent(new Event('input',{bubbles:true}));pickerField.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
    await d.AppData.notes.flush();out.tagAdded=await until(()=>/#formula/.test(d.AppData.notes.get('physics')?.text||''),3000).catch(()=>false);
    // A new, empty note says how tags and links are made.
    document.getElementById('library-note-add').click();box=await dialog();const hintName=box.querySelector('.interaction-input');hintName.value='Hinted';hintName.dispatchEvent(new Event('input',{bubbles:true}));box.querySelector('.interaction-actions .primary').click();await until(()=>!box.open);await wait(200);
    out.hint=document.querySelector('#library-notes-editor .library-notes-textarea')?.getAttribute('placeholder');
    // Support Activities and a deleted note open their own menus the same
    // way, never the browser's: the shared note only what applies to it, a
    // deleted note Restore and Delete forever. The drawer's open arrow points
    // up, where its list opens.
    const items=list=>[...list.querySelectorAll('.library-note-menu-item')].map(item=>item.id.replace('library-note-',''));
    d.AppData.notes.update('support activities','Support Activities','Shared text','');
    for(const [key,label] of [['to delete','To delete'],['gone','Gone']])d.AppData.notes.update(key,label,'Soon deleted','');
    await d.AppData.notes.flush();d.LibraryView.refreshNotes();await wait(250);
    // Deleted as a person does, from the note's ⋯ menu: it goes to Recently deleted.
    for(const key of ['to delete','gone']){row(key).click();await wait(150);document.getElementById('library-note-actions').click();await wait(100);document.getElementById('library-note-delete').click();await until(()=>!row(key));await wait(150);}
    document.querySelector('.library-note-context-menu')?.hidePopover?.();
    const support=row('support activities'),supportRect=support.getBoundingClientRect();
    out.supportPrevented=!support.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:supportRect.left+40,clientY:supportRect.top+10}));
    menu=await until(()=>{const list=document.querySelector('.library-note-context-menu');return list&&!list.hidden&&list.querySelector('.library-note-menu-item')?list:null;});
    out.supportMenu={label:menu.getAttribute('aria-label'),items:items(menu)};document.querySelector('.library-note-context-menu')?.hidePopover?.();
    const toggle=document.getElementById('library-notes-trash-toggle');toggle.click();await wait(150);
    out.trashArrow=getComputedStyle(toggle,'::before').content;
    const trashRow=await until(()=>[...document.querySelectorAll('#library-notes-trash-list [data-trash-key]')].find(item=>/To delete/.test(item.textContent)));
    out.trashNoSelect=getComputedStyle(trashRow).userSelect;
    const trashRect=trashRow.getBoundingClientRect();
    out.trashPrevented=!trashRow.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:trashRect.left+40,clientY:trashRect.top+10}));
    menu=await until(()=>{const list=document.querySelector('.library-note-context-menu');return list&&!list.hidden&&list.querySelector('#library-note-restore')?list:null;});
    out.trashMenu={label:menu.getAttribute('aria-label'),items:items(menu)};
    menu.querySelector('#library-note-restore').click();out.restoredFromMenu=await until(()=>!!d.AppData.notes.get('to delete'),3000).catch(()=>false);
    return out;
  })()`);
  // Real input, not a synthetic event: the browser closes a light-dismiss menu
  // on the release of a press that began before it opened. macOS and Linux
  // send contextmenu with the right button still down, and a long press fires
  // under the finger, so the menu must still be open after the release.
  const realMenu=async(press,release,selector='#library-notes-list [data-note-key="gs2"]')=>{
    const at=await page.evaluate(`(async()=>{const d=__PWA6;document.querySelector('.library-note-context-menu')?.hidePopover?.();await new Promise(r=>setTimeout(r,100));const row=document.querySelector(${JSON.stringify(selector)});row.scrollIntoView({block:'center'});const rect=row.getBoundingClientRect();return {x:Math.round(rect.left+40),y:Math.round(rect.top+rect.height/2)};})()`);
    await press(at);await new Promise(resolve=>setTimeout(resolve,650));await release(at);await new Promise(resolve=>setTimeout(resolve,400));
    return page.evaluate(`(()=>{const menu=document.querySelector('.library-note-context-menu');return menu&&!menu.hidden&&menu.matches(':popover-open')?menu.getAttribute('aria-label'):null;})()`);
  };
  const mouse=(type,{x,y})=>page.send('Input.dispatchMouseEvent',{type,x,y,button:'right',buttons:type==='mousePressed'?2:0,clickCount:1});
  const realRightClick=await realMenu(at=>mouse('mousePressed',at),at=>mouse('mouseReleased',at));
  const touch=(type,{x,y})=>page.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y,id:1}]});
  const realLongPress=await realMenu(at=>touch('touchStart',at),at=>touch('touchEnd',at));
  // The same, for real, on Support Activities and on a deleted note (Gone is
  // still in the open Recently deleted list).
  const supportRow='#library-notes-list [data-note-key="support activities"]',trashRow='#library-notes-trash-list [data-trash-key]';
  const realSupport=[await realMenu(at=>mouse('mousePressed',at),at=>mouse('mouseReleased',at),supportRow),await realMenu(at=>touch('touchStart',at),at=>touch('touchEnd',at),supportRow)];
  const realTrash=[await realMenu(at=>mouse('mousePressed',at),at=>mouse('mouseReleased',at),trashRow),await realMenu(at=>touch('touchStart',at),at=>touch('touchEnd',at),trashRow)];
  // Deleting a tag while typing takes it out of the tag row by itself (no
  // other redraw): Physics holds the only #formula.
  await page.evaluate(`(async()=>{document.querySelector('.library-note-context-menu')?.hidePopover?.();document.querySelector('#library-notes-list [data-note-key="physics"]').click();await new Promise(r=>setTimeout(r,300));})()`);
  const tagChips=()=>page.evaluate(`[...document.querySelectorAll('#library-notes-tags .library-tag-name')].map(item=>item.textContent)`);
  const tagsBefore=await tagChips();
  await page.click('#library-notes-editor .sd-rte-wordgard [contenteditable]');
  await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',modifiers:2,commands:['selectAll']});await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',modifiers:2});
  await page.send('Input.insertText',{text:'Plain text now'});await new Promise(resolve=>setTimeout(resolve,700));
  const tagsAfter=await tagChips();
  assert.equal(tagsBefore.includes('#formula'),true,'the tag row lists #formula while Physics holds it');
  assert.equal(tagsAfter.includes('#formula'),false,'deleting the only #formula takes it out of the tag row as you type');
  assert.equal(realRightClick,'Actions for GS2','a real right-click leaves the menu open after the button is released');
  assert.equal(realLongPress,'Actions for GS2','a real long press leaves the menu open after the finger lifts');
  assert.deepEqual(result.supportMenu,{label:'Actions for Support Activities',items:['export-one','print']},'Support Activities shows only what applies to the shared note');
  assert.equal(result.supportPrevented,true,'right-click on Support Activities opens the app menu, not the browser one');
  assert.deepEqual(result.trashMenu,{label:'Actions for To delete',items:['restore','forget']},'a deleted note offers Restore and Delete forever');
  assert.equal(result.trashPrevented,true,'right-click on a deleted note opens the app menu, not the browser one');
  assert.equal(result.restoredFromMenu,true,'Restore from the menu brings the note back');
  assert.equal(result.trashNoSelect,'none','a long press on a deleted note selects no text (the same rule hides the system callout on Safari)');
  assert.equal(result.trashArrow,'"▴ "','the open drawer\'s arrow points up, where its list opens');
  assert.deepEqual(realSupport,['Actions for Support Activities','Actions for Support Activities'],'a real right-click and long press on Support Activities');
  assert.deepEqual(realTrash,['Actions for Gone','Actions for Gone'],'a real right-click and long press on a deleted note');
  assert.equal(result.count,'4','the count is of real notes: GS2, Polity, Physics, Rivers');
  assert.equal(result.newDefault,'Creates GS2 › Rights.','New starts inside the open note');
  assert.equal(result.newPicked,'Creates Physics › Rights.','Change picks another place');
  assert.deepEqual(result.newOpen,{selected:'physics > rights',meta:'Not written yet'});
  assert.equal(result.newKept,true,'a new note stays listed when another note or section is opened');
  assert.equal(result.reservedPreview,'“Support Activities” is the shared note for support blocks. Choose another name.');
  assert.deepEqual(result.reservedError,{open:true,error:'“Support Activities” is the shared note for support blocks. Choose another name.'},'no other note takes the shared note’s name');
  assert.deepEqual(result.newRenamed,{selected:'physics > laws',stored:false},'a new note renames in memory only');
  assert.equal(result.discardLabel.startsWith('Discard'),true);assert.equal(result.discarded,true,'Discard removes a new note');
  assert.deepEqual(result.moveStart,{name:'Polity',button:'Move',places:['','biology','geo','geo > rivers','gs2','physics','physics > polity']},'Move starts with the name and lists every place but the note itself and what is inside it');
  assert.match(result.moveClash.preview,/“Physics › Polity” already exists\. Moving adds this text to the end of it\./);assert.equal(result.moveClash.button,'Merge');
  assert.deepEqual(result.moveTop,{preview:'Becomes Polity.',button:'Move'});
  assert.equal(result.moved.sameId,true,'a moved note keeps its id');assert.match(result.moved.status,/Moved to “Polity”/);
  assert.deepEqual(result.parentMenu,{rename:'on',move:'on','new-inside':'on',versions:'It has nothing of its own','export-one':'It has nothing of its own',print:'It has nothing of its own',delete:'Delete the notes inside it first'});
  assert.equal(result.parentMeta,'Holds 1 note');assert.equal(result.parentRenamed,true,'renaming a parent with no note moves the notes under it');
  assert.equal(result.planMeta,'In today’s plan · not written yet');assert.equal(result.planRenamed,'Botany','renaming a plan Area with no note renames it in the plan');
  assert.deepEqual(result.longPress,{menu:'Actions for GS2',selected:'physics'},'a long press opens the menu without opening the note');
  assert.deepEqual(result.tagRow,{oneLine:true,scrolls:true,fadeAfter:true},'tags sit in one row that scrolls, with a fade where there is more');
  assert.deepEqual(result.tagRowPicked,{oneLine:true,first:['× Clear','#topica','#topicb'],scrollLeft:0},'picking keeps one row: Clear, then the picked tags');
  assert.equal(result.wheel,true,'a mouse wheel scrolls the row sideways');
  assert.deepEqual(result.tagSearch,{notes:6,tags:['#odd']},'"#od" lists the notes tagged #odd and narrows the tag row');
  assert.deepEqual(result.footButtons,['# Tag','Earlier versions'],'under a written note: # Tag and Earlier versions');
  assert.equal(result.tagAdded,true,'# Tag writes the chosen tag into the note');
  assert.equal(result.hint,'Start writing. Type # for a tag, [[ to link a note.','an empty note says how to tag and link');
  assert.deepEqual(page.events,[],'no runtime errors');
  console.log(JSON.stringify({status:'PASS',checks:Object.keys(result)},null,2));
}finally{await browser.close?.();await server.close?.();}
