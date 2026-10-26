import {createBackupPresentation} from '../../helpers/backup-presentation.mjs';
import {RUNTIME_DATA_CONTRACT} from '../../../contracts/canonical-identities.mjs';
import {createProcessingEngine} from '../../helpers/file-processing.mjs';
const testProcessing=Object.freeze({...createProcessingEngine(),scope:operation=>operation()});
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {gzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {createFakeClock} from '../../helpers/fake-clock.mjs';
import {testPendingReviewCodec,memoryPendingReviews,paragraphMerge} from '../../helpers/pending-review-codec.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'../../..');
const read=relative=>fs.readFileSync(path.join(ROOT,relative),'utf8');
for(const file of ['source/core/internal.js','source/core/operation-lifecycle.js','source/core/persistence.js','source/core/record-codecs.js','source/core/backup-codec.js','source/core/canonical.js','source/core/reconciliation.js','source/core/managed-repository.js','source/core/repository-policy.js','source/core/repository-background.js','source/core/backup-provider.js','source/core/backup-capture.js','source/core/backup.js']){
  vm.runInThisContext(read(file),{filename:file});
}
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const Persistence=registry.require('persistence',1);
const RecordCodecs=registry.require('record-codecs',1);
const BackupCodecs=registry.require('backup-codec',1);
const CanonicalModule=registry.require('canonical',1);
const ManagedRepositoryModule=registry.require('managed-repository',1);
const RepositoryPolicyModule=registry.require('repository-policy',1);
const RepositoryBackgroundModule=registry.require('repository-background',1,Object.freeze({lifecycle:registry.require('operation-lifecycle',1)}));
const BackupProviderModule=registry.require('backup-provider',1,Object.freeze({repositoryPolicy:RepositoryPolicyModule}));
const BackupCaptureModule=registry.require('backup-capture',1);
const BackupModule=registry.require('backup',1,Object.freeze({backupCapture:BackupCaptureModule,backupProvider:BackupProviderModule,canonical:CanonicalModule,managedRepository:ManagedRepositoryModule,repositoryBackground:RepositoryBackgroundModule}));
const ReconciliationModule=registry.require('reconciliation',1,Object.freeze({canonical:CanonicalModule}));
const freeze=Object.freeze;

const limits=freeze({
  backupChunkItems:2,backupChunkTargetBytes:65536,backupMaxEntryBytes:65536,
  backupMaxLineBytes:262144,backupMaxCompressedBytes:4*1024*1024,backupMaxFileBytes:16*1024*1024,
  backupMaxUncompressedBytes:8*1024*1024,backupMaxAssetDescriptors:100,richAssetMaxBytes:8*1024*1024,maxBackupChunks:1000,
  importBytes:4*1024*1024,maxImportRecords:100,maxNotes:100,
  maxLegacyImportTombstones:100,maxReflectionChars:10000
});
const dataContract=RUNTIME_DATA_CONTRACT;
const entityDefinitions=freeze({
  dailyRecord:freeze({idField:'date',backupLimit:limits.maxImportRecords}),
  note:freeze({idField:'key',backupLimit:limits.maxNotes}),
  activeSession:freeze({idField:'id',backupLimit:1})
});
const clampText=(value,max=100000)=>String(value??'').slice(0,max);
const isDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''));
const normalizeTimestamp=value=>Number.isFinite(Date.parse(String(value||'')))?new Date(value).toISOString():null;
const normalizeNote=(item,key)=>{
  if(!item||typeof item!=='object')return null;
  const id=String(key||item.key||'').trim();
  if(!id)return null;
  return freeze({version:2,key:id,label:String(item.label||id),text:clampText(item.text,10000),updatedAt:normalizeTimestamp(item.updatedAt)||'2026-08-05T00:00:00.000Z'});
};
const normalizeDrafts=value=>{
  const source=Array.isArray(value)?value:(value&&typeof value==='object'&&value.drafts?Object.values(value.drafts):[]);
  const byDate=new Map();
  for(const item of source){
    if(!item||typeof item!=='object'||!isDate(item.date))continue;
    const clean=freeze({
      version:1,date:item.date,reflection:clampText(item.reflection,limits.maxReflectionChars),
      studyQuality:[1,2,3,4,5].includes(Number(item.studyQuality))?Number(item.studyQuality):null,
      revision:Math.max(0,Math.floor(Number(item.revision)||0)),
      sessionRevision:Math.max(0,Math.floor(Number(item.sessionRevision)||0)),
      updatedAt:normalizeTimestamp(item.updatedAt)||'2026-08-05T00:00:00.000Z'
    });
    if(!byDate.has(clean.date))byDate.set(clean.date,clean);
  }
  return [...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
};
const dailyRecordCodec=freeze({
  sanitizeCurrentDailyRecord:item=>item&&isDate(item.date)&&Number(item.version)===16?freeze({...item,date:item.date}):null,
  sanitizeCurrentNote:normalizeNote,
  isSupportedSavedDate:isDate
});
const activeSessionCodec=freeze({sanitizeCurrent:item=>item&&item.id==='current'?freeze({...item}):null});

const keyedRecord=freeze({create:()=>Object.create(null)});
const entityDefinition=type=>entityDefinitions[type]||null;
const entityIdentity=(type,item)=>String(item?.[entityDefinition(type)?.idField]||'');
const boundedInt=(value,{min=0,max=Number.MAX_SAFE_INTEGER,fallback=0}={})=>{
  const number=Number(value);return Number.isInteger(number)&&number>=min&&number<=max?number:fallback;
};
const jsonByteLength=value=>new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value)).byteLength;
const personalDataCodec=RecordCodecs.createPersonalDataCodec(limits);
const pendingReviewCodec=testPendingReviewCodec(RecordCodecs,{personalDataCodec}),keptReviews=memoryPendingReviews(pendingReviewCodec);
const codec=BackupCodecs.createBackupCodec(freeze({personalDataCodec,pendingReviewCodec,processing:testProcessing,
  appConfig:freeze({appName:'Study Director',attribution:'Study Director'}),limits,dataContract,
  entityTypes:freeze(Object.keys(entityDefinitions)),keyedRecord,
  entities:freeze({entityDefinition,entityIdentity}),helpers:freeze({boundedInt,jsonByteLength}),
  richText:freeze({assetIds:()=>freeze([]),assetIdValid:value=>/^img-[A-Za-z0-9_-]{16,128}$/.test(String(value||'')),imageMimeTypeValid:value=>['image/png','image/jpeg','image/webp','image/gif','image/avif'].includes(String(value||''))}),dailyRecordCodec,activeSessionCodec
}));
let backupCodecInspectCalls=0;
const runtimeCodec=freeze({...codec,inspect:(file,options)=>{backupCodecInspectCalls++;return codec.inspectCurrent(file,options);}});

