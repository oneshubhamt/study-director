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
    exactObject(input,['cancellation','diagnostics','document','interactions','lifecycle','managedRecovery','mutation','presentation','providers','session','sourceRevision','storage','view'],'Backup recovery host input');
    functions(input.cancellation,['cancelImport'],'Backup recovery host cancellation port');
    functions(input.diagnostics,['capture','mark'],'Backup recovery host diagnostics port');
    if(!input.document||typeof input.document.getElementById!=='function'||typeof input.document.createElement!=='function')throw new TypeError('Backup recovery host document port is invalid.');
    functions(input.interactions,['choose'],'Backup recovery host interactions port');
    functions(input.lifecycle,['activeSessionIssue','activeSessionLoad','activeSessionSettled','attachmentBusy','canonicalPlanDraft','deletionRecoveryFlush','flushNotes','flushPlanDraft','hasTasks','noteFailure','planDraft','planInputValue','quiesce','savePlanDraft','settleAttachmentWriters','settlePlan','writeLiveDraft'],'Backup recovery host lifecycle port');
    functions(input.managedRecovery,['createCoordinator'],'Backup recovery host managed-recovery port');
    functions(input.mutation,['run'],'Backup recovery host mutation port');
    functions(input.providers,['bringInRepositoryProvider','cancelForeground','configureManagedRecovery','configurePendingBackupRetry','history','list','noteVersions','removeRepositoryProviderVersion','restoreRepositoryProviderVersion','suspendBackground'],'Backup recovery host provider port');
    functions(input.session,['hasBlocking'],'Backup recovery host session port');
    if(typeof input.sourceRevision!=='function')throw new TypeError('Backup recovery host sourceRevision port is invalid.');
    functions(input.storage,['read','remove','write'],'Backup recovery host storage port');
    functions(input.view,['deviceName','invalidateAttachments','refreshCore','refreshNotes','refreshReview','renderLibrary','setStatus'],'Backup recovery host view port');

    if(!Object.isFrozen(input.presentation)||['begin','read','feedback','condition','detail','outcome','resolve','reset','subscribe'].some(key=>typeof input.presentation[key]!=='function'))throw new TypeError('Backup presentation port is invalid.');
    const {mark:markPending,clear:clearPending,read:pending}=createPendingStore(freeze({storage:input.storage,diagnostics:input.diagnostics,sourceRevision:input.sourceRevision}));
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
      const noteFailure=input.lifecycle.noteFailure();if(noteFailure&&noteFailure.failed)throw new Error(noteFailure.message||'Notes are not safely stored yet.');
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
      // A restore pauses automatic backups at every location, so none of them
      // captures half-applied data.
      automaticBackup:freeze({
        suspend:async reason=>{
          const held=input.providers.suspendBackground(reason);
          try{await held.settled;}catch(error){held.release();throw error;}
          return held;
        },
        resume:held=>held.release()
      }),
      lifecycle:freeze({settle:(kind,options)=>settleRecoveryState(options),quiesce:operation=>input.lifecycle.quiesce(operation),rebuild:()=>rebuildRecoveryState(),revision:()=>input.sourceRevision()}),
      mutation:freeze({run:(kind,operation)=>input.mutation.run(kind,operation)}),
      diagnostics:freeze({capture:(scope,error,level)=>input.diagnostics.capture(scope,error,level),mark:(phase,details)=>input.diagnostics.mark(phase,details)})
    }));
    if(!Object.isFrozen(coordinator)||coordinator.format!=='study-director.managed-recovery-coordinator'||coordinator.contractVersion!==1)throw new Error('Study Director managed recovery coordination is unavailable or incompatible.');

    input.providers.configureManagedRecovery(freeze({run:spec=>coordinator.execute(spec)}));
    input.providers.configurePendingBackupRetry(freeze({read:id=>pending(id),mark:id=>markPending(id),clear:(id,expected)=>clearPending(id,expected)}));

    const presentation=input.presentation;
    let presentationScope=null,presentationLifecycle='succeeded';
    // noteTarget is set while Version History restores a single note.
    let busy=false,activeSourceId='',activeSourceLabel='',lastEntries=freeze([]),activeController=null,noteTarget=null;
    function currentPresentation(){return activeSourceId?presentation.read(activeSourceId):null;}
    function progressValue(){const event=currentPresentation();return event?.progress?freeze({...event.progress,message:event.message,ok:event.severity!=='error'}):null;}
    // Without a location (none connected) the dialog keeps its own line.
    let detachedStatus=freeze({message:'',ok:true});
    function statusValue(){if(!activeSourceId)return detachedStatus;const event=presentation.read(activeSourceId,'backup-status')||currentPresentation();return freeze({message:event?.message||'',ok:event?.severity!=='error'});}
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
    const tierLabel=(value,purpose='')=>value==='before-restore'?safetyLabel(purpose):value==='latest'?'Latest':value==='hourly'?'Hourly':value==='daily'?'Daily':value==='weekly'?'Weekly':value==='monthly'?'Monthly':'Saved';
    // "12 Saved Days · 1 note".
    const countLabel=counts=>{const days=Number(counts?.dailyRecord)||0,notes=Number(counts?.note)||0;return `${days} Saved Day${days===1?'':'s'} · ${notes} note${notes===1?'':'s'}`;};
    const dateLabel=value=>{const date=new Date(value);return Number.isFinite(date.getTime())?date.toLocaleString():String(value||'');};
    function sourceDescriptor(sourceId){
      const id=String(sourceId||'').trim(),provider=input.providers.list().find(item=>item.id===id);return provider?freeze({id:provider.id,label:provider.label,shared:provider.shared===true}):null;
    }
    function setHistoryStatus(message='',ok=true,lifecycle=''){
      presentationLifecycle=lifecycle||(ok?'succeeded':'failed');
      if(presentationScope?.read()?.lifecycle==='running'){presentation.feedback(activeSourceId,'');presentationScope.update({message:String(message||''),severity:ok?'info':'error'});}
      else if(activeSourceId)presentation.feedback(activeSourceId,String(message||''),ok);
      else detachedStatus=freeze({message:String(message||''),ok});
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
      if(activeSourceId){try{input.providers.cancelForeground('Recovery operation was cancelled by the user.',activeSourceId);}catch{}}
      setHistoryStatus('');setHistoryProgress({stage:'cancelling',message:'Cancelling safely…'});return true;
    }
    function setDialogMode(){
      const {kicker,title,copy}=elements();
      if(kicker)kicker.textContent=noteTarget?'Earlier versions':'Backups';
      if(title)title.textContent=noteTarget?noteTarget.label:'Version History';
      if(copy)copy.textContent=noteTarget?'Choose an earlier version of this note. You review the differences before anything changes.':'Every version your backups keep, newest first. Choose one to restore.';
    }
    // A note's earlier versions read in plain time: "Today, 14:05",
    // "Yesterday", "3 days ago", "2 weeks ago", "4 months ago". The time is
    // added when two versions share a date.
    const DAY_MS=86400000,dayKey=date=>`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    function plainTimeLabel(value,withTime){
      const date=new Date(value),now=new Date();if(!Number.isFinite(date.getTime()))return '';
      const time=date.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'}),startOf=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime(),days=Math.round((startOf(now)-startOf(date))/DAY_MS);
      const label=days<=0?'Today':days===1?'Yesterday':days<7?`${days} days ago`:days<35?`${Math.round(days/7)} week${Math.round(days/7)===1?'':'s'} ago`:`${Math.max(1,Math.round(days/30))} month${Math.max(1,Math.round(days/30))===1?'':'s'} ago`;
      return days<=0||withTime?`${label}, ${time}`:label;
    }
    // The device that made a version: "from iPad · Safari" or "from this device".
    function fromDevice(entry,entries){const name=input.view.deviceName(entry&&entry.origin,entries.map(other=>other&&other.origin));return name==='This device'?'from this device':name?`from ${name}`:'';}
    function renderNoteVersions(entries){
      const {list}=elements();
      if(!entries.length){const empty=input.document.createElement('div');empty.className='managed-version-history-empty ui-helper';empty.textContent=busy?'':'No earlier versions of this note are in your backups yet.';list.appendChild(empty);return;}
      const perDay=new Map();for(const entry of entries){const key=dayKey(new Date(entry.exportedAt));perDay.set(key,(perDay.get(key)||0)+1);}
      for(const entry of entries){
        const location=entry.location,card=input.document.createElement('section');card.className='managed-version-card';
        const head=input.document.createElement('div');head.className='managed-version-card-head';
        const when=input.document.createElement('strong');when.className='managed-version-date';when.textContent=plainTimeLabel(entry.exportedAt,perDay.get(dayKey(new Date(entry.exportedAt)))>1);
        const exact=input.document.createElement('span');exact.className='managed-version-counts ui-helper';exact.textContent=[dateLabel(entry.exportedAt),fromDevice(entry,entries)].filter(Boolean).join(' · ');
        const use=input.document.createElement('button');use.type='button';use.className='mini-btn ui-btn';use.dataset.action='compare-managed-note';use.dataset.versionHistorySource=location.sourceId;use.dataset.versionHistoryCheckpoint=location.checkpointId;use.textContent='Review';
        head.append(when,exact,use);card.appendChild(head);list.appendChild(card);
      }
    }
    function render(entries=lastEntries){
      const {list}=elements();if(!list)return;list.replaceChildren();
      if(noteTarget){renderNoteVersions(entries);return;}
      if(!entries.length){const empty=input.document.createElement('div');empty.className='managed-version-history-empty ui-helper';empty.textContent=busy?'':'No versions yet.';list.appendChild(empty);return;}
      // Where a version is kept, said only when one location of several holds it.
      const several=connectedSources().length>1;
      for(const entry of entries){
        const location=entry&&entry.location;if(!location)continue;
        if(location.tier==='unreadable'){list.appendChild(unreadableCard(entry,location,several));continue;}
        const card=input.document.createElement('section');card.className='managed-version-card';card.dataset.logicalVersion=entry.logicalId;
        const head=input.document.createElement('div');head.className='managed-version-card-head';
        const when=input.document.createElement('strong');when.className='managed-version-date';when.textContent=dateLabel(entry.exportedAt||location.exportedAt);
        const counts=input.document.createElement('span');counts.className='managed-version-counts ui-helper';counts.textContent=entry.locked?'Locked: enter the backup password to see this version':[countLabel(entry.counts),fromDevice(entry,entries)].filter(Boolean).join(' · ');
        head.append(when,counts);card.appendChild(head);
        const row=input.document.createElement('div');row.className='managed-version-location';
        const copy=input.document.createElement('div');copy.className='managed-version-location-copy';
        const status=input.document.createElement('span');status.className='ui-helper';status.textContent=`${tierLabel(location.tier,location.safetyPurpose)}${location.encrypted?' · Encrypted':''}${location.health==='degraded'?' · Degraded capture':''}${several&&Array.isArray(entry.held)&&entry.held.length===1?` · Only in ${entry.held[0]}`:''}`;copy.appendChild(status);
        if(location.warning){const warning=input.document.createElement('span');warning.className='ui-status warn';warning.textContent=String(location.warning);copy.appendChild(warning);}
        const actions=input.document.createElement('div');actions.className='managed-version-location-actions';
        const use=input.document.createElement('button');use.type='button';use.className='mini-btn ui-btn';use.dataset.action=noteTarget?'compare-managed-note':'recover-managed-version';use.dataset.versionHistorySource=location.sourceId;use.dataset.versionHistoryCheckpoint=location.checkpointId;use.textContent=noteTarget?'Restore note…':'Restore…';actions.appendChild(use);
        if(location.tier==='before-restore'&&!noteTarget)actions.appendChild(removeButton(location,'Remove safety version'));
        row.append(copy,actions);card.appendChild(row);list.appendChild(card);
      }
    }
    function removeButton(location,label){const remove=input.document.createElement('button');remove.type='button';remove.className='mini-btn ui-btn';remove.dataset.action='remove-managed-version';remove.dataset.versionHistorySource=location.sourceId;remove.dataset.versionHistoryCheckpoint=location.safetyCheckpointId||location.checkpointId;remove.textContent=label;return remove;}
    // A version this app cannot read: it may come from a newer Study Director
    // on another device, or its file is damaged. It cannot be restored; the
    // person can keep it or remove it.
    function unreadableCard(entry,location,several){
      const card=input.document.createElement('section');card.className='managed-version-card';card.dataset.logicalVersion=entry.logicalId;
      const head=input.document.createElement('div');head.className='managed-version-card-head';
      const when=input.document.createElement('strong');when.className='managed-version-date';when.textContent=dateLabel(entry.exportedAt||location.exportedAt);
      const note=input.document.createElement('span');note.className='managed-version-counts ui-helper';note.textContent='Can’t be read by this app';
      head.append(when,note);card.appendChild(head);
      const row=input.document.createElement('div');row.className='managed-version-location';
      const copy=input.document.createElement('div');copy.className='managed-version-location-copy';
      const status=input.document.createElement('span');status.className='ui-status warn';status.textContent=`It may come from a newer Study Director, or the file is damaged.${several?` In ${location.sourceLabel}.`:''}`;copy.appendChild(status);
      const actions=input.document.createElement('div');actions.className='managed-version-location-actions';actions.appendChild(removeButton(location,'Remove…'));
      row.append(copy,actions);card.appendChild(row);return card;
    }
    // One list for every location. A version two locations hold (the same id,
    // or the same data under another id) shows once and is read from the first
    // location that holds it (copies lists the others, tried if that read
    // fails); each location's safety version, and each version it cannot
    // read, shows on its own.
    // The newest version is Latest, whichever location made it.
    function mergeHistories(results){
      const rows=[],byId=new Map(),byData=new Map(),time=entry=>Date.parse(entry.exportedAt||entry.location.exportedAt||0)||0;
      for(const {source,entries} of results)for(const entry of entries){
        const location=entry&&entry.location;if(!location)continue;
        if(location.tier==='unreadable'){rows.push({entry,held:[source.label],tiers:[location.tier],copies:[]});continue;}
        if(location.tier!=='before-restore'){
          const match=byId.get(location.checkpointId)||(entry.logicalId?byData.get(entry.logicalId):null);
          // A copy waiting for the password gives way to one that can be read.
          if(match&&!match.held.includes(source.label)){match.held.push(source.label);match.tiers.push(location.tier);if(match.entry.locked&&!entry.locked){match.copies.push(match.entry.location);match.entry=entry;}else match.copies.push(location);continue;}
        }
        const row={entry,held:[source.label],tiers:[location.tier],copies:[]};rows.push(row);
        if(location.tier!=='before-restore'){byId.set(location.checkpointId,row);if(entry.logicalId&&!byData.has(entry.logicalId))byData.set(entry.logicalId,row);}
      }
      rows.sort((a,b)=>time(b.entry)-time(a.entry)||String(b.entry.location.checkpointId).localeCompare(String(a.entry.location.checkpointId)));
      let latest=true;
      return freeze(rows.map(row=>{
        let tier=row.entry.location.tier;
        if(tier!=='before-restore'&&tier!=='unreadable'){tier=latest?'latest':row.tiers.find(value=>value!=='latest')||'retained';latest=false;}
        return freeze({...row.entry,held:freeze([...row.held]),copies:freeze([...row.copies]),location:freeze({...row.entry.location,tier})});
      }));
    }
    async function collectAll({interactive=true}={}){
      if(busy)return freeze({entries:lastEntries});
      const sources=connectedSources();
      if(!sources.length){activeSourceId='';activeSourceLabel='';lastEntries=freeze([]);render();setHistoryStatus('Choose a Device Folder or connect Google Drive to keep versions.',false);return freeze({entries:lastEntries});}
      const controller=new AbortController();activeSourceId=sources[0].id;activeSourceLabel=sources[0].label;setOperationBusy(true,controller);setDialogMode();clearHistoryProgress();
      try{
        const results=[],unread=[];
        for(const source of sources){
          setHistoryStatus(`Reading ${source.label}…`);
          const result=await input.providers.history(source.id,freeze({interactive,signal:controller.signal,presentation:presentationScope}));
          if(result&&(result.cancelled||result.reason==='cancelled')){setHistoryStatus('Cancelled.',true,'cancelled');return freeze({entries:lastEntries});}
          if(result&&result.available===true&&Array.isArray(result.entries))results.push(freeze({source,entries:result.entries}));
          else unread.push(String(result&&result.reason||'')==='permission'?`${source.label} needs permission again.`:`${source.label} could not be read.`);
        }
        lastEntries=mergeHistories(results);render();
        const missing=unread.length?' '+unread.join(' '):'',unreadable=lastEntries.filter(entry=>entry.location.tier==='unreadable').length,readable=lastEntries.length-unreadable,cannot=unreadable?` ${unreadable} can’t be read by this app.`:'';
        setHistoryStatus(readable?`${readable} version${readable===1?'':'s'}.${cannot}${missing}`:`No versions yet.${cannot}${missing}`,!unread.length);
        return freeze({entries:lastEntries});
      }catch(error){lastEntries=freeze([]);render();setHistoryStatus(userMessage(error,'Version History could not be read safely.'),false);input.diagnostics.capture('backup.version-history',error,'warn');return freeze({entries:lastEntries,error});}
      finally{if(activeController===controller)setOperationBusy(false);}
    }
    // Version History for every location. While something runs, it reopens on
    // that work.
    async function open(){
      const {dialog}=elements();if(!dialog)return false;
      if(busy){setDialogMode();renderOperationPresentation();if(!dialog.open)dialog.showModal();return true;}
      noteTarget=null;const sources=connectedSources();activeSourceId=sources[0]?.id||'';activeSourceLabel=sources[0]?.label||'';
      // Restoring one note leaves today's session as it is, so it stays
      // available while a study session is active; the whole library waits.
      if(input.session.hasBlocking()){setDialogMode();lastEntries=freeze([]);render();clearHistoryProgress();setHistoryStatus('Suspend or reset today’s active session before recovering a backup.',false);if(!dialog.open)dialog.showModal();return false;}
      setDialogMode();lastEntries=freeze([]);render();clearHistoryProgress();setHistoryStatus('Loading versions…');if(!dialog.open)dialog.showModal();void collectAll({interactive:true});return true;
    }
    // This device's own location (the Device Folder) first, then the shared
    // one (Drive), so a version both hold is read locally.
    function connectedSources(){return input.providers.list().filter(item=>item.connected===true).sort((a,b)=>Number(a.shared===true)-Number(b.shared===true)).map(item=>sourceDescriptor(item.id)).filter(Boolean);}
    // Earlier versions of one note come from every connected backup location
    // together: one entry per distinct text, newest first, never the text the
    // note has now. A version the Device Folder already read is not read again
    // from Drive.
    async function collectNoteVersions({interactive=true}={}){
      const sources=connectedSources(),note=noteTarget;if(!note||!sources.length||busy)return freeze({entries:lastEntries});
      const controller=new AbortController();activeSourceId=sources[0].id;activeSourceLabel=sources[0].label;setOperationBusy(true,controller);lastEntries=freeze([]);render();setHistoryStatus('Looking for earlier versions in your backups…');
      try{
        const found=[],failed=[];let skip=null;
        for(const source of sources){
          const result=await input.providers.noteVersions(source.id,note.id,freeze({interactive,signal:controller.signal,presentation:presentationScope,...(skip?{skip}:{})}));
          if(result&&result.cancelled){setHistoryStatus('Cancelled.',true,'cancelled');return freeze({entries:lastEntries});}
          if(result&&result.available){found.push(...result.entries);if(result.covered)skip=freeze({checkpointIds:freeze([...(skip?.checkpointIds||[]),...(result.covered.checkpointIds||[])]),contents:freeze([...(skip?.contents||[]),...(result.covered.contents||[])])});}
          else failed.push(source.label);
        }
        const seen=new Set([note.text]),entries=[];
        for(const entry of found.sort((a,b)=>Date.parse(b.exportedAt)-Date.parse(a.exportedAt)||String(b.checkpointId).localeCompare(String(a.checkpointId)))){
          if(seen.has(entry.text))continue;seen.add(entry.text);
          entries.push(freeze({exportedAt:entry.exportedAt,origin:String(entry.origin||''),location:freeze({sourceId:entry.sourceId,sourceLabel:entry.sourceLabel,checkpointId:entry.checkpointId,exportedAt:entry.exportedAt})}));
        }
        lastEntries=freeze(entries);render();
        const missing=failed.length?` ${failed.join(' and ')} could not be read.`:'';
        setHistoryStatus(entries.length?`${entries.length} earlier version${entries.length===1?'':'s'}.${missing}`:`No earlier versions of this note are in your backups yet.${missing}`,!failed.length);
        return freeze({entries:lastEntries});
      }catch(error){lastEntries=freeze([]);render();setHistoryStatus(userMessage(error,'Earlier versions could not be read safely.'),false);input.diagnostics.capture('backup.note-versions',error,'warn');return freeze({entries:lastEntries});}
      finally{if(activeController===controller)setOperationBusy(false);render();}
    }
    async function openNote(target={}){
      const id=String(target.id||''),label=String(target.label||'').slice(0,160);if(!id)return freeze({opened:false,reason:'invalid'});
      if(busy)return freeze({opened:false,reason:'busy'});
      const sources=connectedSources();if(!sources.length)return freeze({opened:false,reason:'no-source'});
      const {dialog}=elements();if(!dialog)return freeze({opened:false,reason:'unavailable'});
      noteTarget=freeze({id,label,text:String(target.text??''),onRestored:typeof target.onRestored==='function'?target.onRestored:()=>{}});
      activeSourceId=sources[0].id;activeSourceLabel=sources[0].label;setDialogMode();lastEntries=freeze([]);render();clearHistoryProgress();
      if(!dialog.open)dialog.showModal();void collectNoteVersions({interactive:true});
      return freeze({opened:true});
    }
    function close(){const {dialog}=elements();if(dialog?.open)dialog.close();return true;}
    function eventButton(event,selector){const target=event&&event.target;return target&&typeof target.closest==='function'?target.closest(selector):null;}
    function selectedEntry(sourceId,checkpointId){return lastEntries.find(entry=>entry?.location?.sourceId===sourceId&&entry.location.checkpointId===checkpointId)||null;}
    async function recover(event){
      if(busy)return false;const button=eventButton(event,'[data-action="recover-managed-version"][data-version-history-source][data-version-history-checkpoint],[data-action="compare-managed-note"][data-version-history-source][data-version-history-checkpoint]');if(!button||(button.dataset.action==='compare-managed-note')!==!!noteTarget)return false;
      const sourceId=String(button.dataset.versionHistorySource||''),checkpointId=String(button.dataset.versionHistoryCheckpoint||''),entry=selectedEntry(sourceId,checkpointId),location=entry&&entry.location,source=sourceDescriptor(sourceId);if(!location||!source)return false;
      // The version is read from the location the list chose for it.
      activeSourceId=source.id;activeSourceLabel=source.label;
      const note=noteTarget,from=fromDevice(entry,lastEntries),reach=typeof presentation.reach==='function'?presentation.reach():'';
      const choice=note?'combine':await input.interactions.choose({
        title:'Use this version',
        message:`Saved ${dateLabel(location.exportedAt)}${from?`, ${from}`:''}.`,
        details:['A safety version is kept first, so you can go back.','Settings that belong to this device stay as they are.',...(reach?[reach]:[])],
        cancelLabel:'Keep current',
        choices:[presentation.restoreChoices.missing,presentation.restoreChoices.combine,presentation.restoreChoices.replace]
      });
      if(!choice)return false;const controller=new AbortController();setOperationBusy(true,controller,choice==='replace'?'restore-version':'bring-in');setHistoryStatus('');setHistoryProgress({message:choice==='replace'?'Preparing restore…':'Preparing comparison…'});
      try{
        // A read that fails before anything changed (repositoryReadFailed) is
        // tried again from the next location that holds the version.
        const sources=[location,...(Array.isArray(entry.copies)?entry.copies:[])].filter(at=>sourceDescriptor(at.sourceId));let result;
        for(let index=0;;index+=1){
          const at=sources[index];activeSourceId=at.sourceId;activeSourceLabel=at.sourceLabel;
          const options=freeze({presentation:presentationScope,checkpointId:at.checkpointId,confirmed:choice==='replace',note:note?note.id:'',missingOnly:choice==='missing',signal:controller.signal,onProgress:value=>{if(activeController===controller&&!controller.signal.aborted)setHistoryProgress(value);}});
          try{result=choice==='replace'?await input.providers.restoreRepositoryProviderVersion(at.sourceId,options):await input.providers.bringInRepositoryProvider(at.sourceId,options);break;}
          catch(error){const next=sources[index+1];if(!next||error?.repositoryReadFailed!==true||controller.signal.aborted)throw error;input.diagnostics.capture('backup.version-history-other-copy',error,'warn');setHistoryProgress({message:`${at.sourceLabel} could not be read. Reading ${next.sourceLabel} instead…`});}
        }
        clearHistoryProgress();
        const saved=dateLabel(location.exportedAt),noteOutcome=note?{'note-missing':`This note isn’t in the backup from ${saved}.`,'note-unchanged':`The backup from ${saved} has the same text as this note.`,'note-kept':'No changes were made.'}[String(result?.reason||'')]:'';
        if(noteOutcome){setHistoryStatus(noteOutcome,true,'cancelled');return false;}
        if(choice==='missing'&&String(result?.reason||'')==='needs-decision'){setHistoryStatus(presentation.restoreChoices.needsDecision,true,'cancelled');return false;}
        if(result&&result.cancelled||result&&result.reason==='cancelled'){setHistoryStatus('Recovery cancelled safely.',true,'cancelled');return false;}
        if(result&&result.ok===false){const message=userMessage(result.error,'The selected backup could not be applied safely.');setHistoryStatus(message,false);return false;}
        setHistoryStatus(presentation.outcome(choice==='replace'?'restore-version':'bring-in',activeSourceLabel,result?.convergence,result?.summary));lastEntries=freeze([]);setOperationBusy(false);close();
        if(note)try{note.onRestored(freeze({exportedAt:location.exportedAt,sourceLabel:activeSourceLabel}));}catch(error){input.diagnostics.capture('backup.note-restored',error,'warn');}
        return true;
      }catch(error){clearHistoryProgress();const cancelled=error?.name==='AbortError'||String(error?.code||'')==='STUDY_DIRECTOR_IMPORT_CANCELLED',message=cancelled?'Recovery cancelled safely.':userMessage(error,'The selected backup could not be applied safely.');setHistoryStatus(message,cancelled,cancelled?'cancelled':'failed');if(!cancelled)input.diagnostics.capture('backup.provider-scoped-recovery',error,'warn');return false;}
      finally{if(activeController===controller)setOperationBusy(false);}
    }
    // Removes this device's safety version, or a version this app cannot read,
    // after the person confirms.
    async function removeVersion(event){
      if(busy)return false;const button=eventButton(event,'[data-action="remove-managed-version"][data-version-history-source][data-version-history-checkpoint]');if(!button)return false;
      const sourceId=String(button.dataset.versionHistorySource||''),checkpointId=String(button.dataset.versionHistoryCheckpoint||''),entry=selectedEntry(sourceId,checkpointId),location=entry&&entry.location;
      if(!location||!['before-restore','unreadable'].includes(location.tier))return false;
      const safety=location.tier==='before-restore',what=safety?'safety version':'version';
      activeSourceId=location.sourceId;activeSourceLabel=location.sourceLabel;
      const choice=await input.interactions.choose(safety
        ?{title:'Remove safety version?',message:`Remove the temporary Before restore safety version from ${location.sourceLabel}?`,details:['This does not change your current Study Director data.','After removal, this safety version can no longer be used to undo that recovery.'],cancelLabel:'Keep safety version',choices:[{value:'remove',label:'Remove safety version',kind:'danger',description:'Delete this temporary safety version from this backup location.'}]}
        :{title:'Remove this version?',message:`The version from ${dateLabel(location.exportedAt)} in ${location.sourceLabel} can’t be read by this app.`,details:['If another device runs a newer Study Director, it may still use this version. Update this app first to keep it.','Otherwise the file is damaged and can’t be restored.','Removing it does not change your current Study Director data.'],cancelLabel:'Keep version',choices:[{value:'remove',label:'Remove version',kind:'danger',description:'Delete this version from this backup location.'}]});
      if(choice!=='remove')return false;setOperationBusy(true,null,'remove-version');setHistoryStatus(`Removing ${what} from ${location.sourceLabel}…`);
      try{
        const result=await input.providers.removeRepositoryProviderVersion(sourceId,checkpointId);
        if(!result||result.removed!==true){setHistoryStatus(userMessage(result&&result.error,`The ${what} could not be removed safely.`),false);return false;}
        lastEntries=freeze(lastEntries.filter(item=>!(item.location.sourceId===sourceId&&item.location.checkpointId===location.checkpointId)));render();
        const removed=safety?'Safety version removed.':'Version removed.';setHistoryStatus(result.warning?`${removed} Unused backup storage will be cleaned up later.`:removed);return true;
      }catch(error){setHistoryStatus(userMessage(error,`The ${what} could not be removed safely.`),false);input.diagnostics.capture('backup.version-history-remove',error,'warn');return false;}
      finally{setOperationBusy(false);}
    }
    return freeze({
      format:'study-director.backup-recovery-host',contractVersion:1,
      managedRecovery:spec=>coordinator.execute(spec),
      history:freeze({subscribePresentation,open,openNote,close,cancel:cancelActive,refresh:()=>noteTarget?collectNoteVersions({interactive:true}):collectAll({interactive:true}),recover,removeVersion,status:()=>freeze({busy,entries:lastEntries,sourceId:activeSourceId,sourceLabel:activeSourceLabel,progress:progressValue(),status:statusValue()})}),
      status:()=>freeze({managedRecovery:coordinator.status(),history:freeze({busy,entries:lastEntries,sourceId:activeSourceId,sourceLabel:activeSourceLabel,progress:progressValue(),status:statusValue()})})
    });
  }
  return freeze({format:'study-director.backup-recovery-host-module',contractVersion:1,createHost,createPendingStore});
});
})();
