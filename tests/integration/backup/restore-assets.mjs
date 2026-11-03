import {createBackupPresentation} from '../../helpers/backup-presentation.mjs';
import {RUNTIME_DATA_CONTRACT} from '../../../contracts/canonical-identities.mjs';
const encryptedMode=false;
import {createProcessingEngine} from '../../helpers/file-processing.mjs';
const testProcessing=Object.freeze({...createProcessingEngine(),scope:operation=>operation()});
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {testPendingReviewCodec,memoryPendingReviews,paragraphMerge} from '../../helpers/pending-review-codec.mjs';
const HERE=path.dirname(fileURLToPath(import.meta.url)),ROOT=path.resolve(HERE,'../../..'),read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');
for(const file of ['source/core/internal.js','source/core/operation-lifecycle.js','source/core/persistence.js','source/core/record-codecs.js','source/core/backup-codec.js','source/core/canonical.js','source/core/reconciliation.js','source/core/managed-repository.js','source/core/repository-policy.js','source/core/repository-background.js','source/core/backup-provider.js','source/core/backup-capture.js','source/core/backup.js'])vm.runInThisContext(read(file),{filename:file});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')],freeze=Object.freeze,CanonicalModule=registry.require('canonical',1),Persistence=registry.require('persistence',1),ManagedRepositoryModule=registry.require('managed-repository',1),RepositoryPolicyModule=registry.require('repository-policy',1),RepositoryBackgroundModule=registry.require('repository-background',1,Object.freeze({lifecycle:registry.require('operation-lifecycle',1)})),BackupProviderModule=registry.require('backup-provider',1,freeze({repositoryPolicy:RepositoryPolicyModule})),BackupCaptureModule=registry.require('backup-capture',1),BackupModule=registry.require('backup',1,freeze({backupCapture:BackupCaptureModule,backupProvider:BackupProviderModule,canonical:CanonicalModule,managedRepository:ManagedRepositoryModule,repositoryBackground:RepositoryBackgroundModule})),ReconciliationModule=registry.require('reconciliation',1,freeze({canonical:CanonicalModule}));
const RecordCodecs=registry.require('record-codecs',1);
const BackupCodecs=registry.require('backup-codec',1);
const limits=freeze({backupChunkItems:10,backupChunkTargetBytes:65536,backupMaxEntryBytes:65536,backupMaxLineBytes:262144,backupMaxCompressedBytes:4*1024*1024,backupMaxFileBytes:16*1024*1024,backupMaxUncompressedBytes:8*1024*1024,backupMaxAssetDescriptors:100,richAssetMaxBytes:8*1024*1024,maxBackupChunks:1000,importBytes:4*1024*1024,maxImportRecords:100,maxNotes:100,maxLegacyImportTombstones:100,maxReflectionChars:10000,maxBackupFilenameChars:160,maxScheduleChars:10000});
const dataContract=RUNTIME_DATA_CONTRACT;
const defs=freeze({dailyRecord:freeze({idField:'date',backupLimit:100}),note:freeze({idField:'key',backupLimit:100}),activeSession:freeze({idField:'id',backupLimit:1})});
const isDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''));
const normalizeArea=(item,key)=>item&&String(key||item.key||'')?freeze({key:String(key||item.key),text:String(item.text||''),updatedAt:String(item.updatedAt||'2026-08-31T00:00:00.000Z')}):null;
const dailyRecordCodec=freeze({sanitizeHistoricalDailyRecord:x=>x&&isDate(x.date)?freeze({...x}):null,canonicalizeHistoricalDailyRecord:x=>x&&isDate(x.date)?freeze({...x,version:15}):null,sanitizeCurrentDailyRecord:x=>x&&isDate(x.date)&&Number(x.version)===15?freeze({...x}):null,sanitizeImportedNote:normalizeArea,sanitizeCurrentNote:normalizeArea,isSupportedSavedDate:isDate});
const sanitizeActiveSession=x=>x&&x.id==='current'?freeze({...x}):null;
const activeSessionCodec=freeze({sanitizeCurrent:sanitizeActiveSession,contentValue:x=>{const clean=sanitizeActiveSession(x);if(!clean)return null;const snapshot=clean.snapshot&&typeof clean.snapshot==='object'?clean.snapshot:{},{contentRevision:_contentRevision,savedRevision:_savedRevision,updatedAt:_updatedAt,...contentSnapshot}=snapshot;return freeze({date:String(clean.date||''),scheduleText:String(clean.scheduleText||''),snapshot:freeze(contentSnapshot)});}});
const reflectionDraftCodec=freeze({format:'study-director.reflection-draft-codec',contractVersion:1,sanitizeCurrent:x=>x&&isDate(x.date)?freeze({...x,reflection:String(x.reflection||'')}):null});
const compatibilityCodec=freeze({format:'study-director.compatibility-codecs',contractVersion:1,dailyRecord:x=>dailyRecordCodec.sanitizeCurrentDailyRecord(x),note:normalizeArea,activeSession:x=>activeSessionCodec.sanitizeCurrent(x),reflectionDraft:x=>reflectionDraftCodec.sanitizeCurrent(x),personalData:item=>{if(!item||typeof item!=='object'||![1,2].includes(Number(item.version)))throw new Error('Unsupported legacy personal-data version.');const p=item.preferences||{};return {version:2,plans:item.plans,preferences:{studentName:p.studentName??null,theme:p.theme??null,presentation:p.presentation??null,quote:p.quote??null,practiceCueMode:p.practiceCueMode??null,fontScale:p.fontScale??null,practiceTargetMs:p.practiceTargetMs??null,nudge:p.nudge??null}};}});
const keyedRecord=freeze({create:()=>Object.create(null)}),entityDefinition=t=>defs[t]||null,entityIdentity=(t,x)=>String(x?.[defs[t]?.idField]||'');
const boundedInt=(v,{min=0,max=Number.MAX_SAFE_INTEGER,fallback=0}={})=>{const n=Number(v);return Number.isInteger(n)&&n>=min&&n<=max?n:fallback;},jsonByteLength=v=>new TextEncoder().encode(typeof v==='string'?v:JSON.stringify(v)).byteLength;
const personalDataCodec=RecordCodecs.createPersonalDataCodec(limits);
const pendingReviewCodec=testPendingReviewCodec(RecordCodecs,{personalDataCodec}),keptReviews=memoryPendingReviews(pendingReviewCodec);
const codec=BackupCodecs.createBackupCodec(freeze({personalDataCodec,pendingReviewCodec,processing:testProcessing,appConfig:freeze({appName:'Study Director',attribution:'Study Director'}),limits,dataContract,legacy:freeze({schemaVersion:3,tombstoneLimit:limits.maxLegacyImportTombstones}),entityTypes:freeze(Object.keys(defs)),keyedRecord,entities:freeze({entityDefinition,entityIdentity}),helpers:freeze({boundedInt,jsonByteLength}),richText:freeze({assetIds:value=>String(value||'').includes('img-restoreabcdefghijklmnop')?freeze(['img-restoreabcdefghijklmnop']):freeze([]),assetIdValid:value=>/^img-[A-Za-z0-9_-]{16,128}$/.test(String(value||'')),imageMimeTypeValid:value=>['image/png','image/jpeg','image/webp','image/gif','image/avif'].includes(String(value||''))}),dailyRecordCodec,activeSessionCodec,compatibilityCodec}));