const notes=freeze({
  Ethics:freeze({version:2,key:'Ethics',label:'Ethics',text:'shared text',updatedAt:'2026-08-05T01:00:00.000Z'}),
  Economics:freeze({version:2,key:'Economics',label:'Economics',text:'shared text',updatedAt:'2026-08-05T02:00:00.000Z'})
});
let currentNotes=notes;
const personalDataFixture=freeze({
  version:2,
  plans:freeze({draft:null,savedPlans:freeze([]),defaultId:null}),
  preferences:freeze({studentName:'Student',theme:null,presentation:null,quote:null,practiceCueMode:null,fontScale:null,practiceTargetMs:null,nudge:null})
});
const events=[];
const statuses=[];
const confirmations=[];
const importedDailyRecords=[];
let noteFailure={failed:false};
let restoring=false;
let safetyReadDone=false;
let areaImportFailureOnce=false;
let corruptAfterImportOnce=false;
let corruptPostCommitReadOnce=false;
let cancelDuringBatchOnce=false;
let restoreJournal=null;
let activeSessionBlocking=false;
let selectIncomingSavedDay=false;
let exportSaveStatus='downloaded',chooseSaveResult=()=>Promise.resolve(null);const chosenNames=[];
let currentFileJob=null;
function exclusiveFileJob(operation,{wait=false}={}){
  if(currentFileJob){
    if(wait)return currentFileJob.catch(()=>{}).then(()=>exclusiveFileJob(operation,{wait}));
    return Promise.reject(new Error('Another file operation is in progress.'));
  }
  const result=Promise.resolve().then(operation);currentFileJob=result;
  return result.finally(()=>{if(currentFileJob===result)currentFileJob=null;});
}
async function withoutFileJobDeadlock(operation){
  let deadline;
  return Promise.race([operation(),new Promise((_,reject)=>{deadline=setTimeout(()=>reject(new Error('Standalone export waited behind its own file job.')),8000);})]).finally(()=>clearTimeout(deadline));
}
let sourceRevision='2026-09-15T12:00:00.000Z',changeSourceRevisionDuringExport=false,dailyRecordCanonical=true;
const duplicateAssetBlob=new Blob([new Uint8Array([137,80,78,71,13,10,26,10,9,8,7,6])],{type:'image/png'}),duplicateAssetHash=await codec.checksumBlob(duplicateAssetBlob);
let assetRows=[],assetGetCalls=0,assetBlobOverrides=new Map();
const backupCompletions=[],snapshotFenceOptions=[];
const documentStub=freeze({defaultView:freeze({}),getElementById:()=>null,addEventListener:()=>false,createElement:()=>({click:()=>events.push('safety-copy-download'),remove:()=>false}),createDocumentFragment:()=>({appendChild:()=>false}),body:freeze({appendChild:()=>false})});
const fn=()=>false;
const backupPresentation=createBackupPresentation();
let runtime;
runtime=BackupModule.createRuntime(freeze({ports:freeze({
  configuration:freeze({appVersion:'QA_FIXTURE',backupVersion:RUNTIME_DATA_CONTRACT.schemas.Backup.version,limits}),

  persistence:freeze({
    activeSessionLoad:async()=>({ok:true,value:null,error:null,storage:{local:false,idb:false}}),activeSessionSave:async value=>({ok:true,value}),activeSessionClear:async()=>true,activeSessionSettled:async()=>true,
    dailyRecordBackupDates:async()=>{if(changeSourceRevisionDuringExport){changeSourceRevisionDuringExport=false;sourceRevision='2026-09-15T12:00:01.000Z';}return {dates:[...new Set(['2026-08-03',...importedDailyRecords.map(record=>record.date)])].sort(),warning:dailyRecordCanonical?'':'Saved-day IndexedDB was unavailable, so this backup contains only emergency fallback records.',canonical:dailyRecordCanonical};},dailyRecordBackupMonth:async(month,options={})=>{if(!dailyRecordCanonical&&options.requireCanonical===true)throw new Error('Canonical Daily Records are unavailable.');const dates=[...new Set(['2026-08-03',...importedDailyRecords.map(record=>record.date)])].filter(date=>String(date).startsWith(String(month)+'-')).sort();return dates.map(date=>[...importedDailyRecords].reverse().find(record=>record.date===date)||(date==='2026-08-03'?freeze({version:16,recordKind:'study',date,reflection:'saved historical reflection',studyQuality:5,savedAt:'2026-08-03T20:00:00.000Z'}):null)).filter(Boolean);},dailyRecordDocuments:async(dates,options={})=>{if(!dailyRecordCanonical&&options.requireCanonical===true)throw new Error('Canonical Daily Records are unavailable.');
      const records=dates.map(date=>[...importedDailyRecords].reverse().find(record=>record.date===date)||(date==='2026-08-03'?freeze({version:16,recordKind:'study',date,reflection:'saved historical reflection',studyQuality:5,savedAt:'2026-08-03T20:00:00.000Z'}):null)).filter(Boolean);
      if(corruptPostCommitReadOnce&&records.length){corruptPostCommitReadOnce=false;return records.map((record,index)=>index===0?freeze({...record,reflection:'corrupted after commit'}):record);}
      return records;
    },
    dailyRecordImportBatches:async(values,options={})=>{
      if(cancelDuringBatchOnce&&values.length){
        cancelDuringBatchOnce=false;
        importedDailyRecords.push(values[0]);
        if(typeof options.yieldControl==='function')await options.yieldControl();
        runtime.controller.cancelImport('Adversarial cancellation during a committed import batch.');
        try{if(typeof options.yieldControl==='function')await options.yieldControl();}
        catch(error){Object.defineProperty(error,'committedRecords',{value:1,configurable:true});throw error;}
      }
      importedDailyRecords.push(...values);
      if(corruptAfterImportOnce){corruptAfterImportOnce=false;corruptPostCommitReadOnce=true;}
      return {batches:values.length?1:0};
    },dailyRecordRemove:async date=>{for(let index=importedDailyRecords.length-1;index>=0;index--)if(importedDailyRecords[index].date===date)importedDailyRecords.splice(index,1);return true;},dailyRecordTimestamp:value=>Date.parse(value?.savedAt||value?.updatedAt||'')||0,
    notesExportPayload:()=>currentNotes,notesReadFreshPayload:async()=>currentNotes,notesReadFreshItems:async keys=>(keys||[]).map(key=>currentNotes[key]||null),notesFlush:async()=>true,notesNormalizePayload:value=>Object.fromEntries(Object.entries(value||{}).map(([key,item])=>[key,normalizeNote(item,key)]).filter(([,item])=>item)),
    notesTrashKey:key=>String(key).startsWith('~')?'':'~deleted '+key,notesAlignByTitle:value=>value,notesFailure:()=>noteFailure,
    restoreJournalPrepare:async value=>{restoreJournal={state:{id:value.id},payload:value};return restoreJournal;},
    restoreJournalRead:async()=>restoreJournal,
    restoreJournalMark:async(id,phase)=>{assert.equal(id,restoreJournal.state.id);restoreJournal.state.phase=phase;return restoreJournal.state;},
    restoreJournalClear:async id=>{if(id)assert.equal(id,restoreJournal.state.id);restoreJournal=null;return true;},
    personalSettle:async()=>true,personalExport:async()=>personalDataFixture,personalImport:async()=>true,personalVerify:async()=>true,storageGeneration:()=>0,sourceRevision:async()=>sourceRevision,snapshotRevision:async options=>{snapshotFenceOptions.push(Object.freeze({...options}));return options?.full===true?'full-stable':'fast-stable';},canonicalMutationEpochRead:async()=>null,canonicalPreparationRebase:async()=>Object.freeze({epoch:null,stamps:Object.freeze([])}),preparationUnitStamps:async()=>[],preparationUnitReplace:async()=>[],scheduleRead:()=> '08:00 | 60 | Existing | work | Ethics | block | 1',
    installationId:()=> 'inst_device_a',deletionRecoveryFlush:async()=>true,deletionRecoverySavedDays:async()=>[],deletionRecoveryReplaceSavedDays:async()=>true,deletionRecoveryNotes:async()=>[],deletionRecoveryReplaceNotes:async()=>true,deletionRecoveryAttachments:async()=>[],deletionRecoveryReplaceAttachments:async()=>true,deletionRecoveryClearAttachment:async()=>true,reconciliationBaseRead:async()=>null,reconciliationBaseReadNotes:async()=>freeze({}),reconciliationBaseReadDays:async()=>freeze({}),...keptReviews.ports,reconciliationBaseWrite:async()=>true
  }),
  exports:freeze({...testProcessing,followProtection:async()=>false,backgroundAvailable:()=>true,protect:async file=>typeof file==='function'?await file():file,unprotect:async blob=>({blob,encrypted:false}),check:()=>{},job:exclusiveFileJob,download:()=>({status:'downloaded'}),chooseSave:(filename,accept,options)=>{chosenNames.push(filename);assert.equal(options?.id,'study-director-backups');return chooseSaveResult();},save:async(file,handle,options)=>{assert.ok(file.blob.size>0,'A backup file must never receive an empty backup.');assert.equal(typeof options?.onProgress,'function');return handle?{status:'saved',filename:handle.name}:{status:exportSaveStatus};}}),
  assets:freeze({get:async id=>{assetGetCalls+=1;return assetRows.some(row=>row.id===id)?(assetBlobOverrides.get(id)||duplicateAssetBlob):null;},put:async()=>true,keys:async()=>assetRows.map(row=>row.id),list:async()=>assetRows,importAll:async()=>0,restoreAll:async()=>true,removeMany:async()=>0,removeMetadata:async()=>0,scheduleMaintenance:()=>true}),
    codecs:freeze({activeSession:activeSessionCodec,backup:runtimeCodec,pendingReview:pendingReviewCodec}),
    reconciliation:freeze({createPlan:ReconciliationModule.createPlan,resolvePlan:ReconciliationModule.resolvePlan,summarizePlan:ReconciliationModule.summarizePlan}),noteReconciliation:freeze({merge:paragraphMerge,resolve:async({conflicts=[]})=>freeze({format:'study-director.note-reconciliation-result',version:1,notes:freeze(Object.fromEntries(conflicts.map(item=>[item.key,freeze({text:item.localValue,localCandidateId:item.localCandidateId,incomingCandidateId:item.incomingCandidateId})])))})}),
  session:freeze({canMutate:()=>true,cancelLiveDraftSave:()=>events.push('cancel-save'),captureSnapshot:()=>null,hasActiveSession:()=>activeSessionBlocking,hasTasks:()=>false,toActiveSession:()=>null,withPersistenceSuppressed:async operation=>{events.push('suppression:start');try{return await operation();}finally{events.push('suppression:end');}},yieldSession:async()=>false}),
  domain:freeze({
    clampText,filenameSafeStudentName:()=> 'student',getStudentName:()=> 'Student',
    materializeDailyRecordView:value=>value,sanitizeCurrentDailyRecord:dailyRecordCodec.sanitizeCurrentDailyRecord,todayISO:()=> '2026-08-05'
  }),
  view:freeze({presentation:backupPresentation,refreshPnote:fn,refreshReview:fn,renderSchedule:fn}),
  events:freeze({
    libraryChanged:()=>events.push('library-changed'),backupCompleted:context=>backupCompletions.push(context||{}),
    reconcileNotes:async payload=>{
      events.push('reconcile-notes');
      if(areaImportFailureOnce){areaImportFailureOnce=false;throw new Error('simulated note import failure');}
      const normalized=Object.fromEntries(Object.entries(payload||{}).map(([key,item])=>[key,normalizeNote(item,key)]).filter(([,item])=>item));
      currentNotes=freeze({...currentNotes,...normalized});return currentNotes;
    },
    restoreNotesSnapshot:async payload=>{events.push('rollback-notes');currentNotes=freeze(Object.fromEntries(Object.entries(payload||{}).map(([key,item])=>[key,normalizeNote(item,key)]).filter(([,item])=>item)));return currentNotes;},
    restoreSessionState:async()=>{events.push('restore-session-state');return true;},
    verifyActiveSessionRuntime:async()=>true,restoredFromFile:()=>false
  }),
  operations:freeze({canShare:()=>true,assertAuthority:()=>true,clearFault:fn,failClosed:fn,runExclusive:async(kind,operation)=>operation()}),
  interactions:freeze({
    choose:async()=>null,
    configure:async config=>{
      confirmations.push(config);
      const selected={};
      if(selectIncomingSavedDay){
        for(const group of config.groups||[]){
          if(!String(group.id||'').startsWith('savedDay__'))continue;
          const incoming=(group.choices||[]).find(choice=>choice.value!==group.defaultValue);
          if(incoming)selected[group.id]=incoming.value;
        }
      }
      return freeze(selected);
    },
    notify:fn
  }),
  environment:freeze({
    AbortController,clearTimeout,yieldTask:async()=>{},
    setTimeout:(callback,delay)=>delay>=300000?setTimeout(callback,delay):(callback(),1)
  }),
  diagnostics:freeze({capture:(scope,error,level)=>events.push(`diagnostic:${scope}:${level}:${error?.message||error}`),start:()=>'',mark:()=>false,finish:()=>false,fail:()=>false})
})}));

