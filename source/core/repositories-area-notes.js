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
    exactObject(input,['configuration','storage','codecs','keyedRecord','helpers','hooks','canonical','clock'],'Area Notes repository input');
    const configuration=exactObject(input.configuration,['limits','dataContract','stores','keys','legacyKeys','metaKeys'],'Area Notes configuration');
    const stores=exactObject(configuration.stores,['areaNotes','appMeta'],'Area Notes stores');
    const keys=exactObject(configuration.keys,['areaNoteRescue'],'Area Notes storage keys');
    const legacyKeys=exactObject(configuration.legacyKeys,['areaNotesPending'],'Area Notes legacy storage keys');
    const metaKeys=exactObject(configuration.metaKeys,['areaNoteRecoveryPrefix'],'Area Notes metadata keys');
    const storage=exactObject(input.storage,['local','meta','idbGetAll','idbStoreTransaction','idbStrictTransaction'],'Area Notes storage port');
    if(['idbGetAll','idbStoreTransaction','idbStrictTransaction'].some(key=>typeof storage[key]!=='function'))throw new TypeError('Area Notes storage functions are invalid.');
    const codecs=exactObject(input.codecs,['compatibility','sanitizeCurrentAreaNote'],'Area Notes codec port');
    if(typeof codecs.sanitizeCurrentAreaNote!=='function'||!Object.isFrozen(codecs.compatibility))throw new TypeError('Area Notes codec port is invalid.');
    if(!Object.isFrozen(input.keyedRecord))throw new TypeError('Area Notes keyed-record capability must be frozen.');
    const helpers=functions(input.helpers,['clampText','clampEditorContent','editorContentWithinLimits','wipeObject','normalizeAreaName','displayAreaName','normalizeTimestamp','sameDataValue','jsonByteLength','canonicalRuntimeError','isCanonicalRuntimeError'],'Area Notes helper port');
    const hooks=functions(input.hooks,['canMutate','assertWriteToken','compatibilityWriteToken','storageOk','reportCommit','onNotesChanged','onNoteSyncState','onNoteConflict','saveWarning','diagnosticsCapture'],'Area Notes hook port');
    const canonical=functions(input.canonical,['areaNoteDeletionValue','areaNotePreparationUnit','stageMutationEpoch','normalizeAreaNoteDeletions'],'Area Notes canonical port');
    const clock=functions(input.clock,['nowMs'],'Area Notes clock');
    const APP_LIMITS=configuration.limits,DATA_CONTRACT=configuration.dataContract,DB_AREA_NOTES_STORE=stores.areaNotes,DB_APP_META_STORE=stores.appMeta;
    const STORAGE_KEYS=freeze({areaNoteRescue:keys.areaNoteRescue}),LEGACY_STORAGE_KEYS=freeze({areaNotesPending:legacyKeys.areaNotesPending}),META_KEYS=freeze({areaNoteRecoveryPrefix:metaKeys.areaNoteRecoveryPrefix});
    const LocalStorageContract=storage.local,Meta=storage.meta,idbGetAll=storage.idbGetAll,idbStoreTransaction=storage.idbStoreTransaction,idbStrictTransaction=storage.idbStrictTransaction;
    const CompatibilityCodec=codecs.compatibility,sanitizeCurrentAreaNote=codecs.sanitizeCurrentAreaNote,KeyedRecord=input.keyedRecord;
    const {clampText,clampEditorContent,editorContentWithinLimits,wipeObject,normalizeAreaName,displayAreaName,normalizeTimestamp,sameDataValue,jsonByteLength,canonicalRuntimeError,isCanonicalRuntimeError}=helpers;
    const appCanMutate=hooks.canMutate,assertWriteToken=hooks.assertWriteToken,compatibilityWriteToken=hooks.compatibilityWriteToken,markStorageHealthOk=hooks.storageOk,reportCanonicalCommit=hooks.reportCommit,refreshAreaNoteConsumers=hooks.onNotesChanged,setNoteSyncStateForKey=hooks.onNoteSyncState,reportAreaNoteConflict=hooks.onNoteConflict,showSubjectNoteSaveWarning=hooks.saveWarning,AppDiagnostics=freeze({capture:hooks.diagnosticsCapture});
    const {areaNoteDeletionValue,areaNotePreparationUnit,stageMutationEpoch:stageCanonicalMutationEpoch,normalizeAreaNoteDeletions}=canonical;
    const decisionNowMs=clock.nowMs;