const assetId='img-restoreabcdefghijklmnop',unusedAssetId='img-unusedabcdefghijklmnop',libraryAssetId='img-libraryabcdefghijklmnop';
const image=new Blob([new Uint8Array([1,2,3,4,5,6])],{type:'image/png'}),unusedImage=new Blob([new Uint8Array([7,8,9])],{type:'image/png'}),libraryImage=new Blob([new Uint8Array([10,11,12])],{type:'image/png'});
const rich=`WG1:${JSON.stringify({version:1,doc:{type:'Doc',content:[{type:'SDImage',param:{assetId,alt:'proof',widthPct:100}}]}})}`;
const personalData=freeze({
  version:2,
  plans:freeze({draft:null,savedPlans:freeze([]),defaultId:null}),
  preferences:freeze({studentName:'Student',theme:null,presentation:null,quote:null,practiceCueMode:null,fontScale:null,practiceTargetMs:null,nudge:null})
});
const importedNote=freeze({version:2,key:'Ethics',text:rich,updatedAt:'2026-08-31T12:00:00.000Z'}),counts=codec.countShape({dailyRecord:0,note:1,activeSession:0,personalData:1,checkpointManifest:1});
const algorithm=codec.checksumAlgorithm(),descriptors=freeze([
  freeze({assetId,mimeType:'image/png',size:image.size,checksum:await codec.checksumBlob(image),name:'referenced.png',library:false}),
  freeze({assetId:unusedAssetId,mimeType:'image/png',size:unusedImage.size,checksum:await codec.checksumBlob(unusedImage),name:'unused.png',library:false}),
  freeze({assetId:libraryAssetId,mimeType:'image/png',size:libraryImage.size,checksum:await codec.checksumBlob(libraryImage),name:'library.png',library:true})
]),plan=freeze({studentName:'Student',installationId:'inst_device_b',exportedAt:'2026-08-31T12:00:00.000Z',sourceRevision:'2026-08-31T12:00:00.000Z',recordDates:freeze([]),savedDayDeletions:freeze([]),counts});
const manifest=codec.createManifest(plan,{compression:'none',algorithm}),checkpointChunk=await codec.encodeChunk(0,'checkpointManifest',[codec.createProtectedManifest(plan,manifest.checkpoint)],algorithm),personalChunk=await codec.encodeChunk(1,'personalData',[personalData],algorithm),chunk=await codec.encodeChunk(2,'note',[importedNote],algorithm),complete=await codec.encodeCompletion(3,counts,[checkpointChunk.checksum,personalChunk.checksum,chunk.checksum],algorithm,descriptors);
let importBlob=codec.createV10Container(new Blob([JSON.stringify(manifest)+'\n'+checkpointChunk.line+'\n'+personalChunk.line+'\n'+chunk.line+'\n'+JSON.stringify(complete)+'\n']),{compression:'none',assetBlobs:[image,unusedImage,libraryImage]});

