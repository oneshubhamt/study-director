(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,declaredFunctions:requireFunctions}=registry.contracts;
registry.define('library',1,modules=>{
  const freeze=Object.freeze;
  if(!modules||!Object.isFrozen(modules)||Object.keys(modules).join('|')!=='libraryNotes'||modules.libraryNotes?.format!=='study-director.library-notes-module'||modules.libraryNotes.contractVersion!==1)throw new TypeError('Library module dependencies are incomplete or incompatible.');
  const LibraryNotesModule=modules.libraryNotes;
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
    notes:freeze(['areaUse','bindEditor','canCreate','catalogue','clearEditor','clearFind','commitEditor','find','findStep','focusEditor','get','importFiles','linksBar','normalizeArea','normalizeTag','orderEntries','print','purgeTrash','remove','rename','renameAreaInPlans','renameTag','renderInherited','restore','reviewKept','keptVersion','searchDocuments','size','tagged','tags','trash','trashSnapshot','versions']),
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
      areaUse:planAreaUse,renameAreaInPlans,bindEditor,canCreate:canCreateNote,catalogue:noteCatalogue,clearEditor,clearFind,commitEditor,find:findInEditor,findStep,focusEditor,
      get:getNote,importFiles:importNoteFiles,linksBar,normalizeArea:normalizeNoteArea,normalizeTag,orderEntries:orderNoteEntries,print:printNote,
      purgeTrash:purgeExpiredNotes,remove:removeNote,rename:renameNote,renameTag:renameNoteTag,renderInherited,restore:restoreNote,reviewKept,keptVersion,searchDocuments:noteSearchDocuments,size:notesSize,
      tagged:taggedNotes,tags:noteTags,trash:trashNote,trashSnapshot:noteTrash,versions:openNoteVersions
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
    const LIBRARY_MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    let attachmentMutationHold=0,attachmentMutationNeedsNotes=false,attachmentMutationNeedsDiary=false,attachmentMutationNeedsLibrary=false,attachmentMutationRestoreViewport=false;
    // The Notes section (core/library-notes.js).
    const notesView=LibraryNotesModule.createNotes(freeze({ports,host:freeze({
      shown:()=>libraryActive&&librarySection==='notes',showSection:name=>showSection(name),rememberView:()=>rememberView(),
      // An attachment batch holds rendering; Notes render once it ends.
      held:()=>{if(!attachmentMutationHold)return false;attachmentMutationNeedsNotes=true;return true;},
      months:freeze([...LIBRARY_MONTHS]),savedView:freeze({sort:savedView.sort,listWidth:savedView.listWidth})
    })}));
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
        if(notesView.cancelRender())attachmentMutationNeedsNotes=true;
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
          const notesDue=attachmentMutationNeedsNotes,diary=attachmentMutationNeedsDiary,library=attachmentMutationNeedsLibrary,restore=attachmentMutationRestoreViewport;
          attachmentMutationNeedsNotes=false;attachmentMutationNeedsDiary=false;attachmentMutationNeedsLibrary=false;attachmentMutationRestoreViewport=false;
          if(options.finalReconcile!==false){
            if(notesDue)notesView.refresh();
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
    function rememberView(){try{const view=notesView.view();ports.preferences.write({section:librarySection,diary:!!diaryDrawer()?.open,sort:view.sort,...(view.listWidth?{listWidth:view.listWidth}:{})});}catch{}}
    notesView.installResizer();
    function enterSection(){
      if(!libraryActive)return;
      if(librarySection==='notes')notesView.enter();
      else if(librarySection==='days'){if(diaryShown())void renderDiary();}
      else void refreshAttachments();
    }
    function leaveSection(){
      if(librarySection==='notes')notesView.leave();
      else if(librarySection==='days'){if(diaryEditing)void finishDiaryEdit({render:false});}
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
      libraryActive=true;notesView.search.resume();
      notesView.refresh();requestDiarySummaryCountRefresh();if(diaryShown())void renderDiary();
      if(options&&options.restoreScroll&&options.immediateScroll===true)restoreLibraryScroll({immediate:true});
      if(libraryViewIsCurrent()){
        if(options&&options.restoreScroll&&options.immediateScroll!==true)restoreLibraryScroll();
        return true;
      }
      await renderLibrary({restoreScroll:!!(options&&options.restoreScroll)});
      return false;
    }
    function deactivateLibrary(options={}){libraryActive=false;captureLibraryScroll();notesView.clearBinding();notesView.search.idle();if(diaryEditing){if(options.diarySettled===true)finalizeDiaryEdit();else void finishDiaryEdit({render:false});}}
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
        notes:Math.max(0,Number(notesSize())||0),
        attachments:Math.max(0,Number(attachments)||0)
      });
    }
    function clearLibrarySelectionFromFields(fields){
      return freeze({savedDays:!!fields.savedDays?.checked,notes:!!fields.notes?.checked,attachments:!!fields.attachments?.checked});
    }
    function clearLibrarySelectionHasValue(selection){return !!(selection&&selection.savedDays||selection&&selection.notes||selection&&selection.attachments);}
    function libraryClearAttachmentSummary(plan){
      const safe=plan?.attachments?.safeIds?.length||0,protectedCount=plan?.attachments?.protectedIds?.length||0;
      if(!protectedCount)return `${safe} attachment${safe===1?'':'s'} can be deleted. No surviving references need protection.`;
      return `${safe} can be deleted · ${protectedCount} ${protectedCount===1?'is':'are'} still used and will be kept by default.`;
    }
    async function requestClearLibrarySelectionFallback(counts){
      const available=[counts.savedDays?'S = Saved Dates / Reflections':'',counts.notes?'N = Notes':'',counts.attachments?'A = Attachments':''].filter(Boolean);
      const result=await requestInput({
        title:'Clear Library',danger:true,
        message:'Choose what to delete. Enter one or more letters separated by nothing or spaces.',
        details:[...available,'Saved Dates / Reflections includes Study Days and diary-only reflections. Attachment references in retained content are protected by default.'],
        inputLabel:'Selection',defaultValue:counts.savedDays?'S':'',placeholder:'For example: S or S N',spellcheck:false,required:true,
        validate:value=>{const compact=String(value||'').toUpperCase().replace(/\s+/g,'');if(!compact||/[^SNA]/.test(compact))return 'Use only S, N and A.';if(compact.includes('S')&&!counts.savedDays||compact.includes('N')&&!counts.notes||compact.includes('A')&&!counts.attachments)return 'Choose only items that currently contain data.';return '';},
        confirmLabel:'Continue',cancelLabel:'Cancel'
      });
      if(!result)return null;const compact=String(result.value||'').toUpperCase().replace(/\s+/g,'');
      const selection=freeze({savedDays:compact.includes('S'),notes:compact.includes('N'),attachments:compact.includes('A')}),plan=await preflightClearLibrary(selection);
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
        notes:document.getElementById('library-clear-notes'),
        attachments:document.getElementById('library-clear-attachments')
      };
      const policyBox=document.getElementById('library-clear-attachment-policy'),summary=document.getElementById('library-clear-attachment-summary'),safePolicy=document.getElementById('library-clear-attachments-safe'),forcePolicy=document.getElementById('library-clear-attachments-force');
      setTextSafe('library-clear-saved-days-count',counts.savedDays);setTextSafe('library-clear-notes-count',counts.notes);setTextSafe('library-clear-attachments-count',counts.attachments);
      fields.savedDays.disabled=!counts.savedDays;fields.savedDays.checked=!!counts.savedDays;fields.notes.disabled=!counts.notes;fields.notes.checked=false;fields.attachments.disabled=!counts.attachments;fields.attachments.checked=false;
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
      const onlySavedDays=selection.savedDays&&!selection.notes&&!selection.attachments,details=[];
      if(selection.savedDays)details.push(`${counts.savedDays} Saved Date / Reflection record${counts.savedDays===1?'':'s'}.`);
      if(selection.notes)details.push(`${counts.notes} Note${counts.notes===1?'':'s'}.`);
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
      if(result.selection.notes)parts.push(`${result.notes} note${result.notes===1?'':'s'}`);
      if(result.selection.attachments)parts.push(`${result.attachmentsRemoved} attachment${result.attachmentsRemoved===1?'':'s'}`);
      let message=parts.length?'Deleted '+parts.join(' · ')+'.':'No selected data needed deletion.';
      if(result.selection.attachments&&result.attachmentsProtected)message+=` Kept ${result.attachmentsProtected} referenced attachment${result.attachmentsProtected===1?'':'s'} still used by retained content.`;
      if(result.sweepPending)message+=' Logical deletion is complete; orphaned attachment bytes will be reclaimed automatically later.';
      return message;
    }
    async function clearLibraryRecords(){
      if(libraryMutationBlocked('clearing Library data',{activeSession:true}))return;
      let counts;try{counts=await loadClearLibraryCounts();}catch(error){setStatus('library-status','Could not inspect Library data safely: '+(error&&error.message||error),false);return;}
      if(!counts.savedDays&&!counts.notes&&!counts.attachments){setStatus('library-status','Library data is already empty.');return;}
      for(let attempt=0;attempt<2;attempt++){
        const choice=await requestClearLibrarySelection(counts);if(!choice){setStatus('library-status','Clear Library cancelled.',true,'cancelled');return;}
        const {selection,plan,forceReferenced}=choice;
        if(libraryMutationBlocked('clearing Library data',{activeSession:true})){setStatus('library-status','Clear Library cancelled.',false);return;}
        if(!await requestClearLibraryConfirmation(choice,counts)){setStatus('library-status','Clear Library cancelled.',true,'cancelled');return;}
        if(libraryMutationBlocked('clearing Library data',{activeSession:true})){setStatus('library-status','Clear Library cancelled.',false);return;}
        const notice=notifications.begin({id:'library-clear',surfaceId:'library-status',title:'Clear Library',message:'Clearing selected Library data…'});
        let cleared=false;
        try{
          const result=await batchAttachments(()=>batchAttachmentMutation(()=>executeClearLibrary({selection,signature:plan.signature,forceReferenced}),{sources:plan.attachments.protectedReferences,notes:selection.notes,days:selection.savedDays,finalReconcile:false}));cleared=true;
          if(selection.savedDays){setLibrarySelectedDate(null);renderLibraryEmptyDetail('Saved Dates / Reflections cleared. Import a backup, save a Study Day from Review, or create a new reflection.');invalidateLibrarySummaryCache();}
          if(selection.notes)notesView.cleared();
          await reconcileAttachments();await renderLibrary();
          const message=clearLibraryResultMessage(result);notice.finish('succeeded',message);return;
        }catch(error){
          const message=error&&error.message||String(error);
          if(message.startsWith('Library data changed while Clear Library was open')&&attempt===0){notice.finish('cancelled','Library data changed while the confirmation was open. Review the refreshed deletion plan.');counts=await loadClearLibraryCounts();continue;}
          if(selection.notes)notesView.refresh();void reconcileAttachments();if(selection.savedDays){invalidateLibrarySummaryCache();void renderLibrary();}
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
      refreshNotes:notesView.refresh,
      updateSearchDocument:record=>notesView.search.update(record),
      openDay:date=>{showSection('days');return openLibraryDayDetail(date);},
      showSection,
      openNote:notesView.select,
      noteDestinations:notesView.destinations,
      revealNoteReference:notesView.reveal,
      filterTag:notesView.filterTag,
      batchAttachmentMutation,
      settleDiary:settleDiaryEdit,
      loadMore:loadMoreLibrary,
      clearAll:clearLibraryRecords
    });
  }
  return freeze({format:'study-director.library-module',contractVersion:1,createView});
});
})();
