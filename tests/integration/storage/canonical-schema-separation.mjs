import assert from 'node:assert/strict';
import {createHarness} from '../../helpers/repository-harness.mjs';
import {registry,Domain,RecordCodecs,CompatibilityCodecs,freeze,boundedNumber,boundedInt,clampText,optionalText,optionalBoundedNumber,normalizeTimestamp,sameDataValue,helpers,limits,dataContract,dailyRecordCodec} from '../../helpers/current-codec-fixture.mjs';
const codec=dailyRecordCodec;
const currentActiveSession=freeze({normalize:value=>value&&typeof value==='object'?freeze({...value,version:9}):null,sanitizeCurrent:value=>value&&Number(value.version)===9?freeze({...value}):null,sanitizeSessionSnapshot:value=>value||null});
const personalDataCodec=freeze({normalize:value=>value});
const compatibility=CompatibilityCodecs.create(freeze({
  limits,dataContract,keyedRecord:freeze({create:()=>Object.create(null)}),dailyRecordCodec:codec,activeSessionCodec:currentActiveSession,personalDataCodec,
  helpers:freeze({boundedInt,boundedNumber,optionalBoundedNumber,optionalText,clampText,clampEditorContent:clampText,editorContentWithinLimits:()=>true,sameDataValue,sanitizePracticeRun:helpers.sanitizePracticeRun,activeSessionScheduleFingerprint:()=> 'fp',isValidIsoDate:value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value)),isCanonicalScheduleText:()=>true}),
  timestamps:freeze({normalizeTimestamp,normalizeImportedTimestamp:normalizeTimestamp}),domain:Domain
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
assert.equal(codec.sanitizeCurrentAreaNote(legacyArea,'Optional'),null,'ordinary AreaNote codec must reject the historical shape');
const area=compatibility.areaNote(legacyArea,'Optional');
assert.deepEqual(area,{version:2,key:'optional',label:'Optional',text:'note',updatedAt});
assert.ok(codec.sanitizeCurrentAreaNote(area));
assert.equal(codec.sanitizeCurrentAreaNote({...area,syncStatus:'pending'}),null,'AreaNote.v2 must reject replication fields');

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
assert.deepEqual(stores.daily.get(current.date),current,'reading Insights must leave canonical data untouched');
assert.equal(codec.sanitizeDailyRecordSummary({...diarySummary,outcomeCounts:{...diarySummary.outcomeCounts,full:1}}),null,'diary summaries must reject study outcome counts');

console.log(JSON.stringify({status:'PASS',suite:'canonical-schema-separation',dailyRecordVersion:16,areaNoteVersion:2,localRevisionsPreserved:true,distributedSyncFieldsRejected:true},null,2));
