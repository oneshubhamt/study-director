import assert from 'node:assert/strict';
import {createHarness} from '../../helpers/repository-harness.mjs';
import {noteId,legacyNoteKey} from '../../helpers/note-ids.mjs';
import {registry,Domain,RecordCodecs,CompatibilityCodecs,freeze,boundedNumber,boundedInt,clampText,optionalText,optionalBoundedNumber,normalizeTimestamp,sameDataValue,helpers,limits,dataContract,dailyRecordCodec} from '../../helpers/current-codec-fixture.mjs';
const codec=dailyRecordCodec;
const currentActiveSession=freeze({normalize:value=>value&&typeof value==='object'?freeze({...value,version:10}):null,sanitizeCurrent:value=>value&&Number(value.version)===10?freeze({...value}):null,sanitizeSessionSnapshot:value=>value||null});
const personalDataCodec=freeze({normalize:value=>value});
const compatibility=CompatibilityCodecs.create(freeze({
  limits,dataContract,keyedRecord:freeze({create:()=>Object.create(null)}),dailyRecordCodec:codec,activeSessionCodec:currentActiveSession,personalDataCodec,
  helpers:freeze({boundedInt,boundedNumber,optionalBoundedNumber,optionalText,clampText,clampEditorContent:clampText,editorContentWithinLimits:()=>true,sameDataValue,sanitizePracticeRun:helpers.sanitizePracticeRun,activeSessionScheduleFingerprint:()=> 'fp',isValidIsoDate:value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value)),isCanonicalScheduleText:()=>true}),
  timestamps:freeze({normalizeTimestamp,normalizeImportedTimestamp:normalizeTimestamp}),domain:Domain,installationId:()=>'inst_schema_device'
}));

const date='2026-09-10',savedAt='2026-09-10T20:00:00.000Z',updatedAt='2026-09-10T20:01:00.000Z';
const current={version:16,recordKind:'study',date,savedAt,updatedAt,sourceRevision:9,quote:'',reflection:'kept',studyQuality:4,realTimeSnapshot:null,schedule:[],results:{},practiceRuns:[],carryForwardDraft:''};
const clean=codec.sanitizeCurrentDailyRecord(current);
assert.ok(clean,'lean DailyRecord.v16 study record must validate');
assert.equal(clean.sourceRevision,9);
assert.equal(clean.updatedAt,updatedAt);
for(const key of ['entityType','entityId','schemaVersion','deviceId','createdAt','deleted','syncStatus'])assert.equal(Object.hasOwn(clean,key),false);
assert.equal(codec.sanitizeCurrentDailyRecord({...current,deviceId:'dev_nope'}),null,'current writer must reject embedded replication metadata');

const legacy={...current,version:14,entityType:'dailyRecord',entityId:date,schemaVersion:14,deviceId:'dev_r10',createdAt:savedAt,deleted:false,syncStatus:'pending'};
assert.equal(codec.sanitizeCurrentDailyRecord(legacy),null,'ordinary DailyRecord codec must reject the historical shape');
const migrated=compatibility.dailyRecord(legacy);
assert.ok(migrated,'Historical DailyRecord.v14 must remain readable through compatibility');
assert.equal(migrated.version,16);
assert.equal(migrated.recordKind,'study');
assert.equal(migrated.sourceRevision,9,'local source revision must survive migration');
assert.equal(migrated.updatedAt,updatedAt,'local modification timestamp must survive migration');
for(const key of ['entityType','entityId','schemaVersion','deviceId','createdAt','deleted','syncStatus'])assert.equal(Object.hasOwn(migrated,key),false,`retired field ${key} must be removed from DailyRecord.v16`);

const legacyArea={version:1,key:'Optional',label:'Optional',text:'note',updatedAt,entityType:'areaNote',entityId:'Optional',schemaVersion:1,deviceId:'dev_r10',createdAt:savedAt,deleted:false,syncStatus:'pending'};
assert.equal(codec.sanitizeCurrentNote(legacyArea,'Optional'),null,'ordinary Note codec must reject the historical shape');
const area=compatibility.note(legacyArea,'Optional');
assert.deepEqual(area,{version:3,key:noteId('optional'),label:'Optional',text:'note',updatedAt});
assert.ok(codec.sanitizeCurrentNote(area));
assert.equal(codec.sanitizeCurrentNote({...area,syncStatus:'pending'}),null,'Note.v3 must reject replication fields');
// A name-keyed AreaNote.v2 row takes the id worked out from its name (FNV-1a,
// 64 bits, over the UTF-8 name), so every device and every older backup
// converts the same note to the same id. An id passes through unchanged.
const named={version:2,key:'gs2 > polity',label:'GS2 > Polity',text:'note',updatedAt};
assert.equal(codec.sanitizeCurrentNote(named),null,'AreaNote.v2 is no longer current');
assert.deepEqual(compatibility.note(named),{version:3,key:noteId('gs2 > polity'),label:'GS2 > Polity',text:'note',updatedAt});
assert.equal(compatibility.noteKey('a'),'n_af63dc4c8601ec8c','the id is FNV-1a 64 over the UTF-8 name');
assert.equal(compatibility.noteKey('GS2  >  Polity'),noteId('gs2 > polity'),'differently written forms of one name give one id');
assert.equal(compatibility.noteKey('~deleted 0001'),legacyNoteKey('~deleted 0001'),'an old trash key keeps the trash prefix');
assert.equal(compatibility.noteKey(area.key),area.key,'an id is already current');
assert.equal(codec.sanitizeCurrentNote({...area,key:'optional'}),null,'a current note is keyed by id, never by name');