// Current-format checkpoint export is verified from canonical repositories; unsaved Review state belongs only to Active Session.
snapshotFenceOptions.length=0;
const created=await runtime.controller.createCheckpoint();
assert.ok(snapshotFenceOptions.length>=2,'A checkpoint must fence both capture and prepared publication.');
assert.ok(snapshotFenceOptions.every(options=>options.full!==true),'Healthy canonical capture must use the fast snapshot fence.');
assert.equal(created.counts.dailyRecord,1);
assert.equal(created.counts.note,2);
const parsed=await codec.inspectCurrent(created.blob,{filename:created.filename});
assert.equal(parsed.records[0].reflection,'saved historical reflection');
assert.equal(parsed.records[0].studyQuality,5);
assert.equal(parsed.manifest.deviceId,undefined,'Backups must not contain device identity metadata.');
assert.equal(parsed.manifest.checkpoint?.format,'study-director.checkpoint-metadata');
assert.equal(parsed.manifest.checkpoint?.originInstallationId,'inst_device_a');
assert.equal(parsed.manifest.checkpoint?.createdAt,parsed.manifest.exportedAt);

// Standalone full snapshots deduplicate physical I/O only when logical aliases point at the same verified physical attachment file.
assetRows=freeze([
  freeze({id:'img-duplicate-content-0001',file:'attblob-shared-duplicate-0001',type:'image/png',size:duplicateAssetBlob.size,hash:duplicateAssetHash,name:'first.png',library:true}),
  freeze({id:'img-duplicate-content-0002',file:'attblob-shared-duplicate-0001',type:'image/png',size:duplicateAssetBlob.size,hash:duplicateAssetHash,name:'second.png',library:true})
]);assetGetCalls=0;
const duplicateAssetCheckpoint=await runtime.controller.createCheckpoint(),duplicateAssetParsed=await codec.inspectCurrent(duplicateAssetCheckpoint.blob,{filename:duplicateAssetCheckpoint.filename});
assert.equal(assetGetCalls,1,'Standalone capture should open one body when logical attachment aliases share the same physical file, checksum and size.');
assert.equal(duplicateAssetParsed.assetDescriptors.length,2,'Standalone deduplication must preserve both logical attachment descriptors.');
assert.equal(duplicateAssetParsed.importedAssets.length,2,'Standalone restore must reconstruct both logical attachment identities from the one stored body.');
assert.equal(duplicateAssetParsed.assetBytes,duplicateAssetBlob.size,'The standalone container must physically store duplicate content only once.');
assetRows=freeze([
  freeze({id:'img-duplicate-content-0001',file:'attblob-divergent-physical-0001',type:'image/png',size:duplicateAssetBlob.size,hash:duplicateAssetHash,name:'first.png',library:true}),
  freeze({id:'img-duplicate-content-0002',file:'attblob-divergent-physical-0002',type:'image/png',size:duplicateAssetBlob.size,hash:duplicateAssetHash,name:'second.png',library:true})
]);assetBlobOverrides=new Map();assetGetCalls=0;
const divergentPhysicalCheckpoint=await runtime.controller.createCheckpoint(),divergentPhysicalParsed=await codec.inspectCurrent(divergentPhysicalCheckpoint.blob,{filename:divergentPhysicalCheckpoint.filename});
assert.equal(assetGetCalls,4,'Distinct physical files that claim one content identity must each be authenticated before portable content deduplication, then captured independently.');
assert.equal(divergentPhysicalParsed.assetBytes,duplicateAssetBlob.size,'Portable encoding may still deduplicate independently verified identical content bodies.');
const corruptedAliasBlob=new Blob([new Uint8Array([137,80,78,71,13,10,26,10,9,8,7,5])],{type:'image/png'});
assert.equal(corruptedAliasBlob.size,duplicateAssetBlob.size);
assetBlobOverrides=new Map([['img-duplicate-content-0002',corruptedAliasBlob]]);assetGetCalls=0;
await assert.rejects(()=>runtime.controller.createCheckpoint(),/physical alias failed integrity verification/u,"A distinct physical attachment that only claims another file's checksum must fail before checksum:size deduplication can hide it.");
assert.equal(assetGetCalls,2,'An anomalous alias group should fail during its focused physical-source authentication before the normal capture pass begins.');
assetBlobOverrides=new Map();assetRows=[];

