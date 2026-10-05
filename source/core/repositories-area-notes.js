(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,functionPort:functions}=registry.contracts;
registry.define('repositories-area-notes',1,()=>{
  const freeze=Object.freeze;
  function create(input){
    exactObject(input,['configuration','storage','codecs','keyedRecord','helpers','hooks','canonical','clock','saveLane'],'Area Notes repository input');
    const SaveLane=input.saveLane;
    if(!SaveLane||SaveLane.format!=='study-director.save-lane-module'||SaveLane.contractVersion!==1||typeof SaveLane.createLane!=='function')throw new TypeError('Area Notes save lane is unavailable or incompatible.');
    const configuration=exactObject(input.configuration,['limits','dataContract','stores','keys','legacyKeys','metaKeys'],'Area Notes configuration');
    const stores=exactObject(configuration.stores,['areaNotes','appMeta'],'Area Notes stores');
    const keys=exactObject(configuration.keys,['areaNoteRescue'],'Area Notes storage keys');
    const legacyKeys=exactObject(configuration.legacyKeys,['areaNotesPending'],'Area Notes legacy storage keys');
    const metaKeys=exactObject(configuration.metaKeys,['areaNoteRecoveryPrefix'],'Area Notes metadata keys');
    const storage=exactObject(input.storage,['local','meta','idbGetAll','idbStoreTransaction','idbStrictTransaction','storageResets'],'Area Notes storage port');
    if(['idbGetAll','idbStoreTransaction','idbStrictTransaction','storageResets'].some(key=>typeof storage[key]!=='function'))throw new TypeError('Area Notes storage functions are invalid.');
    const codecs=exactObject(input.codecs,['compatibility','sanitizeCurrentAreaNote'],'Area Notes codec port');
    if(typeof codecs.sanitizeCurrentAreaNote!=='function'||!Object.isFrozen(codecs.compatibility))throw new TypeError('Area Notes codec port is invalid.');
    if(!Object.isFrozen(input.keyedRecord))throw new TypeError('Area Notes keyed-record capability must be frozen.');
    const helpers=functions(input.helpers,['clampText','clampEditorContent','editorContentWithinLimits','wipeObject','normalizeAreaName','displayAreaName','normalizeTimestamp','sameDataValue','jsonByteLength','canonicalRuntimeError','isCanonicalRuntimeError'],'Area Notes helper port');
    const hooks=functions(input.hooks,['canMutate','assertWriteToken','compatibilityWriteToken','storageOk','reportCommit','onNotesChanged','onNoteSyncState','onNoteConflict','saveWarning','diagnosticsCapture'],'Area Notes hook port');
    const canonical=functions(input.canonical,['areaNoteDeletionValue','areaNotePreparationUnit','stageMutationEpoch','normalizeAreaNoteDeletions'],'Area Notes canonical port');
    const clock=functions(input.clock,['nowMs'],'Area Notes clock');
    const APP_LIMITS=configuration.limits,DATA_CONTRACT=configuration.dataContract,DB_AREA_NOTES_STORE=stores.areaNotes,DB_APP_META_STORE=stores.appMeta;
    const STORAGE_KEYS=freeze({areaNoteRescue:keys.areaNoteRescue}),LEGACY_STORAGE_KEYS=freeze({areaNotesPending:legacyKeys.areaNotesPending}),META_KEYS=freeze({areaNoteRecoveryPrefix:metaKeys.areaNoteRecoveryPrefix});
    const LocalStorageContract=storage.local,Meta=storage.meta,idbGetAll=storage.idbGetAll,idbStoreTransaction=storage.idbStoreTransaction,idbStrictTransaction=storage.idbStrictTransaction,storageResets=storage.storageResets;
    const CompatibilityCodec=codecs.compatibility,sanitizeCurrentAreaNote=codecs.sanitizeCurrentAreaNote,KeyedRecord=input.keyedRecord;
    const {clampText,clampEditorContent,editorContentWithinLimits,wipeObject,normalizeAreaName,displayAreaName,normalizeTimestamp,sameDataValue,jsonByteLength,canonicalRuntimeError,isCanonicalRuntimeError}=helpers;
    const appCanMutate=hooks.canMutate,assertWriteToken=hooks.assertWriteToken,compatibilityWriteToken=hooks.compatibilityWriteToken,markStorageHealthOk=hooks.storageOk,reportCanonicalCommit=hooks.reportCommit,refreshAreaNoteConsumers=hooks.onNotesChanged,setNoteSyncStateForKey=hooks.onNoteSyncState,reportAreaNoteConflict=hooks.onNoteConflict,showSubjectNoteSaveWarning=hooks.saveWarning,AppDiagnostics=freeze({capture:hooks.diagnosticsCapture});
    const {areaNoteDeletionValue,areaNotePreparationUnit,stageMutationEpoch:stageCanonicalMutationEpoch,normalizeAreaNoteDeletions}=canonical;
    const decisionNowMs=clock.nowMs;
const repository=(()=>{
  const notes=KeyedRecord.create();
  const dirtyKeys=new Set();
  const dirtyBaseRevisions=new Map();
  let storageLossSignalled=false,everLoaded=false,acknowledgedResets=0;
  // The database layer counts a recreated database the moment it opens it,
  // before any transaction on it runs. Storage counts as lost from then until
  // every note this tab holds has been written back.
  const storageLossKnown=()=>storageLossSignalled||(Number(storageResets())||0)>acknowledgedResets;
  // Each change is written straight to the database through the shared save
  // lane, a moment after typing pauses. A browser copy (the rescue) holds
  // unsaved notes only when that write fails or the page is hidden or closed
  // before it finishes.
  // A deleted note stays an ordinary row under a reserved key ('~deleted <id>')
  // for areaNoteTrashDays. It keeps its label and text, and its revision is the
  // time it was deleted. Live notes never use the prefix, and trash rows leave
  // no deletion record when they go.
  const TRASH_PREFIX=String(DATA_CONTRACT.schemas.AreaNote.trashKeyPrefix||''),TRASH_RETENTION_MS=Number(APP_LIMITS.areaNoteTrashDays)*86400000;
  if(!TRASH_PREFIX||!(TRASH_RETENTION_MS>0))throw new TypeError('Area Notes trash contract is invalid.');
  const isTrashKey=key=>String(key||'').startsWith(TRASH_PREFIX);
  let loadPromise=null,lastLoadReadFailed=false;
  let freshLoadPromise=null;
  let saveFailed=false;
  let saveMessage='';
  let snapshotRevision=0,metadataSnapshotCache=null,searchSnapshotCache=null;

  // A collection over the note limit is refused whole; cutting it would drop
  // notes without a word.
  function tooManyNotes(count){return Object.assign(new RangeError(`Ongoing Notes are limited to ${APP_LIMITS.maxOngoingNotes.toLocaleString()} notes; this would make ${count.toLocaleString()}. Nothing was changed.`),{code:'AREA_NOTE_LIMIT'});}
  function normalizePayload(payload,options={}){
    const strictRich=options&&options.strictRich===true;
    const out=KeyedRecord.create();
    const entries=Object.entries((payload&&typeof payload==='object')?payload:{});
    if(entries.length>APP_LIMITS.maxOngoingNotes)throw tooManyNotes(entries.length);
    entries.forEach(([rawKey,rawVal])=>{
      const source=(rawVal&&typeof rawVal==='object')?rawVal:{text:String(rawVal||'')};
      const key=normalizeAreaName(source.key||rawKey);if(!key)return;
      const sourceText=String(source.text||'');
      if(strictRich&&!editorContentWithinLimits(sourceText))throw new RangeError(`Ongoing note ${key} exceeds the ${APP_LIMITS.maxRichTextWords.toLocaleString()}-word rich-text limit.`);
      const current=sanitizeCurrentAreaNote(source,key);
      if(current){out[key]=current;return;}
      throw canonicalRuntimeError(`Ongoing Note ${String(key||rawKey||'?')} is not in the current canonical schema.`);
    });
    return out;
  }
  function normalizeHistoricalPayloadForMigration(payload){
    const out=KeyedRecord.create();
    const entries=Object.entries((payload&&typeof payload==='object')?payload:{}).slice(0,APP_LIMITS.maxOngoingNotes);
    entries.forEach(([rawKey,rawVal])=>{
      const source=(rawVal&&typeof rawVal==='object')?rawVal:{text:String(rawVal||'')};
      const key=normalizeAreaName(source.key||rawKey);if(!key)return;
      const canonical=CompatibilityCodec.areaNote(source,key);
      if(!canonical)throw new Error(`Historical Ongoing Note ${String(key||rawKey||'?')} could not be converted safely.`);
      out[key]=canonical;
    });
    return out;
  }
  function hasContent(entry){return !!(entry&&String(entry.text||'').trim());}
  // Time first, so stamps made later sort later.
  function uniqueStamp(){return `${decisionNowMs().toString(36)}${[...globalThis.crypto.getRandomValues(new Uint8Array(4))].map(value=>value.toString(16).padStart(2,'0')).join('')}`;}
  function revision(entry){return normalizeTimestamp(entry&&entry.updatedAt,'')||'';}
  // A note's revision is its updatedAt, moved forward on every accepted change
  // and never repeated, even when the clock stands still or goes back.
  function nextRevision(previous){const prior=Date.parse(String(previous||''));return new Date(Math.max(decisionNowMs(),Number.isFinite(prior)?prior+1:0)).toISOString();}
  function timestamp(entry){
    const n=Date.parse(entry&&entry.updatedAt?entry.updatedAt:'');
    return Number.isFinite(n)?n:0;
  }
  function applyDeltas(base,deltas){
    const out=normalizePayload(base);
    Object.entries(deltas||{}).forEach(([rawKey,rawEntry])=>{
      const key=normalizeAreaName((rawEntry&&rawEntry.key)||rawKey);
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
  function ensureEntry(key,label=''){
    const safeKey=normalizeAreaName(key);
    if(!safeKey)return null;
    if(!notes[safeKey])notes[safeKey]={version:DATA_CONTRACT.schemas.AreaNote.version,key:safeKey,label:displayAreaName(label||safeKey),text:'',updatedAt:null};
    if(label)notes[safeKey].label=displayAreaName(label);
    return notes[safeKey];
  }
  function get(key,label='',options={}){
    const safeKey=normalizeAreaName(key);
    if(!safeKey)return null;
    const entry=options&&options.create?ensureEntry(safeKey,label):notes[safeKey];
    return entry?Object.freeze({...entry}):null;
  }
  function failure(){return Object.freeze({failed:saveFailed,message:saveMessage});}
  function size(){return Object.keys(notes).length;}
  function canonicalEntrySnapshot(entry,key=''){
    const safeKey=normalizeAreaName((entry&&entry.key)||key);
    if(!safeKey||!entry)return null;
    return {
      version:DATA_CONTRACT.schemas.AreaNote.version,
      key:safeKey,
      label:clampText(displayAreaName(entry.label||safeKey),APP_LIMITS.maxAreaNameChars),
      text:String(entry.text||''),
      updatedAt:String(entry.updatedAt||'')
    };
  }
  function touchSnapshot(){snapshotRevision=(snapshotRevision+1)%Number.MAX_SAFE_INTEGER;metadataSnapshotCache=null;searchSnapshotCache=null;}
  function metadataSnapshot(){
    if(metadataSnapshotCache&&metadataSnapshotCache.revision===snapshotRevision)return metadataSnapshotCache;
    const records=Object.freeze(Object.values(notes).filter(entry=>!isTrashKey(entry.key)).map(entry=>Object.freeze({key:String(entry.key||''),label:String(entry.label||entry.key||''),hasNote:hasContent(entry),updatedAt:String(entry.updatedAt||'')})));
    metadataSnapshotCache=Object.freeze({revision:snapshotRevision,records});return metadataSnapshotCache;
  }
  function searchSnapshot(){
    if(searchSnapshotCache&&searchSnapshotCache.revision===snapshotRevision)return searchSnapshotCache;
    const documents=Object.freeze(Object.values(notes).filter(entry=>hasContent(entry)&&!isTrashKey(entry.key)).map(entry=>Object.freeze({key:String(entry.key||''),revision:String(entry.updatedAt||''),value:String(entry.text||'')})));
    searchSnapshotCache=Object.freeze({revision:snapshotRevision,documents});return searchSnapshotCache;
  }
  function clearFailure(){saveFailed=false;saveMessage='';}
  function recordFailure(reason){
    saveFailed=true;
    saveMessage=SaveLane.failureMessage('Ongoing Notes',reason||'the note database failed');
    showSubjectNoteSaveWarning(reason);
  }
  const AREA_NOTE_RECOVERY_META_PREFIX=META_KEYS.areaNoteRecoveryPrefix;
  const AREA_NOTE_RECOVERY_FORMAT='study-director.area-note-recovery';
  const AREA_NOTE_RESCUE_FORMAT='study-director.area-note-rescue';
  function normalizeRescueEntries(raw){
    const out=KeyedRecord.create();
    const source=raw&&raw.format===AREA_NOTE_RESCUE_FORMAT&&Number(raw.version)===1&&raw.entries&&typeof raw.entries==='object'&&!Array.isArray(raw.entries)?raw.entries:{};
    Object.entries(source).forEach(([rawKey,rawEntry])=>{
      const key=normalizeAreaName((rawEntry&&rawEntry.key)||rawKey);if(!key||!rawEntry)return;
      if(rawEntry.deleted){const updatedAt=normalizeTimestamp(rawEntry.updatedAt,null);if(updatedAt)out[key]={key,deleted:true,updatedAt};return;}
      const clean=sanitizeCurrentAreaNote(rawEntry,key);if(!clean)throw canonicalRuntimeError(`Ongoing Note rescue ${key} is not in the current canonical schema.`);out[key]=clean;
    });
    return out;
  }
  function readIndependentRescue(){
    const raw=LocalStorageContract.getJson(STORAGE_KEYS.areaNoteRescue,null),error=LocalStorageContract.lastError;
    if(error)throw error;
    return normalizeRescueEntries(raw);
  }
  function persistIndependentRescue(entries){
    const updatedAt=new Date().toISOString(),envelope={format:AREA_NOTE_RESCUE_FORMAT,version:1,updatedAt,entries};
    if(jsonByteLength(envelope)>APP_LIMITS.areaNoteRescueBytes)return false;
    return LocalStorageContract.setJson(STORAGE_KEYS.areaNoteRescue,envelope);
  }
  // The rescue is a snapshot of every note not yet confirmed in the database,
  // newest first while it fits. Notes it held earlier are part of that set
  // until saved, because loading marks them unsaved.
  function protectUnsaved(){
    if(!everLoaded||!appCanMutate())return false;
    const keys=[...dirtyBaseRevisions.keys()];
    if(!keys.length)return true;
    const deletedAt=new Date().toISOString(),candidates=keys.map(key=>canonicalEntrySnapshot(notes[key],key)||{key,deleted:true,updatedAt:deletedAt}).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
    const entries=KeyedRecord.create();let complete=true;
    for(const entry of candidates){
      entries[entry.key]=entry;
      if(jsonByteLength({format:AREA_NOTE_RESCUE_FORMAT,version:1,updatedAt:deletedAt,entries})>APP_LIMITS.areaNoteRescueBytes){delete entries[entry.key];complete=false;}
    }
    const written=Object.keys(entries).length?persistIndependentRescue(entries):true;
    if(!written||!complete)AppDiagnostics.capture('area-notes.rescue-write',LocalStorageContract.lastError||new Error(`Unsaved Ongoing Notes exceed the ${Math.round(APP_LIMITS.areaNoteRescueBytes/1024)} KB browser copy.`),'error');
    return written&&complete;
  }
  function clearIndependentRescueKeys(keys){
    const current=readIndependentRescue();if(LocalStorageContract.lastError)return false;let changed=false;
    for(const rawKey of keys||[]){const key=normalizeAreaName(rawKey);if(key&&Object.hasOwn(current,key)){delete current[key];changed=true;}}
    if(!changed)return true;
    if(!Object.keys(current).length)return LocalStorageContract.remove(STORAGE_KEYS.areaNoteRescue);
    return persistIndependentRescue(current);
  }
  function recoveryMetaKey(key){const safeKey=normalizeAreaName(key);return safeKey?`${AREA_NOTE_RECOVERY_META_PREFIX}${safeKey}`:'';}
  async function migrateHistoricalCanonicalRows(){
    const token=compatibilityWriteToken('canonicalize Ongoing Notes');
    if(!token)return Object.freeze({status:'skipped',reason:'not-primary',records:0,recoveryRows:0});
    let records=0,recoveryRows=0;
    return idbStrictTransaction([DB_AREA_NOTES_STORE,DB_APP_META_STORE],'readwrite',(tx,finish)=>{
      const fail=error=>{try{tx.abort();}catch{}finish(false,error);};
      const guard=()=>{try{assertWriteToken(token,'canonicalize Ongoing Notes');return true;}catch(error){fail(error);return false;}};
      if(!guard())return;
      const notesStore=tx.objectStore(DB_AREA_NOTES_STORE),metaStore=tx.objectStore(DB_APP_META_STORE);
      const notesRequest=notesStore.openCursor();
      notesRequest.onerror=()=>fail(notesRequest.error||new Error('Ongoing Note canonicalization read failed.'));
      notesRequest.onsuccess=event=>{
        if(!guard())return;
        const cursor=event.target.result;if(!cursor)return;
        const row=cursor.value,key=normalizeAreaName(row&&row.key);
        const current=sanitizeCurrentAreaNote(row,key);
        if(current){cursor.continue();return;}
        const canonical=CompatibilityCodec.areaNote(row,key);
        if(!canonical){fail(new Error(`Ongoing Note ${String(key||'?')} could not be converted safely. The historical row was preserved.`));return;}
        const update=cursor.update(canonical);update.onerror=()=>fail(update.error||new Error('Ongoing Note canonicalization write failed.'));records++;cursor.continue();
      };
      const Range=globalThis.IDBKeyRange,keyRange=Range&&typeof Range.bound==='function'?Range.bound(AREA_NOTE_RECOVERY_META_PREFIX,`${AREA_NOTE_RECOVERY_META_PREFIX}￿`):null;
      const recoveryRequest=keyRange?metaStore.openCursor(keyRange):metaStore.openCursor();
      recoveryRequest.onerror=()=>fail(recoveryRequest.error||new Error('Ongoing Note recovery canonicalization read failed.'));
      recoveryRequest.onsuccess=event=>{
        if(!guard())return;
        const cursor=event.target.result;if(!cursor)return;
        const row=cursor.value;if(!String(row&&row.key||'').startsWith(AREA_NOTE_RECOVERY_META_PREFIX)){cursor.continue();return;}
        const value=row&&row.value,key=normalizeAreaName(value&&value.key);
        if(!value||value.format!==AREA_NOTE_RECOVERY_FORMAT||Number(value.version)!==1||!key||String(row.key||'')!==recoveryMetaKey(key)){
          fail(new Error(`Ongoing Note recovery ${String(row&&row.key||'?')} could not be converted safely. The historical row was preserved.`));return;
        }
        let entry;
        if(value.entry&&value.entry.deleted){entry={key,deleted:true,updatedAt:normalizeTimestamp(value.entry.updatedAt||value.updatedAt||row.updatedAt,new Date().toISOString())};}
        else entry=CompatibilityCodec.areaNote(value.entry,key);
        if(!entry){fail(new Error(`Ongoing Note recovery ${key} could not be converted safely. The historical row was preserved.`));return;}
        const updatedAt=normalizeTimestamp(value.updatedAt||row.updatedAt,entry.updatedAt||new Date().toISOString());
        const canonical={key:recoveryMetaKey(key),version:1,value:{format:AREA_NOTE_RECOVERY_FORMAT,version:1,key,entry,updatedAt},updatedAt};
        if(!sameDataValue(row,canonical)){const update=cursor.update(canonical);update.onerror=()=>fail(update.error||new Error('Ongoing Note recovery canonicalization write failed.'));recoveryRows++;}
        cursor.continue();
      };
      tx.oncomplete=()=>finish(true,Object.freeze({status:(records||recoveryRows)?'migrated':'not-needed',records,recoveryRows}));
    },'Ongoing Note canonicalization aborted');
  }
  function readLegacyPendingCache(){
    try{
      const parsed=LocalStorageContract.getJson(LEGACY_STORAGE_KEYS.areaNotesPending,null);
      return (parsed&&Number(parsed.version)===1&&parsed.pending&&typeof parsed.pending==='object')?normalizeHistoricalPayloadForMigration(parsed.pending):KeyedRecord.create();
    }catch(e){AppDiagnostics.capture('area-notes.pending-legacy-read',e);return KeyedRecord.create();}
  }
  async function readRecoveryEntries(){
    return Meta.list('areaNoteRecoveryPrefix');
  }
  function recoveryEntryFromValue(value,suffix=''){
    const key=normalizeAreaName(value&&value.key);
    if(!value||value.format!==AREA_NOTE_RECOVERY_FORMAT||Number(value.version)!==1||!key||key!==normalizeAreaName(suffix)||!Number.isFinite(Date.parse(String(value.updatedAt||''))))return null;
    const entry=value.entry&&value.entry.deleted
      ?(value.entry&&Object.keys(value.entry).sort().join('|')==='deleted|key|updatedAt'&&value.entry.deleted===true&&normalizeAreaName(value.entry.key)===key&&Number.isFinite(Date.parse(String(value.entry.updatedAt||'')))?{key,deleted:true,updatedAt:String(value.entry.updatedAt)}:null)
      :sanitizeCurrentAreaNote(value.entry,key);
    return entry?{key,entry}:null;
  }
  async function readRecoveryJournal(){
    const entries=await readRecoveryEntries(),pending=KeyedRecord.create();
    for(const metaEntry of entries){const recovered=recoveryEntryFromValue(metaEntry.value,metaEntry.suffix);if(!recovered)throw canonicalRuntimeError(`Ongoing Note recovery ${String(metaEntry.key||'?')} is not in the current canonical schema.`);pending[recovered.key]=recovered.entry;}
    return pending;
  }
  async function verifyCurrentRecovery(){
    const issues=[];let entries=[];
    try{entries=await readRecoveryEntries();if(entries.length)issues.push('area-note-recovery-residue');}
    catch(error){issues.push(`area-note-recovery:${String(error&&error.message||error)}`);}
    const rawRescue=LocalStorageContract.getJson(STORAGE_KEYS.areaNoteRescue,null);
    if(LocalStorageContract.lastError)issues.push('area-note-rescue-unreadable');
    else if(rawRescue){
      const normalized=normalizeRescueEntries(rawRescue);
      if(rawRescue.format!==AREA_NOTE_RESCUE_FORMAT||Number(rawRescue.version)!==1||!Number.isFinite(Date.parse(String(rawRescue.updatedAt||'')))||!rawRescue.entries||Object.keys(normalized).length!==Object.keys(rawRescue.entries).length||jsonByteLength(rawRescue)>APP_LIMITS.areaNoteRescueBytes)issues.push('area-note-rescue-invalid');
    }
    return Object.freeze({ok:issues.length===0,rows:entries.length+(rawRescue?1:0),issues:Object.freeze(issues)});
  }
  // Earlier versions kept unsaved edits in localStorage, later in appMeta
  // journal rows. Both are folded into the canonical notes once, the newer
  // revision winning, and removed in the same pass.
  async function migrateLegacyRecovery(){
    const token=compatibilityWriteToken('migrate Ongoing Note recovery');
    if(!token)return Object.freeze({status:'skipped',reason:'not-primary',records:0});
    const legacy=readLegacyPendingCache();
    for(const key of Object.keys(legacy)){
      const canonical=CompatibilityCodec.areaNote(legacy[key],key);
      if(!canonical)throw new Error(`Legacy Ongoing Note recovery for ${key} could not be converted safely. The source payload was preserved.`);
      legacy[key]=canonical;
    }
    const journal=await readRecoveryJournal(),keys=[...new Set([...Object.keys(legacy),...Object.keys(journal)])];
    if(!keys.length)return Object.freeze({status:'not-needed',records:0});
    assertWriteToken(token,'migrate Ongoing Note recovery');
    let records=0;
    await idbStrictTransaction([DB_AREA_NOTES_STORE,DB_APP_META_STORE],'readwrite',(tx,finish)=>{
      const store=tx.objectStore(DB_AREA_NOTES_STORE),meta=Meta.view(tx);let staged=false,failed=false;
      const fail=error=>{if(failed)return;failed=true;try{tx.abort();}catch{}finish(false,error);};
      for(const key of keys){
        // Requests complete in issue order: the deletion record is read first.
        const deletion=meta.get('areaNoteDeletionPrefix',key),row=store.get(key);
        row.onerror=()=>fail(row.error||new Error('Ongoing Note recovery read failed.'));
        deletion.request.onerror=()=>fail(deletion.request.error||new Error('Ongoing Note deletion read failed.'));
        row.onsuccess=()=>{
          try{assertWriteToken(token,'migrate Ongoing Note recovery');}catch(error){fail(error);return;}
          const current=row.result?normalizePayload({[key]:row.result}):KeyedRecord.create(),deletedAt=Date.parse(String(deletion.value()?.deletedAt||''));
          const next=applyDeltas(applyDeltas(current,legacy[key]?{[key]:legacy[key]}:{}),journal[key]?{[key]:journal[key]}:{})[key]||null;
          meta.remove('areaNoteRecoveryPrefix',key);
          // A note deleted after the unsaved edit stays deleted.
          if(sameDataValue(next,current[key]||null)||next&&Number.isFinite(deletedAt)&&deletedAt>=timestamp(next))return;
          if(!staged){stageCanonicalMutationEpoch(tx,keys.map(areaNotePreparationUnit));staged=true;}
          if(next){store.put(next);meta.remove('areaNoteDeletionPrefix',key);}
          else{store.delete(key);const value=areaNoteDeletionValue(key,new Date().toISOString());meta.put('areaNoteDeletionPrefix',value,{suffix:key,updatedAt:value.deletedAt});}
          records++;
        };
      }
      tx.oncomplete=()=>finish(true);
    },'Ongoing Note recovery migration aborted');
    assertWriteToken(token,'migrate Ongoing Note recovery');
    if((await readRecoveryEntries()).length)throw new Error('Ongoing Note recovery rows remain after migration.');
    if(Object.keys(legacy).length&&!LocalStorageContract.remove(LEGACY_STORAGE_KEYS.areaNotesPending))throw new Error('Legacy Ongoing Note recovery could not be retired after verified migration.');
    return Object.freeze({status:'migrated',records});
  }
  function markDirty(key,baseRevision){
    const safeKey=normalizeAreaName(key);
    if(!safeKey)return;
    if(!dirtyBaseRevisions.has(safeKey))dirtyBaseRevisions.set(safeKey,String(baseRevision===undefined?revision(notes[safeKey]):baseRevision||''));
    dirtyKeys.add(safeKey);
    setNoteSyncStateForKey(safeKey,'saving');
    if(appCanMutate())lane.schedule();
  }
  async function idbRead(){
    const rows=await idbGetAll(DB_AREA_NOTES_STORE,'area note read aborted'),out=KeyedRecord.create();
    for(const row of rows){
      const clean=sanitizeCurrentAreaNote(row,row&&row.key);
      if(!clean)throw canonicalRuntimeError(`Ongoing Note ${String(row&&row.key||'?')} is not in the current canonical schema.`);
      out[clean.key]=clean;
    }
    return out;
  }
  async function idbReplace(payload,removedKeys=[],options={}){
    const normalized=normalizePayload(payload),deletedEntries=normalizeAreaNoteDeletions(options.deletedEntries||[]),recordDeletes=options.recordDeletes===true;
    const deletedByKey=new Map(deletedEntries.map(entry=>[entry.key,entry]));
    return idbStrictTransaction([DB_AREA_NOTES_STORE,DB_APP_META_STORE],'readwrite',(tx,finish)=>{
      const store=tx.objectStore(DB_AREA_NOTES_STORE),meta=Meta.view(tx);stageCanonicalMutationEpoch(tx,['*']);store.clear();
      Object.values(normalized).forEach(entry=>{store.put(entry);meta.remove('areaNoteDeletionPrefix',entry.key);});
      if(recordDeletes){const now=new Date().toISOString();for(const rawKey of removedKeys){const key=normalizeAreaName(rawKey);if(key&&!normalized[key]&&!isTrashKey(key)){const deletion=areaNoteDeletionValue(key,deletedByKey.get(key)?.deletedAt||now);meta.put('areaNoteDeletionPrefix',deletion,{suffix:key,updatedAt:deletion.deletedAt});}}}
      for(const entry of deletedEntries)if(!normalized[entry.key]){const deletion=areaNoteDeletionValue(entry.key,entry.deletedAt);meta.put('areaNoteDeletionPrefix',deletion,{suffix:entry.key,updatedAt:deletion.deletedAt});}
      tx.oncomplete=()=>finish(true);
    },'area note replacement aborted');
  }
  // A clash keeps this tab's version as a new note, "<Name> (unsaved copy)",
  // numbered when that is taken and stamped past 99, so a name is always found.
  // The copy is added in the transaction that finds the clash: the stored
  // version replaces this tab's version only once the copy is stored. At the
  // note limit the oldest deleted notes make room; with none left nothing is
  // replaced and the note stays unsaved here and in the browser copy.
  function copyLabelBase(entry,key,reserve){return clampText(displayAreaName(entry.label||key),Math.max(1,APP_LIMITS.maxAreaNameChars-reserve));}
  function copyKeyPrefix(entry,key){return normalizeAreaName(`${copyLabelBase(entry,key,20)} (unsaved copy`);}
  function copyLabel(entry,key,taken){
    const base=copyLabelBase(entry,key,20);
    for(let index=1;index<100;index+=1){const label=`${base} (unsaved copy${index>1?` ${index}`:''})`;if(!taken(normalizeAreaName(label)))return label;}
    for(;;){const label=`${copyLabelBase(entry,key,36)} (unsaved copy ${uniqueStamp()})`;if(!taken(normalizeAreaName(label)))return label;}
  }
  async function idbApplyDelta(keys,expectedRevisions){
    const uniqueKeys=[...new Set((keys||[]).map(normalizeAreaName).filter(Boolean))];
    const canonical=new Map(uniqueKeys.map(key=>[key,canonicalEntrySnapshot(notes[key],key)]));
    return idbStrictTransaction([DB_AREA_NOTES_STORE,DB_APP_META_STORE],'readwrite',(tx,finish)=>{
      const store=tx.objectStore(DB_AREA_NOTES_STORE),meta=Meta.view(tx),conflicts=[],committed=KeyedRecord.create(),evicted=[],changed=new Set(),deletedAt=new Date().toISOString(),storageLost=storageLossKnown();
      const failOn=(request,message)=>{request.onerror=()=>finish(false,request.error||new Error(message));};
      let remaining=uniqueKeys.length;
      // Requests complete in issue order, so these reads observe the state before
      // any write below. A database without any canonical mutation epoch was
      // recreated (browser data cleared) rather than edited elsewhere.
      const epoch=meta.get('canonicalMutationEpoch');
      failOn(epoch.request,'area note epoch read failed');
      uniqueKeys.forEach(key=>{
        const entry=canonical.get(key);committed[key]=entry;
        const deletion=meta.get('areaNoteDeletionPrefix',key);
        failOn(deletion.request,'area note deletion read failed');
        const request=store.get(key);
        failOn(request,'area note revision read failed');
        request.onsuccess=()=>{
          const persistedRaw=request.result||null,persistedRevision=normalizeTimestamp(persistedRaw&&persistedRaw.updatedAt,'')||'';
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
          if(!clash){changed.add(key);if(entry){store.put(entry);meta.remove('areaNoteDeletionPrefix',key);}else{store.delete(key);if(!isTrashKey(key)){const deletion=areaNoteDeletionValue(key,deletedAt);meta.put('areaNoteDeletionPrefix',deletion,{suffix:key,updatedAt:deletion.deletedAt});}}}
          if(--remaining===0)keepClashCopies();
        };
      });
      // Runs after every note in the batch was read and written.
      function keepClashCopies(){
        const pending=conflicts.filter(item=>item.local);
        if(!pending.length){stageWrites();return;}
        const Range=globalThis.IDBKeyRange,count=store.count(),oldestTrash=store.getAllKeys(Range.bound(TRASH_PREFIX,`${TRASH_PREFIX}\uffff`),pending.length);
        const names=pending.map(item=>{const prefix=copyKeyPrefix(item.local,item.key);return store.getAllKeys(Range.bound(prefix,`${prefix}\uffff`));});
        failOn(count,'area note count failed');failOn(oldestTrash,'area note trash read failed');names.forEach(request=>failOn(request,'area note name read failed'));
        names.at(-1).onsuccess=()=>{
          let room=APP_LIMITS.maxOngoingNotes-Number(count.result||0);const trash=[...(oldestTrash.result||[])],allocated=new Set();
          pending.forEach((item,index)=>{
            while(room<=0&&trash.length){const key=trash.shift();store.delete(key);evicted.push(key);changed.add(key);room++;}
            if(room<=0){item.unresolved=true;return;}
            const existing=new Set(names[index].result||[]);
            const label=copyLabel(item.local,item.key,key=>!key||existing.has(key)||allocated.has(key)||canonical.has(key)||!!notes[key]);
            const copyKey=normalizeAreaName(label);allocated.add(copyKey);
            item.copy={version:DATA_CONTRACT.schemas.AreaNote.version,key:copyKey,label,text:String(item.local.text||''),updatedAt:nextRevision('')};
            // add, never put: a name taken after all fails the batch instead of
            // replacing a stored note.
            failOn(store.add(item.copy),'area note copy write failed');meta.remove('areaNoteDeletionPrefix',copyKey);changed.add(copyKey);room--;
          });
          stageWrites();
        };
      }
      function stageWrites(){if(changed.size)stageCanonicalMutationEpoch(tx,[...changed].map(areaNotePreparationUnit));}
      tx.oncomplete=()=>finish(true,{conflicts,committed,evicted,written:changed.size});
    },'area note transaction aborted');
  }
  async function performLoad({strict=false}={}){
    const revisionAtStart=snapshotRevision,writesAtStart=lane.tail();
    let loaded={};lastLoadReadFailed=false;
    await lane.settled();
    const rescueBeforeRead=readIndependentRescue();
    try{
      loaded=await idbRead();
    }catch(e){
      lastLoadReadFailed=true;AppDiagnostics.capture('area-notes.load',e,'error');
      if(strict||isCanonicalRuntimeError(e))throw e;
    }
    const rescueAfterRead=readIndependentRescue();
    // Notes this tab already loaded but storage no longer holds, without any
    // deletion record, survived a browser data clear only in memory. Keep them
    // and write them back instead of wiping the last copy.
    const survivors=KeyedRecord.create();
    if(everLoaded&&!lastLoadReadFailed){
      const missing=Object.keys(notes).filter(key=>hasContent(notes[key])&&!loaded[key]&&![rescueBeforeRead,rescueAfterRead].some(source=>source[key]));
      if(missing.length){
        // Without readable metadata a cleared database cannot be told apart from
        // a deletion made in another tab. Leave memory as it is; the reload stays
        // pending and is retried.
        let deleted=null;
        try{
          if(storageLossKnown()||!(await Meta.read('canonicalMutationEpoch')))deleted=new Set((await Meta.list('areaNoteDeletionPrefix')).map(entry=>normalizeAreaName(entry.suffix)));
        }catch(error){
          AppDiagnostics.capture('area-notes.storage-loss-check',error,'warn');lastLoadReadFailed=true;
          throw Object.assign(new Error('Ongoing notes could not confirm what storage still holds. Recovery remains pending.'),{code:'AREA_NOTE_RECOVERY_UNRESOLVED'});
        }
        if(deleted)for(const key of missing)if(!deleted.has(key))survivors[key]=canonicalEntrySnapshot(notes[key],key);
      }
    }
    // Request results precede transaction completion. An edit or queued save
    // in that interval invalidates this snapshot, including equal timestamps.
    // Keep its dirty state and timers; a later stable recovery can adopt safely.
    if(snapshotRevision!==revisionAtStart||lane.tail()!==writesAtStart){
      lastLoadReadFailed=true;
      const error=new Error('Ongoing notes changed during recovery. Recovery remains pending.');
      error.code='AREA_NOTE_RECOVERY_SUPERSEDED';throw error;
    }
    const merged=applyDeltas(applyDeltas(loaded,rescueBeforeRead),rescueAfterRead);
    for(const [key,entry] of Object.entries(survivors)){const clean=normalizePayload({[key]:entry})[key];if(clean&&!merged[key])merged[key]=clean;}
    // Edits this tab has not saved yet stay exactly as they are, with the
    // revision they were made against; saving them settles any clash.
    const unsaved=new Map(dirtyBaseRevisions);
    for(const key of unsaved.keys()){const entry=canonicalEntrySnapshot(notes[key],key),clean=entry?normalizePayload({[key]:entry})[key]:null;if(clean)merged[key]=clean;else delete merged[key];}
    dirtyKeys.clear();
    dirtyBaseRevisions.clear();
    wipeObject(notes);
    Object.assign(notes,merged);
    touchSnapshot();
    // Recovered notes that differ from storage are saved; a rescue entry that
    // storage already matches is stale and dropped.
    const stale=[];
    for(const key of new Set([...Object.keys(rescueBeforeRead),...Object.keys(rescueAfterRead),...Object.keys(survivors)])){
      if(sameDataValue(merged[key]||null,loaded[key]||null))stale.push(key);
      else{dirtyKeys.add(key);dirtyBaseRevisions.set(key,revision(loaded[key]));}
    }
    if(stale.length&&!lastLoadReadFailed&&appCanMutate()&&!clearIndependentRescueKeys(stale))AppDiagnostics.capture('area-notes.rescue-clear',LocalStorageContract.lastError||new Error('Ongoing Note emergency rescue cleanup failed.'),'warn');
    for(const [key,base] of unsaved){dirtyKeys.add(key);dirtyBaseRevisions.set(key,base);}
    everLoaded=true;
    purgeExpiredTrash();
    if(dirtyKeys.size&&appCanMutate())lane.schedule();
    refreshAreaNoteConsumers();
    return true;
  }
  function load(options={}){
    if(!loadPromise)loadPromise=performLoad().catch(error=>{AppDiagnostics.capture('area-notes.startup-load',error,'error');if(isCanonicalRuntimeError(error))throw error;return false;});
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
      AppDiagnostics.capture('area-notes.fresh-reload',error,'error');
      throw error;
    }).finally(()=>{freshLoadPromise=null;});
    return freshLoadPromise;
  }
  // Saves run one batch at a time. A batch reads the revision it expects only
  // when it runs, after the previous batch committed.
  const sameEntry=(entry,written)=>JSON.stringify(canonicalEntrySnapshot(entry,written&&written.key))===JSON.stringify(written||null);
  // Writes one batch of notes in one transaction. A committed note stays
  // pending while this tab already holds something newer than what was written.
  // Returns the notes whose clash could not be settled yet.
  async function commitNotes(deltaKeys,options={}){
    const expectedRevisions=new Map(deltaKeys.map(key=>[key,dirtyBaseRevisions.has(key)?String(dirtyBaseRevisions.get(key)||''):revision(notes[key])]));
    const result=await idbApplyDelta(deltaKeys,expectedRevisions);
    const conflicts=new Map(result.conflicts.map(item=>[item.key,item]));
    const savedKeys=deltaKeys.filter(key=>!conflicts.has(key));
    let canonicalRefreshNeeded=false,movedEdits=false;const settledKeys=[],unresolved=[],reported=[];
    savedKeys.forEach(key=>{
      const written=result.committed[key]||null,committedRevision=written?revision(written):'';
      if(dirtyKeys.has(key)||!sameEntry(notes[key],written))dirtyBaseRevisions.set(key,committedRevision);
      else{
        dirtyBaseRevisions.delete(key);settledKeys.push(key);
        if(!committedRevision){delete notes[key];canonicalRefreshNeeded=true;}
        setNoteSyncStateForKey(key,'synced');
      }
    });
    // Deleted notes removed to make room for a copy.
    for(const key of result.evicted){delete notes[key];dirtyKeys.delete(key);dirtyBaseRevisions.delete(key);settledKeys.push(key);canonicalRefreshNeeded=true;}
    conflicts.forEach((item,key)=>{
      const local=notes[key]||null,written=result.committed[key]||null,changedSince=!sameEntry(local,written);
      // Nothing of this tab's version is stored elsewhere yet: keep it as it is
      // and try again. A later attempt stores the copy once there is room.
      if(item.unresolved||!item.copy&&changedSince&&hasContent(local)&&String(local.text||'')!==String(item.persisted&&item.persisted.text||'')){dirtyKeys.add(key);if(item.unresolved)unresolved.push(key);return;}
      if(item.copy){
        notes[item.copy.key]=item.copy;
        // Edits made while the clash was being settled join the copy.
        if(changedSince&&hasContent(local)&&String(local.text||'')!==item.copy.text){notes[item.copy.key]={...item.copy,text:String(local.text||''),updatedAt:nextRevision(item.copy.updatedAt)};markDirty(item.copy.key,revision(item.copy));movedEdits=true;}
      }
      dirtyKeys.delete(key);dirtyBaseRevisions.delete(key);settledKeys.push(key);
      if(item.persisted)notes[key]=item.persisted;else delete notes[key];
      reported.push(Object.freeze({key,label:item.persisted&&item.persisted.label||displayAreaName(key),copyLabel:item.copy?item.copy.label:''}));
    });
    if(!clearIndependentRescueKeys(settledKeys))AppDiagnostics.capture('area-notes.rescue-clear',LocalStorageContract.lastError||new Error('Ongoing Note emergency rescue cleanup failed.'),'warn');
    if(movedEdits)protectUnsaved();
    if(!unresolved.length)clearFailure();
    markStorageHealthOk('areaNotes','lastNotesSaveAt');
    if(result.written)reportCanonicalCommit('areaNote','upsert',null,{backupCapture:options.backupCapture===true});
    if(canonicalRefreshNeeded||reported.length)touchSnapshot();
    if(canonicalRefreshNeeded||reported.length)refreshAreaNoteConsumers();
    reported.forEach(info=>reportAreaNoteConflict(info));
    if(dirtyKeys.size&&!unresolved.length)lane.schedule();
    return unresolved;
  }
  function clashWithoutRoom(keys){
    const labels=keys.map(key=>displayAreaName(notes[key]&&notes[key].label||key)).join(', ');
    return Object.assign(new Error(`${labels} changed in another tab, and Ongoing Notes are at the ${APP_LIMITS.maxOngoingNotes.toLocaleString()}-note limit, so this tab's version cannot be kept as a separate note. Delete a note to make room`),{code:'AREA_NOTE_CLASH_NO_ROOM'});
  }
  // The lane's write: every note changed since the last batch. A failed batch
  // stays unsaved, goes to the browser copy, and the lane retries it.
  async function saveDirtyNotes(_value,options={}){
    if(!appCanMutate())return false;
    const keys=[...new Set([...dirtyKeys].map(normalizeAreaName).filter(Boolean))];dirtyKeys.clear();
    if(!keys.length)return true;
    let unresolved;
    try{unresolved=await commitNotes(keys,options);}
    catch(error){
      keys.forEach(key=>dirtyKeys.add(key));protectUnsaved();
      recordFailure(error&&error.message?error.message:'area note database failed');throw error;
    }
    if(!unresolved.length)return true;
    const error=clashWithoutRoom(unresolved);protectUnsaved();recordFailure(error.message);throw error;
  }
  const lane=SaveLane.createLane(freeze({label:'Ongoing Notes',write:saveDirtyNotes,onState:()=>{},environment:freeze({setTimeout:(callback,delay)=>setTimeout(callback,delay),clearTimeout:timer=>clearTimeout(timer)})}));
  function updateInternal(key,label,value,expectedRevision='',validatedRich=false){
    if(!appCanMutate())return {status:'rejected',revision:''};
    const safeKey=normalizeAreaName(key);
    if(!safeKey)return {status:'rejected',revision:''};
    const current=notes[safeKey]||null;
    const currentRevision=revision(current);
    if(String(expectedRevision||'')!==currentRevision){
      reportAreaNoteConflict(Object.freeze({key:safeKey,label:current&&current.label||displayAreaName(label||safeKey)}));
      return {status:'conflict',revision:currentRevision};
    }
    const sourceText=String(value||''),nextLabel=clampText(displayAreaName(label||safeKey),APP_LIMITS.maxAreaNameChars);
    if(current&&String(current.text||'')===sourceText&&clampText(displayAreaName(current.label||safeKey),APP_LIMITS.maxAreaNameChars)===nextLabel)return {status:'unchanged',revision:currentRevision};
    let nextText;
    if(validatedRich)nextText=sourceText;
    else{
      if(!editorContentWithinLimits(sourceText))return {status:'content-limit',revision:currentRevision};
      nextText=clampEditorContent(sourceText,APP_LIMITS.maxNoteChars);
    }
    if(!current&&isTrashKey(safeKey))return {status:'rejected',revision:''};
    if(!current&&nextText.trim()&&size()>=APP_LIMITS.maxOngoingNotes)return {status:'limit',revision:currentRevision};
    if(!current&&!nextText.trim())return {status:'unchanged',revision:currentRevision};
    const entry=ensureEntry(safeKey,nextLabel);
    if(!entry)return {status:'rejected',revision:currentRevision};
    entry.text=nextText;
    entry.label=nextLabel;
    entry.updatedAt=nextRevision(currentRevision);
    touchSnapshot();
    markDirty(entry.key,currentRevision);
    return {status:'changed',revision:revision(entry)};
  }
  function update(key,label,value,expectedRevision=''){return updateInternal(key,label,value,expectedRevision,false);}
  function updateValidatedRich(key,label,value,expectedRevision=''){return updateInternal(key,label,value,expectedRevision,true);}
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
        if(!clearIndependentRescueKeys(recoveryKeys))AppDiagnostics.capture('area-notes.rescue-clear-after-verified-canonical',LocalStorageContract.lastError||new Error('Ongoing Note emergency rescue cleanup failed after canonical verification.'),'warn');
      }
      if(snapshotRevision!==revisionAtStart||dirtyKeys.size)return false;
      clearFailure();
      return true;
    }catch(error){
      AppDiagnostics.capture('area-notes.strict-flush-reverify',error,'warn');
      return false;
    }
  }
  async function storageAppearsRecreated(){
    if(storageLossKnown())return true;
    try{return !(await Meta.read('canonicalMutationEpoch'));}
    catch(error){AppDiagnostics.capture('area-notes.storage-loss-probe',error,'warn');return false;}
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
  function flush(options={}){
    const strict=!!(options&&options.strict),backupCapture=options&&options.backupCapture===true;
    if(!appCanMutate())return strict?Promise.reject(new Error('ongoing notes cannot flush without write ownership')):lane.settled();
    const writeNow=()=>{if(dirtyKeys.size&&!lane.pending())lane.schedule();return lane.flush({backupCapture}).then(()=>true,()=>false);};
    const pending=writeNow();
    if(!strict)return pending;
    return pending.then(async()=>{
      // Edits that arrived while a clash was settled were moved to its copy;
      // store them now so a strict flush never ends with them only in memory.
      if(dirtyKeys.size&&!saveFailed)await writeNow();
      if(dirtyKeys.size)throw new Error(saveMessage||'current ongoing notes are not safely stored');
      if(saveFailed&&!(await repairStaleFailureIfCanonical())){
        if(!(await storageAppearsRecreated())||!(await recoverAfterStorageLoss()))throw new Error(saveMessage||'current ongoing notes are not safely stored');
      }
      return true;
    });
  }
  // Writes what is pending and fails unless these notes are now stored as this
  // tab holds them. Another note that cannot be saved yet does not hold them
  // back, so notes can still be deleted to make room for a clash's copy.
  async function settle(keys){
    await flush();
    const unsaved=keys.filter(key=>dirtyKeys.has(key)||dirtyBaseRevisions.has(key));
    if(unsaved.length)throw new Error(saveMessage||'current ongoing notes are not safely stored');
    return true;
  }
  function prepareExportPayload(payload){return normalizePayload(payload);}
  function exportPayload(){return prepareExportPayload(notes);}
  async function readFreshPayload(){
    const rescueBeforeRead=readIndependentRescue(),loaded=await idbRead(),rescueAfterRead=readIndependentRescue();
    return prepareExportPayload(applyDeltas(applyDeltas(loaded,rescueBeforeRead),rescueAfterRead));
  }
  async function readFreshItems(keys){
    const requested=[...new Set((keys||[]).map(normalizeAreaName).filter(Boolean))];if(!requested.length)return freeze([]);
    await flush({strict:true});if(saveFailed)throw new Error(saveMessage||'current ongoing notes are not safely stored');
    const rows=await idbStoreTransaction(DB_AREA_NOTES_STORE,'readonly',(store,tx,finish)=>{
      const out=[];let pending=requested.length,failed=false;
      requested.forEach(key=>{const request=store.get(key);request.onsuccess=()=>{if(request.result)out.push(request.result);if(--pending===0&&!failed)finish(true,out);};request.onerror=()=>{if(failed)return;failed=true;finish(false,request.error||new Error('Ongoing Note targeted read failed'));};});
    },'Ongoing Note targeted read aborted');
    const byKey=new Map();for(const row of rows||[]){const clean=normalizePayload({[row&&row.key]:row})[normalizeAreaName(row&&row.key)];if(clean)byKey.set(clean.key,clean);}return freeze(requested.map(key=>byKey.get(key)||null));
  }
  function resetPendingAreaNoteWrites(){
    lane.cancel();dirtyKeys.clear();dirtyBaseRevisions.clear();
  }
  async function commitCollection(payload,{merge,deletions=[]}={}){
    await flush();
    if(saveFailed)throw new Error(saveMessage||'current ongoing notes are not safely stored');
    const previous=normalizePayload(notes),imported=normalizePayload(payload,{strictRich:true}),deletedEntries=normalizeAreaNoteDeletions(deletions);
    const next=merge?Object.assign(previous,imported):imported;
    for(const entry of deletedEntries)delete next[entry.key];
    if(Object.keys(next).length>APP_LIMITS.maxOngoingNotes)throw tooManyNotes(Object.keys(next).length);
    const previousKeys=new Set(Object.keys(previous)),nextKeys=new Set(Object.keys(next));
    const removedKeys=[...previousKeys].filter(key=>!nextKeys.has(key));
    resetPendingAreaNoteWrites();
    try{
      await idbReplace(next,removedKeys,{deletedEntries});
      if(!clearIndependentRescueKeys([...previousKeys,...nextKeys]))AppDiagnostics.capture('area-notes.rescue-clear',LocalStorageContract.lastError||new Error('Ongoing Note emergency rescue cleanup failed.'),'warn');
      wipeObject(notes);Object.assign(notes,next);touchSnapshot();clearFailure();
      markStorageHealthOk('areaNotes','lastNotesSaveAt');
      reportCanonicalCommit('areaNote','upsert');
      return prepareExportPayload(next);
    }catch(e){
      recordFailure(e&&e.message?e.message:'area note database failed');
      throw e;
    }
  }
  function replace(payload){return commitCollection(payload,{merge:false});}
  function merge(payload){return commitCollection(payload,{merge:true});}
  function reconcile(payload,deletions=[]){return commitCollection(payload,{merge:true,deletions});}
  // Removes a note for good. A deletion record keeps a live note from coming
  // back through Combine; a trash row needs none.
  async function remove(key){
    if(!appCanMutate())return false;
    const safeKey=normalizeAreaName(key);if(!safeKey||!notes[safeKey])return false;
    await settle([safeKey]);const current=notes[safeKey];if(!current)return false;
    delete notes[safeKey];touchSnapshot();markDirty(safeKey,revision(current));
    await settle([safeKey]);return !notes[safeKey];
  }
  function newTrashKey(){for(;;){const key=`${TRASH_PREFIX}${uniqueStamp()}`;if(!notes[key])return key;}}
  // Moves a note to Recently deleted, in one transaction with its deletion
  // record. An empty note is simply removed. Returns the trash key, '' for an
  // empty note, or null when nothing changed.
  async function trash(key){
    if(!appCanMutate())return null;
    const safeKey=normalizeAreaName(key);if(!safeKey||isTrashKey(safeKey)||!notes[safeKey])return null;
    await settle([safeKey]);const current=notes[safeKey];if(!current)return null;
    if(!hasContent(current))return await remove(safeKey)?'':null;
    const trashKey=newTrashKey();
    notes[trashKey]={version:DATA_CONTRACT.schemas.AreaNote.version,key:trashKey,label:current.label,text:current.text,updatedAt:nextRevision(current.updatedAt)};
    delete notes[safeKey];touchSnapshot();markDirty(safeKey,revision(current));markDirty(trashKey,'');
    await settle([safeKey,trashKey]);
    refreshAreaNoteConsumers();
    return trashKey;
  }
  // Puts a deleted note back under its name, or "<Name> (restored)" when a
  // note with text already uses that name. Returns the restored key or null.
  async function restore(trashKey){
    if(!appCanMutate())return null;
    const safeKey=normalizeAreaName(trashKey);if(!isTrashKey(safeKey)||!notes[safeKey])return null;
    await settle([safeKey]);const item=notes[safeKey];if(!item)return null;
    const base=displayAreaName(item.label||''),free=candidate=>{const key=normalizeAreaName(candidate);return key&&!isTrashKey(key)&&!hasContent(notes[key])?key:'';};
    let label=clampText(base,APP_LIMITS.maxAreaNameChars),key=free(label);
    for(let index=1;!key&&index<100;index+=1){label=`${clampText(base,Math.max(1,APP_LIMITS.maxAreaNameChars-20))} (restored${index>1?` ${index}`:''})`;key=free(label);}
    if(!key)return null;
    const existing=notes[key]||null;
    notes[key]={version:DATA_CONTRACT.schemas.AreaNote.version,key,label,text:item.text,updatedAt:nextRevision(existing&&existing.updatedAt)};
    delete notes[safeKey];touchSnapshot();markDirty(key,revision(existing));markDirty(safeKey,revision(item));
    await settle([key,safeKey]);
    refreshAreaNoteConsumers();
    return key;
  }
  // Renames or moves a note together with every note nested under it, in one
  // transaction that records the old names as deleted. Today's plan is never
  // touched: blocks still using an old name start a new note there. Where a
  // new name already holds a note with text, the move happens only with
  // options.merge(existingText,movedText), which returns the combined text.
  async function rename(fromKey,toLabel,options={}){
    if(!appCanMutate())return freeze({status:'rejected'});
    const source=normalizeAreaName(fromKey),label=clampText(displayAreaName(toLabel),APP_LIMITS.maxAreaNameChars),target=normalizeAreaName(label);
    if(!source||!target||isTrashKey(source)||isTrashKey(target)||!notes[source])return freeze({status:'rejected'});
    if(target.startsWith(`${source} > `))return freeze({status:'inside-itself'});
    await settle([source,target]);if(!notes[source])return freeze({status:'rejected'});
    const depth=source.split(' > ').length,labelParts=label.split(' > ');
    const moves=Object.keys(notes).filter(key=>!isTrashKey(key)&&(key===source||key.startsWith(`${source} > `))).map(key=>{
      const parts=displayAreaName(notes[key].label||key).split(' > '),to=target+key.slice(source.length);
      return {from:key,to,label:clampText(parts.length>=depth?[...labelParts,...parts.slice(depth)].join(' > '):displayAreaName(to),APP_LIMITS.maxAreaNameChars)};
    });
    const movedKeys=new Set(moves.map(move=>move.from)),clashes=moves.filter(move=>move.to!==move.from&&!movedKeys.has(move.to)&&hasContent(notes[move.to]));
    if(clashes.length&&typeof options.merge!=='function')return freeze({status:'collision',labels:freeze(clashes.map(move=>String(notes[move.to].label||move.to)))});
    const writes=[];
    for(const move of moves){
      const moved=notes[move.from],existing=move.to!==move.from&&!movedKeys.has(move.to)?notes[move.to]||null:null,merging=!!existing&&hasContent(existing);
      const text=merging?String(options.merge(String(existing.text||''),String(moved.text||''))):String(moved.text||'');
      if(!editorContentWithinLimits(text))return freeze({status:'content-limit',label:String(existing&&existing.label||move.label)});
      const prior=[existing,moved].map(revision).filter(Boolean).sort().at(-1)||'';
      writes.push({move,moved,existing,entry:{version:DATA_CONTRACT.schemas.AreaNote.version,key:move.to,label:merging?existing.label:move.label,text,updatedAt:nextRevision(prior)}});
    }
    // Every old name is freed before any new one is written, so a deeper note
    // may take a name another moved note just left.
    for(const {move,moved} of writes)if(move.to!==move.from){delete notes[move.from];markDirty(move.from,revision(moved));}
    for(const {move,moved,existing,entry} of writes){notes[move.to]=entry;markDirty(move.to,move.to===move.from?revision(moved):revision(existing));}
    touchSnapshot();
    await settle(writes.flatMap(({move})=>[move.from,move.to]));
    refreshAreaNoteConsumers();
    return freeze({status:'renamed',key:target,moved:freeze(moves.map(move=>freeze({from:move.from,to:move.to}))),merged:clashes.length});
  }
  function trashExpired(entry,now=decisionNowMs()){return timestamp(entry)<=now-TRASH_RETENTION_MS;}
  function trashSnapshot(){
    const now=decisionNowMs();
    return freeze(Object.values(notes).filter(entry=>isTrashKey(entry.key)&&!trashExpired(entry,now)).map(entry=>freeze({key:entry.key,label:String(entry.label||''),deletedAt:String(entry.updatedAt||''),hasNote:hasContent(entry)})).sort((a,b)=>b.deletedAt.localeCompare(a.deletedAt)));
  }
  // Deleted notes past their retention are removed on load and when the trash
  // is shown; saving follows the ordinary path.
  function purgeExpiredTrash(){
    if(!everLoaded||!appCanMutate())return 0;
    const now=decisionNowMs(),expired=Object.keys(notes).filter(key=>isTrashKey(key)&&trashExpired(notes[key],now));
    for(const key of expired){const current=notes[key];delete notes[key];markDirty(key,revision(current));}
    if(expired.length)touchSnapshot();
    return expired.length;
  }
  async function clearAllAreaNotes(){
    if(!appCanMutate())throw new Error('ongoing notes cannot be cleared without write ownership');
    await flush({strict:true});
    if(saveFailed)throw new Error(saveMessage||'current ongoing notes are not safely stored');
    const removedKeys=Object.keys(normalizePayload(notes));
    if(!removedKeys.length)return Object.freeze({count:0});
    resetPendingAreaNoteWrites();
    try{
      const deletedAt=new Date().toISOString(),deletions=removedKeys.filter(key=>!isTrashKey(key)).map(key=>({key,deletedAt}));
      await idbReplace(KeyedRecord.create(),removedKeys,{deletedEntries:deletions,recordDeletes:true});
      if(!clearIndependentRescueKeys(removedKeys))AppDiagnostics.capture('area-notes.rescue-clear',LocalStorageContract.lastError||new Error('Ongoing Note emergency rescue cleanup failed.'),'warn');
      wipeObject(notes);touchSnapshot();clearFailure();

      markStorageHealthOk('areaNotes','lastNotesSaveAt');
      refreshAreaNoteConsumers();
      reportCanonicalCommit('areaNote','delete');
      return Object.freeze({count:removedKeys.length});
    }catch(e){
      recordFailure(e&&e.message?e.message:'area note database failed');
      throw e;
    }
  }
  return Object.freeze({get,update,updateValidatedRich,remove,clearAll:clearAllAreaNotes,load,reloadFresh,readFreshPayload,readFreshItems,flush,protectUnsaved,trash,restore,rename,trashSnapshot,purgeExpiredTrash,exportPayload,replace,merge,reconcile,normalizePayload,metadataSnapshot,searchSnapshot,size,failure,migrateLegacyRecovery,migrateHistoricalCanonicalRows,verifyCurrentRecovery,recoverAfterStorageLoss});
})();

    return repository;
  }
  return freeze({format:'study-director.area-notes-repository-module',contractVersion:1,create});
});
})();
