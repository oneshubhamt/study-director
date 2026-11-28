(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,declaredFunctions:requireFunctions}=registry.contracts;
// The Library's Notes section: the notes list (tree, search, tags, Recently
// deleted, export selection), the open note, and creating, moving, renaming
// and deleting notes. The Library hands it its own ports and a small host:
// whether Notes is showing, switching section, remembering the view, the
// attachment batch's hold on rendering, and the month names.
registry.define('library-notes',1,modules=>{
  const freeze=Object.freeze;
  if(!modules||!Object.isFrozen(modules)||Object.keys(modules).join('|')!=='noteSearch'||modules.noteSearch?.format!=='study-director.note-search-module'||modules.noteSearch.contractVersion!==1)throw new TypeError('Library notes module dependencies are incomplete or incompatible.');
  const NoteSearchModule=modules.noteSearch;
  const HOST_FUNCTIONS=freeze(['shown','showSection','rememberView','held']);
  function createNotes(input){
    exactObject(input,['ports','host'],'Library notes input');
    const {ports}=input,host=exactObject(input.host,[...HOST_FUNCTIONS,'months','savedView'],'Library notes host');
    requireFunctions(host,HOST_FUNCTIONS,'Library notes host');
    const notifications=ports.notifications;
    const {plainTextContent,renderRichTextContent,textEl}=ports.presentation;
    const {document,setTextSafe,window}=ports.view;
    const {choose,confirm,input:requestInput}=ports.interactions;
    const {createSearchWorker,requestAnimationFrame,cancelAnimationFrame}=ports.environment;
    const {exportKeys,cancel:cancelExport}=ports.exporter;
    const {
      addTag:addTagToNote,areaUse:planAreaUse,renameAreaInPlans,bindEditor,canCreate:canCreateNote,catalogue:noteCatalogue,clearEditor,clearFind,commitEditor,find:findInEditor,findStep,focusEditor,
      get:getNote,importFiles:importNoteFiles,linksBar,normalizeArea:normalizeNoteArea,normalizeTag,orderEntries:orderNoteEntries,print:printNote,
      purgeTrash:purgeExpiredNotes,remove:removeNote,rename:renameNote,renameTag:renameNoteTag,renderInherited,restore:restoreNote,reviewKept,keptVersion,searchDocuments:noteSearchDocuments,
      tagged:taggedNotes,tags:noteTags,trash:trashNote,trashSnapshot:noteTrash,versions:openNoteVersions
    }=ports.notes;
    const {invalidate:invalidateAttachments}=ports.attachments;
    const {canMutate}=ports.ownership;
    const {createAnchoredPopover}=ports.overlays;


    // Full-text search of the notes list (core/note-search.js).
    const noteSearch=NoteSearchModule.createSearch(freeze({ports:freeze({
      notes:freeze({documents:()=>noteSearchDocuments(),plainText:value=>plainTextContent(value)}),
      environment:freeze({createWorker:()=>createSearchWorker(),setTimeout:(callback,delay)=>window.setTimeout(callback,delay),clearTimeout:timer=>window.clearTimeout(timer)}),
      view:freeze({query:()=>notesSearch(),changed:()=>requestNotesRender()})
    })}));
    // Notes list order: 'name' is the tree, 'recent' a flat list, newest edit first.
    let noteSort=host.savedView.sort==='recent'?'recent':'name';
    // The notes list width a person dragged to, in pixels; 0 keeps a third of the panel.
    const NOTE_LIST_MIN=200,NOTE_LIST_MAX_SHARE=0.6;
    let noteListWidth=Number.isFinite(host.savedView.listWidth)&&host.savedView.listWidth>0?host.savedView.listWidth:0;
    // The note and query whose matches were last marked in the open note.
    let noteSearchLanded='';
    let selectedNoteKey='';
    let noteEditorSignature='',noteParentSignature='';
    let noteRenderFrame=0;
    let noteRevealFrame=0;
    let notesInstalled=false;
    // Notes made with New and not yet written: kept in the list, in memory
    // only, until they are written (stored) or discarded.
    let pendingNotes=[];
    let noteSelectionMode=false;
    let noteSelection=new Set();
    let noteExportBusy=false;
    // The notes list is a tree in the catalogue's depth-first order. Branches the
    // person opens or closes keep that state for this session; others open only
    // while they hold today's Areas or the open note.
    const noteExpanded=new Map(),NOTE_PAGE_SIZE=100;
    let noteVisibleLimit=NOTE_PAGE_SIZE,noteTreeNodes=new Map();
    // Tags picked in the tag list: the list shows notes that have all of them.
    let noteTagFilter=[],noteTagsRendered=null,noteTagsSignature='';
    // Recently deleted: the open state of its list and the deleted note shown.
    let noteTrashOpen=false,selectedTrashKey='',noteFocusKey='';

    function notesSection(){return document.getElementById('library-notes');}
    function notesEditorField(){return document.querySelector('#library-notes-editor .library-notes-textarea');}
    function notesShown(){return host.shown();}
    function notesSearch(){return String(document.getElementById('library-notes-search')?.value||'').trim().toLowerCase();}
    function noteEntries(){
      const entries=noteCatalogue();
      if(!pendingNotes.length)return entries;
      const stored=new Set(entries.map(entry=>entry.key));
      pendingNotes=pendingNotes.filter(entry=>!stored.has(entry.key));
      return pendingNotes.length?orderNoteEntries([...entries,...pendingNotes]):entries;
    }
    function noteDestinations(){
      return freeze(noteEntries().map(entry=>freeze({key:entry.key,label:entry.label,hasNote:!!entry.hasNote,pending:!!entry.ephemeral})));
    }
    // A note's title is its path, such as "Medicine > Cardiology".
    function labelParts(label){return String(label||'').split('>').map(part=>part.trim()).filter(Boolean);}
    function noteLeaf(label){return labelParts(label).at(-1)||String(label||'Area');}
    function noteParentPath(label){const parts=labelParts(label);return parts.length>1?parts.slice(0,-1).join(' > '):'';}
    function noteSelectionIndex(entries){
      const rows=Array.isArray(entries)?entries:[],byLabel=new Map(rows.map(entry=>[String(entry.label||''),entry])),index=new Map(rows.map(entry=>[entry.key,[]]));
      for(const entry of rows){
        if(!entry.hasNote)continue;
        const parts=labelParts(entry.label),seen=new Set();
        for(let depth=1;depth<=parts.length;depth++){
          const ancestor=byLabel.get(parts.slice(0,depth).join(' > '));
          if(ancestor&&!seen.has(ancestor.key)){index.get(ancestor.key)?.push(entry.key);seen.add(ancestor.key);}
        }
        if(!seen.has(entry.key))index.get(entry.key)?.push(entry.key);
      }
      return index;
    }
    function noteSelectionState(entry,index){
      const keys=index.get(entry.key)||[],selected=keys.reduce((count,key)=>count+(noteSelection.has(key)?1:0),0);
      return {keys,checked:!!keys.length&&selected===keys.length,indeterminate:selected>0&&selected<keys.length};
    }
    function updateNoteSelectionControls(entries){
      const select=document.getElementById('library-note-select'),selectAll=document.getElementById('library-note-select-all'),clear=document.getElementById('library-note-selection-clear'),exportButton=document.getElementById('library-note-export'),cancel=document.getElementById('library-note-select-cancel'),count=document.getElementById('library-note-selection-count'),navCount=document.getElementById('library-notes-nav-count');
      const exportable=(entries||[]).filter(entry=>entry.hasNote),valid=new Set(exportable.map(entry=>entry.key)),allSelected=!!exportable.length&&exportable.every(entry=>noteSelection.has(entry.key));
      for(const key of [...noteSelection])if(!valid.has(key))noteSelection.delete(key);
      const add=document.getElementById('library-note-add'),drawer=notesSection();
      if(drawer){drawer.classList.toggle('export-selecting',noteSelectionMode);drawer.setAttribute('aria-busy',noteExportBusy?'true':'false');}
      if(select)select.hidden=noteSelectionMode;
      if(add)add.hidden=noteSelectionMode;
      const importButton=document.getElementById('library-note-import');if(importButton)importButton.hidden=noteSelectionMode;
      if(navCount)navCount.hidden=noteSelectionMode;
      if(selectAll){selectAll.hidden=!noteSelectionMode;selectAll.disabled=!exportable.length||allSelected||noteExportBusy;selectAll.textContent='All';}
      if(clear){clear.hidden=!noteSelectionMode;clear.disabled=!noteSelection.size||noteExportBusy;}
      if(exportButton){exportButton.hidden=!noteSelectionMode;exportButton.disabled=!noteSelection.size||noteExportBusy;exportButton.textContent=noteExportBusy?'Preparing…':'Export';}
      if(cancel){cancel.hidden=!noteSelectionMode;cancel.disabled=false;cancel.textContent='×';cancel.setAttribute('aria-label',noteExportBusy?'Cancel notes export':'Exit export selection');cancel.title=noteExportBusy?'Cancel notes export':'Exit export selection';}
      if(count){count.hidden=!noteSelectionMode;count.textContent=`${noteSelection.size} selected`;}
    }
    function enterNoteSelection(){
      noteSelectionMode=true;noteSelection.clear();notesSection()?.classList.remove('note-open');
      const current=noteEntries().find(entry=>entry.key===selectedNoteKey);
      if(current?.hasNote)noteSelection.add(current.key);
      clearNotesEditorBinding();renderNotes();return true;
    }
    function cancelNoteSelection(){if(noteExportBusy){cancelExport();return false;}noteSelectionMode=false;noteSelection.clear();renderNotes();return true;}
    function syncNoteSelectionRows(entries,index=noteSelectionIndex(entries)){
      const rows=Array.isArray(entries)?entries:[],byKey=new Map(rows.map(entry=>[entry.key,entry]));
      for(const row of document.querySelectorAll('[data-note-key]')){
        const entry=byKey.get(row.dataset.noteKey);if(!entry)continue;
        const state=noteSelectionState(entry,index),checkbox=row.querySelector('.library-note-checkbox');
        row.classList.toggle('selected',state.checked);row.classList.toggle('partial',state.indeterminate);
        if(checkbox){checkbox.checked=state.checked;checkbox.indeterminate=state.indeterminate;checkbox.disabled=!state.keys.length;}
      }
    }
    function toggleNoteSelection(key){
      const entries=noteEntries(),entry=entries.find(candidate=>candidate.key===String(key||''));if(!entry)return false;
      const index=noteSelectionIndex(entries),state=noteSelectionState(entry,index);if(!state.keys.length)return false;
      state.keys.forEach(noteKey=>state.checked?noteSelection.delete(noteKey):noteSelection.add(noteKey));
      syncNoteSelectionRows(entries,index);updateNoteSelectionControls(entries);return true;
    }
    function selectAllNotes(){
      const entries=noteEntries(),exportable=entries.filter(entry=>entry.hasNote);if(!exportable.length)return false;
      exportable.forEach(entry=>noteSelection.add(entry.key));syncNoteSelectionRows(entries);updateNoteSelectionControls(entries);return true;
    }
    function clearNoteSelection(){const entries=noteEntries();noteSelection.clear();syncNoteSelectionRows(entries);updateNoteSelectionControls(entries);return true;}
    async function exportSelectedNotes(){
      if(noteExportBusy||!noteSelection.size)return false;
      noteExportBusy=true;updateNoteSelectionControls(noteEntries());
      const notice=notifications.begin({id:'note-export',surfaceId:'notes-status',title:'Export notes',message:'Preparing portable Markdown export…'});
      let success=false,status='No saved notes were available to export.',statusError=true,result=null;
      try{
        result=await exportKeys([...noteSelection]);
        if(result&&(result.status==='downloaded'||result.status==='saved')){
          success=true;statusError=false;
          status=result.kind==='markdown'?(result.status==='saved'?'Markdown note saved and verified.':'Markdown download started.'): `${result.status==='saved'?'Markdown package saved and verified':'Markdown package download started'} · ${result.notes} note${result.notes===1?'':'s'}${result.assets?` · ${result.assets} image${result.assets===1?'':'s'}`:''}.`;
          if(result.missing)status+=` ${result.missing} unavailable image(s) are marked in the exported notes.`;
          noteSelectionMode=false;noteSelection.clear();
        }else if(result&&result.status==='cancelled'){status='Notes export cancelled.';statusError=false;}else if(result&&result.status==='too-large')status=`This export is larger than the ${Math.round((Number(result.maxBytes)||0)/(1024*1024))} MiB safety limit. Select fewer notes and export again.`;
      }catch(error){console.error('Note export failed:',error);status='Notes export did not complete: '+error.message;}
      finally{noteExportBusy=false;if(noteSelectionMode)updateNoteSelectionControls(noteEntries());else renderNotes();notice.finish(success?'succeeded':statusError?'failed':'cancelled',status);}
      return success;
    }
    function setNotesStatus(message,{error=false,readOnly=false}={}){
      const status=document.getElementById('notes-status');
      if(!status)return false;
      status.className='library-notes-status ui-status'+(error?' err':'')+(readOnly?' read-only':'');
      notifications.feedback({id:'note-status',surfaceId:'notes-status',surface:'inline',cue:'none',severity:error?'error':'info',lifecycle:message?(error?'failed':'succeeded'):'resolved',message:String(message||'')});
      return true;
    }
    function updateNoteActions(){
      const add=document.getElementById('library-note-add'),canAdd=canMutate()&&canCreateNote();
      if(!add)return;
      add.disabled=!canAdd;add.setAttribute('aria-disabled',canAdd?'false':'true');
      add.title=canAdd?'Create a note':'Notes are at their note limit';
    }
    function parentNotesSignature(entry){
      const byKey=new Map(noteEntries().map(candidate=>[candidate.key,candidate])),parts=entry.key.split(' > '),out=[];
      for(let index=1;index<parts.length;index++){const key=parts.slice(0,index).join(' > ');out.push(`${key}\u0000${byKey.get(key)?.updatedAt||''}`);}
      return out.join('\u0001');
    }
    // Where the open note sits: each parent Area opens its own note.
    function noteBreadcrumb(entry){
      const crumbs=document.createElement('nav');crumbs.className='library-notes-crumbs';crumbs.setAttribute('aria-label','Location');
      const parts=labelParts(entry.label).slice(0,-1),keys=entry.key.split(' > ');
      parts.forEach((part,index)=>{
        const crumb=textEl('button','library-notes-crumb',part);crumb.type='button';crumb.title=`Open ${parts.slice(0,index+1).join(' › ')}`;
        crumb.addEventListener('click',()=>selectNote(keys.slice(0,index+1).join(' > ')));
        crumbs.append(crumb,textEl('span','library-notes-crumb-separator','›'));
      });
      crumbs.hidden=!parts.length;return crumbs;
    }
    // When it last changed and whether today's plan uses it.
    function noteMeta(entry,stored){
      if(entry.support)return 'Shared by every support block';
      if(entry.ephemeral)return 'Not written yet';
      if(!stored){const state=noteState(entry);return state.kind==='parent'?`${notesHeld(state.children)}${entry.current?' · in today’s plan':''}`:entry.current?'In today’s plan · not written yet':'Not written yet';}
      const edited=stored&&stored.updatedAt?editedLabel(stored.updatedAt):'',parts=[];
      if(edited)parts.push(`Edited ${/^\d/u.test(edited)?edited:edited.toLowerCase()}`);
      if(!entry.hasNote)parts.unshift('Empty');
      if(entry.current)parts.push('In today’s plan');
      return parts.join(' · ')||'Empty';
    }
    // The title renames the note in place: Enter or leaving the field saves,
    // Escape keeps the old name.
    function noteTitle(entry,renameable){
      const title=textEl(renameable?'button':'div','library-notes-editor-title',noteLeaf(entry.label));
      if(!renameable)return title;
      title.type='button';title.title='Rename';title.setAttribute('aria-label',`Rename ${noteLeaf(entry.label)}`);
      title.addEventListener('click',()=>renameNoteInPlace(entry,title));
      return title;
    }
    function renameNoteInPlace(entry,title=document.querySelector('#library-notes-editor button.library-notes-editor-title')){
      if(!entry||!title||!title.isConnected||!canMutate())return false;
      const leaf=noteLeaf(entry.label),input=document.createElement('input'),opened=performance.now();
      input.type='text';input.className='library-notes-title-input ui-field';input.value=leaf;input.maxLength=160;input.setAttribute('aria-label','Note name');
      title.replaceWith(input);input.focus();input.select();
      let done=false;
      const finish=save=>{
        if(done)return;done=true;
        const next=input.value.trim();if(input.isConnected)input.replaceWith(title);
        if(!save||!next||next===leaf)return;
        const parent=noteParentPath(entry.label);void applyNoteRename(entry,parent?`${parent} > ${next}`:next);
      };
      input.addEventListener('keydown',event=>{
        if(event.key==='Enter'){event.preventDefault();finish(true);}
        else if(event.key==='Escape'){event.preventDefault();event.stopPropagation();finish(false);title.focus();}
      });
      // Focus handed back late by a closing menu (some browsers do) must not
      // end the rename the moment it starts.
      input.addEventListener('blur',()=>{if(performance.now()-opened<400&&canMutate()){requestAnimationFrame(()=>{if(input.isConnected&&!done){input.focus();input.select();}});return;}finish(true);});
      return true;
    }
    async function printNoteEntry(entry){
      try{if(await printNote(entry.key,noteLeaf(entry.label)))return true;setNotesStatus('Write something in this note before printing it.');return false;}
      catch(error){setNotesStatus('The note could not be printed: '+(error&&error.message||error),{error:true});return false;}
    }
    async function exportNoteEntry(entry){
      if(noteExportBusy)return false;
      if(!entry||!getNote(entry.key,entry.label)){setNotesStatus('Write something in this note before exporting it.');return false;}
      noteExportBusy=true;
      const notice=notifications.begin({id:'note-export',surfaceId:'notes-status',title:'Export note',message:'Preparing the Markdown export…'});
      try{
        const result=await exportKeys([entry.key]);
        if(result&&(result.status==='downloaded'||result.status==='saved'))notice.finish('succeeded',`${result.status==='saved'?'Saved and verified':'Download started'}: “${entry.label}”${result.assets?` with ${result.assets} image${result.assets===1?'':'s'}`:''}.${result.missing?` ${result.missing} unavailable image(s) are marked in the note.`:''}`);
        else if(result&&result.status==='cancelled')notice.finish('cancelled','Export cancelled.');
        else if(result&&result.status==='too-large')notice.finish('failed',`This note is larger than the ${Math.round((Number(result.maxBytes)||0)/(1024*1024))} MiB export limit.`);
        else notice.finish('failed','This note had nothing to export.');
        return true;
      }catch(error){notice.finish('failed','The export did not complete: '+(error&&error.message||error));return false;}
      finally{noteExportBusy=false;}
    }
    // Earlier versions come from the backups; restoring one shows the two
    // texts side by side first, so it also works for a note emptied by mistake.
    async function showNoteVersions(entry){
      const restored=value=>{const at=new Date(value.exportedAt);setNotesStatus(`Restored “${entry.label}” from the backup of ${Number.isFinite(at.getTime())?at.toLocaleString():'an earlier date'}.`);};
      const result=await openNoteVersions(freeze({id:String(entry.id||''),label:entry.label,text:String(getNote(entry.key)?.text||''),onRestored:restored}));
      if(result?.reason==='no-source')setNotesStatus('Earlier versions come from your backups. Connect a Device Folder or Google Drive in Library → Data first.');
      else if(result?.reason==='busy')setNotesStatus('Another backup task is running. Try again when it finishes.');
      return result?.opened===true;
    }
    // A note's actions, for its ⋯ menu and the list's right-click menu. Each
    // runs on the note it was opened for; one that cannot be used says why.
    function noteActions(entry){
      const state=noteState(entry),writable=canMutate(),stored=state.stored,unwritten=entry.ephemeral?'Nothing written yet':state.kind==='parent'?'It has nothing of its own':'Nothing written yet';
      const open=run=>()=>{if(entry.key!==selectedNoteKey||selectedTrashKey)selectNote(entry.key);return run();};
      const readOnly=writable?'':'Read-only in this tab';
      return [
        {id:'library-note-rename',label:'Rename',hint:'F2',reason:readOnly,run:open(()=>renameNoteInPlace(selectedNoteEntry()))},
        {id:'library-note-move',label:'Move…',hint:'',reason:readOnly,run:open(()=>renameNoteEntry())},
        {id:'library-note-new-inside',label:'New note inside…',hint:'',reason:readOnly||(canCreateNote()?'':'At the note limit'),run:open(()=>createNote())},
        {id:'library-note-versions',label:'Earlier versions…',hint:'',reason:readOnly||(stored?'':unwritten),run:open(()=>showNoteVersions(entry))},
        {id:'library-note-export-one',label:'Export this note',hint:'',reason:readOnly||(stored&&entry.hasNote?'':stored?'The note is empty':unwritten),run:open(()=>exportNoteEntry(entry))},
        {id:'library-note-print',label:'Print or save as PDF…',hint:'',reason:stored&&entry.hasNote?'':stored?'The note is empty':unwritten,run:open(()=>printNoteEntry(entry))},
        'separator',
        {id:'library-note-delete',label:entry.ephemeral?'Discard':'Delete',hint:'Del',danger:true,reason:readOnly||(entry.ephemeral||stored?'':state.kind==='parent'?'Delete the notes inside it first':'It is an Area in today’s plan'),run:open(()=>deleteNote())}
      ].filter(action=>!entry.support||SUPPORT_NOTE_ACTIONS.has(action.id));
    }
    // Support Activities keeps its name and place and is never deleted: its
    // menu holds what applies to the shared note, notes inside it included.
    const SUPPORT_NOTE_ACTIONS=new Set(['library-note-new-inside','library-note-export-one','library-note-print']);
    // A deleted note's actions, the same as its Restore and Delete forever.
    function trashActions(item){
      const readOnly=canMutate()?'':'Read-only in this tab';
      return [
        {id:'library-note-restore',label:'Restore',hint:'',reason:readOnly,run:()=>restoreTrashedNote(item.key)},
        'separator',
        {id:'library-note-forget',label:'Delete forever',hint:'',danger:true,reason:readOnly,run:()=>deleteTrashedNoteForever(item.key)}
      ];
    }
    // Fills a menu with a note's actions as they stand now.
    function fillNoteMenu(menu,entry,controller){fillMenu(menu,noteActions(entry),controller);}
    function fillMenu(menu,actions,controller){
      menu.replaceChildren(...actions.map(action=>{
        if(action==='separator'){const line=document.createElement('div');line.className='library-note-menu-separator';line.setAttribute('role','separator');return line;}
        const button=document.createElement('button');button.type='button';button.id=action.id;button.className='library-note-menu-item'+(action.danger?' danger':'');button.setAttribute('role','menuitem');
        button.disabled=!!action.reason;
        button.append(textEl('span','',action.label),textEl('span','library-note-menu-hint'+(action.reason?'':' ui-mono'),action.reason||action.hint));
        // The menu closes first, so focus handed back as it closes cannot end
        // what the action opens (the rename field, a dialog).
        button.addEventListener('click',()=>{controller.hide();requestAnimationFrame(()=>requestAnimationFrame(()=>{void action.run();}));});
        return button;
      }));
    }
    function focusFirstMenuItem(menu){requestAnimationFrame(()=>{const first=menu.querySelector('[role="menuitem"]:not(:disabled)');if(first)first.focus();});}
    function noteActionsMenu(entry){
      const trigger=textEl('button','library-note-tool ui-btn','⋯');trigger.type='button';trigger.id='library-note-actions';
      trigger.setAttribute('aria-label',`Actions for ${entry.label}`);trigger.setAttribute('aria-haspopup','menu');trigger.setAttribute('aria-expanded','false');trigger.title=entry.support?'New note inside, export or print':'Rename, move or delete this note';
      const menu=document.createElement('div');menu.className='library-note-menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label',`Actions for ${entry.label}`);
      const controller=createAnchoredPopover(menu,{align:'end',onClose:()=>trigger.setAttribute('aria-expanded','false')});
      trigger.addEventListener('click',event=>{
        event.preventDefault();
        if(!menu.hidden){controller.hide();return;}
        // The note as it stands now: this button was drawn with the note, and
        // a new note's first words do not redraw it (right-click reads the
        // list the same way).
        const current=noteEntries().find(candidate=>candidate.key===entry.key)||entry;
        fillNoteMenu(menu,current,controller);controller.show(trigger);trigger.setAttribute('aria-expanded','true');focusFirstMenuItem(menu);
      });
      return [trigger,menu];
    }
    // Right-click (or a long press on a touch screen) on a row opens the same
    // actions at the pointer.
    let noteContextMenu=null;
    function openNoteContextMenu(entry,row,x,y){return !!entry&&openContextMenu(entry.label,noteActions(entry),row,x,y);}
    function openTrashContextMenu(item,row,x,y){return !!item&&openContextMenu(item.label,trashActions(item),row,x,y);}
    function openContextMenu(label,actions,row,x,y){
      if(noteSelectionMode)return false;
      if(!noteContextMenu){
        const menu=document.createElement('div');menu.className='library-note-menu library-note-context-menu';menu.setAttribute('role','menu');
        let point={x:0,y:0};
        const controller=createAnchoredPopover(menu,{anchorRect:()=>new DOMRect(point.x,point.y,0,0)});
        document.body.append(menu);noteContextMenu={menu,controller,at:(px,py)=>{point={x:px,y:py};}};
      }
      const {menu,controller,at}=noteContextMenu;
      if(!menu.hidden)controller.hide();
      menu.setAttribute('aria-label',`Actions for ${label}`);at(x,y);fillMenu(menu,actions,controller);controller.show(row);focusFirstMenuItem(menu);
      return true;
    }
    function chooseNote(entries,filtered){
      const visible=(filtered||[]).find(entry=>entry.key===selectedNoteKey);
      if(visible)return visible;
      const preferred=(filtered||[]).find(entry=>entry.current&&entry.hasNote)
        ||(filtered||[]).find(entry=>entry.current)
        ||(filtered||[]).find(entry=>entry.hasNote)
        ||(filtered||[])[0]
        ||null;
      selectedNoteKey=preferred?preferred.key:'';
      return preferred;
    }
    // Builds the tree from the catalogue's depth-first order: each note's parent
    // is the nearest earlier note one level up.
    function noteTree(entries){
      const nodes=entries.map(entry=>({entry,depth:Math.max(0,Number(entry.depth)||0),parent:null,children:0,holdsActive:false,expanded:false})),stack=[];
      for(const node of nodes){
        while(stack.length&&stack.at(-1).depth>=node.depth)stack.pop();
        node.parent=stack.at(-1)||null;if(node.parent)node.parent.children+=1;
        stack.push(node);
      }
      for(const node of nodes)if(node.entry.current||node.entry.key===selectedNoteKey)for(let up=node.parent;up&&!up.holdsActive;up=up.parent)up.holdsActive=true;
      for(const node of nodes)node.expanded=node.children>0&&(noteSelectionMode||(noteExpanded.has(node.entry.key)?noteExpanded.get(node.entry.key):node.holdsActive));
      const visible=[];let closedAt=-1;
      for(const node of nodes){
        if(closedAt>=0&&node.depth>closedAt)continue;
        closedAt=-1;visible.push(node);
        if(node.children&&!node.expanded)closedAt=node.depth;
      }
      noteTreeNodes=new Map(nodes.map(node=>[node.entry.key,node]));
      return visible;
    }
    // Opens every branch above a note, so it is shown however the tree was left.
    function expandNoteAncestors(key){
      const node=noteTreeNodes.get(key);
      for(let up=node&&node.parent;up;up=up.parent)noteExpanded.set(up.entry.key,true);
    }
    // Phones show the list or one note at a time: opening a note shows it full
    // width, and its back button returns to the list.
    function phoneLayout(){try{return !!window.matchMedia&&window.matchMedia('(max-width: 720px)').matches;}catch{return false;}}
    function openNoteView(){const drawer=notesSection();if(drawer&&phoneLayout()&&!noteSelectionMode)drawer.classList.add('note-open');}
    function closeNoteView(){
      const drawer=notesSection();if(!drawer||!drawer.classList.contains('note-open'))return false;
      drawer.classList.remove('note-open');
      requestAnimationFrame(()=>{const row=document.querySelector('#library-notes-list [role="treeitem"].active');if(row){row.tabIndex=0;row.focus({preventScroll:false});}});
      return true;
    }
    function noteViewBackButton(){
      const back=textEl('button','library-notes-back ui-btn','‹ Notes');back.type='button';back.setAttribute('aria-label','Back to the notes list');
      back.addEventListener('click',closeNoteView);return back;
    }
    function toggleNoteBranch(key,expanded){noteExpanded.set(key,!!expanded);noteFocusKey=key;renderNotes();return true;}
    function startOfLocalDay(time){const date=new Date(time);return new Date(date.getFullYear(),date.getMonth(),date.getDate()).getTime();}
    function daysBefore(value){const time=Date.parse(String(value||''));return Number.isFinite(time)?Math.max(0,Math.round((startOfLocalDay(Date.now())-startOfLocalDay(time))/86400000)):-1;}
    // When a note last changed: a time today, "Yesterday", then a date.
    function editedLabel(value){
      const days=daysBefore(value);if(days<0)return '';
      const date=new Date(Date.parse(value));
      if(days===0)return `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
      if(days===1)return 'Yesterday';
      return `${date.getDate()} ${host.months[date.getMonth()]}${date.getFullYear()!==new Date().getFullYear()?` ${date.getFullYear()}`:''}`;
    }
    function deletedLabel(value){const days=daysBefore(value);return days<=0?'Deleted today':days===1?'Deleted yesterday':`Deleted ${days} days ago`;}
    function buildNoteTreeItem(node){
      const {entry}=node,active=entry.key===selectedNoteKey&&!selectedTrashKey,leaf=noteLeaf(entry.label),row=document.createElement('div');
      row.className='library-note-nav-item library-note-tree-item '+(entry.hasNote?'has-note':'empty-note')+(entry.support?' support-note':'')+(active?' active':'');
      row.style.setProperty('--note-indent',`${Math.min(6,node.depth)*15}px`);
      row.dataset.noteKey=entry.key;row.setAttribute('role','treeitem');row.setAttribute('aria-level',String(node.depth+1));row.setAttribute('aria-selected',active?'true':'false');
      // The name starts with the row's visible text (name, TODAY, last edit), as
      // WCAG 2.5.3 asks, then adds what the row shows only by style.
      const edited=editedLabel(entry.updatedAt);
      row.setAttribute('aria-label',`${leaf}${node.children?` ${node.children}`:''}${entry.current?' TODAY':''}${edited?` ${edited}`:''}${entry.hasNote?'':entry.id?', empty':node.children?'':', not written yet'}${node.children?`, ${node.children} nested ${node.children===1?'note':'notes'}`:''}${entry.current?', in today’s plan':''}`);
      if(node.children)row.setAttribute('aria-expanded',node.expanded?'true':'false');
      row.tabIndex=-1;
      const twisty=textEl('span','library-note-twisty',node.children?(node.expanded?'▾':'▸'):'');twisty.setAttribute('aria-hidden','true');
      if(node.children)twisty.addEventListener('click',event=>{event.stopPropagation();toggleNoteBranch(entry.key,!node.expanded);});
      // Columns stay put: the name with TODAY beside it, then the last edit
      // always at the right edge.
      const name=document.createElement('span');name.className='library-note-tree-name';name.append(textEl('span','library-note-nav-name',leaf));
      // A parent shows how many notes sit directly inside it, open or closed.
      if(node.children){const count=textEl('span','library-note-child-count',String(node.children));count.title=`${node.children} nested ${node.children===1?'note':'notes'}`;name.append(' ',count);}
      if(entry.current)name.append(' ',textEl('span','library-note-tag current','TODAY'));
      // Spaces between the parts keep words apart for assistive technology; a
      // grid does not draw them.
      row.append(twisty,' ',name,' ',textEl('span','library-note-nav-edited',edited));
      row.addEventListener('click',()=>selectNote(entry.key));
      return row;
    }
    // Arrow keys move through the tree, Right and Left open and close a branch,
    // Enter opens a note and F2 renames it.
    function handleNoteTreeKey(event){
      const row=event.target&&event.target.closest?event.target.closest('[role="treeitem"]'):null;if(!row)return;
      const rows=[...document.querySelectorAll('#library-notes-list [role="treeitem"]')],index=rows.indexOf(row),key=row.dataset.noteKey,node=noteTreeNodes.get(key);
      const focusRow=target=>{if(!target)return;for(const item of rows)item.tabIndex=-1;target.tabIndex=0;target.focus();};
      if(event.key==='ArrowDown')focusRow(rows[index+1]);
      else if(event.key==='ArrowUp')focusRow(rows[index-1]);
      else if(event.key==='Home')focusRow(rows[0]);
      else if(event.key==='End')focusRow(rows.at(-1));
      else if(event.key==='ArrowRight'){if(!node||!node.children)return;if(node.expanded)focusRow(rows[index+1]);else toggleNoteBranch(key,true);}
      else if(event.key==='ArrowLeft'){if(node&&node.children&&node.expanded)toggleNoteBranch(key,false);else if(node&&node.parent)focusRow(rows.find(item=>item.dataset.noteKey===node.parent.entry.key));else return;}
      else if(event.key==='Enter'||event.key===' '){noteFocusKey=key;selectNote(key);}
      else if(event.key==='F2'){selectNote(key);const entry=selectedNoteEntry();if(entry)renameNoteInPlace(entry);}
      else if(event.key==='ContextMenu'||(event.key==='F10'&&event.shiftKey)){const rect=row.getBoundingClientRect();openNoteContextMenu(noteEntries().find(entry=>entry.key===key),row,rect.left+24,rect.bottom);}
      else if(event.key==='Delete'){noteFocusKey=key;selectNote(key);void deleteNote();}
      else return;
      event.preventDefault();
    }
    // Right-click on a row, or a long press on a touch screen (iPadOS and iOS
    // send no contextmenu for one), opens its actions at the pointer.
    function installNoteContextMenu(list){
      // A note's row (Support Activities included) or a deleted note's row.
      const rowEntry=target=>{
        const trashRow=target&&target.closest?target.closest('[data-trash-key]'):null;
        if(trashRow){const trash=noteTrashItems().find(item=>item.key===trashRow.dataset.trashKey);return trash?{row:trashRow,trash}:null;}
        const row=target&&target.closest?target.closest('[data-note-key]'):null;const entry=row?noteEntries().find(item=>item.key===row.dataset.noteKey):null;return entry?{row,entry}:null;
      };
      let press=null,suppressClick=false,held=null;
      const cancel=()=>{if(press){clearTimeout(press.timer);press=null;}};
      // The menu is a light-dismiss popover: a press that began before it
      // opened and ends outside it closes it again. macOS and Linux send
      // contextmenu while the right button is still down, and a long press
      // fires under the finger, so the menu opens once that button or finger
      // is released. (Windows sends contextmenu after the release: it opens
      // at once.)
      const openAfterRelease=(hit,x,y)=>{const open=()=>hit.trash?openTrashContextMenu(hit.trash,hit.row,x,y):openNoteContextMenu(hit.entry,hit.row,x,y);if(held)held.open=open;else open();};
      const release=event=>{if(!held||event.pointerId!==held.id)return;const open=held.open;held=null;if(open&&event.type==='pointerup')setTimeout(open,0);};
      window.addEventListener('pointerup',release,true);window.addEventListener('pointercancel',release,true);
      list.addEventListener('contextmenu',event=>{const hit=rowEntry(event.target);if(!hit||noteSelectionMode)return;event.preventDefault();cancel();openAfterRelease(hit,event.clientX,event.clientY);});
      list.addEventListener('pointerdown',event=>{
        held=event.pointerType==='touch'||event.button===2?{id:event.pointerId,open:null}:null;
        if(event.pointerType!=='touch')return;const hit=rowEntry(event.target);if(!hit||noteSelectionMode)return;
        cancel();press={x:event.clientX,y:event.clientY,timer:setTimeout(()=>{press=null;suppressClick=true;openAfterRelease(hit,event.clientX,event.clientY);},500)};
      });
      list.addEventListener('pointermove',event=>{if(press&&Math.hypot(event.clientX-press.x,event.clientY-press.y)>8)cancel();});
      for(const type of ['pointerup','pointercancel','scroll'])list.addEventListener(type,cancel,{passive:true});
      // The click that ends a long press must not also open the note.
      list.addEventListener('click',event=>{if(suppressClick){suppressClick=false;event.preventDefault();event.stopPropagation();}},true);
    }
    function noteTrashItems(){
      return [...noteTrash()].sort((a,b)=>String(a.label).localeCompare(String(b.label),undefined,{sensitivity:'base',numeric:true})||String(b.deletedAt).localeCompare(String(a.deletedAt)));
    }
    function buildTrashedNoteItem(item){
      const button=document.createElement('button');button.type='button';
      button.className='library-note-nav-item library-note-trash-item'+(item.hasNote?' has-note':' empty-note')+(item.key===selectedTrashKey?' active':'');
      button.dataset.trashKey=item.key;button.setAttribute('aria-current',item.key===selectedTrashKey?'true':'false');
      const parent=noteParentPath(item.label);
      button.append(textEl('span','library-note-nav-name',noteLeaf(item.label)),textEl('span','library-note-nav-edited',deletedLabel(item.deletedAt)));
      if(parent)button.append(textEl('span','library-note-nav-path',parent.replace(/\s*>\s*/g,' › ')));
      button.addEventListener('click',()=>selectTrashedNote(item.key));
      return button;
    }
    // Recently deleted sits at the bottom of the list and opens upward. It is
    // hidden while empty and during export.
    function renderNoteTrash(){
      const section=document.getElementById('library-notes-trash'),list=document.getElementById('library-notes-trash-list'),toggle=document.getElementById('library-notes-trash-toggle'),count=document.getElementById('library-notes-trash-count');
      if(!section||!list||!toggle)return;
      const items=noteSelectionMode?[]:noteTrashItems();
      section.hidden=!items.length;
      if(!items.length){noteTrashOpen=false;list.replaceChildren();return;}
      if(count)count.textContent=`(${items.length})`;
      toggle.setAttribute('aria-expanded',noteTrashOpen?'true':'false');list.hidden=!noteTrashOpen;
      list.replaceChildren(...(noteTrashOpen?items.map(buildTrashedNoteItem):[]));
    }
    function toggleNoteTrash(){
      noteTrashOpen=!noteTrashOpen;
      if(noteTrashOpen&&canMutate())purgeExpiredNotes();
      renderNotes();return true;
    }
    function selectTrashedNote(key){
      if(!noteTrashItems().some(item=>item.key===key))return false;
      selectedTrashKey=key;renderNotes();openNoteView();return true;
    }
    function buildNoteNavItem(entry,selectionIndex){
      if(noteSelectionMode){
        const state=noteSelectionState(entry,selectionIndex),row=document.createElement('div');
        row.className='library-note-nav-item library-note-select-item '+(entry.hasNote?'has-note':'empty-note')+(entry.support?' support-note':'')+(entry.key===selectedNoteKey?' active':'')+(state.checked?' selected':'')+(state.indeterminate?' partial':'');
        row.style.setProperty('--note-indent',`${Math.min(6,Math.max(0,Number(entry.depth)||0))*15}px`);row.dataset.noteKey=entry.key;
        const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.className='library-note-checkbox';checkbox.checked=state.checked;checkbox.indeterminate=state.indeterminate;checkbox.disabled=!state.keys.length;checkbox.setAttribute('aria-label',state.keys.length?`Select ${entry.label}${state.keys.length>1?' and nested notes':''} for export`:`${entry.label} has no saved note to export`);checkbox.addEventListener('change',()=>toggleNoteSelection(entry.key));
        const body=document.createElement('button');body.type='button';body.className='library-note-select-copy';body.setAttribute('aria-label',`Preview ${entry.label}`);body.setAttribute('aria-current',entry.key===selectedNoteKey?'true':'false');
        const name=textEl('span','library-note-nav-name',noteLeaf(entry.label)),tags=document.createElement('span');tags.className='library-note-nav-tags';
        const noteTag=textEl('span','library-note-tag note','NOTE');noteTag.hidden=!entry.hasNote;tags.appendChild(noteTag);if(entry.current)tags.appendChild(textEl('span','library-note-tag current','TODAY'));
        const pathLabel=entry.support?'Shared support note':noteParentPath(entry.label);
        body.append(name,tags);if(pathLabel)body.append(textEl('span','library-note-nav-path',pathLabel));body.addEventListener('click',()=>selectNote(entry.key));row.append(checkbox,body);return row;
      }
      const button=document.createElement('button');
      button.type='button';
      button.className='library-note-nav-item '+(entry.hasNote?'has-note':'empty-note')+(entry.support?' support-note':'')+(entry.key===selectedNoteKey?' active':'');
      button.dataset.noteKey=entry.key;
      button.setAttribute('aria-label',`Open ${entry.hasNote?'saved':'empty'} note for ${entry.label}`);
      button.setAttribute('aria-current',entry.key===selectedNoteKey?'true':'false');
      const name=textEl('span','library-note-nav-name',noteLeaf(entry.label));
      const tags=document.createElement('span');tags.className='library-note-nav-tags';
      if(entry.current)tags.appendChild(textEl('span','library-note-tag current','TODAY'));
      const edited=editedLabel(entry.updatedAt);if(edited)tags.appendChild(textEl('span','library-note-nav-edited',edited));
      const pathLabel=entry.support?'Shared support note':noteParentPath(entry.label);
      button.append(name,tags);if(pathLabel)button.append(textEl('span','library-note-nav-path',pathLabel));
      button.addEventListener('click',()=>selectNote(entry.key));
      return button;
    }
    function requestSelectedNoteReveal(){
      if(noteRevealFrame)return;
      noteRevealFrame=requestAnimationFrame(()=>{
        noteRevealFrame=0;
        const nav=document.querySelector('.library-notes-nav');
        const active=nav&&nav.querySelector('.library-note-nav-item.active');
        if(!nav||!active)return;
        const navRect=nav.getBoundingClientRect();
        const activeRect=active.getBoundingClientRect();
        const head=nav.querySelector('.library-notes-nav-head');
        const headBottom=head?Math.min(navRect.bottom,head.getBoundingClientRect().bottom):navRect.top;
        if(activeRect.top<headBottom)nav.scrollTop-=headBottom-activeRect.top;
        else if(activeRect.bottom>navRect.bottom)nav.scrollTop+=activeRect.bottom-navRect.bottom;
      });
    }
    function noteEditorRenderSignature(entry,canonical,readOnly,writable){
      if(!entry)return `empty|${readOnly?'1':'0'}`;
      return [
        entry.key,entry.label,entry.support?'1':'0',entry.current?'1':'0',entry.ephemeral?'1':'0',entry.hasNote?'1':'0',
        // A change to the text from elsewhere re-renders the note; a change to
        // its linked notes refreshes only the bar.
        readOnly?'1':'0',writable?'1':'0',String(canonical?.text||'')
      ].join('\u0000');
    }
    function renderNoteEditor(entry,readOnly=false){
      const panel=document.getElementById('library-notes-editor');
      if(!panel)return false;
      const canonical=entry?getNote(entry.key,entry.label):null,richValue=String(canonical?.text||''),value=richValue?plainTextContent(richValue):'';
      const writable=canMutate()&&!readOnly,signature=noteEditorRenderSignature(entry,canonical,readOnly,writable);
      updateNoteActions();
      // Parent notes can change while this one stays open: refresh only their
      // sections, never the editor.
      const parents=entry?parentNotesSignature(entry):'';
      if(signature===noteEditorSignature&&panel.childElementCount){
        // A sync that brings in changes unbinds every editor while it applies
        // them. The same note binds again here, so its editor stays mounted
        // with the cursor where it was; left unbound, the editor was put away
        // and its raw stored text stayed on screen, dead to clicks.
        const field=notesEditorField();if(entry&&!readOnly&&field&&!field.dataset.noteBinding)bindEditor(field,entry.key,entry.label,'library');
        if(entry&&parents!==noteParentSignature){noteParentSignature=parents;const box=panel.querySelector('.subject-note-context');if(box)renderInherited(box,entry.key,false,{collapsible:true});}
        panel.querySelector('.note-links')?.refresh?.();
        const meta=panel.querySelector('.library-notes-editor-meta');if(entry&&meta){meta.textContent=noteMeta(entry,canonical);syncReviewMark(meta,writable?canonical:null);}
        return !!entry;
      }
      const previous=notesEditorField();
      if(previous)clearEditor(previous);
      noteEditorSignature=signature;noteParentSignature=parents;
      if(!entry){
        panel.replaceChildren(textEl('div','library-notes-editor-empty ui-status','No notes match this search.'));
        return false;
      }
      const head=document.createElement('div');head.className='library-notes-editor-head';
      const renameable=writable&&noteState(entry).kind!=='support'&&noteState(entry).kind!=='none',meta=textEl('span','library-notes-editor-meta ui-mono',noteMeta(entry,canonical));
      const copy=document.createElement('div');copy.className='library-notes-editor-identity';
      copy.append(noteBreadcrumb(entry),noteTitle(entry,renameable),meta);syncReviewMark(meta,writable?canonical:null);
      const headTools=document.createElement('div');headTools.className='library-notes-editor-tools';
      if(!readOnly){
        const syncMessage=writable?'Synced':'Read-only in this tab';
        const sync=textEl('div',`note-sync ui-label${writable?'':' idle'}`,writable?'✓':'—');
        sync.dataset.areaKey=entry.key;sync.setAttribute('role','status');sync.setAttribute('aria-atomic','true');sync.setAttribute('aria-label',syncMessage);sync.tabIndex=0;headTools.append(sync);
        if(writable)headTools.append(...noteActionsMenu(entry));
      }
      head.append(noteViewBackButton(),copy,headTools);
      const inherited=document.createElement('div');renderInherited(inherited,entry.key,false,{collapsible:true});
      if(readOnly){
        const preview=document.createElement('div');preview.className='library-note-read';
        if(!richValue.trim()){preview.classList.add('empty');preview.textContent='No content saved for this Area.';}else renderRichTextContent(preview,richValue,'No content saved for this Area.',`Note for ${entry.label}`);
        panel.replaceChildren(head,preview,inherited);return true;
      }
      const editorShell=document.createElement('div');editorShell.className='library-notes-editor-shell';
      const editor=document.createElement('textarea');
      editor.className='library-notes-textarea ui-field task-note-field';
      editor.placeholder=entry.support?'Shared by every support block. Type # for a tag, [[ to link a note.':'Start writing. Type # for a tag, [[ to link a note.';
      editor.value=value;editorShell.appendChild(editor);
      bindEditor(editor,entry.key,entry.label,'library');
      const matches=document.createElement('div');matches.className='library-note-matches';matches.id='library-note-matches';matches.hidden=true;matches.setAttribute('role','status');
      const matchTool=(text,label,run)=>{const button=textEl('button','library-note-tool ui-btn',text);button.type='button';button.setAttribute('aria-label',label);button.title=label;button.addEventListener('click',run);return button;};
      matches.append(textEl('span','library-note-matches-count ui-mono',''),matchTool('↑','Previous match',()=>stepNoteMatch(-1)),matchTool('↓','Next match',()=>stepNoteMatch(1)),matchTool('×','Clear highlights',clearNoteMatches));
      // Under the text: the notes linked to this one, then adding a tag and
      // Earlier versions. One line on a computer; on a phone the two buttons
      // take their own full-width line.
      const foot=document.createElement('div');foot.className='note-foot';
      const links=linksBar({ref:canonical?.id||entry.key,label:entry.label,onOpen:revealNoteReference});
      const actions=document.createElement('div');actions.className='note-foot-actions';
      if(writable){
        const footButton=(text,label,run)=>{const button=textEl('button','note-foot-button ui-btn',text);button.type='button';button.title=label;button.setAttribute('aria-label',label);button.addEventListener('click',run);return button;};
        actions.append(footButton('# Tag','Add a tag to this note',()=>{void addTagToNote(editor);}));
        if(!entry.support&&canonical)actions.append(footButton('Earlier versions','Earlier versions of this note, from your backups',()=>{void showNoteVersions(entry);}));
      }
      foot.append(links);if(actions.childElementCount)foot.append(actions);
      panel.replaceChildren(head,matches,editorShell,foot,inherited);noteSearchLanded='';
      setNotesStatus(writable?'':'Another tab has control. Browse freely, or take control before editing.',{readOnly:!writable});
      editor.addEventListener('input',event=>{
        const accepted=commitEditor(editor,editor.value,event);
        if(!accepted)return;
        const refreshed=getNote(entry.key,entry.label);
        const hasNote=!!String(editor.value||'').trim();
        noteEditorSignature=noteEditorRenderSignature({...entry,hasNote},refreshed,false,canMutate());
        // The entry was drawn with the note: a new note's says it is empty.
        meta.textContent=noteMeta({...entry,ephemeral:false,hasNote},refreshed);
        const row=[...document.querySelectorAll('[data-note-key]')].find(candidate=>candidate.dataset.noteKey===entry.key);
        if(row){
          row.classList.toggle('has-note',hasNote);
          row.classList.toggle('empty-note',!hasNote);
          const tag=row.querySelector('.library-note-tag.note');if(tag)tag.hidden=!hasNote;
        }
        updateNoteActions();
        scheduleNoteLiveRefresh(entry,links);
      });
      return true;
    }
    // 5.2: a quiet "Needs review" mark after the meta line while a sync has
    // kept another version of this note; it opens that review.
    function syncReviewMark(meta,canonical){
      const id=String(canonical?.id||''),wanted=!!id&&keptVersion(id);let mark=meta.nextElementSibling?.classList.contains('library-note-review')?meta.nextElementSibling:null;
      if(!wanted){mark?.remove();return;}
      if(mark)return;
      mark=textEl('button','library-note-tag library-note-review ui-btn','Needs review');mark.type='button';mark.title='Another device changed this note too. Review the kept version.';
      mark.addEventListener('click',()=>reviewKept(id));meta.after(mark);
    }
    // A deleted note opens read-only, with Restore and Delete forever.
    function renderTrashedNote(item){
      const panel=document.getElementById('library-notes-editor');if(!panel)return false;
      const stored=getNote(item.key,item.label),text=String(stored&&stored.text||''),signature=`trash\u0000${item.key}\u0000${String(stored&&stored.updatedAt||'')}\u0000${canMutate()?'1':'0'}`;
      updateNoteActions();
      if(signature===noteEditorSignature&&panel.childElementCount)return true;
      const previous=notesEditorField();if(previous)clearEditor(previous);
      noteEditorSignature=signature;
      const head=document.createElement('div');head.className='library-notes-editor-head';
      const copy=document.createElement('div');copy.className='library-notes-editor-identity';
      copy.append(textEl('div','library-notes-editor-title',noteLeaf(item.label)),textEl('span','library-notes-editor-meta ui-mono',`${deletedLabel(item.deletedAt)} · ${item.label.replace(/\s*>\s*/g,' › ')}`));
      const tools=document.createElement('div');tools.className='library-notes-editor-tools';
      const restore=textEl('button','library-note-action ui-btn','Restore'),forget=textEl('button','library-note-action danger ui-btn','Delete forever');
      restore.type='button';forget.type='button';restore.disabled=forget.disabled=!canMutate();
      restore.addEventListener('click',()=>{void restoreTrashedNote(item.key);});forget.addEventListener('click',()=>{void deleteTrashedNoteForever(item.key);});
      tools.append(restore,forget);head.append(noteViewBackButton(),copy,tools);
      const preview=document.createElement('div');preview.className='library-note-read';
      if(!text.trim()){preview.classList.add('empty');preview.textContent='This note was empty.';}else renderRichTextContent(preview,text,'This note was empty.',`Deleted note ${item.label}`);
      panel.replaceChildren(head,preview);
      setNotesStatus(`Deleted notes are kept for 30 days.`);
      return true;
    }
    function renderNotes(){
      if(host.held())return false;
      if(!notesShown())return false;
      const entries=noteEntries();
      noteSearch.keep();
      const query=notesSearch(),tagQuery=tagSearch(query),searchState=tagQuery===null?noteSearch.filter(entries,query):{entries:tagQuery?entries.filter(entry=>notesTaggedLike(tagQuery).has(entry.key)):entries,pending:false},tagKeys=noteTagFilter.length?taggedNotes(noteTagFilter):null;
      const filtered=tagKeys?searchState.entries.filter(entry=>tagKeys.has(entry.key)):searchState.entries,filtering=!!query||!!tagKeys;
      updateNoteSelectionControls(entries);renderNoteTags();
      const trashed=selectedTrashKey&&!noteSelectionMode?noteTrashItems().find(item=>item.key===selectedTrashKey)||null:null;
      if(!trashed)selectedTrashKey='';
      const selected=chooseNote(entries,filtered),selectionIndex=noteSelectionMode?noteSelectionIndex(entries):null;
      const list=document.getElementById('library-notes-list');
      if(list){
        // Search shows matches with their paths; otherwise the tree.
        const tree=!filtering&&noteSort==='name',flat=noteSort==='recent'?[...filtered].sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||''))):filtered;
        const nodes=tree?noteTree(entries):flat.map(entry=>({entry})),activeIndex=nodes.findIndex(node=>node.entry.key===selectedNoteKey);
        if(activeIndex>=noteVisibleLimit)noteVisibleLimit=Math.ceil((activeIndex+1)/NOTE_PAGE_SIZE)*NOTE_PAGE_SIZE;
        const shown=nodes.slice(0,noteVisibleLimit),rows=shown.map(node=>noteSelectionMode||!tree?buildNoteNavItem(node.entry,selectionIndex):buildNoteTreeItem(node));
        if(nodes.length>shown.length){
          const more=textEl('button','library-notes-more ui-btn',`Show ${Math.min(nodes.length-shown.length,NOTE_PAGE_SIZE)} more`);more.type='button';
          more.addEventListener('click',()=>{noteVisibleLimit+=NOTE_PAGE_SIZE;renderNotes();});rows.push(more);
        }
        if(tree&&!noteSelectionMode){list.setAttribute('role','tree');list.setAttribute('aria-label','Notes');}else{list.removeAttribute('role');list.removeAttribute('aria-label');}
        if(filtered.length)list.replaceChildren(...rows);
        else list.replaceChildren(textEl('div','library-notes-zero ui-status',query?'No notes match this search.':'No notes have all of these tags.'));
        const focusable=list.querySelector('[role="treeitem"].active')||list.querySelector('[role="treeitem"]');if(focusable)focusable.tabIndex=0;
        if(noteFocusKey){const target=[...list.querySelectorAll('[role="treeitem"]')].find(row=>row.dataset.noteKey===noteFocusKey);noteFocusKey='';if(target){for(const row of list.querySelectorAll('[role="treeitem"]'))row.tabIndex=-1;target.tabIndex=0;target.focus();}}
      }
      // The count is of notes that exist: not plan Areas or parents without a
      // note of their own, nor new notes not yet written.
      const real=list=>list.reduce((count,entry)=>count+(entry.id?1:0),0),total=real(entries);
      setTextSafe('library-notes-nav-count',filtering?(searchState.pending?`Searching… / ${total}`:`${real(filtered)} / ${total}`):String(total));
      renderNoteTrash();
      if(noteSelectionMode){renderNoteEditor(selected,true);setNotesStatus('Selection is temporary. Export does not change or sync your saved notes.');}
      else if(trashed)renderTrashedNote(trashed);
      else renderNoteEditor(selected);
      requestSelectedNoteReveal();landOnNoteSearch();return true;
    }
    // Opening a note while searching marks every match in it and scrolls to the
    // first. Arrows or Enter step through them; an edit or Escape clears them.
    function landOnNoteSearch(){
      const query=notesSearch(),field=notesEditorField(),target=query&&field&&!selectedTrashKey?`${selectedNoteKey}\u0000${query}`:'';
      if(target===noteSearchLanded)return;noteSearchLanded=target;
      if(!target){if(field)clearFind(field);showNoteMatches(0);return;}
      void findInEditor(field,query,()=>{if(noteSearchLanded===target)showNoteMatches(0);}).then(count=>{if(noteSearchLanded===target)showNoteMatches(count,0);}).catch(()=>{});
    }
    function showNoteMatches(count,index=0){
      const bar=document.getElementById('library-note-matches');if(!bar)return;
      bar.hidden=!count;if(count)bar.querySelector('.library-note-matches-count').textContent=`${index+1} of ${count}`;
    }
    function stepNoteMatch(direction){const field=notesEditorField();if(!field)return false;const {index,count}=findStep(field,direction);showNoteMatches(count,index);return count>0;}
    function clearNoteMatches(){const field=notesEditorField();if(field)clearFind(field);showNoteMatches(0);}
    function requestNotesRender(){
      if(host.held())return false;
      if(noteRenderFrame)return false;
      noteRenderFrame=requestAnimationFrame(()=>{noteRenderFrame=0;renderNotes();});return true;
    }
    function selectNote(key){
      const match=noteEntries().find(entry=>entry.key===String(key||''));
      if(!match)return false;
      selectedNoteKey=match.key;selectedTrashKey='';
      // Opening a note opens its branch too, so its nested notes show.
      if(noteTreeNodes.get(match.key)?.children)noteExpanded.set(match.key,true);
      renderNotes();openNoteView();
      return true;
    }
    // Attachments name the note they sit in by its permanent id.
    function revealNoteReference(key){
      const target=String(key||''),match=noteEntries().find(entry=>entry.id===target||entry.key===target);
      if(!match)return false;
      const search=document.getElementById('library-notes-search');
      if(search&&search.value)search.value='';
      noteSearch.reset();
      if(noteTagFilter.length&&!taggedNotes(noteTagFilter).has(match.key))noteTagFilter=[];
      if(noteSelectionMode&&!noteExportBusy){noteSelectionMode=false;noteSelection.clear();}
      host.showSection('notes');
      selectedNoteKey=match.key;selectedTrashKey='';
      noteTree(noteEntries());expandNoteAncestors(match.key);
      renderNotes();openNoteView();
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        const row=[...document.querySelectorAll('[data-note-key]')].find(candidate=>candidate.dataset.noteKey===match.key);
        if(row)row.scrollIntoView({block:'nearest'});
        const editor=document.getElementById('library-notes-editor');if(editor)editor.scrollIntoView({block:'nearest'});
      }));
      return true;
    }
    // The tag list: picked tags first, then the most used, with a count each;
    // More shows the rest. Picks narrow the list to notes with all of them;
    // Clear shows every note again.
    // A search that starts with # looks up tags, not text: "#rev" lists the
    // notes with a tag starting "rev". Returns the tag typed ('' for a bare #),
    // or null for an ordinary search.
    function tagSearch(query){if(!query.startsWith('#'))return null;return normalizeTag(query.slice(1))||'';}
    function notesTaggedLike(prefix){const keys=new Set();for(const item of noteTags())if(item.tag.startsWith(prefix))for(const key of taggedNotes([item.tag]))keys.add(key);return keys;}
    // The tag row is one line that scrolls sideways: Clear and Rename while
    // tags are picked, the picked tags, then the rest by use. Typing in the
    // search narrows it: "#ma" to tags starting "ma", plain text to tags
    // containing it.
    function renderNoteTags(){
      const row=document.getElementById('library-notes-tags');if(!row)return;
      const all=noteTags(),writable=canMutate(),typed=notesSearch(),byTag=typed.startsWith('#'),query=typed.replace(/^#/,''),signature=`${noteTagFilter.join('\u0000')}\u0001${writable?'1':'0'}\u0001${typed}`;
      if(all===noteTagsRendered&&signature===noteTagsSignature)return;
      const filterChanged=!noteTagsSignature.startsWith(`${noteTagFilter.join('\u0000')}\u0001`);
      noteTagsRendered=all;noteTagsSignature=signature;
      const counts=new Map(all.map(item=>[item.tag,item.count])),picked=new Set(noteTagFilter),chips=[];
      const tool=(text,label,run)=>{const button=textEl('button','library-tag-tool ui-btn',text);button.type='button';button.setAttribute('aria-label',label);button.title=label;button.addEventListener('click',run);return button;};
      if(picked.size)chips.push(tool('× Clear','Show all notes',clearNoteTags));
      if(picked.size===1&&writable)chips.push(tool('Rename',`Rename #${noteTagFilter[0]} in every note`,()=>{void renameSelectedTag();}));
      const others=[...all].filter(item=>!picked.has(item.tag)&&(!query||(byTag?item.tag.startsWith(query):item.tag.includes(query)))).sort((a,b)=>b.count-a.count||a.tag.localeCompare(b.tag)).map(item=>item.tag);
      for(const tag of [...noteTagFilter,...others]){
        const on=picked.has(tag),chip=textEl('button',`library-tag-chip ui-btn${on?' active':''}`,'');chip.type='button';chip.setAttribute('aria-pressed',on?'true':'false');
        chip.append(textEl('span','library-tag-name',`#${tag}`),textEl('span','library-tag-count ui-mono',String(counts.get(tag)||0)));
        chip.addEventListener('click',()=>toggleNoteTag(tag));chips.push(chip);
      }
      // Before the first tag, one quiet line says how tags are made.
      if(!all.length&&!picked.size)chips.push(textEl('span','library-tags-hint','Tags: type #name in any note'));
      row.replaceChildren(...chips);row.hidden=!chips.length||(!!query&&!all.length);
      // Picking or clearing a tag brings the start of the row into view.
      if(filterChanged)row.scrollLeft=0;
      updateTagRowEdges(row);
    }
    // Soft edges show there is more of the row to either side.
    function updateTagRowEdges(row){
      const more=row.scrollWidth-row.clientWidth>1;
      row.classList.toggle('more-before',more&&row.scrollLeft>1);
      row.classList.toggle('more-after',more&&row.scrollLeft<row.scrollWidth-row.clientWidth-1);
    }
    function installTagRow(){
      const row=document.getElementById('library-notes-tags');if(!row||row.dataset.scrollReady)return;row.dataset.scrollReady='1';
      row.addEventListener('scroll',()=>updateTagRowEdges(row),{passive:true});
      // A mouse wheel scrolls the row sideways; a trackpad or finger already does.
      row.addEventListener('wheel',event=>{if(Math.abs(event.deltaY)<=Math.abs(event.deltaX)||row.scrollWidth<=row.clientWidth)return;event.preventDefault();row.scrollLeft+=event.deltaY;},{passive:false});
      if(typeof ResizeObserver==='function')new ResizeObserver(()=>updateTagRowEdges(row)).observe(row);
    }
    function setNoteTagFilter(tags){noteTagFilter=tags;noteVisibleLimit=NOTE_PAGE_SIZE;renderNotes();}
    function toggleNoteTag(tag){setNoteTagFilter(noteTagFilter.includes(tag)?noteTagFilter.filter(other=>other!==tag):[...noteTagFilter,tag]);}
    function clearNoteTags(){setNoteTagFilter([]);}
    // A tag tapped in a note's text shows the notes with it. From the open
    // note the list changes behind it; from elsewhere the list is shown.
    function filterTag(tag,{show=false}={}){
      const name=normalizeTag(tag);if(!name)return false;
      const search=document.getElementById('library-notes-search');if(search&&search.value){search.value='';noteSearch.reset();}
      host.showSection('notes');setNoteTagFilter([name]);if(show)closeNoteView();return true;
    }
    async function renameSelectedTag(){
      const from=noteTagFilter[0];if(noteTagFilter.length!==1||!canMutate())return false;
      const result=await requestInput({
        title:`Rename #${from}`,message:'Every note with this tag gets the new name. A name already in use merges the two tags.',
        inputLabel:'New name',defaultValue:from,maxLength:80,required:true,requiredMessage:'Enter a tag name.',
        validate:value=>normalizeTag(value)?'':'A tag starts with a letter and uses letters, digits, - or _.',
        confirmLabel:'Rename',cancelLabel:'Cancel'
      });
      const to=result?normalizeTag(result.value):'';if(!to||to===from)return false;
      const notice=notifications.begin({id:'note-tag-rename',surfaceId:'notes-status',title:'Rename tag',message:`Renaming #${from}…`});
      let outcome;try{outcome=await renameNoteTag(from,to);}catch(error){notice.finish('failed',error?.message||'The tag could not be renamed.');return false;}
      setNoteTagFilter([to]);
      const changed=`${outcome.changed} ${outcome.changed===1?'note':'notes'}`,failed=outcome.failed||[];
      notice.finish(failed.length?'failed':'succeeded',failed.length?`Renamed #${from} to #${to} in ${changed}. Not changed, as they changed meanwhile: ${failed.join(', ')}.`:`Renamed #${from} to #${to} in ${changed}.`);
      return true;
    }
    // Text and Markdown files become new notes named after them, at the top
    // level or inside the open note.
    async function importNotes(files){
      const list=[...(files||[])];if(!list.length||!canMutate())return false;
      const open=noteEntries().find(entry=>entry.key===selectedNoteKey&&!entry.ephemeral)||null;
      let parent='';
      if(open){
        const where=await choose({title:list.length===1?'Import 1 file':`Import ${list.length} files`,message:'Each file becomes a new note named after it.',cancelLabel:'Cancel',choices:[
          {value:'inside',label:`Inside ${noteLeaf(open.label)}`,kind:'primary',description:`Under ${open.label.replace(/\s*>\s*/g,' › ')}.`},
          {value:'top',label:'At the top level',description:'As notes of their own.'}
        ]});
        if(!where)return false;parent=where==='inside'?open.label:'';
      }
      const notice=notifications.begin({id:'note-import',surfaceId:'notes-status',title:'Import notes',message:`Importing ${list.length===1?'1 file':`${list.length} files`}…`});
      let result;try{result=await importNoteFiles(list,parent);}catch(error){notice.finish('failed',error?.message||'The files could not be imported.');return false;}
      const made=result.made||[],skipped=result.skipped||[];
      if(made.length)revealNoteReference(made[0].id);
      const parts=[];if(made.length)parts.push(`Imported ${made.length} ${made.length===1?'note':'notes'}.`);if(skipped.length)parts.push(`Not imported: ${skipped.join('; ')}.`);
      notice.finish(made.length&&!skipped.length?'succeeded':'failed',parts.join(' ')||'Nothing was imported.');
      return made.length>0;
    }
    // Where a note can go, for New and Move: Top level, then every note in the
    // list's order (except anything excluded), searched by every word typed.
    // Returns its element and the chosen place's title key and label ('' for
    // Top level).
    function notePlacePicker({exclude=()=>false,selected='',onChange=()=>{},label='Place'}={}){
      const places=[{key:'',label:'',top:true},...noteEntries().filter(entry=>!exclude(entry))];
      let chosen=places.find(place=>place.key===selected)||places[0];
      const root=document.createElement('div');root.className='note-place';
      const search=document.createElement('input');search.type='search';search.className='note-place-search ui-field';search.placeholder='Find a place…';search.setAttribute('aria-label',`Search: ${label}`);search.autocomplete='off';
      const list=document.createElement('div');list.className='note-place-list';list.setAttribute('role','listbox');list.setAttribute('aria-label',label);list.tabIndex=-1;
      const option=place=>{
        const row=document.createElement('button');row.type='button';row.className='note-place-option';row.setAttribute('role','option');row.dataset.key=place.key;
        const depth=place.top?0:Math.min(6,Math.max(0,Number(place.depth)||0));row.style.setProperty('--note-indent',`${depth*14}px`);
        row.append(textEl('span','note-place-name',place.top?'Top level':noteLeaf(place.label)));
        const path=place.top?'Not inside another note':noteParentPath(place.label).replace(/\s*>\s*/g,' › ');if(path&&(search.value.trim()||place.top))row.append(textEl('span','note-place-path',path));
        const selectedNow=place===chosen;row.setAttribute('aria-selected',selectedNow?'true':'false');row.classList.toggle('selected',selectedNow);row.tabIndex=selectedNow?0:-1;
        row.addEventListener('click',()=>pick(place,true));
        return row;
      };
      const matches=()=>{const words=search.value.toLowerCase().split(/\s+/).filter(Boolean);return words.length?places.filter(place=>!place.top&&words.every(word=>place.label.toLowerCase().includes(word))):places;};
      const draw=()=>{const shown=matches().slice(0,200);list.replaceChildren(...(shown.length?shown.map(option):[textEl('div','note-place-empty ui-status','No note matches.')]));};
      const pick=(place,focus=false)=>{chosen=place;draw();onChange(chosen);if(focus)list.querySelector('.note-place-option.selected')?.focus();};
      search.addEventListener('input',()=>{const first=matches()[0];if(first&&!matches().includes(chosen))pick(first);else draw();});
      search.addEventListener('keydown',event=>{if(event.key==='ArrowDown'){event.preventDefault();(list.querySelector('.note-place-option.selected')||list.querySelector('.note-place-option'))?.focus();}else if(event.key==='Enter'){event.preventDefault();const first=matches()[0];if(first)pick(first,true);}});
      list.addEventListener('keydown',event=>{
        const rows=[...list.querySelectorAll('.note-place-option')],index=rows.indexOf(document.activeElement);if(index<0)return;
        const move=step=>{const next=rows[Math.max(0,Math.min(rows.length-1,index+step))];if(next)next.click();};
        if(event.key==='ArrowDown')move(1);else if(event.key==='ArrowUp'){if(index===0)search.focus();else move(-1);}else if(event.key==='Home')move(-rows.length);else if(event.key==='End')move(rows.length);else return;
        event.preventDefault();
      });
      root.append(search,list);draw();
      requestAnimationFrame(()=>list.querySelector('.note-place-option.selected')?.scrollIntoView({block:'nearest'}));
      return {element:root,chosen:()=>chosen,focus:()=>search.focus()};
    }
    // "GS2 › Polity", or "the top level".
    function placeName(place){return place&&place.key?place.label.replace(/\s*>\s*/g,' › '):'the top level';}
    function joinPath(place,name){return place&&place.key?`${place.label} > ${name}`:name;}
    async function createNote(){
      if(!canMutate())return false;
      if(!canCreateNote()){
        setNotesStatus('Notes are at their note limit. Delete a note to make room.',{error:true});
        return false;
      }
      const selected=noteEntries().find(entry=>entry.key===selectedNoteKey)||null;
      // The name first; the place starts as the open note and Change picks
      // another from the same list Move uses.
      let place=selected?{key:selected.key,label:selected.label}:{key:'',label:''},picker=null;
      const target=name=>normalizeNoteArea(joinPath(place,String(name||'').trim()));
      const existingFor=name=>{const identity=target(name);return identity?noteEntries().find(entry=>entry.key===identity.key)||null:null;};
      const result=await requestInput({
        title:'New note',
        inputLabel:'Name',placeholder:'For example: Cardiology',maxLength:160,required:true,requiredMessage:'Give the note a name.',
        content:api=>{
          const row=document.createElement('div');row.className='note-place-row';
          const where=textEl('span','note-place-where','');
          const change=textEl('button','note-place-change ui-btn','Change');change.type='button';change.setAttribute('aria-expanded','false');
          const sync=()=>{where.replaceChildren(textEl('span','note-place-label','In'),' ',textEl('strong','',place.key?placeName(place):'Top level'));};
          sync();row.append(where,change);
          const wrap=document.createElement('div');wrap.className='note-place-new';wrap.append(row);
          change.addEventListener('click',()=>{
            if(picker){picker.element.remove();picker=null;change.textContent='Change';change.setAttribute('aria-expanded','false');return;}
            picker=notePlacePicker({label:'Location',selected:place.key,onChange:chosen=>{place=chosen.top?{key:'',label:''}:{key:chosen.key,label:chosen.label};sync();api.refresh();api.setConfirmLabel(existingFor(api.input?.value)?'Open':'Create');}});
            wrap.append(picker.element);change.textContent='Done';change.setAttribute('aria-expanded','true');picker.focus();
          });
          api.input?.addEventListener('input',()=>api.setConfirmLabel(existingFor(api.input.value)?'Open':'Create'));
          return wrap;
        },
        preview:value=>{
          const name=String(value||'').trim();if(!name)return place.key?`Goes inside ${placeName(place)}.`:'Goes at the top level.';
          const identity=target(name);if(!identity)return 'Use > only to separate nested notes.';if(identity.reserved)return '“Support Activities” is the shared note for support blocks. Choose another name.';
          return existingFor(name)?`“${identity.label.replace(/\s*>\s*/g,' › ')}” already exists. It will open.`:`Creates ${identity.label.replace(/\s*>\s*/g,' › ')}.`;
        },
        validate:value=>{const identity=target(value);return !identity?'Enter a name. Use > only to separate nested notes.':identity.reserved?'“Support Activities” is the shared note for support blocks. Choose another name.':'';},
        confirmLabel:'Create',cancelLabel:'Cancel'
      });
      if(!result||!canMutate())return false;
      const raw=joinPath(place,result.value);
      const identity=normalizeNoteArea(raw);
      if(!identity){
        setNotesStatus('Enter a valid Area name. Use > only to separate nested Areas.',{error:true});
        return false;
      }
      const existing=noteCatalogue().find(entry=>entry.key===identity.key);
      if(!existing)pendingNotes=[...pendingNotes.filter(entry=>entry.key!==identity.key),Object.freeze({
        key:identity.key,label:identity.label,text:'',hasNote:false,current:false,updatedAt:'',ephemeral:true
      })];
      selectedNoteKey=identity.key;selectedTrashKey='';
      invalidateAttachments();
      const search=document.getElementById('library-notes-search');
      if(search&&search.value)search.value='';
      noteTree(noteEntries());expandNoteAncestors(identity.key);
      renderNotes();openNoteView();
      const editor=notesEditorField();
      if(editor)requestAnimationFrame(()=>requestAnimationFrame(()=>{if(document.contains(editor))focusEditor(editor);}));
      const notice=notifications.begin({id:'note-create',surfaceId:'notes-status',title:existing?'Existing note opened':'New note ready',announce:false});
      notice.finish('succeeded',existing?`Opened “${identity.label}”, which already exists.`:`New note “${identity.label}”. It is saved once you write in it.`);
      return true;
    }
    // What a row is, for its label and what can be done with it: a written
    // (stored) note, a new one not yet written, an Area of today's plan with
    // no note, or a parent that holds notes but has none of its own.
    function noteState(entry,entries=noteEntries()){
      const stored=!!(entry&&!entry.ephemeral&&getNote(entry.key,entry.label)),prefix=`${entry?.key} > `,depth=Math.max(0,Number(entry?.depth)||0);
      const children=entry?entries.filter(other=>other.key.startsWith(prefix)&&Math.max(0,Number(other.depth)||0)===depth+1).length:0;
      const kind=!entry?'none':entry.support?'support':stored?'stored':entry.ephemeral?'new':children?'parent':entry.current?'plan':'none';
      return {kind,stored,children,cleared:stored&&!entry.hasNote};
    }
    function notesHeld(count){return `Holds ${count} ${count===1?'note':'notes'}`;}
    function selectedNoteEntry(){
      const entry=noteEntries().find(candidate=>candidate.key===selectedNoteKey)||null;
      return entry&&!selectedTrashKey&&!entry.support?entry:null;
    }
    function selectedStoredNote(){
      const entry=noteEntries().find(candidate=>candidate.key===selectedNoteKey)||null;
      return entry&&!selectedTrashKey&&!entry.support&&getNote(entry.key,entry.label)?entry:null;
    }
    // Deleting moves a note to Recently deleted at once; Undo puts it back.
    async function deleteNote(){
      if(!canMutate())return false;
      const entry=selectedNoteEntry();
      if(!entry)return false;
      // A new note was never stored: Delete discards it.
      if(entry.ephemeral){
        pendingNotes=pendingNotes.filter(item=>item.key!==entry.key);invalidateAttachments();
        selectedNoteKey='';renderNotes();closeNoteView();
        notifications.begin({id:'note-delete',surfaceId:'notes-status',title:'Delete note',announce:false}).finish('succeeded',`Discarded the new note “${entry.label}”.`);
        return true;
      }
      if(!selectedStoredNote()){setNotesStatus(noteState(entry).kind==='parent'?'This note has nothing of its own. Delete or move the notes inside it.':'This note is not written yet, so there is nothing to delete.');return false;}
      const notice=notifications.begin({id:'note-delete',surfaceId:'notes-status',title:'Delete note',message:'Moving the note to Recently deleted…'});
      let trashKey;
      try{trashKey=await trashNote(entry.key);}
      catch(error){notice.finish('failed',error&&error.message||'The note could not be deleted because browser storage could not be updated. Keep this tab open and retry.');return false;}
      if(trashKey===null){notice.finish('cancelled','No note was deleted.');return false;}
      renderNotes();closeNoteView();
      if(!trashKey){notice.finish('succeeded',`Removed the empty note “${entry.label}”.`);return true;}
      notice.finish('succeeded',`Moved “${entry.label}” to Recently deleted.`,{action:{label:'Undo',run:()=>{void restoreTrashedNote(trashKey);}}});
      return true;
    }
    async function restoreTrashedNote(trashKey){
      if(!canMutate())return false;
      const item=noteTrashItems().find(candidate=>candidate.key===trashKey);if(!item)return false;
      const notice=notifications.begin({id:'note-restore',surfaceId:'notes-status',title:'Restore note',message:'Restoring the note…'});
      let key;
      try{key=await restoreNote(trashKey);}
      catch(error){notice.finish('failed',error&&error.message||'The note could not be restored. Keep this tab open and retry.');return false;}
      if(!key){notice.finish('failed',`“${item.label}” could not be restored: every “(restored)” name is taken.`);return false;}
      selectedTrashKey='';selectedNoteKey=key;
      noteTree(noteEntries());expandNoteAncestors(key);renderNotes();
      const restored=noteEntries().find(entry=>entry.key===key);
      notice.finish('succeeded',restored&&restored.label!==item.label?`Restored “${item.label}” as “${restored.label}”, beside the note that now uses its name.`:`Restored “${item.label}”.`);
      return true;
    }
    async function deleteTrashedNoteForever(trashKey){
      if(!canMutate())return false;
      const item=noteTrashItems().find(candidate=>candidate.key===trashKey);if(!item)return false;
      const accepted=await confirm({title:'Delete this note forever?',danger:true,message:`“${item.label}” will be removed for good. This cannot be undone.`,details:['Existing backups are unchanged.'],confirmLabel:'Delete forever',cancelLabel:'Keep it'});
      if(!accepted||!canMutate())return false;
      const notice=notifications.begin({id:'note-forget',surfaceId:'notes-status',title:'Delete forever',message:'Deleting the note…'});
      try{if(!await removeNote(trashKey)){notice.finish('cancelled','No note was deleted.');return false;}}
      catch(error){notice.finish('failed',error&&error.message||'The note could not be deleted. Keep this tab open and retry.');return false;}
      selectedTrashKey='';renderNotes();closeNoteView();
      notice.finish('succeeded',`Deleted “${item.label}” forever.`);
      return true;
    }
    // Renames or moves a note with every note inside it. A name that already
    // holds a note is merged only after the person agrees.
    // Move… asks for the full name: "GS2 > Polity" places the note under GS2.
    // Move: pick a place from the list; the name starts as it is (changing it
    // here also offers to leave the plans alone, which the title cannot) and
    // the notes inside go along. A name already used there with text is shown
    // before anything happens, and the button then reads Merge.
    async function renameNoteEntry(){
      if(!canMutate())return false;
      const entry=selectedNoteEntry();if(!entry)return false;
      const state=noteState(entry),leaf=noteLeaf(entry.label),prefix=`${entry.key} > `,entries=noteEntries();
      const family=entries.filter(item=>item.key.startsWith(prefix)),nested=family.length,where=planAreaPlaces(planAreaUse(entry.key));
      const parentKey=entry.key.split(' > ').slice(0,-1).join(' > ');
      let place=null,name=leaf;
      const destination=()=>place&&name.trim()?normalizeNoteArea(joinPath(place.top?null:place,name.trim())):null;
      // Notes with text already at the names this one and its family would take.
      const clashes=()=>{
        const target=destination();if(!target||target.key===entry.key)return [];
        return [entry,...family].map(item=>entries.find(other=>other.key===target.key+item.key.slice(entry.key.length))).filter(other=>other&&other.id&&other.hasNote&&!other.key.startsWith(prefix)&&other.key!==entry.key);
      };
      // Inside Support Activities the plans keep their Area (no work block's
      // Area goes there), so the tick box to rename it in them is hidden.
      const result=await requestInput({
        title:`Move or rename “${leaf}”`,inputLabel:'Name',defaultValue:leaf,maxLength:160,
        content:api=>{
          const label=()=>clashes().length?'Merge':place&&!place.top===!!parentKey&&(place.key||'')===parentKey?'Rename':'Move';
          const wrap=document.createElement('div');wrap.className='note-place-new';
          const planBox=()=>{const checks=wrap.parentElement?.querySelector('.interaction-checks');if(checks)checks.hidden=!!destination()?.reservedArea;};
          const picker=notePlacePicker({label:'Move to',selected:parentKey,exclude:item=>item.key===entry.key||item.key.startsWith(prefix),onChange:chosen=>{place=chosen;api.refresh();api.setConfirmLabel(label());planBox();}});
          place=picker.chosen();api.input?.addEventListener('input',()=>{name=api.input.value;api.setConfirmLabel(label());planBox();});
          requestAnimationFrame(()=>{planBox();picker.focus();});
          wrap.append(textEl('div','interaction-field ui-body','Place'),picker.element);return wrap;
        },
        preview:()=>{
          const target=destination();if(!target)return name.trim()?'Choose a place.':'Give it a name.';
          if(target.reserved)return '“Support Activities” is the shared note for support blocks. Choose another name.';
          if(target.reservedArea&&state.kind==='plan')return AREA_INSIDE_SUPPORT;
          if(target.key===entry.key&&target.label===entry.label)return 'It is already here.';
          const found=clashes(),path=target.label.replace(/\s*>\s*/g,' › '),carried=nested?`, with ${nested} nested ${nested===1?'note':'notes'}`:'';
          if(found.length)return `“${found[0].label.replace(/\s*>\s*/g,' › ')}” already exists${found.length>1?`, with ${found.length-1} more of the same names inside`:''}. Moving adds this text to the end of it.`;
          return `Becomes ${path}${carried}.${target.reservedArea&&where?` ${capitalized(where)} ${plural(where)?'keep':'keeps'} the Area “${entry.label}”: a work block’s Area can’t be inside Support Activities.`:''}`;
        },
        validate:()=>{const target=destination();return !name.trim()?'Give it a name.':!target?'Use > only to separate nested notes.':target.reserved?'“Support Activities” is the shared note for support blocks. Choose another name.':target.reservedArea&&state.kind==='plan'?AREA_INSIDE_SUPPORT:target.key===entry.key&&target.label===entry.label?'Nothing to change. Choose another place or name.':'';},
        checkbox:where&&state.kind!=='plan'&&!entry.ephemeral?{label:`Also rename it in ${where}`,description:'Unticked, those blocks keep the old name and start a new note under it.',defaultChecked:true}:null,
        confirmLabel:'Move',cancelLabel:'Cancel'
      });
      if(!result||!canMutate()||!place)return false;
      return applyNoteRename(entry,joinPath(place.top?null:place,name.trim()),{inPlans:!where||state.kind==='plan'||result.checked===true,mergeAgreed:clashes().length>0});
    }
    const AREA_INSIDE_SUPPORT='This is an Area of today’s plan, and a work block’s Area can’t be inside Support Activities. Choose another place.';
    const capitalized=text=>text.charAt(0).toUpperCase()+text.slice(1),plural=where=>where.includes(' and ')||/^\d/.test(where);
    // Where a note's Area is used: "today’s plan", "2 saved plans", or both.
    function planAreaPlaces(use){
      const parts=[use&&use.today?'today’s plan':'',use&&use.savedPlans?`${use.savedPlans===1?'a saved plan':`${use.savedPlans} saved plans`}`:''].filter(Boolean);
      return parts.join(' and ');
    }
    // Renames or moves the note; with inPlans (the default, and the rename
    // dialog's tick box) the Area in today's plan and saved plans follows it.
    async function applyNoteRename(entry,value,{inPlans=true,mergeAgreed=false}={}){
      const identity=normalizeNoteArea(value);
      if(!identity||identity.label===entry.label||!canMutate())return false;
      if(identity.reserved){setNotesStatus('“Support Activities” is the shared note for support blocks. Choose another name.',{error:true});return false;}
      // A new note lives only in this list: it takes the new name, or opens the
      // note that already has it.
      if(entry.ephemeral){
        const existing=noteCatalogue().find(item=>item.key===identity.key);
        pendingNotes=pendingNotes.filter(item=>item.key!==entry.key);
        if(!existing)pendingNotes=[...pendingNotes,Object.freeze({...entry,key:identity.key,label:identity.label})];
        invalidateAttachments();selectedNoteKey=identity.key;noteTree(noteEntries());expandNoteAncestors(identity.key);renderNotes();
        notifications.begin({id:'note-rename',surfaceId:'notes-status',title:'Rename note',announce:false}).finish('succeeded',existing?`“${identity.label}” already exists, so it is open now.`:`Renamed to “${identity.label}”.`);
        return true;
      }
      const state=noteState(entry),where=planAreaPlaces(planAreaUse(entry.key));
      // No work block's Area goes inside Support Activities: an Area with no
      // note cannot move there, and a note that moves there leaves the plans
      // on their Area.
      if(identity.reservedArea){if(state.kind==='plan'){setNotesStatus(AREA_INSIDE_SUPPORT,{error:true});return false;}inPlans=false;}
      // An Area of today's plan with no note is renamed in the plans.
      if(state.kind==='plan'){inPlans=true;if(!where)return false;}
      const notice=notifications.begin({id:'note-rename',surfaceId:'notes-status',title:'Rename note',message:'Renaming the note…'});
      try{
        let outcome=state.kind==='plan'?{status:'renamed',key:identity.key,moved:[{from:entry.key,to:identity.key}],merged:0}:await renameNote(entry.key,identity.label,{merge:false});
        if(outcome.status==='collision'){
          const into=outcome.labels[0]||identity.label,others=outcome.labels.length-1;
          const accepted=mergeAgreed||await confirm({title:'Merge notes?',message:`Merge “${entry.label}” into “${into}”? Its text is added to the end of “${into}”.`,details:others>0?[`${others} more note${others===1?'':'s'} inside it ${others===1?'is':'are'} merged the same way.`]:[],confirmLabel:'Merge',cancelLabel:'Cancel'});
          if(!accepted||!canMutate()){notice.finish('cancelled','Nothing was renamed.');return false;}
          outcome=await renameNote(entry.key,identity.label,{merge:true});
        }
        if(outcome.status!=='renamed'){
          notice.finish('failed',outcome.status==='inside-itself'?'A note cannot move inside itself.':outcome.status==='content-limit'?`Merging would make “${outcome.label}” longer than one note can be. Nothing was changed.`:'The note could not be renamed. Nothing was changed.');
          return false;
        }
        let plans='';
        if(where&&inPlans){await renameAreaInPlans(entry.key,identity.label);plans=` ${capitalized(where)} now ${plural(where)?'use':'uses'} the new name.`;}
        else if(where)plans=` ${capitalized(where)} still ${plural(where)?'use':'uses'} the old name.`;
        selectedNoteKey=outcome.key;noteTree(noteEntries());expandNoteAncestors(outcome.key);renderNotes();
        const moved=outcome.moved.length-(state.kind==='parent'?0:1);
        const moving=noteParentPath(entry.label).toLowerCase()!==noteParentPath(identity.label).toLowerCase();
        notice.finish('succeeded',`${outcome.merged?'Merged into':moving?'Moved to':'Renamed to'} “${identity.label.replace(/\s*>\s*/g,' › ')}”${moved>0?`, with ${moved} note${moved===1?'':'s'} inside it`:''}.${plans}`);
        return true;
      }catch(error){notice.finish('failed',error&&error.message||'The note could not be renamed. Keep this tab open and retry.');return false;}
    }
    // While a note is typed in, what depends on its text follows shortly
    // after, without redrawing the editor: the tag row (a tag added or
    // deleted), the links bar with Linked from, and the row's edited time.
    let noteLiveTimer=0;
    function scheduleNoteLiveRefresh(entry,links){
      clearTimeout(noteLiveTimer);
      noteLiveTimer=setTimeout(()=>{
        noteLiveTimer=0;if(!notesShown())return;
        renderNoteTags();
        if(links?.isConnected)links.refresh?.();
        const row=[...document.querySelectorAll('#library-notes-list [data-note-key]')].find(candidate=>candidate.dataset.noteKey===entry.key),stored=getNote(entry.key,entry.label);
        const edited=row?.querySelector('.library-note-nav-edited');if(edited&&stored?.updatedAt)edited.textContent=editedLabel(stored.updatedAt);
      },300);
    }
    function clearNotesEditorBinding(){
      clearTimeout(noteLiveTimer);noteLiveTimer=0;
      noteEditorSignature='';noteParentSignature='';noteSearchLanded='';
      const field=notesEditorField();
      if(field)clearEditor(field);
    }
    function refreshNotes(){
      if(host.held())return false;
      noteSearch.restart();
      if(notesShown())return renderNotes();
      clearNotesEditorBinding();
      noteSearch.idle();
      return false;
    }
    function installNotesWorkspace(){
      if(notesInstalled)return;
      notesInstalled=true;
      const drawer=notesSection();
      const search=document.getElementById('library-notes-search');
      const add=document.getElementById('library-note-add');
      const list=document.getElementById('library-notes-list'),trashToggle=document.getElementById('library-notes-trash-toggle'),info=document.getElementById('library-notes-info'),infoPopover=document.getElementById('library-notes-info-popover');
      if(info&&infoPopover){
        const about=createAnchoredPopover(infoPopover,{align:'start',onClose:()=>info.setAttribute('aria-expanded','false')});
        info.addEventListener('click',event=>{event.preventDefault();if(infoPopover.hidden){about.show(info);info.setAttribute('aria-expanded','true');}else about.hide();});
      }
      const select=document.getElementById('library-note-select'),selectAll=document.getElementById('library-note-select-all'),clearSelection=document.getElementById('library-note-selection-clear'),exportButton=document.getElementById('library-note-export'),cancel=document.getElementById('library-note-select-cancel');
      if(drawer)drawer.addEventListener('keydown',event=>{if(event.key==='Escape'&&noteSelectionMode){event.preventDefault();cancelNoteSelection();}});
      if(search){
        search.addEventListener('input',requestNotesRender);
        search.addEventListener('keydown',event=>{
          if(event.key==='Enter'){event.preventDefault();if(!stepNoteMatch(event.shiftKey?-1:1)){noteSearchLanded='';landOnNoteSearch();}}
          else if(event.key==='Escape'&&!document.getElementById('library-note-matches')?.hidden){event.preventDefault();clearNoteMatches();}
        });
      }
      const sort=document.getElementById('library-notes-sort');
      if(sort){sort.value=noteSort;sort.addEventListener('change',()=>{noteSort=sort.value==='recent'?'recent':'name';noteVisibleLimit=NOTE_PAGE_SIZE;host.rememberView();renderNotes();});}
      if(add)add.addEventListener('click',createNote);
      const importButton=document.getElementById('library-note-import'),importFile=document.getElementById('library-note-import-file');
      if(importButton&&importFile){importButton.addEventListener('click',()=>{importFile.value='';importFile.click();});importFile.addEventListener('change',()=>{const files=[...(importFile.files||[])];importFile.value='';void importNotes(files);});}
      if(list){list.addEventListener('keydown',handleNoteTreeKey);installNoteContextMenu(list);}
      const trashList=document.getElementById('library-notes-trash-list');
      if(trashList){
        installNoteContextMenu(trashList);
        trashList.addEventListener('keydown',event=>{
          if(event.key!=='ContextMenu'&&!(event.key==='F10'&&event.shiftKey))return;
          const row=event.target?.closest?.('[data-trash-key]'),item=row&&noteTrashItems().find(candidate=>candidate.key===row.dataset.trashKey);if(!item)return;
          const rect=row.getBoundingClientRect();event.preventDefault();openTrashContextMenu(item,row,rect.left+24,rect.bottom);
        });
      }
      if(trashToggle)trashToggle.addEventListener('click',toggleNoteTrash);
      if(select)select.addEventListener('click',enterNoteSelection);
      if(selectAll)selectAll.addEventListener('click',selectAllNotes);
      if(clearSelection)clearSelection.addEventListener('click',clearNoteSelection);
      if(exportButton)exportButton.addEventListener('click',()=>{void exportSelectedNotes();});
      if(cancel)cancel.addEventListener('click',cancelNoteSelection);
      // Ctrl+P / Cmd+P with a note open prints the note, as ⋯ → Print or save
      // as PDF does (owner, 2026-11-28). Elsewhere it is the browser's print.
      // The browser's own File → Print stays the page's: it prints at once,
      // before a note's images could load, so it cannot print the note well.
      document.addEventListener('keydown',event=>{
        if(!(event.ctrlKey||event.metaKey)||event.altKey||event.shiftKey||event.code!=='KeyP'&&String(event.key).toLowerCase()!=='p')return;
        if(!notesShown()||!selectedNoteKey||selectedTrashKey||noteSelectionMode||document.querySelector('dialog[open]'))return;
        const entry=noteEntries().find(candidate=>candidate.key===selectedNoteKey);if(!entry)return;
        event.preventDefault();if(event.repeat)return;
        if(entry.ephemeral||!entry.hasNote){setNotesStatus('Write something in this note before printing it.');return;}
        void printNoteEntry(entry);
      },true);
      refreshNotes();
    }
    function noteListGrid(){return document.querySelector('#library-notes .library-notes-grid');}
    function applyNoteListWidth(){
      const grid=noteListGrid(),handle=document.getElementById('library-notes-resizer');if(!grid)return;
      grid.classList.toggle('custom-width',noteListWidth>0);
      if(noteListWidth>0)grid.style.setProperty('--library-notes-list-width',`${noteListWidth}px`);else grid.style.removeProperty('--library-notes-list-width');
      const nav=grid.querySelector('.library-notes-nav'),total=grid.clientWidth;
      if(handle&&nav&&total)handle.setAttribute('aria-valuenow',String(Math.round(nav.getBoundingClientRect().width/total*100)));
    }
    function setNoteListWidth(width,{remember=true}={}){
      const max=Math.max(NOTE_LIST_MIN,(noteListGrid()?.clientWidth||0)*NOTE_LIST_MAX_SHARE);
      noteListWidth=width>0?Math.round(Math.min(max,Math.max(NOTE_LIST_MIN,width))):0;
      applyNoteListWidth();if(remember)host.rememberView();
    }
    // Drag the list's edge, or focus it and use the arrow keys (Shift for bigger
    // steps); a double-click or Enter returns the list to a third of the width.
    function installNoteListResizer(){
      const handle=document.getElementById('library-notes-resizer');if(!handle)return;
      const listWidth=()=>noteListGrid()?.querySelector('.library-notes-nav')?.getBoundingClientRect().width||0;
      handle.addEventListener('pointerdown',event=>{
        if(event.button!==0)return;event.preventDefault();
        const start=event.clientX,width=listWidth();handle.setPointerCapture?.(event.pointerId);handle.classList.add('dragging');
        const move=moved=>setNoteListWidth(width+moved.clientX-start,{remember:false});
        const end=()=>{handle.classList.remove('dragging');handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',end);handle.removeEventListener('pointercancel',end);host.rememberView();};
        handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);
      });
      handle.addEventListener('dblclick',()=>setNoteListWidth(0));
      handle.addEventListener('focus',applyNoteListWidth);
      handle.addEventListener('keydown',event=>{
        const step=event.shiftKey?64:16,actions={ArrowLeft:()=>setNoteListWidth(listWidth()-step),ArrowRight:()=>setNoteListWidth(listWidth()+step),Home:()=>setNoteListWidth(NOTE_LIST_MIN),End:()=>setNoteListWidth(Infinity),Enter:()=>setNoteListWidth(0)};
        if(!actions[event.key])return;event.preventDefault();actions[event.key]();
      });
      applyNoteListWidth();
    }

    installNotesWorkspace();installTagRow();
    // Leaving the Notes section: nothing chosen there outlives it except new
    // notes not yet written.
    function leave(){
      const section=notesSection();
      if(noteRevealFrame){cancelAnimationFrame(noteRevealFrame);noteRevealFrame=0;}
      noteSelectionMode=false;noteSelection.clear();noteExportBusy=false;
      selectedTrashKey='';noteTrashOpen=false;noteVisibleLimit=NOTE_PAGE_SIZE;
      if(section)section.classList.remove('export-selecting','note-open');
      clearNotesEditorBinding();noteSearch.idle();
    }
    // Clear Library removed the notes.
    function cleared(){pendingNotes=[];selectedNoteKey='';noteSelectionMode=false;noteSelection.clear();clearNotesEditorBinding();refreshNotes();}
    // A render waiting for the next frame is dropped; true if there was one.
    function cancelRender(){if(!noteRenderFrame)return false;cancelAnimationFrame(noteRenderFrame);noteRenderFrame=0;return true;}
    return freeze({
      search:noteSearch,
      enter:()=>{noteSearch.resume();return renderNotes();},
      leave,cleared,cancelRender,
      render:renderNotes,refresh:refreshNotes,clearBinding:clearNotesEditorBinding,
      view:()=>freeze({sort:noteSort,listWidth:noteListWidth}),
      installResizer:installNoteListResizer,
      select:selectNote,destinations:noteDestinations,reveal:revealNoteReference,filterTag
    });
  }
  return freeze({format:'study-director.library-notes-module',contractVersion:1,createNotes});
});
})();