// A source-revision change during capture must fail closed even if another snapshot token appears stable.
changeSourceRevisionDuringExport=true;
await assert.rejects(()=>runtime.controller.createCheckpoint(),/Stored data changed while capturing the backup/u);
sourceRevision='2026-09-15T12:00:00.000Z';

// Recovery freshness is recorded only when the file destination itself is reopened and verified.
backupCompletions.length=0;
exportSaveStatus='downloaded';
assert.equal((await withoutFileJobDeadlock(()=>runtime.controller.exportLocal())).status,'downloaded');
assert.equal(currentFileJob,null,'standalone export must release its exclusive file job');
assert.equal(backupCompletions.length,1);
assert.deepEqual({...backupCompletions[0].copy},{source:'file',sourceRevision:'2026-09-15T12:00:00.000Z',verified:false},'a download is a backup the person made; it cannot be read back, so it is recorded unverified');
// The save dialog opens from the click with the backup's file name; a file saved
// there and read back is a verified copy of the data as of its capture.
backupCompletions.length=0;chosenNames.length=0;chooseSaveResult=()=>Promise.resolve({name:'chosen.sdbackup'});
const savedExport=await withoutFileJobDeadlock(()=>runtime.controller.exportLocal());
assert.equal(savedExport.status,'saved');assert.match(chosenNames[0],/-study-director-backup-\d{4}-\d{2}-\d{2}\.sdbackup$/u);
assert.equal(backupCompletions.length,1);assert.deepEqual({...backupCompletions[0].copy},{source:'file',sourceRevision:'2026-09-15T12:00:00.000Z',verified:true});
// Closing the dialog cancels quietly: nothing is prepared or recorded.
backupCompletions.length=0;chooseSaveResult=()=>Promise.reject(Object.assign(new Error('cancelled'),{name:'AbortError'}));
assert.equal((await withoutFileJobDeadlock(()=>runtime.controller.exportLocal())).status,'cancelled');assert.equal(backupCompletions.length,0);
chooseSaveResult=()=>Promise.resolve(null);
backupCompletions.length=0;
exportSaveStatus='downloaded';
changeSourceRevisionDuringExport=true;
assert.equal((await withoutFileJobDeadlock(()=>runtime.controller.exportLocal())).status,'failed','Changing source data during preparation must fail before any browser download is triggered.');
sourceRevision='2026-09-15T12:00:00.000Z';
assert.equal((await withoutFileJobDeadlock(()=>runtime.controller.exportLocal())).status,'downloaded','Standalone export must complete preparation and start the verified browser download in one click.');
assert.equal(currentFileJob,null,'The one-click standalone export must release its exclusive file lock.');
exportSaveStatus='downloaded';
backupCompletions.length=0;
assert.deepEqual(Object.keys(parsed.data.notes).sort(),['Economics','Ethics']);
assert.equal(parsed.data.notes.Economics.text,'shared text');
assert.equal(parsed.data.notes.Ethics.text,'shared text','identical text across distinct keys must be preserved, not deduplicated');
assert.equal(parsed.importedReflectionDrafts,undefined,'Current v20 backups must not expose the retired Reflection Draft domain.');

