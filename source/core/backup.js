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
    configuration:freeze(['appVersion','backupVersion','limits','starterSchedule']),
    persistence:freeze(['activeSessionLoad','activeSessionSave','activeSessionClear','activeSessionSettled','dailyRecordBackupDates','dailyRecordBackupMonth','dailyRecordDocuments','dailyRecordImportBatches','dailyRecordRemove','dailyRecordTimestamp','notesExportPayload','notesReadFreshPayload','notesReadFreshItems','notesFlush','notesNormalizePayload','notesAlignByTitle','notesTrashKey','notesFailure','restoreJournalPrepare','restoreJournalRead','restoreJournalMark','restoreJournalClear','personalSettle','personalExport','personalImport','personalVerify','sourceRevision','snapshotRevision','storageGeneration','canonicalMutationEpochRead','canonicalPreparationRebase','preparationUnitStamps','preparationUnitReplace','installationId','deletionRecoveryFlush','deletionRecoverySavedDays','deletionRecoveryReplaceSavedDays','deletionRecoveryNotes','deletionRecoveryReplaceNotes','deletionRecoveryAttachments','deletionRecoveryReplaceAttachments','deletionRecoveryClearAttachment','reconciliationBaseRead','reconciliationBaseReadNotes','reconciliationBaseReadDays','reconciliationBaseWrite','pendingReviewsList','pendingReviewsReadItems','pendingReviewsMerge','pendingReviewsReplace','pendingReviewsResolve']),
    codecs:freeze(['activeSession','backup','dailyRecord','pendingReview']),
    reconciliation:freeze(['createPlan','resolvePlan','summarizePlan']),
    noteReconciliation:freeze(['resolve','merge']),
    exports:freeze(['backgroundAvailable','protect','unprotect','followProtection','check','scope','job','run','download','chooseSave','save']),
    session:freeze(['canMutate','cancelLiveDraftSave','captureSnapshot','hasActiveSession','hasTasks','toActiveSession','withPersistenceSuppressed','yieldSession']),
    domain:freeze(['clampText','filenameSafeStudentName','getStudentName','materializeDailyRecordView','sanitizeCurrentDailyRecord','todayISO']),
    view:freeze(['presentation','refreshPnote','refreshReview','renderSchedule']),
    events:freeze(['libraryChanged','backupCompleted','reconcileNotes','restoreNotesSnapshot','restoreSessionState','verifyActiveSessionRuntime','restoredFromFile']),
    operations:freeze(['assertAuthority','canShare','clearFault','failClosed','runExclusive']),
    interactions:freeze(['choose','configure','notify']),
    environment:freeze(['AbortController','clearTimeout','setTimeout','yieldTask']),
    diagnostics:freeze(['capture','fail','finish','mark','start']),
    assets:freeze(['get','put','keys','list','importAll','restoreAll','removeMany','removeMetadata','scheduleMaintenance'])
  });
  // Every APP_LIMITS key read below (tests/architecture/app/backup-limits-wiring.mjs).
  const REQUIRED_LIMITS=freeze(['backupChunkItems','backupMaxAssetDescriptors','backupMaxCompressedBytes','backupMaxFileBytes','maxImportRecords','maxNoteLinks','maxNotes','maxPendingReviews']);
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
    // A limit this module reads but was not given would silently become 0
    // or no limit at all, so a missing one stops start-up.
    const missingLimits=REQUIRED_LIMITS.filter(key=>!(Number(ports.configuration.limits[key])>0));
    if(missingLimits.length)throw new TypeError(`Backup configuration is missing limits: ${missingLimits.join(', ')}.`);
    if(!Object.isFrozen(ports.codecs.backup)||!Object.isFrozen(ports.codecs.activeSession)||!Object.isFrozen(ports.codecs.dailyRecord)||typeof ports.codecs.dailyRecord.savedDayCoversSessionEvidence!=='function'||!Object.isFrozen(ports.codecs.pendingReview)){
      throw new TypeError('Backup codecs must be frozen.');
    }
    if(!Object.isFrozen(ports.view.presentation)||['begin','read','feedback','condition','detail','outcome','resolve','reset','subscribe'].some(key=>typeof ports.view.presentation[key]!=='function'))throw new TypeError('Backup presentation port is invalid.');
    const {
      appVersion:APP_VERSION,
      backupVersion,
      starterSchedule:STARTER_SCHEDULE='',
      limits:APP_LIMITS
    }=ports.configuration;
    const {
      activeSessionLoad,activeSessionSave,activeSessionClear,activeSessionSettled,dailyRecordBackupDates,dailyRecordBackupMonth,dailyRecordDocuments,
      dailyRecordImportBatches,dailyRecordRemove,dailyRecordTimestamp,notesExportPayload,notesReadFreshPayload,notesReadFreshItems,notesFlush,
      notesNormalizePayload,notesAlignByTitle,notesTrashKey,notesFailure,restoreJournalPrepare,restoreJournalRead,
      restoreJournalMark,restoreJournalClear,personalSettle,personalExport,personalImport,personalVerify,canonicalMutationEpochRead,canonicalPreparationRebase,preparationUnitStamps,preparationUnitReplace,installationId,deletionRecoveryFlush,deletionRecoverySavedDays,deletionRecoveryReplaceSavedDays,deletionRecoveryNotes,deletionRecoveryReplaceNotes,deletionRecoveryAttachments,deletionRecoveryReplaceAttachments,deletionRecoveryClearAttachment,reconciliationBaseRead,reconciliationBaseReadNotes,reconciliationBaseReadDays,reconciliationBaseWrite,pendingReviewsList,pendingReviewsReadItems,pendingReviewsMerge,pendingReviewsReplace,pendingReviewsResolve
    }=ports.persistence;
    const {activeSession:ActiveSessionCodec,backup:BackupCodec,dailyRecord:DailyRecordCodec,pendingReview:PendingReviewCodec}=ports.codecs;
    const Reconciliation=ports.reconciliation;
    const NoteReconciliation=ports.noteReconciliation;
    const Exports=ports.exports;
    const {canMutate:appCanMutate,cancelLiveDraftSave,captureSnapshot:captureSessionSnapshot,hasActiveSession,hasTasks,toActiveSession:activeSessionPayload,withPersistenceSuppressed,yieldSession}=ports.session;
    const {clampText,filenameSafeStudentName,getStudentName:getStudentNameFromDisplay,materializeDailyRecordView,sanitizeCurrentDailyRecord,todayISO}=ports.domain;
    const {refreshPnote,refreshReview,renderSchedule:renderSched}=ports.view;
    const {libraryChanged,backupCompleted,reconcileNotes,restoreNotesSnapshot,restoreSessionState,verifyActiveSessionRuntime,restoredFromFile}=ports.events;
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
      pendingReviews:freeze({list:pendingReviewsList,readItems:pendingReviewsReadItems,merge:pendingReviewsMerge,replace:pendingReviewsReplace,resolve:pendingReviewsResolve}),
      provenance:freeze({installationId}),mutationEpoch:freeze({read:canonicalMutationEpochRead,rebasePreparation:canonicalPreparationRebase}),preparationUnits:freeze({list:preparationUnitStamps,replace:preparationUnitReplace}),deletionRecovery:freeze({flush:deletionRecoveryFlush,savedDays:deletionRecoverySavedDays,replaceSavedDays:deletionRecoveryReplaceSavedDays,notes:deletionRecoveryNotes,replaceNotes:deletionRecoveryReplaceNotes,attachments:deletionRecoveryAttachments,replaceAttachments:deletionRecoveryReplaceAttachments,clearAttachment:deletionRecoveryClearAttachment}),reconciliationBase:freeze({read:reconciliationBaseRead,readNotes:reconciliationBaseReadNotes,readDays:reconciliationBaseReadDays,write:reconciliationBaseWrite})
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
function beginImport({backgroundPreemptible=false}={}){
  if(activeImportOperation)return activeImportOperation;
  const controller=new AbortController(),id=++importSequence;
  activeImportOperation=freeze({id,backgroundPreemptible:backgroundPreemptible===true,signal:controller.signal,cancel:reason=>{if(!controller.signal.aborted)controller.abort(importAbortError(reason));}});
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
function status(){return Object.freeze({busy:activeOperations>0,activeOperations,importActive:!!activeImportOperation,importHoldsBackground:!!activeImportOperation&&!activeImportOperation.backgroundPreemptible,importCancelled:!!activeImportOperation?.signal.aborted,standaloneExportActive:!!localExportPromise||!!localExportRequest});}
async function track(operation,wait=false,surface='managed'){activeOperations+=1;try{return await Exports.job(operation,{wait,surface});}finally{activeOperations=Math.max(0,activeOperations-1);}}
const BackupCapture=BackupCaptureModule.create(freeze({
  configuration:freeze({backupVersion,limits:APP_LIMITS,portableAssets}),
  data:freeze({
    activeSession:freeze({save:AppData.activeSession.save,settled:AppData.activeSession.settled,load:AppData.activeSession.load}),
    dailyRecords:freeze({backupDates:AppData.dailyRecords.backupDates,backupMonth:AppData.dailyRecords.backupMonth}),
    notes:freeze({flush:AppData.notes.flush,failure:AppData.notes.failure,readFreshPayload:AppData.notes.readFreshPayload,exportPayload:AppData.notes.exportPayload,readFreshItems:AppData.notes.readFreshItems}),
    deletionRecovery:freeze({flush:AppData.deletionRecovery.flush,savedDays:AppData.deletionRecovery.savedDays,notes:AppData.deletionRecovery.notes,attachments:AppData.deletionRecovery.attachments}),
    mutationEpoch:freeze({read:AppData.mutationEpoch.read}),preparationUnits:freeze({list:AppData.preparationUnits.list,replace:AppData.preparationUnits.replace}),provenance:freeze({installationId:AppData.provenance.installationId}),
    pendingReviews:freeze({list:AppData.pendingReviews.list,readItems:AppData.pendingReviews.readItems})
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
  for(const group of BackupCodec.splitItems(plan.noteItems))yield await emit('note',group);
  if(plan.activeSession)yield await emit('activeSession',[plan.activeSession]);
  if(plan.personalData)yield await emit('personalData',[plan.personalData]);
  for(const group of BackupCodec.splitItems(plan.pendingReviewItems||[]))yield await emit('pendingReview',group);
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
  return freeze({...file,exportedAt:plan.exportedAt,sourceRevision:plan.sourceRevision,warning:plan.warning,attachmentsComplete:plan.completeness?.fullyRecoverable===true,counts:freeze({...plan.counts})});
}
const LogicalCheckpointCapture=freeze({capture:captureLogicalCheckpoint});
const PortableCheckpointMaterializer=freeze({materialize:materializePortableCheckpoint});

const ManagedRepository=ManagedRepositoryModule.createEngine(freeze({
  codec:BackupCodec,
  ports:freeze({
    configuration:freeze({backupVersion,limits:APP_LIMITS,logicalCaptureFormat:LOGICAL_CHECKPOINT_CAPTURE_FORMAT,logicalCaptureVersion:LOGICAL_CHECKPOINT_CAPTURE_VERSION}),
    persistence:freeze({reconciliationBaseRead:AppData.reconciliationBase.read,reconciliationBaseWrite:AppData.reconciliationBase.write,personalFingerprint:value=>personalFingerprint(value),personalFields:value=>personalFields(value),dayFingerprints:records=>dayFingerprintMonths(records),sessionFingerprint:value=>sessionFingerprint(value)}),
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
function portableCopy(file,verified){return freeze({source:'file',sourceRevision:String(file&&file.sourceRevision||''),verified,attachmentsComplete:file?.attachmentsComplete===true});}
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
  // Mutation receipts come from canonical storage after its own normalization.
  // The resolved intent is checked before the receipt is trusted.
  const storedDeletions=deletionLedgerChanged?freeze([...(await AppData.deletionRecovery.savedDays())]):null;
  let committedRecords=freeze([]);
  if(recordsToSave.length){
    committedRecords=freeze(currentDailyRecords(await getDailyRecordDocumentsByDates(recordsToSave.map(record=>record.date)),'Committed Saved Days'));
    const byDate=new Map(committedRecords.map(record=>[record.date,record]));
    for(const record of recordsToSave){
      const intended=sanitizeCurrentDailyRecord(record),committed=byDate.get(record.date);
      if(!intended||!committed||!Canonical.same(committed,intended))throw new Error(`Saved-Day reconciliation commit did not match the resolved state for ${record.date}.`);
    }
  }
  if(deletionsToApply.length){
    const lingering=await getDailyRecordDocumentsByDates(deletionsToApply.map(item=>item.date));
    if(lingering.length)throw new Error(`Saved-Day reconciliation did not commit ${lingering.length} selected deletion${lingering.length===1?'':'s'}.`);
  }
  const added=items.filter(item=>item.changed&&item.state==='record'&&!item.hadLocal).length;
  const replaced=items.filter(item=>item.changed&&item.state==='record'&&item.hadLocal).length;
  const kept=items.filter(item=>{const planItem=planItems.get(item.date);return !!(planItem&&planItem.conflict&&planItem.localCandidateId&&item.candidateId===planItem.localCandidateId);}).length;
  const identical=[...planItems.values()].filter(item=>item.identical).length;
  return freeze({changed:recordsToSave.length>0||deletionsToApply.length>0||deletionLedgerChanged,count:added,replaced,deleted,kept,identical,batches,appliedRecords:committedRecords,removedRecordDates:freeze(deletionsToApply.map(item=>item.date).sort()),expectedDeletions:storedDeletions});
}
async function applyResolvedNotes(resolvedPlan){
  const changed=(resolvedPlan&&resolvedPlan.notes||[]).filter(item=>item.changed),writes=changed.filter(item=>item.state==='record'&&item.value&&typeof item.value==='object'),deletions=changed.filter(item=>item.state==='deleted'&&item.deletedAt).map(item=>freeze({key:item.key,deletedAt:item.deletedAt}));
  if(!writes.length&&!deletions.length)return {message:'',changed:false,expectedItems:null,expectedDeletions:null,count:0,deleted:0};
  requireBackupMutationControl('reconciling notes');
  const before=AppData.notes.normalizePayload(await AppData.notes.readFreshPayload()),payload=Object.create(null);for(const item of writes)payload[item.key]=item.value;
  const committed=await reconcileNotes(AppData.notes.normalizePayload(payload),deletions);
  if(!committed||typeof committed!=='object'||Array.isArray(committed))throw new Error('Note reconciliation did not return a canonical committed payload.');
  const expected=AppData.notes.normalizePayload(committed),keys=[...new Set([...Object.keys(before),...Object.keys(expected)])].filter(key=>!Canonical.same(before[key]||null,expected[key]||null)).sort();
  const expectedItems=freeze(keys.map(key=>freeze({key,value:expected[key]||null}))),expectedDeletions=freeze([...(await AppData.deletionRecovery.notes())]),count=writes.filter(item=>notesTrashKey(item.key)).length,deleted=deletions.filter(item=>notesTrashKey(item.key)).length;
  const parts=[count?`${count} note${count===1?'':'s'} updated`:'',deleted?`${deleted} note${deleted===1?'':'s'} moved to Recently deleted`:''].filter(Boolean);
  return {message:parts.length?` · ${parts.join(' · ')}`:'',changed:true,expectedItems,expectedDeletions,count,deleted};
}
async function applyResolvedActiveSession(resolvedPlan,{clear=false}={}){
  const resolved=resolvedPlan&&resolvedPlan.activeSession;
  // Active Session reconciliation owns only session/runtime state. The Plan
  // working draft is portable Personal Data and is never transported through
  // this path.
  if(clear&&resolved&&resolved.value){requireBackupMutationControl('reconciling the active session');await restoreSessionState(null);return {message:' and active session',changed:true,expected:null};}
  if(!resolved||!resolved.changed||!resolved.value)return {message:'',changed:false,expected:null};
  requireBackupMutationControl('reconciling the active session');
  const expected=ActiveSessionCodec.sanitizeCurrent(resolved.value);
  if(!expected)throw new Error('Resolved Active Session is invalid.');
  await restoreSessionState(expected);
  return {message:' and active session',changed:true,expected};
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
  await runRestorePreflightStage('notes','RESTORE_PREFLIGHT_NOTES_FAILED','Notes could not be safely saved before comparing backup differences.',async()=>{
    await AppData.notes.flush({strict:true});
    const noteFailure=AppData.notes.failure();
    if(noteFailure&&noteFailure.failed)throw new Error(noteFailure.message||'Notes are not safely stored yet.');
    return true;
  });
  await runRestorePreflightStage('deletions','RESTORE_PREFLIGHT_DELETION_FAILED','Deletion recovery state could not be safely saved before comparing backup differences.',async()=>{if(await AppData.deletionRecovery.flush()!==true)throw new Error('Pending deletion recovery remains incomplete.');return true;});
  await runRestorePreflightStage('personal','RESTORE_PREFLIGHT_PERSONAL_FAILED','Plan and preference data could not be safely settled before comparing backup differences.',()=>personalSettle());
  await runRestorePreflightStage('session-save','RESTORE_PREFLIGHT_SESSION_SAVE_FAILED','The active session could not be safely saved before comparing backup differences.',async()=>{
    if(!(appCanMutate()&&TASKS.length))return false;
    cancelLiveDraftSave();
    const snapshot=captureSessionSnapshot(),candidate=snapshot?activeSessionPayload(snapshot):null;
    if(!candidate)return false;
    const result=await AppData.activeSession.save(candidate,{strictDurability:true});
    if(!result?.ok||result.error||result.storage?.idb!==true)
      throw result?.error||new Error('Active Session reconciliation requires a canonical IndexedDB commit.');
    const confirmed=await readCanonicalActiveSession();
    if(confirmed.storage?.idb!==true||
        !Canonical.same(ActiveSessionCodec.sanitizeCurrent(confirmed.value),ActiveSessionCodec.sanitizeCurrent(result.value)))
      throw new Error('Active Session reconciliation did not read back the exact committed state.');
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
    const scope={session:options.missingOnly!==true&&!options.note&&!options.holdSession},before=await captureRestoreReconciliationRevision(relevantDates,scope);
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

async function buildRestoreReconciliationPlan(parsed,preview,{missingOnly=false,note='',holdSession=false}={}){
  // A one-note restore compares only that note: no Saved Days, deletions or
  // session, and every other note stays exactly as it is on this device.
  const records=note?[]:normalizeImportedDailyRecordSet(parsed&&parsed.records||[]).records;
  const checkpointDeletions=!note&&parsed&&parsed.protectedCheckpointManifest&&Array.isArray(parsed.protectedCheckpointManifest.savedDayDeletions)?parsed.protectedCheckpointManifest.savedDayDeletions:[];
  const checkpointNoteDeletions=!note&&parsed&&parsed.protectedCheckpointManifest&&Array.isArray(parsed.protectedCheckpointManifest.noteDeletions)?parsed.protectedCheckpointManifest.noteDeletions:[];
  const relevantDates=[...new Set([...records.map(record=>record.date),...checkpointDeletions.map(entry=>entry.date)])];
  const localRecords=currentDailyRecords(await getDailyRecordDocumentsByDates(relevantDates),'Local reconciliation Daily Records');
  const allLocalDeletions=await AppData.deletionRecovery.savedDays(),relevantDateSet=new Set(relevantDates);
  const localDeletions=allLocalDeletions.filter(entry=>relevantDateSet.has(entry.date));
  const localNotes=AppData.notes.normalizePayload(await AppData.notes.readFreshPayload()),allLocalNoteDeletions=await AppData.deletionRecovery.notes();
  // Missing-only recovery adds back what this device lacks (Saved Days,
  // attachments) and never offers the backup's notes or session.
  const backupNotes=missingOnly?Object.create(null):AppData.notes.alignByTitle(parsed&&parsed.data&&parsed.data.notes||{},allLocalNoteDeletions.map(entry=>entry.key)),incomingNotes=note?Object.create(null):backupNotes;
  if(note&&Object.prototype.hasOwnProperty.call(backupNotes,note))incomingNotes[note]=backupNotes[note];
  const loadedSession=await readCanonicalActiveSession(),localSession=loadedSession&&loadedSession.value||null;
  const currentCheckpoint=Number(parsed&&parsed.formatVersion)>=15&&!!parsed.protectedCheckpointManifest;
  const rawIncomingSession=parsed&&parsed.importedActiveSession||null;
  const incomingSession=note?null:currentCheckpoint?rawIncomingSession:(rawIncomingSession&&rawIncomingSession.date===todayISO()?rawIncomingSession:null);
  const backupAt=Date.parse(String(preview&&preview.exportedAt||'')),incomingLabel=note&&Number.isFinite(backupAt)?`Backup from ${new Date(backupAt).toLocaleString(undefined,{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}`:currentCheckpoint?'Backup copy':(preview&&preview.filename||'Backup file');
  const checkpointId=String(parsed&&parsed.protectedCheckpointManifest&&parsed.protectedCheckpointManifest.checkpointId||preview&&preview.checkpoint&&preview.checkpoint.checkpointId||'incoming');
  return Reconciliation.createPlan({
    local:{id:'local',label:'This device',savedDays:localRecords,savedDayDeletions:localDeletions,notes:localNotes,noteDeletions:allLocalNoteDeletions,activeSession:localSession},
    incoming:{id:checkpointId,label:incomingLabel,savedDays:records,savedDayDeletions:checkpointDeletions,notes:incomingNotes,noteDeletions:missingOnly?[]:checkpointNoteDeletions,activeSession:missingOnly||holdSession?null:incomingSession}
  });
}
function savedDayChoiceLabel(candidate){
  const source=candidate.sources.find(item=>item.local)||candidate.sources[0],local=!!source&&source.local;
  if(candidate.kind==='deleted')return local?'Keep deleted':`Apply deletion from ${source?.label||'backup'}`;
  return local?'Keep this device’s Saved Day':`Use ${source?.label||'Backup copy'} Saved Day`;
}
// "12 Saved Days · 1 note".
function savedDaysAndNotes(counts){const days=Number(counts&&counts.dailyRecord)||0,notes=Number(counts&&counts.note)||0;return `${days} Saved Day${days===1?'':'s'} · ${notes} note${notes===1?'':'s'}`;}
function savedDayDecisionTimestamp(value){
  const parsed=Date.parse(String(value||''));if(!Number.isFinite(parsed))return '';
  try{return new Date(parsed).toLocaleString(undefined,{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});}catch{return new Date(parsed).toISOString();}
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
function savedDayNeedsWholeDecision(item,settled=null){
  if(!item?.conflict||settled&&settled.has(item.date))return false;
  const pair=savedDayRecordPair(item);if(!pair)return true;
  const localKind=pair.local.record?.recordKind,incomingKind=pair.incoming.record?.recordKind;
  if(localKind==='diary'&&incomingKind==='diary')return false;
  if(localKind!==incomingKind&&[localKind,incomingKind].includes('study')&&[localKind,incomingKind].includes('diary'))return false;
  if(localKind==='study'&&incomingKind==='study'&&Canonical.same(savedDayStudyState(pair.local.record),savedDayStudyState(pair.incoming.record)))return false;
  return true;
}
function savedDayPreferredCandidate(item,decisions={},settled=null){
  if(settled&&settled.has(item.date))return item.candidates.find(candidate=>candidate.id===settled.get(item.date))||null;
  const selected=decisions&&decisions[item.decisionKey];if(selected){const found=item.candidates.find(candidate=>candidate.id===selected);if(found)return found;}
  const pair=savedDayRecordPair(item);
  if(pair){
    const study=[pair.local,pair.incoming].find(candidate=>candidate.record?.recordKind==='study'),diary=[pair.local,pair.incoming].find(candidate=>candidate.record?.recordKind==='diary');
    if(study&&diary)return study;
  }
  return item.candidates.find(candidate=>candidate.id===item.defaultCandidateId)||item.candidates[0]||null;
}
function savedDayReflectionConflicts(plan,settled=null){
  const conflicts=[];
  for(const item of plan.savedDays){
    const pair=savedDayRecordPair(item);if(!pair||settled&&settled.has(item.date))continue;
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
function savedDayBulkDecisionGroup(plan,settled=null){
  const conflicts=plan.savedDays.filter(item=>savedDayNeedsWholeDecision(item,settled));if(conflicts.length<2)return null;
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
  if(candidate.kind==='deleted')return candidate.local?freeze({label:'Keep it deleted',description:'The backup’s copy is not added.'}):freeze({label:'Delete it',description:'This device’s copy moves to Recently deleted.'});
  return candidate.local?freeze({label:'Keep this device’s note',description:'The note stays as it is on this device.'}):freeze({label:'Bring back the backup’s note',description:'The backup’s copy of this note is added.'});
}
function activeSessionChoiceLabel(candidate){
  const source=candidate.sources.find(item=>item.local)||candidate.sources[0];
  return source?.local?'Keep this device’s session':`Use session from ${source?.label||'backup'}`;
}
// What both sides last shared: the shared base this device last synced, when
// the backup descends from it, else null.
async function lastSharedBase(stored){
  const snapshot=candidateSnapshotState(stored),manifest=snapshot&&snapshot.provenance&&snapshot.provenance.repositoryManifest,repositoryBaseId=String(manifest&&manifest.reconciliationBaseId||'');if(!repositoryBaseId)return null;
  const ancestorIds=Array.isArray(manifest.reconciliationAncestorIds)&&manifest.reconciliationAncestorIds.length?manifest.reconciliationAncestorIds:[repositoryBaseId];
  const localBase=await AppData.reconciliationBase.read().catch(()=>null);
  return localBase&&ancestorIds.includes(String(localBase.checkpointId||''))?localBase:null;
}
// Each note's title and text in the shared base.
async function noteReconciliationAncestor(base,keys=[]){
  if(!base)return null;
  const notes=keys.length?await AppData.reconciliationBase.readNotes(keys).catch(()=>freeze({})):freeze({});
  return freeze({checkpointId:String(base.checkpointId),notes});
}
// Exact per-field causal evidence for one verified Portable Personal Data
// snapshot. Absence, null, and an authored value have distinct hashes.
const PERSONAL_PREFERENCE_KEYS=freeze(['studentName','theme','presentation','quote','practiceCueMode','fontScale','practiceTargetMs','soundMode']);
const PERSONAL_NUDGE_KEYS=freeze(['present','enabled','sound','nudgeAfter','breakMinutes']);
function semanticSavedPlan(plan){
  return plan?{id:plan.id,label:plan.label,scheduleText:plan.scheduleText}:null;
}
async function personalFieldFingerprint(present,value=null){
  return valueFingerprint({present:present===true,value:present===true?value:null});
}
async function personalFields(value){
  if(!value)return null;
  const clean=BackupCodec.normalizePersonalData(value);if(!clean)throw new Error('Verified Personal Data is unavailable for field ancestry.');
  const preferences=Object.create(null),nudge=Object.create(null),savedPlans=Object.create(null),
    own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key),nudged=clean.preferences.nudge!==null,
    order=clean.plans.savedPlans.map(plan=>plan.id);
  await Promise.all([
    ...PERSONAL_PREFERENCE_KEYS.map(async key=>{preferences[key]=await personalFieldFingerprint(own(clean.preferences,key),clean.preferences[key]);}),
    ...PERSONAL_NUDGE_KEYS.map(async key=>{
      nudge[key]=key==='present'?await personalFieldFingerprint(true,nudged):
        await personalFieldFingerprint(nudged&&own(clean.preferences.nudge,key),nudged?clean.preferences.nudge[key]:null);
    }),
    ...clean.plans.savedPlans.map(async plan=>{savedPlans[plan.id]=await personalFieldFingerprint(true,semanticSavedPlan(plan));})
  ]);
  const [draft,defaultId,savedPlanOrder]=await Promise.all([
    personalFieldFingerprint(true,clean.plans.draft),
    personalFieldFingerprint(true,clean.plans.defaultId),
    personalFieldFingerprint(true,order)
  ]);
  return freeze({format:'study-director.reconciliation-personal-fields',version:1,
    preferences:freeze(preferences),nudge:freeze(nudge),draft,defaultId,savedPlanOrder,
    savedPlans:freeze(savedPlans),order:freeze(order)});
}
// Plans and settings are compared as one unit by fingerprint.
async function personalFingerprint(value){return value?String(await Exports.run('checksum',{value:Canonical.signature(value),algorithm:'sha256'})):'';}
// 'replace' or 'keep' when only one side changed plans and settings since the
// shared base; null when they match, both changed, or there is no shared history.
async function personalSettled(base,local,incoming){
  const shared=String(base&&base.personalFingerprint||'');if(!shared||!local||!incoming)return null;
  const [mine,theirs]=await Promise.all([personalFingerprint(local),personalFingerprint(incoming)]);
  return mine===theirs?null:mine===shared?'replace':theirs===shared?'keep':null;
}
// A three-way decision is possible only when the last verified shared
// checkpoint retained the exact per-field hashes. An absent plan is hashed
// as absence; a null, a missing optional field and an authored value differ.
async function reconcilePersonalFields(base,local,incoming){
  const ancestry=base?.personalFields;
  if(!ancestry||ancestry.version!==1||!local||!incoming)return null;
  const mine=BackupCodec.normalizePersonalData(local),theirs=BackupCodec.normalizePersonalData(incoming);
  if(!mine||!theirs)return null;
  // Hash all independent paths concurrently. Comparing their verified
  // digests does not reread Personal Data or change the stored ancestor.
  const [left,right,absent]=await Promise.all([personalFields(mine),personalFields(theirs),personalFieldFingerprint(false)]);
  let conflicts=0;
  const choose=(localPresent,localValue,remotePresent,remoteValue,baseHash,localHash,remoteHash)=>{
    if(localHash===remoteHash||remoteHash===baseHash)return freeze({present:localPresent,value:localValue});
    if(localHash===baseHash)return freeze({present:remotePresent,value:remoteValue});
    conflicts++;return freeze({present:localPresent,value:localValue});
  };
  const prefs={...mine.preferences},own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
  for(const key of PERSONAL_PREFERENCE_KEYS){
    const chosen=choose(own(mine.preferences,key),mine.preferences[key],own(theirs.preferences,key),theirs.preferences[key],
      ancestry.preferences[key],left.preferences[key],right.preferences[key]);
    if(chosen.present)prefs[key]=chosen.value;else delete prefs[key];
  }
  const localNudge=mine.preferences.nudge,remoteNudge=theirs.preferences.nudge;
  const present=choose(true,localNudge!==null,true,remoteNudge!==null,
    ancestry.nudge.present,left.nudge.present,right.nudge.present).value;
  if(!present)prefs.nudge=null;
  else{
    const nudge={};
    for(const key of PERSONAL_NUDGE_KEYS.slice(1)){
      const l=localNudge!==null&&own(localNudge,key),i=remoteNudge!==null&&own(remoteNudge,key),
        chosen=choose(l,l?localNudge[key]:null,i,i?remoteNudge[key]:null,
          ancestry.nudge[key],left.nudge[key],right.nudge[key]);
      if(chosen.present)nudge[key]=chosen.value;
    }
    prefs.nudge=nudge;
  }
  const draft=choose(true,mine.plans.draft,true,theirs.plans.draft,
      ancestry.draft,left.draft,right.draft).value,
    defaultId=choose(true,mine.plans.defaultId,true,theirs.plans.defaultId,
      ancestry.defaultId,left.defaultId,right.defaultId).value,
    localPlans=new Map(mine.plans.savedPlans.map(plan=>[plan.id,plan])),
    remotePlans=new Map(theirs.plans.savedPlans.map(plan=>[plan.id,plan])),plans=new Map(),
    allIds=new Set([...ancestry.order,...localPlans.keys(),...remotePlans.keys()]);
  for(const id of allIds){
    const hasLocal=localPlans.has(id),hasRemote=remotePlans.has(id),
      original=choose(hasLocal,semanticSavedPlan(localPlans.get(id)),hasRemote,semanticSavedPlan(remotePlans.get(id)),
        ancestry.savedPlans[id]||absent,left.savedPlans[id]||absent,right.savedPlans[id]||absent);
    if(original.present){
      const record=original.value&&original.value.id===id?
        (hasLocal&&Canonical.same(semanticSavedPlan(localPlans.get(id)),original.value)?localPlans.get(id):remotePlans.get(id)):null;
      if(!record){conflicts++;if(hasLocal)plans.set(id,localPlans.get(id));}
      else plans.set(id,record);
    }
  }
  // Additions to the saved-plan list need not be mistaken for an ordering
  // conflict. Compare relative order only for unchanged baseline identities
  // still present on both sides, then append independent additions.
  const shared=new Set(ancestry.order.filter(id=>localPlans.has(id)&&remotePlans.has(id))),
    baselineOrder=ancestry.order.filter(id=>shared.has(id)),
    localOrder=mine.plans.savedPlans.map(plan=>plan.id),
    remoteOrder=theirs.plans.savedPlans.map(plan=>plan.id),
    localRelative=localOrder.filter(id=>shared.has(id)),
    remoteRelative=remoteOrder.filter(id=>shared.has(id)),
    localReordered=!Canonical.same(localRelative,baselineOrder),
    remoteReordered=!Canonical.same(remoteRelative,baselineOrder);
  if(localReordered&&remoteReordered&&!Canonical.same(localRelative,remoteRelative))conflicts++;
  const preferred=!localReordered&&remoteReordered?remoteOrder:localOrder,
    order=[...new Set([...preferred,...remoteOrder,...localOrder,...ancestry.order])].filter(id=>plans.has(id)),
    result={version:2,preferences:prefs,plans:{draft,defaultId,savedPlans:order.map(id=>plans.get(id))}};
  // A changed setting may be individually safe while its combined Plan
  // default or reminder settings are invalid. Leave both sides reviewable.
  if(plans.size>100)return freeze({value:mine,conflict:true,valid:false});
  let canonical=null;
  try{canonical=BackupCodec.normalizePersonalData(result);}catch{}
  if(!canonical)return freeze({value:mine,conflict:true,valid:false});
  return freeze({value:canonical,conflict:conflicts>0,valid:true});
}
// True when one side's plans and settings hold nothing the other's lack:
// each setting unset or equal, the draft empty, the starter plan or equal,
// every saved plan present and identical, and the default plan unset or equal.
function personalIsBlank(value){
  let clean=null;try{clean=BackupCodec.normalizePersonalData(value);}catch{return false;}
  return !!clean&&clean.plans.draft===null&&clean.plans.defaultId===null&&!clean.plans.savedPlans.length&&
    Object.values(clean.preferences).every(setting=>setting===null||setting===undefined);
}
function personalAddsNothing(side,other){
  let a,b;try{a=BackupCodec.normalizePersonalData(side);b=BackupCodec.normalizePersonalData(other);}catch{return false;}if(!a||!b)return false;
  if(Object.entries(a.preferences).some(([key,value])=>value!==null&&!Canonical.same(value,b.preferences[key])))return false;
  // A canonical non-null draft is authored data, even if it happens to
  // equal the starter template. Only null proves the default is unsaved.
  if(a.plans.draft!==null&&a.plans.draft!==b.plans.draft)return false;
  if(a.plans.defaultId!==null&&a.plans.defaultId!==b.plans.defaultId)return false;
  const plans=new Map(b.plans.savedPlans.map(plan=>[plan.id,plan]));
  return a.plans.savedPlans.every(plan=>plans.has(plan.id)&&Canonical.same(plan,plans.get(plan.id)));
}
// The base keeps one fingerprint per Saved Day and one for the Active
// Session. Both sides are fingerprinted the same way, so a side whose
// fingerprint matches the base has not changed it since.
const fingerprintEncoder=new TextEncoder();
async function valueFingerprint(value){
  if(!value)return '';
  const digest=await globalThis.crypto.subtle.digest('SHA-256',fingerprintEncoder.encode(Canonical.signature(value)));
  return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
function dayFingerprint(record){return valueFingerprint(record?sanitizeCurrentDailyRecord(record)||record:null);}
// The persisted reconciliation baseline retains the exact canonical Active
// Session fingerprint. Changing that meaning in place would corrupt ancestry.
// Handoff causality has its own semantic-content fingerprint below.
function sessionFingerprint(session){return valueFingerprint(session?ActiveSessionCodec.sanitizeCurrent(session)||session:null);}
function sessionContentFingerprint(session){return valueFingerprint(ActiveSessionCodec.contentValue(session));}
function sameSessionContent(a,b){
  const left=ActiveSessionCodec.contentValue(a),right=ActiveSessionCodec.contentValue(b);
  return !!left&&!!right&&Canonical.same(left,right);
}
function nextMergedSessionRevision(...values){
  const current=Math.max(0,...values.map(value=>Math.max(0,Math.round(Number(value)||0))));
  if(current>=Number.MAX_SAFE_INTEGER)throw new Error('Active Session revision space is exhausted.');
  return current+1;
}
function sessionFullyAcknowledged(session){
  const clean=ActiveSessionCodec.sanitizeCurrent(session),snapshot=clean&&clean.snapshot;
  const contentRevision=Number(snapshot&&snapshot.contentRevision),savedRevision=Number(snapshot&&snapshot.savedRevision);
  return !!clean&&Number.isSafeInteger(contentRevision)&&contentRevision>=0&&Number.isSafeInteger(savedRevision)&&savedRevision>=contentRevision;
}
// When semantic content is identical, a verified save acknowledgement is safe
// to carry across control metadata/counter differences. This is not revision
// arithmetic across branches: it means only "this exact semantic content has
// already been materialized as a Saved Day".
function mergeSessionAcknowledgement(control,peer){
  const winner=ActiveSessionCodec.sanitizeCurrent(control),other=ActiveSessionCodec.sanitizeCurrent(peer);
  if(!winner||!other||!sameSessionContent(winner,other)||sessionFullyAcknowledged(winner)||!sessionFullyAcknowledged(other))return winner;
  const now=new Date().toISOString(),snapshot=freeze({...winner.snapshot,savedRevision:winner.snapshot.contentRevision,updatedAt:now});
  return ActiveSessionCodec.sanitizeCurrent({...winner,revision:nextMergedSessionRevision(winner.revision,other.revision),snapshot,updatedAt:now});
}
// Incoming content can advance after a device has claimed ownership. Preserve
// the current owner's control state while adopting that later pre-claim work,
// and start a fresh local content revision so no foreign save acknowledgement
// is mistaken for this derived state.
function rebaseSessionContentToOwner(local,incoming){
  const mine=ActiveSessionCodec.sanitizeCurrent(local),theirs=ActiveSessionCodec.sanitizeCurrent(incoming);
  if(!mine||!theirs||mine.date!==theirs.date)return null;
  const now=new Date().toISOString(),snapshot=freeze({
    ...theirs.snapshot,
    contentRevision:nextMergedSessionRevision(mine.snapshot.contentRevision,theirs.snapshot.contentRevision),
    savedRevision:0,
    updatedAt:now
  });
  return ActiveSessionCodec.sanitizeCurrent({
    ...theirs,
    revision:nextMergedSessionRevision(mine.revision,theirs.revision),
    status:mine.status,
    runningOn:mine.runningOn,
    snapshot,
    suspendedAt:mine.status==='suspended'?mine.suspendedAt:null,
    updatedAt:now
  });
}
// {month: {date: fingerprint}} for these Saved Days.
async function dayFingerprintMonths(records){
  const months=Object.create(null);
  for(const record of records||[]){const date=String(record&&record.date||'');if(!/^\d{4}-\d{2}-\d{2}$/u.test(date))continue;const month=date.slice(0,7);(months[month]||(months[month]=Object.create(null)))[date]=await dayFingerprint(record);}
  for(const month of Object.keys(months))months[month]=freeze(months[month]);
  return freeze(months);
}
// The base a whole version leaves behind when this device takes it in.
async function sharedBaseUpdate(parsed){
  const notes=AppData.notes.normalizePayload(parsed&&parsed.data&&parsed.data.notes||{}),noteKeys=Object.keys(notes).sort(),updates=Object.create(null);
  for(const key of noteKeys)updates[key]=freeze({label:String(notes[key].label||''),text:String(notes[key].text||'')});
  const records=normalizeImportedDailyRecordSet(parsed&&parsed.records||[]).records;
  return freeze({format:'study-director.reconciliation-base-update',version:3,full:true,baseCheckpointId:'',noteCount:noteKeys.length,noteKeyFingerprint:'',personalFingerprint:await personalFingerprint(parsed&&parsed.importedPersonalData),personalFields:await personalFields(parsed&&parsed.importedPersonalData),sessionFingerprint:await sessionFingerprint(parsed&&parsed.importedActiveSession||null),noteKeys:freeze(noteKeys),updates:freeze(updates),deletes:freeze([]),days:await dayFingerprintMonths(records)});
}
// Saved Days that differ and that one side has not changed since the shared
// base: that side takes the other's (a record or a deletion).
async function savedDaySettlement(plan,base){
  const settled=new Map(),items=base?plan.savedDays.filter(item=>item.conflict):[];if(!items.length)return settled;
  const shared=await AppData.reconciliationBase.readDays(items.map(item=>item.date)).catch(()=>freeze({}));
  for(const item of items){
    const local=item.candidates.find(candidate=>candidate.local),incoming=item.candidates.find(candidate=>!candidate.local);if(!local||!incoming)continue;
    const baseValue=String(shared[item.date]||''),[mine,theirs]=await Promise.all([local,incoming].map(candidate=>candidate.kind==='record'?dayFingerprint(candidate.record):'' ));
    if(mine===baseValue)settled.set(item.date,incoming.id);else if(theirs===baseValue)settled.set(item.date,local.id);
  }
  return settled;
}
// 5.2: a Saved Day both sides changed since they last shared it (or that
// differs with no shared history) shows the newer side in a sync; the other
// is kept for review (null where that side deleted the day).
function syncSavedDayReviews(plan,settled){
  if(!settled)return freeze([]);
  const reviews=[],time=candidate=>Date.parse(String(candidate.kind==='deleted'?candidate.deletedAt:candidate.record&&(candidate.record.updatedAt||candidate.record.savedAt)||''))||0;
  for(const item of plan.savedDays){
    if(!item.conflict||settled.has(item.date))continue;
    const local=item.candidates.find(candidate=>candidate.local),incoming=item.candidates.find(candidate=>!candidate.local);if(!local||!incoming)continue;
    const shown=time(incoming)>time(local)?incoming:local,other=shown===local?incoming:local;
    settled.set(item.date,shown.id);
    reviews.push(PendingReviewCodec.create({subject:'savedDay',ref:item.date,kept:other.kind==='record'?sanitizeCurrentDailyRecord(other.record):null}));
  }
  return freeze(reviews);
}
const sessionDecision=(state,value=null,kept=null)=>freeze({state:String(state||''),value:value||null,kept:kept||null});
// Active Session reconciliation has two independent dimensions:
//   content ancestry -> semantic fingerprints
//   execution ownership -> Drive's monotonic ownership claim
// A claim made by this device is also a causal boundary: its
// observedContentFingerprint is exactly what this device saw when it took over.
// Later content from the old owner can therefore be incorporated without giving
// ownership back, while true two-sided divergence remains reviewable.
async function sessionSettlement(base,parsed,{hold=false,sync=false,sessionClaim=null}={}){
  const loaded=await readCanonicalActiveSession(),local=loaded&&loaded.value||null,incoming=parsed&&parsed.importedActiveSession||null;
  const canonicallyEqual=!local&&!incoming||!!local&&!!incoming&&Canonical.same(local,incoming);
  const me=installationId(),shared=String(base&&base.sessionFingerprint||''),[mine,theirs,contentMine,contentTheirs]=await Promise.all([sessionFingerprint(local),sessionFingerprint(incoming),sessionContentFingerprint(local),sessionContentFingerprint(incoming)]);
  const sameContent=!!contentMine&&contentMine===contentTheirs,claimApplies=!!(sessionClaim&&sessionClaim.applies),claimedHere=!!(claimApplies&&sessionClaim.state==='owned'&&sessionClaim.ownedHere),claimedAway=!!(claimApplies&&sessionClaim.state==='owned'&&!sessionClaim.ownedHere),releasedAway=!!(claimApplies&&sessionClaim.state==='released'&&!sessionClaim.ownedHere);
  const observed=claimApplies?String(sessionClaim.observedContentFingerprint||''):'',hasObserved=/^[a-f0-9]{64}$/u.test(observed);
  const savedLocalDay=local&&(parsed?.records||[]).find(record=>record?.recordKind==='study'&&record.date===local.date)||null;
  const savedCoversLocal=!!savedLocalDay&&DailyRecordCodec.savedDayCoversSessionEvidence(savedLocalDay,local,{allowAdvances:true});

  // This device is the old owner. The claim is the authoritative handoff
  // boundary even before the new owner has published its first checkpoint.
  // A checkpoint that still names this installation is therefore stale
  // control state: stop here, but hold the local recovery row until the new
  // owner's canonical session (or ended state) arrives.
  if(claimedAway&&hasObserved){
    if(incoming&&String(incoming.runningOn||'')===me)return sessionDecision(local?'yield-hold':'local');
    if(!local)return sessionDecision('incoming');
    if((!incoming||incoming.date>local.date)&&!savedCoversLocal)return sessionDecision('yield');
    return sessionDecision(contentMine===observed?'incoming':'yield');
  }
  // A released claim is written only after the claimant published its ended
  // state. If that newest checkpoint has no Active Session, the old owner can
  // clear unchanged content immediately or preserve genuine late work once
  // for review before clearing it.
  if(releasedAway&&hasObserved&&!incoming){
    if(!local)return sessionDecision('local');
    return sessionDecision(contentMine===observed&&savedCoversLocal?'incoming':'yield');
  }

  if(claimedHere){
    // The claim survives the owner's final local transition to no Active
    // Session until that ended state is published. Never resurrect the older
    // pre-claim session merely because Drive has not received the ending yet.
    if(!local)return sessionDecision('local');
    // Drive's head can predate the claim. Absence there cannot end a session
    // that this device has just legitimately claimed.
    if(!incoming)return sessionDecision('hold');
    if(sameContent){
      const merged=mergeSessionAcknowledgement(local,incoming);
      return merged&&!Canonical.same(merged,local)?sessionDecision('graft',merged):sessionDecision('local');
    }
    // Older claims lack the exact causal fingerprint. They remain safe by
    // refusing to infer ancestry rather than guessing from scalar revisions.
    if(!hasObserved)return sessionDecision('claimed-conflict');
    if(contentMine===observed&&contentTheirs!==observed){
      const rebased=rebaseSessionContentToOwner(local,incoming);
      return rebased?sessionDecision('graft',rebased):sessionDecision('claimed-conflict');
    }
    if(contentMine!==observed&&contentTheirs===observed)return sessionDecision('local');
    return sessionDecision('claimed-conflict');
  }

  // Even an identical checkpoint may predate a newer verified ownership claim.
  if(canonicallyEqual)return sessionDecision('same');
  // A newer study day on Drive may already include the canonical Saved Day
  // for this device's older session. Decide that day-boundary transition
  // BEFORE treating two Active Sessions as independent unsaved work.
  const newerRemoteDay=sync&&!!local&&!!incoming&&incoming.date>local.date;
  if(newerRemoteDay&&savedLocalDay){
    // A common session ancestor and a Saved Day that actually covers its
    // study evidence are both necessary to retire it without a review.
    return sessionDecision(shared&&mine===shared&&savedCoversLocal?'incoming':'ended');
  }
  const ended=(hold||sync)&&!!local&&!incoming&&!!shared&&await daySavedSinceBase(parsed,local.date);
  if(ended)return sessionDecision(mine===shared&&savedCoversLocal?'incoming':'ended');
  // Two genuinely unsaved days are independent; never choose their owner
  // by timestamp. No Saved Day above has justified ending the older one.
  const differentSession=!!local&&!!incoming&&local.date!==incoming.date;
  if(differentSession)return sync?sessionDecision('local',null,incoming):sessionDecision('conflict');
  const takenOver=hold&&!!local&&!!incoming&&incoming.status!=='suspended'&&incoming.runningOn!==me;
  if(takenOver){
    if(sameContent){
      const merged=mergeSessionAcknowledgement(incoming,local);
      return merged&&!Canonical.same(merged,incoming)?sessionDecision('graft',merged):sessionDecision('incoming');
    }
    if(mine===shared)return sessionDecision('incoming');
    return sessionDecision('yield');
  }
  if(hold&&!takenOver)return sessionDecision('hold');
  if(!local)return sessionDecision('incoming');
  if(!incoming)return sessionDecision('local');
  if(sameContent){
    const incomingWins=sessionControlFollows(local,incoming),winner=incomingWins?incoming:local,other=incomingWins?local:incoming,merged=mergeSessionAcknowledgement(winner,other);
    return merged&&!Canonical.same(merged,winner)?sessionDecision('graft',merged):sessionDecision(incomingWins?'incoming':'local');
  }
  if(!shared)return sessionDecision('');
  if(mine===shared)return sessionDecision('incoming');
  if(theirs===shared)return sessionDecision('local');
  return sessionDecision('conflict');
}
// Complete Active Session reconciliation before touching another data domain.
// Causal ancestry, execution quiescence and retained divergence form one result.
async function resolveSessionForReconciliation(base,parsed,{sync=false,review=false,sessionClaim=null,keep}={}){
  let decision=await sessionSettlement(base,parsed,{hold:(sync||review)&&hasActiveSession(),sync,sessionClaim});
  let state=decision.state,value=decision.value,priorReviews=null;
  const decisionReviews=[];
  const keepSession=async candidate=>{
    const kept=candidate&&ActiveSessionCodec.sanitizeCurrent(candidate);if(!kept)return false;
    if(priorReviews===null)priorReviews=await AppData.pendingReviews.list();
    if([...priorReviews,...decisionReviews].some(item=>item.subject==='session'&&!item.resolvedAt&&Canonical.same(item.kept,kept)))return true;
    const item=PendingReviewCodec.create({subject:'session',ref:'session',kept});
    if(!keep(()=>item))return false;
    decisionReviews.push(item);return true;
  };
  if(sync&&decision.kept&&!(await keepSession(decision.kept)))return freeze({needsDecision:true});
  if(state==='yield-hold'){
    await yieldSession({deferReview:true});state='hold';value=null;
  }else if(state==='yield'){
    await yieldSession();
    if(sync){
      const mine=(await readCanonicalActiveSession()).value;
      state='incoming';
      if(mine&&!(await keepSession(mine)))return freeze({needsDecision:true});
    }else{
      decision=await sessionSettlement(base,parsed);state=decision.state;value=decision.value;
    }
  }
  // Ownership transfer or a remote end cannot leave a former owner's timer
  // running after its local canonical session was replaced.
  if(sync&&hasActiveSession()&&(state==='ended'||state==='incoming'&&(!parsed.importedActiveSession||parsed.importedActiveSession.runningOn!==installationId()))){
    const before=(await readCanonicalActiveSession()).value;
    await yieldSession({deferReview:true});
    const frozen=(await readCanonicalActiveSession()).value;
    // Yield may capture previously unpersisted focus/timer progress. The
    // earlier settlement decision cannot silently discard that new evidence.
    if(frozen&&!Canonical.same(ActiveSessionCodec.contentValue(before),ActiveSessionCodec.contentValue(frozen))&&
        !(await keepSession(frozen)))return freeze({needsDecision:true});
  }
  if(sync&&state==='claimed-conflict'){
    const other=parsed.importedActiveSession||null;
    if(other&&!(await keepSession(other)))return freeze({needsDecision:true});
    state='local';
  }
  if(sync&&(state==='conflict'||state===''||state==='ended')){
    const mine=(await readCanonicalActiveSession()).value,theirs=parsed.importedActiveSession||null;
    const time=item=>Date.parse(String(item&&item.updatedAt||''))||Number(item&&item.revision)||0;
    const incomingShows=state==='ended'||!mine||!!theirs&&time(theirs)>time(mine);
    const hidden=incomingShows?mine:theirs;
    state=incomingShows?'incoming':'local';
    if(hidden&&!(await keepSession(hidden)))return freeze({needsDecision:true});
  }
  return freeze({needsDecision:false,state,value});
}
// The other side saved this day since both last shared it. This establishes
// that the session ended there; whether this device has unsaved session
// content is decided independently by the semantic session ancestry above.
async function daySavedSinceBase(parsed,date){
  const record=(Array.isArray(parsed&&parsed.records)?parsed.records:[]).find(item=>item&&item.date===date);if(!record)return false;
  let shared;try{shared=await AppData.reconciliationBase.readDays([date]);}catch(error){AppDiagnostics.capture('backup.session-ended-base',error,'warn');return false;}
  return await dayFingerprint(record)!==String(shared&&shared[date]||'');
}
function sessionControlFollows(local,incoming){
  if(!local)return true;if(!incoming||incoming.date!==local.date)return false;
  const left=Number(local.revision)||0,right=Number(incoming.revision)||0;
  if(right!==left)return right>left;
  return Date.parse(String(incoming.updatedAt||''))>Date.parse(String(local.updatedAt||''));
}
function nextNoteRevision(...values){return new Date(Math.max(Date.now(),...values.map(value=>(Date.parse(String(value&&value.updatedAt||''))||0)+1))).toISOString();}
// Combine settles a note difference without asking only when nothing on this
// device can be lost: a side still holds what both sides last shared (the
// shared base), so only the other side changed it; both changed the text
// in different paragraphs, which Smart merge joins (mergeThreeWay, safe); the
// note did not exist when both last shared, so the side deleting it has not
// touched it since; or the side that deleted a note holds the other side's
// copy in Recently deleted. Every other difference is the person's: text in
// the review, deletions and titles in "Different versions found" (a sync
// keeps it for review instead: syncNoteReviews).
function noteReconciliationState(plan,ancestor=null){
  const items=new Map(plan.notes.map(item=>[item.key,item]));
  const shared=key=>ancestor&&ancestor.notes&&Object.prototype.hasOwnProperty.call(ancestor.notes,key)?ancestor.notes[key]:null;
  const trashCopy=(key,local)=>{const item=items.get(notesTrashKey(key)),candidate=item&&item.candidates.find(candidate=>candidate.kind==='record'&&candidate.sources.some(source=>!!source.local===local));return candidate?candidate.value:null;};
  const same=(a,b)=>!!a&&!!b&&String(a.text??'')===String(b.text??'')&&String(a.label??'')===String(b.label??'');
  const settled=new Map(),texts=new Map(),labels=new Map(),conflicts=[],deletions=[],titles=[];
  for(const item of plan.notes){
    if(!item.conflict||!notesTrashKey(item.key))continue;
    const local=item.candidates.find(candidate=>candidate.local),incoming=item.candidates.find(candidate=>!candidate.local),base=shared(item.key);if(!local||!incoming)continue;
    if(local.kind==='record'&&incoming.kind==='record'){
      const mine=local.value,theirs=incoming.value;
      for(const [field,decided] of [['text',texts],['label',labels]]){
        const localValue=String(mine[field]??''),incomingValue=String(theirs[field]??'');if(localValue===incomingValue)continue;
        if(base&&localValue===base[field])decided.set(item.key,incomingValue);
        else if(base&&incomingValue===base[field])decided.set(item.key,localValue);
        else if(field==='text'&&base&&smartMerge(base.text,localValue,incomingValue)!==null)decided.set(item.key,smartMerge(base.text,localValue,incomingValue));
        else if(field==='label')titles.push(freeze({key:item.key,local:localValue,incoming:incomingValue,base:base?String(base.label):null}));
        else conflicts.push(freeze({key:item.key,label:String(mine.label||theirs.label||item.key),localCandidateId:local.id,incomingCandidateId:incoming.id,localValue,incomingValue,incomingLabel:incoming.sources[0]?.label||'Backup copy',ancestorAvailable:!!base,ancestorValue:base?String(base.text):''}));
      }
      continue;
    }
    // One side deleted the note. The deletion stands, or the note stays, when
    // the side that kept it has not changed it since the shared base or the
    // deleting side holds that same copy in Recently deleted.
    const kept=local.kind==='record'?local:incoming,deleting=kept===local?incoming:local;
    if(same(kept.value,base)||same(kept.value,trashCopy(item.key,deleting.local)))settled.set(item.key,deleting.id);
    else if(ancestor&&!base)settled.set(item.key,kept.id);
    else deletions.push(item);
  }
  return freeze({settled,texts,labels,conflicts:freeze(conflicts),deletions:freeze(deletions),titles:freeze(titles),items});
}
// Smart merge of two edits made since the shared text: the merged text when
// no paragraph changed on both sides, else null.
const smartMerges=new Map();
function smartMerge(base,local,incoming){
  const key=JSON.stringify([base,local,incoming]);if(smartMerges.has(key))return smartMerges.get(key);
  let value=null;try{const result=NoteReconciliation.merge(base,local,incoming);value=result&&result.safe===true?String(result.value):null;}catch(error){AppDiagnostics.capture('backup.smart-merge',error,'warn');}
  if(smartMerges.size>64)smartMerges.clear();smartMerges.set(key,value);return value;
}
// 5.2: a sync never asks. Where both sides changed a note's text or title
// since they last shared it, the newer edit shows and the other is kept for
// review with what both last shared (for Smart merge then); a note edited on
// one side and deleted on the other stays, and its review offers to delete
// it. Times only choose what shows until the person reviews it.
function syncNoteReviews(plan,state){
  const reviews=[],byKey=new Map(),time=value=>Date.parse(String(value&&value.updatedAt||''))||0;
  const pair=key=>{const item=state.items.get(key),local=item&&item.candidates.find(candidate=>candidate.local),incoming=item&&item.candidates.find(candidate=>!candidate.local);return local&&incoming?{local,incoming,incomingNewer:time(incoming.value)>time(local.value)}:null;};
  const entry=key=>{let value=byKey.get(key);if(!value){value={kept:{},base:{},hasBase:true};byKey.set(key,value);}return value;};
  for(const conflict of state.conflicts){
    const sides=pair(conflict.key);if(!sides)continue;
    state.texts.set(conflict.key,sides.incomingNewer?conflict.incomingValue:conflict.localValue);
    const held=entry(conflict.key);held.kept.text=sides.incomingNewer?conflict.localValue:conflict.incomingValue;if(conflict.ancestorAvailable)held.base.text=conflict.ancestorValue;else held.hasBase=false;
  }
  for(const title of state.titles){
    const sides=pair(title.key);if(!sides)continue;
    state.labels.set(title.key,sides.incomingNewer?title.incoming:title.local);
    const held=entry(title.key);held.kept.label=sides.incomingNewer?title.local:title.incoming;if(title.base!==null)held.base.label=title.base;else held.hasBase=false;
  }
  for(const [key,held] of byKey)reviews.push(PendingReviewCodec.create({subject:'note',ref:key,kept:freeze(held.kept),base:held.hasBase&&Object.keys(held.base).length===Object.keys(held.kept).length?freeze(held.base):null}));
  for(const item of state.deletions){
    const record=item.candidates.find(candidate=>candidate.kind==='record');if(!record)continue;
    state.settled.set(item.key,record.id);reviews.push(PendingReviewCodec.create({subject:'note',ref:item.key,kept:null}));
  }
  return freeze(reviews);
}
// 5.2: the person reviews what a sync kept, for one note or day (ref) or
// all. Choices come first, then note texts in the comparison dialog, where
// Smart merge starts from what both last shared. Nothing is written until
// both are confirmed, and nothing that changed meanwhile is overwritten. Each
// choice is then an edit like any other, so it syncs, and the review ends on
// every device. A session kept for review waits while a session runs here.
// A whole Personal Data review is portable, but its decision is not a
// whole-object winner. Every explicitly selected field is applied to the
// current canonical object; unrelated changes remain untouched.
const PERSONAL_REVIEW_LABELS=freeze({
  studentName:'Student name',theme:'Theme',presentation:'Appearance',quote:'Quote',
  practiceCueMode:'Practice pacing cues',fontScale:'Text size',
  practiceTargetMs:'Practice target',nudge:'Reminders',soundMode:'Sound mode'
});
function keptValueDescription(value){
  if(value===undefined)return 'Not present';
  if(value===null)return 'Not set';
  const description=typeof value==='object'?JSON.stringify(value):String(value);
  // A working draft may be 100 KiB. Show a bounded preview in the choices.
  return description.length>240?description.slice(0,240)+`… (${description.length} characters; complete version retained)`:description;
}
function keptPlanDescription(plan){
  if(!plan)return 'Not saved';
  const preview=String(plan.scheduleText||'');
  return `${plan.label} · ${preview.length>180?preview.slice(0,180)+'…':preview||'Empty schedule'}`;
}
function selectedKeptPersonal(current,review,picked){
  const kept=review.kept,has=part=>picked[`kept__${review.id}__${part}`]==='use',
    preferences={...current.preferences},plans={...current.plans};
  for(const key of new Set([...Object.keys(current.preferences),...Object.keys(kept.preferences)])){
    if(!has('preference:'+key))continue;
    if(Object.hasOwn(kept.preferences,key))preferences[key]=kept.preferences[key];
    else delete preferences[key]; // optional soundMode
  }
  if(current.preferences.nudge!==null&&kept.preferences.nudge!==null){
    const nudge={...current.preferences.nudge};
    for(const key of new Set([...Object.keys(current.preferences.nudge),...Object.keys(kept.preferences.nudge)])){
      if(!has('nudge:'+key))continue;
      if(Object.hasOwn(kept.preferences.nudge,key))nudge[key]=kept.preferences.nudge[key];
      else delete nudge[key];
    }
    preferences.nudge=nudge;
  }
  if(has('draft'))plans.draft=kept.plans.draft;
  const localPlans=new Map(current.plans.savedPlans.map(plan=>[plan.id,plan])),
    remotePlans=new Map(kept.plans.savedPlans.map(plan=>[plan.id,plan])),chosen=new Map(localPlans);
  for(const id of new Set([...localPlans.keys(),...remotePlans.keys()])){
    if(!has('savedPlan:'+id))continue;
    if(remotePlans.has(id))chosen.set(id,remotePlans.get(id));
    else chosen.delete(id);
  }
  const localOrder=current.plans.savedPlans.map(plan=>plan.id),remoteOrder=kept.plans.savedPlans.map(plan=>plan.id),
    preferred=has('savedPlanOrder')?remoteOrder:localOrder;
  plans.savedPlans=[...new Set([...preferred,...localOrder,...remoteOrder])].filter(id=>chosen.has(id)).map(id=>chosen.get(id));
  plans.defaultId=has('defaultPlan')?kept.plans.defaultId:current.plans.defaultId;
  let normalized=null;
  try{normalized=BackupCodec.normalizePersonalData({version:2,plans,preferences});}
  catch(error){throw new Error('The selected Personal Data is invalid. If you choose a default saved plan, also keep that plan.',{cause:error});}
  if(!normalized)throw new Error('The selected Personal Data is invalid. If you choose a default saved plan, also keep that plan.');
  return normalized;
}
async function reviewKeptVersions({ref=''}={}){
  requireBackupMutationControl('reviewing kept versions');
  // One review per note or day at a time, the oldest first: a second kept
  // version of the same note waits for the next look.
  const target=String(ref||''),waiting=(await AppData.pendingReviews.list()).filter(review=>!review.resolvedAt&&(!target||review.ref===target)),first=new Map();
  for(const review of [...waiting].sort((a,b)=>a.keptAt.localeCompare(b.keptAt)||a.id.localeCompare(b.id)))if(!first.has(review.subject+':'+review.ref)&&(review.subject!=='session'||!hasActiveSession()))first.set(review.subject+':'+review.ref,review);
  const reviews=[...first.values()],of=subject=>reviews.filter(review=>review.subject===subject);
  if(!reviews.length)return freeze({reviewed:0,left:waiting.length,changed:0});
  const noteIds=[...new Set(of('note').map(review=>review.ref))],noteRows=noteIds.length?await AppData.notes.readFreshItems(noteIds):[],notes=new Map(noteIds.map((id,index)=>[id,noteRows[index]||null]));
  const days=new Map((of('savedDay').length?await getDailyRecordDocumentsByDates(of('savedDay').map(review=>review.ref)):[]).map(record=>[record.date,record]));
  const personal=of('personal').length?await personalExport({flush:false}):null,session=of('session').length?(await readCanonicalActiveSession()).value||null:null;
  // Each choice: 'keep' leaves this device's as it is (wait: the review stays
  // open), 'use' takes the kept version.
  const groups=[],steps=[],texts=[],choice=(review,part,label,description,keep,use,wait=false)=>{const id=`kept__${review.id}${part?`__${part}`:''}`;groups.push(freeze({id,label,defaultValue:'keep',description,choices:freeze([freeze({value:'keep',...keep}),freeze({value:'use',...use})])}));steps.push({id,review,part,wait});};
  const when=review=>savedDayDecisionTimestamp(review.keptAt),day=(record,origin)=>record?savedDayChoiceDescription({kind:'record',record,local:origin==='here',sources:[{label:'Kept version',local:origin==='here'}]}):origin==='here'?'Not on this device.':'Deleted on the other device.';
  for(const review of reviews){
    const kept=review.kept;
    if(review.subject==='note'){
      const note=notes.get(review.ref);
      if(!note)choice(review,'','Note · deleted here',`Another device changed this note after it was deleted here (kept ${when(review)}). Restore it from Recently deleted to compare.`,{label:'Keep for later',description:'The kept version waits.'},{label:'Discard the kept version',description:'Nothing changes here.'},true);
      else if(!kept)choice(review,'',`Note · ${note.label}`,'Deleted on another device while it was edited here. It stays until you choose.',{label:'Keep the note',description:'It stays as it is.'},{label:'Delete it',description:'It moves to Recently deleted.'});
      else{
        if(typeof kept.label==='string'&&kept.label!==note.label)choice(review,'label',`Note title · ${note.label}`,`The two titles differ; “${kept.label}” was kept for review (${when(review)}).`,{label:`Keep “${note.label}”`,description:''},{label:`Use “${kept.label}”`,description:''});
        if(typeof kept.text==='string'&&kept.text!==note.text)texts.push(freeze({key:review.ref,label:note.label,localCandidateId:'current',incomingCandidateId:review.id,localValue:note.text,incomingValue:kept.text,incomingLabel:`Kept ${when(review)}`,ancestorAvailable:typeof review.base?.text==='string',ancestorValue:String(review.base?.text||'')}));
      }
    }else if(review.subject==='savedDay'){
      const record=days.get(review.ref)||null;
      if(record||kept)choice(review,'',`Saved Day · ${review.ref}`,'The two Saved-Day versions differ. One was kept for your choice; content ancestry may be unavailable.',{label:record?'Keep the current one':'Keep it deleted',description:day(record,'here')},{label:kept?'Use the kept version':'Delete it',description:day(kept,'kept')});
    }else if(review.subject==='personal'){
      if(!personal){steps.push({id:'',review,part:'',wait:true});continue;}
      // The canonical PendingReview keeps the whole opposite Personal Data
      // version. Render only truly differing paths, not a misleading whole
      // Plans/Preferences toggle.
      const bothNudge=personal.preferences.nudge!==null&&kept.preferences.nudge!==null;
      for(const key of new Set([...Object.keys(personal.preferences),...Object.keys(kept.preferences)])){
        if(key==='nudge'&&bothNudge)continue;
        const here=personal.preferences[key],other=kept.preferences[key];
        if(Canonical.same(here,other))continue;
        const label=PERSONAL_REVIEW_LABELS[key]||key;
        choice(review,'preference:'+key,`Setting · ${label}`,'Different values were kept. Neither checkpoint-wide timestamp establishes which is newer.',{
          label:'Keep this device',description:keptValueDescription(here)
        },{label:'Use kept value',description:keptValueDescription(other)});
      }
      if(bothNudge){
        const labels={enabled:'Enabled',sound:'Sound',nudgeAfter:'Interval (minutes)',breakMinutes:'Break (minutes)'};
        for(const key of new Set([...Object.keys(personal.preferences.nudge),...Object.keys(kept.preferences.nudge)])){
          const here=personal.preferences.nudge[key],other=kept.preferences.nudge[key];
          if(Canonical.same(here,other))continue;
          choice(review,'nudge:'+key,`Reminder · ${labels[key]||key}`,
            'Only this reminder field differs; choosing it leaves the other reminder settings unchanged.',{
              label:'Keep this device',description:keptValueDescription(here)
            },{label:'Use kept value',description:keptValueDescription(other)});
        }
      }
      if(!Canonical.same(personal.plans.draft,kept.plans.draft))
        choice(review,'draft','Plan · Working draft','The working draft is independent of the applied Active Session.',{
          label:'Keep this draft',description:keptValueDescription(personal.plans.draft)
        },{label:'Use kept draft',description:keptValueDescription(kept.plans.draft)});
      const localPlans=new Map(personal.plans.savedPlans.map(plan=>[plan.id,plan])),
        remotePlans=new Map(kept.plans.savedPlans.map(plan=>[plan.id,plan]));
      for(const id of new Set([...localPlans.keys(),...remotePlans.keys()])){
        const here=localPlans.get(id)||null,other=remotePlans.get(id)||null;
        if(Canonical.same(here,other))continue;
        choice(review,'savedPlan:'+id,`Saved plan · ${here?.label||other?.label||id}`,'This saved-plan identity differs; selecting a version does not replace other saved plans.',{
          label:here?'Keep this plan':'Keep absent',description:keptPlanDescription(here)
        },{label:other?'Use kept plan':'Remove this plan',description:keptPlanDescription(other)});
      }
      if(!Canonical.same(personal.plans.savedPlans.map(plan=>plan.id),kept.plans.savedPlans.map(plan=>plan.id)))
        choice(review,'savedPlanOrder','Saved plan · Order','Choose the order for retained plans; plans present on only one side still have their own choices.',{
          label:'Keep this order',description:personal.plans.savedPlans.map(plan=>plan.label).join(', ')||'No saved plans'
        },{label:'Use kept order',description:kept.plans.savedPlans.map(plan=>plan.label).join(', ')||'No saved plans'});
      if(personal.plans.defaultId!==kept.plans.defaultId)
        choice(review,'defaultPlan','Saved plan · Default','The selected default must exist among the plans you choose to retain.',{
          label:'Keep this default',description:localPlans.get(personal.plans.defaultId)?.label||'No default'
        },{label:'Use kept default',description:remotePlans.get(kept.plans.defaultId)?.label||'No default'});
    }else if(review.subject==='session'){
      choice(review,'','Active / suspended session',`Two session versions differ; one was kept for review (${when(review)}).`,{label:session?'Keep the current session':'Keep no session',description:''},{label:'Use the kept session',description:'It is set aside here, ready to continue.'});
    }
  }
  let picked=freeze({}),resolvedTexts=null;
  if(groups.length){picked=await configure({title:'Kept versions',message:'A sync retained differences it could not safely settle. Choose exactly which values to apply. Each kept version is saved and confirmed separately; if a later choice fails, earlier confirmed choices remain and the rest can be retried.',groups,confirmLabel:'Apply choices',cancelLabel:'Later'});if(!picked)return freeze({cancelled:true,reviewed:0,left:waiting.length,changed:0});}
  if(texts.length){resolvedTexts=await NoteReconciliation.resolve(freeze({conflicts:freeze(texts),incomingAssets:freeze([]),purpose:'kept'}));if(!resolvedTexts)return freeze({cancelled:true,reviewed:0,left:waiting.length,changed:0});}
  const use=step=>picked[step.id]==='use',waits=new Set(steps.filter(step=>step.wait&&!use(step)).map(step=>step.review.id));
  return runExclusive('review-kept-versions',()=>withPersistenceSuppressed(async()=>{
    requireBackupMutationControl('reviewing kept versions');
    // What another device or a sync changed while the person chose stays:
    // those reviews wait for the next look.
    const still=new Set((await AppData.pendingReviews.list()).filter(review=>!review.resolvedAt).map(review=>review.id)),fresh=noteIds.length?await AppData.notes.readFreshItems(noteIds):[];
    const changed=new Set(noteIds.filter((id,index)=>!Canonical.same(fresh[index]||null,notes.get(id))));
    const freshDays=new Map((of('savedDay').length?await getDailyRecordDocumentsByDates(of('savedDay').map(review=>review.ref)):[]).map(record=>[record.date,record]));
    for(const review of of('savedDay'))if(!Canonical.same(freshDays.get(review.ref)||null,days.get(review.ref)||null))changed.add(review.ref);
    if(personal&&!Canonical.same(await personalExport({flush:false}),personal))changed.add('personal');
    if(of('session').length&&(hasActiveSession()||!Canonical.same((await readCanonicalActiveSession()).value||null,session)))changed.add('session');
    const done=reviews.filter(review=>still.has(review.id)&&!waits.has(review.id)&&!changed.has(review.ref)),doneIds=new Set(done.map(review=>review.id)),chosen=(review,part)=>steps.some(step=>step.review===review&&step.part===part&&use(step));
    // Validate cross-field saved-plan/default consistency before applying
    // Notes or Saved Days. Invalid combinations cannot partially apply.
    const personalSelection=done.some(review=>review.subject==='personal')?
      selectedKeptPersonal(personal,done.find(review=>review.subject==='personal'),picked):null;
    // A kept version is an independent decision, NOT an implicit transaction
    // spanning unrelated domains. Prevalidate all choices; confirm the
    // canonical write and its replicated tombstone before the next decision.
    const now=new Date().toISOString(),intents=[];
    for(const review of done){
      const noteItems=[],dayItems=[];let keptSession=null;
      if(review.subject==='note'){
        const note=notes.get(review.ref);
        if(note){
          if(!review.kept){
            if(chosen(review,''))noteItems.push(freeze({key:review.ref,changed:true,state:'deleted',deletedAt:now}));
          }else{
            const label=chosen(review,'label')?review.kept.label:note.label,
              text=resolvedTexts&&resolvedTexts.notes[review.ref]?String(resolvedTexts.notes[review.ref].text):note.text;
            if(label!==note.label||text!==note.text)
              noteItems.push(freeze({key:review.ref,changed:true,state:'record',value:freeze({...note,label,text,updatedAt:nextNoteRevision(note)})}));
          }
        }
      }else if(review.subject==='savedDay'&&chosen(review,''))
        dayItems.push(freeze(review.kept?
          {date:review.ref,changed:true,state:'record',record:freeze({...review.kept,updatedAt:now}),hadLocal:days.has(review.ref)}:
          {date:review.ref,changed:true,state:'deleted',deletedAt:now}));
      else if(review.subject==='session'&&chosen(review,''))keptSession=review.kept;
      intents.push(freeze({review,noteItems:freeze(noteItems),dayItems:freeze(dayItems),keptSession}));
    }
    let confirmed=0;
    try{
      for(const {review,noteItems,dayItems,keptSession} of intents){
        if(noteItems.length)await applyResolvedNotes(freeze({notes:noteItems}));
        if(dayItems.length)await applyResolvedSavedDays(freeze({savedDays:dayItems,sourcePlan:freeze({savedDays:freeze([])})}),null,()=>{});
        if(review.subject==='personal'&&personalSelection&&!Canonical.same(personalSelection,personal)){
          await personalImport(personalSelection);
          const committed=BackupCodec.normalizePersonalData(await personalExport({flush:false}));
          if(!committed||!Canonical.same(committed,personalSelection))
            throw new Error('The selected Personal Data did not reach canonical storage. The review remains open.');
        }
        if(keptSession)await applyResolvedActiveSession(freeze({activeSession:freeze({changed:true,value:freeze({...keptSession,status:'suspended',suspendedAt:keptSession.suspendedAt||now,revision:Math.max(Number(session&&session.revision)||0,Number(keptSession.revision)||0)+1,updatedAt:now})})}));
        await AppData.pendingReviews.resolve([review.id]);
        const [receipt]=await AppData.pendingReviews.readItems([review.id]);
        if(!receipt?.resolvedAt)throw new Error('The kept-version acknowledgement could not be verified. This version remains available to review.');
        confirmed++;
      }
    }catch(error){
      OperationDiagnostics.mark('kept-review-incomplete',{completed:confirmed,total:done.length,reason:'error'});
      if(confirmed)throw new Error(`${confirmed} of ${done.length} kept versions confirmed. Earlier choices remain applied; other versions remain available. Retry after correcting the storage problem.`,{cause:error});
      throw error;
    }
    try{libraryChanged();}catch(error){AppDiagnostics.capture('backup.kept-review-render',error,'warn');}
    return freeze({reviewed:confirmed,left:waiting.length-confirmed,changed:reviews.filter(review=>still.has(review.id)&&!waits.has(review.id)&&changed.has(review.ref)).length});
  }));
}
function noteTitleGroup(titles){
  const count=titles.length,examples=titles.slice(0,3).map(item=>`“${item.local}” here, “${item.incoming}” in the backup`).join(' · ')+(count>3?` · and ${count-3} more`:'');
  return freeze({id:'noteTitles',label:`Note titles · ${count} renamed`,defaultValue:'local',description:`Renamed on both sides since your last sync, or with no shared history: ${examples}.`,choices:freeze([
    freeze({value:'local',label:'Keep this device’s titles',description:'The notes keep the titles they have here.'}),
    freeze({value:'incoming',label:'Use the backup’s titles',description:'The notes take the titles they have in the backup.'})
  ])});
}
// Every note decision for a combine: what settled itself, what the person
// chose, and the reviewed text. A note this device deleted by choice keeps
// this device's copy in Recently deleted.
function noteSelections(plan,state,decisions,result){
  const out=Object.create(null),reviewed=result&&result.notes&&typeof result.notes==='object'?result.notes:{},backupTitles=decisions.noteTitles==='incoming';
  for(const item of plan.notes){
    if(!item.conflict||!notesTrashKey(item.key))continue;
    const local=item.candidates.find(candidate=>candidate.local),incoming=item.candidates.find(candidate=>!candidate.local);if(!local||!incoming)continue;
    if(local.kind!=='record'||incoming.kind!=='record'){
      const chosen=state.settled.get(item.key)||decisions[item.decisionKey]||item.defaultCandidateId;out[item.key]=chosen;
      const trashKey=notesTrashKey(item.key),trashItem=state.items.get(trashKey),backupTrash=trashItem&&trashItem.candidates.find(candidate=>candidate.kind==='record'&&!candidate.local);
      if(chosen===incoming.id&&incoming.kind==='deleted'&&!state.settled.has(item.key)&&backupTrash&&(backupTrash.value.text!==local.value.text||backupTrash.value.label!==local.value.label))out[trashKey]=freeze({value:freeze({...local.value,key:trashKey,updatedAt:nextNoteRevision(local.value,backupTrash.value)})});
      continue;
    }
    const mine=local.value,theirs=incoming.value,localText=String(mine.text||''),incomingText=String(theirs.text||'');
    const text=state.texts.has(item.key)?state.texts.get(item.key):Object.prototype.hasOwnProperty.call(reviewed,item.key)?String(reviewed[item.key].text??''):localText;
    const label=state.labels.has(item.key)?state.labels.get(item.key):backupTitles?String(theirs.label):String(mine.label);
    // A bar keeps the notes either side linked: nothing is lost.
    const links=[...new Set([...(mine.links||[]),...(theirs.links||[])])].slice(0,APP_LIMITS.maxNoteLinks),sameLinks=value=>(value.links||[]).join('|')===links.join('|');
    if(text===localText&&label===String(mine.label)&&sameLinks(mine))out[item.key]=local.id;
    else if(text===incomingText&&label===String(theirs.label)&&sameLinks(theirs))out[item.key]=incoming.id;
    else{const value={...mine,label,text,updatedAt:nextNoteRevision(mine,theirs)};delete value.links;if(links.length)value.links=links;out[item.key]=freeze({value:freeze(value)});}
  }
  return freeze(out);
}
function reconciliationSelections(plan,decisions,noteDecisions=freeze({}),reflectionDecisions=freeze({}),settled=null){
  const savedDays=Object.create(null),notes=Object.assign(Object.create(null),noteDecisions||{});
  for(const item of plan.savedDays)if(item.conflict)savedDays[item.date]=settled&&settled.has(item.date)?settled.get(item.date):Object.prototype.hasOwnProperty.call(reflectionDecisions,item.date)?reflectionDecisions[item.date]:(decisions[item.decisionKey]||savedDayPreferredCandidate(item,decisions)?.id||item.defaultCandidateId);
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
    assets:Object.freeze({...BackupCodec.attachmentCoverage(parsed.assetDescriptors||[]),library:(parsed.assetDescriptors||[]).filter(item=>item.library).length}),
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
function restoreDecisionSetup(parsed,impact,mode='import',localPersonal=null,noteState=null,personal=null,settledDays=null,session=''){
  // Plans and settings changed on one side only since the shared base are settled
  // without asking ('replace' takes the backup's, 'keep' this device's).
  const plan=impact.reconciliationPlan,groups=[],defaults={plans:personal||'keep',personalSettings:personal||'keep',safetyCopy:false};
  if(parsed.importedPersonalData&&!personal){
    if(!localPersonal||!Canonical.same(localPersonal.plans,parsed.importedPersonalData.plans))groups.push({id:'plans',label:'Plan draft and saved plans',defaultValue:'keep',choices:[{value:'keep',label:'Keep current plans',description:'Preserve this device’s current draft, saved plans and default.'},{value:'replace',label:'Use incoming plans',description:`Use the incoming draft and saved-plan collection (${parsed.importedPersonalData.plans.savedPlans.length} saved plans).`}]});
    if(!localPersonal||!Canonical.same(localPersonal.preferences,parsed.importedPersonalData.preferences))groups.push({id:'personalSettings',label:'Personal and display settings',defaultValue:'keep',choices:[{value:'keep',label:'Keep current settings',description:'Preserve this device’s name and preferences.'},{value:'replace',label:'Use incoming settings',description:'Use the incoming name, theme, skin, text size, quote, reminders and supported preferences.'}]});
  }
  const savedDayBulk=savedDayBulkDecisionGroup(plan,settledDays);if(savedDayBulk)groups.push(savedDayBulk);
  for(const item of plan.savedDays){
    if(!savedDayNeedsWholeDecision(item,settledDays))continue;
    groups.push({
      id:item.decisionKey,label:`Saved Day · ${item.date}`,defaultValue:item.defaultCandidateId,
      description:'Choose the study-day state for this date. Differing reflections are reviewed separately next. Deletion is explicit; absence never means deletion.',
      choices:item.candidates.map(candidate=>({value:candidate.id,label:savedDayChoiceLabel(candidate),description:savedDayChoiceDescription(candidate)}))
    });
  }
  for(const item of noteState?noteState.deletions:[]){
    const record=item.candidates.find(candidate=>candidate.kind==='record'),localDeleted=item.candidates.some(candidate=>candidate.local&&candidate.kind==='deleted');
    groups.push({
      id:item.decisionKey,label:`Note · ${String(record&&record.value&&record.value.label||item.key)}`,defaultValue:item.defaultCandidateId,
      description:localDeleted?'Deleted on this device; the backup still has it.':'Deleted in the backup; this device still has it.',
      choices:item.candidates.map(candidate=>({value:candidate.id,...noteChoiceLabel(candidate)}))
    });
  }
  if(noteState&&noteState.titles.length)groups.push(noteTitleGroup(noteState.titles));
  if(plan.activeSession.conflict&&session!=='incoming'){
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
async function resolvedAssetReferenceIds(resolvedPlan,signal,reviews=freeze([])){
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
  for(const review of reviews||[])if(!review.resolvedAt)collect(review);
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
  if(!portableAssets||!selection)return freeze({written:0,published:0,reused:0,deleted:0,expected:freeze([]),expectedRemovedIds:freeze([]),references:freeze([]),expectedDeletions:null});
  throwIfImportAborted(signal);
  const selected=selection.available||freeze([]),published=selected.length;
  if(published)await AssetData.importAll(selected,signal);
  throwIfImportAborted(signal);
  const deleteLocalIds=attachmentPlan&&attachmentPlan.deleteLocalIds||freeze([]);let deleted=0;
  if(deleteLocalIds.length){const result=await AssetData.removeMetadata(deleteLocalIds);deleted=Math.max(0,Number(result&&result.removed)||0);}
  const expectedDeletions=attachmentPlan&&attachmentPlan.expectedDeletions||freeze([]),deletionLedgerChanged=attachmentPlan?.deletionLedgerChanged===true;
  if(deletionLedgerChanged)await AppData.deletionRecovery.replaceAttachments(expectedDeletions);
  const storedDeletions=deletionLedgerChanged?freeze([...(await AppData.deletionRecovery.attachments())]):null;
  return freeze({written:(selection.toWrite||[]).length,published,reused:Number(selection.reused)||0,deleted,changed:!!(published||deleted||deletionLedgerChanged),expected:freeze([...selected]),expectedRemovedIds:freeze([...deleteLocalIds]),references:selection.references||freeze([]),expectedDeletions:storedDeletions});
}
async function restoreSnapshotAssets(snapshot){
  if(!portableAssets||Number(snapshot&&snapshot.formatVersion)<10)return freeze({restored:false,removed:0,written:0});
  await AssetData.restoreAll(snapshot.importedAssets||[]);
  return freeze({restored:true,written:snapshot.importedAssets?.length||0});
}
const RESTORE_VERIFICATION_DOMAINS=freeze(new Set(['saved-days','notes','attachments','personal','pending-reviews','deletions','active-session']));
function restoreVerificationFailure(error,domain){
  const failure=error instanceof Error?error:new Error(String(error||'Restore verification failed.')),stage='restore-verification-'+domain;
  if(!failure.backupStage||failure.backupStage==='restore-verification')try{Object.defineProperty(failure,'backupStage',{value:stage,configurable:true});}catch{}
  if(!failure.diagnosticReason)try{Object.defineProperty(failure,'diagnosticReason',{value:'verification',configurable:true});}catch{}
  if(!failure.code||failure.code==='Error')try{Object.defineProperty(failure,'code',{value:'RESTORE_VERIFICATION_MISMATCH',configurable:true});}catch{}
  return failure;
}
async function verifyRestoreDomain(domain,work){
  if(!RESTORE_VERIFICATION_DOMAINS.has(domain)||typeof work!=='function')throw new TypeError('Restore verification domain is invalid.');
  const phase='restore-verification-'+domain;OperationDiagnostics.mark(phase+'-start');
  try{const value=await work();OperationDiagnostics.mark(phase+'-complete');return value;}
  catch(error){const failure=restoreVerificationFailure(error,domain);OperationDiagnostics.mark(phase+'-failed',{stage:String(failure.backupStage||phase),errorCode:String(failure.code||failure.name||'Error')});throw failure;}
}
async function verifyRestoreCommit(expected,signal,authorityOptions=null){
  throwIfImportAborted(signal,authorityOptions);await yieldImport(signal,authorityOptions);
  const records=Array.isArray(expected.records)?expected.records:[];
  if(records.length||Array.isArray(expected.removedRecordDates)||Array.isArray(expected.recordDatesExact))await verifyRestoreDomain('saved-days',async()=>{
    if(records.length){
      const stored=await getDailyRecordDocumentsByDates(records.map(record=>record.date)),byDate=new Map(stored.map(record=>[record.date,sanitizeCurrentDailyRecord(record)]));
      for(const record of records)if(!Canonical.same(byDate.get(record.date),sanitizeCurrentDailyRecord(record)))throw new Error(`Post-restore verification failed for saved day ${record.date}.`);
    }
    if(Array.isArray(expected.removedRecordDates)&&expected.removedRecordDates.length){const remaining=new Set((await getDailyRecordDocumentsByDates(expected.removedRecordDates)).map(record=>record.date));for(const date of expected.removedRecordDates)if(remaining.has(date))throw new Error(`Post-restore verification failed to remove saved day ${date}.`);}if(Array.isArray(expected.recordDatesExact)){const actual=[...((await AppData.dailyRecords.backupDates()).dates||[])].sort(),wanted=[...expected.recordDatesExact].sort();if(actual.length!==wanted.length||actual.some((date,index)=>date!==wanted[index]))throw new Error('Post-restore verification found Saved Days outside the selected version.');}
  });
  if(expected.notes||Array.isArray(expected.noteItems))await verifyRestoreDomain('notes',async()=>{
    if(expected.notes){const stored=AppData.notes.normalizePayload(await AppData.notes.readFreshPayload());if(!Canonical.same(stored,expected.notes))throw new Error('Post-restore verification failed for notes.');}
    if(Array.isArray(expected.noteItems)&&expected.noteItems.length){const rows=await AppData.notes.readFreshItems(expected.noteItems.map(item=>item.key));for(let index=0;index<expected.noteItems.length;index++){const receipt=expected.noteItems[index],actual=rows[index]?AppData.notes.normalizePayload({[receipt.key]:rows[index]})[receipt.key]||null:null;if(!Canonical.same(actual,receipt.value))throw new Error(`Post-restore verification failed for note ${receipt.key}.`);}}
  });
  if(Array.isArray(expected.assets)||Array.isArray(expected.removedAssetIds))await verifyRestoreDomain('attachments',async()=>{
    let rows=null;
    if(Array.isArray(expected.assets)){
      rows=await AssetData.list();const catalogue=new Map(rows.map(row=>[row.id,row])),verifiedPhysical=new Set();
      for(const item of expected.assets){const row=catalogue.get(item.assetId);if(!row||row.name!==item.name||row.library!==item.library||row.size!==item.size||row.type!==item.mimeType)throw new Error(`Post-restore verification failed for attachment ${item.assetId}.`);const physicalKey=String(row.file||item.assetId)+'\u0000'+String(item.checksum||'')+'\u0000'+Number(item.size);if(!verifiedPhysical.has(physicalKey)){const stored=await AssetData.get(item.assetId);if(!(stored instanceof Blob)||stored.size!==item.size||String(stored.type||'')!==item.mimeType||await BackupCodec.checksumBlob(stored,{signal})!==item.checksum)throw new Error(`Post-restore verification failed for attachment ${item.assetId}.`);verifiedPhysical.add(physicalKey);}}
      if(Array.isArray(expected.assetIdsExact)){const actual=rows.map(row=>String(row.id||'')).sort(),wanted=[...expected.assetIdsExact].map(String).sort();if(actual.length!==wanted.length||actual.some((id,index)=>id!==wanted[index]))throw new Error('Post-restore verification found attachment identities outside the selected version.');}
    }
    if(Array.isArray(expected.removedAssetIds)&&expected.removedAssetIds.length){const catalogue=new Set((rows||await AssetData.list()).map(row=>row.id));for(const id of expected.removedAssetIds)if(catalogue.has(id))throw new Error(`Post-restore verification failed to remove Attachment Library identity ${id}.`);}
  });
  if(expected.personalData)await verifyRestoreDomain('personal',()=>personalVerify(expected.personalData));
  if(Array.isArray(expected.pendingReviews)||Array.isArray(expected.pendingReviewItems))await verifyRestoreDomain('pending-reviews',async()=>{
    if(Array.isArray(expected.pendingReviews)&&!Canonical.same(await AppData.pendingReviews.list(),expected.pendingReviews))throw new Error('Post-restore verification failed for versions kept for review.');
    if(Array.isArray(expected.pendingReviewItems)&&expected.pendingReviewItems.length){const rows=await AppData.pendingReviews.readItems(expected.pendingReviewItems.map(item=>item.id));for(let index=0;index<expected.pendingReviewItems.length;index++)if(!Canonical.same(rows[index]||null,expected.pendingReviewItems[index].value))throw new Error(`Post-restore verification failed for kept version ${expected.pendingReviewItems[index].id}.`);}
  });
  if(Array.isArray(expected.savedDayDeletions)||Array.isArray(expected.noteDeletions)||Array.isArray(expected.attachmentDeletions))await verifyRestoreDomain('deletions',async()=>{
    if(Array.isArray(expected.savedDayDeletions)){const stored=await AppData.deletionRecovery.savedDays();if(!Canonical.same(stored,expected.savedDayDeletions))throw new Error('Post-restore verification failed for Saved-Day deletion history.');}
    if(Array.isArray(expected.noteDeletions)){const stored=await AppData.deletionRecovery.notes();if(!Canonical.same(stored,expected.noteDeletions))throw new Error('Post-restore verification failed for note deletion history.');}
    if(Array.isArray(expected.attachmentDeletions)){const stored=await AppData.deletionRecovery.attachments();if(!Canonical.same(stored,expected.attachmentDeletions))throw new Error('Post-restore verification failed for Attachment deletion history.');}
  });
  if(Object.prototype.hasOwnProperty.call(expected,'activeSession'))await verifyRestoreDomain('active-session',async()=>{await AppData.activeSession.settled();const loaded=await readCanonicalActiveSession(),stored=loaded&&loaded.value||null;if(!Canonical.same(ActiveSessionCodec.sanitizeCurrent(stored),expected.activeSession))throw new Error('Post-restore verification failed for the active session.');await verifyActiveSessionRuntime(expected.activeSession);});
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
  const nameKeyedNotes=Number(repositoryManifest.version)<=ManagedRepository.releasedManifestVersion;
  const notes=managedSnapshotStage('notes','MANAGED_CHECKPOINT_NOTES_FAILED',()=>{const out=Object.create(null);for(const raw of plan.noteItems||[]){const key=String(raw&&raw.key||''),clean=nameKeyedNotes?BackupCodec.legacyNote(raw,key):BackupCodec.normalizeNote(raw,key);if(!clean||!key||Object.prototype.hasOwnProperty.call(out,clean.key))throw new Error('Managed repository note failed current-schema verification.');out[clean.key]=clean;}return out;});
  const activeSession=managedSnapshotStage('active-session','MANAGED_CHECKPOINT_ACTIVE_SESSION_FAILED',()=>{const clean=plan.activeSession?BackupCodec.normalizeImportedActiveSession(plan.activeSession,{legacy:Number(repositoryManifest.version)<=4}):null;if(plan.activeSession&&!clean)throw new Error('Managed repository Active Session failed schema verification.');return clean;});
  const personalData=managedSnapshotStage('personal-data','MANAGED_CHECKPOINT_PERSONAL_DATA_FAILED',()=>plan.personalData?BackupCodec.normalizePersonalData(plan.personalData):null);
  // Versions kept for review (manifest 8 and later).
  const pendingReviews=managedSnapshotStage('pending-reviews','MANAGED_CHECKPOINT_PENDING_REVIEWS_FAILED',()=>{const seen=new Set();return freeze((plan.pendingReviewItems||[]).map(raw=>{const clean=BackupCodec.normalizePendingReview(raw);if(!clean||seen.has(clean.id))throw new Error('Managed repository version kept for review failed current-schema verification.');seen.add(clean.id);return clean;}).sort((a,b)=>a.id.localeCompare(b.id)));});
  const counts=managedSnapshotStage('counts','MANAGED_CHECKPOINT_COUNTS_FAILED',()=>{const value=BackupCodec.countShape({checkpointManifest:1,personalData:personalData?1:0,dailyRecord:records.length,note:Object.keys(notes).length,activeSession:activeSession?1:0,pendingReview:pendingReviews.length});if(!noteScope&&Number(repositoryManifest.version)>=5&&(!BackupCodec.countsEqual(value,plan.counts)||!BackupCodec.countsEqual(value,repositoryManifest.counts)))throw new Error('Managed repository counts failed portable-snapshot verification.');return value;});
  const attachmentState=managedSnapshotStage('attachments','MANAGED_CHECKPOINT_ATTACHMENTS_FAILED',()=>{
    const rawAssetItems=Array.isArray(plan.assetItems)?plan.assetItems:[],assetDescriptors=BackupCodec.normalizeAssetDescriptors(rawAssetItems.map(item=>item&&item.descriptor)),assetById=new Map(rawAssetItems.map(item=>[String(item&&item.descriptor&&item.descriptor.assetId||''),item])),importedAssets=[];
    for(const descriptor of assetDescriptors){const item=assetById.get(descriptor.assetId);if(!item)throw new Error(`Managed repository attachment ${descriptor.assetId} is unavailable.`);if(descriptor.missing===true){if(item.blob!==null&&item.blob!==undefined)throw new Error(`Managed repository missing attachment ${descriptor.assetId} unexpectedly contains bytes.`);continue;}if(!(item.blob instanceof Blob)||item.blob.size!==descriptor.size)throw new Error(`Managed repository attachment ${descriptor.assetId} failed snapshot binding.`);importedAssets.push(freeze({...descriptor,blob:item.blob.slice(0,item.blob.size,descriptor.mimeType)}));}
    const referencedAssetIds=new Set(),collect=value=>{for(const id of BackupCodec.assetIds(value))referencedAssetIds.add(id);};records.forEach(collect);Object.values(notes).forEach(collect);if(activeSession)collect(activeSession);pendingReviews.forEach(collect);
    const descriptorIds=new Set(assetDescriptors.map(item=>item.assetId));for(const id of referencedAssetIds)if(!descriptorIds.has(id))throw new Error(`Managed repository is missing attachment descriptor ${id}.`);
    return freeze({assetDescriptors,assetById,importedAssets,referencedAssetIds});
  });
  const {assetDescriptors,assetById,importedAssets,referencedAssetIds}=attachmentState;
  const normalizedPlan=freeze({...plan,dailyDocuments:freeze(records),recordDates:freeze(recordDates),noteItems:freeze(Object.values(notes).sort((a,b)=>String(a.key).localeCompare(String(b.key)))),activeSession,personalData,pendingReviewItems:pendingReviews,counts:freeze({...counts}),assetItems:freeze(assetDescriptors.map(descriptor=>freeze({descriptor,blob:descriptor.missing===true?null:assetById.get(descriptor.assetId).blob})))});
  const protectedCheckpointManifest=managedSnapshotStage('protected-manifest','MANAGED_CHECKPOINT_PROTECTED_MANIFEST_FAILED',()=>{if(noteScope)return BackupCodec.withNoteIdDeletions(repositoryManifest.protectedCheckpointManifest,nameKeyedNotes);const value=BackupCodec.createProtectedManifest(normalizedPlan,plan.checkpoint);if(Number(repositoryManifest.version)>=5&&(!Canonical.same(value,plan.protectedCheckpointManifest)||!Canonical.same(value,repositoryManifest.protectedCheckpointManifest)))throw new Error('Managed repository protected checkpoint state failed portable-snapshot verification.');return BackupCodec.withNoteIdDeletions(value,nameKeyedNotes);});
  const manifest=freeze(BackupCodec.createManifest(normalizedPlan,{compression:'none',algorithm:BackupCodec.checksumAlgorithm()})),report=freeze({legacy:false,sourceVersion:null,degraded:0,skipped:0,duplicates:0,invalidActiveSession:0,ignoredTombstones:0,warnings:freeze([])});
  const sourceBytes=Math.max(0,Number(metadata&&metadata.verifiedSourceBytes)||0),entityCount=records.length+Object.keys(notes).length+(activeSession?1:0)+(personalData?1:0)+pendingReviews.length+1,chunkOverhead=Math.ceil(entityCount/Math.max(1,Number(APP_LIMITS.backupChunkItems)||1))*512+8192;
  return freeze({noteScope,importedPersonalData:personalData,data:freeze({notes:freeze(notes)}),records:freeze(records),pendingReviews,hasNotes:true,notesComplete:true,importedActiveSession:activeSession,protectedCheckpointManifest,captureAuthority:'canonical-complete',formatVersion:Number(backupVersion),counts:freeze({...counts}),manifest,report,uncompressedBytes:sourceBytes+chunkOverhead,assetDescriptors,referencedAssetIds:freeze([...referencedAssetIds].sort()),importedAssets:freeze(importedAssets),assetBytes:importedAssets.reduce((total,item)=>total+item.size,0)});
}
async function inspectVerifiedLogicalCapture(capture,metadata={}){
  const signal=metadata&&metadata.signal||activeImportOperation&&activeImportOperation.signal||null;throwIfImportAborted(signal);
  const parsed=managedParsedSnapshot(capture,metadata),repositoryManifest=metadata.repositoryManifest,release=metadata.release;
  if(typeof release!=='function')throw new TypeError('Managed repository attachment lease is unavailable.');
  const provenance=freeze({kind:'managed-repository',repositoryManifest,repositoryCommitted:metadata.repositoryCommitted===true,sharedHead:metadata.sharedHead===true,managedRecovery:metadata.managedRecovery||null,managedProgress:typeof metadata.managedProgress==='function'?metadata.managedProgress:null,encrypted:metadata.sourceEncrypted===true});
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
async function replacePortableCanonicalSnapshot(snapshot,{deletionState=null,signal=null,restoreId='',requirePersonal=false,phasePrefix='restoring-version',authorityOptions=null}={}){
  const source=snapshot&&typeof snapshot==='object'?snapshot:null;
  if(!source)throw new Error('The portable restore snapshot is unavailable.');
  requireBackupMutationControl('replacing the portable Study Director state');
  const mark=async phase=>{if(restoreId)await AppData.restoreJournal.mark(restoreId,`${phasePrefix}-${phase}`);};
  const records=normalizeImportedDailyRecordSet(source.records||[]).records,targetDates=freeze(records.map(record=>record.date)),targetDateSet=new Set(targetDates);
  const targetNotes=AppData.notes.normalizePayload(source.data&&source.data.notes||{});
  const targetSession=source.importedActiveSession?ActiveSessionCodec.sanitizeCurrent(source.importedActiveSession):null;
  if(source.importedActiveSession&&!targetSession)throw new Error('The selected version contains an invalid Active Session.');
  const targetPersonal=source.importedPersonalData||null;
  if(requirePersonal&&!targetPersonal)throw new Error('The selected managed version is missing portable Plans or Preferences.');
  const deletions=deletionState||freeze({savedDays:freeze([]),notes:freeze([]),attachments:freeze([])});
  for(const key of ['savedDays','notes','attachments'])if(!Array.isArray(deletions[key]))throw new Error('The selected version has invalid canonical deletion state.');
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
  await mark('notes');
  const restoredNotes=await restoreNotesSnapshot(targetNotes);
  if(!restoredNotes||typeof restoredNotes!=='object'||Array.isArray(restoredNotes))throw new Error('Note version restore did not return a canonical committed payload.');
  throwIfImportAborted(signal,authorityOptions);await yieldImport(signal,authorityOptions);
  let restoredAssets=0;
  if(portableAssets&&Number(source.formatVersion)>=10){
    await mark('attachments');
    const assets=Array.isArray(source.importedAssets)?source.importedAssets:[];
    await restoreSnapshotAssets(source);restoredAssets=assets.length;
    throwIfImportAborted(signal,authorityOptions);await yieldImport(signal,authorityOptions);
  }
  await mark('active-session');
  await restoreSessionState(targetSession);
  throwIfImportAborted(signal,authorityOptions);await yieldImport(signal,authorityOptions);
  if(targetPersonal){await mark('personal-data');await personalImport(targetPersonal);throwIfImportAborted(signal,authorityOptions);await yieldImport(signal,authorityOptions);}
  // The snapshot's versions kept for review, exactly (a version restore
  // passes this device's and the version's together).
  const targetReviews=Array.isArray(source.pendingReviews)?freeze(PendingReviewCodec.merge([source.pendingReviews],APP_LIMITS.maxPendingReviews)):null;
  if(targetReviews){await mark('pending-reviews');await AppData.pendingReviews.replace(targetReviews);}
  await mark('deletion-state');
  await AppData.deletionRecovery.replaceSavedDays(deletions.savedDays);
  await AppData.deletionRecovery.replaceNotes(deletions.notes);
  await AppData.deletionRecovery.replaceAttachments(deletions.attachments);
  await AppData.activeSession.settled();
  await mark('verifying');
  const expectedAssets=portableAssets&&Number(source.formatVersion)>=10?(source.importedAssets||[]):undefined;
  await verifyRestoreCommit({
    personalData:targetPersonal,records,recordDatesExact:targetDates,notes:AppData.notes.normalizePayload(restoredNotes),
    assets:expectedAssets,assetIdsExact:Array.isArray(expectedAssets)?expectedAssets.map(item=>item.assetId):undefined,
    activeSession:targetSession,savedDayDeletions:deletions.savedDays,noteDeletions:deletions.notes,attachmentDeletions:deletions.attachments,
    ...(targetReviews?{pendingReviews:targetReviews}:{})
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
  return freeze({savedDays:freeze([...value('savedDays','savedDayDeletions')]),notes:freeze([...value('notes','noteDeletions')]),attachments:freeze([...value('attachments','attachmentDeletions')])});
}
async function rollbackImportedState(journal,deletionState=null){
  const rollbackAuthority=freeze({allowDurableProtected:true});
  assertAuthority(rollbackAuthority);
  const snapshot=journal&&typeof journal==='object'?journal:null;
  if(!snapshot)throw new Error('The restore rollback journal is unavailable. Use the downloaded safety copy.');
  const result=await replacePortableCanonicalSnapshot(snapshot,{deletionState:rollbackDeletionState(snapshot,deletionState),signal:null,requirePersonal:false,phasePrefix:'rollback',authorityOptions:rollbackAuthority});
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

async function releaseRestoreScratch(file,scope){
  try{await Exports.run('file.release',{file});}
  catch(error){AppDiagnostics.capture(scope,error,'warn');}
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
const RESTORE_MUTATION_STAGES=freeze(new Set(['assets','saved-day-state','notes','pending-reviews','active-session','personal-data','verification']));
function restoreMutationFailure(error,stage){
  const failure=error instanceof Error?error:new Error(String(error||'Restore mutation failed.'));
  if(!failure.backupStage)try{Object.defineProperty(failure,'backupStage',{value:'restore-'+stage,configurable:true});}catch{}
  return failure;
}
async function runRestoreMutationStage(stage,work){
  if(!RESTORE_MUTATION_STAGES.has(stage)||typeof work!=='function')throw new TypeError('Restore mutation stage is invalid.');
  const phase='restore-mutation-'+stage;
  OperationDiagnostics.mark(phase+'-start');
  try{const value=await work();OperationDiagnostics.mark(phase+'-complete');return value;}
  catch(error){const failure=restoreMutationFailure(error,stage);OperationDiagnostics.mark(phase+'-failed',{stage:String(failure.backupStage||''),errorCode:String(failure.code||failure.name||'Error')});throw failure;}
}
async function restoreBackupAttemptWithOperation(candidate,operation,options={}){
  // A sync runs without questions like adding what is missing, but takes
  // everything one side alone changed; anything needing a choice is left
  // for the person.
  const missingOnly=options&&options.missingOnly===true,sync=!missingOnly&&options&&options.sync===true,quiet=missingOnly||sync,note=!quiet&&typeof options?.note==='string'?options.note:'';
  const stored=candidate&&typeof candidate==='object'?inspectedBackups.get(candidate):null,snapshot=stored?candidateSnapshotState(stored):null;
  const parsed=snapshot&&snapshot.parsed||null,signal=operation&&operation.signal||stored&&stored.signal||null;
  if(!parsed)throw new Error('Backup candidate is not a current verified Study Director inspection.');
  if(parsed.noteScope&&parsed.noteScope!==note)throw new Error('This backup version was read for one note only and cannot be combined as a whole.');
  throwIfImportCancelled(signal);
  const preview=candidate.preview||{};
  OperationDiagnostics.mark('restore-preflight-start');
  await flushRestorePreflightState(signal);
  OperationDiagnostics.mark('restore-preflight-complete');
  const unchanged=reason=>Object.freeze({cancelled:true,reason,mode:'reconcile',added:0,replaced:0,kept:0,batches:0,assetsRestored:0,notesReconciled:false,activeSessionReconciled:false,savedDayDeletionsApplied:0}),needsDecision=()=>unchanged('needs-decision');
  // Active Session: one decision owns causal selection, stopping execution
  // and retaining a divergent copy. All other domains reconcile afterwards.
  const review=!quiet&&!note&&options?.review===true,base=note?null:await lastSharedBase(stored);
  const keptReviews=[],keep=build=>{try{keptReviews.push(...[].concat(build()));return true;}catch(error){AppDiagnostics.capture('backup.sync-keep-review',error,'warn');return false;}};
  const decision=note||missingOnly?sessionDecision('same'):
    await resolveSessionForReconciliation(base,parsed,{sync,review,sessionClaim:sync?options?.sessionClaim||null:null,keep});
  if(decision.needsDecision)return needsDecision();
  const session=decision.state,derivedSession=decision.value;
  const holdSession=['hold','local','graft'].includes(session),clearSession=session==='incoming'&&!(parsed&&parsed.importedActiveSession);
  const stable=await buildStableRestoreImpact(parsed,preview,signal,{missingOnly,note,holdSession}),impact=stable.impact;
  if((quiet||note)&&!impact.reconciliationCapable)return needsDecision();
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
  // Restoring one note always shows the comparison, so it never settles itself.
  const differingNotes=note?[]:impact.reconciliationPlan.notes.filter(item=>item.conflict&&notesTrashKey(item.key)).map(item=>item.key);
  const noteState=noteReconciliationState(impact.reconciliationPlan,differingNotes.length?await noteReconciliationAncestor(base,differingNotes):null);
  const settledDays=note?null:await savedDaySettlement(impact.reconciliationPlan,base);
  const localPersonal=await personalExport({flush:false});let personal=missingOnly?null:await personalSettled(base,localPersonal,parsed.importedPersonalData),autoPersonal=null;
  // A sync settles every remaining difference itself: the newer version
  // shows and the other is kept for review.
  if(sync){
    if(!keep(()=>[...syncNoteReviews(impact.reconciliationPlan,noteState),...syncSavedDayReviews(impact.reconciliationPlan,settledDays)]))return needsDecision();
    const theirs=parsed.importedPersonalData||null;
    if(!personal&&theirs&&!(localPersonal&&Canonical.same(localPersonal,theirs))){
      // A side holding nothing the other lacks (a new device's start-up
      // state, say) takes the other's, and nothing is kept. Otherwise the
      // newer shows and the other is kept for review.
      // A truly blank fresh device retains the established first-sync rule.
      // But a known ancestor can prove an *intentional deletion* of one
      // setting; mere absence of that value must not masquerade as startup.
      if(!localPersonal||personalIsBlank(localPersonal))personal='replace';
      else if(personalIsBlank(theirs))personal='keep';
      else{
        const fieldResult=await reconcilePersonalFields(base,localPersonal,theirs);
        if(fieldResult){
          personal='keep';
          autoPersonal=fieldResult.value;
          if(fieldResult.conflict&&!keep(()=>PendingReviewCodec.create({subject:'personal',ref:'personal',kept:BackupCodec.normalizePersonalData(theirs)})))return needsDecision();
        }else if(personalAddsNothing(localPersonal,theirs))personal='replace';
        else if(personalAddsNothing(theirs,localPersonal))personal='keep';
        else{
          // Missing ancestry is unknown, not evidence of a newer value.
          personal='keep';
          if(!keep(()=>PendingReviewCodec.create({subject:'personal',ref:'personal',kept:BackupCodec.normalizePersonalData(theirs)})))return needsDecision();
        }
      }
    }
  }
  const noteConflicts=sync?freeze([]):noteState.conflicts,decisionNoteState=sync?freeze({...noteState,deletions:freeze([]),titles:freeze([])}):noteState;
  const decisionSetup=restoreDecisionSetup(parsed,impact,mode,localPersonal,note?null:decisionNoteState,personal,settledDays,session);
  let selectedDecisions=freeze({});
  if(quiet&&(decisionSetup.groups.some(group=>sync||!['plans','personalSettings'].includes(group.id))||noteConflicts.length))return needsDecision();
  if(decisionSetup.groups.length&&!quiet&&!note){
    selectedDecisions=await configure({
      title:'Different versions found',
      message:'Choose what to keep where this device and the backup differ. This device is selected by default; nothing missing from the backup is treated as deleted.',
      details:[
        `${currentCheckpoint?'Backup copy':(preview.filename||'Backup file')} · ${preview.exportedAt?new Date(preview.exportedAt).toLocaleString():'date unavailable'}`,
        `Saved Days: ${impact.savedDays.conflicts} conflict${impact.savedDays.conflicts===1?'':'s'} · Active Session: ${impact.activeSession.conflicts} conflict${impact.activeSession.conflicts===1?'':'s'}.`,
        'Study Director automatically keeps verified rollback protection while changes are applied.'
      ],groups:decisionSetup.groups,checkboxes:[{id:'safetyCopy',label:'Download an extra standalone safety copy before applying',description:'Optional. This does not replace Study Director’s automatic rollback protection.',defaultChecked:false}],confirmLabel:'Apply choices',cancelLabel:'Keep current'
    });
    if(!selectedDecisions)return Object.freeze({cancelled:true,mode,added:0,replaced:0,kept:0,batches:0,assetsRestored:0,notesReconciled:false,activeSessionReconciled:false,savedDayDeletionsApplied:0});
  }
  const sessionPick=session==='incoming'&&impact.reconciliationPlan.activeSession.conflict?impact.reconciliationPlan.activeSession.candidates.find(candidate=>!candidate.local)?.id:'';
  const decisions=freeze({...decisionSetup.defaults,...selectedDecisions,...(sessionPick?{activeSession:sessionPick}:{})});
  if(decisions.safetyCopy===true){
    await assertRestoreReconciliationCurrent(reconciliationRevision,relevantDates,stable.scope);
    const extra=await downloadSafetyCopy({assumeFlushed:true});try{await Exports.run('file.release',{file:extra.blob});}catch(error){AppDiagnostics.capture('backup.optional-safety-copy-release',error,'warn');}
    await assertRestoreReconciliationCurrent(reconciliationRevision,relevantDates,stable.scope);
  }
  let reflectionDecisionMap=freeze({});
  const reflectionConflicts=savedDayReflectionConflicts(impact.reconciliationPlan,settledDays);
  if(quiet&&reflectionConflicts.length)return needsDecision();
  if(reflectionConflicts.length){
    const reflectionResult=await NoteReconciliation.resolve(freeze({conflicts:reflectionConflicts,incomingAssets:Array.isArray(parsed.importedAssets)?parsed.importedAssets:freeze([]),signal,manualOnly:true}));
    if(!reflectionResult)return Object.freeze({cancelled:true,mode,added:0,replaced:0,kept:0,batches:0,assetsRestored:0,notesReconciled:false,activeSessionReconciled:false,savedDayDeletionsApplied:0});
    reflectionDecisionMap=savedDayReflectionSelections(impact.reconciliationPlan,reflectionResult,decisions);
  }
  let noteDecisionMap=freeze({}),noteResult=null;
  if(noteConflicts.length){
    noteResult=await NoteReconciliation.resolve(freeze({conflicts:noteConflicts,incomingAssets:Array.isArray(parsed.importedAssets)?parsed.importedAssets:freeze([]),signal,...(note?{purpose:'version'}:{})}));
    if(!noteResult)return Object.freeze({cancelled:true,mode,added:0,replaced:0,kept:0,batches:0,assetsRestored:0,notesReconciled:false,activeSessionReconciled:false,savedDayDeletionsApplied:0});
    if(note){const text=String(noteResult.notes?.[note]?.text??noteConflicts[0].localValue);if(text===noteConflicts[0].localValue)return unchanged('note-kept');noteDecisionMap=restoredNote(text);}
  }
  if(!note)noteDecisionMap=noteSelections(impact.reconciliationPlan,noteState,decisions,noteResult);
  else if(!noteConflicts.length){
    // Nothing on this device to compare with (the note is empty or was
    // deleted here), so the backup's text comes back as it is.
    noteDecisionMap=restoredNote(String(noteRecord(false).value?.text||''));
  }
  // Versions kept for review join this device's. A repeated observation
  // of an already-open equivalent conflict must not create another review.
  // If two different ids were *already* published for the same conflict,
  // retain the oldest and replicate a resolved identity for the redundant
  // id; otherwise resolving the retained review would leave an orphan open
  // on another device.
  const existingReviews=note?freeze([]):await AppData.pendingReviews.list();
  const published=note?freeze([]):freeze(parsed.pendingReviews||[]);
  const known=PendingReviewCodec.merge([existingReviews,published],APP_LIMITS.maxPendingReviews);
  const generated=keptReviews.filter((review,index)=>![
    ...known,...keptReviews.slice(0,index)
  ].some(other=>PendingReviewCodec.sameOpen(review,other)));
  const candidates=PendingReviewCodec.merge([known,generated],APP_LIMITS.maxPendingReviews);
  const reviewSet=candidates; // The codec owns semantic dedup for every import path.
  const previousReviews=new Map(existingReviews.map(review=>[review.id,review]));
  const incomingReviews=freeze(reviewSet.filter(review=>!Canonical.same(previousReviews.get(review.id)||null,review)));
  if(reviewSet.filter(item=>!item.resolvedAt).length>APP_LIMITS.maxPendingReviews){if(quiet)return needsDecision();throw new Error(`More than ${APP_LIMITS.maxPendingReviews} versions would wait for review. Review some under Library → Data first.`);}
  let resolvedPlan=Reconciliation.resolvePlan(impact.reconciliationPlan,reconciliationSelections(impact.reconciliationPlan,decisions,noteDecisionMap,reflectionDecisionMap,settledDays));
  if(session==='graft'&&derivedSession){
    const active=resolvedPlan.activeSession;
    resolvedPlan=freeze({...resolvedPlan,activeSession:freeze({...active,candidateId:null,value:derivedSession,changed:true,hadLocal:true,local:true})});
  }
  const resolvedAssetReferences=await resolvedAssetReferenceIds(resolvedPlan,signal,reviewSet);
  let attachmentPlan=note?await noteAttachmentPlan(resolvedAssetReferences):await buildAttachmentDeletionPlan(parsed,resolvedPlan,stable.impact.assetAssessment||null,freeze({}),signal,resolvedAssetReferences);
  // A sync follows the deletion records: an attachment deleted on either side
  // and used by nothing is deleted.
  if(sync&&attachmentPlan.conflicts.length)attachmentPlan=await buildAttachmentDeletionPlan(parsed,resolvedPlan,stable.impact.assetAssessment||null,freeze(Object.fromEntries(attachmentPlan.conflicts.map(item=>[item.assetId,'deleted']))),signal,resolvedAssetReferences);
  if(quiet&&attachmentPlan.conflicts.length)return needsDecision();
  if(attachmentPlan.conflicts.length){
    const groups=attachmentDeletionDecisionGroups(attachmentPlan),choice=await configure({title:'Review attachment differences',message:'Choose what to keep for standalone attachments that differ between this device and the backup. Attachments still referenced by your data are always kept.',groups,confirmLabel:'Apply choices',cancelLabel:'Cancel'});
    if(!choice)return Object.freeze({cancelled:true,mode,added:0,replaced:0,kept:0,batches:0,assetsRestored:0,notesReconciled:false,activeSessionReconciled:false,savedDayDeletionsApplied:0});
    const mapped=Object.create(null);for(const item of attachmentPlan.conflicts)mapped[item.assetId]=choice[`attachment__${item.assetId}`]||item.defaultValue;
    attachmentPlan=await buildAttachmentDeletionPlan(parsed,resolvedPlan,stable.impact.assetAssessment||null,freeze(mapped),signal,resolvedAssetReferences);
  }
  throwIfImportAborted(signal);await yieldImport(signal);
  await assertRestoreReconciliationCurrent(reconciliationRevision,relevantDates,stable.scope);
  if(!impact.reconciliationCapable)requireNoActiveSession('using an older backup');
  // Taking in Drive's newest version makes it what both sides last shared.
  const sharedBase=currentCheckpoint&&!note&&!missingOnly&&snapshot.provenance&&snapshot.provenance.sharedHead===true?await sharedBaseUpdate(parsed):null;
  return runRestoreMutation(stored,'restore-backup',async()=>{
  OperationDiagnostics.mark('local-restore-mutation-enter');
  if(!impact.reconciliationCapable)requireNoActiveSession('using an older backup');
  await assertRestoreReconciliationCurrent(reconciliationRevision,relevantDates,stable.scope);
  await ensureRestoreCapacity(parsed,preview);
  restoreSurfaceStatus(stored,'Creating and verifying a local rollback snapshot…',true,'local-safety');
  OperationDiagnostics.mark('local-safety-capture-start');
  const {safetyFile,rollbackJournal}=await captureLocalSafetyCopy(stored,{afterCapture:()=>assertRestoreReconciliationCurrent(reconciliationRevision,relevantDates,stable.scope)});
  OperationDiagnostics.mark('local-safety-capture-complete',{bytes:Number(safetyFile&&safetyFile.blob&&safetyFile.blob.size)||0});
  const restoreId=`restore_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,14)}`;
  let rollbackDeletionState=null,committedDescription='',journalPrepared=false;
  try{
    rollbackDeletionState=freeze({savedDays:await AppData.deletionRecovery.savedDays(),notes:await AppData.deletionRecovery.notes(),attachments:await AppData.deletionRecovery.attachments()});
    OperationDiagnostics.mark('restore-journal-prepare-start');
    await AppData.restoreJournal.prepare({id:restoreId,blob:safetyFile.blob,filename:safetyFile.filename,savedDayDeletions:rollbackDeletionState.savedDays,noteDeletions:rollbackDeletionState.notes,attachmentDeletions:rollbackDeletionState.attachments});
    journalPrepared=true;OperationDiagnostics.mark('restore-journal-prepare-complete');
    let assetResult=freeze({written:0,published:0,reused:0,deleted:0,changed:false,expected:freeze([]),expectedRemovedIds:freeze([]),references:freeze([]),expectedDeletions:freeze([])});
    if(portableAssets&&Number(parsed.formatVersion)>=10){
      assetResult=await runRestoreMutationStage('assets',async()=>{
        await AppData.restoreJournal.mark(restoreId,'applying-assets');
        const currentAssessment=await assessImportedAssets(parsed,signal);
        const selectedAssets=await selectResolvedImportedAssets(currentAssessment,resolvedPlan,signal,attachmentPlan,resolvedAssetReferences);
        const result=await commitImportedAssets(selectedAssets,signal,attachmentPlan);
        if(result.published)committedDescription=String(result.published)+' selected attachment'+(result.published===1?' was':'s were')+' already updated';
        await AppData.restoreJournal.mark(restoreId,'assets-committed');
        throwIfImportAborted(signal);await yieldImport(signal);return result;
      });
    }
    const report={...(parsed.report||{}),warnings:[...((parsed.report&&parsed.report.warnings)||[])]};
    const dailyResult=await runRestoreMutationStage('saved-day-state',async()=>{
      await AppData.restoreJournal.mark(restoreId,'applying-saved-day-state');
      const result=await applyResolvedSavedDays(resolvedPlan,operation,(message,progress)=>restoreSurfaceStatus(stored,message,true,'local-apply',{current:Number(progress&&progress.committed)||0,total:Number(progress&&progress.total)||0}));
      const committedRecords=result.count+result.replaced;
      if(committedRecords)committedDescription+=(committedDescription?' and ':'')+String(committedRecords)+' Saved Day'+(committedRecords===1?' was':'s were')+' already saved';
      if(result.changed&&result.expectedDeletions)committedDescription+=(committedDescription?' and ':'')+'Saved-Day choices were already saved';
      await AppData.restoreJournal.mark(restoreId,'saved-day-state-committed');
      throwIfImportAborted(signal);await yieldImport(signal);return result;
    });
    const {count,replaced,deleted,kept,identical,batches,appliedRecords,removedRecordDates,expectedDeletions}=dailyResult;
    const noteResult=await runRestoreMutationStage('notes',async()=>{
      await AppData.restoreJournal.mark(restoreId,'applying-notes');
      const result=await applyResolvedNotes(resolvedPlan);
      if(result.changed)committedDescription+=(committedDescription?' and ':'')+'Notes were already saved';
      await AppData.restoreJournal.mark(restoreId,'notes-committed');
      throwIfImportAborted(signal);await yieldImport(signal);return result;
    });
    let reviewResult=freeze({changed:false,expectedItems:null,kept:0});
    if(incomingReviews.length){
      reviewResult=await runRestoreMutationStage('pending-reviews',async()=>{
        await AppData.restoreJournal.mark(restoreId,'applying-pending-reviews');
        const before=await AppData.pendingReviews.list(),intended=freeze(PendingReviewCodec.merge([before,incomingReviews],APP_LIMITS.maxPendingReviews)),intendedById=new Map(intended.map(item=>[item.id,item]));
        const changedIds=await AppData.pendingReviews.merge(incomingReviews),committed=changedIds.length?await AppData.pendingReviews.readItems(changedIds):freeze([]);
        const expectedItems=freeze(changedIds.map((id,index)=>{const value=intendedById.get(id)||null;if(!Canonical.same(committed[index]||null,value))throw new Error(`Pending-review reconciliation commit did not match the resolved state for ${id}.`);return freeze({id,value});}));
        const result=freeze({changed:changedIds.length>0,expectedItems,kept:keptReviews.length});
        if(result.changed)committedDescription+=(committedDescription?' and ':'')+'versions kept for review were already saved';
        return result;
      });
    }
    const sessionResult=await runRestoreMutationStage('active-session',async()=>{
      await AppData.restoreJournal.mark(restoreId,'applying-active-session');
      const result=await applyResolvedActiveSession(resolvedPlan,{clear:clearSession});
      if(result.changed)committedDescription+=(committedDescription?' and ':'')+'the Active Session was already saved';
      await AppData.restoreJournal.mark(restoreId,'active-session-committed');return result;
    });
    const localPersonal=rollbackJournal.importedPersonalData,
      selectedPersonal=autoPersonal|| (parsed.importedPersonalData?
        BackupCodec.normalizePersonalData(localPersonal?{version:2,
          plans:decisions.plans==='replace'?parsed.importedPersonalData.plans:localPersonal.plans,
          preferences:decisions.personalSettings==='replace'?parsed.importedPersonalData.preferences:localPersonal.preferences}:parsed.importedPersonalData):null),
      personalChanged=!!selectedPersonal&&!Canonical.same(localPersonal,selectedPersonal);
    let committedPersonal=null;
    if(personalChanged){
      const intendedPersonal=selectedPersonal;
      if(!intendedPersonal)throw new Error('Resolved Personal Data is outside the current canonical schema.');
      committedPersonal=await runRestoreMutationStage('personal-data',async()=>{await AppData.restoreJournal.mark(restoreId,'applying-personal-data');await personalImport(intendedPersonal);const committed=BackupCodec.normalizePersonalData(await personalExport({flush:false}));if(!committed||!Canonical.same(committed,intendedPersonal))throw new Error('Personal-data reconciliation commit did not match the resolved state.');return freeze(committed);});
    }
    const expectedCommit={
      ...(committedPersonal?{personalData:committedPersonal}:{}),
      ...(appliedRecords.length?{records:appliedRecords}:{}),
      ...(removedRecordDates.length?{removedRecordDates}:{}),
      ...(noteResult.expectedItems?.length?{noteItems:noteResult.expectedItems}:{}),
      ...(portableAssets&&Number(parsed.formatVersion)>=10&&assetResult.changed?{assets:assetResult.expected,removedAssetIds:assetResult.expectedRemovedIds}:{}),
      ...(Array.isArray(expectedDeletions)?{savedDayDeletions:expectedDeletions}:{}),
      ...(Array.isArray(noteResult.expectedDeletions)?{noteDeletions:noteResult.expectedDeletions}:{}),
      ...(Array.isArray(assetResult.expectedDeletions)?{attachmentDeletions:assetResult.expectedDeletions}:{}),
      ...(reviewResult.expectedItems?.length?{pendingReviewItems:reviewResult.expectedItems}:{})
    };
    if(sessionResult.changed)expectedCommit.activeSession=sessionResult.expected;
    await runRestoreMutationStage('verification',async()=>{
      await AppData.restoreJournal.mark(restoreId,'verifying');
      await verifyRestoreCommit(expectedCommit,signal);
      throwIfImportAborted(signal);
      await AppData.restoreJournal.mark(restoreId,'verified');
      OperationDiagnostics.mark('canonical-verification-complete');
    });
    const changed=!!(dailyResult.changed||assetResult.changed||noteResult.changed||sessionResult.changed||personalChanged||reviewResult.changed);
    if(changed)await rebaseRepositoryPreparationAcceleration('combine');
    await AppData.restoreJournal.clear(restoreId);journalPrepared=false;clearFault();
    if(sharedBase){
      const checkpointId=String(parsed&&parsed.protectedCheckpointManifest&&parsed.protectedCheckpointManifest.checkpointId||preview&&preview.checkpoint&&preview.checkpoint.checkpointId||'');
      if(checkpointId)try{await AppData.reconciliationBase.write(checkpointId,sharedBase);}catch(error){AppDiagnostics.capture('backup.reconciliation-base-write',error,'warn');}
    }
    if(portableAssets)AssetData.scheduleMaintenance(0);
    const compatibility=[];
    if(report.legacy)compatibility.push(`accepted older${report.sourceVersion?` v${report.sourceVersion}`:''} backup data`);
    if(report.degraded)compatibility.push(`preserved explicit unknowns in ${report.degraded} degraded entit${report.degraded===1?'y':'ies'}`);
    if(report.invalidActiveSession)compatibility.push('skipped an incompatible active session while keeping the rest');
    if(report.ignoredTombstones)compatibility.push(`ignored ${report.ignoredTombstones} legacy deletion marker${report.ignoredTombstones===1?'':'s'} so local data was not deleted`);
    if(report.skipped)compatibility.push(`skipped ${report.skipped} unusable entit${report.skipped===1?'y':'ies'}`);
    if(report.duplicates)compatibility.push(`kept the first usable copy of ${report.duplicates} duplicate backup entr${report.duplicates===1?'y':'ies'}`);
    let summary='';
    if(!changed){
      const baseMsg=kept?`Combine made no changes. ${kept} divergent local Saved Day${kept===1?' was':'s were'} kept.`:(impact.savedDays.total?'Combine found no applicable Saved-Day changes.':'Combine made no changes: this device already has everything in the backup.');
      summary=baseMsg+(compatibility.length?' '+compatibility.join(' · ')+'.':'');restoreSurfaceStatus(stored,summary,false,'local-warning');
    }else{
      const parts=[];
      if(personalChanged)parts.push('plans or personal settings restored');
      if(count)parts.push(count+' new daily record'+(count===1?'':'s'));
      if(replaced)parts.push(replaced+' divergent Saved-Day replacement'+(replaced===1?'':'s'));
      if(deleted)parts.push(deleted+' Saved-Day deletion'+(deleted===1?'':'s')+' applied');
      if(assetResult.published)parts.push(assetResult.published+' attachment'+(assetResult.published===1?'':'s')+' updated');
      if(assetResult.deleted)parts.push(assetResult.deleted+' Attachment Library deletion'+(assetResult.deleted===1?'':'s')+' applied');
      if(batches>1)parts.push(batches+' committed record batches');
      if(reviewResult.kept)parts.push(reviewResult.kept+' version'+(reviewResult.kept===1?'':'s')+' kept for review');
      summary=`✓ ${currentCheckpoint?'Merged':'Imported'} `+(parts.join(' · ')||'backup data')+noteResult.message+sessionResult.message+(kept?' · kept '+kept+' divergent local Saved Day'+(kept===1?'':'s'):'')+(identical?' · '+identical+' identical Saved Day'+(identical===1?'':'s')+' unchanged':'')+(compatibility.length?' · '+compatibility.join(' · '):'')+'. Final verification passed.';
      restoreSurfaceStatus(stored,summary,true,'local-complete');
    }
    try{libraryChanged();}catch(error){AppDiagnostics.capture('backup.import-render',error,'warn');}
    return Object.freeze({
      cancelled:false,mode,verified:true,
      added:count,replaced,kept,batches,
      savedDayDeletionsApplied:deleted,
      assetsRestored:assetResult.published,attachmentDeletionsApplied:assetResult.deleted,notesReconciled:noteResult.changed,
      activeSessionReconciled:sessionResult.changed,personalDataRestored:personalChanged,reviewsKept:reviewResult.kept,changed,summary
    });
  }catch(error){
    const failure=error instanceof Error?error:new Error(String(error));
    if(journalPrepared){
      restoreSurfaceStatus(stored,'Combine did not finish. Restoring the verified safety copy…',false,'rollback');
      try{
        OperationDiagnostics.mark('rollback-start');
        await AppData.restoreJournal.mark(restoreId,'rolling-back');
        await rollbackImportedState(rollbackJournal,rollbackDeletionState);
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
  }finally{await releaseRestoreScratch(safetyFile.blob,'backup.restore-safety-file-release');}
  });
}
// Replace makes this device match the backup without losing anything here
// unasked. A note whose text the backup changed takes the backup's copy when
// this device has not changed it since the shared base, and opens in the
// review otherwise, starting from the backup's copy. A note the backup
// deleted moves to Recently deleted. What this device has that the backup
// neither has nor deleted (notes, Saved Days, attachments, saved plans) stays
// unless the person chooses to remove it. Recently deleted always stays.
async function planReplacement(stored,parsed){
  const manifest=parsed.protectedCheckpointManifest,local=AppData.notes.normalizePayload(await AppData.notes.readFreshPayload());
  const target=AppData.notes.alignByTitle(parsed.data&&parsed.data.notes||{},(await AppData.deletionRecovery.notes()).map(entry=>entry.key));
  const ids=(list,field)=>new Set((list||[]).map(entry=>String(entry&&entry[field]||'')));
  const backupNoteDeletions=ids(manifest.noteDeletions,'key'),liveLocal=Object.keys(local).filter(key=>notesTrashKey(key));
  const changed=liveLocal.filter(key=>target[key]&&String(target[key].text||'')!==String(local[key].text||'')),gone=liveLocal.filter(key=>!target[key]);
  const deletedByBackup=gone.filter(key=>backupNoteDeletions.has(key)||!!target[notesTrashKey(key)]);
  const backupDates=ids(parsed.records,'date'),backupDayDeletions=ids(manifest.savedDayDeletions,'date');
  const days=((await AppData.dailyRecords.backupDates()).dates||[]).filter(date=>!backupDates.has(date)&&!backupDayDeletions.has(date));
  let assets=[];
  if(portableAssets&&Number(parsed.formatVersion)>=10){const known=new Set([...ids(parsed.assetDescriptors,'assetId'),...ids(manifest.attachmentDeletions,'assetId')]);assets=(await AssetData.list()).map(row=>String(row&&row.id||'')).filter(id=>id&&!known.has(id));}
  const backupPlans=parsed.importedPersonalData?parsed.importedPersonalData.plans.savedPlans:null,localPlans=backupPlans?((await personalExport({flush:false}))?.plans?.savedPlans||[]):[],backupPlanIds=ids(backupPlans,'id');
  const plans=localPlans.map(plan=>String(plan&&plan.id||'')).filter(id=>id&&!backupPlanIds.has(id));
  const reviewKeys=[...changed,...deletedByBackup],ancestor=reviewKeys.length?await noteReconciliationAncestor(await lastSharedBase(stored),reviewKeys):null;
  return freeze({local,target,changed:freeze(changed),deletedByBackup:freeze(deletedByBackup),ancestor,plansOverLimit:!!backupPlans&&backupPlans.length+plans.length>100,extras:freeze({notes:freeze(gone.filter(key=>!deletedByBackup.includes(key))),days:freeze(days),assets:freeze(assets),plans:freeze(plans)})});
}
// "2 notes (“Geography”, “Essay”), 1 Saved Day (12 Oct)": counts, naming the first few.
function replacementExtrasSummary(plan){
  const extras=plan.extras,dayLabel=date=>{const at=new Date(date+'T12:00:00');return Number.isFinite(at.getTime())?at.toLocaleDateString(undefined,{day:'numeric',month:'short'}):date;};
  const part=(items,one,many,name)=>{if(!items.length)return '';const names=name?items.slice(0,3).map(name):[];return `${items.length} ${items.length===1?one:many}${names.length?` (${names.join(', ')}${items.length>3?` and ${items.length-3} more`:''})`:''}`;};
  return [part(extras.notes,'note','notes',key=>`“${String(plan.local[key].label||'Untitled')}”`),part(extras.days,'Saved Day','Saved Days',dayLabel),part(extras.assets,'attachment','attachments'),part(extras.plans,'saved plan','saved plans')].filter(Boolean).join(', ');
}
const REPLACEMENT_EXTRA_CHOICES=freeze([
  freeze({value:'keep',label:'Keep them',kind:'primary',description:'They stay on this device alongside the restored backup.'}),
  freeze({value:'remove',label:'Remove them',kind:'danger',description:'This device matches the backup exactly. Removed notes go to Recently deleted.'})
]);
async function reviewReplacedNotes(plan,parsed,signal){
  const {local,target,ancestor}=plan,conflicts=[];
  for(const key of plan.changed){
    const mine=local[key],theirs=target[key],localValue=String(mine.text||''),incomingValue=String(theirs.text||''),shared=ancestor&&ancestor.notes&&ancestor.notes[key]||null;
    if(shared&&shared.text===localValue)continue;
    conflicts.push(freeze({key,label:String(mine.label||key),localCandidateId:'local',incomingCandidateId:'incoming',localValue,incomingValue,incomingLabel:'This backup',ancestorAvailable:!!shared,ancestorValue:shared?shared.text:''}));
  }
  if(!conflicts.length)return freeze({});
  const result=await NoteReconciliation.resolve(freeze({conflicts,incomingAssets:Array.isArray(parsed.importedAssets)?parsed.importedAssets:freeze([]),signal,startWith:'incoming'}));
  if(!result)return null;
  const notes=Object.create(null);
  for(const conflict of conflicts){
    const text=String(result.notes?.[conflict.key]?.text??conflict.incomingValue);if(text===conflict.incomingValue)continue;
    const mine=local[conflict.key],theirs=target[conflict.key];
    notes[conflict.key]=freeze(text===conflict.localValue?mine:{...theirs,text,updatedAt:nextNoteRevision(mine,theirs)});
  }
  return freeze(notes);
}
// The notes after a replace. A retired note keeps this device's copy in
// Recently deleted unless the backup's deleted copy already holds it, or this
// device had not changed it since the shared base.
function replacementNotes(plan,reviewed,keepExtras){
  const {local,target,ancestor}=plan,notes={...target,...reviewed},retired=[];
  const same=(a,b)=>!!a&&!!b&&String(a.text??'')===String(b.text??'')&&String(a.label??'')===String(b.label??'');
  for(const key of [...plan.deletedByBackup,...(keepExtras?[]:plan.extras.notes)]){
    const mine=local[key],trashKey=notesTrashKey(key),theirs=notes[trashKey];retired.push(key);
    if(!String(mine.text||'').trim()||same(mine,theirs)||(theirs&&same(mine,ancestor&&ancestor.notes&&ancestor.notes[key])))continue;
    notes[trashKey]=freeze({...mine,key:trashKey,updatedAt:nextNoteRevision(mine,theirs)});
  }
  if(keepExtras)for(const key of plan.extras.notes)notes[key]=local[key];
  for(const [key,value] of Object.entries(local))if(!notesTrashKey(key)&&!notes[key])notes[key]=value;
  return freeze({notes:freeze(notes),retired:freeze(retired)});
}
// The backup with what this device keeps: its kept Saved Days, saved plans and
// attachments, and every attachment the kept data uses, taken from the
// verified safety snapshot of this device.
function replacementSnapshot(parsed,journal,plan,notes,keepExtras){
  const days=new Set(keepExtras?plan.extras.days:[]),plans=new Set(keepExtras?plan.extras.plans:[]);
  const records=freeze([...(parsed.records||[]),...(journal.records||[]).filter(record=>days.has(String(record&&record.date||'')))]);
  // Versions kept for review stay: the backup's and this device's together.
  const pendingReviews=freeze(PendingReviewCodec.merge([journal.pendingReviews,parsed.pendingReviews],APP_LIMITS.maxPendingReviews).map(freeze));
  let personal=parsed.importedPersonalData||null,assets=parsed.importedAssets;
  if(personal&&plans.size){const kept=(journal.importedPersonalData?.plans?.savedPlans||[]).filter(item=>plans.has(String(item&&item.id||'')));personal=freeze({...personal,plans:freeze({...personal.plans,savedPlans:freeze([...personal.plans.savedPlans,...kept])})});}
  if(portableAssets&&Number(parsed.formatVersion)>=10){
    const have=new Set((parsed.importedAssets||[]).map(item=>item.assetId)),wanted=new Set(keepExtras?plan.extras.assets:[]);
    for(const value of [...Object.values(notes),...records,parsed.importedActiveSession,...pendingReviews])if(value)for(const id of BackupCodec.assetIds(value))wanted.add(id);
    assets=freeze([...(parsed.importedAssets||[]),...(journal.importedAssets||[]).filter(item=>wanted.has(item.assetId)&&!have.has(item.assetId))]);
  }
  return freeze({...parsed,records,data:freeze({...parsed.data,notes:notes}),importedAssets:assets,importedPersonalData:personal,pendingReviews});
}
// Deletion records after a replace: the backup's and this device's, for
// whatever the result does not hold, plus what this replace removed.
function mergedDeletions(field,limit,lists,present){
  const byKey=new Map();
  for(const list of lists)for(const entry of list||[]){const key=String(entry&&entry[field]||''),at=Date.parse(String(entry&&entry.deletedAt||''));if(!key||!Number.isFinite(at)||present(key))continue;const prior=byKey.get(key);if(!prior||at>Date.parse(prior.deletedAt))byKey.set(key,freeze({[field]:key,deletedAt:new Date(at).toISOString()}));}
  return freeze([...byKey.values()].sort((a,b)=>Date.parse(b.deletedAt)-Date.parse(a.deletedAt)||a[field].localeCompare(b[field])).slice(0,limit).sort((a,b)=>a[field].localeCompare(b[field])));
}
function replacementDeletions(parsed,localState,snapshot,removed){
  const manifest=parsed.protectedCheckpointManifest,notes=snapshot.data.notes,dates=new Set(snapshot.records.map(record=>record.date)),assets=new Set((snapshot.importedAssets||[]).map(item=>item.assetId));
  const now=new Date().toISOString(),fresh=(field,keys,lists)=>{const known=new Set(lists.flatMap(list=>(list||[]).map(entry=>String(entry&&entry[field]||''))));return keys.filter(key=>!known.has(key)).map(key=>({[field]:key,deletedAt:now}));};
  const dayLists=[manifest.savedDayDeletions,localState.savedDays],noteLists=[manifest.noteDeletions,localState.notes];
  return freeze({
    savedDays:mergedDeletions('date',APP_LIMITS.maxImportRecords,[...dayLists,fresh('date',removed.days,dayLists)],date=>dates.has(date)),
    notes:mergedDeletions('key',APP_LIMITS.maxNotes,[...noteLists,fresh('key',removed.notes,noteLists)],key=>!!notes[key]),
    attachments:mergedDeletions('assetId',Infinity,[manifest.attachmentDeletions,localState.attachments],id=>assets.has(id))
  });
}
async function restoreExactVersionWithOperation(candidate,operation,{confirmed=false,requireManaged=false}={}){
  const stored=candidate&&typeof candidate==='object'?inspectedBackups.get(candidate):null,snapshot=stored?candidateSnapshotState(stored):null,parsed=snapshot&&snapshot.parsed||null,provenance=snapshot&&snapshot.provenance||null,repositoryManifest=provenance&&provenance.repositoryManifest||null;
  const signal=operation&&operation.signal||stored&&stored.signal||null;
  if(!parsed)throw new Error('The selected backup is not a current verified Study Director backup.');
  if(parsed.noteScope)throw new Error('This backup version was read for one note only and cannot replace current data.');
  if(requireManaged&&(!repositoryManifest||provenance.repositoryCommitted!==true))throw new Error('Replace current data is available here only for a verified Device Folder or Google Drive backup.');
  if(Number(parsed.formatVersion)<15||!parsed.protectedCheckpointManifest)throw new Error('The selected backup is too old for exact replacement. Combine it with current data instead.');
  if(!BackupCodec.attachmentCoverage(parsed.assetDescriptors||[]).fullyRecoverable)throw new Error('This verified backup is missing attachment bytes. Combine or add what is missing instead of replacing current data.');
  const checkpointId=String(repositoryManifest&&repositoryManifest.checkpoint&&repositoryManifest.checkpoint.checkpointId||parsed.protectedCheckpointManifest.checkpointId||''),preview=candidate.preview||{};
  if(!checkpointId||checkpointId!==String(parsed.protectedCheckpointManifest.checkpointId||''))throw new Error('The selected backup identity is inconsistent.');
  throwIfImportCancelled(signal);
  OperationDiagnostics.mark('restore-preflight-start');
  await flushRestorePreflightState(signal);
  OperationDiagnostics.mark('restore-preflight-complete');
  const plan=await planReplacement(stored,parsed),extras=replacementExtrasSummary(plan),cancelled=freeze({cancelled:true,mode:'restore-version',verified:false,checkpointId});
  let keepExtras=true;
  if(!confirmed){
    const accepted=await configure({
      title:'Replace current data?',
      message:'Your data will match this backup. A note the backup changed takes the backup’s copy, or opens for review when this device changed it too. A note the backup deleted moves to Recently deleted. Device-local settings and browser permissions stay on this device.',
      details:[
        `${preview.exportedAt?new Date(preview.exportedAt).toLocaleString():'Date unavailable'} · ${savedDaysAndNotes(preview.counts)}`,
        'A verified safety copy protects the current local state if this operation fails.',
        ...[presentation.reach?.()||''].filter(Boolean)
      ],
      groups:extras?freeze([freeze({id:'extras',label:`Not in this backup · ${extras}`,defaultValue:'keep',description:'On this device, but neither in this backup nor deleted by it.',choices:REPLACEMENT_EXTRA_CHOICES})]):freeze([]),confirmLabel:'Replace current data',cancelLabel:'Cancel',caution:true,signal
    });
    if(!accepted)return cancelled;
    keepExtras=accepted.extras!=='remove';
  }else if(extras){
    const choice=await choose({title:'Keep what isn’t in this backup?',message:`This device has ${extras} that this backup neither has nor deleted.`,details:['Everything else will match the backup. Notes the backup deleted move to Recently deleted.'],cancelLabel:'Cancel',choices:REPLACEMENT_EXTRA_CHOICES});
    if(!choice)return cancelled;
    keepExtras=choice==='keep';
  }
  if(keepExtras&&plan.plansOverLimit)throw new Error('Keeping this device’s saved plans would go over 100 saved plans. Delete a few saved plans first, or choose Remove them.');
  const reviewed=await reviewReplacedNotes(plan,parsed,signal);
  if(!reviewed)return cancelled;
  const {notes,retired}=replacementNotes(plan,reviewed,keepExtras),removed=freeze({notes:retired,days:keepExtras?freeze([]):plan.extras.days});
  throwIfImportAborted(signal);
  return runRestoreMutation(stored,requireManaged?'restore-managed-version':'restore-file-version',async()=>{
    OperationDiagnostics.mark('local-restore-mutation-enter');
    await ensureRestoreCapacity(parsed,preview);
    OperationDiagnostics.mark('restore-capacity-verified');
    restoreSurfaceStatus(stored,'Creating and verifying a local rollback snapshot…',true,'local-safety');
    OperationDiagnostics.mark('local-safety-capture-start');
    const {safetyFile,rollbackJournal}=await captureLocalSafetyCopy(stored);
    OperationDiagnostics.mark('local-safety-capture-complete',{bytes:Number(safetyFile&&safetyFile.blob&&safetyFile.blob.size)||0});
    const restoreId=`restore_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,14)}`;
    let rollbackDeletionState=null,journalPrepared=false,committedDescription='';
    try{
      rollbackDeletionState=freeze({savedDays:await AppData.deletionRecovery.savedDays(),notes:await AppData.deletionRecovery.notes(),attachments:await AppData.deletionRecovery.attachments()});
      OperationDiagnostics.mark('restore-journal-prepare-start');
      await AppData.restoreJournal.prepare({id:restoreId,blob:safetyFile.blob,filename:safetyFile.filename,savedDayDeletions:rollbackDeletionState.savedDays,noteDeletions:rollbackDeletionState.notes,attachmentDeletions:rollbackDeletionState.attachments});
      journalPrepared=true;OperationDiagnostics.mark('restore-journal-prepare-complete');
      const target=replacementSnapshot(parsed,rollbackJournal,plan,notes,keepExtras),targetDeletionState=replacementDeletions(parsed,rollbackDeletionState,target,removed);
      OperationDiagnostics.mark('canonical-replacement-start');
      const restored=await replacePortableCanonicalSnapshot(target,{deletionState:targetDeletionState,signal,restoreId,requirePersonal:true,phasePrefix:'version-restore'});
      OperationDiagnostics.mark('canonical-replacement-complete',{savedDays:Number(restored&&restored.records)||0,notes:Number(restored&&restored.notes)||0,assets:Number(restored&&restored.assets)||0});
      committedDescription='The selected portable version was written and verified';
      await AppData.restoreJournal.mark(restoreId,'verified');
      OperationDiagnostics.mark('canonical-verification-complete');
      await rebaseRepositoryPreparationAcceleration('replace');
      await AppData.restoreJournal.clear(restoreId);journalPrepared=false;clearFault();
      // A restored version is this device's own change: the base stays what
      // was last shared, so the next sync carries the restore to Drive.
      const live=Object.keys(notes).filter(key=>notesTrashKey(key)).length,plural=(count,word)=>`${count} ${word}${count===1?'':'s'}`;
      const summary=`✓ Backup restored · ${plural(restored.records,'Saved Day')} · ${plural(live,'Note')} · ${plural(restored.assets,'attachment')}${keepExtras&&extras?` · kept ${extras} not in the backup`:''}${retired.length?` · ${plural(retired.length,'note')} moved to Recently deleted`:''}. Final verification passed.`;
      restoreSurfaceStatus(stored,summary,true,'local-complete');
      return freeze({cancelled:false,mode:'restore-version',verified:true,changed:true,checkpointId,restored,summary});
    }catch(error){
      const failure=error instanceof Error?error:new Error(String(error));
      if(journalPrepared){
        restoreSurfaceStatus(stored,'Backup restore did not finish. Restoring the verified safety copy…',false,'rollback');
        try{
          OperationDiagnostics.mark('rollback-start');
          await AppData.restoreJournal.mark(restoreId,'rolling-back');
          await rollbackImportedState(rollbackJournal,rollbackDeletionState);
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
    }finally{await releaseRestoreScratch(safetyFile.blob,'backup.restore-safety-file-release');}
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
    await releaseRestoreScratch(durable.payload.blob,'backup.recovery-file-release');OperationDiagnostics.finish({pending:true},traceId);return Object.freeze({recovered:false,pending:true});
  }
  requireBackupMutationControl('recovering an interrupted restore');
  return runExclusive('restore-recovery',()=>withPersistenceSuppressed(async()=>{
    const recoveryNotice=presentation.begin('file','startup-recovery',{id:'startup-recovery',surfaceId:'library-status',foreground:false,label:'Local recovery',message:'Recovering an interrupted restore from the verified safety copy…'});
    try{
      const parsed=await BackupCodec.inspect(durable.payload.blob,{filename:durable.payload.filename});
      await AppData.restoreJournal.mark(durable.state.id,'startup-rolling-back');
      await rollbackImportedState(parsed,{savedDays:durable.payload.savedDayDeletions,notes:durable.payload.noteDeletions,attachments:durable.payload.attachmentDeletions});
      await AppData.restoreJournal.mark(durable.state.id,'startup-rolled-back');
      await AppData.restoreJournal.clear(durable.state.id);clearFault();
      recoveryNotice.finish({message:'Local recovery completed: the interrupted restore was rolled back and verified before Study Director became writable.',outcome:'local-recovery-completed'});
      OperationDiagnostics.finish({recovered:true},traceId);return Object.freeze({recovered:true});
    }catch(error){
      recoveryNotice.finish({lifecycle:'failed',message:`Interrupted restore recovery could not finish: ${error&&error.message||error}. Preserve browser storage and retry recovery.`});
      failClosed(`Interrupted restore recovery could not finish: ${error&&error.message||error}`);
      OperationDiagnostics.fail(error,{},traceId);throw error;
    }finally{await releaseRestoreScratch(durable.payload.blob,'backup.recovery-file-release');}
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
    const captureAuthority=String(parsed&&parsed.captureAuthority||'unknown'),exactCapable=Number(parsed&&parsed.formatVersion)>=18&&captureAuthority==='canonical-complete'&&!!parsed&&!!parsed.protectedCheckpointManifest&&BackupCodec.attachmentCoverage(parsed.assetDescriptors||[]).fullyRecoverable,rescuePartial=captureAuthority==='rescue-partial';
    const restoreChoices=presentation.restoreChoices,choices=[...(preview.reconciliationCapable?[restoreChoices.missing]:[]),restoreChoices.combine,...(exactCapable?[restoreChoices.replace]:[])];
    const missingBinary=!BackupCodec.attachmentCoverage(parsed.assetDescriptors||[]).fullyRecoverable;
    const decisionDetails=[exactCapable?'Choose how this backup should be applied.':missingBinary?'This backup is missing attachment bytes. You can combine or add its available data, but exact replacement is unsafe.':rescuePartial?'This backup was saved while browser storage was failing. It can bring back what it holds, but it cannot replace current data.':'This backup is from an older version of Study Director. It can be combined with current data, but it cannot replace it.',BackupCodec.missingAttachmentWarning(parsed.assetDescriptors||[]),...[presentation.reach?.()||''].filter(Boolean)].filter(Boolean);
    OperationDiagnostics.mark('standalone-decision-start',{},traceId);const mode=await choose({title:'Use this backup',message:`Verified backup${preview.exportedAt?` from ${new Date(preview.exportedAt).toLocaleString()}`:''}.`,details:decisionDetails,cancelLabel:'Keep current',choices});
    OperationDiagnostics.mark('standalone-decision-complete',{mode:mode||'keep-current'},traceId);if(!mode){finishPortablePresentation({message:'Backup import cancelled.',lifecycle:'cancelled'});OperationDiagnostics.finish({cancelled:true,stage:'decision'},traceId);return freeze({cancelled:true});}
    consumed=true;OperationDiagnostics.mark('standalone-apply-start',{mode},traceId);
    const result=mode==='replace'?await restoreStandaloneVersion(candidate,{confirmed:true}):await restoreBackup(candidate,{missingOnly:mode==='missing'});OperationDiagnostics.mark('standalone-apply-complete',{mode,cancelled:result&&result.cancelled===true},traceId);
    if(result&&result.reason==='needs-decision'){finishPortablePresentation({message:presentation.restoreChoices.needsDecision,lifecycle:'cancelled'});OperationDiagnostics.finish({cancelled:true,mode},traceId);return result;}
    if(result&&result.cancelled){finishPortablePresentation({message:'Backup import cancelled.',lifecycle:'cancelled'});OperationDiagnostics.finish({cancelled:true,mode},traceId);return result;}
    const done=result&&result.verified?(result.summary||(result.changed?`✓ Backup ${mode==='replace'?'restored':mode==='missing'?'added what was missing':'combined'} locally and verified.`:'✓ Backup verified. Nothing was missing.')):'';
    if(done)setLocalExportStatus(done);
    if(result&&result.verified&&!result.cancelled&&result.changed){
      // Locations that back up on their own pick up the restored data.
      try{if(restoredFromFile()===true)setLocalExportStatus(`${done} Automatic backups will include it shortly.`);}
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
  reviewKeptVersions:(...args)=>track(()=>reviewKeptVersions(...args),true),
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
  readSession:ManagedRepository.readSession,
  markCompleted:controller.markCompleted,
  // What this device last shared through Drive, and recording a version
  // placed there as shared.
  sharedBase:()=>AppData.reconciliationBase.read().catch(()=>null),
  establishBase:checkpointId=>ManagedRepository.establishBase(checkpointId)
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
    exports:freeze({run:Exports.run,protect:Exports.protect,unprotect:Exports.unprotect,followProtection:Exports.followProtection}),
    domain:freeze({clampText}),
    view:freeze({presentation:ports.view.presentation}),
    ownership:freeze({canRunBackground:()=>!appCanMutate()?'awaiting-control':Exports.backgroundAvailable(),canShare:()=>ports.operations.canShare(),requireMutationControl:requireBackupMutationControl}),
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
