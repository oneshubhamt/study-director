import type {InsightRecord,InsightsBuildOptions,InsightsEngine,InsightsResult,PreparedInsights,PracticeRunInsightSummary} from './insights-model.ts';
import type {InsightsProtocolRuntime,InsightsResultMessage,InsightsWindowRequest} from './insights-protocol.ts';
import type {TaskOutcome} from '../../types/domain.ts';

export interface InsightsComputeApi {
  readonly logic:Readonly<{
    classifyTaskOutcome(task:NonNullable<InsightRecord['tasks']>[number]):TaskOutcome;
    summarizePracticeRuns(runs:NonNullable<InsightRecord['practiceRuns']>):PracticeRunInsightSummary;
  }>;
}
export interface InsightsComputeResult {
  readonly model:InsightsResult;
  readonly mode:string;
  readonly computeMs:number;
  readonly roundTripMs:number;
  readonly sentRecords?:number;
}
export interface InsightsComputation {
  build(records:readonly InsightRecord[],prepared:PreparedInsights,options:InsightsBuildOptions):Promise<InsightsComputeResult>;
  cancel():boolean;
  dispose():boolean;
  release():boolean;
  warm():boolean;
  enrichRecords(records:readonly InsightRecord[]):readonly InsightRecord[];
  supported():boolean;
  readonly minimumRecords:number;
}
type WorkerConstructorWithTrustedUrl=new(scriptURL:unknown,options?:WorkerOptions)=>Worker;
type SchedulerPort={yield?:()=>Promise<void>};
type ActiveRequest={
  id:number;revision:string;worker:Worker;
  resolve:(value:InsightsResultMessage)=>void;reject:(error:Error)=>void;
};