const originalDeletionLedger=freeze([freeze({date:'2026-08-30',deletedAt:'2026-08-31T00:30:00.000Z'})]);
const originalAttachmentDeletionLedger=freeze([freeze({assetId:'img-deletedhistoryabcdefghijkl',deletedAt:'2026-08-31T00:45:00.000Z'})]);
let notes={Local:freeze({key:'Local',text:'local before restore',updatedAt:'2026-08-31T01:00:00.000Z'})},assets=new Map(),assetMeta=new Map(),journal=null,failAtPhase='',verificationFault='',deletionLedger=[...originalDeletionLedger],attachmentDeletionLedger=[...originalAttachmentDeletionLedger],noteChoice=null;
const events=[],statuses=[];let configureResult=freeze({});const fn=()=>false,clampText=(v,max=100000)=>String(v??'').slice(0,max);
const documentStub=freeze({getElementById:()=>null,addEventListener:()=>false,createElement:()=>({click:()=>events.push('safety-download'),remove:()=>false}),createDocumentFragment:()=>({appendChild:()=>false}),body:freeze({appendChild:()=>false})});
const runtime=BackupModule.createRuntime(freeze({ports:freeze({
  configuration:freeze({appVersion:'QA_FIXTURE',backupVersion:RUNTIME_DATA_CONTRACT.schemas.Backup.version,starterSchedule:'',limits:freeze({backupChunkItems:10,backupMaxCompressedBytes:limits.backupMaxCompressedBytes,backupMaxFileBytes:limits.backupMaxFileBytes,backupMaxAssetDescriptors:limits.backupMaxAssetDescriptors,maxImportRecords:limits.maxImportRecords,maxNoteLinks:50,maxNotes:limits.maxNotes,maxPendingReviews:2000})}),
  
  persistence:freeze({activeSessionLoad:async()=>({ok:true,value:null,error:null,storage:{idb:true}}),activeSessionSave:async v=>({ok:true,value:v}),activeSessionClear:async()=>({ok:true}),activeSessionSettled:async()=>true,dailyRecordBackupDates:async()=>({dates:[],warning:''}),dailyRecordBackupMonth:async()=>[],dailyRecordDocuments:async()=>[],dailyRecordImportBatches:async()=>({batches:0}),dailyRecordRemove:async()=>true,dailyRecordTimestamp:()=>0,notesExportPayload:()=>notes,notesReadFreshPayload:async()=>notes,notesReadFreshItems:async keys=>(keys||[]).map(key=>notes[key]||null),notesFlush:async()=>true,notesNormalizePayload:v=>Object.fromEntries(Object.entries(v||{}).map(([k,x])=>[k,normalizeArea(x,k)]).filter(([,x])=>x)),notesTrashKey:key=>String(key).startsWith('~')?'':'~deleted '+key,notesAlignByTitle:value=>value,notesFailure:()=>({failed:false}),restoreJournalPrepare:async v=>(journal={state:{id:v.id},payload:v}),restoreJournalRead:async()=>journal,restoreJournalMark:async(id,phase)=>{journal.state.phase=phase;if(failAtPhase===phase){failAtPhase='';throw new Error(`injected ${phase} restore failure`);}return journal.state;},restoreJournalClear:async()=>{journal=null;return true;},personalSettle:async()=>true,personalExport:async()=>personalData,personalImport:async()=>true,personalVerify:async()=>true,storageGeneration:()=>0,sourceRevision:async()=> '2026-09-15T12:00:00.000Z',snapshotRevision:async()=>'stable',canonicalMutationEpochRead:async()=>null,canonicalPreparationRebase:async()=>Object.freeze({epoch:null,stamps:Object.freeze([])}),preparationUnitStamps:async()=>[],preparationUnitReplace:async()=>[],installationId:()=> 'inst_device_local',deletionRecoveryFlush:async()=>true,deletionRecoverySavedDays:async()=>deletionLedger.map(value=>({...value})),deletionRecoveryReplaceSavedDays:async values=>{deletionLedger=(values||[]).map(value=>({...value}));return true;},deletionRecoveryNotes:async()=>[],deletionRecoveryReplaceNotes:async()=>true,deletionRecoveryAttachments:async()=>attachmentDeletionLedger.map(value=>({...value})),deletionRecoveryReplaceAttachments:async values=>{attachmentDeletionLedger=(values||[]).map(value=>({...value}));return true;},deletionRecoveryClearAttachment:async assetIdValue=>{attachmentDeletionLedger=attachmentDeletionLedger.filter(item=>item.assetId!==assetIdValue);return true;},reconciliationBaseRead:async()=>null,reconciliationBaseReadNotes:async()=>freeze({}),reconciliationBaseReadDays:async()=>freeze({}),...keptReviews.ports,reconciliationBaseWrite:async()=>true}),
  assets:freeze({
    list:async()=>{if(verificationFault==='attachments'&&journal?.state?.phase==='verifying')throw new Error('QA_FIXTURE attachment verification failure');return Promise.all([...assets].map(async([id,blob])=>{const meta=assetMeta.get(id)||{};return{id,hash:await codec.checksumBlob(blob),type:blob.type,size:blob.size,name:String(meta.name||''),library:meta.library===true};}));},
    importAll:async items=>{for(const item of items){events.push('asset-put');assets.set(item.assetId,item.blob);assetMeta.set(item.assetId,{name:item.name,library:item.library});}return items.length;},
    restoreAll:async items=>{assets=new Map(items.map(item=>[item.assetId,item.blob]));assetMeta=new Map(items.map(item=>[item.assetId,{name:item.name,library:item.library}]));},
    get:async id=>assets.get(id)||null,put:async(id,blob)=>{events.push('asset-put');assets.set(id,blob);},keys:async()=>[...assets.keys()],removeMany:async ids=>{events.push('asset-remove');for(const id of ids)assets.delete(id);return ids.length;},removeMetadata:async ids=>{for(const id of ids){assets.delete(id);assetMeta.delete(id);}return freeze({status:'completed',removed:ids.length});},scheduleMaintenance:()=>{events.push('asset-maintenance');return true;}}),
  exports:freeze({...testProcessing,followProtection:async()=>false,backgroundAvailable:()=>true,protect:async file=>(typeof file==='function'?await file():file),unprotect:async blob=>({blob,encrypted:false}),check:()=>{},job:fn=>fn(),download:()=>({status:'downloaded'}),chooseSave:async()=>null,save:async()=>({status:'downloaded'})}),
    codecs:freeze({activeSession:activeSessionCodec,backup:freeze({...codec,inspect:codec.inspectCurrent}),pendingReview:pendingReviewCodec}),reconciliation:freeze({createPlan:ReconciliationModule.createPlan,resolvePlan:ReconciliationModule.resolvePlan,summarizePlan:ReconciliationModule.summarizePlan}),noteReconciliation:freeze({merge:paragraphMerge,resolve:async({conflicts=[]})=>freeze({format:'study-director.note-reconciliation-result',version:1,notes:freeze(Object.fromEntries(conflicts.map(item=>[item.key,freeze({text:noteChoice?noteChoice(item):item.localValue,localCandidateId:item.localCandidateId,incomingCandidateId:item.incomingCandidateId})])))})}),session:freeze({canMutate:()=>true,cancelLiveDraftSave:fn,captureSnapshot:()=>null,hasActiveSession:()=>false,hasTasks:()=>false,toActiveSession:()=>null,withPersistenceSuppressed:async operation=>operation(),yieldSession:async()=>false}),
  domain:freeze({clampText,filenameSafeStudentName:()=> 'student',getStudentName:()=> 'Student',materializeDailyRecordView:v=>v,sanitizeCurrentDailyRecord:dailyRecordCodec.sanitizeCurrentDailyRecord,todayISO:()=> '2026-08-31'}),
  view:freeze({presentation:createBackupPresentation(),refreshPnote:fn,refreshReview:fn,renderSchedule:fn}),
  events:freeze({libraryChanged:fn,backupCompleted:fn,reconcileNotes:async payload=>{events.push('reconcile-notes');notes={...notes,...payload};return notes;},restoreNotesSnapshot:async payload=>{notes={...payload};return notes;},restoreSessionState:async()=>true,verifyActiveSessionRuntime:async()=>true,restoredFromFile:()=>false}),
  operations:freeze({canShare:()=>true,assertAuthority:()=>true,clearFault:fn,failClosed:fn,runExclusive:async(kind,op)=>op()}),interactions:freeze({choose:async()=>null,configure:async()=>configureResult,notify:fn}),
  environment:freeze({AbortController,clearTimeout,yieldTask:async()=>{},setTimeout:cb=>{cb();return 1;}}),diagnostics:freeze({capture:fn,start:()=>'',mark:()=>false,finish:()=>false,fail:()=>false})
})}));

