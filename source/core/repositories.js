(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,functionPort:functions}=registry.contracts;
registry.define('repositories',1,()=>{
  const freeze=Object.freeze;
  const DATA_MAINTENANCE_VERSION=6;
  function exactValue(value,keys){return !!(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|'));}
  function createAppMetaValidators(input){
    exactObject(input,['limits','dataContract','dailyRecordCodec','personalDataCodec','helpers'],'Repository appMeta validators input');
    if(!Object.isFrozen(input.limits)||!Object.isFrozen(input.dataContract)||!Object.isFrozen(input.dailyRecordCodec)||!Object.isFrozen(input.personalDataCodec)||!Object.isFrozen(input.helpers))throw new TypeError('Repository appMeta validator contracts must be frozen.');
    functions(input.helpers,['isValidIsoDate','normalizeAreaName','normalizeTimestamp','sameDataValue'],'Repository appMeta validator helpers');
    const APP_LIMITS=input.limits,DATA_CONTRACT=input.dataContract,DailyRecordCodec=input.dailyRecordCodec,PersonalDataCodec=input.personalDataCodec;
    const {isValidIsoDate,normalizeAreaName,normalizeTimestamp,sameDataValue}=input.helpers;
    const validIso=value=>Number.isFinite(Date.parse(String(value||'')));
    const attachmentId=value=>/^(?:att|img)-[a-z0-9-]{20,80}$/u.test(String(value||''));
    const backupPreparationUnit=value=>{const unit=String(value||'');if(unit==='*'||unit==='personalData'||unit==='activeSession')return true;if(/^dailyRecordPack:\d{4}-(?:0[1-9]|1[0-2])$/u.test(unit))return true;if(unit.startsWith('areaNote:')){const key=unit.slice('areaNote:'.length);return !!key&&normalizeAreaName(key)===key;}if(unit.startsWith('attachmentAsset:'))return attachmentId(unit.slice('attachmentAsset:'.length));return false;};
    const areaNote=value=>{const clean=DailyRecordCodec.sanitizeCurrentAreaNote(value,value&&value.key);return !!(clean&&sameDataValue(value,clean));};
    return freeze({
      dailyRecordMigration:value=>!!(exactValue(value,['recordVersion','summaryVersion','complete','recordCount'])&&Number(value.recordVersion)===DATA_CONTRACT.schemas.DailyRecord.version&&Number(value.summaryVersion)===DATA_CONTRACT.schemas.DailySummary.version&&value.complete===true&&Number.isSafeInteger(Number(value.recordCount))&&Number(value.recordCount)>=0),
      planDraft:value=>value===null||(typeof value==='string'&&value.length<=APP_LIMITS.maxScheduleChars),
      planLibrary:value=>{if(!exactValue(value,['savedPlans','defaultId']))return false;try{const clean=PersonalDataCodec.plans({draft:null,savedPlans:value.savedPlans,defaultId:value.defaultId});return sameDataValue(value,{savedPlans:clean.savedPlans,defaultId:clean.defaultId});}catch{return false;}},
      personalPreferences:value=>!!PersonalDataCodec.currentPortablePreferences(value),
      canonicalMutationEpoch:value=>!!(exactValue(value,['format','version','token','committedAt'])&&value.format==='study-director.canonical-mutation-epoch'&&Number(value.version)===1&&/^[a-f0-9]{32}$/u.test(String(value.token||''))&&validIso(value.committedAt)),
      backupPreparationUnitPrefix:(value,context)=>!!(exactValue(value,['format','version','unit','token','updatedAt'])&&value.format==='study-director.backup-preparation-unit'&&Number(value.version)===1&&backupPreparationUnit(value.unit)&&context.suffix===encodeURIComponent(value.unit)&&/^[a-f0-9]{32}$/u.test(String(value.token||''))&&validIso(value.updatedAt)),
      insightsDatasetRevision:value=>!!(exactValue(value,['format','version','counter','updatedAt'])&&value.format==='study-director.insights-dataset-revision'&&Number(value.version)===2&&Number.isSafeInteger(Number(value.counter))&&Number(value.counter)>=1&&validIso(value.updatedAt)),
      dataMaintenance:value=>!!(exactValue(value,['version','status','completedAt'])&&(Number(value.version)===5&&value.status==='completed'&&validIso(value.completedAt)||Number(value.version)===DATA_MAINTENANCE_VERSION&&(value.status==='completed'&&validIso(value.completedAt)||value.status==='pending'&&(value.completedAt===''||validIso(value.completedAt))))),
      areaNoteRecoveryPrefix:(value,context)=>{
        if(!exactValue(value,['format','version','key','entry','updatedAt'])||value.format!=='study-director.area-note-recovery'||Number(value.version)!==1||!validIso(value.updatedAt))return false;
        const key=normalizeAreaName(value.key);if(!key||key!==context.suffix)return false;
        const entry=value.entry;if(entry&&entry.deleted===true)return exactValue(entry,['key','deleted','updatedAt'])&&normalizeAreaName(entry.key)===key&&validIso(entry.updatedAt);
        return areaNote(entry)&&normalizeAreaName(entry.key)===key;
      },
      savedDayDeletionPrefix:(value,context)=>!!(exactValue(value,['format','version','date','deletedAt'])&&value.format==='study-director.saved-day-deletion'&&Number(value.version)===1&&isValidIsoDate(String(value.date||''))&&String(value.date)===context.suffix&&!!normalizeTimestamp(value.deletedAt,null)),
      areaNoteDeletionPrefix:(value,context)=>!!(exactValue(value,['format','version','key','deletedAt'])&&value.format==='study-director.area-note-deletion'&&Number(value.version)===1&&normalizeAreaName(value.key)===context.suffix&&!!context.suffix&&!!normalizeTimestamp(value.deletedAt,null)),
      attachmentDeletionPrefix:(value,context)=>!!(exactValue(value,['format','version','assetId','deletedAt'])&&value.format==='study-director.attachment-deletion'&&Number(value.version)===1&&attachmentId(value.assetId)&&String(value.assetId)===context.suffix&&!!normalizeTimestamp(value.deletedAt,null))
    });
  }
  function createAppData(input){
    exactObject(input,[
      'local','indexedDb','appMeta','compatibilityAppMeta','installationIdentity','dailyRecordCodec','activeSessionCodec','compatibilityCodec','personalDataCodec','keyedRecord','journals',
      'limits','dataContract','stores','legacyStores','keys','legacyKeys','metaKeys','obsoleteMetaKeys','activeSessionId','helpers','hooks','clock','areaNotesRepositoryModule'
    ],'AppData input');
    if(!Object.isFrozen(input.local)||!Object.isFrozen(input.indexedDb)||!Object.isFrozen(input.appMeta)||!Object.isFrozen(input.compatibilityAppMeta)||!Object.isFrozen(input.installationIdentity)||
      !Object.isFrozen(input.dailyRecordCodec)||!Object.isFrozen(input.activeSessionCodec)||!Object.isFrozen(input.compatibilityCodec)||!Object.isFrozen(input.personalDataCodec)||
      !Object.isFrozen(input.keyedRecord)||!Object.isFrozen(input.journals)||!Object.isFrozen(input.limits)||!Object.isFrozen(input.dataContract)||!Object.isFrozen(input.metaKeys)||!Object.isFrozen(input.obsoleteMetaKeys)||!Object.isFrozen(input.clock)){
      throw new TypeError('AppData contracts must be frozen.');
    }
    exactObject(input.stores,[
      'dailyRecords','dailySummaries','areaNotes','activeSessions','appMeta'
    ],'AppData stores');
    exactObject(input.legacyStores,['syncQueue','tombstones'],'AppData legacy stores');
    exactObject(input.keys,['recovery','fallbackDailyRecords','areaNoteRescue','deletionRecovery','legacySyncEmergency'],'AppData storage keys');
    exactObject(input.legacyKeys,['areaNotesPending'],'AppData legacy storage keys');
    exactObject(input.metaKeys,['dailyRecordMigration','planDraft','planLibrary','personalPreferences','canonicalMutationEpoch','insightsDatasetRevision','dataMaintenance','backupPreparationUnitPrefix','areaNoteRecoveryPrefix','savedDayDeletionPrefix','areaNoteDeletionPrefix','attachmentDeletionPrefix'],'AppData metadata keys');
    if(!Array.isArray(input.obsoleteMetaKeys)||input.obsoleteMetaKeys.some(key=>typeof key!=='string'||!key)||new Set(input.obsoleteMetaKeys).size!==input.obsoleteMetaKeys.length)throw new TypeError('AppData obsolete metadata keys are invalid.');
    functions(input.helpers,[
      'boundedInt','boundedNumber','clampText','clampEditorContent','editorContentWithinLimits','wipeObject','isValidIsoDate','isCanonicalScheduleText','sameDataValue',
      'activeSessionScheduleFingerprint','normalizeAreaName','displayAreaName','isoDateDay','normalizeTimestamp','jsonByteLength'
    ],'AppData helpers');
    functions(input.hooks,[
      'canMutate','getOwnershipRevision','issueWriteToken','assertWriteToken','isOwnershipLostError','capture','onStorageOk','onStorageError',
      'onNotesChanged','onNoteSyncState','onNoteConflict','onDailyRecordsChanged',
      'onDatasetRevisionChanged','onCanonicalCommit'
    ],'AppData hooks');

    functions(input.clock,['nowMs'],'AppData clock');
    exactObject(input.journals,['format','contractVersion','restoreJournal','libraryClearJournal','mutationLease'],'AppData journal set');
    if(input.journals.format!=='study-director.repository-journal-set'||input.journals.contractVersion!==1||
      !Object.isFrozen(input.journals.restoreJournal)||!Object.isFrozen(input.journals.libraryClearJournal)||!Object.isFrozen(input.journals.mutationLease)){
      throw new TypeError('AppData journal contracts are invalid.');
    }

    const AreaNotesRepositoryModule=input.areaNotesRepositoryModule;
    if(!AreaNotesRepositoryModule||AreaNotesRepositoryModule.format!=='study-director.area-notes-repository-module'||AreaNotesRepositoryModule.contractVersion!==1||typeof AreaNotesRepositoryModule.create!=='function')throw new TypeError('Area Notes repository module is invalid.');
    const APP_LIMITS=input.limits;
    const DATA_CONTRACT=input.dataContract;
    const STORAGE_KEYS=input.keys;
    const LEGACY_STORAGE_KEYS=input.legacyKeys;
    const META_KEYS=input.metaKeys;
    const OBSOLETE_META_KEYS=input.obsoleteMetaKeys;
    const ACTIVE_SESSION_ID=input.activeSessionId;
    const decisionNowMs=input.clock.nowMs;
    const DB_DAILY_RECORD_STORE=input.stores.dailyRecords;
    const DB_DAILY_SUMMARY_STORE=input.stores.dailySummaries;
    const DB_AREA_NOTES_STORE=input.stores.areaNotes;
    const DB_ACTIVE_SESSION_STORE=input.stores.activeSessions;
    const DB_APP_META_STORE=input.stores.appMeta;
    const DB_LEGACY_SYNC_QUEUE_STORE=input.legacyStores.syncQueue;
    const DB_LEGACY_TOMBSTONE_STORE=input.legacyStores.tombstones;
    const LocalStorageContract=input.local;
    const IndexedDb=input.indexedDb;
    const Meta=input.appMeta;
    const CompatibilityMeta=input.compatibilityAppMeta;
    if(Meta.format!=='study-director.app-meta-owner'||Meta.contractVersion!==1||Meta.owner!=='repositories')throw new TypeError('Repository appMeta capability is invalid.');
    if(CompatibilityMeta.format!=='study-director.app-meta-owner'||CompatibilityMeta.contractVersion!==1||CompatibilityMeta.owner!=='compatibility')throw new TypeError('Compatibility appMeta capability is invalid.');
    const InstallationIdentity=input.installationIdentity;
    if(InstallationIdentity.format!=='study-director.installation-identity'||InstallationIdentity.contractVersion!==3||typeof InstallationIdentity.getId!=='function')throw new TypeError('Installation identity contract is invalid.');
    const DailyRecordCodec=input.dailyRecordCodec;
    const ActiveSessionCodec=input.activeSessionCodec;
    const CompatibilityCodec=input.compatibilityCodec;
    if(CompatibilityCodec.format!=='study-director.compatibility-codecs'||CompatibilityCodec.contractVersion!==1)throw new TypeError('Compatibility codec contract is invalid.');
    const PersonalDataCodec=input.personalDataCodec;
    const KeyedRecord=input.keyedRecord;
    const RepositoryJournals=input.journals;
    const {
      boundedInt,boundedNumber,clampText,clampEditorContent,editorContentWithinLimits,wipeObject,isValidIsoDate,isCanonicalScheduleText,sameDataValue,
      activeSessionScheduleFingerprint,normalizeAreaName,displayAreaName,isoDateDay,normalizeTimestamp,jsonByteLength
    }=input.helpers;
    const {
      canMutate:appCanMutate,
      getOwnershipRevision,
      issueWriteToken,
      assertWriteToken,
      isOwnershipLostError,
      capture,
      onStorageOk,
      onStorageError,
      onNotesChanged:refreshAreaNoteConsumers,
      onNoteSyncState:setNoteSyncStateForKey,
      onNoteConflict:reportAreaNoteConflict,
      onDailyRecordsChanged,
      onDatasetRevisionChanged,
      onCanonicalCommit
    }=input.hooks;
    const AppDiagnostics=freeze({capture});
    function compatibilityWriteToken(reason){
      try{return issueWriteToken(reason,{allowHydrating:true});}
      catch(error){if(isOwnershipLostError(error))return null;throw error;}
    }
    const getInstallationId=InstallationIdentity.getId;
    const {
      buildDailyRecordSummary,sanitizeCurrentDailyRecord,sanitizeCurrentAreaNote,
      materializeDailyRecordView,sanitizeDailyRecordSummary,materializeDailyRecordSummary
    }=DailyRecordCodec;
    const FALLBACK_DAILY_RECORD_LIMIT=14;
    let fallbackDailyRecordsActive=false;
    let fallbackDailyRecordsMessage='';
    let activeSessionWriteChain=Promise.resolve();
    const pendingAuthoritativeWrites=new Set();
    let lastSessionRevision=0;
    let activeSessionMutationEpoch=0;

    function beginAuthoritativeWrite(){
      let finish;
      const pending=new Promise(resolve=>{finish=resolve;});
      pendingAuthoritativeWrites.add(pending);
      return ()=>{pendingAuthoritativeWrites.delete(pending);finish();};
    }
    async function settledAuthoritativeWrites(){
      while(pendingAuthoritativeWrites.size){
        await Promise.allSettled([...pendingAuthoritativeWrites]);
      }
      await activeSessionWriteChain.catch(error=>{capture('active-session.settled',error,'error');return null;});
      return true;
    }

    function markStorageHealthOk(source,key=''){onStorageOk(source,key);}
    function markStorageHealthError(source,reason){onStorageError(source,reason);}
    function canonicalRuntimeError(message){const error=new Error(message);error.code='STUDY_DIRECTOR_NONCANONICAL_RUNTIME';return error;}
    function isCanonicalRuntimeError(error){return error&&error.code==='STUDY_DIRECTOR_NONCANONICAL_RUNTIME';}
    function reportCanonicalCommit(entityType,operation='upsert',value=null,{backupCapture=false}={}){
      try{
        onCanonicalCommit(freeze({
          format:'study-director.canonical-commit',contractVersion:1,
          entityType:String(entityType||''),operation:operation==='delete'?'delete':'upsert',
          committedAt:new Date().toISOString(),value,backupCapture:backupCapture===true
        }));
      }catch(error){capture('repository.canonical-commit-hook',error,'error');}
    }
    function randomCoordinationToken(){
      const bytes=new Uint8Array(16);globalThis.crypto.getRandomValues(bytes);return [...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');
    }
    function newCanonicalMutationEpoch(){
      return freeze({format:'study-director.canonical-mutation-epoch',version:1,token:randomCoordinationToken(),committedAt:new Date().toISOString()});
    }
    function canonicalPreparationUnit(value){
      const unit=String(value||'').trim();if(unit==='*'||unit==='personalData'||unit==='activeSession')return unit;if(/^dailyRecordPack:\d{4}-(?:0[1-9]|1[0-2])$/u.test(unit))return unit;if(unit.startsWith('areaNote:')){const key=unit.slice('areaNote:'.length);if(key&&normalizeAreaName(key)===key)return unit;}if(unit.startsWith('attachmentAsset:')&&/^(?:att|img)-[a-z0-9-]{20,80}$/u.test(unit.slice('attachmentAsset:'.length)))return unit;throw new TypeError('Backup preparation unit identity is invalid.');
    }
    function dailyPreparationUnit(date){const value=String(date||'');if(!isValidIsoDate(value))throw new TypeError('Backup preparation Saved-Day date is invalid.');return `dailyRecordPack:${value.slice(0,7)}`;}
    function areaNotePreparationUnit(key){const value=normalizeAreaName(key);if(!value)throw new TypeError('Backup preparation Ongoing Note key is invalid.');return `areaNote:${value}`;}
    function stageBackupPreparationUnits(tx,units){
      if(!Array.isArray(units)||!units.length)return freeze([]);
      const meta=Meta.view(tx),updatedAt=new Date().toISOString(),seen=new Set(),out=[];
      for(const raw of units){const unit=canonicalPreparationUnit(raw);if(seen.has(unit))continue;seen.add(unit);const value=freeze({format:'study-director.backup-preparation-unit',version:1,unit,token:randomCoordinationToken(),updatedAt});meta.put('backupPreparationUnitPrefix',value,{suffix:encodeURIComponent(unit),updatedAt});out.push(value);}
      return freeze(out);
    }
    function stageCanonicalMutationEpoch(tx,preparationUnits=null){
      const value=newCanonicalMutationEpoch(),request=Meta.view(tx).put('canonicalMutationEpoch',value,{updatedAt:value.committedAt});
      const units=preparationUnits===null?['*']:preparationUnits;stageBackupPreparationUnits(tx,units);
      return freeze({value,request});
    }
    async function reseedCanonicalMutationEpoch(){
      const value=newCanonicalMutationEpoch();
      await Meta.write('canonicalMutationEpoch',value,{updatedAt:value.committedAt,strict:true,abortMessage:'canonical mutation epoch reseed aborted'});
      return value;
    }
    async function readCanonicalMutationEpoch(){return Meta.read('canonicalMutationEpoch');}
    async function listBackupPreparationUnits(){return freeze((await Meta.list('backupPreparationUnitPrefix')).map(entry=>entry.value));}
    async function replaceBackupPreparationUnits(units){
      const targets=[...new Set((units||[]).map(canonicalPreparationUnit))];
      return Meta.transaction('readwrite',(view,tx,finish)=>{
        const handle=view.getAll('backupPreparationUnitPrefix');
        handle.request.onerror=()=>finish(false,handle.request.error||new Error('Backup preparation index metadata read failed.'));
        handle.request.onsuccess=()=>{
          const existing=handle.entries(),updatedAt=new Date().toISOString(),values=[];
          for(const entry of existing)view.remove('backupPreparationUnitPrefix',entry.suffix);
          for(const unit of targets){const value=freeze({format:'study-director.backup-preparation-unit',version:1,unit,token:randomCoordinationToken(),updatedAt});view.put('backupPreparationUnitPrefix',value,{suffix:encodeURIComponent(unit),updatedAt});values.push(value);}
          tx.oncomplete=()=>finish(true,freeze(values));
        };
      },{strict:true,abortMessage:'Backup preparation index metadata replacement aborted'});
    }
    async function rebaseBackupPreparationState(){
      return Meta.transaction('readwrite',(view,tx,finish)=>{
        const handle=view.getAll('backupPreparationUnitPrefix');
        handle.request.onerror=()=>finish(false,handle.request.error||new Error('Backup preparation rebase metadata read failed.'));
        handle.request.onsuccess=()=>{
          const existing=handle.entries(),epoch=newCanonicalMutationEpoch(),updatedAt=epoch.committedAt,unit='*';
          for(const entry of existing)view.remove('backupPreparationUnitPrefix',entry.suffix);
          view.put('canonicalMutationEpoch',epoch,{updatedAt:epoch.committedAt});
          const stamp=freeze({format:'study-director.backup-preparation-unit',version:1,unit,token:randomCoordinationToken(),updatedAt});
          view.put('backupPreparationUnitPrefix',stamp,{suffix:encodeURIComponent(unit),updatedAt});
          tx.oncomplete=()=>finish(true,freeze({epoch,stamps:freeze([stamp])}));
        };
      },{strict:true,abortMessage:'Backup preparation acceleration rebase aborted'});
    }
    function showStorageFallbackWarning(reason){
      fallbackDailyRecordsActive=true;
      fallbackDailyRecordsMessage=`Library is using limited fallback storage because IndexedDB is unavailable${reason?`: ${reason}`:''}. Emergency capacity is ${FALLBACK_DAILY_RECORD_LIMIT} records / ${Math.round(APP_LIMITS.fallbackDailyRecordsBytes/(1024*1024))} MB; once full, further saves fail rather than evict unresolved fallback data. Export a backup if this warning persists.`;
      markStorageHealthError('dailyRecords',fallbackDailyRecordsMessage);
    }
    function confirmDailyRecordStorage(){
      if(fallbackDailyRecordsGet().length)return false;
      fallbackDailyRecordsActive=false;
      fallbackDailyRecordsMessage='';
      markStorageHealthOk('dailyRecords');
      return true;
    }
    function showSubjectNoteSaveWarning(reason){
      markStorageHealthError('areaNotes',`Ongoing subject notes could not be saved in this browser session${reason?`: ${reason}`:''}. Export a backup before closing this tab.`);
    }
    function notifyDailyRecordsChanged(date='',type='change'){
      onDailyRecordsChanged(freeze({date:isValidIsoDate(date)?date:'',type:String(type||'change')}));
    }
    function nextSessionRevision(seed=0){
      const base=Math.max(0,Math.floor(Number(seed)||0),lastSessionRevision,decisionNowMs());
      lastSessionRevision=base+1;
      return lastSessionRevision;
    }
    function observeSessionRevision(value){
      const revision=boundedNumber(value,{min:0,max:Number.MAX_SAFE_INTEGER,fallback:0});
      lastSessionRevision=Math.max(lastSessionRevision,revision);
      return lastSessionRevision;
    }

    function deletionRecoveryKey(kind,id){return `${String(kind||'').trim()}:${String(id||'').trim()}`;}
    function entityTimestamp(value,kind=''){
      if(!value||typeof value!=='object')return 0;
      const raw=value.updatedAt||(kind==='dailyRecord'?value.savedAt:null)||value.deletedAt;
      const parsed=Date.parse(String(raw||''));return Number.isFinite(parsed)?parsed:0;
    }
    function sanitizeDeletionRecoveryEntries(values){
      const byKey=new Map();
      for(const raw of Array.isArray(values)?values:[]){
        if(!raw||typeof raw!=='object')continue;
        const kind=raw.kind==='dailyRecord'?'dailyRecord':raw.kind==='activeSession'?'activeSession':'';
        const id=String(raw.id||'').trim(),deletedAt=normalizeTimestamp(raw.deletedAt,null);
        if(!kind||!id||!deletedAt)continue;
        if(kind==='dailyRecord'&&!isValidIsoDate(id))continue;
        if(kind==='activeSession'&&id!==ACTIVE_SESSION_ID)continue;
        const entry=freeze({key:deletionRecoveryKey(kind,id),kind,id,deletedAt});
        const previous=byKey.get(entry.key);
        if(!previous||Date.parse(entry.deletedAt)>=Date.parse(previous.deletedAt))byKey.set(entry.key,entry);
      }
      return [...byKey.values()].sort((a,b)=>a.deletedAt.localeCompare(b.deletedAt));
    }
    function legacySyncDeleteEntries(){
      const raw=LocalStorageContract.getJson(STORAGE_KEYS.legacySyncEmergency,null),entries=Array.isArray(raw&&raw.entries)?raw.entries:[];
      return sanitizeDeletionRecoveryEntries(entries.filter(entry=>entry&&entry.op==='delete').map(entry=>({
        kind:entry.entityType,id:entry.entityId,deletedAt:entry.updatedAt||entry.deletedAt
      })));
    }
    function currentDeletionRecoveryEntries(){
      const raw=LocalStorageContract.getJson(STORAGE_KEYS.deletionRecovery,null);
      return sanitizeDeletionRecoveryEntries(raw&&raw.entries);
    }
    function pendingDeletionEntries(){return sanitizeDeletionRecoveryEntries(currentDeletionRecoveryEntries());}
    function pendingDeletionEntryMap(){return new Map(pendingDeletionEntries().map(entry=>[entry.key,entry]));}
    function writeDeletionRecoveryEntries(values){
      const ordered=sanitizeDeletionRecoveryEntries(values),kept=[];
      for(let i=ordered.length-1;i>=0;i--){
        const candidate=[ordered[i],...kept],payload={format:'study-director.deletion-recovery',version:1,updatedAt:new Date().toISOString(),entries:candidate};
        if(jsonByteLength(payload)>APP_LIMITS.deletionRecoveryBytes)break;
        kept.unshift(ordered[i]);
      }
      if(kept.length!==ordered.length)return false;
      if(!kept.length)return LocalStorageContract.remove(STORAGE_KEYS.deletionRecovery);
      return LocalStorageContract.setJson(STORAGE_KEYS.deletionRecovery,{format:'study-director.deletion-recovery',version:1,updatedAt:new Date().toISOString(),entries:kept});
    }
    function stageDeletionRecovery(kind,id,deletedAt=new Date().toISOString()){
      const entries=currentDeletionRecoveryEntries(),next=sanitizeDeletionRecoveryEntries([...entries,{kind,id,deletedAt}]);
      return writeDeletionRecoveryEntries(next);
    }
    function clearDeletionRecoveryKeys(keys){
      const remove=new Set((keys||[]).map(String));if(!remove.size)return true;
      const current=currentDeletionRecoveryEntries();if(LocalStorageContract.lastError)return false;
      return writeDeletionRecoveryEntries(current.filter(entry=>!remove.has(entry.key)));
    }
    function pendingDeletionShadowsEntity(kind,id,value,entryMap=null){
      const entry=(entryMap||pendingDeletionEntryMap()).get(deletionRecoveryKey(kind,id));
      return !!(entry&&Date.parse(entry.deletedAt)>=entityTimestamp(value,kind));
    }
    function filterPendingDeletedEntities(values,kind,idKey){
      const entries=pendingDeletionEntryMap();
      return (values||[]).filter(value=>{const id=typeof idKey==='function'?idKey(value):value&&value[idKey];return id&&!pendingDeletionShadowsEntity(kind,id,value,entries);});
    }
    function savedDayDeletionValue(date,deletedAt=new Date().toISOString()){
      const when=normalizeTimestamp(deletedAt,new Date().toISOString());return {format:'study-director.saved-day-deletion',version:1,date:String(date||''),deletedAt:when};
    }
    function areaNoteDeletionValue(key,deletedAt=new Date().toISOString()){
      const clean=normalizeAreaName(key),when=normalizeTimestamp(deletedAt,new Date().toISOString());if(!clean)return null;return {format:'study-director.area-note-deletion',version:1,key:clean,deletedAt:when};
    }
    function normalizeAttachmentDeletionId(value){const id=String(value||'');return /^(?:att|img)-[a-z0-9-]{20,80}$/u.test(id)?id:'';}
    function attachmentDeletionValue(assetId,deletedAt=new Date().toISOString()){
      const id=normalizeAttachmentDeletionId(assetId),when=normalizeTimestamp(deletedAt,new Date().toISOString());if(!id)throw new TypeError('Attachment deletion identity is invalid.');return {format:'study-director.attachment-deletion',version:1,assetId:id,deletedAt:when};
    }

function capFallbackDailyRecords(records){
  const byDate=new Map();
  (records||[]).forEach(record=>{
    const clean=sanitizeCurrentDailyRecord(record);
    if(clean)byDate.set(clean.date,clean);
  });
  const ordered=[...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-FALLBACK_DAILY_RECORD_LIMIT);
  while(ordered.length&&jsonByteLength(ordered)>APP_LIMITS.fallbackDailyRecordsBytes)ordered.shift();
  return ordered;
}
function activeSessionRecoveryEnvelope(session){
  if(!session||!session.snapshot)return null;
  const revision=boundedNumber(session.revision,{min:1,max:Number.MAX_SAFE_INTEGER,fallback:1});
  return {
    version:DATA_CONTRACT.schemas.LocalRecoveryEnvelope.version,revision,
    shell:{id:ACTIVE_SESSION_ID,type:'activeSession',version:DATA_CONTRACT.schemas.ActiveSession.version,revision,date:session.date,status:session.status==='suspended'?'suspended':'active',scheduleText:session.scheduleText,suspendedAt:session.suspendedAt||null,updatedAt:session.updatedAt||new Date().toISOString()},
    snapshot:session.snapshot,updatedAt:session.updatedAt||new Date().toISOString()
  };
}
function sanitizeCurrentLocalRecoveryEnvelope(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.version!==DATA_CONTRACT.schemas.LocalRecoveryEnvelope.version)return null;
  const expected=['version','revision','shell','snapshot','updatedAt'];
  if(Object.keys(raw).sort().join('|')!==expected.sort().join('|'))return null;
  const shell=raw.shell&&typeof raw.shell==='object'&&!Array.isArray(raw.shell)?raw.shell:null;
  const shellExpected=['id','type','version','revision','date','status','scheduleText','suspendedAt','updatedAt'];
  if(!shell||Object.keys(shell).sort().join('|')!==shellExpected.sort().join('|')||shell.id!==ACTIVE_SESSION_ID||shell.type!=='activeSession'||Number(shell.version)!==DATA_CONTRACT.schemas.ActiveSession.version||!isValidIsoDate(shell.date)||!isCanonicalScheduleText(shell.scheduleText)||!['active','suspended'].includes(shell.status))return null;
  const revision=boundedNumber(raw.revision,{min:1,max:Number.MAX_SAFE_INTEGER,fallback:0});
  if(!revision||Number(shell.revision)!==revision)return null;
  const snapshot=ActiveSessionCodec.sanitizeSessionSnapshot(raw.snapshot,shell.date,activeSessionScheduleFingerprint(shell),revision);if(!snapshot)return null;
  const updatedAt=normalizeTimestamp(raw.updatedAt,null);if(!updatedAt||String(shell.updatedAt)!==updatedAt)return null;
  const cleanShell={id:ACTIVE_SESSION_ID,type:'activeSession',version:DATA_CONTRACT.schemas.ActiveSession.version,revision,date:shell.date,status:shell.status,scheduleText:shell.scheduleText,suspendedAt:shell.suspendedAt||null,updatedAt};
  const clean={version:DATA_CONTRACT.schemas.LocalRecoveryEnvelope.version,revision,shell:cleanShell,snapshot,updatedAt};
  return sameDataValue(raw,clean)?clean:null;
}
function sessionFromRecoveryEnvelope(raw){
  const envelope=sanitizeCurrentLocalRecoveryEnvelope(raw);if(!envelope)return null;
  lastSessionRevision=Math.max(lastSessionRevision,envelope.revision);
  return ActiveSessionCodec.sanitizeCurrent({...envelope.shell,snapshot:envelope.snapshot,revision:envelope.revision,updatedAt:envelope.updatedAt});
}
function readLocalRecoverySession(options={}){
  const raw=LocalStorageContract.getJson(STORAGE_KEYS.recovery,null);
  if(options.strict&&LocalStorageContract.lastError)throw LocalStorageContract.lastError;
  if(raw===null)return null;
  // A durable logical deletion is authoritative over the stale recovery copy it
  // protects. Do not interpret a payload that is already shadowed for cleanup.
  const shadowed=pendingDeletionShadowsEntity('activeSession',ACTIVE_SESSION_ID,raw);
  if(options.strict&&LocalStorageContract.lastError)throw LocalStorageContract.lastError;
  if(shadowed)return null;
  const session=sessionFromRecoveryEnvelope(raw);if(!session)throw canonicalRuntimeError('Active Session recovery is not in the current canonical schema.');return session;
}
const idbTransaction=IndexedDb.transaction;
const idbStrictTransaction=IndexedDb.strictTransaction;
const idbStoreTransaction=IndexedDb.storeTransaction;
const idbStrictStoreTransaction=IndexedDb.strictStoreTransaction;
const idbGet=IndexedDb.get;
const idbGetAll=IndexedDb.getAll;
const idbGetAllIfPresent=IndexedDb.getAllIfPresent;
const idbHasStore=IndexedDb.hasStore;
function storageMigrationMetaValue(complete=false,count=0){
  return {
    recordVersion:DATA_CONTRACT.schemas.DailyRecord.version,
    summaryVersion:DATA_CONTRACT.schemas.DailySummary.version,
    complete:!!complete,
    recordCount:boundedInt(count,{min:0,max:APP_LIMITS.maxImportRecords*10,fallback:0})
  };
}
// Historical appMeta residue is intentionally raw only inside this compatibility cleanup path.
function rawLegacyMetaGet(key){return idbGet(DB_APP_META_STORE,String(key),'legacy metadata read aborted');}
function rawLegacyMetaList(){return idbGetAll(DB_APP_META_STORE,'legacy metadata list aborted');}
function rawLegacyMetaDelete(key,{ownershipToken=null,reason='legacy metadata delete'}={}){
  return idbStoreTransaction(DB_APP_META_STORE,'readwrite',(store,tx,finish)=>{
    if(ownershipToken)assertWriteToken(ownershipToken,reason);
    const req=store.delete(String(key));req.onerror=()=>finish(false,req.error||new Error('legacy metadata delete failed'));
    req.onsuccess=()=>{if(!ownershipToken)return;try{assertWriteToken(ownershipToken,reason);}catch(error){try{tx.abort();}catch{}finish(false,error);}};
    tx.oncomplete=()=>finish(true,true);
  },'legacy metadata delete aborted');
}
async function removeObsoleteMetadata(){
  const token=compatibilityWriteToken('clean obsolete metadata');
  if(!token)return Object.freeze({status:'skipped',reason:'not-primary',removed:0});
  let removed=0;
  const rows=await rawLegacyMetaList();
  for(const identity of OBSOLETE_META_KEYS){
    const keys=String(identity).endsWith(':')?(rows||[]).map(row=>String(row&&row.key||'')).filter(key=>key.startsWith(identity)):[String(identity)];
    for(const key of keys){assertWriteToken(token,'clean obsolete metadata');const row=await rawLegacyMetaGet(key);if(!row)continue;assertWriteToken(token,'clean obsolete metadata');await rawLegacyMetaDelete(key,{ownershipToken:token,reason:'clean obsolete metadata'});removed++;}
  }
  return removed;
}
function writePlanMeta(family,value,{strictDurability=false,ownershipToken=null,allowHydrating=false,backupCapture=false}={}){
  const token=ownershipToken||issueWriteToken('save plan documents',{allowHydrating});
  if(new TextEncoder().encode(JSON.stringify(value)).length>1024*1024)throw new RangeError('Plan data exceeds its storage allowance.');
  return Meta.transaction('readwrite',(meta,tx,finish)=>{
    assertWriteToken(token,'save plan documents');stageCanonicalMutationEpoch(tx,['personalData']);const request=meta.put(family,value);request.onerror=()=>finish(false,request.error||new Error('plan document write failed'));
    request.onsuccess=()=>{try{assertWriteToken(token,'save plan documents');}catch(error){try{tx.abort();}catch{}finish(false,error);}};
    tx.oncomplete=()=>{onCanonicalCommit({entityType:'planData',operation:'upsert',backupCapture:backupCapture===true});finish(true);};
  },{strict:strictDurability,abortMessage:'plan document write aborted'});
}
const planData=freeze({
  replace:value=>{
    const token=issueWriteToken('restore Plan documents');if(new TextEncoder().encode(JSON.stringify(value)).length>1024*1024)throw new RangeError('Plan data exceeds its storage allowance.');
    return Meta.transaction('readwrite',(meta,tx,finish)=>{assertWriteToken(token,'restore Plan documents');stageCanonicalMutationEpoch(tx,['personalData']);const updatedAt=new Date().toISOString();meta.put('planDraft',value.draft,{updatedAt});meta.put('planLibrary',{savedPlans:value.savedPlans,defaultId:value.defaultId},{updatedAt});tx.oncomplete=()=>{onCanonicalCommit({entityType:'planData',operation:'restore'});finish(true);};},{strict:true,abortMessage:'Plan document restore aborted'});
  },
  read:async()=>{const [draft,library]=await Promise.all([Meta.read('planDraft'),Meta.read('planLibrary')]);return {draft:draft??null,savedPlans:library?.savedPlans||[],defaultId:library?.defaultId||null};},
  writeDraft:(value,options={})=>{if(value!==null&&(typeof value!=='string'||value.length>APP_LIMITS.maxScheduleChars))throw new RangeError('Plan draft exceeds its text limit.');return writePlanMeta('planDraft',value,options);},
  writeLibrary:(value,options={})=>writePlanMeta('planLibrary',value,{...options,strictDurability:true})
});
const personalPreferences=freeze({
  read:()=>Meta.read('personalPreferences'),
  write:(value,options={})=>{const clean=PersonalDataCodec.portablePreferences({...value,version:2,updatedAt:new Date().toISOString()});return writePlanMeta('personalPreferences',clean,{...options,strictDurability:true}).then(()=>clean);},
  replace:value=>{const clean=PersonalDataCodec.currentPortablePreferences(value);if(!clean)throw new Error('Portable preferences are invalid.');return writePlanMeta('personalPreferences',clean,{strictDurability:true}).then(()=>clean);}
});
const InsightsDatasetRevision=(()=>{
  const KEY=META_KEYS.insightsDatasetRevision,FORMAT='study-director.insights-dataset-revision',VALUE_VERSION=2;
  let current=null,readPromise=null,lastError='',lastReason='',volatileRevision=0,refreshQueued=false;
  function exactKeys(value,keys){return !!(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|'));}
  function normalize(value){if(!exactKeys(value,['format','version','counter','updatedAt'])||value.format!==FORMAT||Number(value.version)!==VALUE_VERSION)return null;const counter=Number(value.counter),updatedAt=String(value.updatedAt||'');if(!Number.isSafeInteger(counter)||counter<1||!Number.isFinite(Date.parse(updatedAt)))return null;return Object.freeze({format:FORMAT,version:VALUE_VERSION,counter,updatedAt});}
  function normalizeLegacyRow(row){if(!exactKeys(row,['key','format','version','counter','updatedAt'])||row.key!==KEY||row.format!==FORMAT||Number(row.version)!==1)return null;const counter=Number(row.counter),updatedAt=String(row.updatedAt||'');if(!Number.isSafeInteger(counter)||counter<1||!Number.isFinite(Date.parse(updatedAt)))return null;return Object.freeze({format:FORMAT,version:VALUE_VERSION,counter,updatedAt});}
  function currentFromRawRow(saved){if(!saved)return null;if(!exactKeys(saved,['key','version','value','updatedAt'])||saved.key!==KEY||Number(saved.version)!==1)return null;const clean=normalize(saved.value);return clean&&saved.updatedAt===clean.updatedAt?clean:null;}
  function record(counter,updatedAt=new Date().toISOString()){return {format:FORMAT,version:VALUE_VERSION,counter:Math.min(Number.MAX_SAFE_INTEGER,Math.max(1,Math.floor(Number(counter)||1))),updatedAt};}
  function revisionKey(value){return value?`${value.version}:${value.counter}:${value.updatedAt}:v${volatileRevision}`:null;}
  function refreshActive(){if(refreshQueued)return;refreshQueued=true;queueMicrotask(()=>{refreshQueued=false;onDatasetRevisionChanged(snapshot());});}
  function accept(value,reason=''){const clean=normalize(value);if(!clean)return null;current=clean;lastError='';lastReason=clampText(reason||'',80);return revisionKey(clean);}
  function capture(scope,error){lastError=clampText(error&&error.message?error.message:String(error||'revision failure'),160);AppDiagnostics.capture(scope,error);}
  function readOrCreate(){return Meta.transaction('readwrite',(meta,tx,finish)=>{let resolved=null;const handle=meta.get('insightsDatasetRevision'),req=handle.request;req.onsuccess=()=>{try{resolved=handle.value();}catch(error){try{tx.abort();}catch{}finish(false,error);return;}if(!resolved){resolved=record(1);meta.put('insightsDatasetRevision',resolved,{updatedAt:resolved.updatedAt});}};req.onerror=()=>finish(false,req.error||new Error('insights revision read failed'));tx.oncomplete=()=>finish(true,resolved);},{abortMessage:'insights revision read aborted'});}
  async function get(){if(readPromise)return readPromise;readPromise=(async()=>accept((await Meta.read('insightsDatasetRevision'))||await readOrCreate(),'read'))().catch(error=>{capture('insights.revision-read',error);return null;}).finally(()=>{readPromise=null;});return readPromise;}
  function stage(tx,reason='daily-record-change'){
    const state={value:null,reason},meta=Meta.view(tx),handle=meta.get('insightsDatasetRevision'),req=handle.request;
    req.onsuccess=()=>{let previous;try{previous=handle.value();}catch{try{tx.abort();}catch{}return;}state.value=record((previous&&previous.counter||0)+1);meta.put('insightsDatasetRevision',state.value,{updatedAt:state.value.updatedAt});};
    return state;
  }
  function committed(state){if(state&&state.value){accept(state.value,state.reason);refreshActive();}}
  function invalidateVolatile(reason='fallback-record-change'){volatileRevision+=1;lastReason=clampText(reason||'',80);refreshActive();return snapshot();}
  async function bump(reason='daily-record-change'){let state=null;try{await Meta.transaction('readwrite',(meta,tx,finish)=>{state=stage(tx,reason);tx.oncomplete=()=>finish(true);tx.onabort=()=>finish(false,tx.error||new Error('Insights dataset revision is not canonical. Compatibility migration must complete first.'));},{abortMessage:'insights revision update aborted'});committed(state);}catch(error){capture('insights.revision-bump',error);invalidateVolatile(reason);}return snapshot();}
  async function migrateLegacyEnvelope(){
    const token=compatibilityWriteToken('migrate Insights revision metadata');if(!token)return Object.freeze({status:'skipped',reason:'not-primary'});
    return idbStrictStoreTransaction(DB_APP_META_STORE,'readwrite',(store,tx,finish)=>{
      const guard=()=>{try{assertWriteToken(token,'migrate Insights revision metadata');return true;}catch(error){try{tx.abort();}catch{}finish(false,error);return false;}};if(!guard())return;
      const req=store.get(KEY);req.onerror=()=>finish(false,req.error||new Error('insights revision migration read failed'));req.onsuccess=()=>{if(!guard())return;const saved=req.result;if(!saved){tx.oncomplete=()=>finish(true,Object.freeze({status:'not-needed'}));return;}if(currentFromRawRow(saved)){tx.oncomplete=()=>finish(true,Object.freeze({status:'current'}));return;}const migrated=normalizeLegacyRow(saved);if(!migrated){try{tx.abort();}catch{}finish(false,new Error('Legacy Insights dataset revision could not be converted safely.'));return;}const put=Meta.view(tx).put('insightsDatasetRevision',migrated,{updatedAt:migrated.updatedAt});put.onerror=()=>finish(false,put.error||new Error('insights revision migration write failed'));put.onsuccess=()=>{guard();};tx.oncomplete=()=>finish(true,Object.freeze({status:'migrated'}));};
    },'insights revision migration aborted');
  }
  async function verifyCanonicalEnvelope(){const saved=await rawLegacyMetaGet(KEY);return Object.freeze({ok:!saved||!!currentFromRawRow(saved),present:!!saved,legacy:!!saved&&!currentFromRawRow(saved)&&!!normalizeLegacyRow(saved)});}
  function snapshot(){return Object.freeze({format:FORMAT,version:VALUE_VERSION,counter:current&&current.counter||null,updatedAt:current&&current.updatedAt||null,revision:revisionKey(current),volatileRevision,lastReason,lastError});}
  return Object.freeze({get,bump,stage,committed,invalidateVolatile,snapshot,migrateLegacyEnvelope,verifyCanonicalEnvelope});
})();
async function applyDeletionRecoveryEntry(entry){
  if(!entry)return true;
  const cutoff=Date.parse(entry.deletedAt||'')||0;
  if(entry.kind==='dailyRecord'){
    const rawFallback=fallbackDailyRecordsRawGet(),fallback=rawFallback.find(record=>record.date===entry.id)||null;
    if(fallback&&dailyRecordTimestamp(fallback)>cutoff){
      await idbPut(fallback);
      if(!fallbackDailyRecordsSet(rawFallback.filter(record=>record.date!==entry.id)))throw LocalStorageContract.lastError||new Error('DailyRecord fallback could not be reconciled after a newer save superseded a pending deletion.');
      return true;
    }
    if(fallback&&!fallbackDailyRecordsSet(rawFallback.filter(record=>record.date!==entry.id)))throw LocalStorageContract.lastError||new Error('DailyRecord fallback could not be cleared during deletion recovery.');
    return idbStrictTransaction([DB_DAILY_RECORD_STORE,DB_DAILY_SUMMARY_STORE,DB_APP_META_STORE],'readwrite',(tx,finish)=>{
      const records=tx.objectStore(DB_DAILY_RECORD_STORE),summaries=tx.objectStore(DB_DAILY_SUMMARY_STORE),meta=Meta.view(tx);
      let revisionState=null;
      const request=records.get(entry.id);
      request.onerror=()=>finish(false,request.error||new Error('DailyRecord deletion recovery read failed'));
      request.onsuccess=()=>{
        stageCanonicalMutationEpoch(tx,[dailyPreparationUnit(entry.id)]);
        const current=request.result||null;
        if(current&&entityTimestamp(current,'dailyRecord')>cutoff){meta.remove('savedDayDeletionPrefix',entry.id);return;}
        records.delete(entry.id);summaries.delete(entry.id);const deletion=savedDayDeletionValue(entry.id,entry.deletedAt);meta.put('savedDayDeletionPrefix',deletion,{suffix:entry.id,updatedAt:deletion.deletedAt});
        if(current)revisionState=InsightsDatasetRevision.stage(tx,'daily-record-delete-recovery');
      };
      tx.oncomplete=()=>{InsightsDatasetRevision.committed(revisionState);finish(true,true);};
    },'DailyRecord deletion recovery aborted');
  }
  if(entry.kind==='activeSession'){
    const rawRecoveryPresent=LocalStorageContract.getText(STORAGE_KEYS.recovery,null)!==null;
    const local=readLocalRecoverySession();
    if(local&&entityTimestamp(local,'activeSession')>cutoff)return true;
    if(rawRecoveryPresent&&!LocalStorageContract.remove(STORAGE_KEYS.recovery))throw LocalStorageContract.lastError||new Error('ActiveSession recovery envelope could not be cleared.');
    return idbStrictTransaction([DB_ACTIVE_SESSION_STORE,DB_APP_META_STORE],'readwrite',(tx,finish)=>{
      const store=tx.objectStore(DB_ACTIVE_SESSION_STORE);
      const request=store.get(ACTIVE_SESSION_ID);
      request.onerror=()=>finish(false,request.error||new Error('ActiveSession deletion recovery read failed'));
      request.onsuccess=()=>{const current=request.result||null;if(!current||entityTimestamp(current,'activeSession')<=cutoff){stageCanonicalMutationEpoch(tx,['activeSession']);store.delete(ACTIVE_SESSION_ID);}};
      tx.oncomplete=()=>finish(true,true);
    },'ActiveSession deletion recovery aborted');
  }
  return true;
}
async function flushDeletionRecovery(){
  const entries=pendingDeletionEntries();
  if(LocalStorageContract.lastError){markStorageHealthError('deletionRecovery','Pending deletion recovery could not be read safely.');return false;}
  if(!entries.length){markStorageHealthOk('deletionRecovery');return true;}
  const cleared=[];
  try{
    for(const entry of entries){await applyDeletionRecoveryEntry(entry);cleared.push(entry.key);}
    if(!clearDeletionRecoveryKeys(cleared))throw LocalStorageContract.lastError||new Error('Pending deletion recovery markers could not be retired.');
    markStorageHealthOk('deletionRecovery');
    return true;
  }catch(error){markStorageHealthError('deletionRecovery',`Pending deletion recovery could not be reconciled: ${error&&error.message||error}`);return false;}
}
function legacyDeleteTimestamp(entry){return normalizeTimestamp(entry&&entry.deletedAt||entry&&entry.updatedAt,null);}
async function migrateLegacyDeletionState(){
  const token=compatibilityWriteToken('migrate legacy deletion state');
  if(!token)return freeze({status:'skipped',reason:'not-primary',savedDayDeletions:0,recoveryEntries:0});
  const [queueRows,tombstoneRows,records,active]=await Promise.all([
    idbGetAllIfPresent(DB_LEGACY_SYNC_QUEUE_STORE,'legacy sync queue read aborted'),idbGetAllIfPresent(DB_LEGACY_TOMBSTONE_STORE,'legacy tombstone read aborted'),idbAllRecords(),idbGetActiveSession()
  ]);
  const recordMap=new Map((records||[]).map(record=>[String(record&&record.date||''),record]));
  const dailyDeletes=new Map(),recovery=[];
  const consider=(type,id,deletedAt)=>{
    const when=normalizeTimestamp(deletedAt,null);if(!when)return;
    if(type==='dailyRecord'&&isValidIsoDate(id)){
      const current=recordMap.get(id);if(current&&entityTimestamp(current,'dailyRecord')>Date.parse(when))return;
      const previous=dailyDeletes.get(id);if(!previous||Date.parse(when)>Date.parse(previous))dailyDeletes.set(id,when);
      recovery.push({kind:'dailyRecord',id,deletedAt:when});
    }else if(type==='activeSession'&&String(id)===ACTIVE_SESSION_ID){
      if(active&&entityTimestamp(active,'activeSession')>Date.parse(when))return;
      recovery.push({kind:'activeSession',id:ACTIVE_SESSION_ID,deletedAt:when});
    }
  };
  for(const row of tombstoneRows||[])consider(String(row&&row.entityType||''),String(row&&row.entityId||''),legacyDeleteTimestamp(row));
  for(const row of queueRows||[])if(row&&row.op==='delete')consider(String(row.entityType||''),String(row.entityId||''),legacyDeleteTimestamp(row));
  for(const entry of legacySyncDeleteEntries())consider(entry.kind,entry.id,entry.deletedAt);
  const currentRecovery=currentDeletionRecoveryEntries(),nextRecovery=sanitizeDeletionRecoveryEntries([...currentRecovery,...recovery]);
  if(!writeDeletionRecoveryEntries(nextRecovery))throw new Error('Legacy deletion recovery could not be persisted safely.');
  assertWriteToken(token,'migrate legacy deletion state');
  const legacyStores=[];
  if(await idbHasStore(DB_LEGACY_SYNC_QUEUE_STORE))legacyStores.push(DB_LEGACY_SYNC_QUEUE_STORE);
  if(await idbHasStore(DB_LEGACY_TOMBSTONE_STORE))legacyStores.push(DB_LEGACY_TOMBSTONE_STORE);
  await idbStrictTransaction([DB_APP_META_STORE,...legacyStores],'readwrite',(tx,finish)=>{
    assertWriteToken(token,'migrate legacy deletion state');
    const meta=Meta.view(tx);
    for(const [date,deletedAt] of dailyDeletes){const deletion=savedDayDeletionValue(date,deletedAt);meta.put('savedDayDeletionPrefix',deletion,{suffix:date,updatedAt:deletion.deletedAt});}
    for(const storeName of legacyStores)tx.objectStore(storeName).clear();
    tx.oncomplete=()=>finish(true,true);
  },'legacy deletion-state migration aborted');
  if(!LocalStorageContract.remove(STORAGE_KEYS.legacySyncEmergency))throw new Error('Legacy sync emergency state could not be retired after verified conversion.');
  await flushDeletionRecovery();
  return freeze({status:(queueRows.length||tombstoneRows.length||recovery.length)?'migrated':'not-needed',savedDayDeletions:dailyDeletes.size,recoveryEntries:nextRecovery.length});
}
function normalizeSavedDayDeletions(values){
  if(!Array.isArray(values))throw new TypeError('Saved-Day deletion ledger must be an array.');
  const byDate=new Map();
  for(const value of values){
    const date=String(value&&value.date||''),deletedAt=normalizeTimestamp(value&&value.deletedAt,'');
    if(!isValidIsoDate(date)||!deletedAt)throw new Error('Saved-Day deletion ledger contains an invalid entry.');
    const previous=byDate.get(date);if(!previous||Date.parse(deletedAt)>Date.parse(previous.deletedAt))byDate.set(date,{date,deletedAt});
  }
  if(byDate.size>APP_LIMITS.maxImportRecords)throw new RangeError('Saved-Day deletion ledger exceeds the supported record limit.');
  return [...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
async function listSavedDayDeletions(){
  return normalizeSavedDayDeletions((await Meta.list('savedDayDeletionPrefix')).map(entry=>entry.value));
}
function replaceMetaPrefixFamily(familyName,values,{suffixOf,valueOf,abortMessage}){
  return Meta.transaction('readwrite',(meta,tx,finish)=>{
    const existing=meta.getAll(familyName),request=existing.request;
    request.onerror=()=>finish(false,request.error||new Error(`${familyName} replacement read failed`));
    request.onsuccess=()=>{
      let entries;try{entries=existing.entries();}catch(error){finish(false,error);return;}
      stageCanonicalMutationEpoch(tx,[]);
      for(const entry of entries)meta.remove(familyName,entry.suffix);
      for(const value of values){const canonical=valueOf(value),suffix=suffixOf(value);meta.put(familyName,canonical,{suffix,updatedAt:canonical.deletedAt});}
      tx.oncomplete=()=>finish(true,values.length);
    };
  },{strict:true,abortMessage});
}
async function replaceSavedDayDeletions(values){
  const clean=normalizeSavedDayDeletions(values);
  return replaceMetaPrefixFamily('savedDayDeletionPrefix',clean,{suffixOf:entry=>entry.date,valueOf:entry=>savedDayDeletionValue(entry.date,entry.deletedAt),abortMessage:'Saved-Day deletion ledger replacement aborted'});
}

function normalizeAreaNoteDeletions(values){
  if(!Array.isArray(values))throw new TypeError('Ongoing Note deletion ledger must be an array.');
  const byKey=new Map();
  for(const value of values){
    const key=normalizeAreaName(value&&value.key),deletedAt=normalizeTimestamp(value&&value.deletedAt,'');
    if(!key||!deletedAt)throw new Error('Ongoing Note deletion ledger contains an invalid entry.');
    const previous=byKey.get(key);if(!previous||Date.parse(deletedAt)>Date.parse(previous.deletedAt))byKey.set(key,{key,deletedAt});
  }
  if(byKey.size>APP_LIMITS.maxImportAreaNotes)throw new RangeError('Ongoing Note deletion ledger exceeds the supported note limit.');
  return [...byKey.values()].sort((a,b)=>a.key.localeCompare(b.key));
}
async function listAreaNoteDeletions(){
  return normalizeAreaNoteDeletions((await Meta.list('areaNoteDeletionPrefix')).map(entry=>entry.value));
}
async function replaceAreaNoteDeletions(values){
  const clean=normalizeAreaNoteDeletions(values);
  return replaceMetaPrefixFamily('areaNoteDeletionPrefix',clean,{suffixOf:entry=>entry.key,valueOf:entry=>areaNoteDeletionValue(entry.key,entry.deletedAt),abortMessage:'Ongoing Note deletion ledger replacement aborted'});
}

function normalizeAttachmentDeletions(values){
  if(!Array.isArray(values))throw new TypeError('Attachment deletion ledger must be an array.');
  const byId=new Map();
  for(const value of values){const assetId=normalizeAttachmentDeletionId(value&&value.assetId),deletedAt=normalizeTimestamp(value&&value.deletedAt,'');if(!assetId||!deletedAt)throw new Error('Attachment deletion ledger contains an invalid entry.');const previous=byId.get(assetId);if(!previous||Date.parse(deletedAt)>Date.parse(previous.deletedAt))byId.set(assetId,{assetId,deletedAt});}
  if(byId.size>50000)throw new RangeError('Attachment deletion ledger exceeds the supported attachment limit.');
  return [...byId.values()].sort((a,b)=>a.assetId.localeCompare(b.assetId));
}
async function listAttachmentDeletions(){
  return normalizeAttachmentDeletions((await Meta.list('attachmentDeletionPrefix')).map(entry=>entry.value));
}
async function replaceAttachmentDeletions(values){
  const clean=normalizeAttachmentDeletions(values);
  return replaceMetaPrefixFamily('attachmentDeletionPrefix',clean,{suffixOf:entry=>entry.assetId,valueOf:entry=>attachmentDeletionValue(entry.assetId,entry.deletedAt),abortMessage:'Attachment deletion ledger replacement aborted'});
}
function stageAttachmentDeletionState(tx,state={}){
  if(!tx||typeof tx.objectStore!=='function')throw new TypeError('Attachment deletion state requires an IndexedDB transaction.');
  const record=Array.isArray(state&&state.record)?state.record:[],clear=Array.isArray(state&&state.clear)?state.clear:[],recorded=new Set(),cleared=new Set(),meta=Meta.view(tx);
  for(const raw of clear){const id=normalizeAttachmentDeletionId(raw);if(!id)throw new TypeError('Attachment deletion identity is invalid.');cleared.add(id);}
  for(const raw of record){const source=raw&&typeof raw==='object'?raw:{assetId:raw},value=attachmentDeletionValue(source.assetId,source.deletedAt);if(cleared.has(value.assetId))throw new Error('Attachment deletion state cannot record and clear the same identity in one transaction.');recorded.add(value.assetId);meta.put('attachmentDeletionPrefix',value,{suffix:value.assetId,updatedAt:value.deletedAt});}
  for(const id of cleared)meta.remove('attachmentDeletionPrefix',id);
  return freeze({recorded:recorded.size,cleared:cleared.size});
}
async function recordAttachmentDeletion(assetId,deletedAt=new Date().toISOString()){
  const value=attachmentDeletionValue(assetId,deletedAt);
  await Meta.transaction('readwrite',(meta,tx,finish)=>{stageCanonicalMutationEpoch(tx,[]);const request=meta.put('attachmentDeletionPrefix',value,{suffix:value.assetId,updatedAt:value.deletedAt});request.onerror=()=>finish(false,request.error||new Error('Attachment deletion ledger write failed'));tx.oncomplete=()=>finish(true);},{strict:true,abortMessage:'Attachment deletion ledger write aborted'});
  return freeze({assetId:value.assetId,deletedAt:value.deletedAt});
}
async function clearAttachmentDeletion(assetId){
  const id=normalizeAttachmentDeletionId(assetId);if(!id)return false;
  await Meta.transaction('readwrite',(meta,tx,finish)=>{stageCanonicalMutationEpoch(tx,[]);const request=meta.remove('attachmentDeletionPrefix',id);request.onerror=()=>finish(false,request.error||new Error('Attachment deletion ledger clear failed'));tx.oncomplete=()=>finish(true);},{strict:true,abortMessage:'Attachment deletion ledger clear aborted'});return true;
}
async function verifyDeletionState(){
  const issues=[];let savedDay=[],areaNote=[],attachment=[];
  try{[savedDay,areaNote,attachment]=await Promise.all([listSavedDayDeletions(),listAreaNoteDeletions(),listAttachmentDeletions()]);}catch(error){issues.push(`canonical-deletion-ledger:${String(error&&error.message||error)}`);}
  const legacyQueue=await idbGetAllIfPresent(DB_LEGACY_SYNC_QUEUE_STORE,'legacy sync queue verification aborted'),legacyTombstones=await idbGetAllIfPresent(DB_LEGACY_TOMBSTONE_STORE,'legacy tombstone verification aborted');
  if(legacyQueue.length)issues.push('legacy-sync-queue-not-empty');if(legacyTombstones.length)issues.push('legacy-tombstones-not-empty');
  if(LocalStorageContract.getText(STORAGE_KEYS.legacySyncEmergency,null)!==null)issues.push('legacy-sync-emergency-present');
  return freeze({ok:issues.length===0,issues:freeze(issues),pendingRecovery:pendingDeletionEntries().length,savedDayDeletions:savedDay.length,areaNoteDeletions:areaNote.length,attachmentDeletions:attachment.length});
}
function dailyRecordMigrationMarkerIsCurrent(row){
  const value=row&&row.value||{};
  return value.complete===true&&
    Number(value.recordVersion)===DATA_CONTRACT.schemas.DailyRecord.version&&
    Number(value.summaryVersion)===DATA_CONTRACT.schemas.DailySummary.version;
}
function canonicalizeFallbackDailyRecords(raw){
  if(!Array.isArray(raw))throw new Error('Fallback Daily Records are not in a recognized array format. The source was preserved unchanged.');
  const source=raw;
  const records=[];let changed=false;
  for(const record of source){
    const current=sanitizeCurrentDailyRecord(record);
    if(current&&sameDataValue(record,current)){records.push(current);continue;}
    const canonical=CompatibilityCodec.dailyRecord(record);
    if(!canonical)throw new Error('A fallback Daily Record could not be converted to the current canonical schema. The source was preserved unchanged.');
    records.push(canonical);changed=true;
  }
  return Object.freeze({records:Object.freeze(records),changed});
}
async function migrateHistoricalDailyRecords(){
  const rawFallback=LocalStorageContract.getJson(STORAGE_KEYS.fallbackDailyRecords,[]);
  const fallback=canonicalizeFallbackDailyRecords(rawFallback);
  const marker=await rawLegacyMetaGet(META_KEYS.dailyRecordMigration);
  if(dailyRecordMigrationMarkerIsCurrent(marker)&&!fallback.changed){
    return Object.freeze({status:'current',records:Number(marker.value.recordCount)||0,rewritten:0,fallbackRecords:fallback.records.length});
  }
  const token=compatibilityWriteToken('migrate Daily Records');
  if(!token)return Object.freeze({status:'skipped',reason:'not-primary',records:Number(marker?.value?.recordCount)||0,rewritten:0,fallbackRecords:fallback.records.length});
  if(dailyRecordMigrationMarkerIsCurrent(marker)){
    assertWriteToken(token,'migrate fallback Daily Records');
    if(!LocalStorageContract.setJson(STORAGE_KEYS.fallbackDailyRecords,capFallbackDailyRecords(fallback.records))){
      throw LocalStorageContract.lastError||new Error('Fallback Daily Records could not be rewritten to the current schema.');
    }
    return Object.freeze({status:'fallback-migrated',records:Number(marker.value.recordCount)||0,rewritten:0,fallbackRecords:fallback.records.length});
  }
  const result=await idbStrictTransaction([DB_DAILY_RECORD_STORE,DB_DAILY_SUMMARY_STORE,DB_APP_META_STORE],'readwrite',(tx,finish)=>{
    const records=tx.objectStore(DB_DAILY_RECORD_STORE),summaries=tx.objectStore(DB_DAILY_SUMMARY_STORE),meta=CompatibilityMeta.view(tx);
    const fail=error=>{try{tx.abort();}catch{}finish(false,error);};
    const guard=()=>{try{assertWriteToken(token,'migrate Daily Records');return true;}catch(error){fail(error);return false;}};
    if(!guard())return;
    const clear=summaries.clear();
    clear.onerror=()=>fail(clear.error||new Error('daily summary migration clear failed'));
    let count=0,changed=0;
    const req=records.openCursor();
    req.onerror=()=>fail(req.error||new Error('daily record migration read failed'));
    req.onsuccess=event=>{
      if(!guard())return;
      const cursor=event.target.result;
      if(!cursor){
        const markerValue=storageMigrationMetaValue(true,count),markerUpdatedAt=new Date().toISOString();
        const markerRequest=meta.put('dailyRecordMigration',markerValue,{updatedAt:markerUpdatedAt});
        markerRequest.onerror=()=>fail(markerRequest.error||new Error('daily record migration marker write failed'));
        markerRequest.onsuccess=()=>{guard();};
        return;
      }
      const current=sanitizeCurrentDailyRecord(cursor.value);
      const canonical=current&&sameDataValue(cursor.value,current)?current:CompatibilityCodec.dailyRecord(cursor.value);
      if(!canonical){fail(new Error(`Daily Record ${String(cursor.key||'')} could not be converted to the current canonical schema. The migration transaction was rolled back.`));return;}
      if(!current||!sameDataValue(cursor.value,current)){const update=cursor.update(canonical);update.onerror=()=>fail(update.error||new Error('daily record migration write failed'));changed++;}
      const summaryWrite=summaries.put(buildDailyRecordSummary(canonical));summaryWrite.onerror=()=>fail(summaryWrite.error||new Error('daily summary migration write failed'));
      count++;cursor.continue();
    };
    tx.oncomplete=()=>finish(true,{records:count,rewritten:changed});
  },'daily record canonical migration aborted');
  assertWriteToken(token,'migrate fallback Daily Records');
  if(fallback.changed&&!LocalStorageContract.setJson(STORAGE_KEYS.fallbackDailyRecords,capFallbackDailyRecords(fallback.records))){
    throw LocalStorageContract.lastError||new Error('Fallback Daily Records could not be rewritten to the current schema.');
  }
  return Object.freeze({status:'migrated',...result,fallbackRecords:fallback.records.length});
}
async function verifyDailyRecordCanonicalBaseline(){
  const issues=[];
  let meta=null;
  try{meta=await rawLegacyMetaGet(META_KEYS.dailyRecordMigration);}catch(error){issues.push('migration-marker-unreadable');}
  const marker=meta&&meta.value||{};
  if(!(marker.complete&&Number(marker.recordVersion)===DATA_CONTRACT.schemas.DailyRecord.version&&Number(marker.summaryVersion)===DATA_CONTRACT.schemas.DailySummary.version))issues.push('migration-marker-incomplete');
  const [records,summaries]=await Promise.all([idbAllRecords(),idbAllSummaries()]);
  const byDate=new Map();
  for(const raw of records){
    const clean=sanitizeCurrentDailyRecord(raw);
    if(!clean||!sameDataValue(raw,clean)){issues.push(`daily-record:${String(raw&&raw.date||'?')}`);continue;}
    byDate.set(clean.date,clean);
  }
  const summaryByDate=new Map();
  for(const raw of summaries){
    const clean=sanitizeDailyRecordSummary(raw);
    if(!clean||!sameDataValue(raw,clean)){issues.push(`daily-summary:${String(raw&&raw.date||'?')}`);continue;}
    summaryByDate.set(clean.date,clean);
  }
  if(summaryByDate.size!==byDate.size)issues.push('daily-summary-count-mismatch');
  for(const [date,record] of byDate){
    const summary=summaryByDate.get(date),expected=buildDailyRecordSummary(record);
    if(!summary||!sameDataValue(summary,expected))issues.push(`daily-summary-mismatch:${date}`);
  }
  const rawFallback=LocalStorageContract.getJson(STORAGE_KEYS.fallbackDailyRecords,[]),fallback=Array.isArray(rawFallback)?rawFallback:[];
  if(!Array.isArray(rawFallback))issues.push('fallback-daily-records-invalid');
  for(const raw of fallback){const clean=sanitizeCurrentDailyRecord(raw);if(!clean||!sameDataValue(raw,clean))issues.push(`fallback-daily-record:${String(raw&&raw.date||'?')}`);}
  return freeze({ok:issues.length===0,records:records.length,summaries:summaries.length,fallbackRecords:fallback.length,issues:freeze(issues)});
}
async function idbGetRecordsByDates(dates){
  const unique=[...new Set((dates||[]).filter(isValidIsoDate))].slice(0,APP_LIMITS.maxImportRecords);
  if(!unique.length)return [];
  return idbStoreTransaction(DB_DAILY_RECORD_STORE,'readonly',(store,tx,finish)=>{
    const out=[];let pending=unique.length,failed=false;
    unique.forEach(date=>{
      const req=store.get(date);
      req.onsuccess=()=>{if(req.result)out.push(req.result);if(--pending===0&&!failed)finish(true,out);};
      req.onerror=()=>{if(failed)return;failed=true;finish(false,req.error||new Error('batch record read failed'));};
    });
  },'batch record read aborted');
}
async function idbGetRecordsByMonth(month){
  const key=String(month||'');if(!/^\d{4}-(?:0[1-9]|1[0-2])$/u.test(key))throw new TypeError('Saved-Day month is invalid.');
  const Range=globalThis.IDBKeyRange,lower=`${key}-01`,upper=`${key}-31`;
  return idbStoreTransaction(DB_DAILY_RECORD_STORE,'readonly',(store,tx,finish)=>{
    if(Range&&typeof Range.bound==='function'&&typeof store.getAll==='function'){
      const request=store.getAll(Range.bound(lower,upper));request.onsuccess=()=>finish(true,request.result||[]);request.onerror=()=>finish(false,request.error);return;
    }
    const request=store.getAll();request.onsuccess=()=>finish(true,(request.result||[]).filter(row=>String(row&&row.date||'').startsWith(key+'-')));request.onerror=()=>finish(false,request.error);
  },'Saved-Day month read aborted');
}
function currentDailyRecordDocuments(records,label='Daily Records'){
  const input=Array.isArray(records)?records:[];
  const docs=input.map(sanitizeCurrentDailyRecord);
  if(docs.some(record=>!record))throw new Error(`${label} contain noncanonical data. Compatibility migration or import conversion must complete before persistence.`);
  return docs;
}
async function idbPutDailyRecordBatch(records,{bumpRevision=true,ownershipToken=null}={}){
  const docs=currentDailyRecordDocuments(records,'Daily Record batch');
  if(!docs.length)return true;
  const stores=[DB_DAILY_RECORD_STORE,DB_DAILY_SUMMARY_STORE,DB_APP_META_STORE];
  return idbStrictTransaction(stores,'readwrite',(tx,finish)=>{
    if(ownershipToken)assertWriteToken(ownershipToken,'the daily-record transaction');
    const recordStore=tx.objectStore(DB_DAILY_RECORD_STORE),summaryStore=tx.objectStore(DB_DAILY_SUMMARY_STORE),meta=Meta.view(tx);
    let revisionState=null;
    stageCanonicalMutationEpoch(tx,[...new Set(docs.map(doc=>dailyPreparationUnit(doc.date)))]);
    docs.forEach(doc=>{recordStore.put(doc);summaryStore.put(buildDailyRecordSummary(doc));meta.remove('savedDayDeletionPrefix',doc.date);});
    if(bumpRevision)revisionState=InsightsDatasetRevision.stage(tx,'daily-record-upsert');
    tx.oncomplete=()=>{InsightsDatasetRevision.committed(revisionState);finish(true,{ok:true});};
  },'daily record batch write aborted');
}
async function idbPut(rec,options={}){
  const clean=sanitizeCurrentDailyRecord(rec);
  if(!clean)throw new Error('invalid daily record');
  return idbPutDailyRecordBatch([clean],options);
}
function idbAllRecords(){return idbGetAll(DB_DAILY_RECORD_STORE,'read aborted');}
function idbAllSummaries(){return idbGetAll(DB_DAILY_SUMMARY_STORE,'summary read aborted');}
async function idbDailyRecordKeys(){
  return idbStoreTransaction(DB_DAILY_RECORD_STORE,'readonly',(store,tx,finish)=>{
    if(typeof store.getAllKeys==='function'){const request=store.getAllKeys();request.onsuccess=()=>finish(true,(request.result||[]).map(String));request.onerror=()=>finish(false,request.error);return;}
    const out=[],request=store.openKeyCursor();request.onsuccess=event=>{const cursor=event.target.result;if(!cursor)return finish(true,out);out.push(String(cursor.key));cursor.continue();};request.onerror=()=>finish(false,request.error);
  },'daily record key read aborted');
}
async function repairDailySummaries(){
  const records=(await idbAllRecords()).map(sanitizeCurrentDailyRecord);
  if(records.some(record=>!record))throw new Error('Daily Summary repair found a noncanonical Daily Record.');
  await idbStrictTransaction(DB_DAILY_SUMMARY_STORE,'readwrite',(tx,finish)=>{const store=tx.objectStore(DB_DAILY_SUMMARY_STORE);store.clear();records.forEach(record=>store.put(buildDailyRecordSummary(record)));tx.oncomplete=()=>finish(true);},'daily summary repair aborted');
  return records.length;
}
async function getVerifiedIdbDailyRecordSummaries(){
  const rows=await idbAllSummaries(),clean=rows.map(sanitizeDailyRecordSummary);
  if(clean.some(row=>!row))throw new Error('Daily Summary cache is not canonical and must be rebuilt.');
  return clean;
}
function idbGetRecord(date){return idbGet(DB_DAILY_RECORD_STORE,date,'record read aborted');}
async function idbDelete(date,{trackDeletion=true,ownershipToken=null,deletedAt=new Date().toISOString()}={}){
  return idbStrictTransaction([DB_DAILY_RECORD_STORE,DB_DAILY_SUMMARY_STORE,DB_APP_META_STORE],'readwrite',(tx,finish)=>{
    if(ownershipToken)assertWriteToken(ownershipToken,'the daily-record deletion');
    const records=tx.objectStore(DB_DAILY_RECORD_STORE),summaries=tx.objectStore(DB_DAILY_SUMMARY_STORE),meta=Meta.view(tx);
    let changed=false,revisionState=null;
    const req=records.get(date);
    req.onsuccess=()=>{
      changed=!!req.result;records.delete(date);summaries.delete(date);
      stageCanonicalMutationEpoch(tx,[dailyPreparationUnit(date)]);
      if(trackDeletion){const deletion=savedDayDeletionValue(date,deletedAt);meta.put('savedDayDeletionPrefix',deletion,{suffix:date,updatedAt:deletion.deletedAt});}else meta.remove('savedDayDeletionPrefix',date);
      if(changed)revisionState=InsightsDatasetRevision.stage(tx,'daily-record-delete');
    };
    tx.oncomplete=()=>{InsightsDatasetRevision.committed(revisionState);finish(true,{changed});};
  },'daily record deletion aborted');
}
async function idbPutActiveSession(session,ownershipToken=null){
  const current=ActiveSessionCodec.sanitizeCurrent(session);if(!current)throw canonicalRuntimeError('Active Session write requires the current canonical schema.');session=current;
  return idbTransaction([DB_ACTIVE_SESSION_STORE,DB_APP_META_STORE],'readwrite',(tx,finish)=>{
    const store=tx.objectStore(DB_ACTIVE_SESSION_STORE);
    if(ownershipToken)assertWriteToken(ownershipToken,'the active-session transaction');
    stageCanonicalMutationEpoch(tx,['activeSession']);const request=store.put(session);request.onerror=()=>finish(false,request.error||new Error('active session write failed'));
    tx.oncomplete=()=>finish(true);
  },'active session write aborted');
}
function idbGetActiveSession(){return idbGet(DB_ACTIVE_SESSION_STORE,ACTIVE_SESSION_ID,'active session read failed');}
async function idbDeleteActiveSession(ownershipToken=null){
  return idbStrictTransaction([DB_ACTIVE_SESSION_STORE,DB_APP_META_STORE],'readwrite',(tx,finish)=>{
    const store=tx.objectStore(DB_ACTIVE_SESSION_STORE);
    if(ownershipToken)assertWriteToken(ownershipToken,'the active-session deletion');
    stageCanonicalMutationEpoch(tx,['activeSession']);const request=store.delete(ACTIVE_SESSION_ID);request.onerror=()=>finish(false,request.error||new Error('active session delete failed'));
    tx.oncomplete=()=>finish(true);
  },'active session delete aborted');
}

async function saveActiveSessionRecord(session,{emergency=false,backupCapture=false}={}){
  let ownershipToken;
  try{ownershipToken=issueWriteToken('saving the active session');}
  catch(error){return {ok:false,value:null,error,storage:{local:false,idb:false}};}
  if(!session||session.id!==ACTIVE_SESSION_ID||!session.snapshot)return {ok:false,value:null,error:new Error('invalid active session'),storage:{local:false,idb:false}};
  const revision=boundedNumber(session.revision,{min:1,max:Number.MAX_SAFE_INTEGER,fallback:nextSessionRevision()});
  lastSessionRevision=Math.max(lastSessionRevision,revision);
  const clean=ActiveSessionCodec.canonicalize({...session,version:DATA_CONTRACT.schemas.ActiveSession.version,revision,updatedAt:normalizeTimestamp(session.updatedAt,new Date().toISOString())});
  if(!clean)return {ok:false,value:null,error:new Error('active session failed canonical validation'),storage:{local:false,idb:false}};
  const writeEpoch=++activeSessionMutationEpoch;
  let localSaved=false;
  function checkpoint(){
    assertWriteToken(ownershipToken,'the local recovery-envelope write');
    const envelope=activeSessionRecoveryEnvelope(clean);
    localSaved=!!(envelope&&LocalStorageContract.setJson(STORAGE_KEYS.recovery,envelope));
  }
  // Before page-exit asynchronous work can be suspended, retain the latest full snapshot.
  if(emergency){try{checkpoint();}catch(error){if(isOwnershipLostError(error))return {ok:false,value:clean,error,storage:{local:false,idb:false}};throw error;}}
  const finishWrite=beginAuthoritativeWrite();
  activeSessionWriteChain=activeSessionWriteChain.catch(error=>{AppDiagnostics.capture('active-session.previous-write',error,'error');}).then(async()=>{
    let idbSaved=false,idbError=null;
    try{
      await idbPutActiveSession(clean,ownershipToken);idbSaved=true;
      clearDeletionRecoveryKeys([deletionRecoveryKey('activeSession',ACTIVE_SESSION_ID)]);
      reportCanonicalCommit('activeSession','upsert',clean,{backupCapture});
    }catch(e){
      if(isOwnershipLostError(e))return {ok:false,value:clean,error:e,storage:{local:localSaved,idb:false}};
      idbError=e;
      if(!localSaved&&writeEpoch===activeSessionMutationEpoch){
        try{checkpoint();}catch(error){if(isOwnershipLostError(error))return {ok:false,value:clean,error,storage:{local:false,idb:false}};throw error;}
      }
    }
    if(idbSaved&&writeEpoch===activeSessionMutationEpoch){
      try{assertWriteToken(ownershipToken,'clearing committed session recovery');LocalStorageContract.remove(STORAGE_KEYS.recovery);}catch(error){if(!isOwnershipLostError(error))AppDiagnostics.capture('active-session.recovery-cleanup',error);}
    }
    if(localSaved||idbSaved){
      return {ok:true,value:clean,error:idbError,storage:{local:localSaved,idb:idbSaved}};
    }
    return {ok:false,value:clean,error:idbError||LocalStorageContract.lastError||new Error('active session save failed'),storage:{local:false,idb:false}};
  }).finally(finishWrite);
  return activeSessionWriteChain;
}
async function activeSessionEpochFallback(retry,options={}){
  if(retry<2)return loadActiveSessionRecord(retry+1,options);
  if(options.strict)throw new Error('Active Session changed during maintenance; reconciliation will retry.');
  const settled=await activeSessionWriteChain;
  if(settled?.ok&&Object.prototype.hasOwnProperty.call(settled,'value'))return settled;
  const currentLocal=readLocalRecoverySession();
  return {ok:true,value:currentLocal,error:null,storage:{local:!!currentLocal,idb:false}};
}
async function loadActiveSessionRecord(retry=0,options={}){
  await activeSessionWriteChain.catch(error=>{AppDiagnostics.capture('active-session.pre-read-settle',error,'error');});
  const readEpoch=activeSessionMutationEpoch;
  const rawLocal=readLocalRecoverySession(options);
  const migratedLocal=rawLocal?ActiveSessionCodec.sanitizeCurrent(rawLocal):null;
  if(rawLocal&&!migratedLocal)throw canonicalRuntimeError('Active Session recovery resolved to a non-current canonical session.');
  const localSession=pendingDeletionShadowsEntity('activeSession',ACTIVE_SESSION_ID,migratedLocal)?null:migratedLocal;
  if(options.strict&&LocalStorageContract.lastError)throw LocalStorageContract.lastError;
  try{
    const rawIdb=await idbGetActiveSession();
    if(readEpoch!==activeSessionMutationEpoch)return activeSessionEpochFallback(retry,options);
    const migratedIdb=rawIdb?ActiveSessionCodec.sanitizeCurrent(rawIdb):null;
    if(rawIdb&&!migratedIdb)throw canonicalRuntimeError('Stored Active Session is not in the current canonical schema.');
    const idbSession=migratedIdb&&!pendingDeletionShadowsEntity('activeSession',ACTIVE_SESSION_ID,migratedIdb)?migratedIdb:null;
    if(options.strict&&LocalStorageContract.lastError)throw LocalStorageContract.lastError;
    const value=newerActiveSession(idbSession,localSession);
    if(value&&value.revision)lastSessionRevision=Math.max(lastSessionRevision,Number(value.revision)||0);
    let reconciliationError=null;
    activeSessionWriteChain=activeSessionWriteChain.catch(error=>{AppDiagnostics.capture('active-session.previous-reconciliation',error,'error');}).then(async()=>{
      if(readEpoch!==activeSessionMutationEpoch)return;
      let reconciliationToken=null;
      try{reconciliationToken=issueWriteToken('reconciling the active session',{allowHydrating:true});}catch(error){reconciliationError=error;}
      if(reconciliationToken&&value===localSession&&value&&(!idbSession||newerActiveSession(idbSession,value)===value)){
        try{
          if(readEpoch!==activeSessionMutationEpoch)return;
          assertWriteToken(reconciliationToken,'the active-session reconciliation');
          await idbPutActiveSession(value,reconciliationToken);
          if(readEpoch===activeSessionMutationEpoch){assertWriteToken(reconciliationToken,'clearing reconciled session recovery');if(!LocalStorageContract.remove(STORAGE_KEYS.recovery)&&options.strict)throw LocalStorageContract.lastError||new Error('Reconciled session recovery could not be cleared.');}
          if(!clearDeletionRecoveryKeys([deletionRecoveryKey('activeSession',ACTIVE_SESSION_ID)])&&options.strict)throw LocalStorageContract.lastError||new Error('Session deletion recovery could not be reconciled.');
        }catch(e){reconciliationError=e;if(!isOwnershipLostError(e))AppDiagnostics.capture('active-session.reconcile-idb',e);}
      }else if(reconciliationToken&&value===idbSession&&value&&(!localSession||newerActiveSession(localSession,idbSession)===idbSession)){
        try{
          if(readEpoch!==activeSessionMutationEpoch)return;
          assertWriteToken(reconciliationToken,'the active-session canonical read-repair');
          if(rawIdb&&!sameDataValue(rawIdb,idbSession))await idbPutActiveSession(idbSession,reconciliationToken);
          if(!LocalStorageContract.remove(STORAGE_KEYS.recovery)&&options.strict)throw LocalStorageContract.lastError||new Error('Session recovery could not be cleared.');
        }catch(error){reconciliationError=error;if(!isOwnershipLostError(error))AppDiagnostics.capture('active-session.reconcile-local',error);}
      }
    });
    await activeSessionWriteChain;
    if(options.strict&&reconciliationError)throw reconciliationError;
    if(readEpoch!==activeSessionMutationEpoch)return activeSessionEpochFallback(retry,options);
    return {ok:true,value,error:null,storage:{local:!!localSession,idb:!!idbSession}};
  }catch(e){
    if(options.strict||isCanonicalRuntimeError(e))throw e;
    AppDiagnostics.capture('active-session.load-idb',e,'error');
    return {ok:!!localSession,value:localSession,error:e,storage:{local:!!localSession,idb:false}};
  }
}
async function migrateHistoricalActiveSession(){
  const token=compatibilityWriteToken('canonicalize Active Session');
  if(!token)return freeze({status:'skipped',reason:'not-primary',rewritten:0,recoveryRewritten:0});
  let rewritten=0,recoveryRewritten=0;
  const rawRecoveryText=LocalStorageContract.getText(STORAGE_KEYS.recovery,null);
  if(LocalStorageContract.lastError)throw new Error('The Active Session recovery envelope could not be read safely. Migration was not attempted.');
  if(rawRecoveryText!==null){
    let rawRecovery;
    try{rawRecovery=JSON.parse(rawRecoveryText);}catch(error){throw new Error('The stored Active Session recovery envelope is malformed. It was preserved unchanged.');}
    const canonicalRecovery=CompatibilityCodec.localRecoveryEnvelope(rawRecovery);
    if(!canonicalRecovery)throw new Error('The stored Active Session recovery envelope could not be converted to the current canonical schema. It was preserved unchanged.');
    if(!sameDataValue(rawRecovery,canonicalRecovery)){
      assertWriteToken(token,'canonicalize Active Session recovery');
      if(!LocalStorageContract.setJson(STORAGE_KEYS.recovery,canonicalRecovery))throw LocalStorageContract.lastError||new Error('Active Session recovery canonicalization could not be persisted.');
      const verified=LocalStorageContract.getJson(STORAGE_KEYS.recovery,null);
      if(!verified||!sameDataValue(sanitizeCurrentLocalRecoveryEnvelope(verified),canonicalRecovery))throw new Error('Active Session recovery canonicalization could not be verified.');
      recoveryRewritten=1;
    }
  }
  const raw=await idbGetActiveSession();
  if(raw){
    const current=ActiveSessionCodec.canonicalize(raw);
    if(!(current&&sameDataValue(raw,current))){
      const canonical=CompatibilityCodec.activeSession(raw);
      if(!canonical)throw new Error('The stored Active Session could not be converted to the current canonical schema. The source was preserved unchanged.');
      assertWriteToken(token,'canonicalize Active Session');
      await idbStrictStoreTransaction(DB_ACTIVE_SESSION_STORE,'readwrite',(store,tx,finish)=>{
        try{assertWriteToken(token,'canonicalize Active Session');}catch(error){finish(false,error);return;}
        const request=store.put(canonical);
        request.onerror=()=>finish(false,request.error||new Error('Active Session canonicalization write failed.'));
        tx.oncomplete=()=>finish(true,true);
      },'Active Session canonicalization aborted');
      rewritten=1;
    }
  }
  return freeze({status:(rewritten||recoveryRewritten)?'migrated':'current',rewritten,recoveryRewritten});
}
async function verifyHistoricalActiveSession(){
  const issues=[];
  const rawRecoveryText=LocalStorageContract.getText(STORAGE_KEYS.recovery,null);
  if(LocalStorageContract.lastError)issues.push('active-session-recovery-unreadable');
  else if(rawRecoveryText!==null){
    try{
      const rawRecovery=JSON.parse(rawRecoveryText),canonicalRecovery=sanitizeCurrentLocalRecoveryEnvelope(rawRecovery);
      if(!canonicalRecovery||!sameDataValue(rawRecovery,canonicalRecovery))issues.push('active-session-recovery-noncanonical');
    }catch(error){issues.push('active-session-recovery-invalid');}
  }
  try{
    const raw=await idbGetActiveSession();
    if(raw){const current=ActiveSessionCodec.sanitizeCurrent(raw);if(!current)issues.push('active-session-record-noncanonical');}
  }catch(error){issues.push('active-session-record-unreadable');}
  return freeze({ok:issues.length===0,issues:freeze(issues)});
}

async function clearActiveSessionRecord(){
  activeSessionMutationEpoch++;
  let ownershipToken;
  try{ownershipToken=issueWriteToken('clearing the active session');}
  catch(error){return {ok:false,value:null,error,storage:{local:false,idb:false}};}
  const finishWrite=beginAuthoritativeWrite();
  activeSessionWriteChain=activeSessionWriteChain.catch(error=>{AppDiagnostics.capture('active-session.previous-clear',error,'error');}).then(async()=>{
    const deletedAt=new Date().toISOString(),recoveryKey=deletionRecoveryKey('activeSession',ACTIVE_SESSION_ID);
    const staged=stageDeletionRecovery('activeSession',ACTIVE_SESSION_ID,deletedAt);
    let localCleared=false,idbCleared=false,idbError=null;
    try{
      assertWriteToken(ownershipToken,'the active-session deletion');
      localCleared=LocalStorageContract.remove(STORAGE_KEYS.recovery);
      if(!localCleared&&!staged)throw LocalStorageContract.lastError||new Error('ActiveSession recovery envelope could not be cleared and no durable deletion marker could be established.');
      assertWriteToken(ownershipToken,'the active-session IndexedDB deletion');
      await idbDeleteActiveSession(ownershipToken);idbCleared=true;
      if(localCleared&&idbCleared)clearDeletionRecoveryKeys([recoveryKey]);
      reportCanonicalCommit('activeSession','delete');
    }catch(e){
      if(isOwnershipLostError(e))return {ok:false,value:null,error:e,storage:{local:localCleared,idb:idbCleared}};
      idbError=e;
      if(!staged)return {ok:false,value:null,error:e,storage:{local:localCleared,idb:idbCleared}};
    }
    const ok=(idbCleared&&localCleared)||(staged&&(!localCleared||!idbCleared));
    return {ok,value:null,error:ok?idbError:(idbError||LocalStorageContract.lastError||new Error('active session clear failed')),storage:{local:localCleared,idb:idbCleared}};
  }).finally(finishWrite);
  return activeSessionWriteChain;
}

function readableDailyRecord(record){
  if(!record)return null;
  const current=sanitizeCurrentDailyRecord(record);
  if(!current)throw canonicalRuntimeError(`Daily Record ${String(record&&record.date||'?')} is not in the current canonical schema.`);
  return current;
}
function fallbackDailyRecordsRawGet(options={}){
  const raw=LocalStorageContract.getJson(STORAGE_KEYS.fallbackDailyRecords,[]);
  if(options.strict&&LocalStorageContract.lastError)throw LocalStorageContract.lastError;
  const compatible=(Array.isArray(raw)?raw:[]).map(readableDailyRecord).filter(Boolean);
  return capFallbackDailyRecords(compatible);
}
function fallbackDailyRecordsGet(options={}){
  const records=filterPendingDeletedEntities(fallbackDailyRecordsRawGet(options),'dailyRecord','date');
  if(options.strict&&LocalStorageContract.lastError)throw LocalStorageContract.lastError;
  return records;
}
function fallbackDailyRecordsSet(arr){
  return LocalStorageContract.setJson(STORAGE_KEYS.fallbackDailyRecords,capFallbackDailyRecords(arr||[]));
}
function dailyRecordTimestamp(record){
  const n=Date.parse(record&&((record.updatedAt)||(record.savedAt))||'');
  return Number.isFinite(n)?n:0;
}
function activeSessionTimestamp(session){
  const n=Date.parse(session&&session.updatedAt||'');
  return Number.isFinite(n)?n:0;
}
function newerActiveSession(a,b){
  if(!a)return b||null;
  if(!b)return a;
  const ar=boundedNumber(a.revision,{min:0,max:Number.MAX_SAFE_INTEGER,fallback:0});
  const br=boundedNumber(b.revision,{min:0,max:Number.MAX_SAFE_INTEGER,fallback:0});
  if(ar!==br)return br>ar?b:a;
  return activeSessionTimestamp(b)>activeSessionTimestamp(a)?b:a;
}
function newerDailyRecord(a,b){
  if(!a)return b||null;
  if(!b)return a;
  return dailyRecordTimestamp(b)>dailyRecordTimestamp(a)?b:a;
}
function mergeDailyRecordSets(...sets){
  const byDate=new Map();
  sets.flat().forEach(record=>{
    const clean=readableDailyRecord(record);
    if(!clean||!isValidIsoDate(clean.date))return;
    byDate.set(clean.date,newerDailyRecord(byDate.get(clean.date),clean));
  });
  return [...byDate.values()];
}
async function migrateFallbackDailyRecords(records,{strict=false}={}){
  if(!records.length)return true;
  if(!appCanMutate()){if(strict)throw new Error('Fallback migration requires study control.');return;}
  let ownershipToken;
  try{ownershipToken=issueWriteToken('migrating fallback daily records');}catch(error){if(strict)throw error;return;}
  const finishWrite=beginAuthoritativeWrite();
  const migratedDates=new Set();
  try{
    for(const record of records){
      try{
        assertWriteToken(ownershipToken,'the fallback-record migration');
        await idbPut(record,{ownershipToken});
        if(record&&isValidIsoDate(record.date))migratedDates.add(record.date);
      }catch(e){if(strict)throw e;break;}
    }
    if(!migratedDates.size)return;
    assertWriteToken(ownershipToken,'the fallback-record cleanup');
    const remaining=fallbackDailyRecordsGet().filter(record=>!migratedDates.has(record.date));
    const cleared=fallbackDailyRecordsSet(remaining);
    if(strict&&(!cleared||remaining.length))throw LocalStorageContract.lastError||new Error('Fallback Daily Records still require reconciliation.');
    if(!remaining.length)confirmDailyRecordStorage();
    return true;
  }finally{
    finishWrite();
  }
}
async function storeDailyRecord(rec,options={}){
  const ownershipToken=issueWriteToken('saving the daily record');
  if(!rec||!isValidIsoDate(rec.date))throw new Error('Invalid daily record date');
  const finishWrite=beginAuthoritativeWrite();
  let stored=false;
  try{
  assertWriteToken(ownershipToken,'preparing the daily record');
  const updatedAt=normalizeTimestamp(rec.updatedAt,normalizeTimestamp(rec.savedAt,new Date().toISOString()));
  const candidate={...rec,version:DATA_CONTRACT.schemas.DailyRecord.version,updatedAt};
  for(const key of ['entityType','entityId','schemaVersion','deviceId','createdAt','deleted','syncStatus'])delete candidate[key];
  const clean=sanitizeCurrentDailyRecord(candidate);
  if(!clean||clean.degraded)throw new Error('New daily record failed its canonical validation.');
  try{
      assertWriteToken(ownershipToken,'the daily-record IndexedDB write');
    await idbPut(clean,{markDirty:true,ownershipToken});
    assertWriteToken(ownershipToken,'the daily-record post-write cleanup');
    clearDeletionRecoveryKeys([deletionRecoveryKey('dailyRecord',clean.date)]);
    fallbackDailyRecordsSet(fallbackDailyRecordsGet().filter(record=>record.date!==clean.date));
    confirmDailyRecordStorage();
    reportCanonicalCommit('dailyRecord','upsert',null,{backupCapture:options.backupCapture===true});
    stored=true;return freeze({ok:true,storage:'indexeddb'});
  }
  catch(e){
    if(isOwnershipLostError(e))throw e;
    assertWriteToken(ownershipToken,'the daily-record fallback write');
    const existing=fallbackDailyRecordsGet(),arr=existing.filter(r=>r.date!==clean.date);arr.push(clean);
    const capped=capFallbackDailyRecords(arr),retainedDates=new Set(capped.map(record=>record.date));
    showStorageFallbackWarning(e&&e.message?e.message:'saved-date database failed');
    if(arr.some(record=>!retainedDates.has(record.date))){
      throw new Error(`IndexedDB is unavailable and the emergency fallback is full (${FALLBACK_DAILY_RECORD_LIMIT} records / ${Math.round(APP_LIMITS.fallbackDailyRecordsBytes/1048576)} MB). The existing fallback was preserved and this save was not acknowledged; export a backup and retry after storage recovers.`);
    }
    if(!fallbackDailyRecordsSet(capped))throw LocalStorageContract.lastError||e;
    clearDeletionRecoveryKeys([deletionRecoveryKey('dailyRecord',clean.date)]);
    InsightsDatasetRevision.invalidateVolatile('fallback-daily-record-upsert');
    stored=true;return freeze({ok:true,storage:'fallback'});
  }finally{if(stored)notifyDailyRecordsChanged(rec.date,'save');}
  }finally{finishWrite();}
}
async function storeDailyRecordBatch(records){
  const ownershipToken=issueWriteToken('saving the daily-record batch');
  const docs=currentDailyRecordDocuments(records,'Daily Record batch');
  if(!docs.length)return true;
  const finishWrite=beginAuthoritativeWrite();
  try{
      assertWriteToken(ownershipToken,'the daily-record batch transaction');
    await idbPutDailyRecordBatch(docs,{ownershipToken});
    assertWriteToken(ownershipToken,'the daily-record batch cleanup');
    clearDeletionRecoveryKeys(docs.map(doc=>deletionRecoveryKey('dailyRecord',doc.date)));
    const savedDates=new Set(docs.map(doc=>doc.date));
    fallbackDailyRecordsSet(fallbackDailyRecordsGet().filter(record=>!savedDates.has(record.date)));
    confirmDailyRecordStorage();
    reportCanonicalCommit('dailyRecord','upsert');
    notifyDailyRecordsChanged('','batch');
    return true;
  }catch(e){
    if(isOwnershipLostError(e))throw e;
    assertWriteToken(ownershipToken,'the daily-record batch fallback write');
    showStorageFallbackWarning(e&&e.message?e.message:'saved-date batch save failed');
    const existing=fallbackDailyRecordsGet(),merged=mergeDailyRecordSets(existing,docs);
    const capped=capFallbackDailyRecords(merged),retainedDates=new Set(capped.map(record=>record.date));
    if(merged.some(record=>!retainedDates.has(record.date))){
      throw new Error(`IndexedDB is unavailable and this batch exceeds the emergency fallback capacity (${FALLBACK_DAILY_RECORD_LIMIT} records / ${Math.round(APP_LIMITS.fallbackDailyRecordsBytes/1048576)} MB). Existing fallback records were preserved and nothing from this batch was written; keep the backup file and retry after storage recovers.`);
    }
    if(!fallbackDailyRecordsSet(capped))throw LocalStorageContract.lastError||e;
    InsightsDatasetRevision.invalidateVolatile('fallback-daily-record-batch');
    notifyDailyRecordsChanged('','batch');
    return true;
  }finally{finishWrite();}
}
async function getDailyRecordSummaries(){
  const fallback=fallbackDailyRecordsGet();
  try{
    if(!fallback.length){
      const [summaries,recordKeys]=await Promise.all([getVerifiedIdbDailyRecordSummaries(),idbDailyRecordKeys()]);
      const summaryKeys=summaries.map(row=>row.date).sort(),canonicalKeys=recordKeys.filter(isValidIsoDate).sort();
      const projectionCurrent=summaryKeys.length===canonicalKeys.length&&summaryKeys.every((date,index)=>date===canonicalKeys[index]);
      if(projectionCurrent){
        confirmDailyRecordStorage();
        return filterPendingDeletedEntities(summaries,'dailyRecord','date').map(materializeDailyRecordSummary);
      }
      const records=filterPendingDeletedEntities(await idbAllRecords(),'dailyRecord','date');
      if(appCanMutate())void repairDailySummaries().catch(error=>AppDiagnostics.capture('daily-summaries.repair',error,'warn'));
      confirmDailyRecordStorage();
      return records.map(record=>materializeDailyRecordSummary(buildDailyRecordSummary(record)));
    }
    const records=filterPendingDeletedEntities(mergeDailyRecordSets(await idbAllRecords(),fallback),'dailyRecord','date');
    migrateFallbackDailyRecords(fallback);
    return records.map(record=>materializeDailyRecordSummary(buildDailyRecordSummary(record)));
  }catch(e){
    if(isCanonicalRuntimeError(e))throw e;
    try{
      const records=filterPendingDeletedEntities(mergeDailyRecordSets(await idbAllRecords(),fallback),'dailyRecord','date');
      if(records.some(record=>!record))throw e;
      if(appCanMutate())void repairDailySummaries().catch(error=>AppDiagnostics.capture('daily-summaries.repair',error,'warn'));
      return records.map(record=>materializeDailyRecordSummary(buildDailyRecordSummary(record)));
    }catch(storageError){
      if(isCanonicalRuntimeError(storageError))throw storageError;
      showStorageFallbackWarning(storageError&&storageError.message?storageError.message:'saved-date database failed');
      return filterPendingDeletedEntities(fallback,'dailyRecord','date').map(record=>materializeDailyRecordSummary(buildDailyRecordSummary(record)));
    }
  }
}
function sortDailySummariesAsc(summaries){return (summaries||[]).map(summary=>{const {dayOfWeek,dayName,...raw}=summary||{};return materializeDailyRecordSummary(raw);}).filter(Boolean).sort((a,b)=>a.date.localeCompare(b.date));}
function sortDailyRecordsAsc(records){return (records||[]).filter(r=>r&&isValidIsoDate(r.date)).sort((a,b)=>a.date.localeCompare(b.date));}
async function getSortedDailyRecordSummaries(){return sortDailySummariesAsc(await getDailyRecordSummaries());}
async function getSortedDailyRecords(){return sortDailyRecordsAsc(await getDailyRecords());}
async function getDailyRecordsForWindow(options={}){
  const summaries=(await getSortedDailyRecordSummaries()).filter(summary=>summary?.recordKind==='study');
  const opts=options&&typeof options==='object'?options:{};
  if(opts.windowDays||opts.from||opts.to||opts.limit){
    const recordWindow=normalizeInsightsRecordWindowOptions(opts,summaries);
    try{
      const fallback=fallbackDailyRecordsGet();
      const idbRecords=await idbGetRecordsByDates(recordWindow.dates);
      const records=filterPendingDeletedEntities(mergeDailyRecordSets(idbRecords,fallback.filter(r=>recordWindow.dates.includes(r.date))),'dailyRecord','date');
      return sortDailyRecordsAsc(records.map(materializeDailyRecordView)).filter(record=>record.recordKind==='study');
    }catch(e){
      if(isCanonicalRuntimeError(e))throw e;
      const records=await Promise.all(recordWindow.dates.map(date=>getDailyRecord(date)));
      return sortDailyRecordsAsc(records).filter(record=>record.recordKind==='study');
    }
  }
  return (await getSortedDailyRecords()).filter(record=>record.recordKind==='study');
}
async function getDailyRecord(date,options={}){
  const fallback=fallbackDailyRecordsGet(options).find(r=>r.date===date)||null;
  try{
    const record=newerDailyRecord(readableDailyRecord(await idbGetRecord(date)),fallback);
    if(fallback)migrateFallbackDailyRecords([fallback]);
    else confirmDailyRecordStorage();
    const value=pendingDeletionShadowsEntity('dailyRecord',date,record)?null:materializeDailyRecordView(record);
    if(options.strict&&LocalStorageContract.lastError)throw LocalStorageContract.lastError;
    return value;
  }catch(e){
    if(options.strict||isCanonicalRuntimeError(e))throw e;
    showStorageFallbackWarning(e&&e.message?e.message:'saved-date database failed');
    return materializeDailyRecordView(fallback);
  }
}
async function getDailyRecords(options={}){
  const fallback=fallbackDailyRecordsGet(options);
  try{
    const raw=filterPendingDeletedEntities(mergeDailyRecordSets(await idbAllRecords(),fallback),'dailyRecord','date');
    if(options.strict&&LocalStorageContract.lastError)throw LocalStorageContract.lastError;
    if(fallback.length)migrateFallbackDailyRecords(fallback);
    else confirmDailyRecordStorage();
    return raw.map(materializeDailyRecordView).filter(Boolean);
  }catch(e){if(options?.strict||isCanonicalRuntimeError(e))throw e;showStorageFallbackWarning(e&&e.message?e.message:'saved-date database failed');return fallback.map(materializeDailyRecordView).filter(Boolean);}
}
async function removeDailyRecord(date,options={}){
  const rollback=options&&options.rollback===true;
  const ownershipToken=issueWriteToken('deleting the daily record');
  const finishWrite=beginAuthoritativeWrite();
  let removed=false;
  try{
    const fallbackBefore=fallbackDailyRecordsRawGet(),fallbackHadRecord=fallbackBefore.some(record=>record.date===date);
    const deletedAt=new Date().toISOString(),recoveryKey=deletionRecoveryKey('dailyRecord',date);
    const staged=rollback?false:stageDeletionRecovery('dailyRecord',date,deletedAt);
    try{
      assertWriteToken(ownershipToken,'the daily-record deletion');
      if(!staged){
        if(!fallbackDailyRecordsSet(fallbackBefore.filter(record=>record.date!==date)))throw LocalStorageContract.lastError||new Error('DailyRecord fallback could not be cleared and no durable deletion marker could be established.');
        assertWriteToken(ownershipToken,'the daily-record IndexedDB deletion');
      }
      const result=await idbDelete(date,{trackDeletion:!rollback,ownershipToken,deletedAt});
      assertWriteToken(ownershipToken,'the daily-record fallback cleanup');
      const fallbackCleared=staged?fallbackDailyRecordsSet(fallbackDailyRecordsRawGet().filter(r=>r.date!==date)):true;
      if(!fallbackCleared&&!staged)throw LocalStorageContract.lastError||new Error('DailyRecord fallback cleanup failed.');
      if(!rollback&&fallbackCleared)clearDeletionRecoveryKeys([recoveryKey]);
      confirmDailyRecordStorage();
      if(!rollback)reportCanonicalCommit('dailyRecord','delete');
      if(fallbackHadRecord&&!(result&&result.changed))InsightsDatasetRevision.invalidateVolatile('fallback-daily-record-delete');
      removed=true;
    }catch(e){
      if(isOwnershipLostError(e))throw e;
      if(rollback||!staged)throw e;
      assertWriteToken(ownershipToken,'the daily-record fallback deletion');
      showStorageFallbackWarning(e&&e.message?e.message:'saved-date database failed');
      if(!fallbackDailyRecordsSet(fallbackDailyRecordsRawGet().filter(r=>r.date!==date))){
        removed=true;
        return;
      }
      if(fallbackHadRecord)InsightsDatasetRevision.invalidateVolatile('fallback-daily-record-delete');
      removed=true;
    }finally{if(removed&&isValidIsoDate(date))notifyDailyRecordsChanged(date,'remove');}
  }finally{finishWrite();}
}
async function clearAllDailyRecords(){
  const ownershipToken=issueWriteToken('clearing Saved Dates / Reflections');
  const finishWrite=beginAuthoritativeWrite();
  try{
    const fallback=fallbackDailyRecordsGet();
    if(fallback.length)await migrateFallbackDailyRecords(fallback);
    if(fallbackDailyRecordsGet().length)throw new Error('Saved-date fallback records could not be moved into IndexedDB. Nothing was deleted. Export a backup and retry after browser storage recovers.');
    assertWriteToken(ownershipToken,'the atomic Library clear');
    const result=await idbStrictTransaction([DB_DAILY_RECORD_STORE,DB_DAILY_SUMMARY_STORE,DB_APP_META_STORE],'readwrite',(tx,finish)=>{
      assertWriteToken(ownershipToken,'the atomic Library clear transaction');
      const records=tx.objectStore(DB_DAILY_RECORD_STORE),summaries=tx.objectStore(DB_DAILY_SUMMARY_STORE),meta=Meta.view(tx);
      const request=typeof records.getAllKeys==='function'?records.getAllKeys():records.openKeyCursor();
      const dates=[];let revisionState=null;
      request.onerror=()=>finish(false,request.error||new Error('Saved-date key read failed'));
      request.onsuccess=event=>{
        if(typeof records.getAllKeys!=='function'){
          const cursor=event.target.result;if(cursor){dates.push(String(cursor.key));cursor.continue();return;}
        }else dates.push(...(request.result||[]).map(String));
        records.clear();summaries.clear();
        if(dates.length)stageCanonicalMutationEpoch(tx,[...new Set(dates.map(dailyPreparationUnit))]);
        const deletedAt=new Date().toISOString();dates.forEach(date=>{const deletion=savedDayDeletionValue(date,deletedAt);meta.put('savedDayDeletionPrefix',deletion,{suffix:date,updatedAt:deletedAt});});
        if(dates.length)revisionState=InsightsDatasetRevision.stage(tx,'daily-record-clear');
      };
      tx.oncomplete=()=>{InsightsDatasetRevision.committed(revisionState);finish(true,freeze({count:dates.length,dates:freeze(dates.slice())}));};
    },'atomic Library clear aborted');
    clearDeletionRecoveryKeys(result.dates.map(date=>deletionRecoveryKey('dailyRecord',date)));
    if(result.count){reportCanonicalCommit('dailyRecord','delete');notifyDailyRecordsChanged('','clear');}
    confirmDailyRecordStorage();return result;
  }finally{finishWrite();}
}

const AreaNotesRepository=AreaNotesRepositoryModule.create(freeze({
      configuration:freeze({
        limits:APP_LIMITS,dataContract:DATA_CONTRACT,
        stores:freeze({areaNotes:DB_AREA_NOTES_STORE,appMeta:DB_APP_META_STORE}),
        keys:freeze({areaNoteRescue:STORAGE_KEYS.areaNoteRescue}),legacyKeys:freeze({areaNotesPending:LEGACY_STORAGE_KEYS.areaNotesPending}),
        metaKeys:freeze({areaNoteRecoveryPrefix:META_KEYS.areaNoteRecoveryPrefix})
      }),
      storage:freeze({local:LocalStorageContract,meta:Meta,idbGetAll,idbStoreTransaction,idbStrictTransaction}),
      codecs:freeze({compatibility:CompatibilityCodec,sanitizeCurrentAreaNote}),keyedRecord:KeyedRecord,
      helpers:freeze({clampText,clampEditorContent,editorContentWithinLimits,wipeObject,normalizeAreaName,displayAreaName,normalizeTimestamp,sameDataValue,jsonByteLength,canonicalRuntimeError,isCanonicalRuntimeError}),
      hooks:freeze({
        canMutate:appCanMutate,assertWriteToken,compatibilityWriteToken,storageOk:markStorageHealthOk,reportCommit:reportCanonicalCommit,
        onNotesChanged:refreshAreaNoteConsumers,onNoteSyncState:setNoteSyncStateForKey,onNoteConflict:reportAreaNoteConflict,saveWarning:showSubjectNoteSaveWarning,
        diagnosticsCapture:(scope,error,level)=>AppDiagnostics.capture(scope,error,level)
      }),
      canonical:freeze({areaNoteDeletionValue,areaNotePreparationUnit,stageMutationEpoch:stageCanonicalMutationEpoch,normalizeAreaNoteDeletions}),
      clock:freeze({nowMs:decisionNowMs})
    }));
function normalizeInsightsRecordWindowOptions(options,summaries){
  const opts=options&&typeof options==='object'?options:{};
  const limit=Number.isFinite(Number(opts.limit))?Math.max(0,Math.floor(Number(opts.limit))):0;
  const windowDays=Number.isFinite(Number(opts.windowDays))?Math.max(0,Math.floor(Number(opts.windowDays))):0;
  const fromDay=isValidIsoDate(opts.from)?isoDateDay(opts.from):null;
  const toDay=isValidIsoDate(opts.to)?isoDateDay(opts.to):null;
  let dates=(summaries||[]).filter(s=>!s||s.recordKind===undefined||s.recordKind==='study').map(s=>s&&s.date).filter(isValidIsoDate).sort((a,b)=>a.localeCompare(b));
  if(toDay!==null)dates=dates.filter(date=>isoDateDay(date)<=toDay);
  if(fromDay!==null)dates=dates.filter(date=>isoDateDay(date)>=fromDay);
  if(windowDays>0&&dates.length){
    const endDay=toDay!==null?toDay:isoDateDay(dates[dates.length-1]);
    const startDay=endDay-windowDays+1;
    dates=dates.filter(date=>isoDateDay(date)>=startDay&&isoDateDay(date)<=endDay);
  }
  if(limit>0)dates=dates.slice(-limit);
  return {dates};
}
const DATA_MAINTENANCE_INTERVAL_MS=24*60*60*1000;
let dataMaintenancePromise=null;
async function runDataMaintenance(options={}){
  const force=!!(options&&options.force);
  if(!appCanMutate())return {status:'skipped',reason:'not-primary'};
  if(!IndexedDb.isAvailable())return {status:'skipped',reason:'indexeddb-unavailable'};
  if(dataMaintenancePromise)return dataMaintenancePromise;
  dataMaintenancePromise=(async()=>{
    const ownershipRevision=getOwnershipRevision();
    const requireSameOwner=()=>{
      options.check?.();
      if(!appCanMutate()||getOwnershipRevision()!==ownershipRevision)throw new Error('Data maintenance stopped because app ownership changed');
    };
    requireSameOwner();const previous=await Meta.read('dataMaintenance');
    const lastRun=Date.parse(previous&&previous.completedAt||'');
    const maintenanceCurrent=Number(previous&&previous.version)===DATA_MAINTENANCE_VERSION&&previous.status==='completed';
    if(!force&&maintenanceCurrent&&Number.isFinite(lastRun)&&decisionNowMs()-lastRun<DATA_MAINTENANCE_INTERVAL_MS){
      return {status:'skipped',reason:'recent',lastRun:new Date(lastRun).toISOString()};
    }
    requireSameOwner();
    await Meta.write('dataMaintenance',{version:DATA_MAINTENANCE_VERSION,status:'pending',completedAt:Number.isFinite(lastRun)?new Date(lastRun).toISOString():''},{strict:true,abortMessage:'data maintenance intent write aborted'});
    requireSameOwner();
    const fallback=fallbackDailyRecordsGet();
    if(LocalStorageContract.lastError)throw LocalStorageContract.lastError;
    if(fallback.length)await migrateFallbackDailyRecords(fallback,{strict:true});
    requireSameOwner();
    if(await AreaNotesRepository.load({strict:true})!==true)throw new Error('Ongoing Notes could not be loaded for maintenance.');
    requireSameOwner();await AreaNotesRepository.flush({strict:true});
    requireSameOwner();const rawRecovery=LocalStorageContract.getJson(STORAGE_KEYS.recovery,null);
    if(LocalStorageContract.lastError)throw LocalStorageContract.lastError;
    if(rawRecovery&&!sessionFromRecoveryEnvelope(rawRecovery)&&!LocalStorageContract.remove(STORAGE_KEYS.recovery))throw LocalStorageContract.lastError||new Error('Invalid session recovery could not be removed.');
    requireSameOwner();const session=await loadActiveSessionRecord(0,{strict:true});
    if(!session?.ok||session.error)throw session?.error||new Error('Active Session reconciliation is incomplete.');
    requireSameOwner();
    if(await flushDeletionRecovery()!==true)throw new Error('Pending deletion recovery is incomplete.');
    requireSameOwner();const report={version:DATA_MAINTENANCE_VERSION,status:'completed',completedAt:new Date().toISOString()};
    await Meta.write('dataMaintenance',report,{updatedAt:report.completedAt,strict:true,abortMessage:'data maintenance metadata write aborted'});
    markStorageHealthOk('maintenance');
    return report;
  })().catch(error=>{
    if(error?.code==='DATA_MAINTENANCE_YIELDED')return {status:'yielded',reason:error.reason};
    if(error&&error.message==='Data maintenance stopped because app ownership changed')return {status:'skipped',reason:'ownership-changed'};
    AppDiagnostics.capture('maintenance.run',error,'error');
    markStorageHealthError('maintenance',`Data maintenance failed: ${error&&error.message||'data maintenance failed'}`);
    return {status:'failed',reason:error&&error.message||String(error)};
  }).finally(()=>{dataMaintenancePromise=null;});
  return dataMaintenancePromise;
}


    async function getDailyRecordDocumentsByDates(dates,options={}){
      const requested=[...new Set((dates||[]).filter(isValidIsoDate))];
      const fallback=fallbackDailyRecordsGet().filter(record=>requested.includes(record.date));
      try{
              return filterPendingDeletedEntities(
          mergeDailyRecordSets(await idbGetRecordsByDates(requested),fallback),
          'dailyRecord','date'
        );
      }catch(error){if(isCanonicalRuntimeError(error)||options&&options.requireCanonical===true)throw error;return fallback;}
    }
    async function getBackupDailyRecordMonth(month,options={}){
      const key=String(month||'');if(!/^\d{4}-(?:0[1-9]|1[0-2])$/u.test(key))throw new TypeError('Saved-Day backup month is invalid.');
      const fallback=fallbackDailyRecordsGet().filter(record=>String(record&&record.date||'').startsWith(key+'-'));
      try{
        const rows=filterPendingDeletedEntities(mergeDailyRecordSets(await idbGetRecordsByMonth(key),fallback),'dailyRecord','date');
        return currentDailyRecordDocuments(rows,'Backup Daily Records').sort((a,b)=>a.date.localeCompare(b.date));
      }catch(error){
        if(isCanonicalRuntimeError(error))throw error;
        if(options&&options.requireCanonical===true)throw new Error('Saved-date IndexedDB could not be read completely. Managed backup publication was stopped so an incomplete rescue snapshot cannot become a normal checkpoint.',{cause:error});
        if(!fallback.length)throw error;
        return currentDailyRecordDocuments(fallback,'Backup fallback Daily Records').sort((a,b)=>a.date.localeCompare(b.date));
      }
    }
    async function storeImportedDailyRecordBatches(records,options={}){
      if(!records.length)return {committed:0,batches:0};
      const ownershipToken=issueWriteToken('importing daily records');
      const finishWrite=beginAuthoritativeWrite();
      const onProgress=typeof options.onProgress==='function'?options.onProgress:()=>{};
      const signal=options.signal||null,yieldControl=typeof options.yieldControl==='function'?options.yieldControl:async()=>{};
      const checkCancelled=()=>{if(signal&&signal.aborted){const reason=signal.reason;const error=reason instanceof Error?reason:new Error(String(reason||'Backup import was cancelled.'));if(!error.code)error.code='STUDY_DIRECTOR_IMPORT_CANCELLED';throw error;}};
      try{
      checkCancelled();
          assertWriteToken(ownershipToken,'the imported daily-record baseline check');
      let committed=0,batches=0;
      try{
        for(let offset=0;offset<records.length;offset+=APP_LIMITS.backupImportBatchSize){
          checkCancelled();
          const batch=records.slice(offset,offset+APP_LIMITS.backupImportBatchSize);
          assertWriteToken(ownershipToken,'the imported daily-record batch');
          await idbPutDailyRecordBatch(batch,{ownershipToken});
          assertWriteToken(ownershipToken,'the imported daily-record batch cleanup');
          clearDeletionRecoveryKeys(batch.map(doc=>deletionRecoveryKey('dailyRecord',doc.date)));
          const savedDates=new Set(batch.map(doc=>doc.date));
          fallbackDailyRecordsSet(fallbackDailyRecordsGet().filter(record=>!savedDates.has(record.date)));
          committed+=batch.length;batches++;
          onProgress(freeze({committed,total:records.length,batches}));
          await yieldControl();checkCancelled();
        }
        if(committed)reportCanonicalCommit('dailyRecord','upsert');
        notifyDailyRecordsChanged('','import');
        return {committed,batches};
      }catch(error){
        if(isOwnershipLostError(error))throw error;
        const failure=new Error(`Import stopped after ${committed} daily record${committed===1?'':'s'} were committed in ${batches} complete batch${batches===1?'':'es'}. The failed batch was rolled back. Keep the backup and retry after storage recovers.`);
        failure.cause=error;
        if(error&&error.code)failure.code=error.code;
        if(error&&error.name)failure.name=error.name;
        failure.committedRecords=committed;
        failure.committedBatches=batches;
        throw failure;
      }
      }finally{finishWrite();}
    }
    async function getBackupDailyRecordDates(){
      const fallbackDates=fallbackDailyRecordsGet().map(record=>record.date).filter(isValidIsoDate);
      let idbDates=[],warning='',canonical=true;
      try{
              idbDates=await idbStoreTransaction(DB_DAILY_RECORD_STORE,'readonly',(store,tx,finish)=>{
          if(typeof store.getAllKeys==='function'){
            const req=store.getAllKeys();
            req.onsuccess=()=>finish(true,(req.result||[]).map(String));
            req.onerror=()=>finish(false,req.error);
            return;
          }
          const out=[],req=store.openKeyCursor();
          req.onsuccess=event=>{
            const cursor=event.target.result;
            if(!cursor)return finish(true,out);
            out.push(String(cursor.key));
            cursor.continue();
          };
          req.onerror=()=>finish(false,req.error);
        },'backup record-key read aborted');
      }catch(error){
        if(!fallbackDates.length)throw new Error('Saved-date storage could not be read. No backup was exported; retry after browser storage recovers.');
        canonical=false;warning='Saved-date IndexedDB was unavailable, so this backup contains only the emergency fallback records currently accessible in localStorage.';
      }
      if(canonical&&fallbackDates.length){
        canonical=false;
        warning='Saved-date storage contains emergency fallback records that have not yet been reconciled into canonical IndexedDB storage. This standalone backup includes them as rescue data; managed checkpoints remain blocked until canonical storage recovers.';
      }
      const pending=pendingDeletionEntryMap();
      const dates=[...new Set([...idbDates,...fallbackDates])].filter(isValidIsoDate).filter(date=>!pending.has(deletionRecoveryKey('dailyRecord',date))).sort();
      return {dates,warning,canonical};
    }
    async function datasetRevision(){
      if(fallbackDailyRecordsGet().length||pendingDeletionEntries().some(entry=>entry.kind==='dailyRecord'))return null;
      return InsightsDatasetRevision.get();
    }
    function settledActiveSessionWrites(){
      return settledAuthoritativeWrites();
    }

    const local=LocalStorageContract;
    const dailyRecords=freeze({
      save:storeDailyRecord,
      saveBatch:storeDailyRecordBatch,
      restoreBatch:records=>storeDailyRecordBatch(records),
      get:getDailyRecord,
      list:getDailyRecords,
      summaries:getDailyRecordSummaries,
      remove:removeDailyRecord,
      clearAll:clearAllDailyRecords,
      sortedSummaries:getSortedDailyRecordSummaries,
      sortedList:getSortedDailyRecords,
      'window':getDailyRecordsForWindow,
      normalizeWindow:normalizeInsightsRecordWindowOptions,
      documents:getDailyRecordDocumentsByDates,
      backupMonth:getBackupDailyRecordMonth,
      importBatches:storeImportedDailyRecordBatches,
      backupDates:getBackupDailyRecordDates,
      timestamp:dailyRecordTimestamp,
      datasetRevision
    });
    const notes=freeze({
      get:AreaNotesRepository.get,
      update:AreaNotesRepository.update,
      updateValidatedRich:AreaNotesRepository.updateValidatedRich,
      remove:AreaNotesRepository.remove,
      clearAll:AreaNotesRepository.clearAll,
      load:AreaNotesRepository.load,
      reloadFresh:AreaNotesRepository.reloadFresh,
      readFreshPayload:AreaNotesRepository.readFreshPayload,
      readFreshItems:AreaNotesRepository.readFreshItems,
      failure:AreaNotesRepository.failure,
      exportPayload:AreaNotesRepository.exportPayload,
      metadataSnapshot:AreaNotesRepository.metadataSnapshot,
      searchSnapshot:AreaNotesRepository.searchSnapshot,
      normalizePayload:AreaNotesRepository.normalizePayload,
      replace:AreaNotesRepository.replace,
      merge:AreaNotesRepository.merge,
      reconcile:AreaNotesRepository.reconcile,
      applyDeletes:AreaNotesRepository.applyDeletes,
      size:AreaNotesRepository.size,
      flush:AreaNotesRepository.flush
    });
    const activeSession=freeze({
      save:saveActiveSessionRecord,
      load:loadActiveSessionRecord,
      clear:clearActiveSessionRecord,
      readLocal:readLocalRecoverySession,
      nextRevision:nextSessionRevision,
      observeRevision:observeSessionRevision,
      settled:settledActiveSessionWrites
    });
    const provenance=freeze({installationId:getInstallationId});
    function canonicalMutationEpochEligible(){
      try{
        if(fallbackDailyRecordsGet().length||pendingDeletionEntries().length)return false;
        const noteFailure=AreaNotesRepository.failure();
        return !(noteFailure&&noteFailure.failed);
      }catch(error){capture('canonical-mutation-epoch.eligibility',error,'warn');return false;}
    }
    const mutationEpoch=freeze({
      read:readCanonicalMutationEpoch,
      reseed:reseedCanonicalMutationEpoch,
      rebasePreparation:rebaseBackupPreparationState,
      stage:stageCanonicalMutationEpoch,
      eligible:canonicalMutationEpochEligible
    });
    const preparationUnits=freeze({list:listBackupPreparationUnits,replace:replaceBackupPreparationUnits});
    const deletionRecovery=freeze({
      pending:pendingDeletionEntries,
      flush:flushDeletionRecovery,
      savedDays:listSavedDayDeletions,
      replaceSavedDays:replaceSavedDayDeletions,
      areaNotes:listAreaNoteDeletions,
      replaceAreaNotes:replaceAreaNoteDeletions,
      attachments:listAttachmentDeletions,
      replaceAttachments:replaceAttachmentDeletions,
      recordAttachment:recordAttachmentDeletion,
      clearAttachment:clearAttachmentDeletion,
      stageAttachments:stageAttachmentDeletionState,
      verify:verifyDeletionState
    });
    const maintenanceApi=freeze({status:()=>freeze({busy:!!dataMaintenancePromise}),run:runDataMaintenance,repairSummaries:repairDailySummaries,settled:()=>dataMaintenancePromise||Promise.resolve()});

    async function verifyCurrentRepositoryMetadata(){
      const issues=[],families=['planDraft','planLibrary','personalPreferences','canonicalMutationEpoch','insightsDatasetRevision','dataMaintenance'];let rows=0;
      const results=await Promise.allSettled([CompatibilityMeta.readEntry('dailyRecordMigration'),...families.map(name=>Meta.readEntry(name)),Meta.list('backupPreparationUnitPrefix')]);
      results.forEach((result,index)=>{
        const family=index===0?'dailyRecordMigration':index===results.length-1?'backupPreparationUnitPrefix':families[index-1];
        if(result.status==='rejected')issues.push(`${family}:${String(result.reason&&result.reason.message||result.reason)}`);
        else if(index===results.length-1)rows+=Array.isArray(result.value)?result.value.length:0;
        else if(result.value)rows++;
      });
      const recoveryProof=await AreaNotesRepository.verifyCurrentRecovery();
      if(!recoveryProof?.ok)for(const issue of recoveryProof?.issues||[])issues.push(issue);
      return freeze({ok:issues.length===0,issues:freeze(issues),rows:rows+Number(recoveryProof?.rows||0)});
    }
    const metadata=freeze({verifyCurrent:verifyCurrentRepositoryMetadata,diagnostics:async()=>{
      const maintenance=await Meta.read('dataMaintenance'),deletions=pendingDeletionEntries();if(LocalStorageContract.lastError)throw LocalStorageContract.lastError;
      const localRecovery=LocalStorageContract.getText(STORAGE_KEYS.recovery,null)!==null;if(LocalStorageContract.lastError)throw LocalStorageContract.lastError;
      return freeze({maintenanceStatus:maintenance?.status||'never',completedAt:maintenance?.completedAt||'',deletions:deletions.length,localRecovery});
    }});
    const compatibility=freeze({
      migrateDailyRecords:migrateHistoricalDailyRecords,
      migrateActiveSession:migrateHistoricalActiveSession,
      migrateAreaNotes:()=>AreaNotesRepository.migrateHistoricalCanonicalRows(),
      migrateAreaNoteRecovery:()=>AreaNotesRepository.migrateLegacyRecovery(),
      migrateDeletionState:migrateLegacyDeletionState,
      cleanupObsoleteMetadata:removeObsoleteMetadata,
      verifyDailyRecords:verifyDailyRecordCanonicalBaseline,
      verifyActiveSession:verifyHistoricalActiveSession,
      verifyAreaNotes:async()=>{
        const issues=[];
        for(const row of await idbGetAll(DB_AREA_NOTES_STORE,'Area Note canonical baseline verification aborted')){
          const clean=sanitizeCurrentAreaNote(row,row&&row.key);if(!clean||!sameDataValue(row,clean))issues.push(`area-note:${String(row&&row.key||'?')}`);
        }
        return freeze({ok:issues.length===0,issues:freeze(issues)});
      },
      migrateInsightsRevisionEnvelope:()=>InsightsDatasetRevision.migrateLegacyEnvelope(),
      verifyInsightsRevisionEnvelope:()=>InsightsDatasetRevision.verifyCanonicalEnvelope(),
      verifyDeletionState,
      verifyAreaNoteRecovery:async()=>{
        const proof=await AreaNotesRepository.verifyCurrentRecovery(),issues=[...(proof.issues||[])];
        if(LocalStorageContract.getText(LEGACY_STORAGE_KEYS.areaNotesPending,null)!==null)issues.push('legacy-area-note-recovery-source');
        return freeze({ok:issues.length===0,rows:Number(proof.rows||0),issues:freeze(issues)});
      },
      verifyObsoleteMetadata:async()=>{
        const rows=await rawLegacyMetaList(),present=[];
        for(const identity of OBSOLETE_META_KEYS){
          if(String(identity).endsWith(':')){for(const row of rows||[])if(String(row&&row.key||'').startsWith(identity))present.push(String(row.key));}
          else if(await rawLegacyMetaGet(identity))present.push(String(identity));
        }
        return freeze({ok:present.length===0,present:freeze(present)});
      }
    });
    const restoreJournal=RepositoryJournals.restoreJournal;
    const libraryClearJournal=RepositoryJournals.libraryClearJournal;
    const mutationLease=RepositoryJournals.mutationLease;
    return freeze({
      format:'study-director.app-data',
      contractVersion:1,
      get lastStorageError(){return LocalStorageContract.lastError;},
      local,planData,personalPreferences,dailyRecords,notes,activeSession,provenance,mutationEpoch,preparationUnits,deletionRecovery,restoreJournal,libraryClearJournal,mutationLease,maintenance:maintenanceApi,metadata,compatibility
    });
  }
  return freeze({
    format:'study-director.repositories',
    contractVersion:1,
    createAppMetaValidators,
    createAppData
  });
});
})();
