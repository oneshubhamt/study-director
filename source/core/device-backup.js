(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,functionPort:functions}=registry.contracts;
registry.define('device-backup',1,input=>{
  if(!input||!Object.isFrozen(input)||Object.keys(input).sort().join('|')!=='repositoryPolicy')throw new TypeError('Device-backup module dependencies are invalid.');
  const RepositoryPolicy=input.repositoryPolicy;if(!RepositoryPolicy||RepositoryPolicy.format!=='study-director.repository-policy-module'||RepositoryPolicy.contractVersion!==1||!Object.isFrozen(RepositoryPolicy.protocol))throw new TypeError('Device-backup repository policy dependency is invalid.');
  const freeze=Object.freeze;
  function createController(input){
    exactObject(input,['background','configuration','environment','hooks','ownership','presentation','repository','storage'],'Device-backup input');
    exactObject(input.configuration,['maxDelayMs','metadataKey','quietDelayMs','urgentDelayMs'],'Device-backup configuration');
    exactObject(input.environment,['clearTimeout','now','setTimeout','showDirectoryPicker','yieldTask'],'Device-backup environment');
    if(typeof input.environment.yieldTask!=='function')throw new TypeError('Device-backup task yielding is unavailable.');
    exactObject(input.repository,['activeProtected','bringIn','classifyState','cleanup','createPublication','inspect','inspectCommit','inspectManifest','markCompleted','projectHistory','publish','publishInline','restoreVersion','retention','scrub','selectRetention','validatePolicy','verifyCheckpoint','verifyObject'],'Device-backup repository port');
    if(['activeProtected','bringIn','classifyState','cleanup','createPublication','inspect','inspectCommit','inspectManifest','markCompleted','projectHistory','publish','publishInline','restoreVersion','scrub','selectRetention','validatePolicy','verifyCheckpoint','verifyObject'].some(key=>typeof input.repository[key]!=='function')||!Object.isFrozen(input.repository.retention))throw new TypeError('Device-backup repository port is invalid.');
    try{input.repository.validatePolicy(input.repository.retention);}catch{throw new TypeError('Device-backup repository port is invalid.');}
    functions(input.storage,['read','remove','write'],'Device-backup storage port');
    functions(input.ownership,['canMutate'],'Device-backup ownership port');
    functions(input.hooks,['backgroundAvailable','capture','chooseCheckpoint','excludedObjectIds','localRecoveryEmpty','managedRecovery','maintenanceRead','maintenanceMark','maintenanceClear','operationFail','operationFinish','operationMark','operationStart','render','sourceRevision'],'Device-backup hooks');
    if(!input.background||input.background.format!=='study-director.repository-background-coordinator'||input.background.contractVersion!==1)throw new TypeError('Device-backup background coordinator is invalid.');
    if(!Object.isFrozen(input.presentation)||['begin','read','feedback','condition','detail','outcome','resolve','reset','subscribe'].some(key=>typeof input.presentation[key]!=='function'))throw new TypeError('Backup presentation port is invalid.');
    const config=input.configuration,environment=input.environment,repository=input.repository,background=input.background;
    const storage=input.storage,ownership=input.ownership,hooks=input.hooks;
    const supported=typeof environment.showDirectoryPicker==='function';
    const FORMAT='study-director.device-backup-settings',VERSION=3;
    const {publicationMaxAgeMs:PUBLICATION_MAX_AGE_MS,publicationAssertionMarginMs:PUBLICATION_ASSERTION_MARGIN_MS,maintenanceMaxAgeMs:MAINTENANCE_MAX_AGE_MS,maintenanceAssertionMarginMs:MAINTENANCE_ASSERTION_MARGIN_MS,objectGcGraceMs:OBJECT_GC_GRACE_MS}=RepositoryPolicy.protocol;
    const MAINTENANCE_PASS_BUDGET_MS=20*1000,INTEGRITY_SCRUB_BUDGET_MS=background.integrity.workBudgetMs,FILESYSTEM_READ_TIMEOUT_MS=10*1000,DEVICE_READ_CONCURRENCY=8,AUTOMATIC_RETRY_MULTIPLIERS=Object.freeze([1,3,12]),AUTOMATIC_RETRY_MAX_DELAY_MS=6*60*60*1000,STALL_NOTICE_MS=20*1000;
    const MAINTENANCE_POLICY=background.maintenance;
    const REPOSITORY_IDENTITIES=Object.freeze(@@SD_EXTERNAL_REPOSITORY_IDENTITIES@@);
    const REPOSITORY_DIRECTORY=REPOSITORY_IDENTITIES.deviceFolderRoot,OBJECTS_DIRECTORY=REPOSITORY_IDENTITIES.deviceFolderObjects,CHECKPOINTS_DIRECTORY=REPOSITORY_IDENTITIES.deviceFolderCheckpoints,COMMITS_DIRECTORY=REPOSITORY_IDENTITIES.deviceFolderCommits;
    let installed=false,revision=0,mode=supported?'off':'unsupported',busy=false,settingsUnverified=supported;
    const presentation=input.presentation;
    let presentationScope=null;
    const presentationState={get message(){return (presentationScope?.read()||presentation.read('device-folder','backup-status')||(presentation.read('device-folder')?.lifecycle==='failed'?presentation.read('device-folder'):null))?.message||'';},set message(value){if(presentationScope?.read()?.lifecycle==='running')presentationScope.update({message:String(value||'')});else presentation.feedback('device-folder',String(value||''));}};
    let directoryHandle=null,permission='unknown',lastBackupAt='',lastFilename='',savedSourceRevision='',observedSourceRevision='',recoveryAvailable=false,checkpointCount=0;
    let scrubRunning=null,foregroundController=null,foregroundKind='',automaticRetryAttempt=0,pendingRevision=0,backedUpRevision=0,firstPendingAt=0,activeBackupRevision=0,postStartPendingAt=0,suspensionSequence=0,ownershipWasMutable=ownership.canMutate(),backupStage='',backupStageTimer=null,lastBackupProgressAt=0,stalled=false;
    const automaticSuspensions=new Set(),backgroundSuspensions=new Map();
    let ownershipSuspension=null;

    function capture(scope,error){try{hooks.capture(scope,error);}catch(reportingError){}}
    const operationStart=(kind,source,details={})=>hooks.operationStart(kind,source,{...details,target:'device-folder'}),operationMark=(name,details={},id)=>hooks.operationMark(name,{...details,target:'device-folder'},id),operationFinish=(details={},id)=>hooks.operationFinish(details,id),operationFail=(error,details={},id)=>hooks.operationFail(error,details,id);
    const backgroundTransition=(job,from,to,details={},id)=>operationMark('background-transition',background.transition(job,from,to,details),id);
    const maintenanceIntent=background.maintenanceIntent(freeze({capture:(phase,error)=>capture('device-backup.repository-maintenance-'+phase,error),clear:expected=>hooks.maintenanceClear(expected),mark:(state,expected)=>hooks.maintenanceMark(state,expected),read:()=>hooks.maintenanceRead(),scope:()=>directoryHandle,selectRetention:repository.selectRetention}));
    const repositoryStateNeedsMaintenance=state=>background.repositoryObservationNeedsMaintenance(freeze({unreadable:state&&state.unreadable||[],uncommitted:state&&state.uncommitted||[],orphanCommits:state&&state.orphanCommits||[],rows:state&&state.valid||[]}),repository.selectRetention,nowMs());

    async function mapBounded(values,worker,limit=DEVICE_READ_CONCURRENCY){
      const rows=Array.isArray(values)?values:[],results=new Array(rows.length),concurrency=Math.max(1,Math.min(DEVICE_READ_CONCURRENCY,Math.floor(Number(limit)||1)));let next=0;
      async function run(){for(;;){const index=next++;if(index>=rows.length)return;results[index]=await worker(rows[index],index);}}
      await Promise.all(Array.from({length:Math.min(concurrency,rows.length)},run));return results;
    }
    function userMessage(error,fallback){
      const raw=String(error&&error.message||error||'').trim();
      if(!raw)return fallback;
      return /\b(?:repository|checkpoint|manifest|commit marker|reconciliation)\b/iu.test(raw)?fallback:raw;
    }
    function nowMs(){const value=Number(environment.now());return Number.isFinite(value)?value:Date.now();}
    function isoNow(){return new Date(nowMs()).toISOString();}
    function readTimeout(operation,label,signal=null){
      return new Promise((resolve,reject)=>{
        let settled=false;
        const finish=(callback,value)=>{if(settled)return;settled=true;environment.clearTimeout(timerId);if(signal)signal.removeEventListener('abort',onAbort);callback(value);};
        const onAbort=()=>{const reason=signal?.reason instanceof Error?signal.reason:deviceBackgroundAbort('DEVICE_FOREGROUND_CANCELLED','Device Folder operation was cancelled.');if(!reason.name||reason.name==='Error')reason.name='AbortError';finish(reject,reason);};
        const timerId=environment.setTimeout(()=>{
          const error=new Error(`${label} did not respond within ${Math.round(FILESYSTEM_READ_TIMEOUT_MS/1000)} seconds.`);error.code='DEVICE_FILESYSTEM_READ_TIMEOUT';finish(reject,error);
        },FILESYSTEM_READ_TIMEOUT_MS);
        if(signal){if(signal.aborted){onAbort();return;}signal.addEventListener('abort',onAbort,{once:true});}
        Promise.resolve(operation).then(value=>finish(resolve,value),error=>finish(reject,error));
      });
    }
    function assertOperationCurrent(signal=null){if(signal?.aborted){const reason=signal.reason instanceof Error?signal.reason:new Error('Device Folder background work yielded.');if(!reason.name||reason.name==='Error')reason.name='AbortError';throw reason;}return true;}
    async function readDirectoryEntries(directory,label,signal=null,check=null){
      if(!directory||typeof directory.entries!=='function')throw new Error(`${label} cannot be enumerated.`);
      const iterable=directory.entries(),iterator=iterable&&typeof iterable[Symbol.asyncIterator]==='function'?iterable[Symbol.asyncIterator]():iterable,out=[];
      if(!iterator||typeof iterator.next!=='function')throw new Error(`${label} cannot be enumerated.`);
      try{for(;;){assertOperationCurrent(signal);await check?.();const step=await readTimeout(iterator.next(),`${label} enumeration`,signal);assertOperationCurrent(signal);await check?.();if(step.done)break;out.push(step.value);if(out.length%128===0)await environment.yieldTask();}}
      finally{if(typeof iterator.return==='function')Promise.resolve(iterator.return()).catch(error=>capture('device-backup.directory-release',error));}
      return out;
    }
    function currentSourceRevision(){
      try{const value=String(hooks.sourceRevision()||'');return Number.isFinite(Date.parse(value))?value:'';}
      catch(error){capture('device-backup.source-revision',error);return '';}
    }
    function connected(){return supported&&!!directoryHandle&&permission==='granted';}
    function snapshot(){
      return freeze({
        format:'study-director.device-backup-status',contractVersion:1,
        installed,revision,supported,mode,busy,cancellable:!!foregroundController&&!foregroundController.signal.aborted,foregroundKind,maintenanceBusy:maintenanceScheduler.status().running||scrubRunning!==null,stalled,connected:connected(),permission,message:presentationState.message,hasOperationSummary:!!presentation.read('device-folder')&&!presentation.read('device-folder','backup-status'),
        lastBackupAt:lastBackupAt||null,lastFilename:lastFilename||null,folderName:directoryHandle&&typeof directoryHandle.name==='string'?directoryHandle.name:'',recoveryAvailable,checkpointCount,automaticSuspended:automaticSuspensions.size>0,
        pending:pendingRevision>backedUpRevision,scheduled:background.jobStatus('automatic').scheduled,nextEligibleAt:automaticJob.status().nextEligibleAt,backgroundState:background.jobStatus('automatic').state,blocker:automaticJob.status().blocker,retryAttempt:automaticRetryAttempt,retryBackoffCapped:automaticRetryBackoffCapped()&&pendingRevision>backedUpRevision
      });
    }
    function publish(){revision+=1;const state=snapshot();
      presentation.condition('device-folder','permission',directoryHandle&&mode==='permission'?'Device Folder permission is required. Reconnect the folder to resume external backups.':'');
      presentation.condition('device-folder','retry-exhausted',mode==='error'&&automaticRetryBackoffCapped()?'Device Folder backup remains pending after repeated failures. Automatic retries continue less frequently. Choose Back up now or reconnect the folder to retry sooner.':'');
      hooks.render(state);return state;}

    function clearBackupStage(){if(backupStageTimer!==null){environment.clearTimeout(backupStageTimer);backupStageTimer=null;}if(presentationState.message===backupStage||presentationState.message.startsWith(backupStage+' ')||presentationState.message.startsWith('This step is taking longer than expected: '))presentationState.message='';backupStage='';lastBackupProgressAt=0;stalled=false;}
    function armBackupStageTimer(stage){
      if(backupStageTimer!==null)environment.clearTimeout(backupStageTimer);
      backupStageTimer=environment.setTimeout(()=>{
        backupStageTimer=null;
        if(!busy||backupStage!==stage)return;
        stalled=true;presentationState.message=`This step is taking longer than expected: ${stage} Local saving continues. If it remains here, reload the app and check the backup folder before retrying.`;publish();
      },STALL_NOTICE_MS);
    }
    function setBackupStage(stage){if(backupStage===stage)return;backupStage=stage;stalled=false;presentationState.message=stage;publish();armBackupStageTimer(stage);}
    function reportBackupProgress(stage,progress,{force=false}={}){
      if(backupStage!==stage)setBackupStage(stage);
      const now=nowMs();if(force||now-lastBackupProgressAt>=250){presentationScope?.update({message:stage,progress:{stage,...progress}});stalled=false;lastBackupProgressAt=now;publish();}
      armBackupStageTimer(stage);
    }
    function clearSchedule(){return automaticJob.clear();}
    function clearMaintenanceSchedule(){return background.clearScheduled('maintenance');}
    async function markMaintenance(reason,delay){
      if(String(reason||'')==='repository-state'){
        const pending=await maintenanceIntent.read();
        if(pending&&!maintenanceIntent.actionable(pending)&&background.maintenanceDefersAcrossObservation(pending)){
          maintenanceScheduler.schedule(maintenanceIntent.delay(pending,delay),pending.reason||reason,'earliest');return true;
        }
      }
      return maintenanceScheduler.request(reason,delay,{mode:'earliest'});
    }
    async function resumeMaintenanceAfterPublication(released){if(!released)return false;const pending=await maintenanceIntent.read();if(!pending||String(pending.reason||'')!=='publication-contention'||maintenanceIntent.actionable(pending))return false;return maintenanceScheduler.request('repository-state',MAINTENANCE_POLICY.busyMs,{mode:'replace'});}
    async function scheduleRepositoryMaintenanceForState(state,delay=MAINTENANCE_POLICY.continuationMs){
      const observation=freeze({unreadable:state&&state.unreadable||[],uncommitted:state&&state.uncommitted||[],orphanCommits:state&&state.orphanCommits||[],rows:state&&state.valid||[]}),decision=await maintenanceScheduler.observe(observation,{delay});return decision.needed||!!decision.pending||decision.retryObservation===true;
    }
    function normalizeMetadata(value){
      if(!value||typeof value!=='object'||value.format!==FORMAT||Number(value.version)!==VERSION||value.enabled!==true)return null;
      const handle=value.directoryHandle;
      if(!handle||typeof handle.getFileHandle!=='function'||typeof handle.getDirectoryHandle!=='function'||typeof handle.queryPermission!=='function')return null;
      const at=Number.isFinite(Date.parse(value.lastBackupAt||''))?String(value.lastBackupAt):'';
      const source=Number.isFinite(Date.parse(value.sourceRevision||''))?String(value.sourceRevision):'';
      const filename=/^cp_[a-f0-9]{32}\.sdcheckpoint$/u.test(String(value.lastFilename||''))?String(value.lastFilename):'';
      return {directoryHandle:handle,lastBackupAt:at,lastFilename:filename,sourceRevision:source};
    }
    function metadataValue(overrides={}){
      return {
        format:FORMAT,version:VERSION,enabled:true,directoryHandle,
        lastBackupAt:overrides.lastBackupAt===undefined?lastBackupAt:overrides.lastBackupAt,
        lastFilename:overrides.lastFilename===undefined?lastFilename:overrides.lastFilename,
        sourceRevision:overrides.sourceRevision===undefined?savedSourceRevision:overrides.sourceRevision
      };
    }
    async function queryPermission(handle=directoryHandle){
      if(!handle||typeof handle.queryPermission!=='function')return 'denied';
      try{
        const result=await handle.queryPermission({mode:'readwrite'});
        return ['granted','prompt','denied'].includes(result)?result:'denied';
      }catch(error){capture('device-backup.permission-query',error);return 'denied';}
    }
    function hasNewerSourceRevision(){
      const current=Date.parse(currentSourceRevision()),saved=Date.parse(savedSourceRevision);
      return Number.isFinite(current)&&(!Number.isFinite(saved)||current>saved);
    }
    async function reconcileSourceRevision(){
      if(!connected()||!ownership.canMutate()||pendingRevision>backedUpRevision||!hasNewerSourceRevision())return false;
      const current=currentSourceRevision(),empty=checkpointCount>0?await hooks.localRecoveryEmpty():false;
      if(!current||typeof empty!=='boolean'||current!==currentSourceRevision())throw Object.assign(new Error('Local recovery data could not be verified for automatic backup discovery.'),{code:'DEVICE_SOURCE_UNAVAILABLE'});
      if(!connected()||!ownership.canMutate())return false;
      observedSourceRevision=current;
      if(empty)return false;
      pendingRevision+=1;if(!firstPendingAt)firstPendingAt=nowMs();schedule({urgent:true});publish();return true;
    }
    function canSchedulePendingBackup(){return connected()&&ownership.canMutate()&&!busy&&!foregroundController&&!automaticSuspensions.size&&pendingRevision>backedUpRevision;}
    function automaticRetryBackoffCapped(){return automaticRetryAttempt>=AUTOMATIC_RETRY_MULTIPLIERS.length;}
    function resetAutomaticRetry(){automaticRetryAttempt=0;return true;}
    function scheduleRetry(){
      if(!canSchedulePendingBackup())return false;
      clearSchedule();
      const base=Math.max(1000,Number(config.quietDelayMs)||1000),multiplier=AUTOMATIC_RETRY_MULTIPLIERS[Math.min(automaticRetryAttempt++,AUTOMATIC_RETRY_MULTIPLIERS.length-1)],delay=Math.min(AUTOMATIC_RETRY_MAX_DELAY_MS,base*multiplier);
      return schedule({retry:true,eligibleAt:new Date(nowMs()+delay).toISOString()});
    }
    function schedule({urgent=false,retry=false,eligibleAt=''}={}){
      if(pendingRevision<=backedUpRevision)return false;
      const state=automaticJob.status();
      // The first dirty change owns the quiet deadline. Wake-ups preserve an
      // urgent deadline or governed retry instead of restarting the countdown.
      if(state.pending&&state.nextEligibleAt&&(['important-change','automatic-retry'].includes(state.reason)||!urgent)){automaticJob.wake('source');return true;}
      const now=nowMs();if(!firstPendingAt)firstPendingAt=now;
      const resumedAt=Date.parse(eligibleAt),delay=Number.isFinite(resumedAt)?Math.max(0,resumedAt-now):urgent?Math.max(0,config.urgentDelayMs):Math.max(0,Math.min(config.quietDelayMs,firstPendingAt+config.maxDelayMs-now));
      automaticJob.schedule(delay,retry?'automatic-retry':urgent?'important-change':'scheduled','replace');publish();return true;
    }
    function notifyChange(options={}){
      if(!directoryHandle||!ownership.canMutate())return false;
      const changedAt=nowMs();
      if(automaticRetryBackoffCapped()){clearSchedule();resetAutomaticRetry();firstPendingAt=changedAt;}
      pendingRevision+=1;
      if(activeBackupRevision>0&&pendingRevision>activeBackupRevision&&!postStartPendingAt)postStartPendingAt=changedAt;
      if(!firstPendingAt)firstPendingAt=changedAt;
      if(automaticSuspensions.size){publish();return true;}
      return schedule({urgent:options&&options.urgent===true});
    }
    async function suspendAutomatic(reason='managed-recovery'){
      const token=`suspend_${(++suspensionSequence).toString(36)}_${nowMs().toString(36)}`,entry=freeze({token,reason:String(reason||'managed-recovery')});
      automaticSuspensions.add(token);const suspension=background.suspend(entry.reason);backgroundSuspensions.set(token,suspension);publish();try{await suspension.settled;return entry;}catch(error){automaticSuspensions.delete(token);backgroundSuspensions.delete(token);background.resume(suspension);publish();throw error;}
    }
    function resumeAutomatic(value){
      const token=String(value&&value.token||value||''),reason=String(value&&value.reason||'');if(!token||!automaticSuspensions.has(token))return false;
      automaticSuspensions.delete(token);const suspension=backgroundSuspensions.get(token);backgroundSuspensions.delete(token);if(suspension)background.resume(suspension);publish();
      if(!automaticSuspensions.size&&connected()&&ownership.canMutate()&&!busy&&pendingRevision>backedUpRevision){
        if(automaticRetryBackoffCapped())resetAutomaticRetry();schedule({urgent:!['bring-in','restore-version'].includes(reason)});
      }
      return true;
    }
    function syncOwnership(){
      const canMutate=ownership.canMutate();
      if(!canMutate){
        ownershipWasMutable=false;
        const hadSchedule=background.jobStatus('automatic').scheduled;if(!ownershipSuspension)ownershipSuspension=background.suspend('ownership-lost');
        if(hadSchedule)publish();
        return snapshot();
      }
      const regainedOwnership=!ownershipWasMutable;ownershipWasMutable=true;if(ownershipSuspension){background.resume(ownershipSuspension);ownershipSuspension=null;}
      if(regainedOwnership&&automaticRetryBackoffCapped())resetAutomaticRetry();
      background.wake('ownership');
      if(connected()&&pendingRevision>backedUpRevision&&!busy&&!automaticSuspensions.size)schedule();
      return snapshot();
    }
    async function persistMetadata(value){await storage.write(config.metadataKey,value);return true;}
    async function inspectStored(){
      if(!supported){mode='unsupported';presentationState.message='';return publish();}
      const scope=await background.beginBackground('automatic');
      if(!scope){automaticJob.schedule(MAINTENANCE_POLICY.busyMs,'settings-busy');return snapshot();}
      try{
        const stored=normalizeMetadata(await readTimeout(storage.read(config.metadataKey),'Device Folder settings',scope.signal));assertOperationCurrent(scope.signal);
        settingsUnverified=false;
        if(!stored){mode='off';permission='unknown';presentationState.message='';return publish();}
        directoryHandle=stored.directoryHandle;lastBackupAt=stored.lastBackupAt;lastFilename=stored.lastFilename;savedSourceRevision=stored.sourceRevision;
        permission=await queryPermission(directoryHandle);assertOperationCurrent(scope.signal);
        if(permission==='granted'){
          mode='connected';presentationState.message='';
          const directories=await repositoryDirectories(),state=await readCheckpointState(directories,{signal:scope.signal});assertOperationCurrent(scope.signal);updateRecoveryState(state);await scheduleRepositoryMaintenanceForState(state,MAINTENANCE_POLICY.continuationMs);
          await reconcileSourceRevision();
        }else{
          mode='permission';
          presentationState.message=permission==='prompt'
            ? 'Folder permission needs to be renewed. Click Allow access.'
            : 'Folder access is blocked by the browser. Click Allow access or update this site’s folder permission.';
        }
      }catch(error){
        if(scope.signal.aborted){settingsUnverified=true;return snapshot();}
        settingsUnverified=true;automaticJob.schedule(MAINTENANCE_POLICY.errorMs,'settings-retry','replace');
        mode='error';permission='unknown';presentationState.message='Automatic device-backup settings could not be read. Normal app saving continues.';
        capture('device-backup.restore-settings',error);
      }finally{scope.release();}
      return publish();
    }
    async function requestStoredPermission(){
      if(!directoryHandle||typeof directoryHandle.requestPermission!=='function')return 'denied';
      try{
        const result=await directoryHandle.requestPermission({mode:'readwrite'});
        return ['granted','prompt','denied'].includes(result)?result:'denied';
      }catch(error){capture('device-backup.permission-request',error);return 'denied';}
    }
    async function refreshPermission(){
      if(!supported||busy)return snapshot();
      if(settingsUnverified){automaticJob.wake('settings-opportunity');return snapshot();}
      if(!directoryHandle)return snapshot();
      const before=permission;permission=await queryPermission(directoryHandle);
      if(permission==='granted'){
        mode='connected';if(before!=='granted')presentationState.message='';
        if(before!=='granted'){
          // Startup may have restored only the handle while permission was
          // blocked. Establish recovery state before discovering dirty data.
          try{const state=await readCheckpointState(await repositoryDirectories());updateRecoveryState(state);await scheduleRepositoryMaintenanceForState(state);await reconcileSourceRevision();}
          catch(error){settingsUnverified=true;automaticJob.schedule(MAINTENANCE_POLICY.errorMs,'settings-retry','replace');capture('device-backup.permission-recovery',error);}
          background.wake('permission-restored');if(canSchedulePendingBackup())schedule();
        }
      }else{
        background.wake('permission-lost');mode='permission';
        presentationState.message=permission==='prompt'?'Folder permission needs to be renewed. Click Allow access.':'Folder access is blocked by the browser. Click Allow access or update this site’s folder permission.';
      }
      if(permission!==before)publish();
      return snapshot();
    }
    async function chooseDirectory(){
      return environment.showDirectoryPicker({id:REPOSITORY_IDENTITIES.deviceFolderPickerId,mode:'readwrite',startIn:'documents'});
    }
    async function forgetUnavailableDirectory(){
      try{await storage.remove(config.metadataKey);}catch(error){capture('device-backup.missing-folder-metadata',error);}
      try{await maintenanceIntent.clear();}catch(error){capture('device-backup.missing-folder-maintenance',error);}
      clearMaintenanceSchedule();background.clearScheduled('integrity');
      directoryHandle=null;permission='unknown';lastBackupAt='';lastFilename='';savedSourceRevision='';recoveryAvailable=false;checkpointCount=0;
      mode='off';presentationState.message='The backup folder is no longer available. Choose the backup folder again.';
    }
    async function repositoryDirectories(){
      if(!directoryHandle||typeof directoryHandle.getDirectoryHandle!=='function')throw new Error('The selected folder cannot be used for Study Director automatic backup.');
      try{
        const root=await directoryHandle.getDirectoryHandle(REPOSITORY_DIRECTORY,{create:true});
        const objects=await root.getDirectoryHandle(OBJECTS_DIRECTORY,{create:true});
        const checkpoints=await root.getDirectoryHandle(CHECKPOINTS_DIRECTORY,{create:true});
        const commits=await root.getDirectoryHandle(COMMITS_DIRECTORY,{create:true});
        return freeze({root,objects,checkpoints,commits});
      }catch(error){
        if(!error||error.name!=='NotFoundError')throw error;
        await forgetUnavailableDirectory();const missing=new Error('The backup folder is no longer available. Choose the backup folder again.');missing.code='DEVICE_FOLDER_MISSING';throw missing;
      }
    }
    async function connect(){
      if(!supported){mode='unsupported';return publish();}
      if(!ownership.canMutate()){mode=directoryHandle?'permission':'off';presentationState.message='Take control in this tab before connecting a backup folder.';return publish();}
      const foreground=beginForegroundController(null,'connect');if(!foreground)return snapshot();
      const configuredHandle=directoryHandle;let capabilityRequest;
      try{capabilityRequest=Promise.resolve(configuredHandle?requestStoredPermission():chooseDirectory());}
      catch(error){capabilityRequest=Promise.reject(error);}
      capabilityRequest.catch(()=>{});
      presentationState.message='Connecting backup folder…';publish();let createInitial=false,ownsBusy=false;
      try{
        await foreground.settled;
        let handle=configuredHandle;
        if(handle){
          permission=await capabilityRequest;
          if(permission!=='granted'){
            mode='permission';presentationState.message=permission==='prompt'?'Folder permission needs to be renewed. Click Allow access.':'Folder access is blocked by the browser. Click Allow access or update this site’s folder permission.';
            return snapshot();
          }
        }else handle=await capabilityRequest;
        if(busy)return snapshot();
        busy=true;ownsBusy=true;
        if(!handle||typeof handle.getFileHandle!=='function'||typeof handle.getDirectoryHandle!=='function')throw new Error('The selected folder is not writable.');
        directoryHandle=handle;permission=await queryPermission(handle);
        if(permission!=='granted'&&typeof handle.requestPermission==='function')permission=await requestStoredPermission();
        if(permission!=='granted')throw new Error('Write permission was not granted for the selected folder.');
        const directories=await repositoryDirectories(),state=await readCheckpointState(directories,{signal:foreground.signal});updateRecoveryState(state);resetAutomaticRetry();
        mode='connected';presentationState.message=state.valid.length?'Existing Study Director backup checkpoints found. Choose Versions to recover one, or Back up now to keep this device’s current data.':'';
        await persistMetadata(metadataValue());settingsUnverified=false;await scheduleRepositoryMaintenanceForState(state,MAINTENANCE_POLICY.continuationMs);createInitial=state.valid.length===0;
        if(!configuredHandle)observedSourceRevision=currentSourceRevision();
        if(configuredHandle&&!createInitial)await reconcileSourceRevision();
      }catch(error){
        if(error&&error.name==='AbortError'){
          if(!directoryHandle){mode='off';permission='unknown';presentationState.message='Folder selection was cancelled.';}
        }else if(error&&error.code==='DEVICE_FOLDER_MISSING'){
          mode='off';presentationState.message=error.message;
        }else{
          mode='error';presentationState.message=userMessage(error,'The backup folder could not be verified safely.')+' Normal app saving continues.';
          capture('device-backup.connect',error);
        }
        return snapshot();
      }finally{if(ownsBusy)busy=false;foreground.release();publish();}
      if(!createInitial)return snapshot();
      pendingRevision+=1;firstPendingAt=nowMs();
      return backupNow('connect');
    }
    async function fileOrNull(directory,name){
      try{const handle=await readTimeout(directory.getFileHandle(name),`Device Folder file ${name}`);return await readTimeout(handle.getFile(),`Device Folder file ${name}`);}
      catch(error){if(error&&error.name==='NotFoundError')return null;throw error;}
    }
    function publicationName(id){return String(id)+'.sdpublication';}
    function maintenanceName(id){return String(id)+'.sdmaintenance';}
    async function writeCoordinationMarker(directories,{id,name,format}){
      const startedAt=isoNow(),handle=await directories.objects.getFileHandle(name,{create:true}),writable=await handle.createWritable({keepExistingData:false});
      try{await writable.write(new Blob([JSON.stringify({format,version:1,id,startedAt})],{type:'application/json'}));await writable.close();}
      catch(error){try{await writable.abort?.();}catch{}try{await directories.objects.removeEntry(name);}catch{}throw error;}
      const file=await handle.getFile();return freeze({id,name,createdAt:new Date(Number(file.lastModified)||nowMs()).toISOString()});
    }
    async function deviceCoordinationSafety(directories,{publications=false,maintenances=false,excludeMaintenanceId='',signal=null,check=null}={}){
      if(typeof directories.objects.entries!=='function')return freeze({publications:freeze({blocked:publications,active:0,invalid:publications?1:0}),maintenances:freeze({blocked:maintenances,active:0,invalid:maintenances?1:0})});
      let publicationActive=0,publicationInvalid=0,maintenanceActive=0,maintenanceInvalid=0,publicationNextEligibleAt=0,maintenanceNextEligibleAt=0;const now=nowMs(),excluded=String(excludeMaintenanceId||'');
      for(const [name,handle] of await readDirectoryEntries(directories.objects,'Device Folder coordination directory',signal,check)){
        await check?.();assertOperationCurrent(signal);
        const text=String(name),publicationMatch=publications?/^(pub_[a-f0-9]{32})\.sdpublication$/u.exec(text):null,maintenanceMatch=maintenances?/^(mnt_[a-f0-9]{32})\.sdmaintenance$/u.exec(text):null;
        if(!publicationMatch&&!maintenanceMatch)continue;if(maintenanceMatch&&excluded&&maintenanceMatch[1]===excluded)continue;
        const kind=publicationMatch?'publication':'maintenance',maxAge=publicationMatch?PUBLICATION_MAX_AGE_MS:MAINTENANCE_MAX_AGE_MS;
        if(!handle||handle.kind!=='file'){if(publicationMatch)publicationInvalid+=1;else maintenanceInvalid+=1;continue;}
        try{
          const file=await readTimeout(handle.getFile(),`Device Folder coordination marker ${text}`),age=now-Number(file.lastModified||0);
          if(!Number.isFinite(age)||age<0){if(publicationMatch)publicationInvalid+=1;else maintenanceInvalid+=1;continue;}
          if(age<maxAge){const expires=now+(maxAge-age);if(publicationMatch){publicationActive+=1;if(!publicationNextEligibleAt||expires<publicationNextEligibleAt)publicationNextEligibleAt=expires;}else{maintenanceActive+=1;if(!maintenanceNextEligibleAt||expires<maintenanceNextEligibleAt)maintenanceNextEligibleAt=expires;}continue;}
          try{await directories.objects.removeEntry(name);}catch(error){if(!error||error.name!=='NotFoundError')capture(`device-backup.repository-${kind}-expired-cleanup`,error);}
        }catch(error){if(publicationMatch)publicationInvalid+=1;else maintenanceInvalid+=1;capture(`device-backup.repository-${kind}-state`,error);}
      }
      return freeze({publications:freeze({blocked:publicationActive>0||publicationInvalid>0,active:publicationActive,invalid:publicationInvalid,nextEligibleAt:publicationNextEligibleAt?new Date(publicationNextEligibleAt).toISOString():''}),maintenances:freeze({blocked:maintenanceActive>0||maintenanceInvalid>0,active:maintenanceActive,invalid:maintenanceInvalid,nextEligibleAt:maintenanceNextEligibleAt?new Date(maintenanceNextEligibleAt).toISOString():''})});
    }
    async function deviceMaintenanceSafety(directories,{excludeId=''}={}){return (await deviceCoordinationSafety(directories,{maintenances:true,excludeMaintenanceId:excludeId})).maintenances;}
    async function beginDevicePublication(directories){
      const id='pub_'+globalThis.crypto.randomUUID().replace(/-/gu,''),name=publicationName(id),lease=await writeCoordinationMarker(directories,{id,name,format:'study-director.repository-publication'});
      try{const maintenance=await deviceMaintenanceSafety(directories);if(!maintenance.blocked)return lease;throw new Error('Device Folder maintenance is already in progress. Retry the backup after maintenance completes.');}
      catch(error){await endDevicePublication(directories,lease);throw error;}
    }
    async function assertDevicePublication(directories,lease){
      const id=String(lease&&lease.id||''),name=String(lease&&lease.name||'');if(!/^pub_[a-f0-9]{32}$/u.test(id)||name!==publicationName(id))throw new Error('Device Folder publication protection is invalid.');
      const file=await fileOrNull(directories.objects,name);if(!file)throw new Error('Device Folder publication protection disappeared before commit. Retry the backup.');
      const age=nowMs()-Number(file.lastModified||0);if(!Number.isFinite(age)||age<0||age>=PUBLICATION_MAX_AGE_MS-PUBLICATION_ASSERTION_MARGIN_MS)throw new Error('Device Folder publication protection is too old to safely begin another commit step. Retry the backup.');
      let parsed=null;try{parsed=JSON.parse(await file.text());}catch{}if(!parsed||parsed.format!=='study-director.repository-publication'||Number(parsed.version)!==1||parsed.id!==id)throw new Error('Device Folder publication protection could not be verified. Retry the backup.');
      // Mutual exclusion is established once at lease acquisition: a later maintenance attempt must observe this live publication marker and fail closed.
      return true;
    }
    async function endDevicePublication(directories,lease){const name=String(lease&&lease.name||'');if(!/^pub_[a-f0-9]{32}\.sdpublication$/u.test(name))return false;try{await directories.objects.removeEntry(name);return true;}catch(error){if(error&&error.name==='NotFoundError')return false;capture('device-backup.repository-publication-release',error);return false;}}
    async function beginDeviceMaintenance(directories,{onBlocked=null,signal=null}={}){
      const id='mnt_'+globalThis.crypto.randomUUID().replace(/-/gu,''),name=maintenanceName(id),lease=await writeCoordinationMarker(directories,{id,name,format:'study-director.repository-maintenance'});
      let renewedAt=nowMs(),renewing=null;
      const keepAlive=async(force=false)=>{
        assertOperationCurrent(signal);
        if(!renewing&&(force||nowMs()-renewedAt>=FILESYSTEM_READ_TIMEOUT_MS))renewing=(async()=>{await assertDeviceMaintenance(directories,lease);await writeCoordinationMarker(directories,{id,name,format:'study-director.repository-maintenance'});renewedAt=nowMs();})().finally(()=>{renewing=null;});
        if(renewing)await renewing;assertOperationCurrent(signal);
      };
      const ownedLease=freeze({...lease,keepAlive,settled:()=>renewing?.catch(()=>{})});
      try{const safety=await deviceCoordinationSafety(directories,{publications:true,maintenances:true,excludeMaintenanceId:id,signal,check:keepAlive});if(!safety.publications.blocked&&!safety.maintenances.blocked)return ownedLease;if(typeof onBlocked==='function')onBlocked(safety);await endDeviceMaintenance(directories,ownedLease);return null;}
      catch(error){await endDeviceMaintenance(directories,ownedLease);throw error;}
    }
    async function assertDeviceMaintenance(directories,lease){
      const id=String(lease&&lease.id||''),name=String(lease&&lease.name||'');if(!/^mnt_[a-f0-9]{32}$/u.test(id)||name!==maintenanceName(id))throw new Error('Device Folder maintenance protection is invalid.');
      const file=await fileOrNull(directories.objects,name);if(!file)throw new Error('Device Folder maintenance protection disappeared during cleanup.');
      const age=nowMs()-Number(file.lastModified||0);if(!Number.isFinite(age)||age<0||age>=MAINTENANCE_MAX_AGE_MS-MAINTENANCE_ASSERTION_MARGIN_MS)throw new Error('Device Folder maintenance protection is too old to continue destructive cleanup safely.');
      let parsed=null;try{parsed=JSON.parse(await file.text());}catch{}if(!parsed||parsed.format!=='study-director.repository-maintenance'||Number(parsed.version)!==1||parsed.id!==id)throw new Error('Device Folder maintenance protection could not be verified.');
      // Acquisition already proved there was no live publication; any later cooperative publisher must observe this maintenance marker and stop.
      return true;
    }
    async function endDeviceMaintenance(directories,lease){const name=String(lease&&lease.name||'');if(!/^mnt_[a-f0-9]{32}\.sdmaintenance$/u.test(name))return false;await lease.settled?.();try{await directories.objects.removeEntry(name);return true;}catch(error){if(error&&error.name==='NotFoundError')return false;capture('device-backup.repository-maintenance-release',error);return false;}}
    function checkpointFilename(manifest){
      const id=String(manifest&&manifest.checkpoint&&manifest.checkpoint.checkpointId||'');
      if(!/^cp_[a-f0-9]{32}$/u.test(id))throw new Error('Device repository checkpoint identity is invalid.');
      return id+'.sdcheckpoint';
    }
    function updateRecoveryRows(rows){
      const values=Array.isArray(rows)?rows:[];checkpointCount=values.length;recoveryAvailable=checkpointCount>0;
      const latest=values.length?values[values.length-1]:null,name=String(latest&&latest.name||latest&&latest.ref&&latest.ref.name||'');if(name)lastFilename=name;
      return rows;
    }
    function updateRecoveryState(state){
      const valid=Array.isArray(state&&state.valid)?state.valid:[];
      if(!valid.length){updateRecoveryRows(valid);return state;}
      const rows=freeze(valid.map(row=>freeze({id:row.id,manifest:row.manifest}))),retainedIds=new Set(repository.selectRetention(rows,{now:new Date(nowMs())}).retained.map(row=>row.id));
      updateRecoveryRows(valid.filter(row=>retainedIds.has(row.id)));return state;
    }
    async function readCheckpointStateWork(directories,{signal=null,check=null}={}){
      const {checkpoints,commits}=directories,manifestEntries=[],commitEntries=[],unreadable=[];
      if(typeof checkpoints.entries!=='function'||typeof commits.entries!=='function')throw new Error('The selected folder cannot enumerate repository checkpoints.');
      const collect=async(directory,kind,pattern)=>{const items=[];let ignored=0;for(const [name,handle] of await readDirectoryEntries(directory,`Device Folder ${kind} directory`,signal,check)){assertOperationCurrent(signal);const text=String(name);if(!handle||handle.kind!=='file'||!pattern.test(text)){const suspicious=(kind==='commit'?/^cp_.*\.sdcommit$/u:/^cp_.*\.sdcheckpoint$/u).test(text);if(suspicious)unreadable.push(text);else ignored+=1;continue;}items.push(freeze({kind,name:text,handle}));}return freeze({items:freeze(items),ignored});};
      const [commitScan,checkpointScan]=await Promise.all([collect(commits,'commit',/^cp_[a-f0-9]{32}\.sdcommit$/u),collect(checkpoints,'checkpoint',/^cp_[a-f0-9]{32}\.sdcheckpoint$/u)]),work=[...commitScan.items,...checkpointScan.items],ignored=commitScan.ignored+checkpointScan.ignored;
      const parsed=await mapBounded(work,async item=>{
        try{
          assertOperationCurrent(signal);await check?.();const file=await readTimeout(item.handle.getFile(),`Device Folder ${item.kind} ${item.name}`,signal);assertOperationCurrent(signal);await check?.();
          if(item.kind==='commit'){const marker=await repository.inspectCommit(file);return freeze({kind:'commit',row:freeze({id:item.name.slice(0,-'.sdcommit'.length),ref:item.name,marker})});}
          const manifest=await repository.inspectManifest(file,{interactive:false});if(checkpointFilename(manifest)!==item.name)throw new Error('Checkpoint filename and manifest identity do not match.');return freeze({kind:'checkpoint',row:freeze({id:manifest.checkpoint.checkpointId,ref:item.name,manifest})});
        }catch(error){if(error&&(error.code==='DEVICE_MAINTENANCE_BUDGET'||error.name==='AbortError'))throw error;if(item.kind==='checkpoint'&&error&&error.code==='BACKUP_LOCKED')throw error;unreadable.push(item.name);capture(item.kind==='commit'?'device-backup.repository-commit':'device-backup.repository-manifest',error);return null;}
      });
      for(const result of parsed)if(result){if(result.kind==='commit')commitEntries.push(result.row);else manifestEntries.push(result.row);}
      const classified=repository.classifyState(freeze({manifests:freeze(manifestEntries),commits:freeze(commitEntries)}));
      for(const pair of classified.invalidPairs){unreadable.push(String(pair.manifest.ref||''));capture('device-backup.repository-manifest',pair.error);}
      // classifyState already validates each parsed commit marker against its paired manifest; reopening every marker here was duplicate immutable-state work.
      const valid=classified.committed.map(row=>freeze({id:row.id,name:String(row.ref||''),manifest:row.manifest,commitName:String(row.commitRef||'')}));
      const uncommitted=classified.uncommitted.map(row=>freeze({id:row.id,name:String(row.ref||''),manifest:row.manifest}));
      const orphanCommits=freeze(classified.orphanCommits.map(row=>String(row.ref||'')));
      return freeze({valid:freeze(valid),uncommitted:freeze(uncommitted),orphanCommits,unreadable:freeze(unreadable),ignored,latest:valid.length?valid[valid.length-1]:null});
    }

    async function readCheckpointState(directories,options={}){
      return readCheckpointStateWork(directories,options);
    }

    async function writeBlob(directory,name,file,{verify=null,onProgress=null}={}){
      await file.checkProtection?.();await file.checkSource?.();
      const fileHandle=await directory.getFileHandle(name,{create:true});
      const writable=await fileHandle.createWritable({keepExistingData:false});
      let closed=false;
      try{
        for(let offset=0;offset<file.blob.size;offset+=1048576){
          await file.checkProtection?.();await file.checkSource?.();await writable.write(file.blob.slice(offset,offset+1048576));onProgress?.('writing',Math.min(offset+1048576,file.blob.size),file.blob.size);
        }
        await file.checkProtection?.();await file.checkSource?.();
        if(!ownership.canMutate())throw new Error('Control changed before the backup was committed.');
        onProgress?.('closing',file.blob.size,file.blob.size);await writable.close();closed=true;
      }catch(error){
        if(!closed&&typeof writable.abort==='function'){try{await writable.abort();}catch(abortError){capture('device-backup.write-abort',abortError);}}
        throw error;
      }
      const reopened=await fileHandle.getFile();
      if(!reopened||Number(reopened.size)!==Number(file.blob.size))throw new Error('The written repository file size did not match after reopening.');
      if(verify){onProgress?.('verifying',file.blob.size,file.blob.size);await verify(reopened);}
      await file.checkProtection?.();await file.checkSource?.();
      return reopened;
    }
    async function repositoryAvailableObjectIds(objects,history,excludedObjectIds=null,signal=null){
      const excluded=new Set(Array.isArray(excludedObjectIds)?excludedObjectIds:[]),available=new Set(),candidates=[],seen=new Set();
      for(const manifest of history||[])for(const entry of manifest.objects||[]){if(excluded.has(entry.objectId)||seen.has(entry.objectId))continue;seen.add(entry.objectId);candidates.push(entry);}
      const checked=await mapBounded(candidates,async entry=>{assertOperationCurrent(signal);const existing=await fileOrNull(objects,entry.objectId+'.sdobject');assertOperationCurrent(signal);return freeze({id:entry.objectId,ok:!!existing&&Number(existing.size)===Number(entry.storedBytes)});});
      for(const row of checked)if(row.ok)available.add(row.id);return available;
    }
    async function writeRepositoryObject(objects,entry,onProgress=null){
      const name=entry.objectId+'.sdobject';
      if(entry.reused){
        const existing=await fileOrNull(objects,name);
        if(!existing||Number(existing.size)!==Number(entry.storedBytes))throw new Error('A referenced repository object is missing or incomplete. Run the device backup again after reconnecting the folder.');
        return false;
      }
      if(!(entry.blob instanceof Blob))throw new Error('A new repository object has no readable payload.');
      await writeBlob(objects,name,entry,{verify:file=>repository.verifyObject(file,entry),onProgress});
      return true;
    }
    function sameManifestIdentity(left,right){
      return !!left&&!!right&&left.checkpoint?.checkpointId===right.checkpoint?.checkpointId&&left.exportedAt===right.exportedAt&&left.sourceRevision===right.sourceRevision;
    }
    async function writeCheckpointManifest(checkpoints,name,file){
      return writeBlob(checkpoints,name,file,{verify:async reopened=>{
        const parsed=await repository.inspectManifest(reopened,{interactive:false});
        if(!sameManifestIdentity(parsed,file.manifest))throw new Error('The reopened device checkpoint manifest failed provenance verification.');
      }});
    }
    async function readObjectInventory(directories,{signal=null,check=null}={}){
      if(typeof directories.objects.entries!=='function')return freeze({items:freeze([]),overflow:false,invalidCount:1});
      const candidates=[];let invalidCount=0;
      for(const [name,handle] of await readDirectoryEntries(directories.objects,'Device Folder object directory',signal,check)){
        if(!/^obj_[a-f0-9]{32}\.sdobject$/u.test(String(name)))continue;
        if(!handle||handle.kind!=='file'){invalidCount+=1;continue;}candidates.push(freeze({name:String(name),handle}));
      }
      const rows=await mapBounded(candidates,async item=>{
        try{assertOperationCurrent(signal);await check?.();const file=await readTimeout(item.handle.getFile(),`Device Folder object ${item.name}`,signal);await check?.();const observed=new Date(Number(file.lastModified)||0).toISOString();return freeze({id:item.name.slice(0,-'.sdobject'.length),ref:freeze({name:item.name}),createdAt:observed,modifiedAt:observed});}
        catch(error){if(error&&(error.code==='DEVICE_MAINTENANCE_BUDGET'||error.name==='AbortError'))throw error;invalidCount+=1;capture('device-backup.repository-object-metadata',error);return null;}
      });
      return freeze({items:freeze(rows.filter(Boolean)),overflow:false,invalidCount});
    }
    async function cleanupRepository(directories,state,{maintenanceLease,signal=null,workBudget}={}){
      if(!maintenanceLease)throw new Error('Device Folder maintenance protection is required before repository cleanup.');
      await assertDeviceMaintenance(directories,maintenanceLease);
      const objectGraceBefore=new Date(nowMs()-OBJECT_GC_GRACE_MS).toISOString(),assertLease=async()=>assertDeviceMaintenance(directories,maintenanceLease);
      const cleanupRows=freeze(state.valid.map(row=>freeze({id:row.id,ref:freeze({name:row.name,commitName:row.commitName}),manifest:row.manifest}))),retentionBacklog=repository.selectRetention(cleanupRows,{now:new Date(nowMs())}).remove.length,checkpointDeleteBudget=Math.min(256,Math.max(16,retentionBacklog));
      const result=await repository.cleanup(freeze({
        checkpoints:cleanupRows,
        workBudget,inventoryBeforeDelete:true,beginDeletion:async()=>{await maintenanceLease.keepAlive(true);operationMark('maintenance-inventory-complete',{total:state.valid.length},maintenanceTraceId);workBudget?.start(MAINTENANCE_PASS_BUDGET_MS);},
        invalidCount:state.unreadable.length,ignoredCount:0,overflow:false,blockObjectGc:false,objectGraceBefore,maxCheckpointDeletes:checkpointDeleteBudget,maxObjectDeletes:64,
        incompleteArtifacts:freeze([...(state.uncommitted||[]).map(row=>freeze({kind:'checkpoint',ref:row.name})),...(state.orphanCommits||[]).map(name=>freeze({kind:'commit',ref:name}))]),
        deleteIncompleteArtifact:async artifact=>{assertOperationCurrent(signal);await assertLease();try{await directories[artifact.kind==='checkpoint'?'checkpoints':'commits'].removeEntry(artifact.ref);}catch(error){if(!error||error.name!=='NotFoundError')throw error;}return true;},
        deleteCheckpoint:async row=>{
          assertOperationCurrent(signal);await assertLease();try{await directories.checkpoints.removeEntry(row.ref.name);}catch(error){if(!error||error.name!=='NotFoundError')throw error;}
          if(row.ref.commitName){assertOperationCurrent(signal);await assertLease();try{await directories.commits.removeEntry(row.ref.commitName);}catch(error){if(!error||error.name!=='NotFoundError')throw error;}}
          return true;
        },
        listObjects:async()=>{
          assertOperationCurrent(signal);await assertLease();return readObjectInventory(directories,{signal,check:maintenanceLease.keepAlive});
        },
        deleteObject:async item=>{assertOperationCurrent(signal);await assertLease();try{await directories.objects.removeEntry(item.ref.name);return true;}catch(error){if(error&&error.name==='NotFoundError')return true;throw error;}},
        onError:(kind,error)=>capture('device-backup.repository-'+kind,error)
      }));
      return result;
    }

    async function cleanupDeviceRepositorySafely(directories,{signal=null,workBudget}={}){
      assertOperationCurrent(signal);
      let contentionRetryMs=0;const maintenanceLease=await beginDeviceMaintenance(directories,{signal,onBlocked:safety=>{const uncertain=Number(safety.publications&&safety.publications.invalid)||Number(safety.maintenances&&safety.maintenances.invalid)||0;if(uncertain)return;const deadlines=[safety.publications&&safety.publications.nextEligibleAt,safety.maintenances&&safety.maintenances.nextEligibleAt].map(value=>Date.parse(String(value||''))).filter(Number.isFinite);if(deadlines.length)contentionRetryMs=Math.max(1000,Math.min(...deadlines)-nowMs()+1000);}});
      if(!maintenanceLease)return freeze({warning:'Device Folder maintenance was deferred because another backup or maintenance operation is active.',retained:null,removedCheckpoints:0,checkpointDeferred:0,checkpointFailures:0,gcRemoved:0,gcDeferred:0,gcBudgetDeferred:0,gcFailures:0,gcSkipped:true,gcPending:true,maintenanceBlocked:true,contentionRetryMs,uncertainCount:0,selection:null});
      try{
        assertOperationCurrent(signal);
        // Inventory is read-only, progress-bounded and interruptible. Keep its
        // exclusion alive so an incomplete scan is never reused after a writer.
        // Only the destructive phase spends the short housekeeping allowance.
        operationMark('maintenance-inventory-start',{},maintenanceTraceId);
        const check=()=>maintenanceLease.keepAlive(),state=updateRecoveryState(await readCheckpointState(directories,{signal,check}));
        const cleanup=await cleanupRepository(directories,state,{maintenanceLease,signal,workBudget});
        if(Array.isArray(cleanup.retained))updateRecoveryRows(cleanup.retained);return cleanup;
      }finally{await endDeviceMaintenance(directories,maintenanceLease);}
    }


    function deviceBackgroundAbort(code,message){const error=new Error(message);error.name='AbortError';error.code=code;return error;}
        let maintenanceTraceId='';
    const maintenanceScheduler=background.createMaintenanceScheduler(freeze({
      intent:maintenanceIntent,budgetMs:0,budgetCode:'DEVICE_MAINTENANCE_BUDGET',budgetMessage:'Device Folder maintenance reached its work limit and will continue later.',preemptCode:'DEVICE_MAINTENANCE_PREEMPTED',preemptMessage:'Device Folder maintenance yielded to a higher-priority action.',
      capture:(phase,error)=>capture('device-backup.repository-maintenance-'+phase,error),
      isAvailable:()=>connected()?ownership.canMutate()?hooks.backgroundAvailable():'awaiting-control':'awaiting-connection',
      isBusy:()=>busy,
      execute:async({signal,workBudget})=>{operationMark('maintenance-repository-open-start',{},maintenanceTraceId);const directories=await repositoryDirectories();operationMark('maintenance-repository-open-complete',{},maintenanceTraceId);return cleanupDeviceRepositorySafely(directories,{signal,workBudget});},
      report:event=>{
        const phase=String(event&&event.phase||'');
        if(phase==='running'){
          maintenanceTraceId=operationStart('device-maintenance','Device Folder',{background:true,trigger:String(event.reason||'scheduled'),requestedAt:String(event.requestedAt||''),nextEligibleAt:String(event.nextEligibleAt||''),actionable:true});
          if(event.transition)operationMark('background-transition',event.transition,maintenanceTraceId);operationMark('maintenance-eligibility',{reason:String(event.reason||'scheduled'),requestedAt:String(event.requestedAt||''),nextEligibleAt:String(event.nextEligibleAt||''),actionable:true},maintenanceTraceId);publish();return;
        }
        if(phase==='cleanup-start'){operationMark('maintenance-cleanup-start',{},maintenanceTraceId);return;}
        if(phase==='cleanup-complete'){
          operationMark('maintenance-cleanup-complete',{...background.maintenanceDetails(event)},maintenanceTraceId);return;
        }
        if(['pending','completed','yielded','failed'].includes(phase)){
          if(event.transition)operationMark('background-transition',event.transition,maintenanceTraceId);
          if(phase==='failed'&&event.error)operationFail(event.error,{background:true,reason:String(event.reason||'error'),nextEligibleAt:String(event.nextEligibleAt||'')},maintenanceTraceId);
          else operationFinish(background.maintenanceDetails(event),maintenanceTraceId);
          maintenanceTraceId='';return;
        }
        if(phase==='settled'){publish();if(canSchedulePendingBackup())schedule();}
      }
    }));
    const automaticJob=background.registerJob('automatic',{initialDelayMs:null,discover:()=>settingsUnverified||!!directoryHandle&&hasNewerSourceRevision()&&currentSourceRevision()!==observedSourceRevision,
      isAvailable:()=>!installed?'startup':!ownership.canMutate()?'awaiting-control':busy||foregroundController?'foreground-busy':automaticSuspensions.size?'suspended':!settingsUnverified&&directoryHandle&&!connected()?'awaiting-connection':hooks.backgroundAvailable(),
      capture:error=>capture('device-backup.automatic-lifecycle',error),retryMs:MAINTENANCE_POLICY.errorMs,
      execute:async({trigger})=>{
        if(settingsUnverified)await inspectStored();
        if(settingsUnverified)return freeze({status:'unavailable',reason:'state-read-failed',pending:true});
        if(!directoryHandle)return freeze({status:'idle',reason:'off'});
        if(!connected())return freeze({status:'deferred',reason:'awaiting-connection',pending:true});
        await reconcileSourceRevision();
        if(Date.parse(automaticJob.status().nextEligibleAt)>nowMs())return freeze({status:'scheduled',pending:true});
        if(pendingRevision<=backedUpRevision)return freeze({status:'idle',reason:'none'});
        const result=await backupNow(automaticBackupReason(trigger)?trigger:'scheduled');
        return freeze({...result,status:result.ok?'completed':result.cancelled?'interrupted':'deferred',pending:pendingRevision>backedUpRevision});
      }
    });
    function automaticBackupReason(reason){return ['scheduled','important-change','automatic-retry'].includes(String(reason||''));}
    async function beginAutomaticBackupController(externalSignal=null){
      return background.beginBackground('automatic',{externalSignal,preemptCode:'DEVICE_AUTOMATIC_PREEMPTED',preemptMessage:'Automatic Device Folder backup yielded to a higher-priority action.'});
    }
    function beginForegroundController(externalSignal=null,kind='operation'){
      if(foregroundController)return null;
      const scope=background.beginForeground({externalSignal,cancelCode:'DEVICE_FOREGROUND_CANCELLED',cancelMessage:'Device Folder operation was cancelled.'});if(!scope)return null;
      foregroundController=scope.controller;foregroundKind=String(kind||'operation');publish();
      let released=false;
      const release=({resume=true}={})=>{
        if(released)return false;released=true;
        if(foregroundController===scope.controller){foregroundController=null;foregroundKind='';}scope.release();
        if(resume&&canSchedulePendingBackup())schedule();publish();return true;
      };
      const settled=scope.settled.catch(error=>{release();presentationState.message=error.message;publish();throw error;});settled.catch(()=>{});
      return freeze({controller:scope.controller,signal:scope.signal,settled,release});
    }
    function cancelForeground(reason='Device Folder operation was cancelled by the user.'){
      if(!foregroundController||foregroundController.signal.aborted)return false;
      foregroundController.abort(deviceBackgroundAbort('DEVICE_FOREGROUND_CANCELLED',reason));publish();return true;
    }

    async function applyCheckpointOperation(modeName,options={}){
      const exact=modeName==='restore-version',recoveryProgress=typeof options?.onProgress==='function'?options.onProgress:null;
      const recoveryPresentation=presentationScope;
      const reportRecovery=(stage,text,details={})=>{recoveryPresentation?.update({message:String(text||''),progress:{stage,...details}});if(typeof recoveryProgress==='function')try{recoveryProgress(freeze({stage,message:String(text||''),ok:true,...details}));}catch(error){capture('device-backup.recovery-progress',error);}};
      if(!exact&&modeName!=='bring-in')throw new TypeError('Unsupported Device Folder recovery mode.');
      // Missing-only recovery (after browser data was cleared) uses the newest
      // verified version saved before the clear, never prompts, and adds back
      // only what is absent. A version saved after the clear may hold the
      // reduced data, so it is never used.
      const missingOnly=!exact&&options?.missingOnly===true,missingBefore=Date.parse(String(options?.before||''));
      if(!supported)return freeze({ok:false,reason:'unsupported'});
      const traceId=operationStart(exact?'device-restore':'device-combine','Device Folder');
      if(!ownership.canMutate()){presentationState.message=exact?'Take control in this tab before restoring a Device Folder version.':'Take control in this tab before combining from a Device Folder backup.';publish();operationFinish({status:'skipped',reason:'ownership'},traceId);return freeze({ok:false,reason:'ownership'});}
      const foreground=beginForegroundController(options&&options.signal||null,modeName);if(!foreground){operationFinish({status:'skipped',reason:'busy'},traceId);return freeze({ok:false,reason:'busy'});}const signal=foreground.signal;
      operationMark('device-background-preemption-start',{},traceId);try{await foreground.settled;}catch(error){operationFail(error,{phase:'background-settlement'},traceId);return freeze({ok:false,reason:'background-unsettled',error});}operationMark('device-background-preemption-complete',{},traceId);
      if(busy){foreground.release();operationFinish({status:'skipped',reason:'busy'},traceId);return freeze({ok:false,reason:'busy'});}
      operationMark('device-permission-check-start',{},traceId);permission=await queryPermission(directoryHandle);operationMark('device-permission-check-complete',{granted:permission==='granted'},traceId);
      if(!connected()){mode=directoryHandle?'permission':'off';presentationState.message=directoryHandle?'Folder permission is required. Click Reconnect folder.':'Choose the backup folder before restoring.';foreground.release();publish();operationFinish({status:'skipped',reason:'permission'},traceId);return freeze({ok:false,reason:'permission'});}
      clearSchedule();busy=true;mode='connected';presentationState.message=exact?'Reading and verifying Device Folder version…':'Reading and verifying Device Folder backup…';publish();reportRecovery('history','Reading Device Folder backups…');
      try{
        operationMark('device-repository-open-start',{},traceId);const directories=await repositoryDirectories();operationMark('device-repository-open-complete',{},traceId);operationMark('recovery-history-scan-start',{provider:'device-folder'},traceId);const state=updateRecoveryState(await readCheckpointState(directories,{signal})),quarantinedObjectIds=await hooks.excludedObjectIds();operationMark('recovery-history-scan-complete',{provider:'device-folder',versions:state.valid.length,invalid:state.unreadable.length+state.uncommitted.length+state.orphanCommits.length},traceId);
        reportRecovery('verify','Verifying selected Device Folder backup…');
        const projected=repository.projectHistory(freeze(state.valid.map(row=>freeze({id:row.id,manifest:row.manifest}))),freeze({id:'device-folder',label:'Device Folder'}),{quarantinedObjectIds}),healthyIds=new Set(projected.map(entry=>entry.location.checkpointId)),healthyRows=state.valid.filter(row=>healthyIds.has(row.id));
        if(!healthyRows.length)throw new Error('No verified Study Director backup was found in this folder.');
        const newest=freeze([...healthyRows].reverse().map(row=>freeze({id:row.id,exportedAt:row.manifest.exportedAt,encrypted:row.manifest.encrypted,counts:row.manifest.counts})));
        const requestedId=String(options&&options.checkpointId||'');
        const missingSource=missingOnly?newest.find(row=>projected.some(entry=>entry.location.checkpointId===row.id&&entry.location.tier!=='before-restore')&&(!Number.isFinite(missingBefore)||Date.parse(String(row.exportedAt||''))<missingBefore)):null;
        if(missingOnly&&!missingSource){mode='connected';presentationState.message='No Device Folder version saved before browser data was cleared was found. Nothing was changed.';publish();operationFinish({cancelled:true,stage:'missing-only-source'},traceId);return freeze({ok:false,reason:'needs-decision'});}
        let checkpointId=requestedId||missingSource?.id||newest[0].id;
        if(requestedId&&!/^cp_[a-f0-9]{32}$/u.test(requestedId))throw new Error('The requested Device Folder version identity is invalid.');
        if(!requestedId&&!missingOnly&&newest.length>1){
          operationMark('checkpoint-selection-start',{provider:'device-folder'},traceId);
          try{checkpointId=String(await hooks.chooseCheckpoint(newest,freeze({mode:modeName}))||'');}
          catch(error){operationMark('checkpoint-selection-failed',{provider:'device-folder',reason:String(error&&error.code||error&&error.name||'Error')},traceId);throw error;}
          if(!checkpointId){operationMark('checkpoint-selection-cancelled',{provider:'device-folder'},traceId);presentationState.message='';operationFinish({cancelled:true,stage:'checkpoint-selection'},traceId);return freeze({ok:false,reason:'cancelled'});}
          operationMark('checkpoint-selection-complete',{provider:'device-folder'},traceId);
        }
        const row=healthyRows.find(candidate=>candidate.id===checkpointId);if(!row)throw new Error('The selected Device Folder backup is no longer available.');operationMark('checkpoint-selected',{provider:'device-folder'},traceId);
        const totalObjects=new Set((row.manifest.objects||[]).map(entry=>entry.objectId)).size,readSeen=new Set();let readCompleted=0;
        const readObject=async entry=>{
          const fresh=!readSeen.has(entry.objectId);if(fresh)readSeen.add(entry.objectId);reportRecovery('download','Reading backup data from Device Folder…',{current:readCompleted,total:totalObjects});
          const file=await fileOrNull(directories.objects,entry.objectId+'.sdobject');
          if(fresh){readCompleted+=1;reportRecovery('download','Reading backup data from Device Folder…',{current:readCompleted,total:totalObjects});}
          return file||null;
        };
        const managedRecovery=transaction=>hooks.managedRecovery(freeze({
          kind:modeName,label:'Device Folder',keepsActiveSession:missingOnly,apply:async()=>{reportRecovery('apply',exact?'Applying selected backup locally…':'Combining data locally…');const result=await transaction.apply();reportRecovery('verify-local','Verifying restored local data…');return result;},
          createSafety:async()=>{
            operationMark('external-safety-publication-start',{provider:'device-folder'},traceId);presentationState.message='Creating and verifying Before restore safety backup…';publish();reportRecovery('safety','Creating protected safety backup in Device Folder…');
            const safetyPurpose=modeName==='bring-in'?'before-combine':'before-restore';
            const safety=await writeConnectedCheckpoint('before-restore',{retention:{role:'before-restore',purpose:safetyPurpose},signal,traceId,onProgress:recoveryProgress},pendingRevision,freeze({directories,state}));
            if(!safety.ok)throw safety.error||new Error('The Before restore Device Folder safety backup could not be written.');
            const verified=await verifyProtectedCheckpoint(directories,safety.checkpointId,safety.manifest,{signal});operationMark('external-safety-publication-complete',{provider:'device-folder'},traceId);return verified;
          },
          publishPresent:async()=>{reportRecovery('finalize','Finalizing recovery…');
            if(exact){
              // Exact Device restore already points at an immutable checkpoint in this
              // repository. Treat the restored canonical revision as represented by
              // that checkpoint instead of publishing an identical second copy.
              backedUpRevision=pendingRevision;firstPendingAt=0;postStartPendingAt=0;
              savedSourceRevision=currentSourceRevision();lastFilename=row.name;lastBackupAt=String(row.manifest.exportedAt||'');
              await persistMetadata(metadataValue({sourceRevision:savedSourceRevision,lastFilename,lastBackupAt}));clearSchedule();
              return freeze({status:'completed',checkpointId:row.id,unchanged:true});
            }
            // Combine creates a genuinely new local state. Mark Device Backup dirty,
            // but let the normal automatic cadence publish it after recovery releases.
            if(pendingRevision<=backedUpRevision)pendingRevision+=1;
            if(!firstPendingAt)firstPendingAt=nowMs();
            return freeze({status:'completed',queued:true,reason:'normal-device-backup'});
          }
        }));
        operationMark('selected-checkpoint-inspection-start',{provider:'device-folder'},traceId);const candidate=await repository.inspect(row.manifest,readObject,{interactive:!missingOnly,signal,committed:true,managedRecovery,managedProgress:recoveryProgress});operationMark('selected-checkpoint-inspection-complete',{provider:'device-folder'},traceId);
        const result=exact?await repository.restoreVersion(candidate,{confirmed:options&&options.confirmed===true}):await repository.bringIn(candidate,{missingOnly,note:typeof options?.note==='string'?options.note:''});
        if(result&&result.cancelled){presentationState.message='';operationFinish({cancelled:true},traceId);return freeze({ok:false,reason:['needs-decision','note-missing','note-unchanged','note-kept'].includes(result.reason)?result.reason:'cancelled',checkpointId:row.id,result});}
        const convergence=result&&result.managedRecovery&&result.managedRecovery.present||freeze({status:'pending',reason:'post-operation backup status unavailable'});
        if(convergence.status!=='completed'){
          mode=connected()?'connected':(directoryHandle?'permission':'off');
          presentationState.message=connected()?(exact?'Version restore is complete. Device Folder status bookkeeping could not be refreshed; the selected checkpoint remains intact.':'Your data was combined locally. Device Folder convergence remains queued for the normal automatic backup cadence.'):(exact?'Version restore is complete. Reconnect Device Folder when convenient; the selected checkpoint remains intact.':'Your data was combined locally. Reconnect Device Folder so the normal automatic backup cadence can converge it.');
          operationFinish({ok:true,convergence:convergence.status},traceId);return freeze({ok:true,checkpointId:row.id,exportedAt:String(row.manifest.exportedAt||''),result,convergence});
        }
        presentationState.message='';operationFinish({ok:true,convergence:convergence.status},traceId);return freeze({ok:true,checkpointId:row.id,exportedAt:String(row.manifest.exportedAt||''),result,convergence});
      }catch(error){
        const cancelled=error?.name==='AbortError'||error?.code==='STUDY_DIRECTOR_IMPORT_CANCELLED'||error?.code==='DEVICE_FOREGROUND_CANCELLED';
        if(cancelled){mode='connected';presentationState.message='Recovery cancelled safely.';reportRecovery('cancelled','Recovery cancelled safely.');operationFinish({cancelled:true,reason:'cancelled'},traceId);return freeze({ok:false,reason:'cancelled',cancelled:true});}
        if(error&&error.code==='DEVICE_FOLDER_MISSING'){mode='off';presentationState.message=error.message+' Local data remains unchanged.';}
        else{mode='error';presentationState.message=userMessage(error,exact?'The selected Device Folder version could not be verified safely.':'The selected Device Folder backup could not be verified safely.')+' Local data remains protected by the existing restore safeguards.';}
        capture(exact?'device-backup.restore-version':'device-backup.bring-in',error);operationFail(error,{},traceId);return freeze({ok:false,reason:exact?'restore-version':'bring-in',error});
      }finally{busy=false;foreground.release();}
    }
    async function applyCheckpoint(modeName,options={}){
      if(busy||foregroundController)return freeze({ok:false,reason:'busy'});
      // The automatic missing-only recovery reports inline; the app shows its own notice.
      const quiet=options.missingOnly===true,scope=options.presentation||presentation.begin('device-folder',modeName,{label:'Device Folder',message:'Preparing recovery…',...(quiet?{foreground:false}:{})});presentationScope=scope;
      let result;
      try{result=await applyCheckpointOperation(modeName,options);return result;}
      finally{if(!options.presentation)scope.finish({lifecycle:result?.ok?'succeeded':result?.cancelled||['cancelled','needs-decision'].includes(result?.reason)?'cancelled':'failed',message:result?.ok?presentation.outcome(modeName,'Device Folder',result.convergence):result?.reason==='cancelled'?'Recovery cancelled safely.':result?.reason==='needs-decision'?presentationState.message||'Some differences need your choice. Nothing was changed.':presentationState.message||'Device Folder recovery could not be completed safely.'});if(presentationScope===scope)presentationScope=null;}
    }
    const restoreVersion=(options={})=>applyCheckpoint('restore-version',options);
    const bringIn=(options={})=>applyCheckpoint('bring-in',options);
    async function history(options={}){
      if(!supported)return freeze({sourceId:'device-folder',sourceLabel:'Device Folder',available:false,reason:'unsupported',entries:freeze([])});
      const interactive=options&&options.interactive===true,traceId=operationStart('device-history','Device Folder',{interactive}),foreground=interactive?beginForegroundController(options&&options.signal||null,'history'):null,signal=foreground?foreground.signal:options&&options.signal||null;
      if(interactive&&!foreground){operationFinish({available:false,reason:'busy'},traceId);return freeze({sourceId:'device-folder',sourceLabel:'Device Folder',available:false,reason:'busy',entries:freeze([])});}
      try{
        if(interactive){operationMark('device-background-preemption-start',{},traceId);await foreground.settled;operationMark('device-background-preemption-complete',{},traceId);}
        if(busy||background.status().active.includes('maintenance')||scrubRunning){operationFinish({available:false,reason:'busy'},traceId);return freeze({sourceId:'device-folder',sourceLabel:'Device Folder',available:false,reason:'busy',entries:freeze([])});}
        if(!directoryHandle){operationFinish({available:false,reason:'not-connected'},traceId);return freeze({sourceId:'device-folder',sourceLabel:'Device Folder',available:false,reason:'not-connected',entries:freeze([])});}
        operationMark('device-permission-check-start',{},traceId);permission=await queryPermission(directoryHandle);
        if(permission==='prompt'&&interactive)permission=await requestStoredPermission();operationMark('device-permission-check-complete',{granted:permission==='granted'},traceId);
        if(permission!=='granted'){operationFinish({available:false,reason:'permission'},traceId);return freeze({sourceId:'device-folder',sourceLabel:'Device Folder',available:false,reason:'permission',entries:freeze([])});}
        operationMark('device-repository-open-start',{},traceId);const directories=await repositoryDirectories();operationMark('device-repository-open-complete',{},traceId);operationMark('recovery-history-scan-start',{provider:'device-folder'},traceId);
        const state=updateRecoveryState(await readCheckpointState(directories,{signal})),quarantinedObjectIds=await hooks.excludedObjectIds(),rows=freeze(state.valid.map(row=>freeze({id:row.id,manifest:row.manifest}))),entries=repository.projectHistory(rows,freeze({id:'device-folder',label:'Device Folder'}),{quarantinedObjectIds});
        await scheduleRepositoryMaintenanceForState(state,MAINTENANCE_POLICY.continuationMs);
        operationMark('recovery-history-scan-complete',{provider:'device-folder',versions:entries.length,invalid:state.unreadable.length+state.uncommitted.length+state.orphanCommits.length},traceId);operationFinish({available:true,versions:entries.length},traceId);
        return freeze({sourceId:'device-folder',sourceLabel:'Device Folder',available:true,reason:'',entries});
      }catch(error){
        const cancelled=error?.name==='AbortError'||['DEVICE_FOREGROUND_CANCELLED','STUDY_DIRECTOR_IMPORT_CANCELLED'].includes(String(error?.code||''));
        if(cancelled){operationFinish({available:false,cancelled:true,reason:'cancelled'},traceId);return freeze({sourceId:'device-folder',sourceLabel:'Device Folder',available:false,reason:'cancelled',cancelled:true,entries:freeze([])});}
        capture('device-backup.version-history',error);operationFail(error,{},traceId);
        return freeze({sourceId:'device-folder',sourceLabel:'Device Folder',available:false,reason:String(error&&error.message||error),entries:freeze([])});
      }finally{foreground?.release();}
    }
    async function removeSafetyBackup(options={}){
      if(!supported)return freeze({removed:false,reason:'unsupported'});
      if(!ownership.canMutate()){presentationState.message='Take control in this tab before removing a safety backup.';publish();return freeze({removed:false,reason:'ownership'});}
      const foreground=beginForegroundController(options&&options.signal||null,'remove-safety');if(!foreground)return freeze({removed:false,reason:'busy'});
      try{await foreground.settled;}catch(error){return freeze({removed:false,reason:'background-unsettled',error});}
      if(busy){foreground.release();return freeze({removed:false,reason:'busy'});}
      permission=await queryPermission(directoryHandle);
      if(!connected()){mode=directoryHandle?'permission':'off';presentationState.message=directoryHandle?'Folder permission is required. Click Reconnect folder.':'Choose the backup folder before removing a safety backup.';foreground.release();publish();return freeze({removed:false,reason:'permission'});}
      const requested=String(options&&options.checkpointId||'');if(!/^cp_[a-f0-9]{32}$/u.test(requested)){foreground.release();return freeze({removed:false,reason:'invalid'});}
      busy=true;mode='connected';presentationState.message='Removing the selected Before restore safety backup…';publish();let removed=false,directories=null,maintenanceLease=null,after=null;
      try{
        directories=await repositoryDirectories();maintenanceLease=await beginDeviceMaintenance(directories,{signal:foreground.signal});
        if(!maintenanceLease){presentationState.message='Safety backup removal was deferred because another backup or maintenance operation is active.';return freeze({removed:false,reason:'busy'});}
        await assertDeviceMaintenance(directories,maintenanceLease);
        const state=updateRecoveryState(await readCheckpointState(directories,{signal:foreground.signal,check:maintenanceLease.keepAlive})),active=repository.activeProtected(state.valid,nowMs());
        if(!active||active.id!==requested)throw new Error('The selected Before restore safety backup is no longer protected.');
        const removedWasLast=lastFilename===active.name;
        if(active.commitName){await assertDeviceMaintenance(directories,maintenanceLease);try{await directories.commits.removeEntry(active.commitName);}catch(error){if(!error||error.name!=='NotFoundError')throw error;}}
        await assertDeviceMaintenance(directories,maintenanceLease);try{await directories.checkpoints.removeEntry(active.name);}catch(error){if(!error||error.name!=='NotFoundError')throw error;}removed=true;
        await assertDeviceMaintenance(directories,maintenanceLease);after=await readCheckpointState(directories,{signal:foreground.signal,check:maintenanceLease.keepAlive});updateRecoveryState(after);
        if(removedWasLast){const fallback=after.latest;lastFilename=fallback?.name||'';lastBackupAt=fallback?.manifest?.exportedAt||'';savedSourceRevision=fallback?.manifest?.sourceRevision||'';try{await persistMetadata(metadataValue());}catch(error){capture('device-backup.safety-backup-metadata',error);}}
        const servicedPending=await maintenanceIntent.read({throwOnError:true});let cleanup=null;
        try{cleanup=await cleanupRepository(directories,after,{maintenanceLease,signal:foreground.signal,workBudget:foreground.workBudget});}catch(error){
          capture('device-backup.safety-backup-cleanup',error);await maintenanceScheduler.request('error',MAINTENANCE_POLICY.errorMs,{mode:'replace'});presentationState.message='Safety backup removed. Unused backup storage will be cleaned up later.';
          const quarantinedObjectIds=await hooks.excludedObjectIds(),entries=repository.projectHistory(freeze(after.valid.map(row=>freeze({id:row.id,manifest:row.manifest}))),freeze({id:'device-folder',label:'Device Folder'}),{quarantinedObjectIds});
          return freeze({removed:true,checkpointId:requested,gcRemoved:0,checkpoints:after.valid.length,warning:String(error&&error.message||error),entries});
        }
        await maintenanceScheduler.adopt(cleanup,{trigger:'safety-removal',pending:servicedPending});
        const retained=Array.isArray(cleanup&&cleanup.retained)?cleanup.retained:after.valid;updateRecoveryRows(retained);
        const quarantinedObjectIds=await hooks.excludedObjectIds(),entries=repository.projectHistory(freeze(retained.map(row=>freeze({id:row.id,manifest:row.manifest}))),freeze({id:'device-folder',label:'Device Folder'}),{quarantinedObjectIds});presentationState.message='';return freeze({removed:true,checkpointId:requested,gcRemoved:Number(cleanup&&cleanup.gcRemoved)||0,checkpoints:retained.length,warning:String(cleanup&&cleanup.warning||''),entries});
      }catch(error){
        if(removed){capture('device-backup.safety-backup-cleanup',error);await maintenanceScheduler.request('error',MAINTENANCE_POLICY.errorMs,{mode:'replace'});presentationState.message='Safety backup removed. Unused backup storage will be cleaned up later.';const retained=after&&Array.isArray(after.valid)?after.valid:null;return freeze({removed:true,checkpointId:requested,gcRemoved:0,checkpoints:retained?retained.length:checkpointCount,warning:String(error&&error.message||error)});}
        presentationState.message=userMessage(error,'The selected safety backup could not be removed safely.');capture('device-backup.safety-backup-remove',error);return freeze({removed:false,reason:'remove',error});
      }finally{if(directories&&maintenanceLease)await endDeviceMaintenance(directories,maintenanceLease);busy=false;foreground.release();}
    }

    async function scrub(options={}){
      if(!supported)return freeze({status:'skipped',reason:'unsupported'});
      if(!ownership.canMutate())return freeze({status:'skipped',reason:'ownership'});
      if(busy||scrubRunning||pendingRevision>backedUpRevision)return freeze({status:'skipped',reason:'busy'});
      const sharedOwned=options&&options.backgroundOwned===true,sharedSignal=options&&options.signal||null;
      const scope=sharedOwned?freeze({signal:sharedSignal,release:()=>{}}):await background.beginBackground('integrity',{
        externalSignal:sharedSignal,
        budgetMs:INTEGRITY_SCRUB_BUDGET_MS,
        budgetCode:'DEVICE_INTEGRITY_BUDGET',budgetMessage:'Device Folder integrity verification reached its work limit and will continue later.',
        preemptCode:'DEVICE_INTEGRITY_PREEMPTED',preemptMessage:'Device Folder integrity verification yielded to a higher-priority action.'
      });
      if(!scope||!scope.signal)return freeze({status:'skipped',reason:'busy'});
      const checkpoint=sharedOwned?null:background.integrityCheckpoint(scope,options),onProgress=async progress=>{await options.onProgress?.(progress);checkpoint?.(progress);};
      permission=await queryPermission(directoryHandle);
      if(!connected()){scope.release();return freeze({status:'skipped',reason:'permission'});}
      const traceId=operationStart('device-integrity','Device Folder',{background:true,trigger:String(options&&options.trigger||'scheduled'),nextEligibleAt:String(options&&options.nextEligibleAt||''),cursor:String(options&&options.cursor||''),actionable:true});
      let result=freeze({status:'skipped',reason:'unknown'});backgroundTransition('integrity','scheduled','running',{reason:String(options&&options.trigger||'scheduled'),nextEligibleAt:String(options&&options.nextEligibleAt||''),actionable:true},traceId);operationMark('integrity-eligibility',{trigger:String(options&&options.trigger||'scheduled'),nextEligibleAt:String(options&&options.nextEligibleAt||''),cursor:String(options&&options.cursor||''),actionable:true},traceId);mode='connected';publish();
      const task=(async()=>{
        try{
          assertOperationCurrent(scope.signal);
          operationMark('integrity-repository-open-start',{},traceId);const directories=await repositoryDirectories();operationMark('integrity-repository-open-complete',{},traceId);assertOperationCurrent(scope.signal);
          operationMark('integrity-history-scan-start',{},traceId);const state=updateRecoveryState(await readCheckpointState(directories,{signal:scope.signal})),history=freeze(state.valid.map(row=>row.manifest));operationMark('integrity-history-scan-complete',{versions:history.length},traceId);
          if(state.unreadable?.length||state.invalidPairs?.length||state.uncommitted?.length||state.orphanCommits?.length)throw new Error('Device Folder history is incomplete or unreadable; integrity verification is unavailable.');
          if(!history.length)result=freeze({status:'completed',complete:true,cursor:'',checked:0,checkedBytes:0,total:0,quarantined:freeze([])});
          else{
            const readObject=async entry=>{assertOperationCurrent(scope.signal);const file=await fileOrNull(directories.objects,entry.objectId+'.sdobject');assertOperationCurrent(scope.signal);return file||null;};
            const readRange=async(entry,{offset,length})=>{const file=await readObject(entry);if(!file)throw Object.assign(new Error('Repository object is missing.'),{code:'REPOSITORY_OBJECT_MISSING'});if(file.size!==entry.storedBytes)throw Object.assign(new Error('Repository object size does not match its manifest.'),{code:'REPOSITORY_INTEGRITY_CORRUPT'});return {blob:file.slice(offset,offset+length),totalBytes:file.size,version:String(file.lastModified||0)+':'+file.size};};
            result=freeze({status:'completed',...(await repository.scrub(history,readObject,{...options,readRange,signal:scope.signal,onProgress}))});
          }
        }catch(error){
          const yielded=error?.name==='AbortError',budgeted=error?.code==='DEVICE_INTEGRITY_BUDGET',locked=error?.code==='BACKUP_LOCKED';
          const corrupt=['REPOSITORY_INTEGRITY_CORRUPT','REPOSITORY_OBJECT_MISSING'].includes(error?.code);
          const objectId=/^obj_[a-f0-9]{32}$/u.test(String(error?.repositoryObjectId||''))?String(error.repositoryObjectId):'';
          const progress=error.repositoryScrubProgress||{},prior=progress.quarantined||options.skipObjectIds||[];
          result=freeze({...progress,status:yielded?'yielded':corrupt?'failed':'unavailable',reason:yielded?(budgeted?'budget':'preempted'):locked?'locked':String(error?.message||error),objectId,objectKind:String(error?.repositoryObjectKind||''),corruption:corrupt,quarantined:freeze([...new Set([...prior,...(corrupt&&objectId?[objectId]:[])])])});
          if(!yielded)capture('device-backup.repository-integrity',error);
        }
        const actualRoot=options.repositoryHandle?(await repositoryDirectories()).root:null;
        const sameRepository=!options.repositoryHandle||(typeof actualRoot.isSameEntry==='function'?await actualRoot.isSameEntry(options.repositoryHandle):actualRoot===options.repositoryHandle);
        if(result.status==='failed'&&result.corruption&&result.objectId&&!scope.signal.aborted&&sameRepository){
          const repair=await backupNow('integrity-repair',{excludedObjectIds:[result.objectId],signal:scope.signal});
          result=freeze({...result,repaired:repair.ok===true,repairCheckpointId:repair.ok?String(repair.checkpointId||''):'',repairError:repair.ok?'':String(repair.error&&repair.error.message||repair.reason||'Backup repair failed.')});
        }
        const integrityState=background.outcome(result);backgroundTransition('integrity','running',integrityState,{reason:background.integrityDetails(result).reason,actionable:false},traceId);
        operationFinish(background.integrityDetails(result),traceId);
        return result;
      })();
      scrubRunning=task.catch(error=>{operationFail(error,{background:true,status:'unavailable'},traceId);throw error;}).finally(()=>{scrubRunning=null;publish();if(connected()&&pendingRevision>backedUpRevision&&!foregroundController)schedule();scope.release();});
      return scrubRunning;
    }
    async function verifyProtectedCheckpoint(directories,checkpointId,knownManifest=null,{signal=null}={}){
      let manifest=knownManifest;
      if(!manifest){const state=updateRecoveryState(await readCheckpointState(directories,{signal})),row=state.valid.find(candidate=>candidate.id===checkpointId);manifest=row&&row.manifest||null;}
      const retention=manifest&&manifest.retention,protectedUntil=Date.parse(retention&&retention.protectedUntil||'');
      if(!manifest||manifest.checkpoint?.checkpointId!==checkpointId||retention?.role!=='before-restore'||!Number.isFinite(protectedUntil)||protectedUntil<=nowMs())throw new Error('The protected safety backup could not be verified.');
      const readObject=async entry=>{assertOperationCurrent(signal);return await fileOrNull(directories.objects,entry.objectId+'.sdobject')||null;};
      await repository.verifyCheckpoint(manifest,readObject,{interactive:false,signal});
      return freeze({verified:true,checkpointId,protectedUntil:new Date(protectedUntil).toISOString(),sourceRevision:String(manifest.sourceRevision||''),source:'device-folder',purpose:String(retention&&retention.purpose||'before-restore')});
    }
    async function writeConnectedCheckpoint(reason='manual',options={},startedRevision=pendingRevision,repositoryContext=null){
      const operationPresentation=presentationScope,mark=(name,details={})=>operationMark(name,details,options.traceId);
      const scopedBackupProgress=(...args)=>{if(presentationScope===operationPresentation&&operationPresentation?.read()?.lifecycle==='running')reportBackupProgress(...args);};
      let directories=null,publicationLease=null,maintenanceQueued=false,maintenanceNeeded=false,published=null,newObjectCount=0,objectStarted=0,objectCompleted=0,totalObjectBytes=0;
      const objectProgressBytes=new Map(),signal=options&&options.signal||null,recoveryProgress=typeof options?.onProgress==='function'?options.onProgress:null;
      const recoveryPresentation=presentationScope;
      const reportRecovery=(stage,text,details={})=>{if(recoveryProgress)recoveryPresentation?.update({message:String(text||''),progress:{stage,...details}});if(typeof recoveryProgress==='function')try{recoveryProgress(freeze({stage,message:String(text||''),ok:true,...details}));}catch(error){capture('device-backup.recovery-progress',error);}};
      try{
        assertOperationCurrent(signal);mark('device-repository-open-start',{reason,reused:!!repositoryContext});setBackupStage('Opening the backup folder…');directories=repositoryContext&&repositoryContext.directories||await repositoryDirectories();mark('device-repository-open-complete',{reason,reused:!!repositoryContext});publicationLease=await beginDevicePublication(directories);mark('device-publication-lease-acquired',{reason});
        let state=repositoryContext&&repositoryContext.state||null;
        if(state)mark('device-repository-scan-reused',{reason,versions:state.valid.length});
        else{mark('device-repository-scan-start',{reason});setBackupStage('Reading existing backup versions…');state=updateRecoveryState(await readCheckpointState(directories,{signal}));mark('device-repository-scan-complete',{reason,versions:state.valid.length,invalid:state.unreadable.length+state.uncommitted.length+state.orphanCommits.length});}
        const maintenancePendingState=await maintenanceIntent.read();
        const maintenanceWasActionable=maintenanceIntent.actionable(maintenancePendingState);
        const activeProtected=repository.activeProtected(state.valid,nowMs()),newProtected=options&&options.retention&&options.retention.role==='before-restore';
        maintenanceNeeded=maintenanceWasActionable||repositoryStateNeedsMaintenance(state)||(newProtected&&!!activeProtected);
        setBackupStage('Checking existing backup objects…');const history=freeze(state.valid.map(row=>row.manifest)),persistedExcluded=await hooks.excludedObjectIds(),excludedObjectIds=freeze([...new Set([...(Array.isArray(options.excludedObjectIds)?options.excludedObjectIds:[]),...(Array.isArray(persistedExcluded)?persistedExcluded:[])])]),availableObjectIds=await repositoryAvailableObjectIds(directories.objects,history,excludedObjectIds,signal);
        try{
          setBackupStage('Preparing the current data…');mark('checkpoint-preparation-start',{provider:'device-folder',beforeRestore:reason==='before-restore'});
          const publishCheckpoint=reason==='before-restore'?repository.publishInline:repository.publish;
          published=await publishCheckpoint(history,{interactive:false,signal,availableObjectIds,excludedObjectIds,retention:options&&options.retention||null},freeze({
            writeObject:async(entry,prepared)=>{
              if(!newObjectCount){const fresh=prepared.objects.filter(object=>!object.reused);newObjectCount=fresh.length;totalObjectBytes=fresh.reduce((sum,object)=>sum+object.storedBytes,0);}
              const position=++objectStarted,aggregateBytes=()=>Math.min(totalObjectBytes,[...objectProgressBytes.values()].reduce((sum,value)=>sum+Math.max(0,Number(value)||0),0)),progress=(phase,written)=>{
                objectProgressBytes.set(position,Math.min(Number(entry.storedBytes)||0,Math.max(0,Number(written)||0)));const bytes=aggregateBytes();
                if(phase==='writing')scopedBackupProgress('Writing backup objects…',{current:objectCompleted,total:newObjectCount,completedBytes:bytes,totalBytes:totalObjectBytes});
                else scopedBackupProgress(phase==='closing'?'Finishing backup objects…':'Verifying backup objects…',{current:objectCompleted,total:newObjectCount,completedBytes:bytes,totalBytes:totalObjectBytes},{force:true});
                reportRecovery('safety-upload','Saving protected safety backup in Device Folder…',{current:objectCompleted,total:newObjectCount,completedBytes:bytes,totalBytes:totalObjectBytes});
              };
              objectProgressBytes.set(position,0);scopedBackupProgress('Writing backup objects…',{current:objectCompleted,total:newObjectCount,completedBytes:aggregateBytes(),totalBytes:totalObjectBytes},{force:true});
              reportRecovery('safety-upload','Saving protected safety backup in Device Folder…',{current:objectCompleted,total:newObjectCount,completedBytes:aggregateBytes(),totalBytes:totalObjectBytes});
              mark('device-object-write-start',{index:position,count:newObjectCount,bytes:entry.storedBytes});const receipt=await writeRepositoryObject(directories.objects,entry,progress);objectProgressBytes.set(position,Number(entry.storedBytes)||0);objectCompleted+=1;mark('device-object-write-complete',{index:position,count:newObjectCount,bytes:entry.storedBytes,completed:objectCompleted});reportRecovery('safety-upload','Saving protected safety backup in Device Folder…',{current:objectCompleted,total:newObjectCount,completedBytes:aggregateBytes(),totalBytes:totalObjectBytes});return receipt;
            },
            writeManifest:async file=>{mark('device-manifest-write-start',{});setBackupStage('Writing and verifying the backup version…');reportRecovery('safety-manifest','Finalizing protected safety backup in Device Folder…');await assertDevicePublication(directories,publicationLease);const name=checkpointFilename(file.manifest);try{await writeCheckpointManifest(directories.checkpoints,name,file);const projected=freeze([...state.valid.map(row=>freeze({id:row.id,manifest:row.manifest})),freeze({id:file.manifest.checkpoint.checkpointId,manifest:file.manifest})]);if(repository.selectRetention(projected,{now:new Date(Date.parse(file.manifest.exportedAt))}).remove.length)maintenanceNeeded=true;mark('device-manifest-write-complete',{});return freeze({name});}catch(error){try{await directories.checkpoints.removeEntry(name);}catch(cleanupError){if(cleanupError&&cleanupError.name!=='NotFoundError')capture('device-backup.repository-manifest-cleanup',cleanupError);}throw error;}},
            commit:async marker=>{mark('device-commit-start',{});setBackupStage('Committing the verified backup…');reportRecovery('safety-commit','Committing protected safety backup in Device Folder…');await assertDevicePublication(directories,publicationLease);const name=marker.checkpointId+'.sdcommit';try{await writeBlob(directories.commits,name,marker,{verify:file=>repository.inspectCommit(file)});mark('device-commit-complete',{});return freeze({name});}catch(error){try{await directories.commits.removeEntry(name);}catch(cleanupError){if(cleanupError&&cleanupError.name!=='NotFoundError')capture('device-backup.repository-commit-cleanup',cleanupError);}throw error;}},
            onCommitted:async context=>{
              setBackupStage('Updating backup status…');reportRecovery('safety-complete','Protected safety backup verified in Device Folder.');
              const completedAt=isoNow(),checkpointName=String(context.publication&&context.publication.name||''),committedSourceRevision=String(context.sourceRevision||currentSourceRevision());
              await persistMetadata(metadataValue({lastBackupAt:completedAt,lastFilename:checkpointName,sourceRevision:committedSourceRevision}));
              lastFilename=checkpointName;lastBackupAt=completedAt;savedSourceRevision=committedSourceRevision;checkpointCount=Math.max(1,state.valid.length+1);recoveryAvailable=true;
              backedUpRevision=Math.max(backedUpRevision,startedRevision);if(pendingRevision<=backedUpRevision){firstPendingAt=0;clearSchedule();}else firstPendingAt=postStartPendingAt||nowMs();
              resetAutomaticRetry();repository.markCompleted();mode='connected';presentationState.message='';mark('device-checkpoint-committed',{reason});return freeze({completedAt,checkpointName});
            },
            cleanup:async()=>{
              if(!maintenanceNeeded)return freeze({gcRemoved:0,checkpoints:checkpointCount,warning:''});
              setBackupStage('Scheduling backup maintenance…');maintenanceQueued=await markMaintenance('repository-state',1000)===true;
              return freeze({gcRemoved:0,checkpoints:checkpointCount,warning:maintenanceQueued?'':'The backup was committed, but required Device Folder maintenance could not be queued and will run before completion returns.'});
            },
            onFailure:async(_error,context)=>{if(context.committed)return;const commitName=String(context.commitReceipt&&context.commitReceipt.name||''),name=String(context.publication&&context.publication.name||'');if(commitName)try{await directories.commits.removeEntry(commitName);}catch(cleanupError){if(cleanupError&&cleanupError.name!=='NotFoundError')capture('device-backup.repository-commit-cleanup',cleanupError);}if(name)try{await directories.checkpoints.removeEntry(name);}catch(cleanupError){if(cleanupError&&cleanupError.name!=='NotFoundError')capture('device-backup.repository-manifest-cleanup',cleanupError);}await markMaintenance('failure-cleanup',MAINTENANCE_POLICY.continuationMs);}
          }));
        }finally{setBackupStage('Finalizing backup…');const released=await endDevicePublication(directories,publicationLease);publicationLease=null;await resumeMaintenanceAfterPublication(released);}
        let fallbackCleanup=null;
        if(maintenanceNeeded&&!maintenanceQueued){setBackupStage('Finishing required backup maintenance…');try{const servicedPending=await maintenanceIntent.read({throwOnError:true});fallbackCleanup=await cleanupDeviceRepositorySafely(directories);const followUp=await maintenanceScheduler.adopt(fallbackCleanup,{trigger:'post-publication-fallback',pending:servicedPending});maintenanceQueued=followUp.pending===true;}catch(error){capture('device-backup.repository-maintenance-fallback',error);maintenanceQueued=await maintenanceScheduler.request('error',MAINTENANCE_POLICY.errorMs,{mode:'replace'})===true;}}
        const cleanup=published.cleanupResult||{},committed=published.committedResult||{},warning=[String(published.warning||''),String(cleanup.warning||''),String(fallbackCleanup&&fallbackCleanup.warning||'')].filter(Boolean).join(' ');
        return freeze({ok:true,reason,checkpointId:published.checkpointId,manifest:published.manifest,sourceRevision:published.sourceRevision,lastBackupAt:String(committed.completedAt||lastBackupAt),objectsWritten:published.objectsWritten,objectsReused:published.objectsReused,writtenBytes:published.writtenBytes,attachmentBytesWritten:published.attachmentBytesWritten,gcRemoved:Number(fallbackCleanup&&fallbackCleanup.gcRemoved)||0,checkpoints:checkpointCount,maintenancePending:maintenanceQueued,warning});
      }catch(error){
        if(directories&&publicationLease)await endDevicePublication(directories,publicationLease);
        const cancelled=error?.name==='AbortError'||error?.code==='DEVICE_FOREGROUND_CANCELLED'||error?.code==='STUDY_DIRECTOR_IMPORT_CANCELLED';
        if(cancelled){mode=connected()?'connected':(directoryHandle?'permission':'off');presentationState.message='Backup cancelled safely.';return freeze({ok:false,reason:'cancelled',cancelled:true,error});}
        setBackupStage('Checking the backup folder after an error…');
        if(error&&error.code==='DEVICE_FOLDER_MISSING'){permission='unknown';mode='off';presentationState.message=error.message+' Normal app saving continues.';}
        else{permission=await queryPermission(directoryHandle);mode=permission==='granted'?'error':(directoryHandle?'permission':'off');const locked=error&&error.code==='BACKUP_LOCKED';presentationState.message=(locked?'Encrypted automatic backups are paused. Unlock backup encryption in this tab.':userMessage(error,'Automatic device backup could not be completed safely.'))+' Normal app saving continues.';}
        capture('device-backup.write',error);return freeze({ok:false,reason:'write',error});
      }
    }
    async function backupNow(reason='manual',options={}){
      if(!supported)return freeze({ok:false,reason:'unsupported'});
      const normalizedReason=String(reason||'manual'),manual=normalizedReason==='manual',connectForeground=normalizedReason==='connect',foregroundOperation=manual||connectForeground,automatic=automaticBackupReason(normalizedReason),integrityRepair=normalizedReason==='integrity-repair',traceId=normalizedReason==='before-restore'?'':operationStart('device-backup','Device Folder',{reason:normalizedReason,background:automatic||integrityRepair});
      if(!ownership.canMutate()){presentationState.message='Take control in this tab before writing a device backup.';publish();if(traceId)operationFinish({ok:false,reason:'ownership'},traceId);return freeze({ok:false,reason:'ownership'});}
      if((automatic||integrityRepair)&&foregroundController){if(traceId)operationFinish({ok:false,reason:'foreground'},traceId);return freeze({ok:false,reason:'foreground'});}
      let foreground=null,automaticScope=null;
      if(foregroundOperation){foreground=beginForegroundController(options&&options.signal||null,manual?'backup':connectForeground?'connect':'operation');if(!foreground){if(traceId)operationFinish({ok:false,reason:'busy'},traceId);return freeze({ok:false,reason:'busy'});}if(manual)resetAutomaticRetry();operationMark('device-background-preemption-start',{},traceId);try{await foreground.settled;}catch(error){if(traceId)operationFail(error,{phase:'background-settlement'},traceId);return freeze({ok:false,reason:'background-unsettled',error});}operationMark('device-background-preemption-complete',{},traceId);}
      if(busy){foreground?.release();if(traceId)operationFinish({ok:false,reason:'busy'},traceId);return freeze({ok:false,reason:'busy'});}
      if(automatic){automaticScope=await beginAutomaticBackupController(options&&options.signal||null);if(!automaticScope){if(traceId)operationFinish({ok:false,reason:'background-busy'},traceId);return freeze({ok:false,reason:'background-busy'});}}
      presentationScope=presentation.begin('device-folder','backup',{label:'Device Folder',foreground:foregroundOperation,message:'Preparing backup…'});busy=true;mode=directoryHandle?'connected':'off';setBackupStage('Checking folder permission…');
      const signal=foreground?foreground.signal:automaticScope?automaticScope.signal:options&&options.signal||null;
      let result;
      try{
        operationMark('device-permission-check-start',{},traceId);permission=await queryPermission(directoryHandle);operationMark('device-permission-check-complete',{granted:permission==='granted'},traceId);
        if(!connected()){
          mode=directoryHandle?'permission':'off';presentationState.message=directoryHandle?'Folder permission is required. Click Reconnect folder.':'Choose a folder before backing up.';
          if(traceId)operationFinish({ok:false,reason:'permission'},traceId);return result=freeze({ok:false,reason:'permission'});
        }
        mode='connected';const startedRevision=pendingRevision;
        activeBackupRevision=startedRevision;postStartPendingAt=0;
        result=await writeConnectedCheckpoint(reason,{...options,signal,traceId},startedRevision);if(traceId){if(result&&result.ok)operationFinish({ok:true,objectsWritten:Number(result.objectsWritten)||0,objectsReused:Number(result.objectsReused)||0,writtenBytes:Number(result.writtenBytes)||0},traceId);else if(result&&result.cancelled)operationFinish({cancelled:true,reason:'cancelled'},traceId);else operationFail(result&&result.error||new Error(String(result&&result.reason||'Device backup failed.')),{},traceId);}return result;
      }finally{
        activeBackupRevision=0;postStartPendingAt=0;
        if(automatic&&result?.cancelled&&String(result.error?.code||signal?.reason?.code||'')==='DEVICE_AUTOMATIC_PREEMPTED'){mode=connected()?'connected':mode;presentationState.message='';}
        clearBackupStage();
        presentationScope?.finish({lifecycle:result?.ok?'succeeded':result?.cancelled?'cancelled':'failed',message:result?.ok?'External backup verified in Device Folder.':result?.cancelled?'Backup cancelled safely.':presentationState.message||'Device Folder backup could not be completed. Retry or reconnect the folder.'});presentationScope=null;
        busy=false;publish();
        // Publication owns its success, locked and write-failure retry policy.
        if(automaticScope)automaticScope.release();if(foreground)foreground.release({resume:false});
        if(result?.ok){clearSchedule();if(canSchedulePendingBackup())schedule();}
        else if(result?.reason==='write'&&result.error?.code!=='BACKUP_LOCKED'&&canSchedulePendingBackup())scheduleRetry();
      }
    }
    async function createProtectedSafety(purpose='before-clear-library',options={}){
      const safetyPurpose=String(purpose||'before-clear-library');
      if(!['before-restore','before-combine','before-clear-library'].includes(safetyPurpose))throw new TypeError('Protected safety purpose is invalid.');
      if(!supported)return freeze({verified:false,skipped:true,reason:'unsupported'});
      if(!ownership.canMutate())return freeze({verified:false,skipped:true,reason:'ownership'});
      const foreground=beginForegroundController(options&&options.signal||null,'safety');if(!foreground)return freeze({verified:false,skipped:true,reason:'busy'});const signal=foreground.signal;
      let started=false;
      try{
        await foreground.settled;
        if(busy)return freeze({verified:false,skipped:true,reason:'busy'});
        permission=await queryPermission(directoryHandle);
        if(!connected())return freeze({verified:false,skipped:true,reason:directoryHandle?'permission':'not-connected'});
        busy=true;started=true;mode='connected';presentationState.message='Creating protected safety backup…';publish();
        const directories=await repositoryDirectories(),state=updateRecoveryState(await readCheckpointState(directories,{signal}));
        const safety=await writeConnectedCheckpoint('before-restore',{retention:{role:'before-restore',purpose:safetyPurpose},signal},pendingRevision,freeze({directories,state}));
        if(!safety.ok)throw safety.error||new Error('The protected Device Folder safety backup could not be written.');
        return await verifyProtectedCheckpoint(directories,safety.checkpointId,safety.manifest,{signal});
      }finally{if(started){busy=false;presentationState.message='';}foreground.release();}
    }
    async function disconnect(){
      if(!ownership.canMutate()){presentationState.message='Take control in this tab before turning off device backup.';return publish();}
      const foreground=beginForegroundController(null,'disconnect');if(!foreground)return snapshot();
      try{await foreground.settled;}catch(error){capture('device-backup.disconnect-settlement',error);return publish();}
      if(busy){foreground.release();return snapshot();}
      clearSchedule();clearMaintenanceSchedule();busy=true;presentationState.message='Turning off automatic device backup…';publish();
      try{
        await storage.remove(config.metadataKey);await maintenanceIntent.clear();background.clearScheduled('maintenance');background.clearScheduled('integrity');
        directoryHandle=null;permission='unknown';lastBackupAt='';lastFilename='';savedSourceRevision='';recoveryAvailable=false;checkpointCount=0;
        settingsUnverified=false;
        pendingRevision=0;backedUpRevision=0;firstPendingAt=0;activeBackupRevision=0;postStartPendingAt=0;resetAutomaticRetry();automaticSuspensions.clear();mode='off';presentation.reset('device-folder');presentationState.message='';
      }catch(error){
        mode='error';presentationState.message='Automatic device backup could not be turned off. Try again; normal app saving continues.';
        capture('device-backup.disconnect',error);
      }finally{busy=false;foreground.release();publish();}
      return snapshot();
    }
    // Clearing browser data removes the stored folder settings while this page
    // still holds the folder. They are written back once local data is whole
    // again, so a later launch finds the same folder.
    async function rememberAfterStorageReset(){
      if(!supported||!directoryHandle||!ownership.canMutate())return false;
      try{await persistMetadata(metadataValue());settingsUnverified=false;return true;}
      catch(error){capture('device-backup.storage-reset-remember',error);return false;}
    }
    async function install(){
      if(installed)return snapshot();
      installed=true;publish();const state=await inspectStored();background.wake('startup');return state;
    }
    return freeze({
      format:'study-director.device-backup',contractVersion:1,
      install,status:snapshot,diagnosticMaintenance:()=>maintenanceScheduler.status(),connect,disconnect,backupNow,createProtectedSafety,cancelForeground,restoreVersion,bringIn,history,removeSafetyBackup,scrub,notifyChange,suspendAutomatic,resumeAutomatic,syncOwnership,refreshPermission,rememberAfterStorageReset,repositoryHandle:async()=>{if(!connected())throw new Error('Device Folder is unavailable.');return (await repositoryDirectories()).root;}
    });
  }
  return freeze({format:'study-director.device-backup-module',contractVersion:1,createController});
});
})();
