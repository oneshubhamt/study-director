import type {InsightRecord,InsightsModelRuntime,InsightsResult} from './insights-model.ts';
import type {InsightsProtocolRuntime,InsightsWireModel,InsightsErrorMessage,InsightsResultMessage} from './insights-protocol.ts';
import type {TaskOutcome} from '../../types/domain.ts';

(()=>{
'use strict';
if(Reflect.has(globalThis,'document'))return;
const protocolCandidate=Reflect.get(globalThis,'StudyDirectorInsightsProtocol') as InsightsProtocolRuntime|undefined;
const modelCandidate=Reflect.get(globalThis,'StudyDirectorInsightsModel') as InsightsModelRuntime|undefined;
if(!protocolCandidate||protocolCandidate.format!=='study-director.insights-worker-protocol'||protocolCandidate.version!==1)throw new Error('Study Director Insights worker protocol is unavailable.');
if(!modelCandidate)throw new Error('Study Director Insights model is unavailable.');
const Protocol:InsightsProtocolRuntime=protocolCandidate,Model:InsightsModelRuntime=modelCandidate;
Reflect.deleteProperty(globalThis,'StudyDirectorInsightsProtocol');
const scope=globalThis as unknown as DedicatedWorkerGlobalScope;
const classifyTaskOutcome=(task:NonNullable<InsightRecord['tasks']>[number]):TaskOutcome=>typeof task.__sdOutcome==='string'?task.__sdOutcome:'untouched';
const summarizePracticeRuns=()=>{throw new Error('Worker input is missing precomputed Practice Pacer evidence.');};
const engine=Model.ModelEngine.createInsightsEngine({classifyTaskOutcome,summarizePracticeRuns});
type Incoming={requestId:number;revision:string;parts:number;next:number;records:InsightRecord[]};
type Held={revision:string;records:readonly InsightRecord[]};
let incoming:Incoming|null=null,held:Held|null=null;

function postError(id:number,revision:string,error:unknown){
  const message:InsightsErrorMessage={
    type:'SD_INSIGHTS_ERROR',id,revision,
    message:String(error instanceof Error?error.message:error||'Insights worker failed.').slice(0,1000)
  };
  scope.postMessage(message);
}
scope.addEventListener('message',(event:MessageEvent<unknown>)=>{
  const decoded=Protocol.decodeWorkerRequest(event.data);
  if(!decoded.ok){
    if(decoded.id!==null&&decoded.revision)postError(decoded.id,decoded.revision,decoded.message);
    return;
  }
  const message=decoded.message;
  if(message.type==='SD_INSIGHTS_RECORDS'){
    if(message.part===0)incoming={requestId:message.requestId,revision:message.revision,parts:message.parts,next:0,records:[]};
    const current=incoming;
    if(!current||current.requestId!==message.requestId||current.revision!==message.revision||current.parts!==message.parts){
      postError(message.requestId,message.revision,'Insights record-transfer identity changed before completion.');
      return;
    }
    if(message.part!==current.next){
      incoming=null;postError(message.requestId,message.revision,'Insights record-transfer parts arrived out of order.');return;
    }
    if(current.records.length+message.records.length>Protocol.maxRetainedRecords){
      incoming=null;postError(message.requestId,message.revision,'Insights record-transfer exceeds the retained-record limit.');return;
    }
    current.records.push(...message.records);current.next+=1;
    if(current.next===current.parts){
      held=Object.freeze({revision:current.revision,records:Object.freeze(current.records.slice())});
      incoming=null;
    }
    return;
  }

  const started=performance.now();
  try{
    if(!held||held.revision!==message.revision)throw new Error('Insights worker is missing this revision\'s records.');
    const prepared=engine.reusePrepared(held.records,held.revision);
    const records='all' in message.window?prepared.records:message.window.indices.map((index:number)=>{
      const record=prepared.records[index];
      if(!record)throw new Error('Insights window names a record the worker does not hold.');
      return record;
    });
    const model:InsightsResult=engine.buildPrepared(records,prepared,message.options);
    // getLabEvidence is non-enumerable in the model engine; object spread
    // intentionally keeps it out of the structured-clone wire contract.
    const wireModel:InsightsWireModel={...model};
    const response:InsightsResultMessage={
      type:'SD_INSIGHTS_RESULT',id:message.id,revision:message.revision,model:wireModel,computeMs:performance.now()-started
    };
    scope.postMessage(response);
  }catch(error){
    postError(message.id,message.revision,error);
  }
});
})();
