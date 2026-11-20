import type {TaskOutcome} from '../../types/domain.ts';
import type {InsightRecord,InsightSummary,InsightsBuildOptions,InsightsResult} from './insights-model.ts';

const INSIGHTS_RECORDS_PER_MESSAGE=150;
const INSIGHTS_MAX_RETAINED_RECORDS=50000;
const INSIGHTS_MAX_PARTS=Math.ceil(INSIGHTS_MAX_RETAINED_RECORDS/INSIGHTS_RECORDS_PER_MESSAGE);

export type InsightsWireModel=Omit<InsightsResult,'getLabEvidence'>;
export type InsightsWindowRequest=Readonly<{all:true}|{indices:readonly number[]}>;
export type InsightsRecordsMessage=Readonly<{
  type:'SD_INSIGHTS_RECORDS';requestId:number;revision:string;part:number;parts:number;records:readonly InsightRecord[];
}>;
export type InsightsBuildMessage=Readonly<{
  type:'SD_INSIGHTS_BUILD';id:number;revision:string;window:InsightsWindowRequest;options:InsightsBuildOptions;
}>;
export type InsightsWorkerRequest=InsightsRecordsMessage|InsightsBuildMessage;
export type InsightsResultMessage=Readonly<{
  type:'SD_INSIGHTS_RESULT';id:number;revision:string;model:InsightsWireModel;computeMs:number;
}>;
export type InsightsErrorMessage=Readonly<{
  type:'SD_INSIGHTS_ERROR';id:number;revision:string;message:string;
}>;
export type InsightsWorkerResponse=InsightsResultMessage|InsightsErrorMessage;
export type InsightsDecode<T>=Readonly<{ok:true;message:T}|{ok:false;id:number|null;revision:string;message:string}>;

