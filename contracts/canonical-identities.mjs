const freeze=Object.freeze;
const store=(name,key,schema,schemaVersion)=>freeze({name,key,schema,schemaVersion});

export const INDEXED_DB=freeze({
  name:'sdmLocalAppDB.v1',
  version:7,
  stores:freeze({
    dailyRecords:store('dailyRecords','date','DailyRecord.v16',16),
    dailySummaries:store('dailySummaries','date','DailySummary.v5',5),
    areaNotes:store('areaNotes','key','AreaNote.v2',2),
    activeSessions:store('activeSessions','id','ActiveSession.v9',9),
    appMeta:store('appMeta','key','AppMeta.v1',1),
    assets:store('assets','assetId','Attachment.v2',2)
  })
});

export const CURRENT_SCHEMA_VERSIONS=freeze({
  DailyRecord:16,
  DailySummary:5,
  SessionSnapshot:6,
  LocalRecoveryEnvelope:1,
  ActiveSession:9,
  AreaNote:2,
  AppMeta:1,
  CheckpointMetadata:1,
  CheckpointProtectedManifest:2
});

export const OBSOLETE_INDEXED_DB=freeze({
  baselineVersion:5,
  stores:freeze({syncQueue:'syncQueue',tombstones:'tombstones',reflectionDrafts:'reflectionDrafts'})
});

export const ACTIVE_SESSION_ID='current';
// Portable checkpoint provenance is deliberately separate from user-domain records.
// B3 keeps checkpoint authority/deletion semantics in a distinct protected manifest so future encryption can protect them without changing canonical domain schemas.
export const CHECKPOINT_METADATA=freeze({
  format:'study-director.checkpoint-metadata',
  version:CURRENT_SCHEMA_VERSIONS.CheckpointMetadata,
  fields:freeze(['format','version','checkpointId','createdAt','originInstallationId'])
});

export const CHECKPOINT_PROTECTED_MANIFEST=freeze({
  format:'study-director.checkpoint-protected-manifest',
  version:CURRENT_SCHEMA_VERSIONS.CheckpointProtectedManifest,
  fields:freeze(['format','version','checkpointId','sourceRevision','authority','savedDayDeletions','areaNoteDeletions','attachmentDeletions'])
});

export const OPFS_IDENTITIES=freeze({
  attachments:'study-director-assets-v2',
  backupFiles:'study-director-backup-files-v1'
});
export const OBSOLETE_OPFS_IDENTITIES=freeze({attachmentsV1:'study-director-assets-v1'});
export const ATTACHMENT_OPFS_DIRECTORY=OPFS_IDENTITIES.attachments;
export const BACKUP_FILES_OPFS_DIRECTORY=OPFS_IDENTITIES.backupFiles;

// Durable names outside IndexedDB are authoritative here too. Feature code must
// consume these identities rather than minting cache/repository directories.
export const CACHE_STORAGE_IDENTITIES=freeze({
  shellPrefix:'study-director-shell-',
  updateBridge:'study-director-update-bridge-v2',
  updateRecoveryPrefix:'study-director-update-bridge-v2-'
});

export const EXTERNAL_REPOSITORY_IDENTITIES=freeze({
  deviceFolderPickerId:'study-director-device-backup',
  deviceFolderRoot:'Study-Director-Automatic-Backup-Repository',
  deviceFolderObjects:'objects',
  deviceFolderCheckpoints:'checkpoints',
  deviceFolderCommits:'commits',
  driveFolder:'Study Director Backups',
  driveFolderMarker:'studyDirectorFolder',
  driveFileSecurityMarker:'studyDirectorSecurity',
  driveFileDigestMarker:'studyDirectorSha256',
  driveRepositoryMarker:'studyDirectorRepository',
  driveRepositoryVersionMarker:'studyDirectorRepositoryVersion',
  driveRepositoryKindMarker:'studyDirectorRepositoryKind',
  driveRepositoryIdMarker:'studyDirectorRepositoryId',
  driveAppVersionMarker:'studyDirectorVersion',
  driveExportedAtMarker:'exportedAt'
});

