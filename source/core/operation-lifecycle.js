(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1)throw new Error('Study Director internal module registry is unavailable or incompatible.');
registry.define('operation-lifecycle',1,()=>{
  const freeze=Object.freeze;
  // Housekeeping yields between productive units, never in the safety reads
  // needed to finish its first unit. IO watchdogs and foreground checks remain
  // independent. An allowance is fixed for the attempt, not renewed by work.
  function createWorkBudget({now,milliseconds=0,check=()=>{},yieldError}={}){
    if(typeof now!=='function'||typeof check!=='function'||typeof yieldError!=='function')throw new TypeError('Work allowance dependencies are incomplete.');
    let started=null,limit=0,progressed=false;
    const start=ms=>{if(started!==null||!(Number(ms)>0))return false;started=Number(now());limit=Number(ms);return true;};
    const advance=()=>{check();progressed=true;};
    const assert=()=>{check();if(progressed&&started!==null&&Number(now())-started>=limit)throw yieldError();};
    start(milliseconds);return freeze({start,check:assert,advance});
  }
  // An attempt may settle while durable work remains pending. Keep those facts separate.
  function outcome(details={}){
    const status=String(details.status||''),reason=String(details.reason||'');
    if(status==='failed')return 'failed';
    if(status==='unavailable'||details.available===false||/^(unavailable|storage-unavailable|state-unavailable|state-read-failed|unverified-record-source|not-connected|awaiting-connection|permission)$/u.test(reason))return 'unavailable';
    if(/^(delete-failure|marker-clear-failed|intent-write-failed|error)$/u.test(reason))return 'failed';
    if(status==='yielded'||details.complete===false||/^(budget|bounded-continuation|continuation|source-changed|preempted)$/u.test(reason))return 'yielded';
    if(details.cancelled===true||status==='cancelled')return 'cancelled';
    if(status==='interrupted'||status==='superseded')return status;
    if(['pending','deferred','scheduled','blocked','skipped','idle'].includes(status)||details.pending===true||details.ok===false)return 'deferred';
    return 'completed';
  }
  function snapshot({busy=false,pending=false,scheduled=false,suspended=false,reason='',nextEligibleAt='',lastResult=null}={}){
    const eligible=String(nextEligibleAt||'');
    return freeze({state:busy?'running':suspended?'paused':scheduled?'scheduled':pending?'pending':'idle',busy:!!busy,pending:!!pending,scheduled:!!scheduled,suspended:!!suspended,reason:String(reason||''),nextEligibleAt:Number.isFinite(Date.parse(eligible))?eligible:'',lastOutcome:lastResult?outcome(lastResult):''});
  }
  function waitForSettlement(waiting,{signal=null,setTimeout:schedule=setTimeout,clearTimeout:clear=clearTimeout,timeoutMs=10000,timeoutCode='OPERATION_UNSETTLED',timeoutMessage='Background work has not stopped yet. Retry after it finishes.',cancelError=()=>Object.assign(new Error('Operation cancelled.'),{name:'AbortError',code:'OPERATION_CANCELLED'}),subscribeCancel=null,ignoreFailures=false}={}){
    const tasks=Array.from(waiting||[]).map(task=>ignoreFailures?Promise.resolve(task).catch(()=>null):Promise.resolve(task));
    let timer=null,abort=null,unsubscribe=null;
    const deadline=new Promise((_,reject)=>{
      abort=()=>reject(signal?.reason instanceof Error?signal.reason:cancelError());
      if(signal?.aborted){abort();return;}
      if(!tasks.length)return;
      timer=schedule(()=>reject(Object.assign(new Error(timeoutMessage),{code:timeoutCode})),Math.max(1,Number(timeoutMs)||10000));
      signal?.addEventListener('abort',abort,{once:true});
      if(subscribeCancel)unsubscribe=subscribeCancel(abort);
    });
    const settled=Promise.race([deadline,Promise.all(tasks)]).finally(()=>{
      if(timer!==null)clear(timer);signal?.removeEventListener('abort',abort);unsubscribe?.();
    });
    // A held ownership suspension may deliberately leave its wait unobserved.
    settled.catch(()=>{});return settled;
  }
  // A job owns its opportunity, blocker and attempt. Executors own storage
  // proofs and progress; a timer disappearing never retires outstanding work.
  function createJob({environment,isAvailable,execute,capture,onBlocked=()=>{},retryMs=300000,minDelayMs=0}){
    if(!environment||['now','setTimeout','clearTimeout'].some(key=>typeof environment[key]!=='function')||[isAvailable,execute,capture,onBlocked].some(value=>typeof value!=='function'))throw new TypeError('Background job dependencies are incomplete.');
    const {now,setTimeout:scheduleTimeout,clearTimeout:cancelTimeout}=environment;
    let timer=null,dueAt=null,pending=false,running=null,blocker='',trigger='requested',lastResult=null,disposed=false;
    const report=error=>{try{capture(error);}catch{}};
    function disarm(){if(timer!==null){cancelTimeout(timer);timer=null;}}
    function availability(){try{return isAvailable();}catch(error){report(error);return false;}}
    function reconcile(){
      if(disposed||!running&&!pending)return false;
      const available=availability();blocker=available===true?'':String(available||'unavailable');
      if(available!==true){disarm();if(running){try{onBlocked(blocker);}catch(error){report(error);}return false;}if(available)return false;}
      if(running)return false;
      if(dueAt===null||available!==true&&dueAt<=Number(now()))dueAt=Number(now())+Math.max(minDelayMs,Number(retryMs)||300000);
      if(timer===null)timer=scheduleTimeout(()=>{timer=null;void run(trigger);},Math.max(0,dueAt-Number(now())));
      return true;
    }
    function schedule(delay=0,reason='requested',mode='earliest'){
      if(disposed)return false;pending=true;
      const next=Number(now())+Math.max(minDelayMs,Number(delay)||0);
      if(dueAt===null||mode==='replace'||next<dueAt){disarm();dueAt=next;trigger=String(reason||'requested');}
      reconcile();return true;
    }
    function clear(){disarm();dueAt=null;pending=false;blocker='';return true;}
    function wake(reason='eligibility',discover=false){
      if(disposed||!pending&&!running&&!discover)return false;
      if(!pending&&!running)return schedule(minDelayMs,reason);
      if(running){reconcile();return true;}
      // Preserve a governed future retry instead of pulling it into a hot loop.
      if(dueAt===null)dueAt=Number(now())+minDelayMs;
      reconcile();return true;
    }
    function complete(result){return !!result&&['completed','clean','idle'].includes(result.status)&&result.complete!==false&&result.pending!==true&&result.gcPending!==true&&result.ok!==false;}
    function run(reason='requested',options={}){
      if(disposed)return Promise.resolve(freeze({status:'skipped',reason:'disposed'}));
      if(running)return running;
      pending=true;disarm();const available=availability();
      if(available!==true){blocker=String(available||'unavailable');lastResult=freeze({status:'deferred',reason:blocker,pending:true});reconcile();return Promise.resolve(lastResult);}
      blocker='';const eligible=dueAt;dueAt=null;
      running=Promise.resolve().then(()=>execute(freeze({trigger:String(reason||'requested'),nextEligibleAt:eligible===null?'':new Date(eligible).toISOString(),options}))).then(result=>{
        if(!result||typeof result.status!=='string')throw new TypeError('Background work did not return an explicit outcome.');
        lastResult=result;pending=dueAt!==null||!complete(result);return result;
      }).catch(error=>{report(error);lastResult=freeze({status:'unavailable',reason:'error',pending:true});pending=true;return lastResult;}).finally(()=>{running=null;reconcile();});
      return running;
    }
    function dispose(){disposed=true;clear();}
    return freeze({schedule,run,wake,clear,dispose,settled:()=>running||Promise.resolve(null),status:()=>freeze({...snapshot({busy:!!running,pending,scheduled:timer!==null,suspended:!!blocker,reason:blocker||(dueAt!==null?trigger:lastResult?.reason||trigger),nextEligibleAt:dueAt===null?'':new Date(dueAt).toISOString(),lastResult}),blocker,running:!!running})});
  }
  function createGroup(capture){
    if(typeof capture!=='function')throw new TypeError('Background owner diagnostics are required.');
    const owners=new Map();
    function register(id,owner){if(!id||owners.has(id)||typeof owner?.wake!=='function')throw new TypeError('Background owner is missing or already registered.');owners.set(id,owner);}
    function wake(trigger='eligibility'){for(const [id,owner] of owners)try{owner.wake(trigger);}catch(error){try{capture(id,error);}catch{}}}
    return freeze({register,wake});
  }
  return freeze({format:'study-director.operation-lifecycle',contractVersion:1,outcome,snapshot,waitForSettlement,createWorkBudget,createJob,createGroup});
});
})();
