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
    // A new note renames and moves in memory, and Delete discards it.
    row('physics > rights').click();await wait(150);
    document.querySelector('button.library-notes-editor-title').click();const title=await until(()=>document.querySelector('.library-notes-title-input'));
    title.value='Laws';title.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await wait(200);
    out.newRenamed={selected:document.querySelector('#library-notes-list .active')?.dataset.noteKey,stored:!!d.AppData.notes.get('physics > laws')};
    document.getElementById('library-note-actions').click();await wait(100);
    const discard=document.getElementById('library-note-delete');out.discardLabel=discard.textContent;discard.click();await wait(300);
    out.discarded=!keys().includes('physics > laws');
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
    return out;
  })()`);
  assert.equal(result.count,'4','the count is of real notes: GS2, Polity, Physics, Rivers');
  assert.equal(result.newDefault,'Creates GS2 › Rights.','New starts inside the open note');
  assert.equal(result.newPicked,'Creates Physics › Rights.','Change picks another place');
  assert.deepEqual(result.newOpen,{selected:'physics > rights',meta:'Not written yet'});
  assert.equal(result.newKept,true,'a new note stays listed when another note or section is opened');
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
  assert.deepEqual(page.events,[],'no runtime errors');
  console.log(JSON.stringify({status:'PASS',checks:Object.keys(result)},null,2));
}finally{await browser.close?.();await server.close?.();}
