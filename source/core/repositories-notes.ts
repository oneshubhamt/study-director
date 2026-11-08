import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {NoteRecord} from '../../types/record-models.ts';
import type {FlushOptions} from '../../types/pilot.ts';
import type {DraftNote,NoteDelta,RawNote,NoteConflict,DeltaResult,NoteMetadataSnapshot,NoteSearchSnapshot,NoteUpdate,NoteMove,NoteDeletion,NotesInput} from '../../types/notes-repository.ts';
const sdNotesRepositoryFactory=(()=>{
'use strict';
const registry=(globalThis as typeof globalThis & {[key:symbol]:ModuleRegistration<'repositories-notes','study-director.notes-repository-module'>|undefined})[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,functionPort:functions}=registry.contracts;
const createModule=()=>{
  const freeze=Object.freeze;
  function create(input:NotesInput){
    exactObject(input,['configuration','storage','codecs','keyedRecord','helpers','hooks','canonical','clock','saveLane'],'Notes repository input');
    const SaveLane=input.saveLane;
    if(!SaveLane||SaveLane.format!=='study-director.save-lane-module'||SaveLane.contractVersion!==1||typeof SaveLane.createLane!=='function')throw new TypeError('Notes save lane is unavailable or incompatible.');
    const configuration=exactObject(input.configuration,['limits','dataContract','stores','keys'],'Notes configuration');
    const stores=exactObject(configuration.stores,['notes','appMeta'],'Notes stores');
    const keys=exactObject(configuration.keys,['noteRescue'],'Notes storage keys');
    const storage=exactObject(input.storage,['local','meta','idbGetAll','idbStoreTransaction','idbStrictTransaction','storageResets'],'Notes storage port');
    if((['idbGetAll','idbStoreTransaction','idbStrictTransaction','storageResets'] as const).some(key=>typeof storage[key]!=='function'))throw new TypeError('Notes storage functions are invalid.');
    const codecs=exactObject(input.codecs,['sanitizeCurrentNote','noteKeys'],'Notes codec port');
    if(typeof codecs.sanitizeCurrentNote!=='function'||!Object.isFrozen(codecs.noteKeys))throw new TypeError('Notes codec port is invalid.');
    if(!Object.isFrozen(input.keyedRecord))throw new TypeError('Notes keyed-record capability must be frozen.');
    const helpers=functions(input.helpers,['clampText','clampEditorContent','editorContentWithinLimits','wipeObject','normalizeAreaName','displayAreaName','normalizeTimestamp','sameDataValue','jsonByteLength','canonicalRuntimeError','isCanonicalRuntimeError','rescueRoom'],'Notes helper port');
    const hooks=functions(input.hooks,['canMutate','storageOk','reportCommit','onNotesChanged','onNoteSyncState','onNoteConflict','saveWarning','diagnosticsCapture'],'Notes hook port');
    const canonical=functions(input.canonical,['noteDeletionValue','notePreparationUnit','stageMutationEpoch','normalizeNoteDeletions'],'Notes canonical port');
    const clock=functions(input.clock,['nowMs'],'Notes clock');
    const APP_LIMITS=configuration.limits,DATA_CONTRACT=configuration.dataContract,DB_NOTES_STORE=stores.notes,DB_APP_META_STORE=stores.appMeta;
    const STORAGE_KEYS=freeze({noteRescue:keys.noteRescue});
    const LocalStorageContract=storage.local,Meta=storage.meta,idbGetAll=storage.idbGetAll,idbStoreTransaction=storage.idbStoreTransaction,idbStrictTransaction=storage.idbStrictTransaction,storageResets=storage.storageResets;
    const sanitizeCurrentNote=codecs.sanitizeCurrentNote,NoteKeys=codecs.noteKeys,KeyedRecord=input.keyedRecord;
    const {clampText,clampEditorContent,editorContentWithinLimits,wipeObject,normalizeAreaName,displayAreaName,normalizeTimestamp,sameDataValue,jsonByteLength,canonicalRuntimeError,isCanonicalRuntimeError,rescueRoom}=helpers;
    const appCanMutate=hooks.canMutate,markStorageHealthOk=hooks.storageOk,reportCanonicalCommit=hooks.reportCommit,refreshNoteConsumers=hooks.onNotesChanged,setNoteSyncStateForKey=hooks.onNoteSyncState,reportNoteConflict=hooks.onNoteConflict,showSubjectNoteSaveWarning=hooks.saveWarning,AppDiagnostics=freeze({capture:hooks.diagnosticsCapture});
    const {noteDeletionValue,notePreparationUnit,stageMutationEpoch:stageCanonicalMutationEpoch,normalizeNoteDeletions}=canonical;
    const decisionNowMs=clock.nowMs;
const repository=(()=>{
  const notes=KeyedRecord.create<DraftNote>();
  const dirtyKeys=new Set<string>();
  const dirtyBaseRevisions=new Map<string,string>();
  let storageLossSignalled=false,everLoaded=false,acknowledgedResets=0;
  // The database layer counts a recreated database the moment it opens it,
  // before any transaction on it runs. Storage counts as lost from then until
  // every note this tab holds has been written back.
  const storageLossKnown=()=>storageLossSignalled||(Number(storageResets())||0)>acknowledgedResets;
  // Each change is written straight to the database through the shared save
  // lane, a moment after typing pauses. A browser copy (the rescue) holds
  // unsaved notes only when that write fails or the page is hidden or closed
  // before it finishes.
  // Every note is stored under its permanent id; its title is the label, and
  // the title key (the label normalised) is how plan Areas find it, kept in a
  // lookup rebuilt after any change. Two live notes never share a title.
  // A deleted note stays an ordinary row under its id behind a reserved prefix
  // ('~deleted <id>') for noteTrashDays. It keeps its label and text, and
  // its revision is the time it was deleted. Trash rows leave no deletion
  // record when they go.
  const TRASH_PREFIX=String(DATA_CONTRACT.schemas.Note.trashKeyPrefix||''),TRASH_RETENTION_MS=Number(APP_LIMITS.noteTrashDays)*86400000;
  if(!TRASH_PREFIX||!(TRASH_RETENTION_MS>0))throw new TypeError('Notes trash contract is invalid.');
  const isTrashKey=(key:unknown)=>String(key||'').startsWith(TRASH_PREFIX);
  // A label is normalised into its title once.
  const titleByLabel=new Map<string,string>();
  function titleOf(entry:{label?:unknown}|null|undefined){
    const label=String(entry&&entry.label||'');let title=titleByLabel.get(label);
    if(title===undefined){if(titleByLabel.size>=2*APP_LIMITS.maxNotes)titleByLabel.clear();title=normalizeAreaName(label);titleByLabel.set(label,title);}
    return title;
  }
  function newNoteId(){for(;;){const id=`n_${[...globalThis.crypto.getRandomValues(new Uint8Array(8))].map(value=>value.toString(16).padStart(2,'0')).join('')}`;if(!notes[id]&&!notes[NoteKeys.trash(id)])return id;}}
  // The title lookup is rebuilt only when a title may have changed: a note
  // added, removed or relabelled. Editing text keeps it.
  let changes=0,titleCache:Map<string,string>|null=null,titleCacheAt=-1;
  function setNote(key:string,entry:DraftNote){const before=notes[key];notes[key]=entry;if(!before||before.label!==entry.label)changes++;}
  function dropNote(key:string){delete notes[key];changes++;}
  function replaceNotes(next:Record<string,DraftNote>){wipeObject(notes);Object.assign(notes,next);changes++;}
  function titles(){
    if(titleCacheAt!==changes){titleCache=new Map();for(const [key,entry] of Object.entries(notes))if(!isTrashKey(key)){const title=titleOf(entry);if(title&&!titleCache.has(title))titleCache.set(title,key);}titleCacheAt=changes;}
    return titleCache!;
  }
  function idForTitle(title:unknown){return titles().get(normalizeAreaName(title))||'';}
  // A note is named either by its stored key (its id, or its trash key) or by
  // its title; the two never overlap.
  function keyFor(ref:unknown){const raw=String(ref||'');return NoteKeys.isKey(raw)?(notes[raw]?raw:''):idForTitle(raw);}
  // The title key a live note is shown and edited under; '' for trash.
  function titleKeyFor(key:string){const entry=notes[key];return entry&&!isTrashKey(key)?titleOf(entry):'';}
  function syncState(key:string,state:'saving'|'synced'){const title=titleKeyFor(key);if(title)setNoteSyncStateForKey(title,state);}
  let loadPromise:Promise<boolean>|null=null,lastLoadReadFailed=false;
  let freshLoadPromise:Promise<boolean>|null=null;
  let saveFailed=false;
  let saveMessage='';
  // Unsaved notes the last browser copy could not hold.
  let rescueShortfall:string[]=[],lastRescueShortfallNotice='';
  let snapshotRevision=0,metadataSnapshotCache:NoteMetadataSnapshot|null=null,searchSnapshotCache:NoteSearchSnapshot|null=null;

  // A collection over the note limit is refused whole; cutting it would drop
  // notes without a word.
  // Recently deleted shares the note limit but never blocks a note: at the
  // limit the oldest deleted notes go first.
  function oldestTrashKeys(collection:Readonly<Record<string,DraftNote>>,count:number){return count>0?Object.keys(collection).filter(isTrashKey).sort((a,b)=>String(collection[a]&&collection[a]!.updatedAt||'').localeCompare(String(collection[b]&&collection[b]!.updatedAt||''))||a.localeCompare(b)).slice(0,count):[];}
  function tooManyNotes(count:number){return Object.assign(new RangeError(`Notes are limited to ${APP_LIMITS.maxNotes.toLocaleString()} notes; this would make ${count.toLocaleString()}. Nothing was changed.`),{code:'NOTE_LIMIT'});}
  function normalizePayload(payload:unknown,options:{strictRich?:boolean}={}):Record<string,NoteRecord>{
    const strictRich=options&&options.strictRich===true;
    const out=KeyedRecord.create<NoteRecord>();
    const entries:[string,unknown][]=Object.entries((payload&&typeof payload==='object')?payload:{});
    if(entries.length>APP_LIMITS.maxNotes)throw tooManyNotes(entries.length);
    entries.forEach(([rawKey,rawVal])=>{
      const source:RawNote=(rawVal&&typeof rawVal==='object')?rawVal:{text:String(rawVal||'')};
      const key=String(source.key||rawKey||'');if(!key)return;
      const sourceText=String(source.text||'');
      if(strictRich&&!editorContentWithinLimits(sourceText))throw new RangeError(`Note ${key} exceeds the ${APP_LIMITS.maxRichTextWords.toLocaleString()}-word rich-text limit.`);
      const current=sanitizeCurrentNote(source,key);
      if(current){out[key]=current;return;}
      throw canonicalRuntimeError(`Note ${String(key||rawKey||'?')} is not in the current canonical schema.`);
    });
    return out;
  }
  function hasContent(entry:{text?:unknown}|null|undefined){return !!(entry&&String(entry.text||'').trim());}
  // Time first, so stamps made later sort later.
  function uniqueStamp(){return `${decisionNowMs().toString(36)}${[...globalThis.crypto.getRandomValues(new Uint8Array(4))].map(value=>value.toString(16).padStart(2,'0')).join('')}`;}
  function revision(entry:{updatedAt?:unknown}|null|undefined){return normalizeTimestamp(entry&&entry.updatedAt,'')||'';}
  // A note's revision is its updatedAt, moved forward on every accepted change
  // and never repeated, even when the clock stands still or goes back.
  function nextRevision(previous:unknown){const prior=Date.parse(String(previous||''));return new Date(Math.max(decisionNowMs(),Number.isFinite(prior)?prior+1:0)).toISOString();}
  function timestamp(entry:{updatedAt?:unknown}|null|undefined){
    const n=Date.parse(String(entry&&entry.updatedAt?entry.updatedAt:''));
    return Number.isFinite(n)?n:0;
  }
  function applyDeltas(base:unknown,deltas:Readonly<Record<string,NoteDelta>>){
    const out=normalizePayload(base);
    Object.entries(deltas||{}).forEach(([rawKey,rawEntry])=>{
      const key=String((rawEntry&&rawEntry.key)||rawKey||'');
      if(!key)return;
      if(rawEntry&&rawEntry.deleted){
        const existingTs=timestamp(out[key]);
        const deleteTs=timestamp(rawEntry);
        if(!out[key]||deleteTs>=existingTs)delete out[key];
        return;
      }
      const entry=normalizePayload({[key]:rawEntry})[key];
      if(entry&&(!out[key]||timestamp(entry)>=timestamp(out[key])))out[key]=entry;
    });
    return out;
  }
  // The note a title names, started in memory for its first edit.
  function ensureEntry(title:unknown,label:string=''){
    const safeTitle=normalizeAreaName(title);
    if(!safeTitle||NoteKeys.isKey(safeTitle))return null;
    let id=idForTitle(safeTitle);
    if(!id){id=newNoteId();setNote(id,{version:DATA_CONTRACT.schemas.Note.version,key:id,label:clampText(displayAreaName(label||safeTitle),APP_LIMITS.maxAreaNameChars),text:'',updatedAt:null});}
    return notes[id];
  }
  // What callers see of a note: its permanent id, and as `key` its title key
  // (a deleted note's trash key).
  function noteView(entry:DraftNote|null|undefined){return entry?Object.freeze({id:NoteKeys.id(entry.key),key:isTrashKey(entry.key)?String(entry.key):titleOf(entry),label:String(entry.label||''),text:String(entry.text||''),links:Object.freeze([...(entry.links||[])]),updatedAt:entry.updatedAt}):null;}
  function get(ref:unknown){
    const key=keyFor(ref);
    return key?noteView(notes[key]):null;
  }
  function failure(){return Object.freeze({failed:saveFailed,message:saveMessage});}
  function size(){return Object.keys(notes).length;}
  function canonicalEntrySnapshot(entry:DraftNote|null|undefined,key:string|string | undefined=''):NoteRecord|null{
    const safeKey=String((entry&&entry.key)||key||'');
    if(!safeKey||!entry)return null;
    return {
      version:DATA_CONTRACT.schemas.Note.version,
      key:safeKey,
      label:clampText(displayAreaName(entry.label),APP_LIMITS.maxAreaNameChars),
      text:String(entry.text||''),
      updatedAt:String(entry.updatedAt||''),
      ...(entry.links?{links:[...entry.links]}:{})
    };
  }
  function touchSnapshot(){snapshotRevision=(snapshotRevision+1)%Number.MAX_SAFE_INTEGER;metadataSnapshotCache=null;searchSnapshotCache=null;}
  function metadataSnapshot(){
    if(metadataSnapshotCache&&metadataSnapshotCache.revision===snapshotRevision)return metadataSnapshotCache;
    const records=Object.freeze(Object.values(notes).filter(entry=>!isTrashKey(entry.key)).map(entry=>Object.freeze({id:String(entry.key||''),key:titleOf(entry),label:String(entry.label||''),hasNote:hasContent(entry),updatedAt:String(entry.updatedAt||'')})));
    metadataSnapshotCache=Object.freeze({revision:snapshotRevision,records});return metadataSnapshotCache;
  }
  function searchSnapshot(){
    if(searchSnapshotCache&&searchSnapshotCache.revision===snapshotRevision)return searchSnapshotCache;
    const documents=Object.freeze(Object.values(notes).filter(entry=>hasContent(entry)&&!isTrashKey(entry.key)).map(entry=>Object.freeze({key:titleOf(entry),revision:String(entry.updatedAt||''),value:String(entry.text||'')})));
    searchSnapshotCache=Object.freeze({revision:snapshotRevision,documents});return searchSnapshotCache;
  }
  function clearFailure(){saveFailed=false;saveMessage='';rescueShortfall=[];lastRescueShortfallNotice='';}
  function recordFailure(reason:unknown){
    saveFailed=true;
    const labels=rescueShortfall.map(key=>displayAreaName(notes[key]&&notes[key]!.label||key)),named=labels.length>3?`${labels.slice(0,3).join(', ')} and ${labels.length-3} more`:labels.join(', ');
    const detail=String(reason||'the note database failed').replace(/[.\s]+$/u,'')+(labels.length?`. The browser's emergency copy holds ${Math.round(APP_LIMITS.noteRescueBytes/104857.6)/10} MiB and could not keep ${named}, so closing this tab now would lose ${labels.length===1?'it':'them'}`:'');
    saveMessage=SaveLane.failureMessage('Notes',detail);
    showSubjectNoteSaveWarning(detail);
  }
  const NOTE_RESCUE_FORMAT='study-director.note-rescue';
  function normalizeRescueEntries(input:unknown):Record<string,NoteDelta>{
    const raw=input as RawNote|null|undefined;
    const out=KeyedRecord.create<NoteDelta>();
    const source=raw&&raw.format===NOTE_RESCUE_FORMAT&&Number(raw.version)===1&&raw.entries&&typeof raw.entries==='object'&&!Array.isArray(raw.entries)?raw.entries:{};
    Object.entries(source as Record<string,RawNote|null>).forEach(([rawKey,rawEntry])=>{
      const key=String((rawEntry&&rawEntry.key)||rawKey||'');if(!key||!rawEntry)return;
      if(rawEntry.deleted){const updatedAt=normalizeTimestamp(rawEntry.updatedAt,null);if(!NoteKeys.isKey(key))throw canonicalRuntimeError(`Note rescue ${key} is not in the current canonical schema.`);if(updatedAt)out[key]={key,deleted:true,updatedAt};return;}
      const clean=sanitizeCurrentNote(rawEntry,key);if(!clean)throw canonicalRuntimeError(`Note rescue ${key} is not in the current canonical schema.`);out[key]=clean;
    });
    return out;
  }
  // Proof that the browser's emergency copy holds only current notes.
  function verifyRescue(){
    const raw=LocalStorageContract.getJson(STORAGE_KEYS.noteRescue,null) as RawNote|null;
    if(LocalStorageContract.lastError)return freeze({ok:false,rows:0,issues:freeze(['note-rescue-unreadable'])});
    if(!raw)return freeze({ok:true,rows:0,issues:freeze([])});
    let valid=false;
    try{valid=raw.format===NOTE_RESCUE_FORMAT&&Number(raw.version)===1&&Number.isFinite(Date.parse(String(raw.updatedAt||'')))&&!!raw.entries&&typeof raw.entries==='object'&&Object.keys(normalizeRescueEntries(raw)).length===Object.keys(raw.entries).length&&jsonByteLength(raw)<=APP_LIMITS.noteRescueBytes;}catch{valid=false;}
    return freeze({ok:valid,rows:1,issues:freeze(valid?[]:['note-rescue-invalid'])});
  }
  function readIndependentRescue(){
    const raw=LocalStorageContract.getJson(STORAGE_KEYS.noteRescue,null),error=LocalStorageContract.lastError;
    if(error)throw error;
    return normalizeRescueEntries(raw);
  }
  // Clearing keeps the copy's own ceiling; protecting new notes uses its share
  // of the emergency budget.
  function persistIndependentRescue(entries:Record<string,NoteDelta>,room:number=APP_LIMITS.noteRescueBytes){
    const updatedAt=new Date().toISOString(),envelope={format:NOTE_RESCUE_FORMAT,version:1,updatedAt,entries};
    if(jsonByteLength(envelope)>room)return false;
    return LocalStorageContract.setJson(STORAGE_KEYS.noteRescue,envelope);
  }
  // The rescue is a snapshot of every note not yet confirmed in the database,
  // newest first while it fits in its share of the emergency-copy budget. Notes it held earlier
  // are part of that set until saved, because loading marks them unsaved. Notes
  // left out are named by the save failure.
  function protectUnsaved(){
    if(!everLoaded||!appCanMutate())return false;
    const keys=[...dirtyBaseRevisions.keys()];
    if(!keys.length){rescueShortfall=[];return true;}
    const deletedAt=new Date().toISOString(),candidates=keys.map(key=>canonicalEntrySnapshot(notes[key],key)||{key,deleted:true as const,updatedAt:deletedAt}).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
    const entries=KeyedRecord.create<NoteDelta>();let complete=true,room=0;
    try{room=rescueRoom();}catch(error){AppDiagnostics.capture('notes.rescue-room',error,'warn');}
    for(const entry of candidates){
      entries[entry.key]=entry;
      if(jsonByteLength({format:NOTE_RESCUE_FORMAT,version:1,updatedAt:deletedAt,entries})>room){delete entries[entry.key];complete=false;}
    }
    const written=Object.keys(entries).length?persistIndependentRescue(entries,room):true;
    rescueShortfall=candidates.filter(entry=>!('deleted' in entry&&entry.deleted)&&(!written||!entries[entry.key])).map(entry=>entry.key);
    // A page-exit rescue can fail before its async IndexedDB save is known to
    // have failed. Name the exposed notes immediately, without claiming that
    // the canonical save has failed or enlarging the shared localStorage cap.
    const risk=rescueShortfall.join('|');
    if(risk!==lastRescueShortfallNotice){
      lastRescueShortfallNotice=risk;
      if(risk){
        const labels=rescueShortfall.map(key=>displayAreaName(notes[key]?.label||key));
        showSubjectNoteSaveWarning(freeze({kind:'rescue-capacity',message:`The browser's ${Math.round(APP_LIMITS.noteRescueBytes/104857.6)/10} MiB emergency copy could not hold unsaved ${labels.length===1?'Note':'Notes'}: ${labels.slice(0,3).join(', ')}${labels.length>3?` and ${labels.length-3} more`:''}. Keep this tab open until Notes finish saving; otherwise these edits may be lost.`}));
      }
    }
    if(!written||!complete)AppDiagnostics.capture('notes.rescue-write',LocalStorageContract.lastError||new Error(`Unsaved notes exceed the ${Math.round(APP_LIMITS.noteRescueBytes/1024)} KB browser copy.`),'error');
    return written&&complete;
  }
  function clearIndependentRescueKeys(keys:readonly string[]){
    const current=readIndependentRescue();if(LocalStorageContract.lastError)return false;let changed=false;
    for(const rawKey of keys||[]){const key=String(rawKey||'');if(key&&Object.hasOwn(current,key)){delete current[key];changed=true;}}
    if(!changed)return true;
    if(!Object.keys(current).length)return LocalStorageContract.remove(STORAGE_KEYS.noteRescue);
    return persistIndependentRescue(current);
  }
  function markDirty(key:string,baseRevision?:unknown){
    const safeKey=String(key||'');
    if(!safeKey)return;
    if(!dirtyBaseRevisions.has(safeKey))dirtyBaseRevisions.set(safeKey,String(baseRevision===undefined?revision(notes[safeKey]):baseRevision||''));
    dirtyKeys.add(safeKey);
    syncState(safeKey,'saving');
    if(appCanMutate())lane.schedule();
  }
  // Two live notes never share a title. Where a collection brings two (a
  // backup, or a write this tab could not see), the one edited last keeps the
  // title and the other is numbered, so nothing is lost or hidden.
  function separateTitles(collection:Record<string,DraftNote>){
    const byTitle=new Map<string,string[]>(),moves:{key:string;label:string}[]=[];
    for(const [key,entry] of Object.entries(collection)){if(isTrashKey(key))continue;const title=titleOf(entry);if(!byTitle.has(title))byTitle.set(title,[]);byTitle.get(title)!.push(key);}
    const taken=new Set(byTitle.keys());
    for(const keys of byTitle.values()){
      if(keys.length<2)continue;
      keys.sort((a,b)=>timestamp(collection[b])-timestamp(collection[a])||a.localeCompare(b));
      for(const key of keys.slice(1)){
        const base=clampText(displayAreaName(collection[key]!.label),Math.max(1,APP_LIMITS.maxAreaNameChars-8));let label='';
        for(let index=2;!label;index+=1){const candidate=`${base} (${index})`;if(!taken.has(normalizeAreaName(candidate)))label=candidate;}
        taken.add(normalizeAreaName(label));moves.push({key,label});
      }
    }
    return moves;
  }
  async function idbRead(){
    const rows=await idbGetAll(DB_NOTES_STORE,'note read aborted'),out=KeyedRecord.create<NoteRecord>();
    for(const row of rows as (RawNote|null)[]){
      const clean=sanitizeCurrentNote(row,row&&row.key);
      if(!clean)throw canonicalRuntimeError(`Note ${String(row&&row.key||'?')} is not in the current canonical schema.`);
      out[clean.key]=clean;
    }
    return out;
  }
  async function idbReplace(payload:unknown,removedKeys:readonly string[]=[],options:{deletedEntries?:unknown;recordDeletes?:boolean}={}){
    const normalized=normalizePayload(payload),deletedEntries=normalizeNoteDeletions(options.deletedEntries||[]),recordDeletes=options.recordDeletes===true;
    const deletedByKey=new Map(deletedEntries.map(entry=>[entry.key,entry]));
    return idbStrictTransaction<void>([DB_NOTES_STORE,DB_APP_META_STORE],'readwrite',(tx,finish)=>{
      const store=tx.objectStore(DB_NOTES_STORE),meta=Meta.view(tx);stageCanonicalMutationEpoch(tx,['*']);store.clear();
      Object.values(normalized).forEach(entry=>{store.put(entry);meta.remove('noteDeletionPrefix',entry.key);});
      if(recordDeletes){const now=new Date().toISOString();for(const rawKey of removedKeys){const key=String(rawKey||'');if(key&&!normalized[key]&&!isTrashKey(key)){const deletion=noteDeletionValue(key,deletedByKey.get(key)?.deletedAt||now)!;meta.put('noteDeletionPrefix',deletion,{suffix:key,updatedAt:deletion.deletedAt});}}}
      for(const entry of deletedEntries)if(!normalized[entry.key]){const deletion=noteDeletionValue(entry.key,entry.deletedAt)!;meta.put('noteDeletionPrefix',deletion,{suffix:entry.key,updatedAt:deletion.deletedAt});}
      tx.oncomplete=()=>finish(true,undefined);
    },'note replacement aborted');
  }
  // A clash keeps this tab's version as a new note, "<Name> (unsaved copy)",
  // numbered when that is taken and stamped past 99, so a name is always found.
  // The copy is added in the transaction that finds the clash: the stored
  // version replaces this tab's version only once the copy is stored. At the
  // note limit the oldest deleted notes make room; with none left nothing is
  // replaced and the note stays unsaved here and in the browser copy.
  function copyLabelBase(entry:NoteRecord,reserve:number){return clampText(displayAreaName(entry.label),Math.max(1,APP_LIMITS.maxAreaNameChars-reserve));}
  function copyLabel(entry:NoteRecord,taken:(title:string)=>boolean){
    const base=copyLabelBase(entry,20);
    for(let index=1;index<100;index+=1){const label=`${base} (unsaved copy${index>1?` ${index}`:''})`;if(!taken(normalizeAreaName(label)))return label;}
    for(;;){const label=`${copyLabelBase(entry,36)} (unsaved copy ${uniqueStamp()})`;if(!taken(normalizeAreaName(label)))return label;}
  }
  async function idbApplyDelta(keys:readonly string[],expectedRevisions:ReadonlyMap<string,string>){
    const uniqueKeys=[...new Set((keys||[]).map(key=>String(key||'')).filter(Boolean))];
    const canonical=new Map(uniqueKeys.map(key=>[key,canonicalEntrySnapshot(notes[key],key)]));
    return idbStrictTransaction<DeltaResult>([DB_NOTES_STORE,DB_APP_META_STORE],'readwrite',(tx,finish)=>{
      const store=tx.objectStore(DB_NOTES_STORE),meta=Meta.view(tx),conflicts:NoteConflict[]=[],committed=KeyedRecord.create<NoteRecord|null>(),evicted:string[]=[],changed=new Set<string>(),deletedAt=new Date().toISOString(),storageLost=storageLossKnown();
      const failOn=<T>(request:IDBRequest<T>,message:string)=>{request.onerror=()=>finish(false,request.error||new Error(message));};
      let remaining=uniqueKeys.length;
      // Requests complete in issue order, so these reads observe the state before
      // any write below. A database without any canonical mutation epoch was
      // recreated (browser data cleared) rather than edited elsewhere.
      const epoch=meta.get('canonicalMutationEpoch');
      failOn(epoch.request,'note epoch read failed');
      uniqueKeys.forEach(key=>{
        const entry=canonical.get(key)!;committed[key]=entry;
        const deletion=meta.get('noteDeletionPrefix',key);
        failOn(deletion.request,'note deletion read failed');
        const request=store.get(key);
        failOn(request,'note revision read failed');
        request.onsuccess=()=>{
          const persistedRaw=(request.result||null) as RawNote|null,persistedRevision=normalizeTimestamp(persistedRaw&&persistedRaw.updatedAt,'')||'';
          const expected=expectedRevisions&&expectedRevisions.has(key)?String(expectedRevisions.get(key)||''):persistedRevision;
          let clash=false;
          if(persistedRevision!==expected){
            // A row that vanished without a deletion record, after the browser
            // removed this site's data, is lost storage rather than a newer
            // decision made elsewhere. Rewrite it from this tab.
            if(persistedRaw||!expected||deletion.value()||!(storageLost||!epoch.value())){
              const persisted=persistedRaw?normalizePayload({[key]:persistedRaw})[key]||null:null;
              const differs=hasContent(entry)&&String(entry.text||'')!==String(persisted&&persisted.text||'');
              conflicts.push({key,persisted,local:differs?entry:null,copy:null,unresolved:false});clash=true;
            }else storageLossSignalled=true;
          }
          if(!clash){changed.add(key);if(entry){store.put(entry);meta.remove('noteDeletionPrefix',key);}else{store.delete(key);if(!isTrashKey(key)){const deletion=noteDeletionValue(key,deletedAt)!;meta.put('noteDeletionPrefix',deletion,{suffix:key,updatedAt:deletion.deletedAt});}}}
          if(--remaining===0)keepClashCopies();
        };
      });
      // Runs after every note in the batch was read and written.
      function keepClashCopies(){
        const pending=conflicts.filter(item=>item.local);
        if(!pending.length){stageWrites();return;}
        const stored=store.getAll();
        failOn(stored,'note read failed');
        stored.onsuccess=()=>{
          const rows=(stored.result||[]) as RawNote[],trash=rows.filter(row=>isTrashKey(row&&row.key)).sort((a,b)=>String(a.updatedAt||'').localeCompare(String(b.updatedAt||''))).map(row=>String(row.key));
          const takenTitles=new Set([...rows.filter(row=>!isTrashKey(row&&row.key)).map(titleOf),...titles().keys()]),takenIds=new Set(rows.map(row=>String(row&&row.key||'')));
          let room=APP_LIMITS.maxNotes-rows.length;
          pending.forEach(item=>{
            while(room<=0&&trash.length){const key=trash.shift()!;store.delete(key);evicted.push(key);changed.add(key);room++;}
            if(room<=0){item.unresolved=true;return;}
            const label=copyLabel(item.local!,title=>!title||takenTitles.has(title));takenTitles.add(normalizeAreaName(label));
            let copyKey=newNoteId();while(takenIds.has(copyKey))copyKey=newNoteId();takenIds.add(copyKey);
            item.copy={version:DATA_CONTRACT.schemas.Note.version,key:copyKey,label,text:String(item.local!.text||''),updatedAt:nextRevision('')};
            // add, never put: an id taken after all fails the batch instead of
            // replacing a stored note.
            failOn(store.add(item.copy),'note copy write failed');meta.remove('noteDeletionPrefix',copyKey);changed.add(copyKey);room--;
          });
          stageWrites();
        };
      }
      function stageWrites(){if(changed.size)stageCanonicalMutationEpoch(tx,[...changed].map(notePreparationUnit));}
      tx.oncomplete=()=>finish(true,{conflicts,committed,evicted,written:changed.size});
    },'note transaction aborted');
  }
  async function performLoad({strict=false}={}){
    const revisionAtStart=snapshotRevision,writesAtStart=lane.tail();
    let loaded:Record<string,NoteRecord>={};lastLoadReadFailed=false;
    await lane.settled();
    const rescueBeforeRead=readIndependentRescue();
    try{
      loaded=await idbRead();
    }catch(e){
      lastLoadReadFailed=true;AppDiagnostics.capture('notes.load',e,'error');
      if(strict||isCanonicalRuntimeError(e))throw e;
    }
    const rescueAfterRead=readIndependentRescue();
    // Notes this tab already loaded but storage no longer holds, without any
    // deletion record, survived a browser data clear only in memory. Keep them
    // and write them back instead of wiping the last copy.
    const survivors=KeyedRecord.create<NoteRecord|null>();
    if(everLoaded&&!lastLoadReadFailed){
      const missing=Object.keys(notes).filter(key=>hasContent(notes[key])&&!loaded[key]&&![rescueBeforeRead,rescueAfterRead].some(source=>source[key]));
      if(missing.length){
        // Without readable metadata a cleared database cannot be told apart from
        // a deletion made in another tab. Leave memory as it is; the reload stays
        // pending and is retried.
        let deleted=null;
        try{
          if(storageLossKnown()||!(await Meta.read('canonicalMutationEpoch')))deleted=new Set((await Meta.list('noteDeletionPrefix')).map(entry=>String(entry!.suffix||'')));
        }catch(error){
          AppDiagnostics.capture('notes.storage-loss-check',error,'warn');lastLoadReadFailed=true;
          throw Object.assign(new Error('Notes could not confirm what storage still holds. Recovery remains pending.'),{code:'NOTE_RECOVERY_UNRESOLVED'});
        }
        if(deleted)for(const key of missing)if(!deleted.has(key))survivors[key]=canonicalEntrySnapshot(notes[key],key);
      }
    }
    // Request results precede transaction completion. An edit or queued save
    // in that interval invalidates this snapshot, including equal timestamps.
    // Keep its dirty state and timers; a later stable recovery can adopt safely.
    if(snapshotRevision!==revisionAtStart||lane.tail()!==writesAtStart){
      lastLoadReadFailed=true;
      throw Object.assign(new Error('Notes changed during recovery. Recovery remains pending.'),{code:'NOTE_RECOVERY_SUPERSEDED'});
    }
    const merged=applyDeltas(applyDeltas(loaded,rescueBeforeRead),rescueAfterRead);
    for(const [key,entry] of Object.entries(survivors)){const clean=normalizePayload({[key]:entry})[key];if(clean&&!merged[key])merged[key]=clean;}
    // Edits this tab has not saved yet stay exactly as they are, with the
    // revision they were made against; saving them settles any clash.
    const unsaved=new Map(dirtyBaseRevisions);
    for(const key of unsaved.keys()){const entry=canonicalEntrySnapshot(notes[key],key),clean=entry?normalizePayload({[key]:entry})[key]:null;if(clean)merged[key]=clean;else delete merged[key];}
    dirtyKeys.clear();
    dirtyBaseRevisions.clear();
    replaceNotes(merged);
    touchSnapshot();
    // Recovered notes that differ from storage are saved; a rescue entry that
    // storage already matches is stale and dropped.
    const stale=[];
    for(const key of new Set([...Object.keys(rescueBeforeRead),...Object.keys(rescueAfterRead),...Object.keys(survivors)])){
      if(sameDataValue(merged[key]||null,loaded[key]||null))stale.push(key);
      else{dirtyKeys.add(key);dirtyBaseRevisions.set(key,revision(loaded[key]));}
    }
    if(stale.length&&!lastLoadReadFailed&&appCanMutate()&&!clearIndependentRescueKeys(stale))AppDiagnostics.capture('notes.rescue-clear',LocalStorageContract.lastError||new Error('Note emergency rescue cleanup failed.'),'warn');
    for(const [key,base] of unsaved){dirtyKeys.add(key);dirtyBaseRevisions.set(key,base);}
    if(appCanMutate())for(const {key,label} of separateTitles(notes)){const entry=notes[key]!;setNote(key,{...entry,label,updatedAt:nextRevision(entry.updatedAt)});markDirty(key,revision(entry));touchSnapshot();}
    everLoaded=true;
    purgeExpiredTrash();
    if(dirtyKeys.size&&appCanMutate())lane.schedule();
    refreshNoteConsumers();
    return true;
  }
  function load(options:{strict?:boolean}={}){
    if(!loadPromise)loadPromise=performLoad().catch(error=>{AppDiagnostics.capture('notes.startup-load',error,'error');if(isCanonicalRuntimeError(error))throw error;return false;});
    if(!options.strict)return loadPromise;
    return loadPromise.then(async loaded=>{
      if(loaded!==true||lastLoadReadFailed)return reloadFresh();
      await idbRead();return true;
    });
  }
  function reloadFresh(){
    if(freshLoadPromise)return freshLoadPromise;
    freshLoadPromise=(async()=>{
      await lane.settled();
      const loaded=await performLoad({strict:true});
      // A successful recovery replaces the failed startup result. Otherwise
      // every maintenance retry reloads notes and invalidates its own progress.
      loadPromise=Promise.resolve(loaded);
      return loaded;
    })().catch(error=>{
      AppDiagnostics.capture('notes.fresh-reload',error,'error');
      throw error;
    }).finally(()=>{freshLoadPromise=null;});
    return freshLoadPromise;
  }
  // Saves run one batch at a time. A batch reads the revision it expects only
  // when it runs, after the previous batch committed.
  const sameEntry=(entry:DraftNote|null|undefined,written:NoteRecord|null)=>JSON.stringify(canonicalEntrySnapshot(entry,written?.key))===JSON.stringify(written||null);
  // Writes one batch of notes in one transaction. A committed note stays
  // pending while this tab already holds something newer than what was written.
  // Returns the notes whose clash could not be settled yet.
  async function commitNotes(deltaKeys:readonly string[],options:FlushOptions={}){
    const expectedRevisions=new Map(deltaKeys.map(key=>[key,dirtyBaseRevisions.has(key)?String(dirtyBaseRevisions.get(key)||''):revision(notes[key])]));
    const result=await idbApplyDelta(deltaKeys,expectedRevisions);
    const conflicts=new Map(result.conflicts.map(item=>[item.key,item]));
    const savedKeys=deltaKeys.filter(key=>!conflicts.has(key));
    let canonicalRefreshNeeded=false,movedEdits=false;const settledKeys:string[]=[],unresolved:string[]=[],reported:{key:string;label:string;copyLabel:string}[]=[];
    savedKeys.forEach(key=>{
      const written=result.committed[key]||null,committedRevision=written?revision(written):'';
      if(dirtyKeys.has(key)||!sameEntry(notes[key],written))dirtyBaseRevisions.set(key,committedRevision);
      else{
        dirtyBaseRevisions.delete(key);settledKeys.push(key);
        syncState(key,'synced');
        if(!committedRevision){dropNote(key);canonicalRefreshNeeded=true;}
      }
    });
    // Deleted notes removed to make room for a copy.
    for(const key of result.evicted){dropNote(key);dirtyKeys.delete(key);dirtyBaseRevisions.delete(key);settledKeys.push(key);canonicalRefreshNeeded=true;}
    conflicts.forEach((item,key)=>{
      const local=notes[key]||null,written=result.committed[key]||null,changedSince=!sameEntry(local,written),title=titleOf(local)||titleOf(item.persisted);
      // Nothing of this tab's version is stored elsewhere yet: keep it as it is
      // and try again. A later attempt stores the copy once there is room.
      if(item.unresolved||!item.copy&&changedSince&&hasContent(local)&&String(local!.text||'')!==String(item.persisted&&item.persisted.text||'')){dirtyKeys.add(key);if(item.unresolved)unresolved.push(key);return;}
      if(item.copy){
        setNote(item.copy.key,item.copy);
        // Edits made while the clash was being settled join the copy.
        if(changedSince&&hasContent(local)&&String(local!.text||'')!==item.copy.text){setNote(item.copy.key,{...item.copy,text:String(local!.text||''),updatedAt:nextRevision(item.copy.updatedAt)});markDirty(item.copy.key,revision(item.copy));movedEdits=true;}
      }
      dirtyKeys.delete(key);dirtyBaseRevisions.delete(key);settledKeys.push(key);
      if(item.persisted)setNote(key,item.persisted);else dropNote(key);
      reported.push(Object.freeze({key:title,label:String(item.persisted&&item.persisted.label||local&&local.label||''),copyLabel:item.copy?item.copy.label:''}));
    });
    if(!clearIndependentRescueKeys(settledKeys))AppDiagnostics.capture('notes.rescue-clear',LocalStorageContract.lastError||new Error('Note emergency rescue cleanup failed.'),'warn');
    if(movedEdits)protectUnsaved();
    if(!unresolved.length)clearFailure();
    markStorageHealthOk('notes','lastStudyDataSaveAt');
    if(result.written)reportCanonicalCommit('note','upsert',null,{backupCapture:options.backupCapture===true});
    if(canonicalRefreshNeeded||reported.length)touchSnapshot();
    if(canonicalRefreshNeeded||reported.length)refreshNoteConsumers();
    reported.forEach(info=>reportNoteConflict(info));
    if(dirtyKeys.size&&!unresolved.length)lane.schedule();
    return unresolved;
  }
  function clashWithoutRoom(keys:readonly string[]){
    const labels=keys.map(key=>displayAreaName(notes[key]&&notes[key]!.label)).join(', ');
    return Object.assign(new Error(`${labels} changed in another tab, and notes are at the ${APP_LIMITS.maxNotes.toLocaleString()}-note limit, so this tab's version cannot be kept as a separate note. Delete a note to make room`),{code:'NOTE_CLASH_NO_ROOM'});
  }
  // The lane's write: every note changed since the last batch. A failed batch
  // stays unsaved, goes to the browser copy, and the lane retries it.
  async function saveDirtyNotes(_value:void,options:FlushOptions={}){
    if(!appCanMutate())return false;
    const keys=[...new Set([...dirtyKeys].map(key=>String(key||'')).filter(Boolean))];dirtyKeys.clear();
    if(!keys.length)return true;
    let unresolved;
    try{unresolved=await commitNotes(keys,options);}
    catch(error){
      keys.forEach(key=>dirtyKeys.add(key));protectUnsaved();
      recordFailure(error&&(error as {message?:unknown}).message?(error as {message?:unknown}).message:'note database failed');throw error;
    }
    if(!unresolved.length)return true;
    const error=clashWithoutRoom(unresolved);protectUnsaved();recordFailure(error.message);throw error;
  }
  const lane=SaveLane.createLane<void,boolean>(freeze({label:'Notes',write:saveDirtyNotes,onState:()=>{},environment:freeze({setTimeout:(callback:()=>void,delay:number)=>setTimeout(callback,delay),clearTimeout:(timer:number)=>clearTimeout(timer)})}));
  // An edit names the note by its title (plan Areas, Execute and the Library
  // find notes that way) or by its stored key. A title without a note starts
  // one; the label follows the spelling given as long as the title stays.
  function updateInternal(ref:unknown,label:unknown,value:unknown,expectedRevision:string='',validatedRich:boolean=false):NoteUpdate{
    if(!appCanMutate())return {status:'rejected',revision:''};
    const raw=String(ref||''),byKey=NoteKeys.isKey(raw),title=byKey?'':normalizeAreaName(raw);
    if(!byKey&&!title)return {status:'rejected',revision:''};
    const key=byKey?raw:idForTitle(title),current=key?notes[key]||null:null;
    if(byKey&&!current)return {status:'rejected',revision:''};
    const currentRevision=revision(current);
    if(String(expectedRevision||'')!==currentRevision){
      reportNoteConflict(Object.freeze({key:titleKeyFor(key)||title,label:current&&current.label||displayAreaName(label||title)}));
      return {status:'conflict',revision:currentRevision};
    }
    const named=normalizeAreaName(current?current.label:title),given=clampText(displayAreaName(label||named),APP_LIMITS.maxAreaNameChars);
    const nextLabel=normalizeAreaName(given)===named?given:clampText(displayAreaName(current?current.label:named),APP_LIMITS.maxAreaNameChars);
    const sourceText=String(value||'');
    if(current&&String(current.text||'')===sourceText&&clampText(displayAreaName(current.label),APP_LIMITS.maxAreaNameChars)===nextLabel)return {status:'unchanged',revision:currentRevision};
    let nextText;
    if(validatedRich)nextText=sourceText;
    else{
      if(!editorContentWithinLimits(sourceText))return {status:'content-limit',revision:currentRevision};
      nextText=clampEditorContent(sourceText,APP_LIMITS.maxNoteChars);
    }
    if(!current&&!nextText.trim())return {status:'unchanged',revision:currentRevision};
    if(!current){
      // A new note counts against the limit; Recently deleted gives way.
      const over=size()+1-APP_LIMITS.maxNotes,room=oldestTrashKeys(notes,over);
      if(room.length<over)return {status:'limit',revision:currentRevision};
      for(const trashKey of room){const trashed=notes[trashKey];dropNote(trashKey);markDirty(trashKey,revision(trashed));}
    }
    const entry=current||ensureEntry(title,nextLabel);
    if(!entry)return {status:'rejected',revision:currentRevision};
    setNote(entry.key,{...entry,text:nextText,label:nextLabel,updatedAt:nextRevision(currentRevision)});
    touchSnapshot();
    markDirty(entry.key,currentRevision);
    return {status:'changed',revision:revision(notes[entry.key])};
  }
  function update(key:unknown,label:unknown,value:unknown,expectedRevision=''){return updateInternal(key,label,value,expectedRevision,false);}
  function updateValidatedRich(key:unknown,label:unknown,value:unknown,expectedRevision=''){return updateInternal(key,label,value,expectedRevision,true);}
  async function repairStaleFailureIfCanonical(){
    if(!saveFailed||dirtyKeys.size)return !saveFailed;
    const revisionAtStart=snapshotRevision,current=prepareExportPayload(notes);
    let canonical,rescue;
    try{
      canonical=normalizePayload(await idbRead());
      if(snapshotRevision!==revisionAtStart||dirtyKeys.size||!sameDataValue(canonical,current))return false;
      rescue=readIndependentRescue();
      for(const [key,entry] of Object.entries(rescue||{})){
        const normalized=normalizePayload({[key]:entry})[key]||null;
        if(!sameDataValue(normalized,current[key]||null))return false;
      }
      const recoveryKeys=Object.keys(rescue||{});
      if(recoveryKeys.length){
        if(!clearIndependentRescueKeys(recoveryKeys))AppDiagnostics.capture('notes.rescue-clear-after-verified-canonical',LocalStorageContract.lastError||new Error('Note emergency rescue cleanup failed after canonical verification.'),'warn');
      }
      if(snapshotRevision!==revisionAtStart||dirtyKeys.size)return false;
      clearFailure();
      return true;
    }catch(error){
      AppDiagnostics.capture('notes.strict-flush-reverify',error,'warn');
      return false;
    }
  }
  async function storageAppearsRecreated(){
    if(storageLossKnown())return true;
    try{return !(await Meta.read('canonicalMutationEpoch'));}
    catch(error){AppDiagnostics.capture('notes.storage-loss-probe',error,'warn');return false;}
  }
  // The browser removed this site's stored data while the page stayed open.
  // Everything this tab still holds is now the best copy: write every note
  // back. Missing rows are accepted; present rows still
  // follow the ordinary revision check.
  async function recoverAfterStorageLoss(){
    const resets=Number(storageResets())||0;
    // Without write control this tab's notes are not the authoritative copy: the
    // tab in control writes its notes back, so this one only acknowledges.
    if(!appCanMutate()){acknowledgedResets=Math.max(acknowledgedResets,resets);return false;}
    storageLossSignalled=true;
    for(const key of Object.keys(notes))markDirty(key);
    await flush();
    const recovered=!saveFailed&&!dirtyKeys.size;
    if(recovered){storageLossSignalled=false;acknowledgedResets=Math.max(acknowledgedResets,resets);}
    return recovered;
  }
  function flush(options:FlushOptions={}):Promise<boolean>{
    const strict=!!(options&&options.strict),backupCapture=options&&options.backupCapture===true;
    if(!appCanMutate())return strict?Promise.reject(new Error('notes cannot flush without write ownership')):lane.settled();
    const writeNow=()=>{if(dirtyKeys.size&&!lane.pending())lane.schedule();return lane.flush({backupCapture}).then(()=>true,()=>false);};
    const pending=writeNow();
    if(!strict)return pending;
    return pending.then(async()=>{
      // Edits that arrived while a clash was settled were moved to its copy;
      // store them now so a strict flush never ends with them only in memory.
      if(dirtyKeys.size&&!saveFailed)await writeNow();
      if(dirtyKeys.size){
        if((await storageAppearsRecreated())&&storageLossKnown()&&(await recoverAfterStorageLoss()))return true;
        throw new Error(saveMessage||'current notes are not safely stored');
      }
      if(saveFailed&&!(await repairStaleFailureIfCanonical())){
        if(!(await storageAppearsRecreated())||!(await recoverAfterStorageLoss()))throw new Error(saveMessage||'current notes are not safely stored');
      }
      return true;
    });
  }
  // Writes what is pending and fails unless these notes are now stored as this
  // tab holds them. Another note that cannot be saved yet does not hold them
  // back, so notes can still be deleted to make room for a clash's copy.
  async function settle(keys:readonly string[]){
    await flush();
    const unsaved=keys.filter(key=>dirtyKeys.has(key)||dirtyBaseRevisions.has(key));
    if(unsaved.length)throw new Error(saveMessage||'current notes are not safely stored');
    return true;
  }
  function prepareExportPayload(payload:unknown){return normalizePayload(payload);}
  function exportPayload(){return prepareExportPayload(notes);}
  async function readFreshPayload(){
    const rescueBeforeRead=readIndependentRescue(),loaded=await idbRead(),rescueAfterRead=readIndependentRescue();
    return prepareExportPayload(applyDeltas(applyDeltas(loaded,rescueBeforeRead),rescueAfterRead));
  }
  async function readFreshItems(keys:readonly string[]){
    const requested=[...new Set((keys||[]).map(key=>String(key||'')).filter(Boolean))];if(!requested.length)return freeze([]);
    await flush({strict:true});if(saveFailed)throw new Error(saveMessage||'current notes are not safely stored');
    const rows=await idbStoreTransaction<unknown[]>(DB_NOTES_STORE,'readonly',(store,tx,finish)=>{
      const out:unknown[]=[];let pending=requested.length,failed=false;
      requested.forEach(key=>{const request=store.get(key);request.onsuccess=()=>{if(request.result)out.push(request.result);if(--pending===0&&!failed)finish(true,out);};request.onerror=()=>{if(failed)return;failed=true;finish(false,request.error||new Error('Note targeted read failed'));};});
    },'Note targeted read aborted');
    const byKey=new Map<string,NoteRecord>();for(const row of (rows||[]) as (RawNote|null)[]){const key=String(row&&row.key||''),clean=normalizePayload({[key]:row})[key];if(clean)byKey.set(clean.key,clean);}return freeze(requested.map(key=>byKey.get(key)||null));
  }
  function resetPendingNoteWrites(){
    lane.cancel();dirtyKeys.clear();dirtyBaseRevisions.clear();
  }
  // Writes a whole collection, from a restore or a combine.
  async function commitCollection(payload:unknown,{merge,deletions=[]}:{merge?:boolean;deletions?:unknown}={}){
    await flush();
    if(saveFailed)throw new Error(saveMessage||'current notes are not safely stored');
    const previous=normalizePayload(notes),imported=normalizePayload(payload,{strictRich:true}),deletedEntries=normalizeNoteDeletions(deletions);
    const next=merge?Object.assign(previous,imported):imported;
    // A note deleted elsewhere moves to Recently deleted here, as trash() does,
    // unless the payload already brings its deleted copy.
    for(const entry of deletedEntries){
      const current=next[entry.key],trashKey=NoteKeys.trash(entry.key);delete next[entry.key];
      if(current&&(hasContent(current)||current.links)&&trashKey&&!next[trashKey])next[trashKey]={...current,key:trashKey,updatedAt:nextRevision(current.updatedAt)};
    }
    const over=Object.keys(next).length-APP_LIMITS.maxNotes,room=oldestTrashKeys(next,over);
    if(room.length<over)throw tooManyNotes(Object.keys(next).length-room.length);
    for(const key of room)delete next[key];
    for(const {key,label} of separateTitles(next))next[key]={...next[key]!,label,updatedAt:nextRevision(next[key]!.updatedAt)};
    const previousKeys=new Set(Object.keys(previous)),nextKeys=new Set(Object.keys(next));
    const removedKeys=[...previousKeys].filter(key=>!nextKeys.has(key));
    resetPendingNoteWrites();
    try{
      await idbReplace(next,removedKeys,{deletedEntries});
      if(!clearIndependentRescueKeys([...previousKeys,...nextKeys]))AppDiagnostics.capture('notes.rescue-clear',LocalStorageContract.lastError||new Error('Note emergency rescue cleanup failed.'),'warn');
      replaceNotes(next);touchSnapshot();clearFailure();
      markStorageHealthOk('notes','lastStudyDataSaveAt');
      reportCanonicalCommit('note','upsert');
      return prepareExportPayload(next);
    }catch(e){
      recordFailure(e&&(e as {message?:unknown}).message?(e as {message?:unknown}).message:'note database failed');
      throw e;
    }
  }
  // A backup's notes are matched to this device's by id. A backup note whose
  // id is unknown here but whose title names a note here is that same note,
  // made separately (on another device, or before ids): it takes this
  // device's id, so a combine compares the two instead of keeping both. A
  // note this device deleted or holds in Recently deleted is known, so it
  // keeps its id and its deletion still applies. Links to a note that took a
  // local id (in the linked-notes bar and #note= in the text) follow it.
  function alignByTitle(payload:unknown,deletedIds:readonly string[]=[]){
    const incoming=normalizePayload(payload),out=KeyedRecord.create<NoteRecord>(),claimed=new Set(Object.keys(incoming)),deleted=new Set(deletedIds),moved=new Map<string,string>();
    for(const [key,entry] of Object.entries(incoming)){
      const known=isTrashKey(key)||notes[key]||notes[NoteKeys.trash(key)]||deleted.has(key),local=known?'':idForTitle(titleOf(entry));
      if(local&&!claimed.has(local)){claimed.add(local);moved.set(key,local);}
    }
    const follow=(id:string)=>moved.get(id)||id;
    for(const [key,entry] of Object.entries(incoming)){
      const next={...entry,key:follow(key)};
      if(moved.size&&next.links){const links=[...new Set(next.links.map(follow))].filter(id=>id!==next.key);if(links.length)next.links=links;else delete next.links;}
      if(moved.size&&next.text)next.text=String(next.text).replace(/#note=([A-Za-z0-9_-]+)/g,(marker:string,id:string)=>moved.has(id)?`#note=${moved.get(id)}`:marker);
      out[next.key]=next;
    }
    return out;
  }
  function replace(payload:unknown){return commitCollection(payload,{merge:false});}
  function reconcile(payload:unknown,deletions:unknown=[]){return commitCollection(payload,{merge:true,deletions});}
  // Removes a note for good. A deletion record keeps a live note from coming
  // back through Combine; a trash row needs none.
  async function removeKey(key:string){
    if(!appCanMutate()||!key||!notes[key])return false;
    await settle([key]);const current=notes[key];if(!current)return false;
    dropNote(key);touchSnapshot();markDirty(key,revision(current));
    await settle([key]);return !notes[key];
  }
  function remove(ref:unknown){return removeKey(keyFor(ref));}
  // Moves a note to Recently deleted under its own id, in one transaction with
  // its deletion record. An empty note is simply removed. Returns the trash
  // key, '' for an empty note, or null when nothing changed.
  async function trash(ref:unknown){
    if(!appCanMutate())return null;
    const id=keyFor(ref);if(!id||isTrashKey(id))return null;
    await settle([id]);const current=notes[id];if(!current)return null;
    if(!hasContent(current)&&!current.links)return await removeKey(id)?'':null;
    const trashKey=NoteKeys.trash(id);
    setNote(trashKey,{...current,key:trashKey,updatedAt:nextRevision(current.updatedAt)});
    dropNote(id);touchSnapshot();markDirty(id,revision(current));markDirty(trashKey,'');
    await settle([id,trashKey]);
    refreshNoteConsumers();
    return trashKey;
  }
  // Puts a deleted note back, with its id, under its title, or
  // "<Title> (restored)" when a note with text already uses that title.
  // Returns the restored title key or null.
  async function restore(trashKey:unknown){
    if(!appCanMutate())return null;
    const key=String(trashKey||''),id=NoteKeys.id(key);if(!isTrashKey(key)||!id||!notes[key]||notes[id])return null;
    await settle([key]);const item=notes[key];if(!item)return null;
    const base=displayAreaName(item.label),free=(candidate:string)=>{const title=normalizeAreaName(candidate);return title&&!idForTitle(title)?title:'';};
    let label=clampText(base,APP_LIMITS.maxAreaNameChars),title=free(label);
    for(let index=1;!title&&index<100;index+=1){label=`${clampText(base,Math.max(1,APP_LIMITS.maxAreaNameChars-20))} (restored${index>1?` ${index}`:''})`;title=free(label);}
    if(!title)return null;
    setNote(id,{...item,key:id,label,updatedAt:nextRevision(item.updatedAt)});
    dropNote(key);touchSnapshot();markDirty(id,'');markDirty(key,revision(item));
    await settle([id,key]);
    refreshNoteConsumers();
    return title;
  }
  // Renames or moves a note together with every note nested under it: only
  // their titles change, so their ids, earlier versions and links stay. Today's
  // plan is never touched: blocks still using an old title start a new note
  // there. Where a new title already holds a note with text, the move happens
  // only with options.merge(existingText,movedText): the existing note keeps
  // its id and takes the combined text, and the moved note is removed.
  async function rename(from:unknown,toLabel:unknown,options:{merge?:(existing:string,moved:string)=>string}={}){
    if(!appCanMutate())return freeze({status:'rejected'});
    const fromKey=keyFor(from),fromTitle=fromKey?titleKeyFor(fromKey):'';
    const source=normalizeAreaName(fromTitle),label=clampText(displayAreaName(toLabel),APP_LIMITS.maxAreaNameChars),target=normalizeAreaName(label);
    if(!source||!target||NoteKeys.isKey(target)||!idForTitle(source))return freeze({status:'rejected'});
    if(target.startsWith(`${source} > `))return freeze({status:'inside-itself'});
    await settle([idForTitle(source),idForTitle(target)].filter(Boolean));if(!idForTitle(source))return freeze({status:'rejected'});
    const depth=source.split(' > ').length,labelParts=label.split(' > ');
    const moves=[...titles()].filter(([title])=>title===source||title.startsWith(`${source} > `)).map(([title,id])=>{
      const parts=displayAreaName(notes[id]!.label).split(' > ');
      return {id,from:title,to:target+title.slice(source.length),label:clampText(parts.length>=depth?[...labelParts,...parts.slice(depth)].join(' > '):displayAreaName(target+title.slice(source.length)),APP_LIMITS.maxAreaNameChars)};
    });
    const movedIds=new Set(moves.map(move=>move.id)),holder=(move:NoteMove)=>{if(move.to===move.from)return '';const id=idForTitle(move.to);return id&&!movedIds.has(id)?id:'';};
    const clashes=moves.filter(move=>holder(move)&&hasContent(notes[holder(move)]));
    if(clashes.length&&typeof options.merge!=='function')return freeze({status:'collision',labels:freeze(clashes.map(move=>String(notes[holder(move)]!.label)))});
    const writes:{id:string;base:DraftNote;entry:DraftNote}[]=[],removals:{id:string;base:DraftNote}[]=[];
    for(const move of moves){
      const moved=notes[move.id]!,existingId=holder(move),existing=existingId?notes[existingId]:null,merging=!!existing&&hasContent(existing);
      if(merging){
        const text=String(options.merge!(String(existing.text||''),String(moved.text||'')));
        if(!editorContentWithinLimits(text))return freeze({status:'content-limit',label:String(existing.label)});
        writes.push({id:existingId,base:existing,entry:{...existing,text,updatedAt:nextRevision([existing,moved].map(revision).filter(Boolean).sort().at(-1)||'')}});
        removals.push({id:move.id,base:moved});
      }else{
        if(existing)removals.push({id:existingId,base:existing});
        writes.push({id:move.id,base:moved,entry:{...moved,label:move.label,updatedAt:nextRevision(moved.updatedAt)}});
      }
    }
    // Every title that is left is freed before a new one is taken.
    for(const {id,base} of removals){dropNote(id);markDirty(id,revision(base));}
    for(const {id,base,entry} of writes){setNote(id,entry);markDirty(id,revision(base));}
    touchSnapshot();
    await settle([...removals,...writes].map(item=>item.id));
    refreshNoteConsumers();
    return freeze({status:'renamed',key:target,moved:freeze(moves.map(move=>freeze({from:move.from,to:move.to}))),merged:clashes.length});
  }
  // A note's bar lists other notes by id. Ids of notes gone for good (neither
  // live nor in Recently deleted) are dropped whenever the bar changes.
  function keptLinks(entry:DraftNote){const self=NoteKeys.id(entry.key);return (entry.links||[]).filter(id=>id!==self&&(notes[id]||notes[NoteKeys.trash(id)]));}
  // Adds another note to a note's bar, or removes it (on:false). A title with
  // no note yet gets one, so a block's bar can be filled before its note is
  // written.
  function link(ref:unknown,id:unknown,{on=true,label=''}={}){
    if(!appCanMutate())return freeze({status:'rejected'});
    const target=String(id||''),raw=String(ref||'');if(!NoteKeys.isId(target)||on&&!notes[target])return freeze({status:'rejected'});
    let key=keyFor(raw);
    if(!key&&on&&!NoteKeys.isKey(raw)){
      const over=size()+1-APP_LIMITS.maxNotes,room=oldestTrashKeys(notes,over);
      if(room.length<over)return freeze({status:'limit'});
      for(const trashKey of room){const trashed=notes[trashKey];dropNote(trashKey);markDirty(trashKey,revision(trashed));}
      key=ensureEntry(raw,label)?.key||'';
    }
    const current=key&&!isTrashKey(key)?notes[key]:null;if(!current||key===target)return freeze({status:'rejected'});
    const kept=keptLinks(current),links=on?(kept.includes(target)?kept:[...kept,target]):kept.filter(other=>other!==target);
    if(links.length>APP_LIMITS.maxNoteLinks)return freeze({status:'limit'});
    if(links.join('|')===(current.links||[]).join('|'))return freeze({status:'unchanged'});
    const next={...current,updatedAt:nextRevision(current.updatedAt)};delete next.links;if(links.length)next.links=links;
    setNote(key,next);touchSnapshot();markDirty(key,revision(current));refreshNoteConsumers();
    return freeze({status:'changed',id:key});
  }
  // Notes whose bar or text links to this one. Worked out, never stored.
  function linkedFrom(ref:unknown){
    const key=keyFor(ref);if(!key||isTrashKey(key))return freeze([]);
    const marker=`#note=${key}`;
    return freeze(Object.values(notes).filter(entry=>!isTrashKey(entry.key)&&entry.key!==key&&((entry.links||[]).includes(key)||String(entry.text||'').includes(marker))).map(noteView).sort((a,b)=>a!.label.localeCompare(b!.label)));
  }
  function trashExpired(entry:DraftNote|undefined,now:number=decisionNowMs()){return timestamp(entry)<=now-TRASH_RETENTION_MS;}
  function trashSnapshot(){
    const now=decisionNowMs();
    return freeze(Object.values(notes).filter(entry=>isTrashKey(entry.key)&&!trashExpired(entry,now)).map(entry=>freeze({key:entry.key,id:NoteKeys.id(entry.key),label:String(entry.label||''),deletedAt:String(entry.updatedAt||''),hasNote:hasContent(entry)})).sort((a,b)=>b.deletedAt.localeCompare(a.deletedAt)));
  }
  // Deleted notes past their retention are removed on load, when the trash is
  // shown and by the daily upkeep; saving follows the ordinary path.
  function purgeExpiredTrash(){
    if(!everLoaded||!appCanMutate())return 0;
    const now=decisionNowMs(),expired=Object.keys(notes).filter(key=>isTrashKey(key)&&trashExpired(notes[key],now));
    for(const key of expired){const current=notes[key];dropNote(key);markDirty(key,revision(current));}
    if(expired.length)touchSnapshot();
    return expired.length;
  }
  async function clearAllNotes(){
    if(!appCanMutate())throw new Error('notes cannot be cleared without write ownership');
    await flush({strict:true});
    if(saveFailed)throw new Error(saveMessage||'current notes are not safely stored');
    const removedKeys=Object.keys(normalizePayload(notes));
    if(!removedKeys.length)return Object.freeze({count:0});
    resetPendingNoteWrites();
    try{
      const deletedAt=new Date().toISOString(),deletions=removedKeys.filter(key=>!isTrashKey(key)).map(key=>({key,deletedAt}));
      await idbReplace(KeyedRecord.create(),removedKeys,{deletedEntries:deletions,recordDeletes:true});
      if(!clearIndependentRescueKeys(removedKeys))AppDiagnostics.capture('notes.rescue-clear',LocalStorageContract.lastError||new Error('Note emergency rescue cleanup failed.'),'warn');
      replaceNotes(KeyedRecord.create());touchSnapshot();clearFailure();
      markStorageHealthOk('notes','lastStudyDataSaveAt');
      refreshNoteConsumers();
      reportCanonicalCommit('note','delete');
      return Object.freeze({count:removedKeys.length});
    }catch(e){
      recordFailure(e&&(e as {message?:unknown}).message?(e as {message?:unknown}).message:'note database failed');
      throw e;
    }
  }
  return Object.freeze({get,update,updateValidatedRich,link,linkedFrom,remove,clearAll:clearAllNotes,load,reloadFresh,readFreshPayload,readFreshItems,flush,protectUnsaved,trash,restore,rename,trashSnapshot,purgeExpiredTrash,exportPayload,replace,reconcile,alignByTitle,normalizePayload,metadataSnapshot,searchSnapshot,size,failure,verifyRescue,recoverAfterStorageLoss});
})();

    return repository;
  }
  return freeze({format:'study-director.notes-repository-module',contractVersion:1,create});
};
registry.define('repositories-notes',1,createModule);
return createModule;
})();
export type NotesRepositoryModule=ReturnType<typeof sdNotesRepositoryFactory>;
