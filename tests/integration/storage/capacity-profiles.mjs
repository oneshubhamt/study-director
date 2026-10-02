import {createProcessingEngine} from '../../../portable/processing.js';
const testProcessing=Object.freeze({...createProcessingEngine(),scope:operation=>operation()});
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {PRODUCTION_LIMITS as limits,CAPACITY_PROFILES} from '../../../contracts/production-limits.mjs';

const read=file=>fs.readFileSync(file,'utf8');
for(const file of ['source/core/internal.js','source/core/persistence.js','source/core/record-codecs.js','source/core/backup-codec.js'])vm.runInThisContext(read(file),{filename:file});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const RecordCodecs=registry.require('record-codecs',1);
const BackupCodecs=registry.require('backup-codec',1);
const freeze=Object.freeze;
const defs=freeze({
  dailyRecord:freeze({idField:'date',backupLimit:limits.maxImportRecords}),
  areaNote:freeze({idField:'key',backupLimit:limits.maxImportAreaNotes}),
  activeSession:freeze({idField:'id',backupLimit:1}),
  
});
const isDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''));
const personalDataCodec=RecordCodecs.createPersonalDataCodec(limits);
const codec=BackupCodecs.createBackupCodec(freeze({personalDataCodec,processing:testProcessing,
  appConfig:freeze({appName:'Study Director',attribution:'Study Director'}),limits,dataContract:freeze({app:'study-director.data-contract',schemas:freeze({CheckpointMetadata:freeze({format:'study-director.checkpoint-metadata',version:1}),CheckpointProtectedManifest:freeze({format:'study-director.checkpoint-protected-manifest',version:2}),Backup:freeze({format:'study-director.backup',version:19})})}),legacy:freeze({schemaVersion:3,tombstoneLimit:limits.maxLegacyImportTombstones}),
  entityTypes:freeze(Object.keys(defs)),keyedRecord:freeze({create:()=>Object.create(null)}),entities:freeze({entityDefinition:type=>defs[type]||null,entityIdentity:(type,item)=>String(item?.[defs[type]?.idField]||'')}),
  helpers:freeze({boundedInt:(value,{min=0,max=Number.MAX_SAFE_INTEGER,fallback=0}={})=>{const n=Number(value);return Number.isInteger(n)&&n>=min&&n<=max?n:fallback;},jsonByteLength:value=>new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value)).byteLength}),
  richText:freeze({assetIds:()=>freeze([]),assetIdValid:()=>false,imageMimeTypeValid:()=>false}),
  dailyRecordCodec:freeze({sanitizeCurrentDailyRecord:item=>item&&isDate(item.date)&&Number(item.version)===15?freeze({...item}):null,isSupportedSavedDate:value=>isDate(value)&&value>=limits.minSupportedSavedDate&&value<='2026-09-02',sanitizeCurrentAreaNote:(item,key)=>item&&Number(item.version)===2&&String(key||item.key)?freeze({...item,key:String(key||item.key),text:String(item.text||'').slice(0,limits.maxNoteChars),updatedAt:String(item.updatedAt||'')}):null}),
  activeSessionCodec:freeze({sanitizeCurrent:()=>null}),  compatibilityCodec:freeze({format:'study-director.compatibility-codecs',contractVersion:1,dailyRecord:item=>item&&isDate(item.date)?freeze({...item,version:15}):null,areaNote:(item,key)=>item&&String(key||item.key)?freeze({...item,version:2,key:String(key||item.key),label:String(item.label||key||item.key),text:String(item.text||'').slice(0,limits.maxNoteChars),updatedAt:String(item.updatedAt||'')}):null,activeSession:()=>null,localRecoveryEnvelope:()=>null,reflectionDraft:item=>item&&isDate(item.date)?freeze({...item,version:1}):null,personalData:item=>personalDataCodec.normalize(item)})
}));

