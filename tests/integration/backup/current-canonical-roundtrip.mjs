import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createProcessingEngine} from '../../../portable/processing.js';
import {passwordKey,transformEncrypted} from '../../../portable/stream-encryption.js';
import {noteId} from '../../helpers/note-ids.mjs';
import {registry,Domain,RecordCodecs,CompatibilityCodecs,freeze,boundedNumber,boundedInt,clampText,optionalText,optionalBoundedNumber,normalizeTimestamp,sameDataValue,helpers,limits,dataContract,dailyRecordCodec} from '../../helpers/current-codec-fixture.mjs';
const activeSessionCodec=RecordCodecs.createActiveSessionCodec(freeze({limits,dataContract,activeSessionId:'current',domain:Domain,keyedRecord:freeze({create:()=>Object.create(null)}),dailyRecordCodec,
  helpers:freeze({boundedInt,boundedNumber,clampText,clampEditorContent:clampText,editorContentWithinLimits:()=>true,cleanDayRevision:v=>Math.max(0,Math.round(Number(v)||0)),sameDataValue,activeSessionScheduleFingerprint:()=> 'fp',isCanonicalScheduleText:v=>!!v,isValidIsoDate:Domain.TimeModel.isValidIsoDate,normalizeStudyQuality:helpers.normalizeStudyQuality,parseProgressNumber:Domain.CompletionModel.parseProgressNumber,sanitizePracticeState:()=>({active:false,runs:[]})}),
  timestamps:freeze({normalizeTimestamp,normalizeImportedTimestamp:normalizeTimestamp,normalizeImportedEpochMillis:(v,f=null)=>Number.isFinite(Number(v))?Number(v):f})}));
const processing=freeze({...createProcessingEngine(),scope:fn=>fn()}),personalDataCodec=RecordCodecs.createPersonalDataCodec(limits),attachments=registry.require('attachments',1);
const pendingReviewCodec=RecordCodecs.createPendingReviewCodec(freeze({dataContract,dailyRecordCodec,activeSessionCodec,personalDataCodec,helpers:freeze({sameDataValue,randomBytes:length=>crypto.getRandomValues(new Uint8Array(length))})}));
const defs=freeze({dailyRecord:{idField:'date',backupLimit:limits.maxImportRecords},note:{idField:'key',backupLimit:limits.maxNotes},activeSession:{idField:'id',backupLimit:1}});
const richSandbox={console,URL,TextEncoder,TextDecoder,setTimeout,clearTimeout,queueMicrotask};vm.createContext(richSandbox);vm.runInContext(fs.readFileSync('source/external/rich-text.js','utf8'),richSandbox);
const rich=richSandbox.StudyDirectorRichText;
const codecInput=freeze({limits,dataContract,processing,personalDataCodec,pendingReviewCodec,dailyRecordCodec,activeSessionCodec,
  appConfig:freeze({appName:'Study Director',attribution:'Study Director'}),legacy:freeze({schemaVersion:3,tombstoneLimit:limits.maxLegacyImportTombstones}),entityTypes:freeze(Object.keys(defs)),keyedRecord:freeze({create:()=>Object.create(null)}),entities:freeze({entityDefinition:t=>defs[t],entityIdentity:(t,v)=>v[defs[t].idField]}),helpers:freeze({boundedInt,jsonByteLength:v=>new TextEncoder().encode(typeof v==='string'?v:JSON.stringify(v)).length}),richText:freeze({assetIds:v=>rich.scanAttachmentReferences(v).assetIds,assetIdValid:attachments.validId,imageMimeTypeValid:attachments.validType}),compatibilityCodec:freeze({format:'study-director.compatibility-codecs',contractVersion:1,dailyRecord:()=>{throw Error('Unexpected migration')},note:()=>{throw Error('Unexpected migration')},activeSession:()=>{throw Error('Unexpected migration')},reflectionDraft:()=>{throw Error('Unexpected migration')}})}),codec=registry.require('backup-codec',1).createBackupCodec(codecInput);
