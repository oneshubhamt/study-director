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
    let pendingFlush:{readonly token:number;readonly kind:string}|null=null;
    let flushToken=0;
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
    function busyKind(){return active?.kind||pendingFlush?.kind||'';}
    function requireIdle(){
      const busy=busyKind();
      if(busy)throw new LifecycleBusyError(`${busy} is still reconciling.`);
    }
    function start(kind:unknown,normalized:SessionOptions){
      revision+=1;
      ready=false;
      const next=context(kind,normalized);
      active=next;
      try{hooks.prepare(next);}
      catch(error){
        finish(next,{reconciled:false,failed:true});
        throw error;
      }
      return next;
    }
    function beginSync(kind:unknown,options:SessionOptions={}){
      requireIdle();
      const normalized=normalizedOptions(options),name=normalizedKind(kind);
      ready=false;
      const pending=hooks.flushPending(name,normalized);
      if(pending&&typeof (pending as {then?:unknown}).then==='function'){
        void Promise.resolve(pending).catch(error=>hooks.capture('session-lifecycle.sync-flush-rejected',error,'error'));
        throw new TypeError('Synchronous lifecycle transition cannot await the pending Review flush.');
      }
      return start(name,normalized);
    }
    async function begin(kind:unknown,options:SessionOptions={}){
      requireIdle();
      const normalized=normalizedOptions(options),name=normalizedKind(kind),token=++flushToken;
      ready=false;
      const ticket=freeze({token,kind:name});pendingFlush=ticket;
      try{await hooks.flushPending(name,normalized);}
      finally{if(pendingFlush===ticket)pendingFlush=null;}
      if(token!==flushToken)throw new LifecycleBusyError(`${name} was superseded before its pending Review flush settled.`);
      return start(name,normalized);
    }
    function isCurrent(ctx:SessionContext){return !!(active&&active.id===ctx.id);}
    function supersedeActive(reason:unknown='lifecycle invalidation'){
      const superseded=active;
      if(pendingFlush){flushToken+=1;pendingFlush=null;}
      if(!superseded){ready=false;return null;}
      active=null;
      ready=false;
      last=freeze({...superseded,reconciled:false,failed:true,superseded:true,supersededBy:normalizedKind(reason),finishedAt:new Date().toISOString()});
      return superseded;
    }
    function finish(ctx:SessionContext,{reconciled=false,failed=false}={}){
      if(active&&active.id===ctx.id)active=null;
      ready=!!reconciled&&!failed;
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
      const ctx=beginSync(kind,options);
      try{
        const result=operation(ctx);
        if(result&&typeof (result as {then?:unknown}).then==='function')throw new TypeError('Synchronous lifecycle operation returned a Promise.');
        if(!isCurrent(ctx))return result;
        const reconciled=reconcileContext(ctx,result);
        finish(ctx,{reconciled});
        return result;
      }catch(error){
        if(!isCurrent(ctx))throw error;
        finish(ctx,{reconciled:false,failed:true});
        throw error;
      }
    }
    async function run<T>(kind:unknown,options:SessionOptions,operation:(context:SessionContext)=>T|PromiseLike<T>):Promise<T>{
      if(typeof operation!=='function')throw new TypeError('Lifecycle transition requires an operation.');
      const ctx=await begin(kind,options);
      try{
        const result=await operation(ctx);
        if(!isCurrent(ctx))return result;
        const reconciled=ctx.options.reconcile===false?false:(await hooks.reconcile(ctx,result),true);
        finish(ctx,{reconciled});
        return result;
      }catch(error){
        if(!isCurrent(ctx))throw error;
        finish(ctx,{reconciled:false,failed:true});
        throw error;
      }
    }
    function invalidate(kind:unknown,options:SessionOptions={}){
      supersedeActive(kind);
      requireIdle();
      const ctx=start(kind,normalizedOptions({...options,reconcile:false}));
      finish(ctx,{reconciled:false});
      return ctx;
    }
    function reconcile(kind:unknown,options:SessionOptions={}){
      requireIdle();
      const ctx=start(kind,normalizedOptions(options));
      try{
        const reconciled=reconcileContext(ctx,true);
        finish(ctx,{reconciled});
        return reconciled;
      }catch(error){
        if(isCurrent(ctx))finish(ctx,{reconciled:false,failed:true});
        throw error;
      }
    }
    function canWrite(){return !active&&!pendingFlush&&ready&&hooks.canMutate();}
    function status(){
      return freeze({
        format:'study-director.session-lifecycle-status',contractVersion:1,
        revision,transitioning:!!active||!!pendingFlush,ready,active,last,canWrite:canWrite()
      });
    }
    return freeze({
      format:'study-director.session-lifecycle-coordinator',contractVersion:1,
      run,runSync,invalidate,reconcile,canWrite,status,
      get revision(){return revision;},
      get transitioning(){return !!active||!!pendingFlush;}
    });
  }
  return freeze({
    format:'study-director.session-lifecycle',contractVersion:1,
    LifecycleBusyError,createCoordinator
  });
});
})();