(()=>{
'use strict';
if(!Reflect.has(globalThis,'document'))return;
const protocolCandidate=Reflect.get(globalThis,'StudyDirectorInsightsProtocol') as InsightsProtocolRuntime|undefined;
if(!protocolCandidate||protocolCandidate.format!=='study-director.insights-worker-protocol'||protocolCandidate.version!==1)throw new Error('Study Director Insights worker protocol is unavailable.');
const Protocol:InsightsProtocolRuntime=protocolCandidate;
Reflect.deleteProperty(globalThis,'StudyDirectorInsightsProtocol');
const MIN_RECORDS=120,WORKER_TIMEOUT_MS=30000,IDLE_RETIRE_MS=120000;
const runtimeUrl=document.currentScript instanceof HTMLScriptElement?document.currentScript.src:'';
// lib.dom's Worker constructor does not yet model TrustedScriptURL, although
// browsers accept that Trusted Types value at this script-URL sink.

let workerUrlPolicy:{createScriptURL(value:string):unknown}|null=null;
function trustedWorkerURL():unknown{
  const trustedTypes=Reflect.get(globalThis,'trustedTypes') as {createPolicy(name:string,rules:{createScriptURL(value:string):string}):{createScriptURL(value:string):unknown}}|undefined;
  if(!trustedTypes)return runtimeUrl;
  if(!workerUrlPolicy)workerUrlPolicy=trustedTypes.createPolicy('sd-insights-worker',{createScriptURL:value=>{
    if(value!==runtimeUrl||new URL(value).origin!==location.origin)throw new TypeError('Unapproved Insights worker.');
    return value;
  }});
  return workerUrlPolicy.createScriptURL(runtimeUrl);
}
const defaultYield=()=>{
  const scheduler=Reflect.get(globalThis,'scheduler') as SchedulerPort|undefined;
  return scheduler?.yield?scheduler.yield():new Promise<void>(resolve=>setTimeout(resolve,0));
};
function abortError(message='Insights computation superseded.'){
  const error=new Error(message);error.name='AbortError';return error;
}
function processingError(cause:unknown){
  return Object.assign(new Error('Insights processing failed. Retry the report.'),{code:'INSIGHTS_PROCESSING_FAILED',cause});
}
function create(api:InsightsComputeApi,engine:InsightsEngine,{yieldTask=defaultYield}:{yieldTask?:()=>Promise<unknown>}={}):Readonly<InsightsComputation>{
  if(!api||!Object.isFrozen(api.logic)||typeof api.logic.classifyTaskOutcome!=='function'||typeof api.logic.summarizePracticeRuns!=='function')throw new TypeError('Insights compute logic adapters are unavailable.');
  let active:ActiveRequest|null=null,nextId=0,generation=0,worker:Worker|null=null,heldRevision='',retireTimer:number|null=null,workerDisabled=false;
  const supported=()=>!!(runtimeUrl&&typeof Worker==='function'&&!workerDisabled);
  const cancelRetire=()=>{if(retireTimer!==null){clearTimeout(retireTimer);retireTimer=null;}};
  const retireWorker=(target:Worker|null=worker)=>{
    cancelRetire();if(!target)return false;
    if(worker===target){worker=null;heldRevision='';}
    try{target.terminate();}catch{}
    return true;
  };
  const failWorker=(target:Worker,error:Error)=>{
    if(worker!==target)return false;
    workerDisabled=true;
    const current=active&&active.worker===target?active:null;
    if(current)active=null;
    retireWorker(target);
    current?.reject(error);
    return true;
  };
  const ensureWorker=()=>{
    if(worker)return worker;
    if(workerDisabled)throw new Error('Insights worker is unavailable for this session.');
    let created:Worker;
    try{
      const WorkerWithTrustedUrl=Worker as unknown as WorkerConstructorWithTrustedUrl;
      created=new WorkerWithTrustedUrl(trustedWorkerURL(),{name:'study-director-insights'});
    }
    catch(error){workerDisabled=true;throw error;}
    created.onmessage=(event:MessageEvent<unknown>)=>{
      if(worker!==created)return;
      const current=active;
      if(!current||current.worker!==created)return;
      const decoded=Protocol.decodeWorkerResponse(event.data);
      if(!decoded.ok){
        // The retained worker can deliver a late, malformed reply for a
        // completed request. Only a reply attributable to the active request
        // (or one without an identifiable owner) can invalidate its worker.
        if(decoded.id!==null&&(decoded.id!==current.id||(decoded.revision&&decoded.revision!==current.revision)))return;
        failWorker(created,new Error(decoded.message));return;
      }
      const message=decoded.message;
      if(message.id!==current.id||message.revision!==current.revision)return;
      if(message.type==='SD_INSIGHTS_ERROR')current.reject(new Error(message.message||'Insights worker failed.'));
      else current.resolve(message);
    };
    created.onerror=event=>{
      if(worker!==created)return;
      event.preventDefault?.();
      failWorker(created,new Error(event.message||'Insights worker failed.'));
    };
    created.onmessageerror=()=>{
      if(worker!==created)return;
      failWorker(created,new Error('Insights worker returned an unreadable response.'));
    };
    worker=created;heldRevision='';return created;
  };
  const warm=()=>{
    if(!supported())return false;
    try{ensureWorker();return true;}catch{return false;}
  };
  const abortActive=(rewarm=false)=>{
    const current=active;if(!current)return false;
    active=null;retireWorker(current.worker);current.reject(abortError());
    if(rewarm&&!workerDisabled)warm();
    return true;
  };
  const cancel=()=>{generation+=1;return abortActive(true);};
  const dispose=()=>{generation+=1;const changed=abortActive(false)||!!worker;retireWorker();return changed;};
  const release=()=>{
    generation+=1;
    if(abortActive(false))return true;
    const idleWorker=worker;if(!idleWorker)return false;
    cancelRetire();retireTimer=setTimeout(()=>{
      retireTimer=null;if(!active&&worker===idleWorker)retireWorker(idleWorker);
    },IDLE_RETIRE_MS);
    return true;
  };
  const enrichRecords=(input:readonly InsightRecord[])=>{
    const records:readonly InsightRecord[]=Array.isArray(input)?input:[];
    return records.map(record=>{
      const rawTasks:NonNullable<InsightRecord['tasks']>=Array.isArray(record?.tasks)?record.tasks:[];
      const tasks=rawTasks.map(task=>({...task,__sdOutcome:api.logic.classifyTaskOutcome(task)}));
      let practiceSummary:PracticeRunInsightSummary|undefined;
      try{practiceSummary=api.logic.summarizePracticeRuns(Array.isArray(record?.practiceRuns)?record.practiceRuns:[]);}catch{}
      return {...record,tasks,...(practiceSummary?{__sdPracticeSummary:practiceSummary}:{})};
    });
  };
  const fallback=(records:readonly InsightRecord[],prepared:PreparedInsights,options:InsightsBuildOptions,started:number,mode:string):InsightsComputeResult=>{
    try{
      const model=engine.buildPrepared(records,prepared,options);
      return {model,mode,computeMs:performance.now()-started,roundTripMs:0};
    }catch(error){throw processingError(error);}
  };
  const windowOf=(records:readonly InsightRecord[],prepared:PreparedInsights):InsightsWindowRequest=>{
    if(records===prepared.records)return {all:true};
    const positions=new Map(prepared.records.map((record,index)=>[record,index] as const));
    const indices=records.map(record=>positions.get(record)??-1);
    if(indices.some(index=>index<0))throw new Error('Insights window records are not part of the prepared history.');
    return {indices};
  };
  const build=async(records:readonly InsightRecord[],prepared:PreparedInsights,options:InsightsBuildOptions):Promise<InsightsComputeResult>=>{
    const started=performance.now();
    // Invalidate even a failed worker request whose rejection is waiting on a
    // yielded transfer, and even when the successor uses the main thread.
    cancel();
    const requestGeneration=generation;
    const assertCurrent=()=>{if(requestGeneration!==generation)throw abortError();};
    if(Math.max(records.length,prepared.records.length)<MIN_RECORDS||!supported()){
      return fallback(records,prepared,options,started,supported()?'main-thread-small':workerDisabled?'main-thread-worker-failure':'main-thread-unavailable');
    }
    cancelRetire();
    const id=++nextId,revision=String(prepared.revision||'');
    let timeout:number|null=null,currentWorker:Worker|null=null,sentRecords=0;
    try{
      currentWorker=ensureWorker();
      const view=windowOf(records,prepared);
      const response=new Promise<InsightsResultMessage>((resolve,reject)=>{
        active={id,revision,worker:currentWorker!,resolve,reject};
        timeout=setTimeout(()=>{
          const current=active;
          if(current&&current.id===id&&current.worker===currentWorker)failWorker(current.worker,new Error('Insights processing timed out. Retry the report.'));
        },WORKER_TIMEOUT_MS);
      });
      response.catch(()=>{});
      if(heldRevision!==revision){
        const all=prepared.records,parts=Math.max(1,Math.ceil(all.length/Protocol.recordsPerMessage));
        if(parts>Protocol.maxParts||all.length>Protocol.maxRetainedRecords)throw new Error('Insights history exceeds the worker transport limit.');
        for(let part=0;part<parts;part+=1){
          if(part>0){
            await yieldTask();
            assertCurrent();
            if(worker!==currentWorker||!active||active.id!==id||active.worker!==currentWorker){await response;throw abortError();}
          }
          const slice=all.slice(part*Protocol.recordsPerMessage,(part+1)*Protocol.recordsPerMessage);
          currentWorker.postMessage({type:'SD_INSIGHTS_RECORDS',requestId:id,revision,part,parts,records:slice});sentRecords+=slice.length;
        }
        heldRevision=revision;
      }
      currentWorker.postMessage({type:'SD_INSIGHTS_BUILD',id,revision,window:view,options});
      const result=await response;
      assertCurrent();
      const model=Object.defineProperty(result.model,'getLabEvidence',{enumerable:false,value:()=>engine.getLabEvidence(prepared,options)}) as InsightsResult;
      return {model,mode:'worker',computeMs:result.computeMs,roundTripMs:performance.now()-started,sentRecords};
    }catch(error){
      assertCurrent();
      if(error instanceof Error&&error.name==='AbortError')throw error;
      if(currentWorker&&worker===currentWorker){workerDisabled=true;retireWorker(currentWorker);}
      return fallback(records,prepared,options,started,'main-thread-worker-failure');
    }finally{
      if(timeout!==null)clearTimeout(timeout);
      if(active&&active.id===id)active=null;
    }
  };
  return Object.freeze({build,cancel,dispose,release,warm,enrichRecords,supported,minimumRecords:MIN_RECORDS});
}
const InsightsComputeBridge=Object.freeze({format:'study-director.insights-compute-bridge',version:1,create,minimumRecords:MIN_RECORDS});
Object.defineProperty(globalThis,'StudyDirectorInsightsComputeBridge',{value:InsightsComputeBridge,writable:false,configurable:true});
})();
export type InsightsComputeBridgeRuntime=Readonly<{format:'study-director.insights-compute-bridge';version:1;create:(api:InsightsComputeApi,engine:InsightsEngine,options?:{yieldTask?:()=>Promise<unknown>})=>Readonly<InsightsComputation>;minimumRecords:number}>;