const stamp='2026-09-10T20:00:00.000Z',imageId='img-1234567890abcdefghijklmn';
const text='WG1:'+JSON.stringify({version:1,doc:{type:'Doc',content:[{type:'Paragraph',content:[{type:'Text',param:'Current note'}]},{type:'SDImage',param:{assetId:imageId,alt:'retained image',widthPct:100}}]}});
const study={version:16,recordKind:'study',date:'2026-09-10',savedAt:stamp,updatedAt:stamp,sourceRevision:9,quote:'',reflection:text,studyQuality:4,realTimeSnapshot:null,schedule:[],results:{},practiceRuns:[],carryForwardDraft:''};
const diary=dailyRecordCodec.createDiaryRecord('2026-09-09','Diary-only reflection',{savedAt:stamp,updatedAt:stamp});
assert.ok(dailyRecordCodec.sanitizeCurrentDailyRecord(study));assert.ok(diary);
const note={version:3,key:noteId('ethics'),label:'Ethics',text,updatedAt:stamp};assert.ok(dailyRecordCodec.sanitizeCurrentNote(note));
const active=activeSessionCodec.canonicalize({id:'current',type:'activeSession',version:10,revision:12,date:'2026-09-10',status:'suspended',runningOn:'inst_roundtrip_device',scheduleText:'07:00 | 60 | A | Study | Ethics | pages | 10',snapshot:{version:6,date:'2026-09-10',fingerprint:'fp',review:{reflection:'Unsaved Review',studyQuality:4},updatedAt:stamp},suspendedAt:stamp,updatedAt:stamp});assert.ok(active);assert.ok(activeSessionCodec.sanitizeCurrent(active));
const personal={version:2,plans:{draft:'07:00 | 60 | A | Study | Ethics | pages | 10',savedPlans:[{id:'plan-current-qa',label:'Current plan',scheduleText:'08:00 | 60 | B | Study | Polity | pages | 10',createdAt:stamp,updatedAt:stamp}],defaultId:'plan-current-qa'},preferences:{studentName:'Current User',theme:null,presentation:null,quote:null,practiceCueMode:null,fontScale:null,practiceTargetMs:null,nudge:null,soundMode:'minimal'}};
const blobs=[new Blob(['image bytes'],{type:'image/png'}),new Blob(['%PDF-current bytes'],{type:'application/pdf'}),new Blob(['audio bytes'],{type:'audio/mpeg'})];
const ids=[imageId,'att-1234567890abcdefghijklmn','att-2234567890abcdefghijklmn','att-3234567890abcdefghijklmn'];
const descriptors=[];
for(let i=0;i<4;i++){const blob=blobs[i===3?1:i];descriptors.push({assetId:ids[i],mimeType:blob.type,size:blob.size,checksum:await codec.checksumBlob(blob),name:['image.png','Independent PDF','Independent audio','Same PDF, different label'][i],library:i!==0});}
const counts=codec.countShape({dailyRecord:2,note:1,activeSession:1,personalData:1,checkpointManifest:1});
const plan={installationId:'inst_current_qa',exportedAt:stamp,sourceRevision:stamp,recordDates:[study.date,diary.date],noteItems:[note],assetItems:descriptors.map(descriptor=>({descriptor})),savedDayDeletions:[{date:'2026-09-08',deletedAt:stamp}],noteDeletions:[{key:noteId('deleted note'),deletedAt:stamp}],attachmentDeletions:[{assetId:'att-4234567890abcdefghijklmn',deletedAt:stamp}],counts};
const algorithm=codec.checksumAlgorithm(),manifest=codec.createManifest(plan,{compression:'none',algorithm});
const groups=[['checkpointManifest',[codec.createProtectedManifest(plan,manifest.checkpoint)]],['personalData',[personal]],['dailyRecord',[study,diary]],['note',[note]],['activeSession',[active]]];
async function assemble(values=groups,assets=descriptors){const chunks=[];for(let i=0;i<values.length;i++)chunks.push(await codec.encodeChunk(i,values[i][0],values[i][1],algorithm));const completion=await codec.encodeCompletion(chunks.length,counts,chunks.map(c=>c.checksum),algorithm,assets);return codec.createV10Container(new Blob([JSON.stringify(manifest)+'\n',...chunks.map(c=>c.line+'\n'),JSON.stringify(completion)+'\n']),{compression:'none',assetBlobs:blobs});}
const file=await assemble(),parsed=await codec.inspectCurrent(file);
assert.equal(parsed.formatVersion,23);assert.deepEqual(parsed.records,[dailyRecordCodec.sanitizeCurrentDailyRecord(study),diary]);assert.deepEqual(parsed.data.notes[note.key],note);assert.deepEqual(parsed.importedActiveSession,active);assert.deepEqual(parsed.importedPersonalData,personal);assert.deepEqual(parsed.assetDescriptors,descriptors);assert.equal(parsed.assetBytes,blobs.reduce((n,b)=>n+b.size,0));
for(let i=0;i<4;i++)assert.equal(await parsed.importedAssets[i].blob.text(),await blobs[i===3?1:i].text());
for(const key of ['savedDayDeletions','noteDeletions','attachmentDeletions'])assert.deepEqual(parsed.protectedCheckpointManifest[key],plan[key]);
const key=await passwordKey('Current format test passphrase'),sealed=[],opened=[];
await transformEncrypted(file,key,{write:async b=>sealed.push(b.slice())});await transformEncrypted(new Blob(sealed),key,{write:async b=>opened.push(b.slice())},{decrypt:true});assert.deepEqual(new Uint8Array(await new Blob(opened).arrayBuffer()),new Uint8Array(await file.arrayBuffer()));
const invalid=structuredClone(groups);invalid[2][1][0].unexpectedField=true;await assert.rejects(codec.inspectCurrent(await assemble(invalid)),/noncanonical dailyRecord/);
assert.equal(codec.normalizeRecord({...study,version:17}),null,'future data must fail closed');
const corrupted=new Uint8Array(await file.arrayBuffer());corrupted[corrupted.length-1]^=1;await assert.rejects(codec.inspectCurrent(new Blob([corrupted])),/integrity/);
await assert.rejects(codec.inspectCurrent(file.slice(0,-1)),/truncated/);

