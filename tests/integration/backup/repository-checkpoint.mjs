import {performance} from 'node:perf_hooks';
import {createBackupPresentation} from '../../helpers/backup-presentation.mjs';
import {RUNTIME_DATA_CONTRACT} from '../../../contracts/canonical-identities.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createProcessingEngine} from '../../helpers/file-processing.mjs';
import {createDriveHarness,pendingRepositoryDigests} from '../../helpers/drive-harness.mjs';
import {createFakeClock} from '../../helpers/fake-clock.mjs';
import {testPendingReviewCodec,memoryPendingReviews,paragraphMerge} from '../../helpers/pending-review-codec.mjs';

for(const file of ['source/core/internal.js','source/core/operation-lifecycle.js','source/core/canonical.js','source/core/record-codecs.js','source/core/reconciliation.js','source/core/exports.js','source/core/managed-repository.js','source/core/repository-policy.js','source/core/repository-background.js','source/core/backup-provider.js','source/core/backup-capture.js','source/core/backup.js','source/core/backup-recovery-host.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const freeze=Object.freeze,CanonicalModule=registry.require('canonical',1),ManagedRepositoryModule=registry.require('managed-repository',1),RepositoryPolicyModule=registry.require('repository-policy',1),RepositoryBackgroundModule=registry.require('repository-background',1,Object.freeze({lifecycle:registry.require('operation-lifecycle',1)})),BackupProviderModule=registry.require('backup-provider',1,freeze({repositoryPolicy:RepositoryPolicyModule})),BackupCaptureModule=registry.require('backup-capture',1),BackupModule=registry.require('backup',1,freeze({backupCapture:BackupCaptureModule,backupProvider:BackupProviderModule,canonical:CanonicalModule,managedRepository:ManagedRepositoryModule,repositoryBackground:RepositoryBackgroundModule})),ReconciliationModule=registry.require('reconciliation',1,freeze({canonical:CanonicalModule})),ExportsModule=registry.require('exports',1,Object.freeze({lifecycle:registry.require('operation-lifecycle',1)}));
const exclusive=ExportsModule.createCoordinator({createWorker:()=>{throw new Error('The fixture uses direct processing.');},window:{},document:{}});
const engine=createProcessingEngine();
// File processing (hashing, compression) finishes on background threads, not
// on the fake clock. Settling loops wait for it before moving simulated time,
// so a loaded machine cannot let leases expire mid-step.
let processingInFlight=0;
async function realWorkSettled(){for(let turn=0;turn<20000&&(processingInFlight>0||pendingRepositoryDigests()>0);turn++)await new Promise(resolve=>setImmediate(resolve));}
let backgroundClock=null,backgroundReady=true,primary=true;
let checksumCounter=0,encodeOpenCounter=0,assetReads=0,snapshotRevision='rev-1',sourceRevision='2026-09-19T00:00:00.000Z',checkpointCounter=0,reconciliationBaseWrites=[],reconciliationBase=null,reconciliationBaseNotes=Object.create(null);
const AUDIO_BYTES=300*1024*1024,AUDIO_HASH='a'.repeat(64);
class VirtualLargeBlob extends Blob{get size(){return AUDIO_BYTES;}}
let audioBlob=new VirtualLargeBlob(['x'],{type:'audio/mpeg'}),publicationProtection=null;
const releasedFiles=[];
let dailyRecordCanonical=true;
let dailyRecords=[freeze({version:16,recordKind:'study',date:'2026-09-18',reflection:'one',savedAt:'2026-09-18T20:00:00.000Z',updatedAt:'2026-09-18T20:00:00.000Z'})];
// N4 and Subject land in the same pack shard, so they share one pack.
const stableSecondaryNote=freeze({version:2,key:'N4',text:'stable secondary note',updatedAt:'2026-09-18T20:00:00.000Z'});
let notes={N4:stableSecondaryNote,Subject:freeze({version:2,key:'Subject',text:'stable note',updatedAt:'2026-09-18T20:00:00.000Z'})};
let assetDescriptor=freeze({id:'asset-audio',type:'audio/mpeg',size:AUDIO_BYTES,hash:AUDIO_HASH,name:'audio.mp3',library:true});
const backupPresentation=createBackupPresentation();
const documentStub=freeze({getElementById:()=>null,addEventListener:()=>{},createElement:()=>({click(){},remove(){}}),createDocumentFragment:()=>({appendChild(){}}),body:freeze({appendChild(){}})});
const countsShape=value=>freeze({dailyRecord:Number(value?.dailyRecord||0),note:Number(value?.note||0),activeSession:Number(value?.activeSession||0),personalData:Number(value?.personalData||0),checkpointManifest:Number(value?.checkpointManifest||0)});
const personalCodec=registry.require('record-codecs',1).createPersonalDataCodec(freeze({}));
const RecordCodecs=globalThis[Symbol.for('studyDirector.internalModules.v1')].require('record-codecs',1);
const pendingReviewCodec=testPendingReviewCodec(RecordCodecs,{personalDataCodec:RecordCodecs.createPersonalDataCodec(Object.freeze({}))}),keptReviews=memoryPendingReviews(pendingReviewCodec);
const BackupCodec=freeze({
  normalizePersonalData:personalCodec.normalize,countsEqual:(a,b)=>CanonicalModule.same(countsShape(a),countsShape(b)),normalizeAssetDescriptors:value=>{assert.equal(value.length,0,'this assembled verification fixture has no attachment descriptors');return freeze([]);},
  countShape:countsShape,assetIds:()=>freeze(assetDescriptor?['asset-audio']:[]),attachmentCoverage:values=>freeze({total:values.length,missing:values.filter(row=>row.missing).length,missingIds:freeze(values.filter(row=>row.missing).map(row=>row.assetId)),fullyRecoverable:!values.some(row=>row.missing)}),missingAttachmentWarning:values=>values.some(row=>row.missing)?'Partial attachment recovery: 1 attachment missing.':'',withNoteIdDeletions:(manifest,nameKeyed)=>{assert.equal(nameKeyed,false,'current manifests already key notes by id');return manifest;},
  createCheckpointMetadata:(installationId,createdAt)=>freeze({checkpointId:'cp_'+(++checkpointCounter).toString(16).padStart(32,'0'),createdAt,originInstallationId:installationId}),
  createProtectedManifest:(plan,checkpoint)=>freeze({format:'study-director.checkpoint-protected-manifest',version:3,checkpointId:checkpoint.checkpointId,sourceRevision:new Date(plan.sourceRevision).toISOString(),authority:freeze({savedDays:'pairwise-explicit-deletions',notes:'pairwise-explicit-deletions',activeSession:'pairwise-singleton',plans:'pairwise-collection',personalSettings:'pairwise-singleton',attachments:'referenced-plus-library'}),savedDayDeletions:freeze([...(plan.savedDayDeletions||[])]),noteDeletions:freeze([...(plan.noteDeletions||[])]),attachmentDeletions:freeze([...(plan.attachmentDeletions||[])])}),
  utf8Bytes:value=>new TextEncoder().encode(String(value??'')),compressionSupported:()=>typeof CompressionStream==='function',
  checksumAlgorithm:()=> 'sha256',createManifest:()=>({}),encodeChunk:async()=>({line:'',checksum:''}),splitItems:items=>[items],encodeCompletion:async()=>({}),createV10Container:()=>new Blob(),
  inspect:async()=>({}),normalizeRecord:value=>value,normalizeNote:value=>value
});
const ActiveSessionCodec=freeze({sanitizeImportedActiveSession:value=>value});
const exportsPort=freeze({followProtection:async()=>false,
  backgroundAvailable:()=>backgroundReady?true:'locked',protect:async(file,options)=>publicationProtection?publicationProtection.protect(file,options):freeze({...file,encrypted:false,protectionId:'',checkProtection:async()=>{}}),
  unprotect:async(file,options)=>publicationProtection?publicationProtection.unprotect(file,options):freeze({blob:file,encrypted:false}),check:()=>{},scope:operation=>operation(),job:(operation,options)=>exclusive.job(operation,options),
  run:async(type,data,options)=>{if(type==='file.release'){releasedFiles.push(data.file);return true;}if(type==='checksum'){checksumCounter+=1;if(data&&data.value===audioBlob&&audioBlob.size===AUDIO_BYTES)return AUDIO_HASH;}if(type==='encode.open')encodeOpenCounter+=1;processingInFlight+=1;try{return await engine.run(type,data,options?.progress);}finally{processingInFlight-=1;}},
  download:async()=>{},chooseSave:()=>{},save:async()=>({status:'saved'})
});
const noop=()=>{},diagnosticFailures=[],operationEvents=[];
async function baselineFingerprint(keys){return engine.run('checksum',{value:JSON.stringify([...keys].sort()),algorithm:'sha256'});}
async function writeBaseline(checkpointId,spec){
  if(!spec||spec.format!=='study-director.reconciliation-base-update')throw new Error('Expected reconciliation baseline update.');
  if(!spec.full&&(!reconciliationBase||reconciliationBase.checkpointId!==spec.baseCheckpointId))return false;
  if(spec.full){const keep=new Set(spec.noteKeys||[]);for(const key of Object.keys(reconciliationBaseNotes))if(!keep.has(key))delete reconciliationBaseNotes[key];}
  for(const key of spec.deletes||[])delete reconciliationBaseNotes[key];for(const [key,state] of Object.entries(spec.updates||{}))reconciliationBaseNotes[key]=freeze({label:String(state.label),text:String(state.text)});
  let noteCount=Number(spec.noteCount),noteKeyFingerprint=String(spec.noteKeyFingerprint||'');if(spec.full){const keys=[...(spec.noteKeys||[])].sort();noteCount=keys.length;noteKeyFingerprint=await baselineFingerprint(keys);}reconciliationBase=freeze({format:'study-director.reconciliation-base',version:2,checkpointId,establishedAt:new Date().toISOString(),noteCount,noteKeyFingerprint});
  const noteSnapshot=Object.create(null);for(const key of Object.keys(reconciliationBaseNotes).sort())noteSnapshot[key]=reconciliationBaseNotes[key];reconciliationBaseWrites.push(freeze({checkpointId,notes:freeze(noteSnapshot),spec}));return true;
}
async function forceBaseline(checkpointId,notePayload){
  reconciliationBaseNotes=Object.create(null);for(const [key,value] of Object.entries(notePayload||{}))reconciliationBaseNotes[key]=freeze({label:String(value&&value.label||''),text:String(value&&value.text||'')});const keys=Object.keys(reconciliationBaseNotes).sort();reconciliationBase=freeze({format:'study-director.reconciliation-base',version:2,checkpointId,establishedAt:new Date().toISOString(),noteCount:keys.length,noteKeyFingerprint:await baselineFingerprint(keys)});
}
const runtime=BackupModule.createRuntime(freeze({ports:freeze({
  configuration:freeze({appVersion:'repository-checkpoint-test',backupVersion:RUNTIME_DATA_CONTRACT.schemas.Backup.version,starterSchedule:'',limits:freeze({backupChunkItems:50,backupMaxCompressedBytes:64*1024*1024,backupMaxFileBytes:1024*1024*1024,backupMaxAssetDescriptors:50000,maxImportRecords:10000,maxNoteLinks:50,maxNotes:1000,maxPendingReviews:2000})}),
  
  persistence:freeze({
    activeSessionLoad:async()=>({ok:true,value:null,error:null,storage:{idb:true}}),activeSessionSave:async value=>({ok:true,value}),activeSessionClear:async()=>({ok:true}),activeSessionSettled:async()=>true,
    dailyRecordBackupDates:async()=>({dates:dailyRecords.map(item=>item.date),warning:dailyRecordCanonical?'':'Saved-day IndexedDB unavailable; this backup contains only emergency fallback records.',canonical:dailyRecordCanonical}),dailyRecordBackupMonth:async(month,options={})=>{if(!dailyRecordCanonical&&options.requireCanonical===true)throw Object.assign(new Error('Canonical Daily Records are unavailable.'),{code:'DAILY_RECORDS_CANONICAL_UNAVAILABLE'});return dailyRecords.filter(item=>String(item.date).startsWith(String(month)+'-'));},dailyRecordDocuments:async(dates,options={})=>{if(!dailyRecordCanonical&&options.requireCanonical===true)throw Object.assign(new Error('Canonical Daily Records are unavailable.'),{code:'DAILY_RECORDS_CANONICAL_UNAVAILABLE'});return dates.map(date=>dailyRecords.find(item=>item.date===date)).filter(Boolean);},dailyRecordImportBatches:async()=>({batches:0}),dailyRecordRemove:async()=>true,dailyRecordTimestamp:()=>'',
    notesExportPayload:()=>notes,notesReadFreshPayload:async()=>notes,notesReadFreshItems:async keys=>(keys||[]).map(key=>notes[key]||null),notesFlush:async()=>true,notesNormalizePayload:value=>value,notesTrashKey:key=>String(key).startsWith('~')?'':'~deleted '+key,notesAlignByTitle:value=>value,notesFailure:()=>null,
    restoreJournalPrepare:async()=>true,restoreJournalRead:async()=>null,restoreJournalMark:async()=>true,restoreJournalClear:async()=>true,
    personalSettle:async()=>true,personalExport:async()=>freeze({version:2,plans:freeze({draft:null,savedPlans:freeze([]),defaultId:null}),preferences:freeze(personalCodec.preferences({studentName:'Repo QA'}))}),personalImport:async()=>true,personalVerify:async()=>true,
    storageGeneration:()=>0,sourceRevision:async()=>sourceRevision,snapshotRevision:async()=>snapshotRevision,canonicalMutationEpochRead:async()=>null,canonicalPreparationRebase:async()=>Object.freeze({epoch:null,stamps:Object.freeze([])}),preparationUnitStamps:async()=>[],preparationUnitReplace:async()=>[],installationId:()=> 'inst_repository_qa',deletionRecoveryFlush:async()=>true,deletionRecoverySavedDays:async()=>[],deletionRecoveryReplaceSavedDays:async()=>true,deletionRecoveryNotes:async()=>[],deletionRecoveryReplaceNotes:async()=>true,deletionRecoveryAttachments:async()=>[],deletionRecoveryReplaceAttachments:async()=>true,deletionRecoveryClearAttachment:async()=>true,reconciliationBaseRead:async()=>reconciliationBase,reconciliationBaseReadNotes:async keys=>freeze(Object.fromEntries(keys.filter(key=>Object.prototype.hasOwnProperty.call(reconciliationBaseNotes,key)).map(key=>[key,reconciliationBaseNotes[key]]))),reconciliationBaseReadDays:async()=>freeze({}),...keptReviews.ports,reconciliationBaseWrite:writeBaseline
  }),
  codecs:freeze({activeSession:ActiveSessionCodec,backup:BackupCodec,pendingReview:pendingReviewCodec}),reconciliation:freeze({createPlan:ReconciliationModule.createPlan,resolvePlan:ReconciliationModule.resolvePlan,summarizePlan:ReconciliationModule.summarizePlan}),noteReconciliation:freeze({merge:paragraphMerge,resolve:async({conflicts=[]})=>freeze({format:'study-director.note-reconciliation-result',version:1,notes:freeze(Object.fromEntries(conflicts.map(item=>[item.key,freeze({text:item.localValue,localCandidateId:item.localCandidateId,incomingCandidateId:item.incomingCandidateId})])))})}),exports:exportsPort,
  session:freeze({canMutate:()=>primary,cancelLiveDraftSave:noop,captureSnapshot:()=>null,hasActiveSession:()=>false,hasTasks:()=>false,toActiveSession:()=>null,withPersistenceSuppressed:operation=>operation(),yieldSession:async()=>false}),
  domain:freeze({clampText:value=>String(value||''),filenameSafeStudentName:value=>String(value||'qa'),getStudentName:()=> 'Repo QA',materializeDailyRecordView:value=>value,sanitizeCurrentDailyRecord:value=>value,todayISO:()=> '2026-09-19'}),
  view:freeze({presentation:backupPresentation,refreshPnote:noop,refreshReview:noop,renderSchedule:noop}),
  events:freeze({libraryChanged:noop,backupCompleted:noop,reconcileNotes:async()=>true,restoreNotesSnapshot:async()=>true,restoreSessionState:async()=>true,verifyActiveSessionRuntime:async()=>true,restoredFromFile:()=>false}),
  operations:freeze({canShare:()=>true,assertAuthority:()=>true,clearFault:noop,failClosed:message=>{throw new Error(message);},runExclusive:async(kind,operation)=>operation()}),interactions:freeze({choose:async()=>null,configure:async()=>null,notify:noop}),
  environment:freeze({AbortController,clearTimeout:id=>(backgroundClock||globalThis).clearTimeout(id),yieldTask:async()=>{},setTimeout:(callback,delay)=>(backgroundClock||globalThis).setTimeout(callback,delay)}),diagnostics:freeze({capture:(phase,error)=>{diagnosticFailures.push({phase,error:String(error?.stack||error)});if(diagnosticFailures.length>12)diagnosticFailures.shift();},start:()=>'',mark:(phase,details)=>{operationEvents.push({phase,...details});if(operationEvents.length>100)operationEvents.shift();return false;},finish:()=>false,fail:()=>false}),
  assets:freeze({get:async id=>{assetReads+=1;assert.equal(id,'asset-audio');return audioBlob;},put:async()=>true,keys:async()=>assetDescriptor?['asset-audio']:[],list:async()=>assetDescriptor?[assetDescriptor]:[],importAll:async()=>true,restoreAll:async()=>true,removeMany:async()=>true,removeMetadata:async()=>0,scheduleMaintenance:noop})
})}));

const localRepositoryObjects=new Map();
async function publishLocal(history,options={}){
  const written=[];let manifestWrites=0,deadline;
  const publication=runtime.repository.publish(history,{interactive:false,...options},freeze({
    writeObject:async entry=>{if(entry.kind!=='attachment')await runtime.repository.verifyObject(entry.blob,entry);written.push(entry);localRepositoryObjects.set(entry.objectId,entry.blob);return freeze({id:entry.objectId});},
    writeManifest:async file=>{await runtime.repository.inspectManifest(file.blob,{interactive:false});manifestWrites+=1;return freeze({name:file.manifest.checkpoint.checkpointId+'.sdcheckpoint'});},
    commit:async marker=>{await runtime.repository.inspectCommit(marker.blob);return freeze({name:marker.checkpointId+'.sdcommit'});},
    onCommitted:async()=>null,cleanup:async()=>null,onFailure:async()=>null
  }));
  const result=await Promise.race([publication,new Promise((_,reject)=>{deadline=setTimeout(()=>reject(new Error('Repository publication deadlocked during read-back verification.')),3000);})]).finally(()=>clearTimeout(deadline));
  assert.equal(exclusive.status().busy,false,'publication must release its exclusive file job after nested read-back verification');
  return freeze({result,manifest:result.manifest,written:freeze(written),manifestWrites});
}

dailyRecordCanonical=false;
await assert.rejects(()=>publishLocal(null),error=>error&&error.code==='BACKUP_CANONICAL_CAPTURE_INCOMPLETE','managed repository publication must reject a rescue-partial Daily Records capture instead of committing it as a normal verified checkpoint');
dailyRecordCanonical=true;

const firstPublication=await publishLocal(null),firstManifest=firstPublication.manifest;
assert.equal(assetReads,1,'first repository capture must read the new attachment once');
// Abort while the object reader is awaiting a temporary download must release its lease.
{
  const abort=new AbortController();let reads=0,releases=0;
  await assert.rejects(()=>runtime.repository.verifyCheckpoint(firstManifest,async entry=>{
    reads++;abort.abort();return freeze({blob:localRepositoryObjects.get(entry.objectId),release:async()=>{releases++;}});
  },{signal:abort.signal}),error=>error.name==='AbortError');
  assert.equal(reads,1);assert.equal(releases,1,'cancellation after reader completion must release exactly once');
}
const firstAttachment=firstManifest.objects.find(item=>item.kind==='attachment');
assert.ok(firstAttachment&&firstAttachment.sourceBytes===AUDIO_BYTES);assert.equal(firstPublication.result.objectsWritten,firstManifest.objects.length,'first repository publication must write every physical object');assert.equal(firstManifest.version,8,'new managed checkpoints must use the canonical-note-name packed-object manifest contract');const firstSubjectPack=firstManifest.objects.find(item=>item.kind==='structuredPack'&&item.members?.some(member=>member.kind==='note'&&member.key==='Subject'));assert.ok(firstSubjectPack,'small notes must be stored inside a deterministic structured pack');assert.equal(firstSubjectPack.members.filter(member=>member.kind==='note').length,2,'multiple tiny notes assigned to the same deterministic shard must share one physical pack');assert.equal(firstManifest.objects.some(item=>item.kind==='note'&&item.key==='Subject'),false,'packed notes must not also be written as standalone physical objects');
assert.match(firstManifest.logicalFingerprint,/^[a-f0-9]{64}$/u,'managed checkpoints must carry a provider-independent logical-state fingerprint');
assert.equal(runtime.repository.validatePolicy(runtime.repository.retention),runtime.repository.retention,'managed repository policy ownership must remain centralized in the shared repository engine');
assert.throws(()=>runtime.repository.validatePolicy(freeze({...runtime.repository.retention,normalLimit:runtime.repository.retention.normalLimit-1})),/retention policy is invalid or unsupported/i,'consumers must not redefine a divergent managed-retention slot count');
const classifierCommit=freeze({format:'study-director.backup-repository-commit',version:1,checkpointId:firstManifest.checkpoint.checkpointId,exportedAt:firstManifest.exportedAt,sourceRevision:firstManifest.sourceRevision,manifestVersion:firstManifest.version});
const classifierOrphanId='cp_'+String(799).padStart(32,'0'),classifierState=runtime.repository.classifyState(freeze({manifests:freeze([freeze({id:firstManifest.checkpoint.checkpointId,ref:'manifest-1',manifest:firstManifest})]),commits:freeze([freeze({id:firstManifest.checkpoint.checkpointId,ref:'commit-1',marker:classifierCommit}),freeze({id:classifierOrphanId,ref:'commit-orphan',marker:freeze({...classifierCommit,checkpointId:classifierOrphanId})})])}));
assert.equal(classifierState.committed.length,1,'shared repository classifier must pair a verified manifest with its matching commit');assert.equal(classifierState.orphanCommits.length,1,'shared repository classifier must identify orphan commits transport-neutrally');assert.equal(classifierState.latest.id,firstManifest.checkpoint.checkpointId);
const logicalFingerprint=firstManifest.logicalFingerprint;
const shiftedCheckpointIso=new Date(Date.parse(firstManifest.exportedAt)+60_000).toISOString();
const shiftedCalendar=firstManifest.retention.calendar;
const sameLogicalState={...firstManifest,checkpoint:{...firstManifest.checkpoint,checkpointId:'cp_'+String(701).padStart(32,'0'),createdAt:shiftedCheckpointIso},exportedAt:shiftedCheckpointIso,sourceRevision:shiftedCheckpointIso,installationId:'another-installation',protectedCheckpointManifest:{...firstManifest.protectedCheckpointManifest,checkpointId:'cp_'+String(701).padStart(32,'0'),sourceRevision:shiftedCheckpointIso},reconciliationBaseId:'cp_'+String(700).padStart(32,'0'),reconciliationAncestorIds:freeze(['cp_'+String(700).padStart(32,'0')]),retention:{...firstManifest.retention,calendar:{...shiftedCalendar}},logicalFingerprint};
const sameLogicalInspected=await runtime.repository.inspectManifest(new Blob([JSON.stringify(sameLogicalState)]),{interactive:false});
assert.equal(sameLogicalInspected.logicalFingerprint,logicalFingerprint,'provider, checkpoint identity, capture time, installation and ancestry must not change logical managed-state identity');
const changedLogicalState={...sameLogicalState,objects:firstManifest.objects.map((entry,index)=>index?entry:{...entry,fingerprint:'f'.repeat(64)})};
await assert.rejects(()=>runtime.repository.inspectManifest(new Blob([JSON.stringify(changedLogicalState)]),{interactive:false}),/logical-state fingerprint failed verification/i,'a changed portable canonical object must invalidate the prior logical-state fingerprint');
const tamperedLogicalManifest={...firstManifest,logicalFingerprint:'0'.repeat(64)};await assert.rejects(()=>runtime.repository.inspectManifest(new Blob([JSON.stringify(tamperedLogicalManifest)]),{interactive:false}),/logical-state fingerprint failed verification/i,'stored logical identity must be verified rather than trusted');
const historyDevice=runtime.repository.projectHistory([Object.freeze({id:firstManifest.checkpoint.checkpointId,manifest:firstManifest})],Object.freeze({id:'device-folder',label:'Device Folder'}));
const driveCopy={...sameLogicalInspected};driveCopy.checkpoint={...driveCopy.checkpoint,checkpointId:'cp_'+String(702).padStart(32,'0')};const historyDrive=runtime.repository.projectHistory([Object.freeze({id:driveCopy.checkpoint.checkpointId,manifest:Object.freeze(driveCopy)})],Object.freeze({id:'google-drive',label:'Google Drive'}));
assert.equal(historyDevice.length,1);assert.equal(historyDrive.length,1);assert.equal(historyDevice[0].logicalFingerprint,historyDrive[0].logicalFingerprint,'independent providers must project the same provider-independent logical identity without requiring a merged global history');
const duplicateDeviceCopy={...sameLogicalInspected};duplicateDeviceCopy.checkpoint={...duplicateDeviceCopy.checkpoint,checkpointId:'cp_'+String(703).padStart(32,'0')};duplicateDeviceCopy.exportedAt=new Date(Date.parse(firstManifest.exportedAt)+120_000).toISOString();duplicateDeviceCopy.checkpoint.createdAt=duplicateDeviceCopy.exportedAt;duplicateDeviceCopy.sourceRevision=duplicateDeviceCopy.exportedAt;duplicateDeviceCopy.retention={...duplicateDeviceCopy.retention,calendar:{...shiftedCalendar}};const sameProviderDuplicate=runtime.repository.projectHistory([Object.freeze({id:firstManifest.checkpoint.checkpointId,manifest:firstManifest}),Object.freeze({id:duplicateDeviceCopy.checkpoint.checkpointId,manifest:Object.freeze(duplicateDeviceCopy)})],Object.freeze({id:'device-folder',label:'Device Folder'}));assert.equal(sameProviderDuplicate.length,1,'Version History must expose only the newest retained same-day checkpoint even before obsolete physical files are deleted.');assert.equal(sameProviderDuplicate[0].location.checkpointId,duplicateDeviceCopy.checkpoint.checkpointId,'provider-scoped history must keep the newest same-day equivalent as the restore target');assert.equal(sameProviderDuplicate[0].location.tier,'latest','the newest provider-scoped equivalent must retain latest status');
const safetyDeviceCopy={...sameLogicalInspected};safetyDeviceCopy.checkpoint={...safetyDeviceCopy.checkpoint,checkpointId:'cp_'+String(704).padStart(32,'0')};safetyDeviceCopy.exportedAt=new Date(Date.parse(firstManifest.exportedAt)+60_000).toISOString();safetyDeviceCopy.checkpoint.createdAt=safetyDeviceCopy.exportedAt;safetyDeviceCopy.sourceRevision=safetyDeviceCopy.exportedAt;safetyDeviceCopy.retention={...safetyDeviceCopy.retention,role:'before-restore',protectedUntil:new Date(Date.parse(safetyDeviceCopy.exportedAt)+7*24*60*60*1000).toISOString(),calendar:{...shiftedCalendar}};const mixedSameProvider=runtime.repository.projectHistory([Object.freeze({id:firstManifest.checkpoint.checkpointId,manifest:firstManifest}),Object.freeze({id:safetyDeviceCopy.checkpoint.checkpointId,manifest:Object.freeze(safetyDeviceCopy)}),Object.freeze({id:duplicateDeviceCopy.checkpoint.checkpointId,manifest:Object.freeze(duplicateDeviceCopy)})],Object.freeze({id:'device-folder',label:'Device Folder'}));assert.equal(mixedSameProvider.length,2,'provider-scoped history must retain both the newest normal checkpoint and the independently protected Before restore checkpoint');assert.ok(mixedSameProvider.some(row=>row.location.checkpointId===duplicateDeviceCopy.checkpoint.checkpointId&&row.location.tier==='latest'));assert.ok(mixedSameProvider.some(row=>row.location.checkpointId===safetyDeviceCopy.checkpoint.checkpointId&&row.location.tier==='before-restore'));
const quarantinedObjectId=firstManifest.objects[0].objectId,quarantinedDeviceHistory=runtime.repository.projectHistory([Object.freeze({id:firstManifest.checkpoint.checkpointId,manifest:firstManifest})],Object.freeze({id:'device-folder',label:'Device Folder'}),{quarantinedObjectIds:Object.freeze([quarantinedObjectId])});assert.equal(quarantinedDeviceHistory.length,0,'Version History must not advertise a managed location that depends on an object already quarantined by repository integrity checks.');assert.equal(historyDrive.length,1,'quarantining one provider must not erase an independently healthy provider-scoped copy of the same logical version.');

// Integrity scrub verifies durable repository objects, skips volatile session/review objects, and always releases read leases.
const scrubObjectFiles=new Map(localRepositoryObjects),scrubReadKinds=[],scrubReleased=[];
let scrubCursor='',scrubScanId='',scrubChecked=0,scrubComplete=false;
while(!scrubComplete){
  const progress=await runtime.repository.scrub([firstManifest],entry=>{scrubReadKinds.push(entry.kind);const blob=scrubObjectFiles.get(entry.objectId);if(!blob)throw new Error('missing scrub fixture object');return freeze({blob,release:async()=>{scrubReleased.push(entry.objectId);}});},{cursor:scrubCursor,scanId:scrubScanId,maxObjects:1,maxBytes:64*1024*1024});
  scrubChecked+=progress.checked;scrubCursor=progress.cursor;scrubScanId=progress.scanId;scrubComplete=progress.complete;
}
const expectedScrubbed=firstManifest.objects.filter(entry=>entry.kind!=='activeSession');
assert.equal(scrubChecked,expectedScrubbed.length,'integrity scrub must verify each stable repository object exactly once per cycle');
assert.equal(scrubReleased.length,scrubReadKinds.length,'every repository object lease opened for integrity hashing must be released');
// A location that reports each stored object's checksum (Drive's SHA-256) is
// checked against it: nothing is downloaded, and a mismatch is corruption.
const digestReads=[],digestRead=entry=>{digestReads.push(entry.objectId);return scrubObjectFiles.get(entry.objectId);};
const digestCycle=await runtime.repository.scrub([firstManifest],digestRead,{maxObjects:1,maxBytes:1,storedDigest:entry=>entry.storedChecksum});
assert.equal(digestReads.length,0,'reported checksums need no download');assert.equal(digestCycle.complete,true,'reported checksums cost no budget, so one pass covers the repository');assert.equal(digestCycle.checked,expectedScrubbed.length);
const tamperedId=expectedScrubbed[0].objectId;let tampered=null;
try{await runtime.repository.scrub([firstManifest],digestRead,{storedDigest:entry=>entry.objectId===tamperedId?'f'.repeat(64):entry.storedChecksum});}catch(error){tampered=error;}
assert.equal(tampered?.code,'REPOSITORY_INTEGRITY_CORRUPT');assert.equal(tampered.repositoryObjectId,tamperedId);assert.equal(digestReads.length,0);
const mixed=await runtime.repository.scrub([firstManifest],digestRead,{maxObjects:32,storedDigest:entry=>entry.objectId===tamperedId?'':entry.storedChecksum});
assert.equal(mixed.complete,true);assert.deepEqual(digestReads,[tamperedId],'an object without a reported checksum is read and hashed');

// Verified progress must survive a stop between objects, while a changed scan
// inventory must not reuse a cursor that could skip newly inserted objects.
const progressReader=entry=>scrubObjectFiles.get(entry.objectId),interruption=new AbortController();let savedProgress=null;
await assert.rejects(runtime.repository.scrub([firstManifest],progressReader,{signal:interruption.signal,onProgress:async progress=>{savedProgress=progress;interruption.abort(new Error('test boundary stop'));}}));
assert.equal(savedProgress.checked,1);assert.ok(savedProgress.cursor);assert.match(savedProgress.scanId,/^[a-f0-9]{64}$/u);
const resumedReads=[];const resumedProgress=await runtime.repository.scrub([firstManifest],entry=>{resumedReads.push(entry.objectId);return progressReader(entry);},{cursor:savedProgress.cursor,scanId:savedProgress.scanId,maxObjects:32});
assert.equal(resumedProgress.complete,true);assert.ok(!resumedReads.includes(savedProgress.cursor),'restart must not repeat the verified prefix');
const staleReads=[];await runtime.repository.scrub([firstManifest],entry=>{staleReads.push(entry.objectId);return progressReader(entry);},{cursor:savedProgress.cursor,scanId:'0'.repeat(64),maxObjects:1});
assert.equal(staleReads[0],savedProgress.cursor,'changed inventory must restart before the old cursor');
let unavailable=null;try{await runtime.repository.scrub([firstManifest],()=>{throw Object.assign(new Error('transport timeout'),{code:'DRIVE_TIMEOUT'});});}catch(error){unavailable=error;}
assert.equal(unavailable.code,'DRIVE_TIMEOUT');assert.ok(unavailable.repositoryObjectId);assert.equal(unavailable.repositoryScrubProgress.checked,0);
await assert.rejects(runtime.repository.scrub([firstManifest],progressReader,{onProgress:async()=>{throw new Error('durable progress failed');}}),/durable progress failed/);
const structuredEntry=firstManifest.objects.find(entry=>entry.kind==='structuredPack'),invalidJson=new Blob(['not-json\n']);
const invalidDigest=await engine.run('checksum',{value:invalidJson}),invalidManifest=freeze({...firstManifest,objects:freeze(firstManifest.objects.map(entry=>entry===structuredEntry?freeze({...entry,storedBytes:invalidJson.size,storedChecksum:invalidDigest,compression:'none'}):entry))});
await assert.rejects(runtime.repository.scrub([invalidManifest],entry=>entry.objectId===structuredEntry.objectId?invalidJson:progressReader(entry),{maxObjects:32,maxBytes:1024*1024*1024}),{code:'REPOSITORY_INTEGRITY_CORRUPT'},'verified bytes containing invalid JSON prove structural corruption');

// An explicit recheck retains quarantine until the object's complete checks pass.
const recheckId=structuredEntry.objectId,quarantine=[recheckId];let quarantineCheckpoint=null;
const recheck=await runtime.repository.scrub([firstManifest],progressReader,{recheck:true,skipObjectIds:quarantine,maxObjects:32,maxBytes:1024*1024*1024,onProgress:async value=>{quarantineCheckpoint=value;}});
assert.equal(recheck.complete,true);assert.equal(recheck.quarantined.includes(recheckId),false);assert.equal(quarantineCheckpoint.quarantined.includes(recheckId),false);
let unavailableRecheck;try{await runtime.repository.scrub([firstManifest],entry=>{if(entry.objectId===recheckId)throw Object.assign(new Error('temporary read failure'),{code:'DRIVE_TIMEOUT'});return progressReader(entry);},{recheck:true,skipObjectIds:quarantine,maxObjects:32,maxBytes:1024*1024*1024});}catch(error){unavailableRecheck=error;}
assert.equal(unavailableRecheck.code,'DRIVE_TIMEOUT');assert.ok(unavailableRecheck.repositoryScrubProgress.quarantined.includes(recheckId),'unavailable rechecks must preserve quarantine');

// Attempted failures have their own durable cursor; they never count as healthy
// verification or block the remaining quarantined objects behind them.
const recheckOrder=[];
await runtime.repository.scrub([firstManifest],entry=>{recheckOrder.push(entry.objectId);return progressReader(entry);},{maxObjects:32,maxBytes:1024*1024*1024});
const [knownBadId,laterHealthyId]=recheckOrder;assert.ok(laterHealthyId);
{
 const reads=[],initialQuarantine=[knownBadId,laterHealthyId];let checkpoint={cursor:'',recheckCursor:'',scanId:'',partial:null,quarantined:initialQuarantine},result,healthyChecked=0,attempted=0;
 for(let pass=0;pass<recheckOrder.length+1;pass++){
  result=await runtime.repository.scrub([firstManifest],entry=>{reads.push(entry.objectId);return entry.objectId===knownBadId?new Blob(['known damaged bytes']):progressReader(entry);},{...checkpoint,recheck:true,skipObjectIds:checkpoint.quarantined,maxObjects:1,maxBytes:1024*1024*1024,onProgress:async value=>{checkpoint=structuredClone(value);}});
  healthyChecked+=result.checked;attempted+=result.attempted;assert.equal(result.attempted,1);
  if(pass===0){assert.equal(result.cursor,'');assert.equal(result.recheckCursor,knownBadId);assert.equal(result.status,'yielded');assert.equal(result.corruption,true);assert.equal(result.checked,0);}
  if(result.complete)break;
 }
 assert.equal(result.complete,true);assert.equal(result.recheckComplete,true);assert.equal(result.status,'failed');assert.equal(result.corruption,true);assert.deepEqual([...result.quarantined],[knownBadId]);assert.equal(healthyChecked,recheckOrder.length-1);assert.equal(attempted,recheckOrder.length);assert.deepEqual(reads,recheckOrder);
 assert.equal(checkpoint.recheckCursor,recheckOrder.at(-1));const terminalRetry=await runtime.repository.scrub([firstManifest],()=>assert.fail('terminal progress must not reread an attempted object'),{...checkpoint,recheck:true,skipObjectIds:checkpoint.quarantined,maxObjects:1});assert.equal(terminalRetry.complete,true);assert.equal(terminalRetry.status,'failed');
}
for(const code of ['DRIVE_TIMEOUT','BACKUP_LOCKED','BACKUP_AUTH_FAILED']){
 const reads=[],initialQuarantine=[knownBadId,laterHealthyId];let checkpoint={cursor:'',recheckCursor:'',scanId:'',partial:null,quarantined:initialQuarantine},error;
 try{await runtime.repository.scrub([firstManifest],entry=>{reads.push(entry.objectId);if(entry.objectId===laterHealthyId)throw Object.assign(new Error('temporarily unavailable'),{code});return entry.objectId===knownBadId?new Blob(['known damaged bytes']):progressReader(entry);},{...checkpoint,recheck:true,skipObjectIds:initialQuarantine,maxObjects:32,maxBytes:1024*1024*1024,onProgress:async value=>{checkpoint=structuredClone(value);}});}catch(value){error=value;}
 assert.equal(error.code,code);assert.equal(error.repositoryScrubProgress.recheckCursor,knownBadId);assert.equal(error.repositoryScrubProgress.cursor,'');assert.deepEqual(new Set(error.repositoryScrubProgress.quarantined),new Set(initialQuarantine));
 const resumed=await runtime.repository.scrub([firstManifest],entry=>{assert.notEqual(entry.objectId,knownBadId);return progressReader(entry);},{...checkpoint,recheck:true,skipObjectIds:checkpoint.quarantined,maxObjects:32,maxBytes:1024*1024*1024});assert.equal(resumed.complete,true);assert.equal(resumed.status,'failed');assert.deepEqual([...resumed.quarantined],[knownBadId]);
}
{
 let attempts=0;const options={recheck:true,skipObjectIds:[knownBadId,laterHealthyId],maxObjects:1,maxBytes:1024*1024*1024};
 await assert.rejects(runtime.repository.scrub([firstManifest],entry=>{attempts++;return new Blob(['known damaged bytes']);},{...options,onProgress:async()=>{throw new Error('durable attempt checkpoint failed');}}),/durable attempt checkpoint failed/);
 const retried=await runtime.repository.scrub([firstManifest],entry=>{attempts++;return new Blob(['known damaged bytes']);},options);assert.equal(attempts,2);assert.equal(retried.recheckCursor,knownBadId);assert.equal(retried.cursor,'');
 const changed=freeze({...firstManifest,objects:freeze(firstManifest.objects.map(entry=>entry.objectId===knownBadId?freeze({...entry,fingerprint:'f'.repeat(64)}):entry))});let reread='';
 const reset=await runtime.repository.scrub([changed],entry=>{reread=entry.objectId;return new Blob(['known damaged bytes']);},{...options,...retried,skipObjectIds:options.skipObjectIds});assert.equal(reread,knownBadId);assert.notEqual(reset.scanId,retried.scanId);
}
{
 let result,checkpoint={cursor:'',recheckCursor:'',scanId:'',partial:null},reads=0;const allBad=[...recheckOrder];
 for(let pass=0;pass<recheckOrder.length;pass++){
  result=await runtime.repository.scrub([firstManifest],()=>{reads++;return null;},{...checkpoint,recheck:true,skipObjectIds:allBad,maxObjects:2,maxBytes:1024*1024*1024,onProgress:async value=>{checkpoint=structuredClone(value);}});
  assert.ok(result.attempted<=2);assert.equal(result.checked,0);assert.equal(result.cursor,'');if(result.complete)break;
 }
 assert.equal(result.complete,true);assert.equal(result.status,'failed');assert.equal(reads,recheckOrder.length);assert.equal(result.quarantined.length,recheckOrder.length);
 await assert.rejects(runtime.repository.scrub([firstManifest],entry=>entry.objectId===knownBadId?new Blob(['new damage']):progressReader(entry),{recheck:true,skipObjectIds:[laterHealthyId],maxObjects:32,maxBytes:1024*1024*1024}),error=>error.code==='REPOSITORY_INTEGRITY_CORRUPT'&&error.repositoryObjectId===knownBadId&&error.repositoryScrubProgress.recheckCursor==='','new corruption retains the existing typed failure/repair path');
}

// A new attachment cannot be sealed from same-size corrupted OPFS plaintext,
// even if its canonical metadata still advertises the original SHA-256.
// Existing healthy content-addressed objects remain eligible for cheap reuse.
{
  const originalAudio=audioBlob,originalDescriptor=assetDescriptor,oldSnapshot=snapshotRevision,oldRevision=sourceRevision;
  const canonical=new Blob(['canonical-audio'],{type:'audio/mpeg'}),tampered=new Blob(['CORRUPTED-audio'],{type:'audio/mpeg'});
  assert.equal(canonical.size,tampered.size);
  assetDescriptor=freeze({...originalDescriptor,size:canonical.size,hash:await engine.run('checksum',{value:canonical})});
  audioBlob=tampered;snapshotRevision='corrupt-attachment';sourceRevision='2026-09-19T00:00:15.000Z';
  try{await assert.rejects(()=>publishLocal(firstManifest),error=>error?.code==='REPOSITORY_INTEGRITY_CORRUPT'&&/Local attachment .*plaintext verification/u.test(error.message),'a same-size corrupt local attachment must never become a newly committed checkpoint');}
  finally{audioBlob=originalAudio;assetDescriptor=originalDescriptor;snapshotRevision=oldSnapshot;sourceRevision=oldRevision;}
}

const readsBeforeSecond=assetReads,encodesBeforeSecond=encodeOpenCounter;
const secondPublication=await publishLocal(firstManifest),secondManifest=secondPublication.manifest;
assert.equal(assetReads,readsBeforeSecond,'unchanged 300 MB attachment must not be reread for the second checkpoint');
assert.equal(encodeOpenCounter,encodesBeforeSecond,'unchanged structured objects must not be recompressed');
assert.equal(secondPublication.result.objectsWritten,0,'identical checkpoint must write no repository objects');
assert.equal(secondPublication.result.objectsReused,secondManifest.objects.length,'identical checkpoint should reuse every repository object');
assert.equal(secondManifest.objects.find(item=>item.kind==='attachment')?.objectId,firstAttachment.objectId,'unchanged attachment must reuse its repository object');

// Change an old Saved Day: only its monthly record pack should become fresh; the attachment stays untouched.
dailyRecords=[freeze({...dailyRecords[0],reflection:'edited old reflection',updatedAt:'2026-09-19T00:01:00.000Z'})];snapshotRevision='rev-2';sourceRevision='2026-09-19T00:01:00.000Z';
const thirdPublication=await publishLocal(secondManifest),thirdManifest=thirdPublication.manifest;
assert.equal(assetReads,readsBeforeSecond,'editing an old record must not reread an unchanged attachment');
const secondIds=new Set(secondManifest.objects.map(item=>item.objectId)),fresh=thirdManifest.objects.filter(item=>!secondIds.has(item.objectId)).map(item=>`${item.kind}:${item.key}`),reused=thirdManifest.objects.filter(item=>secondIds.has(item.objectId)).map(item=>`${item.kind}:${item.key}`);
assert.deepEqual(fresh,['dailyRecordPack:2026-09'],'only the changed monthly Saved-Day pack should be rewritten');
assert.ok(reused.includes('attachment:content:'+AUDIO_HASH+':'+AUDIO_BYTES));

// Change one note: only that note object should become fresh.
notes={N4:stableSecondaryNote,Subject:freeze({...notes.Subject,text:'edited note',updatedAt:'2026-09-19T00:02:00.000Z'})};snapshotRevision='rev-3';sourceRevision='2026-09-19T00:02:00.000Z';
const fourthPublication=await publishLocal(thirdManifest),fourthManifest=fourthPublication.manifest;
assert.equal(assetReads,readsBeforeSecond,'editing a note must not reread an unchanged attachment');
const thirdIds=new Set(thirdManifest.objects.map(item=>item.objectId)),noteFresh=fourthManifest.objects.filter(item=>!thirdIds.has(item.objectId)).map(item=>`${item.kind}:${item.key}`);
assert.equal(noteFresh.length,1,'only one physical structured pack should be rewritten for a one-note edit');assert.match(noteFresh[0],/^structuredPack:shard:[0-3]$/u,'the changed note must rewrite only its deterministic small-object shard');

// A → B → A must reuse the older retained A object rather than create a duplicate.
const firstNoteObject=firstManifest.objects.find(item=>item.kind==='structuredPack'&&item.members?.some(member=>member.kind==='note'&&member.key==='Subject'));assert.ok(firstNoteObject);
notes={N4:stableSecondaryNote,Subject:freeze({version:2,key:'Subject',text:'stable note',updatedAt:'2026-09-18T20:00:00.000Z'})};snapshotRevision='rev-aba';sourceRevision='2026-09-19T00:02:30.000Z';
const abaPublication=await publishLocal([firstManifest,fourthManifest]),abaManifest=abaPublication.manifest,abaNote=abaManifest.objects.find(item=>item.kind==='structuredPack'&&item.members?.some(member=>member.kind==='note'&&member.key==='Subject'));assert.equal(abaNote.objectId,firstNoteObject.objectId,'A → B → A must reuse the retained A structured pack');
notes={N4:stableSecondaryNote,Subject:freeze({version:2,key:'Subject',text:'edited note',updatedAt:'2026-09-19T00:02:00.000Z'})};snapshotRevision='rev-3b';sourceRevision='2026-09-19T00:02:40.000Z';

// Metadata-only attachment edits must update the manifest descriptor while reusing the immutable bytes.
assetDescriptor=freeze({...assetDescriptor,name:'renamed-audio.mp3',library:false});snapshotRevision='rev-4';sourceRevision='2026-09-19T00:03:00.000Z';
const fifthPublication=await publishLocal(fourthManifest),fifthManifest=fifthPublication.manifest;
assert.equal(assetReads,readsBeforeSecond,'attachment metadata changes must not reread unchanged attachment bytes');
assert.equal(fifthPublication.result.objectsWritten,0,'metadata-only attachment changes should not create repository objects');
assert.equal(fifthManifest.assets[0].name,'renamed-audio.mp3');assert.equal(fifthManifest.assets[0].library,false);

// Delete the historical Saved Day: the new complete manifest simply stops referencing its pack.
dailyRecords=[];snapshotRevision='rev-5';sourceRevision='2026-09-19T00:04:00.000Z';
const sixthPublication=await publishLocal(fifthManifest),sixthManifest=sixthPublication.manifest;
assert.equal(assetReads,readsBeforeSecond,'deleting a Saved Day must not reread an unchanged attachment');
assert.equal(sixthManifest.objects.some(item=>item.kind==='dailyRecordPack'),false,'committed checkpoint must not resurrect the deleted Saved Day');
const safetyPublication=await publishLocal([sixthManifest],{retention:{role:'before-restore',purpose:'before-clear-library'}}),safetyManifest=safetyPublication.manifest,safetyLifetime=Date.parse(safetyManifest.retention.protectedUntil)-Date.parse(safetyManifest.exportedAt);
assert.equal(safetyManifest.retention.role,'before-restore','managed publication must be able to create a protected safety checkpoint');assert.equal(safetyManifest.retention.purpose,'before-clear-library','protected safety purpose must survive manifest publication');assert.equal(safetyLifetime,7*24*60*60*1000,'protected safety must default to seven days');assert.equal(safetyManifest.retention.calendar.month,safetyManifest.retention.calendar.localDate.slice(0,7),'retention calendar metadata must be internally coherent');
const safetyProjection=runtime.repository.projectHistory([freeze({id:safetyManifest.checkpoint.checkpointId,manifest:safetyManifest})],{id:'device-folder',label:'Device Folder'},{now:new Date(safetyManifest.exportedAt)});assert.equal(safetyProjection[0].location.safetyPurpose,'before-clear-library','Version History must preserve the protected safety purpose for user-facing labels.');
const degradedManifest=freeze({...safetyManifest,warning:'Legacy checkpoint was captured from an emergency rescue subset.'}),degradedProjection=runtime.repository.projectHistory([freeze({id:degradedManifest.checkpoint.checkpointId,manifest:degradedManifest})],{id:'device-folder',label:'Device Folder'},{now:new Date(degradedManifest.exportedAt)});assert.equal(degradedProjection[0].location.health,'degraded','Version History must identify legacy warning-bearing managed checkpoints as degraded captures');assert.match(degradedProjection[0].location.warning,/emergency rescue subset/i,'Version History must preserve the legacy capture warning for user-facing details.');

// Once local preparation is verified, later edits belong to the next checkpoint.
// Slow provider I/O must not invalidate the immutable historical snapshot already sealed.
notes={N4:stableSecondaryNote,Subject:freeze({...notes.Subject,text:'sealed-capture probe',updatedAt:'2026-09-19T00:04:30.000Z'})};snapshotRevision='rev-sealed-start';sourceRevision='2026-09-19T00:04:30.000Z';let sealedManifestWrites=0,mutated=false;
const sealedPublication=await runtime.repository.publish([sixthManifest],{interactive:false},freeze({
  writeObject:async entry=>{if(!mutated){mutated=true;snapshotRevision='rev-6';sourceRevision='2026-09-19T00:05:00.000Z';}return freeze({id:entry.objectId});},
  writeManifest:async file=>{sealedManifestWrites+=1;return freeze({name:file.manifest.checkpoint.checkpointId+'.sdcheckpoint'});},commit:async marker=>freeze({name:marker.checkpointId+'.sdcommit'}),onFailure:async()=>null
}));
assert.equal(sealedManifestWrites,1,'a source mutation after local capture is sealed must not cancel external manifest publication');
assert.equal(sealedPublication.manifest.sourceRevision,'2026-09-19T00:04:30.000Z','the committed checkpoint must retain the source revision of its sealed snapshot');

// Local calendar fields a version carries for retention (also used below).
const retentionCalendar=date=>{const d=new Date(date+'T12:00:00'),day=d.getDay(),monday=new Date(d);monday.setDate(d.getDate()-((day+6)%7));const key=value=>`${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;return freeze({localDate:date,weekStart:key(monday),month:date.slice(0,7),utcOffsetMinutes:-d.getTimezoneOffset()});};
const malformedRetentionManifest={...firstManifest,retention:{...firstManifest.retention,calendar:{...firstManifest.retention.calendar,localDate:'2000-01-01',month:'2000-01'}}};await assert.rejects(()=>runtime.repository.inspectManifest(new Blob([JSON.stringify(malformedRetentionManifest)]),{interactive:false}),/retention calendar is invalid/i,'retention metadata must agree with the checkpoint instant and captured UTC offset');

// Both managed provider entry points must be able to request the same protected checkpoint role without bypassing the shared coordinator.
const protectedProviderFiles=new Map(),protectedProviderPublications=new Map(),protectedProviderMaintenances=new Map(),protectedProviderKey=(kind,id)=>kind+':'+id,protectedProviderDescriptor=file=>freeze({kind:file.kind,id:file.id,name:file.name,size:file.blob.size,digest:file.digest,remoteId:'protected-'+file.kind+'-'+file.id});let protectedProviderLeaseId=0;
const protectedProviderLease=(prefix,store)=>{const lease=freeze({id:prefix+'-'+(++protectedProviderLeaseId),createdAt:new Date().toISOString()});store.set(lease.id,lease);return lease;},protectedProviderAssert=(store,lease)=>{if(!lease||!store.has(lease.id))throw new Error('protected provider lease is no longer active');return true;};
const protectedProviderTransport=freeze({list:async({kind})=>freeze({items:freeze([...protectedProviderFiles.values()].filter(file=>file.kind===kind).map(protectedProviderDescriptor)),overflow:false}),upload:async file=>{protectedProviderFiles.set(protectedProviderKey(file.kind,file.id),freeze({...file}));return protectedProviderDescriptor(file);},download:async ref=>{const file=protectedProviderFiles.get(protectedProviderKey(ref.kind,ref.id));if(!file)throw new Error('missing protected provider file');return freeze({blob:file.blob,release:async()=>{}});},delete:async ref=>protectedProviderFiles.delete(protectedProviderKey(ref.kind,ref.id)),beginPublication:async()=>protectedProviderLease('pub',protectedProviderPublications),listPublications:async()=>freeze({items:freeze([...protectedProviderPublications.values()]),overflow:false}),assertPublication:async lease=>protectedProviderAssert(protectedProviderPublications,lease),endPublication:async lease=>protectedProviderPublications.delete(lease.id),beginMaintenance:async()=>protectedProviderLease('mnt',protectedProviderMaintenances),listMaintenances:async()=>freeze({items:freeze([...protectedProviderMaintenances.values()]),overflow:false}),assertMaintenance:async lease=>protectedProviderAssert(protectedProviderMaintenances,lease),endMaintenance:async lease=>protectedProviderMaintenances.delete(lease.id)});
assert.equal(runtime.providers.register(freeze({id:'repository-protected',label:'Repository Protected QA',repository:protectedProviderTransport})),true);snapshotRevision='provider-protected';sourceRevision='2026-09-19T00:30:00.000Z';const protectedProviderResult=await runtime.providers.backupRepositoryProvider('repository-protected',{retention:{role:'before-restore',purpose:'before-combine'}}),protectedProviderCheckpoint=[...protectedProviderFiles.values()].find(file=>file.kind==='checkpoint'),protectedProviderManifest=await runtime.repository.inspectManifest(protectedProviderCheckpoint.blob,{interactive:false});assert.equal(protectedProviderManifest.retention.role,'before-restore','managed provider API must forward the protected safety retention role');assert.equal(protectedProviderManifest.retention.purpose,'before-combine','managed provider API must preserve the protected safety purpose');assert.equal([...protectedProviderFiles.values()].filter(file=>file.kind==='commit').length,1,'protected managed-provider publication must still cross the immutable commit boundary');assert.match(protectedProviderResult.name,/^cp_[a-f0-9]{32}\.sdcheckpoint$/u);
const blockingProtectedPublication=await protectedProviderTransport.beginPublication();await assert.rejects(()=>runtime.providers.removeRepositoryProviderVersion('repository-protected',protectedProviderResult.checkpointId),/deferred|active/i,'protected-provider removal must refuse to delete before it obtains exclusive maintenance protection');assert.equal([...protectedProviderFiles.values()].filter(file=>file.kind==='checkpoint').length,1,'blocked protected-provider removal must leave the manifest intact');assert.equal([...protectedProviderFiles.values()].filter(file=>file.kind==='commit').length,1,'blocked protected-provider removal must leave the commit intact');await protectedProviderTransport.endPublication(blockingProtectedPublication);
const removedProtectedProvider=await runtime.providers.removeRepositoryProviderVersion('repository-protected',protectedProviderResult.checkpointId);assert.equal(removedProtectedProvider.removed,true,'the active Before restore provider checkpoint must be explicitly removable');assert.equal(removedProtectedProvider.entries.length,0,'removing the only protected provider version must return an empty verified history projection');assert.equal([...protectedProviderFiles.values()].filter(file=>file.kind==='checkpoint').length,0,'explicit protected-point removal must delete its immutable manifest');assert.equal([...protectedProviderFiles.values()].filter(file=>file.kind==='commit').length,0,'explicit protected-point removal must delete its commit marker before normal GC');assert.ok([...protectedProviderFiles.values()].filter(file=>file.kind==='object').length>0,'coordination-capable repositories must preserve newly orphaned objects through the normal 48-hour GC grace after explicit safety removal');await assert.rejects(()=>runtime.providers.removeRepositoryProviderVersion('repository-protected',protectedProviderResult.checkpointId),/no longer this device's safety version/i,'a removed safety point must not be removable twice');
const orphanMaintenance=freeze({id:'mnt-orphaned-provider-maintenance',createdAt:new Date(Date.now()-61*1000).toISOString()});protectedProviderMaintenances.set(orphanMaintenance.id,orphanMaintenance);snapshotRevision='provider-protected-orphan-recovery';sourceRevision='2026-09-19T00:31:00.000Z';notes={N4:stableSecondaryNote,Subject:freeze({version:2,key:'Subject',text:'orphan maintenance recovery',updatedAt:sourceRevision})};const orphanMaintenanceBackup=await runtime.providers.backupRepositoryProvider('repository-protected');assert.ok(orphanMaintenanceBackup.name,'a Drive/provider backup must recover in the same attempt from an abandoned maintenance lease');assert.equal(protectedProviderMaintenances.has(orphanMaintenance.id),false,'an expired maintenance marker must be reaped before foreground publication continues');

// Provider orchestration: marker first, then overlap read-only discovery with maintenance safety;
// after durable commit marker release is awaited so coordination protection is definitely cleared before success returns.
const overlapFiles=new Map(),overlapPublications=new Map(),overlapMaintenances=new Map(),overlapKey=(kind,id)=>kind+':'+id;let overlapLeaseId=0,discoveryObserved=false,releaseStarted=false,releaseFinished=false;
let allowSafety,allowRelease,signalDiscovery,signalReleaseStart;const safetyGate=new Promise(resolve=>{allowSafety=resolve;}),releaseGate=new Promise(resolve=>{allowRelease=resolve;}),discoveryStarted=new Promise(resolve=>{signalDiscovery=resolve;}),releaseStartedGate=new Promise(resolve=>{signalReleaseStart=resolve;});
const overlapDescriptor=file=>freeze({kind:file.kind,id:file.id,name:file.name,size:file.blob.size,digest:file.digest,createdAt:file.createdAt||new Date().toISOString(),modifiedAt:file.modifiedAt||file.createdAt||new Date().toISOString(),remoteId:'overlap-'+file.kind+'-'+file.id});
const overlapLease=(prefix,store)=>{const lease=freeze({id:prefix+'-'+(++overlapLeaseId),createdAt:new Date().toISOString()});store.set(lease.id,lease);return lease;};
const overlapTransport=freeze({
  list:async({kind})=>{if(kind==='checkpoint'&&!discoveryObserved){discoveryObserved=true;signalDiscovery();}return freeze({items:freeze([...overlapFiles.values()].filter(file=>file.kind===kind).map(overlapDescriptor)),overflow:false});},
  upload:async file=>{const stored=freeze({...file,createdAt:new Date().toISOString()});overlapFiles.set(overlapKey(file.kind,file.id),stored);return overlapDescriptor(stored);},
  download:async ref=>{const file=overlapFiles.get(overlapKey(ref.kind,ref.id));if(!file)throw new Error('missing overlap fixture file');return freeze({blob:file.blob,release:async()=>{}});},
  delete:async ref=>overlapFiles.delete(overlapKey(ref.kind,ref.id)),
  beginPublication:async()=>overlapLease('pub',overlapPublications),listPublications:async()=>freeze({items:freeze([...overlapPublications.values()]),overflow:false}),assertPublication:async lease=>{if(!overlapPublications.has(lease.id))throw new Error('overlap publication lease lost');return true;},
  endPublication:async lease=>{releaseStarted=true;signalReleaseStart();await releaseGate;releaseFinished=true;return overlapPublications.delete(lease.id);},
  beginMaintenance:async()=>overlapLease('mnt',overlapMaintenances),listMaintenances:async()=>{await safetyGate;return freeze({items:freeze([...overlapMaintenances.values()]),overflow:false});},assertMaintenance:async lease=>{if(!overlapMaintenances.has(lease.id))throw new Error('overlap maintenance lease lost');return true;},endMaintenance:async lease=>overlapMaintenances.delete(lease.id)
});
assert.equal(runtime.providers.register(freeze({id:'repository-overlap',label:'Repository Overlap QA',repository:overlapTransport})),true);snapshotRevision='provider-overlap';sourceRevision='2026-09-19T00:40:00.000Z';notes={N4:stableSecondaryNote,Subject:freeze({version:2,key:'Subject',text:'provider overlap',updatedAt:sourceRevision})};
const overlapBackup=runtime.providers.backupRepositoryProvider('repository-overlap');
await Promise.race([discoveryStarted,new Promise((_,reject)=>setTimeout(()=>reject(new Error('repository discovery did not start while maintenance safety was pending')),500))]);
assert.equal(overlapPublications.size,1,'provider-visible publication protection must exist before speculative discovery starts');allowSafety();
let overlapSettled=false;overlapBackup.finally(()=>{overlapSettled=true;});await Promise.race([releaseStartedGate,new Promise((_,reject)=>setTimeout(()=>reject(new Error('committed backup did not start publication-marker release')),1000))]);assert.equal(releaseStarted,true,'successful commit must initiate publication-marker cleanup');for(let i=0;i<8;i++)await Promise.resolve();assert.equal(overlapSettled,false,'successful backup must await publication-marker cleanup before reporting completion');assert.equal(releaseFinished,false);allowRelease();const overlapResult=await overlapBackup;assert.ok(overlapResult?.checkpointId);assert.equal(releaseFinished,true,'publication-marker cleanup must finish before successful backup returns');

// Post-publication receipt reuse: verified upload read-backs seed the non-authoritative history index.
const receiptFiles=new Map(),receiptDownloads=freeze({checkpoint:[],commit:[],object:[]}),receiptReleases={checkpoint:0,commit:0,object:0},receiptDeletes=[],receiptLists={checkpoint:0,commit:0,object:0},receiptListOptions=[];let receiptRemoteVersion=0,injectConcurrentObjectOnCommit=false;
const receiptKey=(kind,id)=>kind+':'+id,receiptScope='qa-post-publication-receipts';
const receiptDescriptor=file=>freeze({kind:file.kind,id:file.id,name:file.name,size:file.blob.size,createdAt:file.createdAt,modifiedAt:file.modifiedAt,digest:file.digest,serverDigest:file.kind==='object'?file.digest:'',remoteId:'receipt-'+file.kind+'-'+file.id,remoteVersion:String(file.remoteVersion),verificationScope:receiptScope});
const receiptList=async({kind,freshDigests=false})=>{receiptLists[kind]+=1;receiptListOptions.push(freeze({kind,freshDigests}));return freeze({items:freeze([...receiptFiles.values()].filter(file=>file.kind===kind).map(receiptDescriptor)),overflow:false});};
const receiptUpload=async file=>{const now=new Date().toISOString(),stored=freeze({...file,createdAt:now,modifiedAt:now,remoteVersion:++receiptRemoteVersion});receiptFiles.set(receiptKey(file.kind,file.id),stored);if(file.kind==='commit'&&injectConcurrentObjectOnCommit){injectConcurrentObjectOnCommit=false;const id='obj_'+'9'.repeat(32),blob=new Blob(['concurrent-object-not-visible-to-initial-inventory']),digest=await engine.run('checksum',{value:blob});receiptFiles.set(receiptKey('object',id),freeze({kind:'object',id,name:id+'.sdobject',blob,size:blob.size,digest,createdAt:now,modifiedAt:now,remoteVersion:++receiptRemoteVersion}));}return receiptDescriptor(stored);};
const receiptDownload=async ref=>{const stored=receiptFiles.get(receiptKey(ref.kind,ref.id));if(!stored)throw new Error('missing receipt-reuse repository file');receiptDownloads[ref.kind].push(ref.id);return freeze({blob:stored.blob,release:async()=>{receiptReleases[ref.kind]+=1;}});};
const receiptDelete=async ref=>{receiptDeletes.push(freeze({kind:ref.kind,id:ref.id}));return receiptFiles.delete(receiptKey(ref.kind,ref.id));};
const receiptTransport=freeze({list:receiptList,upload:receiptUpload,download:receiptDownload,delete:receiptDelete,beginOperation:()=>freeze({list:receiptList,upload:receiptUpload,download:receiptDownload,delete:receiptDelete})});
assert.equal(runtime.providers.register(freeze({id:'repository-receipts',label:'Repository Receipts QA',repository:receiptTransport})),true);
snapshotRevision='provider-receipt-1';sourceRevision='2026-09-19T00:45:00.000Z';notes={N4:stableSecondaryNote,Subject:freeze({version:2,key:'Subject',text:'receipt reuse one',updatedAt:sourceRevision})};
const firstReceiptPublication=await runtime.providers.backupRepositoryProvider('repository-receipts');
assert.equal(receiptDownloads.object.length,0,'a matching trusted server SHA-256 receipt must avoid redundant object read-back without weakening SHA-256 verification');
assert.equal(receiptDownloads.checkpoint.length,1,'new manifest must be downloaded exactly once for publication read-back verification; post-commit state must reuse that verified receipt');
assert.equal(receiptDownloads.commit.length,1,'new commit marker must be downloaded exactly once for publication read-back verification; post-commit state must reuse that verified receipt');
assert.equal(receiptReleases.checkpoint,1,'shared publication readback must release the checkpoint lease after verification');
assert.equal(receiptReleases.commit,1,'shared publication readback must release the commit lease after verification');
assert.ok(receiptListOptions.some(row=>row.kind==='checkpoint'&&row.freshDigests===false)&&receiptListOptions.some(row=>row.kind==='commit'&&row.freshDigests===false),'ordinary post-publication history refresh must not pay the full fresh-digest maintenance cost');
assert.equal([...receiptFiles.values()].filter(file=>file.kind==='checkpoint').length,1,'receipt reuse must not change sparse retention results');
assert.equal([...receiptFiles.values()].filter(file=>file.kind==='commit').length,1,'receipt reuse must retain the matching commit marker');
assert.equal(receiptLists.object,1,'a cold first publication without a reusable pre-publication inventory must still obtain a fresh object listing for cleanup');
const immutableDownloadsAfterFirst=receiptDownloads.checkpoint.length+receiptDownloads.commit.length,firstReceiptHistory=await runtime.providers.history('repository-receipts',{interactive:false});
assert.equal(firstReceiptHistory.entries.length,1,'visible Version History must expose the newly published checkpoint unchanged');assert.equal(firstReceiptHistory.entries[0].location.checkpointId,firstReceiptPublication.checkpointId);
assert.equal(receiptDownloads.checkpoint.length+receiptDownloads.commit.length,immutableDownloadsAfterFirst,'warm history immediately after publication must reuse the already verified manifest/commit interpretations');
snapshotRevision='provider-receipt-2';sourceRevision='2026-09-19T00:46:00.000Z';notes={N4:stableSecondaryNote,Subject:freeze({version:2,key:'Subject',text:'receipt reuse two',updatedAt:sourceRevision})};
const objectListsBeforeSecondReceipt=receiptLists.object;injectConcurrentObjectOnCommit=true;const secondReceiptPublication=await runtime.providers.backupRepositoryProvider('repository-receipts'),objectListsDuringSecondReceipt=receiptLists.object-objectListsBeforeSecondReceipt;
assert.equal(receiptDownloads.checkpoint.length,2,'each publication should incur only its own manifest read-back, not a second post-publication manifest download');
assert.equal(receiptDownloads.commit.length,2,'each publication should incur only its own commit read-back, not a second post-publication commit download');
assert.equal(receiptReleases.checkpoint,2,'each checkpoint readback must release exactly one lease');
assert.equal(receiptReleases.commit,2,'each commit readback must release exactly one lease');
assert.ok(receiptDeletes.some(item=>item.kind==='checkpoint')&&receiptDeletes.some(item=>item.kind==='commit'),'a newer same-day publication must prune the older immutable manifest/commit even below the 15-point capacity');
assert.equal(objectListsDuringSecondReceipt,1,'a mature publication must reuse its verified pre-publication object inventory during ordinary cleanup instead of relisting the same objects');
assert.equal(receiptFiles.has(receiptKey('object','obj_'+'9'.repeat(32))),true,'an object that appeared after the reused inventory snapshot must be conservatively left untouched rather than inferred safe to delete');
const secondReceiptHistory=await runtime.providers.history('repository-receipts',{interactive:false});assert.equal(secondReceiptHistory.entries.length,1,'same-day provider history must expose only the newest retained checkpoint after cleanup');assert.equal(secondReceiptHistory.entries[0].location.checkpointId,secondReceiptPublication.checkpointId,'the retained same-day publication must be Latest');

// Keep later provider assertions scoped to provider publications rather than the local coordinator probes above.
reconciliationBaseWrites=[];reconciliationBase=null;reconciliationBaseNotes=Object.create(null);

// Provider coordinator: daily-bucket histories remain intact; committed checkpoints share objects and GC is reachability-safe.
const remoteFiles=new Map(),remoteDeletes=[],remoteUploads=[];let remoteDownloads=0,remoteReleases=0,failRemoteCommit=false,remoteOperationBegins=0;
const remoteKey=(kind,id)=>kind+':'+id;
const descriptor=file=>freeze({kind:file.kind,id:file.id,name:file.name,size:file.blob.size,createdAt:file.createdAt,modifiedAt:file.createdAt,digest:file.digest,remoteId:'remote-'+file.kind+'-'+file.id});
const repositoryList=async({kind})=>freeze({items:freeze([...remoteFiles.values()].filter(file=>file.kind===kind).map(descriptor)),overflow:false});
const repositoryUpload=async file=>{if(failRemoteCommit&&file.kind==='commit'){failRemoteCommit=false;throw new Error('simulated provider commit-marker failure');}const stored=freeze({...file,createdAt:new Date().toISOString()});remoteFiles.set(remoteKey(file.kind,file.id),stored);remoteUploads.push(freeze({kind:file.kind,id:file.id,size:file.blob.size}));return descriptor(stored);};
const repositoryDownload=async(ref,options={})=>{const stored=remoteFiles.get(remoteKey(ref.kind,ref.id));if(!stored)throw new Error('missing remote repository file');remoteDownloads+=1;options.onProgress?.({loaded:stored.blob.size,total:stored.blob.size});return freeze({blob:stored.blob,release:async()=>{remoteReleases+=1;}});};
const repositoryDelete=async ref=>{remoteDeletes.push(freeze({kind:ref.kind,id:ref.id}));return remoteFiles.delete(remoteKey(ref.kind,ref.id));};
const repositoryTransport=freeze({
  list:repositoryList,upload:repositoryUpload,download:repositoryDownload,delete:repositoryDelete,
  beginOperation:()=>{remoteOperationBegins+=1;return freeze({list:repositoryList,upload:repositoryUpload,download:repositoryDownload,delete:repositoryDelete});}
});
// This location stands in for Drive: only a shared location moves the base.
assert.equal(runtime.providers.register(freeze({id:'repository-qa',label:'Repository QA',shared:true,repository:repositoryTransport})),true);
snapshotRevision='provider-1';sourceRevision='2026-09-19T01:00:00.000Z';dailyRecords=[freeze({version:16,recordKind:'study',date:'2026-09-18',reflection:'provider record',savedAt:sourceRevision,updatedAt:sourceRevision})];
notes={N4:stableSecondaryNote,Subject:freeze({version:2,key:'Subject',text:'provider note 1',updatedAt:sourceRevision})};
const providerAttachmentReadsBefore=assetReads;
const providerResults=[];
for(let index=1;index<=6;index++){
  if(index>1){sourceRevision=`2026-09-${String(18+index).padStart(2,'0')}T01:00:00.000Z`;snapshotRevision=`provider-${index}`;notes={N4:stableSecondaryNote,Subject:freeze({version:2,key:'Subject',text:`provider note ${index}`,updatedAt:sourceRevision})};}
  providerResults.push(await runtime.providers.backupRepositoryProvider('repository-qa'));
}
assert.equal(assetReads-providerAttachmentReadsBefore,1,'Drive/provider repository sequence must read the unchanged 300 MB attachment only for its first upload');
assert.equal(providerResults[0].attachmentBytesWritten,AUDIO_BYTES);assert.ok(providerResults.slice(1).every(result=>result.attachmentBytesWritten===0),'later repository checkpoints must write zero attachment bytes');assert.equal(remoteOperationBegins,6,'each managed provider backup must use exactly one repository operation boundary even though it lists, downloads, uploads, verifies and cleans up multiple remote files');
assert.equal([...remoteFiles.values()].filter(file=>file.kind==='checkpoint').length,1,'repeated provider backups captured on the same local date must retain only the newest immutable checkpoint');
assert.equal(remoteUploads.filter(file=>file.kind==='object'&&file.size===AUDIO_BYTES).length,1,'the large attachment repository object must be uploaded once');
assert.equal(remoteDeletes.some(item=>item.kind==='checkpoint'),true,'same-day provider publications must prune older manifest/commit representatives even below the 15-point capacity');
assert.equal(reconciliationBaseWrites.length,6,'Each verified provider checkpoint must advance the single local reconciliation baseline exactly once.');
const providerWritesBeforeHistory=remoteUploads.length,providerDeletesBeforeHistory=remoteDeletes.length,providerHistory=await runtime.providers.history('repository-qa',{interactive:false});assert.equal(providerHistory.available,true,'managed provider history must expose verified committed checkpoints read-only');assert.equal(providerHistory.entries.length,1,'managed provider history must expose only the newest same-day retained checkpoint');assert.equal(remoteUploads.length,providerWritesBeforeHistory,'reading Version History must never publish repository content');assert.equal(remoteDeletes.length,providerDeletesBeforeHistory,'reading Version History must never prune or mutate the provider');assert.ok(providerHistory.entries.every(entry=>entry.location.sourceId==='repository-qa'),'history projection must retain the physical provider location without coupling providers');
assert.equal(reconciliationBaseWrites.at(-1).checkpointId,[...remoteFiles.values()].filter(file=>file.kind==='checkpoint').sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)).at(-1).id,'The newest verified provider checkpoint must become the current reconciliation baseline.');
assert.equal(reconciliationBaseWrites.at(-1).notes.Subject.text,'provider note 6','The reconciliation baseline must store the exact note content captured in that checkpoint.');
const retainedLineage=[];for(const file of remoteFiles.values())if(file.kind==='checkpoint')retainedLineage.push(await runtime.repository.inspectManifest(file.blob,{interactive:false}));retainedLineage.sort((a,b)=>Date.parse(a.exportedAt)-Date.parse(b.exportedAt));
for(let index=1;index<retainedLineage.length;index++){
  assert.equal(retainedLineage[index].reconciliationBaseId,retainedLineage[index-1].checkpoint.checkpointId,'Each successive retained provider checkpoint must identify the prior verified checkpoint as its direct reconciliation ancestor.');
  assert.equal(retainedLineage[index].reconciliationAncestorIds[0],retainedLineage[index-1].checkpoint.checkpointId,'The bounded ancestry chain must start with the direct verified parent.');
  if(index>=2)assert.equal(retainedLineage[index].reconciliationAncestorIds[1],retainedLineage[index-2].checkpoint.checkpointId,'A device one checkpoint behind the direct parent must remain provably related for three-way reconciliation.');
}
assert.ok(retainedLineage.at(-1).reconciliationAncestorIds.length>=3,'The newest retained checkpoint must carry enough ancestry IDs for realistic three-device lag.');

// Reconciliation ancestry must survive the real publication -> retention-prune -> publication lifecycle rather than depending on retained ancestor manifests.
const ancestryDepth=runtime.repository.retention.normalLimit+runtime.repository.retention.protectedLimit+4,prunableLineage=[];let ancestryParent='',inheritedAncestry=[];
for(let index=0;index<ancestryDepth;index+=1){
  const id='cp_'+String(1200+index).padStart(32,'0'),lineage=ancestryParent?freeze([ancestryParent,...inheritedAncestry]):freeze([]),protectedCheckpointManifest=freeze({...firstManifest.protectedCheckpointManifest,checkpointId:id});
  const manifest=freeze({...firstManifest,checkpoint:freeze({...firstManifest.checkpoint,checkpointId:id}),protectedCheckpointManifest,reconciliationBaseId:ancestryParent,reconciliationAncestorIds:lineage});
  prunableLineage.push(freeze({id,manifest}));inheritedAncestry=lineage;ancestryParent=id;
}
assert.ok(prunableLineage.length>runtime.repository.retention.normalLimit+runtime.repository.retention.protectedLimit,'the ancestry regression must exceed the currently retained managed-history capacity');
const prunedLineage=await runtime.repository.cleanup(freeze({checkpoints:freeze(prunableLineage),now:new Date(firstManifest.exportedAt),invalidCount:0,ignoredCount:0,deleteCheckpoint:async()=>true,listObjects:async()=>freeze({items:freeze([]),overflow:false,invalidCount:0}),deleteObject:async()=>true}));
assert.equal(prunedLineage.retained.length,1,'same-day tiered retention must actually prune the intermediate ancestry manifests in this regression');
const retainedParent=prunedLineage.retained[0].manifest;assert.equal(retainedParent.checkpoint.checkpointId,ancestryParent,'the newest lineage checkpoint must be the sole retained same-day representative');assert.ok(retainedParent.reconciliationAncestorIds.length>runtime.repository.retention.normalLimit,'the retained parent itself must remember ancestry deeper than the normal history slots');
const reconciliationWritesBeforeDeepLineage=reconciliationBaseWrites.length;await forceBaseline(ancestryParent,notes);const deepLineagePublication=await publishLocal(freeze([retainedParent]));const expectedDeepLineage=freeze([ancestryParent,...retainedParent.reconciliationAncestorIds]);
assert.deepEqual(deepLineagePublication.manifest.reconciliationAncestorIds,expectedDeepLineage,'a new checkpoint must inherit its verified parent ancestry even after retention has pruned the intermediate manifests');assert.ok(deepLineagePublication.manifest.reconciliationAncestorIds.length>runtime.repository.retention.normalLimit+runtime.repository.retention.protectedLimit,'inherited reconciliation ancestry must remain independent of the retained checkpoint-slot count');reconciliationBaseWrites.length=reconciliationWritesBeforeDeepLineage;

// A failed provider final-commit write must not publish a new Latest or advance local reconciliation provenance.
const providerLatestBeforeCommitFailure=retainedLineage.at(-1).checkpoint.checkpointId,providerCheckpointCountBeforeCommitFailure=[...remoteFiles.values()].filter(file=>file.kind==='checkpoint').length,providerCommitCountBeforeCommitFailure=[...remoteFiles.values()].filter(file=>file.kind==='commit').length,providerBaselineWritesBeforeCommitFailure=reconciliationBaseWrites.length;
// The probe above moved the base elsewhere; this device is back in step with the provider's newest version.
await forceBaseline(providerLatestBeforeCommitFailure,notes);
sourceRevision='2026-09-19T01:05:15.000Z';snapshotRevision='provider-commit-failure';notes={N4:stableSecondaryNote,Subject:freeze({version:2,key:'Subject',text:'provider commit failure probe',updatedAt:sourceRevision})};failRemoteCommit=true;
await assert.rejects(()=>runtime.providers.backupRepositoryProvider('repository-qa'),/commit-marker failure/i);
// A failed or ambiguous commit upload leaves uncommitted bytes behind for
// verified inventory cleanup. The publication error path cannot establish
// ownership: speculative deletion could remove a previously committed version.
assert.equal([...remoteFiles.values()].filter(file=>file.kind==='checkpoint').length,providerCheckpointCountBeforeCommitFailure+1,'a failed final commit may retain its unpublished manifest for safe later cleanup');
assert.equal([...remoteFiles.values()].filter(file=>file.kind==='commit').length,providerCommitCountBeforeCommitFailure,'failed provider final commit must not add a committed-history entry');
assert.equal(reconciliationBaseWrites.length,providerBaselineWritesBeforeCommitFailure,'failed provider final commit must not advance reconciliation provenance');
const providerCommitIds=new Set([...remoteFiles.values()].filter(file=>file.kind==='commit').map(file=>file.id));
const providerCommittedAfterFailure=[];for(const file of remoteFiles.values())if(file.kind==='checkpoint'&&providerCommitIds.has(file.id))providerCommittedAfterFailure.push(await runtime.repository.inspectManifest(file.blob,{interactive:false}));
providerCommittedAfterFailure.sort((a,b)=>Date.parse(a.exportedAt)-Date.parse(b.exportedAt));
assert.equal(providerCommittedAfterFailure.at(-1).checkpoint.checkpointId,providerLatestBeforeCommitFailure,'failed provider final commit must leave the previous committed Latest intact');
const providerVisibleAfterFailure=await runtime.providers.history('repository-qa',{interactive:false});
assert.equal(providerVisibleAfterFailure.entries.at(-1)?.location.checkpointId,providerLatestBeforeCommitFailure,'orphan manifest must not become a visible backup version');

const pendingProviderBackups=new Map();
runtime.providers.configurePendingBackupRetry(freeze({read:async id=>pendingProviderBackups.get(id)||null,mark:async id=>(pendingProviderBackups.set(id,freeze({providerId:id})),true),clear:async id=>(pendingProviderBackups.delete(id),true)}));
// Each location publishes canonical local state independently. Neither provider
// downloads from, waits for, or backfills from the other.
{
  const store=()=>{const files=new Map(),key=(kind,id)=>kind+':'+id,describe=file=>freeze({kind:file.kind,id:file.id,name:file.name,size:file.blob.size,createdAt:file.createdAt,modifiedAt:file.createdAt,digest:file.digest,remoteId:'independent-'+key(file.kind,file.id)});
    return freeze({files,transport:freeze({list:async({kind})=>freeze({items:freeze([...files.values()].filter(file=>file.kind===kind).map(describe)),overflow:false}),upload:async file=>{const stored=freeze({...file,createdAt:new Date().toISOString()});files.set(key(file.kind,file.id),stored);return describe(stored);},download:async ref=>{const stored=files.get(key(ref.kind,ref.id));if(!stored)throw new Error('missing independent-provider file');return freeze({blob:stored.blob,release:async()=>{}});},delete:async ref=>files.delete(key(ref.kind,ref.id))})});};
  let connected=true;const baseBefore=reconciliationBase,baseNotesBefore=reconciliationBaseNotes;
  const device=store(),drive=store(),versions=location=>[...location.files.values()].filter(file=>file.kind==='checkpoint').map(file=>file.id).sort(),uploads=location=>[...location.files.values()].filter(file=>file.kind==='object').length;
  assert.equal(runtime.providers.register(freeze({id:'independent-device',label:'Device Folder',connected:()=>connected,repository:device.transport})),true);
  assert.equal(runtime.providers.register(freeze({id:'independent-drive',label:'Google Drive',shared:true,connected:()=>connected,repository:drive.transport})),true);
  runtime.providers.configureAutomaticBackup(freeze({covered:()=>sourceRevision,current:()=>sourceRevision}));
  try{
    sourceRevision='2026-09-19T02:00:00.000Z';snapshotRevision='independent-1';notes={N4:stableSecondaryNote,Subject:freeze({version:2,key:'Subject',text:'independent one',updatedAt:sourceRevision})};
    const deviceFirst=await runtime.providers.backupRepositoryProvider('independent-device',{interactive:false}),driveFirst=await runtime.providers.backupRepositoryProvider('independent-drive',{interactive:false});
    assert.ok(deviceFirst.checkpointId&&driveFirst.checkpointId,'both independent destinations publish a verified checkpoint');assert.notEqual(deviceFirst.checkpointId,driveFirst.checkpointId,'independent destinations must not share checkpoint identity');
    assert.equal(versions(device).length,1);assert.equal(versions(drive).length,1);assert.ok(uploads(device)>0&&uploads(drive)>0,'each destination receives canonical objects directly');
    assert.equal(reconciliationBase.checkpointId,driveFirst.checkpointId,'Drive publication alone establishes the shared reconciliation base');
    sourceRevision='2026-09-19T02:10:00.000Z';snapshotRevision='independent-2';notes={N4:stableSecondaryNote,Subject:freeze({version:2,key:'Subject',text:'independent two',updatedAt:sourceRevision})};
    const driveSecond=await runtime.providers.backupRepositoryProvider('independent-drive',{interactive:false}),deviceSecond=await runtime.providers.backupRepositoryProvider('independent-device',{interactive:false});
    assert.ok(driveSecond.checkpointId&&deviceSecond.checkpointId);assert.notEqual(driveSecond.checkpointId,deviceSecond.checkpointId);assert.deepEqual(versions(device),[deviceSecond.checkpointId],'same-day retention keeps only the newest independent Device Folder version');assert.deepEqual(versions(drive),[driveSecond.checkpointId],'same-day retention keeps only the newest independent Drive version');
    assert.equal(reconciliationBase.checkpointId,driveSecond.checkpointId,'Device Folder publication does not replace Drive shared ancestry');
  }finally{runtime.providers.configureAutomaticBackup(null);connected=false;reconciliationBase=baseBefore;reconciliationBaseNotes=baseNotesBefore;}
}
// Taking turns at Drive: another device's recent upload marker makes this one
// wait, but a marker an earlier page of this device left behind (an upload cut
// off by a closed page) never does.
{
  const files=new Map(),markers=new Map(),key=(kind,id)=>kind+':'+id,describe=file=>freeze({kind:file.kind,id:file.id,name:file.name,size:file.blob.size,createdAt:file.createdAt,modifiedAt:file.createdAt,remoteId:'turn-'+key(file.kind,file.id)});
  let leases=0;const lease=prefix=>freeze({id:prefix+'_'+String(++leases).padStart(32,'0'),createdAt:new Date().toISOString()});
  const transport=freeze({list:async({kind})=>freeze({items:freeze([...files.values()].filter(file=>file.kind===kind).map(describe)),overflow:false}),upload:async file=>{const stored=freeze({...file,createdAt:new Date().toISOString()});files.set(key(file.kind,file.id),stored);return describe(stored);},download:async ref=>{const stored=files.get(key(ref.kind,ref.id));if(!stored)throw new Error('missing turn file');return freeze({blob:stored.blob,release:async()=>{}});},delete:async ref=>files.delete(key(ref.kind,ref.id)),
    beginPublication:async()=>{const row=lease('pub');markers.set(row.id,row);return row;},listPublications:async()=>freeze({items:freeze([...markers.values()]),overflow:false,ignored:0}),assertPublication:async row=>row,endPublication:async row=>markers.delete(row.id),
    beginMaintenance:async()=>lease('mnt'),listMaintenances:async()=>freeze({items:freeze([]),overflow:false,ignored:0}),assertMaintenance:async row=>row,endMaintenance:async()=>true});
  const baseBefore=reconciliationBase,baseNotesBefore=reconciliationBaseNotes;
  assert.equal(runtime.providers.register(freeze({id:'turn-drive',label:'Google Drive',shared:true,connected:()=>true,repository:transport})),true);
  try{
    sourceRevision='2026-09-19T03:00:00.000Z';snapshotRevision='turn-1';notes={N4:stableSecondaryNote,Subject:freeze({version:2,key:'Subject',text:'turn one',updatedAt:sourceRevision})};
    const leftover=freeze({id:'pub_'+'e'.repeat(32),createdAt:new Date(Date.now()-60*1000).toISOString(),sameDevice:true});markers.set(leftover.id,leftover);
    const first=await runtime.providers.backupRepositoryProvider('turn-drive',{interactive:false});
    assert.ok(first.checkpointId,'a marker this device left behind does not make it wait for itself');
    markers.delete(leftover.id);
    const other=freeze({id:'pub_'+'0'.repeat(32),createdAt:new Date(Date.now()-60*1000).toISOString()});markers.set(other.id,other);
    sourceRevision='2026-09-19T03:10:00.000Z';snapshotRevision='turn-2';notes={N4:stableSecondaryNote,Subject:freeze({version:2,key:'Subject',text:'turn two',updatedAt:sourceRevision})};
    await assert.rejects(()=>runtime.providers.backupRepositoryProvider('turn-drive',{interactive:false}),{code:'REPOSITORY_SYNC_TURN'},'another device\'s recent upload goes first');
    assert.equal([...markers.keys()].filter(id=>id!==other.id).length,0,'the refused upload removes its own marker');
  }finally{reconciliationBase=baseBefore;reconciliationBaseNotes=baseNotesBefore;}
}
const retainedManifests=[];
for(const file of remoteFiles.values())if(file.kind==='checkpoint')retainedManifests.push(await runtime.repository.inspectManifest(file.blob,{interactive:false}));
const retainedObjectIds=new Set(retainedManifests.flatMap(manifest=>manifest.objects.map(entry=>entry.objectId)));
for(const item of remoteDeletes.filter(item=>item.kind==='object'))assert.equal(retainedObjectIds.has(item.id),false,'GC must never delete an object referenced by any retained manifest');

remoteDownloads=0;remoteReleases=0;
const providerScrub=await runtime.providers.scrubRepositoryProvider('repository-qa',{cursor:'',maxObjects:32,maxBytes:1024*1024*1024});
const timeoutTransport=freeze({...repositoryTransport,beginOperation:()=>freeze({list:repositoryList,upload:repositoryUpload,delete:repositoryDelete,download:async(ref,options)=>{if(ref.kind==='object')throw Object.assign(new Error('read timeout'),{code:'DRIVE_TIMEOUT'});return repositoryDownload(ref,options);}})});
runtime.providers.register(freeze({id:'repository-timeout',label:'Timeout QA',repository:timeoutTransport}));const uploadsBeforeTimeout=remoteUploads.length,readsBeforeTimeout=assetReads;
await assert.rejects(runtime.providers.scrubRepositoryProvider('repository-timeout'),{code:'DRIVE_TIMEOUT'});assert.equal(remoteUploads.length,uploadsBeforeTimeout,'read unavailability must not publish a repair');assert.equal(assetReads,readsBeforeTimeout,'transport failure must not read canonical assets for repair');
assert.equal(providerScrub.complete,true,'authorized provider scrub should finish a bounded retained repository in one QA batch');
assert.ok(providerScrub.checked>0,'provider scrub must verify retained repository objects');
assert.equal(remoteReleases,remoteDownloads,'every temporary provider download used for manifest/object integrity verification must be released');

// A repository object removed outside Study Director must be detected from metadata and rebuilt from canonical data, without downloading every retained object.
const missingAttachment=[...remoteFiles.values()].find(file=>file.kind==='object'&&file.blob.size===AUDIO_BYTES);
assert.ok(missingAttachment,'retained repository must contain the large attachment object before self-heal test');
remoteFiles.delete(remoteKey('object',missingAttachment.id));
const orphanId='obj_'+'e'.repeat(32),orphanBlob=new Blob(['orphan']),orphanDigest='b'.repeat(64);
remoteFiles.set(remoteKey('object',orphanId),freeze({kind:'object',id:orphanId,name:orphanId+'.sdobject',blob:orphanBlob,digest:orphanDigest,createdAt:new Date().toISOString()}));
const readsBeforeProviderHeal=assetReads;sourceRevision='2026-09-25T01:00:00.000Z';snapshotRevision='provider-7';notes={N4:stableSecondaryNote,Subject:freeze({version:2,key:'Subject',text:'provider note 7',updatedAt:sourceRevision})};
const healed=await runtime.providers.backupRepositoryProvider('repository-qa');
assert.equal(assetReads-readsBeforeProviderHeal,1,'a missing remote attachment object must be reread exactly once from canonical storage');
assert.equal(healed.attachmentBytesWritten,AUDIO_BYTES,'a missing remote attachment object must be rebuilt in the new checkpoint');
assert.equal([...remoteFiles.values()].filter(file=>file.kind==='checkpoint').length,1,'self-heal on the same local date must replace the retained daily representative rather than accumulating another checkpoint');
assert.equal(remoteFiles.has(remoteKey('object',orphanId)),false,'reference-aware GC must remove an orphan object left outside all retained manifests');
assert.ok(remoteDeletes.some(item=>item.kind==='object'&&item.id===orphanId),'orphan cleanup must use the repository transport delete primitive');

// Periodic scrub prioritizes attachments and heals corruption by publishing a fresh current object without rewriting historical manifests.
const scrubManifests=[];for(const file of remoteFiles.values())if(file.kind==='checkpoint')scrubManifests.push(await runtime.repository.inspectManifest(file.blob,{interactive:false}));scrubManifests.sort((a,b)=>Date.parse(a.exportedAt)-Date.parse(b.exportedAt));const scrubAttachmentId=scrubManifests.at(-1).objects.find(entry=>entry.kind==='attachment')?.objectId,scrubAttachment=remoteFiles.get(remoteKey('object',scrubAttachmentId));assert.ok(scrubAttachment&&scrubAttachment.blob.size===AUDIO_BYTES,'scrub repair requires the current retained large attachment object');
const corruptBlob=new Blob([new Uint8Array([255]),scrubAttachment.blob.slice(1)]);remoteFiles.set(remoteKey('object',scrubAttachment.id),freeze({...scrubAttachment,blob:corruptBlob}));
const readsBeforeScrubHeal=assetReads;let scrubFailure=null;try{await runtime.providers.scrubRepositoryProvider('repository-qa',{cursor:'',maxObjects:1,maxBytes:AUDIO_BYTES+1024,skipObjectIds:[missingAttachment.id]});}catch(error){scrubFailure=error;}
assert.ok(scrubFailure,'corrupt retained attachment must fail the scrub');assert.equal(scrubFailure.repositoryObjectKind,'attachment','attachments must be the first scrub priority');assert.equal(scrubFailure.repositoryObjectId,scrubAttachment.id);assert.equal(scrubFailure.repositoryRepaired,true,'provider scrub corruption must publish a fresh repair checkpoint');assert.equal(assetReads-readsBeforeScrubHeal,1,'scrub healing must reread the damaged current attachment exactly once from canonical storage');
const resumedAfterRepair=await runtime.providers.scrubRepositoryProvider('repository-qa',{cursor:'',maxObjects:32,maxBytes:1024*1024*1024,skipObjectIds:[missingAttachment.id,scrubAttachment.id]});assert.equal(resumedAfterRepair.complete,true,'scrub must continue after repairing the damaged current attachment');assert.equal(resumedAfterRepair.quarantined.includes(scrubAttachment.id),false,'once same-day retention replaces the damaged checkpoint, its no-longer-retained object must age out of the scrub quarantine set');

// A canonical change during slow provider upload belongs to the next backup; it must
// not invalidate the checkpoint whose complete local snapshot was already sealed.
const raceFiles=new Map(),raceDeletes=[];const raceKey=(kind,id)=>kind+':'+id;const raceDescriptor=file=>freeze({kind:file.kind,id:file.id,name:file.name,size:file.blob.size,digest:file.digest,remoteId:'race-'+file.kind+'-'+file.id});
const raceTransport=freeze({
  list:async({kind})=>freeze({items:freeze([...raceFiles.values()].filter(file=>file.kind===kind).map(raceDescriptor)),overflow:false}),
  upload:async file=>{raceFiles.set(raceKey(file.kind,file.id),freeze({...file}));if(file.kind==='checkpoint'){snapshotRevision='provider-race-mutated';sourceRevision='2026-09-19T02:00:01.000Z';notes={N4:stableSecondaryNote,Subject:freeze({version:2,key:'Subject',text:'race note changed after seal',updatedAt:sourceRevision})};}return raceDescriptor(file);},
  download:async ref=>{const file=raceFiles.get(raceKey(ref.kind,ref.id));if(!file)throw new Error('missing race file');return freeze({blob:file.blob,release:async()=>{}});},
  delete:async ref=>{raceDeletes.push(ref.id);return raceFiles.delete(raceKey(ref.kind,ref.id));}
});
assert.equal(runtime.providers.register(freeze({id:'repository-race',label:'Repository Race',repository:raceTransport})),true);snapshotRevision='provider-race-start';sourceRevision='2026-09-19T02:00:00.000Z';notes={N4:stableSecondaryNote,Subject:freeze({version:2,key:'Subject',text:'race note',updatedAt:sourceRevision})};
const racePublication=await runtime.providers.backupRepositoryProvider('repository-race');assert.ok(racePublication.name,'provider upload must complete from the sealed snapshot even if canonical data changes during network I/O');assert.equal([...raceFiles.values()].filter(file=>file.kind==='checkpoint').length,1,'the sealed checkpoint manifest must remain committed');assert.equal([...raceFiles.values()].filter(file=>file.kind==='commit').length,1,'the sealed checkpoint commit marker must remain committed');assert.equal(raceDeletes.length,0,'a legitimate post-seal source mutation must not trigger publication cleanup');

// A durable pending provider-backup intent must not turn metadata-only Version History into a write operation.
// It remains queued until an actual backup opportunity (or the deferred scheduler) publishes the current state.
pendingProviderBackups.set('repository-qa',freeze({providerId:'repository-qa'}));sourceRevision='2026-09-19T02:10:00.000Z';snapshotRevision='provider-pending-retry';notes={N4:stableSecondaryNote,Subject:freeze({version:2,key:'Subject',text:'pending retry note',updatedAt:sourceRevision})};const checkpointsBeforePendingRetry=[...remoteFiles.values()].filter(file=>file.kind==='checkpoint').length;const uploadsBeforePendingRetry=remoteUploads.length;const retryHistory=await runtime.providers.history('repository-qa',{interactive:true});assert.equal(retryHistory.available,true);assert.equal(pendingProviderBackups.has('repository-qa'),true,'metadata-only history must preserve a queued provider retry intent');assert.equal([...remoteFiles.values()].filter(file=>file.kind==='checkpoint').length,checkpointsBeforePendingRetry,'opening Version History must not publish the queued current state');assert.equal(remoteUploads.length,uploadsBeforePendingRetry,'opening Version History must remain read-only');await runtime.providers.backupRepositoryProvider('repository-qa');assert.equal(pendingProviderBackups.has('repository-qa'),false,'a successful provider backup must clear its durable retry intent');assert.equal([...remoteFiles.values()].filter(file=>file.kind==='checkpoint').length,checkpointsBeforePendingRetry,'the queued same-day provider backup must replace the retained daily representative rather than increasing retained checkpoint count');assert.ok(remoteUploads.length>uploadsBeforePendingRetry,'queued provider retry must still cross the normal verified publication path');const uploadsAfterPendingRetry=remoteUploads.length;await runtime.providers.history('repository-qa',{interactive:true});assert.equal(remoteUploads.length,uploadsAfterPendingRetry,'a cleared retry intent must not publish duplicate backups on later history reads');


// Metadata-first Version History: listing retained versions must not download immutable bodies.
// Manifest/commit bytes are verified only when a version is selected for recovery (covered by repository-restore QA).
const historyCacheFiles=new Map();let historyCacheVersion=1;
for(const [key,file] of remoteFiles)historyCacheFiles.set(key,freeze({...file,remoteVersion:String(historyCacheVersion++)}));
let historyCacheDownloads=0,historyCacheScope='qa-history-scope-1';
const historyCacheDescriptor=file=>freeze({kind:file.kind,id:file.id,name:file.name,size:file.blob.size,createdAt:file.createdAt,modifiedAt:file.createdAt,digest:file.digest,remoteId:'cache-'+file.kind+'-'+file.id,remoteVersion:String(file.remoteVersion),verificationScope:historyCacheScope});
const historyCacheDownload=async ref=>{const file=historyCacheFiles.get(remoteKey(ref.kind,ref.id));if(!file)throw new Error('missing history-cache file');historyCacheDownloads+=1;return freeze({blob:file.blob,release:async()=>{}});};
const historyCacheList=async({kind})=>freeze({items:freeze([...historyCacheFiles.values()].filter(file=>file.kind===kind).map(historyCacheDescriptor)),overflow:false});
const historyCacheTransport=freeze({
  list:historyCacheList,
  upload:async()=>{throw new Error('history-cache QA transport is read-only');},
  download:historyCacheDownload,
  delete:async()=>{throw new Error('history-cache QA transport is read-only');},
  beginOperation:()=>freeze({list:historyCacheList,upload:async()=>{throw new Error('history-cache QA transport is read-only');},download:historyCacheDownload,delete:async()=>{throw new Error('history-cache QA transport is read-only');}})
});
assert.equal(runtime.providers.register(freeze({id:'repository-history-cache',label:'Repository History Cache QA',repository:historyCacheTransport})),true);
const coldHistory=await runtime.providers.history('repository-history-cache',{interactive:false}),coldHistoryDownloads=historyCacheDownloads,coldHistoryRemoteFiles=[...historyCacheFiles.values()].filter(file=>file.kind==='checkpoint'||file.kind==='commit').length;
assert.equal(coldHistory.available,true,'metadata-first history discovery must remain available');assert.ok(coldHistory.entries.length>0,'metadata-first history must still expose retained committed checkpoint identities');assert.equal(coldHistoryDownloads,0,'cold Version History must not download checkpoint or commit bodies');
const warmHistory=await runtime.providers.history('repository-history-cache',{interactive:false});
assert.deepEqual(warmHistory.entries,coldHistory.entries,'repeated metadata-first history discovery must remain stable');assert.equal(historyCacheDownloads,0,'warm Version History must remain metadata-only');const warmHistoryAdditionalDownloads=historyCacheDownloads-coldHistoryDownloads;
historyCacheScope='qa-history-scope-2';const scopeChangedHistory=await runtime.providers.history('repository-history-cache',{interactive:false});assert.deepEqual(scopeChangedHistory.entries,coldHistory.entries,'a provider-session scope change must not require body verification merely to list history');assert.equal(historyCacheDownloads,0,'verification-scope changes must not turn Version History into a body-read operation');
// Repository generation reset: a provider that now points at a fresh physical repository must not reuse
// Version History or durable maintenance intent from the deleted repository generation.
const generationFiles=new Map();for(const [key,file] of historyCacheFiles)generationFiles.set(key,file);let generationScope='qa-generation-old',generationMaintenanceClears=0;const generationMaintenance=new Map();
runtime.providers.configureRepositoryMaintenance(freeze({read:async id=>generationMaintenance.get(id)||null,mark:async(id,state)=>(generationMaintenance.set(id,state),true),clear:async id=>(generationMaintenanceClears+=generationMaintenance.delete(id)?1:0,true)}));
const generationDescriptor=file=>freeze({kind:file.kind,id:file.id,name:file.name,size:file.blob.size,createdAt:file.createdAt,modifiedAt:file.createdAt,digest:file.digest,remoteId:'generation-'+file.kind+'-'+file.id,remoteVersion:String(file.remoteVersion||file.createdAt),verificationScope:generationScope});
const generationList=async({kind})=>freeze({items:freeze([...generationFiles.values()].filter(file=>file.kind===kind).map(generationDescriptor)),overflow:false}),generationDownload=async ref=>{const file=generationFiles.get(remoteKey(ref.kind,ref.id));if(!file)throw new Error('missing generation file');return freeze({blob:file.blob,release:async()=>{}});};
const generationRepository=()=>freeze({list:generationList,upload:async()=>{throw new Error('generation QA transport is read-only');},download:generationDownload,delete:async()=>false,scope:async()=>generationScope});
const generationTransport=freeze({...generationRepository(),beginOperation:()=>generationRepository()});assert.equal(runtime.providers.register(freeze({id:'repository-generation',label:'Repository Generation QA',repository:generationTransport})),true);
const oldGenerationHistory=await runtime.providers.history('repository-generation',{interactive:false});assert.ok(oldGenerationHistory.entries.length>0,'Repository generation QA requires visible history in the original repository.');generationMaintenance.set('repository-generation',freeze({requestedAt:'2026-09-19T00:00:00.000Z',nextEligibleAt:'2026-09-19T00:00:00.000Z',reason:'gc-grace'}));generationScope='qa-generation-fresh';generationFiles.clear();const freshGenerationHistory=await runtime.providers.history('repository-generation',{interactive:false});assert.equal(freshGenerationHistory.available,true);assert.equal(freshGenerationHistory.entries.length,0,'A fresh repository generation must not inherit cached Version History from the deleted repository.');assert.equal(generationMaintenance.has('repository-generation'),false,'A fresh repository generation must discard maintenance intent belonging to the deleted repository.');assert.equal(generationMaintenanceClears,1,'Repository generation replacement must clear old durable maintenance state exactly once.');
generationMaintenance.set('repository-generation-cold',freeze({requestedAt:'2026-09-19T00:00:00.000Z',nextEligibleAt:'2026-09-19T00:00:00.000Z',reason:'gc-grace'}));const coldGenerationList=async()=>freeze({items:freeze([]),overflow:false}),coldGenerationRepository=()=>freeze({list:coldGenerationList,upload:async()=>{throw new Error('cold generation QA transport is read-only');},download:async()=>{throw new Error('cold generation QA transport has no objects');},delete:async()=>false,scope:async()=>'qa-generation-cold-fresh'});assert.equal(runtime.providers.register(freeze({id:'repository-generation-cold',label:'Repository Generation Cold QA',repository:freeze({...coldGenerationRepository(),beginOperation:()=>coldGenerationRepository()})})),true);const coldFreshHistory=await runtime.providers.history('repository-generation-cold',{interactive:false});assert.equal(coldFreshHistory.available,true);assert.equal(coldFreshHistory.entries.length,0);assert.equal(generationMaintenance.has('repository-generation-cold'),false,'A fresh empty repository must clear old persisted maintenance intent even when this runtime never observed the deleted repository generation.');assert.equal(generationMaintenanceClears,2,'Both an observed generation replacement and a cold fresh repository must retire their stale maintenance intent.');runtime.providers.configureRepositoryMaintenance(null);

const staleCheckpoint=[...historyCacheFiles.values()].find(file=>file.kind==='checkpoint');assert.ok(staleCheckpoint,'metadata-history QA requires a committed checkpoint');
const staleKey=remoteKey('checkpoint',staleCheckpoint.id),corruptCheckpointBlob=new Blob([new Uint8Array([0]),staleCheckpoint.blob.slice(1)]);historyCacheFiles.set(staleKey,freeze({...staleCheckpoint,blob:corruptCheckpointBlob,remoteVersion:String(Number(staleCheckpoint.remoteVersion)+10000)}));
const downloadsBeforeStale=historyCacheDownloads,staleHistory=await runtime.providers.history('repository-history-cache',{interactive:false});assert.equal(staleHistory.available,true,'body corruption is intentionally deferred until selected-version verification');assert.equal(historyCacheDownloads,downloadsBeforeStale,'Version History must not inspect changed immutable bodies; selected restore performs that verification');

const uncertainFiles=new Map();for(const [key,file] of remoteFiles)uncertainFiles.set(key,file);let uncertainDownloads=0;
const uncertainDescriptor=file=>freeze({kind:file.kind,id:file.id,name:file.name,size:file.blob.size,createdAt:file.createdAt,modifiedAt:file.createdAt,digest:file.digest,remoteId:'uncertain-'+file.kind+'-'+file.id,verificationScope:'qa-history-uncertain'});
const uncertainList=async({kind})=>freeze({items:freeze([...uncertainFiles.values()].filter(file=>file.kind===kind).map(uncertainDescriptor)),overflow:false}),uncertainDownload=async ref=>{const file=uncertainFiles.get(remoteKey(ref.kind,ref.id));if(!file)throw new Error('missing uncertain history file');uncertainDownloads+=1;return freeze({blob:file.blob,release:async()=>{}});};
const uncertainTransport=freeze({list:uncertainList,upload:async()=>{throw new Error('uncertain QA transport is read-only');},download:uncertainDownload,delete:async()=>false,beginOperation:()=>freeze({list:uncertainList,upload:async()=>{throw new Error('uncertain QA transport is read-only');},download:uncertainDownload,delete:async()=>false})});
assert.equal(runtime.providers.register(freeze({id:'repository-history-uncertain',label:'Repository History Uncertain QA',repository:uncertainTransport})),true);await runtime.providers.history('repository-history-uncertain',{interactive:false});const uncertainColdDownloads=uncertainDownloads;await runtime.providers.history('repository-history-uncertain',{interactive:false});assert.equal(uncertainDownloads,0,'missing remote-version provenance must still leave Version History metadata-only');

// Packing boundary: unusually large structured notes remain standalone so one edit never forces a large shard rewrite.
const hugeNoteText='x'.repeat(70*1024);sourceRevision='2026-09-19T02:20:00.000Z';snapshotRevision='pack-threshold';notes={N4:stableSecondaryNote,Subject:freeze({version:2,key:'Subject',text:'small packed note',updatedAt:sourceRevision}),Huge:freeze({version:2,key:'Huge',text:hugeNoteText,updatedAt:sourceRevision})};const thresholdPublication=await publishLocal(null),thresholdManifest=thresholdPublication.manifest,hugeStandalone=thresholdManifest.objects.find(entry=>entry.kind==='note'&&entry.key==='Huge');assert.ok(hugeStandalone,'a note above the small-object threshold must remain a standalone physical object');assert.equal(thresholdManifest.objects.some(entry=>entry.kind==='structuredPack'&&entry.members?.some(member=>member.kind==='note'&&member.key==='Huge')),false,'large notes must never be absorbed into a structured pack');

const parentPresentation=backupPresentation.begin('repository-qa','history',{label:'Repository QA',message:'Reading backups…'});
const borrowedHistory=await runtime.providers.history('repository-qa',{interactive:false,presentation:parentPresentation});
assert.equal(borrowedHistory.available,true);assert.equal(parentPresentation.read().lifecycle,'running','nested provider work must leave terminal ownership to recovery');
assert.equal(backupPresentation.read('repository-qa').operationId,parentPresentation.operationId,'nested history must use the parent event');
parentPresentation.finish({message:'Backups loaded.'});assert.equal(parentPresentation.read().lifecycle,'succeeded');

// The foreground operation publishes its progress and a terminal result to the presentation the app draws from.
const presentations=[],earlier=backupPresentation.read('repository-qa')?.operationId;let watched='repository-qa';const stopPresentations=backupPresentation.subscribe(()=>{const event=backupPresentation.read(watched);if(event&&event.operationId!==earlier)presentations.push({...event,active:event.lifecycle==='running'});});
assert.equal(await runtime.providers.backup('repository-qa'),true);
assert.ok(presentations.some(value=>value.active&&value.kind==='backup'));
assert.equal(presentations.at(-1).active,false);assert.equal(presentations.at(-1).lifecycle,'succeeded');assert.match(presentations.at(-1).message,/Backed up to Repository QA/);
assert.ok(presentations.every(value=>value.operationId===presentations[0].operationId),'one foreground run keeps one presentation identity');
const finishedOperation=presentations[0].operationId;
assert.equal(runtime.providers.register(freeze({id:'presentation-error',label:'Presentation Error',repository:repositoryTransport,authorize:async()=>{throw new Error('Authorization unavailable');}})),true);
watched='presentation-error';assert.equal(await runtime.providers.backup('presentation-error'),false);assert.equal(presentations.at(-1).lifecycle,'failed');assert.match(presentations.at(-1).message,/Authorization unavailable/);assert.notEqual(presentations.at(-1).operationId,finishedOperation);
assert.equal(runtime.providers.register(freeze({id:'presentation-cancel',label:'Presentation Cancel',repository:repositoryTransport,authorize:async()=>{throw Object.assign(new Error('Cancelled'),{name:'AbortError'});}})),true);
watched='presentation-cancel';assert.equal(await runtime.providers.backup('presentation-cancel'),false);assert.equal(presentations.at(-1).lifecycle,'cancelled');stopPresentations();

{
 const history=[],bad=[];
 for(let i=0;i<33;i++){
  notes={N4:stableSecondaryNote,Subject:freeze({version:2,key:'Subject',text:'capacity note '+i,updatedAt:'2026-09-19T00:00:00.000Z'})};snapshotRevision='capacity-'+i;sourceRevision='2026-09-19T00:00:00.000Z';
  const publication=await publishLocal(history),entry=publication.manifest.objects.find(row=>row.kind==='structuredPack'&&row.members?.some(member=>member.kind==='note'&&member.key==='Subject'));assert.ok(entry);history.push(publication.manifest);bad.push(entry);
 }
 assert.equal(new Set(bad.map(entry=>entry.objectId)).size,33);
 for(const entry of bad){localRepositoryObjects.set(entry.objectId,new Blob([new Uint8Array(entry.storedBytes)]));await assert.rejects(runtime.repository.verifyObject(localRepositoryObjects.get(entry.objectId),entry),{code:'REPOSITORY_INTEGRITY_CORRUPT'});}
 const excluded=bad.map(entry=>entry.objectId),rows=history.map(manifest=>freeze({id:manifest.checkpoint.checkpointId,manifest}));
 assert.equal(runtime.repository.projectHistory(rows,freeze({id:'device-folder',label:'Device Folder'}),{quarantinedObjectIds:excluded}).length,0,'every damaged dependency must be excluded from history');
 const available=new Set(history.flatMap(manifest=>manifest.objects).map(entry=>entry.objectId)),repair=await publishLocal(history,{excludedObjectIds:[...excluded,'invalid',excluded[0]],availableObjectIds:available});
 assert.equal(repair.manifest.objects.some(entry=>excluded.includes(entry.objectId)),false,'no explicitly excluded object may be reused');
 const replacement=repair.manifest.objects.find(entry=>entry.kind==='structuredPack'&&entry.members?.some(member=>member.kind==='note'&&member.key==='Subject'));assert.ok(repair.written.some(entry=>entry.objectId===replacement.objectId),'repair must publish a fresh immutable object');
 await runtime.repository.verifyObject(localRepositoryObjects.get(replacement.objectId),replacement);
 const skipped=await runtime.repository.scrub(history,entry=>{assert.equal(excluded.includes(entry.objectId),false);return localRepositoryObjects.get(entry.objectId);},{skipObjectIds:excluded,maxObjects:64,maxBytes:AUDIO_BYTES+1024*1024});assert.equal(skipped.complete,true);assert.equal(skipped.quarantined.length,33);
 let progress={cursor:'',recheckCursor:'',scanId:'',partial:null,quarantined:excluded},result;const attempted=[];
 for(let pass=0;pass<100;pass++){result=await runtime.repository.scrub(history,entry=>{if(excluded.includes(entry.objectId))attempted.push(entry.objectId);return localRepositoryObjects.get(entry.objectId);},{...progress,recheck:true,skipObjectIds:progress.quarantined,maxObjects:3,maxBytes:AUDIO_BYTES+1024*1024,onProgress:async value=>{progress=structuredClone(value);}});if(result.complete)break;}
 assert.equal(result.complete,true);assert.equal(result.status,'failed');assert.equal(result.quarantined.length,33);assert.equal(attempted.length,33);assert.equal(new Set(attempted).size,33,'every retained corrupt object must be attempted once across bounded rechecks');
 console.log(JSON.stringify({status:'PASS',suite:'repository-exclusion-capacity',confirmedDamagedObjects:33,allHistoryDependenciesHidden:true,explicitExclusionsRewritten:true,scrubRetainsAllQuarantine:true}));
}

{
 snapshotRevision='provider-exclusion-capacity';const publication=await runtime.providers.backupRepositoryProvider('repository-qa'),manifest=await runtime.repository.inspectManifest(remoteFiles.get(remoteKey('checkpoint',publication.checkpointId)).blob,{interactive:false}),bad=manifest.objects.find(entry=>entry.kind==='structuredPack'&&entry.members?.some(member=>member.kind==='note'&&member.key==='Subject'));
 assert.ok(bad);const stored=remoteFiles.get(remoteKey('object',bad.objectId));remoteFiles.set(remoteKey('object',bad.objectId),freeze({...stored,blob:new Blob([new Uint8Array(stored.blob.size)])}));await assert.rejects(runtime.repository.verifyObject(remoteFiles.get(remoteKey('object',bad.objectId)).blob,bad),{code:'REPOSITORY_INTEGRITY_CORRUPT'});
 const exclusions=[...Array.from({length:32},(_,i)=>'obj_'+i.toString(16).padStart(32,'0')),bad.objectId];
 runtime.providers.configureIntegrityScrub(freeze({readTarget:async()=>({}),writeResult:async()=>{},prepare:async()=>({}),isAvailable:()=>true,isUnsafe:()=>false,yieldTask:async()=>{},quarantine:async()=>exclusions}));
 try{
  await assert.rejects(runtime.providers.loadRepositoryProviderCandidate('repository-qa',{signal:new AbortController().signal},{checkpointId:publication.checkpointId}),/quarantined/u,'provider restore must honor the last quarantined ID');
  const repair=await runtime.providers.backupRepositoryProvider('repository-qa'),fresh=await runtime.repository.inspectManifest(remoteFiles.get(remoteKey('checkpoint',repair.checkpointId)).blob,{interactive:false});assert.equal(fresh.objects.some(entry=>entry.objectId===bad.objectId),false,'provider publication must preserve persisted exclusions beyond 32');
  const replacement=fresh.objects.find(entry=>entry.kind==='structuredPack'&&entry.members?.some(member=>member.kind==='note'&&member.key==='Subject'));await runtime.repository.verifyObject(remoteFiles.get(remoteKey('object',replacement.objectId)).blob,replacement);
 }finally{runtime.providers.configureIntegrityScrub(null);}
 console.log(JSON.stringify({status:'PASS',suite:'provider-exclusion-capacity',restoreRejectsLastQuarantinedObject:true,persistedExclusionPublishesFreshVerifiedObject:true}));
}
// Assembled contract: the real BackupModule composes provider scheduling with
// the real binary pipeline. Healthy transfers may exceed housekeeping budgets,
// blocked cleanup wakes independently, and foreground history stays successful.
{
 const realDate=globalThis.Date,clock=createFakeClock('2026-09-19T12:00:00.000Z');backgroundClock=clock;globalThis.Date=clock.Date;
 dailyRecords=[];notes={};assetDescriptor=null;snapshotRevision='background-composition';backgroundReady=false;
 const rows=new Map(),attempts=[],aborts=[],completed=[];let connected=true,listener,pending=true,heldUpload=false,releaseUpload=null;
 const key=row=>row.kind+'/'+row.id;
 function transport(signal=null){return freeze({
  scope:async()=>'coordination-scope',list:async({kind})=>({items:[...rows.values()].filter(row=>row.kind===kind),ignored:0,overflow:false}),
  download:async item=>({blob:rows.get(key(item)).blob,release:async()=>{}}),delete:async item=>{rows.delete(key(item));return true;},
  beginOperation:({signal})=>transport(signal),upload:async entry=>{
   if(signal?.aborted)throw signal.reason;
   if(entry.kind==='object'){
    attempts.push({id:entry.id,startedAt:clock.now()});
    await new Promise((resolve,reject)=>{
     let timer;const clean=()=>{clock.clearTimeout(timer);signal?.removeEventListener('abort',abort);},abort=()=>{clean();aborts.push(signal.reason);reject(signal.reason);};
     signal?.addEventListener('abort',abort,{once:true});
     if(heldUpload)releaseUpload=()=>{clean();resolve();};else timer=clock.setTimeout(()=>{clean();resolve();},45000);
    });
   }
   if(signal?.aborted)throw signal.reason;
   const receipt=freeze({...entry,serverDigest:entry.digest,remoteVersion:'1',verificationScope:'coordination-scope',createdAt:new Date().toISOString(),modifiedAt:new Date().toISOString()});rows.set(key(entry),receipt);completed.push(entry.kind);return receipt;
  }
 });}
 let cleanupIntent={repositoryScope:'coordination-scope',requestedAt:new Date().toISOString(),nextEligibleAt:new Date(clock.now()+1000).toISOString(),reason:'repository-state'},integrityTarget={completedAt:new Date().toISOString(),repositoryScope:'coordination-scope'},integrityWrites=0;
 runtime.providers.configureRepositoryMaintenance(freeze({read:async id=>id==='google-drive'?cleanupIntent:null,mark:async(_id,value)=>{cleanupIntent={...cleanupIntent,...value};return true;},clear:async()=>{cleanupIntent=null;return true;}}));
 runtime.providers.configureIntegrityScrub(freeze({readTarget:async()=>integrityTarget,writeResult:async(_id,result)=>{assert.equal(result.complete,true);integrityWrites++;integrityTarget={...integrityTarget,completedAt:new Date().toISOString()};},prepare:async()=>({maxObjects:4,maxBytes:1048576}),isAvailable:()=>true,isUnsafe:()=>false,yieldTask:async()=>{},quarantine:async()=>[]}));
 runtime.providers.configurePendingBackupRetry(freeze({read:async id=>id==='google-drive'&&pending?{requestedAt:new Date().toISOString()}:null,mark:async()=>{pending=true;return true;},clear:async()=>{pending=false;return true;}}));
 runtime.providers.register(freeze({id:'google-drive',label:'Google Drive',connected:()=>connected,backgroundAvailable:()=>connected,subscribeConnection:fn=>{listener=fn;},repository:transport()}));
 async function until(predicate){for(let turn=0;turn<2000&&!predicate();turn++){await clock.drainMicrotasks(80);await new Promise(resolve=>setImmediate(resolve));await realWorkSettled();}assert.ok(predicate(),'production I/O did not settle');}
 const row=name=>runtime.providers.backgroundStatus().find(row=>row.job==='google-drive '+name);
 try{
  assert.equal((await runtime.providers.history('google-drive',{interactive:false})).available,true,'live integrity hooks cannot make history completion reject');
  await clock.advance(3600000);assert.equal(attempts.length,0);assert.equal(row('convergence').state,'paused');assert.equal(clock.pending(),0,'locked/background jobs must not poll or prompt');
  backgroundReady=true;connected=false;listener();await clock.advance(1000);assert.equal(attempts.length,0);
  connected=true;listener();await clock.advance(1000);await until(()=>attempts.length>0);
  await clock.advance(30000);await clock.drainMicrotasks(120);assert.equal(aborts.length,0);assert.equal(row('convergence').busy,true);assert.equal(pending,true);
  await clock.advance(15000);await until(()=>!row('convergence').busy);assert.equal(pending,false);assert.equal(attempts.length,1,'a healthy finite upload must finish in its first attempt');assert.equal(completed.filter(kind=>kind==='commit').length,1);
  const manifest=[...rows.values()].find(row=>row.kind==='checkpoint'),parsed=await runtime.repository.inspectManifest(manifest.blob,{interactive:false});
  await runtime.repository.verifyCheckpoint(parsed,entry=>rows.get('object/'+entry.objectId).blob);
  // Integrity must start from the same narrow runtime composition, then save
  // its completed result; inspecting history must never be its wake-up owner.
  integrityTarget={repositoryScope:'coordination-scope',completedAt:'',recheck:true};assert.equal(runtime.providers.requestIntegrity('google-drive'),true);await clock.advance(1000);await until(()=>integrityWrites===1);assert.equal(row('integrity').lastOutcome,'completed');
  // Abort a later transfer through the actual foreground coordinator. Its
  // publication cannot commit; durable work and a future retry survive.
  snapshotRevision='background-preemption';notes={Subject:freeze({version:2,key:'Subject',text:'new background state',updatedAt:new Date().toISOString()})};pending=true;heldUpload=true;runtime.providers.wakeBackground('recovery');await clock.advance(1000);await until(()=>releaseUpload!==null);
  const commits=completed.filter(kind=>kind==='commit').length,history=runtime.providers.history('google-drive',{interactive:false});await until(()=>aborts.length===1);assert.equal((await history).available,true);await until(()=>!row('convergence').busy);
  assert.equal(completed.filter(kind=>kind==='commit').length,commits);assert.equal(pending,true);assert.equal(row('convergence').pending,true);assert.equal(row('convergence').scheduled,true);
  heldUpload=false;await clock.advance(15000);await until(()=>attempts.length===3);await clock.advance(45000);await until(()=>!pending);assert.equal(completed.filter(kind=>kind==='commit').length,commits+1);
  console.log(JSON.stringify({status:'PASS',suite:'assembled-provider-coordination',productionComposition:true,healthy45SecondUpload:true,liveIntegrityHooks:true,foregroundPreemption:true,verifiedCommit:true}));
 }finally{runtime.providers.configurePendingBackupRetry(null);runtime.providers.configureRepositoryMaintenance(null);runtime.providers.configureIntegrityScrub(null);globalThis.Date=realDate;backgroundClock=null;}
}
// Production Drive transport + production provider/classifier/retention +
// owned scheduler. Only HTTP, storage and the clock are simulated.
const assembledDriveCases=[],assembledDriveWallMs=[];
for(const scenario of ['checkpoint-unavailable','commit-unavailable','slow-inventory','foreground-preemption','slow-deletion-1000','slow-deletion-3000','slow-deletion-6000','slow-deletion-11000','slow-deletion-16000','slow-deletion-31000','slow-deletion-44000','slow-deletion-all-44000','foreground-deletion','foreground-deletion-44000','history-change-before-delete','lost-protection','remote-lease','abandoned-publication','live-publication','legacy-publication']){
 const realDate=globalThis.Date,clock=createFakeClock('2026-10-03T12:00:00.000Z');backgroundClock=clock;globalThis.Date=clock.Date;backgroundReady=true;dailyRecords=[];notes={};assetDescriptor=null;
 const scenarioStarted=performance.now(),maintenance=new Map(),progress=[],id='drive-'+scenario,h=createDriveHarness({clock,expiresIn:86400,registerProvider:config=>runtime.providers.register(freeze({...config,id,label:'Drive Background QA'}))});
 // Four slow deletions may require four protected passes plus a final inventory.
 // Bound simulated time by five passes of at most 120 request-sized intervals;
 // wall-clock QA remains subject to the guarded runner's existing file timeout.
 const stepMs=scenario.includes('deletion')?1000:100,settle=async(predicate,limitMs=scenario.endsWith('44000')?5*120*45000:scenario.includes('deletion')?3600000:180000)=>{for(let elapsed=0;elapsed<limitMs;elapsed+=stepMs){await clock.drainMicrotasks(220);await new Promise(resolve=>setImmediate(resolve));await realWorkSettled();await clock.drainMicrotasks(220);if(predicate())return;await clock.advance(stepMs);}assert.fail('assembled Drive execution did not settle: '+JSON.stringify({scenario,now:clock.now(),progress,intent:maintenance.get(id+'-cold'),status:runtime.providers.backgroundStatus().filter(row=>String(row.job).startsWith(id)),errors:diagnosticFailures.slice(-2),pages:h.state.objectPageStarts,activePages:h.state.activeObjectPages,requests:h.state.requests.slice(-3).map(row=>({method:row.method,url:new URL(row.url).pathname})),deletions:h.state.deletions.slice(-3)}));};
 try{
  await h.provider.prepare();await h.provider.authorize();snapshotRevision='drive-'+scenario;sourceRevision='2026-10-03T11:00:00.000Z';
  await runtime.providers.backupRepositoryProvider(id);
  const kind=file=>file.appProperties.studyDirectorRepositoryKind,committed=[...h.state.files.values()].filter(file=>['checkpoint','commit'].includes(kind(file))),originalPairs=committed.map(file=>file.id).sort();
  assert.equal(originalPairs.length,2);
  if(scenario==='remote-lease'){
   const operation=h.provider.repository.beginOperation(),marker=await operation.beginMaintenance();await clock.advance(61000);
   await assert.rejects(runtime.providers.backupRepositoryProvider(id),error=>error.code==='STUDY_DIRECTOR_REPOSITORY_MAINTENANCE_BUSY','a live network lease still blocks a competing writer past the old 60-second expiry');
   assert.ok(h.state.files.has(marker.remoteId),'a competing writer cannot retire the active lease using the legacy expiry');await operation.endMaintenance(marker);
  }
  for(let index=0;index<4;index++){const blob=new Blob(['abandoned '+index]);await h.provider.repository.upload({kind:'object',id:'obj_'+(0xface00+index).toString(16).padStart(32,'0'),blob,digest:await engine.run('checksum',{value:blob,algorithm:'sha256'})});}
  const allFiles=[...h.state.files.keys()].sort(),scope=await h.provider.repository.scope();
  const coldId=id+'-cold';runtime.providers.register(freeze({...h.provider,id:coldId,label:'Drive Cold Background QA'}));
  runtime.providers.configureRepositoryMaintenance(freeze({read:async providerId=>maintenance.get(providerId)||null,mark:async(providerId,value)=>{if(providerId===coldId&&value.reason==='bounded-continuation')progress.push(h.state.deletions.filter(remoteId=>allFiles.includes(remoteId)).length);maintenance.set(providerId,freeze({...maintenance.get(providerId),...value}));return true;},clear:async providerId=>{maintenance.delete(providerId);return true;}}));
  maintenance.set(coldId,freeze({repositoryScope:scope,requestedAt:new Date().toISOString(),nextEligibleAt:new Date(clock.now()+1000).toISOString(),reason:'repository-state'}));
  // Another device's upload marker: abandoned (renews, but unrenewed for 16
  // minutes), live (renews, just made) or from an older build (no renewal,
  // an hour old). Only the abandoned one may stop holding cleanup back early.
  let foreignMarker=null;
  if(scenario.endsWith('-publication')){
   const made=await h.provider.repository.beginPublication();foreignMarker=[...h.state.files.values()].find(file=>file.appProperties.studyDirectorRepositoryId===made.id);
   foreignMarker.appProperties.sdPublicationDevice='inst_qa_phone_mve00000_bbbbbbbb';
   if(scenario==='legacy-publication'){delete foreignMarker.appProperties.sdPublicationRenews;delete foreignMarker.appProperties.sdPublicationStartedAt;}
   foreignMarker.createdTime=new Date(clock.now()-(scenario==='abandoned-publication'?16*60000:scenario==='legacy-publication'?60*60000:0)).toISOString();
  }
  if(scenario.endsWith('unavailable'))h.state.failMediaKinds=new Set([scenario.startsWith('checkpoint')?'checkpoint':'commit']);
  else if(!scenario.includes('deletion')&&scenario!=='lost-protection'&&!foreignMarker){h.state.pageSize=1;h.state.pageDelayMs=10000;}
  await runtime.providers.history(coldId,{interactive:false});
  if(scenario.includes('deletion')){const delayMs=Number(scenario.split('-').at(-1))||6000;h.state.requestDelayMs=({url,method})=>(method==='GET'||scenario.includes('-all-'))&&url.searchParams.get('alt')!=='media'&&!String(url.searchParams.get('q')||'').includes("mimeType='application/vnd.google-apps.folder'")?delayMs:0;}
  let inventoryObserved=false,protectionLost=false,historyChanged=false;
  if(scenario==='history-change-before-delete')h.state.requestDelayMs=({url,method})=>{if(!historyChanged&&method==='POST'&&url.pathname==='/drive/v3/files'){const checkpoint=[...h.state.files.values()].find(file=>kind(file)==='checkpoint');if(checkpoint){historyChanged=true;checkpoint.version=h.state.nextVersion++;checkpoint.modifiedTime=new Date(clock.now()+1).toISOString();}}return 0;};
  if(scenario==='lost-protection')h.state.requestDelayMs=({url,method})=>{if(method==='GET'&&String(url.searchParams.get('q')||'').includes("value='object'"))inventoryObserved=true;const file=h.state.files.get(url.pathname.split('/').at(-1));if(inventoryObserved&&!protectionLost&&method==='GET'&&file&&kind(file)==='maintenance'){protectionLost=true;file.createdTime=new Date(clock.now()-300000).toISOString();}return 0;};
  if(scenario.endsWith('unavailable')){
   await settle(()=>maintenance.get(coldId)?.reason==='blocked-uncertain'&&!runtime.providers.backgroundStatus().find(row=>row.job===coldId+' maintenance').busy);
   assert.deepEqual([...h.state.files.keys()].sort(),allFiles,'temporary history failure cannot authorize any backup deletion');
   assert.equal(runtime.providers.backgroundStatus().find(row=>row.job===coldId+' maintenance').scheduled,true);
   h.state.failMediaKinds.clear();await clock.advance(Math.max(0,Date.parse(maintenance.get(coldId).nextEligibleAt)-clock.now()-100));
  }else if(scenario==='foreground-preemption'){
   await settle(()=>h.state.activeObjectPages>0);
   assert.equal([...h.state.files.values()].filter(file=>kind(file)==='maintenance').length,0,'read-only cleanup planning must not hold the destructive maintenance lease');
   const deletions=h.state.deletions.length;await runtime.providers.history(coldId,{interactive:false});
   await settle(()=>h.state.activeObjectPages===0&&maintenance.get(coldId)?.reason==='preempted');
   assert.equal(h.state.deletions.filter(remoteId=>allFiles.includes(remoteId)).length,0,'foreground preemption precedes all destructive work');
   assert.ok(h.state.deletions.length>=deletions);await clock.advance(Math.max(0,Date.parse(maintenance.get(coldId).nextEligibleAt)-clock.now()-100));
  }else if(scenario.startsWith('foreground-deletion')){
   await settle(()=>h.state.deletions.some(remoteId=>allFiles.includes(remoteId)));
   assert.ok([...h.state.files.values()].some(file=>kind(file)==='maintenance'),'destructive cleanup must hold the maintenance lease while deletion is in flight');
   const removedBefore=h.state.deletions.filter(remoteId=>allFiles.includes(remoteId)).length;let historySettled=false;const foreground=runtime.providers.history(coldId,{interactive:false}).finally(()=>{historySettled=true;});await settle(()=>historySettled);const outcome=await foreground;assert.equal(outcome.available,true,JSON.stringify({scenario,outcome,errors:diagnosticFailures.slice(-2)}));
   assert.equal(h.state.deletions.filter(remoteId=>allFiles.includes(remoteId)).length,removedBefore,'foreground prevents the next protected deletion');assert.ok(maintenance.has(coldId),'preemption retains intent');
  }else if(scenario==='history-change-before-delete'){
   await settle(()=>historyChanged&&maintenance.get(coldId)?.reason==='publication-contention'&&!runtime.providers.backgroundStatus().find(row=>row.job===coldId+' maintenance').busy);
   assert.equal(h.state.deletions.filter(remoteId=>allFiles.includes(remoteId)).length,0,'history that changes between planning and the destructive lease must invalidate the plan before any deletion');
   assert.equal([...h.state.files.values()].filter(file=>kind(file)==='maintenance').length,0,'an invalidated destructive unit must release its maintenance lease before retrying');
   h.state.requestDelayMs=null;await clock.advance(Math.max(0,Date.parse(maintenance.get(coldId).nextEligibleAt)-clock.now()-100));
  }else if(scenario==='live-publication'||scenario==='legacy-publication'){
   await settle(()=>maintenance.get(coldId)?.reason==='publication-contention'&&!runtime.providers.backgroundStatus().find(row=>row.job===coldId+' maintenance').busy);
   assert.equal(h.state.deletions.filter(remoteId=>allFiles.includes(remoteId)).length,0,`a live upload holds cleanup back (${scenario})`);
   assert.ok(h.state.files.has(foreignMarker.id),`cleanup leaves a live upload's marker in place (${scenario})`);
   const retryAt=Date.parse(maintenance.get(coldId).nextEligibleAt),expected=Date.parse(foreignMarker.createdTime)+(scenario==='live-publication'?15*60000:24*3600000);
   assert.ok(retryAt>=expected&&retryAt<=expected+5000,`cleanup retries when the marker could lapse, not sooner (${scenario}: ${new Date(retryAt).toISOString()})`);
   // This device's own upload ending must not pull cleanup forward while
   // another device's upload is still live (it used to retry every upload).
   if(scenario==='live-publication'){
    snapshotRevision='drive-live-publication-2';sourceRevision='2026-10-03T11:40:00.000Z';notes={Subject:freeze({version:2,key:'Subject',text:'own upload during a live one',updatedAt:sourceRevision})};
    await runtime.providers.backupRepositoryProvider(coldId).catch(()=>null);await settle(()=>!runtime.providers.backgroundStatus().find(row=>row.job===coldId+' maintenance').busy);
    assert.equal(Date.parse(maintenance.get(coldId)?.nextEligibleAt),retryAt,'cleanup keeps its retry time while another device\'s upload is live');
   }
   // The live marker is never renewed, so by then it was abandoned; the older build's upload finishes meanwhile.
   if(scenario==='legacy-publication')h.state.files.delete(foreignMarker.id);
   await clock.advance(Math.max(0,retryAt-clock.now()-100));
  }else if(scenario==='lost-protection'){
   await settle(()=>protectionLost&&maintenance.get(coldId)?.reason==='error'&&!runtime.providers.backgroundStatus().find(row=>row.job===coldId+' maintenance').busy);
   assert.equal(h.state.deletions.filter(remoteId=>allFiles.includes(remoteId)).length,0,'lost protection invalidates inventory before any data deletion');assert.ok(runtime.providers.backgroundStatus().find(row=>row.job===coldId+' maintenance').scheduled);
   h.state.requestDelayMs=null;await clock.advance(Math.max(0,Date.parse(maintenance.get(coldId).nextEligibleAt)-clock.now()-100));
  }
  await settle(()=>!maintenance.has(coldId));
  if(scenario.startsWith('slow-deletion')){assert.ok(progress.length<=4,'at most four unfinished passes for four eligible objects');progress.forEach((removed,index)=>assert.ok(removed>(index?progress[index-1]:0),'each short pass must retire new data, not merely retry its safety preparation'));}
  assert.deepEqual([...h.state.files.values()].filter(file=>['checkpoint','commit'].includes(kind(file))).map(file=>file.id).sort(),originalPairs);
  assert.equal([...h.state.files.values()].filter(file=>kind(file)==='maintenance').length,0);
  if(foreignMarker)assert.equal([...h.state.files.values()].filter(file=>kind(file)==='publication').length,0,`an abandoned upload marker is removed and cleanup completes (${scenario})`);
  const retained=JSON.parse(await committed.find(file=>kind(file)==='checkpoint').content.text()),physicalObjects=new Set([...h.state.files.values()].filter(file=>kind(file)==='object').map(file=>file.appProperties.studyDirectorRepositoryId));
  assert.deepEqual([...physicalObjects].sort(),retained.objects.map(entry=>entry.objectId).sort(),'verified completion retains exactly the referenced objects');
  if(!scenario.endsWith('unavailable')&&!scenario.includes('deletion')&&scenario!=='lost-protection'&&!foreignMarker)assert.ok(h.state.objectPageStarts>=5,'real paginated discovery exceeds the former total deadline');
  assembledDriveCases.push(scenario);assembledDriveWallMs.push({scenario,wallMs:Math.round(performance.now()-scenarioStarted)});
 }finally{runtime.providers.configureRepositoryMaintenance(null);await h.provider.disconnect();globalThis.Date=realDate;backgroundClock=null;}
}
// A long upload renews its Drive marker while it runs, so no cleanup takes it
// for abandoned. An upload whose marker cleanup removed (its page was frozen
// too long) must stop before its commit, so no version is committed on
// objects that cleanup may already have removed.
const heartbeatCases=[];
for(const scenario of ['renews-while-uploading','stops-when-marker-removed']){
 const realDate=globalThis.Date,clock=createFakeClock('2026-10-03T12:00:00.000Z');backgroundClock=clock;globalThis.Date=clock.Date;backgroundReady=true;dailyRecords=[];notes={};assetDescriptor=null;
 const id='drive-heartbeat-'+scenario,h=createDriveHarness({clock,expiresIn:86400,registerProvider:config=>runtime.providers.register(freeze({...config,id,label:'Drive Heartbeat QA'}))});
 const kind=file=>file.appProperties.studyDirectorRepositoryKind,markers=()=>[...h.state.files.values()].filter(file=>kind(file)==='publication'),commits=()=>[...h.state.files.values()].filter(file=>kind(file)==='commit').map(file=>file.appProperties.studyDirectorRepositoryId).sort();
 try{
  await h.provider.prepare();await h.provider.authorize();snapshotRevision=id+'-1';sourceRevision='2026-10-03T11:00:00.000Z';
  await runtime.providers.backupRepositoryProvider(id);const committedBefore=commits();
  snapshotRevision=id+'-2';sourceRevision='2026-10-03T11:30:00.000Z';notes={Subject:freeze({version:2,key:'Subject',text:'heartbeat '+scenario,updatedAt:sourceRevision})};
  // Every file upload and every listing takes 40 seconds (within Drive's
  // request timeout), so the upload runs for minutes; marker requests are
  // not delayed.
  const marker=query=>/publication|maintenance|google-apps\.folder/u.test(query);
  h.state.requestDelayMs=({url,method})=>url.pathname.startsWith('/upload/')||method==='GET'&&url.pathname==='/drive/v3/files'&&!marker(String(url.searchParams.get('q')||''))?40000:0;
  let outcome=null;const seen=new Set(),startedAt=clock.now();runtime.providers.backupRepositoryProvider(id).then(value=>{outcome={value};},error=>{outcome={error};});
  let removed=false;
  for(let elapsed=0;!outcome&&elapsed<60*60000;elapsed+=1000){
   await clock.drainMicrotasks(220);await new Promise(resolve=>setImmediate(resolve));await realWorkSettled();await clock.drainMicrotasks(220);
   for(const file of markers())seen.add(file.appProperties.studyDirectorRepositoryId);
   if(scenario==='stops-when-marker-removed'&&!removed&&seen.size&&elapsed>=60000){removed=true;for(const file of markers())h.state.files.delete(file.id);}
   if(!outcome)await clock.advance(1000);
  }
  assert.ok(outcome,`the upload settles (${scenario})`);h.state.requestDelayMs=null;
  if(scenario==='renews-while-uploading'){
   assert.ok(!outcome.error,String(outcome.error?.stack||''));assert.ok(outcome.value?.checkpointId,'a long upload completes');
   assert.ok(seen.size>=3,`a long upload renews its marker every two minutes (${seen.size} markers seen over ${(clock.now()-startedAt)/1000} s;)`);
   assert.ok(commits().includes(outcome.value.checkpointId),'its version is committed');
  }else{
   assert.ok(outcome.error,'an upload whose marker was removed fails');assert.deepEqual(commits(),committedBefore,'it commits nothing');
  }
  assert.equal(markers().length,0,`no upload marker is left behind (${scenario})`);
  heartbeatCases.push(scenario);
 }finally{await h.provider.disconnect();globalThis.Date=realDate;backgroundClock=null;}
}
assert.deepEqual(heartbeatCases,['renews-while-uploading','stops-when-marker-removed']);
// The actual adapter's uncertainty count must reach the actual integrity owner
// and host state projector, even when some usable history remains.
const incompleteInventoryCases=[],hostSource=fs.readFileSync('source/app.html','utf8');
for(const usableHistory of [false,true])for(const kind of ['checkpoint','commit'])for(const fault of ['renamed','undownloadable']){
 const realDate=globalThis.Date,clock=createFakeClock('2026-10-03T12:00:00.000Z');backgroundClock=clock;globalThis.Date=clock.Date;backgroundReady=true;dailyRecords=[];notes={};assetDescriptor=null;
 const id=`uncertain-${usableHistory}-${kind}-${fault}`,h=createDriveHarness({clock,registerProvider:config=>runtime.providers.register(freeze({...config,id,label:'Drive Integrity QA'}))});
 try{
  await h.provider.prepare();await h.provider.authorize();snapshotRevision=id;sourceRevision='2026-10-03T11:00:00.000Z';if(usableHistory)await runtime.providers.backupRepositoryProvider(id);
  const blob=new Blob(['unreadable marked entry']),checkpointId='cp_'+'f'.repeat(32),bad=await h.provider.repository.upload({kind,id:checkpointId,blob,digest:await engine.run('checksum',{value:blob,algorithm:'sha256'})});
  if(fault==='renamed')h.state.files.get(bad.remoteId).name='renamed.'+(kind==='commit'?'sdcommit':'sdcheckpoint');else h.state.files.get(bad.remoteId).canDownload=false;
  assert.equal((await h.provider.repository.list({kind})).ignored,1);
  const scope=await h.provider.repository.scope(),beforeFiles=[...h.state.files.keys()].sort(),completedAt='2026-10-01T00:00:00.000Z',cursor='obj_'+'d'.repeat(32),scanId='a'.repeat(64),quarantined=['obj_'+'c'.repeat(32)];
  let current={repositoryScope:scope,requestId:'inventory',history:[],quarantinedObjectIds:quarantined,failedAt:completedAt,completedAt,cycleStartedAt:completedAt,cursor,scanId,partial:null,recheck:false};const results=[];
  const host={Date:clock.Date,Error,Object,readRepositoryIntegrityTarget:async()=>current,repositoryIntegrityChanged:()=>new Error('scope changed'),mutateRepositoryIntegrityTarget:async(_target,change)=>{current=change(current);return current;}};
  vm.createContext(host);vm.runInContext(hostSource.slice(hostSource.indexOf('async function updateRepositoryIntegrityTarget('),hostSource.indexOf('const RepositoryIntegrityContinuation=')),host);
  runtime.providers.configureIntegrityScrub(freeze({readTarget:async()=>current,writeResult:async(providerId,result)=>{assert.equal(providerId,id);results.push(result);await host.updateRepositoryIntegrityTarget('drive',result);},prepare:async(_id,target)=>({repositoryScope:scope,requestId:target.requestId,cursor:target.cursor,scanId:target.scanId,skipObjectIds:target.quarantinedObjectIds}),isAvailable:providerId=>providerId===id,isUnsafe:()=>false,yieldTask:async()=>{},quarantine:async()=>current.quarantinedObjectIds}));
  assert.equal(runtime.providers.requestIntegrity(id),true,'integrity-result propagation test must explicitly schedule the integrity owner instead of depending on configuration wake timing');
  for(let elapsed=0;elapsed<120000;elapsed+=1000){
    await clock.drainMicrotasks(220);await new Promise(resolve=>setImmediate(resolve));await realWorkSettled();await clock.drainMicrotasks(220);
    if(results.length&&!runtime.providers.backgroundStatus().find(row=>row.job===id+' integrity').busy)break;
    await clock.advance(1000);
  }
  assert.equal(results.length,1,JSON.stringify({usableHistory,kind,fault,status:runtime.providers.backgroundStatus().find(row=>row.job===id+' integrity'),diagnostics:diagnosticFailures.slice(-2)}));
  const job=runtime.providers.backgroundStatus().find(row=>row.job===id+' integrity');
  if(usableHistory){
   assert.equal(results[0].status,'completed');assert.equal(results[0].complete,true);assert.ok(results[0].checked>0,'usable committed history must still be integrity-verified despite unrelated repository debris');
   assert.equal(current.lastOutcome,'completed');assert.equal(job.lastOutcome,'completed');
  }else{
   assert.equal(results[0].status,'unavailable');assert.notEqual(results[0].complete,true);assert.equal(results[0].corruption,false);
   assert.deepEqual([...current.quarantinedObjectIds],quarantined);assert.equal(current.cursor,cursor);assert.equal(current.scanId,scanId);assert.equal(current.completedAt,completedAt);assert.ok(current.failedAt);assert.equal(current.lastOutcome,'unavailable');
   assert.equal(job.lastOutcome,'unavailable');assert.equal(job.scheduled,true);assert.ok(Date.parse(job.nextEligibleAt)-clock.now()<=600000,'uncertainty uses availability retry, not the full-scan interval');
  }
  assert.deepEqual([...h.state.files.keys()].sort(),beforeFiles,'integrity verification cannot cause repair publication or deletion for unrelated repository debris');
  incompleteInventoryCases.push({usableHistory,kind,fault,status:results[0].status});
 }finally{runtime.providers.configureIntegrityScrub(null);await h.provider.disconnect();globalThis.Date=realDate;backgroundClock=null;}
}
// Finite backlogs cross both former limits (64 versions / 100 pages), then
// recover through the actual lifecycle, with exact retention and reachability.
const driveBacklogCases=[];
for(const {size,fault} of [{size:65,fault:''},{size:65,fault:'unavailable'},{size:300,fault:'preempted'}]){
 const realDate=globalThis.Date,clock=createFakeClock('2026-10-03T12:00:00.000Z');backgroundClock=clock;globalThis.Date=clock.Date;backgroundReady=false;dailyRecords=[];assetDescriptor=null;
 const id='drive-backlog-'+size+'-'+(fault||'healthy'),warmId=id+'-seed',maintenance=new Map(),h=createDriveHarness({clock,registerProvider:config=>runtime.providers.register(freeze({...config,id:warmId,label:'Drive Backlog Seed'}))});
 const kind=file=>file.appProperties.studyDirectorRepositoryKind;
 const settle=async predicate=>{for(let elapsed=0;elapsed<360000;elapsed+=100){await clock.drainMicrotasks(220);await new Promise(resolve=>setImmediate(resolve));if(predicate())return;await clock.advance(100);}assert.fail('Drive backlog did not settle: '+JSON.stringify({size,fault,intent:maintenance.get(id),active:h.state.activeHistoryReads,errors:diagnosticFailures.slice(-3),status:runtime.providers.backgroundStatus().filter(row=>row.job===id+' maintenance')}));};
 try{
  await h.provider.prepare();await h.provider.authorize();snapshotRevision=id;sourceRevision='2026-10-03T11:00:00.000Z';notes={Subject:freeze({version:2,key:'Subject',text:'backlog seed',updatedAt:sourceRevision})};
  await runtime.providers.backupRepositoryProvider(warmId);
  const seedFile=[...h.state.files.values()].find(file=>kind(file)==='checkpoint'),seed=JSON.parse(await seedFile.content.text());
  for(let index=1;index<size;index++){
   const checkpointId='cp_'+(50000+index).toString(16).padStart(32,'0'),date=new Date(clock.now()-Math.floor((size-index)/2)*86400000).toISOString().slice(0,10),exportedAt=date+`T${index%2?'10':'11'}:00:00.000Z`;
   const manifest={...seed,checkpoint:{...seed.checkpoint,checkpointId,createdAt:exportedAt},exportedAt,sourceRevision:exportedAt,protectedCheckpointManifest:{...seed.protectedCheckpointManifest,checkpointId,sourceRevision:exportedAt},retention:{...seed.retention,calendar:{...retentionCalendar(date),utcOffsetMinutes:0}}};
   const blob=new Blob([JSON.stringify(manifest)]);await h.provider.repository.upload({kind:'checkpoint',id:checkpointId,blob,digest:await engine.run('checksum',{value:blob}),exportedAt,historySummary:{logicalFingerprint:manifest.logicalFingerprint,counts:manifest.counts,retention:manifest.retention}});
   const marker=await runtime.repository.inspectCommit(new Blob([JSON.stringify({format:'study-director.backup-repository-commit',version:1,checkpointId,exportedAt,sourceRevision:exportedAt,manifestVersion:manifest.version})]));
   const commitBlob=new Blob([JSON.stringify(marker)]);await h.provider.repository.upload({kind:'commit',id:checkpointId,blob:commitBlob,digest:await engine.run('checksum',{value:commitBlob})});
  }
  runtime.providers.configureRepositoryMaintenance(freeze({read:async providerId=>maintenance.get(providerId)||null,mark:async(providerId,value)=>{maintenance.set(providerId,freeze({...maintenance.get(providerId),...value}));return true;},clear:async providerId=>{maintenance.delete(providerId);return true;}}));
  // Publication must also work while a legitimate backlog still exists.
  snapshotRevision=id+'-next';sourceRevision='2026-10-03T12:00:00.000Z';notes={Subject:freeze({version:2,key:'Subject',text:'new current state',updatedAt:sourceRevision})};
  await runtime.providers.backupRepositoryProvider(warmId);
  assert.equal([...h.state.files.values()].filter(file=>kind(file)==='checkpoint').length,size+1);
  assert.ok(maintenance.has(warmId));
  const abandoned=size>256?70:3;
  for(let index=0;index<abandoned;index++){const blob=new Blob(['abandoned backlog object '+index]);await h.provider.repository.upload({kind:'object',id:'obj_'+(0xc00000+index).toString(16).padStart(32,'0'),blob,digest:await engine.run('checksum',{value:blob})});}
  const rows=await Promise.all([...h.state.files.values()].filter(file=>kind(file)==='checkpoint').map(async file=>freeze({id:file.appProperties.studyDirectorRepositoryId,manifest:JSON.parse(await file.content.text()),remoteId:file.id})));
  const selection=runtime.repository.selectRetention(rows,{now:new Date(clock.now())}),expected=selection.retained,kept=new Set(expected.map(row=>row.id)),initialFiles=new Set(h.state.files.keys()),readStart=h.state.historyReadCompletions?.length||0;
  if(size>256)assert.equal(expected.filter(row=>selection.tiers[row.id]!=='hourly').length,15,'a fully populated backlog must settle to the ordinary 15 slots');
  // A cold owner starts without body caches; version-bound compact proofs
  // then own progress across uncertainty and foreground interruption.
  maintenance.set(id,maintenance.get(warmId));maintenance.delete(warmId);
  runtime.providers.register(freeze({...h.provider,id,label:'Drive Cold Backlog QA'}));h.state.pageSizes={checkpoint:1,commit:1};
  if(fault==='unavailable'){const file=[...h.state.files.values()].find(file=>kind(file)==='commit'&&!kept.has(file.appProperties.studyDirectorRepositoryId));h.state.failMediaIds=new Set([file.id]);}
  if(fault==='preempted')h.state.historyReadDelayMs=1000;
  operationEvents.length=0;backgroundReady=true;runtime.providers.wakeBackground('backlog-access-restored');
  let changedProofId='';
  if(fault==='unavailable'){
   await settle(()=>maintenance.get(id)?.reason==='blocked-uncertain'&&!runtime.providers.backgroundStatus().find(row=>row.job===id+' maintenance').busy);
   assert.equal(h.state.deletions.filter(remoteId=>initialFiles.has(remoteId)).length,0,'one unavailable history body blocks all backup-data deletion');
   h.state.failMediaIds.clear();await clock.advance(Math.max(0,Date.parse(maintenance.get(id).nextEligibleAt)-clock.now()-100));
  }else if(fault==='preempted'){
   await settle(()=>h.state.activeHistoryReads>0&&(h.state.historyReadCompletions||[]).slice(readStart).filter(remoteId=>kind(h.state.files.get(remoteId))==='checkpoint').length>=24);
   assert.equal((await runtime.providers.history(id,{interactive:false})).available,true);
   assert.equal(h.state.activeHistoryReads,0,'foreground history waits for actual reader settlement');
   assert.ok(maintenance.has(id),'foreground history preserves the backlog request even when its observation renews the reason');
   assert.ok(runtime.providers.backgroundStatus().find(row=>row.job===id+' maintenance').scheduled);
   assert.ok(operationEvents.some(row=>row.phase==='background-transition'&&row.reason==='preempted'),'execution diagnostics must preserve the actual preemption reason');
   assert.equal(h.state.deletions.filter(remoteId=>initialFiles.has(remoteId)).length,0,'foreground work settles the actual readers before deletion');
   const changed=[...new Set(h.state.historyReadCompletions.slice(readStart))].map(remoteId=>h.state.files.get(remoteId)).find(file=>kind(file)==='checkpoint'&&!kept.has(file.appProperties.studyDirectorRepositoryId));
   assert.ok(changed);changed.version++;changedProofId=changed.id;h.state.historyReadDelayMs=0;await clock.advance(Math.max(0,Date.parse(maintenance.get(id).nextEligibleAt)-clock.now()-100));
  }
  await settle(()=>!maintenance.has(id));
  const physicalCheckpoints=[...h.state.files.values()].filter(file=>kind(file)==='checkpoint'),physicalCommits=[...h.state.files.values()].filter(file=>kind(file)==='commit'),physicalObjects=[...h.state.files.values()].filter(file=>kind(file)==='object');
  assert.deepEqual(physicalCheckpoints.map(file=>file.appProperties.studyDirectorRepositoryId).sort(),[...kept].sort());assert.deepEqual(physicalCommits.map(file=>file.appProperties.studyDirectorRepositoryId).sort(),[...kept].sort());
  assert.deepEqual(physicalObjects.map(file=>file.appProperties.studyDirectorRepositoryId).sort(),[...new Set(expected.flatMap(row=>row.manifest.objects.map(entry=>entry.objectId)))].sort(),'completion preserves exactly the retained versions\' reachable objects');
  assert.equal([...h.state.files.values()].filter(file=>kind(file)==='maintenance').length,0);
  const completions=h.state.historyReadCompletions.slice(readStart);
  for(const row of rows.filter(row=>!kept.has(row.id))){const reads=completions.filter(remoteId=>remoteId===row.remoteId).length;assert.equal(reads,row.remoteId===changedProofId?2:1,'unchanged verified obsolete history resumes without redownloading; changed identity must reverify');}
  if(fault==='preempted')assert.ok(h.state.maxHistoryReads<=8,'actual history requests respect the shared concurrency ceiling');
  driveBacklogCases.push({size,fault,retained:kept.size,exactObjects:true,progressReused:true});
 }finally{backgroundReady=false;runtime.providers.configureRepositoryMaintenance(null);await h.provider.disconnect();globalThis.Date=realDate;backgroundClock=null;}
}

