(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,functionPort:functions}=registry.contracts;
registry.define('ownership',1,()=>{
  const freeze=Object.freeze;
  const OWNERSHIP_STATES=freeze({
    SECONDARY:'secondary',RESOLVING:'resolving',ACQUIRING:'acquiring',HYDRATING:'hydrating',
    PRIMARY:'primary',RELEASING:'releasing',FAULTED:'faulted'
  });
  const OWNERSHIP_TRANSITIONS=freeze({
    secondary:freeze(['resolving','acquiring','secondary']),
    resolving:freeze(['acquiring','secondary','faulted']),
    acquiring:freeze(['hydrating','primary','secondary','faulted']),
    hydrating:freeze(['primary','releasing','secondary','faulted']),
    primary:freeze(['primary','resolving','releasing','secondary','faulted']),
    releasing:freeze(['secondary','resolving','faulted']),
    faulted:freeze(['resolving','acquiring','secondary','faulted'])
  });

  class OwnershipLostError extends Error{
    constructor(message='App ownership changed before the write could be committed.'){
      super(message);
      this.name='OwnershipLostError';
      this.code='STUDY_DIRECTOR_OWNERSHIP_LOST';
    }
  }
  function isOwnershipLostError(error){
    return !!(error&&(error instanceof OwnershipLostError||error.code==='STUDY_DIRECTOR_OWNERSHIP_LOST'||error.name==='OwnershipLostError'));
  }

  function createOwnershipController(input){
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
      'scheduleMaintenance','practiceRender','blocked','invalidate','flush','settled'
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
    const webLocks=!!(win.navigator&&win.navigator.locks&&typeof win.navigator.locks.request==='function');
    let state=OWNERSHIP_STATES.SECONDARY;
    let revision=0;
    let hasControl=false;
    let hydrating=false;
    let heartbeatTimer=null;
    let channel=null;
    let takeoverPending=null;
    let probePending=null;
    let evaluationPending=null;
    let installed=false;
    let claimId='';
    let webLockHeld=false;
    let webLockRelease=null;
    let webLockAttempt=null;

    function transition(next,detail=''){
      const target=Object.values(OWNERSHIP_STATES).includes(next)?next:OWNERSHIP_STATES.FAULTED;
      const allowed=OWNERSHIP_TRANSITIONS[state]||[];
      if(state!==target&&!allowed.includes(target)){
        diagnostics.capture('ownership.invalid-transition',new Error(`${state} -> ${target}${detail?`: ${detail}`:''}`),'error');
      }
      if(state!==target)revision++;
      state=target;
      hydrating=target===OWNERSHIP_STATES.HYDRATING;
      hasControl=[OWNERSHIP_STATES.HYDRATING,OWNERSHIP_STATES.PRIMARY,OWNERSHIP_STATES.RELEASING].includes(target);
      doc.documentElement.dataset.studyDirectorAppOwner=hasControl?'1':'0';
      doc.documentElement.dataset.studyDirectorOwnershipState=target;
      return target;
    }
    function canMutate(){
      if(state!==OWNERSHIP_STATES.PRIMARY||!claimId)return false;
      if(webLocks)return webLockHeld;
      return fenceValid(claimId);
    }
    function readOwner(){
      const owner=local.getJson(config.storageKey,null);
      return owner&&typeof owner==='object'&&(owner.version===1||owner.version===2)&&owner.tabId&&owner.claimId?owner:null;
    }
    function expiresAt(owner){return owner&&typeof owner==='object'?Number(owner.expiresAt)||0:0;}
    function isSelf(owner){return !!(owner&&owner.tabId===tabId&&(owner.version===1||owner.pageId===pageId));}
    function otherActive(owner=readOwner(),now=env.now()){
      return !!(owner&&!isSelf(owner)&&expiresAt(owner)>now);
    }
    function ownersMatch(a,b){
      return !!(a&&b&&a.tabId===b.tabId&&String(a.pageId||'')===String(b.pageId||'')&&a.claimId===b.claimId);
    }
    function removeIfMatches(owner){
      if(!ownersMatch(readOwner(),owner))return false;
      return local.remove(config.storageKey);
    }
    function clearStale(owner=readOwner(),now=env.now()){
      return !!(owner&&!isSelf(owner)&&expiresAt(owner)<=now&&removeIfMatches(owner));
    }
    function post(message){
      try{if(channel)channel.postMessage({tabId,pageId,claimId,...message});}
      catch(error){diagnostics.capture('ownership.channel-post',error);}
    }
    function fenceValid(expectedClaim=claimId){
      if(!expectedClaim||(webLocks&&!webLockHeld))return false;
      const owner=readOwner();
      if(!isSelf(owner)||owner.claimId!==expectedClaim)return false;
      return webLocks||expiresAt(owner)>env.now();
    }
    function ownershipLost(message){return new OwnershipLostError(message);}
    function stopExecution(){
      try{hooks.stopExecution();}catch(error){diagnostics.capture('ownership.stop-execution',error,'error');}
    }
    async function completePrimaryHydration(){
      const owner=readOwner();
      if(state!==OWNERSHIP_STATES.HYDRATING||!isSelf(owner)||owner.claimId!==claimId||!fenceValid())return;
      // Keep ordinary mutation disabled while deferred compatibility work finishes.
      // Compatibility writers use explicit allowHydrating write tokens, so an
      // unrelated UI/editor write cannot slip into this takeover window.
      await hooks.finalizeHydration();
      const verified=readOwner();
      if(state!==OWNERSHIP_STATES.HYDRATING||!isSelf(verified)||verified.claimId!==claimId||!fenceValid())return;
      transition(OWNERSHIP_STATES.PRIMARY,'hydration complete');
      hooks.resume();hooks.refreshCore();hooks.render();hooks.scheduleMaintenance();
    }
    function setPrimary(primary,options={}){
      const next=!!primary;
      const resolvingLoss=!next&&state===OWNERSHIP_STATES.RESOLVING&&!!claimId;
      const lostPrimary=hasControl&&!next;
      const becamePrimary=next&&!hasControl;
      if(!next){
        transition(options.faulted?OWNERSHIP_STATES.FAULTED:OWNERSHIP_STATES.SECONDARY,options.error&&options.error.message||'');
        if(lostPrimary||resolvingLoss)claimId='';
      }
      hooks.render();hooks.refreshStorage();
      if(lostPrimary||resolvingLoss){
        stopExecution();
        hooks.invalidate(freeze({reason:options.error&&options.error.message||'ownership changed',state,revision}));
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
    function writeLease(options={}){
      const force=!!options.force;
      const hydrate=!!options.hydrate;
      const now=env.now();
      const existing=readOwner();
      if(webLocks&&!webLockHeld)return false;
      if(!webLocks&&!force&&otherActive(existing,now)){setPrimary(false);return false;}
      const renewing=isSelf(existing)&&existing.claimId===claimId;
      if(![OWNERSHIP_STATES.PRIMARY,OWNERSHIP_STATES.HYDRATING].includes(state)){
        transition(OWNERSHIP_STATES.ACQUIRING,force?'explicit takeover':'lease available');
      }
      const expiresAtValue=now+config.staleMs;
      const nextClaim=renewing?claimId:`claim_${now.toString(36)}_${env.randomIdPart(8)}`;
      const written=local.setJson(config.storageKey,{version:2,tabId,pageId,claimId:nextClaim,expiresAt:expiresAtValue});
      const verified=written?readOwner():null;
      const ok=!!(isSelf(verified)&&verified.claimId===nextClaim&&expiresAt(verified)>now);
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
      if(isSelf(owner)&&(!releasedClaim||owner.claimId===releasedClaim))removeIfMatches(owner);
      claimId='';
      const unlock=webLockRelease;
      webLockRelease=null;
      if(unlock)unlock();
      post({type:'owner-release',claimId:releasedClaim});
      return true;
    }
    async function flushAndRelease(requestId=''){
      if(!canMutate())return false;
      diagnostics.guard('ownership.release-flush',hooks.flush);
      try{await hooks.settled();}catch(error){diagnostics.capture('ownership.release-write-wait',error,'error');}
      transition(OWNERSHIP_STATES.RELEASING,'handoff');
      release();setPrimary(false);
      if(requestId)post({type:'owner-takeover-ready',requestId});
      return true;
    }
    function resolveProbe(alive){
      const pending=probePending;
      if(!pending)return;
      probePending=null;
      env.clearTimeout(pending.timer);
      pending.resolve(!!alive);
    }
    function probeOwner(owner){
      if(!otherActive(owner))return Promise.resolve(false);
      if(!channel)return Promise.resolve(true);
      if(probePending)return probePending.promise;
      const yieldedControl=hasControl;
      transition(OWNERSHIP_STATES.RESOLVING,'checking recorded owner');
      if(yieldedControl)stopExecution();
      hooks.render();
      const probeId='probe_'+env.now().toString(36)+'_'+env.randomIdPart(6);
      let resolve;
      const promise=new Promise(done=>{resolve=done;});
      const timer=env.setTimeout(()=>resolveProbe(false),config.probeMs);
      probePending={probeId,owner,promise,resolve,timer};
      post({type:'owner-probe',probeId,targetClaimId:owner.claimId,targetPageId:owner.pageId||''});
      return promise;
    }
    function acquireWebLock(force=false,hydrate=true){
      if(!webLocks)return Promise.resolve(writeLease({force,hydrate}));
      if(webLockHeld)return Promise.resolve(writeLease({force:true,hydrate}));
      if(webLockAttempt)return webLockAttempt;
      transition(OWNERSHIP_STATES.ACQUIRING,force?'explicit takeover':'web lock check');
      hooks.render();
      let resolveAttempt;
      const attempt=new Promise(resolve=>{resolveAttempt=resolve;});
      webLockAttempt=attempt;
      const options={mode:'exclusive'};
      let controller=null,timeout=null;
      if(force&&typeof win.AbortController==='function'){
        controller=new win.AbortController();
        options.signal=controller.signal;
        timeout=env.setTimeout(()=>controller.abort(),4000);
      }else options.ifAvailable=true;
      win.navigator.locks.request(config.webLockName,options,async lock=>{
        if(timeout)env.clearTimeout(timeout);
        if(!lock){resolveAttempt(false);return;}
        webLockHeld=true;
        let unlock;
        const hold=new Promise(done=>{unlock=done;});
        webLockRelease=unlock;
        const ok=writeLease({force:true,hydrate});
        resolveAttempt(ok);
        webLockAttempt=null;
        if(!ok)unlock();
        await hold;
        webLockHeld=false;
        if(webLockRelease===unlock)webLockRelease=null;
      }).catch(error=>{
        if(error&&error.name!=='AbortError')diagnostics.capture('ownership.web-lock',error,'error');
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
      let resolveReady;
      const ready=new Promise(resolve=>{resolveReady=resolve;});
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
          channel=new win.BroadcastChannel(config.channelName);
          channel.onmessage=event=>{
            const message=event&&event.data;
            if(!message||(message.pageId&&message.pageId===pageId))return;
            if(message.type==='owner-probe'&&message.probeId){
              if(canMutate()&&(!message.targetClaimId||message.targetClaimId===claimId))post({type:'owner-alive',probeId:message.probeId});
              return;
            }
            if(message.type==='owner-alive'&&probePending&&message.probeId===probePending.probeId){resolveProbe(true);return;}
            if(message.type==='owner-takeover-request'&&message.requestId){void flushAndRelease(message.requestId);return;}
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
    function assertWriteAuthority(expectedClaim,reason){
      if(webLocks){
        if(!webLockHeld)throw ownershipLost(`App ownership changed before ${reason}.`);
        const owner=readOwner();
        if(!isSelf(owner)||owner.claimId!==expectedClaim||expiresAt(owner)<=env.now()){
          if(!writeLease({force:true,hydrate:false}))throw ownershipLost(`App ownership could not be renewed before ${reason}.`);
        }
      }else if(!fenceValid(expectedClaim))throw ownershipLost(`App ownership changed before ${reason}.`);
      return true;
    }
    function issueWriteToken(reason='write',options={}){
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
    function assertWriteToken(token,reason='write'){
      const validState=state===OWNERSHIP_STATES.PRIMARY||(token&&token.allowHydrating&&state===OWNERSHIP_STATES.HYDRATING);
      const valid=!!(validState&&token&&token.format==='study-director.ownership-write-token'&&token.contractVersion===1&&
        token.tabId===tabId&&token.pageId===pageId&&token.claimId===claimId&&token.revision===revision);
      if(!valid)throw ownershipLost(`App ownership changed before ${reason}.`);
      assertWriteAuthority(token.claimId,reason);
      return true;
    }
    function requirePrimary(reason='change this tab'){
      if(canMutate())return true;
      hooks.blocked(status(),reason);
      return false;
    }
    function status(){
      return freeze({
        format:'study-director.app-ownership-status',contractVersion:1,
        state,revision,hasControl,hydrating,installed,takeoverPending:!!takeoverPending,
        resolving:state===OWNERSHIP_STATES.RESOLVING,tabId,pageId,claimId,
        authority:webLocks?'web-lock':'lease',webLockHeld
      });
    }
    const controller={};
    Object.defineProperties(controller,{
      format:{value:'study-director.app-ownership-controller',enumerable:true},
      contractVersion:{value:1,enumerable:true},
      states:{value:OWNERSHIP_STATES,enumerable:true},
      state:{get:()=>state,enumerable:true},
      revision:{get:()=>revision,enumerable:true},
      hydrating:{get:()=>hydrating,enumerable:true},
      install:{value:install,enumerable:true},
      evaluate:{value:evaluate,enumerable:true},
      canMutate:{value:canMutate,enumerable:true},
      hasControl:{value:()=>hasControl,enumerable:true},
      writeLease:{value:writeLease,enumerable:true},
      transitionReleasing:{value:()=>transition(OWNERSHIP_STATES.RELEASING,'page exit'),enumerable:true},
      release:{value:release,enumerable:true},
      setPrimary:{value:setPrimary,enumerable:true},
      takeOwnership:{value:takeOwnership,enumerable:true},
      flushAndRelease:{value:flushAndRelease,enumerable:true},
      issueWriteToken:{value:issueWriteToken,enumerable:true},
      assertWriteToken:{value:assertWriteToken,enumerable:true},
      isOwnershipLostError:{value:isOwnershipLostError,enumerable:true},
      requirePrimary:{value:requirePrimary,enumerable:true},
      status:{value:status,enumerable:true}
    });
    return freeze(controller);
  }

  return freeze({
    format:'study-director.ownership',contractVersion:1,
    OWNERSHIP_STATES,OwnershipLostError,isOwnershipLostError,createOwnershipController
  });
});
})();
