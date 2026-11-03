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
    exports:freeze(['followProtection','protect','run','unprotect']),
    domain:freeze(['clampText']),
    view:freeze(['presentation']),
    ownership:freeze(['canRunBackground','canShare','requireMutationControl']),
    environment:freeze(['clearTimeout','setTimeout']),
    diagnostics:freeze(['capture','fail','finish','mark','start'])
  });
  const REPOSITORY_FIELDS=freeze(['createPublication','publish','publishInline','inspectManifest','inspect','bringIn','restoreVersion','verifyCheckpoint','verifyObject','scrub','cleanup','inspectCommit','retention','validatePolicy','classifyState','activeProtected','selectRetention','projectHistory','noteObject','readNote','markCompleted','sharedBase','establishBase']);
  function createRuntime(input){
    exactObject(input,['background','ports','repository'],'Backup provider input');
    const Background=exactObject(input.background,['contractVersion','createCoordinator','format','maintenance','maintenanceActionable'],'Backup provider repository-background dependency');
    requireFunctions(Background,['createCoordinator','maintenanceActionable'],'Backup provider background port');
    if(Background.format!=='study-director.repository-background-module'||Background.contractVersion!==1)throw new TypeError('Backup provider repository-background dependency is invalid.');
    const ports=exactObject(input.ports,Object.keys(PORT_FIELDS),'Backup provider ports');
    for(const [name,fields] of Object.entries(PORT_FIELDS))exactObject(ports[name],fields,'Backup provider '+name+' port');
    for(const name of ['controller','exports','domain','ownership','environment','diagnostics'])requireFunctions(ports[name],PORT_FIELDS[name],'Backup provider '+name+' port');
    const RepositoryCheckpointPipeline=exactObject(input.repository,REPOSITORY_FIELDS,'Backup provider repository pipeline');
    requireFunctions(RepositoryCheckpointPipeline,REPOSITORY_FIELDS.filter(key=>key!=='retention'),'Backup provider repository pipeline');
    if(!RepositoryCheckpointPipeline.retention||!Object.isFrozen(RepositoryCheckpointPipeline.retention))throw new TypeError('Backup provider retention policy is invalid.');
    if(!Object.isFrozen(ports.view.presentation)||['begin','read','feedback','condition','notice','detail','outcome','locationLabel','resolve','reset','subscribe'].some(key=>typeof ports.view.presentation[key]!=='function'))throw new TypeError('Backup presentation port is invalid.');
    const APP_VERSION=ports.configuration.appVersion,BackupController=ports.controller,Exports=ports.exports,clampText=ports.domain.clampText,requireBackupMutationControl=ports.ownership.requireMutationControl;
    const {clearTimeout,setTimeout}=ports.environment;
    const AppDiagnostics=freeze({capture:ports.diagnostics.capture});
    const OperationDiagnostics=freeze({start:ports.diagnostics.start,mark:ports.diagnostics.mark,finish:ports.diagnostics.finish,fail:ports.diagnostics.fail});
  const providers=new Map();
  const VERIFIED_HISTORY_INDEX_LIMIT=64;
  const VERIFIED_HISTORY_READ_CONCURRENCY=8;
  const RECENT_HISTORY_TTL_MS=30*1000;
  const VERIFIED_HISTORY_INTERPRETATION_VERSION='managed-history-v1:'+APP_VERSION;
  const {publicationMaxAgeMs:PUBLICATION_MAX_AGE_MS,publicationRenewMs:PUBLICATION_RENEW_MS,publicationStaleMs:PUBLICATION_STALE_MS,maintenanceWorkBudgetMs:PROVIDER_MAINTENANCE_BUDGET_MS,maintenanceMaxAgeMs:MAINTENANCE_MAX_AGE_MS,objectGcGraceMs:OBJECT_GC_GRACE_MS,automaticQuietMs:AUTOMATIC_QUIET_MS,automaticUrgentMs:AUTOMATIC_URGENT_MS,automaticExpiryLeadMs:AUTOMATIC_EXPIRY_LEAD_MS}=RepositoryPolicy.protocol;
  const PROVIDER_RECOVERY_MAINTENANCE_POLL_MS=500,PROVIDER_RECOVERY_MAINTENANCE_YIELD_MS=MAINTENANCE_MAX_AGE_MS+PROVIDER_RECOVERY_MAINTENANCE_POLL_MS;
  const SESSION_CLAIM_FORMAT='study-director.active-session-claim',SESSION_CLAIM_VERSION=2,SESSION_CLAIM_MAX_BYTES=4096,SESSION_OWNER_PATTERN=/^inst_[a-z0-9_]{8,128}$/iu,SESSION_CLAIM_TOKEN_PATTERN=/^[a-f0-9]{64}$/u;
  const MAINTENANCE_MIN_CHECKPOINT_DELETES=16,MAINTENANCE_MAX_CHECKPOINT_DELETES=128,MAINTENANCE_MAX_OBJECT_DELETES=48,PROVIDER_CONVERGENCE_BUSY_RETRY_MS=15*1000,PROVIDER_CONVERGENCE_RETRY_DELAYS=freeze([30*1000,2*60*1000,10*60*1000,30*60*1000]);
  const MAINTENANCE_POLICY=Background.maintenance;
  // The formats of each location's kept versions, as its last cleanup left them.
  const formatsByProvider=new Map();
  // The versions each location's last complete scan could not read (by id).
  const unreadableByProvider=new Map();
  const verifiedHistoryByProvider=new Map(),recentHistoryByProvider=new Map(),repositoryScopeByProvider=new Map(),connectedOnceByProvider=new Set();
  const repositoryOperationStateBySelection=new WeakMap();
  const providerPublications=new Map();
  const providerBackgroundCoordinators=new Map(),providerMaintenanceIntents=new Map(),providerMaintenanceSchedulers=new Map(),providerIntegritySchedulers=new Map(),providerConvergenceJobs=new Map(),providerConvergenceRetryAttempts=new Map();
  function repositoryProviderObjectIds(value){const rows=Array.isArray(value)?value:[],seen=new Set(),out=[];for(const raw of rows){const id=String(raw||'');if(!/^obj_[a-f0-9]{32}$/u.test(id)||seen.has(id))continue;seen.add(id);out.push(id);}return Object.freeze(out);}
  // Connect, disconnect and Back up now report to the location they act on.
  let statusSource='';
  let busy=false;
  let foregroundController=null;
  const presentation=ports.view.presentation;
  let foregroundPresentation=null,foregroundSource='',borrowedPresentation=false;
  function presentationView(event){return event?freeze({...event,...event.progress,providerId:event.source,providerLabel:event.title,active:event.lifecycle==='running',ok:event.severity!=='error'}):null;}
  function foregroundView(){const event=foregroundPresentation?.read();return event?.lifecycle==='running'?presentationView(event):null;}
  let integrityScrubHooks=null;
  let managedRecoveryHooks=null;
  let pendingRetryHooks=null;
  let maintenanceHooks=null;
  let automaticHooks=null;
  let sessionOwnershipHooks=null;
  const safeId=value=>String(value||'').trim().toLowerCase().match(/^[a-z][a-z0-9-]{0,40}$/)?.[0]||'';
  const registeredProvider=value=>providers.get(safeId(value&&value.id||value))||value||null;
  function providerBackground(selected){
    const id=safeId(selected&&selected.id);if(!id)throw new Error('Backup provider background target is invalid.');
    let coordinator=providerBackgroundCoordinators.get(id);if(coordinator)return coordinator;
    coordinator=Background.createCoordinator(freeze({target:id,environment:freeze({AbortController:globalThis.AbortController,clearTimeout,now:()=>Date.now(),setTimeout})}));providerBackgroundCoordinators.set(id,coordinator);
    // Maintenance and integrity show as busy until their slot is released, after
    // their own last status update: draw the row again then.
    coordinator.onRelease(()=>notifyStatus());return coordinator;
  }
  function providerMaintenanceIntent(selected){
    if(!maintenanceHooks)return null;const id=safeId(selected&&selected.id);if(!id)throw new Error('Backup provider maintenance target is invalid.');selected=registeredProvider(selected);
    let intent=providerMaintenanceIntents.get(id);if(intent)return intent;const coordinator=providerBackground(selected);
    intent=coordinator.maintenanceIntent(freeze({capture:(phase,error)=>AppDiagnostics.capture('backup-provider.repository-maintenance-'+phase,error,'warn'),clear:expected=>maintenanceHooks.clear(id,expected),mark:(state,expected)=>maintenanceHooks.mark(id,freeze({...state,repositoryScope:repositoryScopeByProvider.get(id)||''}),expected),read:()=>maintenanceHooks.read(id),scope:()=>repositoryScopeByProvider.get(id)||null,selectRetention:RepositoryCheckpointPipeline.selectRetention}));providerMaintenanceIntents.set(id,intent);return intent;
  }
  const userProviderMessage=(error,fallback)=>{const code=String(error&&error.code||'');if(code==='STUDY_DIRECTOR_REPOSITORY_MAINTENANCE_BUSY'||code==='STUDY_DIRECTOR_RECOVERY_MAINTENANCE_YIELD_TIMEOUT')return 'Another Study Director device is still finishing backup maintenance. Wait a moment, then retry the restore.';if(code==='STUDY_DIRECTOR_REPOSITORY_MAINTENANCE_UNCERTAIN')return 'Backup maintenance state could not be verified safely. Retry after the other device has finished its backup work.';const raw=String(error&&error.message||error||'').trim();if(!raw)return fallback;return /\b(?:repository|checkpoint|manifest|commit marker|reconciliation)\b/iu.test(raw)?fallback:raw;};
  const providerBackgroundAvailability=selected=>{
    const local=ports.ownership.canRunBackground();if(local!==true)return String(local||'awaiting-control');
    if(selected?.shared){const share=ports.ownership.canShare();if(share!==true)return String(share||'awaiting-control');}
    if(!selected||typeof selected.backgroundAvailable!=='function')return 'awaiting-connection';
    try{return selected.backgroundAvailable()===true?true:'awaiting-connection';}
    catch(error){AppDiagnostics.capture('backup-provider.background-availability',error,'warn');return 'awaiting-connection';}
  };
  const freezeRepositoryTransport=value=>{
    if(!value||typeof value!=='object')return null;
    const required=['list','upload','download','delete'];
    if(required.some(key=>typeof value[key]!=='function'))return null;
    const publicationMethods=['beginPublication','listPublications','assertPublication','endPublication'],maintenanceMethods=['beginMaintenance','listMaintenances','assertMaintenance','endMaintenance'],sessionClaimMethods=['listSessionClaims','uploadSessionClaim','downloadSessionClaim','deleteSessionClaim'];
    const publicationCapable=publicationMethods.every(key=>typeof value[key]==='function'),maintenanceCapable=maintenanceMethods.every(key=>typeof value[key]==='function'),sessionClaimCapable=sessionClaimMethods.every(key=>typeof value[key]==='function');
    return Object.freeze({
      list:value.list,upload:value.upload,download:value.download,delete:value.delete,
      beginPublication:publicationCapable?value.beginPublication:null,listPublications:publicationCapable?value.listPublications:null,assertPublication:publicationCapable?value.assertPublication:null,renewPublication:publicationCapable&&typeof value.renewPublication==='function'?value.renewPublication:null,endPublication:publicationCapable?value.endPublication:null,
      beginMaintenance:maintenanceCapable?value.beginMaintenance:null,listMaintenances:maintenanceCapable?value.listMaintenances:null,assertMaintenance:maintenanceCapable?value.assertMaintenance:null,renewMaintenance:maintenanceCapable&&typeof value.renewMaintenance==='function'?value.renewMaintenance:null,endMaintenance:maintenanceCapable?value.endMaintenance:null,
      listSessionClaims:sessionClaimCapable?value.listSessionClaims:null,uploadSessionClaim:sessionClaimCapable?value.uploadSessionClaim:null,downloadSessionClaim:sessionClaimCapable?value.downloadSessionClaim:null,deleteSessionClaim:sessionClaimCapable?value.deleteSessionClaim:null,
      scope:typeof value.scope==='function'?value.scope:null,
      discardUploads:typeof value.discardUploads==='function'?value.discardUploads:null,
      beginOperation:typeof value.beginOperation==='function'?value.beginOperation:null,
      historyReadConcurrency:Math.max(1,Math.min(VERIFIED_HISTORY_READ_CONCURRENCY,Math.floor(Number(value.historyReadConcurrency)||1)))
    });
  };
  function repositoryOperationSelected(selected,options={}){
    if(repositoryOperationStateBySelection.has(selected))return selected;
    const begin=selected&&selected.repository&&selected.repository.beginOperation;if(typeof begin!=='function')return selected;
    const scoped=freezeRepositoryTransport(begin(Object.freeze({signal:options&&options.signal||null,checkProtection:options&&options.checkProtection||null})));
    if(!scoped)throw new Error('Backup repository transport could not begin a verified operation.');
    const operationSelected=Object.freeze({...selected,repository:scoped});
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
    recentHistoryByProvider.delete(id);verifiedHistoryByProvider.delete(id);formatsByProvider.delete(id);unreadableByProvider.delete(id);providerConvergenceRetryAttempts.delete(id);providerBackground(selected).clearAllScheduled();
    if(stalePersisted)await maintenanceHooks.clear(id,pending);
    OperationDiagnostics.mark('provider-repository-generation-reset',{provider:id,changed:true});return true;
  }
  const freezeProvider=config=>Object.freeze({
    id:safeId(config.id),
    label:clampText(config.label||'',40),
    prepare:typeof config.prepare==='function'?config.prepare:null,
    authorize:typeof config.authorize==='function'?config.authorize:null,
    backgroundAvailable:typeof config.backgroundAvailable==='function'?config.backgroundAvailable:null,
    connected:typeof config.connected==='function'?config.connected:null,
    connectionExpiresAt:typeof config.connectionExpiresAt==='function'?config.connectionExpiresAt:null,
    // automaticBaseline: the change time from which a location backs up on its
    // own (the Device Folder: from when it was chosen). Without one, a location
    // backs up on its own only after this device first backed up to it.
    automaticBaseline:typeof config.automaticBaseline==='function'?config.automaticBaseline:null,
    // Whether this location remains an automatic destination while its
    // transport is temporarily unavailable (for example revoked folder
    // permission or an expired Drive token). Explicit disconnect/forget must
    // make this false.
    automaticConfigured:typeof config.automaticConfigured==='function'?config.automaticConfigured:null,
    subscribeConnection:typeof config.subscribeConnection==='function'?config.subscribeConnection:null,
    // hosted: the location's own controller tells the person about its
    // connection (the Device Folder's permission); the engine stays quiet.
    hosted:config.hosted===true,
    // shared: the location every device syncs through (Drive). This device
    // catches up with it before backing up there.
    shared:config.shared===true,
    disconnect:typeof config.disconnect==='function'?config.disconnect:null,
    release:typeof config.release==='function'?config.release:null,
    repository:freezeRepositoryTransport(config.repository)
  });
  // The app draws every location from its status and presentation events; the
  // engine only records messages there.
  function writeStatus(message='',ok=true){
    if(foregroundPresentation?.read()?.lifecycle==='running'){if(message)foregroundPresentation.update({message,severity:ok?'info':'error'});}
    else if(statusSource)presentation.feedback(statusSource,message,ok);
  }
  function beginForegroundView(selected,kind,message,borrowed=null){
    foregroundSource=safeId(selected&&selected.id);borrowedPresentation=!!borrowed;
    foregroundPresentation=borrowed||presentation.begin(foregroundSource,kind,{label:selected.label,message});
    if(borrowed)borrowed.update({message,progress:null});
    return foregroundView();
  }
  function updateForegroundView(selected,patch={}){
    if(!foregroundPresentation||foregroundSource!==safeId(selected?.id))return null;
    foregroundPresentation.update({message:patch.message,progress:patch.stage?patch:undefined,severity:patch.ok===false?'error':'info'});return foregroundView();
  }
  function finishForegroundView(selected,{message=null,ok=null,lifecycle=null}={}){
    if(!foregroundPresentation||foregroundSource!==safeId(selected?.id))return null;
    const event=foregroundPresentation.read();if(!event)return null;
    if(!borrowedPresentation)foregroundPresentation.finish({message:message===null?event.message:message,lifecycle:lifecycle||(ok===false||ok===null&&event.severity==='error'?'failed':'succeeded')});
    const final=presentationView(foregroundPresentation.read());foregroundPresentation=null;foregroundSource='';borrowedPresentation=false;return final;
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
  function setBusy(next){busy=!!next;notifyStatus();}
  function beginForeground(selected,externalSignal=null,{respectBackgroundSuspension=false}={}){
    if(foregroundController)return null;
    const background=providerBackground(selected),scope=background.beginForeground({externalSignal,cancelCode:'PROVIDER_FOREGROUND_CANCELLED',cancelMessage:'Backup operation was cancelled.',respectBackgroundSuspension});if(!scope)return null;
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
    if(foregroundView()&&['bring-in','restore-version','sync'].includes(foregroundView().kind))try{BackupController.cancelImport(reason,freeze({announce:false}));}catch{}
    if(foregroundView())updateForegroundView({id:foregroundView().providerId},{stage:'cancelling',message:'Cancelling safely…',ok:true});
    writeStatus('Cancelling safely…',true);setBusy(true);return true;
  }
  function providerConnected(selected){try{return selected?.connected?selected.connected()===true:false;}catch{return false;}}
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

  async function authorize(selected,operation){
    if(selected.authorize)await selected.authorize(Object.freeze({operation}));
    presentation.condition(selected.id,'permission','');if(presentation.read(selected.id)?.lifecycle==='failed')presentation.resolve(selected.id);notifyStatus();
  }
  function repositoryProviderItem(raw,kind){
    if(!raw||typeof raw!=='object')throw new Error('Backup repository transport returned invalid file metadata.');
    const id=String(raw.id||''),expected=kind==='object'?/^obj_[a-f0-9]{32}$/u:['checkpoint','commit'].includes(kind)?/^cp_[a-f0-9]{32}$/u:kind==='session-claim'?/^sc_[a-f0-9]{16}$/u:/a^/u;
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
      const fingerprint=String(raw.history.logicalFingerprint||'').toLowerCase(),exportedAt=String(raw.history.exportedAt||''),daily=Number(raw.history.counts&&raw.history.counts.dailyRecord),notes=Number(raw.history.counts&&raw.history.counts.note),role=String(raw.history.retention&&raw.history.retention.role||'normal'),protectedUntil=String(raw.history.retention&&raw.history.retention.protectedUntil||''),purpose=String(raw.history.retention&&raw.history.retention.purpose||''),calendarRaw=raw.history.retention&&raw.history.retention.calendar||{},localDate=String(calendarRaw.localDate||''),weekStart=String(calendarRaw.weekStart||''),month=String(calendarRaw.month||''),utcOffsetMinutes=Number(calendarRaw.utcOffsetMinutes),notesFingerprint=String(raw.history.retention&&raw.history.retention.notesFingerprint||'').toLowerCase(),calendar=/^\d{4}-\d{2}-\d{2}$/u.test(localDate)&&/^\d{4}-\d{2}-\d{2}$/u.test(weekStart)&&/^\d{4}-\d{2}$/u.test(month)&&Number.isInteger(utcOffsetMinutes)?freeze({localDate,weekStart,month,utcOffsetMinutes}):null;
      if(/^[a-f0-9]{64}$/u.test(fingerprint)&&Number.isFinite(Date.parse(exportedAt))&&Number.isSafeInteger(daily)&&daily>=0&&Number.isSafeInteger(notes)&&notes>=0&&['normal','before-restore'].includes(role)&&(!protectedUntil||Number.isFinite(Date.parse(protectedUntil)))&&(!purpose||['before-restore','before-combine','before-clear-library','before-clear-archive'].includes(purpose)))history=freeze({format:Number.isSafeInteger(Number(raw.history.format))&&Number(raw.history.format)>0?Number(raw.history.format):0,logicalFingerprint:fingerprint,exportedAt:new Date(exportedAt).toISOString(),counts:freeze({dailyRecord:daily,note:notes}),encrypted:raw.history.encrypted===true,retention:freeze({role,protectedUntil:protectedUntil?new Date(protectedUntil).toISOString():'',purpose:role==='before-restore'?(purpose==='before-clear-archive'?'before-clear-library':(purpose||'before-restore')):'',calendar,notesFingerprint:/^[a-f0-9]{64}$/u.test(notesFingerprint)?notesFingerprint:''}),origin:/^inst_[a-z0-9_]{8,96}$/u.test(String(raw.history.origin||''))?String(raw.history.origin):'',attachmentsMissing:Number.isSafeInteger(Number(raw.history.attachmentsMissing))&&Number(raw.history.attachmentsMissing)>0?Number(raw.history.attachmentsMissing):0});
    }
    // A location that reads each version for its summary (the Device Folder)
    // says which ones it could not read, and which wait for the password.
    return Object.freeze({kind,id,name:clampText(raw.name||'',240),size:Number.isSafeInteger(size)?size:0,createdAt:String(raw.createdAt||''),modifiedAt:String(raw.modifiedAt||''),digest,serverDigest,remoteId:String(raw.remoteId||''),remoteVersion,verificationScope,history,unreadable:kind==='checkpoint'&&!history&&raw.unreadable===true,locked:kind==='checkpoint'&&!history&&raw.locked===true});
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
  // All provider history consumers share one listing/identity-validation path.
  // Cleanup alone requests fresh Device Folder digests; an inventory lookup
  // must never accidentally weaken that safety boundary or incur its cost.
  async function listRepositoryHistory(selected,{signal=null,freshDigests=false}={}){
    const [listed,listedCommits]=await Promise.all([
      selected.repository.list(freeze({kind:'checkpoint',signal,freshDigests})),
      selected.repository.list(freeze({kind:'commit',signal,freshDigests}))
    ]);
    const items=Array.isArray(listed)?listed:Array.isArray(listed?.items)?listed.items:[];
    const commitItems=Array.isArray(listedCommits)?listedCommits:Array.isArray(listedCommits?.items)?listedCommits.items:[];
    return freeze({
      items,commitItems,
      preparedCommits:prepareRepositoryHistoryItems(commitItems,'commit'),
      preparedManifests:prepareRepositoryHistoryItems(items,'checkpoint'),
      ignored:Math.max(0,Number(listed?.ignored)||0)+Math.max(0,Number(listedCommits?.ignored)||0),
      overflow:listed?.overflow===true||listedCommits?.overflow===true
    });
  }
  // A failure in a file's own content, marked as the repository module's
  // unreadableVersion does: its format is not one this build reads, it is
  // damaged, or it fails its checks. A read that failed, or one waiting for
  // the password, is not one.
  function contentFailure(message){const error=new Error(message);error.repositoryUnreadable=true;return error;}
  async function verifyRepositoryHistoryItem(selected,item,kind,verifiedScope,{interactive=true,signal=null,forCleanup=false,fresh=false}={}){
    let lease,read=false;
    try{
      const identity=forCleanup&&item.verificationScope===verifiedScope?verifiedHistoryIdentity(item):'',proofCache=identity&&verifiedHistoryCache(selected,item),proof=proofCache&&proofCache.proofs.get(identity);
      if(proof&&!fresh)return proof;
      const cached=fresh?null:readVerifiedHistory(selected,item,verifiedScope);
      let value;
      if(cached&&cached.kind===kind)value=cached.value;
      else{
        lease=repositoryDownloadLease(await selected.repository.download(item,Object.freeze({signal})));
        if(item.size&&lease.blob.size!==item.size)throw new Error(`Remote repository ${kind} size changed before verification.`);
        read=true;
        if(item.digest){const actualDigest=await Exports.run('checksum',{value:lease.blob},{signal});if(actualDigest!==item.digest)throw contentFailure(`Remote repository ${kind} failed content-integrity verification.`);}
        value=kind==='commit'?await RepositoryCheckpointPipeline.inspectCommit(lease.blob):await RepositoryCheckpointPipeline.inspectManifest(lease.blob,{interactive});
        if(kind==='checkpoint'&&value.checkpoint.checkpointId!==item.id)throw contentFailure('Remote repository checkpoint identity does not match its manifest.');
        if(!forCleanup)rememberVerifiedHistory(selected,item,Object.freeze({kind,value}),verifiedScope);
      }
      const row=kind==='commit'?Object.freeze({id:item.id,ref:item,marker:value}):Object.freeze({id:item.id,ref:item,manifest:forCleanup?repositoryRetentionManifest(value):value});
      const result=Object.freeze({kind,row});if(proofCache)proofCache.proofs.set(identity,result);return result;
    }catch(error){if(signal?.aborted)throw signal.reason||error;if(error&&error.code==='STUDY_DIRECTOR_IMPORT_CANCELLED')throw error;return Object.freeze({kind,invalid:Object.freeze({item,error,kind,unreadable:read&&error?.repositoryUnreadable===true})});}
    finally{await lease?.release?.().catch(()=>{});}
  }
  // Splits a scan's failures: a version whose every failure is in its files'
  // content is unreadable (known, kept, and removable on request); any other
  // failure, or one whose version is unknown, leaves the scan uncertain.
  function splitRepositoryFailures(invalid){
    const byId=new Map(),uncertain=[],unreadable=[];
    for(const entry of invalid){const id=String(entry?.item?.id||'');if(!/^cp_[a-f0-9]{32}$/u.test(id)){uncertain.push(entry);continue;}if(!byId.has(id))byId.set(id,[]);byId.get(id).push(entry);}
    for(const [id,entries] of byId){if(entries.every(entry=>entry.unreadable===true))unreadable.push(id);else uncertain.push(...entries);}
    return freeze({uncertain:freeze(uncertain),unreadable:freeze(unreadable.sort())});
  }
  async function repositoryProviderStateWork(selected,{interactive=true,signal=null,forCleanup=false}={}){
    const {items,commitItems,preparedCommits,preparedManifests,ignored,overflow}=await listRepositoryHistory(selected,{signal,freshDigests:forCleanup});
    const scopes=new Set([...items,...commitItems].map(raw=>String(raw&&raw.verificationScope||'')).filter(Boolean)),verifiedScope=scopes.size===1?[...scopes][0]:null;
    const invalid=[...preparedCommits.invalid,...preparedManifests.invalid],work=[...preparedCommits.items.map(item=>freeze({kind:'commit',item})),...preparedManifests.items.map(item=>freeze({kind:'checkpoint',item}))];
    if(forCleanup&&!overflow)pruneRepositoryHistoryProofs(selected,[...preparedCommits.items,...preparedManifests.items],verifiedScope);
    const verified=await mapRepositoryHistoryBounded(work,selected.repository.historyReadConcurrency,task=>verifyRepositoryHistoryItem(selected,task.item,task.kind,verifiedScope,{interactive,signal,forCleanup}),signal),manifests=[],commits=[];
    for(const result of verified){if(result.invalid){invalid.push(result.invalid);continue;}if(result.kind==='commit')commits.push(result.row);else manifests.push(result.row);}
    const classified=RepositoryCheckpointPipeline.classifyState(Object.freeze({manifests:Object.freeze(manifests),commits:Object.freeze(commits)}));
    for(const pair of classified.invalidPairs)invalid.push(Object.freeze({item:pair.manifest.ref||null,error:pair.error,kind:'checkpoint',unreadable:true}));
    // Obsolete history keeps only verified retention/provenance proofs. Full
    // object references are needed solely for the at-most-16 selected versions.
    const fullById=new Map(),retentionAt=new Date().toISOString();
    if(forCleanup&&!splitRepositoryFailures(invalid).uncertain.length&&!ignored&&!overflow){
      const retained=RepositoryCheckpointPipeline.selectRetention(classified.committed,{now:new Date(retentionAt)}).retained;
      const full=await mapRepositoryHistoryBounded(retained,selected.repository.historyReadConcurrency,row=>verifyRepositoryHistoryItem(selected,row.ref,'checkpoint',verifiedScope,{interactive,signal}),signal);
      for(const result of full){if(result.invalid)invalid.push(result.invalid);else fullById.set(result.row.id,result.row.manifest);}
    }
    // An unreadable version's other file (a readable commit or manifest) is
    // part of it, not a leftover of an unfinished backup.
    const failures=splitRepositoryFailures(invalid),unreadableIds=new Set(failures.unreadable),listedFiles=[...preparedCommits.items,...preparedManifests.items];
    const unreadable=freeze(failures.unreadable.map(id=>freeze({id,items:freeze(listedFiles.filter(item=>item.id===id).sort((a,b)=>Number(a.kind==='checkpoint')-Number(b.kind==='checkpoint')))})));
    const rows=Object.freeze(classified.committed.filter(row=>!unreadableIds.has(row.id)).map(row=>Object.freeze({item:row.ref,manifest:fullById.get(row.id)||row.manifest,commitItem:row.commitRef||null}))),uncommitted=Object.freeze(classified.uncommitted.filter(row=>!unreadableIds.has(row.id)).map(row=>Object.freeze({item:row.ref,manifest:row.manifest}))),orphanCommits=Object.freeze(classified.orphanCommits.filter(row=>!unreadableIds.has(row.id)).map(row=>row.ref));
    if(!overflow)unreadableByProvider.set(selected.id,unreadableIds);
    return Object.freeze({rows,uncommitted,orphanCommits,invalid:failures.uncertain,unreadable,ignored,overflow,retentionAt:forCleanup?retentionAt:null,latest:rows.length?rows[rows.length-1]:null});
  }

  async function repositoryProviderState(selected,options={}){
    return repositoryProviderStateWork(repositoryOperationSelected(selected,options),options);
  }

  function repositoryMetadataTimestamp(item){
    const value=String(item&&item.history&&item.history.exportedAt||item&&item.createdAt||item&&item.modifiedAt||'');return Number.isFinite(Date.parse(value))?new Date(value).toISOString():'';
  }
  async function repositoryProviderInventory(selected,{signal=null,freshDigests=false}={}){
    await synchronizeRepositoryScope(selected);
    const {preparedCommits,preparedManifests,ignored,overflow}=await listRepositoryHistory(selected,{signal,freshDigests});
    const invalid=[...preparedCommits.invalid,...preparedManifests.invalid],commitById=new Map(preparedCommits.items.map(item=>[item.id,item])),manifestIds=new Set(preparedManifests.items.map(item=>item.id)),pairs=[],uncommitted=[];
    for(const item of preparedManifests.items){const commitItem=commitById.get(item.id)||null;if(commitItem)pairs.push(freeze({item,commitItem}));else uncommitted.push(freeze({item}));}
    const orphanCommits=preparedCommits.items.filter(item=>!manifestIds.has(item.id));
    pairs.sort((a,b)=>Date.parse(repositoryMetadataTimestamp(a.item)||0)-Date.parse(repositoryMetadataTimestamp(b.item)||0)||a.item.id.localeCompare(b.item.id));
    return freeze({pairs:freeze(pairs),uncommitted:freeze(uncommitted),orphanCommits:freeze(orphanCommits),invalid:freeze(invalid),ignored,overflow});
  }
  // Background cleanup does its expensive verification and object inventory
  // without an exclusion lease. Once it is ready to delete, this compact
  // metadata fingerprint lets the short destructive unit prove that no
  // checkpoint/commit changed during planning.
  function repositoryCleanupFileSnapshot(item){
    if(!item||typeof item!=='object')return '';
    const size=Number(item.size);
    return [String(item.kind||''),String(item.id||''),String(item.name||''),Number.isSafeInteger(size)?String(size):'',String(item.digest||''),String(item.serverDigest||''),String(item.remoteId||''),String(item.remoteVersion||''),String(item.verificationScope||''),String(item.createdAt||''),String(item.modifiedAt||'')].join('\u0000');
  }
  function repositoryCleanupFilesSnapshot(items){return (Array.isArray(items)?items:[]).map(repositoryCleanupFileSnapshot).filter(Boolean).sort().join('\u0001');}
  function repositoryCleanupHistorySnapshot(history){
    const items=[];
    for(const row of history.rows||history.pairs||[]){if(row?.item)items.push(row.item);if(row?.commitItem)items.push(row.commitItem);}
    for(const row of history.uncommitted||[])if(row?.item)items.push(row.item);
    for(const item of history.orphanCommits||[])if(item)items.push(item);
    for(const row of history.unreadable||[])for(const item of row?.items||[])if(item)items.push(item);
    return repositoryCleanupFilesSnapshot(items);
  }
  function repositoryCleanupInventoryMatches(state,inventory){
    if(!state||!inventory||inventory.overflow===true||Math.max(0,Number(inventory.ignored)||0)>0||(inventory.invalid||[]).length)return false;
    return repositoryCleanupHistorySnapshot(state)===repositoryCleanupHistorySnapshot(inventory);
  }
  function repositoryCleanupObjectListing(inventory){
    const items=freeze((inventory&&Array.isArray(inventory.items)?inventory.items:[]).map(item=>freeze({id:item.id,ref:item,createdAt:String(item.createdAt||''),modifiedAt:String(item.modifiedAt||'')})));
    return freeze({items,overflow:inventory&&inventory.overflow===true,invalidCount:Math.max(0,Number(inventory&&inventory.invalidCount)||0)});
  }
  // Earlier texts of one note in this location's kept versions, newest first.
  // Each version's index says which stored record holds the note; a record
  // seen in a newer version is not read again, and only the note's own object
  // is read, never its images.
  async function noteVersionsRepositoryProvider(id,noteId,options={}){
    const selected=providers.get(safeId(id)),note=String(noteId||'');
    if(!selected||!selected.repository||!note)return Object.freeze({sourceId:safeId(id),available:false,reason:'unavailable',entries:Object.freeze([])});
    if(busy)return Object.freeze({sourceId:selected.id,available:false,reason:'busy',entries:Object.freeze([])});
    const traceId=OperationDiagnostics.start('provider-note-versions',selected.label,{provider:selected.id}),foreground=beginForeground(selected,options&&options.signal||null);
    if(!foreground){OperationDiagnostics.finish({status:'skipped',reason:'busy'},traceId);return Object.freeze({sourceId:selected.id,available:false,reason:'busy',entries:Object.freeze([])});}
    beginForegroundView(selected,'history',`Reading earlier versions from ${selected.label}…`,options.presentation);busy=true;setBusy(true);
    try{
      await foreground.settled;
      if(selected.prepare)await selected.prepare();
      if(options&&options.interactive!==false)await authorize(selected,'history');
      const scoped=repositoryOperationSelected(selected,{signal:foreground.signal}),inventory=await repositoryProviderInventory(scoped,{signal:foreground.signal});
      if(inventory.overflow)throw new Error('Backup history could not be read completely. Earlier versions were stopped safely.');
      const quarantinedObjectIds=integrityScrubHooks?await integrityScrubHooks.quarantine(selected.id):[],quarantined=new Set(repositoryProviderObjectIds(quarantinedObjectIds));
      const kept=repositoryInventoryHistoryEntries(scoped,inventory,{quarantinedObjectIds}),pairs=new Map(inventory.pairs.map(pair=>[pair.item.id,pair]));
      const objects=await repositoryObjectInventory(selected,{signal:foreground.signal}),byId=new Map(objects.items.map(item=>[item.id,item]));
      const readObject=entry=>{const item=byId.get(entry.objectId);if(!item||quarantined.has(entry.objectId))throw new Error(`Repository object ${entry.objectId} is unavailable.`);return selected.repository.download(item,freeze({signal:foreground.signal}));};
      // skip: versions already read at another location (by id or by the
      // data they hold), so one history is read once. covered says which
      // versions this location read.
      const seen=new Set(),entries=[],skipIds=new Set(options?.skip?.checkpointIds||[]),skipData=new Set(options?.skip?.contents||[]),coveredIds=[],coveredData=[];
      for(const version of kept){
        if(version.unreadable||version.locked||skipIds.has(version.location.checkpointId)||skipData.has(version.logicalFingerprint))continue;
        const pair=pairs.get(version.location.checkpointId);if(!pair)continue;
        let manifest;try{manifest=(await verifyRepositoryInventoryPair(selected,pair,{interactive:false,signal:foreground.signal})).manifest;}
        catch(error){if(foreground.signal.aborted)throw error;AppDiagnostics.capture('backup-provider.note-version-verification',error,'warn');continue;}
        coveredIds.push(version.location.checkpointId);coveredData.push(version.logicalFingerprint);
        const found=RepositoryCheckpointPipeline.noteObject(manifest,note);if(!found||seen.has(found.fingerprint))continue;seen.add(found.fingerprint);
        const payload=await RepositoryCheckpointPipeline.readNote(manifest,readObject,note,{interactive:false,signal:foreground.signal});
        if(payload&&typeof payload.text==='string')entries.push(freeze({sourceId:selected.id,sourceLabel:selected.label,checkpointId:version.location.checkpointId,exportedAt:version.exportedAt,origin:String(manifest.installationId||version.origin||''),text:payload.text}));
      }
      OperationDiagnostics.finish({versions:entries.length},traceId);finishForegroundView(selected,{message:'',ok:true});
      return Object.freeze({sourceId:selected.id,available:true,reason:'',entries:freeze(entries),covered:freeze({checkpointIds:freeze(coveredIds),contents:freeze(coveredData)})});
    }catch(error){
      const cancelled=error?.name==='AbortError'||['PROVIDER_FOREGROUND_CANCELLED','STUDY_DIRECTOR_IMPORT_CANCELLED'].includes(String(error?.code||''));
      if(cancelled){OperationDiagnostics.finish({cancelled:true},traceId);finishForegroundView(selected,{message:'',ok:true,lifecycle:'cancelled'});return Object.freeze({sourceId:selected.id,available:false,reason:'cancelled',cancelled:true,entries:Object.freeze([])});}
      OperationDiagnostics.fail(error,{},traceId);finishForegroundView(selected,{message:'Could not read earlier versions safely.',ok:false});AppDiagnostics.capture('backup-provider.note-versions',error,'warn');
      return Object.freeze({sourceId:selected.id,available:false,reason:String(error&&error.message||error),entries:Object.freeze([])});
    }finally{
      if(foregroundView()&&foregroundView().providerId===selected.id)finishForegroundView(selected);await release(selected,'history');busy=false;setBusy(false);foreground.release();
    }
  }
  function repositoryInventoryObservation(inventory,{verificationFailures=0}={}){
    const source=inventory&&typeof inventory==='object'?inventory:{};return freeze({invalid:source.invalid||freeze([]),uncommitted:source.uncommitted||freeze([]),orphanCommits:source.orphanCommits||freeze([]),ignored:Math.max(0,Number(source.ignored)||0)+Math.max(0,Number(verificationFailures)||0),overflow:source.overflow===true,rows:source.pairs||freeze([])});
  }
  async function verifyRepositoryInventoryPair(selected,pair,{interactive=true,signal=null,fresh=false}={}){
    if(!pair||!pair.item||!pair.commitItem)throw new Error('The selected backup version is incomplete.');
    const scopes=new Set([pair.item.verificationScope,pair.commitItem.verificationScope].filter(Boolean)),verifiedScope=scopes.size===1?[...scopes][0]:null;
    const [manifestResult,commitResult]=await Promise.all([
      verifyRepositoryHistoryItem(selected,pair.item,'checkpoint',verifiedScope,{interactive,signal,fresh}),
      verifyRepositoryHistoryItem(selected,pair.commitItem,'commit',verifiedScope,{interactive:false,signal,fresh})
    ]);
    if(manifestResult.invalid)throw manifestResult.invalid.error;if(commitResult.invalid)throw commitResult.invalid.error;
    const classified=RepositoryCheckpointPipeline.classifyState(freeze({manifests:freeze([manifestResult.row]),commits:freeze([commitResult.row])}));
    if(classified.invalidPairs.length)throw classified.invalidPairs[0].error;if(classified.committed.length!==1)throw new Error('The selected backup version is not completely committed.');
    return freeze({item:pair.item,commitItem:pair.commitItem,manifest:classified.committed[0].manifest});
  }
  function repositoryInventoryHistoryEntries(selected,inventory,{quarantinedObjectIds=null}={}){
    const quarantined=repositoryProviderObjectIds(quarantinedObjectIds),source=freeze({id:selected.id,label:selected.label}),now=Date.now(),rows=[...inventory.pairs].reverse();
    const known=unreadableByProvider.get(selected.id),unreadable=pair=>pair.item.unreadable===true||!!known?.has(pair.item.id);
    const retentionRows=[];
    for(const pair of rows){const summary=pair.item.history,calendar=summary?.retention?.calendar;if(!summary||!calendar||unreadable(pair))continue;retentionRows.push(freeze({id:pair.item.id,manifest:freeze({version:summary.format,exportedAt:summary.exportedAt,retention:summary.retention,installationId:String(summary.origin||'')})}));}
    let retainedIds=null,tiers={},currentFormat=false;
    if(retentionRows.length){const selection=RepositoryCheckpointPipeline.selectRetention(freeze(retentionRows),{now:new Date(now)});retainedIds=new Set(selection.retained.map(row=>row.id));tiers=selection.tiers;currentFormat=selection.currentFormat===true;}
    const legacyLimit=Math.max(1,Number(RepositoryCheckpointPipeline.retention?.normalLimit)||15);let legacyKept=0;
    return freeze(rows.map(pair=>{
      // A version this build cannot read is listed on its own (never matched
      // with another location's copy) so the person can see it and remove it.
      if(unreadable(pair)){const at=repositoryMetadataTimestamp(pair.item);return Number.isFinite(Date.parse(at))?freeze({logicalId:'unreadable_'+pair.item.id,logicalFingerprint:'',exportedAt:at,counts:null,origin:'',unreadable:true,location:freeze({sourceId:source.id,sourceLabel:source.label,checkpointId:pair.item.id,exportedAt:at,tier:'unreadable',encrypted:false,verification:'unreadable',legacyMetadata:false,quarantineDeferred:false})}):null;}
      const item=pair.item,summary=item.history,exportedAt=summary?.exportedAt||repositoryMetadataTimestamp(item),fingerprint=summary?.logicalFingerprint||item.digest;
      if(!/^[a-f0-9]{64}$/u.test(String(fingerprint||''))||!Number.isFinite(Date.parse(exportedAt)))return null;
      let tier='retained';
      if(summary?.retention?.calendar){if(!retainedIds?.has(item.id))return null;tier=String(tiers[item.id]||'retained');}
      // A version waiting for the password (item.locked) has no summary yet:
      // it is listed as locked, never matched by data with another copy.
      else{if(currentFormat&&!item.locked||legacyKept>=legacyLimit)return null;legacyKept+=1;tier=legacyKept===1?'latest':'retained';}
      if(item.locked)return freeze({logicalId:'locked_'+item.id,logicalFingerprint:'',exportedAt,counts:null,origin:'',locked:true,location:freeze({sourceId:source.id,sourceLabel:source.label,checkpointId:item.id,exportedAt,tier,encrypted:true,verification:'on-restore',legacyMetadata:true,quarantineDeferred:quarantined.length>0})});
      return freeze({logicalId:'state_'+fingerprint,logicalFingerprint:fingerprint,exportedAt,counts:summary?.counts||freeze({dailyRecord:0,note:0}),origin:String(summary?.origin||''),location:freeze({sourceId:source.id,sourceLabel:source.label,checkpointId:item.id,exportedAt,tier,encrypted:summary?.encrypted===true,verification:'on-restore',legacyMetadata:!summary,quarantineDeferred:quarantined.length>0,attachmentsMissing:Number(summary?.attachmentsMissing)||0})});
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
    // The object listing does not depend on the version listing, so both
    // requests go out together; an empty repository simply ignores it.
    const objectListing=repositoryObjectInventory(selected,{signal});objectListing.catch(()=>{});
    const inventory=await repositoryProviderInventory(selected,{signal});if(inventory.overflow)throw new Error('Backup history could not be read completely. Backup was stopped safely.');
    const objectInventoryTask=inventory.pairs.length?objectListing:objectListing.then(()=>null,()=>null);
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
      if(item.serverDigest!==expected)throw new Error('The stored checksum did not match the uploaded repository object.');
      report('verify',`${prefix}… ✓`);return true;
    }
    const transferProgress=(stage,label)=>progress=>{const loadedBytes=Math.max(0,Number(progress?.loaded)||0),activeBytes=Math.max(1,Number(progress?.total)||Number(entry.storedBytes)||1);report(stage,`${prefix} · ${label}`,{loadedBytes,activeBytes});};
    const lease=repositoryDownloadLease(await selected.repository.download(item,Object.freeze({signal,onProgress:transferProgress('verify-download','downloading')})));
    try{await RepositoryCheckpointPipeline.verifyObject(lease.blob,entry,Object.freeze({signal,onProgress:transferProgress('verify-hash','checking')}));return true;}
    finally{await lease.release().catch(()=>{});}
  }
  // Metadata verification shares the byte-level lease and checksum contract;
  // manifest and commit provenance are still inspected independently below.
  async function inspectUploadedRepositoryBytes(selected,item,kind,signal,inspect){
    const lease=repositoryDownloadLease(await selected.repository.download(item,freeze({signal})));
    try{
      if(item.size&&lease.blob.size!==item.size)throw new Error(`Remote repository ${kind} size changed before verification.`);
      if(item.digest){const actual=await Exports.run('checksum',{value:lease.blob});if(actual!==item.digest)throw new Error(`Remote repository ${kind} failed content-integrity verification.`);}
      return await inspect(lease.blob);
    }finally{await lease.release().catch(()=>{});}
  }
  async function verifyUploadedRepositoryManifest(selected,item,expected,expectedDigest='',signal=null){
    const localDigest=String(expectedDigest||item.digest||'').toLowerCase();
    if(item.serverDigest){
      if(!localDigest||item.digest!==localDigest||item.serverDigest!==localDigest)throw new Error('The stored checksum did not match the uploaded backup version.');
      return expected;
    }
    const actual=await inspectUploadedRepositoryBytes(selected,item,'checkpoint',signal,blob=>RepositoryCheckpointPipeline.inspectManifest(blob,{interactive:false}));
    if(actual.checkpoint.checkpointId!==expected.checkpoint.checkpointId||actual.sourceRevision!==expected.sourceRevision||actual.exportedAt!==expected.exportedAt)throw new Error('Remote repository checkpoint failed provenance verification.');
    return actual;
  }
  async function verifyUploadedRepositoryCommit(selected,item,expected,signal=null){
    const localDigest=String(expected&&expected.digest||item.digest||'').toLowerCase();
    if(item.serverDigest){
      if(!localDigest||item.digest!==localDigest||item.serverDigest!==localDigest)throw new Error('The stored checksum did not match the uploaded backup commit.');
      return freeze({format:expected.format,version:expected.version,checkpointId:expected.checkpointId,exportedAt:expected.exportedAt,sourceRevision:expected.sourceRevision,manifestVersion:expected.manifestVersion});
    }
    const actual=await inspectUploadedRepositoryBytes(selected,item,'commit',signal,blob=>RepositoryCheckpointPipeline.inspectCommit(blob));
    if(actual.checkpointId!==expected.checkpointId||actual.exportedAt!==expected.exportedAt||actual.sourceRevision!==expected.sourceRevision||Number(actual.manifestVersion)!==Number(expected.manifestVersion))throw new Error('Remote repository commit failed provenance verification.');
    return actual;
  }
  function repositoryPublicationCapable(selected){return !!(selected&&selected.repository&&selected.repository.beginPublication&&selected.repository.listPublications&&selected.repository.assertPublication&&selected.repository.endPublication);}
  function repositoryMaintenanceCapable(selected){return !!(selected&&selected.repository&&selected.repository.beginMaintenance&&selected.repository.listMaintenances&&selected.repository.assertMaintenance&&selected.repository.endMaintenance);}
  function repositoryCoordinationCapable(selected){return repositoryPublicationCapable(selected)&&repositoryMaintenanceCapable(selected);}
  async function repositoryPublicationSafety(selected){
    if(!repositoryPublicationCapable(selected))return freeze({blocked:false,reason:'publication-protection-unavailable',active:0,invalid:0});
    let listed;try{listed=await selected.repository.listPublications();}catch(error){AppDiagnostics.capture('backup-provider.repository-publications',error,'warn');return freeze({blocked:true,reason:'publication-state-unavailable',active:0,invalid:1});}
    const rows=Array.isArray(listed)?listed:Array.isArray(listed&&listed.items)?listed.items:[],now=Date.now();let active=0,invalid=Math.max(0,Number(listed&&listed.ignored)||0)+(listed&&listed.overflow===true?1:0),nextEligibleAt=0;
    // A marker that renews and has gone unrenewed past publicationStaleMs was
    // left by an upload that stopped (a closed or frozen page): it is removed,
    // so the upload, if it ever resumes, fails its own check before commit. A
    // marker from an older build that does not renew keeps the full day.
    let abandoned=0;
    for(const row of rows){const created=Date.parse(String(row&&row.createdAt||''));if(!Number.isFinite(created)){invalid+=1;continue;}const lifetime=row&&row.renews===true?PUBLICATION_STALE_MS:PUBLICATION_MAX_AGE_MS;if(now-created<lifetime){active+=1;const expires=created+lifetime;if(!nextEligibleAt||expires<nextEligibleAt)nextEligibleAt=expires;continue;}const renewing=lifetime===PUBLICATION_STALE_MS;try{await selected.repository.endPublication(row);if(renewing)abandoned+=1;}catch(error){AppDiagnostics.capture('backup-provider.repository-publication-expired-cleanup',error,'warn');if(renewing)invalid+=1;}}
    return freeze({blocked:active>0||invalid>0,reason:active>0?'active-publication':invalid>0?'uncertain-publication-state':'',active,invalid,abandoned,nextEligibleAt:nextEligibleAt?new Date(nextEligibleAt).toISOString():''});
  }
  async function repositoryMaintenanceSafety(selected,{excludeId='',releaseSameDevice=false}={}){
    if(!repositoryMaintenanceCapable(selected))return freeze({blocked:false,reason:'maintenance-protection-unavailable',active:0,invalid:0});
    let listed;try{listed=await selected.repository.listMaintenances();}catch(error){AppDiagnostics.capture('backup-provider.repository-maintenances',error,'warn');return freeze({blocked:true,reason:'maintenance-state-unavailable',active:0,invalid:1});}
    const rows=Array.isArray(listed)?listed:Array.isArray(listed&&listed.items)?listed.items:[],now=Date.now(),excluded=String(excludeId||'');let active=0,invalid=Math.max(0,Number(listed&&listed.ignored)||0)+(listed&&listed.overflow===true?1:0),nextEligibleAt=0;
    for(const row of rows){if(excluded&&String(row&&row.id||'')===excluded)continue;if(releaseSameDevice&&row&&row.sameDevice===true){try{await selected.repository.endMaintenance(row);}catch(error){AppDiagnostics.capture('backup-provider.repository-maintenance-own-release',error,'warn');invalid+=1;}continue;}const created=Date.parse(String(row&&row.createdAt||'')),expires=row&&row.expiresAt?Date.parse(String(row.expiresAt)):created+MAINTENANCE_MAX_AGE_MS;if(!Number.isFinite(created)||!Number.isFinite(expires)||expires<=created){invalid+=1;continue;}if(now<expires){active+=1;if(!nextEligibleAt||expires<nextEligibleAt)nextEligibleAt=expires;continue;}try{await selected.repository.endMaintenance(row);}catch(error){AppDiagnostics.capture('backup-provider.repository-maintenance-expired-cleanup',error,'warn');}}
    return freeze({blocked:active>0||invalid>0,reason:active>0?'active-maintenance':invalid>0?'uncertain-maintenance-state':'',active,invalid,nextEligibleAt:nextEligibleAt?new Date(nextEligibleAt).toISOString():''});
  }
  // Markers this page started. A marker from this device that this page did
  // not start was left by an earlier page (an upload cut off by a closed
  // page): the location marks it sameDevice, and it never makes this device
  // wait its turn for itself.
  const ownPublications=new Set();
  function rememberOwnPublication(lease){if(lease&&lease.id){ownPublications.add(String(lease.id));if(ownPublications.size>64)ownPublications.delete(ownPublications.values().next().value);}}
  async function beginRepositoryPublication(selected){
    if(!repositoryPublicationCapable(selected))return null;
    const lease=await selected.repository.beginPublication();rememberOwnPublication(lease);
    return lease;
  }
  // An upload keeps a renewing marker fresh while it runs, and renews it once
  // more just before its commit. A failed renewal is kept and stops the
  // upload at that last check, so it never commits on a marker that cleanup
  // may have removed as abandoned.
  function publicationHeartbeat(selected,lease){
    const renewing=!!(lease&&lease.renews===true&&typeof selected.repository.renewPublication==='function');
    let current=lease,failure=null,timer=null,stopped=false,chain=Promise.resolve();
    const renew=()=>{chain=chain.then(async()=>{if(failure)throw failure;const next=await selected.repository.renewPublication(current);rememberOwnPublication(next);current=next;}).catch(error=>{failure=failure||error;throw failure;});return chain;};
    const schedule=()=>{if(!renewing||stopped||failure)return;timer=setTimeout(()=>{timer=null;if(stopped)return;renew().then(schedule,error=>AppDiagnostics.capture('backup-provider.repository-publication-renew',error,'warn'));},PUBLICATION_RENEW_MS);};
    schedule();
    return freeze({
      current:()=>current,
      beforeCommit:async()=>{if(renewing)await renew();return assertRepositoryPublication(selected,current);},
      stop:async()=>{stopped=true;if(timer!==null){clearTimeout(timer);timer=null;}await chain.catch(()=>{});return current;}
    });
  }
  function repositoryMaintenanceError(safety){
    const uncertain=Number(safety&&safety.invalid)||0;
    const error=new Error(uncertain?'Backup maintenance state could not be verified safely. Retry after the other device finishes its backup work.':'Backup maintenance is still yielding to a foreground Study Director operation.');
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
      const safety=await repositoryMaintenanceSafety(selected,{releaseSameDevice:true});polls+=1;
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
  async function cleanupRepositoryProviderState(selected,state,{reuseObjectInventory=false,preparedObjectListing=null,maintenanceLease=null,checkMaintenance=null,inventoryBeforeDelete=false,beginDeletion=null,workBudget=null}={}){
    const publicationCapable=repositoryPublicationCapable(selected),publicationSafety=await repositoryPublicationSafety(selected),objectGraceBefore=publicationCapable?new Date(Date.now()-OBJECT_GC_GRACE_MS).toISOString():'',assertLease=checkMaintenance||(async()=>{if(maintenanceLease)await assertRepositoryMaintenance(selected,maintenanceLease);});
    const cleanupRows=Object.freeze(state.rows.map(row=>Object.freeze({id:row.item.id,ref:Object.freeze({checkpoint:row.item,commit:row.commitItem}),manifest:row.manifest}))),retentionBacklog=RepositoryCheckpointPipeline.selectRetention(cleanupRows,{now:new Date()}).remove.length,checkpointDeleteBudget=Math.min(MAINTENANCE_MAX_CHECKPOINT_DELETES,Math.max(MAINTENANCE_MIN_CHECKPOINT_DELETES,retentionBacklog));
    const cleaned=await RepositoryCheckpointPipeline.cleanup(Object.freeze({
      checkpoints:cleanupRows,now:state.retentionAt?new Date(state.retentionAt):new Date(),
      inventoryBeforeDelete,beginDeletion,workBudget,
      invalidCount:state.invalid.length,unreadableCount:(state.unreadable||[]).length,ignoredCount:state.ignored,overflow:state.overflow,blockObjectGc:publicationSafety.blocked,objectGraceBefore,maxCheckpointDeletes:checkpointDeleteBudget,maxObjectDeletes:MAINTENANCE_MAX_OBJECT_DELETES,
      incompleteArtifacts:freeze([...(state.uncommitted||[]).map(row=>freeze({kind:'checkpoint',ref:row.item})),...(state.orphanCommits||[]).map(item=>freeze({kind:'commit',ref:item}))]),
      deleteIncompleteArtifact:async artifact=>{await assertLease();await selected.repository.delete(artifact.ref);return true;},
      deleteCheckpoint:async row=>{await assertLease();if(row.ref.commit)await selected.repository.delete(row.ref.commit);await assertLease();await selected.repository.delete(row.ref.checkpoint);return true;},
      listObjects:async()=>{
        await assertLease();if(preparedObjectListing)return preparedObjectListing;if(reuseObjectInventory){const cached=reusableRepositoryObjectListing(selected);if(cached)return cached;}
        const listing=await selected.repository.list(Object.freeze({kind:'object'})),raw=Array.isArray(listing)?listing:Array.isArray(listing&&listing.items)?listing.items:[];
        const items=[],seen=new Set();let invalidCount=Math.max(0,Number(listing&&listing.ignored)||0);
        for(const value of raw){try{const item=repositoryProviderItem(value,'object');if(seen.has(item.id)){invalidCount+=1;continue;}seen.add(item.id);items.push(Object.freeze({id:item.id,ref:item,createdAt:item.createdAt,modifiedAt:item.modifiedAt}));}catch{invalidCount+=1;}}
        return Object.freeze({items:Object.freeze(items),overflow:listing&&listing.overflow===true,invalidCount});
      },
      deleteObject:async item=>{await assertLease();return selected.repository.delete(item.ref);},
      onError:(kind,error)=>AppDiagnostics.capture(kind==='checkpoint-delete'?'backup-provider.repository-checkpoint-delete':kind==='incomplete-delete'?'backup-provider.repository-incomplete-delete':'backup-provider.repository-object-gc',error,'warn')
    }));
    if(cleaned.formats)formatsByProvider.set(selected.id,freeze({...cleaned.formats,checkedAt:new Date().toISOString()}));
    if(!cleaned.gcPending){const cache=verifiedHistoryByProvider.get(selected.id);if(cache)pruneRepositoryHistoryProofs(selected,cleaned.retained.flatMap(row=>[row.ref.checkpoint,row.ref.commit].filter(Boolean)),cache.scope);}
    return cleaned;
  }
  async function cleanupRepositoryProvider(selected,state,newCheckpointId,options={}){
    if(!state.rows.some(row=>row.item.id===newCheckpointId))throw new Error('The newly uploaded checkpoint did not become the committed Latest candidate before retention cleanup.');
    return String((await cleanupRepositoryProviderState(selected,state,options)).warning||'');
  }
  function deferredRepositoryMaintenance(warning,contentionRetryMs=0){
    return freeze({warning:String(warning||'Repository maintenance was deferred.'),retained:null,removedCheckpoints:0,checkpointDeferred:0,checkpointFailures:0,gcRemoved:0,gcDeferred:0,gcBudgetDeferred:0,gcFailures:0,gcSkipped:true,gcPending:true,maintenanceBlocked:true,contentionRetryMs:Math.max(0,Number(contentionRetryMs)||0),uncertainCount:0,selection:null});
  }
  async function cleanupRepositoryProviderSafely(selected,{signal=null,workBudget,traceId=''}={}){
    const owner=selected,planning=repositoryOperationSelected(selected,{signal});
    await synchronizeRepositoryScope(planning);
    if(!repositoryCoordinationCapable(planning)){
      workBudget.start(PROVIDER_MAINTENANCE_BUDGET_MS);
      const state=await repositoryProviderState(planning,{interactive:false,signal,forCleanup:true});
      return cleanupRepositoryProviderState(planning,state,{workBudget});
    }

    // Read-only planning is deliberately outside the maintenance exclusion.
    // Foreground backup/sync therefore never waits for history verification,
    // retention planning or the potentially paginated object inventory.
    OperationDiagnostics.mark('maintenance-inventory-start',{provider:selected.id},traceId);
    const state=await repositoryProviderState(planning,{interactive:false,signal,forCleanup:true});
    if(state.overflow||(state.invalid||[]).length||Math.max(0,Number(state.ignored)||0)>0){
      OperationDiagnostics.mark('maintenance-inventory-complete',{provider:selected.id,total:state.rows.length,destructive:false},traceId);
      workBudget.start(PROVIDER_MAINTENANCE_BUDGET_MS);
      return cleanupRepositoryProviderState(planning,state,{workBudget});
    }
    const preparedObjectListing=repositoryCleanupObjectListing(await repositoryObjectInventory(planning,{signal}));
    OperationDiagnostics.mark('maintenance-inventory-complete',{provider:selected.id,total:state.rows.length,objects:preparedObjectListing.items.length,destructive:true},traceId);

    let contentionRetryMs=0,maintenanceLease=await beginRepositoryMaintenance(planning,{onBlocked:safety=>{const uncertain=Number(safety.publications&&safety.publications.invalid)||Number(safety.maintenances&&safety.maintenances.invalid)||0;if(uncertain)return;const deadlines=[safety.publications&&safety.publications.nextEligibleAt,safety.maintenances&&safety.maintenances.nextEligibleAt].map(value=>Date.parse(String(value||''))).filter(Number.isFinite);if(deadlines.length)contentionRetryMs=Math.max(1000,Math.min(...deadlines)-Date.now()+1000);}});
    if(!maintenanceLease)return deferredRepositoryMaintenance('Repository maintenance was deferred because another backup or maintenance operation is active.',contentionRetryMs);

    const renewable=typeof planning.repository.renewMaintenance==='function'&&typeof owner.repository.beginOperation==='function';let renewing=null;
    const keepAlive=async(force=false)=>{
      if(signal?.aborted)throw signal.reason;
      if(renewing){await renewing;return;}
      const created=Date.parse(maintenanceLease.createdAt),duration=Date.parse(maintenanceLease.expiresAt)-created;
      const renewAfter=Number.isFinite(duration)&&duration>0?duration/4:PROVIDER_MAINTENANCE_BUDGET_MS/2;
      if(renewable&&Date.now()-created>=renewAfter){
        renewing=(async()=>{maintenanceLease=await planning.repository.renewMaintenance(maintenanceLease);await assertRepositoryMaintenance(planning,maintenanceLease);})().finally(()=>{renewing=null;});await renewing;return;
      }
      if(force)await assertRepositoryMaintenance(planning,maintenanceLease);
    };
    try{
      // The lease exists only for the destructive unit. Re-hash checkpoint and
      // commit metadata under that lease: equal timestamps/sizes alone cannot
      // establish that a manifest still means what the earlier plan saw.
      const protectedSelection=typeof owner.repository.beginOperation==='function'?repositoryOperationSelected(owner,{signal,checkProtection:keepAlive}):planning;
      const currentInventory=await repositoryProviderInventory(protectedSelection,{signal,freshDigests:true});
      if(!repositoryCleanupInventoryMatches(state,currentInventory)){
        OperationDiagnostics.mark('maintenance-inventory-invalidated',{provider:selected.id},traceId);
        return deferredRepositoryMaintenance('Repository maintenance was deferred because backup history changed after its read-only planning pass.',1000);
      }
      await keepAlive(true);
      return await cleanupRepositoryProviderState(protectedSelection,state,{workBudget,preparedObjectListing,checkMaintenance:()=>keepAlive(true),inventoryBeforeDelete:true,beginDeletion:()=>{workBudget.start(PROVIDER_MAINTENANCE_BUDGET_MS);OperationDiagnostics.mark('maintenance-deletion-start',{provider:selected.id,total:state.rows.length},traceId);}});
    }finally{
      if(renewing)await renewing.catch(()=>{});
      await endRepositoryMaintenance(planning,maintenanceLease);
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
    const publicationProtected=repositoryCoordinationCapable(selected),deferredMaintenance=!!maintenanceHooks&&publicationProtected;let publicationLease=null,publicationRenewal=null,publicationSafetyTask=null,maintenanceQueued=false,maintenanceNeeded=false,published=null,sessionOwnershipState=null;
    let objectStarted=0,objectCompleted=0,objectCount=0,uploadedBytes=0,totalBytes=0;
    const progress=(stage,message,details={})=>{if(signal?.aborted||(foregroundView()?.operationId||'')!==presentationId)return;if(recoveryProgress){if(presentationId)recoveryStatus(message,true,recoveryProgress,stage,details);else try{recoveryProgress(freeze({stage,message,ok:true,...details}));}catch(error){AppDiagnostics.capture('backup-provider.recovery-progress',error,'warn');}}else providerProgress(selected,stage,message,details);};
    try{
      progress(retention?.role==='before-restore'?'safety-scan':'scan',retention?.role==='before-restore'?`Preparing safety version in ${selected.label}…`:`Reading existing backups in ${selected.label}…`);
      OperationDiagnostics.mark('provider-repository-scan-start',{provider:selected.id,beforeRestore:retention?.role==='before-restore'});
      if(publicationProtected){publicationLease=await beginRepositoryPublication(selected);publicationRenewal=publicationHeartbeat(selected,publicationLease);OperationDiagnostics.mark('provider-publication-lease-acquired',{provider:selected.id});publicationSafetyTask=validateRepositoryPublicationStartMeasured(selected,publicationLease,{foregroundPriority,signal,progress});}
      // A shared location takes one device's backup at a time, and only from
      // a device that has taken in its newest version. The turn and session
      // checks only read, so they go out with discovery and are acted on below
      // in the same order as before.
      const shared=selected.shared===true&&role==='normal',early=task=>{task.catch(()=>{});return task;};
      const turnTask=shared?early(assertSharedPublicationTurn(selected,publicationLease)):null,sessionTask=shared?early(assertSharedSessionOwnership(selected,{signal})):null;
      const excludedTask=integrityScrubHooks?integrityScrubHooks.quarantine(selected.id):Promise.resolve([]),discoveryTask=repositorySnapshot?Promise.resolve(null):repositoryProviderPublicationBase(selected,{signal});
      const [persistedExcluded,discovered]=await Promise.all([excludedTask,discoveryTask,publicationSafetyTask||Promise.resolve(true)]);
      let base,availableObjectIds;
      if(repositorySnapshot&&Array.isArray(repositorySnapshot.history)&&Array.isArray(repositorySnapshot.availableObjectIds)&&repositorySnapshot.inventory){
        base=freeze({history:freeze([...repositorySnapshot.history]),inventory:repositorySnapshot.inventory,invalidCount:Math.max(0,Number(repositorySnapshot.invalidCount)||0)});availableObjectIds=new Set(repositorySnapshot.availableObjectIds);
        OperationDiagnostics.mark('provider-repository-scan-reused',{provider:selected.id,beforeRestore:retention?.role==='before-restore',history:base.history.length,objects:availableObjectIds.size});
      }else{base=discovered;availableObjectIds=repositoryAvailableObjectIdsFromInventory(base.objectInventory,base.history);}
      const history=base.history,excluded=repositoryProviderObjectIds([...(Array.isArray(excludedObjectIds)?excludedObjectIds:[]),...(Array.isArray(persistedExcluded)?persistedExcluded:[])]);
      // A device holding data this build cannot read uploads no shared
      // version: one without that data would read as its deletion elsewhere.
      if(shared&&ports.ownership.canShare()!==true)throw Object.assign(new Error(`This device has data from a newer version of Study Director, so it does not upload to ${selected.label} until the app is updated.`),{code:'STUDY_DIRECTOR_SHARE_HELD'});
      if(shared){
        await turnTask;
        const ahead=base.inventory?await sharedAhead(base.inventory,selected):null;
        if(ahead?.unreadable){waitForNewerVersion(selected,ahead.item.id);throw syncError('REPOSITORY_SYNC_NEEDS_UPDATE',`${selected.label} has a version this app can’t read. Update the app, or remove that version in Version History, to sync again.`);}
        if(ahead)throw syncError('REPOSITORY_SYNC_BEHIND',`${selected.label} has newer changes to take in first.`);
        sessionOwnershipState=await sessionTask;
      }
      OperationDiagnostics.mark('provider-repository-scan-complete',{provider:selected.id,history:history.length,invalid:Number(base.invalidCount)||0,reused:!!repositorySnapshot});
      const maintenancePendingState=deferredMaintenance?await maintenanceState(selected):null,maintenanceWasActionable=maintenanceActionable(maintenancePendingState),maintenanceReason=String(maintenancePendingState&&maintenancePendingState.reason||''),maintenanceDeferred=!maintenanceWasActionable&&maintenanceReason==='publication-contention',inventory=base.inventory;
      maintenanceNeeded=maintenanceWasActionable||base.invalidCount>0||inventory.uncommitted.length>0||inventory.orphanCommits.length>0;
      if(availableObjectIds instanceof Set)for(const id of excluded)availableObjectIds.delete(id);
      progress('prepare',`Preparing backup for ${selected.label}…`);
      OperationDiagnostics.mark('checkpoint-preparation-start',{provider:selected.id,beforeRestore:retention?.role==='before-restore'});
      if(resuming)OperationDiagnostics.mark('provider-publication-resumed',{provider:selected.id,status:'running'});
      const publishCheckpoint=retention?.role==='before-restore'?RepositoryCheckpointPipeline.publishInline:RepositoryCheckpointPipeline.publish;
      published=await publishCheckpoint(history,{interactive,availableObjectIds,excludedObjectIds:excluded,retention,signal,continuation,shared,baseUpdate:shared||sharingActive()},Object.freeze({
        writeObject:async (entry,prepared)=>{
          requireBackupMutationControl('saving to '+selected.label);await entry.checkProtection?.();
          if(!objectCount){const fresh=prepared.objects.filter(object=>!object.reused);objectCount=fresh.length;totalBytes=fresh.reduce((sum,object)=>sum+object.storedBytes,0);}
          const index=++objectStarted;OperationDiagnostics.mark('provider-object-upload-start',{provider:selected.id,index,count:objectCount,bytes:entry.storedBytes});
          progress(retention?.role==='before-restore'?'safety-upload':'upload',retention?.role==='before-restore'?`Saving safety version in ${selected.label}…`:`Uploading backup data to ${selected.label}…`,{current:objectCompleted,total:objectCount,completedBytes:uploadedBytes,totalBytes});
          const item=repositoryProviderItem(await selected.repository.upload(Object.freeze({kind:'object',id:entry.objectId,name:entry.objectId+'.sdobject',blob:entry.blob,size:entry.storedBytes,digest:entry.storedChecksum,exportedAt:prepared.exportedAt,appVersion:APP_VERSION,checkProtection:entry.checkProtection})),'object');
          await verifyUploadedRepositoryObject(selected,entry,item,{signal,index,count:objectCount,onProgress:progress});uploadedBytes+=entry.storedBytes;objectCompleted+=1;rememberRepositoryObjectReceipt(selected,item);OperationDiagnostics.mark('provider-object-upload-complete',{provider:selected.id,index,count:objectCount,bytes:entry.storedBytes,completed:objectCompleted});
          progress(retention?.role==='before-restore'?'safety-upload':'upload',retention?.role==='before-restore'?`Saving safety version in ${selected.label}…`:`Uploading backup data to ${selected.label}…`,{current:objectCompleted,total:objectCount,completedBytes:uploadedBytes,totalBytes});return item;
        },
        writeManifest:async file=>{
          // An uncommitted manifest is invisible to every reader, so the lease is
          // asserted once, before the commit that makes the version real.
          requireBackupMutationControl('saving to '+selected.label);await file.checkProtection?.();await file.checkSource?.();
          OperationDiagnostics.mark('provider-manifest-upload-start',{provider:selected.id});progress(retention?.role==='before-restore'?'safety-manifest':'manifest',retention?.role==='before-restore'?`Finalizing safety version in ${selected.label}…`:`Uploading and verifying the backup version in ${selected.label}…`);
          const digest=await Exports.run('checksum',{value:file.blob},{signal}),checkpointId=file.manifest.checkpoint.checkpointId;
          // Uploads can reuse committed identities or succeed before their response
          // fails; ownership is uncertain. Only verified maintenance may delete.
          const item=repositoryProviderItem(await selected.repository.upload(Object.freeze({kind:'checkpoint',id:checkpointId,name:checkpointId+'.sdcheckpoint',blob:file.blob,size:file.blob.size,digest,exportedAt:file.exportedAt,appVersion:APP_VERSION,checkProtection:file.checkProtection,checkSource:file.checkSource,historySummary:Object.freeze({format:Number(file.manifest.version)||0,logicalFingerprint:file.manifest.logicalFingerprint,counts:file.manifest.counts,encrypted:file.manifest.encrypted===true,retention:file.manifest.retention,origin:String(file.manifest.installationId||''),attachmentsMissing:(Array.isArray(file.manifest.assets)?file.manifest.assets:[]).filter(asset=>asset?.missing===true).length})})),'checkpoint');
          const verifiedManifest=await verifyUploadedRepositoryManifest(selected,item,file.manifest,digest,signal);await file.checkSource?.();
          const projected=Object.freeze([...history.map(manifest=>Object.freeze({id:manifest.checkpoint.checkpointId,manifest})),Object.freeze({id:verifiedManifest.checkpoint.checkpointId,manifest:verifiedManifest})]);if(RepositoryCheckpointPipeline.selectRetention(projected,{now:new Date(Date.parse(verifiedManifest.exportedAt))}).remove.length)maintenanceNeeded=true;
          rememberVerifiedHistory(selected,item,Object.freeze({kind:'checkpoint',value:verifiedManifest}),item.verificationScope||null);OperationDiagnostics.mark('provider-manifest-upload-complete',{provider:selected.id});return item;
        },
        commit:async marker=>{
          requireBackupMutationControl('saving to '+selected.label);await marker.checkProtection?.();await marker.checkSource?.();if(publicationRenewal)await publicationRenewal.beforeCommit();
          OperationDiagnostics.mark('provider-commit-start',{provider:selected.id});progress(retention?.role==='before-restore'?'safety-commit':'commit',retention?.role==='before-restore'?`Committing safety version in ${selected.label}…`:`Committing and verifying the backup in ${selected.label}…`);
          // A commit might already be visible if its verification fails. Never
          // retract a potentially reused or already-published identity here.
          const item=repositoryProviderItem(await selected.repository.upload(Object.freeze({kind:'commit',id:marker.checkpointId,name:marker.checkpointId+'.sdcommit',blob:marker.blob,size:marker.size,digest:marker.digest,exportedAt:marker.exportedAt,appVersion:APP_VERSION,checkProtection:marker.checkProtection,checkSource:marker.checkSource})),'commit');const verifiedCommit=await verifyUploadedRepositoryCommit(selected,item,marker,signal);await marker.checkSource?.();rememberVerifiedHistory(selected,item,Object.freeze({kind:'commit',value:verifiedCommit}),item.verificationScope||null);OperationDiagnostics.mark('provider-commit-complete',{provider:selected.id});return item;
        },
        onCommitted:async context=>{OperationDiagnostics.mark('provider-checkpoint-committed',{provider:selected.id});RepositoryCheckpointPipeline.markCompleted({copy:{source:selected.id,sourceRevision:context.sourceRevision||context.exportedAt||'',attachmentsComplete:!(context.manifest?.assets||[]).some(item=>item.missing===true)}});restartAutomaticCountdown(publicationOwner,context.sourceRevision||context.exportedAt);progress(retention?.role==='before-restore'?'safety-complete':'complete',retention?.role==='before-restore'?`Safety version saved in ${selected.label}.`:`Finishing ${selected.label} backup…`);return null;},
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
            if(role==='normal')try{if(!await pendingRetryState(publicationOwner))await markPendingRetry(publicationOwner);}finally{schedulePendingProviderBackup(publicationOwner,1000,{trigger:'publication-failure'});}
            return;
          }
          // No receipt here proves creation by this attempt. In particular,
          // an upload may have succeeded before its response failed, and a
          // resumed attempt may have reused an already committed identity.
          // Retention/inventory verification is the only safe deletion path.
          if(deferredMaintenance)await providerMaintenanceScheduler(selected)?.request('failure-cleanup',MAINTENANCE_POLICY.continuationMs,{mode:'earliest'});
        }
      }));
      if(shared&&sessionOwnershipState?.releaseAfterCommit)await settlePublishedSessionClaim(selected,sessionOwnershipState.current,{signal});
    // Cleanup that waited for uploads runs soon after this one ends, unless
    // another device's live upload still holds it; then it keeps its time.
    }finally{if(continuation&&!continuation.status().pending)await discardProviderPublication(publicationOwner);if(publicationLease){const lease=publicationRenewal?await publicationRenewal.stop():publicationLease;publicationLease=null;publicationRenewal=null;OperationDiagnostics.mark('provider-publication-release-start',{provider:selected.id});const released=await endRepositoryPublication(signal&&signal.aborted?publicationOwner:selected,lease);OperationDiagnostics.mark('provider-publication-release-complete',{provider:selected.id,released});if(released&&maintenanceHooks){const pending=await maintenanceState(publicationOwner);if(pending&&String(pending.reason||'')==='publication-contention'&&!maintenanceActionable(pending)&&!(await repositoryPublicationSafety(publicationOwner)).blocked)await providerMaintenanceScheduler(publicationOwner)?.request('repository-state',MAINTENANCE_POLICY.busyMs,{mode:'replace'});}}}
    // A valid commit may still carry intentionally missing attachment bytes.
    // Distinguish that partial recovery from an all-bytes-verified checkpoint.
    const missingAssets=(published?.manifest?.assets||[]).filter(row=>row?.missing===true);
    const missingWarning=missingAssets.length
      ?`Partial attachment recovery: ${missingAssets.length} attachment${missingAssets.length===1?'':'s'} missing. Saved Days and Notes remain recoverable, but these files cannot be restored from this backup.`:'';
    const warning=[String(published&&published.warning||''),String(published&&published.cleanupResult&&published.cleanupResult.warning||''),String(published?.manifest?.warning||''),...(!String(published?.manifest?.warning||'').includes('Partial attachment recovery:')?[missingWarning]:[])].filter(Boolean).join(' '),item=published&&published.publication||{};
    clearRecentHistory(selected);if(role==='normal'&&publicationOwner.shared){syncState(publicationOwner).failed=false;syncState(publicationOwner).syncedAt=new Date().toISOString();}
    return Object.freeze({name:item.name||published.checkpointId,unchanged:published.unchanged===true,checkpointId:published.checkpointId,manifest:published.manifest,warning,maintenancePending:deferredMaintenance&&maintenanceQueued,sourceRevision:published.sourceRevision,requestId:publication?.requestId||String(pendingIntent?.requestedAt||''),objectsWritten:published.objectsWritten,objectsReused:published.objectsReused,writtenBytes:published.writtenBytes,attachmentBytesWritten:published.attachmentBytesWritten});
  }
  // The protected safety version of the device that made checkpointId.
  function activeProtectedProviderRow(state,checkpointId,now=Date.now()){
    const rows=(state&&Array.isArray(state.rows)?state.rows:[]).map(row=>freeze({id:row.item.id,manifest:row.manifest,row})),requested=rows.find(row=>row.id===checkpointId);if(!requested)return null;
    const active=RepositoryCheckpointPipeline.activeProtected(rows,now,String(requested.manifest?.installationId||requested.manifest?.checkpoint?.originInstallationId||''));
    return active&&active.row||null;
  }
  // Removes one version the person chose: this device's safety version, or a
  // version this build cannot read. A fresh scan under the maintenance lease
  // confirms which it is first; any other version is kept. The commit goes
  // first, so an interrupted removal leaves only an unfinished leftover.
  async function removeProviderVersion(selected,checkpointId,{signal=null}={}){
    selected=repositoryOperationSelected(selected,{signal});
    requireBackupMutationControl('removing a version from '+selected.label);
    const requested=String(checkpointId||'');let maintenanceLease=null;
    if(repositoryCoordinationCapable(selected)){
      maintenanceLease=await beginRepositoryMaintenance(selected);
      if(!maintenanceLease)throw new Error(`Removing the version from ${selected.label} was deferred because another backup or maintenance operation is active.`);
    }
    try{
      await assertRepositoryMaintenance(selected,maintenanceLease);
      const state=await repositoryProviderState(selected,{interactive:false,signal}),active=activeProtectedProviderRow(state,requested),safety=!!active&&active.item.id===requested,unreadable=state.unreadable.find(row=>row.id===requested);
      const files=safety?[active.commitItem,active.item].filter(Boolean):unreadable?[...unreadable.items]:null;
      if(!files||!files.length)throw new Error(`The selected version in ${selected.label} is no longer this device's safety version or unreadable, so it was kept.`);
      for(const file of files){await assertRepositoryMaintenance(selected,maintenanceLease);await selected.repository.delete(file);}
      await assertRepositoryMaintenance(selected,maintenanceLease);
      const servicedPending=await maintenanceState(selected,{throwOnError:true}),after=await repositoryProviderState(selected,{interactive:false,signal}),cleanup=await cleanupRepositoryProviderState(selected,after,{maintenanceLease});
      await providerMaintenanceScheduler(selected)?.adopt(cleanup,{trigger:'safety-removal',pending:servicedPending});
      const retained=Array.isArray(cleanup.retained)?cleanup.retained:after.rows.map(row=>Object.freeze({id:row.item.id,ref:Object.freeze({checkpoint:row.item,commit:row.commitItem}),manifest:row.manifest}));
      const quarantinedObjectIds=integrityScrubHooks?await integrityScrubHooks.quarantine(selected.id):[],entries=RepositoryCheckpointPipeline.projectHistory(Object.freeze(retained.map(row=>Object.freeze({id:row.id,manifest:row.manifest}))),Object.freeze({id:selected.id,label:selected.label}),{quarantinedObjectIds});
      clearRecentHistory(selected);
      // The version sync waited on is gone: sync looks again at once.
      if(selected.shared&&syncState(selected).newer===requested){newerVersionGone(selected);syncState(selected).behind=true;schedulePendingProviderBackup(selected,1000,{trigger:'newer-version-removed'});}
      return freeze({removed:true,checkpointId:requested,kind:safety?'safety':'unreadable',gcRemoved:Number(cleanup.gcRemoved)||0,warning:String(cleanup.warning||''),entries});
    }finally{if(maintenanceLease)await endRepositoryMaintenance(selected,maintenanceLease);}
  }
  async function pendingRetryState(selected){
    if(!pendingRetryHooks)return null;
    try{return await pendingRetryHooks.read(selected.id);}catch(error){AppDiagnostics.capture('backup-provider.pending-retry-read',error,'warn');throw error;}
  }
  function resetConvergenceRetry(selected){providerConvergenceRetryAttempts.delete(safeId(selected&&selected.id));presentation.resolve(selected.id,'retry-exhausted');}
  function nextConvergenceRetryDelay(selected,{sync=false}={}){const id=safeId(selected&&selected.id);if(!id)return PROVIDER_CONVERGENCE_RETRY_DELAYS[0];const attempt=Math.max(0,Number(providerConvergenceRetryAttempts.get(id))||0),delay=PROVIDER_CONVERGENCE_RETRY_DELAYS[Math.min(attempt,PROVIDER_CONVERGENCE_RETRY_DELAYS.length-1)];providerConvergenceRetryAttempts.set(id,attempt+1);if(attempt+1>=PROVIDER_CONVERGENCE_RETRY_DELAYS.length)presentation.notice(id,'retry-exhausted',sync?`Syncing with ${selected.label} keeps failing. It keeps trying; reconnect if this stays.`:`Backing up to ${selected.label} keeps failing. Open ${selected.label} settings and choose Back up now, or reconnect.`,{error:true});return delay;}
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
  // Automatic backups. A location this device has backed up to before backs up
  // again on its own while connected: within AUTOMATIC_QUIET_MS of the first
  // change it does not hold, within seconds of a key moment, and shortly
  // before a sign-in that expires runs out. Whether it needs one is the
  // change-time rule: the newest change is later than the change its last
  // backup from this device captured. Nothing is written per change, and
  // changes made while signed out go up on the next sign-in.
  const automaticByProvider=new Map();
  function automaticState(selected){
    const id=safeId(selected&&selected.id);let state=automaticByProvider.get(id);
    if(!state){state={connected:false,noticeShown:false,waitingSince:NaN,urgentSince:NaN};automaticByProvider.set(id,state);}
    return state;
  }
  // A change noted while the app runs is a real edit. Before the first one,
  // a waiting change was found on start or reconnect, and is backed up only
  // when local data is present: an emptied browser must not become a
  // location's newest version.
  let changeNoted=false;
  function automaticCovered(selected){
    let recorded='',baseline='';
    try{recorded=String(automaticHooks?.covered(selected.id)||'');baseline=String(selected.automaticBaseline?.()||'');}catch(error){AppDiagnostics.capture('backup-provider.automatic-covered',error,'warn');}
    const times=[recorded,baseline].map(value=>Date.parse(value)).filter(Number.isFinite);
    return times.length?Math.max(...times):NaN;
  }
  // Signing in to the shared location (Drive) is enough: sync starts at once.
  function automaticEnabled(selected){return !!automaticHooks&&!!selected?.repository&&(selected.shared&&providerConnected(selected)||Number.isFinite(automaticCovered(selected)));}
  function automaticRecoveryDestination(selected){
    if(!automaticHooks||!selected?.repository)return false;
    try{if(selected.automaticConfigured?.()===true)return true;}catch(error){AppDiagnostics.capture('backup-provider.automatic-configured',error,'warn');}
    return automaticEnabled(selected)||connectedOnceByProvider.has(selected.id);
  }
  function automaticNeeded(selected){
    if(!automaticEnabled(selected))return false;
    let current=NaN;try{current=Date.parse(String(automaticHooks.current()||''));}catch(error){AppDiagnostics.capture('backup-provider.automatic-current',error,'warn');}
    const covered=automaticCovered(selected);return Number.isFinite(current)&&(!Number.isFinite(covered)||current>covered);
  }
  // A backup restarts the countdown: changes made while it ran wait a full
  // cadence from its end, except a key moment made after the capture.
  function restartAutomaticCountdown(selected,sourceRevision){
    const at=Date.parse(String(sourceRevision||'')),state=automaticState(selected);
    const waiting=automaticNeeded(selected);state.waitingSince=waiting?Date.now():NaN;
    if(!waiting||!(state.urgentSince>at))state.urgentSince=NaN;
  }
  // When a location's waiting changes are due: AUTOMATIC_QUIET_MS after the
  // first one, sooner after a key moment or before a sign-in runs out. NaN
  // when the waiting changes were found rather than seen (on start or on
  // reconnect): those go at once.
  function automaticDueAt(selected){
    const state=automaticState(selected);if(!Number.isFinite(state.waitingSince))return NaN;
    let due=state.waitingSince+AUTOMATIC_QUIET_MS,expiresAt=NaN;
    if(Number.isFinite(state.urgentSince))due=Math.min(due,state.urgentSince+AUTOMATIC_URGENT_MS);
    try{expiresAt=Number(selected.connectionExpiresAt?.());}catch(error){AppDiagnostics.capture('backup-provider.connection-expiry',error,'warn');}
    if(Number.isFinite(expiresAt)&&expiresAt>0)due=Math.min(due,expiresAt-AUTOMATIC_EXPIRY_LEAD_MS);
    return due;
  }
  function automaticOpportunityUnspent(selected,eligibleAt=Date.now()){
    const deadline=automaticDueAt(selected),at=Number(eligibleAt);
    return automaticNeeded(selected)&&Number.isFinite(deadline)&&Number.isFinite(at)&&deadline>at+50;
  }
  function scheduleAutomaticBackup(selected,{urgent=false}={}){
    if(!automaticNeeded(selected)||!providerConnected(selected))return false;
    const job=providerConvergenceJob(selected);if(!job)return false;
    const state=automaticState(selected),now=Date.now();
    if(!Number.isFinite(state.waitingSince))state.waitingSince=now;
    if(urgent&&!Number.isFinite(state.urgentSince))state.urgentSince=now;
    return job.schedule(Math.max(0,automaticDueAt(selected)-now),urgent?'important-change':'automatic','earliest');
  }
  function noteChange(change={}){
    const urgent=change&&change.urgent===true;changeNoted=true;
    for(const selected of providers.values())scheduleAutomaticBackup(selected,{urgent});
    notifyStatus();return true;
  }
  // Back up waiting changes now (the app going to the background, an update
  // about to apply) at every connected location that needs it.
  function automaticWaiting(selected){return providerConnected(selected)&&automaticNeeded(selected);}
  function flushAutomatic(reason='flush'){return Promise.all([...providers.values()].filter(automaticWaiting).map(selected=>providerConvergenceJob(selected)?.run('flush:'+String(reason||'flush'))||null));}
  // A sign-in ends on its own (Drive's lasts about an hour). Someone who backs
  // up to this location is told once, in a toast they can dismiss, and not
  // again until they sign in and it ends again. Anyone else is never told.
  function connectionChanged(selected){
    const state=automaticState(selected),connected=providerConnected(selected),was=state.connected;state.connected=connected;
    if(selected.hosted)return;
    if(connected){connectedOnceByProvider.add(selected.id);state.noticeShown=false;presentation.resolve(selected.id,'permission');return;}
    if(!was||state.noticeShown||!automaticEnabled(selected))return;
    state.noticeShown=true;presentation.notice(selected.id,'permission',`${selected.label} sign-in expired.`);
  }
  // Sync with the shared location (Drive), which holds what every device last
  // shared. While signed in, this device first takes in what other devices
  // added there (catching up), then backs up. A backup that finds Drive moved
  // on meanwhile stops, and the next run catches up first; two devices
  // backing up at once take turns. Sync never asks anything: where both
  // sides changed something the newer shows and the other is kept for review
  // (Library → Data). Only a version it cannot settle that way (an older
  // format, or more kept versions than may wait) waits, marked Needs review,
  // until the person opens it.
  // Waiting for another device's upload asks again after 15 seconds, then a
  // minute, then every five minutes, up to the turn window.
  const SYNC_RECHECK_MS=60*1000,SYNC_TURN_WINDOW_MS=15*60*1000,SYNC_TURN_RETRY_DELAYS=freeze([15*1000,60*1000,5*60*1000]),syncByProvider=new Map();
  function syncState(selected){const id=safeId(selected&&selected.id);let state=syncByProvider.get(id);if(!state){state={checkedAt:0,review:'',password:'',newer:'',catching:false,behind:false,failed:false,rolledBack:null,syncedAt:'',turnWaits:0};syncByProvider.set(id,state);}return state;}
  function syncView(selected){const state=syncState(selected);return freeze({syncedAt:state.syncedAt,review:!!state.review,password:!!state.password,newer:!!state.newer,failed:!!state.failed,syncing:state.catching,turnWaits:Math.max(0,Number(state.turnWaits)||0)});}
  function sharedSyncing(selected){return !!selected?.shared&&!!selected.repository&&!!pendingRetryHooks&&providerConnected(selected);}
  function sharingActive(){return [...providers.values()].some(sharedSyncing);}
  // Drive's newest ordinary version, when this device has not taken it in.
  // Drive's newest version when this device has not taken it in yet. One
  // this build cannot read (from a newer Study Director, or damaged) comes
  // back marked unreadable: sync waits on it and never uploads over it, since
  // a device that can read it would take an upload without its changes as
  // newer than them.
  async function sharedAhead(inventory,selected=null){
    let head=null;for(const pair of inventory&&inventory.pairs||[])if(pair.item.history?.retention?.role!=='before-restore')head=pair;
    if(!head)return null;const base=await RepositoryCheckpointPipeline.sharedBase();
    if(head.item.id===String(base&&base.checkpointId||''))return null;
    const unreadable=head.item.unreadable===true||!!(selected&&unreadableByProvider.get(selected.id)?.has(head.item.id));
    return unreadable?freeze({...head,unreadable:true}):head;
  }
  function markUnreadable(selected,id){
    const known=new Set(unreadableByProvider.get(selected.id)||[]);known.add(String(id));unreadableByProvider.set(selected.id,known);
  }
  // Sync stops at a version this build cannot read until the app is updated
  // or the person removes that version in Version History.
  function waitForNewerVersion(selected,id){
    const state=syncState(selected);if(state.newer===id)return false;state.newer=id;
    presentation.notice(selected.id,'sync-newer',`${selected.label} has a version this app can’t read, from a newer Study Director or damaged. Sync waits until the app is updated, or until you remove that version in Version History.`);
    notifyStatus();return true;
  }
  function newerVersionGone(selected){
    const state=syncState(selected);if(!state.newer)return false;state.newer='';presentation.resolve(selected.id,'sync-newer');notifyStatus();return true;
  }
  function syncCheckDue(selected,trigger){
    if(!sharedSyncing(selected))return false;
    // A catch-up that failed or was cancelled, or an upload that found Drive
    // moved on, looks again on the next run, whatever woke it.
    if(syncState(selected).behind)return true;
    const reason=String(trigger||''),since=Date.now()-syncState(selected).checkedAt;
    if(['connection','registered','sync'].includes(reason)||reason.startsWith('flush:'))return true;
    return since>=(['activation','resume','foreground-released','session-watch'].includes(reason)?SYNC_RECHECK_MS:AUTOMATIC_QUIET_MS);
  }
  // Not after a failed catch-up: that one waits for its retry.
  function syncRecheckDue(selected,trigger){
    if(!['activation','resume','foreground-released','session-watch'].includes(String(trigger||''))||!sharedSyncing(selected))return false;
    const state=syncState(selected);return !state.behind&&!state.catching&&Date.now()-state.checkedAt>=SYNC_RECHECK_MS;
  }
  function syncError(code,message){const error=new Error(message);error.code=code;error.studyDirectorDriveNoRetry=true;return error;}
  function repositorySessionClaimCapable(selected){return !!(selected&&selected.repository&&selected.repository.listSessionClaims&&selected.repository.uploadSessionClaim&&selected.repository.downloadSessionClaim&&selected.repository.deleteSessionClaim);}
  function sessionClaimId(epoch){const value=Number(epoch);if(!Number.isSafeInteger(value)||value<1)throw new TypeError('Active-session ownership epoch is invalid.');return 'sc_'+value.toString(16).padStart(16,'0');}
  function sessionClaimEpoch(id){const match=/^sc_([a-f0-9]{16})$/u.exec(String(id||''));if(!match)return 0;const value=Number.parseInt(match[1],16);return Number.isSafeInteger(value)&&value>0?value:0;}
  async function sessionClaimToken(kind,value,{signal=null}={}){
    const label=String(kind||''),text=String(value||'');if(!['session','owner'].includes(label)||!text)throw new TypeError('Active-session ownership token input is invalid.');
    const digest=await Exports.run('checksum',{value:new Blob([SESSION_CLAIM_FORMAT+'|'+label+'|'+text],{type:'text/plain'})},{signal});
    if(!SESSION_CLAIM_TOKEN_PATTERN.test(String(digest||'')))throw new Error('Active-session ownership token could not be derived safely.');
    return String(digest);
  }
  function normalizeSessionClaim(value){
    if(!value||typeof value!=='object'||Array.isArray(value))return null;
    const keys=Object.keys(value).sort().join('|');
    if(Number(value.version)!==SESSION_CLAIM_VERSION||keys!=='claimedAt|epoch|format|observedOwnerToken|observedRevision|ownerToken|revision|sessionToken|state|version')return null;
    const epoch=Number(value.epoch),revision=Number(value.revision),observedRevision=Number(value.observedRevision),state=String(value.state||''),claimedAt=String(value.claimedAt||''),sessionToken=String(value.sessionToken||''),ownerToken=String(value.ownerToken||''),observedOwnerToken=String(value.observedOwnerToken||'');
    if(value.format!==SESSION_CLAIM_FORMAT||!Number.isSafeInteger(epoch)||epoch<1||!Number.isSafeInteger(revision)||revision<1||!Number.isSafeInteger(observedRevision)||observedRevision<1||!['owned','released'].includes(state)||!Number.isFinite(Date.parse(claimedAt))||!SESSION_CLAIM_TOKEN_PATTERN.test(sessionToken)||!SESSION_CLAIM_TOKEN_PATTERN.test(ownerToken)||!SESSION_CLAIM_TOKEN_PATTERN.test(observedOwnerToken))return null;
    return freeze({format:SESSION_CLAIM_FORMAT,version:SESSION_CLAIM_VERSION,sessionToken,epoch,state,ownerToken,revision,observedOwnerToken,observedRevision,claimedAt:new Date(claimedAt).toISOString()});
  }
  function normalizePlainSessionClaim(value){
    if(!value||typeof value!=='object'||Array.isArray(value))return null;
    const version=Number(value.version),keys=Object.keys(value).sort().join('|'),v1=version===1&&keys==='claimedAt|date|epoch|format|observedRevision|owner|version',v2=version===2&&keys==='claimedAt|date|epoch|format|observedOwner|observedRevision|owner|revision|state|version';
    if(!v1&&!v2)return null;
    const date=String(value.date||''),epoch=Number(value.epoch),owner=String(value.owner||''),observedOwner=v1?owner:String(value.observedOwner||''),observedRevision=Number(value.observedRevision),revision=v1?observedRevision+1:Number(value.revision),state=v1?'owned':String(value.state||''),claimedAt=String(value.claimedAt||'');
    if(value.format!==SESSION_CLAIM_FORMAT||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u.test(date)||!Number.isSafeInteger(epoch)||epoch<1||!SESSION_OWNER_PATTERN.test(owner)||!SESSION_OWNER_PATTERN.test(observedOwner)||!Number.isSafeInteger(observedRevision)||observedRevision<1||!Number.isSafeInteger(revision)||revision<1||!['owned','released'].includes(state)||!Number.isFinite(Date.parse(claimedAt)))return null;
    return freeze({date,epoch,state,owner,revision,observedOwner,observedRevision,claimedAt:new Date(claimedAt).toISOString()});
  }
  async function decodeSessionClaim(value,{signal=null}={}){
    const current=normalizeSessionClaim(value);if(current)return current;
    const legacy=normalizePlainSessionClaim(value);if(!legacy)return null;
    const [sessionToken,ownerToken,observedOwnerToken]=await Promise.all([sessionClaimToken('session',legacy.date,{signal}),sessionClaimToken('owner',legacy.owner,{signal}),sessionClaimToken('owner',legacy.observedOwner,{signal})]);
    return freeze({format:SESSION_CLAIM_FORMAT,version:SESSION_CLAIM_VERSION,sessionToken,epoch:legacy.epoch,state:legacy.state,ownerToken,revision:legacy.revision,observedOwnerToken,observedRevision:legacy.observedRevision,claimedAt:legacy.claimedAt});
  }
  async function readRepositorySessionClaim(selected,{signal=null}={}){
    if(!repositorySessionClaimCapable(selected))return null;
    const listed=await selected.repository.listSessionClaims(freeze({signal})),rows=Array.isArray(listed)?listed:Array.isArray(listed&&listed.items)?listed.items:[],invalid=Math.max(0,Number(listed&&listed.ignored)||0)+(listed&&listed.overflow===true?1:0);
    if(invalid)throw syncError('REPOSITORY_SESSION_CLAIM_UNCERTAIN','Active-session ownership state in the shared repository could not be verified safely.');
    let latest=null,latestEpoch=0;
    for(const raw of rows){const item=repositoryProviderItem(raw,'session-claim'),epoch=sessionClaimEpoch(item.id);if(!epoch)throw syncError('REPOSITORY_SESSION_CLAIM_UNCERTAIN','Active-session ownership state has an invalid identity.');if(epoch>latestEpoch){latest=item;latestEpoch=epoch;}}
    if(!latest)return null;
    const lease=repositoryDownloadLease(await selected.repository.downloadSessionClaim(latest,freeze({signal})));let decoded=null;
    try{
      if(lease.blob.size<=0||lease.blob.size>SESSION_CLAIM_MAX_BYTES||latest.size&&lease.blob.size!==latest.size)throw syncError('REPOSITORY_SESSION_CLAIM_UNCERTAIN','Active-session ownership state changed size unexpectedly.');
      const digest=await Exports.run('checksum',{value:lease.blob},{signal});
      if(latest.digest&&latest.digest!==digest||latest.serverDigest&&latest.serverDigest!==digest)throw syncError('REPOSITORY_SESSION_CLAIM_UNCERTAIN','Active-session ownership state failed content verification.');
      decoded=await Exports.unprotect(lease.blob,{interactive:false,signal});
      if(!decoded||!(decoded.blob instanceof Blob))throw syncError('REPOSITORY_SESSION_CLAIM_UNCERTAIN','Active-session ownership state could not be opened safely.');
      let parsed=null;try{parsed=JSON.parse(await decoded.blob.text());}catch{}
      const claim=await decodeSessionClaim(parsed,{signal});if(!claim||sessionClaimId(claim.epoch)!==latest.id)throw syncError('REPOSITORY_SESSION_CLAIM_UNCERTAIN','Active-session ownership state is malformed.');
      return freeze({claim,item:latest});
    }finally{
      if(decoded&&decoded.blob instanceof Blob&&decoded.blob!==lease.blob)await Exports.run('file.release',{file:decoded.blob}).catch(()=>{});
      await lease.release().catch(()=>{});
    }
  }
  async function writeRepositorySessionClaim(selected,claim,{signal=null,interactive=false}={}){
    const normalized=normalizeSessionClaim(claim);if(Number(claim&&claim.version)!==SESSION_CLAIM_VERSION||!normalized||normalized.version!==SESSION_CLAIM_VERSION)throw new TypeError('Active-session ownership claim is invalid.');
    const id=sessionClaimId(normalized.epoch),source=new Blob([JSON.stringify(normalized)],{type:'application/json'});let protectedFile=null;
    try{
      protectedFile=await Exports.protect({blob:source,filename:id+'.sdsessionclaim'},{interactive,signal});
      if(!protectedFile||!(protectedFile.blob instanceof Blob)||protectedFile.blob.size<=0||protectedFile.blob.size>SESSION_CLAIM_MAX_BYTES)throw new Error('Active-session ownership claim is too large.');
      await protectedFile.checkProtection?.();
      const digest=await Exports.run('checksum',{value:protectedFile.blob},{signal}),item=repositoryProviderItem(await selected.repository.uploadSessionClaim(freeze({kind:'session-claim',id,name:id+'.sdsessionclaim',blob:protectedFile.blob,size:protectedFile.blob.size,digest,exportedAt:normalized.claimedAt,appVersion:APP_VERSION,knownAbsent:true,checkProtection:protectedFile.checkProtection})),'session-claim');
      await protectedFile.checkProtection?.();
      if(item.digest!==digest||item.serverDigest&&item.serverDigest!==digest)throw syncError('REPOSITORY_SESSION_CLAIM_UNCERTAIN','The shared repository did not verify the active-session ownership claim.');
      const verified=await readRepositorySessionClaim(selected,{signal});if(!verified||verified.item.id!==id||JSON.stringify(verified.claim)!==JSON.stringify(normalized))throw syncError('REPOSITORY_SESSION_CLAIM_UNCERTAIN','The active-session ownership claim could not be read back exactly.');
      return verified;
    }finally{if(protectedFile&&protectedFile.blob instanceof Blob&&protectedFile.blob!==source)await Exports.run('file.release',{file:protectedFile.blob}).catch(()=>{});}
  }
  async function assertSharedPublicationTurn(selected,publicationLease){
    if(!publicationLease||!repositoryPublicationCapable(selected))return true;
    const listed=await selected.repository.listPublications(),rows=Array.isArray(listed)?listed:Array.isArray(listed&&listed.items)?listed.items:[],began=row=>Date.parse(String(row&&(row.startedAt||row.createdAt)||'')),mine=began(publicationLease);
    if(rows.some(row=>{const id=String(row&&row.id||''),at=began(row);return id!==publicationLease.id&&!ownPublications.has(id)&&row.sameDevice!==true&&Number.isFinite(at)&&Date.now()-at<SYNC_TURN_WINDOW_MS&&(at<mine||at===mine&&id<publicationLease.id);}))throw syncError('REPOSITORY_SYNC_TURN',`Another device is saving to ${selected.label}.`);
    return true;
  }
  async function localSessionOwnership(){
    if(!sessionOwnershipHooks)return null;
    const raw=await sessionOwnershipHooks.read(),today=String(sessionOwnershipHooks.today()||'');
    if(raw===null||raw===undefined)return freeze({today,value:null});
    const date=String(raw.date||''),runningOn=String(raw.runningOn||''),revision=Number(raw.revision);
    if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u.test(date)||!SESSION_OWNER_PATTERN.test(runningOn)||!Number.isSafeInteger(revision)||revision<1)throw new Error('Canonical Active Session ownership state is invalid.');
    return freeze({today,value:freeze({date,runningOn,revision})});
  }
  async function projectSessionClaim(current,{signal=null}={}){
    if(!current)return null;
    const local=await localSessionOwnership(),claim=current.claim,me=String(sessionOwnershipHooks&&sessionOwnershipHooks.installationId()||''),ownerToken=me?await sessionClaimToken('owner',me,{signal}):'';
    let applies=false;if(local?.value)applies=await sessionClaimToken('session',local.value.date,{signal})===claim.sessionToken;else if(local?.today)applies=await sessionClaimToken('session',local.today,{signal})===claim.sessionToken;
    return freeze({epoch:claim.epoch,state:claim.state,revision:claim.revision,observedRevision:claim.observedRevision,claimedAt:claim.claimedAt,ownedHere:!!ownerToken&&ownerToken===claim.ownerToken,applies});
  }
  // Drive's newest claim names this device for the session running here. A
  // sync then keeps that session even when the version it brings in, saved
  // before this device took over, still names the other device. Unknown
  // counts as no: the sync then settles the session as before.
  async function sessionClaimedHere(selected,{signal=null}={}){
    if(!sessionOwnershipHooks||!repositorySessionClaimCapable(selected))return false;
    try{
      const local=await localSessionOwnership(),me=String(sessionOwnershipHooks.installationId()||'');
      if(!local?.value||!me||local.value.runningOn!==me)return false;
      const claim=await projectSessionClaim(await readRepositorySessionClaim(repositoryOperationSelected(selected,{signal}),{signal}),{signal});
      return !!claim&&claim.state==='owned'&&claim.ownedHere&&claim.applies;
    }catch(error){if(!signal?.aborted)AppDiagnostics.capture('backup-provider.sync-session-claim',error,'warn');return false;}
  }
  async function assertSharedSessionOwnership(selected,{signal=null}={}){
    if(!sessionOwnershipHooks||!repositorySessionClaimCapable(selected))return freeze({current:null,releaseAfterCommit:false});
    const current=await readRepositorySessionClaim(selected,{signal});if(!current)return freeze({current:null,releaseAfterCommit:false});
    const local=await localSessionOwnership(),claim=current.claim;
    if(local?.today&&await sessionClaimToken('session',local.today,{signal})!==claim.sessionToken||claim.state==='released')return freeze({current,releaseAfterCommit:false});
    if(local?.value){
      const [sessionToken,ownerToken]=await Promise.all([sessionClaimToken('session',local.value.date,{signal}),sessionClaimToken('owner',local.value.runningOn,{signal})]);
      if(sessionToken===claim.sessionToken&&ownerToken===claim.ownerToken&&local.value.revision>=claim.revision)return freeze({current,releaseAfterCommit:false});
    }
    if(!local?.value&&await sessionClaimToken('owner',sessionOwnershipHooks.installationId(),{signal})===claim.ownerToken)return freeze({current,releaseAfterCommit:true});
    throw syncError('REPOSITORY_SESSION_OWNERSHIP_AHEAD',`Today’s Active Session is owned by another device in ${selected.label}; this device must take in that ownership before publishing.`);
  }
  async function settlePublishedSessionClaim(selected,current,{signal=null}={}){
    if(!current||current.claim.state==='released')return false;
    const attemptRevision=canonicalConvergenceRevision();
    try{
      const claim=current.claim,released=freeze({format:SESSION_CLAIM_FORMAT,version:SESSION_CLAIM_VERSION,sessionToken:claim.sessionToken,epoch:claim.epoch+1,state:'released',ownerToken:claim.ownerToken,revision:claim.revision,observedOwnerToken:claim.ownerToken,observedRevision:claim.revision,claimedAt:new Date().toISOString()});
      await writeRepositorySessionClaim(selected,released,{signal});return true;
    }catch(error){
      AppDiagnostics.capture('backup-provider.session-claim-settle',error,'warn');
      const owner=providers.get(safeId(selected&&selected.id))||selected;
      try{if(pendingRetryHooks){if(!await pendingRetryState(owner))await markPendingRetry(owner);schedulePendingProviderBackup(owner,PROVIDER_CONVERGENCE_BUSY_RETRY_MS,{attemptRevision,trigger:'session-claim-settle'});}}catch(retryError){AppDiagnostics.capture('backup-provider.session-claim-settle-retry',retryError,'warn');}
      return false;
    }
  }

  // Take in Drive's newest version quietly. What it cannot settle on its own
  // waits for the person; their Combine of that version resumes the sync.
  function catchUpSharedProvider(selected,head,attemptRevision=canonicalConvergenceRevision(),{preserveAutomatic=false}={}){
    const state=syncState(selected);if(state.catching)return false;state.catching=true;notifyStatus();
    setTimeout(async()=>{
      const summary=presentation.begin(selected.id,'sync',{id:'external-sync',label:selected.label,foreground:false,message:`Syncing with ${selected.label}…`});
      try{settleCatchUp(selected,head.item.id,await syncRepositoryProvider(selected.id,{checkpointId:head.item.id,presentation:summary,respectBackgroundSuspension:true}),summary,attemptRevision,{preserveAutomatic});}
      catch(error){
        // Another device set or changed the backup password: sync waits for it.
        if(['BACKUP_LOCKED','BACKUP_AUTH_FAILED'].includes(String(error?.code||''))){state.password=head.item.id;summary.finish({message:`${selected.label} needs this profile’s backup password.`,outcome:'sync-password'});presentation.notice(selected.id,'sync-password',`Your backup password was set or changed on another device. Enter it to keep syncing with ${selected.label}.`);}
        // A version this build cannot read is not retried: sync waits on it.
        else if(error?.repositoryUnreadable===true||String(error?.code||'')==='BACKUP_ENCRYPTION_UNSUPPORTED'){markUnreadable(selected,head.item.id);summary.finish({message:`${selected.label} has a version this app can’t read.`,outcome:'sync-newer'});waitForNewerVersion(selected,head.item.id);}
        else{
          AppDiagnostics.capture('backup-provider.sync-catch-up',error,'warn');state.behind=true;state.failed=true;summary.finish({message:`Syncing with ${selected.label} will retry.`,lifecycle:'failed'});
          // A restore that failed and rolled back fails the same way until
          // Drive or the backoff moves on; its own rollback is not a new edit.
          const delay=nextConvergenceRetryDelay(selected,{sync:true});state.rolledBack=/^restore-/u.test(String(error?.backupStage||''))?freeze({head:head.item.id,retryAt:Date.now()+delay}):null;
          schedulePendingProviderBackup(selected,delay,{backoff:true,attemptRevision,preserveAutomatic,trigger:'catch-up-failed'});
        }
      }
      finally{state.catching=false;notifyStatus();}
    },0);
    return true;
  }
  function settleCatchUp(selected,headId,result,summary,attemptRevision='',{preserveAutomatic=false}={}){
    const state=syncState(selected);
    if(result&&result.cancelled&&result.reason==='needs-decision'){state.review=headId;summary?.finish({message:`${selected.label} has changes that need your review.`,outcome:'sync-review'});presentation.notice(selected.id,'sync-review',`${selected.label} has changes from another device that need your review.`,{tier:'news'});}
    else if(result&&result.cancelled){state.behind=true;summary?.finish({message:`Syncing with ${selected.label} will retry.`,lifecycle:'cancelled'});schedulePendingProviderBackup(selected,PROVIDER_CONVERGENCE_BUSY_RETRY_MS,{attemptRevision,preserveAutomatic,trigger:'catch-up-cancelled'});}
    else{state.review='';state.password='';state.failed=false;state.rolledBack=null;state.syncedAt=new Date().toISOString();resetConvergenceRetry(selected);presentation.resolve(selected.id,'sync-review');presentation.resolve(selected.id,'sync-password');summary?.finish({message:`Synced with ${selected.label}.`,outcome:'sync-complete'});if(automaticWaiting(selected))schedulePendingProviderBackup(selected,1000,{trigger:'catch-up-complete'});}
  }
  // The person enters the password the newest version needs; the sync then
  // takes that version in and keeps the password for this device.
  async function unlockSync(id){
    const selected=providers.get(safeId(id));if(!selected||!selected.shared)return freeze({cancelled:true,reason:'unavailable'});
    const state=syncState(selected),head=state.password;if(!head||state.catching)return freeze({cancelled:true,reason:head?'busy':'none'});
    state.catching=true;notifyStatus();
    try{const result=await syncRepositoryProvider(selected.id,{checkpointId:head,password:true});settleCatchUp(selected,head,result,null);return result;}
    finally{state.catching=false;notifyStatus();}
  }
  // Open the versions that need review in the Combine dialog.
  async function reviewSync(id){
    const selected=providers.get(safeId(id));if(!selected||!selected.shared)return freeze({cancelled:true,reason:'unavailable'});
    const head=syncState(selected).review;if(!head)return freeze({cancelled:true,reason:'none'});
    const result=await bringInRepositoryProvider(selected.id,{checkpointId:head,review:true});
    if(result&&!result.cancelled){syncState(selected).review='';presentation.resolve(selected.id,'sync-review');}
    return result;
  }
  // Each backup location publishes the canonical local state independently.
  // Drive is the shared synchronization repository; Device Folder is a separate
  // destination and never waits for, downloads from, or backfills from Drive.
  async function retryPendingProviderBackup(selected,{signal=null}={}){
    const pending=await pendingRetryState(selected),resuming=providerPublications.get(selected.id)?.continuation.status().pending===true;if(!pending&&!resuming&&!automaticNeeded(selected))return freeze({status:'idle',reason:'none',maintenancePending:false});
    if(!pending&&!resuming&&!changeNoted&&automaticHooks?.ready&&await automaticHooks.ready()===false)return freeze({status:'idle',reason:'local-empty',maintenancePending:false});
    const summary=presentation.begin(selected.id,'backup',{id:'external-backup',label:selected.label,foreground:false,message:`Backing up to ${selected.label}…`});
    notifyStatus();
    try{
      const saved=await saveRepositoryProvider(selected,{interactive:false,signal,preemptBackground:false,pendingIntent:pending,recoveryProgress:value=>summary.update({message:value.message,progress:value})}),covered=publicationCoversPending(saved,pending),cleared=covered&&(!pending||await clearPendingRetry(selected,pending));
      summary.finish({message:cleared?`Backed up to ${selected.label}.`:covered?`Backed up to ${selected.label}; its status updates shortly.`:`Backed up to ${selected.label}; newer changes back up next.`,outcome:cleared?'external-backup-verified':'external-backup-pending'});
      return freeze({status:cleared?'completed':'pending',checkpointId:String(saved&&saved.checkpointId||saved&&saved.name||''),reason:cleared?'':covered?'retry marker could not be cleared':'source',maintenancePending:saved&&saved.maintenancePending===true});
    }catch(error){
      const code=String(error&&error.code||''),turn=code==='REPOSITORY_SYNC_TURN',behind=code==='REPOSITORY_SYNC_BEHIND',sessionAhead=code==='REPOSITORY_SESSION_OWNERSHIP_AHEAD',newer=code==='REPOSITORY_SYNC_NEEDS_UPDATE'||code==='STUDY_DIRECTOR_SHARE_HELD';
      summary.finish({message:newer?`Sync with ${selected.label} waits for an app update.`:behind?`Catching up with ${selected.label} first.`:sessionAhead?'Taking in the Active Session owner from the other device first.':turn?`Another device is saving to ${selected.label}; this backup goes next.`:'External backup update is pending.',lifecycle:signal?.aborted||behind||sessionAhead||turn||newer?'cancelled':'failed',outcome:'external-backup-pending'});
      if(!behind&&!sessionAhead&&!turn&&!newer)AppDiagnostics.capture('backup-provider.pending-retry',error,'warn');
      return freeze({status:'pending',reason:newer?'needs-update':behind?'behind':sessionAhead?'session-owner':turn?'turn':String(error&&error.message||error)});
    }finally{notifyStatus();}
  }
  // Opaque canonical timestamps are compared for *change*, not ordering:
  // the attempted revision must not govern a newer edit's urgent deadline.
  function canonicalConvergenceRevision(){
    try{const value=String(automaticHooks?.current?.()||'');return Number.isFinite(Date.parse(value))?value:'';}
    catch(error){AppDiagnostics.capture('backup-provider.canonical-revision',error,'warn');return '';}
  }
  function providerConvergenceJob(selected){
    if(!selected?.repository||!pendingRetryHooks)return null;const id=safeId(selected.id);
    let job=providerConvergenceJobs.get(id);if(job)return job;const background=providerBackground(selected);
    job=background.registerJob('convergence',{isAvailable:()=>{const available=providerBackgroundAvailability(selected),saved=providerPublications.get(id)?.continuation.status();return available===true&&saved?.pending&&saved.role==='before-restore'?'awaiting-foreground':available;},retryMs:PROVIDER_CONVERGENCE_RETRY_DELAYS[0],capture:error=>AppDiagnostics.capture('backup-provider.convergence-lifecycle',error,'warn'),execute:async({trigger,nextEligibleAt:eligibleAt})=>{
      let scope=null,traceId='';
      const attemptRevision=canonicalConvergenceRevision(),eligibleMs=Date.parse(String(eligibleAt||'')),preserveAutomatic=automaticOpportunityUnspent(selected,Number.isFinite(eligibleMs)?eligibleMs:Date.now());
      try{
        const owed=!!await pendingRetryState(selected)||providerPublications.get(selected.id)?.continuation.status().pending===true,syncDue=syncCheckDue(selected,trigger),sync=sharedSyncing(selected)?syncState(selected):null;
        if(sync)job.schedule(AUTOMATIC_QUIET_MS,'sync','earliest');
        if(!owed&&!automaticNeeded(selected)&&!syncDue){resetConvergenceRetry(selected);return freeze({status:'idle',reason:'none'});}
        // Any other wake-up before the waiting changes are due keeps their
        // deadline; Drive asking the Device Folder to go first does not.
        const due=automaticDueAt(selected),now=String(trigger||'').startsWith('flush:');
        if(!owed&&!syncDue&&!now&&due>Date.now()+50){job.schedule(due-Date.now(),'automatic','earliest');return freeze({status:'idle',reason:'not-due'});}
        if(busy||sync?.catching){schedulePendingProviderBackup(selected,PROVIDER_CONVERGENCE_BUSY_RETRY_MS,{trigger:'provider-busy'});return freeze({status:'deferred',reason:'busy'});}
        scope=await background.beginBackground('convergence',{budgetMs:0,preemptCode:'REPOSITORY_BACKGROUND_PREEMPTED',preemptMessage:'An automatic backup yielded to a foreground operation.'});
        if(!scope){schedulePendingProviderBackup(selected,PROVIDER_CONVERGENCE_BUSY_RETRY_MS,{trigger:'background-busy'});return freeze({status:'deferred',reason:'background-busy'});}
        traceId=OperationDiagnostics.start('provider-convergence',selected.label,{provider:selected.id,background:true,trigger:String(trigger||'scheduled'),nextEligibleAt:eligibleAt,actionable:true});
        OperationDiagnostics.mark('background-transition',background.transition('convergence','scheduled','running',{reason:String(trigger||'scheduled'),nextEligibleAt:eligibleAt,actionable:true}),traceId);
        OperationDiagnostics.mark('convergence-eligibility',{provider:selected.id,nextEligibleAt:eligibleAt,actionable:true},traceId);
        // Catch up before backing up: Drive's newest version comes in first.
        // A backup due now checks this itself, so a separate look is only
        // for a check with nothing to back up, after Drive moved on, or
        // while a review waits.
        if(sync&&(sync.behind||sync.review||!owed&&!automaticNeeded(selected))){
          sync.behind=false;
          const inventory=await repositoryProviderInventory(repositoryOperationSelected(selected,{signal:scope.signal}),{signal:scope.signal});rememberRecentHistory(selected,inventory);sync.checkedAt=Date.now();
          const ahead=await sharedAhead(inventory,selected),finish=(status,reason)=>{OperationDiagnostics.mark('background-transition',background.transition('convergence','running',status,{reason,actionable:false}),traceId);OperationDiagnostics.finish({status,reason},traceId);return freeze({status,reason});};
          if(ahead?.unreadable){waitForNewerVersion(selected,ahead.item.id);return finish('idle','needs-update');}
          newerVersionGone(selected);
          const held=sync.rolledBack;
          if(ahead&&sync.review!==ahead.item.id&&held&&held.head===ahead.item.id&&!now&&Date.now()+50<held.retryAt){sync.behind=true;job.schedule(held.retryAt-Date.now(),'catch-up-failed','earliest');return finish('deferred','catch-up-failed');}
          if(ahead&&sync.review!==ahead.item.id){scope.release();scope=null;catchUpSharedProvider(selected,ahead,attemptRevision,{preserveAutomatic});return finish('deferred','catching-up');}
          if(ahead)return finish('idle','needs-review');
          if(sync.review){sync.review='';presentation.resolve(selected.id,'sync-review');}
          sync.failed=false;sync.rolledBack=null;sync.syncedAt=new Date().toISOString();notifyStatus();
          if(!owed&&!automaticNeeded(selected)){resetConvergenceRetry(selected);return finish('completed','in-sync');}
        }
        OperationDiagnostics.mark('convergence-publication-start',{provider:selected.id},traceId);const result=await retryPendingProviderBackup(selected,{signal:scope.signal});{const state=syncState(selected);state.turnWaits=result.reason==='turn'?state.turnWaits+1:0;}OperationDiagnostics.mark('convergence-publication-complete',{provider:selected.id,status:String(result.status||''),maintenancePending:result.maintenancePending===true},traceId);OperationDiagnostics.mark('background-transition',background.transition('convergence','running',result.status==='completed'?'completed':'deferred',{reason:String(result.reason||''),actionable:false}),traceId);OperationDiagnostics.finish({status:String(result.status||'pending'),reason:String(result.reason||''),maintenancePending:result.maintenancePending===true},traceId);
        if(result.status==='completed'){resetConvergenceRetry(selected);background.wake('publication');scheduleAutomaticBackup(selected);}
        else if(['none','local-empty'].includes(result.reason))resetConvergenceRetry(selected);
        // Waiting for an app update is not a failure: no retry ladder, and the
        // regular check looks again (removing that version wakes it sooner).
        else if(result.reason==='needs-update'){resetConvergenceRetry(selected);schedulePendingProviderBackup(selected,AUTOMATIC_QUIET_MS,{backoff:true,attemptRevision,trigger:'needs-update'});}
        // Drive moved on, or another device is backing up there: catch up or take turns.
        else if(['behind','turn'].includes(result.reason)){if(sync&&result.reason==='behind')sync.behind=true;const turns=syncState(selected).turnWaits;schedulePendingProviderBackup(selected,result.reason==='behind'?1000:SYNC_TURN_RETRY_DELAYS[Math.min(Math.max(0,turns-1),SYNC_TURN_RETRY_DELAYS.length-1)],{backoff:result.reason==='turn',attemptRevision,preserveAutomatic,trigger:result.reason==='turn'?'sync-turn':'shared-behind'});}
        else if(result.reason==='source'){resetConvergenceRetry(selected);if(!scheduleAutomaticBackup(selected))schedulePendingProviderBackup(selected,AUTOMATIC_QUIET_MS,{trigger:'source-changed'});}
        else schedulePendingProviderBackup(selected,scope.signal.aborted?PROVIDER_CONVERGENCE_BUSY_RETRY_MS:nextConvergenceRetryDelay(selected),{backoff:!scope.signal.aborted,attemptRevision,preserveAutomatic,trigger:scope.signal.aborted?'background-preempted':'retry-failure'});
        return result;
      }catch(error){
        const preempted=scope?.signal.aborted&&error?.name==='AbortError';
        if(!traceId)traceId=OperationDiagnostics.start('provider-convergence',selected.label,{provider:selected.id,background:true,trigger:String(trigger||'scheduled'),nextEligibleAt:eligibleAt,actionable:true});
        OperationDiagnostics.mark('background-transition',background.transition('convergence',scope?'running':'scheduled',preempted?'deferred':'failed',{reason:preempted?String(error?.code||'background-yield'):'unavailable',actionable:false}),traceId);
        if(preempted)OperationDiagnostics.finish({status:'pending',reason:String(error?.code||'background-yield')},traceId);
        else{OperationDiagnostics.fail(error,{background:true,status:'unavailable'},traceId);AppDiagnostics.capture('backup-provider.pending-retry-background',error,'warn');}
        // A failed read is unknown, not absence. The next bounded opportunity
        // checks the durable marker again; do not read it again in this handler.
        schedulePendingProviderBackup(selected,preempted?PROVIDER_CONVERGENCE_BUSY_RETRY_MS:nextConvergenceRetryDelay(selected),{backoff:!preempted,attemptRevision,preserveAutomatic,trigger:preempted?'background-preempted':'state-read-failed'});
        return freeze({status:'unavailable',reason:preempted?'preempted':'state-read-failed'});
      }finally{scope?.release();}
    }});providerConvergenceJobs.set(id,job);return job;
  }
  // Backoff supersedes urgency for the *same* failed revision, but must not
  // push back a higher-priority request for a newer canonical revision.
  // A missing revision is treated conservatively as the same failed work.
  function schedulePendingProviderBackup(selected,delay=1000,{backoff=false,attemptRevision='',preserveAutomatic=false,trigger='pending-retry'}={}){
    const job=providerConvergenceJob(selected);
    if(!job)return false;
    const newer=backoff&&attemptRevision&&canonicalConvergenceRevision()!==attemptRevision;
    const preserve=automaticNeeded(selected)&&(preserveAutomatic===true||backoff&&automaticOpportunityUnspent(selected));
    // A failure may replace only the opportunity it actually attempted.
    // Scheduler eligibility owns this decision, so late async settlement cannot
    // consume an automatic deadline that became due while earlier sync ran.
    if(newer||preserve)scheduleAutomaticBackup(selected,{urgent:Number.isFinite(automaticState(selected).urgentSince)});
    return job.schedule(Math.max(1000,Number(delay)||1000),String(trigger||'pending-retry'),backoff&&!newer&&!preserve?'replace':'earliest')!==false;
  }
  function wakeProviderBackground(selected,trigger='eligibility'){
    if(!selected?.repository)return false;
    try{
      // Declare every job before the owner reconciles eligibility and intent.
      providerMaintenanceScheduler(selected);providerIntegrityScheduler(selected);const job=providerConvergenceJob(selected);
      const woke=providerBackground(selected).wake(trigger);
      // Coming back to the app a minute or more after the last check looks
      // at Drive now; a wake keeps an already scheduled run where it is.
      if(woke&&job&&syncRecheckDue(selected,trigger))job.schedule(0,String(trigger),'earliest');
      return woke;
    }catch(error){AppDiagnostics.capture('backup-provider.background-configuration',error,'error');return false;}
  }
  // After a successful recovery, explicitly queue every other automatic
  // location while recovery still holds the background suspension. Their
  // existing convergence jobs arm when that suspension is released, so every
  // destination independently publishes the resulting canonical local state.
  async function queueOtherLocations(selected){
    const out=[];
    for(const other of providers.values()){
      if(other.id===selected.id||!automaticRecoveryDestination(other))continue;
      const retryQueued=await markPendingRetry(other),scheduled=retryQueued&&schedulePendingProviderBackup(other,1000,{trigger:'managed-recovery-peer'});
      out.push(freeze({id:other.id,label:other.label,shared:other.shared===true,status:retryQueued?'pending':'failed',queued:retryQueued,scheduled:scheduled===true,connected:providerConnected(other)}));
    }
    return freeze(out);
  }
  async function queueResolvedProviderState(selected,result,{sourceNeeded=true,sourceCheckpoint=''}={}){
    if(!result||result.cancelled)return freeze({source:freeze({status:'skipped',reason:'cancelled'}),others:freeze([])});
    let source;
    if(sourceNeeded){
      const retryQueued=await markPendingRetry(selected),scheduled=retryQueued&&schedulePendingProviderBackup(selected,1000,{trigger:'managed-recovery'});
      source=freeze({status:retryQueued?'pending':'failed',reason:retryQueued?(scheduled?'scheduled':'managed-recovery'):'automatic retry could not be queued',retryQueued,scheduled:scheduled===true,shared:selected.shared===true});
    }else{
      providerBackground(selected).clearScheduled('convergence');
      await clearPendingRetry(selected);
      if(automaticNeeded(selected)){
        const retryQueued=await markPendingRetry(selected),scheduled=retryQueued&&schedulePendingProviderBackup(selected,1000,{trigger:'managed-recovery-source-current'});
        source=freeze({status:retryQueued?'pending':'failed',checkpoint:String(sourceCheckpoint||''),reason:retryQueued?(scheduled?'scheduled':'managed-recovery'):'automatic retry could not be queued',unchanged:false,retryQueued,scheduled:scheduled===true,shared:selected.shared===true});
      }else source=freeze({status:'completed',checkpoint:String(sourceCheckpoint||''),unchanged:true,retryQueued:false,scheduled:false,shared:selected.shared===true});
    }
    return freeze({source,others:await queueOtherLocations(selected)});
  }
  async function managedProviderPresent(selected,result,{sourceNeeded=true,sourceCheckpoint=''}={}){
    const convergence=await queueResolvedProviderState(selected,result,{sourceNeeded,sourceCheckpoint}),sourceReady=convergence.source.status==='completed'||convergence.source.status==='pending'&&(convergence.source.retryQueued===true||convergence.source.scheduled===true),peerFailed=convergence.others.find(row=>row.queued!==true),ready=sourceReady&&!peerFailed;
    const reason=ready?'':!sourceReady?[convergence.source.reason||`${selected.label} backup could not be queued`,convergence.source.retryQueued!==true?'automatic retry could not be queued':''].filter(Boolean).join(' · '):`${peerFailed.label} automatic backup retry could not be recorded.`;
    return freeze({status:ready?'completed':'pending',reason,checkpointId:String(convergence.source.checkpoint||''),source:convergence.source,others:convergence.others});
  }
  function repositoryObjectInventoryForManifest(inventory,manifest){
    if(!inventory||inventory.overflow===true)throw new Error('An unusual number of backup objects was found. Recovery was stopped for review.');
    const byId=new Map((inventory.items||[]).map(item=>[item.id,item]));
    for(const entry of manifest.objects||[]){const item=byId.get(entry.objectId);if(!item||item.size&&item.size!==entry.storedBytes||item.digest&&item.digest!==entry.storedChecksum)throw new Error(`Repository object ${entry.objectId} is missing or its metadata no longer matches the selected version.`);}
    return freeze({byId,invalid:Math.max(0,Number(inventory.invalidCount)||0)});
  }
  async function loadRepositoryProvider(selected,operation,{checkpointId='',mode='bring-in',onProgress=null,note='',missingOnly=false,before='',quiet=false,sync=false,review=false,password=false}={}){
    if(!['bring-in','restore-version'].includes(mode))throw new TypeError('Unsupported managed repository recovery mode.');
    // Every restore names its version (Version History, sync, recovery at
    // start); only adding what is missing finds its own.
    if(!checkpointId&&!missingOnly)throw new Error('Choose a version to restore. Nothing was changed.');
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
    let chosenId=String(checkpointId||'');
    // Without a chosen version, adding what is missing uses the newest ordinary
    // version saved before the given time (the browser-data clear).
    if(!checkpointId&&missingOnly){
      const beforeMs=Date.parse(before),source=newest.find(pair=>{const summary=pair.item.history;return summary&&summary.retention?.role!=='before-restore'&&(!Number.isFinite(beforeMs)||Date.parse(summary.exportedAt)<beforeMs);});
      if(!source)return null;chosenId=source.item.id;
    }
    // A failure to read the chosen version before anything here changes may be
    // this location's alone; Version History then reads it from another
    // location that holds it (repositoryReadFailed).
    let applying=false;const readFailure=error=>{if(!applying&&error&&typeof error==='object'&&error.name!=='AbortError'&&Object.isExtensible(error)&&!['PROVIDER_FOREGROUND_CANCELLED','STUDY_DIRECTOR_IMPORT_CANCELLED','BACKUP_LOCKED'].includes(String(error.code||'')))error.repositoryReadFailed=true;return error;};
    const pair=newest.find(candidate=>candidate.item.id===chosenId);if(!pair)throw readFailure(new Error('The selected backup version is no longer available.'));
    // Only Drive's own freshly verified newest ordinary version can become the
    // shared reconciliation base. Device Folder has an independent checkpoint
    // history and never impersonates Drive ancestry.
    const ordinary=candidate=>candidate.item.history?.retention?.role!=='before-restore',whole=mode==='bring-in'&&!note&&!missingOnly,newestOf=listed=>!listed.overflow&&[...listed.pairs].reverse().find(ordinary)?.item.id===pair.item.id;
    const sharedHead=whole&&selected.shared===true&&newestOf(inventory)&&(!reusedHistory||newestOf(await repositoryProviderInventory(selected,{signal:operation.signal})));
    OperationDiagnostics.mark('checkpoint-selected',{provider:selected.id});
    progress('verify',`Verifying selected backup in ${selected.label}…`);
    const verificationTask=(async()=>{OperationDiagnostics.mark('selected-checkpoint-verification-start',{provider:selected.id});const row=await verifyRepositoryInventoryPair(selected,pair,{interactive:!quiet||password,signal:operation.signal,fresh:true}).catch(error=>{if(error?.repositoryUnreadable===true)unreadableByProvider.set(providerSelected.id,new Set([...(unreadableByProvider.get(providerSelected.id)||[]),pair.item.id]));throw readFailure(error);});OperationDiagnostics.mark('selected-checkpoint-verification-complete',{provider:selected.id,objects:Number(row.manifest.objects&&row.manifest.objects.length)||0});return row;})();
    const inventoryTask=(async()=>{OperationDiagnostics.mark('recovery-object-inventory-start',{provider:selected.id});const value=await repositoryObjectInventory(selected,{signal:operation.signal}).catch(error=>{throw readFailure(error);});OperationDiagnostics.mark('recovery-object-inventory-complete',{provider:selected.id,objects:value.items.length,invalid:value.invalidCount,overflow:value.overflow===true});return value;})();
    const quarantineTask=integrityScrubHooks?integrityScrubHooks.quarantine(selected.id):Promise.resolve([]);
    const [row,listedObjects,quarantineRows]=await Promise.all([verificationTask,inventoryTask,quarantineTask]),quarantinedObjectIds=repositoryProviderObjectIds(quarantineRows),quarantined=new Set(quarantinedObjectIds);
    // The library's password follows the newest version: one another device
    // set or changed (typed here for this version) is kept for this device's
    // versions; one it removed (its version is plain although it built on an
    // encrypted one) is removed here too.
    if(sync&&sharedHead){const ancestors=new Set(row.manifest.reconciliationAncestorIds||[]),removedElsewhere=row.manifest.encrypted!==true&&inventory.pairs.some(other=>ancestors.has(other.item.id)&&other.item.history?.encrypted===true);await Exports.followProtection(freeze({protectionId:String(row.manifest.protectionId||''),encrypted:row.manifest.encrypted===true,removedElsewhere}));}
    const objectInventory=repositoryObjectInventoryForManifest(listedObjects,row.manifest),needed=new Set((row.manifest.objects||[]).map(entry=>entry.objectId)),total=needed.size,totalDownloadBytes=(row.manifest.objects||[]).reduce((sum,entry)=>sum+Math.max(0,Number(entry&&entry.storedBytes)||0),0),downloadSlots=new Map(),downloadProgressBytes=new Map();let started=0,completed=0;
    if((row.manifest.objects||[]).some(entry=>quarantined.has(entry.objectId)))throw readFailure(new Error('The selected backup version references an object that is quarantined after an integrity check. Choose another version or create a fresh backup.'));
    progress('inventory',`Preparing selected backup data from ${selected.label}…`);
    // A one-note read fetches a few of the version's objects, so whole-version totals would mislead.
    const downloadProgress=details=>progress('download',note?`Reading this note from ${selected.label}…`:`Downloading backup data from ${selected.label}…`,note?{}:details);
    const readObject=async entry=>{
      const item=objectInventory.byId.get(entry.objectId);if(!item)throw readFailure(new Error(`Repository object ${entry.objectId} is unavailable.`));
      let index=downloadSlots.get(entry.objectId);if(!index){index=++started;downloadSlots.set(entry.objectId,index);downloadProgressBytes.set(entry.objectId,0);OperationDiagnostics.mark('provider-object-download-start',{provider:selected.id,index,count:total,bytes:entry.storedBytes});}
      const aggregateBytes=()=>Math.min(totalDownloadBytes,[...downloadProgressBytes.values()].reduce((sum,value)=>sum+Math.max(0,Number(value)||0),0));
      downloadProgress({current:completed,total,active:index,completedBytes:aggregateBytes(),totalBytes:totalDownloadBytes});
      const result=await selected.repository.download(item,freeze({signal:operation.signal,onProgress:value=>{const loaded=Math.max(0,Number(value&&value.loaded)||0),bytes=Math.max(1,Number(value&&value.total)||Number(entry.storedBytes)||1);downloadProgressBytes.set(entry.objectId,Math.min(bytes,loaded));downloadProgress({current:completed,total,active:index,completedBytes:aggregateBytes(),totalBytes:totalDownloadBytes});}})).catch(error=>{throw readFailure(error);});
      downloadProgressBytes.set(entry.objectId,Math.max(0,Number(entry.storedBytes)||0));completed+=1;OperationDiagnostics.mark('provider-object-download-complete',{provider:selected.id,index,count:total,bytes:entry.storedBytes,completed});downloadProgress({current:completed,total,completedBytes:aggregateBytes(),totalBytes:totalDownloadBytes});return result;
    };
    if(!managedRecoveryHooks)throw new Error('Managed recovery transaction coordination is unavailable.');
    const repositorySnapshot=freeze({history:freeze([row.manifest]),availableObjectIds:freeze([...objectInventory.byId.keys()]),inventory,invalidCount:inventory.invalid.length});
    const managedRecovery=transaction=>managedRecoveryHooks.run(freeze({
      kind:sync?'sync':mode,label:selected.label,keepsActiveSession:!!note||missingOnly||sync||review,apply:async()=>{applying=true;progress('apply',sync?`Taking in changes from ${selected.label}…`:mode==='bring-in'?'Combining data locally…':'Applying selected backup locally…');const result=await transaction.apply();progress('verify-local','Verifying restored local data…');return result;},
      createSafety:sync?null:async()=>{
        applying=true;OperationDiagnostics.mark('external-safety-publication-start',{provider:selected.id});
        progress('safety',`Creating safety version in ${selected.label}…`);
        const safetyPurpose=mode==='bring-in'?'before-combine':'before-restore';
        const saved=await saveRepositoryProvider(selected,{retention:{role:'before-restore',purpose:safetyPurpose},signal:operation.signal,preemptBackground:false,foregroundPriority:true,recoveryProgress:onProgress,repositorySnapshot});
        const checkpoint=String(saved&&saved.checkpointId||''),retention=saved&&saved.manifest&&saved.manifest.retention,protectedUntil=Date.parse(retention&&retention.protectedUntil||'');
        if(!checkpoint||retention?.role!=='before-restore'||!Number.isFinite(protectedUntil)||protectedUntil<=Date.now()){const error=new Error(`The protected Before restore safety version in ${selected.label} was not saved safely.`);error.code='STUDY_DIRECTOR_RECOVERY_SAFETY_INVALID';OperationDiagnostics.mark('external-safety-publication-failed',{provider:selected.id,errorCode:error.code});throw error;}
        OperationDiagnostics.mark('external-safety-publication-complete',{provider:selected.id});
        return freeze({verified:true,checkpointId:checkpoint,protectedUntil:new Date(protectedUntil).toISOString(),sourceRevision:String(saved&&saved.sourceRevision||saved&&saved.manifest&&saved.manifest.sourceRevision||''),source:selected.id});
      },
      // Drive takes a restored older version as its newest at the next
      // upload, so the other devices get it too.
      publishPresent:async result=>{progress('finalize','Finalizing recovery…');return managedProviderPresent(providerSelected,result,{sourceNeeded:mode==='bring-in'||selected.shared===true,sourceCheckpoint:mode==='restore-version'?row.item.id:''});}
    }));
    return RepositoryCheckpointPipeline.inspect(row.manifest,readObject,{interactive:!quiet,signal:operation.signal,committed:true,sharedHead,managedRecovery,managedProgress:onProgress,...(note&&mode==='bring-in'?{note}:{})});
  }
  // A protected safety version before a destructive action (Clear Library).
  // It is written in the foreground, preempting background work.
  async function createProtectedSafety(id,purpose='before-clear-library',options={}){
    const selected=providers.get(safeId(id));if(!selected||!selected.repository)return freeze({verified:false,skipped:true,reason:'unavailable'});
    if(!['before-restore','before-combine','before-clear-library'].includes(String(purpose)))throw new TypeError('Protected safety purpose is invalid.');
    if(busy)return freeze({verified:false,skipped:true,reason:'busy'});
    if(!providerConnected(selected))return freeze({verified:false,skipped:true,reason:'not-connected'});
    const foreground=beginForeground(selected,options&&options.signal||null);if(!foreground)return freeze({verified:false,skipped:true,reason:'busy'});busy=true;
    try{
      await foreground.settled;
      const saved=await saveRepositoryProvider(selected,{interactive:true,retention:{role:'before-restore',purpose},signal:foreground.signal,preemptBackground:false,foregroundPriority:true});
      const retention=saved&&saved.manifest&&saved.manifest.retention,protectedUntil=Date.parse(retention&&retention.protectedUntil||'');
      if(!saved?.checkpointId||retention?.role!=='before-restore'||!Number.isFinite(protectedUntil)||protectedUntil<=Date.now())throw new Error(`The safety version in ${selected.label} could not be verified.`);
      return freeze({verified:true,checkpointId:saved.checkpointId,protectedUntil:new Date(protectedUntil).toISOString(),sourceRevision:String(saved.sourceRevision||''),source:selected.id,purpose:String(purpose)});
    }finally{busy=false;foreground.release();}
  }
  async function removeRepositoryProviderVersion(id,checkpointId){
    if(busy)return freeze({removed:false,reason:'busy'});
    const selected=providers.get(safeId(id));if(!selected||!selected.repository)throw new Error('Backup location is unavailable.');
    const foreground=beginForeground(selected);if(!foreground)return freeze({removed:false,reason:'busy'});busy=true;
    try{
      await foreground.settled;if(selected.prepare)await selected.prepare();await authorize(selected,'remove-version');
      return await removeProviderVersion(selected,checkpointId,{signal:foreground.signal});
    }catch(error){await providerMaintenanceScheduler(selected)?.request('error',MAINTENANCE_POLICY.errorMs,{mode:'replace'});throw error;}
    finally{await release(selected,'remove-version');busy=false;foreground.release();}
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
    // Integrity scrub is read-only. Verify every committed version we can prove
    // valid even when unrelated incomplete/orphan publication debris exists.
    // An incomplete listing is different: we cannot prove which committed
    // versions exist, so that remains fail-closed. Destructive maintenance has
    // its own stricter anomaly gates and is deliberately unchanged here.
    if(state.overflow)throw new Error('Repository history could not be listed completely; integrity verification is unavailable.');
    const actualScope=typeof selected.repository.scope==='function'?String(await selected.repository.scope()||''):'';
    if(options.repositoryScope&&options.repositoryScope!==actualScope){const error=new Error('The backup repository changed.');error.code='REPOSITORY_CHANGED';throw error;}
    const history=Object.freeze(state.rows.map(row=>row.manifest));
    const anomalousHistory=Math.max(0,Number(state.ignored)||0)+Number(state.invalid?.length||0)+Number(state.uncommitted?.length||0)+Number(state.orphanCommits?.length||0)+Number(state.unreadable?.length||0);
    if(!history.length&&anomalousHistory)throw new Error('No committed backup version could be verified from the repository history.');
    if(!history.length)return Object.freeze({complete:true,cursor:'',checked:0,checkedBytes:0,total:0,quarantined:Object.freeze([])});
    const readObject=entry=>selected.repository.download(Object.freeze({kind:'object',id:entry.objectId,size:entry.storedBytes,digest:entry.storedChecksum}),Object.freeze({signal:options&&options.signal||null}));
    const readRange=async(entry,range)=>selected.repository.download(Object.freeze({kind:'object',id:entry.objectId,size:entry.storedBytes,digest:entry.storedChecksum}),Object.freeze({...range,signal:options&&options.signal||null}));
    // Where the location reports its own checksum for each stored object
    // (Drive), verification compares it instead of downloading the object.
    const listed=await selected.repository.list(Object.freeze({kind:'object',signal:options&&options.signal||null})),digests=new Map();
    for(const raw of Array.isArray(listed)?listed:Array.isArray(listed?.items)?listed.items:[]){const item=repositoryProviderItem(raw,'object');if(item.serverDigest)digests.set(item.id,item.serverDigest);}
    try{return await RepositoryCheckpointPipeline.scrub(history,readObject,{...options,readRange,storedDigest:entry=>digests.get(entry.objectId)||''});}
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
  // covered(id): the change time the last backup from this device to that
  // location captured ('' when it never had one). current(): the newest change.
  // ready(): optional; false while local data is empty (see changeNoted).
  function configureAutomaticBackup(config=null){
    if(config===null){automaticHooks=null;return true;}
    if(!config||typeof config!=='object'||typeof config.covered!=='function'||typeof config.current!=='function'||config.ready!==undefined&&typeof config.ready!=='function')throw new TypeError('Automatic backup hooks are invalid.');
    automaticHooks=freeze({covered:config.covered,current:config.current,ready:config.ready||null});for(const selected of providers.values())wakeProviderBackground(selected,'configured');return true;
  }
  function configureSessionOwnership(config=null){
    if(config===null){sessionOwnershipHooks=null;return true;}
    if(!config||typeof config!=='object'||typeof config.installationId!=='function'||typeof config.read!=='function'||typeof config.today!=='function')throw new TypeError('Active-session ownership hooks are invalid.');
    sessionOwnershipHooks=freeze({installationId:config.installationId,read:config.read,today:config.today});return true;
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

  function suspendBackground(reason='pwa-update',{preserveManagedSync=false}={}){
    // The sync initiating managed recovery must survive its own background
    // hold. Other holds (PWA update, file backup, storage reset) still abort it.
    const retained=preserveManagedSync===true&&reason==='sync'&&foregroundView()?.kind==='sync'?foregroundController:null;
    const retainedProvider=retained?foregroundView()?.providerId:'';
    const held=[...providers.values()].filter(selected=>selected.repository).map(selected=>{
      const coordinator=providerBackground(selected);return {coordinator,suspension:coordinator.suspend(reason,{preserveForegroundController:selected.id===retainedProvider?retained:null})};
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
      intent,budgetMs:0,budgetCode:'REPOSITORY_MAINTENANCE_BUDGET',budgetMessage:'Repository cleanup completed a protected work unit and will continue shortly.',preemptCode:'REPOSITORY_BACKGROUND_PREEMPTED',preemptMessage:'Repository maintenance yielded to a higher-priority backup operation.',
      capture:(phase,error)=>AppDiagnostics.capture('backup-provider.repository-maintenance-'+phase,error,'warn'),
      isAvailable:()=>providerBackgroundAvailability(selected),
      isBusy:()=>busy,
      execute:({signal,workBudget})=>cleanupRepositoryProviderSafely(selected,{signal,workBudget,traceId}),
      report:event=>{
        const phase=String(event&&event.phase||'');
        if(phase==='running'){
          traceId=OperationDiagnostics.start('provider-maintenance',selected.label,{provider:selected.id,background:true,trigger:String(event.reason||'scheduled'),requestedAt:String(event.requestedAt||''),nextEligibleAt:String(event.nextEligibleAt||''),actionable:true});
          if(event.transition)OperationDiagnostics.mark('background-transition',event.transition,traceId);OperationDiagnostics.mark('maintenance-eligibility',{provider:selected.id,reason:String(event.reason||'scheduled'),requestedAt:String(event.requestedAt||''),nextEligibleAt:String(event.nextEligibleAt||''),actionable:true},traceId);notifyStatus();return;
        }
        if(phase==='cleanup-start'){OperationDiagnostics.mark('maintenance-cleanup-start',{provider:selected.id},traceId);return;}
        if(phase==='cleanup-complete'){
          OperationDiagnostics.mark('maintenance-cleanup-complete',{provider:selected.id,...background.maintenanceDetails(event)},traceId);return;
        }
        if(['pending','completed','yielded','failed'].includes(phase)){
          if(event.transition)OperationDiagnostics.mark('background-transition',event.transition,traceId);
          if(phase==='failed'&&event.error)OperationDiagnostics.fail(event.error,{background:true,reason:String(event.reason||'error'),nextEligibleAt:String(event.nextEligibleAt||'')},traceId);
          else OperationDiagnostics.finish(background.maintenanceDetails(event),traceId);
          traceId='';notifyStatus();
        }
      }
    }));providerMaintenanceSchedulers.set(id,scheduler);return scheduler;
  }
  function providerIntegrityScheduler(selected){
    if(!selected||!selected.repository||!integrityScrubHooks)return null;const id=safeId(selected.id);if(!id)return null;selected=registeredProvider(selected);
    let scheduler=providerIntegritySchedulers.get(id);if(scheduler)return scheduler;const background=providerBackground(selected);
    scheduler=background.createIntegrityScheduler(freeze({
      budgetMs:background.integrity.workBudgetMs,budgetCode:'REPOSITORY_INTEGRITY_BUDGET',budgetMessage:'Backup integrity verification reached its work limit and will continue later.',
      preemptCode:'REPOSITORY_BACKGROUND_PREEMPTED',preemptMessage:'Backup integrity verification yielded to a higher-priority operation.',
      capture:error=>AppDiagnostics.capture('backup-provider.repository-integrity-background',error,'warn'),
      readTarget:()=>integrityScrubHooks.readTarget(id),
      writeResult:result=>integrityScrubHooks.writeResult(id,result),
      isAvailable:()=>{const local=integrityScrubHooks.isAvailable(id);return local===true?providerBackgroundAvailability(selected):String(local||'awaiting-control');},
      isUnsafe:()=>busy||integrityScrubHooks.isUnsafe(id)===true,
      yieldTask:()=>integrityScrubHooks.yieldTask(),
      execute:async({target,trigger,nextEligibleAt,signal,checkpoint})=>{
        const prepared=await integrityScrubHooks.prepare(id,target,freeze({trigger,nextEligibleAt}));if(!prepared)return freeze({status:'skipped',reason:'unavailable'});const options=freeze({...prepared,signal,onProgress:async progress=>{await prepared.onProgress?.(progress);checkpoint(progress);}});
        const traceId=OperationDiagnostics.start('provider-integrity',selected.label,{provider:id,background:true,trigger:String(trigger||'awaiting-connection'),nextEligibleAt:String(nextEligibleAt||''),cursor:String(options.cursor||''),actionable:true});
        OperationDiagnostics.mark('background-transition',background.transition('integrity','scheduled','running',{reason:String(trigger||'awaiting-connection'),nextEligibleAt:String(nextEligibleAt||''),actionable:true}),traceId);
        notifyStatus();
        try{const result=await runConfiguredIntegrityScrub(selected,options),to=background.outcome(result);OperationDiagnostics.mark('background-transition',background.transition('integrity','running',to,{reason:background.integrityDetails(result).reason,actionable:false}),traceId);OperationDiagnostics.finish(background.integrityDetails(result),traceId);return result;}
        catch(error){OperationDiagnostics.mark('background-transition',background.transition('integrity','running','failed',{reason:'error',actionable:false}),traceId);OperationDiagnostics.fail(error,{background:true},traceId);throw error;}
        finally{notifyStatus();}
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
    const saved=await saveRepositoryProvider(selected,{...saveOptions,pendingIntent:pending});presentation.condition(selected.id,'permission','');if(pendingRead&&publicationCoversPending(saved,pending))await clearPendingRetry(selected,pending);else schedulePendingProviderBackup(selected,1000,{trigger:'pending-intent-still-open'});return saved;
  }
  async function loadRepositoryProviderCandidate(id,operation,options={}){
    const selected=providers.get(safeId(id));if(!selected||!selected.repository)throw new Error('Repository backup provider is unavailable.');
    return loadRepositoryProvider(selected,operation,options);
  }
  // Every foreground operation starts the same way: background work on this
  // location yields first, then the location prepares and asks for access.
  async function enterForeground(selected,foreground,traceId,{prepare=false,authorizeAs=''}={}){
    OperationDiagnostics.mark('provider-background-preemption-start',{provider:selected.id},traceId);await foreground.settled;OperationDiagnostics.mark('provider-background-preemption-complete',{provider:selected.id},traceId);
    if(prepare)if(selected.prepare){OperationDiagnostics.mark('provider-prepare-start',{provider:selected.id},traceId);await selected.prepare();OperationDiagnostics.mark('provider-prepare-complete',{provider:selected.id},traceId);}
    if(authorizeAs){OperationDiagnostics.mark('provider-authorization-start',{provider:selected.id},traceId);await authorize(selected,authorizeAs);OperationDiagnostics.mark('provider-authorization-complete',{provider:selected.id},traceId);}
  }
  // The outcome line of a Combine or a restore, and what the other locations
  // still have to do.
  function presentRecovery(selected,kind,result){
    const convergence=result&&result.managedRecovery&&result.managedRecovery.present||freeze({status:'pending',source:freeze({status:'failed',reason:'post-operation backup status unavailable'}),others:freeze([])});
    const sourceReady=convergence.source&&(convergence.source.status==='completed'||convergence.source.status==='pending'&&(convergence.source.retryQueued===true||convergence.source.scheduled===true));
    const finalMessage=presentation.outcome(kind,selected.label,convergence,result&&result.summary);statusText(finalMessage,sourceReady);finishForegroundView(selected,{message:finalMessage,ok:true});
    return convergence;
  }
  // A Combine or a restore that stopped: says why, and whether anything was
  // already written or rolled back. Returns whether it was cancelled.
  function presentRecoveryFailure(selected,label,error){
    const committed=error&&error.studyDirectorCommittedDescription?` ${error.studyDirectorCommittedDescription}; completed changes were not rolled back.`:'';
    const rolledBack=error&&error.studyDirectorRollbackDescription?` ${error.studyDirectorRollbackDescription}`:'';
    const message=userProviderMessage(error,'The selected backup could not be verified safely.'),cancelled=error&&error.code==='STUDY_DIRECTOR_IMPORT_CANCELLED';
    const finalMessage=`${label} ${cancelled?'cancelled':'failed'}: ${message}${committed}${rolledBack}`;statusText(finalMessage,cancelled);finishForegroundView(selected,{message:finalMessage,ok:cancelled,lifecycle:cancelled?'cancelled':'failed'});
    return cancelled;
  }
  async function historyRepositoryProvider(id,options={}){
    const selected=providers.get(safeId(id));
    if(!selected||!selected.repository)return Object.freeze({sourceId:safeId(id),sourceLabel:'',available:false,reason:'unavailable',entries:Object.freeze([])});
    if(busy)return Object.freeze({sourceId:selected.id,sourceLabel:selected.label,available:false,reason:'busy',entries:Object.freeze([])});
    const traceId=OperationDiagnostics.start('provider-history',selected.label,{provider:selected.id,interactive:options&&options.interactive!==false}),foreground=beginForeground(selected,options&&options.signal||null);
    if(!foreground){OperationDiagnostics.finish({status:'skipped',reason:'busy'},traceId);return Object.freeze({sourceId:selected.id,sourceLabel:selected.label,available:false,reason:'busy',entries:Object.freeze([])});}
    beginForegroundView(selected,'history',`Reading backup versions from ${selected.label}…`,options.presentation);busy=true;setBusy(true);
    try{
      await enterForeground(selected,foreground,traceId,{prepare:true,authorizeAs:options&&options.interactive!==false?'history':''});
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
      if(foregroundView()&&foregroundView().providerId===selected.id)finishForegroundView(selected);await release(selected,'history');busy=false;setBusy(false);foreground.release();
    }
  }

  async function claimSessionOwnership(id='google-drive',request={}){
    if(busy)return freeze({status:'busy',reason:'busy'});
    const selected=providers.get(safeId(id));if(!selected||!selected.shared||!providerConnected(selected))return freeze({status:'unavailable',reason:'not-connected'});
    if(!repositorySessionClaimCapable(selected))return freeze({status:'unavailable',reason:'unavailable'});
    const date=String(request&&request.date||''),observedOwner=String(request&&request.observedOwner||''),observedRevision=Number(request&&request.observedRevision),revision=Number(request&&request.revision),owner=String(sessionOwnershipHooks&&sessionOwnershipHooks.installationId()||'');
    if(!sessionOwnershipHooks||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u.test(date)||!SESSION_OWNER_PATTERN.test(observedOwner)||!SESSION_OWNER_PATTERN.test(owner)||!Number.isSafeInteger(observedRevision)||observedRevision<1||!Number.isSafeInteger(revision)||revision<=observedRevision)throw new TypeError('Active-session takeover request is invalid.');
    const foreground=beginForeground(selected,request&&request.signal||null);if(!foreground)return freeze({status:'busy',reason:'busy'});
    setBusy(true);let publicationLease=null;
    try{
      await foreground.settled;const scoped=repositoryOperationSelected(selected,{signal:foreground.signal});await synchronizeRepositoryScope(scoped);
      publicationLease=await beginRepositoryPublication(scoped);await assertSharedPublicationTurn(scoped,publicationLease);
      const [current,sessionToken,ownerToken,observedOwnerToken]=await Promise.all([readRepositorySessionClaim(scoped,{signal:foreground.signal}),sessionClaimToken('session',date,{signal:foreground.signal}),sessionClaimToken('owner',owner,{signal:foreground.signal}),sessionClaimToken('owner',observedOwner,{signal:foreground.signal})]);
      if(current&&current.claim.sessionToken===sessionToken&&current.claim.state==='owned'&&current.claim.ownerToken===ownerToken&&current.claim.observedOwnerToken===observedOwnerToken&&current.claim.observedRevision===observedRevision&&current.claim.revision>=revision)return freeze({status:'completed',claim:current.claim,reused:true});
      if(current&&current.claim.sessionToken===sessionToken&&current.claim.state==='released'&&current.claim.revision>=observedRevision)throw syncError('REPOSITORY_SESSION_CLAIM_STALE','The shared Active Session has already ended. Sync before starting it again.');
      if(current&&current.claim.sessionToken===sessionToken&&current.claim.state==='owned'&&(current.claim.ownerToken!==observedOwnerToken||current.claim.revision>observedRevision))throw syncError('REPOSITORY_SESSION_CLAIM_STALE','Active Session ownership changed on another device before this takeover could be confirmed.');
      const epoch=Math.max(0,Number(current&&current.claim&&current.claim.epoch)||0)+1,claim=freeze({format:SESSION_CLAIM_FORMAT,version:SESSION_CLAIM_VERSION,sessionToken,epoch,state:'owned',ownerToken,revision,observedOwnerToken,observedRevision,claimedAt:new Date().toISOString()}),verified=await writeRepositorySessionClaim(scoped,claim,{signal:foreground.signal,interactive:true});
      return freeze({status:'completed',claim:verified.claim,reused:false});
    }finally{if(publicationLease)await endRepositoryPublication(selected,publicationLease);await release(selected,'session-claim');setBusy(false);foreground.release();}
  }
  async function releaseSessionClaim(id='google-drive',claim=null){
    if(busy)return false;
    const selected=providers.get(safeId(id));if(!selected||!selected.shared||!providerConnected(selected)||!repositorySessionClaimCapable(selected))return false;
    const expected=normalizeSessionClaim(claim);if(!expected||expected.state!=='owned')return false;
    const foreground=beginForeground(selected);if(!foreground)return false;setBusy(true);let publicationLease=null;
    try{
      await foreground.settled;const scoped=repositoryOperationSelected(selected,{signal:foreground.signal});await synchronizeRepositoryScope(scoped);
      publicationLease=await beginRepositoryPublication(scoped);await assertSharedPublicationTurn(scoped,publicationLease);
      const current=await readRepositorySessionClaim(scoped,{signal:foreground.signal});
      if(!current||current.item.id!==sessionClaimId(expected.epoch)||current.claim.ownerToken!==expected.ownerToken||current.claim.state!=='owned')return false;
      const rollback=freeze({format:SESSION_CLAIM_FORMAT,version:SESSION_CLAIM_VERSION,sessionToken:expected.sessionToken,epoch:expected.epoch+1,state:'owned',ownerToken:expected.observedOwnerToken,revision:expected.observedRevision,observedOwnerToken:expected.ownerToken,observedRevision:expected.revision,claimedAt:new Date().toISOString()});
      await writeRepositorySessionClaim(scoped,rollback,{signal:foreground.signal,interactive:true});return true;
    }catch(error){AppDiagnostics.capture('backup-provider.session-claim-release',error,'warn');return false;}
    finally{if(publicationLease)await endRepositoryPublication(selected,publicationLease);await release(selected,'session-claim-release');setBusy(false);foreground.release();}
  }
  async function readSessionClaim(id='google-drive',options={}){
    const selected=providers.get(safeId(id));if(!selected||!selected.shared||!providerConnected(selected)||!repositorySessionClaimCapable(selected))return null;
    const signal=options&&options.signal||null,current=await readRepositorySessionClaim(repositoryOperationSelected(selected,{signal}),{signal});return projectSessionClaim(current,{signal});
  }
  function scheduleSharedSync(id='google-drive',reason='shared-sync'){
    const selected=providers.get(safeId(id));if(!selected||!selected.shared||!providerConnected(selected))return false;
    const job=providerConvergenceJob(selected);if(!job)return false;
    syncState(selected).behind=true;job.schedule(0,'flush:'+String(reason||'shared-sync'),'replace');return true;
  }

  async function backupProvider(id=''){
    const selected=providers.get(safeId(id));
    if(!selected)return false;
    statusSource=selected.id;
    if(busy){statusText('Another backup operation is still in progress…');return false;}
    const attemptRevision=canonicalConvergenceRevision(),traceId=OperationDiagnostics.start('provider-backup',selected.label,{provider:selected.id}),foreground=beginForeground(selected);
    if(!foreground){OperationDiagnostics.finish({status:'skipped',reason:'busy'},traceId);return false;}
    beginForegroundView(selected,'backup',`Connecting to ${selected.label}…`);setBusy(true);providerProgress(selected,'authorize',`Connecting to ${selected.label}…`);
    try{
      await enterForeground(selected,foreground,traceId,{authorizeAs:'export'});
      statusText(`Backing up to ${selected.label}…`);
      const result=await backupRepositoryProvider(selected.id,{signal:foreground.signal,foregroundPriority:true}),followUp=result&&result.warning?' '+result.warning:'',done=result&&result.unchanged?`✓ ${selected.label} already has your latest data.`:`✓ Backed up to ${selected.label}.`;
      statusText(done+followUp);finishForegroundView(selected,{message:done+followUp,ok:true});
      OperationDiagnostics.finish({objectsWritten:Number(result&&result.objectsWritten)||0,objectsReused:Number(result&&result.objectsReused)||0,writtenBytes:Number(result&&result.writtenBytes)||0},traceId);return true;
    }catch(error){
      const cancelled=error?.name==='AbortError'||['PROVIDER_FOREGROUND_CANCELLED','STUDY_DIRECTOR_IMPORT_CANCELLED'].includes(String(error?.code||'')),message=userProviderMessage(error,'The backup could not be completed safely.');
      if(cancelled){OperationDiagnostics.finish({cancelled:true},traceId);statusText('Backup cancelled safely.',true);finishForegroundView(selected,{message:'Backup cancelled safely.',ok:true,lifecycle:'cancelled'});return false;}
      // Drive moved on, or another device is saving there: sync takes it from here.
      const code=String(error?.code||''),behind=code==='REPOSITORY_SYNC_BEHIND';
      if(code==='REPOSITORY_SYNC_NEEDS_UPDATE'||code==='STUDY_DIRECTOR_SHARE_HELD'){
        const text=String(error.message||`Sync with ${selected.label} waits for an app update.`);
        OperationDiagnostics.finish({status:'pending',reason:'needs-update'},traceId);statusText(text,false);finishForegroundView(selected,{message:text,ok:false,lifecycle:'cancelled'});return false;
      }
      if(behind||code==='REPOSITORY_SYNC_TURN'){
        if(behind)syncState(selected).behind=true;await markPendingRetry(selected).catch(()=>{});schedulePendingProviderBackup(selected,behind?1000:PROVIDER_CONVERGENCE_BUSY_RETRY_MS,{backoff:!behind,attemptRevision,trigger:behind?'shared-behind':'sync-turn'});
        const text=behind?`Taking in newer changes from ${selected.label} first; your backup follows.`:`Another device is saving to ${selected.label}; your backup goes next.`;
        OperationDiagnostics.finish({status:'pending',reason:behind?'behind':'turn'},traceId);statusText(text,true);finishForegroundView(selected,{message:text,ok:true,lifecycle:'cancelled'});return false;
      }
      OperationDiagnostics.fail(error,{},traceId);statusText(`Backup failed: ${message}`,false);finishForegroundView(selected,{message:`Backup failed: ${message}`,ok:false});
      return false;
    }finally{if(foregroundView()&&foregroundView().providerId===selected.id)finishForegroundView(selected);await release(selected,'export');setBusy(false);foreground.release();}
  }
  // Normal Drive synchronization is its own operation: pull one verified Drive
  // head, reconcile it into canonical local state, verify the changed units and
  // publish the resulting local state. It reuses the same transaction/rollback
  // primitives as recovery without entering the user-facing Combine workflow.
  async function syncRepositoryProvider(id,options={}){
    if(busy)return freeze({cancelled:true,reason:'busy'});
    const selected=providers.get(safeId(id));
    if(!selected||!selected.shared||!selected.repository)return freeze({cancelled:true,reason:'unavailable'});
    if(!providerConnected(selected))return freeze({cancelled:true,reason:'not-connected'});
    const traceId=OperationDiagnostics.start('provider-sync',selected.label,{provider:selected.id}),foreground=beginForeground(selected,options&&options.signal||null,{respectBackgroundSuspension:options&&options.respectBackgroundSuspension===true});
    if(!foreground){OperationDiagnostics.finish({status:'skipped',reason:'busy'},traceId);return freeze({cancelled:true,reason:'busy'});}
    // An automatic catch-up is already admitted under the suspension-aware
    // provider owner. It must not impersonate a standalone file import and
    // suspend/cancel its own foreground sync through the file-work observer.
    const operation=BackupController.beginImport({backgroundPreemptible:options&&options.respectBackgroundSuspension===true}),cancelImport=()=>operation.cancel?.('Synchronization was cancelled.');
    if(foreground.signal.aborted)cancelImport();else foreground.signal.addEventListener('abort',cancelImport,{once:true});
    beginForegroundView(selected,'sync',`Syncing with ${selected.label}…`,options.presentation);setBusy(true);
    try{
      await enterForeground(selected,foreground,traceId,{prepare:true});
      const candidate=await loadRepositoryProviderCandidate(selected.id,operation,{checkpointId:String(options&&options.checkpointId||''),mode:'bring-in',quiet:true,sync:true,password:options&&options.password===true,onProgress:typeof options?.onProgress==='function'?options.onProgress:null});
      if(!candidate){finishForegroundView(selected,{message:'Sync stopped safely.',ok:true,lifecycle:'cancelled'});OperationDiagnostics.finish({cancelled:true,reason:'unavailable'},traceId);return freeze({cancelled:true,reason:'unavailable'});}
      const sessionClaimed=await sessionClaimedHere(selected,{signal:foreground.signal});
      const exportedAt=String(candidate.preview?.exportedAt||''),result=await RepositoryCheckpointPipeline.bringIn(candidate,{sync:true,sessionClaimedHere:sessionClaimed});
      if(result&&result.cancelled){finishForegroundView(selected,{message:result.reason==='needs-decision'?`${selected.label} has changes that need your review.`:'Sync stopped safely.',ok:true,lifecycle:'cancelled'});OperationDiagnostics.finish({cancelled:true,reason:String(result.reason||'cancelled')},traceId);return freeze({...result,cancelled:true,exportedAt});}
      OperationDiagnostics.finish({cancelled:false},traceId);return freeze({...result,exportedAt});
    }catch(error){
      if(String(error&&error.code||'')==='STUDY_DIRECTOR_IMPORT_CANCELLED'){finishForegroundView(selected,{message:'Sync cancelled safely.',ok:true,lifecycle:'cancelled'});OperationDiagnostics.finish({cancelled:true,reason:'cancelled'},traceId);return freeze({cancelled:true,reason:'cancelled'});}
      finishForegroundView(selected,{message:`Sync failed: ${userProviderMessage(error,'The newest shared version could not be verified safely.')}`,ok:false});OperationDiagnostics.fail(error,{},traceId);throw error;
    }finally{
      if(foregroundView()&&foregroundView().providerId===selected.id)finishForegroundView(selected);
      foreground.signal.removeEventListener('abort',cancelImport);BackupController.finishImport(operation);await release(selected,'sync');setBusy(false);foreground.release();
    }
  }

  // A quiet run (adding what is missing after browser data was cleared) never
  // prompts: it runs only while already connected and never asks for sign-in.
  async function bringInRepositoryProvider(id,options={}){
    if(busy)return freeze({cancelled:true,reason:'busy'});
    const selected=providers.get(safeId(id));
    if(!selected||!selected.repository)throw new Error('Backup location is unavailable.');
    const quiet=options?.quiet===true,missingOnly=options?.missingOnly===true,note=!missingOnly&&typeof options?.note==='string'?options.note:'';
    if(quiet&&!providerConnected(selected))return freeze({cancelled:true,reason:'not-connected'});
    const traceId=OperationDiagnostics.start('provider-combine',selected.label,{provider:selected.id}),foreground=beginForeground(selected,options&&options.signal||null);
    if(!foreground){OperationDiagnostics.finish({status:'skipped',reason:'busy'},traceId);return freeze({cancelled:true,reason:'busy'});}
    const operation=BackupController.beginImport(),cancelImport=()=>operation.cancel?.('Backup recovery was cancelled by the user.');
    if(foreground.signal.aborted)cancelImport();else foreground.signal.addEventListener('abort',cancelImport,{once:true});
    beginForegroundView(selected,'bring-in',`Connecting to ${selected.label}…`,options.presentation);setBusy(true);providerProgress(selected,'authorize',`Connecting to ${selected.label}…`);
    try{
      await enterForeground(selected,foreground,traceId,{prepare:true,authorizeAs:quiet?'':'import'});
      statusText(`Reading ${selected.label}…`);
      const candidate=await loadRepositoryProviderCandidate(selected.id,operation,{checkpointId:String(options&&options.checkpointId||''),mode:'bring-in',note,missingOnly,before:String(options?.before||''),quiet,review:!quiet&&!note&&options?.review===true,onProgress:typeof options?.onProgress==='function'?options.onProgress:null});if(!candidate){const message=missingOnly?'No version saved before browser data was cleared was found. Nothing was changed.':'Combine cancelled.';statusText(message);finishForegroundView(selected,{message,lifecycle:'cancelled'});OperationDiagnostics.finish({cancelled:true},traceId);return freeze({cancelled:true,...(missingOnly?{reason:'needs-decision'}:{})});}
      const exportedAt=String(candidate.preview?.exportedAt||''),result=await RepositoryCheckpointPipeline.bringIn(candidate,{note,missingOnly,review:!quiet&&!note&&options?.review===true});
      if(result&&result.cancelled){const message=String(result.reason||'').startsWith('note-')||result.reason==='needs-decision'?'No changes were made.':'Combine cancelled.';statusText(message);finishForegroundView(selected,{message,lifecycle:'cancelled'});OperationDiagnostics.finish({cancelled:true},traceId);return freeze({...result,cancelled:true});}
      const convergence=presentRecovery(selected,'bring-in',result);

      OperationDiagnostics.finish({cancelled:false},traceId);return freeze({...result,convergence,exportedAt});
    }catch(error){
      const cancelled=presentRecoveryFailure(selected,'Combine',error);

      if(cancelled){OperationDiagnostics.finish({cancelled:true},traceId);return freeze({cancelled:true,reason:'cancelled'});}
      OperationDiagnostics.fail(error,{},traceId);throw error;
    }finally{if(foregroundView()&&foregroundView().providerId===selected.id)finishForegroundView(selected);foreground.signal.removeEventListener('abort',cancelImport);BackupController.finishImport(operation);await release(selected,'import');setBusy(false);foreground.release();}
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
      await enterForeground(selected,foreground,traceId,{authorizeAs:'import'});
      statusText(`Reading ${selected.label}…`);
      const candidate=await loadRepositoryProvider(selected,operation,{checkpointId:String(options&&options.checkpointId||''),mode:'restore-version',onProgress:typeof options?.onProgress==='function'?options.onProgress:null});
      const result=await RepositoryCheckpointPipeline.restoreVersion(candidate,{confirmed:options&&options.confirmed===true});
      if(result&&result.cancelled){statusText('Version restore cancelled.');finishForegroundView(selected,{message:'Version restore cancelled.',lifecycle:'cancelled'});OperationDiagnostics.finish({cancelled:true},traceId);return result;}
      const convergence=presentRecovery(selected,'restore-version',result);

      OperationDiagnostics.finish({cancelled:false},traceId);return Object.freeze({...result,convergence});
    }catch(error){
      const cancelled=presentRecoveryFailure(selected,'Version restore',error);

      if(cancelled){OperationDiagnostics.finish({cancelled:true},traceId);return Object.freeze({cancelled:true,reason:'cancelled'});}
      OperationDiagnostics.fail(error,{},traceId);
      throw error;
    }finally{if(foregroundView()&&foregroundView().providerId===selected.id)finishForegroundView(selected);foreground.signal.removeEventListener('abort',cancelImport);BackupController.finishImport(operation);await release(selected,'import');setBusy(false);foreground.release();}
  }
  async function connectProvider(selected){
    if(busy||!selected)return false;
    const foreground=beginForeground(selected);if(!foreground)return false;
    statusSource=selected.id;setBusy(true);statusText(`Connecting ${selected.label}…`);
    try{
      // Sign-in opens from the click, so preparation runs alongside the
      // background work giving way rather than after it.
      await Promise.all([foreground.settled,selected.prepare?selected.prepare():null]);await authorize(selected,'connect');
      statusText('');return true;
    }catch(error){statusText(`Connection failed: ${userProviderMessage(error,`${selected.label} could not be connected.`)}`,false);return false;}
    finally{await release(selected,'connect');setBusy(false);foreground.release();}
  }
  // Forgetting a location drops everything this device holds about it; its
  // backups stay where they are.
  async function forgetProvider(selected){
    Object.assign(automaticState(selected),{noticeShown:true,waitingSince:NaN,urgentSince:NaN});await discardProviderPublication(selected);connectedOnceByProvider.delete(selected.id);clearRecentHistory(selected);verifiedHistoryByProvider.delete(selected.id);repositoryScopeByProvider.delete(selected.id);await clearPendingRetry(selected);providerBackground(selected).clearAllScheduled();presentation.reset(selected.id);
  }
  async function disconnectProvider(selected){
    if(busy||!selected||!selected.disconnect)return false;
    const foreground=beginForeground(selected);if(!foreground)return false;
    statusSource=selected.id;setBusy(true);statusText(`Disconnecting ${selected.label}…`);
    try{
      await foreground.settled;await authorize(selected,'disconnect');
      await selected.disconnect();await forgetProvider(selected);
      statusText('');return true;
    }catch(error){
      statusText(`Disconnect failed: ${error&&error.message?error.message:String(error)}`,false);return false;
    }finally{await release(selected,'disconnect');setBusy(false);foreground.release();}
  }
  // Status for each location; the app draws every location row from it.
  const statusListeners=new Set();
  function subscribeStatus(listener){if(typeof listener!=='function')throw new TypeError('Backup location status listener is invalid.');statusListeners.add(listener);return ()=>statusListeners.delete(listener);}
  function notifyStatus(){for(const listener of statusListeners)try{listener();}catch(error){AppDiagnostics.capture('backup-provider.status-listener',error,'warn');}}
  function locationStatus(id){
    const selected=providers.get(safeId(id));if(!selected)return null;
    const operation=foregroundView(),active=busy&&operation?.providerId===selected.id,coordinator=providerBackgroundCoordinators.get(selected.id),background=coordinator?coordinator.status():null,running=background?background.active:[],job=coordinator?coordinator.jobStatus('convergence'):null,attempts=providerConvergenceRetryAttempts.get(selected.id)||0;
    const connected=providerConnected(selected);if(connected)connectedOnceByProvider.add(selected.id);
    return freeze({connected,wasConnected:connectedOnceByProvider.has(selected.id),engineBusy:busy,busy:active,foregroundKind:active?String(operation.kind||''):'',cancellable:active&&!!foregroundController&&!foregroundController.signal.aborted,backingUp:running.includes('convergence')||presentation.read(selected.id,'external-backup')?.lifecycle==='running',maintenanceBusy:running.includes('maintenance')||running.includes('integrity'),paused:background?.held===true,locked:ports.ownership.canRunBackground()==='locked',waiting:automaticWaiting(selected),nextEligibleAt:String(job?.nextEligibleAt||''),retryAttempt:attempts,retryBackoffCapped:attempts>=PROVIDER_CONVERGENCE_RETRY_DELAYS.length,sync:selected.shared?syncView(selected):null});
  }
  function register(config={}){
    const normalized=freezeProvider(config&&typeof config==='object'?config:{});
    if(!normalized.id||!normalized.label||!normalized.repository)return false;
    if(providers.has(normalized.id))return false;
    providers.set(normalized.id,normalized);
    automaticState(normalized).connected=providerConnected(normalized);
    if(normalized.subscribeConnection)normalized.subscribeConnection(()=>{connectionChanged(normalized);wakeProviderBackground(normalized,'connection');notifyStatus();});
    wakeProviderBackground(normalized,'registered');
    notifyStatus();
    return true;
  }
  function list(){return Object.freeze([...providers.values()].map(item=>Object.freeze({id:item.id,label:item.label,shared:item.shared===true,connected:providerConnected(item)})));}
  function backgroundStatus(){return freeze([...providerBackgroundCoordinators.entries()].flatMap(([id,coordinator])=>[freeze({job:id+' maintenance',...(providerMaintenanceSchedulers.get(id)?.status()||coordinator.jobStatus('maintenance'))}),freeze({job:id+' integrity',...(providerIntegritySchedulers.get(id)?.status()||coordinator.jobStatus('integrity'))}),freeze({job:id+' convergence',...coordinator.jobStatus('convergence')})]));}
  // Sync state of each shared location, for diagnostics: times and flags only.
  function diagnosticSync(){return freeze([...providers.values()].filter(selected=>selected.shared).map(selected=>{const state=syncState(selected),job=providerBackgroundCoordinators.get(selected.id)?.jobStatus('convergence');let endsAt=NaN;try{endsAt=Number(selected.connectionExpiresAt?.());}catch{}return freeze({id:selected.id,connected:providerConnected(selected),syncedAt:state.syncedAt,checkedAt:state.checkedAt?new Date(state.checkedAt).toISOString():'',nextEligibleAt:String(job?.nextEligibleAt||''),needsReview:!!state.review,needsUpdate:!!state.newer,needsPassword:!!state.password,behind:!!state.behind,catchingUp:!!state.catching,turnWaits:Math.max(0,Number(state.turnWaits)||0),signInEndsAt:Number.isFinite(endsAt)&&endsAt>0?new Date(endsAt).toISOString():''});}));}
  function diagnosticConnections(){return freeze([...providers.values()].map(selected=>freeze({id:selected.id,connected:providerConnected(selected),formats:formatsByProvider.get(selected.id)||null,scopeBound:repositoryScopeByProvider.has(selected.id),retryAttempt:providerConvergenceRetryAttempts.get(selected.id)||0,retryBackoffCapped:(providerConvergenceRetryAttempts.get(selected.id)||0)>=PROVIDER_CONVERGENCE_RETRY_DELAYS.length})));}
  function status(){return Object.freeze({busy,cancellable:!!foregroundController&&!foregroundController.signal.aborted,operation:foregroundView()?Object.freeze({...foregroundView()}):null});}
  return Object.freeze({register,list,syncing:()=>sharingActive(),status,locationStatus,reviewSync,unlockSync,subscribeStatus,disconnect:id=>disconnectProvider(providers.get(safeId(id))),forget:async id=>{const selected=providers.get(safeId(id));if(!selected)return false;await forgetProvider(selected);return true;},backgroundStatus,diagnosticConnections,diagnosticSync,connected:id=>providerConnected(providers.get(safeId(id))),connect:id=>connectProvider(providers.get(safeId(id))),createProtectedSafety,noteChange,flushAutomatic,automaticWaiting:()=>[...providers.values()].some(automaticWaiting),automaticActive:()=>[...providers.values()].some(selected=>providerConnected(selected)&&automaticEnabled(selected)),refresh:notifyStatus,wakeBackground:trigger=>{for(const selected of providers.values())wakeProviderBackground(selected,trigger);},cancelForeground,history:historyRepositoryProvider,noteVersions:noteVersionsRepositoryProvider,backup:backupProvider,backupRepositoryProvider,syncRepositoryProvider,bringInRepositoryProvider,loadRepositoryProviderCandidate,restoreRepositoryProviderVersion,removeRepositoryProviderVersion,scrubRepositoryProvider,requestIntegrity:id=>scheduleProviderIntegrityScrub(providers.get(safeId(id)),1000),configureIntegrityScrub,configureManagedRecovery,configurePendingBackupRetry,configureRepositoryMaintenance,configureAutomaticBackup,configureSessionOwnership,claimSessionOwnership,releaseSessionClaim,readSessionClaim,scheduleSharedSync,suspendBackground,repositoryScope});

  }
  return freeze({format:'study-director.backup-provider-module',contractVersion:1,createRuntime});
});
})();