// A continuation owns one sealed capture. Attempt signals and worker lifetimes
// can change, but payload identity, encrypted bytes and live file leases cannot.
const publicationContinuationCases=[],assembledUploadContinuations=[];
async function publicationProtectionFixture(encrypted){
 let record=null;
 const protection=ExportsModule.createProtection({processing:{run:(...args)=>engine.run(...args),job:operation=>operation(),check:noop},storage:{read:async()=>record,write:async(_key,value)=>{record=value;},remove:async()=>{record=null;}},interactions:{input:async()=>({value:'publication continuation password'}),choose:async()=> 'unlock',confirm:async()=>true},settingKey:'publication-protection'});
 if(encrypted)await protection.manage();return {protection,changePolicy:()=>{record=null;}};
}
async function retainedPublicationFixture(phase,encrypted,{history=null,availableObjectIds=null,retain=true,retention=null}={}){
 const setup=await publicationProtectionFixture(encrypted);publicationProtection=setup.protection;
 runtime.controller.invalidateRepositoryPreparation();dailyRecords=[];notes={Subject:freeze({version:2,key:'Subject',text:'sealed note',updatedAt:'2026-10-04T00:00:00.000Z'})};assetDescriptor=null;snapshotRevision='continuation-'+phase+'-'+encrypted;sourceRevision='2026-10-04T00:00:00.000Z';
 const continuation=runtime.repository.createPublication(),first=new AbortController(),stored=new Map(),manifests=[],markers=[];let failure=null,interrupted=false,activeSignal=first.signal;
 const fail=step=>{if(step===phase&&!interrupted){interrupted=true;first.abort(Object.assign(new Error('authorization interrupted'),{name:'AbortError',code:'REPOSITORY_BACKGROUND_PREEMPTED'}));throw first.signal.reason;}};
 const transport=freeze({
  writeObject:async entry=>{await entry.checkProtection();if(stored.has(entry.objectId))assert.equal(entry.blob,stored.get(entry.objectId),'resumption preserves the exact stored/encrypted payload');else stored.set(entry.objectId,entry.blob);fail('object');return {id:entry.objectId};},
  writeManifest:async file=>{await file.checkProtection();manifests.push(file.blob);fail('manifest');return {id:file.manifest.checkpoint.checkpointId};},
  commit:async marker=>{await marker.checkProtection();markers.push(marker.blob);fail('commit');return {id:marker.checkpointId};},
  retainOnFailure:()=>retain,onFailure:async(_error,context)=>{failure=context;}
 });
 const run=(extra={})=>runtime.repository.publish(history,{interactive:false,signal:activeSignal,continuation,availableObjectIds,retention,...extra},transport);
 await assert.rejects(run(),{name:'AbortError'});assert.equal(failure.retained,retain);assert.equal(continuation.status().busy,false);assert.equal(continuation.status().pending,retain);
 const payloads=failure.prepared.objects.filter(entry=>!entry.reused).map(entry=>entry.blob);if(manifests.length)payloads.push(manifests[0]);
 if(encrypted)for(const blob of payloads)assert.equal(releasedFiles.includes(blob),!retain,'protected files live exactly as long as their retained publication');
 return {continuation,stored,manifests,markers,payloads,prepared:failure.prepared,changePolicy:setup.changePolicy,run:(extra={})=>{activeSignal=new AbortController().signal;return run(extra);}};
}
const beforeContinuation={notes,dailyRecords,assetDescriptor,audioBlob,snapshotRevision,sourceRevision,backgroundReady};
try{
 for(const encrypted of [false,true])for(const phase of ['object','manifest','commit']){
  const f=await retainedPublicationFixture(phase,encrypted),id=f.prepared.checkpoint.checkpointId;
  notes={Subject:freeze({version:2,key:'Subject',text:'newer local edit',updatedAt:'2026-10-04T00:01:00.000Z'})};snapshotRevision+='-edited';sourceRevision='2026-10-04T00:01:00.000Z';
  const result=await f.run();assert.equal(result.checkpointId,id);assert.equal(result.sourceRevision,'2026-10-04T00:00:00.000Z');assert.equal(notes.Subject.text,'newer local edit','continuing a sealed backup must not replace newer local data');
  if(f.manifests.length>1)assert.equal(f.manifests[0],f.manifests[1],'an interrupted manifest is neither regenerated nor re-encrypted');
  if(f.markers.length>1)assert.equal(f.markers[0],f.markers[1]);
  assert.equal(f.continuation.status().pending,false);if(encrypted)for(const blob of f.payloads)assert.equal(releasedFiles.filter(value=>value===blob).length,1,'verified completion releases every retained file exactly once');
  await f.continuation.release();publicationContinuationCases.push({encrypted,phase,sealedBytesPreserved:true,leasesReleased:true});
 }
 for(const boundary of ['policy-change','explicit-retirement','canonical-invalidation','declined-retention']){
  const f=await retainedPublicationFixture('object',true,{retain:boundary!=='declined-retention'}),writes=f.stored.size;
  if(boundary==='policy-change'){f.changePolicy();await assert.rejects(()=>f.run(),error=>error.code==='BACKUP_POLICY_CHANGED');}
  else if(boundary==='declined-retention')assert.equal(f.continuation.status().pending,false);
  else{if(boundary==='canonical-invalidation')runtime.controller.invalidateRepositoryPreparation();await f.continuation.release();await assert.rejects(()=>f.run(),/continuation is unavailable/u);}
  assert.equal(f.stored.size,writes);await f.continuation.release();for(const blob of f.payloads)assert.equal(releasedFiles.filter(value=>value===blob).length,1);publicationContinuationCases.push(boundary);
 }
 const base=await retainedPublicationFixture('manifest',false),baseline=await base.run();await base.continuation.release();
 // The same content again as an ordinary version adds nothing: no transport
 // write, the existing version reported as current, its change time covered.
 {
  const unexpectedWrite=()=>{throw new Error('an unchanged backup writes nothing');};let covered=null;
  const duplicateResult=await runtime.repository.publish([baseline.manifest],{interactive:false,availableObjectIds:new Set(baseline.manifest.objects.map(entry=>entry.objectId))},freeze({writeObject:unexpectedWrite,writeManifest:unexpectedWrite,commit:unexpectedWrite,onCommitted:async context=>{covered=context;}}));
  assert.equal(duplicateResult.unchanged,true);assert.equal(duplicateResult.checkpointId,baseline.checkpointId);assert.equal(duplicateResult.objectsWritten,0);
  assert.equal(covered.unchanged,true);assert.equal(covered.sourceRevision,sourceRevision,'the current change time is recorded as backed up');publicationContinuationCases.push('unchanged-content-skipped');
 }
 // A protected safety version is always written, so resuming one whose reused
 // object disappeared must still fail closed.
 const reused=await retainedPublicationFixture('manifest',false,{history:[baseline.manifest],availableObjectIds:new Set(baseline.manifest.objects.map(entry=>entry.objectId)),retention:{role:'before-restore'}});assert.ok(reused.prepared.objects.every(entry=>entry.reused));
 await assert.rejects(()=>reused.run({availableObjectIds:new Set()}),error=>error.code==='BACKUP_REPOSITORY_BASE_CHANGED');assert.equal(reused.manifests.length,1,'a lost reuse dependency cannot authorize another manifest publication');assert.equal(reused.continuation.status().pending,false);await reused.continuation.release();publicationContinuationCases.push('missing-reused-object');
 for(const changed of [false,true]){
  const safety=await retainedPublicationFixture('object',true,{retention:{role:'before-restore'}});assert.equal(safety.continuation.status().role,'before-restore');
  if(changed){snapshotRevision+='-changed';sourceRevision='2026-10-04T00:02:00.000Z';await assert.rejects(()=>safety.run(),error=>error.code==='BACKUP_SOURCE_FENCE_CHANGED');assert.equal(safety.continuation.status().pending,false);}
  else{const result=await safety.run();assert.equal(result.checkpointId,safety.prepared.checkpoint.checkpointId);assert.equal(result.manifest.retention.role,'before-restore');}
  await safety.continuation.release();publicationContinuationCases.push(changed?'safety-copy-current-source-fence':'unchanged-safety-copy-resumes');
 }
}finally{publicationProtection=null;notes=beforeContinuation.notes;dailyRecords=beforeContinuation.dailyRecords;assetDescriptor=beforeContinuation.assetDescriptor;audioBlob=beforeContinuation.audioBlob;snapshotRevision=beforeContinuation.snapshotRevision;sourceRevision=beforeContinuation.sourceRevision;backgroundReady=beforeContinuation.backgroundReady;}

