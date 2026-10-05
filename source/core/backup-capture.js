(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,functionPort:functions}=registry.contracts;
registry.define('backup-capture',1,()=>{
  const freeze=Object.freeze;
  function create(input){
    exactObject(input,['configuration','data','codecs','session','personal','assets','exports','persistence','diagnostics','domain','environment'],'Backup capture input');
    const configuration=exactObject(input.configuration,['backupVersion','limits','portableAssets'],'Backup capture configuration');
    const data=exactObject(input.data,['activeSession','dailyRecords','notes','deletionRecovery','mutationEpoch','preparationUnits','provenance'],'Backup capture data port');
    const activeSessionData=functions(data.activeSession,['save','settled','load'],'Backup capture active-session data port');
    const dailyRecordData=functions(data.dailyRecords,['backupDates','backupMonth'],'Backup capture Saved-Day data port');
    const noteData=functions(data.notes,['flush','failure','readFreshPayload','exportPayload','readFreshItems'],'Backup capture Ongoing Note data port');
    const deletionData=functions(data.deletionRecovery,['flush','savedDays','areaNotes','attachments'],'Backup capture deletion data port');
    const mutationEpochData=functions(data.mutationEpoch,['read'],'Backup capture mutation-epoch data port');
    const preparationData=functions(data.preparationUnits,['list','replace'],'Backup capture preparation-unit data port');
    const provenanceData=functions(data.provenance,['installationId'],'Backup capture provenance data port');
    const AppData=freeze({activeSession:activeSessionData,dailyRecords:dailyRecordData,notes:noteData,deletionRecovery:deletionData,mutationEpoch:mutationEpochData,preparationUnits:preparationData,provenance:provenanceData});
    const codecs=exactObject(input.codecs,['activeSession','backup'],'Backup capture codecs');
    if(!Object.isFrozen(codecs.activeSession)||!Object.isFrozen(codecs.backup))throw new TypeError('Backup capture codecs must be frozen.');
    const session=functions(input.session,['canMutate','cancelLiveDraftSave','captureSnapshot','hasTasks','toActiveSession'],'Backup capture session port');
    const personal=functions(input.personal,['settle','export'],'Backup capture personal-data port');
    const exports=functions(input.exports,['check','run'],'Backup capture export port');
    const persistence=functions(input.persistence,['sourceRevision','snapshotRevision','dailyRecordDocuments','storageGeneration'],'Backup capture persistence port');
    const diagnostics=functions(input.diagnostics,['capture','mark'],'Backup capture diagnostics port');
    const domain=functions(input.domain,['getStudentName','currentDailyRecords'],'Backup capture domain port');
    const environment=functions(input.environment,['yieldTask'],'Backup capture environment port');
    const portableAssets=configuration.portableAssets===true;
    if(portableAssets)functions(input.assets,['get','list'],'Backup capture asset port');
    const AssetData=portableAssets?input.assets:null;
    const APP_LIMITS=configuration.limits,backupVersion=configuration.backupVersion;
    const ActiveSessionCodec=codecs.activeSession,BackupCodec=codecs.backup;
    const appCanMutate=session.canMutate,cancelLiveDraftSave=session.cancelLiveDraftSave,captureSessionSnapshot=session.captureSnapshot,activeSessionPayload=session.toActiveSession;
    const TASKS=freeze({get length(){return session.hasTasks()?1:0;}});
    const personalSettle=personal.settle,personalExport=personal.export,Exports=exports;
    const ports=freeze({persistence:freeze({sourceRevision:persistence.sourceRevision,snapshotRevision:persistence.snapshotRevision,storageGeneration:persistence.storageGeneration})});
    const getDailyRecordDocumentsByDates=persistence.dailyRecordDocuments;
    const AppDiagnostics=freeze({capture:diagnostics.capture}),OperationDiagnostics=freeze({mark:diagnostics.mark});
    const getStudentNameFromDisplay=domain.getStudentName,currentDailyRecords=domain.currentDailyRecords,yieldTask=environment.yieldTask;
function backupPreparationError(code,stage,message,cause=null){
  const source=cause instanceof Error?cause:null,error=new Error(String(source&&source.message||message||'Backup preparation failed.'));
  error.name=String(source&&source.name||'Error');
  error.code=String(source&&source.code&&source.code!=='Error'?source.code:(code||'BACKUP_PREPARATION_FAILED'));
  error.backupStage=String(source&&source.backupStage||stage||'checkpoint-preparation');
  if(source)error.cause=source;
  return error;
}
async function backupPreparationStep(code,stage,operation){
  OperationDiagnostics.mark(`${stage}-start`);
  try{const result=await operation();OperationDiagnostics.mark(`${stage}-complete`);return result;}
  catch(error){throw backupPreparationError(code,stage,'Backup preparation failed.',error);}
}
async function flushCurrentSessionForBackup(){
  let session=null,warning='',canonical=true;
  if(appCanMutate()){
    cancelLiveDraftSave();
    if(TASKS.length){
      const snapshot=captureSessionSnapshot();
      const candidate=snapshot?activeSessionPayload(snapshot):null;
      if(candidate){
        // This save is part of the checkpoint being captured. It must update
        // canonical storage without scheduling that same checkpoint again.
        const result=await AppData.activeSession.save(candidate,{backupCapture:true});
        await AppData.activeSession.settled().catch(error=>AppDiagnostics.capture('backup.session-flush',error,'error'));
        session=result&&result.value?result.value:candidate;
        canonical=!!(result&&result.storage&&result.storage.idb);
        if(!result||!result.ok||!canonical)warning='The current session was included from memory because one or both browser recovery stores could not be refreshed.';
      }
    }
  }
  if(!session){
    await AppData.activeSession.settled().catch(error=>AppDiagnostics.capture('backup.session-wait',error,'error'));
    const loaded=await AppData.activeSession.load();
    session=loaded&&loaded.value||null;
    canonical=!!(loaded&&loaded.ok===true&&loaded.error===null&&(!session||loaded.storage&&loaded.storage.idb));
    if(loaded&&!loaded.ok&&loaded.error)warning='The stored active session could not be read; the backup contains the remaining available data.';
  }
  return {session,warning,canonical};
}
async function readSessionForCapture(settled=null){
  if(settled&&settled.canonical===false&&appCanMutate()&&TASKS.length){
    const snapshot=captureSessionSnapshot();
    return {...settled,session:snapshot?activeSessionPayload(snapshot):null};
  }
  const loaded=await AppData.activeSession.load();
  if(loaded&&loaded.ok===false&&!loaded.value)throw new Error('The stored active session could not be read safely for the checkpoint.');
  const session=loaded&&loaded.value||null;
  return {session,warning:settled&&settled.warning||'',canonical:!!(loaded&&loaded.ok===true&&loaded.error===null&&(!session||loaded.storage&&loaded.storage.idb))};
}
async function settleDeletionRecovery(){
  if(await AppData.deletionRecovery.flush()!==true)throw new Error('Pending deletion recovery could not be settled completely.');
}
async function getBackupDailyRecordDates(){return AppData.dailyRecords.backupDates();}
const LOGICAL_CHECKPOINT_CAPTURE_FORMAT='study-director.logical-checkpoint-capture',LOGICAL_CHECKPOINT_CAPTURE_VERSION=1;
const logicalCheckpointGuards=new WeakMap();
function requireLogicalCheckpointCapture(capture){
  if(!capture||!Object.isFrozen(capture)||capture.format!==LOGICAL_CHECKPOINT_CAPTURE_FORMAT||Number(capture.version)!==LOGICAL_CHECKPOINT_CAPTURE_VERSION)throw new TypeError('Logical checkpoint capture is invalid.');
  if(Number(backupVersion)>=14&&(!capture.checkpoint||capture.checkpoint.createdAt!==capture.exportedAt))throw new Error('Logical checkpoint provenance is invalid.');
  if(Number(backupVersion)>=15&&(!capture.protectedCheckpointManifest||capture.protectedCheckpointManifest.checkpointId!==capture.checkpoint.checkpointId))throw new Error('Logical checkpoint protected manifest is invalid.');
  return capture;
}
async function verifyAnomalousPhysicalAssetAliases(catalogue,assetIds,{checkpoint=null}={}){
  if(!portableAssets)return true;
  const selected=new Set((assetIds||[]).map(String).filter(Boolean)),groups=new Map();
  for(const row of Array.isArray(catalogue)?catalogue:[]){
    const assetId=String(row&&row.id||'');if(!selected.has(assetId))continue;
    const checksum=String(row&&row.hash||'').toLowerCase(),size=Number(row&&row.size);if(!/^[a-f0-9]{64}$/u.test(checksum)||!Number.isSafeInteger(size)||size<0)continue;
    const contentKey=checksum+'\u0000'+size,physicalKey=String(row&&row.file||assetId),group=groups.get(contentKey)||new Map();if(!group.has(physicalKey))group.set(physicalKey,row);groups.set(contentKey,group);
  }
  for(const group of groups.values()){
    if(group.size<2)continue;
    for(const row of group.values()){
      if(typeof checkpoint==='function')await checkpoint();
      const blob=await AssetData.get(String(row.id));
      if(!(blob instanceof Blob)||blob.size!==Number(row.size)||blob.type!==String(row.type||''))throw new Error('An attachment physical alias could not be verified while preparing the backup. Retry after repairing attachment storage.');
      const checksum=await Exports.run('checksum',{value:blob});if(checksum!==String(row.hash||'').toLowerCase())throw new Error('An attachment physical alias failed integrity verification. Retry after repairing attachment storage.');
    }
  }
  return true;
}
// The browser can clear this site's storage under an open page. The database
// layer counts each clear as it reopens storage; a capture that saw the count
// change read a mix of old and emptied storage, so nothing from it is saved.
function storageGeneration(){return Number(ports.persistence.storageGeneration())||0;}
function assertStorageGeneration(expected){
  if(storageGeneration()!==expected)throw backupPreparationError('BACKUP_STORAGE_CLEARED','checkpoint-source-fence','Browser data was cleared while this backup was being prepared. Nothing was saved.');
  return true;
}
async function captureLogicalCheckpoint(exportedAt=new Date().toISOString(),options={}){
  const generation=storageGeneration();
  const includeAssetBlobs=options&&options.includeAssetBlobs!==false;
  let yieldedAt=Date.now();
  async function checkpoint(){Exports.check();if(Date.now()-yieldedAt>=8){await yieldTask();yieldedAt=Date.now();Exports.check();}}
  const ownsControl=appCanMutate(),assumeFlushed=options&&options.assumeFlushed===true;
  // Settle writes before the fence; never retain a payload read during this phase.
  if(ownsControl&&!assumeFlushed){
    try{await AppData.notes.flush({backupCapture:true});}catch(error){AppDiagnostics.capture('backup.notes-flush',error,'warn');}
  }
  let settledSession=null;
  if(assumeFlushed)await AppData.activeSession.settled();
  else settledSession=await flushCurrentSessionForBackup();
  let recoveryWarning='';
  try{
    if(ownsControl)await settleDeletionRecovery();
  }catch(error){
    AppDiagnostics.capture('backup.deletion-recovery-flush',error,'warn');
    recoveryWarning='Pending deletion recovery could not be reconciled; canonical data that is safely readable is still included.';
  }
  if(!assumeFlushed)await backupPreparationStep('BACKUP_PLAN_SETTLE_FAILED','checkpoint-plan-settle',()=>personalSettle({backupCapture:true}));
  const noteFailure=AppData.notes.failure();
  const forceLegacySnapshotFence=!!(options.legacyRescueFence||noteFailure&&noteFailure.failed||recoveryWarning||settledSession&&settledSession.canonical===false);
  const snapshotRevision=await ports.persistence.snapshotRevision(Object.freeze({legacy:forceLegacySnapshotFence}));
  // Reuse the capture fence: a read-only export cannot settle pending deletions.
  if(!ownsControl&&!fastCaptureEpochToken(snapshotRevision))recoveryWarning='Pending deletion recovery could not be confirmed without write control; deletion coverage is uncertain.';
  const sourceRevision=String(await ports.persistence.sourceRevision()||exportedAt);
  if(!Number.isFinite(Date.parse(sourceRevision)))throw new Error('Backup source revision is invalid. Retry the backup.');
  const recordSource=await getBackupDailyRecordDates(),recordDates=recordSource.dates;
  // Only rescue export restarts with the broader fence. Normal canonical capture
  // enumerates dates once, inside its fence, and managed capture rejects rescue data.
  if(recordSource.canonical===false&&!forceLegacySnapshotFence&&options.requireCanonicalComplete!==true)return captureLogicalCheckpoint(exportedAt,{...options,legacyRescueFence:true});
  let areaNotePayload,noteRecoveryWarning='',noteCoverage='canonical';
  if(ownsControl&&!assumeFlushed){
    if(noteFailure&&noteFailure.failed){
      try{
        areaNotePayload=await AppData.notes.readFreshPayload();
        noteCoverage='recovered-complete';noteRecoveryWarning='Ongoing Notes were included from durable recovery state because their canonical save had not settled.';
      }catch(error){
        AppDiagnostics.capture('backup.notes-rescue',error,'warn');
        areaNotePayload=AppData.notes.exportPayload();
        noteCoverage='rescue-partial';noteRecoveryWarning='Ongoing Notes were included from this primary tab’s in-memory rescue state because IndexedDB could not be read. Keep this backup until browser storage recovers.';
      }
    }else areaNotePayload=AppData.notes.exportPayload();
  }else areaNotePayload=await AppData.notes.readFreshPayload();
  const sessionResult=await readSessionForCapture(settledSession);
  const personalData=await backupPreparationStep('BACKUP_PLAN_READ_FAILED','checkpoint-plan-read',()=>personalExport({flush:false,backupCapture:true}));
  const [savedDayDeletions,areaNoteDeletions,attachmentDeletions]=await Promise.all([AppData.deletionRecovery.savedDays(),AppData.deletionRecovery.areaNotes(),AppData.deletionRecovery.attachments()]);
  const completeness=freeze({
    complete:recordSource.canonical!==false&&noteCoverage!=='rescue-partial'&&sessionResult.canonical!==false&&!recoveryWarning,
    dailyRecords:recordSource.canonical===false?'rescue-partial':'canonical',
    areaNotes:noteCoverage,activeSession:sessionResult.canonical===false?'rescue-partial':'canonical',deletionState:recoveryWarning?'uncertain':'canonical'
  });
  if(options&&options.requireCanonicalComplete===true&&completeness.complete!==true){const incomplete=Object.entries(completeness).filter(([key,value])=>key!=='complete'&&value!=='canonical'&&value!=='recovered-complete').map(([key,value])=>`${key}:${value}`).join(', ')||'unknown';throw backupPreparationError('BACKUP_CANONICAL_CAPTURE_INCOMPLETE','checkpoint-canonical-completeness',`Managed backup publication stopped because canonical application data could not be captured completely (${incomplete}). No incomplete rescue checkpoint was published.`);}
  const areaNoteItems=Object.values(areaNotePayload).sort((a,b)=>String(a.key).localeCompare(String(b.key)));
  const activeSession=sessionResult.session&&typeof sessionResult.session==='object'
    ? ActiveSessionCodec.sanitizeCurrent(sessionResult.session)
    : null;
  const counts=BackupCodec.countShape({checkpointManifest:1,personalData:personalData?1:0,dailyRecord:recordDates.length,areaNote:areaNoteItems.length,activeSession:activeSession?1:0});
  const assetItems=[],dailyDocuments=[];
  if(portableAssets){
    const catalogue=await AssetData.list(),rows=new Map(catalogue.map(row=>[row.id,row])),contentBlobs=new Map();
    const ids=new Set(catalogue.filter(row=>row.library).map(row=>row.id));
    const collect=value=>{for(const id of BackupCodec.assetIds(value))ids.add(id);};
    for(const item of areaNoteItems){await checkpoint();collect(item);}if(activeSession)collect(activeSession);
    for(let offset=0;offset<recordDates.length;offset+=APP_LIMITS.backupChunkItems){
      await checkpoint();
      const dates=recordDates.slice(offset,offset+APP_LIMITS.backupChunkItems);
      let rawDocs;
      try{rawDocs=await getDailyRecordDocumentsByDates(dates,{requireCanonical:options&&options.requireCanonicalComplete===true});}
      catch(error){if(options&&options.requireCanonicalComplete===true)throw backupPreparationError('BACKUP_CANONICAL_CAPTURE_INCOMPLETE','checkpoint-canonical-completeness','Managed backup publication stopped because Saved Days could not be read completely from canonical IndexedDB storage. No incomplete rescue checkpoint was published.',error);throw error;}
      const docs=currentDailyRecords(rawDocs,'Backup Daily Records').sort((a,b)=>a.date.localeCompare(b.date));
      if(docs.length!==dates.length||docs.some((doc,index)=>doc.date!==dates[index]))throw new Error('A saved day changed while the backup was being prepared. Please export again.');
      dailyDocuments.push(...docs);docs.forEach(collect);
    }
    await verifyAnomalousPhysicalAssetAliases(catalogue,[...ids],{checkpoint});
    for(const assetId of [...ids].sort()){
      await checkpoint();
      const row=rows.get(assetId);
      if(!row){assetItems.push(freeze({descriptor:freeze({assetId,missing:true}),blob:null}));continue;}
      const descriptor=freeze({assetId,mimeType:row.type,size:row.size,checksum:row.hash,name:row.name,library:row.library});
      if(!includeAssetBlobs){assetItems.push(freeze({descriptor,blob:null}));continue;}
      const contentKey=String(row.file||assetId)+'\u0000'+String(row.hash||'')+'\u0000'+Number(row.size),cached=contentBlobs.get(contentKey);
      let blob=cached instanceof Blob?cached.slice(0,cached.size,row.type):await AssetData.get(assetId);
      if(!(blob instanceof Blob)){assetItems.push(freeze({descriptor:freeze({assetId,missing:true}),blob:null}));continue;}
      if(row.size!==blob.size||row.type!==blob.type)throw new Error('An attachment changed while the snapshot was being captured. Retry the backup.');
      if(!(cached instanceof Blob))contentBlobs.set(contentKey,blob);
      assetItems.push(freeze({descriptor,blob}));
    }
  }
  if(snapshotRevision!==await ports.persistence.snapshotRevision(Object.freeze({legacy:forceLegacySnapshotFence})))throw new Error('Stored data changed while capturing the backup. Retry the backup.');
  const finalSourceRevision=String(await ports.persistence.sourceRevision()||sourceRevision);
  if(finalSourceRevision!==sourceRevision)throw new Error('Stored data changed while capturing the backup. Retry the backup.');
  assertStorageGeneration(generation);
  const installationId=AppData.provenance.installationId();
  const checkpointMetadata=Number(backupVersion)>=14?BackupCodec.createCheckpointMetadata(installationId,exportedAt):null;
  const captureBase={
    format:LOGICAL_CHECKPOINT_CAPTURE_FORMAT,version:LOGICAL_CHECKPOINT_CAPTURE_VERSION,
    dailyDocuments:freeze([...dailyDocuments]),exportedAt,sourceRevision,studentName:getStudentNameFromDisplay(),installationId,checkpoint:checkpointMetadata,
    recordDates:freeze([...recordDates]),areaNoteItems:freeze([...areaNoteItems]),activeSession,personalData,
    savedDayDeletions:freeze([...(savedDayDeletions||[])]),areaNoteDeletions:freeze([...(areaNoteDeletions||[])]),attachmentDeletions:freeze([...(attachmentDeletions||[])]),counts,assetItems:freeze(assetItems),
    warning:[sessionResult.warning,recordSource.warning,recoveryWarning,noteRecoveryWarning].filter(Boolean).join(' '),completeness
  };
  const protectedCheckpointManifest=Number(backupVersion)>=15?BackupCodec.createProtectedManifest(captureBase,checkpointMetadata):null;
  const capture=freeze({...captureBase,protectedCheckpointManifest});
  logicalCheckpointGuards.set(capture,freeze({snapshotRevision,sourceRevision,forceLegacySnapshotFence,generation}));
  return capture;
}
async function assertLogicalCheckpointCurrent(capture){
  requireLogicalCheckpointCapture(capture);
  const guard=logicalCheckpointGuards.get(capture);
  if(!guard)throw new Error('Logical checkpoint lifetime expired. Retry the backup.');
  assertStorageGeneration(guard.generation);
  if(guard.snapshotRevision!==await ports.persistence.snapshotRevision(Object.freeze({legacy:guard.forceLegacySnapshotFence===true})))throw backupPreparationError('BACKUP_SOURCE_FENCE_CHANGED','checkpoint-source-fence','Stored data changed while the backup was being prepared. Retry the backup.');
  const currentSourceRevision=String(await ports.persistence.sourceRevision()||guard.sourceRevision);
  if(currentSourceRevision!==guard.sourceRevision)throw backupPreparationError('BACKUP_SOURCE_FENCE_CHANGED','checkpoint-source-fence','Stored data changed while the backup was being prepared. Retry the backup.');
  return true;
}

const MANAGED_PREPARATION_CAPTURE_FORMAT='study-director.managed-preparation-capture',MANAGED_PREPARATION_CAPTURE_VERSION=1;
const managedPreparationGuards=new WeakMap();
const MANAGED_PREPARATION_STAMP_LIMIT=Math.max(1024,Math.min(100000,Number(APP_LIMITS.backupMaxAssetDescriptors||50000)+Number(APP_LIMITS.maxImportRecords||10000)+Number(APP_LIMITS.maxImportAreaNotes||1000)+16));
function fastCaptureEpochToken(value){const text=String(value||''),prefix='study-director.fast-capture-fence.v1|';if(!text.startsWith(prefix))return '';const token=text.slice(prefix.length).split('|',1)[0];return /^[a-f0-9]{32}$/u.test(token)?token:'';}
function requireManagedPreparationCapture(value){if(!value||!Object.isFrozen(value)||value.format!==MANAGED_PREPARATION_CAPTURE_FORMAT||Number(value.version)!==MANAGED_PREPARATION_CAPTURE_VERSION)throw new TypeError('Managed preparation capture is invalid.');return value;}
function normalizedPreparationStamps(values){
  const rows=Array.isArray(values)?values:[];if(rows.length>MANAGED_PREPARATION_STAMP_LIMIT)throw backupPreparationError('BACKUP_PREPARATION_INDEX_INVALID','checkpoint-preparation-index','Backup preparation metadata exceeds its safety bound.');
  const out=[],seen=new Set();
  for(const raw of rows){const unit=String(raw&&raw.unit||''),token=String(raw&&raw.token||'');if(!unit||unit.length>512||!/^[a-f0-9]{32}$/u.test(token)||seen.has(unit))throw backupPreparationError('BACKUP_PREPARATION_INDEX_INVALID','checkpoint-preparation-index','Backup preparation metadata is invalid.');seen.add(unit);out.push(freeze({unit,token}));}
  out.sort((a,b)=>a.unit.localeCompare(b.unit));return freeze(out);
}
// Preparation is fenced from before its first storage access; a fallback full
// capture fences itself the same way.
const preparationGenerations=new WeakMap();
async function beginManagedPreparationCapture(exportedAt=new Date().toISOString()){
  const generation=storageGeneration(),capture=await beginManagedPreparationCaptureAt(exportedAt);
  assertStorageGeneration(generation);
  if(capture)preparationGenerations.set(capture,generation);
  return capture;
}
async function beginManagedPreparationCaptureAt(exportedAt){
  if(!appCanMutate())return null;
  await backupPreparationStep('BACKUP_PLAN_SETTLE_FAILED','checkpoint-plan-settle',()=>personalSettle({backupCapture:true}));
  try{await backupPreparationStep('BACKUP_NOTES_SETTLE_FAILED','checkpoint-notes-settle',()=>AppData.notes.flush({strict:true,backupCapture:true}));}catch(error){AppDiagnostics.capture('backup.incremental-notes-flush',error,'warn');throw error;}
  const noteFailure=AppData.notes.failure();if(noteFailure&&noteFailure.failed)throw backupPreparationError('BACKUP_NOTES_SETTLE_FAILED','checkpoint-notes-settle','Ongoing Notes are not safely settled for repository preparation.');
  const sessionResult=await backupPreparationStep('BACKUP_SESSION_SETTLE_FAILED','checkpoint-session-settle',()=>flushCurrentSessionForBackup());if(sessionResult.canonical===false){OperationDiagnostics.mark('checkpoint-preparation-fallback',{reason:'session-not-canonical'});return null;}
  try{await backupPreparationStep('BACKUP_DELETION_SETTLE_FAILED','checkpoint-deletion-settle',()=>settleDeletionRecovery());}catch(error){AppDiagnostics.capture('backup.incremental-deletion-recovery',error,'warn');OperationDiagnostics.mark('checkpoint-preparation-fallback',{reason:'deletion-settle'});return null;}
  OperationDiagnostics.mark('checkpoint-fast-fence-start');
  let snapshotRevision='';
  try{snapshotRevision=await ports.persistence.snapshotRevision(freeze({legacy:false}));}
  catch(error){AppDiagnostics.capture('backup.incremental-fast-fence',error,'warn');OperationDiagnostics.mark('checkpoint-preparation-fallback',{reason:'fast-fence-read'});return null;}
  const epochToken=fastCaptureEpochToken(snapshotRevision);
  if(!epochToken){OperationDiagnostics.mark('checkpoint-preparation-fallback',{reason:'legacy-fence'});return null;}
  const sourceRevision=String(await ports.persistence.sourceRevision()||exportedAt);
  if(!Number.isFinite(Date.parse(sourceRevision)))throw backupPreparationError('BACKUP_SOURCE_REVISION_INVALID','checkpoint-source-fence','Backup source revision is invalid. Retry the backup.');
  OperationDiagnostics.mark('checkpoint-fast-fence-complete');
  const capturedSession=await readSessionForCapture();
  if(!capturedSession.canonical){OperationDiagnostics.mark('checkpoint-preparation-fallback',{reason:'session-read-not-canonical'});return null;}

  // Mutation epoch + unit stamps are an acceleration index, not authoritative
  // backup data. If that metadata is stale/corrupt after restore or migration,
  // abandon the incremental path and rebuild from a full canonical capture.
  let epoch=null,stamps=[];
  OperationDiagnostics.mark('checkpoint-preparation-index-read-start');
  try{[epoch,stamps]=await Promise.all([AppData.mutationEpoch.read(),AppData.preparationUnits.list()]);}
  catch(error){AppDiagnostics.capture('backup.preparation-index-read',error,'warn');OperationDiagnostics.mark('checkpoint-preparation-fallback',{reason:'preparation-index-read'});return null;}
  if(!epoch||String(epoch.token||'')!==epochToken){OperationDiagnostics.mark('checkpoint-preparation-fallback',{reason:'epoch-mismatch'});return null;}
  let normalizedStamps;
  try{normalizedStamps=normalizedPreparationStamps(stamps);}
  catch(error){AppDiagnostics.capture('backup.preparation-index-invalid',error,'warn');OperationDiagnostics.mark('checkpoint-preparation-fallback',{reason:'preparation-index-invalid'});return null;}
  OperationDiagnostics.mark('checkpoint-preparation-index-read-complete',{units:normalizedStamps.length});

  // Deletion state and the attachment catalogue are authoritative snapshot data.
  // Failure to read these cannot be papered over by the incremental fast path.
  let savedDayDeletions,areaNoteDeletions,attachmentDeletions,assetCatalogue;
  OperationDiagnostics.mark('checkpoint-canonical-state-read-start');
  try{[savedDayDeletions,areaNoteDeletions,attachmentDeletions,assetCatalogue]=await Promise.all([
    AppData.deletionRecovery.savedDays(),AppData.deletionRecovery.areaNotes(),AppData.deletionRecovery.attachments(),portableAssets?AssetData.list():Promise.resolve([])
  ]);}catch(error){throw backupPreparationError('BACKUP_CAPTURE_STATE_READ_FAILED','checkpoint-canonical-state-read','Canonical deletion or attachment state could not be read for backup.',error);}
  OperationDiagnostics.mark('checkpoint-canonical-state-read-complete',{assets:Array.isArray(assetCatalogue)?assetCatalogue.length:0});

  const finalSnapshot=await ports.persistence.snapshotRevision(freeze({legacy:false}));
  const finalSourceRevision=String(await ports.persistence.sourceRevision()||sourceRevision);
  if(finalSnapshot!==snapshotRevision||finalSourceRevision!==sourceRevision){OperationDiagnostics.mark('checkpoint-preparation-fallback',{reason:'source-changed'});return null;}
  try{
    const installationId=AppData.provenance.installationId(),checkpointMetadata=Number(backupVersion)>=14?BackupCodec.createCheckpointMetadata(installationId,exportedAt):null;
    const capture=freeze({
      format:MANAGED_PREPARATION_CAPTURE_FORMAT,version:MANAGED_PREPARATION_CAPTURE_VERSION,exportedAt,sourceRevision,installationId,checkpoint:checkpointMetadata,epochToken,stamps:normalizedStamps,
      savedDayDeletions:freeze([...(savedDayDeletions||[])]),areaNoteDeletions:freeze([...(areaNoteDeletions||[])]),attachmentDeletions:freeze([...(attachmentDeletions||[])]),
      assetCatalogue:freeze((assetCatalogue||[]).map(row=>freeze({...row}))),warning:String(sessionResult.warning||''),completeness:freeze({complete:true,dailyRecords:'canonical',areaNotes:'canonical',activeSession:'canonical',deletionState:'canonical'})
    });
    managedPreparationGuards.set(capture,freeze({snapshotRevision,sourceRevision,session:capturedSession.session||null}));OperationDiagnostics.mark('checkpoint-preparation-capture-complete',{incremental:true});return capture;
  }catch(error){throw backupPreparationError('BACKUP_PREPARATION_CAPTURE_FAILED','checkpoint-preparation-capture','Incremental backup preparation could not be finalized.',error);}
}

async function readManagedPreparationUnits(preparation,units){
  requireManagedPreparationCapture(preparation);const guard=managedPreparationGuards.get(preparation);if(!guard)throw new Error('Managed preparation capture lifetime expired. Retry the backup.');
  assertStorageGeneration(preparationGenerations.get(preparation));
  const requested=[...new Set((units||[]).map(value=>String(value||'')).filter(Boolean))];if(requested.length>MANAGED_PREPARATION_STAMP_LIMIT)throw new Error('Too many changed backup preparation units.');
  const results=new Map(),noteUnits=[],noteKeys=[];
  for(const unit of requested){
    if(/^dailyRecordPack:\d{4}-(?:0[1-9]|1[0-2])$/u.test(unit)){const month=unit.slice('dailyRecordPack:'.length);let rows;try{rows=await AppData.dailyRecords.backupMonth(month,{requireCanonical:true});}catch(error){throw backupPreparationError('BACKUP_CANONICAL_CAPTURE_INCOMPLETE','checkpoint-canonical-completeness','Managed backup publication stopped because Saved Days could not be read completely from canonical IndexedDB storage. No incomplete rescue checkpoint was published.',error);}const payload=freeze([...(rows||[])]);results.set(unit,freeze({unit,present:payload.length>0,payload}));continue;}
    if(unit.startsWith('areaNote:')){const key=unit.slice('areaNote:'.length);if(!key)throw new Error('Ongoing Note preparation unit is invalid.');noteUnits.push(unit);noteKeys.push(key);continue;}
    if(unit==='personalData'){const payload=await personalExport({flush:false});results.set(unit,freeze({unit,present:!!payload,payload:payload||null}));continue;}
    if(unit==='activeSession'){const payload=guard.session&&typeof guard.session==='object'?ActiveSessionCodec.sanitizeCurrent(guard.session):null;results.set(unit,freeze({unit,present:!!payload,payload:payload||null}));continue;}
    throw new Error('Unknown backup preparation unit.');
  }
  if(noteKeys.length){const rows=await AppData.notes.readFreshItems(noteKeys);for(let index=0;index<noteKeys.length;index++){const unit=noteUnits[index],payload=rows[index]||null;results.set(unit,freeze({unit,present:!!payload,payload}));}}
  if(guard.snapshotRevision!==await ports.persistence.snapshotRevision(freeze({legacy:false})))throw backupPreparationError('BACKUP_SOURCE_FENCE_CHANGED','checkpoint-source-fence','Stored data changed while reading incremental backup units. Retry the backup.');
  const currentSourceRevision=String(await ports.persistence.sourceRevision()||guard.sourceRevision);if(currentSourceRevision!==guard.sourceRevision)throw backupPreparationError('BACKUP_SOURCE_FENCE_CHANGED','checkpoint-source-fence','Stored data changed while reading incremental backup units. Retry the backup.');
  return freeze(requested.map(unit=>results.get(unit)));
}
async function finalizeManagedPreparationCapture(preparation,inventory){
  requireManagedPreparationCapture(preparation);const guard=managedPreparationGuards.get(preparation);if(!guard)throw new Error('Managed preparation capture lifetime expired. Retry the backup.');
  // Only an incremental checkpoint needs this extra canonical inventory proof.
  // Cold/fallback publication performs a full canonical capture and therefore
  // proves the same property while enumerating Saved Days exactly once.
  let dailyRecordCoverage;
  try{dailyRecordCoverage=await backupPreparationStep('BACKUP_CANONICAL_CAPTURE_INCOMPLETE','checkpoint-canonical-completeness',()=>AppData.dailyRecords.backupDates());}
  catch(error){throw backupPreparationError('BACKUP_CANONICAL_CAPTURE_INCOMPLETE','checkpoint-canonical-completeness','Managed backup publication stopped because Saved Days could not be read completely from canonical IndexedDB storage. No incomplete rescue checkpoint was published.',error);}
  if(dailyRecordCoverage&&dailyRecordCoverage.canonical===false)throw backupPreparationError('BACKUP_CANONICAL_CAPTURE_INCOMPLETE','checkpoint-canonical-completeness','Managed backup publication stopped because Saved Days could not be read completely from canonical IndexedDB storage. No incomplete rescue checkpoint was published.');
  const value=inventory&&typeof inventory==='object'?inventory:{},recordDates=freeze([...(value.recordDates||[])].map(String).sort()),noteKeys=freeze([...(value.noteKeys||[])].map(String).sort()),assetIds=freeze([...(value.assetIds||[])].map(String).sort()),counts=BackupCodec.countShape(value.counts||{});
  const canonicalRecordDates=freeze([...(dailyRecordCoverage&&dailyRecordCoverage.dates||[])].map(String).sort());
  if(canonicalRecordDates.length!==recordDates.length||canonicalRecordDates.some((date,index)=>date!==recordDates[index]))throw backupPreparationError('BACKUP_PREPARATION_INDEX_INVALID','checkpoint-canonical-completeness','Managed backup publication stopped because the incremental Saved-Day inventory did not match canonical IndexedDB storage. A full canonical checkpoint will be required.');
  if(guard.snapshotRevision!==await ports.persistence.snapshotRevision(freeze({legacy:false})))throw backupPreparationError('BACKUP_SOURCE_FENCE_CHANGED','checkpoint-source-fence','Stored data changed while finalizing the incremental backup capture. Retry the backup.');
  const currentSourceRevision=String(await ports.persistence.sourceRevision()||guard.sourceRevision);if(currentSourceRevision!==guard.sourceRevision)throw backupPreparationError('BACKUP_SOURCE_FENCE_CHANGED','checkpoint-source-fence','Stored data changed while finalizing the incremental backup capture. Retry the backup.');
  const areaNoteItems=freeze(noteKeys.map(key=>freeze({key}))),assetItems=freeze(assetIds.map(assetId=>freeze({descriptor:freeze({assetId}),blob:null})));
  const captureBase=freeze({
    format:LOGICAL_CHECKPOINT_CAPTURE_FORMAT,version:LOGICAL_CHECKPOINT_CAPTURE_VERSION,dailyDocuments:freeze([]),exportedAt:preparation.exportedAt,sourceRevision:preparation.sourceRevision,studentName:getStudentNameFromDisplay(),installationId:preparation.installationId,checkpoint:preparation.checkpoint,
    recordDates,areaNoteItems,activeSession:null,personalData:null,savedDayDeletions:preparation.savedDayDeletions,areaNoteDeletions:preparation.areaNoteDeletions,attachmentDeletions:preparation.attachmentDeletions,counts,assetItems,warning:preparation.warning,completeness:preparation.completeness
  });
  const protectedCheckpointManifest=Number(backupVersion)>=15?BackupCodec.createProtectedManifest(captureBase,preparation.checkpoint):null,capture=freeze({...captureBase,protectedCheckpointManifest});
  const generation=preparationGenerations.get(preparation);assertStorageGeneration(generation);
  logicalCheckpointGuards.set(capture,freeze({snapshotRevision:guard.snapshotRevision,sourceRevision:guard.sourceRevision,forceLegacySnapshotFence:false,generation}));return capture;
}
async function establishManagedPreparationBaseline(capture,units){
  requireLogicalCheckpointCapture(capture);const guard=logicalCheckpointGuards.get(capture);if(!guard||guard.forceLegacySnapshotFence===true||!fastCaptureEpochToken(guard.snapshotRevision))return null;
  await assertLogicalCheckpointCurrent(capture);let stamps;
  try{stamps=await AppData.preparationUnits.replace([...new Set((units||[]).map(String).filter(Boolean))]);}
  catch(error){AppDiagnostics.capture('backup.preparation-baseline',error,'warn');return null;}
  await assertLogicalCheckpointCurrent(capture);const epoch=await AppData.mutationEpoch.read(),epochToken=String(epoch&&epoch.token||'');if(!epochToken||epochToken!==fastCaptureEpochToken(guard.snapshotRevision))return null;
  return freeze({epochToken,stamps:normalizedPreparationStamps(stamps)});
}


    return freeze({
      format:'study-director.backup-capture',contractVersion:1,
      logicalFormat:LOGICAL_CHECKPOINT_CAPTURE_FORMAT,logicalVersion:LOGICAL_CHECKPOINT_CAPTURE_VERSION,
      preparationFormat:MANAGED_PREPARATION_CAPTURE_FORMAT,preparationVersion:MANAGED_PREPARATION_CAPTURE_VERSION,
      requireLogicalCheckpointCapture,verifyAnomalousPhysicalAssetAliases,captureLogicalCheckpoint,assertLogicalCheckpointCurrent,
      beginManagedPreparationCapture,readManagedPreparationUnits,finalizeManagedPreparationCapture,establishManagedPreparationBaseline
    });
  }
  return freeze({format:'study-director.backup-capture-module',contractVersion:1,create});
});
})();