// Verified round trip imports repositories before any session/UI restoration and keeps both note identities.
const candidate=await runtime.controller.inspect(created.blob,{filename:created.filename});
assert.deepEqual(candidate.preview.dateRange,{first:'2026-08-03',last:'2026-08-03'});
assert.equal(candidate.preview.checksumAlgorithm,'sha256');
assert.equal(candidate.preview.authenticated,false);
assert.equal(candidate.preview.encrypted,false);
// Restore preflight must reserve enough space for the current physical attachment library that will be copied into the rollback safety snapshot.
const capacityCandidate=await runtime.controller.inspect(created.blob,{filename:created.filename}),originalNavigatorDescriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');
assetRows=[freeze({id:'img-capacity-preflight-0001',file:'attblob-capacity-preflight-0001',type:'image/png',size:12*1024*1024,hash:duplicateAssetHash,name:'capacity.png',library:true})];
Object.defineProperty(globalThis,'navigator',{configurable:true,value:freeze({storage:freeze({estimate:async()=>freeze({quota:10*1024*1024,usage:0})})})});
await assert.rejects(()=>runtime.controller.restore(capacityCandidate),/enough available browser storage/i,'Restore capacity preflight must include unique current attachment bytes needed by the rollback safety copy.');
assetRows=[];
if(originalNavigatorDescriptor)Object.defineProperty(globalThis,'navigator',originalNavigatorDescriptor);else delete globalThis.navigator;
// Modern checkpoint reconciliation must not block solely because the current device has
// an active session; incoming absence is non-destructive and the local session remains authoritative.
activeSessionBlocking=true;
restoring=true;
backupCodecInspectCalls=0;
const suppressionStartBeforeRestore=events.filter(value=>value==='suppression:start').length;
const restored=await runtime.controller.restore(candidate);
activeSessionBlocking=false;
assert.equal(backupCodecInspectCalls,1,'Restore safety-copy creation should reuse its successful self-inspection as the rollback snapshot instead of decoding the same safety file twice.');
assert.equal(events.filter(value=>value==='suppression:start').length,suppressionStartBeforeRestore+1,'restore must enter the ambient session-persistence suppression scope');
assert.ok(events.lastIndexOf('suppression:end')>=suppressionStartBeforeRestore,'suppression must remain active through restore commit and verification');
assert.equal(restored.added+restored.replaced,0,'identical Saved Days must remain untouched rather than being rewritten');
assert.equal(importedDailyRecords.length,0,'identical local Saved Days must not create an import write');
assert.equal(restored.notesReconciled,false,'identical notes must not be rewritten');
assert.equal(events.includes('reconcile-notes'),false);
assert.equal(events.includes('import-active-session'),false);
assert.equal(currentNotes.Economics.version,2,'reconciled restore state must remain lean AreaNote.v2');
assert.equal(currentNotes.Ethics.version,2);

