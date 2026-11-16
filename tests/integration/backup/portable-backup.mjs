import {RUNTIME_DATA_CONTRACT} from '../../../contracts/canonical-identities.mjs';
import {createProcessingEngine} from '../../../portable/processing.js';
import {passwordKey,streamEncryptionInfo,transformEncrypted} from '../../../portable/stream-encryption.js';
const testProcessing=Object.freeze({...createProcessingEngine(),scope:operation=>operation()});
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {testPendingReviewCodec} from '../../helpers/pending-review-codec.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'../../..');
const read=relative=>fs.readFileSync(path.join(ROOT,relative),'utf8');
for(const file of ['source/core/internal.js','source/core/persistence.js','source/core/record-codecs.js','source/core/backup-codec.js'])vm.runInThisContext(read(file),{filename:file});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const RecordCodecs=registry.require('record-codecs',1);
const BackupCodecs=registry.require('backup-codec',1);
const Persistence=registry.require('persistence',1),freeze=Object.freeze;
const limits=freeze({
  backupChunkItems:10,backupChunkTargetBytes:65536,backupMaxEntryBytes:65536,backupMaxLineBytes:262144,
  backupMaxCompressedBytes:4*1024*1024,backupMaxFileBytes:16*1024*1024,backupMaxUncompressedBytes:8*1024*1024,
  backupMaxAssetDescriptors:100,richAssetMaxBytes:8*1024*1024,maxBackupChunks:1000,importBytes:4*1024*1024,
  maxImportRecords:100,maxNotes:100,maxLegacyImportTombstones:100,maxImportReflectionDrafts:100,maxReflectionChars:10000
});
const dataContract=RUNTIME_DATA_CONTRACT;
const defs=freeze({
  dailyRecord:freeze({idField:'date',backupLimit:100}),note:freeze({idField:'key',backupLimit:100}),
  activeSession:freeze({idField:'id',backupLimit:1})
});
const isDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''));
const normalizeArea=(item,key)=>item&&String(key||item.key||'')?freeze({key:String(key||item.key),text:String(item.text||''),updatedAt:String(item.updatedAt||'2026-08-31T00:00:00.000Z')}):null;
const normalizeDrafts=value=>(Array.isArray(value)?value:[]).filter(x=>x&&isDate(x.date)).map(x=>freeze({...x,reflection:String(x.reflection||'')}));
const dailyRecordCodec=freeze({sanitizeHistoricalDailyRecord:item=>item&&isDate(item.date)?freeze({...item}):null,canonicalizeHistoricalDailyRecord:item=>item&&isDate(item.date)?freeze({...item,version:15}):null,sanitizeCurrentDailyRecord:item=>item&&isDate(item.date)?freeze({...item}):null,sanitizeImportedNote:normalizeArea,sanitizeCurrentNote:normalizeArea,isSupportedSavedDate:isDate});
const activeSessionCodec=freeze({sanitizeCurrent:item=>item&&item.id==='current'?freeze({...item}):null});
const reflectionDraftCodec=freeze({format:'study-director.reflection-draft-codec',contractVersion:1,sanitizeCurrent:item=>item&&isDate(item.date)?freeze({...item,reflection:String(item.reflection||'')}):null});
const compatibilityCodec=freeze({format:'study-director.compatibility-codecs',contractVersion:1,dailyRecord:item=>dailyRecordCodec.sanitizeCurrentDailyRecord(item),note:normalizeArea,activeSession:item=>activeSessionCodec.sanitizeCurrent(item),reflectionDraft:item=>reflectionDraftCodec.sanitizeCurrent(item),personalData:item=>{if(!item||typeof item!=='object'||![1,2].includes(Number(item.version)))throw new Error('Unsupported legacy personal-data version.');const p=item.preferences||{};return {version:2,plans:item.plans,preferences:{studentName:p.studentName??null,theme:p.theme??null,presentation:p.presentation??null,quote:p.quote??null,practiceCueMode:p.practiceCueMode??null,fontScale:p.fontScale??null,practiceTargetMs:p.practiceTargetMs??null,nudge:p.nudge??null}};}});
const keyedRecord=freeze({create:()=>Object.create(null)});
const entityDefinition=type=>defs[type]||null,entityIdentity=(type,item)=>String(item?.[defs[type]?.idField]||'');
const boundedInt=(value,{min=0,max=Number.MAX_SAFE_INTEGER,fallback=0}={})=>{const n=Number(value);return Number.isInteger(n)&&n>=min&&n<=max?n:fallback;};
const jsonByteLength=value=>new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value)).byteLength;
const personalDataCodec=RecordCodecs.createPersonalDataCodec(limits);
const pendingReviewCodec=testPendingReviewCodec(RecordCodecs,{personalDataCodec});
const codec=BackupCodecs.createBackupCodec(freeze({personalDataCodec,pendingReviewCodec,processing:testProcessing,
  appConfig:freeze({appName:'Study Director',attribution:'Study Director'}),limits,dataContract,legacy:freeze({schemaVersion:3,tombstoneLimit:limits.maxLegacyImportTombstones}),
  entityTypes:freeze(Object.keys(defs)),keyedRecord,entities:freeze({entityDefinition,entityIdentity}),
  helpers:freeze({boundedInt,jsonByteLength}),
  richText:freeze({assetIds:value=>String(value||'').includes(assetId)?freeze([assetId]):freeze([]),assetIdValid:value=>/^img-[A-Za-z0-9_-]{16,128}$/.test(String(value||'')),imageMimeTypeValid:value=>['image/png','image/jpeg','image/webp','image/gif','image/avif'].includes(String(value||''))}),dailyRecordCodec,activeSessionCodec,
  compatibilityCodec
}));

