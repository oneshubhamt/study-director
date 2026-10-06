(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,functionPort:functions}=registry.contracts;
registry.define('backup-recovery-host',1,()=>{
  const freeze=Object.freeze;
  const PENDING_FORMAT='study-director.managed-provider-backup-pending';
  const PROVIDER_ID=/^[a-z][a-z0-9-]{0,40}$/u;
  const TECHNICAL_RECOVERY_TERMS=/\b(?:repository|checkpoint|manifest|commit marker|reconciliation)\b/iu;
  function normalizePending(value){
    const seen=new Set(),entries=[];
    for(const raw of Array.isArray(value?.entries)?value.entries:[]){
      const providerId=String(raw?.providerId||'').trim().toLowerCase(),requestedAt=String(raw?.requestedAt||''),sourceRevision=String(raw?.sourceRevision||'');
      if(!PROVIDER_ID.test(providerId)||seen.has(providerId)||!Number.isFinite(Date.parse(requestedAt))||!Number.isFinite(Date.parse(sourceRevision)))continue;
      seen.add(providerId);entries.push(freeze({providerId,requestedAt:new Date(requestedAt).toISOString(),sourceRevision:new Date(sourceRevision).toISOString()}));
      if(entries.length>=8)break;
    }
    entries.sort((a,b)=>a.providerId.localeCompare(b.providerId));
    return freeze({format:PENDING_FORMAT,version:1,entries:freeze(entries)});
  }
  function userMessage(error,fallback){
    const raw=String(error&&error.message||error||'').trim();
    if(!raw)return fallback;
    return TECHNICAL_RECOVERY_TERMS.test(raw)?fallback:raw;
  }
  function createPendingStore(input){
    exactObject(input,['storage','diagnostics','sourceRevision'],'Provider pending store input');
    functions(input.storage,['read','remove','write'],'Provider pending storage');
    if(typeof input.sourceRevision!=='function'||typeof input.diagnostics.capture!=='function')throw new TypeError('Provider pending store dependencies are invalid.');
    let pendingWriteChain=Promise.resolve();
    async function readPending(){
      try{return normalizePending(await input.storage.read());}
      catch(error){input.diagnostics.capture('backup.pending-provider-read',error,'error');throw error;}
    }
    function mutatePending(operation){
      const run=pendingWriteChain.catch(()=>null).then(async()=>{
        const current=await readPending(),next=normalizePending(operation(current));
        if(next.entries.length)await input.storage.write(next);
        else await input.storage.remove();
        return next;
      });
      pendingWriteChain=run.catch(()=>null);return run;
    }
    async function markPending(providerId){
      const id=String(providerId||'').trim().toLowerCase();if(!PROVIDER_ID.test(id))return false;
      const now=new Date().toISOString(),revision=String(input.sourceRevision()||''),sourceRevision=Number.isFinite(Date.parse(revision))?new Date(revision).toISOString():now;
      await mutatePending(current=>{const prior=current.entries.find(entry=>entry.providerId===id),requestedAt=new Date(Math.max(Date.parse(now),Date.parse(prior?.requestedAt||'')+1||0)).toISOString();return {format:PENDING_FORMAT,version:1,entries:[...current.entries.filter(entry=>entry.providerId!==id),{providerId:id,requestedAt,sourceRevision}]};});return true;
    }
    async function clearPending(providerId,expected=undefined){
      const id=String(providerId||'').trim().toLowerCase();if(!PROVIDER_ID.test(id))return false;
      let cleared=true;await mutatePending(current=>{const pending=current.entries.find(entry=>entry.providerId===id)||null;if(expected!==undefined&&JSON.stringify(pending)!==JSON.stringify(expected)){cleared=false;return current;}return {format:PENDING_FORMAT,version:1,entries:current.entries.filter(entry=>entry.providerId!==id)};});return cleared;
    }
    async function pending(providerId){
      const id=String(providerId||'').trim().toLowerCase();return (await readPending()).entries.find(entry=>entry.providerId===id)||null;
    }
    return freeze({read:pending,mark:markPending,clear:clearPending});
  }
  function createHost(input){
    exactObject(input,['cancellation','device','diagnostics','document','interactions','lifecycle','managedRecovery','mutation','presentation','providers','session','sourceRevision','storage','view'],'Backup recovery host input');
    functions(input.cancellation,['cancelImport'],'Backup recovery host cancellation port');
    functions(input.device,['backupNow','bringIn','cancelForeground','history','notifyChange','removeSafetyBackup','restoreVersion','resumeAutomatic','status','suspendAutomatic'],'Backup recovery host Device Folder port');
    functions(input.diagnostics,['capture','mark'],'Backup recovery host diagnostics port');
    if(!input.document||typeof input.document.getElementById!=='function'||typeof input.document.createElement!=='function')throw new TypeError('Backup recovery host document port is invalid.');
    functions(input.interactions,['choose'],'Backup recovery host interactions port');
    functions(input.lifecycle,['activeSessionIssue','activeSessionLoad','activeSessionSettled','attachmentBusy','canonicalPlanDraft','deletionRecoveryFlush','flushNotes','flushPlanDraft','hasTasks','noteFailure','planDraft','planInputValue','quiesce','savePlanDraft','settleAttachmentWriters','settlePlan','writeLiveDraft'],'Backup recovery host lifecycle port');
    functions(input.managedRecovery,['createCoordinator'],'Backup recovery host managed-recovery port');
    functions(input.mutation,['run'],'Backup recovery host mutation port');
    functions(input.providers,['bringInRepositoryProvider','cancelForeground','configureConvergencePropagation','configureManagedRecovery','configurePendingBackupRetry','history','list','removeProtectedRepositoryProvider','restoreRepositoryProviderVersion','suspendBackground'],'Backup recovery host provider port');
    functions(input.session,['hasBlocking'],'Backup recovery host session port');
    if(typeof input.sourceRevision!=='function')throw new TypeError('Backup recovery host sourceRevision port is invalid.');
    functions(input.storage,['read','remove','write'],'Backup recovery host storage port');
    functions(input.view,['invalidateAttachments','refreshCore','refreshNotes','refreshReview','renderLibrary','setStatus'],'Backup recovery host view port');

    if(!Object.isFrozen(input.presentation)||['begin','read','feedback','condition','detail','outcome','resolve','reset','subscribe'].some(key=>typeof input.presentation[key]!=='function'))throw new TypeError('Backup presentation port is invalid.');
    const {mark:markPending,clear:clearPending,read:pending}=createPendingStore(freeze({storage:input.storage,diagnostics:input.diagnostics,sourceRevision:input.sourceRevision}));
    async function requestDeviceConvergence(context={}){
      const state=input.device.status();
      if(!state.connected)return freeze({status:'skipped',reason:'not-connected'});
      try{
        input.device.notifyChange(freeze({urgent:false,reason:'managed-convergence'}));
        return freeze({status:'pending',reason:'queued',queued:true,source:String(context&&context.source||'')});
      }catch(error){
        input.diagnostics.capture('device-backup.managed-convergence',error,'warn');
        return freeze({status:'pending',reason:String(error&&error.message||error||'queue-failed'),queued:false});
      }
    }
    async function settleRecoveryState(options={}){
      if(input.lifecycle.attachmentBusy())throw new Error('An attachment is still being prepared or saved. Finish that operation before recovery.');
      await input.lifecycle.settleAttachmentWriters();
      if(await input.lifecycle.flushPlanDraft()===false)throw new Error('The current Plan draft could not be saved before recovery.');
      const planInput=input.lifecycle.planInputValue();
      if(planInput!==null&&(input.lifecycle.planDraft()??'')!==planInput&&await input.lifecycle.savePlanDraft()===false)throw new Error('The current Plan draft could not be saved before recovery.');
      await input.lifecycle.settlePlan();
      if(planInput!==null&&(await input.lifecycle.canonicalPlanDraft())!==planInput){
        // Storage can lose a draft this page already wrote (for example when the
        // browser's site data is cleared). Write the visible draft once more and
        // require the read-back to match before replacing anything.
        if(await input.lifecycle.savePlanDraft({force:true})===false)throw new Error('The current Plan draft could not be saved before recovery.');
        await input.lifecycle.settlePlan();
        if((await input.lifecycle.canonicalPlanDraft())!==planInput)throw new Error('The Plan draft did not pass the pre-recovery read-back check.');
      }
      // A recovery that never touches today's session keeps the copy confirmed
      // before its safety backup; writing it again would only move the source
      // revision past that backup.
      const hasTasks=!(options.phase==='final'&&options.keepsActiveSession===true)&&input.lifecycle.hasTasks();
      let liveResult=null;if(hasTasks)liveResult=await input.lifecycle.writeLiveDraft();
      await input.lifecycle.flushNotes();
      const noteFailure=input.lifecycle.noteFailure();if(noteFailure&&noteFailure.failed)throw new Error(noteFailure.message||'Ongoing Notes are not safely stored yet.');
      if(await input.lifecycle.deletionRecoveryFlush()!==true)throw new Error('Pending deletion recovery could not be settled before recovery.');
      await input.lifecycle.activeSessionSettled();
      const loaded=await input.lifecycle.activeSessionLoad();await input.lifecycle.activeSessionSettled();
      const recoveryIssue=input.lifecycle.activeSessionIssue(loaded);if(recoveryIssue)throw new Error(recoveryIssue);
      if(hasTasks){
        if(!liveResult||!liveResult.ok||!liveResult.value||liveResult.storage?.idb!==true)throw new Error('The active session could not be confirmed in canonical browser storage before recovery.');
        if(!loaded.value||Number(loaded.value.revision)!==Number(liveResult.value.revision))throw new Error('The saved active session did not pass the pre-recovery read-back check.');
      }
      return true;
    }
    async function rebuildRecoveryState(){
      input.view.invalidateAttachments();
      try{input.view.renderLibrary();}catch(error){input.diagnostics.capture('managed-recovery.rebuild-library',error,'warn');}
      try{input.view.refreshNotes();}catch(error){input.diagnostics.capture('managed-recovery.rebuild-notes',error,'warn');}
      try{input.view.refreshReview();}catch(error){input.diagnostics.capture('managed-recovery.rebuild-review',error,'warn');}
      try{input.view.refreshCore();}catch(error){input.diagnostics.capture('managed-recovery.rebuild-core',error,'warn');}
      await input.lifecycle.activeSessionSettled();return true;
    }

    const coordinator=input.managedRecovery.createCoordinator(freeze({
      // A restore pauses automatic backups at every location, not only the
      // Device Folder, so none of them captures half-applied data.
      automaticBackup:freeze({
        suspend:async reason=>{
          const device=await input.device.suspendAutomatic(reason),providers=input.providers.suspendBackground(reason);
          try{await providers.settled;}catch(error){providers.release();input.device.resumeAutomatic(device);throw error;}
          return freeze({device,providers});
        },
        resume:held=>{held.providers.release();return input.device.resumeAutomatic(held.device);}
      }),
      lifecycle:freeze({settle:(kind,options)=>settleRecoveryState(options),quiesce:operation=>input.lifecycle.quiesce(operation),rebuild:()=>rebuildRecoveryState(),revision:()=>input.sourceRevision()}),
      mutation:freeze({run:(kind,operation)=>input.mutation.run(kind,operation)}),
      diagnostics:freeze({capture:(scope,error,level)=>input.diagnostics.capture(scope,error,level),mark:(phase,details)=>input.diagnostics.mark(phase,details)})
    }));
    if(!Object.isFrozen(coordinator)||coordinator.format!=='study-director.managed-recovery-coordinator'||coordinator.contractVersion!==1)throw new Error('Study Director managed recovery coordination is unavailable or incompatible.');

    input.providers.configureConvergencePropagation(freeze({device:context=>requestDeviceConvergence(context)}));
    input.providers.configureManagedRecovery(freeze({run:spec=>coordinator.execute(spec)}));
    input.providers.configurePendingBackupRetry(freeze({read:id=>pending(id),mark:id=>markPending(id),clear:(id,expected)=>clearPending(id,expected)}));

    const presentation=input.presentation;
    let presentationScope=null,presentationLifecycle='succeeded';
    // noteTarget is set while Version History restores a single note.
    let busy=false,activeSourceId='',activeSourceLabel='',lastEntries=freeze([]),activeController=null,noteTarget=null;
    function currentPresentation(){return activeSourceId?presentation.read(activeSourceId):null;}
    function progressValue(){const event=currentPresentation();return event?.progress?freeze({...event.progress,message:event.message,ok:event.severity!=='error'}):null;}
    function statusValue(){const event=(activeSourceId?presentation.read(activeSourceId,'backup-status'):null)||currentPresentation();return freeze({message:event?.message||'',ok:event?.severity!=='error'});}
    function subscribePresentation(listener){return presentation.subscribe(state=>{for(const event of state.events)if(event.source===activeSourceId&&event.id==='backup-operation')listener(freeze({...event,sourceId:event.source,sourceLabel:event.title,active:event.lifecycle==='running',ok:event.severity!=='error',progress:event.progress?{...event.progress,message:event.message}:null}));});}
    const elements=()=>freeze({
      dialog:input.document.getElementById('managed-version-history'),
      kicker:input.document.getElementById('managed-version-history-kicker'),
      title:input.document.getElementById('managed-version-history-title'),
      copy:input.document.getElementById('managed-version-history-copy'),
      progress:input.document.getElementById('managed-version-history-progress'),
      progressStage:input.document.getElementById('managed-version-history-progress-stage'),
      progressDetail:input.document.getElementById('managed-version-history-progress-detail'),
      list:input.document.getElementById('managed-version-history-list'),
      status:input.document.getElementById('managed-version-history-status'),
      cancel:input.document.getElementById('cancel-backup-import')
    });
    const safetyLabel=value=>(value==='before-clear-library'||value==='before-clear-archive')?'Before Clear Library':value==='before-combine'?'Before Combine':'Before Restore';
    const tierLabel=(value,purpose='')=>value==='before-restore'?safetyLabel(purpose):value==='latest'?'Latest':value==='daily'?'Daily':value==='weekly'?'Weekly':value==='monthly'?'Monthly':'Saved';
    const dateLabel=value=>{const date=new Date(value);return Number.isFinite(date.getTime())?date.toLocaleString():String(value||'');};
    function sourceDescriptor(sourceId){
      const id=String(sourceId||'').trim();
      if(id==='device-folder')return freeze({id,label:'Device Folder',kind:'device'});
      const provider=input.providers.list().find(item=>item.id===id);return provider?freeze({id:provider.id,label:provider.label,kind:'provider'}):null;
    }
    function setHistoryStatus(message='',ok=true,lifecycle=''){
      presentationLifecycle=lifecycle||(ok?'succeeded':'failed');
      if(presentationScope?.read()?.lifecycle==='running'){presentation.feedback(activeSourceId,'');presentationScope.update({message:String(message||''),severity:ok?'info':'error'});}
      else if(activeSourceId)presentation.feedback(activeSourceId,String(message||''),ok);
      renderHistoryPresentation();
    }
    function clearHistoryProgress(){presentationScope?.update({progress:null});renderHistoryPresentation();}
    function setHistoryProgress(value){
      if(!value){clearHistoryProgress();return;}
      presentationScope?.update({message:String(value.message||'Working…'),progress:value,severity:value.ok===false?'error':'info'});renderHistoryPresentation();
    }
    function renderHistoryPresentation(){
      const event=currentPresentation(),{status,progress,progressStage,progressDetail}=elements(),value=statusValue();
      if(status){status.textContent=event?.progress?'':value.message;status.className='managed-version-history-status ui-status'+(!value.ok?' err':'');}
      if(progress)progress.hidden=!event?.progress;
      if(progressStage)progressStage.textContent=event?.progress?event.message:'';
      if(progressDetail)progressDetail.textContent=presentation.detail(event);
    }
    function renderOperationPresentation(){render(lastEntries);renderHistoryPresentation();renderBusy();return true;}
    function renderBusy(){const {cancel,dialog}=elements();if(dialog)dialog.dataset.busy=busy?'true':'false';if(cancel){cancel.hidden=!busy||!activeController;cancel.disabled=!busy;cancel.textContent='Cancel';}}
    function setOperationBusy(next,controller=null,kind='history'){
      if(next&&!busy){presentationLifecycle='succeeded';presentationScope=presentation.begin(activeSourceId,kind,{label:activeSourceLabel});}
      if(!next&&busy){presentationScope?.finish({lifecycle:presentationLifecycle});presentationScope=null;}
      busy=!!next;activeController=busy?controller:null;renderBusy();renderHistoryPresentation();return busy;
    }
    function cancelActive(){
      if(!busy)return false;
      const reason=new Error('Recovery operation was cancelled by the user.');reason.name='AbortError';reason.code='STUDY_DIRECTOR_IMPORT_CANCELLED';
      if(activeController&&!activeController.signal.aborted)activeController.abort(reason);
      try{input.cancellation.cancelImport('Recovery operation was cancelled by the user.',freeze({announce:false}));}catch{}
      if(activeSourceId==='device-folder'){try{input.device.cancelForeground('Recovery operation was cancelled by the user.');}catch{}}
      else if(activeSourceId){try{input.providers.cancelForeground('Recovery operation was cancelled by the user.',activeSourceId);}catch{}}
      setHistoryStatus('');setHistoryProgress({stage:'cancelling',message:'Cancelling safely…'});return true;
    }
    function setDialogSource(source){
      const {kicker,title,copy}=elements();
      if(kicker)kicker.textContent=noteTarget?'Earlier versions':'Recovery';
      if(title)title.textContent=noteTarget?noteTarget.label:`${source.label} backups`;
      if(copy)copy.textContent=noteTarget?`Choose a ${source.label} backup to compare with this note. You review the differences before anything changes.`:`Choose a verified ${source.label} backup checkpoint.`;
    }
    function render(entries=lastEntries){
      const {list}=elements();if(!list)return;list.replaceChildren();
      if(!entries.length){const empty=input.document.createElement('div');empty.className='managed-version-history-empty ui-helper';empty.textContent=`No ${activeSourceLabel||'managed'} backup checkpoints are available yet.`;list.appendChild(empty);return;}
      for(const entry of entries){
        const location=entry&&entry.location;if(!location)continue;
        const card=input.document.createElement('section');card.className='managed-version-card';card.dataset.logicalVersion=entry.logicalId;
        const head=input.document.createElement('div');head.className='managed-version-card-head';
        const when=input.document.createElement('strong');when.className='managed-version-date';when.textContent=dateLabel(entry.exportedAt||location.exportedAt);
        const counts=input.document.createElement('span');counts.className='managed-version-counts ui-helper';counts.textContent=`${Number(entry.counts?.dailyRecord)||0} Saved Days · ${Number(entry.counts?.areaNote)||0} Ongoing Notes`;
        head.append(when,counts);card.appendChild(head);
        const row=input.document.createElement('div');row.className='managed-version-location';
        const copy=input.document.createElement('div');copy.className='managed-version-location-copy';
        const status=input.document.createElement('span');status.className='ui-helper';status.textContent=`${tierLabel(location.tier,location.safetyPurpose)}${location.encrypted?' · Encrypted':''}${location.health==='degraded'?' · Degraded capture':''}`;copy.appendChild(status);
        if(location.warning){const warning=input.document.createElement('span');warning.className='ui-status warn';warning.textContent=String(location.warning);copy.appendChild(warning);}
        const actions=input.document.createElement('div');actions.className='managed-version-location-actions';
        const use=input.document.createElement('button');use.type='button';use.className='mini-btn ui-btn';use.dataset.action=noteTarget?'compare-managed-note':'recover-managed-version';use.dataset.versionHistorySource=location.sourceId;use.dataset.versionHistoryCheckpoint=location.checkpointId;use.textContent=noteTarget?'Compare…':'Restore / Combine…';actions.appendChild(use);
        if(location.tier==='before-restore'&&!noteTarget){const remove=input.document.createElement('button');remove.type='button';remove.className='mini-btn ui-btn';remove.dataset.action='remove-managed-safety';remove.dataset.versionHistorySource=location.sourceId;remove.dataset.versionHistoryCheckpoint=location.safetyCheckpointId||location.checkpointId;remove.textContent='Remove safety backup';actions.appendChild(remove);}
        row.append(copy,actions);card.appendChild(row);list.appendChild(card);
      }
    }
    async function collectSource(sourceId,{interactive=true}={}){
      const source=sourceDescriptor(sourceId);if(!source)throw new Error('Backup location is unavailable.');
      if(busy)return freeze({entries:lastEntries,source:freeze({sourceId:activeSourceId,sourceLabel:activeSourceLabel})});
      const controller=new AbortController();activeSourceId=source.id;activeSourceLabel=source.label;setOperationBusy(true,controller);setDialogSource(source);clearHistoryProgress();setHistoryStatus(`Reading ${source.label} backups…`);
      try{
        const result=source.kind==='device'?await input.device.history(freeze({interactive,signal:controller.signal,presentation:presentationScope})):await input.providers.history(source.id,freeze({interactive,signal:controller.signal,presentation:presentationScope}));
        const entries=result&&result.available&&Array.isArray(result.entries)?[...result.entries]:[];
        entries.sort((a,b)=>Date.parse(b?.exportedAt||b?.location?.exportedAt||0)-Date.parse(a?.exportedAt||a?.location?.exportedAt||0)||String(b?.location?.checkpointId||'').localeCompare(String(a?.location?.checkpointId||'')));
        lastEntries=freeze(entries);render();
        if(!result||result.available!==true){
          const reason=String(result&&result.reason||'');
          if(result&&result.cancelled||reason==='cancelled')setHistoryStatus('Cancelled.',true,'cancelled');
          else{const message=reason==='not-connected'?`${source.label} is not connected.`:reason==='permission'?`${source.label} permission is required.`:userMessage(reason,`Could not read ${source.label} backups safely.`);setHistoryStatus(message,false);}
        }else setHistoryStatus(lastEntries.length?`${lastEntries.length} backup checkpoint${lastEntries.length===1?'':'s'} available.`:`No ${source.label} backup checkpoints are available yet.`);
        return freeze({entries:lastEntries,source:freeze({sourceId:source.id,sourceLabel:source.label})});
      }catch(error){lastEntries=freeze([]);render();const message=userMessage(error,`Could not read ${source.label} backups safely.`);setHistoryStatus(message,false);input.diagnostics.capture('backup.source-history',error,'warn');return freeze({entries:lastEntries,source:freeze({sourceId:source.id,sourceLabel:source.label}),error});}
      finally{if(activeController===controller)setOperationBusy(false);}
    }
    async function openSource(sourceId,note=null){
      const source=sourceDescriptor(sourceId);if(!source)return false;
      const {dialog}=elements();if(!dialog)return false;
      if(busy){if(activeSourceId!==source.id)return false;setDialogSource(source);renderOperationPresentation();if(!dialog.open)dialog.showModal();return true;}
      noteTarget=note;
      // Restoring one note leaves today's session as it is, so it stays
      // available while a study session is active.
      if(!noteTarget&&input.session.hasBlocking()){activeSourceId=source.id;activeSourceLabel=source.label;setDialogSource(source);lastEntries=freeze([]);render();clearHistoryProgress();setHistoryStatus('Suspend or reset today’s active session before recovering a backup.',false);if(!dialog.open)dialog.showModal();return false;}
      activeSourceId=source.id;activeSourceLabel=source.label;setDialogSource(source);lastEntries=freeze([]);render();clearHistoryProgress();setHistoryStatus('Loading backups…');if(!dialog.open)dialog.showModal();void collectSource(source.id,{interactive:true});return true;
    }
    // Earlier versions of one note come from the connected backup locations;
    // with more than one, the person picks which to look in.
    async function openNote(target={}){
      const key=String(target.key||''),label=String(target.label||key).slice(0,160);if(!key)return freeze({opened:false,reason:'invalid'});
      if(busy)return freeze({opened:false,reason:'busy'});
      const sources=[...(input.device.status()?.connected===true?['device-folder']:[]),...input.providers.list().filter(item=>item.connected===true).map(item=>item.id)].map(sourceDescriptor).filter(Boolean);
      if(!sources.length)return freeze({opened:false,reason:'no-source'});
      const sourceId=sources.length===1?sources[0].id:await input.interactions.choose({title:'Earlier versions',message:`Where should Study Director look for earlier versions of ${label}?`,cancelLabel:'Cancel',choices:sources.map(source=>({value:source.id,label:source.label,description:`Backups saved to ${source.label}.`}))});
      if(!sourceId)return freeze({opened:false,reason:'cancelled'});
      const onRestored=typeof target.onRestored==='function'?target.onRestored:()=>{};
      return freeze({opened:await openSource(sourceId,freeze({key,label,onRestored}))});
    }
    function close(){const {dialog}=elements();if(dialog?.open)dialog.close();return true;}
    function eventButton(event,selector){const target=event&&event.target;return target&&typeof target.closest==='function'?target.closest(selector):null;}
    function selectedEntry(sourceId,checkpointId){return lastEntries.find(entry=>entry?.location?.sourceId===sourceId&&entry.location.checkpointId===checkpointId)||null;}
    async function recover(event){
      if(busy)return false;const button=eventButton(event,'[data-action="recover-managed-version"][data-version-history-source][data-version-history-checkpoint],[data-action="compare-managed-note"][data-version-history-source][data-version-history-checkpoint]');if(!button||(button.dataset.action==='compare-managed-note')!==!!noteTarget)return false;
      const sourceId=String(button.dataset.versionHistorySource||''),checkpointId=String(button.dataset.versionHistoryCheckpoint||''),entry=selectedEntry(sourceId,checkpointId),location=entry&&entry.location;if(!location)return false;
      const note=noteTarget;
      const choice=note?'combine':await input.interactions.choose({
        title:'Restore or combine checkpoint',
        message:`Verified backup checkpoint from ${location.sourceLabel}, saved ${dateLabel(location.exportedAt)}.`,
        details:['Device-local settings stay unchanged.','A verified safety backup protects the current state before recovery.'],
        cancelLabel:'Keep current',
        choices:[presentation.restoreChoices.missing,presentation.restoreChoices.combine,presentation.restoreChoices.replace]
      });
      if(!choice)return false;const controller=new AbortController();setOperationBusy(true,controller,choice==='replace'?'restore-version':'bring-in');setHistoryStatus('');setHistoryProgress({message:choice==='replace'?'Preparing restore…':'Preparing comparison…'});
      try{
        const options=freeze({presentation:presentationScope,checkpointId,confirmed:choice==='replace',note:note?note.key:'',missingOnly:choice==='missing',signal:controller.signal,onProgress:value=>{if(activeController===controller&&!controller.signal.aborted)setHistoryProgress(value);}});
        const result=choice==='replace'?(sourceId==='device-folder'?await input.device.restoreVersion(options):await input.providers.restoreRepositoryProviderVersion(sourceId,options)):(sourceId==='device-folder'?await input.device.bringIn(options):await input.providers.bringInRepositoryProvider(sourceId,options));
        clearHistoryProgress();
        const saved=dateLabel(location.exportedAt),noteOutcome=note?{'note-missing':`This note isn’t in the backup from ${saved}.`,'note-unchanged':`The backup from ${saved} has the same text as this note.`,'note-kept':'No changes were made.'}[String(result?.reason||'')]:'';
        if(noteOutcome){setHistoryStatus(noteOutcome,true,'cancelled');return false;}
        if(choice==='missing'&&String(result?.reason||'')==='needs-decision'){setHistoryStatus(presentation.restoreChoices.needsDecision,true,'cancelled');return false;}
        if(result&&result.cancelled||result&&result.reason==='cancelled'){setHistoryStatus('Recovery cancelled safely.',true,'cancelled');return false;}
        if(result&&result.ok===false){const message=userMessage(result.error,'The selected backup could not be applied safely.');setHistoryStatus(message,false);return false;}
        setHistoryStatus(presentation.outcome(choice==='replace'?'restore-version':'bring-in',location.sourceLabel,result?.convergence));lastEntries=freeze([]);setOperationBusy(false);close();
        if(note)try{note.onRestored(freeze({exportedAt:location.exportedAt,sourceLabel:location.sourceLabel}));}catch(error){input.diagnostics.capture('backup.note-restored',error,'warn');}
        return true;
      }catch(error){clearHistoryProgress();const cancelled=error?.name==='AbortError'||String(error?.code||'')==='STUDY_DIRECTOR_IMPORT_CANCELLED',message=cancelled?'Recovery cancelled safely.':userMessage(error,'The selected backup could not be applied safely.');setHistoryStatus(message,cancelled,cancelled?'cancelled':'failed');if(!cancelled)input.diagnostics.capture('backup.provider-scoped-recovery',error,'warn');return false;}
      finally{if(activeController===controller)setOperationBusy(false);}
    }
    async function removeSafety(event){
      if(busy)return false;const button=eventButton(event,'[data-action="remove-managed-safety"][data-version-history-source][data-version-history-checkpoint]');if(!button)return false;
      const sourceId=String(button.dataset.versionHistorySource||''),checkpointId=String(button.dataset.versionHistoryCheckpoint||''),entry=selectedEntry(sourceId,checkpointId),location=entry&&entry.location;
      if(!location||location.tier!=='before-restore')return false;
      const choice=await input.interactions.choose({title:'Remove safety backup?',message:`Remove the temporary Before restore safety backup from ${location.sourceLabel}?`,details:['This does not change your current Study Director data.','After removal, this safety backup can no longer be used to undo that recovery.'],cancelLabel:'Keep safety backup',choices:[{value:'remove',label:'Remove safety backup',kind:'danger',description:'Delete this temporary safety backup from this backup location.'}]});
      if(choice!=='remove')return false;setOperationBusy(true,null,'remove-safety');setHistoryStatus(`Removing safety backup from ${location.sourceLabel}…`);
      try{
        const result=sourceId==='device-folder'?await input.device.removeSafetyBackup(freeze({checkpointId})):await input.providers.removeProtectedRepositoryProvider(sourceId,checkpointId);
        if(!result||result.removed!==true){setHistoryStatus(userMessage(result&&result.error,'The safety backup could not be removed safely.'),false);return false;}
        if(Array.isArray(result.entries)){lastEntries=freeze([...result.entries].sort((a,b)=>Date.parse(b?.exportedAt||b?.location?.exportedAt||0)-Date.parse(a?.exportedAt||a?.location?.exportedAt||0)));render();}
        setHistoryStatus(result.warning?'Safety backup removed. Unused backup storage will be cleaned up later.':'Safety backup removed.');return true;
      }catch(error){setHistoryStatus(userMessage(error,'The safety backup could not be removed safely.'),false);input.diagnostics.capture('backup.version-history-remove-safety',error,'warn');return false;}
      finally{setOperationBusy(false);}
    }
    return freeze({
      format:'study-director.backup-recovery-host',contractVersion:1,
      managedRecovery:spec=>coordinator.execute(spec),
      requestDeviceConvergence,
      history:freeze({subscribePresentation,openSource:sourceId=>openSource(sourceId),openNote,close,cancel:cancelActive,refresh:()=>activeSourceId?collectSource(activeSourceId,{interactive:true}):false,recover,removeSafety,status:()=>freeze({busy,entries:lastEntries,sourceId:activeSourceId,sourceLabel:activeSourceLabel,progress:progressValue(),status:statusValue()})}),
      status:()=>freeze({managedRecovery:coordinator.status(),history:freeze({busy,entries:lastEntries,sourceId:activeSourceId,sourceLabel:activeSourceLabel,progress:progressValue(),status:statusValue()})})
    });
  }
  return freeze({format:'study-director.backup-recovery-host-module',contractVersion:1,createHost,createPendingStore});
});
})();
