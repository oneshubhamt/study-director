(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,functionPort:functions}=registry.contracts;
registry.define('backup-codec',1,()=>{
  const freeze=Object.freeze;
  function createBackupCodec(input){
    exactObject(input,['appConfig','limits','dataContract','legacy','entityTypes','keyedRecord','entities','helpers','richText','dailyRecordCodec','activeSessionCodec','compatibilityCodec','personalDataCodec','processing'],'Backup codec input');
    if(!Object.isFrozen(input.appConfig)||!Object.isFrozen(input.limits)||!Object.isFrozen(input.dataContract)||!Object.isFrozen(input.entityTypes)||!Object.isFrozen(input.keyedRecord)||!Object.isFrozen(input.richText)||!Object.isFrozen(input.dailyRecordCodec)||!Object.isFrozen(input.activeSessionCodec)||!Object.isFrozen(input.compatibilityCodec)||!Object.isFrozen(input.personalDataCodec)){
      throw new TypeError('Backup codec contracts must be frozen.');
    }
    if(input.compatibilityCodec.format!=='study-director.compatibility-codecs'||input.compatibilityCodec.contractVersion!==1)throw new TypeError('Backup compatibility codec contract is invalid.');
    functions(input.entities,['entityDefinition','entityIdentity'],'Backup entity contract');
    functions(input.helpers,['boundedInt','jsonByteLength'],'Backup codec helpers');
    exactObject(input.legacy,['schemaVersion','tombstoneLimit'],'Backup legacy compatibility');
    functions(input.richText,['assetIds','assetIdValid','imageMimeTypeValid'],'Backup rich-text contract');
    const Processing=input.processing;
    functions(Processing,['run','scope'],'Backup processing contract');
    const APP_CONFIG=input.appConfig;
    const APP_LIMITS=input.limits;
    const DATA_CONTRACT=input.dataContract;
    const LEGACY_BACKUP_SCHEMA_VERSION=Number(input.legacy.schemaVersion)||0;
    const LEGACY_TOMBSTONE_LIMIT=Math.max(0,Number(input.legacy.tombstoneLimit)||0);
    const PersonalDataCodec=input.personalDataCodec;
    const SOURCE_ENTITY_TYPES=freeze([...input.entityTypes].filter(type=>type!=='tombstone'));
    const LEGACY_TOMBSTONE_TYPE='tombstone',LEGACY_REFLECTION_DRAFT_TYPE='reflectionDraft',LEGACY_REFLECTION_DRAFT_LIMIT=Math.max(1,Number(APP_LIMITS.maxImportRecords)||10000);
    const BACKUP_ENTITY_TYPES=freeze([...SOURCE_ENTITY_TYPES,'personalData','checkpointManifest']);
    const KeyedRecord=input.keyedRecord;
    const ActiveSessionCodec=input.activeSessionCodec;
    const CompatibilityCodec=input.compatibilityCodec;
    // Historical completion proofs depend on the original entity order.
    const LEGACY_SOURCE_ENTITY_TYPES=freeze([...SOURCE_ENTITY_TYPES,LEGACY_REFLECTION_DRAFT_TYPE]);
    const BACKUP_ENTITY_TYPES_V15_TO_V18=freeze([...LEGACY_SOURCE_ENTITY_TYPES,'personalData','checkpointManifest']);
    const LEGACY_SYNC_ENTITY_TYPES=freeze([...SOURCE_ENTITY_TYPES,LEGACY_TOMBSTONE_TYPE,LEGACY_REFLECTION_DRAFT_TYPE]);
    const BACKUP_ENTITY_TYPES_V11_TO_V14=freeze([...LEGACY_SYNC_ENTITY_TYPES,'personalData']);
    const BACKUP_ENTITY_TYPES_V9_TO_V10=LEGACY_SYNC_ENTITY_TYPES;
    const LEGACY_BACKUP_ENTITY_TYPES=freeze([...SOURCE_ENTITY_TYPES,LEGACY_TOMBSTONE_TYPE]);
    function backupEntityTypesForVersion(version){
      const value=Number(version);
      return value>=19?BACKUP_ENTITY_TYPES:value>=15?BACKUP_ENTITY_TYPES_V15_TO_V18:value>=11?BACKUP_ENTITY_TYPES_V11_TO_V14:value>=9?BACKUP_ENTITY_TYPES_V9_TO_V10:LEGACY_BACKUP_ENTITY_TYPES;
    }
    const BACKUP_V10_MAGIC='SDBK10\r\n';
    const BACKUP_V10_HEADER_BYTES=13;
    const BACKUP_V10_FLAG_GZIP=1;
    const BACKUP_MAX_FILE_BYTES=Math.max(Number(APP_LIMITS.backupMaxFileBytes)||0,Number(APP_LIMITS.backupMaxCompressedBytes)||0);
    const BACKUP_MAX_ASSET_DESCRIPTORS=Math.max(1,Number(APP_LIMITS.backupMaxAssetDescriptors)||50000);
    function backupMaxAssetBytes(mimeType=''){
      const key=String(mimeType||'').startsWith('image/')?'richAssetMaxBytes':'attachmentPdfAudioMaxBytes';
      const fallback=key==='richAssetMaxBytes'?12*1024*1024:2*1024*1024*1024;
      const value=Number(APP_LIMITS[key]??fallback);
      if(!Number.isFinite(value)||value<=0)throw new TypeError('Backup attachment byte limit is invalid.');
      return value;
    }
    const {entityDefinition,entityIdentity}=input.entities;
    const {boundedInt,jsonByteLength}=input.helpers;
    const {assetIds:richTextAssetIds,assetIdValid:richTextAssetIdValid,imageMimeTypeValid:richTextImageMimeTypeValid}=input.richText;
    const sanitizeCurrentDailyRecord=input.dailyRecordCodec.sanitizeCurrentDailyRecord;
    const sanitizeCurrentAreaNote=input.dailyRecordCodec.sanitizeCurrentAreaNote;
    const isSupportedSavedDate=input.dailyRecordCodec.isSupportedSavedDate;
function assertSupportedSavedDate(record){
  const date=record&&record.date;
  if(!isSupportedSavedDate(date))throw new Error(`Backup contains unsupported saved-day date "${String(date||'missing')}". Supported dates are ${APP_LIMITS.minSupportedSavedDate} through today.`);
}
function backupUtf8Bytes(value){return new TextEncoder().encode(String(value??''));}
function backupChecksumAlgorithm(){
  if(typeof crypto!=='undefined'&&crypto.subtle&&typeof crypto.subtle.digest==='function')return 'sha256';
  throw new Error('This browser cannot create a cryptographically verified backup. Update the browser and retry.');
}
async function backupChecksumText(value,algorithm=backupChecksumAlgorithm()){return Processing.run('checksum',{value,algorithm});}
async function backupChecksumBlob(blob,options={}){if(!(blob instanceof Blob))throw new TypeError('Backup asset is not a Blob.');return Processing.run('checksum',{value:blob},options);}
function backupCollectRichAssetIds(value,target=new Set()){
  const inspect=current=>{
    if(typeof current==='string'){
      for(const rawId of richTextAssetIds(current)){const id=String(rawId||'');if(richTextAssetIdValid(id))target.add(id);}
      return;
    }
    if(Array.isArray(current)){for(const item of current)inspect(item);return;}
    if(current&&typeof current==='object')for(const child of Object.values(current))inspect(child);
  };
  inspect(value);return target;
}
function backupSanitizeAssetDescriptors(value){
  if(!Array.isArray(value)||value.length>BACKUP_MAX_ASSET_DESCRIPTORS)throw new Error('Backup asset descriptor list is invalid or too large.');
  const seen=new Set(),out=[];
  for(const raw of value){
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Backup contains an invalid asset descriptor.');
    const assetId=String(raw.assetId||'');
    if(!richTextAssetIdValid(assetId)||seen.has(assetId))throw new Error('Backup contains an invalid or duplicate asset identity.');
    seen.add(assetId);
    if(raw.missing===true){out.push(freeze({assetId,missing:true}));continue;}
    const mimeType=String(raw.mimeType||''),size=Number(raw.size),checksum=String(raw.checksum||'').toLowerCase();
    if(!richTextImageMimeTypeValid(mimeType)||!Number.isSafeInteger(size)||size<=0||size>backupMaxAssetBytes(mimeType)||!/^[a-f0-9]{64}$/.test(checksum))throw new Error('Backup contains an invalid attachment descriptor.');
    const name=String(raw.name||'');
    if(name.length>160||/[\u0000-\u001f\u007f]/.test(name)||(raw.library!==undefined&&typeof raw.library!=='boolean'))throw new Error('Backup attachment label or retention flag is invalid.');
    out.push(freeze({assetId,mimeType,size,checksum,name,library:raw.library===true}));
  }
  return freeze(out);
}
function backupCountShape(value={},types=BACKUP_ENTITY_TYPES){
  return Object.fromEntries(types.map(type=>[type,boundedInt(value[type],{min:0,max:backupEntityLimit(type),fallback:0})]));
}
function backupCountsEqual(a,b,types=BACKUP_ENTITY_TYPES){return types.every(type=>Number(a&&a[type]||0)===Number(b&&b[type]||0));}
function backupEntityLimit(entityType){return entityType===LEGACY_TOMBSTONE_TYPE?LEGACY_TOMBSTONE_LIMIT:entityType===LEGACY_REFLECTION_DRAFT_TYPE?LEGACY_REFLECTION_DRAFT_LIMIT:['personalData','checkpointManifest'].includes(entityType)?1:entityDefinition(entityType)?.backupLimit||0;}
function splitBackupItems(items){
  const groups=[];let current=[],bytes=2;
  for(const item of items||[]){
    const itemBytes=jsonByteLength(item);
    if(itemBytes>APP_LIMITS.backupMaxEntryBytes)throw new Error('A backup entry is too large to export safely.');
    if(current.length&&(current.length>=APP_LIMITS.backupChunkItems||bytes+itemBytes>APP_LIMITS.backupChunkTargetBytes)){
      groups.push(current);current=[];bytes=2;
    }
    current.push(item);bytes+=itemBytes+1;
  }
  if(current.length)groups.push(current);
  return groups;
}
function backupCheckpointMetadata(originInstallationId,createdAt){
  const contract=DATA_CONTRACT.schemas.CheckpointMetadata;
  if(!contract||contract.format!=='study-director.checkpoint-metadata'||Number(contract.version)!==1)throw new Error('Checkpoint metadata contract is unavailable.');
  const installationId=String(originInstallationId||'');
  if(!/^inst_[a-z0-9_]{8,128}$/iu.test(installationId))throw new Error('Backup installation identity is invalid.');
  const timestamp=String(createdAt||'');
  if(!Number.isFinite(Date.parse(timestamp)))throw new Error('Backup checkpoint timestamp is invalid.');
  const bytes=new Uint8Array(16);
  if(typeof crypto==='undefined'||typeof crypto.getRandomValues!=='function')throw new Error('This browser cannot create a checkpoint identity. Update the browser and retry.');
  crypto.getRandomValues(bytes);
  const checkpointId='cp_'+[...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');
  return freeze({format:contract.format,version:contract.version,checkpointId,createdAt:new Date(timestamp).toISOString(),originInstallationId:installationId});
}
function validateCheckpointMetadata(value){
  const contract=DATA_CONTRACT.schemas.CheckpointMetadata;
  if(!contract||!value||typeof value!=='object'||Array.isArray(value))throw new Error('Backup checkpoint metadata is missing.');
  const keys=Object.keys(value).sort().join('|');
  if(keys!==['checkpointId','createdAt','format','originInstallationId','version'].sort().join('|'))throw new Error('Backup checkpoint metadata contains unexpected fields.');
  if(value.format!==contract.format||Number(value.version)!==Number(contract.version)||!/^cp_[a-f0-9]{32}$/u.test(String(value.checkpointId||''))||!/^inst_[a-z0-9_]{8,128}$/iu.test(String(value.originInstallationId||''))||!Number.isFinite(Date.parse(String(value.createdAt||''))))throw new Error('Backup checkpoint metadata is invalid.');
  return value;
}
const LEGACY_CHECKPOINT_AUTHORITY=freeze({
  savedDays:'overlay-explicit-deletions',
  areaNotes:'complete-collection',
  reflectionDrafts:'complete-collection',
  activeSession:'complete-singleton',
  plans:'complete-collection',
  personalSettings:'complete-singleton',
  attachments:'referenced-plus-library'
});
const CHECKPOINT_AUTHORITY=freeze({
  savedDays:'pairwise-explicit-deletions',
  areaNotes:'pairwise-explicit-deletions',
  activeSession:'pairwise-singleton',
  plans:'pairwise-collection',
  personalSettings:'pairwise-singleton',
  attachments:'referenced-plus-library'
});
const LEGACY_V2_CHECKPOINT_AUTHORITY=freeze({...CHECKPOINT_AUTHORITY,reflectionDrafts:'freshness-latest-state'});
function normalizeCheckpointSavedDayDeletions(values){
  if(!Array.isArray(values))throw new Error('Checkpoint Saved-Day deletion history is invalid.');
  const byDate=new Map();
  for(const raw of values){
    const date=String(raw&&raw.date||''),deletedAt=String(raw&&raw.deletedAt||'');
    if(!isSupportedSavedDate(date)||!Number.isFinite(Date.parse(deletedAt)))throw new Error('Checkpoint contains an invalid Saved-Day deletion entry.');
    const clean=freeze({date,deletedAt:new Date(deletedAt).toISOString()}),previous=byDate.get(date);
    if(!previous||Date.parse(clean.deletedAt)>Date.parse(previous.deletedAt))byDate.set(date,clean);
  }
  if(byDate.size>APP_LIMITS.maxImportRecords)throw new Error('Checkpoint contains too many Saved-Day deletion entries.');
  return freeze([...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date)));
}
function normalizeCheckpointAreaNoteDeletions(values){
  if(!Array.isArray(values))throw new Error('Checkpoint Ongoing Note deletion history is invalid.');
  const byKey=new Map();
  for(const raw of values){
    const key=String(raw&&raw.key||'').trim(),deletedAt=String(raw&&raw.deletedAt||'');
    if(!key||key.length>Number(APP_LIMITS.maxAreaNameChars||240)||!Number.isFinite(Date.parse(deletedAt)))throw new Error('Checkpoint contains an invalid Ongoing Note deletion entry.');
    const clean=freeze({key,deletedAt:new Date(deletedAt).toISOString()}),previous=byKey.get(key);
    if(!previous||Date.parse(clean.deletedAt)>Date.parse(previous.deletedAt))byKey.set(key,clean);
  }
  if(byKey.size>APP_LIMITS.maxOngoingNotes)throw new Error('Checkpoint contains too many Ongoing Note deletion entries.');
  return freeze([...byKey.values()].sort((a,b)=>a.key.localeCompare(b.key)));
}
function normalizeCheckpointAttachmentDeletions(values){
  if(!Array.isArray(values))throw new Error('Checkpoint Attachment deletion history is invalid.');
  const byId=new Map();
  for(const raw of values){
    const assetId=String(raw&&raw.assetId||''),deletedAt=String(raw&&raw.deletedAt||'');
    if(!/^(?:att|img)-[a-z0-9-]{20,80}$/u.test(assetId)||!Number.isFinite(Date.parse(deletedAt)))throw new Error('Checkpoint contains an invalid Attachment deletion entry.');
    const clean=freeze({assetId,deletedAt:new Date(deletedAt).toISOString()}),previous=byId.get(assetId);
    if(!previous||Date.parse(clean.deletedAt)>Date.parse(previous.deletedAt))byId.set(assetId,clean);
  }
  if(byId.size>50000)throw new Error('Checkpoint contains too many Attachment deletion entries.');
  return freeze([...byId.values()].sort((a,b)=>a.assetId.localeCompare(b.assetId)));
}
function authorityMatches(value,expected){return !!(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===Object.keys(expected).sort().join('|')&&Object.entries(expected).every(([key,required])=>value[key]===required));}
function validateCheckpointAuthority(value,version){
  if(Number(version)===1){if(!authorityMatches(value,LEGACY_CHECKPOINT_AUTHORITY))throw new Error('Checkpoint authority contract is invalid.');return LEGACY_CHECKPOINT_AUTHORITY;}
  if(authorityMatches(value,CHECKPOINT_AUTHORITY))return CHECKPOINT_AUTHORITY;
  if(authorityMatches(value,LEGACY_V2_CHECKPOINT_AUTHORITY))return LEGACY_V2_CHECKPOINT_AUTHORITY;
  throw new Error('Checkpoint authority contract is invalid.');
}
function backupProtectedCheckpointManifest(plan,checkpoint){
  const contract=DATA_CONTRACT.schemas.CheckpointProtectedManifest;
  if(!contract||contract.format!=='study-director.checkpoint-protected-manifest'||Number(contract.version)!==2)throw new Error('Checkpoint protected-manifest contract is unavailable.');
  validateCheckpointMetadata(checkpoint);
  const sourceRevision=String(plan&&plan.sourceRevision||'');
  if(!Number.isFinite(Date.parse(sourceRevision)))throw new Error('Checkpoint source revision is invalid.');
  const savedDayDeletions=normalizeCheckpointSavedDayDeletions(plan&&plan.savedDayDeletions||[]),areaNoteDeletions=normalizeCheckpointAreaNoteDeletions(plan&&plan.areaNoteDeletions||[]),attachmentDeletions=normalizeCheckpointAttachmentDeletions(plan&&plan.attachmentDeletions||[]);
  const recordDates=new Set((plan&&plan.recordDates||[]).map(String)),noteKeys=new Set((plan&&plan.areaNoteItems||[]).map(item=>String(item&&item.key||''))),assetIds=new Set((plan&&plan.assetItems||[]).map(item=>String(item&&item.descriptor&&item.descriptor.assetId||'')));
  if(savedDayDeletions.some(entry=>recordDates.has(entry.date)))throw new Error('Checkpoint cannot contain both a Saved Day and its deletion marker.');
  if(areaNoteDeletions.some(entry=>noteKeys.has(entry.key)))throw new Error('Checkpoint cannot contain both an Ongoing Note and its deletion marker.');
  if(attachmentDeletions.some(entry=>assetIds.has(entry.assetId)))throw new Error('Checkpoint cannot contain both an Attachment Library identity and its deletion marker.');
  return freeze({format:contract.format,version:contract.version,checkpointId:checkpoint.checkpointId,sourceRevision:new Date(sourceRevision).toISOString(),authority:CHECKPOINT_AUTHORITY,savedDayDeletions,areaNoteDeletions,attachmentDeletions});
}
function validateProtectedCheckpointManifest(value,checkpoint=null,{normalizedLegacy=false}={}){
  const contract=DATA_CONTRACT.schemas.CheckpointProtectedManifest;
  if(!contract||!value||typeof value!=='object'||Array.isArray(value))throw new Error('Protected checkpoint manifest is missing.');
  const version=Number(value.version),legacy=version===1,current=version===Number(contract.version);
  if(!legacy&&!current)throw new Error('Protected checkpoint manifest version is unsupported.');
  const legacyWireKeys=['authority','checkpointId','format','savedDayDeletions','sourceRevision','version'],currentKeys=['areaNoteDeletions','attachmentDeletions','authority','checkpointId','format','savedDayDeletions','sourceRevision','version'];
  const expectedKeys=legacy&&normalizedLegacy?currentKeys:(legacy?legacyWireKeys:currentKeys);
  if(Object.keys(value).sort().join('|')!==expectedKeys.slice().sort().join('|'))throw new Error('Protected checkpoint manifest contains unexpected fields.');
  if(legacy&&normalizedLegacy&&(value.areaNoteDeletions?.length||value.attachmentDeletions?.length))throw new Error('Normalized legacy checkpoint manifest cannot contain deletion history introduced by newer formats.');
  if(value.format!==contract.format||!/^cp_[a-f0-9]{32}$/u.test(String(value.checkpointId||''))||!Number.isFinite(Date.parse(String(value.sourceRevision||''))))throw new Error('Protected checkpoint manifest is invalid.');
  if(checkpoint&&String(value.checkpointId)!==String(checkpoint.checkpointId))throw new Error('Protected checkpoint manifest does not match its public checkpoint provenance.');
  const authority=validateCheckpointAuthority(value.authority,version),savedDayDeletions=normalizeCheckpointSavedDayDeletions(value.savedDayDeletions),areaNoteDeletions=legacy?freeze([]):normalizeCheckpointAreaNoteDeletions(value.areaNoteDeletions),attachmentDeletions=legacy?freeze([]):normalizeCheckpointAttachmentDeletions(value.attachmentDeletions);
  return freeze({format:contract.format,version,checkpointId:String(value.checkpointId),sourceRevision:new Date(String(value.sourceRevision)).toISOString(),authority,savedDayDeletions,areaNoteDeletions,attachmentDeletions});
}
function buildBackupManifest(plan,{compression='none',algorithm=backupChecksumAlgorithm()}={}){
  const version=DATA_CONTRACT.schemas.Backup.version,currentCheckpoint=Number(version)>=14?(plan&&plan.checkpoint?validateCheckpointMetadata(plan.checkpoint):backupCheckpointMetadata(plan.installationId,plan.exportedAt)):null;
  const protectedContract=DATA_CONTRACT.schemas.CheckpointProtectedManifest;
  return {
    type:'manifest',format:DATA_CONTRACT.schemas.Backup.format,version,
    app:APP_CONFIG.appName,dataContract:DATA_CONTRACT.app,
    ...(currentCheckpoint?{checkpoint:currentCheckpoint}:{deviceId:plan.deviceId}),
    ...(Number(version)>=15?{protectedManifest:{format:protectedContract.format,version:protectedContract.version,entityType:'checkpointManifest'}}:{}),
    createdBy:APP_CONFIG.attribution,exportedAt:plan.exportedAt,
    encoding:'ndjson',compression,checksumAlgorithm:algorithm,declaredCounts:plan.counts,
    ...(Number(version)>=10?{container:'binary-v1'}:{}),
    limits:{maxEntryBytes:APP_LIMITS.backupMaxEntryBytes,maxRecords:APP_LIMITS.maxImportRecords,maxAreaNotes:APP_LIMITS.maxOngoingNotes}
  };
}
async function backupChunkEnvelope(seq,entityType,items,algorithm){return Processing.run('chunk',{seq,entityType,items,algorithm,maxLineBytes:APP_LIMITS.backupMaxLineBytes});}
async function encodeBackupCompletion(chunkCount,counts,chunkHashes,algorithm,assetDescriptors=[],captureAuthority='canonical-complete'){
  const version=DATA_CONTRACT.schemas.Backup.version;
  const proofBody={version,chunkCount,counts,chunkHashes};
  if(Number(version)>=10)proofBody.assets=backupSanitizeAssetDescriptors(assetDescriptors);
  if(Number(version)>=18){const authority=String(captureAuthority||'');if(!['canonical-complete','rescue-partial'].includes(authority))throw new Error('Backup capture authority is invalid.');proofBody.captureAuthority=authority;}
  const checksum=await backupChecksumText(proofBody,algorithm);
  return {type:'complete',...proofBody,checksum,completedAt:new Date().toISOString()};
}
function portableBackupCompressionSupported(){return typeof CompressionStream==='function'&&typeof DecompressionStream==='function';}
function sanitizeImportedRecord(record,{legacy=false}={}){
  return legacy?CompatibilityCodec.dailyRecord(record):sanitizeCurrentDailyRecord(record);
}
function backupImportReport(base={}){
  return Object.assign({legacy:false,sourceVersion:null,degraded:0,skipped:0,duplicates:0,invalidActiveSession:0,ignoredTombstones:0,warnings:[]},base||{});
}
async function backupFileHasGzipMagic(file){
  try{const bytes=new Uint8Array(await file.slice(0,2).arrayBuffer());return bytes.length===2&&bytes[0]===0x1f&&bytes[1]===0x8b;}catch(e){return false;}
}
function backupImportAbortError(signal){
  const reason=signal&&signal.reason;
  const error=reason instanceof Error?reason:new Error(String(reason||'Backup import was cancelled.'));
  if(!error.name||error.name==='Error')error.name='AbortError';
  if(!error.code)error.code='STUDY_DIRECTOR_IMPORT_CANCELLED';
  return error;
}
function backupThrowIfAborted(signal){if(signal&&signal.aborted)throw backupImportAbortError(signal);}
async function backupImportYield(options){
  backupThrowIfAborted(options&&options.signal);
  if(options&&typeof options.yieldControl==='function')await options.yieldControl();
  else await new Promise(resolve=>setTimeout(resolve,0));
  backupThrowIfAborted(options&&options.signal);
}
function backupFilename(options,file){return String(options&&options.filename||file&&file.name||'').toLowerCase();}
async function backupLooksChunked(file,options={}){
  const name=backupFilename(options,file);
  if(name.endsWith('.sdbackup')||name.endsWith('.sdbackup.gz')||await backupFileHasGzipMagic(file))return true;
  try{
    const prefix=await file.slice(0,Math.min(file.size||4096,4096)).text();
    const line=prefix.split(/\r?\n/,1)[0].trim();
    if(!line)return false;
    const value=JSON.parse(line);
    return !!(value&&value.type==='manifest'&&value.format===DATA_CONTRACT.schemas.Backup.format);
  }catch(e){return false;}
}
async function* backupDecodedLines(file,{gzip=false,state={},signal=null}={}){
  if(file.size>APP_LIMITS.backupMaxCompressedBytes)throw new Error('Backup file exceeds the safe file-size limit.');
  const id=await Processing.run('decode.open',{file,gzip,maxBytes:APP_LIMITS.backupMaxUncompressedBytes,maxLineBytes:APP_LIMITS.backupMaxLineBytes},{signal});
  try{for(;;){backupThrowIfAborted(signal);const next=await Processing.run('decode.next',{id},{signal});if(next.done)break;Object.assign(state,{uncompressedBytes:next.value.uncompressedBytes,lines:next.value.lines});yield next.value.value;}}
  finally{await Processing.run('decode.close',{id}).catch(()=>{});}
}
function validateBackupManifest(manifest,gzip,{binaryV10=false}={}){
  if(!manifest||manifest.type!=='manifest'||manifest.format!==DATA_CONTRACT.schemas.Backup.format)throw new Error('File is not a chunked Study Director backup.');
  const version=Number(manifest.version)||0;
  if(version>DATA_CONTRACT.schemas.Backup.version)throw new Error('This backup was created by a newer Study Director version. Update the app before importing it.');
  if(![7,8,9,10,11,12,13,14,15,16,17,18,19,20,21].includes(version))throw new Error('This backup version is not supported by this build.');
  if(version>=10&&!binaryV10)throw new Error('Backup v10 must use the binary-framed Study Director backup format.');
  if(version<10&&binaryV10)throw new Error('Binary backup framing is only valid for Study Director backup v10.');
  if(version>=10&&manifest.container!=='binary-v1')throw new Error('Backup v10 container metadata is invalid.');
  if(Number(manifest.schemaVersion||0)>LEGACY_BACKUP_SCHEMA_VERSION)throw new Error('This backup uses a newer data schema. Update the app before importing it.');
  if(manifest.encoding!=='ndjson')throw new Error('Unsupported backup encoding.');
  if((gzip?'gzip':'none')!==String(manifest.compression||'none'))throw new Error('Backup compression metadata does not match the file.');
  if(!['sha256','fnv1a32'].includes(manifest.checksumAlgorithm))throw new Error('Unsupported backup checksum algorithm.');
  if(version>=10&&manifest.checksumAlgorithm!=='sha256')throw new Error('Backup v10 requires SHA-256 integrity checks.');
  if(version>=14){
    validateCheckpointMetadata(manifest.checkpoint);
    if(Object.prototype.hasOwnProperty.call(manifest,'deviceId'))throw new Error('Current backups must not contain legacy device identity metadata.');
    if(new Date(String(manifest.checkpoint.createdAt)).toISOString()!==new Date(String(manifest.exportedAt)).toISOString())throw new Error('Backup checkpoint timestamp does not match the backup timestamp.');
  }
  if(version>=15){
    const protectedContract=DATA_CONTRACT.schemas.CheckpointProtectedManifest,descriptor=manifest.protectedManifest,expectedProtectedVersion=version===15?1:Number(protectedContract.version);
    if(!descriptor||typeof descriptor!=='object'||Array.isArray(descriptor)||Object.keys(descriptor).sort().join('|')!==['entityType','format','version'].sort().join('|')||descriptor.entityType!=='checkpointManifest'||descriptor.format!==protectedContract.format||Number(descriptor.version)!==expectedProtectedVersion)throw new Error('Backup protected-manifest descriptor is invalid.');
  }
  if(version>=11&&manifest.declaredCounts?.personalData!==1)throw new Error('Backup is missing its personal-data section.');
  const entityTypes=backupEntityTypesForVersion(version);
  const counts=backupCountShape(manifest.declaredCounts,entityTypes);
  if(version>=15&&counts.checkpointManifest!==1)throw new Error('Current checkpoint backup must contain exactly one protected checkpoint manifest.');
  if(!backupCountsEqual(counts,manifest.declaredCounts||{},entityTypes))throw new Error('Backup manifest contains unsafe entity counts.');
  return {manifest,counts,entityTypes};
}
// Backup v21 gave notes permanent ids and changed nothing else: a v20 file
// is current apart from its notes, whose name keys are converted, along with
// the names in its note deletion history.
const NOTE_ID_BACKUP_VERSION=21;
function legacyBackupItem(version,entityType){return Number(version)<(entityType==='areaNote'?NOTE_ID_BACKUP_VERSION:NOTE_ID_BACKUP_VERSION-1);}
function withNoteIdDeletions(manifest,nameKeyed){
  if(!manifest||!nameKeyed||!manifest.areaNoteDeletions.length)return manifest;
  const areaNoteDeletions=normalizeCheckpointAreaNoteDeletions(manifest.areaNoteDeletions.map(entry=>({key:CompatibilityCodec.areaNoteKey(entry.key),deletedAt:entry.deletedAt})));
  return freeze({...manifest,areaNoteDeletions});
}
function sanitizeChunkedBackupItem(entityType,item,{legacy=false}={}){
  if(jsonByteLength(item)>APP_LIMITS.backupMaxEntryBytes)throw new Error(`A ${entityType} entry exceeds the safe size limit.`);
  if(entityType==='personalData')return legacy?CompatibilityCodec.personalData(item):PersonalDataCodec.normalize(item);
  if(entityType==='dailyRecord'){assertSupportedSavedDate(item);return sanitizeImportedRecord(item,{legacy});}
  if(entityType==='areaNote')return legacy?CompatibilityCodec.areaNote(item,item&&item.key):sanitizeCurrentAreaNote(item,item&&item.key);
  if(entityType==='activeSession')return legacy?CompatibilityCodec.activeSession(item):ActiveSessionCodec.sanitizeCurrent(item);
  if(entityType===LEGACY_REFLECTION_DRAFT_TYPE){if(!legacy||!item||typeof item!=='object'||Array.isArray(item)||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u.test(String(item.date||'')))return null;return freeze({date:String(item.date)});}
  if(entityType==='checkpointManifest')return validateProtectedCheckpointManifest(item);
  return null;
}
async function parseChunkedBackupMetadata(file,options={},context={}){
  backupThrowIfAborted(options.signal);
  const gzip=typeof context.gzip==='boolean'?context.gzip:(await backupFileHasGzipMagic(file)||backupFilename(options,file).endsWith('.gz'));
  const state={},iterator=backupDecodedLines(file,{gzip,state,signal:options.signal,yieldControl:options.yieldControl})[Symbol.asyncIterator]();
  try{
  const first=await iterator.next();if(first.done)throw new Error('Backup file is empty.');
  const manifest=first.value;
  if(options.currentOnly===true&&Number(manifest&&manifest.version)!==DATA_CONTRACT.schemas.Backup.version)throw legacyBackupError(`Backup v${Number(manifest&&manifest.version)||'?'} requires the temporary compatibility adapter.`);
  const checked=validateBackupManifest(manifest,gzip,{binaryV10:!!context.binaryV10}),expected=checked.counts,sourceEntityTypes=checked.entityTypes,actual=backupCountShape({},sourceEntityTypes);
  const report=backupImportReport({legacy:Number(manifest.version)!==DATA_CONTRACT.schemas.Backup.version,sourceVersion:manifest.version});
  const records=[],areaNotes=KeyedRecord.create();let personalData=null,activeSession=null,protectedCheckpointManifest=null,expectedSeq=0,complete=null;const chunkHashes=[];
  const identities=Object.fromEntries(sourceEntityTypes.map(type=>[type,new Set()])),referencedAssetIds=new Set();
  let areaNotesComplete=true;
  while(true){
    backupThrowIfAborted(options.signal);
    const next=await iterator.next();if(next.done)break;
    const entry=next.value;
    if(entry&&entry.type==='complete'){
      if(complete)throw new Error('Backup contains more than one completion marker.');
      complete=entry;
      const trailing=await iterator.next();if(!trailing.done)throw new Error('Backup contains data after its completion marker.');
      break;
    }
    if(!entry||entry.type!=='chunk')throw new Error('Backup contains an unknown line type.');
    if(expectedSeq>=APP_LIMITS.maxBackupChunks)throw new Error('Backup contains too many chunks.');
    if(entry.seq!==expectedSeq++)throw new Error('Backup chunks are missing or out of order.');
    const entityType=String(entry.entityType||''),limit=sourceEntityTypes.includes(entityType)?backupEntityLimit(entityType):0;
    if(!limit||!Array.isArray(entry.items)||entry.count!==entry.items.length)throw new Error('Backup chunk metadata is invalid.');
    if(actual[entityType]+entry.items.length>limit)throw new Error(`Backup contains too many ${entityType} entries.`);
    const canonical={seq:entry.seq,entityType,items:entry.items};
    const checksum=await backupChecksumText(canonical,manifest.checksumAlgorithm);
    if(checksum!==entry.checksum)throw new Error(`Backup chunk ${entry.seq} failed its integrity check.`);
    chunkHashes.push(checksum);
    let itemIndex=0;
    for(const item of entry.items){
      backupThrowIfAborted(options.signal);
      itemIndex++;
      if(itemIndex%50===0)await backupImportYield(options);
      actual[entityType]++;
      if(entityType==='tombstone'){report.ignoredTombstones++;continue;}
      const legacyItem=legacyBackupItem(manifest.version,entityType);
      const clean=sanitizeChunkedBackupItem(entityType,item,{legacy:legacyItem});
      if(!clean){
        if(!legacyItem)throw new Error(`Current backup contains a noncanonical ${entityType} entry.`);
        report.skipped++;
        if(entityType==='areaNote')areaNotesComplete=false;
        if(entityType==='activeSession')report.invalidActiveSession++;
        continue;
      }
      if(!['personalData','checkpointManifest',LEGACY_REFLECTION_DRAFT_TYPE].includes(entityType))backupCollectRichAssetIds(clean,referencedAssetIds);
      const identity=entityType==='personalData'?'personal':entityType==='checkpointManifest'?'protected-checkpoint':entityType===LEGACY_REFLECTION_DRAFT_TYPE?String(clean.date):entityIdentity(entityType,clean);
      if(identities[entityType].has(identity)){
        if(!legacyItem)throw new Error(`Current backup contains a duplicate ${entityType} identity.`);
        report.duplicates++;report.skipped++;
        if(entityType==='areaNote')areaNotesComplete=false;
        continue;
      }
      identities[entityType].add(identity);
      if(entityType==='checkpointManifest')protectedCheckpointManifest=clean;
      if(!options.validateOnly){
        if(entityType==='personalData')personalData=clean;
        else if(entityType==='dailyRecord')records.push(clean);
        else if(entityType==='areaNote')areaNotes[clean.key]=clean;
        else if(entityType==='activeSession')activeSession=clean;
      }
      if(clean.degraded===true)report.degraded++;
    }
  }
  if(!complete)throw new Error('Backup is incomplete: completion marker is missing.');
  const completeCounts=backupCountShape(complete.counts,sourceEntityTypes);
  if(complete.version!==Number(manifest.version)||complete.chunkCount!==expectedSeq||!backupCountsEqual(actual,expected,sourceEntityTypes)||!backupCountsEqual(actual,completeCounts,sourceEntityTypes))throw new Error('Backup completion counts do not match its contents.');
  if(!Array.isArray(complete.chunkHashes)||complete.chunkHashes.length!==chunkHashes.length||complete.chunkHashes.some((hash,index)=>hash!==chunkHashes[index]))throw new Error('Backup completion proof does not match its chunks.');
  const assetDescriptors=Number(manifest.version)>=10?backupSanitizeAssetDescriptors(complete.assets):freeze([]);
  if(Number(manifest.version)>=10){
    const descriptorIds=new Set(assetDescriptors.map(item=>item.assetId));
    if([...referencedAssetIds].some(id=>!descriptorIds.has(id)))throw new Error('Backup image asset descriptors do not exactly match the rich-content image references.');
  }
  const captureAuthority=Number(manifest.version)>=18?String(complete.captureAuthority||''):'unknown';
  if(Number(manifest.version)>=18&&!['canonical-complete','rescue-partial'].includes(captureAuthority))throw new Error('Backup completion proof has invalid capture authority.');
  const proofBody={version:complete.version,chunkCount:complete.chunkCount,counts:completeCounts,chunkHashes:complete.chunkHashes};
  if(Number(manifest.version)>=10)proofBody.assets=assetDescriptors;
  if(Number(manifest.version)>=18)proofBody.captureAuthority=captureAuthority;
  const proofChecksum=await backupChecksumText(proofBody,manifest.checksumAlgorithm);
  if(proofChecksum!==complete.checksum)throw new Error('Backup completion proof failed its integrity check.');
  if(Number(manifest.version)>=15){
    protectedCheckpointManifest=withNoteIdDeletions(validateProtectedCheckpointManifest(protectedCheckpointManifest,manifest.checkpoint,{normalizedLegacy:true}),Number(manifest.version)<NOTE_ID_BACKUP_VERSION);
    const recordDates=identities.dailyRecord,noteKeys=identities.areaNote,assetIds=new Set(assetDescriptors.map(item=>item.assetId));
    if(protectedCheckpointManifest.savedDayDeletions.some(entry=>recordDates.has(entry.date)))throw new Error('Checkpoint contains contradictory Saved-Day record/deletion state.');
    if(protectedCheckpointManifest.areaNoteDeletions.some(entry=>noteKeys.has(entry.key)))throw new Error('Checkpoint contains contradictory Ongoing Note record/deletion state.');
    if(protectedCheckpointManifest.attachmentDeletions.some(entry=>assetIds.has(entry.assetId)))throw new Error('Checkpoint contains contradictory Attachment Library record/deletion state.');
  }
  return {importedPersonalData:personalData,data:{areaNotes},records,hasAreaNotes:true,areaNotesComplete,importedActiveSession:activeSession,protectedCheckpointManifest,captureAuthority,formatVersion:manifest.version,counts:actual,manifest,report,uncompressedBytes:state.uncompressedBytes,assetDescriptors,referencedAssetIds:freeze([...referencedAssetIds].sort())};
  }finally{await iterator.return?.();}
}
async function readChunkedBackupFile(file,options={}){
  return parseChunkedBackupMetadata(file,options,{binaryV10:false});
}
async function backupHasV10Magic(file){
  try{return new TextDecoder().decode(await file.slice(0,BACKUP_V10_MAGIC.length).arrayBuffer())===BACKUP_V10_MAGIC;}catch(error){return false;}
}
function backupV10Header(metadataBytes,gzip){
  if(!Number.isInteger(metadataBytes)||metadataBytes<=0||metadataBytes>APP_LIMITS.backupMaxCompressedBytes)throw new Error('Backup metadata exceeds the safe framed-metadata limit.');
  const header=new Uint8Array(BACKUP_V10_HEADER_BYTES),magic=backupUtf8Bytes(BACKUP_V10_MAGIC);
  header.set(magic,0);header[8]=gzip?BACKUP_V10_FLAG_GZIP:0;new DataView(header.buffer).setUint32(9,metadataBytes,false);return header;
}
function createV10Container(metadataBlob,{compression='none',assetBlobs=[]}={}){
  if(!(metadataBlob instanceof Blob)||metadataBlob.size<=0)throw new TypeError('Backup v10 metadata Blob is invalid.');
  const gzip=compression==='gzip';if(!gzip&&compression!=='none')throw new Error('Backup v10 metadata compression is unsupported.');
  const blobs=Array.isArray(assetBlobs)?assetBlobs:[];
  if(blobs.some(blob=>!(blob instanceof Blob)))throw new TypeError('Backup v10 asset frame is not a Blob.');
  const header=backupV10Header(metadataBlob.size,gzip),blob=new Blob([header,metadataBlob,...blobs],{type:'application/octet-stream'});
  if(blob.size>BACKUP_MAX_FILE_BYTES)throw new Error(`Backup exceeds the ${Math.round(BACKUP_MAX_FILE_BYTES/1048576)} MB safe whole-file limit.`);
  return blob;
}
const BACKUP_CHECK_BATCH_BYTES=16*1048576;
async function readV10BackupFile(file,options={}){
  backupThrowIfAborted(options.signal);
  if((file.size||0)>BACKUP_MAX_FILE_BYTES)throw new Error(`Backup file exceeds the ${Math.round(BACKUP_MAX_FILE_BYTES/1048576)} MB safe whole-file limit.`);
  if((file.size||0)<BACKUP_V10_HEADER_BYTES)throw new Error('Backup v10 header is truncated.');
  const header=new Uint8Array(await file.slice(0,BACKUP_V10_HEADER_BYTES).arrayBuffer());
  if(new TextDecoder().decode(header.slice(0,8))!==BACKUP_V10_MAGIC)throw new Error('Backup v10 magic header is invalid.');
  const flags=header[8];if(flags&~BACKUP_V10_FLAG_GZIP)throw new Error('Backup v10 header contains unsupported flags.');
  const metadataBytes=new DataView(header.buffer,header.byteOffset,header.byteLength).getUint32(9,false);
  if(metadataBytes<=0||metadataBytes>APP_LIMITS.backupMaxCompressedBytes)throw new Error('Backup v10 metadata length is invalid.');
  const metadataStart=BACKUP_V10_HEADER_BYTES,metadataEnd=metadataStart+metadataBytes;
  if(metadataEnd>file.size)throw new Error('Backup v10 metadata is truncated.');
  const gzip=!!(flags&BACKUP_V10_FLAG_GZIP),metadataBlob=file.slice(metadataStart,metadataEnd);
  const parsed=await parseChunkedBackupMetadata(metadataBlob,{...options,filename:'backup-v10-metadata'}, {gzip,binaryV10:true});
  // Each distinct attachment is stored once, back to back. Runs of small ones
  // are checked with one read each (BACKUP_CHECK_BATCH_BYTES), larger ones on
  // their own; any mismatch fails the whole file.
  let offset=metadataEnd,assetBytes=0;const importedAssets=[],contents=new Map(),frames=[];
  for(const descriptor of parsed.assetDescriptors){
    if(descriptor.missing===true)continue;
    const group=descriptor.checksum+':'+descriptor.size;if(contents.has(group))continue;
    const end=offset+descriptor.size;if(!Number.isSafeInteger(end)||end>file.size)throw new Error(`Backup attachment ${descriptor.assetId} is truncated.`);
    contents.set(group,file.slice(offset,end));frames.push({descriptor,start:offset,end});offset=end;assetBytes+=descriptor.size;
  }
  if(offset!==file.size)throw new Error('Backup contains unexpected trailing binary data.');
  const mismatch=frame=>new Error(`Backup attachment ${frame.descriptor.assetId} failed its integrity check.`);
  for(let index=0;index<frames.length;){
    backupThrowIfAborted(options.signal);
    const first=frames[index];
    if(first.end-first.start>BACKUP_CHECK_BATCH_BYTES/2){if(await backupChecksumBlob(file.slice(first.start,first.end),{signal:options.signal})!==first.descriptor.checksum)throw mismatch(first);index+=1;await backupImportYield(options);continue;}
    const batch=[];while(index<frames.length&&frames[index].end-frames[index].start<=BACKUP_CHECK_BATCH_BYTES/2&&frames[index].end-first.start<=BACKUP_CHECK_BATCH_BYTES)batch.push(frames[index++]);
    const digests=await Processing.run('checksum.ranges',{file,ranges:batch.map(frame=>({start:frame.start,end:frame.end}))},{signal:options.signal});
    batch.forEach((frame,position)=>{if(digests[position]!==frame.descriptor.checksum)throw mismatch(frame);});
    await backupImportYield(options);
  }
  if(!options.validateOnly)for(const descriptor of parsed.assetDescriptors){if(descriptor.missing===true)continue;const content=contents.get(descriptor.checksum+':'+descriptor.size);importedAssets.push(freeze({...descriptor,blob:content.slice(0,content.size,descriptor.mimeType)}));}
  return {...parsed,importedAssets:freeze(importedAssets),assetBytes,uncompressedBytes:Number(parsed.uncompressedBytes||0)+assetBytes};
}
async function readLegacyBackupFile(file,options={}){
  backupThrowIfAborted(options.signal);await backupImportYield(options);
  const importMb=Math.round(APP_LIMITS.importBytes/1048576);
  if((file.size||0)>APP_LIMITS.importBytes)throw new Error(`Legacy JSON backup is too large. Its safe limit remains ${importMb} MB; import a chunked .sdbackup file for larger histories.`);
  let data;try{data=await Processing.run('parseBlob',{file,maxBytes:APP_LIMITS.importBytes},{signal:options.signal});}catch(e){backupThrowIfAborted(options.signal);throw new Error('Backup JSON could not be parsed: '+e.message);}
  backupThrowIfAborted(options.signal);
  if(!data||typeof data!=='object')throw new Error('File is not a Study Director backup.');
  const sourceVersion=Array.isArray(data)?0:(Number(data.version)||0);
  if(sourceVersion>DATA_CONTRACT.schemas.Backup.version)throw new Error('This backup was created by a newer Study Director version. Update the app before importing it.');
  if(!Array.isArray(data)&&Number(data.schemaVersion||0)>LEGACY_BACKUP_SCHEMA_VERSION)throw new Error('This backup uses a newer data schema. Update the app before importing it.');
  if([7,8,9,10,11,12,13].includes(sourceVersion))throw new Error(`Backup v${sourceVersion} must use the complete Study Director backup format.`);
  const rawRecords=Array.isArray(data)?data:(Array.isArray(data.records)?data.records:[]);
  if(rawRecords.length>APP_LIMITS.maxImportRecords)throw new Error('Backup has too many daily records for safe import.');
  const hasAreaNotes=!!(data&&data.areaNotes&&typeof data.areaNotes==='object'&&!Array.isArray(data.areaNotes));
  if(hasAreaNotes&&Object.keys(data.areaNotes).length>APP_LIMITS.maxOngoingNotes)throw new Error('Backup has too many ongoing subject notes for safe import.');
  const importedActiveSession=CompatibilityCodec.activeSession(data.activeSession);
  const rawTombstoneCount=Array.isArray(data.tombstones)?data.tombstones.length:0;
  const report=backupImportReport({legacy:true,sourceVersion:sourceVersion||null,ignoredTombstones:Math.min(rawTombstoneCount,LEGACY_TOMBSTONE_LIMIT)});
  const records=[],recordIds=new Set();
  rawRecords.forEach(record=>{
    assertSupportedSavedDate(record);
    const clean=sanitizeImportedRecord(record,{legacy:true});
    if(!clean){report.skipped++;return;}
    if(recordIds.has(clean.date)){report.duplicates++;report.skipped++;return;}
    recordIds.add(clean.date);records.push(clean);if(clean.degraded===true)report.degraded++;
  });
  const areaNotes=KeyedRecord.create(),areaIds=new Set();let areaNotesComplete=true;
  if(hasAreaNotes)Object.entries(data.areaNotes).forEach(([rawKey,value])=>{
    const clean=CompatibilityCodec.areaNote(value,rawKey);
    if(!clean){report.skipped++;areaNotesComplete=false;return;}
    if(areaIds.has(clean.key)){report.duplicates++;report.skipped++;areaNotesComplete=false;return;}
    areaIds.add(clean.key);areaNotes[clean.key]=clean;if(clean.degraded===true)report.degraded++;
  });
  if(!importedActiveSession&&data.activeSession){report.invalidActiveSession++;report.skipped++;}
  if(rawTombstoneCount>LEGACY_TOMBSTONE_LIMIT)report.skipped+=rawTombstoneCount-LEGACY_TOMBSTONE_LIMIT;
  if(!Array.isArray(data)&&!Array.isArray(data.records)&&!hasAreaNotes&&!importedActiveSession&&!rawTombstoneCount)throw new Error('File does not contain daily records, ongoing subject notes, an active session, or deletion metadata.');
  return {data:{...data,areaNotes},records,hasAreaNotes,areaNotesComplete,importedActiveSession,formatVersion:sourceVersion||0,counts:backupCountShape({dailyRecord:rawRecords.length,areaNote:hasAreaNotes?Object.keys(data.areaNotes).length:0,activeSession:data.activeSession?1:0,tombstone:rawTombstoneCount}),report};
}
function legacyBackupError(message='Backup uses a retired Study Director format.'){
  const error=new Error(message);error.code='STUDY_DIRECTOR_LEGACY_BACKUP';return error;
}
async function readPortableBackupFile(file,options={}){
  if(!file||typeof file.stream!=='function')throw new Error('No readable backup file was provided.');
  backupThrowIfAborted(options.signal);
  if(await backupHasV10Magic(file))return readV10BackupFile(file,options);
  return await backupLooksChunked(file,options)?readChunkedBackupFile(file,options):readLegacyBackupFile(file,options);
}
async function inspectCurrentBackup(file,options={}){
  if(!file||typeof file.stream!=='function')throw new Error('No readable backup file was provided.');
  if(!await backupHasV10Magic(file))throw legacyBackupError();
  const parsed=await readV10BackupFile(file,{...options,currentOnly:true});
  if(Number(parsed&&parsed.formatVersion)!==DATA_CONTRACT.schemas.Backup.version)throw legacyBackupError(`Backup v${Number(parsed&&parsed.formatVersion)||'?'} requires the temporary compatibility adapter.`);
  return parsed;
}
async function inspectLegacyBackup(file,options={}){
  const parsed=await readPortableBackupFile(file,options);
  if(Number(parsed&&parsed.formatVersion)===DATA_CONTRACT.schemas.Backup.version)throw new Error('Current-format backup was unexpectedly routed through the legacy adapter.');
  return parsed;
}
return Object.freeze({
  utf8Bytes:backupUtf8Bytes,
  checksumAlgorithm:backupChecksumAlgorithm,
  checksumBlob:backupChecksumBlob,
  assetIds:value=>freeze([...backupCollectRichAssetIds(value,new Set())].sort()),
  createV10Container,
  countShape:backupCountShape,
  countsEqual:backupCountsEqual,
  splitItems:splitBackupItems,
  createCheckpointMetadata:backupCheckpointMetadata,
  createManifest:buildBackupManifest,
  createProtectedManifest:backupProtectedCheckpointManifest,
  encodeChunk:backupChunkEnvelope,
  encodeCompletion:encodeBackupCompletion,
  compressionSupported:portableBackupCompressionSupported,
  inspectCurrent:(...args)=>Processing.scope(()=>inspectCurrentBackup(...args)),
  inspectLegacy:(...args)=>Processing.scope(()=>inspectLegacyBackup(...args)),
  normalizeRecord:record=>{
    const current=sanitizeImportedRecord(record,{legacy:false});if(current)return current;
    const version=Number(record&&record.version);return Number.isSafeInteger(version)&&version<DATA_CONTRACT.schemas.DailyRecord.version?CompatibilityCodec.dailyRecord(record):null;
  },
  normalizeAreaNote:sanitizeCurrentAreaNote,
  // Backups made before notes had permanent ids keyed them by name.
  legacyAreaNote:(value,key)=>CompatibilityCodec.areaNote(value,key),
  legacyAreaNoteKey:key=>CompatibilityCodec.areaNoteKey(key),
  withNoteIdDeletions,
  normalizeImportedActiveSession:(value,{legacy=false}={})=>legacy?CompatibilityCodec.activeSession(value):ActiveSessionCodec.sanitizeCurrent(value),
  normalizePersonalData:value=>PersonalDataCodec.normalize(value),
  normalizeAssetDescriptors:backupSanitizeAssetDescriptors
});
  }
  return freeze({
    format:'study-director.backup-codec',
    contractVersion:1,
    createBackupCodec
  });
});
})();