const assetId='img-1234567890abcdefghijklmn';
const rich=`WG1:${JSON.stringify({version:1,doc:{type:'Doc',content:[{type:'SDImage',param:{assetId,alt:'chart',widthPct:100}}]}})}`;
const area=[freeze({key:'Ethics',text:rich,updatedAt:'2026-08-31T00:00:00.000Z'})];
const personalData=freeze({
  version:2,
  plans:freeze({draft:null,savedPlans:freeze([]),defaultId:null}),
  preferences:freeze({studentName:'Student',theme:null,presentation:null,quote:null,practiceCueMode:null,fontScale:null,practiceTargetMs:null,nudge:null})
});
const counts=codec.countShape({dailyRecord:0,note:1,activeSession:0,personalData:1,checkpointManifest:1});
const checkpoint=codec.createCheckpointMetadata('inst_device_a','2026-08-31T00:00:00.000Z');
const plan=freeze({studentName:'Student',installationId:'inst_device_a',exportedAt:'2026-08-31T00:00:00.000Z',sourceRevision:'2026-08-31T00:00:00.000Z',checkpoint,recordDates:freeze([]),savedDayDeletions:freeze([]),noteDeletions:freeze([]),attachmentDeletions:freeze([]),counts});
const algorithm=codec.checksumAlgorithm();
const image=new Blob([new Uint8Array([137,80,78,71,13,10,26,10,1,2,3,4])],{type:'image/png'});
const descriptor=freeze({assetId,mimeType:'image/png',size:image.size,checksum:await codec.checksumBlob(image)});
const manifest=codec.createManifest(plan,{compression:'none',algorithm});
assert.equal(manifest.checkpoint,checkpoint,'Portable materialisation must reuse the checkpoint identity captured before serialisation.');
assert.equal('studentName' in manifest,false,'Current backup manifest must not duplicate protected studentName outside the canonical personal-data section.');
assert.equal(Object.hasOwn(manifest,'schemaVersion'),false,'Current checkpoint manifests must not write legacy sync schemaVersion baggage.');
const checkpointChunk=await codec.encodeChunk(0,'checkpointManifest',[codec.createProtectedManifest(plan,manifest.checkpoint)],algorithm);
const personalChunk=await codec.encodeChunk(1,'personalData',[personalData],algorithm);
const chunk=await codec.encodeChunk(2,'note',area,algorithm);
const complete=await codec.encodeCompletion(3,counts,[checkpointChunk.checksum,personalChunk.checksum,chunk.checksum],algorithm,[descriptor]);
const metadata=new Blob([JSON.stringify(manifest)+'\n'+checkpointChunk.line+'\n'+personalChunk.line+'\n'+chunk.line+'\n'+JSON.stringify(complete)+'\n']);
const portable=codec.createV10Container(metadata,{compression:'none',assetBlobs:[image]});
const parsed=await codec.inspectCurrent(portable,{filename:'portable.sdbackup'});
assert.equal(parsed.formatVersion,25);
assert.equal(parsed.captureAuthority,'canonical-complete','Current standalone backups must persist canonical-complete authority inside the protected completion proof.');
assert.equal(parsed.protectedCheckpointManifest.checkpointId,parsed.manifest.checkpoint.checkpointId);
assert.equal(parsed.manifest.deviceId,undefined);
assert.equal(parsed.manifest.checkpoint.originInstallationId,'inst_device_a');
assert.equal(parsed.assetDescriptors.length,1);
assert.equal(parsed.importedAssets.length,1);
assert.equal(parsed.importedAssets[0].assetId,assetId);
assert.deepEqual([...new Uint8Array(await parsed.importedAssets[0].blob.arrayBuffer())],[...new Uint8Array(await image.arrayBuffer())]);
assert.equal(parsed.uncompressedBytes>=metadata.size+image.size,true);
// The real complete checkpoint, including attachment bytes and protected checkpoint manifest, must survive SDENC02 encryption/decryption unchanged.
const encryptionKey=await passwordKey('C2 encrypted portable checkpoint');
const encryptedChunks=[];await transformEncrypted(portable,encryptionKey,{write:async bytes=>encryptedChunks.push(new Uint8Array(bytes).slice())});
const encryptedPortable=new Blob(encryptedChunks,{type:'application/octet-stream'});assert.ok(await streamEncryptionInfo(encryptedPortable));
const decryptedChunks=[];await transformEncrypted(encryptedPortable,encryptionKey,{write:async bytes=>decryptedChunks.push(new Uint8Array(bytes).slice())},{decrypt:true});
const decryptedPortable=new Blob(decryptedChunks,{type:'application/octet-stream'});
const encryptedRoundTrip=await codec.inspectCurrent(decryptedPortable,{filename:'portable-encrypted.sdbackup'});
assert.equal(encryptedRoundTrip.protectedCheckpointManifest.checkpointId,parsed.protectedCheckpointManifest.checkpointId);
assert.equal(encryptedRoundTrip.importedAssets.length,1);assert.deepEqual([...new Uint8Array(await encryptedRoundTrip.importedAssets[0].blob.arrayBuffer())],[...new Uint8Array(await image.arrayBuffer())]);
const validated=await codec.inspectCurrent(portable,{filename:'portable.sdbackup',validateOnly:true});
assert.deepEqual(validated.importedAssets,[]);

