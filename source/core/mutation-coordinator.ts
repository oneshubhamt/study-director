import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {AuthorityError,AuthorityOptions,MutationAuthority,MutationState,MutationOrigin,LocalLease,MutationInput,JournalFence} from '../../types/mutation-coordinator.ts';
const sdMutationCoordinatorFactory=(()=>{
'use strict';
const registry=(globalThis as typeof globalThis & {[key:symbol]:ModuleRegistration<'mutation-coordinator','study-director.mutation-coordinator-module'>|undefined})[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,functionPort:functions}=registry.contracts;
const createModule=()=>{
  const freeze=Object.freeze;
  function authorityError(message:unknown,{durableProtected=false,cause=null}:{durableProtected?:boolean;cause?:unknown}={}):AuthorityError{
    const error=Object.assign(new Error(String(message||'Data mutation authority was lost.')),{code:'STUDY_DIRECTOR_MUTATION_AUTHORITY_LOST' as const,durableProtected:durableProtected===true});
    error.name='AbortError';error.code='STUDY_DIRECTOR_MUTATION_AUTHORITY_LOST';error.durableProtected=durableProtected===true;
    if(cause)error.cause=cause;
    return error;
  }
  function createCoordinator(input:MutationInput){
    exactObject(input,['configuration','durable','environment','hooks','identity','local'],'Mutation coordinator input');
    const configuration=exactObject(input.configuration,['heartbeatMs','leaseMs','lockName','storageKey'],'Mutation coordinator configuration');
    functions(input.durable,['acquire','release'],'Mutation coordinator durable lease port');
    exactObject(input.environment,['AbortController','addStorageListener','clearInterval','locks','now','randomIdPart','setInterval','setTimeout'],'Mutation coordinator environment');
    if(typeof input.environment.AbortController!=='function'||typeof input.environment.addStorageListener!=='function'||typeof input.environment.clearInterval!=='function'||typeof input.environment.now!=='function'||typeof input.environment.randomIdPart!=='function'||typeof input.environment.setInterval!=='function'||typeof input.environment.setTimeout!=='function')throw new TypeError('Mutation coordinator environment is invalid.');
    functions(input.hooks,['foreignReleased','refreshUi','scheduleUpdate'],'Mutation coordinator hooks');
    functions(input.identity,['canMutate','status'],'Mutation coordinator identity port');
    functions(input.local,['getJson','remove','setJson'],'Mutation coordinator local lease port');
    const LEASE_MS=Math.max(5000,Number(configuration.leaseMs)||20000),HEARTBEAT_MS=Math.max(1000,Number(configuration.heartbeatMs)||5000),LOCK_NAME=String(configuration.lockName||''),STORAGE_KEY=String(configuration.storageKey||'');
    let active:MutationState|null=null,activePromise:Promise<unknown>=Promise.resolve(),sequence=0;
    const faults=new Map<string,string>();
    const firstFault=()=>faults.entries().next().value;
    const recoveryFamily=(kind:string)=>kind==='library-clear-recovery'?'library-clear':kind==='restore-recovery'?'restore':'';
    const blockingFault=(kind:string)=>[...faults].find(([key])=>key!==recoveryFamily(kind))?.[1]||'';
    const isRecoveryKind=(kind:string)=>kind==='restore-recovery'||kind==='library-clear-recovery';
    const nowMs=()=>{const value=Number(input.environment.now());return Number.isFinite(value)?value:Date.now();};
    function identity():MutationOrigin{const status=input.identity.status();return freeze({tabId:String(status.tabId||''),pageId:String(status.pageId||''),claimId:String(status.claimId||''),revision:status.revision});}
    function ownerIdentity(own:MutationOrigin){return `tab_${own.tabId}_${own.pageId}_${own.claimId}`.replace(/[^a-z0-9_-]/gi,'_').slice(0,164);}
    function lease(){const value=input.local.getJson(STORAGE_KEY,null) as LocalLease|null|undefined;return value&&value.version===1?value:null;}
    function sameOwner(value:LocalLease|null|undefined,own:MutationOrigin):boolean{return !!(value&&value.tabId===own.tabId&&value.pageId===own.pageId&&value.claimId===own.claimId);}
    function originCurrent(state:MutationState){const current=identity();return active===state&&state.phase!=='retired'&&input.identity.canMutate()&&sameOwner(current,state.origin)&&current.revision===state.origin.revision;}
    function assertOrigin(state:MutationState){if(!originCurrent(state))throw authorityError('Study control changed during the protected data operation.');}
    // A tab closed in the middle of a change leaves its lease until it runs
    // out, and nothing announces that: a tab that finds one looks again when
    // it ends (a live tab renews it first, and the look then waits again).
    let foreignExpiry:number|null=null;
    function watchForeignExpiry(value:LocalLease){
      if(foreignExpiry!==null)return;
      foreignExpiry=input.environment.setTimeout(()=>{foreignExpiry=null;if(foreignActive())return;refreshUi();input.hooks.foreignReleased();},Math.max(50,Number(value.expiresAt)-nowMs()+50));
    }
    function foreignActive(){const value=lease(),foreign=!!(value&&!sameOwner(value,identity())&&Number(value.expiresAt)>nowMs());if(foreign)watchForeignExpiry(value);return foreign;}
    function writesBlocked(){return foreignActive()||!!blockingFault(active?.phase==='active'?active.kind:'');}
    function writeLease(state:MutationState){
      assertOrigin(state);
      const {tabId,pageId,claimId}=state.origin,value={version:1,tabId,pageId,claimId,kind:state.kind,id:state.id,expiresAt:state.expiresAt};
      if(!input.local.setJson(STORAGE_KEY,value))throw new Error('The cross-tab mutation lock could not be persisted. No changes were made.');
      const verified=lease();if(!sameOwner(verified,state.origin)||verified?.id!==state.id)throw new Error('Another tab acquired the data mutation lock. No changes were made.');
      assertOrigin(state);
    }
    function clearLease(state:MutationState){const value=lease();if(sameOwner(value,state.origin)&&value?.id===state.id)input.local.remove(STORAGE_KEY);}
    function refreshUi(){input.hooks.refreshUi();}
    function blocksUi(){return !!active||foreignActive()||faults.size>0;}
    async function durableAcquire(state:MutationState,renew=false){
      assertOrigin(state);
      const expiresAt=nowMs()+LEASE_MS;
      const result=await input.durable.acquire({kind:state.kind,id:state.id,owner:state.owner,expiresAt,...(renew?{renew:true}:{})});
      return {result,expiresAt};
    }
    async function acquireInitial(state:MutationState){
      let proof=await durableAcquire(state);assertOrigin(state);
      if(!proof.result.acquired&&isRecoveryKind(state.kind)){
        const waitMs=Math.max(0,Math.min(LEASE_MS+1000,Number(proof.result.holder?.expiresAt)-nowMs()+50));
        if(waitMs)await new Promise<void>(resolve=>input.environment.setTimeout(resolve,waitMs));
        assertOrigin(state);proof=await durableAcquire(state);assertOrigin(state);
      }
      if(!proof.result.acquired)throw new Error('Another Study Director tab is changing stored data. Wait for it to finish.');
      if(proof.expiresAt<=nowMs())throw authorityError('The durable mutation lease expired before acquisition was acknowledged.');
      state.expiresAt=proof.expiresAt;writeLease(state);
    }
    function loseAuthority(state:MutationState,error:unknown,{durableProtected=false}={}){
      if(active!==state||state.phase!=='active')return false;
      const existing=state.authorityError;
      if(existing&&!(existing.durableProtected===true&&durableProtected!==true))return false;
      const reason=authorityError(error instanceof Error?error.message:String(error||'Data mutation authority was lost.'),{durableProtected,cause:error instanceof Error?error:null});
      state.authorityError=reason;
      // A mirror-only failure permits rollback under the same unexpired
      // durable lease and original app owner, never a successor claim.
      if(!durableProtected)faults.set(state.kind,reason.message);
      if(!state.controller.signal.aborted)state.controller.abort(reason);
      refreshUi();return true;
    }
    function checkProtection(state:MutationState){
      if(active!==state||state.phase!=='active')throw authorityError('The protected data operation is no longer active.');
      if(!originCurrent(state))loseAuthority(state,authorityError('Study control changed during the protected data operation.'));
      else if(state.expiresAt<=nowMs())loseAuthority(state,authorityError('The durable data mutation lease expired.'));
    }
    function assertOperation(state:MutationState,options:AuthorityOptions={}):true{
      checkProtection(state);
      const error=state.authorityError;
      if(error){if(options.allowDurableProtected&&error.durableProtected)return true;throw error;}
      return true;
    }
    async function refreshAuthority(state:MutationState){
      try{
        assertOperation(state,{allowDurableProtected:true});
        const previousExpiry=state.expiresAt,proof=await durableAcquire(state,true);
        if(active!==state||state.phase!=='active')return;
        checkProtection(state);
        if(state.authorityError&&!state.authorityError.durableProtected)return;
        if(!proof.result.acquired||previousExpiry<=nowMs()||proof.expiresAt<=nowMs())throw authorityError('The durable data mutation lease could not be renewed safely.');
        state.expiresAt=proof.expiresAt;
        try{writeLease(state);}
        catch(error){loseAuthority(state,error,{durableProtected:originCurrent(state)&&state.expiresAt>nowMs()});}
      }catch(error){loseAuthority(state,error);}
    }
    // Backup preflight uses this ambient check outside an exclusive operation.
    // The authority supplied to a callback below is instead bound to its own
    // reservation; a retired callback can never borrow a later operation.
    function assertAuthority(options:AuthorityOptions={}):true{
      return active?assertOperation(active,options):true;
    }
    async function execute<T>(state:MutationState,operation:(authority:MutationAuthority)=>T|PromiseLike<T>):Promise<T>{
      let heartbeat:number|null=null,refreshing=false,heartbeatRefresh:Promise<void>=Promise.resolve();
      try{
        await acquireInitial(state);assertOrigin(state);
        state.phase='active';refreshUi();
        heartbeat=input.environment.setInterval(()=>{
          if(refreshing||active!==state||state.phase!=='active')return;
          refreshing=true;heartbeatRefresh=refreshAuthority(state).finally(()=>{refreshing=false;});
        },HEARTBEAT_MS);
        const authority:MutationAuthority=freeze({
          signal:state.controller.signal,assert:(options?:AuthorityOptions)=>assertOperation(state,options),
          status:()=>{const protectedHere=state.phase==='active'&&originCurrent(state)&&state.expiresAt>nowMs();return freeze({healthy:protectedHere&&!state.authorityError,durableProtected:protectedHere&&(!state.authorityError||state.authorityError.durableProtected)});}
        });
        authority.assert();const result=await operation(authority);authority.assert();return result;
      }finally{
        state.phase='retired';
        if(heartbeat!==null)input.environment.clearInterval(heartbeat);
        await heartbeatRefresh;
        // Even an ambiguous acquisition may have committed. Release only
        // this attempt's durable and local identities, not the live owner.
        try{await input.durable.release(state.id,state.owner);}
        catch(error){faults.set(state.kind,`The durable mutation lock could not be released safely: ${error instanceof Error?error.message:String(error)}`);}
        clearLease(state);
      }
    }
    async function runExclusive<T>(kind:unknown,operation:(authority:MutationAuthority)=>T|PromiseLike<T>):Promise<T>{
      if(typeof operation!=='function')throw new TypeError('Mutation operation is required.');if(active)throw new Error(`Another ${active.kind} operation is already running.`);
      const operationKind=String(kind||'mutation');const blocked=blockingFault(operationKind);if(blocked)throw new Error(blocked);if(!input.identity.canMutate())throw new Error('Study control is required before changing stored data.');if(foreignActive()&&!isRecoveryKind(operationKind))throw new Error('Another Study Director tab is changing stored data. Wait for it to finish.');
      const origin=identity();if(!origin.claimId||!Number.isSafeInteger(origin.revision))throw authorityError('Study control could not be verified.');
      const state:MutationState={kind:operationKind,id:`mutation_${nowMs().toString(36)}_${input.environment.randomIdPart(10)}_${(++sequence).toString(36)}`,origin,owner:ownerIdentity(origin),phase:'pending',expiresAt:0,controller:new input.environment.AbortController(),authorityError:null};
      active=state;
      const task=Promise.resolve().then(async()=>{
        assertOrigin(state);
        const locks=input.environment.locks;
        if(locks&&typeof locks.request==='function')return locks.request(LOCK_NAME,{mode:'exclusive',ifAvailable:true},lock=>{if(!lock)throw new Error('Another Study Director tab is changing stored data. Wait for it to finish.');return execute(state,operation);});
        return execute(state,operation);
      }).finally(()=>{
        state.phase='retired';if(active===state)active=null;
        refreshUi();input.hooks.scheduleUpdate(250);
      });
      activePromise=task.catch(()=>{});refreshUi();return task;
    }
    function journalFence(options:AuthorityOptions={}):JournalFence{
      const state=active;if(!state)throw authorityError('Journal mutation requires an active protected data operation.');
      assertOperation(state,options);const rollback=options.allowDurableProtected===true;
      return freeze({id:state.id,owner:state.owner,assert:()=>assertOperation(state,{allowDurableProtected:rollback})});
    }
    function failClosed(message:unknown,kind='restore'){faults.set(String(kind||'data'),String(message||'Interrupted recovery must finish before data can be changed.'));refreshUi();return false;}
    function clearFault(kind='restore'){faults.delete(kind);refreshUi();return true;}
    input.environment.addStorageListener(event=>{if(event&&event.key===STORAGE_KEY)refreshUi();});
    return freeze({format:'study-director.mutation-coordinator',contractVersion:1,runExclusive,assertAuthority,signal:()=>active?.phase==='active'?active.controller.signal:null,settled:()=>activePromise,foreignActive,writesBlocked,blocksUi,failClosed,clearFault,journalFence,status:()=>freeze({active:active&&active.kind||'',foreign:foreignActive(),recoveryFault:firstFault()?.[1]||'',recoveryKind:firstFault()?.[0]||'',authorityHealthy:!(active&&active.authorityError),authorityDurableProtected:active&&active.authorityError?active.authorityError.durableProtected===true:true})});
  }
  return freeze({format:'study-director.mutation-coordinator-module',contractVersion:1,createCoordinator});
};
registry.define('mutation-coordinator',1,createModule);
return createModule;
})();
export type MutationCoordinatorModule=ReturnType<typeof sdMutationCoordinatorFactory>;
