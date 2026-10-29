import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {WorkerProgress,AttachmentResult} from '../../portable/worker-contracts.ts';
import type {IngestOptions,IngestWorker,IngestInput,IngestPending,IngestCall} from '../../types/attachment-ingest.ts';
const sdAttachmentIngestFactory=(()=>{
'use strict';
const registry=(globalThis as typeof globalThis & {[key:symbol]:ModuleRegistration<'attachment-ingest','study-director.attachment-ingest'>|undefined})[Symbol.for('studyDirector.internalModules.v1')];
if(!registry)throw new Error('Study Director internal module registry is unavailable.');
const createModule=()=>{
  const MiB=1048576,MIN_HEADROOM=32*MiB,MAX_HEADROOM=256*MiB;
  const cancelled=()=>Object.assign(new Error('Attachment operation cancelled.'),{name:'AbortError'});
  function create({createWorker,storage,directory,randomUUID=()=>crypto.randomUUID(),setTimeout:schedule=setTimeout,clearTimeout:clear=clearTimeout,stallTimeoutMs=120000,cancelTimeoutMs=2000,estimateTimeoutMs=5000,idleTimeoutMs=120000,onAbandoned=()=>{}}:IngestInput){
    if(typeof createWorker!=='function')throw new TypeError('Attachment worker factory is required.');
    if(typeof directory!=='string'||!directory)throw new TypeError('Attachment folder is required.');
    // The worker is started on demand and let go after two quiet minutes, so an
    // occasional attachment does not hold its memory for the whole session.
    let worker:IngestWorker|null=null,sequence=0,idleTimer:number|null=null;const pending=new Map<number,IngestPending>();
    function disarmIdle(){if(idleTimer!==null){clear(idleTimer);idleTimer=null;}}
    function idle(){disarmIdle();if(worker&&!pending.size)idleTimer=schedule(()=>{idleTimer=null;if(!pending.size)stop();},Math.max(1,idleTimeoutMs));}
    const safeProgress=(callback:IngestOptions['onProgress'],value:WorkerProgress)=>{if(typeof callback!=='function')return;try{callback(Object.freeze(value));}catch{}};
    function stop(error:unknown=new Error('Attachment ingest worker stopped.')){
      disarmIdle();const stopped=worker;worker=null;
      if(stopped){stopped.onmessage=null;stopped.onerror=null;stopped.onmessageerror=null;try{stopped.terminate();}catch{}}
      const requests=[...pending.values()];pending.clear();for(const request of requests){request.reject(error);if(request.type==='ingest')try{onAbandoned();}catch{}}
    }
    function ensure(){
      if(worker)return worker;const current=createWorker();worker=current;
      current.onmessage=event=>{
        if(worker!==current)return;const message=(event.data||{}) as {id?:unknown;progress?:unknown;error?:unknown;value?:unknown},request=typeof message.id==='number'?pending.get(message.id):undefined;if(!request)return;
        if(message.progress){if(!request.cancelling){request.watch();const progress=message.progress as Partial<WorkerProgress>;if(typeof progress.phase==='string'&&typeof progress.loaded==='number'&&typeof progress.total==='number')safeProgress(request.onProgress,progress as WorkerProgress);}return;}
        pending.delete(message.id as number);
        if(request.cancelling){request.reject(cancelled());if(request.type==='ingest')try{onAbandoned();}catch{}return;}
        if(message.error){const failure=message.error as {message?:unknown;name?:unknown;code?:unknown};const error=Object.assign(new Error(String(failure.message||'Attachment ingestion failed.')),{code:failure.code});error.name=String(failure.name||'Error');request.reject(error);}else request.resolve(message.value);
      };
      current.onerror=event=>{if(worker!==current)return;event.preventDefault?.();stop(new Error('Attachment ingest worker failed. Retry the attachment.'));};
      current.onmessageerror=()=>{if(worker===current)stop(new Error('Attachment ingest worker returned unreadable data.'));};
      return current;
    }
    async function preflight(bytes:number,{signal}:Pick<IngestOptions,'signal'>={}){
      if(signal?.aborted)throw cancelled();
      if(!Number.isSafeInteger(bytes)||bytes<=0)throw new TypeError('Attachment size is invalid.');
      if(typeof storage?.estimate!=='function')return Object.freeze({checked:false});
      let estimate:StorageEstimate|null,timer:number|null=null,abort:(()=>void)|null=null;
      try{
        const unavailable=new Promise<null>((resolve,reject)=>{timer=schedule(()=>resolve(null),Math.max(1,estimateTimeoutMs));if(signal){abort=()=>reject(cancelled());signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();}});
        estimate=await Promise.race([storage.estimate(),unavailable]);
      }catch(error){if(signal?.aborted)throw cancelled();return Object.freeze({checked:false});}
      finally{if(timer!==null)clear(timer);if(abort)signal!.removeEventListener('abort',abort);}
      const quota=Number(estimate?.quota),usage=Number(estimate?.usage);if(!Number.isFinite(quota)||!Number.isFinite(usage)||quota<=0||usage<0)return Object.freeze({checked:false});
      const headroom=Math.max(MIN_HEADROOM,Math.min(MAX_HEADROOM,Math.ceil(bytes*.05))),available=Math.max(0,quota-usage),required=bytes+headroom;
      if(available<required){const need=Math.ceil(required/MiB),free=Math.floor(available/MiB);const error=new Error(`Not enough browser storage for this attachment. About ${need} MB is required including safety headroom; about ${free} MB is currently available.`);error.name='QuotaExceededError';throw error;}
      return Object.freeze({checked:true,quota,usage,available,headroom,required});
    }
    function request(call:IngestCall,{signal,onProgress}:IngestOptions={}):Promise<unknown>{
      const {type}=call;
      if(signal?.aborted)return Promise.reject(cancelled());const id=++sequence;
      return new Promise<unknown>((resolve,reject)=>{
        let settled=false,timer:number|null=null,cancelTimer:number|null=null;
        const cleanup=()=>{if(timer!==null)clear(timer);if(cancelTimer!==null)clear(cancelTimer);signal?.removeEventListener('abort',abort);};
        const finish=(fn:(value:unknown)=>void,value:unknown)=>{if(settled)return;settled=true;cleanup();fn(value);idle();};
        const request:IngestPending={type,resolve:value=>finish(resolve,value),reject:error=>finish(reject,error),onProgress,cancelling:false,watch:()=>{if(timer!==null)clear(timer);timer=schedule(()=>stop(Object.assign(new Error('Attachment processing stopped making progress. Retry the attachment.'),{code:'ATTACHMENT_WORKER_TIMEOUT'})),Math.max(1,stallTimeoutMs));}};
        const abort=()=>{
          if(settled||request.cancelling)return;request.cancelling=true;if(timer!==null)clear(timer);
          cancelTimer=schedule(()=>stop(cancelled()),Math.max(1,cancelTimeoutMs));
          try{worker?.postMessage({type:'cancel',target:id});}catch{stop(cancelled());}
        };
        disarmIdle();pending.set(id,request);signal?.addEventListener('abort',abort,{once:true});request.watch();
        try{ensure().postMessage({...call,id});if(signal?.aborted)abort();}catch(error){stop(error);}
      });
    }
    async function ingest(file:Blob,{signal,onProgress}:IngestOptions={}):Promise<AttachmentResult>{
      if(!(file instanceof Blob)||!Number.isSafeInteger(file.size)||file.size<=0)throw new TypeError('Attachment file is invalid.');
      if(signal?.aborted)throw cancelled();safeProgress(onProgress,{phase:'preparing',loaded:0,total:file.size});await preflight(file.size,{signal});if(signal?.aborted)throw cancelled();
      const storageName='attblob-'+randomUUID();const value=await request({type:'ingest',data:{file,storageName,directory}},{signal,onProgress});
      const result=value as Partial<AttachmentResult>|null;
      if(!result||result.storageName!==storageName||result.size!==file.size||typeof result.hash!=='string'||!/^[a-f0-9]{64}$/.test(result.hash)||(result.mode!=='sync'&&result.mode!=='async')){try{onAbandoned();}catch{}throw new Error('Attachment ingest worker returned an invalid result.');}
      return result as AttachmentResult;
    }
    const checkedBoolean=(value:unknown)=>{if(typeof value!=='boolean')throw new Error('Attachment ingest worker returned an invalid result.');return value;};
    const verify=(storageName:string,expectedHash:string,size:number,options:IngestOptions={})=>request({type:'verify',data:{storageName,expectedHash,size,directory}},options).then(checkedBoolean);
    const remove=(storageName:string)=>request({type:'remove',data:{storageName,directory}}).then(checkedBoolean);
    return Object.freeze({status:()=>Object.freeze({busy:pending.size>0}),ingest,verify,remove,preflight,destroy:()=>stop()});
  }
  return Object.freeze({format:'study-director.attachment-ingest',contractVersion:1,create});
};
registry.define('attachment-ingest',1,createModule);
return createModule;
})();
export type AttachmentIngestModule=ReturnType<typeof sdAttachmentIngestFactory>;
