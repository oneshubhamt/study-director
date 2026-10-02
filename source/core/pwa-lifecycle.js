(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1)throw new Error('Study Director internal module registry is unavailable or incompatible.');
const {exactFrozenObject:exactObject,functionPort:functions}=registry.contracts;
registry.define('pwa-lifecycle',1,()=>{
  const freeze=Object.freeze;
  function createCoordinator(input){
    if(!input||!Object.isFrozen(input))throw new TypeError('PWA lifecycle input must be frozen.');
    exactObject(input,['configuration','environment','hooks'],'PWA lifecycle input');
    exactObject(input.configuration,['assetId','buildId','reloadSessionKey','scope','workerUrl'],'PWA lifecycle configuration');
    exactObject(input.environment,['AbortController','MessageChannel','clearTimeout','document','navigator','setTimeout','window'],'PWA lifecycle environment');
    functions(input.hooks,['capture','prepare','render','reserve'],'PWA lifecycle hooks');
    const {configuration,environment,hooks}=input;
    const reloadSessionKey=String(configuration.reloadSessionKey||'');
    if(!reloadSessionKey)throw new TypeError('PWA reload session-storage identity is required.');
    const serviceWorker=environment.navigator&&environment.navigator.serviceWorker;
    const supported=!!(serviceWorker&&typeof serviceWorker.register==='function');
    const buildId=String(configuration.buildId||'');if(!/^[a-z0-9-]{1,96}$/u.test(buildId))throw new TypeError('PWA build identity is required.');
    const assetId=String(configuration.assetId||'');if(!/^[a-f0-9]{24}$/u.test(assetId))throw new TypeError('PWA asset identity is required.');
    let installed=false,registration=null,registrationTask=null,checkTask=null,registrationError='',checkError='',checkInstaller=null,checking=false;
    let baselineController=serviceWorker?.controller||null,waiting=null,discoveryRevision=0;
    let attempt=null,reloading=false,revision=0,message='',phase=supported?'idle':'unsupported',bootReady=false,bootTask=null,bootState='not-confirmed',bootReleaseId='',bootConfirmedAt='',cacheState='',cacheReason='';
    const watchedWorkers=new WeakSet();
    function changedController(){const worker=serviceWorker?.controller;return baselineController&&worker&&(worker!==baselineController||bootState==='mismatch')?worker:null;}
    function snapshot(){return freeze({format:'study-director.pwa-lifecycle-status',contractVersion:1,
      supported,installed,registered:!!registration,registering:!!registrationTask,registrationError,checkError,checking,
      bootState,bootReleaseId,bootConfirmedAt,buildId,assetId,cacheState,cacheReason,
      updateReady:!!waiting||!!changedController(),externalUpdate:!!changedController(),waitingReleaseId:waiting?.releaseId||'',
      applying:!!attempt,reloading,revision,message,phase});}
    function publish(nextMessage=message,nextPhase=phase){message=String(nextMessage||'');phase=nextPhase;revision+=1;const state=snapshot();hooks.render(state);return state;}
    const bootPendingMessage='This window’s version has not yet been confirmed. Keep it open; confirmation will retry when you return or check for updates.';
    function publishRestingState(){
      if(attempt||reloading)return publish();
      if(registrationError)return publish(registrationError,'registration-failed');
      if(checkError)return publish(checkError,'installation-failed');
      if(waiting)return publish('Update ready.','ready');
      if(bootState==='pending')return publish(bootPendingMessage,'boot-pending');
      if(bootState==='mismatch')return publish('The requested update has not been confirmed in this window. Keep saved work here and retry the update check.','boot-failed');
      return publish(['confirmed','current'].includes(bootState)?'This window’s version is confirmed.':'Update check finished.','idle');
    }
    function capture(scope,error){try{hooks.capture(scope,error);}catch{}}
    function randomId(){return environment.window.crypto?.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;}
    function identify(worker,signal=null){
      if(!worker||!environment.MessageChannel||signal?.aborted)return Promise.resolve(null);
      return new Promise(resolve=>{
        const channel=new environment.MessageChannel();let settled=false;
        const finish=value=>{if(settled)return;settled=true;environment.clearTimeout(timer);signal?.removeEventListener('abort',abort);channel.port1.onmessage=null;
          try{channel.port1.close?.();channel.port2.close?.();}catch{}resolve(value);};
        const abort=()=>finish(null),timer=environment.setTimeout(abort,3000);
        signal?.addEventListener('abort',abort,{once:true});
        channel.port1.onmessage=event=>{const data=event.data;finish(data?.type==='SD_PWA_IDENTITY'?data:null);};
        try{worker.postMessage({type:'SD_PWA_IDENTIFY'},[channel.port2]);}catch(error){capture('pwa.identify',error);finish(null);}
      });
    }
    async function discoverWaiting({announce=true}={}){
      const generation=++discoveryRevision,worker=registration?.waiting;
      if(!worker||worker.state!=='installed'||!serviceWorker.controller){const hadWaiting=!!waiting;waiting=null;if(announce&&hadWaiting&&!attempt)publish('','idle');return false;}
      watchWorker(worker);
      const identity=await identify(worker);
      if(generation!==discoveryRevision)return false;
      if(registration?.waiting!==worker||worker.state!=='installed'){waiting=null;return false;}
      waiting=freeze({worker,releaseId:String(identity?.releaseId||''),buildId:String(identity?.buildId||''),assetId:String(identity?.assetId||'')});
      if(announce&&!attempt)publish('Update ready.','ready');return true;
    }
    function watchWorker(worker){
      if(!worker)return;if(worker.state==='installing'){checkInstaller=worker;if(!attempt)publish('Downloading and verifying the update…','downloading');}
      if(watchedWorkers.has(worker))return;watchedWorkers.add(worker);
      worker.addEventListener('statechange',()=>{
        if(worker.state==='installed')void discoverWaiting();
        if(worker.state==='redundant'&&waiting?.worker===worker)void discoverWaiting();
        if(worker.state==='redundant'&&checkInstaller===worker&&!attempt){checkError=checkError||'The update could not be installed. Keep this window open and retry the update check.';publish(checkError,'installation-failed');}
        if(worker.state==='redundant')reportClient();
        if(bootReady&&worker===serviceWorker.controller&&worker.state==='activated')void confirmBoot();
        if(attempt)void inspectActivation(attempt);else void reconcileController();
      });
    }
    function clearMonitor(target){
      for(const key of ['retryTimer','deadlineTimer','reloadTimer'])if(target[key]!==null){environment.clearTimeout(target[key]);target[key]=null;}
      for(const close of [...target.channels])close();
    }
    async function release(target){
      if(target.released)return;target.released=true;clearMonitor(target);target.controller.abort();
      try{await target.guard?.release();}catch(error){capture('pwa.release',error);}
    }
    async function postpone(target,reason){
      if(attempt!==target||target.finishing)return false;target.finishing=true;
      await release(target);if(attempt!==target)return false;attempt=null;reloading=false;
      await discoverWaiting({announce:false});publish(`Update postponed. ${reason}`,'blocked');return false;
    }
    function current(target){return attempt===target&&!target.finishing&&!target.controller.signal.aborted;}
    function whileCurrent(promise,target){
      const signal=target.controller.signal;
      return new Promise((resolve,reject)=>{
        const abort=()=>{signal.removeEventListener('abort',abort);reject(new Error('Update preparation was cancelled.'));};
        if(signal.aborted){Promise.resolve(promise).catch(()=>{});abort();return;}
        signal.addEventListener('abort',abort,{once:true});
        Promise.resolve(promise).then(value=>{signal.removeEventListener('abort',abort);resolve(value);},error=>{signal.removeEventListener('abort',abort);reject(error);});
      });
    }
    async function completeActivation(target){
      if(!current(target)||!target.prepared||target.checking||reloading)return false;
      const worker=serviceWorker.controller;
      // registration.active is assigned before activation's waitUntil completes.
      // Only the activated controller proves which release will serve reload.
      if(worker!==target.worker||worker.state!=='activated')return false;
      target.checking=true;
      try{
        const identity=await identify(worker,target.controller.signal);
        if(!current(target)||serviceWorker.controller!==worker||worker.state!=='activated')return false;
        if(!identity||String(identity.releaseId||'')!==target.releaseId)return false;
        if(target.guard.validate()!==true)return postpone(target,'This window changed while the update was preparing. Try again after current work is saved.');
        clearMonitor(target);reloading=true;publish('Update applied. Reloading…','reloading');
        // A requested navigation is distinct from a successfully booted release.
        try{environment.window.sessionStorage.setItem(reloadSessionKey,JSON.stringify({version:2,releaseId:target.releaseId,buildId:target.buildId,assetId:target.assetId,requestedAt:new Date().toISOString()}));}catch{}
        target.reloadTimer=environment.setTimeout(()=>{void postpone(target,'Reload did not complete. Your saved work is safe; try Update Now again.');},8000);
        environment.window.location.reload();return true;
      }catch(error){capture('pwa.reload',error);return postpone(target,'The update could not reload safely. Try again.');}
      finally{target.checking=false;}
    }
    function dispatchActivation(target){
      if(!current(target)||registration?.waiting!==target.worker||target.worker.state!=='installed'||target.requests>=4)return;
      target.requests+=1;let channel=null;
      const close=()=>{if(!channel)return;channel.port1.onmessage=null;try{channel.port1.close?.();channel.port2.close?.();}catch{}target.channels.delete(close);channel=null;};
      try{
        channel=environment.MessageChannel?new environment.MessageChannel():null;
        if(channel){target.channels.add(close);channel.port1.onmessage=()=>close();}
        target.worker.postMessage({type:'SD_PWA_APPLY_UPDATE',requestId:target.requestId,releaseId:target.releaseId},channel?[channel.port2]:[]);
      }catch(error){close();capture('pwa.activate-request',error);}
    }
    async function inspectActivation(target){
      if(!current(target)||!target.prepared||reloading)return false;
      if(target.retryTimer!==null){environment.clearTimeout(target.retryTimer);target.retryTimer=null;}
      if(target.worker.state==='redundant'||registration?.waiting&&registration.waiting!==target.worker)return postpone(target,'The downloaded update was replaced. The latest update will be checked again.');
      const completed=await completeActivation(target);
      if(completed||!current(target)||reloading)return completed;
      dispatchActivation(target);
      if(target.retryTimer===null)target.retryTimer=environment.setTimeout(()=>{target.retryTimer=null;void inspectActivation(target);},750);
      return false;
    }
    async function reconcileController(){
      const worker=serviceWorker?.controller;if(!worker)return false;watchWorker(worker);
      // First control acquisition must not reload an interactive, dirty page.
      if(!baselineController){baselineController=worker;if(bootReady)void confirmBoot();return false;}
      if(attempt)return inspectActivation(attempt);
      if(worker===baselineController||worker.state!=='activated')return false;
      return apply({external:true});
    }
    function handleMessage(event){
      const data=event.data&&typeof event.data==='object'?event.data:{};
      // Messages are hints. Neither their release ID nor an ACK authorizes reload.
      if(!event.source||![serviceWorker.controller,registration?.active,registration?.waiting,registration?.installing].includes(event.source)&&!watchedWorkers.has(event.source))return;
      if(data.type==='SD_PWA_CLIENT_STATE_REQUEST'){reportClient(event.source);return;}
      if(data.type==='SD_PWA_CACHE_STATUS'&&event.source===serviceWorker.controller){cacheState=['completed','deferred','failed'].includes(data.state)?data.state:'';cacheReason=cacheState&&['awaiting-client-state','unknown-client-release','client-limit','cooldown','cache-storage-unavailable'].includes(data.reason)?data.reason:'';publish();return;}
      if(data.type==='SD_PWA_INSTALL_FAILED'&&!attempt){checkError=data.reason==='cache-limit'?'Close older Study Director windows, then retry the update check. Their offline assets are being preserved.':'The update download or verification failed. Your current version remains available; retry the update check.';publish(checkError,'installation-failed');return;}
      if(data.type==='SD_PWA_UPDATE_AVAILABLE')void discoverWaiting();
      if(data.type==='SD_PWA_ACTIVATED')void reconcileController();
    }
    function reportClient(worker=serviceWorker?.controller){
      if(!bootReady||!worker)return false;try{worker.postMessage({type:'SD_PWA_CLIENT_STATE',assetId,buildId,ready:true});return true;}catch(error){capture('pwa.client-state',error);return false;}
    }
    function bootOpportunity(){
      reportClient();
      if(bootReady&&['not-confirmed','pending','mismatch'].includes(bootState))void confirmBoot();
    }
    async function confirmBoot(){
      bootReady=true;if(!supported||attempt||reloading)return false;if(bootTask)return bootTask;
      bootTask=(async()=>{
        let expected=null;
        try{const raw=environment.window.sessionStorage.getItem(reloadSessionKey);if(raw){try{expected=JSON.parse(raw);}catch{expected={releaseId:raw};}}}catch(error){capture('pwa.boot-marker',error);throw error;}
        const worker=serviceWorker.controller;
        if(!worker||worker.state!=='activated'){if(expected){bootState='pending';if(!checking&&!registrationTask)publishRestingState();else publish();}return false;}
        const identity=await identify(worker);
        if(attempt||reloading)return false;
        if(serviceWorker.controller!==worker||worker.state!=='activated'||!identity){bootState='pending';if(!checking&&!registrationTask)publishRestingState();else publish();return false;}
        const matchesBuild=String(identity.buildId||'')===buildId&&String(identity.assetId||'')===assetId,matchesExpected=!expected||String(expected.releaseId||'')===String(identity.releaseId||'')&&(!expected.buildId||expected.buildId===buildId)&&(!expected.assetId||expected.assetId===assetId);
        if(!matchesBuild||!matchesExpected){bootState='mismatch';if(!checking&&!registrationTask)publishRestingState();else publish();capture('pwa.boot',new Error('Loaded app and expected worker release do not match.'));reportClient(worker);return false;}
        bootState=expected?'confirmed':'current';bootReleaseId=String(identity.releaseId||'');bootConfirmedAt=new Date().toISOString();
        if(expected)try{environment.window.sessionStorage.removeItem(reloadSessionKey);}catch{}
        reportClient(worker);if(!checking&&!registrationTask&&['boot-pending','boot-failed'].includes(phase))publishRestingState();else publish();return true;
      })().catch(error=>{capture('pwa.boot',error);if(!attempt&&!reloading){bootState='pending';if(!checking&&!registrationTask)publishRestingState();else publish();}return false;}).finally(()=>{bootTask=null;});return bootTask;
    }
    async function apply(options={}){
      if(!supported||attempt||reloading)return false;
      const target={requestId:randomId(),controller:new environment.AbortController(),worker:null,releaseId:'',buildId:'',assetId:'',guard:null,
        prepared:false,finishing:false,released:false,checking:false,requests:0,channels:new Set(),retryTimer:null,deadlineTimer:null,reloadTimer:null};
      attempt=target;
      try{
        await discoverWaiting({announce:false});if(!current(target))return false;
        // Late activation after a timeout needs a fresh reservation and save.
        const activated=changedController(),candidate=activated?{worker:activated,releaseId:''}:waiting;
        if(!candidate)return await postpone(target,'No downloaded update is waiting.');
        target.worker=candidate.worker;
        const identity=candidate.releaseId?candidate:await identify(target.worker,target.controller.signal);
        target.releaseId=String(identity?.releaseId||'');target.buildId=String(identity?.buildId||'');target.assetId=String(identity?.assetId||'');
        if(!current(target))return false;
        if(!target.releaseId)return await postpone(target,'The waiting update could not be identified. Try again later.');
        const context=freeze({requestId:target.requestId,releaseId:target.releaseId,automatic:options.automatic===true,external:!!activated,signal:target.controller.signal});
        publish('Checking saved state before updating…','preparing');
        target.deadlineTimer=environment.setTimeout(()=>{void postpone(target,'Preparing saved work took too long. Keep this window open and retry.');},20000);
        target.guard=hooks.reserve(context);
        if(!target.guard||typeof target.guard.release!=='function'||typeof target.guard.validate!=='function')throw new TypeError('PWA update reservation is invalid.');
        await whileCurrent(target.guard.ready,target);if(!current(target))return false;
        const result=await whileCurrent(hooks.prepare(context),target);if(!current(target))return false;
        if(!result||result.ok!==true)return await postpone(target,String(result?.reason||'Finish current work, then try again.'));
        if(target.guard.validate()!==true)return await postpone(target,'This window no longer has safe update control.');
        const stillWaiting=registration?.waiting===target.worker&&target.worker.state==='installed';
        const alreadyControlling=serviceWorker.controller===target.worker&&(target.worker!==baselineController||bootState==='mismatch');
        if(!stillWaiting&&!alreadyControlling)return await postpone(target,'The downloaded update changed while saved work was being checked. Try the latest update.');
        environment.clearTimeout(target.deadlineTimer);target.prepared=true;
        target.deadlineTimer=environment.setTimeout(()=>{void postpone(target,'The browser has not finished activating the update. Your work remains available; try again shortly.');},8000);
        publish('Applying update…','activating');watchWorker(target.worker);
        await inspectActivation(target);return current(target);
      }catch(error){if(current(target)){capture('pwa.prepare',error);return postpone(target,error?.message||'Saved work could not be safely prepared.');}return false;}
    }
    function waitForInstallation(worker){
      if(!worker)return Promise.resolve(true);
      return new Promise((resolve,reject)=>{
        let settled=false;
        const finish=(error=null)=>{if(settled)return;settled=true;environment.clearTimeout(timer);worker.removeEventListener?.('statechange',inspect);error?reject(error):resolve(true);};
        const inspect=()=>{if(worker.state==='redundant')finish(new Error('The downloaded update failed installation.'));else if(['installed','activating','activated'].includes(worker.state))finish();};
        const timer=environment.setTimeout(()=>finish(new Error('The update download did not finish in time.')),120000);
        worker.addEventListener('statechange',inspect);inspect();
      });
    }
    async function boundedUpdate(){
      let timer;try{return await Promise.race([registration.update(),new Promise((_,reject)=>{timer=environment.setTimeout(()=>reject(new Error('The browser update check timed out.')),120000);})]);}
      finally{if(timer!==undefined)environment.clearTimeout(timer);}
    }
    async function checkForUpdate(){
      if(!supported)return false;if(checkTask)return checkTask;
      checking=true;checkError='';checkInstaller=registration?.installing||null;if(!attempt)publish('Checking for an update…','checking');
      checkTask=(async()=>{
        if(!registration)await install();if(!registration)return false;
        try{await boundedUpdate();const installer=registration.installing||checkInstaller;watchWorker(installer);await waitForInstallation(installer);await discoverWaiting();return true;}
        catch(error){
          if(error?.name==='InvalidStateError'){
            registration=null;waiting=null;discoveryRevision+=1;
            registrationError='The update registration was removed. Update checks will retry; you can also retry now.';
            publish(registrationError,'registration-failed');
          }
          else{checkError=checkError||'The update check or download could not finish. Your current version remains available; retry when online.';publish(checkError,'installation-failed');}
          capture('pwa.update-check',error);return false;
        }
      })().finally(async()=>{if(bootReady)await confirmBoot();checkTask=null;checking=false;reportClient();if(!attempt)publishRestingState();else publish();});return checkTask;
    }
    async function install(){
      if(!supported){installed=true;publish('','unsupported');return snapshot();}
      if(!installed){
        installed=true;serviceWorker.addEventListener('message',handleMessage);
        serviceWorker.addEventListener('controllerchange',()=>{void reconcileController();});
        environment.window.addEventListener('focus',bootOpportunity);
        environment.document.addEventListener?.('visibilitychange',()=>{if(!environment.document.hidden)bootOpportunity();});
        environment.window.addEventListener('pagehide',()=>{if(attempt)void release(attempt);});
        environment.window.addEventListener('pageshow',()=>{if(bootReady){reportClient();void confirmBoot();}if(attempt?.released){attempt=null;reloading=false;publish('','idle');void reconcileController();}});
      }
      if(registrationTask)return registrationTask;if(registration)return snapshot();
      publish('Starting update checks…','registering');
      registrationTask=(async()=>{
        try{
          let deadline;try{registration=await Promise.race([serviceWorker.register(configuration.workerUrl,{scope:configuration.scope,updateViaCache:'none'}),new Promise((_,reject)=>{deadline=environment.setTimeout(()=>reject(new Error('The browser registration timed out.')),120000);})]);}finally{environment.clearTimeout(deadline);}
          if(!baselineController&&serviceWorker.controller)baselineController=serviceWorker.controller;
          registrationError='';registration.addEventListener('updatefound',()=>watchWorker(registration.installing));
          watchWorker(registration.installing);watchWorker(serviceWorker.controller);
          await discoverWaiting({announce:false});publish(waiting?'Update ready.':'',waiting?'ready':'idle');
        }catch(error){registrationError='Update checks could not start. They will retry when this window is online. You can also retry now.';capture('pwa.register',error);publish(registrationError,'registration-failed');}
        return snapshot();
      })().finally(()=>{registrationTask=null;});return registrationTask;
    }
    return freeze({format:'study-director.pwa-lifecycle',contractVersion:1,install,apply,checkForUpdate,confirmBoot,reportClient,status:snapshot});
  }
  return freeze({format:'study-director.pwa-lifecycle-module',contractVersion:1,createCoordinator});
});
})();
