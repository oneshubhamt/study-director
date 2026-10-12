(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,declaredFunctions:requireFunctions}=registry.contracts;
registry.define('library',1,()=>{
  const freeze=Object.freeze;
  const PORT_FIELDS=freeze({
    notifications:freeze(['begin','feedback']),
    records:freeze(['get','remove','sortedSummaries']),
    domain:freeze(['countTaskOutcomes','earliestSupportedSavedDate','isTrackableBlock','isValidIsoDate','isSupportedSavedDate','todayISO','sanitizePracticeRuns','sanitizeTaskOutcomeCounts','taskOutcomeSummaryText']),
    presentation:freeze(['createSavedDayTaskReviewCard','createPomodoroSummaryLine','emptyMsg','optionalDurationLabel','optionalHoursLabel','optionalPercentLabel','plainTextContent','populatePracticeRunTable','prettyDate','renderRichTextContent','textEl']),
    view:freeze(['document','goTab','setStatus','setTextSafe','window']),
    interactions:freeze(['choose','confirm','input']),
    environment:freeze(['cancelAnimationFrame','createOption','createSearchWorker','requestAnimationFrame']),
    exporter:freeze(['exportKeys','cancel']),
    diary:freeze(['bindEditor','captureEditor','clearEditor','deleteEntry','draft','flushEditor','scheduleEditor','settled']),
    notes:freeze(['areaUse','bindEditor','canCreate','catalogue','clearEditor','clearFind','commitEditor','find','findStep','focusEditor','get','importFiles','linksBar','normalizeArea','normalizeTag','orderEntries','print','purgeTrash','remove','rename','renameAreaInPlans','renameTag','renderInherited','restore','searchDocuments','size','tagged','tags','trash','trashSnapshot','versions']),
    attachments:freeze(['batch','close','count','invalidate','reconcile','refresh']),
    preferences:freeze(['read','write']),
    clearLibrary:freeze(['preflight','execute']),
    ownership:freeze(['canMutate']),
    overlays:freeze(['createAnchoredPopover']),
    session:freeze(['hasActiveSession'])
  });
  function createView(input){
    exactObject(input,['ports'],'Library input');
    const ports=exactObject(input.ports,Object.keys(PORT_FIELDS),'Library ports');
    for(const [name,fields] of Object.entries(PORT_FIELDS))exactObject(ports[name],fields,'Library '+name+' port');
    requireFunctions(ports.notifications,PORT_FIELDS.notifications,'Library notifications port');
    requireFunctions(ports.records,PORT_FIELDS.records,'Library records port');
    requireFunctions(ports.domain,PORT_FIELDS.domain,'Library domain port');
    requireFunctions(ports.presentation,PORT_FIELDS.presentation,'Library presentation port');
    requireFunctions(ports.view,['goTab','setStatus','setTextSafe'],'Library view port');
    requireFunctions(ports.interactions,PORT_FIELDS.interactions,'Library interactions port');
    requireFunctions(ports.environment,PORT_FIELDS.environment,'Library environment port');
    requireFunctions(ports.exporter,PORT_FIELDS.exporter,'Library exporter port');
    requireFunctions(ports.diary,PORT_FIELDS.diary,'Library diary port');
    requireFunctions(ports.notes,PORT_FIELDS.notes,'Library notes port');
    requireFunctions(ports.attachments,PORT_FIELDS.attachments,'Library attachments port');
    requireFunctions(ports.clearLibrary,PORT_FIELDS.clearLibrary,'Library Clear Library port');
    requireFunctions(ports.ownership,PORT_FIELDS.ownership,'Library ownership port');
    requireFunctions(ports.overlays,PORT_FIELDS.overlays,'Library overlays port');
    requireFunctions(ports.session,PORT_FIELDS.session,'Library session port');
    requireFunctions(ports.preferences,PORT_FIELDS.preferences,'Library preferences port');
    const notifications=ports.notifications;
    const {get:getDailyRecord,remove:removeDailyRecord,sortedSummaries}=ports.records;
    const {countTaskOutcomes,earliestSupportedSavedDate,isTrackableBlock,isValidIsoDate,isSupportedSavedDate,todayISO,sanitizePracticeRuns,sanitizeTaskOutcomeCounts,taskOutcomeSummaryText}=ports.domain;
    const {createSavedDayTaskReviewCard,createPomodoroSummaryLine,emptyMsg,optionalDurationLabel,optionalHoursLabel,optionalPercentLabel,plainTextContent,populatePracticeRunTable,prettyDate,renderRichTextContent,textEl}=ports.presentation;
    const {document,goTab,setStatus,setTextSafe,window}=ports.view;
    const {choose,confirm,input:requestInput}=ports.interactions;
    const {cancelAnimationFrame,createOption,createSearchWorker,requestAnimationFrame}=ports.environment;
    const {exportKeys,cancel:cancelExport}=ports.exporter;
    const {bindEditor:bindDiaryEditor,captureEditor:captureDiaryEditor,clearEditor:clearDiaryEditor,deleteEntry:deleteDiaryEntryRecord,flushEditor:flushDiaryEditor,scheduleEditor:scheduleDiaryEditor,draft:createDiaryDraft,settled:settleDiaryEditor}=ports.diary;
    const {
      areaUse:planAreaUse,renameAreaInPlans,bindEditor,canCreate:canCreateOngoingNote,catalogue:ongoingNoteCatalogue,clearEditor,clearFind,commitEditor,find:findInEditor,findStep,focusEditor,
      get:getAreaNote,importFiles:importNoteFiles,linksBar,normalizeArea:normalizeOngoingNoteArea,normalizeTag,orderEntries:orderOngoingNoteEntries,print:printNote,
      purgeTrash:purgeExpiredOngoingNotes,remove:removeOngoingNote,rename:renameNote,renameTag:renameNoteTag,renderInherited,restore:restoreNote,searchDocuments:ongoingNoteSearchDocuments,size:ongoingNotesSize,
      tagged:taggedNotes,tags:noteTags,trash:trashNote,trashSnapshot:ongoingNoteTrash,versions:openNoteVersions
    }=ports.notes;
    const {batch:batchAttachments,close:closeAttachments,count:attachmentCount,invalidate:invalidateAttachments,reconcile:reconcileAttachments,refresh:refreshAttachments}=ports.attachments;
    const {preflight:preflightClearLibrary,execute:executeClearLibrary}=ports.clearLibrary;
    const {canMutate}=ports.ownership;
    const {createAnchoredPopover}=ports.overlays;
    const {hasActiveSession}=ports.session;

    // The Library shows one section at a time and remembers it, with whether
    // the Diary panel was open. Only the shown section renders, and only while
    // the Library tab is active.
    const LIBRARY_SECTIONS=freeze(['notes','days','data']);
    const savedView=(()=>{try{const value=ports.preferences.read();return value&&typeof value==='object'?value:{};}catch{return {};}})();
    let librarySection=LIBRARY_SECTIONS.includes(savedView.section)?savedView.section:'notes',libraryActive=false;
    // Notes list order: 'name' is the tree, 'recent' a flat list, newest edit first.
    let noteSort=savedView.sort==='recent'?'recent':'name';
    // The notes list width a person dragged to, in pixels; 0 keeps a third of the panel.
    const NOTE_LIST_MIN=200,NOTE_LIST_MAX_SHARE=0.6;
    let noteListWidth=Number.isFinite(savedView.listWidth)&&savedView.listWidth>0?savedView.listWidth:0;
    // The note and query whose matches were last marked in the open note.
    let noteSearchLanded='';
    let selectedLibraryDate=null;
    const LIBRARY_PAGE_SIZE=100;
    let libraryVisibleLimit=LIBRARY_PAGE_SIZE;
    let libraryLastFilterSignature='';
    let libraryPreserveLimitOnce=false;
    let librarySummaryCache=null;
    let librarySummaryLoad=null;
    let librarySummaryRevision=0;
    let libraryFilterOptionsSignature=null;
    let libraryRenderFrame=0;
    let libraryRenderToken=0;
    let libraryRenderedRevision=-1;
    let libraryRenderedFilterSignature='';
    let libraryRenderedVisibleLimit=0;
    let libraryHasRendered=false;
    let libraryRestoreFrame=0;
    let libraryScrollState={documentTop:0,mainTop:0};
    let selectedDiaryDate='',diaryDraftRecord=null,diaryEditing=false,diaryEntryListed=false,diaryInstalled=false,diaryRenderFrame=0,diaryRenderToken=0,diarySummaryCountQueued=false,diarySummaryCountRevision=-1;
    let selectedOngoingNoteKey='';
    let ongoingNoteEditorSignature='',ongoingNoteParentSignature='';
    let ongoingNoteRenderFrame=0;
    let ongoingNoteRevealFrame=0;
    let ongoingNotesInstalled=false;
    let pendingOngoingNote=null;
    let ongoingNoteSelectionMode=false;
    let ongoingNoteSelection=new Set();
    let ongoingNoteExportBusy=false;
    // The notes list is a tree in the catalogue's depth-first order. Branches the
    // person opens or closes keep that state for this session; others open only
    // while they hold today's Areas or the open note.
    const ongoingNoteExpanded=new Map(),ONGOING_NOTE_PAGE_SIZE=100;
    let ongoingNoteVisibleLimit=ONGOING_NOTE_PAGE_SIZE,ongoingNoteTreeNodes=new Map();
    // Tags picked in the tag list: the list shows notes that have all of them.
    let noteTagFilter=[],noteTagsRendered=null,noteTagsSignature='',noteTagsExpanded=false;
    const NOTE_TAGS_SHOWN=12;
    // Recently deleted: the open state of its list and the deleted note shown.
    let ongoingNoteTrashOpen=false,selectedTrashKey='',ongoingNoteFocusKey='';
    const LIBRARY_MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    let attachmentMutationHold=0,attachmentMutationNeedsNotes=false,attachmentMutationNeedsDiary=false,attachmentMutationNeedsLibrary=false,attachmentMutationRestoreViewport=false;
    const NOTE_SEARCH_IDLE_MS=120000,NOTE_SEARCH_RESPONSE_MS=30000,NOTE_SEARCH_BATCH_CHARS=2*1024*1024;
    let noteSearchDeadline=0,noteSearchWorker=null,noteSearchTimer=0,noteSearchBuildTimer=0,noteSearchBuildDocuments=null,noteSearchBuildIndex=0,noteSearchBuilding=false,noteSearchId=0,noteSearchQuery='',noteSearchReady=false,noteSearchMatches=new Set(),noteSearchFailed=false,noteSearchPendingUpdates=new Map(),noteSearchFallbackText=null;

    function clearNoteSearchTimer(){if(noteSearchTimer){window.clearTimeout(noteSearchTimer);noteSearchTimer=0;}}
    function clearNoteSearchBuildTimer(){if(noteSearchBuildTimer){window.clearTimeout(noteSearchBuildTimer);noteSearchBuildTimer=0;}}
    function clearNoteSearchDeadline(){if(noteSearchDeadline){window.clearTimeout(noteSearchDeadline);noteSearchDeadline=0;}}
    function resetNoteSearch(){clearNoteSearchDeadline();noteSearchId++;noteSearchQuery='';noteSearchReady=false;noteSearchMatches=new Set();}
    function resetNoteSearchFailure(){if(noteSearchWorker)return false;noteSearchFailed=false;noteSearchFallbackText=null;resetNoteSearch();return true;}
    function stopNoteSearch(failed=false){
      clearNoteSearchTimer();clearNoteSearchBuildTimer();noteSearchId++;
      if(noteSearchWorker){const stopped=noteSearchWorker;noteSearchWorker=null;stopped.onmessage=stopped.onerror=stopped.onmessageerror=null;try{stopped.terminate();}catch{}}
      noteSearchBuildDocuments=null;noteSearchBuildIndex=0;noteSearchBuilding=false;noteSearchPendingUpdates.clear();
      resetNoteSearch();noteSearchFailed=!!failed;if(!failed)noteSearchFallbackText=null;
    }
    function idleNoteSearch(){clearNoteSearchTimer();if(noteSearchWorker)noteSearchTimer=window.setTimeout(()=>{noteSearchTimer=0;stopNoteSearch();},NOTE_SEARCH_IDLE_MS);}
    function failNoteSearch(){stopNoteSearch(true);requestOngoingNotesRender();}
    function postSearch(message){try{noteSearchWorker.postMessage(message);return true;}catch{failNoteSearch();return false;}}
    function watchNoteSearch(){
      if(noteSearchDeadline)return;const current=noteSearchWorker;
      noteSearchDeadline=window.setTimeout(()=>{noteSearchDeadline=0;if(noteSearchWorker===current)failNoteSearch();},NOTE_SEARCH_RESPONSE_MS);
    }
    function postNoteSearchUpdate(record){
      if(!noteSearchWorker||!record)return false;const key=String(record.key||'').trim();if(!key)return false;
      if(record.deleted===true)postSearch({type:'delete',key});
      else{const document={key,revision:String(record.revision||'')};if(record.plain!==undefined)document.plain=String(record.plain||'');else document.value=String(record.value||'');postSearch({type:'upsert',document});}
      return true;
    }
    function finishNoteSearchBuild(){
      noteSearchBuilding=false;noteSearchBuildDocuments=null;noteSearchBuildIndex=0;
      for(const record of noteSearchPendingUpdates.values())postNoteSearchUpdate(record);noteSearchPendingUpdates.clear();
      const query=ongoingNotesSearch();if(query)requestNoteSearch(query,true);else idleNoteSearch();
    }
    function feedNoteSearchBuild(){
      noteSearchBuildTimer=0;if(!noteSearchWorker||!noteSearchBuilding||!noteSearchBuildDocuments)return;
      const batch=[];let chars=0;
      while(noteSearchBuildIndex<noteSearchBuildDocuments.length){
        const record=noteSearchBuildDocuments[noteSearchBuildIndex],size=String(record?.value??record?.plain??'').length;
        if(batch.length&&chars+size>NOTE_SEARCH_BATCH_CHARS)break;
        batch.push(record);chars+=size;noteSearchBuildIndex++;
      }
      if(batch.length&&!postSearch({type:'batch',documents:batch}))return;
      if(noteSearchBuildIndex<noteSearchBuildDocuments.length)noteSearchBuildTimer=window.setTimeout(feedNoteSearchBuild,0);else finishNoteSearchBuild();
    }
    function startNoteSearchBuild(worker){
      noteSearchBuildDocuments=ongoingNoteSearchDocuments();noteSearchBuildIndex=0;noteSearchBuilding=true;noteSearchPendingUpdates.clear();
      watchNoteSearch();if(postSearch({type:'sync',documents:[]}))noteSearchBuildTimer=window.setTimeout(feedNoteSearchBuild,0);
    }
    function ensureNoteSearch(){
      clearNoteSearchTimer();if(noteSearchWorker)return true;if(noteSearchFailed)return false;
      try{
        const worker=createSearchWorker();
        worker.onmessage=event=>{if(noteSearchWorker!==worker)return;const message=event?.data||{};if(message.type==='error'){failNoteSearch();return;}if(message.type!=='result'||Number(message.id)!==noteSearchId||!noteSearchQuery)return;clearNoteSearchDeadline();noteSearchReady=true;noteSearchMatches=new Set(Array.isArray(message.keys)?message.keys.map(String):[]);requestOngoingNotesRender();};
        worker.onerror=event=>{if(noteSearchWorker!==worker)return;event?.preventDefault?.();failNoteSearch();};worker.onmessageerror=()=>{if(noteSearchWorker===worker)failNoteSearch();};noteSearchWorker=worker;startNoteSearchBuild(worker);return noteSearchWorker===worker;
      }catch{stopNoteSearch(true);return false;}
    }
    function requestNoteSearch(query,force=false){
      const clean=String(query||'').trim().toLowerCase();if(!clean){resetNoteSearch();return false;}
      if(!ensureNoteSearch())return false;if(!force&&noteSearchQuery===clean)return true;
      noteSearchQuery=clean;noteSearchReady=false;watchNoteSearch();if(noteSearchBuilding)return true;
      const id=++noteSearchId;return postSearch({type:'query',id,query:clean});
    }
    function updateOngoingNoteSearchDocument(record){
      if(!record)return false;clearNoteSearchTimer();const key=String(record.key||'').trim();if(!key)return false;
      if(noteSearchFallbackText){if(record.deleted===true)noteSearchFallbackText.delete(key);else noteSearchFallbackText.set(key,String(record.plain===undefined?plainTextContent(record.value||''):record.plain||'').toLowerCase());}
      if(!noteSearchWorker)return !!noteSearchFallbackText;
      if(noteSearchBuilding)noteSearchPendingUpdates.set(key,record);else postNoteSearchUpdate(record);
      noteSearchQuery='';noteSearchReady=false;const query=ongoingNotesSearch();if(query)requestNoteSearch(query,true);return true;
    }
    function fallbackNoteSearch(entries,query){
      if(!noteSearchFallbackText){noteSearchFallbackText=new Map();for(const record of ongoingNoteSearchDocuments())noteSearchFallbackText.set(String(record.key||''),plainTextContent(record.value||'').toLowerCase());}
      return entries.filter(entry=>String(entry.label||'').toLowerCase().includes(query)||String(noteSearchFallbackText.get(entry.key)||'').includes(query));
    }
    function filterOngoingNoteEntries(entries,query){
      if(!query)return {entries,pending:false};
      if(noteSearchFailed)return {entries:fallbackNoteSearch(entries,query),pending:false};
      requestNoteSearch(query);if(noteSearchFailed)return {entries:fallbackNoteSearch(entries,query),pending:false};
      if(!noteSearchReady||noteSearchQuery!==query)return {entries,pending:true};
      return {entries:entries.filter(entry=>String(entry.label||'').toLowerCase().includes(query)||noteSearchMatches.has(entry.key)),pending:false};
    }

    function notesSection(){return document.getElementById('library-notes');}
    function ongoingNotesEditorField(){return document.querySelector('#library-notes-editor .library-notes-textarea');}
    function notesShown(){return libraryActive&&librarySection==='notes';}
    function ongoingNotesSearch(){return String(document.getElementById('library-notes-search')?.value||'').trim().toLowerCase();}
    function ongoingNoteEntries(){
      const entries=ongoingNoteCatalogue();
      if(!pendingOngoingNote)return entries;
      if(entries.some(entry=>entry.key===pendingOngoingNote.key))pendingOngoingNote=null;
      return pendingOngoingNote?orderOngoingNoteEntries([...entries,pendingOngoingNote]):entries;
    }
    function ongoingNoteDestinations(){
      return freeze(ongoingNoteEntries().map(entry=>freeze({key:entry.key,label:entry.label,hasNote:!!entry.hasNote,pending:!!entry.ephemeral})));
    }
    // A note's title is its path, such as "Medicine > Cardiology".
    function labelParts(label){return String(label||'').split('>').map(part=>part.trim()).filter(Boolean);}
    function ongoingNoteLeaf(label){return labelParts(label).at(-1)||String(label||'Area');}
    function ongoingNoteParentPath(label){const parts=labelParts(label);return parts.length>1?parts.slice(0,-1).join(' > '):'';}
    function ongoingNoteSelectionIndex(entries){
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
    function ongoingNoteSelectionState(entry,index){
      const keys=index.get(entry.key)||[],selected=keys.reduce((count,key)=>count+(ongoingNoteSelection.has(key)?1:0),0);
      return {keys,checked:!!keys.length&&selected===keys.length,indeterminate:selected>0&&selected<keys.length};
    }
    function updateOngoingNoteSelectionControls(entries){
      const select=document.getElementById('library-note-select'),selectAll=document.getElementById('library-note-select-all'),clear=document.getElementById('library-note-selection-clear'),exportButton=document.getElementById('library-note-export'),cancel=document.getElementById('library-note-select-cancel'),count=document.getElementById('library-note-selection-count'),navCount=document.getElementById('library-notes-nav-count');
      const exportable=(entries||[]).filter(entry=>entry.hasNote),valid=new Set(exportable.map(entry=>entry.key)),allSelected=!!exportable.length&&exportable.every(entry=>ongoingNoteSelection.has(entry.key));
      for(const key of [...ongoingNoteSelection])if(!valid.has(key))ongoingNoteSelection.delete(key);
      const add=document.getElementById('library-note-add'),drawer=notesSection();
      if(drawer){drawer.classList.toggle('export-selecting',ongoingNoteSelectionMode);drawer.setAttribute('aria-busy',ongoingNoteExportBusy?'true':'false');}
      if(select)select.hidden=ongoingNoteSelectionMode;
      if(add)add.hidden=ongoingNoteSelectionMode;
      const importButton=document.getElementById('library-note-import');if(importButton)importButton.hidden=ongoingNoteSelectionMode;
      if(navCount)navCount.hidden=ongoingNoteSelectionMode;
      if(selectAll){selectAll.hidden=!ongoingNoteSelectionMode;selectAll.disabled=!exportable.length||allSelected||ongoingNoteExportBusy;selectAll.textContent='All';}
      if(clear){clear.hidden=!ongoingNoteSelectionMode;clear.disabled=!ongoingNoteSelection.size||ongoingNoteExportBusy;}
      if(exportButton){exportButton.hidden=!ongoingNoteSelectionMode;exportButton.disabled=!ongoingNoteSelection.size||ongoingNoteExportBusy;exportButton.textContent=ongoingNoteExportBusy?'Preparing…':'Export';}
      if(cancel){cancel.hidden=!ongoingNoteSelectionMode;cancel.disabled=false;cancel.textContent='×';cancel.setAttribute('aria-label',ongoingNoteExportBusy?'Cancel notes export':'Exit export selection');cancel.title=ongoingNoteExportBusy?'Cancel notes export':'Exit export selection';}
      if(count){count.hidden=!ongoingNoteSelectionMode;count.textContent=`${ongoingNoteSelection.size} selected`;}
    }
    function enterOngoingNoteSelection(){
      ongoingNoteSelectionMode=true;ongoingNoteSelection.clear();notesSection()?.classList.remove('note-open');
      const current=ongoingNoteEntries().find(entry=>entry.key===selectedOngoingNoteKey);
      if(current?.hasNote)ongoingNoteSelection.add(current.key);
      clearOngoingNotesEditorBinding();renderOngoingNotes();return true;
    }
    function cancelOngoingNoteSelection(){if(ongoingNoteExportBusy){cancelExport();return false;}ongoingNoteSelectionMode=false;ongoingNoteSelection.clear();renderOngoingNotes();return true;}
    function syncOngoingNoteSelectionRows(entries,index=ongoingNoteSelectionIndex(entries)){
      const rows=Array.isArray(entries)?entries:[],byKey=new Map(rows.map(entry=>[entry.key,entry]));
      for(const row of document.querySelectorAll('[data-ongoing-note-key]')){
        const entry=byKey.get(row.dataset.ongoingNoteKey);if(!entry)continue;
        const state=ongoingNoteSelectionState(entry,index),checkbox=row.querySelector('.library-note-checkbox');
        row.classList.toggle('selected',state.checked);row.classList.toggle('partial',state.indeterminate);
        if(checkbox){checkbox.checked=state.checked;checkbox.indeterminate=state.indeterminate;checkbox.disabled=!state.keys.length;}
      }
    }
    function toggleOngoingNoteSelection(key){
      const entries=ongoingNoteEntries(),entry=entries.find(candidate=>candidate.key===String(key||''));if(!entry)return false;
      const index=ongoingNoteSelectionIndex(entries),state=ongoingNoteSelectionState(entry,index);if(!state.keys.length)return false;
      state.keys.forEach(noteKey=>state.checked?ongoingNoteSelection.delete(noteKey):ongoingNoteSelection.add(noteKey));
      syncOngoingNoteSelectionRows(entries,index);updateOngoingNoteSelectionControls(entries);return true;
    }
    function selectAllOngoingNotes(){
      const entries=ongoingNoteEntries(),exportable=entries.filter(entry=>entry.hasNote);if(!exportable.length)return false;
      exportable.forEach(entry=>ongoingNoteSelection.add(entry.key));syncOngoingNoteSelectionRows(entries);updateOngoingNoteSelectionControls(entries);return true;
    }
    function clearOngoingNoteSelection(){const entries=ongoingNoteEntries();ongoingNoteSelection.clear();syncOngoingNoteSelectionRows(entries);updateOngoingNoteSelectionControls(entries);return true;}
    async function exportSelectedOngoingNotes(){
      if(ongoingNoteExportBusy||!ongoingNoteSelection.size)return false;
      ongoingNoteExportBusy=true;updateOngoingNoteSelectionControls(ongoingNoteEntries());
      const notice=notifications.begin({id:'ongoing-note-export',surfaceId:'ongoing-notes-status',title:'Export notes',message:'Preparing portable Markdown export…'});
      let success=false,status='No saved notes were available to export.',statusError=true,result=null;
      try{
        result=await exportKeys([...ongoingNoteSelection]);
        if(result&&(result.status==='downloaded'||result.status==='saved')){
          success=true;statusError=false;
          status=result.kind==='markdown'?(result.status==='saved'?'Markdown note saved and verified.':'Markdown download started.'): `${result.status==='saved'?'Markdown package saved and verified':'Markdown package download started'} · ${result.notes} note${result.notes===1?'':'s'}${result.assets?` · ${result.assets} image${result.assets===1?'':'s'}`:''}.`;
          if(result.missing)status+=` ${result.missing} unavailable image(s) are marked in the exported notes.`;
          ongoingNoteSelectionMode=false;ongoingNoteSelection.clear();
        }else if(result&&result.status==='cancelled'){status='Notes export cancelled.';statusError=false;}else if(result&&result.status==='too-large')status=`This export is larger than the ${Math.round((Number(result.maxBytes)||0)/(1024*1024))} MiB safety limit. Select fewer notes and export again.`;
      }catch(error){console.error('Note export failed:',error);status='Notes export did not complete: '+error.message;}
      finally{ongoingNoteExportBusy=false;if(ongoingNoteSelectionMode)updateOngoingNoteSelectionControls(ongoingNoteEntries());else renderOngoingNotes();notice.finish(success?'succeeded':statusError?'failed':'cancelled',status);}
      return success;
    }
    function setOngoingNotesStatus(message,{error=false,readOnly=false}={}){
      const status=document.getElementById('ongoing-notes-status');
      if(!status)return false;
      status.className='library-notes-status ui-status'+(error?' err':'')+(readOnly?' read-only':'');
      notifications.feedback({id:'ongoing-note-status',surfaceId:'ongoing-notes-status',surface:'inline',cue:'none',severity:error?'error':'info',lifecycle:message?(error?'failed':'succeeded'):'resolved',message:String(message||'')});
      return true;
    }
    function updateOngoingNoteActions(){
      const add=document.getElementById('library-note-add'),canAdd=canMutate()&&canCreateOngoingNote();
      if(!add)return;
      add.disabled=!canAdd;add.setAttribute('aria-disabled',canAdd?'false':'true');
      add.title=canAdd?'Create a note':'Notes are at their note limit';
    }
    function parentNotesSignature(entry){
      const byKey=new Map(ongoingNoteEntries().map(candidate=>[candidate.key,candidate])),parts=entry.key.split(' > '),out=[];
      for(let index=1;index<parts.length;index++){const key=parts.slice(0,index).join(' > ');out.push(`${key}\u0000${byKey.get(key)?.updatedAt||''}`);}
      return out.join('\u0001');
    }
    // Where the open note sits: each parent Area opens its own note.
    function noteBreadcrumb(entry){
      const crumbs=document.createElement('nav');crumbs.className='library-notes-crumbs';crumbs.setAttribute('aria-label','Location');
      const parts=labelParts(entry.label).slice(0,-1),keys=entry.key.split(' > ');
      parts.forEach((part,index)=>{
        const crumb=textEl('button','library-notes-crumb',part);crumb.type='button';crumb.title=`Open ${parts.slice(0,index+1).join(' › ')}`;
        crumb.addEventListener('click',()=>selectOngoingNote(keys.slice(0,index+1).join(' > ')));
        crumbs.append(crumb,textEl('span','library-notes-crumb-separator','›'));
      });
      crumbs.hidden=!parts.length;return crumbs;
    }
    // When it last changed and whether today's plan uses it.
    function noteMeta(entry,stored){
      if(entry.support)return 'Shared by every support block';
      if(entry.ephemeral)return 'New · saved when you write';
      const edited=stored&&stored.updatedAt?editedLabel(stored.updatedAt):'',parts=[];
      if(edited)parts.push(`Edited ${/^\d/u.test(edited)?edited:edited.toLowerCase()}`);
      if(entry.current)parts.push('In today’s plan');
      return parts.join(' · ')||'Nothing written yet';
    }
    // The title renames the note in place: Enter or leaving the field saves,
    // Escape keeps the old name.
    function noteTitle(entry,renameable){
      const title=textEl(renameable?'button':'div','library-notes-editor-title',ongoingNoteLeaf(entry.label));
      if(!renameable)return title;
      title.type='button';title.title='Rename';title.setAttribute('aria-label',`Rename ${ongoingNoteLeaf(entry.label)}`);
      title.addEventListener('click',()=>renameNoteInPlace(entry,title));
      return title;
    }
    function renameNoteInPlace(entry,title=document.querySelector('#library-notes-editor button.library-notes-editor-title')){
      if(!title||!title.isConnected||!canMutate())return false;
      const leaf=ongoingNoteLeaf(entry.label),input=document.createElement('input');
      input.type='text';input.className='library-notes-title-input ui-field';input.value=leaf;input.maxLength=160;input.setAttribute('aria-label','Note name');
      title.replaceWith(input);input.focus();input.select();
      let done=false;
      const finish=save=>{
        if(done)return;done=true;
        const next=input.value.trim();if(input.isConnected)input.replaceWith(title);
        if(!save||!next||next===leaf)return;
        const parent=ongoingNoteParentPath(entry.label);void applyNoteRename(entry,parent?`${parent} > ${next}`:next);
      };
      input.addEventListener('keydown',event=>{
        if(event.key==='Enter'){event.preventDefault();finish(true);}
        else if(event.key==='Escape'){event.preventDefault();event.stopPropagation();finish(false);title.focus();}
      });
      input.addEventListener('blur',()=>finish(true));
      return true;
    }
    async function printOngoingNote(entry){
      try{if(await printNote(entry.key,ongoingNoteLeaf(entry.label)))return true;setOngoingNotesStatus('Write something in this note before printing it.');return false;}
      catch(error){setOngoingNotesStatus('The note could not be printed: '+(error&&error.message||error),{error:true});return false;}
    }
    async function exportOngoingNote(entry){
      if(ongoingNoteExportBusy)return false;
      if(!entry||!getAreaNote(entry.key,entry.label)){setOngoingNotesStatus('Write something in this note before exporting it.');return false;}
      ongoingNoteExportBusy=true;
      const notice=notifications.begin({id:'ongoing-note-export',surfaceId:'ongoing-notes-status',title:'Export note',message:'Preparing the Markdown export…'});
      try{
        const result=await exportKeys([entry.key]);
        if(result&&(result.status==='downloaded'||result.status==='saved'))notice.finish('succeeded',`${result.status==='saved'?'Saved and verified':'Download started'}: “${entry.label}”${result.assets?` with ${result.assets} image${result.assets===1?'':'s'}`:''}.${result.missing?` ${result.missing} unavailable image(s) are marked in the note.`:''}`);
        else if(result&&result.status==='cancelled')notice.finish('cancelled','Export cancelled.');
        else if(result&&result.status==='too-large')notice.finish('failed',`This note is larger than the ${Math.round((Number(result.maxBytes)||0)/(1024*1024))} MiB export limit.`);
        else notice.finish('failed','This note had nothing to export.');
        return true;
      }catch(error){notice.finish('failed','The export did not complete: '+(error&&error.message||error));return false;}
      finally{ongoingNoteExportBusy=false;}
    }
    // Earlier versions come from the backups; restoring one shows the two
    // texts side by side first, so it also works for a note emptied by mistake.
    async function showNoteVersions(entry){
      const restored=value=>{const at=new Date(value.exportedAt);setOngoingNotesStatus(`Restored “${entry.label}” from the backup of ${Number.isFinite(at.getTime())?at.toLocaleString():'an earlier date'}.`);};
      const result=await openNoteVersions(freeze({id:String(entry.id||''),label:entry.label,text:String(getAreaNote(entry.key)?.text||''),onRestored:restored}));
      if(result?.reason==='no-source')setOngoingNotesStatus('Earlier versions come from your backups. Connect a Device Folder or Google Drive in Library → Data first.');
      else if(result?.reason==='busy')setOngoingNotesStatus('Another backup task is running. Try again when it finishes.');
      return result?.opened===true;
    }
    // The open note's own actions: rename or move, earlier versions, export
    // and delete. Support Activities keeps its name and is never deleted, so
    // it has none.
    function noteActionsMenu(entry){
      const trigger=textEl('button','library-note-tool ui-btn','⋯');trigger.type='button';trigger.id='library-note-actions';
      trigger.setAttribute('aria-label',`Actions for ${entry.label}`);trigger.setAttribute('aria-haspopup','menu');trigger.setAttribute('aria-expanded','false');trigger.title='Rename, move or delete this note';
      const menu=document.createElement('div');menu.className='library-note-menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label',`Actions for ${entry.label}`);
      const controller=createAnchoredPopover(menu,{align:'end',onClose:()=>trigger.setAttribute('aria-expanded','false')});
      const item=(id,label,hint,run,danger=false)=>{
        const button=document.createElement('button');button.type='button';button.id=id;button.className='library-note-menu-item'+(danger?' danger':'');button.setAttribute('role','menuitem');
        button.append(textEl('span','',label),textEl('span','library-note-menu-hint ui-mono',hint));
        button.addEventListener('click',()=>{controller.hide();void run();});return button;
      };
      const separator=document.createElement('div');separator.className='library-note-menu-separator';separator.setAttribute('role','separator');
      const rename=item('library-note-rename','Rename','F2',()=>renameNoteInPlace(entry)),move=item('library-note-move','Move…','',renameOngoingNote),exportNote=item('library-note-export-one','Export this note','',()=>exportOngoingNote(entry)),print=item('library-note-print','Print…','',()=>printOngoingNote(entry)),versions=item('library-note-versions','Earlier versions…','',()=>showNoteVersions(entry)),remove=item('library-note-delete','Delete','Del',deleteOngoingNote,true);
      menu.append(rename,move,versions,exportNote,print,separator,remove);
      trigger.addEventListener('click',event=>{
        event.preventDefault();
        if(!menu.hidden){controller.hide();return;}
        // A note becomes renameable once something of it is saved.
        const stored=!!getAreaNote(entry.key,entry.label);rename.disabled=move.disabled=exportNote.disabled=remove.disabled=versions.disabled=!stored||!canMutate();print.disabled=!stored;
        for(const button of [rename,move,exportNote,print,remove])if(!stored)button.title='Write something in this note first';else button.removeAttribute('title');
        controller.show(trigger);trigger.setAttribute('aria-expanded','true');
        requestAnimationFrame(()=>{const first=menu.querySelector('[role="menuitem"]:not(:disabled)');if(first)first.focus();});
      });
      return [trigger,menu];
    }
    function chooseOngoingNote(entries,filtered){
      const visible=(filtered||[]).find(entry=>entry.key===selectedOngoingNoteKey);
      if(visible)return visible;
      const preferred=(filtered||[]).find(entry=>entry.current&&entry.hasNote)
        ||(filtered||[]).find(entry=>entry.current)
        ||(filtered||[]).find(entry=>entry.hasNote)
        ||(filtered||[])[0]
        ||null;
      selectedOngoingNoteKey=preferred?preferred.key:'';
      return preferred;
    }
    // Builds the tree from the catalogue's depth-first order: each note's parent
    // is the nearest earlier note one level up.
    function ongoingNoteTree(entries){
      const nodes=entries.map(entry=>({entry,depth:Math.max(0,Number(entry.depth)||0),parent:null,children:0,holdsActive:false,expanded:false})),stack=[];
      for(const node of nodes){
        while(stack.length&&stack.at(-1).depth>=node.depth)stack.pop();
        node.parent=stack.at(-1)||null;if(node.parent)node.parent.children+=1;
        stack.push(node);
      }
      for(const node of nodes)if(node.entry.current||node.entry.key===selectedOngoingNoteKey)for(let up=node.parent;up&&!up.holdsActive;up=up.parent)up.holdsActive=true;
      for(const node of nodes)node.expanded=node.children>0&&(ongoingNoteSelectionMode||(ongoingNoteExpanded.has(node.entry.key)?ongoingNoteExpanded.get(node.entry.key):node.holdsActive));
      const visible=[];let closedAt=-1;
      for(const node of nodes){
        if(closedAt>=0&&node.depth>closedAt)continue;
        closedAt=-1;visible.push(node);
        if(node.children&&!node.expanded)closedAt=node.depth;
      }
      ongoingNoteTreeNodes=new Map(nodes.map(node=>[node.entry.key,node]));
      return visible;
    }
    // Opens every branch above a note, so it is shown however the tree was left.
    function expandOngoingNoteAncestors(key){
      const node=ongoingNoteTreeNodes.get(key);
      for(let up=node&&node.parent;up;up=up.parent)ongoingNoteExpanded.set(up.entry.key,true);
    }
    // Phones show the list or one note at a time: opening a note shows it full
    // width, and its back button returns to the list.
    function phoneLayout(){try{return !!window.matchMedia&&window.matchMedia('(max-width: 720px)').matches;}catch{return false;}}
    function openNoteView(){const drawer=notesSection();if(drawer&&phoneLayout()&&!ongoingNoteSelectionMode)drawer.classList.add('note-open');}
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
    function toggleOngoingNoteBranch(key,expanded){ongoingNoteExpanded.set(key,!!expanded);ongoingNoteFocusKey=key;renderOngoingNotes();return true;}
    function startOfLocalDay(time){const date=new Date(time);return new Date(date.getFullYear(),date.getMonth(),date.getDate()).getTime();}
    function daysBefore(value){const time=Date.parse(String(value||''));return Number.isFinite(time)?Math.max(0,Math.round((startOfLocalDay(Date.now())-startOfLocalDay(time))/86400000)):-1;}
    // When a note last changed: a time today, "Yesterday", then a date.
    function editedLabel(value){
      const days=daysBefore(value);if(days<0)return '';
      const date=new Date(Date.parse(value));
      if(days===0)return `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
      if(days===1)return 'Yesterday';
      return `${date.getDate()} ${LIBRARY_MONTHS[date.getMonth()]}${date.getFullYear()!==new Date().getFullYear()?` ${date.getFullYear()}`:''}`;
    }
    function deletedLabel(value){const days=daysBefore(value);return days<=0?'Deleted today':days===1?'Deleted yesterday':`Deleted ${days} days ago`;}
    function buildOngoingNoteTreeItem(node){
      const {entry}=node,active=entry.key===selectedOngoingNoteKey&&!selectedTrashKey,leaf=ongoingNoteLeaf(entry.label),row=document.createElement('div');
      row.className='library-note-nav-item library-note-tree-item '+(entry.hasNote?'has-note':'empty-note')+(entry.support?' support-note':'')+(active?' active':'');
      row.style.setProperty('--note-indent',`${Math.min(6,node.depth)*15}px`);
      row.dataset.ongoingNoteKey=entry.key;row.setAttribute('role','treeitem');row.setAttribute('aria-level',String(node.depth+1));row.setAttribute('aria-selected',active?'true':'false');
      row.setAttribute('aria-label',`${leaf}${entry.hasNote?'':', empty'}${entry.current?', in today’s plan':''}`);
      if(node.children)row.setAttribute('aria-expanded',node.expanded?'true':'false');
      row.tabIndex=-1;
      const twisty=textEl('span','library-note-twisty',node.children?(node.expanded?'▾':'▸'):'');twisty.setAttribute('aria-hidden','true');
      if(node.children)twisty.addEventListener('click',event=>{event.stopPropagation();toggleOngoingNoteBranch(entry.key,!node.expanded);});
      const meta=document.createElement('span');meta.className='library-note-nav-tags';
      if(entry.current)meta.appendChild(textEl('span','library-note-tag current','TODAY'));
      const edited=editedLabel(entry.updatedAt);if(edited)meta.appendChild(textEl('span','library-note-nav-edited',edited));
      row.append(twisty,textEl('span','library-note-nav-name',leaf),meta);
      row.addEventListener('click',()=>selectOngoingNote(entry.key));
      return row;
    }
    // Arrow keys move through the tree, Right and Left open and close a branch,
    // Enter opens a note and F2 renames it.
    function handleOngoingNoteTreeKey(event){
      const row=event.target&&event.target.closest?event.target.closest('[role="treeitem"]'):null;if(!row)return;
      const rows=[...document.querySelectorAll('#library-notes-list [role="treeitem"]')],index=rows.indexOf(row),key=row.dataset.ongoingNoteKey,node=ongoingNoteTreeNodes.get(key);
      const focusRow=target=>{if(!target)return;for(const item of rows)item.tabIndex=-1;target.tabIndex=0;target.focus();};
      if(event.key==='ArrowDown')focusRow(rows[index+1]);
      else if(event.key==='ArrowUp')focusRow(rows[index-1]);
      else if(event.key==='Home')focusRow(rows[0]);
      else if(event.key==='End')focusRow(rows.at(-1));
      else if(event.key==='ArrowRight'){if(!node||!node.children)return;if(node.expanded)focusRow(rows[index+1]);else toggleOngoingNoteBranch(key,true);}
      else if(event.key==='ArrowLeft'){if(node&&node.children&&node.expanded)toggleOngoingNoteBranch(key,false);else if(node&&node.parent)focusRow(rows.find(item=>item.dataset.ongoingNoteKey===node.parent.entry.key));else return;}
      else if(event.key==='Enter'||event.key===' '){ongoingNoteFocusKey=key;selectOngoingNote(key);}
      else if(event.key==='F2'){selectOngoingNote(key);const entry=selectedStoredNote();if(entry)renameNoteInPlace(entry);}
      else if(event.key==='Delete'){ongoingNoteFocusKey=key;selectOngoingNote(key);void deleteOngoingNote();}
      else return;
      event.preventDefault();
    }
    function ongoingNoteTrashItems(){
      return [...ongoingNoteTrash()].sort((a,b)=>String(a.label).localeCompare(String(b.label),undefined,{sensitivity:'base',numeric:true})||String(b.deletedAt).localeCompare(String(a.deletedAt)));
    }
    function buildTrashedNoteItem(item){
      const button=document.createElement('button');button.type='button';
      button.className='library-note-nav-item library-note-trash-item'+(item.hasNote?' has-note':' empty-note')+(item.key===selectedTrashKey?' active':'');
      button.dataset.trashKey=item.key;button.setAttribute('aria-current',item.key===selectedTrashKey?'true':'false');
      const parent=ongoingNoteParentPath(item.label);
      button.append(textEl('span','library-note-nav-name',ongoingNoteLeaf(item.label)),textEl('span','library-note-nav-edited',deletedLabel(item.deletedAt)));
      if(parent)button.append(textEl('span','library-note-nav-path',parent.replace(/\s*>\s*/g,' › ')));
      button.addEventListener('click',()=>selectTrashedNote(item.key));
      return button;
    }
    // Recently deleted sits at the bottom of the list and opens upward. It is
    // hidden while empty and during export.
    function renderOngoingNoteTrash(){
      const section=document.getElementById('library-notes-trash'),list=document.getElementById('library-notes-trash-list'),toggle=document.getElementById('library-notes-trash-toggle'),count=document.getElementById('library-notes-trash-count');
      if(!section||!list||!toggle)return;
      const items=ongoingNoteSelectionMode?[]:ongoingNoteTrashItems();
      section.hidden=!items.length;
      if(!items.length){ongoingNoteTrashOpen=false;list.replaceChildren();return;}
      if(count)count.textContent=`(${items.length})`;
      toggle.setAttribute('aria-expanded',ongoingNoteTrashOpen?'true':'false');list.hidden=!ongoingNoteTrashOpen;
      list.replaceChildren(...(ongoingNoteTrashOpen?items.map(buildTrashedNoteItem):[]));
    }
    function toggleOngoingNoteTrash(){
      ongoingNoteTrashOpen=!ongoingNoteTrashOpen;
      if(ongoingNoteTrashOpen&&canMutate())purgeExpiredOngoingNotes();
      renderOngoingNotes();return true;
    }
    function selectTrashedNote(key){
      if(!ongoingNoteTrashItems().some(item=>item.key===key))return false;
      if(pendingOngoingNote){pendingOngoingNote=null;invalidateAttachments();}
      selectedTrashKey=key;renderOngoingNotes();openNoteView();return true;
    }
    function buildOngoingNoteNavItem(entry,selectionIndex){
      if(ongoingNoteSelectionMode){
        const state=ongoingNoteSelectionState(entry,selectionIndex),row=document.createElement('div');
        row.className='library-note-nav-item library-note-select-item '+(entry.hasNote?'has-note':'empty-note')+(entry.support?' support-note':'')+(entry.key===selectedOngoingNoteKey?' active':'')+(state.checked?' selected':'')+(state.indeterminate?' partial':'');
        row.style.setProperty('--note-indent',`${Math.min(6,Math.max(0,Number(entry.depth)||0))*15}px`);row.dataset.ongoingNoteKey=entry.key;
        const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.className='library-note-checkbox';checkbox.checked=state.checked;checkbox.indeterminate=state.indeterminate;checkbox.disabled=!state.keys.length;checkbox.setAttribute('aria-label',state.keys.length?`Select ${entry.label}${state.keys.length>1?' and nested notes':''} for export`:`${entry.label} has no saved note to export`);checkbox.addEventListener('change',()=>toggleOngoingNoteSelection(entry.key));
        const body=document.createElement('button');body.type='button';body.className='library-note-select-copy';body.setAttribute('aria-label',`Preview ${entry.label}`);body.setAttribute('aria-current',entry.key===selectedOngoingNoteKey?'true':'false');
        const name=textEl('span','library-note-nav-name',ongoingNoteLeaf(entry.label)),tags=document.createElement('span');tags.className='library-note-nav-tags';
        const noteTag=textEl('span','library-note-tag note','NOTE');noteTag.hidden=!entry.hasNote;tags.appendChild(noteTag);if(entry.current)tags.appendChild(textEl('span','library-note-tag current','TODAY'));
        const pathLabel=entry.support?'Shared support note':ongoingNoteParentPath(entry.label);
        body.append(name,tags);if(pathLabel)body.append(textEl('span','library-note-nav-path',pathLabel));body.addEventListener('click',()=>selectOngoingNote(entry.key));row.append(checkbox,body);return row;
      }
      const button=document.createElement('button');
      button.type='button';
      button.className='library-note-nav-item '+(entry.hasNote?'has-note':'empty-note')+(entry.support?' support-note':'')+(entry.key===selectedOngoingNoteKey?' active':'');
      button.dataset.ongoingNoteKey=entry.key;
      button.setAttribute('aria-label',`Open ${entry.hasNote?'saved':'empty'} note for ${entry.label}`);
      button.setAttribute('aria-current',entry.key===selectedOngoingNoteKey?'true':'false');
      const name=textEl('span','library-note-nav-name',ongoingNoteLeaf(entry.label));
      const tags=document.createElement('span');tags.className='library-note-nav-tags';
      if(entry.current)tags.appendChild(textEl('span','library-note-tag current','TODAY'));
      const edited=editedLabel(entry.updatedAt);if(edited)tags.appendChild(textEl('span','library-note-nav-edited',edited));
      const pathLabel=entry.support?'Shared support note':ongoingNoteParentPath(entry.label);
      button.append(name,tags);if(pathLabel)button.append(textEl('span','library-note-nav-path',pathLabel));
      button.addEventListener('click',()=>selectOngoingNote(entry.key));
      return button;
    }
    function requestSelectedOngoingNoteReveal(){
      if(ongoingNoteRevealFrame)return;
      ongoingNoteRevealFrame=requestAnimationFrame(()=>{
        ongoingNoteRevealFrame=0;
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
    function ongoingNoteEditorRenderSignature(entry,canonical,readOnly,writable){
      if(!entry)return `empty|${readOnly?'1':'0'}`;
      return [
        entry.key,entry.label,entry.support?'1':'0',entry.current?'1':'0',entry.ephemeral?'1':'0',entry.hasNote?'1':'0',
        // A change to the text from elsewhere re-renders the note; a change to
        // its linked notes refreshes only the bar.
        readOnly?'1':'0',writable?'1':'0',String(canonical?.text||'')
      ].join('\u0000');
    }
    function renderOngoingNoteEditor(entry,readOnly=false){
      const panel=document.getElementById('library-notes-editor');
      if(!panel)return false;
      const canonical=entry?getAreaNote(entry.key,entry.label):null,richValue=String(canonical?.text||''),value=richValue?plainTextContent(richValue):'';
      const writable=canMutate()&&!readOnly,signature=ongoingNoteEditorRenderSignature(entry,canonical,readOnly,writable);
      updateOngoingNoteActions();
      // Parent notes can change while this one stays open: refresh only their
      // sections, never the editor.
      const parents=entry?parentNotesSignature(entry):'';
      if(signature===ongoingNoteEditorSignature&&panel.childElementCount){
        if(entry&&parents!==ongoingNoteParentSignature){ongoingNoteParentSignature=parents;const box=panel.querySelector('.subject-note-context');if(box)renderInherited(box,entry.key,false,{collapsible:true});}
        panel.querySelector('.note-links')?.refresh?.();
        const meta=panel.querySelector('.library-notes-editor-meta');if(entry&&meta)meta.textContent=noteMeta(entry,canonical);
        return !!entry;
      }
      const previous=ongoingNotesEditorField();
      if(previous)clearEditor(previous);
      ongoingNoteEditorSignature=signature;ongoingNoteParentSignature=parents;
      if(!entry){
        panel.replaceChildren(textEl('div','library-notes-editor-empty ui-status','No notes match this search.'));
        return false;
      }
      const head=document.createElement('div');head.className='library-notes-editor-head';
      const renameable=writable&&!entry.support&&!!canonical,meta=textEl('span','library-notes-editor-meta ui-mono',noteMeta(entry,canonical));
      const copy=document.createElement('div');copy.className='library-notes-editor-identity';
      copy.append(noteBreadcrumb(entry),noteTitle(entry,renameable),meta);
      const headTools=document.createElement('div');headTools.className='library-notes-editor-tools';
      if(!readOnly){
        const syncMessage=writable?'Synced':'Read-only in this tab';
        const sync=textEl('div',`note-sync ui-label${writable?'':' idle'}`,writable?'✓':'—');
        sync.dataset.areaKey=entry.key;sync.setAttribute('role','status');sync.setAttribute('aria-atomic','true');sync.setAttribute('aria-label',syncMessage);sync.tabIndex=0;headTools.append(sync);
        if(writable&&!entry.support)headTools.append(...noteActionsMenu(entry));
      }
      head.append(noteViewBackButton(),copy,headTools);
      const inherited=document.createElement('div');renderInherited(inherited,entry.key,false,{collapsible:true});
      if(readOnly){
        const preview=document.createElement('div');preview.className='library-ongoing-note-read';
        if(!richValue.trim()){preview.classList.add('empty');preview.textContent='No content saved for this Area.';}else renderRichTextContent(preview,richValue,'No content saved for this Area.',`Note for ${entry.label}`);
        panel.replaceChildren(head,preview,inherited);return true;
      }
      const editorShell=document.createElement('div');editorShell.className='library-notes-editor-shell';
      const editor=document.createElement('textarea');
      editor.className='library-notes-textarea ui-field task-note-field';
      editor.placeholder=entry.support?'Ongoing reminders, decisions, follow-ups, and routine notes shared across support activities…':'Ongoing reminders, doubts, mistakes, ideas, and points to revisit for this subject/Area…';
      editor.value=value;editorShell.appendChild(editor);
      bindEditor(editor,entry.key,entry.label,'library');
      const matches=document.createElement('div');matches.className='library-note-matches';matches.id='library-note-matches';matches.hidden=true;matches.setAttribute('role','status');
      const matchTool=(text,label,run)=>{const button=textEl('button','library-note-tool ui-btn',text);button.type='button';button.setAttribute('aria-label',label);button.title=label;button.addEventListener('click',run);return button;};
      matches.append(textEl('span','library-note-matches-count ui-mono',''),matchTool('↑','Previous match',()=>stepNoteMatch(-1)),matchTool('↓','Next match',()=>stepNoteMatch(1)),matchTool('×','Clear highlights',clearNoteMatches));
      // Linked notes sit under the text, out of the way until used.
      const links=linksBar({ref:canonical?.id||entry.key,label:entry.label,onOpen:revealNoteReference});
      panel.replaceChildren(head,matches,editorShell,links,inherited);noteSearchLanded='';
      setOngoingNotesStatus(writable?'':'Another tab has control. Browse freely, or take control before editing.',{readOnly:!writable});
      editor.addEventListener('input',event=>{
        const accepted=commitEditor(editor,editor.value,event);
        if(!accepted)return;
        const refreshed=getAreaNote(entry.key,entry.label);
        ongoingNoteEditorSignature=ongoingNoteEditorRenderSignature({...entry,hasNote:!!String(editor.value||'').trim()},refreshed,false,canMutate());
        meta.textContent=noteMeta({...entry,ephemeral:false},refreshed);
        const hasNote=!!String(editor.value||'').trim();
        const row=[...document.querySelectorAll('[data-ongoing-note-key]')].find(candidate=>candidate.dataset.ongoingNoteKey===entry.key);
        if(row){
          row.classList.toggle('has-note',hasNote);
          row.classList.toggle('empty-note',!hasNote);
          const tag=row.querySelector('.library-note-tag.note');if(tag)tag.hidden=!hasNote;
        }
        updateOngoingNoteActions();
      });
      return true;
    }
    // A deleted note opens read-only, with Restore and Delete forever.
    function renderTrashedNote(item){
      const panel=document.getElementById('library-notes-editor');if(!panel)return false;
      const stored=getAreaNote(item.key,item.label),text=String(stored&&stored.text||''),signature=`trash\u0000${item.key}\u0000${String(stored&&stored.updatedAt||'')}\u0000${canMutate()?'1':'0'}`;
      updateOngoingNoteActions();
      if(signature===ongoingNoteEditorSignature&&panel.childElementCount)return true;
      const previous=ongoingNotesEditorField();if(previous)clearEditor(previous);
      ongoingNoteEditorSignature=signature;
      const head=document.createElement('div');head.className='library-notes-editor-head';
      const copy=document.createElement('div');copy.className='library-notes-editor-identity';
      copy.append(textEl('div','library-notes-editor-title',ongoingNoteLeaf(item.label)),textEl('span','library-notes-editor-meta ui-mono',`${deletedLabel(item.deletedAt)} · ${item.label.replace(/\s*>\s*/g,' › ')}`));
      const tools=document.createElement('div');tools.className='library-notes-editor-tools';
      const restore=textEl('button','library-note-action ui-btn','Restore'),forget=textEl('button','library-note-action danger ui-btn','Delete forever');
      restore.type='button';forget.type='button';restore.disabled=forget.disabled=!canMutate();
      restore.addEventListener('click',()=>{void restoreTrashedNote(item.key);});forget.addEventListener('click',()=>{void deleteTrashedNoteForever(item.key);});
      tools.append(restore,forget);head.append(noteViewBackButton(),copy,tools);
      const preview=document.createElement('div');preview.className='library-ongoing-note-read';
      if(!text.trim()){preview.classList.add('empty');preview.textContent='This note was empty.';}else renderRichTextContent(preview,text,'This note was empty.',`Deleted note ${item.label}`);
      panel.replaceChildren(head,preview);
      setOngoingNotesStatus(`Deleted notes are kept for 30 days.`);
      return true;
    }
    function renderOngoingNotes(){
      if(attachmentMutationHold){attachmentMutationNeedsNotes=true;return false;}
      if(!notesShown())return false;
      const entries=ongoingNoteEntries();
      clearNoteSearchTimer();
      const query=ongoingNotesSearch(),searchState=filterOngoingNoteEntries(entries,query),tagKeys=noteTagFilter.length?taggedNotes(noteTagFilter):null;
      const filtered=tagKeys?searchState.entries.filter(entry=>tagKeys.has(entry.key)):searchState.entries,filtering=!!query||!!tagKeys;
      updateOngoingNoteSelectionControls(entries);renderNoteTags();
      const trashed=selectedTrashKey&&!ongoingNoteSelectionMode?ongoingNoteTrashItems().find(item=>item.key===selectedTrashKey)||null:null;
      if(!trashed)selectedTrashKey='';
      const selected=chooseOngoingNote(entries,filtered),selectionIndex=ongoingNoteSelectionMode?ongoingNoteSelectionIndex(entries):null;
      const list=document.getElementById('library-notes-list');
      if(list){
        // Search shows matches with their paths; otherwise the tree.
        const tree=!filtering&&noteSort==='name',flat=noteSort==='recent'?[...filtered].sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||''))):filtered;
        const nodes=tree?ongoingNoteTree(entries):flat.map(entry=>({entry})),activeIndex=nodes.findIndex(node=>node.entry.key===selectedOngoingNoteKey);
        if(activeIndex>=ongoingNoteVisibleLimit)ongoingNoteVisibleLimit=Math.ceil((activeIndex+1)/ONGOING_NOTE_PAGE_SIZE)*ONGOING_NOTE_PAGE_SIZE;
        const shown=nodes.slice(0,ongoingNoteVisibleLimit),rows=shown.map(node=>ongoingNoteSelectionMode||!tree?buildOngoingNoteNavItem(node.entry,selectionIndex):buildOngoingNoteTreeItem(node));
        if(nodes.length>shown.length){
          const more=textEl('button','library-notes-more ui-btn',`Show ${Math.min(nodes.length-shown.length,ONGOING_NOTE_PAGE_SIZE)} more`);more.type='button';
          more.addEventListener('click',()=>{ongoingNoteVisibleLimit+=ONGOING_NOTE_PAGE_SIZE;renderOngoingNotes();});rows.push(more);
        }
        if(tree&&!ongoingNoteSelectionMode){list.setAttribute('role','tree');list.setAttribute('aria-label','Notes');}else{list.removeAttribute('role');list.removeAttribute('aria-label');}
        if(filtered.length)list.replaceChildren(...rows);
        else list.replaceChildren(textEl('div','library-notes-zero ui-status',query?'No notes match this search.':'No notes have all of these tags.'));
        const focusable=list.querySelector('[role="treeitem"].active')||list.querySelector('[role="treeitem"]');if(focusable)focusable.tabIndex=0;
        if(ongoingNoteFocusKey){const target=[...list.querySelectorAll('[role="treeitem"]')].find(row=>row.dataset.ongoingNoteKey===ongoingNoteFocusKey);ongoingNoteFocusKey='';if(target){for(const row of list.querySelectorAll('[role="treeitem"]'))row.tabIndex=-1;target.tabIndex=0;target.focus();}}
      }
      setTextSafe('library-notes-nav-count',filtering?(searchState.pending?`Searching… / ${entries.length}`:`${filtered.length} / ${entries.length}`):String(entries.length));
      renderOngoingNoteTrash();
      if(ongoingNoteSelectionMode){renderOngoingNoteEditor(selected,true);setOngoingNotesStatus('Selection is temporary. Export does not change or sync your saved notes.');}
      else if(trashed)renderTrashedNote(trashed);
      else renderOngoingNoteEditor(selected);
      requestSelectedOngoingNoteReveal();landOnNoteSearch();return true;
    }
    // Opening a note while searching marks every match in it and scrolls to the
    // first. Arrows or Enter step through them; an edit or Escape clears them.
    function landOnNoteSearch(){
      const query=ongoingNotesSearch(),field=ongoingNotesEditorField(),target=query&&field&&!selectedTrashKey?`${selectedOngoingNoteKey}\u0000${query}`:'';
      if(target===noteSearchLanded)return;noteSearchLanded=target;
      if(!target){if(field)clearFind(field);showNoteMatches(0);return;}
      void findInEditor(field,query,()=>{if(noteSearchLanded===target)showNoteMatches(0);}).then(count=>{if(noteSearchLanded===target)showNoteMatches(count,0);}).catch(()=>{});
    }
    function showNoteMatches(count,index=0){
      const bar=document.getElementById('library-note-matches');if(!bar)return;
      bar.hidden=!count;if(count)bar.querySelector('.library-note-matches-count').textContent=`${index+1} of ${count}`;
    }
    function stepNoteMatch(direction){const field=ongoingNotesEditorField();if(!field)return false;const {index,count}=findStep(field,direction);showNoteMatches(count,index);return count>0;}
    function clearNoteMatches(){const field=ongoingNotesEditorField();if(field)clearFind(field);showNoteMatches(0);}
    function requestOngoingNotesRender(){
      if(attachmentMutationHold){attachmentMutationNeedsNotes=true;return false;}
      if(ongoingNoteRenderFrame)return false;
      ongoingNoteRenderFrame=requestAnimationFrame(()=>{ongoingNoteRenderFrame=0;renderOngoingNotes();});return true;
    }
    function selectOngoingNote(key){
      const match=ongoingNoteEntries().find(entry=>entry.key===String(key||''));
      if(!match)return false;
      if(pendingOngoingNote&&match.key!==pendingOngoingNote.key){pendingOngoingNote=null;invalidateAttachments();}
      selectedOngoingNoteKey=match.key;selectedTrashKey='';
      renderOngoingNotes();openNoteView();
      return true;
    }
    // Attachments name the note they sit in by its permanent id.
    function revealNoteReference(key){
      const target=String(key||''),match=ongoingNoteEntries().find(entry=>entry.id===target||entry.key===target);
      if(!match)return false;
      const search=document.getElementById('library-notes-search');
      if(search&&search.value)search.value='';
      resetNoteSearch();
      if(noteTagFilter.length&&!taggedNotes(noteTagFilter).has(match.key))noteTagFilter=[];
      if(ongoingNoteSelectionMode&&!ongoingNoteExportBusy){ongoingNoteSelectionMode=false;ongoingNoteSelection.clear();}
      showSection('notes');
      selectedOngoingNoteKey=match.key;selectedTrashKey='';
      ongoingNoteTree(ongoingNoteEntries());expandOngoingNoteAncestors(match.key);
      renderOngoingNotes();openNoteView();
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        const row=[...document.querySelectorAll('[data-ongoing-note-key]')].find(candidate=>candidate.dataset.ongoingNoteKey===match.key);
        if(row)row.scrollIntoView({block:'nearest'});
        const editor=document.getElementById('library-notes-editor');if(editor)editor.scrollIntoView({block:'nearest'});
      }));
      return true;
    }
    // The tag list: picked tags first, then the most used, with a count each;
    // More shows the rest. Picks narrow the list to notes with all of them;
    // Clear shows every note again.
    function renderNoteTags(){
      const row=document.getElementById('library-notes-tags');if(!row)return;
      const all=noteTags(),writable=canMutate(),signature=`${noteTagFilter.join('\u0000')}\u0001${writable?'1':'0'}\u0001${noteTagsExpanded?'1':'0'}`;
      if(all===noteTagsRendered&&signature===noteTagsSignature)return;
      noteTagsRendered=all;noteTagsSignature=signature;
      const counts=new Map(all.map(item=>[item.tag,item.count])),picked=new Set(noteTagFilter),chips=[];
      const tool=(text,label,run)=>{const button=textEl('button','library-tag-tool ui-btn',text);button.type='button';button.setAttribute('aria-label',label);button.title=label;button.addEventListener('click',run);return button;};
      if(picked.size)chips.push(tool('× Clear','Show all notes',clearNoteTags));
      if(picked.size===1&&writable)chips.push(tool('Rename',`Rename #${noteTagFilter[0]} in every note`,()=>{void renameSelectedTag();}));
      const others=[...all].filter(item=>!picked.has(item.tag)).sort((a,b)=>b.count-a.count||a.tag.localeCompare(b.tag)).map(item=>item.tag);
      const shown=noteTagsExpanded?others:others.slice(0,NOTE_TAGS_SHOWN),hidden=others.length-shown.length;
      for(const tag of [...noteTagFilter,...shown]){
        const on=picked.has(tag),chip=textEl('button',`library-tag-chip ui-btn${on?' active':''}`,'');chip.type='button';chip.setAttribute('aria-pressed',on?'true':'false');
        chip.append(textEl('span','library-tag-name',`#${tag}`),textEl('span','library-tag-count ui-mono',String(counts.get(tag)||0)));
        chip.addEventListener('click',()=>toggleNoteTag(tag));chips.push(chip);
      }
      if(hidden>0||noteTagsExpanded&&others.length>NOTE_TAGS_SHOWN)chips.push(tool(hidden>0?`+${hidden} more`:'Fewer',hidden>0?'Show every tag':'Show the most used tags',()=>{noteTagsExpanded=!noteTagsExpanded;renderNoteTags();}));
      row.replaceChildren(...chips);row.hidden=!chips.length;
    }
    function setNoteTagFilter(tags){noteTagFilter=tags;ongoingNoteVisibleLimit=ONGOING_NOTE_PAGE_SIZE;renderOngoingNotes();}
    function toggleNoteTag(tag){setNoteTagFilter(noteTagFilter.includes(tag)?noteTagFilter.filter(other=>other!==tag):[...noteTagFilter,tag]);}
    function clearNoteTags(){setNoteTagFilter([]);}
    // A tag tapped in a note's text shows the notes with it. From the open
    // note the list changes behind it; from elsewhere the list is shown.
    function filterTag(tag,{show=false}={}){
      const name=normalizeTag(tag);if(!name)return false;
      const search=document.getElementById('library-notes-search');if(search&&search.value){search.value='';resetNoteSearch();}
      showSection('notes');setNoteTagFilter([name]);if(show)closeNoteView();return true;
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
      const notice=notifications.begin({id:'note-tag-rename',surfaceId:'ongoing-notes-status',title:'Rename tag',message:`Renaming #${from}…`});
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
      const open=ongoingNoteEntries().find(entry=>entry.key===selectedOngoingNoteKey&&!entry.support&&!entry.ephemeral)||null;
      let parent='';
      if(open){
        const where=await choose({title:list.length===1?'Import 1 file':`Import ${list.length} files`,message:'Each file becomes a new note named after it.',cancelLabel:'Cancel',choices:[
          {value:'inside',label:`Inside ${ongoingNoteLeaf(open.label)}`,kind:'primary',description:`Under ${open.label.replace(/\s*>\s*/g,' › ')}.`},
          {value:'top',label:'At the top level',description:'As notes of their own.'}
        ]});
        if(!where)return false;parent=where==='inside'?open.label:'';
      }
      const notice=notifications.begin({id:'note-import',surfaceId:'ongoing-notes-status',title:'Import notes',message:`Importing ${list.length===1?'1 file':`${list.length} files`}…`});
      let result;try{result=await importNoteFiles(list,parent);}catch(error){notice.finish('failed',error?.message||'The files could not be imported.');return false;}
      const made=result.made||[],skipped=result.skipped||[];
      if(made.length)revealNoteReference(made[0].id);
      const parts=[];if(made.length)parts.push(`Imported ${made.length} ${made.length===1?'note':'notes'}.`);if(skipped.length)parts.push(`Not imported: ${skipped.join('; ')}.`);
      notice.finish(made.length&&!skipped.length?'succeeded':'failed',parts.join(' ')||'Nothing was imported.');
      return made.length>0;
    }
    async function createOngoingNote(){
      if(!canMutate())return false;
      if(!canCreateOngoingNote()){
        setOngoingNotesStatus('Notes are at their note limit. Delete a note to make room.',{error:true});
        return false;
      }
      const selected=ongoingNoteEntries().find(entry=>entry.key===selectedOngoingNoteKey)||null;
      const options=selected?[
        {value:'nested',label:`Inside ${ongoingNoteLeaf(selected.label)}`,description:`Creates a child under ${selected.label}.`},
        {value:'top',label:'At top level',description:'Creates an independent Area.'}
      ]:[];
      const result=await requestInput({
        title:'New note',
        message:selected?'Choose where the new note belongs, then give its Area or topic a clear name.':'Give the new Area or topic a clear name.',
        inputLabel:'Area or topic name',placeholder:'For example: Cardiology',maxLength:160,required:true,
        requiredMessage:'Enter an Area or topic name.',
        options,optionLabel:'Note location',defaultOption:selected?'nested':'top',
        hint:'The note becomes saved after you write something in its editor. Matching Areas in Plan, Execute and Review will share it.',
        preview:(value,scope)=>{
          const name=String(value||'').trim();
          if(!name)return selected&&scope==='nested'?`${selected.label} › …`:'New top-level Area';
          return selected&&scope==='nested'?`${selected.label} › ${name.replace(/\s*>\s*/g,' › ')}`:name.replace(/\s*>\s*/g,' › ');
        },
        validate:(value,scope)=>{
          const rawValue=selected&&scope==='nested'?`${selected.label} > ${value}`:value;
          return normalizeOngoingNoteArea(rawValue)?'':'Enter a valid Area or topic name.';
        },
        confirmLabel:'Create note',cancelLabel:'Cancel'
      });
      if(!result||!canMutate())return false;
      const raw=selected&&result.option==='nested'?`${selected.label} > ${result.value}`:result.value;
      const identity=normalizeOngoingNoteArea(raw);
      if(!identity){
        setOngoingNotesStatus('Enter a valid Area name. Use > only to separate nested Areas.',{error:true});
        return false;
      }
      const existing=ongoingNoteCatalogue().find(entry=>entry.key===identity.key);
      pendingOngoingNote=existing?null:Object.freeze({
        key:identity.key,label:identity.label,text:'',hasNote:false,current:false,updatedAt:'',ephemeral:true
      });
      selectedOngoingNoteKey=identity.key;selectedTrashKey='';
      invalidateAttachments();
      const search=document.getElementById('library-notes-search');
      if(search&&search.value)search.value='';
      ongoingNoteTree(ongoingNoteEntries());expandOngoingNoteAncestors(identity.key);
      renderOngoingNotes();openNoteView();
      const editor=ongoingNotesEditorField();
      if(editor)requestAnimationFrame(()=>requestAnimationFrame(()=>{if(document.contains(editor))focusEditor(editor);}));
      const notice=notifications.begin({id:'ongoing-note-create',surfaceId:'ongoing-notes-status',title:existing?'Existing note opened':'New note ready',announce:false});
      notice.finish('succeeded',existing?`Opened the existing Area “${identity.label}”.`:`New Area “${identity.label}” is ready. It will be saved when you write a note.`);
      return true;
    }
    function selectedStoredNote(){
      const entry=ongoingNoteEntries().find(candidate=>candidate.key===selectedOngoingNoteKey)||null;
      return entry&&!selectedTrashKey&&!entry.support&&getAreaNote(entry.key,entry.label)?entry:null;
    }
    // Deleting moves a note to Recently deleted at once; Undo puts it back.
    async function deleteOngoingNote(){
      if(!canMutate())return false;
      const entry=selectedStoredNote();
      if(!entry){setOngoingNotesStatus('Select a saved note before deleting it.');return false;}
      const notice=notifications.begin({id:'ongoing-note-delete',surfaceId:'ongoing-notes-status',title:'Delete note',message:'Moving the note to Recently deleted…'});
      let trashKey;
      try{trashKey=await trashNote(entry.key);}
      catch(error){notice.finish('failed',error&&error.message||'The note could not be deleted because browser storage could not be updated. Keep this tab open and retry.');return false;}
      if(trashKey===null){notice.finish('cancelled','No note was deleted.');return false;}
      if(pendingOngoingNote&&pendingOngoingNote.key===entry.key)pendingOngoingNote=null;
      renderOngoingNotes();closeNoteView();
      if(!trashKey){notice.finish('succeeded',`Removed the empty note “${entry.label}”.`);return true;}
      notice.finish('succeeded',`Moved “${entry.label}” to Recently deleted.`,{action:{label:'Undo',run:()=>{void restoreTrashedNote(trashKey);}}});
      return true;
    }
    async function restoreTrashedNote(trashKey){
      if(!canMutate())return false;
      const item=ongoingNoteTrashItems().find(candidate=>candidate.key===trashKey);if(!item)return false;
      const notice=notifications.begin({id:'ongoing-note-restore',surfaceId:'ongoing-notes-status',title:'Restore note',message:'Restoring the note…'});
      let key;
      try{key=await restoreNote(trashKey);}
      catch(error){notice.finish('failed',error&&error.message||'The note could not be restored. Keep this tab open and retry.');return false;}
      if(!key){notice.finish('failed',`“${item.label}” could not be restored: every “(restored)” name is taken.`);return false;}
      selectedTrashKey='';selectedOngoingNoteKey=key;
      ongoingNoteTree(ongoingNoteEntries());expandOngoingNoteAncestors(key);renderOngoingNotes();
      const restored=ongoingNoteEntries().find(entry=>entry.key===key);
      notice.finish('succeeded',restored&&restored.label!==item.label?`Restored “${item.label}” as “${restored.label}”, beside the note that now uses its name.`:`Restored “${item.label}”.`);
      return true;
    }
    async function deleteTrashedNoteForever(trashKey){
      if(!canMutate())return false;
      const item=ongoingNoteTrashItems().find(candidate=>candidate.key===trashKey);if(!item)return false;
      const accepted=await confirm({title:'Delete this note forever?',danger:true,message:`“${item.label}” will be removed for good. This cannot be undone.`,details:['Existing backups are unchanged.'],confirmLabel:'Delete forever',cancelLabel:'Keep it'});
      if(!accepted||!canMutate())return false;
      const notice=notifications.begin({id:'ongoing-note-forget',surfaceId:'ongoing-notes-status',title:'Delete forever',message:'Deleting the note…'});
      try{if(!await removeOngoingNote(trashKey)){notice.finish('cancelled','No note was deleted.');return false;}}
      catch(error){notice.finish('failed',error&&error.message||'The note could not be deleted. Keep this tab open and retry.');return false;}
      selectedTrashKey='';renderOngoingNotes();closeNoteView();
      notice.finish('succeeded',`Deleted “${item.label}” forever.`);
      return true;
    }
    // Renames or moves a note with every note inside it. A name that already
    // holds a note is merged only after the person agrees.
    // Move… asks for the full name: "GS2 > Polity" places the note under GS2.
    async function renameOngoingNote(){
      if(!canMutate())return false;
      const entry=selectedStoredNote();
      if(!entry){setOngoingNotesStatus('Select a saved note to move it.');return false;}
      const nested=ongoingNoteEntries().some(candidate=>candidate.key.startsWith(`${entry.key} > `)),use=planAreaUse(entry.key),where=planAreaPlaces(use);
      const result=await requestInput({
        title:'Move note',
        message:'Type the full name, using > to place it inside another Area, for example “GS2 > Polity”.',
        inputLabel:'Full name',defaultValue:entry.label,maxLength:160,required:true,requiredMessage:'Enter a name.',
        hint:[nested?'Notes inside it move with it.':'','Finished days keep the name they were recorded with.'].filter(Boolean).join(' '),
        checkbox:where?{label:`Also rename it in ${where}`,description:'Unticked, those blocks keep the old name and start a new note under it.',defaultChecked:true}:null,
        preview:value=>String(value||'').trim().replace(/\s*>\s*/g,' › ')||'…',
        validate:value=>normalizeOngoingNoteArea(value)?'':'Enter a valid name. Use > only to separate nested Areas.',
        confirmLabel:'Move',cancelLabel:'Cancel'
      });
      if(!result||!canMutate())return false;
      return applyNoteRename(entry,result.value,{inPlans:!where||result.checked===true});
    }
    // Where a note's Area is used: "today’s plan", "2 saved plans", or both.
    function planAreaPlaces(use){
      const parts=[use&&use.today?'today’s plan':'',use&&use.savedPlans?`${use.savedPlans===1?'a saved plan':`${use.savedPlans} saved plans`}`:''].filter(Boolean);
      return parts.join(' and ');
    }
    // Renames or moves the note; with inPlans (the default, and the rename
    // dialog's tick box) the Area in today's plan and saved plans follows it.
    async function applyNoteRename(entry,value,{inPlans=true}={}){
      const identity=normalizeOngoingNoteArea(value);
      if(!identity||identity.label===entry.label||!canMutate())return false;
      const where=planAreaPlaces(planAreaUse(entry.key));
      const notice=notifications.begin({id:'ongoing-note-rename',surfaceId:'ongoing-notes-status',title:'Rename note',message:'Renaming the note…'});
      try{
        let outcome=await renameNote(entry.key,identity.label,{merge:false});
        if(outcome.status==='collision'){
          const into=outcome.labels[0]||identity.label,others=outcome.labels.length-1;
          const accepted=await confirm({title:'Merge notes?',message:`Merge “${entry.label}” into “${into}”? Its text is added to the end of “${into}”.`,details:others>0?[`${others} more note${others===1?'':'s'} inside it ${others===1?'is':'are'} merged the same way.`]:[],confirmLabel:'Merge',cancelLabel:'Cancel'});
          if(!accepted||!canMutate()){notice.finish('cancelled','Nothing was renamed.');return false;}
          outcome=await renameNote(entry.key,identity.label,{merge:true});
        }
        if(outcome.status!=='renamed'){
          notice.finish('failed',outcome.status==='inside-itself'?'A note cannot move inside itself.':outcome.status==='content-limit'?`Merging would make “${outcome.label}” longer than one note can be. Nothing was changed.`:'The note could not be renamed. Nothing was changed.');
          return false;
        }
        let plans='';
        if(where&&inPlans){await renameAreaInPlans(entry.key,identity.label);plans=` ${where.charAt(0).toUpperCase()+where.slice(1)} now ${where.includes(' and ')||/^\d/.test(where)?'use':'uses'} the new name.`;}
        else if(where)plans=` ${where.charAt(0).toUpperCase()+where.slice(1)} still ${where.includes(' and ')||/^\d/.test(where)?'use':'uses'} the old name.`;
        selectedOngoingNoteKey=outcome.key;ongoingNoteTree(ongoingNoteEntries());expandOngoingNoteAncestors(outcome.key);renderOngoingNotes();
        const moved=outcome.moved.length-1;
        notice.finish('succeeded',`${outcome.merged?'Merged into':'Renamed to'} “${identity.label}”${moved>0?`, with ${moved} note${moved===1?'':'s'} inside it`:''}.${plans}`);
        return true;
      }catch(error){notice.finish('failed',error&&error.message||'The note could not be renamed. Keep this tab open and retry.');return false;}
    }
    function clearOngoingNotesEditorBinding(){
      ongoingNoteEditorSignature='';ongoingNoteParentSignature='';noteSearchLanded='';
      const field=ongoingNotesEditorField();
      if(field)clearEditor(field);
    }
    function refreshOngoingNotes(){
      if(attachmentMutationHold){attachmentMutationNeedsNotes=true;return false;}
      if(noteSearchWorker)stopNoteSearch();
      if(notesShown())return renderOngoingNotes();
      clearOngoingNotesEditorBinding();
      idleNoteSearch();
      return false;
    }
    function installOngoingNotesWorkspace(){
      if(ongoingNotesInstalled)return;
      ongoingNotesInstalled=true;
      const drawer=notesSection();
      const search=document.getElementById('library-notes-search');
      const add=document.getElementById('library-note-add');
      const list=document.getElementById('library-notes-list'),trashToggle=document.getElementById('library-notes-trash-toggle'),info=document.getElementById('library-notes-info'),infoPopover=document.getElementById('library-notes-info-popover');
      if(info&&infoPopover){
        const about=createAnchoredPopover(infoPopover,{align:'start',onClose:()=>info.setAttribute('aria-expanded','false')});
        info.addEventListener('click',event=>{event.preventDefault();if(infoPopover.hidden){about.show(info);info.setAttribute('aria-expanded','true');}else about.hide();});
      }
      const select=document.getElementById('library-note-select'),selectAll=document.getElementById('library-note-select-all'),clearSelection=document.getElementById('library-note-selection-clear'),exportButton=document.getElementById('library-note-export'),cancel=document.getElementById('library-note-select-cancel');
      if(drawer)drawer.addEventListener('keydown',event=>{if(event.key==='Escape'&&ongoingNoteSelectionMode){event.preventDefault();cancelOngoingNoteSelection();}});
      if(search){
        search.addEventListener('input',requestOngoingNotesRender);
        search.addEventListener('keydown',event=>{
          if(event.key==='Enter'){event.preventDefault();if(!stepNoteMatch(event.shiftKey?-1:1)){noteSearchLanded='';landOnNoteSearch();}}
          else if(event.key==='Escape'&&!document.getElementById('library-note-matches')?.hidden){event.preventDefault();clearNoteMatches();}
        });
      }
      const sort=document.getElementById('library-notes-sort');
      if(sort){sort.value=noteSort;sort.addEventListener('change',()=>{noteSort=sort.value==='recent'?'recent':'name';ongoingNoteVisibleLimit=ONGOING_NOTE_PAGE_SIZE;rememberView();renderOngoingNotes();});}
      if(add)add.addEventListener('click',createOngoingNote);
      const importButton=document.getElementById('library-note-import'),importFile=document.getElementById('library-note-import-file');
      if(importButton&&importFile){importButton.addEventListener('click',()=>{importFile.value='';importFile.click();});importFile.addEventListener('change',()=>{const files=[...(importFile.files||[])];importFile.value='';void importNotes(files);});}
      if(list)list.addEventListener('keydown',handleOngoingNoteTreeKey);
      if(trashToggle)trashToggle.addEventListener('click',toggleOngoingNoteTrash);
      if(select)select.addEventListener('click',enterOngoingNoteSelection);
      if(selectAll)selectAll.addEventListener('click',selectAllOngoingNotes);
      if(clearSelection)clearSelection.addEventListener('click',clearOngoingNoteSelection);
      if(exportButton)exportButton.addEventListener('click',()=>{void exportSelectedOngoingNotes();});
      if(cancel)cancel.addEventListener('click',cancelOngoingNoteSelection);
      refreshOngoingNotes();
    }
    installOngoingNotesWorkspace();
    function diaryEntries(entries){return (Array.isArray(entries)?entries:[]).filter(entry=>entry?.hasReflection===true).sort((a,b)=>b.date.localeCompare(a.date));}
    function updateDiarySummaryCount(entries){
      const count=diaryEntries(entries).length;
      setTextSafe('library-diary-nav-count',String(count));setTextSafe('library-diary-summary-count',`· ${count} ${count===1?'Entry':'Entries'}`);diarySummaryCountRevision=librarySummaryRevision;return count;
    }
    function requestDiarySummaryCountRefresh(){
      if(attachmentMutationHold){attachmentMutationNeedsDiary=true;return false;}
      if(diarySummaryCountQueued)return false;diarySummaryCountQueued=true;
      const requestedRevision=librarySummaryRevision;let completed=false;
      Promise.resolve().then(()=>loadLibrarySummaries()).then(entries=>{updateDiarySummaryCount(entries);completed=true;}).catch(()=>{}).finally(()=>{
        diarySummaryCountQueued=false;
        if(completed&&requestedRevision!==librarySummaryRevision&&diarySummaryCountRevision!==librarySummaryRevision)requestDiarySummaryCountRefresh();
      });return true;
    }
    function invalidateLibrarySummaryCache(){librarySummaryRevision++;librarySummaryCache=null;librarySummaryLoad=null;libraryFilterOptionsSignature=null;requestDiarySummaryCountRefresh();requestDiaryRender();}
    function captureLibraryScroll(){
      const root=document.scrollingElement||document.documentElement;
      const main=document.querySelector('.main');
      libraryScrollState={
        documentTop:Math.max(0,Number(root&&root.scrollTop)||Number(window.scrollY)||0),
        mainTop:Math.max(0,Number(main&&main.scrollTop)||0)
      };
    }
    function restoreLibraryScroll(options={}){
      const apply=()=>{
        const root=document.scrollingElement||document.documentElement;
        const main=document.querySelector('.main');
        if(root)root.scrollTop=libraryScrollState.documentTop;
        if(main)main.scrollTop=libraryScrollState.mainTop;
      };
      if(libraryRestoreFrame){cancelAnimationFrame(libraryRestoreFrame);libraryRestoreFrame=0;}
      if(options.immediate===true){apply();return;}
      libraryRestoreFrame=requestAnimationFrame(()=>{libraryRestoreFrame=0;apply();});
    }
    async function batchAttachmentMutation(work,options={}){
      if(typeof work!=='function')throw new TypeError('Library attachment mutation batch requires an operation.');
      const outer=attachmentMutationHold===0;
      if(outer){
        captureLibraryScroll();attachmentMutationRestoreViewport=true;
        if(ongoingNoteRenderFrame){cancelAnimationFrame(ongoingNoteRenderFrame);ongoingNoteRenderFrame=0;attachmentMutationNeedsNotes=true;}
        if(diaryRenderFrame){cancelAnimationFrame(diaryRenderFrame);diaryRenderFrame=0;attachmentMutationNeedsDiary=true;}
        if(libraryRenderFrame){cancelAnimationFrame(libraryRenderFrame);libraryRenderFrame=0;attachmentMutationNeedsLibrary=true;}
      }
      const sources=options.sources||[],dayAffected=Boolean(options.days||sources.some(source=>source?.kind==='day'));
      for(const source of sources){if(source?.kind==='note')attachmentMutationNeedsNotes=true;else if(source?.kind==='day'){attachmentMutationNeedsDiary=true;attachmentMutationNeedsLibrary=true;}}
      if(options.notes)attachmentMutationNeedsNotes=true;if(options.days){attachmentMutationNeedsDiary=true;attachmentMutationNeedsLibrary=true;}
      attachmentMutationHold++;
      if(dayAffected)invalidateLibrarySummaryCache();
      try{return await work();}
      finally{
        attachmentMutationHold--;
        if(!attachmentMutationHold){
          const notes=attachmentMutationNeedsNotes,diary=attachmentMutationNeedsDiary,library=attachmentMutationNeedsLibrary,restore=attachmentMutationRestoreViewport;
          attachmentMutationNeedsNotes=false;attachmentMutationNeedsDiary=false;attachmentMutationNeedsLibrary=false;attachmentMutationRestoreViewport=false;
          if(options.finalReconcile!==false){
            if(notes)refreshOngoingNotes();
            if(diary){requestDiarySummaryCountRefresh();if(diaryShown())await renderDiary();}
            if(library&&document.getElementById('pane-library')?.classList.contains('on'))await renderLibrary();
          }
          if(restore)restoreLibraryScroll();
        }
      }
    }
    function prepareLibrarySummary(value){
      const r=value&&typeof value==='object'&&!Array.isArray(value)&&isValidIsoDate(value.date)?value:null;if(!r)return null;
      const dateLabel=prettyDate(r.date),outcomeText=taskOutcomeSummaryText(sanitizeTaskOutcomeCounts(r.outcomeCounts),{includeZero:false});
      return freeze({...r,libraryView:freeze({dateLabel,outcomeText,searchText:[r.date,dateLabel,r.dayName||'',String(r.weightedCompletion||'')].join(' ').toLowerCase()})});
    }
    async function loadLibrarySummaries(){
      if(librarySummaryCache)return librarySummaryCache;
      if(librarySummaryLoad)return librarySummaryLoad;
      const revision=librarySummaryRevision;
      let pending;
      pending=sortedSummaries().then(records=>{
        if(revision!==librarySummaryRevision){if(librarySummaryLoad===pending)librarySummaryLoad=null;return loadLibrarySummaries();}
        librarySummaryCache=records.map(prepareLibrarySummary).filter(Boolean).sort((a,b)=>b.date.localeCompare(a.date));
        if(librarySummaryLoad===pending)librarySummaryLoad=null;
        return librarySummaryCache;
      }).catch(error=>{if(librarySummaryLoad===pending)librarySummaryLoad=null;throw error;});
      librarySummaryLoad=pending;return pending;
    }
    function diaryDrawer(){return document.getElementById('library-diary');}
    function diaryEditorField(){return document.querySelector('#library-diary-editor .library-diary-textarea');}
    function diaryShown(){return libraryActive&&librarySection==='days'&&!!diaryDrawer()?.open;}
    function diaryDateLabel(date){const [year,month,day]=String(date||'').split('-');return `${Number(day)||day} ${LIBRARY_MONTHS[(Number(month)||1)-1]||month} ${year}`;}
    function diaryMonthLabel(date){const [year,month]=String(date||'').split('-');return `${LIBRARY_MONTHS[(Number(month)||1)-1]||month} ${year}`;}
    function setDiaryStatus(message,error=false){const status=document.getElementById('library-diary-status');if(!status)return false;status.className='library-notes-status ui-status'+(error?' err':'');status.textContent=String(message||'');return true;}
    function requestDiaryRender(){if(attachmentMutationHold){attachmentMutationNeedsDiary=true;return false;}if(!diaryShown()||diaryRenderFrame)return false;diaryRenderFrame=requestAnimationFrame(()=>{diaryRenderFrame=0;void renderDiary();});return true;}
    function diaryNavItem(summary){
      const button=document.createElement('button');button.type='button';button.className='library-note-nav-item library-diary-item has-note'+(summary.date===selectedDiaryDate?' active':'');button.dataset.diaryDate=summary.date;button.setAttribute('aria-pressed',summary.date===selectedDiaryDate?'true':'false');
      button.append(textEl('span','library-note-nav-name',diaryDateLabel(summary.date)),textEl('span','library-note-nav-path',summary.dayName||''));
      button.addEventListener('click',()=>{void selectDiaryDate(summary.date);});return button;
    }
    function renderDiaryList(entries){
      const list=document.getElementById('library-diary-list');if(!list)return;
      const filled=diaryEntries(entries),fragment=document.createDocumentFragment();let month='';
      for(const entry of filled){const key=entry.date.slice(0,7);if(key!==month){month=key;fragment.appendChild(textEl('div','library-diary-month',diaryMonthLabel(entry.date)));}fragment.appendChild(diaryNavItem(entry));}
      if(!filled.length)fragment.appendChild(textEl('div','library-notes-zero ui-status','No reflections yet.'));
      list.replaceChildren(fragment);updateDiarySummaryCount(entries);
    }
    function diaryHeader(record,editing){
      const head=document.createElement('div');head.className='library-notes-editor-head';
      const identity=document.createElement('div');identity.className='library-notes-editor-identity';identity.append(textEl('div','library-notes-editor-title',diaryDateLabel(record.date)),textEl('span','library-notes-editor-meta ui-mono',record.dayName||''));
      const tools=document.createElement('div');tools.className='library-notes-editor-tools';
      const remove=document.createElement('button');remove.type='button';remove.className='library-note-action ui-btn';remove.textContent='Delete';remove.disabled=!canMutate();remove.setAttribute('aria-label','Delete this reflection');remove.addEventListener('click',()=>{void deleteDiaryEntry(record.date);});
      const action=document.createElement('button');action.type='button';action.className='library-note-action ui-btn';action.textContent=editing?'Done':'Edit';action.disabled=!editing&&!canMutate();action.setAttribute('aria-label',editing?'Finish editing reflection':'Edit reflection');
      action.addEventListener('click',()=>{void (editing?finishDiaryEdit():startDiaryEdit(record.date));});tools.append(remove,action);head.append(identity,tools);return head;
    }
    function renderDiaryRead(record){
      const panel=document.getElementById('library-diary-editor');if(!panel)return false;
      const body=document.createElement('div');body.className='library-diary-read';
      renderRichTextContent(body,record.reflection,'',`Diary reflection for ${record.date}`);
      panel.replaceChildren(diaryHeader(record,false),body);return true;
    }
    function renderDiaryEdit(record){
      const panel=document.getElementById('library-diary-editor');if(!panel)return false;
      const shell=document.createElement('div');shell.className='library-notes-editor-shell';
      const field=document.createElement('textarea');field.className='library-notes-textarea library-diary-textarea ui-field';field.autocomplete='off';field.placeholder='Write this reflection…';shell.appendChild(field);panel.replaceChildren(diaryHeader(record,true),shell);
      bindDiaryEditor(field,record.date,record,{onSaved:diarySaved,onState:(status,message)=>setDiaryStatus(status==='error'?message:'',status==='error')});field.addEventListener('input',event=>scheduleDiaryEditor(field,captureDiaryEditor(field,event)));field.addEventListener('blur',()=>{void flushDiarySave().catch(()=>{});});field.focus();return true;
    }
    async function renderDiary(){
      if(attachmentMutationHold){attachmentMutationNeedsDiary=true;return false;}
      if(!diaryShown())return false;const token=++diaryRenderToken;
      try{
        const entries=await loadLibrarySummaries();if(token!==diaryRenderToken||!diaryShown())return false;
        const filled=diaryEntries(entries),valid=new Set(filled.map(entry=>entry.date));if(!diaryEditing&&!valid.has(selectedDiaryDate))selectedDiaryDate=filled[0]?.date||'';
        renderDiaryList(entries);
        const panel=document.getElementById('library-diary-editor');if(!selectedDiaryDate){if(panel)panel.replaceChildren(textEl('div','library-notes-editor-empty ui-status','Create a reflection with + New Reflection.'));return true;}
        if(diaryEditing&&diaryEditorField()?.dataset.diaryDate===selectedDiaryDate)return true;
        const record=await getDailyRecord(selectedDiaryDate)||((diaryDraftRecord&&diaryDraftRecord.date===selectedDiaryDate)?diaryDraftRecord:null);if(token!==diaryRenderToken||!diaryShown())return false;
        if(record&&String(record.reflection||'').trim())renderDiaryRead(record);else if(panel)panel.replaceChildren(textEl('div','library-notes-editor-empty ui-status','This reflection is no longer available.'));
        return true;
      }catch(error){setDiaryStatus('Diary could not be loaded: '+(error&&error.message||error),true);return false;}
    }
    // The editor's save lane writes after typing pauses and retries a failed
    // write; this keeps the list in step with what was saved.
    function diarySaved(record){
      const listed=!!String(record?.reflection||'').trim();
      if(listed!==diaryEntryListed){diaryEntryListed=listed;invalidateLibrarySummaryCache();}
    }
    function flushDiarySave(options={}){const field=diaryEditorField();return field?flushDiaryEditor(field,options):Promise.resolve(null);}
    async function startDiaryEdit(date,recordOverride=null){
      if(!canMutate()){setDiaryStatus('Study control is in another tab. Take control here before editing Diary.',true);return false;}
      if(!isSupportedSavedDate(date))return false;
      try{const record=recordOverride||await getDailyRecord(date);if(!record)return false;selectedDiaryDate=date;diaryDraftRecord=record.recordKind==='diary'&&!String(record.reflection||'').trim()?record:null;diaryEntryListed=!!String(record.reflection||'').trim();diaryEditing=true;setDiaryStatus('');return renderDiaryEdit(record);}
      catch(error){setDiaryStatus('Diary editor could not open: '+(error&&error.message||error),true);return false;}
    }
    async function createDiaryEntry(){
      if(!canMutate()){setDiaryStatus('Study control is in another tab. Take control here before creating a reflection.',true);return false;}
      if(diaryEditing&&!await finishDiaryEdit({render:false}))return false;
      const result=await requestInput({title:'New Reflection',message:'Choose today or an earlier date.',inputLabel:'Date',inputType:'date',defaultValue:todayISO(),min:earliestSupportedSavedDate(),max:todayISO(),required:true,requiredMessage:'Choose a date.',validate:value=>isSupportedSavedDate(String(value||''))?'':'Choose today or an earlier supported date.',confirmLabel:'Write reflection',cancelLabel:'Cancel'});
      if(!result||!canMutate())return false;
      const date=String(result.value||'');if(!isSupportedSavedDate(date))return false;
      const existing=await getDailyRecord(date);
      if(existing&&String(existing.reflection||'').trim()){selectedDiaryDate=date;diaryDraftRecord=null;await renderDiary();return startDiaryEdit(date,existing);}
      const draft=existing||createDiaryDraft(date);if(!draft){setDiaryStatus('That reflection date is not available.',true);return false;}
      return startDiaryEdit(date,draft);
    }
    async function deleteDiaryEntry(date){
      if(!canMutate()||!isSupportedSavedDate(date))return false;
      let current=await getDailyRecord(date);if(!current&&!diaryDraftRecord)return false;
      const confirmed=await confirm({title:'Delete reflection?',message:current?.recordKind==='study'?'The reflection will be removed. The saved Study Day will remain.':'This reflection will be deleted.',confirmLabel:'Delete',cancelLabel:'Cancel',danger:true});
      if(!confirmed||!canMutate())return false;
      if(diaryEditing&&selectedDiaryDate===date){
        // Unsaved typing is dropped; a write already under way finishes first.
        const field=diaryEditorField();
        if(field){const writing=settleDiaryEditor(field);clearDiaryEditor(field);await writing;}
        current=await getDailyRecord(date);diaryEditing=false;
      }
      if(current)await deleteDiaryEntryRecord(date);
      selectedDiaryDate='';diaryDraftRecord=null;diaryEntryListed=false;invalidateLibrarySummaryCache();setDiaryStatus('');await renderDiary();return true;
    }
    async function settleDiaryEdit(options={}){
      if(!diaryEditing)return true;const field=diaryEditorField();
      try{await flushDiarySave(options);return !field||await settleDiaryEditor(field)!==false;}
      catch{return false;}
    }
    function finalizeDiaryEdit(){
      if(!diaryEditing)return true;const field=diaryEditorField();
      if(field)clearDiaryEditor(field);diaryEditing=false;diaryEntryListed=false;diaryDraftRecord=null;invalidateLibrarySummaryCache();return true;
    }
    async function finishDiaryEdit(options={}){
      if(!await settleDiaryEdit())return false;
      finalizeDiaryEdit();if(options.render!==false&&diaryShown())await renderDiary();return true;
    }
    async function selectDiaryDate(date){
      if(!isValidIsoDate(date)||date===selectedDiaryDate&&!diaryEditing)return false;
      if(diaryEditing&&!await finishDiaryEdit({render:false}))return false;selectedDiaryDate=date;diaryDraftRecord=null;return renderDiary();
    }
    function installDiaryWorkspace(){
      if(diaryInstalled)return;diaryInstalled=true;const drawer=diaryDrawer();if(!drawer)return;
      const add=document.getElementById('library-diary-add');if(add)add.addEventListener('click',()=>{void createDiaryEntry();});
      if(savedView.diary===true)drawer.open=true;
      drawer.addEventListener('toggle',()=>{rememberView();if(drawer.open)void renderDiary();else if(diaryEditing)void finishDiaryEdit({render:false});});
      document.addEventListener('visibilitychange',()=>{if(document.hidden&&diaryEditing)void flushDiarySave().catch(()=>{});});window.addEventListener('pagehide',()=>{if(diaryEditing)void flushDiarySave().catch(()=>{});});
    }
    installDiaryWorkspace();
    function rememberView(){try{ports.preferences.write({section:librarySection,diary:!!diaryDrawer()?.open,sort:noteSort,...(noteListWidth?{listWidth:noteListWidth}:{})});}catch{}}
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
      applyNoteListWidth();if(remember)rememberView();
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
        const end=()=>{handle.classList.remove('dragging');handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',end);handle.removeEventListener('pointercancel',end);rememberView();};
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
    installNoteListResizer();
    function enterSection(){
      if(!libraryActive)return;
      if(librarySection==='notes'){clearNoteSearchTimer();if(noteSearchFailed)resetNoteSearchFailure();renderOngoingNotes();}
      else if(librarySection==='days'){if(diaryShown())void renderDiary();}
      else void refreshAttachments();
    }
    function leaveSection(){
      if(librarySection==='notes'){
        const section=notesSection();
        if(ongoingNoteRevealFrame){cancelAnimationFrame(ongoingNoteRevealFrame);ongoingNoteRevealFrame=0;}
        ongoingNoteSelectionMode=false;ongoingNoteSelection.clear();ongoingNoteExportBusy=false;
        pendingOngoingNote=null;selectedTrashKey='';ongoingNoteTrashOpen=false;ongoingNoteVisibleLimit=ONGOING_NOTE_PAGE_SIZE;
        if(section)section.classList.remove('export-selecting','note-open');
        clearOngoingNotesEditorBinding();idleNoteSearch();
      }else if(librarySection==='days'){if(diaryEditing)void finishDiaryEdit({render:false});}
      else closeAttachments();
    }
    function drawSections(){
      for(const name of LIBRARY_SECTIONS){
        const panel=document.getElementById('library-'+name),tab=document.getElementById('library-tab-'+name),on=name===librarySection;
        if(panel)panel.hidden=!on;
        if(tab){tab.setAttribute('aria-selected',on?'true':'false');tab.tabIndex=on?0:-1;}
      }
      document.getElementById('pane-library')?.setAttribute('data-library-section',librarySection);
    }
    function showSection(name){
      if(!LIBRARY_SECTIONS.includes(name))return false;
      if(name===librarySection)return true;
      if(libraryActive)leaveSection();
      librarySection=name;drawSections();rememberView();enterSection();return true;
    }
    function installSectionSwitch(){
      const tabs=LIBRARY_SECTIONS.map(name=>document.getElementById('library-tab-'+name)).filter(Boolean);
      for(const tab of tabs){
        tab.addEventListener('click',()=>showSection(tab.dataset.librarySection));
        tab.addEventListener('keydown',event=>{
          const index=tabs.indexOf(tab),next=event.key==='ArrowRight'?index+1:event.key==='ArrowLeft'?index-1:event.key==='Home'?0:event.key==='End'?tabs.length-1:null;
          if(next===null)return;event.preventDefault();const target=tabs[(next+tabs.length)%tabs.length];showSection(target.dataset.librarySection);target.focus();
        });
      }
      drawSections();
    }
    installSectionSwitch();
    function requestLibraryRender(){
      if(attachmentMutationHold){attachmentMutationNeedsLibrary=true;return false;}
      if(libraryRenderFrame)return false;
      libraryRenderFrame=requestAnimationFrame(()=>{libraryRenderFrame=0;renderLibrary();});return true;
    }
    function libraryFilterState(){
      return {
        search:String(document.getElementById('library-search')?.value||'').trim().toLowerCase(),
        year:String(document.getElementById('library-year')?.value||'all'),
        month:String(document.getElementById('library-month')?.value||'all'),
        sort:String(document.getElementById('library-sort')?.value||'newest')
      };
    }
    function libraryFilterSignature(state){
      return [state.search,state.year,state.month,state.sort].join('|');
    }
    function libraryViewIsCurrent(){
      return libraryHasRendered&&libraryRenderedRevision===librarySummaryRevision&&libraryRenderedFilterSignature===libraryFilterSignature(libraryFilterState())&&libraryRenderedVisibleLimit===libraryVisibleLimit;
    }
    function markLibraryViewRendered(signature){
      libraryHasRendered=true;
      libraryRenderedRevision=librarySummaryRevision;
      libraryRenderedFilterSignature=signature;
      libraryRenderedVisibleLimit=libraryVisibleLimit;
    }
    function populateLibraryFilterOptions(records){
      const years=[...new Set((records||[]).map(r=>String(r.date||'').slice(0,4)).filter(Boolean))].sort((a,b)=>b.localeCompare(a));
      const signature=years.join('|');
      if(signature===libraryFilterOptionsSignature)return;
      libraryFilterOptionsSignature=signature;
      const yearSel=document.getElementById('library-year');
      const monthSel=document.getElementById('library-month');
      if(yearSel){
        const prev=yearSel.value||'all';
        yearSel.replaceChildren(createOption('All Years','all'),...years.map(y=>createOption(y,y)));
        yearSel.value=prev==='all'||years.includes(prev)?prev:'all';
      }
      if(monthSel&&monthSel.dataset.libraryOptionsReady!=='1'){
        const prev=monthSel.value||'all';
        monthSel.replaceChildren(createOption('All Months','all'),...LIBRARY_MONTHS.map((m,i)=>createOption(m,String(i+1).padStart(2,'0'))));
        monthSel.value=prev==='all'||/^(0[1-9]|1[0-2])$/.test(prev)?prev:'all';
        monthSel.dataset.libraryOptionsReady='1';
      }
    }
    function buildLibraryViewModel(records){
      const state=libraryFilterState(),sorted=state.sort==='oldest'?[...(records||[])].reverse():(records||[]);
      const filtered=sorted.filter(r=>{
        const date=String(r.date||'');
        return (state.year==='all'||date.slice(0,4)===state.year)&&(state.month==='all'||date.slice(5,7)===state.month)&&(!state.search||r.libraryView.searchText.includes(state.search));
      });
      return {records:sorted,filtered,state};
    }
    function setLibrarySelectedDate(date){
      selectedLibraryDate=isValidIsoDate(date)?String(date):null;
      setTextSafe('h-selected',selectedLibraryDate?prettyDate(selectedLibraryDate):'—');
      document.querySelectorAll('[data-library-date]').forEach(el=>{
        el.classList.toggle('active',!!selectedLibraryDate&&el.dataset.libraryDate===selectedLibraryDate);
        if(el.classList.contains('library-card'))el.setAttribute('aria-current',el.dataset.libraryDate===selectedLibraryDate?'true':'false');
      });
    }
    function renderLibraryEmptyDetail(message='Select a saved day from the list.'){
      const box=document.getElementById('library-detail');
      if(box)box.replaceChildren(emptyMsg(message));
    }
    function closeLibraryDayDetail(){
      setLibrarySelectedDate(null);
      renderLibraryEmptyDetail();
    }
    function createLibraryDayCard(r){
      const card=document.createElement('button');card.className='library-card ui-card';
      card.type='button';
      card.dataset.libraryDate=r.date;card.dataset.action='open-library-day';
      card.setAttribute('aria-current',r.date===selectedLibraryDate?'true':'false');
      if(r.date===selectedLibraryDate)card.classList.add('active');
      const q=r.studyQuality?` · Quality ${r.studyQuality}/5`:'';
      const top=document.createElement('div');
      top.className='library-card-top';
      const left=document.createElement('div');
      const date=document.createElement('div');
      date.className='library-date ui-label';
      date.textContent=r.libraryView.dateLabel;
      const meta=document.createElement('div');
      meta.className='library-meta ui-mono';
      meta.textContent=`Actual focus ${optionalHoursLabel(r.actualTrackedMinutes)} · Completed ${optionalHoursLabel(r.completedMinutes)} / ${optionalHoursLabel(r.plannedMinutes)} · ${r.libraryView.outcomeText}${q}`;
      left.append(date,meta);
      const score=document.createElement('div');
      score.className='library-score ui-mono';
      score.textContent=optionalPercentLabel(r.weightedCompletion);
      top.append(left,score);
      card.appendChild(top);
      return card;
    }
    async function renderLibrary(options={}){
      if(attachmentMutationHold){attachmentMutationNeedsLibrary=true;return false;}
      const list=document.getElementById('library-list');if(!list)return false;
      const restoreAfter=!!(options&&options.restoreScroll);
      const token=++libraryRenderToken;
      const previousRenderedRevision=libraryRenderedRevision;
      const allRecords=await loadLibrarySummaries();
      const records=allRecords.filter(record=>record.recordKind==='study');
      if(token!==libraryRenderToken)return false;
      populateLibraryFilterOptions(records);
      const model=buildLibraryViewModel(records);
      const signature=libraryFilterSignature(model.state);
      if(!libraryPreserveLimitOnce&&signature!==libraryLastFilterSignature)libraryVisibleLimit=LIBRARY_PAGE_SIZE;
      libraryPreserveLimitOnce=false;
      libraryLastFilterSignature=signature;
      const {filtered}=model;
      const visible=filtered.slice(0,libraryVisibleLimit);
      setTextSafe('h-days',records.length);
      setTextSafe('h-showing',visible.length+' / '+filtered.length);
      setTextSafe('h-selected',selectedLibraryDate?prettyDate(selectedLibraryDate):'—');
      const count=document.getElementById('library-count');
      if(count){
        count.textContent=filtered.length===records.length?`${records.length} saved day${records.length===1?'':'s'}`:`${filtered.length} of ${records.length} saved days`;
      }
      if(selectedLibraryDate&&!model.records.some(r=>r.date===selectedLibraryDate)){
        setLibrarySelectedDate(null);
        renderLibraryEmptyDetail();
      }
      if(selectedLibraryDate&&previousRenderedRevision!==librarySummaryRevision){
        const selected=await getDailyRecord(selectedLibraryDate).catch(()=>null);
        if(token!==libraryRenderToken)return false;
        if(selected)renderLibraryDayDetail(selected);
      }
      if(!filtered.length){
        const more=document.getElementById('library-more');if(more)more.hidden=true;
        list.replaceChildren(emptyMsg('No saved Study Days match these filters. Use Review → Save Today to Library.'));
        markLibraryViewRendered(signature);
        if(restoreAfter)restoreLibraryScroll();
        return true;
      }
      const fragment=document.createDocumentFragment();
      visible.forEach(r=>fragment.appendChild(createLibraryDayCard(r)));
      list.replaceChildren(fragment);
      const more=document.getElementById('library-more');
      if(more)more.hidden=visible.length>=filtered.length;
      setLibrarySelectedDate(selectedLibraryDate);
      markLibraryViewRendered(signature);
      if(restoreAfter)restoreLibraryScroll();
      return true;
    }
    async function activateLibrary(options={}){
      libraryActive=true;clearNoteSearchTimer();if(noteSearchFailed)resetNoteSearchFailure();
      refreshOngoingNotes();requestDiarySummaryCountRefresh();if(diaryShown())void renderDiary();
      if(options&&options.restoreScroll&&options.immediateScroll===true)restoreLibraryScroll({immediate:true});
      if(libraryViewIsCurrent()){
        if(options&&options.restoreScroll&&options.immediateScroll!==true)restoreLibraryScroll();
        return true;
      }
      await renderLibrary({restoreScroll:!!(options&&options.restoreScroll)});
      return false;
    }
    function deactivateLibrary(options={}){libraryActive=false;captureLibraryScroll();pendingOngoingNote=null;clearOngoingNotesEditorBinding();idleNoteSearch();if(diaryEditing){if(options.diarySettled===true)finalizeDiaryEdit();else void finishDiaryEdit({render:false});}}
    function loadMoreLibrary(){
      libraryVisibleLimit+=LIBRARY_PAGE_SIZE;
      libraryPreserveLimitOnce=true;
      renderLibrary();
    }
    function createLibraryDetailHeader(record){
      const header=document.createElement('div');
      header.className='library-detail-head';
      const titleWrap=document.createElement('div');
      const title=textEl('div','library-date ui-label',prettyDate(record.date));
      const meta=textEl('div','library-meta ui-mono',`Saved day · ${record.dayName||'Daily record'} · ${record.tasks?.length||0} tracked blocks`);
      titleWrap.append(title,meta);
      const actions=document.createElement('div');
      actions.className='library-detail-actions';
      const closeBtn=document.createElement('button');
      closeBtn.type='button';
      closeBtn.className='mini-btn ui-btn';
      closeBtn.textContent='Close Detail';
      closeBtn.addEventListener('click',closeLibraryDayDetail);
      const deleteBtn=document.createElement('button');
      deleteBtn.type='button';
      deleteBtn.className='mini-btn ui-btn danger';
      deleteBtn.dataset.ownerMutation='library-delete';
      deleteBtn.textContent='Delete Saved Day';
      deleteBtn.addEventListener('click',()=>deleteLibraryDay(record.date));
      actions.append(closeBtn);
      actions.appendChild(deleteBtn);
      header.append(titleWrap,actions);
      return header;
    }
    function createLibraryDetailMetrics(record){
      const metrics=document.createElement('div');
      metrics.className='library-detail-metrics';
      [
        ['Completion',optionalPercentLabel(record.completionPercent)],
        ['Completed',optionalDurationLabel(record.completedEquivalentMinutes)],
        ['Actual Focus',optionalDurationLabel(record.actualFocusMinutes)],
        ['Planned Work',optionalDurationLabel(record.originalPlannedStudyMinutes)],
        ['Block Outcomes',taskOutcomeSummaryText(countTaskOutcomes(record.tasks||[]))],
        ['Quality',record.studyQuality?record.studyQuality+'/5':'—']
      ].forEach(([label,value])=>{
        const m=document.createElement('div');
        m.className='library-detail-metric ui-card';
        m.append(textEl('div','l ui-label',label),textEl('div','v ui-mono',value));
        metrics.appendChild(m);
      });
      return metrics;
    }
    function createLibraryPracticeSummary(record){
      const runs=sanitizePracticeRuns(record&&record.practiceRuns);
      if(!runs.length)return null;
      const panel=textEl('section','practice-review ui-panel');
      panel.append(textEl('div','review-section-title ui-label','Practice Pacer'),textEl('div','practice-run-table'),textEl('div','practice-review-note ui-mono'));
      populatePracticeRunTable(panel,runs,{tasks:record&&record.tasks||[],normalized:true});
      return panel;
    }
    function createSavedDayTaskGrid(record){
      const grid=document.createElement('div');
      grid.className='review-grid review-grid-polished library-day-grid';
      const tasks=(record.tasks||[]).filter(isTrackableBlock);
      if(tasks.length)tasks.forEach(t=>grid.appendChild(createSavedDayTaskReviewCard(t)));
      else grid.appendChild(emptyMsg('No saved trackable block details for this day.'));
      return grid;
    }
    function createLibraryTextSection(title,text,emptyText,{rich=false}={}){
      const heading=textEl('div','library-section ui-label',title);
      const box=document.createElement('div');
      box.className='library-ref ui-body';
      if(rich)renderRichTextContent(box,text,emptyText,title);
      else box.textContent=plainTextContent(text).trim()||emptyText;
      return [heading,box];
    }
    function renderLibraryDayDetail(record){
      const box=document.getElementById('library-detail');
      if(!box)return;
      if(!record){
        renderLibraryEmptyDetail();
        return;
      }
      setLibrarySelectedDate(record.date);
      const reflection=createLibraryTextSection('Diary / Reflection',record.reflection,'No reflection saved for this day.',{rich:true});
      const unfinished=createLibraryTextSection('Unfinished Note',record.carryForwardDraft,'No unfinished note saved for this day.');
      box.replaceChildren(...[
        createLibraryDetailHeader(record),
        createLibraryDetailMetrics(record),
        createPomodoroSummaryLine(record.tasks),
        createLibraryPracticeSummary(record),
        createSavedDayTaskGrid(record),
        ...reflection,
        ...unfinished
      ].filter(Boolean));
    }
    async function openLibraryDayDetail(date){
      if(!document.getElementById('pane-library')?.classList.contains('on')&&!await goTab('library',{source:'library-day'}))return false;
      const r=await getDailyRecord(date);
      if(!r){
        setStatus('library-status','Could not load saved record for '+date+'.',false);
        return false;
      }
      renderLibraryDayDetail(r);
      return true;
    }
    function libraryMutationBlocked(action,options={}){
      if(options.activeSession===true&&hasActiveSession()){
        setStatus('library-status','End or suspend the active session before clearing Library data.',false);
        return true;
      }
      if(!canMutate()){
        setStatus('library-status','Study control is in another tab. Take control here before '+action+'.',false);
        return true;
      }
      return false;
    }
    async function deleteLibraryDay(date){
      if(libraryMutationBlocked('deleting a saved day'))return;
      if(!isValidIsoDate(date)){setStatus('library-status','Invalid saved-day date.',false);return;}
      const accepted=await confirm({
        title:`Delete ${prettyDate(date)}?`,danger:true,
        message:'This removes only this saved day from the Library in this browser.',
        details:['Notes and the active session are unchanged.','Existing backup files are unchanged.'],
        confirmLabel:'Delete saved day',cancelLabel:'Keep saved day'
      });
      if(!accepted||libraryMutationBlocked('deleting a saved day'))return;
      const notice=notifications.begin({id:'library-day-delete',surfaceId:'library-status',title:'Delete saved day',message:'Deleting '+date+'…'});
      let deleted=false;
      try{
        await removeDailyRecord(date);deleted=true;
        if(selectedLibraryDate===date){
          setLibrarySelectedDate(null);
          renderLibraryEmptyDetail('Saved day deleted. Select another saved day from the list.');
        }
        await renderLibrary();notice.finish('succeeded','Deleted '+date+'.');
      }catch(e){
        notice.finish('failed',(deleted?'Saved day deleted; refreshing Library failed: ':'Could not delete '+date+': ')+(e&&e.message?e.message:e));
      }
    }
    async function loadClearLibraryCounts(){
      const [summaries,attachments]=await Promise.all([sortedSummaries(),attachmentCount()]);
      return freeze({
        savedDays:(summaries||[]).filter(summary=>summary&&isValidIsoDate(summary.date)).length,
        ongoingNotes:Math.max(0,Number(ongoingNotesSize())||0),
        attachments:Math.max(0,Number(attachments)||0)
      });
    }
    function clearLibrarySelectionFromFields(fields){
      return freeze({savedDays:!!fields.savedDays?.checked,ongoingNotes:!!fields.ongoingNotes?.checked,attachments:!!fields.attachments?.checked});
    }
    function clearLibrarySelectionHasValue(selection){return !!(selection&&selection.savedDays||selection&&selection.ongoingNotes||selection&&selection.attachments);}
    function libraryClearAttachmentSummary(plan){
      const safe=plan?.attachments?.safeIds?.length||0,protectedCount=plan?.attachments?.protectedIds?.length||0;
      if(!protectedCount)return `${safe} attachment${safe===1?'':'s'} can be deleted. No surviving references need protection.`;
      return `${safe} can be deleted · ${protectedCount} ${protectedCount===1?'is':'are'} still used and will be kept by default.`;
    }
    async function requestClearLibrarySelectionFallback(counts){
      const available=[counts.savedDays?'S = Saved Dates / Reflections':'',counts.ongoingNotes?'N = Notes':'',counts.attachments?'A = Attachments':''].filter(Boolean);
      const result=await requestInput({
        title:'Clear Library',danger:true,
        message:'Choose what to delete. Enter one or more letters separated by nothing or spaces.',
        details:[...available,'Saved Dates / Reflections includes Study Days and diary-only reflections. Attachment references in retained content are protected by default.'],
        inputLabel:'Selection',defaultValue:counts.savedDays?'S':'',placeholder:'For example: S or S N',spellcheck:false,required:true,
        validate:value=>{const compact=String(value||'').toUpperCase().replace(/\s+/g,'');if(!compact||/[^SNA]/.test(compact))return 'Use only S, N and A.';if(compact.includes('S')&&!counts.savedDays||compact.includes('N')&&!counts.ongoingNotes||compact.includes('A')&&!counts.attachments)return 'Choose only items that currently contain data.';return '';},
        confirmLabel:'Continue',cancelLabel:'Cancel'
      });
      if(!result)return null;const compact=String(result.value||'').toUpperCase().replace(/\s+/g,'');
      const selection=freeze({savedDays:compact.includes('S'),ongoingNotes:compact.includes('N'),attachments:compact.includes('A')}),plan=await preflightClearLibrary(selection);
      let forceReferenced=false;
      if(selection.attachments&&plan.attachments.protectedIds.length){
        const policy=await requestInput({
          title:'Referenced attachments found',danger:true,
          message:libraryClearAttachmentSummary(plan),
          details:['SAFE keeps attachments still used by retained content.','ALL removes those references from retained content and then deletes the attachments.'],
          inputLabel:'Type SAFE or ALL',defaultValue:'SAFE',placeholder:'SAFE',spellcheck:false,required:true,
          validate:value=>['SAFE','ALL'].includes(String(value||'').trim().toUpperCase())?'':'Type SAFE or ALL.',
          confirmLabel:'Continue',cancelLabel:'Cancel'
        });
        if(!policy)return null;forceReferenced=String(policy.value||'').trim().toUpperCase()==='ALL';
      }
      return freeze({selection,plan,forceReferenced});
    }
    function requestClearLibrarySelection(counts){
      const dialog=document.getElementById('library-clear-dialog');
      if(!dialog||typeof dialog.showModal!=='function')return requestClearLibrarySelectionFallback(counts);
      const fields={
        savedDays:document.getElementById('library-clear-saved-days'),
        ongoingNotes:document.getElementById('library-clear-ongoing-notes'),
        attachments:document.getElementById('library-clear-attachments')
      };
      const policyBox=document.getElementById('library-clear-attachment-policy'),summary=document.getElementById('library-clear-attachment-summary'),safePolicy=document.getElementById('library-clear-attachments-safe'),forcePolicy=document.getElementById('library-clear-attachments-force');
      setTextSafe('library-clear-saved-days-count',counts.savedDays);setTextSafe('library-clear-ongoing-notes-count',counts.ongoingNotes);setTextSafe('library-clear-attachments-count',counts.attachments);
      fields.savedDays.disabled=!counts.savedDays;fields.savedDays.checked=!!counts.savedDays;fields.ongoingNotes.disabled=!counts.ongoingNotes;fields.ongoingNotes.checked=false;fields.attachments.disabled=!counts.attachments;fields.attachments.checked=false;
      if(safePolicy)safePolicy.checked=true;if(forcePolicy){forcePolicy.checked=false;forcePolicy.disabled=true;}if(policyBox)policyBox.hidden=true;
      const cancelButton=document.getElementById('library-clear-cancel'),continueButton=document.getElementById('library-clear-continue'),error=document.getElementById('library-clear-selection-error');
      if(error)error.hidden=true;
      let planRevision=0,latestPlan=null;
      const updatePlan=async selection=>{
        const revision=++planRevision;latestPlan=null;if(continueButton)continueButton.disabled=true;
        if(policyBox)policyBox.hidden=!selection.attachments;if(summary&&selection.attachments)summary.textContent='Checking attachment references…';
        if(!clearLibrarySelectionHasValue(selection))return;
        try{
          const plan=await preflightClearLibrary(selection);if(revision!==planRevision)return;latestPlan=plan;
          if(selection.attachments){if(summary)summary.textContent=libraryClearAttachmentSummary(plan);const protectedCount=plan.attachments.protectedIds.length;if(forcePolicy)forcePolicy.disabled=!protectedCount;if(!protectedCount&&safePolicy){safePolicy.checked=true;if(forcePolicy)forcePolicy.checked=false;}}
          if(error)error.hidden=true;if(continueButton)continueButton.disabled=false;
        }catch(preflightError){if(revision!==planRevision)return;if(error){error.textContent=preflightError?.message||String(preflightError);error.hidden=false;}}
      };
      const sync=()=>{const selection=clearLibrarySelectionFromFields(fields);for(const [key,field] of Object.entries(fields))document.getElementById('library-clear-option-'+key.replace(/[A-Z]/g,m=>'-'+m.toLowerCase()))?.classList.toggle('selected',!!field.checked);void updatePlan(selection);};
      sync();
      return new Promise(resolve=>{
        let settled=false;
        const finish=value=>{if(settled)return;settled=true;planRevision+=1;dialog.oncancel=null;if(cancelButton)cancelButton.onclick=null;if(continueButton)continueButton.onclick=null;Object.values(fields).forEach(field=>{field.onchange=null;});try{dialog.close();}catch{}resolve(value);};
        Object.values(fields).forEach(field=>{field.onchange=sync;});
        if(cancelButton)cancelButton.onclick=()=>finish(null);
        if(continueButton)continueButton.onclick=async()=>{const selection=clearLibrarySelectionFromFields(fields);if(!clearLibrarySelectionHasValue(selection)){if(error){error.textContent='Select at least one type of Library data.';error.hidden=false;}return;}continueButton.disabled=true;try{const plan=await preflightClearLibrary(selection);finish(freeze({selection,plan,forceReferenced:!!(selection.attachments&&plan.attachments.protectedIds.length&&forcePolicy?.checked)}));}catch(preflightError){continueButton.disabled=false;if(error){error.textContent=preflightError?.message||String(preflightError);error.hidden=false;}}};
        dialog.oncancel=event=>{event.preventDefault();finish(null);};
        try{dialog.showModal();}catch{return requestClearLibrarySelectionFallback(counts).then(finish);}
      });
    }
    async function requestClearLibraryConfirmation(choice,counts){
      const selection=choice.selection,plan=choice.plan,forceReferenced=choice.forceReferenced===true&&!!plan?.attachments?.protectedIds?.length;
      const onlySavedDays=selection.savedDays&&!selection.ongoingNotes&&!selection.attachments,details=[];
      if(selection.savedDays)details.push(`${counts.savedDays} Saved Date / Reflection record${counts.savedDays===1?'':'s'}.`);
      if(selection.ongoingNotes)details.push(`${counts.ongoingNotes} Note${counts.ongoingNotes===1?'':'s'}.`);
      if(selection.attachments){const safe=plan?.attachments?.safeIds?.length||0,protectedCount=plan?.attachments?.protectedIds?.length||0;if(forceReferenced)details.push(`${safe+protectedCount} Attachment${safe+protectedCount===1?'':'s'} will be deleted. References to ${protectedCount} still-used attachment${protectedCount===1?'':'s'} will first be removed from retained content.`);else details.push(`${safe} Attachment${safe===1?'':'s'} can be deleted safely; ${protectedCount} still-used attachment${protectedCount===1?'':'s'} will be kept.`);}
      details.push('Existing backup files, plans, preferences, and active/suspended session state (including unsaved Review work) are otherwise preserved.');
      const phrase=forceReferenced?'DELETE ATTACHMENTS AND REFERENCES':'DELETE SELECTED DATA';
      const typed=await requestInput({
        title:forceReferenced?'Delete referenced attachments?':onlySavedDays?'Clear Saved Dates / Reflections?':'Clear selected Library data?',danger:true,
        message:forceReferenced?'This permanently deletes the selected attachments and removes their references from retained content.':'This deletion is permanent in this browser. Download a current backup first if you may need this data again.',details,
        inputLabel:`Type ${phrase} to continue`,placeholder:phrase,spellcheck:false,
        validate:value=>value===phrase?'':`Type ${phrase} exactly to continue.`,
        confirmLabel:forceReferenced?'Delete Attachments & References':onlySavedDays?'Clear Saved Dates / Reflections':'Clear Selected Data',cancelLabel:'Cancel'
      });
      return !!typed;
    }
    function clearLibraryResultMessage(result){
      const parts=[];
      if(result.selection.savedDays)parts.push(`${result.savedDays} saved day${result.savedDays===1?'':'s'}`);
      if(result.selection.ongoingNotes)parts.push(`${result.ongoingNotes} note${result.ongoingNotes===1?'':'s'}`);
      if(result.selection.attachments)parts.push(`${result.attachmentsRemoved} attachment${result.attachmentsRemoved===1?'':'s'}`);
      let message=parts.length?'Deleted '+parts.join(' · ')+'.':'No selected data needed deletion.';
      if(result.selection.attachments&&result.attachmentsProtected)message+=` Kept ${result.attachmentsProtected} referenced attachment${result.attachmentsProtected===1?'':'s'} still used by retained content.`;
      if(result.sweepPending)message+=' Logical deletion is complete; orphaned attachment bytes will be reclaimed automatically later.';
      return message;
    }
    async function clearLibraryRecords(){
      if(libraryMutationBlocked('clearing Library data',{activeSession:true}))return;
      let counts;try{counts=await loadClearLibraryCounts();}catch(error){setStatus('library-status','Could not inspect Library data safely: '+(error&&error.message||error),false);return;}
      if(!counts.savedDays&&!counts.ongoingNotes&&!counts.attachments){setStatus('library-status','Library data is already empty.');return;}
      for(let attempt=0;attempt<2;attempt++){
        const choice=await requestClearLibrarySelection(counts);if(!choice){setStatus('library-status','Clear Library cancelled.',true,'cancelled');return;}
        const {selection,plan,forceReferenced}=choice;
        if(libraryMutationBlocked('clearing Library data',{activeSession:true})){setStatus('library-status','Clear Library cancelled.',false);return;}
        if(!await requestClearLibraryConfirmation(choice,counts)){setStatus('library-status','Clear Library cancelled.',true,'cancelled');return;}
        if(libraryMutationBlocked('clearing Library data',{activeSession:true})){setStatus('library-status','Clear Library cancelled.',false);return;}
        const notice=notifications.begin({id:'library-clear',surfaceId:'library-status',title:'Clear Library',message:'Clearing selected Library data…'});
        let cleared=false;
        try{
          const result=await batchAttachments(()=>batchAttachmentMutation(()=>executeClearLibrary({selection,signature:plan.signature,forceReferenced}),{sources:plan.attachments.protectedReferences,notes:selection.ongoingNotes,days:selection.savedDays,finalReconcile:false}));cleared=true;
          if(selection.savedDays){setLibrarySelectedDate(null);renderLibraryEmptyDetail('Saved Dates / Reflections cleared. Import a backup, save a Study Day from Review, or create a new reflection.');invalidateLibrarySummaryCache();}
          if(selection.ongoingNotes){pendingOngoingNote=null;selectedOngoingNoteKey='';ongoingNoteSelectionMode=false;ongoingNoteSelection.clear();clearOngoingNotesEditorBinding();refreshOngoingNotes();}
          await reconcileAttachments();await renderLibrary();
          const message=clearLibraryResultMessage(result);notice.finish('succeeded',message);return;
        }catch(error){
          const message=error&&error.message||String(error);
          if(message.startsWith('Library data changed while Clear Library was open')&&attempt===0){notice.finish('cancelled','Library data changed while the confirmation was open. Review the refreshed deletion plan.');counts=await loadClearLibraryCounts();continue;}
          if(selection.ongoingNotes)refreshOngoingNotes();void reconcileAttachments();if(selection.savedDays){invalidateLibrarySummaryCache();void renderLibrary();}
          notice.finish('failed',(cleared?'Selected data cleared; refreshing Library failed: ':'Clear Library stopped: ')+message);return;
        }
      }
    }
    return freeze({
      format:'study-director.library-view',
      contractVersion:1,
      render:renderLibrary,
      activate:activateLibrary,
      deactivate:deactivateLibrary,
      requestRender:requestLibraryRender,
      invalidate:invalidateLibrarySummaryCache,
      refreshNotes:refreshOngoingNotes,
      updateSearchDocument:updateOngoingNoteSearchDocument,
      openDay:date=>{showSection('days');return openLibraryDayDetail(date);},
      showSection,
      openNote:selectOngoingNote,
      noteDestinations:ongoingNoteDestinations,
      revealNoteReference,
      filterTag,
      batchAttachmentMutation,
      settleDiary:settleDiaryEdit,
      loadMore:loadMoreLibrary,
      clearAll:clearLibraryRecords
    });
  }
  return freeze({format:'study-director.library-module',contractVersion:1,createView});
});
})();