if(encryptedMode){
 const corrupted=new Uint8Array(await importBlob.arrayBuffer());corrupted[corrupted.length-1]^=1;
 for(const input of [new Blob([corrupted]),importBlob.slice(0,importBlob.size-1)]){await assert.rejects(runtime.controller.inspect(input));assert.equal(events.length,0);assert.equal(journal,null);assert.deepEqual(Object.keys(notes),['Local']);}
}
const candidate=await runtime.controller.inspect(importBlob,{filename:'incoming.sdbackup'}),result=await runtime.controller.restore(candidate);
assert.equal(result.assetsRestored,2,'only referenced or independently retained incoming attachments should publish');
assert.equal(assets.has(assetId),true,'resolved note attachment must publish');
assert.equal(assets.has(libraryAssetId),true,'independently retained checkpoint attachment must publish');
assert.equal(assets.has(unusedAssetId),false,'unreferenced non-library checkpoint attachment must never enter canonical storage');
assert.equal(notes.Ethics.text,rich);assert.ok(events.indexOf('asset-put')<events.indexOf('reconcile-notes'),'selected asset bytes must commit before rich strings');
assert.equal(events.filter(event=>event==='asset-put').length,2,'only selected attachments may be published');
assert.ok(events.includes('asset-maintenance'),'post-commit maintenance must be scheduled');

