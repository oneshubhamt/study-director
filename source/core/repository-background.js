(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject}=registry.contracts;
registry.define('repository-background',1,input=>{
  registry.contracts.exactFrozenObject(input,['lifecycle'],'repository-background module input');
  const Lifecycle=input.lifecycle;
  if(!Object.isFrozen(Lifecycle)||Lifecycle.format!=='study-director.operation-lifecycle'||Lifecycle.contractVersion!==1||typeof Lifecycle.createJob!=='function'||typeof Lifecycle.createWorkBudget!=='function')throw new TypeError('Operation lifecycle contract is unavailable or incompatible.');
  const freeze=Object.freeze;
  const PRIORITY=freeze({integrity:10,maintenance:20,convergence:30});
  const MAINTENANCE=freeze({
    continuationMs:5000,
    busyMs:15000,
    contentionMs:15*60*1000,
    errorMs:5*60*1000,
    blockedMs:15*60*1000,
    graceMs:6*60*60*1000
  });
  const INTEGRITY=freeze({
    workBudgetMs:120*1000,
    intervalMs:14*24*60*60*1000,
    retryMs:10*60*1000,
    continueMs:2*60*1000,
    stateRetryMs:5*60*1000,
    lockedRetryMs:30*60*1000,
    failureRetryMs:24*60*60*1000,
    unavailableRetryMs:60*60*1000
  });
  function validIso(value){const raw=String(value||'');return Number.isFinite(Date.parse(raw))?raw:'';}
  function normalizeMaintenanceState(value){
    if(!value||typeof value!=='object')return null;
    return freeze({requestedAt:validIso(value.requestedAt),nextEligibleAt:validIso(value.nextEligibleAt),reason:String(value.reason||'legacy'),repositoryScope:String(value.repositoryScope||''),requestId:String(value.requestId||'')});
  }
  function maintenanceDelay(state,now=Date.now(),fallback=MAINTENANCE.continuationMs){
    const due=Date.parse(String(state&&state.nextEligibleAt||''));return Number.isFinite(due)?Math.max(1000,due-Number(now)):Math.max(1000,Number(fallback)||MAINTENANCE.continuationMs);
  }
  function maintenanceActionable(state,now=Date.now()){if(!state)return false;const due=Date.parse(String(state.nextEligibleAt||''));return !Number.isFinite(due)||due<=Number(now)+50;}
  function maintenanceDefersAcrossObservation(state){return ['publication-contention','blocked-uncertain','delete-failure','marker-clear-failed','error'].includes(String(state&&state.reason||''));}
  function maintenanceDeadline(delay,reason='bounded-continuation',now=Date.now()){
    return freeze({reason:String(reason||'bounded-continuation'),nextEligibleAt:new Date(Number(now)+Math.max(1000,Number(delay)||MAINTENANCE.continuationMs)).toISOString()});
  }
  function maintenancePlan(cleanup){
    if(!cleanup||cleanup.gcPending!==true)return freeze({reason:'complete',retryMs:0,actionable:false,state:'completed'});
    const checkpointDeferred=Math.max(0,Number(cleanup.checkpointDeferred)||0),checkpointFailures=Math.max(0,Number(cleanup.checkpointFailures)||0),gcBudgetDeferred=Math.max(0,Number(cleanup.gcBudgetDeferred)||0),gcFailures=Math.max(0,Number(cleanup.gcFailures)||0),gcDeferred=Math.max(0,Number(cleanup.gcDeferred)||0),deferredIncomplete=Math.max(0,Number(cleanup.deferredIncomplete)||0),uncertainCount=Math.max(0,Number(cleanup.uncertainCount)||0);
    if(checkpointDeferred||gcBudgetDeferred)return freeze({reason:'bounded-continuation',retryMs:MAINTENANCE.continuationMs,actionable:true,state:'scheduled'});
    if(cleanup.maintenanceBlocked===true||deferredIncomplete||cleanup.objectGcBlocked===true){const hinted=Math.max(0,Number(cleanup.contentionRetryMs)||0),retryMs=hinted>=1000?hinted:MAINTENANCE.contentionMs;return freeze({reason:'publication-contention',retryMs,actionable:false,state:'deferred'});}
    if(checkpointFailures||gcFailures)return freeze({reason:'delete-failure',retryMs:MAINTENANCE.errorMs,actionable:false,state:'failed'});
    if(cleanup.gcSkipped===true||cleanup.overflow===true||uncertainCount)return freeze({reason:'blocked-uncertain',retryMs:MAINTENANCE.blockedMs,actionable:false,state:'blocked'});
    if(gcDeferred)return freeze({reason:'gc-grace',retryMs:MAINTENANCE.graceMs,actionable:false,state:'deferred'});
    return freeze({reason:'blocked-uncertain',retryMs:MAINTENANCE.blockedMs,actionable:false,state:'blocked'});
  }
  function maintenanceDetails(event){
    const cleanup=event.cleanup||{},plan=event.plan||{},reason=String(event.reason||plan.reason||'');
    const details={status:event.phase==='completed'?'completed':event.phase==='yielded'?'yielded':event.phase==='cleanup-complete'?String(plan.state||'completed'):'pending',reason,actionable:event.actionable===true||plan.actionable===true,nextEligibleAt:String(event.nextEligibleAt||''),pending:cleanup.gcPending===true||['yielded','failed','pending','deferred','running','cleanup-start'].includes(event.phase)};
    for(const key of ['removedCheckpoints','checkpointDeferred','checkpointFailures','gcRemoved','gcDeferred','gcBudgetDeferred','gcFailures','uncertainCount'])details[key]=Math.max(0,Number(cleanup[key])||0);
    for(const key of ['gcSkipped','overflow','objectGcBlocked','maintenanceBlocked'])details[key]=cleanup[key]===true;
    return freeze(details);
  }
  function integrityDetails(result={}){
    const reason=String(result.reason||''),safeReason=['budget','preempted','locked','unavailable','not-due','busy','permission'].includes(reason)?reason:result.status==='unavailable'?'repository-unavailable':result.corruption===true?'integrity-corrupt':'';
    return freeze({status:String(result.status||'unavailable'),complete:result.complete===true&&['completed','failed'].includes(result.status),reason:safeReason,checked:Math.max(0,Number(result.checked)||0),attempted:Math.max(0,Number(result.attempted)||0),checkedBytes:Math.max(0,Number(result.checkedBytes)||0),total:Math.max(0,Number(result.total)||0),corruption:result.corruption===true,repaired:result.repaired===true});
  }
  function repositoryObservationNeedsMaintenance(observation,selectRetention,now=Date.now()){
    if(!observation)return false;
    const uncertain=(Array.isArray(observation.unreadable)?observation.unreadable.length:0)>0||(Array.isArray(observation.invalid)?observation.invalid.length:0)>0||Math.max(0,Number(observation.ignored)||0)>0||observation.overflow===true;
    if(uncertain||(observation.uncommitted||[]).length||(observation.orphanCommits||[]).length)return true;
    const rows=Array.isArray(observation.valid)?observation.valid:Array.isArray(observation.rows)?observation.rows:[];
    if(typeof selectRetention!=='function'||!rows.length)return false;
    const normalized=freeze(rows.map(row=>freeze({id:String(row.id||row.item?.id||''),manifest:row.manifest||row.item?.history&&freeze({version:row.item.history.format,exportedAt:row.item.history.exportedAt,retention:row.item.history.retention,installationId:String(row.item.history.origin||'')})||null})).filter(row=>row.id&&row.manifest));
    if(!normalized.length)return false;
    try{return selectRetention(normalized,{now:new Date(Number(now))}).remove.length>0;}catch{return true;}
  }
  function backgroundAbort(code,message){const error=new Error(message);error.name='AbortError';error.code=String(code||'REPOSITORY_BACKGROUND_PREEMPTED');return error;}
  function createCoordinator(input){
    exactObject(input,['environment','target'],'Repository-background coordinator input');
    const environment=exactObject(input.environment,['AbortController','clearTimeout','now','setTimeout'],'Repository-background environment');
    const TargetAbortController=environment.AbortController;
    if(typeof TargetAbortController!=='function'||typeof environment.clearTimeout!=='function'||typeof environment.now!=='function'||typeof environment.setTimeout!=='function')throw new TypeError('Repository-background environment is invalid.');
    const target=String(input.target||'repository').slice(0,80),scheduled=new Map(),active=new Map(),suspensions=new Set(),jobs=new Map(),discoverable=new Map();let foreground=null,suspensionSequence=0;
    // Told after a background job gives back its slot, so a status shown as
    // busy while the job ran is drawn again once it is not.
    const releaseListeners=new Set();
    function onRelease(listener){if(typeof listener!=='function')throw new TypeError('Repository-background release listener is invalid.');releaseListeners.add(listener);return ()=>releaseListeners.delete(listener);}
    function notifyRelease(job){for(const listener of releaseListeners){try{listener(job);}catch{}}}
    const nowMs=()=>{const value=Number(environment.now());return Number.isFinite(value)?value:Date.now();};
    const waitForSettlement=(waiting,signal=null)=>Lifecycle.waitForSettlement(waiting,{signal,setTimeout:environment.setTimeout,clearTimeout:environment.clearTimeout,ignoreFailures:true,timeoutCode:'REPOSITORY_BACKGROUND_UNSETTLED',timeoutMessage:'Background file work has not stopped yet. Retry after it finishes.',cancelError:()=>backgroundAbort('REPOSITORY_FOREGROUND_CANCELLED','Backup operation was cancelled.')});
    function priority(job){return PRIORITY[String(job||'')]||0;}
    function transition(job,from,to,details={}){return freeze({target,job:String(job||''),from:String(from||''),to:String(to||''),at:new Date(nowMs()).toISOString(),reason:String(details.reason||''),nextEligibleAt:validIso(details.nextEligibleAt),actionable:details.actionable===true});}
    function disarm(entry){if(entry&&entry.timer!==null){environment.clearTimeout(entry.timer);entry.timer=null;}}
    function arm(entry){
      if(!entry||foreground||suspensions.size||entry.timer!==null)return false;
      const wait=Math.max(0,entry.dueAt-nowMs());entry.timer=environment.setTimeout(()=>{entry.timer=null;if(scheduled.get(entry.job)!==entry)return;
       if(nowMs()<entry.dueAt){arm(entry);return;} // Wall clock moved backwards.
       const rank=priority(entry.job);for(const activeJob of active.keys())if(priority(activeJob)>=rank)return;scheduled.delete(entry.job);void Promise.resolve().then(entry.callback);},wait);return true;
    }
    function schedule(job,delay,callback,{mode='replace'}={}){
      const name=String(job||'');if(!priority(name)||typeof callback!=='function')throw new TypeError('Repository-background scheduled job is invalid.');
      const dueAt=nowMs()+Math.max(1000,Number(delay)||1000),prior=scheduled.get(name);
      if(prior&&mode==='earliest'&&prior.dueAt<=dueAt)return transition(name,'scheduled','scheduled',{reason:'earlier-existing',nextEligibleAt:new Date(prior.dueAt).toISOString()});
      if(prior)disarm(prior);
      const entry={job:name,dueAt,callback,timer:null};scheduled.set(name,entry);arm(entry);return transition(name,prior?'scheduled':'idle','scheduled',{nextEligibleAt:new Date(dueAt).toISOString()});
    }
    function clearTimer(job){const name=String(job||''),entry=scheduled.get(name);if(!entry)return false;disarm(entry);scheduled.delete(name);return true;}
    function clearScheduled(job){const name=String(job||''),owned=jobs.get(name);return owned?owned.clear():clearTimer(name);}
    function clearAllScheduled(){for(const owned of jobs.values())owned.clear();for(const entry of scheduled.values())disarm(entry);scheduled.clear();return true;}
    function registerJob(name,ports){
      if(!priority(name)||jobs.has(name))throw new TypeError('Repository background job is invalid or already registered.');
      const {initialDelayMs=1000,discover=true,...jobPorts}=ports;
      const owned=Lifecycle.createJob({...jobPorts,onBlocked:()=>{const row=active.get(name);if(row&&!row.controller.signal.aborted)row.controller.abort(backgroundAbort(row.preemptCode,row.preemptMessage));},minDelayMs:1000,environment:freeze({now:nowMs,setTimeout:(callback,delay)=>{schedule(name,delay,callback);return scheduled.get(name);},clearTimeout:entry=>{if(scheduled.get(name)===entry)clearTimer(name);}})});
      jobs.set(name,owned);if(discover)discoverable.set(name,()=>{try{return typeof discover==='function'?discover()===true:true;}catch(error){try{ports.capture(error);}catch{}return true;}});if(initialDelayMs!==null)owned.schedule(initialDelayMs,'registered');return owned;
    }
    function unregisterJob(name){const owned=jobs.get(name);if(!owned)return false;owned.dispose();jobs.delete(name);discoverable.delete(name);const row=active.get(name);if(row&&!row.controller.signal.aborted)row.controller.abort(backgroundAbort(row.preemptCode,row.preemptMessage));return true;}
    function wake(reason='eligibility',discover=true){if(foreground||suspensions.size)return false;for(const [name,owned] of jobs)owned.wake(reason,discover&&!owned.status().busy&&discoverable.get(name)?.()===true);resumeTimers(true);return true;}
    function suspendTimers(){for(const entry of scheduled.values())disarm(entry);}
    function resumeTimers(refresh=false){if(foreground||suspensions.size)return false;for(const entry of scheduled.values()){if(refresh)disarm(entry);arm(entry);}return true;}
    function suspend(reason='suspended',{preserveForegroundController=null}={}){
      const token=`bg_${(++suspensionSequence).toString(36)}_${nowMs().toString(36)}`,label=String(reason||'suspended'),waiting=[];suspensions.add(token);suspendTimers();
      if(foreground?.respectBackgroundSuspension===true&&foreground.controller!==preserveForegroundController){
        if(!foreground.controller.signal.aborted)foreground.controller.abort(backgroundAbort('REPOSITORY_BACKGROUND_SUSPENDED',`Automatic repository work paused (${label}).`));
        waiting.push(foreground.settlement);
      }
      for(const row of active.values()){if(!row.controller.signal.aborted)row.controller.abort(backgroundAbort(row.preemptCode,`${row.preemptMessage} (${label})`));waiting.push(row.settlement);}
      const settled=waitForSettlement(waiting);return freeze({token,reason:label,settled});
    }
    function resume(value){const token=String(value&&value.token||value||'');if(!token||!suspensions.has(token))return false;suspensions.delete(token);resumeTimers();wake('resume');return true;}
    async function beginBackground(job,{externalSignal=null,budgetMs=0,budgetCode='REPOSITORY_BACKGROUND_BUDGET',budgetMessage='Repository background work reached its work limit.',preemptCode='REPOSITORY_BACKGROUND_PREEMPTED',preemptMessage='Repository background work yielded to a higher-priority operation.'}={}){
      if(String(job)==='convergence'&&Number(budgetMs)>0)throw new TypeError('Background transfers require progress watchdogs, not a total housekeeping deadline.');
      const name=String(job||''),rank=priority(name);if(!rank)throw new TypeError('Repository-background job is invalid.');if(foreground||suspensions.size||externalSignal?.aborted)return null;
      const lower=[];for(const [activeJob,row] of active){if(priority(activeJob)>=rank)return null;lower.push(row);}
      for(const row of lower)if(!row.controller.signal.aborted)row.controller.abort(backgroundAbort(row.preemptCode,row.preemptMessage));
      if(lower.length){try{await waitForSettlement(lower.map(row=>row.settlement),externalSignal);}catch{return null;}}
      if(foreground||suspensions.size||externalSignal?.aborted)return null;
      // A contender may have acquired while the original executor drained.
      // Preempt newly admitted lower work, then retry after its actual release.
      if(active.size){
        for(const [activeJob,row] of [...active])if(priority(activeJob)<rank&&!row.controller.signal.aborted)row.controller.abort(backgroundAbort(row.preemptCode,row.preemptMessage));
        return null;
      }
      const controller=new TargetAbortController(),relay=()=>{if(!controller.signal.aborted)controller.abort(externalSignal?.reason instanceof Error?externalSignal.reason:backgroundAbort(preemptCode,preemptMessage));};
      if(externalSignal){if(externalSignal.aborted)relay();else externalSignal.addEventListener('abort',relay,{once:true});}
      let resolveSettlement;const settlement=new Promise(resolve=>{resolveSettlement=resolve;});let released=false;
      const allowance=Lifecycle.createWorkBudget({now:environment.now,check:()=>{if(controller.signal.aborted)throw controller.signal.reason;},yieldError:()=>backgroundAbort(budgetCode,budgetMessage)});
      const workBudget=freeze({...allowance,start:milliseconds=>{if(name==='convergence')throw new TypeError('Background transfers require progress watchdogs, not a total housekeeping deadline.');return !released&&!controller.signal.aborted&&allowance.start(milliseconds);}});
      if(Number(budgetMs)>0)workBudget.start(budgetMs);
      const row={controller,settlement,preemptCode:String(preemptCode),preemptMessage:String(preemptMessage)};active.set(name,row);
      return freeze({job:name,signal:controller.signal,controller,settlement,workBudget,release:()=>{if(released)return;released=true;if(externalSignal)externalSignal.removeEventListener('abort',relay);if(active.get(name)===row)active.delete(name);resolveSettlement?.();resumeTimers();notifyRelease(name);}});
    }
    function beginForeground({externalSignal=null,cancelCode='REPOSITORY_FOREGROUND_CANCELLED',cancelMessage='Repository foreground operation was cancelled.',respectBackgroundSuspension=false}={}){
      const suspensionAware=respectBackgroundSuspension===true;if(foreground||suspensionAware&&suspensions.size)return null;suspendTimers();
      const controller=new TargetAbortController(),relay=()=>{if(!controller.signal.aborted)controller.abort(externalSignal?.reason instanceof Error?externalSignal.reason:backgroundAbort(cancelCode,cancelMessage));};
      if(externalSignal){if(externalSignal.aborted)relay();else externalSignal.addEventListener('abort',relay,{once:true});}
      const waiting=[];for(const row of active.values()){if(!row.controller.signal.aborted)row.controller.abort(backgroundAbort(row.preemptCode,row.preemptMessage));waiting.push(row.settlement);}
      const settled=waitForSettlement(waiting,controller.signal);let resolveRelease;const settlement=new Promise(resolve=>{resolveRelease=resolve;});let released=false;const row={controller,respectBackgroundSuspension:suspensionAware,settlement};foreground=row;
      const workBudget=Lifecycle.createWorkBudget({now:environment.now,check:()=>{if(controller.signal.aborted)throw controller.signal.reason;},yieldError:()=>backgroundAbort('REPOSITORY_MAINTENANCE_BUDGET','Repository cleanup will continue later.')});
      return freeze({signal:controller.signal,controller,settled,workBudget,release:()=>{if(released)return;released=true;if(externalSignal)externalSignal.removeEventListener('abort',relay);if(foreground===row)foreground=null;resolveRelease?.();resumeTimers();wake('foreground');}});
    }
    function cancelForeground(error){if(!foreground||foreground.controller.signal.aborted)return false;foreground.controller.abort(error instanceof Error?error:backgroundAbort('REPOSITORY_FOREGROUND_CANCELLED',String(error||'Repository foreground operation was cancelled.')));return true;}
    async function preemptBackground(){const waiting=[];for(const row of active.values()){if(!row.controller.signal.aborted)row.controller.abort(backgroundAbort(row.preemptCode,row.preemptMessage));waiting.push(row.settlement);}if(waiting.length)await waitForSettlement(waiting);return waiting.length>0;}
    function jobStatus(job,running=false,lastResult=null){
      const name=String(job||''),entry=scheduled.get(name),owned=jobs.get(name)?.status();
      if(owned)return freeze({...owned,...Lifecycle.snapshot({busy:running||owned.busy||active.has(name),pending:owned.pending,scheduled:!!entry&&entry.timer!==null,suspended:!!foreground||suspensions.size>0||!!owned.blocker,reason:owned.reason,nextEligibleAt:owned.nextEligibleAt,lastResult:lastResult||null}),lastOutcome:lastResult?Lifecycle.outcome(lastResult):owned.lastOutcome});
      return Lifecycle.snapshot({busy:running||active.has(String(job||'')),pending:!!entry||!!lastResult&&Lifecycle.outcome(lastResult)!=='completed'&&lastResult.status!=='idle',scheduled:!!entry&&entry.timer!==null,suspended:!!foreground||suspensions.size>0,reason:lastResult?.reason||'',nextEligibleAt:entry?new Date(entry.dueAt).toISOString():'',lastResult});
    }
    function status(){const owned=[...jobs.keys()].map(name=>jobStatus(name)),due=[...scheduled.values()].map(row=>row.dueAt).concat(owned.map(row=>Date.parse(row.nextEligibleAt))).filter(Number.isFinite);return freeze({...Lifecycle.snapshot({busy:!!foreground||active.size>0||owned.some(row=>row.busy),pending:scheduled.size>0||owned.some(row=>row.pending),scheduled:[...scheduled.values()].some(row=>row.timer!==null),suspended:suspensions.size>0||owned.some(row=>row.suspended),nextEligibleAt:due.length?new Date(Math.min(...due)).toISOString():''}),target,foreground:!!foreground,held:suspensions.size>0,scheduled:freeze([...scheduled.keys()]),active:freeze([...active.keys()])});}
    let api=null;const maintenanceIntent=ports=>createMaintenanceIntent(freeze({...ports,coordinator:api})),createBoundMaintenanceScheduler=ports=>createMaintenanceScheduler(freeze({...ports,coordinator:api})),createBoundIntegrityScheduler=ports=>createIntegrityScheduler(freeze({...ports,coordinator:api}));
    api=freeze({format:'study-director.repository-background-coordinator',contractVersion:1,now:nowMs,maintenance:MAINTENANCE,integrity:INTEGRITY,maintenanceActionable,maintenanceDefersAcrossObservation,maintenancePlan,maintenanceDetails,integrityDetails,outcome:Lifecycle.outcome,maintenanceIntent,createMaintenanceScheduler:createBoundMaintenanceScheduler,createIntegrityScheduler:createBoundIntegrityScheduler,registerJob,unregisterJob,wake,schedule,clearScheduled,clearAllScheduled,suspend,resume,beginBackground,beginForeground,cancelForeground,preemptBackground,onRelease,status,jobStatus,transition,priority});return api;
  }
  function createMaintenanceIntent(input){
    exactObject(input,['capture','clear','coordinator','mark','read','scope','selectRetention'],'Repository maintenance-intent input');
    if(!input.coordinator||input.coordinator.format!=='study-director.repository-background-coordinator'||input.coordinator.contractVersion!==1||typeof input.coordinator.now!=='function')throw new TypeError('Repository maintenance-intent coordinator is invalid.');
    for(const key of ['capture','clear','mark','read','scope'])if(typeof input[key]!=='function')throw new TypeError('Repository maintenance-intent port is invalid.');
    const nowMs=()=>input.coordinator.now();
    async function read({throwOnError=false}={}){
      try{return normalizeMaintenanceState(await input.read());}
      catch(error){input.capture('read',error);if(throwOnError)throw error;return null;}
    }
    async function mark(reason,delay,{expected=undefined,newRequest=false}={}){
      const deadline=freeze({...maintenanceDeadline(delay,reason,nowMs()),...(newRequest?{newRequest:true}:{})});
      try{const result=await input.mark(deadline,expected);return result==='superseded'?'superseded':result===true;}catch(error){input.capture('mark',error);return false;}
    }
    async function clear(expected=undefined){try{const result=await input.clear(expected);return result==='superseded'?'superseded':result!==false;}catch(error){input.capture('clear',error);return false;}}
    async function observe(observation,{delay=MAINTENANCE.continuationMs}={}){
      let pending=null,readFailed=false;try{pending=await read({throwOnError:true});}catch{readFailed=true;}
      const needed=repositoryObservationNeedsMaintenance(observation,input.selectRetention,nowMs());
      if(readFailed&&!needed)return freeze({needed:false,pending:null,schedule:true,delay:MAINTENANCE.errorMs,reason:'state-read-failed',writeFailed:false});
      const preserveDeferred=!!pending&&!maintenanceActionable(pending,nowMs())&&maintenanceDefersAcrossObservation(pending);
      let writeFailed=false;
      if(needed&&(!pending||!preserveDeferred)){
        const marked=await mark('repository-state',delay,{expected:pending});
        if(marked!==false){try{pending=await read({throwOnError:true});}catch{writeFailed=true;}}else writeFailed=true;
      }
      if(writeFailed)return freeze({needed,pending,schedule:true,delay:MAINTENANCE.errorMs,reason:'intent-write-failed',writeFailed:true});
      const schedule=needed||!!pending,wait=pending?maintenanceDelay(pending,nowMs(),delay):Math.max(1000,Number(delay)||MAINTENANCE.continuationMs);
      return freeze({needed,pending,schedule,delay:wait,reason:String(pending&&pending.reason||(needed?'repository-state':'')),writeFailed:false});
    }
    return freeze({format:'study-director.repository-maintenance-intent',contractVersion:1,read,mark,clear,observe,scope:()=>input.scope(),actionable:state=>maintenanceActionable(state,nowMs()),delay:(state,fallback=MAINTENANCE.continuationMs)=>maintenanceDelay(state,nowMs(),fallback),plan:maintenancePlan});
  }

  function createMaintenanceScheduler(input){
    exactObject(input,['budgetCode','budgetMessage','budgetMs','capture','coordinator','execute','intent','isAvailable','isBusy','preemptCode','preemptMessage','report'],'Repository maintenance scheduler input');
    if(!input.coordinator||input.coordinator.format!=='study-director.repository-background-coordinator'||input.coordinator.contractVersion!==1)throw new TypeError('Repository maintenance scheduler coordinator is invalid.');
    if(!input.intent||input.intent.format!=='study-director.repository-maintenance-intent'||input.intent.contractVersion!==1)throw new TypeError('Repository maintenance scheduler intent is invalid.');
    for(const key of ['capture','execute','isAvailable','isBusy','report'])if(typeof input[key]!=='function')throw new TypeError('Repository maintenance scheduler port is invalid.');
    let requestGeneration=0,deferredRequest=null,retainedObservation=null;
    const nowMs=()=>input.coordinator.now();
    function emit(phase,details={}){try{input.report(freeze({phase:String(phase||''),at:new Date(nowMs()).toISOString(),...details}));}catch(error){try{input.capture('report',error);}catch{}}}
    function schedule(delay,trigger='scheduled',mode='earliest'){return job.schedule(Math.max(1000,Number(delay)||1000),trigger,mode);}
    async function persistPending(reason,delay,expected=undefined,newRequest=false){
      const generation=requestGeneration,retry=Math.max(1000,Number(delay)||MAINTENANCE.errorMs),ok=await input.intent.mark(String(reason||'error'),retry,{expected,newRequest}),nextEligibleAt=new Date(nowMs()+retry).toISOString();
      if(ok==='superseded'||expected!==undefined&&generation!==requestGeneration)return freeze({ok:true,superseded:true});
      if(!ok){emit('intent-write-failed',{reason:String(reason||'error'),nextEligibleAt});return freeze({ok:false,retryMs:MAINTENANCE.errorMs,nextEligibleAt:new Date(nowMs()+MAINTENANCE.errorMs).toISOString()});}
      return freeze({ok:true,retryMs:retry,nextEligibleAt});
    }
    async function observe(observation,{delay=MAINTENANCE.continuationMs}={}){
      const decision=await input.intent.observe(observation,{delay}),retryObservation=decision.writeFailed===true||decision.reason==='state-read-failed'&&!decision.pending&&!decision.needed;
      retainedObservation=retryObservation?{observation,delay,scope:input.intent.scope()}:null;
      if(retryObservation||decision.schedule)schedule(decision.delay,decision.reason||'repository-observation',decision.pending?'replace':'earliest');
      emit('observation',{reason:String(decision.reason||''),needed:decision.needed===true,pending:!!decision.pending,writeFailed:decision.writeFailed===true,nextEligibleAt:String(decision.pending&&decision.pending.nextEligibleAt||''),actionable:decision.pending?input.intent.actionable(decision.pending):decision.needed===true});
      return freeze({...decision,retryObservation});
    }
    function retainedRequest(){if(deferredRequest&&deferredRequest.scope!==input.intent.scope())deferredRequest=null;return deferredRequest;}
    function retryRequest(record){record.retryAt=nowMs()+MAINTENANCE.errorMs;schedule(MAINTENANCE.errorMs,'intent-write-failed','replace');emit('intent-write-failed',{reason:'intent-write-failed',pending:true,nextEligibleAt:new Date(record.retryAt).toISOString(),actionable:false});}
    async function request(reason='repository-state',delay=MAINTENANCE.continuationMs,{mode='earliest'}={}){
      const record={generation:++requestGeneration,scope:input.intent.scope(),reason:String(reason||'repository-state'),dueAt:nowMs()+Math.max(1000,Number(delay)||MAINTENANCE.continuationMs),expected:undefined,persisting:true,retryAt:nowMs()+MAINTENANCE.errorMs};deferredRequest=record;
      try{
        try{record.expected=await input.intent.read({throwOnError:true});}catch(error){input.capture('request-state-read',error);if(retainedRequest()===record)retryRequest(record);return false;}
        if(retainedRequest()!==record||record.generation!==requestGeneration)return false;
        const persisted=await persistPending(record.reason,Math.max(1000,record.dueAt-nowMs()));
        if(retainedRequest()!==record||record.generation!==requestGeneration)return false;
        if(!persisted.ok){retryRequest(record);return false;}
        deferredRequest=null;schedule(persisted.retryMs,record.reason,mode);emit('requested',{reason:record.reason,nextEligibleAt:persisted.nextEligibleAt,actionable:persisted.retryMs<=MAINTENANCE.continuationMs});return true;
      }finally{record.persisting=false;}
    }
    async function recoverRequest(){
      const record=retainedRequest();if(!record)return true;
      if(record.persisting||nowMs()<record.retryAt){schedule(Math.max(1000,record.retryAt-nowMs()),'intent-write-failed','earliest');return false;}
      let pending;try{pending=await input.intent.read({throwOnError:true});}catch(error){input.capture('request-state-read',error);if(retainedRequest()===record)retryRequest(record);return false;}
      if(retainedRequest()!==record||record.generation!==requestGeneration)return false;
      const newer=record.expected!==undefined&&pending&&(!record.expected||['requestId','requestedAt','nextEligibleAt','reason','repositoryScope'].some(key=>String(pending[key]||'')!==String(record.expected[key]||'')));
      if(newer){deferredRequest=null;emit('request-superseded',{reason:'newer-request'});return true;}
      // If the original read failed, preserve any existing request's reason and
      // deadline while renewing its identity against older adopted completions.
      const reason=record.expected===undefined&&pending?pending.reason:record.reason,delay=record.expected===undefined&&pending?input.intent.delay(pending):Math.max(1000,record.dueAt-nowMs());
      const persisted=await persistPending(reason,delay,pending,true);
      if(retainedRequest()!==record||record.generation!==requestGeneration)return false;
      if(!persisted.ok){retryRequest(record);return false;}
      deferredRequest=null;emit(persisted.superseded?'request-superseded':'intent-recovered',{reason:persisted.superseded?'newer-request':reason,nextEligibleAt:persisted.nextEligibleAt||'',actionable:false});return true;
    }
    async function preserveNewerRequest(){
      const retained=retainedRequest();if(retained){schedule(Math.max(1000,retained.retryAt-nowMs()),'intent-write-failed','replace');emit('pending',{reason:'intent-write-failed',pending:true,actionable:false});return freeze({status:'pending',pending:true,reason:'newer-request',retryMs:Math.max(1000,retained.retryAt-nowMs()),actionable:false});}
      let pending;
      try{pending=await input.intent.read({throwOnError:true});}
      catch(error){input.capture('state-read',error);schedule(MAINTENANCE.errorMs,'state-read-failed','replace');return freeze({status:'pending',pending:true,reason:'state-read-failed',retryMs:MAINTENANCE.errorMs,actionable:false});}
      if(!pending){input.coordinator.clearScheduled('maintenance');return freeze({status:'idle',pending:false,reason:'request-cleared',retryMs:0,actionable:false});}
      const retryMs=input.intent.delay(pending),nextEligibleAt=String(pending.nextEligibleAt||''),actionable=input.intent.actionable(pending);
      schedule(retryMs,pending.reason||'newer-request','replace');emit('pending',{reason:'newer-request',retryMs,nextEligibleAt,actionable});
      return freeze({status:'pending',pending:true,reason:'newer-request',retryMs,nextEligibleAt,actionable});
    }
    async function adopt(cleanup,{trigger='external-cleanup',pending}={}){
      // External cleanup must capture the serviced intent before starting work.
      if(pending===undefined){pending=await input.intent.read({throwOnError:true});if(pending)return preserveNewerRequest();}
      const generation=requestGeneration,plan=input.intent.plan(cleanup);
      if(cleanup&&cleanup.gcPending===true){
        const persisted=await persistPending(plan.reason,plan.retryMs,pending);if(persisted.superseded)return preserveNewerRequest();const reason=persisted.ok?plan.reason:'intent-write-failed',retryMs=persisted.ok?plan.retryMs:persisted.retryMs,actionable=persisted.ok?plan.actionable:false;
        schedule(retryMs,reason,'replace');emit('adopted',{trigger:String(trigger||'external-cleanup'),status:'pending',reason,retryMs,nextEligibleAt:persisted.nextEligibleAt,actionable,cleanup,plan});return freeze({pending:true,reason,retryMs,nextEligibleAt:persisted.nextEligibleAt,actionable});
      }
      const cleared=await input.intent.clear(pending);
      if(cleared==='superseded'||generation!==requestGeneration)return preserveNewerRequest();
      if(!cleared){const persisted=await persistPending('marker-clear-failed',MAINTENANCE.errorMs,pending);if(persisted.superseded)return preserveNewerRequest();const retryMs=persisted.ok?MAINTENANCE.errorMs:persisted.retryMs,reason=persisted.ok?'marker-clear-failed':'intent-write-failed';schedule(retryMs,reason,'replace');emit('adopted',{trigger:String(trigger||'external-cleanup'),status:'pending',reason,retryMs,nextEligibleAt:persisted.nextEligibleAt,actionable:false,cleanup,plan});return freeze({pending:true,reason,retryMs,nextEligibleAt:persisted.nextEligibleAt,actionable:false});}
      input.coordinator.clearScheduled('maintenance');emit('adopted',{trigger:String(trigger||'external-cleanup'),status:'completed',reason:'complete',retryMs:0,nextEligibleAt:'',actionable:false,cleanup,plan});return freeze({pending:false,reason:'complete',retryMs:0,nextEligibleAt:'',actionable:false});
    }
    async function runAttempt({trigger}){
      return (async()=>{
        if(retainedObservation){const retry=retainedObservation;if(retry.scope!==input.intent.scope())retainedObservation=null;else{await observe(retry.observation,{delay:retry.delay});if(retainedObservation)return freeze({status:'pending',reason:'state-read-failed'});}}
        let pending=null;const generation=requestGeneration;
        if(!await recoverRequest()){const retained=retainedRequest();if(retained)return freeze({status:'pending',pending:true,reason:'intent-write-failed',nextEligibleAt:new Date(retained.retryAt).toISOString()});return preserveNewerRequest();}
        try{pending=await input.intent.read({throwOnError:true});}
        catch(error){input.capture('state-read',error);emit('state-read-failed',{reason:'state-read-failed'});schedule(MAINTENANCE.errorMs,'state-read-failed','replace');return freeze({status:'pending',reason:'state-read-failed',nextEligibleAt:new Date(nowMs()+MAINTENANCE.errorMs).toISOString()});}
        if(!pending){emit('idle',{reason:'no-pending-state'});return freeze({status:'idle',reason:'no-pending-state'});}
        if(!input.intent.actionable(pending)){const delay=input.intent.delay(pending,MAINTENANCE.continuationMs);emit('deferred',{reason:String(pending.reason||trigger),requestedAt:String(pending.requestedAt||''),nextEligibleAt:String(pending.nextEligibleAt||''),actionable:false});schedule(delay,pending.reason||trigger,'replace');return freeze({status:'deferred',reason:String(pending.reason||trigger),nextEligibleAt:String(pending.nextEligibleAt||'')});}
        if(input.isBusy()){const persisted=await persistPending('busy',MAINTENANCE.busyMs,pending);if(persisted.superseded)return preserveNewerRequest();const delay=persisted.ok?MAINTENANCE.busyMs:persisted.retryMs;emit('deferred',{reason:persisted.ok?'busy':'intent-write-failed',nextEligibleAt:persisted.nextEligibleAt,actionable:false});schedule(delay,persisted.ok?'busy':'intent-write-failed','replace');return freeze({status:'pending',reason:persisted.ok?'busy':'intent-write-failed',nextEligibleAt:persisted.nextEligibleAt});}
        const scope=await input.coordinator.beginBackground('maintenance',{budgetMs:Math.max(0,Number(input.budgetMs)||0),budgetCode:String(input.budgetCode||'REPOSITORY_MAINTENANCE_BUDGET'),budgetMessage:String(input.budgetMessage||'Repository maintenance reached its work limit.'),preemptCode:String(input.preemptCode||'REPOSITORY_BACKGROUND_PREEMPTED'),preemptMessage:String(input.preemptMessage||'Repository maintenance yielded to a higher-priority operation.')});
        if(!scope){schedule(MAINTENANCE.busyMs,'background-busy','replace');emit('deferred',{reason:'background-busy',nextEligibleAt:new Date(nowMs()+MAINTENANCE.busyMs).toISOString(),actionable:false});return freeze({status:'deferred',reason:'background-busy'});}
        emit('running',{reason:String(pending.reason||trigger),requestedAt:String(pending.requestedAt||''),nextEligibleAt:String(pending.nextEligibleAt||''),actionable:true,transition:input.coordinator.transition('maintenance','scheduled','running',{reason:String(pending.reason||trigger),nextEligibleAt:String(pending.nextEligibleAt||''),actionable:true})});
        try{
          emit('cleanup-start',{reason:String(pending.reason||trigger)});const cleanup=await input.execute(freeze({signal:scope.signal,workBudget:scope.workBudget,pending,trigger:String(trigger||'scheduled')})),plan=input.intent.plan(cleanup);emit('cleanup-complete',{cleanup,plan});
          if(cleanup&&cleanup.gcPending===true){
            const persisted=await persistPending(plan.reason,plan.retryMs,pending);if(persisted.superseded)return preserveNewerRequest();const reason=persisted.ok?plan.reason:'intent-write-failed',retryMs=persisted.ok?plan.retryMs:persisted.retryMs,state=persisted.ok?plan.state:'failed',actionable=persisted.ok?plan.actionable:false;
            const transition=input.coordinator.transition('maintenance','running',state,{reason,nextEligibleAt:persisted.nextEligibleAt,actionable});emit('pending',{reason,retryMs,nextEligibleAt:persisted.nextEligibleAt,actionable,cleanup,plan,transition});schedule(retryMs,reason,'replace');return freeze({status:'pending',reason,retryMs,nextEligibleAt:persisted.nextEligibleAt,...cleanup});
          }
          const cleared=await input.intent.clear(pending);
          if(cleared==='superseded'||generation!==requestGeneration)return preserveNewerRequest();
          if(!cleared){const persisted=await persistPending('marker-clear-failed',MAINTENANCE.errorMs,pending);if(persisted.superseded)return preserveNewerRequest();const retryMs=persisted.ok?MAINTENANCE.errorMs:persisted.retryMs,reason=persisted.ok?'marker-clear-failed':'intent-write-failed',transition=input.coordinator.transition('maintenance','running','failed',{reason,nextEligibleAt:persisted.nextEligibleAt,actionable:false});emit('pending',{reason,retryMs,nextEligibleAt:persisted.nextEligibleAt,cleanup,transition});schedule(retryMs,reason,'replace');return freeze({status:'pending',reason,retryMs,nextEligibleAt:persisted.nextEligibleAt,...cleanup});}
          const transition=input.coordinator.transition('maintenance','running','completed',{reason:'complete',actionable:false});emit('completed',{reason:'complete',cleanup,transition});return freeze({status:'completed',...cleanup});
        }catch(error){
          const yielded=scope.signal.aborted||error?.name==='AbortError',budgeted=yielded&&String(error?.code||'')===String(input.budgetCode||''),preempted=yielded&&String(error?.code||'')===String(input.preemptCode||'');
          const desiredRetry=budgeted?MAINTENANCE.continuationMs:preempted?MAINTENANCE.busyMs:MAINTENANCE.errorMs,desiredReason=budgeted?'bounded-continuation':preempted?'preempted':'error',persisted=await persistPending(desiredReason,desiredRetry,pending);if(persisted.superseded)return preserveNewerRequest();const retryMs=persisted.ok?desiredRetry:persisted.retryMs,reason=persisted.ok?desiredReason:'intent-write-failed',state=budgeted&&persisted.ok?'scheduled':preempted&&persisted.ok?'deferred':'failed',actionable=budgeted&&persisted.ok,transition=input.coordinator.transition('maintenance','running',state,{reason,nextEligibleAt:persisted.nextEligibleAt,actionable});
          if(!yielded)input.capture('execute',error);emit(yielded?'yielded':'failed',{reason,retryMs,nextEligibleAt:persisted.nextEligibleAt,error,transition,actionable});schedule(retryMs,reason,'replace');return freeze({status:'pending',reason,retryMs,nextEligibleAt:persisted.nextEligibleAt,error:yielded?null:error});
        }finally{scope.release();}
      })().finally(()=>emit('settled'));
    }
    const job=input.coordinator.registerJob('maintenance',{execute:runAttempt,isAvailable:input.isAvailable,capture:error=>input.capture('lifecycle',error),retryMs:MAINTENANCE.errorMs});
    return freeze({format:'study-director.repository-maintenance-scheduler',contractVersion:1,schedule,observe,request,adopt,run:trigger=>job.run(trigger),wake:trigger=>job.wake(trigger,true),status:()=>{const retained=retainedRequest(),state=input.coordinator.jobStatus('maintenance');return freeze({...state,...(retained?{pending:true,reason:'intent-write-failed',nextEligibleAt:new Date(retained.retryAt).toISOString(),state:state.state==='idle'?'pending':state.state}:{}),intentPending:!!retained,running:state.busy});}});
  }

  function integrityCheckpoint(scope,target={}){
    return progress=>{
      if(scope.signal?.aborted)throw scope.signal.reason;
      const partial=progress?.partial,prior=target?.partial,sameObject=partial?.objectId===prior?.objectId&&progress?.scanId===target?.scanId;
      // Scratch initialisation is not verified progress. A completed segment or
      // object is; all callers use the same boundary after durable state save.
      const advanced=!progress||Number(progress.attempted)>0||progress.cursor&&progress.cursor!==target?.cursor||progress.recheckCursor&&progress.recheckCursor!==target?.recheckCursor||['stored','plain'].some(part=>Number(partial?.[part]?.offset)>Number(sameObject?prior?.[part]?.offset||0:0))||Number(partial?.plain?.frame)>Number(sameObject?prior?.plain?.frame||0:0);
      if(advanced)scope.workBudget.advance();scope.workBudget.check();
    };
  }
  function integrityTargetDue(target,now=Date.now()){if(target?.cycleStartedAt||target?.cursor||target?.failedAt)return true;const completed=Date.parse(String(target&&target.completedAt||''));return !Number.isFinite(completed)||Number(now)-completed>=INTEGRITY.intervalMs;}
  function integrityResultDelay(result){if(result&&result.status==='completed')return result.complete?INTEGRITY.intervalMs:INTEGRITY.continueMs;if(result?.status==='yielded'||result?.reason==='budget'||String(result?.reason||'').endsWith('INTEGRITY_BUDGET'))return INTEGRITY.continueMs;if(result&&result.reason==='locked')return INTEGRITY.lockedRetryMs;if(result&&result.status==='unavailable')return INTEGRITY.retryMs;if(result&&result.status==='failed')return result.repaired?INTEGRITY.continueMs:INTEGRITY.failureRetryMs;return INTEGRITY.retryMs;}
  function createIntegrityScheduler(input){
    exactObject(input,['budgetCode','budgetMessage','budgetMs','capture','coordinator','execute','isAvailable','isUnsafe','preemptCode','preemptMessage','readTarget','writeResult','yieldTask'],'Repository integrity scheduler input');
    if(!input.coordinator||input.coordinator.format!=='study-director.repository-background-coordinator'||input.coordinator.contractVersion!==1)throw new TypeError('Repository integrity coordinator is invalid.');
    for(const key of ['capture','execute','isAvailable','isUnsafe','readTarget','writeResult','yieldTask'])if(typeof input[key]!=='function')throw new TypeError('Repository integrity scheduler port is invalid.');
    // An explicit recheck scheduled during an active scan must survive the scan's
    // own recurrence or state retry; only the first outstanding deadline wins.
    function schedule(delay,reason='scheduled'){return job.schedule(Math.max(1000,Number(delay)||1000),reason,'earliest');}
    async function runAttempt({trigger}){
      let stage='state-read';
      return (async()=>{
        const target=await input.readTarget(),now=input.coordinator.now(),completed=Date.parse(String(target&&target.completedAt||''));
        if(!integrityTargetDue(target,now)){schedule(Math.max(1000,INTEGRITY.intervalMs-(now-completed)+1000),'not-due');return freeze({status:'skipped',reason:'not-due'});}
        if(input.isUnsafe()){schedule(INTEGRITY.retryMs,'foreground-busy');return freeze({status:'skipped',reason:'busy'});}
        await input.yieldTask();if(input.isUnsafe()){schedule(INTEGRITY.retryMs,'foreground-busy');return freeze({status:'skipped',reason:'busy'});}
        // A total timer can repeatedly discard a healthy but slow segment.
        // Enforce the work allowance after durable progress; stall watchdogs
        // and the coordinator's foreground signal still interrupt active IO.
        const scope=await input.coordinator.beginBackground('integrity',{budgetMs:0,budgetCode:String(input.budgetCode||'REPOSITORY_INTEGRITY_BUDGET'),budgetMessage:String(input.budgetMessage||'Repository integrity verification reached its work limit.'),preemptCode:String(input.preemptCode||'REPOSITORY_BACKGROUND_PREEMPTED'),preemptMessage:String(input.preemptMessage||'Repository integrity verification yielded to a higher-priority operation.')});
        if(!scope){schedule(INTEGRITY.retryMs,'background-busy');return freeze({status:'skipped',reason:'busy'});}
        try{
          const dueBase=Date.parse(String(target&&target.completedAt||target&&target.cycleStartedAt||'')),nextEligibleAt=Number.isFinite(dueBase)?new Date(dueBase+INTEGRITY.intervalMs).toISOString():new Date(now).toISOString();
          scope.workBudget.start(Math.max(0,Number(input.budgetMs)||0));
          const checkpoint=integrityCheckpoint(scope,target);
          stage='execute';const result=await input.execute(freeze({target,trigger,nextEligibleAt,signal:scope.signal,checkpoint}));stage='state-write';await input.writeResult(result);schedule(integrityResultDelay(result),result&&result.reason||result&&result.status||'completed');return result;
        }finally{scope.release();}
      })().catch(error=>{const yielded=error?.name==='AbortError',budgeted=yielded&&String(error?.code||'')===String(input.budgetCode||''),preempted=yielded&&String(error?.code||'')===String(input.preemptCode||''),stateFailed=stage!=='execute'||error?.code==='REPOSITORY_INTEGRITY_STATE_UNAVAILABLE',changed=error?.code==='REPOSITORY_CHANGED';if(!yielded)input.capture(error);schedule(changed||budgeted?INTEGRITY.continueMs:stateFailed?INTEGRITY.stateRetryMs:preempted?INTEGRITY.retryMs:INTEGRITY.failureRetryMs,changed?'repository-changed':budgeted?'budget':preempted?'preempted':stateFailed?'state-unavailable':'error');return freeze({status:yielded?'skipped':stateFailed||changed?'unavailable':'failed',reason:budgeted?'budget':preempted?'preempted':String(error&&error.message||error)});});
    }
    async function install(){try{const target=await input.readTarget(),completed=Date.parse(String(target&&target.completedAt||'')),now=input.coordinator.now();schedule(integrityTargetDue(target,now)?45000:Math.max(1000,INTEGRITY.intervalMs-(now-completed)+1000),'install');return target;}catch(error){input.capture(error);schedule(INTEGRITY.stateRetryMs,'state-read-failed');return null;}}
    const job=input.coordinator.registerJob('integrity',{initialDelayMs:45000,execute:runAttempt,isAvailable:input.isAvailable,capture:input.capture,retryMs:INTEGRITY.unavailableRetryMs});
    return freeze({format:'study-director.repository-integrity-scheduler',contractVersion:1,schedule,run:trigger=>job.run(trigger),wake:trigger=>job.wake(trigger,true),install,status:()=>input.coordinator.jobStatus('integrity')});
  }
  return freeze({format:'study-director.repository-background-module',contractVersion:1,priority:PRIORITY,maintenance:MAINTENANCE,integrity:INTEGRITY,maintenanceActionable,maintenanceDefersAcrossObservation,maintenancePlan,maintenanceDetails,integrityDetails,createCoordinator,createMaintenanceScheduler,integrityTargetDue,integrityResultDelay,createIntegrityScheduler});
});
})();