function object(value:unknown):value is Record<string,unknown>{
  return !!value&&typeof value==='object'&&!Array.isArray(value);
}
function requestId(value:unknown):value is number{
  return typeof value==='number'&&Number.isSafeInteger(value)&&value>0;
}
function revision(value:unknown):value is string{
  return typeof value==='string'&&value.length>0&&value.length<=256;
}
function finite(value:unknown):value is number{
  return typeof value==='number'&&Number.isFinite(value);
}
function nullableString(value:unknown):value is string|null|undefined{
  return value===undefined||value===null||typeof value==='string';
}
function optionalFinite(value:unknown):value is number|null|undefined{
  return value===undefined||value===null||finite(value);
}
function insightRecord(value:unknown):value is InsightRecord{
  return object(value)&&typeof value['date']==='string'
    &&['tasks','originalSchedule','practiceRuns'].every(key=>value[key]===undefined||(Array.isArray(value[key])&&value[key].every(object)));
}
const outcomes=Object.freeze({full:true,partial:true,skipped:true,untouched:true,'finished-unverified':true,'zero-output':true} satisfies Record<TaskOutcome,true>);
function transferredRecord(value:unknown):value is InsightRecord{
  if(!insightRecord(value))return false;
  for(const task of value.tasks??[]){
    if(!task||typeof task.__sdOutcome!=='string'||!Object.hasOwn(outcomes,task.__sdOutcome))return false;
  }
  return true;
}
function insightSummary(value:unknown):value is InsightSummary{
  return object(value)&&typeof value['date']==='string';
}
function summaries(value:unknown):value is readonly InsightSummary[]|undefined{
  return value===undefined||(Array.isArray(value)&&value.every(insightSummary));
}
function records(value:unknown):value is readonly InsightRecord[]|undefined{
  return value===undefined||(Array.isArray(value)&&value.every(insightRecord));
}
function buildOptions(value:unknown):value is InsightsBuildOptions{
  if(!object(value))return false;
  return nullableString(value['currentStudyDate'])&&summaries(value['subjectReferenceSummaries'])&&nullableString(value['subjectReferenceRevision'])
    &&summaries(value['streakSummaries'])&&nullableString(value['windowKey'])&&optionalFinite(value['windowDays'])&&nullableString(value['windowTo'])
    &&nullableString(value['windowLabel'])&&optionalFinite(value['allRecordCount'])&&records(value['modelRecords']);
}
function windowRequest(value:unknown):value is InsightsWindowRequest{
  if(!object(value))return false;
  if(value['all']===true)return Object.keys(value).every(key=>key==='all');
  if(!Array.isArray(value['indices'])||value['indices'].length>INSIGHTS_MAX_RETAINED_RECORDS)return false;
  if(!Object.keys(value).every(key=>key==='indices'))return false;
  let previous=-1;
  for(const index of value['indices']){
    if(typeof index!=='number'||!Number.isSafeInteger(index)||index<=previous)return false;
    previous=index;
  }
  return true;
}
function failure(value:unknown,message:string):InsightsDecode<never>{
  const row=object(value)?value:{};
  return Object.freeze({
    ok:false,
    id:requestId(row['id'])?row['id']:requestId(row['requestId'])?row['requestId']:null,
    revision:revision(row['revision'])?row['revision']:'',
    message
  });
}
function decodeWorkerRequest(value:unknown):InsightsDecode<InsightsWorkerRequest>{
  if(!object(value))return failure(value,'Insights worker request must be an object.');
  if(value['type']==='SD_INSIGHTS_RECORDS'){
    if(!requestId(value['requestId'])||!revision(value['revision']))return failure(value,'Insights record-transfer identity is invalid.');
    if(!Number.isSafeInteger(value['parts'])||Number(value['parts'])<1||Number(value['parts'])>INSIGHTS_MAX_PARTS)return failure(value,'Insights record-transfer part count is invalid.');
    if(!Number.isSafeInteger(value['part'])||Number(value['part'])<0||Number(value['part'])>=Number(value['parts']))return failure(value,'Insights record-transfer part index is invalid.');
    if(!Array.isArray(value['records'])||value['records'].length>INSIGHTS_RECORDS_PER_MESSAGE||!Array.from(value['records']).every(transferredRecord))return failure(value,'Insights record-transfer payload is invalid.');
    return Object.freeze({ok:true,message:Object.freeze({
      type:'SD_INSIGHTS_RECORDS',requestId:value['requestId'],revision:value['revision'],part:Number(value['part']),parts:Number(value['parts']),records:value['records']
    })});
  }
  if(value['type']==='SD_INSIGHTS_BUILD'){
    if(!requestId(value['id'])||!revision(value['revision'])||!windowRequest(value['window'])||!buildOptions(value['options']))return failure(value,'Insights build request is invalid.');
    return Object.freeze({ok:true,message:Object.freeze({
      type:'SD_INSIGHTS_BUILD',id:value['id'],revision:value['revision'],window:value['window'],options:value['options']
    })});
  }
  return failure(value,'Unsupported Insights worker request.');
}
// Validate the report envelope before handing it to the renderer. Keep this
// bounded by the number of fields even for maximum-size histories.
const count=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
const label=(value:unknown)=>typeof value==='string';
const wireFields=Object.entries({
  version:label,windowDays:(v:unknown)=>v===null||count(v),windowKey:label,windowLabel:label,
  allRecordCount:count,recordCount:count,taskCount:count,currentStudyDate:label,trendBasis:object,
  dateRange:object,calendarRange:object,daily:Array.isArray,overview:object,streak:object,
  subjects:Array.isArray,startDelays:Array.isArray,blockOrder:Array.isArray,interruption:object,
  frictionSources:Array.isArray,completionSources:Array.isArray,progressEvidence:object,outcomes:object,
  qualityEvidence:Array.isArray,sampleAudit:object,support:object,fixed:object,resourceMix:Array.isArray,
  practice:object,schedule:object,advanced:object,dynamics:object,fitness:object,guardrails:object,
  milestones:Array.isArray,interpretation:object
} satisfies Record<keyof InsightsWireModel,(value:unknown)=>boolean>);
function wireModel(value:unknown):value is InsightsWireModel{
  if(!object(value)||Object.hasOwn(value,'getLabEvidence')||!wireFields.every(([key,check])=>check(value[key])))return false;
  const overview=value['overview'],interpretation=value['interpretation'];
  return object(overview)&&['eligibleDays','ratedEligibleDays','strongDays'].every(key=>count(overview[key]))
    &&object(interpretation)&&object(interpretation['signals']);
}
function decodeWorkerResponse(value:unknown):InsightsDecode<InsightsWorkerResponse>{
  if(!object(value))return failure(value,'Insights worker response must be an object.');
  if(value['type']==='SD_INSIGHTS_RESULT'){
    if(!requestId(value['id'])||!revision(value['revision'])||!wireModel(value['model'])||!finite(value['computeMs'])||value['computeMs']<0)return failure(value,'Insights result response is invalid.');
    return Object.freeze({ok:true,message:Object.freeze({
      type:'SD_INSIGHTS_RESULT',id:value['id'],revision:value['revision'],model:value['model'],computeMs:value['computeMs']
    })});
  }
  if(value['type']==='SD_INSIGHTS_ERROR'){
    if(!requestId(value['id'])||!revision(value['revision'])||typeof value['message']!=='string'||!value['message'])return failure(value,'Insights error response is invalid.');
    return Object.freeze({ok:true,message:Object.freeze({
      type:'SD_INSIGHTS_ERROR',id:value['id'],revision:value['revision'],message:value['message'].slice(0,1000)
    })});
  }
  return failure(value,'Unsupported Insights worker response.');
}

const InsightsProtocol=Object.freeze({
  format:'study-director.insights-worker-protocol',
  version:1,
  recordsPerMessage:INSIGHTS_RECORDS_PER_MESSAGE,
  maxRetainedRecords:INSIGHTS_MAX_RETAINED_RECORDS,
  maxParts:INSIGHTS_MAX_PARTS,
  decodeWorkerRequest,
  decodeWorkerResponse
});
Object.defineProperty(globalThis,'StudyDirectorInsightsProtocol',{value:InsightsProtocol,writable:false,configurable:true});
export type InsightsProtocolRuntime=typeof InsightsProtocol;
