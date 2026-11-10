import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {OwnershipState,OwnerRecord,OwnershipMessage,OwnershipStatus,WriteToken,PrimaryOptions,LeaseOptions,OwnerChannel,OwnershipInput} from '../../types/ownership.ts';
const sdOwnershipFactory=(()=>{
'use strict';
const registry=(globalThis as typeof globalThis & {[key:symbol]:ModuleRegistration<'ownership','study-director.ownership'>|undefined})[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,functionPort:functions}=registry.contracts;
const createModule=()=>{
  const freeze=Object.freeze;
  const OWNERSHIP_STATES=freeze({
    SECONDARY:'secondary',RESOLVING:'resolving',ACQUIRING:'acquiring',HYDRATING:'hydrating',
    PRIMARY:'primary',RELEASING:'releasing',FAULTED:'faulted'
  });
  const OWNERSHIP_TRANSITIONS:Readonly<Record<OwnershipState,readonly OwnershipState[]>>=freeze({
    secondary:freeze(['resolving','acquiring','secondary'] as const),
    resolving:freeze(['acquiring','secondary','faulted'] as const),
    acquiring:freeze(['hydrating','primary','secondary','faulted'] as const),
    hydrating:freeze(['primary','releasing','secondary','faulted'] as const),
    primary:freeze(['primary','resolving','releasing','secondary','faulted'] as const),
    releasing:freeze(['secondary','resolving','faulted'] as const),
    faulted:freeze(['resolving','acquiring','secondary','faulted'] as const)
  });

  class OwnershipLostError extends Error{
    readonly code='STUDY_DIRECTOR_OWNERSHIP_LOST';
    constructor(message='App ownership changed before the write could be committed.'){
      super(message);
      this.name='OwnershipLostError';
      this.code='STUDY_DIRECTOR_OWNERSHIP_LOST';
    }
  }
  function isOwnershipLostError(error:unknown){
    return !!(error&&(error instanceof OwnershipLostError||(error as {code?:unknown}).code==='STUDY_DIRECTOR_OWNERSHIP_LOST'||(error as {name?:unknown}).name==='OwnershipLostError'));
  }

  function createOwnershipController(input:OwnershipInput){
    if(!input||!Object.isFrozen(input))throw new TypeError('App ownership input must be frozen.');
    exactObject(input,['config','environment','local','diagnostics','hooks'],'App ownership input');
    exactObject(input.config,[
      'storageKey','sessionTabKey','channelName','heartbeatMs','staleMs','probeMs','webLockName'
    ],'App ownership config');
    exactObject(input.environment,['document','window','now','randomIdPart','setInterval','clearInterval','setTimeout','clearTimeout'],'App ownership environment');
    functions(input.local,['getJson','setJson','remove','lastError'],'App ownership storage');
    functions(input.diagnostics,['capture','guard'],'App ownership diagnostics');
    functions(input.hooks,[
      'render','refreshStorage','stopExecution','isInitialized','hydrate','finalizeHydration','resume','refreshCore',
      'scheduleMaintenance','practiceRender','blocked','invalidate','flush','settled',...(Object.hasOwn(input.hooks,'peerStorageReset')?['peerStorageReset']:[])
    ],'App ownership hooks');
    const config=input.config;
    const env=input.environment;
    const local=input.local;
    const diagnostics=input.diagnostics;
    const hooks=input.hooks;
    const doc=env.document;
    const win=env.window;
    let tabIdentityRestored=false;
    function resolveTabId(){
      try{
        const saved=win.sessionStorage&&win.sessionStorage.getItem(config.sessionTabKey);
        if(saved){tabIdentityRestored=true;return saved;}
        const created='tab_'+env.now().toString(36)+'_'+env.randomIdPart(8);
        if(win.sessionStorage)win.sessionStorage.setItem(config.sessionTabKey,created);
        return created;
      }catch(error){return 'tab_'+env.now().toString(36)+'_'+env.randomIdPart(8);}
    }
    const tabId=resolveTabId();
    let reloadHintPending=tabIdentityRestored;
    const pageId='page_'+env.now().toString(36)+'_'+env.randomIdPart(8);
    const webLocks=!!(win.navigator&&win.navigator.locks&&typeof win.navigator.locks!.request==='function');
    let state:OwnershipState=OWNERSHIP_STATES.SECONDARY;
    let revision=0;
    let hasControl=false;
    let hydrating=false;
    let heartbeatTimer:number|null=null;
    let channel:OwnerChannel|null=null;
    let takeoverPending:{requestId:string;resolve(value:boolean):void}|null=null;
    let probePending:{probeId:string;owner:OwnerRecord|null;promise:Promise<boolean>;resolve(value:boolean):void;timer:number}|null=null;
    let evaluationPending:Promise<boolean>|null=null;
    let installed=false;
    let claimId='';
    let webLockHeld=false;
    let webLockRelease:(()=>void)|null=null;
    let webLockAttempt:Promise<boolean>|null=null;

    function transition(next:OwnershipState,detail=''){
      const target=Object.values(OWNERSHIP_STATES).includes(next)?next:OWNERSHIP_STATES.FAULTED;
      const allowed=OWNERSHIP_TRANSITIONS[state]||[];
      if(state!==target&&!allowed.includes(target)){
        diagnostics.capture('ownership.invalid-transition',new Error(`${state} -> ${target}${detail?`: ${detail}`:''}`),'error');
      }
      if(state!==target)revision++;
      state=target;
      hydrating=target===OWNERSHIP_STATES.HYDRATING;
      hasControl=(target===OWNERSHIP_STATES.HYDRATING||target===OWNERSHIP_STATES.PRIMARY||target===OWNERSHIP_STATES.RELEASING);
      doc.documentElement.dataset['studyDirectorAppOwner']=hasControl?'1':'0';
      doc.documentElement.dataset['studyDirectorOwnershipState']=target;
      return target;
    }
    function canMutate(){
      if(state!==OWNERSHIP_STATES.PRIMARY||!claimId)return false;
      if(webLocks)return webLockHeld;
      return fenceValid(claimId);
    }
    function readOwner(){
      const owner=local.getJson(config.storageKey,null) as OwnerRecord|null|undefined;
      return owner&&typeof owner==='object'&&owner.version===2&&owner.tabId&&owner.pageId&&owner.claimId?owner:null;
    }
    function expiresAt(owner:OwnerRecord|null){return owner&&typeof owner==='object'?Number(owner.expiresAt)||0:0;}
    function isSelf(owner:OwnerRecord|null){return !!(owner&&owner.tabId===tabId&&owner.pageId===pageId);}
    function otherActive(owner=readOwner(),now=env.now()){
      return !!(owner&&!isSelf(owner)&&expiresAt(owner)>now);
    }
    function ownersMatch(a:OwnerRecord|null,b:OwnerRecord|null){
      return !!(a&&b&&a.tabId===b.tabId&&String(a.pageId||'')===String(b.pageId||'')&&a.claimId===b.claimId);
    }
    function removeIfMatches(owner:OwnerRecord|null){
      if(!ownersMatch(readOwner(),owner))return false;
      return local.remove(config.storageKey);
    }
    function clearStale(owner=readOwner(),now=env.now()){
      return !!(owner&&!isSelf(owner)&&expiresAt(owner)<=now&&removeIfMatches(owner));
    }
    function post(message:OwnershipMessage){
      try{if(channel)channel.postMessage({tabId,pageId,claimId,...message});}
      catch(error){diagnostics.capture('ownership.channel-post',error);}
    }
    function fenceValid(expectedClaim=claimId){
      if(!expectedClaim||(webLocks&&!webLockHeld))return false;
      const owner=readOwner();
      if(!isSelf(owner)||owner!.claimId!==expectedClaim)return false;
      return webLocks||expiresAt(owner)>env.now();
    }
    function ownershipLost(message:string){return new OwnershipLostError(message);}
    function stopExecution(){
      try{hooks.stopExecution();}catch(error){diagnostics.capture('ownership.stop-execution',error,'error');}
    }
    async function completePrimaryHydration(){
      const owner=readOwner();
      if(state!==OWNERSHIP_STATES.HYDRATING||!isSelf(owner)||owner!.claimId!==claimId||!fenceValid())return;
      // Keep ordinary mutation disabled while the takeover finishes loading
      // (unsupported-data census, saved drafts). Only writers holding explicit
      // allowHydrating tokens (active-session reconciliation) run meanwhile, so
      // an unrelated UI/editor write cannot slip into this takeover window.
      await hooks.finalizeHydration();
      const verified=readOwner();
      if(state!==OWNERSHIP_STATES.HYDRATING||!isSelf(verified)||verified!.claimId!==claimId||!fenceValid())return;
      transition(OWNERSHIP_STATES.PRIMARY,'hydration complete');
      hooks.resume();hooks.refreshCore();hooks.render();hooks.scheduleMaintenance();
    }
    function setPrimary(primary:boolean,options:PrimaryOptions={}){
      const next=!!primary;
      const resolvingLoss=!next&&state===OWNERSHIP_STATES.RESOLVING&&!!claimId;
      const lostPrimary=hasControl&&!next;
      const becamePrimary=next&&!hasControl;
      if(!next){
        transition(options.faulted?OWNERSHIP_STATES.FAULTED:OWNERSHIP_STATES.SECONDARY,String(options.error&&(options.error as {message?:unknown}).message||''));
        if(lostPrimary||resolvingLoss)claimId='';
      }
      hooks.render();hooks.refreshStorage();
      if(lostPrimary||resolvingLoss){
        stopExecution();
        hooks.invalidate(freeze({reason:options.error&&(options.error as {message?:unknown}).message||'ownership changed',state,revision}));
      }
      if(becamePrimary){
        const shouldHydrate=!!options.hydrate&&hooks.isInitialized();
        if(shouldHydrate){
          transition(OWNERSHIP_STATES.HYDRATING,'canonical reload');
          hooks.render();stopExecution();
          Promise.resolve(hooks.hydrate(freeze({sameTabReload:!!options.sameTabReload}))).then(completePrimaryHydration).catch(error=>{
            diagnostics.capture('ownership.hydrate',error,'error');
            release();
            setPrimary(false,{faulted:true,error});
            hooks.refreshCore();
          });
        }else{
          transition(OWNERSHIP_STATES.PRIMARY,'lease verified');
          hooks.render();hooks.resume();hooks.scheduleMaintenance();hooks.refreshCore();
        }
      }
      hooks.practiceRender();
      return next;
    }
    function writeLease(options:LeaseOptions={}){
      const force=!!options.force;
      const hydrate=!!options.hydrate;
      const now=env.now();
      const existing=readOwner();
      if(webLocks&&!webLockHeld)return false;
      if(!webLocks&&!force&&otherActive(existing,now)){setPrimary(false);return false;}
      const renewing=isSelf(existing)&&existing!.claimId===claimId;
      if(!(state===OWNERSHIP_STATES.PRIMARY||state===OWNERSHIP_STATES.HYDRATING)){
        transition(OWNERSHIP_STATES.ACQUIRING,force?'explicit takeover':'lease available');
      }
      const expiresAtValue=now+config.staleMs;
      const nextClaim=renewing?claimId:`claim_${now.toString(36)}_${env.randomIdPart(8)}`;
      const written=local.setJson(config.storageKey,{version:2,tabId,pageId,claimId:nextClaim,expiresAt:expiresAtValue});
      const verified=written?readOwner():null;
      const ok=!!(isSelf(verified)&&verified!.claimId===nextClaim&&expiresAt(verified)>now);
      if(ok){
        claimId=nextClaim;
        const sameTabReload=reloadHintPending||!!(existing&&existing.tabId===tabId&&existing.pageId!==pageId);
        reloadHintPending=false;
        // Heartbeat renewal is a lease operation, not an ownership transition.
        // Re-running the primary hooks here caused a whole-document ownership/UI
        // projection every heartbeat even while nothing had changed.
        if(!(renewing&&hasControl))setPrimary(true,{hydrate,sameTabReload});
        post({type:'owner-heartbeat',expiresAt:expiresAtValue});
      }else{
        const error=local.lastError()||new Error('App ownership lease could not be verified');
        diagnostics.capture('ownership.lease-write',error,'error');
        setPrimary(false,{faulted:true,error});
      }
      return ok;
    }
    function release(){
      const owner=readOwner();
      const releasedClaim=claimId;
      if(isSelf(owner)&&(!releasedClaim||owner!.claimId===releasedClaim))removeIfMatches(owner);
      claimId='';
      const unlock=webLockRelease;
      webLockRelease=null;
      if(unlock)unlock();
      post({type:'owner-release',claimId:releasedClaim});
      return true;
    }
    async function flushAndRelease(requestId:unknown=''){
      if(!canMutate())return false;
      diagnostics.guard('ownership.release-flush',hooks.flush);
      try{await hooks.settled();}
      catch(error){
        diagnostics.capture('ownership.release-write-wait',error,'error');
        // A deliberate takeover is optional: if current work is not durable,
        // retain authority here and let the requesting tab remain secondary.
        // Page exit cannot safely retain a lease owned by a departing page.
        if(requestId)return false;
      }
      transition(OWNERSHIP_STATES.RELEASING,requestId?'handoff':'page exit');
      release();setPrimary(false);
      if(requestId)post({type:'owner-takeover-ready',requestId});
      return true;
    }
    function resolveProbe(alive:boolean){
      const pending=probePending;
      if(!pending)return;
      probePending=null;
      env.clearTimeout(pending.timer);
      pending.resolve(!!alive);
    }
    function probeOwner(owner:OwnerRecord|null){
      if(!otherActive(owner))return Promise.resolve(false);
      if(!channel)return Promise.resolve(true);
      if(probePending)return probePending.promise;
      const yieldedControl=hasControl;
      if(yieldedControl||state!==OWNERSHIP_STATES.SECONDARY)transition(OWNERSHIP_STATES.RESOLVING,'checking recorded owner');
      if(yieldedControl)stopExecution();
      hooks.render();
      const probeId='probe_'+env.now().toString(36)+'_'+env.randomIdPart(6);
      let resolve!:(value:boolean)=>void;
      const promise=new Promise<boolean>(done=>{resolve=done;});
      const timer=env.setTimeout(()=>resolveProbe(false),config.probeMs);
      probePending={probeId,owner,promise,resolve,timer};
      post({type:'owner-probe',probeId,targetClaimId:owner!.claimId,targetPageId:owner!.pageId||''});
      return promise;
    }
    function acquireWebLock(force=false,hydrate=true){
      if(!webLocks)return Promise.resolve(writeLease({force,hydrate}));
      if(webLockHeld)return Promise.resolve(writeLease({force:true,hydrate}));
      if(webLockAttempt)return webLockAttempt;
      // A routine availability check does not change a read-only tab's authority.
      // If the lock is granted, writeLease performs the actual acquiring transition.
      if(force||state!==OWNERSHIP_STATES.SECONDARY)transition(OWNERSHIP_STATES.ACQUIRING,force?'explicit takeover':'web lock check');
      hooks.render();
      let resolveAttempt!:(value:boolean)=>void;
      const attempt=new Promise<boolean>(resolve=>{resolveAttempt=resolve;});
      webLockAttempt=attempt;
      const options:LockOptions={mode:'exclusive'};
      let controller:AbortController|null=null,timeout:number|null=null;
      if(force&&typeof win.AbortController==='function'){
        controller=new win.AbortController();
        options.signal=controller.signal;
        timeout=env.setTimeout(()=>controller!.abort(),4000);
      }else options.ifAvailable=true;
      win.navigator.locks!.request(config.webLockName,options,async lock=>{
        if(timeout)env.clearTimeout(timeout);
        if(!lock){resolveAttempt(false);return;}
        webLockHeld=true;
        let unlock!:()=>void;
        const hold=new Promise<void>(done=>{unlock=done;});
        webLockRelease=unlock;
        const ok=writeLease({force:true,hydrate});
        resolveAttempt(ok);
        webLockAttempt=null;
        if(!ok)unlock();
        await hold;
        webLockHeld=false;
        if(webLockRelease===unlock)webLockRelease=null;
      }).catch((error:unknown)=>{
        if(error&&(error as {name?:unknown}).name!=='AbortError')diagnostics.capture('ownership.web-lock',error,'error');
        resolveAttempt(false);
      }).finally(()=>{
        if(timeout)env.clearTimeout(timeout);
        if(webLockAttempt===attempt)webLockAttempt=null;
      });
      return attempt;
    }
    function evaluate(){
      if(takeoverPending)return Promise.resolve(false);
      if(evaluationPending)return evaluationPending;
      evaluationPending=(async()=>{
        if(webLocks){
          const ok=await acquireWebLock(false,true);
          if(!ok)setPrimary(false);
          return ok;
        }
        const owner=readOwner();
        if(otherActive(owner)){
          if(await probeOwner(owner)){setPrimary(false);return false;}
          removeIfMatches(owner);
        }else clearStale(owner);
        return writeLease({hydrate:true});
      })().finally(()=>{evaluationPending=null;});
      return evaluationPending;
    }
    function startHeartbeat(){
      if(heartbeatTimer)env.clearInterval(heartbeatTimer);
      heartbeatTimer=env.setInterval(()=>{
        if(takeoverPending)return;
        if(hasControl)writeLease();else void evaluate();
      },config.heartbeatMs);
    }
    async function takeOwnership(force=false){
      if(!force)return evaluate();
      const owner=readOwner();
      const requestId='takeover_'+env.now().toString(36)+'_'+env.randomIdPart(6);
      let resolveReady!:(value:boolean)=>void;
      const ready=new Promise<boolean>(resolve=>{resolveReady=resolve;});
      const timer=env.setTimeout(()=>resolveReady(false),1800);
      takeoverPending={requestId,resolve:value=>{env.clearTimeout(timer);resolveReady(value);}};
      post({type:'owner-takeover-request',requestId,targetClaimId:owner&&owner.claimId||''});
      const released=await ready;
      takeoverPending=null;
      if(!released&&otherActive(readOwner()))return false;
      return webLocks?acquireWebLock(true,true):writeLease({force:true,hydrate:true});
    }
    function install(){
      if(installed)return true;
      installed=true;
      if('BroadcastChannel' in win){
        try{
          channel=new win.BroadcastChannel!(config.channelName);
          channel.onmessage=event=>{
            const message=(event&&event.data) as OwnershipMessage|null|undefined;
            if(!message||(message.pageId&&message.pageId===pageId))return;
            if(message.type==='owner-probe'&&message.probeId){
              if(canMutate()&&(!message.targetClaimId||message.targetClaimId===claimId))post({type:'owner-alive',probeId:message.probeId});
              return;
            }
            if(message.type==='owner-alive'&&probePending&&message.probeId===probePending.probeId){resolveProbe(true);return;}
            if(message.type==='owner-takeover-request'&&message.requestId){void flushAndRelease(message.requestId);return;}
            // Another tab was first to reopen storage after the browser cleared it;
            // the tab in control writes its copy back.
            if(message.type==='storage-reset'){if(canMutate()&&hooks.peerStorageReset)diagnostics.guard('ownership.peer-storage-reset',()=>hooks.peerStorageReset!(String(message.detectedAt||'')));return;}
            if(message.type==='owner-takeover-ready'&&takeoverPending&&message.requestId===takeoverPending.requestId){takeoverPending.resolve(true);return;}
            if(message.type==='owner-heartbeat'&&Number(message.expiresAt)>env.now()&&!webLockHeld)setPrimary(false);
            else if(message.type==='owner-release'&&!takeoverPending)void evaluate();
          };
        }catch(error){diagnostics.capture('ownership.channel-install',error);}
      }
      win.addEventListener('storage',event=>{
        if(event.key===config.storageKey&&!takeoverPending)void evaluate();
      });
      void evaluate();startHeartbeat();
      return true;
    }
    function assertWriteAuthority(expectedClaim:string,reason:string){
      if(webLocks){
        if(!webLockHeld)throw ownershipLost(`App ownership changed before ${reason}.`);
        const owner=readOwner();
        if(!isSelf(owner)||owner!.claimId!==expectedClaim||expiresAt(owner)<=env.now()){
          if(!writeLease({force:true,hydrate:false}))throw ownershipLost(`App ownership could not be renewed before ${reason}.`);
        }
      }else if(!fenceValid(expectedClaim))throw ownershipLost(`App ownership changed before ${reason}.`);
      return true;
    }
    function issueWriteToken(reason='write',options:{allowHydrating?:boolean}={}):WriteToken{
      const allowHydrating=!!(options&&options.allowHydrating);
      if((state!==OWNERSHIP_STATES.PRIMARY&&!(allowHydrating&&state===OWNERSHIP_STATES.HYDRATING))||!claimId){
        throw ownershipLost(`App ownership is unavailable before ${reason}.`);
      }
      assertWriteAuthority(claimId,reason);
      return freeze({
        format:'study-director.ownership-write-token',contractVersion:1,tabId,pageId,claimId,revision,
        state,allowHydrating,reason:String(reason||'write')
      });
    }
    function assertWriteToken(input:unknown,reason='write'){
      const token=input as Partial<Record<keyof WriteToken,unknown>>|null;
      const validState=state===OWNERSHIP_STATES.PRIMARY||(token&&token.allowHydrating&&state===OWNERSHIP_STATES.HYDRATING);
      const valid=!!(validState&&token&&token.format==='study-director.ownership-write-token'&&token.contractVersion===1&&
        token.tabId===tabId&&token.pageId===pageId&&token.claimId===claimId&&token.revision===revision);
      if(!valid)throw ownershipLost(`App ownership changed before ${reason}.`);
      assertWriteAuthority(token!.claimId as string,reason);
      return true;
    }
    function requirePrimary(reason='change this tab'){
      if(canMutate())return true;
      hooks.blocked(status(),reason);
      return false;
    }
    function status():OwnershipStatus{
      return freeze({
        format:'study-director.app-ownership-status',contractVersion:1,
        state,revision,hasControl,hydrating,installed,takeoverPending:!!takeoverPending,
        resolving:state===OWNERSHIP_STATES.RESOLVING,tabId,pageId,claimId,
        authority:webLocks?'web-lock':'lease',webLockHeld
      });
    }
    const controller={
      format:'study-director.app-ownership-controller' as const,
      contractVersion:1 as const,
      states:OWNERSHIP_STATES,
      get state(){return state;},
      get revision(){return revision;},
      get hydrating(){return hydrating;},
      install:install,
      evaluate:evaluate,
      canMutate:canMutate,
      hasControl:()=>hasControl,
      writeLease:writeLease,
      transitionReleasing:()=>transition(OWNERSHIP_STATES.RELEASING,'page exit'),
      release:release,
      setPrimary:setPrimary,
      takeOwnership:takeOwnership,
      flushAndRelease:flushAndRelease,
      issueWriteToken:issueWriteToken,
      assertWriteToken:assertWriteToken,
      isOwnershipLostError:isOwnershipLostError,
      requirePrimary:requirePrimary,
      status:status,
      announceStorageReset:(detectedAt:unknown)=>{post({type:'storage-reset',detectedAt:String(detectedAt||'')});return true;},
    };
    return freeze(controller);
  }

  return freeze({
    format:'study-director.ownership',contractVersion:1,
    OWNERSHIP_STATES,OwnershipLostError,isOwnershipLostError,createOwnershipController
  });
};
registry.define('ownership',1,createModule);
return createModule;
})();
export type OwnershipModule=ReturnType<typeof sdOwnershipFactory>;