const repository=(()=>{
  const notes=KeyedRecord.create();
  const dirtyKeys=new Set();
  const dirtyBaseRevisions=new Map();
  // Last text both this tab and storage agreed on; the ancestor for conflict review.
  const dirtyBaseTexts=new Map();
  // Keys carried by a queued or running save batch. A batch that settles while a
  // later batch still carries the key must keep the key's base revision alive.
  const inFlightSaves=new Map();
  // Bumped when a conflict preserves a key's local text, so older queued batches
  // do not re-submit that text against the stored winner.
  const conflictGenerations=new Map();
  const AREA_NOTE_CONFLICT_FORMAT='study-director.area-note-conflict';
  let storageLossSignalled=false,everLoaded=false;
  const SAVE_DEBOUNCE_MS=1000;
  const RECOVERY_WRITE_INTERVAL_MS=200;
  const REVISION_TOUCH_INTERVAL_MS=500;
  let loadPromise=null,lastLoadReadFailed=false;
  let freshLoadPromise=null;
  let saveTimer=null;
  let recoveryWriteTimer=null;
  const recoveryWriteKeys=new Set();
  const revisionTouchedAt=new Map();
  let writeChain=Promise.resolve();
  let recoveryWriteChain=Promise.resolve();
  let saveFailed=false;
  let saveMessage='';
  let snapshotRevision=0,metadataSnapshotCache=null,searchSnapshotCache=null;

  function normalizePayload(payload,options={}){
    const strictRich=options&&options.strictRich===true;
    const out=KeyedRecord.create();
    const entries=Object.entries((payload&&typeof payload==='object')?payload:{}).slice(0,APP_LIMITS.maxImportAreaNotes);
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
    const entries=Object.entries((payload&&typeof payload==='object')?payload:{}).slice(0,APP_LIMITS.maxImportAreaNotes);
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
  function revision(entry){return normalizeTimestamp(entry&&entry.updatedAt,'')||'';}
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
    const records=Object.freeze(Object.values(notes).map(entry=>Object.freeze({key:String(entry.key||''),label:String(entry.label||entry.key||''),hasNote:hasContent(entry),updatedAt:String(entry.updatedAt||'')})));
    metadataSnapshotCache=Object.freeze({revision:snapshotRevision,records});return metadataSnapshotCache;
  }
  function searchSnapshot(){
    if(searchSnapshotCache&&searchSnapshotCache.revision===snapshotRevision)return searchSnapshotCache;
    const documents=Object.freeze(Object.values(notes).filter(hasContent).map(entry=>Object.freeze({key:String(entry.key||''),revision:String(entry.updatedAt||''),value:String(entry.text||'')})));
    searchSnapshotCache=Object.freeze({revision:snapshotRevision,documents});return searchSnapshotCache;
  }
  function clearFailure(){saveFailed=false;saveMessage='';}
  function recordFailure(reason){
    saveFailed=true;
    saveMessage=`Ongoing subject notes could not be saved normally${reason?`: ${reason}`:''}. Use Export backup before closing this tab; Study Director will include recoverable in-memory notes if IndexedDB remains unavailable.`;
    showSubjectNoteSaveWarning(reason);
  }
  function pendingCacheEntry(key){
    const safeKey=normalizeAreaName(key),entry=canonicalEntrySnapshot(notes[safeKey],safeKey);
    return entry||{key:safeKey,deleted:true,updatedAt:new Date().toISOString()};
  }
  const AREA_NOTE_RECOVERY_META_PREFIX=META_KEYS.areaNoteRecoveryPrefix;
  const AREA_NOTE_RECOVERY_FORMAT='study-director.area-note-recovery';
  const AREA_NOTE_RESCUE_FORMAT='study-director.area-note-rescue';
  function normalizeRescueEntries(raw){
    const out=KeyedRecord.create();
    const source=raw&&raw.format===AREA_NOTE_RESCUE_FORMAT&&Number(raw.version)===1&&raw.entries&&typeof raw.entries==='object'&&!Array.isArray(raw.entries)?raw.entries:{};
    Object.entries(source).slice(0,APP_LIMITS.maxImportAreaNotes).forEach(([rawKey,rawEntry])=>{
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
  function writeIndependentRescue(entries){
    const merged=readIndependentRescue();
    if(LocalStorageContract.lastError)return false;
    Object.entries(entries||{}).forEach(([rawKey,rawEntry])=>{const key=normalizeAreaName((rawEntry&&rawEntry.key)||rawKey);if(key&&rawEntry)merged[key]=rawEntry;});
    return persistIndependentRescue(merged);
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
  async function readPendingCache(){
    const entries=await readRecoveryEntries(),pending=KeyedRecord.create();
    for(const metaEntry of entries){const recovered=recoveryEntryFromValue(metaEntry.value,metaEntry.suffix);if(!recovered)throw canonicalRuntimeError(`Ongoing Note recovery ${String(metaEntry.key||'?')} is not in the current canonical schema.`);pending[recovered.key]=recovered.entry;}
    return pending;
  }
  async function persistPendingEntries(pending,{ownershipToken=null,reason='save Ongoing Note recovery'}={}){
    const entries=Object.entries(pending||{}).map(([rawKey,entry])=>{const key=normalizeAreaName(rawKey),now=new Date().toISOString();return key?{key,value:{format:AREA_NOTE_RECOVERY_FORMAT,version:1,key,entry,updatedAt:now}}:null;}).filter(Boolean);
    if(!entries.length)return true;
    return Meta.transaction('readwrite',(meta,tx,finish)=>{
      if(ownershipToken)assertWriteToken(ownershipToken,reason);
      let pendingWrites=entries.length,failed=false;
      for(const item of entries){
        const request=meta.put('areaNoteRecoveryPrefix',item.value,{suffix:item.key,updatedAt:item.value.updatedAt});
        request.onerror=()=>{if(failed)return;failed=true;finish(false,request.error||new Error('pending area note recovery write failed'));};
        request.onsuccess=()=>{if(failed)return;if(ownershipToken){try{assertWriteToken(ownershipToken,reason);}catch(error){failed=true;try{tx.abort();}catch{}finish(false,error);return;}}pendingWrites--;};
      }
      tx.oncomplete=()=>finish(true,pendingWrites===0);
    },{abortMessage:'pending area note recovery write aborted'});
  }
  function queueRecoveryWork(work,label){
    const queued=recoveryWriteChain.catch(()=>false).then(async()=>{
      try{return await work();}
      catch(e){AppDiagnostics.capture(label,e,'error');recordFailure(e&&e.message?e.message:'pending note recovery database failed');return false;}
    });
    recoveryWriteChain=queued;
    return queued;
  }
  function writePendingCacheForKeys(keys){
    const unique=[...new Set((keys||[]).map(normalizeAreaName).filter(Boolean))];
    if(!unique.length)return recoveryWriteChain;
    return queueRecoveryWork(async()=>{
      const pending=KeyedRecord.create();unique.forEach(key=>{pending[key]=pendingCacheEntry(key)});
      try{return await persistPendingEntries(pending);}
      catch(error){
        if(!writeIndependentRescue(pending)){
          const rescueError=LocalStorageContract.lastError||new Error(`Ongoing Note emergency rescue exceeds ${Math.round(APP_LIMITS.areaNoteRescueBytes/1024)} KB.`);
          AppDiagnostics.capture('area-notes.rescue-write',rescueError,'error');
        }
        throw error;
      }
    },'area-notes.pending-write');
  }
  function flushPendingRecoveryWrites(extraKeys=[]){
    if(recoveryWriteTimer){clearTimeout(recoveryWriteTimer);recoveryWriteTimer=null;}
    for(const key of extraKeys||[]){const safeKey=normalizeAreaName(key);if(safeKey)recoveryWriteKeys.add(safeKey);}
    if(!recoveryWriteKeys.size)return recoveryWriteChain;
    const keys=[...recoveryWriteKeys];recoveryWriteKeys.clear();
    return writePendingCacheForKeys(keys);
  }
  function schedulePendingRecoveryWrite(key,{immediate=false}={}){
    const safeKey=normalizeAreaName(key);if(!safeKey)return false;
    recoveryWriteKeys.add(safeKey);
    if(immediate){void flushPendingRecoveryWrites();return true;}
    if(!recoveryWriteTimer)recoveryWriteTimer=setTimeout(()=>{recoveryWriteTimer=null;void flushPendingRecoveryWrites();},RECOVERY_WRITE_INTERVAL_MS);
    return true;
  }
  function clearPendingCacheKeys(keys){
    const suffixes=[...new Set((keys||[]).map(normalizeAreaName).filter(Boolean))];
    if(!suffixes.length)return recoveryWriteChain;
    return queueRecoveryWork(()=>Meta.transaction('readwrite',(meta,tx,finish)=>{for(const suffix of suffixes)meta.remove('areaNoteRecoveryPrefix',suffix);tx.oncomplete=()=>finish(true,true);},{abortMessage:'pending area note recovery clear aborted'}),'area-notes.pending-clear');
  }
  async function verifyCurrentRecovery(){
    const issues=[];let entries=[];
    try{entries=await readRecoveryEntries();for(const entry of entries)if(!recoveryEntryFromValue(entry.value,entry.suffix))issues.push(`area-note-recovery:${entry.key||'?'}`);}
    catch(error){issues.push(`area-note-recovery:${String(error&&error.message||error)}`);}
    const rawRescue=LocalStorageContract.getJson(STORAGE_KEYS.areaNoteRescue,null);
    if(LocalStorageContract.lastError)issues.push('area-note-rescue-unreadable');
    else if(rawRescue){
      const normalized=normalizeRescueEntries(rawRescue);
      if(rawRescue.format!==AREA_NOTE_RESCUE_FORMAT||Number(rawRescue.version)!==1||!Number.isFinite(Date.parse(String(rawRescue.updatedAt||'')))||!rawRescue.entries||Object.keys(normalized).length!==Object.keys(rawRescue.entries).length||jsonByteLength(rawRescue)>APP_LIMITS.areaNoteRescueBytes)issues.push('area-note-rescue-invalid');
    }
    return Object.freeze({ok:issues.length===0,rows:entries.length+(rawRescue?1:0),issues:Object.freeze(issues)});
  }
  async function migrateLegacyRecovery(){
    const token=compatibilityWriteToken('migrate Ongoing Note recovery');
    if(!token)return Object.freeze({status:'skipped',reason:'not-primary',records:0});
    const pending=readLegacyPendingCache();
    const keys=Object.keys(pending);
    if(!keys.length)return Object.freeze({status:'not-needed',records:0});
    for(const key of keys){
      const canonical=CompatibilityCodec.areaNote(pending[key],key);
      if(!canonical)throw new Error(`Legacy Ongoing Note recovery for ${key} could not be converted safely. The source payload was preserved.`);
      pending[key]=canonical;
    }
    assertWriteToken(token,'migrate Ongoing Note recovery');
    await persistPendingEntries(pending,{ownershipToken:token,reason:'migrate Ongoing Note recovery'});
    assertWriteToken(token,'migrate Ongoing Note recovery');
    const persisted=await readPendingCache();
    for(const key of keys){
      if(JSON.stringify(normalizePayload({[key]:persisted[key]})[key]||null)!==JSON.stringify(normalizePayload({[key]:pending[key]})[key]||null)){
        throw new Error(`Legacy Ongoing Note recovery for ${key} was not verified after migration. The source payload was preserved.`);
      }
    }
    assertWriteToken(token,'migrate Ongoing Note recovery');
    if(!LocalStorageContract.remove(LEGACY_STORAGE_KEYS.areaNotesPending))throw new Error('Legacy Ongoing Note recovery could not be retired after verified migration.');
    return Object.freeze({status:'migrated',records:keys.length});
  }
  function markDirty(key,baseRevision,baseText=undefined){
    const safeKey=normalizeAreaName(key);
    if(!safeKey)return;
    const wasDirty=dirtyKeys.has(safeKey);
    if(!dirtyBaseRevisions.has(safeKey)){
      dirtyBaseRevisions.set(safeKey,String(baseRevision===undefined?revision(notes[safeKey]):baseRevision||''));
      dirtyBaseTexts.set(safeKey,baseText===undefined?String(notes[safeKey]?.text||''):String(baseText||''));
    }
    dirtyKeys.add(safeKey);
    setNoteSyncStateForKey(safeKey,'saving');
    schedulePendingRecoveryWrite(safeKey,{immediate:!wasDirty});
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
      if(recordDeletes){const now=new Date().toISOString();for(const rawKey of removedKeys){const key=normalizeAreaName(rawKey);if(key&&!normalized[key]){const deletion=areaNoteDeletionValue(key,deletedByKey.get(key)?.deletedAt||now);meta.put('areaNoteDeletionPrefix',deletion,{suffix:key,updatedAt:deletion.deletedAt});}}}
      for(const entry of deletedEntries)if(!normalized[entry.key]){const deletion=areaNoteDeletionValue(entry.key,entry.deletedAt);meta.put('areaNoteDeletionPrefix',deletion,{suffix:entry.key,updatedAt:deletion.deletedAt});}
      tx.oncomplete=()=>finish(true);
    },'area note replacement aborted');
  }
  async function idbApplyDelta(keys,expectedRevisions){
    const uniqueKeys=[...new Set((keys||[]).map(normalizeAreaName).filter(Boolean))];
    const canonical=new Map(uniqueKeys.map(key=>[key,canonicalEntrySnapshot(notes[key],key)]));
    const storageLost=storageLossSignalled;
    return idbStrictTransaction([DB_AREA_NOTES_STORE,DB_APP_META_STORE],'readwrite',(tx,finish)=>{
      const store=tx.objectStore(DB_AREA_NOTES_STORE),meta=Meta.view(tx),conflicts=[],committedRevisions=KeyedRecord.create(),committedTexts=KeyedRecord.create(),deletedAt=new Date().toISOString();let epochStaged=false;
      const stageMutation=()=>{if(!epochStaged){stageCanonicalMutationEpoch(tx,uniqueKeys.map(areaNotePreparationUnit));epochStaged=true;}};
      // Requests complete in issue order, so these reads observe the state before
      // any write below. A database without any canonical mutation epoch was
      // recreated (browser data cleared) rather than edited elsewhere.
      const epoch=meta.get('canonicalMutationEpoch');
      epoch.request.onerror=()=>finish(false,epoch.request.error||new Error('area note epoch read failed'));
      uniqueKeys.forEach(key=>{
        const entry=canonical.get(key);committedRevisions[key]=entry?revision(entry):'';committedTexts[key]=entry?String(entry.text||''):'';
        const deletion=meta.get('areaNoteDeletionPrefix',key);
        deletion.request.onerror=()=>finish(false,deletion.request.error||new Error('area note deletion read failed'));
        const request=store.get(key);
        request.onerror=()=>finish(false,request.error||new Error('area note revision read failed'));
        request.onsuccess=()=>{
          const persistedRaw=request.result||null,persistedRevision=normalizeTimestamp(persistedRaw&&persistedRaw.updatedAt,'')||'';
          const expected=expectedRevisions&&expectedRevisions.has(key)?String(expectedRevisions.get(key)||''):persistedRevision;
          if(persistedRevision!==expected){
            const persisted=persistedRaw?normalizePayload({[key]:persistedRaw})[key]||null:null;
            // A row that vanished without a deletion record, after the browser
            // removed this site's data, is lost storage rather than a newer
            // decision made elsewhere. Rewrite it from this tab.
            const vanished=!persistedRaw&&!!expected&&!deletion.value()&&(storageLost||!epoch.value());
            // Identical content is not a competing edit.
            const sameContent=!!persisted&&!!entry&&String(persisted.text||'')===String(entry.text||'')&&String(persisted.label||'')===String(entry.label||'');
            if(!vanished&&!sameContent){conflicts.push({key,persisted});return;}
            if(vanished)storageLossSignalled=true;
          }
          stageMutation();if(entry){store.put(entry);meta.remove('areaNoteDeletionPrefix',key);}else{store.delete(key);const deletion=areaNoteDeletionValue(key,deletedAt);meta.put('areaNoteDeletionPrefix',deletion,{suffix:key,updatedAt:deletion.deletedAt});}
        };
      });
      tx.oncomplete=()=>finish(true,{conflicts,committedRevisions,committedTexts});
    },'area note transaction aborted');
  }
  async function performLoad({strict=false}={}){
    const revisionAtStart=snapshotRevision,writesAtStart=writeChain;
    let loaded={};lastLoadReadFailed=false;
    await writesAtStart;
    await flushPendingRecoveryWrites([...dirtyKeys]);
    const rescueBeforeRead=readIndependentRescue(),pendingBeforeRead=await readPendingCache();
    try{
      loaded=await idbRead();
    }catch(e){
      lastLoadReadFailed=true;AppDiagnostics.capture('area-notes.load',e,'error');
      if(strict||isCanonicalRuntimeError(e))throw e;
    }
    const pendingAfterRead=await readPendingCache(),rescueAfterRead=readIndependentRescue();
    // Notes this tab already loaded but storage no longer holds, without any
    // deletion record, survived a browser data clear only in memory. Keep them
    // and write them back instead of wiping the last copy.
    const survivors=KeyedRecord.create();
    if(everLoaded&&!lastLoadReadFailed){
      const missing=Object.keys(notes).filter(key=>hasContent(notes[key])&&!loaded[key]&&![rescueBeforeRead,pendingBeforeRead,pendingAfterRead,rescueAfterRead].some(source=>source[key]));
      if(missing.length){
        let deleted=new Set(),recreated=true;
        try{
          recreated=storageLossSignalled||!(await Meta.read('canonicalMutationEpoch'));
          if(recreated)deleted=new Set((await Meta.list('areaNoteDeletionPrefix')).map(entry=>normalizeAreaName(entry.suffix)));
        }catch(error){AppDiagnostics.capture('area-notes.storage-loss-check',error,'warn');}
        if(recreated)for(const key of missing)if(!deleted.has(key))survivors[key]=canonicalEntrySnapshot(notes[key],key);
      }
    }
    // Request results precede transaction completion. An edit or queued save
    // in that interval invalidates this snapshot, including equal timestamps.
    // Keep its dirty state and timers; a later stable recovery can adopt safely.
    if(snapshotRevision!==revisionAtStart||writeChain!==writesAtStart){
      lastLoadReadFailed=true;
      const error=new Error('Ongoing notes changed during recovery. Recovery remains pending.');
      error.code='AREA_NOTE_RECOVERY_SUPERSEDED';throw error;
    }
    const merged=applyDeltas(applyDeltas(applyDeltas(applyDeltas(loaded,rescueBeforeRead),pendingBeforeRead),pendingAfterRead),rescueAfterRead);
    for(const [key,entry] of Object.entries(survivors)){const clean=normalizePayload({[key]:entry})[key];if(clean&&!merged[key])merged[key]=clean;}
    if(saveTimer){clearTimeout(saveTimer);saveTimer=null;}
    dirtyKeys.clear();
    dirtyBaseRevisions.clear();
    dirtyBaseTexts.clear();
    revisionTouchedAt.clear();
    recoveryWriteKeys.clear();
    if(recoveryWriteTimer){clearTimeout(recoveryWriteTimer);recoveryWriteTimer=null;}
    wipeObject(notes);
    Object.assign(notes,merged);
    touchSnapshot();
    const loadedJson=JSON.stringify(normalizePayload(loaded));
    const mergedJson=JSON.stringify(merged);
    if(mergedJson!==loadedJson){
      new Set([...Object.keys(rescueBeforeRead),...Object.keys(pendingBeforeRead),...Object.keys(pendingAfterRead),...Object.keys(rescueAfterRead),...Object.keys(survivors)]).forEach(key=>{
        const safeKey=normalizeAreaName(key);
        if(safeKey){dirtyKeys.add(safeKey);dirtyBaseRevisions.set(safeKey,revision(loaded[safeKey]));dirtyBaseTexts.set(safeKey,String(loaded[safeKey]?.text||''));}
      });
      scheduleSave();
    }
    everLoaded=true;
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
      await writeChain.catch(error=>{AppDiagnostics.capture('area-notes.pre-reload-write',error,'error');});
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
  function conflictCopyValue(key,persisted,ancestor){
    const local=notes[key];
    if(!local)return null;
    const text=String(local.text||'');
    if(!text.trim()||(persisted&&String(persisted.text||'')===text))return null;
    return {format:AREA_NOTE_CONFLICT_FORMAT,version:1,key,label:clampText(displayAreaName(local.label||key),APP_LIMITS.maxAreaNameChars),text,ancestor:typeof ancestor==='string'?ancestor:null,storedRevision:persisted?revision(persisted):'',createdAt:new Date().toISOString()};
  }
  function persistConflictCopies(copies){
    const values=(copies||[]).filter(Boolean);
    if(!values.length)return Promise.resolve(true);
    return Meta.transaction('readwrite',(meta,tx,finish)=>{
      let failed=false;
      for(const value of values){
        const request=meta.put('areaNoteConflictPrefix',value,{suffix:value.key,updatedAt:value.createdAt});
        request.onerror=()=>{if(failed)return;failed=true;finish(false,request.error||new Error('Ongoing Note conflict copy write failed'));};
      }
      tx.oncomplete=()=>finish(true,true);
    },{strict:true,abortMessage:'Ongoing Note conflict copy write aborted'});
  }
  // The losing text of a genuine conflict is written durably before its recovery
  // journal is retired. The stored winner is never overwritten here.
  const unsavedConflictCopies=new Map();
  function preserveConflicts(copies,keys,labels=new Map()){
    for(const value of (copies||[]).filter(Boolean))unsavedConflictCopies.set(value.key,value);
    const suffixes=[...new Set((keys||[]).map(normalizeAreaName).filter(Boolean))];
    return queueRecoveryWork(async()=>{
      const values=[...unsavedConflictCopies.values()];
      await persistConflictCopies(values);
      for(const value of values)if(unsavedConflictCopies.get(value.key)===value)unsavedConflictCopies.delete(value.key);
      if(suffixes.length){
        await Meta.transaction('readwrite',(meta,tx,finish)=>{for(const suffix of suffixes)meta.remove('areaNoteRecoveryPrefix',suffix);tx.oncomplete=()=>finish(true,true);},{abortMessage:'pending area note recovery clear aborted'});
        if(!clearIndependentRescueKeys(suffixes))AppDiagnostics.capture('area-notes.rescue-clear',LocalStorageContract.lastError||new Error('Ongoing Note emergency rescue cleanup failed.'),'warn');
      }
      for(const value of values)reportAreaNoteConflict(Object.freeze({key:value.key,label:labels.get(value.key)||value.label,preserved:true}));
      return true;
    },'area-notes.conflict-copy');
  }
  function runSave(keys,options={}){
    const deltaKeys=[...new Set((keys||[]).map(normalizeAreaName).filter(Boolean))];
    if(!deltaKeys.length)return writeChain;
    const recoveryReady=flushPendingRecoveryWrites(deltaKeys);
    const generations=new Map(deltaKeys.map(key=>[key,conflictGenerations.get(key)||0]));
    for(const key of deltaKeys)inFlightSaves.set(key,(inFlightSaves.get(key)||0)+1);
    let released=false,activeKeys=[],ancestors=new Map();
    const release=()=>{
      if(released)return;released=true;
      for(const key of deltaKeys){const remaining=(inFlightSaves.get(key)||1)-1;if(remaining>0)inFlightSaves.set(key,remaining);else inFlightSaves.delete(key);}
    };
    writeChain=writeChain.catch(error=>{AppDiagnostics.capture('area-notes.previous-write',error,'error');}).then(async()=>{
      await recoveryReady;
      // An earlier batch already preserved this text as a conflict copy.
      activeKeys=deltaKeys.filter(key=>(conflictGenerations.get(key)||0)===generations.get(key));
      if(!activeKeys.length)return {conflicts:[],committedRevisions:KeyedRecord.create(),committedTexts:KeyedRecord.create()};
      // Read the expected revisions only now: an earlier batch for the same key
      // has settled and advanced the base to the revision it committed.
      const expectedRevisions=new Map(activeKeys.map(key=>[key,dirtyBaseRevisions.get(key)||'']));
      ancestors=new Map(activeKeys.map(key=>[key,dirtyBaseTexts.has(key)?dirtyBaseTexts.get(key):null]));
      return idbApplyDelta(activeKeys,expectedRevisions);
    })
      .then(async result=>{
        release();
        const conflicts=new Map((result&&result.conflicts||[]).map(item=>[item.key,item.persisted]));
        const savedKeys=activeKeys.filter(key=>!conflicts.has(key));
        let canonicalRefreshNeeded=false;
        savedKeys.forEach(key=>{
          if(dirtyKeys.has(key)||inFlightSaves.has(key)){
            dirtyBaseRevisions.set(key,String(result.committedRevisions[key]||''));
            dirtyBaseTexts.set(key,String(result.committedTexts[key]||''));
            writePendingCacheForKeys([key]);
          }else{
            dirtyBaseRevisions.delete(key);
            dirtyBaseTexts.delete(key);
            revisionTouchedAt.delete(key);
            clearPendingCacheKeys([key]);
            if(!result.committedRevisions[key]){delete notes[key];canonicalRefreshNeeded=true;}
            setNoteSyncStateForKey(key,'synced');
          }
        });
        const copies=[],labels=new Map();
        conflicts.forEach((persisted,key)=>{
          copies.push(conflictCopyValue(key,persisted,ancestors.get(key)));
          labels.set(key,persisted&&persisted.label||notes[key]&&notes[key].label||displayAreaName(key));
          conflictGenerations.set(key,(conflictGenerations.get(key)||0)+1);
          dirtyKeys.delete(key);dirtyBaseRevisions.delete(key);dirtyBaseTexts.delete(key);revisionTouchedAt.delete(key);recoveryWriteKeys.delete(key);
          if(persisted)notes[key]=persisted;else delete notes[key];
        });
        if(conflicts.size)void preserveConflicts(copies,[...conflicts.keys()],labels);
        if(!clearIndependentRescueKeys(savedKeys))AppDiagnostics.capture('area-notes.rescue-clear',LocalStorageContract.lastError||new Error('Ongoing Note emergency rescue cleanup failed.'),'warn');
        clearFailure();

        markStorageHealthOk('areaNotes','lastNotesSaveAt');
        if(savedKeys.length)reportCanonicalCommit('areaNote','upsert',null,{backupCapture:options.backupCapture===true});
        if(canonicalRefreshNeeded||conflicts.size)touchSnapshot();
        if(canonicalRefreshNeeded)refreshAreaNoteConsumers();
        if(conflicts.size){
          refreshAreaNoteConsumers();
          conflicts.forEach((persisted,key)=>{if(!copies.some(copy=>copy&&copy.key===key))reportAreaNoteConflict(Object.freeze({key,label:labels.get(key),preserved:false}));});
        }
      })
      .catch(e=>{
        release();
        deltaKeys.forEach(key=>dirtyKeys.add(key));
        recordFailure(e&&e.message?e.message:'area note database failed');
      });
    return writeChain;
  }
  function scheduleSave(){
    if(!appCanMutate())return writeChain;
    if(!dirtyKeys.size)Object.keys(notes).forEach(key=>markDirty(key));
    if(saveTimer)clearTimeout(saveTimer);
    saveTimer=setTimeout(()=>{
      saveTimer=null;
      const keys=[...dirtyKeys];
      dirtyKeys.clear();
      void runSave(keys);
    },SAVE_DEBOUNCE_MS);
    return writeChain;
  }
  function updateInternal(key,label,value,expectedRevision='',validatedRich=false){
    if(!appCanMutate())return {status:'rejected',revision:''};
    const safeKey=normalizeAreaName(key);
    if(!safeKey)return {status:'rejected',revision:''};
    const current=notes[safeKey]||null;
    const currentRevision=revision(current);
    if(String(expectedRevision||'')!==currentRevision){
      // The editor was bound to an older revision. Keep the stored note, but
      // retain the rejected text so it can be reviewed instead of vanishing.
      const rejected=String(value||''),conflictLabel=clampText(displayAreaName(label||current&&current.label||safeKey),APP_LIMITS.maxAreaNameChars);
      if(rejected.trim()&&(!current||String(current.text||'')!==rejected)&&(validatedRich||editorContentWithinLimits(rejected))){
        const copy={format:AREA_NOTE_CONFLICT_FORMAT,version:1,key:safeKey,label:conflictLabel,text:validatedRich?rejected:clampEditorContent(rejected,APP_LIMITS.maxNoteChars),ancestor:null,storedRevision:currentRevision,createdAt:new Date().toISOString()};
        void preserveConflicts([copy],[],new Map([[safeKey,current&&current.label||conflictLabel]]));
      }else reportAreaNoteConflict(Object.freeze({key:safeKey,label:current&&current.label||displayAreaName(label||safeKey),preserved:false}));
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
    if(!current&&nextText.trim()&&size()>=APP_LIMITS.maxOngoingNotes)return {status:'limit',revision:currentRevision};
    if(!current&&!nextText.trim())return {status:'unchanged',revision:currentRevision};
    const entry=ensureEntry(safeKey,nextLabel);
    if(!entry)return {status:'rejected',revision:currentRevision};
    const nowMs=decisionNowMs(),lastTouch=revisionTouchedAt.get(safeKey)||0,touchRevision=!dirtyKeys.has(safeKey)||nowMs-lastTouch>=REVISION_TOUCH_INTERVAL_MS;
    const previousText=current?String(current.text||''):'';
    entry.text=nextText;
    entry.label=nextLabel;
    if(touchRevision){entry.updatedAt=new Date(nowMs).toISOString();revisionTouchedAt.set(safeKey,nowMs);}
    touchSnapshot();
    markDirty(entry.key,currentRevision,previousText);
    scheduleSave();
    return {status:'changed',revision:revision(entry)};
  }
  function update(key,label,value,expectedRevision=''){return updateInternal(key,label,value,expectedRevision,false);}
  function updateValidatedRich(key,label,value,expectedRevision=''){return updateInternal(key,label,value,expectedRevision,true);}
  async function repairStaleFailureIfCanonical(){
    if(!saveFailed||dirtyKeys.size)return !saveFailed;
    const revisionAtStart=snapshotRevision,current=prepareExportPayload(notes);
    let canonical,pending,rescue;
    try{
      canonical=normalizePayload(await idbRead());
      if(snapshotRevision!==revisionAtStart||dirtyKeys.size||!sameDataValue(canonical,current))return false;
      [pending,rescue]=await Promise.all([readPendingCache(),Promise.resolve(readIndependentRescue())]);
      if(snapshotRevision!==revisionAtStart||dirtyKeys.size)return false;
      for(const [key,entry] of Object.entries(pending||{})){
        const normalized=normalizePayload({[key]:entry})[key]||null;
        if(!sameDataValue(normalized,current[key]||null))return false;
      }
      for(const [key,entry] of Object.entries(rescue||{})){
        const normalized=normalizePayload({[key]:entry})[key]||null;
        if(!sameDataValue(normalized,current[key]||null))return false;
      }
      const recoveryKeys=[...new Set([...Object.keys(pending||{}),...Object.keys(rescue||{})])];
      if(recoveryKeys.length){
        await clearPendingCacheKeys(recoveryKeys);
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
    if(storageLossSignalled)return true;
    try{return !(await Meta.read('canonicalMutationEpoch'));}
    catch(error){AppDiagnostics.capture('area-notes.storage-loss-probe',error,'warn');return false;}
  }
  // The browser removed this site's stored data while the page stayed open.
  // Everything this tab still holds is now the best copy: journal it, then
  // write every note back. Missing rows are accepted; present rows still
  // follow the ordinary revision check.
  async function recoverAfterStorageLoss(){
    storageLossSignalled=true;
    if(!appCanMutate())return false;
    for(const key of Object.keys(notes))markDirty(key);
    if(unsavedConflictCopies.size)void preserveConflicts([],[]);
    await flush();
    await recoveryWriteChain.catch(()=>false);
    const recovered=!saveFailed&&!dirtyKeys.size&&!unsavedConflictCopies.size;
    if(recovered)storageLossSignalled=false;
    return recovered;
  }
  function flush(options={}){
    const strict=!!(options&&options.strict),backupCapture=options&&options.backupCapture===true;
    if(!appCanMutate())return strict?Promise.reject(new Error('ongoing notes cannot flush without write ownership')):writeChain;
    let pending;
    if(saveTimer){
      clearTimeout(saveTimer);
      saveTimer=null;
      const keys=[...dirtyKeys];
      dirtyKeys.clear();
      pending=runSave(keys,{backupCapture});
    }else if(dirtyKeys.size){
      const keys=[...dirtyKeys];
      dirtyKeys.clear();
      pending=runSave(keys,{backupCapture});
    }else pending=Promise.resolve(flushPendingRecoveryWrites()).then(()=>writeChain);
    if(!strict)return pending;
    return Promise.resolve(pending).then(async()=>{
      if(dirtyKeys.size)throw new Error(saveMessage||'current ongoing notes are not safely stored');
      if(unsavedConflictCopies.size){await preserveConflicts([],[]);if(unsavedConflictCopies.size)throw new Error(saveMessage||'an Ongoing Note conflict copy is not safely stored');}
      if(saveFailed&&!(await repairStaleFailureIfCanonical())){
        if(!(await storageAppearsRecreated())||!(await recoverAfterStorageLoss()))throw new Error(saveMessage||'current ongoing notes are not safely stored');
      }
      return true;
    });
  }
  function prepareExportPayload(payload){return normalizePayload(payload);}
  function exportPayload(){return prepareExportPayload(notes);}
  async function readFreshPayload(){
    await flushPendingRecoveryWrites();
    const rescueBeforeRead=readIndependentRescue(),pendingBeforeRead=await readPendingCache();
    const loaded=await idbRead();
    const pendingAfterRead=await readPendingCache(),rescueAfterRead=readIndependentRescue();
    return prepareExportPayload(applyDeltas(applyDeltas(applyDeltas(applyDeltas(loaded,rescueBeforeRead),pendingBeforeRead),pendingAfterRead),rescueAfterRead));
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
  function applyDeletes(keys){
    const removed=[...new Set((keys||[]).map(normalizeAreaName).filter(Boolean))];
    if(!removed.length)return 0;
    let changed=false;
    removed.forEach(key=>{if(Object.hasOwn(notes,key))changed=true;delete notes[key];dirtyKeys.delete(key);dirtyBaseRevisions.delete(key);dirtyBaseTexts.delete(key);revisionTouchedAt.delete(key);recoveryWriteKeys.delete(key);});
    if(changed)touchSnapshot();
    clearPendingCacheKeys(removed);
    refreshAreaNoteConsumers();
    return removed.length;
  }
  function resetPendingAreaNoteWrites(){
    if(saveTimer){clearTimeout(saveTimer);saveTimer=null;}
    if(recoveryWriteTimer){clearTimeout(recoveryWriteTimer);recoveryWriteTimer=null;}
    recoveryWriteKeys.clear();revisionTouchedAt.clear();dirtyKeys.clear();dirtyBaseRevisions.clear();dirtyBaseTexts.clear();
  }
  async function commitCollection(payload,{merge,deletions=[]}={}){
    await flush();
    if(saveFailed)throw new Error(saveMessage||'current ongoing notes are not safely stored');
    const previous=normalizePayload(notes),imported=normalizePayload(payload,{strictRich:true}),deletedEntries=normalizeAreaNoteDeletions(deletions);
    const next=merge?Object.assign(previous,imported):imported;
    for(const entry of deletedEntries)delete next[entry.key];
    const previousKeys=new Set(Object.keys(previous)),nextKeys=new Set(Object.keys(next));
    const removedKeys=[...previousKeys].filter(key=>!nextKeys.has(key));
    resetPendingAreaNoteWrites();
    try{
      await idbReplace(next,removedKeys,{deletedEntries});
      await clearPendingCacheKeys([...previousKeys,...nextKeys]);
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
  function conflictCopyFromEntry(entry){
    const value=entry&&entry.value,key=normalizeAreaName(value&&value.key);
    if(!value||value.format!==AREA_NOTE_CONFLICT_FORMAT||Number(value.version)!==1||!key||key!==normalizeAreaName(entry.suffix))return null;
    return freeze({key,label:String(value.label||key),text:String(value.text||''),ancestor:typeof value.ancestor==='string'?value.ancestor:null,storedRevision:String(value.storedRevision||''),createdAt:String(value.createdAt||'')});
  }
  async function listConflicts(){
    await recoveryWriteChain.catch(()=>false);
    const byKey=new Map();
    for(const entry of await Meta.list('areaNoteConflictPrefix')){const copy=conflictCopyFromEntry(entry);if(copy)byKey.set(copy.key,copy);}
    for(const value of unsavedConflictCopies.values()){const copy=conflictCopyFromEntry({suffix:value.key,value});if(copy)byKey.set(copy.key,copy);}
    return freeze([...byKey.values()].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.key.localeCompare(b.key)));
  }
  // A newer copy written after the caller reviewed this one is never retired.
  async function discardConflict(key,expectedCreatedAt=''){
    const safeKey=normalizeAreaName(key);if(!safeKey)return false;
    const unsaved=unsavedConflictCopies.get(safeKey);
    if(unsaved&&(!expectedCreatedAt||unsaved.createdAt===expectedCreatedAt))unsavedConflictCopies.delete(safeKey);
    await recoveryWriteChain.catch(()=>false);
    return Meta.transaction('readwrite',(meta,tx,finish)=>{
      const current=meta.get('areaNoteConflictPrefix',safeKey);let removed=false;
      current.request.onerror=()=>finish(false,current.request.error||new Error('Ongoing Note conflict copy read failed'));
      current.request.onsuccess=()=>{const value=current.value();if(value&&(!expectedCreatedAt||String(value.createdAt||'')===String(expectedCreatedAt))){meta.remove('areaNoteConflictPrefix',safeKey);removed=true;}};
      tx.oncomplete=()=>finish(true,removed||!current.value());
    },{strict:true,abortMessage:'Ongoing Note conflict copy removal aborted'});
  }
  // Applies reviewed text on top of the stored winner, then retires the copy.
  async function resolveConflict(key,text,expectedCreatedAt=''){
    if(!appCanMutate())throw new Error('Ongoing Notes cannot be changed without write ownership.');
    const safeKey=normalizeAreaName(key);if(!safeKey)throw new Error('Ongoing Note conflict key is invalid.');
    await flush({strict:true});
    const current=notes[safeKey]||null,label=current&&current.label||safeKey;
    const result=update(safeKey,label,String(text||''),revision(current));
    if(!['changed','unchanged'].includes(result.status))throw new Error(result.status==='content-limit'||result.status==='limit'?'The resolved note exceeds the Ongoing Note limits.':'The resolved note could not be applied.');
    await flush({strict:true});
    await discardConflict(safeKey,expectedCreatedAt);
    return freeze({key:safeKey,status:result.status,revision:result.revision});
  }
  function replace(payload){return commitCollection(payload,{merge:false});}
  function merge(payload){return commitCollection(payload,{merge:true});}
  function reconcile(payload,deletions=[]){return commitCollection(payload,{merge:true,deletions});}
  async function remove(key){
    if(!appCanMutate())return false;
    const safeKey=normalizeAreaName(key);if(!safeKey||!notes[safeKey])return false;
    await flush({strict:true});const current=notes[safeKey];if(!current)return false;
    delete notes[safeKey];touchSnapshot();markDirty(safeKey,revision(current),String(current.text||''));
    await flush({strict:true});return !notes[safeKey];
  }
  async function clearAllAreaNotes(){
    if(!appCanMutate())throw new Error('ongoing notes cannot be cleared without write ownership');
    await flush({strict:true});
    if(saveFailed)throw new Error(saveMessage||'current ongoing notes are not safely stored');
    const removedKeys=Object.keys(normalizePayload(notes));
    if(!removedKeys.length)return Object.freeze({count:0});
    resetPendingAreaNoteWrites();
    try{
      const deletedAt=new Date().toISOString(),deletions=removedKeys.map(key=>({key,deletedAt}));
      await idbReplace(KeyedRecord.create(),removedKeys,{deletedEntries:deletions,recordDeletes:true});
      await clearPendingCacheKeys(removedKeys);
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
  return Object.freeze({get,update,updateValidatedRich,remove,clearAll:clearAllAreaNotes,load,reloadFresh,readFreshPayload,readFreshItems,flush,exportPayload,replace,merge,reconcile,applyDeletes,normalizePayload,metadataSnapshot,searchSnapshot,size,failure,migrateLegacyRecovery,migrateHistoricalCanonicalRows,verifyCurrentRecovery,conflicts:listConflicts,resolveConflict,discardConflict,recoverAfterStorageLoss});
})();

    return repository;
  }
  return freeze({format:'study-director.area-notes-repository-module',contractVersion:1,create});
});
})();
