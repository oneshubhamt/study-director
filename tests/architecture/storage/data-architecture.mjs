import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  INDEXED_DB,INDEXED_DB_STORE_NAMES,OBSOLETE_INDEXED_DB,RUNTIME_DATA_CONTRACT,OPFS_IDENTITIES as CANONICAL_OPFS_IDENTITIES,
  EXTERNAL_FORMATS,CHECKPOINT_METADATA,CACHE_STORAGE_IDENTITIES,EXTERNAL_REPOSITORY_IDENTITIES,assertCanonicalIdentities
} from '../../../contracts/canonical-identities.mjs';
import {
  LOCAL_STORAGE_KEYS,SESSION_STORAGE_KEYS,OBSOLETE_LOCAL_STORAGE_KEYS,APP_META_KEYS,OBSOLETE_APP_META_KEYS,APP_META_FAMILY_COUNT,APP_META_FAMILY_LABEL,APP_META_VALIDATION_OWNERS,APP_META_RUNTIME_REGISTRY,
  OPFS_IDENTITIES,OBSOLETE_OPFS_IDENTITIES,PERSISTENCE_CLASSES,DATA_ARCHITECTURE,assertDataArchitecture
} from '../../../contracts/data-architecture.mjs';

assert.equal(assertCanonicalIdentities(),true);
assert.equal(assertDataArchitecture(),true);
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const app=read('source/app.html');
const repositories=read('source/core/repositories.js');
const journals=read('source/core/repository-journals.js');
const appMeta=read('source/core/app-meta.js');
const persistence=read('source/core/persistence.js');
const insights=read('source/external/insights.js');
const sourceFiles=[];
const walk=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full);else if(/\.(?:js|html)$/u.test(entry.name))sourceFiles.push(full);}};
walk(path.join(root,'source'));