// Changed-only verification must still enter the attachment family when a real
// attachment mutation committed. The generic shared-base fixture has no bytes.
{
  notes={Local:freeze({key:'Local',text:'local before attachment verification fault',updatedAt:'2026-08-31T01:00:00.000Z'})};assets=new Map();assetMeta=new Map();deletionLedger=originalDeletionLedger.map(value=>({...value}));attachmentDeletionLedger=originalAttachmentDeletionLedger.map(value=>({...value}));events.length=0;journal=null;verificationFault='attachments';
  const verificationCandidate=await runtime.controller.inspect(importBlob,{filename:'attachment-verification-fault.sdbackup'});
  const failure=await runtime.controller.restore(verificationCandidate).then(()=>null,error=>error);verificationFault='';
  assert.ok(failure instanceof Error,'attachment verification fault must reject the restore');
  assert.equal(failure.backupStage,'restore-verification-attachments');assert.equal(failure.code,'RESTORE_VERIFICATION_MISMATCH');
  assert.equal(assets.size,0,'attachment verification failure must roll back newly imported bytes');
  assert.deepEqual(Object.keys(notes),['Local'],'attachment verification failure must restore local notes');
  assert.equal(journal,null,'attachment verification failure must retire its rollback journal after rollback');
}


// A standalone Attachment Library identity that was explicitly deleted locally
// must not be resurrected by an older incoming checkpoint. Local deletion is
// the default conflict choice.
{
  notes={Local:freeze({key:'Local',text:'local before deleted-library restore',updatedAt:'2026-08-31T01:00:00.000Z'})};assets=new Map();assetMeta=new Map();deletionLedger=originalDeletionLedger.map(value=>({...value}));attachmentDeletionLedger=[{assetId:libraryAssetId,deletedAt:'2026-09-01T00:00:00.000Z'}];events.length=0;journal=null;
  const deletedLibraryCandidate=await runtime.controller.inspect(importBlob,{filename:'deleted-library.sdbackup'}),deletedLibraryResult=await runtime.controller.restore(deletedLibraryCandidate);
  assert.equal(assets.has(libraryAssetId),false,'older library-only attachment must not resurrect across a local explicit deletion.');
  assert.ok(attachmentDeletionLedger.some(item=>item.assetId===libraryAssetId),'local Attachment Library deletion marker must remain canonical.');
  assert.equal(deletedLibraryResult.attachmentDeletionsApplied>=0,true);
}

