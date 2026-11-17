import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {RepositoriesModule} from './repositories.ts';
import type {RecordCodecsModule} from './record-codecs.ts';
import type {NoticeCoordinator} from './notice-coordinator.ts';
import type {InsightsEngineDependencies} from '../external/insights-model.ts';

type AppData=ReturnType<RepositoriesModule['createAppData']>;
type DailyRecords=AppData['dailyRecords'];
type DailyRecordCodec=ReturnType<RecordCodecsModule['createDailyRecordCodec']>;
type DailyRecordView=NonNullable<ReturnType<DailyRecordCodec['materializeDailyRecordView']>>;
type StudyRecordView=Extract<DailyRecordView,{recordKind:'study'}>;
type DailySummaryView=NonNullable<ReturnType<DailyRecordCodec['materializeDailyRecordSummary']>>;
type DailyWindowOptions=NonNullable<Parameters<DailyRecords['window']>[0]>;
type InsightNotifications=ReturnType<NoticeCoordinator['presentation']>;
type PreviewTarget='insights';
export type InsightsPreviewProvider=(options:Readonly<{today:string}>)=>readonly unknown[];
type PreviewProvider=InsightsPreviewProvider;
type PreviewStatus=Readonly<{
  type:'demo'|'real';target:PreviewTarget;available:boolean;label:string;mode:'preview'|'saved';revision:string;
}>;
type PreviewState=Readonly<{target:PreviewTarget;label:string;revision:number;records:readonly StudyRecordView[]}>;
export interface InsightsDeviceStateInput {
  readWindow(fallback:string):unknown;
  writeWindow(value:string):unknown;
}
export interface InsightsPreloadInput {
  readonly document:Document;
  setTimer(callback:()=>void,delayMs:number):unknown;
  readonly scheduleIdle:((callback:()=>void,timeoutMs:number)=>unknown)|null;
  requestTab():Promise<unknown>;
}
export interface InsightsHostInput {
  readonly dailyRecords:Pick<DailyRecords,'normalizeWindow'|'insightsSnapshot'|'sortedSummaries'|'window'|'datasetRevision'>;
  readonly dailyRecordCodec:Pick<DailyRecordCodec,'materializeDailyRecordView'|'buildDailyRecordSummary'|'sanitizeDailyRecordSummary'>;
  readonly notifications:InsightNotifications;
  readonly logic:Readonly<InsightsEngineDependencies>;
  requestProviderTab(tab:'guide'):Promise<unknown>;
  capture(scope:string,error:unknown):unknown;
  todayISO():string;
  clampText(value:unknown,max:number):string;
}
const sdInsightsHostFactory=(()=>{
'use strict';
const registry=(globalThis as unknown as Record<symbol,unknown>)[Symbol.for('studyDirector.internalModules.v1')] as ModuleRegistration<'insights-host','study-director.insights-host-module'>|undefined;
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1)throw new Error('Study Director internal module registry is unavailable or incompatible.');
const {exactFrozenObject,functionPort}=registry.contracts,freeze=Object.freeze;
const PREVIEW_SAMPLE_DAYS=28;
const ISO_DATE=/^\d{4}-\d{2}-\d{2}$/u;
function isIsoDate(value:unknown):value is string{
  if(typeof value!=='string'||!ISO_DATE.test(value))return false;
  const parsed=new Date(value+'T00:00:00Z');
  return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
}
function createDeviceState(input:Readonly<InsightsDeviceStateInput>){
  exactFrozenObject(input,['readWindow','writeWindow'],'Insights device-state input');
  functionPort(input,['readWindow','writeWindow'],'Insights device-state adapters');
  return freeze({
    readInsightsWindow:(fallback:unknown='')=>input.readWindow(String(fallback??'')),
    writeInsightsWindow:(value:unknown='')=>input.writeWindow(String(value??''))
  });
}
function createPreloadScheduler(input:Readonly<InsightsPreloadInput>){
  exactFrozenObject(input,['document','setTimer','scheduleIdle','requestTab'],'Insights preload input');
  if(typeof input.setTimer!=='function'||typeof input.requestTab!=='function')throw new TypeError('Insights preload adapters must be functions.');
  if(input.scheduleIdle!==null&&typeof input.scheduleIdle!=='function')throw new TypeError('Insights idle scheduler must be a function or null.');
  const schedule=()=>input.setTimer(()=>{
    const load=()=>{
      if(input.document.visibilityState==='hidden'){
        input.document.addEventListener('visibilitychange',load,{once:true});
        return;
      }
      void input.requestTab();
    };
    if(input.scheduleIdle)input.scheduleIdle(load,10000);
    else load();
  },4000);
  return freeze({schedule});
}
function createBoundary(input:Readonly<InsightsHostInput>){
  exactFrozenObject(input,['dailyRecords','dailyRecordCodec','notifications','logic','requestProviderTab','capture','todayISO','clampText'],'Insights host input');
  functionPort(input.logic,['classifyTaskOutcome','summarizePracticeRuns'],'Insights logic adapters');
  if(!Object.isFrozen(input.dailyRecords)||!Object.isFrozen(input.dailyRecordCodec)||!Object.isFrozen(input.notifications))throw new TypeError('Insights host providers must be frozen.');
  const providers=new Map<PreviewTarget,PreviewProvider>();
  let preview:PreviewState|null=null,sourceRevision=0,requestRevision=0;
  const normalizeTarget=(_value:unknown):PreviewTarget=>'insights';
  const targetKey=(value:unknown)=>String(value||'').trim().toLowerCase();
  const active=(target:unknown)=>!!preview&&preview.target===targetKey(target);
  const normalizeRecords=(value:unknown):readonly StudyRecordView[]=>{
    const source=Array.isArray(value)?value.slice(0,PREVIEW_SAMPLE_DAYS):[],records:StudyRecordView[]=[];
    for(const raw of source){
      const record=input.dailyRecordCodec.materializeDailyRecordView(raw);
      if(record?.recordKind==='study'&&isIsoDate(record.date))records.push(record);
    }
    records.sort((a,b)=>a.date.localeCompare(b.date));
    return freeze(records);
  };
  const status=(target:unknown='insights'):PreviewStatus=>{
    const clean=normalizeTarget(target);
    if(preview&&preview.target===clean)return freeze({type:'demo',target:clean,available:true,label:preview.label,mode:'preview',revision:`preview:${preview.revision}`});
    return freeze({type:'real',target:clean,available:false,label:'Saved data',mode:'saved',revision:`saved:${sourceRevision}`});
  };
  const summaries=(records:readonly StudyRecordView[]):readonly DailySummaryView[]=>freeze(records.map(record=>{
    const raw=input.dailyRecordCodec.buildDailyRecordSummary(record);
    return input.dailyRecordCodec.sanitizeDailyRecordSummary(raw);
  }).filter((row):row is DailySummaryView=>row!==null).sort((a,b)=>a.date.localeCompare(b.date)));
  const applyWindow=(records:readonly StudyRecordView[],options:DailyWindowOptions={})=>{
    const recordWindow=input.dailyRecords.normalizeWindow(options,summaries(records));
    const dates=new Set(recordWindow.dates);
    return freeze(records.filter(record=>dates.has(record.date)));
  };
  const setRecords=(records:unknown,options:Readonly<{target?:unknown;label?:unknown}>={})=>{
    requestRevision+=1;sourceRevision+=1;
    const target=normalizeTarget(options.target),normalized=normalizeRecords(records);
    preview=freeze({target,label:input.clampText(options.label||`Sample ${normalized.length} days`,80)||'Sample data',revision:sourceRevision,records:normalized});
    return status(target);
  };
  const registerProvider=(target:unknown,provider:PreviewProvider)=>{
    const clean=normalizeTarget(target);
    if(typeof provider!=='function')return false;
    providers.set(clean,provider);return true;
  };
  const useSample=async(targetInput:unknown='insights',options:Readonly<{today?:unknown;label?:unknown}>={})=>{
    const target=normalizeTarget(targetInput),request=++requestRevision,sourceAtStart=sourceRevision;
    let provider=providers.get(target);
    if(!provider){
      await input.requestProviderTab('guide');
      if(request!==requestRevision||sourceRevision!==sourceAtStart)return freeze({ok:false,status:status(target),reason:'superseded'});
      provider=providers.get(target);
    }
    if(!provider)return freeze({ok:false,status:status(target),reason:'provider-unavailable'});
    try{
      const records=provider({today:isIsoDate(options.today)?options.today:input.todayISO()});
      if(request!==requestRevision||sourceRevision!==sourceAtStart)return freeze({ok:false,status:status(target),reason:'superseded'});
      const normalized=normalizeRecords(records);
      if(normalized.length!==PREVIEW_SAMPLE_DAYS)throw new Error(`Expected ${PREVIEW_SAMPLE_DAYS} sample records.`);
      const next=setRecords(normalized,{target,label:options.label||`Sample ${PREVIEW_SAMPLE_DAYS} days`});
      return freeze({ok:true,status:next});
    }catch(error){
      input.capture('preview.sample-provider',error);
      return freeze({ok:false,status:status(target),reason:'provider-failed'});
    }
  };
  const clear=(targetInput:unknown='')=>{
    requestRevision+=1;
    if(!targetInput||active(targetInput)){
      if(preview){sourceRevision+=1;preview=null;}
    }
    return status('insights');
  };
  const clearExcept=(target:unknown)=>{
    requestRevision+=1;
    if(preview&&preview.target!==targetKey(target)){sourceRevision+=1;preview=null;}
    return status('insights');
  };
  const previewRuntime=freeze({status,setRecords,registerProvider,useSample,clear,clearExcept,records:(target:unknown='insights')=>active(target)?preview!.records:null});
  const dataSource=freeze({
    async getDailySnapshot(){
      const records=previewRuntime.records('insights');
      if(records)return freeze({summaries:summaries(records),records});
      const snapshot=await input.dailyRecords.insightsSnapshot({yieldProjection:true});
      return freeze({summaries:freeze(snapshot.summaries.filter(summary=>summary?.recordKind==='study')),records:freeze(snapshot.records.filter(record=>record?.recordKind==='study'))});
    },
    async getDailySummaries(){
      const records=previewRuntime.records('insights');
      if(records)return summaries(records);
      return freeze((await input.dailyRecords.sortedSummaries()).filter(summary=>summary?.recordKind==='study'));
    },
    async getDailyRecords(options:DailyWindowOptions={}){
      const records=previewRuntime.records('insights');
      return records?applyWindow(records,options):input.dailyRecords.window({...options,yieldProjection:true});
    },
    getRecordSource(){return status('insights');},
    async getDatasetRevision(){
      const source=status('insights');
      if(source.type==='demo')return source.revision;
      const revision=await input.dailyRecords.datasetRevision();
      return revision===null?null:`${source.revision}:${revision}`;
    },
    getCurrentStudyDate(){return input.todayISO();}
  });
  const appInsights=freeze({notifications:input.notifications,dataSource});
  const logic=freeze({classifyTaskOutcome:input.logic.classifyTaskOutcome,summarizePracticeRuns:input.logic.summarizePracticeRuns});
  return freeze({format:'study-director.insights-host',contractVersion:1,preview:previewRuntime,appInsights,logic});
}
const module=freeze({format:'study-director.insights-host-module',contractVersion:1,createBoundary,createDeviceState,createPreloadScheduler});
registry.define('insights-host',1,()=>module);return module;
})();
export type InsightsHostModule=typeof sdInsightsHostFactory;
export type InsightsHostBoundary=ReturnType<InsightsHostModule['createBoundary']>;