export const EXTERNAL_FORMATS=freeze({
  completeBackup:freeze({format:'study-director-backup',metadataVersion:20,containerMagic:'SDBK10\r\n'}),
  protectedBackup:freeze({magic:'SDENC02\n',version:2}),
  attachmentArchive:freeze({format:'study-director.attachments',magic:'SDAT01\r\n',version:1})
});
export const COMPLETE_BACKUP_MAGIC=EXTERNAL_FORMATS.completeBackup.containerMagic;
export const PROTECTED_BACKUP_MAGIC=EXTERNAL_FORMATS.protectedBackup.magic;
export const PROTECTED_BACKUP_VERSION=EXTERNAL_FORMATS.protectedBackup.version;

export const RUNTIME_DATA_CONTRACT=freeze({
  app:'study-director-v3_1',
  storage:freeze({
    dbName:INDEXED_DB.name,
    dbVersion:INDEXED_DB.version,
    stores:freeze(Object.fromEntries(Object.entries(INDEXED_DB.stores).map(([id,value])=>[id,freeze({key:value.key,schema:value.schema})])))
  }),
  schemas:freeze({
    DailyRecord:freeze({version:CURRENT_SCHEMA_VERSIONS.DailyRecord,key:'date'}),
    DailySummary:freeze({version:CURRENT_SCHEMA_VERSIONS.DailySummary,key:'date'}),
    SessionSnapshot:freeze({version:CURRENT_SCHEMA_VERSIONS.SessionSnapshot}),
    LocalRecoveryEnvelope:freeze({version:CURRENT_SCHEMA_VERSIONS.LocalRecoveryEnvelope}),
    ActiveSession:freeze({version:CURRENT_SCHEMA_VERSIONS.ActiveSession,key:ACTIVE_SESSION_ID}),
    AreaNote:freeze({version:CURRENT_SCHEMA_VERSIONS.AreaNote,key:'key'}),
    AppMeta:freeze({version:CURRENT_SCHEMA_VERSIONS.AppMeta,key:'key'}),
    CheckpointMetadata:freeze({version:CURRENT_SCHEMA_VERSIONS.CheckpointMetadata,format:CHECKPOINT_METADATA.format}),
    CheckpointProtectedManifest:freeze({version:CURRENT_SCHEMA_VERSIONS.CheckpointProtectedManifest,format:CHECKPOINT_PROTECTED_MANIFEST.format}),
    Backup:freeze({version:EXTERNAL_FORMATS.completeBackup.metadataVersion,format:EXTERNAL_FORMATS.completeBackup.format})
  })
});

export const INDEXED_DB_STORE_NAMES=freeze(Object.fromEntries(Object.entries(INDEXED_DB.stores).map(([id,value])=>[id,value.name])));

