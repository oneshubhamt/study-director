(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,declaredFunctions:requireFunctions}=registry.contracts;
registry.define('backup-provider',1,input=>{
  if(!input||!Object.isFrozen(input)||Object.keys(input).sort().join('|')!=='repositoryPolicy')throw new TypeError('Backup provider module dependencies are invalid.');
  const RepositoryPolicy=input.repositoryPolicy;if(!RepositoryPolicy||RepositoryPolicy.format!=='study-director.repository-policy-module'||RepositoryPolicy.contractVersion!==1||!Object.isFrozen(RepositoryPolicy.protocol))throw new TypeError('Backup provider repository policy dependency is invalid.');
  const freeze=Object.freeze;
  const PORT_FIELDS=freeze({
    configuration:freeze(['appVersion']),
    controller:freeze(['beginImport','cancelImport','finishImport']),
    exports:freeze(['run']),
    domain:freeze(['clampText']),
    view:freeze(['presentation','document']),
    ownership:freeze(['canRunBackground','requireMutationControl']),
    environment:freeze(['clearTimeout','requestAnimationFrame','setTimeout']),
    diagnostics:freeze(['capture','fail','finish','mark','start'])
  });
  const REPOSITORY_FIELDS=freeze(['createPublication','publish','publishInline','inspectManifest','inspect','bringIn','restoreVersion','verifyCheckpoint','verifyObject','scrub','cleanup','inspectCommit','retention','validatePolicy','classifyState','activeProtected','selectRetention','projectHistory','markCompleted']);
  function createRuntime(input){
    exactObject(input,['background','ports','repository'],'Backup provider input');
    const Background=exactObject(input.background,['contractVersion','createCoordinator','format','maintenance','maintenanceActionable'],'Backup provider repository-background dependency');
    requireFunctions(Background,['createCoordinator','maintenanceActionable'],'Backup provider background port');
    if(Background.format!=='study-director.repository-background-module'||Background.contractVersion!==1)throw new TypeError('Backup provider repository-background dependency is invalid.');
    const ports=exactObject(input.ports,Object.keys(PORT_FIELDS),'Backup provider ports');
    for(const [name,fields] of Object.entries(PORT_FIELDS))exactObject(ports[name],fields,'Backup provider '+name+' port');
    for(const name of ['controller','exports','domain','ownership','environment','diagnostics'])requireFunctions(ports[name],PORT_FIELDS[name],'Backup provider '+name+' port');
    if(!ports.view.document)throw new TypeError('Backup provider view port is invalid.');
    const RepositoryCheckpointPipeline=exactObject(input.repository,REPOSITORY_FIELDS,'Backup provider repository pipeline');
    requireFunctions(RepositoryCheckpointPipeline,REPOSITORY_FIELDS.filter(key=>key!=='retention'),'Backup provider repository pipeline');
    if(!RepositoryCheckpointPipeline.retention||!Object.isFrozen(RepositoryCheckpointPipeline.retention))throw new TypeError('Backup provider retention policy is invalid.');
    if(!Object.isFrozen(ports.view.presentation)||['begin','read','feedback','condition','detail','outcome','locationLabel','resolve','reset','subscribe'].some(key=>typeof ports.view.presentation[key]!=='function'))throw new TypeError('Backup presentation port is invalid.');
    const APP_VERSION=ports.configuration.appVersion,BackupController=ports.controller,Exports=ports.exports,clampText=ports.domain.clampText,document=ports.view.document,requireBackupMutationControl=ports.ownership.requireMutationControl;
    const {clearTimeout,requestAnimationFrame,setTimeout}=ports.environment;
    const AppDiagnostics=freeze({capture:ports.diagnostics.capture});
    const OperationDiagnostics=freeze({start:ports.diagnostics.start,mark:ports.diagnostics.mark,finish:ports.diagnostics.finish,fail:ports.diagnostics.fail});
  const providers=new Map();
  const VERIFIED_HISTORY_INDEX_LIMIT=64;
  const REPOSITORY_IO_CONCURRENCY=8;
  const VERIFIED_HISTORY_READ_CONCURRENCY=REPOSITORY_IO_CONCURRENCY;
  const RECENT_HISTORY_TTL_MS=30*1000;
  const VERIFIED_HISTORY_INTERPRETATION_VERSION='managed-history-v1:'+APP_VERSION;
  const {publicationMaxAgeMs:PUBLICATION_MAX_AGE_MS,maintenanceWorkBudgetMs:PROVIDER_MAINTENANCE_BUDGET_MS,maintenanceMaxAgeMs:MAINTENANCE_MAX_AGE_MS,objectGcGraceMs:OBJECT_GC_GRACE_MS}=RepositoryPolicy.protocol;
  const PROVIDER_RECOVERY_MAINTENANCE_POLL_MS=500,PROVIDER_RECOVERY_MAINTENANCE_YIELD_MS=MAINTENANCE_MAX_AGE_MS+PROVIDER_RECOVERY_MAINTENANCE_POLL_MS;
  const MAINTENANCE_MIN_CHECKPOINT_DELETES=16,MAINTENANCE_MAX_CHECKPOINT_DELETES=128,MAINTENANCE_MAX_OBJECT_DELETES=48,PROVIDER_CONVERGENCE_BUSY_RETRY_MS=15*1000,PROVIDER_CONVERGENCE_RETRY_DELAYS=freeze([30*1000,2*60*1000,10*60*1000,30*60*1000]);
  const MAINTENANCE_POLICY=Background.maintenance;
  const verifiedHistoryByProvider=new Map(),recentHistoryByProvider=new Map(),repositoryScopeByProvider=new Map(),connectedOnceByProvider=new Set();
  const repositoryOperationStateBySelection=new WeakMap();
  const providerPublications=new Map();
  const providerBackgroundCoordinators=new Map(),providerMaintenanceIntents=new Map(),providerMaintenanceSchedulers=new Map(),providerIntegritySchedulers=new Map(),providerConvergenceJobs=new Map(),providerConvergenceRetryAttempts=new Map();
  function repositoryProviderObjectIds(value){const rows=Array.isArray(value)?value:[],seen=new Set(),out=[];for(const raw of rows){const id=String(raw||'');if(!/^obj_[a-f0-9]{32}$/u.test(id)||seen.has(id))continue;seen.add(id);out.push(id);}return Object.freeze(out);}
  let activeId='';
  let activeTrigger=null;
  let busy=false;
  let preparing=false;
  let foregroundController=null;
  const presentation=ports.view.presentation;
  let foregroundPresentation=null,foregroundSource='',borrowedPresentation=false;
  function presentationView(event){return event?freeze({...event,...event.progress,providerId:event.source,providerLabel:event.title,active:event.lifecycle==='running',ok:event.severity!=='error'}):null;}
  function foregroundView(){const event=foregroundPresentation?.read();return event?.lifecycle==='running'?presentationView(event):null;}
  function subscribePresentation(listener){return presentation.subscribe(state=>{const event=state.events.find(row=>row.source===foregroundSource&&row.id==='backup-operation');if(event)listener(presentationView(event));});}
  let openRevision=0;
  let integrityScrubHooks=null;
  let convergencePropagationHooks=null;
  let managedRecoveryHooks=null;
  let pendingRetryHooks=null;
  let maintenanceHooks=null;
  const safeId=value=>String(value||'').trim().toLowerCase().match(/^[a-z][a-z0-9-]{0,40}$/)?.[0]||'';
  const registeredProvider=value=>providers.get(safeId(value&&value.id||value))||value||null;
  function providerBackground(selected){
    const id=safeId(selected&&selected.id);if(!id)throw new Error('Backup provider background target is invalid.');
    let coordinator=providerBackgroundCoordinators.get(id);if(coordinator)return coordinator;
    coordinator=Background.createCoordinator(freeze({target:id,environment:freeze({AbortController:globalThis.AbortController,clearTimeout,now:()=>Date.now(),setTimeout})}));providerBackgroundCoordinators.set(id,coordinator);return coordinator;
  }
  function providerMaintenanceIntent(selected){
    if(!maintenanceHooks)return null;const id=safeId(selected&&selected.id);if(!id)throw new Error('Backup provider maintenance target is invalid.');selected=registeredProvider(selected);
    let intent=providerMaintenanceIntents.get(id);if(intent)return intent;const coordinator=providerBackground(selected);
    intent=coordinator.maintenanceIntent(freeze({capture:(phase,error)=>AppDiagnostics.capture('backup-provider.repository-maintenance-'+phase,error,'warn'),clear:expected=>maintenanceHooks.clear(id,expected),mark:(state,expected)=>maintenanceHooks.mark(id,freeze({...state,repositoryScope:repositoryScopeByProvider.get(id)||''}),expected),read:()=>maintenanceHooks.read(id),scope:()=>repositoryScopeByProvider.get(id)||null,selectRetention:RepositoryCheckpointPipeline.selectRetention}));providerMaintenanceIntents.set(id,intent);return intent;
  }
  const userProviderMessage=(error,fallback)=>{const code=String(error&&error.code||'');if(code==='STUDY_DIRECTOR_REPOSITORY_MAINTENANCE_BUSY'||code==='STUDY_DIRECTOR_RECOVERY_MAINTENANCE_YIELD_TIMEOUT')return 'Another Study Director device is still finishing Google Drive backup maintenance. Wait a moment, then retry the restore.';if(code==='STUDY_DIRECTOR_REPOSITORY_MAINTENANCE_UNCERTAIN')return 'Google Drive backup maintenance state could not be verified safely. Retry after the other device has finished its backup work.';const raw=String(error&&error.message||error||'').trim();if(!raw)return fallback;return /\b(?:repository|checkpoint|manifest|commit marker|reconciliation)\b/iu.test(raw)?fallback:raw;};
  const providerBackgroundAvailability=selected=>{
    const local=ports.ownership.canRunBackground();if(local!==true)return String(local||'awaiting-control');
    if(!selected||typeof selected.backgroundAvailable!=='function')return 'awaiting-connection';
    try{return selected.backgroundAvailable()===true?true:'awaiting-connection';}
    catch(error){AppDiagnostics.capture('backup-provider.background-availability',error,'warn');return 'awaiting-connection';}
  };
  const freezeRepositoryTransport=value=>{
    if(!value||typeof value!=='object')return null;
    const required=['list','upload','download','delete'];
    if(required.some(key=>typeof value[key]!=='function'))return null;
    const publicationMethods=['beginPublication','listPublications','assertPublication','endPublication'],maintenanceMethods=['beginMaintenance','listMaintenances','assertMaintenance','endMaintenance'];
    const publicationCapable=publicationMethods.every(key=>typeof value[key]==='function'),maintenanceCapable=maintenanceMethods.every(key=>typeof value[key]==='function');
    return Object.freeze({
      list:value.list,upload:value.upload,download:value.download,delete:value.delete,
      beginPublication:publicationCapable?value.beginPublication:null,listPublications:publicationCapable?value.listPublications:null,assertPublication:publicationCapable?value.assertPublication:null,endPublication:publicationCapable?value.endPublication:null,
      beginMaintenance:maintenanceCapable?value.beginMaintenance:null,listMaintenances:maintenanceCapable?value.listMaintenances:null,assertMaintenance:maintenanceCapable?value.assertMaintenance:null,renewMaintenance:maintenanceCapable&&typeof value.renewMaintenance==='function'?value.renewMaintenance:null,endMaintenance:maintenanceCapable?value.endMaintenance:null,
      scope:typeof value.scope==='function'?value.scope:null,
      discardUploads:typeof value.discardUploads==='function'?value.discardUploads:null,
      choose:typeof value.choose==='function'?value.choose:null,
      beginOperation:typeof value.beginOperation==='function'?value.beginOperation:null,
      historyReadConcurrency:Math.max(1,Math.min(VERIFIED_HISTORY_READ_CONCURRENCY,Math.floor(Number(value.historyReadConcurrency)||1)))
    });
  };
  function repositoryOperationSelected(selected,options={}){
    if(repositoryOperationStateBySelection.has(selected))return selected;
    const begin=selected&&selected.repository&&selected.repository.beginOperation;if(typeof begin!=='function')return selected;
    const scoped=freezeRepositoryTransport(begin(Object.freeze({signal:options&&options.signal||null,checkProtection:options&&options.checkProtection||null})));
    if(!scoped)throw new Error('Backup repository transport could not begin a verified operation.');
    const repository=scoped.choose||!selected.repository.choose?scoped:Object.freeze({...scoped,choose:selected.repository.choose}),operationSelected=Object.freeze({...selected,repository});
    repositoryOperationStateBySelection.set(operationSelected,{objectInventory:null});
    return operationSelected;
  }
  function repositoryOperationState(selected){return selected&&typeof selected==='object'?repositoryOperationStateBySelection.get(selected)||null:null;}
  function rememberRepositoryObjectInventory(selected,items,{invalidCount=0,overflow=false}={}){
    const operation=repositoryOperationState(selected);if(!operation)return;
    if(overflow===true){operation.objectInventory=null;return;}
    const byId=new Map();for(const row of Array.isArray(items)?items:[]){const id=String(row&&row.id||''),ref=row&&row.ref||row;if(id)byId.set(id,freeze({...row,createdAt:String(row.createdAt||ref.createdAt||''),modifiedAt:String(row.modifiedAt||ref.modifiedAt||'')}));}
    operation.objectInventory={items:byId,invalidCount:Math.max(0,Number(invalidCount)||0)};
  }
  function rememberRepositoryObjectReceipt(selected,item){
    const inventory=repositoryOperationState(selected)?.objectInventory;if(!inventory||!item||item.kind!=='object')return;
    inventory.items.set(item.id,Object.freeze({id:item.id,ref:item,createdAt:String(item.createdAt||''),modifiedAt:String(item.modifiedAt||'')}));
  }
  function reusableRepositoryObjectListing(selected){
    const inventory=repositoryOperationState(selected)?.objectInventory;if(!inventory)return null;
    return Object.freeze({items:Object.freeze([...inventory.items.values()]),overflow:false,invalidCount:inventory.invalidCount});
  }
  function rememberRecentHistory(selected,inventory){
    const id=safeId(selected&&selected.id);if(!id||!inventory)return;recentHistoryByProvider.set(id,freeze({capturedAt:Date.now(),inventory}));
  }
  function recentHistory(selected,checkpointId=''){
    const id=safeId(selected&&selected.id),cached=id&&recentHistoryByProvider.get(id);if(!cached)return null;
    if(Date.now()-cached.capturedAt>RECENT_HISTORY_TTL_MS){recentHistoryByProvider.delete(id);return null;}
    const requested=String(checkpointId||'');if(requested&&!cached.inventory.pairs.some(pair=>pair&&pair.item&&pair.item.id===requested))return null;
    return cached.inventory;
  }
  function clearRecentHistory(selected){const id=safeId(selected&&selected.id);if(id)recentHistoryByProvider.delete(id);}
  async function discardProviderPublication(selected){
    const id=safeId(selected&&selected.id),publication=providerPublications.get(id);providerPublications.delete(id);
    if(publication)await publication.continuation.release();selected.repository.discardUploads?.();
  }
  async function synchronizeRepositoryScope(selected){
    const id=safeId(selected&&selected.id),readScope=selected&&selected.repository&&selected.repository.scope;if(!id||typeof readScope!=='function')return false;
    const scope=String(await readScope()||'');if(!scope||scope.length>320)throw new Error('Backup repository transport returned an invalid repository scope.');
    const previous=repositoryScopeByProvider.get(id)||'',pending=maintenanceHooks?await maintenanceHooks.read(id):null,persistedScope=String(pending&&pending.repositoryScope||'');repositoryScopeByProvider.set(id,scope);
    const changed=!!previous&&previous!==scope,stalePersisted=!!pending&&persistedScope!==scope;if(!changed&&!stalePersisted)return false;
    if(changed)await discardProviderPublication(selected);
    recentHistoryByProvider.delete(id);verifiedHistoryByProvider.delete(id);providerConvergenceRetryAttempts.delete(id);providerBackground(selected).clearAllScheduled();
    if(stalePersisted)await maintenanceHooks.clear(id,pending);
    OperationDiagnostics.mark('provider-repository-generation-reset',{provider:id,changed:true});return true;
  }
  const freezeProvider=config=>Object.freeze({
    id:safeId(config.id),
    label:clampText(config.label||'',40),
    exportLabel:clampText(config.exportLabel||'',50),
    disclosureSummary:clampText(config.disclosureSummary||'',100),
    disclosure:clampText(config.disclosure||'',760),
    prepare:typeof config.prepare==='function'?config.prepare:null,
    authorize:typeof config.authorize==='function'?config.authorize:null,
    backgroundAvailable:typeof config.backgroundAvailable==='function'?config.backgroundAvailable:null,
    connected:typeof config.connected==='function'?config.connected:null,
    subscribeConnection:typeof config.subscribeConnection==='function'?config.subscribeConnection:null,
    disconnectLabel:clampText(config.disconnectLabel||'',60),
    disconnect:typeof config.disconnect==='function'?config.disconnect:null,
    release:typeof config.release==='function'?config.release:null,
    repository:freezeRepositoryTransport(config.repository)
  });
  function elements(){
    return {
      host:document.getElementById('backup-provider-actions'),
      overlay:document.getElementById('backup-provider-overlay'),
      title:document.getElementById('backup-provider-title'),
      message:document.getElementById('backup-provider-msg'),
      disclosure:document.getElementById('backup-provider-disclosure'),
      disclosureSummary:document.getElementById('backup-provider-disclosure-summary'),
      disclosureBody:document.getElementById('backup-provider-disclosure-body'),
      exportButton:document.getElementById('backup-provider-export'),
      recoverButton:document.getElementById('backup-provider-recover'),
      closeButton:document.getElementById('backup-provider-close'),
      disconnectButton:document.getElementById('backup-provider-disconnect'),
      cancelButton:document.getElementById('backup-provider-cancel'),
      progress:document.getElementById('backup-provider-progress'),
      progressStage:document.getElementById('backup-provider-progress-stage'),
      progressDetail:document.getElementById('backup-provider-progress-detail'),
      status:document.getElementById('backup-provider-status')
    };
  }
  function writeStatus(message='',ok=true){
    if(foregroundPresentation?.read()?.lifecycle==='running'){if(message)foregroundPresentation.update({message,severity:ok?'info':'error'});}
    else if(activeId)presentation.feedback(activeId,message,ok);
    renderForegroundView();
  }
  function renderForegroundView(selected=provider()){
    const {progress,progressStage,progressDetail,status}=elements(),id=safeId(selected&&selected.id),event=id?presentation.read(id):null,view=presentationView(event),feedback=id?presentation.read(id,'backup-status'):null;
    if(progress){progress.hidden=!view?.active;if(progressStage)progressStage.textContent=view?.active?view.message:'';if(progressDetail)progressDetail.textContent=view?.active?presentation.detail(event):'';}
    const statusEvent=view?.active?null:feedback||event;
    if(status){status.textContent=statusEvent?.message||'';status.className='ui-status'+(statusEvent?.severity==='error'?' err':'');}
  }
  function beginForegroundView(selected,kind,message,borrowed=null){
    foregroundSource=safeId(selected&&selected.id);borrowedPresentation=!!borrowed;
    foregroundPresentation=borrowed||presentation.begin(foregroundSource,kind,{label:selected.label,message});
    if(borrowed)borrowed.update({message,progress:null});
    renderForegroundView(selected);return foregroundView();
  }
  function updateForegroundView(selected,patch={}){
    if(!foregroundPresentation||foregroundSource!==safeId(selected?.id))return null;
    foregroundPresentation.update({message:patch.message,progress:patch.stage?patch:undefined,severity:patch.ok===false?'error':'info'});renderForegroundView(selected);return foregroundView();
  }
  function finishForegroundView(selected,{message=null,ok=null,lifecycle=null}={}){
    if(!foregroundPresentation||foregroundSource!==safeId(selected?.id))return null;
    const event=foregroundPresentation.read();if(!event)return null;
    if(!borrowedPresentation)foregroundPresentation.finish({message:message===null?event.message:message,lifecycle:lifecycle||(ok===false||ok===null&&event.severity==='error'?'failed':'succeeded')});
    const final=presentationView(foregroundPresentation.read());foregroundPresentation=null;foregroundSource='';borrowedPresentation=false;renderForegroundView(selected);return final;
  }
  function providerProgress(selected,stage,message,details={}){
    updateForegroundView(selected,{stage:String(stage||'working'),message:String(message||'Working…'),ok:true,current:Math.max(0,Number(details.current)||0),total:Math.max(0,Number(details.total)||0),completedBytes:Math.max(0,Number(details.completedBytes)||0),totalBytes:Math.max(0,Number(details.totalBytes)||0)});writeStatus('');
  }
  function statusText(message='',ok=true){
    if(foregroundView())updateForegroundView({id:foregroundView().providerId},{message:String(message||''),ok:ok!==false});
    writeStatus(message,ok);
  }
  function recoveryStatus(message='',ok=true,onProgress=null,stage='working',details={}){
    if(foregroundView())updateForegroundView({id:foregroundView().providerId},{stage:String(stage||'working'),message:String(message||''),ok:ok!==false,current:Math.max(0,Number(details.current)||0),total:Math.max(0,Number(details.total)||0),completedBytes:Math.max(0,Number(details.completedBytes)||0),totalBytes:Math.max(0,Number(details.totalBytes)||0)});
    writeStatus(message,ok);
    if(typeof onProgress==='function')try{onProgress(freeze({stage:String(stage||'working'),message:String(message||''),ok:ok!==false,...details}));}catch(error){AppDiagnostics.capture('backup-provider.recovery-progress',error,'warn');}
  }
  function focusWithoutScroll(element){
    if(!element||typeof element.focus!=='function')return false;
    try{element.focus({preventScroll:true});}
    catch(_error){element.focus();}
    return true;
  }
  function setBusy(next){
    busy=!!next;
    const {overlay,exportButton,recoverButton,closeButton,disconnectButton,cancelButton}=elements(),recoveryActive=busy&&foregroundView()&&['history','bring-in','restore-version'].includes(foregroundView().kind);
    if(overlay)overlay.setAttribute('aria-busy',busy?'true':'false');
    if(exportButton)exportButton.disabled=busy;
    if(recoverButton)recoverButton.disabled=busy&&!recoveryActive;
    if(closeButton)closeButton.disabled=false;
    if(disconnectButton)disconnectButton.disabled=busy;
    if(cancelButton){const cancellable=busy&&!!foregroundController&&!foregroundController.signal.aborted;cancelButton.hidden=!cancellable;cancelButton.disabled=!cancellable;}
    renderButtons();
  }
  function beginForeground(selected,externalSignal=null){
    if(foregroundController)return null;
    const background=providerBackground(selected),scope=background.beginForeground({externalSignal,cancelCode:'PROVIDER_FOREGROUND_CANCELLED',cancelMessage:'Backup operation was cancelled.'});if(!scope)return null;
    foregroundController=scope.controller;
    let released=false;
    return freeze({signal:scope.signal,settled:scope.settled,release:()=>{
      if(released)return false;released=true;if(foregroundController===scope.controller)foregroundController=null;
      scope.release();return true;
    }});
  }
  function cancelForeground(reason='Backup operation was cancelled by the user.',providerId=''){
    const requested=safeId(providerId),active=safeId(foregroundView()&&foregroundView().providerId);
    if(requested&&active&&requested!==active)return false;
    if(!foregroundController||foregroundController.signal.aborted)return false;
    foregroundController.abort(providerBackgroundAbort('PROVIDER_FOREGROUND_CANCELLED',reason));
    if(foregroundView()&&['bring-in','restore-version'].includes(foregroundView().kind))try{BackupController.cancelImport(reason,freeze({announce:false}));}catch{}
    if(foregroundView())updateForegroundView({id:foregroundView().providerId},{stage:'cancelling',message:'Cancelling safely…',ok:true});
    writeStatus('Cancelling safely…',true);setBusy(true);return true;
  }
  function setReady(ready){
    const {exportButton,recoverButton,disconnectButton}=elements();
    [exportButton,recoverButton,disconnectButton].forEach(button=>{if(button&&!button.hidden)button.disabled=!ready;});
  }
  function provider(){return providers.get(activeId)||null;}
  function providerConnected(selected){try{return selected?.connected?selected.connected()===true:false;}catch{return false;}}
  function detachFinishedSelection(selected){
    const {overlay}=elements();if(overlay?.classList.contains('on')||activeId!==safeId(selected&&selected.id))return false;activeId='';activeTrigger=null;return true;
  }
  async function release(selected,operation){
    if(!selected||!selected.release)return;
    let timer=null;
    try{
      await Promise.race([
        Promise.resolve(selected.release(Object.freeze({operation}))),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Backup provider cleanup timed out.')),3000);})
      ]);
    }catch(error){AppDiagnostics.capture('backup-provider.release',error,'warn');}
    finally{if(timer!==null)clearTimeout(timer);}
  }
  function close({restoreFocus=true}={}){
    openRevision+=1;
    const selected=provider(),trigger=activeTrigger,{overlay}=elements();if(overlay)overlay.classList.remove('on');
    if(!busy){activeId='';activeTrigger=null;writeStatus('');void release(selected,'close');}
    if(restoreFocus&&trigger&&typeof trigger.focus==='function')requestAnimationFrame(()=>focusWithoutScroll(trigger));
    return true;
  }
  function presentProvider(selected,trigger=null){
    const revision=++openRevision;
    activeId=selected.id;
    activeTrigger=trigger&&trigger.nodeType===1?trigger:document.activeElement;
    const {overlay,title,message,disclosure,disclosureSummary,disclosureBody,exportButton,recoverButton,disconnectButton}=elements();
    if(!overlay||!title||!message||!disclosure||!disclosureSummary||!disclosureBody||!exportButton||!recoverButton||!disconnectButton)return null;
    const connected=providerConnected(selected),wasConnected=connectedOnceByProvider.has(selected.id);if(connected)connectedOnceByProvider.add(selected.id);
    title.textContent=`${selected.label} settings`;
    message.textContent=connected?`${selected.label} is connected for this tab.`:wasConnected?`${selected.label} authorization expired. Reconnect to use this backup location.`:`${selected.label} is not connected. Connect when you want to use this backup location.`;
    disclosure.open=false;
    disclosure.hidden=!selected.disclosure;
    disclosureSummary.textContent=selected.disclosureSummary||`ⓘ ${selected.label} access & privacy · Details`;
    disclosureBody.textContent=selected.disclosure||'';
    exportButton.textContent=connected||wasConnected?'Reconnect':'Connect';
    exportButton.setAttribute('aria-label',`${connected||wasConnected?'Reconnect':'Connect'} ${selected.label}`);
    recoverButton.hidden=true;
    recoverButton.dataset.providerId=selected.id;
    disconnectButton.textContent=selected.disconnectLabel||'Disconnect';
    disconnectButton.hidden=!selected.disconnect||!connected;
    overlay.classList.add('on');
    return Object.freeze({revision,overlay,exportButton});
  }
  async function open(id,trigger=null){
    const selected=providers.get(safeId(id));
    if(!selected)return false;
    if(busy){
      const runningId=safeId(foregroundView()&&foregroundView().providerId);
      if(runningId&&runningId!==selected.id){const running=providers.get(runningId)||selected;const presented=presentProvider(running,trigger);if(!presented)return false;renderForegroundView(running);writeStatus(`${running.label} has an operation in progress.`);setBusy(true);return true;}
      const presented=presentProvider(selected,trigger);if(!presented)return false;renderForegroundView(selected);setBusy(true);return true;
    }
    const presented=presentProvider(selected,trigger);if(!presented)return false;
    renderForegroundView(selected);
    const {revision,exportButton}=presented;
    statusText(selected.prepare?'Preparing…':'');
    setReady(!selected.prepare);
    if(selected.prepare){
      preparing=true;
      try{
        await selected.prepare();
        if(revision!==openRevision||activeId!==selected.id)return true;
        statusText('');setReady(true);focusWithoutScroll(exportButton);
      }catch(error){
        if(revision!==openRevision||activeId!==selected.id)return true;
        setReady(false);statusText(userProviderMessage(error,`${selected.label} could not be prepared safely.`),false);
      }finally{preparing=false;}
    }else requestAnimationFrame(()=>focusWithoutScroll(exportButton));
    return true;
  }
  async function authorize(selected,operation){
    if(selected.authorize)await selected.authorize(Object.freeze({operation}));
    presentation.condition(selected.id,'permission','');if(presentation.read(selected.id)?.lifecycle==='failed')presentation.resolve(selected.id);renderButtons();
  }
  function repositoryProviderItem(raw,kind){
    if(!raw||typeof raw!=='object')throw new Error('Backup repository transport returned invalid file metadata.');
    const id=String(raw.id||''),expected=kind==='object'?/^obj_[a-f0-9]{32}$/u:['checkpoint','commit'].includes(kind)?/^cp_[a-f0-9]{32}$/u:/a^/u;
    if(raw.kind!==kind||!expected.test(id))throw new Error('Backup repository transport returned mismatched file identity.');
    const size=Number(raw.size);
    if(raw.size!==undefined&&(!Number.isSafeInteger(size)||size<=0))throw new Error('Backup repository transport returned invalid file size.');
    const digest=String(raw.digest||''),serverDigest=String(raw.serverDigest||'').toLowerCase();
    if(digest&&!/^[a-f0-9]{64}$/u.test(digest))throw new Error('Backup repository transport returned an invalid content digest.');
    if(serverDigest&&!/^[a-f0-9]{64}$/u.test(serverDigest))throw new Error('Backup repository transport returned an invalid server content digest.');
    const remoteVersion=String(raw.remoteVersion||''),verificationScope=String(raw.verificationScope||'');
    if(remoteVersion&&(!/^\d+$/u.test(remoteVersion)||remoteVersion.length>40))throw new Error('Backup repository transport returned an invalid remote version.');
    if(verificationScope&&verificationScope.length>320)throw new Error('Backup repository transport returned an invalid verification scope.');
    let history=null;
    if(kind==='checkpoint'&&raw.history&&typeof raw.history==='object'){
      const fingerprint=String(raw.history.logicalFingerprint||'').toLowerCase(),exportedAt=String(raw.history.exportedAt||''),daily=Number(raw.history.counts&&raw.history.counts.dailyRecord),notes=Number(raw.history.counts&&raw.history.counts.areaNote),role=String(raw.history.retention&&raw.history.retention.role||'normal'),protectedUntil=String(raw.history.retention&&raw.history.retention.protectedUntil||''),purpose=String(raw.history.retention&&raw.history.retention.purpose||''),calendarRaw=raw.history.retention&&raw.history.retention.calendar||{},localDate=String(calendarRaw.localDate||''),weekStart=String(calendarRaw.weekStart||''),month=String(calendarRaw.month||''),utcOffsetMinutes=Number(calendarRaw.utcOffsetMinutes),calendar=/^\d{4}-\d{2}-\d{2}$/u.test(localDate)&&/^\d{4}-\d{2}-\d{2}$/u.test(weekStart)&&/^\d{4}-\d{2}$/u.test(month)&&Number.isInteger(utcOffsetMinutes)?freeze({localDate,weekStart,month,utcOffsetMinutes}):null;
      if(/^[a-f0-9]{64}$/u.test(fingerprint)&&Number.isFinite(Date.parse(exportedAt))&&Number.isSafeInteger(daily)&&daily>=0&&Number.isSafeInteger(notes)&&notes>=0&&['normal','before-restore'].includes(role)&&(!protectedUntil||Number.isFinite(Date.parse(protectedUntil)))&&(!purpose||['before-restore','before-combine','before-clear-library','before-clear-archive'].includes(purpose)))history=freeze({logicalFingerprint:fingerprint,exportedAt:new Date(exportedAt).toISOString(),counts:freeze({dailyRecord:daily,areaNote:notes}),encrypted:raw.history.encrypted===true,retention:freeze({role,protectedUntil:protectedUntil?new Date(protectedUntil).toISOString():'',purpose:role==='before-restore'?(purpose==='before-clear-archive'?'before-clear-library':(purpose||'before-restore')):'',calendar})});
    }
    return Object.freeze({kind,id,name:clampText(raw.name||'',240),size:Number.isSafeInteger(size)?size:0,createdAt:String(raw.createdAt||''),modifiedAt:String(raw.modifiedAt||''),digest,serverDigest,remoteId:String(raw.remoteId||''),remoteVersion,verificationScope,history});
  }
  function verifiedHistoryIdentity(item){
    if(!item||!['checkpoint','commit'].includes(item.kind)||!item.remoteId||!item.remoteVersion||!item.verificationScope||!item.digest||!item.size)return '';
    return [VERIFIED_HISTORY_INTERPRETATION_VERSION,item.kind,item.id,item.remoteId,item.remoteVersion,item.size,item.digest,item.name,item.createdAt,item.modifiedAt].join('\u0000');
  }
  function verifiedHistoryCache(selected,item){
    const scope=String(item&&item.verificationScope||'');if(!scope)return null;
    let cache=verifiedHistoryByProvider.get(selected.id);
    if(!cache||cache.scope!==scope){cache={scope,entries:new Map(),proofs:new Map()};verifiedHistoryByProvider.set(selected.id,cache);}
    return cache;
  }
  function readVerifiedHistory(selected,item,expectedScope=null){
    if(expectedScope===null||item.verificationScope!==expectedScope)return null;
    const identity=verifiedHistoryIdentity(item),cache=identity&&verifiedHistoryCache(selected,item);if(!cache)return null;
    const hit=cache.entries.get(identity);if(!hit)return null;
    cache.entries.delete(identity);cache.entries.set(identity,hit);return hit;
  }
  function rememberVerifiedHistory(selected,item,value,expectedScope=null){
    if(expectedScope===null||item.verificationScope!==expectedScope)return value;
    const identity=verifiedHistoryIdentity(item),cache=identity&&verifiedHistoryCache(selected,item);if(!cache)return value;
    cache.entries.delete(identity);cache.entries.set(identity,value);
    while(cache.entries.size>VERIFIED_HISTORY_INDEX_LIMIT)cache.entries.delete(cache.entries.keys().next().value);
    return value;
  }
  function repositoryRetentionManifest(manifest){
    return freeze({version:manifest.version,checkpoint:manifest.checkpoint,exportedAt:manifest.exportedAt,sourceRevision:manifest.sourceRevision,retention:manifest.retention,objects:freeze([])});
  }
  function pruneRepositoryHistoryProofs(selected,items,expectedScope){
    if(!expectedScope)return;
    const cache=verifiedHistoryByProvider.get(selected.id);if(!cache||cache.scope!==expectedScope)return;
    const current=new Set(items.map(verifiedHistoryIdentity).filter(Boolean));
    for(const identity of cache.proofs.keys())if(!current.has(identity))cache.proofs.delete(identity);
    for(const identity of cache.entries.keys())if(!current.has(identity))cache.entries.delete(identity);
  }
  function repositoryDownloadLease(value){
    if(value instanceof Blob)return Object.freeze({blob:value,release:async()=>{}});
    if(!value||typeof value!=='object'||!(value.blob instanceof Blob))throw new Error('Backup repository transport returned an unreadable payload.');
    return Object.freeze({blob:value.blob,release:typeof value.release==='function'?value.release:async()=>{}});
  }
  function repositoryImportCancelled(){return Object.assign(new Error('Backup import was cancelled.'),{code:'STUDY_DIRECTOR_IMPORT_CANCELLED'});}
  async function mapRepositoryHistoryBounded(values,limit,worker,signal=null){
    const rows=Array.isArray(values)?values:[],results=new Array(rows.length),concurrency=Math.max(1,Math.min(VERIFIED_HISTORY_READ_CONCURRENCY,Math.floor(Number(limit)||1)));let next=0,failure=null;
    const run=async()=>{try{while(!failure){if(signal?.aborted)throw signal.reason||repositoryImportCancelled();const index=next++;if(index>=rows.length)return;results[index]=await worker(rows[index],index);}}catch(error){if(!failure)failure=error;}};
    await Promise.all(Array.from({length:Math.min(concurrency,rows.length)},run));if(failure)throw failure;return results;
  }
  function prepareRepositoryHistoryItems(values,kind){
    const seen=new Set(),items=[],invalid=[];
    for(const raw of Array.isArray(values)?values:[]){let item;try{item=repositoryProviderItem(raw,kind);if(seen.has(item.id))throw new Error(`Duplicate repository ${kind==='commit'?'commit':'checkpoint'} identity was returned by the backup provider.`);seen.add(item.id);items.push(item);}catch(error){if(/Duplicate repository (?:commit|checkpoint) identity/u.test(String(error&&error.message||'')))throw error;invalid.push(Object.freeze({item:item||null,error,kind}));}}
    return Object.freeze({items:Object.freeze(items),invalid:Object.freeze(invalid)});
  }
  async function verifyRepositoryHistoryItem(selected,item,kind,verifiedScope,{interactive=true,signal=null,forCleanup=false}={}){
    let lease;
    try{
      const identity=forCleanup&&item.verificationScope===verifiedScope?verifiedHistoryIdentity(item):'',proofCache=identity&&verifiedHistoryCache(selected,item),proof=proofCache&&proofCache.proofs.get(identity);
      if(proof)return proof;
      const cached=readVerifiedHistory(selected,item,verifiedScope);
      let value;
      if(cached&&cached.kind===kind)value=cached.value;
      else{
        lease=repositoryDownloadLease(await selected.repository.download(item,Object.freeze({signal})));
        if(item.size&&lease.blob.size!==item.size)throw new Error(`Remote repository ${kind} size changed before verification.`);
        if(item.digest){const actualDigest=await Exports.run('checksum',{value:lease.blob},{signal});if(actualDigest!==item.digest)throw new Error(`Remote repository ${kind} failed content-integrity verification.`);}
        value=kind==='commit'?await RepositoryCheckpointPipeline.inspectCommit(lease.blob):await RepositoryCheckpointPipeline.inspectManifest(lease.blob,{interactive});
        if(kind==='checkpoint'&&value.checkpoint.checkpointId!==item.id)throw new Error('Remote repository checkpoint identity does not match its manifest.');
        if(!forCleanup)rememberVerifiedHistory(selected,item,Object.freeze({kind,value}),verifiedScope);
      }
      const row=kind==='commit'?Object.freeze({id:item.id,ref:item,marker:value}):Object.freeze({id:item.id,ref:item,manifest:forCleanup?repositoryRetentionManifest(value):value});
      const result=Object.freeze({kind,row});if(proofCache)proofCache.proofs.set(identity,result);return result;
    }catch(error){if(signal?.aborted)throw signal.reason||error;if(error&&error.code==='STUDY_DIRECTOR_IMPORT_CANCELLED')throw error;return Object.freeze({kind,invalid:Object.freeze({item,error,kind})});}
    finally{await lease?.release?.().catch(()=>{});}
  }
  async function repositoryProviderStateWork(selected,{interactive=true,signal=null,forCleanup=false}={}){
    const [listed,listedCommits]=await Promise.all([selected.repository.list(Object.freeze({kind:'checkpoint',signal})),selected.repository.list(Object.freeze({kind:'commit',signal}))]);
    const items=Array.isArray(listed)?listed:Array.isArray(listed&&listed.items)?listed.items:[],commitItems=Array.isArray(listedCommits)?listedCommits:Array.isArray(listedCommits&&listedCommits.items)?listedCommits.items:[];
    const scopes=new Set([...items,...commitItems].map(raw=>String(raw&&raw.verificationScope||'')).filter(Boolean)),verifiedScope=scopes.size===1?[...scopes][0]:null;
    const preparedCommits=prepareRepositoryHistoryItems(commitItems,'commit'),preparedManifests=prepareRepositoryHistoryItems(items,'checkpoint'),invalid=[...preparedCommits.invalid,...preparedManifests.invalid],work=[...preparedCommits.items.map(item=>Object.freeze({kind:'commit',item})),...preparedManifests.items.map(item=>Object.freeze({kind:'checkpoint',item}))];
    if(forCleanup&&listed?.overflow!==true&&listedCommits?.overflow!==true)pruneRepositoryHistoryProofs(selected,[...preparedCommits.items,...preparedManifests.items],verifiedScope);
    const verified=await mapRepositoryHistoryBounded(work,selected.repository.historyReadConcurrency,task=>verifyRepositoryHistoryItem(selected,task.item,task.kind,verifiedScope,{interactive,signal,forCleanup}),signal),manifests=[],commits=[];
    for(const result of verified){if(result.invalid){invalid.push(result.invalid);continue;}if(result.kind==='commit')commits.push(result.row);else manifests.push(result.row);}
    const classified=RepositoryCheckpointPipeline.classifyState(Object.freeze({manifests:Object.freeze(manifests),commits:Object.freeze(commits)}));
    for(const pair of classified.invalidPairs)invalid.push(Object.freeze({item:pair.manifest.ref||null,error:pair.error,kind:'checkpoint'}));
    // Obsolete history keeps only verified retention/provenance proofs. Full
    // object references are needed solely for the at-most-16 selected versions.
    const fullById=new Map(),retentionAt=new Date().toISOString();
    if(forCleanup&&!invalid.length&&!Number(listed?.ignored)&&!Number(listedCommits?.ignored)&&listed?.overflow!==true&&listedCommits?.overflow!==true){
      const retained=RepositoryCheckpointPipeline.selectRetention(classified.committed,{now:new Date(retentionAt)}).retained;
      const full=await mapRepositoryHistoryBounded(retained,selected.repository.historyReadConcurrency,row=>verifyRepositoryHistoryItem(selected,row.ref,'checkpoint',verifiedScope,{interactive,signal}),signal);
      for(const result of full){if(result.invalid)invalid.push(result.invalid);else fullById.set(result.row.id,result.row.manifest);}
    }
    const rows=Object.freeze(classified.committed.map(row=>Object.freeze({item:row.ref,manifest:fullById.get(row.id)||row.manifest,commitItem:row.commitRef||null}))),uncommitted=Object.freeze(classified.uncommitted.map(row=>Object.freeze({item:row.ref,manifest:row.manifest}))),orphanCommits=Object.freeze(classified.orphanCommits.map(row=>row.ref));
    return Object.freeze({rows,uncommitted,orphanCommits,invalid:Object.freeze(invalid),ignored:Math.max(0,Number(listed&&listed.ignored)||0)+Math.max(0,Number(listedCommits&&listedCommits.ignored)||0),overflow:listed&&listed.overflow===true||listedCommits&&listedCommits.overflow===true,retentionAt:forCleanup?retentionAt:null,latest:rows.length?rows[rows.length-1]:null});
  }

  async function repositoryProviderState(selected,options={}){
    return repositoryProviderStateWork(repositoryOperationSelected(selected,options),options);
  }

  function repositoryMetadataTimestamp(item){
    const value=String(item&&item.history&&item.history.exportedAt||item&&item.createdAt||item&&item.modifiedAt||'');return Number.isFinite(Date.parse(value))?new Date(value).toISOString():'';
  }
  async function repositoryProviderInventory(selected,{signal=null}={}){
    await synchronizeRepositoryScope(selected);
    const [listed,listedCommits]=await Promise.all([selected.repository.list(Object.freeze({kind:'checkpoint',signal})),selected.repository.list(Object.freeze({kind:'commit',signal}))]);
    const items=Array.isArray(listed)?listed:Array.isArray(listed&&listed.items)?listed.items:[],commitItems=Array.isArray(listedCommits)?listedCommits:Array.isArray(listedCommits&&listedCommits.items)?listedCommits.items:[];
    const preparedCommits=prepareRepositoryHistoryItems(commitItems,'commit'),preparedManifests=prepareRepositoryHistoryItems(items,'checkpoint'),invalid=[...preparedCommits.invalid,...preparedManifests.invalid],commitById=new Map(preparedCommits.items.map(item=>[item.id,item])),manifestIds=new Set(preparedManifests.items.map(item=>item.id)),pairs=[],uncommitted=[];
    for(const item of preparedManifests.items){const commitItem=commitById.get(item.id)||null;if(commitItem)pairs.push(freeze({item,commitItem}));else uncommitted.push(freeze({item}));}
    const orphanCommits=preparedCommits.items.filter(item=>!manifestIds.has(item.id));
    pairs.sort((a,b)=>Date.parse(repositoryMetadataTimestamp(a.item)||0)-Date.parse(repositoryMetadataTimestamp(b.item)||0)||a.item.id.localeCompare(b.item.id));
    return freeze({pairs:freeze(pairs),uncommitted:freeze(uncommitted),orphanCommits:freeze(orphanCommits),invalid:freeze(invalid),ignored:Math.max(0,Number(listed&&listed.ignored)||0)+Math.max(0,Number(listedCommits&&listedCommits.ignored)||0),overflow:listed&&listed.overflow===true||listedCommits&&listedCommits.overflow===true});
  }
  function repositoryInventoryObservation(inventory,{verificationFailures=0}={}){
    const source=inventory&&typeof inventory==='object'?inventory:{};return freeze({invalid:source.invalid||freeze([]),uncommitted:source.uncommitted||freeze([]),orphanCommits:source.orphanCommits||freeze([]),ignored:Math.max(0,Number(source.ignored)||0)+Math.max(0,Number(verificationFailures)||0),overflow:source.overflow===true,rows:source.pairs||freeze([])});
  }
  async function verifyRepositoryInventoryPair(selected,pair,{interactive=true,signal=null}={}){
    if(!pair||!pair.item||!pair.commitItem)throw new Error('The selected backup version is incomplete.');
    const scopes=new Set([pair.item.verificationScope,pair.commitItem.verificationScope].filter(Boolean)),verifiedScope=scopes.size===1?[...scopes][0]:null;
    const [manifestResult,commitResult]=await Promise.all([
      verifyRepositoryHistoryItem(selected,pair.item,'checkpoint',verifiedScope,{interactive,signal}),
      verifyRepositoryHistoryItem(selected,pair.commitItem,'commit',verifiedScope,{interactive:false,signal})
    ]);
    if(manifestResult.invalid)throw manifestResult.invalid.error;if(commitResult.invalid)throw commitResult.invalid.error;
    const classified=RepositoryCheckpointPipeline.classifyState(freeze({manifests:freeze([manifestResult.row]),commits:freeze([commitResult.row])}));
    if(classified.invalidPairs.length)throw classified.invalidPairs[0].error;if(classified.committed.length!==1)throw new Error('The selected backup version is not completely committed.');
    return freeze({item:pair.item,commitItem:pair.commitItem,manifest:classified.committed[0].manifest});
  }
  function repositoryInventoryHistoryEntries(selected,inventory,{quarantinedObjectIds=null}={}){
    const quarantined=repositoryProviderObjectIds(quarantinedObjectIds),source=freeze({id:selected.id,label:selected.label}),now=Date.now(),rows=[...inventory.pairs].reverse();
    const retentionRows=[];
    for(const pair of rows){const summary=pair.item.history,calendar=summary?.retention?.calendar;if(!summary||!calendar)continue;retentionRows.push(freeze({id:pair.item.id,manifest:freeze({exportedAt:summary.exportedAt,retention:summary.retention})}));}
    let retainedIds=null,tiers={};
    if(retentionRows.length){const selection=RepositoryCheckpointPipeline.selectRetention(freeze(retentionRows),{now:new Date(now)});retainedIds=new Set(selection.retained.map(row=>row.id));tiers=selection.tiers;}
    const legacyLimit=Math.max(1,Number(RepositoryCheckpointPipeline.retention?.normalLimit)||15);let legacyKept=0;
    return freeze(rows.map(pair=>{
      const item=pair.item,summary=item.history,exportedAt=summary?.exportedAt||repositoryMetadataTimestamp(item),fingerprint=summary?.logicalFingerprint||item.digest;
      if(!/^[a-f0-9]{64}$/u.test(String(fingerprint||''))||!Number.isFinite(Date.parse(exportedAt)))return null;
      let tier='retained';
      if(summary?.retention?.calendar){if(!retainedIds?.has(item.id))return null;tier=String(tiers[item.id]||'retained');}
      else{if(legacyKept>=legacyLimit)return null;legacyKept+=1;tier=legacyKept===1?'latest':'retained';}
      return freeze({logicalId:'state_'+fingerprint,logicalFingerprint:fingerprint,exportedAt,counts:summary?.counts||freeze({dailyRecord:0,areaNote:0}),location:freeze({sourceId:source.id,sourceLabel:source.label,checkpointId:item.id,exportedAt,tier,encrypted:summary?.encrypted===true,verification:'on-restore',legacyMetadata:!summary,quarantineDeferred:quarantined.length>0})});
    }).filter(Boolean));
  }

  async function repositoryObjectInventory(selected,{signal=null}={}){
    const listed=await selected.repository.list(Object.freeze({kind:'object',signal}));
    if(listed&&listed.overflow===true){rememberRepositoryObjectInventory(selected,[],{overflow:true});return freeze({items:freeze([]),invalidCount:Math.max(0,Number(listed&&listed.ignored)||0),overflow:true});}
    const raw=Array.isArray(listed)?listed:Array.isArray(listed&&listed.items)?listed.items:[],byId=new Map(),duplicates=new Set();let invalidCount=Math.max(0,Number(listed&&listed.ignored)||0);
    for(const value of raw){let item;try{item=repositoryProviderItem(value,'object');}catch{invalidCount+=1;continue;}if(byId.has(item.id)){duplicates.add(item.id);continue;}byId.set(item.id,item);}
    if(duplicates.size)throw new Error('Duplicate repository objects were returned by the backup provider. The repository operation was stopped safely.');
    const items=freeze([...byId.values()]);rememberRepositoryObjectInventory(selected,items.map(item=>freeze({id:item.id,ref:item})),{invalidCount});return freeze({items,invalidCount,overflow:false});
  }
  function repositoryAvailableObjectIdsFromInventory(inventory,manifests){
    const history=Array.isArray(manifests)?manifests:(manifests?[manifests]:[]);if(!history.length||!inventory||inventory.overflow===true)return history.length?new Set():null;
    const byId=new Map((inventory.items||[]).map(item=>[item.id,item])),available=new Set();
    for(const manifest of history)for(const entry of manifest.objects||[]){const item=byId.get(entry.objectId);if(item&&(!item.size||item.size===entry.storedBytes)&&(!item.digest||item.digest===entry.storedChecksum))available.add(entry.objectId);}
    return available;
  }
  async function repositoryProviderPublicationBase(selected,{signal=null}={}){
    const inventory=await repositoryProviderInventory(selected,{signal});if(inventory.overflow)throw new Error('Backup history could not be read completely. Backup was stopped safely.');
    const objectInventoryTask=inventory.pairs.length?repositoryObjectInventory(selected,{signal}):Promise.resolve(null);
    let latest=null,verificationFailures=0;
    for(const pair of [...inventory.pairs].reverse()){
      try{latest=await verifyRepositoryInventoryPair(selected,pair,{interactive:false,signal});break;}
      catch(error){verificationFailures+=1;AppDiagnostics.capture('backup-provider.repository-latest-verification',error,'warn');}
    }
    const [objectInventory]=await Promise.all([objectInventoryTask,observeRepositoryMaintenance(registeredProvider(selected),repositoryInventoryObservation(inventory,{verificationFailures}))]);
    return freeze({inventory,objectInventory,latest,history:freeze(latest?[latest.manifest]:[]),invalidCount:inventory.invalid.length+verificationFailures});
  }

  async function verifyUploadedRepositoryObject(selected,entry,item,{signal=null,index=0,count=0,onProgress=null}={}){
    const expected=String(entry.storedChecksum||'').toLowerCase(),prefix=`Verifying object ${index} of ${count} in ${selected.label}`;
    const report=(stage,message,details={})=>{if(!signal?.aborted&&typeof onProgress==='function')onProgress(stage,message,details);};
    if(item.serverDigest){
      if(item.serverDigest!==expected)throw new Error('Google Drive server SHA-256 did not match the uploaded repository object.');
      report('verify',`${prefix}… ✓`);return true;
    }
    const transferProgress=(stage,label)=>progress=>{const loadedBytes=Math.max(0,Number(progress?.loaded)||0),activeBytes=Math.max(1,Number(progress?.total)||Number(entry.storedBytes)||1);report(stage,`${prefix} · ${label}`,{loadedBytes,activeBytes});};
    const lease=repositoryDownloadLease(await selected.repository.download(item,Object.freeze({signal,onProgress:transferProgress('verify-download','downloading')})));
    try{await RepositoryCheckpointPipeline.verifyObject(lease.blob,entry,Object.freeze({signal,onProgress:transferProgress('verify-hash','checking')}));return true;}
    finally{await lease.release().catch(()=>{});}
  }
  async function verifyUploadedRepositoryManifest(selected,item,expected,expectedDigest='',signal=null){
    const localDigest=String(expectedDigest||item.digest||'').toLowerCase();
    if(item.serverDigest){
      if(!localDigest||item.digest!==localDigest||item.serverDigest!==localDigest)throw new Error('Google Drive server SHA-256 did not match the uploaded backup version.');
      return expected;
    }
    const lease=repositoryDownloadLease(await selected.repository.download(item,Object.freeze({signal})));
    try{
      if(item.size&&lease.blob.size!==item.size)throw new Error('Remote repository checkpoint size changed before verification.');
      if(item.digest){
        const actualDigest=await Exports.run('checksum',{value:lease.blob});
        if(actualDigest!==item.digest)throw new Error('Remote repository checkpoint failed content-integrity verification.');
      }
      const actual=await RepositoryCheckpointPipeline.inspectManifest(lease.blob,{interactive:false});
      if(actual.checkpoint.checkpointId!==expected.checkpoint.checkpointId||actual.sourceRevision!==expected.sourceRevision||actual.exportedAt!==expected.exportedAt)throw new Error('Remote repository checkpoint failed provenance verification.');
      return actual;
    }finally{await lease.release().catch(()=>{});}
  }
  async function verifyUploadedRepositoryCommit(selected,item,expected,signal=null){
    const localDigest=String(expected&&expected.digest||item.digest||'').toLowerCase();
    if(item.serverDigest){
      if(!localDigest||item.digest!==localDigest||item.serverDigest!==localDigest)throw new Error('Google Drive server SHA-256 did not match the uploaded backup commit.');
      return Object.freeze({format:expected.format,version:expected.version,checkpointId:expected.checkpointId,exportedAt:expected.exportedAt,sourceRevision:expected.sourceRevision,manifestVersion:expected.manifestVersion});
    }
    const lease=repositoryDownloadLease(await selected.repository.download(item,Object.freeze({signal})));
    try{if(item.size&&lease.blob.size!==item.size)throw new Error('Remote repository commit size changed before verification.');if(item.digest){const actualDigest=await Exports.run('checksum',{value:lease.blob});if(actualDigest!==item.digest)throw new Error('Remote repository commit failed content-integrity verification.');}const actual=await RepositoryCheckpointPipeline.inspectCommit(lease.blob);if(actual.checkpointId!==expected.checkpointId||actual.exportedAt!==expected.exportedAt||actual.sourceRevision!==expected.sourceRevision||Number(actual.manifestVersion)!==Number(expected.manifestVersion))throw new Error('Remote repository commit failed provenance verification.');return actual;}
    finally{await lease.release().catch(()=>{});}
  }
  function repositoryPublicationCapable(selected){return !!(selected&&selected.repository&&selected.repository.beginPublication&&selected.repository.listPublications&&selected.repository.assertPublication&&selected.repository.endPublication);}
  function repositoryMaintenanceCapable(selected){return !!(selected&&selected.repository&&selected.repository.beginMaintenance&&selected.repository.listMaintenances&&selected.repository.assertMaintenance&&selected.repository.endMaintenance);}
  function repositoryCoordinationCapable(selected){return repositoryPublicationCapable(selected)&&repositoryMaintenanceCapable(selected);}
  async function repositoryPublicationSafety(selected){
    if(!repositoryPublicationCapable(selected))return freeze({blocked:false,reason:'publication-protection-unavailable',active:0,invalid:0});
    let listed;try{listed=await selected.repository.listPublications();}catch(error){AppDiagnostics.capture('backup-provider.repository-publications',error,'warn');return freeze({blocked:true,reason:'publication-state-unavailable',active:0,invalid:1});}
    const rows=Array.isArray(listed)?listed:Array.isArray(listed&&listed.items)?listed.items:[],now=Date.now();let active=0,invalid=Math.max(0,Number(listed&&listed.ignored)||0)+(listed&&listed.overflow===true?1:0),nextEligibleAt=0;
    for(const row of rows){const created=Date.parse(String(row&&row.createdAt||''));if(!Number.isFinite(created)){invalid+=1;continue;}if(now-created<PUBLICATION_MAX_AGE_MS){active+=1;const expires=created+PUBLICATION_MAX_AGE_MS;if(!nextEligibleAt||expires<nextEligibleAt)nextEligibleAt=expires;continue;}try{await selected.repository.endPublication(row);}catch(error){AppDiagnostics.capture('backup-provider.repository-publication-expired-cleanup',error,'warn');}}
    return freeze({blocked:active>0||invalid>0,reason:active>0?'active-publication':invalid>0?'uncertain-publication-state':'',active,invalid,nextEligibleAt:nextEligibleAt?new Date(nextEligibleAt).toISOString():''});
  }
  async function repositoryMaintenanceSafety(selected,{excludeId=''}={}){
    if(!repositoryMaintenanceCapable(selected))return freeze({blocked:false,reason:'maintenance-protection-unavailable',active:0,invalid:0});
    let listed;try{listed=await selected.repository.listMaintenances();}catch(error){AppDiagnostics.capture('backup-provider.repository-maintenances',error,'warn');return freeze({blocked:true,reason:'maintenance-state-unavailable',active:0,invalid:1});}
    const rows=Array.isArray(listed)?listed:Array.isArray(listed&&listed.items)?listed.items:[],now=Date.now(),excluded=String(excludeId||'');let active=0,invalid=Math.max(0,Number(listed&&listed.ignored)||0)+(listed&&listed.overflow===true?1:0),nextEligibleAt=0;
    for(const row of rows){if(excluded&&String(row&&row.id||'')===excluded)continue;const created=Date.parse(String(row&&row.createdAt||'')),expires=row&&row.expiresAt?Date.parse(String(row.expiresAt)):created+MAINTENANCE_MAX_AGE_MS;if(!Number.isFinite(created)||!Number.isFinite(expires)||expires<=created){invalid+=1;continue;}if(now<expires){active+=1;if(!nextEligibleAt||expires<nextEligibleAt)nextEligibleAt=expires;continue;}try{await selected.repository.endMaintenance(row);}catch(error){AppDiagnostics.capture('backup-provider.repository-maintenance-expired-cleanup',error,'warn');}}
    return freeze({blocked:active>0||invalid>0,reason:active>0?'active-maintenance':invalid>0?'uncertain-maintenance-state':'',active,invalid,nextEligibleAt:nextEligibleAt?new Date(nextEligibleAt).toISOString():''});
  }
  async function beginRepositoryPublication(selected){
    if(!repositoryPublicationCapable(selected))return null;
    return selected.repository.beginPublication();
  }
  function repositoryMaintenanceError(safety){
    const uncertain=Number(safety&&safety.invalid)||0;
    const error=new Error(uncertain?'Google Drive repository maintenance state could not be verified safely. Retry after the other device finishes its backup work.':'Google Drive repository maintenance is still yielding to a foreground Study Director operation.');
    error.code=uncertain?'STUDY_DIRECTOR_REPOSITORY_MAINTENANCE_UNCERTAIN':'STUDY_DIRECTOR_REPOSITORY_MAINTENANCE_BUSY';
    error.repositoryMaintenance=freeze({reason:String(safety&&safety.reason||''),active:Math.max(0,Number(safety&&safety.active)||0),invalid:uncertain,nextEligibleAt:String(safety&&safety.nextEligibleAt||'')});
    return error;
  }
  async function waitAbortable(ms,signal){
    if(signal&&signal.aborted)throw signal.reason instanceof Error?signal.reason:new DOMException('The operation was aborted.','AbortError');
    await new Promise((resolve,reject)=>{let timer=null;const finish=(fn,value)=>{if(timer!==null){clearTimeout(timer);timer=null;}signal?.removeEventListener?.('abort',abort);fn(value);};const abort=()=>finish(reject,signal.reason instanceof Error?signal.reason:new DOMException('The operation was aborted.','AbortError'));timer=setTimeout(()=>finish(resolve),Math.max(1,Number(ms)||1));signal?.addEventListener?.('abort',abort,{once:true});});
  }
  async function waitForRepositoryMaintenanceYield(selected,{signal=null,progress=null}={}){
    if(!repositoryMaintenanceCapable(selected))return true;
    const started=Date.now(),deadline=started+PROVIDER_RECOVERY_MAINTENANCE_YIELD_MS;let announced=false,polls=0;
    for(;;){
      if(signal&&signal.aborted)throw signal.reason instanceof Error?signal.reason:new DOMException('The operation was aborted.','AbortError');
      const safety=await repositoryMaintenanceSafety(selected);polls+=1;
      OperationDiagnostics.mark('recovery-safety-maintenance-state',{provider:selected.id,blocked:safety.blocked===true,reason:String(safety.reason||''),active:Math.max(0,Number(safety.active)||0),invalid:Math.max(0,Number(safety.invalid)||0),polls});
      if(!safety.blocked){if(announced)OperationDiagnostics.mark('recovery-safety-maintenance-yield-complete',{provider:selected.id,waitedMs:Math.max(0,Date.now()-started),polls});return true;}
      if(Number(safety.invalid)>0){const error=repositoryMaintenanceError(safety);OperationDiagnostics.mark('recovery-safety-maintenance-yield-failed',{provider:selected.id,errorCode:error.code,reason:String(safety.reason||'')});throw error;}
      const remaining=deadline-Date.now();if(remaining<=0){const error=repositoryMaintenanceError(safety);error.code='STUDY_DIRECTOR_RECOVERY_MAINTENANCE_YIELD_TIMEOUT';OperationDiagnostics.mark('recovery-safety-maintenance-yield-failed',{provider:selected.id,errorCode:error.code,reason:String(safety.reason||'')});throw error;}
      if(!announced){announced=true;OperationDiagnostics.mark('recovery-safety-maintenance-preemption-start',{provider:selected.id,maxWaitMs:PROVIDER_RECOVERY_MAINTENANCE_YIELD_MS});}
      if(typeof progress==='function')progress('safety-yield',`Pausing background backup maintenance for this recovery…`,{waitedMs:Math.max(0,Date.now()-started),maxWaitMs:PROVIDER_RECOVERY_MAINTENANCE_YIELD_MS});
      await waitAbortable(Math.min(PROVIDER_RECOVERY_MAINTENANCE_POLL_MS,remaining),signal);
    }
  }
  async function validateRepositoryPublicationStart(selected,lease,{foregroundPriority=false,signal=null,progress=null}={}){
    if(!lease||!repositoryMaintenanceCapable(selected))return true;
    if(foregroundPriority)return waitForRepositoryMaintenanceYield(selected,{signal,progress});
    const safety=await repositoryMaintenanceSafety(selected);if(safety.blocked)throw repositoryMaintenanceError(safety);return true;
  }
  async function validateRepositoryPublicationStartMeasured(selected,lease,options={}){
    OperationDiagnostics.mark('provider-publication-safety-start',{provider:selected.id,foregroundPriority:options&&options.foregroundPriority===true});
    try{const result=await validateRepositoryPublicationStart(selected,lease,options);OperationDiagnostics.mark('provider-publication-safety-complete',{provider:selected.id,ok:true});return result;}
    catch(error){OperationDiagnostics.mark('provider-publication-safety-failed',{provider:selected.id,errorCode:String(error&&error.code||error&&error.name||'Error'),reason:String(error&&error.repositoryMaintenance&&error.repositoryMaintenance.reason||'')});throw error;}
  }
  async function assertRepositoryPublication(selected,lease){if(!lease)return true;const [,safety]=await Promise.all([selected.repository.assertPublication(lease),repositoryMaintenanceSafety(selected)]);if(safety.blocked)throw new Error('Repository maintenance began while this backup was preparing. Retry the backup.');return true;}
  async function endRepositoryPublication(selected,lease){if(!lease)return false;try{return await selected.repository.endPublication(lease);}catch(error){AppDiagnostics.capture('backup-provider.repository-publication-release',error,'warn');return false;}}
  async function beginRepositoryMaintenance(selected,{onBlocked=null}={}){
    if(!repositoryCoordinationCapable(selected))return null;
    const lease=await selected.repository.beginMaintenance();
    try{
      const [publications,maintenances]=await Promise.all([repositoryPublicationSafety(selected),repositoryMaintenanceSafety(selected,{excludeId:lease.id})]);
      if(!publications.blocked&&!maintenances.blocked)return lease;
      if(typeof onBlocked==='function')onBlocked(freeze({publications,maintenances}));
      await selected.repository.endMaintenance(lease).catch(()=>{});return null;
    }catch(error){try{await selected.repository.endMaintenance(lease);}catch(releaseError){AppDiagnostics.capture('backup-provider.repository-maintenance-release',releaseError,'warn');}throw error;}
  }
  async function assertRepositoryMaintenance(selected,lease){if(!lease)return true;const [,publications]=await Promise.all([selected.repository.assertMaintenance(lease),repositoryPublicationSafety(selected)]);if(publications.blocked){const error=new Error('Repository maintenance yielded to a higher-priority foreground publication.');error.name='AbortError';error.code='REPOSITORY_BACKGROUND_PREEMPTED';throw error;}return true;}
  async function endRepositoryMaintenance(selected,lease){if(!lease)return false;try{return await selected.repository.endMaintenance(lease);}catch(error){AppDiagnostics.capture('backup-provider.repository-maintenance-release',error,'warn');return false;}}
  async function cleanupRepositoryProviderState(selected,state,{reuseObjectInventory=false,maintenanceLease=null,checkMaintenance=null,inventoryBeforeDelete=false,beginDeletion=null,workBudget=null}={}){
    const publicationCapable=repositoryPublicationCapable(selected),publicationSafety=await repositoryPublicationSafety(selected),objectGraceBefore=publicationCapable?new Date(Date.now()-OBJECT_GC_GRACE_MS).toISOString():'',assertLease=checkMaintenance||(async()=>{if(maintenanceLease)await assertRepositoryMaintenance(selected,maintenanceLease);});
    const cleanupRows=Object.freeze(state.rows.map(row=>Object.freeze({id:row.item.id,ref:Object.freeze({checkpoint:row.item,commit:row.commitItem}),manifest:row.manifest}))),retentionBacklog=RepositoryCheckpointPipeline.selectRetention(cleanupRows,{now:new Date()}).remove.length,checkpointDeleteBudget=Math.min(MAINTENANCE_MAX_CHECKPOINT_DELETES,Math.max(MAINTENANCE_MIN_CHECKPOINT_DELETES,retentionBacklog));
    const cleaned=await RepositoryCheckpointPipeline.cleanup(Object.freeze({
      checkpoints:cleanupRows,now:state.retentionAt?new Date(state.retentionAt):new Date(),
      inventoryBeforeDelete,beginDeletion,workBudget,
      invalidCount:state.invalid.length,ignoredCount:state.ignored,overflow:state.overflow,blockObjectGc:publicationSafety.blocked,objectGraceBefore,maxCheckpointDeletes:checkpointDeleteBudget,maxObjectDeletes:MAINTENANCE_MAX_OBJECT_DELETES,
      incompleteArtifacts:freeze([...(state.uncommitted||[]).map(row=>freeze({kind:'checkpoint',ref:row.item})),...(state.orphanCommits||[]).map(item=>freeze({kind:'commit',ref:item}))]),
      deleteIncompleteArtifact:async artifact=>{await assertLease();await selected.repository.delete(artifact.ref);return true;},
      deleteCheckpoint:async row=>{await assertLease();if(row.ref.commit)await selected.repository.delete(row.ref.commit);await assertLease();await selected.repository.delete(row.ref.checkpoint);return true;},
      listObjects:async()=>{
        await assertLease();if(reuseObjectInventory){const cached=reusableRepositoryObjectListing(selected);if(cached)return cached;}
        const listing=await selected.repository.list(Object.freeze({kind:'object'})),raw=Array.isArray(listing)?listing:Array.isArray(listing&&listing.items)?listing.items:[];
        const items=[],seen=new Set();let invalidCount=Math.max(0,Number(listing&&listing.ignored)||0);
        for(const value of raw){try{const item=repositoryProviderItem(value,'object');if(seen.has(item.id)){invalidCount+=1;continue;}seen.add(item.id);items.push(Object.freeze({id:item.id,ref:item,createdAt:item.createdAt,modifiedAt:item.modifiedAt}));}catch{invalidCount+=1;}}
        return Object.freeze({items:Object.freeze(items),overflow:listing&&listing.overflow===true,invalidCount});
      },
      deleteObject:async item=>{await assertLease();return selected.repository.delete(item.ref);},
      onError:(kind,error)=>AppDiagnostics.capture(kind==='checkpoint-delete'?'backup-provider.repository-checkpoint-delete':kind==='incomplete-delete'?'backup-provider.repository-incomplete-delete':'backup-provider.repository-object-gc',error,'warn')
    }));
    if(!cleaned.gcPending){const cache=verifiedHistoryByProvider.get(selected.id);if(cache)pruneRepositoryHistoryProofs(selected,cleaned.retained.flatMap(row=>[row.ref.checkpoint,row.ref.commit].filter(Boolean)),cache.scope);}
    return cleaned;
  }
  async function cleanupRepositoryProvider(selected,state,newCheckpointId,options={}){
    if(!state.rows.some(row=>row.item.id===newCheckpointId))throw new Error('The newly uploaded checkpoint did not become the committed Latest candidate before retention cleanup.');
    return String((await cleanupRepositoryProviderState(selected,state,options)).warning||'');
  }
  async function cleanupRepositoryProviderSafely(selected,{signal=null,workBudget,traceId=''}={}){
    const owner=selected,scoped=repositoryOperationSelected(selected,{signal});
    await synchronizeRepositoryScope(scoped);
    if(!repositoryCoordinationCapable(scoped)){
      workBudget.start(PROVIDER_MAINTENANCE_BUDGET_MS);
      const state=await repositoryProviderState(scoped,{interactive:false,signal,forCleanup:true});
      return cleanupRepositoryProviderState(scoped,state,{workBudget});
    }
    let contentionRetryMs=0,maintenanceLease=await beginRepositoryMaintenance(scoped,{onBlocked:safety=>{const uncertain=Number(safety.publications&&safety.publications.invalid)||Number(safety.maintenances&&safety.maintenances.invalid)||0;if(uncertain)return;const deadlines=[safety.publications&&safety.publications.nextEligibleAt,safety.maintenances&&safety.maintenances.nextEligibleAt].map(value=>Date.parse(String(value||''))).filter(Number.isFinite);if(deadlines.length)contentionRetryMs=Math.max(1000,Math.min(...deadlines)-Date.now()+1000);}});
    if(!maintenanceLease)return freeze({warning:'Repository maintenance was deferred because another backup or maintenance operation is active.',retained:null,removedCheckpoints:0,checkpointDeferred:0,checkpointFailures:0,gcRemoved:0,gcDeferred:0,gcBudgetDeferred:0,gcFailures:0,gcSkipped:true,gcPending:true,maintenanceBlocked:true,contentionRetryMs,uncertainCount:0,selection:null});
    const renewable=typeof scoped.repository.renewMaintenance==='function'&&typeof owner.repository.beginOperation==='function';let renewing=null;
    const keepAlive=async(force=false)=>{
      if(signal?.aborted)throw signal.reason;
      if(renewing){await renewing;return;}
      const created=Date.parse(maintenanceLease.createdAt),duration=Date.parse(maintenanceLease.expiresAt)-created;
      const renewAfter=Number.isFinite(duration)&&duration>0?duration/4:PROVIDER_MAINTENANCE_BUDGET_MS/2;
      if(renewable&&Date.now()-created>=renewAfter){
        renewing=(async()=>{maintenanceLease=await scoped.repository.renewMaintenance(maintenanceLease);await assertRepositoryMaintenance(scoped,maintenanceLease);})().finally(()=>{renewing=null;});await renewing;return;
      }
      if(force)await assertRepositoryMaintenance(scoped,maintenanceLease);
    };
    try{
      if(!renewable)workBudget.start(PROVIDER_MAINTENANCE_BUDGET_MS);
      const protectedSelection=renewable?repositoryOperationSelected(owner,{signal,checkProtection:keepAlive}):scoped;
      await keepAlive(true);
      OperationDiagnostics.mark('maintenance-inventory-start',{provider:selected.id},traceId);
      const state=await repositoryProviderState(protectedSelection,{interactive:false,signal,forCleanup:true});
      return await cleanupRepositoryProviderState(protectedSelection,state,{workBudget,checkMaintenance:()=>keepAlive(true),inventoryBeforeDelete:true,beginDeletion:async()=>{await keepAlive(true);OperationDiagnostics.mark('maintenance-inventory-complete',{provider:selected.id,total:state.rows.length},traceId);if(renewable)workBudget.start(PROVIDER_MAINTENANCE_BUDGET_MS);}});
    }finally{
      if(renewing)await renewing.catch(()=>{});
      await endRepositoryMaintenance(scoped,maintenanceLease);
    }
  }

  async function saveRepositoryProvider(selected,{interactive=true,excludedObjectIds=null,retention=null,signal=null,preemptBackground=true,foregroundPriority=false,recoveryProgress=null,repositorySnapshot=null,pendingIntent=null}={}){
    const presentationId=foregroundView()?.operationId||'';
    if(preemptBackground)await preemptProviderBackground(selected);
    const publicationOwner=selected;selected=repositoryOperationSelected(selected,{signal});
    await synchronizeRepositoryScope(selected);
    const role=retention?.role==='before-restore'?'before-restore':'normal',previousPublication=providerPublications.get(selected.id)?.continuation.status();
    if(previousPublication?.invalidated||previousPublication?.pending&&previousPublication.role!==role)await discardProviderPublication(selected);
    let publication=null,continuation=null;
    if(selected.repository.discardUploads&&repositoryScopeByProvider.has(selected.id)){
      publication=providerPublications.get(selected.id);if(!publication){publication=freeze({continuation:RepositoryCheckpointPipeline.createPublication(),requestId:String(pendingIntent?.requestedAt||'')});providerPublications.set(selected.id,publication);}continuation=publication.continuation;
    }
    const resuming=continuation?.status().pending===true;
    const publicationProtected=repositoryCoordinationCapable(selected),deferredMaintenance=!!maintenanceHooks&&publicationProtected;let publicationLease=null,publicationSafetyTask=null,maintenanceQueued=false,maintenanceNeeded=false,published=null;
    let objectStarted=0,objectCompleted=0,objectCount=0,uploadedBytes=0,totalBytes=0;
    const progress=(stage,message,details={})=>{if(signal?.aborted||(foregroundView()?.operationId||'')!==presentationId)return;if(recoveryProgress){if(presentationId)recoveryStatus(message,true,recoveryProgress,stage,details);else try{recoveryProgress(freeze({stage,message,ok:true,...details}));}catch(error){AppDiagnostics.capture('backup-provider.recovery-progress',error,'warn');}}else providerProgress(selected,stage,message,details);};
    try{
      progress(retention?.role==='before-restore'?'safety-scan':'scan',retention?.role==='before-restore'?`Preparing protected safety backup in ${selected.label}…`:`Reading existing backups in ${selected.label}…`);
      OperationDiagnostics.mark('provider-repository-scan-start',{provider:selected.id,beforeRestore:retention?.role==='before-restore'});
      if(publicationProtected){publicationLease=await beginRepositoryPublication(selected);OperationDiagnostics.mark('provider-publication-lease-acquired',{provider:selected.id});publicationSafetyTask=validateRepositoryPublicationStartMeasured(selected,publicationLease,{foregroundPriority,signal,progress});}
      const excludedTask=integrityScrubHooks?integrityScrubHooks.quarantine(selected.id):Promise.resolve([]),discoveryTask=repositorySnapshot?Promise.resolve(null):repositoryProviderPublicationBase(selected,{signal});
      const [persistedExcluded,discovered]=await Promise.all([excludedTask,discoveryTask,publicationSafetyTask||Promise.resolve(true)]);
      let base,availableObjectIds;
      if(repositorySnapshot&&Array.isArray(repositorySnapshot.history)&&Array.isArray(repositorySnapshot.availableObjectIds)&&repositorySnapshot.inventory){
        base=freeze({history:freeze([...repositorySnapshot.history]),inventory:repositorySnapshot.inventory,invalidCount:Math.max(0,Number(repositorySnapshot.invalidCount)||0)});availableObjectIds=new Set(repositorySnapshot.availableObjectIds);
        OperationDiagnostics.mark('provider-repository-scan-reused',{provider:selected.id,beforeRestore:retention?.role==='before-restore',history:base.history.length,objects:availableObjectIds.size});
      }else{base=discovered;availableObjectIds=repositoryAvailableObjectIdsFromInventory(base.objectInventory,base.history);}
      const history=base.history,excluded=repositoryProviderObjectIds([...(Array.isArray(excludedObjectIds)?excludedObjectIds:[]),...(Array.isArray(persistedExcluded)?persistedExcluded:[])]);
      OperationDiagnostics.mark('provider-repository-scan-complete',{provider:selected.id,history:history.length,invalid:Number(base.invalidCount)||0,reused:!!repositorySnapshot});
      const maintenancePendingState=deferredMaintenance?await maintenanceState(selected):null,maintenanceWasActionable=maintenanceActionable(maintenancePendingState),maintenanceReason=String(maintenancePendingState&&maintenancePendingState.reason||''),maintenanceDeferred=!maintenanceWasActionable&&maintenanceReason==='publication-contention',inventory=base.inventory;
      maintenanceNeeded=maintenanceWasActionable||base.invalidCount>0||inventory.uncommitted.length>0||inventory.orphanCommits.length>0;
      if(availableObjectIds instanceof Set)for(const id of excluded)availableObjectIds.delete(id);
      progress('prepare',`Preparing backup for ${selected.label}…`);
      OperationDiagnostics.mark('checkpoint-preparation-start',{provider:selected.id,beforeRestore:retention?.role==='before-restore'});
      if(resuming)OperationDiagnostics.mark('provider-publication-resumed',{provider:selected.id,status:'running'});
      const publishCheckpoint=retention?.role==='before-restore'?RepositoryCheckpointPipeline.publishInline:RepositoryCheckpointPipeline.publish;
      published=await publishCheckpoint(history,{interactive,availableObjectIds,excludedObjectIds:excluded,retention,signal,continuation},Object.freeze({
        writeObject:async (entry,prepared)=>{
          requireBackupMutationControl('saving to '+selected.label);await entry.checkProtection?.();
          if(!objectCount){const fresh=prepared.objects.filter(object=>!object.reused);objectCount=fresh.length;totalBytes=fresh.reduce((sum,object)=>sum+object.storedBytes,0);}
          const index=++objectStarted;OperationDiagnostics.mark('provider-object-upload-start',{provider:selected.id,index,count:objectCount,bytes:entry.storedBytes});
          progress(retention?.role==='before-restore'?'safety-upload':'upload',retention?.role==='before-restore'?`Saving protected safety backup in ${selected.label}…`:`Uploading backup data to ${selected.label}…`,{current:objectCompleted,total:objectCount,completedBytes:uploadedBytes,totalBytes});
          const item=repositoryProviderItem(await selected.repository.upload(Object.freeze({kind:'object',id:entry.objectId,name:entry.objectId+'.sdobject',blob:entry.blob,size:entry.storedBytes,digest:entry.storedChecksum,exportedAt:prepared.exportedAt,appVersion:APP_VERSION,checkProtection:entry.checkProtection,knownAbsent:!resuming})),'object');
          await verifyUploadedRepositoryObject(selected,entry,item,{signal,index,count:objectCount,onProgress:progress});uploadedBytes+=entry.storedBytes;objectCompleted+=1;rememberRepositoryObjectReceipt(selected,item);OperationDiagnostics.mark('provider-object-upload-complete',{provider:selected.id,index,count:objectCount,bytes:entry.storedBytes,completed:objectCompleted});
          progress(retention?.role==='before-restore'?'safety-upload':'upload',retention?.role==='before-restore'?`Saving protected safety backup in ${selected.label}…`:`Uploading backup data to ${selected.label}…`,{current:objectCompleted,total:objectCount,completedBytes:uploadedBytes,totalBytes});return item;
        },
        writeManifest:async file=>{
          requireBackupMutationControl('saving to '+selected.label);await file.checkProtection?.();await file.checkSource?.();if(publicationLease)await assertRepositoryPublication(selected,publicationLease);
          OperationDiagnostics.mark('provider-manifest-upload-start',{provider:selected.id});progress(retention?.role==='before-restore'?'safety-manifest':'manifest',retention?.role==='before-restore'?`Finalizing protected safety backup in ${selected.label}…`:`Uploading and verifying the backup version in ${selected.label}…`);
          const digest=await Exports.run('checksum',{value:file.blob},{signal}),checkpointId=file.manifest.checkpoint.checkpointId;let item=null;
          try{
            item=repositoryProviderItem(await selected.repository.upload(Object.freeze({kind:'checkpoint',id:checkpointId,name:checkpointId+'.sdcheckpoint',blob:file.blob,size:file.blob.size,digest,exportedAt:file.exportedAt,appVersion:APP_VERSION,checkProtection:file.checkProtection,checkSource:file.checkSource,knownAbsent:!resuming,historySummary:Object.freeze({logicalFingerprint:file.manifest.logicalFingerprint,counts:file.manifest.counts,encrypted:file.manifest.encrypted===true,retention:file.manifest.retention})})),'checkpoint');
            const verifiedManifest=await verifyUploadedRepositoryManifest(selected,item,file.manifest,digest,signal);await file.checkSource?.();
            const projected=Object.freeze([...history.map(manifest=>Object.freeze({id:manifest.checkpoint.checkpointId,manifest})),Object.freeze({id:verifiedManifest.checkpoint.checkpointId,manifest:verifiedManifest})]);if(RepositoryCheckpointPipeline.selectRetention(projected,{now:new Date(Date.parse(verifiedManifest.exportedAt))}).remove.length)maintenanceNeeded=true;
            rememberVerifiedHistory(selected,item,Object.freeze({kind:'checkpoint',value:verifiedManifest}),item.verificationScope||null);OperationDiagnostics.mark('provider-manifest-upload-complete',{provider:selected.id});return item;
          }catch(error){
            if(item)await selected.repository.delete(item).catch(()=>{});else await selected.repository.delete(Object.freeze({kind:'checkpoint',id:checkpointId,digest})).catch(()=>{});throw error;
          }
        },
        commit:async marker=>{
          requireBackupMutationControl('saving to '+selected.label);await marker.checkProtection?.();await marker.checkSource?.();if(publicationLease)await assertRepositoryPublication(selected,publicationLease);let item=null;
          OperationDiagnostics.mark('provider-commit-start',{provider:selected.id});progress(retention?.role==='before-restore'?'safety-commit':'commit',retention?.role==='before-restore'?`Committing protected safety backup in ${selected.label}…`:`Committing and verifying the backup in ${selected.label}…`);
          try{item=repositoryProviderItem(await selected.repository.upload(Object.freeze({kind:'commit',id:marker.checkpointId,name:marker.checkpointId+'.sdcommit',blob:marker.blob,size:marker.size,digest:marker.digest,exportedAt:marker.exportedAt,appVersion:APP_VERSION,checkProtection:marker.checkProtection,checkSource:marker.checkSource,knownAbsent:!resuming})),'commit');const verifiedCommit=await verifyUploadedRepositoryCommit(selected,item,marker,signal);await marker.checkSource?.();rememberVerifiedHistory(selected,item,Object.freeze({kind:'commit',value:verifiedCommit}),item.verificationScope||null);OperationDiagnostics.mark('provider-commit-complete',{provider:selected.id});return item;}
          catch(error){if(item)await selected.repository.delete(item).catch(()=>{});else await selected.repository.delete(Object.freeze({kind:'commit',id:marker.checkpointId,digest:marker.digest})).catch(()=>{});throw error;}
        },
        onCommitted:async context=>{OperationDiagnostics.mark('provider-checkpoint-committed',{provider:selected.id});progress(retention?.role==='before-restore'?'safety-complete':'complete',retention?.role==='before-restore'?`Protected safety backup verified in ${selected.label}.`:`Finishing ${selected.label} backup…`);RepositoryCheckpointPipeline.markCompleted({recoveryCopy:{type:'provider',id:selected.id,label:selected.label,sourceRevision:context.sourceRevision||context.exportedAt||''}});return null;},
        cleanup:deferredMaintenance?async()=>{if(!maintenanceNeeded)return Object.freeze({warning:''});const scheduler=providerMaintenanceScheduler(selected);if(maintenanceDeferred&&maintenancePendingState&&scheduler){const due=Date.parse(String(maintenancePendingState.nextEligibleAt||'')),delay=Number.isFinite(due)?Math.max(1000,due-Date.now()):MAINTENANCE_POLICY.contentionMs;scheduler.schedule(delay,maintenanceReason||'repository-state','earliest');maintenanceQueued=true;}else maintenanceQueued=await scheduler?.request('repository-state',MAINTENANCE_POLICY.busyMs,{mode:'earliest'})===true;return Object.freeze({warning:maintenanceQueued?'':'Backup cleanup is still pending and will be retried on a later backup.'});}:async context=>{progress('finish',`Finishing ${selected.label} backup…`);const after=await repositoryProviderState(selected,{interactive:false}),warning=await cleanupRepositoryProvider(selected,after,context.manifest.checkpoint.checkpointId,{reuseObjectInventory:true});return Object.freeze({warning});},
        retainOnFailure:error=>{
          const code=String(error?.code||''),cancelCode=String(signal?.reason?.code||'');
          if(code==='PROVIDER_FOREGROUND_CANCELLED'||cancelCode==='PROVIDER_FOREGROUND_CANCELLED')return false;
          return !error?.studyDirectorDriveNoRetry||code==='REPOSITORY_BACKGROUND_PREEMPTED'||/authorization/i.test(String(error?.message||''));
        },
        onFailure:async(_error,context)=>{
          if(context.committed)return;
          if(context.retained){
            OperationDiagnostics.mark('provider-publication-retained',{provider:selected.id,status:'pending',beforeRestore:role==='before-restore'});
            if(role==='normal')try{if(!await pendingRetryState(publicationOwner))await markPendingRetry(publicationOwner);}finally{schedulePendingProviderBackup(publicationOwner);}
            return;
          }
          if(context.commitReceipt)await selected.repository.delete(context.commitReceipt).catch(()=>{});
          if(context.publication)await selected.repository.delete(context.publication).catch(()=>{});
          for(const row of context.written)if(row.receipt)await selected.repository.delete(row.receipt).catch(()=>{});
          if(deferredMaintenance)await providerMaintenanceScheduler(selected)?.request('failure-cleanup',MAINTENANCE_POLICY.continuationMs,{mode:'earliest'});
        }
      }));
    }finally{if(continuation&&!continuation.status().pending)await discardProviderPublication(publicationOwner);if(publicationLease){const lease=publicationLease;publicationLease=null;OperationDiagnostics.mark('provider-publication-release-start',{provider:selected.id});const released=await endRepositoryPublication(signal&&signal.aborted?publicationOwner:selected,lease);OperationDiagnostics.mark('provider-publication-release-complete',{provider:selected.id,released});if(released&&maintenanceHooks){const pending=await maintenanceState(publicationOwner);if(pending&&String(pending.reason||'')==='publication-contention'&&!maintenanceActionable(pending))await providerMaintenanceScheduler(publicationOwner)?.request('repository-state',MAINTENANCE_POLICY.busyMs,{mode:'replace'});}}}
    const warning=[String(published&&published.warning||''),String(published&&published.cleanupResult&&published.cleanupResult.warning||'')].filter(Boolean).join(' '),item=published&&published.publication||{};
    clearRecentHistory(selected);
    return Object.freeze({name:item.name||published.checkpointId,checkpointId:published.checkpointId,manifest:published.manifest,warning,maintenancePending:deferredMaintenance&&maintenanceQueued,sourceRevision:published.sourceRevision,requestId:publication?.requestId||String(pendingIntent?.requestedAt||''),objectsWritten:published.objectsWritten,objectsReused:published.objectsReused,writtenBytes:published.writtenBytes,attachmentBytesWritten:published.attachmentBytesWritten});
  }
  function activeProtectedProviderRow(state,now=Date.now()){
    const rows=(state&&Array.isArray(state.rows)?state.rows:[]).map(row=>freeze({id:row.item.id,manifest:row.manifest,row})),active=RepositoryCheckpointPipeline.activeProtected(rows,now);
    return active&&active.row||null;
  }
  async function removeProtectedProviderCheckpoint(selected,checkpointId,{signal=null}={}){
    selected=repositoryOperationSelected(selected,{signal});
    requireBackupMutationControl('removing a safety backup from '+selected.label);
    const requested=String(checkpointId||'');let maintenanceLease=null;
    if(repositoryCoordinationCapable(selected)){
      maintenanceLease=await beginRepositoryMaintenance(selected);
      if(!maintenanceLease)throw new Error(`Safety backup removal in ${selected.label} was deferred because another backup or maintenance operation is active.`);
    }
    try{
      await assertRepositoryMaintenance(selected,maintenanceLease);
      const state=await repositoryProviderState(selected,{interactive:false,signal}),active=activeProtectedProviderRow(state);
      if(!active||active.item.id!==requested)throw new Error(`The selected Before restore safety backup in ${selected.label} is no longer protected.`);
      if(active.commitItem){await assertRepositoryMaintenance(selected,maintenanceLease);await selected.repository.delete(active.commitItem);}
      await assertRepositoryMaintenance(selected,maintenanceLease);await selected.repository.delete(active.item);
      await assertRepositoryMaintenance(selected,maintenanceLease);
      const servicedPending=await maintenanceState(selected,{throwOnError:true}),after=await repositoryProviderState(selected,{interactive:false,signal}),cleanup=await cleanupRepositoryProviderState(selected,after,{maintenanceLease});
      await providerMaintenanceScheduler(selected)?.adopt(cleanup,{trigger:'safety-removal',pending:servicedPending});
      const retained=Array.isArray(cleanup.retained)?cleanup.retained:after.rows.map(row=>Object.freeze({id:row.item.id,ref:Object.freeze({checkpoint:row.item,commit:row.commitItem}),manifest:row.manifest}));
      const quarantinedObjectIds=integrityScrubHooks?await integrityScrubHooks.quarantine(selected.id):[],entries=RepositoryCheckpointPipeline.projectHistory(Object.freeze(retained.map(row=>Object.freeze({id:row.id,manifest:row.manifest}))),Object.freeze({id:selected.id,label:selected.label}),{quarantinedObjectIds});
      clearRecentHistory(selected);return freeze({removed:true,checkpointId:requested,gcRemoved:Number(cleanup.gcRemoved)||0,warning:String(cleanup.warning||''),entries});
    }finally{if(maintenanceLease)await endRepositoryMaintenance(selected,maintenanceLease);}
  }
  async function pendingRetryState(selected){
    if(!pendingRetryHooks)return null;
    try{return await pendingRetryHooks.read(selected.id);}catch(error){AppDiagnostics.capture('backup-provider.pending-retry-read',error,'warn');throw error;}
  }
  function resetConvergenceRetry(selected){providerConvergenceRetryAttempts.delete(safeId(selected&&selected.id));presentation.condition(selected.id,'retry-exhausted','');}
  function nextConvergenceRetryDelay(selected){const id=safeId(selected&&selected.id);if(!id)return PROVIDER_CONVERGENCE_RETRY_DELAYS[0];const attempt=Math.max(0,Number(providerConvergenceRetryAttempts.get(id))||0),delay=PROVIDER_CONVERGENCE_RETRY_DELAYS[Math.min(attempt,PROVIDER_CONVERGENCE_RETRY_DELAYS.length-1)];providerConvergenceRetryAttempts.set(id,attempt+1);if(attempt+1>=PROVIDER_CONVERGENCE_RETRY_DELAYS.length)presentation.condition(id,'retry-exhausted','External Google Drive backup remains pending after repeated failures. Open Google Drive settings and choose Back up now or reconnect.');return delay;}
  async function markPendingRetry(selected){
    if(!pendingRetryHooks)return false;
    try{const marked=await pendingRetryHooks.mark(selected.id)===true;if(marked)resetConvergenceRetry(selected);return marked;}catch(error){AppDiagnostics.capture('backup-provider.pending-retry-write',error,'warn');return false;}
  }
  async function clearPendingRetry(selected,expected=undefined){
    if(!pendingRetryHooks){resetConvergenceRetry(selected);return true;}
    try{const cleared=await pendingRetryHooks.clear(selected.id,expected)!==false;if(cleared)resetConvergenceRetry(selected);return cleared;}catch(error){AppDiagnostics.capture('backup-provider.pending-retry-clear',error,'warn');return false;}
  }
  function publicationCoversPending(saved,pending){
    // A timestamp can stay equal across edits; only the captured request may settle.
    if(pending&&String(saved?.requestId||'')!==String(pending.requestedAt||''))return false;
    const required=Date.parse(String(pending?.sourceRevision||'')),completed=Date.parse(String(saved?.sourceRevision||''));
    return !Number.isFinite(required)||Number.isFinite(completed)&&completed>=required;
  }
  async function retryPendingProviderBackup(selected,{signal=null}={}){
    const pending=await pendingRetryState(selected);if(!pending&&!providerPublications.get(selected.id)?.continuation.status().pending)return freeze({status:'idle',reason:'none',maintenancePending:false});
    const summary=presentation.begin(selected.id,'backup',{id:'external-backup',label:selected.label,foreground:false,message:'External backup update is pending.'});
    renderButtons();
    try{
      const saved=await saveRepositoryProvider(selected,{interactive:false,signal,preemptBackground:false,pendingIntent:pending,recoveryProgress:value=>summary.update({message:value.message,progress:value})}),covered=publicationCoversPending(saved,pending),cleared=covered&&await clearPendingRetry(selected,pending);
      summary.finish({message:cleared?`External backup verified in ${selected.label}.`:covered?'External backup is verified; status bookkeeping is pending.':'External backup is verified; newer changes are queued.',outcome:cleared?'external-backup-verified':'external-backup-pending'});
      return freeze({status:cleared?'completed':'pending',checkpointId:String(saved&&saved.checkpointId||saved&&saved.name||''),reason:cleared?'':covered?'retry marker could not be cleared':'source',maintenancePending:saved&&saved.maintenancePending===true});
    }catch(error){summary.finish({message:'External backup update is pending.',lifecycle:signal?.aborted?'cancelled':'failed',outcome:'external-backup-pending'});AppDiagnostics.capture('backup-provider.pending-retry',error,'warn');return freeze({status:'pending',reason:String(error&&error.message||error)});}finally{renderButtons();}
  }
  function providerConvergenceJob(selected){
    if(!selected?.repository||!pendingRetryHooks)return null;const id=safeId(selected.id);
    let job=providerConvergenceJobs.get(id);if(job)return job;const background=providerBackground(selected);
    job=background.registerJob('convergence',{isAvailable:()=>{const available=providerBackgroundAvailability(selected),saved=providerPublications.get(id)?.continuation.status();return available===true&&saved?.pending&&saved.role==='before-restore'?'awaiting-foreground':available;},retryMs:PROVIDER_CONVERGENCE_RETRY_DELAYS[0],capture:error=>AppDiagnostics.capture('backup-provider.convergence-lifecycle',error,'warn'),execute:async({nextEligibleAt:eligibleAt})=>{
      let scope=null,traceId='';
      try{
        if(!await pendingRetryState(selected)&&!providerPublications.get(selected.id)?.continuation.status().pending){resetConvergenceRetry(selected);return freeze({status:'idle',reason:'none'});}
        if(busy||preparing){schedulePendingProviderBackup(selected,PROVIDER_CONVERGENCE_BUSY_RETRY_MS);return freeze({status:'deferred',reason:'busy'});}
        scope=await background.beginBackground('convergence',{budgetMs:0,preemptCode:'REPOSITORY_BACKGROUND_PREEMPTED',preemptMessage:'Deferred Drive convergence yielded to a foreground operation.'});
        if(!scope){schedulePendingProviderBackup(selected,PROVIDER_CONVERGENCE_BUSY_RETRY_MS);return freeze({status:'deferred',reason:'background-busy'});}
        traceId=OperationDiagnostics.start('provider-convergence',selected.label,{provider:selected.id,background:true,trigger:'managed-recovery',nextEligibleAt:eligibleAt,actionable:true});
        OperationDiagnostics.mark('background-transition',background.transition('convergence','scheduled','running',{reason:'managed-recovery',nextEligibleAt:eligibleAt,actionable:true}),traceId);
        OperationDiagnostics.mark('convergence-eligibility',{provider:selected.id,nextEligibleAt:eligibleAt,actionable:true},traceId);
        OperationDiagnostics.mark('convergence-publication-start',{provider:selected.id},traceId);const result=await retryPendingProviderBackup(selected,{signal:scope.signal});OperationDiagnostics.mark('convergence-publication-complete',{provider:selected.id,status:String(result.status||''),maintenancePending:result.maintenancePending===true},traceId);OperationDiagnostics.mark('background-transition',background.transition('convergence','running',result.status==='completed'?'completed':'deferred',{reason:String(result.reason||''),actionable:false}),traceId);OperationDiagnostics.finish({status:String(result.status||'pending'),reason:String(result.reason||''),maintenancePending:result.maintenancePending===true},traceId);
        if(result.status==='completed'){resetConvergenceRetry(selected);background.wake('publication');}
        else if(result.reason==='none')resetConvergenceRetry(selected);
        else schedulePendingProviderBackup(selected,scope.signal.aborted?PROVIDER_CONVERGENCE_BUSY_RETRY_MS:nextConvergenceRetryDelay(selected));
        return result;
      }catch(error){
        const preempted=scope?.signal.aborted&&error?.name==='AbortError';
        if(!traceId)traceId=OperationDiagnostics.start('provider-convergence',selected.label,{provider:selected.id,background:true,trigger:'managed-recovery',nextEligibleAt:eligibleAt,actionable:true});
        OperationDiagnostics.mark('background-transition',background.transition('convergence',scope?'running':'scheduled',preempted?'deferred':'failed',{reason:preempted?String(error?.code||'background-yield'):'unavailable',actionable:false}),traceId);
        if(preempted)OperationDiagnostics.finish({status:'pending',reason:String(error?.code||'background-yield')},traceId);
        else{OperationDiagnostics.fail(error,{background:true,status:'unavailable'},traceId);AppDiagnostics.capture('backup-provider.pending-retry-background',error,'warn');}
        // A failed read is unknown, not absence. The next bounded opportunity
        // checks the durable marker again; do not read it again in this handler.
        schedulePendingProviderBackup(selected,preempted?PROVIDER_CONVERGENCE_BUSY_RETRY_MS:nextConvergenceRetryDelay(selected));
        return freeze({status:'unavailable',reason:preempted?'preempted':'state-read-failed'});
      }finally{scope?.release();}
    }});providerConvergenceJobs.set(id,job);return job;
  }
  function schedulePendingProviderBackup(selected,delay=1000){return providerConvergenceJob(selected)?.schedule(Math.max(1000,Number(delay)||1000),'managed-recovery','replace')||false;}
  function wakeProviderBackground(selected,trigger='eligibility'){
    if(!selected?.repository)return false;
    try{
      // Declare every job before the owner reconciles eligibility and intent.
      providerMaintenanceScheduler(selected);providerIntegrityScheduler(selected);providerConvergenceJob(selected);
      return providerBackground(selected).wake(trigger);
    }catch(error){AppDiagnostics.capture('backup-provider.background-configuration',error,'error');return false;}
  }
  async function queueResolvedProviderState(selected,result,{sourceNeeded=true,sourceCheckpoint=''}={}){
    if(!result||result.cancelled)return freeze({source:freeze({status:'skipped',reason:'cancelled'}),device:freeze({status:'skipped',reason:'cancelled'})});
    let source,device;
    if(sourceNeeded){
      const retryQueued=await markPendingRetry(selected);
      source=freeze({status:retryQueued?'pending':'failed',reason:retryQueued?'queued':'automatic retry could not be queued',retryQueued});
    }else{
      providerBackground(selected).clearScheduled('convergence');
      await clearPendingRetry(selected);
      source=freeze({status:'completed',checkpoint:String(sourceCheckpoint||''),unchanged:true,retryQueued:false});
    }
    if(convergencePropagationHooks){
      try{const propagated=await convergencePropagationHooks.device(freeze({source:'provider',providerId:selected.id,providerLabel:selected.label,deferred:true}));device=freeze(propagated&&typeof propagated==='object'?{...propagated}:{status:'pending',reason:'queued',queued:true});}
      catch(error){device=freeze({status:'pending',reason:String(error&&error.message||error),queued:false});AppDiagnostics.capture('backup-provider.managed-convergence-device',error,'warn');}
    }else device=freeze({status:'skipped',reason:'not-configured'});
    return freeze({source,device});
  }
  async function managedProviderPresent(selected,result,{sourceNeeded=true,sourceCheckpoint=''}={}){
    const convergence=await queueResolvedProviderState(selected,result,{sourceNeeded,sourceCheckpoint}),sourceReady=convergence.source.status==='completed'||convergence.source.status==='pending'&&convergence.source.retryQueued===true,deviceReady=['completed','skipped'].includes(String(convergence.device.status||''))||convergence.device.status==='pending'&&convergence.device.queued===true;
    const retryNote=!sourceReady&&convergence.source.retryQueued!==true?'automatic retry could not be queued':'';
    const reason=[sourceReady?'':convergence.source.reason||`${selected.label} backup could not be queued`,retryNote,deviceReady?'':convergence.device.reason||'Device Backup refresh could not be queued'].filter(Boolean).join(' · ');
    return freeze({status:sourceReady&&deviceReady?'completed':'pending',reason,checkpointId:String(convergence.source.checkpoint||''),source:convergence.source,device:convergence.device});
  }
  function repositoryObjectInventoryForManifest(inventory,manifest){
    if(!inventory||inventory.overflow===true)throw new Error('An unusual number of backup objects was found. Recovery was stopped for review.');
    const byId=new Map((inventory.items||[]).map(item=>[item.id,item]));
    for(const entry of manifest.objects||[]){const item=byId.get(entry.objectId);if(!item||item.size&&item.size!==entry.storedBytes||item.digest&&item.digest!==entry.storedChecksum)throw new Error(`Repository object ${entry.objectId} is missing or its metadata no longer matches the selected version.`);}
    return freeze({byId,invalid:Math.max(0,Number(inventory.invalidCount)||0)});
  }
  async function loadRepositoryProvider(selected,operation,{checkpointId='',mode='bring-in',onProgress=null}={}){
    if(!['bring-in','restore-version'].includes(mode))throw new TypeError('Unsupported managed repository recovery mode.');
    const presentationId=foregroundView()?.operationId||'';
    const progress=(stage,message,details={})=>{if(operation.signal?.aborted||(foregroundView()?.operationId||'')!==presentationId)return;recoveryStatus(message,true,onProgress,stage,details);};
    OperationDiagnostics.mark('provider-background-preemption-start',{provider:selected.id});
    await preemptProviderBackground(selected);
    OperationDiagnostics.mark('provider-background-preemption-complete',{provider:selected.id});
    const providerSelected=selected;selected=repositoryOperationSelected(selected,{signal:operation.signal});
    await synchronizeRepositoryScope(selected);
    progress('history',`Reading backup versions from ${selected.label}…`);
    OperationDiagnostics.mark('recovery-history-scan-start',{provider:selected.id});
    let inventory=recentHistory(providerSelected,checkpointId);const reusedHistory=!!inventory;
    if(reusedHistory)OperationDiagnostics.mark('recovery-history-scan-reused',{provider:selected.id,versions:inventory.pairs.length});
    else{inventory=await repositoryProviderInventory(selected,{signal:operation.signal});rememberRecentHistory(providerSelected,inventory);}
    await observeRepositoryMaintenance(providerSelected,repositoryInventoryObservation(inventory));
    OperationDiagnostics.mark('recovery-history-scan-complete',{provider:selected.id,versions:inventory.pairs.length,invalid:inventory.invalid.length+inventory.ignored+inventory.uncommitted.length+inventory.orphanCommits.length,reused:reusedHistory});
    if(inventory.overflow)throw new Error('Backup history could not be read completely. Recovery was stopped safely.');
    const newest=[...inventory.pairs].reverse();if(!newest.length)throw new Error('No eligible Study Director backups were found.');
    const choices=freeze(newest.map(pair=>{const summary=pair.item.history;return freeze({id:pair.item.id,name:pair.item.name,exportedAt:summary?.exportedAt||repositoryMetadataTimestamp(pair.item),encrypted:summary?.encrypted===true,counts:summary?.counts||freeze({dailyRecord:0,areaNote:0}),size:pair.item.size,verification:summary?'on-restore':'legacy-on-restore'});}));
    let chosenId=String(checkpointId||'')||choices[0].id;
    if(checkpointId&&!choices.some(choice=>choice.id===chosenId))throw new Error('The selected backup version is no longer available.');
    if(!checkpointId&&selected.repository.choose){
      OperationDiagnostics.mark('checkpoint-selection-start',{provider:selected.id});
      let chosen;
      try{chosen=await selected.repository.choose(choices,freeze({ignored:inventory.invalid.length+inventory.ignored+inventory.uncommitted.length+inventory.orphanCommits.length,signal:operation.signal,mode}));}
      catch(error){OperationDiagnostics.mark('checkpoint-selection-failed',{provider:selected.id,reason:String(error&&error.code||error&&error.name||'Error')});throw error;}
      if(!chosen){OperationDiagnostics.mark('checkpoint-selection-cancelled',{provider:selected.id});return null;}
      chosenId=String(chosen.id||chosen);OperationDiagnostics.mark('checkpoint-selection-complete',{provider:selected.id});
    }
    const pair=newest.find(candidate=>candidate.item.id===chosenId);if(!pair)throw new Error('The selected backup version is no longer available.');
    OperationDiagnostics.mark('checkpoint-selected',{provider:selected.id});
    progress('verify',`Verifying selected backup in ${selected.label}…`);
    const verificationTask=(async()=>{OperationDiagnostics.mark('selected-checkpoint-verification-start',{provider:selected.id});const row=await verifyRepositoryInventoryPair(selected,pair,{interactive:true,signal:operation.signal});OperationDiagnostics.mark('selected-checkpoint-verification-complete',{provider:selected.id,objects:Number(row.manifest.objects&&row.manifest.objects.length)||0});return row;})();
    const inventoryTask=(async()=>{OperationDiagnostics.mark('recovery-object-inventory-start',{provider:selected.id});const value=await repositoryObjectInventory(selected,{signal:operation.signal});OperationDiagnostics.mark('recovery-object-inventory-complete',{provider:selected.id,objects:value.items.length,invalid:value.invalidCount,overflow:value.overflow===true});return value;})();
    const quarantineTask=integrityScrubHooks?integrityScrubHooks.quarantine(selected.id):Promise.resolve([]);
    const [row,listedObjects,quarantineRows]=await Promise.all([verificationTask,inventoryTask,quarantineTask]),quarantinedObjectIds=repositoryProviderObjectIds(quarantineRows),quarantined=new Set(quarantinedObjectIds);
    const objectInventory=repositoryObjectInventoryForManifest(listedObjects,row.manifest),needed=new Set((row.manifest.objects||[]).map(entry=>entry.objectId)),total=needed.size,totalDownloadBytes=(row.manifest.objects||[]).reduce((sum,entry)=>sum+Math.max(0,Number(entry&&entry.storedBytes)||0),0),downloadSlots=new Map(),downloadProgressBytes=new Map();let started=0,completed=0;
    if((row.manifest.objects||[]).some(entry=>quarantined.has(entry.objectId)))throw new Error('The selected backup version references an object that is quarantined after an integrity check. Choose another version or create a fresh backup.');
    progress('inventory',`Preparing selected backup data from ${selected.label}…`);
    const readObject=async entry=>{
      const item=objectInventory.byId.get(entry.objectId);if(!item)throw new Error(`Repository object ${entry.objectId} is unavailable.`);
      let index=downloadSlots.get(entry.objectId);if(!index){index=++started;downloadSlots.set(entry.objectId,index);downloadProgressBytes.set(entry.objectId,0);OperationDiagnostics.mark('provider-object-download-start',{provider:selected.id,index,count:total,bytes:entry.storedBytes});}
      const aggregateBytes=()=>Math.min(totalDownloadBytes,[...downloadProgressBytes.values()].reduce((sum,value)=>sum+Math.max(0,Number(value)||0),0));
      progress('download',`Downloading backup data from ${selected.label}…`,{current:completed,total,active:index,completedBytes:aggregateBytes(),totalBytes:totalDownloadBytes});
      const result=await selected.repository.download(item,freeze({signal:operation.signal,onProgress:value=>{const loaded=Math.max(0,Number(value&&value.loaded)||0),bytes=Math.max(1,Number(value&&value.total)||Number(entry.storedBytes)||1);downloadProgressBytes.set(entry.objectId,Math.min(bytes,loaded));progress('download',`Downloading backup data from ${selected.label}…`,{current:completed,total,active:index,completedBytes:aggregateBytes(),totalBytes:totalDownloadBytes});}}));
      downloadProgressBytes.set(entry.objectId,Math.max(0,Number(entry.storedBytes)||0));completed+=1;OperationDiagnostics.mark('provider-object-download-complete',{provider:selected.id,index,count:total,bytes:entry.storedBytes,completed});progress('download',`Downloading backup data from ${selected.label}…`,{current:completed,total,completedBytes:aggregateBytes(),totalBytes:totalDownloadBytes});return result;
    };
    if(!managedRecoveryHooks)throw new Error('Managed recovery transaction coordination is unavailable.');
    const repositorySnapshot=freeze({history:freeze([row.manifest]),availableObjectIds:freeze([...objectInventory.byId.keys()]),inventory,invalidCount:inventory.invalid.length});
    const managedRecovery=transaction=>managedRecoveryHooks.run(freeze({
      kind:mode,label:selected.label,apply:async()=>{progress('apply',mode==='bring-in'?'Combining data locally…':'Applying selected backup locally…');const result=await transaction.apply();progress('verify-local','Verifying restored local data…');return result;},
      createSafety:async()=>{
        OperationDiagnostics.mark('external-safety-publication-start',{provider:selected.id});
        progress('safety',`Creating protected safety backup in ${selected.label}…`);
        const safetyPurpose=mode==='bring-in'?'before-combine':'before-restore';
        const saved=await saveRepositoryProvider(selected,{retention:{role:'before-restore',purpose:safetyPurpose},signal:operation.signal,preemptBackground:false,foregroundPriority:true,recoveryProgress:onProgress,repositorySnapshot});
        const checkpoint=String(saved&&saved.checkpointId||''),retention=saved&&saved.manifest&&saved.manifest.retention,protectedUntil=Date.parse(retention&&retention.protectedUntil||'');
        if(!checkpoint||retention?.role!=='before-restore'||!Number.isFinite(protectedUntil)||protectedUntil<=Date.now()){const error=new Error(`The protected Before restore safety backup in ${selected.label} was not saved safely.`);error.code='STUDY_DIRECTOR_RECOVERY_SAFETY_INVALID';OperationDiagnostics.mark('external-safety-publication-failed',{provider:selected.id,errorCode:error.code});throw error;}
        OperationDiagnostics.mark('external-safety-publication-complete',{provider:selected.id});
        return freeze({verified:true,checkpointId:checkpoint,protectedUntil:new Date(protectedUntil).toISOString(),sourceRevision:String(saved&&saved.sourceRevision||saved&&saved.manifest&&saved.manifest.sourceRevision||''),source:selected.id});
      },
      publishPresent:async result=>{progress('finalize','Finalizing recovery…');return managedProviderPresent(providerSelected,result,{sourceNeeded:mode==='bring-in',sourceCheckpoint:mode==='restore-version'?row.item.id:''});}
    }));
    return RepositoryCheckpointPipeline.inspect(row.manifest,readObject,{interactive:true,signal:operation.signal,committed:true,managedRecovery,managedProgress:onProgress});
  }
  async function removeProtectedRepositoryProvider(id,checkpointId){
    if(busy)return freeze({removed:false,reason:'busy'});
    const selected=providers.get(safeId(id));if(!selected||!selected.repository)throw new Error('Backup location is unavailable.');
    const foreground=beginForeground(selected);if(!foreground)return freeze({removed:false,reason:'busy'});busy=true;
    try{
      await foreground.settled;if(selected.prepare)await selected.prepare();await authorize(selected,'remove-safety-backup');
      return await removeProtectedProviderCheckpoint(selected,checkpointId,{signal:foreground.signal});
    }catch(error){await providerMaintenanceScheduler(selected)?.request('error',MAINTENANCE_POLICY.errorMs,{mode:'replace'});throw error;}
    finally{await release(selected,'remove-safety-backup');busy=false;foreground.release();}
  }

  async function repositoryScope(id){
    const provider=providers.get(safeId(id));if(!provider?.repository)throw new Error('Backup repository is unavailable.');
    const selected=repositoryOperationSelected(provider),reader=selected.repository.scope;
    if(typeof reader!=='function')return '';
    const scope=String(await reader()||'');if(!scope||scope.length>320)throw new Error('Backup repository identity is unavailable.');return scope;
  }
  async function scrubRepositoryProvider(id,options={}){
    const providerSelected=providers.get(safeId(id));if(!providerSelected||!providerSelected.repository)throw new Error('Repository backup provider is unavailable.');
    const selected=repositoryOperationSelected(providerSelected,{signal:options&&options.signal||null});
    const state=await repositoryProviderState(selected,{interactive:false,signal:options&&options.signal||null});
    if(state.overflow||state.ignored||state.invalid?.length||state.uncommitted?.length||state.orphanCommits?.length)throw new Error('Repository history is incomplete or unreadable; integrity verification is unavailable.');
    const actualScope=typeof selected.repository.scope==='function'?String(await selected.repository.scope()||''):'';
    if(options.repositoryScope&&options.repositoryScope!==actualScope){const error=new Error('The backup repository changed.');error.code='REPOSITORY_CHANGED';throw error;}
    const history=Object.freeze(state.rows.map(row=>row.manifest));
    if(!history.length)return Object.freeze({complete:true,cursor:'',checked:0,checkedBytes:0,total:0,quarantined:Object.freeze([])});
    const readObject=entry=>selected.repository.download(Object.freeze({kind:'object',id:entry.objectId,size:entry.storedBytes,digest:entry.storedChecksum}),Object.freeze({signal:options&&options.signal||null}));
    const readRange=async(entry,range)=>selected.repository.download(Object.freeze({kind:'object',id:entry.objectId,size:entry.storedBytes,digest:entry.storedChecksum}),Object.freeze({...range,signal:options&&options.signal||null}));
    try{return await RepositoryCheckpointPipeline.scrub(history,readObject,{...options,readRange});}
    catch(error){
      const objectId=/^obj_[a-f0-9]{32}$/u.test(String(error&&error.repositoryObjectId||''))?String(error.repositoryObjectId):'';
      if(objectId&&['REPOSITORY_INTEGRITY_CORRUPT','REPOSITORY_OBJECT_MISSING'].includes(error?.code)&&(!options.repositoryScope||options.repositoryScope===await repositoryScope(id))){try{const repair=await saveRepositoryProvider(providerSelected,{excludedObjectIds:[objectId],signal:options&&options.signal||null,preemptBackground:false});error.repositoryRepaired=true;error.repositoryRepairCheckpointId=String(repair&&repair.name||'');}catch(repairFailure){error.repositoryRepaired=false;error.repositoryRepairError=String(repairFailure&&repairFailure.message||repairFailure);AppDiagnostics.capture('backup-provider.repository-integrity-repair',repairFailure,'warn');}}
      throw error;
    }
  }
  function clearProviderScheduledJob(job){for(const coordinator of providerBackgroundCoordinators.values()){if(!coordinator.unregisterJob(job))coordinator.clearScheduled(job);}}
  function configureIntegrityScrub(config=null){
    clearProviderScheduledJob('integrity');
    if(config===null){integrityScrubHooks=null;providerIntegritySchedulers.clear();return true;}
    if(!config||typeof config!=='object')throw new TypeError('Repository integrity-scrub hooks are invalid.');
    for(const key of ['readTarget','writeResult','prepare','isAvailable','isUnsafe','yieldTask','quarantine'])if(typeof config[key]!=='function')throw new TypeError('Repository integrity-scrub hooks are invalid.');
    integrityScrubHooks=Object.freeze({readTarget:config.readTarget,writeResult:config.writeResult,prepare:config.prepare,isAvailable:config.isAvailable,isUnsafe:config.isUnsafe,yieldTask:config.yieldTask,quarantine:config.quarantine});providerIntegritySchedulers.clear();for(const selected of providers.values())wakeProviderBackground(selected,'configured');return true;
  }
  function configureConvergencePropagation(config=null){
    if(config===null){convergencePropagationHooks=null;return true;}
    if(!config||typeof config!=='object'||typeof config.device!=='function')throw new TypeError('Managed convergence hooks are invalid.');
    convergencePropagationHooks=Object.freeze({device:config.device});return true;
  }
  function configureManagedRecovery(config=null){
    if(config===null){managedRecoveryHooks=null;return true;}
    if(!config||typeof config!=='object'||typeof config.run!=='function')throw new TypeError('Managed recovery hooks are invalid.');
    managedRecoveryHooks=Object.freeze({run:config.run});return true;
  }
  function configurePendingBackupRetry(config=null){
    clearProviderScheduledJob('convergence');providerConvergenceJobs.clear();
    if(config===null){pendingRetryHooks=null;return true;}
    if(!config||typeof config!=='object'||typeof config.read!=='function'||typeof config.mark!=='function'||typeof config.clear!=='function')throw new TypeError('Managed provider pending-backup hooks are invalid.');
    pendingRetryHooks=Object.freeze({read:config.read,mark:config.mark,clear:config.clear});for(const selected of providers.values())wakeProviderBackground(selected,'configured');return true;
  }
  function configureRepositoryMaintenance(config=null){
    clearProviderScheduledJob('maintenance');
    if(config===null){maintenanceHooks=null;providerMaintenanceIntents.clear();providerMaintenanceSchedulers.clear();return true;}
    if(!config||typeof config!=='object'||typeof config.read!=='function'||typeof config.mark!=='function'||typeof config.clear!=='function')throw new TypeError('Repository-maintenance hooks are invalid.');
    maintenanceHooks=Object.freeze({read:config.read,mark:config.mark,clear:config.clear});providerMaintenanceIntents.clear();providerMaintenanceSchedulers.clear();for(const selected of providers.values())wakeProviderBackground(selected,'configured');return true;
  }
  async function maintenanceState(selected,{throwOnError=false}={}){const intent=providerMaintenanceIntent(selected);return intent?intent.read({throwOnError}):null;}
  const maintenanceActionable=(state,now=Date.now())=>Background.maintenanceActionable(state,now);
  async function observeRepositoryMaintenance(selected,observation){
    const scheduler=providerMaintenanceScheduler(selected);if(!scheduler)return false;const decision=await scheduler.observe(observation,{delay:MAINTENANCE_POLICY.continuationMs});return decision.needed||!!decision.pending||decision.retryObservation===true;
  }
  function providerBackgroundAbort(code,message){const error=new Error(message);error.name='AbortError';error.code=code;return error;}
  async function preemptProviderBackground(selected){
    if(!selected||!selected.repository)return false;
    return providerBackground(selected).preemptBackground();
  }

  function suspendBackground(reason='pwa-update'){
    const held=[...providers.values()].filter(selected=>selected.repository).map(selected=>{
      const coordinator=providerBackground(selected);return {coordinator,suspension:coordinator.suspend(reason)};
    });
    let released=false;
    return freeze({settled:Promise.all(held.map(row=>row.suspension.settled)),release:()=>{
      if(released)return false;released=true;
      for(const row of held)row.coordinator.resume(row.suspension);return true;
    }});
  }

  function providerMaintenanceScheduler(selected){
    if(!selected||!selected.repository||!maintenanceHooks)return null;const id=safeId(selected.id);if(!id)return null;selected=registeredProvider(selected);
    let scheduler=providerMaintenanceSchedulers.get(id);if(scheduler)return scheduler;
    const background=providerBackground(selected),intent=providerMaintenanceIntent(selected);let traceId='';
    scheduler=background.createMaintenanceScheduler(freeze({
      intent,budgetMs:0,budgetCode:'REPOSITORY_MAINTENANCE_BUDGET',budgetMessage:'Repository cleanup completed a protected work unit and will continue shortly.',preemptCode:'REPOSITORY_BACKGROUND_PREEMPTED',preemptMessage:'Repository maintenance yielded to a higher-priority Drive operation.',
      capture:(phase,error)=>AppDiagnostics.capture('backup-provider.repository-maintenance-'+phase,error,'warn'),
      isAvailable:()=>providerBackgroundAvailability(selected),
      isBusy:()=>busy||preparing,
      execute:({signal,workBudget})=>cleanupRepositoryProviderSafely(selected,{signal,workBudget,traceId}),
      report:event=>{
        const phase=String(event&&event.phase||'');
        if(phase==='running'){
          traceId=OperationDiagnostics.start('provider-maintenance',selected.label,{provider:selected.id,background:true,trigger:String(event.reason||'scheduled'),requestedAt:String(event.requestedAt||''),nextEligibleAt:String(event.nextEligibleAt||''),actionable:true});
          if(event.transition)OperationDiagnostics.mark('background-transition',event.transition,traceId);OperationDiagnostics.mark('maintenance-eligibility',{provider:selected.id,reason:String(event.reason||'scheduled'),requestedAt:String(event.requestedAt||''),nextEligibleAt:String(event.nextEligibleAt||''),actionable:true},traceId);return;
        }
        if(phase==='cleanup-start'){OperationDiagnostics.mark('maintenance-cleanup-start',{provider:selected.id},traceId);return;}
        if(phase==='cleanup-complete'){
          OperationDiagnostics.mark('maintenance-cleanup-complete',{provider:selected.id,...background.maintenanceDetails(event)},traceId);return;
        }
        if(['pending','completed','yielded','failed'].includes(phase)){
          if(event.transition)OperationDiagnostics.mark('background-transition',event.transition,traceId);
          if(phase==='failed'&&event.error)OperationDiagnostics.fail(event.error,{background:true,reason:String(event.reason||'error'),nextEligibleAt:String(event.nextEligibleAt||'')},traceId);
          else OperationDiagnostics.finish(background.maintenanceDetails(event),traceId);
          traceId='';
        }
      }
    }));providerMaintenanceSchedulers.set(id,scheduler);return scheduler;
  }
  function providerIntegrityScheduler(selected){
    if(!selected||!selected.repository||!integrityScrubHooks)return null;const id=safeId(selected.id);if(!id)return null;selected=registeredProvider(selected);
    let scheduler=providerIntegritySchedulers.get(id);if(scheduler)return scheduler;const background=providerBackground(selected);
    scheduler=background.createIntegrityScheduler(freeze({
      budgetMs:background.integrity.workBudgetMs,budgetCode:'REPOSITORY_INTEGRITY_BUDGET',budgetMessage:'Drive integrity verification reached its work limit and will continue on a later authorized operation.',
      preemptCode:'REPOSITORY_BACKGROUND_PREEMPTED',preemptMessage:'Drive integrity verification yielded to a higher-priority operation.',
      capture:error=>AppDiagnostics.capture('backup-provider.repository-integrity-background',error,'warn'),
      readTarget:()=>integrityScrubHooks.readTarget(id),
      writeResult:result=>integrityScrubHooks.writeResult(id,result),
      isAvailable:()=>{const local=integrityScrubHooks.isAvailable(id);return local===true?providerBackgroundAvailability(selected):String(local||'awaiting-control');},
      isUnsafe:()=>busy||preparing||integrityScrubHooks.isUnsafe(id)===true,
      yieldTask:()=>integrityScrubHooks.yieldTask(),
      execute:async({target,trigger,nextEligibleAt,signal,checkpoint})=>{
        const prepared=await integrityScrubHooks.prepare(id,target,freeze({trigger,nextEligibleAt}));if(!prepared)return freeze({status:'skipped',reason:'unavailable'});const options=freeze({...prepared,signal,onProgress:async progress=>{await prepared.onProgress?.(progress);checkpoint(progress);}});
        const traceId=OperationDiagnostics.start('provider-integrity',selected.label,{provider:id,background:true,trigger:String(trigger||'awaiting-connection'),nextEligibleAt:String(nextEligibleAt||''),cursor:String(options.cursor||''),actionable:true});
        OperationDiagnostics.mark('background-transition',background.transition('integrity','scheduled','running',{reason:String(trigger||'awaiting-connection'),nextEligibleAt:String(nextEligibleAt||''),actionable:true}),traceId);
        try{const result=await runConfiguredIntegrityScrub(selected,options),to=background.outcome(result);OperationDiagnostics.mark('background-transition',background.transition('integrity','running',to,{reason:background.integrityDetails(result).reason,actionable:false}),traceId);OperationDiagnostics.finish(background.integrityDetails(result),traceId);return result;}
        catch(error){OperationDiagnostics.mark('background-transition',background.transition('integrity','running','failed',{reason:'error',actionable:false}),traceId);OperationDiagnostics.fail(error,{background:true},traceId);throw error;}
      }
    }));providerIntegritySchedulers.set(id,scheduler);return scheduler;
  }
  function scheduleProviderIntegrityScrub(selected,delay=1500){const scheduler=providerIntegrityScheduler(selected);return scheduler?scheduler.schedule(Math.max(1000,Number(delay)||1500),'authorized-drive-opportunity'):false;}
  async function runConfiguredIntegrityScrub(selected,preparedOptions){
    if(!integrityScrubHooks||!selected?.repository||!preparedOptions)return null;let result;
    try{result=Object.freeze({status:'completed',...(await scrubRepositoryProvider(selected.id,preparedOptions))});}
    catch(error){
      const yielded=error?.name==='AbortError',budgeted=String(error?.code||'')==='REPOSITORY_INTEGRITY_BUDGET',locked=error?.code==='BACKUP_LOCKED';
      const corrupt=['REPOSITORY_INTEGRITY_CORRUPT','REPOSITORY_OBJECT_MISSING'].includes(error?.code);
      const objectId=/^obj_[a-f0-9]{32}$/u.test(String(error?.repositoryObjectId||''))?String(error.repositoryObjectId):'';
      const progress=error.repositoryScrubProgress||{},prior=progress.quarantined||preparedOptions.skipObjectIds||[];
      result=freeze({...progress,status:yielded?'yielded':corrupt?'failed':'unavailable',reason:yielded?(budgeted?'budget':'preempted'):locked?'locked':String(error?.message||error),
        objectId,objectKind:String(error?.repositoryObjectKind||''),corruption:corrupt,quarantined:repositoryProviderObjectIds([...prior,...(corrupt&&objectId?[objectId]:[])]),
        repaired:error?.repositoryRepaired===true,repairCheckpointId:String(error?.repositoryRepairCheckpointId||''),repairError:String(error?.repositoryRepairError||'')});
      if(!yielded)AppDiagnostics.capture('backup-provider.repository-integrity',error,'warn');
    }
    result=freeze({...result,repositoryScope:String(preparedOptions.repositoryScope||''),requestId:String(preparedOptions.requestId||'')});
    return result;
  }
  async function backupRepositoryProvider(id,options={}){
    const selected=providers.get(safeId(id));if(!selected||!selected.repository)throw new Error('Repository backup provider is unavailable.');
    const {scheduleMaintenance:_scheduleMaintenance,...saveOptions}=options&&typeof options==='object'?options:{};
    if(saveOptions.retention?.role!=='before-restore'&&providerPublications.get(selected.id)?.continuation.status().pending)await markPendingRetry(selected);
    let pending=null,pendingRead=true;try{pending=await pendingRetryState(selected);}catch{pendingRead=false;}
    const saved=await saveRepositoryProvider(selected,{...saveOptions,pendingIntent:pending});presentation.condition(selected.id,'permission','');if(pendingRead&&publicationCoversPending(saved,pending))await clearPendingRetry(selected,pending);else schedulePendingProviderBackup(selected);return saved;
  }
  async function loadRepositoryProviderCandidate(id,operation,options={}){
    const selected=providers.get(safeId(id));if(!selected||!selected.repository)throw new Error('Repository backup provider is unavailable.');
    return loadRepositoryProvider(selected,operation,options);
  }
  async function historyRepositoryProvider(id,options={}){
    const selected=providers.get(safeId(id));
    if(!selected||!selected.repository)return Object.freeze({sourceId:safeId(id),sourceLabel:'',available:false,reason:'unavailable',entries:Object.freeze([])});
    if(busy)return Object.freeze({sourceId:selected.id,sourceLabel:selected.label,available:false,reason:'busy',entries:Object.freeze([])});
    const traceId=OperationDiagnostics.start('provider-history',selected.label,{provider:selected.id,interactive:options&&options.interactive!==false}),foreground=beginForeground(selected,options&&options.signal||null);
    if(!foreground){OperationDiagnostics.finish({status:'skipped',reason:'busy'},traceId);return Object.freeze({sourceId:selected.id,sourceLabel:selected.label,available:false,reason:'busy',entries:Object.freeze([])});}
    beginForegroundView(selected,'history',`Reading backup versions from ${selected.label}…`,options.presentation);busy=true;setBusy(true);
    try{
      OperationDiagnostics.mark('provider-background-preemption-start',{provider:selected.id},traceId);await foreground.settled;OperationDiagnostics.mark('provider-background-preemption-complete',{provider:selected.id},traceId);
      if(selected.prepare){OperationDiagnostics.mark('provider-prepare-start',{provider:selected.id},traceId);await selected.prepare();OperationDiagnostics.mark('provider-prepare-complete',{provider:selected.id},traceId);}
      if(options&&options.interactive!==false){OperationDiagnostics.mark('provider-authorization-start',{provider:selected.id},traceId);await authorize(selected,'history');OperationDiagnostics.mark('provider-authorization-complete',{provider:selected.id},traceId);}
      OperationDiagnostics.mark('recovery-history-scan-start',{provider:selected.id},traceId);
      const scoped=repositoryOperationSelected(selected,{signal:foreground.signal}),inventory=await repositoryProviderInventory(scoped,{signal:foreground.signal});
      await observeRepositoryMaintenance(selected,repositoryInventoryObservation(inventory));
      if(inventory.overflow)throw new Error('Backup history could not be read completely. Version History was stopped safely.');
      const quarantinedObjectIds=integrityScrubHooks?await integrityScrubHooks.quarantine(selected.id):[],entries=repositoryInventoryHistoryEntries(scoped,inventory,{quarantinedObjectIds});
      rememberRecentHistory(selected,inventory);
      OperationDiagnostics.mark('recovery-history-scan-complete',{provider:selected.id,versions:entries.length},traceId);
      OperationDiagnostics.finish({versions:entries.length},traceId);finishForegroundView(selected,{message:`${entries.length} backup${entries.length===1?'':'s'} available.`,ok:true});return Object.freeze({sourceId:selected.id,sourceLabel:selected.label,available:true,reason:'',entries});
    }catch(error){
      const cancelled=error?.name==='AbortError'||['PROVIDER_FOREGROUND_CANCELLED','STUDY_DIRECTOR_IMPORT_CANCELLED'].includes(String(error?.code||''));
      if(cancelled){OperationDiagnostics.finish({cancelled:true,reason:'cancelled'},traceId);finishForegroundView(selected,{message:'Backup history request cancelled.',ok:true,lifecycle:'cancelled'});return Object.freeze({sourceId:selected.id,sourceLabel:selected.label,available:false,reason:'cancelled',cancelled:true,entries:Object.freeze([])});}
      OperationDiagnostics.fail(error,{},traceId);finishForegroundView(selected,{message:'Could not read backup versions safely.',ok:false});AppDiagnostics.capture('backup-provider.version-history',error,'warn');
      return Object.freeze({sourceId:selected.id,sourceLabel:selected.label,available:false,reason:String(error&&error.message||error),entries:Object.freeze([])});
    }finally{
      if(foregroundView()&&foregroundView().providerId===selected.id)finishForegroundView(selected);await release(selected,'history');busy=false;setBusy(false);foreground.release();detachFinishedSelection(selected);
    }
  }

  async function backupProvider(id=''){
    if(busy){statusText('Another backup operation is still in progress…');return false;}
    const selected=id?providers.get(safeId(id)):provider();
    if(!selected)return false;
    const traceId=OperationDiagnostics.start('provider-backup',selected.label,{provider:selected.id}),foreground=beginForeground(selected);
    if(!foreground){OperationDiagnostics.finish({status:'skipped',reason:'busy'},traceId);return false;}
    beginForegroundView(selected,'backup',`Connecting to ${selected.label}…`);setBusy(true);providerProgress(selected,'authorize',`Connecting to ${selected.label}…`);
    try{
      OperationDiagnostics.mark('provider-background-preemption-start',{provider:selected.id},traceId);await foreground.settled;OperationDiagnostics.mark('provider-background-preemption-complete',{provider:selected.id},traceId);
      OperationDiagnostics.mark('provider-authorization-start',{provider:selected.id},traceId);await authorize(selected,'export');OperationDiagnostics.mark('provider-authorization-complete',{provider:selected.id},traceId);
      statusText(`Backing up to ${selected.label}…`);
      const result=await backupRepositoryProvider(selected.id,{signal:foreground.signal,foregroundPriority:true}),followUp=result&&result.warning?' '+result.warning:'';
      statusText(`✓ External backup verified in ${selected.label}.${followUp}`);finishForegroundView(selected,{message:`✓ External backup verified in ${selected.label}.${followUp}`,ok:true});
      OperationDiagnostics.finish({objectsWritten:Number(result&&result.objectsWritten)||0,objectsReused:Number(result&&result.objectsReused)||0,writtenBytes:Number(result&&result.writtenBytes)||0},traceId);return true;
    }catch(error){
      const cancelled=error?.name==='AbortError'||['PROVIDER_FOREGROUND_CANCELLED','STUDY_DIRECTOR_IMPORT_CANCELLED'].includes(String(error?.code||'')),message=userProviderMessage(error,'The backup could not be completed safely.');
      if(cancelled){OperationDiagnostics.finish({cancelled:true},traceId);statusText('Backup cancelled safely.',true);finishForegroundView(selected,{message:'Backup cancelled safely.',ok:true,lifecycle:'cancelled'});return false;}
      OperationDiagnostics.fail(error,{},traceId);statusText(`Backup failed: ${message}`,false);finishForegroundView(selected,{message:`Backup failed: ${message}`,ok:false});
      return false;
    }finally{if(foregroundView()&&foregroundView().providerId===selected.id)finishForegroundView(selected);await release(selected,'export');setBusy(false);foreground.release();detachFinishedSelection(selected);}
  }
  async function bringInRepositoryProvider(id,options={}){
    if(busy)return freeze({cancelled:true,reason:'busy'});
    const selected=providers.get(safeId(id));
    if(!selected||!selected.repository)throw new Error('Backup location is unavailable.');
    const traceId=OperationDiagnostics.start('provider-combine',selected.label,{provider:selected.id}),foreground=beginForeground(selected,options&&options.signal||null);
    if(!foreground){OperationDiagnostics.finish({status:'skipped',reason:'busy'},traceId);return freeze({cancelled:true,reason:'busy'});}
    const operation=BackupController.beginImport(),cancelImport=()=>operation.cancel?.('Backup recovery was cancelled by the user.');
    if(foreground.signal.aborted)cancelImport();else foreground.signal.addEventListener('abort',cancelImport,{once:true});
    beginForegroundView(selected,'bring-in',`Connecting to ${selected.label}…`,options.presentation);setBusy(true);providerProgress(selected,'authorize',`Connecting to ${selected.label}…`);
    try{
      OperationDiagnostics.mark('provider-background-preemption-start',{provider:selected.id},traceId);await foreground.settled;OperationDiagnostics.mark('provider-background-preemption-complete',{provider:selected.id},traceId);
      if(selected.prepare){OperationDiagnostics.mark('provider-prepare-start',{provider:selected.id},traceId);await selected.prepare();OperationDiagnostics.mark('provider-prepare-complete',{provider:selected.id},traceId);}
      OperationDiagnostics.mark('provider-authorization-start',{provider:selected.id},traceId);await authorize(selected,'import');OperationDiagnostics.mark('provider-authorization-complete',{provider:selected.id},traceId);
      statusText(`Choose a backup from ${selected.label}…`);
      const candidate=await loadRepositoryProviderCandidate(selected.id,operation,{checkpointId:String(options&&options.checkpointId||''),mode:'bring-in',onProgress:typeof options?.onProgress==='function'?options.onProgress:null});if(!candidate){statusText('Combine cancelled.');finishForegroundView(selected,{message:'Combine cancelled.',lifecycle:'cancelled'});OperationDiagnostics.finish({cancelled:true},traceId);return freeze({cancelled:true});}
      const result=await RepositoryCheckpointPipeline.bringIn(candidate,{note:typeof options?.note==='string'?options.note:''});
      if(result&&result.cancelled){const message=String(result.reason||'').startsWith('note-')?'No changes were made.':'Combine cancelled.';statusText(message);finishForegroundView(selected,{message,lifecycle:'cancelled'});OperationDiagnostics.finish({cancelled:true},traceId);return freeze({...result,cancelled:true});}
      const convergence=result&&result.managedRecovery&&result.managedRecovery.present||freeze({status:'pending',source:freeze({status:'failed',reason:'post-operation backup status unavailable'}),device:freeze({status:'skipped',reason:'unavailable'})});
      const sourceReady=convergence.source&&(convergence.source.status==='completed'||convergence.source.status==='pending'&&convergence.source.retryQueued===true),deviceReady=['completed','skipped'].includes(String(convergence.device&&convergence.device.status||''))||convergence.device&&convergence.device.status==='pending'&&convergence.device.queued===true;
      const finalMessage=presentation.outcome('bring-in',selected.label,convergence);statusText(finalMessage,sourceReady&&deviceReady);finishForegroundView(selected,{message:finalMessage,ok:true});

      OperationDiagnostics.finish({cancelled:false},traceId);return freeze({...result,convergence});
    }catch(error){
      const committed=error&&error.studyDirectorCommittedDescription?` ${error.studyDirectorCommittedDescription}; completed changes were not rolled back.`:'';
      const rolledBack=error&&error.studyDirectorRollbackDescription?` ${error.studyDirectorRollbackDescription}`:'';
      const message=userProviderMessage(error,'The selected backup could not be verified safely.'),cancelled=error&&error.code==='STUDY_DIRECTOR_IMPORT_CANCELLED';
      const finalMessage=`${cancelled?'Combine cancelled':'Combine failed'}: ${message}${committed}${rolledBack}`;statusText(finalMessage,!cancelled?false:true);finishForegroundView(selected,{message:finalMessage,ok:cancelled,lifecycle:cancelled?'cancelled':'failed'});

      if(cancelled){OperationDiagnostics.finish({cancelled:true},traceId);return freeze({cancelled:true,reason:'cancelled'});}
      OperationDiagnostics.fail(error,{},traceId);throw error;
    }finally{if(foregroundView()&&foregroundView().providerId===selected.id)finishForegroundView(selected);foreground.signal.removeEventListener('abort',cancelImport);BackupController.finishImport(operation);await release(selected,'import');setBusy(false);foreground.release();detachFinishedSelection(selected);}
  }
  async function restoreRepositoryProviderVersion(id,options={}){
    if(busy)return Object.freeze({cancelled:true,reason:'busy'});
    const selected=providers.get(safeId(id));if(!selected||!selected.repository)throw new Error('Repository backup provider is unavailable.');
    const traceId=OperationDiagnostics.start('provider-restore',selected.label,{provider:selected.id}),foreground=beginForeground(selected,options&&options.signal||null);
    if(!foreground){OperationDiagnostics.finish({status:'skipped',reason:'busy'},traceId);return freeze({cancelled:true,reason:'busy'});}
    const operation=BackupController.beginImport(),cancelImport=()=>operation.cancel?.('Backup recovery was cancelled by the user.');
    if(foreground.signal.aborted)cancelImport();else foreground.signal.addEventListener('abort',cancelImport,{once:true});
    beginForegroundView(selected,'restore-version',`Connecting to ${selected.label}…`,options.presentation);setBusy(true);providerProgress(selected,'authorize',`Connecting to ${selected.label}…`);
    try{
      OperationDiagnostics.mark('provider-background-preemption-start',{provider:selected.id},traceId);await foreground.settled;OperationDiagnostics.mark('provider-background-preemption-complete',{provider:selected.id},traceId);
      OperationDiagnostics.mark('provider-authorization-start',{provider:selected.id},traceId);await authorize(selected,'import');OperationDiagnostics.mark('provider-authorization-complete',{provider:selected.id},traceId);
      statusText(`Choose a version from ${selected.label}…`);
      const candidate=await loadRepositoryProvider(selected,operation,{checkpointId:String(options&&options.checkpointId||''),mode:'restore-version',onProgress:typeof options?.onProgress==='function'?options.onProgress:null});
      if(!candidate){statusText('Version restore cancelled.');finishForegroundView(selected,{message:'Version restore cancelled.',lifecycle:'cancelled'});OperationDiagnostics.finish({cancelled:true},traceId);return Object.freeze({cancelled:true});}
      const result=await RepositoryCheckpointPipeline.restoreVersion(candidate,{confirmed:options&&options.confirmed===true});
      if(result&&result.cancelled){statusText('Version restore cancelled.');finishForegroundView(selected,{message:'Version restore cancelled.',lifecycle:'cancelled'});OperationDiagnostics.finish({cancelled:true},traceId);return result;}
      const convergence=result&&result.managedRecovery&&result.managedRecovery.present||freeze({status:'pending',source:freeze({status:'failed',reason:'post-operation backup status unavailable'}),device:freeze({status:'skipped',reason:'unavailable'})});
      const sourceReady=convergence.source&&convergence.source.status==='completed',deviceReady=['completed','skipped'].includes(String(convergence.device&&convergence.device.status||''))||convergence.device&&convergence.device.status==='pending'&&convergence.device.queued===true;
      const finalMessage=presentation.outcome('restore-version',selected.label,convergence);statusText(finalMessage,sourceReady&&deviceReady);finishForegroundView(selected,{message:finalMessage,ok:true});

      OperationDiagnostics.finish({cancelled:false},traceId);return Object.freeze({...result,convergence});
    }catch(error){
      const committed=error&&error.studyDirectorCommittedDescription?` ${error.studyDirectorCommittedDescription}; completed changes were not rolled back.`:'';
      const rolledBack=error&&error.studyDirectorRollbackDescription?` ${error.studyDirectorRollbackDescription}`:'';
      const message=userProviderMessage(error,'The selected backup could not be verified safely.'),cancelled=error&&error.code==='STUDY_DIRECTOR_IMPORT_CANCELLED';
      const finalMessage=`${cancelled?'Version restore cancelled':'Version restore failed'}: ${message}${committed}${rolledBack}`;statusText(finalMessage,cancelled);finishForegroundView(selected,{message:finalMessage,ok:cancelled,lifecycle:cancelled?'cancelled':'failed'});

      if(cancelled){OperationDiagnostics.finish({cancelled:true},traceId);return Object.freeze({cancelled:true,reason:'cancelled'});}
      OperationDiagnostics.fail(error,{},traceId);
      throw error;
    }finally{if(foregroundView()&&foregroundView().providerId===selected.id)finishForegroundView(selected);foreground.signal.removeEventListener('abort',cancelImport);BackupController.finishImport(operation);await release(selected,'import');setBusy(false);foreground.release();detachFinishedSelection(selected);}
  }
  async function connectCurrent(){
    if(busy)return false;
    const selected=provider();if(!selected)return false;
    const foreground=beginForeground(selected);if(!foreground)return false;
    let connectedNow=false;
    setBusy(true);statusText(`Connecting ${selected.label}…`);
    try{
      await foreground.settled;if(selected.prepare)await selected.prepare();await authorize(selected,'connect');
      connectedNow=true;statusText(`✓ ${selected.label} connected for this tab.`);return true;
    }catch(error){statusText(`Connection failed: ${userProviderMessage(error,`${selected.label} could not be connected.`)}`,false);return false;}
    finally{
      await release(selected,'connect');setBusy(false);foreground.release();renderButtons();
      const {overlay}=elements();
      if(connectedNow){if(overlay?.classList.contains('on')&&activeId===selected.id)close({restoreFocus:false});}
      else if(overlay?.classList.contains('on')&&activeId===selected.id)presentProvider(selected,activeTrigger);
    }
  }
  async function disconnectCurrent(){
    if(busy)return;
    const selected=provider();
    if(!selected||!selected.disconnect)return;
    const foreground=beginForeground(selected);if(!foreground)return;
    setBusy(true);statusText(`Disconnecting ${selected.label}…`);
    try{
      await foreground.settled;await authorize(selected,'disconnect');
      await selected.disconnect();await discardProviderPublication(selected);connectedOnceByProvider.delete(selected.id);clearRecentHistory(selected);verifiedHistoryByProvider.delete(selected.id);repositoryScopeByProvider.delete(selected.id);await clearPendingRetry(selected);providerBackground(selected).clearAllScheduled();presentation.reset(selected.id);
      statusText(`✓ ${selected.label} disconnected. Access permission was revoked.`);
    }catch(error){
      const message=error&&error.message?error.message:String(error);
      statusText(`Disconnect failed: ${message}`,false);
    }finally{await release(selected,'disconnect');setBusy(false);foreground.release();const {overlay}=elements();if(overlay?.classList.contains('on')&&activeId===selected.id)presentProvider(selected,activeTrigger);renderButtons();}
  }
  function renderButtons(){
    const {host}=elements();
    if(!host)return;
    const fragment=document.createDocumentFragment();
    [...providers.values()].forEach(item=>{
      const external=presentation.read(item.id,'external-backup'),operation=foregroundView();
      const connected=providerConnected(item),wasConnected=connectedOnceByProvider.has(item.id),rowStatus=document.getElementById(`backup-provider-row-status-${item.id}`),active=busy&&operation?.providerId===item.id,working=active?operation:external?.lifecycle==='running'?external:null;if(connected)connectedOnceByProvider.add(item.id);presentation.condition(item.id,'permission',!connected&&wasConnected?'Google Drive authorization expired. Reconnect to resume external backups.':'');
      if(rowStatus){rowStatus.textContent=presentation.locationLabel(item.id,{connected,wasConnected,busy:!!working,foregroundKind:working?.kind});rowStatus.classList.toggle('protected',connected&&!working);rowStatus.classList.toggle('standard',!connected||!!working);}
      const backup=document.createElement('button');backup.className='mini-btn ui-btn';backup.type='button';backup.textContent='Back up now';backup.disabled=busy;backup.setAttribute('aria-label',`Back up now to ${item.label}`);backup.addEventListener('click',()=>void backupProvider(item.id));
      const versions=document.createElement('button');versions.className='mini-btn ui-btn';versions.type='button';versions.textContent=connected?'Versions':'Recover';versions.disabled=busy&&!(active&&['history','bring-in','restore-version'].includes(foregroundView().kind));versions.dataset.action='recover-provider-backup';versions.dataset.providerId=item.id;versions.setAttribute('aria-label',connected?`View ${item.label} backup versions`:`Recover from ${item.label}`);versions.setAttribute('aria-haspopup','dialog');versions.setAttribute('aria-controls','managed-version-history');
      const settings=document.createElement('button');settings.className='mini-btn ui-btn';settings.type='button';settings.textContent=connected?'Settings':wasConnected?'Reconnect':'Connect';settings.disabled=busy&&!active;settings.dataset.backupProvider=item.id;settings.setAttribute('aria-label',connected?`${item.label} settings`:`${wasConnected?'Reconnect':'Connect'} ${item.label}`);settings.setAttribute('aria-haspopup','dialog');settings.setAttribute('aria-controls','backup-provider-overlay');settings.addEventListener('click',()=>open(item.id,settings));
      if(connected)fragment.append(backup,versions,settings);else if(wasConnected)fragment.append(settings);else fragment.append(settings,versions);
    });
    host.replaceChildren(fragment);
  }
  function register(config={}){
    const normalized=freezeProvider(config&&typeof config==='object'?config:{});
    if(!normalized.id||!normalized.label||!normalized.repository)return false;
    if(providers.has(normalized.id))return false;
    providers.set(normalized.id,normalized);
    if(normalized.subscribeConnection)normalized.subscribeConnection(()=>{wakeProviderBackground(normalized,'connection');renderButtons();const {overlay}=elements();if(!busy&&!preparing&&overlay?.classList.contains('on')&&activeId===normalized.id)presentProvider(normalized,activeTrigger);});
    wakeProviderBackground(normalized,'registered');
    renderButtons();
    return true;
  }
  function list(){return Object.freeze([...providers.values()].map(item=>Object.freeze({id:item.id,label:item.label,connected:providerConnected(item)})));}
  function backgroundStatus(){return freeze([...providerBackgroundCoordinators.entries()].flatMap(([id,coordinator])=>[freeze({job:id+' maintenance',...(providerMaintenanceSchedulers.get(id)?.status()||coordinator.jobStatus('maintenance'))}),freeze({job:id+' integrity',...(providerIntegritySchedulers.get(id)?.status()||coordinator.jobStatus('integrity'))}),freeze({job:id+' convergence',...coordinator.jobStatus('convergence')})]));}
  function diagnosticConnections(){return freeze([...providers.values()].map(selected=>freeze({id:selected.id,connected:providerConnected(selected),scopeBound:repositoryScopeByProvider.has(selected.id),retryAttempt:providerConvergenceRetryAttempts.get(selected.id)||0,retryBackoffCapped:(providerConvergenceRetryAttempts.get(selected.id)||0)>=PROVIDER_CONVERGENCE_RETRY_DELAYS.length})));}
  function status(){const overlay=elements().overlay;return Object.freeze({busy:busy||preparing,cancellable:!!foregroundController&&!foregroundController.signal.aborted,preparing,activeId,open:!!overlay?.classList.contains('on'),operation:foregroundView()?Object.freeze({...foregroundView()}):null});}
  function install(){
    const {overlay,exportButton,closeButton,disconnectButton,cancelButton}=elements();
    if(!overlay||overlay.dataset.bound==='1')return;
    overlay.dataset.bound='1';
    exportButton?.addEventListener('click',connectCurrent);
    disconnectButton?.addEventListener('click',disconnectCurrent);
    cancelButton?.addEventListener('click',()=>cancelForeground());
    closeButton?.addEventListener('click',()=>close());
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&overlay.classList.contains('on')){event.preventDefault();close();}});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)renderButtons();});
    document.addEventListener('pointerdown',event=>{
      if(!overlay.classList.contains('on')||overlay.contains(event.target)||event.target.closest?.('[data-backup-provider]'))return;
      close({restoreFocus:false});
    });
  }
  install();
  return Object.freeze({register,list,open,close,status,backgroundStatus,diagnosticConnections,connected:id=>providerConnected(providers.get(safeId(id))),refresh:renderButtons,wakeBackground:trigger=>{for(const selected of providers.values())wakeProviderBackground(selected,trigger);},subscribePresentation,cancelForeground,history:historyRepositoryProvider,backup:backupProvider,backupRepositoryProvider,bringInRepositoryProvider,loadRepositoryProviderCandidate,restoreRepositoryProviderVersion,removeProtectedRepositoryProvider,scrubRepositoryProvider,requestIntegrity:id=>scheduleProviderIntegrityScrub(providers.get(safeId(id)),1000),configureIntegrityScrub,configureConvergencePropagation,configureManagedRecovery,configurePendingBackupRetry,configureRepositoryMaintenance,suspendBackground,repositoryScope});

  }
  return freeze({format:'study-director.backup-provider-module',contractVersion:1,createRuntime});
});
})();