// Highly compressible input is stopped at the expanded-byte boundary before parsing or mutation.
const gzipBomb=new Blob([gzipSync('\n'.repeat(limits.backupMaxUncompressedBytes+1024))],{type:'application/gzip'});
await assert.rejects(()=>codec.inspectCurrent(gzipBomb,{filename:'gzip-bomb.sdbackup.gz'}),/retired|unsupported/u);

// Post-commit verification detects a corrupted write and restores the safety snapshot.
// Make the local Saved Day genuinely divergent so the v15 conflict contract performs an explicit replacement rather than treating it as identical.
importedDailyRecords.push(freeze({version:16,recordKind:'study',date:'2026-08-03',reflection:'local divergent reflection',studyQuality:2,savedAt:'2026-08-03T21:00:00.000Z'}));
restoring=true;safetyReadDone=false;corruptAfterImportOnce=true;selectIncomingSavedDay=true;
const verificationCandidate=await runtime.controller.inspect(created.blob,{filename:created.filename});
const verificationFailure=await runtime.controller.restore(verificationCandidate).then(()=>null,error=>error);
assert.ok(verificationFailure instanceof Error);
assert.match(verificationFailure.message,/Post-restore verification failed for saved day/u);
assert.equal(verificationFailure.studyDirectorCommittedDescription,'');
assert.match(verificationFailure.studyDirectorRollbackDescription,/rolled back from the verified safety copy/u);

