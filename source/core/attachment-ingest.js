(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
registry.define('attachment-ingest',1,()=>{
  const MiB=1048576,MIN_HEADROOM=32*MiB,MAX_HEADROOM=256*MiB;
  const cancelled=()=>Object.assign(new Error('Attachment operation cancelled.'),{name:'AbortError'});
  function create({createWorker,storage,directory,randomUUID=()=>crypto.randomUUID(),setTimeout:schedule=setTimeout,clearTimeout:clear=clearTimeout,stallTimeoutMs=120000,cancelTimeoutMs=2000,estimateTimeoutMs=5000,idleTimeoutMs=120000,onAbandoned=()=>{}}){
    if(typeof createWorker!=='function')throw new TypeError('Attachment worker factory is required.');
    if(typeof directory!=='string'||!directory)throw new TypeError('Attachment folder is required.');
    // The worker is started on demand and let go after two quiet minutes, so an
    // occasional attachment does not hold its memory for the whole session.
    let worker=null,sequence=0,idleTimer=null;const pending=new Map();
    function disarmIdle(){if(idleTimer!==null){clear(idleTimer);idleTimer=null;}}
    function idle(){disarmIdle();if(worker&&!pending.size)idleTimer=schedule(()=>{idleTimer=null;if(!pending.size)stop();},Math.max(1,idleTimeoutMs));}
    const safeProgress=(callback,value)=>{if(typeof callback!=='function')return;try{callback(Object.freeze(value));}catch{}};
    function stop(error=new Error('Attachment ingest worker stopped.')){
      disarmIdle();const stopped=worker;worker=null;
      if(stopped){stopped.onmessage=stopped.onerror=stopped.onmessageerror=null;try{stopped.terminate();}catch{}}
      const requests=[...pending.values()];pending.clear();for(const request of requests){request.reject(error);if(request.type==='ingest')try{onAbandoned();}catch{}}
    }
    function ensure(){
      if(worker)return worker;const current=createWorker();worker=current;
      current.onmessage=event=>{
        if(worker!==current)return;const message=event.data||{},request=pending.get(message.id);if(!request)return;
        if(message.progress){if(!request.cancelling){request.watch();safeProgress(request.onProgress,message.progress);}return;}
        pending.delete(message.id);
        if(request.cancelling){request.reject(cancelled());if(request.type==='ingest')try{onAbandoned();}catch{}return;}
        if(message.error){const error=new Error(message.error.message||'Attachment ingestion failed.');error.name=message.error.name||'Error';error.code=message.error.code;request.reject(error);}else request.resolve(message.value);
      };
      current.onerror=event=>{if(worker!==current)return;event.preventDefault?.();stop(new Error('Attachment ingest worker failed. Retry the attachment.'));};
      current.onmessageerror=()=>{if(worker===current)stop(new Error('Attachment ingest worker returned unreadable data.'));};
      return current;
    }
    async function preflight(bytes,{signal}={}){
      if(signal?.aborted)throw cancelled();
      if(!Number.isSafeInteger(bytes)||bytes<=0)throw new TypeError('Attachment size is invalid.');
      if(typeof storage?.estimate!=='function')return Object.freeze({checked:false});
      let estimate,timer=null,abort=null;
      try{
        const unavailable=new Promise((resolve,reject)=>{timer=schedule(()=>resolve(null),Math.max(1,estimateTimeoutMs));if(signal){abort=()=>reject(cancelled());signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();}});
        estimate=await Promise.race([storage.estimate(),unavailable]);
      }catch(error){if(signal?.aborted)throw cancelled();return Object.freeze({checked:false});}
      finally{if(timer!==null)clear(timer);if(abort)signal.removeEventListener('abort',abort);}
      const quota=Number(estimate?.quota),usage=Number(estimate?.usage);if(!Number.isFinite(quota)||!Number.isFinite(usage)||quota<=0||usage<0)return Object.freeze({checked:false});
      const headroom=Math.max(MIN_HEADROOM,Math.min(MAX_HEADROOM,Math.ceil(bytes*.05))),available=Math.max(0,quota-usage),required=bytes+headroom;
      if(available<required){const need=Math.ceil(required/MiB),free=Math.floor(available/MiB);const error=new Error(`Not enough browser storage for this attachment. About ${need} MB is required including safety headroom; about ${free} MB is currently available.`);error.name='QuotaExceededError';throw error;}
      return Object.freeze({checked:true,quota,usage,available,headroom,required});
    }
    function request(type,data,{signal,onProgress}={}){
      if(signal?.aborted)return Promise.reject(cancelled());const id=++sequence;
      return new Promise((resolve,reject)=>{
        let settled=false,timer=null,cancelTimer=null;
        const cleanup=()=>{if(timer!==null)clear(timer);if(cancelTimer!==null)clear(cancelTimer);signal?.removeEventListener('abort',abort);};
        const finish=(fn,value)=>{if(settled)return;settled=true;cleanup();fn(value);idle();};
        const request={type,resolve:value=>finish(resolve,value),reject:error=>finish(reject,error),onProgress,cancelling:false,watch:()=>{if(timer!==null)clear(timer);timer=schedule(()=>stop(Object.assign(new Error('Attachment processing stopped making progress. Retry the attachment.'),{code:'ATTACHMENT_WORKER_TIMEOUT'})),Math.max(1,stallTimeoutMs));}};
        const abort=()=>{
          if(settled||request.cancelling)return;request.cancelling=true;if(timer!==null)clear(timer);
          cancelTimer=schedule(()=>stop(cancelled()),Math.max(1,cancelTimeoutMs));
          try{worker?.postMessage({type:'cancel',target:id});}catch{stop(cancelled());}
        };
        disarmIdle();pending.set(id,request);signal?.addEventListener('abort',abort,{once:true});request.watch();
        try{ensure().postMessage({id,type,data:{...data,directory}});if(signal?.aborted)abort();}catch(error){stop(error);}
      });
    }
    async function ingest(file,{signal,onProgress}={}){
      if(!(file instanceof Blob)||!Number.isSafeInteger(file.size)||file.size<=0)throw new TypeError('Attachment file is invalid.');
      if(signal?.aborted)throw cancelled();safeProgress(onProgress,{phase:'preparing',loaded:0,total:file.size});await preflight(file.size,{signal});if(signal?.aborted)throw cancelled();
      const storageName='attblob-'+randomUUID();return request('ingest',{file,storageName},{signal,onProgress});
    }
    const verify=(storageName,expectedHash,size,options={})=>request('verify',{storageName,expectedHash,size},options);
    const remove=storageName=>request('remove',{storageName});
    return Object.freeze({status:()=>Object.freeze({busy:pending.size>0}),ingest,verify,remove,preflight,destroy:()=>stop()});
  }
  return Object.freeze({format:'study-director.attachment-ingest',contractVersion:1,create});
});
})();
