import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {MetaValidator,MetaEntry} from '../../types/app-meta.ts';
import type {DbTransaction} from '../../types/persistence.ts';
import type {WriteToken} from '../../types/ownership.ts';
import type {DailyRecord,ActiveSession,SavedPlans,PendingReview,PersonalData} from '../../types/record-models.ts';
import type {RepositoriesInput,ValidatorInput,RepositoryMetadata,MetadataFields,SessionResult,RecoveryEnvelope,DeletionEntry,DayDeletion,NoteDeletion,AttachmentDeletion,WriteOptions,BatchOptions,RevisionValue,RevisionState,MaintenanceOptions,MaintenanceResult,WindowOptions,ImportOptions,CanonicalReadOptions,DailyView,DailySummary,SummaryView,PortablePreferences} from '../../types/repositories.ts';
type RawFields=MetadataFields&Partial<Record<'kind'|'id'|'entries'|'shell'|'snapshot'|'revision'|'type'|'scheduleText'|'runningOn'|'suspendedAt'|'savedAt'|'entityType'|'entityId'|'schemaVersion'|'deviceId'|'createdAt'|'deleted'|'syncStatus'|'dayOfWeek'|'dayName',unknown>>;
// Inspection only: properties stay unknown until the existing validators accept them.
const repositoryFields=(value:unknown)=>value as RawFields|null|undefined;
const sdRepositoriesFactory=(()=>{
'use strict';
const registry=(globalThis as unknown as Record<symbol,unknown>)[Symbol.for('studyDirector.internalModules.v1')] as ModuleRegistration<'repositories','study-director.repositories'>|undefined;
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,functionPort:functions}=registry.contracts;
const createModule=()=>{
  const freeze=Object.freeze;
  const DATA_MAINTENANCE_VERSION=6;
  function exactValue(value:unknown,keys:readonly string[]):value is RawFields{return !!(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|'));}
  function createAppMetaValidators(input:ValidatorInput):Readonly<Record<keyof RepositoryMetadata,MetaValidator>>{
    exactObject(input,['limits','dataContract','personalDataCodec','pendingReviewCodec','helpers'],'Repository appMeta validators input');
    if(!Object.isFrozen(input.limits)||!Object.isFrozen(input.dataContract)||!Object.isFrozen(input.personalDataCodec)||!Object.isFrozen(input.pendingReviewCodec)||!Object.isFrozen(input.helpers))throw new TypeError('Repository appMeta validator contracts must be frozen.');
    functions(input.helpers,['isValidIsoDate','isNoteId','isNoteKey','normalizeTimestamp','sameDataValue'],'Repository appMeta validator helpers');
    const APP_LIMITS=input.limits,DATA_CONTRACT=input.dataContract,PersonalDataCodec=input.personalDataCodec,PendingReviewCodec=input.pendingReviewCodec;
    const {isValidIsoDate,isNoteId,isNoteKey,normalizeTimestamp,sameDataValue}=input.helpers;
    const validIso=(value:unknown)=>Number.isFinite(Date.parse(String(value||'')));
    const attachmentId=(value:unknown)=>/^(?:att|img)-[a-z0-9-]{20,80}$/u.test(String(value||''));
    const backupPreparationUnit=(value:unknown)=>{const unit=String(value||'');if(unit==='*'||unit==='personalData'||unit==='activeSession')return true;if(/^dailyRecordPack:\d{4}-(?:0[1-9]|1[0-2])$/u.test(unit))return true;if(unit.startsWith('note:'))return isNoteKey(unit.slice('note:'.length));if(unit.startsWith('pendingReview:'))return /^pr_[a-f0-9]{32}$/u.test(unit.slice('pendingReview:'.length));if(unit.startsWith('attachmentAsset:'))return attachmentId(unit.slice('attachmentAsset:'.length));return false;};
    return freeze({
      planDraft:value=>value===null||(typeof value==='string'&&value.length<=APP_LIMITS.maxScheduleChars),
      planLibrary:value=>{if(!exactValue(value,['savedPlans','defaultId']))return false;try{const clean=PersonalDataCodec.plans({draft:null,savedPlans:value.savedPlans,defaultId:value.defaultId});return sameDataValue(value,{savedPlans:clean.savedPlans,defaultId:clean.defaultId});}catch{return false;}},
      personalPreferences:value=>!!PersonalDataCodec.currentPortablePreferences(value),
      canonicalMutationEpoch:value=>!!(exactValue(value,['format','version','token','committedAt'])&&value.format==='study-director.canonical-mutation-epoch'&&Number(value.version)===1&&/^[a-f0-9]{32}$/u.test(String(value.token||''))&&validIso(value.committedAt)),
      backupPreparationUnitPrefix:(value,context)=>!!(exactValue(value,['format','version','unit','token','updatedAt'])&&value.format==='study-director.backup-preparation-unit'&&Number(value.version)===1&&backupPreparationUnit(value.unit)&&context.suffix===encodeURIComponent(String(value.unit))&&/^[a-f0-9]{32}$/u.test(String(value.token||''))&&validIso(value.updatedAt)),
      insightsDatasetRevision:value=>!!(exactValue(value,['format','version','counter','updatedAt'])&&value.format==='study-director.insights-dataset-revision'&&Number(value.version)===2&&Number.isSafeInteger(Number(value.counter))&&Number(value.counter)>=1&&validIso(value.updatedAt)),
      dataMaintenance:value=>!!(exactValue(value,['version','status','completedAt'])&&Number(value.version)===DATA_MAINTENANCE_VERSION&&(value.status==='completed'&&validIso(value.completedAt)||value.status==='pending'&&(value.completedAt===''||validIso(value.completedAt)))),
      savedDayDeletionPrefix:(value,context)=>!!(exactValue(value,['format','version','date','deletedAt'])&&value.format==='study-director.saved-day-deletion'&&Number(value.version)===1&&isValidIsoDate(String(value.date||''))&&String(value.date)===context.suffix&&!!normalizeTimestamp(value.deletedAt,null)),
      noteDeletionPrefix:(value,context)=>!!(exactValue(value,['format','version','key','deletedAt'])&&value.format==='study-director.note-deletion'&&Number(value.version)===1&&isNoteId(value.key)&&value.key===context.suffix&&!!normalizeTimestamp(value.deletedAt,null)),
      attachmentDeletionPrefix:(value,context)=>!!(exactValue(value,['format','version','assetId','deletedAt'])&&value.format==='study-director.attachment-deletion'&&Number(value.version)===1&&attachmentId(value.assetId)&&String(value.assetId)===context.suffix&&!!normalizeTimestamp(value.deletedAt,null)),
      pendingReviewPrefix:(value,context)=>{const clean=PendingReviewCodec.normalize(value);return !!clean&&clean.id===context.suffix&&sameDataValue(clean,value);}
    });
  }
  function createAppData(input:RepositoriesInput){
    exactObject(input,[
      'local','indexedDb','appMeta','installationIdentity','dailyRecordCodec','activeSessionCodec','personalDataCodec','pendingReviewCodec','keyedRecord','journals',
      'limits','dataContract','stores','keys','metaKeys','activeSessionId','helpers','hooks','clock','notesRepositoryModule','saveLaneModule'
    ],'AppData input');
    if(!Object.isFrozen(input.local)||!Object.isFrozen(input.indexedDb)||!Object.isFrozen(input.appMeta)||!Object.isFrozen(input.installationIdentity)||
      !Object.isFrozen(input.dailyRecordCodec)||!Object.isFrozen(input.activeSessionCodec)||!Object.isFrozen(input.personalDataCodec)||!Object.isFrozen(input.pendingReviewCodec)||
      !Object.isFrozen(input.keyedRecord)||!Object.isFrozen(input.journals)||!Object.isFrozen(input.limits)||!Object.isFrozen(input.dataContract)||!Object.isFrozen(input.metaKeys)||!Object.isFrozen(input.clock)){
      throw new TypeError('AppData contracts must be frozen.');
    }
    exactObject(input.stores,[
      'dailyRecords','dailySummaries','notes','activeSessions','appMeta'
    ],'AppData stores');
    exactObject(input.keys,['recovery','fallbackDailyRecords','noteRescue','deletionRecovery'],'AppData storage keys');
    exactObject(input.metaKeys,['planDraft','planLibrary','personalPreferences','canonicalMutationEpoch','insightsDatasetRevision','dataMaintenance','backupPreparationUnitPrefix','savedDayDeletionPrefix','noteDeletionPrefix','attachmentDeletionPrefix','pendingReviewPrefix'],'AppData metadata keys');
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

    const NotesRepositoryModule=input.notesRepositoryModule;
    if(!NotesRepositoryModule||NotesRepositoryModule.format!=='study-director.notes-repository-module'||NotesRepositoryModule.contractVersion!==1||typeof NotesRepositoryModule.create!=='function')throw new TypeError('Notes repository module is invalid.');
    const APP_LIMITS=input.limits;
    const DATA_CONTRACT=input.dataContract;
    const STORAGE_KEYS=input.keys;
    const META_KEYS=input.metaKeys;
    const ACTIVE_SESSION_ID=input.activeSessionId;
    const decisionNowMs=input.clock.nowMs;
    const DB_DAILY_RECORD_STORE=input.stores.dailyRecords;
    const DB_DAILY_SUMMARY_STORE=input.stores.dailySummaries;
    const DB_NOTES_STORE=input.stores.notes;
    const DB_ACTIVE_SESSION_STORE=input.stores.activeSessions;
    const DB_APP_META_STORE=input.stores.appMeta;
    const LocalStorageContract=input.local;
    const IndexedDb=input.indexedDb;
    const Meta=input.appMeta;
    if(Meta.format!=='study-director.app-meta-owner'||Meta.contractVersion!==1||Meta.owner!=='repositories')throw new TypeError('Repository appMeta capability is invalid.');
    // The gateway has already applied createAppMetaValidators before returning
    // these values. This family-keyed bridge cannot claim arbitrary caller types.
    async function readMetadata<K extends keyof RepositoryMetadata>(family:K,suffix?:string):Promise<RepositoryMetadata[K]|null>{return await Meta.read(family,suffix) as RepositoryMetadata[K]|null;}
    const InstallationIdentity=input.installationIdentity;
    if(InstallationIdentity.format!=='study-director.installation-identity'||InstallationIdentity.contractVersion!==4||typeof InstallationIdentity.getId!=='function')throw new TypeError('Installation identity contract is invalid.');
    const DailyRecordCodec=input.dailyRecordCodec,NoteKeys=DailyRecordCodec.noteKeys;
    if(!NoteKeys||!Object.isFrozen(NoteKeys)||typeof NoteKeys.isId!=='function'||typeof NoteKeys.isKey!=='function')throw new TypeError('Note key contract is invalid.');
    const ActiveSessionCodec=input.activeSessionCodec;
    const PersonalDataCodec=input.personalDataCodec;
    const PendingReviewCodec=input.pendingReviewCodec;
    if(PendingReviewCodec.format!=='study-director.pending-review-codec'||PendingReviewCodec.contractVersion!==1)throw new TypeError('Pending-review codec contract is invalid.');
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
      onNotesChanged:refreshNoteConsumers,
      onNoteSyncState:setNoteSyncStateForKey,
      onNoteConflict:reportNoteConflict,
      onDailyRecordsChanged,
      onDatasetRevisionChanged,
      onCanonicalCommit
    }=input.hooks;
    const AppDiagnostics=freeze({capture});

    const getInstallationId=InstallationIdentity.getId;
    const {
      buildDailyRecordSummary,sanitizeCurrentDailyRecord,sanitizeCurrentNote,
      materializeDailyRecordView,storedDailyRecordFields,sanitizeDailyRecordSummary,materializeDailyRecordSummary
    }=DailyRecordCodec;
    const FALLBACK_DAILY_RECORD_LIMIT=14;
    let fallbackDailyRecordsActive=false;
    let fallbackDailyRecordsMessage='';
    let activeSessionWriteChain:Promise<SessionResult|void>=Promise.resolve();
    const pendingAuthoritativeWrites=new Set<Promise<void>>();
    let lastSessionRevision=0;
    let activeSessionMutationEpoch=0;

    function beginAuthoritativeWrite(){
      let finish!:()=>void;
      const pending=new Promise<void>(resolve=>{finish=resolve;});
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

    function markStorageHealthOk(source:string,key=''){onStorageOk(source,key);}
    function markStorageHealthError(source:string,reason:unknown){onStorageError(source,reason);}
    function canonicalRuntimeError(message:string){return Object.assign(new Error(message),{code:'STUDY_DIRECTOR_NONCANONICAL_RUNTIME'});}
    function isCanonicalRuntimeError(error:unknown){return (error as {message?:unknown;code?:unknown;name?:unknown;reason?:unknown}|null|undefined)?.code==='STUDY_DIRECTOR_NONCANONICAL_RUNTIME';}
    // One change clock for every save: the mutation epoch written inside each
    // transaction and the commit notice after it both take its next value, so
    // a later change always has a later time, even if the system clock goes back.
    let changeClockMs=0;
    function nextChangeAt(){changeClockMs=Math.max(Date.now(),changeClockMs+1);return new Date(changeClockMs).toISOString();}
    function seedChangeClock(value:unknown){const ms=Date.parse(String(value||''));if(Number.isFinite(ms))changeClockMs=Math.max(changeClockMs,ms);return changeClockMs?new Date(changeClockMs).toISOString():'';}
    // startup: written during canonical hydration, not by the person
    // or a sync. settingsOnly: personal settings alone, no plans.
    function reportCanonicalCommit(entityType:string,operation:'upsert'|'delete'='upsert',value:unknown=null,{backupCapture=false,startup=false,settingsOnly=false}={}){
      try{
        onCanonicalCommit(freeze({
          format:'study-director.canonical-commit',contractVersion:1,
          entityType:String(entityType||''),operation:operation==='delete'?'delete':'upsert',
          committedAt:nextChangeAt(),value,backupCapture:backupCapture===true,startup:startup===true,settingsOnly:settingsOnly===true
        }));
      }catch(error){capture('repository.canonical-commit-hook',error,'error');}
    }
    function randomCoordinationToken(){
      const bytes=new Uint8Array(16);globalThis.crypto.getRandomValues(bytes);return [...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');
    }
    function newCanonicalMutationEpoch(){
      return freeze({format:'study-director.canonical-mutation-epoch',version:1,token:randomCoordinationToken(),committedAt:nextChangeAt()});
    }
    function canonicalPreparationUnit(value:unknown){
      const unit=String(value||'').trim();if(unit==='*'||unit==='personalData'||unit==='activeSession')return unit;if(/^dailyRecordPack:\d{4}-(?:0[1-9]|1[0-2])$/u.test(unit))return unit;if(unit.startsWith('note:')&&NoteKeys.isKey(unit.slice('note:'.length)))return unit;if(/^pendingReview:pr_[a-f0-9]{32}$/u.test(unit))return unit;if(unit.startsWith('attachmentAsset:')&&/^(?:att|img)-[a-z0-9-]{20,80}$/u.test(unit.slice('attachmentAsset:'.length)))return unit;throw new TypeError('Backup preparation unit identity is invalid.');
    }
    function dailyPreparationUnit(date:unknown){const value=String(date||'');if(!isValidIsoDate(value))throw new TypeError('Backup preparation Saved-Day date is invalid.');return `dailyRecordPack:${value.slice(0,7)}`;}
    function notePreparationUnit(key:unknown){const value=String(key||'');if(!NoteKeys.isKey(value))throw new TypeError('Backup preparation note key is invalid.');return `note:${value}`;}
    function stageBackupPreparationUnits(tx:DbTransaction,units:readonly unknown[]){
      if(!Array.isArray(units)||!units.length)return freeze([]);
      const meta=Meta.view(tx),updatedAt=new Date().toISOString(),seen=new Set(),out=[];
      for(const raw of units){const unit=canonicalPreparationUnit(raw);if(seen.has(unit))continue;seen.add(unit);const value=freeze({format:'study-director.backup-preparation-unit',version:1,unit,token:randomCoordinationToken(),updatedAt});meta.put('backupPreparationUnitPrefix',value,{suffix:encodeURIComponent(unit),updatedAt});out.push(value);}
      return freeze(out);
    }
    function stageCanonicalMutationEpoch(tx:DbTransaction,preparationUnits:readonly unknown[]|null=null){
      const value=newCanonicalMutationEpoch(),request=Meta.view(tx).put('canonicalMutationEpoch',value,{updatedAt:value.committedAt});
      const units=preparationUnits===null?['*']:preparationUnits;stageBackupPreparationUnits(tx,units);
      return freeze({value,request});
    }
    // A reseed invalidates capture fences without changing any data, so it
    // keeps the change time of the last real save.
    async function reseedCanonicalMutationEpoch(){
      const previous=await readCanonicalMutationEpoch().catch(()=>null),kept=Number.isFinite(Date.parse(String(previous&&previous.committedAt||'')))?String(previous?.committedAt||''):'';
      const value=kept?freeze({format:'study-director.canonical-mutation-epoch',version:1,token:randomCoordinationToken(),committedAt:kept}):newCanonicalMutationEpoch();
      await Meta.write('canonicalMutationEpoch',value,{updatedAt:value.committedAt,strict:true,abortMessage:'canonical mutation epoch reseed aborted'});
      return value;
    }
    async function readCanonicalMutationEpoch(){return readMetadata('canonicalMutationEpoch');}
    // The last-save time kept in local storage is a fast copy of the change
    // clock; the epoch written inside each save is the record. This returns the
    // newer of the two and seeds the clock from both, so a copy that missed its
    // last write (the tab closed in between) is repaired after a reload.
    async function latestChangeAt(recorded=''){
      const copy=String(recorded||'');seedChangeClock(copy);
      const epoch=await readCanonicalMutationEpoch(),committedAt=String(epoch&&epoch.committedAt||'');seedChangeClock(committedAt);
      return Date.parse(committedAt)>(Date.parse(copy)||0)?committedAt:copy;
    }
    async function listBackupPreparationUnits(){return freeze((await Meta.list('backupPreparationUnitPrefix')).map(entry=>entry!.value));}
    async function replaceBackupPreparationUnits(units:readonly unknown[]){
      const targets=[...new Set((units||[]).map(canonicalPreparationUnit))];
      return Meta.transaction<readonly ReturnType<typeof stageBackupPreparationUnits>[number][]>('readwrite',(view,tx,finish)=>{
        const handle=view.getAll('backupPreparationUnitPrefix');
        handle.request.onerror=()=>finish(false,handle.request.error||new Error('Backup preparation index metadata read failed.'));
        handle.request.onsuccess=()=>{
          const existing=handle.entries(),updatedAt=new Date().toISOString(),values:ReturnType<typeof stageBackupPreparationUnits>[number][]=[];
          for(const entry of existing)view.remove('backupPreparationUnitPrefix',entry!.suffix);
          for(const unit of targets){const value=freeze({format:'study-director.backup-preparation-unit',version:1,unit,token:randomCoordinationToken(),updatedAt});view.put('backupPreparationUnitPrefix',value,{suffix:encodeURIComponent(unit),updatedAt});values.push(value);}
          tx.oncomplete=()=>finish(true,freeze(values));
        };
      },{strict:true,abortMessage:'Backup preparation index metadata replacement aborted'});
    }
    async function rebaseBackupPreparationState(){
      return Meta.transaction<Readonly<{epoch:ReturnType<typeof newCanonicalMutationEpoch>;stamps:readonly ReturnType<typeof stageBackupPreparationUnits>[number][]}>>('readwrite',(view,tx,finish)=>{
        const handle=view.getAll('backupPreparationUnitPrefix');
        handle.request.onerror=()=>finish(false,handle.request.error||new Error('Backup preparation rebase metadata read failed.'));
        handle.request.onsuccess=()=>{
          const existing=handle.entries(),epoch=newCanonicalMutationEpoch(),updatedAt=epoch.committedAt,unit='*';
          for(const entry of existing)view.remove('backupPreparationUnitPrefix',entry!.suffix);
          view.put('canonicalMutationEpoch',epoch,{updatedAt:epoch.committedAt});
          const stamp=freeze({format:'study-director.backup-preparation-unit',version:1,unit,token:randomCoordinationToken(),updatedAt});
          view.put('backupPreparationUnitPrefix',stamp,{suffix:encodeURIComponent(unit),updatedAt});
          tx.oncomplete=()=>finish(true,freeze({epoch,stamps:freeze([stamp])}));
        };
      },{strict:true,abortMessage:'Backup preparation acceleration rebase aborted'});
    }
    function showStorageFallbackWarning(reason:unknown){
      fallbackDailyRecordsActive=true;
      fallbackDailyRecordsMessage=`Library is using limited fallback storage because IndexedDB is unavailable${reason?`: ${reason}`:''}. Emergency capacity is ${FALLBACK_DAILY_RECORD_LIMIT} records / ${Math.round(APP_LIMITS.fallbackDailyRecordsBytes/(1024*1024))} MB; once full, further saves fail rather than evict unresolved fallback data. Export a backup if this warning persists.`;
      markStorageHealthError('dailyRecords',fallbackDailyRecordsMessage);
    }
    function confirmDailyRecordStorage(){
      try{if(fallbackDailyRecordsGet().length)return false;}
      catch(error){return reportDailyRecordRecoveryFailure(error);}
      fallbackDailyRecordsActive=false;
      fallbackDailyRecordsMessage='';
      markStorageHealthOk('dailyRecords');
      return true;
    }
    function reportDailyRecordRecoveryFailure(error:unknown){
      markStorageHealthError('dailyRecords',`Saved-Day recovery cleanup is pending: ${error&&(error as {message?:unknown;code?:unknown;name?:unknown;reason?:unknown}|null|undefined)?.message||error}`);
      AppDiagnostics.capture('daily-record.recovery-cleanup',error,'warn');return false;
    }
    function showSubjectNoteSaveWarning(reason:unknown){
      if(reason&&typeof reason==='object'&&(reason as {kind?:unknown}).kind==='rescue-capacity'){
        markStorageHealthError('notes',String((reason as {message?:unknown}).message||'An unsaved Note could not fit the emergency browser copy. Keep this tab open until it finishes saving.'));
        return;
      }
      markStorageHealthError('notes',`Notes could not be saved in this browser session${reason?`: ${reason}`:''}. Export a backup before closing this tab.`);
    }
    function notifyDailyRecordsChanged(date:string='',type:string='change'){
      onDailyRecordsChanged(freeze({date:isValidIsoDate(date)?date:'',type:String(type||'change')}));
    }
    function nextSessionRevision(seed=0){
      const base=Math.max(0,Math.floor(Number(seed)||0),lastSessionRevision,decisionNowMs());
      lastSessionRevision=base+1;
      return lastSessionRevision;
    }
    function observeSessionRevision(value:unknown){
      const revision=boundedNumber(value,{min:0,max:Number.MAX_SAFE_INTEGER,fallback:0});
      lastSessionRevision=Math.max(lastSessionRevision,revision);
      return lastSessionRevision;
    }

    function deletionRecoveryKey(kind:unknown,id:unknown){return `${String(kind||'').trim()}:${String(id||'').trim()}`;}
    function readLocalRecoveryJson(key:string,fallback:unknown){
      const value=LocalStorageContract.getJson(key,fallback);
      // A later successful read/write clears lastError. Capture failure before
      // interpreting absence or allowing any recovery read-modify-write.
      if(LocalStorageContract.lastError)throw LocalStorageContract.lastError;
      return value;
    }
    function entityTimestamp(input:unknown,kind:string=''){
      const value=repositoryFields(input);
      if(!value||typeof value!=='object')return 0;
      const raw=value.updatedAt||(kind==='dailyRecord'?value.savedAt:null)||value.deletedAt;
      const parsed=Date.parse(String(raw||''));return Number.isFinite(parsed)?parsed:0;
    }
    function sanitizeDeletionRecoveryEntries(values:unknown){
      const byKey=new Map<string,DeletionEntry>();
      for(const item of (Array.isArray(values)?values:[]) as unknown[]){
        const raw=repositoryFields(item);
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
    function currentDeletionRecoveryEntries(){
      const raw=repositoryFields(readLocalRecoveryJson(STORAGE_KEYS.deletionRecovery,null));
      return sanitizeDeletionRecoveryEntries(raw&&raw.entries);
    }
    function pendingDeletionEntries(){return sanitizeDeletionRecoveryEntries(currentDeletionRecoveryEntries());}
    function pendingDeletionEntryMap(){return new Map(pendingDeletionEntries().map(entry=>[entry.key,entry]));}
    // Clearing or rewriting what is stored keeps the record's own ceiling; only
    // a new entry has to fit in the shared emergency budget.
    function writeDeletionRecoveryEntries(values:unknown,room:number=APP_LIMITS.deletionRecoveryBytes){
      const ordered=sanitizeDeletionRecoveryEntries(values),kept:DeletionEntry[]=[];
      for(let i=ordered.length-1;i>=0;i--){
        const candidate=[ordered[i],...kept],payload={format:'study-director.deletion-recovery',version:1,updatedAt:new Date().toISOString(),entries:candidate};
        if(jsonByteLength(payload)>room)break;
        kept.unshift(ordered[i]!);
      }
      if(kept.length!==ordered.length)return false;
      if(!kept.length)return LocalStorageContract.remove(STORAGE_KEYS.deletionRecovery);
      return LocalStorageContract.setJson(STORAGE_KEYS.deletionRecovery,{format:'study-director.deletion-recovery',version:1,updatedAt:new Date().toISOString(),entries:kept});
    }
    function stageDeletionRecovery(kind:DeletionEntry['kind'],id:string,deletedAt:string=new Date().toISOString()){
      const entries=currentDeletionRecoveryEntries(),next=sanitizeDeletionRecoveryEntries([...entries,{kind,id,deletedAt}]);
      return writeDeletionRecoveryEntries(next,rescueRoom(STORAGE_KEYS.deletionRecovery,APP_LIMITS.deletionRecoveryBytes));
    }
    function clearDeletionRecoveryKeys(keys:readonly string[],expected:readonly DeletionEntry[]|null=null){
      const serviced=expected&&new Map(expected.map(entry=>[entry.key,entry.deletedAt]));
      const remove=new Set((keys||[]).map(String));if(!remove.size)return true;
      try{
        const current=currentDeletionRecoveryEntries();
        return writeDeletionRecoveryEntries(current.filter(entry=>!remove.has(entry.key)||serviced&&serviced.get(entry.key)!==entry.deletedAt));
      }catch(error){markStorageHealthError('deletionRecovery',`Pending deletion recovery could not be read safely: ${error&&(error as {message?:unknown;code?:unknown;name?:unknown;reason?:unknown}|null|undefined)?.message||error}`);return false;}
    }
    function pendingDeletionShadowsEntity(kind:string,id:unknown,value:unknown,entryMap:Map<string,DeletionEntry>|null=null){
      const entry=(entryMap||pendingDeletionEntryMap()).get(deletionRecoveryKey(kind,id));
      return !!(entry&&Date.parse(entry.deletedAt)>=entityTimestamp(value,kind));
    }
    function filterPendingDeletedEntities<T>(values:readonly T[],kind:string,idKey: keyof T|((value:T)=>unknown)){
      const entries=pendingDeletionEntryMap();
      return (values||[]).filter((value:T)=>{const id=typeof idKey==='function'?idKey(value):value&&value[idKey];return id&&!pendingDeletionShadowsEntity(kind,id,value,entries);});
    }
    function savedDayDeletionValue(date:unknown,deletedAt:unknown=new Date().toISOString()){
      const when=normalizeTimestamp(deletedAt,new Date().toISOString());return {format:'study-director.saved-day-deletion',version:1,date:String(date||''),deletedAt:when};
    }
    function noteDeletionValue(key:unknown,deletedAt:unknown=new Date().toISOString()){
      const id=String(key||''),when=normalizeTimestamp(deletedAt,new Date().toISOString());if(!NoteKeys.isId(id))return null;return {format:'study-director.note-deletion',version:1,key:id,deletedAt:when};
    }
    function normalizeAttachmentDeletionId(value:unknown){const id=String(value||'');return /^(?:att|img)-[a-z0-9-]{20,80}$/u.test(id)?id:'';}
    function attachmentDeletionValue(assetId:unknown,deletedAt:unknown=new Date().toISOString()){
      const id=normalizeAttachmentDeletionId(assetId),when=normalizeTimestamp(deletedAt,new Date().toISOString());if(!id)throw new TypeError('Attachment deletion identity is invalid.');return {format:'study-director.attachment-deletion',version:1,assetId:id,deletedAt:when};
    }

// Emergency copies in browser storage share one budget, filled in priority
// order: the live session, unsaved notes, failed deletes, fallback Saved Days.
// Each copy gets what the higher-priority copies leave, up to its own ceiling.
// The budget limits what a copy may add; reading, clearing or rewriting what
// is already stored keeps the copy's own ceiling. An unreadable copy fails
// closed rather than counting as empty.
function rescueRoom(key:string,ceiling:number){
  const order=[STORAGE_KEYS.recovery,STORAGE_KEYS.noteRescue,STORAGE_KEYS.deletionRecovery,STORAGE_KEYS.fallbackDailyRecords],index=order.indexOf(key);
  let used=0;
  for(const other of order.slice(0,Math.max(0,index))){
    const text=LocalStorageContract.getText(other,'');if(LocalStorageContract.lastError)throw LocalStorageContract.lastError;
    used+=new TextEncoder().encode(text||'').byteLength;
  }
  return Math.max(0,Math.min(ceiling,APP_LIMITS.localRescueBytes-used));
}
function capFallbackDailyRecords(records:readonly unknown[],room:number=APP_LIMITS.fallbackDailyRecordsBytes){
  const byDate=new Map<string,DailyRecord>();
  (records||[]).forEach(record=>{
    const clean=sanitizeCurrentDailyRecord(record);
    if(clean)byDate.set(clean.date,clean);
  });
  const ordered=[...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-FALLBACK_DAILY_RECORD_LIMIT);
  while(ordered.length&&jsonByteLength(ordered)>room)ordered.shift();
  return ordered;
}
function activeSessionRecoveryEnvelope(session:ActiveSession|null):RecoveryEnvelope|null{
  if(!session||!session.snapshot)return null;
  const revision=boundedNumber(session['revision'],{min:1,max:Number.MAX_SAFE_INTEGER,fallback:1});
  return {
    version:DATA_CONTRACT.schemas.LocalRecoveryEnvelope.version,revision,
    shell:{id:ACTIVE_SESSION_ID,type:'activeSession',version:DATA_CONTRACT.schemas.ActiveSession.version,revision,date:session.date,status:session.status==='suspended'?'suspended':'active',runningOn:String(session.runningOn||''),scheduleText:session.scheduleText,suspendedAt:session.suspendedAt||null,updatedAt:session.updatedAt||new Date().toISOString()},
    snapshot:session.snapshot,updatedAt:session.updatedAt||new Date().toISOString()
  };
}
function sanitizeCurrentLocalRecoveryEnvelope(input:unknown):RecoveryEnvelope|null{
  const raw=repositoryFields(input);
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.version!==DATA_CONTRACT.schemas.LocalRecoveryEnvelope.version)return null;
  const expected=['version','revision','shell','snapshot','updatedAt'];
  if(Object.keys(raw).sort().join('|')!==expected.sort().join('|'))return null;
  const shell=raw.shell&&typeof raw.shell==='object'&&!Array.isArray(raw.shell)?repositoryFields(raw.shell):null;
  const shellExpected=['id','type','version','revision','date','status','runningOn','scheduleText','suspendedAt','updatedAt'];
  if(!shell||Object.keys(shell).sort().join('|')!==shellExpected.sort().join('|')||shell.id!==ACTIVE_SESSION_ID||shell.type!=='activeSession'||Number(shell.version)!==DATA_CONTRACT.schemas.ActiveSession.version||typeof shell.date!=='string'||typeof shell.scheduleText!=='string'||!isValidIsoDate(shell.date)||!isCanonicalScheduleText(shell.scheduleText)||(shell.status!=='active'&&shell.status!=='suspended'))return null;
  const revision=boundedNumber(raw.revision,{min:1,max:Number.MAX_SAFE_INTEGER,fallback:0});
  if(!revision||Number(shell.revision)!==revision)return null;
  const snapshot=ActiveSessionCodec.sanitizeSessionSnapshot(raw.snapshot,shell.date,activeSessionScheduleFingerprint({date:shell.date,scheduleText:shell.scheduleText}),revision);if(!snapshot)return null;
  const updatedAt=normalizeTimestamp(raw.updatedAt,null);if(!updatedAt||String(shell.updatedAt)!==updatedAt)return null;
  const cleanShell:RecoveryEnvelope['shell']={id:ACTIVE_SESSION_ID,type:'activeSession',version:DATA_CONTRACT.schemas.ActiveSession.version,revision,date:shell.date,status:shell.status,runningOn:String(shell.runningOn||''),scheduleText:shell.scheduleText,suspendedAt:typeof shell.suspendedAt==='string'?shell.suspendedAt:null,updatedAt};
  const clean:RecoveryEnvelope={version:DATA_CONTRACT.schemas.LocalRecoveryEnvelope.version,revision,shell:cleanShell,snapshot,updatedAt};
  return sameDataValue(raw,clean)?clean:null;
}
function sessionFromRecoveryEnvelope(raw:unknown){
  const envelope=sanitizeCurrentLocalRecoveryEnvelope(raw);if(!envelope)return null;
  lastSessionRevision=Math.max(lastSessionRevision,envelope.revision);
  return ActiveSessionCodec.sanitizeCurrent({...envelope.shell,snapshot:envelope.snapshot,revision:envelope.revision,updatedAt:envelope.updatedAt});
}
function localRecoverySession(raw:unknown){
  if(raw===null)return null;
  // A durable logical deletion is authoritative over the stale recovery copy it
  // protects. Do not interpret a payload that is already shadowed for cleanup.
  const shadowed=pendingDeletionShadowsEntity('activeSession',ACTIVE_SESSION_ID,raw);
  if(shadowed)return null;
  const session=sessionFromRecoveryEnvelope(raw);if(!session)throw canonicalRuntimeError('Active Session recovery is not in the current canonical schema.');return session;
}
function readLocalRecoverySession(){return localRecoverySession(readLocalRecoveryJson(STORAGE_KEYS.recovery,null));}
const idbTransaction=IndexedDb.transaction;
const idbStrictTransaction=IndexedDb.strictTransaction;
const idbStoreTransaction=IndexedDb.storeTransaction;
const idbStrictStoreTransaction=IndexedDb.strictStoreTransaction;
const idbGet=IndexedDb.get;
const idbGetAll=IndexedDb.getAll;
const idbGetAllIfPresent=IndexedDb.getAllIfPresent;
const idbHasStore=IndexedDb.hasStore;
function writePlanMeta(family:string,value:unknown,{strictDurability=false,ownershipToken=null,allowHydrating=false,backupCapture=false}:WriteOptions={}){
  const token=ownershipToken||issueWriteToken('save plan documents',{allowHydrating});
  if(new TextEncoder().encode(JSON.stringify(value)).length>1024*1024)throw new RangeError('Plan data exceeds its storage allowance.');
  return Meta.transaction<void>('readwrite',(meta,tx,finish)=>{
    assertWriteToken(token,'save plan documents');stageCanonicalMutationEpoch(tx,['personalData']);const request=meta.put(family,value);request.onerror=()=>finish(false,request.error||new Error('plan document write failed'));
    request.onsuccess=()=>{try{assertWriteToken(token,'save plan documents');}catch(error){try{tx.abort();}catch{}finish(false,error);}};
    tx.oncomplete=()=>{reportCanonicalCommit('planData','upsert',null,{backupCapture,startup:allowHydrating===true,settingsOnly:family==='personalPreferences'});finish(true,undefined);};
  },{strict:strictDurability,abortMessage:'plan document write aborted'});
}
const planData=freeze({
  replace:(value:SavedPlans)=>{
    const token=issueWriteToken('restore Plan documents');if(new TextEncoder().encode(JSON.stringify(value)).length>1024*1024)throw new RangeError('Plan data exceeds its storage allowance.');
    return Meta.transaction<void>('readwrite',(meta,tx,finish)=>{assertWriteToken(token,'restore Plan documents');stageCanonicalMutationEpoch(tx,['personalData']);const updatedAt=new Date().toISOString();meta.put('planDraft',value.draft,{updatedAt});meta.put('planLibrary',{savedPlans:value.savedPlans,defaultId:value.defaultId},{updatedAt});tx.oncomplete=()=>{reportCanonicalCommit('planData','upsert');finish(true,undefined);};},{strict:true,abortMessage:'Plan document restore aborted'});
  },
  // Save the three existing portable Personal Data records in one strict
  // transaction. Neither a failed import nor a kept review can split them.
  replacePortable:(value:PersonalData)=>{
    const token=issueWriteToken('restore portable Plans and Preferences');
    const clean=PersonalDataCodec.normalize(value),now=new Date().toISOString(),
      portable=PersonalDataCodec.portablePreferences({...clean.preferences,version:2,updatedAt:now});
    if(new TextEncoder().encode(JSON.stringify(clean.plans)).length>1024*1024)
      throw new RangeError('Plan data exceeds its storage allowance.');
    return Meta.transaction('readwrite',(meta,tx,finish)=>{
      assertWriteToken(token,'restore portable Plans and Preferences');
      stageCanonicalMutationEpoch(tx,['personalData']);
      meta.put('planDraft',clean.plans.draft,{updatedAt:now});
      meta.put('planLibrary',{savedPlans:clean.plans.savedPlans,defaultId:clean.plans.defaultId},{updatedAt:now});
      meta.put('personalPreferences',portable,{updatedAt:now});
      tx.oncomplete=()=>{reportCanonicalCommit('planData','upsert');finish(true,freeze(portable));};
    },{strict:true,abortMessage:'Portable Plans and Preferences restore aborted'});
  },
  read:async()=>{const [draft,rawLibrary]=await Promise.all([Meta.read('planDraft'),Meta.read('planLibrary')]);const library=rawLibrary as Omit<SavedPlans,'draft'>|null;return {draft:draft??null,savedPlans:library?.savedPlans||[],defaultId:library?.defaultId||null};},
  writeDraft:(value:string|null,options:WriteOptions={})=>{if(value!==null&&(typeof value!=='string'||value.length>APP_LIMITS.maxScheduleChars))throw new RangeError('Plan draft exceeds its text limit.');return writePlanMeta('planDraft',value,options);},
  writeLibrary:(value:Omit<SavedPlans,'draft'>,options:WriteOptions={})=>writePlanMeta('planLibrary',value,{...options,strictDurability:true})
});
const personalPreferences=freeze({
  read:()=>readMetadata('personalPreferences'),
  write:(value:Partial<PortablePreferences>,options:WriteOptions={})=>{const clean=PersonalDataCodec.portablePreferences({...value,version:2,updatedAt:new Date().toISOString()});return writePlanMeta('personalPreferences',clean,{...options,strictDurability:true}).then(()=>clean);},
  replace:(value:unknown)=>{const clean=PersonalDataCodec.currentPortablePreferences(value);if(!clean)throw new Error('Portable preferences are invalid.');return writePlanMeta('personalPreferences',clean,{strictDurability:true}).then(()=>clean);}
});
const InsightsDatasetRevision=(()=>{
  const KEY=META_KEYS.insightsDatasetRevision,FORMAT='study-director.insights-dataset-revision',VALUE_VERSION=2;
  let current:RevisionValue|null=null,readPromise:Promise<string|null>|null=null,lastError='',lastReason='',volatileRevision=0,refreshQueued=false;
  function exactKeys(value:unknown,keys:readonly string[]):value is RawFields{return !!(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|'));}
  function normalize(value:unknown){if(!exactKeys(value,['format','version','counter','updatedAt'])||value.format!==FORMAT||Number(value.version)!==VALUE_VERSION)return null;const counter=Number(value.counter),updatedAt=String(value.updatedAt||'');if(!Number.isSafeInteger(counter)||counter<1||!Number.isFinite(Date.parse(updatedAt)))return null;return Object.freeze({format:FORMAT,version:VALUE_VERSION,counter,updatedAt});}
  function record(counter:unknown,updatedAt=new Date().toISOString()){return {format:FORMAT,version:VALUE_VERSION,counter:Math.min(Number.MAX_SAFE_INTEGER,Math.max(1,Math.floor(Number(counter)||1))),updatedAt};}
  function revisionKey(value:RevisionValue|null){return value?`${value.version}:${value.counter}:${value.updatedAt}:v${volatileRevision}`:null;}
  function refreshActive(){if(refreshQueued)return;refreshQueued=true;queueMicrotask(()=>{refreshQueued=false;onDatasetRevisionChanged(snapshot());});}
  function accept(value:unknown,reason:string=''){const clean=normalize(value);if(!clean)return null;current=clean;lastError='';lastReason=clampText(reason||'',80);return revisionKey(clean);}
  function capture(scope:string,error:unknown){lastError=clampText(error&&(error as {message?:unknown;code?:unknown;name?:unknown;reason?:unknown}|null|undefined)?.message?(error as {message?:unknown;code?:unknown;name?:unknown;reason?:unknown}|null|undefined)?.message:String(error||'revision failure'),160);AppDiagnostics.capture(scope,error);}
  function readOrCreate(){return Meta.transaction<MetadataFields|null>('readwrite',(meta,tx,finish)=>{let resolved:MetadataFields|null=null;const handle=meta.get('insightsDatasetRevision'),req=handle.request;req.onsuccess=()=>{try{resolved=handle.value() as MetadataFields|null;}catch(error){try{tx.abort();}catch{}finish(false,error);return;}if(!resolved){resolved=record(1);meta.put('insightsDatasetRevision',resolved,{updatedAt:String(resolved.updatedAt)});}};req.onerror=()=>finish(false,req.error||new Error('insights revision read failed'));tx.oncomplete=()=>finish(true,resolved);},{abortMessage:'insights revision read aborted'});}
  async function get(){if(readPromise)return readPromise;readPromise=(async()=>accept((await readMetadata('insightsDatasetRevision'))||await readOrCreate(),'read'))().catch(error=>{capture('insights.revision-read',error);return null;}).finally(()=>{readPromise=null;});return readPromise;}
  function stage(tx:DbTransaction,reason:string='daily-record-change'){
    const state:RevisionState={value:null,reason},meta=Meta.view(tx),handle=meta.get('insightsDatasetRevision'),req=handle.request;
    req.onsuccess=()=>{let previous;try{previous=normalize(handle.value());}catch{try{tx.abort();}catch{}return;}state.value=record((previous&&previous.counter||0)+1);meta.put('insightsDatasetRevision',state.value,{updatedAt:state.value.updatedAt});};
    return state;
  }
  function committed(state:RevisionState|null){if(state&&state.value){accept(state.value,state.reason);refreshActive();}}
  function invalidateVolatile(reason:string='fallback-record-change'){volatileRevision+=1;lastReason=clampText(reason||'',80);refreshActive();return snapshot();}
  async function bump(reason='daily-record-change'){let state:RevisionState|null=null;try{await Meta.transaction<void>('readwrite',(meta,tx,finish)=>{state=stage(tx,reason);tx.oncomplete=()=>finish(true,undefined);tx.onabort=()=>finish(false,tx.error||new Error('Insights dataset revision is not canonical. Only current canonical metadata is supported.'));},{abortMessage:'insights revision update aborted'});committed(state);}catch(error){capture('insights.revision-bump',error);invalidateVolatile(reason);}return snapshot();}
  function snapshot(){return Object.freeze({format:FORMAT,version:VALUE_VERSION,counter:current&&current.counter||null,updatedAt:current&&current.updatedAt||null,revision:revisionKey(current),volatileRevision,lastReason,lastError});}
  return Object.freeze({get,bump,stage,committed,invalidateVolatile,snapshot,normalize,key:KEY});
})();
async function applyDeletionRecoveryEntry(entry:DeletionEntry){
  if(!entry)return true;
  const cutoff=Date.parse(entry.deletedAt||'')||0;
  if(entry.kind==='dailyRecord'){
    const rawFallback=fallbackDailyRecordsRawGet(),fallback=rawFallback.find(record=>record.date===entry.id)||null;
    if(fallback&&dailyRecordTimestamp(fallback)>cutoff){
      await idbPut(fallback,{preserveNewer:true});
      retireFallbackDailyRecords([fallback]);
      return true;
    }
    if(fallback&&!fallbackDailyRecordsSet(rawFallback.filter(record=>record.date!==entry.id)))throw LocalStorageContract.lastError||new Error('DailyRecord fallback could not be cleared during deletion recovery.');
    return idbStrictTransaction<boolean>([DB_DAILY_RECORD_STORE,DB_DAILY_SUMMARY_STORE,DB_APP_META_STORE],'readwrite',(tx,finish)=>{
      const records=tx.objectStore(DB_DAILY_RECORD_STORE),summaries=tx.objectStore(DB_DAILY_SUMMARY_STORE),meta=Meta.view(tx);
      let revisionState:RevisionState|null=null;
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
    const raw=readLocalRecoveryJson(STORAGE_KEYS.recovery,null),local=localRecoverySession(raw);
    if(local&&entityTimestamp(local,'activeSession')>cutoff)return true;
    if(raw!==null&&!LocalStorageContract.remove(STORAGE_KEYS.recovery))throw LocalStorageContract.lastError||new Error('ActiveSession recovery envelope could not be cleared.');
    return idbStrictTransaction<boolean>([DB_ACTIVE_SESSION_STORE,DB_APP_META_STORE],'readwrite',(tx,finish)=>{
      const store=tx.objectStore(DB_ACTIVE_SESSION_STORE);
      const request=store.get(ACTIVE_SESSION_ID);
      request.onerror=()=>finish(false,request.error||new Error('ActiveSession deletion recovery read failed'));
      request.onsuccess=()=>{const current=request.result||null;if(!current||entityTimestamp(current,'activeSession')<=cutoff){stageCanonicalMutationEpoch(tx,['activeSession']);store.delete(ACTIVE_SESSION_ID);}};
      tx.oncomplete=()=>finish(true,true);
    },'ActiveSession deletion recovery aborted');
  }
  return true;
}
async function flushDeletionRecovery(options:MaintenanceOptions={}){
  const cleared:DeletionEntry[]=[],owner=getOwnershipRevision();
  const retireServiced=()=>{
    if(!cleared.length)return true;
    if(!appCanMutate()||getOwnershipRevision()!==owner)return false;
    if(!clearDeletionRecoveryKeys(cleared.map(entry=>entry.key),cleared))return false;
    cleared.length=0;return true;
  };
  try{
    const entries=pendingDeletionEntries();
    if(!entries.length){markStorageHealthOk('deletionRecovery');return true;}
    for(const entry of entries){options.check?.();options.workBudget?.check();await applyDeletionRecoveryEntry(entry);cleared.push(entry);options.workBudget?.advance();}
    options.check?.();
    if(!retireServiced())throw LocalStorageContract.lastError||new Error('Pending deletion recovery markers could not be retired.');
    if(pendingDeletionEntries().length)throw new Error('Newer pending deletions remain; recovery will continue.');
    markStorageHealthOk('deletionRecovery');return true;
  }catch(error){
    // A yielded batch retains only its unfinished requests. Never consume a
    // newer timestamp, or checkpoint after losing write ownership.
    if(!retireServiced()){markStorageHealthError('deletionRecovery','Recovery progress could not be saved safely.');return false;}
    if((error as {message?:unknown;code?:unknown;name?:unknown;reason?:unknown}|null|undefined)?.code==='DATA_MAINTENANCE_YIELDED')throw error;
    markStorageHealthError('deletionRecovery',`Pending deletion recovery could not be reconciled: ${error&&(error as {message?:unknown;code?:unknown;name?:unknown;reason?:unknown}|null|undefined)?.message||error}`);return false;
  }
}

// A deletion ledger keeps its newest records up to its limit, so it stays
// bounded without dropping a recent deletion; only the oldest records go, and
// only once the ledger is full. Listing applies the same rule, so maintenance
// pruning storage never changes what a backup or restore reads.
const ATTACHMENT_DELETION_LIMIT=50000;
const newerDeletionFirst=<T extends {deletedAt:string}>(idOf:(value:T)=>string)=>(a:T,b:T)=>b.deletedAt.localeCompare(a.deletedAt)||idOf(a).localeCompare(idOf(b));
function newestDeletions<T extends {deletedAt:string}>(values:readonly T[],limit:number,idOf:(value:T)=>string){
  const kept=values.length>limit?[...values].sort(newerDeletionFirst(idOf)).slice(0,limit):[...values];
  return kept.sort((a,b)=>idOf(a).localeCompare(idOf(b)));
}
function normalizeSavedDayDeletions(values:unknown){
  if(!Array.isArray(values))throw new TypeError('Saved-Day deletion ledger must be an array.');
  const byDate=new Map<string,DayDeletion>();
  for(const item of values as unknown[]){
    const value=repositoryFields(item);
    const date=String(value&&value.date||''),deletedAt=normalizeTimestamp(value&&value.deletedAt,'');
    if(!isValidIsoDate(date)||!deletedAt)throw new Error('Saved-Day deletion ledger contains an invalid entry.');
    const previous=byDate.get(date);if(!previous||Date.parse(deletedAt)>Date.parse(previous.deletedAt))byDate.set(date,{date,deletedAt});
  }
  return newestDeletions([...byDate.values()],APP_LIMITS.maxImportRecords,entry=>entry.date);
}
async function listSavedDayDeletions(){
  return normalizeSavedDayDeletions((await Meta.list('savedDayDeletionPrefix')).map(entry=>entry!.value));
}
function replaceMetaPrefixFamily<T>(familyName:string,values:readonly T[],{suffixOf,valueOf,abortMessage}:{suffixOf:(value:T)=>string;valueOf:(value:T)=>{deletedAt:string};abortMessage:string}){
  return Meta.transaction<number>('readwrite',(meta,tx,finish)=>{
    const existing=meta.getAll(familyName),request=existing.request;
    request.onerror=()=>finish(false,request.error||new Error(`${familyName} replacement read failed`));
    request.onsuccess=()=>{
      let entries;try{entries=existing.entries();}catch(error){finish(false,error);return;}
      stageCanonicalMutationEpoch(tx,[]);
      for(const entry of entries)meta.remove(familyName,entry!.suffix);
      for(const value of values){const canonical=valueOf(value),suffix=suffixOf(value);meta.put(familyName,canonical,{suffix,updatedAt:canonical.deletedAt});}
      tx.oncomplete=()=>finish(true,values.length);
    };
  },{strict:true,abortMessage});
}
async function replaceSavedDayDeletions(values:unknown){
  const clean=normalizeSavedDayDeletions(values);
  return replaceMetaPrefixFamily('savedDayDeletionPrefix',clean,{suffixOf:entry=>entry.date,valueOf:entry=>savedDayDeletionValue(entry.date,entry.deletedAt),abortMessage:'Saved-Day deletion ledger replacement aborted'});
}

function normalizeNoteDeletions(values:unknown){
  if(!Array.isArray(values))throw new TypeError('Note deletion ledger must be an array.');
  const byKey=new Map<string,NoteDeletion>();
  for(const item of values as unknown[]){
    const value=repositoryFields(item);
    const key=String(value&&value.key||''),deletedAt=normalizeTimestamp(value&&value.deletedAt,'');
    if(!NoteKeys.isId(key)||!deletedAt)throw new Error('Note deletion ledger contains an invalid entry.');
    const previous=byKey.get(key);if(!previous||Date.parse(deletedAt)>Date.parse(previous.deletedAt))byKey.set(key,{key,deletedAt});
  }
  return newestDeletions([...byKey.values()],APP_LIMITS.maxNotes,entry=>entry.key);
}
async function listNoteDeletions(){
  return normalizeNoteDeletions((await Meta.list('noteDeletionPrefix')).map(entry=>entry!.value));
}
async function replaceNoteDeletions(values:unknown){
  const clean=normalizeNoteDeletions(values);
  return replaceMetaPrefixFamily('noteDeletionPrefix',clean,{suffixOf:entry=>entry.key,valueOf:entry=>noteDeletionValue(entry.key,entry.deletedAt)!,abortMessage:'Note deletion ledger replacement aborted'});
}

function normalizeAttachmentDeletions(values:unknown){
  if(!Array.isArray(values))throw new TypeError('Attachment deletion ledger must be an array.');
  const byId=new Map<string,AttachmentDeletion>();
  for(const item of values as unknown[]){const value=repositoryFields(item);const assetId=normalizeAttachmentDeletionId(value&&value.assetId),deletedAt=normalizeTimestamp(value&&value.deletedAt,'');if(!assetId||!deletedAt)throw new Error('Attachment deletion ledger contains an invalid entry.');const previous=byId.get(assetId);if(!previous||Date.parse(deletedAt)>Date.parse(previous.deletedAt))byId.set(assetId,{assetId,deletedAt});}
  return newestDeletions([...byId.values()],ATTACHMENT_DELETION_LIMIT,entry=>entry.assetId);
}
async function listAttachmentDeletions(){
  return normalizeAttachmentDeletions((await Meta.list('attachmentDeletionPrefix')).map(entry=>entry!.value));
}
async function replaceAttachmentDeletions(values:unknown){
  const clean=normalizeAttachmentDeletions(values);
  return replaceMetaPrefixFamily('attachmentDeletionPrefix',clean,{suffixOf:entry=>entry.assetId,valueOf:entry=>attachmentDeletionValue(entry.assetId,entry.deletedAt),abortMessage:'Attachment deletion ledger replacement aborted'});
}
// Removes the stored records each ledger's listing already leaves out.
async function pruneDeletionLedgers(){
  const ledgers:[string,number,(value:MetadataFields)=>string][]=[['savedDayDeletionPrefix',APP_LIMITS.maxImportRecords,(value:MetadataFields)=>String(value.date)],['noteDeletionPrefix',APP_LIMITS.maxNotes,(value:MetadataFields)=>String(value.key)],['attachmentDeletionPrefix',ATTACHMENT_DELETION_LIMIT,(value:MetadataFields)=>String(value.assetId)]];
  let removed=0;
  for(const [family,limit,idOf] of ledgers){
    removed+=await Meta.transaction<number>('readwrite',(meta,tx,finish)=>{
      const existing=meta.getAll(family),request=existing.request;
      request.onerror=()=>finish(false,request.error||new Error(`${family} pruning read failed`));
      request.onsuccess=()=>{
        let entries;try{entries=existing.entries();}catch(error){finish(false,error);return;}
        const excess=entries.length-limit;
        if(excess>0){stageCanonicalMutationEpoch(tx,[]);for(const entry of [...entries].sort((a,b)=>newerDeletionFirst(idOf)(a!.value as {deletedAt:string},b!.value as {deletedAt:string})).slice(limit))meta.remove(family,entry!.suffix);}
        tx.oncomplete=()=>finish(true,Math.max(0,excess));
      };
    },{strict:true,abortMessage:'Deletion ledger pruning aborted'});
  }
  return removed;
}
function stageAttachmentDeletionState(tx:DbTransaction,state:{record?:readonly (AttachmentDeletion|string)[];clear?:readonly string[]}={}){
  if(!tx||typeof tx.objectStore!=='function')throw new TypeError('Attachment deletion state requires an IndexedDB transaction.');
  const record=Array.isArray(state&&state.record)?state.record as readonly (AttachmentDeletion|string)[]:[],clear=Array.isArray(state&&state.clear)?state.clear as readonly string[]:[],recorded=new Set<string>(),cleared=new Set<string>(),meta=Meta.view(tx);
  for(const raw of clear){const id=normalizeAttachmentDeletionId(raw);if(!id)throw new TypeError('Attachment deletion identity is invalid.');cleared.add(id);}
  for(const raw of record){const source=raw&&typeof raw==='object'?raw:{assetId:raw,deletedAt:undefined},value=attachmentDeletionValue(source.assetId,source.deletedAt);if(cleared.has(value.assetId))throw new Error('Attachment deletion state cannot record and clear the same identity in one transaction.');recorded.add(value.assetId);meta.put('attachmentDeletionPrefix',value,{suffix:value.assetId,updatedAt:value.deletedAt});}
  for(const id of cleared)meta.remove('attachmentDeletionPrefix',id);
  return freeze({recorded:recorded.size,cleared:cleared.size});
}
async function recordAttachmentDeletion(assetId:unknown,deletedAt=new Date().toISOString()){
  const value=attachmentDeletionValue(assetId,deletedAt);
  await Meta.transaction<void>('readwrite',(meta,tx,finish)=>{stageCanonicalMutationEpoch(tx,[]);const request=meta.put('attachmentDeletionPrefix',value,{suffix:value.assetId,updatedAt:value.deletedAt});request.onerror=()=>finish(false,request.error||new Error('Attachment deletion ledger write failed'));tx.oncomplete=()=>finish(true,undefined);},{strict:true,abortMessage:'Attachment deletion ledger write aborted'});
  return freeze({assetId:value.assetId,deletedAt:value.deletedAt});
}
async function clearAttachmentDeletion(assetId:unknown){
  const id=normalizeAttachmentDeletionId(assetId);if(!id)return false;
  await Meta.transaction<void>('readwrite',(meta,tx,finish)=>{stageCanonicalMutationEpoch(tx,[]);const request=meta.remove('attachmentDeletionPrefix',id);request.onerror=()=>finish(false,request.error||new Error('Attachment deletion ledger clear failed'));tx.oncomplete=()=>finish(true,undefined);},{strict:true,abortMessage:'Attachment deletion ledger clear aborted'});return true;
}
// Versions kept for review (PendingReview), one appMeta row each under its
// id. A write merges by id, where a resolved review wins, and stamps each
// changed review's backup unit, so versions carry it to other devices.
async function listPendingReviews(){
  return freeze((await Meta.list('pendingReviewPrefix')).map(entry=>freeze(entry!.value as PendingReview)).sort((a,b)=>a.id.localeCompare(b.id)));
}
// Merges these into the stored reviews (replace: the stored set becomes
// exactly these). Returns the ids whose rows changed. More reviews waiting
// than the limit allows stops the write: none is ever dropped.
async function writePendingReviews(values:unknown,{replace=false}={}){
  const incoming=(Array.isArray(values)?values:[]).map(value=>{const clean=PendingReviewCodec.normalize(value);if(!clean)throw new TypeError('A version kept for review is invalid.');return clean;});
  return Meta.transaction<readonly string[]>('readwrite',(meta,tx,finish)=>{
    const existing=meta.getAll('pendingReviewPrefix'),request=existing.request;
    request.onerror=()=>finish(false,request.error||new Error('Pending review read failed'));
    request.onsuccess=()=>{
      let next:PendingReview[],stored:Map<string,PendingReview>;
      try{stored=new Map(existing.entries().map(entry=>[entry!.suffix,entry!.value as PendingReview]));next=PendingReviewCodec.merge(replace?[incoming]:[[...stored.values()],incoming],APP_LIMITS.maxPendingReviews);}
      catch(error){finish(false,error);return;}
      if(next.filter(review=>!review.resolvedAt).length>APP_LIMITS.maxPendingReviews){finish(false,new RangeError(`More than ${APP_LIMITS.maxPendingReviews} versions would wait for review.`));return;}
      const ids=new Set(next.map(review=>review.id)),changed:string[]=[];
      for(const id of stored.keys())if(!ids.has(id)){meta.remove('pendingReviewPrefix',id);changed.push(id);}
      for(const review of next){const held=stored.get(review.id);if(held&&sameDataValue(held,review))continue;meta.put('pendingReviewPrefix',review,{suffix:review.id,updatedAt:review.resolvedAt||review.keptAt});changed.push(review.id);}
      if(changed.length)stageCanonicalMutationEpoch(tx,changed.map(id=>`pendingReview:${id}`));
      tx.oncomplete=()=>{if(changed.length)reportCanonicalCommit('pendingReview','upsert');finish(true,freeze(changed.sort()));};
    };
  },{strict:true,abortMessage:'Pending review update aborted'});
}
async function resolvePendingReviews(ids:readonly string[],resolvedAt=new Date().toISOString()){
  const wanted=new Set((ids||[]).map(String)),held=(await listPendingReviews()).filter(review=>wanted.has(review.id)&&!review.resolvedAt);
  return held.length?writePendingReviews(held.map(review=>PendingReviewCodec.resolved(review,resolvedAt))):freeze([]);
}
async function readPendingReviewItems(ids:readonly string[]){
  const rows=await Promise.all((ids||[]).map(id=>readMetadata('pendingReviewPrefix',String(id))));
  return freeze(rows.map(value=>value?freeze(value):null));
}
async function idbGetRecordsByDates(dates:readonly string[]){
  const unique=[...new Set((dates||[]).filter(isValidIsoDate))].slice(0,APP_LIMITS.maxImportRecords);
  if(!unique.length)return [];
  return idbStoreTransaction<unknown[]>(DB_DAILY_RECORD_STORE,'readonly',(store,tx,finish)=>{
    const out:unknown[]=[];let pending=unique.length,failed=false;
    unique.forEach(date=>{
      const req=store.get(date);
      req.onsuccess=()=>{if(req.result)out.push(req.result);if(--pending===0&&!failed)finish(true,out);};
      req.onerror=()=>{if(failed)return;failed=true;finish(false,req.error||new Error('batch record read failed'));};
    });
  },'batch record read aborted');
}
async function idbGetRecordsByMonth(month:unknown){
  const key=String(month||'');if(!/^\d{4}-(?:0[1-9]|1[0-2])$/u.test(key))throw new TypeError('Saved-Day month is invalid.');
  const Range=globalThis.IDBKeyRange,lower=`${key}-01`,upper=`${key}-31`;
  return idbStoreTransaction<unknown[]>(DB_DAILY_RECORD_STORE,'readonly',(store,tx,finish)=>{
    if(Range&&typeof Range.bound==='function'&&typeof store.getAll==='function'){
      const request=store.getAll(Range.bound(lower,upper));request.onsuccess=()=>finish(true,request.result||[]);request.onerror=()=>finish(false,request.error);return;
    }
    const request=store.getAll();request.onsuccess=()=>finish(true,(request.result||[]).filter(row=>String(repositoryFields(row)?.date||'').startsWith(key+'-')));request.onerror=()=>finish(false,request.error);
  },'Saved-Day month read aborted');
}
function currentDailyRecordDocuments(records:unknown,label:string='Daily Records'):DailyRecord[]{
  const input=Array.isArray(records)?records:[];
  const docs=input.map(sanitizeCurrentDailyRecord);
  if(docs.some(record=>!record))throw new Error(`${label} contain noncanonical data. Only current canonical data may be persisted.`);
  return docs as DailyRecord[];
}
async function idbPutDailyRecordBatch(records:readonly unknown[],{bumpRevision=true,ownershipToken=null,preserveNewer=false}:BatchOptions={}){
  const docs=currentDailyRecordDocuments(records,'Daily Record batch');
  if(!docs.length)return true;
  const stores=[DB_DAILY_RECORD_STORE,DB_DAILY_SUMMARY_STORE,DB_APP_META_STORE];
  return idbStrictTransaction<{ok:true}>(stores,'readwrite',(tx,finish)=>{
    if(ownershipToken)assertWriteToken(ownershipToken,'the daily-record transaction');
    const recordStore=tx.objectStore(DB_DAILY_RECORD_STORE),summaryStore=tx.objectStore(DB_DAILY_SUMMARY_STORE),meta=Meta.view(tx);
    let revisionState:RevisionState|null=null;
    stageCanonicalMutationEpoch(tx,[...new Set(docs.map(doc=>dailyPreparationUnit(doc.date)))]);
    const write=(doc:DailyRecord)=>{recordStore.put(doc);summaryStore.put(buildDailyRecordSummary(doc));meta.remove('savedDayDeletionPrefix',doc.date);};
    docs.forEach(doc=>{
      if(!preserveNewer){write(doc);return;}
      const request=recordStore.get(doc.date);
      request.onerror=()=>finish(false,request.error||new Error('DailyRecord reconciliation read failed'));
      request.onsuccess=()=>{
        try{
          if(ownershipToken)assertWriteToken(ownershipToken,'the daily-record reconciliation');
          const current=readableDailyRecord(request.result);
          if(!current||dailyRecordTimestamp(current)<dailyRecordTimestamp(doc))write(doc);
        }catch(error){try{tx.abort();}catch{}finish(false,error);}
      };
    });
    if(bumpRevision)revisionState=InsightsDatasetRevision.stage(tx,'daily-record-upsert');
    tx.oncomplete=()=>{InsightsDatasetRevision.committed(revisionState);finish(true,{ok:true});};
  },'daily record batch write aborted');
}
async function idbPut(rec:unknown,options:BatchOptions={}){
  const clean=sanitizeCurrentDailyRecord(rec);
  if(!clean)throw new Error('invalid daily record');
  return idbPutDailyRecordBatch([clean],options);
}
function idbAllRecords(){return idbGetAll(DB_DAILY_RECORD_STORE,'read aborted');}
function idbAllSummaries(){return idbGetAll(DB_DAILY_SUMMARY_STORE,'summary read aborted');}
function idbInsightsDailySnapshot(){
  return idbTransaction<{records:unknown[];summaries:unknown[]}>([DB_DAILY_RECORD_STORE,DB_DAILY_SUMMARY_STORE],'readonly',(tx,finish)=>{
    const recordsRequest=tx.objectStore(DB_DAILY_RECORD_STORE).getAll(),summariesRequest=tx.objectStore(DB_DAILY_SUMMARY_STORE).getAll();
    let records:unknown[]|null=null,summaries:unknown[]|null=null,pending=2,failed=false;
    const complete=()=>{if(!failed&&--pending===0)finish(true,{records:records||[],summaries:summaries||[]});};
    recordsRequest.onsuccess=()=>{records=recordsRequest.result||[];complete();};
    summariesRequest.onsuccess=()=>{summaries=summariesRequest.result||[];complete();};
    const fail=(request:IDBRequest<unknown[]>)=>{if(failed)return;failed=true;finish(false,request.error||new Error('Insights snapshot read failed'));};
    recordsRequest.onerror=()=>fail(recordsRequest);summariesRequest.onerror=()=>fail(summariesRequest);
  },'Insights snapshot read aborted');
}
async function idbDailyRecordKeys(){
  return idbStoreTransaction<string[]>(DB_DAILY_RECORD_STORE,'readonly',(store,tx,finish)=>{
    if(typeof store.getAllKeys==='function'){const request=store.getAllKeys();request.onsuccess=()=>finish(true,(request.result||[]).map(String));request.onerror=()=>finish(false,request.error);return;}
    const out:string[]=[],request=store.openKeyCursor();request.onsuccess=event=>{const cursor=(event.target as IDBRequest<IDBCursor|null>).result;if(!cursor)return finish(true,out);out.push(String(cursor.key));cursor.continue();};request.onerror=()=>finish(false,request.error);
  },'daily record key read aborted');
}
async function repairDailySummaries(){
  const records=(await idbAllRecords()).map(sanitizeCurrentDailyRecord);
  if(records.some(record=>!record))throw new Error('Daily Summary repair found a noncanonical Daily Record.');
  await idbStrictTransaction<void>(DB_DAILY_SUMMARY_STORE,'readwrite',(tx,finish)=>{const store=tx.objectStore(DB_DAILY_SUMMARY_STORE);store.clear();records.forEach(record=>store.put(buildDailyRecordSummary(record!)));tx.oncomplete=()=>finish(true,undefined);},'daily summary repair aborted');
  return records.length;
}
async function getVerifiedIdbDailyRecordSummaries(){
  const rows=await idbAllSummaries(),clean=rows.map(sanitizeDailyRecordSummary);
  if(clean.some(row=>!row))throw new Error('Daily Summary cache is not canonical and must be rebuilt.');
  return clean as DailySummary[];
}
function idbGetRecord(date:string){return idbGet(DB_DAILY_RECORD_STORE,date,'record read aborted');}
async function idbDelete(date:string,{trackDeletion=true,ownershipToken=null,deletedAt=new Date().toISOString()}:{trackDeletion?:boolean;ownershipToken?:WriteToken|null;deletedAt?:string}={}){
  return idbStrictTransaction<{changed:boolean}>([DB_DAILY_RECORD_STORE,DB_DAILY_SUMMARY_STORE,DB_APP_META_STORE],'readwrite',(tx,finish)=>{
    if(ownershipToken)assertWriteToken(ownershipToken,'the daily-record deletion');
    const records=tx.objectStore(DB_DAILY_RECORD_STORE),summaries=tx.objectStore(DB_DAILY_SUMMARY_STORE),meta=Meta.view(tx);
    let changed=false,revisionState:RevisionState|null=null;
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
async function idbPutActiveSession(session:ActiveSession|null,ownershipToken:WriteToken|null=null,strictDurability:boolean=false,expectedCanonical:ActiveSession | null=null){
  const current=ActiveSessionCodec.sanitizeCurrent(session);if(!current)throw canonicalRuntimeError('Active Session write requires the current canonical schema.');session=current;
  return (strictDurability?idbStrictTransaction:idbTransaction)<void>([DB_ACTIVE_SESSION_STORE,DB_APP_META_STORE],'readwrite',(tx,finish)=>{
    const store=tx.objectStore(DB_ACTIVE_SESSION_STORE);
    if(ownershipToken)assertWriteToken(ownershipToken,'the active-session transaction');
    const put=()=>{
      stageCanonicalMutationEpoch(tx,['activeSession']);
      const request=store.put(session);request.onerror=()=>finish(false,request.error||new Error('active session write failed'));
    };
    tx.oncomplete=()=>finish(true,undefined);
    if(expectedCanonical){
      // Compare and replace in one readwrite transaction: a competing local
      // write between Drive verification and recovery cannot be overwritten.
      const request=store.get(ACTIVE_SESSION_ID);
      request.onerror=()=>finish(false,request.error||new Error('Active Session recovery precondition read failed'));
      request.onsuccess=()=>{
        const present=ActiveSessionCodec.sanitizeCurrent(request.result);
        if(!present||!sameDataValue(present,expectedCanonical)){
          try{tx.abort();}catch{}
          finish(false,Object.assign(new Error('Active Session changed before this save.'),{code:'ACTIVE_SESSION_CHANGED'}));
          return;
        }
        put();
      };
    }else put();
  },'active session write aborted');
}
function idbGetActiveSession(){return idbGet(DB_ACTIVE_SESSION_STORE,ACTIVE_SESSION_ID,'active session read failed');}
async function idbDeleteActiveSession(ownershipToken:WriteToken|null=null){
  return idbStrictTransaction<void>([DB_ACTIVE_SESSION_STORE,DB_APP_META_STORE],'readwrite',(tx,finish)=>{
    const store=tx.objectStore(DB_ACTIVE_SESSION_STORE);
    if(ownershipToken)assertWriteToken(ownershipToken,'the active-session deletion');
    stageCanonicalMutationEpoch(tx,['activeSession']);const request=store.delete(ACTIVE_SESSION_ID);request.onerror=()=>finish(false,request.error||new Error('active session delete failed'));
    tx.oncomplete=()=>finish(true,undefined);
  },'active session delete aborted');
}

async function saveActiveSessionRecord(value:unknown,{emergency=false,backupCapture=false,strictDurability=false,expectedCanonical=null}:{emergency?:boolean;backupCapture?:boolean;strictDurability?:boolean;expectedCanonical?:ActiveSession|null}={}):Promise<SessionResult>{
  let ownershipToken:WriteToken;
  try{ownershipToken=issueWriteToken('saving the active session');}
  catch(error){return {ok:false,value:null,error,storage:{local:false,idb:false}};}
  // Live snapshots are normalized only after the current record's write
  // metadata is stamped. Exact stored-record validation belongs after that.
  const session=value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
  if(!session||session['id']!==ACTIVE_SESSION_ID||!session['snapshot']||Number(session['version'])!==DATA_CONTRACT.schemas.ActiveSession.version)return {ok:false,value:null,error:new Error('invalid active session'),storage:{local:false,idb:false}};
  const expected=expectedCanonical===null?null:ActiveSessionCodec.sanitizeCurrent(expectedCanonical);
  if(expectedCanonical!==null&&(!expected||emergency))
    return {ok:false,value:null,error:new Error('Conditional ownership recovery requires an exact canonical precondition without an emergency fallback.'),storage:{local:false,idb:false}};
  const revision=boundedNumber(session['revision'],{min:1,max:Number.MAX_SAFE_INTEGER,fallback:nextSessionRevision()});
  lastSessionRevision=Math.max(lastSessionRevision,revision);
  const clean=ActiveSessionCodec.canonicalize({...session,version:DATA_CONTRACT.schemas.ActiveSession.version,revision,updatedAt:normalizeTimestamp(session['updatedAt'],new Date().toISOString())});
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
  const writing=activeSessionWriteChain.catch(error=>{AppDiagnostics.capture('active-session.previous-write',error,'error');}).then(async()=>{
    let idbSaved=false,idbError:unknown=null;
    try{
      // Only explicit critical saves, page-exit flushes and suspension need
      // strict disk-commit semantics. Periodic timer snapshots stay default.
      await idbPutActiveSession(clean,ownershipToken,strictDurability===true||emergency===true||clean.status==='suspended',expected);idbSaved=true;
      clearDeletionRecoveryKeys([deletionRecoveryKey('activeSession',ACTIVE_SESSION_ID)]);
      reportCanonicalCommit('activeSession','upsert',clean,{backupCapture});
    }catch(e){
      if(isOwnershipLostError(e))return {ok:false,value:clean,error:e,storage:{local:localSaved,idb:false}};
      idbError=e;
      if(!expected&&!localSaved&&writeEpoch===activeSessionMutationEpoch){
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
  activeSessionWriteChain=writing;
  return writing;
}
async function activeSessionEpochFallback(retry:number,options:{strict?:boolean}={}):Promise<SessionResult>{
  if(retry<2)return loadActiveSessionRecord(retry+1,options);
  if(options.strict)throw new Error('Active Session changed during maintenance; reconciliation will retry.');
  const settled=await activeSessionWriteChain;
  if(settled?.ok&&Object.prototype.hasOwnProperty.call(settled,'value'))return settled;
  const currentLocal=readLocalRecoverySession();
  return {ok:true,value:currentLocal,error:null,storage:{local:!!currentLocal,idb:false}};
}
async function loadActiveSessionRecord(retry:number=0,options:{strict?:boolean}={}):Promise<SessionResult>{
  await activeSessionWriteChain.catch(error=>{AppDiagnostics.capture('active-session.pre-read-settle',error,'error');});
  const readEpoch=activeSessionMutationEpoch;
  let localSession:ActiveSession|null=null;
  try{
    const rawLocal=readLocalRecoverySession();
    const canonicalLocal=rawLocal?ActiveSessionCodec.sanitizeCurrent(rawLocal):null;
    if(rawLocal&&!canonicalLocal)throw canonicalRuntimeError('Active Session recovery resolved to a non-current canonical session.');
    localSession=pendingDeletionShadowsEntity('activeSession',ACTIVE_SESSION_ID,canonicalLocal)?null:canonicalLocal;
    const rawIdb=await idbGetActiveSession();
    if(readEpoch!==activeSessionMutationEpoch)return activeSessionEpochFallback(retry,options);
    const canonicalIdb=rawIdb?ActiveSessionCodec.sanitizeCurrent(rawIdb):null;
    if(rawIdb&&!canonicalIdb)throw canonicalRuntimeError('Stored Active Session is not in the current canonical schema.');
    const idbSession=canonicalIdb&&!pendingDeletionShadowsEntity('activeSession',ACTIVE_SESSION_ID,canonicalIdb)?canonicalIdb:null;
    const value=newerActiveSession(idbSession,localSession);
    if(value&&value.revision)lastSessionRevision=Math.max(lastSessionRevision,Number(value.revision)||0);
    let reconciliationError:unknown=null;
    activeSessionWriteChain=activeSessionWriteChain.catch(error=>{AppDiagnostics.capture('active-session.previous-reconciliation',error,'error');}).then(async()=>{
      if(readEpoch!==activeSessionMutationEpoch)return;
      let reconciliationToken=null;
      try{reconciliationToken=issueWriteToken('reconciling the active session',{allowHydrating:true});}catch(error){reconciliationError=error;}
      if(reconciliationToken&&value===localSession&&value&&(!idbSession||newerActiveSession(idbSession,value)===value)){
        try{
          if(readEpoch!==activeSessionMutationEpoch)return;
          assertWriteToken(reconciliationToken,'the active-session reconciliation');
          await idbPutActiveSession(value,reconciliationToken,true);
          if(readEpoch===activeSessionMutationEpoch){assertWriteToken(reconciliationToken,'clearing reconciled session recovery');if(!LocalStorageContract.remove(STORAGE_KEYS.recovery)&&options.strict)throw LocalStorageContract.lastError||new Error('Reconciled session recovery could not be cleared.');}
          if(!clearDeletionRecoveryKeys([deletionRecoveryKey('activeSession',ACTIVE_SESSION_ID)])&&options.strict)throw LocalStorageContract.lastError||new Error('Session deletion recovery could not be reconciled.');
        }catch(e){reconciliationError=e;if(!isOwnershipLostError(e))AppDiagnostics.capture('active-session.reconcile-idb',e);}
      }else if(reconciliationToken&&value===idbSession&&value&&(!localSession||newerActiveSession(localSession,idbSession)===idbSession)){
        try{
          if(readEpoch!==activeSessionMutationEpoch)return;
          assertWriteToken(reconciliationToken,'the active-session canonical read-repair');
          if(rawIdb&&!sameDataValue(rawIdb,idbSession))await idbPutActiveSession(idbSession,reconciliationToken,true);
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

async function clearActiveSessionRecord():Promise<SessionResult>{
  activeSessionMutationEpoch++;
  let ownershipToken:WriteToken;
  try{ownershipToken=issueWriteToken('clearing the active session');}
  catch(error){return {ok:false,value:null,error,storage:{local:false,idb:false}};}
  const finishWrite=beginAuthoritativeWrite();
  const writing=activeSessionWriteChain.catch(error=>{AppDiagnostics.capture('active-session.previous-clear',error,'error');}).then(async()=>{
    const deletedAt=new Date().toISOString(),recoveryKey=deletionRecoveryKey('activeSession',ACTIVE_SESSION_ID);
    let staged=false,localCleared=false,idbCleared=false,idbError:unknown=null;
    try{
      staged=stageDeletionRecovery('activeSession',ACTIVE_SESSION_ID,deletedAt);
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
  activeSessionWriteChain=writing;
  return writing;
}

function readableDailyRecord(record:unknown){
  if(!record)return null;
  const current=sanitizeCurrentDailyRecord(record);
  if(!current)throw canonicalRuntimeError(`Daily Record ${String(repositoryFields(record)?.date||'?')} is not in the current canonical schema.`);
  return current;
}
function fallbackDailyRecordsRawGet(){
  const raw=readLocalRecoveryJson(STORAGE_KEYS.fallbackDailyRecords,[]);
  if(!Array.isArray(raw))throw canonicalRuntimeError('Fallback Daily Records are not in a recognized array format.');
  const compatible=raw.map(readableDailyRecord).filter(value=>value!==null);
  return capFallbackDailyRecords(compatible);
}
function fallbackDailyRecordsGet(){return filterPendingDeletedEntities(fallbackDailyRecordsRawGet(),'dailyRecord','date');}
function fallbackDailyRecordsSet(arr:readonly unknown[]){
  return LocalStorageContract.setJson(STORAGE_KEYS.fallbackDailyRecords,capFallbackDailyRecords(arr||[]));
}
function retireFallbackDailyRecords(records:readonly DailyRecord[]){
  const committed=new Map(records.map(record=>[record.date,record]));
  const remaining=fallbackDailyRecordsRawGet().filter(record=>{
    const saved=committed.get(record.date);
    return !saved||dailyRecordTimestamp(record)>dailyRecordTimestamp(saved)||dailyRecordTimestamp(record)===dailyRecordTimestamp(saved)&&!sameDataValue(record,saved);
  });
  if(!fallbackDailyRecordsSet(remaining))throw LocalStorageContract.lastError||new Error('Saved-Day rescue cleanup could not be persisted.');
  return remaining;
}
function cleanupCommittedDailyRecords(records:readonly DailyRecord[]){
  try{
    if(!clearDeletionRecoveryKeys(records.map(record=>deletionRecoveryKey('dailyRecord',record.date))))throw LocalStorageContract.lastError||new Error('Saved-Day deletion recovery is still pending.');
    retireFallbackDailyRecords(records);confirmDailyRecordStorage();return true;
  }catch(error){return reportDailyRecordRecoveryFailure(error);}
}
function dailyRecordTimestamp(record:Pick<DailyRecord,'updatedAt'|'savedAt'>|null|undefined){
  const n=Date.parse(record&&((record.updatedAt)||(record.savedAt))||'');
  return Number.isFinite(n)?n:0;
}
function activeSessionTimestamp(session:ActiveSession|null){
  const n=Date.parse(session&&session.updatedAt||'');
  return Number.isFinite(n)?n:0;
}
function newerActiveSession(a:ActiveSession|null,b:ActiveSession|null){
  if(!a)return b||null;
  if(!b)return a;
  const ar=boundedNumber(a.revision,{min:0,max:Number.MAX_SAFE_INTEGER,fallback:0});
  const br=boundedNumber(b.revision,{min:0,max:Number.MAX_SAFE_INTEGER,fallback:0});
  if(ar!==br)return br>ar?b:a;
  return activeSessionTimestamp(b)>activeSessionTimestamp(a)?b:a;
}
function newerDailyRecord(a:DailyRecord|null|undefined,b:DailyRecord|null){
  if(!a)return b||null;
  if(!b)return a;
  return dailyRecordTimestamp(b)>dailyRecordTimestamp(a)?b:a;
}
function mergeDailyRecordSets(...sets:(readonly unknown[])[]){
  const byDate=new Map<string,DailyRecord>();
  sets.flat().forEach(record=>{
    const clean=readableDailyRecord(record);
    if(!clean||!isValidIsoDate(clean.date))return;
    byDate.set(clean.date,newerDailyRecord(byDate.get(clean.date),clean)!);
  });
  return [...byDate.values()];
}
async function replayFallbackDailyRecords(records:readonly DailyRecord[],{strict=false}={}){
  if(!records.length)return true;
  if(!appCanMutate()){if(strict)throw new Error('Fallback replay requires study control.');return;}
  let ownershipToken:WriteToken;
  try{ownershipToken=issueWriteToken('replaying fallback daily records');}catch(error){if(strict)throw error;return;}
  const finishWrite=beginAuthoritativeWrite();
  const replayedDates=new Set();
  try{
    for(const record of records){
      try{
        assertWriteToken(ownershipToken,'the fallback-record replay');
        await idbPut(record,{ownershipToken,preserveNewer:true});
        if(record&&isValidIsoDate(record.date))replayedDates.add(record.date);
      }catch(e){if(strict)throw e;break;}
    }
    if(!replayedDates.size)return;
    assertWriteToken(ownershipToken,'the fallback-record cleanup');
    const remaining=retireFallbackDailyRecords(records.filter(record=>replayedDates.has(record.date)));
    if(strict&&remaining.length)throw new Error('Fallback Daily Records still require reconciliation.');
    if(!remaining.length)confirmDailyRecordStorage();
    return true;
  }catch(error){if(strict)throw error;if(isOwnershipLostError(error))return false;return reportDailyRecordRecoveryFailure(error);}
  finally{
    finishWrite();
  }
}
// Canonical Saved Day receipts never consult localStorage rescue. A successful
// fallback write is recoverable work, not proof that the day reached IndexedDB.
async function verifyCanonicalDailyRecord(record:unknown){
  const clean=sanitizeCurrentDailyRecord(storedDailyRecordFields(record));
  if(!clean)throw new Error('Saved Day verification requires a canonical record.');
  const stored=readableDailyRecord(await idbGetRecord(clean.date));
  const fallback=fallbackDailyRecordsRawGet().find(row=>row.date===clean.date)||null;
  if(!stored||pendingDeletionShadowsEntity('dailyRecord',clean.date,stored)||!sameDataValue(stored,clean)||
      fallback&&!sameDataValue(fallback,clean))throw new Error('Canonical Saved Day read-back did not match the committed study evidence.');
  return true;
}
async function verifyCanonicalDailyRecordAbsent(date:string){
  if(!isValidIsoDate(date))throw new Error('Saved Day deletion verification requires a valid date.');
  const stored=readableDailyRecord(await idbGetRecord(date));
  const fallback=fallbackDailyRecordsRawGet().find(row=>row.date===date)||null;
  const deletion=pendingDeletionEntries().some(entry=>entry.kind==='dailyRecord'&&entry.id===date);
  if(stored||fallback||deletion)throw new Error('Canonical Saved Day deletion did not pass its durable read-back check.');
  return true;
}
async function storeDailyRecord(rec:DailyRecord|DailyView,options:{backupCapture?:boolean}={}){
  const ownershipToken=issueWriteToken('saving the daily record');
  if(!rec||!isValidIsoDate(rec.date))throw new Error('Invalid daily record date');
  const finishWrite=beginAuthoritativeWrite();
  let stored=false;
  try{
  assertWriteToken(ownershipToken,'preparing the daily record');
  const updatedAt=normalizeTimestamp(rec.updatedAt,normalizeTimestamp(rec.savedAt,new Date().toISOString()));
  // A record read from here comes back as its view; it is saved as its stored fields.
  const candidate:RawFields={...storedDailyRecordFields(rec),version:DATA_CONTRACT.schemas.DailyRecord.version,updatedAt};
  const clean=sanitizeCurrentDailyRecord(candidate);
  if(!clean||('degraded' in clean&&clean.degraded))throw new Error('New daily record failed its canonical validation.');
  try{
      assertWriteToken(ownershipToken,'the daily-record IndexedDB write');
    await idbPut(clean,{markDirty:true,ownershipToken});
    assertWriteToken(ownershipToken,'the daily-record post-write cleanup');
    cleanupCommittedDailyRecords([clean]);
    reportCanonicalCommit('dailyRecord','upsert',null,{backupCapture:options.backupCapture===true});
    stored=true;return freeze({ok:true,storage:'indexeddb'});
  }
  catch(e){
    if(isOwnershipLostError(e))throw e;
    assertWriteToken(ownershipToken,'the daily-record fallback write');
    const existing=fallbackDailyRecordsGet(),arr=existing.filter(r=>r.date!==clean.date);arr.push(clean);
    const capped=capFallbackDailyRecords(arr,rescueRoom(STORAGE_KEYS.fallbackDailyRecords,APP_LIMITS.fallbackDailyRecordsBytes)),retainedDates=new Set(capped.map(record=>record.date));
    showStorageFallbackWarning(e&&(e as {message?:unknown;code?:unknown;name?:unknown;reason?:unknown}|null|undefined)?.message?(e as {message?:unknown;code?:unknown;name?:unknown;reason?:unknown}|null|undefined)?.message:'saved-date database failed');
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
async function storeDailyRecordBatch(records:readonly unknown[]){
  const ownershipToken=issueWriteToken('saving the daily-record batch');
  const docs=currentDailyRecordDocuments((Array.isArray(records)?records:[]).map(storedDailyRecordFields),'Daily Record batch');
  if(!docs.length)return true;
  const finishWrite=beginAuthoritativeWrite();
  try{
      assertWriteToken(ownershipToken,'the daily-record batch transaction');
    await idbPutDailyRecordBatch(docs,{ownershipToken});
    assertWriteToken(ownershipToken,'the daily-record batch cleanup');
    cleanupCommittedDailyRecords(docs);
    reportCanonicalCommit('dailyRecord','upsert');
    notifyDailyRecordsChanged('','batch');
    return true;
  }catch(e){
    if(isOwnershipLostError(e))throw e;
    assertWriteToken(ownershipToken,'the daily-record batch fallback write');
    showStorageFallbackWarning(e&&(e as {message?:unknown;code?:unknown;name?:unknown;reason?:unknown}|null|undefined)?.message?(e as {message?:unknown;code?:unknown;name?:unknown;reason?:unknown}|null|undefined)?.message:'saved-date batch save failed');
    const existing=fallbackDailyRecordsGet(),merged=mergeDailyRecordSets(existing,docs);
    const capped=capFallbackDailyRecords(merged,rescueRoom(STORAGE_KEYS.fallbackDailyRecords,APP_LIMITS.fallbackDailyRecordsBytes)),retainedDates=new Set(capped.map(record=>record.date));
    if(merged.some(record=>!retainedDates.has(record.date))){
      throw new Error(`IndexedDB is unavailable and this batch exceeds the emergency fallback capacity (${FALLBACK_DAILY_RECORD_LIMIT} records / ${Math.round(APP_LIMITS.fallbackDailyRecordsBytes/1048576)} MB). Existing fallback records were preserved and nothing from this batch was written; keep the backup file and retry after storage recovers.`);
    }
    if(!fallbackDailyRecordsSet(capped))throw LocalStorageContract.lastError||e;
    InsightsDatasetRevision.invalidateVolatile('fallback-daily-record-batch');
    notifyDailyRecordsChanged('','batch');
    return true;
  }finally{finishWrite();}
}
async function getDailyRecordInsightsSnapshot(options:{yieldProjection?:boolean}={}){
  const fallback=fallbackDailyRecordsGet(),yieldProjection=options&&options.yieldProjection===true;
  try{
    const snapshot=await idbInsightsDailySnapshot(),storedRecords=Array.isArray(snapshot.records)?snapshot.records:[],storedSummaries=Array.isArray(snapshot.summaries)?snapshot.summaries:[],cleanSummaries=storedSummaries.map(sanitizeDailyRecordSummary);
    const summaryKeys=cleanSummaries.filter((row):row is DailySummary=>row!==null).map(row=>row.date).sort(),recordKeys=storedRecords.map(row=>String((row as {date?:unknown}|null)?.date||'')).filter(isValidIsoDate).sort();
    const projectionCurrent=!fallback.length&&!cleanSummaries.some(row=>!row)&&summaryKeys.length===recordKeys.length&&summaryKeys.every((date,index)=>date===recordKeys[index]);
    const canonicalRecords=filterPendingDeletedEntities(mergeDailyRecordSets(storedRecords,fallback),'dailyRecord','date');
    let summaries;
    if(projectionCurrent)summaries=filterPendingDeletedEntities(cleanSummaries.filter((row):row is DailySummary=>row!==null),'dailyRecord','date').map(materializeDailyRecordSummary);
    else{
      summaries=canonicalRecords.map(record=>materializeDailyRecordSummary(buildDailyRecordSummary(record))).filter(Boolean);
      if(!fallback.length&&appCanMutate())void repairDailySummaries().catch(error=>AppDiagnostics.capture('daily-summaries.repair',error,'warn'));
    }
    if(fallback.length)void replayFallbackDailyRecords(fallback);else confirmDailyRecordStorage();
    const records=sortDailyRecordsAsc(await materializeDailyRecordViews(canonicalRecords,{yieldProjection})).filter(record=>record.recordKind==='study');
    return freeze({summaries:freeze(sortDailySummariesAsc(summaries)),records:freeze(records)});
  }catch(error){
    if(isCanonicalRuntimeError(error))throw error;
    const [summaries,records]=await Promise.all([getSortedDailyRecordSummaries(),getDailyRecordsForWindow({yieldProjection})]);
    return freeze({summaries:freeze(summaries),records:freeze(records)});
  }
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
      const records=filterPendingDeletedEntities(await idbAllRecords(),'dailyRecord',value=>repositoryFields(value)?.date);
      if(appCanMutate())void repairDailySummaries().catch(error=>AppDiagnostics.capture('daily-summaries.repair',error,'warn'));
      confirmDailyRecordStorage();
      return records.map(record=>materializeDailyRecordSummary(buildDailyRecordSummary(record!)));
    }
    const records=filterPendingDeletedEntities(mergeDailyRecordSets(await idbAllRecords(),fallback),'dailyRecord','date');
    void replayFallbackDailyRecords(fallback);
    return records.map(record=>materializeDailyRecordSummary(buildDailyRecordSummary(record!)));
  }catch(e){
    if(isCanonicalRuntimeError(e))throw e;
    try{
      const records=filterPendingDeletedEntities(mergeDailyRecordSets(await idbAllRecords(),fallback),'dailyRecord','date');
      if(records.some(record=>!record))throw e;
      if(appCanMutate())void repairDailySummaries().catch(error=>AppDiagnostics.capture('daily-summaries.repair',error,'warn'));
      return records.map(record=>materializeDailyRecordSummary(buildDailyRecordSummary(record!)));
    }catch(storageError){
      if(isCanonicalRuntimeError(storageError))throw storageError;
      showStorageFallbackWarning(storageError&&(storageError as {message?:unknown;code?:unknown;name?:unknown;reason?:unknown}|null|undefined)?.message?(storageError as {message?:unknown;code?:unknown;name?:unknown;reason?:unknown}|null|undefined)?.message:'saved-date database failed');
      return filterPendingDeletedEntities(fallback,'dailyRecord','date').map(record=>materializeDailyRecordSummary(buildDailyRecordSummary(record!)));
    }
  }
}
function sortDailySummariesAsc(summaries:readonly (SummaryView|null)[]){return (summaries||[]).map(summary=>{const {dayOfWeek,dayName,...raw}=summary||{};return materializeDailyRecordSummary(raw);}).filter(value=>value!==null).sort((a,b)=>a.date.localeCompare(b.date));}
function sortDailyRecordsAsc<T extends {date:string}>(records:readonly (T|null)[]):T[]{return (records||[]).filter((r):r is T=>!!r&&isValidIsoDate(r.date)).sort((a,b)=>a.date.localeCompare(b.date));}
async function getSortedDailyRecordSummaries(){return sortDailySummariesAsc(await getDailyRecordSummaries());}
async function getSortedDailyRecords(options:{yieldProjection?:boolean}={}){return sortDailyRecordsAsc(await getDailyRecords(options));}
async function getDailyRecordsForWindow(options:WindowOptions={}){
  const opts=options&&typeof options==='object'?options:{};
  if(opts.windowDays||opts.from||opts.to||opts.limit){
    const summaries=(await getSortedDailyRecordSummaries()).filter(summary=>summary?.recordKind==='study');
    const recordWindow=normalizeInsightsRecordWindowOptions(opts,summaries);
    try{
      const fallback=fallbackDailyRecordsGet();
      const idbRecords=await idbGetRecordsByDates(recordWindow.dates);
      const records=filterPendingDeletedEntities(mergeDailyRecordSets(idbRecords,fallback.filter(r=>recordWindow.dates.includes(r.date))),'dailyRecord','date');
      return sortDailyRecordsAsc(await materializeDailyRecordViews(records,{yieldProjection:opts.yieldProjection===true})).filter(record=>record.recordKind==='study');
    }catch(e){
      if(isCanonicalRuntimeError(e))throw e;
      const records=await Promise.all(recordWindow.dates.map(date=>getDailyRecord(date)));
      return sortDailyRecordsAsc(records).filter(record=>record.recordKind==='study');
    }
  }
  return (await getSortedDailyRecords({yieldProjection:opts.yieldProjection===true})).filter(record=>record.recordKind==='study');
}
async function getDailyRecord(date:string,options:{strict?:boolean}={}){
  const fallback=fallbackDailyRecordsGet().find(r=>r.date===date)||null;
  try{
    const record=newerDailyRecord(readableDailyRecord(await idbGetRecord(date)),fallback);
    if(fallback)void replayFallbackDailyRecords([fallback]);
    else confirmDailyRecordStorage();
    const value=pendingDeletionShadowsEntity('dailyRecord',date,record)?null:materializeDailyRecordView(record);
    return value;
  }catch(e){
    if(options.strict||isCanonicalRuntimeError(e))throw e;
    showStorageFallbackWarning(e&&(e as {message?:unknown;code?:unknown;name?:unknown;reason?:unknown}|null|undefined)?.message?(e as {message?:unknown;code?:unknown;name?:unknown;reason?:unknown}|null|undefined)?.message:'saved-date database failed');
    return materializeDailyRecordView(fallback);
  }
}
async function getDailyRecords(options:{strict?:boolean;yieldProjection?:boolean}={}){
  const fallback=fallbackDailyRecordsGet();
  try{
    const raw=filterPendingDeletedEntities(mergeDailyRecordSets(await idbAllRecords(),fallback),'dailyRecord','date');
    if(fallback.length)void replayFallbackDailyRecords(fallback);
    else confirmDailyRecordStorage();
    return materializeDailyRecordViews(raw,{yieldProjection:options?.yieldProjection===true});
  }catch(e){
    if(options?.strict||isCanonicalRuntimeError(e))throw e;
    showStorageFallbackWarning(e instanceof Error?e.message:'saved-date database failed');
    return materializeDailyRecordViews(fallback);
  }
}
async function materializeDailyRecordViews(records:DailyRecord[],{yieldProjection=false}={}){
  const source=Array.isArray(records)?records:[],out=[],batchSize=128;
  for(let start=0;start<source.length;start+=batchSize){
    const end=Math.min(source.length,start+batchSize);
    for(let index=start;index<end;index+=1){const value=materializeDailyRecordView(source[index]);if(value)out.push(value);}
    if(yieldProjection&&end<source.length)await new Promise(resolve=>setTimeout(resolve,0));
  }
  return out;
}
async function removeDailyRecord(date:string,options:{rollback?:boolean;backupCapture?:boolean}={}){
  const rollback=options&&options.rollback===true,backupCapture=options&&options.backupCapture===true;
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
      if(!rollback)reportCanonicalCommit('dailyRecord','delete',null,{backupCapture});
      if(fallbackHadRecord&&!(result&&result.changed))InsightsDatasetRevision.invalidateVolatile('fallback-daily-record-delete');
      removed=true;
    }catch(e){
      if(isOwnershipLostError(e))throw e;
      if(rollback||!staged)throw e;
      assertWriteToken(ownershipToken,'the daily-record fallback deletion');
      showStorageFallbackWarning(e&&(e as {message?:unknown;code?:unknown;name?:unknown;reason?:unknown}|null|undefined)?.message?(e as {message?:unknown;code?:unknown;name?:unknown;reason?:unknown}|null|undefined)?.message:'saved-date database failed');
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
    if(fallback.length)await replayFallbackDailyRecords(fallback);
    if(fallbackDailyRecordsGet().length)throw new Error('Saved-date fallback records could not be moved into IndexedDB. Nothing was deleted. Export a backup and retry after browser storage recovers.');
    assertWriteToken(ownershipToken,'the atomic Library clear');
    const result=await idbStrictTransaction<Readonly<{count:number;dates:readonly string[]}>>([DB_DAILY_RECORD_STORE,DB_DAILY_SUMMARY_STORE,DB_APP_META_STORE],'readwrite',(tx,finish)=>{
      assertWriteToken(ownershipToken,'the atomic Library clear transaction');
      const records=tx.objectStore(DB_DAILY_RECORD_STORE),summaries=tx.objectStore(DB_DAILY_SUMMARY_STORE),meta=Meta.view(tx);
      const request=typeof records.getAllKeys==='function'?records.getAllKeys():records.openKeyCursor();
      const dates:string[]=[];let revisionState:RevisionState|null=null;
      request.onerror=()=>finish(false,request.error||new Error('Saved-date key read failed'));
      request.onsuccess=event=>{
        if(typeof records.getAllKeys!=='function'){
          const cursor=(event.target as IDBRequest<IDBCursor|null>).result;if(cursor){dates.push(String(cursor.key));cursor.continue();return;}
        }else dates.push(...((request as IDBRequest<IDBValidKey[]>).result||[]).map(String));
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

const NotesRepository=NotesRepositoryModule.create(freeze({
      configuration:freeze({
        limits:APP_LIMITS,dataContract:DATA_CONTRACT,
        stores:freeze({notes:DB_NOTES_STORE,appMeta:DB_APP_META_STORE}),
        keys:freeze({noteRescue:STORAGE_KEYS.noteRescue})
      }),
      storage:freeze({local:LocalStorageContract,meta:Meta,idbGetAll,idbStoreTransaction,idbStrictTransaction,storageResets:()=>IndexedDb.lifecycle().resets}),
      codecs:freeze({sanitizeCurrentNote,noteKeys:DailyRecordCodec.noteKeys}),keyedRecord:KeyedRecord,
      helpers:freeze({clampText,clampEditorContent,editorContentWithinLimits,wipeObject,normalizeAreaName,displayAreaName,normalizeTimestamp,sameDataValue,jsonByteLength,canonicalRuntimeError,isCanonicalRuntimeError,rescueRoom:()=>rescueRoom(STORAGE_KEYS.noteRescue,APP_LIMITS.noteRescueBytes)}),
      hooks:freeze({
        canMutate:appCanMutate,storageOk:markStorageHealthOk,reportCommit:reportCanonicalCommit,
        onNotesChanged:refreshNoteConsumers,onNoteSyncState:setNoteSyncStateForKey,onNoteConflict:reportNoteConflict,saveWarning:showSubjectNoteSaveWarning,
        diagnosticsCapture:(scope:string,error:unknown,level:'warn'|'error')=>AppDiagnostics.capture(scope,error,level)
      }),
      canonical:freeze({noteDeletionValue,notePreparationUnit,stageMutationEpoch:stageCanonicalMutationEpoch,normalizeNoteDeletions}),
      clock:freeze({nowMs:decisionNowMs}),
      saveLane:input.saveLaneModule
    }));
function normalizeInsightsRecordWindowOptions(options:WindowOptions,summaries:readonly {recordKind?:string;date:string}[]){
  const opts=options&&typeof options==='object'?options:{};
  const limit=Number.isFinite(Number(opts.limit))?Math.max(0,Math.floor(Number(opts.limit))):0;
  const windowDays=Number.isFinite(Number(opts.windowDays))?Math.max(0,Math.floor(Number(opts.windowDays))):0;
  const fromDay=isValidIsoDate(opts.from)?isoDateDay(opts.from!):null;
  const toDay=isValidIsoDate(opts.to)?isoDateDay(opts.to!):null;
  let dates=(summaries||[]).filter(s=>!s||s.recordKind===undefined||s.recordKind==='study').map(s=>s&&s.date).filter(isValidIsoDate).sort((a,b)=>a.localeCompare(b));
  if(toDay!==null)dates=dates.filter(date=>isoDateDay(date)<=toDay);
  if(fromDay!==null)dates=dates.filter(date=>isoDateDay(date)>=fromDay);
  if(windowDays>0&&dates.length){
    const endDay=toDay!==null?toDay:isoDateDay(dates[dates.length-1]!);
    const startDay=endDay-windowDays+1;
    dates=dates.filter(date=>isoDateDay(date)>=startDay&&isoDateDay(date)<=endDay);
  }
  if(limit>0)dates=dates.slice(-limit);
  return {dates};
}
const DATA_MAINTENANCE_INTERVAL_MS=24*60*60*1000;
let dataMaintenancePromise:Promise<MaintenanceResult>|null=null,dataMaintenanceContinuation:{owner:number;source:unknown[];phase:number}|null=null,dataMaintenanceAborted=false;
async function runDataMaintenance(options:MaintenanceOptions={}):Promise<MaintenanceResult>{
  const force=!!(options&&options.force);
  if(!appCanMutate())return {status:'skipped',reason:'not-primary'};
  if(!IndexedDb.isAvailable())return {status:'skipped',reason:'indexeddb-unavailable'};
  if(dataMaintenancePromise)return dataMaintenancePromise;
  dataMaintenancePromise=(async():Promise<MaintenanceResult>=>{
    const ownershipRevision=getOwnershipRevision();
    const requireSameOwner=()=>{
      options.check?.();
      if(!appCanMutate()||getOwnershipRevision()!==ownershipRevision)throw new Error('Data maintenance stopped because app ownership changed');
    };
    requireSameOwner();const previous=await readMetadata('dataMaintenance');
    const lastRun=Date.parse(String(previous&&previous.completedAt||''));
    const maintenanceCurrent=Number(previous&&previous.version)===DATA_MAINTENANCE_VERSION&&previous?.status==='completed';
    if(!force&&maintenanceCurrent&&Number.isFinite(lastRun)&&decisionNowMs()-lastRun<DATA_MAINTENANCE_INTERVAL_MS){
      return {status:'skipped',reason:'recent',lastRun:new Date(lastRun).toISOString()};
    }
    requireSameOwner();
    await Meta.write('dataMaintenance',{version:DATA_MAINTENANCE_VERSION,status:'pending',completedAt:Number.isFinite(lastRun)?new Date(lastRun).toISOString():''},{strict:true,abortMessage:'data maintenance intent write aborted'});
    // The durable marker retains intent across reload. This in-memory cursor
    // retains completed phases only while their source and owner remain current;
    // a reload safely revalidates all phases rather than trusting stale proof.
    const readSource=async()=>{
      const epoch=await readMetadata('canonicalMutationEpoch'),local=[];
      for(const key of [STORAGE_KEYS.fallbackDailyRecords,STORAGE_KEYS.recovery,STORAGE_KEYS.deletionRecovery,STORAGE_KEYS.noteRescue]){
        local.push(LocalStorageContract.getText(key,null));if(LocalStorageContract.lastError)throw LocalStorageContract.lastError;
      }
      requireSameOwner();return [epoch?.token||'',NotesRepository.metadataSnapshot().revision,activeSessionMutationEpoch,...local];
    };
    const sameSource=(a:unknown[],b:unknown[]|undefined)=>!!b&&a.length===b.length&&a.every((value,index)=>value===b[index]);
    const source=await readSource();
    if(force||dataMaintenanceContinuation?.owner!==ownershipRevision||!sameSource(source,dataMaintenanceContinuation.source))dataMaintenanceContinuation={owner:ownershipRevision,source,phase:0};
    const continuation=dataMaintenanceContinuation,phases=[
      async()=>{const fallback=fallbackDailyRecordsGet();if(fallback.length)await replayFallbackDailyRecords(fallback,{strict:true});},
      async()=>{if(await NotesRepository.load({strict:true})!==true)throw new Error('Notes could not be loaded for maintenance.');},
      async()=>{await NotesRepository.flush({strict:true});},
      async()=>{const rawRecovery=readLocalRecoveryJson(STORAGE_KEYS.recovery,null);if(rawRecovery&&!sessionFromRecoveryEnvelope(rawRecovery)&&!LocalStorageContract.remove(STORAGE_KEYS.recovery))throw LocalStorageContract.lastError||new Error('Invalid session recovery could not be removed.');},
      async()=>{const session=await loadActiveSessionRecord(0,{strict:true});if(!session?.ok||session.error)throw session?.error||new Error('Active Session reconciliation is incomplete.');},
      async()=>{if(await flushDeletionRecovery({check:requireSameOwner,workBudget:options.workBudget})!==true)throw new Error('Pending deletion recovery is incomplete.');},
      async()=>{await pruneDeletionLedgers();}
    ];
    while(continuation.phase<phases.length){
      requireSameOwner();options.workBudget?.check();
      await phases[continuation.phase]!();requireSameOwner();
      const nextSource=await readSource();
      // Even a repair can change the source underlying earlier phase proof.
      // Revalidate from the beginning once; idempotent repairs then converge.
      continuation.phase=sameSource(nextSource,continuation.source)?continuation.phase+1:0;continuation.source=nextSource;options.workBudget?.advance();
    }
    requireSameOwner();const report={version:DATA_MAINTENANCE_VERSION,status:'completed' as const,completedAt:new Date().toISOString()};
    await Meta.write('dataMaintenance',report,{updatedAt:report.completedAt,strict:true,abortMessage:'data maintenance metadata write aborted'});
    dataMaintenanceContinuation=null;dataMaintenanceAborted=false;
    markStorageHealthOk('maintenance');
    return report;
  })().catch((error:unknown):MaintenanceResult=>{
    if((error as {message?:unknown;code?:unknown;name?:unknown;reason?:unknown}|null|undefined)?.code==='DATA_MAINTENANCE_YIELDED'||(error as {message?:unknown;code?:unknown;name?:unknown;reason?:unknown}|null|undefined)?.code==='NOTE_RECOVERY_SUPERSEDED'){const reason=(error as {message?:unknown;code?:unknown;name?:unknown;reason?:unknown}|null|undefined)?.code==='NOTE_RECOVERY_SUPERSEDED'?'notes-changed':(error as {message?:unknown;code?:unknown;name?:unknown;reason?:unknown}|null|undefined)?.reason;if(reason!=='budget')dataMaintenanceContinuation=null;return {status:'yielded',reason,phase:dataMaintenanceContinuation?.phase||0};}
    if(error&&(error as {message?:unknown;code?:unknown;name?:unknown;reason?:unknown}|null|undefined)?.message==='Data maintenance stopped because app ownership changed')return {status:'skipped',reason:'ownership-changed'};
    // A transaction aborted from outside (the browser clearing site data
    // mid-run) is retried once without an error; a second abort in a row is
    // a real failure and is reported.
    if((error as {message?:unknown;code?:unknown;name?:unknown;reason?:unknown}|null|undefined)?.name==='AbortError'&&!dataMaintenanceAborted){dataMaintenanceAborted=true;dataMaintenanceContinuation=null;return {status:'yielded',reason:'interrupted',phase:0};}
    dataMaintenanceAborted=false;
    AppDiagnostics.capture('maintenance.run',error,'error');
    markStorageHealthError('maintenance',`Data maintenance failed: ${error&&(error as {message?:unknown;code?:unknown;name?:unknown;reason?:unknown}|null|undefined)?.message||'data maintenance failed'}`);
    return {status:'failed',reason:error&&(error as {message?:unknown;code?:unknown;name?:unknown;reason?:unknown}|null|undefined)?.message||String(error)};
  }).finally(()=>{dataMaintenancePromise=null;});
  return dataMaintenancePromise;
}


    async function getDailyRecordDocumentsByDates(dates:readonly string[],options:CanonicalReadOptions={}){
      const requested=[...new Set((dates||[]).filter(isValidIsoDate))];
      const fallback=fallbackDailyRecordsGet().filter(record=>requested.includes(record.date));
      try{
              return filterPendingDeletedEntities(
          mergeDailyRecordSets(await idbGetRecordsByDates(requested),fallback),
          'dailyRecord','date'
        );
      }catch(error){if(isCanonicalRuntimeError(error)||options&&options.requireCanonical===true)throw error;return fallback;}
    }
    async function getBackupDailyRecordMonth(month:unknown,options:CanonicalReadOptions={}){
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
    async function storeImportedDailyRecordBatches(records:readonly DailyRecord[],options:ImportOptions={}){
      if(!records.length)return {committed:0,batches:0};
      const ownershipToken=issueWriteToken('importing daily records');
      const finishWrite=beginAuthoritativeWrite();
      const onProgress=typeof options.onProgress==='function'?options.onProgress:()=>{};
      const signal=options.signal||null,yieldControl=typeof options.yieldControl==='function'?options.yieldControl:async()=>{};
      const checkCancelled=()=>{if(signal&&signal.aborted){const reason:unknown=signal.reason;const error=reason instanceof Error?reason:new Error(String(reason||'Backup import was cancelled.'));if(!(error as {message?:unknown;code?:unknown;name?:unknown;reason?:unknown}|null|undefined)?.code)Object.assign(error,{code:'STUDY_DIRECTOR_IMPORT_CANCELLED'});throw error;}};
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
          cleanupCommittedDailyRecords(batch);
          committed+=batch.length;batches++;
          onProgress(freeze({committed,total:records.length,batches}));
          await yieldControl();checkCancelled();
        }
        if(committed)reportCanonicalCommit('dailyRecord','upsert');
        notifyDailyRecordsChanged('','import');
        return {committed,batches};
      }catch(error){
        if(isOwnershipLostError(error))throw error;
        const failure=Object.assign(new Error(`Import stopped after ${committed} daily record${committed===1?'':'s'} were committed in ${batches} complete batch${batches===1?'':'es'}. The failed batch was rolled back. Keep the backup and retry after storage recovers.`),{code:undefined as unknown,committedRecords:0,committedBatches:0});
        failure.cause=error;
        if(error&&(error as {message?:unknown;code?:unknown;name?:unknown;reason?:unknown}|null|undefined)?.code)failure.code=(error as {message?:unknown;code?:unknown;name?:unknown;reason?:unknown}|null|undefined)?.code;
        if(error&&(error as {message?:unknown;code?:unknown;name?:unknown;reason?:unknown}|null|undefined)?.name)failure.name=String((error as {message?:unknown;code?:unknown;name?:unknown;reason?:unknown}|null|undefined)?.name);
        failure.committedRecords=committed;
        failure.committedBatches=batches;
        throw failure;
      }
      }finally{finishWrite();}
    }
    async function getBackupDailyRecordDates(){
      const fallbackDates=fallbackDailyRecordsGet().map(record=>record.date).filter(isValidIsoDate);
      let idbDates:string[]=[],warning='',canonical=true;
      try{
              idbDates=await idbStoreTransaction<string[]>(DB_DAILY_RECORD_STORE,'readonly',(store,tx,finish)=>{
          if(typeof store.getAllKeys==='function'){
            const req=store.getAllKeys();
            req.onsuccess=()=>finish(true,(req.result||[]).map(String));
            req.onerror=()=>finish(false,req.error);
            return;
          }
          const out:string[]=[],req=store.openKeyCursor();
          req.onsuccess=event=>{
            const cursor=(event.target as IDBRequest<IDBCursor|null>).result;
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
      verifyCanonical:verifyCanonicalDailyRecord,
      verifyCanonicalAbsent:verifyCanonicalDailyRecordAbsent,
      saveBatch:storeDailyRecordBatch,
      restoreBatch:(records:readonly unknown[])=>storeDailyRecordBatch(records),
      get:getDailyRecord,
      list:getDailyRecords,
      summaries:getDailyRecordSummaries,
      remove:removeDailyRecord,
      clearAll:clearAllDailyRecords,
      sortedSummaries:getSortedDailyRecordSummaries,
      sortedList:getSortedDailyRecords,
      insightsSnapshot:getDailyRecordInsightsSnapshot,
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
      get:NotesRepository.get,
      update:NotesRepository.update,
      updateValidatedRich:NotesRepository.updateValidatedRich,
      link:NotesRepository.link,
      linkedFrom:NotesRepository.linkedFrom,
      remove:NotesRepository.remove,
      clearAll:NotesRepository.clearAll,
      load:NotesRepository.load,
      reloadFresh:NotesRepository.reloadFresh,
      readFreshPayload:NotesRepository.readFreshPayload,
      readFreshItems:NotesRepository.readFreshItems,
      failure:NotesRepository.failure,
      exportPayload:NotesRepository.exportPayload,
      metadataSnapshot:NotesRepository.metadataSnapshot,
      searchSnapshot:NotesRepository.searchSnapshot,
      normalizePayload:NotesRepository.normalizePayload,
      alignByTitle:NotesRepository.alignByTitle,
      replace:NotesRepository.replace,
      reconcile:NotesRepository.reconcile,
      size:NotesRepository.size,
      flush:NotesRepository.flush,
      protectUnsaved:NotesRepository.protectUnsaved,
      trash:NotesRepository.trash,
      restore:NotesRepository.restore,
      rename:NotesRepository.rename,
      trashSnapshot:NotesRepository.trashSnapshot,
      purgeExpiredTrash:NotesRepository.purgeExpiredTrash,
      recoverAfterStorageLoss:NotesRepository.recoverAfterStorageLoss
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
        const noteFailure=NotesRepository.failure();
        return !(noteFailure&&noteFailure.failed);
      }catch(error){capture('canonical-mutation-epoch.eligibility',error,'warn');return false;}
    }
    const mutationEpoch=freeze({
      read:readCanonicalMutationEpoch,
      nextChangeAt,
      seedChangeClock,
      latestChangeAt,
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
      notes:listNoteDeletions,
      replaceNotes:replaceNoteDeletions,
      attachments:listAttachmentDeletions,
      replaceAttachments:replaceAttachmentDeletions,
      recordAttachment:recordAttachmentDeletion,
      clearAttachment:clearAttachmentDeletion,
      stageAttachments:stageAttachmentDeletionState
    });
    const pendingReviews=freeze({list:listPendingReviews,readItems:readPendingReviewItems,merge:(values:unknown)=>writePendingReviews(values),replace:(values:unknown)=>writePendingReviews(values,{replace:true}),resolve:resolvePendingReviews});
    const maintenanceApi=freeze({intervalMs:DATA_MAINTENANCE_INTERVAL_MS,status:()=>freeze({busy:!!dataMaintenancePromise}),run:runDataMaintenance,repairSummaries:repairDailySummaries,settled:()=>dataMaintenancePromise||Promise.resolve()});

    async function verifyCurrentRepositoryMetadata(){
      const issues=[],families=['planDraft','planLibrary','personalPreferences','canonicalMutationEpoch','insightsDatasetRevision','dataMaintenance'];let rows=0;
      const results=await Promise.allSettled([...families.map(name=>Meta.readEntry(name)),Meta.list('backupPreparationUnitPrefix')]);
      results.forEach((result,index)=>{
        const family=index===results.length-1?'backupPreparationUnitPrefix':families[index];
        if(result.status==='rejected')issues.push(`${family}:${String((result.reason as {message?:unknown}|null|undefined)?.message||result.reason)}`);
        else if(index===results.length-1)rows+=Array.isArray(result.value)?result.value.length:0;
        else if(result.value)rows++;
      });
      const rescueProof=NotesRepository.verifyRescue();
      issues.push(...rescueProof.issues);
      return freeze({ok:issues.length===0,issues:freeze(issues),rows:rows+rescueProof.rows});
    }
    const metadata=freeze({verifyCurrent:verifyCurrentRepositoryMetadata,diagnostics:async()=>{
      const maintenance=await readMetadata('dataMaintenance'),deletions=pendingDeletionEntries();
      const localRecovery=LocalStorageContract.getText(STORAGE_KEYS.recovery,null)!==null;if(LocalStorageContract.lastError)throw LocalStorageContract.lastError;
      return freeze({maintenanceStatus:maintenance?.status||'never',completedAt:maintenance?.completedAt||'',deletions:deletions.length,localRecovery});
    }});

    const restoreJournal=RepositoryJournals.restoreJournal;
    const libraryClearJournal=RepositoryJournals.libraryClearJournal;
    const mutationLease=RepositoryJournals.mutationLease;
    return freeze({
      format:'study-director.app-data',
      contractVersion:1,
      get lastStorageError(){return LocalStorageContract.lastError;},
      local,planData,personalPreferences,dailyRecords,notes,activeSession,pendingReviews,provenance,mutationEpoch,preparationUnits,deletionRecovery,restoreJournal,libraryClearJournal,mutationLease,maintenance:maintenanceApi,metadata
    });
  }
  return freeze({
    format:'study-director.repositories',
    contractVersion:1,
    createAppMetaValidators,
    createAppData
  });
};
registry.define('repositories',1,createModule);
return createModule;
})();
export type RepositoriesModule=ReturnType<typeof sdRepositoriesFactory>;
