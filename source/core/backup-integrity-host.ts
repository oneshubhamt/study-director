import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {AssetIssue,AuditProgress} from '../../types/asset-storage.ts';
import type {IntegrityResult,IntegrityTarget as ProviderIntegrityTarget} from '../../types/repository-background.ts';
import type {BackupIntegrityController,BackupIntegrityHostContract,BackupIntegrityInput,RepositoryIntegrityState,RepositoryIntegrityTarget} from '../../types/backup-integrity-host.ts';

const sdBackupIntegrityHostFactory=(()=>{
'use strict';
const registry=(globalThis as unknown as Record<symbol,unknown>)[Symbol.for('studyDirector.internalModules.v1')] as ModuleRegistration<'backup-integrity-host','study-director.backup-integrity-host-module'>|undefined;
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1)throw new Error('Study Director internal module registry is unavailable or incompatible.');
const freeze=Object.freeze,LOCATION=/^[a-z][a-z0-9-]{0,40}$/u,OBJECT=/^obj_[a-f0-9]{32}$/u,SCAN=/^[a-f0-9]{64}$/u,REQUEST=/^[a-f0-9-]{36}$/u;
const fields=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'?value as Record<string,unknown>:Object.create(null) as Record<string,unknown>;
const iso=(value:unknown):string=>{const text=String(value||'');return Number.isFinite(Date.parse(text))?new Date(text).toISOString():'';};

function normalizeAttachmentIssue(value:unknown,validId:(value:unknown)=>boolean):AssetIssue|null{
  const row=fields(value),kind=String(row['kind']||'');
  if(!['missing-file','size-mismatch','metadata-invalid','missing-metadata'].includes(kind))return null;
  const rawId=String(row['id']||''),id=validId(rawId)?rawId:'';
  const issue:AssetIssue={id,kind:kind as AssetIssue['kind']};
  if(Number.isSafeInteger(row['expectedSize']))issue.expectedSize=Number(row['expectedSize']);
  if(Number.isSafeInteger(row['actualSize']))issue.actualSize=Number(row['actualSize']);
  return freeze(issue);
}
function normalizeAttachmentState(value:unknown,validId:(value:unknown)=>boolean){
  const row=fields(value),issues=Array.isArray(row['issues'])?row['issues'].map(item=>normalizeAttachmentIssue(item,validId)).filter((item):item is AssetIssue=>item!==null):[];
  const raw=fields(row['progress']),progress=SCAN.test(String(raw['scanId']||''))&&Number.isSafeInteger(raw['cursor'])&&Number(raw['cursor'])>=0&&Number.isSafeInteger(raw['checked'])&&Number(raw['checked'])>=0&&Number.isSafeInteger(raw['total'])&&Number(raw['total'])>=Number(raw['cursor'])
    ?freeze({scanId:String(raw['scanId']),cursor:Number(raw['cursor']),checked:Number(raw['checked']),total:Number(raw['total']),issues:freeze((Array.isArray(raw['issues'])?raw['issues']:[]).map(item=>normalizeAttachmentIssue(item,validId)).filter((item):item is AssetIssue=>item!==null))} satisfies AuditProgress):null;
  const lastOutcome=['completed','yielded','unavailable','skipped'].includes(String(row['lastOutcome']||''))?String(row['lastOutcome']):'';
  return freeze({version:2 as const,checkedAt:iso(row['checkedAt']),attemptedAt:iso(row['attemptedAt']),lastOutcome,progress,issues:freeze(issues)});
}
function normalizeRepositoryTarget(value:unknown,normalizeContinuation:(value:unknown)=>import('../../types/integrity-continuation.ts').IntegrityState|null):RepositoryIntegrityTarget{
  const row=fields(value),seen=new Set<string>(),quarantined:string[]=[];
  for(const raw of Array.isArray(row['quarantinedObjectIds'])?row['quarantinedObjectIds']:[]){const id=String(raw||'');if(!OBJECT.test(id)||seen.has(id))continue;seen.add(id);quarantined.push(id);}
  const recheck=row['recheck']===true,history=freeze((Array.isArray(row['history'])?row['history']:[]).slice(-8).flatMap(raw=>{
    const item=fields(raw),at=iso(item['at']),outcome=String(item['outcome']||'');
    return at&&['completed','yielded','failed','unavailable','skipped'].includes(outcome)?[freeze({at,outcome,complete:item['complete']===true})]:[];
  }));
  return freeze({
    repositoryScope:typeof row['repositoryScope']==='string'&&row['repositoryScope'].length<=320?row['repositoryScope']:'',
    scanId:SCAN.test(String(row['scanId']||''))?String(row['scanId']):'',
    partial:normalizeContinuation(row['partial']),recheck,
    recheckCursor:recheck&&OBJECT.test(String(row['recheckCursor']||''))?String(row['recheckCursor']):'',
    requestId:REQUEST.test(String(row['requestId']||''))?String(row['requestId']):'',
    blockedReason:['locked','budget','preempted','unavailable','permission','corrupt'].includes(String(row['blockedReason']||''))?String(row['blockedReason']):'',
    completedAt:iso(row['completedAt']),cycleStartedAt:iso(row['cycleStartedAt']),
    cursor:OBJECT.test(String(row['cursor']||''))?String(row['cursor']):'',failedAt:iso(row['failedAt']),attemptedAt:iso(row['attemptedAt']),
    lastOutcome:['completed','yielded','failed','unavailable','skipped'].includes(String(row['lastOutcome']||''))?String(row['lastOutcome']):'',
    history,quarantinedObjectIds:freeze(quarantined)
  });
}
function normalizeRepositoryState(value:unknown,normalizeContinuation:(value:unknown)=>import('../../types/integrity-continuation.ts').IntegrityState|null):RepositoryIntegrityState{
  const row=fields(value),rawLocations=fields(row['locations']),locations:Record<string,RepositoryIntegrityTarget>=Object.create(null) as Record<string,RepositoryIntegrityTarget>;
  if(Number(row['version'])===7)for(const [id,target] of Object.entries(rawLocations))if(LOCATION.test(id))locations[id]=normalizeRepositoryTarget(target,normalizeContinuation);
  return freeze({version:7 as const,locations:freeze(locations)});
}

function repositoryChanged(){return Object.assign(new Error('The backup repository changed during integrity verification.'),{code:'REPOSITORY_CHANGED'});}
function projectRepositoryResult(current:RepositoryIntegrityTarget,result:IntegrityResult,now:string){
  if(!result.repositoryScope||current.repositoryScope!==result.repositoryScope)throw repositoryChanged();
  const last=current.history.at(-1),daily=last?.at.slice(0,10)===now.slice(0,10)?current.history.slice(0,-1):current.history;
  if(current.requestId!==String(result.requestId||'')){
    if(result.complete!==true||result.status!=='completed'||result.corruption||result.checkpointOnly)throw repositoryChanged();
    return {...current,attemptedAt:now,completedAt:now,lastOutcome:'completed',blockedReason:'',history:[...daily,{at:now,outcome:'completed',complete:true}].slice(-8)};
  }
  const quarantine=result.status==='unavailable'?[...new Set([...current.quarantinedObjectIds,...(result.quarantined||[])])]:result.quarantined===undefined?current.quarantinedObjectIds:result.quarantined;
  const hasProgress=Object.hasOwn(result,'cursor')&&Object.hasOwn(result,'scanId'),progress=hasProgress?{cursor:result.cursor||'',scanId:result.scanId||'',...(Object.hasOwn(result,'recheckCursor')?{recheckCursor:result.recheckCursor||''}:{}),...(Object.hasOwn(result,'partial')?{partial:result.partial??null}:{})}:{};
  const blockedReason=['locked','budget','preempted','permission'].includes(String(result.reason||''))?String(result.reason):result.status==='unavailable'?'unavailable':result.corruption?'corrupt':'',outcome={attemptedAt:now,lastOutcome:result.status,blockedReason,history:result.checkpointOnly?current.history:[...daily,{at:now,outcome:result.status,complete:result.complete===true&&['completed','failed'].includes(result.status)}].slice(-8)};
  const finished=current.recheck&&result.recheckComplete===true&&result.status==='failed'&&result.corruption===true;
  if(result.complete===true&&(result.status==='completed'||finished))return {...current,...outcome,completedAt:now,cycleStartedAt:'',cursor:'',recheckCursor:'',scanId:'',partial:null,recheck:false,failedAt:finished?now:'',quarantinedObjectIds:quarantine};
  if(['completed','yielded','failed','unavailable','skipped'].includes(result.status))return {...current,...progress,...outcome,partial:'partial' in progress?progress.partial:result.corruption?null:current.partial,cycleStartedAt:hasProgress?current.cycleStartedAt||now:current.cycleStartedAt,failedAt:['failed','unavailable'].includes(result.status)?now:current.failedAt,quarantinedObjectIds:quarantine};
  return current;
}

function createController(input:Readonly<BackupIntegrityInput>):Readonly<BackupIntegrityController>{
  const {lifecycle,metadata,storage,references,provider,backgroundTasks,diagnostics,environment,limits}=input;
  if(metadata.attachment.owner!=='host')throw new TypeError(`Attachment integrity metadata is owned by host, not ${metadata.attachment.owner||'unknown'}.`);
  if(metadata.repository.owner!=='backup')throw new TypeError(`Repository integrity metadata is owned by backup, not ${metadata.repository.owner||'unknown'}.`);
  let attachmentView:ReturnType<typeof normalizeAttachmentState>|null=null,repositoryView:RepositoryIntegrityState|null=null,repositoryWriteChain=Promise.resolve();
  let attachmentIssues=new Map<string,AssetIssue>();
  const boundScopes:Record<string,string>=Object.create(null) as Record<string,string>,live:Record<string,{done:number;total:number}>=Object.create(null) as Record<string,{done:number;total:number}>,recheckAsked:Record<string,boolean>=Object.create(null) as Record<string,boolean>,rowError:Record<string,string>=Object.create(null) as Record<string,string>;

  function status(target:unknown,{shallow=false,running=false,liveProgress=null as {done:number;total:number}|null}={}){
    const value=fields(target),completed=String(value['completedAt']||value['checkedAt']||''),files=shallow?'attachments':'backup files';
    const between=!!(value['partial']||value['progress']||value['cursor']||value['cycleStartedAt']),damaged=Array.isArray(value['quarantinedObjectIds'])?value['quarantinedObjectIds'].length:0;
    const count=liveProgress&&Number.isFinite(liveProgress.total)&&liveProgress.total>0?` ${Math.min(liveProgress.done||0,liveProgress.total)} of ${liveProgress.total} ${files}`:'';
    const blocked=String(value['blockedReason']||''),outcome=String(value['lastOutcome']||''),recheck=value['recheck']===true;
    const head=running?`Checking…${count}`:blocked==='locked'?'Paused until backup encryption is unlocked':blocked==='preempted'?'Paused while another backup task runs; continues by itself':outcome==='unavailable'?(recheck?'Recheck could not run this time; it will try again':'Could not check this time; it will try again'):recheck?(blocked==='corrupt'?`Recheck continuing; some ${files} are still damaged`:'Recheck requested; starts in a moment'):damaged?`${damaged} damaged backup file${damaged===1?'':'s'}; the next backup writes fresh copies`:between?`Checking in small steps${count?`;${count} so far`:''}; continues by itself`:completed?(shallow?'All attachments present':`All ${files} intact`):'Not checked yet';
    const parts=[completed?`Last full check: ${new Date(completed).toLocaleString()}`:'No full check yet'],partial=fields(value['partial']),progress=fields(value['progress']);
    if(value['partial']){const stored=fields(partial['stored']);parts.push(`${Math.floor(Number(stored['offset'])/1048576)} of ${Math.ceil(Number(partial['storedBytes'])/1048576)} MB of a large file read${partial['phase']==='plain'?'; checking its decrypted content':''}`);}
    else if(value['progress'])parts.push(`${Number(progress['cursor'])||0} of ${Number(progress['total'])||0} records`);
    if(damaged&&recheck)parts.push(`${damaged} damaged`);if(shallow)parts.push('File contents are not checked.');
    return freeze({head,detail:parts.join(' · ')});
  }
  function render(){
    let jobs:readonly Record<string,unknown>[]=[];try{jobs=provider.backgroundStatus() as readonly Record<string,unknown>[];}catch{jobs=[];}
    for(const [id,label,location] of [['attachment-verification-status','Attachment presence and size',''],['device-verification-status','Device Folder','device-folder'],['drive-verification-status','Google Drive','google-drive']] as const){
      const element=input.document.getElementById(id);if(!element)continue;
      const value=location?repositoryView?.locations[location]:attachmentView,scope=value&&'repositoryScope' in value?value.repositoryScope:'',bound=!location||!!scope&&boundScopes[location]===scope;
      const running=!!location&&jobs.some(row=>row['job']===location+' integrity'&&row['running']===true);
      if(location&&value&&'recheck' in value&&value.recheck)recheckAsked[location]=false;
      const shown=bound?status(value,{shallow:!location,running,liveProgress:location?live[location]||null:null}):freeze({head:'Not connected',detail:'Connect it to check its backups.'});
      const error=location?rowError[location]||'':'',name=input.document.createElement('strong'),head=input.document.createElement('span'),detail=input.document.createElement('span');
      name.textContent=label+': ';head.className='verification-head';head.textContent=error||shown.head;detail.className='verification-detail';detail.textContent=' '+shown.detail;
      element.classList.toggle('verification-error',!!error);element.replaceChildren(name,head,detail);
      const recheck=location&&input.document.getElementById('recheck-'+location);if(recheck instanceof HTMLButtonElement){const busy=bound&&(recheckAsked[location]===true||!!(value&&'recheck' in value&&value.recheck));recheck.hidden=!bound;recheck.disabled=busy;recheck.setAttribute('aria-busy',busy?'true':'false');const text=busy?'Rechecking…':`Recheck ${label}`;if(recheck.textContent!==text)recheck.textContent=text;}
    }
  }
  function issueLabel(issue:AssetIssue){return issue.kind==='missing-file'?'stored file is missing':issue.kind==='size-mismatch'?'stored file size does not match':issue.kind==='metadata-invalid'?'metadata is unreadable':issue.kind==='missing-metadata'?'library record is missing':'storage issue';}
  function applyAttachment(state:ReturnType<typeof normalizeAttachmentState>){
    attachmentView=state;render();attachmentIssues=new Map(state.issues.filter(issue=>issue.id).map(issue=>[issue.id,issue]));
    const issues=state.issues;let warning='';if(issues.length===1){const first=issues[0]!;warning=`Attachment storage needs attention · ${first.id?`attachment ${first.id.slice(0,18)}…`:'an attachment'}: ${issueLabel(first)}. Open Library → Data → Files.`;}else if(issues.length>1)warning=`Attachment storage needs attention · ${issues.length} attachment issues detected. Open Library → Data → Files.`;
    if(warning)input.storageHealth.markError('attachmentIntegrity',warning,{level:'warn'});else input.storageHealth.markOk('attachmentIntegrity');
    input.invalidateAttachmentLibrary();return state;
  }
  function scheduleAttachment(delay:number=15000,trigger:string='scheduled'){return attachmentJob.schedule(delay,trigger,'earliest');}
  const deferred=(message='Attachment integrity audit deferred.',code='ATTACHMENT_INTEGRITY_DEFERRED')=>Object.assign(new Error(message),{code});
  type AttachmentJobResult={status:string;reason?:string;checked?:number;issues?:number};
  async function runAttachment({trigger,nextEligibleAt}:{trigger:string;nextEligibleAt:string}):Promise<AttachmentJobResult>{
    let traceId='',prior:ReturnType<typeof normalizeAttachmentState>|null=null;
    try{
      prior=normalizeAttachmentState(await metadata.attachment.read(input.attachmentMetadataName),input.validAttachmentId);
      if(!storage.supported()){applyAttachment(prior);return freeze({status:'skipped',reason:'storage-unavailable'});}
      const last=Date.parse(prior.checkedAt||''),now=environment.now();
      if(!prior.progress&&Number.isFinite(last)&&now-last<limits.attachmentIntervalMs){applyAttachment(prior);scheduleAttachment(limits.attachmentIntervalMs-(now-last)+1000);return freeze({status:'skipped',reason:'not-due'});}
      if(!input.authority.canMutate()){applyAttachment(prior);return freeze({status:'skipped',reason:'not-primary'});}
      if(input.background.foregroundBusy())return freeze({status:'skipped',reason:'foreground-busy'});
      traceId=diagnostics.start('attachment-integrity','Attachment storage',freeze({background:true,trigger,nextEligibleAt,actionable:true}));diagnostics.mark('attachment-integrity-eligibility',freeze({trigger,nextEligibleAt,actionable:true}),traceId);
      const check=()=>{if(!input.authority.canMutate())throw deferred('Attachment integrity audit is awaiting primary-tab control.','ATTACHMENT_INTEGRITY_NOT_PRIMARY');if(input.background.foregroundBusy())throw deferred();};
      await backgroundTasks.yieldTask({priority:'background'});check();
      const revision=input.referenceRevision(),dataset=await input.data.datasetRevision(),refs=await references.sources({includeLive:false,priority:'background',referencesOnly:true});
      if(Object.prototype.toString.call(refs)!=='[object Set]')throw new Error('Attachment reference inventory could not be verified.');
      const audit=await storage.shallowAudit([...refs].filter(input.validAttachmentId),{progress:prior.progress,workMs:5000,maxEntries:128,shouldYield:backgroundTasks.budget(),yieldTask:()=>backgroundTasks.yieldTask({priority:'background'}),check});
      check();if(revision!==input.referenceRevision()||dataset!==await input.data.datasetRevision())throw deferred();
      const complete=audit.complete!==false,state=normalizeAttachmentState({...prior,checkedAt:complete?environment.nowIso():prior.checkedAt,attemptedAt:environment.nowIso(),lastOutcome:complete?'completed':'yielded',progress:complete?null:audit.progress,issues:complete?audit.issues:prior.issues},input.validAttachmentId);
      await metadata.attachment.write(input.attachmentMetadataName,state,{strict:true});applyAttachment(state);scheduleAttachment(complete?limits.attachmentIntervalMs:2000,complete?'interval':'continue');diagnostics.finish(freeze({status:complete?'completed':'yielded',checked:Number(audit.checked)||0,issues:state.issues.length}),traceId);return freeze({status:complete?'completed':'yielded',reason:'',checked:Number(audit.checked)||0,issues:state.issues.length});
    }catch(caught){
      let error=caught as Error&{code?:string;attachmentAuditProgress?:unknown};
      if(error.attachmentAuditProgress&&prior&&input.authority.canMutate())try{const state=normalizeAttachmentState({...prior,progress:error.attachmentAuditProgress,attemptedAt:environment.nowIso(),lastOutcome:'yielded'},input.validAttachmentId);await metadata.attachment.write(input.attachmentMetadataName,state,{strict:true});applyAttachment(state);}catch(writeError){error=writeError as Error&{code?:string};}
      if(error.code==='ATTACHMENT_INTEGRITY_NOT_PRIMARY'){if(traceId)diagnostics.finish(freeze({status:'skipped',reason:'not-primary'}),traceId);return freeze({status:'skipped',reason:'not-primary'});}
      if(error.code==='ATTACHMENT_INTEGRITY_DEFERRED'){if(traceId)diagnostics.finish(freeze({status:'skipped',reason:'deferred'}),traceId);scheduleAttachment(input.background.foregroundBusy()?0:limits.attachmentRetryMs,'deferred');return freeze({status:'skipped',reason:'deferred'});}
      attachmentView=normalizeAttachmentState({...prior||attachmentView||{},attemptedAt:environment.nowIso(),lastOutcome:'unavailable'},input.validAttachmentId);render();if(traceId)diagnostics.fail(error,freeze({background:true,status:'unavailable'}),traceId);diagnostics.capture('attachments.integrity-audit',error,'warn');input.storageHealth.markError('attachmentIntegrity','Attachment verification is unavailable. Previous findings are retained; Study Director will retry.',{level:'warn'});scheduleAttachment(30*60*1000,'error');return freeze({status:'unavailable',reason:error.message||String(error)});
    }
  }
  const attachmentJob=lifecycle.createJob<AttachmentJobResult>({environment:{now:environment.now,setTimeout:environment.setTimeout,clearTimeout:environment.clearTimeout},minDelayMs:1000,retryMs:30*60*1000,isAvailable:()=>input.background.upkeepBlocker()||(storage.supported()?true:'storage-unavailable'),capture:error=>diagnostics.capture('attachments.integrity-lifecycle',error,'warn'),execute:runAttachment});
  async function installAttachment(){
    let state;try{state=normalizeAttachmentState(await metadata.attachment.read(input.attachmentMetadataName),input.validAttachmentId);}
    catch(error){diagnostics.capture('attachments.integrity-state-read',error,'warn');input.storageHealth.markError('attachmentIntegrity','Attachment verification state is unavailable. Study Director will retry.',{level:'warn'});scheduleAttachment(30*60*1000,'state-read-failed');return null;}
    applyAttachment(state);if(!storage.supported())return state;const last=Date.parse(state.checkedAt||''),age=Number.isFinite(last)?Math.max(0,environment.now()-last):limits.attachmentIntervalMs;scheduleAttachment(state.progress||age>=limits.attachmentIntervalMs?15000:limits.attachmentIntervalMs-age+1000);return state;
  }

  const changed=repositoryChanged;
  async function readRepositoryState(){return normalizeRepositoryState(await metadata.repository.read(input.repositoryMetadataName),input.normalizeContinuation);}
  function applyRepository(state:RepositoryIntegrityState){
    repositoryView=state;render();const targets=Object.entries(state.locations).filter(([id,target])=>!!target.repositoryScope&&boundScopes[id]===target.repositoryScope).map(([,target])=>target);
    const quarantined=targets.some(target=>target.quarantinedObjectIds.length>0),failed=targets.some(target=>{const failure=Date.parse(target.failedAt),completed=Date.parse(target.completedAt);return Number.isFinite(failure)&&(!Number.isFinite(completed)||failure>=completed);});
    if(quarantined)input.storageHealth.markError('repositoryIntegrity','Some backup objects failed integrity verification. Keep the local copy and use a healthy backup version.',{level:'warn'});
    else if(failed)input.storageHealth.markError('repositoryIntegrity','Backup verification is incomplete or unavailable. Study Director will retry; keep the local copy until verification succeeds.',{level:'warn'});
    else input.storageHealth.markOk('repositoryIntegrity');return state;
  }
  function mutateTarget(target:string,change:(current:RepositoryIntegrityTarget)=>unknown):Promise<RepositoryIntegrityTarget>{
    if(!LOCATION.test(String(target||'')))return Promise.reject(new Error('Unknown backup location.'));
    const task=repositoryWriteChain.catch(()=>{}).then(()=>metadata.repository.transaction<RepositoryIntegrityState>('readwrite',(view,tx,finish)=>{
      const handle=view.get(input.repositoryMetadataName);let updated:RepositoryIntegrityState|undefined;
      handle.request.onerror=()=>finish(false,handle.request.error||new Error('Integrity metadata could not be read.'));
      handle.request.onsuccess=()=>{try{
        if(!input.authority.canMutate())throw new Error('Study control is required to save integrity state.');
        const state=normalizeRepositoryState(handle.value(),input.normalizeContinuation),next=normalizeRepositoryTarget(change(state.locations[target]||normalizeRepositoryTarget(null,input.normalizeContinuation)),input.normalizeContinuation);
        updated=freeze({...state,locations:freeze({...state.locations,[target]:next})});const write=view.put(input.repositoryMetadataName,updated);write.onerror=()=>finish(false,write.error||new Error('Integrity metadata could not be saved.'));
      }catch(error){finish(false,error);}};
      tx.oncomplete=()=>{if(!updated)finish(false,new Error('Integrity metadata transaction produced no state.'));else finish(true,updated);};
    },{strict:true,abortMessage:'Integrity metadata transaction aborted'})).then(state=>{applyRepository(state);return state.locations[target]!;}).catch(error=>{const problem=error as Error&{code?:string};if(!problem.code)problem.code='REPOSITORY_INTEGRITY_STATE_UNAVAILABLE';input.storageHealth.markError('repositoryIntegrity','Backup verification state could not be saved or read. The previous state is preserved; verification will retry.',{level:'warn'});diagnostics.capture('backup.repository-integrity-state',problem,'warn');throw problem;});
    repositoryWriteChain=task.then(()=>{},()=>{});return task;
  }
  async function readTarget(target:string){
    const actual=await provider.repositoryScope(target);if(!actual)throw new Error('The backup repository identity is unavailable.');
    const state=await readRepositoryState(),prior=state.locations[target]||normalizeRepositoryTarget(null,input.normalizeContinuation),same=prior.repositoryScope===actual;
    if(same&&prior.repositoryScope){boundScopes[target]=prior.repositoryScope;applyRepository(state);return prior;}
    const scope=String(actual),bound=await mutateTarget(target,current=>{if(current.repositoryScope!==prior.repositoryScope)throw changed();return {...normalizeRepositoryTarget(null,input.normalizeContinuation),repositoryScope:scope};});
    boundScopes[target]=bound.repositoryScope;applyRepository(await readRepositoryState());return bound;
  }
  async function updateTarget(target:string,result:IntegrityResult){
    if(!result.repositoryScope)throw new Error('Integrity results require their repository identity.');
    const bound=await readTarget(target);if(bound.repositoryScope!==result.repositoryScope)throw changed();
    return mutateTarget(target,current=>projectRepositoryResult(current,result,environment.nowIso()));
  }
  const repositoryHooks=freeze({
    readTarget:(id:string)=>readTarget(id),
    writeResult:async(id:string,result:IntegrityResult)=>{if(result.complete===true||!Number(result.total))delete live[id];else live[id]=freeze({done:Number(result.done)||0,total:Number(result.total)||0});await updateTarget(id,result);},
    prepare:async(id:string,target:ProviderIntegrityTarget|null,{trigger,nextEligibleAt}:{trigger:string;nextEligibleAt:string})=>{
      if(!target)return null;const state=target as RepositoryIntegrityTarget;return freeze({repositoryScope:state.repositoryScope,requestId:state.requestId,scanId:state.scanId,cursor:state.cursor,recheckCursor:state.recheckCursor,partial:state.partial,recheck:state.recheck,verifyIncremental:input.continuation.verify,maxObjects:limits.repositoryBatchObjects,maxBytes:limits.repositoryBatchBytes,skipObjectIds:state.quarantinedObjectIds,trigger:String(trigger||'scheduled-integrity'),nextEligibleAt:String(nextEligibleAt||''),onProgress:async(progress:import('../../types/managed-repository.ts').ScrubProgress)=>{live[id]=freeze({done:Number(progress.checked)||0,total:Number(progress.total)||0});render();return updateTarget(id,{...progress,status:'yielded',checkpointOnly:true,repositoryScope:state.repositoryScope,requestId:state.requestId});}});
    },
    isAvailable:(_id:string)=>input.background.backgroundBlocker()||true,
    isUnsafe:(_id:string)=>input.unsafe.mutation()||input.unsafe.attachmentIngest(),
    yieldTask:()=>backgroundTasks.yieldTask({priority:'background'}),
    quarantine:async(id:string)=>(await readTarget(id)).quarantinedObjectIds
  });
  async function requestRepositoryRecheck(target:string){
    const label=target==='device-folder'?'Device Folder':'Google Drive';rowError[target]='';recheckAsked[target]=true;render();
    try{
      if(!input.authority.canMutate())throw new Error('Use the primary tab to request backup verification.');
      if(!provider.locationStatus(target)?.connected)throw new Error(`Connect ${label} before rechecking it.`);
      const bound=await readTarget(target);await mutateTarget(target,current=>{if(current.repositoryScope!==bound.repositoryScope)throw changed();return {...current,requestId:environment.uuid(),recheck:true,recheckCursor:'',cursor:'',scanId:'',partial:null,cycleStartedAt:environment.nowIso()};});
      provider.requestIntegrity(target);render();return true;
    }catch(error){recheckAsked[target]=false;rowError[target]=`Recheck did not start: ${String((error as {message?:unknown}|null)?.message||error)}`;render();diagnostics.capture('backup.integrity-recheck',error,'warn');return false;}
  }
  async function installRepository(){try{return applyRepository(await readRepositoryState());}catch(error){diagnostics.capture('backup.repository-integrity-state-read',error,'warn');input.storageHealth.markError('repositoryIntegrity','Backup verification state is unavailable. Study Director will retry.',{level:'warn'});return null;}}
  function diagnosticRows(){
    const rows:Readonly<Record<string,unknown>>[]=[];
    const a=attachmentView,js=attachmentJob.status();rows.push(freeze({job:'Attachment verification',...js,completedAt:a?.checkedAt||'',attemptedAt:a?.attemptedAt||'',cursor:a?.progress?.cursor||0,total:a?.progress?.total||0,coverage:'presence-and-size'}));
    for(const [target,value] of Object.entries(repositoryView?.locations||{})){const bound=!!value.repositoryScope&&boundScopes[target]===value.repositoryScope;rows.push(freeze({job:target+' verification',reason:bound?value.blockedReason:'awaiting-connection',state:!bound?'unbound':value.recheck?'recheck-pending':value.partial||value.cursor?'partial':value.lastOutcome||'never',completedAt:bound?value.completedAt:'',attemptedAt:bound?value.attemptedAt:'',failedAt:bound?value.failedAt:'',progressBytes:bound?value.partial?.stored.offset||0:0,quarantined:bound?value.quarantinedObjectIds.length:0,history:bound?value.history.map(row=>row.at+':'+row.outcome+(row.complete?':full':'')).join(' | '):''}));}
    return freeze(rows);
  }
  return freeze({format:'study-director.backup-integrity-host' as const,contractVersion:1 as const,attachmentJob,repositoryHooks,attachmentIssue:(id:string)=>attachmentIssues.get(String(id||''))||null,attachmentState:()=>attachmentView,repositoryState:()=>repositoryView,scheduleAttachment,installAttachment,installRepository,requestRepositoryRecheck,render,diagnosticRows});
}
const createModule=():BackupIntegrityHostContract=>freeze({format:'study-director.backup-integrity-host-module',contractVersion:1,normalizeAttachmentState,normalizeRepositoryTarget,normalizeRepositoryState,projectRepositoryResult,createController});
registry.define('backup-integrity-host',1,createModule);return createModule;
})();
export type BackupIntegrityHostModule=ReturnType<typeof sdBackupIntegrityHostFactory>;