const bytes=new Uint8Array(await portable.arrayBuffer());
const corrupt=bytes.slice();corrupt[corrupt.length-1]^=0xff;
await assert.rejects(()=>codec.inspectCurrent(new Blob([corrupt]),{filename:'corrupt.sdbackup'}),/failed its integrity check/u);
// Metadata/container integrity is not a substitute for per-chunk integrity: a structurally valid container with a tampered chunk body must still fail its declared chunk checksum.
const tamperedChunk=JSON.parse(chunk.line);tamperedChunk.items[0]={...tamperedChunk.items[0],text:'tampered backup chunk'};
const tamperedMetadata=new Blob([JSON.stringify(manifest)+'\n'+checkpointChunk.line+'\n'+personalChunk.line+'\n'+JSON.stringify(tamperedChunk)+'\n'+JSON.stringify(complete)+'\n']);
await assert.rejects(()=>codec.inspectCurrent(codec.createV10Container(tamperedMetadata,{compression:'none',assetBlobs:[image]}),{filename:'tampered-chunk.sdbackup'}),/Backup chunk 2 failed its integrity check/u);
await assert.rejects(()=>codec.inspectCurrent(portable.slice(0,portable.size-1),{filename:'truncated.sdbackup'}),/truncated/u);
await assert.rejects(()=>codec.inspectCurrent(new Blob([portable,new Uint8Array([1])]),{filename:'trailing.sdbackup'}),/trailing binary data/u);