const dateAt=index=>{const date=new Date('2025-01-01T00:00:00.000Z');date.setUTCDate(date.getUTCDate()+index);return date.toISOString().slice(0,10);};
const text=(label,index,size)=>{const seed=`${label}-${index.toString(36)} evidence recall correction next-action `;return seed.repeat(Math.ceil(size/seed.length)).slice(0,size);};
const profile=CAPACITY_PROFILES.denseTextMetadata;
assert.equal(profile.assetCount,0,'The dense-text profile must not imply image-asset coverage.');
const records=Array.from({length:profile.dailyRecords},(_,index)=>freeze({version:15,date:dateAt(index),savedAt:`${dateAt(index)}T20:00:00.000Z`,updatedAt:`${dateAt(index)}T20:00:00.000Z`,sourceRevision:0,quote:'',reflection:text('reflection',index,profile.averageTextBytes),studyQuality:4,realTimeSnapshot:null,schedule:[],results:Object.freeze(Object.create(null)),practiceRuns:[],carryForwardDraft:''}));
const notes=Array.from({length:profile.ongoingNotes},(_,index)=>freeze({version:2,key:`area-${index}`,label:`area-${index}`,text:text('note',index,profile.averageTextBytes),updatedAt:'2026-09-02T00:00:00.000Z'}));
const personalData=freeze({
  version:2,
  plans:freeze({draft:null,savedPlans:freeze([]),defaultId:null}),
  preferences:freeze({studentName:'Capacity Profile',theme:null,presentation:null,quote:null,practiceCueMode:null,fontScale:null,practiceTargetMs:null,nudge:null})
});
const counts=codec.countShape({dailyRecord:records.length,areaNote:notes.length,activeSession:0,personalData:1,checkpointManifest:1});
const plan=freeze({studentName:'Capacity Profile',installationId:'inst_checkpoint_a',exportedAt:'2026-09-02T00:00:00.000Z',sourceRevision:'2026-09-02T00:00:00.000Z',recordDates:freeze(records.map(item=>item.date)),savedDayDeletions:freeze([]),areaNoteItems:notes,areaNoteDeletions:freeze([]),attachmentDeletions:freeze([]),assetItems:freeze([]),counts});
const algorithm=codec.checksumAlgorithm(),manifest=codec.createManifest(plan,{compression:'none',algorithm});
const lines=[JSON.stringify(manifest)],hashes=[];let sequence=0;
const protectedChunk=await codec.encodeChunk(sequence++,'checkpointManifest',[codec.createProtectedManifest(plan,manifest.checkpoint)],algorithm);lines.push(protectedChunk.line);hashes.push(protectedChunk.checksum);
for(const [type,items] of [['personalData',[personalData]],['dailyRecord',records],['areaNote',notes]])for(const group of codec.splitItems(items)){const encoded=await codec.encodeChunk(sequence++,type,group,algorithm);lines.push(encoded.line);hashes.push(encoded.checksum);}
lines.push(JSON.stringify(await codec.encodeCompletion(sequence,counts,hashes,algorithm,[])));
const metadata=new Blob([lines.join('\n')+'\n']),container=codec.createV10Container(metadata,{compression:'none',assetBlobs:[]});
assert.ok(metadata.size<limits.backupMaxUncompressedBytes,'dense text metadata exceeds the production expanded limit');
assert.ok(container.size<limits.backupMaxFileBytes,'dense text container exceeds the production file limit');
const inspected=await codec.inspectCurrent(container,{filename:'qa-dense-text-metadata.sdbackup'});
assert.deepEqual(inspected.counts,counts);assert.equal(inspected.records.length,records.length);assert.equal(Object.keys(inspected.data.areaNotes).length,notes.length);assert.equal(inspected.importedReflectionDrafts,undefined);

assert.throws(()=>codec.splitItems([{key:'oversized',text:'x'.repeat(limits.backupMaxEntryBytes)}]),/entry is too large/i);
const overCounts={...counts,dailyRecord:limits.maxImportRecords+1};
const unsafePlan=freeze({...plan,counts:freeze(overCounts)});
const unsafe=codec.createManifest(unsafePlan,{compression:'none',algorithm});
const unsafeMetadata=new Blob([JSON.stringify(unsafe)+'\n']),unsafeContainer=codec.createV10Container(unsafeMetadata,{compression:'none',assetBlobs:[]});
await assert.rejects(()=>codec.inspectCurrent(unsafeContainer,{filename:'unsafe.sdbackup'}),/unsafe entity counts/i);

console.log(JSON.stringify({status:'PASS',suite:'capacity-profiles',profileName:'denseTextMetadata',profile,counts,metadataBytes:metadata.size,containerBytes:container.size,chunks:sequence,boundaries:['dense plain-text metadata inspection','oversized entry rejected','over-count manifest rejected']},null,2));
