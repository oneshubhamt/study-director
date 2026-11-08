import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {BackupInput,BackupOptions,BackupFile,ProcessingOptions,AssetDescriptor,AssetFrame,ImportedAsset,SavedDayDeletion,NoteDeletion,AttachmentDeletion,CheckedCheckpoint,ProtectedManifest,BackupPlan,BackupItem,Counts} from '../../types/backup-models.ts';
import type {DailyRecord,NoteRecord,ActiveSession,PersonalData,PendingReview} from '../../types/record-models.ts';
type RawFields=Partial<Record<'personalData'|'assetId'|'assets'|'attachmentDeletions'|'authority'|'captureAuthority'|'checkpoint'|'checkpointId'|'checksum'|'checksumAlgorithm'|'chunkCount'|'chunkHashes'|'compression'|'container'|'count'|'counts'|'createdAt'|'date'|'declaredCounts'|'deletedAt'|'descriptor'|'encoding'|'entityType'|'exportedAt'|'format'|'items'|'key'|'length'|'library'|'lines'|'mimeType'|'missing'|'name'|'noteDeletions'|'originInstallationId'|'protectedManifest'|'savedDayDeletions'|'seq'|'size'|'sourceRevision'|'toString'|'type'|'uncompressedBytes'|'value'|'version',unknown>>;
const sdBackupCodecFactory=(()=>{
'use strict';
const registry=(globalThis as typeof globalThis & {[key:symbol]:ModuleRegistration<'backup-codec','study-director.backup-codec'>|undefined})[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,functionPort:functions}=registry.contracts;
const createModule=()=>{
  const freeze=Object.freeze;
  function createBackupCodec(input:BackupInput){
    exactObject(input,['appConfig','limits','dataContract','entityTypes','keyedRecord','entities','helpers','richText','dailyRecordCodec','activeSessionCodec','personalDataCodec','pendingReviewCodec','processing'],'Backup codec input');
    if(!Object.isFrozen(input.appConfig)||!Object.isFrozen(input.limits)||!Object.isFrozen(input.dataContract)||!Object.isFrozen(input.entityTypes)||!Object.isFrozen(input.keyedRecord)||!Object.isFrozen(input.richText)||!Object.isFrozen(input.dailyRecordCodec)||!Object.isFrozen(input.activeSessionCodec)||!Object.isFrozen(input.personalDataCodec)||!Object.isFrozen(input.pendingReviewCodec)){
      throw new TypeError('Backup codec contracts must be frozen.');
    }
    functions(input.entities,['entityDefinition','entityIdentity'],'Backup entity contract');
    functions(input.helpers,['boundedInt','jsonByteLength'],'Backup codec helpers');
    functions(input.richText,['assetIds','assetIdValid','imageMimeTypeValid'],'Backup rich-text contract');
    const Processing=input.processing;
    functions(Processing,['run','scope'],'Backup processing contract');
    const APP_CONFIG=input.appConfig;
    const APP_LIMITS=input.limits;
    const DATA_CONTRACT=input.dataContract;
    const PersonalDataCodec=input.personalDataCodec,PendingReviewCodec=input.pendingReviewCodec;
    const SOURCE_ENTITY_TYPES=freeze([...input.entityTypes]);
    const PENDING_REVIEW_TYPE='pendingReview',PENDING_REVIEW_LIMIT=2*Math.max(1,Number(APP_LIMITS.maxPendingReviews)||2000);
    const BACKUP_ENTITY_TYPES=freeze([...SOURCE_ENTITY_TYPES,'personalData','checkpointManifest',PENDING_REVIEW_TYPE]);
    const KeyedRecord=input.keyedRecord,ActiveSessionCodec=input.activeSessionCodec;
    const BACKUP_V10_MAGIC='SDBK10\r\n';
    const BACKUP_V10_HEADER_BYTES=13;
    const BACKUP_V10_FLAG_GZIP=1;
    const BACKUP_MAX_FILE_BYTES=Math.max(Number(APP_LIMITS.backupMaxFileBytes)||0,Number(APP_LIMITS.backupMaxCompressedBytes)||0);
    const BACKUP_MAX_ASSET_DESCRIPTORS=Math.max(1,Number(APP_LIMITS.backupMaxAssetDescriptors)||50000);
    function backupMaxAssetBytes(mimeType:string=''){
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
    const sanitizeCurrentNote=input.dailyRecordCodec.sanitizeCurrentNote;
    const isSupportedSavedDate=input.dailyRecordCodec.isSupportedSavedDate;
function assertSupportedSavedDate(input:unknown){
  const record=input as RawFields|null|undefined;
  const date=record&&record.date;
  if(!isSupportedSavedDate(date))throw new Error(`Backup contains unsupported saved-day date "${String(date||'missing')}". Supported dates are ${APP_LIMITS.minSupportedSavedDate} through today.`);
}
function backupUtf8Bytes(value:unknown){return new TextEncoder().encode(String(value??''));}
function backupChecksumAlgorithm(){
  if(typeof crypto!=='undefined'&&crypto.subtle&&typeof crypto.subtle.digest==='function')return 'sha256';
  throw new Error('This browser cannot create a cryptographically verified backup. Update the browser and retry.');
}
async function backupChecksumText(value:unknown,algorithm:string=backupChecksumAlgorithm()){return Processing.run('checksum',{value,algorithm});}
async function backupChecksumBlob(blob:Blob,options:ProcessingOptions={}){if(!(blob instanceof Blob))throw new TypeError('Backup asset is not a Blob.');return Processing.run('checksum',{value:blob},options);}
function backupCollectRichAssetIds(value:unknown,target:Set<string>=new Set<string>()){
  const inspect=(current:unknown):void=>{
    if(typeof current==='string'){
      for(const rawId of richTextAssetIds(current)){const id=String(rawId||'');if(richTextAssetIdValid(id))target.add(id);}
      return;
    }
    if(Array.isArray(current)){for(const item of current as unknown[])inspect(item);return;}
    if(current&&typeof current==='object')for(const child of Object.values(current))inspect(child);
  };
  inspect(value);return target;
}
function backupSanitizeAssetDescriptors(value:unknown):readonly AssetDescriptor[]{
  if(!Array.isArray(value)||value.length>BACKUP_MAX_ASSET_DESCRIPTORS)throw new Error('Backup asset descriptor list is invalid or too large.');
  const seen=new Set<string>(),out:AssetDescriptor[]=[];
  for(const raw of value as RawFields[]){
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
// Recoverability is derived from the verified asset descriptor inventory,
 // not from the canonical-record completeness proof. Missing bytes do not
 // invalidate the readable Saved Days and Notes in a rescue checkpoint.
function backupAttachmentCoverage(descriptors:readonly AssetDescriptor[]=[]){
  const rows=Array.isArray(descriptors)?descriptors as readonly AssetDescriptor[]:[],missingIds=freeze(rows.filter(row=>row?.missing===true).map(row=>String(row.assetId||'')));
  return freeze({total:rows.length,missing:missingIds.length,missingIds,fullyRecoverable:missingIds.length===0});
}
function backupMissingAttachmentWarning(descriptors:readonly AssetDescriptor[]=[]){
  const coverage=backupAttachmentCoverage(descriptors);
  if(!coverage.missing)return '';
  const examples=coverage.missingIds.slice(0,3).join(', '),rest=coverage.missing>3?` and ${coverage.missing-3} more`:'';
  return `Partial attachment recovery: ${coverage.missing} attachment${coverage.missing===1?'':'s'} missing (${examples}${rest}). Saved Days and Notes are preserved, but missing files cannot be restored from this backup.`;
}
function backupCountShape(value:unknown={},types:readonly string[]=BACKUP_ENTITY_TYPES):Counts{
  return Object.fromEntries(types.map(type=>[type,boundedInt((value as Record<string,unknown>)[type],{min:0,max:backupEntityLimit(type),fallback:0})]));
}
function backupCountsEqual(a:unknown,b:unknown,types:readonly string[]=BACKUP_ENTITY_TYPES){return types.every(type=>Number(a&&(a as Record<string,unknown>)[type]||0)===Number(b&&(b as Record<string,unknown>)[type]||0));}
function backupEntityLimit(entityType:string){return entityType===PENDING_REVIEW_TYPE?PENDING_REVIEW_LIMIT:['personalData','checkpointManifest'].includes(entityType)?1:entityDefinition(entityType)?.backupLimit||0;}
function splitBackupItems<T>(items:readonly T[]){
  const groups:T[][]=[];let current:T[]=[],bytes=2;
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
function backupCheckpointMetadata(originInstallationId:unknown,createdAt:unknown){
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
function validateCheckpointMetadata(input:unknown):CheckedCheckpoint{
  const value=input as RawFields|null|undefined;
  const contract=DATA_CONTRACT.schemas.CheckpointMetadata;
  if(!contract||!value||typeof value!=='object'||Array.isArray(value))throw new Error('Backup checkpoint metadata is missing.');
  const keys=Object.keys(value).sort().join('|');
  if(keys!==['checkpointId','createdAt','format','originInstallationId','version'].sort().join('|'))throw new Error('Backup checkpoint metadata contains unexpected fields.');
  if(value.format!==contract.format||Number(value.version)!==Number(contract.version)||!/^cp_[a-f0-9]{32}$/u.test(String(value.checkpointId||''))||!/^inst_[a-z0-9_]{8,128}$/iu.test(String(value.originInstallationId||''))||!Number.isFinite(Date.parse(String(value.createdAt||''))))throw new Error('Backup checkpoint metadata is invalid.');
  // Exact keys were checked above; values deliberately remain unknown.
  return value as CheckedCheckpoint;
}
const CHECKPOINT_AUTHORITY=freeze({
  savedDays:'pairwise-explicit-deletions',
  notes:'pairwise-explicit-deletions',
  activeSession:'pairwise-singleton',
  plans:'pairwise-collection',
  personalSettings:'pairwise-singleton',
  attachments:'referenced-plus-library'
});
function normalizeCheckpointSavedDayDeletions(values:unknown){
  if(!Array.isArray(values))throw new Error('Checkpoint Saved-Day deletion history is invalid.');
  const byDate=new Map<string,SavedDayDeletion>();
  for(const raw of values as (RawFields|null)[]){
    const date=String(raw&&raw.date||''),deletedAt=String(raw&&raw.deletedAt||'');
    if(!isSupportedSavedDate(date)||!Number.isFinite(Date.parse(deletedAt)))throw new Error('Checkpoint contains an invalid Saved-Day deletion entry.');
    const clean=freeze({date,deletedAt:new Date(deletedAt).toISOString()}),previous=byDate.get(date);
    if(!previous||Date.parse(clean.deletedAt)>Date.parse(previous.deletedAt))byDate.set(date,clean);
  }
  if(byDate.size>APP_LIMITS.maxImportRecords)throw new Error('Checkpoint contains too many Saved-Day deletion entries.');
  return freeze([...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date)));
}
function normalizeCheckpointNoteDeletions(values:unknown){
  if(!Array.isArray(values))throw new Error('Checkpoint note deletion history is invalid.');
  const byKey=new Map<string,NoteDeletion>();
  for(const raw of values as (RawFields|null)[]){
    const key=String(raw&&raw.key||'').trim(),deletedAt=String(raw&&raw.deletedAt||'');
    if(!key||key.length>Number(APP_LIMITS.maxAreaNameChars||240)||!Number.isFinite(Date.parse(deletedAt)))throw new Error('Checkpoint contains an invalid note deletion entry.');
    const clean=freeze({key,deletedAt:new Date(deletedAt).toISOString()}),previous=byKey.get(key);
    if(!previous||Date.parse(clean.deletedAt)>Date.parse(previous.deletedAt))byKey.set(key,clean);
  }
  if(byKey.size>APP_LIMITS.maxNotes)throw new Error('Checkpoint contains too many note deletion entries.');
  return freeze([...byKey.values()].sort((a,b)=>a.key.localeCompare(b.key)));
}
function normalizeCheckpointAttachmentDeletions(values:unknown){
  if(!Array.isArray(values))throw new Error('Checkpoint Attachment deletion history is invalid.');
  const byId=new Map<string,AttachmentDeletion>();
  for(const raw of values as (RawFields|null)[]){
    const assetId=String(raw&&raw.assetId||''),deletedAt=String(raw&&raw.deletedAt||'');
    if(!/^(?:att|img)-[a-z0-9-]{20,80}$/u.test(assetId)||!Number.isFinite(Date.parse(deletedAt)))throw new Error('Checkpoint contains an invalid Attachment deletion entry.');
    const clean=freeze({assetId,deletedAt:new Date(deletedAt).toISOString()}),previous=byId.get(assetId);
    if(!previous||Date.parse(clean.deletedAt)>Date.parse(previous.deletedAt))byId.set(assetId,clean);
  }
  if(byId.size>50000)throw new Error('Checkpoint contains too many Attachment deletion entries.');
  return freeze([...byId.values()].sort((a,b)=>a.assetId.localeCompare(b.assetId)));
}
function authorityMatches(input:unknown,expected:Readonly<Record<string,string>>){const value=input as Record<string,unknown>|null;return !!(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===Object.keys(expected).sort().join('|')&&Object.entries(expected).every(([key,required])=>value[key]===required));}
function validateCheckpointAuthority(value:unknown){if(!authorityMatches(value,CHECKPOINT_AUTHORITY))throw new Error('Checkpoint authority contract is invalid.');return CHECKPOINT_AUTHORITY;}
function backupProtectedCheckpointManifest(plan:BackupPlan,checkpointInput:unknown){
  const contract=DATA_CONTRACT.schemas.CheckpointProtectedManifest;
  if(!contract||contract.format!=='study-director.checkpoint-protected-manifest'||Number(contract.version)!==PROTECTED_MANIFEST_NOTE_NAMES_VERSION)throw new Error('Checkpoint protected-manifest contract is unavailable.');
  const checkpoint=validateCheckpointMetadata(checkpointInput);
  const sourceRevision=String(plan&&plan.sourceRevision||'');
  if(!Number.isFinite(Date.parse(sourceRevision)))throw new Error('Checkpoint source revision is invalid.');
  const savedDayDeletions=normalizeCheckpointSavedDayDeletions(plan&&plan.savedDayDeletions||[]),noteDeletions=normalizeCheckpointNoteDeletions(plan&&plan.noteDeletions||[]),attachmentDeletions=normalizeCheckpointAttachmentDeletions(plan&&plan.attachmentDeletions||[]);
  const recordDates=new Set((plan&&plan.recordDates||[]).map(String)),noteKeys=new Set((plan&&plan.noteItems||[]).map(item=>String(item&&item.key||''))),assetIds=new Set((plan&&plan.assetItems||[]).map(item=>String(item&&item.descriptor&&item.descriptor.assetId||'')));
  if(savedDayDeletions.some(entry=>recordDates.has(entry.date)))throw new Error('Checkpoint cannot contain both a Saved Day and its deletion marker.');
  if(noteDeletions.some(entry=>noteKeys.has(entry.key)))throw new Error('Checkpoint cannot contain both a note and its deletion marker.');
  if(attachmentDeletions.some(entry=>assetIds.has(entry.assetId)))throw new Error('Checkpoint cannot contain both an Attachment Library identity and its deletion marker.');
  return freeze({format:contract.format,version:contract.version,checkpointId:checkpoint.checkpointId,sourceRevision:new Date(sourceRevision).toISOString(),authority:CHECKPOINT_AUTHORITY,savedDayDeletions,noteDeletions,attachmentDeletions});
}
// Only the current protected-manifest contract is accepted.
const PROTECTED_MANIFEST_NOTE_NAMES_VERSION=3;

function validateProtectedCheckpointManifest(input:unknown,checkpoint:CheckedCheckpoint|null=null):ProtectedManifest{
  const value=input as RawFields|null|undefined;
  const contract=DATA_CONTRACT.schemas.CheckpointProtectedManifest;
  if(!value||typeof value!=='object'||Array.isArray(value)||value.format!==contract.format||Number(value.version)!==contract.version)throw new Error('Only the current protected checkpoint manifest is supported.');
  const keys=['noteDeletions','attachmentDeletions','authority','checkpointId','format','savedDayDeletions','sourceRevision','version'];
  if(Object.keys(value).sort().join('|')!==keys.sort().join('|'))throw new Error('Protected checkpoint manifest contains unexpected fields.');
  if(!/^cp_[a-f0-9]{32}$/u.test(String(value.checkpointId||''))||!Number.isFinite(Date.parse(String(value.sourceRevision||''))))throw new Error('Protected checkpoint manifest is invalid.');
  if(checkpoint&&value.checkpointId!==checkpoint.checkpointId)throw new Error('Protected checkpoint manifest does not match its public checkpoint provenance.');
  return freeze({format:contract.format,version:contract.version,checkpointId:value.checkpointId,sourceRevision:new Date(value.sourceRevision as string).toISOString(),authority:validateCheckpointAuthority(value.authority),savedDayDeletions:normalizeCheckpointSavedDayDeletions(value.savedDayDeletions),noteDeletions:normalizeCheckpointNoteDeletions(value.noteDeletions),attachmentDeletions:normalizeCheckpointAttachmentDeletions(value.attachmentDeletions)});
}
function buildBackupManifest(plan:BackupPlan,{compression='none',algorithm=backupChecksumAlgorithm()}:{compression?:string;algorithm?:string}={}){
 const checkpoint=plan&&plan.checkpoint?validateCheckpointMetadata(plan.checkpoint):backupCheckpointMetadata(plan.installationId,plan.exportedAt),contract=DATA_CONTRACT.schemas.CheckpointProtectedManifest;
 return {type:'manifest',format:DATA_CONTRACT.schemas.Backup.format,version:DATA_CONTRACT.schemas.Backup.version,app:APP_CONFIG.appName,dataContract:DATA_CONTRACT.app,checkpoint,protectedManifest:{format:contract.format,version:contract.version,entityType:'checkpointManifest'},createdBy:APP_CONFIG.attribution,exportedAt:plan.exportedAt,encoding:'ndjson',compression,checksumAlgorithm:algorithm,declaredCounts:plan.counts,container:'binary-v1',limits:{maxEntryBytes:APP_LIMITS.backupMaxEntryBytes,maxRecords:APP_LIMITS.maxImportRecords,maxNotes:APP_LIMITS.maxNotes}};
}
async function backupChunkEnvelope(seq:number,entityType:string,items:unknown[],algorithm:string){return Processing.run('chunk',{seq,entityType,items,algorithm,maxLineBytes:APP_LIMITS.backupMaxLineBytes});}
async function encodeBackupCompletion(chunkCount:number,counts:Counts,chunkHashes:string[],algorithm:string,assetDescriptors:unknown=[],captureAuthority='canonical-complete'){
  const version=DATA_CONTRACT.schemas.Backup.version;
  const proofBody:{version:number;chunkCount:number;counts:Counts;chunkHashes:string[];assets?:readonly AssetDescriptor[];captureAuthority?:string}={version,chunkCount,counts,chunkHashes};
  proofBody.assets=backupSanitizeAssetDescriptors(assetDescriptors);
  {const authority=String(captureAuthority||'');if(!['canonical-complete','rescue-partial'].includes(authority))throw new Error('Backup capture authority is invalid.');proofBody.captureAuthority=authority;}
  const checksum=await backupChecksumText(proofBody,algorithm);
  return {type:'complete',...proofBody,checksum,completedAt:new Date().toISOString()};
}
function portableBackupCompressionSupported(){return typeof CompressionStream==='function'&&typeof DecompressionStream==='function';}
function sanitizeImportedRecord(record:unknown){return sanitizeCurrentDailyRecord(record);}
function backupImportReport(base:{sourceVersion?:unknown}={}){
  return Object.assign({sourceVersion:null,warnings:[]},base||{});
}
async function backupFileHasGzipMagic(file:Blob){
  try{const bytes=new Uint8Array(await file.slice(0,2).arrayBuffer());return bytes.length===2&&bytes[0]===0x1f&&bytes[1]===0x8b;}catch(e){return false;}
}
function backupImportAbortError(signal?:AbortSignal|null){
  const reason:unknown=signal&&signal.reason;
  const error=reason instanceof Error?reason:new Error(String(reason||'Backup import was cancelled.'));
  if(!error.name||error.name==='Error')error.name='AbortError';
  if(!(error as Error&{code?:unknown}).code)Object.assign(error,{code:'STUDY_DIRECTOR_IMPORT_CANCELLED'});
  return error;
}
function backupThrowIfAborted(signal?:AbortSignal|null){if(signal&&signal.aborted)throw backupImportAbortError(signal);}
async function backupImportYield(options?:BackupOptions){
  backupThrowIfAborted(options&&options.signal);
  if(options&&typeof options.yieldControl==='function')await options.yieldControl();
  else await new Promise(resolve=>setTimeout(resolve,0));
  backupThrowIfAborted(options&&options.signal);
}
function backupFilename(options:BackupOptions,file:BackupFile){return String(options&&options.filename||file&&file.name||'').toLowerCase();}
async function* backupDecodedLines(file:Blob,{gzip=false,state={},signal=null}:{gzip?:boolean;state?:{uncompressedBytes?:number;lines?:number};signal?:AbortSignal|null|undefined}={}){
  if(file.size>APP_LIMITS.backupMaxCompressedBytes)throw new Error('Backup file exceeds the safe file-size limit.');
  const id=await Processing.run('decode.open',{file,gzip,maxBytes:APP_LIMITS.backupMaxUncompressedBytes,maxLineBytes:APP_LIMITS.backupMaxLineBytes},{signal});
  try{for(;;){backupThrowIfAborted(signal);const next=await Processing.run('decode.next',{id},{signal});if(next.done)break;Object.assign(state,{uncompressedBytes:next.value.uncompressedBytes,lines:next.value.lines});yield next.value.value;}}
  finally{await Processing.run('decode.close',{id}).catch(()=>{});}
}
function validateBackupManifest(input:unknown,gzip:boolean,{binaryFramed=false}={}){
  const manifest=input as RawFields|null|undefined;
  if(!manifest||manifest.type!=='manifest'||manifest.format!==DATA_CONTRACT.schemas.Backup.format)throw new Error('File is not a chunked Study Director backup.');
  const version=Number(manifest.version)||0;
  if(version>DATA_CONTRACT.schemas.Backup.version)throw new Error('This backup was created by a newer Study Director version. Update the app before importing it.');
  if(version!==DATA_CONTRACT.schemas.Backup.version)throw new Error('Only the current canonical backup format is supported.');
  if(!binaryFramed)throw new Error('Binary backup must use the binary-framed Study Director backup format.');
  if(manifest.container!=='binary-v1')throw new Error('Binary backup container metadata is invalid.');
  if(manifest.encoding!=='ndjson')throw new Error('Unsupported backup encoding.');
  if((gzip?'gzip':'none')!==String(manifest.compression||'none'))throw new Error('Backup compression metadata does not match the file.');
  if(manifest.checksumAlgorithm!=='sha256')throw new Error('Binary backup requires SHA-256 integrity checks.');
  {
    const checkpoint=validateCheckpointMetadata(manifest.checkpoint);
    if(Object.prototype.hasOwnProperty.call(manifest,'deviceId'))throw new Error('Backups must not contain device identity metadata.');
    if(new Date(String(checkpoint.createdAt)).toISOString()!==new Date(String(manifest.exportedAt)).toISOString())throw new Error('Backup checkpoint timestamp does not match the backup timestamp.');
  }
  {
    const protectedContract=DATA_CONTRACT.schemas.CheckpointProtectedManifest,descriptor=manifest.protectedManifest as RawFields|null|undefined,expectedProtectedVersion=Number(protectedContract.version);
    if(!descriptor||typeof descriptor!=='object'||Array.isArray(descriptor)||Object.keys(descriptor).sort().join('|')!==['entityType','format','version'].sort().join('|')||descriptor.entityType!=='checkpointManifest'||descriptor.format!==protectedContract.format||Number(descriptor.version)!==expectedProtectedVersion)throw new Error('Backup protected-manifest descriptor is invalid.');
  }
  if((manifest.declaredCounts as RawFields|null|undefined)?.personalData!==1)throw new Error('Backup is missing its personal-data section.');
  const entityTypes=BACKUP_ENTITY_TYPES;
  const counts=backupCountShape(manifest.declaredCounts,entityTypes);
  if(counts['checkpointManifest']!==1)throw new Error('Current checkpoint backup must contain exactly one protected checkpoint manifest.');
  if(!backupCountsEqual(counts,manifest.declaredCounts||{},entityTypes))throw new Error('Backup manifest contains unsafe entity counts.');
  return {manifest,counts,entityTypes};
}


function sanitizeChunkedBackupItem(entityType:string,item:unknown):BackupItem|null{
 if(jsonByteLength(item)>APP_LIMITS.backupMaxEntryBytes)throw new Error('Backup entry exceeds the safe size limit.');
 if(entityType==='personalData')return {kind:entityType,value:PersonalDataCodec.normalize(item)};
 if(entityType==='dailyRecord'){assertSupportedSavedDate(item);const value=sanitizeCurrentDailyRecord(item);return value?{kind:entityType,value}:null;}
 if(entityType==='note'){const value=sanitizeCurrentNote(item,(item as RawFields|null)?.key);return value?{kind:entityType,value}:null;}
 if(entityType==='activeSession'){const value=ActiveSessionCodec.sanitizeCurrent(item);return value?{kind:entityType,value}:null;}
 if(entityType==='checkpointManifest')return {kind:entityType,value:validateProtectedCheckpointManifest(item)};
 if(entityType===PENDING_REVIEW_TYPE){const value=PendingReviewCodec.normalize(item);return value?{kind:entityType,value}:null;}
 return null;
}
async function parseChunkedBackupMetadata(file:BackupFile,options:BackupOptions={},context:{gzip?:boolean;binaryFramed?:boolean}={}){
  backupThrowIfAborted(options.signal);
  const gzip=typeof context.gzip==='boolean'?context.gzip:(await backupFileHasGzipMagic(file)||backupFilename(options,file).endsWith('.gz'));
  const state:{uncompressedBytes?:number;lines?:number}={},iterator=backupDecodedLines(file,{gzip,state,signal:options.signal})[Symbol.asyncIterator]();
  try{
  const first=await iterator.next();if(first.done)throw new Error('Backup file is empty.');
  const manifest=first.value as RawFields|null|undefined;
  if(options.currentOnly===true&&Number(manifest&&manifest.version)!==DATA_CONTRACT.schemas.Backup.version)throw unsupportedBackupError(`Backup v${Number(manifest&&manifest.version)||'?'} is unsupported; only the current canonical format can be imported.`);
  const checked=validateBackupManifest(manifest,gzip,{binaryFramed:!!context.binaryFramed}),expected=checked.counts,sourceEntityTypes=checked.entityTypes,actual=backupCountShape({},sourceEntityTypes);
  const checkedManifest=checked.manifest;
  const report=backupImportReport({sourceVersion:checkedManifest.version});
  const records:DailyRecord[]=[],notes=KeyedRecord.create<NoteRecord>(),pendingReviews:PendingReview[]=[];let personalData:PersonalData|null=null,activeSession:ActiveSession|null=null,protectedCheckpointManifest:ProtectedManifest|null=null,expectedSeq=0,complete:RawFields|null=null;const chunkHashes:string[]=[];
  const identities=Object.fromEntries(sourceEntityTypes.map(type=>[type,new Set<string>()])),referencedAssetIds=new Set<string>();
  let notesComplete=true;
  while(true){
    backupThrowIfAborted(options.signal);
    const next=await iterator.next();if(next.done)break;
    const entry=next.value as RawFields|null|undefined;
    if(entry&&entry.type==='complete'){
      if(complete)throw new Error('Backup contains more than one completion marker.');
      complete=entry;
      const trailing=await iterator.next();if(!trailing.done)throw new Error('Backup contains data after its completion marker.');
      break;
    }
    if(!entry||entry.type!=='chunk')throw new Error('Backup contains an unknown line type.');
    if(expectedSeq>=APP_LIMITS.maxBackupChunks)throw new Error('Backup contains too many chunks.');
    if(entry.seq!==expectedSeq++)throw new Error('Backup chunks are missing or out of order.');
    const entityType=String(entry.entityType||''),kind=entityType,limit=sourceEntityTypes.includes(entityType)?backupEntityLimit(entityType):0;
    if(!limit||!Array.isArray(entry.items)||entry.count!==entry.items.length)throw new Error('Backup chunk metadata is invalid.');
    if(actual[entityType]!+entry.items.length>limit)throw new Error(`Backup contains too many ${entityType} entries.`);
    const canonical={seq:entry.seq,entityType,items:entry.items};
    const checksum=await backupChecksumText(canonical,checkedManifest.checksumAlgorithm as string);
    if(checksum!==entry.checksum)throw new Error(`Backup chunk ${entry.seq} failed its integrity check.`);
    chunkHashes.push(checksum);
    let itemIndex=0;
    for(const item of entry.items as unknown[]){
      backupThrowIfAborted(options.signal);
      itemIndex++;
      if(itemIndex%50===0)await backupImportYield(options);
      actual[entityType]!++;
      const clean=sanitizeChunkedBackupItem(kind,item);
      if(!clean)throw new Error(`Current backup contains a noncanonical ${kind} entry.`);
      if(!['personalData','checkpointManifest'].includes(kind))backupCollectRichAssetIds(clean.value,referencedAssetIds);
      const identity=kind==='personalData'?'personal':kind==='checkpointManifest'?'protected-checkpoint':clean.kind===PENDING_REVIEW_TYPE?clean.value.id:entityIdentity(kind,clean.value);
      if(identities[kind]!.has(identity))throw new Error(`Current backup contains a duplicate ${kind} identity.`);
      identities[kind]!.add(identity);
      if(clean.kind==='checkpointManifest')protectedCheckpointManifest=clean.value;
      if(!options.validateOnly){
        if(clean.kind==='personalData')personalData=clean.value;
        else if(clean.kind==='dailyRecord')records.push(clean.value);
        else if(clean.kind==='note')notes[clean.value.key]=clean.value;
        else if(clean.kind==='activeSession')activeSession=clean.value;
        else if(clean.kind===PENDING_REVIEW_TYPE)pendingReviews.push(freeze(clean.value));
      }
    }
  }
  if(!complete)throw new Error('Backup is incomplete: completion marker is missing.');
  const completeCounts=backupCountShape(complete.counts,sourceEntityTypes);
  if(complete.version!==Number(checkedManifest.version)||complete.chunkCount!==expectedSeq||!backupCountsEqual(actual,expected,sourceEntityTypes)||!backupCountsEqual(actual,completeCounts,sourceEntityTypes))throw new Error('Backup completion counts do not match its contents.');
  if(!Array.isArray(complete.chunkHashes)||complete.chunkHashes.length!==chunkHashes.length||(complete.chunkHashes as unknown[]).some((hash,index)=>hash!==chunkHashes[index]))throw new Error('Backup completion proof does not match its chunks.');
  const assetDescriptors=backupSanitizeAssetDescriptors(complete.assets);
  {
    const descriptorIds=new Set(assetDescriptors.map(item=>item.assetId));
    if([...referencedAssetIds].some(id=>!descriptorIds.has(id)))throw new Error('Backup image asset descriptors do not exactly match the rich-content image references.');
  }
  const captureAuthority=String(complete.captureAuthority||'');
  if(!['canonical-complete','rescue-partial'].includes(captureAuthority))throw new Error('Backup completion proof has invalid capture authority.');
  const proofBody:{version:unknown;chunkCount:unknown;counts:Counts;chunkHashes:unknown;assets?:readonly AssetDescriptor[];captureAuthority?:string}={version:complete.version,chunkCount:complete.chunkCount,counts:completeCounts,chunkHashes:complete.chunkHashes};
  proofBody.assets=assetDescriptors;
  proofBody.captureAuthority=captureAuthority;
  const proofChecksum=await backupChecksumText(proofBody,checkedManifest.checksumAlgorithm as string);
  if(proofChecksum!==complete.checksum)throw new Error('Backup completion proof failed its integrity check.');
  {
    protectedCheckpointManifest=validateProtectedCheckpointManifest(protectedCheckpointManifest,validateCheckpointMetadata(checkedManifest.checkpoint));
    const recordDates=identities['dailyRecord']!,noteKeys=identities['note']!,assetIds=new Set(assetDescriptors.map(item=>item.assetId));
    if(protectedCheckpointManifest.savedDayDeletions.some(entry=>recordDates.has(entry.date)))throw new Error('Checkpoint contains contradictory Saved-Day record/deletion state.');
    if(protectedCheckpointManifest.noteDeletions.some(entry=>noteKeys.has(entry.key)))throw new Error('Checkpoint contains contradictory note record/deletion state.');
    if(protectedCheckpointManifest.attachmentDeletions.some(entry=>assetIds.has(entry.assetId)))throw new Error('Checkpoint contains contradictory Attachment Library record/deletion state.');
  }
  pendingReviews.sort((a,b)=>a.id.localeCompare(b.id));
  return {importedPersonalData:personalData,data:{notes},records,pendingReviews:freeze(pendingReviews),hasNotes:true,notesComplete,importedActiveSession:activeSession,protectedCheckpointManifest,captureAuthority,formatVersion:checkedManifest.version,counts:freeze({...actual}),manifest:checkedManifest,report,uncompressedBytes:state.uncompressedBytes,assetDescriptors,referencedAssetIds:freeze([...referencedAssetIds].sort())};
  }finally{await iterator.return?.(undefined);}
}
async function backupHasV10Magic(file:Blob){
  try{return new TextDecoder().decode(await file.slice(0,BACKUP_V10_MAGIC.length).arrayBuffer())===BACKUP_V10_MAGIC;}catch(error){return false;}
}
function backupV10Header(metadataBytes:number,gzip:boolean){
  if(!Number.isInteger(metadataBytes)||metadataBytes<=0||metadataBytes>APP_LIMITS.backupMaxCompressedBytes)throw new Error('Backup metadata exceeds the safe framed-metadata limit.');
  const header=new Uint8Array(BACKUP_V10_HEADER_BYTES),magic=backupUtf8Bytes(BACKUP_V10_MAGIC);
  header.set(magic,0);header[8]=gzip?BACKUP_V10_FLAG_GZIP:0;new DataView(header.buffer).setUint32(9,metadataBytes,false);return header;
}
function createV10Container(metadataBlob:Blob,{compression='none',assetBlobs=[]}:{compression?:string;assetBlobs?:readonly Blob[]}={}){
  if(!(metadataBlob instanceof Blob)||metadataBlob.size<=0)throw new TypeError('Binary backup metadata Blob is invalid.');
  const gzip=compression==='gzip';if(!gzip&&compression!=='none')throw new Error('Binary backup metadata compression is unsupported.');
  const blobs:readonly Blob[]=Array.isArray(assetBlobs)?assetBlobs:[];
  if(blobs.some(blob=>!(blob instanceof Blob)))throw new TypeError('Binary backup asset frame is not a Blob.');
  const header=backupV10Header(metadataBlob.size,gzip),blob=new Blob([header,metadataBlob,...blobs],{type:'application/octet-stream'});
  if(blob.size>BACKUP_MAX_FILE_BYTES)throw new Error(`Backup exceeds the ${Math.round(BACKUP_MAX_FILE_BYTES/1048576)} MB safe whole-file limit.`);
  return blob;
}
const BACKUP_CHECK_BATCH_BYTES=16*1048576;
async function readV10BackupFile(file:BackupFile,options:BackupOptions={}){
  backupThrowIfAborted(options.signal);
  if((file.size||0)>BACKUP_MAX_FILE_BYTES)throw new Error(`Backup file exceeds the ${Math.round(BACKUP_MAX_FILE_BYTES/1048576)} MB safe whole-file limit.`);
  if((file.size||0)<BACKUP_V10_HEADER_BYTES)throw new Error('Binary backup header is truncated.');
  const header=new Uint8Array(await file.slice(0,BACKUP_V10_HEADER_BYTES).arrayBuffer());
  if(new TextDecoder().decode(header.slice(0,8))!==BACKUP_V10_MAGIC)throw new Error('Binary backup magic header is invalid.');
  const flags=header[8]!;if(flags&~BACKUP_V10_FLAG_GZIP)throw new Error('Binary backup header contains unsupported flags.');
  const metadataBytes=new DataView(header.buffer,header.byteOffset,header.byteLength).getUint32(9,false);
  if(metadataBytes<=0||metadataBytes>APP_LIMITS.backupMaxCompressedBytes)throw new Error('Binary backup metadata length is invalid.');
  const metadataStart=BACKUP_V10_HEADER_BYTES,metadataEnd=metadataStart+metadataBytes;
  if(metadataEnd>file.size)throw new Error('Binary backup metadata is truncated.');
  const gzip=!!(flags&BACKUP_V10_FLAG_GZIP),metadataBlob=file.slice(metadataStart,metadataEnd);
  const parsed=await parseChunkedBackupMetadata(metadataBlob,{...options,filename:'backup-binary-metadata'}, {gzip,binaryFramed:true});
  // Each distinct attachment is stored once, back to back. Runs of small ones
  // are checked with one read each (BACKUP_CHECK_BATCH_BYTES), larger ones on
  // their own; any mismatch fails the whole file.
  let offset=metadataEnd,assetBytes=0;const importedAssets:ImportedAsset[]=[],contents=new Map<string,Blob>(),frames:AssetFrame[]=[];
  for(const descriptor of parsed.assetDescriptors){
    if(descriptor.missing===true)continue;
    const group=descriptor.checksum+':'+descriptor.size;if(contents.has(group))continue;
    const end=offset+descriptor.size;if(!Number.isSafeInteger(end)||end>file.size)throw new Error(`Backup attachment ${descriptor.assetId} is truncated.`);
    contents.set(group,file.slice(offset,end));frames.push({descriptor,start:offset,end});offset=end;assetBytes+=descriptor.size;
  }
  if(offset!==file.size)throw new Error('Backup contains unexpected trailing binary data.');
  const mismatch=(frame:AssetFrame)=>new Error(`Backup attachment ${frame.descriptor.assetId} failed its integrity check.`);
  for(let index=0;index<frames.length;){
    backupThrowIfAborted(options.signal);
    const first=frames[index]!;
    if(first.end-first.start>BACKUP_CHECK_BATCH_BYTES/2){if(await backupChecksumBlob(file.slice(first.start,first.end),{signal:options.signal})!==first.descriptor.checksum)throw mismatch(first);index+=1;await backupImportYield(options);continue;}
    const batch=[];while(index<frames.length&&frames[index]!.end-frames[index]!.start<=BACKUP_CHECK_BATCH_BYTES/2&&frames[index]!.end-first.start<=BACKUP_CHECK_BATCH_BYTES)batch.push(frames[index++]!);
    const digests=await Processing.run('checksum.ranges',{file,ranges:batch.map(frame=>({start:frame.start,end:frame.end}))},{signal:options.signal});
    batch.forEach((frame,position)=>{if(digests[position]!==frame.descriptor.checksum)throw mismatch(frame);});
    await backupImportYield(options);
  }
  if(!options.validateOnly)for(const descriptor of parsed.assetDescriptors){if(descriptor.missing===true)continue;const content=contents.get(descriptor.checksum+':'+descriptor.size)!;importedAssets.push(freeze({...descriptor,blob:content.slice(0,content.size,descriptor.mimeType)}));}
  return {...parsed,importedAssets:freeze(importedAssets),assetBytes,uncompressedBytes:Number(parsed.uncompressedBytes||0)+assetBytes};
}
function unsupportedBackupError(message:string='Backup uses a retired Study Director format.'){
  return Object.assign(new Error(message),{code:'STUDY_DIRECTOR_UNSUPPORTED_BACKUP'});
}
async function inspectCurrentBackup(file:BackupFile,options:BackupOptions={}){
  if(!file||typeof file.stream!=='function')throw new Error('No readable backup file was provided.');
  if(!await backupHasV10Magic(file))throw unsupportedBackupError();
  const parsed=await readV10BackupFile(file,{...options,currentOnly:true});
  if(Number(parsed&&parsed.formatVersion)!==DATA_CONTRACT.schemas.Backup.version)throw unsupportedBackupError(`Backup v${Number(parsed&&parsed.formatVersion)||'?'} is unsupported; only the current canonical format can be imported.`);
  return parsed;
}

return Object.freeze({
  utf8Bytes:backupUtf8Bytes,
  checksumAlgorithm:backupChecksumAlgorithm,
  checksumBlob:backupChecksumBlob,
  assetIds:(value:unknown)=>freeze([...backupCollectRichAssetIds(value,new Set<string>())].sort()),
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
  inspectCurrent:(...args:Parameters<typeof inspectCurrentBackup>)=>Processing.scope(()=>inspectCurrentBackup(...args)),
  normalizeRecord:sanitizeImportedRecord,
  normalizeNote:sanitizeCurrentNote,
  attachmentCoverage:backupAttachmentCoverage,
  missingAttachmentWarning:backupMissingAttachmentWarning,
  normalizeImportedActiveSession:(value:unknown)=>ActiveSessionCodec.sanitizeCurrent(value),
  normalizePersonalData:(value:unknown)=>PersonalDataCodec.normalize(value),
  normalizePendingReview:(value:unknown)=>{const clean=PendingReviewCodec.normalize(value);return clean?freeze(clean):null;},
  normalizeAssetDescriptors:backupSanitizeAssetDescriptors
});
  }
  return freeze({
    format:'study-director.backup-codec',
    contractVersion:1,
    createBackupCodec
  });
};
registry.define('backup-codec',1,createModule);
return createModule;
})();
export type BackupCodecModule=ReturnType<typeof sdBackupCodecFactory>;