const rescueComplete=await codec.encodeCompletion(3,counts,[checkpointChunk.checksum,personalChunk.checksum,chunk.checksum],algorithm,[descriptor],'rescue-partial');
const rescueMetadata=new Blob([JSON.stringify(manifest)+'\n'+checkpointChunk.line+'\n'+personalChunk.line+'\n'+chunk.line+'\n'+JSON.stringify(rescueComplete)+'\n']);
const rescueParsed=await codec.inspectCurrent(codec.createV10Container(rescueMetadata,{compression:'none',assetBlobs:[image]}),{filename:'rescue-partial.sdbackup'});
assert.equal(rescueParsed.captureAuthority,'rescue-partial','Rescue-partial authority must survive file closure/reopening rather than being inferred from current runtime state.');
const rescueTampered={...rescueComplete,captureAuthority:'canonical-complete'};
const rescueTamperedMetadata=new Blob([JSON.stringify(manifest)+'\n'+checkpointChunk.line+'\n'+personalChunk.line+'\n'+chunk.line+'\n'+JSON.stringify(rescueTampered)+'\n']);
await assert.rejects(()=>codec.inspectCurrent(codec.createV10Container(rescueTamperedMetadata,{compression:'none',assetBlobs:[image]}),{filename:'rescue-authority-tampered.sdbackup'}),/completion proof|integrity check/u,'Capture authority must be protected by the completion checksum.');

const missingComplete=await codec.encodeCompletion(3,counts,[checkpointChunk.checksum,personalChunk.checksum,chunk.checksum],algorithm,[freeze({assetId,missing:true})]);
const missingMetadata=new Blob([JSON.stringify(manifest)+'\n'+checkpointChunk.line+'\n'+personalChunk.line+'\n'+chunk.line+'\n'+JSON.stringify(missingComplete)+'\n']);
const missingParsed=await codec.inspectCurrent(codec.createV10Container(missingMetadata,{compression:'none',assetBlobs:[]}),{filename:'missing.sdbackup'});
assert.equal(missingParsed.assetDescriptors[0].missing,true);
assert.equal(missingParsed.importedAssets.length,0);
const missingCoverage=codec.attachmentCoverage(missingParsed.assetDescriptors);
assert.equal(missingCoverage.fullyRecoverable,false,'a canonical-complete file with a missing asset is not fully recoverable');
assert.deepEqual(missingCoverage.missingIds,[assetId],'the missing attachment identity must remain inspectable');
assert.match(codec.missingAttachmentWarning(missingParsed.assetDescriptors),/Partial attachment recovery: 1 attachment missing/u);
assert.equal(codec.attachmentCoverage(parsed.assetDescriptors).fullyRecoverable,true,'all present, verified binary frames certify full attachment coverage');

await assert.rejects(()=>codec.encodeCompletion(3,counts,[checkpointChunk.checksum,personalChunk.checksum,chunk.checksum],algorithm,[descriptor,descriptor]),/duplicate asset identity/u);
const extraId='img-abcdefghijklmnopqrstuvwx';
const extra=freeze({assetId:extraId,missing:true});
const extraProof={version:20,chunkCount:3,counts,chunkHashes:[checkpointChunk.checksum,personalChunk.checksum,chunk.checksum],assets:[descriptor,extra]};
const sha=text=>createHash('sha256').update(text).digest('hex');
const extraComplete={type:'complete',...extraProof,checksum:sha(JSON.stringify(extraProof)),completedAt:'2026-08-31T00:00:01.000Z'};
const extraMeta=new Blob([JSON.stringify(manifest)+'\n'+checkpointChunk.line+'\n'+personalChunk.line+'\n'+chunk.line+'\n'+JSON.stringify(extraComplete)+'\n']);
await assert.rejects(()=>codec.inspectCurrent(codec.createV10Container(extraMeta,{compression:'none',assetBlobs:[image]}),{filename:'extra.sdbackup'}),/completion proof|do not exactly match|completion counts do not match/u);

console.log(JSON.stringify({status:'PASS',suite:'portable-backup',encryptedCheckpointWithAttachment:true,assetBytes:image.size,containerBytes:portable.size},null,2));
