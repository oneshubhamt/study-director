import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createProcessingEngine} from '../../../portable/processing.ts';
import {passwordKey,transformEncrypted} from '../../../portable/stream-encryption.ts';
import {noteId} from '../../helpers/note-ids.mjs';
import {registry,Domain,RecordCodecs,freeze,boundedNumber,boundedInt,clampText,optionalText,optionalBoundedNumber,normalizeTimestamp,sameDataValue,helpers,limits,dataContract,dailyRecordCodec} from '../../helpers/current-codec-fixture.mjs';
import {richTextRuntimeSource} from '../../helpers/rich-text-runtime.mjs';
const activeSessionCodec=RecordCodecs.createActiveSessionCodec(freeze({limits,dataContract,activeSessionId:'current',domain:Domain,keyedRecord:freeze({create:()=>Object.create(null)}),dailyRecordCodec,
  helpers:freeze({boundedInt,boundedNumber,clampText,clampEditorContent:clampText,editorContentWithinLimits:()=>true,cleanDayRevision:v=>Math.max(0,Math.round(Number(v)||0)),sameDataValue,activeSessionScheduleFingerprint:()=> 'fp',isCanonicalScheduleText:v=>!!v,isValidIsoDate:Domain.TimeModel.isValidIsoDate,normalizeStudyQuality:helpers.normalizeStudyQuality,parseProgressNumber:Domain.CompletionModel.parseProgressNumber,sanitizePracticeState:()=>({active:false,runs:[]})}),
  timestamps:freeze({normalizeTimestamp,normalizeImportedTimestamp:normalizeTimestamp,normalizeImportedEpochMillis:(v,f=null)=>Number.isFinite(Number(v))?Number(v):f})}));
const processing=freeze({...createProcessingEngine(),scope:fn=>fn()}),personalDataCodec=RecordCodecs.createPersonalDataCodec(limits),attachments=registry.require('attachments',1);
const pendingReviewCodec=RecordCodecs.createPendingReviewCodec(freeze({dataContract,dailyRecordCodec,activeSessionCodec,personalDataCodec,helpers:freeze({sameDataValue,randomBytes:length=>crypto.getRandomValues(new Uint8Array(length))})}));
const defs=freeze({dailyRecord:{idField:'date',backupLimit:limits.maxImportRecords},note:{idField:'key',backupLimit:limits.maxNotes},activeSession:{idField:'id',backupLimit:1}});
const richSandbox={console,URL,TextEncoder,TextDecoder,setTimeout,clearTimeout,queueMicrotask};vm.createContext(richSandbox);vm.runInContext(richTextRuntimeSource(),richSandbox);
const rich=richSandbox.StudyDirectorRichText;
const codecInput=freeze({limits,dataContract,processing,personalDataCodec,pendingReviewCodec,dailyRecordCodec,activeSessionCodec,
  appConfig:freeze({appName:'Study Director',attribution:'Study Director'}),entityTypes:freeze(Object.keys(defs)),keyedRecord:freeze({create:()=>Object.create(null)}),entities:freeze({entityDefinition:t=>defs[t],entityIdentity:(t,v)=>v[defs[t].idField]}),helpers:freeze({boundedInt,jsonByteLength:v=>new TextEncoder().encode(typeof v==='string'?v:JSON.stringify(v)).length}),richText:freeze({assetIds:v=>rich.scanAttachmentReferences(v).assetIds,assetIdValid:attachments.validId,imageMimeTypeValid:attachments.validType})}),codec=registry.require('backup-codec',1).createBackupCodec(codecInput);
