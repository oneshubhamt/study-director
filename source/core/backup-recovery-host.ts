import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {PendingStoreInput,PendingRecord,PendingEntry,RecoveryHostInput,PresentationScope,PresentationLifecycle,HistoryEntry,HistoryLocation,HistoryBatch,MergedHistory,NoteTarget,CoveredNotes,NoteVersion,Progress,HistoryNotice,RecoveryOptions,Suspension,KeptVersionsInput,KeptVersionsController,KeptReviewOutcome,StorageResetController,StorageResetInput,StorageResetRecoveryResult} from '../../types/backup-recovery-host.ts';
import type {RecoverySpec,ManagedRecoveryInput} from '../../types/managed-recovery.ts';
import type {BackupRuntimeHostController,BackupRuntimeHostInput,Completion,ImportedAsset,Signal} from '../../types/backup-runtime-host.ts';
import type {BackupRuntimeInput,Journal} from '../../types/backup.ts';
import type {AssetMetadata} from '../../types/asset-storage.ts';
import type {AttachmentDeletion,NoteDeletion,SavedDayDeletion} from '../../types/backup-models.ts';
const sdBackupRecoveryHostFactory=(()=>{
'use strict';
const registry=(globalThis as unknown as Record<symbol,unknown>)[Symbol.for('studyDirector.internalModules.v1')] as ModuleRegistration<'backup-recovery-host','study-director.backup-recovery-host-module'>|undefined;
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,functionPort:functions}=registry.contracts;
const createModule=()=>{
  const freeze=Object.freeze;
  const PENDING_FORMAT='study-director.managed-provider-backup-pending';
  const PROVIDER_ID=/^[a-z][a-z0-9-]{0,40}$/u;
  const TECHNICAL_RECOVERY_TERMS=/\b(?:repository|checkpoint|manifest|commit marker|reconciliation)\b/iu;
  function normalizePending(input:unknown):PendingRecord{
    const value=input&&typeof input==='object'?input as {entries?:unknown}:null;
    const seen=new Set<string>(),entries:PendingEntry[]=[];
    for(const entry of (Array.isArray(value?.entries)?value.entries:[]) as unknown[]){
      const raw=entry as {providerId?:unknown;requestedAt?:unknown;sourceRevision?:unknown}|null;
      const providerId=String(raw?.providerId||'').trim().toLowerCase(),requestedAt=String(raw?.requestedAt||''),sourceRevision=String(raw?.sourceRevision||'');
      if(!PROVIDER_ID.test(providerId)||seen.has(providerId)||!Number.isFinite(Date.parse(requestedAt))||!Number.isFinite(Date.parse(sourceRevision)))continue;
      seen.add(providerId);entries.push(freeze({providerId,requestedAt:new Date(requestedAt).toISOString(),sourceRevision:new Date(sourceRevision).toISOString()}));
      if(entries.length>=8)break;
    }
    entries.sort((a,b)=>a.providerId.localeCompare(b.providerId));
    return freeze({format:PENDING_FORMAT,version:1,entries:freeze(entries)});
  }
  function userMessage(error:unknown,fallback:string){
    const raw=String(error&&(error as {message?:unknown}).message||error||'').trim();
    if(!raw)return fallback;
    return TECHNICAL_RECOVERY_TERMS.test(raw)?fallback:raw;
  }
  function createPendingStore(input:PendingStoreInput){
    exactObject(input,['storage','diagnostics','sourceRevision'],'Provider pending store input');
    functions(input.storage,['read','remove','write'],'Provider pending storage');
    if(typeof input.sourceRevision!=='function'||typeof input.diagnostics.capture!=='function')throw new TypeError('Provider pending store dependencies are invalid.');
    let pendingWriteChain:Promise<unknown>=Promise.resolve();
    async function readPending(){
      try{return normalizePending(await input.storage.read());}
      catch(error){input.diagnostics.capture('backup.pending-provider-read',error,'error');throw error;}
    }
    function mutatePending(operation:(current:PendingRecord)=>PendingRecord){
      const run=pendingWriteChain.catch(()=>null).then(async()=>{
        const current=await readPending(),next=normalizePending(operation(current));
        if(next.entries.length)await input.storage.write(next);
        else await input.storage.remove();
        return next;
      });
      pendingWriteChain=run.catch(()=>null);return run;
    }
    async function markPending(providerId:string){
      const id=String(providerId||'').trim().toLowerCase();if(!PROVIDER_ID.test(id))return false;
      const now=new Date().toISOString(),revision=String(input.sourceRevision()||''),sourceRevision=Number.isFinite(Date.parse(revision))?new Date(revision).toISOString():now;
      await mutatePending(current=>{const prior=current.entries.find(entry=>entry.providerId===id),requestedAt=new Date(Math.max(Date.parse(now),Date.parse(prior?.requestedAt||'')+1||0)).toISOString();return {format:PENDING_FORMAT,version:1,entries:[...current.entries.filter(entry=>entry.providerId!==id),{providerId:id,requestedAt,sourceRevision}]};});return true;
    }
    async function clearPending(providerId:string,expected:PendingEntry|null|undefined=undefined){
      const id=String(providerId||'').trim().toLowerCase();if(!PROVIDER_ID.test(id))return false;
      let cleared=true;await mutatePending(current=>{const pending=current.entries.find(entry=>entry.providerId===id)||null;if(expected!==undefined&&JSON.stringify(pending)!==JSON.stringify(expected)){cleared=false;return current;}return {format:PENDING_FORMAT,version:1,entries:current.entries.filter(entry=>entry.providerId!==id)};});return cleared;
    }
    async function pending(providerId:string){
      const id=String(providerId||'').trim().toLowerCase();return (await readPending()).entries.find(entry=>entry.providerId===id)||null;
    }
    return freeze({read:pending,mark:markPending,clear:clearPending});
  }
  function createKeptVersions(input:Readonly<KeptVersionsInput>):Readonly<KeptVersionsController>{
    exactObject(input,['controller','reviews','diagnostics','environment','notifications','view'],'Kept Versions input');
    functions(input.controller,['status','resolveConvergedKeptVersions','reviewKeptVersions'],'Kept Versions controller port');
    functions(input.reviews,['list'],'Kept Versions review store');
    functions(input.diagnostics,['capture'],'Kept Versions diagnostics port');
    functions(input.environment,['canMutate','now','connectCardOpen','sessionYieldedAt'],'Kept Versions environment port');
    functions(input.notifications,['notify','resolveEvent'],'Kept Versions notification port');
    functions(input.view,['render','renderLocation','scheduleStatus','refreshNotes'],'Kept Versions view port');
    let count=0,generation=0,seen:Set<string>|null=null;
    let notes=new Set<string>();
    async function refresh(){
      const token=++generation;let open;
      try{
        open=(await input.reviews.list()).filter(review=>!review.resolvedAt);
        if(open.length&&input.environment.canMutate()&&!input.controller.status().busy){
          try{await input.controller.resolveConvergedKeptVersions();}
          catch(error){input.diagnostics.capture('kept-versions.convergence',error,'warn');}
          open=(await input.reviews.list()).filter(review=>!review.resolvedAt);
        }
      }catch(error){input.diagnostics.capture('kept-versions.refresh',error,'warn');return false;}
      if(token!==generation)return false;
      const next=new Set(open.filter(review=>review.subject==='note').map(review=>review.ref));
      const notesChanged=[...next].sort().join('|')!==[...notes].sort().join('|');
      const fresh=seen?open.filter(review=>!seen!.has(review.id)):[];
      seen=new Set([...(seen||[]),...open.map(review=>review.id)]);
      count=open.length;notes=next;input.view.render();input.view.renderLocation();input.view.scheduleStatus();
      if(notesChanged)input.view.refreshNotes();
      if(!count)input.notifications.resolveEvent('sync','kept-new');
      else if(fresh.length)announce(fresh);
      return true;
    }
    function announce(fresh:readonly {subject:string}[]){
      if(input.environment.connectCardOpen())return;
      if(input.environment.now()-input.environment.sessionYieldedAt()<60000&&fresh.every(review=>review.subject==='session'))return;
      input.notifications.notify({
        source:'sync',key:'kept-new',kind:'warning',tier:'news',title:'Kept for review',
        message:`${count===1?'One alternative needs':`${count} alternatives need`} review because their differences could not be safely settled. Verified matching alternatives are cleared automatically; choose what to keep when ready.`,
        action:freeze({label:'Review',opens:true,run:()=>void review()})
      });
    }
    async function review(ref:string=''):Promise<KeptReviewOutcome|null>{
      try{
        const result=await input.controller.reviewKeptVersions({ref:String(ref||'')});
        if(result.cancelled)return result;
        const reviewed=Number(result.reviewed)||0,changed=Number(result.changed)||0,left=Number(result.left)||0;
        const parts=[reviewed?`${reviewed} reviewed`:'',changed?`${changed} changed while you chose; review ${changed===1?'it':'them'} again`:'',left?`${left} still waiting${!reviewed&&!changed?' (a kept session waits until this session ends)':''}`:''].filter(Boolean);
        input.notifications.notify({source:'sync',key:'kept-review',title:'Kept versions',message:`${parts.join(' · ')||'Nothing to review'}.`});
        return result;
      }catch(error){
        input.diagnostics.capture('kept-versions.review',error,'warn');
        const message=error&&typeof error==='object'&&'message' in error?String((error as {message?:unknown}).message||''):'';
        input.notifications.notify({source:'sync',key:'kept-review',kind:'error',title:'Review not saved',message:message||'Nothing was changed. Try again.'});
        return null;
      }finally{void refresh();}
    }
    return freeze({format:'study-director.kept-versions' as const,contractVersion:1 as const,refresh,review,count:()=>count,note:(id:string)=>notes.has(String(id||''))});
  }

  function createRuntime<Token>(input:Readonly<BackupRuntimeHostInput<Token>>):Readonly<BackupRuntimeHostController>{
    exactObject(input,['module','configuration','appData','storageHealthKey','storageHealth','storageGeneration','personal','files','processing','protection','backgroundAvailable','assets','referenceRevision','mutationGeneration','baseline','codecs','reconciliation','noteReconciliation','session','domain','view','events','verifiedRecovery','interactions','operations','environment','diagnostics'],'Backup runtime host input');
    if(!Object.isFrozen(input.module)||input.module.format!=='study-director.backup-module'||input.module.contractVersion!==1)throw new TypeError('Backup runtime module is unavailable or incompatible.');
    let fastFenceReady=false;
    function sourceRevision(){
      const stored=input.appData.local.getJson(input.storageHealthKey,null),memory=input.storageHealth.snapshot();let latest='',latestAt=NaN;
      const storedRow=stored&&typeof stored==='object'?stored as Record<string,unknown>:null;
      for(const value of [storedRow?.['lastLocalSaveAt'],memory.lastLocalSaveAt]){
        const revision=String(value||''),at=Date.parse(revision);
        if(Number.isFinite(at)&&(!Number.isFinite(latestAt)||at>latestAt)){latest=revision;latestAt=at;}
      }
      return latest;
    }
    async function fullSnapshotRevision(){
      return JSON.stringify([
        await input.appData.dailyRecords.datasetRevision(),await input.appData.deletionRecovery.savedDays(),await input.appData.deletionRecovery.notes(),await input.appData.deletionRecovery.attachments(),
        input.referenceRevision(),await input.personal.data.exportData({flush:false}),input.personal.inputValue(),await input.assets.list()
      ]);
    }
    async function snapshotRevision(options:Readonly<{full?:boolean}>={}){
      if(options.full===true||!fastFenceReady||!input.appData.mutationEpoch.eligible())return fullSnapshotRevision();
      try{
        const epoch=await input.appData.mutationEpoch.read();if(!epoch)return fullSnapshotRevision();
        return `study-director.fast-capture-fence.v1|${epoch.token}|${input.mutationGeneration()}|${sourceRevision()}`;
      }catch(error){input.diagnostics.capture('backup.fast-capture-fence',error,'warn');return fullSnapshotRevision();}
    }
    async function importAttachments(items:readonly ImportedAsset[],options:Readonly<{signal?:Signal;replace?:boolean}>={}){
      return input.assets.during(async()=>{
        const token=input.assets.issueToken('restore attachments'),staged:AssetMetadata[]=[],rows:[string,AssetMetadata][]=[],contents=new Map<string,AssetMetadata>();
        const local=new Map((await input.assets.list()).map(row=>[row.hash+':'+row.size,row] as const));
        const check=()=>{input.assets.assertToken(token,'restore attachments');if(options.signal?.aborted)throw Object.assign(new Error('Restore cancelled.'),{name:'AbortError'});};
        try{
          for(const item of items){
            check();const group=item.checksum+':'+item.size;let content=contents.get(group)||local.get(group);
            if(!content){
              const blob=await input.assets.identify(item.blob);if(blob.type!==item.mimeType)throw new Error('Backup attachment type does not match its bytes.');
              content=await input.assets.stage(item.assetId,blob,{token,...(options.signal?{signal:options.signal}:{}),check});staged.push(content);
              if(content.hash!==item.checksum)throw new Error('Restored attachment failed stored-byte verification.');
            }
            contents.set(group,content);rows.push([item.assetId,{...content,type:item.mimeType,name:item.name,library:item.library}]);
          }
          check();await input.assets.publish(rows,token,check,{restoreLabels:true,replaceAll:options.replace===true});input.assets.invalidateLibrary();return rows.length;
        }catch(error){await input.assets.discard(staged).catch(()=>{});throw error;}
      });
    }
    const persistence=freeze({
      activeSessionLoad:(retry=0,options={})=>input.appData.activeSession.load(retry,options),activeSessionSave:(value,options)=>input.appData.activeSession.save(value,options),
      activeSessionClear:()=>input.appData.activeSession.clear(),activeSessionSettled:()=>input.appData.activeSession.settled(),
      dailyRecordBackupDates:()=>input.appData.dailyRecords.backupDates(),dailyRecordBackupMonth:(month,options)=>input.appData.dailyRecords.backupMonth(month,options),
      dailyRecordDocuments:(dates,options)=>input.appData.dailyRecords.documents(dates,options),dailyRecordImportBatches:(records,options)=>input.appData.dailyRecords.importBatches(records,options),
      dailyRecordRemove:(date,options)=>input.appData.dailyRecords.remove(date,options),dailyRecordTimestamp:value=>input.appData.dailyRecords.timestamp(value),
      notesExportPayload:()=>input.appData.notes.exportPayload(),notesReadFreshPayload:()=>input.appData.notes.readFreshPayload(),notesReadFreshItems:keys=>input.appData.notes.readFreshItems(keys),
      notesFlush:options=>input.appData.notes.flush(options),notesNormalizePayload:value=>input.appData.notes.normalizePayload(value),notesAlignByTitle:(value,deletedIds)=>input.appData.notes.alignByTitle(value,deletedIds),
      notesTrashKey:key=>input.codecs.dailyRecord.noteKeys.trash(key),notesFailure:()=>input.appData.notes.failure(),
      restoreJournalPrepare:async value=>{
        if(!(value.blob instanceof Blob))throw new TypeError('Restore rollback bytes are unavailable.');
        const backupFile=await input.processing.run('file.persist',{file:value.blob}),{blob,...metadata}=value;
        try{await input.appData.restoreJournal.prepare({...metadata,backupFile});}
        catch(error){
          try{
            const raw:unknown=await input.appData.restoreJournal.read(),row=raw&&typeof raw==='object'?raw as Record<string,unknown>:null,payload=row?.['payload'],payloadRow=payload&&typeof payload==='object'?payload as Record<string,unknown>:null,ref=payloadRow?.['backupFile'],refRow=ref&&typeof ref==='object'?ref as Record<string,unknown>:null;
            if(String(refRow?.['name']||'')!==backupFile.name)await input.files.release(backupFile.name);
          }catch(probeError){input.diagnostics.capture('backup.restore-journal-orphan-check',probeError,'warn');}
          throw error;
        }
      },
      restoreJournalRead:async():Promise<Journal|null>=>{
        const raw:unknown=await input.appData.restoreJournal.read();if(!raw)return null;
        const row=raw&&typeof raw==='object'?raw as Record<string,unknown>:null,stateRow=row?.['state']&&typeof row['state']==='object'?row['state'] as Record<string,unknown>:null,payloadRow=row?.['payload']&&typeof row['payload']==='object'?row['payload'] as Record<string,unknown>:null;
        if(!stateRow||!payloadRow)throw new Error('The interrupted-restore journal is incomplete or corrupted.');
        const state={format:String(stateRow['format']||''),version:Number(stateRow['version']),id:String(stateRow['id']||''),phase:String(stateRow['phase']||''),createdAt:String(stateRow['createdAt']||''),updatedAt:String(stateRow['updatedAt']||'')};
        const refValue=payloadRow['backupFile'],refRow=refValue&&typeof refValue==='object'?refValue as Record<string,unknown>:null;
        let blob:Blob;
        if(refRow){
          const ref={name:String(refRow['name']||''),size:Number(refRow['size']),hash:String(refRow['hash']||'')};blob=await input.processing.run('file.read',{ref});
        }else{
          const value=payloadRow['blob'];if(!(value instanceof Blob))throw new Error('Restore rollback bytes are unavailable.');blob=value;
        }
        const rows=(value:unknown)=>Array.isArray(value)?value:[];
        const savedDayDeletions:SavedDayDeletion[]=rows(payloadRow['savedDayDeletions']).flatMap(entry=>{const item=entry&&typeof entry==='object'?entry as Record<string,unknown>:null,date=String(item?.['date']||''),deletedAt=String(item?.['deletedAt']||'');return date&&deletedAt?[{date,deletedAt}]:[];});
        const noteDeletions:NoteDeletion[]=rows(payloadRow['noteDeletions']).flatMap(entry=>{const item=entry&&typeof entry==='object'?entry as Record<string,unknown>:null,key=String(item?.['key']||''),deletedAt=String(item?.['deletedAt']||'');return key&&deletedAt?[{key,deletedAt}]:[];});
        const attachmentDeletions:AttachmentDeletion[]=rows(payloadRow['attachmentDeletions']).flatMap(entry=>{const item=entry&&typeof entry==='object'?entry as Record<string,unknown>:null,assetId=String(item?.['assetId']||''),deletedAt=String(item?.['deletedAt']||'');return assetId&&deletedAt?[{assetId,deletedAt}]:[];});
        return {state,payload:{blob,filename:String(payloadRow['filename']||''),savedDayDeletions,noteDeletions,attachmentDeletions}};
      },
      restoreJournalMark:async(id,phase)=>{const marked=await input.appData.restoreJournal.mark(id,phase);if(phase==='verified')input.events.settleStorageReset();return marked;},
      restoreJournalClear:async id=>{
        const raw:unknown=await input.appData.restoreJournal.read();await input.appData.restoreJournal.clear(id);
        const row=raw&&typeof raw==='object'?raw as Record<string,unknown>:null,payload=row?.['payload'],payloadRow=payload&&typeof payload==='object'?payload as Record<string,unknown>:null,ref=payloadRow?.['backupFile'],refRow=ref&&typeof ref==='object'?ref as Record<string,unknown>:null,name=String(refRow?.['name']||'');
        if(name)try{await input.files.release(name);}catch(error){input.diagnostics.capture('backup.restore-journal-file-release',error,'warn');}
      },
      personalSettle:async options=>{const backupCapture=options?.backupCapture===true;if(input.personal.canMutate()&&await input.personal.draft.flush({backupCapture})===false)throw new Error('The current Plan draft could not be safely settled before backup.');await input.personal.data.settled({backupCapture});return true;},
      personalExport:options=>input.personal.data.exportData(options),personalImport:value=>input.personal.data.importData(value),personalVerify:value=>input.personal.data.verify(value),
      sourceRevision,snapshotRevision,storageGeneration:input.storageGeneration,canonicalMutationEpochRead:()=>input.appData.mutationEpoch.read(),canonicalPreparationRebase:()=>input.appData.mutationEpoch.rebasePreparation(),
      preparationUnitStamps:()=>input.appData.preparationUnits.list(),preparationUnitReplace:units=>input.appData.preparationUnits.replace(units),installationId:()=>input.appData.provenance.installationId(),
      deletionRecoveryFlush:()=>input.appData.deletionRecovery.flush(),deletionRecoverySavedDays:()=>input.appData.deletionRecovery.savedDays(),deletionRecoveryReplaceSavedDays:values=>input.appData.deletionRecovery.replaceSavedDays(values),
      deletionRecoveryNotes:()=>input.appData.deletionRecovery.notes(),deletionRecoveryReplaceNotes:values=>input.appData.deletionRecovery.replaceNotes(values),deletionRecoveryAttachments:()=>input.appData.deletionRecovery.attachments(),
      deletionRecoveryReplaceAttachments:values=>input.appData.deletionRecovery.replaceAttachments(values),deletionRecoveryClearAttachment:assetId=>input.appData.deletionRecovery.clearAttachment(assetId),
      reconciliationBaseRead:()=>input.baseline.readHeader(),reconciliationBaseReadNotes:keys=>input.baseline.readNotes(keys),reconciliationBaseReadDayAncestry:(dates,checkpointId)=>input.baseline.readDayAncestry(dates,checkpointId),
      reconciliationBaseWrite:(checkpointId,spec)=>input.baseline.write(checkpointId,spec),pendingReviewsList:()=>input.appData.pendingReviews.list(),pendingReviewsReadItems:ids=>input.appData.pendingReviews.readItems(ids),
      pendingReviewsMerge:values=>input.appData.pendingReviews.merge(values),pendingReviewsReplace:values=>input.appData.pendingReviews.replace(values),pendingReviewsResolve:ids=>input.appData.pendingReviews.resolve(ids)
    } satisfies BackupRuntimeInput['ports']['persistence']);
    const assets=freeze({
      get:id=>input.assets.get(id),put:(id,blob)=>input.assets.put(id,blob),keys:()=>input.assets.keys(),list:()=>input.assets.list(),
      importAll:(items,signal)=>importAttachments(items,{signal}),restoreAll:items=>importAttachments(items,{replace:true}),
      removeMany:ids=>input.assets.removeMany(ids),removeMetadata:ids=>input.assets.removeMetadata(ids),scheduleMaintenance:delay=>input.assets.scheduleMaintenance(delay)
    } satisfies BackupRuntimeInput['ports']['assets']);
    const exportsPort=freeze({
      backgroundAvailable:input.backgroundAvailable,cancel:input.processing.cancel,protect:input.protection.protect,unprotect:input.protection.unprotect,
      followProtection:input.protection.follow,check:input.processing.check,
      scope:<T>(operation:()=>Promise<T>)=>input.assets.during(()=>input.processing.scope(operation)),
      job:<T>(operation:()=>Promise<T>,options?:{wait?:boolean;surface?:string})=>input.assets.during(()=>input.processing.job(operation,options)),
      run:input.processing.run,download:input.processing.download,chooseSave:input.processing.chooseSave,save:input.processing.save
    } satisfies BackupRuntimeInput['ports']['exports']);
    let runtime!:ReturnType<BackupRuntimeHostInput<Token>['module']['createRuntime']>;
    const events=freeze({
      libraryChanged:()=>input.events.libraryChanged(),reconcileNotes:input.events.reconcileNotes,restoreNotesSnapshot:input.events.restoreNotesSnapshot,
      restoreSessionState:input.events.restoreSessionState,verifyActiveSessionRuntime:input.events.verifyActiveSessionRuntime,
      restoredFromFile:()=>{input.events.notifyBackupChange({urgent:true,reason:'file-restore'});return runtime.providers.automaticActive();},
      backupCompleted:(context:Completion)=>{
        if(context?.userExport)input.events.settleStorageReset();input.storageHealth.markOk('backup');input.events.resetBackupNudge();input.events.refreshStorageWarning();
        if(context?.copy)void input.verifiedRecovery.record(context.copy).catch(error=>input.diagnostics.capture('backup.freshness-receipt',error,'warn'));input.events.scheduleUpdate(250);
      }
    } satisfies BackupRuntimeInput['ports']['events']);
    runtime=input.module.createRuntime(freeze({ports:freeze({
      configuration:input.configuration,persistence,assets,codecs:input.codecs,reconciliation:input.reconciliation,
      noteReconciliation:freeze({resolve:(options:Parameters<BackupRuntimeInput['ports']['noteReconciliation']['resolve']>[0])=>input.noteReconciliation.withMaintenancePaused(()=>input.noteReconciliation.controller.resolve(options)),merge:input.noteReconciliation.merge}),
      exports:exportsPort,session:input.session,domain:input.domain,view:input.view,events,interactions:input.interactions,operations:input.operations,environment:input.environment,diagnostics:input.diagnostics
    })}));
    if(!Object.isFrozen(runtime)||runtime.format!=='study-director.backup-runtime'||runtime.contractVersion!==1)throw new Error('Study Director Backup runtime is unavailable or incompatible.');
    return freeze({format:'study-director.backup-runtime-host' as const,contractVersion:1 as const,runtime,setFastFenceReady:(value:boolean)=>(fastFenceReady=value),sourceRevision,snapshotRevision});
  }

  function createRetainedBackupFiles(input:Readonly<import('../../types/backup-recovery-host.ts').RetainedBackupFilesInput>):Readonly<import('../../types/backup-recovery-host.ts').RetainedBackupFilesController>{
    exactObject(input,['restoreJournalPayload','repositoryIntegrityState'],'Retained backup files input');
    if(typeof input.restoreJournalPayload!=='function'||typeof input.repositoryIntegrityState!=='function')throw new TypeError('Retained backup file readers are invalid.');
    async function names(){
      const payload=await input.restoreJournalPayload(),integrity=await input.repositoryIntegrityState(),retained:string[]=[];
      const journal=payload&&typeof payload==='object'?payload as Record<string,unknown>:null;
      const backupFile=journal?.['backupFile'];
      if(backupFile&&typeof backupFile==='object'){
        const name=String((backupFile as Record<string,unknown>)['name']||'');if(name)retained.push(name);
      }
      const root=integrity&&typeof integrity==='object'?integrity as Record<string,unknown>:null;
      const locations=root?.['locations'];
      if(locations&&typeof locations==='object')for(const target of Object.values(locations as Record<string,unknown>)){
        if(!target||typeof target!=='object')continue;
        const partial=(target as Record<string,unknown>)['partial'];if(!partial||typeof partial!=='object')continue;
        const row=partial as Record<string,unknown>;
        for(const part of [row['stored'],row['plain']]){
          if(!part||typeof part!=='object')continue;
          const name=String((part as Record<string,unknown>)['name']||'');if(name)retained.push(name);
        }
      }
      return freeze([...new Set(retained)]);
    }
    return freeze({format:'study-director.retained-backup-files' as const,contractVersion:1 as const,names});
  }

  function createStorageReset(input:Readonly<StorageResetInput>):Readonly<StorageResetController>{
    exactObject(input,['authority','canonical','writeback','provider','device','storage','presentation','ownership','mutation','background','session','view','readiness','diagnostics','environment'],'Storage reset recovery input');
    functions(input.authority,['canMutate'],'Storage reset authority');
    functions(input.canonical,['dailyRecordsList','notesReadFreshPayload','activeSessionLoad','planDataRead','attachmentsList','pendingReviewsList','savedDayDeletions','noteDeletions'],'Storage reset canonical data');
    functions(input.writeback,['installationKeep','notesRecover','planRewrite','settingsFlush','hasTasks','writeLiveDraft'],'Storage reset writeback');
    functions(input.provider,['history','restoreRepositoryProviderVersion','bringInRepositoryProvider','syncRepositoryProvider','list','locationStatus','suspendBackground','connected'],'Storage reset provider');
    functions(input.device,['status','connect','install','refreshPermission','rememberAfterStorageReset'],'Storage reset device backup');
    functions(input.storage,['health','updateHealth','storedHealth','indexedDbLifecycle'],'Storage reset storage');
    functions(input.presentation,['restoreChoices','openRestore','confirm','notify','emit','resolve','subscribe'],'Storage reset presentation');
    functions(input.ownership,['announceStorageReset'],'Storage reset ownership');
    functions(input.mutation,['settled'],'Storage reset mutation');
    functions(input.background,['wake'],'Storage reset background');
    functions(input.session,['hasBlocking','suspend'],'Storage reset session');
    functions(input.view,['refreshAfterWriteback'],'Storage reset view');
    functions(input.readiness,['reconcileStartupChangeClock'],'Storage reset readiness');
    functions(input.diagnostics,['capture'],'Storage reset diagnostics');
    functions(input.environment,['now','nowIso','setTimeout','clearTimeout'],'Storage reset environment');

    const RETRY=freeze([3000,10000,30000]),PARTS=freeze({device:'this device’s ID',notes:'notes',plans:'plans',settings:'settings',session:'today’s session'});
    type StepName=keyof typeof PARTS;
    type Hold={provider:Suspension|null;deviceReady:Promise<boolean>|null;reloaded:boolean;clearedAt:string;tried?:Set<string>};
    let hold:Hold|null=null,handling:Promise<void>|null=null,since=0,acknowledged=0;
    let offerRunning=false,offerDismissed=false,hintNotified=false,deviceInstallPromise:Promise<unknown>|null=null;

    function unresolved(){return !!hold||input.storage.indexedDbLifecycle().resets>acknowledged;}
    async function canonicalEmpty(){
      try{
        const [records,notePayload,active,plans,assets,reviews]=await Promise.all([
          input.canonical.dailyRecordsList(),input.canonical.notesReadFreshPayload(),input.canonical.activeSessionLoad(),input.canonical.planDataRead(),input.canonical.attachmentsList(),input.canonical.pendingReviewsList()
        ]);
        if(!active||active.ok!==true||active.error)throw active?.error||new Error('Active Session could not be read completely.');
        if(!Array.isArray(reviews as unknown))throw new Error('Kept Versions could not be read completely.');
        const hasPlan=!!(plans&&(String(plans.draft||'').trim()||(plans.savedPlans||[]).length));
        return !(records||[]).length&&!Object.keys(notePayload||{}).length&&!active.value&&!hasPlan&&!(assets||[]).length&&!reviews.some(review=>!review.resolvedAt);
      }catch(error){input.diagnostics.capture('backup.device-recovery-empty-check',error,'warn');return null;}
    }
    async function studyDataLostHere(){
      const health=input.storage.health();if(!health.lastStudyDataSaveAt||unresolved())return false;
      try{const deletions=await Promise.all([input.canonical.savedDayDeletions(),input.canonical.noteDeletions()]);return deletions.every(list=>!(list||[]).length);}
      catch(error){input.diagnostics.capture('backup.device-recovery-deletions',error,'warn');return false;}
    }
    async function offerDeviceRecovery(options:Readonly<{reason?:string;latestBefore?:number}>={}){
      if(offerRunning||offerDismissed||!input.authority.canMutate())return false;
      if(!await canonicalEmpty())return false;
      const state=input.device.status(),latestBefore=Number(options.latestBefore)||Number.POSITIVE_INFINITY;
      if(!state.connected){
        if(options.reason==='startup'&&!hintNotified&&await studyDataLostHere()){
          hintNotified=true;input.presentation.notify({key:'device-recovery-empty-local',tier:'news',title:'No local study data found',message:`If browser data was cleared, restore from ${input.presentation.restoreChoices()}.`,action:{label:'Restore from backup',opens:true,run:()=>void input.presentation.openRestore()}});
        }
        return false;
      }
      offerRunning=true;
      try{
        const history=await input.provider.history('device-folder',{interactive:false});
        const candidate=history?.available?(history.entries||[]).find(entry=>entry?.location?.tier==='latest'&&Date.parse(String(entry.exportedAt||entry.location?.exportedAt||''))<=latestBefore):null;
        if(!candidate)return false;
        const accepted=await input.presentation.confirm({
          title:'Recover from Device Folder?',message:'This browser has no local study data, but an existing Device Folder backup is available.',
          details:[`Latest backup: ${new Date(candidate.location.exportedAt).toLocaleString()}.`,'Study Director checks the backup before replacing this device’s data. Nothing is restored unless you choose Recover latest.'],
          confirmLabel:'Recover latest',cancelLabel:'Not now'
        });
        offerDismissed=true;if(!accepted)return false;
        try{const restored=await input.provider.restoreRepositoryProviderVersion('device-folder',{checkpointId:candidate.location.checkpointId,confirmed:true});return !!restored&&restored.cancelled!==true;}
        catch(error){input.diagnostics.capture('backup.device-recovery-offer',error,'warn');return false;}
      }finally{offerRunning=false;}
    }
    async function connectDevice(){
      const startedAt=input.environment.now(),result=await input.device.connect();
      if(input.device.status().connected){
        if(hold)await recoverAfterConnect('device-folder');
        else await offerDeviceRecovery({reason:'connect',latestBefore:startedAt-1});
      }
      return result;
    }
    function list(names:readonly StepName[]){const parts=names.map(name=>PARTS[name]||name);return parts.length<2?parts.join(''):`${parts.slice(0,-1).join(', ')} and ${parts.at(-1)}`;}
    function showDecision({unsaved=[],retrying=false}:{unsaved?:readonly StepName[];retrying?:boolean}={}){
      const active=hold,clearedAt=Date.parse(String(active?.clearedAt||'')),parts:string[]=[];
      if(active?.reloaded)parts.push(`Browser data was cleared${Number.isFinite(clearedAt)?` on ${new Date(clearedAt).toLocaleString()}`:''}.`);
      else if(unsaved.length)parts.push(`Not saved again${retrying?' yet':''}: ${list(unsaved)}. ${retrying?'Study Director is retrying. ':''}Until then that data exists only in this tab, so keep it open${retrying?'':' and export a backup file from Data & Backup'}.`);
      else parts.push('Your open notes, plans, settings and today’s session were saved again.');
      const backingUp=input.device.status().connected||input.provider.connected('google-drive');
      parts.push(backingUp?'Past Saved Days and attachments need a restore from backup.':`Past Saved Days and attachments can be restored from ${input.presentation.restoreChoices()}.`);
      if(backingUp)parts.push('Automatic backups are paused until you choose.');
      input.presentation.emit({source:'storage-reset',id:'detected',severity:'warning',lifecycle:'succeeded',foreground:false,tier:'critical',surface:'toast',dismissible:false,
        title:'Browser data was cleared',message:parts.join(' '),
        action:{label:'Restore from backup',run:()=>void restore()},
        secondaryAction:{label:'Continue with current data',run:()=>settle()}});
    }
    function ensureDeviceInstalled(){
      if(!deviceInstallPromise)deviceInstallPromise=input.readiness.reconcileStartupChangeClock().then(()=>input.device.install()).catch(error=>{deviceInstallPromise=null;throw error;});
      return deviceInstallPromise;
    }
    function beginHold(clearedAt:unknown){
      if(hold)return hold;
      const next:Hold={provider:null,deviceReady:null,reloaded:false,clearedAt:String(clearedAt||input.environment.nowIso())};hold=next;since=input.environment.now();
      try{next.provider=input.provider.suspendBackground('storage-reset');}catch(error){input.diagnostics.capture('storage-reset.provider-suspend',error,'warn');}
      next.deviceReady=new Promise<boolean>(resolve=>{
        let finished=false;
        const complete=(value:boolean)=>{if(finished)return;finished=true;input.environment.clearTimeout(timer);resolve(value);};
        const timer=input.environment.setTimeout(()=>{input.diagnostics.capture('storage-reset.device-ready',new Error('Device Folder readiness did not finish in time.'),'warn');complete(false);},8000);
        void ensureDeviceInstalled().then(()=>input.device.refreshPermission()).then(()=>complete(input.device.status().connected)).catch(error=>{input.diagnostics.capture('storage-reset.device-ready',error,'warn');complete(false);});
      });
      if(input.storage.health().browserDataClearedAt!==next.clearedAt)input.storage.updateHealth({browserDataClearedAt:next.clearedAt});
      return next;
    }
    const steps:Readonly<Record<StepName,()=>boolean|PromiseLike<boolean>>>=freeze({
      device:()=>input.writeback.installationKeep(),notes:()=>input.writeback.notesRecover(),plans:()=>input.writeback.planRewrite(),settings:()=>input.writeback.settingsFlush(),
      session:async()=>{if(!input.writeback.hasTasks())return true;const result=await input.writeback.writeLiveDraft();return !!(result&&result.ok&&result.storage?.idb===true);}
    });
    async function writeBack(active:Hold){
      let pending=Object.keys(steps) as StepName[];
      for(let attempt=0;;attempt+=1){
        const failed:StepName[]=[];
        for(const name of pending){let saved=false;try{saved=await steps[name]()===true;}catch(error){input.diagnostics.capture(`storage-reset.${name}`,error,'error');}if(!saved)failed.push(name);}
        if(!failed.length||attempt>=RETRY.length||hold!==active||!input.authority.canMutate())return failed;
        pending=failed;showDecision({unsaved:failed,retrying:true});
        await new Promise<void>(resolve=>input.environment.setTimeout(resolve,RETRY[attempt]!));
      }
    }
    async function restoreMissing(active:Hold,id:string=''){
      if(!input.authority.canMutate())return false;
      const locations=input.provider.list(),location=id?locations.find(item=>item.id===id&&item.connected):locations.find(item=>item.id==='device-folder'&&item.connected)||locations.find(item=>item.connected);if(!location)return false;
      (active.tried??=new Set()).add(location.id);
      let outcome:{exportedAt:string|undefined;result:StorageResetRecoveryResult;label:string}|null=null;
      try{const restored=await input.provider.bringInRepositoryProvider(location.id,{missingOnly:true,quiet:true,before:active.clearedAt});if(restored&&restored.cancelled===false&&restored.verified)outcome={exportedAt:restored.exportedAt,result:restored,label:location.label};}
      catch(error){input.diagnostics.capture('storage-reset.missing-restore',error,'warn');}
      if(!outcome)return false;
      settle();
      const at=Date.parse(String(outcome.exportedAt||'')),days=Math.max(0,Number(outcome.result.added)||0),files=Math.max(0,Number(outcome.result.assetsRestored)||0);
      const source=`your ${outcome.label} backup${Number.isFinite(at)?` of ${new Date(at).toLocaleString()}`:''}`,count=(value:number,word:string)=>`${value} ${word}${value===1?'':'s'}`;
      input.presentation.emit({source:'storage-reset',id:'restored',severity:'success',lifecycle:'succeeded',foreground:false,tier:'news',surface:'toast',title:'Browser data was cleared',
        message:days||files?`Your open work was kept. Added ${count(days,'past Saved Day')} and ${count(files,'attachment')} from ${source}.`:`Your open work was kept. Nothing was missing compared with ${source}.`});
      return true;
    }
    async function recoverAfterConnect(id:string){
      const active=hold;if(!active||!input.authority.canMutate())return false;
      (active.tried??=new Set()).add(id);const empty=await canonicalEmpty()===true;if(hold!==active)return false;
      let recovered=false;
      if(!empty)recovered=await restoreMissing(active,id);
      else if(id==='device-folder')recovered=await offerDeviceRecovery({reason:'connect',latestBefore:Date.parse(active.clearedAt)});
      else{
        let synced:StorageResetRecoveryResult|null=null;
        try{synced=await input.provider.syncRepositoryProvider(id);}catch(error){input.diagnostics.capture('storage-reset.sync-recovery',error,'warn');}
        recovered=!!synced&&synced.cancelled===false&&synced.verified===true;
        if(recovered){
          if(hold===active)settle();
          const label=input.provider.list().find(item=>item.id===id)?.label||'Google Drive';
          input.presentation.emit({source:'storage-reset',id:'restored',severity:'success',lifecycle:'succeeded',foreground:false,tier:'news',surface:'toast',title:'Browser data was cleared',message:`Your library was brought back from ${label}.`});
        }
      }
      if(!recovered&&hold===active)showDecision();return recovered;
    }
    function connectionsChanged(){
      const active=hold;if(!active||handling)return false;
      const tried=active.tried??=new Set(),drive=input.provider.locationStatus('google-drive');
      if(!drive?.connected){tried.delete('google-drive');return false;}
      if(tried.has('google-drive')||drive.engineBusy)return false;
      void recoverAfterConnect('google-drive').catch(error=>input.diagnostics.capture('storage-reset.connect-recovery',error,'warn'));return true;
    }
    async function handle(event:Readonly<{detectedAt?:unknown;peer?:boolean}>={}){
      if(handling)return handling;
      handling=(async()=>{
        if(!input.authority.canMutate()){
          acknowledged=input.storage.indexedDbLifecycle().resets;void input.writeback.notesRecover();
          if(!event.peer)input.ownership.announceStorageReset(event.detectedAt);return;
        }
        const active=beginHold(event.detectedAt),unsaved=await writeBack(active);
        try{input.view.refreshAfterWriteback();}catch(error){input.diagnostics.capture('storage-reset.render',error,'warn');}
        if(hold!==active)return;
        if(unsaved.length){showDecision({unsaved});return;}
        await active.deviceReady;
        if(hold===active&&!(await restoreMissing(active))&&hold===active)showDecision();
      })().finally(()=>{handling=null;});
      return handling;
    }
    function noteDatabaseRemovedWhileClosed(){
      if(input.storage.indexedDbLifecycle().startedFresh!==true||!input.authority.canMutate())return false;
      const health=input.storage.health();if(!health.lastStudyDataSaveAt||health.browserDataClearedAt)return false;
      input.diagnostics.capture('storage.idb-missing-at-start',new Error('The browser database was missing at start although study data had been saved here.'),'warn');
      input.storage.updateHealth({browserDataClearedAt:input.environment.nowIso()});return true;
    }
    function resume(){
      noteDatabaseRemovedWhileClosed();
      const stored=input.storage.storedHealth(),row=stored&&typeof stored==='object'?stored as Record<string,unknown>:Object.create(null) as Record<string,unknown>;
      const clearedAt=String(row['browserDataClearedAt']||input.storage.health().browserDataClearedAt||'');
      if(!clearedAt||hold||!input.authority.canMutate())return false;
      beginHold(clearedAt).reloaded=true;showDecision();connectionsChanged();return true;
    }
    function settle(){
      const active=hold;hold=null;acknowledged=input.storage.indexedDbLifecycle().resets;input.presentation.resolve('storage-reset','detected');
      if(input.storage.health().browserDataClearedAt)input.storage.updateHealth({browserDataClearedAt:null});
      input.background.wake('storage-reset-settled');
      if(!active)return false;
      try{active.provider?.release();}catch(error){input.diagnostics.capture('storage-reset.provider-resume',error,'warn');}
      void Promise.resolve(input.mutation.settled()).then(()=>input.device.rememberAfterStorageReset()).catch(error=>input.diagnostics.capture('storage-reset.remember-folder',error,'warn'));return true;
    }
    input.presentation.subscribe(state=>{
      if(!hold)return;
      if(state.events.some(event=>event.id==='backup-verified'&&event.lifecycle==='succeeded'&&Date.parse(String(event.completedAt||''))>=since))settle();
    });
    async function restore(){if(input.session.hasBlocking()){await input.session.suspend();if(input.session.hasBlocking())return false;}return await input.presentation.openRestore();}
    return freeze({format:'study-director.storage-reset-recovery' as const,contractVersion:1 as const,canonicalEmpty,offerDeviceRecovery,connectDevice,ensureDeviceInstalled,unresolved,handle,resume,settle,restore,connectionsChanged});
  }

  function createHost(input:RecoveryHostInput){
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

    if(!Object.isFrozen(input.presentation)||(['begin','read','feedback','condition','detail','outcome','resolve','reset','subscribe'] as const).some(key=>typeof input.presentation[key]!=='function'))throw new TypeError('Backup presentation port is invalid.');
    const {mark:markPending,clear:clearPending,read:pending}=createPendingStore(freeze({storage:input.storage,diagnostics:input.diagnostics,sourceRevision:input.sourceRevision}));
    async function settleRecoveryState(options:{phase?:'final';keepsActiveSession?:boolean}={}){
      if(input.lifecycle.attachmentBusy())throw new Error('An attachment is still being prepared or saved. Finish that operation before recovery.');
      const keepsActiveSession=options.phase==='final'&&options.keepsActiveSession===true;
      await input.lifecycle.settleAttachmentWriters({allowDuringRecoveryQuiescence:true,checkpointReview:!keepsActiveSession});
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
      const hasTasks=!keepsActiveSession&&input.lifecycle.hasTasks();
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

    const coordinator=input.managedRecovery.createCoordinator(freeze<ManagedRecoveryInput<Suspension>>({
      // A restore pauses automatic backups at every location, so none of them
      // captures half-applied data.
      automaticBackup:freeze({
        suspend:async reason=>{
          const held=input.providers.suspendBackground(reason,{preserveManagedSync:reason==='sync'});
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
    let presentationScope:PresentationScope|null=null,presentationLifecycle:PresentationLifecycle='succeeded';
    // noteTarget is set while Version History restores a single note.
    let busy=false,activeSourceId='',activeSourceLabel='';
    let lastEntries:readonly HistoryEntry[]=freeze([]),activeController:AbortController|null=null,noteTarget:NoteTarget|null=null;
    function currentPresentation(){return activeSourceId?presentation.read(activeSourceId):null;}
    function progressValue(){const event=currentPresentation();return event?.progress?freeze({...event.progress,message:event.message,ok:event.severity!=='error'}):null;}
    // Without a location (none connected) the dialog keeps its own line.
    let detachedStatus:Readonly<{message:string;ok:boolean}>=freeze({message:'',ok:true});
    function statusValue(){if(!activeSourceId)return detachedStatus;const event=presentation.read(activeSourceId,'backup-status')||currentPresentation();return freeze({message:event?.message||'',ok:event?.severity!=='error'});}
    function subscribePresentation(listener:(event:HistoryNotice)=>void){return presentation.subscribe(state=>{for(const event of state.events)if(event.source===activeSourceId&&event.id==='backup-operation')listener(freeze({...event,sourceId:event.source,sourceLabel:event.title,active:event.lifecycle==='running',ok:event.severity!=='error',progress:event.progress?{...event.progress,message:event.message}:null}));});}
    const elements=()=>freeze({
      dialog:input.document.getElementById('managed-version-history') as HTMLDialogElement|null,
      kicker:input.document.getElementById('managed-version-history-kicker'),
      title:input.document.getElementById('managed-version-history-title'),
      copy:input.document.getElementById('managed-version-history-copy'),
      progress:input.document.getElementById('managed-version-history-progress'),
      progressStage:input.document.getElementById('managed-version-history-progress-stage'),
      progressDetail:input.document.getElementById('managed-version-history-progress-detail'),
      list:input.document.getElementById('managed-version-history-list'),
      status:input.document.getElementById('managed-version-history-status'),
      cancel:input.document.getElementById('cancel-backup-import') as HTMLButtonElement|null
    });
    const safetyLabel=(value:unknown)=>value==='before-clear-library'?'Before Clear Library':value==='before-combine'?'Before Combine':'Before Restore';
    const tierLabel=(value:unknown,purpose:string | undefined='')=>value==='before-restore'?safetyLabel(purpose):value==='latest'?'Latest':value==='hourly'?'Hourly':value==='daily'?'Daily':value==='weekly'?'Weekly':value==='monthly'?'Monthly':'Saved';
    // "12 Saved Days · 1 note".
    const countLabel=(counts:HistoryEntry['counts'])=>{const days=Number(counts?.dailyRecord)||0,notes=Number(counts?.note)||0;return `${days} Saved Day${days===1?'':'s'} · ${notes} note${notes===1?'':'s'}`;};
    const dateLabel=(value:string)=>{const date=new Date(value);return Number.isFinite(date.getTime())?date.toLocaleString():String(value||'');};
    function sourceDescriptor(sourceId:string){
      const id=String(sourceId||'').trim(),provider=input.providers.list().find(item=>item.id===id);return provider?freeze({id:provider.id,label:provider.label,shared:provider.shared===true}):null;
    }
    function setHistoryStatus(message:string='',ok:boolean=true,lifecycle:PresentationLifecycle|''=''){
      presentationLifecycle=lifecycle||(ok?'succeeded':'failed');
      if(presentationScope?.read()?.lifecycle==='running'){presentation.feedback(activeSourceId,'');presentationScope.update({message:String(message||''),severity:ok?'info':'error'});}
      else if(activeSourceId)presentation.feedback(activeSourceId,String(message||''),ok);
      else detachedStatus=freeze({message:String(message||''),ok});
      renderHistoryPresentation();
    }
    function clearHistoryProgress(){presentationScope?.update({progress:null});renderHistoryPresentation();}
    function setHistoryProgress(value:Progress|null){
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
    function renderBusy(){const {cancel,dialog}=elements();if(dialog)dialog.dataset['busy']=busy?'true':'false';if(cancel){cancel.hidden=!busy||!activeController;cancel.disabled=!busy;cancel.textContent='Cancel';}}
    function setOperationBusy(next:boolean,controller:AbortController|null=null,kind:string='history'){
      if(next&&!busy){presentationLifecycle='succeeded';presentationScope=presentation.begin(activeSourceId,kind,{label:activeSourceLabel});}
      if(!next&&busy){presentationScope?.finish({lifecycle:presentationLifecycle});presentationScope=null;}
      busy=!!next;activeController=busy?controller:null;renderBusy();renderHistoryPresentation();return busy;
    }
    function cancelActive(){
      if(!busy)return false;
      const reason=Object.assign(new Error('Recovery operation was cancelled by the user.'),{name:'AbortError',code:'STUDY_DIRECTOR_IMPORT_CANCELLED'});
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
    const DAY_MS=86400000,dayKey=(date:Date)=>`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    function plainTimeLabel(value:string,withTime:boolean){
      const date=new Date(value),now=new Date();if(!Number.isFinite(date.getTime()))return '';
      const time=date.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'}),startOf=(d:Date)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime(),days=Math.round((startOf(now)-startOf(date))/DAY_MS);
      const label=days<=0?'Today':days===1?'Yesterday':days<7?`${days} days ago`:days<35?`${Math.round(days/7)} week${Math.round(days/7)===1?'':'s'} ago`:`${Math.max(1,Math.round(days/30))} month${Math.max(1,Math.round(days/30))===1?'':'s'} ago`;
      return days<=0||withTime?`${label}, ${time}`:label;
    }
    // The device that made a version: "from iPad · Safari" or "from this device".
    function fromDevice(entry:HistoryEntry|null,entries:readonly HistoryEntry[]){const name=input.view.deviceName(entry?.origin,entries.map(other=>other&&other.origin));return name==='This device'?'from this device':name?`from ${name}`:'';}
    function renderNoteVersions(entries:readonly HistoryEntry[]){
      const {list}=elements();if(!list)return;
      if(!entries.length){const empty=input.document.createElement('div');empty.className='managed-version-history-empty ui-helper';empty.textContent=busy?'':'No earlier versions of this note are in your backups yet.';list.appendChild(empty);return;}
      const perDay=new Map<string,number>();for(const entry of entries){const key=dayKey(new Date(entry.exportedAt));perDay.set(key,(perDay.get(key)||0)+1);}
      for(const entry of entries){
        const location=entry.location,card=input.document.createElement('section');card.className='managed-version-card';
        const head=input.document.createElement('div');head.className='managed-version-card-head';
        const when=input.document.createElement('strong');when.className='managed-version-date';when.textContent=plainTimeLabel(entry.exportedAt,(perDay.get(dayKey(new Date(entry.exportedAt)))||0)>1);
        const exact=input.document.createElement('span');exact.className='managed-version-counts ui-helper';exact.textContent=[dateLabel(entry.exportedAt),fromDevice(entry,entries)].filter(Boolean).join(' · ');
        const use=input.document.createElement('button');use.type='button';use.className='mini-btn ui-btn';use.dataset['action']='compare-managed-note';use.dataset['versionHistorySource']=location.sourceId;use.dataset['versionHistoryCheckpoint']=location.checkpointId;use.textContent='Review';
        head.append(when,exact,use);card.appendChild(head);list.appendChild(card);
      }
    }
    function render(entries:readonly HistoryEntry[]=lastEntries){
      const {list}=elements();if(!list)return;list.replaceChildren();
      if(noteTarget){renderNoteVersions(entries);return;}
      if(!entries.length){const empty=input.document.createElement('div');empty.className='managed-version-history-empty ui-helper';empty.textContent=busy?'':'No versions yet.';list.appendChild(empty);return;}
      // Where a version is kept, said only when one location of several holds it.
      const several=connectedSources().length>1;
      for(const entry of entries){
        const location=entry&&entry.location;if(!location)continue;
        if(location.tier==='unreadable'){list.appendChild(unreadableCard(entry,location,several));continue;}
        const card=input.document.createElement('section');card.className='managed-version-card';card.dataset['logicalVersion']=String(entry.logicalId);
        const head=input.document.createElement('div');head.className='managed-version-card-head';
        const when=input.document.createElement('strong');when.className='managed-version-date';when.textContent=dateLabel(entry.exportedAt||location.exportedAt);
        const counts=input.document.createElement('span');counts.className='managed-version-counts ui-helper';counts.textContent=entry.locked?'Locked: enter the backup password to see this version':[countLabel(entry.counts),fromDevice(entry,entries)].filter(Boolean).join(' · ');
        head.append(when,counts);card.appendChild(head);
        const row=input.document.createElement('div');row.className='managed-version-location';
        const copy=input.document.createElement('div');copy.className='managed-version-location-copy';
        const status=input.document.createElement('span');status.className='ui-helper';status.textContent=`${tierLabel(location.tier,location.safetyPurpose)}${location.encrypted?' · Encrypted':''}${location.health==='degraded'?' · Degraded capture':''}${several&&Array.isArray(entry.held)&&entry.held.length===1?` · Only in ${entry.held[0]}`:''}`;copy.appendChild(status);
        if(location.warning){const warning=input.document.createElement('span');warning.className='ui-status warn';warning.textContent=String(location.warning);copy.appendChild(warning);}
        const actions=input.document.createElement('div');actions.className='managed-version-location-actions';
        const use=input.document.createElement('button');use.type='button';use.className='mini-btn ui-btn';use.dataset['action']='recover-managed-version';use.dataset['versionHistorySource']=location.sourceId;use.dataset['versionHistoryCheckpoint']=location.checkpointId;use.textContent='Restore…';actions.appendChild(use);
        if(location.tier==='before-restore')actions.appendChild(removeButton(location,'Remove safety version'));
        row.append(copy,actions);card.appendChild(row);list.appendChild(card);
      }
    }
    function removeButton(location:HistoryLocation,label:string){const remove=input.document.createElement('button');remove.type='button';remove.className='mini-btn ui-btn';remove.dataset['action']='remove-managed-version';remove.dataset['versionHistorySource']=location.sourceId;remove.dataset['versionHistoryCheckpoint']=location.safetyCheckpointId||location.checkpointId;remove.textContent=label;return remove;}
    // A version this app cannot read: it may come from a newer Study Director
    // on another device, or its file is damaged. It is shown muted, with its
    // Restore disabled; the one thing that works on it is Remove, and nothing
    // removes it unless the person chooses that.
    function unreadableCard(entry:HistoryEntry,location:HistoryLocation,several:boolean){
      const card=input.document.createElement('section');card.className='managed-version-card unreadable';card.dataset['logicalVersion']=String(entry.logicalId);card.setAttribute('aria-disabled','true');
      const head=input.document.createElement('div');head.className='managed-version-card-head';
      const when=input.document.createElement('strong');when.className='managed-version-date';when.textContent=dateLabel(entry.exportedAt||location.exportedAt);
      const note=input.document.createElement('span');note.className='managed-version-counts ui-helper';note.textContent='Can’t be read by this app';
      head.append(when,note);card.appendChild(head);
      const row=input.document.createElement('div');row.className='managed-version-location';
      const copy=input.document.createElement('div');copy.className='managed-version-location-copy';
      const status=input.document.createElement('span');status.className='ui-helper';status.textContent=`From a newer Study Director, or the file is damaged. Update the app to restore it.${several?` In ${location.sourceLabel}.`:''}`;copy.appendChild(status);
      const actions=input.document.createElement('div');actions.className='managed-version-location-actions';
      const restore=input.document.createElement('button');restore.type='button';restore.className='mini-btn ui-btn';restore.textContent='Restore…';restore.disabled=true;restore.title='This app can’t read this version';
      const remove=removeButton(location,'Remove…');remove.classList.add('danger');
      actions.append(restore,remove);
      row.append(copy,actions);card.appendChild(row);return card;
    }
    // One list for every location. A version two locations hold (the same id,
    // or the same data under another id) shows once and is read from the first
    // location that holds it (copies lists the others, tried if that read
    // fails); each location's safety version, and each version it cannot
    // read, shows on its own.
    // The newest version is Latest, whichever location made it.
    function mergeHistories(results:readonly HistoryBatch[]){
      const rows:MergedHistory[]=[],byId=new Map<string,MergedHistory>(),byData=new Map<string,MergedHistory>(),time=(entry:HistoryEntry)=>Date.parse(entry.exportedAt||entry.location.exportedAt||'')||0;
      for(const {source,entries} of results)for(const entry of entries){
        const location=entry&&entry.location;if(!location)continue;
        if(location.tier==='unreadable'){rows.push({entry,held:[source.label],tiers:[location.tier],copies:[]});continue;}
        if(location.tier!=='before-restore'){
          const match=byId.get(location.checkpointId)||(entry.logicalId?byData.get(entry.logicalId):null);
          // A copy waiting for the password gives way to one that can be read.
          if(match&&!match.held.includes(source.label)){match.held.push(source.label);match.tiers.push(location.tier);if(match.entry.locked&&!entry.locked){match.copies.push(match.entry.location);match.entry=entry;}else match.copies.push(location);continue;}
        }
        const row:MergedHistory={entry,held:[source.label],tiers:[location.tier],copies:[]};rows.push(row);
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
      const controller=new AbortController();activeSourceId=sources[0]!.id;activeSourceLabel=sources[0]!.label;setOperationBusy(true,controller);setDialogMode();clearHistoryProgress();
      try{
        const results:HistoryBatch[]=[],unread:string[]=[];
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
    function connectedSources(){return input.providers.list().filter(item=>item.connected===true).sort((a,b)=>Number(a.shared===true)-Number(b.shared===true)).map(item=>sourceDescriptor(item.id)).filter(item=>item!==null);}
    // Earlier versions of one note come from every connected backup location
    // together: one entry per distinct text, newest first, never the text the
    // note has now. A version the Device Folder already read is not read again
    // from Drive.
    async function collectNoteVersions({interactive=true}={}){
      const sources=connectedSources(),note=noteTarget;if(!note||!sources.length||busy)return freeze({entries:lastEntries});
      const controller=new AbortController();activeSourceId=sources[0]!.id;activeSourceLabel=sources[0]!.label;setOperationBusy(true,controller);lastEntries=freeze([]);render();setHistoryStatus('Looking for earlier versions in your backups…');
      try{
        const found:NoteVersion[]=[],failed:string[]=[];let skip:CoveredNotes|null=null;
        for(const source of sources){
          const result=await input.providers.noteVersions(source.id,note.id,freeze({interactive,signal:controller.signal,presentation:presentationScope,...(skip?{skip}:{})}));
          if(result&&result.cancelled){setHistoryStatus('Cancelled.',true,'cancelled');return freeze({entries:lastEntries});}
          if(result&&result.available){found.push(...result.entries);if(result.covered)skip=freeze({checkpointIds:freeze([...((skip as CoveredNotes|null)?.checkpointIds||[]),...(result.covered.checkpointIds||[])]),contents:freeze([...((skip as CoveredNotes|null)?.contents||[]),...(result.covered.contents||[])])});}
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
    async function openNote(target:Partial<NoteTarget>={}){
      const id=String(target.id||''),label=String(target.label||'').slice(0,160);if(!id)return freeze({opened:false,reason:'invalid'});
      if(busy)return freeze({opened:false,reason:'busy'});
      const sources=connectedSources();if(!sources.length)return freeze({opened:false,reason:'no-source'});
      const {dialog}=elements();if(!dialog)return freeze({opened:false,reason:'unavailable'});
      noteTarget=freeze({id,label,text:String(target.text??''),onRestored:typeof target.onRestored==='function'?target.onRestored:()=>{}});
      activeSourceId=sources[0]!.id;activeSourceLabel=sources[0]!.label;setDialogMode();lastEntries=freeze([]);render();clearHistoryProgress();
      if(!dialog.open)dialog.showModal();void collectNoteVersions({interactive:true});
      return freeze({opened:true});
    }
    function close(){const {dialog}=elements();if(dialog?.open)dialog.close();return true;}
    function eventButton(event:Event,selector:string){const target=event&&event.target as (EventTarget&{closest?<E extends Element>(selector:string):E|null})|null;return target&&typeof target.closest==='function'?target.closest<HTMLButtonElement>(selector):null;}
    function selectedEntry(sourceId:string,checkpointId:string){return lastEntries.find(entry=>entry?.location?.sourceId===sourceId&&entry.location.checkpointId===checkpointId)||null;}
    async function recover(event:Event){
      if(busy)return false;const button=eventButton(event,'[data-action="recover-managed-version"][data-version-history-source][data-version-history-checkpoint],[data-action="compare-managed-note"][data-version-history-source][data-version-history-checkpoint]');if(!button||(button.dataset['action']==='compare-managed-note')!==!!noteTarget)return false;
      const sourceId=String(button.dataset['versionHistorySource']||''),checkpointId=String(button.dataset['versionHistoryCheckpoint']||''),entry=selectedEntry(sourceId,checkpointId),location=entry&&entry.location,source=sourceDescriptor(sourceId);if(!location||!source)return false;
      // The version is read from the location the list chose for it.
      activeSourceId=source.id;activeSourceLabel=source.label;
      const note=noteTarget,from=fromDevice(entry,lastEntries),reach=typeof presentation.reach==='function'?presentation.reach():'';
      const missingAttachments=Math.max(0,...[location,...(Array.isArray(entry.copies)?entry.copies as readonly {attachmentsMissing?:number}[]:[])].map(at=>Number(at?.attachmentsMissing)||0));
      const partialWarning=/Partial attachment recovery:/u.test(String(location.warning||''))?String(location.warning):missingAttachments?`Partial attachment recovery: ${missingAttachments} attachment${missingAttachments===1?'':'s'} missing. Saved Days and Notes are preserved, but missing files cannot be restored from this backup.`:'';
      const partialAttachments=!!partialWarning;
      const choice=note?'combine':await input.interactions.choose({
        title:'Use this version',
        message:`Saved ${dateLabel(location.exportedAt)}${from?`, ${from}`:''}.`,
        details:['A safety version is kept first, so you can go back.','Settings that belong to this device stay as they are.',...(partialAttachments?[partialWarning]:[]),...(reach?[reach]:[])],
        cancelLabel:'Keep current',
        choices:[presentation.restoreChoices.missing,presentation.restoreChoices.combine,...(partialAttachments?[]:[presentation.restoreChoices.replace])]
      });
      if(!choice)return false;const controller=new AbortController();setOperationBusy(true,controller,choice==='replace'?'restore-version':'bring-in');setHistoryStatus('');setHistoryProgress({message:choice==='replace'?'Preparing restore…':'Preparing comparison…'});
      try{
        // A read that fails before anything changed (repositoryReadFailed) is
        // tried again from the next location that holds the version.
        const sources=[location,...(Array.isArray(entry.copies)?entry.copies as readonly HistoryLocation[]:[])].filter(at=>sourceDescriptor(at.sourceId));let result;
        for(let index=0;;index+=1){
          const at=sources[index]!;activeSourceId=at.sourceId;activeSourceLabel=at.sourceLabel;
          const options:RecoveryOptions=freeze({presentation:presentationScope,checkpointId:at.checkpointId,confirmed:choice==='replace',note:note?note.id:'',missingOnly:choice==='missing',signal:controller.signal,onProgress:value=>{if(activeController===controller&&!controller.signal.aborted)setHistoryProgress(value);}});
          try{result=choice==='replace'?await input.providers.restoreRepositoryProviderVersion(at.sourceId,options):await input.providers.bringInRepositoryProvider(at.sourceId,options);break;}
          catch(error){const next=sources[index+1];if(!next||(error as {repositoryReadFailed?:unknown}|null|undefined)?.repositoryReadFailed!==true||controller.signal.aborted)throw error;input.diagnostics.capture('backup.version-history-other-copy',error,'warn');setHistoryProgress({message:`${at.sourceLabel} could not be read. Reading ${next.sourceLabel} instead…`});}
        }
        clearHistoryProgress();
        const saved=dateLabel(location.exportedAt),noteOutcome=note?({'note-missing':`This note isn’t in the backup from ${saved}.`,'note-unchanged':`The backup from ${saved} has the same text as this note.`,'note-kept':'No changes were made.'} as Record<string,string>)[String(result?.reason||'')]:'';
        if(noteOutcome){setHistoryStatus(noteOutcome,true,'cancelled');return false;}
        if(choice==='missing'&&String(result?.reason||'')==='needs-decision'){setHistoryStatus(presentation.restoreChoices.needsDecision,true,'cancelled');return false;}
        if(result&&result.cancelled||result&&result.reason==='cancelled'){setHistoryStatus('Recovery cancelled safely.',true,'cancelled');return false;}
        if(result&&result.ok===false){const message=userMessage(result.error,'The selected backup could not be applied safely.');setHistoryStatus(message,false);return false;}
        setHistoryStatus(presentation.outcome(choice==='replace'?'restore-version':'bring-in',activeSourceLabel,result?.convergence,result?.summary));lastEntries=freeze([]);setOperationBusy(false);close();
        if(note)try{note.onRestored(freeze({exportedAt:location.exportedAt,sourceLabel:activeSourceLabel}));}catch(error){input.diagnostics.capture('backup.note-restored',error,'warn');}
        return true;
      }catch(error){clearHistoryProgress();const cancelled=(error as {name?:unknown}|null|undefined)?.name==='AbortError'||String((error as {code?:unknown}|null|undefined)?.code||'')==='STUDY_DIRECTOR_IMPORT_CANCELLED',message=cancelled?'Recovery cancelled safely.':userMessage(error,'The selected backup could not be applied safely.');setHistoryStatus(message,cancelled,cancelled?'cancelled':'failed');if(!cancelled)input.diagnostics.capture('backup.provider-scoped-recovery',error,'warn');return false;}
      finally{if(activeController===controller)setOperationBusy(false);}
    }
    // Removes this device's safety version, or a version this app cannot read,
    // after the person confirms.
    async function removeVersion(event:Event){
      if(busy)return false;const button=eventButton(event,'[data-action="remove-managed-version"][data-version-history-source][data-version-history-checkpoint]');if(!button)return false;
      const sourceId=String(button.dataset['versionHistorySource']||''),checkpointId=String(button.dataset['versionHistoryCheckpoint']||''),entry=selectedEntry(sourceId,checkpointId),location=entry&&entry.location;
      if(!location||!['before-restore','unreadable'].includes(location.tier||''))return false;
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
      managedRecovery:<R extends object,P extends object>(spec:RecoverySpec<R,P>)=>coordinator.execute(spec),
      history:freeze({subscribePresentation,open,openNote,close,cancel:cancelActive,refresh:()=>noteTarget?collectNoteVersions({interactive:true}):collectAll({interactive:true}),recover,removeVersion,status:()=>freeze({busy,entries:lastEntries,sourceId:activeSourceId,sourceLabel:activeSourceLabel,progress:progressValue(),status:statusValue()})}),
      status:()=>freeze({managedRecovery:coordinator.status(),history:freeze({busy,entries:lastEntries,sourceId:activeSourceId,sourceLabel:activeSourceLabel,progress:progressValue(),status:statusValue()})})
    });
  }
  return freeze({format:'study-director.backup-recovery-host-module',contractVersion:1,createRuntime,createHost,createPendingStore,createKeptVersions,createRetainedBackupFiles,createStorageReset});
};
registry.define('backup-recovery-host',1,createModule);return createModule;
})();
export type BackupRecoveryHostModule=ReturnType<typeof sdBackupRecoveryHostFactory>;
