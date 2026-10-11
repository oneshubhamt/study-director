(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,declaredFunctions:requireFunctions}=registry.contracts;
registry.define('backup',1,input=>{
  const freeze=Object.freeze;
  if(!input||!Object.isFrozen(input)||Object.keys(input).sort().join('|')!=='backupCapture|backupProvider|canonical|managedRepository|repositoryBackground')throw new TypeError('Backup module dependencies are invalid.');
  if(!input.canonical||input.canonical.format!=='study-director.canonical'||input.canonical.contractVersion!==1||typeof input.canonical.same!=='function')throw new TypeError('Backup canonical dependency is invalid.');
  if(!input.managedRepository||input.managedRepository.format!=='study-director.managed-repository-module'||input.managedRepository.contractVersion!==1||typeof input.managedRepository.createEngine!=='function')throw new TypeError('Backup managed-repository dependency is invalid.');
  if(!input.backupProvider||input.backupProvider.format!=='study-director.backup-provider-module'||input.backupProvider.contractVersion!==1||typeof input.backupProvider.createRuntime!=='function')throw new TypeError('Backup provider dependency is invalid.');
  if(!input.repositoryBackground||input.repositoryBackground.format!=='study-director.repository-background-module'||input.repositoryBackground.contractVersion!==1||typeof input.repositoryBackground.createCoordinator!=='function')throw new TypeError('Backup repository-background dependency is invalid.');
  if(!input.backupCapture||input.backupCapture.format!=='study-director.backup-capture-module'||input.backupCapture.contractVersion!==1||typeof input.backupCapture.create!=='function')throw new TypeError('Backup capture dependency is invalid.');
  const Canonical=input.canonical,ManagedRepositoryModule=input.managedRepository,BackupProviderModule=input.backupProvider,RepositoryBackgroundModule=input.repositoryBackground,BackupCaptureModule=input.backupCapture;
  const PORT_FIELDS=freeze({
    configuration:freeze(['activeSessionId','appVersion','backupVersion','limits']),
    persistence:freeze(['activeSessionLoad','activeSessionSave','activeSessionClear','activeSessionSettled','dailyRecordBackupDates','dailyRecordBackupMonth','dailyRecordDocuments','dailyRecordImportBatches','dailyRecordRemove','dailyRecordTimestamp','notesExportPayload','notesReadFreshPayload','notesReadFreshItems','notesFlush','notesNormalizePayload','notesAlignByTitle','notesFailure','restoreJournalPrepare','restoreJournalRead','restoreJournalMark','restoreJournalClear','scheduleRead','personalSettle','personalExport','personalImport','personalVerify','sourceRevision','snapshotRevision','storageGeneration','canonicalMutationEpochRead','canonicalPreparationRebase','preparationUnitStamps','preparationUnitReplace','installationId','deletionRecoveryFlush','deletionRecoverySavedDays','deletionRecoveryReplaceSavedDays','deletionRecoveryAreaNotes','deletionRecoveryReplaceAreaNotes','deletionRecoveryAttachments','deletionRecoveryReplaceAttachments','deletionRecoveryClearAttachment','reconciliationBaseRead','reconciliationBaseReadNotes','reconciliationBaseWrite']),
    codecs:freeze(['activeSession','backup']),
    reconciliation:freeze(['createPlan','resolvePlan','summarizePlan']),
    noteReconciliation:freeze(['resolve']),
    exports:freeze(['backgroundAvailable','protect','unprotect','check','scope','job','run','download','chooseSave','save']),
    session:freeze(['canMutate','cancelLiveDraftSave','captureSnapshot','hasActiveSession','hasTasks','toActiveSession','withPersistenceSuppressed']),
    domain:freeze(['clampText','filenameSafeStudentName','getStudentName','materializeDailyRecordView','sanitizeCurrentDailyRecord','todayISO']),
    view:freeze(['presentation','refreshPnote','refreshReview','renderSchedule']),
    events:freeze(['libraryChanged','backupCompleted','reconcileAreaNotes','restoreAreaNotesSnapshot','restoreSessionState','verifyActiveSessionRuntime','restoredFromFile']),
    operations:freeze(['assertAuthority','clearFault','failClosed','runExclusive']),
    interactions:freeze(['choose','configure','notify']),
    environment:freeze(['AbortController','clearTimeout','setTimeout','yieldTask']),
    diagnostics:freeze(['capture','fail','finish','mark','start']),
    assets:freeze(['get','put','keys','list','importAll','restoreAll','removeMany','removeMetadata','scheduleMaintenance'])
  });
  function createRuntime(input){
    exactObject(input,['ports'],'Backup input');
    const rawPorts=input.ports;
    const configuration=exactObject(rawPorts&&rawPorts.configuration,PORT_FIELDS.configuration,'Backup configuration port');
    const portableAssets=Number(configuration.backupVersion)>=10;
    const expectedPortNames=Object.keys(PORT_FIELDS).filter(name=>portableAssets||name!=='assets');
    const ports=exactObject(rawPorts,expectedPortNames,'Backup ports');
    for(const name of expectedPortNames)exactObject(ports[name],PORT_FIELDS[name],'Backup '+name+' port');
    requireFunctions(ports.exports,PORT_FIELDS.exports,'Backup export port');
    requireFunctions(ports.persistence,PORT_FIELDS.persistence,'Backup persistence port');
    requireFunctions(ports.reconciliation,PORT_FIELDS.reconciliation,'Backup reconciliation port');
    requireFunctions(ports.noteReconciliation,PORT_FIELDS.noteReconciliation,'Backup note-reconciliation port');
    requireFunctions(ports.session,PORT_FIELDS.session,'Backup session port');
    requireFunctions(ports.domain,PORT_FIELDS.domain,'Backup domain port');
    requireFunctions(ports.view,['refreshPnote','refreshReview','renderSchedule'],'Backup view port');
    requireFunctions(ports.events,PORT_FIELDS.events,'Backup events port');
    requireFunctions(ports.operations,PORT_FIELDS.operations,'Backup operations port');
    requireFunctions(ports.interactions,PORT_FIELDS.interactions,'Backup interactions port');
    requireFunctions(ports.environment,['AbortController','clearTimeout','setTimeout','yieldTask'],'Backup environment port');
    requireFunctions(ports.diagnostics,PORT_FIELDS.diagnostics,'Backup diagnostics port');
    if(portableAssets)requireFunctions(ports.assets,PORT_FIELDS.assets,'Backup assets port');
    if(!Object.isFrozen(ports.configuration.limits)){
      throw new TypeError('Backup configuration objects must be frozen.');
    }
    if(!Object.isFrozen(ports.codecs.backup)||!Object.isFrozen(ports.codecs.activeSession)){
      throw new TypeError('Backup codecs must be frozen.');
    }
    if(!Object.isFrozen(ports.view.presentation)||['begin','read','feedback','condition','detail','outcome','resolve','reset','subscribe'].some(key=>typeof ports.view.presentation[key]!=='function'))throw new TypeError('Backup presentation port is invalid.');
    const {
      activeSessionId:ACTIVE_SESSION_ID,
      appVersion:APP_VERSION,
      backupVersion,
      limits:APP_LIMITS
    }=ports.configuration;
    const {
      activeSessionLoad,activeSessionSave,activeSessionClear,activeSessionSettled,dailyRecordBackupDates,dailyRecordBackupMonth,dailyRecordDocuments,
      dailyRecordImportBatches,dailyRecordRemove,dailyRecordTimestamp,notesExportPayload,notesReadFreshPayload,notesReadFreshItems,notesFlush,
      notesNormalizePayload,notesAlignByTitle,notesFailure,restoreJournalPrepare,restoreJournalRead,
      restoreJournalMark,restoreJournalClear,scheduleRead,personalSettle,personalExport,personalImport,personalVerify,canonicalMutationEpochRead,canonicalPreparationRebase,preparationUnitStamps,preparationUnitReplace,installationId,deletionRecoveryFlush,deletionRecoverySavedDays,deletionRecoveryReplaceSavedDays,deletionRecoveryAreaNotes,deletionRecoveryReplaceAreaNotes,deletionRecoveryAttachments,deletionRecoveryReplaceAttachments,deletionRecoveryClearAttachment,reconciliationBaseRead,reconciliationBaseReadNotes,reconciliationBaseWrite
    }=ports.persistence;
    const {activeSession:ActiveSessionCodec,backup:BackupCodec}=ports.codecs;
    const Reconciliation=ports.reconciliation;
    const NoteReconciliation=ports.noteReconciliation;
    const Exports=ports.exports;
    const {canMutate:appCanMutate,cancelLiveDraftSave,captureSnapshot:captureSessionSnapshot,hasActiveSession,hasTasks,toActiveSession:activeSessionPayload,withPersistenceSuppressed}=ports.session;
    const {clampText,filenameSafeStudentName,getStudentName:getStudentNameFromDisplay,materializeDailyRecordView,sanitizeCurrentDailyRecord,todayISO}=ports.domain;
    const {refreshPnote,refreshReview,renderSchedule:renderSched}=ports.view;
    const {libraryChanged,backupCompleted,reconcileAreaNotes,restoreAreaNotesSnapshot,restoreSessionState,verifyActiveSessionRuntime,restoredFromFile}=ports.events;
    const {assertAuthority,clearFault,failClosed,runExclusive}=ports.operations;
    const {choose,configure,notify}=ports.interactions;
    const {AbortController,clearTimeout,setTimeout,yieldTask}=ports.environment;
    const AppDiagnostics=freeze({capture:ports.diagnostics.capture});
    const OperationDiagnostics=freeze({start:ports.diagnostics.start,mark:ports.diagnostics.mark,finish:ports.diagnostics.finish,fail:ports.diagnostics.fail});
    const DATA_CONTRACT=freeze({schemas:freeze({Backup:freeze({version:backupVersion})})});
    const AppData=freeze({
      activeSession:freeze({load:activeSessionLoad,save:activeSessionSave,clear:activeSessionClear,settled:activeSessionSettled}),
      dailyRecords:freeze({backupDates:dailyRecordBackupDates,backupMonth:dailyRecordBackupMonth,documents:dailyRecordDocuments,importBatches:dailyRecordImportBatches,remove:dailyRecordRemove,timestamp:dailyRecordTimestamp}),
      notes:freeze({exportPayload:notesExportPayload,readFreshPayload:notesReadFreshPayload,readFreshItems:notesReadFreshItems,flush:notesFlush,normalizePayload:notesNormalizePayload,alignByTitle:notesAlignByTitle,failure:notesFailure}),
      restoreJournal:freeze({prepare:restoreJournalPrepare,read:restoreJournalRead,mark:restoreJournalMark,clear:restoreJournalClear}),
      provenance:freeze({installationId}),mutationEpoch:freeze({read:canonicalMutationEpochRead,rebasePreparation:canonicalPreparationRebase}),preparationUnits:freeze({list:preparationUnitStamps,replace:preparationUnitReplace}),deletionRecovery:freeze({flush:deletionRecoveryFlush,savedDays:deletionRecoverySavedDays,replaceSavedDays:deletionRecoveryReplaceSavedDays,areaNotes:deletionRecoveryAreaNotes,replaceAreaNotes:deletionRecoveryReplaceAreaNotes,attachments:deletionRecoveryAttachments,replaceAttachments:deletionRecoveryReplaceAttachments,clearAttachment:deletionRecoveryClearAttachment}),reconciliationBase:freeze({read:reconciliationBaseRead,readNotes:reconciliationBaseReadNotes,write:reconciliationBaseWrite})
    });
    const AssetData=portableAssets?freeze({
      get:ports.assets.get,put:ports.assets.put,keys:ports.assets.keys,list:ports.assets.list,importAll:ports.assets.importAll,restoreAll:ports.assets.restoreAll,removeMany:ports.assets.removeMany,removeMetadata:ports.assets.removeMetadata,scheduleMaintenance:ports.assets.scheduleMaintenance
    }):null;
    const ReviewView=freeze({refresh:refreshReview});
    const TASKS=freeze({get length(){return hasTasks()?1:0;}});
    function requireBackupMutationControl(action){
      if(appCanMutate())return;
      throw new Error(`Study Director control is in another tab. Take control here before ${action}.`);
    }
    function requireNoActiveSession(action='importing'){
      if(!hasActiveSession())return;
      throw new Error(`End or suspend the active session before ${action}.`);
    }
    function currentDailyRecords(records,label='Daily Records'){
      if(!Array.isArray(records))throw new TypeError(`${label} must be an array.`);
      return records.map(record=>{
        const clean=sanitizeCurrentDailyRecord(record);
        if(!clean)throw new Error(`${label} contain a record outside the current canonical schema.`);
        return clean;
      });
    }

const {controller:BackupController,repository:RepositoryCheckpointPipeline}=(()=>{
const inspectedBackups=new WeakMap(),verifiedPortableSnapshots=new WeakMap();
let activeOperations=0;
let activeImportOperation=null,importSequence=0;
let checkpointPromise=null,localExportPromise=null,localExportRequest=null;
function importAbortError(reason='Backup import was cancelled.'){
  const error=new Error(reason);error.name='AbortError';error.code='STUDY_DIRECTOR_IMPORT_CANCELLED';return error;
}
function throwIfImportCancelled(signal){if(signal&&signal.aborted)throw importAbortError(String(signal.reason&&signal.reason.message||signal.reason||'Backup import was cancelled.'));}
function throwIfImportAborted(signal,authorityOptions=null){assertAuthority(authorityOptions||undefined);throwIfImportCancelled(signal);}

// The app draws the file backup row and the import Cancel from status() and
// the 'file' presentation; listeners hear when an export or import starts or ends.
const statusListeners=new Set();
function subscribeStatus(listener){if(typeof listener!=='function')throw new TypeError('Backup status listener is invalid.');statusListeners.add(listener);return ()=>statusListeners.delete(listener);}
function notifyStatus(){for(const listener of statusListeners)try{listener();}catch(error){AppDiagnostics.capture('backup.status-listener',error,'warn');}}
function beginImport(){
  if(activeImportOperation)return activeImportOperation;
  const controller=new AbortController(),id=++importSequence;
  activeImportOperation=freeze({id,signal:controller.signal,cancel:reason=>{if(!controller.signal.aborted)controller.abort(importAbortError(reason));}});
  notifyStatus();return activeImportOperation;
}
function cancelImport(reason='Backup import was cancelled by the user.',options={}){
  if(!activeImportOperation)return false;
  activeImportOperation.cancel(reason);if(options&&options.announce!==false)setLocalExportStatus('Cancelling backup import safely…',true);return true;
}
function finishImport(operation=activeImportOperation){
  if(!operation||!activeImportOperation||operation.id!==activeImportOperation.id)return false;
  activeImportOperation=null;presentation.condition('file','export-busy','');notifyStatus();return true;
}
async function yieldImport(signal,authorityOptions=null){
  throwIfImportAborted(signal,authorityOptions);
  await yieldTask({signal});
  throwIfImportAborted(signal,authorityOptions);
}
function status(){return Object.freeze({busy:activeOperations>0,activeOperations,importActive:!!activeImportOperation,importCancelled:!!activeImportOperation?.signal.aborted,standaloneExportActive:!!localExportPromise||!!localExportRequest});}
async function track(operation,wait=false,surface='managed'){activeOperations+=1;try{return await Exports.job(operation,{wait,surface});}finally{activeOperations=Math.max(0,activeOperations-1);}}
const BackupCapture=BackupCaptureModule.create(freeze({
  configuration:freeze({backupVersion,limits:APP_LIMITS,portableAssets}),
  data:freeze({
    activeSession:freeze({save:AppData.activeSession.save,settled:AppData.activeSession.settled,load:AppData.activeSession.load}),
    dailyRecords:freeze({backupDates:AppData.dailyRecords.backupDates,backupMonth:AppData.dailyRecords.backupMonth}),
    notes:freeze({flush:AppData.notes.flush,failure:AppData.notes.failure,readFreshPayload:AppData.notes.readFreshPayload,exportPayload:AppData.notes.exportPayload,readFreshItems:AppData.notes.readFreshItems}),
    deletionRecovery:freeze({flush:AppData.deletionRecovery.flush,savedDays:AppData.deletionRecovery.savedDays,areaNotes:AppData.deletionRecovery.areaNotes,attachments:AppData.deletionRecovery.attachments}),
    mutationEpoch:freeze({read:AppData.mutationEpoch.read}),preparationUnits:freeze({list:AppData.preparationUnits.list,replace:AppData.preparationUnits.replace}),provenance:freeze({installationId:AppData.provenance.installationId})
  }),
  codecs:freeze({activeSession:ActiveSessionCodec,backup:BackupCodec}),
  session:freeze({canMutate:appCanMutate,cancelLiveDraftSave,captureSnapshot:captureSessionSnapshot,hasTasks,toActiveSession:activeSessionPayload}),
  personal:freeze({settle:personalSettle,export:personalExport}),assets:portableAssets?freeze({get:AssetData.get,list:AssetData.list}):null,
  exports:freeze({check:Exports.check,run:Exports.run}),
  persistence:freeze({sourceRevision:ports.persistence.sourceRevision,snapshotRevision:ports.persistence.snapshotRevision,dailyRecordDocuments:getDailyRecordDocumentsByDates,storageGeneration:ports.persistence.storageGeneration}),
  diagnostics:freeze({capture:AppDiagnostics.capture,mark:OperationDiagnostics.mark}),
  domain:freeze({getStudentName:getStudentNameFromDisplay,currentDailyRecords}),environment:freeze({yieldTask})
}));
if(BackupCapture.format!=='study-director.backup-capture'||BackupCapture.contractVersion!==1)throw new Error('Backup capture subsystem is unavailable or incompatible.');
const LOGICAL_CHECKPOINT_CAPTURE_FORMAT=BackupCapture.logicalFormat,LOGICAL_CHECKPOINT_CAPTURE_VERSION=BackupCapture.logicalVersion;
const requireLogicalCheckpointCapture=BackupCapture.requireLogicalCheckpointCapture,verifyAnomalousPhysicalAssetAliases=BackupCapture.verifyAnomalousPhysicalAssetAliases,captureLogicalCheckpoint=BackupCapture.captureLogicalCheckpoint,assertLogicalCheckpointCurrent=BackupCapture.assertLogicalCheckpointCurrent;
const beginManagedPreparationCapture=BackupCapture.beginManagedPreparationCapture,readManagedPreparationUnits=BackupCapture.readManagedPreparationUnits,finalizeManagedPreparationCapture=BackupCapture.finalizeManagedPreparationCapture,establishManagedPreparationBaseline=BackupCapture.establishManagedPreparationBaseline;
async function* createPortableBackupLines(plan,{compression='none'}={}){
  const algorithm=BackupCodec.checksumAlgorithm();
  const manifest=BackupCodec.createManifest(plan,{compression,algorithm});
  yield (await Exports.run('stringify',{value:manifest}))+'\n';
  let seq=0;const chunkHashes=[];const actual=BackupCodec.countShape();
  const emit=async(entityType,items)=>{
    const result=await BackupCodec.encodeChunk(seq++,entityType,items,algorithm);
    chunkHashes.push(result.checksum);actual[entityType]+=items.length;
    return result.line+'\n';
  };
  if(Number(backupVersion)>=15)yield await emit('checkpointManifest',[plan.protectedCheckpointManifest||BackupCodec.createProtectedManifest(plan,manifest.checkpoint)]);
  for(let offset=0;offset<plan.recordDates.length;offset+=APP_LIMITS.backupChunkItems){
    const dates=plan.recordDates.slice(offset,offset+APP_LIMITS.backupChunkItems);
    const docs=portableAssets?plan.dailyDocuments.slice(offset,offset+APP_LIMITS.backupChunkItems):currentDailyRecords(await getDailyRecordDocumentsByDates(dates),'Backup Daily Records').sort((a,b)=>a.date.localeCompare(b.date));
    for(const group of BackupCodec.splitItems(docs))yield await emit('dailyRecord',group);
  }
  for(const group of BackupCodec.splitItems(plan.areaNoteItems))yield await emit('areaNote',group);
  if(plan.activeSession)yield await emit('activeSession',[plan.activeSession]);
  if(plan.personalData)yield await emit('personalData',[plan.personalData]);
  if(!BackupCodec.countsEqual(actual,plan.counts))throw new Error('Backup counts changed during export. Please export again.');
  const captureAuthority=plan&&plan.completeness&&plan.completeness.complete===true?'canonical-complete':'rescue-partial';
  yield (await Exports.run('stringify',{value:await BackupCodec.encodeCompletion(seq,actual,chunkHashes,algorithm,(plan.assetItems||[]).map(item=>item.descriptor),captureAuthority)}))+'\n';
}
async function portableBackupMetadataBlob(plan,compression){
  const id=await Exports.run('encode.open',{gzip:compression==='gzip',maxBytes:APP_LIMITS.backupMaxCompressedBytes});
  try{for await(const line of createPortableBackupLines(plan,{compression}))await Exports.run('encode.write',{id,line});return await Exports.run('encode.finish',{id});}
  catch(error){await Exports.run('encode.close',{id}).catch(()=>{});throw error;}
}
// The name is known at the click, so the save dialog can open before the
// backup is prepared.
function portableBackupFilename(studentName,compression='gzip'){return filenameSafeStudentName(studentName)+'-study-director-backup-'+todayISO()+(portableAssets?'.sdbackup':(compression==='gzip'?'.sdbackup.gz':'.sdbackup'));}
async function createPortableBackupBlob(plan,{preferCompression=true,verify=true,retainInspection=false,report=null}={}){
  let compression=preferCompression&&BackupCodec.compressionSupported()?'gzip':'none',blob=null,compressionFallback=false;
  if(portableAssets){
    const metadataBlob=await portableBackupMetadataBlob(plan,compression);
    blob=BackupCodec.createV10Container(metadataBlob,{compression,assetBlobs:[...new Map((plan.assetItems||[]).filter(item=>item.blob instanceof Blob).map(item=>[item.descriptor.checksum+':'+item.blob.size,item.blob])).values()]});
  }else{
    blob=await portableBackupMetadataBlob(plan,compression);
    if(blob.size>APP_LIMITS.backupMaxCompressedBytes)throw new Error(`Backup exceeds the ${Math.round(APP_LIMITS.backupMaxCompressedBytes/1048576)} MB safe file-size limit.`);
  }
  const maxFileBytes=portableAssets?APP_LIMITS.backupMaxFileBytes:APP_LIMITS.backupMaxCompressedBytes;
  if(blob.size>maxFileBytes)throw new Error(`Backup exceeds the ${Math.round(maxFileBytes/1048576)} MB safe file-size limit.`);
  const filename=portableBackupFilename(plan.studentName,compression);
  report?.stage('Packaging the backup…');blob=await Exports.run('file.copy',{file:blob},{onProgress:report?.progress});
  let inspection=null;
  try{if(verify){
    report?.stage('Verifying the backup…');inspection=await BackupCodec.inspect(blob,{filename,validateOnly:retainInspection!==true});
    if(!inspection||inspection.formatVersion!==DATA_CONTRACT.schemas.Backup.version||inspection.report.skipped)throw new Error('The generated backup did not pass its self-restore verification.');
    if(!BackupCodec.countsEqual(inspection.counts,plan.counts))throw new Error('The generated backup failed its count verification.');
    if(Number(backupVersion)>=18){const expectedCaptureAuthority=plan&&plan.completeness&&plan.completeness.complete===true?'canonical-complete':'rescue-partial';if(inspection.captureAuthority!==expectedCaptureAuthority)throw new Error('The generated backup failed its capture-authority verification.');}
    if(portableAssets&&Number(inspection.assetDescriptors&&inspection.assetDescriptors.length)!==Number(plan.assetItems&&plan.assetItems.length))throw new Error('The generated backup failed its attachment verification.');
  }
  return retainInspection&&inspection?{blob,filename,compression,compressionFallback,inspection}:{blob,filename,compression,compressionFallback};
  }catch(error){await Exports.run('file.release',{file:blob});throw error;}
}
async function materializePortableCheckpoint(capture,{preferCompression=true,verify=true,retainInspection=false,report=null}={}){
  const plan=requireLogicalCheckpointCapture(capture);
  const file=await createPortableBackupBlob(plan,{preferCompression,verify,retainInspection,report});
  return freeze({...file,exportedAt:plan.exportedAt,sourceRevision:plan.sourceRevision,warning:plan.warning,counts:freeze({...plan.counts})});
}
const LogicalCheckpointCapture=freeze({capture:captureLogicalCheckpoint});
const PortableCheckpointMaterializer=freeze({materialize:materializePortableCheckpoint});

const ManagedRepository=ManagedRepositoryModule.createEngine(freeze({
  codec:BackupCodec,
  ports:freeze({
    configuration:freeze({backupVersion,limits:APP_LIMITS,logicalCaptureFormat:LOGICAL_CHECKPOINT_CAPTURE_FORMAT,logicalCaptureVersion:LOGICAL_CHECKPOINT_CAPTURE_VERSION}),
    persistence:freeze({reconciliationBaseRead:AppData.reconciliationBase.read,reconciliationBaseWrite:AppData.reconciliationBase.write}),
    assets:freeze({get:assetId=>AssetData.get(assetId),verifyAliases:(catalogue,assetIds)=>verifyAnomalousPhysicalAssetAliases(catalogue,assetIds)}),
    files:freeze({protect:Exports.protect,unprotect:Exports.unprotect,run:Exports.run,scope:Exports.scope}),
    checkpoint:freeze({
      capture:(...args)=>captureLogicalCheckpoint(...args),beginPreparation:(...args)=>beginManagedPreparationCapture(...args),readPreparationUnits:(...args)=>readManagedPreparationUnits(...args),finalizePreparation:(...args)=>finalizeManagedPreparationCapture(...args),establishPreparationBaseline:(...args)=>establishManagedPreparationBaseline(...args),
      assertCurrent:capture=>assertLogicalCheckpointCurrent(capture),inspectVerifiedCapture:(...args)=>inspectVerifiedLogicalCapture(...args),verifyVerifiedCapture:(...args)=>verifyVerifiedLogicalCapture(...args),
      currentImportSignal:()=>activeImportOperation&&activeImportOperation.signal||null
    }),
    domain:freeze({clampText}),
    environment:freeze({throwIfAborted:throwIfImportAborted,yieldTask}),
    diagnostics:freeze({capture:AppDiagnostics.capture})
  })
}));
if(!Object.isFrozen(ManagedRepository)||ManagedRepository.format!=='study-director.managed-repository'||ManagedRepository.contractVersion!==1)throw new Error('Managed repository engine is unavailable or incompatible.');
async function createCanonicalCheckpoint(options={},report=null){
  report?.stage('Collecting your data…');
  const capture=await LogicalCheckpointCapture.capture(new Date().toISOString(),options);
  return PortableCheckpointMaterializer.materialize(capture,{preferCompression:true,verify:true,report});
}
async function createCanonicalCheckpointWithInspection(options={}){
  const capture=await LogicalCheckpointCapture.capture(new Date().toISOString(),options);
  return PortableCheckpointMaterializer.materialize(capture,{preferCompression:true,verify:true,retainInspection:true});
}

// report (optional): stage(message) and progress({loaded,total}) for a person
// watching the export.
async function createCheckpoint(options={},report=null){
  if(checkpointPromise)return checkpointPromise;
  checkpointPromise=(async()=>{
    let canonical,result;
    try{result=await Exports.protect(async()=>{canonical=await createCanonicalCheckpoint({},report);report?.stage('Securing the backup…');return canonical;},{...options,onProgress:report?.progress});return Object.freeze({...result,release:()=>Exports.run('file.release',{file:result.blob})});}
    finally{if(canonical&&canonical.blob!==result?.blob)await Exports.run('file.release',{file:canonical.blob});}
  })();
  try{return await checkpointPromise;}finally{checkpointPromise=null;}
}
const presentation=ports.view.presentation;
let portablePresentation=null;
function setLocalExportStatus(message='',ok=true){
  if(portablePresentation?.read()?.lifecycle==='running')portablePresentation.update({message:String(message||''),severity:ok?'info':'error'});
  else presentation.feedback('file',message,ok);
}
function finishPortablePresentation(patch={}){portablePresentation?.finish(patch);portablePresentation=null;}
function markBackupCompleted(context={}){if(appCanMutate())backupCompleted(context&&typeof context==='object'?context:{});}
async function prepareSafetyCopy(options={}){
  let canonical,file;try{file=await Exports.protect(async()=>{canonical=await createCanonicalCheckpoint(options);return canonical;});
  await Exports.save(file);markBackupCompleted({copy:portableCopy(file,false)});
  return {canonical,file:Object.freeze({...file,downloadStarted:true})};
  }catch(error){if(canonical)await Exports.run('file.release',{file:canonical.blob});if(file?.blob!==canonical?.blob)await Exports.run('file.release',{file:file?.blob});throw error;}
}
async function downloadSafetyCopy(options={}){const {canonical,file}=await prepareSafetyCopy(options);if(canonical.blob!==file.blob)await Exports.run('file.release',{file:canonical.blob});return file;}
// Progress for a person watching an export: each stage at once, and bytes as
// the large steps (packaging, encrypting, saving, checking) move.
function exportReporter(){
  let last=0;
  return freeze({
    stage:message=>{portablePresentation?.update({message:String(message||''),progress:null});last=0;},
    progress:value=>{const now=Date.now(),loaded=Math.max(0,Number(value&&value.loaded)||0),total=Math.max(0,Number(value&&value.total)||0);if(!total||now-last<150&&loaded<total)return;last=now;portablePresentation?.update({progress:{stage:'export',completedBytes:Math.min(loaded,total),totalBytes:total}});renderPortablePresentation();}
  });
}
// A portable backup holds the data as of its capture. A file saved through the
// save dialog is read back (verified); a download cannot be, but the person
// still made a backup, so the reminder counts both.
function portableCopy(file,verified){return freeze({source:'file',sourceRevision:String(file&&file.sourceRevision||''),verified});}
async function exportPortableBackup(){
  if(localExportPromise)return localExportPromise;
  // The save dialog opens straight from the click, before any waiting, so the
  // browser allows it and the person gets an answer at once. The backup is
  // prepared once a location is chosen. Browsers without a save dialog
  // download the verified file instead.
  const chosen=Exports.chooseSave(portableBackupFilename(getStudentNameFromDisplay()),{'application/octet-stream':[portableAssets?'.sdbackup':'.gz']},{id:'study-director-backups'});
  const traceId=OperationDiagnostics.start('standalone-export','Standalone backup');
  portablePresentation=presentation.begin('file','export',{label:'File backup',message:'Choose where to save the backup…'});
  localExportPromise=(async()=>{
    let file=null;
    try{
      const handle=await chosen,report=exportReporter();
      OperationDiagnostics.mark('standalone-capture-start',{chosen:!!handle},traceId);file=await createCheckpoint({},report);OperationDiagnostics.mark('standalone-capture-complete',{bytes:Number(file&&file.blob&&file.blob.size)||0},traceId);
      if(!file.blob?.size)throw new Error('The prepared backup is empty. No file was saved.');
      report.stage(handle?`Saving ${handle.name}…`:'Starting the download…');
      OperationDiagnostics.mark('standalone-save-start',{},traceId);const result=await Exports.save(file,handle,{onProgress:report.progress,onVerify:()=>report.stage('Checking the saved file…')});OperationDiagnostics.mark('standalone-save-complete',{status:String(result&&result.status||'')},traceId);
      const saved=result?.status==='saved';markBackupCompleted({userExport:true,copy:portableCopy(file,saved)});
      const message=(saved?`Backup saved and verified: ${result.filename}.`:'Verified backup download started. Check that your browser saved it.')+(file.warning?' '+file.warning:'');
      setLocalExportStatus(message);finishPortablePresentation({message,outcome:saved?'saved':'download-started'});OperationDiagnostics.finish({bytes:Number(file.blob.size)||0,saved},traceId);return result;
    }catch(error){
      const cancelled=error.name==='AbortError'||error.code==='STUDY_DIRECTOR_IMPORT_CANCELLED',message=cancelled?'Backup export cancelled.':'Backup export failed: '+error.message+(error.fileWritten?' The file at that location may be incomplete. Delete it and export again.':'');setLocalExportStatus(message,cancelled);
      finishPortablePresentation({message,lifecycle:cancelled?'cancelled':'failed'});
      if(cancelled)OperationDiagnostics.finish({cancelled:true},traceId);else OperationDiagnostics.fail(error,{},traceId);return {status:cancelled?'cancelled':'failed'};
    }finally{if(file)try{await file.release();}catch(error){AppDiagnostics.capture('backup.export-release',error,'warn');}}
  })();
  notifyStatus();
  try{return await localExportPromise;}finally{localExportPromise=null;notifyStatus();}
}
function exportLocalBackup(){
  if(localExportRequest)return localExportRequest;
  if(activeImportOperation){
    const message='A backup import or recovery operation is active. Finish or cancel it, then export again.';
    presentation.condition('file','export-busy',message);
    return Promise.resolve(Object.freeze({status:'busy'}));
  }
  // Standalone export is a read-only local snapshot. It shares the bounded file
  // processor but does not acquire the managed repository/recovery job lock, so
  // slow Device/Drive filesystem or network work cannot make Export inert.
  presentation.condition('file','export-busy','');
  localExportRequest=Exports.scope(()=>exportPortableBackup())
    .catch(error=>{
      const cancelled=error&&error.name==='AbortError';
      const message=cancelled?'Backup export cancelled.':'Backup export failed: '+String(error&&error.message||error);
      if(!portablePresentation)portablePresentation=presentation.begin('file','export',{label:'File backup',message});
      finishPortablePresentation({message,lifecycle:cancelled?'cancelled':'failed'});
      return Object.freeze({status:cancelled?'cancelled':'failed'});
    })
    .finally(()=>{localExportRequest=null;notifyStatus();});
  notifyStatus();
  return localExportRequest;
}

function cancelStandalone(reason='Standalone backup operation was cancelled by the user.') {
  let cancelled=false;if(activeImportOperation)cancelled=cancelImport(reason)||cancelled;if(localExportPromise||localExportRequest){Exports.cancel();cancelled=true;}return cancelled;
}

function normalizeImportedDailyRecordSet(records){
  const byDate=new Map();
  for(const record of records||[]){
    const clean=BackupCodec.normalizeRecord(record);
    if(!clean)throw new Error(`Imported Saved Day ${String(record&&record.date||'?')} is outside the current canonical schema.`);
    if(byDate.has(clean.date))throw new Error(`Imported Saved Day ${clean.date} is duplicated after compatibility conversion.`);
    byDate.set(clean.date,clean);
  }
  return {records:[...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date)),skipped:0,duplicates:0};
}
async function getDailyRecordDocumentsByDates(dates,options={}){return AppData.dailyRecords.documents(dates,options);}
async function storeImportedDailyRecordBatches(records,operation,reportProgress=null){
  return AppData.dailyRecords.importBatches(records,{
    signal:operation&&operation.signal,
    yieldControl:()=>yieldImport(operation&&operation.signal),
    onProgress:progress=>{if(operation&&(activeImportOperation!==operation||operation.signal?.aborted))return;const message=`Importing saved days… ${progress.committed} of ${progress.total}`;if(typeof reportProgress==='function')reportProgress(message,progress);else setLocalExportStatus(message);}
  });
}
async function applyResolvedSavedDays(resolvedPlan,operation,reportProgress=null){
  const items=Array.isArray(resolvedPlan&&resolvedPlan.savedDays)?resolvedPlan.savedDays:[];
  const planItems=new Map((resolvedPlan&&resolvedPlan.sourcePlan&&resolvedPlan.sourcePlan.savedDays||[]).map(item=>[item.date,item]));
  const recordsToSave=items.filter(item=>item.changed&&item.state==='record'&&item.record).map(item=>item.record);
  const deletionsToApply=items.filter(item=>item.changed&&item.state==='deleted');
  let batches=0;
  if(recordsToSave.length){const stored=await storeImportedDailyRecordBatches(recordsToSave,operation,reportProgress);batches=stored.batches;}
  const ledger=new Map((await AppData.deletionRecovery.savedDays()).map(entry=>[entry.date,entry]));
  for(const item of items)if(item.changed&&item.state==='record')ledger.delete(item.date);
  let deleted=0;
  if(deletionsToApply.length){
    const existing=await getDailyRecordDocumentsByDates(deletionsToApply.map(item=>item.date)),existingDates=new Set(existing.map(record=>record.date));
    for(const item of deletionsToApply){
      if(existingDates.has(item.date)){await AppData.dailyRecords.remove(item.date);deleted++;}
      ledger.set(item.date,freeze({date:item.date,deletedAt:item.deletedAt}));
    }
  }
  const expectedDeletions=[...ledger.values()].sort((a,b)=>a.date.localeCompare(b.date));
  const currentDeletions=await AppData.deletionRecovery.savedDays();
  const deletionLedgerChanged=!Canonical.same(currentDeletions,expectedDeletions);
  if(deletionLedgerChanged)await AppData.deletionRecovery.replaceSavedDays(expectedDeletions);
  // A ledger keeps its newest records within its limit; what it stored is
  // what the restore verifies.
  const storedDeletions=deletionLedgerChanged?await AppData.deletionRecovery.savedDays():currentDeletions;
  const added=items.filter(item=>item.changed&&item.state==='record'&&!item.hadLocal).length;
  const replaced=items.filter(item=>item.changed&&item.state==='record'&&item.hadLocal).length;
  const kept=items.filter(item=>{const planItem=planItems.get(item.date);return !!(planItem&&planItem.conflict&&planItem.localCandidateId&&item.candidateId===planItem.localCandidateId);}).length;
  const identical=[...planItems.values()].filter(item=>item.identical).length;
  return freeze({
    changed:recordsToSave.length>0||deletionsToApply.length>0||deletionLedgerChanged,
    count:added,replaced,deleted,kept,identical,batches,
    appliedRecords:freeze(currentDailyRecords(recordsToSave,'Resolved Saved Days')),
    expectedDeletions:freeze([...storedDeletions])
  });
}
async function applyResolvedAreaNotes(resolvedPlan){
  const changed=(resolvedPlan&&resolvedPlan.notes||[]).filter(item=>item.changed),writes=changed.filter(item=>item.state==='record'&&item.value&&typeof item.value==='object'),deletions=changed.filter(item=>item.state==='deleted'&&item.deletedAt).map(item=>freeze({key:item.key,deletedAt:item.deletedAt}));
  if(!writes.length&&!deletions.length)return {message:'',changed:false,expected:null,expectedDeletions:null,count:0,deleted:0};
  requireBackupMutationControl('reconciling ongoing notes');
  const payload=Object.create(null);for(const item of writes)payload[item.key]=item.value;
  const committed=await reconcileAreaNotes(AppData.notes.normalizePayload(payload),deletions);
  if(!committed||typeof committed!=='object'||Array.isArray(committed))throw new Error('Ongoing-note reconciliation did not return a canonical committed payload.');
  const expected=AppData.notes.normalizePayload(committed),expectedDeletions=freeze([...(await AppData.deletionRecovery.areaNotes())]),count=writes.length,deleted=deletions.length;
  return {message:` and ${count+deleted} ongoing subject note change${count+deleted===1?'':'s'}`,changed:true,expected,expectedDeletions,count,deleted};
}
async function applyResolvedActiveSession(resolvedPlan){
  const resolved=resolvedPlan&&resolvedPlan.activeSession;
  if(!resolved||!resolved.changed||!resolved.value)return {message:'',changed:false,expected:null};
  requireBackupMutationControl('reconciling the active session');
  const expected=ActiveSessionCodec.sanitizeCurrent(resolved.value);
  if(!expected)throw new Error('Resolved Active Session is invalid.');
  const scheduleText=expected.scheduleText||scheduleRead();
  await restoreSessionState(expected,scheduleText);
  return {message:' and active session',changed:true,expected,scheduleText};
}
function staleReconciliationError(){
  const error=new Error('Local Study Director data changed while differences were being reviewed. The comparison must be rebuilt from the latest saved state.');
  error.code='STUDY_DIRECTOR_RECONCILIATION_STALE';
  return error;
}
function restoreRelevantDates(parsed){
  const records=normalizeImportedDailyRecordSet(parsed&&parsed.records||[]).records;
  const deletions=parsed&&parsed.protectedCheckpointManifest&&Array.isArray(parsed.protectedCheckpointManifest.savedDayDeletions)?parsed.protectedCheckpointManifest.savedDayDeletions:[];
  return freeze([...new Set([...records.map(record=>record.date),...deletions.map(entry=>String(entry&&entry.date||''))].filter(Boolean))].sort());
}
function restorePreflightFailure(code,stage,message,error=null){
  const suffix=error?`: ${error&&error.message||error}`:'';
  const failure=new Error(`${message}${suffix}`);
  failure.code=String(code||'RESTORE_PREFLIGHT_FAILED');
  failure.backupStage=String(stage||'restore-preflight');
  failure.diagnosticReason=String(stage||'restore-preflight');
  return failure;
}
async function runRestorePreflightStage(stage,code,message,operation){
  const name=String(stage||'stage');
  OperationDiagnostics.mark(`restore-preflight-${name}-start`);
  try{
    const result=await operation();
    OperationDiagnostics.mark(`restore-preflight-${name}-complete`);
    return result;
  }catch(error){
    if(error&&((error.name==='AbortError')||error.code==='STUDY_DIRECTOR_IMPORT_CANCELLED'))throw error;
    OperationDiagnostics.mark(`restore-preflight-${name}-failed`,{errorCode:String(code||'RESTORE_PREFLIGHT_FAILED')});
    throw restorePreflightFailure(code,name,message,error);
  }
}
async function readCanonicalActiveSession(){
  const loaded=await AppData.activeSession.load(0,{strict:true});
  if(loaded?.ok!==true||loaded.error)throw loaded?.error||new Error('The active session could not be read completely for recovery.');
  return loaded;
}
async function flushRestorePreflightState(signal){
  throwIfImportCancelled(signal);
  await runRestorePreflightStage('ownership','RESTORE_PREFLIGHT_OWNERSHIP_LOST','Study Director write control is unavailable before restore reconciliation.',async()=>{
    assertAuthority();
    requireBackupMutationControl('preparing restore reconciliation');
    return true;
  });
  await runRestorePreflightStage('notes','RESTORE_PREFLIGHT_NOTES_FAILED','Ongoing Notes could not be safely saved before comparing backup differences.',async()=>{
    await AppData.notes.flush({strict:true});
    const noteFailure=AppData.notes.failure();
    if(noteFailure&&noteFailure.failed)throw new Error(noteFailure.message||'Ongoing Notes are not safely stored yet.');
    return true;
  });
  await runRestorePreflightStage('deletions','RESTORE_PREFLIGHT_DELETION_FAILED','Deletion recovery state could not be safely saved before comparing backup differences.',async()=>{if(await AppData.deletionRecovery.flush()!==true)throw new Error('Pending deletion recovery remains incomplete.');return true;});
  await runRestorePreflightStage('personal','RESTORE_PREFLIGHT_PERSONAL_FAILED','Plan and preference data could not be safely settled before comparing backup differences.',()=>personalSettle());
  await runRestorePreflightStage('session-save','RESTORE_PREFLIGHT_SESSION_SAVE_FAILED','The active session could not be safely saved before comparing backup differences.',async()=>{
    if(!(appCanMutate()&&TASKS.length))return false;
    cancelLiveDraftSave();
    const snapshot=captureSessionSnapshot(),candidate=snapshot?activeSessionPayload(snapshot):null;
    if(!candidate)return false;
    const result=await AppData.activeSession.save(candidate);
    if(!result||!result.ok)throw result&&result.error||new Error('active session save failed');
    return true;
  });
  await runRestorePreflightStage('session-settle','RESTORE_PREFLIGHT_SESSION_SETTLE_FAILED','The active session could not finish settling before reconciliation.',()=>AppData.activeSession.settled());
  await runRestorePreflightStage('session-read','RESTORE_PREFLIGHT_SESSION_READ_FAILED','The active session could not be read safely before reconciliation.',async()=>{
    const loaded=await readCanonicalActiveSession();
    return loaded;
  });
  throwIfImportCancelled(signal);
  return true;
}
// A missing-only restore cannot change today's session, so the running timer's
// own saves are not a reason to rebuild its comparison.
async function captureRestoreReconciliationRevision(relevantDates,{session:includeSession=true}={}){
  const [records,notesRaw,loadedSession,personalData]=await Promise.all([
    getDailyRecordDocumentsByDates(relevantDates||[]),
    AppData.notes.readFreshPayload(),
    includeSession?readCanonicalActiveSession():null,
    personalExport({flush:false})
  ]);
  const notes=AppData.notes.normalizePayload(notesRaw),noteState=Object.keys(notes).sort().map(key=>{
    const value=notes[key]||{};return [key,String(value.updatedAt||''),String(value.label||''),String(value.text||'')];
  });
  const recordState=currentDailyRecords(records||[],'Restore reconciliation Daily Records').sort((a,b)=>a.date.localeCompare(b.date));
  const session=loadedSession&&loadedSession.value?ActiveSessionCodec.sanitizeCurrent(loadedSession.value):null;
  return JSON.stringify([recordState,noteState,session,personalData||null]);
}
async function buildStableRestoreImpact(parsed,preview,signal,options={}){
  const relevantDates=options.note?freeze([]):restoreRelevantDates(parsed);
  for(let attempt=0;attempt<3;attempt+=1){
    throwIfImportAborted(signal);
    const scope={session:options.missingOnly!==true&&!options.note},before=await captureRestoreReconciliationRevision(relevantDates,scope);
    const assetAssessment=await assessImportedAssets(parsed,signal);
    const impact=await restoreImpactPreview(parsed,preview,assetAssessment,options);
    const after=await captureRestoreReconciliationRevision(relevantDates,scope);
    if(before===after)return freeze({impact:freeze({...impact,assetAssessment}),revision:after,relevantDates,scope});
    await yieldImport(signal);
  }
  throw staleReconciliationError();
}
async function assertRestoreReconciliationCurrent(expectedRevision,relevantDates,scope){
  if(expectedRevision!==await captureRestoreReconciliationRevision(relevantDates,scope))throw staleReconciliationError();
  return true;
}

async function buildRestoreReconciliationPlan(parsed,preview,{missingOnly=false,note=''}={}){
  // A one-note restore compares only that note: no Saved Days, deletions or
  // session, and every other note stays exactly as it is on this device.
  const records=note?[]:normalizeImportedDailyRecordSet(parsed&&parsed.records||[]).records;
  const checkpointDeletions=!note&&parsed&&parsed.protectedCheckpointManifest&&Array.isArray(parsed.protectedCheckpointManifest.savedDayDeletions)?parsed.protectedCheckpointManifest.savedDayDeletions:[];
  const checkpointNoteDeletions=!note&&parsed&&parsed.protectedCheckpointManifest&&Array.isArray(parsed.protectedCheckpointManifest.areaNoteDeletions)?parsed.protectedCheckpointManifest.areaNoteDeletions:[];
  const relevantDates=[...new Set([...records.map(record=>record.date),...checkpointDeletions.map(entry=>entry.date)])];
  const localRecords=currentDailyRecords(await getDailyRecordDocumentsByDates(relevantDates),'Local reconciliation Daily Records');
  const allLocalDeletions=await AppData.deletionRecovery.savedDays(),relevantDateSet=new Set(relevantDates);
  const localDeletions=allLocalDeletions.filter(entry=>relevantDateSet.has(entry.date));
  const localNotes=AppData.notes.normalizePayload(await AppData.notes.readFreshPayload()),allLocalNoteDeletions=await AppData.deletionRecovery.areaNotes();
  // Missing-only recovery adds back what this device lacks (Saved Days,
  // attachments) and never offers the backup's notes or session.
  const backupNotes=missingOnly?Object.create(null):AppData.notes.alignByTitle(parsed&&parsed.data&&parsed.data.areaNotes||{},allLocalNoteDeletions.map(entry=>entry.key)),incomingNotes=note?Object.create(null):backupNotes;
  if(note&&Object.prototype.hasOwnProperty.call(backupNotes,note))incomingNotes[note]=backupNotes[note];
  const loadedSession=await readCanonicalActiveSession(),localSession=loadedSession&&loadedSession.value||null;
  const currentCheckpoint=Number(parsed&&parsed.formatVersion)>=15&&!!parsed.protectedCheckpointManifest;
  const rawIncomingSession=parsed&&parsed.importedActiveSession||null;
  const incomingSession=note?null:currentCheckpoint?rawIncomingSession:(rawIncomingSession&&rawIncomingSession.date===todayISO()?rawIncomingSession:null);
  const backupAt=Date.parse(String(preview&&preview.exportedAt||'')),incomingLabel=note&&Number.isFinite(backupAt)?`Backup from ${new Date(backupAt).toLocaleString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}`:currentCheckpoint?'Backup copy':(preview&&preview.filename||'Backup file');
  const checkpointId=String(parsed&&parsed.protectedCheckpointManifest&&parsed.protectedCheckpointManifest.checkpointId||preview&&preview.checkpoint&&preview.checkpoint.checkpointId||'incoming');
  return Reconciliation.createPlan({
    local:{id:'local',label:'This device',savedDays:localRecords,savedDayDeletions:localDeletions,notes:localNotes,noteDeletions:allLocalNoteDeletions,activeSession:localSession},
    incoming:{id:checkpointId,label:incomingLabel,savedDays:records,savedDayDeletions:checkpointDeletions,notes:incomingNotes,noteDeletions:missingOnly?[]:checkpointNoteDeletions,activeSession:missingOnly?null:incomingSession}
  });
}
function savedDayChoiceLabel(candidate){
  const source=candidate.sources.find(item=>item.local)||candidate.sources[0],local=!!source&&source.local;
  if(candidate.kind==='deleted')return local?'Keep deleted':`Apply deletion from ${source?.label||'backup'}`;
  return local?'Keep this device’s Saved Day':`Use ${source?.label||'Backup copy'} Saved Day`;
}
function savedDayDecisionTimestamp(value){
  const parsed=Date.parse(String(value||''));if(!Number.isFinite(parsed))return '';
  try{return new Date(parsed).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});}catch{return new Date(parsed).toISOString();}
}
function savedDayChoiceDescription(candidate){
  const source=candidate.sources.find(item=>candidate.local?item.local:!item.local)||candidate.sources[0],origin=candidate.local?'This device':(source?.label||'Backup copy');
  if(candidate.kind==='deleted'){
    const at=savedDayDecisionTimestamp(candidate.deletedAt);return `${origin} · deleted${at?` ${at}`:''}.`;
  }
  const record=candidate.record||candidate.value||{},stamp=savedDayDecisionTimestamp(record.updatedAt||record.savedAt),blocks=Array.isArray(record.schedule)?record.schedule.length:0,quality=Number(record.studyQuality),parts=[origin];
  if(stamp)parts.push(`saved ${stamp}`);
  if(blocks)parts.push(`${blocks} planned block${blocks===1?'':'s'}`);
  if(String(record.reflection||'').trim())parts.push('reflection saved');
  if(Number.isInteger(quality)&&quality>=1&&quality<=5)parts.push(`quality ${quality}/5`);
  return `${parts.join(' · ')}.`;
}
function savedDayRecordPair(item){
  if(!item?.conflict)return null;
  const local=item.candidates.find(candidate=>candidate.local&&candidate.kind==='record')||null,incoming=item.candidates.find(candidate=>!candidate.local&&candidate.kind==='record')||null;
  return local&&incoming?freeze({local,incoming}):null;
}
function savedDayStudyState(record){
  if(!record||record.recordKind!=='study')return null;
  const {reflection,updatedAt,...state}=record;return state;
}
function savedDayNeedsWholeDecision(item){
  if(!item?.conflict)return false;
  const pair=savedDayRecordPair(item);if(!pair)return true;
  const localKind=pair.local.record?.recordKind,incomingKind=pair.incoming.record?.recordKind;
  if(localKind==='diary'&&incomingKind==='diary')return false;
  if(localKind!==incomingKind&&[localKind,incomingKind].includes('study')&&[localKind,incomingKind].includes('diary'))return false;
  if(localKind==='study'&&incomingKind==='study'&&Canonical.same(savedDayStudyState(pair.local.record),savedDayStudyState(pair.incoming.record)))return false;
  return true;
}
function savedDayPreferredCandidate(item,decisions={}){
  const selected=decisions&&decisions[item.decisionKey];if(selected){const found=item.candidates.find(candidate=>candidate.id===selected);if(found)return found;}
  const pair=savedDayRecordPair(item);
  if(pair){
    const study=[pair.local,pair.incoming].find(candidate=>candidate.record?.recordKind==='study'),diary=[pair.local,pair.incoming].find(candidate=>candidate.record?.recordKind==='diary');
    if(study&&diary)return study;
  }
  return item.candidates.find(candidate=>candidate.id===item.defaultCandidateId)||item.candidates[0]||null;
}
function savedDayReflectionConflicts(plan){
  const conflicts=[];
  for(const item of plan.savedDays){
    const pair=savedDayRecordPair(item);if(!pair)continue;
    const kinds=[pair.local.record?.recordKind,pair.incoming.record?.recordKind];if(kinds.some(kind=>!['study','diary'].includes(kind)))continue;
    const localValue=String(pair.local.record?.reflection||''),incomingValue=String(pair.incoming.record?.reflection||'');if(localValue===incomingValue)continue;
    conflicts.push(freeze({key:item.date,label:`Diary · ${item.date}`,localCandidateId:pair.local.id,incomingCandidateId:pair.incoming.id,localValue,incomingValue,incomingLabel:pair.incoming.sources[0]?.label||'Backup copy',ancestorAvailable:false,ancestorValue:'',requireContent:kinds.every(kind=>kind==='diary')}));
  }
  return freeze(conflicts);
}
function savedDayReflectionSelections(plan,result,decisions={}){
  const out=Object.create(null),notes=result&&result.notes&&typeof result.notes==='object'?result.notes:{};
  for(const item of plan.savedDays){
    const resolved=notes[item.date];if(!resolved)continue;
    const base=savedDayPreferredCandidate(item,decisions);if(!base||base.kind!=='record'||!base.record)throw new Error(`Saved Day ${item.date} has no valid reflection reconciliation base.`);
    const text=String(resolved.text||''),pair=savedDayRecordPair(item),mixedKinds=pair&&pair.local.record?.recordKind!==pair.incoming.record?.recordKind;
    if(String(base.record.reflection||'')===text){out[item.date]=base.id;continue;}
    if(pair&&!mixedKinds&&!savedDayNeedsWholeDecision(item)){
      if(String(pair.local.record?.reflection||'')===text){out[item.date]=pair.local.id;continue;}
      if(String(pair.incoming.record?.reflection||'')===text){out[item.date]=pair.incoming.id;continue;}
    }
    out[item.date]=freeze({value:freeze({...base.record,reflection:text,updatedAt:new Date().toISOString()})});
  }
  return freeze(out);
}
function savedDayBulkDecisionGroup(plan){
  const conflicts=plan.savedDays.filter(savedDayNeedsWholeDecision);if(conflicts.length<2)return null;
  const localValues=Object.create(null),incomingValues=Object.create(null),reviewValues=Object.create(null);
  for(const item of conflicts){
    const local=item.candidates.find(candidate=>candidate.local),incoming=item.candidates.find(candidate=>!candidate.local);
    if(!local||!incoming)return null;
    localValues[item.decisionKey]=local.id;incomingValues[item.decisionKey]=incoming.id;reviewValues[item.decisionKey]=item.defaultCandidateId;
  }
  const count=conflicts.length;
  return freeze({
    id:'savedDaysBulk',label:`Saved-Day conflicts · ${count} days`,defaultValue:'review',
    description:'Choose a starting point for all conflicting Saved Days. Every day remains individually adjustable below. Differing reflections are reviewed separately before anything is applied.',
    choices:freeze([
      freeze({value:'local',label:'Use this device for all',description:`Start all ${count} conflicting days from this device’s study-day state.`,applyValues:freeze(localValues)}),
      freeze({value:'incoming',label:'Use backup for all',description:`Start all ${count} conflicting days from the backup copy, including explicit deletions.`,applyValues:freeze(incomingValues)}),
      freeze({value:'review',label:'Review individually',description:'Use the safe per-day defaults and review each conflicting day one by one.',applyValues:freeze(reviewValues)})
    ])
  });
}
function noteChoiceLabel(candidate){
  const source=candidate.sources.find(item=>item.local)||candidate.sources[0],local=!!source&&source.local;
  if(candidate.kind==='deleted')return local?'Keep note deleted':`Apply deletion from ${source?.label||'backup'}`;
  return local?'Keep this device’s note':`Use note from ${source?.label||'backup'}`;
}
function activeSessionChoiceLabel(candidate){
  const source=candidate.sources.find(item=>item.local)||candidate.sources[0];
  return source?.local?'Keep this device’s session':`Use session from ${source?.label||'backup'}`;
}
async function noteReconciliationAncestor(stored,keys=[]){
  const snapshot=candidateSnapshotState(stored),manifest=snapshot&&snapshot.provenance&&snapshot.provenance.repositoryManifest,repositoryBaseId=String(manifest&&manifest.reconciliationBaseId||'');if(!repositoryBaseId)return null;
  const ancestorIds=Array.isArray(manifest.reconciliationAncestorIds)&&manifest.reconciliationAncestorIds.length?manifest.reconciliationAncestorIds:[repositoryBaseId];
  const localBase=await AppData.reconciliationBase.read().catch(()=>null),localBaseId=String(localBase&&localBase.checkpointId||'');
  if(!localBase||!ancestorIds.includes(localBaseId))return null;
  const notes=keys.length?await AppData.reconciliationBase.readNotes(keys).catch(()=>freeze({})):freeze({});
  return freeze({checkpointId:localBaseId,notes});
}
function noteReconciliationConflicts(plan,ancestor=null){
  const conflicts=[];
  for(const item of plan.notes){
    if(!item.conflict||!item.localCandidateId)continue;
    const local=item.candidates.find(candidate=>candidate.id===item.localCandidateId),incoming=item.candidates.filter(candidate=>!candidate.local);
    if(!local||local.kind!=='record'||incoming.length!==1||incoming[0].kind!=='record')continue;
    const remote=incoming[0],localText=String(local.value&&local.value.text||''),incomingText=String(remote.value&&remote.value.text||'');
    if(localText===incomingText)continue;
    const ancestorAvailable=!!(ancestor&&ancestor.notes&&Object.prototype.hasOwnProperty.call(ancestor.notes,item.key));
    conflicts.push(freeze({key:item.key,label:String(local.value&&local.value.key||remote.value&&remote.value.key||item.key),localCandidateId:local.id,incomingCandidateId:remote.id,localValue:localText,incomingValue:incomingText,incomingLabel:remote.sources[0]?.label||'Backup copy',ancestorAvailable,ancestorValue:ancestorAvailable?String(ancestor.notes[item.key]||''):''}));
  }
  return freeze(conflicts);
}
function noteReconciliationSelections(plan,result){
  const decisions=Object.create(null),notes=result&&result.notes&&typeof result.notes==='object'?result.notes:{};
  for(const item of plan.notes){
    const resolved=notes[item.key];if(!resolved)continue;
    const text=String(resolved.text||''),matching=item.candidates.find(candidate=>String(candidate.value&&candidate.value.text||'')===text);
    if(matching){decisions[item.key]=matching.id;continue;}
    const local=item.candidates.find(candidate=>candidate.id===item.localCandidateId),fallback=local||item.candidates[0];
    if(!fallback||!fallback.value||typeof fallback.value!=='object')throw new Error(`Ongoing Note ${item.key} has no valid reconciliation base.`);
    decisions[item.key]=freeze({value:freeze({...fallback.value,key:item.key,text,updatedAt:new Date().toISOString()})});
  }
  return freeze(decisions);
}
function reconciliationSelections(plan,decisions,noteDecisions=freeze({}),reflectionDecisions=freeze({})){
  const savedDays=Object.create(null),notes=Object.assign(Object.create(null),noteDecisions||{});
  for(const item of plan.savedDays)if(item.conflict)savedDays[item.date]=Object.prototype.hasOwnProperty.call(reflectionDecisions,item.date)?reflectionDecisions[item.date]:(decisions[item.decisionKey]||savedDayPreferredCandidate(item,decisions)?.id||item.defaultCandidateId);
  for(const item of plan.notes)if(item.conflict&&!Object.prototype.hasOwnProperty.call(notes,item.key)&&item.candidates.some(candidate=>candidate.kind==='deleted'))notes[item.key]=decisions[item.decisionKey]||item.defaultCandidateId;
  return freeze({savedDays:freeze(savedDays),notes:freeze(notes),activeSession:plan.activeSession.conflict?(decisions.activeSession||plan.activeSession.defaultCandidateId):plan.activeSession.defaultCandidateId});
}
function backupCandidatePreview(parsed,file,metadata={}){
  const manifest=parsed&&parsed.manifest&&typeof parsed.manifest==='object'?parsed.manifest:{};
  const data=parsed&&parsed.data&&!Array.isArray(parsed.data)&&typeof parsed.data==='object'?parsed.data:{};
  const counts=BackupCodec.countShape(parsed&&parsed.counts);
  const exportedAtValue=manifest.exportedAt||data.exportedAt||null;
  const exportedAt=exportedAtValue&&Number.isFinite(Date.parse(exportedAtValue))?new Date(exportedAtValue).toISOString():null;
  const filename=clampText(metadata.filename||file&&file.name||'',240);
  const report=parsed&&parsed.report&&typeof parsed.report==='object'?parsed.report:{};
  const dates=(parsed&&Array.isArray(parsed.records)?parsed.records:[]).map(record=>String(record&&record.date||'')).filter(Boolean).sort();
  return Object.freeze({
    filename,
    exportedAt,
    appVersion:clampText(manifest.appVersion||data.appVersion||'',40)||null,
    formatVersion:Number(parsed&&parsed.formatVersion)||0,
    counts:Object.freeze({...counts}),
    assets:Object.freeze({total:(parsed.assetDescriptors||[]).length,library:(parsed.assetDescriptors||[]).filter(item=>item.library).length,missing:(parsed.assetDescriptors||[]).filter(item=>item.missing).length}),
    legacy:!!report.legacy,
    ignoredTombstones:Number(report.ignoredTombstones)||0,
    ignoredOrInvalid:(Number(report.skipped)||0)+(Number(report.duplicates)||0),
    dateRange:dates.length?Object.freeze({first:dates[0],last:dates[dates.length-1]}):null,
    checksumAlgorithm:clampText(manifest.checksumAlgorithm||'',20)||null,
    authenticated:metadata.encrypted===true,
    encrypted:metadata.encrypted===true,
    checkpoint:manifest.checkpoint?Object.freeze({checkpointId:String(manifest.checkpoint.checkpointId||''),createdAt:String(manifest.checkpoint.createdAt||''),originInstallationId:String(manifest.checkpoint.originInstallationId||'')}):null,
    reconciliationCapable:Number(parsed&&parsed.formatVersion)>=15&&!!parsed&&!!parsed.protectedCheckpointManifest,
    captureAuthority:String(parsed&&parsed.captureAuthority||'unknown'),
    size:Math.max(0,Number(metadata.size!==undefined?metadata.size:file&&file.size)||0)
  });
}
async function restoreImpactPreview(parsed,preview,assetAssessment=null,options={}){
  const reconciliationPlan=await buildRestoreReconciliationPlan(parsed,preview,options);
  const summary=Reconciliation.summarizePlan(reconciliationPlan);
  const currentCheckpoint=Number(parsed&&parsed.formatVersion)>=15&&!!parsed.protectedCheckpointManifest;
  return freeze({
    reconciliationCapable:currentCheckpoint,reconciliationPlan,
    savedDays:summary.savedDays,
    notes:summary.notes,
    activeSession:summary.activeSession,
    assets:freeze({total:(parsed.assetDescriptors||[]).length,available:(assetAssessment&&assetAssessment.available||[]).length,missing:(assetAssessment&&assetAssessment.missing||[]).length,newItems:(assetAssessment&&assetAssessment.toWrite||[]).length,reused:Number(assetAssessment&&assetAssessment.reused)||0}),
    ignoredOrInvalid:Number(preview.ignoredOrInvalid)||0
  });
}
function restoreModeForBackup(impact){
  if(!impact.reconciliationCapable){requireNoActiveSession('importing this older backup');return 'import';}
  return 'reconcile';
}
function restoreDecisionSetup(parsed,impact,mode='import',localPersonal=null){
  const plan=impact.reconciliationPlan,groups=[],defaults={plans:'keep',personalSettings:'keep',safetyCopy:false};
  if(parsed.importedPersonalData){
    if(!localPersonal||!Canonical.same(localPersonal.plans,parsed.importedPersonalData.plans))groups.push({id:'plans',label:'Plan draft and saved plans',defaultValue:'keep',choices:[{value:'keep',label:'Keep current plans',description:'Preserve this device’s current draft, saved plans and default.'},{value:'replace',label:'Use incoming plans',description:`Use the incoming draft and saved-plan collection (${parsed.importedPersonalData.plans.savedPlans.length} saved plans).`}]});
    if(!localPersonal||!Canonical.same(localPersonal.preferences,parsed.importedPersonalData.preferences))groups.push({id:'personalSettings',label:'Personal and display settings',defaultValue:'keep',choices:[{value:'keep',label:'Keep current settings',description:'Preserve this device’s name and preferences.'},{value:'replace',label:'Use incoming settings',description:'Use the incoming name, theme, skin, text size, quote, reminders and supported preferences.'}]});
  }
  const savedDayBulk=savedDayBulkDecisionGroup(plan);if(savedDayBulk)groups.push(savedDayBulk);
  for(const item of plan.savedDays){
    if(!savedDayNeedsWholeDecision(item))continue;
    groups.push({
      id:item.decisionKey,label:`Saved Day · ${item.date}`,defaultValue:item.defaultCandidateId,
      description:'Choose the study-day state for this date. Differing reflections are reviewed separately next. Deletion is explicit; absence never means deletion.',
      choices:item.candidates.map(candidate=>({value:candidate.id,label:savedDayChoiceLabel(candidate),description:savedDayChoiceDescription(candidate)}))
    });
  }
  for(const item of plan.notes){
    if(!item.conflict||!item.candidates.some(candidate=>candidate.kind==='deleted'))continue;
    groups.push({
      id:item.decisionKey,label:`Ongoing Note · ${item.key}`,defaultValue:item.defaultCandidateId,
      description:'This note was explicitly deleted on one side. Choose whether the canonical note should exist or remain deleted.',
      choices:item.candidates.map(candidate=>({value:candidate.id,label:noteChoiceLabel(candidate),description:candidate.kind==='deleted'?'Keep this Ongoing Note deleted.':'Use this complete Ongoing Note.'}))
    });
  }
  if(plan.activeSession.conflict){
    groups.push({
      id:'activeSession',label:'Active / suspended session',defaultValue:plan.activeSession.defaultCandidateId,
      description:'This device and the backup contain different live-session states. Choose one whole session.',
      choices:plan.activeSession.candidates.map(candidate=>({value:candidate.id,label:activeSessionChoiceLabel(candidate),description:'Use this complete Plan, progress, timer and active-session reflection state.'}))
    });
  }
  return freeze({groups:freeze(groups.map(group=>freeze({...group,choices:freeze(group.choices.map(choice=>freeze(choice)))}))),defaults:freeze(defaults)});
}
async function assessImportedAssets(parsed,signal){
  if(!portableAssets||Number(parsed&&parsed.formatVersion)<10)return freeze({available:freeze([]),missing:freeze([]),toWrite:freeze([]),reused:0});
  const available=Array.isArray(parsed.importedAssets)?parsed.importedAssets:[],missing=(parsed.assetDescriptors||[]).filter(item=>item&&item.missing===true),localRows=await AssetData.list(),localById=new Map(localRows.map(row=>[row.id,row])),verifiedPhysical=new Set();
  const toWrite=[];let reused=0;
  for(const item of available){
    const row=localById.get(item.assetId);if(!row){toWrite.push(item);continue;}
    const physicalKey=String(row.file||item.assetId)+'\u0000'+String(item.checksum||'')+'\u0000'+Number(item.size);
    if(!verifiedPhysical.has(physicalKey)){
      const local=await AssetData.get(item.assetId);
      if(!(local instanceof Blob)){toWrite.push(item);continue;}
      const localChecksum=await BackupCodec.checksumBlob(local,{signal});
      if(local.size!==Number(item.size)||localChecksum!==item.checksum)throw new Error(`Backup attachment identity collision detected for ${item.assetId}; local bytes differ from the verified backup.`);
      verifiedPhysical.add(physicalKey);
    }
    reused++;
  }
  return freeze({available:freeze([...available]),missing:freeze([...missing]),toWrite:freeze(toWrite),reused});
}
async function resolvedAssetReferenceIds(resolvedPlan,signal){
  if(!portableAssets)return freeze([]);
  const references=new Set(),collect=value=>{for(const id of BackupCodec.assetIds(value))references.add(id);};
  const recordSource=await AppData.dailyRecords.backupDates(),recordDates=Array.isArray(recordSource&&recordSource.dates)?recordSource.dates:[];
  const records=new Map((await getDailyRecordDocumentsByDates(recordDates)).map(record=>[record.date,record]));
  for(const item of resolvedPlan&&resolvedPlan.savedDays||[]){
    if(item.state==='deleted')records.delete(item.date);
    else if(item.state==='record'&&item.record)records.set(item.date,item.record);
  }
  for(const record of records.values()){throwIfImportAborted(signal);collect(record);}
  for(const item of resolvedPlan&&resolvedPlan.notes||[]){throwIfImportAborted(signal);if(item.value)collect(item.value);}
  if(resolvedPlan&&resolvedPlan.activeSession&&resolvedPlan.activeSession.value)collect(resolvedPlan.activeSession.value);
  return freeze([...references].sort());
}
async function buildAttachmentDeletionPlan(parsed,resolvedPlan,assessment,decisions=freeze({}),signal=null,resolvedReferences=null){
  if(!portableAssets)return freeze({conflicts:freeze([]),states:freeze({}),expectedDeletions:freeze([]),deleteLocalIds:freeze([]),references:freeze([])});
  const references=Array.isArray(resolvedReferences)?resolvedReferences:await resolvedAssetReferenceIds(resolvedPlan,signal),referenceSet=new Set(references);
  const localRows=await AssetData.list(),localById=new Map(localRows.map(row=>[row.id,row]));
  const incomingAvailable=Array.isArray(assessment&&assessment.available)?assessment.available:[],incomingById=new Map(incomingAvailable.map(item=>[item.assetId,item]));
  const localDeletions=await AppData.deletionRecovery.attachments(),incomingDeletions=parsed&&parsed.protectedCheckpointManifest&&Array.isArray(parsed.protectedCheckpointManifest.attachmentDeletions)?parsed.protectedCheckpointManifest.attachmentDeletions:[];
  const localDeleted=new Map(localDeletions.map(item=>[item.assetId,item])),incomingDeleted=new Map(incomingDeletions.map(item=>[item.assetId,item]));
  const ids=new Set([...localDeleted.keys(),...incomingDeleted.keys(),...localRows.filter(row=>row.library).map(row=>row.id),...incomingAvailable.filter(item=>item.library).map(item=>item.assetId)]),states=Object.create(null),conflicts=[];
  for(const id of [...ids].sort()){
    if(referenceSet.has(id)){states[id]='record';continue;}
    const localRow=localById.get(id),incomingRow=incomingById.get(id),localDeletion=localDeleted.get(id),incomingDeletion=incomingDeleted.get(id),localLibrary=localRow?.library===true,incomingLibrary=incomingRow?.library===true;
    const decision=String(decisions[id]||'');
    if(localDeletion&&incomingLibrary){
      if(decision==='record'||decision==='deleted')states[id]=decision;
      else{states[id]='deleted';conflicts.push(freeze({assetId:id,label:incomingRow.name||id,defaultValue:'deleted',localState:'deleted',incomingState:'record'}));}
      continue;
    }
    if(localLibrary&&incomingDeletion){
      if(decision==='record'||decision==='deleted')states[id]=decision;
      else{states[id]='record';conflicts.push(freeze({assetId:id,label:localRow.name||id,defaultValue:'record',localState:'record',incomingState:'deleted'}));}
      continue;
    }
    if(localDeletion||incomingDeletion)states[id]='deleted';
    else if(localLibrary||incomingLibrary)states[id]='record';
  }
  const deletionMap=new Map();
  for(const [id,state] of Object.entries(states))if(state==='deleted'){
    const a=localDeleted.get(id),b=incomingDeleted.get(id),latest=!a?b:!b?a:(Date.parse(a.deletedAt)>=Date.parse(b.deletedAt)?a:b);if(latest)deletionMap.set(id,latest);
  }
  const deleteLocalIds=[...Object.entries(states)].filter(([id,state])=>state==='deleted'&&localById.get(id)?.library===true&&!referenceSet.has(id)).map(([id])=>id).sort();
  const expectedDeletions=freeze([...deletionMap.values()].sort((a,b)=>a.assetId.localeCompare(b.assetId)));
  return freeze({conflicts:freeze(conflicts),states:freeze(states),expectedDeletions,deleteLocalIds:freeze(deleteLocalIds),references,deletionLedgerChanged:!Canonical.same(localDeletions,expectedDeletions)});
}
// A one-note restore adds back only the images its notes need. The Attachment
// Library and its deletion records stay as they are, except that an image the
// restored note uses again is no longer recorded as deleted.
async function noteAttachmentPlan(references){
  const referenceSet=new Set(references),localDeletions=await AppData.deletionRecovery.attachments(),expectedDeletions=freeze(localDeletions.filter(item=>!referenceSet.has(item.assetId)));
  return freeze({conflicts:freeze([]),states:freeze(Object.fromEntries(references.map(id=>[id,'record']))),expectedDeletions,deleteLocalIds:freeze([]),references,deletionLedgerChanged:expectedDeletions.length!==localDeletions.length});
}
function attachmentDeletionDecisionGroups(plan){
  return freeze((plan&&plan.conflicts||[]).map(item=>freeze({id:`attachment__${item.assetId}`,label:`Attachment Library · ${item.label}`,defaultValue:item.defaultValue,description:'This standalone Attachment Library identity was explicitly deleted on one side. Referenced attachments are never deleted by this choice.',choices:freeze([
    freeze({value:'record',label:'Keep attachment',description:'Keep this independently retained Attachment Library item.'}),
    freeze({value:'deleted',label:'Keep deleted',description:'Keep the explicit deletion and prevent an older library-only copy from returning.'})
  ])})));
}
async function selectResolvedImportedAssets(assessment,resolvedPlan,signal,attachmentPlan=null,resolvedReferences=null){
  if(!portableAssets||!assessment)return freeze({available:freeze([]),toWrite:freeze([]),reused:0,references:freeze([])});
  const references=Array.isArray(resolvedReferences)?resolvedReferences:await resolvedAssetReferenceIds(resolvedPlan,signal),referenceSet=new Set(references);
  const available=Array.isArray(assessment.available)?assessment.available:[],missing=Array.isArray(assessment.missing)?assessment.missing:[];
  const availableById=new Map(available.map(item=>[item.assetId,item])),knownCheckpointIds=new Set([...available.map(item=>item.assetId),...missing.map(item=>item.assetId)]);
  for(const id of references){
    if(!knownCheckpointIds.has(id)||availableById.has(id))continue;
    let local=null;try{local=await AssetData.get(id);}catch(error){throw new Error(`Resolved data requires attachment ${id}, but the local copy could not be verified.`,{cause:error});}
    if(!(local instanceof Blob))throw new Error(`Resolved data requires attachment ${id}, but the verified checkpoint does not contain its bytes.`);
  }
  const states=attachmentPlan&&attachmentPlan.states||{};
  const selected=available.filter(item=>referenceSet.has(item.assetId)||(item.library===true&&states[item.assetId]==='record'));
  const toWriteIds=new Set((assessment.toWrite||[]).map(item=>item.assetId)),toWrite=selected.filter(item=>toWriteIds.has(item.assetId));
  return freeze({available:freeze(selected),toWrite:freeze(toWrite),reused:selected.length-toWrite.length,references});
}
async function commitImportedAssets(selection,signal,attachmentPlan=null){
  if(!portableAssets||!selection)return freeze({written:0,published:0,reused:0,deleted:0,expected:freeze([]),expectedRemovedIds:freeze([]),references:freeze([]),expectedDeletions:freeze([])});
  throwIfImportAborted(signal);
  const selected=selection.available||freeze([]),published=selected.length;
  if(published)await AssetData.importAll(selected,signal);
  throwIfImportAborted(signal);
  const deleteLocalIds=attachmentPlan&&attachmentPlan.deleteLocalIds||freeze([]);let deleted=0;
  if(deleteLocalIds.length){const result=await AssetData.removeMetadata(deleteLocalIds);deleted=Math.max(0,Number(result&&result.removed)||0);}
  const expectedDeletions=attachmentPlan&&attachmentPlan.expectedDeletions||freeze([]);
  await AppData.deletionRecovery.replaceAttachments(expectedDeletions);
  const storedDeletions=freeze([...(await AppData.deletionRecovery.attachments())]);
  return freeze({written:(selection.toWrite||[]).length,published,reused:Number(selection.reused)||0,deleted,changed:!!(published||deleted||attachmentPlan?.deletionLedgerChanged),expected:freeze([...selected]),expectedRemovedIds:freeze([...deleteLocalIds]),references:selection.references||freeze([]),expectedDeletions:storedDeletions});
}
async function restoreSnapshotAssets(snapshot){
  if(!portableAssets||Number(snapshot&&snapshot.formatVersion)<10)return freeze({restored:false,removed:0,written:0});
  await AssetData.restoreAll(snapshot.importedAssets||[]);
  return freeze({restored:true,written:snapshot.importedAssets?.length||0});
}
async function verifyRestoreCommit(expected,signal,authorityOptions=null){
  throwIfImportAborted(signal,authorityOptions);await yieldImport(signal,authorityOptions);
  const records=Array.isArray(expected.records)?expected.records:[];
  if(records.length){
    const stored=await getDailyRecordDocumentsByDates(records.map(record=>record.date));
    const byDate=new Map(stored.map(record=>[record.date,sanitizeCurrentDailyRecord(record)]));
    for(const record of records)if(!Canonical.same(byDate.get(record.date),sanitizeCurrentDailyRecord(record)))throw new Error(`Post-restore verification failed for saved day ${record.date}.`);
  }
  if(Array.isArray(expected.recordDatesExact)){
    const actual=[...((await AppData.dailyRecords.backupDates()).dates||[])].sort(),wanted=[...expected.recordDatesExact].sort();
    if(actual.length!==wanted.length||actual.some((date,index)=>date!==wanted[index]))throw new Error('Post-restore verification found Saved Days outside the selected version.');
  }
  if(expected.notes){
    const stored=AppData.notes.normalizePayload(await AppData.notes.readFreshPayload());
    if(!Canonical.same(stored,expected.notes))throw new Error('Post-restore verification failed for ongoing Area notes.');
  }
  if(Array.isArray(expected.assets)){
    const rows=await AssetData.list(),catalogue=new Map(rows.map(row=>[row.id,row])),verifiedPhysical=new Set();
    for(const item of expected.assets){
      const row=catalogue.get(item.assetId);
      if(!row||row.name!==item.name||row.library!==item.library||row.size!==item.size||row.type!==item.mimeType)throw new Error(`Post-restore verification failed for attachment ${item.assetId}.`);
      const physicalKey=String(row.file||item.assetId)+'\u0000'+String(item.checksum||'')+'\u0000'+Number(item.size);
      if(!verifiedPhysical.has(physicalKey)){
        const stored=await AssetData.get(item.assetId);
        if(!(stored instanceof Blob)||stored.size!==item.size||String(stored.type||'')!==item.mimeType||await BackupCodec.checksumBlob(stored,{signal})!==item.checksum)throw new Error(`Post-restore verification failed for attachment ${item.assetId}.`);
        verifiedPhysical.add(physicalKey);
      }
    }
    if(Array.isArray(expected.assetIdsExact)){
      const actual=rows.map(row=>String(row.id||'')).sort(),wanted=[...expected.assetIdsExact].map(String).sort();
      if(actual.length!==wanted.length||actual.some((id,index)=>id!==wanted[index]))throw new Error('Post-restore verification found attachment identities outside the selected version.');
    }
  }
  if(Array.isArray(expected.removedAssetIds)&&expected.removedAssetIds.length){const catalogue=new Set((await AssetData.list()).map(row=>row.id));for(const id of expected.removedAssetIds)if(catalogue.has(id))throw new Error(`Post-restore verification failed to remove Attachment Library identity ${id}.`);}
  if(expected.personalData)await personalVerify(expected.personalData);
  if(Array.isArray(expected.savedDayDeletions)){const stored=await AppData.deletionRecovery.savedDays();if(!Canonical.same(stored,expected.savedDayDeletions))throw new Error('Post-restore verification failed for Saved-Day deletion history.');}
  if(Array.isArray(expected.areaNoteDeletions)){const stored=await AppData.deletionRecovery.areaNotes();if(!Canonical.same(stored,expected.areaNoteDeletions))throw new Error('Post-restore verification failed for Ongoing Note deletion history.');}
  if(Array.isArray(expected.attachmentDeletions)){const stored=await AppData.deletionRecovery.attachments();if(!Canonical.same(stored,expected.attachmentDeletions))throw new Error('Post-restore verification failed for Attachment deletion history.');}
  if(Object.prototype.hasOwnProperty.call(expected,'activeSession')){
    await AppData.activeSession.settled();
    const loaded=await readCanonicalActiveSession(),stored=loaded&&loaded.value||null;
    if(!Canonical.same(ActiveSessionCodec.sanitizeCurrent(stored),expected.activeSession))throw new Error('Post-restore verification failed for the active session.');
    await verifyActiveSessionRuntime(expected.activeSession,expected.scheduleText||'');
  }
  return true;
}
function sealVerifiedPortableSnapshot(parsed,{provenance=freeze({kind:'portable-file'}),release=null}={}){
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new TypeError('Verified portable snapshot payload is invalid.');
  if(!provenance||typeof provenance!=='object'||Array.isArray(provenance)||!Object.isFrozen(provenance))throw new TypeError('Verified portable snapshot provenance is invalid.');
  const snapshot=freeze({format:'study-director.verified-portable-snapshot',version:1}),state={parsed,provenance,release:typeof release==='function'?release:null,released:false};
  verifiedPortableSnapshots.set(snapshot,state);return snapshot;
}
function verifiedPortableSnapshotState(snapshot){
  const state=snapshot&&verifiedPortableSnapshots.get(snapshot);if(!state||state.released)throw new Error('Backup candidate is not backed by a current verified portable snapshot.');return state;
}
async function releaseVerifiedPortableSnapshot(snapshot){
  const state=snapshot&&verifiedPortableSnapshots.get(snapshot);if(!state||state.released)return false;state.released=true;verifiedPortableSnapshots.delete(snapshot);if(state.release)await state.release();return true;
}
function candidateSnapshotState(stored){return stored&&stored.snapshot?verifiedPortableSnapshotState(stored.snapshot):null;}
function createBackupCandidate(snapshot,{file=null,metadata=freeze({}),signal=null}={}){
  const state=verifiedPortableSnapshotState(snapshot),candidate=freeze({
    kind:'study-director.backup-candidate',
    release:async()=>{const stored=inspectedBackups.get(candidate);if(!stored)return false;inspectedBackups.delete(candidate);return releaseVerifiedPortableSnapshot(stored.snapshot);},
    preview:backupCandidatePreview(state.parsed,file,metadata)
  });
  inspectedBackups.set(candidate,{snapshot,signal});return candidate;
}
function managedSnapshotStage(stage,code,work){
  const label=String(stage||'validation');
  OperationDiagnostics.mark(`managed-checkpoint-${label}-start`);
  try{const value=work();OperationDiagnostics.mark(`managed-checkpoint-${label}-complete`);return value;}
  catch(error){
    const failure=error instanceof Error?error:new Error(String(error||'Managed checkpoint validation failed.'));
    if(!failure.code||failure.code==='Error')failure.code=code;
    if(!failure.backupStage)failure.backupStage=`managed-${label}`;
    OperationDiagnostics.mark(`managed-checkpoint-${label}-failed`,{stage:failure.backupStage,errorCode:String(failure.code||code)});
    throw failure;
  }
}
function managedParsedSnapshot(capture,metadata={}){
  // A one-note read (noteScope) holds just that note and its images: each was
  // verified against the manifest, and checks that need the whole checkpoint
  // are left to full reads, which alone may replace or combine everything.
  const plan=requireLogicalCheckpointCapture(capture),repositoryManifest=metadata&&metadata.repositoryManifest,noteScope=String(plan.noteScope||'');
  if(!repositoryManifest||typeof repositoryManifest!=='object'||Array.isArray(repositoryManifest))throw new Error('Managed repository provenance is unavailable.');
  if(!Canonical.same(repositoryManifest.checkpoint,plan.checkpoint)||String(repositoryManifest.sourceRevision||'')!==String(plan.sourceRevision||'')||String(repositoryManifest.exportedAt||'')!==String(plan.exportedAt||''))throw new Error('Managed repository provenance does not match the reconstructed checkpoint.');
  const records=managedSnapshotStage('daily-records','MANAGED_CHECKPOINT_DAILY_RECORDS_FAILED',()=>[...(plan.dailyDocuments||[])].map(record=>{const clean=BackupCodec.normalizeRecord(record);if(!clean)throw new Error('Managed repository Daily Records contain a record outside the supported schema range.');return clean;}).sort((a,b)=>a.date.localeCompare(b.date)));
  const recordDates=managedSnapshotStage('daily-records-membership','MANAGED_CHECKPOINT_DAILY_RECORDS_FAILED',()=>{const actual=records.map(record=>String(record.date)),declared=[...(plan.recordDates||[])].map(String).sort();if(actual.length!==declared.length||actual.some((date,index)=>date!==declared[index]))throw new Error('Managed repository Saved-Day membership failed verification.');return actual;});
  // Versions saved before notes had permanent ids (manifest 5 and older) keep
  // notes, and their deletion history, under note names; both convert to ids.
  const nameKeyedNotes=Number(repositoryManifest.version)<ManagedRepository.noteIdManifestVersion;
  const areaNotes=managedSnapshotStage('ongoing-notes','MANAGED_CHECKPOINT_ONGOING_NOTES_FAILED',()=>{const out=Object.create(null);for(const raw of plan.areaNoteItems||[]){const key=String(raw&&raw.key||''),clean=nameKeyedNotes?BackupCodec.legacyAreaNote(raw,key):BackupCodec.normalizeAreaNote(raw,key);if(!clean||!key||Object.prototype.hasOwnProperty.call(out,clean.key))throw new Error('Managed repository Ongoing Note failed current-schema verification.');out[clean.key]=clean;}return out;});
  const activeSession=managedSnapshotStage('active-session','MANAGED_CHECKPOINT_ACTIVE_SESSION_FAILED',()=>{const clean=plan.activeSession?BackupCodec.normalizeImportedActiveSession(plan.activeSession,{legacy:Number(repositoryManifest.version)<=4}):null;if(plan.activeSession&&!clean)throw new Error('Managed repository Active Session failed schema verification.');return clean;});
  const personalData=managedSnapshotStage('personal-data','MANAGED_CHECKPOINT_PERSONAL_DATA_FAILED',()=>plan.personalData?BackupCodec.normalizePersonalData(plan.personalData):null);
  const counts=managedSnapshotStage('counts','MANAGED_CHECKPOINT_COUNTS_FAILED',()=>{const value=BackupCodec.countShape({checkpointManifest:1,personalData:personalData?1:0,dailyRecord:records.length,areaNote:Object.keys(areaNotes).length,activeSession:activeSession?1:0});if(!noteScope&&Number(repositoryManifest.version)>=5&&(!BackupCodec.countsEqual(value,plan.counts)||!BackupCodec.countsEqual(value,repositoryManifest.counts)))throw new Error('Managed repository counts failed portable-snapshot verification.');return value;});
  const attachmentState=managedSnapshotStage('attachments','MANAGED_CHECKPOINT_ATTACHMENTS_FAILED',()=>{
    const rawAssetItems=Array.isArray(plan.assetItems)?plan.assetItems:[],assetDescriptors=BackupCodec.normalizeAssetDescriptors(rawAssetItems.map(item=>item&&item.descriptor)),assetById=new Map(rawAssetItems.map(item=>[String(item&&item.descriptor&&item.descriptor.assetId||''),item])),importedAssets=[];
    for(const descriptor of assetDescriptors){const item=assetById.get(descriptor.assetId);if(!item)throw new Error(`Managed repository attachment ${descriptor.assetId} is unavailable.`);if(descriptor.missing===true){if(item.blob!==null&&item.blob!==undefined)throw new Error(`Managed repository missing attachment ${descriptor.assetId} unexpectedly contains bytes.`);continue;}if(!(item.blob instanceof Blob)||item.blob.size!==descriptor.size)throw new Error(`Managed repository attachment ${descriptor.assetId} failed snapshot binding.`);importedAssets.push(freeze({...descriptor,blob:item.blob.slice(0,item.blob.size,descriptor.mimeType)}));}
    const referencedAssetIds=new Set(),collect=value=>{for(const id of BackupCodec.assetIds(value))referencedAssetIds.add(id);};records.forEach(collect);Object.values(areaNotes).forEach(collect);if(activeSession)collect(activeSession);
    const descriptorIds=new Set(assetDescriptors.map(item=>item.assetId));for(const id of referencedAssetIds)if(!descriptorIds.has(id))throw new Error(`Managed repository is missing attachment descriptor ${id}.`);
    return freeze({assetDescriptors,assetById,importedAssets,referencedAssetIds});
  });
  const {assetDescriptors,assetById,importedAssets,referencedAssetIds}=attachmentState;
  const normalizedPlan=freeze({...plan,dailyDocuments:freeze(records),recordDates:freeze(recordDates),areaNoteItems:freeze(Object.values(areaNotes).sort((a,b)=>String(a.key).localeCompare(String(b.key)))),activeSession,personalData,counts:freeze({...counts}),assetItems:freeze(assetDescriptors.map(descriptor=>freeze({descriptor,blob:descriptor.missing===true?null:assetById.get(descriptor.assetId).blob})))});
  const protectedCheckpointManifest=managedSnapshotStage('protected-manifest','MANAGED_CHECKPOINT_PROTECTED_MANIFEST_FAILED',()=>{if(noteScope)return BackupCodec.withNoteIdDeletions(repositoryManifest.protectedCheckpointManifest,nameKeyedNotes);const value=BackupCodec.createProtectedManifest(normalizedPlan,plan.checkpoint);if(Number(repositoryManifest.version)>=5&&(!Canonical.same(value,plan.protectedCheckpointManifest)||!Canonical.same(value,repositoryManifest.protectedCheckpointManifest)))throw new Error('Managed repository protected checkpoint state failed portable-snapshot verification.');return BackupCodec.withNoteIdDeletions(value,nameKeyedNotes);});
  const manifest=freeze(BackupCodec.createManifest(normalizedPlan,{compression:'none',algorithm:BackupCodec.checksumAlgorithm()})),report=freeze({legacy:false,sourceVersion:null,degraded:0,skipped:0,duplicates:0,invalidActiveSession:0,ignoredTombstones:0,warnings:freeze([])});
  const sourceBytes=Math.max(0,Number(metadata&&metadata.verifiedSourceBytes)||0),entityCount=records.length+Object.keys(areaNotes).length+(activeSession?1:0)+(personalData?1:0)+1,chunkOverhead=Math.ceil(entityCount/Math.max(1,Number(APP_LIMITS.backupChunkItems)||1))*512+8192;
  return freeze({noteScope,importedPersonalData:personalData,data:freeze({areaNotes:freeze(areaNotes)}),records:freeze(records),hasAreaNotes:true,areaNotesComplete:true,importedActiveSession:activeSession,protectedCheckpointManifest,captureAuthority:'canonical-complete',formatVersion:Number(backupVersion),counts:freeze({...counts}),manifest,report,uncompressedBytes:sourceBytes+chunkOverhead,assetDescriptors,referencedAssetIds:freeze([...referencedAssetIds].sort()),importedAssets:freeze(importedAssets),assetBytes:importedAssets.reduce((total,item)=>total+item.size,0)});
}
async function inspectVerifiedLogicalCapture(capture,metadata={}){
  const signal=metadata&&metadata.signal||activeImportOperation&&activeImportOperation.signal||null;throwIfImportAborted(signal);
  const parsed=managedParsedSnapshot(capture,metadata),repositoryManifest=metadata.repositoryManifest,release=metadata.release;
  if(typeof release!=='function')throw new TypeError('Managed repository attachment lease is unavailable.');
  const provenance=freeze({kind:'managed-repository',repositoryManifest,repositoryCommitted:metadata.repositoryCommitted===true,managedRecovery:metadata.managedRecovery||null,managedProgress:typeof metadata.managedProgress==='function'?metadata.managedProgress:null,encrypted:metadata.sourceEncrypted===true});
  const snapshot=sealVerifiedPortableSnapshot(parsed,{provenance,release});
  try{return createBackupCandidate(snapshot,{signal,metadata:freeze({filename:`${repositoryManifest.checkpoint.checkpointId}.sdbackup`,encrypted:metadata.sourceEncrypted===true,size:Math.max(0,Number(metadata.storedBytes)||0)})});}
  catch(error){await releaseVerifiedPortableSnapshot(snapshot).catch(()=>{});throw error;}
}
async function verifyVerifiedLogicalCapture(capture,metadata={}){throwIfImportAborted(metadata&&metadata.signal||null);managedParsedSnapshot(capture,metadata);return true;}
async function inspectBackup(file,metadata={}){
  const options=typeof metadata==='string'?{filename:metadata}:(metadata&&typeof metadata==='object'?metadata:{});
  const signal=options.signal||activeImportOperation&&activeImportOperation.signal||null;
  throwIfImportAborted(signal);
  const decoded=await Exports.unprotect(file,{interactive:options.interactive!==false,signal});
  let parsed;
  try{throwIfImportAborted(signal);parsed=await BackupCodec.inspect(decoded.blob,{filename:options.filename||file&&file.name||'',signal,validateOnly:options.validateOnly===true,yieldControl:()=>yieldImport(signal)});}
  catch(error){if(decoded.blob!==file)await Exports.run('file.release',{file:decoded.blob});throw error;}
  const release=async()=>{const files=[];if(decoded.blob!==file)files.push(decoded.blob);if(options.releaseSource)files.push(file);for(const item of [...new Set(files)])await Exports.run('file.release',{file:item}).catch(()=>{});};
  const provenance=freeze({kind:'portable-file',encrypted:typeof options.sourceEncrypted==='boolean'?options.sourceEncrypted:decoded.encrypted});
  const snapshot=sealVerifiedPortableSnapshot(parsed,{provenance,release}),candidate=createBackupCandidate(snapshot,{file,signal,metadata:freeze({...options,encrypted:provenance.encrypted})});
  if(options.validateOnly){inspectedBackups.delete(candidate);await releaseVerifiedPortableSnapshot(snapshot);}
  return candidate;
}
function protectedCheckpointDeletionState(parsed){
  const manifest=parsed&&parsed.protectedCheckpointManifest;
  if(Number(parsed&&parsed.formatVersion)<15||!manifest)throw new Error('Exact backup replacement requires a current protected backup checkpoint.');
  return freeze({
    savedDays:freeze([...(manifest.savedDayDeletions||[])]),
    areaNotes:freeze([...(manifest.areaNoteDeletions||[])]),
    attachments:freeze([...(manifest.attachmentDeletions||[])])
  });
}
async function replacePortableCanonicalSnapshot(snapshot,{scheduleText='',deletionState=null,signal=null,restoreId='',requirePersonal=false,phasePrefix='restoring-version',authorityOptions=null}={}){
  const source=snapshot&&typeof snapshot==='object'?snapshot:null;
  if(!source)throw new Error('The portable restore snapshot is unavailable.');
  requireBackupMutationControl('replacing the portable Study Director state');
  const mark=async phase=>{if(restoreId)await AppData.restoreJournal.mark(restoreId,`${phasePrefix}-${phase}`);};
  const records=normalizeImportedDailyRecordSet(source.records||[]).records,targetDates=freeze(records.map(record=>record.date)),targetDateSet=new Set(targetDates);
  const targetNotes=AppData.notes.normalizePayload(source.data&&source.data.areaNotes||{});
  const targetSession=source.importedActiveSession?ActiveSessionCodec.sanitizeCurrent(source.importedActiveSession):null;
  if(source.importedActiveSession&&!targetSession)throw new Error('The selected version contains an invalid Active Session.');
  const targetPersonal=source.importedPersonalData||null;
  if(requirePersonal&&!targetPersonal)throw new Error('The selected managed version is missing portable Plans or Preferences.');
  const deletions=deletionState||freeze({savedDays:freeze([]),areaNotes:freeze([]),attachments:freeze([])});
  for(const key of ['savedDays','areaNotes','attachments'])if(!Array.isArray(deletions[key]))throw new Error('The selected version has invalid canonical deletion state.');
  throwIfImportAborted(signal,authorityOptions);
  await mark('saved-days');
  const currentSource=await AppData.dailyRecords.backupDates(),currentDates=Array.isArray(currentSource&&currentSource.dates)?currentSource.dates:[],removedDates=[];
  for(const date of currentDates){
    if(targetDateSet.has(date))continue;
    throwIfImportAborted(signal,authorityOptions);await AppData.dailyRecords.remove(date,{rollback:true});removedDates.push(date);await yieldImport(signal,authorityOptions);
  }
  let recordBatches=0;
  if(records.length){const stored=await AppData.dailyRecords.importBatches(records,{signal,yieldControl:()=>yieldImport(signal,authorityOptions)});recordBatches=Number(stored&&stored.batches)||0;}
  throwIfImportAborted(signal,authorityOptions);
  await mark('ongoing-notes');
  const restoredNotes=await restoreAreaNotesSnapshot(targetNotes);
  if(!restoredNotes||typeof restoredNotes!=='object'||Array.isArray(restoredNotes))throw new Error('Ongoing-note Version Restore did not return a canonical committed payload.');
  throwIfImportAborted(signal,authorityOptions);await yieldImport(signal,authorityOptions);
  let restoredAssets=0;
  if(portableAssets&&Number(source.formatVersion)>=10){
    await mark('attachments');
    const assets=Array.isArray(source.importedAssets)?source.importedAssets:[];
    await restoreSnapshotAssets(source);restoredAssets=assets.length;
    throwIfImportAborted(signal,authorityOptions);await yieldImport(signal,authorityOptions);
  }
  await mark('active-session');
  await restoreSessionState(targetSession,String(scheduleText||''));
  throwIfImportAborted(signal,authorityOptions);await yieldImport(signal,authorityOptions);
  if(targetPersonal){await mark('personal-data');await personalImport(targetPersonal);throwIfImportAborted(signal,authorityOptions);await yieldImport(signal,authorityOptions);}
  await mark('deletion-state');
  await AppData.deletionRecovery.replaceSavedDays(deletions.savedDays);
  await AppData.deletionRecovery.replaceAreaNotes(deletions.areaNotes);
  await AppData.deletionRecovery.replaceAttachments(deletions.attachments);
  await AppData.activeSession.settled();
  await mark('verifying');
  const expectedAssets=portableAssets&&Number(source.formatVersion)>=10?(source.importedAssets||[]):undefined;
  await verifyRestoreCommit({
    personalData:targetPersonal,records,recordDatesExact:targetDates,notes:AppData.notes.normalizePayload(restoredNotes),
    assets:expectedAssets,assetIdsExact:Array.isArray(expectedAssets)?expectedAssets.map(item=>item.assetId):undefined,
    activeSession:targetSession,scheduleText:String(scheduleText||''),savedDayDeletions:deletions.savedDays,areaNoteDeletions:deletions.areaNotes,attachmentDeletions:deletions.attachments
  },signal,authorityOptions);
  for(const [scope,operation] of [['library',libraryChanged],['notes',refreshPnote],['review',()=>ReviewView.refresh()],['schedule',renderSched]])try{operation();}catch(error){AppDiagnostics.capture(`backup.version-restore-${scope}`,error,'warn');}
  if(portableAssets)AssetData.scheduleMaintenance(0);
  return freeze({records:records.length,removedRecords:removedDates.length,recordBatches,notes:Object.keys(targetNotes).length,activeSession:!!targetSession,personalData:!!targetPersonal,assets:restoredAssets});
}
async function rebaseRepositoryPreparationAcceleration(reason='authoritative-recovery',authorityOptions=null){
  assertAuthority(authorityOptions||undefined);
  ManagedRepository.invalidatePreparation();
  OperationDiagnostics.mark('repository-preparation-rebase-start',{reason});
  try{
    const result=await AppData.mutationEpoch.rebasePreparation();
    assertAuthority(authorityOptions||undefined);
    OperationDiagnostics.mark('repository-preparation-rebase-complete',{reason,units:Number(result&&result.stamps&&result.stamps.length)||0});
    return result;
  }catch(error){
    OperationDiagnostics.mark('repository-preparation-rebase-failed',{reason});
    AppDiagnostics.capture('backup.repository-preparation-rebase',error,'error');
    throw new Error('Recovered data was verified, but backup acceleration metadata could not be rebased safely. The recovery was rolled back; retry after browser storage recovers.',{cause:error});
  }
}

function rollbackDeletionState(snapshot,override=null){
  const protectedManifest=snapshot&&snapshot.protectedCheckpointManifest||null,provided=override&&typeof override==='object'?override:{};
  const value=(key,manifestKey)=>Array.isArray(provided[key])?provided[key]:Array.isArray(protectedManifest&&protectedManifest[manifestKey])?protectedManifest[manifestKey]:freeze([]);
  return freeze({savedDays:freeze([...value('savedDays','savedDayDeletions')]),areaNotes:freeze([...value('areaNotes','areaNoteDeletions')]),attachments:freeze([...value('attachments','attachmentDeletions')])});
}
async function rollbackImportedState(journal,scheduleText='',deletionState=null){
  const rollbackAuthority=freeze({allowDurableProtected:true});
  assertAuthority(rollbackAuthority);
  const snapshot=journal&&typeof journal==='object'?journal:null;
  if(!snapshot)throw new Error('The restore rollback journal is unavailable. Use the downloaded safety copy.');
  const result=await replacePortableCanonicalSnapshot(snapshot,{scheduleText,deletionState:rollbackDeletionState(snapshot,deletionState),signal:null,requirePersonal:false,phasePrefix:'rollback',authorityOptions:rollbackAuthority});
  await rebaseRepositoryPreparationAcceleration('rollback',rollbackAuthority);
  return freeze({removedAddedRecords:result.removedRecords,restoredRecords:result.records});
}

async function ensureRestoreCapacity(parsed,preview={}){
  const expandedBytes=Math.max(0,Number(parsed&&parsed.uncompressedBytes)||Number(preview&&preview.size)||0);let safetyAssetBytes=0;
  if(portableAssets){
    const physicalSizes=new Map();
    for(const row of await AssetData.list()){
      const identity=String(row&&row.file||row&&row.id||''),size=Number(row&&row.size);if(!identity||!Number.isSafeInteger(size)||size<=0)continue;
      physicalSizes.set(identity,Math.max(size,physicalSizes.get(identity)||0));
    }
    for(const size of physicalSizes.values())safetyAssetBytes=Math.min(Number.MAX_SAFE_INTEGER,safetyAssetBytes+size);
  }
  try{
    const estimate=globalThis.navigator&&globalThis.navigator.storage&&typeof globalThis.navigator.storage.estimate==='function'?await globalThis.navigator.storage.estimate():null;
    if(estimate&&Number.isFinite(estimate.quota)&&Number.isFinite(estimate.usage)){
      const available=Math.max(0,estimate.quota-estimate.usage),backupLimit=Math.max(0,Number(APP_LIMITS.backupMaxFileBytes||APP_LIMITS.backupMaxCompressedBytes)||0),incomingWorkingBytes=Math.max(5*1024*1024,Math.min(backupLimit*2||Number.MAX_SAFE_INTEGER,expandedBytes*2)),required=Math.min(Number.MAX_SAFE_INTEGER,incomingWorkingBytes+safetyAssetBytes);
      if(available<required)throw new Error('This device does not have enough available browser storage to restore the backup safely. Free space and retry.');
    }
  }catch(error){if(error&&/enough available browser storage/.test(error.message))throw error;}
  return true;
}

async function captureLocalSafetyCopy(_stored,{afterCapture=null}={}){
  const materialized=await createCanonicalCheckpointWithInspection({assumeFlushed:true,requireCanonicalComplete:true}),rollbackJournal=materialized.inspection;
  const {inspection:_inspection,...safety}=materialized,safetyFile=freeze(safety);
  try{
    if(typeof afterCapture==='function')await afterCapture();
    if(!rollbackJournal)throw new Error('The verified restore safety snapshot is unavailable.');
    return freeze({safetyFile,rollbackJournal});
  }catch(error){await Exports.run('file.release',{file:safetyFile.blob}).catch(()=>{});throw error;}
}
async function runRestoreMutation(stored,kind,operation){
  if(typeof operation!=='function')throw new TypeError('Restore mutation operation is required.');
  const snapshot=candidateSnapshotState(stored),managed=snapshot&&snapshot.provenance&&typeof snapshot.provenance.managedRecovery==='function'?snapshot.provenance.managedRecovery:null;
  const apply=()=>withPersistenceSuppressed(operation);
  if(managed)return managed(freeze({kind,apply}));
  return runExclusive(kind,apply);
}
function restoreSurfaceStatus(stored,message,ok=true,stage='local',details={}){
  const snapshot=candidateSnapshotState(stored),report=snapshot&&snapshot.provenance&&snapshot.provenance.managedProgress;
  if(typeof report==='function'){try{report(freeze({stage:String(stage||'local'),message:String(message||''),ok:ok!==false,...details}));}catch(error){AppDiagnostics.capture('backup.managed-recovery-progress',error,'warn');}return true;}
  portablePresentation?.update({progress:{stage,...details}});setLocalExportStatus(message,ok);return false;
}
async function restoreBackupAttemptWithOperation(candidate,operation,options={}){
  const missingOnly=options&&options.missingOnly===true,note=!missingOnly&&typeof options?.note==='string'?options.note:'';
  const stored=candidate&&typeof candidate==='object'?inspectedBackups.get(candidate):null,snapshot=stored?candidateSnapshotState(stored):null;
  const parsed=snapshot&&snapshot.parsed||null,signal=operation&&operation.signal||stored&&stored.signal||null;
  if(!parsed)throw new Error('Backup candidate is not a current verified Study Director inspection.');
  if(parsed.noteScope&&parsed.noteScope!==note)throw new Error('This backup version was read for one note only and cannot be combined as a whole.');
  throwIfImportCancelled(signal);
  const preview=candidate.preview||{};
  OperationDiagnostics.mark('restore-preflight-start');
  await flushRestorePreflightState(signal);
  OperationDiagnostics.mark('restore-preflight-complete');
  const stable=await buildStableRestoreImpact(parsed,preview,signal,{missingOnly,note}),impact=stable.impact;
  // Missing-only recovery runs without questions; anything that would need a
  // decision is left for an explicit restore instead.
  const unchanged=reason=>Object.freeze({cancelled:true,reason,mode:'reconcile',added:0,replaced:0,kept:0,batches:0,assetsRestored:0,notesReconciled:false,activeSessionReconciled:false,savedDayDeletionsApplied:0}),needsDecision=()=>unchanged('needs-decision');
  if((missingOnly||note)&&!impact.reconciliationCapable)return needsDecision();
  // A one-note restore stops here when the backup has no copy of the note or
  // the same text, so nothing is written and no safety backup is made.
  const noteItem=note?impact.reconciliationPlan.notes.find(item=>item.key===note)||null:null,noteRecord=local=>noteItem?.candidates.find(candidate=>candidate.local===local&&candidate.kind==='record')||null;
  if(note){
    const localNote=noteRecord(true),backupNote=noteRecord(false);
    if(!backupNote)return unchanged(noteItem?.identical?'note-unchanged':'note-missing');
    if(localNote&&String(localNote.value?.text||'')===String(backupNote.value?.text||''))return unchanged('note-unchanged');
  }
  // The restored text is a new edit, so it carries a new revision.
  const restoredNote=text=>{const base=noteRecord(true)||noteRecord(false),revision=Math.max(Date.now(),(Date.parse(String(noteRecord(true)?.value?.updatedAt||''))||0)+1);return freeze({[note]:freeze({value:freeze({...base.value,key:note,text,updatedAt:new Date(revision).toISOString()})})});};
  OperationDiagnostics.mark('reconciliation-impact-ready',{savedDayConflicts:Number(impact.savedDays&&impact.savedDays.conflicts)||0,activeSessionConflicts:Number(impact.activeSession&&impact.activeSession.conflicts)||0});
  const reconciliationRevision=stable.revision,relevantDates=stable.relevantDates;
  const mode=restoreModeForBackup(impact);
  if(!mode)return Object.freeze({cancelled:true,mode:null,added:0,replaced:0,kept:0,batches:0,assetsRestored:0,notesReconciled:false,activeSessionReconciled:false,savedDayDeletionsApplied:0});
  const currentCheckpoint=mode==='reconcile';
  const localPersonal=await personalExport({flush:false}),decisionSetup=restoreDecisionSetup(parsed,impact,mode,localPersonal);
  // Restoring one note always shows the comparison, so it never merges itself.
  const preliminaryNoteConflicts=noteReconciliationConflicts(impact.reconciliationPlan,null),noteAncestor=preliminaryNoteConflicts.length&&!note?await noteReconciliationAncestor(stored,preliminaryNoteConflicts.map(item=>item.key)):null;
  const noteConflicts=noteAncestor?noteReconciliationConflicts(impact.reconciliationPlan,noteAncestor):preliminaryNoteConflicts;
  let selectedDecisions=freeze({});
  if(missingOnly&&(decisionSetup.groups.some(group=>!['plans','personalSettings'].includes(group.id))||noteConflicts.length))return needsDecision();
  if(decisionSetup.groups.length&&!missingOnly&&!note){
    selectedDecisions=await configure({
      title:'Different versions found',
      message:'Choose what to keep where this device and the backup differ. This device is selected by default; missing data is never treated as a deletion.',
      details:[
        `${currentCheckpoint?'Backup copy':(preview.filename||'Backup file')} · ${preview.exportedAt?new Date(preview.exportedAt).toLocaleString('en-IN'):'date unavailable'}`,
        `Saved Days: ${impact.savedDays.conflicts} conflict${impact.savedDays.conflicts===1?'':'s'} · Active Session: ${impact.activeSession.conflicts} conflict${impact.activeSession.conflicts===1?'':'s'}.`,
        'Study Director automatically keeps verified rollback protection while changes are applied.'
      ],groups:decisionSetup.groups,checkboxes:[{id:'safetyCopy',label:'Download an extra standalone safety copy before applying',description:'Optional. This does not replace Study Director’s automatic rollback protection.',defaultChecked:false}],confirmLabel:'Apply choices',cancelLabel:'Keep current'
    });
    if(!selectedDecisions)return Object.freeze({cancelled:true,mode,added:0,replaced:0,kept:0,batches:0,assetsRestored:0,notesReconciled:false,activeSessionReconciled:false,savedDayDeletionsApplied:0});
  }
  const decisions=freeze({...decisionSetup.defaults,...selectedDecisions});
  if(decisions.safetyCopy===true){
    await assertRestoreReconciliationCurrent(reconciliationRevision,relevantDates,stable.scope);
    const extra=await downloadSafetyCopy({assumeFlushed:true});try{await Exports.run('file.release',{file:extra.blob});}catch(error){AppDiagnostics.capture('backup.optional-safety-copy-release',error,'warn');}
    await assertRestoreReconciliationCurrent(reconciliationRevision,relevantDates,stable.scope);
  }
  let reflectionDecisionMap=freeze({});
  const reflectionConflicts=savedDayReflectionConflicts(impact.reconciliationPlan);
  if(missingOnly&&reflectionConflicts.length)return needsDecision();
  if(reflectionConflicts.length){
    const reflectionResult=await NoteReconciliation.resolve(freeze({conflicts:reflectionConflicts,incomingAssets:Array.isArray(parsed.importedAssets)?parsed.importedAssets:freeze([]),signal,manualOnly:true}));
    if(!reflectionResult)return Object.freeze({cancelled:true,mode,added:0,replaced:0,kept:0,batches:0,assetsRestored:0,notesReconciled:false,activeSessionReconciled:false,savedDayDeletionsApplied:0});
    reflectionDecisionMap=savedDayReflectionSelections(impact.reconciliationPlan,reflectionResult,decisions);
  }
  let noteDecisionMap=freeze({});
  if(noteConflicts.length){
    const noteResult=await NoteReconciliation.resolve(freeze({conflicts:noteConflicts,incomingAssets:Array.isArray(parsed.importedAssets)?parsed.importedAssets:freeze([]),signal,...(note?{purpose:'version'}:{})}));
    if(!noteResult)return Object.freeze({cancelled:true,mode,added:0,replaced:0,kept:0,batches:0,assetsRestored:0,notesReconciled:false,activeSessionReconciled:false,savedDayDeletionsApplied:0});
    if(note){const text=String(noteResult.notes?.[note]?.text??noteConflicts[0].localValue);if(text===noteConflicts[0].localValue)return unchanged('note-kept');noteDecisionMap=restoredNote(text);}
    else noteDecisionMap=noteReconciliationSelections(impact.reconciliationPlan,noteResult);
  }else if(note){
    // Nothing on this device to compare with (the note is empty or was
    // deleted here), so the backup's text comes back as it is.
    noteDecisionMap=restoredNote(String(noteRecord(false).value?.text||''));
  }
  const resolvedPlan=Reconciliation.resolvePlan(impact.reconciliationPlan,reconciliationSelections(impact.reconciliationPlan,decisions,noteDecisionMap,reflectionDecisionMap)),resolvedAssetReferences=await resolvedAssetReferenceIds(resolvedPlan,signal);
  let attachmentPlan=note?await noteAttachmentPlan(resolvedAssetReferences):await buildAttachmentDeletionPlan(parsed,resolvedPlan,stable.impact.assetAssessment||null,freeze({}),signal,resolvedAssetReferences);
  if(missingOnly&&attachmentPlan.conflicts.length)return needsDecision();
  if(attachmentPlan.conflicts.length){
    const groups=attachmentDeletionDecisionGroups(attachmentPlan),choice=await configure({title:'Review attachment differences',message:'Choose what to keep for standalone attachments that differ between this device and the backup. Attachments still referenced by your data are always kept.',groups,confirmLabel:'Apply choices',cancelLabel:'Cancel'});
    if(!choice)return Object.freeze({cancelled:true,mode,added:0,replaced:0,kept:0,batches:0,assetsRestored:0,notesReconciled:false,activeSessionReconciled:false,savedDayDeletionsApplied:0});
    const mapped=Object.create(null);for(const item of attachmentPlan.conflicts)mapped[item.assetId]=choice[`attachment__${item.assetId}`]||item.defaultValue;
    attachmentPlan=await buildAttachmentDeletionPlan(parsed,resolvedPlan,stable.impact.assetAssessment||null,freeze(mapped),signal,resolvedAssetReferences);
  }
  throwIfImportAborted(signal);await yieldImport(signal);
  await assertRestoreReconciliationCurrent(reconciliationRevision,relevantDates,stable.scope);
  if(!impact.reconciliationCapable)requireNoActiveSession('using an older backup');
  return runRestoreMutation(stored,'restore-backup',async()=>{
  OperationDiagnostics.mark('local-restore-mutation-enter');
  if(!impact.reconciliationCapable)requireNoActiveSession('using an older backup');
  await assertRestoreReconciliationCurrent(reconciliationRevision,relevantDates,stable.scope);
  await ensureRestoreCapacity(parsed,preview);
  restoreSurfaceStatus(stored,'Creating and verifying a local rollback snapshot…',true,'local-safety');
  OperationDiagnostics.mark('local-safety-capture-start');
  const {safetyFile,rollbackJournal}=await captureLocalSafetyCopy(stored,{afterCapture:()=>assertRestoreReconciliationCurrent(reconciliationRevision,relevantDates,stable.scope)});
  OperationDiagnostics.mark('local-safety-capture-complete',{bytes:Number(safetyFile&&safetyFile.blob&&safetyFile.blob.size)||0});
  const rollbackScheduleText=scheduleRead();
  const rollbackDeletionState=freeze({savedDays:await AppData.deletionRecovery.savedDays(),areaNotes:await AppData.deletionRecovery.areaNotes(),attachments:await AppData.deletionRecovery.attachments()});
  const restoreId=`restore_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,14)}`;
  let committedDescription='',journalPrepared=false;
  try{
    OperationDiagnostics.mark('restore-journal-prepare-start');
    await AppData.restoreJournal.prepare({id:restoreId,blob:safetyFile.blob,filename:safetyFile.filename,scheduleText:rollbackScheduleText,savedDayDeletions:rollbackDeletionState.savedDays,areaNoteDeletions:rollbackDeletionState.areaNotes,attachmentDeletions:rollbackDeletionState.attachments});
    journalPrepared=true;OperationDiagnostics.mark('restore-journal-prepare-complete');
    let assetResult=freeze({written:0,published:0,reused:0,deleted:0,changed:false,expected:freeze([]),expectedRemovedIds:freeze([]),references:freeze([]),expectedDeletions:freeze([])});
    if(portableAssets&&Number(parsed.formatVersion)>=10){
      await AppData.restoreJournal.mark(restoreId,'applying-assets');
      const currentAssessment=await assessImportedAssets(parsed,signal);
      const selectedAssets=await selectResolvedImportedAssets(currentAssessment,resolvedPlan,signal,attachmentPlan,resolvedAssetReferences);
      assetResult=await commitImportedAssets(selectedAssets,signal,attachmentPlan);
      if(assetResult.published)committedDescription=`${assetResult.published} selected attachment${assetResult.published===1?' was':'s were'} already updated`;
      await AppData.restoreJournal.mark(restoreId,'assets-committed');
      throwIfImportAborted(signal);await yieldImport(signal);
    }
    await AppData.restoreJournal.mark(restoreId,'applying-saved-day-state');
    const report={...(parsed.report||{}),warnings:[...((parsed.report&&parsed.report.warnings)||[])]};
    const dailyResult=await applyResolvedSavedDays(resolvedPlan,operation,(message,progress)=>restoreSurfaceStatus(stored,message,true,'local-apply',{current:Number(progress&&progress.committed)||0,total:Number(progress&&progress.total)||0}));
    const {count,replaced,deleted,kept,identical,batches,appliedRecords,expectedDeletions}=dailyResult;
    const committedRecords=count+replaced;
    if(committedRecords)committedDescription+=(committedDescription?' and ':'')+`${committedRecords} Saved Day${committedRecords===1?' was':'s were'} already saved`;
    if(dailyResult.changed&&expectedDeletions)committedDescription+=(committedDescription?' and ':'')+'Saved-Day choices were already saved';
    await AppData.restoreJournal.mark(restoreId,'saved-day-state-committed');
    throwIfImportAborted(signal);await yieldImport(signal);
    await AppData.restoreJournal.mark(restoreId,'applying-area-notes');
    const noteResult=await applyResolvedAreaNotes(resolvedPlan);
    if(noteResult.changed)committedDescription+=(committedDescription?' and ':'')+'Ongoing Notes were already saved';
    await AppData.restoreJournal.mark(restoreId,'area-notes-committed');
    throwIfImportAborted(signal);await yieldImport(signal);
    await AppData.restoreJournal.mark(restoreId,'applying-active-session');
    const sessionResult=await applyResolvedActiveSession(resolvedPlan);
    if(sessionResult.changed)committedDescription+=(committedDescription?' and ':'')+'the Active Session was already saved';
    await AppData.restoreJournal.mark(restoreId,'active-session-committed');
    const localPersonal=rollbackJournal.importedPersonalData;
    const expectedPersonal=localPersonal?{version:2,plans:decisions.plans==='replace'&&parsed.importedPersonalData?parsed.importedPersonalData.plans:localPersonal.plans,preferences:decisions.personalSettings==='replace'&&parsed.importedPersonalData?parsed.importedPersonalData.preferences:localPersonal.preferences}:null;
    if(expectedPersonal){await AppData.restoreJournal.mark(restoreId,'applying-personal-data');await personalImport(expectedPersonal);}
    const personalChanged=!!parsed.importedPersonalData&&(decisions.plans==='replace'||decisions.personalSettings==='replace');
    await AppData.restoreJournal.mark(restoreId,'verifying');
    const expectedCommit={
      personalData:expectedPersonal,records:appliedRecords,
      notes:noteResult.expected,
      assets:portableAssets&&Number(parsed.formatVersion)>=10?assetResult.expected:undefined,
      removedAssetIds:portableAssets&&Number(parsed.formatVersion)>=10?assetResult.expectedRemovedIds:undefined,
      savedDayDeletions:expectedDeletions,
      areaNoteDeletions:noteResult.expectedDeletions,
      attachmentDeletions:assetResult.expectedDeletions
    };
    if(sessionResult.changed){expectedCommit.activeSession=sessionResult.expected;expectedCommit.scheduleText=sessionResult.scheduleText||'';}
    await verifyRestoreCommit(expectedCommit,signal);
    throwIfImportAborted(signal);
    await AppData.restoreJournal.mark(restoreId,'verified');
    OperationDiagnostics.mark('canonical-verification-complete');
    const changed=!!(dailyResult.changed||assetResult.changed||noteResult.changed||sessionResult.changed||personalChanged);
    if(changed)await rebaseRepositoryPreparationAcceleration('combine');
    await AppData.restoreJournal.clear(restoreId);journalPrepared=false;clearFault();
    // An older version restored for one note is not a shared base for later combines.
    if(currentCheckpoint&&!note){
      const checkpointId=String(parsed&&parsed.protectedCheckpointManifest&&parsed.protectedCheckpointManifest.checkpointId||preview&&preview.checkpoint&&preview.checkpoint.checkpointId||'');
      if(checkpointId)try{await AppData.reconciliationBase.write(checkpointId,parsed&&parsed.data&&parsed.data.areaNotes||{});}catch(error){AppDiagnostics.capture('backup.reconciliation-base-write',error,'warn');}
    }
    if(portableAssets)AssetData.scheduleMaintenance(0);
    const compatibility=[];
    if(report.legacy)compatibility.push(`accepted older${report.sourceVersion?` v${report.sourceVersion}`:''} backup data`);
    if(report.degraded)compatibility.push(`preserved explicit unknowns in ${report.degraded} degraded entit${report.degraded===1?'y':'ies'}`);
    if(report.invalidActiveSession)compatibility.push('skipped an incompatible active session while keeping the rest');
    if(report.ignoredTombstones)compatibility.push(`ignored ${report.ignoredTombstones} legacy deletion marker${report.ignoredTombstones===1?'':'s'} so local data was not deleted`);
    if(report.skipped)compatibility.push(`skipped ${report.skipped} unusable entit${report.skipped===1?'y':'ies'}`);
    if(report.duplicates)compatibility.push(`kept the first usable copy of ${report.duplicates} duplicate backup entr${report.duplicates===1?'y':'ies'}`);
    if(!changed){
      const baseMsg=kept?`Combine made no changes. ${kept} divergent local Saved Day${kept===1?' was':'s were'} kept.`:(impact.savedDays.total?'Combine found no applicable Saved-Day changes.':'Combine contained no Saved-Day records to add.');
      restoreSurfaceStatus(stored,baseMsg+(compatibility.length?' '+compatibility.join(' · ')+'.':''),false,'local-warning');
    }else{
      const parts=[];
      if(personalChanged)parts.push('plans or personal settings restored');
      if(count)parts.push(count+' new daily record'+(count===1?'':'s'));
      if(replaced)parts.push(replaced+' divergent Saved-Day replacement'+(replaced===1?'':'s'));
      if(deleted)parts.push(deleted+' Saved-Day deletion'+(deleted===1?'':'s')+' applied');
      if(assetResult.published)parts.push(assetResult.published+' attachment'+(assetResult.published===1?'':'s')+' updated');
      if(assetResult.deleted)parts.push(assetResult.deleted+' Attachment Library deletion'+(assetResult.deleted===1?'':'s')+' applied');
      if(batches>1)parts.push(batches+' committed record batches');
      restoreSurfaceStatus(stored,`✓ ${currentCheckpoint?'Merged':'Imported'} `+(parts.join(' · ')||'backup data')+noteResult.message+sessionResult.message+(kept?' · kept '+kept+' divergent local Saved Day'+(kept===1?'':'s'):'')+(identical?' · '+identical+' identical Saved Day'+(identical===1?'':'s')+' unchanged':'')+(compatibility.length?' · '+compatibility.join(' · '):'')+'. Final verification passed.',true,'local-complete');
    }
    try{libraryChanged();}catch(error){AppDiagnostics.capture('backup.import-render',error,'warn');}
    return Object.freeze({
      cancelled:false,mode,verified:true,
      added:count,replaced,kept,batches,
      savedDayDeletionsApplied:deleted,
      assetsRestored:assetResult.published,attachmentDeletionsApplied:assetResult.deleted,notesReconciled:noteResult.changed,
      activeSessionReconciled:sessionResult.changed,personalDataRestored:personalChanged,changed
    });
  }catch(error){
    const failure=error instanceof Error?error:new Error(String(error));
    if(journalPrepared){
      restoreSurfaceStatus(stored,'Combine did not finish. Restoring the verified safety copy…',false,'rollback');
      try{
        OperationDiagnostics.mark('rollback-start');
        await AppData.restoreJournal.mark(restoreId,'rolling-back');
        await rollbackImportedState(rollbackJournal,rollbackScheduleText,rollbackDeletionState);
        await AppData.restoreJournal.mark(restoreId,'rolled-back');
        await AppData.restoreJournal.clear(restoreId);journalPrepared=false;clearFault();OperationDiagnostics.mark('rollback-complete');
        Object.defineProperty(failure,'studyDirectorRollbackDescription',{value:'All recovery changes were rolled back from the verified safety copy.',configurable:true});
        committedDescription='';
      }catch(rollbackError){
        failClosed(`Interrupted restore recovery is required: ${rollbackError&&rollbackError.message||rollbackError}`);
        Object.defineProperty(failure,'studyDirectorRollbackDescription',{value:`Automatic rollback also failed: ${rollbackError&&rollbackError.message||rollbackError}. The recovery record was retained; do not clear site data.`,configurable:true});
      }
    }
    Object.defineProperty(failure,'studyDirectorCommittedDescription',{value:committedDescription,configurable:true});
    throw failure;
  }finally{await Exports.run('file.release',{file:safetyFile.blob});}
  });
}
async function restoreExactVersionWithOperation(candidate,operation,{confirmed=false,requireManaged=false}={}){
  const stored=candidate&&typeof candidate==='object'?inspectedBackups.get(candidate):null,snapshot=stored?candidateSnapshotState(stored):null,parsed=snapshot&&snapshot.parsed||null,provenance=snapshot&&snapshot.provenance||null,repositoryManifest=provenance&&provenance.repositoryManifest||null;
  const signal=operation&&operation.signal||stored&&stored.signal||null;
  if(!parsed)throw new Error('The selected backup is not a current verified Study Director backup.');
  if(parsed.noteScope)throw new Error('This backup version was read for one note only and cannot replace current data.');
  if(requireManaged&&(!repositoryManifest||provenance.repositoryCommitted!==true))throw new Error('Replace current data is available here only for a verified Device Folder or Google Drive backup.');
  if(Number(parsed.formatVersion)<15||!parsed.protectedCheckpointManifest)throw new Error('The selected backup is too old for exact replacement. Combine it with current data instead.');
  const checkpointId=String(repositoryManifest&&repositoryManifest.checkpoint&&repositoryManifest.checkpoint.checkpointId||parsed.protectedCheckpointManifest.checkpointId||''),preview=candidate.preview||{};
  if(!checkpointId||checkpointId!==String(parsed.protectedCheckpointManifest.checkpointId||''))throw new Error('The selected backup identity is inconsistent.');
  throwIfImportCancelled(signal);
  OperationDiagnostics.mark('restore-preflight-start');
  await flushRestorePreflightState(signal);
  OperationDiagnostics.mark('restore-preflight-complete');
  if(!confirmed){
    const accepted=await configure({
      title:'Replace current data?',
      message:'Study Director will make the complete portable app state match this backup. Portable data that did not exist in this backup will be removed. Device-local settings and browser permissions stay on this device.',
      details:[
        `${preview.exportedAt?new Date(preview.exportedAt).toLocaleString('en-IN'):'Date unavailable'} · ${Number(preview.counts&&preview.counts.dailyRecord)||0} Saved Days · ${Number(preview.counts&&preview.counts.areaNote)||0} Ongoing Notes`,
        'A verified safety copy protects the current local state if this operation fails.'
      ],
      groups:freeze([]),confirmLabel:'Replace current data',cancelLabel:'Cancel',danger:true,signal
    });
    if(!accepted)return freeze({cancelled:true,mode:'restore-version',verified:false,checkpointId});
  }
  throwIfImportAborted(signal);
  return runRestoreMutation(stored,requireManaged?'restore-managed-version':'restore-file-version',async()=>{
    OperationDiagnostics.mark('local-restore-mutation-enter');
    await ensureRestoreCapacity(parsed,preview);
    OperationDiagnostics.mark('restore-capacity-verified');
    restoreSurfaceStatus(stored,'Creating and verifying a local rollback snapshot…',true,'local-safety');
    OperationDiagnostics.mark('local-safety-capture-start');
    const {safetyFile,rollbackJournal}=await captureLocalSafetyCopy(stored);
    OperationDiagnostics.mark('local-safety-capture-complete',{bytes:Number(safetyFile&&safetyFile.blob&&safetyFile.blob.size)||0});
    const rollbackScheduleText=scheduleRead(),rollbackDeletionState=freeze({savedDays:await AppData.deletionRecovery.savedDays(),areaNotes:await AppData.deletionRecovery.areaNotes(),attachments:await AppData.deletionRecovery.attachments()});
    const restoreId=`restore_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,14)}`;let journalPrepared=false,committedDescription='';
    try{
      OperationDiagnostics.mark('restore-journal-prepare-start');
      await AppData.restoreJournal.prepare({id:restoreId,blob:safetyFile.blob,filename:safetyFile.filename,scheduleText:rollbackScheduleText,savedDayDeletions:rollbackDeletionState.savedDays,areaNoteDeletions:rollbackDeletionState.areaNotes,attachmentDeletions:rollbackDeletionState.attachments});
      journalPrepared=true;OperationDiagnostics.mark('restore-journal-prepare-complete');
      const targetDeletionState=protectedCheckpointDeletionState(parsed),targetSchedule=String(parsed.importedPersonalData&&parsed.importedPersonalData.plans&&parsed.importedPersonalData.plans.draft||parsed.importedActiveSession&&parsed.importedActiveSession.scheduleText||'');
      OperationDiagnostics.mark('canonical-replacement-start');
      const restored=await replacePortableCanonicalSnapshot(parsed,{scheduleText:targetSchedule,deletionState:targetDeletionState,signal,restoreId,requirePersonal:true,phasePrefix:'version-restore'});
      OperationDiagnostics.mark('canonical-replacement-complete',{savedDays:Number(restored&&restored.records)||0,notes:Number(restored&&restored.notes)||0,assets:Number(restored&&restored.assets)||0});
      committedDescription='The selected portable version was written and verified';
      await AppData.restoreJournal.mark(restoreId,'verified');
      OperationDiagnostics.mark('canonical-verification-complete');
      await rebaseRepositoryPreparationAcceleration('replace');
      await AppData.restoreJournal.clear(restoreId);journalPrepared=false;clearFault();
      try{await AppData.reconciliationBase.write(checkpointId,parsed&&parsed.data&&parsed.data.areaNotes||{});}catch(error){AppDiagnostics.capture('backup.version-restore-reconciliation-base',error,'warn');}
      restoreSurfaceStatus(stored,`✓ Backup restored exactly · ${restored.records} Saved Day${restored.records===1?'':'s'} · ${restored.notes} Ongoing Note${restored.notes===1?'':'s'} · ${restored.assets} attachment${restored.assets===1?'':'s'}. Final verification passed.`,true,'local-complete');
      return freeze({cancelled:false,mode:'restore-version',verified:true,changed:true,checkpointId,restored});
    }catch(error){
      const failure=error instanceof Error?error:new Error(String(error));
      if(journalPrepared){
        restoreSurfaceStatus(stored,'Backup restore did not finish. Restoring the verified safety copy…',false,'rollback');
        try{
          OperationDiagnostics.mark('rollback-start');
          await AppData.restoreJournal.mark(restoreId,'rolling-back');
          await rollbackImportedState(rollbackJournal,rollbackScheduleText,rollbackDeletionState);
          await AppData.restoreJournal.mark(restoreId,'rolled-back');
          await AppData.restoreJournal.clear(restoreId);journalPrepared=false;clearFault();OperationDiagnostics.mark('rollback-complete');
          Object.defineProperty(failure,'studyDirectorRollbackDescription',{value:'All restore changes were rolled back from the verified safety copy.',configurable:true});
          committedDescription='';
        }catch(rollbackError){
          failClosed(`Interrupted restore recovery is required: ${rollbackError&&rollbackError.message||rollbackError}`);
          Object.defineProperty(failure,'studyDirectorRollbackDescription',{value:`Automatic rollback also failed: ${rollbackError&&rollbackError.message||rollbackError}. The recovery record was retained; do not clear site data.`,configurable:true});
        }
      }
      Object.defineProperty(failure,'studyDirectorCommittedDescription',{value:committedDescription,configurable:true});
      throw failure;
    }finally{await Exports.run('file.release',{file:safetyFile.blob});}
  });
}
async function restoreManagedVersion(candidate,options={}){
  const owned=!activeImportOperation,operation=activeImportOperation||beginImport();
  try{return await restoreExactVersionWithOperation(candidate,operation,{confirmed:options&&options.confirmed===true,requireManaged:true});}
  finally{try{await candidate.release();}catch(error){AppDiagnostics.capture('backup.version-candidate-release',error,'warn');}if(owned)finishImport(operation);}
}
async function restoreStandaloneVersion(candidate,options={}){
  const owned=!activeImportOperation,operation=activeImportOperation||beginImport();
  try{
    const stored=inspectedBackups.get(candidate),snapshot=stored?candidateSnapshotState(stored):null,parsed=snapshot&&snapshot.parsed||null;
    if(Number(parsed&&parsed.formatVersion)<18||String(parsed&&parsed.captureAuthority||'')!=='canonical-complete'||!parsed.protectedCheckpointManifest)throw new Error('Authoritative replacement requires a current standalone backup with verified complete-capture authority. Combine this backup instead.');
    return await restoreExactVersionWithOperation(candidate,operation,{confirmed:options&&options.confirmed===true,requireManaged:false});
  }finally{try{await candidate.release();}catch(error){AppDiagnostics.capture('backup.file-version-candidate-release',error,'warn');}if(owned)finishImport(operation);}
}
async function recoverInterruptedRestore(){
  const traceId=OperationDiagnostics.start('startup-restore-recovery','Local safety journal');
  let durable;
  try{durable=await AppData.restoreJournal.read();}
  catch(error){failClosed(error&&error.message||String(error));OperationDiagnostics.fail(error,{},traceId);throw error;}
  if(!durable){clearFault();OperationDiagnostics.finish({recovered:false},traceId);return Object.freeze({recovered:false});}
  if(!appCanMutate()){
    failClosed('An interrupted restore is waiting for the tab that holds Study Director control. Reload after taking control before editing data.');
    await Exports.run('file.release',{file:durable.payload.blob});OperationDiagnostics.finish({pending:true},traceId);return Object.freeze({recovered:false,pending:true});
  }
  requireBackupMutationControl('recovering an interrupted restore');
  return runExclusive('restore-recovery',()=>withPersistenceSuppressed(async()=>{
    const recoveryNotice=presentation.begin('file','startup-recovery',{id:'startup-recovery',surfaceId:'library-status',foreground:false,label:'Local recovery',message:'Recovering an interrupted restore from the verified safety copy…'});
    try{
      const parsed=await BackupCodec.inspect(durable.payload.blob,{filename:durable.payload.filename});
      await AppData.restoreJournal.mark(durable.state.id,'startup-rolling-back');
      await rollbackImportedState(parsed,durable.payload.scheduleText,{savedDays:durable.payload.savedDayDeletions,areaNotes:durable.payload.areaNoteDeletions,attachments:durable.payload.attachmentDeletions});
      await AppData.restoreJournal.mark(durable.state.id,'startup-rolled-back');
      await AppData.restoreJournal.clear(durable.state.id);clearFault();
      recoveryNotice.finish({message:'Local recovery completed: the interrupted restore was rolled back and verified before Study Director became writable.',outcome:'local-recovery-completed'});
      OperationDiagnostics.finish({recovered:true},traceId);return Object.freeze({recovered:true});
    }catch(error){
      recoveryNotice.finish({lifecycle:'failed',message:`Interrupted restore recovery could not finish: ${error&&error.message||error}. Preserve browser storage and retry recovery.`});
      failClosed(`Interrupted restore recovery could not finish: ${error&&error.message||error}`);
      OperationDiagnostics.fail(error,{},traceId);throw error;
    }finally{await Exports.run('file.release',{file:durable.payload.blob});}
  }));
}
async function restoreBackupWithOperation(candidate,operation,options={}){
  const maxRebuilds=2,stored=candidate&&typeof candidate==='object'?inspectedBackups.get(candidate):null;
  for(let rebuild=0;;rebuild+=1){
    try{return await restoreBackupAttemptWithOperation(candidate,operation,options);}
    catch(error){
      if(error?.code!=='STUDY_DIRECTOR_RECONCILIATION_STALE'||rebuild>=maxRebuilds)throw error;
      throwIfImportAborted(operation&&operation.signal);
      restoreSurfaceStatus(stored,'Local data changed while differences were being reviewed. Rebuilding the comparison from the latest saved state…',true,'rebuild');
      await yieldImport(operation&&operation.signal);
    }
  }
}
async function restoreBackup(candidate,options={}){
  const owned=!activeImportOperation,operation=activeImportOperation||beginImport();
  try{return await restoreBackupWithOperation(candidate,operation,options);}
  finally{try{await candidate.release();}catch(error){AppDiagnostics.capture('backup.candidate-release',error,'warn');}if(owned)finishImport(operation);}
}
async function importPortableBackup(ev){
  if(activeImportOperation||localExportPromise||localExportRequest)return freeze({cancelled:true,reason:'busy'});
  if(!appCanMutate()){setLocalExportStatus('Study control is in another tab. Take control here before importing.',false);return;}
  const f=ev.target.files&&ev.target.files[0];if(!f)return;
  const traceId=OperationDiagnostics.start('standalone-import','Standalone backup'),operation=beginImport();let candidate=null,consumed=false;
  portablePresentation=presentation.begin('file','import',{label:'File backup',message:'Reading and verifying backup…'});
  try{
    OperationDiagnostics.mark('standalone-inspection-start',{bytes:Number(f.size)||0},traceId);candidate=await inspectBackup(f,{filename:f.name||'',signal:operation.signal});OperationDiagnostics.mark('standalone-inspection-complete',{},traceId);
    const preview=candidate.preview||{},stored=inspectedBackups.get(candidate),snapshot=stored?candidateSnapshotState(stored):null,parsed=snapshot&&snapshot.parsed||null;
    const captureAuthority=String(parsed&&parsed.captureAuthority||'unknown'),exactCapable=Number(parsed&&parsed.formatVersion)>=18&&captureAuthority==='canonical-complete'&&!!parsed&&!!parsed.protectedCheckpointManifest,rescuePartial=captureAuthority==='rescue-partial';
    const restoreChoices=presentation.restoreChoices,choices=[...(preview.reconciliationCapable?[restoreChoices.missing]:[]),restoreChoices.combine,...(exactCapable?[restoreChoices.replace]:[])];
    const decisionDetails=exactCapable?['Choose how this backup should be applied.']:rescuePartial?['This is a verified rescue backup from degraded storage. It can recover available data, but authoritative replacement is disabled.']:['This historical backup can be combined safely, but it does not carry current capture-authority proof for authoritative replacement.'];
    OperationDiagnostics.mark('standalone-decision-start',{},traceId);const mode=await choose({title:'Use this backup',message:`Verified backup${preview.exportedAt?` from ${new Date(preview.exportedAt).toLocaleString('en-IN')}`:''}.`,details:decisionDetails,cancelLabel:'Keep current',choices});
    OperationDiagnostics.mark('standalone-decision-complete',{mode:mode||'keep-current'},traceId);if(!mode){finishPortablePresentation({message:'Backup import cancelled.',lifecycle:'cancelled'});OperationDiagnostics.finish({cancelled:true,stage:'decision'},traceId);return freeze({cancelled:true});}
    consumed=true;OperationDiagnostics.mark('standalone-apply-start',{mode},traceId);
    const result=mode==='replace'?await restoreStandaloneVersion(candidate,{confirmed:true}):await restoreBackup(candidate,{missingOnly:mode==='missing'});OperationDiagnostics.mark('standalone-apply-complete',{mode,cancelled:result&&result.cancelled===true},traceId);
    if(result&&result.reason==='needs-decision'){finishPortablePresentation({message:presentation.restoreChoices.needsDecision,lifecycle:'cancelled'});OperationDiagnostics.finish({cancelled:true,mode},traceId);return result;}
    if(result&&result.cancelled){finishPortablePresentation({message:'Backup import cancelled.',lifecycle:'cancelled'});OperationDiagnostics.finish({cancelled:true,mode},traceId);return result;}
    if(result&&result.verified)setLocalExportStatus(result.changed?`✓ Backup ${mode==='replace'?'restored':mode==='missing'?'added what was missing':'combined'} locally and verified.`:'✓ Backup verified. Nothing was missing.');
    if(result&&result.verified&&!result.cancelled&&result.changed){
      // Locations that back up on their own pick up the restored data.
      try{if(restoredFromFile()===true)setLocalExportStatus(`✓ Backup ${mode==='replace'?'restored':mode==='missing'?'added what was missing':'combined'} locally and verified. Automatic backups will include it shortly.`);}
      catch(error){AppDiagnostics.capture('backup.file-reconciliation-convergence',error,'warn');}
    }
    finishPortablePresentation({outcome:'local-recovery-completed'});OperationDiagnostics.finish({cancelled:!!(result&&result.cancelled),mode,changed:!!(result&&result.changed)},traceId);return result;
  }catch(e){
    const committedDescription=e&&e.studyDirectorCommittedDescription||'';
    const rollbackDescription=e&&e.studyDirectorRollbackDescription||'';
    const partial=committedDescription?` ${committedDescription}; those completed changes were not rolled back.`:'';
    const cancelled=e&&e.code==='STUDY_DIRECTOR_IMPORT_CANCELLED',reason=String(e&&e.message||e),message=(cancelled?'Import cancelled safely: ':'Import failed: ')+reason+partial+(rollbackDescription?' '+rollbackDescription:'');
    setLocalExportStatus(message,false);if(cancelled)OperationDiagnostics.finish({cancelled:true},traceId);else OperationDiagnostics.fail(e,{},traceId);
    finishPortablePresentation({message,lifecycle:cancelled?'cancelled':'failed'});
  }finally{
    if(candidate&&!consumed)try{await candidate.release();}catch(error){AppDiagnostics.capture('backup.file-candidate-release',error,'warn');}
    finishImport(operation);ev.target.value='';
  }
}

const controller=freeze({
  createCheckpoint:(...args)=>track(()=>createCheckpoint(...args),true),
  inspect:(...args)=>track(()=>inspectBackup(...args),true),
  restore:(...args)=>track(()=>restoreBackup(...args),true),
  downloadSafetyCopy:(...args)=>track(()=>downloadSafetyCopy(...args),true),
  // Explicit recovery hook for invalidating cached repository preparation state.
  invalidateRepositoryPreparation:()=>ManagedRepository.invalidatePreparation(),
  markCompleted:markBackupCompleted,
  exportLocal:(...args)=>exportLocalBackup(...args),
  importLocal:(...args)=>track(()=>importPortableBackup(...args),false,'file'),
  beginImport,
  cancelImport,
  cancelStandalone,
  finishImport,
  subscribeStatus,
  recoverInterruptedRestore:(...args)=>track(()=>recoverInterruptedRestore(...args),true),
  status
});
const repository=freeze({
  createPublication:ManagedRepository.createPublication,
  publish:(...args)=>track(()=>ManagedRepository.publish(...args),true),
  // Inline publication is used only when the caller already owns the outer export job.
  publishInline:ManagedRepository.publish,
  inspectManifest:ManagedRepository.inspectManifest,
  inspect:ManagedRepository.inspect,
  bringIn:controller.restore,
  restoreVersion:(...args)=>track(()=>restoreManagedVersion(...args),true),
  verifyCheckpoint:ManagedRepository.verifyCheckpoint,
  verifyObject:ManagedRepository.verifyObject,
  scrub:ManagedRepository.scrub,
  cleanup:ManagedRepository.cleanup,
  inspectCommit:ManagedRepository.inspectCommit,
  retention:ManagedRepository.retention,
  validatePolicy:ManagedRepository.validatePolicy,
  classifyState:ManagedRepository.classifyState,
  activeProtected:ManagedRepository.activeProtected,
  selectRetention:ManagedRepository.selectRetention,
  projectHistory:ManagedRepository.projectHistory,
  noteObject:ManagedRepository.noteObject,
  readNote:ManagedRepository.readNote,
  markCompleted:controller.markCompleted
});
return freeze({controller,repository});
})();
const CheckpointPipeline=freeze({
  create:BackupController.createCheckpoint,inspect:BackupController.inspect,restore:BackupController.restore,markCompleted:BackupController.markCompleted
});
const RepositoryBackgroundProviderPort=freeze({
  format:RepositoryBackgroundModule.format,
  contractVersion:RepositoryBackgroundModule.contractVersion,
  createCoordinator:RepositoryBackgroundModule.createCoordinator,
  maintenance:RepositoryBackgroundModule.maintenance,
  maintenanceActionable:RepositoryBackgroundModule.maintenanceActionable
});
const BackupProviderRuntime=BackupProviderModule.createRuntime(freeze({
  background:RepositoryBackgroundProviderPort,
  repository:RepositoryCheckpointPipeline,
  ports:freeze({
    configuration:freeze({appVersion:APP_VERSION}),
    controller:freeze({beginImport:BackupController.beginImport,cancelImport:BackupController.cancelImport,finishImport:BackupController.finishImport}),
    exports:freeze({run:Exports.run}),
    domain:freeze({clampText}),
    view:freeze({presentation:ports.view.presentation}),
    ownership:freeze({canRunBackground:()=>!appCanMutate()?'awaiting-control':Exports.backgroundAvailable(),requireMutationControl:requireBackupMutationControl}),
    environment:freeze({clearTimeout,setTimeout}),
    diagnostics:freeze({capture:AppDiagnostics.capture,start:OperationDiagnostics.start,mark:OperationDiagnostics.mark,finish:OperationDiagnostics.finish,fail:OperationDiagnostics.fail})
  })
}));
if(!Object.isFrozen(BackupProviderRuntime))throw new Error('Backup provider runtime is unavailable or incompatible.');

    return freeze({
      format:'study-director.backup-runtime',
      contractVersion:1,
      controller:BackupController,
      checkpoint:CheckpointPipeline,
      repository:RepositoryCheckpointPipeline,
      providers:BackupProviderRuntime
    });
  }
  return freeze({format:'study-director.backup-module',contractVersion:1,createRuntime});
});
})();
