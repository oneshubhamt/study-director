import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {noteKeys,noteId} from '../../helpers/note-ids.mjs';

for(const file of ['source/core/internal.js','source/core/compatibility.js','source/core/compatibility-host.js','source/core/host-metadata.js','source/core/reconciliation-baseline.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const Compatibility=registry.require('compatibility',1);
const Host=registry.require('compatibility-host',1);
const HostMetadata=registry.require('host-metadata',1);
const ReconciliationCodec=registry.require('reconciliation-baseline',1).createCodec(Object.freeze({limits:Object.freeze({maxAreaNameChars:160,maxRichTextBytes:2*1024*1024,maxNotes:1000}),isNoteKey:noteKeys.isKey}));
vm.runInThisContext(fs.readFileSync('source/core/integrity-continuation.js','utf8'),{filename:'integrity-continuation.js'});
globalThis.IntegrityContinuationModule=registry.require('integrity-continuation',1);
{const app=fs.readFileSync('source/app.html','utf8');vm.runInThisContext(app.slice(app.indexOf('function normalizeRepositoryIntegrityTarget('),app.indexOf('async function libraryClearSnapshot(')),{filename:'repository-integrity-normalizer'});}
const freeze=Object.freeze;

const current={theme:'theme',presentation:'presentation',fontScale:'fontScale',storageHealth:'storageHealth'};
const obsolete={
  schedule:'oldSchedule',defaults:'oldDefaults',quote:'oldQuote',nudge:'oldNudge',reflectionDrafts:'oldReflections',reflectionLegacy:'oldReflection',
  deviceId:'oldDevice',liveDraft:'oldLiveDraft',activeSession:'oldActiveSession',storageCapability:'oldStorageCapability',diagnostics:'oldDiagnostics',
  legacyOwnershipLease:'oldOwnerLease',attachmentMaintenanceAttemptDay:'oldAttachmentMaintenanceDay',
  attachmentMaintenanceDay:'oldAttachmentCleanupDay',attachmentMaintenancePending:'oldAttachmentCleanupPending',nameSetupSkipped:'oldNameSetupSkipped'
};
const appMeta={
  personalPreferences:'preferences',dataMaintenance:'dataMaintenance',verifiedRecoveryBackups:'verifiedRecoveryBackups',attachmentIntegrityAudit:'attachmentIntegrityAudit',deviceFolder:'deviceFolder',repositoryIntegrityScrub:'repositoryIntegrityScrub',
  reconciliationBase:'reconciliationBase',reconciliationBaseNotePrefix:'reconciliationBaseNote:',reconciliationBaseDayPrefix:'reconciliationBaseDays:',reconciliationBaseLegacy:'reconciliationBase.v1',restoreJournalPayload:'restoreJournalPayload',
  repositoryMaintenancePending:'repositoryMaintenancePending',repositoryMaintenancePendingLegacy:'repositoryMaintenancePending.v1',
  libraryClearJournalState:'libraryClearJournalState',libraryClearJournalPayloadPrefix:'libraryClearJournalPayload:',
  archiveClearJournalStateLegacy:'archiveClearJournalState.v1',archiveClearJournalPayloadPrefixLegacy:'archiveClearJournalPayload.v1:',
  backupPreparationUnitPrefix:'backupPreparationUnit:'
};
// Record names once carried a version; the first compatibility step moves them.
const renamedAppMeta=Object.freeze([['reconciliationBase.v2','reconciliationBase'],['reconciliationBaseNote.v1:','reconciliationBaseNote:'],['restoreJournalPayload.v1','restoreJournalPayload'],['repositoryMaintenancePending.v2','repositoryMaintenancePending'],['libraryClearJournalState.v1','libraryClearJournalState'],['libraryClearJournalPayload.v1:','libraryClearJournalPayload:'],['areaNoteDeletion.v1:','noteDeletion:'],['areaNoteDeletion:','noteDeletion:'],['automaticDeviceBackup','deviceFolder']].map(pair=>Object.freeze(pair)));
// Notes and the Device Folder once had other names; their values carried the old format names too.
const renamedLocal=Object.freeze([Object.freeze(['oldNoteRescue','noteRescue'])]);
const renamedFormats=Object.freeze({'study-director.area-note-deletion':'study-director.note-deletion','study-director.area-note-rescue':'study-director.note-rescue','study-director.device-backup-settings':'study-director.device-folder-settings'});
const localRows=new Map([
  [obsolete.schedule,'07:00 | 60 | Legacy Plan'],[obsolete.defaults,JSON.stringify({studentName:'Asha',scheduleText:'08:00 | 45 | Legacy Default',practiceCueMode:'audio'})],
  [obsolete.quote,'Keep going'],[obsolete.nudge,JSON.stringify({enabled:true})],[current.theme,'dark'],[current.presentation,'glass'],[current.fontScale,'1.1'],
  [obsolete.reflectionDrafts,JSON.stringify({version:1,drafts:{'2026-09-19':{reflection:'Legacy reflection',revision:2,updatedAt:'2026-09-19T10:00:00.000Z'}}})],
  [obsolete.deviceId,'dev_abcdefgh'],['oldNoteRescue',JSON.stringify({format:'study-director.area-note-rescue',version:1,entries:[]})],[obsolete.attachmentMaintenanceAttemptDay,'2026-09-18'],[obsolete.attachmentMaintenanceDay,'2026-09-19'],[obsolete.attachmentMaintenancePending,'1'],[obsolete.nameSetupSkipped,'2026-09-19'],
  [current.storageHealth,JSON.stringify({version:2,lastLocalSaveAt:'2026-09-19T09:00:00.000Z',lastBackupAt:'2026-09-19T09:30:00.000Z',lastNotesSaveAt:'2026-09-18T10:00:00.000Z',lastDailyRecordSaveAt:'2026-09-19T08:30:00.000Z',lastLiveSaveAt:'2026-09-19T08:59:00.000Z',lastIdbOkAt:'2026-09-19T08:00:00.000Z',lastError:'Browser database is unavailable',lastErrorAt:'2026-09-18T00:00:00.000Z',lastErrorSource:'indexedDB',updatedAt:'2026-09-19T09:00:00.000Z',storagePersisted:true,usageBytes:10,quotaBytes:100,usageRatio:0.1,lastEstimateAt:'2026-09-19T08:00:00.000Z',browserDataClearedAt:null})]
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
  held:()=>false,readRawRow:async()=>preferencesValue?freeze({key:appMeta.personalPreferences,version:1,value:preferencesValue,updatedAt:'2026-09-20T00:00:00.000Z'}):null,read:async()=>preferencesValue,write:async value=>{preferencesValue=freeze({...value});return preferencesValue;},
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
  ['repositoryIntegrityScrub',{key:'repositoryIntegrityScrub',version:1,value:{version:5,
    device:{...normalizeRepositoryIntegrityTarget({repositoryScope:'device-scope',scanId:'a'.repeat(64),cursor:'obj_'+'b'.repeat(32),completedAt:'2026-09-18T00:00:00.000Z',quarantinedObjectIds:['obj_'+'c'.repeat(32)]}),repositoryHandle:directoryHandle},
    drive:{...normalizeRepositoryIntegrityTarget({repositoryScope:'drive-scope',completedAt:'2026-09-18T00:00:00.000Z'}),repositoryHandle:null}},updatedAt:'2026-09-19T08:00:00.000Z'}],
  ['repositoryMaintenancePending.v2',{key:'repositoryMaintenancePending.v2',version:1,value:{format:'study-director.repository-maintenance-pending',version:3,entries:[{providerId:'google-drive',requestedAt:'2026-09-19T09:00:00.000Z',nextEligibleAt:'2026-09-19T09:30:00.000Z',reason:'catch-up',repositoryScope:'drive-scope'}]},updatedAt:'2026-09-19T09:00:00.000Z'}],
  ['reconciliationBase.v1',{key:'reconciliationBase.v1',version:1,value:{format:'study-director.reconciliation-base',version:1,checkpointId:'cp_'+'1'.repeat(32),establishedAt:'2026-09-19T07:00:00.000Z',notes:{Ethics:'ethics base',Polity:'polity base'}},updatedAt:'2026-09-19T07:00:00.000Z'}],
  ['reconciliationBaseNote.v1:Stale',{key:'reconciliationBaseNote.v1:Stale',version:1,value:{format:'study-director.reconciliation-base-note',version:1,key:'Stale',text:'old'},updatedAt:'2026-09-18T07:00:00.000Z'}],
  [appMeta.archiveClearJournalStateLegacy,{key:appMeta.archiveClearJournalStateLegacy,version:1,value:legacyClearState,updatedAt:'2026-09-19T08:04:00.000Z'}],
  [appMeta.archiveClearJournalPayloadPrefixLegacy+`${legacyClearId}:00000000`,{key:appMeta.archiveClearJournalPayloadPrefixLegacy+`${legacyClearId}:00000000`,version:1,value:freeze({format:'study-director.archive-clear-journal',version:1,id:legacyClearId,index:0,bytes:legacyClearBytes}),updatedAt:'2026-09-19T08:04:00.000Z'}],
  ['areaNoteDeletion:note_oldname0000000001',{key:'areaNoteDeletion:note_oldname0000000001',version:1,value:{format:'study-director.area-note-deletion',version:2,key:'note_oldname0000000001',deletedAt:'2026-09-18T00:00:00.000Z'},updatedAt:'2026-09-18T00:00:00.000Z'}],
  ['areaNoteDeletion.v1:note_oldname0000000002',{key:'areaNoteDeletion.v1:note_oldname0000000002',version:1,value:{format:'study-director.area-note-deletion',version:2,key:'note_oldname0000000002',deletedAt:'2026-09-17T00:00:00.000Z'},updatedAt:'2026-09-17T00:00:00.000Z'}],
  ['backupPreparationUnit:areaNote:note_oldname0000000001',{key:'backupPreparationUnit:areaNote:note_oldname0000000001',version:1,value:{unit:'areaNote:note_oldname0000000001',fingerprint:'a'.repeat(64)},updatedAt:'2026-09-18T00:00:00.000Z'}],
  ['backupPreparationUnit:note:note_newname0000000001',{key:'backupPreparationUnit:note:note_newname0000000001',version:1,value:{unit:'note:note_newname0000000001',fingerprint:'b'.repeat(64)},updatedAt:'2026-09-18T00:00:00.000Z'}],
  ['backupProviderOperation:google-drive',{key:'backupProviderOperation:google-drive',version:1,value:{kind:'upload',backupFile:{name:'backup-00000000-0000-4000-8000-000000000000',size:10,hash:'a'.repeat(64)}},updatedAt:'2026-09-19T08:00:00.000Z'}]
]);
let legacyFileCollections=0;
{const app=fs.readFileSync('source/app.html','utf8');vm.runInThisContext(app.slice(app.indexOf('function backupTime('),app.indexOf('function verifiedRecoveryEntries(')),{filename:'verified-recovery-normalizer'});}
const normalizeVerifiedRecovery=normalizeVerifiedRecoveryState;
const normalizeAttachmentIntegrity=value=>freeze({version:1,checkedAt:String(value?.checkedAt||''),issues:freeze((value?.issues||[]).map(row=>freeze({id:String(row.id||''),kind:String(row.kind||''),expectedSize:Number.isSafeInteger(row.expectedSize)?row.expectedSize:null,actualSize:Number.isSafeInteger(row.actualSize)?row.actualSize:null})))});
const currentMaintenance=value=>!!(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')==='completedAt|status|version'&&(value.version===6&&(value.status==='completed'&&Number.isFinite(Date.parse(String(value.completedAt||'')))||value.status==='pending'&&(value.completedAt===''||Number.isFinite(Date.parse(String(value.completedAt||'')))))));
const metadata=freeze({
  readRow:async key=>metadataRows.get(String(key))||null,listRows:async()=>[...metadataRows.values()],isCurrentDataMaintenance:currentMaintenance,
  writeValue:async(key,value,updatedAt)=>{metadataRows.set(String(key),{key:String(key),version:1,value,updatedAt:String(updatedAt||'2026-09-20T00:00:00.000Z')});return true;},
  removeRow:async key=>{metadataRows.delete(String(key));return true;},releaseBackupFile:async()=>{legacyFileCollections++;return true;},normalizeVerifiedRecovery,normalizeAttachmentIntegrity,
  normalizeRepositoryIntegrity:normalizeRepositoryIntegrityState,normalizeRepositoryIntegrityTarget,
  // One transaction in the app: a differing copy under the new name stops the whole move.
  renameRows:async(pairs,formats)=>{
    const moves=[],planned=new Map();
    for(const [key,row] of metadataRows){
      const pair=pairs.find(([from])=>from.endsWith(':')?key.startsWith(from):key===from);if(!pair)continue;
      const target=pair[1]+key.slice(pair[0].length),existing=planned.get(target)||metadataRows.get(target),value=Object.hasOwn(formats,String(row.value?.format))?{...row.value,format:formats[row.value.format]}:row.value;
      if(existing&&JSON.stringify(existing.value)!==JSON.stringify(value))throw new Error(`Record ${key} and its renamed copy ${target} differ. Nothing was renamed.`);
      if(!existing)planned.set(target,{...row,key:target,value});moves.push(key);
    }
    for(const [target,row] of planned)metadataRows.set(target,row);for(const key of moves)metadataRows.delete(key);
    return moves.length;
  },
  updateStorageHealth:patch=>{localRows.set(current.storageHealth,JSON.stringify({...JSON.parse(localRows.get(current.storageHealth)||'{}'),...patch}));return true;}
});
let topologyRetired=false;
const ok=async()=>freeze({ok:true});
const canonicalStoreProof=async()=>{
  const legacyPresent=metadataRows.has(appMeta.repositoryMaintenancePendingLegacy);
  const row=metadataRows.get(appMeta.repositoryMaintenancePending);
  const value=row?.value;
  const currentValid=!!(value&&value.format==='study-director.repository-maintenance-pending'&&value.version===4&&Array.isArray(value.entries));
  const issues=freeze([...(legacyPresent?freeze(['unclassified:repositoryMaintenancePending.v1']):freeze([])),...(!currentValid?freeze(['invalid:repositoryMaintenancePending']):freeze([]))]);
  return freeze({ok:issues.length===0,issues});
};
assert.equal((await canonicalStoreProof()).ok,false,'the historical maintenance fixture must reproduce the canonicalStores failure before compatibility migration');
const facade=Host.createFacade(freeze({
  baselineId:'R12_REFINEMENT',facadeFactory:Compatibility.createFacade,keys:freeze({storage:freeze(current),obsolete:freeze(obsolete),appMeta:freeze(appMeta),renamedAppMeta,renamedLocal,renamedFormats}),
  local,ownership,plan,preferences,identity:freeze({getId:()=>local.getText('installationId',''),installationKey:'installationId',legacyKey:obsolete.deviceId}),
  metadata,
  live:freeze({settleUnsupported:async()=>freeze({status:'none'}),migrateActiveSession:async()=>freeze({status:'not-needed'}),migrateNotes:async()=>freeze({status:'not-needed'}),migrateNoteRecovery:async()=>freeze({status:'not-needed'}),migrateDeletionState:async()=>freeze({status:'not-needed'}),migrateDailyRecords:async()=>freeze({status:'not-needed'}),migrateInsightsRevisionEnvelope:async()=>freeze({status:'not-needed'}),cleanupLegacyAttachments:async()=>freeze({status:'not-needed'}),cleanupObsoleteMetadata:async()=>freeze({status:'not-needed'})}),
  topology:freeze({retire:async()=>{topologyRetired=true;return freeze({status:'retired'});}}),
  verification:freeze({activeSession:ok,notes:ok,noteRecovery:ok,deletionState:ok,dailyRecords:ok,insightsRevisionEnvelope:ok,canonicalStores:canonicalStoreProof,legacyAttachments:ok,obsoleteMetadata:ok,topology:async()=>freeze({ok:topologyRetired}),freshBackup:ok}),
  backups:freeze({inspectCurrent:async()=>freeze({kind:'current'}),inspectLegacy:async()=>freeze({kind:'legacy'})}),
  helpers:freeze({same:(a,b)=>JSON.stringify(a)===JSON.stringify(b),randomUuid:()=> 'uuid',nowIso:()=> '2026-09-20T00:00:00.000Z',isNoteKey:noteKeys.isKey})
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
for(const key of [obsolete.attachmentMaintenanceAttemptDay,obsolete.attachmentMaintenanceDay,obsolete.attachmentMaintenancePending,obsolete.nameSetupSkipped])assert.equal(localRows.has(key),false,'every obsolete browser-storage key is retired');
let installationProof=await facade.verifyCanonicalInstallation();assert.equal(installationProof.canonical,true);assert.equal(installationProof.compatibilityRetired,true,'after one migration no historical host metadata remains');
assert.equal(metadataRows.has('dataMaintenance'),false);assert.equal(metadataRows.has('backupProviderOperation:google-drive'),false);assert.equal(legacyFileCollections,1);
const scrub=metadataRows.get('repositoryIntegrityScrub').value,scrubDevice=scrub.locations['device-folder'],scrubDrive=scrub.locations['google-drive'];
assert.equal(scrub.version,7,'historical backup verification state is converted to the current record, keyed by location id');assert.deepEqual(Object.keys(scrub.locations).sort(),['device-folder','google-drive']);assert.equal(Object.hasOwn(scrubDevice,'repositoryHandle'),false,'the retired directory handle is dropped');
assert.equal(scrubDevice.repositoryScope,'device-scope');assert.equal(scrubDevice.cursor,'obj_'+'b'.repeat(32));assert.deepEqual([...scrubDevice.quarantinedObjectIds],['obj_'+'c'.repeat(32)],'quarantine carries over');assert.equal(scrubDrive.repositoryScope,'drive-scope');
assert.equal(report.results.identities.status,'migrated','old record names move first');
assert.equal(metadataRows.has('automaticDeviceBackup'),false,'the Device Folder record moves to its new name');assert.equal(metadataRows.get('deviceFolder').value.format,'study-director.device-folder-settings','its value format is renamed with it');
for(const id of ['note_oldname0000000001','note_oldname0000000002']){const row=metadataRows.get('noteDeletion:'+id);assert.equal(row?.value.format,'study-director.note-deletion',`note deletion ${id} moves under its new name and format`);assert.equal(row.value.key,id);}
assert.equal([...metadataRows.keys()].some(key=>key.startsWith('areaNoteDeletion')),false,'no note deletion keeps an old name');
assert.equal(localRows.has('oldNoteRescue'),false);assert.deepEqual(JSON.parse(localRows.get('noteRescue')),{format:'study-director.note-rescue',version:1,entries:[]},'the rescue copy moves under its new key and format');
assert.equal(metadataRows.has('backupPreparationUnit:areaNote:note_oldname0000000001'),false,'a preparation stamp for a unit under the old name is dropped');assert.equal(metadataRows.has('backupPreparationUnit:note:note_newname0000000001'),true,'a current preparation stamp stays');
assert.equal([...metadataRows.keys()].some(key=>/\.v2$|\.v1:/u.test(key)&&key!=='reconciliationBase.v1'),false,'no record keeps an old name');
assert.deepEqual(metadataRows.get('verifiedRecoveryBackups').value,{version:3,file:{at:'2026-09-19T09:30:00.000Z',sourceRevision:'2026-09-19T09:30:00.000Z',format:null,verified:false},providers:{}},'the last-backup record keeps one shape; the newer last-backup time from storage health becomes an unverified file copy');
const slimHealth=JSON.parse(localRows.get(current.storageHealth));
assert.deepEqual(Object.keys(slimHealth).sort(),['browserDataClearedAt','lastLocalSaveAt','lastStudyDataSaveAt','version'],'storage health keeps only what is read: the change clock, study data saved here and a pending clear');
assert.equal(slimHealth.lastStudyDataSaveAt,'2026-09-19T08:30:00.000Z','the newest Saved Day or note save time carries over');assert.equal(slimHealth.lastLocalSaveAt,'2026-09-19T09:00:00.000Z');
assert.equal(metadataRows.has('repositoryMaintenancePending.v1'),false,'repository-maintenance v1 identity must retire only after verified current replacement');
assert.equal(metadataRows.has(appMeta.archiveClearJournalStateLegacy),false,'legacy Archive-clear journal state must retire after verified Library-clear migration');
assert.equal([...metadataRows.keys()].some(key=>String(key).startsWith(appMeta.archiveClearJournalPayloadPrefixLegacy)),false,'legacy Archive-clear journal chunks must retire after verified Library-clear migration');
const migratedLibraryClearState=metadataRows.get(appMeta.libraryClearJournalState)?.value;
assert.equal(migratedLibraryClearState?.format,'study-director.library-clear-journal');
assert.match(String(migratedLibraryClearState?.id||''),/^libraryclear_/u,'migrated Library-clear journal must use the canonical Library identity');
const migratedLibraryChunk=[...metadataRows.entries()].find(([key])=>String(key).startsWith(appMeta.libraryClearJournalPayloadPrefix));
assert.ok(migratedLibraryChunk,'Library-clear migration must create canonical payload chunks');
assert.equal(JSON.parse(new TextDecoder().decode(migratedLibraryChunk[1].value.bytes)).format,'study-director.library-clear-rollback','migrated Library-clear payload must use the canonical rollback format');
assert.deepEqual(metadataRows.get('repositoryMaintenancePending').value,{
  format:'study-director.repository-maintenance-pending',version:4,entries:[
    {providerId:'device-folder',requestedAt:'2026-09-19T08:02:00.000Z',nextEligibleAt:'2026-09-19T08:02:00.000Z',reason:'legacy',repositoryScope:'',requestId:''},
    {providerId:'google-drive',requestedAt:'2026-09-19T09:00:00.000Z',nextEligibleAt:'2026-09-19T09:30:00.000Z',reason:'catch-up',repositoryScope:'drive-scope',requestId:''}
  ]
},'historical maintenance intents in either identity convert to the current version; a current-identity entry wins for its provider');
assert.deepEqual([...metadataRows.keys()].filter(key=>key.startsWith('reconciliationBase')),[],'a merge base from before permanent ids, keyed by note title, is dropped');

metadataRows.set('dataMaintenance',{key:'dataMaintenance',version:1,value:{version:5,status:'completed',completedAt:'2026-09-20T01:00:00.000Z',canonicalRecords:10},updatedAt:'2026-09-20T01:00:00.000Z'});
const secondFacade=Host.createFacade(freeze({
  baselineId:'R12_REFINEMENT',facadeFactory:Compatibility.createFacade,keys:freeze({storage:freeze(current),obsolete:freeze(obsolete),appMeta:freeze(appMeta),renamedAppMeta,renamedLocal,renamedFormats}),
  local,ownership,plan,preferences,identity:freeze({getId:()=>local.getText('installationId',''),installationKey:'installationId',legacyKey:obsolete.deviceId}),
  metadata,
  live:freeze({settleUnsupported:async()=>freeze({status:'none'}),migrateActiveSession:async()=>freeze({status:'not-needed'}),migrateNotes:async()=>freeze({status:'not-needed'}),migrateNoteRecovery:async()=>freeze({status:'not-needed'}),migrateDeletionState:async()=>freeze({status:'not-needed'}),migrateDailyRecords:async()=>freeze({status:'not-needed'}),migrateInsightsRevisionEnvelope:async()=>freeze({status:'not-needed'}),cleanupLegacyAttachments:async()=>freeze({status:'not-needed'}),cleanupObsoleteMetadata:async()=>freeze({status:'not-needed'})}),
  topology:freeze({retire:async()=>freeze({status:'retired'})}),
  verification:freeze({activeSession:ok,notes:ok,noteRecovery:ok,deletionState:ok,dailyRecords:ok,insightsRevisionEnvelope:ok,canonicalStores:canonicalStoreProof,legacyAttachments:ok,obsoleteMetadata:ok,topology:ok,freshBackup:ok}),
  backups:freeze({inspectCurrent:async()=>freeze({kind:'current'}),inspectLegacy:async()=>freeze({kind:'legacy'})}),
  helpers:freeze({same:(a,b)=>JSON.stringify(a)===JSON.stringify(b),randomUuid:()=> 'uuid',nowIso:()=> '2026-09-20T02:00:00.000Z',isNoteKey:noteKeys.isKey})
}));
await secondFacade.migrateLive();
assert.equal(metadataRows.has('dataMaintenance'),false,'stale same-version maintenance payloads are rebuildable and must not block startup');
assert.equal(metadataRows.get('verifiedRecoveryBackups').value.version,3,'a converted record stays as it is on later runs');
assert.equal(Object.hasOwn(metadataRows.get('attachmentIntegrityAudit').value.issues[0],'name'),false);
assert.deepEqual(Object.keys(metadataRows.get('deviceFolder').value).sort(),['baseline','directoryHandle','format','version'],'the two unused Device Folder fields are dropped');assert.equal(metadataRows.get('deviceFolder').value.version,4);assert.equal(metadataRows.get('deviceFolder').value.directoryHandle,directoryHandle);assert.equal(metadataRows.get('deviceFolder').value.baseline,'2026-09-19T07:59:00.000Z','sourceRevision is now named baseline');
installationProof=await facade.verifyCanonicalInstallation();assert.equal(installationProof.compatibilityRetired,true);

metadataRows.set(appMeta.repositoryMaintenancePendingLegacy,{key:appMeta.repositoryMaintenancePendingLegacy,version:1,value:{format:'study-director.repository-maintenance-pending',version:1,entries:[{providerId:'google-drive',requestedAt:'2026-09-20T03:00:00.000Z',unexpected:true}]},updatedAt:'2026-09-20T03:00:00.000Z'});
const malformedInput=freeze({
  baselineId:'R12_REFINEMENT',facadeFactory:Compatibility.createFacade,keys:freeze({storage:freeze(current),obsolete:freeze(obsolete),appMeta:freeze(appMeta),renamedAppMeta,renamedLocal,renamedFormats}),
  local,ownership,plan,preferences,identity:freeze({getId:()=>local.getText('installationId',''),installationKey:'installationId',legacyKey:obsolete.deviceId}),metadata,
  live:freeze({settleUnsupported:async()=>freeze({status:'none'}),migrateActiveSession:async()=>freeze({status:'not-needed'}),migrateNotes:async()=>freeze({status:'not-needed'}),migrateNoteRecovery:async()=>freeze({status:'not-needed'}),migrateDeletionState:async()=>freeze({status:'not-needed'}),migrateDailyRecords:async()=>freeze({status:'not-needed'}),migrateInsightsRevisionEnvelope:async()=>freeze({status:'not-needed'}),cleanupLegacyAttachments:async()=>freeze({status:'not-needed'}),cleanupObsoleteMetadata:async()=>freeze({status:'not-needed'})}),
  topology:freeze({retire:async()=>freeze({status:'retired'})}),verification:freeze({activeSession:ok,notes:ok,noteRecovery:ok,deletionState:ok,dailyRecords:ok,insightsRevisionEnvelope:ok,canonicalStores:canonicalStoreProof,legacyAttachments:ok,obsoleteMetadata:ok,topology:ok,freshBackup:ok}),
  backups:freeze({inspectCurrent:async()=>freeze({kind:'current'}),inspectLegacy:async()=>freeze({kind:'legacy'})}),helpers:freeze({same:(a,b)=>JSON.stringify(a)===JSON.stringify(b),randomUuid:()=> 'uuid',nowIso:()=> '2026-09-20T03:00:00.000Z',isNoteKey:noteKeys.isKey})
});
const malformedFacade=Host.createFacade(malformedInput);

await assert.rejects(()=>malformedFacade.migrateLive(),/unknown shape and was preserved without modification/,'malformed historical maintenance state must fail closed rather than being partially canonicalized');
assert.equal(metadataRows.has(appMeta.repositoryMaintenancePendingLegacy),true,'failed compatibility conversion must preserve its historical source row');
metadataRows.delete(appMeta.repositoryMaintenancePendingLegacy);
const scanTarget=target=>({completedAt:target.completedAt,cycleStartedAt:target.cycleStartedAt,cursor:target.cursor,failedAt:target.failedAt,quarantinedObjectIds:target.quarantinedObjectIds});
metadataRows.set('repositoryIntegrityScrub',{key:'repositoryIntegrityScrub',version:1,value:{version:2,device:scanTarget(scrubDevice),drive:scanTarget(scrubDrive)},updatedAt:'2026-09-20T03:00:00.000Z'});
const scrubFacade=Host.createFacade(malformedInput);
assert.equal((await scrubFacade.verifyCanonicalInstallation()).compatibilityRetired,false,'historical verification state keeps the compatibility facade in place');
await scrubFacade.migrateLive();
assert.equal(metadataRows.get('repositoryIntegrityScrub').value.version,7);assert.equal(metadataRows.get('repositoryIntegrityScrub').value.locations['device-folder'].cursor,'obj_'+'b'.repeat(32),'version 2 progress carries over');
assert.equal((await scrubFacade.verifyCanonicalInstallation()).compatibilityRetired,true);
const malformedScrub={version:4,device:{...scrubDevice,unexpected:true},drive:scrubDrive};
metadataRows.set('repositoryIntegrityScrub',{key:'repositoryIntegrityScrub',version:1,value:malformedScrub,updatedAt:'2026-09-20T03:00:00.000Z'});
await assert.rejects(()=>Host.createFacade(malformedInput).migrateLive(),/backup verification state has an unknown shape and was preserved without modification/u);
assert.equal(metadataRows.get('repositoryIntegrityScrub').value,malformedScrub,'an unknown historical shape is preserved untouched');
metadataRows.set('repositoryIntegrityScrub',{key:'repositoryIntegrityScrub',version:1,value:scrub,updatedAt:'2026-09-20T03:00:00.000Z'});
// A current merge base (version 5, Saved-Day rows version 2) stays; an older
// one goes whole: header versions 3 and 4, or any version-1 Saved-Day row.
const baseId=noteId('Ethics'),olderBase={format:'study-director.reconciliation-base',version:3,checkpointId:'cp_'+'2'.repeat(32),establishedAt:'2026-09-20T00:00:00.000Z',noteCount:1,noteKeyFingerprint:await ReconciliationCodec.keyFingerprint([baseId]),personalFingerprint:'',sessionFingerprint:''};
const olderDays={key:'reconciliationBaseDays:2026-09',version:1,value:{format:'study-director.reconciliation-base-days',version:1,month:'2026-09',days:{'2026-09-20':'a'.repeat(64)}},updatedAt:'2026-09-20T00:00:00.000Z'};
const currentBase={...olderBase,version:5,personalFields:null,sessionContentFingerprint:''};
const baseDays={...olderDays,value:{...olderDays.value,version:2,semanticDays:{'2026-09-20':'b'.repeat(64)}}};
const baseNote=()=>metadataRows.set('reconciliationBaseNote:'+baseId,{key:'reconciliationBaseNote:'+baseId,version:1,value:{format:'study-director.reconciliation-base-note',version:1,key:baseId,label:'Ethics',text:'ethics base'},updatedAt:'2026-09-20T00:00:00.000Z'});
const placeBase=(header,days)=>{metadataRows.set('reconciliationBase',{key:'reconciliationBase',version:1,value:header,updatedAt:'2026-09-20T00:00:00.000Z'});metadataRows.set(days.key,days);baseNote();};
const baseRows=()=>[...metadataRows.keys()].filter(key=>key.startsWith('reconciliationBase'));
placeBase(currentBase,baseDays);
await Host.createFacade(malformedInput).migrateLive();
assert.deepEqual(metadataRows.get('reconciliationBase').value,currentBase,'a version 5 merge base is current');
assert.deepEqual(metadataRows.get(baseDays.key),baseDays,'its version 2 Saved Day rows stay with it');
for(const [label,header,days] of [
  ['a version 3 base',olderBase,baseDays],
  ['a version 4 base (bug-fixes builds)',{...olderBase,version:4,personalFields:null},baseDays],
  ['a version 5 base with a version 1 Saved Day row',currentBase,olderDays]
]){
  placeBase(header,days);
  assert.equal((await Host.createFacade(malformedInput).verifyCanonicalInstallation()).compatibilityRetired,false,`${label} is not yet retired`);
  await Host.createFacade(malformedInput).migrateLive();
  assert.deepEqual(baseRows(),[],`${label} goes whole; the next Drive sync records a fresh one`);
}

metadataRows.set('reconciliationBase',{key:'reconciliationBase',version:1,value:{...currentBase,version:2,sessionFingerprint:undefined},updatedAt:'2026-09-20T00:00:00.000Z'});metadataRows.set(baseDays.key,baseDays);
await Host.createFacade(malformedInput).migrateLive();
assert.deepEqual([...metadataRows.keys()].filter(key=>key.startsWith('reconciliationBase')),[],'a version 2 base cannot tell an unknown Saved Day from a missing one, so it goes whole, Saved Day rows included');
metadataRows.set('reconciliationBase',{key:'reconciliationBase',version:1,value:currentBase,updatedAt:'2026-09-20T00:00:00.000Z'});metadataRows.set('reconciliationBaseNote:'+baseId,{key:'reconciliationBaseNote:'+baseId,version:1,value:{format:'study-director.reconciliation-base-note',version:1,key:baseId,label:'Ethics',text:'ethics base'},updatedAt:'2026-09-20T00:00:00.000Z'});assert.equal(metadataRows.get('reconciliationBaseNote:'+baseId).value.text,'ethics base');
// One from before titles were kept holds only text; it goes whole too.
const untitledId=noteId('Polity');metadataRows.set('reconciliationBaseNote:'+untitledId,{key:'reconciliationBaseNote:'+untitledId,version:1,value:{format:'study-director.reconciliation-base-note',version:1,key:untitledId,text:'polity base'},updatedAt:'2026-09-20T00:00:00.000Z'});
await Host.createFacade(malformedInput).migrateLive();
assert.deepEqual([...metadataRows.keys()].filter(key=>key.startsWith('reconciliationBase')),[],'a base row without a title takes the whole base with it');
metadataRows.set('reconciliationBase',{key:'reconciliationBase',version:1,value:currentBase,updatedAt:'2026-09-20T00:00:00.000Z'});
metadataRows.set('reconciliationBase.v1',{key:'reconciliationBase.v1',version:1,value:{format:'study-director.reconciliation-base',version:1,notes:['not a map']},updatedAt:'2026-09-21T00:00:00.000Z'});
await Host.createFacade(malformedInput).migrateLive();
assert.deepEqual([...metadataRows.keys()].filter(key=>key.startsWith('reconciliationBase')),[],'any single-row base, whatever its shape, takes the whole base with it');
// An interrupted restore from an older build converts to the current journal before crash recovery reads it.
const journalBlob=new Blob(['safety copy']),oldJournal={format:'study-director.restore-journal',version:2,id:'restore_qa-old-journal',blob:journalBlob,filename:'safety.sdbackup',scheduleText:'',savedDayDeletions:[{date:'2026-09-10',deletedAt:'2026-09-12T00:00:00.000Z'}]};
metadataRows.set('restoreJournalPayload.v1',{key:'restoreJournalPayload.v1',version:1,value:oldJournal,updatedAt:'2026-09-12T00:00:00.000Z'});
assert.equal((await Host.createFacade(malformedInput).verifyCanonicalInstallation()).compatibilityRetired,false);
await Host.createFacade(malformedInput).migrateLive();
assert.equal(metadataRows.has('restoreJournalPayload.v1'),false);const currentJournal=metadataRows.get('restoreJournalPayload').value;
assert.equal(currentJournal.version,6);assert.equal(currentJournal.blob,journalBlob);assert.equal(Object.hasOwn(currentJournal,'scheduleText'),false,'current restore journals do not own the Plan draft');assert.deepEqual(currentJournal.savedDayDeletions,oldJournal.savedDayDeletions);assert.deepEqual([...currentJournal.noteDeletions],[]);assert.deepEqual([...currentJournal.attachmentDeletions],[]);
// Version 4 named the note deletions areaNoteDeletions; current version 6 calls them noteDeletions and has no scheduleText.
const noteDeletion={key:'note_oldname0000000003',deletedAt:'2026-09-11T00:00:00.000Z'},v4Journal={...oldJournal,version:4,areaNoteDeletions:[noteDeletion],attachmentDeletions:[]};
metadataRows.set('restoreJournalPayload',{key:'restoreJournalPayload',version:1,value:v4Journal,updatedAt:'2026-09-12T00:00:00.000Z'});
await Host.createFacade(malformedInput).migrateLive();
const v6Journal=metadataRows.get('restoreJournalPayload').value;assert.equal(v6Journal.version,6);assert.equal(Object.hasOwn(v6Journal,'areaNoteDeletions'),false);assert.equal(Object.hasOwn(v6Journal,'scheduleText'),false);assert.deepEqual([...v6Journal.noteDeletions],[noteDeletion],'version 4 note deletions carry over under their current name');assert.equal(v6Journal.blob,journalBlob);
const v5Journal={format:'study-director.restore-journal',version:5,id:'restore_qa-v5-journal',blob:journalBlob,filename:'safety.sdbackup',scheduleText:'legacy draft must not return',savedDayDeletions:[],noteDeletions:[noteDeletion],attachmentDeletions:[]};
metadataRows.set('restoreJournalPayload',{key:'restoreJournalPayload',version:1,value:v5Journal,updatedAt:'2026-09-12T00:00:00.000Z'});
await Host.createFacade(malformedInput).migrateLive();
const migratedV5=metadataRows.get('restoreJournalPayload').value;assert.equal(migratedV5.version,6);assert.equal(Object.hasOwn(migratedV5,'scheduleText'),false,'version 5 scheduleText is deliberately retired during migration');assert.deepEqual([...migratedV5.noteDeletions],[noteDeletion]);
const unknownJournal={...oldJournal,version:1,unexpected:true};
metadataRows.set('restoreJournalPayload',{key:'restoreJournalPayload',version:1,value:unknownJournal,updatedAt:'2026-09-12T00:00:00.000Z'});
await assert.rejects(()=>Host.createFacade(malformedInput).migrateLive(),/interrupted restore from an older version has an unknown shape/u);
assert.equal(metadataRows.get('restoreJournalPayload').value,unknownJournal);metadataRows.delete('restoreJournalPayload');

// Version 6 was made only by unreleased builds: refused and kept as it is.
const unreleasedScrub={version:6,device:scrubDevice,drive:scrubDrive};
metadataRows.set('repositoryIntegrityScrub',{key:'repositoryIntegrityScrub',version:1,value:unreleasedScrub,updatedAt:'2026-09-20T03:00:00.000Z'});
await assert.rejects(()=>Host.createFacade(malformedInput).migrateLive(),/backup verification state has an unknown shape and was preserved without modification/u);
assert.equal(metadataRows.get('repositoryIntegrityScrub').value,unreleasedScrub,'version 6 is preserved untouched');
metadataRows.set('repositoryIntegrityScrub',{key:'repositoryIntegrityScrub',version:1,value:scrub,updatedAt:'2026-09-20T03:00:00.000Z'});
// A record under its old name moves once; a differing copy under the new name stops the move and keeps both.
const pendingRow=metadataRows.get('repositoryMaintenancePending');
metadataRows.set('repositoryMaintenancePending.v2',{...pendingRow,key:'repositoryMaintenancePending.v2'});
await Host.createFacade(malformedInput).migrateLive();
assert.equal(metadataRows.has('repositoryMaintenancePending.v2'),false,'an identical copy under the old name is removed');assert.deepEqual(metadataRows.get('repositoryMaintenancePending').value,pendingRow.value);
const differing={...pendingRow,key:'repositoryMaintenancePending.v2',value:{...pendingRow.value,entries:[]}};
metadataRows.set('repositoryMaintenancePending.v2',differing);
assert.equal((await Host.createFacade(malformedInput).verifyCanonicalInstallation()).compatibilityRetired,false,'a record under an old name keeps the compatibility facade in place');
await assert.rejects(()=>Host.createFacade(malformedInput).migrateLive(),/differ\. Nothing was renamed/u);
assert.equal(metadataRows.get('repositoryMaintenancePending.v2'),differing);assert.deepEqual(metadataRows.get('repositoryMaintenancePending').value,pendingRow.value,'both copies are kept for the person to resolve');
metadataRows.delete('repositoryMaintenancePending.v2');

// Version 1 entries keep their copies; the format comes from backupFormatVersion.
metadataRows.set('verifiedRecoveryBackups',{key:'verifiedRecoveryBackups',version:1,value:{version:1,file:{type:'file',id:'file',label:'Portable backup',verifiedAt:'2026-09-20T08:00:00.000Z',sourceRevision:'2026-09-20T07:59:00.000Z',baselineId:'old',backupFormatVersion:20},providers:{'google-drive':{type:'provider',id:'google-drive',label:'Google Drive',verifiedAt:'2026-09-20T09:00:00.000Z',sourceRevision:'2026-09-20T08:58:00.000Z',baselineId:'old',backupFormatVersion:20}}},updatedAt:'2026-09-21T08:00:00.000Z'});
assert.equal((await Host.createFacade(malformedInput).verifyCanonicalInstallation()).compatibilityRetired,false,'an older last-backup record keeps the compatibility facade in place');
await Host.createFacade(malformedInput).migrateLive();
assert.deepEqual(metadataRows.get('verifiedRecoveryBackups').value,{version:3,file:{at:'2026-09-20T08:00:00.000Z',sourceRevision:'2026-09-20T07:59:00.000Z',format:20,verified:true},providers:{'google-drive':{at:'2026-09-20T09:00:00.000Z',sourceRevision:'2026-09-20T08:58:00.000Z',format:20}}});
const convertedRecord=metadataRows.get('verifiedRecoveryBackups');
// Version 2 was made only by unreleased builds; it and unknown shapes are refused and kept as they are.
for(const unknown of [{version:2,file:null,download:{startedAt:'2026-09-21T08:00:00.000Z'},providers:{}},{version:7}]){
  metadataRows.set('verifiedRecoveryBackups',{key:'verifiedRecoveryBackups',version:1,value:unknown,updatedAt:'2026-09-21T08:00:00.000Z'});
  await assert.rejects(()=>Host.createFacade(malformedInput).migrateLive(),/last-backup record has an unknown shape/u);
  assert.deepEqual(metadataRows.get('verifiedRecoveryBackups').value,unknown,`version ${unknown.version} is preserved untouched`);
}metadataRows.set('verifiedRecoveryBackups',convertedRecord);

const validators=HostMetadata.createAppMetaValidators(freeze({
  keys:freeze({verifiedRecoveryBackups:'a',backupProtection:'b',attachmentIntegrityAudit:'c',deviceFolder:'d',repositoryIntegrityScrub:'e',managedProviderBackupPending:'f',repositoryMaintenancePending:'h',reconciliationBase:'g2',reconciliationBaseNotePrefix:'g3',reconciliationBaseDayPrefix:'g4'}),
  same:(a,b)=>a===b,normalizers:freeze({verifiedRecovery:value=>value,attachmentIntegrity:value=>value,repositoryIntegrity:value=>value,reconciliationBase:value=>value,reconciliationBaseNote:value=>value,reconciliationBaseDays:value=>value})
}));
const migratedValidators=HostMetadata.createAppMetaValidators(freeze({
  keys:freeze({verifiedRecoveryBackups:'verifiedRecoveryBackups',backupProtection:'backupProtection',attachmentIntegrityAudit:'attachmentIntegrityAudit',deviceFolder:'deviceFolder',repositoryIntegrityScrub:'repositoryIntegrityScrub',managedProviderBackupPending:'managedProviderBackupPending',repositoryMaintenancePending:'repositoryMaintenancePending',reconciliationBase:'reconciliationBase',reconciliationBaseNotePrefix:'reconciliationBaseNote:',reconciliationBaseDayPrefix:'reconciliationBaseDays:'}),
  same:(a,b)=>JSON.stringify(a)===JSON.stringify(b),normalizers:freeze({verifiedRecovery:normalizeVerifiedRecovery,attachmentIntegrity:normalizeAttachmentIntegrity,repositoryIntegrity:normalizeRepositoryIntegrityState,reconciliationBase:value=>value,reconciliationBaseNote:value=>value,reconciliationBaseDays:value=>value})
}));
assert.equal(migratedValidators.verifiedRecoveryBackups(metadataRows.get('verifiedRecoveryBackups').value,freeze({key:'verifiedRecoveryBackups'})),true,'migrated L7 recovery metadata must pass the ordinary current validator without compatibility interpretation');
assert.equal(migratedValidators.attachmentIntegrityAudit(metadataRows.get('attachmentIntegrityAudit').value,freeze({key:'attachmentIntegrityAudit'})),true,'migrated L7 attachment-audit metadata must pass the ordinary current validator');
assert.equal(migratedValidators.repositoryIntegrityScrub(metadataRows.get('repositoryIntegrityScrub').value,freeze({key:'repositoryIntegrityScrub'})),true,'migrated backup verification state must pass the ordinary current validator');
assert.equal(migratedValidators.deviceFolder(metadataRows.get('deviceFolder').value,freeze({key:'deviceFolder'})),true,'migrated L7 Device Backup settings must pass the ordinary current validator');
const setAt='2026-10-01T10:00:00.000Z';
assert.equal(validators.backupProtection(freeze({version:3,id:'key',verifier:new Blob(['ok']),key:null,setAt}),freeze({key:'b'})),true);
assert.equal(validators.backupProtection(freeze({version:2,id:'old-key',verifier:new Blob(['old'])}),freeze({key:'b'})),false,'only the current password record is read');
assert.equal(validators.backupProtection(freeze({version:3,id:'',verifier:new Blob(['ok']),key:null,setAt}),freeze({key:'b'})),false);
assert.equal(validators.backupProtection(freeze({version:3,id:'key',verifier:new Blob(['ok']),key:'raw password',setAt}),freeze({key:'b'})),false,'a remembered key is only ever a non-extractable CryptoKey');
const pendingProvider=freeze({format:'study-director.managed-provider-backup-pending',version:1,entries:freeze([freeze({providerId:'google-drive',requestedAt:'2026-09-20T10:00:00.000Z',sourceRevision:'2026-09-20T09:59:00.000Z'})])});
assert.equal(validators.managedProviderBackupPending(pendingProvider,freeze({key:'f'})),true,'durable provider retry metadata must validate as a typed host-owned appMeta value');
assert.equal(validators.managedProviderBackupPending(freeze({...pendingProvider,entries:freeze([freeze({...pendingProvider.entries[0],providerId:'Google Drive'})])}),freeze({key:'f'})),false,'pending provider identities must be canonical and fail closed');
const pendingEntry=freeze({providerId:'google-drive',requestedAt:'2026-09-20T10:00:00.000Z',nextEligibleAt:'2026-09-20T10:00:00.000Z',reason:'catch-up',repositoryScope:'',requestId:''});
const pendingMaintenance=freeze({format:'study-director.repository-maintenance-pending',version:4,entries:freeze([pendingEntry])});
assert.equal(validators.repositoryMaintenancePending(pendingMaintenance,freeze({key:'h'})),true,'post-commit repository maintenance intent must validate as typed operational appMeta');
assert.equal(validators.repositoryMaintenancePending(freeze({format:'study-director.repository-maintenance-pending',version:1,entries:freeze([freeze({providerId:'google-drive',requestedAt:'2026-09-20T10:00:00.000Z'})])}),freeze({key:'h'})),false,'older maintenance intents are read only by the compatibility host');
assert.equal(validators.repositoryMaintenancePending(freeze({...pendingMaintenance,entries:freeze([freeze({...pendingEntry,providerId:'Google Drive'})])}),freeze({key:'h'})),false,'repository maintenance provider identities must fail closed when non-canonical');


console.log(JSON.stringify({status:'PASS',suite:'compatibility-host',plan:true,retiredReflectionDraftsDiscarded:true,identity:true,appMetaValidators:true},null,2));
