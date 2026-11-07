(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,functionPort:functions}=registry.contracts;
registry.define('compatibility-host',1,()=>{
  const freeze=Object.freeze,LEGACY_BACKUP_PROVIDER_OPERATION_PREFIX='backupProviderOperation:';
  function normalizeInstallationIdentity(value){return /^inst_[a-z0-9_]{8,128}$/i.test(String(value||''))?String(value):'';}
  function legacyInstallationIdentity(value){const match=/^dev_([a-z0-9_]{8,128})$/i.exec(String(value||''));return match?`inst_${match[1]}`:'';}

  function createFacade(input){
    exactObject(input,['baselineId','facadeFactory','keys','local','ownership','plan','preferences','identity','metadata','live','topology','verification','backups','helpers'],'Compatibility-host input');
    if(typeof input.baselineId!=='string'||!input.baselineId||typeof input.facadeFactory!=='function')throw new TypeError('Compatibility-host facade configuration is invalid.');
    exactObject(input.keys,['storage','obsolete','appMeta','renamedAppMeta','renamedLocal','renamedFormats'],'Compatibility-host key contract');
    const validPairs=pairs=>Array.isArray(pairs)&&Object.isFrozen(pairs)&&pairs.every(pair=>Array.isArray(pair)&&pair.length===2&&typeof pair[0]==='string'&&typeof pair[1]==='string'&&!!pair[0]&&!!pair[1]&&pair[0].endsWith(':')===pair[1].endsWith(':'));
    if(!validPairs(input.keys.renamedAppMeta))throw new TypeError('Compatibility-host renamed appMeta identities are invalid.');
    if(!validPairs(input.keys.renamedLocal)||input.keys.renamedLocal.some(([from])=>from.endsWith(':')))throw new TypeError('Compatibility-host renamed browser-storage keys are invalid.');
    if(!Object.isFrozen(input.keys.renamedFormats)||Object.entries(input.keys.renamedFormats).some(([from,to])=>!from||typeof to!=='string'||!to))throw new TypeError('Compatibility-host renamed value formats are invalid.');
    exactObject(input.keys.appMeta,['personalPreferences','dataMaintenance','verifiedRecoveryBackups','attachmentIntegrityAudit','deviceFolder','restoreJournalPayload','repositoryIntegrityScrub','reconciliationBase','reconciliationBaseNotePrefix','reconciliationBaseDayPrefix','reconciliationBaseLegacy','repositoryMaintenancePending','repositoryMaintenancePendingLegacy','libraryClearJournalState','libraryClearJournalPayloadPrefix','archiveClearJournalStateLegacy','archiveClearJournalPayloadPrefixLegacy','backupPreparationUnitPrefix'],'Compatibility-host appMeta key contract');
    functions(input.local,['getText','getJson','setText','remove','lastError'],'Compatibility-host local storage');
    functions(input.ownership,['issueWriteToken','assertWriteToken','isOwnershipLostError'],'Compatibility-host ownership');
    functions(input.plan,['hydrate','library','readDraft','writeDraft','writeLibrary','settled','readCanonical'],'Compatibility-host Plan adapter');
    exactObject(input.preferences,['readRawRow','held','read','write','current','legacy','create','plans','accept','refreshMirrors','applyRuntime','normalizeTheme','normalizePresentation','normalizeFontScale','normalizeStudentName','normalizeQuote','normalizePracticeCueMode','normalizePracticeTargetMs'],'Compatibility-host Preferences adapter');
    for(const key of Object.keys(input.preferences))if(typeof input.preferences[key]!=='function')throw new TypeError(`Compatibility-host Preferences adapter ${key} must be a function.`);
    exactObject(input.identity,['getId','installationKey','legacyKey'],'Compatibility-host installation identity adapter');
    if(typeof input.identity.getId!=='function')throw new TypeError('Compatibility-host installation identity getId is required.');
    functions(input.metadata,['readRow','listRows','isCurrentDataMaintenance','writeValue','removeRow','releaseBackupFile','normalizeVerifiedRecovery','normalizeAttachmentIntegrity','normalizeRepositoryIntegrity','normalizeRepositoryIntegrityTarget','renameRows','updateStorageHealth'],'Compatibility-host metadata adapter');
    functions(input.live,['migrateActiveSession','migrateNotes','migrateNoteRecovery','migrateDeletionState','migrateDailyRecords','migrateInsightsRevisionEnvelope','cleanupLegacyAttachments','cleanupObsoleteMetadata','settleUnsupported'],'Compatibility-host live adapters');
    functions(input.topology,['retire'],'Compatibility-host topology adapter');
    functions(input.verification,['activeSession','notes','noteRecovery','deletionState','dailyRecords','insightsRevisionEnvelope','canonicalStores','legacyAttachments','obsoleteMetadata','topology','freshBackup'],'Compatibility-host verification adapters');
    functions(input.backups,['inspectCurrent','inspectLegacy'],'Compatibility-host backup adapters');
    exactObject(input.helpers,['same','randomUuid','nowIso','isNoteKey'],'Compatibility-host helpers');
    for(const key of Object.keys(input.helpers))if(typeof input.helpers[key]!=='function')throw new TypeError(`Compatibility-host helper ${key} must be a function.`);

    const keys=input.keys,local=input.local,ownership=input.ownership,plan=input.plan,preferences=input.preferences,identity=input.identity,metadata=input.metadata,helpers=input.helpers;
    const storage=keys.storage,obsolete=keys.obsolete,appMeta=keys.appMeta;
    const requireLastStorageError=()=>{const error=local.lastError();if(error)throw error;};

    function exactKeys(value,keys){return !!(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|'));}
    function validTimestamp(value){return typeof value==='string'&&Number.isFinite(Date.parse(value));}
    const isoTime=value=>validTimestamp(value)?new Date(value).toISOString():'';
    // The last-backup record, version 3, keeps one shape for every copy: when
    // it was made, the change it holds and its backup format; the last portable
    // file (downloads included) is file. Version 1, the released one, kept a
    // type, id, label and app version on every entry (derivable or unused) and
    // called the time verifiedAt (version 2 was never released). Storage health
    // once kept a last-backup time of any kind; that time becomes an unverified
    // file copy holding the changes made before it.
    function legacyVerifiedRecovery(value,backupAt){
      const version=value?Number(value.version):3;
      let file=null,providers={};
      if(version===3){const current=metadata.normalizeVerifiedRecovery(value);file=current.file;providers={...current.providers};}
      else if(version===1){
        const copy=row=>{const at=isoTime(row&&row.verifiedAt),sourceRevision=isoTime(row&&row.sourceRevision);return at&&sourceRevision?{at,sourceRevision,format:Number.isSafeInteger(row.backupFormatVersion)?row.backupFormatVersion:null}:null;};
        for(const [id,row] of Object.entries(value.providers&&typeof value.providers==='object'?value.providers:{})){const entry=copy(row);if(entry)providers[id]=entry;}
        const saved=copy(value.file);file=saved?{...saved,verified:true}:null;
      }else return null;
      const at=isoTime(backupAt);if(at&&(!file||Date.parse(at)>Date.parse(file.at)))file={at,sourceRevision:at,format:null,verified:false};
      return metadata.normalizeVerifiedRecovery({version:3,file,providers});
    }
    // Storage health keeps three facts: the change clock, when study data was
    // last saved here and an unresolved browser-data clear. These fields are
    // retired: a last-backup time (now in the backup record), save times per
    // kind (one study-data time instead), the browser's storage estimate
    // (measured at each launch) and the last error (shown live, never read back).
    const RETIRED_STORAGE_HEALTH_FIELDS=freeze(['lastBackupAt','lastLiveSaveAt','lastDailyRecordSaveAt','lastNotesSaveAt','lastIdbOkAt','lastError','lastErrorAt','lastErrorSource','updatedAt','storagePersisted','usageBytes','quotaBytes','usageRatio','lastEstimateAt']);
    const retiredHealthFields=health=>health&&typeof health==='object'?RETIRED_STORAGE_HEALTH_FIELDS.filter(field=>Object.hasOwn(health,field)):[];
    // Repository verification state versions 2 to 5 (the released ones) kept
    // one slot per known location; versions 3 to 5 also kept the Device
    // Folder's directory handle, which the repository scope replaces. The
    // current record is keyed by location id. Progress and quarantine carry
    // over. Version 6 was never released.
    const INTEGRITY_SLOTS=freeze({device:'device-folder',drive:'google-drive'});
    function legacyRepositoryIntegrity(value){
      const version=Number(value?.version);
      if(!value||!exactKeys(value,['version','device','drive'])||!Number.isSafeInteger(version)||version<2||version>5)return null;
      const stored=target=>{if(version<3||!target||typeof target!=='object')return target;const {repositoryHandle,...rest}=target;return rest;};
      const shape=target=>{
        const scan={completedAt:target.completedAt,cycleStartedAt:target.cycleStartedAt,cursor:target.cursor,failedAt:target.failedAt,quarantinedObjectIds:target.quarantinedObjectIds};
        if(version===2)return scan;if(version===3)return {repositoryScope:target.repositoryScope,scanId:target.scanId,...scan};
        if(version===4){const {recheckCursor,...prior}=target;return prior;}return target;
      };
      const locations={};
      for(const [slot,id] of Object.entries(INTEGRITY_SLOTS)){
        const source=stored(value[slot]),current=metadata.normalizeRepositoryIntegrityTarget(source);
        if(!helpers.same(source,shape(current)))return null;locations[id]=current;
      }
      return freeze({version:7,locations:freeze(locations)});
    }
    // A restore journal written before version 5 calls its note deletion list
    // areaNoteDeletions, and one written before version 4 lacks the later lists.
    // Version 6 removes scheduleText because the rollback image already carries
    // portable Plan data; session recovery no longer owns the working draft.
    const RESTORE_JOURNAL_VERSION=6;
    function legacyRestoreJournalPayload(value){
      const version=Number(value?.version);
      if(!value||typeof value!=='object'||value.format!=='study-director.restore-journal'||!(version>=1&&version<RESTORE_JOURNAL_VERSION))return null;
      const storageKey=value.backupFile?'backupFile':'blob';
      if(version===5){
        const fields=['format','version','id',storageKey,'filename','scheduleText','savedDayDeletions','noteDeletions','attachmentDeletions'];
        if(!exactKeys(value,fields)||!Array.isArray(value.savedDayDeletions)||!Array.isArray(value.noteDeletions)||!Array.isArray(value.attachmentDeletions))return null;
        const {scheduleText,...rest}=value;return freeze({...rest,version:RESTORE_JOURNAL_VERSION});
      }
      const lists=['savedDayDeletions','areaNoteDeletions','attachmentDeletions'].slice(0,version-1);
      if(!exactKeys(value,['format','version','id',storageKey,'filename','scheduleText',...lists])||lists.some(key=>!Array.isArray(value[key])))return null;
      const {areaNoteDeletions,scheduleText,...rest}=value;
      return freeze({...rest,version:RESTORE_JOURNAL_VERSION,savedDayDeletions:value.savedDayDeletions||[],noteDeletions:areaNoteDeletions||[],attachmentDeletions:value.attachmentDeletions||[]});
    }
    // Device Folder settings: version 1 kept the old backup slot, version 3 two
    // fields nothing reads any more. Both carry the folder and the change from
    // which it backs up on its own (then named sourceRevision).
    function legacyDeviceSettings(value){
      const version=Number(value?.version),fields=version===1?['format','version','enabled','directoryHandle','lastSlot','lastBackupAt','lastFilename','sourceRevision']:['format','version','enabled','directoryHandle','lastBackupAt','lastFilename','sourceRevision'];
      if(!value||(version!==1&&version!==3)||!exactKeys(value,fields)||value.format!=='study-director.device-folder-settings'||value.enabled!==true)return null;
      const handle=value.directoryHandle;if(!handle||typeof handle.getFileHandle!=='function'||typeof handle.getDirectoryHandle!=='function'||typeof handle.queryPermission!=='function')return null;
      return freeze({format:'study-director.device-folder-settings',version:4,directoryHandle:handle,baseline:validTimestamp(value.sourceRevision)?new Date(value.sourceRevision).toISOString():''});
    }
    // Provider maintenance intents: versions 1 to 3 lack later scheduling fields;
    // every version converts to the current version 4.
    const MAINTENANCE_FORMAT='study-director.repository-maintenance-pending',MAINTENANCE_VERSION=4;
    function normalizeRepositoryMaintenance(value){
      const version=Number(value&&value.version),entries=[],seen=new Set();
      if(!value||!exactKeys(value,['format','version','entries'])||value.format!==MAINTENANCE_FORMAT||!(version>=1&&version<=MAINTENANCE_VERSION)||!Array.isArray(value.entries)||value.entries.length>8)return null;
      const entryKeys=[['providerId','requestedAt'],['providerId','requestedAt','nextEligibleAt','reason'],['providerId','requestedAt','nextEligibleAt','reason','repositoryScope'],['providerId','requestedAt','nextEligibleAt','reason','repositoryScope','requestId']][version-1];
      for(const raw of value.entries){
        if(!raw||!exactKeys(raw,entryKeys))return null;
        const providerId=String(raw.providerId||''),requestedAt=String(raw.requestedAt||''),nextEligibleAt=version===1?requestedAt:String(raw.nextEligibleAt||''),reason=version===1?'legacy':String(raw.reason||''),repositoryScope=version>=3?String(raw.repositoryScope||''):'',requestId=version===4?raw.requestId:'';
        if(!/^[a-z][a-z0-9-]{0,40}$/u.test(providerId)||seen.has(providerId)||!validTimestamp(requestedAt)||!validTimestamp(nextEligibleAt)||!/^[a-z][a-z0-9-]{0,47}$/u.test(reason)||repositoryScope.length>320||typeof requestId!=='string'||requestId&&!/^[a-f0-9-]{36}$/u.test(requestId))return null;
        seen.add(providerId);entries.push(freeze({providerId,requestedAt,nextEligibleAt,reason,repositoryScope,requestId}));
      }
      return freeze({format:MAINTENANCE_FORMAT,version:MAINTENANCE_VERSION,entries:freeze(entries.sort((a,b)=>a.providerId.localeCompare(b.providerId)))});
    }
    // A merge base from before permanent ids names notes by title (version 1
    // kept them all in one row), one from before titles, plans and settings
    // were kept holds only text, and one from before Saved Days and the
    // session were kept (version 2) cannot tell their changes apart, and one
    // from before study-content and per-field ancestry (header versions 3 and
    // 4, Saved-Day rows version 1) cannot tell a re-saved day or a single
    // setting apart. It is dropped rather than converted: a base only lets
    // Combine settle a difference without asking, and the next Drive sync
    // records a fresh version-5 one. The app reads only version 5.
    function staleReconciliationRows(rows){
      const keyOf=row=>String(row&&row.key||''),noteRow=row=>keyOf(row).startsWith(appMeta.reconciliationBaseNotePrefix),dayRow=row=>keyOf(row).startsWith(appMeta.reconciliationBaseDayPrefix);
      const base=rows.filter(row=>keyOf(row)===appMeta.reconciliationBase||keyOf(row)===appMeta.reconciliationBaseLegacy||noteRow(row)||dayRow(row));
      return base.some(row=>keyOf(row)===appMeta.reconciliationBaseLegacy||keyOf(row)===appMeta.reconciliationBase&&Number(row.value?.version)!==5||dayRow(row)&&Number(row.value?.version)!==2||noteRow(row)&&(!helpers.isNoteKey(row.value&&row.value.key)||typeof row.value.label!=='string'))?base:[];
    }
    async function migrateReconciliationBase(requireOwnership){
      let removed=0;
      for(const row of staleReconciliationRows(await metadata.listRows())){requireOwnership();await metadata.removeRow(String(row.key));removed++;}
      return freeze({migrated:0,removed});
    }
    async function sha256Hex(bytes){
      if(!globalThis.crypto?.subtle)throw new Error('Historical Library-clear journal migration requires SHA-256 support.');
      const value=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
      const digest=await globalThis.crypto.subtle.digest('SHA-256',value);
      return Array.from(new Uint8Array(digest),part=>part.toString(16).padStart(2,'0')).join('');
    }
    function legacyLibraryClearState(value){
      return !!(value&&exactKeys(value,['format','version','id','phase','chunkCount','byteLength','sha256','signatureHash','createdAt','updatedAt'])&&value.format==='study-director.archive-clear-journal'&&Number(value.version)===1&&/^archiveclear_[a-z0-9_-]{8,96}$/u.test(String(value.id||''))&&/^[a-z][a-z0-9-]{1,48}$/u.test(String(value.phase||''))&&Number.isSafeInteger(Number(value.chunkCount))&&Number(value.chunkCount)>0&&Number.isSafeInteger(Number(value.byteLength))&&Number(value.byteLength)>0&&/^[a-f0-9]{64}$/u.test(String(value.sha256||''))&&/^[a-f0-9]{64}$/u.test(String(value.signatureHash||''))&&validTimestamp(value.createdAt)&&validTimestamp(value.updatedAt));
    }
    function legacyLibraryClearChunk(value,key,state){
      if(!value||!exactKeys(value,['format','version','id','index','bytes'])||value.format!=='study-director.archive-clear-journal'||Number(value.version)!==1||value.id!==state.id||!Number.isSafeInteger(Number(value.index))||Number(value.index)<0||!(value.bytes instanceof Uint8Array||value.bytes instanceof ArrayBuffer))return false;
      const expected=appMeta.archiveClearJournalPayloadPrefixLegacy+`${state.id}:${String(value.index).padStart(8,'0')}`;
      return String(key||'')===expected;
    }
    async function migrateLibraryClearJournal(requireOwnership){
      const rows=await metadata.listRows(),legacyStateRow=rows.find(row=>String(row&&row.key||'')===appMeta.archiveClearJournalStateLegacy)||null;
      const legacyChunkRows=rows.filter(row=>String(row&&row.key||'').startsWith(appMeta.archiveClearJournalPayloadPrefixLegacy));
      if(!legacyStateRow&&!legacyChunkRows.length)return freeze({status:'not-needed',migrated:0,removed:0});
      if(!legacyStateRow)throw new Error('Historical Library-clear journal chunks exist without their state record. They were preserved without modification.');
      const legacyState=legacyStateRow.value;if(!legacyLibraryClearState(legacyState))throw new Error('Historical Library-clear journal state has an unknown shape and was preserved without modification.');
      if(legacyChunkRows.length!==legacyState.chunkCount)throw new Error('Historical Library-clear journal is incomplete and was preserved without modification.');
      const ordered=legacyChunkRows.slice().sort((a,b)=>Number(a?.value?.index)-Number(b?.value?.index));let length=0;const chunks=[];
      for(let index=0;index<ordered.length;index++){const row=ordered[index],value=row?.value;if(!legacyLibraryClearChunk(value,row?.key,legacyState)||Number(value.index)!==index)throw new Error('Historical Library-clear journal chunks are invalid and were preserved without modification.');const bytes=value.bytes instanceof Uint8Array?value.bytes:new Uint8Array(value.bytes);chunks.push(bytes);length+=bytes.byteLength;}
      if(length!==legacyState.byteLength)throw new Error('Historical Library-clear journal byte length does not verify. It was preserved without modification.');
      const legacyBytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){legacyBytes.set(chunk,offset);offset+=chunk.byteLength;}
      if(await sha256Hex(legacyBytes)!==legacyState.sha256)throw new Error('Historical Library-clear journal checksum does not verify. It was preserved without modification.');
      let payload;try{payload=JSON.parse(new TextDecoder().decode(legacyBytes));}catch{throw new Error('Historical Library-clear rollback payload is unreadable and was preserved without modification.');}
      if(!payload||payload.format!=='study-director.archive-clear-rollback'||Number(payload.version)!==1||typeof payload.planSignature!=='string')throw new Error('Historical Library-clear rollback payload has an unknown shape and was preserved without modification.');
      if(await sha256Hex(new TextEncoder().encode(payload.planSignature))!==legacyState.signatureHash)throw new Error('Historical Library-clear rollback signature does not verify. It was preserved without modification.');
      const id=`libraryclear_${String(legacyState.id).slice('archiveclear_'.length)}`,canonicalPayload={...payload,format:'study-director.library-clear-rollback'},canonicalBytes=new TextEncoder().encode(JSON.stringify(canonicalPayload)),canonicalChunks=[];
      for(let start=0;start<canonicalBytes.byteLength;start+=512*1024)canonicalChunks.push(canonicalBytes.slice(start,Math.min(canonicalBytes.byteLength,start+512*1024)));
      const now=helpers.nowIso(),canonicalState={...legacyState,format:'study-director.library-clear-journal',id,chunkCount:canonicalChunks.length,byteLength:canonicalBytes.byteLength,sha256:await sha256Hex(canonicalBytes),updatedAt:now};
      const currentState=rows.find(row=>String(row&&row.key||'')===appMeta.libraryClearJournalState)||null;
      if(currentState&&String(currentState.value?.id||'')!==id)throw new Error('A current Library-clear journal already exists with a different identity. Historical journal migration was stopped.');
      requireOwnership();
      for(const row of rows)if(String(row&&row.key||'').startsWith(appMeta.libraryClearJournalPayloadPrefix))await metadata.removeRow(String(row.key));
      for(let index=0;index<canonicalChunks.length;index++)await metadata.writeValue(appMeta.libraryClearJournalPayloadPrefix+`${id}:${String(index).padStart(8,'0')}`,{format:'study-director.library-clear-journal',version:1,id,index,bytes:canonicalChunks[index]},now);
      await metadata.writeValue(appMeta.libraryClearJournalState,canonicalState,now);
      const verifiedRows=await metadata.listRows(),verifiedState=verifiedRows.find(row=>String(row&&row.key||'')===appMeta.libraryClearJournalState),verifiedChunks=verifiedRows.filter(row=>String(row&&row.key||'').startsWith(appMeta.libraryClearJournalPayloadPrefix));
      if(!verifiedState||!helpers.same(verifiedState.value,canonicalState)||verifiedChunks.length!==canonicalChunks.length)throw new Error('Library-clear journal migration could not be verified. Historical data was preserved.');
      requireOwnership();await metadata.removeRow(appMeta.archiveClearJournalStateLegacy);let removed=1;
      for(const row of legacyChunkRows){await metadata.removeRow(String(row.key));removed++;}
      return freeze({status:'migrated',migrated:1,removed});
    }
    // Record names once carried a version (planDraft.v1), and notes and the
    // Device Folder once had other names; a name is now stable and the version
    // lives inside the value. Every renamed record moves to its new name, its
    // value format renamed with it, in one transaction before anything else
    // reads it; a renamed browser-storage value moves the same way. Backup
    // preparation stamps for units under an old name are only hints (the next
    // backup reads every unit afresh), so they are dropped.
    const renamed=keys.renamedAppMeta,renamedLocal=keys.renamedLocal,renamedFormats=keys.renamedFormats;
    const renamedFrom=key=>renamed.find(([from])=>from.endsWith(':')?key.startsWith(from):key===from)||null;
    const RETIRED_PREPARATION_UNIT='areaNote:';
    const retiredStamp=row=>String(row&&row.key||'').startsWith(appMeta.backupPreparationUnitPrefix)&&String(row?.value?.unit||'').startsWith(RETIRED_PREPARATION_UNIT);
    const withRenamedFormat=value=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.hasOwn(renamedFormats,String(value.format))?{...value,format:renamedFormats[value.format]}:value;
    function renameLocalValue(from,to){
      const text=local.getText(from,null);requireLastStorageError();if(text===null)return 0;
      let value;try{value=JSON.parse(text);}catch{throw new Error(`Browser storage ${from} is unreadable. It was preserved.`);}
      const moved=JSON.stringify(withRenamedFormat(value)),existing=local.getText(to,null);requireLastStorageError();
      if(existing!==null){let current;try{current=JSON.parse(existing);}catch{current=undefined;}if(!helpers.same(current,JSON.parse(moved)))throw new Error(`Browser storage ${from} and its renamed copy ${to} differ. Both were preserved.`);}
      else if(!local.setText(to,moved)||local.getText(to,null)!==moved)throw local.lastError()||new Error(`Browser storage ${from} could not be moved to ${to}. It was preserved.`);
      if(!local.remove(from)||local.getText(from,null)!==null)throw local.lastError()||new Error(`Browser storage ${from} could not be removed after its move.`);
      return 1;
    }
    async function renameIdentities(){
      let token;try{token=ownership.issueWriteToken('rename record identities',{allowHydrating:true});}
      catch(error){if(ownership.isOwnershipLostError(error))return freeze({status:'skipped',reason:'not-primary',renamed:0});throw error;}
      let count=0;
      for(const [from,to] of renamedLocal){ownership.assertWriteToken(token,'rename browser-storage identities');count+=renameLocalValue(from,to);}
      const rows=await metadata.listRows(),stamps=rows.filter(retiredStamp);
      if(rows.some(row=>renamedFrom(String(row&&row.key||'')))){
        ownership.assertWriteToken(token,'rename record identities');
        count+=await metadata.renameRows(renamed,renamedFormats);
      }
      for(const row of stamps){ownership.assertWriteToken(token,'drop retired preparation stamps');await metadata.removeRow(String(row.key));}
      if(!count&&!stamps.length)return freeze({status:'not-needed',renamed:0});
      ownership.assertWriteToken(token,'verify renamed record identities');
      const after=await metadata.listRows();
      if(after.some(row=>renamedFrom(String(row&&row.key||''))||retiredStamp(row)))throw new Error('Renamed records could not be verified. The previous names were preserved.');
      return freeze({status:'migrated',renamed:count,dropped:stamps.length});
    }
    const legacyHandoffMarker=value=>!!value&&typeof value==='object'&&value.format==='study-director.session-handoff-safety.v1';
    async function migrateHostMetadata(){
      let token;try{token=ownership.issueWriteToken('migrate historical host metadata',{allowHydrating:true});}
      catch(error){if(ownership.isOwnershipLostError(error))return freeze({status:'skipped',reason:'not-primary',migrated:0,removed:0});throw error;}
      const requireOwnership=()=>ownership.assertWriteToken(token,'migrate historical host metadata');
      let migrated=0,removed=0;
      const libraryClearMigration=await migrateLibraryClearJournal(requireOwnership);migrated+=Number(libraryClearMigration.migrated||0);removed+=Number(libraryClearMigration.removed||0);
      // A Continue Here marker in its first form (before handoff tokens) cannot
      // be checked against Drive by this build, so it is removed. A device that
      // had not yet taken the session over runs no timer either way, and one
      // that had saved its takeover only after Drive accepted the claim.
      if(legacyHandoffMarker(local.getJson(storage.sessionHandoffSafety,null))){
        requireOwnership();if(!local.remove(storage.sessionHandoffSafety))throw new Error('An earlier Continue Here marker could not be removed from browser storage.');removed++;
      }
      const maintenance=await metadata.readRow(appMeta.dataMaintenance);
      // dataMaintenance is operational/rebuildable state, not user authority. Any
      // non-current value is safely retired so current maintenance can regenerate it.
      if(maintenance&&!metadata.isCurrentDataMaintenance(maintenance.value)){
        requireOwnership();await metadata.removeRow(appMeta.dataMaintenance);removed++;
      }
      const recovery=await metadata.readRow(appMeta.verifiedRecoveryBackups),health=local.getJson(storage.storageHealth,null),retired=retiredHealthFields(health);
      const backupAt=retired.includes('lastBackupAt')?health.lastBackupAt:'';
      if(recovery&&Number(recovery.value&&recovery.value.version)!==3||isoTime(backupAt)){
        const converted=legacyVerifiedRecovery(recovery?recovery.value:null,backupAt);if(!converted)throw new Error('The last-backup record has an unknown shape and was preserved without modification.');
        if(!recovery||!helpers.same(recovery.value,converted)){requireOwnership();await metadata.writeValue(appMeta.verifiedRecoveryBackups,converted,recovery&&recovery.updatedAt);migrated++;}
      }
      if(retired.length){
        const studied=[health.lastStudyDataSaveAt,health.lastDailyRecordSaveAt,health.lastNotesSaveAt].map(isoTime).filter(Boolean).sort().at(-1)||null;
        requireOwnership();metadata.updateStorageHealth(freeze({...Object.fromEntries(retired.map(field=>[field,undefined])),lastStudyDataSaveAt:studied}));removed+=retired.length;
      }
      const integrity=await metadata.readRow(appMeta.attachmentIntegrityAudit);
      if(integrity){const normalized=metadata.normalizeAttachmentIntegrity(integrity.value);if(!helpers.same(integrity.value,normalized)){requireOwnership();await metadata.writeValue(appMeta.attachmentIntegrityAudit,normalized,integrity.updatedAt);migrated++;}}
      const device=await metadata.readRow(appMeta.deviceFolder);
      if(device&&Number(device.value?.version)!==4){const normalized=legacyDeviceSettings(device.value);if(!normalized)throw new Error('Historical Device Backup settings have an unknown shape and were preserved without modification.');requireOwnership();await metadata.writeValue(appMeta.deviceFolder,normalized,device.updatedAt);migrated++;}
      const journal=await metadata.readRow(appMeta.restoreJournalPayload);
      if(journal&&Number(journal.value?.version)!==RESTORE_JOURNAL_VERSION){
        const converted=legacyRestoreJournalPayload(journal.value);if(!converted)throw new Error('An interrupted restore from an older version has an unknown shape and was preserved without modification.');
        requireOwnership();await metadata.writeValue(appMeta.restoreJournalPayload,converted,journal.updatedAt);
        const verified=await metadata.readRow(appMeta.restoreJournalPayload);
        if(!verified||!helpers.same(verified.value,converted))throw new Error('An interrupted restore from an older version could not be verified after conversion.');
        migrated++;
      }
      const scrub=await metadata.readRow(appMeta.repositoryIntegrityScrub);
      if(scrub&&!helpers.same(scrub.value,metadata.normalizeRepositoryIntegrity(scrub.value))){
        const normalized=legacyRepositoryIntegrity(scrub.value);if(!normalized)throw new Error('Historical backup verification state has an unknown shape and was preserved without modification.');
        requireOwnership();await metadata.writeValue(appMeta.repositoryIntegrityScrub,normalized,scrub.updatedAt);
        const verified=await metadata.readRow(appMeta.repositoryIntegrityScrub);
        if(!verified||!helpers.same(verified.value,normalized))throw new Error('Historical backup verification state could not be verified after conversion.');
        migrated++;
      }
      const legacyMaintenance=await metadata.readRow(appMeta.repositoryMaintenancePendingLegacy),currentMaintenance=await metadata.readRow(appMeta.repositoryMaintenancePending);
      const legacyValue=legacyMaintenance?normalizeRepositoryMaintenance(legacyMaintenance.value):null,currentValue=currentMaintenance?normalizeRepositoryMaintenance(currentMaintenance.value):null;
      if(legacyMaintenance&&!legacyValue)throw new Error('Historical repository-maintenance metadata has an unknown shape and was preserved without modification.');
      if(currentMaintenance&&!currentValue)throw new Error('Current repository-maintenance metadata has an unknown shape and was preserved without modification.');
      if(legacyMaintenance||currentMaintenance&&!helpers.same(currentMaintenance.value,currentValue)){
        const byProvider=new Map((legacyValue?.entries||[]).map(entry=>[entry.providerId,entry]));
        for(const entry of currentValue?.entries||[])byProvider.set(entry.providerId,entry);
        const merged=freeze({format:MAINTENANCE_FORMAT,version:MAINTENANCE_VERSION,entries:freeze([...byProvider.values()].sort((a,b)=>a.providerId.localeCompare(b.providerId)))});
        requireOwnership();
        if(merged.entries.length){
          await metadata.writeValue(appMeta.repositoryMaintenancePending,merged,currentMaintenance?.updatedAt||legacyMaintenance.updatedAt);
          const verified=await metadata.readRow(appMeta.repositoryMaintenancePending);
          if(!verified||!helpers.same(verified.value,merged))throw new Error('Historical repository-maintenance metadata replacement could not be verified. The legacy source was preserved.');
          migrated++;
        }else if(currentMaintenance){await metadata.removeRow(appMeta.repositoryMaintenancePending);removed++;}
        if(legacyMaintenance){requireOwnership();await metadata.removeRow(appMeta.repositoryMaintenancePendingLegacy);removed++;}
      }
      const reconciliation=await migrateReconciliationBase(requireOwnership);migrated+=reconciliation.migrated;removed+=reconciliation.removed;
      const rows=await metadata.listRows();
      for(const row of rows){const key=String(row&&row.key||'');if(!key.startsWith(LEGACY_BACKUP_PROVIDER_OPERATION_PREFIX))continue;const fileName=String(row?.value?.backupFile?.name||'');requireOwnership();await metadata.removeRow(key);removed++;if(fileName){try{await metadata.releaseBackupFile(fileName);}catch{ /* stale compatibility scratch files are non-authoritative */ }}}
      return freeze({status:migrated||removed?'migrated':'not-needed',migrated,removed});
    }
    async function verifyRetiredHostCompatibility(){
      const rows=await metadata.listRows(),present=[];
      for(const row of rows){const key=String(row&&row.key||'');if(key.startsWith(LEGACY_BACKUP_PROVIDER_OPERATION_PREFIX))present.push(key);}
      const device=rows.find(row=>String(row&&row.key||'')===appMeta.deviceFolder);
      if(device&&Number(device.value?.version)!==4)present.push(`${appMeta.deviceFolder}:v${Number(device.value?.version)||'?'}`);
      for(const row of rows){const key=String(row&&row.key||'');if(renamedFrom(key)||retiredStamp(row))present.push(key);}
      for(const [from] of renamedLocal)if(local.getText(from,null)!==null)present.push(from);
      for(const row of staleReconciliationRows(rows))present.push(String(row.key));
      if(legacyHandoffMarker(local.getJson(storage.sessionHandoffSafety,null)))present.push(`${storage.sessionHandoffSafety}:v1`);
      for(const field of retiredHealthFields(local.getJson(storage.storageHealth,null)))present.push(`${storage.storageHealth}:${field}`);
      const recovery=rows.find(row=>String(row&&row.key||'')===appMeta.verifiedRecoveryBackups);
      if(recovery&&Number(recovery.value&&recovery.value.version)!==3)present.push(`${appMeta.verifiedRecoveryBackups}:v${Number(recovery.value&&recovery.value.version)||'?'}`);
      const audit=rows.find(row=>String(row&&row.key||'')===appMeta.attachmentIntegrityAudit);
      if(audit&&!helpers.same(audit.value,metadata.normalizeAttachmentIntegrity(audit.value)))present.push(`${appMeta.attachmentIntegrityAudit}:v${Number(audit.value?.version)||'?'}`);
      const journal=rows.find(row=>String(row&&row.key||'')===appMeta.restoreJournalPayload);
      if(journal&&Number(journal.value?.version)!==RESTORE_JOURNAL_VERSION)present.push(`${appMeta.restoreJournalPayload}:v${Number(journal.value?.version)||'?'}`);
      const scrub=rows.find(row=>String(row&&row.key||'')===appMeta.repositoryIntegrityScrub);
      if(scrub&&!helpers.same(scrub.value,metadata.normalizeRepositoryIntegrity(scrub.value)))present.push(`${appMeta.repositoryIntegrityScrub}:v${Number(scrub.value?.version)||'?'}`);
      const maintenance=rows.find(row=>String(row&&row.key||'')===appMeta.dataMaintenance);
      if(maintenance&&!metadata.isCurrentDataMaintenance(maintenance.value))present.push(`${appMeta.dataMaintenance}:noncanonical`);
      if(rows.some(row=>String(row&&row.key||'')===appMeta.repositoryMaintenancePendingLegacy))present.push(appMeta.repositoryMaintenancePendingLegacy);
      const pending=rows.find(row=>String(row&&row.key||'')===appMeta.repositoryMaintenancePending);
      if(pending&&Number(pending.value?.version)!==MAINTENANCE_VERSION)present.push(`${appMeta.repositoryMaintenancePending}:v${Number(pending.value?.version)||'?'}`);
      if(rows.some(row=>String(row&&row.key||'')===appMeta.reconciliationBaseLegacy))present.push(appMeta.reconciliationBaseLegacy);
      if(rows.some(row=>String(row&&row.key||'')===appMeta.archiveClearJournalStateLegacy))present.push(appMeta.archiveClearJournalStateLegacy);
      for(const row of rows)if(String(row&&row.key||'').startsWith(appMeta.archiveClearJournalPayloadPrefixLegacy))present.push(String(row.key));
      return freeze({ok:present.length===0,present:freeze(present)});
    }

    async function migratePlan(){
      await plan.hydrate();
      let token;
      try{token=ownership.issueWriteToken('migrate legacy Plan and portable Preferences data',{allowHydrating:true});}
      catch(error){if(ownership.isOwnershipLostError(error))return freeze({status:'skipped',reason:'not-primary'});throw error;}
      const requireOwnership=()=>ownership.assertWriteToken(token,'migrate legacy Plan and portable Preferences data');
      const legacy=local.getText(obsolete.schedule,null),defaults=local.getJson(obsolete.defaults,null),legacyQuote=local.getText(obsolete.quote,null);
      const themeMirror=local.getText(storage.theme,null),presentationMirror=local.getText(storage.presentation,null),fontMirror=local.getText(storage.fontScale,null),legacyNudge=local.getJson(obsolete.nudge,null);
      requireLastStorageError();
      const rawPreferenceRow=await preferences.readRawRow();
      let currentPreferences=null,legacyProtected=null;
      if(rawPreferenceRow){
        const envelopeOk=rawPreferenceRow&&typeof rawPreferenceRow==='object'&&!Array.isArray(rawPreferenceRow)&&rawPreferenceRow.key===appMeta.personalPreferences&&Number(rawPreferenceRow.version)===1&&rawPreferenceRow.value&&typeof rawPreferenceRow.value==='object';
        if(!envelopeOk)throw new Error('Stored personal Preferences metadata is not a supported canonical or historical envelope. It was preserved without modification.');
        currentPreferences=preferences.current(rawPreferenceRow.value);
        legacyProtected=currentPreferences?null:preferences.legacy(rawPreferenceRow.value);
        if(!currentPreferences&&!legacyProtected)throw new Error('Stored personal Preferences could not be converted safely. The historical source was preserved.');
      }
      const currentLibrary=plan.library(),legacyDraftNeedsCopy=typeof legacy==='string'&&plan.readDraft()===null;
      const defaultSchedule=defaults?.scheduleText?String(defaults.scheduleText):'';
      let migrated=0;
      if(typeof legacy==='string'){
        if(legacyDraftNeedsCopy)await plan.writeDraft(legacy,{ownershipToken:token,allowHydrating:true});
        migrated++;
      }
      if(defaultSchedule){
        if(!currentLibrary.savedPlans.some(row=>row.scheduleText===defaultSchedule)){
          const now=helpers.nowIso(),id='plan-'+helpers.randomUuid();
          await plan.writeLibrary({savedPlans:[...currentLibrary.savedPlans,{id,label:'My previous default',scheduleText:defaultSchedule,createdAt:now,updatedAt:now}],defaultId:currentLibrary.defaultId||id},{ownershipToken:token,allowHydrating:true});
        }
        migrated++;
      }
      let verifiedPreferences=currentPreferences;
      if(!currentPreferences){
        const historicalPracticeTarget=preferences.normalizePracticeTargetMs(defaults?.practiceTargetMs)||null;
        const next=preferences.create({
          version:2,
          studentName:legacyProtected?.studentName??(defaults?.studentName?preferences.normalizeStudentName(defaults.studentName):null),
          theme:themeMirror===null?null:preferences.normalizeTheme(themeMirror),
          presentation:presentationMirror===null?null:preferences.normalizePresentation(presentationMirror),
          quote:legacyProtected?.quote??(legacyQuote===null?null:preferences.normalizeQuote(legacyQuote)),
          practiceCueMode:legacyProtected?.practiceCueMode??(defaults?.practiceCueMode?preferences.normalizePracticeCueMode(defaults.practiceCueMode):null),
          fontScale:fontMirror===null?null:preferences.normalizeFontScale(fontMirror),
          practiceTargetMs:legacyProtected?.practiceTargetMs??historicalPracticeTarget,
          nudge:legacyNudge,updatedAt:helpers.nowIso()
        });
        // Preferences a newer Study Director saved stay as they are: this
        // build uses defaults for the session and saves none over them.
        if(preferences.held())verifiedPreferences=next;
        else{
          const written=await preferences.write(next,{ownershipToken:token,allowHydrating:true});
          verifiedPreferences=await preferences.read();
          if(!verifiedPreferences||!helpers.same(written,verifiedPreferences)||!preferences.current(verifiedPreferences))throw new Error('Portable Preferences were not verified after migration. Historical preference sources were preserved.');
          migrated++;
        }
      }
      preferences.accept(verifiedPreferences);preferences.refreshMirrors(verifiedPreferences);preferences.applyRuntime(verifiedPreferences);
      await plan.settled();requireOwnership();
      const verifiedPlans=preferences.plans(await plan.readCanonical());
      if(legacyDraftNeedsCopy&&verifiedPlans.draft!==legacy)throw new Error('Legacy Plan draft was not verified after migration. The source key was preserved.');
      if(defaultSchedule&&!verifiedPlans.savedPlans.some(row=>row.scheduleText===defaultSchedule))throw new Error('Legacy default schedule was not verified after migration. The source key was preserved.');
      // Held preferences keep their historical sources too: nothing was moved.
      const held=preferences.held();
      if(!held&&!preferences.current(await preferences.read()))throw new Error('Portable Preferences migration did not establish the current canonical schema. Historical sources were preserved.');
      requireOwnership();if(typeof legacy==='string'&&!local.remove(obsolete.schedule))throw local.lastError()||new Error('Legacy Plan draft key could not be removed after verified migration.');
      if(held)return freeze({status:migrated?'migrated':'not-needed',records:migrated,preferences:'held'});
      requireOwnership();if(defaults&&!local.remove(obsolete.defaults))throw local.lastError()||new Error('Legacy personal settings could not be retired after verified migration.');
      requireOwnership();if(legacyQuote!==null&&!local.remove(obsolete.quote))throw local.lastError()||new Error('Legacy quote could not be retired after verified migration.');
      requireOwnership();if(legacyNudge!==null&&!local.remove(obsolete.nudge))throw local.lastError()||new Error('Legacy nudge preference could not be retired after verified migration.');
      return freeze({status:migrated?'migrated':'not-needed',records:migrated});
    }

    async function migrateReflections(){
      let token;
      try{token=ownership.issueWriteToken('discard retired reflection-draft storage',{allowHydrating:true});}
      catch(error){if(ownership.isOwnershipLostError(error))return freeze({status:'skipped',reason:'not-primary',removed:0});throw error;}
      const collection=local.getText(obsolete.reflectionDrafts,null),single=local.getText(obsolete.reflectionLegacy,null);requireLastStorageError();
      let removed=0;
      ownership.assertWriteToken(token,'discard retired reflection-draft storage');
      if(collection!==null){if(!local.remove(obsolete.reflectionDrafts))throw local.lastError()||new Error('Retired reflection-draft collection could not be removed.');removed++;}
      if(single!==null){if(!local.remove(obsolete.reflectionLegacy))throw local.lastError()||new Error('Retired reflection draft could not be removed.');removed++;}
      requireLastStorageError();
      return freeze({status:removed?'discarded':'not-needed',removed});
    }

    async function migrateIdentity(){
      const legacy=local.getText(identity.legacyKey,null);requireLastStorageError();
      if(legacy===null)return freeze({status:'not-needed',installationId:identity.getId()});
      let token;try{token=ownership.issueWriteToken('migrate legacy device identity',{allowHydrating:true});}catch(error){if(ownership.isOwnershipLostError(error))return freeze({status:'skipped',reason:'not-primary'});throw error;}
      const converted=legacyInstallationIdentity(legacy);if(!converted)throw new Error('Legacy device identity is invalid. It was preserved without modification.');
      ownership.assertWriteToken(token,'migrate legacy device identity');let current=normalizeInstallationIdentity(local.getText(identity.installationKey,''));requireLastStorageError();
      if(!current){if(!local.setText(identity.installationKey,converted))throw local.lastError()||new Error('Installation identity migration write failed.');current=normalizeInstallationIdentity(local.getText(identity.installationKey,''));if(current!==converted)throw new Error('Installation identity migration could not be verified. The legacy identity was preserved.');}
      ownership.assertWriteToken(token,'retire legacy device identity');if(!local.remove(identity.legacyKey))throw local.lastError()||new Error('Legacy device identity could not be retired.');if(local.getText(identity.legacyKey,null)!==null)throw new Error('Legacy device identity retirement could not be verified.');
      return freeze({status:'retired',installationId:current});
    }
    function verifyIdentity(){const installationId=normalizeInstallationIdentity(local.getText(identity.installationKey,'')),legacy=local.getText(identity.legacyKey,null);return freeze({ok:!!installationId&&legacy===null,installationId,legacyPresent:legacy!==null});}

    const residueKeys=freeze([obsolete.liveDraft,obsolete.activeSession,obsolete.storageCapability,obsolete.diagnostics,obsolete.legacyOwnershipLease,obsolete.attachmentMaintenanceAttemptDay,obsolete.attachmentMaintenanceDay,obsolete.attachmentMaintenancePending,obsolete.nameSetupSkipped]);
    async function retireTopology(){
      let token;try{token=ownership.issueWriteToken('retire legacy database topology',{allowHydrating:true});}catch(error){if(ownership.isOwnershipLostError(error))return freeze({status:'skipped',reason:'not-primary'});throw error;}
      ownership.assertWriteToken(token,'retire legacy database topology');const result=await input.topology.retire();ownership.assertWriteToken(token,'verify legacy database topology retirement');return result;
    }
    async function cleanupLegacyStorage(){
      let token;try{token=ownership.issueWriteToken('clean legacy browser storage',{allowHydrating:true});}catch(error){if(ownership.isOwnershipLostError(error))return freeze({status:'skipped',reason:'not-primary',removed:0});throw error;}
      let removed=0;for(const key of residueKeys){ownership.assertWriteToken(token,'clean legacy browser storage');if(local.getText(key,null)!==null){if(!local.remove(key))throw local.lastError()||new Error('Legacy browser storage could not be removed.');removed++;}}
      return freeze({status:removed?'cleaned':'not-needed',removed});
    }
    async function verifyPlanLegacy(){
      const legacy=local.getText(obsolete.schedule,null),defaults=local.getText(obsolete.defaults,null),quote=local.getText(obsolete.quote,null),nudge=local.getText(obsolete.nudge,null),storageError=local.lastError(),prefs=await preferences.read();
      const held=preferences.held();
      return freeze({ok:!storageError&&legacy===null&&(held||defaults===null&&quote===null&&nudge===null&&!!preferences.current(prefs)),legacyDraft:legacy!==null,legacyDefaults:defaults!==null,legacyQuote:quote!==null,legacyNudge:nudge!==null});
    }
    async function verifyReflectionLegacy(){const collection=local.getText(obsolete.reflectionDrafts,null),single=local.getText(obsolete.reflectionLegacy,null),storageError=local.lastError();return freeze({ok:!storageError&&collection===null&&single===null,collection:collection!==null,single:single!==null});}
    async function verifyLegacyStorage(){const present=[];for(const key of residueKeys)if(local.getText(key,null)!==null)present.push(key);return freeze({ok:!local.lastError()&&present.length===0,present:freeze(present)});}

    return input.facadeFactory(freeze({
      baselineId:input.baselineId,
      live:freeze({
        renameIdentities,cleanupLegacyStorage,migratePlan,migrateReflections,migrateHostMetadata,migrateActiveSession:input.live.migrateActiveSession,migrateNotes:input.live.migrateNotes,
        migrateNoteRecovery:input.live.migrateNoteRecovery,migrateDeletionState:input.live.migrateDeletionState,migrateDailyRecords:input.live.migrateDailyRecords,
        migrateInsightsRevisionEnvelope:input.live.migrateInsightsRevisionEnvelope,cleanupLegacyAttachments:input.live.cleanupLegacyAttachments,
        cleanupObsoleteMetadata:input.live.cleanupObsoleteMetadata,settleUnsupported:input.live.settleUnsupported,retireTopology,retireLegacyIdentity:migrateIdentity
      }),
      backups:input.backups,
      verification:freeze({
        planLegacy:verifyPlanLegacy,reflectionLegacy:verifyReflectionLegacy,activeSession:input.verification.activeSession,notes:input.verification.notes,
        noteRecovery:input.verification.noteRecovery,deletionState:input.verification.deletionState,dailyRecords:input.verification.dailyRecords,
        insightsRevisionEnvelope:input.verification.insightsRevisionEnvelope,canonicalStores:input.verification.canonicalStores,legacyStorage:verifyLegacyStorage,
        legacyAttachments:input.verification.legacyAttachments,obsoleteMetadata:input.verification.obsoleteMetadata,topology:input.verification.topology,
        retiredIdentity:verifyIdentity,retiredHostCompatibility:verifyRetiredHostCompatibility,freshBackup:input.verification.freshBackup
      })
    }));
  }
  return freeze({format:'study-director.compatibility-host-module',contractVersion:1,createFacade});
});
})();