// A final resolved rich-text reference is stronger than standalone library
// deletion intent: the attachment must be restored and the stale deletion
// marker cleared rather than breaking the surviving note.
{
  notes={Local:freeze({key:'Local',text:'local before referenced revival',updatedAt:'2026-08-31T01:00:00.000Z'})};assets=new Map();assetMeta=new Map();deletionLedger=originalDeletionLedger.map(value=>({...value}));attachmentDeletionLedger=[{assetId,deletedAt:'2026-09-01T00:00:00.000Z'}];events.length=0;journal=null;
  const referencedCandidate=await runtime.controller.inspect(importBlob,{filename:'referenced-revival.sdbackup'});await runtime.controller.restore(referencedCandidate);
  assert.equal(assets.has(assetId),true,'resolved rich-text reference must retain/revive its required attachment.');
  assert.equal(attachmentDeletionLedger.some(item=>item.assetId===assetId),false,'required attachment reference must clear conflicting standalone deletion intent.');
}


// Restoring one note brings back the image its restored text uses, whether
// the image was cleaned up or recorded as deleted, and nothing else: a
// library-only attachment stays away and unrelated deletion records stay.
for(const recordedAsDeleted of [false,true]){
  const unrelated={assetId:unusedAssetId,deletedAt:'2026-09-01T00:00:00.000Z'};
  notes={Ethics:freeze({key:'Ethics',text:'text after an accident',updatedAt:'2026-09-03T01:00:00.000Z'}),Local:freeze({key:'Local',text:'local note',updatedAt:'2026-08-31T01:00:00.000Z'})};assets=new Map();assetMeta=new Map();deletionLedger=originalDeletionLedger.map(value=>({...value}));
  attachmentDeletionLedger=[unrelated,...(recordedAsDeleted?[{assetId,deletedAt:'2026-09-02T00:00:00.000Z'}]:[])];events.length=0;journal=null;noteChoice=item=>item.incomingValue;
  const noteResult=await runtime.controller.restore(await runtime.controller.inspect(importBlob,{filename:'note-version.sdbackup'}),{note:'Ethics'});noteChoice=null;
  assert.equal(noteResult.cancelled,false);assert.equal(notes.Ethics.text,rich,'the earlier text comes back');assert.equal(notes.Local.text,'local note');
  assert.equal(assets.has(assetId),true,`the image the restored text uses comes back${recordedAsDeleted?' even though it was recorded as deleted':''}`);
  assert.equal(assets.has(libraryAssetId),false,'a library-only attachment is not part of a one-note restore');assert.equal(assets.has(unusedAssetId),false);
  assert.deepEqual(attachmentDeletionLedger.map(item=>item.assetId),[unusedAssetId],'only the restored image leaves the deletion records');
}

