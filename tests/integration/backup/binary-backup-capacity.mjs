import {RUNTIME_DATA_CONTRACT} from '../../../contracts/canonical-identities.mjs';
import {createProcessingEngine} from '../../../portable/processing.js';
const testProcessing=Object.freeze({...createProcessingEngine(),scope:operation=>operation()});
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {PRODUCTION_LIMITS as limits} from '../../../contracts/production-limits.mjs';
import {testPendingReviewCodec} from '../../helpers/pending-review-codec.mjs';
import {richTextRuntimeSource} from '../../helpers/rich-text-runtime.mjs';

const read=file=>fs.readFileSync(new URL('../../../'+file,import.meta.url),'utf8');
for(const file of ['source/core/internal.js','source/core/persistence.js','source/core/record-codecs.js','source/core/backup-codec.js'])vm.runInThisContext(read(file),{filename:file});
const richSandbox={console,URL,TextEncoder,TextDecoder,setTimeout,clearTimeout,queueMicrotask};vm.createContext(richSandbox);vm.runInContext(richTextRuntimeSource(),richSandbox,{filename:'rich-text.js'});
const richApi=vm.runInContext('globalThis.StudyDirectorRichText',richSandbox);
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')],Persistence=registry.require('persistence',1),freeze=Object.freeze;
const RecordCodecs=registry.require('record-codecs',1);
const BackupCodecs=registry.require('backup-codec',1);
const MiB=1024*1024;
const dataContract=RUNTIME_DATA_CONTRACT;
const defs=freeze({dailyRecord:freeze({idField:'date',backupLimit:limits.maxImportRecords}),note:freeze({idField:'key',backupLimit:limits.maxNotes}),activeSession:freeze({idField:'id',backupLimit:1})});
const keyedRecord=freeze({create:()=>Object.create(null)}),entityDefinition=t=>defs[t]||null,entityIdentity=(t,x)=>String(x?.[defs[t]?.idField]||'');
const boundedInt=(v,{min=0,max=Number.MAX_SAFE_INTEGER,fallback=0}={})=>{const n=Number(v);return Number.isInteger(n)&&n>=min&&n<=max?n:fallback;};
const jsonByteLength=v=>new TextEncoder().encode(typeof v==='string'?v:JSON.stringify(v)).byteLength,isDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''));
const dailyRecordCodec=freeze({sanitizeHistoricalDailyRecord:x=>x&&isDate(x.date)?freeze({...x}):null,canonicalizeHistoricalDailyRecord:x=>x&&isDate(x.date)?freeze({...x,version:14}):null,sanitizeCurrentDailyRecord:x=>x&&isDate(x.date)?freeze({...x}):null,sanitizeImportedNote:(x,k)=>x?freeze({key:String(k||x.key),text:String(x.text||''),updatedAt:String(x.updatedAt||'2026-09-01T00:00:00.000Z')}):null,sanitizeCurrentNote:(x,k)=>x?freeze({key:String(k||x.key),text:String(x.text||''),updatedAt:String(x.updatedAt||'2026-09-01T00:00:00.000Z')}):null,isSupportedSavedDate:isDate});
const activeSessionCodec=freeze({sanitizeCurrent:()=>null});
const reflectionDraftCodec=freeze({format:'study-director.reflection-draft-codec',contractVersion:1,sanitizeCurrent:()=>null});
const personalDataCodec=RecordCodecs.createPersonalDataCodec(limits);
const pendingReviewCodec=testPendingReviewCodec(RecordCodecs,{personalDataCodec});
const compatibilityCodec=freeze({format:'study-director.compatibility-codecs',contractVersion:1,dailyRecord:x=>dailyRecordCodec.sanitizeCurrentDailyRecord(x),note:(x,k)=>dailyRecordCodec.sanitizeCurrentNote(x,k),activeSession:()=>null,localRecoveryEnvelope:()=>null,reflectionDraft:()=>null,personalData:x=>personalDataCodec.normalize(x)});
const codec=BackupCodecs.createBackupCodec(freeze({personalDataCodec,pendingReviewCodec,processing:testProcessing,appConfig:freeze({appName:'Study Director',attribution:'Study Director'}),limits,dataContract,legacy:freeze({schemaVersion:3,tombstoneLimit:limits.maxLegacyImportTombstones}),entityTypes:freeze(Object.keys(defs)),keyedRecord,entities:freeze({entityDefinition,entityIdentity}),helpers:freeze({boundedInt,jsonByteLength}),richText:freeze({assetIds:value=>richApi.assetIds(value),assetIdValid:value=>richApi.isAssetId(value),imageMimeTypeValid:value=>richApi.isSupportedImageType(value)}),dailyRecordCodec,activeSessionCodec,compatibilityCodec}));