// A v20 file keeps notes and their deletion history under note names. Reading
// it gives each note, and each deletion, the id the live conversion gives that
// note, so older backups and this device agree on which note is which.
const compatibility=CompatibilityCodecs.create(freeze({limits,dataContract,keyedRecord:freeze({create:()=>Object.create(null)}),dailyRecordCodec,activeSessionCodec,personalDataCodec,
  helpers:freeze({boundedInt,boundedNumber,optionalBoundedNumber,optionalText,clampText,clampEditorContent:clampText,editorContentWithinLimits:()=>true,sameDataValue,sanitizePracticeRun:helpers.sanitizePracticeRun,activeSessionScheduleFingerprint:()=> 'fp',isValidIsoDate:value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value)),isCanonicalScheduleText:()=>true}),
  timestamps:freeze({normalizeTimestamp,normalizeImportedTimestamp:normalizeTimestamp}),domain:Domain,installationId:()=>'inst_roundtrip_device'}));
const reader=registry.require('backup-codec',1).createBackupCodec(freeze({...codecInput,compatibilityCodec:freeze({...codecInput.compatibilityCodec,note:compatibility.note,noteKey:compatibility.noteKey})}));
// Files before v22 name the note entity areaNote (in chunks and counts) and
// carry protected manifest version 2, whose authority and deletion list say
// areaNotes and areaNoteDeletions. The fixture writes them exactly that way.
const writtenType=type=>type==='note'?'areaNote':type,writtenCounts=value=>Object.fromEntries(Object.entries(value).map(([type,count])=>[writtenType(type),count]));
async function writeOlder(version,olderPlan,noteItems){
  const writer=registry.require('backup-codec',1).createBackupCodec(freeze({...codecInput,dataContract:freeze({...dataContract,schemas:freeze({...dataContract.schemas,Backup:freeze({...dataContract.schemas.Backup,version})})})}));
  const created=writer.createManifest(olderPlan,{compression:'none',algorithm}),olderManifest={...created,protectedManifest:{...created.protectedManifest,version:2},declaredCounts:writtenCounts(withoutReviews(created.declaredCounts))};
  const current=writer.createProtectedManifest(olderPlan,created.checkpoint),protectedV2={format:current.format,version:2,checkpointId:current.checkpointId,sourceRevision:current.sourceRevision,
    authority:Object.fromEntries(Object.entries(current.authority).map(([name,mode])=>[name==='notes'?'areaNotes':name,mode])),savedDayDeletions:current.savedDayDeletions,areaNoteDeletions:current.noteDeletions,attachmentDeletions:current.attachmentDeletions};
  const olderGroups=[['checkpointManifest',[protectedV2]],['personalData',[personal]],['dailyRecord',[study,diary]],['areaNote',noteItems],['activeSession',[active]]],chunks=[];
  for(let i=0;i<olderGroups.length;i++)chunks.push(await writer.encodeChunk(i,olderGroups[i][0],olderGroups[i][1],algorithm));
  const completion=await writer.encodeCompletion(chunks.length,writtenCounts(withoutReviews(counts)),chunks.map(c=>c.checksum),algorithm,descriptors);
  return writer.createV10Container(new Blob([JSON.stringify(olderManifest)+'\n',...chunks.map(c=>c.line+'\n'),JSON.stringify(completion)+'\n']),{compression:'none',assetBlobs:blobs});
}
const withoutReviews=value=>Object.fromEntries(Object.entries(value||{}).filter(([type])=>type!=='pendingReview'));
// Versions 21 and 22 were made only by unreleased builds: refused.
for(const version of [21,22])await assert.rejects(reader.inspectLegacy(await writeOlder(version,plan,[note])),/not supported by this build/u,`a v${version} file is refused`);
// A v20 file keeps notes and their deletion history under note names. Reading
// it gives each note, and each deletion, the id the live conversion gives that
// note, so older backups and this device agree on which note is which.
const namedNote={version:2,key:'ethics',label:'Ethics',text,updatedAt:stamp},v20Plan={...plan,noteItems:[namedNote],noteDeletions:[{key:'deleted note',deletedAt:stamp}]};
const v20File=await writeOlder(20,v20Plan,[namedNote]);
await assert.rejects(reader.inspectCurrent(v20File),/compatibility adapter/u,'a v20 file is not current');
const v20Parsed=await reader.inspectLegacy(v20File);
assert.equal(v20Parsed.formatVersion,20);
assert.deepEqual({...v20Parsed.data.notes},{[note.key]:note},'a name-keyed note takes the id the live conversion gives it');
assert.deepEqual(v20Parsed.protectedCheckpointManifest.noteDeletions,[{key:noteId('deleted note'),deletedAt:stamp}],'its deletion history takes ids too');
assert.deepEqual(v20Parsed.records,parsed.records,'everything else reads as current');
// A file that mixes the names fails closed: v20 with the current entity name.
const mixed=await (async()=>{const writer=registry.require('backup-codec',1).createBackupCodec(freeze({...codecInput,dataContract:freeze({...dataContract,schemas:freeze({...dataContract.schemas,Backup:freeze({...dataContract.schemas.Backup,version:20})})})}));const created=writer.createManifest(plan,{compression:'none',algorithm});const chunks=[];for(let i=0;i<groups.length;i++)chunks.push(await writer.encodeChunk(i,groups[i][0],groups[i][1],algorithm));const completion=await writer.encodeCompletion(chunks.length,counts,chunks.map(c=>c.checksum),algorithm,descriptors);return writer.createV10Container(new Blob([JSON.stringify(created)+'\n',...chunks.map(c=>c.line+'\n'),JSON.stringify(completion)+'\n']),{compression:'none',assetBlobs:blobs});})();
await assert.rejects(reader.inspectLegacy(mixed),'a v20 file written with current names is rejected');

console.log(JSON.stringify({status:'PASS',suite:'current-canonical-roundtrip',backupVersion:23,unreleasedVersionsRefused:true,nameKeyedV20NotesConverted:true,dailyRecordVersion:16,activeSessionVersion:10,logicalAttachments:4,uniquePayloads:3,encryptedRoundtrip:true,strictCurrentCodecs:true}));