// Real canonical capture -> binary/encrypted checkpoint -> provider recovery
// owner -> real Drive adapter. Only storage, HTTP and time are controlled.
for(const encrypted of [false,true]){
 const original={Date:globalThis.Date,notes,dailyRecords,assetDescriptor,audioBlob,snapshotRevision,sourceRevision,backgroundReady},clock=createFakeClock('2026-10-04T12:00:00.000Z');backgroundClock=clock;globalThis.Date=clock.Date;backgroundReady=true;
 const id='drive-upload-'+(encrypted?'encrypted':'plain'),setup=await publicationProtectionFixture(encrypted);publicationProtection=setup.protection;
 audioBlob=new Blob([new Uint8Array(6*1048576)],{type:'audio/mpeg'});dailyRecords=[];notes={Subject:freeze({version:2,key:'Subject',text:'before reconnect',updatedAt:new Date().toISOString()})};snapshotRevision=id;sourceRevision=new Date().toISOString();
 assetDescriptor=freeze({id:'asset-audio',type:'audio/mpeg',size:audioBlob.size,hash:await engine.run('checksum',{value:audioBlob}),name:'slow-upload.mp3',library:true});
 let durable=null;
 const pendingStore=registry.require('backup-recovery-host',1).createPendingStore(freeze({sourceRevision:()=>sourceRevision,diagnostics:freeze({capture:noop}),storage:freeze({read:async()=>durable,write:async value=>{durable=value;},remove:async()=>{durable=null;}})}));
 runtime.providers.configurePendingBackupRetry(freeze(pendingStore));await pendingStore.mark(id);
 const h=createDriveHarness({clock,registerProvider:config=>runtime.providers.register(freeze({...config,id,label:'Google Drive'}))});await h.provider.prepare();
 h.state.uploadProgressSteps=14;h.state.uploadProgressStepMs=body=>Math.max(1,Math.ceil(body.size/(2*1048576)*90000));
 const row=()=>runtime.providers.backgroundStatus().find(value=>value.job===id+' convergence');
 const pump=async(predicate)=>{let elapsed=0;for(const deadline=performance.now()+30000;!predicate()&&performance.now()<deadline;){
  await new Promise(resolve=>setImmediate(resolve));if(predicate())break;
  // Awaiting simulated upload progress: let background work finish, then move
  // straight to the next due timer (at least 1 s) instead of 1 s at a time.
  if(h.state.awaitingUploadProgress&&!h.state.nativeUploadReplies){await realWorkSettled();const next=clock.nextAt(),delay=Math.max(1000,next===null?1000:next-clock.now());await clock.advance(delay);elapsed+=delay;}
  else if(!row().busy&&row().scheduled&&h.provider.connected()){const delay=Math.max(1,Date.parse(row().nextEligibleAt)-clock.now());await clock.advance(delay);elapsed+=delay;}
  else await new Promise(resolve=>setTimeout(resolve,1));
  assert.ok(elapsed<12*3600000,'finite unchanged payloads must converge across bounded authorization windows');
 }assert.ok(predicate(),'assembled upload lifecycle must reach its expected state');};
 try{
  await h.provider.authorize();await pump(()=>row().busy&&[...h.state.uploads.values()].some(value=>value.received===2*1048576));
  const aborts=h.state.uploadAborts||0;
  if(!encrypted){
   let history;const foreground=runtime.providers.history(id,{interactive:false}).then(value=>{history=value;});await pump(()=>!!history);await foreground;assert.equal(history.available,true);
  }else{
   publicationProtection.lock();backgroundReady=false;runtime.providers.wakeBackground('ownership');await pump(()=>!row().busy);assert.equal(row().blocker,'locked');assert.ok(await pendingStore.read(id));
   await publicationProtection.manage();backgroundReady=true;runtime.providers.wakeBackground('encryption-unlocked');
  }
  assert.ok(h.state.uploadAborts>aborts,'foreground activity or loss of authority must stop the actual transfer');
  await pump(()=>!h.provider.connected()&&!row().busy);
  assert.equal(h.state.uploads.size,1);const session=[...h.state.uploads.values()][0],prefix=session.received;assert.equal(prefix,4*1048576);assert.ok(await pendingStore.read(id));assert.equal(exclusive.status().busy,false,'retained file leases must not keep the global file job busy');
  const firstObjectId=session.metadata.appProperties.studyDirectorRepositoryId,firstRequests=h.state.requests.length;
  // A newer recovery request must survive completion of the older sealed one.
  notes={Subject:freeze({version:2,key:'Subject',text:'after reconnect',updatedAt:sourceRevision})};snapshotRevision+='-newer';await pendingStore.mark(id);
  await h.provider.authorize();await pump(()=>!row().busy&&!durable);
  const starts=h.state.requests.slice(firstRequests).filter(value=>/^bytes \d+-/u.test(value.contentRange));assert.ok(starts.length);assert.ok(starts.every(value=>Number(value.contentRange.match(/^bytes (\d+)-/u)[1])>=prefix),'the assembled owner must preserve the acknowledged prefix');
  assert.equal(h.state.uploads.size,1,'the same prepared attachment identity must survive reauthorization and later local edits');assert.equal(session.received,[...h.state.files.values()].find(value=>value.appProperties.studyDirectorRepositoryId===firstObjectId).content.size);
  assert.equal(exclusive.status().busy,false);assert.equal(notes.Subject.text,'after reconnect');
  const commits=await h.provider.repository.list({kind:'commit'}),checkpoints=await h.provider.repository.list({kind:'checkpoint'});assert.equal(commits.items.length,2);assert.equal(checkpoints.items.length,2,'the earlier version of the day changed notes in an earlier hour, so it stays as Hourly');
  const newestItem=[...checkpoints.items].sort((a,b)=>Date.parse(b.history?.exportedAt||b.createdAt)-Date.parse(a.history?.exportedAt||a.createdAt))[0],opened=await h.provider.repository.download(newestItem);let manifest;try{manifest=await runtime.repository.inspectManifest(opened.blob,{interactive:false});}finally{await opened.release();}
  assert.equal(manifest.sourceRevision,sourceRevision);assert.equal(manifest.encrypted,encrypted);assert.equal(manifest.objects.find(value=>value.kind==='attachment').objectId,firstObjectId);
  const noteEntry=manifest.objects.find(value=>value.kind==='structuredPack'&&value.members.some(member=>member.kind==='note'&&member.key==='Subject'));
  const objectList=await h.provider.repository.list({kind:'object'}),storedNote=await h.provider.repository.download(objectList.items.find(value=>value.id===noteEntry.objectId));let decoded;
  try{
   await runtime.repository.verifyObject(storedNote.blob,noteEntry);decoded=await publicationProtection.unprotect(storedNote.blob,{interactive:false});
   const stream=noteEntry.compression==='gzip'?decoded.blob.stream().pipeThrough(new DecompressionStream('gzip')):decoded.blob.stream(),body=JSON.parse(await new Response(stream).text());
   assert.equal(body.members.find(value=>value.kind==='note'&&value.key==='Subject').payload.text,'after reconnect','equal source timestamps cannot let an older publication settle a newer request');
  }finally{if(decoded&&decoded.blob!==storedNote.blob)await exportsPort.run('file.release',{file:decoded.blob});await storedNote.release();}
  assert.ok(operationEvents.some(value=>value.phase==='provider-publication-retained'&&value.provider===id));assert.ok(operationEvents.some(value=>value.phase==='provider-publication-resumed'&&value.provider===id));
  assembledUploadContinuations.push({encrypted,authorizationWindows:2,serverPrefixRetained:true,sealedAttachmentIdentity:true,newerRequestCompleted:true,foregroundFileJobReleased:true});
 }finally{runtime.providers.configurePendingBackupRetry(null);await h.provider.disconnect();publicationProtection=null;globalThis.Date=original.Date;backgroundClock=null;notes=original.notes;dailyRecords=original.dailyRecords;assetDescriptor=original.assetDescriptor;audioBlob=original.audioBlob;snapshotRevision=original.snapshotRevision;sourceRevision=original.sourceRevision;backgroundReady=original.backgroundReady;}
}