// Cancellation is observed during a committed repository batch, yields to the UI, and rolls back safely.
cancelDuringBatchOnce=true;
const cancellationCandidate=await runtime.controller.inspect(created.blob,{filename:created.filename});
const cancellationFailure=await runtime.controller.restore(cancellationCandidate).then(()=>null,error=>error);
assert.ok(cancellationFailure instanceof Error);
assert.equal(cancellationFailure.code,'STUDY_DIRECTOR_IMPORT_CANCELLED');
assert.equal(cancellationFailure.studyDirectorCommittedDescription,'');
assert.match(cancellationFailure.studyDirectorRollbackDescription,/rolled back from the verified safety copy/u);
assert.equal(runtime.controller.status().importActive,false);
restoring=false;

// A failure after a committed daily-record write automatically replays the verified rollback journal.
// Remove one local Area so reconciliation has a real additive note write to fail after the Saved-Day commit.
currentNotes=freeze({Economics:notes.Economics});
restoring=true;safetyReadDone=false;areaImportFailureOnce=true;
const rollbackCandidate=await runtime.controller.inspect(created.blob,{filename:created.filename});
const rollbackFailure=await runtime.controller.restore(rollbackCandidate).then(()=>null,error=>error);
assert.ok(rollbackFailure instanceof Error);
assert.equal(rollbackFailure.studyDirectorCommittedDescription,'');
assert.match(rollbackFailure.studyDirectorRollbackDescription,/rolled back from the verified safety copy/u);
assert.deepEqual(Object.keys(currentNotes),['Economics'],'rollback must restore the pre-import per-key note set');
currentNotes=notes;
restoring=false;