export function assertCanonicalIdentities(){
  if(!Object.isFrozen(INDEXED_DB)||!Object.isFrozen(INDEXED_DB.stores)||!Object.isFrozen(CURRENT_SCHEMA_VERSIONS)||!Object.isFrozen(OPFS_IDENTITIES)||!Object.isFrozen(OBSOLETE_OPFS_IDENTITIES)||!Object.isFrozen(CACHE_STORAGE_IDENTITIES)||!Object.isFrozen(EXTERNAL_REPOSITORY_IDENTITIES)||!Object.isFrozen(EXTERNAL_FORMATS)||!Object.isFrozen(CHECKPOINT_METADATA)||!Object.isFrozen(CHECKPOINT_METADATA.fields)||!Object.isFrozen(CHECKPOINT_PROTECTED_MANIFEST)||!Object.isFrozen(CHECKPOINT_PROTECTED_MANIFEST.fields)||!Object.isFrozen(OBSOLETE_INDEXED_DB)||!Object.isFrozen(OBSOLETE_INDEXED_DB.stores)||!Object.isFrozen(RUNTIME_DATA_CONTRACT))throw new TypeError('Canonical persistence identities must be frozen.');
  if(!INDEXED_DB.name||!Number.isSafeInteger(INDEXED_DB.version)||INDEXED_DB.version<1)throw new Error('IndexedDB identity is invalid.');
  const physicalNames=Object.values(INDEXED_DB_STORE_NAMES);
  if(physicalNames.length!==6||new Set(physicalNames).size!==physicalNames.length)throw new Error('IndexedDB store identities are incomplete or duplicated.');
  for(const [id,value] of Object.entries(INDEXED_DB.stores)){
    if(!value.name||!value.key||!value.schema||!Number.isSafeInteger(value.schemaVersion)||value.schemaVersion<1)throw new Error(`IndexedDB store ${id} identity is invalid.`);
    if(!value.schema.endsWith(`.v${value.schemaVersion}`))throw new Error(`IndexedDB store ${id} schema name/version drifted.`);
  }
  if(OBSOLETE_INDEXED_DB.baselineVersion>=INDEXED_DB.version||new Set(Object.values(OBSOLETE_INDEXED_DB.stores)).size!==Object.values(OBSOLETE_INDEXED_DB.stores).length)throw new Error('Obsolete IndexedDB identities are invalid.');
  if(Object.values(OBSOLETE_INDEXED_DB.stores).some(name=>physicalNames.includes(name)))throw new Error('Obsolete IndexedDB stores must not remain canonical stores.');
  if(new Set(Object.values(OPFS_IDENTITIES)).size!==Object.values(OPFS_IDENTITIES).length)throw new Error('Current OPFS identities must be unique.');
  if(new Set(Object.values(OBSOLETE_OPFS_IDENTITIES)).size!==Object.values(OBSOLETE_OPFS_IDENTITIES).length||Object.values(OBSOLETE_OPFS_IDENTITIES).some(value=>Object.values(OPFS_IDENTITIES).includes(value)))throw new Error('Obsolete OPFS identities must be unique and outside the current identity set.');
  if(new Set(Object.values(CACHE_STORAGE_IDENTITIES)).size!==Object.values(CACHE_STORAGE_IDENTITIES).length)throw new Error('Cache Storage identities must be unique.');
  if(!CACHE_STORAGE_IDENTITIES.updateRecoveryPrefix.startsWith(CACHE_STORAGE_IDENTITIES.updateBridge))throw new Error('Update recovery cache identity must derive from the update bridge identity.');
  if(new Set(Object.values(EXTERNAL_REPOSITORY_IDENTITIES)).size!==Object.values(EXTERNAL_REPOSITORY_IDENTITIES).length)throw new Error('External repository identities must be unique.');
  if(RUNTIME_DATA_CONTRACT.storage.dbName!==INDEXED_DB.name||RUNTIME_DATA_CONTRACT.storage.dbVersion!==INDEXED_DB.version)throw new Error('Runtime data contract database identity drifted.');
  for(const [id,value] of Object.entries(INDEXED_DB.stores)){
    const runtime=RUNTIME_DATA_CONTRACT.storage.stores[id];
    if(!runtime||runtime.key!==value.key||runtime.schema!==value.schema)throw new Error(`Runtime data contract store ${id} drifted.`);
  }
  if(RUNTIME_DATA_CONTRACT.schemas.CheckpointMetadata.version!==CHECKPOINT_METADATA.version||RUNTIME_DATA_CONTRACT.schemas.CheckpointMetadata.format!==CHECKPOINT_METADATA.format)throw new Error('Checkpoint metadata identity drifted.');
  if(RUNTIME_DATA_CONTRACT.schemas.CheckpointProtectedManifest.version!==CHECKPOINT_PROTECTED_MANIFEST.version||RUNTIME_DATA_CONTRACT.schemas.CheckpointProtectedManifest.format!==CHECKPOINT_PROTECTED_MANIFEST.format)throw new Error('Checkpoint protected-manifest identity drifted.');
  if(RUNTIME_DATA_CONTRACT.schemas.Backup.version!==EXTERNAL_FORMATS.completeBackup.metadataVersion||RUNTIME_DATA_CONTRACT.schemas.Backup.format!==EXTERNAL_FORMATS.completeBackup.format)throw new Error('Runtime backup identity drifted.');
  return true;
}
assertCanonicalIdentities();
