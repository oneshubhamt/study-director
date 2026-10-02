(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,functionPort:functions}=registry.contracts;
registry.define('session-lifecycle',1,()=>{
  const freeze=Object.freeze;
  class LifecycleBusyError extends Error{
    constructor(message='Another Study Director lifecycle transition is already active.'){
      super(message);this.name='LifecycleBusyError';this.code='STUDY_DIRECTOR_LIFECYCLE_BUSY';
    }
  }
  function createCoordinator(input){
    if(!input||!Object.isFrozen(input))throw new TypeError('Session lifecycle input must be frozen.');
    exactObject(input,['hooks'],'Session lifecycle input');
    const hooks=functions(input.hooks,['canMutate','flushPending','prepare','reconcile','complete','capture'],'Session lifecycle hooks');
    let revision=0;
    let active=null;
    let last=null;
    let ready=false;
    function normalizedKind(kind){return String(kind||'lifecycle-transition').trim()||'lifecycle-transition';}
    function normalizedOptions(options){
      const source=options&&typeof options==='object'&&!Array.isArray(options)?options:{};
      return freeze({...source});
    }
    function context(kind,options){
      return freeze({
        format:'study-director.session-lifecycle-context',contractVersion:1,
        id:`lifecycle-${revision}`,kind:normalizedKind(kind),revision,options:normalizedOptions(options),
        startedAt:new Date().toISOString()
      });
    }
    function begin(kind,options={}){
      if(active)throw new LifecycleBusyError(`${active.kind} is still reconciling.`);
      const normalized=normalizedOptions(options);
      hooks.flushPending(normalizedKind(kind),normalized);
      revision+=1;
      ready=false;
      const next=context(kind,normalized);
      active=next;
      hooks.prepare(next);
      return next;
    }
    function isCurrent(ctx){return !!(active&&active.id===ctx.id);}
    function supersedeActive(reason='lifecycle invalidation'){
      if(!active)return null;
      const superseded=active;
      active=null;
      ready=false;
      last=freeze({...superseded,reconciled:false,failed:true,superseded:true,supersededBy:normalizedKind(reason),finishedAt:new Date().toISOString()});
      return superseded;
    }
    function finish(ctx,{reconciled=false,failed=false}={}){
      if(active&&active.id===ctx.id)active=null;
      ready=!!reconciled;
      last=freeze({...ctx,reconciled:!!reconciled,failed:!!failed,finishedAt:new Date().toISOString()});
      hooks.complete(last);
      return last;
    }
    function reconcileContext(ctx,result){
      if(ctx.options.reconcile===false)return false;
      hooks.reconcile(ctx,result);
      return true;
    }
    function runSync(kind,options,operation){
      if(typeof operation!=='function')throw new TypeError('Synchronous lifecycle transition requires an operation.');
      const ctx=begin(kind,options);
      try{
        const result=operation(ctx);
        if(result&&typeof result.then==='function')throw new TypeError('Synchronous lifecycle operation returned a Promise.');
        if(!isCurrent(ctx))return result;
        const reconciled=reconcileContext(ctx,result);
        finish(ctx,{reconciled});
        return result;
      }catch(error){
        if(!isCurrent(ctx))throw error;
        try{reconcileContext(ctx,null);}catch(reconcileError){hooks.capture('session-lifecycle.reconcile-after-failure',reconcileError,'error');}
        finish(ctx,{reconciled:ctx.options.reconcile!==false,failed:true});
        throw error;
      }
    }
    async function run(kind,options,operation){
      if(typeof operation!=='function')throw new TypeError('Lifecycle transition requires an operation.');
      const ctx=begin(kind,options);
      try{
        const result=await operation(ctx);
        if(!isCurrent(ctx))return result;
        const reconciled=ctx.options.reconcile===false?false:(await hooks.reconcile(ctx,result),true);
        finish(ctx,{reconciled});
        return result;
      }catch(error){
        if(!isCurrent(ctx))throw error;
        try{if(ctx.options.reconcile!==false)await hooks.reconcile(ctx,null);}catch(reconcileError){hooks.capture('session-lifecycle.reconcile-after-failure',reconcileError,'error');}
        finish(ctx,{reconciled:ctx.options.reconcile!==false,failed:true});
        throw error;
      }
    }
    function invalidate(kind,options={}){
      supersedeActive(kind);
      const ctx=begin(kind,{...options,reconcile:false});
      finish(ctx,{reconciled:false});
      return ctx;
    }
    function reconcile(kind,options={}){return runSync(kind,options,()=>true);}
    function canWrite(){return !active&&ready&&hooks.canMutate();}
    function status(){
      return freeze({
        format:'study-director.session-lifecycle-status',contractVersion:1,
        revision,transitioning:!!active,ready,active,last,canWrite:canWrite()
      });
    }
    return freeze({
      format:'study-director.session-lifecycle-coordinator',contractVersion:1,
      run,runSync,invalidate,reconcile,canWrite,status,
      get revision(){return revision;},
      get transitioning(){return !!active;}
    });
  }
  return freeze({
    format:'study-director.session-lifecycle',contractVersion:1,
    LifecycleBusyError,createCoordinator
  });
});
})();