// A durable journal left by a terminated tab is automatically replayed on the next startup.
importedDailyRecords.splice(0,importedDailyRecords.length,freeze({version:16,recordKind:'study',date:'2026-08-04',reflection:'interrupted imported state',savedAt:'2026-08-04T20:00:00.000Z'}));
restoreJournal={
  state:{id:'restore_crash_recovery_12345678',phase:'notes-committed'},
  payload:{id:'restore_crash_recovery_12345678',blob:created.blob,filename:created.filename,scheduleText:'08:00 | 60 | Existing | work | Ethics | block | 1'}
};
const crashRecovery=await runtime.controller.recoverInterruptedRestore();
assert.equal(crashRecovery.recovered,true);
assert.equal(backupPresentation.read('file','startup-recovery').outcome,'local-recovery-completed');
assert.equal(backupPresentation.read('file','startup-recovery').lifecycle,'succeeded');
assert.equal(restoreJournal,null,'startup recovery must clear the durable journal only after verified rollback');
assert.deepEqual([...new Set(importedDailyRecords.map(record=>record.date))],['2026-08-03']);
assert.ok(events.includes('restore-session-state'));

// A failed canonical note flush is recoverable when the durable note payload is still readable.
// The checkpoint must include that durable state and surface the recovery warning rather than
// rejecting a complete, verifiable backup merely because the preceding flush reported failure.
noteFailure={failed:true,message:'IndexedDB note flush failed'};
snapshotFenceOptions.length=0;
const rescuedCheckpoint=await runtime.controller.createCheckpoint();
assert.ok(snapshotFenceOptions.length>=2,'Recovery capture must remain fenced through publication.');
assert.ok(snapshotFenceOptions.every(options=>options.full===true),'Degraded/recovery capture must explicitly force the full snapshot fence.');
assert.match(rescuedCheckpoint.warning,/durable recovery state/i);
await rescuedCheckpoint.release();
noteFailure={failed:false};

// Explicit standalone export remains a rescue path when Daily Records canonical IndexedDB cannot be enumerated.
dailyRecordCanonical=false;
const dailyRescueCheckpoint=await runtime.controller.createCheckpoint();
assert.match(dailyRescueCheckpoint.warning,/emergency fallback records/i,'standalone backup must preserve a visible warning when only rescue Saved Days are available');
await dailyRescueCheckpoint.release();
dailyRecordCanonical=true;

// Imported conflict clocks are normalized at runtime; future metadata cannot win by claiming a far-future timestamp.
const fixedClock=createFakeClock('2026-09-13T06:00:00.000Z');
const expectedNow=new fixedClock.Date().toISOString();
assert.equal(Persistence.normalizeImportedTimestamp('2099-01-01T00:00:00.000Z',null,fixedClock.now()),null);
assert.equal(Persistence.normalizeImportedTimestamp(expectedNow,null,fixedClock.now()),expectedNow);
assert.equal(Persistence.normalizeImportedEpochMillis(fixedClock.now()+86400000,null,fixedClock.now()),null);

console.log(JSON.stringify({
  status:'PASS',scenarios:8,
  coverage:['current verified checkpoint export','per-key reconciled notes','restore preview','post-commit verification and rollback','mid-import cancellation','terminated-tab recovery','expanded-byte limit','saved reflection preservation','canonical capture and rescue'],
  counts:created.counts,importOrder:events.filter(x=>x.startsWith('import-'))
},null,2));