// Incoming explicit deletion versus a local standalone library identity is a
// real two-way choice: local is the default, but an explicit deletion choice
// removes the metadata and carries the deletion marker forward.
{
  const deletionCounts=codec.countShape({dailyRecord:0,note:0,activeSession:0,personalData:1,checkpointManifest:1});
  const deletionPlan=freeze({studentName:'Student',installationId:'inst_device_delete',exportedAt:'2026-09-02T12:00:00.000Z',sourceRevision:'2026-09-02T12:00:00.000Z',recordDates:freeze([]),savedDayDeletions:freeze([]),noteDeletions:freeze([]),attachmentDeletions:freeze([freeze({assetId:libraryAssetId,deletedAt:'2026-09-02T12:00:00.000Z'})]),counts:deletionCounts});
  const deletionManifest=codec.createManifest(deletionPlan,{compression:'none',algorithm});
  const deletionCheckpoint=await codec.encodeChunk(0,'checkpointManifest',[codec.createProtectedManifest(deletionPlan,deletionManifest.checkpoint)],algorithm),deletionPersonal=await codec.encodeChunk(1,'personalData',[personalData],algorithm),deletionComplete=await codec.encodeCompletion(2,deletionCounts,[deletionCheckpoint.checksum,deletionPersonal.checksum],algorithm,[]);
  const deletionBlob=codec.createV10Container(new Blob([JSON.stringify(deletionManifest)+'\n'+deletionCheckpoint.line+'\n'+deletionPersonal.line+'\n'+JSON.stringify(deletionComplete)+'\n']),{compression:'none',assetBlobs:[]});

  notes={Local:freeze({key:'Local',text:'local before incoming deletion',updatedAt:'2026-08-31T01:00:00.000Z'})};assets=new Map([[libraryAssetId,libraryImage]]);assetMeta=new Map([[libraryAssetId,{name:'library.png',library:true}]]);attachmentDeletionLedger=[];events.length=0;journal=null;configureResult=freeze({});
  await runtime.controller.restore(await runtime.controller.inspect(deletionBlob,{filename:'incoming-attachment-delete-default.sdbackup'}));
  assert.equal(assets.has(libraryAssetId),true,'local standalone library item must win by default against incoming deletion.');
  assert.equal(attachmentDeletionLedger.some(item=>item.assetId===libraryAssetId),false,'keeping local attachment must clear incoming deletion intent.');

  assets=new Map([[libraryAssetId,libraryImage]]);assetMeta=new Map([[libraryAssetId,{name:'library.png',library:true}]]);attachmentDeletionLedger=[];events.length=0;journal=null;configureResult=freeze({[`attachment__${libraryAssetId}`]:'deleted'});
  await runtime.controller.restore(await runtime.controller.inspect(deletionBlob,{filename:'incoming-attachment-delete-explicit.sdbackup'}));
  assert.equal(assets.has(libraryAssetId),false,'explicit Attachment Library deletion choice must remove local standalone metadata.');
  assert.ok(attachmentDeletionLedger.some(item=>item.assetId===libraryAssetId),'explicit Attachment Library deletion choice must persist the portable deletion marker.');
  configureResult=freeze({});
}

