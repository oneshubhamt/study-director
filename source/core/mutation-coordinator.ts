import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {AuthorityError,AuthorityOptions,MutationAuthority,MutationState,LocalLease,MutationInput} from '../../types/mutation-coordinator.ts';
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
    let active:MutationState|null=null,activePromise:Promise<unknown>=Promise.resolve(),heartbeat:number|null=null,heartbeatRefresh:Promise<void>=Promise.resolve(),recoveryFault='',recoveryKind='';
    const isRecoveryKind=(kind:string)=>kind==='restore-recovery'||kind==='library-clear-recovery';
    const nowMs=()=>{const value=Number(input.environment.now());return Number.isFinite(value)?value:Date.now();};
    function identity(){const status=input.identity.status();return {tabId:String(status.tabId||''),pageId:String(status.pageId||''),claimId:String(status.claimId||'')};}
    function ownerIdentity(){const own=identity();return `tab_${own.tabId}_${own.pageId}_${own.claimId}`.replace(/[^a-z0-9_-]/gi,'_').slice(0,164);}
    function lease(){const value=input.local.getJson(STORAGE_KEY,null) as LocalLease|null|undefined;return value&&value.version===1?value:null;}
    function sameOwner(value:LocalLease|null|undefined):boolean{const own=identity();return !!(value&&value.tabId===own.tabId&&value.pageId===own.pageId&&value.claimId===own.claimId);}
    // A tab closed in the middle of a change leaves its lease until it runs
    // out, and nothing announces that: a tab that finds one looks again when
    // it ends (a live tab renews it first, and the look then waits again).
    let foreignExpiry:number|null=null;
    function watchForeignExpiry(value:LocalLease){
      if(foreignExpiry!==null)return;
      foreignExpiry=input.environment.setTimeout(()=>{foreignExpiry=null;if(foreignActive())return;refreshUi();input.hooks.foreignReleased();},Math.max(50,Number(value.expiresAt)-nowMs()+50));
    }
    function foreignActive(){const value=lease(),foreign=!!(value&&!sameOwner(value)&&Number(value.expiresAt)>nowMs());if(foreign)watchForeignExpiry(value);return foreign;}
    function writesBlocked(){return foreignActive()||!!(recoveryFault&&!(active&&isRecoveryKind(active.kind)));}
    function writeLease(kind:string,id:string){
      const own=identity(),value={version:1,...own,kind,id,expiresAt:nowMs()+LEASE_MS};
      if(!own.claimId||!input.local.setJson(STORAGE_KEY,value))throw new Error('The cross-tab mutation lock could not be persisted. No changes were made.');
      const verified=lease();if(!sameOwner(verified)||verified?.id!==id)throw new Error('Another tab acquired the data mutation lock. No changes were made.');return value;
    }
    function clearLease(id:string){const value=lease();if(sameOwner(value)&&(!id||value?.id===id))input.local.remove(STORAGE_KEY);}
    function refreshUi(){input.hooks.refreshUi();}
    function blocksUi(){return !!active||foreignActive()||!!recoveryFault;}
    async function durableAcquire(kind:string,id:string,{waitRecovery=false}={}){
      let result=await input.durable.acquire({kind,id,owner:ownerIdentity(),expiresAt:nowMs()+LEASE_MS});
      if(!result.acquired&&waitRecovery&&isRecoveryKind(kind)){
        const waitMs=Math.max(0,Math.min(LEASE_MS+1000,Number(result.holder&&result.holder.expiresAt)-nowMs()+50));if(waitMs)await new Promise<void>(resolve=>input.environment.setTimeout(resolve,waitMs));
        result=await input.durable.acquire({kind,id,owner:ownerIdentity(),expiresAt:nowMs()+LEASE_MS});
      }
      return result;
    }
    async function acquireInitial(kind:string,id:string){
      const result=await durableAcquire(kind,id,{waitRecovery:true});if(!result.acquired)throw new Error('Another Study Director tab is changing stored data. Wait for it to finish.');
      try{writeLease(kind,id);}catch(error){try{await input.durable.release(id);}catch{}throw error;}
    }
    function loseAuthority(error:unknown,{durableProtected=false}={}){
      if(!active)return false;
      const existing=active.authorityError;
      if(existing&&!(existing.durableProtected===true&&durableProtected!==true))return false;
      const reason=authorityError(error&&(error as {message?:unknown}).message||String(error||'Data mutation authority was lost.'),{durableProtected,cause:error instanceof Error?error:null});
      active.authorityError=reason;
      // A failed localStorage mirror renewal is still fail-closed for the active
      // operation, but the strict IndexedDB lease remains authoritative. Do not
      // convert that recoverable lock-layer degradation into a persistent app-wide
      // recovery fault. Losing the durable lease itself is different: mutation
      // authority is no longer proven, so later writes must remain blocked.
      if(durableProtected!==true){recoveryFault=reason.message||String(reason);recoveryKind=active.kind;}
      try{if(!active.controller.signal.aborted)active.controller.abort(reason);}catch{}
      refreshUi();return true;
    }
    async function refreshAuthority(kind:string,id:string){
      let result;
      try{result=await durableAcquire(kind,id,{waitRecovery:false});}
      catch(error){loseAuthority(error,{durableProtected:false});return false;}
      if(!result.acquired){loseAuthority(new Error('Another Study Director tab acquired the durable data mutation lease.'),{durableProtected:false});return false;}
      try{writeLease(kind,id);return true;}
      catch(error){
        // The durable IndexedDB lease is still ours. Do not release the strongest lock merely
        // because the localStorage mirror could not be renewed. Stop forward mutation instead.
        loseAuthority(error,{durableProtected:true});return false;
      }
    }
    function assertAuthority(options:AuthorityOptions={}):true{
      const allowDurableProtected=options&&options.allowDurableProtected===true;
      if(active&&active.authorityError){if(allowDurableProtected&&active.authorityError.durableProtected===true)return true;throw active.authorityError;}
      if(active&&active.controller.signal.aborted){const reason:unknown=active.controller.signal.reason;if(allowDurableProtected&&reason&&(reason as {durableProtected?:unknown}).durableProtected===true)return true;throw reason instanceof Error?reason:authorityError('Data mutation authority was lost.');}
      return true;
    }
    async function execute<T>(kind:string,id:string,operation:(authority:MutationAuthority)=>T|PromiseLike<T>):Promise<T>{
      await acquireInitial(kind,id);
      const controller=new input.environment.AbortController(),state:MutationState={kind,id,startedAt:new Date().toISOString(),controller,authorityError:null};active=state;refreshUi();
      let refreshing=false;
      heartbeat=input.environment.setInterval(()=>{
        if(refreshing||active!==state)return;refreshing=true;heartbeatRefresh=(async()=>{try{await refreshAuthority(kind,id);}finally{refreshing=false;}})();
      },HEARTBEAT_MS);
      const authority=freeze({signal:controller.signal,assert:assertAuthority,status:()=>freeze({healthy:!state.authorityError,durableProtected:state.authorityError?state.authorityError.durableProtected===true:true})});
      try{const result=await operation(authority);assertAuthority();return result;}
      finally{
        if(heartbeat){input.environment.clearInterval(heartbeat);heartbeat=null;}await heartbeatRefresh;
        try{await input.durable.release(id);}catch(error){recoveryFault=`The durable mutation lock could not be released safely: ${error&&(error as {message?:unknown}).message||error}`;recoveryKind=kind;}
        clearLease(id);if(active===state)active=null;refreshUi();input.hooks.scheduleUpdate(250);
      }
    }
    async function runExclusive<T>(kind:unknown,operation:(authority:MutationAuthority)=>T|PromiseLike<T>):Promise<T>{
      if(typeof operation!=='function')throw new TypeError('Mutation operation is required.');if(active)throw new Error(`Another ${active.kind} operation is already running.`);
      const operationKind=String(kind||'mutation');if(recoveryFault&&!isRecoveryKind(operationKind))throw new Error(recoveryFault);if(!input.identity.canMutate())throw new Error('Study control is required before changing stored data.');if(foreignActive()&&!isRecoveryKind(operationKind))throw new Error('Another Study Director tab is changing stored data. Wait for it to finish.');
      const id=`mutation_${nowMs().toString(36)}_${input.environment.randomIdPart(10)}`,task=(async()=>{
        const locks=input.environment.locks;
        if(locks&&typeof locks.request==='function')return locks.request(LOCK_NAME,{mode:'exclusive',ifAvailable:true},lock=>{if(!lock)throw new Error('Another Study Director tab is changing stored data. Wait for it to finish.');return execute(operationKind,id,operation);});
        return execute(operationKind,id,operation);
      })();activePromise=task.catch(()=>{});return task;
    }
    function failClosed(message:unknown,kind='restore'){recoveryFault=String(message||'Interrupted recovery must finish before data can be changed.');recoveryKind=String(kind||'data');refreshUi();return false;}
    function clearFault(){recoveryFault='';recoveryKind='';refreshUi();return true;}
    input.environment.addStorageListener(event=>{if(event&&event.key===STORAGE_KEY)refreshUi();});
    return freeze({format:'study-director.mutation-coordinator',contractVersion:1,runExclusive,assertAuthority,signal:()=>active&&active.controller.signal||null,settled:()=>activePromise,foreignActive,writesBlocked,blocksUi,failClosed,clearFault,status:()=>freeze({active:active&&active.kind||'',foreign:foreignActive(),recoveryFault,recoveryKind,authorityHealthy:!(active&&active.authorityError),authorityDurableProtected:active&&active.authorityError?active.authorityError.durableProtected===true:true})});
  }
  return freeze({format:'study-director.mutation-coordinator-module',contractVersion:1,createCoordinator});
};
registry.define('mutation-coordinator',1,createModule);
return createModule;
})();
export type MutationCoordinatorModule=ReturnType<typeof sdMutationCoordinatorFactory>;