assert.match(app,/const STORAGE_KEYS=Object\.freeze\(@@SD_LOCAL_STORAGE_KEYS@@\);/u);
assert.match(app,/const themeStorageKey='@@SD_THEME_STORAGE_KEY@@';/u);
assert.match(app,/const presentationStorageKey='@@SD_PRESENTATION_STORAGE_KEY@@';/u);
assert.doesNotMatch(app,/['"]studyDirector\.(?:theme|presentation)\.v1['"]/u,'pre-hydration presentation bootstrap must use build-injected storage identities');
assert.match(app,/const SESSION_STORAGE_KEYS=Object\.freeze\(@@SD_SESSION_STORAGE_KEYS@@\);/u);
assert.match(app,/const OBSOLETE_STORAGE_KEYS=Object\.freeze\(@@SD_OBSOLETE_LOCAL_STORAGE_KEYS@@\);/u);
assert.match(app,/const APP_META_KEYS=Object\.freeze\(@@SD_APP_META_KEYS@@\);/u);
assert.match(app,/const OBSOLETE_APP_META_KEYS=Object\.freeze\(@@SD_OBSOLETE_APP_META_KEYS@@\);/u);
assert.equal(Object.keys(LOCAL_STORAGE_KEYS).length,20,'current localStorage inventory includes separate attachment cleanup success and pending identities, and the Library view');
assert.equal(LOCAL_STORAGE_KEYS.attachmentMaintenancePending,'studyDirector.attachmentMaintenancePending.v1');
assert.equal(LOCAL_STORAGE_KEYS.attachmentMaintenanceDay,'studyDirector.attachmentMaintenanceDay.v2');
assert.equal(OBSOLETE_LOCAL_STORAGE_KEYS.attachmentMaintenanceAttemptDay,'studyDirector.attachmentMaintenanceDay.v1','old scheduling records cannot certify completion in F2');
assert.equal(DATA_ARCHITECTURE.localStorage.attachmentMaintenancePending.owner,'asset-maintenance');
assert.equal(DATA_ARCHITECTURE.localStorage.attachmentMaintenancePending.role,'operational');
assert.equal(Object.keys(OBSOLETE_LOCAL_STORAGE_KEYS).length,15);
assert.equal(Object.hasOwn(LOCAL_STORAGE_KEYS,'nudge'),false,'nudge must not remain a current LocalStorage authority');
assert.equal(OBSOLETE_LOCAL_STORAGE_KEYS.nudge,'studyDirector.nudgeConfig');
assert.equal(OBSOLETE_LOCAL_STORAGE_KEYS.legacyOwnershipLease,'studyDirector.timerOwner.v1');
assert.equal(DATA_ARCHITECTURE.localStorage.theme.role,'startup-mirror');
assert.equal(DATA_ARCHITECTURE.localStorage.presentation.role,'startup-mirror');
assert.equal(DATA_ARCHITECTURE.localStorage.fontScale.role,'startup-mirror');
assert.equal(DATA_ARCHITECTURE.appMeta.exact.personalPreferences.schema,'PortablePreferences.v2');
assert.equal(LOCAL_STORAGE_KEYS.installationId,'studyDirector.installationId.v1');
assert.equal(OBSOLETE_LOCAL_STORAGE_KEYS.deviceId,'studyDirector.deviceId.v1');
assert.equal(LOCAL_STORAGE_KEYS.deletionRecovery,'studyDirector.deletionRecovery.v1');
assert.equal(OBSOLETE_LOCAL_STORAGE_KEYS.syncEmergency,'studyDirector.syncEmergency.v1');
assert.equal(CHECKPOINT_METADATA.format,'study-director.checkpoint-metadata');
assert.deepEqual(CHECKPOINT_METADATA.fields,Object.freeze(['format','version','checkpointId','createdAt','originInstallationId']));

assert.deepEqual(SESSION_STORAGE_KEYS,Object.freeze({appTab:'studyDirector.appTab.v1',pwaReload:'studyDirector.pwaReload.v1'}));
assert.equal(Object.keys(DATA_ARCHITECTURE.sessionStorage).length,2);
assert.equal(DATA_ARCHITECTURE.cacheStorage.applicationShell.lifecycle.includes('no user data'),true);
assert.equal(DATA_ARCHITECTURE.memory.searchIndex.role,'derived');

const primaryClasses=new Set(Object.values(PERSISTENCE_CLASSES));
for(const [group,entries] of Object.entries(DATA_ARCHITECTURE)){
  if(group==='appMeta'){
    for(const families of Object.values(entries))for(const [name,surface] of Object.entries(families)){
      assert.ok(primaryClasses.has(surface.authorityClass),`appMeta ${name} must have exactly one primary persistence class`);
      assert.equal(surface.canonicalAuthority,surface.authorityClass===PERSISTENCE_CLASSES.canonical,`appMeta ${name} canonical authority classification drifted`);
    }
    continue;
  }
  for(const [name,surface] of Object.entries(entries)){
    if(group==='indexedDb'&&name==='appMeta'){assert.equal(surface.container,true);assert.equal(surface.authorityClass,null);continue;}
    assert.ok(primaryClasses.has(surface.authorityClass),`${group}.${name} must have exactly one primary persistence class`);
    assert.equal(surface.canonicalAuthority,surface.authorityClass===PERSISTENCE_CLASSES.canonical,`${group}.${name} canonical authority classification drifted`);
  }
}
assert.equal(DATA_ARCHITECTURE.indexedDb.dailySummaries.rebuildFrom,'indexedDb.dailyRecords');
for(const name of ['theme','presentation','fontScale']){
  assert.equal(DATA_ARCHITECTURE.localStorage[name].authorityClass,PERSISTENCE_CLASSES.deviceLocal);
  assert.match(DATA_ARCHITECTURE.localStorage[name].mirrorOf,/^appMeta\.personalPreferences\./u);
  assert.equal(DATA_ARCHITECTURE.localStorage[name].portable,false);
}
for(const surface of Object.values(DATA_ARCHITECTURE.localStorage))assert.notEqual(surface.authorityClass,PERSISTENCE_CLASSES.canonical,'LocalStorage must not own canonical user data');
for(const [name,surface] of Object.entries(DATA_ARCHITECTURE.appMeta.exact))if(surface.authorityClass===PERSISTENCE_CLASSES.derived)assert.ok(surface.rebuildFrom,`derived appMeta ${name} must identify rebuild source`);
for(const groups of [DATA_ARCHITECTURE.localStorage,DATA_ARCHITECTURE.appMeta.exact,DATA_ARCHITECTURE.appMeta.prefixes,DATA_ARCHITECTURE.opfs])for(const [name,surface] of Object.entries(groups))if(surface.authorityClass===PERSISTENCE_CLASSES.recovery)for(const field of ['protects','created','cleared','supersededBy'])assert.ok(surface[field],`recovery surface ${name} must declare ${field}`);
assert.equal(DATA_ARCHITECTURE.cacheStorage.applicationShell.identity,CACHE_STORAGE_IDENTITIES.shellPrefix);
assert.equal(DATA_ARCHITECTURE.cacheStorage.updateBridge.identity,CACHE_STORAGE_IDENTITIES.updateBridge);
assert.equal(DATA_ARCHITECTURE.cacheStorage.updateBridge.recoveryPrefix,CACHE_STORAGE_IDENTITIES.updateRecoveryPrefix);
assert.equal(DATA_ARCHITECTURE.external.deviceBackup.repositoryRoot,EXTERNAL_REPOSITORY_IDENTITIES.deviceFolderRoot);
assert.equal(DATA_ARCHITECTURE.external.driveBackup.repositoryRoot,EXTERNAL_REPOSITORY_IDENTITIES.driveFolder);
assert.match(app,/sessionTabKey:SESSION_STORAGE_KEYS\.appTab/u);
const pwaLifecycle=read('source/core/pwa-lifecycle.js');
assert.doesNotMatch(pwaLifecycle,/['"]studyDirector\.pwaReload\.v1['"]/u);
assert.match(app,/reloadSessionKey:SESSION_STORAGE_KEYS\.pwaReload/u);
for(const family of ['exact','prefixes','obsolete'])for(const [name,surface] of Object.entries(DATA_ARCHITECTURE.appMeta[family]))assert.ok(surface.schema,`appMeta ${family}.${name} must declare its canonical value schema`);
const currentAppMetaFamilies=[...Object.keys(DATA_ARCHITECTURE.appMeta.exact),...Object.keys(DATA_ARCHITECTURE.appMeta.prefixes)].sort();
const validationFamilies=Object.values(APP_META_VALIDATION_OWNERS).flat();
assert.equal(validationFamilies.length,new Set(validationFamilies).size,'each current appMeta family must have exactly one validation owner');
assert.deepEqual([...validationFamilies].sort(),currentAppMetaFamilies,'every current appMeta family must be assigned to a validator');
assert.deepEqual(APP_META_VALIDATION_OWNERS.repositories,Object.freeze(['dailyRecordMigration','planDraft','planLibrary','personalPreferences','canonicalMutationEpoch','insightsDatasetRevision','dataMaintenance','backupPreparationUnitPrefix','savedDayDeletionPrefix','areaNoteDeletionPrefix','attachmentDeletionPrefix']));
assert.deepEqual(APP_META_VALIDATION_OWNERS.journals,Object.freeze(['libraryClearJournalState','libraryClearJournalPayloadPrefix','restoreJournalState','restoreJournalPayload','mutationLease']));
assert.deepEqual(APP_META_VALIDATION_OWNERS.host,Object.freeze(['verifiedRecoveryBackups','backupProtection','attachmentIntegrityAudit','automaticDeviceBackup','repositoryIntegrityScrub','managedProviderBackupPending','repositoryMaintenancePending','reconciliationBase','reconciliationBaseNotePrefix']));
assert.equal(Object.hasOwn(APP_META_VALIDATION_OWNERS,'provider'),false,'retired monolithic provider-operation journal must not remain a validation family');
assert.equal(APP_META_FAMILY_COUNT,Object.keys(APP_META_KEYS).length,'appMeta family count must be mechanically derived from the authoritative identity map');
assert.equal(APP_META_FAMILY_LABEL,`${APP_META_FAMILY_COUNT} typed appMeta families`);
assert.equal(DATA_ARCHITECTURE.indexedDb.appMeta.contains,APP_META_FAMILY_LABEL,'physical appMeta container description must derive from the current typed family inventory');
assert.equal(Object.keys(APP_META_RUNTIME_REGISTRY).length,APP_META_FAMILY_COUNT,'runtime appMeta registry must be mechanically derived for every current family');
for(const [name,entry] of Object.entries(APP_META_RUNTIME_REGISTRY)){assert.equal(entry.name,name);assert.equal(entry.key,APP_META_KEYS[name]);assert.ok(['exact','prefix'].includes(entry.kind));assert.ok(['repositories','compatibility','repository-journals','host','exports','device-backup','backup'].includes(entry.owner));assert.ok(['repositories','journals','host'].includes(entry.validatorOwner));assert.ok(entry.schema);}


const idbStores=Object.keys(DATA_ARCHITECTURE.indexedDb).sort();
assert.deepEqual(idbStores,Object.keys(INDEXED_DB.stores).sort(),'IndexedDB topology must come from the canonical identity manifest');
assert.deepEqual(Object.keys(INDEXED_DB_STORE_NAMES).sort(),idbStores,'runtime store-name map must cover every canonical store');
assert.equal(RUNTIME_DATA_CONTRACT.storage.dbName,INDEXED_DB.name);
assert.equal(RUNTIME_DATA_CONTRACT.storage.dbVersion,INDEXED_DB.version);
assert.match(app,/const DATA_CONTRACT=\(\(\)=>\{[\s\S]{0,600}@@SD_RUNTIME_DATA_CONTRACT@@/u,'host data contract must be build-injected from the canonical identity manifest');
assert.match(app,/const DB_STORES=Object\.freeze\(@@SD_INDEXED_DB_STORE_NAMES@@\);/u,'host physical store names must be build-injected from the canonical identity manifest');
assert.match(app,/const OBSOLETE_DB=Object\.freeze\(@@SD_OBSOLETE_INDEXED_DB@@\);/u,'legacy migration store names must be injected separately from the canonical topology');
assert.doesNotMatch(app,/dbName:\s*['"]sdmLocalAppDB\.v1['"]/u,'host must not redeclare the IndexedDB identity');
for(const name of idbStores){
  const surface=DATA_ARCHITECTURE.indexedDb[name],identity=INDEXED_DB.stores[name],runtime=RUNTIME_DATA_CONTRACT.storage.stores[name];
  assert.ok(surface.schema,`IndexedDB store ${name} must declare its current schema`);
  assert.equal(surface.schema,identity.schema,`IndexedDB store ${name} schema must match the canonical identity manifest`);
  assert.equal(runtime.schema,identity.schema,`runtime data contract store ${name} schema must match the canonical identity manifest`);
  assert.equal(runtime.key,identity.key,`runtime data contract store ${name} key must match the canonical identity manifest`);
}
assert.deepEqual(CANONICAL_OPFS_IDENTITIES,OPFS_IDENTITIES);
assert.equal(EXTERNAL_FORMATS.completeBackup.metadataVersion,RUNTIME_DATA_CONTRACT.schemas.Backup.version);
const attachmentWorkerSource=read('portable/attachment-worker.ts');
const streamEncryptionSource=read('portable/stream-encryption.js');
assert.ok(attachmentWorkerSource.includes("const DIRECTORY='@@SD_ATTACHMENT_OPFS_DIRECTORY@@';"),'standalone attachment worker must consume the build-injected canonical OPFS identity');
assert.ok(read('source/external/attachment-worker.js').includes('@@SD_ATTACHMENT_OPFS_DIRECTORY@@'),'emitted attachment-worker source must retain the canonical OPFS token until the release build renders it');
const protectedMagicLiteral=JSON.stringify(EXTERNAL_FORMATS.protectedBackup.magic).slice(1,-1);
assert.ok(streamEncryptionSource.includes(`new TextEncoder().encode('${protectedMagicLiteral}')`),'standalone encryption worker magic must mechanically match the canonical manifest');
assert.ok(streamEncryptionSource.includes(`header[8]!==${EXTERNAL_FORMATS.protectedBackup.version}`),'standalone encryption reader version must mechanically match the canonical manifest');
const literal=value=>String(value).replaceAll('\\','\\\\').replaceAll('\r','\\r').replaceAll('\n','\\n').replaceAll("'","\\'");
assert.ok(read('source/core/asset-storage.js').includes("DIRECTORY='@@SD_ATTACHMENT_OPFS_DIRECTORY@@'"),'attachment storage must consume the build-injected canonical OPFS identity');
assert.ok(read('source/core/asset-storage.js').includes("LEGACY_DIRECTORY='@@SD_LEGACY_ATTACHMENT_OPFS_DIRECTORY@@'"),'legacy attachment cleanup must consume the build-injected obsolete OPFS identity');
assert.ok(read('source/core/exports.js').includes("ROOT='@@SD_BACKUP_FILES_OPFS_DIRECTORY@@'"),'backup temporary-file storage must consume the build-injected canonical OPFS identity');
assert.ok(read('portable/file-output.js').includes("OPFS_DIRECTORY='@@SD_BACKUP_FILES_OPFS_DIRECTORY@@'"),'portable worker output must resolve the same canonical scratch directory itself');
assert.match(read('source/core/exports.js'),/output:Object\.freeze\(\{kind:'opfs',name:staged\.name\}\)/u,'portable file work must send only an opaque scratch identity to the worker, never a FileSystemHandle');
assert.doesNotMatch(read('source/core/exports.js'),/data=\{\.\.\.data,output:staged\.handle/u,'portable worker messages must not structured-clone an OPFS FileSystemHandle');
assert.ok(read('source/core/backup-codec.js').includes(`BACKUP_V10_MAGIC='${literal(EXTERNAL_FORMATS.completeBackup.containerMagic)}'`),'backup container magic must mechanically match the canonical manifest');
const attachmentsSource=read('source/core/attachments.js');
assert.ok(attachmentsSource.includes(`encode('${literal(EXTERNAL_FORMATS.attachmentArchive.magic)}')`),'attachment archive magic must mechanically match the canonical manifest');
assert.ok(attachmentsSource.includes(`m.format!=='${literal(EXTERNAL_FORMATS.attachmentArchive.format)}'||m.version!==${EXTERNAL_FORMATS.attachmentArchive.version}`),'attachment archive manifest identity must mechanically match the canonical manifest');
assert.doesNotMatch(read('source/external/drive.js'),/SDENC02|\.sdbackup/u,'Drive repository transport must remain opaque to portable/protected backup container formats');
assert.match(app,/const APP_META_REGISTRY=Object\.freeze\(Object\.fromEntries\(Object\.entries\(@@SD_APP_META_REGISTRY@@\)\.map/u,'host must deep-freeze each build-injected typed appMeta registry definition before strict validation');
assert.match(app,/function exactAppMetaFamily\(capability,key,label=/u,'typed exact-key adapters must enforce logical appMeta ownership');
assert.match(app,/JournalAppMeta\.read\('restoreJournalPayload'\)/u,'temporary backup-file retention must read the typed restore-journal family only');
assert.match(appMeta,/function registerValidators\(validationOwner,ownerValidators\)/u,'appMeta gateway must register validators independently by validation owner');
assert.match(appMeta,/function bind\(owner\)/u,'appMeta gateway must expose separately owner-scoped capabilities');
assert.match(appMeta,/view:tx=>createView\(cleanOwner,tx\)/u,'appMeta gateway must expose transaction-scoped typed views');
assert.match(appMeta,/function canonicalEnvelope\(row,key\)/u,'appMeta gateway must centrally validate canonical envelopes');
assert.match(appMeta,/validateValue\(definition,row\.value,key,suffix\)/u,'appMeta gateway must centrally apply family value validation');
assert.match(app,/compatibilityAppMeta:CompatibilityAppMeta/u,'AppData migration paths must receive the compatibility-owned metadata capability explicitly');
assert.match(app,/return ExportsAppMeta\.transaction\('readwrite'/u,'backup-protection policy mutation must use the exports-owned metadata capability');
assert.match(app,/settings:exactAppMetaStorage\(DeviceBackupAppMeta,'automaticDeviceBackup'/u,'Device Backup settings must use the device-backup-owned metadata capability');
assert.match(app,/BackupAppMeta\.read\('repositoryIntegrityScrub'\)/u,'repository scrub state must use the backup-owned metadata capability');

for(const pattern of [
  /reflectionDraftMigration\.v1/u,/const PLAN_DRAFT_KEY=['"]/u,/const KEY='insightsDatasetRevision'/u,
  /const AREA_NOTE_RECOVERY_META_PREFIX=['"]/u,/idbGetMeta\('dailyRecordMigration'\)/u,/idbGetMeta\('dataMaintenance'\)/u,/idbPutMeta\('dataMaintenance'/u
])assert.doesNotMatch(repositories,pattern,'repository appMeta identities must come from the central contract');
for(const pattern of [
  /const LIBRARY_CLEAR_JOURNAL_STATE_KEY=['"]/u,/const LIBRARY_CLEAR_JOURNAL_CHUNK_PREFIX=['"]/u,
  /const RESTORE_JOURNAL_STATE_KEY=['"]/u,/const RESTORE_JOURNAL_PAYLOAD_KEY=['"]/u,/const MUTATION_LEASE_KEY=['"]/u
])assert.doesNotMatch(journals,pattern,'journal appMeta identities must come from the host contract');
assert.doesNotMatch(persistence,/key:'dailyRecordMigration'/u,'IndexedDB upgrade metadata identity must be injected from the central contract');

// Insights preference is part of the same authoritative localStorage identity map.

assert.equal(LOCAL_STORAGE_KEYS.insightsWindow,'studyDirector.insights.window.v1');
assert.equal(LOCAL_STORAGE_KEYS.libraryView,'studyDirector.library.view.v1');
assert.doesNotMatch(insights,/['"]studyDirector\.insights\.window\.v1['"]/u);
assert.doesNotMatch(insights,/StudyDirector\?\.data\?\.storageKeys/u,'Insights must not depend on a public raw storage-identity capability once the bounded device-state port exists');

// No source module may mint a direct studyDirector.* localStorage identity outside the central contract/build injection.
for(const file of sourceFiles){
  const text=fs.readFileSync(file,'utf8');
  assert.doesNotMatch(text,/localStorage\.(?:getItem|setItem|removeItem)\(\s*['"]studyDirector\./u,`raw durable localStorage identity bypass in ${path.relative(root,file)}`);
}

assert.equal(DATA_ARCHITECTURE.indexedDb.dailySummaries.role,'derived');
assert.equal(Object.keys(DATA_ARCHITECTURE.indexedDb).length,6,'current IndexedDB topology must be six stores after Reflection Draft retirement');
assert.deepEqual(Object.keys(DATA_ARCHITECTURE.obsoleteIndexedDb).sort(),Object.keys(OBSOLETE_INDEXED_DB.stores).sort());
assert.equal(DATA_ARCHITECTURE.obsoleteIndexedDb.syncQueue.role,'legacy-migration');
assert.equal(DATA_ARCHITECTURE.obsoleteIndexedDb.tombstones.role,'legacy-migration');
assert.match(DATA_ARCHITECTURE.obsoleteIndexedDb.syncQueue.lifecycle,/removed after verified/u);
assert.match(DATA_ARCHITECTURE.obsoleteIndexedDb.tombstones.lifecycle,/removed after verified/u);
assert.equal(DATA_ARCHITECTURE.appMeta.exact.canonicalMutationEpoch.role,'coordination','canonical mutation epoch must remain non-portable coordination metadata, not user authority');
assert.match(DATA_ARCHITECTURE.appMeta.exact.canonicalMutationEpoch.lifecycle,/atomically with portable canonical mutations/u);
assert.equal(DATA_ARCHITECTURE.appMeta.prefixes.savedDayDeletionPrefix.role,'canonical-deletion-history');
assert.equal(DATA_ARCHITECTURE.appMeta.prefixes.savedDayDeletionPrefix.protection,'protect');
assert.equal(DATA_ARCHITECTURE.opfs.attachments.role,'canonical-bytes');
assert.equal(DATA_ARCHITECTURE.appMeta.exact.attachmentIntegrityAudit.protection,'protect');
assert.equal(DATA_ARCHITECTURE.appMeta.exact.repositoryIntegrityScrub.role,'derived-health');
assert.match(DATA_ARCHITECTURE.appMeta.exact.repositoryIntegrityScrub.lifecycle,/no user-content details/u);
assert.match(DATA_ARCHITECTURE.localStorage.storageHealth.lifecycle,/no user-content details/u);
assert.deepEqual(Object.keys(DATA_ARCHITECTURE.obsoleteLocalStorage).sort(),Object.keys(OBSOLETE_LOCAL_STORAGE_KEYS).sort());
assert.equal(OBSOLETE_APP_META_KEYS.reflectionDraftMigration,'reflectionDraftMigration.v1');
assert.equal(DATA_ARCHITECTURE.appMeta.obsolete.reflectionDraftMigration.role,'legacy-residue');
assert.equal(OBSOLETE_APP_META_KEYS.repositoryMaintenancePendingLegacy,'repositoryMaintenancePending.v1');
assert.equal(DATA_ARCHITECTURE.appMeta.obsolete.repositoryMaintenancePendingLegacy.role,'legacy-migration');
assert.match(DATA_ARCHITECTURE.appMeta.obsolete.repositoryMaintenancePendingLegacy.lifecycle,/verified replacement/u);
assert.equal(OBSOLETE_OPFS_IDENTITIES.attachmentsV1,'study-director-assets-v1');
assert.equal(OPFS_IDENTITIES.attachments,'study-director-assets-v2');
for(const boundary of ['completeBackup','deviceBackup','driveBackup','attachmentArchive','markdownExport','zipExport'])assert.ok(DATA_ARCHITECTURE.external[boundary],`external boundary ${boundary} must be classified`);


const sw=read('source/platform/sw.js'),deviceBackupSource=read('source/core/device-backup.js')+read('source/core/device-folder-storage.js'),driveSource=read('source/external/drive.js');
assert.match(sw,/@@SD_CACHE_STORAGE_IDENTITIES@@/u,'service worker cache identities must come from the canonical contract');
assert.doesNotMatch(sw,/const CACHE_PREFIX=['"]study-director-shell-/u,'service worker must not mint the shell cache prefix');
assert.doesNotMatch(sw,/const bridgeCache=['"]study-director-update-bridge-v2/u,'service worker must not mint the update bridge cache');
assert.match(app,/const EXTERNAL_REPOSITORY_IDENTITIES=Object\.freeze\(@@SD_EXTERNAL_REPOSITORY_IDENTITIES@@\)/u,'Device Backup repository directories must come from the canonical contract');assert.match(app,/identities:Object\.freeze\(\{root:EXTERNAL_REPOSITORY_IDENTITIES\.deviceFolderRoot/u,'Device Folder storage receives its directory names from the canonical contract');
assert.doesNotMatch(deviceBackupSource,/Study-Director-Automatic-Backup-Repository/u,'Device Backup must not mint its repository root');
assert.doesNotMatch(deviceBackupSource,/id:['"]study-director-device-backup/u,'Device Backup must not mint its persistent picker identity');
assert.match(app,/pickerId:EXTERNAL_REPOSITORY_IDENTITIES\.deviceFolderPickerId/u,'Device Backup picker identity must come from the canonical contract');
assert.match(driveSource,/@@SD_EXTERNAL_REPOSITORY_IDENTITIES@@/u,'Drive repository folder identity must come from the canonical contract');
assert.doesNotMatch(driveSource,/const FOLDER_NAME=['"]Study Director Backups/u,'Drive must not mint its repository folder');
for(const identity of ['studyDirectorFolder','studyDirectorSecurity','studyDirectorSha256','studyDirectorRepository','studyDirectorRepositoryVersion','studyDirectorRepositoryKind','studyDirectorRepositoryId'])assert.ok(!driveSource.includes(`'${identity}'`),`Drive must not mint durable appProperties identity ${identity}`);
for(const field of ['driveFolderMarker','driveFileSecurityMarker','driveFileDigestMarker','driveRepositoryMarker','driveRepositoryVersionMarker','driveRepositoryKindMarker','driveRepositoryIdMarker','driveAppVersionMarker','driveExportedAtMarker'])assert.ok(driveSource.includes(`REPOSITORY_IDENTITIES.${field}`),`Drive must consume canonical external identity ${field}`);
assert.doesNotMatch(insights,/\blocalStorage\.(?:getItem|setItem|removeItem)\(/u,'Insights must use the injected device-state storage capability');
assert.match(insights,/StudyDirector\?\.data\?\.deviceState/u,'Insights must consume the host device-state capability');
assert.match(app,/deviceState:Object\.freeze\(\{[\s\S]{0,320}readInsightsWindow:[\s\S]{0,180}AppData\.local\.getText[\s\S]{0,220}writeInsightsWindow:[\s\S]{0,180}AppData\.local\.setText/u,'host must expose only the bounded Insights device-local preference capability');
assert.match(app,/function pwaLastUpdateCheckAt\(\)[\s\S]{0,260}AppData\.local\.getText\(STORAGE_KEYS\.pwaUpdateCheck/u,'PWA update bookkeeping must use the LocalStorage abstraction');
assert.match(app,/function markPwaUpdateCheck[\s\S]{0,260}AppData\.local\.setText\(STORAGE_KEYS\.pwaUpdateCheck/u,'PWA update timestamp writes must use the LocalStorage abstraction');
const appDirectLocal=[...app.matchAll(/\blocalStorage\.(?:getItem|setItem|removeItem)\(/gu)];
assert.equal(appDirectLocal.length,2,'host direct localStorage access must be limited to the two pre-hydration appearance mirror helpers');
assert.ok(appDirectLocal.every(match=>match.index<app.indexOf('const LocalStorageContract=')),'direct host localStorage must occur only before the persistence abstraction is created');

// Obsolete metadata cleanup belongs to the temporary compatibility port, not recurring maintenance.
assert.match(repositories,/cleanupObsoleteMetadata:removeObsoleteMetadata/u);
const maintenanceStart=repositories.indexOf('async function runDataMaintenance');
const maintenanceEnd=repositories.indexOf('function scheduleDataMaintenance',maintenanceStart);
const maintenance=maintenanceStart>=0&&maintenanceEnd>maintenanceStart?repositories.slice(maintenanceStart,maintenanceEnd):'';
assert.doesNotMatch(maintenance,/removeObsoleteMetadata/u,'normal recurring maintenance must not retain migration cleanup');

console.log(JSON.stringify({
  status:'PASS',suite:'data-architecture',indexedDbStores:idbStores.length,
  localStorageKeys:Object.keys(LOCAL_STORAGE_KEYS).length,obsoleteLocalStorageKeys:Object.keys(OBSOLETE_LOCAL_STORAGE_KEYS).length,
  appMetaIdentities:Object.keys(APP_META_KEYS).length,obsoleteAppMetaIdentities:Object.keys(OBSOLETE_APP_META_KEYS).length,
  externalBoundaries:Object.keys(DATA_ARCHITECTURE.external).length,sessionStorageKeys:Object.keys(SESSION_STORAGE_KEYS).length
},null,2));