{
 const original={Date:globalThis.Date,notes,dailyRecords,assetDescriptor,audioBlob,snapshotRevision,sourceRevision,backgroundReady},clock=createFakeClock('2026-10-04T12:00:00.000Z');backgroundClock=clock;globalThis.Date=clock.Date;backgroundReady=true;
 const setup=await publicationProtectionFixture(true);publicationProtection=setup.protection;audioBlob=new Blob([new Uint8Array(6*1048576)],{type:'audio/mpeg'});dailyRecords=[];notes={};snapshotRevision='safety-upload';sourceRevision=new Date().toISOString();
 assetDescriptor=freeze({id:'asset-audio',type:'audio/mpeg',size:audioBlob.size,hash:await engine.run('checksum',{value:audioBlob}),name:'safety.mp3',library:true});
 let durable=null;const id='drive-safety-upload',pendingStore=registry.require('backup-recovery-host',1).createPendingStore(freeze({sourceRevision:()=>sourceRevision,diagnostics:freeze({capture:noop}),storage:freeze({read:async()=>durable,write:async value=>{durable=value;},remove:async()=>{durable=null;}})}));runtime.providers.configurePendingBackupRetry(freeze(pendingStore));
 const h=createDriveHarness({clock,registerProvider:config=>runtime.providers.register(freeze({...config,id,label:'Google Drive'}))});await h.provider.prepare();h.state.uploadProgressSteps=14;h.state.uploadProgressStepMs=body=>Math.max(1,Math.ceil(body.size/(2*1048576)*90000));
 const row=()=>runtime.providers.backgroundStatus().find(value=>value.job===id+' convergence');
 const run=async()=>{const held=runtime.providers.suspendBackground('safety-copy');await held.settled;try{return await exclusive.job(()=>runtime.providers.backupRepositoryProvider(id,{interactive:false,signal:new AbortController().signal,retention:{role:'before-restore'}}),{wait:true});}finally{held.release();}};
 const settle=async task=>{let result;task.then(value=>{result={value};},error=>{result={error};});for(const deadline=performance.now()+30000;!result&&performance.now()<deadline;){await new Promise(resolve=>setTimeout(resolve,1));if(h.state.awaitingUploadProgress&&!h.state.nativeUploadReplies)await clock.advance(1000);}assert.ok(result,JSON.stringify({clock:clock.now(),awaiting:h.state.awaitingUploadProgress,native:h.state.nativeUploadReplies,row:row(),files:exclusive.status(),active:runtime.providers.backgroundStatus().filter(value=>value.busy),phases:operationEvents.slice(-5)}));return result;};
 try{
  await h.provider.authorize();const first=await settle(run());assert.match(first.error?.message||'',/authorization/u);assert.equal(exclusive.status().busy,false);assert.equal(h.state.uploads.size,1);assert.equal(durable,null,'a foreground safety operation must not turn into an automatic ordinary backup');
  await h.provider.authorize();assert.equal(row().blocker,'awaiting-foreground');const prefix=[...h.state.uploads.values()][0].received;assert.ok(prefix>=6*1048576);
  const resumed=await settle(run());assert.ok(resumed.value,resumed.error?.stack);assert.equal(resumed.value.manifest.retention.role,'before-restore');assert.equal(h.state.uploads.size,1,'same-source safety retries retain the protected attachment and its identity');assert.equal(durable,null);assert.equal(exclusive.status().busy,false);
  assembledUploadContinuations.push({encrypted:true,beforeRestore:true,authorizationWindows:2,foregroundOnly:true,sealedAttachmentIdentity:true});
 }finally{runtime.providers.configurePendingBackupRetry(null);await h.provider.disconnect();publicationProtection=null;globalThis.Date=original.Date;backgroundClock=null;notes=original.notes;dailyRecords=original.dailyRecords;assetDescriptor=original.assetDescriptor;audioBlob=original.audioBlob;snapshotRevision=original.snapshotRevision;sourceRevision=original.sourceRevision;backgroundReady=original.backgroundReady;}
}
// Pass F: the shared manifest/commit byte-verification lease must reject a
// same-size corrupt read and release its temporary file on *both* paths.
const providerMetadataVerificationCases=[];
{
 const original={notes,dailyRecords,assetDescriptor,snapshotRevision,sourceRevision};
 try{
  dailyRecords=[];assetDescriptor=null;notes={N4:stableSecondaryNote};
  for(const kind of ['checkpoint','commit']){
   const files=new Map(),key=value=>value.kind+':'+value.id;let downloaded=0,released=0;
   const describe=file=>freeze({kind:file.kind,id:file.id,name:file.name,size:file.blob.size,digest:file.digest,createdAt:file.createdAt,modifiedAt:file.createdAt,remoteId:'f-metadata-'+file.id});
   const transport=freeze({
    list:async({kind:listedKind})=>freeze({items:freeze([...files.values()].filter(file=>file.kind===listedKind).map(describe)),ignored:0,overflow:false}),
    upload:async entry=>{const stored=freeze({...entry,createdAt:new Date().toISOString()});files.set(key(entry),stored);return describe(stored);},
    download:async ref=>{const file=files.get(key(ref));if(!file)throw new Error('Missing Pass F verification fixture');downloaded++;
     const source=file.blob,blob=ref.kind===kind?new Blob([source.slice(0,source.size-1),new Uint8Array([37])]):source;
     return freeze({blob,release:async()=>{released++;}});},
    delete:async ref=>files.delete(key(ref))
   });
   const id='f-verify-'+kind;assert.equal(runtime.providers.register(freeze({id,label:'Metadata Verification QA',repository:transport})),true);
   snapshotRevision='f-verify-'+kind;sourceRevision=kind==='checkpoint'?'2026-10-31T11:01:00.000Z':'2026-10-31T11:02:00.000Z';
   await assert.rejects(()=>runtime.providers.backupRepositoryProvider(id,{interactive:false}),new RegExp('Remote repository '+kind+' failed content-integrity verification','u'),'corrupt '+kind+' bytes must never receive a verified upload receipt');
   assert.ok(downloaded>0);assert.equal(released,downloaded,'all temporary downloads must be released when '+kind+' verification fails');
   if(kind==='checkpoint')assert.equal([...files.values()].filter(row=>row.kind==='commit').length,0,'a failed manifest proof must not upload a commit');
   providerMetadataVerificationCases.push(kind);
  }
 }finally{notes=original.notes;dailyRecords=original.dailyRecords;assetDescriptor=original.assetDescriptor;snapshotRevision=original.snapshotRevision;sourceRevision=original.sourceRevision;}
}
// The manifest uploads alongside the new objects, and the commit waits for
// both; a failed object upload still fails the publication only after the
// manifest upload has settled (Entry 023).
{
  const original={notes,dailyRecords,assetDescriptor,snapshotRevision,sourceRevision};
  const fresh=label=>{runtime.controller.invalidateRepositoryPreparation();dailyRecords=[];notes={Subject:freeze({version:2,key:'Subject',text:'parallel '+label,updatedAt:'2026-10-05T00:00:00.000Z'})};assetDescriptor=null;snapshotRevision='parallel-'+label;sourceRevision='2026-10-05T00:00:00.000Z';};
  try{
    for(const failObject of [false,true]){
      fresh(failObject?'failure':'success');
      const events=[];let releaseObjects,manifestSettled=false;const objectsHeld=new Promise(resolve=>{releaseObjects=resolve;setTimeout(resolve,2000);});
      const transport=freeze({
        writeObject:async entry=>{events.push('object-start');await objectsHeld;events.push('object-end');if(failObject)throw new Error('QA object upload failure');return freeze({id:entry.objectId});},
        writeManifest:async file=>{events.push('manifest');releaseObjects();await new Promise(resolve=>setTimeout(resolve,20));manifestSettled=true;events.push('manifest-end');return freeze({name:file.manifest.checkpoint.checkpointId+'.sdcheckpoint'});},
        commit:async marker=>{events.push('commit');return freeze({name:marker.checkpointId+'.sdcommit'});},
        onCommitted:async()=>null,cleanup:async()=>null,onFailure:async()=>{events.push('failure');}
      });
      const run=runtime.repository.publish(null,{interactive:false},transport);
      if(failObject){
        await assert.rejects(run,/QA object upload failure/u);
        assert.equal(manifestSettled,true,'a failed object upload waits for the manifest upload to settle');
        assert.equal(events.includes('commit'),false,'nothing is committed after a failed object upload');
        assert.ok(events.indexOf('manifest-end')<events.indexOf('failure'),'failure handling runs after both uploads settle');
      }else{
        await run;
        assert.ok(events.indexOf('manifest')<events.indexOf('object-end'),'the manifest uploads while objects are still uploading');
        assert.ok(events.lastIndexOf('object-end')<events.indexOf('commit')&&events.indexOf('manifest-end')<events.indexOf('commit'),'the commit waits for every object and the manifest');
      }
    }
  }finally{runtime.controller.invalidateRepositoryPreparation();notes=original.notes;dailyRecords=original.dailyRecords;assetDescriptor=original.assetDescriptor;snapshotRevision=original.snapshotRevision;sourceRevision=original.sourceRevision;}
}
console.log(JSON.stringify({status:'PASS',suite:'repository-checkpoint',providerMetadataVerificationCases,assembledUploadContinuations,publicationContinuationCases,assembledDriveCases,assembledDriveWallMs,incompleteInventoryCases,driveBacklogCases,firstAttachmentReads:1,secondAttachmentReads:0,simulatedAttachmentBytes:AUDIO_BYTES,identicalCheckpointAllObjectsReused:true,unchangedStructuredObjectsRecompressed:false,oldSavedDayEditFreshObjects:fresh,noteEditFreshObjects:noteFresh,attachmentMetadataZeroByteReads:true,savedDayDeletionNoResurrection:true,sealedCaptureSurvivesLaterMutation:true,providerTieredRetentionFoundation:true,providerCommitMarkerLatestAtomicity:true,retentionPolicy15Plus1:true,beforeRestorePublication:true,managedProviderProtectedPublication:true,orphanMaintenanceBackupRecovery:true,tierGraduation:true,sparseRetention:true,retentionDeletionFailureGcSafe:true,providerReconciliationConvergence:true,providerConvergenceFailureIsolated:true,providerSharedObjectGcSafe:true,publicationProtectedGcSafe:true,reclamationGraceSafe:true,providerLargeAttachmentUploadsBeforeSelfHeal:1,providerLaterAttachmentBytes:0,providerMissingObjectSelfHeal:true,providerOrphanGc:true,providerScrubSelfHeal:true,integrityScrubPriority:true,retainedAbaReuse:true,providerPostSealMutationAllowed:true,integrityScrubStableObjectsOnly:true,integrityScrubLeasesReleased:true,providerTemporaryDownloadsReleased:true,explicitProtectedRemoval:true,durableProviderRetry:true,metadataHistoryColdZeroDownloads:coldHistoryDownloads===0,metadataHistoryWarmZeroDownloads:warmHistoryAdditionalDownloads===0,metadataHistoryScopeIndependent:true,repositoryGenerationReset:true,metadataHistoryBodyVerificationDeferred:true,metadataHistoryUncertainZeroDownloads:uncertainColdDownloads===0,metadataHistoryListedRemoteFiles:coldHistoryRemoteFiles,postPublicationReceiptReuse:true,postPublicationReceiptPublications:2,postPublicationReceiptImmutableReadbacks:receiptDownloads.checkpoint.length+receiptDownloads.commit.length,postPublicationReceiptAdditionalHistoryDownloads:receiptDownloads.checkpoint.length+receiptDownloads.commit.length-4,stateDiscoveryObjectInventoryReuse:true,stateDiscoveryMatureObjectLists:objectListsDuringSecondReceipt,stateDiscoveryConservativeConcurrentObject:true,checksumOperations:checksumCounter},null,2));
await import('../../helpers/session-ownership-claim-regression.mjs');