const stamp='2026-09-10T20:00:00.000Z',imageId='img-1234567890abcdefghijklmn';
const text='WG1:'+JSON.stringify({version:1,doc:{type:'Doc',content:[{type:'Paragraph',content:[{type:'Text',param:'Current note'}]},{type:'SDImage',param:{assetId:imageId,alt:'retained image',widthPct:100}}]}});
const study={version:16,recordKind:'study',date:'2026-09-10',savedAt:stamp,updatedAt:stamp,sourceRevision:9,quote:'',reflection:text,studyQuality:4,realTimeSnapshot:null,schedule:[],results:{},practiceRuns:[],carryForwardDraft:''};
const diary=dailyRecordCodec.createDiaryRecord('2026-09-09','Diary-only reflection',{savedAt:stamp,updatedAt:stamp});
assert.ok(dailyRecordCodec.sanitizeCurrentDailyRecord(study));assert.ok(diary);
// A Saved Day read as its view and handed back with its reflection changed is
// saved as its stored fields (a Diary edit of a saved study day failed with
// "New daily record failed its canonical validation"). A field the view does
// not have is still refused.
for(const record of [dailyRecordCodec.sanitizeCurrentDailyRecord(study),diary]){
  const later='WG1:'+JSON.stringify({version:1,doc:{type:'Doc',content:[{type:'Paragraph',content:[{type:'Text',param:'Edited later in the Diary'}]}]}});
  const view=dailyRecordCodec.materializeDailyRecordView(record),edited={...view,reflection:later};
  assert.ok(Object.keys(view).length>Object.keys(record).length,'the view adds worked-out fields');
  assert.equal(dailyRecordCodec.sanitizeCurrentDailyRecord(view),null,'a view is not a stored record');
  assert.deepEqual(dailyRecordCodec.storedDailyRecordFields(edited),{...record,reflection:later});
  assert.ok(dailyRecordCodec.sanitizeCurrentDailyRecord(dailyRecordCodec.storedDailyRecordFields(edited)));
  const unknown={...edited,notAField:1};
  assert.equal(dailyRecordCodec.storedDailyRecordFields(unknown),unknown,'an unknown field is left for validation to refuse');
  assert.equal(dailyRecordCodec.storedDailyRecordFields(record),record,'a stored record is unchanged');
}
const note={version:3,key:noteId('ethics'),label:'Ethics',text,updatedAt:stamp};assert.ok(dailyRecordCodec.sanitizeCurrentNote(note));
const coercedLink={toString:()=>noteId('linked'),toJSON:()=>noteId('linked')};
assert.equal(dailyRecordCodec.sanitizeCurrentNote({...note,links:[coercedLink]}),null,'note links must contain canonical string identities, not coercible objects');
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
assert.equal(parsed.formatVersion,24);assert.deepEqual(parsed.records,[dailyRecordCodec.sanitizeCurrentDailyRecord(study),diary]);assert.deepEqual(parsed.data.notes[note.key],note);assert.deepEqual(parsed.importedActiveSession,active);assert.deepEqual(parsed.importedPersonalData,personal);assert.deepEqual(parsed.assetDescriptors,descriptors);assert.equal(parsed.assetBytes,blobs.reduce((n,b)=>n+b.size,0));
for(let i=0;i<4;i++)assert.equal(await parsed.importedAssets[i].blob.text(),await blobs[i===3?1:i].text());
for(const key of ['savedDayDeletions','noteDeletions','attachmentDeletions'])assert.deepEqual(parsed.protectedCheckpointManifest[key],plan[key]);
const key=await passwordKey('Current format test passphrase'),sealed=[],opened=[];
await transformEncrypted(file,key,{write:async b=>sealed.push(b.slice())});await transformEncrypted(new Blob(sealed),key,{write:async b=>opened.push(b.slice())},{decrypt:true});assert.deepEqual(new Uint8Array(await new Blob(opened).arrayBuffer()),new Uint8Array(await file.arrayBuffer()));
const invalid=structuredClone(groups);invalid[2][1][0].unexpectedField=true;await assert.rejects(codec.inspectCurrent(await assemble(invalid)),/noncanonical dailyRecord/);
assert.equal(codec.normalizeRecord({...study,version:17}),null,'future data must fail closed');
const corrupted=new Uint8Array(await file.arrayBuffer());corrupted[corrupted.length-1]^=1;await assert.rejects(codec.inspectCurrent(new Blob([corrupted])),/integrity/);
await assert.rejects(codec.inspectCurrent(file.slice(0,-1)),/truncated/);

// Current readers reject unsupported envelopes without modifying their bytes.
for(const raw of ['[]',JSON.stringify({version:1,records:[]}),JSON.stringify({version:20,records:[]})]){
 const unsupported=new Blob([raw]);await assert.rejects(codec.inspectCurrent(unsupported),/retired|unsupported/);assert.equal(await unsupported.text(),raw);
}
assert.equal(codec.inspectLegacy,undefined);
console.log(JSON.stringify({status:'PASS',suite:'current-canonical-roundtrip',historicalFormatsRejected:true}));

for(const version of [1,7,10,20,21,22,dataContract.schemas.Backup.version+1]){
 const unsupported=await codec.createV10Container(new Blob([JSON.stringify({...parsed.manifest,version})+'\n']),{compression:'none',assetBlobs:[]});
 await assert.rejects(codec.inspectCurrent(unsupported),/unsupported|current canonical|newer/,'binary framing alone must not make an unsupported metadata version current');
}