const uniqueAssetCount=8,logicalAssetCount=uniqueAssetCount+1;
const assetIds=Array.from({length:logicalAssetCount},(_,i)=>`img-capacity-${String(i+1).padStart(20,'0')}`);
const imageNodes=assetIds.map((assetId,i)=>({type:'SDImage',param:{assetId,alt:`capacity-${i+1}`,widthPct:100}}));
const rich='WG1:'+JSON.stringify({version:1,doc:{type:'Doc',content:imageNodes}});
assert.deepEqual([...richApi.assetIds(rich)],assetIds);
const area=[freeze({version:2,key:'Capacity',label:'Capacity',text:rich,updatedAt:'2026-09-01T00:00:00.000Z'})];
const uniqueBlobs=Array.from({length:uniqueAssetCount},(_,i)=>{
  const payload=new Uint8Array(8*MiB);
  for(let offset=0;offset<payload.length;offset+=4096)payload[offset]=(i*37+offset/4096)%251;
  payload[payload.length-1]=i+1;
  return new Blob([payload],{type:i%2?'image/webp':'image/png'});
});
// One logical attachment intentionally shares the first payload. Production backup assembly
// writes each checksum:size group once while descriptors preserve all logical asset IDs.
const blobs=[...uniqueBlobs,uniqueBlobs[0]];
const algorithm=codec.checksumAlgorithm(),descriptors=[];
for(let i=0;i<blobs.length;i++)descriptors.push(freeze({assetId:assetIds[i],mimeType:blobs[i].type,size:blobs[i].size,checksum:await codec.checksumBlob(blobs[i])}));
const physicalBlobs=[...new Map(descriptors.map((descriptor,i)=>[descriptor.checksum+':'+descriptor.size,blobs[i]])).values()];
assert.equal(physicalBlobs.length,uniqueAssetCount,'Fixture must mirror production checksum:size payload deduplication.');
const personalData=freeze({
  version:2,
  plans:freeze({draft:null,savedPlans:freeze([]),defaultId:null}),
  preferences:freeze({studentName:'Capacity',theme:null,presentation:null,quote:null,practiceCueMode:null,fontScale:null,practiceTargetMs:null,nudge:null})
});
const counts=freeze({dailyRecord:0,note:1,activeSession:0,personalData:1,checkpointManifest:1});
const plan=freeze({studentName:'Capacity',installationId:'inst_capacity_device',exportedAt:'2026-09-01T00:00:00.000Z',sourceRevision:'2026-09-01T00:00:00.000Z',recordDates:freeze([]),savedDayDeletions:freeze([]),noteItems:area,noteDeletions:freeze([]),attachmentDeletions:freeze([]),assetItems:freeze([]),counts});
const manifest=codec.createManifest(plan,{compression:'none',algorithm});
const checkpointChunk=await codec.encodeChunk(0,'checkpointManifest',[codec.createProtectedManifest(plan,manifest.checkpoint)],algorithm),personalChunk=await codec.encodeChunk(1,'personalData',[personalData],algorithm),chunk=await codec.encodeChunk(2,'note',area,algorithm),complete=await codec.encodeCompletion(3,counts,[checkpointChunk.checksum,personalChunk.checksum,chunk.checksum],algorithm,descriptors);
const metadata=new Blob([JSON.stringify(manifest)+'\n'+checkpointChunk.line+'\n'+personalChunk.line+'\n'+chunk.line+'\n'+JSON.stringify(complete)+'\n']);
const portable=codec.createV10Container(metadata,{compression:'none',assetBlobs:physicalBlobs});
assert.ok(portable.size>64*MiB&&portable.size<128*MiB,'Fixture must exercise a backup with 64 MiB of unique attachment bytes.');
const parsed=await codec.inspectCurrent(portable,{filename:'capacity.sdbackup'});
assert.equal(parsed.importedAssets.length,logicalAssetCount);assert.equal(parsed.assetDescriptors.length,logicalAssetCount);
for(let i=0;i<logicalAssetCount;i++){assert.equal(parsed.importedAssets[i].assetId,assetIds[i]);assert.equal(parsed.importedAssets[i].blob.size,8*MiB);}
assert.equal(parsed.assetBytes,64*MiB,'Reader must count each checksum:size payload once.');
assert.ok(parsed.uncompressedBytes>=64*MiB);
console.log(JSON.stringify({status:'PASS',suite:'binary-backup-capacity',engine:'wordgard',logicalAssets:logicalAssetCount,uniquePayloads:uniqueAssetCount,bytesPerAsset:8*MiB,uniqueAssetMiB:64,containerMiB:Number((portable.size/MiB).toFixed(2))},null,2));
