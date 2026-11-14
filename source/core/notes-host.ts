import type {Task} from '../../types/domain.ts';
import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {
  ApplicableNotes,LibraryNoteRenameResult,LibraryNoteWorkflowInput,LibraryNoteWorkflows,
  NoteAreaIdentity,NoteCatalogueEntry,NoteCatalogueInput,NoteConflictInfo,NoteEditorBinding,NoteInheritedEntry,NoteSyncState,
  NotesHostInput,NotesHostModule as NotesHostContract,NotesRuntime,ValidatedRichInput
} from '../../types/notes-host.ts';

const sdNotesHostFactory=(()=>{
'use strict';
const registry=(globalThis as typeof globalThis & {[key:symbol]:ModuleRegistration<'notes-host','study-director.notes-host-module'>|undefined})[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1)throw new Error('Study Director internal module registry is unavailable or incompatible.');
const {exactFrozenObject:exactObject}=registry.contracts,freeze=Object.freeze;
const BINDING_VERSION='area-v3' as const;
const TASK_SCOPE='task',AREA_SCOPE='area';

function createController(input:Readonly<NotesHostInput>):Readonly<NotesRuntime>{
  exactObject(input,['configuration','repository','tasks','taskIdentity','domain','lifecycle','ownership','richText','tags','mutation','view','environment'],'Notes host input');
  for(const [label,value] of Object.entries({
    configuration:input.configuration,repository:input.repository,taskIdentity:input.taskIdentity,domain:input.domain,lifecycle:input.lifecycle,
    ownership:input.ownership,richText:input.richText,tags:input.tags,mutation:input.mutation,view:input.view,environment:input.environment
  })) if(!Object.isFrozen(value))throw new TypeError(`Notes ${label} provider must be frozen.`);
  const {configuration,repository,taskIdentity,domain,lifecycle,ownership,richText,tags,mutation,view,environment}=input;
  let catalogueCache:Readonly<{revision:number;hierarchy:string;entries:readonly NoteCatalogueEntry[]}>|null=null;

  const taskList=()=>input.tasks();
  const storedValueForKey=(key:unknown)=>{const entry=repository.get(key);return entry&&entry.text?String(entry.text):'';};
  const textForKey=(key:unknown)=>richText.plain(storedValueForKey(key));
  function editorContent(binding:Pick<NoteEditorBinding,'key'>,value:unknown){
    const current=String(value??'');if(richText.isRich(current))return current;
    const stored=storedValueForKey(binding&&binding.key);
    return current===richText.plain(stored)?stored:current;
  }
  function inheritedEntries(areaKey:unknown):readonly NoteInheritedEntry[]{
    return freeze(domain.areaParentKeys(domain.normalizeAreaName(areaKey))
      .map(key=>repository.get(key))
      .filter((entry):entry is NonNullable<typeof entry>=>!!entry&&!!String(entry.text||'').trim())
      .map(entry=>freeze({key:entry.key,label:entry.label||domain.displayAreaName(entry.key),value:String(entry.text||''),text:richText.plain(entry.text||'')}))
      .reverse());
  }
  function applicableForTask(task:Task|undefined):ApplicableNotes{
    const exactKey=task?domain.noteKeyForTask(task):'',exactLabel=task?domain.noteLabelForTask(task):'';
    if(!task||!domain.hasOngoingTaskNotes(task))return freeze({exactKey,exactLabel,exactText:'',inherited:freeze([])});
    const exact=repository.get(exactKey),inherited=domain.isSupportBlock(task)?freeze([]):inheritedEntries(exactKey);
    return freeze({exactKey,exactLabel:exact?exact.label:exactLabel,exactText:exact?richText.plain(exact.text||''):'',inherited});
  }
  function normalizeAreaInput(value:unknown):NoteAreaIdentity|null{
    const raw=domain.clampText(String(value||'').trim(),configuration.maxAreaNameChars),key=domain.normalizeAreaName(raw);
    return key?freeze({key,label:domain.clampText(domain.displayAreaName(raw),configuration.maxAreaNameChars)}):null;
  }
  function orderEntries(source:readonly NoteCatalogueInput[]):readonly NoteCatalogueEntry[]{
    type WorkEntry={key:string;id:string;label:string;hasNote:boolean;current:boolean;updatedAt:string;ephemeral:boolean;support:boolean;depth?:number};
    const entries=new Map<string,WorkEntry>();
    (source||[]).forEach(raw=>{
      if(!raw||typeof raw!=='object')return;
      const row=raw;
      const key=domain.normalizeAreaName(row.key||row.label);if(!key)return;
      const existing=entries.get(key)||{key,id:'',label:domain.displayAreaName(row.label||key),hasNote:false,current:false,updatedAt:'',ephemeral:false,support:false};
      if(row.id)existing.id=String(row.id);if(row.label)existing.label=domain.displayAreaName(row.label);
      const text=row.text===undefined?'':String(row.text||'');existing.hasNote=existing.hasNote||!!row.hasNote||!!text.trim();
      existing.current=existing.current||!!row.current;existing.ephemeral=existing.ephemeral||!!row.ephemeral;
      existing.support=existing.support||!!row.support||key===configuration.supportNote.key;if(row.updatedAt)existing.updatedAt=String(row.updatedAt);
      entries.set(key,existing);
    });
    const parentKey=(key:string)=>{const parts=key.split(' > ');return parts.length>1?parts.slice(0,-1).join(' > '):'';};
    const values=[...entries.values()],children=new Map<string,WorkEntry[]>();
    values.forEach(entry=>{const parent=parentKey(entry.key),group=children.get(parent)||[];group.push(entry);children.set(parent,group);});
    const compare=(a:WorkEntry,b:WorkEntry)=>(Number(b.support)-Number(a.support))||a.label.localeCompare(b.label,undefined,{sensitivity:'base',numeric:true});
    children.forEach(group=>group.sort(compare));
    const ordered:WorkEntry[]=[],seen=new Set<string>(),visit=(entry:WorkEntry)=>{if(seen.has(entry.key))return;seen.add(entry.key);ordered.push(entry);(children.get(entry.key)||[]).forEach(visit);};
    (children.get('')||[]).forEach(visit);values.filter(entry=>!seen.has(entry.key)).sort(compare).forEach(visit);
    return freeze(ordered.map(entry=>freeze({...entry,depth:Math.max(0,entry.key.split(' > ').length-1)})));
  }
  const hierarchySignature=()=>taskList().filter(domain.hasOngoingTaskNotes).map(task=>`${domain.noteKeyForTask(task)}\u0000${domain.noteLabelForTask(task)}`).join('\u0001');
  function catalogue():readonly NoteCatalogueEntry[]{
    const snapshot=repository.metadataSnapshot(),hierarchy=hierarchySignature();
    if(catalogueCache&&catalogueCache.revision===snapshot.revision&&catalogueCache.hierarchy===hierarchy)return catalogueCache.entries;
    const entries=new Map<string,{key:string;id:string;label:string;hasNote:boolean;current:boolean;updatedAt:string;support:boolean}>();
    const ensure=(key:unknown,label:unknown,options:Readonly<{hasNote?:boolean;current?:boolean;updatedAt?:string;id?:string}>={})=>{
      const safeKey=domain.normalizeAreaName(key);if(!safeKey)return;
      const support=safeKey===configuration.supportNote.key,existing=entries.get(safeKey)||{key:safeKey,id:'',label:support?configuration.supportNote.label:domain.displayAreaName(label||safeKey),hasNote:false,current:false,updatedAt:'',support};
      if(options.id)existing.id=options.id;if(label)existing.label=support?configuration.supportNote.label:domain.displayAreaName(label);
      existing.hasNote=!!existing.hasNote||!!options.hasNote;existing.current=!!existing.current||!!options.current;if(options.updatedAt)existing.updatedAt=options.updatedAt;entries.set(safeKey,existing);
    };
    snapshot.records.forEach(entry=>ensure(entry.key,entry.label,{hasNote:entry.hasNote,updatedAt:entry.updatedAt,id:entry.id}));
    taskList().filter(domain.hasOngoingTaskNotes).forEach(task=>ensure(domain.noteKeyForTask(task),domain.noteLabelForTask(task),{current:true}));
    [...entries.values()].forEach(entry=>{const labelParts=domain.displayAreaName(entry.label).split(' > ');domain.areaParentKeys(entry.key).forEach((key,index)=>ensure(key,labelParts.slice(0,index+1).join(' > ')));});
    const ordered=orderEntries([...entries.values()]);catalogueCache=freeze({revision:snapshot.revision,hierarchy,entries:ordered});return ordered;
  }
  function taskIdentityFor(index:number):NoteEditorBinding|null{
    const idx=taskIdentity.validIndex(index);if(idx===null)return null;const task=taskList()[idx];if(!task||!domain.hasOngoingTaskNotes(task))return null;
    const key=domain.noteKeyForTask(task),taskId=taskIdentity.idAt(idx),scheduleRevision=taskIdentity.scheduleRevision(),entry=repository.get(key);
    if(!key||!taskId||!Number.isInteger(scheduleRevision)||scheduleRevision<1)return null;
    return freeze({idx,key,label:domain.noteLabelForTask(task),taskId,scheduleRevision,lifecycleRevision:lifecycle.revision(),ownershipRevision:ownership.revision(),noteRevision:String(entry?.updatedAt||''),noteId:String(entry?.id||'')});
  }
  function clearEditor(field:HTMLTextAreaElement|null){
    if(!field)return false;richText.closeField(field);
    ['noteIdx','areaKey','areaLabel','taskId','scheduleRevision','lifecycleRevision','noteOwnershipRevision','noteRevision','noteId','noteBinding','noteBindingState','noteScope','noteSource','richSyncState','richSyncStatus'].forEach(key=>delete field.dataset[key]);
    field.removeAttribute('aria-label');return true;
  }
  function writeBinding(field:HTMLTextAreaElement,binding:NoteEditorBinding,scope:string,source:string){
    field.dataset['areaKey']=binding.key;field.dataset['areaLabel']=binding.label;field.dataset['lifecycleRevision']=String(binding.lifecycleRevision);field.dataset['noteOwnershipRevision']=String(binding.ownershipRevision);
    field.dataset['noteRevision']=binding.noteRevision;field.dataset['noteId']=binding.noteId;field.dataset['noteBinding']=BINDING_VERSION;field.dataset['noteBindingState']='current';field.dataset['noteScope']=scope;field.dataset['noteSource']=source;
    if(binding.idx!==null)field.dataset['noteIdx']=String(binding.idx);else delete field.dataset['noteIdx'];
    if(binding.taskId)field.dataset['taskId']=binding.taskId;else delete field.dataset['taskId'];
    if(binding.scheduleRevision!==null)field.dataset['scheduleRevision']=String(binding.scheduleRevision);else delete field.dataset['scheduleRevision'];
    field.dataset['richSyncState']=ownership.canMutate()?'saved':'read-only';field.dataset['richSyncStatus']=ownership.canMutate()?'Saved':'Read-only';
    field.setAttribute('aria-label',`Note for ${binding.label}`);field.maxLength=configuration.maxNoteChars;environment.queueMicrotask(()=>{if(field.isConnected)richText.syncField(field);});return binding;
  }
  function bindTaskEditor(field:HTMLTextAreaElement,index:number,source='field'){
    const identity=taskIdentityFor(index);if(!identity){clearEditor(field);return null;}
    const previous=domain.normalizeAreaName(field.dataset['areaKey']);if(field.dataset['noteBinding']===BINDING_VERSION&&previous&&previous!==identity.key)richText.closeField(field);
    return writeBinding(field,identity,TASK_SCOPE,String(source||'field'));
  }
  function bindAreaEditor(field:HTMLTextAreaElement,areaKey:unknown,areaLabel:unknown='',source='library'){
    const key=domain.normalizeAreaName(areaKey);if(!key){clearEditor(field);return null;}const entry=repository.get(key),label=entry?.label||domain.displayAreaName(areaLabel||key);
    clearEditor(field);
    return writeBinding(field,freeze({idx:null,key,label,taskId:'',scheduleRevision:null,lifecycleRevision:lifecycle.revision(),ownershipRevision:ownership.revision(),noteRevision:String(entry?.updatedAt||''),noteId:String(entry?.id||'')}),AREA_SCOPE,String(source||'library'));
  }
  function editorVisible(field:HTMLTextAreaElement){
    if(field.isConnected===false)return false;const pane=field.closest('.pane');if(pane instanceof HTMLElement&&(pane.hidden||!pane.classList.contains('on')))return false;
    const details=field.closest('details');if(details instanceof HTMLDetailsElement&&!details.open)return false;
    const reviewPanel=field.closest('.review-edit-panel');if(reviewPanel&&!reviewPanel.closest('.rcard.editing'))return false;return true;
  }
  const stale=(field:HTMLTextAreaElement)=>{field.dataset['noteBindingState']='stale';return null;};
  function resolveEditor(field:HTMLTextAreaElement|null,{requireVisible=true}:Readonly<{requireVisible?:boolean}>={}):NoteEditorBinding|null{
    if(!field||field.isConnected===false||requireVisible&&!editorVisible(field))return null;
    if(field.dataset['richExternalConflict']==='1'){field.dataset['noteBindingState']='conflict';return null;}
    if(field.dataset['noteBinding']!==BINDING_VERSION)return null;
    const key=domain.normalizeAreaName(field.dataset['areaKey']),label=domain.displayAreaName(field.dataset['areaLabel']||key),life=Number(field.dataset['lifecycleRevision']),owner=Number(field.dataset['noteOwnershipRevision']);
    if(!ownership.canMutate()||!lifecycle.canWrite()||!key||!Number.isInteger(life)||life!==lifecycle.revision()||!Number.isInteger(owner)||owner!==ownership.revision())return stale(field);
    const entry=repository.get(key),noteId=String(field.dataset['noteId']||''),noteRevision=String(field.dataset['noteRevision']||'');
    if(noteId&&(!entry||entry.id!==noteId))return stale(field);
    if(field.dataset['noteScope']===AREA_SCOPE){field.dataset['noteBindingState']='current';return freeze({idx:null,key,label,taskId:'',scheduleRevision:null,lifecycleRevision:life,ownershipRevision:owner,noteRevision,noteId});}
    const taskId=String(field.dataset['taskId']||'').trim(),scheduleRevision=Number(field.dataset['scheduleRevision']);
    if(!taskId||!Number.isInteger(scheduleRevision)||scheduleRevision!==taskIdentity.scheduleRevision())return stale(field);
    const idx=taskIdentity.indexForId(taskId);if(idx===null)return stale(field);const task=taskList()[idx];
    if(!task||!domain.hasOngoingTaskNotes(task)||domain.noteKeyForTask(task)!==key)return stale(field);
    field.dataset['noteIdx']=String(idx);field.dataset['noteBindingState']='current';
    return freeze({idx,key,label:domain.noteLabelForTask(task),taskId,scheduleRevision,lifecycleRevision:life,ownershipRevision:owner,noteRevision,noteId});
  }
  function refreshFieldsForKey(key:unknown,originField:HTMLTextAreaElement|null=null,derived:ValidatedRichInput|null=null,options:Readonly<{deferRichMirrors?:boolean}>={}){
    const safeKey=domain.normalizeAreaName(key);if(!safeKey)return;const defer=options.deferRichMirrors===true,entry=repository.get(safeKey),stored=entry?.text?String(entry.text):'',revision=String(entry?.updatedAt||''),id=String(entry?.id||'');
    let plainCache=derived&&derived.canonical===stored?derived.plain:null;const plain=()=>plainCache===null?(plainCache=richText.plain(stored)):plainCache;
    view.document.querySelectorAll<HTMLTextAreaElement>('.task-note-field[data-area-key]').forEach(field=>{
      if(domain.normalizeAreaName(field.dataset['areaKey'])!==safeKey)return;const external=field===originField?freeze({status:'origin'}):richText.reconcileExternal(field,stored,revision);if(external.status==='conflict')return;
      if(field!==originField){const value=plain();if(field.value!==value)field.value=value;}field.dataset['noteRevision']=revision;field.dataset['noteId']=id;if(field===originField||!defer)richText.syncField(field);
    });
    view.document.querySelectorAll<HTMLElement>('.review-block-note[data-area-key]').forEach(box=>{if(domain.normalizeAreaName(box.dataset['areaKey'])!==safeKey)return;if(!defer)richText.render(box,stored,box.dataset['noteSupport']==='true'?'No current shared support note.':'No current note for this area.',`Note for ${entry?.label||domain.displayAreaName(safeKey)}`);box.classList.toggle('review-block-empty',!plain().trim());});
  }
  function refreshAllFields(){const keys=new Set<string>();view.document.querySelectorAll<HTMLElement>('.task-note-field[data-area-key],.review-block-note[data-area-key]').forEach(node=>{const key=domain.normalizeAreaName(node.dataset['areaKey']);if(key)keys.add(key);});keys.forEach(key=>refreshFieldsForKey(key));}
  function setSyncState(key:unknown,state:NoteSyncState){
    const safeKey=domain.normalizeAreaName(key);if(!safeKey)return false;const message=state==='saving'?'Saving note…':state==='conflict'?'Newer saved note detected · this edit is not being saved. Reopen the note to load it.':'Synced',symbol=state==='saving'?'…':state==='conflict'?'!':'✓';
    const apply=(el:HTMLElement)=>{el.textContent=symbol;el.removeAttribute('title');el.setAttribute('aria-label',message);el.classList.remove('idle');el.classList.toggle('saving',state==='saving');el.classList.toggle('err',state==='conflict');view.syncPopover(el);};
    view.document.querySelectorAll<HTMLTextAreaElement>('textarea.task-note-field[data-area-key]').forEach(field=>{if(domain.normalizeAreaName(field.dataset['areaKey'])===safeKey){field.dataset['richSyncState']=state;field.dataset['richSyncStatus']=message;}});
    view.document.querySelectorAll<HTMLElement>('.note-sync[data-area-key]').forEach(element=>{if(domain.normalizeAreaName(element.dataset['areaKey'])===safeKey)apply(element);});
    const pn=view.document.getElementById('pn-sync'),idx=view.currentTaskIndex(),task=taskList()[idx],field=view.document.getElementById('pn-extra') as HTMLTextAreaElement|null;
    const current=task&&domain.isTrackableBlock(task)?(field?.dataset['areaKey']||domain.noteKeyForTask(task)):'';
    if(pn&&domain.normalizeAreaName(current)===safeKey)apply(pn);if(state==='synced')view.publishSafetyNotice('','Note saved','note-conflict');return true;
  }
  function reportConflict(info:NoteConflictInfo={}){
    const key=domain.normalizeAreaName(info.key),label=domain.displayAreaName(info.label||key||'this area');if(!key)return false;const copyLabel=String(info.copyLabel||'').trim();
    const message=copyLabel?`A different version of the ${label} note was already stored. Study Director kept that version and saved your edit as the note “${copyLabel}”.`:`A newer note for ${label} was saved elsewhere. Study Director kept the newer note and rejected the outdated edit.`;
    setSyncState(key,'conflict');view.setPlanStatus(message,false);view.setStatus('save-status',message,false);view.setStatus('notes-status',message,false);view.publishSafetyNotice(message,'Note editing conflict','note-conflict');return true;
  }
  function updateSearchText(key:unknown,plain:unknown){const entry=key?repository.get(key):null;if(entry)view.updateSearchDocument(freeze({key:entry.key,revision:String(entry.updatedAt||''),plain:String(plain||'')}));}
  function commitEditor(field:HTMLTextAreaElement,value:unknown,event:Event|null=null){
    if(!ownership.canMutate()||!lifecycle.canWrite()){field.dataset['noteBindingState']='stale';return false;}const binding=resolveEditor(field,{requireVisible:true});if(!binding)return false;
    const trusted=richText.validatedInput(event,field),candidate=trusted?trusted.canonical:editorContent(binding,value);
    const result=trusted?repository.updateValidatedRich(binding.key,binding.label,candidate,binding.noteRevision):repository.update(binding.key,binding.label,candidate,binding.noteRevision);
    if(result.status==='conflict'){refreshFieldsForKey(binding.key);if(field.dataset['richExternalConflict']==='1'){field.dataset['noteBindingState']='conflict';setSyncState(binding.key,'conflict');}return false;}
    const canonical=storedValueForKey(binding.key),derived=trusted&&trusted.canonical===canonical?trusted:null;if(field.value!==canonical)field.value=canonical;if(!richText.isRich(canonical))updateSearchText(binding.key,canonical);
    refreshFieldsForKey(binding.key,field,derived,{deferRichMirrors:!!trusted});
    if(result.status==='limit'||result.status==='content-limit'){const message=result.status==='content-limit'?`Notes are limited to ${configuration.maxRichTextWords.toLocaleString()} rich-text words per note.`:`Notes are limited to ${configuration.maxNotes.toLocaleString()} saved notes.`;view.setStatus('notes-status',message,false);view.setStatus('save-status',message,false);view.setPlanStatus(message,false);return false;}
    if(result.status==='rejected')return false;if(result.status==='changed')view.saveLiveDraft();return true;
  }
  function inheritedTextForTask(task:Task|undefined){const inherited=applicableForTask(task).inherited;return inherited.length?inherited.map(entry=>`From ${entry.label}:\n${entry.text}`).join('\n\n'):'';}
  function renderInherited(container:HTMLElement|null,areaKey:unknown,compact=false,{collapsible=false}:Readonly<{collapsible?:boolean}>={}){
    if(!container)return;const inherited=inheritedEntries(areaKey);container.className='subject-note-context'+(compact?' compact':'')+(collapsible?' collapsible':'')+(inherited.length?' on':'');container.replaceChildren();if(!inherited.length)return;
    if(collapsible){inherited.forEach(entry=>{const section=view.document.createElement('details'),label=view.document.createElement('summary'),body=view.document.createElement('div');section.className='subject-note-context-entry';label.className='subject-note-context-entry-label ui-label';label.textContent=`From ${entry.label.replace(/\s*>\s*/g,' › ')}`;body.className='subject-note-context-entry-body';section.append(label,body);container.append(section);section.addEventListener('toggle',()=>{if(section.open&&!body.dataset['rendered']){body.dataset['rendered']='1';richText.render(body,entry.value,'',`Parent note from ${entry.label}`);}});});return;}
    const title=view.document.createElement('div');title.className='subject-note-context-title ui-label';title.textContent='Inherited Parent Notes · Read-only';container.append(title);
    inherited.forEach(entry=>{const section=view.document.createElement('section'),label=view.document.createElement('div'),body=view.document.createElement('div');section.className='subject-note-context-entry';label.className='subject-note-context-entry-label ui-label';label.textContent=`From ${entry.label}`;body.className='subject-note-context-entry-body';section.append(label,body);container.append(section);richText.render(body,entry.value,'',`Inherited note from ${entry.label}`);});
  }
  function renderInheritedForTask(container:HTMLElement|null,task:Task|undefined,compact=false){renderInherited(container,task&&domain.hasOngoingTaskNotes(task)&&!domain.isSupportBlock(task)?domain.noteKeyForTask(task):'',compact);}
  function currentEntriesForTasks(tasks:readonly Task[]){const seen=new Set<string>(),entries:Readonly<{key:string;label:string;text:string}>[]=[];(tasks||[]).filter(domain.hasOngoingTaskNotes).forEach(task=>{const key=domain.noteKeyForTask(task);if(!key||seen.has(key))return;seen.add(key);const entry=repository.get(key);if(entry&&String(entry.text||'').trim())entries.push(freeze({key:entry.key,label:entry.label,text:richText.plain(entry.text||'')}));});return freeze(entries);}
  function refreshConsumers(){catalogueCache=null;if(!lifecycle.canWrite())return false;try{refreshAllFields();view.refreshExecute();view.refreshLibrary();view.requestScheduleRender();view.refreshReviewIfVisible();view.refreshRecovery();return true;}catch{return false;}}
  async function renameTag(from:unknown,to:unknown){
    if(!ownership.canMutate())throw new Error('Use the primary tab to rename tags.');const source=richText.normalizeTag(from),target=richText.normalizeTag(to);if(!source||!target)throw new Error('A tag starts with a letter and uses letters, digits, - or _.');
    return richText.quiesce(()=>mutation.runExclusive('rename-tag',async()=>{await repository.flush({strict:true});let changed=0;const failed:string[]=[];for(const key of tags.tagged([source])){const note=repository.get(key);if(!note)continue;const value=richText.renameTag(note.text,source,target);if(value===note.text)continue;const result=repository.update(note.id,note.label,value,String(note.updatedAt||''));if(result.status==='changed')changed++;else failed.push(note.label);}await repository.flush({strict:true});if(repository.failure().failed)throw new Error('The renamed tags have not saved yet. They will be retried.');return freeze({changed,failed:freeze(failed)});}));
  }
  async function importFiles(files:Iterable<File>|ArrayLike<File>,parent=''){
    if(!ownership.canMutate())throw new Error('Use the primary tab to import notes.');const list=Array.from(files as ArrayLike<File>),made:{id:string;label:string}[]=[],skipped:string[]=[];
    const titleFor=(name:string)=>{const base=domain.clampText(String(name||'').replace(/\.[^.]*$/,'').replace(/\s*>\s*/g,' - ').replace(/[\u0000-\u001f\u007f]/g,'').trim(),120)||'Imported note',full=parent?`${parent} > ${base}`:base;let title=full;for(let count=2;repository.get(title);count++)title=`${full} (${count})`;return title;};
    return richText.quiesce(()=>mutation.runExclusive('import-notes',async()=>{let full=false;for(const file of list){const name=String(file?.name||'file'),match=/\.(md|markdown|txt)$/i.exec(name),kind=match?.[1]?.toLowerCase();if(full){skipped.push(`${name} (notes are at their limit)`);continue;}if(!kind){skipped.push(`${name} (not a .txt or .md file)`);continue;}if(file.size>configuration.maxRichTextBytes){skipped.push(`${name} (too large for one note)`);continue;}let value:string;try{const text=await file.text();value=kind==='txt'?richText.fromText(text):richText.fromMarkdown(text);}catch(error){skipped.push(`${name} (${String((error as {message?:unknown})?.message||'could not be read').replace(/\.$/,'')})`);continue;}if(!value){skipped.push(`${name} (empty)`);continue;}const title=titleFor(name),result=repository.update(title,title,value,'');if(result.status==='changed'){made.push(freeze({id:repository.get(title)?.id||'',label:title}));continue;}skipped.push(`${name} (${result.status==='limit'?'notes are at their limit':result.status==='content-limit'?'too large for one note':'could not be saved'})`);full=result.status==='limit';}if(made.length){await repository.flush({strict:true});if(repository.failure().failed)throw new Error('The imported notes have not saved yet. They will be retried.');}return freeze({made:freeze(made),skipped:freeze(skipped)});}));
  }
  const runtime=freeze({
    format:'study-director.notes-runtime' as const,contractVersion:1 as const,bindingVersion:BINDING_VERSION,
    storedValueForKey,textForKey,editorContent,applicableForTask,inheritedEntries,normalizeAreaInput,orderEntries,catalogue,searchDocuments:()=>repository.searchSnapshot().documents,canCreate:()=>repository.metadataSnapshot().records.length<configuration.maxNotes,size:()=>repository.size(),
    bindTaskEditor,bindAreaEditor,clearEditor,resolveEditor,commitEditor,refreshFieldsForKey,refreshAllFields,setSyncState,reportConflict,refreshConsumers,updateSearchText,renderInherited,renderInheritedForTask,inheritedTextForTask,currentEntriesForTasks,renameTag,importFiles
  });
  return runtime;
}

function createLibraryWorkflows(input:Readonly<LibraryNoteWorkflowInput>):Readonly<LibraryNoteWorkflows>{
  exactObject(input,['runtime','repository','plan','interactions','mergeText'],'Library note workflow input');
  if(!Object.isFrozen(input.runtime)||!Object.isFrozen(input.repository)||!Object.isFrozen(input.plan)||!Object.isFrozen(input.interactions))throw new TypeError('Library note workflow providers must be frozen.');
  const {runtime,repository,plan,interactions,mergeText}=input;
  function areaUse(title:unknown){return plan.areaUse(title);}
  async function rename(entry:Readonly<NoteAreaIdentity>,value:unknown,{renamePlans=false}:Readonly<{renamePlans?:boolean}>={}):Promise<LibraryNoteRenameResult>{
    const identity=runtime.normalizeAreaInput(value);if(!identity||identity.label===entry.label)return freeze({status:'rejected',identity});
    let outcome=await repository.rename(entry.key,identity.label);
    if(outcome.status==='collision'){
      const labels=outcome.labels.join(', '),ok=await interactions.confirm(freeze({title:'Combine existing notes?',message:`“${identity.label}” would overlap ${labels}. Combine the moved note text into the existing note and keep the existing note’s earlier versions?`,confirmLabel:'Combine',cancelLabel:'Cancel'}));
      if(!ok)return freeze({status:'cancelled',identity});outcome=await repository.rename(entry.key,identity.label,{merge:mergeText});
    }
    if(outcome.status!=='renamed')return freeze({status:outcome.status==='inside-itself'?'inside-itself':'rejected',identity});
    let planResult={blocks:0,savedPlans:0},planError:unknown=null;const requested=renamePlans;
    if(requested)try{planResult=await plan.renameArea(entry.key,identity.label);}catch(error){planError=error;}
    return freeze({status:'renamed',identity,moved:freeze(outcome.moved.map(move=>freeze({...move}))),merged:outcome.merged,plan:freeze({requested,ok:planError===null,blocks:planResult.blocks,savedPlans:planResult.savedPlans,error:planError})});
  }
  return freeze({format:'study-director.library-note-workflows' as const,contractVersion:1 as const,areaUse,rename,trash:(key:unknown)=>repository.trash(key),restore:(key:unknown)=>repository.restore(key),remove:(key:unknown)=>repository.remove(key)});
}

const createModule=():NotesHostContract=>freeze({format:'study-director.notes-host-module',contractVersion:1,bindingVersion:BINDING_VERSION,createController,createLibraryWorkflows});
registry.define('notes-host',1,createModule);
return createModule;
})();
export type NotesHostModule=ReturnType<typeof sdNotesHostFactory>;
