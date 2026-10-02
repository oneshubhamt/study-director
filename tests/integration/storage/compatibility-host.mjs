import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';

for(const file of ['source/core/internal.js','source/core/compatibility.js','source/core/compatibility-host.js','source/core/host-metadata.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const Compatibility=registry.require('compatibility',1);
const Host=registry.require('compatibility-host',1);
const HostMetadata=registry.require('host-metadata',1);
const freeze=Object.freeze;

const current={theme:'theme',presentation:'presentation',fontScale:'fontScale'};
const obsolete={
  schedule:'oldSchedule',defaults:'oldDefaults',quote:'oldQuote',nudge:'oldNudge',reflectionDrafts:'oldReflections',reflectionLegacy:'oldReflection',
  deviceId:'oldDevice',liveDraft:'oldLiveDraft',activeSession:'oldActiveSession',storageCapability:'oldStorageCapability',diagnostics:'oldDiagnostics'
};
const appMeta={
  personalPreferences:'preferences',dataMaintenance:'dataMaintenance',verifiedRecoveryBackups:'verifiedRecoveryBackups',backupProtection:'backupProtection',attachmentIntegrityAudit:'attachmentIntegrityAudit',automaticDeviceBackup:'automaticDeviceBackup',
  repositoryMaintenancePending:'repositoryMaintenancePending.v2',repositoryMaintenancePendingLegacy:'repositoryMaintenancePending.v1',
  libraryClearJournalState:'libraryClearJournalState.v1',libraryClearJournalPayloadPrefix:'libraryClearJournalPayload.v1:',
  archiveClearJournalStateLegacy:'archiveClearJournalState.v1',archiveClearJournalPayloadPrefixLegacy:'archiveClearJournalPayload.v1:'
};
const localRows=new Map([
  [obsolete.schedule,'07:00 | 60 | Legacy Plan'],[obsolete.defaults,JSON.stringify({studentName:'Asha',scheduleText:'08:00 | 45 | Legacy Default',practiceCueMode:'audio'})],
  [obsolete.quote,'Keep going'],[obsolete.nudge,JSON.stringify({enabled:true})],[current.theme,'dark'],[current.presentation,'glass'],[current.fontScale,'1.1'],
  [obsolete.reflectionDrafts,JSON.stringify({version:1,drafts:{'2026-09-19':{reflection:'Legacy reflection',revision:2,updatedAt:'2026-09-19T10:00:00.000Z'}}})],
  [obsolete.deviceId,'dev_abcdefgh']
]);
let lastError=null;
const local=freeze({
  getText:(key,fallback)=>localRows.has(key)?String(localRows.get(key)):fallback,
  getJson:(key,fallback)=>{if(!localRows.has(key))return fallback;try{return JSON.parse(localRows.get(key));}catch(error){lastError=error;return fallback;}},
  setText:(key,value)=>{localRows.set(key,String(value));return true;},remove:key=>{localRows.delete(key);return true;},lastError:()=>lastError
});
let primary=true;
const ownership=freeze({issueWriteToken:()=>{if(!primary){const error=new Error('lost');error.code='OWNERSHIP_LOST';throw error;}return freeze({id:'token'});},assertWriteToken:()=>true,isOwnershipLostError:error=>error?.code==='OWNERSHIP_LOST'});
let draft=null,planLibrary=freeze({savedPlans:freeze([]),defaultId:''}),preferencesValue=null;
const plan=freeze({
  hydrate:async()=>true,library:()=>planLibrary,readDraft:()=>draft,
  writeDraft:async value=>{draft=value;return true;},writeLibrary:async value=>{planLibrary=freeze({savedPlans:freeze(value.savedPlans.map(row=>freeze({...row}))),defaultId:value.defaultId});return true;},
  settled:async()=>true,readCanonical:async()=>freeze({draft,library:planLibrary})
});
const currentPreferences=value=>value&&value.version===2?value:null;
const preferences=freeze({
  readRawRow:async()=>preferencesValue?freeze({key:appMeta.personalPreferences,version:1,value:preferencesValue,updatedAt:'2026-09-20T00:00:00.000Z'}):null,read:async()=>preferencesValue,write:async value=>{preferencesValue=freeze({...value});return preferencesValue;},
  current:currentPreferences,legacy:()=>null,create:value=>{if(value.practiceTargetMs!==null&&(!Number.isFinite(value.practiceTargetMs)||value.practiceTargetMs<1000||value.practiceTargetMs>86400000))throw new Error('Invalid practiceTargetMs.');return freeze({...value});},plans:value=>freeze({draft:value?.draft??null,savedPlans:value?.library?.savedPlans||freeze([]),defaultId:value?.library?.defaultId||''}),
  accept:()=>true,refreshMirrors:()=>true,applyRuntime:()=>true,normalizeTheme:String,normalizePresentation:String,normalizeFontScale:value=>Number(value),
  normalizeStudentName:String,normalizeQuote:String,normalizePracticeCueMode:String,normalizePracticeTargetMs:value=>{const n=Number(value);return Number.isFinite(n)&&n>=1000&&n<=86400000?Math.round(n):0}
});
const directoryHandle=freeze({getFileHandle:async()=>null,getDirectoryHandle:async()=>null,queryPermission:async()=> 'granted'});
const sha256=value=>createHash('sha256').update(value).digest('hex');
const legacyClearId='archiveclear_qa_legacy_clear_0001',legacyClearSignature='qa-library-clear-signature';
const legacyClearPayload=freeze({format:'study-director.archive-clear-rollback',version:1,planSignature:legacyClearSignature,createdAt:'2026-09-19T08:04:00.000Z'});
const legacyClearBytes=new TextEncoder().encode(JSON.stringify(legacyClearPayload));
const legacyClearState=freeze({format:'study-director.archive-clear-journal',version:1,id:legacyClearId,phase:'prepared',chunkCount:1,byteLength:legacyClearBytes.byteLength,sha256:sha256(legacyClearBytes),signatureHash:sha256(new TextEncoder().encode(legacyClearSignature)),createdAt:'2026-09-19T08:04:00.000Z',updatedAt:'2026-09-19T08:04:00.000Z'});
const metadataRows=new Map([
  ['dataMaintenance',{key:'dataMaintenance',version:1,value:{version:1,status:'completed',completedAt:'2026-09-19T08:00:00.000Z',canonicalRecords:10,rejectedRecords:0,summariesRebuilt:10,fallbackRecordsMigrated:0,invalidRecoveryCacheCleared:false,pendingSyncEntries:0,retainedTombstones:0},updatedAt:'2026-09-19T08:00:00.000Z'}],
  ['verifiedRecoveryBackups',{key:'verifiedRecoveryBackups',version:1,value:{version:1,file:{type:'file',id:'file',label:'File backup',verifiedAt:'2026-09-19T08:00:00.000Z',sourceRevision:'2026-09-19T07:59:00.000Z'},providers:{}},updatedAt:'2026-09-19T08:00:00.000Z'}],
  ['attachmentIntegrityAudit',{key:'attachmentIntegrityAudit',version:1,value:{version:1,checkedAt:'2026-09-19T08:00:00.000Z',issues:[{id:'att-abcdefghijklmnopqrst',kind:'missing-file',name:'old.jpg',expectedSize:12,actualSize:null}]},updatedAt:'2026-09-19T08:00:00.000Z'}],
  ['automaticDeviceBackup',{key:'automaticDeviceBackup',version:1,value:{format:'study-director.device-backup-settings',version:1,enabled:true,directoryHandle,lastSlot:'Study-Director-Automatic-Backup-A.sdbackup',lastBackupAt:'2026-09-19T08:00:00.000Z',lastFilename:'Study-Director-Automatic-Backup-A.sdbackup',sourceRevision:'2026-09-19T07:59:00.000Z'},updatedAt:'2026-09-19T08:00:00.000Z'}],
  ['repositoryMaintenancePending.v1',{key:'repositoryMaintenancePending.v1',version:1,value:{format:'study-director.repository-maintenance-pending',version:1,entries:[{providerId:'device-folder',requestedAt:'2026-09-19T08:02:00.000Z'},{providerId:'google-drive',requestedAt:'2026-09-19T08:03:00.000Z'}]},updatedAt:'2026-09-19T08:03:00.000Z'}],
  ['backupProtection',{key:'backupProtection',version:1,value:{version:1,id:'legacy-protection',verifier:new Blob(['legacy'])},updatedAt:'2026-09-19T08:00:00.000Z'}],
  [appMeta.archiveClearJournalStateLegacy,{key:appMeta.archiveClearJournalStateLegacy,version:1,value:legacyClearState,updatedAt:'2026-09-19T08:04:00.000Z'}],
  [appMeta.archiveClearJournalPayloadPrefixLegacy+`${legacyClearId}:00000000`,{key:appMeta.archiveClearJournalPayloadPrefixLegacy+`${legacyClearId}:00000000`,version:1,value:freeze({format:'study-director.archive-clear-journal',version:1,id:legacyClearId,index:0,bytes:legacyClearBytes}),updatedAt:'2026-09-19T08:04:00.000Z'}],
  ['backupProviderOperation:google-drive',{key:'backupProviderOperation:google-drive',version:1,value:{kind:'upload',backupFile:{name:'backup-00000000-0000-4000-8000-000000000000',size:10,hash:'a'.repeat(64)}},updatedAt:'2026-09-19T08:00:00.000Z'}]
]);
let legacyFileCollections=0;
const normalizeVerifiedRecovery=value=>freeze({version:1,file:value?.file?freeze({...value.file,baselineId:String(value.file.baselineId||''),backupFormatVersion:Number.isSafeInteger(value.file.backupFormatVersion)?value.file.backupFormatVersion:null}):null,providers:freeze(Object.fromEntries(Object.entries(value?.providers||{}).map(([id,row])=>[id,freeze({...row,baselineId:String(row.baselineId||''),backupFormatVersion:Number.isSafeInteger(row.backupFormatVersion)?row.backupFormatVersion:null})])))});
const normalizeAttachmentIntegrity=value=>freeze({version:1,checkedAt:String(value?.checkedAt||''),issues:freeze((value?.issues||[]).map(row=>freeze({id:String(row.id||''),kind:String(row.kind||''),expectedSize:Number.isSafeInteger(row.expectedSize)?row.expectedSize:null,actualSize:Number.isSafeInteger(row.actualSize)?row.actualSize:null})))});
const currentMaintenance=value=>!!(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')==='completedAt|status|version'&&(value.version===5&&value.status==='completed'&&Number.isFinite(Date.parse(String(value.completedAt||'')))||value.version===6&&(value.status==='completed'&&Number.isFinite(Date.parse(String(value.completedAt||'')))||value.status==='pending'&&(value.completedAt===''||Number.isFinite(Date.parse(String(value.completedAt||'')))))));
const metadata=freeze({
  readRow:async key=>metadataRows.get(String(key))||null,listRows:async()=>[...metadataRows.values()],isCurrentDataMaintenance:currentMaintenance,
  writeValue:async(key,value,updatedAt)=>{metadataRows.set(String(key),{key:String(key),version:1,value,updatedAt:String(updatedAt||'2026-09-20T00:00:00.000Z')});return true;},
  removeRow:async key=>{metadataRows.delete(String(key));return true;},releaseBackupFile:async()=>{legacyFileCollections++;return true;},normalizeVerifiedRecovery,normalizeAttachmentIntegrity
});
let topologyRetired=false;
const ok=async()=>freeze({ok:true});
const canonicalStoreProof=async()=>{
  const legacyPresent=metadataRows.has(appMeta.repositoryMaintenancePendingLegacy);
  const row=metadataRows.get(appMeta.repositoryMaintenancePending);
  const value=row?.value;
  const currentValid=!!(value&&value.format==='study-director.repository-maintenance-pending'&&value.version===3&&Array.isArray(value.entries));
  const issues=freeze([...(legacyPresent?freeze(['unclassified:repositoryMaintenancePending.v1']):freeze([])),...(!currentValid?freeze(['invalid:repositoryMaintenancePending.v3']):freeze([]))]);
  return freeze({ok:issues.length===0,issues});
};
assert.equal((await canonicalStoreProof()).ok,false,'the historical maintenance fixture must reproduce the canonicalStores failure before compatibility migration');
const facade=Host.createFacade(freeze({
  baselineId:'R12_REFINEMENT',facadeFactory:Compatibility.createFacade,keys:freeze({storage:freeze(current),obsolete:freeze(obsolete),appMeta:freeze(appMeta)}),
  local,ownership,plan,preferences,identity:freeze({getId:()=>local.getText('installationId',''),installationKey:'installationId',legacyKey:obsolete.deviceId}),
  metadata,
  live:freeze({migrateActiveSession:async()=>freeze({status:'not-needed'}),migrateAreaNotes:async()=>freeze({status:'not-needed'}),migrateAreaNoteRecovery:async()=>freeze({status:'not-needed'}),migrateDeletionState:async()=>freeze({status:'not-needed'}),migrateDailyRecords:async()=>freeze({status:'not-needed'}),migrateInsightsRevisionEnvelope:async()=>freeze({status:'not-needed'}),cleanupLegacyAttachments:async()=>freeze({status:'not-needed'}),cleanupObsoleteMetadata:async()=>freeze({status:'not-needed'})}),
  topology:freeze({retire:async()=>{topologyRetired=true;return freeze({status:'retired'});}}),
  verification:freeze({activeSession:ok,areaNotes:ok,areaNoteRecovery:ok,deletionState:ok,dailyRecords:ok,insightsRevisionEnvelope:ok,canonicalStores:canonicalStoreProof,legacyAttachments:ok,obsoleteMetadata:ok,topology:async()=>freeze({ok:topologyRetired}),freshBackup:ok}),
  backups:freeze({inspectCurrent:async()=>freeze({kind:'current'}),inspectLegacy:async()=>freeze({kind:'legacy'})}),
  helpers:freeze({same:(a,b)=>JSON.stringify(a)===JSON.stringify(b),randomUuid:()=> 'uuid',nowIso:()=> '2026-09-20T00:00:00.000Z'})
}));

const report=await facade.migrateLive();
assert.equal(report.results.plan.status,'migrated');
assert.equal(draft,'07:00 | 60 | Legacy Plan');
assert.ok(planLibrary.savedPlans.some(row=>row.scheduleText==='08:00 | 45 | Legacy Default'));
assert.equal(preferencesValue.version,2);
assert.equal(preferencesValue.studentName,'Asha');
assert.equal(preferencesValue.practiceTargetMs,null,'an unset historical Practice target must migrate as null rather than invalid 0');
assert.equal(preferencesValue.theme,'dark');
assert.equal(preferencesValue.presentation,'glass');
assert.equal(preferencesValue.nudge.enabled,true);
for(const key of [obsolete.schedule,obsolete.defaults,obsolete.quote,obsolete.nudge])assert.equal(localRows.has(key),false,`legacy preference source ${key} must retire only after canonical write`);
assert.equal(report.results.reflections.status,'discarded','Retired standalone reflection drafts are deliberately discarded rather than promoted into current canonical data.');
assert.equal(localRows.has(obsolete.reflectionDrafts),false);
assert.equal(topologyRetired,true);
assert.equal(localRows.get('installationId'),'inst_abcdefgh');
assert.equal(localRows.has(obsolete.deviceId),false);
let installationProof=await facade.verifyCanonicalInstallation();assert.equal(installationProof.canonical,true);assert.equal(installationProof.compatibilityRetired,false,'legacy backup-protection v1 must keep compatibility retirement blocked until successful password migration');
assert.equal(metadataRows.has('dataMaintenance'),false);assert.equal(metadataRows.has('backupProviderOperation:google-drive'),false);assert.equal(legacyFileCollections,1);
assert.equal(metadataRows.has('repositoryMaintenancePending.v1'),false,'repository-maintenance v1 identity must retire only after verified current replacement');
assert.equal(metadataRows.has(appMeta.archiveClearJournalStateLegacy),false,'legacy Archive-clear journal state must retire after verified Library-clear migration');
assert.equal([...metadataRows.keys()].some(key=>String(key).startsWith(appMeta.archiveClearJournalPayloadPrefixLegacy)),false,'legacy Archive-clear journal chunks must retire after verified Library-clear migration');
const migratedLibraryClearState=metadataRows.get(appMeta.libraryClearJournalState)?.value;
assert.equal(migratedLibraryClearState?.format,'study-director.library-clear-journal');
assert.match(String(migratedLibraryClearState?.id||''),/^libraryclear_/u,'migrated Library-clear journal must use the canonical Library identity');
const migratedLibraryChunk=[...metadataRows.entries()].find(([key])=>String(key).startsWith(appMeta.libraryClearJournalPayloadPrefix));
assert.ok(migratedLibraryChunk,'Library-clear migration must create canonical payload chunks');
assert.equal(JSON.parse(new TextDecoder().decode(migratedLibraryChunk[1].value.bytes)).format,'study-director.library-clear-rollback','migrated Library-clear payload must use the canonical rollback format');
assert.deepEqual(metadataRows.get('repositoryMaintenancePending.v2').value,{
  format:'study-director.repository-maintenance-pending',version:3,entries:[
    {providerId:'device-folder',requestedAt:'2026-09-19T08:02:00.000Z',nextEligibleAt:'2026-09-19T08:02:00.000Z',reason:'legacy',repositoryScope:''},
    {providerId:'google-drive',requestedAt:'2026-09-19T08:03:00.000Z',nextEligibleAt:'2026-09-19T08:03:00.000Z',reason:'legacy',repositoryScope:''}
  ]
},'historical maintenance intent must migrate losslessly to the current repository-scoped scheduling schema');

metadataRows.set('dataMaintenance',{key:'dataMaintenance',version:1,value:{version:5,status:'completed',completedAt:'2026-09-20T01:00:00.000Z',canonicalRecords:10},updatedAt:'2026-09-20T01:00:00.000Z'});
const secondFacade=Host.createFacade(freeze({
  baselineId:'R12_REFINEMENT',facadeFactory:Compatibility.createFacade,keys:freeze({storage:freeze(current),obsolete:freeze(obsolete),appMeta:freeze(appMeta)}),
  local,ownership,plan,preferences,identity:freeze({getId:()=>local.getText('installationId',''),installationKey:'installationId',legacyKey:obsolete.deviceId}),
  metadata,
  live:freeze({migrateActiveSession:async()=>freeze({status:'not-needed'}),migrateAreaNotes:async()=>freeze({status:'not-needed'}),migrateAreaNoteRecovery:async()=>freeze({status:'not-needed'}),migrateDeletionState:async()=>freeze({status:'not-needed'}),migrateDailyRecords:async()=>freeze({status:'not-needed'}),migrateInsightsRevisionEnvelope:async()=>freeze({status:'not-needed'}),cleanupLegacyAttachments:async()=>freeze({status:'not-needed'}),cleanupObsoleteMetadata:async()=>freeze({status:'not-needed'})}),
  topology:freeze({retire:async()=>freeze({status:'retired'})}),
  verification:freeze({activeSession:ok,areaNotes:ok,areaNoteRecovery:ok,deletionState:ok,dailyRecords:ok,insightsRevisionEnvelope:ok,canonicalStores:canonicalStoreProof,legacyAttachments:ok,obsoleteMetadata:ok,topology:ok,freshBackup:ok}),
  backups:freeze({inspectCurrent:async()=>freeze({kind:'current'}),inspectLegacy:async()=>freeze({kind:'legacy'})}),
  helpers:freeze({same:(a,b)=>JSON.stringify(a)===JSON.stringify(b),randomUuid:()=> 'uuid',nowIso:()=> '2026-09-20T02:00:00.000Z'})
}));
await secondFacade.migrateLive();
assert.equal(metadataRows.has('dataMaintenance'),false,'stale same-version maintenance payloads are rebuildable and must not block startup');
assert.equal(metadataRows.get('verifiedRecoveryBackups').value.file.baselineId,'');assert.equal(metadataRows.get('verifiedRecoveryBackups').value.file.backupFormatVersion,null);
assert.equal(Object.hasOwn(metadataRows.get('attachmentIntegrityAudit').value.issues[0],'name'),false);
assert.equal(metadataRows.get('automaticDeviceBackup').value.version,3);assert.equal(metadataRows.get('automaticDeviceBackup').value.directoryHandle,directoryHandle);assert.equal(metadataRows.get('automaticDeviceBackup').value.lastFilename,'');
metadataRows.set('backupProtection',{key:'backupProtection',version:1,value:{version:2,id:'legacy-protection',verifier:new Blob(['current'])},updatedAt:'2026-09-20T00:00:00.000Z'});installationProof=await facade.verifyCanonicalInstallation();assert.equal(installationProof.compatibilityRetired,true);

metadataRows.set(appMeta.repositoryMaintenancePendingLegacy,{key:appMeta.repositoryMaintenancePendingLegacy,version:1,value:{format:'study-director.repository-maintenance-pending',version:1,entries:[{providerId:'google-drive',requestedAt:'2026-09-20T03:00:00.000Z',unexpected:true}]},updatedAt:'2026-09-20T03:00:00.000Z'});
const malformedFacade=Host.createFacade(freeze({
  baselineId:'R12_REFINEMENT',facadeFactory:Compatibility.createFacade,keys:freeze({storage:freeze(current),obsolete:freeze(obsolete),appMeta:freeze(appMeta)}),
  local,ownership,plan,preferences,identity:freeze({getId:()=>local.getText('installationId',''),installationKey:'installationId',legacyKey:obsolete.deviceId}),metadata,
  live:freeze({migrateActiveSession:async()=>freeze({status:'not-needed'}),migrateAreaNotes:async()=>freeze({status:'not-needed'}),migrateAreaNoteRecovery:async()=>freeze({status:'not-needed'}),migrateDeletionState:async()=>freeze({status:'not-needed'}),migrateDailyRecords:async()=>freeze({status:'not-needed'}),migrateInsightsRevisionEnvelope:async()=>freeze({status:'not-needed'}),cleanupLegacyAttachments:async()=>freeze({status:'not-needed'}),cleanupObsoleteMetadata:async()=>freeze({status:'not-needed'})}),
  topology:freeze({retire:async()=>freeze({status:'retired'})}),verification:freeze({activeSession:ok,areaNotes:ok,areaNoteRecovery:ok,deletionState:ok,dailyRecords:ok,insightsRevisionEnvelope:ok,canonicalStores:canonicalStoreProof,legacyAttachments:ok,obsoleteMetadata:ok,topology:ok,freshBackup:ok}),
  backups:freeze({inspectCurrent:async()=>freeze({kind:'current'}),inspectLegacy:async()=>freeze({kind:'legacy'})}),helpers:freeze({same:(a,b)=>JSON.stringify(a)===JSON.stringify(b),randomUuid:()=> 'uuid',nowIso:()=> '2026-09-20T03:00:00.000Z'})
}));
await assert.rejects(()=>malformedFacade.migrateLive(),/unknown shape and was preserved without modification/,'malformed historical maintenance state must fail closed rather than being partially canonicalized');
assert.equal(metadataRows.has(appMeta.repositoryMaintenancePendingLegacy),true,'failed compatibility conversion must preserve its historical source row');
metadataRows.delete(appMeta.repositoryMaintenancePendingLegacy);

const validators=HostMetadata.createAppMetaValidators(freeze({
  keys:freeze({verifiedRecoveryBackups:'a',backupProtection:'b',attachmentIntegrityAudit:'c',automaticDeviceBackup:'d',repositoryIntegrityScrub:'e',managedProviderBackupPending:'f',repositoryMaintenancePending:'h',reconciliationBaseLegacy:'g1',reconciliationBase:'g2',reconciliationBaseNotePrefix:'g3'}),
  same:(a,b)=>a===b,normalizers:freeze({verifiedRecovery:value=>value,attachmentIntegrity:value=>value,repositoryIntegrity:value=>value,reconciliationBaseLegacy:value=>value,reconciliationBase:value=>value,reconciliationBaseNote:value=>value})
}));
const migratedValidators=HostMetadata.createAppMetaValidators(freeze({
  keys:freeze({verifiedRecoveryBackups:'verifiedRecoveryBackups',backupProtection:'backupProtection',attachmentIntegrityAudit:'attachmentIntegrityAudit',automaticDeviceBackup:'automaticDeviceBackup',repositoryIntegrityScrub:'repositoryIntegrityScrub',managedProviderBackupPending:'managedProviderBackupPending.v1',repositoryMaintenancePending:'repositoryMaintenancePending.v2',reconciliationBaseLegacy:'reconciliationBase.v1',reconciliationBase:'reconciliationBase.v2',reconciliationBaseNotePrefix:'reconciliationBaseNote.v1:'}),
  same:(a,b)=>JSON.stringify(a)===JSON.stringify(b),normalizers:freeze({verifiedRecovery:normalizeVerifiedRecovery,attachmentIntegrity:normalizeAttachmentIntegrity,repositoryIntegrity:value=>value,reconciliationBaseLegacy:value=>value,reconciliationBase:value=>value,reconciliationBaseNote:value=>value})
}));
assert.equal(migratedValidators.verifiedRecoveryBackups(metadataRows.get('verifiedRecoveryBackups').value,freeze({key:'verifiedRecoveryBackups'})),true,'migrated L7 recovery metadata must pass the ordinary current validator without compatibility interpretation');
assert.equal(migratedValidators.attachmentIntegrityAudit(metadataRows.get('attachmentIntegrityAudit').value,freeze({key:'attachmentIntegrityAudit'})),true,'migrated L7 attachment-audit metadata must pass the ordinary current validator');
assert.equal(migratedValidators.automaticDeviceBackup(metadataRows.get('automaticDeviceBackup').value,freeze({key:'automaticDeviceBackup'})),true,'migrated L7 Device Backup settings must pass the ordinary current validator');
assert.equal(metadataRows.get('backupProtection').value.version,2,'post-migration protection state must be current-only data before adapter retirement');
assert.equal(validators.backupProtection(freeze({version:2,id:'key',verifier:new Blob(['ok'])}),freeze({key:'b'})),true);
assert.equal(validators.backupProtection(freeze({version:1,id:'legacy-key',verifier:new Blob(['legacy'])}),freeze({key:'b'})),true,'v1 policy is temporarily readable so password-authenticated migration can run');
assert.equal(validators.backupProtection(freeze({version:2,id:'',verifier:new Blob(['ok'])}),freeze({key:'b'})),false);
const pendingProvider=freeze({format:'study-director.managed-provider-backup-pending',version:1,entries:freeze([freeze({providerId:'google-drive',requestedAt:'2026-09-20T10:00:00.000Z',sourceRevision:'2026-09-20T09:59:00.000Z'})])});
assert.equal(validators.managedProviderBackupPending(pendingProvider,freeze({key:'f'})),true,'durable provider retry metadata must validate as a typed host-owned appMeta value');
assert.equal(validators.managedProviderBackupPending(freeze({...pendingProvider,entries:freeze([freeze({...pendingProvider.entries[0],providerId:'Google Drive'})])}),freeze({key:'f'})),false,'pending provider identities must be canonical and fail closed');
const pendingMaintenance=freeze({format:'study-director.repository-maintenance-pending',version:1,entries:freeze([freeze({providerId:'google-drive',requestedAt:'2026-09-20T10:00:00.000Z'})])});
assert.equal(validators.repositoryMaintenancePending(pendingMaintenance,freeze({key:'h'})),true,'post-commit repository maintenance intent must validate as typed operational appMeta');
assert.equal(validators.repositoryMaintenancePending(freeze({...pendingMaintenance,entries:freeze([freeze({providerId:'Google Drive',requestedAt:'2026-09-20T10:00:00.000Z'})])}),freeze({key:'h'})),false,'repository maintenance provider identities must fail closed when non-canonical');


console.log(JSON.stringify({status:'PASS',suite:'compatibility-host',plan:true,retiredReflectionDraftsDiscarded:true,identity:true,appMetaValidators:true},null,2));