const legacyV15={...current,version:15};delete legacyV15.recordKind;
const migratedV15=compatibility.dailyRecord(legacyV15);
assert.ok(migratedV15,'DailyRecord.v15 must migrate to v16');
assert.equal(migratedV15.version,16);assert.equal(migratedV15.recordKind,'study');
const diary=codec.createDiaryRecord(date,'Diary only',{savedAt,updatedAt,sourceRevision:2});
assert.ok(diary,'diary-only record must validate');assert.equal(diary.recordKind,'diary');assert.deepEqual(Object.keys(diary).sort(),['date','recordKind','reflection','savedAt','sourceRevision','updatedAt','version'].sort());
assert.equal(codec.createDiaryRecord(date,'   ',{savedAt,updatedAt}),null,'empty diary-only records must not exist canonically');
assert.equal(codec.createDiaryRecord('2026-09-18','future',{savedAt,updatedAt}),null,'future diary entries must be rejected');
const diarySummary=codec.buildDailyRecordSummary(diary);assert.equal(diarySummary.recordKind,'diary');assert.equal(diarySummary.hasReflection,true);assert.equal(diarySummary.plannedMinutes,null);
// Exercise the repository and the real strict codec together. Display-only
// fields must survive sorted/window reads without being fed back to the writer.
const earlier={...current,date:'2026-09-09',sourceRevision:8};
const storedDiary={...diary,date:'2026-09-08'};
const stores={area:new Map(),sync:new Map(),tombstones:new Map(),reflection:new Map(),daily:new Map([[current.date,current],[earlier.date,earlier],[storedDiary.date,storedDiary]]),summary:new Map(),session:new Map(),meta:new Map()};
const {app}=createHarness(new Map(),stores,{dailyRecordCodec:codec});
assert.deepEqual(Array.from(await app.dailyRecords.sortedList(),row=>row.date),['2026-09-08','2026-09-09','2026-09-10']);
for(const options of [{},{from:'2026-09-09',to:'2026-09-10'},{limit:1}]){
  const rows=await app.dailyRecords.window(options);
  assert.deepEqual(Array.from(rows,row=>row.date),options.limit?['2026-09-10']:['2026-09-09','2026-09-10']);
  for(const row of rows){assert.equal(row.recordKind,'study');assert.ok(Array.isArray(row.tasks));assert.equal(codec.sanitizeCurrentDailyRecord(row),null,'read projections must not become canonical write input');}
}
const chunked=await app.dailyRecords.window({yieldProjection:true});
assert.deepEqual(Array.from(chunked,row=>row.date),['2026-09-09','2026-09-10'],'chunked Insights projection must preserve the same study-record window and ordering');
for(const row of chunked)assert.ok(Array.isArray(row.tasks),'chunked projection must preserve the ordinary materialized Daily Record view');
const insightSnapshot=await app.dailyRecords.insightsSnapshot({yieldProjection:true}),ordinaryStudySummaries=(await app.dailyRecords.sortedSummaries()).filter(row=>row.recordKind==='study');
assert.deepEqual(Array.from(insightSnapshot.records,row=>row.date),['2026-09-09','2026-09-10'],'atomic Insights snapshot must preserve the ordinary study-record projection');
assert.deepEqual(Array.from(insightSnapshot.summaries.filter(row=>row.recordKind==='study'),row=>row.date),Array.from(ordinaryStudySummaries,row=>row.date),'atomic Insights snapshot must preserve the same study-summary basis consumed by the ordinary Insights reader');
assert.deepEqual(stores.daily.get(current.date),current,'reading Insights must leave canonical data untouched');
assert.equal(codec.sanitizeDailyRecordSummary({...diarySummary,outcomeCounts:{...diarySummary.outcomeCounts,full:1}}),null,'diary summaries must reject study outcome counts');

console.log(JSON.stringify({status:'PASS',suite:'canonical-schema-separation',dailyRecordVersion:16,noteVersion:3,localRevisionsPreserved:true,distributedSyncFieldsRejected:true},null,2));
