(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1)throw new Error('Study Director internal module registry is unavailable or incompatible.');
registry.define('operation-lifecycle',1,()=>{
  const freeze=Object.freeze;
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
  return freeze({format:'study-director.operation-lifecycle',contractVersion:1,outcome,snapshot,waitForSettlement});
});
})();