// Exercise fault handling at early, middle, and late points in the real restore
// state machine. Each attempt must restore the exact pre-import visible state and
// clear the durable rollback journal before the next attempt.
const restoreFailureStages=Object.freeze([
  Object.freeze({name:'early',phase:'applying-saved-day-state'}),
  Object.freeze({name:'middle',phase:'applying-notes'}),
  Object.freeze({name:'late',phase:'verifying'})
]);
const checkedStages=[];
for(const stage of restoreFailureStages){
  notes={Local:freeze({key:'Local',text:'local before restore',updatedAt:'2026-08-31T01:00:00.000Z'})};assets=new Map();assetMeta=new Map();deletionLedger=originalDeletionLedger.map(value=>({...value}));attachmentDeletionLedger=originalAttachmentDeletionLedger.map(value=>({...value}));events.length=0;failAtPhase=stage.phase;
  const stagedCandidate=await runtime.controller.inspect(importBlob,{filename:`incoming-${stage.name}.sdbackup`});
  const failure=await runtime.controller.restore(stagedCandidate).then(()=>null,error=>error);
  assert.ok(failure instanceof Error,`${stage.name} fault must reject the restore.`);
  assert.match(failure.message,new RegExp(stage.phase));
  assert.match(failure.studyDirectorRollbackDescription,/rolled back/u);
  assert.equal(assets.size,0,`${stage.name} rollback must remove newly imported Blobs.`);
  assert.deepEqual(Object.keys(notes),['Local'],`${stage.name} rollback retained imported notes.`);
  assert.equal(notes.Local.text,'local before restore');
  assert.deepEqual(deletionLedger,originalDeletionLedger,`${stage.name} rollback must restore the pre-import Saved-Day deletion ledger.`);
  assert.deepEqual(attachmentDeletionLedger,originalAttachmentDeletionLedger,`${stage.name} rollback must restore the pre-import Attachment deletion ledger.`);
  assert.equal(journal,null,`${stage.name} rollback journal was not cleared.`);
  checkedStages.push(stage.name);
}


// Required checkpoint bytes that are explicitly missing must fail closed before
// rich text can commit, then roll back the journaled safety snapshot.
{
  const missingComplete=await codec.encodeCompletion(3,counts,[checkpointChunk.checksum,personalChunk.checksum,chunk.checksum],algorithm,[freeze({assetId,missing:true})]);
  const missingBlob=codec.createV10Container(new Blob([JSON.stringify(manifest)+'\n'+checkpointChunk.line+'\n'+personalChunk.line+'\n'+chunk.line+'\n'+JSON.stringify(missingComplete)+'\n']),{compression:'none',assetBlobs:[]});
  notes={Local:freeze({key:'Local',text:'local before missing restore',updatedAt:'2026-08-31T01:00:00.000Z'})};assets=new Map();assetMeta=new Map();deletionLedger=originalDeletionLedger.map(value=>({...value}));attachmentDeletionLedger=originalAttachmentDeletionLedger.map(value=>({...value}));events.length=0;journal=null;
  const missingCandidate=await runtime.controller.inspect(missingBlob,{filename:'missing-selected-asset.sdbackup'});
  const failure=await runtime.controller.restore(missingCandidate).then(()=>null,error=>error);
  assert.ok(failure instanceof Error);assert.match(failure.message,/does not contain its bytes/i);
  assert.match(failure.studyDirectorRollbackDescription,/rolled back/i);
  assert.equal(assets.size,0);assert.deepEqual(Object.keys(notes),['Local']);assert.equal(journal,null);
}

// Same attachment identity with different verified bytes remains a hard
// preflight collision and must not enter reconciliation or mutate canonical data.
{
  notes={Local:freeze({key:'Local',text:'local before collision',updatedAt:'2026-08-31T01:00:00.000Z'})};
  const collisionBlob=new Blob([new Uint8Array([99,98,97])],{type:'image/png'});assets=new Map([[assetId,collisionBlob]]);assetMeta=new Map([[assetId,{name:'local.png',library:false}]]);events.length=0;journal=null;
  const collisionCandidate=await runtime.controller.inspect(importBlob,{filename:'collision.sdbackup'});
  await assert.rejects(()=>runtime.controller.restore(collisionCandidate),/identity collision.*local bytes differ/i);
  assert.equal(events.filter(event=>event==='asset-put').length,0);assert.equal(notes.Local.text,'local before collision');assert.equal(journal,null);
}

console.log(JSON.stringify({status:'PASS',release:encryptedMode?'QA_FIXTURE':'QA_FIXTURE',encrypted:encryptedMode,scenarios:7+checkedStages.length,restoreFailureStages:checkedStages,attachmentAware:true},null,2));
