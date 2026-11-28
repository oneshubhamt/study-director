import assert from 'node:assert/strict';
import {createHarness} from '../repository-harness.mts';
import {method} from '../registered-exports.mts';
import {jsonArray,jsonObject} from './read-verification.mts';
import {noteId} from '../note-ids.mts';
import {dailyRecordCodec} from '../current-codec-fixture.mts';
const codec=dailyRecordCodec;
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
const legacyArea={version:1,key:'Optional',label:'Optional',text:'note',updatedAt,entityType:'areaNote',entityId:'Optional',schemaVersion:1,deviceId:'dev_r10',createdAt:savedAt,deleted:false,syncStatus:'pending'};
assert.equal(codec.sanitizeCurrentNote(legacyArea,'Optional'),null,'ordinary Note codec must reject the historical shape');
const area={version:3,key:noteId('optional'),label:'Optional',text:'note',updatedAt};
assert.ok(codec.sanitizeCurrentNote(area));
assert.equal(codec.sanitizeCurrentNote({...area,syncStatus:'pending'}),null);
const diary=codec.createDiaryRecord(date,'Diary only',{savedAt,updatedAt,sourceRevision:2});
assert.ok(diary,'diary-only record must validate');assert.equal(diary.recordKind,'diary');assert.deepEqual(Object.keys(diary).sort(),['date','recordKind','reflection','savedAt','sourceRevision','updatedAt','version'].sort());
assert.equal(codec.createDiaryRecord(date,'   ',{savedAt,updatedAt}),null,'empty diary-only records must not exist canonically');
assert.equal(codec.createDiaryRecord('2026-09-18','future',{savedAt,updatedAt}),null,'future diary entries must be rejected');
const diarySummary=codec.buildDailyRecordSummary(diary);assert.ok(diarySummary);assert.equal(diarySummary.recordKind,'diary');assert.equal(diarySummary.hasReflection,true);assert.equal(diarySummary.plannedMinutes,null);
// Exercise the repository and the real strict codec together. Display-only
// fields must survive sorted/window reads without being fed back to the writer.
const earlier={...current,date:'2026-09-09',sourceRevision:8};
const storedDiary={...diary,date:'2026-09-08'};
const stores={area:new Map<string,unknown>(),sync:new Map<string,unknown>(),tombstones:new Map<string,unknown>(),reflection:new Map<string,unknown>(),daily:new Map<string,unknown>([[current.date,current],[earlier.date,earlier],[storedDiary.date,storedDiary]]),summary:new Map<string,unknown>(),session:new Map<string,unknown>(),meta:new Map<string,unknown>()};
const {app}=createHarness(new Map<string,unknown>(),stores,{dailyRecordCodec:codec});
const records=jsonObject(app)['dailyRecords'];
const readRows=(value:unknown)=>Array.from(jsonArray(value),jsonObject);
const sortedList=()=>method(records,'sortedList')();
const windowRows=async(options:{from?:string;to?:string;limit?:number;yieldProjection?:boolean})=>readRows(await method(records,'window')(options));
const snapshot=async()=>jsonObject(await method(records,'insightsSnapshot')({yieldProjection:true}));
assert.deepEqual(readRows(await sortedList()).map(row=>row['date']),['2026-09-08','2026-09-09','2026-09-10']);
for(const options of [{},{from:'2026-09-09',to:'2026-09-10'},{limit:1}]){
  const rows=await windowRows(options);
  assert.deepEqual(Array.from(rows,row=>row['date']),options.limit?['2026-09-10']:['2026-09-09','2026-09-10']);
  for(const row of rows){assert.equal(row['recordKind'],'study');assert.ok(Array.isArray(row['tasks']));assert.equal(codec.sanitizeCurrentDailyRecord(row),null,'read projections must not become canonical write input');}
}
const chunked=await windowRows({yieldProjection:true});
assert.deepEqual(Array.from(chunked,row=>row['date']),['2026-09-09','2026-09-10'],'chunked Insights projection must preserve the same study-record window and ordering');
for(const row of chunked)assert.ok(Array.isArray(row['tasks']),'chunked projection must preserve the ordinary materialized Daily Record view');
const insightSnapshot=await snapshot(),ordinaryStudySummaries=readRows(await method(records,'sortedSummaries')()).filter(row=>row['recordKind']==='study');
assert.deepEqual(readRows(insightSnapshot['records']).map(row=>row['date']),['2026-09-09','2026-09-10'],'atomic Insights snapshot must preserve the ordinary study-record projection');
assert.deepEqual(readRows(insightSnapshot['summaries']).filter(row=>row['recordKind']==='study').map(row=>row['date']),Array.from(ordinaryStudySummaries,row=>row['date']),'atomic Insights snapshot must preserve the same study-summary basis consumed by the ordinary Insights reader');
assert.deepEqual(stores.daily.get(current.date),current,'reading Insights must leave canonical data untouched');
assert.equal(codec.sanitizeDailyRecordSummary({...diarySummary,outcomeCounts:{...diarySummary.outcomeCounts,full:1}}),null,'diary summaries must reject study outcome counts');

console.log(JSON.stringify({status:'PASS',suite:'canonical-schema-separation',dailyRecordVersion:16,noteVersion:3,localRevisionsPreserved:true,distributedSyncFieldsRejected:true},null,2));
