import type {PilotRegistry} from '../../types/pilot.ts';
import type {SessionHooks,SessionOptions,SessionContext,SessionCompletion} from '../../types/session-lifecycle.ts';
(()=>{
'use strict';
const registry=(globalThis as typeof globalThis & {[key:symbol]:PilotRegistry|undefined})[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,functionPort:functions}=registry.contracts;
registry.define('session-lifecycle',1,()=>{
  const freeze=Object.freeze;
  class LifecycleBusyError extends Error{
    code:string;
    constructor(message='Another Study Director lifecycle transition is already active.'){
      super(message);this.name='LifecycleBusyError';this.code='STUDY_DIRECTOR_LIFECYCLE_BUSY';
    }
  }
  function createCoordinator(input:{hooks:SessionHooks}){
    if(!input||!Object.isFrozen(input))throw new TypeError('Session lifecycle input must be frozen.');
    exactObject(input,['hooks'],'Session lifecycle input');
    const hooks=functions(input.hooks,['canMutate','flushPending','prepare','reconcile','complete','capture'],'Session lifecycle hooks');
    let revision=0;
    let active:SessionContext|null=null;
    let last:SessionCompletion|null=null;
    let ready=false;
    function normalizedKind(kind:unknown){return String(kind||'lifecycle-transition').trim()||'lifecycle-transition';}
    function normalizedOptions(options:SessionOptions|null|undefined){
      const source=options&&typeof options==='object'&&!Array.isArray(options)?options:{};
      return freeze({...source});
    }
    function context(kind:unknown,options:SessionOptions):SessionContext{
      return freeze({
        format:'study-director.session-lifecycle-context',contractVersion:1,
        id:`lifecycle-${revision}`,kind:normalizedKind(kind),revision,options:normalizedOptions(options),
        startedAt:new Date().toISOString()
      });
    }
    function begin(kind:unknown,options:SessionOptions={}){
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
    function isCurrent(ctx:SessionContext){return !!(active&&active.id===ctx.id);}
    function supersedeActive(reason:unknown='lifecycle invalidation'){
      if(!active)return null;
      const superseded=active;
      active=null;
      ready=false;
      last=freeze({...superseded,reconciled:false,failed:true,superseded:true,supersededBy:normalizedKind(reason),finishedAt:new Date().toISOString()});
      return superseded;
    }
    function finish(ctx:SessionContext,{reconciled=false,failed=false}={}){
      if(active&&active.id===ctx.id)active=null;
      ready=!!reconciled;
      last=freeze({...ctx,reconciled:!!reconciled,failed:!!failed,finishedAt:new Date().toISOString()});
      hooks.complete(last);
      return last;
    }
    function reconcileContext(ctx:SessionContext,result:unknown){
      if(ctx.options.reconcile===false)return false;
      hooks.reconcile(ctx,result);
      return true;
    }
    function runSync<T>(kind:unknown,options:SessionOptions,operation:(context:SessionContext)=>T extends PromiseLike<unknown>?never:T):T{
      if(typeof operation!=='function')throw new TypeError('Synchronous lifecycle transition requires an operation.');
      const ctx=begin(kind,options);
      try{
        const result=operation(ctx);
        if(result&&typeof (result as {then?:unknown}).then==='function')throw new TypeError('Synchronous lifecycle operation returned a Promise.');
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
    async function run<T>(kind:unknown,options:SessionOptions,operation:(context:SessionContext)=>T|PromiseLike<T>):Promise<T>{
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
    function invalidate(kind:unknown,options:SessionOptions={}){
      supersedeActive(kind);
      const ctx=begin(kind,{...options,reconcile:false});
      finish(ctx,{reconciled:false});
      return ctx;
    }
    function reconcile(kind:unknown,options:SessionOptions={}){return runSync(kind,options,()=>true);}
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
